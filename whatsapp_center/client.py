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
# 💬 WhatsApp Client
# ============================================================
class WhatsAppClient:
    """
    عميل إرسال واتساب.

    يدعم:
    - Stub افتراضي للمزودات غير المربوطة بعد
    - WhatsApp Web Session Gateway
    """

    SESSION_PROVIDERS = {
        "whatsapp_web_session",
        "web_session",
        "WEB_SESSION",
    }

    def __init__(
        self,
        *,
        provider: str,
        access_token: str = "",
        phone_number_id: str = "",
        api_version: str = "v22.0",
        session_name: str = "",
    ):
        self.provider = (provider or "").strip()
        self.access_token = (access_token or "").strip()
        self.phone_number_id = (phone_number_id or "").strip()
        self.api_version = (api_version or "v22.0").strip()
        self.session_name = (session_name or "primey-care-system-session").strip()

    # --------------------------------------------------------
    # ⚙️ Gateway Config
    # --------------------------------------------------------
    @property
    def gateway_base_url(self) -> str:
        return (os.getenv("WHATSAPP_SESSION_GATEWAY_URL") or "").strip().rstrip("/")

    @property
    def gateway_token(self) -> str:
        return (os.getenv("WHATSAPP_SESSION_GATEWAY_TOKEN") or "").strip()

    @property
    def gateway_timeout(self) -> int:
        raw = (os.getenv("WHATSAPP_SESSION_GATEWAY_TIMEOUT") or "20").strip()
        try:
            timeout = int(raw)
            return timeout if timeout > 0 else 20
        except (TypeError, ValueError):
            return 20

    # --------------------------------------------------------
    # 🧠 Internal Helpers
    # --------------------------------------------------------
    def _normalized_provider(self) -> str:
        return (self.provider or "").strip().lower()

    def _is_web_session_provider(self) -> bool:
        return self.provider in self.SESSION_PROVIDERS or self._normalized_provider() in {
            "whatsapp_web_session",
            "web_session",
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
            logger.warning("WhatsApp gateway base URL is not configured")
            return {
                "success": False,
                "status_code": 500,
                "message": "WHATSAPP_SESSION_GATEWAY_URL is not configured",
            }

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

                return data

        except HTTPError as exc:
            try:
                raw = exc.read().decode("utf-8") or "{}"
                parsed = self._safe_json_loads(raw)
            except Exception:
                parsed = {}

            logger.exception("WhatsApp gateway HTTPError: %s", exc.code)
            return {
                "success": False,
                "status_code": exc.code,
                "message": parsed.get("message") or f"Gateway HTTPError {exc.code}",
                "details": parsed,
            }

        except URLError as exc:
            logger.exception("WhatsApp gateway URLError")
            return {
                "success": False,
                "status_code": 503,
                "message": f"Gateway connection failed: {exc.reason}",
            }

        except Exception as exc:
            logger.exception("Unexpected WhatsApp gateway error")
            return {
                "success": False,
                "status_code": 500,
                "message": f"Unexpected gateway error: {str(exc)}",
            }

    def _gateway_post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        return self._gateway_request(path=path, method="POST", payload=payload)

    # --------------------------------------------------------
    # 🧩 Result Builders
    # --------------------------------------------------------
    def _build_session_result(self, data: dict[str, Any]) -> WhatsAppSessionResult:
        return WhatsAppSessionResult(
            success=bool(data.get("success")),
            status_code=int(data.get("status_code", 200 if data.get("success") else 400)),
            session_status=str(data.get("session_status") or "disconnected"),
            connected=bool(data.get("connected", False)),
            connected_phone=str(data.get("connected_phone") or ""),
            device_label=str(data.get("device_label") or ""),
            qr_code=str(data.get("qr_code") or ""),
            pairing_code=str(data.get("pairing_code") or ""),
            last_connected_at=str(data.get("last_connected_at") or ""),
            response_data=data,
            error_message=str(data.get("message") or ""),
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
            status_code=int(data.get("status_code", 200)),
            provider_status=str(data.get("provider_status") or "accepted"),
            external_message_id=str(
                data.get("external_message_id", "") or data.get("message_id", "")
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

        clean_phone = (phone_number or "").strip()
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
        clean_phone = (to_phone or "").strip()
        clean_body = (body or "").strip()

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
                    status_code=int(data.get("status_code", 400)),
                    provider_status=str(data.get("provider_status") or "gateway_failed"),
                    message=str(data.get("message") or "Session gateway failed"),
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
        clean_phone = (to_phone or "").strip()
        clean_document_url = (document_url or "").strip()
        clean_caption = (caption or "").strip()
        clean_filename = (filename or "").strip()

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
                    status_code=int(data.get("status_code", 400)),
                    provider_status=str(data.get("provider_status") or "gateway_failed"),
                    message=str(data.get("message") or "Session gateway failed"),
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