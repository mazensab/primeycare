# ============================================================
# 📂 payment_gateways/services.py
# 🧠 Primey Care - Payment Gateways Services V3
# ------------------------------------------------------------
# ✅ طبقة خدمات موحدة لبوابات الدفع
# ✅ تبني Clients من الإعدادات المخزنة محليًا
# ✅ تنشئ checkout / charge
# ✅ تحفظ PaymentGatewayTransaction محليًا
# ✅ تحفظ Webhook Logs
# ✅ تربط نجاح البوابة مع payments.services.confirm_payment
# ✅ تمرر الدفع إلى Accounting + Treasury عبر خدمات payments الرسمية
# ✅ تمنع التكرار قدر الإمكان
# ✅ لا تحتوي منطق محاسبي مباشر
# ------------------------------------------------------------
# المسار المالي المعتمد:
# Gateway Checkout
# → PaymentGatewayTransaction
# → Webhook / Status Lookup
# → Payment create/confirm
# → Accounting JournalEntry بعد commit
# → TreasuryTransaction بعد commit
# ============================================================

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any

from django.apps import apps
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


class PaymentGatewayConfirmationError(PaymentGatewayServiceError):
    """Raised when gateway success cannot be reflected to local payment."""


# ============================================================
# 🔧 Helpers
# ============================================================

def _clean_str(value: Any, default: str = "") -> str:
    if value is None:
        return default

    cleaned = str(value).strip()
    return cleaned if cleaned else default


def _decimal_amount(value: Any) -> Decimal:
    try:
        return Decimal(str(value or 0)).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0.00")


def _json_safe(value: Any) -> Any:
    """
    تحويل آمن للقيم قبل تخزينها داخل JSONField.
    """
    if isinstance(value, Decimal):
        return str(value)

    if isinstance(value, dict):
        return {str(key): _json_safe(val) for key, val in value.items()}

    if isinstance(value, list):
        return [_json_safe(item) for item in value]

    if isinstance(value, tuple):
        return [_json_safe(item) for item in value]

    try:
        json.dumps(value)
        return value
    except Exception:
        return str(value)


def _normalize_provider(provider: str) -> str:
    return _clean_str(provider).upper()


def _normalize_status(value: Any, default: str = PaymentGatewayTransactionStatus.PENDING) -> str:
    status = _clean_str(value, default).upper()

    aliases = {
        "PAID": PaymentGatewayTransactionStatus.SUCCESS,
        "CAPTURED": PaymentGatewayTransactionStatus.SUCCESS,
        "AUTHORIZED": PaymentGatewayTransactionStatus.SUCCESS,
        "APPROVED": PaymentGatewayTransactionStatus.SUCCESS,
        "FULLY_CAPTURED": PaymentGatewayTransactionStatus.SUCCESS,
        "SUCCESSFUL": PaymentGatewayTransactionStatus.SUCCESS,
        "SUCCEEDED": PaymentGatewayTransactionStatus.SUCCESS,

        "DECLINED": PaymentGatewayTransactionStatus.FAILED,
        "ERROR": PaymentGatewayTransactionStatus.FAILED,
        "ABANDONED": PaymentGatewayTransactionStatus.FAILED,
        "VOID": PaymentGatewayTransactionStatus.FAILED,

        "CANCELED": PaymentGatewayTransactionStatus.CANCELLED,

        "INIT": PaymentGatewayTransactionStatus.INITIATED,
        "CREATED": PaymentGatewayTransactionStatus.INITIATED,
        "PENDING_PAYMENT": PaymentGatewayTransactionStatus.PROCESSING,
        "IN_PROGRESS": PaymentGatewayTransactionStatus.PROCESSING,
    }

    status = aliases.get(status, status)

    if status not in PaymentGatewayTransactionStatus.values:
        return default

    return status


def _normalize_reference_type(value: Any) -> str:
    normalized = _clean_str(value).upper()

    aliases = {
        "INV": "INVOICE",
        "INVOICE": "INVOICE",
        "BILL": "INVOICE",
        "ORDER": "ORDER",
        "ORD": "ORDER",
        "PAYMENT": "PAYMENT",
        "PAY": "PAYMENT",
        "MANUAL": "MANUAL",
    }

    return aliases.get(normalized, normalized)


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


def _safe_getattr(obj: Any, attr_name: str, default: Any = None) -> Any:
    try:
        return getattr(obj, attr_name, default)
    except Exception:
        return default


def _first_non_empty(*values: Any) -> Any:
    for value in values:
        if value not in (None, "", [], {}, ()):
            return value
    return None


def _model_or_none(app_label: str, model_name: str):
    try:
        return apps.get_model(app_label, model_name)
    except LookupError:
        return None


def _object_or_none(model, pk: Any):
    if not model or pk in (None, "", 0, "0"):
        return None

    try:
        return model.objects.filter(pk=pk).first()
    except Exception:
        return None


def _append_note(existing: str, new_note: str) -> str:
    existing = _clean_str(existing)
    new_note = _clean_str(new_note)

    if not new_note:
        return existing

    if not existing:
        return new_note

    if new_note in existing:
        return existing

    return f"{existing}\n{new_note}".strip()


def _safe_json_dump(value: Any) -> str:
    try:
        return json.dumps(_json_safe(value), ensure_ascii=False)
    except Exception:
        return str(value)


def _field_names(model) -> set[str]:
    if not model:
        return set()

    try:
        return {field.name for field in model._meta.fields}
    except Exception:
        return set()


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

    extra_config = config.extra_config if isinstance(config.extra_config, dict) else {}
    extra_headers = extra_config.get("extra_headers", {})

    if not isinstance(extra_headers, dict):
        extra_headers = {}

    client_config = TamaraConfig(
        api_token=_clean_str(config.api_token),
        environment=_clean_str(config.environment) or "sandbox",
        timeout=int(config.timeout_seconds or 30),
        base_url=_clean_str(config.base_url) or None,
        notification_token=_clean_str(config.notification_token) or None,
        public_key=_clean_str(config.public_key) or None,
        merchant_callback_url=_clean_str(config.merchant_callback_url) or None,
        extra_headers=_json_safe(extra_headers),
    )
    return TamaraClient(client_config)


def build_tap_client(config: PaymentGatewayConfig | None = None) -> TapClient:
    config = config or get_active_gateway_config(PaymentGatewayProvider.TAP)

    extra_config = config.extra_config if isinstance(config.extra_config, dict) else {}
    extra_headers = extra_config.get("extra_headers", {})

    if not isinstance(extra_headers, dict):
        extra_headers = {}

    client_config = TapConfig(
        secret_key=_clean_str(config.secret_key),
        public_key=_clean_str(config.public_key) or None,
        timeout=int(config.timeout_seconds or 30),
        base_url=_clean_str(config.base_url) or "https://api.tap.company/v2",
        extra_headers=_json_safe(extra_headers),
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
    amount_value = _decimal_amount(amount)

    if amount_value <= Decimal("0.00"):
        raise PaymentGatewayValidationError("Gateway transaction amount must be greater than zero.")

    return PaymentGatewayTransaction.objects.create(
        provider=_normalize_provider(provider),
        amount=amount_value,
        currency=_clean_str(currency, "SAR").upper(),
        payment_method=_clean_str(payment_method).upper(),
        local_reference_type=_normalize_reference_type(local_reference_type),
        local_reference_id=_clean_str(local_reference_id),
        local_reference=_clean_str(local_reference),
        customer_name=_clean_str(customer_name),
        customer_email=_clean_str(customer_email).lower(),
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
        status=_normalize_status(status),
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


def find_transaction_by_local_reference(
    *,
    provider: str,
    local_reference: str = "",
    local_reference_type: str = "",
    local_reference_id: str = "",
) -> PaymentGatewayTransaction | None:
    provider = _normalize_provider(provider)
    queryset = PaymentGatewayTransaction.objects.filter(provider=provider)

    local_reference = _clean_str(local_reference)
    local_reference_type = _normalize_reference_type(local_reference_type)
    local_reference_id = _clean_str(local_reference_id)

    if local_reference:
        found = queryset.filter(local_reference=local_reference).order_by("-id").first()
        if found:
            return found

        found = queryset.filter(gateway_reference=local_reference).order_by("-id").first()
        if found:
            return found

    if local_reference_type and local_reference_id:
        found = (
            queryset
            .filter(
                local_reference_type=local_reference_type,
                local_reference_id=local_reference_id,
            )
            .order_by("-id")
            .first()
        )
        if found:
            return found

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
    if not tx:
        raise PaymentGatewayValidationError("PaymentGatewayTransaction is required.")

    tx.payment_url = _clean_str(payment_url) or tx.payment_url
    tx.redirect_url = _clean_str(redirect_url) or tx.redirect_url
    tx.remote_transaction_id = _clean_str(remote_transaction_id) or tx.remote_transaction_id
    tx.remote_order_id = _clean_str(remote_order_id) or tx.remote_order_id
    tx.remote_checkout_id = _clean_str(remote_checkout_id) or tx.remote_checkout_id
    tx.gateway_reference = _clean_str(gateway_reference) or tx.gateway_reference
    tx.gateway_status = _clean_str(gateway_status) or tx.gateway_status
    tx.response_payload = _json_safe(response_payload or tx.response_payload or {})
    tx.notes = _append_note(tx.notes, notes)
    tx.error_message = _clean_str(error_message) or tx.error_message

    if status:
        tx.status = _normalize_status(status)

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
        status=_clean_str(status, PaymentGatewayWebhookStatus.RECEIVED).upper(),
        transaction=transaction_obj,
        signature_valid=bool(signature_valid),
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
# 🔗 Local Payment Binding
# ============================================================

def _resolve_payment_provider(provider: str) -> str:
    try:
        from payments.models import PaymentProvider
    except Exception:
        return _normalize_provider(provider)

    normalized = _normalize_provider(provider)

    if normalized == PaymentGatewayProvider.TAP:
        return getattr(PaymentProvider, "TAP", normalized)

    if normalized == PaymentGatewayProvider.TAMARA:
        return getattr(PaymentProvider, "TAMARA", normalized)

    return normalized


def _resolve_payment_method(provider: str, fallback: str = "") -> str:
    try:
        from payments.models import PaymentMethod
    except Exception:
        return _clean_str(fallback) or _normalize_provider(provider)

    normalized_provider = _normalize_provider(provider)
    normalized_fallback = _clean_str(fallback).upper()

    if normalized_provider == PaymentGatewayProvider.TAMARA:
        return getattr(PaymentMethod, "TAMARA", normalized_fallback or "TAMARA")

    if normalized_provider == PaymentGatewayProvider.TAP:
        if normalized_fallback in {"MADA", "DEBIT_CARD"}:
            return getattr(PaymentMethod, "DEBIT_CARD", normalized_fallback)
        if normalized_fallback == "APPLE_PAY":
            return getattr(PaymentMethod, "APPLE_PAY", normalized_fallback)
        if normalized_fallback == "STC_PAY":
            return getattr(PaymentMethod, "STC_PAY", normalized_fallback)
        return getattr(PaymentMethod, "CREDIT_CARD", normalized_fallback or "CREDIT_CARD")

    return normalized_fallback or normalized_provider


def _resolve_local_objects_for_transaction(tx: PaymentGatewayTransaction) -> dict[str, Any]:
    reference_type = _normalize_reference_type(tx.local_reference_type)
    reference_id = _clean_str(tx.local_reference_id)

    Invoice = _model_or_none("invoices", "Invoice")
    Order = _model_or_none("orders", "Order")
    Payment = _model_or_none("payments", "Payment")

    invoice = None
    order = None
    payment = None
    customer = None

    if reference_type == "PAYMENT":
        payment = _object_or_none(Payment, reference_id)
        invoice = _safe_getattr(payment, "invoice", None)
        order = _safe_getattr(payment, "order", None)
        customer = _safe_getattr(payment, "customer", None)

    elif reference_type == "INVOICE":
        invoice = _object_or_none(Invoice, reference_id)
        order = _safe_getattr(invoice, "order", None)
        customer = _safe_getattr(invoice, "customer", None)

    elif reference_type == "ORDER":
        order = _object_or_none(Order, reference_id)
        customer = _safe_getattr(order, "customer", None)

        try:
            invoice = _safe_getattr(order, "invoice", None)
            if hasattr(invoice, "all"):
                invoice = invoice.all().first()
        except Exception:
            invoice = None

        if not invoice and Invoice:
            try:
                invoice = Invoice.objects.filter(order=order).order_by("-id").first()
            except Exception:
                invoice = None

    if not customer and invoice:
        customer = _safe_getattr(invoice, "customer", None)

    if not customer and order:
        customer = _safe_getattr(order, "customer", None)

    if not order and invoice:
        order = _safe_getattr(invoice, "order", None)

    if not invoice and payment:
        invoice = _safe_getattr(payment, "invoice", None)

    if not order and payment:
        order = _safe_getattr(payment, "order", None)

    if not customer and payment:
        customer = _safe_getattr(payment, "customer", None)

    return {
        "invoice": invoice,
        "order": order,
        "payment": payment,
        "customer": customer,
    }


def _payment_already_confirmed(payment: Any) -> bool:
    if not payment:
        return False

    status = _clean_str(_safe_getattr(payment, "status")).upper()

    if status in {"PAID", "CONFIRMED", "COMPLETED", "SUCCESS"}:
        return True

    if bool(_safe_getattr(payment, "is_accounting_posted", False)):
        return True

    if bool(_safe_getattr(payment, "is_treasury_posted", False)):
        return True

    return False


def _find_existing_payment_for_transaction(
    tx: PaymentGatewayTransaction,
    *,
    invoice: Any = None,
    order: Any = None,
) -> Any:
    Payment = _model_or_none("payments", "Payment")

    if not Payment:
        return None

    references = [
        _clean_str(tx.remote_transaction_id),
        _clean_str(tx.remote_order_id),
        _clean_str(tx.remote_checkout_id),
        _clean_str(tx.gateway_reference),
        _clean_str(tx.local_reference),
    ]

    queryset = Payment.objects.all()

    for reference in references:
        if not reference:
            continue

        found = queryset.filter(external_reference=reference).order_by("-id").first()
        if found:
            return found

        found = queryset.filter(transaction_id=reference).order_by("-id").first()
        if found:
            return found

    provider = _resolve_payment_provider(tx.provider)

    if invoice:
        found = queryset.filter(invoice=invoice, provider=provider).order_by("-id").first()
        if found:
            return found

    if order:
        found = queryset.filter(order=order, provider=provider).order_by("-id").first()
        if found:
            return found

    return None


def _create_local_payment_for_transaction(
    tx: PaymentGatewayTransaction,
    *,
    invoice: Any,
    order: Any,
    customer: Any,
) -> Any:
    try:
        from payments.services import create_payment
    except Exception as exc:
        raise PaymentGatewayConfirmationError("payments.services.create_payment is not available.") from exc

    if not order:
        raise PaymentGatewayConfirmationError("Cannot create local payment without order.")

    if not customer:
        raise PaymentGatewayConfirmationError("Cannot create local payment without customer.")

    result = create_payment(
        order=order,
        customer=customer,
        invoice=invoice,
        amount=tx.amount,
        payment_method=_resolve_payment_method(tx.provider, tx.payment_method),
        provider=_resolve_payment_provider(tx.provider),
        currency=tx.currency,
        external_reference=_first_non_empty(
            tx.remote_transaction_id,
            tx.remote_order_id,
            tx.remote_checkout_id,
            tx.gateway_reference,
            tx.local_reference,
        ),
        transaction_id=_first_non_empty(
            tx.remote_transaction_id,
            tx.remote_checkout_id,
            tx.remote_order_id,
            tx.gateway_reference,
        ),
        notes=f"Created from {tx.provider} gateway transaction #{tx.pk}",
    )

    return _safe_getattr(result, "payment", result)


def _confirm_local_payment_for_transaction(
    tx: PaymentGatewayTransaction,
    *,
    gateway_status: str = "",
    gateway_message: str = "",
    auto_create_treasury_movement: bool = True,
    auto_post_accounting: bool = True,
) -> dict[str, Any]:
    """
    يعكس نجاح بوابة الدفع على Payment المحلي.

    Gateway Success
    → payments.services.confirm_payment
    → Accounting + Treasury
    """
    try:
        from payments.services import confirm_payment
    except Exception as exc:
        raise PaymentGatewayConfirmationError("payments.services.confirm_payment is not available.") from exc

    local = _resolve_local_objects_for_transaction(tx)

    invoice = local["invoice"]
    order = local["order"]
    customer = local["customer"]
    payment = local["payment"]

    if not payment:
        payment = _find_existing_payment_for_transaction(
            tx,
            invoice=invoice,
            order=order,
        )

    created_payment = False

    if not payment:
        payment = _create_local_payment_for_transaction(
            tx,
            invoice=invoice,
            order=order,
            customer=customer,
        )
        created_payment = True

    if _payment_already_confirmed(payment):
        return {
            "success": True,
            "payment_created": created_payment,
            "payment_confirmed": False,
            "message": "Local payment is already confirmed/posted.",
            "payment_id": _safe_getattr(payment, "pk", None),
            "payment_number": _safe_getattr(payment, "payment_number", ""),
        }

    result = confirm_payment(
        payment=payment,
        actor=None,
        paid_amount=tx.amount,
        external_reference=_first_non_empty(
            tx.remote_transaction_id,
            tx.remote_order_id,
            tx.remote_checkout_id,
            tx.gateway_reference,
            tx.local_reference,
        ),
        transaction_id=_first_non_empty(
            tx.remote_transaction_id,
            tx.remote_checkout_id,
            tx.remote_order_id,
            tx.gateway_reference,
        ),
        gateway_response_code=_clean_str(gateway_status or tx.gateway_status or "SUCCESS"),
        gateway_message=_clean_str(gateway_message or f"{tx.provider} payment confirmed."),
        auto_create_treasury_movement=auto_create_treasury_movement,
        auto_post_accounting=auto_post_accounting,
    )

    confirmed_payment = _safe_getattr(result, "payment", payment)

    return {
        "success": True,
        "payment_created": created_payment,
        "payment_confirmed": True,
        "message": "Local payment confirmed successfully.",
        "payment_id": _safe_getattr(confirmed_payment, "pk", None),
        "payment_number": _safe_getattr(confirmed_payment, "payment_number", ""),
        "status_before": _safe_getattr(result, "status_before", ""),
        "status_after": _safe_getattr(result, "status_after", ""),
        "accounting": {
            "requested": bool(_safe_getattr(result, "accounting_post_requested", False)),
            "dispatched": bool(_safe_getattr(result, "accounting_post_dispatched", False)),
            "message": _safe_getattr(result, "accounting_post_message", ""),
        },
        "treasury": {
            "requested": bool(_safe_getattr(result, "treasury_requested", False)),
            "dispatched": bool(_safe_getattr(result, "treasury_dispatched", False)),
            "message": _safe_getattr(result, "treasury_message", ""),
        },
    }


def finalize_successful_gateway_transaction(
    tx: PaymentGatewayTransaction,
    *,
    gateway_status: str = "",
    gateway_message: str = "",
    response_payload: dict | None = None,
    webhook_payload: dict | None = None,
    auto_create_treasury_movement: bool = True,
    auto_post_accounting: bool = True,
) -> dict[str, Any]:
    """
    تثبيت نجاح عملية البوابة ثم تأكيد الدفع المحلي بعد commit.
    """
    if not tx:
        raise PaymentGatewayValidationError("PaymentGatewayTransaction is required.")

    with transaction.atomic():
        tx.status = PaymentGatewayTransactionStatus.SUCCESS
        tx.gateway_status = _clean_str(gateway_status) or tx.gateway_status or "SUCCESS"
        tx.response_payload = _json_safe(response_payload or tx.response_payload or {})
        tx.latest_webhook_payload = _json_safe(webhook_payload or tx.latest_webhook_payload or {})
        tx.paid_at = tx.paid_at or timezone.now()
        tx.error_message = ""
        tx.notes = _append_note(tx.notes, "Gateway transaction marked as successful.")

        tx.save(
            update_fields=[
                "status",
                "gateway_status",
                "response_payload",
                "latest_webhook_payload",
                "paid_at",
                "error_message",
                "notes",
                "updated_at",
            ]
        )

        tx_id = tx.pk

        def _confirm_after_commit() -> None:
            fresh_tx = PaymentGatewayTransaction.objects.get(pk=tx_id)

            try:
                result = _confirm_local_payment_for_transaction(
                    fresh_tx,
                    gateway_status=gateway_status,
                    gateway_message=gateway_message,
                    auto_create_treasury_movement=auto_create_treasury_movement,
                    auto_post_accounting=auto_post_accounting,
                )

                fresh_tx.notes = _append_note(
                    fresh_tx.notes,
                    f"Local payment sync: {_safe_json_dump(result)}",
                )
                fresh_tx.save(update_fields=["notes", "updated_at"])

            except Exception as exc:
                logger.exception(
                    "Failed to confirm local payment from gateway transaction %s: %s",
                    tx_id,
                    exc,
                )
                fresh_tx.error_message = _append_note(
                    fresh_tx.error_message,
                    f"Local payment sync failed: {exc}",
                )
                fresh_tx.save(update_fields=["error_message", "updated_at"])

        transaction.on_commit(_confirm_after_commit)

    return {
        "success": True,
        "message": "Gateway transaction finalized. Local payment confirmation scheduled.",
        "transaction_id": tx.pk,
        "status": tx.status,
        "gateway_status": tx.gateway_status,
    }


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
    amount_value = _decimal_amount(amount)

    if amount_value <= Decimal("0.00"):
        raise PaymentGatewayValidationError("Tamara amount must be greater than zero.")

    amount_str = format(amount_value, "f")
    currency_code = _clean_str(currency, "SAR").upper()
    first_name, last_name = _split_name(customer_name, fallback_first="Customer")

    payload = {
        "order_reference_id": _clean_str(local_reference),
        "description": _clean_str(description) or _clean_str(item_name),
        "country_code": _clean_str(country_code, "SA").upper(),
        "currency": currency_code,
        "total_amount": {
            "amount": amount_str,
            "currency": currency_code,
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
                    "currency": currency_code,
                },
                "total_amount": {
                    "amount": amount_str,
                    "currency": currency_code,
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
        gateway_reference=local_reference,
        status=PaymentGatewayTransactionStatus.INITIATED,
    )

    try:
        response = client.create_checkout_session(payload)

        checkout_url = _clean_str(
            response.get("checkout_url")
            or response.get("url")
            or response.get("redirect_url")
        )
        remote_order_id = _clean_str(response.get("order_id") or response.get("id"))
        remote_checkout_id = _clean_str(response.get("checkout_id"))
        gateway_status = _clean_str(response.get("status"), "CREATED").upper()

        update_transaction_from_gateway_response(
            tx,
            payment_url=checkout_url,
            redirect_url=success_url,
            remote_order_id=remote_order_id,
            remote_checkout_id=remote_checkout_id,
            gateway_reference=local_reference,
            gateway_status=gateway_status,
            response_payload=response,
            status=PaymentGatewayTransactionStatus.REQUIRES_ACTION,
        )

        return tx

    except (TamaraConfigurationError, TamaraRequestError, TamaraAPIError) as exc:
        logger.exception("Tamara checkout creation failed. local_reference=%s", local_reference)
        update_transaction_from_gateway_response(
            tx,
            status=PaymentGatewayTransactionStatus.FAILED,
            error_message=str(exc),
            notes="Tamara checkout creation failed.",
        )
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
    amount_value = _decimal_amount(amount)

    if amount_value <= Decimal("0.00"):
        raise PaymentGatewayValidationError("Tap amount must be greater than zero.")

    first_name, last_name = _split_name(customer_name, fallback_first="Customer")
    currency_code = _clean_str(currency, "SAR").upper()

    payload = {
        "amount": float(amount_value),
        "currency": currency_code,
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
            "local_reference_type": _normalize_reference_type(local_reference_type),
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
        gateway_reference=local_reference,
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
        gateway_status = _clean_str(response.get("status"), "INITIATED").upper()

        update_transaction_from_gateway_response(
            tx,
            payment_url=checkout_url,
            remote_transaction_id=remote_transaction_id,
            gateway_reference=local_reference,
            gateway_status=gateway_status,
            response_payload=response,
            status=PaymentGatewayTransactionStatus.REQUIRES_ACTION,
        )

        return tx

    except (TapConfigurationError, TapRequestError, TapAPIError) as exc:
        logger.exception("Tap checkout creation failed. local_reference=%s", local_reference)
        update_transaction_from_gateway_response(
            tx,
            status=PaymentGatewayTransactionStatus.FAILED,
            error_message=str(exc),
            notes="Tap checkout creation failed.",
        )
        raise PaymentGatewayServiceError(str(exc)) from exc


# ============================================================
# 🔎 Fetch / Resolve Remote State
# ============================================================

def refresh_tap_transaction_status(tx: PaymentGatewayTransaction) -> PaymentGatewayTransaction:
    if not tx:
        raise PaymentGatewayValidationError("PaymentGatewayTransaction is required.")

    if tx.provider != PaymentGatewayProvider.TAP:
        raise PaymentGatewayValidationError("refresh_tap_transaction_status expects a TAP transaction.")

    if not _clean_str(tx.remote_transaction_id):
        raise PaymentGatewayValidationError("TAP transaction missing remote_transaction_id.")

    client = build_tap_client()
    response = client.retrieve_charge(tx.remote_transaction_id)
    gateway_status = _clean_str(response.get("status")).upper()

    mapped_status = _normalize_status(gateway_status, PaymentGatewayTransactionStatus.PROCESSING)

    update_transaction_from_gateway_response(
        tx,
        gateway_status=gateway_status,
        response_payload=response,
        status=mapped_status,
    )

    if mapped_status == PaymentGatewayTransactionStatus.SUCCESS:
        finalize_successful_gateway_transaction(
            tx,
            gateway_status=gateway_status,
            gateway_message="Tap charge status confirmed as successful.",
            response_payload=response,
        )

    return tx


def refresh_tamara_transaction_status(tx: PaymentGatewayTransaction) -> PaymentGatewayTransaction:
    if not tx:
        raise PaymentGatewayValidationError("PaymentGatewayTransaction is required.")

    if tx.provider != PaymentGatewayProvider.TAMARA:
        raise PaymentGatewayValidationError("refresh_tamara_transaction_status expects a TAMARA transaction.")

    order_id = _clean_str(tx.remote_order_id)

    if not order_id:
        raise PaymentGatewayValidationError("Tamara transaction missing remote_order_id.")

    client = build_tamara_client()
    response = client.get_order(order_id)

    gateway_status = _clean_str(
        response.get("status")
        or response.get("order_status")
        or (response.get("order") or {}).get("status")
    ).upper()

    mapped_status = _normalize_status(gateway_status, PaymentGatewayTransactionStatus.PROCESSING)

    update_transaction_from_gateway_response(
        tx,
        gateway_status=gateway_status,
        response_payload=response,
        status=mapped_status,
    )

    if mapped_status == PaymentGatewayTransactionStatus.SUCCESS:
        finalize_successful_gateway_transaction(
            tx,
            gateway_status=gateway_status,
            gateway_message="Tamara order status confirmed as successful.",
            response_payload=response,
        )

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
    if not isinstance(payload, dict) or not payload:
        raise PaymentGatewayValidationError("Tamara webhook payload must be a non-empty dict.")

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

    if not tx:
        tx = find_transaction_by_local_reference(
            provider=PaymentGatewayProvider.TAMARA,
            local_reference=order_reference_id,
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
            "checkout_id": checkout_id,
        }
        log.mark_failed("Invalid Tamara webhook token.", result)
        return result

    payment_sync_result = None

    if tx:
        mapped_status = _normalize_status(gateway_status, PaymentGatewayTransactionStatus.PROCESSING)

        tx.latest_webhook_payload = _json_safe(payload)
        tx.last_webhook_at = timezone.now()
        tx.is_webhook_verified = True
        tx.gateway_status = gateway_status or tx.gateway_status
        tx.remote_order_id = order_id or tx.remote_order_id
        tx.remote_checkout_id = checkout_id or tx.remote_checkout_id
        tx.gateway_reference = order_reference_id or tx.gateway_reference
        tx.status = mapped_status

        if mapped_status == PaymentGatewayTransactionStatus.SUCCESS:
            tx.paid_at = tx.paid_at or timezone.now()

        tx.save(
            update_fields=[
                "latest_webhook_payload",
                "last_webhook_at",
                "is_webhook_verified",
                "gateway_status",
                "remote_order_id",
                "remote_checkout_id",
                "gateway_reference",
                "status",
                "paid_at",
                "updated_at",
            ]
        )

        if tx.status == PaymentGatewayTransactionStatus.SUCCESS:
            payment_sync_result = finalize_successful_gateway_transaction(
                tx,
                gateway_status=gateway_status,
                gateway_message="Tamara webhook confirmed payment success.",
                response_payload=payload,
                webhook_payload=payload,
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
        "payment_sync": payment_sync_result,
    }

    log.mark_processed(result)
    return result


def handle_tap_webhook(
    *,
    payload: dict[str, Any],
    headers: dict[str, Any] | None = None,
    header_hash: str = "",
) -> dict[str, Any]:
    if not isinstance(payload, dict) or not payload:
        raise PaymentGatewayValidationError("Tap webhook payload must be a non-empty dict.")

    config = get_active_gateway_config(PaymentGatewayProvider.TAP)

    event_type = _clean_str(payload.get("object") or payload.get("type"), "charge")
    charge_id = _clean_str(payload.get("id"))
    gateway_status = _clean_str(payload.get("status")).upper()

    reference = payload.get("reference") if isinstance(payload.get("reference"), dict) else {}
    gateway_reference = _clean_str(reference.get("gateway"))
    payment_reference = _clean_str(reference.get("payment"))
    order_reference = _clean_str(reference.get("order") or reference.get("transaction"))

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

    if not tx:
        tx = find_transaction_by_local_reference(
            provider=PaymentGatewayProvider.TAP,
            local_reference=order_reference or payment_reference or gateway_reference,
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

    payment_sync_result = None

    if tx:
        mapped_status = _normalize_status(gateway_status, PaymentGatewayTransactionStatus.PROCESSING)

        tx.latest_webhook_payload = _json_safe(payload)
        tx.last_webhook_at = timezone.now()
        tx.is_webhook_verified = True
        tx.gateway_status = gateway_status or tx.gateway_status
        tx.remote_transaction_id = charge_id or tx.remote_transaction_id
        tx.gateway_reference = order_reference or payment_reference or gateway_reference or tx.gateway_reference
        tx.status = mapped_status

        if mapped_status == PaymentGatewayTransactionStatus.SUCCESS:
            tx.paid_at = tx.paid_at or timezone.now()

        tx.save(
            update_fields=[
                "latest_webhook_payload",
                "last_webhook_at",
                "is_webhook_verified",
                "gateway_status",
                "remote_transaction_id",
                "gateway_reference",
                "status",
                "paid_at",
                "updated_at",
            ]
        )

        if tx.status == PaymentGatewayTransactionStatus.SUCCESS:
            payment_sync_result = finalize_successful_gateway_transaction(
                tx,
                gateway_status=gateway_status,
                gateway_message="Tap webhook confirmed payment success.",
                response_payload=payload,
                webhook_payload=payload,
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
        "payment_sync": payment_sync_result,
    }

    log.mark_processed(result)
    return result