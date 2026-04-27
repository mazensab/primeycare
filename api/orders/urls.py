# ============================================================
# 📂 api/orders/urls.py
# 🧭 Primey Care — Orders API URLs
# ============================================================

from django.urls import path

from api.orders.detail import order_detail_api
from api.orders.list import open_orders_api, orders_api

urlpatterns = [
    path("", orders_api, name="orders_api"),
    path("open/", open_orders_api, name="open_orders_api"),
    path("<int:order_id>/", order_detail_api, name="order_detail_api"),
]