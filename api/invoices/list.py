# ============================================================
# 📂 api/invoices/list.py
# 🧠 Invoices API List — Primey Care V2
# ------------------------------------------------------------
# ✅ قائمة الفواتير
# ✅ فلاتر حسب الحالة / العميل / الطلب / التاريخ / البحث
# ✅ Summary مالي للقائمة الحالية
# ✅ Pagination موحد
# ✅ إظهار حالة ومراجع الترحيل المحاسبي
# ✅ Unified response: ok / success / data / results
# ✅ Compatible with Accounting / Payments / Treasury flow
# ============================================================

from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.apps import apps
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import Count, Q, Sum
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


def _apply_company_scope(queryset, company_id: int | None):
    if not company_id:
        return queryset

    model_fields = _model_field_names(queryset.model)

    if "company" in model_fields:
        return queryset.filter(company_id=company_id)

    return queryset


def _clean_str(value: Any, default: str = "") -> str:
    if value is None:
        return default

    cleaned = str(value).strip()
    return cleaned if cleaned else default


def _to_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _to_bool(value: Any, default: bool | None = None) -> bool | None:
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
        or str(obj)
    )


def _parse_pagination(request) -> tuple[int, int]:
    page = max(_to_int(request.GET.get("page"), 1), 1)
    page_size = min(max(_to_int(request.GET.get("page_size") or request.GET.get("limit"), 50), 1), 200)

    if request.GET.get("offset") and not request.GET.get("page"):
        offset = max(_to_int(request.GET.get("offset"), 0), 0)
        page = (offset // page_size) + 1

    return page, page_size


def _paginate(queryset, *, page: int, page_size: int) -> dict[str, Any]:
    paginator = Paginator(queryset, page_size)
    current_page = paginator.get_page(page)
    offset = (current_page.number - 1) * page_size

    return {
        "items": list(current_page.object_list),
        "pagination": {
            "page": current_page.number,
            "page_size": page_size,
            "total_pages": paginator.num_pages,
            "total_items": paginator.count,
            "has_next": current_page.has_next(),
            "has_previous": current_page.has_previous(),
            "limit": page_size,
            "offset": offset,
            "next_offset": offset + page_size if current_page.has_next() else None,
        },
    }


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


def _serialize_invoice(invoice) -> dict[str, Any]:
    customer = _safe_attr(invoice, "customer", None)
    order = _safe_attr(invoice, "order", None)

    invoice_number = _safe_attr(invoice, "invoice_number", "") or f"INV-{invoice.pk}"

    return {
        "id": invoice.pk,
        "invoice_number": invoice_number,
        "number": invoice_number,
        "reference": invoice_number,

        "invoice_type": _safe_attr(invoice, "invoice_type", ""),
        "status": _safe_attr(invoice, "status", ""),

        "issue_date": _iso_datetime(_safe_attr(invoice, "issue_date", None)),
        "due_date": _iso_datetime(_safe_attr(invoice, "due_date", None)),

        "customer_id": _safe_attr(invoice, "customer_id", None),
        "customer": _serialize_customer(customer),
        "customer_name": _related_label(customer),

        "order_id": _safe_attr(invoice, "order_id", None),
        "order": _serialize_order(order),

        "subtotal": _money(_safe_attr(invoice, "subtotal", "0.00")),
        "discount_amount": _money(_safe_attr(invoice, "discount_amount", "0.00")),
        "taxable_amount": _money(_safe_attr(invoice, "taxable_amount", "0.00")),
        "tax_rate": _money(_safe_attr(invoice, "tax_rate", "0.00")),
        "tax_amount": _money(_safe_attr(invoice, "tax_amount", "0.00")),
        "total_amount": _money(_safe_attr(invoice, "total_amount", "0.00")),
        "paid_amount": _money(_safe_attr(invoice, "paid_amount", "0.00")),
        "due_amount": _money(_safe_attr(invoice, "due_amount", "0.00")),
        "currency": _safe_attr(invoice, "currency", "SAR") or "SAR",

        "notes": _safe_attr(invoice, "notes", "") or "",
        "internal_notes": _safe_attr(invoice, "internal_notes", "") or "",

        "accounting_entry_reference": _safe_attr(invoice, "accounting_entry_reference", ""),
        "is_accounting_posted": bool(_safe_attr(invoice, "is_accounting_posted", False)),

        "created_at": _iso_datetime(_safe_attr(invoice, "created_at", None)),
        "updated_at": _iso_datetime(_safe_attr(invoice, "updated_at", None)),

        "financial_flow": {
            "invoice_issued": _safe_attr(invoice, "status", "") not in {"DRAFT", "CANCELLED", ""},
            "accounting_posted": bool(_safe_attr(invoice, "is_accounting_posted", False)),
            "accounting_reference": _safe_attr(invoice, "accounting_entry_reference", ""),
            "is_paid": _money(_safe_attr(invoice, "due_amount", "0.00")) <= Decimal("0.00"),
            "has_due_amount": _money(_safe_attr(invoice, "due_amount", "0.00")) > Decimal("0.00"),
        },
    }


# ============================================================
# Query / Filters
# ============================================================

def _apply_filters(request, queryset):
    Invoice = queryset.model
    model_fields = _model_field_names(Invoice)

    status_filter = _clean_str(request.GET.get("status"))

    if status_filter and "status" in model_fields:
        queryset = queryset.filter(status=status_filter)

    invoice_type = _clean_str(request.GET.get("invoice_type"))

    if invoice_type and "invoice_type" in model_fields:
        queryset = queryset.filter(invoice_type=invoice_type)

    customer_id = _clean_str(request.GET.get("customer_id"))

    if customer_id and "customer" in model_fields:
        queryset = queryset.filter(customer_id=customer_id)

    order_id = _clean_str(request.GET.get("order_id"))

    if order_id and "order" in model_fields:
        queryset = queryset.filter(order_id=order_id)

    is_accounting_posted = _to_bool(request.GET.get("is_accounting_posted"), None)

    if is_accounting_posted is not None and "is_accounting_posted" in model_fields:
        queryset = queryset.filter(is_accounting_posted=is_accounting_posted)

    accounting_entry_reference = _clean_str(request.GET.get("accounting_entry_reference"))

    if accounting_entry_reference and "accounting_entry_reference" in model_fields:
        queryset = queryset.filter(accounting_entry_reference__icontains=accounting_entry_reference)

    date_from = _clean_str(request.GET.get("date_from"))

    if date_from and "issue_date" in model_fields:
        queryset = queryset.filter(issue_date__gte=date_from)

    date_to = _clean_str(request.GET.get("date_to"))

    if date_to and "issue_date" in model_fields:
        queryset = queryset.filter(issue_date__lte=date_to)

    created_from = _clean_str(request.GET.get("created_from"))

    if created_from and "created_at" in model_fields:
        queryset = queryset.filter(created_at__date__gte=created_from)

    created_to = _clean_str(request.GET.get("created_to"))

    if created_to and "created_at" in model_fields:
        queryset = queryset.filter(created_at__date__lte=created_to)

    search = _clean_str(request.GET.get("search") or request.GET.get("q"))

    if search:
        queryset = queryset.filter(
            Q(invoice_number__icontains=search)
            | Q(customer__customer_code__icontains=search)
            | Q(customer__display_name__icontains=search)
            | Q(customer__full_name__icontains=search)
            | Q(customer__name__icontains=search)
            | Q(customer__phone__icontains=search)
            | Q(customer__phone_number__icontains=search)
            | Q(customer__email__icontains=search)
            | Q(order__order_number__icontains=search)
            | Q(accounting_entry_reference__icontains=search)
            | Q(notes__icontains=search)
            | Q(internal_notes__icontains=search)
        )

    return queryset


def _filters_payload(request) -> dict[str, Any]:
    return {
        "status": request.GET.get("status") or "",
        "invoice_type": request.GET.get("invoice_type") or "",
        "customer_id": request.GET.get("customer_id") or "",
        "order_id": request.GET.get("order_id") or "",
        "is_accounting_posted": request.GET.get("is_accounting_posted") or "",
        "accounting_entry_reference": request.GET.get("accounting_entry_reference") or "",
        "date_from": request.GET.get("date_from") or "",
        "date_to": request.GET.get("date_to") or "",
        "created_from": request.GET.get("created_from") or "",
        "created_to": request.GET.get("created_to") or "",
        "q": request.GET.get("q") or request.GET.get("search") or "",
    }


# ============================================================
# Summary
# ============================================================

def _build_summary(queryset) -> dict[str, Any]:
    totals = queryset.aggregate(
        total_count=Count("id"),
        subtotal=Sum("subtotal"),
        discount_amount=Sum("discount_amount"),
        tax_amount=Sum("tax_amount"),
        total_amount=Sum("total_amount"),
        paid_amount=Sum("paid_amount"),
        due_amount=Sum("due_amount"),
        accounting_posted_count=Count("id", filter=Q(is_accounting_posted=True)),
        accounting_pending_count=Count("id", filter=Q(is_accounting_posted=False)),
    )

    status_breakdown = list(
        queryset
        .values("status")
        .annotate(
            count=Count("id"),
            total_amount=Sum("total_amount"),
            paid_amount=Sum("paid_amount"),
            due_amount=Sum("due_amount"),
        )
        .order_by("status")
    )

    type_breakdown = list(
        queryset
        .values("invoice_type")
        .annotate(
            count=Count("id"),
            total_amount=Sum("total_amount"),
            paid_amount=Sum("paid_amount"),
            due_amount=Sum("due_amount"),
        )
        .order_by("invoice_type")
    )

    return {
        "total_count": totals["total_count"] or 0,
        "subtotal": _money(totals.get("subtotal")),
        "discount_amount": _money(totals.get("discount_amount")),
        "tax_amount": _money(totals.get("tax_amount")),
        "total_amount": _money(totals.get("total_amount")),
        "paid_amount": _money(totals.get("paid_amount")),
        "due_amount": _money(totals.get("due_amount")),
        "accounting_posted_count": totals["accounting_posted_count"] or 0,
        "accounting_pending_count": totals["accounting_pending_count"] or 0,
        "currency": "SAR",
        "status_breakdown": [
            {
                "status": item["status"] or "",
                "count": item["count"] or 0,
                "total_amount": _money(item.get("total_amount")),
                "paid_amount": _money(item.get("paid_amount")),
                "due_amount": _money(item.get("due_amount")),
            }
            for item in status_breakdown
        ],
        "type_breakdown": [
            {
                "invoice_type": item["invoice_type"] or "",
                "count": item["count"] or 0,
                "total_amount": _money(item.get("total_amount")),
                "paid_amount": _money(item.get("paid_amount")),
                "due_amount": _money(item.get("due_amount")),
            }
            for item in type_breakdown
        ],
    }


# ============================================================
# API
# ============================================================

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

        page, page_size = _parse_pagination(request)
        paginated = _paginate(queryset, page=page, page_size=page_size)

        items = [_serialize_invoice(item) for item in paginated["items"]]
        pagination = paginated["pagination"]
        summary = _build_summary(queryset)

        return _json_success(
            {
                "items": items,
                "results": items,
                "summary": summary,
                "pagination": pagination,
                "filters": _filters_payload(request),
            },
            message="Invoices loaded successfully.",
            extra={
                # توافق خلفي مع الفرونت القديم
                "count": len(items),
                "total_count": pagination["total_items"],
                "page": pagination["page"],
                "page_size": pagination["page_size"],
                "has_next": pagination["has_next"],
                "has_previous": pagination["has_previous"],
                "summary": summary,
                "results": items,
            },
        )

    except Exception as exc:
        logger.exception("Failed to fetch invoice list: %s", exc)
        return _json_error("تعذر جلب قائمة الفواتير.", status=500)