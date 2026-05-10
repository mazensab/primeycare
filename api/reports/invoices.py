# ============================================================
# 📂 api/reports/invoices.py
# 🧠 Primey Care | Invoices Central Report API V2
# ------------------------------------------------------------
# ✅ Invoices overview
# ✅ Total / paid / due / tax / discount totals
# ✅ Accounting posting summary
# ✅ Breakdowns by status / type / accounting posting
# ✅ Latest invoices rows
# ✅ Compatible with rebuilt Invoices + Accounting + Payments flow
# ============================================================

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.db.models import Count, Sum
from django.views.decorators.http import require_GET

from ._utils import (
    apply_date_filters,
    apply_exact_filter,
    common_filters_from_request,
    get_base_queryset,
    json_success,
    normalize_money,
    report_meta,
    safe_count,
    safe_group_count,
)


# ============================================================
# Safe Helpers
# ============================================================

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


def _normalize_money(value: Any) -> str:
    return normalize_money(_money(value))


def _field_names(model) -> set[str]:
    if not model:
        return set()

    try:
        return {field.name for field in model._meta.fields}
    except Exception:
        return set()


def _safe_attr(obj: Any, attr_name: str, default: Any = None) -> Any:
    try:
        return getattr(obj, attr_name, default)
    except Exception:
        return default


def _safe_iso(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _safe_sum_field(queryset, *field_names: str) -> Decimal:
    if queryset is None:
        return Decimal("0.00")

    model_fields = _field_names(queryset.model)

    for field_name in field_names:
        if field_name not in model_fields:
            continue

        try:
            return _money(queryset.aggregate(total=Sum(field_name)).get("total"))
        except Exception:
            continue

    return Decimal("0.00")


def _safe_count_filter(queryset, **filters) -> int:
    if queryset is None:
        return 0

    try:
        return int(queryset.filter(**filters).count() or 0)
    except Exception:
        return 0


def _percentage(part: Any, total: Any) -> str:
    total_value = Decimal(str(total or 0))

    if total_value <= Decimal("0"):
        return "0.00"

    return _normalize_money(Decimal(str(part or 0)) * Decimal("100.00") / total_value)


def _related_name(obj: Any) -> str:
    if not obj:
        return ""

    return (
        _safe_attr(obj, "display_name", "")
        or _safe_attr(obj, "full_name", "")
        or _safe_attr(obj, "name", "")
        or _safe_attr(obj, "title", "")
        or str(obj)
    )


def _safe_group_sum(queryset, group_field: str, sum_fields: list[str], limit: int = 30) -> list[dict[str, Any]]:
    if queryset is None:
        return []

    model_fields = _field_names(queryset.model)

    if group_field not in model_fields:
        return []

    annotations = {"count": Count("id")}

    for sum_field in sum_fields:
        if sum_field in model_fields:
            annotations[sum_field] = Sum(sum_field)

    try:
        rows = (
            queryset
            .values(group_field)
            .annotate(**annotations)
            .order_by(group_field)[:limit]
        )
    except Exception:
        return []

    result: list[dict[str, Any]] = []

    for row in rows:
        item = {
            group_field: row.get(group_field) or "",
            "count": row.get("count") or 0,
        }

        for sum_field in sum_fields:
            item[sum_field] = _normalize_money(row.get(sum_field))

        result.append(item)

    return result


# ============================================================
# Query
# ============================================================

def _invoices_queryset(filters: dict[str, Any]):
    queryset = get_base_queryset("invoices", "Invoice")

    if queryset is None:
        return None

    model = queryset.model
    model_fields = _field_names(model)

    queryset = apply_date_filters(
        queryset,
        model,
        filters.get("date_from"),
        filters.get("date_to"),
    )

    queryset = apply_exact_filter(queryset, model, "status", filters.get("status"))
    queryset = apply_exact_filter(queryset, model, "invoice_type", filters.get("invoice_type"))

    customer_id = filters.get("customer_id")
    if customer_id and "customer" in model_fields:
        queryset = queryset.filter(customer_id=customer_id)

    order_id = filters.get("order_id")
    if order_id and "order" in model_fields:
        queryset = queryset.filter(order_id=order_id)

    if filters.get("is_accounting_posted") not in (None, "") and "is_accounting_posted" in model_fields:
        value = str(filters.get("is_accounting_posted")).lower() in {"1", "true", "yes", "on"}
        queryset = queryset.filter(is_accounting_posted=value)

    return queryset


# ============================================================
# Builders
# ============================================================

def _build_summary(queryset) -> dict[str, Any]:
    if queryset is None:
        return {
            "total_invoices": 0,
            "subtotal": "0.00",
            "discount_amount": "0.00",
            "tax_amount": "0.00",
            "total_amount": "0.00",
            "paid_amount": "0.00",
            "due_amount": "0.00",
            "remaining_amount": "0.00",
            "accounting_posted_count": 0,
            "accounting_pending_count": 0,
            "paid_invoices_count": 0,
            "unpaid_invoices_count": 0,
            "collection_rate": "0.00",
            "due_rate": "0.00",
            "accounting_posting_rate": "0.00",
            "currency": "SAR",
        }

    model_fields = _field_names(queryset.model)

    total_invoices = safe_count(queryset)
    subtotal = _safe_sum_field(queryset, "subtotal", "amount")
    discount_amount = _safe_sum_field(queryset, "discount_amount")
    taxable_amount = _safe_sum_field(queryset, "taxable_amount")
    tax_amount = _safe_sum_field(queryset, "tax_amount", "vat_amount", "total_tax")
    total_amount = _safe_sum_field(queryset, "total_amount", "grand_total", "amount", "net_amount")
    paid_amount = _safe_sum_field(queryset, "paid_amount", "amount_paid", "collected_amount")

    if "due_amount" in model_fields:
        due_amount = _safe_sum_field(queryset, "due_amount")
    else:
        due_amount = _money(total_amount - paid_amount)

    accounting_posted_count = (
        _safe_count_filter(queryset, is_accounting_posted=True)
        if "is_accounting_posted" in model_fields
        else 0
    )
    accounting_pending_count = (
        _safe_count_filter(queryset, is_accounting_posted=False)
        if "is_accounting_posted" in model_fields
        else 0
    )

    paid_invoices_count = (
        _safe_count_filter(queryset, due_amount__lte=0)
        if "due_amount" in model_fields
        else 0
    )
    unpaid_invoices_count = (
        _safe_count_filter(queryset, due_amount__gt=0)
        if "due_amount" in model_fields
        else 0
    )

    return {
        "total_invoices": total_invoices,
        "subtotal": _normalize_money(subtotal),
        "discount_amount": _normalize_money(discount_amount),
        "taxable_amount": _normalize_money(taxable_amount),
        "tax_amount": _normalize_money(tax_amount),
        "total_amount": _normalize_money(total_amount),
        "paid_amount": _normalize_money(paid_amount),
        "due_amount": _normalize_money(due_amount),
        "remaining_amount": _normalize_money(due_amount),

        "accounting_posted_count": accounting_posted_count,
        "accounting_pending_count": accounting_pending_count,
        "paid_invoices_count": paid_invoices_count,
        "unpaid_invoices_count": unpaid_invoices_count,

        "collection_rate": _percentage(paid_amount, total_amount),
        "due_rate": _percentage(due_amount, total_amount),
        "accounting_posting_rate": _percentage(accounting_posted_count, total_invoices),

        "currency": "SAR",
    }


def _serialize_invoice_row(invoice: Any) -> dict[str, Any]:
    customer = _safe_attr(invoice, "customer", None)
    order = _safe_attr(invoice, "order", None)

    invoice_number = (
        _safe_attr(invoice, "invoice_number", "")
        or _safe_attr(invoice, "number", "")
        or f"INV-{_safe_attr(invoice, 'id', '')}"
    )

    total_amount = _money(
        _safe_attr(invoice, "total_amount", None)
        or _safe_attr(invoice, "grand_total", None)
        or _safe_attr(invoice, "amount", None)
    )
    paid_amount = _money(
        _safe_attr(invoice, "paid_amount", None)
        or _safe_attr(invoice, "amount_paid", None)
        or _safe_attr(invoice, "collected_amount", None)
    )
    due_amount = _money(
        _safe_attr(invoice, "due_amount", None)
        if _safe_attr(invoice, "due_amount", None) is not None
        else total_amount - paid_amount
    )

    return {
        "id": _safe_attr(invoice, "id", None),
        "invoice_number": invoice_number,
        "number": invoice_number,
        "reference": invoice_number,

        "status": _safe_attr(invoice, "status", ""),
        "invoice_type": _safe_attr(invoice, "invoice_type", ""),

        "customer_id": _safe_attr(invoice, "customer_id", None),
        "customer_name": _related_name(customer),

        "order_id": _safe_attr(invoice, "order_id", None),
        "order_number": _safe_attr(order, "order_number", "") if order else "",

        "issue_date": _safe_iso(_safe_attr(invoice, "issue_date", None)),
        "due_date": _safe_iso(_safe_attr(invoice, "due_date", None)),

        "subtotal": _normalize_money(_safe_attr(invoice, "subtotal", "0.00")),
        "discount_amount": _normalize_money(_safe_attr(invoice, "discount_amount", "0.00")),
        "tax_amount": _normalize_money(_safe_attr(invoice, "tax_amount", "0.00")),
        "total_amount": _normalize_money(total_amount),
        "paid_amount": _normalize_money(paid_amount),
        "due_amount": _normalize_money(due_amount),
        "currency": _safe_attr(invoice, "currency", "SAR") or "SAR",

        "is_accounting_posted": bool(_safe_attr(invoice, "is_accounting_posted", False)),
        "accounting_entry_reference": _safe_attr(invoice, "accounting_entry_reference", ""),

        "created_at": _safe_iso(_safe_attr(invoice, "created_at", None)),
    }


def _latest_rows(queryset, limit: int = 50) -> list[dict[str, Any]]:
    if queryset is None:
        return []

    try:
        queryset = queryset.select_related("customer", "order")
    except Exception:
        pass

    try:
        rows = list(queryset.order_by("-id")[:limit])
    except Exception:
        return []

    return [_serialize_invoice_row(invoice) for invoice in rows]


# ============================================================
# API
# ============================================================

@require_GET
def invoices_report(request):
    filters = common_filters_from_request(request)
    queryset = _invoices_queryset(filters)

    data = {
        "meta": report_meta("invoices", "تقرير الفواتير", "Invoices Report"),
        "filters": filters,
        "summary": _build_summary(queryset),
        "charts": {
            "by_status": safe_group_count(queryset, ["status", "invoice_status"]),
            "by_type": safe_group_count(queryset, ["invoice_type", "type"]),
            "by_accounting_posting": safe_group_count(queryset, ["is_accounting_posted"]),
        },
        "breakdowns": {
            "amount_by_status": _safe_group_sum(
                queryset,
                "status",
                ["subtotal", "discount_amount", "tax_amount", "total_amount", "paid_amount", "due_amount"],
            ),
            "amount_by_type": _safe_group_sum(
                queryset,
                "invoice_type",
                ["subtotal", "discount_amount", "tax_amount", "total_amount", "paid_amount", "due_amount"],
            ),
            "amount_by_accounting_posting": _safe_group_sum(
                queryset,
                "is_accounting_posted",
                ["total_amount", "paid_amount", "due_amount"],
            ),
        },
        "links": {
            "invoices": "/system/invoices/list",
            "invoice_reports": "/system/reports/invoices",
            "payments": "/system/payments/list",
            "accounting": "/system/accounting",
        },
        "rows": _latest_rows(queryset, limit=50),
    }

    return json_success(data)