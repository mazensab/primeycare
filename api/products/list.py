# ============================================================
# 📂 api/products/list.py
# 🧭 Primey Care — Products & Programs API List/Create
# ------------------------------------------------------------
# ✅ Categories list/create
# ✅ Products list/create
# ✅ Public products list
# ✅ Supports:
#    - Cards
#    - Programs
#    - Services
#    - Memberships
#    - Pricing Tiers
#    - Benefits
#    - Service Items
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
    get_contract_products_queryset,
    get_featured_products_queryset,
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


def _include_children(request) -> bool:
    return parse_bool(request.GET.get("include_children"), True) is not False


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

        return JsonResponse(
            {
                "ok": True,
                "message": "Product categories loaded successfully.",
                "results": [
                    serialize_category(item)
                    for item in paginated["items"]
                ],
                "pagination": paginated["pagination"],
            },
            status=200,
        )

    try:
        payload = parse_json_body(request)

        category = create_category(
            payload=payload,
            user=user,
        )

        return JsonResponse(
            {
                "ok": True,
                "message": "Product category created successfully.",
                "data": serialize_category(category),
            },
            status=201,
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
        queryset = (
            Product.objects
            .select_related("category")
            .prefetch_related(
                "benefits",
                "pricing_tiers",
                "service_items",
            )
            .all()
        )

        queryset = apply_product_filters(queryset, request.GET)

        page = parse_int(request.GET.get("page"), 1) or 1
        page_size = parse_int(request.GET.get("page_size"), 20) or 20
        include_children = _include_children(request)

        paginated = paginate_queryset(
            queryset,
            page=page,
            page_size=page_size,
        )

        return JsonResponse(
            {
                "ok": True,
                "message": "Products loaded successfully.",
                "results": [
                    serialize_product(
                        item,
                        include_children=include_children,
                    )
                    for item in paginated["items"]
                ],
                "pagination": paginated["pagination"],
            },
            status=200,
        )

    try:
        payload = parse_json_body(request)

        product = create_product(
            payload=payload,
            user=user,
        )

        product = (
            Product.objects
            .select_related("category")
            .prefetch_related(
                "benefits",
                "pricing_tiers",
                "service_items",
            )
            .get(pk=product.pk)
        )

        return JsonResponse(
            {
                "ok": True,
                "message": "Product created successfully.",
                "data": serialize_product(product),
            },
            status=201,
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
        get_public_products_queryset()
        .prefetch_related(
            "benefits",
            "pricing_tiers",
            "service_items",
        )
        .filter(
            allow_online_purchase=True,
        )
    )

    queryset = apply_product_filters(queryset, request.GET)

    page = parse_int(request.GET.get("page"), 1) or 1
    page_size = parse_int(request.GET.get("page_size"), 20) or 20
    include_children = _include_children(request)

    paginated = paginate_queryset(
        queryset,
        page=page,
        page_size=page_size,
    )

    return JsonResponse(
        {
            "ok": True,
            "message": "Public products loaded successfully.",
            "results": [
                serialize_product(
                    item,
                    include_children=include_children,
                )
                for item in paginated["items"]
            ],
            "pagination": paginated["pagination"],
        },
        status=200,
    )


# ============================================================
# 🔹 Orderable Products API
# ------------------------------------------------------------
# للاستخدام لاحقًا داخل شاشة إنشاء الطلب.
# ============================================================

@require_http_methods(["GET"])
def product_orderable_list_api(request):
    user, auth_error = _ensure_authenticated(request)

    if auth_error:
        return auth_error

    queryset = (
        get_orderable_products_queryset()
        .prefetch_related(
            "benefits",
            "pricing_tiers",
            "service_items",
        )
    )

    queryset = apply_product_filters(queryset, request.GET)

    page = parse_int(request.GET.get("page"), 1) or 1
    page_size = parse_int(request.GET.get("page_size"), 20) or 20
    include_children = _include_children(request)

    paginated = paginate_queryset(
        queryset,
        page=page,
        page_size=page_size,
    )

    return JsonResponse(
        {
            "ok": True,
            "message": "Orderable products loaded successfully.",
            "results": [
                serialize_product(
                    item,
                    include_children=include_children,
                )
                for item in paginated["items"]
            ],
            "pagination": paginated["pagination"],
        },
        status=200,
    )


# ============================================================
# 🔹 Contract Products API
# ------------------------------------------------------------
# للاستخدام لاحقًا داخل شاشة العقود وربط المنتجات بالمراكز.
# ============================================================

@require_http_methods(["GET"])
def product_contract_list_api(request):
    user, auth_error = _ensure_authenticated(request)

    if auth_error:
        return auth_error

    queryset = (
        get_contract_products_queryset()
        .prefetch_related(
            "benefits",
            "pricing_tiers",
            "service_items",
        )
    )

    queryset = apply_product_filters(queryset, request.GET)

    page = parse_int(request.GET.get("page"), 1) or 1
    page_size = parse_int(request.GET.get("page_size"), 20) or 20
    include_children = _include_children(request)

    paginated = paginate_queryset(
        queryset,
        page=page,
        page_size=page_size,
    )

    return JsonResponse(
        {
            "ok": True,
            "message": "Contract products loaded successfully.",
            "results": [
                serialize_product(
                    item,
                    include_children=include_children,
                )
                for item in paginated["items"]
            ],
            "pagination": paginated["pagination"],
        },
        status=200,
    )


# ============================================================
# 🔹 Featured Products API
# ============================================================

@require_http_methods(["GET"])
def product_featured_list_api(request):
    queryset = (
        get_featured_products_queryset()
        .prefetch_related(
            "benefits",
            "pricing_tiers",
            "service_items",
        )
    )

    queryset = apply_product_filters(queryset, request.GET)

    page = parse_int(request.GET.get("page"), 1) or 1
    page_size = parse_int(request.GET.get("page_size"), 20) or 20
    include_children = _include_children(request)

    paginated = paginate_queryset(
        queryset,
        page=page,
        page_size=page_size,
    )

    return JsonResponse(
        {
            "ok": True,
            "message": "Featured products loaded successfully.",
            "results": [
                serialize_product(
                    item,
                    include_children=include_children,
                )
                for item in paginated["items"]
            ],
            "pagination": paginated["pagination"],
        },
        status=200,
    )