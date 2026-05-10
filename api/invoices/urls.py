# ============================================================
# 📂 api/invoices/urls.py
# 🧠 Invoices API URLs — Primey Care V2
# ------------------------------------------------------------
# ✅ Invoices list
# ✅ Create invoice from order
# ✅ Invoice reports
# ✅ Invoice detail
# ✅ Issue invoice
# ✅ Cancel invoice
# ✅ Compatible with Accounting / Treasury backend flow
# ------------------------------------------------------------
# المسار المالي المعتمد:
# POST /api/invoices/create/
# → invoices.services.create_invoice_from_order
#
# POST /api/invoices/<id>/issue/
# → invoices.services.issue_invoice
# → Accounting JournalEntry بعد commit
#
# POST /api/invoices/<id>/cancel/
# → invoices.services.cancel_invoice
# → إلغاء آمن بدون حذف وبدون تحويل مدفوع
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
    # ========================================================
    # 🧾 Invoices List
    # --------------------------------------------------------
    # GET /api/invoices/
    # ========================================================
    path(
        "",
        invoice_list_api,
        name="list",
    ),

    # ========================================================
    # ➕ Create Invoice
    # --------------------------------------------------------
    # POST /api/invoices/create/
    # ========================================================
    path(
        "create/",
        create_invoice_api,
        name="create",
    ),

    # ========================================================
    # 📊 Invoice Reports
    # --------------------------------------------------------
    # GET /api/invoices/reports/
    # ========================================================
    path(
        "reports/",
        invoice_reports_api,
        name="reports",
    ),

    # ========================================================
    # 🔎 Invoice Detail
    # --------------------------------------------------------
    # GET /api/invoices/<id>/
    # PATCH/PUT /api/invoices/<id>/ حسب detail API
    # ========================================================
    path(
        "<int:invoice_id>/",
        invoice_detail_api,
        name="detail",
    ),

    # ========================================================
    # ✅ Issue Invoice
    # --------------------------------------------------------
    # POST /api/invoices/<id>/issue/
    # ========================================================
    path(
        "<int:invoice_id>/issue/",
        issue_invoice_api,
        name="issue",
    ),

    # ========================================================
    # 🚫 Cancel Invoice
    # --------------------------------------------------------
    # POST /api/invoices/<id>/cancel/
    # ========================================================
    path(
        "<int:invoice_id>/cancel/",
        cancel_invoice_api,
        name="cancel",
    ),
]