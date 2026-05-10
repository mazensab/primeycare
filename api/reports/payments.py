# ============================================================
# 📂 api/reports/payments.py
# 🧠 Primey Care | Payments Central Report API V2
# ------------------------------------------------------------
# ✅ Payments overview
# ✅ Amount / paid / refunded / net collected
# ✅ Accounting posting summary
# ✅ Treasury posting summary
# ✅ Gateway references summary
# ✅ Breakdowns by status / method / provider
# ✅ Latest payments rows
# ✅ Compatible with rebuilt Payments + Accounting + Treasury flow
# ============================================================

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.db.models import Count, Q, Sum
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

def _payments_queryset(filters: dict[str, Any]):
    queryset = get_base_queryset("payments", "Payment")

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
    queryset = apply_exact_filter(
        queryset,
        model,
        "payment_method",
        filters.get("payment_method"),
    )
    queryset = apply_exact_filter(queryset, model, "provider", filters.get("provider"))

    customer_id = filters.get("customer_id")
    if customer_id and "customer" in model_fields:
        queryset = queryset.filter(customer_id=customer_id)

    invoice_id = filters.get("invoice_id")
    if invoice_id and "invoice" in model_fields:
        queryset = queryset.filter(invoice_id=invoice_id)

    order_id = filters.get("order_id")
    if order_id and "order" in model_fields:
        queryset = queryset.filter(order_id=order_id)

    if filters.get("is_accounting_posted") not in (None, "") and "is_accounting_posted" in model_fields:
        value = str(filters.get("is_accounting_posted")).lower() in {"1", "true", "yes", "on"}
        queryset = queryset.filter(is_accounting_posted=value)

    if filters.get("is_treasury_posted") not in (None, "") and "is_treasury_posted" in model_fields:
        value = str(filters.get("is_treasury_posted")).lower() in {"1", "true", "yes", "on"}
        queryset = queryset.filter(is_treasury_posted=value)

    return queryset


# ============================================================
# Builders
# ============================================================

def _build_summary(queryset) -> dict[str, Any]:
    if queryset is None:
        return {
            "total_payments": 0,
            "total_amount": "0.00",
            "paid_amount": "0.00",
            "refunded_amount": "0.00",
            "net_collected_amount": "0.00",
            "posted_accounting_count": 0,
            "pending_accounting_count": 0,
            "posted_treasury_count": 0,
            "pending_treasury_count": 0,
            "gateway_payments_count": 0,
            "collection_rate": "0.00",
            "accounting_posting_rate": "0.00",
            "treasury_posting_rate": "0.00",
            "currency": "SAR",
        }

    model_fields = _field_names(queryset.model)

    total_payments = safe_count(queryset)
    total_amount = _safe_sum_field(queryset, "amount", "total_amount")
    paid_amount = _safe_sum_field(queryset, "paid_amount", "amount")
    refunded_amount = _safe_sum_field(queryset, "refunded_amount")
    net_collected_amount = _money(paid_amount - refunded_amount)

    posted_accounting_count = (
        _safe_count_filter(queryset, is_accounting_posted=True)
        if "is_accounting_posted" in model_fields
        else 0
    )
    pending_accounting_count = (
        _safe_count_filter(queryset, is_accounting_posted=False)
        if "is_accounting_posted" in model_fields
        else 0
    )
    posted_treasury_count = (
        _safe_count_filter(queryset, is_treasury_posted=True)
        if "is_treasury_posted" in model_fields
        else 0
    )
    pending_treasury_count = (
        _safe_count_filter(queryset, is_treasury_posted=False)
        if "is_treasury_posted" in model_fields
        else 0
    )

    gateway_payments_count = 0
    if "external_reference" in model_fields or "transaction_id" in model_fields:
        try:
            gateway_payments_count = queryset.filter(
                Q(external_reference__isnull=False)
                | Q(transaction_id__isnull=False)
            ).count()
        except Exception:
            gateway_payments_count = 0

    return {
        "total_payments": total_payments,
        "total_amount": _normalize_money(total_amount),
        "paid_amount": _normalize_money(paid_amount),
        "refunded_amount": _normalize_money(refunded_amount),
        "net_collected_amount": _normalize_money(net_collected_amount),

        "posted_accounting_count": posted_accounting_count,
        "pending_accounting_count": pending_accounting_count,
        "posted_treasury_count": posted_treasury_count,
        "pending_treasury_count": pending_treasury_count,
        "gateway_payments_count": gateway_payments_count,

        "collection_rate": _percentage(paid_amount, total_amount),
        "accounting_posting_rate": _percentage(posted_accounting_count, total_payments),
        "treasury_posting_rate": _percentage(posted_treasury_count, total_payments),

        "currency": "SAR",
    }


def _serialize_payment_row(payment: Any) -> dict[str, Any]:
    customer = _safe_attr(payment, "customer", None)
    invoice = _safe_attr(payment, "invoice", None)
    order = _safe_attr(payment, "order", None)

    return {
        "id": _safe_attr(payment, "id", None),
        "payment_number": _safe_attr(payment, "payment_number", "") or f"PAY-{_safe_attr(payment, 'id', '')}",
        "status": _safe_attr(payment, "status", ""),
        "payment_method": _safe_attr(payment, "payment_method", ""),
        "provider": _safe_attr(payment, "provider", ""),
        "currency": _safe_attr(payment, "currency", "SAR") or "SAR",

        "amount": _normalize_money(_safe_attr(payment, "amount", "0.00")),
        "paid_amount": _normalize_money(_safe_attr(payment, "paid_amount", "0.00")),
        "refunded_amount": _normalize_money(_safe_attr(payment, "refunded_amount", "0.00")),
        "net_collected_amount": _normalize_money(_safe_attr(payment, "net_collected_amount", "0.00")),

        "invoice_id": _safe_attr(payment, "invoice_id", None),
        "invoice_number": _safe_attr(invoice, "invoice_number", "") if invoice else "",

        "order_id": _safe_attr(payment, "order_id", None),
        "order_number": _safe_attr(order, "order_number", "") if order else "",

        "customer_id": _safe_attr(payment, "customer_id", None),
        "customer_name": _related_name(customer),

        "external_reference": _safe_attr(payment, "external_reference", ""),
        "transaction_id": _safe_attr(payment, "transaction_id", ""),
        "gateway_response_code": _safe_attr(payment, "gateway_response_code", ""),
        "gateway_message": _safe_attr(payment, "gateway_message", ""),

        "is_accounting_posted": bool(_safe_attr(payment, "is_accounting_posted", False)),
        "accounting_entry_reference": _safe_attr(payment, "accounting_entry_reference", ""),
        "is_treasury_posted": bool(_safe_attr(payment, "is_treasury_posted", False)),
        "treasury_movement_reference": _safe_attr(payment, "treasury_movement_reference", ""),

        "paid_at": _safe_iso(_safe_attr(payment, "paid_at", None)),
        "created_at": _safe_iso(_safe_attr(payment, "created_at", None)),
    }


def _latest_rows(queryset, limit: int = 50) -> list[dict[str, Any]]:
    if queryset is None:
        return []

    try:
        queryset = queryset.select_related("invoice", "order", "customer")
    except Exception:
        pass

    try:
        rows = list(queryset.order_by("-id")[:limit])
    except Exception:
        return []

    return [_serialize_payment_row(payment) for payment in rows]


# ============================================================
# API
# ============================================================

@require_GET
def payments_report(request):
    filters = common_filters_from_request(request)
    queryset = _payments_queryset(filters)

    data = {
        "meta": report_meta("payments", "تقرير المدفوعات", "Payments Report"),
        "filters": filters,
        "summary": _build_summary(queryset),
        "charts": {
            "by_status": safe_group_count(queryset, ["status", "payment_status"]),
            "by_method": safe_group_count(
                queryset,
                ["payment_method", "method", "payment_type", "gateway"],
            ),
            "by_provider": safe_group_count(queryset, ["provider", "gateway_provider"]),
            "by_accounting_posting": safe_group_count(queryset, ["is_accounting_posted"]),
            "by_treasury_posting": safe_group_count(queryset, ["is_treasury_posted"]),
        },
        "breakdowns": {
            "amount_by_status": _safe_group_sum(
                queryset,
                "status",
                ["amount", "paid_amount", "refunded_amount"],
            ),
            "amount_by_method": _safe_group_sum(
                queryset,
                "payment_method",
                ["amount", "paid_amount", "refunded_amount"],
            ),
            "amount_by_provider": _safe_group_sum(
                queryset,
                "provider",
                ["amount", "paid_amount", "refunded_amount"],
            ),
        },
        "links": {
            "payments": "/system/payments/list",
            "payment_reports": "/system/reports/payments",
            "treasury": "/system/treasury",
            "accounting": "/system/accounting",
        },
        "rows": _latest_rows(queryset, limit=50),
    }

    return json_success(data)