# ===============================================================
# 📂 الملف: api/auth/urls.py
# 🧭 Primey Care — Auth API URLs V2
# ---------------------------------------------------------------
# ✅ CSRF bootstrap
# ✅ Session login
# ✅ Session logout
# ✅ WhoAmI current context
# ✅ Profile account management
# ✅ Change password
# ---------------------------------------------------------------
# المسارات الأصلية محفوظة:
# - /api/auth/csrf/
# - /api/auth/login/
# - /api/auth/logout/
# - /api/auth/whoami/
# - /api/auth/profile/
# - /api/auth/change-password/
# ---------------------------------------------------------------
# Aliases آمنة للفرونت:
# - /api/auth/session/
# - /api/auth/me/
# - /api/auth/user/
# - /api/auth/account/
# - /api/auth/password/change/
# ===============================================================

from __future__ import annotations

from django.urls import path

from .change_password import change_password_api
from .csrf import csrf_bootstrap_api
from .login import login_api
from .logout import logout_api
from .profile import profile_api
from .whoami import whoami_api


app_name = "api_auth"


urlpatterns = [
    # ===========================================================
    # 🛡️ CSRF
    # -----------------------------------------------------------
    # GET /api/auth/csrf/
    # ===========================================================
    path(
        "csrf/",
        csrf_bootstrap_api,
        name="csrf",
    ),

    # ===========================================================
    # 🔐 Login
    # -----------------------------------------------------------
    # POST /api/auth/login/
    # يدعم username/email/phone/whatsapp حسب login.py.
    # ===========================================================
    path(
        "login/",
        login_api,
        name="login",
    ),

    # ===========================================================
    # 👤 Current user context
    # -----------------------------------------------------------
    # GET /api/auth/whoami/
    # GET /api/auth/session/
    # GET /api/auth/me/
    # GET /api/auth/user/
    #
    # يرجع:
    # workspace / dashboard_path / entity_type / entity_id
    # provider/customer/agent/broker context
    # permission_codes
    # ===========================================================
    path(
        "whoami/",
        whoami_api,
        name="whoami",
    ),
    path(
        "session/",
        whoami_api,
        name="session",
    ),
    path(
        "me/",
        whoami_api,
        name="me",
    ),
    path(
        "user/",
        whoami_api,
        name="user",
    ),

    # ===========================================================
    # 🧾 Profile / Account
    # -----------------------------------------------------------
    # GET/POST /api/auth/profile/
    # GET/POST /api/auth/account/
    #
    # القاعدة:
    # هذا يدير حساب الدخول فقط.
    # لا يغير بيانات Customer / Provider / Agent / Broker.
    # ===========================================================
    path(
        "profile/",
        profile_api,
        name="profile",
    ),
    path(
        "account/",
        profile_api,
        name="account",
    ),

    # ===========================================================
    # 🔑 Change password
    # -----------------------------------------------------------
    # POST /api/auth/change-password/
    # POST /api/auth/password/change/
    # ===========================================================
    path(
        "change-password/",
        change_password_api,
        name="change-password",
    ),
    path(
        "password/change/",
        change_password_api,
        name="password-change-alias",
    ),

    # ===========================================================
    # 🚪 Logout
    # -----------------------------------------------------------
    # POST /api/auth/logout/
    # ===========================================================
    path(
        "logout/",
        logout_api,
        name="logout",
    ),
]