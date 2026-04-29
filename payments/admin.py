# ============================================================
# 📂 payments/admin.py
# 🧠 Primey Care | Payments Admin
# ------------------------------------------------------------
# ✅ إدارة المدفوعات
# ✅ عرض مالي وتشغيلي منظم
# ✅ ربط مع الطلب / العميل / الفاتورة
# ✅ فلاتر + بحث + ترتيب
# ============================================================

from django.contrib import admin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "payment_number",
        "invoice",
        "order",
        "customer",
        "amount",
        "paid_amount",
        "refunded_amount",
        "currency",
        "payment_method",
        "provider",
        "status",
        "is_treasury_posted",
        "is_accounting_posted",
        "paid_at",
        "created_at",
    )
    list_filter = (
        "status",
        "payment_method",
        "provider",
        "currency",
        "is_treasury_posted",
        "is_accounting_posted",
        "paid_at",
        "cancelled_at",
        "created_at",
    )
    search_fields = (
        "payment_number",
        "external_reference",
        "transaction_id",
        "gateway_response_code",
        "gateway_message",
        "notes",
        "failure_reason",
        "treasury_movement_reference",
        "accounting_entry_reference",
        "customer__name",
        "customer__phone",
        "customer__email",
        "order__id",
        "invoice__id",
    )
    readonly_fields = (
        "payment_number",
        "created_at",
        "updated_at",
    )
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    list_select_related = (
        "invoice",
        "order",
        "customer",
    )

    fieldsets = (
        (
            "الربط الأساسي",
            {
                "fields": (
                    "payment_number",
                    "invoice",
                    "order",
                    "customer",
                )
            },
        ),
        (
            "بيانات الدفع",
            {
                "fields": (
                    "status",
                    "payment_method",
                    "provider",
                    "amount",
                    "paid_amount",
                    "refunded_amount",
                    "currency",
                )
            },
        ),
        (
            "مراجع الخزينة والمحاسبة",
            {
                "fields": (
                    "treasury_movement_reference",
                    "accounting_entry_reference",
                    "is_treasury_posted",
                    "is_accounting_posted",
                )
            },
        ),
        (
            "مراجع خارجية",
            {
                "fields": (
                    "external_reference",
                    "transaction_id",
                    "gateway_response_code",
                    "gateway_message",
                )
            },
        ),
        (
            "ملاحظات",
            {
                "fields": (
                    "notes",
                    "failure_reason",
                )
            },
        ),
        (
            "التواريخ",
            {
                "fields": (
                    "initiated_at",
                    "paid_at",
                    "refunded_at",
                    "cancelled_at",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )