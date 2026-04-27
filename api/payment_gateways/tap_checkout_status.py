# ============================================================
# 📂 api/payment_gateways/tap_checkout_status.py
# 🧠 Primey Care - Tap Checkout Status API
# ============================================================

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_GET

from payment_gateways.models import (
    PaymentGatewayProvider,
    PaymentGatewayTransaction,
)
from payment_gateways.services import (
    PaymentGatewayServiceError,
    PaymentGatewayValidationError,
    refresh_tap_transaction_status,
)


def _clean_str(value, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def _to_bool(value) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "y"}


@require_GET
def tap_checkout_status_api(request):
    transaction_id = _clean_str(request.GET.get("transaction_id"))
    tap_charge_id = _clean_str(request.GET.get("tap_charge_id") or request.GET.get("tap_id"))
    refresh = _to_bool(request.GET.get("refresh"))

    queryset = PaymentGatewayTransaction.objects.filter(provider=PaymentGatewayProvider.TAP)

    tx = None
    if transaction_id:
        tx = queryset.filter(id=transaction_id).first()
    elif tap_charge_id:
        tx = queryset.filter(remote_transaction_id=tap_charge_id).order_by("-id").first()

    if not tx:
        return JsonResponse(
            {"status": "error", "message": "Tap transaction not found."},
            status=404,
        )

    try:
        if refresh:
            tx = refresh_tap_transaction_status(tx)

        return JsonResponse(
            {
                "status": "ok",
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
                    "is_webhook_verified": tx.is_webhook_verified,
                    "last_webhook_at": tx.last_webhook_at.isoformat() if tx.last_webhook_at else None,
                    "paid_at": tx.paid_at.isoformat() if tx.paid_at else None,
                    "created_at": tx.created_at.isoformat() if tx.created_at else None,
                    "updated_at": tx.updated_at.isoformat() if tx.updated_at else None,
                },
            },
            status=200,
        )

    except (PaymentGatewayValidationError, PaymentGatewayServiceError) as exc:
        return JsonResponse({"status": "error", "message": str(exc)}, status=400)

    except Exception as exc:
        return JsonResponse(
            {"status": "error", "message": f"Unexpected error while resolving Tap checkout status: {exc}"},
            status=500,
        )