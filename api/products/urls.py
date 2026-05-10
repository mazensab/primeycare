# ============================================================
# 📂 api/products/urls.py
# 🧭 Primey Care — Products & Programs API URLs
# ------------------------------------------------------------
# ✅ Categories
# ✅ Products
# ✅ Product image upload
# ✅ Public / Featured / Orderable / Contract products
# ✅ Landing products
# ✅ Mobile products
# ✅ Medical offers products
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
    product_landing_list_api,
    product_mobile_list_api,
    product_offers_list_api,
    product_orderable_list_api,
    product_public_list_api,
    products_api,
)
from api.products.upload import product_image_upload_api

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
        "landing/",
        product_landing_list_api,
        name="product_landing_list_api",
    ),
    path(
        "mobile/",
        product_mobile_list_api,
        name="product_mobile_list_api",
    ),
    path(
        "offers/",
        product_offers_list_api,
        name="product_offers_list_api",
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
        "<int:product_id>/upload-image/",
        product_image_upload_api,
        name="product_image_upload_api",
    ),
    path(
        "<int:product_id>/",
        product_detail_api,
        name="product_detail_api",
    ),
]