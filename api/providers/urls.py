# ============================================================
# 📂 api/providers/urls.py
# 🧠 Primey Care | Providers API URLs
# ============================================================

from django.urls import path

from api.providers.detail import provider_detail_api
from api.providers.list import active_providers_api, providers_api

urlpatterns = [
    path("", providers_api, name="providers_api"),
    path("active/", active_providers_api, name="active_providers_api"),
    path("<int:provider_id>/", provider_detail_api, name="provider_detail_api"),
]