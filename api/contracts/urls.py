# ============================================================
# 📂 api/contracts/urls.py
# 🧠 Primey Care | Contracts API URLs V2
# ------------------------------------------------------------
# ✅ Contracts list/create
# ✅ Contract detail/update/terminate
# ✅ Contract status actions
# ✅ Contract reports
# ✅ Compatibility aliases for frontend routes
# ------------------------------------------------------------
# القاعدة المعتمدة:
# - Product = كتالوج ثابت
# - Provider = كيان مقدم الخدمة في الشبكة
# - Contract = عقد مقدم الخدمة وبداية العلاقة الرسمية
# - Provider.user = حساب دخول رئيسي اختياري ينشأ من العقد
# - ContractProduct = عرض/سعر/خصم المنتج حسب مقدم الخدمة والعقد
# - عروض مقدمي الخدمة العامة تعرض من /api/offers/
# ============================================================

from __future__ import annotations

from django.urls import path

from api.contracts.detail import contract_detail_api
from api.contracts.list import contracts_api
from api.contracts.reports import contracts_reports_api
from api.contracts.status import (
    activate_contract_api,
    expire_contract_api,
    suspend_contract_api,
    terminate_contract_api,
)


app_name = "api_contracts"


urlpatterns = [
    # ========================================================
    # 📄 Contracts list/create
    # --------------------------------------------------------
    # GET  /api/contracts/
    # POST /api/contracts/
    #
    # ملاحظة:
    # إنشاء العقد يتم من contracts_api داخل:
    # api/contracts/list.py
    # ========================================================
    path(
        "",
        contracts_api,
        name="contracts-api",
    ),

    # Compatibility aliases.
    path(
        "list/",
        contracts_api,
        name="contracts-list",
    ),
    path(
        "create/",
        contracts_api,
        name="contracts-create",
    ),

    # ========================================================
    # 📊 Contract Reports
    # --------------------------------------------------------
    # GET /api/contracts/reports/
    #
    # مهم أن تكون قبل <int:contract_id>/ كتنظيم آمن.
    # ========================================================
    path(
        "reports/",
        contracts_reports_api,
        name="contracts-reports-api",
    ),

    # ========================================================
    # ⚙️ Contract Status Actions
    # --------------------------------------------------------
    # POST/PATCH /api/contracts/<contract_id>/activate/
    # POST/PATCH /api/contracts/<contract_id>/suspend/
    # POST/PATCH /api/contracts/<contract_id>/terminate/
    # POST/PATCH /api/contracts/<contract_id>/expire/
    #
    # عند activate يمكن إرسال:
    # {
    #   "create_provider_login_user": true
    # }
    # لإنشاء حساب دخول مقدم الخدمة عند تفعيل العقد.
    # ========================================================
    path(
        "<int:contract_id>/activate/",
        activate_contract_api,
        name="activate-contract-api",
    ),
    path(
        "<int:contract_id>/suspend/",
        suspend_contract_api,
        name="suspend-contract-api",
    ),
    path(
        "<int:contract_id>/terminate/",
        terminate_contract_api,
        name="terminate-contract-api",
    ),
    path(
        "<int:contract_id>/expire/",
        expire_contract_api,
        name="expire-contract-api",
    ),

    # Compatibility status aliases.
    path(
        "<int:contract_id>/status/activate/",
        activate_contract_api,
        name="activate-contract-status-alias",
    ),
    path(
        "<int:contract_id>/status/suspend/",
        suspend_contract_api,
        name="suspend-contract-status-alias",
    ),
    path(
        "<int:contract_id>/status/terminate/",
        terminate_contract_api,
        name="terminate-contract-status-alias",
    ),
    path(
        "<int:contract_id>/status/expire/",
        expire_contract_api,
        name="expire-contract-status-alias",
    ),
    path(
        "<int:contract_id>/safe-terminate/",
        terminate_contract_api,
        name="safe-terminate-contract-alias",
    ),

    # ========================================================
    # 📄 Contract detail/update/safe terminate aliases
    # --------------------------------------------------------
    # GET/PATCH/DELETE /api/contracts/<contract_id>/detail/
    # ========================================================
    path(
        "<int:contract_id>/detail/",
        contract_detail_api,
        name="contract-detail-alias",
    ),

    # ========================================================
    # 📄 Contract detail/update/safe terminate
    # --------------------------------------------------------
    # GET    /api/contracts/<contract_id>/
    # PATCH  /api/contracts/<contract_id>/
    # DELETE /api/contracts/<contract_id>/
    #
    # DELETE في detail.py ينهي العقد TERMINATED وليس حذفًا فعليًا.
    # مهم أن يكون هذا المسار بعد reports/status/detail aliases.
    # ========================================================
    path(
        "<int:contract_id>/",
        contract_detail_api,
        name="contract-detail-api",
    ),
]