# ============================================================
# 📂 api/orders/urls.py
# 🧭 Primey Care — Orders API URLs V2
# ------------------------------------------------------------
# ✅ Orders list
# ✅ Orders create via POST /api/orders/
# ✅ Open orders
# ✅ Orders reports
# ✅ Order detail/update/cancel
# ✅ Order lifecycle actions
# ✅ Compatible with Accounting / Treasury backend flow
# ------------------------------------------------------------
# ملاحظات:
# - لا نحتاج api/orders/create.py حاليًا.
# - إنشاء الطلب يتم من:
#   POST /api/orders/
#   api.orders.list.orders_api
# - دورة حياة الطلب تتم من:
#   POST/PATCH /api/orders/<id>/status/
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