# ============================================================
# 📂 api/reports/orders.py
# 🧠 Primey Care | Orders Central Report API V2
# ------------------------------------------------------------
# ✅ Orders overview
# ✅ Total / paid / remaining / tax / discount totals
# ✅ Breakdowns by order status / payment / fulfillment
# ✅ Breakdowns by source / provider / agent / product
# ✅ Latest orders rows
# ✅ Compatible with Orders + Invoices + Payments + Accounting flow
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
        or _safe_attr(obj, "provider_name", "")
        or _safe_attr(obj, "product_name", "")
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


def _safe_group_related_sum(
    queryset,
    *,
    id_field: str,
    label_fields: list[str],
    sum_fields: list[str],
    limit: int = 20,
) -> list[dict[str, Any]]:
    if queryset is None:
        return []

    model_fields = _field_names(queryset.model)

    if id_field not in model_fields:
        return []

    values_fields = [id_field]
    for field in label_fields:
        if "__" in field:
            values_fields.append(field)
        elif field in model_fields:
            values_fields.append(field)

    annotations = {"count": Count("id")}

    for sum_field in sum_fields:
        if sum_field in model_fields:
            annotations[sum_field] = Sum(sum_field)

    try:
        rows = (
            queryset
            .values(*values_fields)
            .annotate(**annotations)
            .order_by("-count")[:limit]
        )
    except Exception:
        return []

    result: list[dict[str, Any]] = []

    for row in rows:
        label = ""

        for field in label_fields:
            value = row.get(field)
            if value:
                label = str(value)
                break

        item = {
            "id": row.get(id_field),
            "label": label or "غير محدد",
            "count": row.get("count") or 0,
        }

        for sum_field in sum_fields:
            item[sum_field] = _normalize_money(row.get(sum_field))

        result.append(item)

    return result


# ============================================================
# Query
# ============================================================

def _orders_queryset(filters: dict[str, Any]):
    queryset = get_base_queryset("orders", "Order")

    if queryset is None:
        return None

    model = queryset.model
    model_fields = _field_names(model)

    try:
        queryset = queryset.select_related(
            "customer",
            "product",
            "provider",
            "contract",
            "agent",
            "invoice",
        )
    except Exception:
        try:
            queryset = queryset.select_related("customer", "product", "provider", "agent")
        except Exception:
            pass

    queryset = apply_date_filters(
        queryset,
        model,
        filters.get("date_from"),
        filters.get("date_to"),
    )

    queryset = apply_exact_filter(queryset, model, "status", filters.get("status"))
    queryset = apply_exact_filter(queryset, model, "payment_status", filters.get("payment_status"))
    queryset = apply_exact_filter(queryset, model, "fulfillment_status", filters.get("fulfillment_status"))
    queryset = apply_exact_filter(queryset, model, "source", filters.get("source"))

    customer_id = filters.get("customer_id")
    if customer_id and "customer" in model_fields:
        queryset = queryset.filter(customer_id=customer_id)

    product_id = filters.get("product_id")
    if product_id and "product" in model_fields:
        queryset = queryset.filter(product_id=product_id)

    provider_id = filters.get("provider_id")
    if provider_id and "provider" in model_fields:
        queryset = queryset.filter(provider_id=provider_id)

    agent_id = filters.get("agent_id")
    if agent_id and "agent" in model_fields:
        queryset = queryset.filter(agent_id=agent_id)

    contract_id = filters.get("contract_id")
    if contract_id and "contract" in model_fields:
        queryset = queryset.filter(contract_id=contract_id)

    invoice_id = filters.get("invoice_id")
    if invoice_id and "invoice" in model_fields:
        queryset = queryset.filter(invoice_id=invoice_id)

    return queryset


# ============================================================
# Builders
# ============================================================

def _build_summary(queryset) -> dict[str, Any]:
    if queryset is None:
        return {
            "total_orders": 0,
            "subtotal_amount": "0.00",
            "discount_amount": "0.00",
            "tax_amount": "0.00",
            "total_amount": "0.00",
            "paid_amount": "0.00",
            "remaining_amount": "0.00",
            "completed_orders": 0,
            "cancelled_orders": 0,
            "refunded_orders": 0,
            "paid_orders": 0,
            "unpaid_orders": 0,
            "partially_paid_orders": 0,
            "completion_rate": "0.00",
            "cancellation_rate": "0.00",
            "collection_rate": "0.00",
            "currency": "SAR",
        }

    model_fields = _field_names(queryset.model)

    total_orders = safe_count(queryset)

    subtotal_amount = _safe_sum_field(queryset, "subtotal_amount", "subtotal", "amount")
    discount_amount = _safe_sum_field(queryset, "discount_amount")
    tax_amount = _safe_sum_field(queryset, "tax_amount", "vat_amount")
    total_amount = _safe_sum_field(queryset, "total_amount", "grand_total", "amount", "net_amount")
    paid_amount = _safe_sum_field(queryset, "amount_paid", "paid_amount")
    remaining_amount = (
        _safe_sum_field(queryset, "remaining_amount")
        if "remaining_amount" in model_fields
        else _money(total_amount - paid_amount)
    )

    completed_orders = (
        _safe_count_filter(queryset, status="COMPLETED")
        or _safe_count_filter(queryset, status="completed")
    )
    cancelled_orders = (
        _safe_count_filter(queryset, status="CANCELLED")
        or _safe_count_filter(queryset, status="cancelled")
    )
    refunded_orders = (
        _safe_count_filter(queryset, status="REFUNDED")
        or _safe_count_filter(queryset, status="refunded")
    )

    paid_orders = (
        _safe_count_filter(queryset, payment_status="PAID")
        or _safe_count_filter(queryset, payment_status="paid")
        if "payment_status" in model_fields
        else 0
    )
    unpaid_orders = (
        _safe_count_filter(queryset, payment_status="UNPAID")
        or _safe_count_filter(queryset, payment_status="unpaid")
        if "payment_status" in model_fields
        else 0
    )
    partially_paid_orders = (
        _safe_count_filter(queryset, payment_status="PARTIALLY_PAID")
        or _safe_count_filter(queryset, payment_status="partially_paid")
        if "payment_status" in model_fields
        else 0
    )

    return {
        "total_orders": total_orders,

        "subtotal_amount": _normalize_money(subtotal_amount),
        "discount_amount": _normalize_money(discount_amount),
        "tax_amount": _normalize_money(tax_amount),
        "total_amount": _normalize_money(total_amount),
        "paid_amount": _normalize_money(paid_amount),
        "remaining_amount": _normalize_money(remaining_amount),

        "completed_orders": completed_orders,
        "cancelled_orders": cancelled_orders,
        "refunded_orders": refunded_orders,

        "paid_orders": paid_orders,
        "unpaid_orders": unpaid_orders,
        "partially_paid_orders": partially_paid_orders,

        "completion_rate": _percentage(completed_orders, total_orders),
        "cancellation_rate": _percentage(cancelled_orders, total_orders),
        "collection_rate": _percentage(paid_amount, total_amount),

        "currency": "SAR",
    }


def _serialize_order_row(order: Any) -> dict[str, Any]:
    customer = _safe_attr(order, "customer", None)
    product = _safe_attr(order, "product", None)
    provider = _safe_attr(order, "provider", None)
    agent = _safe_attr(order, "agent", None)
    invoice = _safe_attr(order, "invoice", None)

    order_number = (
        _safe_attr(order, "order_number", "")
        or _safe_attr(order, "number", "")
        or _safe_attr(order, "code", "")
        or f"ORD-{_safe_attr(order, 'id', '')}"
    )

    return {
        "id": _safe_attr(order, "id", None),
        "order_number": order_number,
        "number": order_number,
        "reference": order_number,

        "status": _safe_attr(order, "status", ""),
        "payment_status": _safe_attr(order, "payment_status", ""),
        "fulfillment_status": _safe_attr(order, "fulfillment_status", ""),
        "source": _safe_attr(order, "source", ""),

        "customer_id": _safe_attr(order, "customer_id", None),
        "customer_name": _related_name(customer),

        "product_id": _safe_attr(order, "product_id", None),
        "product_name": (
            _safe_attr(order, "product_name", "")
            or _related_name(product)
        ),
        "product_type": _safe_attr(order, "product_type", ""),

        "provider_id": _safe_attr(order, "provider_id", None),
        "provider_name": _related_name(provider),

        "agent_id": _safe_attr(order, "agent_id", None),
        "agent_name": _related_name(agent),

        "invoice_id": _safe_attr(order, "invoice_id", None),
        "invoice_number": _safe_attr(invoice, "invoice_number", "") if invoice else "",

        "subtotal_amount": _normalize_money(_safe_attr(order, "subtotal_amount", "0.00")),
        "discount_amount": _normalize_money(_safe_attr(order, "discount_amount", "0.00")),
        "tax_amount": _normalize_money(_safe_attr(order, "tax_amount", "0.00")),
        "total_amount": _normalize_money(_safe_attr(order, "total_amount", "0.00")),
        "paid_amount": _normalize_money(
            _safe_attr(order, "amount_paid", None)
            or _safe_attr(order, "paid_amount", "0.00")
        ),
        "remaining_amount": _normalize_money(_safe_attr(order, "remaining_amount", "0.00")),
        "currency": _safe_attr(order, "currency_code", "SAR") or _safe_attr(order, "currency", "SAR") or "SAR",

        "created_at": _safe_iso(_safe_attr(order, "created_at", None)),
        "updated_at": _safe_iso(_safe_attr(order, "updated_at", None)),
    }


def _latest_rows(queryset, limit: int = 50) -> list[dict[str, Any]]:
    if queryset is None:
        return []

    try:
        rows = list(queryset.order_by("-id")[:limit])
    except Exception:
        return []

    return [_serialize_order_row(order) for order in rows]


# ============================================================
# API
# ============================================================

@require_GET
def orders_report(request):
    filters = common_filters_from_request(request)
    queryset = _orders_queryset(filters)

    data = {
        "meta": report_meta("orders", "تقرير الطلبات", "Orders Report"),
        "filters": filters,
        "summary": _build_summary(queryset),
        "charts": {
            "by_status": safe_group_count(queryset, ["status", "order_status"]),
            "by_payment_status": safe_group_count(queryset, ["payment_status"]),
            "by_fulfillment_status": safe_group_count(queryset, ["fulfillment_status"]),
            "by_source": safe_group_count(queryset, ["source", "order_source"]),
            "by_product_type": safe_group_count(queryset, ["product_type"]),
        },
        "breakdowns": {
            "amount_by_status": _safe_group_sum(
                queryset,
                "status",
                ["subtotal_amount", "discount_amount", "tax_amount", "total_amount", "amount_paid", "remaining_amount"],
            ),
            "amount_by_payment_status": _safe_group_sum(
                queryset,
                "payment_status",
                ["total_amount", "amount_paid", "remaining_amount"],
            ),
            "amount_by_fulfillment_status": _safe_group_sum(
                queryset,
                "fulfillment_status",
                ["total_amount", "amount_paid", "remaining_amount"],
            ),
            "amount_by_source": _safe_group_sum(
                queryset,
                "source",
                ["total_amount", "amount_paid", "remaining_amount"],
            ),
            "top_products": _safe_group_related_sum(
                queryset,
                id_field="product_id",
                label_fields=["product_name", "product__name", "product__title"],
                sum_fields=["total_amount", "amount_paid", "remaining_amount"],
                limit=20,
            ),
            "top_providers": _safe_group_related_sum(
                queryset,
                id_field="provider_id",
                label_fields=["provider__name", "provider__display_name", "provider__provider_name"],
                sum_fields=["total_amount", "amount_paid", "remaining_amount"],
                limit=20,
            ),
            "top_agents": _safe_group_related_sum(
                queryset,
                id_field="agent_id",
                label_fields=["agent__full_name", "agent__display_name", "agent__name"],
                sum_fields=["total_amount", "amount_paid", "remaining_amount"],
                limit=20,
            ),
        },
        "links": {
            "orders": "/system/orders/list",
            "order_reports": "/system/reports/orders",
            "invoices": "/system/invoices/list",
            "payments": "/system/payments/list",
            "accounting": "/system/accounting",
        },
        "rows": _latest_rows(queryset, limit=50),
    }

    return json_success(data)