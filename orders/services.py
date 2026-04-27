# ============================================================
# 📂 orders/services.py
# 🧭 Primey Care — Orders Services
# ------------------------------------------------------------
# ✅ Parsing / Validation / Serialization
# ✅ Filtering / Pagination
# ✅ Create / Update Order
# ✅ Status history tracking
# ============================================================

from __future__ import annotations

import json
from decimal import Decimal, InvalidOperation
from typing import Any

from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import Q, QuerySet

from customers.models import Customer
from orders.models import Order, OrderStatusHistory
from products.models import Product


# ============================================================
# 🔹 JSON Helpers
# ============================================================

def parse_json_body(request) -> dict[str, Any]:
    if not request.body:
        return {}

    try:
        return json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValidationError(f"Invalid JSON body: {exc}")


# ============================================================
# 🔹 Primitive Helpers
# ============================================================

def normalize_text(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def parse_bool(value: Any, default: bool | None = None) -> bool | None:
    if value is None:
        return default

    if isinstance(value, bool):
        return value

    if isinstance(value, (int, float)):
        return bool(value)

    value_str = str(value).strip().lower()

    if value_str in {"1", "true", "yes", "on"}:
        return True
    if value_str in {"0", "false", "no", "off"}:
        return False

    return default


def parse_int(value: Any, default: int | None = None) -> int | None:
    if value in (None, ""):
        return default

    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def parse_decimal(value: Any, default: Decimal | None = None) -> Decimal | None:
    if value in (None, ""):
        return default

    try:
        return Decimal(str(value).strip())
    except (InvalidOperation, AttributeError, TypeError, ValueError):
        raise ValidationError(f"Invalid decimal value: {value}")


# ============================================================
# 🔹 Pagination
# ============================================================

def paginate_queryset(queryset: QuerySet, page: int = 1, page_size: int = 20) -> dict[str, Any]:
    safe_page = max(page or 1, 1)
    safe_page_size = min(max(page_size or 20, 1), 100)

    paginator = Paginator(queryset, safe_page_size)
    current_page = paginator.get_page(safe_page)

    return {
        "items": list(current_page.object_list),
        "pagination": {
            "page": current_page.number,
            "page_size": safe_page_size,
            "total_pages": paginator.num_pages,
            "total_items": paginator.count,
            "has_next": current_page.has_next(),
            "has_previous": current_page.has_previous(),
        },
    }


# ============================================================
# 🔹 Filters
# ============================================================

def apply_order_filters(queryset: QuerySet[Order], params) -> QuerySet[Order]:
    q = normalize_text(params.get("q"))
    status = normalize_text(params.get("status"))
    payment_status = normalize_text(params.get("payment_status"))
    fulfillment_status = normalize_text(params.get("fulfillment_status"))
    source = normalize_text(params.get("source"))
    customer_id = parse_int(params.get("customer_id"))
    product_id = parse_int(params.get("product_id"))
    created_by_id = parse_int(params.get("created_by_id"))

    if q:
        queryset = queryset.filter(
            Q(order_number__icontains=q)
            | Q(product_name__icontains=q)
            | Q(product_type__icontains=q)
            | Q(customer__full_name__icontains=q)
            | Q(customer__phone__icontains=q)
            | Q(customer__email__icontains=q)
            | Q(product__name__icontains=q)
            | Q(product__code__icontains=q)
            | Q(customer_notes__icontains=q)
            | Q(internal_notes__icontains=q)
            | Q(issue_reference__icontains=q)
        )

    if status:
        queryset = queryset.filter(status=status)

    if payment_status:
        queryset = queryset.filter(payment_status=payment_status)

    if fulfillment_status:
        queryset = queryset.filter(fulfillment_status=fulfillment_status)

    if source:
        queryset = queryset.filter(source=source)

    if customer_id:
        queryset = queryset.filter(customer_id=customer_id)

    if product_id:
        queryset = queryset.filter(product_id=product_id)

    if created_by_id:
        queryset = queryset.filter(created_by_id=created_by_id)

    return queryset


# ============================================================
# 🔹 Validation / Resolve Helpers
# ============================================================

def _validate_status(value: str) -> str:
    allowed = {choice for choice, _ in Order.Status.choices}
    if value not in allowed:
        raise ValidationError(f"Invalid status. Allowed values: {sorted(allowed)}")
    return value


def _validate_payment_status(value: str) -> str:
    allowed = {choice for choice, _ in Order.PaymentStatus.choices}
    if value not in allowed:
        raise ValidationError(f"Invalid payment_status. Allowed values: {sorted(allowed)}")
    return value


def _validate_fulfillment_status(value: str) -> str:
    allowed = {choice for choice, _ in Order.FulfillmentStatus.choices}
    if value not in allowed:
        raise ValidationError(f"Invalid fulfillment_status. Allowed values: {sorted(allowed)}")
    return value


def _validate_source(value: str) -> str:
    allowed = {choice for choice, _ in Order.OrderSource.choices}
    if value not in allowed:
        raise ValidationError(f"Invalid source. Allowed values: {sorted(allowed)}")
    return value


def _resolve_customer(customer_id: Any) -> Customer:
    if customer_id in (None, "", 0, "0"):
        raise ValidationError("Customer is required.")

    try:
        return Customer.objects.get(pk=int(customer_id))
    except (Customer.DoesNotExist, TypeError, ValueError):
        raise ValidationError("Selected customer does not exist.")


def _resolve_product(product_id: Any) -> Product:
    if product_id in (None, "", 0, "0"):
        raise ValidationError("Product is required.")

    try:
        return Product.objects.get(pk=int(product_id))
    except (Product.DoesNotExist, TypeError, ValueError):
        raise ValidationError("Selected product does not exist.")


# ============================================================
# 🔹 Serialization
# ============================================================

def serialize_order_status_history(obj: OrderStatusHistory) -> dict[str, Any]:
    return {
        "id": obj.id,
        "order_id": obj.order_id,
        "from_status": obj.from_status,
        "to_status": obj.to_status,
        "note": obj.note,
        "changed_by_id": obj.changed_by_id,
        "changed_by_name": getattr(obj.changed_by, "get_full_name", lambda: "")() if obj.changed_by_id else "",
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
    }


def serialize_order(obj: Order, include_history: bool = True) -> dict[str, Any]:
    data = {
        "id": obj.id,
        "order_number": obj.order_number,
        "customer_id": obj.customer_id,
        "customer": {
            "id": obj.customer.id,
            "full_name": getattr(obj.customer, "full_name", ""),
            "phone": getattr(obj.customer, "phone", ""),
            "email": getattr(obj.customer, "email", ""),
            "status": getattr(obj.customer, "status", ""),
        } if obj.customer_id else None,
        "product_id": obj.product_id,
        "product": {
            "id": obj.product.id,
            "name": obj.product.name,
            "code": obj.product.code,
            "slug": obj.product.slug,
            "product_type": obj.product.product_type,
            "status": obj.product.status,
            "currency_code": obj.product.currency_code,
            "price": str(obj.product.price),
            "sale_price": str(obj.product.sale_price) if obj.product.sale_price is not None else None,
            "effective_price": str(obj.product.effective_price),
        } if obj.product_id else None,
        "status": obj.status,
        "payment_status": obj.payment_status,
        "fulfillment_status": obj.fulfillment_status,
        "source": obj.source,
        "product_name": obj.product_name,
        "product_type": obj.product_type,
        "currency_code": obj.currency_code,
        "unit_price": str(obj.unit_price),
        "quantity": obj.quantity,
        "subtotal_amount": str(obj.subtotal_amount),
        "discount_amount": str(obj.discount_amount),
        "tax_amount": str(obj.tax_amount),
        "total_amount": str(obj.total_amount),
        "amount_paid": str(obj.amount_paid),
        "remaining_amount": str(obj.remaining_amount),
        "is_paid": obj.is_paid,
        "issue_reference": obj.issue_reference,
        "issued_at": obj.issued_at.isoformat() if obj.issued_at else None,
        "customer_notes": obj.customer_notes,
        "internal_notes": obj.internal_notes,
        "cancellation_reason": obj.cancellation_reason,
        "created_by_id": obj.created_by_id,
        "updated_by_id": obj.updated_by_id,
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
    }

    if include_history:
        data["status_history"] = [
            serialize_order_status_history(item)
            for item in obj.status_history.all().order_by("-created_at")
        ]

    return data


# ============================================================
# 🔹 Status History
# ============================================================

def create_status_history(
    *,
    order: Order,
    from_status: str,
    to_status: str,
    note: str = "",
    user=None,
) -> OrderStatusHistory:
    return OrderStatusHistory.objects.create(
        order=order,
        from_status=from_status or "",
        to_status=to_status,
        note=normalize_text(note),
        changed_by=user if getattr(user, "is_authenticated", False) else None,
    )


# ============================================================
# 🔹 Create / Update
# ============================================================

def create_order(*, payload: dict[str, Any], user=None) -> Order:
    customer = _resolve_customer(payload.get("customer_id"))
    product = _resolve_product(payload.get("product_id"))

    status = normalize_text(payload.get("status")) or Order.Status.PENDING
    payment_status = normalize_text(payload.get("payment_status")) or Order.PaymentStatus.UNPAID
    fulfillment_status = normalize_text(payload.get("fulfillment_status")) or Order.FulfillmentStatus.NOT_STARTED
    source = normalize_text(payload.get("source")) or Order.OrderSource.ADMIN

    status = _validate_status(status)
    payment_status = _validate_payment_status(payment_status)
    fulfillment_status = _validate_fulfillment_status(fulfillment_status)
    source = _validate_source(source)

    order = Order(
        customer=customer,
        product=product,
        status=status,
        payment_status=payment_status,
        fulfillment_status=fulfillment_status,
        source=source,
        unit_price=parse_decimal(payload.get("unit_price"), Decimal("0.00")) or Decimal("0.00"),
        quantity=parse_int(payload.get("quantity"), 1) or 1,
        discount_amount=parse_decimal(payload.get("discount_amount"), Decimal("0.00")) or Decimal("0.00"),
        tax_amount=parse_decimal(payload.get("tax_amount"), Decimal("0.00")) or Decimal("0.00"),
        amount_paid=parse_decimal(payload.get("amount_paid"), Decimal("0.00")) or Decimal("0.00"),
        issue_reference=normalize_text(payload.get("issue_reference")),
        issued_at=payload.get("issued_at") or None,
        customer_notes=normalize_text(payload.get("customer_notes")),
        internal_notes=normalize_text(payload.get("internal_notes")),
        cancellation_reason=normalize_text(payload.get("cancellation_reason")),
        created_by=user if getattr(user, "is_authenticated", False) else None,
        updated_by=user if getattr(user, "is_authenticated", False) else None,
    )

    with transaction.atomic():
        order.full_clean()
        order.save()

        create_status_history(
            order=order,
            from_status="",
            to_status=order.status,
            note="Order created",
            user=user,
        )

    return order


def update_order(*, instance: Order, payload: dict[str, Any], user=None) -> Order:
    previous_status = instance.status

    if "customer_id" in payload:
        instance.customer = _resolve_customer(payload.get("customer_id"))

    if "product_id" in payload:
        instance.product = _resolve_product(payload.get("product_id"))

    if "status" in payload:
        instance.status = normalize_text(payload.get("status"))

    if "payment_status" in payload:
        instance.payment_status = normalize_text(payload.get("payment_status"))

    if "fulfillment_status" in payload:
        instance.fulfillment_status = normalize_text(payload.get("fulfillment_status"))

    if "source" in payload:
        instance.source = normalize_text(payload.get("source"))

    if "unit_price" in payload:
        instance.unit_price = parse_decimal(payload.get("unit_price"), Decimal("0.00")) or Decimal("0.00")

    if "quantity" in payload:
        instance.quantity = parse_int(payload.get("quantity"), 1) or 1

    if "discount_amount" in payload:
        instance.discount_amount = parse_decimal(payload.get("discount_amount"), Decimal("0.00")) or Decimal("0.00")

    if "tax_amount" in payload:
        instance.tax_amount = parse_decimal(payload.get("tax_amount"), Decimal("0.00")) or Decimal("0.00")

    if "amount_paid" in payload:
        instance.amount_paid = parse_decimal(payload.get("amount_paid"), Decimal("0.00")) or Decimal("0.00")

    if "issue_reference" in payload:
        instance.issue_reference = normalize_text(payload.get("issue_reference"))

    if "issued_at" in payload:
        instance.issued_at = payload.get("issued_at") or None

    if "customer_notes" in payload:
        instance.customer_notes = normalize_text(payload.get("customer_notes"))

    if "internal_notes" in payload:
        instance.internal_notes = normalize_text(payload.get("internal_notes"))

    if "cancellation_reason" in payload:
        instance.cancellation_reason = normalize_text(payload.get("cancellation_reason"))

    instance.status = _validate_status(instance.status)
    instance.payment_status = _validate_payment_status(instance.payment_status)
    instance.fulfillment_status = _validate_fulfillment_status(instance.fulfillment_status)
    instance.source = _validate_source(instance.source)

    if getattr(user, "is_authenticated", False):
        instance.updated_by = user

    with transaction.atomic():
        instance.full_clean()
        instance.save()

        if previous_status != instance.status:
            create_status_history(
                order=instance,
                from_status=previous_status,
                to_status=instance.status,
                note=normalize_text(payload.get("status_note"), "Status updated"),
                user=user,
            )

    return instance