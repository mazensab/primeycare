# ============================================================
# 📂 api/notification_center/create.py
# Primey Care - Notification Center Create API
# ============================================================

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction
from django.views.decorators.http import require_POST

from notification_center.models import (
    Notification,
    NotificationChannel,
    NotificationDelivery,
    NotificationDeliveryStatus,
    NotificationEvent,
    NotificationEventStatus,
)
from notification_center.services import create_notification

from . import (
    CHANNEL_VALUES,
    DELIVERY_STATUS_VALUES,
    EVENT_STATUS_VALUES,
    SEVERITY_VALUES,
    clean_text,
    ensure_authenticated,
    get_object_or_error,
    get_required_value,
    json_error,
    json_success,
    parse_json_body,
    serialize_instance,
    to_bool,
    to_int,
)

User = get_user_model()


@require_POST
@transaction.atomic
def notification_center_create_api(request):
    auth_error = ensure_authenticated(request)
    if auth_error:
        return auth_error

    try:
        payload = parse_json_body(request)
        resource = (payload.get("resource") or "").strip().lower()

        if not resource:
            return json_error("Field 'resource' is required", error="RESOURCE_REQUIRED")

        if resource == "notification":
            recipient_id = payload.get("recipient_id")
            title = clean_text(get_required_value(payload, "title"))
            message = clean_text(get_required_value(payload, "message"))
            notification_type = clean_text(payload.get("notification_type") or "system")
            severity = clean_text(payload.get("severity") or "info").lower()
            link = clean_text(payload.get("link"))
            send_email = to_bool(payload.get("send_email"), False)
            send_whatsapp = to_bool(payload.get("send_whatsapp"), False)

            if severity not in SEVERITY_VALUES:
                return json_error(
                    f"Invalid severity. Allowed: {sorted(SEVERITY_VALUES)}",
                    error="INVALID_SEVERITY",
                )

            recipient = None
            if recipient_id not in (None, ""):
                recipient = get_object_or_error(User, recipient_id)

            note = create_notification(
                recipient=recipient,
                title=title,
                message=message,
                notification_type=notification_type,
                severity=severity,
                send_email=send_email,
                send_whatsapp=send_whatsapp,
                link=link,
                language_code=clean_text(payload.get("language_code") or "ar"),
                event_code=clean_text(payload.get("event_code") or notification_type),
                event_group=clean_text(payload.get("event_group") or notification_type),
                context=payload.get("context") if isinstance(payload.get("context"), dict) else {},
                email_recipients=payload.get("email_recipients"),
                email_subject=payload.get("email_subject"),
                email_text_message=payload.get("email_text_message"),
                email_html_message=payload.get("email_html_message"),
                email_attachments=payload.get("email_attachments"),
                whatsapp_phone=payload.get("whatsapp_phone"),
                whatsapp_recipient_name=payload.get("whatsapp_recipient_name"),
                whatsapp_recipient_role=clean_text(payload.get("whatsapp_recipient_role") or "user"),
                whatsapp_attachment_url=clean_text(payload.get("whatsapp_attachment_url")),
                whatsapp_attachment_name=clean_text(payload.get("whatsapp_attachment_name")),
                whatsapp_mime_type=clean_text(payload.get("whatsapp_mime_type")),
            )

            if not note:
                return json_error(
                    "Failed to create notification",
                    error="NOTIFICATION_CREATE_FAILED",
                    status=500,
                )

            return json_success(
                "Notification created successfully",
                data=serialize_instance(note),
                status=201,
            )

        if resource == "event":
            event_code = clean_text(get_required_value(payload, "event_code"))
            event_group = clean_text(payload.get("event_group") or "system")
            severity = clean_text(payload.get("severity") or "info").lower()
            status_value = clean_text(payload.get("status") or NotificationEventStatus.PENDING)
            language_code = clean_text(payload.get("language_code") or "ar")

            if severity not in SEVERITY_VALUES:
                return json_error("Invalid severity", error="INVALID_SEVERITY")
            if status_value not in EVENT_STATUS_VALUES:
                return json_error("Invalid event status", error="INVALID_EVENT_STATUS")

            instance = NotificationEvent.objects.create(
                company_reference=clean_text(payload.get("company_reference")),
                company_name=clean_text(payload.get("company_name")),
                actor_id=to_int(payload.get("actor_id"), "actor_id", 1) if payload.get("actor_id") not in (None, "") else None,
                target_user_id=to_int(payload.get("target_user_id"), "target_user_id", 1) if payload.get("target_user_id") not in (None, "") else None,
                event_code=event_code,
                event_group=event_group,
                severity=severity,
                status=status_value,
                language_code=language_code,
                target_model=clean_text(payload.get("target_model")),
                target_object_id=clean_text(payload.get("target_object_id")),
                title=clean_text(payload.get("title")),
                message=clean_text(payload.get("message")),
                link=clean_text(payload.get("link")),
                context=payload.get("context") if isinstance(payload.get("context"), dict) else {},
                source=clean_text(payload.get("source")),
            )
            return json_success(
                "Notification event created successfully",
                data=serialize_instance(instance),
                status=201,
            )

        if resource == "delivery":
            event_id = to_int(get_required_value(payload, "event_id"), "event_id", 1)
            channel = clean_text(get_required_value(payload, "channel"))
            status_value = clean_text(payload.get("status") or NotificationDeliveryStatus.PENDING)
            language_code = clean_text(payload.get("language_code") or "ar")

            if channel not in CHANNEL_VALUES:
                return json_error("Invalid channel", error="INVALID_CHANNEL")
            if status_value not in DELIVERY_STATUS_VALUES:
                return json_error("Invalid delivery status", error="INVALID_DELIVERY_STATUS")

            get_object_or_error(NotificationEvent, event_id)

            instance = NotificationDelivery.objects.create(
                event_id=event_id,
                company_reference=clean_text(payload.get("company_reference")),
                company_name=clean_text(payload.get("company_name")),
                recipient_id=to_int(payload.get("recipient_id"), "recipient_id", 1) if payload.get("recipient_id") not in (None, "") else None,
                channel=channel,
                status=status_value,
                destination=clean_text(payload.get("destination")),
                subject=clean_text(payload.get("subject")),
                rendered_message=clean_text(payload.get("rendered_message")),
                template_key=clean_text(payload.get("template_key")),
                language_code=language_code,
                provider_name=clean_text(payload.get("provider_name")),
                provider_message_id=clean_text(payload.get("provider_message_id")),
                provider_response=payload.get("provider_response") if isinstance(payload.get("provider_response"), dict) else {},
                error_message=clean_text(payload.get("error_message")),
                attempts=to_int(payload.get("attempts", 0), "attempts", 0),
                max_attempts=to_int(payload.get("max_attempts", 3), "max_attempts", 1),
                notification_id=to_int(payload.get("notification_id"), "notification_id", 1) if payload.get("notification_id") not in (None, "") else None,
            )
            return json_success(
                "Notification delivery created successfully",
                data=serialize_instance(instance),
                status=201,
            )

        return json_error(
            "Invalid resource. Allowed: notification, event, delivery",
            error="INVALID_RESOURCE",
        )

    except ValueError as exc:
        return json_error(str(exc), error="VALIDATION_ERROR")
    except LookupError as exc:
        return json_error(str(exc), error="NOT_FOUND", status=404)
    except Exception as exc:
        return json_error(
            "Failed to create notification center record",
            error="CREATE_FAILED",
            status=500,
            details=str(exc),
        )