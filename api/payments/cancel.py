# ============================================================
# 📂 api/payments/cancel.py
# 🧠 Cancel Payment API — Primey Care V2
# ------------------------------------------------------------
# ✅ إلغاء آمن للدفعات غير المؤكدة
# ✅ يستدعي payments.services.cancel_payment الرسمي فقط
# ✅ لا يحذف السجل
# ✅ لا يعدّل حالة الدفعة مباشرة داخل API
# ✅ يمنع إلغاء الدفعات المؤكدة من خلال service
# ✅ استجابة موحدة للواجهة: ok / success / data
# ============================================================

from __future__ import annotations

import json
import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.apps import apps
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from payments.services import PaymentServiceError, cancel_payment


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

def _resolve_payment_model():
    try:
        return apps.get_model("payments", "Payment")
    except LookupError as exc:
        raise LookupError("Payment model was not found in payments app.") from exc


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


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _money(value: Any) -> Decimal:
    try:
        return Decimal(str(value or "0.00")).quantize(
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


def _safe_attr(obj: Any, attr_name: str, default: Any = None) -> Any:
    try:
        return getattr(obj, attr_name, default)
    except Exception:
        return default


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
        "total_amount": _safe_attr(order, "total_amount", None),
    }


def _serialize_customer(customer) -> dict[str, Any] | None:
    if not customer:
        return None

    return {
        "id": _safe_attr(customer, "id", None),
        "name": (
            _safe_attr(customer, "full_name", "")
            or _safe_attr(customer, "name", "")
            or _safe_attr(customer, "display_name", "")
        ),
        "phone": _safe_attr(customer, "phone", ""),
        "email": _safe_attr(customer, "email", ""),
    }


def _serialize_payment(payment) -> dict[str, Any]:
    return {
        "id": payment.pk,
        "payment_number": _safe_attr(payment, "payment_number", ""),
        "status": _safe_attr(payment, "status", ""),
        "amount": _money(_safe_attr(payment, "amount", "0.00")),
        "paid_amount": _money(_safe_attr(payment, "paid_amount", "0.00")),
        "refunded_amount": _money(_safe_attr(payment, "refunded_amount", "0.00")),
        "currency": _safe_attr(payment, "currency", "SAR") or "SAR",
        "invoice_id": _safe_attr(payment, "invoice_id", None),
        "invoice": _serialize_invoice(_safe_attr(payment, "invoice", None)),
        "order_id": _safe_attr(payment, "order_id", None),
        "order": _serialize_order(_safe_attr(payment, "order", None)),
        "customer_id": _safe_attr(payment, "customer_id", None),
        "customer": _serialize_customer(_safe_attr(payment, "customer", None)),
        "payment_method": _safe_attr(payment, "payment_method", ""),
        "provider": _safe_attr(payment, "provider", ""),
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


def _build_payment_queryset(Payment, request):
    queryset = Payment.objects.select_related(
        "invoice",
        "order",
        "customer",
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
@require_POST
def cancel_payment_api(request, payment_id: int):
    """
    إلغاء الدفعة رسميًا.

    Body اختياري:
    {
      "reason": "سبب الإلغاء"
    }

    مبدأ مهم:
    - لا حذف.
    - لا تعديل مباشر للحالة داخل API.
    - منع إلغاء الدفعات المؤكدة يتم داخل payments.services.cancel_payment.
    """
    try:
        Payment = _resolve_payment_model()
        body = _parse_json_body(request)

        payment = _build_payment_queryset(Payment, request).filter(pk=payment_id).first()

        if not payment:
            return _json_error("الدفعة غير موجودة.", status=404)

        reason = _clean_text(
            body.get("reason")
            or body.get("failure_reason")
            or ""
        )

        result = cancel_payment(
            payment=payment,
            actor=request.user,
            reason=reason,
        )

        result.payment.refresh_from_db()

        return _json_success(
            {
                "payment": _serialize_payment(result.payment),
                "transition": {
                    "status_before": result.status_before,
                    "status_after": result.status_after,
                },
                "cancel": {
                    "reason": reason or None,
                    "cancelled_at": _iso_datetime(_safe_attr(result.payment, "cancelled_at", None)),
                },
            },
            message="تم إلغاء الدفعة بنجاح.",
        )

    except ValidationError as exc:
        logger.warning(
            "Invalid payment cancel request %s: %s",
            payment_id,
            exc,
        )
        return _json_error(
            "بيانات الطلب غير صحيحة.",
            status=400,
            errors=getattr(exc, "message_dict", None) or getattr(exc, "messages", None) or str(exc),
        )

    except PaymentServiceError as exc:
        logger.warning(
            "Payment cancel validation failed %s: %s",
            payment_id,
            exc,
        )
        return _json_error(str(exc), status=400)

    except Exception as exc:
        logger.exception("Failed to cancel payment %s: %s", payment_id, exc)
        return _json_error("تعذر إلغاء الدفعة.", status=500)