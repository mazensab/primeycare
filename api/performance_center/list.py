# ============================================================
# 📂 api/performance_center/list.py
# Primey Care - Performance Center List APIs
# ============================================================

from __future__ import annotations

from django.core.paginator import Paginator
from django.db.models import Q
from django.views.decorators.http import require_GET

from . import (
    ensure_authenticated,
    json_error,
    json_success,
    serialize_instance,
)
from performance_center.models import (
    PerformanceAnswer,
    PerformanceCategory,
    PerformanceItem,
    PerformanceReview,
    PerformanceTemplate,
    PerformanceWorkflowStatus,
)


@require_GET
def performance_center_list_api(request):
    auth_error = ensure_authenticated(request)
    if auth_error:
        return auth_error

    resource = (request.GET.get("resource") or "overview").strip().lower()
    search = (request.GET.get("search") or "").strip()
    page = max(int(request.GET.get("page", 1) or 1), 1)
    page_size = min(max(int(request.GET.get("page_size", 20) or 20), 1), 100)

    if resource == "overview":
        recent_templates = PerformanceTemplate.objects.select_related("company").order_by("-created_at")[:5]
        recent_reviews = PerformanceReview.objects.select_related("employee", "template").order_by("-created_at")[:5]

        data = {
            "counts": {
                "templates": PerformanceTemplate.objects.count(),
                "categories": PerformanceCategory.objects.count(),
                "items": PerformanceItem.objects.count(),
                "reviews": PerformanceReview.objects.count(),
                "answers": PerformanceAnswer.objects.count(),
                "workflows": PerformanceWorkflowStatus.objects.count(),
            },
            "recent_templates": [serialize_instance(obj) for obj in recent_templates],
            "recent_reviews": [serialize_instance(obj) for obj in recent_reviews],
        }
        return json_success("Performance center overview loaded successfully", data=data)

    queryset = None

    if resource == "template":
        queryset = PerformanceTemplate.objects.select_related("company").all().order_by("-created_at")
        company_id = request.GET.get("company_id")
        period = request.GET.get("period")
        is_active = request.GET.get("is_active")

        if company_id:
            queryset = queryset.filter(company_id=company_id)
        if period:
            queryset = queryset.filter(period=period)
        if is_active is not None and is_active != "":
            queryset = queryset.filter(is_active=str(is_active).lower() in {"1", "true", "yes", "on"})
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(description__icontains=search)
            )

    elif resource == "category":
        queryset = PerformanceCategory.objects.select_related("template").all().order_by("name")
        template_id = request.GET.get("template_id")

        if template_id:
            queryset = queryset.filter(template_id=template_id)
        if search:
            queryset = queryset.filter(name__icontains=search)

    elif resource == "item":
        queryset = PerformanceItem.objects.select_related("category", "category__template").all().order_by("weight", "id")
        category_id = request.GET.get("category_id")
        template_id = request.GET.get("template_id")
        item_type = request.GET.get("item_type")

        if category_id:
            queryset = queryset.filter(category_id=category_id)
        if template_id:
            queryset = queryset.filter(category__template_id=template_id)
        if item_type:
            queryset = queryset.filter(item_type=item_type)
        if search:
            queryset = queryset.filter(question__icontains=search)

    elif resource == "review":
        queryset = PerformanceReview.objects.select_related("employee", "template").all().order_by("-created_at")
        employee_id = request.GET.get("employee_id")
        template_id = request.GET.get("template_id")
        status = request.GET.get("status")
        decision = request.GET.get("final_decision")
        period_label = request.GET.get("period_label")

        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        if template_id:
            queryset = queryset.filter(template_id=template_id)
        if status:
            queryset = queryset.filter(status=status)
        if decision:
            queryset = queryset.filter(final_decision=decision)
        if period_label:
            queryset = queryset.filter(period_label__icontains=period_label)
        if search:
            queryset = queryset.filter(
                Q(period_label__icontains=search) |
                Q(employee__first_name__icontains=search) |
                Q(employee__last_name__icontains=search) |
                Q(template__name__icontains=search)
            )

    elif resource == "answer":
        queryset = PerformanceAnswer.objects.select_related("review", "item").all().order_by("id")
        review_id = request.GET.get("review_id")
        item_id = request.GET.get("item_id")

        if review_id:
            queryset = queryset.filter(review_id=review_id)
        if item_id:
            queryset = queryset.filter(item_id=item_id)

    elif resource == "workflow":
        queryset = PerformanceWorkflowStatus.objects.select_related("review").all().order_by("-last_update")
        review_id = request.GET.get("review_id")

        if review_id:
            queryset = queryset.filter(review_id=review_id)

    else:
        return json_error(
            "Invalid resource. Allowed: overview, template, category, item, review, answer, workflow",
            error="INVALID_RESOURCE",
            status=400,
        )

    paginator = Paginator(queryset, page_size)
    page_obj = paginator.get_page(page)

    return json_success(
        "Performance center list loaded successfully",
        data=[serialize_instance(obj) for obj in page_obj.object_list],
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