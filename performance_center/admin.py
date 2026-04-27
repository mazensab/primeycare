from django.contrib import admin

from .models import (
    PerformanceAnswer,
    PerformanceCategory,
    PerformanceItem,
    PerformanceReview,
    PerformanceTemplate,
    PerformanceWorkflowStatus,
)


@admin.register(PerformanceTemplate)
class PerformanceTemplateAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "company_id", "company_name", "period", "is_active", "created_at")
    list_filter = ("period", "is_active")
    search_fields = ("name", "company_name", "description")


@admin.register(PerformanceCategory)
class PerformanceCategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "template", "weight")
    search_fields = ("name", "template__name")


@admin.register(PerformanceItem)
class PerformanceItemAdmin(admin.ModelAdmin):
    list_display = ("id", "question", "category", "item_type", "max_score", "weight")
    list_filter = ("item_type",)
    search_fields = ("question", "category__name", "category__template__name")


@admin.register(PerformanceReview)
class PerformanceReviewAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "employee_id",
        "employee_name",
        "subject_type",
        "template",
        "period_label",
        "status",
        "final_score",
        "final_decision",
        "created_at",
    )
    list_filter = ("status", "final_decision", "subject_type")
    search_fields = ("employee_name", "period_label", "template__name")


@admin.register(PerformanceAnswer)
class PerformanceAnswerAdmin(admin.ModelAdmin):
    list_display = ("id", "review", "item", "self_score", "manager_score", "hr_score")
    search_fields = ("review__employee_name", "item__question")


@admin.register(PerformanceWorkflowStatus)
class PerformanceWorkflowStatusAdmin(admin.ModelAdmin):
    list_display = ("id", "review", "self_completed", "manager_completed", "hr_completed", "last_update")