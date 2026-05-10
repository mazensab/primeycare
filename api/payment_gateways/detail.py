# ============================================================
# 📂 api/payment_gateways/detail.py
# 🧠 Primey Care | Payment Gateways Detail APIs V2
# ------------------------------------------------------------
# ✅ Gateway config detail
# ✅ Gateway transaction detail
# ✅ Related webhook logs
# ✅ Safe masked secrets only
# ✅ Unified response: ok / success / data / result
# ✅ Compatible with Payments / Accounting / Treasury flow
# ============================================================

from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.http import JsonResponse
from django.views.decorators.http import require_GET

from payment_gateways.models import (
    PaymentGatewayConfig,
    PaymentGatewayTransaction,
)


logger = logging.getLogger(__name__)


# ============================================================
# JSON Helpers
# ============================================================

def _decimal_to_string(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

    if isinstance(value, dict):
        return {key: _decimal_to_string(val) for key, val in value.items()}

    if isinstance(value, list):
        return [_decimal_to_string(item) for item in value]

    if isinstance(value, tuple):
        return tuple(_decimal_to_string(item) for item in value)

    return value


def _json_error(
    message: str,
    *,
    status: int = 400,
    errors: Any = None,
) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": False,
        "success": False,
        "status": "error",
        "message": message,
    }

    if errors is not None:
        payload["errors"] = _decimal_to_string(errors)

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


def _json_success(
    data: dict[str, Any],
    *,
    message: str = "تم تنفيذ العملية بنجاح.",
    status: int = 200,
) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": True,
        "success": True,
        "status": "ok",
        "message": message,
        "data": _decimal_to_string(data),
        # توافق خلفي مع أي استدعاء قديم كان يقرأ result
        "result": _decimal_to_string(data),
    }

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


# ============================================================
# Safe Helpers
# ============================================================

def _clean_str(value: Any, default: str = "") -> str:
    if value is None:
        return default

    cleaned = str(value).strip()
    return cleaned if cleaned else default


def _mask(value: Any, visible: int = 4) -> str:
    cleaned = _clean_str(value)

    if not cleaned:
        return ""

    if len(cleaned) <= visible:
        return "*" * len(cleaned)

    return f"{'*' * max(len(cleaned) - visible, 0)}{cleaned[-visible:]}"


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _safe_json(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)

    if isinstance(value, dict):
        return {str(key): _safe_json(val) for key, val in value.items()}

    if isinstance(value, list):
        return [_safe_json(item) for item in value]

    if isinstance(value, tuple):
        return [_safe_json(item) for item in value]

    return value


def _safe_bool_attr(obj: Any, attr_name: str) -> bool:
    try:
        return bool(getattr(obj, attr_name, False))
    except Exception:
        return False


# ============================================================
# Serializers
# ============================================================

def _serialize_gateway_config(obj: PaymentGatewayConfig) -> dict[str, Any]:
    return {
        "id": obj.id,
        "provider": obj.provider,
        "provider_label": obj.get_provider_display(),
        "display_name": obj.display_name,
        "environment": obj.environment,
        "is_enabled": bool(obj.is_enabled),
        "is_default": bool(obj.is_default),
        "base_url": obj.base_url,
        "timeout_seconds": obj.timeout_seconds,
        "verify_webhook": bool(obj.verify_webhook),
        "merchant_id": obj.merchant_id,
        "source_id": obj.source_id,
        "merchant_callback_url": obj.merchant_callback_url,

        # لا نرجع أي مفاتيح خام
        "masked_api_token": getattr(obj, "masked_api_token", "") or _mask(getattr(obj, "api_token", "")),
        "masked_secret_key": getattr(obj, "masked_secret_key", "") or _mask(getattr(obj, "secret_key", "")),
        "masked_public_key": getattr(obj, "masked_public_key", "") or _mask(getattr(obj, "public_key", "")),
        "masked_notification_token": (
            getattr(obj, "masked_notification_token", "")
            or _mask(getattr(obj, "notification_token", ""))
        ),

        "has_api_token": bool(_clean_str(getattr(obj, "api_token", ""))),
        "has_secret_key": bool(_clean_str(getattr(obj, "secret_key", ""))),
        "has_public_key": bool(_clean_str(getattr(obj, "public_key", ""))),
        "has_notification_token": bool(_clean_str(getattr(obj, "notification_token", ""))),

        "extra_config": _safe_json(obj.extra_config or {}),
        "notes": obj.notes,

        "created_at": _iso_datetime(obj.created_at),
        "updated_at": _iso_datetime(obj.updated_at),
    }


def _serialize_webhook_log(log) -> dict[str, Any]:
    return {
        "id": log.id,
        "provider": log.provider,
        "status": log.status,
        "event_type": log.event_type,
        "signature_valid": bool(log.signature_valid),
        "remote_transaction_id": log.remote_transaction_id,
        "remote_order_id": log.remote_order_id,
        "remote_checkout_id": log.remote_checkout_id,
        "processing_result": _safe_json(log.processing_result or {}),
        "error_message": log.error_message,
        "notes": getattr(log, "notes", ""),
        "received_at": _iso_datetime(log.received_at),
        "processed_at": _iso_datetime(log.processed_at),
    }


def _serialize_gateway_transaction(obj: PaymentGatewayTransaction) -> dict[str, Any]:
    webhook_logs = [
        _serialize_webhook_log(log)
        for log in obj.webhook_logs.all().order_by("-id")[:20]
    ]

    return {
        "id": obj.id,
        "transaction_id": obj.id,
        "provider": obj.provider,
        "status": obj.status,
        "gateway_status": obj.gateway_status,
        "payment_method": obj.payment_method,
        "currency": obj.currency,
        "amount": obj.amount,

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

        "is_webhook_verified": bool(obj.is_webhook_verified),
        "last_webhook_at": _iso_datetime(obj.last_webhook_at),
        "paid_at": _iso_datetime(obj.paid_at),

        "is_final": _safe_bool_attr(obj, "is_final"),
        "is_success": _safe_bool_attr(obj, "is_success"),

        "request_payload": _safe_json(obj.request_payload or {}),
        "response_payload": _safe_json(obj.response_payload or {}),
        "latest_webhook_payload": _safe_json(obj.latest_webhook_payload or {}),

        "notes": obj.notes,
        "error_message": obj.error_message,

        "created_at": _iso_datetime(obj.created_at),
        "updated_at": _iso_datetime(obj.updated_at),

        "webhook_logs": webhook_logs,
        "webhook_summary": {
            "total_returned": len(webhook_logs),
            "has_verified_webhook": any(item["signature_valid"] for item in webhook_logs),
            "last_status": webhook_logs[0]["status"] if webhook_logs else "",
            "last_event_type": webhook_logs[0]["event_type"] if webhook_logs else "",
        },
    }


# ============================================================
# Gateway Config Detail
# GET /api/payment-gateways/configs/<str:provider>/
# ============================================================

@require_GET
def payment_gateway_config_detail_api(request, provider: str):
    try:
        normalized_provider = _clean_str(provider).upper()

        obj = (
            PaymentGatewayConfig.objects
            .filter(provider=normalized_provider)
            .order_by("-is_default", "-id")
            .first()
        )

        if not obj:
            return _json_error(
                "Payment gateway config not found.",
                status=404,
            )

        config = _serialize_gateway_config(obj)

        return _json_success(
            {
                "config": config,
                "gateway_config": config,
                "provider": normalized_provider,
            },
            message="Payment gateway config loaded successfully.",
            status=200,
        )

    except Exception as exc:
        logger.exception("Failed to load payment gateway config %s: %s", provider, exc)
        return _json_error(
            "Unexpected error while loading payment gateway config.",
            status=500,
        )


# ============================================================
# Gateway Transaction Detail
# GET /api/payment-gateways/transactions/<int:transaction_id>/
# ============================================================

@require_GET
def payment_gateway_transaction_detail_api(request, transaction_id: int):
    try:
        obj = (
            PaymentGatewayTransaction.objects
            .prefetch_related("webhook_logs")
            .filter(id=transaction_id)
            .first()
        )

        if not obj:
            return _json_error(
                "Payment gateway transaction not found.",
                status=404,
            )

        transaction_data = _serialize_gateway_transaction(obj)

        return _json_success(
            {
                "transaction": transaction_data,
                "gateway_transaction": transaction_data,
                "payment_sync": {
                    "is_success": transaction_data["is_success"],
                    "is_final": transaction_data["is_final"],
                    "expected_flow": (
                        "Successful gateway transaction should sync to local Payment through services."
                        if transaction_data["is_success"]
                        else ""
                    ),
                },
            },
            message="Payment gateway transaction loaded successfully.",
            status=200,
        )

    except Exception as exc:
        logger.exception(
            "Failed to load payment gateway transaction %s: %s",
            transaction_id,
            exc,
        )
        return _json_error(
            "Unexpected error while loading payment gateway transaction.",
            status=500,
        )