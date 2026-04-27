# ===============================================================
# 📂 الملف: api/auth/urls.py
# 🧭 Primey Care — Auth API URLs
# ===============================================================

from django.urls import path

from .change_password import change_password_api
from .csrf import csrf_bootstrap_api
from .login import login_api
from .logout import logout_api
from .profile import profile_api
from .whoami import whoami_api

urlpatterns = [
    path("csrf/", csrf_bootstrap_api, name="api-auth-csrf"),
    path("login/", login_api, name="api-auth-login"),
    path("logout/", logout_api, name="api-auth-logout"),
    path("whoami/", whoami_api, name="api-auth-whoami"),
    path("profile/", profile_api, name="api-auth-profile"),
    path("change-password/", change_password_api, name="api-auth-change-password"),
]