# ============================================================
# 📂 products/services.py
# 🧭 Primey Care — Products & Programs Services
# ------------------------------------------------------------
# ✅ خدمات مساعدة رسمية لموديول المنتجات
# ✅ Serialization
# ✅ Validation helpers
# ✅ Filters / pagination
# ✅ Nested benefits / pricing tiers / service items sync
# ✅ Provider-linked medical offers
# ✅ Landing / Mobile / Offers marketing fields
# ✅ جاهز للربط مع الطلبات والعقود ومقدمي الخدمة
# ============================================================

from __future__ import annotations

import json
from decimal import Decimal, InvalidOperation
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
        return json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValidationError(f"Invalid JSON body: {exc}")


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


def apply_product_filters(
    queryset: QuerySet[Product],
    params,
) -> QuerySet[Product]:
    q = normalize_text(params.get("q"))
    status_value = normalize_text(params.get("status"))
    product_type = normalize_text(params.get("product_type"))
    billing_type = normalize_text(params.get("billing_type"))
    fulfillment_type = normalize_text(params.get("fulfillment_type"))

    category_id = parse_int(params.get("category_id"))
    provider_id = parse_int(params.get("provider_id"))

    is_public = parse_bool(params.get("is_public"))
    is_featured = parse_bool(params.get("is_featured"))
    is_offer = parse_bool(params.get("is_offer"))
    current_offer = parse_bool(params.get("current_offer"))

    show_on_landing = parse_bool(params.get("show_on_landing"))
    show_on_mobile = parse_bool(params.get("show_on_mobile"))
    show_on_offers = parse_bool(params.get("show_on_offers"))

    allow_online_purchase = parse_bool(params.get("allow_online_purchase"))
    allow_agent_sale = parse_bool(params.get("allow_agent_sale"))
    allow_provider_sale = parse_bool(params.get("allow_provider_sale"))
    can_be_ordered = parse_bool(params.get("can_be_ordered"))
    can_be_used_in_contracts = parse_bool(params.get("can_be_used_in_contracts"))
    requires_provider = parse_bool(params.get("requires_provider"))
    is_taxable = parse_bool(params.get("is_taxable"))

    has_thumbnail_image = parse_bool(params.get("has_thumbnail_image"))
    has_marketing_image = parse_bool(params.get("has_marketing_image"))

    min_price = parse_decimal(params.get("min_price"))
    max_price = parse_decimal(params.get("max_price"))

    today = timezone.localdate()

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

    if current_offer is True:
        queryset = queryset.filter(
            is_offer=True,
            status=Product.Status.ACTIVE,
        ).filter(
            Q(offer_start_date__isnull=True) | Q(offer_start_date__lte=today),
            Q(offer_end_date__isnull=True) | Q(offer_end_date__gte=today),
        )

    if current_offer is False:
        queryset = queryset.exclude(
            is_offer=True,
            status=Product.Status.ACTIVE,
            offer_start_date__lte=today,
            offer_end_date__gte=today,
        )

    if min_price is not None:
        queryset = queryset.filter(price__gte=min_price)

    if max_price is not None:
        queryset = queryset.filter(price__lte=max_price)

    ordering = normalize_text(params.get("ordering") or params.get("order_by"))

    allowed_ordering = {
        "name": "name",
        "-name": "-name",
        "price": "price",
        "-price": "-price",
        "sale_price": "sale_price",
        "-sale_price": "-sale_price",
        "created_at": "created_at",
        "-created_at": "-created_at",
        "sort_order": "sort_order",
        "-sort_order": "-sort_order",
        "offer_start_date": "offer_start_date",
        "-offer_start_date": "-offer_start_date",
        "offer_end_date": "offer_end_date",
        "-offer_end_date": "-offer_end_date",
    }

    if ordering in allowed_ordering:
        queryset = queryset.order_by(allowed_ordering[ordering], "-id")

    return queryset.distinct()


def apply_category_filters(
    queryset: QuerySet[ProductCategory],
    params,
) -> QuerySet[ProductCategory]:
    q = normalize_text(params.get("q"))
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
    if not provider:
        return None

    return {
        "id": provider.id,
        "code": getattr(provider, "code", ""),
        "name": getattr(provider, "name", ""),
        "name_ar": getattr(provider, "name_ar", ""),
        "name_en": getattr(provider, "name_en", ""),
        "provider_type": getattr(provider, "provider_type", ""),
        "status": getattr(provider, "status", ""),
        "city": getattr(provider, "city", ""),
        "region": getattr(provider, "region", ""),
        "logo_url": getattr(provider, "logo_url", ""),
        "image_url": getattr(provider, "image_url", ""),
        "drive_folder_id": getattr(provider, "drive_folder_id", ""),
        "drive_folder_url": getattr(provider, "drive_folder_url", ""),
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


def serialize_product(
    obj: Product,
    include_children: bool = True,
) -> dict[str, Any]:
    data = {
        "id": obj.id,
        "code": obj.code,
        "name": obj.name,
        "slug": obj.slug,
        "product_type": obj.product_type,
        "category_id": obj.category_id,
        "category": serialize_category(obj.category) if obj.category else None,
        "provider_id": obj.provider_id,
        "provider": serialize_provider_for_product(obj.provider) if getattr(obj, "provider", None) else None,
        "status": obj.status,
        "billing_type": obj.billing_type,
        "fulfillment_type": obj.fulfillment_type,

        "short_description": obj.short_description,
        "description": obj.description,
        "terms_and_conditions": obj.terms_and_conditions,
        "features": obj.features,
        "tags": obj.tags,

        "thumbnail_image_url": obj.thumbnail_image_url,
        "thumbnail_image_drive_file_id": obj.thumbnail_image_drive_file_id,
        "thumbnail_image_drive_view_url": obj.thumbnail_image_drive_view_url,
        "thumbnail_image_folder_id": obj.thumbnail_image_folder_id,
        "thumbnail_image_folder_url": obj.thumbnail_image_folder_url,
        "thumbnail_image_alt_text": obj.thumbnail_image_alt_text,

        "marketing_image_url": obj.marketing_image_url,
        "marketing_image_drive_file_id": obj.marketing_image_drive_file_id,
        "marketing_image_drive_view_url": obj.marketing_image_drive_view_url,
        "marketing_image_folder_id": obj.marketing_image_folder_id,
        "marketing_image_folder_url": obj.marketing_image_folder_url,
        "marketing_image_alt_text": obj.marketing_image_alt_text,

        "currency_code": obj.currency_code,
        "price": str(obj.price),
        "sale_price": str(obj.sale_price) if obj.sale_price is not None else None,
        "cost_price": str(obj.cost_price) if obj.cost_price is not None else None,
        "effective_price": str(obj.effective_price),
        "tax_amount": str(obj.tax_amount),
        "total_price_with_tax": str(obj.total_price_with_tax),
        "has_discount": obj.has_discount,
        "is_taxable": obj.is_taxable,
        "tax_rate": str(obj.tax_rate),

        "duration_value": obj.duration_value,
        "duration_unit": obj.duration_unit,

        "is_offer": obj.is_offer,
        "offer_title": obj.offer_title,
        "offer_subtitle": obj.offer_subtitle,
        "offer_badge": obj.offer_badge,
        "offer_terms": obj.offer_terms,
        "offer_start_date": obj.offer_start_date.isoformat() if obj.offer_start_date else None,
        "offer_end_date": obj.offer_end_date.isoformat() if obj.offer_end_date else None,
        "show_on_landing": obj.show_on_landing,
        "show_on_mobile": obj.show_on_mobile,
        "show_on_offers": obj.show_on_offers,

        "is_public": obj.is_public,
        "is_featured": obj.is_featured,
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
        "is_card": obj.is_card,
        "is_program": obj.is_program,
        "is_service": obj.is_service,
        "is_membership": obj.is_membership,
        "is_provider_product": obj.is_provider_product,
        "has_thumbnail_image": obj.has_thumbnail_image,
        "has_marketing_image": obj.has_marketing_image,
        "is_current_offer": obj.is_current_offer,

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
    except (ProductCategory.DoesNotExist, TypeError, ValueError):
        raise ValidationError("Selected category does not exist.")


def _resolve_provider(payload: dict[str, Any]) -> Provider | None:
    if "provider_id" not in payload:
        return None

    provider_id = payload.get("provider_id")

    if provider_id in (None, "", 0, "0"):
        return None

    try:
        return Provider.objects.get(pk=int(provider_id))
    except (Provider.DoesNotExist, TypeError, ValueError):
        raise ValidationError("Selected provider does not exist.")


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
            Product.ProductType.PROGRAM,
        )

    if "category_id" in payload:
        product.category = _resolve_category(payload)

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

    if is_create or "offer_start_date" in payload:
        product.offer_start_date = payload.get("offer_start_date") or None

    if is_create or "offer_end_date" in payload:
        product.offer_end_date = payload.get("offer_end_date") or None

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

    if product.provider_id:
        product.requires_provider = True

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
            except (TypeError, ValueError):
                raise ValidationError("Invalid benefit id.")

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
            except (TypeError, ValueError):
                raise ValidationError("Invalid pricing tier id.")

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
            except (TypeError, ValueError):
                raise ValidationError("Invalid service item id.")

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

def get_orderable_products_queryset() -> QuerySet[Product]:
    return Product.objects.select_related("category", "provider").filter(
        status=Product.Status.ACTIVE,
        can_be_ordered=True,
    )


def get_contract_products_queryset() -> QuerySet[Product]:
    return Product.objects.select_related("category", "provider").filter(
        status=Product.Status.ACTIVE,
        can_be_used_in_contracts=True,
    )


def get_public_products_queryset() -> QuerySet[Product]:
    return Product.objects.select_related("category", "provider").filter(
        status=Product.Status.ACTIVE,
        is_public=True,
    )


def get_featured_products_queryset() -> QuerySet[Product]:
    return Product.objects.select_related("category", "provider").filter(
        status=Product.Status.ACTIVE,
        is_featured=True,
    )


def get_landing_products_queryset() -> QuerySet[Product]:
    today = timezone.localdate()

    return Product.objects.select_related("category", "provider").filter(
        status=Product.Status.ACTIVE,
        is_public=True,
        show_on_landing=True,
    ).filter(
        Q(offer_start_date__isnull=True) | Q(offer_start_date__lte=today),
        Q(offer_end_date__isnull=True) | Q(offer_end_date__gte=today),
    )


def get_mobile_products_queryset() -> QuerySet[Product]:
    today = timezone.localdate()

    return Product.objects.select_related("category", "provider").filter(
        status=Product.Status.ACTIVE,
        is_public=True,
        show_on_mobile=True,
    ).filter(
        Q(offer_start_date__isnull=True) | Q(offer_start_date__lte=today),
        Q(offer_end_date__isnull=True) | Q(offer_end_date__gte=today),
    )


def get_offer_products_queryset() -> QuerySet[Product]:
    today = timezone.localdate()

    return Product.objects.select_related("category", "provider").filter(
        status=Product.Status.ACTIVE,
        is_public=True,
        is_offer=True,
        show_on_offers=True,
    ).filter(
        Q(offer_start_date__isnull=True) | Q(offer_start_date__lte=today),
        Q(offer_end_date__isnull=True) | Q(offer_end_date__gte=today),
    )


def calculate_product_price_snapshot(product: Product) -> dict[str, Any]:
    return {
        "product_id": product.id,
        "product_code": product.code,
        "product_name": product.name,
        "product_type": product.product_type,
        "provider_id": product.provider_id,
        "provider_name": getattr(product.provider, "name", "") if getattr(product, "provider", None) else "",
        "currency_code": product.currency_code,
        "price": str(product.price),
        "sale_price": str(product.sale_price) if product.sale_price is not None else None,
        "effective_price": str(product.effective_price),
        "is_taxable": product.is_taxable,
        "tax_rate": str(product.tax_rate),
        "tax_amount": str(product.tax_amount),
        "total_price_with_tax": str(product.total_price_with_tax),
        "max_discount_rate": str(product.max_discount_rate),
        "default_agent_commission_rate": str(product.default_agent_commission_rate),
        "is_offer": product.is_offer,
        "offer_title": product.offer_title,
        "offer_start_date": product.offer_start_date.isoformat() if product.offer_start_date else None,
        "offer_end_date": product.offer_end_date.isoformat() if product.offer_end_date else None,
        "marketing_image_url": product.marketing_image_url,
        "thumbnail_image_url": product.thumbnail_image_url,
    }