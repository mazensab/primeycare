# ============================================================
# 📂 api/offers/list.py
# 🧭 Primey Care — Provider Offers API List V2.8
# ------------------------------------------------------------
# ✅ يعرض عروض مقدمي الخدمة المبنية على ContractProduct
# ✅ Product = كتالوج ثابت
# ✅ ContractProduct = عرض/تسعير المنتج حسب عقد مقدم الخدمة
# ✅ مناسب لصفحة الهبوط والتطبيق وصفحة العروض والـ Checkout
# ✅ يرجع payload جاهز لإنشاء الطلب من offer_id
# ✅ يرجع payload جاهز لإنشاء OrderItem من offer_id
# ✅ يحول product_type إلى item_kind صحيح لعناصر الطلب
# ------------------------------------------------------------
# أمثلة:
# GET /api/offers/
# GET /api/offers/?show_on_landing=true
# GET /api/offers/?product_id=5
# GET /api/offers/?provider_id=8
# GET /api/offers/?product_type=medical_service
# GET /api/offers/?current=true
# GET /api/offers/?sort=highest_discount
# ============================================================

from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any

from django.core.paginator import Paginator
from django.db.models import Count, Max, Min, Q, QuerySet
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from contracts.models import ContractProduct, ContractStatus


# ============================================================
# 🔹 Parsing / Formatting Helpers
# ============================================================

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
        return Decimal(str(value).strip())
    except (InvalidOperation, AttributeError, TypeError, ValueError):
        return default


def normalize_text(value: Any, default: str = "") -> str:
    if value is None:
        return default

    value_str = str(value).strip()

    if value_str.lower() in {"none", "null", "nan"}:
        return default

    return value_str


def normalize_lower(value: Any, default: str = "") -> str:
    return normalize_text(value, default).lower()


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


def money_str(value: Any) -> str:
    return str(money(value))


def percent_str(value: Any) -> str:
    return str(percent(value))


def iso_date(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return str(value)


def iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return str(value)


def resolve_order_item_kind(product_type: Any) -> str:
    normalized = normalize_lower(product_type)

    if normalized in {"card", "cards", "membership", "membership_card"}:
        return "CARD"

    if normalized in {"medical_service", "service", "services"}:
        return "SERVICE"

    if normalized in {"program", "programs", "medical_program"}:
        return "PROGRAM"

    if normalized in {"subscription", "subscriptions", "plan", "plans"}:
        return "SUBSCRIPTION"

    return "PRODUCT"


# ============================================================
# 🔹 Query Helpers
# ============================================================

def product_active_q() -> Q:
    return Q(product__status__iexact="active")


def provider_active_q() -> Q:
    return (
        Q(contract__provider__status__isnull=True)
        | Q(contract__provider__status="")
        | Q(contract__provider__status__iexact="active")
        | Q(contract__provider__status__iexact="approved")
    )


def current_contract_offer_q() -> Q:
    today = timezone.localdate()

    return (
        Q(is_active=True)
        & Q(contract__status=ContractStatus.ACTIVE)
        & (
            Q(contract__start_date__isnull=True)
            | Q(contract__start_date__lte=today)
        )
        & (
            Q(contract__end_date__isnull=True)
            | Q(contract__end_date__gte=today)
        )
        & (
            Q(offer_start_date__isnull=True)
            | Q(offer_start_date__lte=today)
        )
        & (
            Q(offer_end_date__isnull=True)
            | Q(offer_end_date__gte=today)
        )
        & product_active_q()
        & provider_active_q()
    )


def base_offers_queryset() -> QuerySet[ContractProduct]:
    return (
        ContractProduct.objects
        .select_related(
            "contract",
            "contract__provider",
            "product",
            "product__category",
        )
        .filter(
            product__isnull=False,
            contract__isnull=False,
            contract__provider__isnull=False,
        )
    )


def apply_offer_filters(
    queryset: QuerySet[ContractProduct],
    params,
) -> QuerySet[ContractProduct]:
    q = normalize_text(params.get("q") or params.get("search"))

    product_id = parse_int(params.get("product_id"))
    provider_id = parse_int(params.get("provider_id"))
    contract_id = parse_int(params.get("contract_id"))
    category_id = parse_int(params.get("category_id"))

    product_type = normalize_text(params.get("product_type") or params.get("type"))
    contract_status = normalize_text(params.get("contract_status"))
    provider_status = normalize_text(params.get("provider_status"))
    product_status = normalize_text(params.get("product_status"))

    is_active = parse_bool(params.get("is_active"))
    current = parse_bool(params.get("current"), True)

    show_on_landing = parse_bool(
        params.get("show_on_landing"),
        parse_bool(params.get("show_in_landing")),
    )
    show_on_mobile = parse_bool(params.get("show_on_mobile"))
    show_on_offers = parse_bool(
        params.get("show_on_offers"),
        parse_bool(params.get("show_in_offers")),
    )
    is_featured = parse_bool(params.get("is_featured"))

    min_price = parse_decimal(params.get("min_price"))
    max_price = parse_decimal(params.get("max_price"))
    min_discount = parse_decimal(params.get("min_discount"))
    max_discount = parse_decimal(params.get("max_discount"))

    has_image = parse_bool(params.get("has_image"))
    has_duration = parse_bool(params.get("has_duration"))
    has_expiry = parse_bool(params.get("has_expiry"))

    region = normalize_text(params.get("region"))
    city = normalize_text(params.get("city"))
    source_category = normalize_text(params.get("source_category"))

    if q:
        queryset = queryset.filter(
            Q(product__name__icontains=q)
            | Q(product__code__icontains=q)
            | Q(product__short_description__icontains=q)
            | Q(product__description__icontains=q)
            | Q(product__category__name__icontains=q)
            | Q(product__category__code__icontains=q)
            | Q(contract__title__icontains=q)
            | Q(contract__contract_number__icontains=q)
            | Q(contract__provider__name__icontains=q)
            | Q(contract__provider__name_ar__icontains=q)
            | Q(contract__provider__name_en__icontains=q)
            | Q(contract__provider__code__icontains=q)
            | Q(contract__provider__city__icontains=q)
            | Q(contract__provider__region__icontains=q)
            | Q(offer_title__icontains=q)
            | Q(offer_subtitle__icontains=q)
            | Q(offer_badge__icontains=q)
            | Q(offer_description__icontains=q)
            | Q(offer_terms__icontains=q)
            | Q(coverage_notes__icontains=q)
            | Q(terms__icontains=q)
        )

    if current is True:
        queryset = queryset.filter(current_contract_offer_q())

    if current is False:
        queryset = queryset.exclude(current_contract_offer_q())

    if is_active is not None:
        queryset = queryset.filter(is_active=is_active)

    if product_id:
        queryset = queryset.filter(product_id=product_id)

    if provider_id:
        queryset = queryset.filter(contract__provider_id=provider_id)

    if contract_id:
        queryset = queryset.filter(contract_id=contract_id)

    if category_id:
        queryset = queryset.filter(product__category_id=category_id)

    if product_type:
        queryset = queryset.filter(product__product_type=product_type)

    if contract_status:
        queryset = queryset.filter(contract__status=contract_status)

    if provider_status:
        queryset = queryset.filter(contract__provider__status=provider_status)

    if product_status:
        queryset = queryset.filter(product__status=product_status)

    if show_on_landing is not None:
        queryset = queryset.filter(show_on_landing=show_on_landing)

    if show_on_mobile is not None:
        queryset = queryset.filter(show_on_mobile=show_on_mobile)

    if show_on_offers is not None:
        queryset = queryset.filter(show_on_offers=show_on_offers)

    if is_featured is not None:
        queryset = queryset.filter(is_featured=is_featured)

    if min_price is not None:
        queryset = queryset.filter(price_after_discount__gte=min_price)

    if max_price is not None:
        queryset = queryset.filter(price_after_discount__lte=max_price)

    if min_discount is not None:
        queryset = queryset.filter(discount_percentage__gte=min_discount)

    if max_discount is not None:
        queryset = queryset.filter(discount_percentage__lte=max_discount)

    if has_image is True:
        queryset = queryset.filter(
            Q(marketing_image_url__gt="")
            | Q(product__marketing_image_url__gt="")
            | Q(product__thumbnail_image_url__gt="")
            | Q(contract__provider__image_url__gt="")
            | Q(contract__provider__logo_url__gt="")
        )

    if has_image is False:
        queryset = queryset.filter(
            Q(marketing_image_url="")
            & Q(product__marketing_image_url="")
            & Q(product__thumbnail_image_url="")
            & Q(contract__provider__image_url="")
            & Q(contract__provider__logo_url="")
        )

    if has_duration is not None:
        queryset = queryset.filter(product__has_duration=has_duration)

    if has_expiry is not None:
        queryset = queryset.filter(product__has_expiry=has_expiry)

    if region:
        queryset = queryset.filter(contract__provider__region__icontains=region)

    if city:
        queryset = queryset.filter(contract__provider__city__icontains=city)

    if source_category:
        queryset = queryset.filter(contract__provider__source_category__icontains=source_category)

    return queryset.distinct()


def apply_offer_ordering(
    queryset: QuerySet[ContractProduct],
    params,
) -> QuerySet[ContractProduct]:
    requested_ordering = normalize_text(params.get("ordering") or params.get("order_by"))
    requested_sort = normalize_lower(params.get("sort"))

    if requested_sort in {"featured", "recommended"}:
        return queryset.order_by("-is_featured", "priority", "-created_at", "-id")

    if requested_sort in {"highest_discount", "most_discount", "top_discount"}:
        return queryset.order_by("-discount_percentage", "price_after_discount", "-created_at", "-id")

    if requested_sort in {"lowest_price", "cheapest"}:
        return queryset.order_by("price_after_discount", "price_before_discount", "priority", "id")

    if requested_sort in {"highest_price"}:
        return queryset.order_by("-price_after_discount", "-price_before_discount", "-created_at", "-id")

    if requested_sort in {"newest"}:
        return queryset.order_by("-created_at", "-id")

    if requested_sort in {"oldest"}:
        return queryset.order_by("created_at", "id")

    if requested_sort in {"ending_soon", "expiry"}:
        return queryset.order_by("offer_end_date", "priority", "-created_at", "-id")

    allowed_ordering = {
        "priority",
        "-priority",
        "created_at",
        "-created_at",
        "updated_at",
        "-updated_at",
        "price_before_discount",
        "-price_before_discount",
        "price_after_discount",
        "-price_after_discount",
        "special_price",
        "-special_price",
        "discount_percentage",
        "-discount_percentage",
        "offer_start_date",
        "-offer_start_date",
        "offer_end_date",
        "-offer_end_date",
        "product__name",
        "-product__name",
        "contract__provider__name",
        "-contract__provider__name",
        "contract__provider__city",
        "-contract__provider__city",
        "contract__provider__region",
        "-contract__provider__region",
    }

    if requested_ordering in allowed_ordering:
        return queryset.order_by(requested_ordering, "-id")

    return queryset.order_by("priority", "-is_featured", "-created_at", "-id")


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


# ============================================================
# 🔹 Serializers
# ============================================================

def serialize_provider(provider) -> dict[str, Any] | None:
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
        "street": getattr(provider, "street", ""),
        "source_category": getattr(provider, "source_category", ""),
        "logo_url": getattr(provider, "logo_url", ""),
        "image_url": getattr(provider, "image_url", ""),
        "is_featured": getattr(provider, "is_featured", False),
    }


def serialize_product_summary(product) -> dict[str, Any] | None:
    if not product:
        return None

    category = getattr(product, "category", None)

    catalog_payload = getattr(product, "catalog_payload", None)
    checkout_payload = getattr(product, "checkout_payload", None)

    return {
        "id": product.id,
        "product_id": product.id,
        "code": getattr(product, "code", ""),
        "name": getattr(product, "name", ""),
        "name_ar": getattr(product, "name", ""),
        "name_en": getattr(product, "name", ""),
        "title": getattr(product, "name", ""),
        "slug": getattr(product, "slug", ""),
        "product_type": getattr(product, "product_type", ""),
        "type": getattr(product, "product_type", ""),
        "category_id": getattr(product, "category_id", None),
        "category_name": getattr(category, "name", ""),
        "category_code": getattr(category, "code", ""),
        "short_description": getattr(product, "short_description", ""),
        "description": getattr(product, "description", ""),
        "thumbnail_image_url": getattr(product, "thumbnail_image_url", ""),
        "marketing_image_url": getattr(product, "marketing_image_url", ""),
        "marketing_image_alt_text": getattr(product, "marketing_image_alt_text", ""),
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
        "status": getattr(product, "status", ""),
        "is_card": getattr(product, "is_card", False),
        "is_medical_service": getattr(product, "is_medical_service", False),
        "is_service": getattr(product, "is_service", False),
        "is_program": getattr(product, "is_program", False),
        "catalog_payload": catalog_payload,
        "checkout_payload": checkout_payload,
        "offers_endpoint": "/api/offers/",
        "provider_offers_endpoint": f"/api/offers/?product_id={product.id}",
    }


def serialize_contract(contract) -> dict[str, Any] | None:
    if not contract:
        return None

    return {
        "id": contract.id,
        "contract_number": getattr(contract, "contract_number", ""),
        "title": getattr(contract, "title", ""),
        "status": getattr(contract, "status", ""),
        "provider_id": getattr(contract, "provider_id", None),
        "start_date": iso_date(getattr(contract, "start_date", None)),
        "end_date": iso_date(getattr(contract, "end_date", None)),
        "pricing_model": getattr(contract, "pricing_model", ""),
        "discount_percentage": percent_str(getattr(contract, "discount_percentage", Decimal("0.00"))),
        "system_commission_percentage": percent_str(
            getattr(contract, "system_commission_percentage", Decimal("0.00"))
        ),
        "is_currently_valid": getattr(contract, "is_currently_valid", False),
    }


def build_order_payload(
    obj: ContractProduct,
    *,
    price_before_discount: Decimal,
    price_after_discount: Decimal,
) -> dict[str, Any]:
    product = obj.product
    contract = obj.contract
    provider = contract.provider if contract else None

    discount_amount = money(price_before_discount - price_after_discount)

    return {
        "offer_id": obj.id,
        "contract_product_id": obj.id,
        "product_id": obj.product_id,
        "provider_id": getattr(provider, "id", None),
        "contract_id": obj.contract_id,
        "offer_source": "contract_product",
        "offer_title": obj.offer_title or getattr(product, "offer_title", "") or getattr(product, "name", ""),
        "offer_badge": obj.offer_badge,
        "order_kind": getattr(product, "product_type", "") or "general",
        "payment_method": "none",
        "quantity": 1,
        "currency_code": getattr(product, "currency_code", "SAR") or "SAR",
        "unit_price_before_discount": money_str(price_before_discount),
        "unit_discount_percentage": percent_str(obj.discount_percentage),
        "unit_price": money_str(price_after_discount),
        "discount_amount": money_str(discount_amount),
        "total_amount": money_str(price_after_discount),
        "source": "website",
        "checkout_source": "offers",
    }


def build_order_item_payload(
    obj: ContractProduct,
    *,
    price_before_discount: Decimal,
    price_after_discount: Decimal,
) -> dict[str, Any]:
    product = obj.product
    contract = obj.contract
    provider = contract.provider if contract else None

    discount_amount = money(price_before_discount - price_after_discount)
    product_type = getattr(product, "product_type", "") or ""

    return {
        "offer_id": obj.id,
        "contract_product_id": obj.id,
        "product_id": obj.product_id,
        "provider_id": getattr(provider, "id", None),
        "contract_id": obj.contract_id,
        "service_item_id": None,
        "offer_source": "CONTRACT_PRODUCT",
        "offer_title": obj.offer_title or getattr(product, "offer_title", "") or getattr(product, "name", ""),
        "offer_badge": obj.offer_badge,
        "item_kind": resolve_order_item_kind(product_type),
        "title": obj.offer_title or getattr(product, "name", "") or f"Offer #{obj.id}",
        "quantity": 1,
        "currency_code": getattr(product, "currency_code", "SAR") or "SAR",
        "unit_price_before_discount": money_str(price_before_discount),
        "unit_discount_percentage": percent_str(obj.discount_percentage),
        "unit_price": money_str(price_after_discount),
        "discount_percentage": percent_str(obj.discount_percentage),
        "discount_amount": money_str(discount_amount),
    }


def serialize_offer(obj: ContractProduct) -> dict[str, Any]:
    product = obj.product
    contract = obj.contract
    provider = contract.provider if contract else None

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

    checkout_payload = {
        "offer_id": obj.id,
        "contract_product_id": obj.id,
        "contract_id": obj.contract_id,
        "product_id": obj.product_id,
        "provider_id": getattr(provider, "id", None),
        "offer_source": "contract_product",
        "offer_title": offer_title,
        "offer_badge": obj.offer_badge,
        "price_before_discount": money_str(price_before_discount),
        "price_after_discount": money_str(price_after_discount),
        "discount_percentage": percent_str(discount_percentage),
        "discount_amount": money_str(discount_amount),
        "unit_price_before_discount": money_str(price_before_discount),
        "unit_discount_percentage": percent_str(discount_percentage),
        "unit_price": money_str(price_after_discount),
        "currency_code": getattr(product, "currency_code", "SAR") or "SAR",
        "checkout_source": "offers",
    }

    order_payload = build_order_payload(
        obj,
        price_before_discount=price_before_discount,
        price_after_discount=price_after_discount,
    )

    order_item_payload = build_order_item_payload(
        obj,
        price_before_discount=price_before_discount,
        price_after_discount=price_after_discount,
    )

    return {
        "id": obj.id,
        "offer_id": obj.id,
        "contract_product_id": obj.id,

        "contract_id": obj.contract_id,
        "product_id": obj.product_id,
        "provider_id": getattr(provider, "id", None),

        "contract": serialize_contract(contract),
        "product": serialize_product_summary(product),
        "provider": serialize_provider(provider),

        "name": offer_title,
        "title": offer_title,
        "title_ar": offer_title,
        "title_en": offer_title,
        "subtitle": offer_subtitle,
        "description": obj.offer_description or getattr(product, "description", ""),
        "short_description": offer_subtitle,

        "product_name": getattr(product, "name", ""),
        "product_type": getattr(product, "product_type", ""),
        "item_kind": resolve_order_item_kind(getattr(product, "product_type", "")),
        "provider_name": getattr(provider, "name", "") if provider else "",
        "provider_name_ar": getattr(provider, "name_ar", "") if provider else "",
        "provider_name_en": getattr(provider, "name_en", "") if provider else "",
        "provider_display_name": (
            getattr(provider, "name_ar", "")
            or getattr(provider, "name", "")
            if provider
            else ""
        ),

        "currency_code": getattr(product, "currency_code", "SAR") or "SAR",
        "currency": getattr(product, "currency_code", "SAR") or "SAR",

        "price": money_str(price_after_discount),
        "amount": money_str(price_after_discount),
        "base_price": money_str(price_before_discount),
        "original_price": money_str(price_before_discount),
        "price_before_discount": money_str(price_before_discount),
        "unit_price_before_discount": money_str(price_before_discount),
        "price_after_discount": money_str(price_after_discount),
        "unit_price": money_str(price_after_discount),
        "discounted_price": money_str(price_after_discount),
        "final_price": money_str(price_after_discount),
        "special_price": money_str(obj.special_price) if obj.special_price is not None else None,

        "discount_percentage": percent_str(discount_percentage),
        "unit_discount_percentage": percent_str(discount_percentage),
        "discount_percent": percent_str(discount_percentage),
        "discount_rate": percent_str(discount_percentage),
        "discount_amount": money_str(discount_amount),
        "has_discount": price_after_discount < price_before_discount,

        "system_commission_percentage": (
            percent_str(obj.system_commission_percentage)
            if obj.system_commission_percentage is not None
            else None
        ),
        "effective_system_commission_percentage": percent_str(
            obj.effective_system_commission_percentage
        ),

        "coverage_notes": obj.coverage_notes,
        "terms": obj.terms,
        "usage_limit": obj.usage_limit,

        "offer_source": "contract_product",
        "offer_title": obj.offer_title,
        "offer_subtitle": obj.offer_subtitle,
        "offer_badge": obj.offer_badge,
        "offer_description": obj.offer_description,
        "offer_terms": obj.offer_terms,
        "offer_start_date": iso_date(obj.offer_start_date),
        "offer_end_date": iso_date(obj.offer_end_date),

        "image_url": image_url,
        "image": image_url,
        "thumbnail": getattr(product, "thumbnail_image_url", "") or image_url,
        "cover_image": image_url,
        "marketing_image_url": obj.marketing_image_url or getattr(product, "marketing_image_url", ""),
        "marketing_image_alt_text": obj.marketing_image_alt_text or getattr(product, "marketing_image_alt_text", ""),

        "is_active": obj.is_active,
        "is_featured": obj.is_featured,
        "featured": obj.is_featured,
        "priority": obj.priority,

        "show_on_landing": obj.show_on_landing,
        "show_in_landing": obj.show_on_landing,
        "show_on_mobile": obj.show_on_mobile,
        "show_on_offers": obj.show_on_offers,
        "show_in_offers": obj.show_on_offers,

        "is_currently_available": obj.is_currently_available,
        "is_offer_date_valid": obj.is_offer_date_valid,

        "checkout_source": "offers",
        "checkout_payload": checkout_payload,
        "order_payload": order_payload,
        "order_item_payload": order_item_payload,

        "created_at": iso_datetime(obj.created_at),
        "updated_at": iso_datetime(obj.updated_at),
    }


def build_summary(queryset: QuerySet[ContractProduct]) -> dict[str, Any]:
    try:
        aggregate = queryset.aggregate(
            min_price=Min("price_after_discount"),
            max_price=Max("price_after_discount"),
            max_discount=Max("discount_percentage"),
            current_offers=Count("id", filter=current_contract_offer_q()),
        )
    except Exception:
        aggregate = {}

    return {
        "total_offers": queryset.count(),
        "current_offers": aggregate.get("current_offers") or 0,
        "active_offers": queryset.filter(is_active=True).count(),
        "featured_offers": queryset.filter(is_featured=True).count(),
        "landing_offers": queryset.filter(show_on_landing=True).count(),
        "mobile_offers": queryset.filter(show_on_mobile=True).count(),
        "offers_page_offers": queryset.filter(show_on_offers=True).count(),
        "products_count": queryset.values("product_id").distinct().count(),
        "providers_count": queryset.values("contract__provider_id").distinct().count(),
        "contracts_count": queryset.values("contract_id").distinct().count(),
        "min_price": money_str(aggregate.get("min_price")),
        "max_price": money_str(aggregate.get("max_price")),
        "max_discount_percentage": percent_str(aggregate.get("max_discount")),
        "currency": "SAR",
        "checkout_source": "offers",
    }


# ============================================================
# 🔹 API View
# ============================================================

@require_http_methods(["GET"])
def offers_list_api(request):
    queryset = base_offers_queryset()
    queryset = apply_offer_filters(queryset, request.GET)
    queryset = apply_offer_ordering(queryset, request.GET)

    page = parse_int(request.GET.get("page"), 1) or 1
    page_size = parse_int(request.GET.get("page_size"), 20) or 20

    summary = build_summary(queryset)

    paginated = paginate_queryset(
        queryset,
        page=page,
        page_size=page_size,
    )

    results = [
        serialize_offer(item)
        for item in paginated["items"]
    ]

    return JsonResponse(
        {
            "ok": True,
            "success": True,
            "message": "Offers loaded successfully.",
            "data": {
                "items": results,
                "results": results,
                "pagination": paginated["pagination"],
                "summary": summary,
            },
            "items": results,
            "results": results,
            "pagination": paginated["pagination"],
            "summary": summary,
        },
        status=200,
        json_dumps_params={"ensure_ascii": False},
    )