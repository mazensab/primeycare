# ============================================================
# 📂 api/agents/urls.py
# 🧠 Primey Care | Agents API URLs
# ------------------------------------------------------------
# ✅ Agents endpoints
# ✅ Commissions endpoints
# ============================================================

from django.urls import path

from .approve import approve_commission_api
from .create import create_agent_api
from .detail import agent_detail_api, commission_detail_api
from .list import agent_list_api, commission_list_api

app_name = "api_agents"

urlpatterns = [
    # Agents
    path("", agent_list_api, name="list"),
    path("create/", create_agent_api, name="create"),
    path("<int:agent_id>/", agent_detail_api, name="detail"),

    # Commissions
    path("commissions/", commission_list_api, name="commissions-list"),
    path(
        "commissions/<int:commission_id>/",
        commission_detail_api,
        name="commissions-detail",
    ),
    path(
        "commissions/<int:commission_id>/approve/",
        approve_commission_api,
        name="commissions-approve",
    ),
]