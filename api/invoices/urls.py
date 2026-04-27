from django.urls import path

from .detail import invoice_detail_api
from .issue import issue_invoice_api
from .list import invoice_list_api

app_name = "api_invoices"

urlpatterns = [
    path("", invoice_list_api, name="list"),
    path("<int:invoice_id>/", invoice_detail_api, name="detail"),
    path("<int:invoice_id>/issue/", issue_invoice_api, name="issue"),
]