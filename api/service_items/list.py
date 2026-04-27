# ============================================================
# 📂 api/service_items/list.py
# 🧠 Primey Care | Service Items API List/Create
# ============================================================

from __future__ import annotations

import logging

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from service_items.models import ContractServiceItem, ServiceItemStatus
from service_items.services import (
    apply_service_item_filters,
    create_service_item,
    paginate_queryset,
    parse_int,
    parse_json_body,
    serialize_service_item,
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
# 🔹 Service Items API
# ============================================================

@require_http_methods(["GET", "POST"])
def service_items_api(request):
    user, auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method == "GET":
        queryset = (
            ContractServiceItem.objects.select_related(
                "contract",
                "contract__provider",
                "contract_product",
                "contract_product__product",
            ).all()
        )
        queryset = apply_service_item_filters(queryset, request.GET)

        page = parse_int(request.GET.get("page"), 1) or 1
        page_size = parse_int(request.GET.get("page_size"), 20) or 20

        paginated = paginate_queryset(queryset, page=page, page_size=page_size)

        return JsonResponse(
            {
                "ok": True,
                "message": "Service items loaded successfully.",
                "results": [serialize_service_item(item) for item in paginated["items"]],
                "pagination": paginated["pagination"],
            },
            status=200,
        )

    try:
        payload = parse_json_body(request)
        item = create_service_item(payload=payload)

        return JsonResponse(
            {
                "ok": True,
                "message": "Service item created successfully.",
                "data": serialize_service_item(item),
            },
            status=201,
        )
    except ValidationError as exc:
        return _json_error("Validation failed while creating service item.", 400, errors=exc.messages)
    except Exception as exc:
        logger.exception("Failed to create service item: %s", exc)
        return _json_error("Unexpected error while creating service item.", 500)


# ============================================================
# 🔹 Active Service Items API
# ============================================================

@require_http_methods(["GET"])
def active_service_items_api(request):
    queryset = (
        ContractServiceItem.objects.select_related(
            "contract",
            "contract__provider",
            "contract_product",
            "contract_product__product",
        )
        .filter(status=ServiceItemStatus.ACTIVE)
    )
    queryset = apply_service_item_filters(queryset, request.GET)

    page = parse_int(request.GET.get("page"), 1) or 1
    page_size = parse_int(request.GET.get("page_size"), 20) or 20

    paginated = paginate_queryset(queryset, page=page, page_size=page_size)

    return JsonResponse(
        {
            "ok": True,
            "message": "Active service items loaded successfully.",
            "results": [serialize_service_item(item) for item in paginated["items"]],
            "pagination": paginated["pagination"],
        },
        status=200,
    )