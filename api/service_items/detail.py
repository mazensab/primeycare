# ============================================================
# 📂 api/service_items/detail.py
# 🧠 Primey Care | Service Items API Detail/Update/Delete
# ============================================================

from __future__ import annotations

import logging

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from service_items.models import ContractServiceItem
from service_items.services import (
    parse_json_body,
    serialize_service_item,
    update_service_item,
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
# 🔹 Service Item Detail API
# ============================================================

@require_http_methods(["GET", "PATCH", "DELETE"])
def service_item_detail_api(request, service_item_id: int):
    user, auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    item = get_object_or_404(
        ContractServiceItem.objects.select_related(
            "contract",
            "contract__provider",
            "contract_product",
            "contract_product__product",
        ),
        pk=service_item_id,
    )

    if request.method == "GET":
        return JsonResponse(
            {
                "ok": True,
                "message": "Service item loaded successfully.",
                "data": serialize_service_item(item),
            },
            status=200,
        )

    if request.method == "PATCH":
        try:
            payload = parse_json_body(request)
            item = update_service_item(instance=item, payload=payload)
            item.refresh_from_db()

            return JsonResponse(
                {
                    "ok": True,
                    "message": "Service item updated successfully.",
                    "data": serialize_service_item(
                        ContractServiceItem.objects.select_related(
                            "contract",
                            "contract__provider",
                            "contract_product",
                            "contract_product__product",
                        ).get(pk=item.pk)
                    ),
                },
                status=200,
            )
        except ValidationError as exc:
            return _json_error("Validation failed while updating service item.", 400, errors=exc.messages)
        except Exception as exc:
            logger.exception("Failed to update service item %s: %s", service_item_id, exc)
            return _json_error("Unexpected error while updating service item.", 500)

    item.delete()
    return JsonResponse(
        {
            "ok": True,
            "message": "Service item deleted successfully.",
        },
        status=200,
    )