# ===============================================================
# 📂 الملف: api/users/urls.py
# 🧭 Primey Care — Users API URLs
# ===============================================================

from django.urls import path

from .activate import users_activate_api
from .create import users_create_api
from .deactivate import users_deactivate_api
from .detail import users_detail_api
from .list import users_list_api
from .send_password_link import users_send_password_link_api

urlpatterns = [
    path("", users_list_api, name="api-users-list"),
    path("create/", users_create_api, name="api-users-create"),
    path("<int:user_id>/", users_detail_api, name="api-users-detail"),
    path("<int:user_id>/activate/", users_activate_api, name="api-users-activate"),
    path("<int:user_id>/deactivate/", users_deactivate_api, name="api-users-deactivate"),
    path("<int:user_id>/send-password-link/", users_send_password_link_api, name="api-users-send-password-link"),
]