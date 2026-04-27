# ============================================================
# 📂 products/services.py
# 🧭 Primey Care — Products Services
# ------------------------------------------------------------
# ✅ خدمات مساعدة رسمية لموديول المنتجات
# ✅ Serialization
# ✅ Validation helpers
# ✅ Filters / pagination
# ✅ Nested benefits / pricing tiers sync
# ============================================================

from __future__ import annotations

import json
from decimal import Decimal, InvalidOperation
from typing import Any

from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import Q, QuerySet

from products.models import (
    Product,
    ProductBenefit,
    ProductCategory,
    ProductPricingTier,
)


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
    return str(value).strip()


# ============================================================
# 🔹 Query Helpers
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


def apply_product_filters(queryset: QuerySet[Product], params) -> QuerySet[Product]:
    q = normalize_text(params.get("q"))
    status_value = normalize_text(params.get("status"))
    product_type = normalize_text(params.get("product_type"))
    billing_type = normalize_text(params.get("billing_type"))
    category_id = parse_int(params.get("category_id"))
    is_public = parse_bool(params.get("is_public"))
    is_featured = parse_bool(params.get("is_featured"))
    allow_online_purchase = parse_bool(params.get("allow_online_purchase"))

    if q:
        queryset = queryset.filter(
            Q(name__icontains=q)
            | Q(code__icontains=q)
            | Q(slug__icontains=q)
            | Q(short_description__icontains=q)
            | Q(description__icontains=q)
            | Q(tags__icontains=q)
        )

    if status_value:
        queryset = queryset.filter(status=status_value)

    if product_type:
        queryset = queryset.filter(product_type=product_type)

    if billing_type:
        queryset = queryset.filter(billing_type=billing_type)

    if category_id:
        queryset = queryset.filter(category_id=category_id)

    if is_public is not None:
        queryset = queryset.filter(is_public=is_public)

    if is_featured is not None:
        queryset = queryset.filter(is_featured=is_featured)

    if allow_online_purchase is not None:
        queryset = queryset.filter(allow_online_purchase=allow_online_purchase)

    return queryset


def apply_category_filters(queryset: QuerySet[ProductCategory], params) -> QuerySet[ProductCategory]:
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
    effective_price = obj.sale_price if obj.sale_price is not None else obj.price

    return {
        "id": obj.id,
        "product_id": obj.product_id,
        "name": obj.name,
        "price": str(obj.price),
        "sale_price": str(obj.sale_price) if obj.sale_price is not None else None,
        "effective_price": str(effective_price),
        "sort_order": obj.sort_order,
        "is_active": obj.is_active,
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
    }


def serialize_product(obj: Product, include_children: bool = True) -> dict[str, Any]:
    data = {
        "id": obj.id,
        "code": obj.code,
        "name": obj.name,
        "slug": obj.slug,
        "product_type": obj.product_type,
        "category_id": obj.category_id,
        "category": serialize_category(obj.category) if obj.category else None,
        "status": obj.status,
        "billing_type": obj.billing_type,
        "short_description": obj.short_description,
        "description": obj.description,
        "terms_and_conditions": obj.terms_and_conditions,
        "features": obj.features,
        "tags": obj.tags,
        "currency_code": obj.currency_code,
        "price": str(obj.price),
        "sale_price": str(obj.sale_price) if obj.sale_price is not None else None,
        "cost_price": str(obj.cost_price) if obj.cost_price is not None else None,
        "effective_price": str(obj.effective_price),
        "has_discount": obj.has_discount,
        "is_taxable": obj.is_taxable,
        "tax_rate": str(obj.tax_rate),
        "duration_value": obj.duration_value,
        "duration_unit": obj.duration_unit,
        "is_public": obj.is_public,
        "is_featured": obj.is_featured,
        "requires_approval": obj.requires_approval,
        "allow_online_purchase": obj.allow_online_purchase,
        "sort_order": obj.sort_order,
        "created_by_id": obj.created_by_id,
        "updated_by_id": obj.updated_by_id,
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
    }

    if include_children:
        data["benefits"] = [serialize_benefit(item) for item in obj.benefits.all().order_by("sort_order", "id")]
        data["pricing_tiers"] = [
            serialize_pricing_tier(item)
            for item in obj.pricing_tiers.all().order_by("sort_order", "id")
        ]

    return data


# ============================================================
# 🔹 Create / Update Category
# ============================================================

def create_category(*, payload: dict[str, Any], user) -> ProductCategory:
    category = ProductCategory(
        code=normalize_text(payload.get("code")).upper(),
        name=normalize_text(payload.get("name")),
        category_type=normalize_text(payload.get("category_type")) or ProductCategory.CategoryType.PROGRAM,
        status=normalize_text(payload.get("status")) or ProductCategory.Status.ACTIVE,
        description=normalize_text(payload.get("description")),
        sort_order=parse_int(payload.get("sort_order"), 0) or 0,
        created_by=user,
        updated_by=user,
    )
    category.full_clean()
    category.save()
    return category


def update_category(*, instance: ProductCategory, payload: dict[str, Any], user) -> ProductCategory:
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

    instance.updated_by = user
    instance.full_clean()
    instance.save()
    return instance


# ============================================================
# 🔹 Create / Update Product
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


def create_product(*, payload: dict[str, Any], user) -> Product:
    category = _resolve_category(payload)

    product = Product(
        name=normalize_text(payload.get("name")),
        product_type=normalize_text(payload.get("product_type")) or Product.ProductType.PROGRAM,
        category=category,
        status=normalize_text(payload.get("status")) or Product.Status.DRAFT,
        billing_type=normalize_text(payload.get("billing_type")) or Product.BillingType.ONE_TIME,
        short_description=normalize_text(payload.get("short_description")),
        description=normalize_text(payload.get("description")),
        terms_and_conditions=normalize_text(payload.get("terms_and_conditions")),
        features=normalize_text(payload.get("features")),
        tags=normalize_text(payload.get("tags")),
        currency_code=normalize_text(payload.get("currency_code"), "SAR").upper(),
        price=parse_decimal(payload.get("price"), Decimal("0.00")) or Decimal("0.00"),
        sale_price=parse_decimal(payload.get("sale_price")),
        cost_price=parse_decimal(payload.get("cost_price")),
        is_taxable=parse_bool(payload.get("is_taxable"), False) or False,
        tax_rate=parse_decimal(payload.get("tax_rate"), Decimal("0.00")) or Decimal("0.00"),
        duration_value=parse_int(payload.get("duration_value"), 0) or 0,
        duration_unit=normalize_text(payload.get("duration_unit")) or Product.DurationUnit.NONE,
        is_public=parse_bool(payload.get("is_public"), True) if payload.get("is_public") is not None else True,
        is_featured=parse_bool(payload.get("is_featured"), False) or False,
        requires_approval=parse_bool(payload.get("requires_approval"), False) or False,
        allow_online_purchase=parse_bool(payload.get("allow_online_purchase"), True)
        if payload.get("allow_online_purchase") is not None
        else True,
        sort_order=parse_int(payload.get("sort_order"), 0) or 0,
        created_by=user,
        updated_by=user,
    )

    if "slug" in payload and normalize_text(payload.get("slug")):
        product.slug = normalize_text(payload.get("slug"))

    if "code" in payload and normalize_text(payload.get("code")):
        product.code = normalize_text(payload.get("code")).upper()

    with transaction.atomic():
        product.full_clean()
        product.save()

        if "benefits" in payload:
            sync_product_benefits(product=product, items=payload.get("benefits") or [])

        if "pricing_tiers" in payload:
            sync_product_pricing_tiers(product=product, items=payload.get("pricing_tiers") or [])

    return product


def update_product(*, instance: Product, payload: dict[str, Any], user) -> Product:
    if "name" in payload:
        instance.name = normalize_text(payload.get("name"))

    if "product_type" in payload:
        instance.product_type = normalize_text(payload.get("product_type"))

    if "category_id" in payload:
        instance.category = _resolve_category(payload)

    if "status" in payload:
        instance.status = normalize_text(payload.get("status"))

    if "billing_type" in payload:
        instance.billing_type = normalize_text(payload.get("billing_type"))

    if "short_description" in payload:
        instance.short_description = normalize_text(payload.get("short_description"))

    if "description" in payload:
        instance.description = normalize_text(payload.get("description"))

    if "terms_and_conditions" in payload:
        instance.terms_and_conditions = normalize_text(payload.get("terms_and_conditions"))

    if "features" in payload:
        instance.features = normalize_text(payload.get("features"))

    if "tags" in payload:
        instance.tags = normalize_text(payload.get("tags"))

    if "currency_code" in payload:
        instance.currency_code = normalize_text(payload.get("currency_code"), "SAR").upper()

    if "price" in payload:
        instance.price = parse_decimal(payload.get("price"), Decimal("0.00")) or Decimal("0.00")

    if "sale_price" in payload:
        instance.sale_price = parse_decimal(payload.get("sale_price"))

    if "cost_price" in payload:
        instance.cost_price = parse_decimal(payload.get("cost_price"))

    if "is_taxable" in payload:
        instance.is_taxable = parse_bool(payload.get("is_taxable"), False) or False

    if "tax_rate" in payload:
        instance.tax_rate = parse_decimal(payload.get("tax_rate"), Decimal("0.00")) or Decimal("0.00")

    if "duration_value" in payload:
        instance.duration_value = parse_int(payload.get("duration_value"), 0) or 0

    if "duration_unit" in payload:
        instance.duration_unit = normalize_text(payload.get("duration_unit"))

    if "is_public" in payload:
        instance.is_public = parse_bool(payload.get("is_public"), instance.is_public)

    if "is_featured" in payload:
        instance.is_featured = parse_bool(payload.get("is_featured"), instance.is_featured)

    if "requires_approval" in payload:
        instance.requires_approval = parse_bool(payload.get("requires_approval"), instance.requires_approval)

    if "allow_online_purchase" in payload:
        instance.allow_online_purchase = parse_bool(
            payload.get("allow_online_purchase"),
            instance.allow_online_purchase,
        )

    if "sort_order" in payload:
        instance.sort_order = parse_int(payload.get("sort_order"), 0) or 0

    if "slug" in payload:
        instance.slug = normalize_text(payload.get("slug"))

    if "code" in payload:
        instance.code = normalize_text(payload.get("code")).upper()

    instance.updated_by = user

    with transaction.atomic():
        instance.full_clean()
        instance.save()

        if "benefits" in payload:
            sync_product_benefits(product=instance, items=payload.get("benefits") or [])

        if "pricing_tiers" in payload:
            sync_product_pricing_tiers(product=instance, items=payload.get("pricing_tiers") or [])

    return instance


# ============================================================
# 🔹 Nested Sync — Benefits
# ============================================================

def sync_product_benefits(*, product: Product, items: list[dict[str, Any]]) -> None:
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

        benefit = ProductBenefit.objects.create(
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

def sync_product_pricing_tiers(*, product: Product, items: list[dict[str, Any]]) -> None:
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
        price = parse_decimal(raw.get("price"), Decimal("0.00")) or Decimal("0.00")
        sale_price = parse_decimal(raw.get("sale_price"))
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
            tier.price = price
            tier.sale_price = sale_price
            tier.sort_order = sort_order
            tier.is_active = True if is_active is None else is_active
            tier.full_clean()
            tier.save()
            keep_ids.append(tier.id)
            continue

        if marked_delete:
            continue

        tier = ProductPricingTier.objects.create(
            product=product,
            name=name,
            price=price,
            sale_price=sale_price,
            sort_order=sort_order,
            is_active=True if is_active is None else is_active,
        )
        tier.full_clean()
        tier.save()
        keep_ids.append(tier.id)

    product.pricing_tiers.exclude(id__in=keep_ids).delete()