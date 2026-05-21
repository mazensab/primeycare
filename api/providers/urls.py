# ============================================================
# 📂 api/providers/urls.py
# 🧠 Primey Care | Providers API URLs V2
# ------------------------------------------------------------
# ✅ Providers list/create
# ✅ Active providers
# ✅ Provider detail/update/safe disable
# ✅ Providers Excel import
# ✅ Provider file upload to Google Drive
# ✅ Compatibility aliases for frontend routes
# ------------------------------------------------------------
# Main routes:
# - GET/POST /api/providers/
# - GET      /api/providers/active/
# - POST     /api/providers/import-excel/
# - GET/PATCH/DELETE /api/providers/<provider_id>/
# - POST     /api/providers/<provider_id>/upload/
# ============================================================

from __future__ import annotations

from django.urls import path

from api.providers.detail import provider_detail_api
from api.providers.import_excel import import_providers_excel_api
from api.providers.list import active_providers_api, providers_api
from api.providers.upload import provider_upload_api


app_name = "api_providers"


urlpatterns = [
    # ========================================================
    # 🏥 Providers list/create
    # --------------------------------------------------------
    # GET  /api/providers/
    # POST /api/providers/
    # ========================================================
    path(
        "",
        providers_api,
        name="providers-api",
    ),

    # Compatibility aliases.
    path(
        "list/",
        providers_api,
        name="providers-list",
    ),
    path(
        "create/",
        providers_api,
        name="providers-create",
    ),
    path(
        "options/",
        active_providers_api,
        name="providers-options",
    ),

    # ========================================================
    # ✅ Active providers
    # --------------------------------------------------------
    # GET /api/providers/active/
    # ========================================================
    path(
        "active/",
        active_providers_api,
        name="active-providers-api",
    ),

    # ========================================================
    # 📥 Providers Excel import
    # --------------------------------------------------------
    # POST /api/providers/import-excel/
    # ========================================================
    path(
        "import-excel/",
        import_providers_excel_api,
        name="import-providers-excel-api",
    ),

    # Compatibility import alias.
    path(
        "import/",
        import_providers_excel_api,
        name="import-providers-excel-alias",
    ),

    # ========================================================
    # 📎 Provider upload
    # --------------------------------------------------------
    # POST /api/providers/<provider_id>/upload/
    # ========================================================
    path(
        "<int:provider_id>/upload/",
        provider_upload_api,
        name="provider-upload-api",
    ),

    # Compatibility upload alias.
    path(
        "<int:provider_id>/files/upload/",
        provider_upload_api,
        name="provider-files-upload-alias",
    ),

    # ========================================================
    # 📄 Provider detail/update/safe disable aliases
    # --------------------------------------------------------
    # GET/PATCH/DELETE /api/providers/<provider_id>/detail/
    # DELETE           /api/providers/<provider_id>/disable/
    # DELETE           /api/providers/<provider_id>/safe-disable/
    #
    # ملاحظة:
    # نفس view يتعامل مع GET/PATCH/DELETE.
    # DELETE في detail.py يقوم بتعطيل آمن وليس حذفًا فعليًا.
    # ========================================================
    path(
        "<int:provider_id>/detail/",
        provider_detail_api,
        name="provider-detail-alias",
    ),
    path(
        "<int:provider_id>/disable/",
        provider_detail_api,
        name="provider-disable-alias",
    ),
    path(
        "<int:provider_id>/safe-disable/",
        provider_detail_api,
        name="provider-safe-disable-alias",
    ),

    # ========================================================
    # 📄 Provider detail/update/safe disable
    # --------------------------------------------------------
    # GET/PATCH/DELETE /api/providers/<provider_id>/
    #
    # مهم أن يكون هذا المسار بعد upload/detail aliases.
    # ========================================================
    path(
        "<int:provider_id>/",
        provider_detail_api,
        name="provider-detail-api",
    ),
]