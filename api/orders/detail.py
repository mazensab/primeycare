# ============================================================
# 📂 api/orders/detail.py
# 🧭 Primey Care — Orders API Detail/Update/Delete
# ============================================================

from __future__ import annotations

import logging

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from orders.models import Order
from orders.services import (
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


# ============================================================
# 🔹 Order Detail API
# ============================================================

@require_http_methods(["GET", "PATCH", "DELETE"])
def order_detail_api(request, order_id: int):
    user, auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    order = get_object_or_404(
        Order.objects.select_related("customer", "product", "created_by", "updated_by")
        .prefetch_related("status_history"),
        pk=order_id,
    )

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
            order = update_order(instance=order, payload=payload, user=user)
            order.refresh_from_db()

            return JsonResponse(
                {
                    "ok": True,
                    "message": "Order updated successfully.",
                    "data": serialize_order(
                        Order.objects.select_related("customer", "product", "created_by", "updated_by")
                        .prefetch_related("status_history")
                        .get(pk=order.pk)
                    ),
                },
                status=200,
            )
        except ValidationError as exc:
            return _json_error("Validation failed while updating order.", 400, errors=exc.messages)
        except Exception as exc:
            logger.exception("Failed to update order %s: %s", order_id, exc)
            return _json_error("Unexpected error while updating order.", 500)

    if not order.can_be_cancelled:
        return _json_error("This order cannot be deleted in its current state.", 400)

    order.delete()
    return JsonResponse(
        {
            "ok": True,
            "message": "Order deleted successfully.",
        },
        status=200,
    )