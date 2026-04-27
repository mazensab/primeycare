# ============================================================
# 📂 api/payment_gateways/detail.py
# 🧠 Primey Care - Payment Gateways Detail APIs
# ------------------------------------------------------------
# ✅ تفاصيل config
# ✅ تفاصيل transaction
# ✅ تفاصيل webhook logs المرتبطة
# ============================================================

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_GET

from payment_gateways.models import (
    PaymentGatewayConfig,
    PaymentGatewayTransaction,
)


# ============================================================
# Gateway Config Detail
# GET /api/payment-gateways/configs/<str:provider>/
# ============================================================

@require_GET
def payment_gateway_config_detail_api(request, provider: str):
    obj = (
        PaymentGatewayConfig.objects
        .filter(provider=str(provider).strip().upper())
        .first()
    )

    if not obj:
        return JsonResponse(
            {
                "status": "error",
                "message": "Payment gateway config not found.",
            },
            status=404,
        )

    return JsonResponse(
        {
            "status": "ok",
            "result": {
                "id": obj.id,
                "provider": obj.provider,
                "provider_label": obj.get_provider_display(),
                "display_name": obj.display_name,
                "environment": obj.environment,
                "is_enabled": obj.is_enabled,
                "is_default": obj.is_default,
                "base_url": obj.base_url,
                "timeout_seconds": obj.timeout_seconds,
                "verify_webhook": obj.verify_webhook,
                "merchant_id": obj.merchant_id,
                "source_id": obj.source_id,
                "merchant_callback_url": obj.merchant_callback_url,
                "extra_config": obj.extra_config,
                "notes": obj.notes,
                "masked_api_token": obj.masked_api_token,
                "masked_secret_key": obj.masked_secret_key,
                "masked_public_key": obj.masked_public_key,
                "masked_notification_token": obj.masked_notification_token,
                "created_at": obj.created_at.isoformat() if obj.created_at else None,
                "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
            },
        },
        status=200,
    )


# ============================================================
# Gateway Transaction Detail
# GET /api/payment-gateways/transactions/<int:transaction_id>/
# ============================================================

@require_GET
def payment_gateway_transaction_detail_api(request, transaction_id: int):
    obj = (
        PaymentGatewayTransaction.objects
        .prefetch_related("webhook_logs")
        .filter(id=transaction_id)
        .first()
    )

    if not obj:
        return JsonResponse(
            {
                "status": "error",
                "message": "Payment gateway transaction not found.",
            },
            status=404,
        )

    webhook_logs = []
    for log in obj.webhook_logs.all().order_by("-id")[:20]:
        webhook_logs.append(
            {
                "id": log.id,
                "provider": log.provider,
                "status": log.status,
                "event_type": log.event_type,
                "signature_valid": log.signature_valid,
                "remote_transaction_id": log.remote_transaction_id,
                "remote_order_id": log.remote_order_id,
                "remote_checkout_id": log.remote_checkout_id,
                "processing_result": log.processing_result,
                "error_message": log.error_message,
                "received_at": log.received_at.isoformat() if log.received_at else None,
                "processed_at": log.processed_at.isoformat() if log.processed_at else None,
            }
        )

    return JsonResponse(
        {
            "status": "ok",
            "result": {
                "id": obj.id,
                "provider": obj.provider,
                "status": obj.status,
                "gateway_status": obj.gateway_status,
                "payment_method": obj.payment_method,
                "currency": obj.currency,
                "amount": str(obj.amount),
                "local_reference_type": obj.local_reference_type,
                "local_reference_id": obj.local_reference_id,
                "local_reference": obj.local_reference,
                "customer_name": obj.customer_name,
                "customer_email": obj.customer_email,
                "customer_phone": obj.customer_phone,
                "remote_transaction_id": obj.remote_transaction_id,
                "remote_order_id": obj.remote_order_id,
                "remote_checkout_id": obj.remote_checkout_id,
                "gateway_reference": obj.gateway_reference,
                "payment_url": obj.payment_url,
                "redirect_url": obj.redirect_url,
                "is_webhook_verified": obj.is_webhook_verified,
                "last_webhook_at": obj.last_webhook_at.isoformat() if obj.last_webhook_at else None,
                "paid_at": obj.paid_at.isoformat() if obj.paid_at else None,
                "request_payload": obj.request_payload,
                "response_payload": obj.response_payload,
                "latest_webhook_payload": obj.latest_webhook_payload,
                "notes": obj.notes,
                "error_message": obj.error_message,
                "created_at": obj.created_at.isoformat() if obj.created_at else None,
                "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
                "webhook_logs": webhook_logs,
            },
        },
        status=200,
    )