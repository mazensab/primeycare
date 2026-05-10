# ============================================================
# 📂 api/orders/detail.py
# 🧭 Primey Care — Orders API Detail/Update/Cancel V2
# ------------------------------------------------------------
# ✅ تفاصيل الطلب
# ✅ تعديل الطلب عبر orders.services.update_order الرسمي
# ✅ إلغاء آمن عبر orders.services.cancel_order الرسمي
# ✅ لا حذف فعلي للطلب
# ✅ متوافق مع دورة الطلب المالية الجديدة
# ✅ Unified response: ok / success / data
# ✅ يحافظ على data القديم للتوافق مع الفرونت الحالي
# ============================================================

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from orders.models import Order
from orders.services import (
    cancel_order,
    parse_json_body,
    serialize_order,
    update_order,
)


logger = logging.getLogger(__name__)


# ============================================================
# 🔹 JSON Helpers
# ============================================================

def _decimal_to_string(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)

    if isinstance(value, dict):
        return {key: _decimal_to_string(val) for key, val in value.items()}

    if isinstance(value, list):
        return [_decimal_to_string(item) for item in value]

    if isinstance(value, tuple):
        return tuple(_decimal_to_string(item) for item in value)

    return value


def _json_error(
    message: str,
    status: int = 400,
    *,
    errors: Any = None,
) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": False,
        "success": False,
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
    extra: dict[str, Any] | None = None,
) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": True,
        "success": True,
        "message": message,
        "data": _decimal_to_string(data),
    }

    if extra:
        payload.update(_decimal_to_string(extra))

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


def _validation_errors(exc: ValidationError) -> Any:
    if hasattr(exc, "message_dict"):
        return exc.message_dict

    if hasattr(exc, "messages"):
        return exc.messages

    return str(exc)


# ============================================================
# 🔹 Helpers
# ============================================================

def _ensure_authenticated(request):
    if not getattr(request, "user", None) or not request.user.is_authenticated:
        return None, _json_error("Authentication required.", 401)

    return request.user, None


def _orders_queryset():
    return (
        Order.objects.select_related(
            "customer",
            "product",
            "provider",
            "contract",
            "agent",
            "created_by",
            "updated_by",
        )
        .prefetch_related("status_history")
        .all()
    )


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _snapshot_order(order: Order) -> dict[str, Any]:
    return {
        "status": order.status,
        "payment_status": order.payment_status,
        "fulfillment_status": order.fulfillment_status,
        "total_amount": order.total_amount,
        "amount_paid": order.amount_paid,
        "remaining_amount": order.remaining_amount,
        "agent_id": order.agent_id,
        "provider_id": order.provider_id,
        "contract_id": order.contract_id,
        "product_id": order.product_id,
        "customer_id": order.customer_id,
    }


def _build_update_transition(before: dict[str, Any], after: Order) -> dict[str, Any]:
    return {
        "status_before": before.get("status"),
        "status_after": after.status,
        "payment_status_before": before.get("payment_status"),
        "payment_status_after": after.payment_status,
        "fulfillment_status_before": before.get("fulfillment_status"),
        "fulfillment_status_after": after.fulfillment_status,
        "total_amount_before": before.get("total_amount"),
        "total_amount_after": after.total_amount,
        "amount_paid_before": before.get("amount_paid"),
        "amount_paid_after": after.amount_paid,
        "remaining_amount_before": before.get("remaining_amount"),
        "remaining_amount_after": after.remaining_amount,
        "agent_id_before": before.get("agent_id"),
        "agent_id_after": after.agent_id,
        "provider_id_before": before.get("provider_id"),
        "provider_id_after": after.provider_id,
        "contract_id_before": before.get("contract_id"),
        "contract_id_after": after.contract_id,
        "product_id_before": before.get("product_id"),
        "product_id_after": after.product_id,
        "customer_id_before": before.get("customer_id"),
        "customer_id_after": after.customer_id,
    }


# ============================================================
# 🔹 Order Detail API
# ============================================================

@require_http_methods(["GET", "PATCH", "PUT", "DELETE"])
def order_detail_api(request, order_id: int):
    user, auth_error = _ensure_authenticated(request)

    if auth_error:
        return auth_error

    order = get_object_or_404(_orders_queryset(), pk=order_id)

    if request.method == "GET":
        serialized_order = serialize_order(order)

        return _json_success(
            {
                "order": serialized_order,
            },
            message="Order loaded successfully.",
            extra={
                # توافق خلفي مع الفرونت الحالي
                "data": serialized_order,
            },
        )

    if request.method in {"PATCH", "PUT"}:
        try:
            payload = parse_json_body(request)
            before = _snapshot_order(order)

            updated_order = update_order(
                instance=order,
                payload=payload,
                user=user,
            )

            fresh_order = _orders_queryset().get(pk=updated_order.pk)
            serialized_order = serialize_order(fresh_order)

            return _json_success(
                {
                    "order": serialized_order,
                    "transition": _build_update_transition(before, fresh_order),
                },
                message="Order updated successfully.",
                extra={
                    # توافق خلفي مع الفرونت الحالي
                    "data": serialized_order,
                },
            )

        except ValidationError as exc:
            return _json_error(
                "Validation failed while updating order.",
                400,
                errors=_validation_errors(exc),
            )

        except Exception as exc:
            logger.exception("Failed to update order %s: %s", order_id, exc)
            return _json_error("Unexpected error while updating order.", 500)

    if request.method == "DELETE":
        try:
            payload = parse_json_body(request)
            before = _snapshot_order(order)

            reason = _clean_text(
                payload.get("reason")
                or payload.get("cancellation_reason")
                or "Cancelled from order detail API."
            )

            cancelled_order = cancel_order(
                instance=order,
                reason=reason,
                user=user,
                note=_clean_text(payload.get("status_note")) or reason,
            )

            fresh_order = _orders_queryset().get(pk=cancelled_order.pk)
            serialized_order = serialize_order(fresh_order)

            return _json_success(
                {
                    "order": serialized_order,
                    "transition": _build_update_transition(before, fresh_order),
                    "cancel": {
                        "reason": reason,
                    },
                },
                message="Order cancelled successfully.",
                extra={
                    # توافق خلفي مع الفرونت الحالي
                    "data": serialized_order,
                },
            )

        except ValidationError as exc:
            return _json_error(
                "Validation failed while cancelling order.",
                400,
                errors=_validation_errors(exc),
            )

        except Exception as exc:
            logger.exception("Failed to cancel order %s: %s", order_id, exc)
            return _json_error("Unexpected error while cancelling order.", 500)

    return _json_error("Unsupported method.", 405)