from django.contrib import admin

from .models import SystemLog


@admin.register(SystemLog)
class SystemLogAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "scope_type",
        "company_reference",
        "company_name",
        "module",
        "action",
        "event_code",
        "severity",
        "user",
        "status_code",
        "created_at",
    )
    list_filter = ("scope_type", "severity", "module", "action", "created_at")
    search_fields = (
        "company_reference",
        "company_name",
        "module",
        "action",
        "event_code",
        "message",
        "user__username",
        "user__first_name",
        "user__last_name",
    )