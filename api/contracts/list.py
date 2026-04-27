# ============================================================
# 📂 api/contracts/list.py
# 🧠 Primey Care | Contracts API List/Create
# ============================================================

from __future__ import annotations

import logging

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from contracts.models import Contract
from contracts.services import (
    apply_contract_filters,
    create_contract,
    paginate_queryset,
    parse_int,
    parse_json_body,
    serialize_contract,
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
# 🔹 Contracts API
# ============================================================

@require_http_methods(["GET", "POST"])
def contracts_api(request):
    user, auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method == "GET":
        queryset = (
            Contract.objects.select_related("provider")
            .prefetch_related("contract_products__product")
            .all()
        )
        queryset = apply_contract_filters(queryset, request.GET)

        page = parse_int(request.GET.get("page"), 1) or 1
        page_size = parse_int(request.GET.get("page_size"), 20) or 20

        paginated = paginate_queryset(queryset, page=page, page_size=page_size)

        return JsonResponse(
            {
                "ok": True,
                "message": "Contracts loaded successfully.",
                "results": [serialize_contract(item) for item in paginated["items"]],
                "pagination": paginated["pagination"],
            },
            status=200,
        )

    try:
        payload = parse_json_body(request)
        contract = create_contract(payload=payload)

        return JsonResponse(
            {
                "ok": True,
                "message": "Contract created successfully.",
                "data": serialize_contract(contract),
            },
            status=201,
        )
    except ValidationError as exc:
        return _json_error("Validation failed while creating contract.", 400, errors=exc.messages)
    except Exception as exc:
        logger.exception("Failed to create contract: %s", exc)
        return _json_error("Unexpected error while creating contract.", 500)