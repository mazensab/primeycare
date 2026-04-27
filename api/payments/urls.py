from django.urls import path

from .confirm import confirm_payment_api
from .detail import payment_detail_api
from .list import payment_list_api

app_name = "api_payments"

urlpatterns = [
    path("", payment_list_api, name="list"),
    path("<int:payment_id>/", payment_detail_api, name="detail"),
    path("<int:payment_id>/confirm/", confirm_payment_api, name="confirm"),
]