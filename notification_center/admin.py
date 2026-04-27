# ============================================================
# 📂 notification_center/admin.py
# 🧠 Primey Care - Notification Center Admin
# ============================================================

from django.contrib import admin

from notification_center.models import (
    Notification,
    NotificationDelivery,
    NotificationEvent,
)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "recipient",
        "title",
        "notification_type",
        "severity",
        "is_read",
        "created_at",
    )
    list_filter = (
        "notification_type",
        "severity",
        "is_read",
        "created_at",
    )
    search_fields = (
        "title",
        "message",
        "recipient__username",
        "recipient__email",
        "recipient_name",
        "company_name",
    )
    readonly_fields = (
        "created_at",
        "read_at",
    )
    ordering = ("-created_at",)


@admin.register(NotificationEvent)
class NotificationEventAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "event_code",
        "event_group",
        "target_user",
        "severity",
        "status",
        "created_at",
    )
    list_filter = (
        "event_group",
        "severity",
        "status",
        "language_code",
        "created_at",
    )
    search_fields = (
        "event_code",
        "title",
        "message",
        "source",
        "company_name",
        "target_user__username",
        "target_user__email",
        "target_model",
        "target_object_id",
    )
    readonly_fields = (
        "created_at",
        "processed_at",
    )
    ordering = ("-created_at",)


@admin.register(NotificationDelivery)
class NotificationDeliveryAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "event",
        "channel",
        "recipient",
        "status",
        "destination",
        "provider_name",
        "created_at",
        "sent_at",
    )
    list_filter = (
        "channel",
        "status",
        "language_code",
        "provider_name",
        "created_at",
    )
    search_fields = (
        "destination",
        "subject",
        "provider_message_id",
        "provider_name",
        "recipient__username",
        "recipient__email",
        "company_name",
        "event__event_code",
    )
    readonly_fields = (
        "created_at",
        "last_attempt_at",
        "sent_at",
    )
    ordering = ("-created_at",)