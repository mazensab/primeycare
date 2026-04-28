# ============================================================
# 📂 api/contracts/urls.py
# 🧠 Primey Care | Contracts API URLs
# ============================================================

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

urlpatterns = [
    path("", contracts_api, name="contracts_api"),
    path("reports/", contracts_reports_api, name="contracts_reports_api"),
    path("<int:contract_id>/", contract_detail_api, name="contract_detail_api"),
    path("<int:contract_id>/activate/", activate_contract_api, name="activate_contract_api"),
    path("<int:contract_id>/suspend/", suspend_contract_api, name="suspend_contract_api"),
    path("<int:contract_id>/terminate/", terminate_contract_api, name="terminate_contract_api"),
    path("<int:contract_id>/expire/", expire_contract_api, name="expire_contract_api"),
]