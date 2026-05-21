# ============================================================
# 📂 api/reports/orders.py
# 🧠 Primey Care | Orders Central Report API V2.5
# ------------------------------------------------------------
# ✅ Orders overview
# ✅ Total / paid / remaining / tax / discount totals
# ✅ Breakdowns by order status / payment / fulfillment
# ✅ Breakdowns by source / provider / sales agent / delivery agent / product
# ✅ Breakdowns by order kind / payment method / COD collection
# ✅ Delivery lifecycle summary
# ✅ Cash on delivery collection summary
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


def _safe_count_filter(queryset, *q_objects, **filters) -> int:
    if queryset is None:
        return 0

    try:
        return int(queryset.filter(*q_objects, **filters).count() or 0)
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


def _remaining_from_values(total_amount: Any, paid_amount: Any) -> Decimal:
    remaining = _money(total_amount) - _money(paid_amount)

    if remaining < Decimal("0.00"):
        return Decimal("0.00")

    return _money(remaining)


def _order_remaining(order: Any) -> Decimal:
    explicit = _safe_attr(order, "remaining_amount", None)

    if explicit is not None:
        try:
            return _money(explicit)
        except Exception:
            pass

    return _remaining_from_values(
        _safe_attr(order, "total_amount", "0.00"),
        _safe_attr(order, "amount_paid", "0.00"),
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
        total_amount = _money(row.get("total_amount"))
        amount_paid = _money(row.get("amount_paid"))
        cash_collected_amount = _money(row.get("cash_collected_amount"))

        item = {
            group_field: row.get(group_field) or "",
            "count": row.get("count") or 0,
        }

        for sum_field in sum_fields:
            if sum_field == "remaining_amount":
                item[sum_field] = _normalize_money(_remaining_from_values(total_amount, amount_paid))
            else:
                item[sum_field] = _normalize_money(row.get(sum_field))

        if "cash_collected_amount" not in item:
            item["cash_collected_amount"] = _normalize_money(cash_collected_amount)

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

        total_amount = _money(row.get("total_amount"))
        amount_paid = _money(row.get("amount_paid"))
        cash_collected_amount = _money(row.get("cash_collected_amount"))

        item = {
            "id": row.get(id_field),
            "label": label or "غير محدد",
            "count": row.get("count") or 0,
        }

        for sum_field in sum_fields:
            if sum_field == "remaining_amount":
                item[sum_field] = _normalize_money(_remaining_from_values(total_amount, amount_paid))
            else:
                item[sum_field] = _normalize_money(row.get(sum_field))

        if "cash_collected_amount" not in item:
            item["cash_collected_amount"] = _normalize_money(cash_collected_amount)

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

    select_related_fields = []

    for field_name in (
        "customer",
        "product",
        "provider",
        "contract",
        "agent",
        "delivery_agent",
        "cash_collected_by",
        "created_by",
        "updated_by",
    ):
        if field_name in model_fields:
            select_related_fields.append(field_name)

    if select_related_fields:
        try:
            queryset = queryset.select_related(*select_related_fields)
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
    queryset = apply_exact_filter(queryset, model, "order_kind", filters.get("order_kind") or filters.get("kind"))
    queryset = apply_exact_filter(queryset, model, "payment_method", filters.get("payment_method"))

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

    delivery_agent_id = filters.get("delivery_agent_id")
    if delivery_agent_id and "delivery_agent" in model_fields:
        queryset = queryset.filter(delivery_agent_id=delivery_agent_id)

    contract_id = filters.get("contract_id")
    if contract_id and "contract" in model_fields:
        queryset = queryset.filter(contract_id=contract_id)

    invoice_id = filters.get("invoice_id")
    if invoice_id and "invoice" in model_fields:
        queryset = queryset.filter(invoice_id=invoice_id)

    is_cod = filters.get("is_cod")
    if is_cod in ("1", "true", "True", "yes", "on") and "payment_method" in model_fields:
        queryset = queryset.filter(payment_method="cash_on_delivery")
    elif is_cod in ("0", "false", "False", "no", "off") and "payment_method" in model_fields:
        queryset = queryset.exclude(payment_method="cash_on_delivery")

    cash_collected = filters.get("cash_collected")
    if cash_collected in ("1", "true", "True", "yes", "on") and "cash_collected_amount" in model_fields:
        queryset = queryset.filter(
            Q(cash_collected_amount__gt=Decimal("0.00"))
            | Q(cash_collected_at__isnull=False)
        )
    elif cash_collected in ("0", "false", "False", "no", "off") and "cash_collected_amount" in model_fields:
        queryset = queryset.filter(payment_method="cash_on_delivery").filter(
            Q(cash_collected_amount__lte=Decimal("0.00"))
            | Q(cash_collected_at__isnull=True)
        )

    return queryset


# ============================================================
# Builders
# ============================================================

def _empty_summary() -> dict[str, Any]:
    return {
        "total_orders": 0,

        "subtotal_amount": "0.00",
        "discount_amount": "0.00",
        "tax_amount": "0.00",
        "total_amount": "0.00",
        "paid_amount": "0.00",
        "cash_collected_amount": "0.00",
        "remaining_amount": "0.00",

        "pending_orders": 0,
        "confirmed_orders": 0,
        "processing_orders": 0,
        "card_ready_orders": 0,
        "assigned_for_delivery_orders": 0,
        "out_for_delivery_orders": 0,
        "delivered_orders": 0,
        "completed_orders": 0,
        "cancelled_orders": 0,
        "refunded_orders": 0,

        "paid_orders": 0,
        "unpaid_orders": 0,
        "cod_pending_orders": 0,
        "partially_paid_orders": 0,

        "cash_on_delivery_orders": 0,
        "cash_collected_orders": 0,
        "cash_pending_collection_orders": 0,

        "orders_with_agent": 0,
        "orders_with_delivery_agent": 0,
        "orders_without_delivery_agent": 0,

        "completion_rate": "0.00",
        "delivery_rate": "0.00",
        "cancellation_rate": "0.00",
        "collection_rate": "0.00",
        "cod_collection_rate": "0.00",

        "currency": "SAR",
    }


def _build_summary(queryset) -> dict[str, Any]:
    if queryset is None:
        return _empty_summary()

    model_fields = _field_names(queryset.model)

    total_orders = safe_count(queryset)

    subtotal_amount = _safe_sum_field(queryset, "subtotal_amount", "subtotal", "amount")
    discount_amount = _safe_sum_field(queryset, "discount_amount")
    tax_amount = _safe_sum_field(queryset, "tax_amount", "vat_amount")
    total_amount = _safe_sum_field(queryset, "total_amount", "grand_total", "amount", "net_amount")
    paid_amount = _safe_sum_field(queryset, "amount_paid", "paid_amount")
    cash_collected_amount = _safe_sum_field(queryset, "cash_collected_amount")
    remaining_amount = _remaining_from_values(total_amount, paid_amount)

    pending_orders = _safe_count_filter(queryset, status="pending")
    confirmed_orders = _safe_count_filter(queryset, status="confirmed")
    processing_orders = _safe_count_filter(queryset, status="processing")
    card_ready_orders = _safe_count_filter(queryset, status="card_ready")
    assigned_for_delivery_orders = _safe_count_filter(queryset, status="assigned_for_delivery")
    out_for_delivery_orders = _safe_count_filter(queryset, status="out_for_delivery")
    delivered_orders = _safe_count_filter(queryset, status="delivered")
    completed_orders = _safe_count_filter(queryset, status="completed")
    cancelled_orders = _safe_count_filter(queryset, status="cancelled")
    refunded_orders = _safe_count_filter(queryset, status="refunded")

    paid_orders = _safe_count_filter(queryset, payment_status="paid") if "payment_status" in model_fields else 0
    unpaid_orders = _safe_count_filter(queryset, payment_status="unpaid") if "payment_status" in model_fields else 0
    cod_pending_orders = _safe_count_filter(queryset, payment_status="cod_pending") if "payment_status" in model_fields else 0
    partially_paid_orders = _safe_count_filter(queryset, payment_status="partially_paid") if "payment_status" in model_fields else 0

    cash_on_delivery_orders = (
        _safe_count_filter(queryset, payment_method="cash_on_delivery")
        if "payment_method" in model_fields
        else 0
    )

    cash_collected_orders = (
        _safe_count_filter(
            queryset,
            Q(cash_collected_amount__gt=Decimal("0.00")) | Q(cash_collected_at__isnull=False),
        )
        if "cash_collected_amount" in model_fields
        else 0
    )

    cash_pending_collection_orders = max(cash_on_delivery_orders - cash_collected_orders, 0)

    orders_with_agent = _safe_count_filter(queryset, agent_id__isnull=False) if "agent" in model_fields else 0
    orders_with_delivery_agent = (
        _safe_count_filter(queryset, delivery_agent_id__isnull=False)
        if "delivery_agent" in model_fields
        else 0
    )
    orders_without_delivery_agent = (
        _safe_count_filter(queryset, delivery_agent_id__isnull=True)
        if "delivery_agent" in model_fields
        else 0
    )

    return {
        "total_orders": total_orders,

        "subtotal_amount": _normalize_money(subtotal_amount),
        "discount_amount": _normalize_money(discount_amount),
        "tax_amount": _normalize_money(tax_amount),
        "total_amount": _normalize_money(total_amount),
        "paid_amount": _normalize_money(paid_amount),
        "cash_collected_amount": _normalize_money(cash_collected_amount),
        "remaining_amount": _normalize_money(remaining_amount),

        "pending_orders": pending_orders,
        "confirmed_orders": confirmed_orders,
        "processing_orders": processing_orders,
        "card_ready_orders": card_ready_orders,
        "assigned_for_delivery_orders": assigned_for_delivery_orders,
        "out_for_delivery_orders": out_for_delivery_orders,
        "delivered_orders": delivered_orders,
        "completed_orders": completed_orders,
        "cancelled_orders": cancelled_orders,
        "refunded_orders": refunded_orders,

        "paid_orders": paid_orders,
        "unpaid_orders": unpaid_orders,
        "cod_pending_orders": cod_pending_orders,
        "partially_paid_orders": partially_paid_orders,

        "cash_on_delivery_orders": cash_on_delivery_orders,
        "cash_collected_orders": cash_collected_orders,
        "cash_pending_collection_orders": cash_pending_collection_orders,

        "orders_with_agent": orders_with_agent,
        "orders_with_delivery_agent": orders_with_delivery_agent,
        "orders_without_delivery_agent": orders_without_delivery_agent,

        "completion_rate": _percentage(completed_orders, total_orders),
        "delivery_rate": _percentage(delivered_orders, total_orders),
        "cancellation_rate": _percentage(cancelled_orders, total_orders),
        "collection_rate": _percentage(paid_amount, total_amount),
        "cod_collection_rate": _percentage(cash_collected_orders, cash_on_delivery_orders),

        "currency": "SAR",
    }


def _serialize_order_row(order: Any) -> dict[str, Any]:
    customer = _safe_attr(order, "customer", None)
    product = _safe_attr(order, "product", None)
    provider = _safe_attr(order, "provider", None)
    agent = _safe_attr(order, "agent", None)
    delivery_agent = _safe_attr(order, "delivery_agent", None)

    invoice = None
    try:
        invoice = _safe_attr(order, "invoice", None)
    except Exception:
        invoice = None

    order_number = (
        _safe_attr(order, "order_number", "")
        or _safe_attr(order, "number", "")
        or _safe_attr(order, "code", "")
        or f"ORD-{_safe_attr(order, 'id', '')}"
    )

    amount_paid = (
        _safe_attr(order, "amount_paid", None)
        or _safe_attr(order, "paid_amount", "0.00")
    )
    total_amount = _safe_attr(order, "total_amount", "0.00")

    return {
        "id": _safe_attr(order, "id", None),
        "order_number": order_number,
        "number": order_number,
        "reference": order_number,

        "status": _safe_attr(order, "status", ""),
        "payment_status": _safe_attr(order, "payment_status", ""),
        "fulfillment_status": _safe_attr(order, "fulfillment_status", ""),
        "source": _safe_attr(order, "source", ""),

        "order_kind": _safe_attr(order, "order_kind", ""),
        "payment_method": _safe_attr(order, "payment_method", ""),
        "payment_reference": _safe_attr(order, "payment_reference", ""),
        "referral_code_used": _safe_attr(order, "referral_code_used", ""),

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

        "delivery_agent_id": _safe_attr(order, "delivery_agent_id", None),
        "delivery_agent_name": _related_name(delivery_agent),

        "invoice_id": _safe_attr(order, "invoice_id", None),
        "invoice_number": _safe_attr(invoice, "invoice_number", "") if invoice else "",

        "subtotal_amount": _normalize_money(_safe_attr(order, "subtotal_amount", "0.00")),
        "discount_amount": _normalize_money(_safe_attr(order, "discount_amount", "0.00")),
        "tax_amount": _normalize_money(_safe_attr(order, "tax_amount", "0.00")),
        "total_amount": _normalize_money(total_amount),
        "paid_amount": _normalize_money(amount_paid),
        "cash_collected_amount": _normalize_money(_safe_attr(order, "cash_collected_amount", "0.00")),
        "remaining_amount": _normalize_money(_order_remaining(order)),
        "currency": _safe_attr(order, "currency_code", "SAR") or _safe_attr(order, "currency", "SAR") or "SAR",

        "confirmed_at": _safe_iso(_safe_attr(order, "confirmed_at", None)),
        "card_printed_at": _safe_iso(_safe_attr(order, "card_printed_at", None)),
        "card_ready_at": _safe_iso(_safe_attr(order, "card_ready_at", None)),
        "assigned_for_delivery_at": _safe_iso(_safe_attr(order, "assigned_for_delivery_at", None)),
        "out_for_delivery_at": _safe_iso(_safe_attr(order, "out_for_delivery_at", None)),
        "delivered_at": _safe_iso(_safe_attr(order, "delivered_at", None)),
        "completed_at": _safe_iso(_safe_attr(order, "completed_at", None)),
        "cash_collected_at": _safe_iso(_safe_attr(order, "cash_collected_at", None)),

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


def _build_cash_collection_breakdown(queryset) -> dict[str, Any]:
    if queryset is None:
        return {
            "cod_orders": 0,
            "cod_collected_orders": 0,
            "cod_pending_collection_orders": 0,
            "cod_total_amount": "0.00",
            "cod_paid_amount": "0.00",
            "cod_cash_collected_amount": "0.00",
            "cod_remaining_amount": "0.00",
            "cod_collection_rate": "0.00",
        }

    model_fields = _field_names(queryset.model)

    if "payment_method" not in model_fields:
        return {
            "cod_orders": 0,
            "cod_collected_orders": 0,
            "cod_pending_collection_orders": 0,
            "cod_total_amount": "0.00",
            "cod_paid_amount": "0.00",
            "cod_cash_collected_amount": "0.00",
            "cod_remaining_amount": "0.00",
            "cod_collection_rate": "0.00",
        }

    cod_queryset = queryset.filter(payment_method="cash_on_delivery")
    cod_orders = safe_count(cod_queryset)

    collected_queryset = cod_queryset.filter(
        Q(payment_status="paid")
        | Q(cash_collected_amount__gt=Decimal("0.00"))
        | Q(cash_collected_at__isnull=False)
    )

    collected_orders = safe_count(collected_queryset)
    pending_orders = max(cod_orders - collected_orders, 0)

    cod_total_amount = _safe_sum_field(cod_queryset, "total_amount")
    cod_paid_amount = _safe_sum_field(cod_queryset, "amount_paid")
    cod_cash_collected_amount = _safe_sum_field(cod_queryset, "cash_collected_amount")

    return {
        "cod_orders": cod_orders,
        "cod_collected_orders": collected_orders,
        "cod_pending_collection_orders": pending_orders,
        "cod_total_amount": _normalize_money(cod_total_amount),
        "cod_paid_amount": _normalize_money(cod_paid_amount),
        "cod_cash_collected_amount": _normalize_money(cod_cash_collected_amount),
        "cod_remaining_amount": _normalize_money(_remaining_from_values(cod_total_amount, cod_paid_amount)),
        "cod_collection_rate": _percentage(collected_orders, cod_orders),
    }


def _build_delivery_breakdown(queryset) -> dict[str, Any]:
    if queryset is None:
        return {
            "ready_for_delivery_orders": 0,
            "assigned_for_delivery_orders": 0,
            "out_for_delivery_orders": 0,
            "delivered_orders": 0,
            "orders_with_delivery_agent": 0,
            "orders_without_delivery_agent": 0,
            "delivery_rate": "0.00",
            "delivery_agent_coverage_rate": "0.00",
        }

    total_orders = safe_count(queryset)
    model_fields = _field_names(queryset.model)

    ready = _safe_count_filter(
        queryset,
        Q(status="card_ready") | Q(fulfillment_status="ready"),
    )
    assigned = _safe_count_filter(
        queryset,
        Q(status="assigned_for_delivery") | Q(fulfillment_status="assigned"),
    )
    out_for_delivery = _safe_count_filter(
        queryset,
        Q(status="out_for_delivery") | Q(fulfillment_status="out_for_delivery"),
    )
    delivered = _safe_count_filter(
        queryset,
        Q(status="delivered") | Q(fulfillment_status="delivered"),
    )

    with_delivery_agent = (
        _safe_count_filter(queryset, delivery_agent_id__isnull=False)
        if "delivery_agent" in model_fields
        else 0
    )
    without_delivery_agent = (
        _safe_count_filter(queryset, delivery_agent_id__isnull=True)
        if "delivery_agent" in model_fields
        else 0
    )

    return {
        "ready_for_delivery_orders": ready,
        "assigned_for_delivery_orders": assigned,
        "out_for_delivery_orders": out_for_delivery,
        "delivered_orders": delivered,
        "orders_with_delivery_agent": with_delivery_agent,
        "orders_without_delivery_agent": without_delivery_agent,
        "delivery_rate": _percentage(delivered, total_orders),
        "delivery_agent_coverage_rate": _percentage(with_delivery_agent, total_orders),
    }


# ============================================================
# API
# ============================================================

@require_GET
def orders_report(request):
    filters = common_filters_from_request(request)

    filters["order_kind"] = request.GET.get("order_kind") or request.GET.get("kind") or ""
    filters["payment_method"] = request.GET.get("payment_method") or ""
    filters["delivery_agent_id"] = request.GET.get("delivery_agent_id") or ""
    filters["is_cod"] = request.GET.get("is_cod") or ""
    filters["cash_collected"] = request.GET.get("cash_collected") or ""

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
            "by_order_kind": safe_group_count(queryset, ["order_kind"]),
            "by_payment_method": safe_group_count(queryset, ["payment_method"]),
        },
        "breakdowns": {
            "amount_by_status": _safe_group_sum(
                queryset,
                "status",
                ["subtotal_amount", "discount_amount", "tax_amount", "total_amount", "amount_paid", "cash_collected_amount", "remaining_amount"],
            ),
            "amount_by_payment_status": _safe_group_sum(
                queryset,
                "payment_status",
                ["total_amount", "amount_paid", "cash_collected_amount", "remaining_amount"],
            ),
            "amount_by_fulfillment_status": _safe_group_sum(
                queryset,
                "fulfillment_status",
                ["total_amount", "amount_paid", "cash_collected_amount", "remaining_amount"],
            ),
            "amount_by_source": _safe_group_sum(
                queryset,
                "source",
                ["total_amount", "amount_paid", "cash_collected_amount", "remaining_amount"],
            ),
            "amount_by_order_kind": _safe_group_sum(
                queryset,
                "order_kind",
                ["total_amount", "amount_paid", "cash_collected_amount", "remaining_amount"],
            ),
            "amount_by_payment_method": _safe_group_sum(
                queryset,
                "payment_method",
                ["total_amount", "amount_paid", "cash_collected_amount", "remaining_amount"],
            ),
            "top_products": _safe_group_related_sum(
                queryset,
                id_field="product_id",
                label_fields=["product_name", "product__name", "product__title"],
                sum_fields=["total_amount", "amount_paid", "cash_collected_amount", "remaining_amount"],
                limit=20,
            ),
            "top_providers": _safe_group_related_sum(
                queryset,
                id_field="provider_id",
                label_fields=["provider__name", "provider__display_name", "provider__provider_name"],
                sum_fields=["total_amount", "amount_paid", "cash_collected_amount", "remaining_amount"],
                limit=20,
            ),
            "top_agents": _safe_group_related_sum(
                queryset,
                id_field="agent_id",
                label_fields=["agent__full_name", "agent__display_name", "agent__name"],
                sum_fields=["total_amount", "amount_paid", "cash_collected_amount", "remaining_amount"],
                limit=20,
            ),
            "top_delivery_agents": _safe_group_related_sum(
                queryset,
                id_field="delivery_agent_id",
                label_fields=["delivery_agent__full_name", "delivery_agent__display_name", "delivery_agent__name"],
                sum_fields=["total_amount", "amount_paid", "cash_collected_amount", "remaining_amount"],
                limit=20,
            ),
            "delivery": _build_delivery_breakdown(queryset),
            "cash_collection": _build_cash_collection_breakdown(queryset),
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