# ============================================================
# 📂 api/providers/list.py
# 🧠 Primey Care | Providers API List/Create
# ------------------------------------------------------------
# ✅ List providers
# ✅ Create provider
# ✅ Public/filtered operational list
# ============================================================

from __future__ import annotations

import logging

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from providers.models import Provider
from providers.services import (
    apply_provider_filters,
    create_provider,
    paginate_queryset,
    parse_int,
    parse_json_body,
    serialize_provider,
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
# 🔹 Providers API
# ============================================================

@require_http_methods(["GET", "POST"])
def providers_api(request):
    user, auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method == "GET":
        queryset = Provider.objects.all()
        queryset = apply_provider_filters(queryset, request.GET)

        page = parse_int(request.GET.get("page"), 1) or 1
        page_size = parse_int(request.GET.get("page_size"), 20) or 20

        paginated = paginate_queryset(queryset, page=page, page_size=page_size)

        return JsonResponse(
            {
                "ok": True,
                "message": "Providers loaded successfully.",
                "results": [serialize_provider(item) for item in paginated["items"]],
                "pagination": paginated["pagination"],
            },
            status=200,
        )

    try:
        payload = parse_json_body(request)
        provider = create_provider(payload=payload)

        return JsonResponse(
            {
                "ok": True,
                "message": "Provider created successfully.",
                "data": serialize_provider(provider),
            },
            status=201,
        )
    except ValidationError as exc:
        return _json_error("Validation failed while creating provider.", 400, errors=exc.messages)
    except Exception as exc:
        logger.exception("Failed to create provider: %s", exc)
        return _json_error("Unexpected error while creating provider.", 500)


# ============================================================
# 🔹 Active Providers API
# ============================================================

@require_http_methods(["GET"])
def active_providers_api(request):
    queryset = Provider.objects.filter(status="ACTIVE")
    queryset = apply_provider_filters(queryset, request.GET)

    page = parse_int(request.GET.get("page"), 1) or 1
    page_size = parse_int(request.GET.get("page_size"), 20) or 20

    paginated = paginate_queryset(queryset, page=page, page_size=page_size)

    return JsonResponse(
        {
            "ok": True,
            "message": "Active providers loaded successfully.",
            "results": [serialize_provider(item) for item in paginated["items"]],
            "pagination": paginated["pagination"],
        },
        status=200,
    )