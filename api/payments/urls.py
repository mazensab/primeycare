# ============================================================
# 📂 api/payments/urls.py
# 🧠 Primey Care | Payments API URLs V2
# ------------------------------------------------------------
# ✅ Payments list
# ✅ Create payment
# ✅ Payment reports
# ✅ Payment detail
# ✅ Confirm payment
# ✅ Cancel payment
# ✅ Compatible with Accounting / Treasury backend flow
# ------------------------------------------------------------
# المسار المالي المعتمد:
# POST /api/payments/create/
# → payments.services.create_payment
#
# POST /api/payments/<id>/confirm/
# → payments.services.confirm_payment
# → Accounting JournalEntry بعد commit
# → TreasuryTransaction بعد commit
#
# POST /api/payments/<id>/cancel/
# → payments.services.cancel_payment
# → إلغاء آمن للدفعات غير المؤكدة فقط
# ============================================================

from django.urls import path

from .cancel import cancel_payment_api
from .confirm import confirm_payment_api
from .create import create_payment_api
from .detail import payment_detail_api
from .list import payment_list_api
from .reports import payment_reports_api


app_name = "api_payments"


urlpatterns = [
    # ========================================================
    # 💳 Payments List
    # --------------------------------------------------------
    # GET /api/payments/
    # ========================================================
    path(
        "",
        payment_list_api,
        name="list",
    ),

    # ========================================================
    # ➕ Create Payment
    # --------------------------------------------------------
    # POST /api/payments/create/
    # ========================================================
    path(
        "create/",
        create_payment_api,
        name="create",
    ),

    # ========================================================
    # 📊 Payment Reports
    # --------------------------------------------------------
    # GET /api/payments/reports/
    # ========================================================
    path(
        "reports/",
        payment_reports_api,
        name="reports",
    ),

    # ========================================================
    # 🔎 Payment Detail
    # --------------------------------------------------------
    # GET /api/payments/<id>/
    # PATCH/PUT /api/payments/<id>/ حسب detail API
    # ========================================================
    path(
        "<int:payment_id>/",
        payment_detail_api,
        name="detail",
    ),

    # ========================================================
    # ✅ Confirm Payment
    # --------------------------------------------------------
    # POST /api/payments/<id>/confirm/
    # ========================================================
    path(
        "<int:payment_id>/confirm/",
        confirm_payment_api,
        name="confirm",
    ),

    # ========================================================
    # 🚫 Cancel Payment
    # --------------------------------------------------------
    # POST /api/payments/<id>/cancel/
    # ========================================================
    path(
        "<int:payment_id>/cancel/",
        cancel_payment_api,
        name="cancel",
    ),
]