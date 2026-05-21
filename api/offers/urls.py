# ============================================================
# 📂 api/offers/urls.py
# 🧭 Primey Care — Provider Offers API URLs V2.8
# ------------------------------------------------------------
# ✅ Offers built from contracts.ContractProduct
# ✅ Product = كتالوج ثابت
# ✅ ContractProduct = عرض/تسعير المنتج حسب مقدم الخدمة والعقد
# ✅ مناسب للهبوط والتطبيق وصفحة العروض والـ Checkout
# ✅ GET /api/offers/
# ✅ Supports filters:
#    - show_on_landing
#    - show_on_mobile
#    - show_on_offers
#    - product_id
#    - provider_id
#    - contract_id
#    - product_type
#    - current
#    - sort
# ✅ Response includes:
#    - offer_id
#    - contract_product_id
#    - checkout_source
#    - checkout_payload
#    - order_payload
#    - order_item_payload
#    - item_kind داخل order_item_payload
# ------------------------------------------------------------
# القاعدة المعتمدة:
# - Product = كتالوج ثابت.
# - ContractProduct = عرض/سعر/خصم المنتج حسب مقدم الخدمة والعقد.
# - /api/offers/ هو مصدر عروض الهبوط والـ Checkout.
# - عند إنشاء طلب من عرض:
#   أرسل offer_id أو contract_product_id إلى /api/orders/.
# - عند إنشاء عنصر طلب من عرض:
#   استخدم order_item_payload لأنه يحوّل product_type إلى item_kind صحيح.
# ============================================================

from django.urls import path

from api.offers.list import offers_list_api


app_name = "api_offers"


urlpatterns = [
    # ========================================================
    # Provider Offers List
    # --------------------------------------------------------
    # GET /api/offers/
    #
    # Examples:
    # /api/offers/?show_on_landing=true
    # /api/offers/?show_on_offers=true
    # /api/offers/?show_on_mobile=true
    # /api/offers/?product_id=5
    # /api/offers/?provider_id=8
    # /api/offers/?contract_id=3
    # /api/offers/?product_type=medical_service
    # /api/offers/?current=true
    # /api/offers/?sort=highest_discount
    #
    # Response payloads:
    # - checkout_payload: بيانات مختصرة للـ checkout
    # - order_payload: بيانات جاهزة لإنشاء Order
    # - order_item_payload: بيانات جاهزة لإنشاء OrderItem
    # ========================================================
    path(
        "",
        offers_list_api,
        name="offers_list_api",
    ),
]