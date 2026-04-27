# ============================================================
# 📂 api/system_log/urls.py
# Primey Care - System Log API URLs
# ============================================================

from django.urls import path

from .delete import system_log_delete_api
from .detail import system_log_detail_api
from .list import system_log_list_api
from .summary import system_log_summary_api

app_name = "system_log_api"

urlpatterns = [
    path("", system_log_list_api, name="overview"),
    path("list/", system_log_list_api, name="list"),
    path("summary/", system_log_summary_api, name="summary"),
    path("<int:log_id>/", system_log_detail_api, name="detail"),
    path("<int:log_id>/delete/", system_log_delete_api, name="delete"),
    path("delete/", system_log_delete_api, name="bulk_delete"),
]