# ============================================================
# 📂 api/orders/detail.py
# 🧭 Primey Care — Orders API Detail/Update/Cancel
# ============================================================

from __future__ import annotations

import logging

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from orders.models import Order
from orders.services import (
    cancel_order,
    parse_json_body,
    serialize_order,
    update_order,
)

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
# 🔹 Order Detail API
# ============================================================

@require_http_methods(["GET", "PATCH", "DELETE"])
def order_detail_api(request, order_id: int):
    user, auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    order = get_object_or_404(_orders_queryset(), pk=order_id)

    if request.method == "GET":
        return JsonResponse(
            {
                "ok": True,
                "message": "Order loaded successfully.",
                "data": serialize_order(order),
            },
            status=200,
        )

    if request.method == "PATCH":
        try:
            payload = parse_json_body(request)
            updated_order = update_order(instance=order, payload=payload, user=user)
            fresh_order = _orders_queryset().get(pk=updated_order.pk)

            return JsonResponse(
                {
                    "ok": True,
                    "message": "Order updated successfully.",
                    "data": serialize_order(fresh_order),
                },
                status=200,
            )
        except ValidationError as exc:
            return _json_error("Validation failed while updating order.", 400, errors=exc.messages)
        except Exception as exc:
            logger.exception("Failed to update order %s: %s", order_id, exc)
            return _json_error("Unexpected error while updating order.", 500)

    if request.method == "DELETE":
        try:
            payload = parse_json_body(request)
            reason = payload.get("reason") or payload.get("cancellation_reason") or "Cancelled from order detail API."

            cancelled_order = cancel_order(
                instance=order,
                reason=reason,
                user=user,
                note=payload.get("status_note") or reason,
            )
            fresh_order = _orders_queryset().get(pk=cancelled_order.pk)

            return JsonResponse(
                {
                    "ok": True,
                    "message": "Order cancelled successfully.",
                    "data": serialize_order(fresh_order),
                },
                status=200,
            )
        except ValidationError as exc:
            return _json_error("Validation failed while cancelling order.", 400, errors=exc.messages)
        except Exception as exc:
            logger.exception("Failed to cancel order %s: %s", order_id, exc)
            return _json_error("Unexpected error while cancelling order.", 500)

    return _json_error("Unsupported method.", 405)