# ============================================================
# 📂 api/payment_gateways/tap_webhook.py
# 🧠 Primey Care - Tap Webhook API
# ============================================================

from __future__ import annotations

import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from payment_gateways.services import (
    PaymentGatewayNotConfiguredError,
    handle_tap_webhook,
)


def _json_body(request):
    try:
        if not request.body:
            return {}
        return json.loads(request.body.decode("utf-8"))
    except Exception:
        return {}


def _clean_str(value, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def _headers_dict(request) -> dict:
    result = {}
    for key, value in request.headers.items():
        result[str(key)] = str(value)
    return result


@csrf_exempt
@require_POST
def tap_webhook_api(request):
    payload = _json_body(request)
    if not payload:
        return JsonResponse(
            {"status": "error", "message": "Invalid or empty JSON payload."},
            status=400,
        )

    header_hash = _clean_str(
        request.headers.get("hashstring")
        or request.headers.get("Hashstring")
        or request.headers.get("X-Hashstring")
        or request.META.get("HTTP_HASHSTRING")
        or request.META.get("HTTP_X_HASHSTRING")
    )

    try:
        result = handle_tap_webhook(
            payload=payload,
            headers=_headers_dict(request),
            header_hash=header_hash,
        )

        return JsonResponse(
            {"status": "ok" if result.get("success") else "error", "result": result},
            status=200 if result.get("success") else 403,
        )

    except PaymentGatewayNotConfiguredError as exc:
        return JsonResponse({"status": "error", "message": str(exc)}, status=503)

    except Exception as exc:
        return JsonResponse(
            {"status": "error", "message": f"Unexpected error while processing Tap webhook: {exc}"},
            status=500,
        )