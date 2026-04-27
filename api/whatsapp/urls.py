# ============================================================
# 📂 api/whatsapp/urls.py
# Primey Care - WhatsApp API URLs
# ============================================================

from django.urls import path

from .broadcasts import (
    system_whatsapp_broadcast_create,
    system_whatsapp_broadcast_detail,
    system_whatsapp_broadcast_execute,
    system_whatsapp_broadcasts,
)
from .inbox import (
    system_whatsapp_conversation_detail,
    system_whatsapp_conversation_messages,
    system_whatsapp_inbox_list,
    system_whatsapp_inbox_summary,
    system_whatsapp_mark_conversation_read,
    system_whatsapp_toggle_conversation_pinned,
    system_whatsapp_toggle_conversation_resolved,
    system_whatsapp_update_conversation_status,
)
from .logs import system_whatsapp_logs
from .send_test import system_whatsapp_send_test
from .settings import (
    system_whatsapp_settings,
    system_whatsapp_settings_update,
)
from .status import (
    system_whatsapp_session_create_pairing_code,
    system_whatsapp_session_create_qr,
    system_whatsapp_session_disconnect,
    system_whatsapp_status,
)
from .templates import (
    system_whatsapp_template_create,
    system_whatsapp_template_delete,
    system_whatsapp_template_toggle,
    system_whatsapp_template_update,
    system_whatsapp_templates,
)
from .webhook import (
    system_whatsapp_webhook_receive,
    system_whatsapp_webhook_verify,
)

app_name = "whatsapp_api"

urlpatterns = [
    # ========================================================
    # Settings
    # ========================================================
    path("settings/", system_whatsapp_settings, name="settings"),
    path("settings/update/", system_whatsapp_settings_update, name="settings_update"),

    # ========================================================
    # Status + Sessions
    # ========================================================
    path("status/", system_whatsapp_status, name="status"),
    path("session/create-qr/", system_whatsapp_session_create_qr, name="session_create_qr"),
    path(
        "session/create-pairing-code/",
        system_whatsapp_session_create_pairing_code,
        name="session_create_pairing_code",
    ),
    path(
        "session/disconnect/",
        system_whatsapp_session_disconnect,
        name="session_disconnect",
    ),

    # ========================================================
    # Test Send
    # ========================================================
    path("send-test/", system_whatsapp_send_test, name="send_test"),

    # ========================================================
    # Templates
    # ========================================================
    path("templates/", system_whatsapp_templates, name="templates"),
    path("templates/create/", system_whatsapp_template_create, name="template_create"),
    path("templates/<int:template_id>/update/", system_whatsapp_template_update, name="template_update"),
    path("templates/<int:template_id>/toggle/", system_whatsapp_template_toggle, name="template_toggle"),
    path("templates/<int:template_id>/delete/", system_whatsapp_template_delete, name="template_delete"),

    # ========================================================
    # Logs
    # ========================================================
    path("logs/", system_whatsapp_logs, name="logs"),

    # ========================================================
    # Broadcasts
    # ========================================================
    path("broadcasts/", system_whatsapp_broadcasts, name="broadcasts"),
    path("broadcasts/create/", system_whatsapp_broadcast_create, name="broadcast_create"),
    path("broadcasts/<int:broadcast_id>/", system_whatsapp_broadcast_detail, name="broadcast_detail"),
    path(
        "broadcasts/<int:broadcast_id>/execute/",
        system_whatsapp_broadcast_execute,
        name="broadcast_execute",
    ),

    # ========================================================
    # Inbox
    # ========================================================
    path("inbox/summary/", system_whatsapp_inbox_summary, name="inbox_summary"),
    path("inbox/conversations/", system_whatsapp_inbox_list, name="inbox_conversations"),
    path(
        "inbox/conversations/<int:conversation_id>/",
        system_whatsapp_conversation_detail,
        name="conversation_detail",
    ),
    path(
        "inbox/conversations/<int:conversation_id>/messages/",
        system_whatsapp_conversation_messages,
        name="conversation_messages",
    ),
    path(
        "inbox/conversations/<int:conversation_id>/mark-read/",
        system_whatsapp_mark_conversation_read,
        name="conversation_mark_read",
    ),
    path(
        "inbox/conversations/<int:conversation_id>/status/",
        system_whatsapp_update_conversation_status,
        name="conversation_update_status",
    ),
    path(
        "inbox/conversations/<int:conversation_id>/toggle-resolved/",
        system_whatsapp_toggle_conversation_resolved,
        name="conversation_toggle_resolved",
    ),
    path(
        "inbox/conversations/<int:conversation_id>/toggle-pinned/",
        system_whatsapp_toggle_conversation_pinned,
        name="conversation_toggle_pinned",
    ),

    # ========================================================
    # Webhook
    # ========================================================
    path("webhook/verify/", system_whatsapp_webhook_verify, name="webhook_verify"),
    path("webhook/receive/", system_whatsapp_webhook_receive, name="webhook_receive"),
]