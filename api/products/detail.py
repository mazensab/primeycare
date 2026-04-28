# ============================================================
# 📂 api/products/detail.py
# 🧭 Primey Care — Products & Programs API Detail/Update/Delete
# ------------------------------------------------------------
# ✅ Category detail/update/delete
# ✅ Product detail/update/delete
# ✅ Supports:
#    - Benefits
#    - Pricing Tiers
#    - Service Items
# ============================================================

from __future__ import annotations

import logging

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from products.models import Product, ProductCategory
from products.services import (
    parse_json_body,
    serialize_category,
    serialize_product,
    update_category,
    update_product,
)

logger = logging.getLogger(__name__)


# ============================================================
# 🔹 Internal Helpers
# ============================================================

def _json_error(
    message: str,
    status: int = 400,
    *,
    errors=None,
) -> JsonResponse:
    payload = {
        "ok": False,
        "message": message,
    }

    if errors is not None:
        payload["errors"] = errors

    return JsonResponse(payload, status=status)


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


def _product_queryset():
    return (
        Product.objects
        .select_related("category")
        .prefetch_related(
            "benefits",
            "pricing_tiers",
            "service_items",
        )
    )


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
        return JsonResponse(
            {
                "ok": True,
                "message": "Product category loaded successfully.",
                "data": serialize_category(category),
            },
            status=200,
        )

    if request.method == "PATCH":
        try:
            payload = parse_json_body(request)

            category = update_category(
                instance=category,
                payload=payload,
                user=user,
            )

            return JsonResponse(
                {
                    "ok": True,
                    "message": "Product category updated successfully.",
                    "data": serialize_category(category),
                },
                status=200,
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

    return JsonResponse(
        {
            "ok": True,
            "message": "Product category deleted successfully.",
        },
        status=200,
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
        return JsonResponse(
            {
                "ok": True,
                "message": "Product loaded successfully.",
                "data": serialize_product(product),
            },
            status=200,
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

            return JsonResponse(
                {
                    "ok": True,
                    "message": "Product updated successfully.",
                    "data": serialize_product(product),
                },
                status=200,
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

    product.delete()

    return JsonResponse(
        {
            "ok": True,
            "message": "Product deleted successfully.",
        },
        status=200,
    )