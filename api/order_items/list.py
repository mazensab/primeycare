# ============================================================
# 📂 api/order_items/list.py
# 🧠 Primey Care | Order Items API List/Create V2.2
# ------------------------------------------------------------
# ✅ List order items
# ✅ Create order item through order_items.services.create_order_item
# ✅ Supports item_kind / snapshots / fulfillment_reference
# ✅ Supports offer_id / contract_product_id
# ✅ Supports offer_source / offer_title / offer_badge
# ✅ Supports unit_price_before_discount / unit_discount_percentage
# ✅ Supports approval and execution statuses
# ✅ Unified response: ok / success / data / results
# ✅ Summary for frontend dashboards and filters
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
from django.views.decorators.http import require_http_methods

from order_items.models import (
    FulfillmentStatus,
    OrderItem,
    OrderItemKind,
    OrderItemOfferSource,
    OrderItemStatus,
)
from order_items.services import (
    apply_order_item_filters,
    create_order_item,
    paginate_queryset,
    parse_int,
    parse_json_body,
    serialize_order_item,
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
# 🔹 Auth / Queryset Helpers
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


def _parse_page_params(request) -> tuple[int, int]:
    page = parse_int(request.GET.get("page"), 1) or 1
    page_size = parse_int(request.GET.get("page_size"), 20) or 20

    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)

    return page, page_size


def _money(value: Any) -> Decimal:
    try:
        parsed = Decimal(str(value or "0.00")).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )
    except Exception:
        parsed = Decimal("0.00")

    if parsed < Decimal("0.00"):
        return Decimal("0.00")

    return parsed


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _increment(counter: dict[str, int], key: str) -> None:
    safe_key = _clean_text(key) or "unknown"
    counter[safe_key] = counter.get(safe_key, 0) + 1


# ============================================================
# 🔹 Summary
# ============================================================

def _build_items_summary(items: list[dict[str, Any]], pagination: dict[str, Any]) -> dict[str, Any]:
    total_amount = Decimal("0.00")
    net_amount = Decimal("0.00")
    before_discount_amount = Decimal("0.00")
    after_discount_amount = Decimal("0.00")
    discount_amount = Decimal("0.00")
    quantity_total = 0

    requires_approval_count = 0
    approval_pending_count = 0
    approved_count = 0
    rejected_count = 0
    completed_count = 0
    cancelled_count = 0
    fulfilled_count = 0
    scheduled_count = 0
    with_reference_count = 0
    with_service_item_count = 0
    with_contract_product_count = 0
    with_offer_count = 0

    item_kind_counts: dict[str, int] = {}
    offer_source_counts: dict[str, int] = {}
    status_counts: dict[str, int] = {}
    fulfillment_status_counts: dict[str, int] = {}
    product_type_counts: dict[str, int] = {}

    for item in items:
        quantity = int(item.get("quantity") or 0)

        total_amount += _money(item.get("total_amount"))
        net_amount += _money(item.get("net_unit_price")) * Decimal(str(quantity or 1))
        before_discount_amount += _money(item.get("line_total_before_discount"))
        after_discount_amount += _money(item.get("line_total_after_discount"))
        discount_amount += _money(item.get("discount_amount")) * Decimal(str(quantity or 1))
        quantity_total += quantity

        if item.get("requires_approval"):
            requires_approval_count += 1

        if item.get("status") == OrderItemStatus.APPROVAL_PENDING:
            approval_pending_count += 1

        if item.get("status") == OrderItemStatus.APPROVED:
            approved_count += 1

        if item.get("status") == OrderItemStatus.REJECTED:
            rejected_count += 1

        if item.get("status") == OrderItemStatus.COMPLETED:
            completed_count += 1

        if item.get("status") == OrderItemStatus.CANCELLED:
            cancelled_count += 1

        if item.get("fulfillment_status") == FulfillmentStatus.COMPLETED:
            fulfilled_count += 1

        if item.get("scheduled_at"):
            scheduled_count += 1

        if _clean_text(item.get("fulfillment_reference")):
            with_reference_count += 1

        if item.get("service_item_id"):
            with_service_item_count += 1

        if item.get("contract_product_id") or item.get("offer_id"):
            with_contract_product_count += 1
            with_offer_count += 1

        offer_source = item.get("offer_source") or OrderItemOfferSource.NONE

        if offer_source and offer_source != OrderItemOfferSource.NONE:
            with_offer_count += 0 if item.get("contract_product_id") else 1

        _increment(item_kind_counts, item.get("item_kind") or OrderItemKind.PRODUCT)
        _increment(offer_source_counts, offer_source)
        _increment(status_counts, item.get("status") or OrderItemStatus.PENDING)
        _increment(fulfillment_status_counts, item.get("fulfillment_status") or FulfillmentStatus.NOT_STARTED)
        _increment(product_type_counts, item.get("product_type") or "unknown")

    return {
        "current_page_count": len(items),
        "total_items": pagination.get("total_items", len(items)),
        "total_pages": pagination.get("total_pages", 1),

        "quantity_total": quantity_total,
        "page_total_amount": str(total_amount),
        "page_net_amount": str(net_amount),
        "page_before_discount_amount": str(before_discount_amount),
        "page_after_discount_amount": str(after_discount_amount),
        "page_discount_amount": str(discount_amount),

        "requires_approval_count": requires_approval_count,
        "approval_pending_count": approval_pending_count,
        "approved_count": approved_count,
        "rejected_count": rejected_count,
        "completed_count": completed_count,
        "cancelled_count": cancelled_count,
        "fulfilled_count": fulfilled_count,
        "scheduled_count": scheduled_count,
        "with_reference_count": with_reference_count,
        "with_service_item_count": with_service_item_count,
        "with_contract_product_count": with_contract_product_count,
        "with_offer_count": with_offer_count,

        "item_kind_counts": item_kind_counts,
        "offer_source_counts": offer_source_counts,
        "status_counts": status_counts,
        "fulfillment_status_counts": fulfillment_status_counts,
        "product_type_counts": product_type_counts,

        "card_items": item_kind_counts.get(OrderItemKind.CARD, 0),
        "program_items": item_kind_counts.get(OrderItemKind.PROGRAM, 0),
        "service_items": item_kind_counts.get(OrderItemKind.SERVICE, 0),
        "subscription_items": item_kind_counts.get(OrderItemKind.SUBSCRIPTION, 0),
        "product_items": item_kind_counts.get(OrderItemKind.PRODUCT, 0),
        "other_items": item_kind_counts.get(OrderItemKind.OTHER, 0),

        "contract_product_offer_items": offer_source_counts.get(OrderItemOfferSource.CONTRACT_PRODUCT, 0),
        "product_offer_items": offer_source_counts.get(OrderItemOfferSource.PRODUCT, 0),
        "manual_offer_items": offer_source_counts.get(OrderItemOfferSource.MANUAL, 0),
        "no_offer_items": offer_source_counts.get(OrderItemOfferSource.NONE, 0),

        "pending_items": status_counts.get(OrderItemStatus.PENDING, 0),
        "approval_pending_items": approval_pending_count,
        "approved_items": approved_count,
        "rejected_items": rejected_count,
        "in_progress_items": status_counts.get(OrderItemStatus.IN_PROGRESS, 0),
        "completed_items": completed_count,
        "cancelled_items": cancelled_count,

        "currency": "SAR",
    }


def _build_create_context(item: OrderItem) -> dict[str, Any]:
    return {
        "order": {
            "order_id": item.order_id,
            "order_number": item.order.order_number if item.order_id else "",
            "order_status": item.order.status if item.order_id else "",
            "payment_status": item.order.payment_status if item.order_id else "",
            "fulfillment_status": item.order.fulfillment_status if item.order_id else "",
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
        },
        "offer": {
            "offer_id": item.contract_product_id,
            "contract_product_id": item.contract_product_id,
            "has_offer": item.has_offer,
            "offer_source": item.offer_source,
            "offer_title": item.offer_title,
            "offer_badge": item.offer_badge,
            "unit_price_before_discount": str(item.unit_price_before_discount),
            "unit_discount_percentage": str(item.unit_discount_percentage),
            "unit_price": str(item.unit_price),
            "line_total_before_discount": str(item.line_total_before_discount),
            "line_total_after_discount": str(item.line_total_after_discount),
        },
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
        "execution": {
            "fulfillment_reference": item.fulfillment_reference,
            "scheduled_at": item.scheduled_at.isoformat() if item.scheduled_at else None,
            "approval_requested_at": item.approval_requested_at.isoformat() if item.approval_requested_at else None,
            "approved_at": item.approved_at.isoformat() if item.approved_at else None,
            "rejected_at": item.rejected_at.isoformat() if item.rejected_at else None,
            "started_at": item.started_at.isoformat() if item.started_at else None,
            "fulfilled_at": item.fulfilled_at.isoformat() if item.fulfilled_at else None,
            "cancelled_at": item.cancelled_at.isoformat() if item.cancelled_at else None,
        },
    }


# ============================================================
# 🔹 Order Items API
# ============================================================

@require_http_methods(["GET", "POST"])
def order_items_api(request):
    user, auth_error = _ensure_authenticated(request)

    if auth_error:
        return auth_error

    if request.method == "GET":
        try:
            queryset = apply_order_item_filters(_order_items_queryset(), request.GET)

            page, page_size = _parse_page_params(request)
            paginated = paginate_queryset(queryset, page=page, page_size=page_size)

            items = [
                serialize_order_item(item)
                for item in paginated["items"]
            ]

            summary = _build_items_summary(
                items=items,
                pagination=paginated["pagination"],
            )

            return _json_success(
                {
                    "items": items,
                    "results": items,
                    "pagination": paginated["pagination"],
                    "summary": summary,
                },
                message="Order items loaded successfully.",
                extra={
                    # توافق خلفي مع الفرونت الحالي
                    "results": items,
                    "pagination": paginated["pagination"],
                    "summary": summary,
                },
            )

        except ValidationError as exc:
            return _json_error(
                "Validation failed while loading order items.",
                400,
                errors=_validation_errors(exc),
            )

        except Exception as exc:
            logger.exception("Failed to load order items: %s", exc)
            return _json_error("Unexpected error while loading order items.", 500)

    try:
        payload = parse_json_body(request)
        item = create_order_item(payload=payload)

        fresh_item = _order_items_queryset().get(pk=item.pk)
        serialized_item = serialize_order_item(fresh_item)
        create_context = _build_create_context(fresh_item)

        return _json_success(
            {
                "item": serialized_item,
                "context": create_context,
            },
            message="Order item created successfully.",
            status=201,
            extra={
                # توافق خلفي مع الفرونت الحالي
                "data": serialized_item,
                "item": serialized_item,
                "context": create_context,
            },
        )

    except ValidationError as exc:
        return _json_error(
            "Validation failed while creating order item.",
            400,
            errors=_validation_errors(exc),
        )

    except Exception as exc:
        logger.exception("Failed to create order item: %s", exc)
        return _json_error("Unexpected error while creating order item.", 500)


# ============================================================
# 🔹 Pending Order Items API
# ============================================================

@require_http_methods(["GET"])
def pending_order_items_api(request):
    user, auth_error = _ensure_authenticated(request)

    if auth_error:
        return auth_error

    try:
        queryset = _order_items_queryset().filter(status=OrderItemStatus.PENDING)
        queryset = apply_order_item_filters(queryset, request.GET)

        page, page_size = _parse_page_params(request)
        paginated = paginate_queryset(queryset, page=page, page_size=page_size)

        items = [
            serialize_order_item(item)
            for item in paginated["items"]
        ]

        summary = _build_items_summary(
            items=items,
            pagination=paginated["pagination"],
        )

        return _json_success(
            {
                "items": items,
                "results": items,
                "pagination": paginated["pagination"],
                "summary": summary,
            },
            message="Pending order items loaded successfully.",
            extra={
                # توافق خلفي مع الفرونت الحالي
                "results": items,
                "pagination": paginated["pagination"],
                "summary": summary,
            },
        )

    except ValidationError as exc:
        return _json_error(
            "Validation failed while loading pending order items.",
            400,
            errors=_validation_errors(exc),
        )

    except Exception as exc:
        logger.exception("Failed to load pending order items: %s", exc)
        return _json_error("Unexpected error while loading pending order items.", 500)