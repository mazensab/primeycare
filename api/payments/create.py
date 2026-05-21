# ============================================================
# 📂 api/payments/create.py
# 🧠 Create Payment API — Primey Care V2.1
# ------------------------------------------------------------
# ✅ إنشاء دفعة مرتبطة بفاتورة / طلب / عميل
# ✅ يستدعي payments.services.create_payment الرسمي فقط
# ✅ لا يؤكد الدفع تلقائيًا إلا إذا تم تمرير confirm=true
# ✅ عند التأكيد يستدعي payments.services.confirm_payment الرسمي
# ✅ يدعم cash / bank_transfer / gateway / cards / wallets / Tamara / Tabby
# ✅ متوافق مع Accounting + Treasury Backend الجديد
# ✅ متوافق مع Customer Portal / OTP customer account fields
# ✅ استجابة موحدة للواجهة: ok / success / data
# ============================================================

from __future__ import annotations

import json
import logging
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any

from django.apps import apps
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from customers.services import get_or_create_customer_from_phone
from payments.models import PaymentMethod, PaymentProvider
from payments.services import (
    PaymentServiceError,
    confirm_payment,
    create_payment,
)


logger = logging.getLogger(__name__)


# ============================================================
# JSON Helpers
# ============================================================

def _decimal_to_string(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)

    if isinstance(value, dict):
        return {key: _decimal_to_string(val) for key, val in value.items()}

    if isinstance(value, list):
        return [_decimal_to_string(item) for item in value]

    if isinstance(value, tuple):
        return tuple(_decimal_to_string(item) for item in value)

    return value


def _json_error(
    message: str,
    *,
    status: int = 400,
    errors: Any = None,
) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": False,
        "success": False,
        "message": message,
    }

    if errors is not None:
        payload["errors"] = _decimal_to_string(errors)

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


def _json_success(
    data: dict[str, Any],
    *,
    message: str = "تم تنفيذ العملية بنجاح.",
    status: int = 200,
) -> JsonResponse:
    return JsonResponse(
        {
            "ok": True,
            "success": True,
            "message": message,
            "data": _decimal_to_string(data),
        },
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


# ============================================================
# Safe Helpers
# ============================================================

def _parse_json_body(request) -> dict[str, Any]:
    if not request.body:
        return {}

    try:
        parsed = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise ValidationError("صيغة JSON غير صحيحة.") from exc

    if not isinstance(parsed, dict):
        raise ValidationError("جسم الطلب يجب أن يكون JSON Object.")

    return parsed


def _parse_decimal(value: Any, field_name: str = "amount") -> Decimal:
    if value in (None, ""):
        return Decimal("0.00")

    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValidationError({field_name: "القيمة المالية غير صحيحة."}) from exc

    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _as_bool(value: Any, default: bool = False) -> bool:
    if value in (None, ""):
        return default

    if isinstance(value, bool):
        return value

    normalized = str(value).strip().lower()

    if normalized in {"1", "true", "yes", "y", "on"}:
        return True

    if normalized in {"0", "false", "no", "n", "off"}:
        return False

    return default


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _clean_email(value: Any) -> str:
    return _clean_text(value).lower()


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _safe_attr(obj: Any, attr_name: str, default: Any = None) -> Any:
    try:
        return getattr(obj, attr_name, default)
    except Exception:
        return default


def _safe_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _get_model(app_label: str, model_name: str):
    try:
        return apps.get_model(app_label, model_name)
    except LookupError:
        return None


def _get_object_or_none(model, pk: Any):
    if not model or pk in (None, "", 0, "0"):
        return None

    try:
        return model.objects.filter(pk=pk).first()
    except Exception:
        return None


def _first_non_empty(*values: Any) -> Any:
    for value in values:
        if value not in (None, "", [], {}, ()):
            return value
    return None


def _extract_company_id(request) -> int | None:
    raw_value = (
        request.GET.get("company_id")
        or request.headers.get("X-Company-Id")
        or request.session.get("active_company_id")
    )

    if raw_value in {None, ""}:
        return None

    try:
        parsed = int(raw_value)
    except (TypeError, ValueError):
        return None

    return parsed if parsed > 0 else None


def _filter_by_company_if_supported(queryset, model, request):
    company_id = _extract_company_id(request)

    if not company_id:
        return queryset

    model_fields = {field.name for field in model._meta.fields}

    if "company" in model_fields:
        return queryset.filter(company_id=company_id)

    return queryset


def _resolve_invoice_due_amount(invoice) -> Decimal:
    if not invoice:
        return Decimal("0.00")

    return _parse_decimal(
        _first_non_empty(
            _safe_attr(invoice, "due_amount", None),
            _safe_attr(invoice, "remaining_amount", None),
            _safe_attr(invoice, "balance_due", None),
            _safe_attr(invoice, "total_amount", None),
            _safe_attr(invoice, "grand_total", None),
            _safe_attr(invoice, "amount", None),
        ),
        field_name="amount",
    )


# ============================================================
# Customer Resolve Helpers
# ============================================================

def _resolve_customer_phone_from_body(body: dict[str, Any]) -> str:
    customer_payload = _safe_dict(body.get("customer"))

    return _clean_text(
        _first_non_empty(
            body.get("customer_phone"),
            body.get("customer_phone_number"),
            body.get("customer_mobile"),
            body.get("customer_whatsapp"),
            body.get("phone_number"),
            body.get("mobile_number"),
            body.get("whatsapp_number"),
            body.get("phone"),
            body.get("whatsapp"),
            customer_payload.get("phone_number"),
            customer_payload.get("whatsapp_number"),
            customer_payload.get("phone"),
            customer_payload.get("whatsapp"),
            customer_payload.get("mobile_number"),
            "",
        )
    )


def _build_customer_payload_from_body(body: dict[str, Any]) -> dict[str, Any]:
    customer_payload = _safe_dict(body.get("customer"))

    full_name = _clean_text(
        _first_non_empty(
            body.get("customer_name"),
            body.get("full_name"),
            body.get("name"),
            customer_payload.get("display_name"),
            customer_payload.get("full_name"),
            customer_payload.get("name"),
            "",
        )
    )

    phone_number = _resolve_customer_phone_from_body(body)

    return {
        "first_name": _clean_text(
            _first_non_empty(
                body.get("customer_first_name"),
                body.get("first_name"),
                customer_payload.get("first_name"),
                "",
            )
        ),
        "last_name": _clean_text(
            _first_non_empty(
                body.get("customer_last_name"),
                body.get("last_name"),
                customer_payload.get("last_name"),
                "",
            )
        ),
        "display_name": full_name,
        "full_name": full_name,
        "name": full_name,
        "email": _clean_email(
            _first_non_empty(
                body.get("customer_email"),
                body.get("email"),
                customer_payload.get("email"),
                "",
            )
        ),
        "phone_number": phone_number,
        "whatsapp_number": _clean_text(
            _first_non_empty(
                body.get("customer_whatsapp"),
                body.get("whatsapp_number"),
                body.get("whatsapp"),
                customer_payload.get("whatsapp_number"),
                customer_payload.get("whatsapp"),
                phone_number,
            )
        ),
        "city": _clean_text(
            _first_non_empty(
                body.get("customer_city"),
                body.get("city"),
                customer_payload.get("city"),
                "",
            )
        ),
        "district": _clean_text(
            _first_non_empty(
                body.get("customer_district"),
                body.get("district"),
                customer_payload.get("district"),
                "",
            )
        ),
        "street_address": _clean_text(
            _first_non_empty(
                body.get("customer_address"),
                body.get("street_address"),
                body.get("address"),
                customer_payload.get("street_address"),
                customer_payload.get("address"),
                "",
            )
        ),
        "national_address_text": _clean_text(
            _first_non_empty(
                body.get("national_address_text"),
                customer_payload.get("national_address_text"),
                "",
            )
        ),
        "source": "website",
    }


def _resolve_customer_from_phone_if_needed(*, body: dict[str, Any], request) -> Any | None:
    phone_number = _resolve_customer_phone_from_body(body)

    if not phone_number:
        return None

    account_result = get_or_create_customer_from_phone(
        phone_number=phone_number,
        payload=_build_customer_payload_from_body(body),
        source="website",
        create_user=False,
        created_by=request.user if request.user.is_authenticated else None,
    )

    return account_result.customer


# ============================================================
# Payment Method / Provider
# ============================================================

def _resolve_payment_method(value: str | None) -> str:
    normalized = (value or "").strip().upper()

    aliases = {
        "CASH": PaymentMethod.CASH,
        "CASH_ON_DELIVERY": PaymentMethod.CASH,
        "COD": PaymentMethod.CASH,

        "BANK": PaymentMethod.BANK_TRANSFER,
        "BANK_TRANSFER": PaymentMethod.BANK_TRANSFER,
        "TRANSFER": PaymentMethod.BANK_TRANSFER,
        "WIRE": PaymentMethod.BANK_TRANSFER,

        "GATEWAY": PaymentMethod.GATEWAY,
        "ONLINE": PaymentMethod.GATEWAY,
        "ONLINE_PAYMENT": PaymentMethod.GATEWAY,

        "CARD": PaymentMethod.CREDIT_CARD,
        "CREDIT_CARD": PaymentMethod.CREDIT_CARD,
        "VISA": PaymentMethod.CREDIT_CARD,
        "MASTERCARD": PaymentMethod.CREDIT_CARD,

        "DEBIT_CARD": PaymentMethod.DEBIT_CARD,
        "MADA": PaymentMethod.DEBIT_CARD,

        "APPLE_PAY": PaymentMethod.APPLE_PAY,
        "STC_PAY": PaymentMethod.STC_PAY,

        "TAMARA": PaymentMethod.TAMARA,
        "TABBY": PaymentMethod.TABBY,

        "WALLET": PaymentMethod.WALLET,
    }

    return aliases.get(normalized, PaymentMethod.CASH)


def _resolve_provider(value: str | None, payment_method: str) -> str:
    normalized = (value or "").strip().upper()

    aliases = {
        "INTERNAL": PaymentProvider.INTERNAL,
        "MANUAL": PaymentProvider.MANUAL,
        "BANK": PaymentProvider.BANK,
        "TAP": PaymentProvider.TAP,
        "TAMARA": PaymentProvider.TAMARA,
        "TABBY": PaymentProvider.TABBY,
        "OTHER": PaymentProvider.OTHER,
    }

    if normalized in aliases:
        return aliases[normalized]

    if payment_method == PaymentMethod.BANK_TRANSFER:
        return PaymentProvider.BANK

    if payment_method == PaymentMethod.TAMARA:
        return PaymentProvider.TAMARA

    if payment_method == PaymentMethod.TABBY:
        return PaymentProvider.TABBY

    if payment_method in {
        PaymentMethod.CREDIT_CARD,
        PaymentMethod.DEBIT_CARD,
        PaymentMethod.APPLE_PAY,
        PaymentMethod.STC_PAY,
        PaymentMethod.GATEWAY,
    }:
        return PaymentProvider.TAP

    return PaymentProvider.INTERNAL


# ============================================================
# Serializers
# ============================================================

def _serialize_invoice(invoice) -> dict[str, Any] | None:
    if not invoice:
        return None

    return {
        "id": _safe_attr(invoice, "id", None),
        "invoice_number": _safe_attr(invoice, "invoice_number", ""),
        "status": _safe_attr(invoice, "status", ""),
        "total_amount": _safe_attr(invoice, "total_amount", None),
        "paid_amount": _safe_attr(invoice, "paid_amount", None),
        "due_amount": _safe_attr(invoice, "due_amount", None),
        "customer_id": _safe_attr(invoice, "customer_id", None),
        "order_id": _safe_attr(invoice, "order_id", None),
    }


def _serialize_order(order) -> dict[str, Any] | None:
    if not order:
        return None

    return {
        "id": _safe_attr(order, "id", None),
        "order_number": (
            _safe_attr(order, "order_number", "")
            or _safe_attr(order, "number", "")
            or _safe_attr(order, "code", "")
        ),
        "status": _safe_attr(order, "status", ""),
        "payment_status": _safe_attr(order, "payment_status", ""),
        "fulfillment_status": _safe_attr(order, "fulfillment_status", ""),
        "total_amount": _safe_attr(order, "total_amount", None),
        "amount_paid": _safe_attr(order, "amount_paid", None),
        "remaining_amount": _safe_attr(order, "remaining_amount", None),
        "customer_id": _safe_attr(order, "customer_id", None),
    }


def _serialize_customer(customer) -> dict[str, Any] | None:
    if not customer:
        return None

    full_name = (
        _safe_attr(customer, "full_name", "")
        or _safe_attr(customer, "name", "")
        or _safe_attr(customer, "display_name", "")
    )

    phone_number = (
        _safe_attr(customer, "phone_number", "")
        or _safe_attr(customer, "phone", "")
    )

    whatsapp_number = _safe_attr(customer, "whatsapp_number", "")
    user = _safe_attr(customer, "user", None)

    return {
        "id": _safe_attr(customer, "id", None),
        "customer_code": _safe_attr(customer, "customer_code", ""),
        "name": full_name,
        "display_name": _safe_attr(customer, "display_name", "") or full_name,
        "full_name": full_name,
        "status": _safe_attr(customer, "status", ""),
        "phone": phone_number,
        "phone_number": phone_number,
        "whatsapp_number": whatsapp_number,
        "primary_contact_number": (
            whatsapp_number
            or phone_number
            or _safe_attr(customer, "alternative_phone_number", "")
        ),
        "email": _safe_attr(customer, "email", ""),
        "normalized_phone": _safe_attr(customer, "normalized_phone", ""),
        "user_id": _safe_attr(customer, "user_id", None),
        "user_username": _safe_attr(user, "username", "") if user else "",
        "has_customer_account": bool(_safe_attr(customer, "user_id", None)),
        "is_phone_verified": bool(_safe_attr(customer, "phone_verified_at", None)),
        "is_whatsapp_verified": bool(_safe_attr(customer, "whatsapp_verified_at", None)),
        "phone_verified_at": _iso_datetime(_safe_attr(customer, "phone_verified_at", None)),
        "whatsapp_verified_at": _iso_datetime(_safe_attr(customer, "whatsapp_verified_at", None)),
        "last_login_at": _iso_datetime(_safe_attr(customer, "last_login_at", None)),
    }


def _serialize_payment(payment) -> dict[str, Any]:
    return {
        "id": payment.pk,
        "payment_number": _safe_attr(payment, "payment_number", ""),
        "status": _safe_attr(payment, "status", ""),
        "payment_method": _safe_attr(payment, "payment_method", ""),
        "provider": _safe_attr(payment, "provider", ""),
        "amount": _safe_attr(payment, "amount", None),
        "paid_amount": _safe_attr(payment, "paid_amount", None),
        "refunded_amount": _safe_attr(payment, "refunded_amount", None),
        "currency": _safe_attr(payment, "currency", "SAR") or "SAR",
        "invoice_id": _safe_attr(payment, "invoice_id", None),
        "invoice": _serialize_invoice(_safe_attr(payment, "invoice", None)),
        "order_id": _safe_attr(payment, "order_id", None),
        "order": _serialize_order(_safe_attr(payment, "order", None)),
        "customer_id": _safe_attr(payment, "customer_id", None),
        "customer": _serialize_customer(_safe_attr(payment, "customer", None)),
        "external_reference": _safe_attr(payment, "external_reference", ""),
        "transaction_id": _safe_attr(payment, "transaction_id", ""),
        "gateway_response_code": _safe_attr(payment, "gateway_response_code", ""),
        "gateway_message": _safe_attr(payment, "gateway_message", ""),
        "failure_reason": _safe_attr(payment, "failure_reason", ""),
        "treasury_movement_reference": _safe_attr(payment, "treasury_movement_reference", ""),
        "accounting_entry_reference": _safe_attr(payment, "accounting_entry_reference", ""),
        "is_treasury_posted": bool(_safe_attr(payment, "is_treasury_posted", False)),
        "is_accounting_posted": bool(_safe_attr(payment, "is_accounting_posted", False)),
        "initiated_at": _iso_datetime(_safe_attr(payment, "initiated_at", None)),
        "paid_at": _iso_datetime(_safe_attr(payment, "paid_at", None)),
        "cancelled_at": _iso_datetime(_safe_attr(payment, "cancelled_at", None)),
        "created_at": _iso_datetime(_safe_attr(payment, "created_at", None)),
        "updated_at": _iso_datetime(_safe_attr(payment, "updated_at", None)),
    }


def _serialize_confirm_result(confirm_result) -> dict[str, Any] | None:
    if not confirm_result:
        return None

    return {
        "status_before": _safe_attr(confirm_result, "status_before", None),
        "status_after": _safe_attr(confirm_result, "status_after", None),
        "treasury": {
            "requested": bool(_safe_attr(confirm_result, "treasury_requested", False)),
            "dispatched": bool(_safe_attr(confirm_result, "treasury_dispatched", False)),
            "message": _safe_attr(confirm_result, "treasury_message", ""),
        },
        "accounting": {
            "requested": bool(_safe_attr(confirm_result, "accounting_post_requested", False)),
            "dispatched": bool(_safe_attr(confirm_result, "accounting_post_dispatched", False)),
            "message": _safe_attr(confirm_result, "accounting_post_message", ""),
        },
    }


# ============================================================
# API
# ============================================================

@login_required
@require_POST
def create_payment_api(request):
    """
    إنشاء دفعة.

    Body:
    {
      "invoice_id": 1,
      "order_id": 1,
      "customer_id": 1,
      "customer_phone": "05xxxxxxxx",
      "amount": "115.00",
      "payment_method": "cash",
      "provider": "internal",
      "currency": "SAR",
      "external_reference": "BANK-REF-001",
      "transaction_id": "TXN-001",
      "notes": "...",
      "confirm": false,
      "paid_amount": "115.00",
      "gateway_response_code": "APPROVED",
      "gateway_message": "Payment approved",
      "auto_create_treasury_movement": true,
      "auto_post_accounting": true
    }
    """
    try:
        body = _parse_json_body(request)

        Invoice = _get_model("invoices", "Invoice")
        Order = _get_model("orders", "Order")
        Customer = _get_model("customers", "Customer")

        invoice = _get_object_or_none(Invoice, body.get("invoice_id"))
        order = _get_object_or_none(Order, body.get("order_id"))
        customer = _get_object_or_none(Customer, body.get("customer_id"))

        if Invoice and invoice:
            invoice_queryset = _filter_by_company_if_supported(
                Invoice.objects.select_related("customer", "customer__user", "order").filter(pk=invoice.pk),
                Invoice,
                request,
            )
            invoice = invoice_queryset.first()

        if Order and order:
            order_queryset = _filter_by_company_if_supported(
                Order.objects.select_related("customer", "customer__user").filter(pk=order.pk),
                Order,
                request,
            )
            order = order_queryset.first()

        if Customer and customer:
            customer_queryset = _filter_by_company_if_supported(
                Customer.objects.select_related("user").filter(pk=customer.pk),
                Customer,
                request,
            )
            customer = customer_queryset.first()

        if invoice:
            order = order or _safe_attr(invoice, "order", None)
            customer = customer or _safe_attr(invoice, "customer", None)

        if order:
            customer = customer or _safe_attr(order, "customer", None)

        if not customer:
            customer = _resolve_customer_from_phone_if_needed(
                body=body,
                request=request,
            )

        if not order:
            return _json_error(
                "يجب تحديد الطلب أو فاتورة مرتبطة بطلب.",
                status=400,
            )

        if not customer:
            return _json_error(
                "يجب تحديد العميل أو اختيار طلب/فاتورة مرتبطة بعميل.",
                status=400,
            )

        amount = _parse_decimal(
            _first_non_empty(
                body.get("amount"),
                body.get("paid_amount"),
                _resolve_invoice_due_amount(invoice) if invoice else None,
                _safe_attr(invoice, "total_amount", None) if invoice else None,
                _safe_attr(invoice, "grand_total", None) if invoice else None,
                _safe_attr(invoice, "amount", None) if invoice else None,
            ),
            field_name="amount",
        )

        if amount <= Decimal("0.00"):
            return _json_error(
                "مبلغ الدفع يجب أن يكون أكبر من صفر.",
                status=400,
            )

        payment_method = _resolve_payment_method(
            body.get("payment_method")
            or body.get("method")
        )
        provider = _resolve_provider(
            body.get("provider"),
            payment_method,
        )

        currency = _clean_text(body.get("currency") or "SAR").upper() or "SAR"

        result = create_payment(
            order=order,
            customer=customer,
            invoice=invoice,
            amount=amount,
            payment_method=payment_method,
            provider=provider,
            currency=currency,
            external_reference=_clean_text(body.get("external_reference")),
            transaction_id=_clean_text(body.get("transaction_id")),
            notes=_clean_text(body.get("notes")),
        )

        payment = result.payment
        confirm_result = None

        if _as_bool(body.get("confirm"), default=False):
            paid_amount = _parse_decimal(
                _first_non_empty(body.get("paid_amount"), amount),
                field_name="paid_amount",
            )

            confirm_result = confirm_payment(
                payment=payment,
                actor=request.user,
                paid_amount=paid_amount,
                external_reference=(
                    _clean_text(body.get("external_reference"))
                    if "external_reference" in body
                    else None
                ),
                transaction_id=(
                    _clean_text(body.get("transaction_id"))
                    if "transaction_id" in body
                    else None
                ),
                gateway_response_code=(
                    _clean_text(body.get("gateway_response_code"))
                    if "gateway_response_code" in body
                    else None
                ),
                gateway_message=(
                    _clean_text(body.get("gateway_message"))
                    if "gateway_message" in body
                    else None
                ),
                auto_create_treasury_movement=_as_bool(
                    body.get("auto_create_treasury_movement"),
                    default=True,
                ),
                auto_post_accounting=_as_bool(
                    body.get("auto_post_accounting"),
                    default=True,
                ),
            )
            payment = confirm_result.payment

        payment.refresh_from_db()

        return _json_success(
            {
                "payment": _serialize_payment(payment),
                "created": bool(_safe_attr(result, "created", True)),
                "confirmed": confirm_result is not None,
                "confirmation": _serialize_confirm_result(confirm_result),
                "customer": _serialize_customer(customer),
                "order": _serialize_order(order),
                "invoice": _serialize_invoice(invoice),
            },
            message="تم إنشاء الدفعة بنجاح.",
            status=201,
        )

    except ValidationError as exc:
        logger.warning("Invalid payment creation request: %s", exc)
        return _json_error(
            "بيانات الطلب غير صحيحة.",
            status=400,
            errors=getattr(exc, "message_dict", None) or getattr(exc, "messages", None) or str(exc),
        )

    except PaymentServiceError as exc:
        logger.warning("Payment creation validation failed: %s", exc)
        return _json_error(str(exc), status=400)

    except Exception as exc:
        logger.exception("Failed to create payment: %s", exc)
        return _json_error("تعذر إنشاء الدفعة.", status=500)