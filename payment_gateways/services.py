# ============================================================
# 📂 payment_gateways/services.py
# 🧠 Primey Care - Payment Gateways Services
# ------------------------------------------------------------
# ✅ طبقة خدمات موحدة لبوابات الدفع
# ✅ تبني Clients من الإعدادات المخزنة محليًا
# ✅ تنشئ checkout / charge
# ✅ تحفظ PaymentGatewayTransaction محليًا
# ✅ تحفظ Webhook Logs
# ✅ جاهزة للربط لاحقًا مع invoices / orders / payments
# ------------------------------------------------------------
# ملاحظات:
# - هذه الطبقة عامة ولا تفترض موديل Invoice محدد
# - الربط يتم عبر:
#   local_reference_type / local_reference_id / local_reference
# - الـ APIs القادمة ستعتمد عليها مباشرة
# ============================================================

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from decimal import Decimal, InvalidOperation
from typing import Any

from django.db import transaction
from django.utils import timezone

from payment_gateways.models import (
    PaymentGatewayConfig,
    PaymentGatewayProvider,
    PaymentGatewayTransaction,
    PaymentGatewayTransactionStatus,
    PaymentGatewayWebhookLog,
    PaymentGatewayWebhookStatus,
)
from payment_gateways.tamara.client import (
    TamaraAPIError,
    TamaraClient,
    TamaraConfig,
    TamaraConfigurationError,
    TamaraRequestError,
)
from payment_gateways.tap.client import (
    TapAPIError,
    TapClient,
    TapConfig,
    TapConfigurationError,
    TapRequestError,
)

logger = logging.getLogger(__name__)


# ============================================================
# ❌ Exceptions
# ============================================================

class PaymentGatewayServiceError(Exception):
    """Base service exception."""


class PaymentGatewayNotConfiguredError(PaymentGatewayServiceError):
    """Raised when no active config exists for the gateway."""


class PaymentGatewayValidationError(PaymentGatewayServiceError):
    """Raised when provided local payload is invalid."""


# ============================================================
# 🔧 Helpers
# ============================================================

def _clean_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def _decimal_amount(value: Any) -> Decimal:
    try:
        return Decimal(str(value or 0)).quantize(Decimal("0.01"))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0.00")


def _json_safe(value: Any) -> Any:
    """
    تحويل آمن للقيم قبل تخزينها داخل JSONField.
    """
    try:
        json.dumps(value)
        return value
    except Exception:
        if isinstance(value, Decimal):
            return str(value)
        if isinstance(value, dict):
            return {str(k): _json_safe(v) for k, v in value.items()}
        if isinstance(value, list):
            return [_json_safe(v) for v in value]
        return str(value)


def _normalize_provider(provider: str) -> str:
    return _clean_str(provider).upper()


def _normalize_phone(raw_phone: str) -> dict[str, str]:
    """
    Tap expects:
    {"country_code": "966", "number": "5xxxxxxxx"}
    """
    digits = "".join(ch for ch in _clean_str(raw_phone) if ch.isdigit())

    if digits.startswith("00966"):
        local = digits[5:]
    elif digits.startswith("966"):
        local = digits[3:]
    elif digits.startswith("0"):
        local = digits[1:]
    else:
        local = digits

    return {
        "country_code": "966",
        "number": local,
    }


def _split_name(full_name: str, fallback_first: str = "Customer") -> tuple[str, str]:
    name = _clean_str(full_name)
    if not name:
        return fallback_first, "Customer"

    parts = name.split()
    if len(parts) == 1:
        return parts[0], "Customer"

    return parts[0], " ".join(parts[1:])


# ============================================================
# ⚙️ Config / Client Builders
# ============================================================

def get_active_gateway_config(provider: str) -> PaymentGatewayConfig:
    provider = _normalize_provider(provider)

    config = (
        PaymentGatewayConfig.objects
        .filter(provider=provider, is_enabled=True)
        .order_by("-is_default", "-id")
        .first()
    )

    if not config:
        raise PaymentGatewayNotConfiguredError(
            f"No active payment gateway config found for provider: {provider}"
        )

    return config


def build_tamara_client(config: PaymentGatewayConfig | None = None) -> TamaraClient:
    config = config or get_active_gateway_config(PaymentGatewayProvider.TAMARA)

    client_config = TamaraConfig(
        api_token=_clean_str(config.api_token),
        environment=_clean_str(config.environment) or "sandbox",
        timeout=int(config.timeout_seconds or 30),
        base_url=_clean_str(config.base_url) or None,
        notification_token=_clean_str(config.notification_token) or None,
        public_key=_clean_str(config.public_key) or None,
        merchant_callback_url=_clean_str(config.merchant_callback_url) or None,
        extra_headers=_json_safe(config.extra_config.get("extra_headers", {})) if isinstance(config.extra_config, dict) else {},
    )
    return TamaraClient(client_config)


def build_tap_client(config: PaymentGatewayConfig | None = None) -> TapClient:
    config = config or get_active_gateway_config(PaymentGatewayProvider.TAP)

    client_config = TapConfig(
        secret_key=_clean_str(config.secret_key),
        public_key=_clean_str(config.public_key) or None,
        timeout=int(config.timeout_seconds or 30),
        base_url=_clean_str(config.base_url) or "https://api.tap.company/v2",
        extra_headers=_json_safe(config.extra_config.get("extra_headers", {})) if isinstance(config.extra_config, dict) else {},
    )
    return TapClient(client_config)


# ============================================================
# 🧾 Transaction Helpers
# ============================================================

def create_gateway_transaction(
    *,
    provider: str,
    amount: Any,
    currency: str = "SAR",
    payment_method: str = "",
    local_reference_type: str = "",
    local_reference_id: str = "",
    local_reference: str = "",
    customer_name: str = "",
    customer_email: str = "",
    customer_phone: str = "",
    request_payload: dict | None = None,
    response_payload: dict | None = None,
    payment_url: str = "",
    redirect_url: str = "",
    remote_transaction_id: str = "",
    remote_order_id: str = "",
    remote_checkout_id: str = "",
    gateway_reference: str = "",
    gateway_status: str = "",
    status: str = PaymentGatewayTransactionStatus.PENDING,
    notes: str = "",
    error_message: str = "",
) -> PaymentGatewayTransaction:
    return PaymentGatewayTransaction.objects.create(
        provider=_normalize_provider(provider),
        amount=_decimal_amount(amount),
        currency=_clean_str(currency, "SAR").upper(),
        payment_method=_clean_str(payment_method),
        local_reference_type=_clean_str(local_reference_type).upper(),
        local_reference_id=_clean_str(local_reference_id),
        local_reference=_clean_str(local_reference),
        customer_name=_clean_str(customer_name),
        customer_email=_clean_str(customer_email),
        customer_phone=_clean_str(customer_phone),
        request_payload=_json_safe(request_payload or {}),
        response_payload=_json_safe(response_payload or {}),
        payment_url=_clean_str(payment_url),
        redirect_url=_clean_str(redirect_url),
        remote_transaction_id=_clean_str(remote_transaction_id),
        remote_order_id=_clean_str(remote_order_id),
        remote_checkout_id=_clean_str(remote_checkout_id),
        gateway_reference=_clean_str(gateway_reference),
        gateway_status=_clean_str(gateway_status),
        status=status,
        notes=_clean_str(notes),
        error_message=_clean_str(error_message),
    )


def find_transaction_by_remote_reference(
    *,
    provider: str,
    remote_transaction_id: str = "",
    remote_order_id: str = "",
    remote_checkout_id: str = "",
    gateway_reference: str = "",
) -> PaymentGatewayTransaction | None:
    provider = _normalize_provider(provider)

    querysets = [
        ("remote_transaction_id", _clean_str(remote_transaction_id)),
        ("remote_order_id", _clean_str(remote_order_id)),
        ("remote_checkout_id", _clean_str(remote_checkout_id)),
        ("gateway_reference", _clean_str(gateway_reference)),
    ]

    for field_name, value in querysets:
        if not value:
            continue

        instance = (
            PaymentGatewayTransaction.objects
            .filter(provider=provider, **{field_name: value})
            .order_by("-id")
            .first()
        )
        if instance:
            return instance

    return None


def update_transaction_from_gateway_response(
    tx: PaymentGatewayTransaction,
    *,
    payment_url: str = "",
    redirect_url: str = "",
    remote_transaction_id: str = "",
    remote_order_id: str = "",
    remote_checkout_id: str = "",
    gateway_reference: str = "",
    gateway_status: str = "",
    response_payload: dict | None = None,
    status: str | None = None,
    notes: str = "",
    error_message: str = "",
) -> PaymentGatewayTransaction:
    tx.payment_url = _clean_str(payment_url) or tx.payment_url
    tx.redirect_url = _clean_str(redirect_url) or tx.redirect_url
    tx.remote_transaction_id = _clean_str(remote_transaction_id) or tx.remote_transaction_id
    tx.remote_order_id = _clean_str(remote_order_id) or tx.remote_order_id
    tx.remote_checkout_id = _clean_str(remote_checkout_id) or tx.remote_checkout_id
    tx.gateway_reference = _clean_str(gateway_reference) or tx.gateway_reference
    tx.gateway_status = _clean_str(gateway_status) or tx.gateway_status
    tx.response_payload = _json_safe(response_payload or tx.response_payload or {})
    tx.notes = _clean_str(notes) or tx.notes
    tx.error_message = _clean_str(error_message) or tx.error_message

    if status:
        tx.status = status

    tx.save(
        update_fields=[
            "payment_url",
            "redirect_url",
            "remote_transaction_id",
            "remote_order_id",
            "remote_checkout_id",
            "gateway_reference",
            "gateway_status",
            "response_payload",
            "notes",
            "error_message",
            "status",
            "updated_at",
        ]
    )
    return tx


# ============================================================
# 🧾 Webhook Logs
# ============================================================

def create_webhook_log(
    *,
    provider: str,
    event_type: str = "",
    status: str = PaymentGatewayWebhookStatus.RECEIVED,
    transaction_obj: PaymentGatewayTransaction | None = None,
    signature_valid: bool = False,
    remote_transaction_id: str = "",
    remote_order_id: str = "",
    remote_checkout_id: str = "",
    headers: dict | None = None,
    payload: dict | None = None,
    processing_result: dict | None = None,
    error_message: str = "",
    notes: str = "",
) -> PaymentGatewayWebhookLog:
    return PaymentGatewayWebhookLog.objects.create(
        provider=_normalize_provider(provider),
        event_type=_clean_str(event_type),
        status=status,
        transaction=transaction_obj,
        signature_valid=signature_valid,
        remote_transaction_id=_clean_str(remote_transaction_id),
        remote_order_id=_clean_str(remote_order_id),
        remote_checkout_id=_clean_str(remote_checkout_id),
        headers=_json_safe(headers or {}),
        payload=_json_safe(payload or {}),
        processing_result=_json_safe(processing_result or {}),
        error_message=_clean_str(error_message),
        notes=_clean_str(notes),
    )


# ============================================================
# 🌙 Tamara Services
# ============================================================

def build_tamara_checkout_payload(
    *,
    amount: Any,
    local_reference: str,
    customer_name: str,
    customer_email: str,
    customer_phone: str,
    item_name: str,
    description: str = "",
    success_url: str = "",
    cancel_url: str = "",
    failure_url: str = "",
    notification_url: str = "",
    currency: str = "SAR",
    country_code: str = "SA",
    city: str = "Jeddah",
) -> dict[str, Any]:
    amount_str = format(_decimal_amount(amount), "f")
    first_name, last_name = _split_name(customer_name, fallback_first="Customer")

    payload = {
        "order_reference_id": _clean_str(local_reference),
        "description": _clean_str(description) or _clean_str(item_name),
        "country_code": _clean_str(country_code, "SA").upper(),
        "currency": _clean_str(currency, "SAR").upper(),
        "total_amount": {
            "amount": amount_str,
            "currency": _clean_str(currency, "SAR").upper(),
        },
        "consumer": {
            "first_name": first_name,
            "last_name": last_name,
            "phone_number": _clean_str(customer_phone),
            "email": _clean_str(customer_email),
        },
        "items": [
            {
                "name": _clean_str(item_name),
                "type": "Digital",
                "reference_id": _clean_str(local_reference),
                "sku": _clean_str(local_reference),
                "quantity": 1,
                "unit_price": {
                    "amount": amount_str,
                    "currency": _clean_str(currency, "SAR").upper(),
                },
                "total_amount": {
                    "amount": amount_str,
                    "currency": _clean_str(currency, "SAR").upper(),
                },
            }
        ],
        "billing_address": {
            "first_name": first_name,
            "last_name": last_name,
            "line1": _clean_str(item_name),
            "city": _clean_str(city, "Jeddah"),
            "country_code": _clean_str(country_code, "SA").upper(),
            "phone_number": _clean_str(customer_phone),
        },
        "shipping_address": {
            "first_name": first_name,
            "last_name": last_name,
            "line1": _clean_str(item_name),
            "city": _clean_str(city, "Jeddah"),
            "country_code": _clean_str(country_code, "SA").upper(),
            "phone_number": _clean_str(customer_phone),
        },
        "merchant_url": {
            "success": _clean_str(success_url),
            "failure": _clean_str(failure_url) or _clean_str(cancel_url),
            "cancel": _clean_str(cancel_url),
            "notification": _clean_str(notification_url),
        },
    }

    return _json_safe(payload)


def create_tamara_checkout_transaction(
    *,
    amount: Any,
    local_reference_type: str,
    local_reference_id: str,
    local_reference: str,
    customer_name: str,
    customer_email: str,
    customer_phone: str,
    item_name: str,
    description: str = "",
    success_url: str = "",
    cancel_url: str = "",
    failure_url: str = "",
    notification_url: str = "",
    currency: str = "SAR",
    country_code: str = "SA",
    city: str = "Jeddah",
    payment_method: str = "TAMARA",
) -> PaymentGatewayTransaction:
    if not _clean_str(local_reference):
        raise PaymentGatewayValidationError("local_reference is required for Tamara checkout.")

    if not _clean_str(customer_email):
        raise PaymentGatewayValidationError("customer_email is required for Tamara checkout.")

    if not _clean_str(customer_phone):
        raise PaymentGatewayValidationError("customer_phone is required for Tamara checkout.")

    payload = build_tamara_checkout_payload(
        amount=amount,
        local_reference=local_reference,
        customer_name=customer_name,
        customer_email=customer_email,
        customer_phone=customer_phone,
        item_name=item_name,
        description=description,
        success_url=success_url,
        cancel_url=cancel_url,
        failure_url=failure_url,
        notification_url=notification_url,
        currency=currency,
        country_code=country_code,
        city=city,
    )

    config = get_active_gateway_config(PaymentGatewayProvider.TAMARA)
    client = build_tamara_client(config)

    tx = create_gateway_transaction(
        provider=PaymentGatewayProvider.TAMARA,
        amount=amount,
        currency=currency,
        payment_method=payment_method,
        local_reference_type=local_reference_type,
        local_reference_id=local_reference_id,
        local_reference=local_reference,
        customer_name=customer_name,
        customer_email=customer_email,
        customer_phone=customer_phone,
        request_payload=payload,
        status=PaymentGatewayTransactionStatus.INITIATED,
    )

    try:
        response = client.create_checkout_session(payload)

        checkout_url = _clean_str(
            response.get("checkout_url")
            or response.get("url")
        )
        remote_order_id = _clean_str(response.get("order_id"))
        remote_checkout_id = _clean_str(response.get("checkout_id"))
        gateway_status = _clean_str(response.get("status"), "CREATED")

        update_transaction_from_gateway_response(
            tx,
            payment_url=checkout_url,
            redirect_url=success_url,
            remote_order_id=remote_order_id,
            remote_checkout_id=remote_checkout_id,
            gateway_status=gateway_status,
            response_payload=response,
            status=PaymentGatewayTransactionStatus.REQUIRES_ACTION,
        )

        return tx

    except (TamaraConfigurationError, TamaraRequestError, TamaraAPIError) as exc:
        logger.exception("Tamara checkout creation failed. local_reference=%s", local_reference)
        tx.status = PaymentGatewayTransactionStatus.FAILED
        tx.error_message = str(exc)
        tx.save(update_fields=["status", "error_message", "updated_at"])
        raise PaymentGatewayServiceError(str(exc)) from exc


# ============================================================
# 💠 Tap Services
# ============================================================

def build_tap_charge_payload(
    *,
    amount: Any,
    local_reference: str,
    customer_name: str,
    customer_email: str,
    customer_phone: str,
    description: str,
    success_url: str,
    webhook_url: str,
    currency: str = "SAR",
    source_id: str = "src_all",
    merchant_id: str = "",
    metadata: dict | None = None,
) -> dict[str, Any]:
    first_name, last_name = _split_name(customer_name, fallback_first="Customer")

    payload = {
        "amount": float(_decimal_amount(amount)),
        "currency": _clean_str(currency, "SAR").upper(),
        "threeDSecure": True,
        "save_card": False,
        "description": _clean_str(description),
        "statement_descriptor": "PrimeyCare",
        "metadata": _json_safe(metadata or {}),
        "reference": {
            "transaction": _clean_str(local_reference),
            "order": _clean_str(local_reference),
        },
        "receipt": {
            "email": False,
            "sms": False,
        },
        "customer": {
            "first_name": first_name,
            "last_name": last_name,
            "email": _clean_str(customer_email),
            "phone": _normalize_phone(customer_phone),
        },
        "source": {
            "id": _clean_str(source_id, "src_all"),
        },
        "redirect": {
            "url": _clean_str(success_url),
        },
        "post": {
            "url": _clean_str(webhook_url),
        },
    }

    if _clean_str(merchant_id):
        payload["merchant"] = {"id": _clean_str(merchant_id)}

    return _json_safe(payload)


def create_tap_checkout_transaction(
    *,
    amount: Any,
    local_reference_type: str,
    local_reference_id: str,
    local_reference: str,
    customer_name: str,
    customer_email: str,
    customer_phone: str,
    description: str,
    success_url: str,
    webhook_url: str,
    currency: str = "SAR",
    payment_method: str = "CREDIT_CARD",
) -> PaymentGatewayTransaction:
    if not _clean_str(local_reference):
        raise PaymentGatewayValidationError("local_reference is required for Tap checkout.")

    if not _clean_str(customer_email):
        raise PaymentGatewayValidationError("customer_email is required for Tap checkout.")

    if not _clean_str(customer_phone):
        raise PaymentGatewayValidationError("customer_phone is required for Tap checkout.")

    config = get_active_gateway_config(PaymentGatewayProvider.TAP)
    client = build_tap_client(config)

    payload = build_tap_charge_payload(
        amount=amount,
        local_reference=local_reference,
        customer_name=customer_name,
        customer_email=customer_email,
        customer_phone=customer_phone,
        description=description,
        success_url=success_url,
        webhook_url=webhook_url,
        currency=currency,
        source_id=config.source_id or "src_all",
        merchant_id=config.merchant_id,
        metadata={
            "local_reference_type": _clean_str(local_reference_type).upper(),
            "local_reference_id": _clean_str(local_reference_id),
            "local_reference": _clean_str(local_reference),
            "module": "primey_care",
        },
    )

    tx = create_gateway_transaction(
        provider=PaymentGatewayProvider.TAP,
        amount=amount,
        currency=currency,
        payment_method=payment_method,
        local_reference_type=local_reference_type,
        local_reference_id=local_reference_id,
        local_reference=local_reference,
        customer_name=customer_name,
        customer_email=customer_email,
        customer_phone=customer_phone,
        request_payload=payload,
        redirect_url=success_url,
        status=PaymentGatewayTransactionStatus.INITIATED,
    )

    try:
        response = client.create_charge(payload)

        checkout_url = _clean_str(
            (response.get("transaction") or {}).get("url")
            or (response.get("redirect") or {}).get("url")
            or response.get("url")
        )
        remote_transaction_id = _clean_str(response.get("id"))
        gateway_status = _clean_str(response.get("status"), "INITIATED")

        update_transaction_from_gateway_response(
            tx,
            payment_url=checkout_url,
            remote_transaction_id=remote_transaction_id,
            gateway_status=gateway_status,
            response_payload=response,
            status=PaymentGatewayTransactionStatus.REQUIRES_ACTION,
        )

        return tx

    except (TapConfigurationError, TapRequestError, TapAPIError) as exc:
        logger.exception("Tap checkout creation failed. local_reference=%s", local_reference)
        tx.status = PaymentGatewayTransactionStatus.FAILED
        tx.error_message = str(exc)
        tx.save(update_fields=["status", "error_message", "updated_at"])
        raise PaymentGatewayServiceError(str(exc)) from exc


# ============================================================
# 🔎 Fetch / Resolve Remote State
# ============================================================

def refresh_tap_transaction_status(tx: PaymentGatewayTransaction) -> PaymentGatewayTransaction:
    if tx.provider != PaymentGatewayProvider.TAP:
        raise PaymentGatewayValidationError("refresh_tap_transaction_status expects a TAP transaction.")

    if not _clean_str(tx.remote_transaction_id):
        raise PaymentGatewayValidationError("TAP transaction missing remote_transaction_id.")

    client = build_tap_client()
    response = client.retrieve_charge(tx.remote_transaction_id)
    gateway_status = _clean_str(response.get("status")).upper()

    mapped_status = PaymentGatewayTransactionStatus.PROCESSING
    if gateway_status in {"CAPTURED", "AUTHORIZED", "APPROVED"}:
        mapped_status = PaymentGatewayTransactionStatus.SUCCESS
    elif gateway_status in {"FAILED", "DECLINED", "ABANDONED", "VOID", "CANCELLED"}:
        mapped_status = PaymentGatewayTransactionStatus.FAILED
    elif gateway_status in {"INITIATED", "PENDING"}:
        mapped_status = PaymentGatewayTransactionStatus.PROCESSING

    update_transaction_from_gateway_response(
        tx,
        gateway_status=gateway_status,
        response_payload=response,
        status=mapped_status,
    )

    if mapped_status == PaymentGatewayTransactionStatus.SUCCESS and not tx.paid_at:
        tx.paid_at = timezone.now()
        tx.save(update_fields=["paid_at", "updated_at"])

    return tx


# ============================================================
# 🪝 Webhook Verification / Handling
# ============================================================

def verify_tamara_webhook_token(
    *,
    config: PaymentGatewayConfig,
    incoming_token: str,
    request_body: bytes,
) -> bool:
    configured = _clean_str(config.notification_token)
    incoming = _clean_str(incoming_token)

    if not config.verify_webhook:
        return True

    if not configured or not incoming:
        return False

    if hmac.compare_digest(incoming.encode("utf-8"), configured.encode("utf-8")):
        return True

    expected_hmac = hmac.new(
        configured.encode("utf-8"),
        request_body or b"",
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(incoming.encode("utf-8"), expected_hmac.encode("utf-8"))


def verify_tap_hashstring(
    *,
    config: PaymentGatewayConfig,
    header_hash: str,
    payload: dict[str, Any],
) -> bool:
    if not config.verify_webhook:
        return True

    secret_key = _clean_str(config.secret_key)
    header_hash = _clean_str(header_hash)

    if not secret_key or not header_hash:
        return False

    charge_id = _clean_str(payload.get("id"))
    amount = f"{_decimal_amount(payload.get('amount')):.2f}"
    currency = _clean_str(payload.get("currency")).upper()

    reference = payload.get("reference") if isinstance(payload.get("reference"), dict) else {}
    transaction_data = payload.get("transaction") if isinstance(payload.get("transaction"), dict) else {}

    gateway_reference = _clean_str(reference.get("gateway"))
    payment_reference = _clean_str(reference.get("payment"))
    status = _clean_str(payload.get("status")).upper()
    created = _clean_str(transaction_data.get("created"))

    to_be_hashed = (
        f"x_id{charge_id}"
        f"x_amount{amount}"
        f"x_currency{currency}"
        f"x_gateway_reference{gateway_reference}"
        f"x_payment_reference{payment_reference}"
        f"x_status{status}"
        f"x_created{created}"
    )

    expected_hash = hmac.new(
        secret_key.encode("utf-8"),
        to_be_hashed.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(header_hash.encode("utf-8"), expected_hash.encode("utf-8"))


def handle_tamara_webhook(
    *,
    payload: dict[str, Any],
    headers: dict[str, Any] | None = None,
    request_body: bytes = b"",
    incoming_token: str = "",
) -> dict[str, Any]:
    config = get_active_gateway_config(PaymentGatewayProvider.TAMARA)

    order_data = payload.get("order") if isinstance(payload.get("order"), dict) else {}
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}

    event_type = _clean_str(
        payload.get("event_type")
        or payload.get("event")
        or payload.get("notification_type")
        or payload.get("type")
        or "unknown"
    )
    order_id = _clean_str(
        payload.get("order_id")
        or order_data.get("order_id")
        or order_data.get("id")
        or data.get("order_id")
        or data.get("id")
    )
    checkout_id = _clean_str(
        payload.get("checkout_id")
        or order_data.get("checkout_id")
        or data.get("checkout_id")
    )
    order_reference_id = _clean_str(
        payload.get("order_reference_id")
        or order_data.get("order_reference_id")
        or order_data.get("reference_id")
        or data.get("order_reference_id")
        or data.get("reference_id")
    )
    gateway_status = _clean_str(
        payload.get("order_status")
        or payload.get("status")
        or order_data.get("status")
        or data.get("status")
    ).upper()

    signature_valid = verify_tamara_webhook_token(
        config=config,
        incoming_token=incoming_token,
        request_body=request_body,
    )

    tx = find_transaction_by_remote_reference(
        provider=PaymentGatewayProvider.TAMARA,
        remote_order_id=order_id,
        remote_checkout_id=checkout_id,
        gateway_reference=order_reference_id,
    )

    log = create_webhook_log(
        provider=PaymentGatewayProvider.TAMARA,
        event_type=event_type,
        status=PaymentGatewayWebhookStatus.VERIFIED if signature_valid else PaymentGatewayWebhookStatus.REJECTED,
        transaction_obj=tx,
        signature_valid=signature_valid,
        remote_order_id=order_id,
        remote_checkout_id=checkout_id,
        headers=headers or {},
        payload=payload,
    )

    if not signature_valid:
        result = {
            "success": False,
            "message": "Invalid Tamara webhook token.",
            "event_type": event_type,
            "order_id": order_id,
        }
        log.mark_failed("Invalid Tamara webhook token.", result)
        return result

    if tx:
        tx.latest_webhook_payload = _json_safe(payload)
        tx.last_webhook_at = timezone.now()
        tx.is_webhook_verified = True
        tx.gateway_status = gateway_status or tx.gateway_status

        if gateway_status in {"CAPTURED", "PAID", "SUCCESS", "FULLY_CAPTURED"}:
            tx.status = PaymentGatewayTransactionStatus.SUCCESS
            tx.paid_at = tx.paid_at or timezone.now()
        elif gateway_status in {"DECLINED", "FAILED", "CANCELLED", "CANCELED", "EXPIRED"}:
            tx.status = PaymentGatewayTransactionStatus.FAILED
        else:
            tx.status = PaymentGatewayTransactionStatus.PROCESSING

        tx.save(
            update_fields=[
                "latest_webhook_payload",
                "last_webhook_at",
                "is_webhook_verified",
                "gateway_status",
                "status",
                "paid_at",
                "updated_at",
            ]
        )

    result = {
        "success": True,
        "message": "Tamara webhook processed successfully.",
        "event_type": event_type,
        "gateway_status": gateway_status,
        "transaction_found": bool(tx),
        "transaction_id": tx.id if tx else None,
        "order_id": order_id,
        "checkout_id": checkout_id,
        "order_reference_id": order_reference_id,
    }
    log.mark_processed(result)
    return result


def handle_tap_webhook(
    *,
    payload: dict[str, Any],
    headers: dict[str, Any] | None = None,
    header_hash: str = "",
) -> dict[str, Any]:
    config = get_active_gateway_config(PaymentGatewayProvider.TAP)

    event_type = _clean_str(payload.get("object"), "charge")
    charge_id = _clean_str(payload.get("id"))
    gateway_status = _clean_str(payload.get("status")).upper()

    reference = payload.get("reference") if isinstance(payload.get("reference"), dict) else {}
    gateway_reference = _clean_str(reference.get("gateway"))
    payment_reference = _clean_str(reference.get("payment"))
    order_reference = _clean_str(reference.get("order"))

    signature_valid = verify_tap_hashstring(
        config=config,
        header_hash=header_hash,
        payload=payload,
    )

    tx = find_transaction_by_remote_reference(
        provider=PaymentGatewayProvider.TAP,
        remote_transaction_id=charge_id,
        gateway_reference=order_reference or payment_reference or gateway_reference,
    )

    log = create_webhook_log(
        provider=PaymentGatewayProvider.TAP,
        event_type=event_type,
        status=PaymentGatewayWebhookStatus.VERIFIED if signature_valid else PaymentGatewayWebhookStatus.REJECTED,
        transaction_obj=tx,
        signature_valid=signature_valid,
        remote_transaction_id=charge_id,
        headers=headers or {},
        payload=payload,
    )

    if not signature_valid:
        result = {
            "success": False,
            "message": "Invalid Tap webhook signature.",
            "charge_id": charge_id,
        }
        log.mark_failed("Invalid Tap webhook signature.", result)
        return result

    if tx:
        tx.latest_webhook_payload = _json_safe(payload)
        tx.last_webhook_at = timezone.now()
        tx.is_webhook_verified = True
        tx.gateway_status = gateway_status or tx.gateway_status
        tx.gateway_reference = order_reference or payment_reference or gateway_reference or tx.gateway_reference

        if gateway_status in {"CAPTURED", "AUTHORIZED", "APPROVED"}:
            tx.status = PaymentGatewayTransactionStatus.SUCCESS
            tx.paid_at = tx.paid_at or timezone.now()
        elif gateway_status in {"FAILED", "DECLINED", "CANCELLED", "ABANDONED", "VOID"}:
            tx.status = PaymentGatewayTransactionStatus.FAILED
        else:
            tx.status = PaymentGatewayTransactionStatus.PROCESSING

        tx.save(
            update_fields=[
                "latest_webhook_payload",
                "last_webhook_at",
                "is_webhook_verified",
                "gateway_status",
                "gateway_reference",
                "status",
                "paid_at",
                "updated_at",
            ]
        )

    result = {
        "success": True,
        "message": "Tap webhook processed successfully.",
        "event_type": event_type,
        "gateway_status": gateway_status,
        "transaction_found": bool(tx),
        "transaction_id": tx.id if tx else None,
        "charge_id": charge_id,
        "order_reference": order_reference,
        "payment_reference": payment_reference,
        "gateway_reference": gateway_reference,
    }
    log.mark_processed(result)
    return result