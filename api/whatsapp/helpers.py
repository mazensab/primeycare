# ============================================================
# 📂 api/whatsapp/helpers.py
# Primey Care - WhatsApp API Helpers
# ============================================================

from __future__ import annotations

import json
import logging
import os
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from django.http import JsonResponse

logger = logging.getLogger(__name__)


# ============================================================
# 📦 JSON Response Helpers
# ============================================================
def json_ok(message: str = "OK", status: int = 200, **extra):
    payload = {"ok": True, "success": True, "message": message}
    payload.update(extra)
    return JsonResponse(payload, status=status)


def json_bad_request(message: str = "Bad request", **extra):
    payload = {"ok": False, "success": False, "message": message}
    payload.update(extra)
    return JsonResponse(payload, status=400)


def json_unauthorized(message: str = "Unauthorized", **extra):
    payload = {"ok": False, "success": False, "message": message}
    payload.update(extra)
    return JsonResponse(payload, status=401)


def json_forbidden(message: str = "Forbidden", **extra):
    payload = {"ok": False, "success": False, "message": message}
    payload.update(extra)
    return JsonResponse(payload, status=403)


def json_not_found(message: str = "Not found", **extra):
    payload = {"ok": False, "success": False, "message": message}
    payload.update(extra)
    return JsonResponse(payload, status=404)


def json_conflict(message: str = "Conflict", **extra):
    payload = {"ok": False, "success": False, "message": message}
    payload.update(extra)
    return JsonResponse(payload, status=409)


def json_server_error(message: str = "Server error", **extra):
    payload = {"ok": False, "success": False, "message": message}
    payload.update(extra)
    return JsonResponse(payload, status=500)


# ============================================================
# 🔐 Request Helpers
# ============================================================
def ensure_authenticated(request):
    if not getattr(request, "user", None) or not request.user.is_authenticated:
        return json_unauthorized(
            message="Authentication required",
            error="AUTHENTICATION_REQUIRED",
        )
    return None


def read_json_body(request) -> dict[str, Any]:
    if not request.body:
        return {}

    try:
        raw = request.body.decode("utf-8")
        return json.loads(raw or "{}")
    except json.JSONDecodeError as exc:
        raise ValueError("Invalid JSON payload") from exc


def get_required(payload: dict[str, Any], key: str):
    value = payload.get(key)
    if value in (None, "", []):
        raise ValueError(f"'{key}' is required")
    return value


def parse_bool(value, default: bool = False) -> bool:
    if value is None:
        return default

    if isinstance(value, bool):
        return value

    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}

    return bool(value)


# ============================================================
# 📱 Value Helpers
# ============================================================
def mask_secret(value: str | None, keep_start: int = 4, keep_end: int = 4) -> str:
    value = (value or "").strip()
    if not value:
        return ""

    if len(value) <= keep_start + keep_end:
        return "*" * len(value)

    hidden_length = max(6, len(value) - (keep_start + keep_end))
    return f"{value[:keep_start]}{'*' * hidden_length}{value[-keep_end:]}"


def clean_phone(value: str | None) -> str:
    raw = (value or "").strip()
    if not raw:
        return ""

    digits = [ch for ch in raw if ch.isdigit()]
    return "".join(digits)


def normalize_text(value: Any) -> str:
    return str(value or "").strip()


def get_model_attr(instance, field_name: str, default=None):
    return getattr(instance, field_name, default)


def set_model_attr_if_exists(instance, field_name: str, value) -> None:
    if hasattr(instance, field_name):
        setattr(instance, field_name, value)


def bool_or_default(value, default: bool = False) -> bool:
    return parse_bool(value, default=default)


# ============================================================
# 🌐 Session Gateway Helpers
# ============================================================
def get_session_gateway_base_url() -> str:
    return (os.getenv("WHATSAPP_SESSION_GATEWAY_URL") or "").strip().rstrip("/")


def get_session_gateway_token() -> str:
    return (os.getenv("WHATSAPP_SESSION_GATEWAY_TOKEN") or "").strip()


def get_session_gateway_timeout(default: int = 20) -> int:
    raw = (os.getenv("WHATSAPP_SESSION_GATEWAY_TIMEOUT") or str(default)).strip()
    try:
        timeout = int(raw)
        return timeout if timeout > 0 else default
    except (TypeError, ValueError):
        return default


def _gateway_headers() -> dict[str, str]:
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    token = get_session_gateway_token()
    if token:
        headers["Authorization"] = f"Bearer {token}"

    return headers


def _safe_json_loads(raw: str) -> dict[str, Any]:
    try:
        parsed = json.loads(raw or "{}")
        return parsed if isinstance(parsed, dict) else {"raw_response": parsed}
    except json.JSONDecodeError:
        return {
            "success": False,
            "message": "Invalid JSON response from session gateway",
            "raw_response": raw,
            "session_status": "failed",
        }


def call_session_gateway(
    action: str,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    يربط Django مع خدمة خارجية مسؤولة عن:
    - إنشاء QR
    - إنشاء Pairing Code
    - جلب حالة الجلسة
    - فصل الجلسة

    المتغير المطلوب:
      WHATSAPP_SESSION_GATEWAY_URL=http://127.0.0.1:3100

    المسارات المتوقعة على الـ gateway:
      POST /session/create-qr/
      POST /session/create-pairing-code/
      POST /session/disconnect/
      POST /session/status/
    """
    base_url = get_session_gateway_base_url()
    if not base_url:
        return {
            "success": False,
            "status_code": 500,
            "message": "WHATSAPP_SESSION_GATEWAY_URL is not configured",
            "session_status": "disconnected",
        }

    path_map = {
        "create_qr": "/session/create-qr/",
        "create_pairing_code": "/session/create-pairing-code/",
        "disconnect": "/session/disconnect/",
        "status": "/session/status/",
    }

    if action not in path_map:
        return {
            "success": False,
            "status_code": 400,
            "message": f"Unsupported gateway action: {action}",
            "session_status": "failed",
        }

    target_url = urljoin(f"{base_url}/", path_map[action].lstrip("/"))
    request_body = json.dumps(payload or {}).encode("utf-8")

    req = Request(
        target_url,
        data=request_body,
        headers=_gateway_headers(),
        method="POST",
    )

    try:
        with urlopen(req, timeout=get_session_gateway_timeout()) as response:
            raw = response.read().decode("utf-8") or "{}"
            data = _safe_json_loads(raw)

            if "success" not in data:
                data["success"] = True

            if "status_code" not in data:
                data["status_code"] = getattr(response, "status", 200)

            return data

    except HTTPError as exc:
        try:
            body = exc.read().decode("utf-8") or ""
            parsed = _safe_json_loads(body) if body else {}
        except Exception:
            parsed = {}

        logger.exception("WhatsApp session gateway HTTPError: %s", exc.code)
        return {
            "success": False,
            "status_code": exc.code,
            "message": parsed.get("message") or f"Gateway HTTPError {exc.code}",
            "details": parsed,
            "session_status": "failed",
        }

    except URLError as exc:
        logger.exception("WhatsApp session gateway URLError")
        return {
            "success": False,
            "status_code": 503,
            "message": f"Session gateway connection failed: {exc.reason}",
            "session_status": "failed",
        }

    except Exception as exc:
        logger.exception("Unexpected session gateway error")
        return {
            "success": False,
            "status_code": 500,
            "message": f"Unexpected session gateway error: {str(exc)}",
            "session_status": "failed",
        }