# ============================================================
# 📂 api/customers/urls.py
# 🧠 Primey Care | Customers API URLs V2
# ------------------------------------------------------------
# ✅ System Customers:
#    GET/POST /api/customers/
#    GET/PATCH/POST/DELETE /api/customers/<id>/
#    GET /api/customers/<id>/statement/
# ------------------------------------------------------------
# ✅ Customer Portal Auth:
#    POST /api/customers/auth/request-otp/
#    POST /api/customers/auth/verify-otp/
#    POST /api/customers/auth/logout/
# ------------------------------------------------------------
# ✅ Customer Portal Me:
#    GET/PATCH/POST /api/customers/me/
#    GET /api/customers/me/statement/
# ------------------------------------------------------------
# ✅ Compatibility aliases:
#    POST /api/customers/auth/request/
#    POST /api/customers/auth/verify/
#    POST /api/customers/logout/
#    GET/PATCH/POST /api/customers/profile/
#    GET /api/customers/statement/
# ============================================================

from __future__ import annotations

from django.urls import path

from .auth import (
    customer_logout_api,
    request_customer_otp_api,
    verify_customer_otp_api,
)
from .detail import customer_detail_api
from .list import customers_list_create_api
from .me import customer_me_api, customer_me_statement_api
from .statement import customer_statement_api


app_name = "api_customers"


urlpatterns = [
    # ========================================================
    # 🔐 Customer portal auth
    # --------------------------------------------------------
    # هذه المسارات عامة لطلب OTP والتحقق والخروج.
    # request/verify لا تحتاج login داخل view.
    # logout يتعامل مع الجلسة الحالية إن وجدت.
    # ========================================================
    path(
        "auth/request-otp/",
        request_customer_otp_api,
        name="auth-request-otp",
    ),
    path(
        "auth/request/",
        request_customer_otp_api,
        name="auth-request-otp-alias",
    ),
    path(
        "auth/verify-otp/",
        verify_customer_otp_api,
        name="auth-verify-otp",
    ),
    path(
        "auth/verify/",
        verify_customer_otp_api,
        name="auth-verify-otp-alias",
    ),
    path(
        "auth/logout/",
        customer_logout_api,
        name="auth-logout",
    ),
    path(
        "logout/",
        customer_logout_api,
        name="auth-logout-alias",
    ),

    # ========================================================
    # 👤 Current customer portal account
    # --------------------------------------------------------
    # مهم أن تكون me/profile/statement قبل <int:customer_id>/
    # حتى لا يحدث تعارض مستقبلًا.
    # ========================================================
    path(
        "me/",
        customer_me_api,
        name="me",
    ),
    path(
        "profile/",
        customer_me_api,
        name="me-profile-alias",
    ),
    path(
        "me/statement/",
        customer_me_statement_api,
        name="me-statement",
    ),
    path(
        "statement/",
        customer_me_statement_api,
        name="me-statement-alias",
    ),

    # ========================================================
    # 👥 System customers management
    # ========================================================
    path(
        "",
        customers_list_create_api,
        name="list-create",
    ),

    # ========================================================
    # 🧾 Customer statement by ID
    # --------------------------------------------------------
    # وضع statement قبل detail ليس ضروريًا مع int، لكنه أوضح.
    # ========================================================
    path(
        "<int:customer_id>/statement/",
        customer_statement_api,
        name="statement",
    ),

    # ========================================================
    # 📄 Customer detail by ID
    # ========================================================
    path(
        "<int:customer_id>/",
        customer_detail_api,
        name="detail",
    ),
]