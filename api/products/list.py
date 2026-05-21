# ============================================================
# 📂 api/products/list.py
# 🧭 Primey Care — Products Catalog API List/Create V2.7
# ------------------------------------------------------------
# ✅ Categories list/create
# ✅ Products catalog list/create
# ✅ Public products list
# ✅ Featured products list
# ✅ Landing products list
# ✅ Mobile products list
# ✅ General offers products list
# ✅ Contract-ready products list
# ✅ Best-selling sort support
# ✅ Unified response: ok / success / data / items / results
# ------------------------------------------------------------
# القاعدة المعتمدة:
# - Product = كتالوج ثابت
# - Product لا يرتبط بمقدم الخدمة في التطوير الجديد
# - Provider-specific offers/prices تأتي من ContractProduct
# - /api/offers/ هو مصدر عروض مقدمي الخدمة المبنية على ContractProduct
# - ContractProduct = سعر/خصم/عرض المنتج حسب مقدم الخدمة والعقد
# ------------------------------------------------------------
# ✅ Supports:
#    - Cards
#    - Medical Services
#    - Programs
#    - Services
#    - Memberships
#    - General Landing / Mobile / Offers marketing images
#    - Pricing Tiers
#    - Benefits
#    - Service Items
#    - Catalog checkout payload
# ============================================================

from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.core.exceptions import FieldError, ValidationError
from django.db.models import Count, IntegerField, Max, Q, QuerySet, Value
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from products.models import Product, ProductCategory
from products.services import (
    apply_category_filters,
    apply_product_filters,
    create_category,
    create_product,
    get_contract_products_queryset,
    get_featured_products_queryset,
    get_landing_products_queryset,
    get_mobile_products_queryset,
    get_offer_products_queryset,
    get_orderable_products_queryset,
    get_public_products_queryset,
    paginate_queryset,
    parse_bool,
    parse_int,
    parse_json_body,
    serialize_category,
    serialize_product,
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


def _ensure_authenticated(request):
    if not getattr(request, "user", None) or not request.user.is_authenticated:
        return None, _json_error("Authentication required.", 401)

    return request.user, None


def _validation_errors(exc: ValidationError):
    if hasattr(exc, "message_dict"):
        return exc.message_dict

    if hasattr(exc, "messages"):
        return exc.messages

    return [str(exc)]


def _include_children(request) -> bool:
    return parse_bool(request.GET.get("include_children"), True) is not False


def _safe_decimal(value: Any) -> Decimal:
    try:
        if value in (None, ""):
            return Decimal("0.00")

        parsed = Decimal(str(value))
    except Exception:
        return Decimal("0.00")

    if parsed < Decimal("0.00"):
        return Decimal("0.00")

    return parsed.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _decimal_str(value: Any) -> str:
    return str(_safe_decimal(value))


def _safe_int(value: Any) -> int:
    try:
        return int(value or 0)
    except Exception:
        return 0


# ============================================================
# 🔹 Contract / Offer Summary Helpers
# ------------------------------------------------------------
# هذه helpers لا تجعل المنتج تابعًا لمقدم خدمة.
# فقط تعطي مؤشرات أن المنتج موجود داخل عقود/عروض نشطة.
# التفاصيل الحقيقية لعروض مقدمي الخدمة تأتي من:
# /api/offers/
# ============================================================

def _active_contract_product_q() -> Q:
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


def annotate_product_offer_fields(queryset: QuerySet[Product]) -> QuerySet[Product]:
    """
    Adds lightweight annotations used by summaries and ordering.

    Product remains a fixed catalog item.
    ContractProduct remains the source of provider-specific offer details.
    """

    try:
        return queryset.annotate(
            active_contracts_count=Count(
                "product_contracts__contract",
                filter=_active_contract_product_q(),
                distinct=True,
            ),
            contracted_products_count=Count(
                "product_contracts",
                filter=_active_contract_product_q(),
                distinct=True,
            ),
            highest_contract_discount_percent=Max(
                "product_contracts__contract__discount_percentage",
                filter=_active_contract_product_q(),
            ),
            highest_product_discount_percent=Max(
                "product_contracts__discount_percentage",
                filter=_active_contract_product_q(),
            ),
            orders_count=Count(
                "orders",
                distinct=True,
            ),
        )
    except FieldError as exc:
        logger.warning("Unable to annotate product offer/order fields: %s", exc)

        return queryset.annotate(
            active_contracts_count=Value(0, output_field=IntegerField()),
            contracted_products_count=Value(0, output_field=IntegerField()),
            highest_contract_discount_percent=Value(0, output_field=IntegerField()),
            highest_product_discount_percent=Value(0, output_field=IntegerField()),
            orders_count=Value(0, output_field=IntegerField()),
        )


def _safe_count(queryset: QuerySet[Product], **filters) -> int:
    try:
        return queryset.filter(**filters).distinct().count()
    except Exception:
        return 0


def _safe_filter_count(queryset: QuerySet[Product], condition: Q) -> int:
    try:
        return queryset.filter(condition).distinct().count()
    except Exception:
        return 0


def _safe_highest_discount(queryset: QuerySet[Product]) -> Decimal:
    try:
        result = queryset.aggregate(
            highest_contract_discount=Max(
                "product_contracts__contract__discount_percentage",
                filter=_active_contract_product_q(),
            ),
            highest_product_discount=Max(
                "product_contracts__discount_percentage",
                filter=_active_contract_product_q(),
            ),
        )
    except Exception:
        result = {}

    contract_discount = _safe_decimal(result.get("highest_contract_discount"))
    product_discount = _safe_decimal(result.get("highest_product_discount"))

    return max(contract_discount, product_discount)


def _safe_max_orders_count(queryset: QuerySet[Product]) -> int:
    try:
        result = queryset.aggregate(max_orders_count=Max("orders_count"))
        return _safe_int(result.get("max_orders_count"))
    except Exception:
        return 0


def _catalog_available_q() -> Q:
    today = timezone.localdate()

    return (
        Q(status=Product.Status.ACTIVE)
        & Q(can_be_ordered=True)
        & (
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
    )


def _build_products_summary(queryset: QuerySet[Product]) -> dict[str, Any]:
    """
    Summary for dashboards, customer home, landing, offers, and mobile listings.

    Uses the already-filtered queryset, so each endpoint receives a relevant summary.
    """

    total_products = queryset.distinct().count()
    contracted_products = _safe_filter_count(queryset, _active_contract_product_q())
    highest_discount = _safe_highest_discount(queryset)
    max_orders_count = _safe_max_orders_count(queryset)

    return {
        "total_products": total_products,
        "active_products": _safe_count(queryset, status=Product.Status.ACTIVE),
        "draft_products": _safe_count(queryset, status=Product.Status.DRAFT),
        "inactive_products": _safe_count(queryset, status=Product.Status.INACTIVE),
        "archived_products": _safe_count(queryset, status=Product.Status.ARCHIVED),

        "public_products": _safe_count(queryset, is_public=True),
        "featured_products": _safe_count(queryset, is_featured=True),
        "offer_products": _safe_count(queryset, is_offer=True),
        "landing_products": _safe_count(queryset, show_on_landing=True),
        "mobile_products": _safe_count(queryset, show_on_mobile=True),
        "offers_page_products": _safe_count(queryset, show_on_offers=True),

        "cards_count": _safe_count(queryset, product_type=Product.ProductType.CARD),
        "medical_services_count": _safe_count(queryset, product_type=Product.ProductType.MEDICAL_SERVICE),
        "programs_count": _safe_count(queryset, product_type=Product.ProductType.PROGRAM),
        "services_count": _safe_count(queryset, product_type=Product.ProductType.SERVICE),
        "memberships_count": _safe_count(queryset, product_type=Product.ProductType.MEMBERSHIP),
        "other_products_count": _safe_count(queryset, product_type=Product.ProductType.OTHER),

        "products_with_duration": _safe_count(queryset, has_duration=True),
        "products_with_expiry": _safe_count(queryset, has_expiry=True),
        "available_for_order_products": _safe_filter_count(queryset, _catalog_available_q()),

        "catalog_products": _safe_filter_count(queryset, Q(provider__isnull=True)),
        "legacy_provider_products": _safe_filter_count(queryset, Q(provider__isnull=False)),

        "contracted_products": contracted_products,
        "products_with_active_contracts": contracted_products,

        "products_with_orders": _safe_filter_count(queryset, Q(orders_count__gt=0)),
        "best_selling_products": _safe_filter_count(queryset, Q(orders_count__gt=0)),
        "max_orders_count": max_orders_count,
        "orders_count_supported": True,

        "highest_discount_percent": _decimal_str(highest_discount),
        "max_discount_percent": _decimal_str(highest_discount),

        "currency": "SAR",
        "offers_endpoint": "/api/offers/",
    }


def _apply_product_ordering(queryset: QuerySet[Product], request) -> QuerySet[Product]:
    requested_ordering = (
        str(request.GET.get("ordering", "") or "").strip()
        or str(request.GET.get("order_by", "") or "").strip()
    )
    requested_sort = str(request.GET.get("sort", "") or "").strip().lower()

    if requested_sort in {"best_selling", "top_selling", "most_sold", "orders"}:
        return queryset.order_by(
            "-orders_count",
            "-created_at",
            "-id",
        )

    if requested_sort in {"highest_discount", "most_discount", "top_discount"}:
        return queryset.order_by(
            "-highest_product_discount_percent",
            "-highest_contract_discount_percent",
            "-discount_percentage",
            "-created_at",
            "-id",
        )

    if requested_sort in {"contracted", "active_contracts", "network"}:
        return queryset.order_by(
            "-active_contracts_count",
            "-contracted_products_count",
            "-created_at",
            "-id",
        )

    if requested_sort in {"cards", "card"}:
        return queryset.order_by(
            "product_type",
            "sort_order",
            "name",
            "id",
        )

    if requested_sort in {"medical_services", "medical_service", "services"}:
        return queryset.order_by(
            "product_type",
            "sort_order",
            "name",
            "id",
        )

    if requested_sort in {"duration", "with_duration"}:
        return queryset.order_by(
            "-has_duration",
            "-duration_value",
            "duration_unit",
            "name",
            "id",
        )

    if requested_sort in {"expiry", "ending_soon"}:
        return queryset.order_by(
            "-has_expiry",
            "valid_until",
            "name",
            "id",
        )

    if requested_sort in {"available", "orderable"}:
        return queryset.order_by(
            "-can_be_ordered",
            "-status",
            "sort_order",
            "name",
            "id",
        )

    if requested_sort == "newest":
        return queryset.order_by("-created_at", "-id")

    if requested_sort == "oldest":
        return queryset.order_by("created_at", "id")

    if requested_sort == "name":
        return queryset.order_by("name", "id")

    if requested_sort == "lowest_price":
        return queryset.order_by("price", "id")

    if requested_sort == "highest_price":
        return queryset.order_by("-price", "-id")

    if requested_ordering in {"highest_discount_percent", "discount_percent"}:
        return queryset.order_by(
            "highest_product_discount_percent",
            "highest_contract_discount_percent",
            "name",
            "id",
        )

    if requested_ordering in {"-highest_discount_percent", "-discount_percent"}:
        return queryset.order_by(
            "-highest_product_discount_percent",
            "-highest_contract_discount_percent",
            "-created_at",
            "-id",
        )

    allowed_ordering = {
        "name",
        "-name",
        "price",
        "-price",
        "sale_price",
        "-sale_price",
        "discount_percentage",
        "-discount_percentage",
        "created_at",
        "-created_at",
        "updated_at",
        "-updated_at",
        "sort_order",
        "-sort_order",
        "offer_start_date",
        "-offer_start_date",
        "offer_end_date",
        "-offer_end_date",
        "valid_from",
        "-valid_from",
        "valid_until",
        "-valid_until",
        "duration_value",
        "-duration_value",
        "active_contracts_count",
        "-active_contracts_count",
        "contracted_products_count",
        "-contracted_products_count",
        "highest_contract_discount_percent",
        "-highest_contract_discount_percent",
        "highest_product_discount_percent",
        "-highest_product_discount_percent",
        "orders_count",
        "-orders_count",
    }

    if requested_ordering in allowed_ordering:
        return queryset.order_by(requested_ordering, "-id")

    return queryset.order_by("sort_order", "-created_at", "-id")


def _base_product_queryset() -> QuerySet[Product]:
    """
    Base queryset for internal product APIs.

    provider is still selected only for legacy compatibility with serializers.
    New product-provider pricing must use ContractProduct.
    """

    return (
        Product.objects
        .select_related("category", "provider")
        .prefetch_related(
            "benefits",
            "pricing_tiers",
            "service_items",
        )
        .all()
    )


def _public_product_queryset(queryset: QuerySet[Product]) -> QuerySet[Product]:
    """
    Shared optimization for public/customer-facing product querysets.
    """

    return queryset.prefetch_related(
        "benefits",
        "pricing_tiers",
        "service_items",
    )


def _enhance_product_payload(
    product: Product,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """
    Ensures the frontend receives the new catalog/checkout fields even if
    products.services.serialize_product is older.
    """

    enhanced = dict(payload or {})

    orders_count = _safe_int(getattr(product, "orders_count", 0))
    active_contracts_count = _safe_int(getattr(product, "active_contracts_count", 0))
    contracted_products_count = _safe_int(getattr(product, "contracted_products_count", 0))

    highest_contract_discount = _safe_decimal(
        getattr(product, "highest_contract_discount_percent", Decimal("0.00"))
    )
    highest_product_discount = _safe_decimal(
        getattr(product, "highest_product_discount_percent", Decimal("0.00"))
    )

    highest_discount = max(highest_contract_discount, highest_product_discount)

    enhanced.update(
        {
            "id": product.id,
            "product_id": product.id,
            "code": product.code,
            "name": product.name,
            "slug": product.slug,
            "product_type": product.product_type,
            "category_id": product.category_id,
            "status": product.status,
            "currency_code": product.currency_code,

            "price_before_discount": _decimal_str(product.price_before_discount),
            "discount_percentage": _decimal_str(product.discount_percentage),
            "discount_amount": _decimal_str(product.discount_amount),
            "price_after_discount": _decimal_str(product.price_after_discount),
            "effective_price": _decimal_str(product.effective_price),
            "has_discount": product.has_discount,

            "orders_count": orders_count,
            "order_count": orders_count,
            "total_orders": orders_count,
            "sales_count": orders_count,
            "sold_count": orders_count,

            "active_contracts_count": active_contracts_count,
            "contracted_products_count": contracted_products_count,
            "products_with_active_contracts": active_contracts_count,
            "highest_contract_discount_percent": _decimal_str(highest_contract_discount),
            "highest_product_discount_percent": _decimal_str(highest_product_discount),
            "highest_discount_percent": _decimal_str(highest_discount),
            "max_discount_percent": _decimal_str(highest_discount),

            "is_catalog_product": product.is_catalog_product,
            "is_provider_product": product.is_provider_product,
            "legacy_provider_id": product.provider_id,
            "offers_endpoint": "/api/offers/",
            "provider_offers_endpoint": f"/api/offers/?product_id={product.id}",
        }
    )

    if hasattr(product, "catalog_payload"):
        enhanced["catalog_payload"] = product.catalog_payload

    if hasattr(product, "checkout_payload"):
        enhanced["checkout_payload"] = product.checkout_payload

    if product.requires_provider:
        enhanced["checkout_source"] = "offers"
        enhanced["checkout_note"] = "Use /api/offers/ with product_id to select provider-specific offer."

    else:
        enhanced["checkout_source"] = "product"

    return enhanced


def _serialize_product_list(
    items: list[Product],
    *,
    include_children: bool,
) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []

    for item in items:
        serialized = serialize_product(
            item,
            include_children=include_children,
        )
        output.append(
            _enhance_product_payload(
                product=item,
                payload=serialized,
            )
        )

    return output


def _paginated_product_response(
    *,
    queryset,
    request,
    message: str,
) -> JsonResponse:
    queryset = apply_product_filters(queryset, request.GET)
    queryset = annotate_product_offer_fields(queryset)
    queryset = _apply_product_ordering(queryset, request)

    page = parse_int(request.GET.get("page"), 1) or 1
    page_size = parse_int(request.GET.get("page_size"), 20) or 20
    include_children = _include_children(request)

    summary = _build_products_summary(queryset)

    paginated = paginate_queryset(
        queryset,
        page=page,
        page_size=page_size,
    )

    items = _serialize_product_list(
        paginated["items"],
        include_children=include_children,
    )

    return _json_success(
        {
            "items": items,
            "results": items,
            "pagination": paginated["pagination"],
            "summary": summary,
        },
        message=message,
        extra={
            # توافق خلفي مع الفرونت الحالي
            "items": items,
            "results": items,
            "pagination": paginated["pagination"],
            "summary": summary,
        },
    )


# ============================================================
# 🔹 Categories API
# ============================================================

@require_http_methods(["GET", "POST"])
def product_categories_api(request):
    user, auth_error = _ensure_authenticated(request)

    if auth_error:
        return auth_error

    if request.method == "GET":
        queryset = (
            ProductCategory.objects
            .all()
            .annotate(products_count=Count("products"))
        )

        queryset = apply_category_filters(queryset, request.GET)

        page = parse_int(request.GET.get("page"), 1) or 1
        page_size = parse_int(request.GET.get("page_size"), 20) or 20

        paginated = paginate_queryset(
            queryset,
            page=page,
            page_size=page_size,
        )

        items = [
            serialize_category(item)
            for item in paginated["items"]
        ]

        return _json_success(
            {
                "items": items,
                "results": items,
                "pagination": paginated["pagination"],
            },
            message="Product categories loaded successfully.",
            extra={
                # توافق خلفي مع الفرونت الحالي
                "items": items,
                "results": items,
                "pagination": paginated["pagination"],
            },
        )

    try:
        payload = parse_json_body(request)

        category = create_category(
            payload=payload,
            user=user,
        )

        serialized = serialize_category(category)

        return _json_success(
            {
                "category": serialized,
            },
            message="Product category created successfully.",
            status=201,
            extra={
                # توافق خلفي مع الفرونت الحالي
                "data": serialized,
                "category": serialized,
            },
        )

    except ValidationError as exc:
        return _json_error(
            "Validation failed while creating product category.",
            400,
            errors=_validation_errors(exc),
        )

    except Exception as exc:
        logger.exception("Failed to create product category: %s", exc)

        return _json_error(
            "Unexpected error while creating product category.",
            500,
        )


# ============================================================
# 🔹 Products API
# ============================================================

@require_http_methods(["GET", "POST"])
def products_api(request):
    user, auth_error = _ensure_authenticated(request)

    if auth_error:
        return auth_error

    if request.method == "GET":
        queryset = _base_product_queryset()

        return _paginated_product_response(
            queryset=queryset,
            request=request,
            message="Products loaded successfully.",
        )

    try:
        payload = parse_json_body(request)

        product = create_product(
            payload=payload,
            user=user,
        )

        product = (
            Product.objects
            .select_related("category", "provider")
            .prefetch_related(
                "benefits",
                "pricing_tiers",
                "service_items",
            )
            .get(pk=product.pk)
        )

        product = annotate_product_offer_fields(
            Product.objects.filter(pk=product.pk)
        ).select_related(
            "category",
            "provider",
        ).prefetch_related(
            "benefits",
            "pricing_tiers",
            "service_items",
        ).get(pk=product.pk)

        serialized = _enhance_product_payload(
            product=product,
            payload=serialize_product(product),
        )

        return _json_success(
            {
                "product": serialized,
            },
            message="Product created successfully.",
            status=201,
            extra={
                # توافق خلفي مع الفرونت الحالي
                "data": serialized,
                "product": serialized,
            },
        )

    except ValidationError as exc:
        return _json_error(
            "Validation failed while creating product.",
            400,
            errors=_validation_errors(exc),
        )

    except Exception as exc:
        logger.exception("Failed to create product: %s", exc)

        return _json_error(
            "Unexpected error while creating product.",
            500,
        )


# ============================================================
# 🔹 Public Products API
# ============================================================

@require_http_methods(["GET"])
def product_public_list_api(request):
    queryset = (
        _public_product_queryset(get_public_products_queryset())
        .filter(
            allow_online_purchase=True,
        )
    )

    return _paginated_product_response(
        queryset=queryset,
        request=request,
        message="Public products loaded successfully.",
    )


# ============================================================
# 🔹 Landing Products API
# ------------------------------------------------------------
# تستخدم في صفحة الهبوط وصفحة العميل الرئيسية للعروض العامة.
# عروض مقدم الخدمة المختلفة حسب العقد تأتي من /api/offers/.
# ============================================================

@require_http_methods(["GET"])
def product_landing_list_api(request):
    queryset = _public_product_queryset(
        get_landing_products_queryset()
    )

    return _paginated_product_response(
        queryset=queryset,
        request=request,
        message="Landing products loaded successfully.",
    )


# ============================================================
# 🔹 Mobile Products API
# ------------------------------------------------------------
# تستخدم لاحقًا في تطبيق الموبايل.
# عروض مقدم الخدمة المختلفة حسب العقد تأتي من /api/offers/.
# ============================================================

@require_http_methods(["GET"])
def product_mobile_list_api(request):
    queryset = _public_product_queryset(
        get_mobile_products_queryset()
    )

    return _paginated_product_response(
        queryset=queryset,
        request=request,
        message="Mobile products loaded successfully.",
    )


# ============================================================
# 🔹 General Offers Products API
# ------------------------------------------------------------
# هذه للعروض العامة الموجودة على Product نفسه.
# عروض مقدم الخدمة/العقد ليست هنا، بل في /api/offers/.
# ============================================================

@require_http_methods(["GET"])
def product_offers_list_api(request):
    queryset = _public_product_queryset(
        get_offer_products_queryset()
    )

    return _paginated_product_response(
        queryset=queryset,
        request=request,
        message="Offer products loaded successfully.",
    )


# ============================================================
# 🔹 Orderable Products API
# ------------------------------------------------------------
# للاستخدام داخل شاشة إنشاء الطلب.
# المنتجات الطبية قد تحتاج offer/contract_product عند الطلب الفعلي.
# استخدم /api/offers/?product_id=<id> لاختيار عرض مقدم الخدمة.
# ============================================================

@require_http_methods(["GET"])
def product_orderable_list_api(request):
    user, auth_error = _ensure_authenticated(request)

    if auth_error:
        return auth_error

    queryset = _public_product_queryset(
        get_orderable_products_queryset()
    )

    return _paginated_product_response(
        queryset=queryset,
        request=request,
        message="Orderable products loaded successfully.",
    )


# ============================================================
# 🔹 Contract Products Catalog API
# ------------------------------------------------------------
# للاستخدام داخل شاشة العقود لاختيار منتجات الكتالوج القابلة للإضافة للعقد.
# لا يرجع عروض مقدمي الخدمة، بل يرجع منتجات الكتالوج الصالحة للعقود.
# عروض مقدمي الخدمة نفسها في /api/offers/.
# ============================================================

@require_http_methods(["GET"])
def product_contract_list_api(request):
    user, auth_error = _ensure_authenticated(request)

    if auth_error:
        return auth_error

    queryset = _public_product_queryset(
        get_contract_products_queryset()
    )

    return _paginated_product_response(
        queryset=queryset,
        request=request,
        message="Contract-ready products loaded successfully.",
    )


# ============================================================
# 🔹 Featured Products API
# ============================================================

@require_http_methods(["GET"])
def product_featured_list_api(request):
    queryset = _public_product_queryset(
        get_featured_products_queryset()
    )

    return _paginated_product_response(
        queryset=queryset,
        request=request,
        message="Featured products loaded successfully.",
    )