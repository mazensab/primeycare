# ============================================================
# 📂 api/products/list.py
# 🧭 Primey Care — Products API List/Create
# ------------------------------------------------------------
# ✅ Categories list/create
# ✅ Products list/create
# ✅ Public products list
# ============================================================

from __future__ import annotations

import logging

from django.core.exceptions import ValidationError
from django.db.models import Count
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from products.models import Product, ProductCategory
from products.services import (
    apply_category_filters,
    apply_product_filters,
    create_category,
    create_product,
    paginate_queryset,
    parse_int,
    parse_json_body,
    serialize_category,
    serialize_product,
)

logger = logging.getLogger(__name__)


# ============================================================
# 🔹 Internal Helpers
# ============================================================

def _json_error(message: str, status: int = 400, *, errors=None) -> JsonResponse:
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


# ============================================================
# 🔹 Categories API
# ============================================================

@require_http_methods(["GET", "POST"])
def product_categories_api(request):
    user, auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method == "GET":
        queryset = ProductCategory.objects.all().annotate(products_count=Count("products"))
        queryset = apply_category_filters(queryset, request.GET)

        page = parse_int(request.GET.get("page"), 1) or 1
        page_size = parse_int(request.GET.get("page_size"), 20) or 20

        paginated = paginate_queryset(queryset, page=page, page_size=page_size)

        return JsonResponse(
            {
                "ok": True,
                "message": "Product categories loaded successfully.",
                "results": [serialize_category(item) for item in paginated["items"]],
                "pagination": paginated["pagination"],
            },
            status=200,
        )

    try:
        payload = parse_json_body(request)
        category = create_category(payload=payload, user=user)

        return JsonResponse(
            {
                "ok": True,
                "message": "Product category created successfully.",
                "data": serialize_category(category),
            },
            status=201,
        )
    except ValidationError as exc:
        return _json_error("Validation failed while creating product category.", 400, errors=exc.messages)
    except Exception as exc:
        logger.exception("Failed to create product category: %s", exc)
        return _json_error("Unexpected error while creating product category.", 500)


# ============================================================
# 🔹 Products API
# ============================================================

@require_http_methods(["GET", "POST"])
def products_api(request):
    user, auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method == "GET":
        queryset = (
            Product.objects.select_related("category")
            .prefetch_related("benefits", "pricing_tiers")
            .all()
        )
        queryset = apply_product_filters(queryset, request.GET)

        page = parse_int(request.GET.get("page"), 1) or 1
        page_size = parse_int(request.GET.get("page_size"), 20) or 20

        paginated = paginate_queryset(queryset, page=page, page_size=page_size)

        return JsonResponse(
            {
                "ok": True,
                "message": "Products loaded successfully.",
                "results": [serialize_product(item) for item in paginated["items"]],
                "pagination": paginated["pagination"],
            },
            status=200,
        )

    try:
        payload = parse_json_body(request)
        product = create_product(payload=payload, user=user)

        return JsonResponse(
            {
                "ok": True,
                "message": "Product created successfully.",
                "data": serialize_product(product),
            },
            status=201,
        )
    except ValidationError as exc:
        return _json_error("Validation failed while creating product.", 400, errors=exc.messages)
    except Exception as exc:
        logger.exception("Failed to create product: %s", exc)
        return _json_error("Unexpected error while creating product.", 500)


# ============================================================
# 🔹 Public Products API
# ============================================================

@require_http_methods(["GET"])
def product_public_list_api(request):
    queryset = (
        Product.objects.select_related("category")
        .prefetch_related("benefits", "pricing_tiers")
        .filter(
            status=Product.Status.ACTIVE,
            is_public=True,
            allow_online_purchase=True,
        )
    )
    queryset = apply_product_filters(queryset, request.GET)

    page = parse_int(request.GET.get("page"), 1) or 1
    page_size = parse_int(request.GET.get("page_size"), 20) or 20

    paginated = paginate_queryset(queryset, page=page, page_size=page_size)

    return JsonResponse(
        {
            "ok": True,
            "message": "Public products loaded successfully.",
            "results": [serialize_product(item) for item in paginated["items"]],
            "pagination": paginated["pagination"],
        },
        status=200,
    )