# ============================================================
# 📂 payment_gateways/tap/client.py
# 🧠 Primey Care | Tap API Client V2
# ------------------------------------------------------------
# ✅ HTTP Client Layer only
# ✅ No billing logic here
# ✅ No subscription activation here
# ✅ No invoice/payment/accounting/treasury state machine here
# ✅ Secure HTTPS validation by default
# ✅ Retry policy for transient failures
# ✅ Clear request/API/configuration errors
# ------------------------------------------------------------
# Supported operations:
# - Create Charge
# - Retrieve Charge
# - Refund Charge
# - Void Charge
# - Ping Charge
# ============================================================

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, Optional
from urllib.parse import urlparse

import requests
from requests import Response, Session
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


logger = logging.getLogger(__name__)


TAP_BASE_URL = "https://api.tap.company/v2"
DEFAULT_TIMEOUT = 30
DEFAULT_USER_AGENT = "PrimeyCare-TapClient/2.0"


# ============================================================
# Exceptions
# ============================================================

class TapError(Exception):
    """Base exception for Tap client."""


class TapConfigurationError(TapError):
    """Raised when Tap client configuration is invalid."""


class TapRequestError(TapError):
    """Raised when HTTP request fails before valid response."""


class TapAPIError(TapError):
    """Raised when Tap returns non-2xx response."""

    def __init__(
        self,
        message: str,
        *,
        status_code: Optional[int] = None,
        response_data: Optional[Dict[str, Any]] = None,
        response_text: str = "",
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.response_data = response_data or {}
        self.response_text = response_text


# ============================================================
# Configuration
# ============================================================

@dataclass(slots=True)
class TapConfig:
    secret_key: str
    public_key: Optional[str] = None
    timeout: int = DEFAULT_TIMEOUT
    base_url: str = TAP_BASE_URL
    extra_headers: Dict[str, str] = field(default_factory=dict)
    verify_ssl: bool = True

    def validate(self) -> None:
        if not self.secret_key or not str(self.secret_key).strip():
            raise TapConfigurationError("Tap secret_key is required.")

        if not isinstance(self.timeout, int) or self.timeout <= 0:
            raise TapConfigurationError("Tap timeout must be a positive integer.")

        if not self.base_url or not str(self.base_url).strip():
            raise TapConfigurationError("Tap base_url is required.")

        parsed_url = urlparse(str(self.base_url).strip())

        if parsed_url.scheme != "https":
            raise TapConfigurationError("Tap base_url must use HTTPS.")

        if not parsed_url.netloc:
            raise TapConfigurationError("Tap base_url host is invalid.")

        if self.extra_headers is not None and not isinstance(self.extra_headers, dict):
            raise TapConfigurationError("Tap extra_headers must be a dictionary.")

        if not isinstance(self.verify_ssl, bool):
            raise TapConfigurationError("Tap verify_ssl must be a boolean.")


# ============================================================
# Client
# ============================================================

class TapClient:
    """
    عميل HTTP للتعامل مع Tap API.

    مسؤول فقط عن:
    - المصادقة
    - إرسال الطلبات
    - إرجاع JSON
    - رفع أخطاء واضحة

    لا يحتوي على:
    - منطق إنشاء Payment داخلي
    - ترحيل محاسبي
    - ترحيل خزينة
    - تفعيل اشتراكات أو طلبات
    """

    def __init__(
        self,
        config: TapConfig,
        *,
        session: Optional[Session] = None,
    ) -> None:
        config.validate()
        self.config = config
        self.base_url = str(config.base_url).strip().rstrip("/")
        self.session = session or self._build_session()

    # --------------------------------------------------------
    # Session / Headers
    # --------------------------------------------------------

    def _build_session(self) -> Session:
        session = requests.Session()

        retries = Retry(
            total=3,
            connect=3,
            read=3,
            backoff_factor=0.7,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=frozenset({"GET", "POST", "PUT", "PATCH", "DELETE"}),
            raise_on_status=False,
        )

        adapter = HTTPAdapter(max_retries=retries)

        session.mount("https://", adapter)

        # لا نستخدم http:// مع Tap. وجود mount للـ https فقط مقصود.
        session.headers.update(self._default_headers())

        return session

    def _default_headers(self) -> Dict[str, str]:
        headers: Dict[str, str] = {
            "Authorization": f"Bearer {str(self.config.secret_key).strip()}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": DEFAULT_USER_AGENT,
        }

        if self.config.extra_headers:
            for key, value in self.config.extra_headers.items():
                clean_key = str(key).strip()
                clean_value = str(value).strip()

                if clean_key and clean_value:
                    headers[clean_key] = clean_value

        return headers

    # --------------------------------------------------------
    # Core Request
    # --------------------------------------------------------

    def _request(
        self,
        method: str,
        endpoint: str,
        *,
        payload: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        timeout: Optional[int] = None,
    ) -> Dict[str, Any]:
        if not endpoint or not str(endpoint).strip():
            raise TapConfigurationError("Tap endpoint is required.")

        method = str(method or "").strip().upper()

        if method not in {"GET", "POST", "PUT", "PATCH", "DELETE"}:
            raise TapConfigurationError(f"Unsupported Tap HTTP method: {method}")

        url = f"{self.base_url}/{str(endpoint).lstrip('/')}"
        used_timeout = timeout or self.config.timeout

        logger.info("Tap request started: %s %s", method, url)

        try:
            response = self.session.request(
                method=method,
                url=url,
                json=payload,
                params=params,
                timeout=used_timeout,
                verify=self.config.verify_ssl,
            )
        except requests.Timeout as exc:
            logger.exception("Tap request timeout: %s %s", method, url)
            raise TapRequestError(
                f"Tap request timed out after {used_timeout} seconds."
            ) from exc
        except requests.RequestException as exc:
            logger.exception("Tap request failed: %s %s", method, url)
            raise TapRequestError(f"Tap request failed: {exc}") from exc

        return self._handle_response(response)

    def _handle_response(self, response: Response) -> Dict[str, Any]:
        status_code = response.status_code
        data = self._safe_json(response)
        response_text = (response.text or "").strip()

        if 200 <= status_code < 300:
            logger.info("Tap response success: %s", status_code)
            return data

        message = self._extract_error_message(data, response)

        logger.error(
            "Tap API error. status=%s message=%s response=%s",
            status_code,
            message,
            data if data else response_text[:1000],
        )

        raise TapAPIError(
            message,
            status_code=status_code,
            response_data=data,
            response_text=response_text[:2000],
        )

    @staticmethod
    def _safe_json(response: Response) -> Dict[str, Any]:
        try:
            parsed = response.json()
        except ValueError:
            return {}

        if isinstance(parsed, dict):
            return parsed

        return {"response": parsed}

    @staticmethod
    def _extract_error_message(data: Dict[str, Any], response: Response) -> str:
        if isinstance(data, dict):
            for key in ("message", "error", "description"):
                value = data.get(key)

                if isinstance(value, str) and value.strip():
                    return value.strip()

                if isinstance(value, dict):
                    nested_message = (
                        value.get("message")
                        or value.get("description")
                        or value.get("error")
                    )
                    if nested_message:
                        return str(nested_message).strip()

            errors = data.get("errors")

            if isinstance(errors, list) and errors:
                first_error = errors[0]

                if isinstance(first_error, dict):
                    return str(
                        first_error.get("message")
                        or first_error.get("description")
                        or first_error
                    )

                return str(first_error)

            if isinstance(errors, dict) and errors:
                return str(errors)

        text = (response.text or "").strip()

        if text:
            return text[:500]

        return f"Tap API returned HTTP {response.status_code}."

    # --------------------------------------------------------
    # Validation Helpers
    # --------------------------------------------------------

    @staticmethod
    def _require_payload(payload: Dict[str, Any], action: str) -> None:
        if not isinstance(payload, dict) or not payload:
            raise TapConfigurationError(f"Tap {action} payload must be a non-empty dict.")

    @staticmethod
    def _require_id(value: str, field_name: str) -> str:
        cleaned = str(value or "").strip()

        if not cleaned:
            raise TapConfigurationError(f"Tap {field_name} is required.")

        return cleaned

    # --------------------------------------------------------
    # Public API
    # --------------------------------------------------------

    def create_charge(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        إنشاء Charge في Tap.

        ملاحظة:
        هذه الدالة لا تنشئ Payment محلي ولا تؤكد الدفع.
        التأكيد يتم لاحقًا من webhook/status lookup في services.
        """
        self._require_payload(payload, "create_charge")
        return self._request("POST", "/charges", payload=payload)

    def retrieve_charge(self, charge_id: str) -> Dict[str, Any]:
        """
        جلب حالة Charge من Tap.
        """
        charge_id = self._require_id(charge_id, "charge_id")
        return self._request("GET", f"/charges/{charge_id}")

    def refund_charge(self, charge_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        تنفيذ Refund على Charge.

        ملاحظة:
        لا تعكس هذه العملية محليًا داخل payments/accounting/treasury.
        أي انعكاس مالي يجب أن يتم في طبقة services.
        """
        charge_id = self._require_id(charge_id, "charge_id")
        self._require_payload(payload, "refund_charge")
        return self._request("POST", f"/charges/{charge_id}/refund", payload=payload)

    def void_charge(self, charge_id: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        تنفيذ Void على Charge.

        ملاحظة:
        لا تعكس هذه العملية محليًا داخل payments/accounting/treasury.
        أي انعكاس مالي يجب أن يتم في طبقة services.
        """
        charge_id = self._require_id(charge_id, "charge_id")
        return self._request("POST", f"/charges/{charge_id}/void", payload=payload or {})

    def ping_charge(self, charge_id: str) -> bool:
        """
        اختبار سريع للتحقق أن Charge قابل للجلب من Tap.
        """
        try:
            self.retrieve_charge(charge_id)
            return True
        except TapError:
            return False