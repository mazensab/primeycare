# ============================================================
# 📂 api/orders/list.py
# 🧭 Primey Care — Orders API List/Create
# ============================================================

from __future__ import annotations

import logging

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from orders.models import Order
from orders.services import (
    apply_order_filters,
    create_order,
    paginate_queryset,
    parse_int,
    parse_json_body,
    serialize_order,
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
# 🔹 Orders API
# ============================================================

@require_http_methods(["GET", "POST"])
def orders_api(request):
    user, auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method == "GET":
        queryset = (
            Order.objects.select_related("customer", "product", "created_by", "updated_by")
            .prefetch_related("status_history")
            .all()
        )
        queryset = apply_order_filters(queryset, request.GET)

        page = parse_int(request.GET.get("page"), 1) or 1
        page_size = parse_int(request.GET.get("page_size"), 20) or 20

        paginated = paginate_queryset(queryset, page=page, page_size=page_size)

        return JsonResponse(
            {
                "ok": True,
                "message": "Orders loaded successfully.",
                "results": [serialize_order(item) for item in paginated["items"]],
                "pagination": paginated["pagination"],
            },
            status=200,
        )

    try:
        payload = parse_json_body(request)
        order = create_order(payload=payload, user=user)

        return JsonResponse(
            {
                "ok": True,
                "message": "Order created successfully.",
                "data": serialize_order(order),
            },
            status=201,
        )
    except ValidationError as exc:
        return _json_error("Validation failed while creating order.", 400, errors=exc.messages)
    except Exception as exc:
        logger.exception("Failed to create order: %s", exc)
        return _json_error("Unexpected error while creating order.", 500)


# ============================================================
# 🔹 Active / Open Orders API
# ============================================================

@require_http_methods(["GET"])
def open_orders_api(request):
    queryset = (
        Order.objects.select_related("customer", "product", "created_by", "updated_by")
        .prefetch_related("status_history")
        .exclude(
            status__in=[
                Order.Status.CANCELLED,
                Order.Status.REFUNDED,
                Order.Status.COMPLETED,
            ]
        )
    )
    queryset = apply_order_filters(queryset, request.GET)

    page = parse_int(request.GET.get("page"), 1) or 1
    page_size = parse_int(request.GET.get("page_size"), 20) or 20

    paginated = paginate_queryset(queryset, page=page, page_size=page_size)

    return JsonResponse(
        {
            "ok": True,
            "message": "Open orders loaded successfully.",
            "results": [serialize_order(item) for item in paginated["items"]],
            "pagination": paginated["pagination"],
        },
        status=200,
    )