# ============================================================
# 📂 api/invoices/urls.py
# 🧠 Invoices API URLs — Primey Care
# ============================================================

from django.urls import path

from .cancel import cancel_invoice_api
from .create import create_invoice_api
from .detail import invoice_detail_api
from .issue import issue_invoice_api
from .list import invoice_list_api
from .reports import invoice_reports_api

app_name = "api_invoices"

urlpatterns = [
    path("", invoice_list_api, name="list"),
    path("create/", create_invoice_api, name="create"),
    path("reports/", invoice_reports_api, name="reports"),
    path("<int:invoice_id>/", invoice_detail_api, name="detail"),
    path("<int:invoice_id>/issue/", issue_invoice_api, name="issue"),
    path("<int:invoice_id>/cancel/", cancel_invoice_api, name="cancel"),
]