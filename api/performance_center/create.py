# ============================================================
# 📂 api/performance_center/create.py
# Primey Care - Performance Center Create API
# ============================================================

from __future__ import annotations

from django.db import transaction
from django.views.decorators.http import require_POST

from . import (
    ensure_authenticated,
    ensure_review_workflow,
    get_object_or_error,
    get_required_value,
    json_error,
    json_success,
    parse_json_body,
    recalculate_review_scores,
    serialize_instance,
    to_bool,
    to_float,
    to_int,
)
from performance_center.models import (
    PerformanceAnswer,
    PerformanceCategory,
    PerformanceItem,
    PerformanceReview,
    PerformanceTemplate,
    PerformanceWorkflowStatus,
)


@require_POST
@transaction.atomic
def performance_center_create_api(request):
    auth_error = ensure_authenticated(request)
    if auth_error:
        return auth_error

    try:
        payload = parse_json_body(request)
        resource = (payload.get("resource") or "").strip().lower()

        if not resource:
            return json_error("Field 'resource' is required", error="RESOURCE_REQUIRED")

        # ========================================================
        # 1) Template
        # ========================================================
        if resource == "template":
            company_id = to_int(get_required_value(payload, "company_id"), "company_id", min_value=1)
            name = str(get_required_value(payload, "name")).strip()
            period = str(payload.get("period") or "YEARLY").strip().upper()
            description = payload.get("description")
            is_active = to_bool(payload.get("is_active"), default=True)

            if period not in {"YEARLY", "QUARTERLY", "MONTHLY"}:
                return json_error(
                    "Invalid period. Allowed: YEARLY, QUARTERLY, MONTHLY",
                    error="INVALID_PERIOD",
                )

            instance = PerformanceTemplate.objects.create(
                company_id=company_id,
                name=name,
                period=period,
                description=description,
                is_active=is_active,
            )
            return json_success(
                "Performance template created successfully",
                data=serialize_instance(instance),
                status=201,
            )

        # ========================================================
        # 2) Category
        # ========================================================
        if resource == "category":
            template_id = to_int(get_required_value(payload, "template_id"), "template_id", min_value=1)
            name = str(get_required_value(payload, "name")).strip()
            weight = to_int(payload.get("weight", 20), "weight", min_value=0)

            get_object_or_error(PerformanceTemplate, template_id)

            instance = PerformanceCategory.objects.create(
                template_id=template_id,
                name=name,
                weight=weight,
            )
            return json_success(
                "Performance category created successfully",
                data=serialize_instance(instance),
                status=201,
            )

        # ========================================================
        # 3) Item
        # ========================================================
        if resource == "item":
            category_id = to_int(get_required_value(payload, "category_id"), "category_id", min_value=1)
            question = str(get_required_value(payload, "question")).strip()
            item_type = str(payload.get("item_type") or "SCORE").strip().upper()
            max_score = to_int(payload.get("max_score", 5), "max_score", min_value=0)
            weight = to_int(payload.get("weight", 10), "weight", min_value=0)

            if item_type not in {"SCORE", "TEXT"}:
                return json_error(
                    "Invalid item_type. Allowed: SCORE, TEXT",
                    error="INVALID_ITEM_TYPE",
                )

            get_object_or_error(PerformanceCategory, category_id)

            instance = PerformanceItem.objects.create(
                category_id=category_id,
                question=question,
                item_type=item_type,
                max_score=max_score,
                weight=weight,
            )
            return json_success(
                "Performance item created successfully",
                data=serialize_instance(instance),
                status=201,
            )

        # ========================================================
        # 4) Review
        # ========================================================
        if resource == "review":
            employee_id = to_int(get_required_value(payload, "employee_id"), "employee_id", min_value=1)
            template_id = to_int(get_required_value(payload, "template_id"), "template_id", min_value=1)
            period_label = str(get_required_value(payload, "period_label")).strip()
            status = str(payload.get("status") or "SELF_PENDING").strip().upper()
            final_decision = str(payload.get("final_decision") or "NORMAL").strip().upper()

            if status not in {"SELF_PENDING", "MANAGER_PENDING", "HR_PENDING", "COMPLETED"}:
                return json_error("Invalid review status", error="INVALID_STATUS")

            if final_decision not in {"NORMAL", "PROMOTION", "BONUS", "WARNING", "IMPROVEMENT_PLAN"}:
                return json_error("Invalid final_decision", error="INVALID_DECISION")

            get_object_or_error(PerformanceTemplate, template_id)

            instance = PerformanceReview.objects.create(
                employee_id=employee_id,
                template_id=template_id,
                period_label=period_label,
                status=status,
                final_decision=final_decision,
            )
            ensure_review_workflow(instance)
            recalculate_review_scores(instance)

            return json_success(
                "Performance review created successfully",
                data=serialize_instance(instance, include_nested=True),
                status=201,
            )

        # ========================================================
        # 5) Answer
        # ========================================================
        if resource == "answer":
            review_id = to_int(get_required_value(payload, "review_id"), "review_id", min_value=1)
            item_id = to_int(get_required_value(payload, "item_id"), "item_id", min_value=1)

            review = get_object_or_error(PerformanceReview, review_id)
            item = get_object_or_error(PerformanceItem, item_id)

            existing = PerformanceAnswer.objects.filter(review_id=review_id, item_id=item_id).first()
            if existing:
                return json_error(
                    "Answer already exists for this review and item",
                    error="ANSWER_ALREADY_EXISTS",
                    status=409,
                )

            instance = PerformanceAnswer.objects.create(
                review_id=review_id,
                item_id=item_id,
                self_answer=payload.get("self_answer"),
                manager_answer=payload.get("manager_answer"),
                hr_answer=payload.get("hr_answer"),
                self_score=to_float(payload.get("self_score"), "self_score"),
                manager_score=to_float(payload.get("manager_score"), "manager_score"),
                hr_score=to_float(payload.get("hr_score"), "hr_score"),
            )

            if item.item_type == "SCORE":
                for field_name, value in {
                    "self_score": instance.self_score,
                    "manager_score": instance.manager_score,
                    "hr_score": instance.hr_score,
                }.items():
                    if value is not None and value > item.max_score:
                        return json_error(
                            f"{field_name} cannot be greater than item.max_score ({item.max_score})",
                            error="INVALID_SCORE_RANGE",
                        )

            recalculate_review_scores(review)

            return json_success(
                "Performance answer created successfully",
                data=serialize_instance(instance),
                status=201,
            )

        # ========================================================
        # 6) Workflow
        # ========================================================
        if resource == "workflow":
            review_id = to_int(get_required_value(payload, "review_id"), "review_id", min_value=1)
            review = get_object_or_error(PerformanceReview, review_id)

            workflow, created = PerformanceWorkflowStatus.objects.get_or_create(
                review=review,
                defaults={
                    "self_completed": to_bool(payload.get("self_completed"), False),
                    "manager_completed": to_bool(payload.get("manager_completed"), False),
                    "hr_completed": to_bool(payload.get("hr_completed"), False),
                },
            )

            if not created:
                workflow.self_completed = to_bool(payload.get("self_completed"), workflow.self_completed)
                workflow.manager_completed = to_bool(payload.get("manager_completed"), workflow.manager_completed)
                workflow.hr_completed = to_bool(payload.get("hr_completed"), workflow.hr_completed)
                workflow.save()

            recalculate_review_scores(review)

            return json_success(
                "Performance workflow saved successfully",
                data=serialize_instance(workflow),
                status=201 if created else 200,
            )

        return json_error(
            "Invalid resource. Allowed: template, category, item, review, answer, workflow",
            error="INVALID_RESOURCE",
        )

    except ValueError as exc:
        return json_error(str(exc), error="VALIDATION_ERROR")
    except LookupError as exc:
        return json_error(str(exc), error="NOT_FOUND", status=404)
    except Exception as exc:
        return json_error(
            "Failed to create performance center record",
            error="CREATE_FAILED",
            status=500,
            details=str(exc),
        )