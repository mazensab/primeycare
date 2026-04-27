# ============================================================
# 📂 api/service_items/urls.py
# 🧠 Primey Care | Service Items API URLs
# ============================================================

from django.urls import path

from api.service_items.detail import service_item_detail_api
from api.service_items.list import active_service_items_api, service_items_api

urlpatterns = [
    path("", service_items_api, name="service_items_api"),
    path("active/", active_service_items_api, name="active_service_items_api"),
    path("<int:service_item_id>/", service_item_detail_api, name="service_item_detail_api"),
]