# ============================================================
# 📂 payment_gateways/admin.py
# 🧠 Primey Care - Payment Gateways Admin V2
# ------------------------------------------------------------
# ✅ إدارة إعدادات بوابات الدفع
# ✅ إدارة عمليات البوابات الخارجية
# ✅ إدارة سجلات Webhook
# ✅ إخفاء المفاتيح الحساسة
# ✅ عرض مراجع الربط مع payments / invoices / orders
# ✅ مناسب لـ Tap / Tamara
# ============================================================

from __future__ import annotations

from django.contrib import admin
from django.utils.html import format_html

from .models import (
    PaymentGatewayConfig,
    PaymentGatewayProvider,
    PaymentGatewayTransaction,
    PaymentGatewayTransactionStatus,
    PaymentGatewayWebhookLog,
    PaymentGatewayWebhookStatus,
)


# ============================================================
# Shared Helpers
# ============================================================

def _safe(value, fallback: str = "-") -> str:
    if value in (None, ""):
        return fallback
    return str(value)


def _status_badge(value: str) -> str:
    value = str(value or "").upper()

    color_map = {
        PaymentGatewayTransactionStatus.SUCCESS: "#16a34a",
        PaymentGatewayTransactionStatus.FAILED: "#dc2626",
        PaymentGatewayTransactionStatus.CANCELLED: "#6b7280",
        PaymentGatewayTransactionStatus.REFUNDED: "#7c3aed",
        PaymentGatewayTransactionStatus.EXPIRED: "#ea580c",
        PaymentGatewayTransactionStatus.PROCESSING: "#2563eb",
        PaymentGatewayTransactionStatus.REQUIRES_ACTION: "#ca8a04",
        PaymentGatewayTransactionStatus.INITIATED: "#0891b2",
        PaymentGatewayTransactionStatus.PENDING: "#64748b",
        PaymentGatewayWebhookStatus.PROCESSED: "#16a34a",
        PaymentGatewayWebhookStatus.FAILED: "#dc2626",
        PaymentGatewayWebhookStatus.REJECTED: "#ea580c",
        PaymentGatewayWebhookStatus.VERIFIED: "#2563eb",
        PaymentGatewayWebhookStatus.RECEIVED: "#64748b",
    }

    color = color_map.get(value, "#64748b")

    return format_html(
        '<span style="display:inline-flex;align-items:center;border-radius:999px;'
        'padding:2px 10px;font-size:12px;font-weight:700;color:white;'
        'background:{};">{}</span>',
        color,
        value or "-",
    )


def _provider_badge(value: str) -> str:
    value = str(value or "").upper()

    color_map = {
        PaymentGatewayProvider.TAMARA: "#432a58",
        PaymentGatewayProvider.TAP: "#2563eb",
    }

    color = color_map.get(value, "#64748b")

    return format_html(
        '<span style="display:inline-flex;align-items:center;border-radius:999px;'
        'padding:2px 10px;font-size:12px;font-weight:700;color:white;'
        'background:{};">{}</span>',
        color,
        value or "-",
    )


# ============================================================
# Payment Gateway Config Admin
# ============================================================

@admin.register(PaymentGatewayConfig)
class PaymentGatewayConfigAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "provider_badge",
        "display_name",
        "environment",
        "is_enabled",
        "is_default",
        "has_credentials_display",
        "timeout_seconds",
        "verify_webhook",
        "updated_at",
    )
    list_filter = (
        "provider",
        "environment",
        "is_enabled",
        "is_default",
        "verify_webhook",
        "created_at",
        "updated_at",
    )
    search_fields = (
        "display_name",
        "provider",
        "environment",
        "merchant_id",
        "source_id",
        "base_url",
        "merchant_callback_url",
        "notes",
    )
    readonly_fields = (
        "masked_api_token_display",
        "masked_secret_key_display",
        "masked_public_key_display",
        "masked_notification_token_display",
        "has_credentials_display",
        "created_at",
        "updated_at",
    )
    fieldsets = (
        (
            "معلومات البوابة",
            {
                "fields": (
                    "provider",
                    "display_name",
                    "environment",
                    "is_enabled",
                    "is_default",
                    "notes",
                )
            },
        ),
        (
            "بيانات الاتصال",
            {
                "fields": (
                    "base_url",
                    "timeout_seconds",
                    "verify_webhook",
                    "merchant_callback_url",
                    "extra_config",
                )
            },
        ),
        (
            "المفاتيح والاعتمادات",
            {
                "fields": (
                    "api_token",
                    "secret_key",
                    "public_key",
                    "merchant_id",
                    "source_id",
                    "notification_token",
                    "webhook_secret",
                ),
                "classes": ("collapse",),
                "description": "لا تعرض المفاتيح الخام خارج لوحة الإدارة.",
            },
        ),
        (
            "عرض آمن للمفاتيح",
            {
                "fields": (
                    "has_credentials_display",
                    "masked_api_token_display",
                    "masked_secret_key_display",
                    "masked_public_key_display",
                    "masked_notification_token_display",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            "التواريخ",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )
    ordering = ("provider",)

    @admin.display(description="المزود")
    def provider_badge(self, obj: PaymentGatewayConfig):
        return _provider_badge(obj.provider)

    @admin.display(description="يوجد اعتماد؟", boolean=True)
    def has_credentials_display(self, obj: PaymentGatewayConfig) -> bool:
        return bool(getattr(obj, "has_credentials", False))

    @admin.display(description="API Token")
    def masked_api_token_display(self, obj: PaymentGatewayConfig) -> str:
        return obj.masked_api_token or "-"

    @admin.display(description="Secret Key")
    def masked_secret_key_display(self, obj: PaymentGatewayConfig) -> str:
        return obj.masked_secret_key or "-"

    @admin.display(description="Public Key")
    def masked_public_key_display(self, obj: PaymentGatewayConfig) -> str:
        return obj.masked_public_key or "-"

    @admin.display(description="Notification Token")
    def masked_notification_token_display(self, obj: PaymentGatewayConfig) -> str:
        return obj.masked_notification_token or "-"


# ============================================================
# Webhook Inline
# ============================================================

class PaymentGatewayWebhookLogInline(admin.TabularInline):
    model = PaymentGatewayWebhookLog
    extra = 0
    can_delete = False
    fields = (
        "id",
        "provider",
        "status",
        "event_type",
        "signature_valid",
        "remote_transaction_id",
        "remote_order_id",
        "remote_checkout_id",
        "received_at",
        "processed_at",
    )
    readonly_fields = fields
    show_change_link = True
    ordering = ("-id",)

    def has_add_permission(self, request, obj=None) -> bool:
        return False


# ============================================================
# Payment Gateway Transaction Admin
# ============================================================

@admin.register(PaymentGatewayTransaction)
class PaymentGatewayTransactionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "provider_badge",
        "status_badge",
        "gateway_status",
        "amount",
        "currency",
        "payment_method",
        "local_reference_display",
        "remote_reference_display",
        "customer_name",
        "is_webhook_verified",
        "paid_at",
        "created_at",
    )
    list_filter = (
        "provider",
        "status",
        "gateway_status",
        "payment_method",
        "currency",
        "local_reference_type",
        "is_webhook_verified",
        "created_at",
        "paid_at",
        "last_webhook_at",
    )
    search_fields = (
        "local_reference_type",
        "local_reference_id",
        "local_reference",
        "remote_transaction_id",
        "remote_order_id",
        "remote_checkout_id",
        "gateway_reference",
        "customer_name",
        "customer_email",
        "customer_phone",
        "gateway_status",
        "notes",
        "error_message",
    )
    readonly_fields = (
        "is_success_display",
        "is_final_display",
        "is_pending_display",
        "remote_reference_display",
        "local_reference_display",
        "created_at",
        "updated_at",
    )
    inlines = (PaymentGatewayWebhookLogInline,)
    ordering = ("-id",)
    date_hierarchy = "created_at"

    fieldsets = (
        (
            "معلومات العملية",
            {
                "fields": (
                    "provider",
                    "status",
                    "gateway_status",
                    "payment_method",
                    "currency",
                    "amount",
                )
            },
        ),
        (
            "المرجع المحلي",
            {
                "fields": (
                    "local_reference_type",
                    "local_reference_id",
                    "local_reference",
                    "local_reference_display",
                )
            },
        ),
        (
            "بيانات العميل",
            {
                "fields": (
                    "customer_name",
                    "customer_email",
                    "customer_phone",
                )
            },
        ),
        (
            "مراجع البوابة",
            {
                "fields": (
                    "remote_transaction_id",
                    "remote_order_id",
                    "remote_checkout_id",
                    "gateway_reference",
                    "remote_reference_display",
                )
            },
        ),
        (
            "روابط الدفع",
            {
                "fields": (
                    "payment_url",
                    "redirect_url",
                )
            },
        ),
        (
            "Webhook / Payment State",
            {
                "fields": (
                    "is_webhook_verified",
                    "last_webhook_at",
                    "paid_at",
                    "is_success_display",
                    "is_pending_display",
                    "is_final_display",
                )
            },
        ),
        (
            "Payloads",
            {
                "fields": (
                    "request_payload",
                    "response_payload",
                    "latest_webhook_payload",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            "ملاحظات وأخطاء",
            {
                "fields": (
                    "notes",
                    "error_message",
                )
            },
        ),
        (
            "التواريخ",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    actions = (
        "mark_selected_as_failed",
        "mark_selected_as_cancelled",
    )

    @admin.display(description="المزود")
    def provider_badge(self, obj: PaymentGatewayTransaction):
        return _provider_badge(obj.provider)

    @admin.display(description="الحالة")
    def status_badge(self, obj: PaymentGatewayTransaction):
        return _status_badge(obj.status)

    @admin.display(description="المرجع المحلي")
    def local_reference_display(self, obj: PaymentGatewayTransaction) -> str:
        return _safe(getattr(obj, "local_reference_key", ""))

    @admin.display(description="مرجع البوابة")
    def remote_reference_display(self, obj: PaymentGatewayTransaction) -> str:
        return _safe(getattr(obj, "remote_reference", ""))

    @admin.display(description="ناجحة؟", boolean=True)
    def is_success_display(self, obj: PaymentGatewayTransaction) -> bool:
        return bool(getattr(obj, "is_success", False))

    @admin.display(description="معلقة؟", boolean=True)
    def is_pending_display(self, obj: PaymentGatewayTransaction) -> bool:
        return bool(getattr(obj, "is_pending", False))

    @admin.display(description="نهائية؟", boolean=True)
    def is_final_display(self, obj: PaymentGatewayTransaction) -> bool:
        return bool(getattr(obj, "is_final", False))

    @admin.action(description="تعليم العمليات المحددة كفاشلة")
    def mark_selected_as_failed(self, request, queryset):
        updated = 0

        for tx in queryset:
            if getattr(tx, "is_final", False):
                continue

            tx.mark_failed(
                gateway_status=tx.gateway_status or "ADMIN_FAILED",
                error_message="Marked as failed from Django admin.",
                note="Marked as failed from Django admin.",
            )
            updated += 1

        self.message_user(request, f"تم تعليم {updated} عملية كفاشلة.")

    @admin.action(description="تعليم العمليات المحددة كملغاة")
    def mark_selected_as_cancelled(self, request, queryset):
        updated = 0

        for tx in queryset:
            if getattr(tx, "is_final", False):
                continue

            tx.mark_cancelled(
                gateway_status=tx.gateway_status or "ADMIN_CANCELLED",
                note="Marked as cancelled from Django admin.",
            )
            updated += 1

        self.message_user(request, f"تم تعليم {updated} عملية كملغاة.")


# ============================================================
# Payment Gateway Webhook Log Admin
# ============================================================

@admin.register(PaymentGatewayWebhookLog)
class PaymentGatewayWebhookLogAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "provider_badge",
        "status_badge",
        "event_type",
        "signature_valid",
        "transaction_link",
        "remote_transaction_id",
        "remote_order_id",
        "received_at",
        "processed_at",
    )
    list_filter = (
        "provider",
        "status",
        "event_type",
        "signature_valid",
        "received_at",
        "processed_at",
    )
    search_fields = (
        "event_type",
        "remote_transaction_id",
        "remote_order_id",
        "remote_checkout_id",
        "transaction__local_reference",
        "transaction__local_reference_id",
        "transaction__remote_transaction_id",
        "transaction__remote_order_id",
        "error_message",
        "notes",
    )
    readonly_fields = (
        "provider",
        "status",
        "event_type",
        "transaction",
        "signature_valid",
        "remote_transaction_id",
        "remote_order_id",
        "remote_checkout_id",
        "headers",
        "payload",
        "processing_result",
        "error_message",
        "notes",
        "received_at",
        "processed_at",
    )
    ordering = ("-id",)
    date_hierarchy = "received_at"

    fieldsets = (
        (
            "Webhook",
            {
                "fields": (
                    "provider",
                    "status",
                    "event_type",
                    "transaction",
                    "signature_valid",
                )
            },
        ),
        (
            "مراجع البوابة",
            {
                "fields": (
                    "remote_transaction_id",
                    "remote_order_id",
                    "remote_checkout_id",
                )
            },
        ),
        (
            "البيانات",
            {
                "fields": (
                    "headers",
                    "payload",
                    "processing_result",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            "الأخطاء والملاحظات",
            {
                "fields": (
                    "error_message",
                    "notes",
                )
            },
        ),
        (
            "التواريخ",
            {
                "fields": (
                    "received_at",
                    "processed_at",
                )
            },
        ),
    )

    actions = (
        "mark_selected_logs_processed",
        "mark_selected_logs_failed",
    )

    def has_add_permission(self, request) -> bool:
        return False

    @admin.display(description="المزود")
    def provider_badge(self, obj: PaymentGatewayWebhookLog):
        return _provider_badge(obj.provider)

    @admin.display(description="الحالة")
    def status_badge(self, obj: PaymentGatewayWebhookLog):
        return _status_badge(obj.status)

    @admin.display(description="العملية")
    def transaction_link(self, obj: PaymentGatewayWebhookLog):
        if not obj.transaction_id:
            return "-"

        return format_html(
            '<span style="font-weight:700;">#{}</span>',
            obj.transaction_id,
        )

    @admin.action(description="تعليم سجلات Webhook المحددة كمعالجة")
    def mark_selected_logs_processed(self, request, queryset):
        updated = 0

        for log in queryset:
            if log.is_processed:
                continue

            log.mark_processed(
                {
                    "source": "django_admin",
                    "message": "Marked as processed from Django admin.",
                }
            )
            updated += 1

        self.message_user(request, f"تم تعليم {updated} سجل كمعالج.")

    @admin.action(description="تعليم سجلات Webhook المحددة كفاشلة")
    def mark_selected_logs_failed(self, request, queryset):
        updated = 0

        for log in queryset:
            if log.is_failed:
                continue

            log.mark_failed(
                "Marked as failed from Django admin.",
                {
                    "source": "django_admin",
                    "message": "Marked as failed from Django admin.",
                },
            )
            updated += 1

        self.message_user(request, f"تم تعليم {updated} سجل كفاشل.")