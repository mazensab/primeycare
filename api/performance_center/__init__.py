# ============================================================
# 📂 api/performance_center/__init__.py
# Primey Care - Performance Center API Helpers
# ============================================================

from __future__ import annotations

import json
from typing import Any

from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone

from performance_center.models import (
    PerformanceAnswer,
    PerformanceCategory,
    PerformanceItem,
    PerformanceReview,
    PerformanceTemplate,
    PerformanceWorkflowStatus,
)

RESOURCE_MODEL_MAP = {
    "template": PerformanceTemplate,
    "category": PerformanceCategory,
    "item": PerformanceItem,
    "review": PerformanceReview,
    "answer": PerformanceAnswer,
    "workflow": PerformanceWorkflowStatus,
}


# ============================================================
# 🔐 Auth Helpers
# ============================================================
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


# ============================================================
# 📦 JSON Helpers
# ============================================================
def parse_json_body(request) -> dict[str, Any]:
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        raise ValueError("Invalid JSON body")


def json_success(
    message: str,
    data: Any | None = None,
    status: int = 200,
    meta: dict[str, Any] | None = None,
):
    payload = {
        "ok": True,
        "message": message,
        "data": data,
    }
    if meta is not None:
        payload["meta"] = meta
    return JsonResponse(payload, status=status)


def json_error(
    message: str,
    error: str = "BAD_REQUEST",
    status: int = 400,
    details: Any | None = None,
):
    payload = {
        "ok": False,
        "message": message,
        "error": error,
    }
    if details is not None:
        payload["details"] = details
    return JsonResponse(payload, status=status)


# ============================================================
# 🧠 Validation Helpers
# ============================================================
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


def to_float(value, field_name: str):
    if value in (None, "", "null"):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        raise ValueError(f"'{field_name}' must be a number")


def resolve_resource_model(resource: str):
    model = RESOURCE_MODEL_MAP.get((resource or "").strip().lower())
    if not model:
        raise ValueError(
            "Invalid resource. Allowed: template, category, item, review, answer, workflow"
        )
    return model


def get_object_or_error(model, object_id):
    try:
        return model.objects.get(pk=object_id)
    except model.DoesNotExist:
        raise LookupError(f"{model.__name__} with id={object_id} was not found")


# ============================================================
# 🧮 Review Helpers
# ============================================================
def _average(values: list[float | None]) -> float | None:
    filtered = [float(v) for v in values if v is not None]
    if not filtered:
        return None
    return round(sum(filtered) / len(filtered), 2)


def _resolve_review_status_from_workflow(workflow: PerformanceWorkflowStatus | None) -> str:
    if not workflow:
        return "SELF_PENDING"
    if workflow.hr_completed:
        return "COMPLETED"
    if workflow.manager_completed:
        return "HR_PENDING"
    if workflow.self_completed:
        return "MANAGER_PENDING"
    return "SELF_PENDING"


@transaction.atomic
def recalculate_review_scores(review: PerformanceReview) -> PerformanceReview:
    answers = review.answers.all()

    self_score = _average([answer.self_score for answer in answers])
    manager_score = _average([answer.manager_score for answer in answers])
    hr_score = _average([answer.hr_score for answer in answers])

    final_score = _average([self_score, manager_score, hr_score])

    workflow = getattr(review, "workflow", None)
    review.self_score = self_score
    review.manager_score = manager_score
    review.hr_score = hr_score
    review.final_score = final_score
    review.status = _resolve_review_status_from_workflow(workflow)
    review.updated_at = timezone.now()
    review.save(
        update_fields=[
            "self_score",
            "manager_score",
            "hr_score",
            "final_score",
            "status",
            "updated_at",
        ]
    )
    return review


def ensure_review_workflow(review: PerformanceReview) -> PerformanceWorkflowStatus:
    workflow, _ = PerformanceWorkflowStatus.objects.get_or_create(review=review)
    return workflow


# ============================================================
# 🧾 Serializers
# ============================================================
def serialize_template(obj: PerformanceTemplate, include_nested: bool = False):
    data = {
        "id": obj.id,
        "company_id": getattr(obj, "company_id", None),
        "company_name": str(obj.company) if getattr(obj, "company", None) else None,
        "name": obj.name,
        "period": obj.period,
        "description": obj.description,
        "is_active": obj.is_active,
        "categories_count": obj.categories.count(),
        "reviews_count": obj.reviews.count(),
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
    }
    if include_nested:
        data["categories"] = [
            serialize_category(category, include_nested=True)
            for category in obj.categories.all().order_by("name")
        ]
    return data


def serialize_category(obj: PerformanceCategory, include_nested: bool = False):
    data = {
        "id": obj.id,
        "template_id": obj.template_id,
        "template_name": obj.template.name if obj.template_id else None,
        "name": obj.name,
        "weight": obj.weight,
        "items_count": obj.items.count(),
    }
    if include_nested:
        data["items"] = [
            serialize_item(item)
            for item in obj.items.all().order_by("weight", "id")
        ]
    return data


def serialize_item(obj: PerformanceItem):
    return {
        "id": obj.id,
        "category_id": obj.category_id,
        "category_name": obj.category.name if obj.category_id else None,
        "template_id": obj.category.template_id if obj.category_id else None,
        "question": obj.question,
        "item_type": obj.item_type,
        "max_score": obj.max_score,
        "weight": obj.weight,
    }


def serialize_workflow(obj: PerformanceWorkflowStatus):
    return {
        "id": obj.id,
        "review_id": obj.review_id,
        "self_completed": obj.self_completed,
        "manager_completed": obj.manager_completed,
        "hr_completed": obj.hr_completed,
        "last_update": obj.last_update.isoformat() if obj.last_update else None,
    }


def serialize_answer(obj: PerformanceAnswer):
    return {
        "id": obj.id,
        "review_id": obj.review_id,
        "item_id": obj.item_id,
        "item_question": obj.item.question if obj.item_id else None,
        "self_answer": obj.self_answer,
        "manager_answer": obj.manager_answer,
        "hr_answer": obj.hr_answer,
        "self_score": obj.self_score,
        "manager_score": obj.manager_score,
        "hr_score": obj.hr_score,
    }


def serialize_review(obj: PerformanceReview, include_nested: bool = False):
    data = {
        "id": obj.id,
        "employee_id": obj.employee_id,
        "employee_name": str(obj.employee) if getattr(obj, "employee", None) else None,
        "template_id": obj.template_id,
        "template_name": obj.template.name if obj.template_id else None,
        "period_label": obj.period_label,
        "status": obj.status,
        "self_score": obj.self_score,
        "manager_score": obj.manager_score,
        "hr_score": obj.hr_score,
        "final_score": obj.final_score,
        "final_decision": obj.final_decision,
        "answers_count": obj.answers.count(),
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
    }
    if include_nested:
        data["workflow"] = (
            serialize_workflow(obj.workflow)
            if hasattr(obj, "workflow")
            else None
        )
        data["answers"] = [
            serialize_answer(answer)
            for answer in obj.answers.select_related("item").all().order_by("id")
        ]
    return data


def serialize_instance(instance, include_nested: bool = False):
    if isinstance(instance, PerformanceTemplate):
        return serialize_template(instance, include_nested=include_nested)
    if isinstance(instance, PerformanceCategory):
        return serialize_category(instance, include_nested=include_nested)
    if isinstance(instance, PerformanceItem):
        return serialize_item(instance)
    if isinstance(instance, PerformanceReview):
        return serialize_review(instance, include_nested=include_nested)
    if isinstance(instance, PerformanceAnswer):
        return serialize_answer(instance)
    if isinstance(instance, PerformanceWorkflowStatus):
        return serialize_workflow(instance)
    raise ValueError("Unsupported instance type")