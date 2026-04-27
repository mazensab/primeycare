# ============================================================
# 📂 api/notification_center/logs.py
# Primey Care - Notification Center Logs API
# ============================================================

from __future__ import annotations

from django.views.decorators.http import require_GET

from notification_center.models import NotificationDelivery

from . import ensure_authenticated, json_success, serialize_delivery


@require_GET
def notification_center_logs_api(request):
    auth_error = ensure_authenticated(request)
    if auth_error:
        return auth_error

    limit_raw = (request.GET.get("limit") or "200").strip()
    try:
        limit = int(limit_raw)
    except ValueError:
        limit = 200

    if limit <= 0:
        limit = 200
    if limit > 500:
        limit = 500

    logs = NotificationDelivery.objects.select_related("event", "recipient", "notification").order_by("-created_at")[:limit]
    results = [serialize_delivery(item) for item in logs]

    return json_success(
        "Notification logs loaded successfully",
        data=results,
        results=results,
        count=len(results),
        meta={"limit": limit},
    )