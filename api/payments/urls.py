# ============================================================
# 📂 api/payments/urls.py
# 🧠 Primey Care | Payments API URLs
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
    path("", payment_list_api, name="list"),
    path("create/", create_payment_api, name="create"),
    path("reports/", payment_reports_api, name="reports"),
    path("<int:payment_id>/", payment_detail_api, name="detail"),
    path("<int:payment_id>/confirm/", confirm_payment_api, name="confirm"),
    path("<int:payment_id>/cancel/", cancel_payment_api, name="cancel"),
]