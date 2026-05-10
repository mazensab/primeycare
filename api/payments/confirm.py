# ============================================================
# 📂 api/payments/confirm.py
# 🧠 Confirm Payment API — Primey Care V2
# ------------------------------------------------------------
# ✅ تأكيد الدفعة
# ✅ يستدعي payments.services.confirm_payment الرسمي فقط
# ✅ لا يعدّل حالة الدفع مباشرة داخل API
# ✅ تمرير paid_amount عند الحاجة
# ✅ تمرير مراجع البنك / البوابة
# ✅ جدولة الخزينة والمحاسبة بعد commit
# ✅ متوافق مع Accounting + Treasury Backend الجديد
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

from payments.services import PaymentServiceError, confirm_payment


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


def _parse_decimal(value: Any, field_name: str = "paid_amount") -> Decimal | None:
    if value in (None, ""):
        return None

    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValidationError({field_name: "القيمة المالية غير صحيحة."}) from exc

    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _as_bool(value: Any, default: bool = True) -> bool:
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


def _serialize_confirmed_payment(payment) -> dict[str, Any]:
    return {
        "id": payment.pk,
        "payment_number": payment.payment_number,
        "status": payment.status,
        "amount": payment.amount,
        "paid_amount": payment.paid_amount,
        "refunded_amount": payment.refunded_amount,
        "currency": payment.currency,
        "invoice_id": payment.invoice_id,
        "invoice": _serialize_invoice(_safe_attr(payment, "invoice", None)),
        "order_id": payment.order_id,
        "order": _serialize_order(_safe_attr(payment, "order", None)),
        "customer_id": payment.customer_id,
        "customer": _serialize_customer(_safe_attr(payment, "customer", None)),
        "payment_method": payment.payment_method,
        "provider": payment.provider,
        "external_reference": payment.external_reference,
        "transaction_id": payment.transaction_id,
        "gateway_response_code": _safe_attr(payment, "gateway_response_code", ""),
        "gateway_message": _safe_attr(payment, "gateway_message", ""),
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


def _serialize_result_flags(result) -> dict[str, Any]:
    return {
        "status_before": _safe_attr(result, "status_before", None),
        "status_after": _safe_attr(result, "status_after", None),
        "treasury": {
            "requested": bool(_safe_attr(result, "treasury_requested", False)),
            "dispatched": bool(_safe_attr(result, "treasury_dispatched", False)),
            "message": _safe_attr(result, "treasury_message", ""),
        },
        "accounting": {
            "requested": bool(_safe_attr(result, "accounting_post_requested", False)),
            "dispatched": bool(_safe_attr(result, "accounting_post_dispatched", False)),
            "message": _safe_attr(result, "accounting_post_message", ""),
        },
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
def confirm_payment_api(request, payment_id: int):
    """
    تأكيد الدفعة رسميًا.

    Body اختياري:
    {
      "paid_amount": "115.00",
      "external_reference": "BANK-REF-001",
      "transaction_id": "TXN-001",
      "gateway_response_code": "APPROVED",
      "gateway_message": "Payment approved",
      "auto_create_treasury_movement": true,
      "auto_post_accounting": true
    }
    """
    try:
        Payment = _resolve_payment_model()
        body = _parse_json_body(request)

        payment = _build_payment_queryset(Payment, request).filter(pk=payment_id).first()

        if not payment:
            return _json_error("الدفعة غير موجودة.", status=404)

        paid_amount = _parse_decimal(body.get("paid_amount"), "paid_amount")

        result = confirm_payment(
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

        result.payment.refresh_from_db()

        flags = _serialize_result_flags(result)

        return _json_success(
            {
                "payment": _serialize_confirmed_payment(result.payment),
                "status_before": flags["status_before"],
                "status_after": flags["status_after"],
                "treasury": flags["treasury"],
                "accounting": flags["accounting"],
            },
            message="تم تأكيد الدفعة بنجاح.",
        )

    except ValidationError as exc:
        logger.warning(
            "Invalid payment confirmation request %s: %s",
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
            "Payment confirmation validation failed %s: %s",
            payment_id,
            exc,
        )
        return _json_error(str(exc), status=400)

    except Exception as exc:
        logger.exception("Failed to confirm payment %s: %s", payment_id, exc)
        return _json_error("تعذر تأكيد الدفعة.", status=500)