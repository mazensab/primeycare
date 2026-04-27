# ============================================================
# 📂 api/providers/detail.py
# 🧠 Primey Care | Providers API Detail/Update/Delete
# ============================================================

from __future__ import annotations

import logging

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from providers.models import Provider
from providers.services import (
    parse_json_body,
    serialize_provider,
    update_provider,
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
# 🔹 Provider Detail API
# ============================================================

@require_http_methods(["GET", "PATCH", "DELETE"])
def provider_detail_api(request, provider_id: int):
    user, auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    provider = get_object_or_404(Provider, pk=provider_id)

    if request.method == "GET":
        return JsonResponse(
            {
                "ok": True,
                "message": "Provider loaded successfully.",
                "data": serialize_provider(provider),
            },
            status=200,
        )

    if request.method == "PATCH":
        try:
            payload = parse_json_body(request)
            provider = update_provider(instance=provider, payload=payload)

            return JsonResponse(
                {
                    "ok": True,
                    "message": "Provider updated successfully.",
                    "data": serialize_provider(provider),
                },
                status=200,
            )
        except ValidationError as exc:
            return _json_error("Validation failed while updating provider.", 400, errors=exc.messages)
        except Exception as exc:
            logger.exception("Failed to update provider %s: %s", provider_id, exc)
            return _json_error("Unexpected error while updating provider.", 500)

    provider.delete()
    return JsonResponse(
        {
            "ok": True,
            "message": "Provider deleted successfully.",
        },
        status=200,
    )