# ============================================================
# 📂 api/products/detail.py
# 🧭 Primey Care — Products Catalog API Detail/Update/Delete V2.7
# ------------------------------------------------------------
# ✅ Category detail/update/delete
# ✅ Product detail/update/archive
# ✅ Product = كتالوج ثابت
# ✅ Provider link داخل Product للتوافق القديم فقط
# ✅ Provider-specific offers/prices تكون داخل ContractProduct
# ✅ /api/offers/ هو مصدر عروض مقدمي الخدمة
# ✅ يرجع catalog_payload / checkout_payload
# ✅ يرجع orders_count ومؤشرات العقود والعروض
# ✅ Unified response: ok / success / data / product / category
# ------------------------------------------------------------
# ✅ Supports:
#    - Cards
#    - Medical Services
#    - Programs
#    - Memberships
#    - Landing / Mobile / Offers marketing fields
#    - Benefits
#    - Pricing Tiers
#    - Service Items
# ============================================================

from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.core.exceptions import FieldError, ValidationError
from django.db.models import Count, IntegerField, Max, Q, Value
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from products.models import Product, ProductCategory
from products.services import (
    parse_bool,
    parse_json_body,
    serialize_category,
    serialize_product,
    update_category,
    update_product,
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
# 🔹 Product Annotation Helpers
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


def _product_queryset():
    queryset = (
        Product.objects
        .select_related("category", "provider")
        .prefetch_related(
            "benefits",
            "pricing_tiers",
            "service_items",
        )
    )

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
        logger.warning("Unable to annotate product detail queryset: %s", exc)

        return queryset.annotate(
            active_contracts_count=Value(0, output_field=IntegerField()),
            contracted_products_count=Value(0, output_field=IntegerField()),
            highest_contract_discount_percent=Value(0, output_field=IntegerField()),
            highest_product_discount_percent=Value(0, output_field=IntegerField()),
            orders_count=Value(0, output_field=IntegerField()),
        )


def _enhance_product_payload(
    product: Product,
    payload: dict[str, Any],
) -> dict[str, Any]:
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


def _serialize_product_detail(product: Product) -> dict[str, Any]:
    return _enhance_product_payload(
        product=product,
        payload=serialize_product(product),
    )


def _has_contract_links(product: Product) -> bool:
    try:
        return product.product_contracts.exists()
    except Exception:
        return False


def _archive_product(product: Product, user) -> Product:
    product.status = Product.Status.ARCHIVED
    product.can_be_ordered = False
    product.is_public = False
    product.show_on_landing = False
    product.show_on_mobile = False
    product.show_on_offers = False
    product.updated_by = user if getattr(user, "is_authenticated", False) else None
    product.save(
        update_fields=[
            "status",
            "can_be_ordered",
            "is_public",
            "show_on_landing",
            "show_on_mobile",
            "show_on_offers",
            "updated_by",
            "updated_at",
        ]
    )
    return product


def _category_products_count(category: ProductCategory) -> int:
    try:
        return category.products.count()
    except Exception:
        return 0


def _serialize_category_detail(category: ProductCategory) -> dict[str, Any]:
    payload = serialize_category(category)
    payload["products_count"] = _category_products_count(category)
    return payload


# ============================================================
# 🔹 Category Detail API
# ============================================================

@require_http_methods(["GET", "PATCH", "DELETE"])
def product_category_detail_api(request, category_id: int):
    user, auth_error = _ensure_authenticated(request)

    if auth_error:
        return auth_error

    category = get_object_or_404(ProductCategory, pk=category_id)

    if request.method == "GET":
        serialized = _serialize_category_detail(category)

        return _json_success(
            {
                "category": serialized,
            },
            message="Product category loaded successfully.",
            extra={
                # توافق خلفي مع الفرونت الحالي
                "data": serialized,
                "category": serialized,
            },
        )

    if request.method == "PATCH":
        try:
            payload = parse_json_body(request)

            category = update_category(
                instance=category,
                payload=payload,
                user=user,
            )

            serialized = _serialize_category_detail(category)

            return _json_success(
                {
                    "category": serialized,
                },
                message="Product category updated successfully.",
                extra={
                    # توافق خلفي مع الفرونت الحالي
                    "data": serialized,
                    "category": serialized,
                },
            )

        except ValidationError as exc:
            return _json_error(
                "Validation failed while updating product category.",
                400,
                errors=_validation_errors(exc),
            )

        except Exception as exc:
            logger.exception(
                "Failed to update product category %s: %s",
                category_id,
                exc,
            )

            return _json_error(
                "Unexpected error while updating product category.",
                500,
            )

    if category.products.exists():
        return _json_error(
            "Cannot delete category because it still has linked products.",
            400,
        )

    category.delete()

    return _json_success(
        {
            "deleted": True,
            "category_id": category_id,
        },
        message="Product category deleted successfully.",
    )


# ============================================================
# 🔹 Product Detail API
# ============================================================

@require_http_methods(["GET", "PATCH", "DELETE"])
def product_detail_api(request, product_id: int):
    user, auth_error = _ensure_authenticated(request)

    if auth_error:
        return auth_error

    product = get_object_or_404(
        _product_queryset(),
        pk=product_id,
    )

    if request.method == "GET":
        serialized = _serialize_product_detail(product)

        return _json_success(
            {
                "product": serialized,
            },
            message="Product loaded successfully.",
            extra={
                # توافق خلفي مع الفرونت الحالي
                "data": serialized,
                "product": serialized,
            },
        )

    if request.method == "PATCH":
        try:
            payload = parse_json_body(request)

            product = update_product(
                instance=product,
                payload=payload,
                user=user,
            )

            product = _product_queryset().get(pk=product.pk)
            serialized = _serialize_product_detail(product)

            return _json_success(
                {
                    "product": serialized,
                },
                message="Product updated successfully.",
                extra={
                    # توافق خلفي مع الفرونت الحالي
                    "data": serialized,
                    "product": serialized,
                },
            )

        except ValidationError as exc:
            return _json_error(
                "Validation failed while updating product.",
                400,
                errors=_validation_errors(exc),
            )

        except Exception as exc:
            logger.exception(
                "Failed to update product %s: %s",
                product_id,
                exc,
            )

            return _json_error(
                "Unexpected error while updating product.",
                500,
            )

    force_delete = parse_bool(request.GET.get("force_delete"), False) is True
    has_contract_links = _has_contract_links(product)

    if has_contract_links and force_delete:
        return _json_error(
            "Cannot permanently delete product because it is linked to contracts. Archive it instead.",
            400,
        )

    if has_contract_links or not force_delete:
        product = _archive_product(product, user)
        product = _product_queryset().get(pk=product.pk)
        serialized = _serialize_product_detail(product)

        return _json_success(
            {
                "product": serialized,
                "archived": True,
                "deleted": False,
                "has_contract_links": has_contract_links,
            },
            message="Product archived successfully.",
            extra={
                # توافق خلفي مع الفرونت الحالي
                "data": serialized,
                "product": serialized,
            },
        )

    product.delete()

    return _json_success(
        {
            "deleted": True,
            "archived": False,
            "product_id": product_id,
        },
        message="Product deleted successfully.",
    )