# ============================================================
# 📂 api/contracts/detail.py
# 🧠 Primey Care | Contracts API Detail/Update/Delete
# ============================================================

from __future__ import annotations

import logging

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from contracts.models import Contract
from contracts.services import (
    parse_json_body,
    serialize_contract,
    update_contract,
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
# 🔹 Contract Detail API
# ============================================================

@require_http_methods(["GET", "PATCH", "DELETE"])
def contract_detail_api(request, contract_id: int):
    user, auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    contract = get_object_or_404(
        Contract.objects.select_related("provider").prefetch_related("contract_products__product"),
        pk=contract_id,
    )

    if request.method == "GET":
        return JsonResponse(
            {
                "ok": True,
                "message": "Contract loaded successfully.",
                "data": serialize_contract(contract),
            },
            status=200,
        )

    if request.method == "PATCH":
        try:
            payload = parse_json_body(request)
            contract = update_contract(instance=contract, payload=payload)
            contract.refresh_from_db()

            return JsonResponse(
                {
                    "ok": True,
                    "message": "Contract updated successfully.",
                    "data": serialize_contract(
                        Contract.objects.select_related("provider")
                        .prefetch_related("contract_products__product")
                        .get(pk=contract.pk)
                    ),
                },
                status=200,
            )
        except ValidationError as exc:
            return _json_error("Validation failed while updating contract.", 400, errors=exc.messages)
        except Exception as exc:
            logger.exception("Failed to update contract %s: %s", contract_id, exc)
            return _json_error("Unexpected error while updating contract.", 500)

    contract.delete()
    return JsonResponse(
        {
            "ok": True,
            "message": "Contract deleted successfully.",
        },
        status=200,
    )