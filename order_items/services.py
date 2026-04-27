# ============================================================
# 📂 order_items/services.py
# 🧠 Primey Care | Order Items Services
# ------------------------------------------------------------
# ✅ Parsing / Validation / Serialization
# ✅ Filtering / Pagination
# ✅ Create / Update Order Item
# ============================================================

from __future__ import annotations

import json
from decimal import Decimal, InvalidOperation
from typing import Any

from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.db.models import Q, QuerySet

from contracts.models import Contract, ContractProduct
from order_items.models import FulfillmentStatus, OrderItem, OrderItemStatus
from orders.models import Order
from products.models import Product
from providers.models import Provider
from service_items.models import ContractServiceItem


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

def apply_order_item_filters(queryset: QuerySet[OrderItem], params) -> QuerySet[OrderItem]:
    q = normalize_text(params.get("q"))
    status = normalize_text(params.get("status"))
    fulfillment_status = normalize_text(params.get("fulfillment_status"))
    order_id = parse_int(params.get("order_id"))
    product_id = parse_int(params.get("product_id"))
    provider_id = parse_int(params.get("provider_id"))
    contract_id = parse_int(params.get("contract_id"))
    contract_product_id = parse_int(params.get("contract_product_id"))
    service_item_id = parse_int(params.get("service_item_id"))
    requires_approval = parse_bool(params.get("requires_approval"))

    if q:
        queryset = queryset.filter(
            Q(title__icontains=q)
            | Q(code__icontains=q)
            | Q(approval_notes__icontains=q)
            | Q(execution_notes__icontains=q)
            | Q(internal_notes__icontains=q)
            | Q(order__order_number__icontains=q)
            | Q(order__customer__full_name__icontains=q)
            | Q(product__name__icontains=q)
            | Q(product__code__icontains=q)
            | Q(provider__name__icontains=q)
            | Q(contract__title__icontains=q)
            | Q(contract__contract_number__icontains=q)
            | Q(service_item__name__icontains=q)
            | Q(service_item__code__icontains=q)
        )

    if status:
        queryset = queryset.filter(status=status)

    if fulfillment_status:
        queryset = queryset.filter(fulfillment_status=fulfillment_status)

    if order_id:
        queryset = queryset.filter(order_id=order_id)

    if product_id:
        queryset = queryset.filter(product_id=product_id)

    if provider_id:
        queryset = queryset.filter(provider_id=provider_id)

    if contract_id:
        queryset = queryset.filter(contract_id=contract_id)

    if contract_product_id:
        queryset = queryset.filter(contract_product_id=contract_product_id)

    if service_item_id:
        queryset = queryset.filter(service_item_id=service_item_id)

    if requires_approval is not None:
        queryset = queryset.filter(requires_approval=requires_approval)

    return queryset


# ============================================================
# 🔹 Validation / Resolve Helpers
# ============================================================

def _validate_status(value: str) -> str:
    allowed = {choice for choice, _ in OrderItemStatus.choices}
    if value not in allowed:
        raise ValidationError(f"Invalid status. Allowed values: {sorted(allowed)}")
    return value


def _validate_fulfillment_status(value: str) -> str:
    allowed = {choice for choice, _ in FulfillmentStatus.choices}
    if value not in allowed:
        raise ValidationError(f"Invalid fulfillment_status. Allowed values: {sorted(allowed)}")
    return value


def _resolve_order(order_id: Any) -> Order:
    if order_id in (None, "", 0, "0"):
        raise ValidationError("Order is required.")

    try:
        return Order.objects.get(pk=int(order_id))
    except (Order.DoesNotExist, TypeError, ValueError):
        raise ValidationError("Selected order does not exist.")


def _resolve_product(product_id: Any) -> Product:
    if product_id in (None, "", 0, "0"):
        raise ValidationError("Product is required.")

    try:
        return Product.objects.get(pk=int(product_id))
    except (Product.DoesNotExist, TypeError, ValueError):
        raise ValidationError("Selected product does not exist.")


def _resolve_provider(provider_id: Any) -> Provider | None:
    if provider_id in (None, "", 0, "0"):
        return None

    try:
        return Provider.objects.get(pk=int(provider_id))
    except (Provider.DoesNotExist, TypeError, ValueError):
        raise ValidationError("Selected provider does not exist.")


def _resolve_contract(contract_id: Any) -> Contract | None:
    if contract_id in (None, "", 0, "0"):
        return None

    try:
        return Contract.objects.select_related("provider").get(pk=int(contract_id))
    except (Contract.DoesNotExist, TypeError, ValueError):
        raise ValidationError("Selected contract does not exist.")


def _resolve_contract_product(contract_product_id: Any) -> ContractProduct | None:
    if contract_product_id in (None, "", 0, "0"):
        return None

    try:
        return ContractProduct.objects.select_related("contract", "product").get(pk=int(contract_product_id))
    except (ContractProduct.DoesNotExist, TypeError, ValueError):
        raise ValidationError("Selected contract product does not exist.")


def _resolve_service_item(service_item_id: Any) -> ContractServiceItem | None:
    if service_item_id in (None, "", 0, "0"):
        return None

    try:
        return ContractServiceItem.objects.select_related(
            "contract",
            "contract_product",
            "contract__provider",
        ).get(pk=int(service_item_id))
    except (ContractServiceItem.DoesNotExist, TypeError, ValueError):
        raise ValidationError("Selected service item does not exist.")


def _validate_relations(
    *,
    order: Order,
    product: Product,
    provider: Provider | None,
    contract: Contract | None,
    contract_product: ContractProduct | None,
    service_item: ContractServiceItem | None,
) -> tuple[Provider | None, Contract | None, ContractProduct | None, ContractServiceItem | None]:
    if order.product_id != product.id:
        raise ValidationError("Order item product must match the parent order product.")

    if contract and provider and contract.provider_id != provider.id:
        raise ValidationError("Selected contract does not belong to the selected provider.")

    if contract_product and contract and contract_product.contract_id != contract.id:
        raise ValidationError("Selected contract product does not belong to the selected contract.")

    if service_item:
        if contract and service_item.contract_id != contract.id:
            raise ValidationError("Selected service item does not belong to the selected contract.")

        if contract_product and service_item.contract_product_id and service_item.contract_product_id != contract_product.id:
            raise ValidationError("Selected service item does not belong to the selected contract product.")

        if provider and service_item.contract.provider_id != provider.id:
            raise ValidationError("Selected service item belongs to a different provider.")

        if not contract:
            contract = service_item.contract

        if not provider:
            provider = service_item.contract.provider

        if not contract_product and service_item.contract_product_id:
            contract_product = service_item.contract_product

    if contract and not provider:
        provider = contract.provider

    if contract_product and not contract:
        contract = contract_product.contract

    return provider, contract, contract_product, service_item


# ============================================================
# 🔹 Serialization
# ============================================================

def serialize_order_item(obj: OrderItem) -> dict[str, Any]:
    return {
        "id": obj.id,
        "order_id": obj.order_id,
        "order": {
            "id": obj.order.id,
            "order_number": obj.order.order_number,
            "status": obj.order.status,
            "payment_status": obj.order.payment_status,
            "customer_id": obj.order.customer_id,
            "customer_name": getattr(obj.order.customer, "full_name", ""),
        } if obj.order_id else None,
        "product_id": obj.product_id,
        "product": {
            "id": obj.product.id,
            "name": obj.product.name,
            "code": obj.product.code,
            "product_type": obj.product.product_type,
            "status": obj.product.status,
        } if obj.product_id else None,
        "provider_id": obj.provider_id,
        "provider": {
            "id": obj.provider.id,
            "name": obj.provider.name,
            "code": obj.provider.code,
            "provider_type": obj.provider.provider_type,
            "status": obj.provider.status,
        } if obj.provider_id else None,
        "contract_id": obj.contract_id,
        "contract": {
            "id": obj.contract.id,
            "title": obj.contract.title,
            "contract_number": obj.contract.contract_number,
            "status": obj.contract.status,
        } if obj.contract_id else None,
        "contract_product_id": obj.contract_product_id,
        "contract_product": {
            "id": obj.contract_product.id,
            "product_id": obj.contract_product.product_id,
            "product_name": obj.contract_product.product.name if obj.contract_product.product_id else None,
            "is_active": obj.contract_product.is_active,
            "special_price": str(obj.contract_product.special_price) if obj.contract_product.special_price is not None else None,
            "discount_percentage": str(obj.contract_product.discount_percentage),
        } if obj.contract_product_id else None,
        "service_item_id": obj.service_item_id,
        "service_item": {
            "id": obj.service_item.id,
            "name": obj.service_item.name,
            "code": obj.service_item.code,
            "status": obj.service_item.status,
            "coverage_type": obj.service_item.coverage_type,
            "requires_approval": obj.service_item.requires_approval,
            "special_price": str(obj.service_item.special_price) if obj.service_item.special_price is not None else None,
            "discount_percentage": str(obj.service_item.discount_percentage),
        } if obj.service_item_id else None,
        "title": obj.title,
        "code": obj.code,
        "status": obj.status,
        "fulfillment_status": obj.fulfillment_status,
        "quantity": obj.quantity,
        "unit_price": str(obj.unit_price),
        "discount_percentage": str(obj.discount_percentage),
        "discount_amount": str(obj.discount_amount),
        "net_unit_price": str(obj.net_unit_price),
        "total_amount": str(obj.total_amount),
        "requires_approval": obj.requires_approval,
        "approval_notes": obj.approval_notes,
        "execution_notes": obj.execution_notes,
        "internal_notes": obj.internal_notes,
        "scheduled_at": obj.scheduled_at.isoformat() if obj.scheduled_at else None,
        "fulfilled_at": obj.fulfilled_at.isoformat() if obj.fulfilled_at else None,
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
    }


# ============================================================
# 🔹 Create / Update
# ============================================================

def create_order_item(*, payload: dict[str, Any]) -> OrderItem:
    order = _resolve_order(payload.get("order_id"))
    product = _resolve_product(payload.get("product_id"))
    provider = _resolve_provider(payload.get("provider_id"))
    contract = _resolve_contract(payload.get("contract_id"))
    contract_product = _resolve_contract_product(payload.get("contract_product_id"))
    service_item = _resolve_service_item(payload.get("service_item_id"))

    provider, contract, contract_product, service_item = _validate_relations(
        order=order,
        product=product,
        provider=provider,
        contract=contract,
        contract_product=contract_product,
        service_item=service_item,
    )

    title = normalize_text(payload.get("title"))
    if not title:
        title = service_item.name if service_item else product.name

    status = normalize_text(payload.get("status")) or OrderItemStatus.PENDING
    fulfillment_status = normalize_text(payload.get("fulfillment_status")) or FulfillmentStatus.NOT_STARTED

    status = _validate_status(status)
    fulfillment_status = _validate_fulfillment_status(fulfillment_status)

    requires_approval = parse_bool(payload.get("requires_approval"), False) or False
    if service_item and service_item.requires_approval:
        requires_approval = True

    unit_price = parse_decimal(payload.get("unit_price"))
    if unit_price is None:
        if service_item and service_item.special_price is not None:
            unit_price = service_item.special_price
        elif contract_product and contract_product.special_price is not None:
            unit_price = contract_product.special_price
        else:
            unit_price = product.effective_price or Decimal("0.00")

    item = OrderItem(
        order=order,
        product=product,
        provider=provider,
        contract=contract,
        contract_product=contract_product,
        service_item=service_item,
        title=title,
        code=normalize_text(payload.get("code")),
        status=status,
        fulfillment_status=fulfillment_status,
        quantity=parse_int(payload.get("quantity"), 1) or 1,
        unit_price=unit_price,
        discount_percentage=parse_decimal(payload.get("discount_percentage"), Decimal("0.00")) or Decimal("0.00"),
        discount_amount=parse_decimal(payload.get("discount_amount"), Decimal("0.00")) or Decimal("0.00"),
        requires_approval=requires_approval,
        approval_notes=normalize_text(payload.get("approval_notes")),
        execution_notes=normalize_text(payload.get("execution_notes")),
        internal_notes=normalize_text(payload.get("internal_notes")),
        scheduled_at=payload.get("scheduled_at") or None,
        fulfilled_at=payload.get("fulfilled_at") or None,
    )

    item.full_clean()
    item.save()
    return item


def update_order_item(*, instance: OrderItem, payload: dict[str, Any]) -> OrderItem:
    order = instance.order
    product = instance.product
    provider = instance.provider
    contract = instance.contract
    contract_product = instance.contract_product
    service_item = instance.service_item

    if "order_id" in payload:
        order = _resolve_order(payload.get("order_id"))

    if "product_id" in payload:
        product = _resolve_product(payload.get("product_id"))

    if "provider_id" in payload:
        provider = _resolve_provider(payload.get("provider_id"))

    if "contract_id" in payload:
        contract = _resolve_contract(payload.get("contract_id"))

    if "contract_product_id" in payload:
        contract_product = _resolve_contract_product(payload.get("contract_product_id"))

    if "service_item_id" in payload:
        service_item = _resolve_service_item(payload.get("service_item_id"))

    provider, contract, contract_product, service_item = _validate_relations(
        order=order,
        product=product,
        provider=provider,
        contract=contract,
        contract_product=contract_product,
        service_item=service_item,
    )

    instance.order = order
    instance.product = product
    instance.provider = provider
    instance.contract = contract
    instance.contract_product = contract_product
    instance.service_item = service_item

    if "title" in payload:
        instance.title = normalize_text(payload.get("title"))

    if "code" in payload:
        instance.code = normalize_text(payload.get("code"))

    if "status" in payload:
        instance.status = normalize_text(payload.get("status"))

    if "fulfillment_status" in payload:
        instance.fulfillment_status = normalize_text(payload.get("fulfillment_status"))

    if "quantity" in payload:
        instance.quantity = parse_int(payload.get("quantity"), 1) or 1

    if "unit_price" in payload:
        instance.unit_price = parse_decimal(payload.get("unit_price"), Decimal("0.00")) or Decimal("0.00")

    if "discount_percentage" in payload:
        instance.discount_percentage = parse_decimal(payload.get("discount_percentage"), Decimal("0.00")) or Decimal("0.00")

    if "discount_amount" in payload:
        instance.discount_amount = parse_decimal(payload.get("discount_amount"), Decimal("0.00")) or Decimal("0.00")

    if "requires_approval" in payload:
        instance.requires_approval = parse_bool(payload.get("requires_approval"), instance.requires_approval)

    if service_item and service_item.requires_approval:
        instance.requires_approval = True

    if "approval_notes" in payload:
        instance.approval_notes = normalize_text(payload.get("approval_notes"))

    if "execution_notes" in payload:
        instance.execution_notes = normalize_text(payload.get("execution_notes"))

    if "internal_notes" in payload:
        instance.internal_notes = normalize_text(payload.get("internal_notes"))

    if "scheduled_at" in payload:
        instance.scheduled_at = payload.get("scheduled_at") or None

    if "fulfilled_at" in payload:
        instance.fulfilled_at = payload.get("fulfilled_at") or None

    if not instance.title:
        instance.title = service_item.name if service_item else product.name

    instance.status = _validate_status(instance.status)
    instance.fulfillment_status = _validate_fulfillment_status(instance.fulfillment_status)

    instance.full_clean()
    instance.save()
    return instance