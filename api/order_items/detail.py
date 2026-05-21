# ============================================================
# 📂 api/order_items/detail.py
# 🧠 Primey Care | Order Items API Detail/Update/Safe Cancel V2.2
# ------------------------------------------------------------
# ✅ Detail order item
# ✅ Update order item through order_items.services.update_order_item
# ✅ Safe cancel instead of hard delete
# ✅ Supports item_kind / snapshots / fulfillment_reference
# ✅ Supports offer_id / contract_product_id
# ✅ Supports offer_source / offer_title / offer_badge
# ✅ Supports unit_price_before_discount / unit_discount_percentage
# ✅ Supports approval and execution timestamps
# ✅ Unified response: ok / success / data / item / context / transition
# ------------------------------------------------------------
# القاعدة المعتمدة:
# - Product = كتالوج ثابت
# - ContractProduct = عرض/سعر/خصم المنتج حسب مقدم الخدمة والعقد
# - OrderItem يحفظ Snapshot ولا يتأثر بتغيير العرض لاحقًا
# ============================================================

from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from order_items.models import FulfillmentStatus, OrderItem, OrderItemStatus
from order_items.services import (
    parse_json_body,
    serialize_order_item,
    update_order_item,
)


logger = logging.getLogger(__name__)


# ============================================================
# 🔹 JSON Helpers
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


def _order_items_queryset():
    return (
        OrderItem.objects.select_related(
            "order",
            "order__customer",
            "order__product",
            "order__provider",
            "order__contract",
            "order__contract_product",
            "order__contract_product__product",
            "order__contract_product__contract",
            "order__contract_product__contract__provider",
            "order__agent",
            "order__delivery_agent",
            "product",
            "provider",
            "contract",
            "contract_product",
            "contract_product__product",
            "contract_product__contract",
            "contract_product__contract__provider",
            "service_item",
        )
        .all()
    )


def _safe_attr(obj: Any, *names: str, default: Any = "") -> Any:
    if not obj:
        return default

    for name in names:
        try:
            value = getattr(obj, name, None)
        except Exception:
            value = None

        if value not in (None, ""):
            return value

    return default


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return str(value)


def _money_str(value: Any) -> str:
    try:
        parsed = Decimal(str(value or "0.00")).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )
    except Exception:
        parsed = Decimal("0.00")

    if parsed < Decimal("0.00"):
        parsed = Decimal("0.00")

    return str(parsed)


def _percent_str(value: Any) -> str:
    try:
        parsed = Decimal(str(value or "0.00")).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )
    except Exception:
        parsed = Decimal("0.00")

    if parsed < Decimal("0.00"):
        parsed = Decimal("0.00")

    if parsed > Decimal("100.00"):
        parsed = Decimal("100.00")

    return str(parsed)


def _serialize_offer_snapshot(item: OrderItem) -> dict[str, Any]:
    contract_product = getattr(item, "contract_product", None)
    contract = getattr(contract_product, "contract", None) if contract_product else None
    provider = getattr(contract, "provider", None) if contract else None
    product = getattr(contract_product, "product", None) if contract_product else None

    return {
        "offer_id": item.contract_product_id,
        "contract_product_id": item.contract_product_id,
        "has_offer": item.has_offer,
        "offer_source": item.offer_source,
        "offer_title": item.offer_title,
        "offer_badge": item.offer_badge,

        "contract_product_offer_title": _safe_attr(contract_product, "offer_title"),
        "contract_product_offer_subtitle": _safe_attr(contract_product, "offer_subtitle"),
        "contract_product_offer_badge": _safe_attr(contract_product, "offer_badge"),
        "contract_product_offer_description": _safe_attr(contract_product, "offer_description"),

        "product_id": getattr(product, "id", None),
        "product_name": _safe_attr(product, "name"),
        "product_code": _safe_attr(product, "code"),
        "product_type": _safe_attr(product, "product_type"),

        "provider_id": getattr(provider, "id", None),
        "provider_name": _safe_attr(provider, "name", "name_ar", "name_en"),

        "contract_id": getattr(contract, "id", None),
        "contract_number": _safe_attr(contract, "contract_number", "number"),
        "contract_title": _safe_attr(contract, "title", "name"),

        "unit_price_before_discount": _money_str(item.unit_price_before_discount),
        "unit_discount_percentage": _percent_str(item.unit_discount_percentage),
        "unit_price": _money_str(item.unit_price),
        "discount_percentage": _percent_str(item.discount_percentage),
        "discount_amount": _money_str(item.discount_amount),
        "net_unit_price": _money_str(item.net_unit_price),
        "total_amount": _money_str(item.total_amount),
        "line_total_before_discount": _money_str(item.line_total_before_discount),
        "line_total_after_discount": _money_str(item.line_total_after_discount),
    }


def _snapshot_item(item: OrderItem) -> dict[str, Any]:
    return {
        "id": item.id,
        "order_id": item.order_id,
        "order_number": item.order.order_number if item.order_id else "",

        "product_id": item.product_id,
        "provider_id": item.provider_id,
        "contract_id": item.contract_id,
        "contract_product_id": item.contract_product_id,
        "offer_id": item.contract_product_id,
        "service_item_id": item.service_item_id,

        "item_kind": item.item_kind,
        "title": item.title,
        "code": item.code,
        "fulfillment_reference": item.fulfillment_reference,

        "status": item.status,
        "fulfillment_status": item.fulfillment_status,

        "product_name": item.product_name,
        "product_type": item.product_type,
        "provider_name": item.provider_name,
        "contract_number": item.contract_number,
        "currency_code": item.currency_code,

        "offer_source": item.offer_source,
        "offer_title": item.offer_title,
        "offer_badge": item.offer_badge,
        "has_offer": item.has_offer,

        "quantity": item.quantity,
        "unit_price_before_discount": item.unit_price_before_discount,
        "unit_discount_percentage": item.unit_discount_percentage,
        "unit_price": item.unit_price,
        "discount_percentage": item.discount_percentage,
        "discount_amount": item.discount_amount,
        "net_unit_price": item.net_unit_price,
        "total_amount": item.total_amount,
        "line_total_before_discount": item.line_total_before_discount,
        "line_total_after_discount": item.line_total_after_discount,

        "requires_approval": item.requires_approval,
        "approval_notes": item.approval_notes,
        "execution_notes": item.execution_notes,
        "internal_notes": item.internal_notes,

        "scheduled_at": _iso_datetime(item.scheduled_at),
        "approval_requested_at": _iso_datetime(item.approval_requested_at),
        "approved_at": _iso_datetime(item.approved_at),
        "rejected_at": _iso_datetime(item.rejected_at),
        "started_at": _iso_datetime(item.started_at),
        "fulfilled_at": _iso_datetime(item.fulfilled_at),
        "cancelled_at": _iso_datetime(item.cancelled_at),

        "is_completed": item.is_completed,
        "is_cancelled": item.is_cancelled,
        "is_fulfilled": item.is_fulfilled,
        "is_rejected": item.is_rejected,
        "needs_approval": item.needs_approval,

        "created_at": _iso_datetime(item.created_at),
        "updated_at": _iso_datetime(item.updated_at),
    }


def _value_changed(before: dict[str, Any], after: dict[str, Any], key: str) -> bool:
    return str(before.get(key) or "") != str(after.get(key) or "")


def _build_transition(before: dict[str, Any], after: OrderItem) -> dict[str, Any]:
    after_snapshot = _snapshot_item(after)

    tracked_keys = [
        "order_id",
        "order_number",
        "product_id",
        "provider_id",
        "contract_id",
        "contract_product_id",
        "offer_id",
        "service_item_id",

        "item_kind",
        "title",
        "code",
        "fulfillment_reference",

        "status",
        "fulfillment_status",

        "product_name",
        "product_type",
        "provider_name",
        "contract_number",
        "currency_code",

        "offer_source",
        "offer_title",
        "offer_badge",
        "has_offer",

        "quantity",
        "unit_price_before_discount",
        "unit_discount_percentage",
        "unit_price",
        "discount_percentage",
        "discount_amount",
        "net_unit_price",
        "total_amount",
        "line_total_before_discount",
        "line_total_after_discount",

        "requires_approval",
        "approval_notes",
        "execution_notes",
        "internal_notes",

        "scheduled_at",
        "approval_requested_at",
        "approved_at",
        "rejected_at",
        "started_at",
        "fulfilled_at",
        "cancelled_at",

        "is_completed",
        "is_cancelled",
        "is_fulfilled",
        "is_rejected",
        "needs_approval",
    ]

    changed_fields = [
        key
        for key in tracked_keys
        if _value_changed(before, after_snapshot, key)
    ]

    return {
        "changed_fields": changed_fields,
        "has_changes": bool(changed_fields),

        "status_before": before.get("status"),
        "status_after": after_snapshot.get("status"),

        "fulfillment_status_before": before.get("fulfillment_status"),
        "fulfillment_status_after": after_snapshot.get("fulfillment_status"),

        "item_kind_before": before.get("item_kind"),
        "item_kind_after": after_snapshot.get("item_kind"),

        "offer_id_before": before.get("offer_id"),
        "offer_id_after": after_snapshot.get("offer_id"),

        "contract_product_id_before": before.get("contract_product_id"),
        "contract_product_id_after": after_snapshot.get("contract_product_id"),

        "offer_source_before": before.get("offer_source"),
        "offer_source_after": after_snapshot.get("offer_source"),

        "offer_title_before": before.get("offer_title"),
        "offer_title_after": after_snapshot.get("offer_title"),

        "offer_badge_before": before.get("offer_badge"),
        "offer_badge_after": after_snapshot.get("offer_badge"),

        "quantity_before": before.get("quantity"),
        "quantity_after": after_snapshot.get("quantity"),

        "unit_price_before_discount_before": before.get("unit_price_before_discount"),
        "unit_price_before_discount_after": after_snapshot.get("unit_price_before_discount"),

        "unit_discount_percentage_before": before.get("unit_discount_percentage"),
        "unit_discount_percentage_after": after_snapshot.get("unit_discount_percentage"),

        "unit_price_before": before.get("unit_price"),
        "unit_price_after": after_snapshot.get("unit_price"),

        "discount_percentage_before": before.get("discount_percentage"),
        "discount_percentage_after": after_snapshot.get("discount_percentage"),

        "discount_amount_before": before.get("discount_amount"),
        "discount_amount_after": after_snapshot.get("discount_amount"),

        "net_unit_price_before": before.get("net_unit_price"),
        "net_unit_price_after": after_snapshot.get("net_unit_price"),

        "total_amount_before": before.get("total_amount"),
        "total_amount_after": after_snapshot.get("total_amount"),

        "line_total_before_discount_before": before.get("line_total_before_discount"),
        "line_total_before_discount_after": after_snapshot.get("line_total_before_discount"),

        "line_total_after_discount_before": before.get("line_total_after_discount"),
        "line_total_after_discount_after": after_snapshot.get("line_total_after_discount"),

        "requires_approval_before": before.get("requires_approval"),
        "requires_approval_after": after_snapshot.get("requires_approval"),

        "before": before,
        "after": after_snapshot,
    }


def _build_context(item: OrderItem) -> dict[str, Any]:
    return {
        "order": {
            "order_id": item.order_id,
            "order_number": item.order.order_number if item.order_id else "",
            "order_status": item.order.status if item.order_id else "",
            "payment_status": item.order.payment_status if item.order_id else "",
            "fulfillment_status": item.order.fulfillment_status if item.order_id else "",
            "customer_id": item.order.customer_id if item.order_id else None,
            "customer_name": _safe_attr(item.order.customer, "display_name", "full_name", "name") if item.order_id else "",
            "order_offer_id": getattr(item.order, "contract_product_id", None) if item.order_id else None,
            "order_offer_title": getattr(item.order, "offer_title", "") if item.order_id else "",
            "order_offer_badge": getattr(item.order, "offer_badge", "") if item.order_id else "",
        },
        "item": {
            "item_id": item.id,
            "item_kind": item.item_kind,
            "status": item.status,
            "fulfillment_status": item.fulfillment_status,
            "requires_approval": item.requires_approval,
            "needs_approval": item.needs_approval,
            "is_completed": item.is_completed,
            "is_cancelled": item.is_cancelled,
            "is_fulfilled": item.is_fulfilled,
            "is_rejected": item.is_rejected,
        },
        "offer": _serialize_offer_snapshot(item),
        "relations": {
            "product_id": item.product_id,
            "provider_id": item.provider_id,
            "contract_id": item.contract_id,
            "contract_product_id": item.contract_product_id,
            "offer_id": item.contract_product_id,
            "service_item_id": item.service_item_id,
        },
        "snapshot": {
            "product_name": item.product_name,
            "product_type": item.product_type,
            "provider_name": item.provider_name,
            "contract_number": item.contract_number,
            "currency_code": item.currency_code,
        },
        "financial": {
            "quantity": item.quantity,
            "unit_price_before_discount": str(item.unit_price_before_discount),
            "unit_discount_percentage": str(item.unit_discount_percentage),
            "unit_price": str(item.unit_price),
            "discount_percentage": str(item.discount_percentage),
            "discount_amount": str(item.discount_amount),
            "net_unit_price": str(item.net_unit_price),
            "total_amount": str(item.total_amount),
            "line_total_before_discount": str(item.line_total_before_discount),
            "line_total_after_discount": str(item.line_total_after_discount),
        },
        "approval": {
            "requires_approval": item.requires_approval,
            "approval_notes": item.approval_notes,
            "approval_requested_at": _iso_datetime(item.approval_requested_at),
            "approved_at": _iso_datetime(item.approved_at),
            "rejected_at": _iso_datetime(item.rejected_at),
        },
        "execution": {
            "fulfillment_reference": item.fulfillment_reference,
            "execution_notes": item.execution_notes,
            "scheduled_at": _iso_datetime(item.scheduled_at),
            "started_at": _iso_datetime(item.started_at),
            "fulfilled_at": _iso_datetime(item.fulfilled_at),
            "cancelled_at": _iso_datetime(item.cancelled_at),
        },
    }


# ============================================================
# 🔹 Order Item Detail API
# ============================================================

@require_http_methods(["GET", "PATCH", "PUT", "DELETE"])
def order_item_detail_api(request, order_item_id: int):
    user, auth_error = _ensure_authenticated(request)

    if auth_error:
        return auth_error

    item = get_object_or_404(
        _order_items_queryset(),
        pk=order_item_id,
    )

    if request.method == "GET":
        serialized_item = serialize_order_item(item)
        context = _build_context(item)

        return _json_success(
            {
                "item": serialized_item,
                "context": context,
            },
            message="Order item loaded successfully.",
            extra={
                # توافق خلفي مع الفرونت الحالي
                "data": serialized_item,
                "item": serialized_item,
                "context": context,
            },
        )

    if request.method in {"PATCH", "PUT"}:
        try:
            payload = parse_json_body(request)
            before = _snapshot_item(item)

            updated_item = update_order_item(
                instance=item,
                payload=payload,
            )

            fresh_item = _order_items_queryset().get(pk=updated_item.pk)
            serialized_item = serialize_order_item(fresh_item)
            context = _build_context(fresh_item)
            transition = _build_transition(before, fresh_item)

            return _json_success(
                {
                    "item": serialized_item,
                    "context": context,
                    "transition": transition,
                },
                message="Order item updated successfully.",
                extra={
                    # توافق خلفي مع الفرونت الحالي
                    "data": serialized_item,
                    "item": serialized_item,
                    "context": context,
                    "transition": transition,
                },
            )

        except ValidationError as exc:
            return _json_error(
                "Validation failed while updating order item.",
                400,
                errors=_validation_errors(exc),
            )

        except Exception as exc:
            logger.exception("Failed to update order item %s: %s", order_item_id, exc)
            return _json_error("Unexpected error while updating order item.", 500)

    if request.method == "DELETE":
        try:
            before = _snapshot_item(item)

            updated_item = update_order_item(
                instance=item,
                payload={
                    "status": OrderItemStatus.CANCELLED,
                    "fulfillment_status": FulfillmentStatus.CANCELLED,
                    "internal_notes": (
                        f"{item.internal_notes}\nSafe cancelled from API."
                        if item.internal_notes
                        else "Safe cancelled from API."
                    ),
                },
            )

            fresh_item = _order_items_queryset().get(pk=updated_item.pk)
            serialized_item = serialize_order_item(fresh_item)
            context = _build_context(fresh_item)
            transition = _build_transition(before, fresh_item)

            return _json_success(
                {
                    "item": serialized_item,
                    "context": context,
                    "transition": transition,
                    "cancel": {
                        "safe_cancel": True,
                        "deleted": False,
                    },
                },
                message="Order item cancelled successfully.",
                extra={
                    # توافق خلفي مع الفرونت الحالي
                    "data": serialized_item,
                    "item": serialized_item,
                    "context": context,
                    "transition": transition,
                },
            )

        except ValidationError as exc:
            return _json_error(
                "Validation failed while cancelling order item.",
                400,
                errors=_validation_errors(exc),
            )

        except Exception as exc:
            logger.exception("Failed to cancel order item %s: %s", order_item_id, exc)
            return _json_error("Unexpected error while cancelling order item.", 500)

    return _json_error("Unsupported method.", 405)