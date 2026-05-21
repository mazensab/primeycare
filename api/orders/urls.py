# ============================================================
# 📂 api/orders/urls.py
# 🧭 Primey Care — Orders API URLs V2.6
# ------------------------------------------------------------
# ✅ Orders list
# ✅ Orders create via POST /api/orders/
# ✅ Create order from offer_id / contract_product_id
# ✅ Open / active orders
# ✅ Orders reports
# ✅ Order detail / update / safe cancel
# ✅ Order lifecycle actions
# ✅ Compatible with Orders Services V2.6:
#    - Auto customer resolve/create from phone
#    - Auto sales agent assignment from current agent user
#    - Optional sales agent assignment for authorized managers
#    - Auto provider / contract resolution from product
#    - Auto Product / Provider / Contract resolution from ContractProduct
#    - Support offer_id / contract_product_id from /api/offers/
#    - Save offer snapshot inside Order
#    - Delivery agent assignment
#    - Card printed / card ready lifecycle
#    - Out for delivery / delivered lifecycle
#    - Cash on delivery collection
#    - Invoice creation / attach lifecycle actions
#    - OrderTimeline operational tracking
# ✅ Compatible with Accounting / Treasury backend flow
# ------------------------------------------------------------
# ملاحظات:
# - Product = كتالوج ثابت.
# - ContractProduct = عرض/سعر/خصم المنتج حسب مقدم الخدمة والعقد.
# - Order يحفظ Snapshot للعرض والسعر ولا يتأثر بتغيير العرض لاحقًا.
# - لا نحتاج api/orders/create.py حاليًا.
# - إنشاء الطلب يتم من:
#   POST /api/orders/
#   api.orders.list.orders_api
# - عند إنشاء طلب من صفحة الهبوط أو العروض:
#   أرسل offer_id أو contract_product_id.
# - دورة حياة الطلب تتم من:
#   POST/PATCH /api/orders/<id>/status/
# - تفاصيل الطلب والتايملاين ترجع من:
#   GET /api/orders/<id>/
# - طلبات الموقع الخارجية العامة يفضل أن تكون في public checkout endpoint مستقل لاحقًا.
# ============================================================

from django.urls import path

from api.orders.detail import order_detail_api
from api.orders.list import open_orders_api, orders_api
from api.orders.reports import orders_reports_api
from api.orders.status import order_status_api


app_name = "api_orders"


urlpatterns = [
    # ========================================================
    # 📦 Orders List / Create
    # --------------------------------------------------------
    # GET  /api/orders/
    # POST /api/orders/
    #
    # POST supports:
    # - product_id
    # - offer_id
    # - contract_product_id
    # - customer_id or customer phone payload
    # - payment_method
    # - referral_code / agent_code
    # ========================================================
    path(
        "",
        orders_api,
        name="orders_api",
    ),

    # ========================================================
    # 🟢 Open / Active Orders
    # --------------------------------------------------------
    # GET /api/orders/open/
    # ========================================================
    path(
        "open/",
        open_orders_api,
        name="open_orders_api",
    ),

    # ========================================================
    # 📊 Orders Reports
    # --------------------------------------------------------
    # GET /api/orders/reports/
    #
    # Reports include:
    # - offer_source_breakdown
    # - contract_product_breakdown
    # - offer_breakdown
    # - delivery and COD summaries
    # ========================================================
    path(
        "reports/",
        orders_reports_api,
        name="orders_reports_api",
    ),

    # ========================================================
    # 🔎 Order Detail / Update / Safe Cancel
    # --------------------------------------------------------
    # GET    /api/orders/<id>/
    # PATCH  /api/orders/<id>/
    # PUT    /api/orders/<id>/
    # DELETE /api/orders/<id>/
    #
    # PATCH/PUT supports changing:
    # - offer_id
    # - contract_product_id
    #
    # DELETE هنا إلغاء آمن وليس حذف فعلي.
    # ========================================================
    path(
        "<int:order_id>/",
        order_detail_api,
        name="order_detail_api",
    ),

    # ========================================================
    # 🔁 Order Lifecycle
    # --------------------------------------------------------
    # POST/PATCH /api/orders/<id>/status/
    #
    # Supported actions:
    # - confirm
    # - processing
    # - mark_card_printed
    # - card_printed
    # - mark_card_ready
    # - card_ready
    # - assign_delivery
    # - assigned_for_delivery
    # - start_delivery
    # - out_for_delivery
    # - confirm_delivery
    # - delivered
    # - collect_cash
    # - cash_collected
    # - complete
    # - cancel
    # - refund
    # - attach_invoice
    # - create_invoice
    # - issue_invoice
    # ========================================================
    path(
        "<int:order_id>/status/",
        order_status_api,
        name="order_status_api",
    ),
]