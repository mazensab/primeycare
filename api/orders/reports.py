# ============================================================
# 📂 api/orders/reports.py
# 🧭 Primey Care — Orders Reports API V2.7
# ------------------------------------------------------------
# ✅ Orders summary
# ✅ Financial summary
# ✅ Status breakdown
# ✅ Payment status breakdown
# ✅ Fulfillment breakdown
# ✅ Source breakdown
# ✅ Offer source breakdown
# ✅ ContractProduct offer breakdown
# ✅ Order kind breakdown
# ✅ Payment method breakdown
# ✅ Provider / Sales Agent / Delivery Agent / Product / Contract breakdown
# ✅ Referral code breakdown
# ✅ Delivery lifecycle summary
# ✅ Cash on delivery collection summary
# ✅ Latest orders
# ✅ لا يستخدم Sum("remaining_amount") لأنه property وليس DB field
# ✅ يحسب remaining_amount = total_amount - amount_paid
# ✅ Unified response: ok / success / data
# ✅ Compatible with Accounting / Treasury backend flow
# ------------------------------------------------------------
# القاعدة المعتمدة:
# - Product = كتالوج ثابت
# - ContractProduct = عرض/سعر/خصم المنتج حسب مقدم الخدمة والعقد
# - Order يحفظ Snapshot للعرض ولا يتأثر بتغييره لاحقًا
# ------------------------------------------------------------
# V2.7 Fix:
# - Provider model لا يحتوي display_name/provider_name/provider_code
# - الحقول الصحيحة: name / name_ar / name_en / code
# - الحفاظ على مفاتيح response للفرونت: provider_name / provider_code
# ============================================================

from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.core.exceptions import ValidationError
from django.db.models import Count, Q, Sum
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from orders.models import Order
from orders.services import apply_order_filters, serialize_order


logger = logging.getLogger(__name__)


# ============================================================
# 🔹 JSON Helpers
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
    status: int = 400,
    *,
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


def _validation_errors(exc: ValidationError) -> Any:
    if hasattr(exc, "message_dict"):
        return exc.message_dict

    if hasattr(exc, "messages"):
        return exc.messages

    return str(exc)


# ============================================================
# 🔹 Helpers
# ============================================================

def _ensure_authenticated(request):
    if not getattr(request, "user", None) or not request.user.is_authenticated:
        return None, _json_error("Authentication required.", 401)

    return request.user, None


def _money(value: Any) -> Decimal:
    if value is None:
        value = Decimal("0.00")

    try:
        return Decimal(str(value)).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )
    except Exception:
        return Decimal("0.00")


def _remaining(total_amount: Any, paid_amount: Any) -> Decimal:
    remaining = _money(total_amount) - _money(paid_amount)

    if remaining < Decimal("0.00"):
        return Decimal("0.00")

    return _money(remaining)


def _safe_text(value: Any) -> str:
    return str(value or "").strip()


def _orders_queryset():
    return (
        Order.objects.select_related(
            "customer",
            "product",
            "contract_product",
            "contract_product__product",
            "contract_product__contract",
            "contract_product__contract__provider",
            "provider",
            "contract",
            "agent",
            "delivery_agent",
            "cash_collected_by",
            "created_by",
            "updated_by",
        )
        .prefetch_related(
            "status_history",
            "timeline",
        )
        .all()
    )


def _count(queryset) -> int:
    return int(queryset.count() or 0)


def _percentage(part: int | Decimal, total: int | Decimal) -> Decimal:
    total_decimal = Decimal(str(total or "0"))

    if total_decimal <= Decimal("0"):
        return Decimal("0.00")

    return _money(Decimal(str(part or "0")) * Decimal("100.00") / total_decimal)


# ============================================================
# 🔹 Labels
# ============================================================

def _choice_label(choices, value: str) -> str:
    try:
        return dict(choices).get(value, value)
    except Exception:
        return value


def _status_label(value: str) -> str:
    return _choice_label(Order.Status.choices, value)


def _payment_status_label(value: str) -> str:
    return _choice_label(Order.PaymentStatus.choices, value)


def _fulfillment_status_label(value: str) -> str:
    return _choice_label(Order.FulfillmentStatus.choices, value)


def _source_label(value: str) -> str:
    return _choice_label(Order.OrderSource.choices, value)


def _order_kind_label(value: str) -> str:
    return _choice_label(Order.OrderKind.choices, value)


def _payment_method_label(value: str) -> str:
    return _choice_label(Order.PaymentMethod.choices, value)


def _offer_source_label(value: str) -> str:
    return _choice_label(Order.OfferSource.choices, value)


# ============================================================
# 🔹 Breakdown Helpers
# ============================================================

def _add_financial_fields(row: dict[str, Any]) -> dict[str, Any]:
    total_amount = _money(row.get("total_amount"))
    paid_amount = _money(row.get("paid_amount"))
    cash_collected_amount = _money(row.get("cash_collected_amount"))
    remaining_amount = _remaining(total_amount, paid_amount)

    row["total_amount"] = total_amount
    row["paid_amount"] = paid_amount
    row["cash_collected_amount"] = cash_collected_amount
    row["remaining_amount"] = remaining_amount

    return row


def _build_status_breakdown(queryset) -> list[dict[str, Any]]:
    rows = (
        queryset.values("status")
        .annotate(
            count=Count("id"),
            total_amount=Sum("total_amount"),
            paid_amount=Sum("amount_paid"),
            cash_collected_amount=Sum("cash_collected_amount"),
        )
        .order_by("status")
    )

    total_orders = _count(queryset)
    output: list[dict[str, Any]] = []

    for item in rows:
        row = {
            "status": item["status"],
            "label": _status_label(item["status"]),
            "count": item["count"] or 0,
            "percentage": _percentage(item["count"] or 0, total_orders),
            "total_amount": item.get("total_amount"),
            "paid_amount": item.get("paid_amount"),
            "cash_collected_amount": item.get("cash_collected_amount"),
        }
        output.append(_add_financial_fields(row))

    return output


def _build_payment_breakdown(queryset) -> list[dict[str, Any]]:
    rows = (
        queryset.values("payment_status")
        .annotate(
            count=Count("id"),
            total_amount=Sum("total_amount"),
            paid_amount=Sum("amount_paid"),
            cash_collected_amount=Sum("cash_collected_amount"),
        )
        .order_by("payment_status")
    )

    total_orders = _count(queryset)
    output: list[dict[str, Any]] = []

    for item in rows:
        row = {
            "payment_status": item["payment_status"],
            "label": _payment_status_label(item["payment_status"]),
            "count": item["count"] or 0,
            "percentage": _percentage(item["count"] or 0, total_orders),
            "total_amount": item.get("total_amount"),
            "paid_amount": item.get("paid_amount"),
            "cash_collected_amount": item.get("cash_collected_amount"),
        }
        output.append(_add_financial_fields(row))

    return output


def _build_fulfillment_breakdown(queryset) -> list[dict[str, Any]]:
    rows = (
        queryset.values("fulfillment_status")
        .annotate(
            count=Count("id"),
            total_amount=Sum("total_amount"),
            paid_amount=Sum("amount_paid"),
            cash_collected_amount=Sum("cash_collected_amount"),
        )
        .order_by("fulfillment_status")
    )

    total_orders = _count(queryset)
    output: list[dict[str, Any]] = []

    for item in rows:
        row = {
            "fulfillment_status": item["fulfillment_status"],
            "label": _fulfillment_status_label(item["fulfillment_status"]),
            "count": item["count"] or 0,
            "percentage": _percentage(item["count"] or 0, total_orders),
            "total_amount": item.get("total_amount"),
            "paid_amount": item.get("paid_amount"),
            "cash_collected_amount": item.get("cash_collected_amount"),
        }
        output.append(_add_financial_fields(row))

    return output


def _build_source_breakdown(queryset) -> list[dict[str, Any]]:
    rows = (
        queryset.values("source")
        .annotate(
            count=Count("id"),
            total_amount=Sum("total_amount"),
            paid_amount=Sum("amount_paid"),
            cash_collected_amount=Sum("cash_collected_amount"),
        )
        .order_by("source")
    )

    total_orders = _count(queryset)
    output: list[dict[str, Any]] = []

    for item in rows:
        row = {
            "source": item["source"],
            "label": _source_label(item["source"]),
            "count": item["count"] or 0,
            "percentage": _percentage(item["count"] or 0, total_orders),
            "total_amount": item.get("total_amount"),
            "paid_amount": item.get("paid_amount"),
            "cash_collected_amount": item.get("cash_collected_amount"),
        }
        output.append(_add_financial_fields(row))

    return output


def _build_offer_source_breakdown(queryset) -> list[dict[str, Any]]:
    rows = (
        queryset.values("offer_source")
        .annotate(
            count=Count("id"),
            total_amount=Sum("total_amount"),
            paid_amount=Sum("amount_paid"),
            cash_collected_amount=Sum("cash_collected_amount"),
            discount_amount=Sum("discount_amount"),
        )
        .order_by("offer_source")
    )

    total_orders = _count(queryset)
    output: list[dict[str, Any]] = []

    for item in rows:
        value = item.get("offer_source") or Order.OfferSource.NONE
        row = {
            "offer_source": value,
            "label": _offer_source_label(value),
            "count": item["count"] or 0,
            "percentage": _percentage(item["count"] or 0, total_orders),
            "total_amount": item.get("total_amount"),
            "paid_amount": item.get("paid_amount"),
            "cash_collected_amount": item.get("cash_collected_amount"),
            "discount_amount": _money(item.get("discount_amount")),
        }
        output.append(_add_financial_fields(row))

    return output


def _build_order_kind_breakdown(queryset) -> list[dict[str, Any]]:
    rows = (
        queryset.values("order_kind")
        .annotate(
            count=Count("id"),
            total_amount=Sum("total_amount"),
            paid_amount=Sum("amount_paid"),
            cash_collected_amount=Sum("cash_collected_amount"),
        )
        .order_by("order_kind")
    )

    total_orders = _count(queryset)
    output: list[dict[str, Any]] = []

    for item in rows:
        value = item.get("order_kind") or Order.OrderKind.GENERAL
        row = {
            "order_kind": value,
            "label": _order_kind_label(value),
            "count": item["count"] or 0,
            "percentage": _percentage(item["count"] or 0, total_orders),
            "total_amount": item.get("total_amount"),
            "paid_amount": item.get("paid_amount"),
            "cash_collected_amount": item.get("cash_collected_amount"),
        }
        output.append(_add_financial_fields(row))

    return output


def _build_payment_method_breakdown(queryset) -> list[dict[str, Any]]:
    rows = (
        queryset.values("payment_method")
        .annotate(
            count=Count("id"),
            total_amount=Sum("total_amount"),
            paid_amount=Sum("amount_paid"),
            cash_collected_amount=Sum("cash_collected_amount"),
        )
        .order_by("payment_method")
    )

    total_orders = _count(queryset)
    output: list[dict[str, Any]] = []

    for item in rows:
        value = item.get("payment_method") or Order.PaymentMethod.NONE
        row = {
            "payment_method": value,
            "label": _payment_method_label(value),
            "count": item["count"] or 0,
            "percentage": _percentage(item["count"] or 0, total_orders),
            "total_amount": item.get("total_amount"),
            "paid_amount": item.get("paid_amount"),
            "cash_collected_amount": item.get("cash_collected_amount"),
        }
        output.append(_add_financial_fields(row))

    return output


def _build_delivery_breakdown(queryset) -> dict[str, Any]:
    total_orders = _count(queryset)

    ready = _count(
        queryset.filter(
            Q(status=Order.Status.CARD_READY)
            | Q(fulfillment_status=Order.FulfillmentStatus.READY)
        )
    )
    assigned = _count(
        queryset.filter(
            Q(status=Order.Status.ASSIGNED_FOR_DELIVERY)
            | Q(fulfillment_status=Order.FulfillmentStatus.ASSIGNED)
        )
    )
    out_for_delivery = _count(
        queryset.filter(
            Q(status=Order.Status.OUT_FOR_DELIVERY)
            | Q(fulfillment_status=Order.FulfillmentStatus.OUT_FOR_DELIVERY)
        )
    )
    delivered = _count(
        queryset.filter(
            Q(status=Order.Status.DELIVERED)
            | Q(fulfillment_status=Order.FulfillmentStatus.DELIVERED)
        )
    )

    with_delivery_agent = _count(queryset.filter(delivery_agent_id__isnull=False))
    without_delivery_agent = _count(queryset.filter(delivery_agent_id__isnull=True))

    return {
        "ready_for_delivery_orders": ready,
        "assigned_for_delivery_orders": assigned,
        "out_for_delivery_orders": out_for_delivery,
        "delivered_orders": delivered,
        "orders_with_delivery_agent": with_delivery_agent,
        "orders_without_delivery_agent": without_delivery_agent,
        "ready_for_delivery_rate": _percentage(ready, total_orders),
        "assigned_for_delivery_rate": _percentage(assigned, total_orders),
        "out_for_delivery_rate": _percentage(out_for_delivery, total_orders),
        "delivered_rate": _percentage(delivered, total_orders),
        "delivery_agent_coverage_rate": _percentage(with_delivery_agent, total_orders),
    }


def _build_cash_collection_breakdown(queryset) -> dict[str, Any]:
    cod_queryset = queryset.filter(payment_method=Order.PaymentMethod.CASH_ON_DELIVERY)
    cod_orders = _count(cod_queryset)

    collected_queryset = cod_queryset.filter(
        Q(payment_status=Order.PaymentStatus.PAID)
        | Q(cash_collected_amount__gt=Decimal("0.00"))
        | Q(cash_collected_at__isnull=False)
    )
    collected_orders = _count(collected_queryset)
    pending_orders = max(cod_orders - collected_orders, 0)

    totals = cod_queryset.aggregate(
        cod_total_amount=Sum("total_amount"),
        cod_paid_amount=Sum("amount_paid"),
        cod_cash_collected_amount=Sum("cash_collected_amount"),
    )

    return {
        "cod_orders": cod_orders,
        "cod_collected_orders": collected_orders,
        "cod_pending_collection_orders": pending_orders,
        "cod_total_amount": _money(totals.get("cod_total_amount")),
        "cod_paid_amount": _money(totals.get("cod_paid_amount")),
        "cod_cash_collected_amount": _money(totals.get("cod_cash_collected_amount")),
        "cod_remaining_amount": _remaining(
            totals.get("cod_total_amount"),
            totals.get("cod_paid_amount"),
        ),
        "cod_collection_rate": _percentage(collected_orders, cod_orders),
    }


def _build_provider_breakdown(queryset) -> list[dict[str, Any]]:
    rows = (
        queryset.values(
            "provider_id",
            "provider__name",
            "provider__name_ar",
            "provider__name_en",
            "provider__code",
        )
        .annotate(
            count=Count("id"),
            total_amount=Sum("total_amount"),
            paid_amount=Sum("amount_paid"),
            cash_collected_amount=Sum("cash_collected_amount"),
        )
        .order_by("-total_amount", "-count")[:20]
    )

    output: list[dict[str, Any]] = []

    for item in rows:
        row = {
            "provider_id": item.get("provider_id"),
            "provider_name": (
                _safe_text(item.get("provider__name_ar"))
                or _safe_text(item.get("provider__name"))
                or _safe_text(item.get("provider__name_en"))
                or "غير محدد"
            ),
            "provider_code": _safe_text(item.get("provider__code")),
            "count": item["count"] or 0,
            "total_amount": item.get("total_amount"),
            "paid_amount": item.get("paid_amount"),
            "cash_collected_amount": item.get("cash_collected_amount"),
        }
        output.append(_add_financial_fields(row))

    return output


def _build_agent_breakdown(queryset) -> list[dict[str, Any]]:
    rows = (
        queryset.values(
            "agent_id",
            "agent__agent_code",
            "agent__full_name",
        )
        .annotate(
            count=Count("id"),
            total_amount=Sum("total_amount"),
            paid_amount=Sum("amount_paid"),
            cash_collected_amount=Sum("cash_collected_amount"),
        )
        .order_by("-total_amount", "-count")[:20]
    )

    output: list[dict[str, Any]] = []

    for item in rows:
        row = {
            "agent_id": item.get("agent_id"),
            "agent_code": _safe_text(item.get("agent__agent_code")),
            "agent_name": (
                _safe_text(item.get("agent__full_name"))
                or _safe_text(item.get("agent__agent_code"))
                or "غير محدد"
            ),
            "count": item["count"] or 0,
            "total_amount": item.get("total_amount"),
            "paid_amount": item.get("paid_amount"),
            "cash_collected_amount": item.get("cash_collected_amount"),
        }
        output.append(_add_financial_fields(row))

    return output


def _build_delivery_agent_breakdown(queryset) -> list[dict[str, Any]]:
    rows = (
        queryset.values(
            "delivery_agent_id",
            "delivery_agent__agent_code",
            "delivery_agent__full_name",
        )
        .annotate(
            count=Count("id"),
            delivered_count=Count(
                "id",
                filter=Q(status=Order.Status.DELIVERED)
                | Q(fulfillment_status=Order.FulfillmentStatus.DELIVERED),
            ),
            out_for_delivery_count=Count(
                "id",
                filter=Q(status=Order.Status.OUT_FOR_DELIVERY)
                | Q(fulfillment_status=Order.FulfillmentStatus.OUT_FOR_DELIVERY),
            ),
            cod_count=Count(
                "id",
                filter=Q(payment_method=Order.PaymentMethod.CASH_ON_DELIVERY),
            ),
            cash_collected_count=Count(
                "id",
                filter=Q(cash_collected_amount__gt=Decimal("0.00"))
                | Q(cash_collected_at__isnull=False),
            ),
            total_amount=Sum("total_amount"),
            paid_amount=Sum("amount_paid"),
            cash_collected_amount=Sum("cash_collected_amount"),
        )
        .order_by("-cash_collected_amount", "-total_amount", "-count")[:20]
    )

    output: list[dict[str, Any]] = []

    for item in rows:
        row = {
            "delivery_agent_id": item.get("delivery_agent_id"),
            "delivery_agent_code": _safe_text(item.get("delivery_agent__agent_code")),
            "delivery_agent_name": (
                _safe_text(item.get("delivery_agent__full_name"))
                or _safe_text(item.get("delivery_agent__agent_code"))
                or "غير محدد"
            ),
            "count": item["count"] or 0,
            "delivered_count": item["delivered_count"] or 0,
            "out_for_delivery_count": item["out_for_delivery_count"] or 0,
            "cod_count": item["cod_count"] or 0,
            "cash_collected_count": item["cash_collected_count"] or 0,
            "total_amount": item.get("total_amount"),
            "paid_amount": item.get("paid_amount"),
            "cash_collected_amount": item.get("cash_collected_amount"),
        }
        output.append(_add_financial_fields(row))

    return output


def _build_product_breakdown(queryset) -> list[dict[str, Any]]:
    rows = (
        queryset.values(
            "product_id",
            "product_name",
            "product_type",
            "product__code",
        )
        .annotate(
            count=Count("id"),
            quantity=Sum("quantity"),
            total_amount=Sum("total_amount"),
            paid_amount=Sum("amount_paid"),
            cash_collected_amount=Sum("cash_collected_amount"),
            discount_amount=Sum("discount_amount"),
        )
        .order_by("-total_amount", "-count")[:20]
    )

    output: list[dict[str, Any]] = []

    for item in rows:
        row = {
            "product_id": item.get("product_id"),
            "product_name": _safe_text(item.get("product_name")) or "غير محدد",
            "product_code": _safe_text(item.get("product__code")),
            "product_type": _safe_text(item.get("product_type")),
            "count": item["count"] or 0,
            "quantity": item["quantity"] or 0,
            "discount_amount": _money(item.get("discount_amount")),
            "total_amount": item.get("total_amount"),
            "paid_amount": item.get("paid_amount"),
            "cash_collected_amount": item.get("cash_collected_amount"),
        }
        output.append(_add_financial_fields(row))

    return output


def _build_contract_breakdown(queryset) -> list[dict[str, Any]]:
    rows = (
        queryset.values(
            "contract_id",
            "contract__contract_number",
            "contract__title",
            "contract__status",
            "provider_id",
            "provider__name",
            "provider__name_ar",
            "provider__name_en",
            "provider__code",
        )
        .annotate(
            count=Count("id"),
            total_amount=Sum("total_amount"),
            paid_amount=Sum("amount_paid"),
            cash_collected_amount=Sum("cash_collected_amount"),
        )
        .order_by("-total_amount", "-count")[:20]
    )

    output: list[dict[str, Any]] = []

    for item in rows:
        row = {
            "contract_id": item.get("contract_id"),
            "contract_number": _safe_text(item.get("contract__contract_number")),
            "contract_title": _safe_text(item.get("contract__title")) or "غير محدد",
            "contract_status": _safe_text(item.get("contract__status")),
            "provider_id": item.get("provider_id"),
            "provider_name": (
                _safe_text(item.get("provider__name_ar"))
                or _safe_text(item.get("provider__name"))
                or _safe_text(item.get("provider__name_en"))
                or "غير محدد"
            ),
            "provider_code": _safe_text(item.get("provider__code")),
            "count": item["count"] or 0,
            "total_amount": item.get("total_amount"),
            "paid_amount": item.get("paid_amount"),
            "cash_collected_amount": item.get("cash_collected_amount"),
        }
        output.append(_add_financial_fields(row))

    return output


def _build_contract_product_breakdown(queryset) -> list[dict[str, Any]]:
    rows = (
        queryset.values(
            "contract_product_id",
            "contract_product__offer_title",
            "contract_product__offer_badge",
            "contract_product__product__name",
            "contract_product__product__code",
            "contract_product__contract__contract_number",
            "contract_product__contract__title",
            "contract_product__contract__provider_id",
            "contract_product__contract__provider__name",
            "contract_product__contract__provider__name_ar",
            "contract_product__contract__provider__name_en",
            "contract_product__contract__provider__code",
        )
        .annotate(
            count=Count("id"),
            quantity=Sum("quantity"),
            total_amount=Sum("total_amount"),
            paid_amount=Sum("amount_paid"),
            cash_collected_amount=Sum("cash_collected_amount"),
            discount_amount=Sum("discount_amount"),
        )
        .order_by("-total_amount", "-count")[:20]
    )

    output: list[dict[str, Any]] = []

    for item in rows:
        offer_title = (
            _safe_text(item.get("contract_product__offer_title"))
            or _safe_text(item.get("contract_product__product__name"))
            or "غير محدد"
        )

        provider_name = (
            _safe_text(item.get("contract_product__contract__provider__name_ar"))
            or _safe_text(item.get("contract_product__contract__provider__name"))
            or _safe_text(item.get("contract_product__contract__provider__name_en"))
            or "غير محدد"
        )

        row = {
            "contract_product_id": item.get("contract_product_id"),
            "offer_id": item.get("contract_product_id"),
            "offer_title": offer_title,
            "offer_badge": _safe_text(item.get("contract_product__offer_badge")),
            "product_name": _safe_text(item.get("contract_product__product__name")),
            "product_code": _safe_text(item.get("contract_product__product__code")),
            "contract_number": _safe_text(item.get("contract_product__contract__contract_number")),
            "contract_title": _safe_text(item.get("contract_product__contract__title")),
            "provider_id": item.get("contract_product__contract__provider_id"),
            "provider_name": provider_name,
            "provider_code": _safe_text(item.get("contract_product__contract__provider__code")),
            "count": item["count"] or 0,
            "quantity": item["quantity"] or 0,
            "discount_amount": _money(item.get("discount_amount")),
            "total_amount": item.get("total_amount"),
            "paid_amount": item.get("paid_amount"),
            "cash_collected_amount": item.get("cash_collected_amount"),
        }
        output.append(_add_financial_fields(row))

    return output


def _build_referral_breakdown(queryset) -> list[dict[str, Any]]:
    rows = (
        queryset.exclude(referral_code_used="")
        .values("referral_code_used")
        .annotate(
            count=Count("id"),
            total_amount=Sum("total_amount"),
            paid_amount=Sum("amount_paid"),
            cash_collected_amount=Sum("cash_collected_amount"),
        )
        .order_by("-total_amount", "-count")[:20]
    )

    output: list[dict[str, Any]] = []

    for item in rows:
        row = {
            "referral_code_used": _safe_text(item.get("referral_code_used")),
            "count": item["count"] or 0,
            "total_amount": item.get("total_amount"),
            "paid_amount": item.get("paid_amount"),
            "cash_collected_amount": item.get("cash_collected_amount"),
        }
        output.append(_add_financial_fields(row))

    return output


# ============================================================
# 🔹 Summary Builder
# ============================================================

def _build_summary(queryset) -> dict[str, Any]:
    total_orders = _count(queryset)

    totals = queryset.aggregate(
        pending_orders=Count("id", filter=Q(status=Order.Status.PENDING)),
        confirmed_orders=Count("id", filter=Q(status=Order.Status.CONFIRMED)),
        processing_orders=Count("id", filter=Q(status=Order.Status.PROCESSING)),
        card_ready_orders=Count("id", filter=Q(status=Order.Status.CARD_READY)),
        assigned_for_delivery_orders=Count("id", filter=Q(status=Order.Status.ASSIGNED_FOR_DELIVERY)),
        out_for_delivery_orders=Count("id", filter=Q(status=Order.Status.OUT_FOR_DELIVERY)),
        delivered_orders=Count("id", filter=Q(status=Order.Status.DELIVERED)),
        completed_orders=Count("id", filter=Q(status=Order.Status.COMPLETED)),
        cancelled_orders=Count("id", filter=Q(status=Order.Status.CANCELLED)),
        refunded_orders=Count("id", filter=Q(status=Order.Status.REFUNDED)),

        unpaid_orders=Count("id", filter=Q(payment_status=Order.PaymentStatus.UNPAID)),
        cod_pending_orders=Count("id", filter=Q(payment_status=Order.PaymentStatus.COD_PENDING)),
        partially_paid_orders=Count("id", filter=Q(payment_status=Order.PaymentStatus.PARTIALLY_PAID)),
        paid_orders=Count("id", filter=Q(payment_status=Order.PaymentStatus.PAID)),
        failed_payment_orders=Count("id", filter=Q(payment_status=Order.PaymentStatus.FAILED)),
        refunded_payment_orders=Count("id", filter=Q(payment_status=Order.PaymentStatus.REFUNDED)),

        not_started_fulfillment_orders=Count(
            "id",
            filter=Q(fulfillment_status=Order.FulfillmentStatus.NOT_STARTED),
        ),
        pending_fulfillment_orders=Count(
            "id",
            filter=Q(fulfillment_status=Order.FulfillmentStatus.PENDING),
        ),
        in_progress_fulfillment_orders=Count(
            "id",
            filter=Q(fulfillment_status=Order.FulfillmentStatus.IN_PROGRESS),
        ),
        issued_fulfillment_orders=Count(
            "id",
            filter=Q(fulfillment_status=Order.FulfillmentStatus.ISSUED),
        ),
        ready_fulfillment_orders=Count(
            "id",
            filter=Q(fulfillment_status=Order.FulfillmentStatus.READY),
        ),
        assigned_fulfillment_orders=Count(
            "id",
            filter=Q(fulfillment_status=Order.FulfillmentStatus.ASSIGNED),
        ),
        out_for_delivery_fulfillment_orders=Count(
            "id",
            filter=Q(fulfillment_status=Order.FulfillmentStatus.OUT_FOR_DELIVERY),
        ),
        delivered_fulfillment_orders=Count(
            "id",
            filter=Q(fulfillment_status=Order.FulfillmentStatus.DELIVERED),
        ),
        failed_fulfillment_orders=Count(
            "id",
            filter=Q(fulfillment_status=Order.FulfillmentStatus.FAILED),
        ),
        returned_fulfillment_orders=Count(
            "id",
            filter=Q(fulfillment_status=Order.FulfillmentStatus.RETURNED),
        ),

        general_orders=Count("id", filter=Q(order_kind=Order.OrderKind.GENERAL)),
        card_orders=Count("id", filter=Q(order_kind=Order.OrderKind.CARD)),
        program_orders=Count("id", filter=Q(order_kind=Order.OrderKind.PROGRAM)),
        service_orders=Count("id", filter=Q(order_kind=Order.OrderKind.SERVICE)),
        subscription_orders=Count("id", filter=Q(order_kind=Order.OrderKind.SUBSCRIPTION)),

        payment_method_none_orders=Count("id", filter=Q(payment_method=Order.PaymentMethod.NONE)),
        cash_orders=Count("id", filter=Q(payment_method=Order.PaymentMethod.CASH)),
        cash_on_delivery_orders=Count("id", filter=Q(payment_method=Order.PaymentMethod.CASH_ON_DELIVERY)),
        bank_transfer_orders=Count("id", filter=Q(payment_method=Order.PaymentMethod.BANK_TRANSFER)),
        card_payment_orders=Count("id", filter=Q(payment_method=Order.PaymentMethod.CARD)),
        payment_gateway_orders=Count("id", filter=Q(payment_method=Order.PaymentMethod.PAYMENT_GATEWAY)),
        wallet_orders=Count("id", filter=Q(payment_method=Order.PaymentMethod.WALLET)),
        tamara_orders=Count("id", filter=Q(payment_method=Order.PaymentMethod.TAMARA)),
        tabby_orders=Count("id", filter=Q(payment_method=Order.PaymentMethod.TABBY)),
        other_payment_method_orders=Count("id", filter=Q(payment_method=Order.PaymentMethod.OTHER)),

        website_orders=Count("id", filter=Q(source=Order.OrderSource.WEBSITE)),
        whatsapp_orders=Count("id", filter=Q(source=Order.OrderSource.WHATSAPP)),
        agent_source_orders=Count("id", filter=Q(source=Order.OrderSource.AGENT)),
        admin_source_orders=Count("id", filter=Q(source=Order.OrderSource.ADMIN)),
        mobile_app_orders=Count("id", filter=Q(source=Order.OrderSource.MOBILE_APP)),
        landing_source_orders=Count("id", filter=Q(source=Order.OrderSource.LANDING)),
        checkout_source_orders=Count("id", filter=Q(source=Order.OrderSource.CHECKOUT)),

        orders_with_agent=Count("id", filter=Q(agent_id__isnull=False)),
        orders_without_agent=Count("id", filter=Q(agent_id__isnull=True)),
        orders_with_delivery_agent=Count("id", filter=Q(delivery_agent_id__isnull=False)),
        orders_without_delivery_agent=Count("id", filter=Q(delivery_agent_id__isnull=True)),
        orders_with_provider=Count("id", filter=Q(provider_id__isnull=False)),
        orders_without_provider=Count("id", filter=Q(provider_id__isnull=True)),
        orders_with_contract=Count("id", filter=Q(contract_id__isnull=False)),
        orders_without_contract=Count("id", filter=Q(contract_id__isnull=True)),

        orders_with_offer=Count("id", filter=Q(contract_product_id__isnull=False)),
        orders_without_offer=Count("id", filter=Q(contract_product_id__isnull=True)),
        orders_with_contract_product=Count("id", filter=Q(contract_product_id__isnull=False)),
        contract_product_orders=Count("id", filter=Q(offer_source=Order.OfferSource.CONTRACT_PRODUCT)),
        product_offer_orders=Count("id", filter=Q(offer_source=Order.OfferSource.PRODUCT)),
        manual_offer_orders=Count("id", filter=Q(offer_source=Order.OfferSource.MANUAL)),
        no_offer_orders=Count("id", filter=Q(offer_source=Order.OfferSource.NONE)),

        orders_with_start_date=Count("id", filter=Q(starts_at__isnull=False)),
        orders_with_end_date=Count("id", filter=Q(ends_at__isnull=False)),
        scheduled_orders=Count("id", filter=Q(scheduled_at__isnull=False)),
        orders_with_referral_code=Count("id", filter=~Q(referral_code_used="")),

        cash_collected_orders=Count(
            "id",
            filter=Q(cash_collected_amount__gt=Decimal("0.00"))
            | Q(cash_collected_at__isnull=False),
        ),
        cash_pending_collection_orders=Count(
            "id",
            filter=Q(payment_method=Order.PaymentMethod.CASH_ON_DELIVERY)
            & Q(payment_status=Order.PaymentStatus.COD_PENDING),
        ),

        gross_amount=Sum("total_amount"),
        paid_amount=Sum("amount_paid"),
        cash_collected_amount=Sum("cash_collected_amount"),
        subtotal_amount=Sum("subtotal_amount"),
        discount_amount=Sum("discount_amount"),
        tax_amount=Sum("tax_amount"),
    )

    gross_amount = _money(totals.get("gross_amount"))
    paid_amount = _money(totals.get("paid_amount"))
    cash_collected_amount = _money(totals.get("cash_collected_amount"))
    remaining_amount = _remaining(gross_amount, paid_amount)

    completed_orders = totals["completed_orders"] or 0
    delivered_orders = totals["delivered_orders"] or 0
    cancelled_orders = totals["cancelled_orders"] or 0
    refunded_orders = totals["refunded_orders"] or 0
    paid_orders = totals["paid_orders"] or 0
    card_orders = totals["card_orders"] or 0
    program_orders = totals["program_orders"] or 0
    service_orders = totals["service_orders"] or 0
    subscription_orders = totals["subscription_orders"] or 0
    cash_on_delivery_orders = totals["cash_on_delivery_orders"] or 0
    cash_collected_orders = totals["cash_collected_orders"] or 0
    orders_with_offer = totals["orders_with_offer"] or 0
    contract_product_orders = totals["contract_product_orders"] or 0

    return {
        "total_orders": total_orders,

        "pending_orders": totals["pending_orders"] or 0,
        "confirmed_orders": totals["confirmed_orders"] or 0,
        "processing_orders": totals["processing_orders"] or 0,
        "card_ready_orders": totals["card_ready_orders"] or 0,
        "assigned_for_delivery_orders": totals["assigned_for_delivery_orders"] or 0,
        "out_for_delivery_orders": totals["out_for_delivery_orders"] or 0,
        "delivered_orders": delivered_orders,
        "completed_orders": completed_orders,
        "cancelled_orders": cancelled_orders,
        "refunded_orders": refunded_orders,

        "unpaid_orders": totals["unpaid_orders"] or 0,
        "cod_pending_orders": totals["cod_pending_orders"] or 0,
        "partially_paid_orders": totals["partially_paid_orders"] or 0,
        "paid_orders": paid_orders,
        "failed_payment_orders": totals["failed_payment_orders"] or 0,
        "refunded_payment_orders": totals["refunded_payment_orders"] or 0,

        "not_started_fulfillment_orders": totals["not_started_fulfillment_orders"] or 0,
        "pending_fulfillment_orders": totals["pending_fulfillment_orders"] or 0,
        "in_progress_fulfillment_orders": totals["in_progress_fulfillment_orders"] or 0,
        "issued_fulfillment_orders": totals["issued_fulfillment_orders"] or 0,
        "ready_fulfillment_orders": totals["ready_fulfillment_orders"] or 0,
        "assigned_fulfillment_orders": totals["assigned_fulfillment_orders"] or 0,
        "out_for_delivery_fulfillment_orders": totals["out_for_delivery_fulfillment_orders"] or 0,
        "delivered_fulfillment_orders": totals["delivered_fulfillment_orders"] or 0,
        "failed_fulfillment_orders": totals["failed_fulfillment_orders"] or 0,
        "returned_fulfillment_orders": totals["returned_fulfillment_orders"] or 0,

        "general_orders": totals["general_orders"] or 0,
        "card_orders": card_orders,
        "program_orders": program_orders,
        "service_orders": service_orders,
        "subscription_orders": subscription_orders,
        "subscription_like_orders": card_orders + program_orders + subscription_orders,

        "payment_method_none_orders": totals["payment_method_none_orders"] or 0,
        "cash_orders": totals["cash_orders"] or 0,
        "cash_on_delivery_orders": cash_on_delivery_orders,
        "bank_transfer_orders": totals["bank_transfer_orders"] or 0,
        "card_payment_orders": totals["card_payment_orders"] or 0,
        "payment_gateway_orders": totals["payment_gateway_orders"] or 0,
        "wallet_orders": totals["wallet_orders"] or 0,
        "tamara_orders": totals["tamara_orders"] or 0,
        "tabby_orders": totals["tabby_orders"] or 0,
        "other_payment_method_orders": totals["other_payment_method_orders"] or 0,

        "website_orders": totals["website_orders"] or 0,
        "whatsapp_orders": totals["whatsapp_orders"] or 0,
        "agent_source_orders": totals["agent_source_orders"] or 0,
        "admin_source_orders": totals["admin_source_orders"] or 0,
        "mobile_app_orders": totals["mobile_app_orders"] or 0,
        "landing_source_orders": totals["landing_source_orders"] or 0,
        "checkout_source_orders": totals["checkout_source_orders"] or 0,

        "orders_with_agent": totals["orders_with_agent"] or 0,
        "orders_without_agent": totals["orders_without_agent"] or 0,
        "orders_with_delivery_agent": totals["orders_with_delivery_agent"] or 0,
        "orders_without_delivery_agent": totals["orders_without_delivery_agent"] or 0,
        "orders_with_provider": totals["orders_with_provider"] or 0,
        "orders_without_provider": totals["orders_without_provider"] or 0,
        "orders_with_contract": totals["orders_with_contract"] or 0,
        "orders_without_contract": totals["orders_without_contract"] or 0,

        "orders_with_offer": orders_with_offer,
        "orders_without_offer": totals["orders_without_offer"] or 0,
        "orders_with_contract_product": totals["orders_with_contract_product"] or 0,
        "contract_product_orders": contract_product_orders,
        "product_offer_orders": totals["product_offer_orders"] or 0,
        "manual_offer_orders": totals["manual_offer_orders"] or 0,
        "no_offer_orders": totals["no_offer_orders"] or 0,

        "orders_with_start_date": totals["orders_with_start_date"] or 0,
        "orders_with_end_date": totals["orders_with_end_date"] or 0,
        "scheduled_orders": totals["scheduled_orders"] or 0,
        "orders_with_referral_code": totals["orders_with_referral_code"] or 0,

        "cash_collected_orders": cash_collected_orders,
        "cash_pending_collection_orders": totals["cash_pending_collection_orders"] or 0,

        "subtotal_amount": _money(totals.get("subtotal_amount")),
        "discount_amount": _money(totals.get("discount_amount")),
        "tax_amount": _money(totals.get("tax_amount")),
        "gross_amount": gross_amount,
        "paid_amount": paid_amount,
        "cash_collected_amount": cash_collected_amount,
        "remaining_amount": remaining_amount,

        "collection_rate": _percentage(paid_amount, gross_amount),
        "cod_collection_rate": _percentage(cash_collected_orders, cash_on_delivery_orders),
        "completion_rate": _percentage(completed_orders, total_orders),
        "delivery_rate": _percentage(delivered_orders, total_orders),
        "cancellation_rate": _percentage(cancelled_orders, total_orders),
        "refund_rate": _percentage(refunded_orders, total_orders),
        "paid_orders_rate": _percentage(paid_orders, total_orders),
        "card_orders_rate": _percentage(card_orders, total_orders),
        "program_orders_rate": _percentage(program_orders, total_orders),
        "service_orders_rate": _percentage(service_orders, total_orders),
        "subscription_orders_rate": _percentage(subscription_orders, total_orders),
        "orders_with_offer_rate": _percentage(orders_with_offer, total_orders),
        "contract_product_orders_rate": _percentage(contract_product_orders, total_orders),

        "currency": "SAR",
    }


# ============================================================
# 🔹 Context / Filters
# ============================================================

def _build_filters_payload(request) -> dict[str, Any]:
    return {
        "q": request.GET.get("q") or request.GET.get("search") or "",
        "status": request.GET.get("status") or "",
        "payment_status": request.GET.get("payment_status") or "",
        "fulfillment_status": request.GET.get("fulfillment_status") or "",
        "source": request.GET.get("source") or "",
        "order_kind": request.GET.get("order_kind") or request.GET.get("kind") or "",
        "payment_method": request.GET.get("payment_method") or "",
        "offer_source": request.GET.get("offer_source") or "",
        "customer_id": request.GET.get("customer_id") or "",
        "product_id": request.GET.get("product_id") or "",
        "provider_id": request.GET.get("provider_id") or "",
        "contract_id": request.GET.get("contract_id") or "",
        "contract_product_id": (
            request.GET.get("contract_product_id")
            or request.GET.get("offer_id")
            or ""
        ),
        "offer_id": request.GET.get("offer_id") or "",
        "agent_id": request.GET.get("agent_id") or "",
        "delivery_agent_id": request.GET.get("delivery_agent_id") or "",
        "invoice_id": request.GET.get("invoice_id") or "",
        "created_by_id": request.GET.get("created_by_id") or "",
        "is_cod": request.GET.get("is_cod") or "",
        "cash_collected": request.GET.get("cash_collected") or "",
        "starts_from": request.GET.get("starts_from") or request.GET.get("start_from") or "",
        "starts_to": request.GET.get("starts_to") or request.GET.get("start_to") or "",
        "ends_from": request.GET.get("ends_from") or request.GET.get("end_from") or "",
        "ends_to": request.GET.get("ends_to") or request.GET.get("end_to") or "",
        "date_from": request.GET.get("date_from") or "",
        "date_to": request.GET.get("date_to") or "",
    }


def _build_report_context(queryset, request) -> dict[str, Any]:
    total_orders = _count(queryset)

    return {
        "scope": "orders",
        "total_filtered_orders": total_orders,
        "currency": "SAR",
        "filters_applied": {
            key: value
            for key, value in _build_filters_payload(request).items()
            if value not in (None, "")
        },
        "supports": {
            "agent_breakdown": True,
            "delivery_agent_breakdown": True,
            "provider_breakdown": True,
            "contract_breakdown": True,
            "product_breakdown": True,
            "contract_product_breakdown": True,
            "offer_source_breakdown": True,
            "offer_breakdown": True,
            "order_kind_breakdown": True,
            "payment_method_breakdown": True,
            "referral_breakdown": True,
            "financial_summary": True,
            "delivery_breakdown": True,
            "cash_collection_breakdown": True,
            "latest_orders": True,
        },
    }


# ============================================================
# 🔹 Orders Reports API
# ============================================================

@require_http_methods(["GET"])
def orders_reports_api(request):
    user, auth_error = _ensure_authenticated(request)

    if auth_error:
        return auth_error

    try:
        queryset = apply_order_filters(_orders_queryset(), request.GET)

        latest_orders = queryset.order_by("-created_at", "-id")[:10]

        payload = {
            "summary": _build_summary(queryset),
            "status_breakdown": _build_status_breakdown(queryset),
            "payment_breakdown": _build_payment_breakdown(queryset),
            "fulfillment_breakdown": _build_fulfillment_breakdown(queryset),
            "source_breakdown": _build_source_breakdown(queryset),
            "offer_source_breakdown": _build_offer_source_breakdown(queryset),
            "order_kind_breakdown": _build_order_kind_breakdown(queryset),
            "payment_method_breakdown": _build_payment_method_breakdown(queryset),
            "delivery_breakdown": _build_delivery_breakdown(queryset),
            "cash_collection_breakdown": _build_cash_collection_breakdown(queryset),
            "provider_breakdown": _build_provider_breakdown(queryset),
            "agent_breakdown": _build_agent_breakdown(queryset),
            "delivery_agent_breakdown": _build_delivery_agent_breakdown(queryset),
            "contract_breakdown": _build_contract_breakdown(queryset),
            "contract_product_breakdown": _build_contract_product_breakdown(queryset),
            "offer_breakdown": _build_contract_product_breakdown(queryset),
            "product_breakdown": _build_product_breakdown(queryset),
            "referral_breakdown": _build_referral_breakdown(queryset),
            "latest_orders": [
                serialize_order(order, include_history=False)
                for order in latest_orders
            ],
            "filters": _build_filters_payload(request),
            "context": _build_report_context(queryset, request),
        }

        return _json_success(
            payload,
            message="Orders report loaded successfully.",
            extra={
                "results": payload,
                "summary": payload["summary"],
            },
        )

    except ValidationError as exc:
        return _json_error(
            "Validation failed while loading orders report.",
            400,
            errors=_validation_errors(exc),
        )

    except Exception as exc:
        logger.exception("Failed to load orders report: %s", exc)
        return _json_error("Unexpected error while loading orders report.", 500)