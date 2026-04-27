# ============================================================
# 📂 api/order_items/urls.py
# 🧠 Primey Care | Order Items API URLs
# ============================================================

from django.urls import path

from api.order_items.detail import order_item_detail_api
from api.order_items.list import order_items_api, pending_order_items_api

urlpatterns = [
    path("", order_items_api, name="order_items_api"),
    path("pending/", pending_order_items_api, name="pending_order_items_api"),
    path("<int:order_item_id>/", order_item_detail_api, name="order_item_detail_api"),
]