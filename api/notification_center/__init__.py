# ============================================================
# 📂 api/notification_center/__init__.py
# Primey Care - Notification Center API Helpers
# ============================================================

from __future__ import annotations

import json
from typing import Any

from django.http import JsonResponse

from notification_center.models import (
    Notification,
    NotificationChannel,
    NotificationDelivery,
    NotificationDeliveryStatus,
    NotificationEvent,
    NotificationEventStatus,
    NotificationSeverity,
)

RESOURCE_MODEL_MAP = {
    "notification": Notification,
    "event": NotificationEvent,
    "delivery": NotificationDelivery,
}


def ensure_authenticated(request):
    if not getattr(request, "user", None) or not request.user.is_authenticated:
        return JsonResponse(
            {
                "ok": False,
                "message": "Unauthorized",
                "error": "AUTHENTICATION_REQUIRED",
            },
            status=401,
        )
    return None


def parse_json_body(request) -> dict[str, Any]:
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError("Invalid JSON body") from exc


def json_success(
    message: str,
    data: Any | None = None,
    *,
    status: int = 200,
    meta: dict[str, Any] | None = None,
    **extra,
):
    payload = {
        "ok": True,
        "message": message,
        "data": data,
    }
    if meta is not None:
        payload["meta"] = meta
    payload.update(extra)
    return JsonResponse(payload, status=status)


def json_error(
    message: str,
    *,
    error: str = "BAD_REQUEST",
    status: int = 400,
    details: Any | None = None,
    **extra,
):
    payload = {
        "ok": False,
        "message": message,
        "error": error,
    }
    if details is not None:
        payload["details"] = details
    payload.update(extra)
    return JsonResponse(payload, status=status)


def get_required_value(payload: dict, key: str):
    value = payload.get(key)
    if value in (None, "", []):
        raise ValueError(f"'{key}' is required")
    return value


def to_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


def to_int(value, field_name: str, min_value: int | None = None):
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"'{field_name}' must be an integer")
    if min_value is not None and number < min_value:
        raise ValueError(f"'{field_name}' must be >= {min_value}")
    return number


def clean_text(value) -> str:
    return str(value or "").strip()


def get_object_or_error(model, object_id):
    try:
        return model.objects.get(pk=object_id)
    except model.DoesNotExist:
        raise LookupError(f"{model.__name__} with id={object_id} was not found")


def resolve_resource_model(resource: str):
    model = RESOURCE_MODEL_MAP.get((resource or "").strip().lower())
    if not model:
        raise ValueError("Invalid resource. Allowed: notification, event, delivery")
    return model


SEVERITY_VALUES = {choice[0] for choice in NotificationSeverity.choices}
EVENT_STATUS_VALUES = {choice[0] for choice in NotificationEventStatus.choices}
CHANNEL_VALUES = {choice[0] for choice in NotificationChannel.choices}
DELIVERY_STATUS_VALUES = {choice[0] for choice in NotificationDeliveryStatus.choices}


def serialize_notification(obj: Notification):
    return {
        "id": obj.id,
        "company_reference": obj.company_reference,
        "company_name": obj.company_name,
        "recipient_id": obj.recipient_id,
        "recipient_name": obj.recipient_name,
        "title": obj.title,
        "message": obj.message,
        "notification_type": obj.notification_type,
        "severity": obj.severity,
        "link": obj.link,
        "event_id": obj.event_id,
        "is_read": obj.is_read,
        "read_at": obj.read_at.isoformat() if obj.read_at else None,
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
    }


def serialize_event(obj: NotificationEvent, include_nested: bool = False):
    data = {
        "id": obj.id,
        "company_reference": obj.company_reference,
        "company_name": obj.company_name,
        "actor_id": obj.actor_id,
        "target_user_id": obj.target_user_id,
        "event_code": obj.event_code,
        "event_group": obj.event_group,
        "severity": obj.severity,
        "status": obj.status,
        "language_code": obj.language_code,
        "target_model": obj.target_model,
        "target_object_id": obj.target_object_id,
        "title": obj.title,
        "message": obj.message,
        "link": obj.link,
        "context": obj.context or {},
        "source": obj.source,
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "processed_at": obj.processed_at.isoformat() if obj.processed_at else None,
    }
    if include_nested:
        data["notifications"] = [serialize_notification(note) for note in obj.notifications.all().order_by("-created_at")]
        data["deliveries"] = [serialize_delivery(delivery) for delivery in obj.deliveries.all().order_by("-created_at")]
    return data


def serialize_delivery(obj: NotificationDelivery):
    return {
        "id": obj.id,
        "event_id": obj.event_id,
        "company_reference": obj.company_reference,
        "company_name": obj.company_name,
        "recipient_id": obj.recipient_id,
        "channel": obj.channel,
        "status": obj.status,
        "destination": obj.destination,
        "subject": obj.subject,
        "rendered_message": obj.rendered_message,
        "template_key": obj.template_key,
        "language_code": obj.language_code,
        "provider_name": obj.provider_name,
        "provider_message_id": obj.provider_message_id,
        "provider_response": obj.provider_response or {},
        "error_message": obj.error_message,
        "attempts": obj.attempts,
        "max_attempts": obj.max_attempts,
        "notification_id": obj.notification_id,
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "last_attempt_at": obj.last_attempt_at.isoformat() if obj.last_attempt_at else None,
        "sent_at": obj.sent_at.isoformat() if obj.sent_at else None,
    }


def serialize_instance(instance, include_nested: bool = False):
    if isinstance(instance, Notification):
        return serialize_notification(instance)
    if isinstance(instance, NotificationEvent):
        return serialize_event(instance, include_nested=include_nested)
    if isinstance(instance, NotificationDelivery):
        return serialize_delivery(instance)
    raise ValueError("Unsupported instance type")