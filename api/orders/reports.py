# ============================================================
# 📂 api/orders/reports.py
# 🧭 Primey Care — Orders Reports API
# ============================================================

from __future__ import annotations

import logging
from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from orders.models import Order
from orders.services import apply_order_filters, serialize_order

logger = logging.getLogger(__name__)


# ============================================================
# 🔹 Helpers
# ============================================================

def _json_error(message: str, status: int = 400, *, errors=None) -> JsonResponse:
    payload = {
        "ok": False,
        "message": message,
    }
    if errors is not None:
        payload["errors"] = errors
    return JsonResponse(payload, status=status)


def _ensure_authenticated(request):
    if not getattr(request, "user", None) or not request.user.is_authenticated:
        return None, _json_error("Authentication required.", 401)
    return request.user, None


def _money(value) -> str:
    if value is None:
        return "0.00"
    if isinstance(value, Decimal):
        return str(value.quantize(Decimal("0.01")))
    return str(value)


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

        totals = queryset.aggregate(
            total_orders=Count("id"),
            pending_orders=Count("id", filter=Q(status=Order.Status.PENDING)),
            confirmed_orders=Count("id", filter=Q(status=Order.Status.CONFIRMED)),
            processing_orders=Count("id", filter=Q(status=Order.Status.PROCESSING)),
            completed_orders=Count("id", filter=Q(status=Order.Status.COMPLETED)),
            cancelled_orders=Count("id", filter=Q(status=Order.Status.CANCELLED)),
            refunded_orders=Count("id", filter=Q(status=Order.Status.REFUNDED)),
            unpaid_orders=Count("id", filter=Q(payment_status=Order.PaymentStatus.UNPAID)),
            partially_paid_orders=Count("id", filter=Q(payment_status=Order.PaymentStatus.PARTIALLY_PAID)),
            paid_orders=Count("id", filter=Q(payment_status=Order.PaymentStatus.PAID)),
            gross_amount=Sum("total_amount"),
            paid_amount=Sum("amount_paid"),
            discount_amount=Sum("discount_amount"),
            tax_amount=Sum("tax_amount"),
        )

        status_breakdown = list(
            queryset.values("status")
            .annotate(
                count=Count("id"),
                total_amount=Sum("total_amount"),
                paid_amount=Sum("amount_paid"),
            )
            .order_by("status")
        )

        payment_breakdown = list(
            queryset.values("payment_status")
            .annotate(
                count=Count("id"),
                total_amount=Sum("total_amount"),
                paid_amount=Sum("amount_paid"),
            )
            .order_by("payment_status")
        )

        source_breakdown = list(
            queryset.values("source")
            .annotate(
                count=Count("id"),
                total_amount=Sum("total_amount"),
                paid_amount=Sum("amount_paid"),
            )
            .order_by("source")
        )

        latest_orders = queryset.order_by("-created_at")[:10]

        return JsonResponse(
            {
                "ok": True,
                "message": "Orders report loaded successfully.",
                "data": {
                    "summary": {
                        "total_orders": totals["total_orders"] or 0,
                        "pending_orders": totals["pending_orders"] or 0,
                        "confirmed_orders": totals["confirmed_orders"] or 0,
                        "processing_orders": totals["processing_orders"] or 0,
                        "completed_orders": totals["completed_orders"] or 0,
                        "cancelled_orders": totals["cancelled_orders"] or 0,
                        "refunded_orders": totals["refunded_orders"] or 0,
                        "unpaid_orders": totals["unpaid_orders"] or 0,
                        "partially_paid_orders": totals["partially_paid_orders"] or 0,
                        "paid_orders": totals["paid_orders"] or 0,
                        "gross_amount": _money(totals["gross_amount"]),
                        "paid_amount": _money(totals["paid_amount"]),
                        "discount_amount": _money(totals["discount_amount"]),
                        "tax_amount": _money(totals["tax_amount"]),
                    },
                    "status_breakdown": [
                        {
                            "status": item["status"],
                            "count": item["count"],
                            "total_amount": _money(item["total_amount"]),
                            "paid_amount": _money(item["paid_amount"]),
                        }
                        for item in status_breakdown
                    ],
                    "payment_breakdown": [
                        {
                            "payment_status": item["payment_status"],
                            "count": item["count"],
                            "total_amount": _money(item["total_amount"]),
                            "paid_amount": _money(item["paid_amount"]),
                        }
                        for item in payment_breakdown
                    ],
                    "source_breakdown": [
                        {
                            "source": item["source"],
                            "count": item["count"],
                            "total_amount": _money(item["total_amount"]),
                            "paid_amount": _money(item["paid_amount"]),
                        }
                        for item in source_breakdown
                    ],
                    "latest_orders": [
                        serialize_order(order, include_history=False)
                        for order in latest_orders
                    ],
                },
            },
            status=200,
        )

    except Exception as exc:
        logger.exception("Failed to load orders report: %s", exc)
        return _json_error("Unexpected error while loading orders report.", 500)