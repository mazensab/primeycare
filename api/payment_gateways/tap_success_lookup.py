# ============================================================
# 📂 api/payment_gateways/tap_success_lookup.py
# 🧠 Primey Care - Tap Success Lookup API
# ============================================================

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_GET

from payment_gateways.models import (
    PaymentGatewayProvider,
    PaymentGatewayTransaction,
)
from payment_gateways.services import refresh_tap_transaction_status


def _clean_str(value, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


@require_GET
def tap_success_lookup_api(request):
    tap_charge_id = _clean_str(request.GET.get("tap_charge_id") or request.GET.get("tap_id"))
    if not tap_charge_id:
        return JsonResponse(
            {
                "success": False,
                "status": "error",
                "message": "tap_charge_id or tap_id is required.",
            },
            status=400,
        )

    tx = (
        PaymentGatewayTransaction.objects
        .filter(
            provider=PaymentGatewayProvider.TAP,
            remote_transaction_id=tap_charge_id,
        )
        .order_by("-id")
        .first()
    )

    if not tx:
        return JsonResponse(
            {
                "success": False,
                "status": "not_found",
                "message": "No local Tap transaction found.",
                "tap_charge_id": tap_charge_id,
            },
            status=404,
        )

    try:
        if not tx.is_final:
            tx = refresh_tap_transaction_status(tx)
    except Exception:
        pass

    return JsonResponse(
        {
            "success": True,
            "status": "resolved",
            "result": {
                "transaction_id": tx.id,
                "provider": tx.provider,
                "local_reference_type": tx.local_reference_type,
                "local_reference_id": tx.local_reference_id,
                "local_reference": tx.local_reference,
                "tap_charge_id": tx.remote_transaction_id,
                "gateway_status": tx.gateway_status,
                "status": tx.status,
                "amount": str(tx.amount),
                "currency": tx.currency,
                "payment_url": tx.payment_url,
                "redirect_url": tx.redirect_url,
                "paid_at": tx.paid_at.isoformat() if tx.paid_at else None,
                "is_final": tx.is_final,
                "is_success": tx.is_success,
            },
        },
        status=200,
    )