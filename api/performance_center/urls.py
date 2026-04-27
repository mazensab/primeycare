# ============================================================
# 📂 api/performance_center/urls.py
# Primey Care - Performance Center API URLs
# ============================================================

from django.urls import path

from .create import performance_center_create_api
from .delete import performance_center_delete_api
from .detail import performance_center_detail_api
from .list import performance_center_list_api
from .update import performance_center_update_api

app_name = "performance_center_api"

urlpatterns = [
    path("", performance_center_list_api, name="overview"),
    path("list/", performance_center_list_api, name="list"),
    path("detail/", performance_center_detail_api, name="detail"),
    path("create/", performance_center_create_api, name="create"),
    path("update/", performance_center_update_api, name="update"),
    path("delete/", performance_center_delete_api, name="delete"),
]