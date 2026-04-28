# ============================================================
# 📂 api/products/urls.py
# 🧭 Primey Care — Products & Programs API URLs
# ============================================================

from django.urls import path

from api.products.detail import (
    product_category_detail_api,
    product_detail_api,
)
from api.products.list import (
    product_categories_api,
    product_contract_list_api,
    product_featured_list_api,
    product_orderable_list_api,
    product_public_list_api,
    products_api,
)

urlpatterns = [
    # ========================================================
    # Categories
    # ========================================================
    path(
        "categories/",
        product_categories_api,
        name="product_categories_api",
    ),
    path(
        "categories/<int:category_id>/",
        product_category_detail_api,
        name="product_category_detail_api",
    ),

    # ========================================================
    # Products
    # ========================================================
    path(
        "",
        products_api,
        name="products_api",
    ),
    path(
        "public/",
        product_public_list_api,
        name="product_public_list_api",
    ),
    path(
        "featured/",
        product_featured_list_api,
        name="product_featured_list_api",
    ),
    path(
        "orderable/",
        product_orderable_list_api,
        name="product_orderable_list_api",
    ),
    path(
        "contract/",
        product_contract_list_api,
        name="product_contract_list_api",
    ),
    path(
        "<int:product_id>/",
        product_detail_api,
        name="product_detail_api",
    ),
]