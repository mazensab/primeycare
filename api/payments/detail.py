# ============================================================
# 📂 api/payments/detail.py
# 🧠 Payment Detail API — Primey Care V2.1
# ------------------------------------------------------------
# ✅ تفاصيل دفعة واحدة
# ✅ إظهار الربط مع الفاتورة / الطلب / العميل
# ✅ إظهار بيانات حساب العميل و OTP
# ✅ إظهار مراجع الخزينة والمحاسبة
# ✅ إظهار بيانات البوابة والعملية الخارجية
# ✅ Unified response: ok / success / data
# ✅ Compatible with Accounting / Treasury / Gateways flow
# ✅ Compatible with Customer Portal / OTP customer account fields
# ============================================================

from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.apps import apps
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_GET


logger = logging.getLogger(__name__)


# ============================================================
# JSON Helpers
# ============================================================

def _decimal_to_string(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

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
    extra: dict[str, Any] | None = None,
) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": True,
        "success": True,
        "message": message,
        "data": _decimal_to_string(data),
    }

    if extra:
        payload.update(_decimal_to_string(extra))

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


# ============================================================
# Safe Helpers
# ============================================================

def _resolve_payment_model():
    try:
        return apps.get_model("payments", "Payment")
    except LookupError as exc:
        raise LookupError("Payment model was not found in payments app.") from exc


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


def _money(value: Any) -> Decimal:
    if value is None:
        value = "0.00"

    try:
        return Decimal(str(value)).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )
    except Exception:
        return Decimal("0.00")


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _iso_date(value: Any) -> str | None:
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


def _label(obj: Any) -> str:
    if not obj:
        return ""

    return (
        _safe_attr(obj, "display_name", "")
        or _safe_attr(obj, "full_name", "")
        or _safe_attr(obj, "name", "")
        or _safe_attr(obj, "title", "")
        or _safe_attr(obj, "invoice_number", "")
        or _safe_attr(obj, "order_number", "")
        or _safe_attr(obj, "payment_number", "")
        or str(obj)
    )


# ============================================================
# Serializers
# ============================================================

def _serialize_invoice(invoice) -> dict[str, Any] | None:
    if not invoice:
        return None

    return {
        "id": _safe_attr(invoice, "id", None),
        "label": _label(invoice),
        "invoice_number": _safe_attr(invoice, "invoice_number", ""),
        "status": _safe_attr(invoice, "status", ""),
        "invoice_type": _safe_attr(invoice, "invoice_type", ""),
        "issue_date": _iso_date(_safe_attr(invoice, "issue_date", None)),
        "due_date": _iso_date(_safe_attr(invoice, "due_date", None)),
        "order_id": _safe_attr(invoice, "order_id", None),
        "customer_id": _safe_attr(invoice, "customer_id", None),
        "subtotal": _money(_safe_attr(invoice, "subtotal", "0.00")),
        "discount_amount": _money(_safe_attr(invoice, "discount_amount", "0.00")),
        "taxable_amount": _money(_safe_attr(invoice, "taxable_amount", "0.00")),
        "tax_rate": _money(_safe_attr(invoice, "tax_rate", "0.00")),
        "tax_amount": _money(_safe_attr(invoice, "tax_amount", "0.00")),
        "total_amount": _money(
            _safe_attr(invoice, "total_amount", None)
            or _safe_attr(invoice, "grand_total", None)
            or _safe_attr(invoice, "amount", None)
        ),
        "paid_amount": _money(_safe_attr(invoice, "paid_amount", "0.00")),
        "due_amount": _money(_safe_attr(invoice, "due_amount", "0.00")),
        "currency": _safe_attr(invoice, "currency", "SAR") or "SAR",
        "accounting_entry_reference": _safe_attr(invoice, "accounting_entry_reference", ""),
        "is_accounting_posted": bool(_safe_attr(invoice, "is_accounting_posted", False)),
        "created_at": _iso_datetime(_safe_attr(invoice, "created_at", None)),
        "updated_at": _iso_datetime(_safe_attr(invoice, "updated_at", None)),
    }


def _serialize_order(order) -> dict[str, Any] | None:
    if not order:
        return None

    return {
        "id": _safe_attr(order, "id", None),
        "label": _label(order),
        "order_number": (
            _safe_attr(order, "order_number", "")
            or _safe_attr(order, "number", "")
            or _safe_attr(order, "code", "")
        ),
        "status": _safe_attr(order, "status", ""),
        "payment_status": _safe_attr(order, "payment_status", ""),
        "fulfillment_status": _safe_attr(order, "fulfillment_status", ""),
        "source": _safe_attr(order, "source", ""),
        "product_name": _safe_attr(order, "product_name", ""),
        "product_type": _safe_attr(order, "product_type", ""),
        "total_amount": _money(_safe_attr(order, "total_amount", "0.00")),
        "amount_paid": _money(_safe_attr(order, "amount_paid", "0.00")),
        "remaining_amount": _money(_safe_attr(order, "remaining_amount", "0.00")),
        "currency_code": _safe_attr(order, "currency_code", "SAR") or "SAR",
        "customer_id": _safe_attr(order, "customer_id", None),
        "product_id": _safe_attr(order, "product_id", None),
        "provider_id": _safe_attr(order, "provider_id", None),
        "contract_id": _safe_attr(order, "contract_id", None),
        "agent_id": _safe_attr(order, "agent_id", None),
        "created_at": _iso_datetime(_safe_attr(order, "created_at", None)),
        "updated_at": _iso_datetime(_safe_attr(order, "updated_at", None)),
    }


def _serialize_customer(customer) -> dict[str, Any] | None:
    if not customer:
        return None

    display_name = (
        _safe_attr(customer, "display_name", "")
        or _safe_attr(customer, "full_name", "")
        or _safe_attr(customer, "name", "")
        or _label(customer)
    )

    phone_number = (
        _safe_attr(customer, "phone_number", "")
        or _safe_attr(customer, "phone", "")
        or _safe_attr(customer, "mobile", "")
    )

    whatsapp_number = _safe_attr(customer, "whatsapp_number", "")
    user = _safe_attr(customer, "user", None)

    return {
        "id": _safe_attr(customer, "id", None),
        "customer_code": _safe_attr(customer, "customer_code", ""),
        "name": display_name,
        "display_name": display_name,
        "full_name": _safe_attr(customer, "full_name", "") or display_name,
        "status": _safe_attr(customer, "status", ""),
        "phone": phone_number,
        "phone_number": phone_number,
        "whatsapp": whatsapp_number,
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
        "created_at": _iso_datetime(_safe_attr(customer, "created_at", None)),
        "updated_at": _iso_datetime(_safe_attr(customer, "updated_at", None)),
    }


def _serialize_payment(payment) -> dict[str, Any]:
    invoice = _safe_attr(payment, "invoice", None)
    order = _safe_attr(payment, "order", None)
    customer = _safe_attr(payment, "customer", None)

    return {
        "id": payment.pk,
        "payment_number": _safe_attr(payment, "payment_number", ""),
        "reference": _safe_attr(payment, "payment_number", "") or f"PAY-{payment.pk}",

        "status": _safe_attr(payment, "status", ""),
        "payment_method": _safe_attr(payment, "payment_method", ""),
        "provider": _safe_attr(payment, "provider", ""),
        "currency": _safe_attr(payment, "currency", "SAR") or "SAR",

        "amount": _money(_safe_attr(payment, "amount", "0.00")),
        "paid_amount": _money(_safe_attr(payment, "paid_amount", "0.00")),
        "refunded_amount": _money(_safe_attr(payment, "refunded_amount", "0.00")),
        "remaining_amount": _money(_safe_attr(payment, "remaining_amount", "0.00")),
        "net_collected_amount": _money(_safe_attr(payment, "net_collected_amount", "0.00")),

        "invoice_id": _safe_attr(payment, "invoice_id", None),
        "invoice": _serialize_invoice(invoice),

        "order_id": _safe_attr(payment, "order_id", None),
        "order": _serialize_order(order),

        "customer_id": _safe_attr(payment, "customer_id", None),
        "customer": _serialize_customer(customer),
        "customer_name": _label(customer),

        "external_reference": _safe_attr(payment, "external_reference", ""),
        "transaction_id": _safe_attr(payment, "transaction_id", ""),
        "gateway_response_code": _safe_attr(payment, "gateway_response_code", ""),
        "gateway_message": _safe_attr(payment, "gateway_message", ""),

        "treasury_movement_reference": _safe_attr(payment, "treasury_movement_reference", ""),
        "accounting_entry_reference": _safe_attr(payment, "accounting_entry_reference", ""),
        "is_treasury_posted": bool(_safe_attr(payment, "is_treasury_posted", False)),
        "is_accounting_posted": bool(_safe_attr(payment, "is_accounting_posted", False)),

        "timeline": {
            "initiated_at": _iso_datetime(_safe_attr(payment, "initiated_at", None)),
            "paid_at": _iso_datetime(_safe_attr(payment, "paid_at", None)),
            "refunded_at": _iso_datetime(_safe_attr(payment, "refunded_at", None)),
            "cancelled_at": _iso_datetime(_safe_attr(payment, "cancelled_at", None)),
            "created_at": _iso_datetime(_safe_attr(payment, "created_at", None)),
            "updated_at": _iso_datetime(_safe_attr(payment, "updated_at", None)),
        },

        # توافق مباشر مع الفرونت القديم
        "initiated_at": _iso_datetime(_safe_attr(payment, "initiated_at", None)),
        "paid_at": _iso_datetime(_safe_attr(payment, "paid_at", None)),
        "refunded_at": _iso_datetime(_safe_attr(payment, "refunded_at", None)),
        "cancelled_at": _iso_datetime(_safe_attr(payment, "cancelled_at", None)),
        "created_at": _iso_datetime(_safe_attr(payment, "created_at", None)),
        "updated_at": _iso_datetime(_safe_attr(payment, "updated_at", None)),

        "notes": _safe_attr(payment, "notes", ""),
        "failure_reason": _safe_attr(payment, "failure_reason", ""),

        "financial_flow": {
            "gateway_completed": bool(
                _safe_attr(payment, "transaction_id", "")
                or _safe_attr(payment, "external_reference", "")
            ),
            "accounting_posted": bool(_safe_attr(payment, "is_accounting_posted", False)),
            "treasury_posted": bool(_safe_attr(payment, "is_treasury_posted", False)),
            "accounting_reference": _safe_attr(payment, "accounting_entry_reference", ""),
            "treasury_reference": _safe_attr(payment, "treasury_movement_reference", ""),
        },
    }


def _build_queryset(Payment, request):
    queryset = Payment.objects.select_related(
        "invoice",
        "order",
        "customer",
        "customer__user",
    ).all()

    company_id = _extract_company_id(request)
    model_fields = {field.name for field in Payment._meta.fields}

    if company_id and "company" in model_fields:
        queryset = queryset.filter(company_id=company_id)

    return queryset


# ============================================================
# API
# ============================================================

@login_required
@require_GET
def payment_detail_api(request, payment_id: int):
    try:
        Payment = _resolve_payment_model()

        payment = _build_queryset(Payment, request).filter(pk=payment_id).first()

        if not payment:
            return _json_error("الدفعة غير موجودة.", status=404)

        serialized_payment = _serialize_payment(payment)

        return _json_success(
            {
                "payment": serialized_payment,
                "customer": serialized_payment.get("customer"),
                "order": serialized_payment.get("order"),
                "invoice": serialized_payment.get("invoice"),
                "financial_flow": serialized_payment["financial_flow"],
            },
            message="Payment loaded successfully.",
            extra={
                # توافق خلفي مع أي صفحة تقرأ payment من الجذر
                "payment": serialized_payment,
            },
        )

    except Exception as exc:
        logger.exception("Failed to fetch payment detail: %s", exc)
        return _json_error("تعذر جلب تفاصيل الدفعة.", status=500)