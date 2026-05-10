# ============================================================
# 📂 payment_gateways/tamara/client.py
# 🧠 Primey Care | Tamara API Client V2
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
# - Create Checkout Session
# - Get Order Details
# - Authorise Order
# - Capture Order
# - Refund Order
# - Cancel Order
# - Update Order Reference ID
# - Ping Order
# ============================================================

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, Optional
from urllib.parse import urlparse

import requests
from requests import Response, Session
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


logger = logging.getLogger(__name__)


# ============================================================
# Constants
# ============================================================

TAMARA_SANDBOX_BASE_URL = "https://api-sandbox.tamara.co"
TAMARA_PRODUCTION_BASE_URL = "https://api.tamara.co"

DEFAULT_TIMEOUT = 30
DEFAULT_USER_AGENT = "PrimeyCare-TamaraClient/2.0"


# ============================================================
# Exceptions
# ============================================================

class TamaraError(Exception):
    """Base exception for Tamara client."""


class TamaraConfigurationError(TamaraError):
    """Raised when the client configuration is invalid."""


class TamaraRequestError(TamaraError):
    """Raised when the request to Tamara fails before a valid HTTP response is received."""


class TamaraAPIError(TamaraError):
    """Raised when Tamara returns an error response."""

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
class TamaraConfig:
    """
    إعدادات عميل Tamara.

    environment:
        - sandbox
        - production
    """

    api_token: str
    environment: str = "sandbox"
    timeout: int = DEFAULT_TIMEOUT
    base_url: Optional[str] = None
    notification_token: Optional[str] = None
    public_key: Optional[str] = None
    merchant_callback_url: Optional[str] = None
    extra_headers: Dict[str, str] = field(default_factory=dict)
    verify_ssl: bool = True

    def resolved_base_url(self) -> str:
        """إرجاع Base URL الصحيح حسب البيئة أو القيمة المخصصة."""
        if self.base_url and str(self.base_url).strip():
            base_url = str(self.base_url).strip().rstrip("/")
        else:
            env = str(self.environment or "").strip().lower()

            if env == "sandbox":
                base_url = TAMARA_SANDBOX_BASE_URL
            elif env == "production":
                base_url = TAMARA_PRODUCTION_BASE_URL
            else:
                raise TamaraConfigurationError(
                    "Invalid Tamara environment. Use 'sandbox' or 'production'."
                )

        parsed_url = urlparse(base_url)

        if parsed_url.scheme != "https":
            raise TamaraConfigurationError("Tamara base_url must use HTTPS.")

        if not parsed_url.netloc:
            raise TamaraConfigurationError("Tamara base_url host is invalid.")

        return base_url.rstrip("/")

    def validate(self) -> None:
        """التحقق من صحة الإعدادات قبل بدء الاتصال."""
        if not self.api_token or not str(self.api_token).strip():
            raise TamaraConfigurationError("Tamara api_token is required.")

        if not isinstance(self.timeout, int) or self.timeout <= 0:
            raise TamaraConfigurationError("Tamara timeout must be a positive integer.")

        if self.extra_headers is not None and not isinstance(self.extra_headers, dict):
            raise TamaraConfigurationError("Tamara extra_headers must be a dictionary.")

        if not isinstance(self.verify_ssl, bool):
            raise TamaraConfigurationError("Tamara verify_ssl must be a boolean.")

        self.resolved_base_url()


# ============================================================
# Client
# ============================================================

class TamaraClient:
    """
    عميل HTTP للتعامل مع Tamara API.

    مسؤول فقط عن:
    - المصادقة
    - إرسال الطلبات
    - إعادة JSON
    - رفع الأخطاء بشكل واضح

    لا يحتوي على:
    - إنشاء Payment محلي
    - ترحيل محاسبي
    - ترحيل خزينة
    - تفعيل اشتراكات أو طلبات
    """

    def __init__(
        self,
        config: TamaraConfig,
        *,
        session: Optional[Session] = None,
    ) -> None:
        config.validate()
        self.config = config
        self.base_url = config.resolved_base_url()
        self.session = session or self._build_session()

    # --------------------------------------------------------
    # Session / Headers
    # --------------------------------------------------------

    def _build_session(self) -> Session:
        """
        بناء جلسة requests مع Retry آمن للطلبات المؤقتة الفاشلة.
        """
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

        # لا نستخدم http:// مع Tamara. وجود mount للـ https فقط مقصود.
        session.headers.update(self._default_headers())

        return session

    def _default_headers(self) -> Dict[str, str]:
        """
        الهيدرز الافتراضية لكل طلب.
        """
        headers: Dict[str, str] = {
            "Authorization": f"Bearer {str(self.config.api_token).strip()}",
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
        """
        تنفيذ طلب HTTP موحد إلى Tamara.
        """
        if not endpoint or not str(endpoint).strip():
            raise TamaraConfigurationError("Tamara endpoint is required.")

        method = str(method or "").strip().upper()

        if method not in {"GET", "POST", "PUT", "PATCH", "DELETE"}:
            raise TamaraConfigurationError(f"Unsupported Tamara HTTP method: {method}")

        url = f"{self.base_url}/{str(endpoint).lstrip('/')}"
        used_timeout = timeout or self.config.timeout

        logger.info("Tamara request started: %s %s", method, url)

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
            logger.exception("Tamara request timeout: %s %s", method, url)
            raise TamaraRequestError(
                f"Tamara request timed out after {used_timeout} seconds."
            ) from exc
        except requests.RequestException as exc:
            logger.exception("Tamara request failed: %s %s", method, url)
            raise TamaraRequestError(f"Tamara request failed: {exc}") from exc

        return self._handle_response(response)

    def _handle_response(self, response: Response) -> Dict[str, Any]:
        """
        معالجة Response وإرجاع JSON أو رفع خطأ واضح.
        """
        status_code = response.status_code
        data = self._safe_json(response)
        response_text = (response.text or "").strip()

        if 200 <= status_code < 300:
            logger.info("Tamara response success: %s", status_code)
            return data

        message = self._extract_error_message(data, response)

        logger.error(
            "Tamara API error. status=%s message=%s response=%s",
            status_code,
            message,
            data if data else response_text[:1000],
        )

        raise TamaraAPIError(
            message=message,
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
        """
        استخراج أفضل رسالة خطأ ممكنة من استجابة Tamara.
        """
        if isinstance(data, dict):
            possible_keys = (
                "message",
                "error_message",
                "error",
                "detail",
                "description",
                "errors",
            )

            for key in possible_keys:
                value = data.get(key)

                if isinstance(value, str) and value.strip():
                    return value.strip()

                if isinstance(value, list) and value:
                    try:
                        return json.dumps(value, ensure_ascii=False)
                    except Exception:
                        return str(value)

                if isinstance(value, dict) and value:
                    nested_message = (
                        value.get("message")
                        or value.get("description")
                        or value.get("error")
                        or value.get("detail")
                    )

                    if nested_message:
                        return str(nested_message).strip()

                    try:
                        return json.dumps(value, ensure_ascii=False)
                    except Exception:
                        return str(value)

        text = (response.text or "").strip()

        if text:
            return text[:1000]

        return f"Tamara API returned HTTP {response.status_code}"

    # --------------------------------------------------------
    # Validation Helpers
    # --------------------------------------------------------

    @staticmethod
    def _require_value(value: Optional[str], field_name: str) -> str:
        cleaned = str(value or "").strip()

        if not cleaned:
            raise TamaraConfigurationError(f"{field_name} is required.")

        return cleaned

    @staticmethod
    def _require_dict(value: Optional[Dict[str, Any]], field_name: str) -> Dict[str, Any]:
        if not isinstance(value, dict) or not value:
            raise TamaraConfigurationError(f"{field_name} must be a non-empty dict.")

        return value

    @staticmethod
    def _require_payload(payload: Dict[str, Any], action: str) -> None:
        if not isinstance(payload, dict) or not payload:
            raise TamaraConfigurationError(f"Tamara {action} payload must be a non-empty dict.")

    # --------------------------------------------------------
    # Checkout
    # --------------------------------------------------------

    def create_checkout_session(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        إنشاء Checkout Session.

        متوقع من Tamara أن يعيد:
        - order_id
        - checkout_id
        - checkout_url
        - status

        ملاحظة:
        هذه الدالة لا تنشئ Payment محلي ولا تؤكد الدفع.
        التأكيد يتم لاحقًا من webhook/status في services.
        """
        self._require_payload(payload, "create_checkout_session")
        return self._request("POST", "/checkout", payload=payload)

    # --------------------------------------------------------
    # Orders
    # --------------------------------------------------------

    def get_order(self, order_id: str) -> Dict[str, Any]:
        """
        جلب تفاصيل الطلب من Tamara.
        """
        order_id = self._require_value(order_id, "order_id")
        return self._request("GET", f"/orders/{order_id}")

    def authorise_order(self, order_id: str) -> Dict[str, Any]:
        """
        تنفيذ Authorise للطلب بعد approved webhook.

        ملاحظة:
        لا تعكس هذه العملية محليًا داخل payments/accounting/treasury.
        أي انعكاس مالي يجب أن يتم في طبقة services.
        """
        order_id = self._require_value(order_id, "order_id")
        return self._request("POST", f"/orders/{order_id}/authorise")

    def update_order_reference_id(
        self,
        order_id: str,
        order_reference_id: str,
    ) -> Dict[str, Any]:
        """
        تحديث order_reference_id على Tamara.
        """
        order_id = self._require_value(order_id, "order_id")
        order_reference_id = self._require_value(
            order_reference_id,
            "order_reference_id",
        )

        payload = {
            "order_reference_id": order_reference_id,
        }

        return self._request("PUT", f"/orders/{order_id}/reference-id", payload=payload)

    def cancel_order(
        self,
        order_id: str,
        *,
        total_amount: Optional[Dict[str, Any]] = None,
        reason: Optional[str] = None,
        items: Optional[list[Dict[str, Any]]] = None,
        shipping_amount: Optional[Dict[str, Any]] = None,
        tax_amount: Optional[Dict[str, Any]] = None,
        discount_amount: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        إلغاء الطلب عند الحاجة.

        ملاحظة:
        لا تعكس هذه العملية محليًا داخل payments/accounting/treasury.
        أي انعكاس مالي يجب أن يتم في طبقة services.
        """
        order_id = self._require_value(order_id, "order_id")

        payload: Dict[str, Any] = {}

        if total_amount is not None:
            self._require_dict(total_amount, "total_amount")
            payload["total_amount"] = total_amount

        if reason:
            payload["reason"] = str(reason).strip()

        if items is not None:
            payload["items"] = items

        if shipping_amount is not None:
            payload["shipping_amount"] = shipping_amount

        if tax_amount is not None:
            payload["tax_amount"] = tax_amount

        if discount_amount is not None:
            payload["discount_amount"] = discount_amount

        return self._request("POST", f"/orders/{order_id}/cancel", payload=payload or {})

    # --------------------------------------------------------
    # Payments
    # --------------------------------------------------------

    def capture_order(
        self,
        *,
        order_id: str,
        total_amount: Dict[str, Any],
        description: Optional[str] = None,
        items: Optional[list[Dict[str, Any]]] = None,
        shipping_info: Optional[Dict[str, Any]] = None,
        discount_amount: Optional[Dict[str, Any]] = None,
        tax_amount: Optional[Dict[str, Any]] = None,
        shipping_amount: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        تنفيذ Capture كامل أو جزئي.

        المتغيرات المهمة:
        - order_id
        - total_amount: {"amount": "100.00", "currency": "SAR"}

        ملاحظة:
        لا تعكس هذه العملية محليًا داخل payments/accounting/treasury.
        أي انعكاس مالي يجب أن يتم في طبقة services.
        """
        order_id = self._require_value(order_id, "order_id")
        total_amount = self._require_dict(total_amount, "total_amount")

        payload: Dict[str, Any] = {
            "order_id": order_id,
            "total_amount": total_amount,
        }

        if description:
            payload["description"] = str(description).strip()

        if items is not None:
            payload["items"] = items

        if shipping_info is not None:
            payload["shipping_info"] = shipping_info

        if discount_amount is not None:
            payload["discount_amount"] = discount_amount

        if tax_amount is not None:
            payload["tax_amount"] = tax_amount

        if shipping_amount is not None:
            payload["shipping_amount"] = shipping_amount

        return self._request("POST", "/payments/capture", payload=payload)

    def refund_order(
        self,
        *,
        order_id: str,
        total_amount: Dict[str, Any],
        comment: Optional[str] = None,
        items: Optional[list[Dict[str, Any]]] = None,
        shipping_amount: Optional[Dict[str, Any]] = None,
        tax_amount: Optional[Dict[str, Any]] = None,
        discount_amount: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        تنفيذ Refund كامل أو جزئي.

        ملاحظة:
        لا تعكس هذه العملية محليًا داخل payments/accounting/treasury.
        أي انعكاس مالي يجب أن يتم في طبقة services.
        """
        order_id = self._require_value(order_id, "order_id")
        total_amount = self._require_dict(total_amount, "total_amount")

        payload: Dict[str, Any] = {
            "order_id": order_id,
            "total_amount": total_amount,
        }

        if comment:
            payload["comment"] = str(comment).strip()

        if items is not None:
            payload["items"] = items

        if shipping_amount is not None:
            payload["shipping_amount"] = shipping_amount

        if tax_amount is not None:
            payload["tax_amount"] = tax_amount

        if discount_amount is not None:
            payload["discount_amount"] = discount_amount

        return self._request("POST", "/payments/refund", payload=payload)

    # --------------------------------------------------------
    # Health / Utility
    # --------------------------------------------------------

    def ping_order(self, order_id: str) -> bool:
        """
        فحص بسيط لمعرفة إن كان الوصول للطلب يعمل.
        """
        try:
            self.get_order(order_id)
            return True
        except TamaraError:
            return False