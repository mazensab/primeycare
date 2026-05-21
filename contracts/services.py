# ============================================================
# 📂 contracts/services.py
# 🧠 Primey Care | Contracts Services
# ------------------------------------------------------------
# ✅ Parsing / Validation / Serialization
# ✅ Filtering / Pagination
# ✅ Create / Update Contract
# ✅ Nested Contract Products Sync
# ✅ System Commission Percentage
# ✅ Provider Offers through ContractProduct
# ------------------------------------------------------------
# القاعدة المعتمدة:
# - Product = كتالوج ثابت
# - Contract = عقد مقدم الخدمة
# - ContractProduct = عرض/سعر/خصم المنتج حسب مقدم الخدمة والعقد
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

from contracts.models import Contract, ContractProduct, ContractStatus, PricingModel
from products.models import Product
from providers.models import Provider


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

    value_text = str(value).strip()

    if value_text.lower() in {"none", "null", "nan"}:
        return default

    return value_text


def parse_bool(value: Any, default: bool | None = None) -> bool | None:
    if value is None:
        return default

    if isinstance(value, bool):
        return value

    if isinstance(value, (int, float)):
        return bool(value)

    value_str = str(value).strip().lower()

    if value_str in {"1", "true", "yes", "on", "نعم", "صح"}:
        return True

    if value_str in {"0", "false", "no", "off", "لا", "خطأ"}:
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


def money(value: Any, default: Decimal | None = None) -> Decimal:
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


def percent(value: Any, default: Decimal | None = None) -> Decimal:
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

    if parsed > Decimal("100.00"):
        parsed = Decimal("100.00")

    return parsed.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def decimal_to_str(value: Any) -> str:
    return str(money(value))


def percent_to_str(value: Any) -> str:
    return str(percent(value))


def iso_date(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return str(value)


def parse_date_value(value: Any):
    if value in (None, ""):
        return None

    return value


def validate_percentage(value: Decimal, field_name: str) -> Decimal:
    if value < Decimal("0") or value > Decimal("100"):
        raise ValidationError(f"{field_name} must be between 0 and 100.")

    return value


def calculate_price_after_discount(
    *,
    price_before_discount: Decimal | None,
    discount_percentage: Decimal | None,
) -> Decimal | None:
    if price_before_discount is None:
        return None

    safe_before = money(price_before_discount)
    safe_discount = percent(discount_percentage or Decimal("0.00"))

    if safe_discount <= Decimal("0.00"):
        return safe_before

    discount_amount = (safe_before * safe_discount) / Decimal("100.00")
    return money(safe_before - discount_amount)


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


def apply_contract_filters(queryset: QuerySet[Contract], params) -> QuerySet[Contract]:
    q = normalize_text(params.get("q") or params.get("search"))
    status = normalize_text(params.get("status"))
    pricing_model = normalize_text(params.get("pricing_model"))
    provider_id = parse_int(params.get("provider_id"))
    product_id = parse_int(params.get("product_id"))

    show_on_landing = parse_bool(params.get("show_on_landing"))
    show_on_mobile = parse_bool(params.get("show_on_mobile"))
    show_on_offers = parse_bool(params.get("show_on_offers"))
    has_featured_offer = parse_bool(params.get("has_featured_offer"))
    has_active_offer = parse_bool(params.get("has_active_offer"))

    today = timezone.localdate()

    if q:
        queryset = queryset.filter(
            Q(title__icontains=q)
            | Q(contract_number__icontains=q)
            | Q(provider__name__icontains=q)
            | Q(provider__name_ar__icontains=q)
            | Q(provider__name_en__icontains=q)
            | Q(provider_contact_name__icontains=q)
            | Q(provider_contact_phone__icontains=q)
            | Q(provider_contact_email__icontains=q)
            | Q(notes__icontains=q)
            | Q(terms_and_conditions__icontains=q)
            | Q(contract_products__product__name__icontains=q)
            | Q(contract_products__offer_title__icontains=q)
            | Q(contract_products__offer_subtitle__icontains=q)
            | Q(contract_products__offer_badge__icontains=q)
        )

    if status:
        queryset = queryset.filter(status=status)

    if pricing_model:
        queryset = queryset.filter(pricing_model=pricing_model)

    if provider_id:
        queryset = queryset.filter(provider_id=provider_id)

    if product_id:
        queryset = queryset.filter(contract_products__product_id=product_id)

    if show_on_landing is not None:
        queryset = queryset.filter(contract_products__show_on_landing=show_on_landing)

    if show_on_mobile is not None:
        queryset = queryset.filter(contract_products__show_on_mobile=show_on_mobile)

    if show_on_offers is not None:
        queryset = queryset.filter(contract_products__show_on_offers=show_on_offers)

    if has_featured_offer is True:
        queryset = queryset.filter(contract_products__is_featured=True)

    if has_featured_offer is False:
        queryset = queryset.exclude(contract_products__is_featured=True)

    if has_active_offer is True:
        queryset = queryset.filter(
            contract_products__is_active=True,
            status=ContractStatus.ACTIVE,
        ).filter(
            Q(start_date__isnull=True) | Q(start_date__lte=today),
            Q(end_date__isnull=True) | Q(end_date__gte=today),
        )

    if has_active_offer is False:
        queryset = queryset.exclude(
            contract_products__is_active=True,
            status=ContractStatus.ACTIVE,
        )

    return queryset.distinct()


# ============================================================
# 🔹 Validation Helpers
# ============================================================

def _validate_status(value: str) -> str:
    allowed = {choice for choice, _ in ContractStatus.choices}

    if value not in allowed:
        raise ValidationError(f"Invalid status. Allowed values: {sorted(allowed)}")

    return value


def _validate_pricing_model(value: str) -> str:
    allowed = {choice for choice, _ in PricingModel.choices}

    if value not in allowed:
        raise ValidationError(f"Invalid pricing_model. Allowed values: {sorted(allowed)}")

    return value


def _resolve_provider(provider_id: Any) -> Provider:
    if provider_id in (None, "", 0, "0"):
        raise ValidationError("Provider is required.")

    try:
        return Provider.objects.get(pk=int(provider_id))
    except (Provider.DoesNotExist, TypeError, ValueError):
        raise ValidationError("Selected provider does not exist.")


def _resolve_product(product_id: Any) -> Product:
    if product_id in (None, "", 0, "0"):
        raise ValidationError("Product is required.")

    try:
        return Product.objects.get(pk=int(product_id))
    except (Product.DoesNotExist, TypeError, ValueError):
        raise ValidationError("Selected product does not exist.")


def _validate_unique_contract_number(contract_number: str, *, exclude_id: int | None = None) -> None:
    queryset = Contract.objects.filter(contract_number__iexact=contract_number)

    if exclude_id:
        queryset = queryset.exclude(pk=exclude_id)

    if queryset.exists():
        raise ValidationError("A contract with this contract number already exists.")


def _validate_product_allowed_for_contract(product: Product) -> None:
    if getattr(product, "status", "") != Product.Status.ACTIVE:
        raise ValidationError("Only active products can be linked to contracts.")

    if not getattr(product, "can_be_used_in_contracts", False):
        raise ValidationError("Selected product cannot be used in contracts.")


# ============================================================
# 🔹 Serialization
# ============================================================

def serialize_provider(provider: Provider | None) -> dict[str, Any] | None:
    if not provider:
        return None

    return {
        "id": provider.id,
        "code": getattr(provider, "code", ""),
        "name": getattr(provider, "name", ""),
        "name_ar": getattr(provider, "name_ar", ""),
        "name_en": getattr(provider, "name_en", ""),
        "display_name_ar": (
            getattr(provider, "display_name_ar", "")
            or getattr(provider, "name_ar", "")
            or getattr(provider, "name", "")
        ),
        "display_name_en": (
            getattr(provider, "display_name_en", "")
            or getattr(provider, "name_en", "")
            or getattr(provider, "name", "")
        ),
        "provider_type": getattr(provider, "provider_type", ""),
        "status": getattr(provider, "status", ""),
        "city": getattr(provider, "city", ""),
        "region": getattr(provider, "region", ""),
        "area": getattr(provider, "area", ""),
        "source_category": getattr(provider, "source_category", ""),
        "logo_url": getattr(provider, "logo_url", ""),
        "image_url": getattr(provider, "image_url", ""),
        "is_featured": getattr(provider, "is_featured", False),
    }


def serialize_product_summary(product: Product | None) -> dict[str, Any] | None:
    if not product:
        return None

    return {
        "id": product.id,
        "code": getattr(product, "code", ""),
        "name": getattr(product, "name", ""),
        "name_ar": getattr(product, "name", ""),
        "name_en": getattr(product, "name", ""),
        "title": getattr(product, "name", ""),
        "slug": getattr(product, "slug", ""),
        "product_type": getattr(product, "product_type", ""),
        "type": getattr(product, "product_type", ""),
        "status": getattr(product, "status", ""),
        "category_id": getattr(product, "category_id", None),
        "category_name": getattr(getattr(product, "category", None), "name", ""),
        "price": decimal_to_str(getattr(product, "price", Decimal("0.00"))),
        "sale_price": (
            decimal_to_str(getattr(product, "sale_price"))
            if getattr(product, "sale_price", None) is not None
            else None
        ),
        "effective_price": decimal_to_str(getattr(product, "effective_price", getattr(product, "price", Decimal("0.00")))),
        "price_before_discount": decimal_to_str(getattr(product, "price_before_discount", getattr(product, "price", Decimal("0.00")))),
        "price_after_discount": decimal_to_str(getattr(product, "price_after_discount", getattr(product, "effective_price", Decimal("0.00")))),
        "discount_percentage": percent_to_str(getattr(product, "discount_percentage", Decimal("0.00"))),
        "currency_code": getattr(product, "currency_code", "SAR"),
        "short_description": getattr(product, "short_description", ""),
        "description": getattr(product, "description", ""),
        "thumbnail_image_url": getattr(product, "thumbnail_image_url", ""),
        "marketing_image_url": getattr(product, "marketing_image_url", ""),
        "image_url": (
            getattr(product, "marketing_image_url", "")
            or getattr(product, "thumbnail_image_url", "")
        ),
        "has_duration": getattr(product, "has_duration", False),
        "duration_value": getattr(product, "duration_value", 0),
        "duration_unit": getattr(product, "duration_unit", ""),
        "has_expiry": getattr(product, "has_expiry", False),
        "valid_from": iso_date(getattr(product, "valid_from", None)),
        "valid_until": iso_date(getattr(product, "valid_until", None)),
        "is_card": getattr(product, "is_card", False),
        "is_medical_service": getattr(product, "is_medical_service", False),
        "is_service": getattr(product, "is_service", False),
        "is_program": getattr(product, "is_program", False),
        "is_catalog_product": getattr(product, "is_catalog_product", True),
        "can_be_ordered": getattr(product, "can_be_ordered", False),
        "can_be_used_in_contracts": getattr(product, "can_be_used_in_contracts", False),
        "requires_provider": getattr(product, "requires_provider", False),
    }


def serialize_contract_product(obj: ContractProduct) -> dict[str, Any]:
    product = obj.product if obj.product_id else None
    contract = obj.contract if obj.contract_id else None
    provider = contract.provider if contract and contract.provider_id else None

    price_before_discount = money(obj.effective_price_before_discount)
    price_after_discount = money(obj.effective_price_after_discount)
    discount_percentage = percent(obj.discount_percentage)
    discount_amount = money(price_before_discount - price_after_discount)

    image_url = (
        obj.marketing_image_url
        or getattr(product, "marketing_image_url", "")
        or getattr(product, "thumbnail_image_url", "")
        or getattr(provider, "image_url", "")
        or getattr(provider, "logo_url", "")
    )

    offer_title = (
        obj.offer_title
        or getattr(product, "offer_title", "")
        or getattr(product, "name", "")
    )

    offer_subtitle = (
        obj.offer_subtitle
        or getattr(product, "short_description", "")
        or getattr(product, "description", "")
    )

    return {
        "id": obj.id,
        "offer_id": obj.id,
        "contract_product_id": obj.id,
        "contract_id": obj.contract_id,
        "product_id": obj.product_id,
        "provider_id": getattr(provider, "id", None),

        "product": serialize_product_summary(product),
        "provider": serialize_provider(provider),

        "is_active": obj.is_active,
        "is_currently_available": obj.is_currently_available,
        "is_offer_date_valid": obj.is_offer_date_valid,

        "priority": obj.priority,
        "is_featured": obj.is_featured,
        "featured": obj.is_featured,

        "price_before_discount": decimal_to_str(price_before_discount),
        "price_after_discount": decimal_to_str(price_after_discount),
        "special_price": (
            decimal_to_str(obj.special_price)
            if obj.special_price is not None
            else None
        ),
        "discount_percentage": percent_to_str(discount_percentage),
        "discount_percent": percent_to_str(discount_percentage),
        "discount_rate": percent_to_str(discount_percentage),
        "discount_amount": decimal_to_str(discount_amount),

        "system_commission_percentage": (
            percent_to_str(obj.system_commission_percentage)
            if obj.system_commission_percentage is not None
            else None
        ),
        "effective_system_commission_percentage": percent_to_str(
            obj.effective_system_commission_percentage
        ),

        "coverage_notes": obj.coverage_notes,
        "terms": obj.terms,
        "usage_limit": obj.usage_limit,

        "offer_title": obj.offer_title,
        "offer_subtitle": obj.offer_subtitle,
        "offer_badge": obj.offer_badge,
        "offer_description": obj.offer_description,
        "offer_terms": obj.offer_terms,
        "offer_start_date": iso_date(obj.offer_start_date),
        "offer_end_date": iso_date(obj.offer_end_date),

        "name": offer_title,
        "title": offer_title,
        "title_ar": offer_title,
        "title_en": offer_title,
        "subtitle": offer_subtitle,
        "description": obj.offer_description or getattr(product, "description", ""),

        "show_on_landing": obj.show_on_landing,
        "show_in_landing": obj.show_on_landing,
        "show_on_mobile": obj.show_on_mobile,
        "show_on_offers": obj.show_on_offers,
        "show_in_offers": obj.show_on_offers,

        "marketing_image_url": obj.marketing_image_url,
        "marketing_image_alt_text": obj.marketing_image_alt_text,
        "image_url": image_url,
        "image": image_url,
        "thumbnail": getattr(product, "thumbnail_image_url", "") or image_url,
        "cover_image": image_url,

        "checkout_payload": {
            "offer_id": obj.id,
            "contract_product_id": obj.id,
            "contract_id": obj.contract_id,
            "product_id": obj.product_id,
            "provider_id": getattr(provider, "id", None),
            "price_before_discount": decimal_to_str(price_before_discount),
            "price_after_discount": decimal_to_str(price_after_discount),
            "discount_percentage": percent_to_str(discount_percentage),
        },

        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
    }


def serialize_contract(obj: Contract, include_products: bool = True) -> dict[str, Any]:
    provider_data = serialize_provider(obj.provider) if obj.provider_id else None

    data = {
        "id": obj.id,
        "provider_id": obj.provider_id,
        "provider": provider_data,
        "title": obj.title,
        "contract_number": obj.contract_number,
        "status": obj.status,
        "is_active": obj.is_active,
        "is_currently_valid": obj.is_currently_valid,
        "start_date": iso_date(obj.start_date),
        "end_date": iso_date(obj.end_date),
        "signed_at": iso_date(obj.signed_at),
        "provider_contact_name": obj.provider_contact_name,
        "provider_contact_phone": obj.provider_contact_phone,
        "provider_contact_email": obj.provider_contact_email,
        "pricing_model": obj.pricing_model,
        "discount_percentage": percent_to_str(obj.discount_percentage),
        "system_commission_percentage": percent_to_str(obj.system_commission_percentage),
        "notes": obj.notes,
        "terms_and_conditions": obj.terms_and_conditions,
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
    }

    if include_products:
        data["contract_products"] = [
            serialize_contract_product(item)
            for item in (
                obj.contract_products
                .select_related("product", "product__category", "contract", "contract__provider")
                .all()
                .order_by("priority", "-is_featured", "-created_at", "-id")
            )
        ]

        data["products_count"] = len(data["contract_products"])
        data["active_products_count"] = len(
            [item for item in data["contract_products"] if item.get("is_active")]
        )
        data["landing_offers_count"] = len(
            [item for item in data["contract_products"] if item.get("show_on_landing")]
        )
        data["mobile_offers_count"] = len(
            [item for item in data["contract_products"] if item.get("show_on_mobile")]
        )
        data["offers_page_count"] = len(
            [item for item in data["contract_products"] if item.get("show_on_offers")]
        )

    return data


# ============================================================
# 🔹 Create / Update Contract
# ============================================================

def create_contract(*, payload: dict[str, Any]) -> Contract:
    provider = _resolve_provider(payload.get("provider_id"))

    title = normalize_text(payload.get("title"))
    contract_number = normalize_text(payload.get("contract_number"))
    status = normalize_text(payload.get("status")) or ContractStatus.DRAFT
    pricing_model = normalize_text(payload.get("pricing_model")) or PricingModel.CUSTOM

    discount_percentage = parse_decimal(
        payload.get("discount_percentage"),
        Decimal("0"),
    ) or Decimal("0")

    system_commission_percentage = parse_decimal(
        payload.get("system_commission_percentage"),
        Decimal("0"),
    ) or Decimal("0")

    if not title:
        raise ValidationError("Contract title is required.")

    if not contract_number:
        raise ValidationError("Contract number is required.")

    status = _validate_status(status)
    pricing_model = _validate_pricing_model(pricing_model)

    validate_percentage(discount_percentage, "discount_percentage")
    validate_percentage(system_commission_percentage, "system_commission_percentage")

    _validate_unique_contract_number(contract_number)

    contract = Contract(
        provider=provider,
        title=title,
        contract_number=contract_number,
        status=status,
        start_date=parse_date_value(payload.get("start_date")),
        end_date=parse_date_value(payload.get("end_date")),
        signed_at=parse_date_value(payload.get("signed_at")),
        provider_contact_name=normalize_text(payload.get("provider_contact_name")),
        provider_contact_phone=normalize_text(payload.get("provider_contact_phone")),
        provider_contact_email=normalize_text(payload.get("provider_contact_email")),
        pricing_model=pricing_model,
        discount_percentage=discount_percentage,
        system_commission_percentage=system_commission_percentage,
        notes=normalize_text(payload.get("notes")),
        terms_and_conditions=normalize_text(payload.get("terms_and_conditions")),
    )

    with transaction.atomic():
        contract.full_clean()
        contract.save()

        if "contract_products" in payload:
            sync_contract_products(
                contract=contract,
                items=payload.get("contract_products") or [],
            )

    return contract


def update_contract(*, instance: Contract, payload: dict[str, Any]) -> Contract:
    if "provider_id" in payload:
        instance.provider = _resolve_provider(payload.get("provider_id"))

    if "title" in payload:
        instance.title = normalize_text(payload.get("title"))

    if "contract_number" in payload:
        instance.contract_number = normalize_text(payload.get("contract_number"))

    if "status" in payload:
        instance.status = normalize_text(payload.get("status"))

    if "start_date" in payload:
        instance.start_date = parse_date_value(payload.get("start_date"))

    if "end_date" in payload:
        instance.end_date = parse_date_value(payload.get("end_date"))

    if "signed_at" in payload:
        instance.signed_at = parse_date_value(payload.get("signed_at"))

    if "provider_contact_name" in payload:
        instance.provider_contact_name = normalize_text(payload.get("provider_contact_name"))

    if "provider_contact_phone" in payload:
        instance.provider_contact_phone = normalize_text(payload.get("provider_contact_phone"))

    if "provider_contact_email" in payload:
        instance.provider_contact_email = normalize_text(payload.get("provider_contact_email"))

    if "pricing_model" in payload:
        instance.pricing_model = normalize_text(payload.get("pricing_model"))

    if "discount_percentage" in payload:
        instance.discount_percentage = parse_decimal(
            payload.get("discount_percentage"),
            Decimal("0"),
        ) or Decimal("0")

    if "system_commission_percentage" in payload:
        instance.system_commission_percentage = parse_decimal(
            payload.get("system_commission_percentage"),
            Decimal("0"),
        ) or Decimal("0")

    if "notes" in payload:
        instance.notes = normalize_text(payload.get("notes"))

    if "terms_and_conditions" in payload:
        instance.terms_and_conditions = normalize_text(payload.get("terms_and_conditions"))

    if not instance.title:
        raise ValidationError("Contract title is required.")

    if not instance.contract_number:
        raise ValidationError("Contract number is required.")

    instance.status = _validate_status(instance.status)
    instance.pricing_model = _validate_pricing_model(instance.pricing_model)

    validate_percentage(instance.discount_percentage, "discount_percentage")
    validate_percentage(instance.system_commission_percentage, "system_commission_percentage")

    _validate_unique_contract_number(instance.contract_number, exclude_id=instance.id)

    with transaction.atomic():
        instance.full_clean()
        instance.save()

        if "contract_products" in payload:
            sync_contract_products(
                contract=instance,
                items=payload.get("contract_products") or [],
            )

    return instance


# ============================================================
# 🔹 Nested Sync — Contract Products
# ============================================================

def _build_contract_product_values(raw: dict[str, Any], product: Product) -> dict[str, Any]:
    is_active = parse_bool(raw.get("is_active"), True)
    marked_delete = parse_bool(raw.get("delete"), False) or False

    priority = parse_int(raw.get("priority"), 100)
    is_featured = parse_bool(raw.get("is_featured"), False)

    price_before_discount = parse_decimal(raw.get("price_before_discount"))
    discount_percentage = parse_decimal(
        raw.get("discount_percentage"),
        Decimal("0"),
    ) or Decimal("0")
    price_after_discount = parse_decimal(raw.get("price_after_discount"))
    special_price = parse_decimal(raw.get("special_price"))
    system_commission_percentage = parse_decimal(raw.get("system_commission_percentage"))

    validate_percentage(discount_percentage, "contract product discount_percentage")

    if system_commission_percentage is not None:
        validate_percentage(
            system_commission_percentage,
            "contract product system_commission_percentage",
        )

    if price_before_discount is not None and price_before_discount < Decimal("0"):
        raise ValidationError("Contract product price_before_discount cannot be negative.")

    if price_after_discount is not None and price_after_discount < Decimal("0"):
        raise ValidationError("Contract product price_after_discount cannot be negative.")

    if special_price is not None and special_price < Decimal("0"):
        raise ValidationError("Contract product special_price cannot be negative.")

    if price_after_discount is None and price_before_discount is not None:
        price_after_discount = calculate_price_after_discount(
            price_before_discount=price_before_discount,
            discount_percentage=discount_percentage,
        )

    if price_before_discount is None:
        product_price = getattr(product, "price_before_discount", None) or getattr(product, "price", None)
        price_before_discount = money(product_price) if product_price is not None else None

    if price_after_discount is None:
        product_after = getattr(product, "price_after_discount", None) or getattr(product, "effective_price", None)
        price_after_discount = money(product_after) if product_after is not None else None

    if special_price is None and price_after_discount is not None:
        special_price = price_after_discount

    if (
        price_before_discount is not None
        and price_after_discount is not None
        and price_after_discount > price_before_discount
    ):
        raise ValidationError("Contract product price_after_discount cannot be greater than price_before_discount.")

    return {
        "marked_delete": marked_delete,
        "product": product,
        "is_active": True if is_active is None else is_active,
        "priority": priority if priority is not None else 100,
        "is_featured": False if is_featured is None else is_featured,
        "price_before_discount": price_before_discount,
        "discount_percentage": discount_percentage,
        "price_after_discount": price_after_discount,
        "special_price": special_price,
        "system_commission_percentage": system_commission_percentage,
        "coverage_notes": normalize_text(raw.get("coverage_notes")),
        "terms": normalize_text(raw.get("terms")),
        "usage_limit": parse_int(raw.get("usage_limit")),
        "offer_title": normalize_text(raw.get("offer_title")),
        "offer_subtitle": normalize_text(raw.get("offer_subtitle")),
        "offer_badge": normalize_text(raw.get("offer_badge")),
        "offer_description": normalize_text(raw.get("offer_description")),
        "offer_terms": normalize_text(raw.get("offer_terms")),
        "offer_start_date": parse_date_value(raw.get("offer_start_date")),
        "offer_end_date": parse_date_value(raw.get("offer_end_date")),
        "show_on_landing": parse_bool(raw.get("show_on_landing"), False) or False,
        "show_on_mobile": parse_bool(raw.get("show_on_mobile"), False) or False,
        "show_on_offers": parse_bool(raw.get("show_on_offers"), False) or False,
        "marketing_image_url": normalize_text(raw.get("marketing_image_url")),
        "marketing_image_alt_text": normalize_text(raw.get("marketing_image_alt_text")),
    }


def sync_contract_products(*, contract: Contract, items: list[dict[str, Any]]) -> None:
    if not isinstance(items, list):
        raise ValidationError("contract_products must be a list.")

    existing_map = {
        item.id: item
        for item in contract.contract_products.select_related("product").all()
    }

    keep_ids: list[int] = []

    for raw in items:
        if not isinstance(raw, dict):
            raise ValidationError("Each contract product must be an object.")

        contract_product_id = raw.get("id")
        product = _resolve_product(raw.get("product_id"))
        _validate_product_allowed_for_contract(product)

        values = _build_contract_product_values(raw, product)
        marked_delete = values.pop("marked_delete")

        if contract_product_id:
            try:
                contract_product_id = int(contract_product_id)
            except (TypeError, ValueError):
                raise ValidationError("Invalid contract product id.")

            item = existing_map.get(contract_product_id)

            if not item:
                raise ValidationError(
                    f"Contract product id {contract_product_id} does not belong to this contract."
                )

            if marked_delete:
                item.delete()
                continue

            duplicate_qs = ContractProduct.objects.filter(
                contract=contract,
                product=product,
            ).exclude(pk=item.pk)

            if duplicate_qs.exists():
                raise ValidationError("This product is already linked to the contract.")

            for field_name, field_value in values.items():
                setattr(item, field_name, field_value)

            item.full_clean()
            item.save()
            keep_ids.append(item.id)
            continue

        if marked_delete:
            continue

        if ContractProduct.objects.filter(contract=contract, product=product).exists():
            raise ValidationError("This product is already linked to the contract.")

        item = ContractProduct(
            contract=contract,
            **values,
        )
        item.full_clean()
        item.save()
        keep_ids.append(item.id)

    # لا نحذف القديم تلقائيًا إلا إذا أرسل المستخدم قائمة كاملة.
    # السلوك السابق كان يضيف/يحدث/يحذف حسب delete فقط، ونحافظ عليه لتجنب فقد بيانات غير مقصود.