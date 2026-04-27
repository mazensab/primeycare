# ============================================================
# 📂 api/notification_center/list.py
# Primey Care - Notification Center List APIs
# ============================================================

from __future__ import annotations

from django.core.paginator import Paginator
from django.db.models import Q
from django.views.decorators.http import require_GET

from notification_center.models import Notification, NotificationDelivery, NotificationEvent

from . import (
    ensure_authenticated,
    json_error,
    json_success,
    serialize_delivery,
    serialize_event,
    serialize_notification,
)


@require_GET
def notification_center_list_api(request):
    auth_error = ensure_authenticated(request)
    if auth_error:
        return auth_error

    resource = (request.GET.get("resource") or "overview").strip().lower()
    search = (request.GET.get("search") or "").strip()
    page = max(int(request.GET.get("page", 1) or 1), 1)
    page_size = min(max(int(request.GET.get("page_size", 20) or 20), 1), 100)

    if resource == "overview":
        recent_notifications = Notification.objects.select_related("recipient", "event").order_by("-created_at")[:5]
        recent_events = NotificationEvent.objects.select_related("actor", "target_user").order_by("-created_at")[:5]
        recent_deliveries = NotificationDelivery.objects.select_related("recipient", "event").order_by("-created_at")[:5]

        data = {
            "counts": {
                "notifications": Notification.objects.count(),
                "events": NotificationEvent.objects.count(),
                "deliveries": NotificationDelivery.objects.count(),
                "unread_notifications": Notification.objects.filter(is_read=False).count(),
                "failed_deliveries": NotificationDelivery.objects.filter(status="failed").count(),
                "pending_events": NotificationEvent.objects.filter(status="pending").count(),
            },
            "recent_notifications": [serialize_notification(obj) for obj in recent_notifications],
            "recent_events": [serialize_event(obj) for obj in recent_events],
            "recent_deliveries": [serialize_delivery(obj) for obj in recent_deliveries],
        }
        return json_success("Notification center overview loaded successfully", data=data)

    queryset = None

    if resource == "notification":
        queryset = Notification.objects.select_related("recipient", "event").all().order_by("-created_at")

        recipient_id = request.GET.get("recipient_id")
        event_id = request.GET.get("event_id")
        severity = request.GET.get("severity")
        notification_type = request.GET.get("notification_type")
        is_read = request.GET.get("is_read")
        company_reference = request.GET.get("company_reference")

        if recipient_id:
            queryset = queryset.filter(recipient_id=recipient_id)
        if event_id:
            queryset = queryset.filter(event_id=event_id)
        if severity:
            queryset = queryset.filter(severity=severity)
        if notification_type:
            queryset = queryset.filter(notification_type=notification_type)
        if is_read in {"true", "false", "1", "0"}:
            queryset = queryset.filter(is_read=is_read in {"true", "1"})
        if company_reference:
            queryset = queryset.filter(company_reference=company_reference)

        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(message__icontains=search)
                | Q(recipient_name__icontains=search)
                | Q(company_name__icontains=search)
            )

    elif resource == "event":
        queryset = NotificationEvent.objects.select_related("actor", "target_user").all().order_by("-created_at")

        event_code = request.GET.get("event_code")
        event_group = request.GET.get("event_group")
        severity = request.GET.get("severity")
        status = request.GET.get("status")
        target_user_id = request.GET.get("target_user_id")
        company_reference = request.GET.get("company_reference")

        if event_code:
            queryset = queryset.filter(event_code=event_code)
        if event_group:
            queryset = queryset.filter(event_group=event_group)
        if severity:
            queryset = queryset.filter(severity=severity)
        if status:
            queryset = queryset.filter(status=status)
        if target_user_id:
            queryset = queryset.filter(target_user_id=target_user_id)
        if company_reference:
            queryset = queryset.filter(company_reference=company_reference)

        if search:
            queryset = queryset.filter(
                Q(event_code__icontains=search)
                | Q(event_group__icontains=search)
                | Q(title__icontains=search)
                | Q(message__icontains=search)
                | Q(source__icontains=search)
                | Q(company_name__icontains=search)
            )

    elif resource == "delivery":
        queryset = NotificationDelivery.objects.select_related("recipient", "event", "notification").all().order_by("-created_at")

        event_id = request.GET.get("event_id")
        recipient_id = request.GET.get("recipient_id")
        channel = request.GET.get("channel")
        status = request.GET.get("status")
        template_key = request.GET.get("template_key")
        company_reference = request.GET.get("company_reference")

        if event_id:
            queryset = queryset.filter(event_id=event_id)
        if recipient_id:
            queryset = queryset.filter(recipient_id=recipient_id)
        if channel:
            queryset = queryset.filter(channel=channel)
        if status:
            queryset = queryset.filter(status=status)
        if template_key:
            queryset = queryset.filter(template_key=template_key)
        if company_reference:
            queryset = queryset.filter(company_reference=company_reference)

        if search:
            queryset = queryset.filter(
                Q(destination__icontains=search)
                | Q(subject__icontains=search)
                | Q(provider_name__icontains=search)
                | Q(provider_message_id__icontains=search)
                | Q(error_message__icontains=search)
                | Q(company_name__icontains=search)
            )

    else:
        return json_error(
            "Invalid resource. Allowed: overview, notification, event, delivery",
            error="INVALID_RESOURCE",
            status=400,
        )

    paginator = Paginator(queryset, page_size)
    page_obj = paginator.get_page(page)

    if resource == "notification":
        data = [serialize_notification(obj) for obj in page_obj.object_list]
    elif resource == "event":
        data = [serialize_event(obj) for obj in page_obj.object_list]
    else:
        data = [serialize_delivery(obj) for obj in page_obj.object_list]

    return json_success(
        "Notification center list loaded successfully",
        data=data,
        meta={
            "resource": resource,
            "page": page_obj.number,
            "page_size": page_size,
            "total_pages": paginator.num_pages,
            "total_items": paginator.count,
            "has_next": page_obj.has_next(),
            "has_previous": page_obj.has_previous(),
        },
    )