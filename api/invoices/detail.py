# ============================================================
# 📂 api/invoices/detail.py
# 🧠 Invoice Detail API — Primey Care
# ------------------------------------------------------------
# ✅ تفاصيل الفاتورة
# ✅ عناصر الفاتورة
# ✅ المدفوعات المرتبطة
# ✅ بيانات الطلب والعميل
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


def _resolve_invoice_model():
    try:
        return apps.get_model("invoices", "Invoice")
    except LookupError as exc:
        raise LookupError("Invoice model was not found in invoices app.") from exc


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


def _model_field_names(model) -> set[str]:
    return {field.name for field in model._meta.fields}


def _decimal_to_str(value) -> str:
    try:
        return str(Decimal(str(value or "0.00")).quantize(Decimal("0.01")))
    except Exception:
        return "0.00"


def _date_to_iso(value) -> str | None:
    return value.isoformat() if value else None


def _datetime_to_iso(value) -> str | None:
    return value.isoformat() if value else None


def _serialize_customer(customer) -> dict[str, Any] | None:
    if not customer:
        return None

    return {
        "id": getattr(customer, "id", None),
        "name": getattr(customer, "name", "") or "",
        "phone": getattr(customer, "phone", "") or "",
        "email": getattr(customer, "email", "") or "",
    }


def _serialize_order(order) -> dict[str, Any] | None:
    if not order:
        return None

    return {
        "id": getattr(order, "id", None),
        "order_number": (
            getattr(order, "order_number", None)
            or getattr(order, "number", None)
            or f"ORD-{getattr(order, 'id', '')}"
        ),
        "status": getattr(order, "status", None),
        "payment_status": getattr(order, "payment_status", None),
        "fulfillment_status": getattr(order, "fulfillment_status", None),
        "total_amount": _decimal_to_str(getattr(order, "total_amount", None)),
    }


def _serialize_invoice_item(item) -> dict[str, Any]:
    return {
        "id": item.pk,
        "order_item_id": getattr(item, "order_item_id", None),
        "title": getattr(item, "title", "") or "",
        "quantity": getattr(item, "quantity", 1) or 1,
        "unit_price": _decimal_to_str(getattr(item, "unit_price", None)),
        "discount_amount": _decimal_to_str(getattr(item, "discount_amount", None)),
        "line_total": _decimal_to_str(getattr(item, "line_total", None)),
        "sort_order": getattr(item, "sort_order", 0) or 0,
    }


def _serialize_invoice_payment(link) -> dict[str, Any]:
    payment = getattr(link, "payment", None)

    return {
        "id": link.pk,
        "payment_id": getattr(link, "payment_id", None),
        "payment_number": (
            getattr(payment, "payment_number", None)
            or getattr(payment, "number", None)
            or f"PAY-{getattr(payment, 'id', '')}"
            if payment
            else None
        ),
        "amount_applied": _decimal_to_str(getattr(link, "amount_applied", None)),
        "applied_at": _datetime_to_iso(getattr(link, "applied_at", None)),
        "notes": getattr(link, "notes", "") or "",
    }


def _serialize_invoice(invoice) -> dict[str, Any]:
    customer = getattr(invoice, "customer", None)
    order = getattr(invoice, "order", None)

    items = []
    if hasattr(invoice, "items"):
        items = [_serialize_invoice_item(item) for item in invoice.items.all().order_by("sort_order", "id")]

    payments = []
    if hasattr(invoice, "invoice_payments"):
        payments = [
            _serialize_invoice_payment(link)
            for link in invoice.invoice_payments.select_related("payment").all().order_by("-applied_at", "-id")
        ]

    return {
        "id": invoice.pk,
        "invoice_number": getattr(invoice, "invoice_number", None) or f"INV-{invoice.pk}",
        "number": getattr(invoice, "invoice_number", None) or f"INV-{invoice.pk}",
        "invoice_type": getattr(invoice, "invoice_type", None),
        "status": getattr(invoice, "status", None),
        "issue_date": _date_to_iso(getattr(invoice, "issue_date", None)),
        "due_date": _date_to_iso(getattr(invoice, "due_date", None)),
        "customer_id": getattr(invoice, "customer_id", None),
        "order_id": getattr(invoice, "order_id", None),
        "customer": _serialize_customer(customer),
        "order": _serialize_order(order),
        "items": items,
        "payments": payments,
        "subtotal": _decimal_to_str(getattr(invoice, "subtotal", None)),
        "discount_amount": _decimal_to_str(getattr(invoice, "discount_amount", None)),
        "taxable_amount": _decimal_to_str(getattr(invoice, "taxable_amount", None)),
        "tax_rate": _decimal_to_str(getattr(invoice, "tax_rate", None)),
        "tax_amount": _decimal_to_str(getattr(invoice, "tax_amount", None)),
        "total_amount": _decimal_to_str(getattr(invoice, "total_amount", None)),
        "paid_amount": _decimal_to_str(getattr(invoice, "paid_amount", None)),
        "due_amount": _decimal_to_str(getattr(invoice, "due_amount", None)),
        "currency": getattr(invoice, "currency", "SAR") or "SAR",
        "notes": getattr(invoice, "notes", "") or "",
        "internal_notes": getattr(invoice, "internal_notes", "") or "",
        "created_at": _datetime_to_iso(getattr(invoice, "created_at", None)),
        "updated_at": _datetime_to_iso(getattr(invoice, "updated_at", None)),
    }


@login_required
@require_GET
def invoice_detail_api(request, invoice_id: int):
    try:
        Invoice = _resolve_invoice_model()
        company_id = _extract_company_id(request)

        queryset = (
            Invoice.objects.select_related("customer", "order")
            .prefetch_related("items", "invoice_payments")
            .all()
        )

        model_fields = _model_field_names(Invoice)
        if company_id and "company" in model_fields:
            queryset = queryset.filter(company_id=company_id)

        invoice = queryset.filter(pk=invoice_id).first()
        if not invoice:
            return _json_error("الفاتورة غير موجودة.", status=404)

        return _json_success({"invoice": _serialize_invoice(invoice)})

    except Exception as exc:
        logger.exception("Failed to fetch invoice detail: %s", exc)
        return _json_error("تعذر جلب تفاصيل الفاتورة.", status=500)