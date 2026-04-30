# ============================================================
# 📂 api/reports/urls.py
# 🧠 Primey Care | Reports API Router
# ============================================================

from django.urls import path

from .accounting import accounting_report
from .customers import customers_report
from .invoices import invoices_report
from .orders import orders_report
from .overview import reports_overview
from .payments import payments_report
from .providers import providers_report


urlpatterns = [
    path("", reports_overview, name="reports-overview"),
    path("overview/", reports_overview, name="reports-overview-alias"),
    path("customers/", customers_report, name="reports-customers"),
    path("providers/", providers_report, name="reports-providers"),
    path("orders/", orders_report, name="reports-orders"),
    path("invoices/", invoices_report, name="reports-invoices"),
    path("payments/", payments_report, name="reports-payments"),
    path("accounting/", accounting_report, name="reports-accounting"),
]