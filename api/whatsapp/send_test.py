# ============================================================
# 📂 api/whatsapp/send_test.py
# Primey Care - System WhatsApp Test Send API
# ============================================================

from __future__ import annotations

from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST

from whatsapp_center.models import ScopeType, TriggerSource
from whatsapp_center.services import send_event_whatsapp_message
from api.whatsapp.helpers import (
    clean_phone,
    json_bad_request,
    json_ok,
    json_server_error,
    read_json_body,
)


@login_required
@require_POST
def system_whatsapp_send_test(request):
    try:
        body = read_json_body(request)
    except ValueError as exc:
        return json_bad_request(str(exc))

    recipient_phone = clean_phone(
        body.get("phone_number")
        or body.get("recipient_phone")
        or ""
    )
    recipient_name = (body.get("recipient_name") or "User").strip()
    message = (
        body.get("message")
        or "This is a system WhatsApp test message from Primey Care."
    ).strip()

    if not recipient_phone:
        return json_bad_request("phone_number is required")

    try:
        log = send_event_whatsapp_message(
            scope_type=ScopeType.SYSTEM,
            trigger_source=TriggerSource.BROADCAST,
            event_code="system_test_message",
            recipient_phone=recipient_phone,
            recipient_name=recipient_name,
            context={
                "recipient_name": recipient_name,
                "message": message,
            },
            related_model="SystemWhatsAppConfig",
            related_object_id="1",
        )

        return json_ok(
            "System WhatsApp test message processed",
            data={
                "log_id": getattr(log, "id", None),
                "delivery_status": getattr(log, "delivery_status", ""),
                "provider_status": getattr(log, "provider_status", ""),
                "failure_reason": getattr(log, "failure_reason", ""),
                "recipient_phone": recipient_phone,
                "recipient_name": recipient_name,
                "event_code": "system_test_message",
            },
        )

    except Exception as exc:
        return json_server_error(
            "Failed to process system WhatsApp test message",
            error=str(exc),
            data={
                "recipient_phone": recipient_phone,
                "recipient_name": recipient_name,
                "event_code": "system_test_message",
            },
        )