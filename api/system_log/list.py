# ============================================================
# 📂 api/system_log/list.py
# Primey Care - System Log List API
# ============================================================

from __future__ import annotations

from django.core.paginator import Paginator
from django.db.models import Q
from django.views.decorators.http import require_GET

from system_log.models import SystemLog

from . import ensure_authenticated, json_error, json_success, serialize_system_log


@require_GET
def system_log_list_api(request):
    auth_error = ensure_authenticated(request)
    if auth_error:
        return auth_error

    search = (request.GET.get("search") or "").strip()
    scope_type = (request.GET.get("scope_type") or "").strip()
    company_reference = (request.GET.get("company_reference") or "").strip()
    module = (request.GET.get("module") or "").strip()
    action = (request.GET.get("action") or "").strip()
    event_code = (request.GET.get("event_code") or "").strip()
    severity = (request.GET.get("severity") or "").strip()
    method = (request.GET.get("method") or "").strip()
    status_code = (request.GET.get("status_code") or "").strip()
    user_id = (request.GET.get("user_id") or "").strip()

    try:
        page = max(int(request.GET.get("page", 1) or 1), 1)
        page_size = min(max(int(request.GET.get("page_size", 20) or 20), 1), 100)
    except ValueError:
        return json_error("Invalid page or page_size", error="INVALID_PAGINATION")

    queryset = SystemLog.objects.select_related("user").all().order_by("-created_at", "-id")

    if scope_type:
        queryset = queryset.filter(scope_type=scope_type)

    if company_reference:
        queryset = queryset.filter(company_reference=company_reference)

    if module:
        queryset = queryset.filter(module=module)

    if action:
        queryset = queryset.filter(action=action)

    if event_code:
        queryset = queryset.filter(event_code=event_code)

    if severity:
        queryset = queryset.filter(severity=severity)

    if method:
        queryset = queryset.filter(method__iexact=method)

    if status_code:
        queryset = queryset.filter(status_code=status_code)

    if user_id:
        queryset = queryset.filter(user_id=user_id)

    if search:
        queryset = queryset.filter(
            Q(company_reference__icontains=search)
            | Q(company_name__icontains=search)
            | Q(module__icontains=search)
            | Q(action__icontains=search)
            | Q(event_code__icontains=search)
            | Q(message__icontains=search)
            | Q(path__icontains=search)
            | Q(method__icontains=search)
            | Q(ip_address__icontains=search)
            | Q(user__username__icontains=search)
            | Q(user__first_name__icontains=search)
            | Q(user__last_name__icontains=search)
        )

    paginator = Paginator(queryset, page_size)
    page_obj = paginator.get_page(page)

    data = [serialize_system_log(item) for item in page_obj.object_list]

    return json_success(
        "System logs loaded successfully",
        data=data,
        meta={
            "page": page_obj.number,
            "page_size": page_size,
            "total_pages": paginator.num_pages,
            "total_items": paginator.count,
            "has_next": page_obj.has_next(),
            "has_previous": page_obj.has_previous(),
        },
    )