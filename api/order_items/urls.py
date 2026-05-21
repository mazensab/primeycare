# ============================================================
# 📂 api/order_items/urls.py
# 🧠 Primey Care | Order Items API URLs V2.2
# ------------------------------------------------------------
# ✅ Order items list
# ✅ Order items create via POST /api/order-items/
# ✅ Pending order items
# ✅ Order item detail / update / safe cancel
# ✅ Supports offer_id / contract_product_id
# ✅ Supports offer snapshot:
#    - offer_source
#    - offer_title
#    - offer_badge
# ✅ Supports pricing snapshot:
#    - unit_price_before_discount
#    - unit_discount_percentage
#    - unit_price
# ✅ Compatible with order_items.services V2.2:
#    - item_kind
#    - operational snapshots
#    - fulfillment_reference
#    - approval timestamps
#    - execution timestamps
# ✅ DELETE /api/order-items/<id>/ is safe cancel, not hard delete
# ------------------------------------------------------------
# القاعدة المعتمدة:
# - Product = كتالوج ثابت
# - ContractProduct = عرض/سعر/خصم المنتج حسب مقدم الخدمة والعقد
# - OrderItem يحفظ Snapshot ولا يتأثر بتغيير العرض لاحقًا
# ============================================================

from django.urls import path

from api.order_items.detail import order_item_detail_api
from api.order_items.list import order_items_api, pending_order_items_api


app_name = "api_order_items"


urlpatterns = [
    # ========================================================
    # 📦 Order Items List / Create
    # --------------------------------------------------------
    # GET  /api/order-items/
    # POST /api/order-items/
    #
    # POST supports:
    # - order_id
    # - product_id
    # - offer_id
    # - contract_product_id
    # - service_item_id
    # - item_kind
    # - offer_source
    # - offer_title
    # - offer_badge
    # - unit_price_before_discount
    # - unit_discount_percentage
    # - unit_price
    # ========================================================
    path(
        "",
        order_items_api,
        name="order_items_api",
    ),

    # ========================================================
    # ⏳ Pending Order Items
    # --------------------------------------------------------
    # GET /api/order-items/pending/
    #
    # Supports filters:
    # - order_id
    # - product_id
    # - provider_id
    # - contract_id
    # - offer_id
    # - contract_product_id
    # - offer_source
    # - item_kind
    # - status
    # - fulfillment_status
    # ========================================================
    path(
        "pending/",
        pending_order_items_api,
        name="pending_order_items_api",
    ),

    # ========================================================
    # 🔎 Order Item Detail / Update / Safe Cancel
    # --------------------------------------------------------
    # GET    /api/order-items/<id>/
    # PATCH  /api/order-items/<id>/
    # PUT    /api/order-items/<id>/
    # DELETE /api/order-items/<id>/
    #
    # PATCH/PUT supports changing:
    # - offer_id
    # - contract_product_id
    # - offer_source
    # - offer_title
    # - offer_badge
    # - unit_price_before_discount
    # - unit_discount_percentage
    # - unit_price
    #
    # DELETE هنا إلغاء آمن وليس حذف فعلي.
    # ========================================================
    path(
        "<int:order_item_id>/",
        order_item_detail_api,
        name="order_item_detail_api",
    ),
]