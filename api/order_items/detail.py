# ============================================================
# 📂 api/order_items/detail.py
# 🧠 Primey Care | Order Items API Detail/Update/Delete
# ============================================================

from __future__ import annotations

import logging

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from order_items.models import OrderItem
from order_items.services import (
    parse_json_body,
    serialize_order_item,
    update_order_item,
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
# 🔹 Order Item Detail API
# ============================================================

@require_http_methods(["GET", "PATCH", "DELETE"])
def order_item_detail_api(request, order_item_id: int):
    user, auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    item = get_object_or_404(
        OrderItem.objects.select_related(
            "order",
            "order__customer",
            "product",
            "provider",
            "contract",
            "contract_product",
            "contract_product__product",
            "service_item",
        ),
        pk=order_item_id,
    )

    if request.method == "GET":
        return JsonResponse(
            {
                "ok": True,
                "message": "Order item loaded successfully.",
                "data": serialize_order_item(item),
            },
            status=200,
        )

    if request.method == "PATCH":
        try:
            payload = parse_json_body(request)
            item = update_order_item(instance=item, payload=payload)
            item.refresh_from_db()

            return JsonResponse(
                {
                    "ok": True,
                    "message": "Order item updated successfully.",
                    "data": serialize_order_item(
                        OrderItem.objects.select_related(
                            "order",
                            "order__customer",
                            "product",
                            "provider",
                            "contract",
                            "contract_product",
                            "contract_product__product",
                            "service_item",
                        ).get(pk=item.pk)
                    ),
                },
                status=200,
            )
        except ValidationError as exc:
            return _json_error("Validation failed while updating order item.", 400, errors=exc.messages)
        except Exception as exc:
            logger.exception("Failed to update order item %s: %s", order_item_id, exc)
            return _json_error("Unexpected error while updating order item.", 500)

    item.delete()
    return JsonResponse(
        {
            "ok": True,
            "message": "Order item deleted successfully.",
        },
        status=200,
    )