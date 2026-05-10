# ============================================================
# 📂 api/reports/urls.py
# 🧠 Primey Care | Reports API Router V2
# ------------------------------------------------------------
# ✅ Reports overview
# ✅ Customers report
# ✅ Providers report
# ✅ Orders report
# ✅ Invoices report
# ✅ Payments report
# ✅ Accounting report
# ✅ Compatible with rebuilt Accounting / Treasury / Payments flow
# ============================================================

from django.urls import path

from .accounting import accounting_report
from .customers import customers_report
from .invoices import invoices_report
from .orders import orders_report
from .overview import reports_overview
from .payments import payments_report
from .providers import providers_report


app_name = "api_reports"


urlpatterns = [
    # ========================================================
    # 📊 Reports Overview
    # --------------------------------------------------------
    # GET /api/reports/
    # GET /api/reports/overview/
    # ========================================================
    path(
        "",
        reports_overview,
        name="overview",
    ),
    path(
        "overview/",
        reports_overview,
        name="overview_alias",
    ),

    # ========================================================
    # 👥 Customers / Providers
    # --------------------------------------------------------
    # GET /api/reports/customers/
    # GET /api/reports/providers/
    # ========================================================
    path(
        "customers/",
        customers_report,
        name="customers",
    ),
    path(
        "providers/",
        providers_report,
        name="providers",
    ),

    # ========================================================
    # 📦 Operations
    # --------------------------------------------------------
    # GET /api/reports/orders/
    # GET /api/reports/invoices/
    # GET /api/reports/payments/
    # ========================================================
    path(
        "orders/",
        orders_report,
        name="orders",
    ),
    path(
        "invoices/",
        invoices_report,
        name="invoices",
    ),
    path(
        "payments/",
        payments_report,
        name="payments",
    ),

    # ========================================================
    # 🧾 Accounting
    # --------------------------------------------------------
    # GET /api/reports/accounting/
    # ========================================================
    path(
        "accounting/",
        accounting_report,
        name="accounting",
    ),
]