# ============================================================
# 📂 api/contracts/urls.py
# 🧠 Primey Care | Contracts API URLs
# ============================================================

from django.urls import path

from api.contracts.detail import contract_detail_api
from api.contracts.list import contracts_api

urlpatterns = [
    path("", contracts_api, name="contracts_api"),
    path("<int:contract_id>/", contract_detail_api, name="contract_detail_api"),
]