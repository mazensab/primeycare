# ============================================================
# 📂 products/services.py
# 🧭 Primey Care — Products Catalog Services V2.7
# ------------------------------------------------------------
# ✅ خدمات مساعدة رسمية لموديول المنتجات
# ✅ Serialization
# ✅ Validation helpers
# ✅ Filters / pagination
# ✅ Nested benefits / pricing tiers / service items sync
# ✅ Landing / Mobile / Offers marketing fields للمنتجات العامة
# ✅ Catalog payload / checkout payload
# ✅ Provider offers hints through /api/offers/
# ------------------------------------------------------------
# القاعدة المعتمدة:
# - Product = كتالوج ثابت.
# - Product لا يرتبط بمقدم الخدمة في التطوير الجديد.
# - Provider-specific prices/offers تكون داخل contracts.ContractProduct.
# - /api/offers/ هو مصدر عروض مقدمي الخدمة المبنية على ContractProduct.
# - provider داخل Product توافق قديم فقط.
# ============================================================

from __future__ import annotations

import json
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any

from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import Q, QuerySet
from django.utils import timezone

from products.models import (
    Product,
    ProductBenefit,
    ProductCategory,
    ProductPricingTier,
    ProductServiceItem,
)
from providers.models import Provider


# ============================================================
# 🔹 JSON / Parsing Helpers
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


def parse_bool(value: Any, default: bool | None = None) -> bool | None:
    if value is None:
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
        return Decimal(str(value).strip())
    except (InvalidOperation, AttributeError, TypeError, ValueError) as exc:
        raise ValidationError(f"Invalid decimal value: {value}") from exc


def normalize_text(value: Any, default: str = "") -> str:
    if value is None:
        return default

    value_str = str(value).strip()

    if value_str.lower() in {"none", "null", "nan"}:
        return default

    return value_str


def normalize_choice(value: Any, default: str) -> str:
    value_text = normalize_text(value)

    if not value_text:
        return default

    return value_text


def _money(value: Any, default: Decimal | None = None) -> Decimal:
    if default is None:
        default = Decimal("0.00")

    if value in (None, ""):
        parsed = default
    else:
        try:
            parsed = Decimal(str(value))
        except Exception:
            parsed = default

    if parsed < Decimal("0.00"):
        parsed = Decimal("0.00")

    return parsed.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _percent(value: Any, default: Decimal | None = None) -> Decimal:
    if default is None:
        default = Decimal("0.00")

    if value in (None, ""):
        parsed = default
    else:
        try:
            parsed = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        except Exception:
            parsed = default.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    if parsed < Decimal("0.00"):
        return Decimal("0.00")

    if parsed > Decimal("100.00"):
        return Decimal("100.00")

    return parsed


def _decimal_to_str(value: Any) -> str:
    return str(_money(value))


def _percent_to_str(value: Any) -> str:
    return str(_percent(value))


def _iso_date(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return str(value)


def _safe_int(value: Any) -> int:
    try:
        return int(value or 0)
    except Exception:
        return 0


def _max_decimal(*values: Any) -> Decimal:
    parsed_values = [_percent(value) for value in values]
    return max(parsed_values) if parsed_values else Decimal("0.00")


# ============================================================
# 🔹 Query Helpers
# ============================================================

def paginate_queryset(
    queryset: QuerySet,
    page: int = 1,
    page_size: int = 20,
) -> dict[str, Any]:
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


def _current_date_q() -> Q:
    today = timezone.localdate()

    return (
        Q(has_expiry=False)
        | (
            Q(has_expiry=True)
            & (
                Q(valid_from__isnull=True)
                | Q(valid_from__lte=today)
            )
            & (
                Q(valid_until__isnull=True)
                | Q(valid_until__gte=today)
            )
        )
    )


def _current_offer_q() -> Q:
    today = timezone.localdate()

    return (
        Q(status=Product.Status.ACTIVE)
        & Q(is_offer=True)
        & (
            Q(offer_start_date__isnull=True)
            | Q(offer_start_date__lte=today)
        )
        & (
            Q(offer_end_date__isnull=True)
            | Q(offer_end_date__gte=today)
        )
    )


def _active_contract_product_filter() -> Q:
    """
    يستخدم فقط كمؤشر وجود عروض نشطة للمنتج داخل العقود.
    لا يستخدم لدمج سعر مقدم الخدمة داخل serialize_product.

    تفاصيل العروض الفعلية تأتي من:
    /api/offers/
    """

    today = timezone.localdate()

    return (
        Q(product_contracts__is_active=True)
        & Q(product_contracts__contract__status="ACTIVE")
        & (
            Q(product_contracts__contract__start_date__isnull=True)
            | Q(product_contracts__contract__start_date__lte=today)
        )
        & (
            Q(product_contracts__contract__end_date__isnull=True)
            | Q(product_contracts__contract__end_date__gte=today)
        )
        & (
            Q(product_contracts__offer_start_date__isnull=True)
            | Q(product_contracts__offer_start_date__lte=today)
        )
        & (
            Q(product_contracts__offer_end_date__isnull=True)
            | Q(product_contracts__offer_end_date__gte=today)
        )
    )


def apply_product_filters(
    queryset: QuerySet[Product],
    params,
) -> QuerySet[Product]:
    q = normalize_text(params.get("q") or params.get("search"))
    status_value = normalize_text(params.get("status"))
    product_type = normalize_text(params.get("product_type") or params.get("type"))
    billing_type = normalize_text(params.get("billing_type"))
    fulfillment_type = normalize_text(params.get("fulfillment_type"))

    category_id = parse_int(params.get("category_id"))
    provider_id = parse_int(params.get("provider_id"))

    is_active = parse_bool(params.get("is_active"))
    is_public = parse_bool(params.get("is_public"))
    is_featured = parse_bool(params.get("is_featured"))
    is_offer = parse_bool(params.get("is_offer"))
    current_offer = parse_bool(params.get("current_offer"))

    show_on_landing = parse_bool(
        params.get("show_on_landing"),
        parse_bool(params.get("show_in_landing")),
    )
    show_on_mobile = parse_bool(params.get("show_on_mobile"))
    show_on_offers = parse_bool(
        params.get("show_on_offers"),
        parse_bool(params.get("show_in_offers")),
    )

    allow_online_purchase = parse_bool(params.get("allow_online_purchase"))
    allow_agent_sale = parse_bool(params.get("allow_agent_sale"))
    allow_provider_sale = parse_bool(params.get("allow_provider_sale"))
    can_be_ordered = parse_bool(params.get("can_be_ordered"))
    can_be_used_in_contracts = parse_bool(params.get("can_be_used_in_contracts"))
    requires_provider = parse_bool(params.get("requires_provider"))
    is_taxable = parse_bool(params.get("is_taxable"))

    has_thumbnail_image = parse_bool(params.get("has_thumbnail_image"))
    has_marketing_image = parse_bool(params.get("has_marketing_image"))
    has_active_contract = parse_bool(params.get("has_active_contract"))
    has_active_contracts = parse_bool(params.get("has_active_contracts"))
    has_provider_offers = parse_bool(params.get("has_provider_offers"))
    has_contract_offers = parse_bool(params.get("has_contract_offers"))
    has_orders = parse_bool(params.get("has_orders"))

    has_duration = parse_bool(params.get("has_duration"))
    has_expiry = parse_bool(params.get("has_expiry"))
    is_catalog = parse_bool(params.get("is_catalog") or params.get("catalog"))
    is_legacy_provider_product = parse_bool(
        params.get("is_legacy_provider_product")
        or params.get("legacy_provider")
    )
    available_for_order = parse_bool(params.get("available_for_order"))
    valid_now = parse_bool(params.get("valid_now"))

    checkout_source = normalize_text(params.get("checkout_source")).lower()

    min_price = parse_decimal(params.get("min_price"))
    max_price = parse_decimal(params.get("max_price"))
    min_discount = parse_decimal(params.get("min_discount"))
    max_discount = parse_decimal(params.get("max_discount"))

    valid_from = normalize_text(params.get("valid_from"))
    valid_until = normalize_text(params.get("valid_until"))

    if q:
        queryset = queryset.filter(
            Q(name__icontains=q)
            | Q(code__icontains=q)
            | Q(slug__icontains=q)
            | Q(short_description__icontains=q)
            | Q(description__icontains=q)
            | Q(features__icontains=q)
            | Q(terms_and_conditions__icontains=q)
            | Q(tags__icontains=q)
            | Q(offer_title__icontains=q)
            | Q(offer_subtitle__icontains=q)
            | Q(offer_badge__icontains=q)
            | Q(offer_terms__icontains=q)
            | Q(category__name__icontains=q)
            | Q(category__code__icontains=q)
            | Q(provider__name__icontains=q)
            | Q(provider__name_ar__icontains=q)
            | Q(provider__name_en__icontains=q)
            | Q(provider__code__icontains=q)
        )

    if is_active is True:
        queryset = queryset.filter(status=Product.Status.ACTIVE)

    if is_active is False:
        queryset = queryset.exclude(status=Product.Status.ACTIVE)

    if status_value:
        queryset = queryset.filter(status=status_value)

    if product_type:
        queryset = queryset.filter(product_type=product_type)

    if billing_type:
        queryset = queryset.filter(billing_type=billing_type)

    if fulfillment_type:
        queryset = queryset.filter(fulfillment_type=fulfillment_type)

    if category_id:
        queryset = queryset.filter(category_id=category_id)

    # توافق قديم فقط. التطوير الجديد لا يعتمد provider_id داخل Product.
    if provider_id:
        queryset = queryset.filter(provider_id=provider_id)

    if is_public is not None:
        queryset = queryset.filter(is_public=is_public)

    if is_featured is not None:
        queryset = queryset.filter(is_featured=is_featured)

    if is_offer is not None:
        queryset = queryset.filter(is_offer=is_offer)

    if show_on_landing is not None:
        queryset = queryset.filter(show_on_landing=show_on_landing)

    if show_on_mobile is not None:
        queryset = queryset.filter(show_on_mobile=show_on_mobile)

    if show_on_offers is not None:
        queryset = queryset.filter(show_on_offers=show_on_offers)

    if allow_online_purchase is not None:
        queryset = queryset.filter(allow_online_purchase=allow_online_purchase)

    if allow_agent_sale is not None:
        queryset = queryset.filter(allow_agent_sale=allow_agent_sale)

    if allow_provider_sale is not None:
        queryset = queryset.filter(allow_provider_sale=allow_provider_sale)

    if can_be_ordered is not None:
        queryset = queryset.filter(can_be_ordered=can_be_ordered)

    if can_be_used_in_contracts is not None:
        queryset = queryset.filter(can_be_used_in_contracts=can_be_used_in_contracts)

    if requires_provider is not None:
        queryset = queryset.filter(requires_provider=requires_provider)

    if is_taxable is not None:
        queryset = queryset.filter(is_taxable=is_taxable)

    if has_duration is not None:
        queryset = queryset.filter(has_duration=has_duration)

    if has_expiry is not None:
        queryset = queryset.filter(has_expiry=has_expiry)

    if is_catalog is True:
        queryset = queryset.filter(provider__isnull=True)

    if is_catalog is False:
        queryset = queryset.filter(provider__isnull=False)

    if is_legacy_provider_product is True:
        queryset = queryset.filter(provider__isnull=False)

    if is_legacy_provider_product is False:
        queryset = queryset.filter(provider__isnull=True)

    if available_for_order is True:
        queryset = queryset.filter(
            status=Product.Status.ACTIVE,
            can_be_ordered=True,
        ).filter(_current_date_q())

    if available_for_order is False:
        queryset = queryset.exclude(
            status=Product.Status.ACTIVE,
            can_be_ordered=True,
        )

    if valid_now is True:
        queryset = queryset.filter(_current_date_q())

    if valid_now is False:
        queryset = queryset.filter(has_expiry=True).exclude(_current_date_q())

    if valid_from:
        queryset = queryset.filter(
            Q(valid_from__isnull=True)
            | Q(valid_from__gte=valid_from)
        )

    if valid_until:
        queryset = queryset.filter(
            Q(valid_until__isnull=True)
            | Q(valid_until__lte=valid_until)
        )

    if has_thumbnail_image is True:
        queryset = queryset.filter(
            Q(thumbnail_image_url__isnull=False, thumbnail_image_url__gt="")
            | Q(thumbnail_image_drive_file_id__isnull=False, thumbnail_image_drive_file_id__gt="")
        )

    if has_thumbnail_image is False:
        queryset = queryset.exclude(
            Q(thumbnail_image_url__isnull=False, thumbnail_image_url__gt="")
            | Q(thumbnail_image_drive_file_id__isnull=False, thumbnail_image_drive_file_id__gt="")
        )

    if has_marketing_image is True:
        queryset = queryset.filter(
            Q(marketing_image_url__isnull=False, marketing_image_url__gt="")
            | Q(marketing_image_drive_file_id__isnull=False, marketing_image_drive_file_id__gt="")
        )

    if has_marketing_image is False:
        queryset = queryset.exclude(
            Q(marketing_image_url__isnull=False, marketing_image_url__gt="")
            | Q(marketing_image_drive_file_id__isnull=False, marketing_image_drive_file_id__gt="")
        )

    if (
        has_active_contract is True
        or has_active_contracts is True
        or has_provider_offers is True
        or has_contract_offers is True
    ):
        queryset = queryset.filter(_active_contract_product_filter())

    if (
        has_active_contract is False
        or has_active_contracts is False
        or has_provider_offers is False
        or has_contract_offers is False
    ):
        queryset = queryset.exclude(_active_contract_product_filter())

    if has_orders is True:
        queryset = queryset.filter(orders__isnull=False)

    if has_orders is False:
        queryset = queryset.filter(orders__isnull=True)

    if checkout_source == "offers":
        queryset = queryset.filter(requires_provider=True)

    if checkout_source == "product":
        queryset = queryset.filter(requires_provider=False)

    if current_offer is True:
        queryset = queryset.filter(_current_offer_q())

    if current_offer is False:
        queryset = queryset.exclude(_current_offer_q())

    if min_price is not None:
        queryset = queryset.filter(price__gte=min_price)

    if max_price is not None:
        queryset = queryset.filter(price__lte=max_price)

    if min_discount is not None:
        queryset = queryset.filter(discount_percentage__gte=min_discount)

    if max_discount is not None:
        queryset = queryset.filter(discount_percentage__lte=max_discount)

    ordering = normalize_text(params.get("ordering") or params.get("order_by"))

    allowed_ordering = {
        "name": "name",
        "-name": "-name",
        "price": "price",
        "-price": "-price",
        "sale_price": "sale_price",
        "-sale_price": "-sale_price",
        "discount_percentage": "discount_percentage",
        "-discount_percentage": "-discount_percentage",
        "duration_value": "duration_value",
        "-duration_value": "-duration_value",
        "valid_from": "valid_from",
        "-valid_from": "-valid_from",
        "valid_until": "valid_until",
        "-valid_until": "-valid_until",
        "created_at": "created_at",
        "-created_at": "-created_at",
        "updated_at": "updated_at",
        "-updated_at": "-updated_at",
        "sort_order": "sort_order",
        "-sort_order": "-sort_order",
        "offer_start_date": "offer_start_date",
        "-offer_start_date": "-offer_start_date",
        "offer_end_date": "offer_end_date",
        "-offer_end_date": "-offer_end_date",
        "active_contracts_count": "active_contracts_count",
        "-active_contracts_count": "-active_contracts_count",
        "contracted_products_count": "contracted_products_count",
        "-contracted_products_count": "-contracted_products_count",
        "orders_count": "orders_count",
        "-orders_count": "-orders_count",
    }

    if ordering in allowed_ordering:
        queryset = queryset.order_by(allowed_ordering[ordering], "-id")

    return queryset.distinct()


def apply_category_filters(
    queryset: QuerySet[ProductCategory],
    params,
) -> QuerySet[ProductCategory]:
    q = normalize_text(params.get("q") or params.get("search"))
    status_value = normalize_text(params.get("status"))
    category_type = normalize_text(params.get("category_type"))

    if q:
        queryset = queryset.filter(
            Q(name__icontains=q)
            | Q(code__icontains=q)
            | Q(description__icontains=q)
        )

    if status_value:
        queryset = queryset.filter(status=status_value)

    if category_type:
        queryset = queryset.filter(category_type=category_type)

    return queryset


# ============================================================
# 🔹 Serialization
# ============================================================

def serialize_category(obj: ProductCategory) -> dict[str, Any]:
    return {
        "id": obj.id,
        "code": obj.code,
        "name": obj.name,
        "category_type": obj.category_type,
        "status": obj.status,
        "description": obj.description,
        "sort_order": obj.sort_order,
        "products_count": getattr(obj, "products_count", None),
        "created_by_id": obj.created_by_id,
        "updated_by_id": obj.updated_by_id,
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
    }


def serialize_provider_for_product(provider: Provider | None) -> dict[str, Any] | None:
    """
    Legacy provider serializer.
    يستخدم فقط للتوافق مع منتجات قديمة كان لديها provider مباشر.
    """

    if not provider:
        return None

    return {
        "id": provider.id,
        "code": getattr(provider, "code", ""),
        "name": getattr(provider, "name", ""),
        "name_ar": getattr(provider, "name_ar", ""),
        "name_en": getattr(provider, "name_en", ""),
        "display_name_ar": getattr(provider, "display_name_ar", "") or getattr(provider, "name_ar", "") or getattr(provider, "name", ""),
        "display_name_en": getattr(provider, "display_name_en", "") or getattr(provider, "name_en", "") or getattr(provider, "name", ""),
        "provider_type": getattr(provider, "provider_type", ""),
        "status": getattr(provider, "status", ""),
        "city": getattr(provider, "city", ""),
        "region": getattr(provider, "region", ""),
        "area": getattr(provider, "area", ""),
        "source_category": getattr(provider, "source_category", ""),
        "logo_url": getattr(provider, "logo_url", ""),
        "image_url": getattr(provider, "image_url", ""),
        "drive_folder_id": getattr(provider, "drive_folder_id", ""),
        "drive_folder_url": getattr(provider, "drive_folder_url", ""),
        "is_featured": getattr(provider, "is_featured", False),
    }


def serialize_benefit(obj: ProductBenefit) -> dict[str, Any]:
    return {
        "id": obj.id,
        "product_id": obj.product_id,
        "title": obj.title,
        "description": obj.description,
        "sort_order": obj.sort_order,
        "is_active": obj.is_active,
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
    }


def serialize_pricing_tier(obj: ProductPricingTier) -> dict[str, Any]:
    return {
        "id": obj.id,
        "product_id": obj.product_id,
        "name": obj.name,
        "pricing_type": obj.pricing_type,
        "currency_code": obj.currency_code,
        "price": str(obj.price),
        "sale_price": str(obj.sale_price) if obj.sale_price is not None else None,
        "effective_price": str(obj.effective_price),
        "has_discount": obj.has_discount,
        "min_quantity": obj.min_quantity,
        "max_quantity": obj.max_quantity,
        "discount_rate": str(obj.discount_rate),
        "agent_commission_rate": str(obj.agent_commission_rate),
        "provider_share_rate": str(obj.provider_share_rate),
        "system_share_rate": str(obj.system_share_rate),
        "starts_at": obj.starts_at.isoformat() if obj.starts_at else None,
        "ends_at": obj.ends_at.isoformat() if obj.ends_at else None,
        "sort_order": obj.sort_order,
        "is_active": obj.is_active,
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
    }


def serialize_service_item(obj: ProductServiceItem) -> dict[str, Any]:
    return {
        "id": obj.id,
        "product_id": obj.product_id,
        "name": obj.name,
        "description": obj.description,
        "included_quantity": obj.included_quantity,
        "unit_price": str(obj.unit_price),
        "discount_rate": str(obj.discount_rate),
        "total_before_discount": str(obj.total_before_discount),
        "discount_amount": str(obj.discount_amount),
        "total_after_discount": str(obj.total_after_discount),
        "requires_provider": obj.requires_provider,
        "is_optional": obj.is_optional,
        "is_active": obj.is_active,
        "sort_order": obj.sort_order,
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
    }


def _build_catalog_payload(obj: Product) -> dict[str, Any]:
    if hasattr(obj, "catalog_payload"):
        return obj.catalog_payload

    return {
        "product_id": obj.id,
        "id": obj.id,
        "code": obj.code,
        "name": obj.name,
        "slug": obj.slug,
        "product_type": obj.product_type,
        "category_id": obj.category_id,
        "status": obj.status,
        "currency_code": obj.currency_code,
        "price_before_discount": _decimal_to_str(obj.price_before_discount),
        "discount_percentage": _percent_to_str(obj.discount_percentage),
        "discount_amount": _decimal_to_str(obj.discount_amount),
        "price_after_discount": _decimal_to_str(obj.price_after_discount),
        "effective_price": _decimal_to_str(obj.effective_price),
        "has_discount": obj.has_discount,
        "has_duration": obj.has_duration,
        "duration_value": obj.duration_value,
        "duration_unit": obj.duration_unit,
        "has_expiry": obj.has_expiry,
        "valid_from": _iso_date(obj.valid_from),
        "valid_until": _iso_date(obj.valid_until),
        "is_offer": obj.is_offer,
        "offer_title": obj.offer_title,
        "offer_subtitle": obj.offer_subtitle,
        "offer_badge": obj.offer_badge,
        "offer_start_date": _iso_date(obj.offer_start_date),
        "offer_end_date": _iso_date(obj.offer_end_date),
        "show_on_landing": obj.show_on_landing,
        "show_on_mobile": obj.show_on_mobile,
        "show_on_offers": obj.show_on_offers,
        "requires_provider": obj.requires_provider,
        "can_be_ordered": obj.can_be_ordered,
        "can_be_used_in_contracts": obj.can_be_used_in_contracts,
        "is_available_for_order": obj.is_available_for_order,
    }


def _build_checkout_payload(obj: Product) -> dict[str, Any]:
    if hasattr(obj, "checkout_payload"):
        return obj.checkout_payload

    return {
        "product_id": obj.id,
        "offer_source": "product",
        "offer_title": obj.offer_title or obj.name,
        "offer_badge": obj.offer_badge,
        "order_kind": obj.product_type or "general",
        "payment_method": "none",
        "quantity": 1,
        "currency_code": obj.currency_code or "SAR",
        "unit_price_before_discount": _decimal_to_str(obj.price_before_discount),
        "unit_discount_percentage": _percent_to_str(obj.discount_percentage),
        "unit_price": _decimal_to_str(obj.price_after_discount),
        "discount_amount": _decimal_to_str(obj.discount_amount),
        "total_amount": _decimal_to_str(obj.price_after_discount),
        "source": "website",
    }


def serialize_product(
    obj: Product,
    include_children: bool = True,
) -> dict[str, Any]:
    provider = getattr(obj, "provider", None)

    price_before_discount = _money(obj.price_before_discount)
    discount_percentage = _percent(getattr(obj, "discount_percentage", Decimal("0.00")))
    price_after_discount = _money(obj.price_after_discount)
    discount_amount = _money(price_before_discount - price_after_discount)

    image_url = (
        obj.marketing_image_url
        or obj.thumbnail_image_url
        or (getattr(provider, "image_url", "") if provider else "")
        or (getattr(provider, "logo_url", "") if provider else "")
    )

    provider_name = (
        getattr(provider, "name", "")
        or getattr(provider, "name_ar", "")
        or getattr(provider, "name_en", "")
        or ""
    )

    provider_name_ar = (
        getattr(provider, "name_ar", "")
        or getattr(provider, "name", "")
        or ""
    )

    provider_name_en = (
        getattr(provider, "name_en", "")
        or getattr(provider, "name", "")
        or ""
    )

    active_contracts_count = _safe_int(getattr(obj, "active_contracts_count", 0))
    contracted_products_count = _safe_int(getattr(obj, "contracted_products_count", 0))
    orders_count = _safe_int(getattr(obj, "orders_count", 0))

    highest_contract_discount = _percent(
        getattr(obj, "highest_contract_discount_percent", Decimal("0.00"))
    )
    highest_product_discount = _percent(
        getattr(obj, "highest_product_discount_percent", Decimal("0.00"))
    )
    highest_discount = _max_decimal(
        highest_contract_discount,
        highest_product_discount,
    )

    has_active_contract = bool(active_contracts_count or contracted_products_count)

    data = {
        "id": obj.id,
        "product_id": obj.id,
        "code": obj.code,
        "name": obj.name,

        # Compatibility aliases for customer/frontend.
        "name_ar": obj.name,
        "name_en": obj.name,
        "title": obj.offer_title or obj.name,
        "title_ar": obj.offer_title or obj.name,
        "title_en": obj.offer_title or obj.name,

        "slug": obj.slug,
        "product_type": obj.product_type,
        "type": obj.product_type,
        "category_id": obj.category_id,
        "category": serialize_category(obj.category) if obj.category else None,

        # Legacy provider fields only.
        "provider_id": obj.provider_id,
        "legacy_provider_id": obj.provider_id,
        "provider": serialize_provider_for_product(provider) if provider else None,
        "provider_name": provider_name,
        "provider_display_name": provider_name,
        "provider_name_ar": provider_name_ar,
        "provider_name_en": provider_name_en,
        "is_legacy_provider_product": bool(obj.provider_id),

        "status": obj.status,
        "billing_type": obj.billing_type,
        "fulfillment_type": obj.fulfillment_type,

        "short_description": obj.short_description,
        "description": obj.description,
        "description_ar": obj.description or obj.short_description or "",
        "description_en": obj.description or obj.short_description or "",
        "short_description_ar": obj.short_description or obj.description or "",
        "short_description_en": obj.short_description or obj.description or "",
        "terms_and_conditions": obj.terms_and_conditions,
        "features": obj.features,
        "tags": obj.tags,

        "thumbnail_image_url": obj.thumbnail_image_url,
        "image_url": image_url,
        "image": image_url,
        "thumbnail": obj.thumbnail_image_url or image_url,
        "thumbnail_image_drive_file_id": obj.thumbnail_image_drive_file_id,
        "thumbnail_image_drive_view_url": obj.thumbnail_image_drive_view_url,
        "thumbnail_image_folder_id": obj.thumbnail_image_folder_id,
        "thumbnail_image_folder_url": obj.thumbnail_image_folder_url,
        "thumbnail_image_alt_text": obj.thumbnail_image_alt_text,

        "marketing_image_url": obj.marketing_image_url,
        "marketing_image": obj.marketing_image_url,
        "cover_image": obj.marketing_image_url or image_url,
        "banner_image": obj.marketing_image_url or image_url,
        "marketing_image_drive_file_id": obj.marketing_image_drive_file_id,
        "marketing_image_drive_view_url": obj.marketing_image_drive_view_url,
        "marketing_image_folder_id": obj.marketing_image_folder_id,
        "marketing_image_folder_url": obj.marketing_image_folder_url,
        "marketing_image_alt_text": obj.marketing_image_alt_text,

        "currency_code": obj.currency_code,
        "currency": obj.currency_code,

        "price": _decimal_to_str(obj.price),
        "base_price": _decimal_to_str(obj.price),
        "original_price": _decimal_to_str(price_before_discount),
        "amount": _decimal_to_str(price_after_discount),

        "sale_price": str(obj.sale_price) if obj.sale_price is not None else None,
        "cost_price": str(obj.cost_price) if obj.cost_price is not None else None,
        "effective_price": _decimal_to_str(price_after_discount),

        "price_before_discount": _decimal_to_str(price_before_discount),
        "unit_price_before_discount": _decimal_to_str(price_before_discount),
        "price_after_discount": _decimal_to_str(price_after_discount),
        "unit_price": _decimal_to_str(price_after_discount),
        "discounted_price": _decimal_to_str(price_after_discount),
        "final_price": _decimal_to_str(price_after_discount),
        "discount_amount": _decimal_to_str(discount_amount),
        "discount_percent": _percent_to_str(discount_percentage),
        "discount_percentage": _percent_to_str(discount_percentage),
        "unit_discount_percentage": _percent_to_str(discount_percentage),
        "discount_rate": _percent_to_str(discount_percentage),
        "discount_source": "product_discount" if discount_percentage > 0 else "none",

        "tax_amount": str(obj.tax_amount),
        "total_price_with_tax": str(obj.total_price_with_tax),
        "has_discount": bool(obj.has_discount),
        "is_taxable": obj.is_taxable,
        "tax_rate": str(obj.tax_rate),

        "has_duration": obj.has_duration,
        "duration_value": obj.duration_value,
        "duration_unit": obj.duration_unit,
        "has_expiry": obj.has_expiry,
        "valid_from": obj.valid_from.isoformat() if obj.valid_from else None,
        "valid_until": obj.valid_until.isoformat() if obj.valid_until else None,
        "is_valid_by_date": obj.is_valid_by_date,
        "is_available_for_order": obj.is_available_for_order,

        "is_offer": bool(obj.is_offer),
        "offer_source": "product",
        "offer_title": obj.offer_title,
        "offer_subtitle": obj.offer_subtitle,
        "offer_badge": obj.offer_badge,
        "offer_terms": obj.offer_terms,
        "offer_start_date": obj.offer_start_date.isoformat() if obj.offer_start_date else None,
        "offer_end_date": obj.offer_end_date.isoformat() if obj.offer_end_date else None,
        "show_on_landing": obj.show_on_landing,
        "show_in_landing": obj.show_on_landing,
        "show_on_mobile": obj.show_on_mobile,
        "show_on_offers": obj.show_on_offers,
        "show_in_offers": obj.show_on_offers,

        "is_public": obj.is_public,
        "is_featured": obj.is_featured,
        "featured": obj.is_featured,
        "requires_approval": obj.requires_approval,
        "allow_online_purchase": obj.allow_online_purchase,
        "allow_agent_sale": obj.allow_agent_sale,
        "allow_provider_sale": obj.allow_provider_sale,
        "can_be_ordered": obj.can_be_ordered,
        "can_be_used_in_contracts": obj.can_be_used_in_contracts,
        "requires_provider": obj.requires_provider,

        "max_discount_rate": str(obj.max_discount_rate),
        "default_agent_commission_rate": str(obj.default_agent_commission_rate),

        "is_active_product": obj.is_active_product,
        "is_active": obj.is_active_product,
        "is_card": obj.is_card,
        "is_program": obj.is_program,
        "is_service": obj.is_service,
        "is_medical_service": obj.is_medical_service,
        "is_membership": obj.is_membership,
        "is_provider_product": obj.is_provider_product,
        "is_catalog_product": obj.is_catalog_product,
        "has_thumbnail_image": obj.has_thumbnail_image,
        "has_marketing_image": obj.has_marketing_image,
        "is_current_offer": obj.is_current_offer,

        # معلومات مختصرة فقط عن وجود المنتج داخل عقود.
        # تفاصيل عروض مقدم الخدمة يجب أن تأتي من /api/offers/.
        "has_active_contract": has_active_contract,
        "has_active_contracts": has_active_contract,
        "active_contracts_count": active_contracts_count,
        "contracted_products_count": contracted_products_count,
        "highest_contract_discount_percent": _percent_to_str(highest_contract_discount),
        "highest_product_discount_percent": _percent_to_str(highest_product_discount),
        "highest_discount_percent": _percent_to_str(highest_discount),
        "max_discount_percent": _percent_to_str(highest_discount),

        # Best-selling / orders aliases.
        "orders_count": orders_count,
        "order_count": orders_count,
        "total_orders": orders_count,
        "sales_count": orders_count,
        "sold_count": orders_count,
        "total_sales": orders_count,

        # Offers endpoint hints.
        "offers_endpoint": "/api/offers/",
        "provider_offers_endpoint": f"/api/offers/?product_id={obj.id}",
        "provider_landing_offers_endpoint": f"/api/offers/?product_id={obj.id}&show_on_landing=true",
        "provider_mobile_offers_endpoint": f"/api/offers/?product_id={obj.id}&show_on_mobile=true",
        "provider_offers_page_endpoint": f"/api/offers/?product_id={obj.id}&show_on_offers=true",

        "checkout_source": "offers" if obj.requires_provider else "product",
        "checkout_note": (
            "Use /api/offers/ with product_id to select provider-specific offer."
            if obj.requires_provider
            else "This catalog product can use product checkout payload directly."
        ),

        "catalog_payload": _build_catalog_payload(obj),
        "checkout_payload": _build_checkout_payload(obj),

        # Deprecated offer linkage aliases.
        "active_contract": None,
        "active_contract_id": None,
        "active_contract_number": "",
        "active_contract_title": "",
        "contract_product": None,
        "contract_product_id": None,
        "offer_id": None,
        "contract_discount_percent": "0.00",
        "contract_special_price": None,

        "sort_order": obj.sort_order,
        "created_by_id": obj.created_by_id,
        "updated_by_id": obj.updated_by_id,
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
    }

    if include_children:
        data["benefits"] = [
            serialize_benefit(item)
            for item in obj.benefits.all().order_by("sort_order", "id")
        ]

        data["pricing_tiers"] = [
            serialize_pricing_tier(item)
            for item in obj.pricing_tiers.all().order_by("sort_order", "id")
        ]

        data["service_items"] = [
            serialize_service_item(item)
            for item in obj.service_items.all().order_by("sort_order", "id")
        ]

    return data


# ============================================================
# 🔹 Create / Update Category
# ============================================================

def create_category(
    *,
    payload: dict[str, Any],
    user,
) -> ProductCategory:
    category = ProductCategory(
        code=normalize_text(payload.get("code")).upper(),
        name=normalize_text(payload.get("name")),
        category_type=normalize_choice(
            payload.get("category_type"),
            ProductCategory.CategoryType.PROGRAM,
        ),
        status=normalize_choice(
            payload.get("status"),
            ProductCategory.Status.ACTIVE,
        ),
        description=normalize_text(payload.get("description")),
        sort_order=parse_int(payload.get("sort_order"), 0) or 0,
        created_by=user if getattr(user, "is_authenticated", False) else None,
        updated_by=user if getattr(user, "is_authenticated", False) else None,
    )

    category.full_clean()
    category.save()

    return category


def update_category(
    *,
    instance: ProductCategory,
    payload: dict[str, Any],
    user,
) -> ProductCategory:
    if "code" in payload:
        instance.code = normalize_text(payload.get("code")).upper()

    if "name" in payload:
        instance.name = normalize_text(payload.get("name"))

    if "category_type" in payload:
        instance.category_type = normalize_text(payload.get("category_type"))

    if "status" in payload:
        instance.status = normalize_text(payload.get("status"))

    if "description" in payload:
        instance.description = normalize_text(payload.get("description"))

    if "sort_order" in payload:
        instance.sort_order = parse_int(payload.get("sort_order"), 0) or 0

    instance.updated_by = user if getattr(user, "is_authenticated", False) else None
    instance.full_clean()
    instance.save()

    return instance


# ============================================================
# 🔹 Product Helpers
# ============================================================

def _resolve_category(payload: dict[str, Any]) -> ProductCategory | None:
    if "category_id" not in payload:
        return None

    category_id = payload.get("category_id")

    if category_id in (None, "", 0, "0"):
        return None

    try:
        return ProductCategory.objects.get(pk=int(category_id))
    except (ProductCategory.DoesNotExist, TypeError, ValueError) as exc:
        raise ValidationError("Selected category does not exist.") from exc


def _resolve_provider(payload: dict[str, Any]) -> Provider | None:
    """
    Legacy only.
    لا يستخدم في إنشاء المنتجات الجديدة من الواجهة الحديثة.
    """

    if "provider_id" not in payload:
        return None

    provider_id = payload.get("provider_id")

    if provider_id in (None, "", 0, "0"):
        return None

    try:
        return Provider.objects.get(pk=int(provider_id))
    except (Provider.DoesNotExist, TypeError, ValueError) as exc:
        raise ValidationError("Selected provider does not exist.") from exc


def _parse_date_value(value: Any):
    if value in (None, ""):
        return None

    return value


def _apply_product_payload(
    *,
    product: Product,
    payload: dict[str, Any],
    user,
    is_create: bool,
) -> Product:
    if is_create or "name" in payload:
        product.name = normalize_text(payload.get("name"))

    if is_create or "product_type" in payload:
        product.product_type = normalize_choice(
            payload.get("product_type"),
            Product.ProductType.CARD,
        )

    if "category_id" in payload:
        product.category = _resolve_category(payload)

    # توافق قديم فقط. لا ترسل provider_id من الواجهة الجديدة.
    if "provider_id" in payload:
        product.provider = _resolve_provider(payload)

    if is_create or "status" in payload:
        product.status = normalize_choice(
            payload.get("status"),
            Product.Status.DRAFT,
        )

    if is_create or "billing_type" in payload:
        product.billing_type = normalize_choice(
            payload.get("billing_type"),
            Product.BillingType.ONE_TIME,
        )

    if is_create or "fulfillment_type" in payload:
        product.fulfillment_type = normalize_choice(
            payload.get("fulfillment_type"),
            Product.FulfillmentType.DIGITAL,
        )

    text_fields = (
        "short_description",
        "description",
        "terms_and_conditions",
        "features",
        "tags",
        "offer_title",
        "offer_subtitle",
        "offer_badge",
        "offer_terms",
        "thumbnail_image_url",
        "thumbnail_image_drive_file_id",
        "thumbnail_image_drive_view_url",
        "thumbnail_image_folder_id",
        "thumbnail_image_folder_url",
        "thumbnail_image_alt_text",
        "marketing_image_url",
        "marketing_image_drive_file_id",
        "marketing_image_drive_view_url",
        "marketing_image_folder_id",
        "marketing_image_folder_url",
        "marketing_image_alt_text",
    )

    for field_name in text_fields:
        if is_create or field_name in payload:
            setattr(product, field_name, normalize_text(payload.get(field_name)))

    if is_create or "currency_code" in payload:
        product.currency_code = normalize_text(
            payload.get("currency_code"),
            "SAR",
        ).upper()

    if is_create or "price" in payload:
        product.price = parse_decimal(
            payload.get("price"),
            Decimal("0.00"),
        ) or Decimal("0.00")

    if is_create or "discount_percentage" in payload:
        product.discount_percentage = parse_decimal(
            payload.get("discount_percentage"),
            Decimal("0.00"),
        ) or Decimal("0.00")

    if "sale_price" in payload:
        product.sale_price = parse_decimal(payload.get("sale_price"))

    if "cost_price" in payload:
        product.cost_price = parse_decimal(payload.get("cost_price"))

    if is_create or "is_taxable" in payload:
        product.is_taxable = parse_bool(
            payload.get("is_taxable"),
            False,
        ) or False

    if is_create or "tax_rate" in payload:
        product.tax_rate = parse_decimal(
            payload.get("tax_rate"),
            Decimal("0.00"),
        ) or Decimal("0.00")

    if is_create or "has_duration" in payload:
        product.has_duration = parse_bool(
            payload.get("has_duration"),
            False,
        ) or False

    if is_create or "duration_value" in payload:
        product.duration_value = parse_int(
            payload.get("duration_value"),
            0,
        ) or 0

    if is_create or "duration_unit" in payload:
        product.duration_unit = normalize_choice(
            payload.get("duration_unit"),
            Product.DurationUnit.NONE,
        )

    if is_create or "has_expiry" in payload:
        product.has_expiry = parse_bool(
            payload.get("has_expiry"),
            False,
        ) or False

    if is_create or "valid_from" in payload:
        product.valid_from = _parse_date_value(payload.get("valid_from"))

    if is_create or "valid_until" in payload:
        product.valid_until = _parse_date_value(payload.get("valid_until"))

    if is_create or "offer_start_date" in payload:
        product.offer_start_date = _parse_date_value(payload.get("offer_start_date"))

    if is_create or "offer_end_date" in payload:
        product.offer_end_date = _parse_date_value(payload.get("offer_end_date"))

    bool_fields_with_defaults = {
        "is_public": True,
        "is_featured": False,
        "is_offer": False,
        "show_on_landing": False,
        "show_on_mobile": False,
        "show_on_offers": False,
        "requires_approval": False,
        "allow_online_purchase": True,
        "allow_agent_sale": True,
        "allow_provider_sale": False,
        "can_be_ordered": True,
        "can_be_used_in_contracts": True,
        "requires_provider": False,
    }

    for field_name, default_value in bool_fields_with_defaults.items():
        if is_create or field_name in payload:
            current_value = getattr(product, field_name, default_value)
            parsed_value = parse_bool(
                payload.get(field_name),
                current_value if not is_create else default_value,
            )
            setattr(product, field_name, default_value if parsed_value is None else parsed_value)

    if is_create or "max_discount_rate" in payload:
        product.max_discount_rate = parse_decimal(
            payload.get("max_discount_rate"),
            Decimal("0.00"),
        ) or Decimal("0.00")

    if is_create or "default_agent_commission_rate" in payload:
        product.default_agent_commission_rate = parse_decimal(
            payload.get("default_agent_commission_rate"),
            Decimal("0.00"),
        ) or Decimal("0.00")

    if is_create or "sort_order" in payload:
        product.sort_order = parse_int(
            payload.get("sort_order"),
            0,
        ) or 0

    if "slug" in payload:
        product.slug = normalize_text(payload.get("slug"))

    if "code" in payload:
        product.code = normalize_text(payload.get("code")).upper()

    # قواعد افتراضية حسب نوع المنتج.
    if product.product_type in [Product.ProductType.CARD, Product.ProductType.MEMBERSHIP]:
        product.has_duration = True
        product.requires_provider = False

    if product.product_type == Product.ProductType.MEDICAL_SERVICE:
        product.can_be_used_in_contracts = True
        product.requires_provider = True

    if product.product_type == Product.ProductType.SERVICE:
        product.can_be_used_in_contracts = True

    # توافق قديم فقط.
    if product.provider_id:
        product.requires_provider = True
        product.can_be_used_in_contracts = True

    if is_create:
        product.created_by = user if getattr(user, "is_authenticated", False) else None

    product.updated_by = user if getattr(user, "is_authenticated", False) else None

    return product


# ============================================================
# 🔹 Create / Update Product
# ============================================================

def create_product(
    *,
    payload: dict[str, Any],
    user,
) -> Product:
    product = Product()
    product.category = _resolve_category(payload)

    # Legacy only, kept for old integrations.
    if "provider_id" in payload:
        product.provider = _resolve_provider(payload)

    _apply_product_payload(
        product=product,
        payload=payload,
        user=user,
        is_create=True,
    )

    with transaction.atomic():
        product.full_clean()
        product.save()

        if "benefits" in payload:
            sync_product_benefits(
                product=product,
                items=payload.get("benefits") or [],
            )

        if "pricing_tiers" in payload:
            sync_product_pricing_tiers(
                product=product,
                items=payload.get("pricing_tiers") or [],
            )

        if "service_items" in payload:
            sync_product_service_items(
                product=product,
                items=payload.get("service_items") or [],
            )

    return product


def update_product(
    *,
    instance: Product,
    payload: dict[str, Any],
    user,
) -> Product:
    if "category_id" in payload:
        instance.category = _resolve_category(payload)

    # Legacy only, kept for old integrations.
    if "provider_id" in payload:
        instance.provider = _resolve_provider(payload)

    _apply_product_payload(
        product=instance,
        payload=payload,
        user=user,
        is_create=False,
    )

    with transaction.atomic():
        instance.full_clean()
        instance.save()

        if "benefits" in payload:
            sync_product_benefits(
                product=instance,
                items=payload.get("benefits") or [],
            )

        if "pricing_tiers" in payload:
            sync_product_pricing_tiers(
                product=instance,
                items=payload.get("pricing_tiers") or [],
            )

        if "service_items" in payload:
            sync_product_service_items(
                product=instance,
                items=payload.get("service_items") or [],
            )

    return instance


# ============================================================
# 🔹 Nested Sync — Benefits
# ============================================================

def sync_product_benefits(
    *,
    product: Product,
    items: list[dict[str, Any]],
) -> None:
    if not isinstance(items, list):
        raise ValidationError("Benefits must be a list.")

    existing_map = {
        item.id: item
        for item in product.benefits.all()
    }

    keep_ids: list[int] = []

    for raw in items:
        if not isinstance(raw, dict):
            raise ValidationError("Each benefit must be an object.")

        benefit_id = raw.get("id")
        title = normalize_text(raw.get("title"))
        description = normalize_text(raw.get("description"))
        sort_order = parse_int(raw.get("sort_order"), 0) or 0
        is_active = parse_bool(raw.get("is_active"), True)
        marked_delete = parse_bool(raw.get("delete"), False) or False

        if benefit_id:
            try:
                benefit_id = int(benefit_id)
            except (TypeError, ValueError) as exc:
                raise ValidationError("Invalid benefit id.") from exc

            benefit = existing_map.get(benefit_id)

            if not benefit:
                raise ValidationError(f"Benefit id {benefit_id} does not belong to this product.")

            if marked_delete:
                benefit.delete()
                continue

            benefit.title = title
            benefit.description = description
            benefit.sort_order = sort_order
            benefit.is_active = True if is_active is None else is_active
            benefit.full_clean()
            benefit.save()
            keep_ids.append(benefit.id)
            continue

        if marked_delete:
            continue

        benefit = ProductBenefit(
            product=product,
            title=title,
            description=description,
            sort_order=sort_order,
            is_active=True if is_active is None else is_active,
        )
        benefit.full_clean()
        benefit.save()
        keep_ids.append(benefit.id)

    product.benefits.exclude(id__in=keep_ids).delete()


# ============================================================
# 🔹 Nested Sync — Pricing Tiers
# ============================================================

def sync_product_pricing_tiers(
    *,
    product: Product,
    items: list[dict[str, Any]],
) -> None:
    if not isinstance(items, list):
        raise ValidationError("Pricing tiers must be a list.")

    existing_map = {
        item.id: item
        for item in product.pricing_tiers.all()
    }

    keep_ids: list[int] = []

    for raw in items:
        if not isinstance(raw, dict):
            raise ValidationError("Each pricing tier must be an object.")

        tier_id = raw.get("id")
        name = normalize_text(raw.get("name"))
        pricing_type = normalize_choice(
            raw.get("pricing_type"),
            ProductPricingTier.PricingType.STANDARD,
        )
        currency_code = normalize_text(
            raw.get("currency_code"),
            product.currency_code or "SAR",
        ).upper()
        price = parse_decimal(raw.get("price"), Decimal("0.00")) or Decimal("0.00")
        sale_price = parse_decimal(raw.get("sale_price"))
        min_quantity = parse_int(raw.get("min_quantity"), 1) or 1
        max_quantity = parse_int(raw.get("max_quantity"))
        discount_rate = parse_decimal(raw.get("discount_rate"), Decimal("0.00")) or Decimal("0.00")
        agent_commission_rate = parse_decimal(raw.get("agent_commission_rate"), Decimal("0.00")) or Decimal("0.00")
        provider_share_rate = parse_decimal(raw.get("provider_share_rate"), Decimal("0.00")) or Decimal("0.00")
        system_share_rate = parse_decimal(raw.get("system_share_rate"), Decimal("0.00")) or Decimal("0.00")
        starts_at = raw.get("starts_at") or None
        ends_at = raw.get("ends_at") or None
        sort_order = parse_int(raw.get("sort_order"), 0) or 0
        is_active = parse_bool(raw.get("is_active"), True)
        marked_delete = parse_bool(raw.get("delete"), False) or False

        if tier_id:
            try:
                tier_id = int(tier_id)
            except (TypeError, ValueError) as exc:
                raise ValidationError("Invalid pricing tier id.") from exc

            tier = existing_map.get(tier_id)

            if not tier:
                raise ValidationError(f"Pricing tier id {tier_id} does not belong to this product.")

            if marked_delete:
                tier.delete()
                continue

            tier.name = name
            tier.pricing_type = pricing_type
            tier.currency_code = currency_code
            tier.price = price
            tier.sale_price = sale_price
            tier.min_quantity = min_quantity
            tier.max_quantity = max_quantity
            tier.discount_rate = discount_rate
            tier.agent_commission_rate = agent_commission_rate
            tier.provider_share_rate = provider_share_rate
            tier.system_share_rate = system_share_rate
            tier.starts_at = starts_at
            tier.ends_at = ends_at
            tier.sort_order = sort_order
            tier.is_active = True if is_active is None else is_active
            tier.full_clean()
            tier.save()
            keep_ids.append(tier.id)
            continue

        if marked_delete:
            continue

        tier = ProductPricingTier(
            product=product,
            name=name,
            pricing_type=pricing_type,
            currency_code=currency_code,
            price=price,
            sale_price=sale_price,
            min_quantity=min_quantity,
            max_quantity=max_quantity,
            discount_rate=discount_rate,
            agent_commission_rate=agent_commission_rate,
            provider_share_rate=provider_share_rate,
            system_share_rate=system_share_rate,
            starts_at=starts_at,
            ends_at=ends_at,
            sort_order=sort_order,
            is_active=True if is_active is None else is_active,
        )
        tier.full_clean()
        tier.save()
        keep_ids.append(tier.id)

    product.pricing_tiers.exclude(id__in=keep_ids).delete()


# ============================================================
# 🔹 Nested Sync — Service Items
# ============================================================

def sync_product_service_items(
    *,
    product: Product,
    items: list[dict[str, Any]],
) -> None:
    if not isinstance(items, list):
        raise ValidationError("Service items must be a list.")

    existing_map = {
        item.id: item
        for item in product.service_items.all()
    }

    keep_ids: list[int] = []

    for raw in items:
        if not isinstance(raw, dict):
            raise ValidationError("Each service item must be an object.")

        item_id = raw.get("id")
        name = normalize_text(raw.get("name"))
        description = normalize_text(raw.get("description"))
        included_quantity = parse_int(raw.get("included_quantity"), 1) or 1
        unit_price = parse_decimal(raw.get("unit_price"), Decimal("0.00")) or Decimal("0.00")
        discount_rate = parse_decimal(raw.get("discount_rate"), Decimal("0.00")) or Decimal("0.00")
        requires_provider = parse_bool(raw.get("requires_provider"), True)
        is_optional = parse_bool(raw.get("is_optional"), False)
        is_active = parse_bool(raw.get("is_active"), True)
        sort_order = parse_int(raw.get("sort_order"), 0) or 0
        marked_delete = parse_bool(raw.get("delete"), False) or False

        if item_id:
            try:
                item_id = int(item_id)
            except (TypeError, ValueError) as exc:
                raise ValidationError("Invalid service item id.") from exc

            service_item = existing_map.get(item_id)

            if not service_item:
                raise ValidationError(f"Service item id {item_id} does not belong to this product.")

            if marked_delete:
                service_item.delete()
                continue

            service_item.name = name
            service_item.description = description
            service_item.included_quantity = included_quantity
            service_item.unit_price = unit_price
            service_item.discount_rate = discount_rate
            service_item.requires_provider = True if requires_provider is None else requires_provider
            service_item.is_optional = False if is_optional is None else is_optional
            service_item.is_active = True if is_active is None else is_active
            service_item.sort_order = sort_order
            service_item.full_clean()
            service_item.save()
            keep_ids.append(service_item.id)
            continue

        if marked_delete:
            continue

        service_item = ProductServiceItem(
            product=product,
            name=name,
            description=description,
            included_quantity=included_quantity,
            unit_price=unit_price,
            discount_rate=discount_rate,
            requires_provider=True if requires_provider is None else requires_provider,
            is_optional=False if is_optional is None else is_optional,
            is_active=True if is_active is None else is_active,
            sort_order=sort_order,
        )
        service_item.full_clean()
        service_item.save()
        keep_ids.append(service_item.id)

    product.service_items.exclude(id__in=keep_ids).delete()


# ============================================================
# 🔹 Product Business Helpers
# ============================================================

def _base_active_public_products() -> QuerySet[Product]:
    return Product.objects.select_related("category", "provider").filter(
        status=Product.Status.ACTIVE,
        is_public=True,
    )


def get_orderable_products_queryset() -> QuerySet[Product]:
    return (
        Product.objects
        .select_related("category", "provider")
        .filter(
            status=Product.Status.ACTIVE,
            can_be_ordered=True,
        )
        .filter(_current_date_q())
    )


def get_contract_products_queryset() -> QuerySet[Product]:
    return Product.objects.select_related("category", "provider").filter(
        status=Product.Status.ACTIVE,
        can_be_used_in_contracts=True,
    )


def get_public_products_queryset() -> QuerySet[Product]:
    return (
        _base_active_public_products()
        .filter(_current_date_q())
    )


def get_featured_products_queryset() -> QuerySet[Product]:
    return (
        _base_active_public_products()
        .filter(
            is_featured=True,
        )
        .filter(_current_date_q())
    )


def get_landing_products_queryset() -> QuerySet[Product]:
    """
    منتجات صفحة الهبوط العامة فقط.

    عروض مقدمي الخدمة ذات الأسعار المختلفة تأتي من:
    /api/offers/?show_on_landing=true
    """

    return (
        _base_active_public_products()
        .filter(
            show_on_landing=True,
        )
        .filter(_current_date_q())
        .distinct()
    )


def get_mobile_products_queryset() -> QuerySet[Product]:
    """
    منتجات التطبيق العامة فقط.

    عروض مقدمي الخدمة للتطبيق تأتي من:
    /api/offers/?show_on_mobile=true
    """

    return (
        _base_active_public_products()
        .filter(
            show_on_mobile=True,
        )
        .filter(_current_date_q())
        .distinct()
    )


def get_offer_products_queryset() -> QuerySet[Product]:
    """
    عروض عامة محفوظة على Product نفسه.

    لا تشمل عروض مقدمي الخدمة داخل العقود.
    عروض مقدمي الخدمة تأتي من:
    /api/offers/
    """

    return (
        _base_active_public_products()
        .filter(
            Q(is_offer=True)
            | Q(show_on_offers=True)
        )
        .filter(_current_date_q())
        .filter(
            Q(offer_start_date__isnull=True) | Q(offer_start_date__lte=timezone.localdate()),
            Q(offer_end_date__isnull=True) | Q(offer_end_date__gte=timezone.localdate()),
        )
        .distinct()
    )


def calculate_product_price_snapshot(product: Product) -> dict[str, Any]:
    """
    Snapshot سعر المنتج العام.

    مهم:
    إذا كان الطلب قادمًا من عرض مقدم خدمة، استخدم offer_id / contract_product_id
    من /api/offers/ بدل Snapshot المنتج العام.
    """

    price_before_discount = _money(product.price_before_discount)
    price_after_discount = _money(product.price_after_discount)
    discount_percentage = _percent(product.discount_percentage)
    discount_amount = _money(price_before_discount - price_after_discount)

    return {
        "product_id": product.id,
        "product_code": product.code,
        "product_name": product.name,
        "product_type": product.product_type,

        "provider_id": product.provider_id,
        "provider_name": (
            getattr(product.provider, "name", "")
            if getattr(product, "provider", None)
            else ""
        ),
        "is_legacy_provider_product": bool(product.provider_id),

        "currency_code": product.currency_code,
        "price": _decimal_to_str(product.price),
        "sale_price": str(product.sale_price) if product.sale_price is not None else None,
        "effective_price": _decimal_to_str(price_after_discount),
        "price_before_discount": _decimal_to_str(price_before_discount),
        "unit_price_before_discount": _decimal_to_str(price_before_discount),
        "price_after_discount": _decimal_to_str(price_after_discount),
        "unit_price": _decimal_to_str(price_after_discount),
        "discount_percent": _percent_to_str(discount_percentage),
        "discount_percentage": _percent_to_str(discount_percentage),
        "unit_discount_percentage": _percent_to_str(discount_percentage),
        "discount_rate": _percent_to_str(discount_percentage),
        "discount_amount": _decimal_to_str(discount_amount),
        "discount_source": "product_discount" if discount_percentage > 0 else "none",

        "has_active_contract": False,
        "active_contract": None,
        "contract_product": None,
        "offer_id": None,
        "contract_product_id": None,
        "offer_source": "product",
        "offer_title": product.offer_title or product.name,
        "offer_badge": product.offer_badge,

        "is_taxable": product.is_taxable,
        "tax_rate": str(product.tax_rate),
        "tax_amount": str(product.tax_amount),
        "total_price_with_tax": str(product.total_price_with_tax),
        "max_discount_rate": str(product.max_discount_rate),
        "default_agent_commission_rate": str(product.default_agent_commission_rate),

        "is_offer": product.is_offer,
        "offer_start_date": product.offer_start_date.isoformat() if product.offer_start_date else None,
        "offer_end_date": product.offer_end_date.isoformat() if product.offer_end_date else None,

        "has_duration": product.has_duration,
        "duration_value": product.duration_value,
        "duration_unit": product.duration_unit,
        "has_expiry": product.has_expiry,
        "valid_from": product.valid_from.isoformat() if product.valid_from else None,
        "valid_until": product.valid_until.isoformat() if product.valid_until else None,

        "marketing_image_url": product.marketing_image_url,
        "thumbnail_image_url": product.thumbnail_image_url,

        "catalog_payload": _build_catalog_payload(product),
        "checkout_payload": _build_checkout_payload(product),
        "checkout_source": "offers" if product.requires_provider else "product",
        "offers_endpoint": "/api/offers/",
        "provider_offers_endpoint": f"/api/offers/?product_id={product.id}",
    }