# ============================================================
# 📂 api/customers/urls.py
# 🧠 Primey Care | Customers API URLs
# ------------------------------------------------------------
# ✅ /api/customers/
# ✅ /api/customers/<id>/
# ✅ /api/customers/<id>/statement/
# ============================================================

from django.urls import path

from .detail import customer_detail_api
from .list import customers_list_create_api
from .statement import customer_statement_api

app_name = "api_customers"

urlpatterns = [
    path("", customers_list_create_api, name="list_create"),
    path("<int:customer_id>/", customer_detail_api, name="detail"),
    path("<int:customer_id>/statement/", customer_statement_api, name="statement"),
]