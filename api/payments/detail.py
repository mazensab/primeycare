# ============================================================
# 📂 api/payments/detail.py
# 🧠 Payment Detail API — Primey Care
# ------------------------------------------------------------
# ✅ تفاصيل دفعة واحدة
# ✅ إظهار الربط مع الفاتورة / الطلب / العميل
# ✅ إظهار مراجع الخزينة والمحاسبة
# ============================================================

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

from django.apps import apps
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_GET

logger = logging.getLogger(__name__)


def _json_error(message: str, status: int = 400) -> JsonResponse:
    return JsonResponse({"ok": False, "message": message}, status=status)


def _json_success(data: dict[str, Any], status: int = 200) -> JsonResponse:
    payload = {"ok": True}
    payload.update(data)
    return JsonResponse(payload, status=status)


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
    try:
        return int(raw_value) if raw_value else None
    except (TypeError, ValueError):
        return None


def _decimal_to_str(value: Any) -> str:
    try:
        return str(Decimal(str(value or "0.00")))
    except Exception:
        return "0.00"


def _date_to_iso(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _related_label(obj: Any) -> str:
    if not obj:
        return ""

    return (
        getattr(obj, "name", None)
        or getattr(obj, "full_name", None)
        or getattr(obj, "title", None)
        or getattr(obj, "invoice_number", None)
        or getattr(obj, "order_number", None)
        or str(obj)
    )


def _serialize_related(payment) -> dict[str, Any]:
    invoice = getattr(payment, "invoice", None)
    order = getattr(payment, "order", None)
    customer = getattr(payment, "customer", None)

    return {
        "invoice": {
            "id": payment.invoice_id,
            "label": _related_label(invoice),
            "status": getattr(invoice, "status", None) if invoice else None,
            "total_amount": _decimal_to_str(
                getattr(invoice, "total_amount", None)
                or getattr(invoice, "grand_total", None)
                or getattr(invoice, "amount", None)
                if invoice
                else None
            ),
        }
        if invoice
        else None,
        "order": {
            "id": payment.order_id,
            "label": _related_label(order),
            "status": getattr(order, "status", None) if order else None,
        }
        if order
        else None,
        "customer": {
            "id": payment.customer_id,
            "name": _related_label(customer),
            "phone": getattr(customer, "phone", None) if customer else None,
            "email": getattr(customer, "email", None) if customer else None,
        }
        if customer
        else None,
    }


def _serialize_payment(payment) -> dict[str, Any]:
    data = {
        "id": payment.pk,
        "payment_number": payment.payment_number,
        "reference": payment.payment_number or f"PAY-{payment.pk}",
        "status": payment.status,
        "payment_method": payment.payment_method,
        "provider": payment.provider,
        "currency": payment.currency,
        "amount": _decimal_to_str(payment.amount),
        "paid_amount": _decimal_to_str(payment.paid_amount),
        "refunded_amount": _decimal_to_str(payment.refunded_amount),
        "remaining_amount": _decimal_to_str(getattr(payment, "remaining_amount", 0)),
        "net_collected_amount": _decimal_to_str(getattr(payment, "net_collected_amount", 0)),
        "invoice_id": payment.invoice_id,
        "order_id": payment.order_id,
        "customer_id": payment.customer_id,
        "external_reference": payment.external_reference,
        "transaction_id": payment.transaction_id,
        "gateway_response_code": payment.gateway_response_code,
        "gateway_message": payment.gateway_message,
        "treasury_movement_reference": payment.treasury_movement_reference,
        "accounting_entry_reference": payment.accounting_entry_reference,
        "is_treasury_posted": payment.is_treasury_posted,
        "is_accounting_posted": payment.is_accounting_posted,
        "notes": payment.notes,
        "failure_reason": payment.failure_reason,
        "initiated_at": _date_to_iso(payment.initiated_at),
        "paid_at": _date_to_iso(payment.paid_at),
        "refunded_at": _date_to_iso(payment.refunded_at),
        "cancelled_at": _date_to_iso(payment.cancelled_at),
        "created_at": _date_to_iso(payment.created_at),
        "updated_at": _date_to_iso(payment.updated_at),
    }

    data.update(_serialize_related(payment))
    return data


@login_required
@require_GET
def payment_detail_api(request, payment_id: int):
    try:
        Payment = _resolve_payment_model()
        company_id = _extract_company_id(request)

        queryset = Payment.objects.select_related(
            "invoice",
            "order",
            "customer",
        ).all()

        model_fields = {field.name for field in Payment._meta.fields}

        if company_id and "company" in model_fields:
            queryset = queryset.filter(company_id=company_id)

        payment = queryset.filter(pk=payment_id).first()
        if not payment:
            return _json_error("الدفعة غير موجودة.", status=404)

        return _json_success({"payment": _serialize_payment(payment)})

    except Exception as exc:
        logger.exception("Failed to fetch payment detail: %s", exc)
        return _json_error("تعذر جلب تفاصيل الدفعة.", status=500)