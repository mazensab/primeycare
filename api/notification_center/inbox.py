# ============================================================
# 📂 api/notification_center/inbox.py
# Primey Care - Notification Center Inbox API
# ------------------------------------------------------------
# ✅ صندوق إشعارات المستخدم الحالي
# ✅ unread_count
# ✅ latest
# ✅ mark_read
# ✅ mark_all_read
# ✅ مناسب للـ Header / Bell / Notifications Page
# ============================================================

from __future__ import annotations

from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from notification_center.models import Notification

from . import (
    clean_text,
    ensure_authenticated,
    json_error,
    json_success,
    parse_json_body,
    serialize_notification,
    to_bool,
    to_int,
)


def _parse_positive_int(value, field_name: str, default: int, minimum: int = 1, maximum: int = 100):
    try:
        number = int(value)
    except (TypeError, ValueError):
        number = default

    if number < minimum:
        number = minimum

    if number > maximum:
        number = maximum

    return number


def _serialize_inbox_notification(notification: Notification) -> dict:
    """
    Serializer مخصص لصندوق الإشعارات.
    يعتمد على serialize_notification الحالي ويضيف حقول مفيدة للواجهة.
    """
    data = serialize_notification(notification)

    data.update(
        {
            "id": notification.id,
            "title": notification.title,
            "message": notification.message,
            "notification_type": notification.notification_type,
            "severity": notification.severity,
            "link": notification.link or "",
            "is_read": notification.is_read,
            "read_at": notification.read_at.isoformat() if notification.read_at else None,
            "created_at": notification.created_at.isoformat() if notification.created_at else None,
            "recipient_id": notification.recipient_id,
            "event_id": notification.event_id,
        }
    )

    return data


def _base_queryset(user):
    return (
        Notification.objects
        .select_related("recipient", "event")
        .filter(recipient=user)
        .order_by("-created_at")
    )


def _apply_filters(queryset, request):
    search = clean_text(request.GET.get("search"))
    notification_type = clean_text(request.GET.get("notification_type"))
    severity = clean_text(request.GET.get("severity")).lower()
    is_read_raw = clean_text(request.GET.get("is_read")).lower()
    event_id = clean_text(request.GET.get("event_id"))
    company_reference = clean_text(request.GET.get("company_reference"))

    if notification_type:
        queryset = queryset.filter(notification_type=notification_type)

    if severity:
        queryset = queryset.filter(severity=severity)

    if is_read_raw in {"true", "1", "yes", "read"}:
        queryset = queryset.filter(is_read=True)
    elif is_read_raw in {"false", "0", "no", "unread"}:
        queryset = queryset.filter(is_read=False)

    if event_id:
        queryset = queryset.filter(event_id=event_id)

    if company_reference:
        queryset = queryset.filter(company_reference=company_reference)

    if search:
        queryset = queryset.filter(
            Q(title__icontains=search)
            | Q(message__icontains=search)
            | Q(notification_type__icontains=search)
            | Q(recipient_name__icontains=search)
            | Q(company_name__icontains=search)
        )

    return queryset


def _counts_for_user(user) -> dict:
    queryset = Notification.objects.filter(recipient=user)

    return {
        "total": queryset.count(),
        "unread": queryset.filter(is_read=False).count(),
        "read": queryset.filter(is_read=True).count(),
        "info": queryset.filter(severity="info").count(),
        "success": queryset.filter(severity="success").count(),
        "warning": queryset.filter(severity="warning").count(),
        "error": queryset.filter(severity="error").count(),
        "critical": queryset.filter(severity="critical").count(),
    }


@require_http_methods(["GET", "POST"])
@transaction.atomic
def notification_center_inbox_api(request):
    auth_error = ensure_authenticated(request)
    if auth_error:
        return auth_error

    user = request.user

    if request.method == "GET":
        action = clean_text(request.GET.get("action") or "list").lower()

        if action == "count":
            return json_success(
                "Notification unread count loaded successfully",
                data={
                    "unread_count": Notification.objects.filter(
                        recipient=user,
                        is_read=False,
                    ).count(),
                    "counts": _counts_for_user(user),
                },
            )

        if action == "latest":
            limit = _parse_positive_int(
                request.GET.get("limit"),
                "limit",
                default=5,
                minimum=1,
                maximum=20,
            )

            queryset = _base_queryset(user).filter(is_read=False)[:limit]
            results = [_serialize_inbox_notification(item) for item in queryset]

            return json_success(
                "Latest unread notifications loaded successfully",
                data=results,
                results=results,
                count=len(results),
                meta={
                    "action": "latest",
                    "limit": limit,
                    "unread_count": Notification.objects.filter(
                        recipient=user,
                        is_read=False,
                    ).count(),
                },
            )

        page = _parse_positive_int(
            request.GET.get("page"),
            "page",
            default=1,
            minimum=1,
            maximum=100000,
        )
        page_size = _parse_positive_int(
            request.GET.get("page_size"),
            "page_size",
            default=20,
            minimum=1,
            maximum=100,
        )

        queryset = _apply_filters(_base_queryset(user), request)

        paginator = Paginator(queryset, page_size)
        page_obj = paginator.get_page(page)

        results = [_serialize_inbox_notification(item) for item in page_obj.object_list]

        return json_success(
            "Notification inbox loaded successfully",
            data=results,
            results=results,
            count=len(results),
            meta={
                "action": "list",
                "page": page_obj.number,
                "page_size": page_size,
                "total_pages": paginator.num_pages,
                "total_items": paginator.count,
                "has_next": page_obj.has_next(),
                "has_previous": page_obj.has_previous(),
                "counts": _counts_for_user(user),
            },
        )

    payload = parse_json_body(request)
    action = clean_text(payload.get("action") or "mark_read").lower()

    if action == "mark_read":
        notification_id = payload.get("id") or payload.get("notification_id")

        if notification_id in (None, ""):
            return json_error(
                "Field 'id' or 'notification_id' is required",
                error="NOTIFICATION_ID_REQUIRED",
            )

        notification_id = to_int(notification_id, "notification_id", 1)

        notification = (
            Notification.objects
            .filter(id=notification_id, recipient=user)
            .first()
        )

        if not notification:
            return json_error(
                "Notification not found",
                error="NOTIFICATION_NOT_FOUND",
                status=404,
            )

        notification.mark_as_read()

        return json_success(
            "Notification marked as read successfully",
            data=_serialize_inbox_notification(notification),
            meta={
                "unread_count": Notification.objects.filter(
                    recipient=user,
                    is_read=False,
                ).count(),
                "counts": _counts_for_user(user),
            },
        )

    if action == "mark_unread":
        notification_id = payload.get("id") or payload.get("notification_id")

        if notification_id in (None, ""):
            return json_error(
                "Field 'id' or 'notification_id' is required",
                error="NOTIFICATION_ID_REQUIRED",
            )

        notification_id = to_int(notification_id, "notification_id", 1)

        notification = (
            Notification.objects
            .filter(id=notification_id, recipient=user)
            .first()
        )

        if not notification:
            return json_error(
                "Notification not found",
                error="NOTIFICATION_NOT_FOUND",
                status=404,
            )

        notification.is_read = False
        notification.read_at = None
        notification.save(update_fields=["is_read", "read_at"])

        return json_success(
            "Notification marked as unread successfully",
            data=_serialize_inbox_notification(notification),
            meta={
                "unread_count": Notification.objects.filter(
                    recipient=user,
                    is_read=False,
                ).count(),
                "counts": _counts_for_user(user),
            },
        )

    if action == "mark_all_read":
        queryset = Notification.objects.filter(recipient=user, is_read=False)

        notification_type = clean_text(payload.get("notification_type"))
        severity = clean_text(payload.get("severity")).lower()
        company_reference = clean_text(payload.get("company_reference"))

        if notification_type:
            queryset = queryset.filter(notification_type=notification_type)

        if severity:
            queryset = queryset.filter(severity=severity)

        if company_reference:
            queryset = queryset.filter(company_reference=company_reference)

        updated = queryset.update(
            is_read=True,
            read_at=timezone.now(),
        )

        return json_success(
            "All matching notifications marked as read successfully",
            data={
                "updated": updated,
            },
            meta={
                "unread_count": Notification.objects.filter(
                    recipient=user,
                    is_read=False,
                ).count(),
                "counts": _counts_for_user(user),
            },
        )

    if action == "bulk_mark_read":
        raw_ids = payload.get("ids") or payload.get("notification_ids") or []

        if not isinstance(raw_ids, list):
            return json_error(
                "Field 'ids' must be a list",
                error="INVALID_IDS",
            )

        ids = []
        for raw_id in raw_ids:
            try:
                ids.append(int(raw_id))
            except (TypeError, ValueError):
                continue

        if not ids:
            return json_error(
                "No valid notification ids provided",
                error="NO_VALID_IDS",
            )

        updated = (
            Notification.objects
            .filter(recipient=user, id__in=ids, is_read=False)
            .update(
                is_read=True,
                read_at=timezone.now(),
            )
        )

        return json_success(
            "Selected notifications marked as read successfully",
            data={
                "updated": updated,
                "ids": ids,
            },
            meta={
                "unread_count": Notification.objects.filter(
                    recipient=user,
                    is_read=False,
                ).count(),
                "counts": _counts_for_user(user),
            },
        )

    return json_error(
        "Invalid action. Allowed: mark_read, mark_unread, mark_all_read, bulk_mark_read",
        error="INVALID_ACTION",
    )