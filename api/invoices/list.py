# ============================================================
# 📂 api/invoices/list.py
# 🧠 Invoices API List — Primey Care
# ------------------------------------------------------------
# ✅ قائمة الفواتير
# ✅ فلاتر حسب الحالة / العميل / الطلب / التاريخ / البحث
# ✅ Pagination بسيط
# ✅ Summary مالي للقائمة الحالية
# ✅ متوافق مع Frontend API Layer
# ============================================================

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

from django.apps import apps
from django.contrib.auth.decorators import login_required
from django.db.models import Q, Sum
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


def _apply_company_scope(queryset, company_id: int | None):
    if not company_id:
        return queryset

    model_fields = _model_field_names(queryset.model)
    if "company" in model_fields:
        return queryset.filter(company_id=company_id)

    return queryset


def _decimal_to_str(value) -> str:
    try:
        return str(Decimal(str(value or "0.00")).quantize(Decimal("0.01")))
    except Exception:
        return "0.00"


def _date_to_iso(value) -> str | None:
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
    }


def _serialize_invoice(invoice) -> dict[str, Any]:
    customer = getattr(invoice, "customer", None)
    order = getattr(invoice, "order", None)

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
        "created_at": (
            getattr(invoice, "created_at", None).isoformat()
            if getattr(invoice, "created_at", None)
            else None
        ),
        "updated_at": (
            getattr(invoice, "updated_at", None).isoformat()
            if getattr(invoice, "updated_at", None)
            else None
        ),
    }


def _apply_filters(request, queryset):
    Invoice = queryset.model
    model_fields = _model_field_names(Invoice)

    status_filter = request.GET.get("status")
    if status_filter and "status" in model_fields:
        queryset = queryset.filter(status=status_filter)

    invoice_type = request.GET.get("invoice_type")
    if invoice_type and "invoice_type" in model_fields:
        queryset = queryset.filter(invoice_type=invoice_type)

    customer_id = request.GET.get("customer_id")
    if customer_id and "customer" in model_fields:
        queryset = queryset.filter(customer_id=customer_id)

    order_id = request.GET.get("order_id")
    if order_id and "order" in model_fields:
        queryset = queryset.filter(order_id=order_id)

    date_from = request.GET.get("date_from")
    if date_from and "issue_date" in model_fields:
        queryset = queryset.filter(issue_date__gte=date_from)

    date_to = request.GET.get("date_to")
    if date_to and "issue_date" in model_fields:
        queryset = queryset.filter(issue_date__lte=date_to)

    search = (request.GET.get("search") or request.GET.get("q") or "").strip()
    if search:
        queryset = queryset.filter(
            Q(invoice_number__icontains=search)
            | Q(customer__name__icontains=search)
            | Q(customer__phone__icontains=search)
            | Q(customer__email__icontains=search)
            | Q(notes__icontains=search)
            | Q(internal_notes__icontains=search)
        )

    return queryset


def _parse_pagination(request) -> tuple[int, int]:
    try:
        page = max(1, int(request.GET.get("page", "1")))
    except ValueError:
        page = 1

    try:
        page_size = max(1, min(int(request.GET.get("page_size", request.GET.get("limit", "50"))), 200))
    except ValueError:
        page_size = 50

    return page, page_size


@login_required
@require_GET
def invoice_list_api(request):
    try:
        Invoice = _resolve_invoice_model()
        company_id = _extract_company_id(request)

        queryset = (
            Invoice.objects.select_related("customer", "order")
            .all()
            .order_by("-created_at", "-id")
        )

        queryset = _apply_company_scope(queryset, company_id)
        queryset = _apply_filters(request, queryset)

        total_count = queryset.count()

        summary = queryset.aggregate(
            subtotal=Sum("subtotal"),
            discount_amount=Sum("discount_amount"),
            tax_amount=Sum("tax_amount"),
            total_amount=Sum("total_amount"),
            paid_amount=Sum("paid_amount"),
            due_amount=Sum("due_amount"),
        )

        page, page_size = _parse_pagination(request)
        start = (page - 1) * page_size
        end = start + page_size

        invoices = list(queryset[start:end])
        results = [_serialize_invoice(item) for item in invoices]

        return _json_success(
            {
                "count": len(results),
                "total_count": total_count,
                "page": page,
                "page_size": page_size,
                "has_next": end < total_count,
                "has_previous": page > 1,
                "summary": {
                    "subtotal": _decimal_to_str(summary.get("subtotal")),
                    "discount_amount": _decimal_to_str(summary.get("discount_amount")),
                    "tax_amount": _decimal_to_str(summary.get("tax_amount")),
                    "total_amount": _decimal_to_str(summary.get("total_amount")),
                    "paid_amount": _decimal_to_str(summary.get("paid_amount")),
                    "due_amount": _decimal_to_str(summary.get("due_amount")),
                    "currency": "SAR",
                },
                "results": results,
            }
        )

    except Exception as exc:
        logger.exception("Failed to fetch invoice list: %s", exc)
        return _json_error("تعذر جلب قائمة الفواتير.", status=500)