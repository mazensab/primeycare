# ============================================================
# 📂 api/orders/status.py
# 🧭 Primey Care — Orders Lifecycle API V2
# ------------------------------------------------------------
# ✅ confirm
# ✅ processing
# ✅ complete
# ✅ cancel
# ✅ refund
# ✅ attach_invoice
# ✅ create_invoice optional
# ✅ issue_invoice optional through orders.services/create_invoice flow
# ✅ Unified response: ok / success / data
# ✅ Compatible with Accounting / Treasury backend flow
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
    attach_invoice,
    cancel_order,
    complete_order,
    confirm_order,
    parse_bool,
    parse_json_body,
    refund_order,
    serialize_order,
    start_processing_order,
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


def _normalize_action(value: Any) -> str:
    return str(value or "").strip().lower().replace("-", "_")


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _build_transition_payload(
    *,
    order_before: Order,
    order_after: Order,
    action: str,
    note: str,
) -> dict[str, Any]:
    return {
        "action": action,
        "note": note,
        "status_before": order_before.status,
        "status_after": order_after.status,
        "payment_status_before": order_before.payment_status,
        "payment_status_after": order_after.payment_status,
        "fulfillment_status_before": order_before.fulfillment_status,
        "fulfillment_status_after": order_after.fulfillment_status,
    }


def _snapshot_order(order: Order) -> Order:
    """
    نسخة خفيفة من القيم المهمة قبل التغيير.
    لا نستخدم deepcopy حتى لا نحمل علاقات كثيرة.
    """
    snapshot = Order(
        id=order.id,
        status=order.status,
        payment_status=order.payment_status,
        fulfillment_status=order.fulfillment_status,
    )
    return snapshot


def _create_or_attach_invoice_action(
    *,
    order: Order,
    payload: dict[str, Any],
    user,
    note: str,
) -> Order:
    """
    يدعم حالتين:
    - attach_invoice: إرفاق فاتورة موجودة عبر invoice_id.
    - create_invoice / issue_invoice: إنشاء فاتورة من الطلب عبر orders.services.update_order
      باستخدام flags التي عالجناها داخل orders.services.create_order/update_order سابقًا.
    """
    invoice_id = payload.get("invoice_id")

    if invoice_id not in (None, "", 0, "0"):
        return attach_invoice(
            instance=order,
            invoice_id=invoice_id,
            user=user,
            note=note,
        )

    update_payload = {
        "status_note": note or "Invoice action requested.",
        "allow_any_status": True,
        "auto_create_invoice": True,
        "issue_invoice_immediately": parse_bool(
            payload.get("issue_invoice_immediately"),
            False,
        ),
        "auto_post_accounting": parse_bool(
            payload.get("auto_post_accounting"),
            True,
        ),
        "invoice_notes": payload.get("invoice_notes") or "",
        "invoice_internal_notes": payload.get("invoice_internal_notes") or "",
    }

    return update_order(
        instance=order,
        payload=update_payload,
        user=user,
    )


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
        note = _clean_text(payload.get("note") or payload.get("status_note") or "")

        if not action:
            return _json_error("Action or status is required.", 400)

        order_before = _snapshot_order(order)

        if action in {"confirm", "confirmed"}:
            updated_order = confirm_order(
                instance=order,
                user=user,
                note=note,
            )

        elif action in {"processing", "process", "start_processing", "in_progress"}:
            updated_order = start_processing_order(
                instance=order,
                user=user,
                note=note,
            )

        elif action in {"complete", "completed"}:
            updated_order = complete_order(
                instance=order,
                user=user,
                note=note,
            )

        elif action in {"cancel", "cancelled", "canceled"}:
            reason = _clean_text(
                payload.get("reason")
                or payload.get("cancellation_reason")
                or note
            )

            updated_order = cancel_order(
                instance=order,
                reason=reason,
                user=user,
                note=note or reason,
            )

        elif action in {"refund", "refunded"}:
            updated_order = refund_order(
                instance=order,
                user=user,
                note=note,
            )

        elif action in {"attach_invoice", "invoice", "create_invoice", "issue_invoice"}:
            updated_order = _create_or_attach_invoice_action(
                order=order,
                payload=payload,
                user=user,
                note=note,
            )

        else:
            updated_order = update_order(
                instance=order,
                payload={
                    "status": action,
                    "status_note": note,
                },
                user=user,
            )

        fresh_order = _orders_queryset().get(pk=updated_order.pk)
        serialized_order = serialize_order(fresh_order)

        return _json_success(
            {
                "order": serialized_order,
                "transition": _build_transition_payload(
                    order_before=order_before,
                    order_after=fresh_order,
                    action=action,
                    note=note,
                ),
            },
            message="Order lifecycle action completed successfully.",
            extra={
                # توافق خلفي مع الفرونت الحالي
                "data": serialized_order,
            },
        )

    except ValidationError as exc:
        return _json_error(
            "Validation failed while changing order status.",
            400,
            errors=_validation_errors(exc),
        )

    except Exception as exc:
        logger.exception("Failed to change order status %s: %s", order_id, exc)
        return _json_error("Unexpected error while changing order status.", 500)