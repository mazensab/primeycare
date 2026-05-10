# ============================================================
# 📂 api/payment_gateways/tap_webhook.py
# 🧠 Primey Care | Tap Webhook API V2
# ------------------------------------------------------------
# ✅ استقبال Webhook من Tap
# ✅ قراءة JSON آمنة
# ✅ استخراج hashstring من أكثر من Header محتمل
# ✅ يستدعي payment_gateways.services.handle_tap_webhook
# ✅ عند نجاح الدفع:
#    Tap Webhook
#    → PaymentGatewayTransaction
#    → payments.services.confirm_payment
#    → Accounting + Treasury بعد commit
# ✅ Unified response: ok / success / data / result
# ============================================================

from __future__ import annotations

import json
import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from payment_gateways.services import (
    PaymentGatewayNotConfiguredError,
    PaymentGatewayServiceError,
    PaymentGatewayValidationError,
    handle_tap_webhook,
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
    data: dict[str, Any] | None = None,
) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": False,
        "success": False,
        "status": "error",
        "message": message,
    }

    if errors is not None:
        payload["errors"] = _decimal_to_string(errors)

    if data is not None:
        payload["data"] = _decimal_to_string(data)
        payload["result"] = _decimal_to_string(data)

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
    payload = {
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


def _headers_dict(request) -> dict[str, str]:
    result: dict[str, str] = {}

    try:
        for key, value in request.headers.items():
            result[str(key)] = str(value)
    except Exception:
        pass

    return result


def _extract_tap_hashstring(request) -> str:
    """
    Tap قد يرسل التوقيع بأكثر من شكل حسب البيئة/الإعدادات.
    """
    candidates = [
        request.headers.get("hashstring"),
        request.headers.get("Hashstring"),
        request.headers.get("HashString"),
        request.headers.get("HASHSTRING"),
        request.headers.get("X-Hashstring"),
        request.headers.get("X-HashString"),
        request.headers.get("X-Tap-Hashstring"),
        request.headers.get("X-Tap-HashString"),
        request.META.get("HTTP_HASHSTRING"),
        request.META.get("HTTP_X_HASHSTRING"),
        request.META.get("HTTP_X_TAP_HASHSTRING"),
    ]

    for value in candidates:
        cleaned = _clean_str(value)
        if cleaned:
            return cleaned

    return ""


def _validation_errors(exc: ValidationError) -> Any:
    if hasattr(exc, "message_dict"):
        return exc.message_dict

    if hasattr(exc, "messages"):
        return exc.messages

    return str(exc)


# ============================================================
# API
# ============================================================

@csrf_exempt
@require_POST
def tap_webhook_api(request):
    """
    Tap Webhook endpoint.

    مبدأ مهم:
    - هذا endpoint لا يعدّل Payment مباشرة.
    - كل المعالجة تمر من:
      payment_gateways.services.handle_tap_webhook
    - وعند نجاح الدفع، الخدمة تربط العملية مع:
      payments.services.confirm_payment
    """
    try:
        payload = _parse_json_body(request)

        if not payload:
            return _json_error(
                "Invalid or empty JSON payload.",
                status=400,
            )

        header_hash = _extract_tap_hashstring(request)

        result = handle_tap_webhook(
            payload=payload,
            headers=_headers_dict(request),
            header_hash=header_hash,
        )

        is_success = bool(result.get("success"))

        if not is_success:
            return _json_error(
                result.get("message") or "Tap webhook rejected.",
                status=403,
                data=result,
            )

        return _json_success(
            result,
            message=result.get("message") or "Tap webhook processed successfully.",
            status=200,
        )

    except ValidationError as exc:
        return _json_error(
            "بيانات Tap Webhook غير صحيحة.",
            status=400,
            errors=_validation_errors(exc),
        )

    except PaymentGatewayNotConfiguredError as exc:
        logger.warning("Tap gateway is not configured while processing webhook: %s", exc)
        return _json_error(str(exc), status=503)

    except PaymentGatewayValidationError as exc:
        logger.warning("Tap webhook validation error: %s", exc)
        return _json_error(str(exc), status=400)

    except PaymentGatewayServiceError as exc:
        logger.warning("Tap webhook service error: %s", exc)
        return _json_error(str(exc), status=502)

    except Exception as exc:
        logger.exception("Unexpected error while processing Tap webhook: %s", exc)
        return _json_error(
            "Unexpected error while processing Tap webhook.",
            status=500,
        )