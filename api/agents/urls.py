from django.urls import path

from .approve import approve_commission_api
from .detail import commission_detail_api
from .list import commission_list_api

app_name = "api_agents"

urlpatterns = [
    path("", commission_list_api, name="list"),
    path("<int:commission_id>/", commission_detail_api, name="detail"),
    path("<int:commission_id>/approve/", approve_commission_api, name="approve"),
]