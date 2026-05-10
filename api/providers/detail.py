# ============================================================
# 📂 api/providers/detail.py
# 🧠 Primey Care | Providers API Detail/Update/Safe Disable
# ------------------------------------------------------------
# ✅ Provider detail
# ✅ Provider update
# ✅ Safe disable instead of destructive delete
# ✅ Compatible with imported medical network records
# ✅ Returns Arabic/English names, CR, tax number, Drive fields
# ✅ Returns provider documents for detail/report pages
# ============================================================

from __future__ import annotations

import logging

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from providers.models import Provider, ProviderStatus
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


def _get_provider_or_404(provider_id: int) -> Provider:
    """
    Load provider with related documents for the detail page.

    Notes:
    - Prefetching documents keeps the detail page/report page efficient.
    - The serializer decides whether to include documents or not.
    """
    queryset = Provider.objects.prefetch_related("documents", "documents__uploaded_by")
    return get_object_or_404(queryset, pk=provider_id)


# ============================================================
# 🔹 Provider Detail API
# ============================================================

@require_http_methods(["GET", "PATCH", "DELETE"])
def provider_detail_api(request, provider_id: int):
    user, auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    provider = _get_provider_or_404(provider_id)

    if request.method == "GET":
        return JsonResponse(
            {
                "ok": True,
                "message": "Provider loaded successfully.",
                "data": serialize_provider(provider, include_documents=True),
            },
            status=200,
        )

    if request.method == "PATCH":
        try:
            payload = parse_json_body(request)
            provider = update_provider(instance=provider, payload=payload)

            # Reload with documents after update so the response stays complete.
            provider = _get_provider_or_404(provider.id)

            return JsonResponse(
                {
                    "ok": True,
                    "message": "Provider updated successfully.",
                    "data": serialize_provider(provider, include_documents=True),
                },
                status=200,
            )

        except ValidationError as exc:
            return _json_error(
                "Validation failed while updating provider.",
                400,
                errors=exc.messages,
            )

        except Exception as exc:
            logger.exception("Failed to update provider %s: %s", provider_id, exc)
            return _json_error("Unexpected error while updating provider.", 500)

    # ========================================================
    # 🔹 Safe Disable Instead of Hard Delete
    # ========================================================
    # Important:
    # - Providers may be linked to contracts, orders, invoices,
    #   payments, imported medical network rows, documents,
    #   Drive folders, or reports.
    # - Hard delete can break operational history.
    # - DELETE keeps the API route compatible, but performs a
    #   safe status change to INACTIVE.
    # ========================================================

    if provider.status == ProviderStatus.INACTIVE:
        return JsonResponse(
            {
                "ok": True,
                "message": "Provider is already inactive.",
                "data": serialize_provider(provider, include_documents=True),
            },
            status=200,
        )

    provider.status = ProviderStatus.INACTIVE
    provider.save(update_fields=["status", "updated_at"])

    provider = _get_provider_or_404(provider.id)

    return JsonResponse(
        {
            "ok": True,
            "message": "Provider disabled successfully.",
            "data": serialize_provider(provider, include_documents=True),
        },
        status=200,
    )