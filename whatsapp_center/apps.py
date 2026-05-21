# ============================================================
# 📂 whatsapp_center/apps.py
# 🧠 Primey Care - WhatsApp Center App Config
# ------------------------------------------------------------
# ✅ Autostart اختياري وآمن للـ WhatsApp Gateway
# ✅ يقرأ من settings أو .env مباشرة
# ✅ لا يعتمد على DB داخل ready()
# ✅ يمنع التكرار مع runserver autoreloader
# ✅ يعمل على Windows
# ✅ لا يكسر Django إذا فشل تشغيل Gateway
# ============================================================

from __future__ import annotations

import os
import shutil
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

from django.apps import AppConfig
from django.conf import settings


class WhatsappCenterConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "whatsapp_center"
    verbose_name = "WhatsApp Center"

    # --------------------------------------------------------
    # 🚀 App Ready
    # --------------------------------------------------------
    def ready(self):
        """
        تشغيل اختياري وآمن للـ gateway عند إقلاع Django.

        مهم:
        - لا نستخدم قاعدة البيانات هنا.
        - لا نوقف Django إذا فشل Gateway.
        - مع runserver نشغله فقط في process الفعلي RUN_MAIN=true.
        """
        if not self._should_autostart_gateway():
            return

        worker = threading.Thread(
            target=self._autostart_gateway_worker,
            name="primeycare-whatsapp-gateway-autostart",
            daemon=True,
        )
        worker.start()

    # --------------------------------------------------------
    # 🔧 Env / Settings Helpers
    # --------------------------------------------------------
    def _env(self, key: str, default: str = "") -> str:
        value = os.getenv(key)
        if value is None:
            return default
        return str(value).strip()

    def _setting_or_env(self, setting_name: str, env_name: str, default=""):
        setting_value = getattr(settings, setting_name, None)

        if setting_value not in [None, ""]:
            return setting_value

        env_value = os.getenv(env_name)
        if env_value not in [None, ""]:
            return env_value

        return default

    def _bool_setting_or_env(
        self,
        setting_name: str,
        env_name: str,
        default: bool = False,
    ) -> bool:
        setting_value = getattr(settings, setting_name, None)

        if isinstance(setting_value, bool):
            return setting_value

        if setting_value not in [None, ""]:
            return str(setting_value).strip().lower() in {
                "1",
                "true",
                "yes",
                "on",
            }

        env_value = os.getenv(env_name)

        if env_value in [None, ""]:
            return default

        return str(env_value).strip().lower() in {
            "1",
            "true",
            "yes",
            "on",
        }

    def _int_setting_or_env(
        self,
        setting_name: str,
        env_name: str,
        default: int,
    ) -> int:
        setting_value = getattr(settings, setting_name, None)

        raw_value = setting_value if setting_value not in [None, ""] else os.getenv(env_name)

        try:
            parsed = int(raw_value)
            return parsed if parsed > 0 else default
        except Exception:
            return default

    # --------------------------------------------------------
    # ✅ Guards
    # --------------------------------------------------------
    def _should_autostart_gateway(self) -> bool:
        """
        تحديد هل يسمح بتشغيل الـ gateway تلقائيًا أم لا.
        """
        autostart_enabled = self._bool_setting_or_env(
            "WHATSAPP_GATEWAY_AUTOSTART",
            "WHATSAPP_GATEWAY_AUTOSTART",
            False,
        )

        if not autostart_enabled:
            return False

        if self._env("DISABLE_WHATSAPP_GATEWAY_AUTOSTART").lower() in {
            "1",
            "true",
            "yes",
            "on",
        }:
            return False

        blocked_commands = {
            "makemigrations",
            "migrate",
            "collectstatic",
            "test",
            "shell",
            "shell_plus",
            "dbshell",
            "createsuperuser",
            "changepassword",
            "dumpdata",
            "loaddata",
        }

        argv = {arg.strip().lower() for arg in sys.argv if arg.strip()}

        if argv.intersection(blocked_commands):
            return False

        # runserver يطلق process أولي + process فعلي
        # نشغّل فقط في الـ process الفعلي حتى لا يفتح نسختين
        if "runserver" in argv:
            return os.getenv("RUN_MAIN") == "true"

        return True

    # --------------------------------------------------------
    # 🌐 Health Check
    # --------------------------------------------------------
    def _get_gateway_base_url(self) -> str:
        value = self._setting_or_env(
            "WHATSAPP_SESSION_GATEWAY_URL",
            "WHATSAPP_SESSION_GATEWAY_URL",
            "http://127.0.0.1:3100",
        )

        return str(value).strip().rstrip("/") or "http://127.0.0.1:3100"

    def _get_health_url(self) -> str:
        return f"{self._get_gateway_base_url()}/health"

    def _is_gateway_running(self) -> bool:
        """
        فحص هل الـ gateway يعمل فعليًا عبر health endpoint.
        """
        timeout = self._int_setting_or_env(
            "WHATSAPP_GATEWAY_AUTOSTART_HEALTH_TIMEOUT",
            "WHATSAPP_GATEWAY_AUTOSTART_HEALTH_TIMEOUT",
            2,
        )

        request = Request(
            self._get_health_url(),
            headers={"Accept": "application/json"},
            method="GET",
        )

        try:
            with urlopen(request, timeout=timeout) as response:
                return int(getattr(response, "status", 0)) == 200
        except (URLError, socket.timeout, OSError, ValueError):
            return False
        except Exception:
            return False

    # --------------------------------------------------------
    # 📁 Paths / Command Helpers
    # --------------------------------------------------------
    def _get_gateway_dir(self) -> Path:
        configured = self._setting_or_env(
            "WHATSAPP_GATEWAY_DIR",
            "WHATSAPP_GATEWAY_DIR",
            "",
        )

        if configured:
            return Path(str(configured)).expanduser().resolve()

        return (
            Path(settings.BASE_DIR) / "whatsapp_center" / "session_gateway"
        ).resolve()

    def _get_gateway_log_file(self) -> Path:
        configured = self._setting_or_env(
            "WHATSAPP_GATEWAY_LOG_FILE",
            "WHATSAPP_GATEWAY_LOG_FILE",
            "",
        )

        if configured:
            return Path(str(configured)).expanduser().resolve()

        return (Path(settings.BASE_DIR) / "logs" / "whatsapp_gateway.log").resolve()

    def _resolve_gateway_command(self, gateway_dir: Path) -> list[str]:
        """
        اختيار أمر التشغيل:
        - نفضّل node server.js
        - fallback إلى npm run start
        """
        server_js = gateway_dir / "server.js"

        node_candidates = ["node.exe", "node"] if os.name == "nt" else ["node"]
        for candidate in node_candidates:
            node_path = shutil.which(candidate)
            if node_path and server_js.exists():
                return [node_path, str(server_js)]

        npm_candidates = ["npm.cmd", "npm.exe", "npm"] if os.name == "nt" else ["npm"]
        for candidate in npm_candidates:
            npm_path = shutil.which(candidate)
            if npm_path:
                return [npm_path, "run", "start"]

        if server_js.exists():
            return ["node", str(server_js)]

        return ["npm", "run", "start"]

    # --------------------------------------------------------
    # 🧾 Logging
    # --------------------------------------------------------
    def _write_boot_log(self, message: str) -> None:
        log_file = self._get_gateway_log_file()
        log_file.parent.mkdir(parents=True, exist_ok=True)

        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")

        try:
            with log_file.open("a", encoding="utf-8") as handle:
                handle.write(f"[{timestamp}] {message}\n")
        except Exception:
            # لا نكسر Django إذا فشل ملف اللوق
            pass

    # --------------------------------------------------------
    # ▶️ Process Launch
    # --------------------------------------------------------
    def _start_gateway_process(self) -> bool:
        gateway_dir = self._get_gateway_dir()
        log_file = self._get_gateway_log_file()

        package_json = gateway_dir / "package.json"
        server_js = gateway_dir / "server.js"

        if not gateway_dir.exists():
            self._write_boot_log(f"[ERROR] Gateway directory not found: {gateway_dir}")
            return False

        if not package_json.exists() or not server_js.exists():
            self._write_boot_log(
                f"[ERROR] Missing package.json or server.js inside: {gateway_dir}"
            )
            return False

        launch_command = self._resolve_gateway_command(gateway_dir)

        log_file.parent.mkdir(parents=True, exist_ok=True)

        try:
            stdout_handle = log_file.open("a", encoding="utf-8")
            stderr_handle = log_file.open("a", encoding="utf-8")
        except Exception as exc:
            self._write_boot_log(
                f"[ERROR] Failed to open gateway log file: {exc}"
            )
            return False

        env = os.environ.copy()
        env.setdefault("PORT", "3100")
        env.setdefault("WHATSAPP_GATEWAY_PORT", "3100")
        env.setdefault("WHATSAPP_GATEWAY_HOST", "127.0.0.1")

        popen_kwargs = {
            "cwd": str(gateway_dir),
            "stdout": stdout_handle,
            "stderr": stderr_handle,
            "stdin": subprocess.DEVNULL,
            "env": env,
            "close_fds": False if os.name == "nt" else True,
        }

        if os.name == "nt":
            creationflags = (
                getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
                | getattr(subprocess, "DETACHED_PROCESS", 0)
                | getattr(subprocess, "CREATE_NO_WINDOW", 0)
            )

            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW

            popen_kwargs["creationflags"] = creationflags
            popen_kwargs["startupinfo"] = startupinfo
        else:
            if hasattr(os, "setsid"):
                popen_kwargs["preexec_fn"] = os.setsid

        try:
            subprocess.Popen(launch_command, **popen_kwargs)

            self._write_boot_log(
                "[INFO] WhatsApp gateway launch requested using command: "
                + " ".join(launch_command)
            )
            return True
        except Exception as exc:
            self._write_boot_log(f"[ERROR] Failed to launch WhatsApp gateway: {exc}")
            return False
        finally:
            # لا نغلق handles هنا مباشرة حتى لا يفقد process وجهة stdout/stderr على Windows
            pass

    # --------------------------------------------------------
    # 🔁 Worker
    # --------------------------------------------------------
    def _autostart_gateway_worker(self) -> None:
        """
        1) يفحص هل الـ gateway يعمل
        2) لو لا، يطلب تشغيله
        3) ينتظر حتى يصبح health endpoint جاهزًا
        """
        try:
            self._write_boot_log("[INFO] WhatsApp gateway autostart worker started.")

            if self._is_gateway_running():
                self._write_boot_log(
                    "[INFO] WhatsApp gateway already running; skip autostart."
                )
                return

            started = self._start_gateway_process()
            if not started:
                self._write_boot_log("[ERROR] WhatsApp gateway start request failed.")
                return

            boot_timeout = self._int_setting_or_env(
                "WHATSAPP_GATEWAY_AUTOSTART_BOOT_TIMEOUT",
                "WHATSAPP_GATEWAY_AUTOSTART_BOOT_TIMEOUT",
                25,
            )
            started_at = time.time()

            while (time.time() - started_at) < boot_timeout:
                if self._is_gateway_running():
                    self._write_boot_log(
                        "[INFO] WhatsApp gateway started successfully."
                    )
                    return

                time.sleep(1.0)

            self._write_boot_log(
                "[ERROR] WhatsApp gateway launch was requested but health check did not become ready in time."
            )

        except Exception as exc:
            self._write_boot_log(
                f"[ERROR] Unexpected autostart worker failure: {exc}"
            )