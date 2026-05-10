# ============================================================
# 📂 api/providers/urls.py
# 🧠 Primey Care | Providers API URLs
# ------------------------------------------------------------
# ✅ Providers list/create
# ✅ Active providers
# ✅ Provider detail/update/safe disable
# ✅ Providers Excel import
# ✅ Provider file upload to Google Drive
# ============================================================

from django.urls import path

from api.providers.detail import provider_detail_api
from api.providers.import_excel import import_providers_excel_api
from api.providers.list import active_providers_api, providers_api
from api.providers.upload import provider_upload_api

urlpatterns = [
    path("", providers_api, name="providers_api"),
    path("active/", active_providers_api, name="active_providers_api"),
    path("import-excel/", import_providers_excel_api, name="import_providers_excel_api"),
    path("<int:provider_id>/", provider_detail_api, name="provider_detail_api"),
    path("<int:provider_id>/upload/", provider_upload_api, name="provider_upload_api"),
]