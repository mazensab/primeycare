from django.urls import path

from .create import notification_center_create_api
from .delete import notification_center_delete_api
from .detail import notification_center_detail_api
from .list import notification_center_list_api
from .logs import notification_center_logs_api
from .preferences import notification_center_preferences_api
from .settings import notification_center_settings_api
from .update import notification_center_update_api

app_name = "notification_center_api"

urlpatterns = [
    path("", notification_center_list_api, name="overview"),
    path("list/", notification_center_list_api, name="list"),
    path("detail/", notification_center_detail_api, name="detail"),
    path("create/", notification_center_create_api, name="create"),
    path("update/", notification_center_update_api, name="update"),
    path("delete/", notification_center_delete_api, name="delete"),
    path("preferences/", notification_center_preferences_api, name="preferences"),
    path("logs/", notification_center_logs_api, name="logs"),
    path("settings/", notification_center_settings_api, name="settings"),
]