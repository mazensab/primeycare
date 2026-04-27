# ============================================================
# 📂 api/performance_center/update.py
# Primey Care - Performance Center Update API
# ============================================================

from __future__ import annotations

from django.db import transaction
from django.views.decorators.http import require_http_methods

from . import (
    ensure_authenticated,
    get_object_or_error,
    get_required_value,
    json_error,
    json_success,
    parse_json_body,
    recalculate_review_scores,
    resolve_resource_model,
    serialize_instance,
    to_bool,
    to_float,
    to_int,
)
from performance_center.models import (
    PerformanceAnswer,
    PerformanceItem,
    PerformanceReview,
    PerformanceWorkflowStatus,
)


@require_http_methods(["PUT", "PATCH", "POST"])
@transaction.atomic
def performance_center_update_api(request):
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

        # ========================================================
        # 1) Template
        # ========================================================
        if resource == "template":
            if "company_id" in payload:
                instance.company_id = to_int(payload.get("company_id"), "company_id", min_value=1)
            if "name" in payload:
                instance.name = str(payload.get("name") or "").strip()
            if "period" in payload:
                period = str(payload.get("period") or "").strip().upper()
                if period not in {"YEARLY", "QUARTERLY", "MONTHLY"}:
                    return json_error("Invalid period", error="INVALID_PERIOD")
                instance.period = period
            if "description" in payload:
                instance.description = payload.get("description")
            if "is_active" in payload:
                instance.is_active = to_bool(payload.get("is_active"), instance.is_active)

            instance.save()
            return json_success(
                "Performance template updated successfully",
                data=serialize_instance(instance),
            )

        # ========================================================
        # 2) Category
        # ========================================================
        if resource == "category":
            if "template_id" in payload:
                instance.template_id = to_int(payload.get("template_id"), "template_id", min_value=1)
            if "name" in payload:
                instance.name = str(payload.get("name") or "").strip()
            if "weight" in payload:
                instance.weight = to_int(payload.get("weight"), "weight", min_value=0)

            instance.save()
            return json_success(
                "Performance category updated successfully",
                data=serialize_instance(instance),
            )

        # ========================================================
        # 3) Item
        # ========================================================
        if resource == "item":
            if "category_id" in payload:
                instance.category_id = to_int(payload.get("category_id"), "category_id", min_value=1)
            if "question" in payload:
                instance.question = str(payload.get("question") or "").strip()
            if "item_type" in payload:
                item_type = str(payload.get("item_type") or "").strip().upper()
                if item_type not in {"SCORE", "TEXT"}:
                    return json_error("Invalid item_type", error="INVALID_ITEM_TYPE")
                instance.item_type = item_type
            if "max_score" in payload:
                instance.max_score = to_int(payload.get("max_score"), "max_score", min_value=0)
            if "weight" in payload:
                instance.weight = to_int(payload.get("weight"), "weight", min_value=0)

            instance.save()
            return json_success(
                "Performance item updated successfully",
                data=serialize_instance(instance),
            )

        # ========================================================
        # 4) Review
        # ========================================================
        if resource == "review":
            if "employee_id" in payload:
                instance.employee_id = to_int(payload.get("employee_id"), "employee_id", min_value=1)
            if "template_id" in payload:
                instance.template_id = to_int(payload.get("template_id"), "template_id", min_value=1)
            if "period_label" in payload:
                instance.period_label = str(payload.get("period_label") or "").strip()
            if "status" in payload:
                status = str(payload.get("status") or "").strip().upper()
                if status not in {"SELF_PENDING", "MANAGER_PENDING", "HR_PENDING", "COMPLETED"}:
                    return json_error("Invalid status", error="INVALID_STATUS")
                instance.status = status
            if "final_decision" in payload:
                decision = str(payload.get("final_decision") or "").strip().upper()
                if decision not in {"NORMAL", "PROMOTION", "BONUS", "WARNING", "IMPROVEMENT_PLAN"}:
                    return json_error("Invalid final_decision", error="INVALID_DECISION")
                instance.final_decision = decision

            instance.save()
            recalculate_review_scores(instance)

            return json_success(
                "Performance review updated successfully",
                data=serialize_instance(instance, include_nested=True),
            )

        # ========================================================
        # 5) Answer
        # ========================================================
        if resource == "answer":
            item: PerformanceItem = instance.item
            review: PerformanceReview = instance.review

            if "self_answer" in payload:
                instance.self_answer = payload.get("self_answer")
            if "manager_answer" in payload:
                instance.manager_answer = payload.get("manager_answer")
            if "hr_answer" in payload:
                instance.hr_answer = payload.get("hr_answer")

            if "self_score" in payload:
                value = to_float(payload.get("self_score"), "self_score")
                if value is not None and value > item.max_score:
                    return json_error("self_score exceeds max_score", error="INVALID_SCORE_RANGE")
                instance.self_score = value

            if "manager_score" in payload:
                value = to_float(payload.get("manager_score"), "manager_score")
                if value is not None and value > item.max_score:
                    return json_error("manager_score exceeds max_score", error="INVALID_SCORE_RANGE")
                instance.manager_score = value

            if "hr_score" in payload:
                value = to_float(payload.get("hr_score"), "hr_score")
                if value is not None and value > item.max_score:
                    return json_error("hr_score exceeds max_score", error="INVALID_SCORE_RANGE")
                instance.hr_score = value

            instance.save()
            recalculate_review_scores(review)

            return json_success(
                "Performance answer updated successfully",
                data=serialize_instance(instance),
            )

        # ========================================================
        # 6) Workflow
        # ========================================================
        if resource == "workflow":
            workflow: PerformanceWorkflowStatus = instance

            if "self_completed" in payload:
                workflow.self_completed = to_bool(payload.get("self_completed"), workflow.self_completed)
            if "manager_completed" in payload:
                workflow.manager_completed = to_bool(payload.get("manager_completed"), workflow.manager_completed)
            if "hr_completed" in payload:
                workflow.hr_completed = to_bool(payload.get("hr_completed"), workflow.hr_completed)

            workflow.save()
            recalculate_review_scores(workflow.review)

            return json_success(
                "Performance workflow updated successfully",
                data=serialize_instance(workflow),
            )

        return json_error("Unsupported resource", error="INVALID_RESOURCE")

    except ValueError as exc:
        return json_error(str(exc), error="VALIDATION_ERROR")
    except LookupError as exc:
        return json_error(str(exc), error="NOT_FOUND", status=404)
    except Exception as exc:
        return json_error(
            "Failed to update performance center record",
            error="UPDATE_FAILED",
            status=500,
            details=str(exc),
        )