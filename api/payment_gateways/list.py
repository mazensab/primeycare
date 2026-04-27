# ============================================================
# 📂 api/payment_gateways/list.py
# 🧠 Primey Care - Payment Gateways List APIs
# ------------------------------------------------------------
# ✅ قائمة البوابات
# ✅ قائمة العمليات
# ✅ فلاتر provider / status / reference
# ============================================================

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_GET

from payment_gateways.models import (
    PaymentGatewayConfig,
    PaymentGatewayTransaction,
)


# ============================================================
# Helpers
# ============================================================

def _clean_str(value, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def _to_int(value, default: int) -> int:
    try:
        return int(value)
    except Exception:
        return default


# ============================================================
# Gateway Configs List
# GET /api/payment-gateways/configs/
# ============================================================

@require_GET
def payment_gateway_configs_list_api(request):
    provider = _clean_str(request.GET.get("provider")).upper()

    queryset = PaymentGatewayConfig.objects.all().order_by("provider", "-is_default", "-id")

    if provider:
        queryset = queryset.filter(provider=provider)

    items = []
    for obj in queryset:
        items.append(
            {
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
                "masked_api_token": obj.masked_api_token,
                "masked_secret_key": obj.masked_secret_key,
                "masked_public_key": obj.masked_public_key,
                "masked_notification_token": obj.masked_notification_token,
                "created_at": obj.created_at.isoformat() if obj.created_at else None,
                "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
            }
        )

    return JsonResponse(
        {
            "status": "ok",
            "count": len(items),
            "results": items,
        },
        status=200,
    )


# ============================================================
# Gateway Transactions List
# GET /api/payment-gateways/transactions/
# ============================================================

@require_GET
def payment_gateway_transactions_list_api(request):
    provider = _clean_str(request.GET.get("provider")).upper()
    status_value = _clean_str(request.GET.get("status")).upper()
    local_reference = _clean_str(request.GET.get("local_reference"))
    local_reference_type = _clean_str(request.GET.get("local_reference_type")).upper()
    local_reference_id = _clean_str(request.GET.get("local_reference_id"))
    remote_transaction_id = _clean_str(request.GET.get("remote_transaction_id"))
    remote_order_id = _clean_str(request.GET.get("remote_order_id"))
    page = max(_to_int(request.GET.get("page"), 1), 1)
    page_size = min(max(_to_int(request.GET.get("page_size"), 20), 1), 100)

    queryset = PaymentGatewayTransaction.objects.all().order_by("-id")

    if provider:
        queryset = queryset.filter(provider=provider)

    if status_value:
        queryset = queryset.filter(status=status_value)

    if local_reference:
        queryset = queryset.filter(local_reference__icontains=local_reference)

    if local_reference_type:
        queryset = queryset.filter(local_reference_type=local_reference_type)

    if local_reference_id:
        queryset = queryset.filter(local_reference_id=local_reference_id)

    if remote_transaction_id:
        queryset = queryset.filter(remote_transaction_id=remote_transaction_id)

    if remote_order_id:
        queryset = queryset.filter(remote_order_id=remote_order_id)

    total_count = queryset.count()
    start = (page - 1) * page_size
    end = start + page_size
    rows = queryset[start:end]

    results = []
    for obj in rows:
        results.append(
            {
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
                "created_at": obj.created_at.isoformat() if obj.created_at else None,
                "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
            }
        )

    return JsonResponse(
        {
            "status": "ok",
            "count": total_count,
            "page": page,
            "page_size": page_size,
            "results": results,
        },
        status=200,
    )