# ============================================================
# 📂 api/notification_center/update.py
# Primey Care - Notification Center Update API
# ============================================================

from __future__ import annotations

from django.db import transaction
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from notification_center.models import (
    Notification,
    NotificationDelivery,
    NotificationEvent,
)

from . import (
    CHANNEL_VALUES,
    DELIVERY_STATUS_VALUES,
    EVENT_STATUS_VALUES,
    SEVERITY_VALUES,
    clean_text,
    ensure_authenticated,
    get_object_or_error,
    json_error,
    json_success,
    parse_json_body,
    resolve_resource_model,
    serialize_instance,
    to_bool,
    to_int,
)


@require_http_methods(["PUT", "PATCH", "POST"])
@transaction.atomic
def notification_center_update_api(request):
    auth_error = ensure_authenticated(request)
    if auth_error:
        return auth_error

    try:
        payload = parse_json_body(request)
        resource = (payload.get("resource") or "").strip().lower()
        object_id = payload.get("id")

        if not resource:
            return json_error("Field 'resource' is required", error="RESOURCE_REQUIRED")
        if object_id in (None, ""):
            return json_error("Field 'id' is required", error="ID_REQUIRED")

        model = resolve_resource_model(resource)
        instance = get_object_or_error(model, object_id)

        if resource == "notification":
            note: Notification = instance

            if "recipient_id" in payload:
                note.recipient_id = to_int(payload.get("recipient_id"), "recipient_id", 1)
            if "recipient_name" in payload:
                note.recipient_name = clean_text(payload.get("recipient_name"))
            if "title" in payload:
                note.title = clean_text(payload.get("title"))
            if "message" in payload:
                note.message = clean_text(payload.get("message"))
            if "notification_type" in payload:
                note.notification_type = clean_text(payload.get("notification_type"))
            if "severity" in payload:
                severity = clean_text(payload.get("severity")).lower()
                if severity not in SEVERITY_VALUES:
                    return json_error("Invalid severity", error="INVALID_SEVERITY")
                note.severity = severity
            if "link" in payload:
                note.link = clean_text(payload.get("link"))
            if "is_read" in payload:
                is_read = to_bool(payload.get("is_read"), note.is_read)
                note.is_read = is_read
                note.read_at = timezone.now() if is_read else None
            if "event_id" in payload:
                note.event_id = to_int(payload.get("event_id"), "event_id", 1)

            note.save()
            return json_success(
                "Notification updated successfully",
                data=serialize_instance(note),
            )

        if resource == "event":
            event: NotificationEvent = instance

            if "company_reference" in payload:
                event.company_reference = clean_text(payload.get("company_reference"))
            if "company_name" in payload:
                event.company_name = clean_text(payload.get("company_name"))
            if "actor_id" in payload:
                event.actor_id = to_int(payload.get("actor_id"), "actor_id", 1) if payload.get("actor_id") not in (None, "") else None
            if "target_user_id" in payload:
                event.target_user_id = to_int(payload.get("target_user_id"), "target_user_id", 1) if payload.get("target_user_id") not in (None, "") else None
            if "event_code" in payload:
                event.event_code = clean_text(payload.get("event_code"))
            if "event_group" in payload:
                event.event_group = clean_text(payload.get("event_group"))
            if "severity" in payload:
                severity = clean_text(payload.get("severity")).lower()
                if severity not in SEVERITY_VALUES:
                    return json_error("Invalid severity", error="INVALID_SEVERITY")
                event.severity = severity
            if "status" in payload:
                status_value = clean_text(payload.get("status"))
                if status_value not in EVENT_STATUS_VALUES:
                    return json_error("Invalid event status", error="INVALID_EVENT_STATUS")
                event.status = status_value
                event.processed_at = timezone.now() if status_value in {"processed", "partial", "failed", "cancelled"} else None
            if "language_code" in payload:
                event.language_code = clean_text(payload.get("language_code"))
            if "target_model" in payload:
                event.target_model = clean_text(payload.get("target_model"))
            if "target_object_id" in payload:
                event.target_object_id = clean_text(payload.get("target_object_id"))
            if "title" in payload:
                event.title = clean_text(payload.get("title"))
            if "message" in payload:
                event.message = clean_text(payload.get("message"))
            if "link" in payload:
                event.link = clean_text(payload.get("link"))
            if "context" in payload:
                event.context = payload.get("context") if isinstance(payload.get("context"), dict) else {}
            if "source" in payload:
                event.source = clean_text(payload.get("source"))

            event.save()
            return json_success(
                "Notification event updated successfully",
                data=serialize_instance(event, include_nested=True),
            )

        if resource == "delivery":
            delivery: NotificationDelivery = instance

            if "event_id" in payload:
                delivery.event_id = to_int(payload.get("event_id"), "event_id", 1)
            if "company_reference" in payload:
                delivery.company_reference = clean_text(payload.get("company_reference"))
            if "company_name" in payload:
                delivery.company_name = clean_text(payload.get("company_name"))
            if "recipient_id" in payload:
                delivery.recipient_id = to_int(payload.get("recipient_id"), "recipient_id", 1) if payload.get("recipient_id") not in (None, "") else None
            if "channel" in payload:
                channel = clean_text(payload.get("channel"))
                if channel not in CHANNEL_VALUES:
                    return json_error("Invalid channel", error="INVALID_CHANNEL")
                delivery.channel = channel
            if "status" in payload:
                status_value = clean_text(payload.get("status"))
                if status_value not in DELIVERY_STATUS_VALUES:
                    return json_error("Invalid delivery status", error="INVALID_DELIVERY_STATUS")
                delivery.status = status_value
                if status_value == "sent" and delivery.sent_at is None:
                    delivery.sent_at = timezone.now()
                delivery.last_attempt_at = timezone.now()
            if "destination" in payload:
                delivery.destination = clean_text(payload.get("destination"))
            if "subject" in payload:
                delivery.subject = clean_text(payload.get("subject"))
            if "rendered_message" in payload:
                delivery.rendered_message = clean_text(payload.get("rendered_message"))
            if "template_key" in payload:
                delivery.template_key = clean_text(payload.get("template_key"))
            if "language_code" in payload:
                delivery.language_code = clean_text(payload.get("language_code"))
            if "provider_name" in payload:
                delivery.provider_name = clean_text(payload.get("provider_name"))
            if "provider_message_id" in payload:
                delivery.provider_message_id = clean_text(payload.get("provider_message_id"))
            if "provider_response" in payload:
                delivery.provider_response = payload.get("provider_response") if isinstance(payload.get("provider_response"), dict) else {}
            if "error_message" in payload:
                delivery.error_message = clean_text(payload.get("error_message"))
            if "attempts" in payload:
                delivery.attempts = to_int(payload.get("attempts"), "attempts", 0)
            if "max_attempts" in payload:
                delivery.max_attempts = to_int(payload.get("max_attempts"), "max_attempts", 1)
            if "notification_id" in payload:
                delivery.notification_id = to_int(payload.get("notification_id"), "notification_id", 1) if payload.get("notification_id") not in (None, "") else None

            delivery.save()
            return json_success(
                "Notification delivery updated successfully",
                data=serialize_instance(delivery),
            )

        return json_error("Unsupported resource", error="INVALID_RESOURCE")

    except ValueError as exc:
        return json_error(str(exc), error="VALIDATION_ERROR")
    except LookupError as exc:
        return json_error(str(exc), error="NOT_FOUND", status=404)
    except Exception as exc:
        return json_error(
            "Failed to update notification center record",
            error="UPDATE_FAILED",
            status=500,
            details=str(exc),
        )