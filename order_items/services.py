# ============================================================
# 📂 order_items/services.py
# 🧠 Primey Care | Order Items Services V2.2
# ------------------------------------------------------------
# ✅ Parsing / Validation / Serialization
# ✅ Filtering / Pagination
# ✅ Create / Update Order Item
# ✅ Supports item_kind
# ✅ Supports offer_id / contract_product_id
# ✅ Supports offer snapshot:
#    - offer_source
#    - offer_title
#    - offer_badge
# ✅ Supports pricing snapshot:
#    - unit_price_before_discount
#    - unit_discount_percentage
#    - unit_price
# ✅ Supports operational snapshots
# ✅ Supports fulfillment reference
# ✅ Supports approval / execution timestamps
# ✅ Compatible with Order lifecycle V2.6
# ------------------------------------------------------------
# القاعدة المعتمدة:
# - Product = كتالوج ثابت
# - ContractProduct = عرض/سعر/خصم المنتج حسب مقدم الخدمة والعقد
# - OrderItem يحفظ Snapshot ولا يتأثر بتغيير العرض لاحقًا
# ============================================================

from __future__ import annotations

import json
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any

from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.db.models import Q, QuerySet
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from contracts.models import Contract, ContractProduct
from order_items.models import (
    FulfillmentStatus,
    OrderItem,
    OrderItemKind,
    OrderItemOfferSource,
    OrderItemStatus,
)
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
        data = json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValidationError(f"Invalid JSON body: {exc}") from exc

    if not isinstance(data, dict):
        raise ValidationError("JSON body must be an object.")

    return data


# ============================================================
# 🔹 Primitive Helpers
# ============================================================

def normalize_text(value: Any, default: str = "") -> str:
    if value is None:
        return default

    return str(value).strip()


def normalize_upper(value: Any, default: str = "") -> str:
    return normalize_text(value, default).upper()


def normalize_lower(value: Any, default: str = "") -> str:
    return normalize_text(value, default).lower()


def parse_bool(value: Any, default: bool | None = None) -> bool | None:
    if value in (None, ""):
        return default

    if isinstance(value, bool):
        return value

    if isinstance(value, (int, float)):
        return bool(value)

    value_str = str(value).strip().lower()

    if value_str in {"1", "true", "yes", "y", "on", "نعم", "صح"}:
        return True

    if value_str in {"0", "false", "no", "n", "off", "لا", "خطأ"}:
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
        return Decimal(str(value).strip()).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )
    except (InvalidOperation, AttributeError, TypeError, ValueError) as exc:
        raise ValidationError(f"Invalid decimal value: {value}") from exc


def money(value: Any, default: Decimal = Decimal("0.00")) -> Decimal:
    parsed = parse_decimal(value, default)

    if parsed is None:
        parsed = default

    if parsed < Decimal("0.00"):
        parsed = Decimal("0.00")

    return parsed.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def percent(value: Any, default: Decimal = Decimal("0.00")) -> Decimal:
    parsed = money(value, default)

    if parsed > Decimal("100.00"):
        return Decimal("100.00")

    return parsed


def parse_datetime_value(value: Any):
    if value in (None, ""):
        return None

    if hasattr(value, "isoformat"):
        return value

    parsed = parse_datetime(str(value))

    if parsed is None:
        raise ValidationError(f"Invalid datetime value: {value}")

    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())

    return parsed


def _first_non_empty(*values: Any) -> Any:
    for value in values:
        if value not in (None, "", [], {}, ()):
            return value

    return None


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
    q = normalize_text(params.get("q") or params.get("search"))
    item_kind = normalize_upper(params.get("item_kind") or params.get("kind"))
    status = normalize_upper(params.get("status"))
    fulfillment_status = normalize_upper(params.get("fulfillment_status"))
    offer_source = normalize_upper(params.get("offer_source"))
    product_type = normalize_text(params.get("product_type")).lower()

    order_id = parse_int(params.get("order_id"))
    product_id = parse_int(params.get("product_id"))
    provider_id = parse_int(params.get("provider_id"))
    contract_id = parse_int(params.get("contract_id"))
    contract_product_id = parse_int(
        _first_non_empty(
            params.get("contract_product_id"),
            params.get("offer_id"),
        )
    )
    service_item_id = parse_int(params.get("service_item_id"))

    requires_approval = parse_bool(params.get("requires_approval"), None)

    scheduled_from = normalize_text(params.get("scheduled_from"))
    scheduled_to = normalize_text(params.get("scheduled_to"))
    fulfilled_from = normalize_text(params.get("fulfilled_from"))
    fulfilled_to = normalize_text(params.get("fulfilled_to"))
    created_from = normalize_text(params.get("created_from") or params.get("date_from"))
    created_to = normalize_text(params.get("created_to") or params.get("date_to"))

    if q:
        queryset = queryset.filter(
            Q(title__icontains=q)
            | Q(code__icontains=q)
            | Q(fulfillment_reference__icontains=q)
            | Q(offer_title__icontains=q)
            | Q(offer_badge__icontains=q)
            | Q(offer_source__icontains=q)
            | Q(product_name__icontains=q)
            | Q(product_type__icontains=q)
            | Q(provider_name__icontains=q)
            | Q(contract_number__icontains=q)
            | Q(approval_notes__icontains=q)
            | Q(execution_notes__icontains=q)
            | Q(internal_notes__icontains=q)
            | Q(order__order_number__icontains=q)
            | Q(order__offer_title__icontains=q)
            | Q(order__offer_badge__icontains=q)
            | Q(order__customer__display_name__icontains=q)
            | Q(order__customer__full_name__icontains=q)
            | Q(order__customer__normalized_phone__icontains=q)
            | Q(product__name__icontains=q)
            | Q(product__code__icontains=q)
            | Q(provider__name__icontains=q)
            | Q(provider__display_name__icontains=q)
            | Q(provider__provider_name__icontains=q)
            | Q(provider__name_ar__icontains=q)
            | Q(provider__name_en__icontains=q)
            | Q(contract__title__icontains=q)
            | Q(contract__contract_number__icontains=q)
            | Q(contract_product__offer_title__icontains=q)
            | Q(contract_product__offer_subtitle__icontains=q)
            | Q(contract_product__offer_badge__icontains=q)
            | Q(contract_product__product__name__icontains=q)
            | Q(contract_product__product__code__icontains=q)
            | Q(contract_product__contract__contract_number__icontains=q)
            | Q(service_item__name__icontains=q)
            | Q(service_item__code__icontains=q)
        )

    if item_kind:
        queryset = queryset.filter(item_kind=item_kind)

    if offer_source:
        queryset = queryset.filter(offer_source=offer_source)

    if status:
        queryset = queryset.filter(status=status)

    if fulfillment_status:
        queryset = queryset.filter(fulfillment_status=fulfillment_status)

    if product_type:
        queryset = queryset.filter(product_type__iexact=product_type)

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

    if scheduled_from:
        queryset = queryset.filter(scheduled_at__gte=scheduled_from)

    if scheduled_to:
        queryset = queryset.filter(scheduled_at__lte=scheduled_to)

    if fulfilled_from:
        queryset = queryset.filter(fulfilled_at__gte=fulfilled_from)

    if fulfilled_to:
        queryset = queryset.filter(fulfilled_at__lte=fulfilled_to)

    if created_from:
        queryset = queryset.filter(created_at__date__gte=created_from)

    if created_to:
        queryset = queryset.filter(created_at__date__lte=created_to)

    return queryset.order_by("-created_at", "-id")


# ============================================================
# 🔹 Validation / Resolve Helpers
# ============================================================

def _validate_item_kind(value: str) -> str:
    allowed = {choice for choice, _ in OrderItemKind.choices}

    if value not in allowed:
        raise ValidationError(f"Invalid item_kind. Allowed values: {sorted(allowed)}")

    return value


def _validate_offer_source(value: str) -> str:
    allowed = {choice for choice, _ in OrderItemOfferSource.choices}

    if value not in allowed:
        raise ValidationError(f"Invalid offer_source. Allowed values: {sorted(allowed)}")

    return value


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
        return (
            Order.objects
            .select_related(
                "customer",
                "product",
                "provider",
                "contract",
                "contract_product",
                "contract_product__product",
                "contract_product__contract",
                "contract_product__contract__provider",
                "agent",
                "delivery_agent",
            )
            .get(pk=int(order_id))
        )
    except (Order.DoesNotExist, TypeError, ValueError) as exc:
        raise ValidationError("Selected order does not exist.") from exc


def _resolve_product(product_id: Any) -> Product:
    if product_id in (None, "", 0, "0"):
        raise ValidationError("Product is required.")

    try:
        return Product.objects.get(pk=int(product_id))
    except (Product.DoesNotExist, TypeError, ValueError) as exc:
        raise ValidationError("Selected product does not exist.") from exc


def _resolve_provider(provider_id: Any) -> Provider | None:
    if provider_id in (None, "", 0, "0"):
        return None

    try:
        return Provider.objects.get(pk=int(provider_id))
    except (Provider.DoesNotExist, TypeError, ValueError) as exc:
        raise ValidationError("Selected provider does not exist.") from exc


def _resolve_contract(contract_id: Any) -> Contract | None:
    if contract_id in (None, "", 0, "0"):
        return None

    try:
        return Contract.objects.select_related("provider").get(pk=int(contract_id))
    except (Contract.DoesNotExist, TypeError, ValueError) as exc:
        raise ValidationError("Selected contract does not exist.") from exc


def _resolve_contract_product(contract_product_id: Any) -> ContractProduct | None:
    if contract_product_id in (None, "", 0, "0"):
        return None

    try:
        return (
            ContractProduct.objects
            .select_related(
                "contract",
                "contract__provider",
                "product",
            )
            .get(pk=int(contract_product_id))
        )
    except (ContractProduct.DoesNotExist, TypeError, ValueError) as exc:
        raise ValidationError("Selected contract product does not exist.") from exc


def _resolve_contract_product_from_payload(payload: dict[str, Any]) -> ContractProduct | None:
    return _resolve_contract_product(
        _first_non_empty(
            payload.get("contract_product_id"),
            payload.get("contract_product"),
            payload.get("offer_id"),
            payload.get("offer"),
            payload.get("selected_offer_id"),
        )
    )


def _resolve_service_item(service_item_id: Any) -> ContractServiceItem | None:
    if service_item_id in (None, "", 0, "0"):
        return None

    try:
        return (
            ContractServiceItem.objects
            .select_related(
                "contract",
                "contract_product",
                "contract_product__product",
                "contract__provider",
            )
            .get(pk=int(service_item_id))
        )
    except (ContractServiceItem.DoesNotExist, TypeError, ValueError) as exc:
        raise ValidationError("Selected service item does not exist.") from exc


def _resolve_product_for_order(
    payload: dict[str, Any],
    order: Order,
    contract_product: ContractProduct | None = None,
) -> Product:
    if contract_product:
        return contract_product.product

    product_id = payload.get("product_id") or payload.get("product")

    if product_id not in (None, "", 0, "0"):
        return _resolve_product(product_id)

    if order.product_id:
        return order.product

    raise ValidationError("Product is required.")


def _resolve_item_kind_from_product(product: Product, payload: dict[str, Any]) -> str:
    explicit = normalize_upper(
        _first_non_empty(
            payload.get("item_kind"),
            payload.get("kind"),
            payload.get("order_item_kind"),
            "",
        )
    )

    if explicit:
        return _validate_item_kind(explicit)

    product_type = normalize_text(
        _first_non_empty(
            payload.get("product_type"),
            _safe_attr(product, "product_type"),
            _safe_attr(product, "type"),
            "",
        )
    ).lower()

    mapping = {
        "card": OrderItemKind.CARD,
        "cards": OrderItemKind.CARD,
        "membership": OrderItemKind.CARD,
        "membership_card": OrderItemKind.CARD,
        "program": OrderItemKind.PROGRAM,
        "programs": OrderItemKind.PROGRAM,
        "medical_program": OrderItemKind.PROGRAM,
        "service": OrderItemKind.SERVICE,
        "services": OrderItemKind.SERVICE,
        "medical_service": OrderItemKind.SERVICE,
        "subscription": OrderItemKind.SUBSCRIPTION,
        "subscriptions": OrderItemKind.SUBSCRIPTION,
        "plan": OrderItemKind.SUBSCRIPTION,
        "plans": OrderItemKind.SUBSCRIPTION,
    }

    return mapping.get(product_type, OrderItemKind.PRODUCT)


def _normalize_order_offer_source(value: Any) -> str:
    normalized = normalize_lower(value)

    if normalized == "contract_product":
        return OrderItemOfferSource.CONTRACT_PRODUCT

    if normalized == "product":
        return OrderItemOfferSource.PRODUCT

    if normalized == "manual":
        return OrderItemOfferSource.MANUAL

    return OrderItemOfferSource.NONE


def _resolve_offer_source(
    *,
    payload: dict[str, Any],
    order: Order,
    contract_product: ContractProduct | None,
) -> str:
    explicit = normalize_upper(payload.get("offer_source"))

    if explicit:
        return _validate_offer_source(explicit)

    if contract_product:
        return OrderItemOfferSource.CONTRACT_PRODUCT

    if getattr(order, "offer_source", None):
        return _normalize_order_offer_source(order.offer_source)

    return OrderItemOfferSource.NONE


def _validate_relations(
    *,
    order: Order,
    product: Product,
    provider: Provider | None,
    contract: Contract | None,
    contract_product: ContractProduct | None,
    service_item: ContractServiceItem | None,
) -> tuple[Provider | None, Contract | None, ContractProduct | None, ContractServiceItem | None]:
    if order.product_id and order.product_id != product.id:
        raise ValidationError("Order item product must match the parent order product.")

    if contract_product:
        if not contract:
            contract = contract_product.contract

        if contract_product.product_id and contract_product.product_id != product.id:
            raise ValidationError("Selected contract product does not match selected product.")

    if contract and not provider:
        provider = contract.provider

    if contract and provider and contract.provider_id != provider.id:
        raise ValidationError("Selected contract does not belong to the selected provider.")

    if contract_product and contract and contract_product.contract_id != contract.id:
        raise ValidationError("Selected contract product does not belong to the selected contract.")

    if contract_product and provider and contract_product.contract.provider_id != provider.id:
        raise ValidationError("Selected contract product belongs to a different provider.")

    if service_item:
        if not contract:
            contract = service_item.contract

        if not provider and service_item.contract:
            provider = service_item.contract.provider

        if not contract_product and getattr(service_item, "contract_product_id", None):
            contract_product = service_item.contract_product

        if contract and service_item.contract_id != contract.id:
            raise ValidationError("Selected service item does not belong to the selected contract.")

        if contract_product and service_item.contract_product_id and service_item.contract_product_id != contract_product.id:
            raise ValidationError("Selected service item does not belong to the selected contract product.")

        if provider and service_item.contract.provider_id != provider.id:
            raise ValidationError("Selected service item belongs to a different provider.")

    return provider, contract, contract_product, service_item


# ============================================================
# 🔹 Price Helpers
# ============================================================

def _resolve_default_price_before_discount(product: Product, contract_product=None, service_item=None) -> Decimal:
    if service_item and _safe_attr(service_item, "price_before_discount", default=None) is not None:
        return money(_safe_attr(service_item, "price_before_discount", default=Decimal("0.00")))

    if contract_product:
        return money(
            _first_non_empty(
                _safe_attr(contract_product, "effective_price_before_discount", default=None),
                _safe_attr(contract_product, "price_before_discount", default=None),
                _safe_attr(contract_product, "special_price", default=None),
                _safe_attr(product, "price_before_discount", default=None),
                _safe_attr(product, "price", default=None),
                Decimal("0.00"),
            )
        )

    return money(
        _first_non_empty(
            _safe_attr(product, "price_before_discount", default=None),
            _safe_attr(product, "price", default=None),
            Decimal("0.00"),
        )
    )


def _resolve_default_price_after_discount(product: Product, contract_product=None, service_item=None) -> Decimal:
    if service_item and _safe_attr(service_item, "special_price", default=None) is not None:
        return money(_safe_attr(service_item, "special_price", default=Decimal("0.00")))

    if contract_product:
        return money(
            _first_non_empty(
                _safe_attr(contract_product, "effective_price_after_discount", default=None),
                _safe_attr(contract_product, "price_after_discount", default=None),
                _safe_attr(contract_product, "special_price", default=None),
                _safe_attr(product, "price_after_discount", default=None),
                _safe_attr(product, "effective_price", default=None),
                _safe_attr(product, "sale_price", default=None),
                _safe_attr(product, "price", default=None),
                Decimal("0.00"),
            )
        )

    return money(
        _first_non_empty(
            _safe_attr(product, "price_after_discount", default=None),
            _safe_attr(product, "effective_price", default=None),
            _safe_attr(product, "sale_price", default=None),
            _safe_attr(product, "price", default=None),
            Decimal("0.00"),
        )
    )


def _resolve_default_discount_percentage(product: Product, contract_product=None, service_item=None) -> Decimal:
    if service_item and _safe_attr(service_item, "discount_percentage", default=None) is not None:
        return percent(_safe_attr(service_item, "discount_percentage", default=Decimal("0.00")))

    if contract_product and _safe_attr(contract_product, "discount_percentage", default=None) is not None:
        return percent(_safe_attr(contract_product, "discount_percentage", default=Decimal("0.00")))

    if _safe_attr(product, "discount_percentage", default=None) is not None:
        return percent(_safe_attr(product, "discount_percentage", default=Decimal("0.00")))

    return Decimal("0.00")


def _calculate_unit_price_after_discount(
    *,
    before: Decimal,
    discount_percentage: Decimal,
    discount_amount: Decimal,
) -> Decimal:
    percentage_discount_value = (before * discount_percentage) / Decimal("100.00")
    after = before - percentage_discount_value - discount_amount

    if after < Decimal("0.00"):
        return Decimal("0.00")

    return money(after)


def _sync_payload_defaults(
    *,
    payload: dict[str, Any],
    order: Order,
    product: Product,
    provider: Provider | None,
    contract: Contract | None,
    contract_product: ContractProduct | None,
    service_item: ContractServiceItem | None,
) -> dict[str, Any]:
    synced = dict(payload)

    synced.setdefault("item_kind", _resolve_item_kind_from_product(product, payload))

    offer_source = _resolve_offer_source(
        payload=payload,
        order=order,
        contract_product=contract_product,
    )
    synced.setdefault("offer_source", offer_source)

    if not normalize_text(synced.get("offer_title")):
        synced["offer_title"] = (
            _safe_attr(contract_product, "offer_title", default="")
            or _safe_attr(order, "offer_title", default="")
            or _safe_attr(service_item, "name", default="")
            or _safe_attr(product, "offer_title", "name", "title", default="")
            or ""
        )

    if not normalize_text(synced.get("offer_badge")):
        synced["offer_badge"] = (
            _safe_attr(contract_product, "offer_badge", default="")
            or _safe_attr(order, "offer_badge", default="")
            or ""
        )

    if not normalize_text(synced.get("title")):
        synced["title"] = (
            synced.get("offer_title")
            or _safe_attr(service_item, "name", default="")
            or _safe_attr(product, "name", "title", default="")
            or f"Product #{product.pk}"
        )

    synced.setdefault(
        "code",
        _safe_attr(service_item, "code", default="")
        or _safe_attr(product, "code", "sku", default=""),
    )

    synced.setdefault(
        "fulfillment_reference",
        _first_non_empty(
            payload.get("fulfillment_reference"),
            payload.get("reference"),
            payload.get("issue_reference"),
            "",
        ),
    )

    synced.setdefault("product_name", _safe_attr(product, "name", "title", default=""))
    synced.setdefault("product_type", _safe_attr(product, "product_type", "type", default=""))
    synced.setdefault(
        "provider_name",
        _safe_attr(provider, "name", "name_ar", "name_en", "display_name", "provider_name", default=""),
    )
    synced.setdefault(
        "contract_number",
        _safe_attr(contract, "contract_number", "number", default=""),
    )
    synced.setdefault(
        "currency_code",
        _safe_attr(product, "currency_code", "currency", default="SAR") or "SAR",
    )

    if synced.get("unit_price_before_discount") in (None, ""):
        synced["unit_price_before_discount"] = _resolve_default_price_before_discount(
            product,
            contract_product,
            service_item,
        )

    if synced.get("unit_discount_percentage") in (None, ""):
        synced["unit_discount_percentage"] = _resolve_default_discount_percentage(
            product,
            contract_product,
            service_item,
        )

    if synced.get("discount_percentage") in (None, ""):
        synced["discount_percentage"] = synced.get("unit_discount_percentage", Decimal("0.00"))

    if synced.get("discount_amount") in (None, ""):
        synced["discount_amount"] = Decimal("0.00")

    if synced.get("unit_price") in (None, ""):
        synced["unit_price"] = _resolve_default_price_after_discount(
            product,
            contract_product,
            service_item,
        )

    if synced.get("unit_price") in (None, "", Decimal("0.00"), "0.00"):
        synced["unit_price"] = _calculate_unit_price_after_discount(
            before=money(synced.get("unit_price_before_discount")),
            discount_percentage=percent(synced.get("unit_discount_percentage")),
            discount_amount=money(synced.get("discount_amount")),
        )

    if synced.get("requires_approval") in (None, ""):
        synced["requires_approval"] = bool(
            service_item and getattr(service_item, "requires_approval", False)
        )

    if service_item and getattr(service_item, "requires_approval", False):
        synced["requires_approval"] = True

    return synced


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
            "fulfillment_status": obj.order.fulfillment_status,
            "customer_id": obj.order.customer_id,
            "customer_name": _safe_attr(obj.order.customer, "display_name", "full_name", "name"),
            "offer_id": getattr(obj.order, "contract_product_id", None),
            "offer_title": _safe_attr(obj.order, "offer_title"),
            "offer_badge": _safe_attr(obj.order, "offer_badge"),
        } if obj.order_id else None,

        "product_id": obj.product_id,
        "product": {
            "id": obj.product.id,
            "name": _safe_attr(obj.product, "name"),
            "code": _safe_attr(obj.product, "code"),
            "product_type": _safe_attr(obj.product, "product_type"),
            "status": _safe_attr(obj.product, "status"),
        } if obj.product_id else None,

        "provider_id": obj.provider_id,
        "provider": {
            "id": obj.provider.id,
            "name": _safe_attr(obj.provider, "name", "name_ar", "name_en", "display_name", "provider_name"),
            "code": _safe_attr(obj.provider, "code", "provider_code"),
            "provider_type": _safe_attr(obj.provider, "provider_type"),
            "status": _safe_attr(obj.provider, "status"),
        } if obj.provider_id else None,

        "contract_id": obj.contract_id,
        "contract": {
            "id": obj.contract.id,
            "title": _safe_attr(obj.contract, "title", "name"),
            "contract_number": _safe_attr(obj.contract, "contract_number", "number"),
            "status": _safe_attr(obj.contract, "status"),
        } if obj.contract_id else None,

        "contract_product_id": obj.contract_product_id,
        "offer_id": obj.contract_product_id,
        "contract_product": {
            "id": obj.contract_product.id,
            "offer_id": obj.contract_product.id,
            "product_id": obj.contract_product.product_id,
            "product_name": obj.contract_product.product.name if obj.contract_product.product_id else None,
            "contract_id": obj.contract_product.contract_id,
            "provider_id": obj.contract_product.contract.provider_id if obj.contract_product.contract_id else None,
            "offer_title": _safe_attr(obj.contract_product, "offer_title"),
            "offer_subtitle": _safe_attr(obj.contract_product, "offer_subtitle"),
            "offer_badge": _safe_attr(obj.contract_product, "offer_badge"),
            "offer_description": _safe_attr(obj.contract_product, "offer_description"),
            "is_active": bool(_safe_attr(obj.contract_product, "is_active", default=False)),
            "is_featured": bool(_safe_attr(obj.contract_product, "is_featured", default=False)),
            "show_on_landing": bool(_safe_attr(obj.contract_product, "show_on_landing", default=False)),
            "show_on_mobile": bool(_safe_attr(obj.contract_product, "show_on_mobile", default=False)),
            "show_on_offers": bool(_safe_attr(obj.contract_product, "show_on_offers", default=False)),
            "price_before_discount": str(
                money(
                    _safe_attr(
                        obj.contract_product,
                        "effective_price_before_discount",
                        "price_before_discount",
                        default=Decimal("0.00"),
                    )
                )
            ),
            "price_after_discount": str(
                money(
                    _safe_attr(
                        obj.contract_product,
                        "effective_price_after_discount",
                        "price_after_discount",
                        "special_price",
                        default=Decimal("0.00"),
                    )
                )
            ),
            "special_price": (
                str(obj.contract_product.special_price)
                if getattr(obj.contract_product, "special_price", None) is not None
                else None
            ),
            "discount_percentage": str(
                percent(
                    _safe_attr(
                        obj.contract_product,
                        "discount_percentage",
                        default=Decimal("0.00"),
                    )
                )
            ),
        } if obj.contract_product_id else None,

        "service_item_id": obj.service_item_id,
        "service_item": {
            "id": obj.service_item.id,
            "name": _safe_attr(obj.service_item, "name"),
            "code": _safe_attr(obj.service_item, "code"),
            "status": _safe_attr(obj.service_item, "status"),
            "coverage_type": _safe_attr(obj.service_item, "coverage_type"),
            "requires_approval": bool(_safe_attr(obj.service_item, "requires_approval", default=False)),
            "special_price": (
                str(obj.service_item.special_price)
                if getattr(obj.service_item, "special_price", None) is not None
                else None
            ),
            "discount_percentage": str(_safe_attr(obj.service_item, "discount_percentage", default=Decimal("0.00"))),
        } if obj.service_item_id else None,

        "item_kind": obj.item_kind,
        "title": obj.title,
        "code": obj.code,
        "fulfillment_reference": obj.fulfillment_reference,

        "status": obj.status,
        "fulfillment_status": obj.fulfillment_status,

        "product_name": obj.product_name,
        "product_type": obj.product_type,
        "provider_name": obj.provider_name,
        "contract_number": obj.contract_number,
        "currency_code": obj.currency_code,

        "offer_source": obj.offer_source,
        "offer_title": obj.offer_title,
        "offer_badge": obj.offer_badge,
        "has_offer": obj.has_offer,

        "quantity": obj.quantity,
        "unit_price_before_discount": str(obj.unit_price_before_discount),
        "unit_discount_percentage": str(obj.unit_discount_percentage),
        "unit_price": str(obj.unit_price),
        "discount_percentage": str(obj.discount_percentage),
        "discount_amount": str(obj.discount_amount),
        "net_unit_price": str(obj.net_unit_price),
        "total_amount": str(obj.total_amount),
        "line_total_before_discount": str(obj.line_total_before_discount),
        "line_total_after_discount": str(obj.line_total_after_discount),

        "requires_approval": obj.requires_approval,
        "approval_notes": obj.approval_notes,
        "execution_notes": obj.execution_notes,
        "internal_notes": obj.internal_notes,

        "scheduled_at": obj.scheduled_at.isoformat() if obj.scheduled_at else None,
        "approval_requested_at": obj.approval_requested_at.isoformat() if obj.approval_requested_at else None,
        "approved_at": obj.approved_at.isoformat() if obj.approved_at else None,
        "rejected_at": obj.rejected_at.isoformat() if obj.rejected_at else None,
        "started_at": obj.started_at.isoformat() if obj.started_at else None,
        "fulfilled_at": obj.fulfilled_at.isoformat() if obj.fulfilled_at else None,
        "cancelled_at": obj.cancelled_at.isoformat() if obj.cancelled_at else None,

        "is_completed": obj.is_completed,
        "is_cancelled": obj.is_cancelled,
        "is_fulfilled": obj.is_fulfilled,
        "is_rejected": obj.is_rejected,
        "needs_approval": obj.needs_approval,

        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
    }


# ============================================================
# 🔹 Create / Update
# ============================================================

def create_order_item(*, payload: dict[str, Any]) -> OrderItem:
    order = _resolve_order(payload.get("order_id") or payload.get("order"))
    contract_product = _resolve_contract_product_from_payload(payload)
    product = _resolve_product_for_order(payload, order, contract_product=contract_product)
    provider = _resolve_provider(payload.get("provider_id") or payload.get("provider"))
    contract = _resolve_contract(payload.get("contract_id") or payload.get("contract"))
    service_item = _resolve_service_item(payload.get("service_item_id") or payload.get("service_item"))

    if not contract_product and getattr(order, "contract_product_id", None):
        contract_product = order.contract_product

    provider, contract, contract_product, service_item = _validate_relations(
        order=order,
        product=product,
        provider=provider,
        contract=contract,
        contract_product=contract_product,
        service_item=service_item,
    )

    synced_payload = _sync_payload_defaults(
        payload=payload,
        order=order,
        product=product,
        provider=provider,
        contract=contract,
        contract_product=contract_product,
        service_item=service_item,
    )

    status = normalize_upper(synced_payload.get("status")) or OrderItemStatus.PENDING
    fulfillment_status = normalize_upper(synced_payload.get("fulfillment_status")) or FulfillmentStatus.NOT_STARTED
    item_kind = normalize_upper(synced_payload.get("item_kind")) or OrderItemKind.PRODUCT
    offer_source = normalize_upper(synced_payload.get("offer_source")) or OrderItemOfferSource.NONE

    item = OrderItem(
        order=order,
        product=product,
        provider=provider,
        contract=contract,
        contract_product=contract_product,
        service_item=service_item,

        item_kind=_validate_item_kind(item_kind),
        title=normalize_text(synced_payload.get("title")),
        code=normalize_text(synced_payload.get("code")),
        fulfillment_reference=normalize_text(synced_payload.get("fulfillment_reference")),

        status=_validate_status(status),
        fulfillment_status=_validate_fulfillment_status(fulfillment_status),

        product_name=normalize_text(synced_payload.get("product_name")),
        product_type=normalize_text(synced_payload.get("product_type")),
        provider_name=normalize_text(synced_payload.get("provider_name")),
        contract_number=normalize_text(synced_payload.get("contract_number")),
        currency_code=normalize_upper(synced_payload.get("currency_code"), "SAR"),

        offer_source=_validate_offer_source(offer_source),
        offer_title=normalize_text(synced_payload.get("offer_title")),
        offer_badge=normalize_text(synced_payload.get("offer_badge")),

        quantity=parse_int(synced_payload.get("quantity"), 1) or 1,
        unit_price_before_discount=money(synced_payload.get("unit_price_before_discount")),
        unit_discount_percentage=percent(synced_payload.get("unit_discount_percentage")),
        unit_price=money(synced_payload.get("unit_price")),
        discount_percentage=percent(synced_payload.get("discount_percentage")),
        discount_amount=money(synced_payload.get("discount_amount")),

        requires_approval=bool(parse_bool(synced_payload.get("requires_approval"), False)),
        approval_notes=normalize_text(synced_payload.get("approval_notes")),
        execution_notes=normalize_text(synced_payload.get("execution_notes")),
        internal_notes=normalize_text(synced_payload.get("internal_notes")),

        scheduled_at=parse_datetime_value(synced_payload.get("scheduled_at")),
        approval_requested_at=parse_datetime_value(synced_payload.get("approval_requested_at")),
        approved_at=parse_datetime_value(synced_payload.get("approved_at")),
        rejected_at=parse_datetime_value(synced_payload.get("rejected_at")),
        started_at=parse_datetime_value(synced_payload.get("started_at")),
        fulfilled_at=parse_datetime_value(synced_payload.get("fulfilled_at")),
        cancelled_at=parse_datetime_value(synced_payload.get("cancelled_at")),
    )

    item.save()
    return item


def update_order_item(*, instance: OrderItem, payload: dict[str, Any]) -> OrderItem:
    order = instance.order
    product = instance.product
    provider = instance.provider
    contract = instance.contract
    contract_product = instance.contract_product
    service_item = instance.service_item

    if "order_id" in payload or "order" in payload:
        order = _resolve_order(payload.get("order_id") or payload.get("order"))

    if any(key in payload for key in ("contract_product_id", "contract_product", "offer_id", "offer", "selected_offer_id")):
        contract_product = _resolve_contract_product_from_payload(payload)

    if "product_id" in payload or "product" in payload or contract_product:
        product = _resolve_product_for_order(
            payload,
            order,
            contract_product=contract_product,
        )

    if "provider_id" in payload or "provider" in payload:
        provider = _resolve_provider(payload.get("provider_id") or payload.get("provider"))

    if "contract_id" in payload or "contract" in payload:
        contract = _resolve_contract(payload.get("contract_id") or payload.get("contract"))

    if "service_item_id" in payload or "service_item" in payload:
        service_item = _resolve_service_item(payload.get("service_item_id") or payload.get("service_item"))

    provider, contract, contract_product, service_item = _validate_relations(
        order=order,
        product=product,
        provider=provider,
        contract=contract,
        contract_product=contract_product,
        service_item=service_item,
    )

    synced_payload = _sync_payload_defaults(
        payload=payload,
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

    if any(key in payload for key in ("item_kind", "kind", "order_item_kind")):
        instance.item_kind = _validate_item_kind(normalize_upper(synced_payload.get("item_kind")))

    if "title" in payload:
        instance.title = normalize_text(synced_payload.get("title"))

    if "code" in payload:
        instance.code = normalize_text(synced_payload.get("code"))

    if any(key in payload for key in ("fulfillment_reference", "reference", "issue_reference")):
        instance.fulfillment_reference = normalize_text(synced_payload.get("fulfillment_reference"))

    if "status" in payload:
        instance.status = _validate_status(normalize_upper(payload.get("status")))

    if "fulfillment_status" in payload:
        instance.fulfillment_status = _validate_fulfillment_status(
            normalize_upper(payload.get("fulfillment_status"))
        )

    if "product_name" in payload:
        instance.product_name = normalize_text(payload.get("product_name"))

    if "product_type" in payload:
        instance.product_type = normalize_text(payload.get("product_type"))

    if "provider_name" in payload:
        instance.provider_name = normalize_text(payload.get("provider_name"))

    if "contract_number" in payload:
        instance.contract_number = normalize_text(payload.get("contract_number"))

    if "currency_code" in payload or "currency" in payload:
        instance.currency_code = normalize_upper(payload.get("currency_code") or payload.get("currency"), "SAR")

    if "offer_source" in payload:
        instance.offer_source = _validate_offer_source(normalize_upper(payload.get("offer_source")))

    if "offer_title" in payload:
        instance.offer_title = normalize_text(payload.get("offer_title"))

    if "offer_badge" in payload:
        instance.offer_badge = normalize_text(payload.get("offer_badge"))

    if "quantity" in payload:
        instance.quantity = parse_int(payload.get("quantity"), 1) or 1

    if "unit_price_before_discount" in payload:
        instance.unit_price_before_discount = money(payload.get("unit_price_before_discount"))

    if "unit_discount_percentage" in payload:
        instance.unit_discount_percentage = percent(payload.get("unit_discount_percentage"))

    if "unit_price" in payload:
        instance.unit_price = money(payload.get("unit_price"))

    if "discount_percentage" in payload:
        instance.discount_percentage = percent(payload.get("discount_percentage"))

    if "discount_amount" in payload:
        instance.discount_amount = money(payload.get("discount_amount"))

    if "requires_approval" in payload:
        instance.requires_approval = bool(parse_bool(payload.get("requires_approval"), instance.requires_approval))

    if service_item and getattr(service_item, "requires_approval", False):
        instance.requires_approval = True

    if "approval_notes" in payload:
        instance.approval_notes = normalize_text(payload.get("approval_notes"))

    if "execution_notes" in payload:
        instance.execution_notes = normalize_text(payload.get("execution_notes"))

    if "internal_notes" in payload:
        instance.internal_notes = normalize_text(payload.get("internal_notes"))

    if "scheduled_at" in payload:
        instance.scheduled_at = parse_datetime_value(payload.get("scheduled_at"))

    if "approval_requested_at" in payload:
        instance.approval_requested_at = parse_datetime_value(payload.get("approval_requested_at"))

    if "approved_at" in payload:
        instance.approved_at = parse_datetime_value(payload.get("approved_at"))

    if "rejected_at" in payload:
        instance.rejected_at = parse_datetime_value(payload.get("rejected_at"))

    if "started_at" in payload:
        instance.started_at = parse_datetime_value(payload.get("started_at"))

    if "fulfilled_at" in payload:
        instance.fulfilled_at = parse_datetime_value(payload.get("fulfilled_at"))

    if "cancelled_at" in payload:
        instance.cancelled_at = parse_datetime_value(payload.get("cancelled_at"))

    if not instance.title:
        instance.title = (
            instance.offer_title
            or _safe_attr(service_item, "name", default="")
            or _safe_attr(product, "name", "title", default="")
            or f"Product #{product.pk}"
        )

    instance.status = _validate_status(instance.status)
    instance.fulfillment_status = _validate_fulfillment_status(instance.fulfillment_status)
    instance.item_kind = _validate_item_kind(instance.item_kind)
    instance.offer_source = _validate_offer_source(instance.offer_source)

    item_kind_was_explicit = any(key in payload for key in ("item_kind", "kind", "order_item_kind"))
    if not item_kind_was_explicit:
        instance.item_kind = _resolve_item_kind_from_product(product, payload)

    if not any(key in payload for key in ("offer_source",)):
        instance.offer_source = _resolve_offer_source(
            payload=payload,
            order=order,
            contract_product=contract_product,
        )

    instance.save()
    return instance