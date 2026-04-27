# ============================================================
# 📂 api/order_items/list.py
# 🧠 Primey Care | Order Items API List/Create
# ============================================================

from __future__ import annotations

import logging

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from order_items.models import OrderItem, OrderItemStatus
from order_items.services import (
    apply_order_item_filters,
    create_order_item,
    paginate_queryset,
    parse_int,
    parse_json_body,
    serialize_order_item,
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
# 🔹 Order Items API
# ============================================================

@require_http_methods(["GET", "POST"])
def order_items_api(request):
    user, auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method == "GET":
        queryset = (
            OrderItem.objects.select_related(
                "order",
                "order__customer",
                "product",
                "provider",
                "contract",
                "contract_product",
                "contract_product__product",
                "service_item",
            ).all()
        )
        queryset = apply_order_item_filters(queryset, request.GET)

        page = parse_int(request.GET.get("page"), 1) or 1
        page_size = parse_int(request.GET.get("page_size"), 20) or 20

        paginated = paginate_queryset(queryset, page=page, page_size=page_size)

        return JsonResponse(
            {
                "ok": True,
                "message": "Order items loaded successfully.",
                "results": [serialize_order_item(item) for item in paginated["items"]],
                "pagination": paginated["pagination"],
            },
            status=200,
        )

    try:
        payload = parse_json_body(request)
        item = create_order_item(payload=payload)

        return JsonResponse(
            {
                "ok": True,
                "message": "Order item created successfully.",
                "data": serialize_order_item(item),
            },
            status=201,
        )
    except ValidationError as exc:
        return _json_error("Validation failed while creating order item.", 400, errors=exc.messages)
    except Exception as exc:
        logger.exception("Failed to create order item: %s", exc)
        return _json_error("Unexpected error while creating order item.", 500)


# ============================================================
# 🔹 Pending Order Items API
# ============================================================

@require_http_methods(["GET"])
def pending_order_items_api(request):
    queryset = (
        OrderItem.objects.select_related(
            "order",
            "order__customer",
            "product",
            "provider",
            "contract",
            "contract_product",
            "contract_product__product",
            "service_item",
        )
        .filter(status=OrderItemStatus.PENDING)
    )
    queryset = apply_order_item_filters(queryset, request.GET)

    page = parse_int(request.GET.get("page"), 1) or 1
    page_size = parse_int(request.GET.get("page_size"), 20) or 20

    paginated = paginate_queryset(queryset, page=page, page_size=page_size)

    return JsonResponse(
        {
            "ok": True,
            "message": "Pending order items loaded successfully.",
            "results": [serialize_order_item(item) for item in paginated["items"]],
            "pagination": paginated["pagination"],
        },
        status=200,
    )