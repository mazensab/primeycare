# ============================================================
# 📂 whatsapp_center/client.py
# Primey Care - WhatsApp Provider Client
# ============================================================
# ✅ يدعم:
# - مزودات Stub الحالية
# - WhatsApp Web Session Gateway
# - Session Management:
#   * Create QR
#   * Create Pairing Code
#   * Get Session Status
#   * Disconnect Session
# - Core Messaging:
#   * Send Text Message
#   * Send Document Message
# ============================================================

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from typing import Any, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)


# ============================================================
# 🔒 Constants
# ============================================================

DEFAULT_API_VERSION = "v22.0"
DEFAULT_SESSION_NAME = "primey-care-system-session"
DEFAULT_GATEWAY_TIMEOUT = 20

SESSION_PROVIDERS = {
    "whatsapp_web_session",
    "web_session",
    "WEB_SESSION",
}


# ============================================================
# 📦 Send Result
# ============================================================

@dataclass
class WhatsAppSendResult:
    success: bool
    status_code: int
    provider_status: str = ""
    external_message_id: str = ""
    response_data: Optional[dict[str, Any]] = None
    error_message: str = ""


# ============================================================
# 📦 Session Result
# ============================================================

@dataclass
class WhatsAppSessionResult:
    success: bool
    status_code: int
    session_status: str = "disconnected"
    connected: bool = False
    connected_phone: str = ""
    device_label: str = ""
    qr_code: str = ""
    pairing_code: str = ""
    last_connected_at: str = ""
    response_data: Optional[dict[str, Any]] = None
    error_message: str = ""


# ============================================================
# 🔧 Small Helpers
# ============================================================

def _safe_str(value: Any, default: str = "") -> str:
    if value is None:
        return default

    text = str(value).strip()
    return text or default


def _safe_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value

    if value is None:
        return default

    if isinstance(value, str):
        normalized = value.strip().lower()

        if normalized in {"1", "true", "yes", "on"}:
            return True

        if normalized in {"0", "false", "no", "off"}:
            return False

    if isinstance(value, int):
        return value == 1

    return default


def _safe_int(value: Any, default: int = DEFAULT_GATEWAY_TIMEOUT) -> int:
    try:
        parsed = int(value)
        return parsed if parsed > 0 else default
    except Exception:
        return default


def _extract_message(data: dict[str, Any], fallback: str = "") -> str:
    if not isinstance(data, dict):
        return fallback

    details = data.get("details")

    if isinstance(details, dict):
        detail_message = (
            details.get("message")
            or details.get("error")
            or details.get("detail")
            or details.get("raw_response")
        )
    else:
        detail_message = details

    return _safe_str(
        data.get("message")
        or data.get("error")
        or data.get("error_message")
        or detail_message,
        fallback,
    )


# ============================================================
# 💬 WhatsApp Client
# ============================================================

class WhatsAppClient:
    """
    عميل إرسال واتساب.

    يدعم:
    - Stub افتراضي للمزودات غير المربوطة بعد
    - WhatsApp Web Session Gateway

    متغيرات البيئة المدعومة:
    - WHATSAPP_SESSION_GATEWAY_URL
    - WHATSAPP_GATEWAY_URL
    - WHATSAPP_WEB_SESSION_GATEWAY_URL

    مثال:
    WHATSAPP_SESSION_GATEWAY_URL=http://127.0.0.1:3100
    """

    SESSION_PROVIDERS = SESSION_PROVIDERS

    def __init__(
        self,
        *,
        provider: str,
        access_token: str = "",
        phone_number_id: str = "",
        api_version: str = DEFAULT_API_VERSION,
        session_name: str = "",
    ):
        self.provider = _safe_str(provider)
        self.access_token = _safe_str(access_token)
        self.phone_number_id = _safe_str(phone_number_id)
        self.api_version = _safe_str(api_version, DEFAULT_API_VERSION)
        self.session_name = _safe_str(session_name, DEFAULT_SESSION_NAME)

    # --------------------------------------------------------
    # ⚙️ Gateway Config
    # --------------------------------------------------------
    @property
    def gateway_base_url(self) -> str:
        """
        رابط خدمة WhatsApp Session Gateway.

        الأولوية:
        1) WHATSAPP_SESSION_GATEWAY_URL
        2) WHATSAPP_GATEWAY_URL
        3) WHATSAPP_WEB_SESSION_GATEWAY_URL
        """
        return _safe_str(
            os.getenv("WHATSAPP_SESSION_GATEWAY_URL")
            or os.getenv("WHATSAPP_GATEWAY_URL")
            or os.getenv("WHATSAPP_WEB_SESSION_GATEWAY_URL")
        ).rstrip("/")

    @property
    def gateway_token(self) -> str:
        return _safe_str(
            os.getenv("WHATSAPP_SESSION_GATEWAY_TOKEN")
            or os.getenv("WHATSAPP_GATEWAY_TOKEN")
            or os.getenv("WHATSAPP_WEB_SESSION_GATEWAY_TOKEN")
        )

    @property
    def gateway_timeout(self) -> int:
        return _safe_int(
            os.getenv("WHATSAPP_SESSION_GATEWAY_TIMEOUT")
            or os.getenv("WHATSAPP_GATEWAY_TIMEOUT")
            or os.getenv("WHATSAPP_WEB_SESSION_GATEWAY_TIMEOUT"),
            DEFAULT_GATEWAY_TIMEOUT,
        )

    # --------------------------------------------------------
    # 🧠 Internal Helpers
    # --------------------------------------------------------
    def _normalized_provider(self) -> str:
        return _safe_str(self.provider).lower()

    def _is_web_session_provider(self) -> bool:
        normalized = self._normalized_provider()

        return self.provider in self.SESSION_PROVIDERS or normalized in {
            "whatsapp_web_session",
            "web_session",
            "web-session",
        }

    def _gateway_headers(self) -> dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        if self.gateway_token:
            headers["Authorization"] = f"Bearer {self.gateway_token}"

        return headers

    def _build_request(
        self,
        *,
        url: str,
        method: str = "POST",
        payload: Optional[dict[str, Any]] = None,
    ) -> Request:
        data = None

        if payload is not None:
            data = json.dumps(payload).encode("utf-8")

        return Request(
            url,
            data=data,
            headers=self._gateway_headers(),
            method=method.upper(),
        )

    def _safe_json_loads(self, raw: str) -> dict[str, Any]:
        try:
            parsed = json.loads(raw or "{}")
            return parsed if isinstance(parsed, dict) else {"raw_response": parsed}
        except json.JSONDecodeError:
            return {
                "success": False,
                "message": "Invalid JSON response from gateway",
                "raw_response": raw,
            }

    def _gateway_not_configured_payload(self) -> dict[str, Any]:
        message = (
            "WHATSAPP_SESSION_GATEWAY_URL is not configured. "
            "Set it in the backend .env, for example: "
            "WHATSAPP_SESSION_GATEWAY_URL=http://127.0.0.1:3100"
        )

        return {
            "success": False,
            "status_code": 500,
            "provider_status": "gateway_not_configured",
            "message": message,
            "error_message": message,
            "session_status": "failed",
            "connected": False,
            "session_name": self.session_name,
            "provider": self.provider,
            "missing_env": "WHATSAPP_SESSION_GATEWAY_URL",
        }

    # --------------------------------------------------------
    # 🌐 Gateway Core Request
    # --------------------------------------------------------
    def _gateway_request(
        self,
        *,
        path: str,
        method: str = "POST",
        payload: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """
        استدعاء موحد للـ Session Gateway الخارجي.
        """
        if not self.gateway_base_url:
            logger.warning("WhatsApp session gateway URL is not configured")
            return self._gateway_not_configured_payload()

        target_url = urljoin(f"{self.gateway_base_url}/", path.lstrip("/"))

        request_obj = self._build_request(
            url=target_url,
            method=method,
            payload=payload,
        )

        try:
            with urlopen(request_obj, timeout=self.gateway_timeout) as response:
                raw = response.read().decode("utf-8") or "{}"
                data = self._safe_json_loads(raw)

                if "success" not in data:
                    data["success"] = True

                if "status_code" not in data:
                    data["status_code"] = getattr(response, "status", 200)

                if "session_name" not in data:
                    data["session_name"] = self.session_name

                if "provider" not in data:
                    data["provider"] = self.provider

                return data

        except HTTPError as exc:
            try:
                raw = exc.read().decode("utf-8") or "{}"
                parsed = self._safe_json_loads(raw)
            except Exception:
                parsed = {}

            message = _extract_message(parsed, f"Gateway HTTPError {exc.code}")

            logger.exception("WhatsApp gateway HTTPError: %s", exc.code)

            return {
                "success": False,
                "status_code": exc.code,
                "provider_status": "gateway_http_error",
                "message": message,
                "error_message": message,
                "details": parsed,
                "session_status": parsed.get("session_status") or "failed",
                "connected": _safe_bool(parsed.get("connected"), False),
                "session_name": self.session_name,
                "provider": self.provider,
            }

        except URLError as exc:
            reason = _safe_str(getattr(exc, "reason", ""), "unknown")
            message = f"Gateway connection failed: {reason}"

            logger.exception("WhatsApp gateway URLError")

            return {
                "success": False,
                "status_code": 503,
                "provider_status": "gateway_connection_failed",
                "message": message,
                "error_message": message,
                "session_status": "failed",
                "connected": False,
                "session_name": self.session_name,
                "provider": self.provider,
            }

        except Exception as exc:
            message = f"Unexpected gateway error: {str(exc)}"

            logger.exception("Unexpected WhatsApp gateway error")

            return {
                "success": False,
                "status_code": 500,
                "provider_status": "gateway_unexpected_error",
                "message": message,
                "error_message": message,
                "session_status": "failed",
                "connected": False,
                "session_name": self.session_name,
                "provider": self.provider,
            }

    def _gateway_post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        return self._gateway_request(
            path=path,
            method="POST",
            payload=payload,
        )

    # --------------------------------------------------------
    # 🧩 Result Builders
    # --------------------------------------------------------
    def _build_session_result(self, data: dict[str, Any]) -> WhatsAppSessionResult:
        if not isinstance(data, dict):
            data = {
                "success": False,
                "status_code": 500,
                "message": "Invalid gateway response",
                "session_status": "failed",
                "connected": False,
            }

        success = _safe_bool(data.get("success"), False)
        message = _extract_message(data, "")

        return WhatsAppSessionResult(
            success=success,
            status_code=_safe_int(
                data.get("status_code"),
                200 if success else 400,
            ),
            session_status=_safe_str(
                data.get("session_status") or data.get("status"),
                "connected" if _safe_bool(data.get("connected"), False) else "disconnected",
            ),
            connected=_safe_bool(data.get("connected"), False),
            connected_phone=_safe_str(
                data.get("connected_phone")
                or data.get("phone_number")
                or data.get("phone")
            ),
            device_label=_safe_str(
                data.get("device_label")
                or data.get("device_name")
                or data.get("browser")
            ),
            qr_code=_safe_str(
                data.get("qr_code")
                or data.get("qr")
                or data.get("qrDataUrl")
                or data.get("qr_data_url")
            ),
            pairing_code=_safe_str(
                data.get("pairing_code")
                or data.get("pairingCode")
                or data.get("code")
            ),
            last_connected_at=_safe_str(
                data.get("last_connected_at")
                or data.get("connected_at")
            ),
            response_data=data,
            error_message=message if not success else "",
        )

    def _build_send_error_result(
        self,
        *,
        status_code: int,
        provider_status: str,
        message: str,
        data: Optional[dict[str, Any]] = None,
    ) -> WhatsAppSendResult:
        return WhatsAppSendResult(
            success=False,
            status_code=status_code,
            provider_status=provider_status,
            error_message=message,
            response_data=data or {},
        )

    def _build_send_success_result(self, data: dict[str, Any]) -> WhatsAppSendResult:
        return WhatsAppSendResult(
            success=True,
            status_code=_safe_int(data.get("status_code"), 200),
            provider_status=_safe_str(
                data.get("provider_status")
                or data.get("status")
                or "accepted",
            ),
            external_message_id=_safe_str(
                data.get("external_message_id")
                or data.get("message_id")
                or data.get("id")
            ),
            response_data=data,
            error_message="",
        )

    # --------------------------------------------------------
    # 📲 Create QR Session
    # --------------------------------------------------------
    def create_qr_session(self) -> WhatsAppSessionResult:
        if not self._is_web_session_provider():
            return WhatsAppSessionResult(
                success=False,
                status_code=400,
                session_status="failed",
                error_message="QR session is only supported for whatsapp_web_session provider",
                response_data={},
            )

        data = self._gateway_post(
            "/session/create-qr/",
            {
                "session_name": self.session_name,
                "mode": "qr",
            },
        )

        return self._build_session_result(data)

    # --------------------------------------------------------
    # 🔢 Create Pairing Code Session
    # --------------------------------------------------------
    def create_pairing_code_session(self, *, phone_number: str) -> WhatsAppSessionResult:
        if not self._is_web_session_provider():
            return WhatsAppSessionResult(
                success=False,
                status_code=400,
                session_status="failed",
                error_message="Pairing code is only supported for whatsapp_web_session provider",
                response_data={},
            )

        clean_phone = _safe_str(phone_number)

        if not clean_phone:
            return WhatsAppSessionResult(
                success=False,
                status_code=400,
                session_status="failed",
                error_message="Missing phone_number",
                response_data={},
            )

        data = self._gateway_post(
            "/session/create-pairing-code/",
            {
                "session_name": self.session_name,
                "phone_number": clean_phone,
                "mode": "pairing_code",
            },
        )

        return self._build_session_result(data)

    # --------------------------------------------------------
    # 📡 Get Session Status
    # --------------------------------------------------------
    def get_session_status(self) -> WhatsAppSessionResult:
        if not self._is_web_session_provider():
            return WhatsAppSessionResult(
                success=True,
                status_code=200,
                session_status="disconnected",
                connected=False,
                response_data={
                    "success": True,
                    "session_status": "disconnected",
                    "connected": False,
                    "message": "Non-session provider",
                },
            )

        data = self._gateway_post(
            "/session/status/",
            {
                "session_name": self.session_name,
            },
        )

        return self._build_session_result(data)

    # --------------------------------------------------------
    # 🔌 Disconnect Session
    # --------------------------------------------------------
    def disconnect_session(self) -> WhatsAppSessionResult:
        if not self._is_web_session_provider():
            return WhatsAppSessionResult(
                success=False,
                status_code=400,
                session_status="failed",
                error_message="Disconnect is only supported for whatsapp_web_session provider",
                response_data={},
            )

        data = self._gateway_post(
            "/session/disconnect/",
            {
                "session_name": self.session_name,
            },
        )

        return self._build_session_result(data)

    # --------------------------------------------------------
    # 💬 Send Text Message
    # --------------------------------------------------------
    def send_text_message(self, *, to_phone: str, body: str) -> WhatsAppSendResult:
        clean_phone = _safe_str(to_phone)
        clean_body = _safe_str(body)

        if not clean_phone or not clean_body:
            return self._build_send_error_result(
                status_code=400,
                provider_status="validation_failed",
                message="Missing to_phone or body",
                data={},
            )

        # ----------------------------------------------------
        # WhatsApp Web Session Gateway
        # ----------------------------------------------------
        if self._is_web_session_provider():
            data = self._gateway_post(
                "/messages/send-text/",
                {
                    "session_name": self.session_name,
                    "to_phone": clean_phone,
                    "body": clean_body,
                },
            )

            if not data.get("success"):
                return self._build_send_error_result(
                    status_code=_safe_int(data.get("status_code"), 400),
                    provider_status=_safe_str(
                        data.get("provider_status"),
                        "gateway_failed",
                    ),
                    message=_extract_message(data, "Session gateway failed"),
                    data=data,
                )

            return self._build_send_success_result(data)

        # ----------------------------------------------------
        # Placeholder للمزودات الأخرى
        # ----------------------------------------------------
        return WhatsAppSendResult(
            success=True,
            status_code=200,
            provider_status="accepted_stub",
            external_message_id="stub-message-id",
            response_data={
                "stub": True,
                "provider": self.provider,
                "to": clean_phone,
                "body": clean_body,
            },
        )

    # --------------------------------------------------------
    # 📄 Send Document Message
    # --------------------------------------------------------
    def send_document_message(
        self,
        *,
        to_phone: str,
        document_url: str,
        caption: str = "",
        filename: str = "",
    ) -> WhatsAppSendResult:
        clean_phone = _safe_str(to_phone)
        clean_document_url = _safe_str(document_url)
        clean_caption = _safe_str(caption)
        clean_filename = _safe_str(filename)

        if not clean_phone or not clean_document_url:
            return self._build_send_error_result(
                status_code=400,
                provider_status="validation_failed",
                message="Missing to_phone or document_url",
                data={},
            )

        # ----------------------------------------------------
        # WhatsApp Web Session Gateway
        # ----------------------------------------------------
        if self._is_web_session_provider():
            data = self._gateway_post(
                "/messages/send-document/",
                {
                    "session_name": self.session_name,
                    "to_phone": clean_phone,
                    "document_url": clean_document_url,
                    "caption": clean_caption,
                    "filename": clean_filename,
                },
            )

            if not data.get("success"):
                return self._build_send_error_result(
                    status_code=_safe_int(data.get("status_code"), 400),
                    provider_status=_safe_str(
                        data.get("provider_status"),
                        "gateway_failed",
                    ),
                    message=_extract_message(data, "Session gateway failed"),
                    data=data,
                )

            return self._build_send_success_result(data)

        # ----------------------------------------------------
        # Placeholder للمزودات الأخرى
        # ----------------------------------------------------
        return WhatsAppSendResult(
            success=True,
            status_code=200,
            provider_status="accepted_stub",
            external_message_id="stub-document-id",
            response_data={
                "stub": True,
                "provider": self.provider,
                "to": clean_phone,
                "document_url": clean_document_url,
                "caption": clean_caption,
                "filename": clean_filename,
            },
        )