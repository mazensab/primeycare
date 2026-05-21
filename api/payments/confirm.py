# ============================================================
# 📂 api/payments/confirm.py
# 🧠 Confirm Payment API — Primey Care V2.1
# ------------------------------------------------------------
# ✅ تأكيد الدفعة
# ✅ يستدعي payments.services.confirm_payment الرسمي فقط
# ✅ لا يعدّل حالة الدفع مباشرة داخل API
# ✅ تمرير paid_amount عند الحاجة
# ✅ تمرير مراجع البنك / البوابة
# ✅ جدولة الخزينة والمحاسبة بعد commit
# ✅ يعرض بيانات العميل وحساب العميل بعد OTP
# ✅ يعرض الطلب والفاتورة بعد مزامنة الدفع
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


def _serialize_confirmed_payment(payment) -> dict[str, Any]:
    invoice = _safe_attr(payment, "invoice", None)
    order = _safe_attr(payment, "order", None)
    customer = _safe_attr(payment, "customer", None)

    return {
        "id": payment.pk,
        "payment_number": _safe_attr(payment, "payment_number", ""),
        "reference": _safe_attr(payment, "payment_number", "") or f"PAY-{payment.pk}",
        "status": _safe_attr(payment, "status", ""),
        "amount": _money(_safe_attr(payment, "amount", "0.00")),
        "paid_amount": _money(_safe_attr(payment, "paid_amount", "0.00")),
        "refunded_amount": _money(_safe_attr(payment, "refunded_amount", "0.00")),
        "remaining_amount": _money(_safe_attr(payment, "remaining_amount", "0.00")),
        "net_collected_amount": _money(_safe_attr(payment, "net_collected_amount", "0.00")),
        "currency": _safe_attr(payment, "currency", "SAR") or "SAR",

        "invoice_id": _safe_attr(payment, "invoice_id", None),
        "invoice": _serialize_invoice(invoice),

        "order_id": _safe_attr(payment, "order_id", None),
        "order": _serialize_order(order),

        "customer_id": _safe_attr(payment, "customer_id", None),
        "customer": _serialize_customer(customer),
        "customer_name": _label(customer),

        "payment_method": _safe_attr(payment, "payment_method", ""),
        "provider": _safe_attr(payment, "provider", ""),

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
        "cancelled_at": _iso_datetime(_safe_attr(payment, "cancelled_at", None)),
        "created_at": _iso_datetime(_safe_attr(payment, "created_at", None)),
        "updated_at": _iso_datetime(_safe_attr(payment, "updated_at", None)),

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

        # إعادة قراءة العلاقات بعد confirm لأن service يزامن الفاتورة والطلب.
        confirmed_payment = _build_payment_queryset(Payment, request).filter(pk=result.payment.pk).first()
        if confirmed_payment:
            result.payment = confirmed_payment

        serialized_payment = _serialize_confirmed_payment(result.payment)
        flags = _serialize_result_flags(result)

        return _json_success(
            {
                "payment": serialized_payment,
                "customer": serialized_payment.get("customer"),
                "order": serialized_payment.get("order"),
                "invoice": serialized_payment.get("invoice"),
                "status_before": flags["status_before"],
                "status_after": flags["status_after"],
                "treasury": flags["treasury"],
                "accounting": flags["accounting"],
                "financial_flow": serialized_payment.get("financial_flow"),
            },
            message="تم تأكيد الدفعة بنجاح.",
            extra={
                # توافق خلفي مع أي صفحة تقرأ payment من الجذر
                "payment": serialized_payment,
            },
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