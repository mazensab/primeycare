from django.urls import path

from .create import notification_center_create_api
from .delete import notification_center_delete_api
from .detail import notification_center_detail_api
from .inbox import notification_center_inbox_api
from .list import notification_center_list_api
from .logs import notification_center_logs_api
from .preferences import notification_center_preferences_api
from .settings import notification_center_settings_api
from .update import notification_center_update_api

app_name = "notification_center_api"

urlpatterns = [
    # --------------------------------------------------------
    # Overview / List
    # --------------------------------------------------------
    path("", notification_center_list_api, name="overview"),
    path("list/", notification_center_list_api, name="list"),
    path("list", notification_center_list_api, name="list_no_slash"),

    # --------------------------------------------------------
    # Inbox
    # --------------------------------------------------------
    path("inbox/", notification_center_inbox_api, name="inbox"),
    path("inbox", notification_center_inbox_api, name="inbox_no_slash"),

    # --------------------------------------------------------
    # Detail
    # --------------------------------------------------------
    path("detail/", notification_center_detail_api, name="detail"),
    path("detail", notification_center_detail_api, name="detail_no_slash"),

    # --------------------------------------------------------
    # Create / Update / Delete
    # --------------------------------------------------------
    path("create/", notification_center_create_api, name="create"),
    path("create", notification_center_create_api, name="create_no_slash"),

    path("update/", notification_center_update_api, name="update"),
    path("update", notification_center_update_api, name="update_no_slash"),

    path("delete/", notification_center_delete_api, name="delete"),
    path("delete", notification_center_delete_api, name="delete_no_slash"),

    # --------------------------------------------------------
    # Preferences / Logs / Settings
    # --------------------------------------------------------
    path("preferences/", notification_center_preferences_api, name="preferences"),
    path("preferences", notification_center_preferences_api, name="preferences_no_slash"),

    path("logs/", notification_center_logs_api, name="logs"),
    path("logs", notification_center_logs_api, name="logs_no_slash"),

    path("settings/", notification_center_settings_api, name="settings"),
    path("settings", notification_center_settings_api, name="settings_no_slash"),
]