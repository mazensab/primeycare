# ============================================================
# 📂 api/system_log/summary.py
# Primey Care - System Log Summary API
# ============================================================

from __future__ import annotations

from django.db.models import Count
from django.views.decorators.http import require_GET

from system_log.models import SystemLog

from . import ensure_authenticated, json_success, serialize_system_log


@require_GET
def system_log_summary_api(request):
    auth_error = ensure_authenticated(request)
    if auth_error:
        return auth_error

    recent_logs = SystemLog.objects.select_related("user").order_by("-created_at", "-id")[:10]

    severity_counts = {
        item["severity"]: item["count"]
        for item in SystemLog.objects.values("severity").annotate(count=Count("id")).order_by("severity")
    }

    scope_counts = {
        item["scope_type"]: item["count"]
        for item in SystemLog.objects.values("scope_type").annotate(count=Count("id")).order_by("scope_type")
    }

    module_counts = list(
        SystemLog.objects.values("module")
        .annotate(count=Count("id"))
        .order_by("-count", "module")[:10]
    )

    action_counts = list(
        SystemLog.objects.values("action")
        .annotate(count=Count("id"))
        .order_by("-count", "action")[:10]
    )

    data = {
        "counts": {
            "total_logs": SystemLog.objects.count(),
            "system_scope_logs": SystemLog.objects.filter(scope_type="SYSTEM").count(),
            "company_scope_logs": SystemLog.objects.filter(scope_type="COMPANY").count(),
            "critical_logs": SystemLog.objects.filter(severity="critical").count(),
            "error_logs": SystemLog.objects.filter(severity="error").count(),
            "warning_logs": SystemLog.objects.filter(severity="warning").count(),
            "info_logs": SystemLog.objects.filter(severity="info").count(),
        },
        "severity_counts": severity_counts,
        "scope_counts": scope_counts,
        "top_modules": module_counts,
        "top_actions": action_counts,
        "recent_logs": [serialize_system_log(item) for item in recent_logs],
    }

    return json_success(
        "System log summary loaded successfully",
        data=data,
    )