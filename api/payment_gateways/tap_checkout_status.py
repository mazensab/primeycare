# ============================================================
# 📂 api/payment_gateways/tap_checkout_status.py
# 🧠 Primey Care | Tap Checkout Status API V2
# ------------------------------------------------------------
# ✅ قراءة حالة عملية Tap محليًا
# ✅ دعم refresh من Tap عند الطلب
# ✅ عند refresh ونجاح الدفع:
#    refresh_tap_transaction_status
#    → finalize_successful_gateway_transaction
#    → payments.services.confirm_payment
#    → Accounting + Treasury بعد commit
# ✅ Unified response: ok / success / data / result
# ============================================================

from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from payment_gateways.models import (
    PaymentGatewayProvider,
    PaymentGatewayTransaction,
)
from payment_gateways.services import (
    PaymentGatewayServiceError,
    PaymentGatewayValidationError,
    refresh_tap_transaction_status,
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

def _clean_str(value: Any, default: str = "") -> str:
    if value is None:
        return default

    cleaned = str(value).strip()
    return cleaned if cleaned else default


def _to_bool(value: Any, default: bool = False) -> bool:
    if value in (None, ""):
        return default

    if isinstance(value, bool):
        return value

    normalized = str(value).strip().lower()

    if normalized in {"1", "true", "yes", "y", "on"}:
        return True

    if normalized in {"0", "false", "no", "n", "off"}:
        return False

    return default


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _validation_errors(exc: ValidationError) -> Any:
    if hasattr(exc, "message_dict"):
        return exc.message_dict

    if hasattr(exc, "messages"):
        return exc.messages

    return str(exc)


def _serialize_gateway_transaction(tx: PaymentGatewayTransaction) -> dict[str, Any]:
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
        "is_webhook_verified": bool(tx.is_webhook_verified),
        "last_webhook_at": _iso_datetime(tx.last_webhook_at),
        "paid_at": _iso_datetime(tx.paid_at),
        "created_at": _iso_datetime(tx.created_at),
        "updated_at": _iso_datetime(tx.updated_at),
        "notes": tx.notes,
        "error_message": tx.error_message,
    }


def _build_tap_queryset():
    return PaymentGatewayTransaction.objects.filter(
        provider=PaymentGatewayProvider.TAP,
    )


def _find_tap_transaction(request) -> PaymentGatewayTransaction | None:
    transaction_id = _clean_str(
        request.GET.get("transaction_id")
        or request.GET.get("id")
        or request.GET.get("gateway_transaction_id")
    )
    tap_charge_id = _clean_str(
        request.GET.get("tap_charge_id")
        or request.GET.get("tap_id")
        or request.GET.get("charge_id")
        or request.GET.get("remote_transaction_id")
    )
    local_reference = _clean_str(
        request.GET.get("local_reference")
        or request.GET.get("reference")
    )
    local_reference_type = _clean_str(request.GET.get("local_reference_type"))
    local_reference_id = _clean_str(request.GET.get("local_reference_id"))

    queryset = _build_tap_queryset()

    if transaction_id:
        try:
            tx = queryset.filter(id=int(transaction_id)).first()
        except (TypeError, ValueError):
            tx = None

        if tx:
            return tx

    if tap_charge_id:
        tx = queryset.filter(remote_transaction_id=tap_charge_id).order_by("-id").first()
        if tx:
            return tx

    if local_reference:
        tx = queryset.filter(local_reference=local_reference).order_by("-id").first()
        if tx:
            return tx

        tx = queryset.filter(gateway_reference=local_reference).order_by("-id").first()
        if tx:
            return tx

    if local_reference_type and local_reference_id:
        tx = (
            queryset
            .filter(
                local_reference_type=local_reference_type.upper(),
                local_reference_id=local_reference_id,
            )
            .order_by("-id")
            .first()
        )
        if tx:
            return tx

    return None


# ============================================================
# API
# ============================================================

@require_http_methods(["GET", "POST"])
def tap_checkout_status_api(request):
    """
    قراءة حالة Tap Checkout / Charge.

    Query params:
    - transaction_id
    - tap_charge_id / charge_id / remote_transaction_id
    - local_reference
    - local_reference_type + local_reference_id
    - refresh=true

    مبدأ مهم:
    - بدون refresh يرجع الحالة المحلية فقط.
    - مع refresh=true يستعلم من Tap، وإذا الدفع ناجح يتم جدولة تأكيد Payment محليًا.
    """
    try:
        refresh = _to_bool(
            request.GET.get("refresh")
            or request.POST.get("refresh"),
            default=False,
        )

        tx = _find_tap_transaction(request)

        if not tx:
            return _json_error(
                "Tap transaction not found.",
                status=404,
            )

        before = {
            "status": tx.status,
            "gateway_status": tx.gateway_status,
            "paid_at": _iso_datetime(tx.paid_at),
        }

        if refresh:
            tx = refresh_tap_transaction_status(tx)
            tx.refresh_from_db()

        after = {
            "status": tx.status,
            "gateway_status": tx.gateway_status,
            "paid_at": _iso_datetime(tx.paid_at),
        }

        return _json_success(
            {
                "gateway_transaction": _serialize_gateway_transaction(tx),
                "refresh": {
                    "requested": refresh,
                    "status_before": before["status"],
                    "status_after": after["status"],
                    "gateway_status_before": before["gateway_status"],
                    "gateway_status_after": after["gateway_status"],
                    "paid_at_before": before["paid_at"],
                    "paid_at_after": after["paid_at"],
                },
                "payment_sync": {
                    "scheduled_when_success": bool(refresh and tx.status == "SUCCESS"),
                    "note": (
                        "Local payment confirmation is scheduled after commit when gateway status is successful."
                        if refresh and tx.status == "SUCCESS"
                        else ""
                    ),
                },
            },
            message="Tap checkout status loaded successfully.",
            status=200,
        )

    except ValidationError as exc:
        return _json_error(
            "بيانات قراءة حالة Tap غير صحيحة.",
            status=400,
            errors=_validation_errors(exc),
        )

    except PaymentGatewayValidationError as exc:
        return _json_error(str(exc), status=400)

    except PaymentGatewayServiceError as exc:
        logger.warning("Tap checkout status service error: %s", exc)
        return _json_error(str(exc), status=502)

    except Exception as exc:
        logger.exception("Unexpected error while resolving Tap checkout status: %s", exc)
        return _json_error(
            "Unexpected error while resolving Tap checkout status.",
            status=500,
        )