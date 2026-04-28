# ============================================================
# 📂 api/orders/status.py
# 🧭 Primey Care — Orders Lifecycle API
# ------------------------------------------------------------
# ✅ confirm
# ✅ processing
# ✅ complete
# ✅ cancel
# ✅ refund
# ✅ attach_invoice
# ============================================================

from __future__ import annotations

import logging

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from orders.models import Order
from orders.services import (
    attach_invoice,
    cancel_order,
    complete_order,
    confirm_order,
    parse_json_body,
    refund_order,
    serialize_order,
    start_processing_order,
    update_order,
)

logger = logging.getLogger(__name__)


# ============================================================
# 🔹 Helpers
# ============================================================

def _json_error(message: str, status: int = 400, *, errors=None) -> JsonResponse:
    payload = {
        "ok": False,
        "message": message,
    }
    if errors is not None:
        payload["errors"] = errors
    return JsonResponse(payload, status=status)


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


def _normalize_action(value) -> str:
    return str(value or "").strip().lower().replace("-", "_")


# ============================================================
# 🔹 Order Lifecycle API
# ============================================================

@require_http_methods(["POST", "PATCH"])
def order_status_api(request, order_id: int):
    user, auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    order = get_object_or_404(_orders_queryset(), pk=order_id)

    try:
        payload = parse_json_body(request)
        action = _normalize_action(payload.get("action") or payload.get("status"))
        note = payload.get("note") or payload.get("status_note") or ""

        if action in {"confirm", "confirmed"}:
            updated_order = confirm_order(instance=order, user=user, note=note)

        elif action in {"processing", "process", "start_processing", "in_progress"}:
            updated_order = start_processing_order(instance=order, user=user, note=note)

        elif action in {"complete", "completed"}:
            updated_order = complete_order(instance=order, user=user, note=note)

        elif action in {"cancel", "cancelled", "canceled"}:
            reason = payload.get("reason") or payload.get("cancellation_reason") or note
            updated_order = cancel_order(instance=order, reason=reason, user=user, note=note or reason)

        elif action in {"refund", "refunded"}:
            updated_order = refund_order(instance=order, user=user, note=note)

        elif action in {"attach_invoice", "invoice"}:
            updated_order = attach_invoice(
                instance=order,
                invoice_id=payload.get("invoice_id"),
                user=user,
                note=note,
            )

        elif action:
            updated_order = update_order(
                instance=order,
                payload={
                    "status": action,
                    "status_note": note,
                },
                user=user,
            )

        else:
            return _json_error("Action or status is required.", 400)

        fresh_order = _orders_queryset().get(pk=updated_order.pk)

        return JsonResponse(
            {
                "ok": True,
                "message": "Order lifecycle action completed successfully.",
                "data": serialize_order(fresh_order),
            },
            status=200,
        )

    except ValidationError as exc:
        return _json_error("Validation failed while changing order status.", 400, errors=exc.messages)
    except Exception as exc:
        logger.exception("Failed to change order status %s: %s", order_id, exc)
        return _json_error("Unexpected error while changing order status.", 500)