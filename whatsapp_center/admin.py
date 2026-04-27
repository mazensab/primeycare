# ============================================================
# 📂 whatsapp_center/admin.py
# 🧠 Primey Care - WhatsApp Center Admin V1 Core
# ============================================================

from django.contrib import admin

from .models import (
    SystemWhatsAppConfig,
    WhatsAppContact,
    WhatsAppConversation,
    WhatsAppConversationMessage,
    WhatsAppMessageAttempt,
    WhatsAppMessageLog,
    WhatsAppTemplate,
    WhatsAppWebhookEvent,
)


@admin.register(SystemWhatsAppConfig)
class SystemWhatsAppConfigAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "provider",
        "is_enabled",
        "is_active",
        "phone_number",
        "session_name",
        "session_status",
        "updated_at",
    )
    list_filter = (
        "provider",
        "is_enabled",
        "is_active",
        "session_mode",
        "session_status",
        "webhook_verified",
    )
    search_fields = (
        "business_name",
        "phone_number",
        "phone_number_id",
        "business_account_id",
        "session_name",
        "session_connected_phone",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
        "session_last_connected_at",
        "last_health_check_at",
    )


@admin.register(WhatsAppTemplate)
class WhatsAppTemplateAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "scope_type",
        "company_reference",
        "event_code",
        "template_key",
        "message_type",
        "language_code",
        "version",
        "approval_status",
        "provider_status",
        "is_default",
        "is_active",
        "updated_at",
    )
    list_filter = (
        "scope_type",
        "message_type",
        "language_code",
        "approval_status",
        "provider_status",
        "is_default",
        "is_active",
    )
    search_fields = (
        "event_code",
        "template_key",
        "template_name",
        "meta_template_name",
        "company_reference",
        "company_name",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
        "last_synced_at",
    )


@admin.register(WhatsAppMessageLog)
class WhatsAppMessageLogAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "scope_type",
        "company_reference",
        "event_code",
        "recipient_phone",
        "recipient_name",
        "message_type",
        "delivery_status",
        "provider_status",
        "created_at",
    )
    list_filter = (
        "scope_type",
        "message_type",
        "delivery_status",
        "trigger_source",
        "language_code",
    )
    search_fields = (
        "recipient_phone",
        "recipient_name",
        "external_message_id",
        "event_code",
        "company_reference",
        "company_name",
        "related_model",
        "related_object_id",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
        "sent_at",
        "delivered_at",
        "read_at",
        "failed_at",
    )


@admin.register(WhatsAppMessageAttempt)
class WhatsAppMessageAttemptAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "message_log",
        "attempt_number",
        "status_code",
        "provider_status",
        "is_success",
        "created_at",
    )
    list_filter = ("is_success",)
    search_fields = (
        "message_log__recipient_phone",
        "message_log__external_message_id",
        "message_log__event_code",
    )
    readonly_fields = (
        "created_at",
        "started_at",
        "finished_at",
    )


@admin.register(WhatsAppWebhookEvent)
class WhatsAppWebhookEventAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "scope_type",
        "company_reference",
        "provider",
        "event_type",
        "external_message_id",
        "is_processed",
        "created_at",
    )
    list_filter = (
        "scope_type",
        "provider",
        "is_processed",
        "event_type",
    )
    search_fields = (
        "external_message_id",
        "event_type",
        "company_reference",
        "company_name",
    )
    readonly_fields = (
        "created_at",
        "processed_at",
    )


@admin.register(WhatsAppContact)
class WhatsAppContactAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "scope_type",
        "company_reference",
        "phone_number",
        "display_name",
        "push_name",
        "is_business",
        "is_blocked",
        "last_message_at",
        "updated_at",
    )
    list_filter = (
        "scope_type",
        "is_business",
        "is_blocked",
    )
    search_fields = (
        "phone_number",
        "display_name",
        "push_name",
        "wa_jid",
        "profile_name",
        "company_reference",
        "company_name",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
        "last_message_at",
        "last_seen_at",
    )


@admin.register(WhatsAppConversation)
class WhatsAppConversationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "scope_type",
        "company_reference",
        "contact",
        "status",
        "assigned_to",
        "unread_count",
        "is_pinned",
        "is_muted",
        "is_resolved",
        "last_message_at",
        "updated_at",
    )
    list_filter = (
        "scope_type",
        "status",
        "is_pinned",
        "is_muted",
        "is_resolved",
    )
    search_fields = (
        "contact__phone_number",
        "contact__display_name",
        "contact__push_name",
        "subject",
        "last_message_preview",
        "company_reference",
        "company_name",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
        "last_message_at",
    )


@admin.register(WhatsAppConversationMessage)
class WhatsAppConversationMessageAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "conversation",
        "direction",
        "message_type",
        "sender_phone",
        "sender_name",
        "delivery_status",
        "provider",
        "is_read",
        "is_from_me",
        "message_created_at",
        "created_at",
    )
    list_filter = (
        "direction",
        "message_type",
        "delivery_status",
        "provider",
        "is_read",
        "is_from_me",
        "scope_type",
    )
    search_fields = (
        "external_message_id",
        "sender_phone",
        "sender_name",
        "body_text",
        "caption",
        "wa_jid",
        "conversation__contact__phone_number",
        "conversation__contact__display_name",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
        "message_created_at",
        "sent_at",
        "delivered_at",
        "read_at",
        "failed_at",
    )