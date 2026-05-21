# ============================================================
# 📂 api/products/urls.py
# 🧭 Primey Care — Products Catalog API URLs V2.7
# ------------------------------------------------------------
# ✅ Categories
# ✅ Products Catalog
# ✅ Product image upload
# ✅ Public / Featured / Orderable / Contract-ready products
# ✅ Landing products العامة
# ✅ Mobile products العامة
# ✅ General product offers
# ------------------------------------------------------------
# القاعدة المعتمدة:
# - Product = كتالوج ثابت.
# - /api/products/ يعرض كتالوج المنتجات.
# - /api/products/offers/ يعرض عروض عامة محفوظة على Product نفسه.
# - /api/offers/ يعرض عروض مقدمي الخدمة المبنية على ContractProduct.
# - ContractProduct = سعر/خصم/عرض المنتج حسب مقدم الخدمة والعقد.
# ------------------------------------------------------------
# مهم:
# - لا نربط المنتج بمقدم الخدمة في التطوير الجديد.
# - عند اختيار عرض مقدم خدمة في الهبوط أو Checkout استخدم /api/offers/.
# - عند إنشاء طلب من عرض مقدم خدمة أرسل offer_id أو contract_product_id إلى /api/orders/.
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


app_name = "api_products"


urlpatterns = [
    # ========================================================
    # Categories
    # --------------------------------------------------------
    # GET  /api/products/categories/
    # POST /api/products/categories/
    # GET/PATCH/DELETE /api/products/categories/<id>/
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
    # Products Catalog
    # --------------------------------------------------------
    # GET  /api/products/
    # POST /api/products/
    #
    # Product هنا كتالوج ثابت:
    # - بطاقة
    # - خدمة طبية
    # - برنامج
    # - عضوية
    #
    # عروض مقدمي الخدمة ليست هنا، بل في:
    # GET /api/offers/
    # ========================================================
    path(
        "",
        products_api,
        name="products_api",
    ),

    # ========================================================
    # Public Products
    # --------------------------------------------------------
    # GET /api/products/public/
    # ========================================================
    path(
        "public/",
        product_public_list_api,
        name="product_public_list_api",
    ),

    # ========================================================
    # Featured Products
    # --------------------------------------------------------
    # GET /api/products/featured/
    # ========================================================
    path(
        "featured/",
        product_featured_list_api,
        name="product_featured_list_api",
    ),

    # ========================================================
    # Landing Products العامة
    # --------------------------------------------------------
    # GET /api/products/landing/
    #
    # هذه تعرض المنتجات العامة في الهبوط.
    # عروض مقدمي الخدمة المتغيرة حسب العقد تأتي من:
    # GET /api/offers/?show_on_landing=true
    # ========================================================
    path(
        "landing/",
        product_landing_list_api,
        name="product_landing_list_api",
    ),

    # ========================================================
    # Mobile Products العامة
    # --------------------------------------------------------
    # GET /api/products/mobile/
    #
    # عروض مقدمي الخدمة للتطبيق تأتي من:
    # GET /api/offers/?show_on_mobile=true
    # ========================================================
    path(
        "mobile/",
        product_mobile_list_api,
        name="product_mobile_list_api",
    ),

    # ========================================================
    # General Product Offers
    # --------------------------------------------------------
    # GET /api/products/offers/
    #
    # هذه للعروض العامة الموجودة على Product نفسه.
    # لا تستخدمها لعروض مقدم خدمة بسعر مختلف.
    #
    # عروض مقدم الخدمة حسب العقد:
    # GET /api/offers/
    # ========================================================
    path(
        "offers/",
        product_offers_list_api,
        name="product_offers_list_api",
    ),

    # ========================================================
    # Orderable Catalog Products
    # --------------------------------------------------------
    # GET /api/products/orderable/
    #
    # يستخدم داخل النظام لاختيار المنتج من الكتالوج.
    # إذا كان المنتج requires_provider=true يجب اختيار offer من /api/offers/.
    # ========================================================
    path(
        "orderable/",
        product_orderable_list_api,
        name="product_orderable_list_api",
    ),

    # ========================================================
    # Contract-ready Catalog Products
    # --------------------------------------------------------
    # GET /api/products/contract/
    #
    # يستخدم داخل شاشة العقود لاختيار منتجات الكتالوج
    # ثم إنشاء ContractProduct عليها.
    # ========================================================
    path(
        "contract/",
        product_contract_list_api,
        name="product_contract_list_api",
    ),

    # ========================================================
    # Product Media
    # --------------------------------------------------------
    # POST /api/products/<id>/upload-image/
    # ========================================================
    path(
        "<int:product_id>/upload-image/",
        product_image_upload_api,
        name="product_image_upload_api",
    ),

    # ========================================================
    # Product Detail
    # --------------------------------------------------------
    # GET/PATCH/DELETE /api/products/<id>/
    # ========================================================
    path(
        "<int:product_id>/",
        product_detail_api,
        name="product_detail_api",
    ),
]