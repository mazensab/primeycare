# ===============================================================
# 📂 الملف: api/users/urls.py
# 🧭 Primey Care — Users API URLs
# 🚀 الإصدار: Users API URLs V1.1
# ---------------------------------------------------------------
# ✅ Users list/create/detail
# ✅ Activate / deactivate user account
# ✅ Send password reset link
# ✅ Reset password using uid/token
# ✅ Compatible with:
#    - /api/users/
#    - /api/users/create/
#    - /api/users/<id>/
#    - /api/users/<id>/activate/
#    - /api/users/<id>/deactivate/
#    - /api/users/<id>/send-password-link/
#    - /api/users/reset-password/
# ===============================================================

from django.urls import path

from .activate import users_activate_api
from .create import users_create_api
from .deactivate import users_deactivate_api
from .detail import users_detail_api
from .list import users_list_api
from .reset_password import users_reset_password_api
from .send_password_link import users_send_password_link_api


urlpatterns = [
    # -----------------------------------------------------------
    # Users management
    # -----------------------------------------------------------
    path("", users_list_api, name="api-users-list"),
    path("create/", users_create_api, name="api-users-create"),

    # -----------------------------------------------------------
    # Public password reset endpoint
    # ملاحظة:
    # هذا المسار لا يحتاج login_required داخل view لأنه يستخدم uid/token.
    # يجب أن يبقى قبل <int:user_id>/ حتى لا يحدث تعارض في المطابقة.
    # -----------------------------------------------------------
    path(
        "reset-password/",
        users_reset_password_api,
        name="api-users-reset-password",
    ),

    # توافق إضافي آمن لو استخدم الفرونت اسمًا مختلفًا لاحقًا.
    path(
        "password/reset/",
        users_reset_password_api,
        name="api-users-password-reset",
    ),

    # -----------------------------------------------------------
    # User detail/actions
    # -----------------------------------------------------------
    path("<int:user_id>/", users_detail_api, name="api-users-detail"),
    path(
        "<int:user_id>/activate/",
        users_activate_api,
        name="api-users-activate",
    ),
    path(
        "<int:user_id>/deactivate/",
        users_deactivate_api,
        name="api-users-deactivate",
    ),
    path(
        "<int:user_id>/send-password-link/",
        users_send_password_link_api,
        name="api-users-send-password-link",
    ),
]