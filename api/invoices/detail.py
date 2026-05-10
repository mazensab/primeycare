# ============================================================
# 📂 api/invoices/detail.py
# 🧠 Invoice Detail API — Primey Care V2
# ------------------------------------------------------------
# ✅ تفاصيل الفاتورة
# ✅ عناصر الفاتورة
# ✅ المدفوعات المرتبطة
# ✅ بيانات الطلب والعميل
# ✅ إظهار مراجع وحالة الترحيل المحاسبي
# ✅ Unified response: ok / success / data
# ✅ Compatible with Accounting / Payments / Treasury flow
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

    if raw_value in {None, ""}:
        return None

    try:
        parsed = int(raw_value)
    except (TypeError, ValueError):
        return None

    return parsed if parsed > 0 else None


def _model_field_names(model) -> set[str]:
    return {field.name for field in model._meta.fields}


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


def _safe_attr(obj: Any, attr_name: str, default: Any = None) -> Any:
    try:
        return getattr(obj, attr_name, default)
    except Exception:
        return default


def _related_label(obj: Any) -> str:
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


def _safe_iter_related(manager: Any, *, order_by: tuple[str, ...] = ()) -> list[Any]:
    if not manager:
        return []

    try:
        queryset = manager.all()
        if order_by:
            queryset = queryset.order_by(*order_by)
        return list(queryset)
    except Exception:
        return []


# ============================================================
# Serializers
# ============================================================

def _serialize_customer(customer) -> dict[str, Any] | None:
    if not customer:
        return None

    return {
        "id": _safe_attr(customer, "id", None),
        "customer_code": _safe_attr(customer, "customer_code", ""),
        "name": _related_label(customer),
        "phone": (
            _safe_attr(customer, "phone_number", "")
            or _safe_attr(customer, "phone", "")
            or _safe_attr(customer, "mobile", "")
        ),
        "whatsapp": _safe_attr(customer, "whatsapp_number", ""),
        "email": _safe_attr(customer, "email", ""),
        "status": _safe_attr(customer, "status", ""),
    }


def _serialize_order(order) -> dict[str, Any] | None:
    if not order:
        return None

    return {
        "id": _safe_attr(order, "id", None),
        "label": _related_label(order),
        "order_number": (
            _safe_attr(order, "order_number", "")
            or _safe_attr(order, "number", "")
            or f"ORD-{_safe_attr(order, 'id', '')}"
        ),
        "status": _safe_attr(order, "status", ""),
        "payment_status": _safe_attr(order, "payment_status", ""),
        "fulfillment_status": _safe_attr(order, "fulfillment_status", ""),
        "total_amount": _money(_safe_attr(order, "total_amount", "0.00")),
        "amount_paid": _money(_safe_attr(order, "amount_paid", "0.00")),
        "remaining_amount": _money(_safe_attr(order, "remaining_amount", "0.00")),
        "currency_code": _safe_attr(order, "currency_code", "SAR") or "SAR",
    }


def _serialize_invoice_item(item) -> dict[str, Any]:
    return {
        "id": _safe_attr(item, "pk", None),
        "order_item_id": _safe_attr(item, "order_item_id", None),
        "title": _safe_attr(item, "title", "") or _safe_attr(item, "description", ""),
        "description": _safe_attr(item, "description", "") or _safe_attr(item, "title", ""),
        "quantity": _safe_attr(item, "quantity", 1) or 1,
        "unit_price": _money(_safe_attr(item, "unit_price", "0.00")),
        "discount_amount": _money(_safe_attr(item, "discount_amount", "0.00")),
        "tax_amount": _money(_safe_attr(item, "tax_amount", "0.00")),
        "line_total": _money(
            _safe_attr(item, "line_total", None)
            or _safe_attr(item, "total_amount", None)
            or "0.00"
        ),
        "sort_order": _safe_attr(item, "sort_order", 0) or 0,
    }


def _serialize_invoice_payment(link) -> dict[str, Any]:
    payment = _safe_attr(link, "payment", None)

    payment_number = (
        _safe_attr(payment, "payment_number", "")
        or _safe_attr(payment, "number", "")
        or f"PAY-{_safe_attr(payment, 'id', '')}"
        if payment
        else ""
    )

    return {
        "id": _safe_attr(link, "pk", None),
        "payment_id": _safe_attr(link, "payment_id", None),
        "payment_number": payment_number,
        "payment_status": _safe_attr(payment, "status", "") if payment else "",
        "payment_method": _safe_attr(payment, "payment_method", "") if payment else "",
        "provider": _safe_attr(payment, "provider", "") if payment else "",
        "amount_applied": _money(_safe_attr(link, "amount_applied", "0.00")),
        "paid_amount": _money(_safe_attr(payment, "paid_amount", "0.00")) if payment else Decimal("0.00"),
        "external_reference": _safe_attr(payment, "external_reference", "") if payment else "",
        "transaction_id": _safe_attr(payment, "transaction_id", "") if payment else "",
        "treasury_movement_reference": _safe_attr(payment, "treasury_movement_reference", "") if payment else "",
        "accounting_entry_reference": _safe_attr(payment, "accounting_entry_reference", "") if payment else "",
        "is_treasury_posted": bool(_safe_attr(payment, "is_treasury_posted", False)) if payment else False,
        "is_accounting_posted": bool(_safe_attr(payment, "is_accounting_posted", False)) if payment else False,
        "applied_at": _iso_datetime(_safe_attr(link, "applied_at", None)),
        "notes": _safe_attr(link, "notes", "") or "",
    }


def _serialize_invoice(invoice) -> dict[str, Any]:
    customer = _safe_attr(invoice, "customer", None)
    order = _safe_attr(invoice, "order", None)

    items = []
    if hasattr(invoice, "items"):
        items = [
            _serialize_invoice_item(item)
            for item in _safe_iter_related(
                invoice.items,
                order_by=("sort_order", "id"),
            )
        ]

    payments = []
    if hasattr(invoice, "invoice_payments"):
        payments = [
            _serialize_invoice_payment(link)
            for link in _safe_iter_related(
                invoice.invoice_payments.select_related("payment"),
                order_by=("-applied_at", "-id"),
            )
        ]

    invoice_number = _safe_attr(invoice, "invoice_number", "") or f"INV-{invoice.pk}"
    due_amount = _money(_safe_attr(invoice, "due_amount", "0.00"))
    status_value = _safe_attr(invoice, "status", "")

    return {
        "id": invoice.pk,
        "invoice_number": invoice_number,
        "number": invoice_number,
        "reference": invoice_number,

        "invoice_type": _safe_attr(invoice, "invoice_type", ""),
        "status": status_value,

        "issue_date": _iso_datetime(_safe_attr(invoice, "issue_date", None)),
        "due_date": _iso_datetime(_safe_attr(invoice, "due_date", None)),

        "customer_id": _safe_attr(invoice, "customer_id", None),
        "customer": _serialize_customer(customer),
        "customer_name": _related_label(customer),

        "order_id": _safe_attr(invoice, "order_id", None),
        "order": _serialize_order(order),

        "items": items,
        "payments": payments,

        "subtotal": _money(_safe_attr(invoice, "subtotal", "0.00")),
        "discount_amount": _money(_safe_attr(invoice, "discount_amount", "0.00")),
        "taxable_amount": _money(_safe_attr(invoice, "taxable_amount", "0.00")),
        "tax_rate": _money(_safe_attr(invoice, "tax_rate", "0.00")),
        "tax_amount": _money(_safe_attr(invoice, "tax_amount", "0.00")),
        "total_amount": _money(_safe_attr(invoice, "total_amount", "0.00")),
        "paid_amount": _money(_safe_attr(invoice, "paid_amount", "0.00")),
        "due_amount": due_amount,
        "currency": _safe_attr(invoice, "currency", "SAR") or "SAR",

        "notes": _safe_attr(invoice, "notes", "") or "",
        "internal_notes": _safe_attr(invoice, "internal_notes", "") or "",

        "accounting_entry_reference": _safe_attr(invoice, "accounting_entry_reference", ""),
        "is_accounting_posted": bool(_safe_attr(invoice, "is_accounting_posted", False)),

        "created_at": _iso_datetime(_safe_attr(invoice, "created_at", None)),
        "updated_at": _iso_datetime(_safe_attr(invoice, "updated_at", None)),

        "financial_flow": {
            "invoice_issued": status_value not in {"DRAFT", "CANCELLED", ""},
            "accounting_posted": bool(_safe_attr(invoice, "is_accounting_posted", False)),
            "accounting_reference": _safe_attr(invoice, "accounting_entry_reference", ""),
            "is_paid": due_amount <= Decimal("0.00"),
            "has_due_amount": due_amount > Decimal("0.00"),
            "payments_count": len(payments),
            "items_count": len(items),
        },
    }


# ============================================================
# API
# ============================================================

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

        serialized_invoice = _serialize_invoice(invoice)

        return _json_success(
            {
                "invoice": serialized_invoice,
                "financial_flow": serialized_invoice["financial_flow"],
            },
            message="Invoice loaded successfully.",
            extra={
                # توافق خلفي مع أي صفحة تقرأ invoice من الجذر
                "invoice": serialized_invoice,
            },
        )

    except Exception as exc:
        logger.exception("Failed to fetch invoice detail: %s", exc)
        return _json_error("تعذر جلب تفاصيل الفاتورة.", status=500)