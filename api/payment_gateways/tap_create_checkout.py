# ============================================================
# 📂 api/payment_gateways/tap_create_checkout.py
# 🧠 Primey Care - Tap Create Checkout API
# ============================================================

from __future__ import annotations

import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from payment_gateways.services import (
    PaymentGatewayNotConfiguredError,
    PaymentGatewayServiceError,
    PaymentGatewayValidationError,
    create_tap_checkout_transaction,
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


@csrf_exempt
@require_POST
def tap_create_checkout_api(request):
    payload = _json_body(request)
    if not payload:
        return JsonResponse(
            {"status": "error", "message": "Invalid JSON payload."},
            status=400,
        )

    try:
        tx = create_tap_checkout_transaction(
            amount=payload.get("amount"),
            local_reference_type=_clean_str(payload.get("local_reference_type"), "MANUAL"),
            local_reference_id=_clean_str(payload.get("local_reference_id")),
            local_reference=_clean_str(payload.get("local_reference")),
            customer_name=_clean_str(payload.get("customer_name")),
            customer_email=_clean_str(payload.get("customer_email")),
            customer_phone=_clean_str(payload.get("customer_phone")),
            description=_clean_str(payload.get("description"), "Primey Care Payment"),
            success_url=_clean_str(payload.get("success_url")),
            webhook_url=_clean_str(payload.get("webhook_url")),
            currency=_clean_str(payload.get("currency"), "SAR"),
            payment_method=_clean_str(payload.get("payment_method"), "CREDIT_CARD"),
        )

        return JsonResponse(
            {
                "status": "ok",
                "message": "Tap checkout created successfully.",
                "result": {
                    "transaction_id": tx.id,
                    "provider": tx.provider,
                    "status": tx.status,
                    "gateway_status": tx.gateway_status,
                    "amount": str(tx.amount),
                    "currency": tx.currency,
                    "local_reference_type": tx.local_reference_type,
                    "local_reference_id": tx.local_reference_id,
                    "local_reference": tx.local_reference,
                    "remote_transaction_id": tx.remote_transaction_id,
                    "payment_url": tx.payment_url,
                    "redirect_url": tx.redirect_url,
                    "created_at": tx.created_at.isoformat() if tx.created_at else None,
                },
            },
            status=200,
        )

    except PaymentGatewayValidationError as exc:
        return JsonResponse({"status": "error", "message": str(exc)}, status=400)

    except PaymentGatewayNotConfiguredError as exc:
        return JsonResponse({"status": "error", "message": str(exc)}, status=503)

    except PaymentGatewayServiceError as exc:
        return JsonResponse({"status": "error", "message": str(exc)}, status=502)

    except Exception as exc:
        return JsonResponse(
            {"status": "error", "message": f"Unexpected error while creating Tap checkout: {exc}"},
            status=500,
        )