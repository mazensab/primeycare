# ============================================================
# 📂 api/orders/reports.py
# 🧭 Primey Care — Orders Reports API V2
# ------------------------------------------------------------
# ✅ Orders summary
# ✅ Financial summary
# ✅ Status breakdown
# ✅ Payment breakdown
# ✅ Fulfillment breakdown
# ✅ Source breakdown
# ✅ Provider / Agent / Product breakdown
# ✅ Latest orders
# ✅ Unified response: ok / success / data
# ✅ Compatible with Accounting / Treasury backend flow
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
) -> JsonResponse:
    return JsonResponse(
        {
            "ok": True,
            "success": True,
            "message": message,
            "data": _decimal_to_string(data),
        },
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


def _safe_text(value: Any) -> str:
    return str(value or "").strip()


def _orders_queryset():
    return (
        Order.objects.select_related(
            "customer",
            "product",
            "provider",
            "contract",
            "agent",
            "created_by",
            "updated_by",
        )
        .prefetch_related("status_history")
        .all()
    )


def _aggregate_money(queryset, field_name: str) -> Decimal:
    return _money(queryset.aggregate(total=Sum(field_name)).get("total"))


def _count(queryset) -> int:
    return int(queryset.count() or 0)


def _percentage(part: int | Decimal, total: int | Decimal) -> Decimal:
    total_decimal = Decimal(str(total or "0"))

    if total_decimal <= Decimal("0"):
        return Decimal("0.00")

    return _money(Decimal(str(part or "0")) * Decimal("100.00") / total_decimal)


# ============================================================
# 🔹 Breakdown Builders
# ============================================================

def _status_label(value: str) -> str:
    try:
        return dict(Order.Status.choices).get(value, value)
    except Exception:
        return value


def _payment_status_label(value: str) -> str:
    try:
        return dict(Order.PaymentStatus.choices).get(value, value)
    except Exception:
        return value


def _fulfillment_status_label(value: str) -> str:
    try:
        return dict(Order.FulfillmentStatus.choices).get(value, value)
    except Exception:
        return value


def _source_label(value: str) -> str:
    try:
        return dict(Order.OrderSource.choices).get(value, value)
    except Exception:
        return value


def _build_status_breakdown(queryset) -> list[dict[str, Any]]:
    rows = (
        queryset.values("status")
        .annotate(
            count=Count("id"),
            total_amount=Sum("total_amount"),
            paid_amount=Sum("amount_paid"),
            remaining_amount=Sum("remaining_amount"),
        )
        .order_by("status")
    )

    total_orders = _count(queryset)

    return [
        {
            "status": item["status"],
            "label": _status_label(item["status"]),
            "count": item["count"] or 0,
            "percentage": _percentage(item["count"] or 0, total_orders),
            "total_amount": _money(item["total_amount"]),
            "paid_amount": _money(item["paid_amount"]),
            "remaining_amount": _money(item["remaining_amount"]),
        }
        for item in rows
    ]


def _build_payment_breakdown(queryset) -> list[dict[str, Any]]:
    rows = (
        queryset.values("payment_status")
        .annotate(
            count=Count("id"),
            total_amount=Sum("total_amount"),
            paid_amount=Sum("amount_paid"),
            remaining_amount=Sum("remaining_amount"),
        )
        .order_by("payment_status")
    )

    total_orders = _count(queryset)

    return [
        {
            "payment_status": item["payment_status"],
            "label": _payment_status_label(item["payment_status"]),
            "count": item["count"] or 0,
            "percentage": _percentage(item["count"] or 0, total_orders),
            "total_amount": _money(item["total_amount"]),
            "paid_amount": _money(item["paid_amount"]),
            "remaining_amount": _money(item["remaining_amount"]),
        }
        for item in rows
    ]


def _build_fulfillment_breakdown(queryset) -> list[dict[str, Any]]:
    rows = (
        queryset.values("fulfillment_status")
        .annotate(
            count=Count("id"),
            total_amount=Sum("total_amount"),
            paid_amount=Sum("amount_paid"),
            remaining_amount=Sum("remaining_amount"),
        )
        .order_by("fulfillment_status")
    )

    total_orders = _count(queryset)

    return [
        {
            "fulfillment_status": item["fulfillment_status"],
            "label": _fulfillment_status_label(item["fulfillment_status"]),
            "count": item["count"] or 0,
            "percentage": _percentage(item["count"] or 0, total_orders),
            "total_amount": _money(item["total_amount"]),
            "paid_amount": _money(item["paid_amount"]),
            "remaining_amount": _money(item["remaining_amount"]),
        }
        for item in rows
    ]


def _build_source_breakdown(queryset) -> list[dict[str, Any]]:
    rows = (
        queryset.values("source")
        .annotate(
            count=Count("id"),
            total_amount=Sum("total_amount"),
            paid_amount=Sum("amount_paid"),
            remaining_amount=Sum("remaining_amount"),
        )
        .order_by("source")
    )

    total_orders = _count(queryset)

    return [
        {
            "source": item["source"],
            "label": _source_label(item["source"]),
            "count": item["count"] or 0,
            "percentage": _percentage(item["count"] or 0, total_orders),
            "total_amount": _money(item["total_amount"]),
            "paid_amount": _money(item["paid_amount"]),
            "remaining_amount": _money(item["remaining_amount"]),
        }
        for item in rows
    ]


def _build_provider_breakdown(queryset) -> list[dict[str, Any]]:
    rows = (
        queryset.values(
            "provider_id",
            "provider__name",
            "provider__display_name",
            "provider__provider_name",
            "provider__code",
            "provider__provider_code",
        )
        .annotate(
            count=Count("id"),
            total_amount=Sum("total_amount"),
            paid_amount=Sum("amount_paid"),
            remaining_amount=Sum("remaining_amount"),
        )
        .order_by("-total_amount", "-count")[:20]
    )

    return [
        {
            "provider_id": item["provider_id"],
            "provider_name": (
                _safe_text(item.get("provider__name"))
                or _safe_text(item.get("provider__display_name"))
                or _safe_text(item.get("provider__provider_name"))
                or "غير محدد"
            ),
            "provider_code": (
                _safe_text(item.get("provider__code"))
                or _safe_text(item.get("provider__provider_code"))
            ),
            "count": item["count"] or 0,
            "total_amount": _money(item["total_amount"]),
            "paid_amount": _money(item["paid_amount"]),
            "remaining_amount": _money(item["remaining_amount"]),
        }
        for item in rows
    ]


def _build_agent_breakdown(queryset) -> list[dict[str, Any]]:
    rows = (
        queryset.values(
            "agent_id",
            "agent__agent_code",
            "agent__full_name",
            "agent__display_name",
            "agent__name",
        )
        .annotate(
            count=Count("id"),
            total_amount=Sum("total_amount"),
            paid_amount=Sum("amount_paid"),
            remaining_amount=Sum("remaining_amount"),
        )
        .order_by("-total_amount", "-count")[:20]
    )

    return [
        {
            "agent_id": item["agent_id"],
            "agent_code": _safe_text(item.get("agent__agent_code")),
            "agent_name": (
                _safe_text(item.get("agent__full_name"))
                or _safe_text(item.get("agent__display_name"))
                or _safe_text(item.get("agent__name"))
                or "غير محدد"
            ),
            "count": item["count"] or 0,
            "total_amount": _money(item["total_amount"]),
            "paid_amount": _money(item["paid_amount"]),
            "remaining_amount": _money(item["remaining_amount"]),
        }
        for item in rows
    ]


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
            remaining_amount=Sum("remaining_amount"),
        )
        .order_by("-total_amount", "-count")[:20]
    )

    return [
        {
            "product_id": item["product_id"],
            "product_name": _safe_text(item.get("product_name")) or "غير محدد",
            "product_code": _safe_text(item.get("product__code")),
            "product_type": _safe_text(item.get("product_type")),
            "count": item["count"] or 0,
            "quantity": item["quantity"] or 0,
            "total_amount": _money(item["total_amount"]),
            "paid_amount": _money(item["paid_amount"]),
            "remaining_amount": _money(item["remaining_amount"]),
        }
        for item in rows
    ]


# ============================================================
# 🔹 Summary Builder
# ============================================================

def _build_summary(queryset) -> dict[str, Any]:
    total_orders = _count(queryset)

    totals = queryset.aggregate(
        pending_orders=Count("id", filter=Q(status=Order.Status.PENDING)),
        confirmed_orders=Count("id", filter=Q(status=Order.Status.CONFIRMED)),
        processing_orders=Count("id", filter=Q(status=Order.Status.PROCESSING)),
        completed_orders=Count("id", filter=Q(status=Order.Status.COMPLETED)),
        cancelled_orders=Count("id", filter=Q(status=Order.Status.CANCELLED)),
        refunded_orders=Count("id", filter=Q(status=Order.Status.REFUNDED)),
        unpaid_orders=Count("id", filter=Q(payment_status=Order.PaymentStatus.UNPAID)),
        partially_paid_orders=Count("id", filter=Q(payment_status=Order.PaymentStatus.PARTIALLY_PAID)),
        paid_orders=Count("id", filter=Q(payment_status=Order.PaymentStatus.PAID)),
        refunded_payment_orders=Count("id", filter=Q(payment_status=Order.PaymentStatus.REFUNDED)),
        gross_amount=Sum("total_amount"),
        paid_amount=Sum("amount_paid"),
        remaining_amount=Sum("remaining_amount"),
        subtotal_amount=Sum("subtotal_amount"),
        discount_amount=Sum("discount_amount"),
        tax_amount=Sum("tax_amount"),
    )

    gross_amount = _money(totals.get("gross_amount"))
    paid_amount = _money(totals.get("paid_amount"))
    remaining_amount = _money(totals.get("remaining_amount"))

    return {
        "total_orders": total_orders,

        "pending_orders": totals["pending_orders"] or 0,
        "confirmed_orders": totals["confirmed_orders"] or 0,
        "processing_orders": totals["processing_orders"] or 0,
        "completed_orders": totals["completed_orders"] or 0,
        "cancelled_orders": totals["cancelled_orders"] or 0,
        "refunded_orders": totals["refunded_orders"] or 0,

        "unpaid_orders": totals["unpaid_orders"] or 0,
        "partially_paid_orders": totals["partially_paid_orders"] or 0,
        "paid_orders": totals["paid_orders"] or 0,
        "refunded_payment_orders": totals["refunded_payment_orders"] or 0,

        "subtotal_amount": _money(totals.get("subtotal_amount")),
        "discount_amount": _money(totals.get("discount_amount")),
        "tax_amount": _money(totals.get("tax_amount")),
        "gross_amount": gross_amount,
        "paid_amount": paid_amount,
        "remaining_amount": remaining_amount,

        "collection_rate": _percentage(paid_amount, gross_amount),
        "completion_rate": _percentage(totals["completed_orders"] or 0, total_orders),
        "cancellation_rate": _percentage(totals["cancelled_orders"] or 0, total_orders),
        "refund_rate": _percentage(totals["refunded_orders"] or 0, total_orders),

        "currency": "SAR",
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
            "provider_breakdown": _build_provider_breakdown(queryset),
            "agent_breakdown": _build_agent_breakdown(queryset),
            "product_breakdown": _build_product_breakdown(queryset),
            "latest_orders": [
                serialize_order(order, include_history=False)
                for order in latest_orders
            ],
            "filters": {
                "q": request.GET.get("q") or request.GET.get("search") or "",
                "status": request.GET.get("status") or "",
                "payment_status": request.GET.get("payment_status") or "",
                "fulfillment_status": request.GET.get("fulfillment_status") or "",
                "source": request.GET.get("source") or "",
                "customer_id": request.GET.get("customer_id") or "",
                "product_id": request.GET.get("product_id") or "",
                "provider_id": request.GET.get("provider_id") or "",
                "contract_id": request.GET.get("contract_id") or "",
                "agent_id": request.GET.get("agent_id") or "",
                "invoice_id": request.GET.get("invoice_id") or "",
                "date_from": request.GET.get("date_from") or "",
                "date_to": request.GET.get("date_to") or "",
            },
        }

        return _json_success(
            payload,
            message="Orders report loaded successfully.",
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