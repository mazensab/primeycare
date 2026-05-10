# ============================================================
# 📂 api/payment_gateways/tamara_create_checkout.py
# 🧠 Primey Care | Tamara Create Checkout API V2
# ------------------------------------------------------------
# ✅ إنشاء Checkout عبر Tamara
# ✅ يستدعي payment_gateways.services.create_tamara_checkout_transaction
# ✅ لا يؤكد الدفع هنا
# ✅ تأكيد الدفع يتم لاحقًا عبر Tamara webhook
# ✅ عند نجاح البوابة:
#    PaymentGatewayTransaction
#    → payments.services.confirm_payment
#    → Accounting + Treasury
# ✅ Unified response: ok / success / data / result
# ============================================================

from __future__ import annotations

import json
import logging
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from payment_gateways.services import (
    PaymentGatewayNotConfiguredError,
    PaymentGatewayServiceError,
    PaymentGatewayValidationError,
    create_tamara_checkout_transaction,
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

def _parse_json_body(request) -> dict[str, Any]:
    if not request.body:
        return {}

    try:
        parsed = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise ValidationError("صيغة JSON غير صحيحة.") from exc
    except UnicodeDecodeError as exc:
        raise ValidationError("ترميز الطلب غير صحيح.") from exc

    if not isinstance(parsed, dict):
        raise ValidationError("جسم الطلب يجب أن يكون JSON Object.")

    return parsed


def _clean_str(value: Any, default: str = "") -> str:
    if value is None:
        return default

    cleaned = str(value).strip()
    return cleaned if cleaned else default


def _parse_decimal(value: Any, field_name: str = "amount") -> Decimal:
    if value in (None, ""):
        raise ValidationError({field_name: "المبلغ مطلوب."})

    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValidationError({field_name: "المبلغ غير صحيح."}) from exc

    amount = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    if amount <= Decimal("0.00"):
        raise ValidationError({field_name: "المبلغ يجب أن يكون أكبر من صفر."})

    return amount


def _validation_errors(exc: ValidationError) -> Any:
    if hasattr(exc, "message_dict"):
        return exc.message_dict

    if hasattr(exc, "messages"):
        return exc.messages

    return str(exc)


def _require_text(payload: dict[str, Any], field_name: str, message: str) -> str:
    value = _clean_str(payload.get(field_name))

    if not value:
        raise ValidationError({field_name: message})

    return value


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _serialize_gateway_transaction(tx) -> dict[str, Any]:
    return {
        "transaction_id": tx.id,
        "id": tx.id,
        "provider": tx.provider,
        "status": tx.status,
        "gateway_status": tx.gateway_status,
        "amount": tx.amount,
        "currency": tx.currency,
        "payment_method": tx.payment_method,
        "local_reference_type": tx.local_reference_type,
        "local_reference_id": tx.local_reference_id,
        "local_reference": tx.local_reference,
        "remote_transaction_id": tx.remote_transaction_id,
        "remote_order_id": tx.remote_order_id,
        "remote_checkout_id": tx.remote_checkout_id,
        "gateway_reference": tx.gateway_reference,
        "payment_url": tx.payment_url,
        "redirect_url": tx.redirect_url,
        "customer_name": tx.customer_name,
        "customer_email": tx.customer_email,
        "customer_phone": tx.customer_phone,
        "is_webhook_verified": bool(getattr(tx, "is_webhook_verified", False)),
        "paid_at": _iso_datetime(getattr(tx, "paid_at", None)),
        "last_webhook_at": _iso_datetime(getattr(tx, "last_webhook_at", None)),
        "created_at": _iso_datetime(getattr(tx, "created_at", None)),
        "updated_at": _iso_datetime(getattr(tx, "updated_at", None)),
    }


# ============================================================
# API
# ============================================================

@csrf_exempt
@require_POST
def tamara_create_checkout_api(request):
    """
    إنشاء عملية دفع Tamara.

    Body:
    {
      "amount": "115.00",
      "currency": "SAR",
      "local_reference_type": "INVOICE",
      "local_reference_id": "1",
      "local_reference": "INV-001",
      "customer_name": "Mazen",
      "customer_email": "mazen@example.com",
      "customer_phone": "05xxxxxxxx",
      "item_name": "Primey Care Payment",
      "description": "Primey Care Payment",
      "success_url": "https://...",
      "cancel_url": "https://...",
      "failure_url": "https://...",
      "notification_url": "https://...",
      "country_code": "SA",
      "city": "Jeddah",
      "payment_method": "TAMARA"
    }

    مبدأ مهم:
    - هذا endpoint ينشئ checkout فقط.
    - لا يؤكد الدفع.
    - التأكيد يتم من Tamara webhook.
    """
    try:
        payload = _parse_json_body(request)

        if not payload:
            return _json_error("Invalid JSON payload.", status=400)

        amount = _parse_decimal(payload.get("amount"), "amount")

        local_reference_type = _clean_str(
            payload.get("local_reference_type"),
            "MANUAL",
        )
        local_reference_id = _clean_str(payload.get("local_reference_id"))
        local_reference = _require_text(
            payload,
            "local_reference",
            "local_reference مطلوب لإنشاء عملية Tamara.",
        )

        customer_name = _require_text(
            payload,
            "customer_name",
            "اسم العميل مطلوب.",
        )
        customer_email = _require_text(
            payload,
            "customer_email",
            "بريد العميل مطلوب.",
        )
        customer_phone = _require_text(
            payload,
            "customer_phone",
            "رقم جوال العميل مطلوب.",
        )

        item_name = _clean_str(
            payload.get("item_name"),
            "Primey Care Payment",
        )

        success_url = _require_text(
            payload,
            "success_url",
            "success_url مطلوب.",
        )
        cancel_url = _require_text(
            payload,
            "cancel_url",
            "cancel_url مطلوب.",
        )

        notification_url = _require_text(
            payload,
            "notification_url",
            "notification_url مطلوب.",
        )

        tx = create_tamara_checkout_transaction(
            amount=amount,
            local_reference_type=local_reference_type,
            local_reference_id=local_reference_id,
            local_reference=local_reference,
            customer_name=customer_name,
            customer_email=customer_email,
            customer_phone=customer_phone,
            item_name=item_name,
            description=_clean_str(payload.get("description"), item_name),
            success_url=success_url,
            cancel_url=cancel_url,
            failure_url=_clean_str(payload.get("failure_url"), cancel_url),
            notification_url=notification_url,
            currency=_clean_str(payload.get("currency"), "SAR").upper(),
            country_code=_clean_str(payload.get("country_code"), "SA").upper(),
            city=_clean_str(payload.get("city"), "Jeddah"),
            payment_method=_clean_str(payload.get("payment_method"), "TAMARA").upper(),
        )

        return _json_success(
            {
                "gateway_transaction": _serialize_gateway_transaction(tx),
                "checkout": {
                    "payment_url": tx.payment_url,
                    "redirect_url": tx.redirect_url,
                    "requires_action": bool(tx.payment_url),
                },
            },
            message="Tamara checkout created successfully.",
            status=200,
        )

    except ValidationError as exc:
        return _json_error(
            "بيانات إنشاء عملية Tamara غير صحيحة.",
            status=400,
            errors=_validation_errors(exc),
        )

    except PaymentGatewayValidationError as exc:
        return _json_error(str(exc), status=400)

    except PaymentGatewayNotConfiguredError as exc:
        logger.warning("Tamara gateway is not configured: %s", exc)
        return _json_error(str(exc), status=503)

    except PaymentGatewayServiceError as exc:
        logger.warning("Tamara checkout service error: %s", exc)
        return _json_error(str(exc), status=502)

    except Exception as exc:
        logger.exception("Unexpected error while creating Tamara checkout: %s", exc)
        return _json_error(
            "Unexpected error while creating Tamara checkout.",
            status=500,
        )