# ============================================================
# 📂 payments/admin.py
# 🧠 Primey Care | Payments Admin
# ------------------------------------------------------------
# ✅ إدارة المدفوعات
# ✅ عرض مالي وتشغيلي منظم
# ✅ فلاتر + بحث + ترتيب
# ============================================================

from django.contrib import admin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "payment_number",
        "order",
        "customer",
        "amount",
        "paid_amount",
        "refunded_amount",
        "currency",
        "payment_method",
        "provider",
        "status",
        "paid_at",
        "created_at",
    )
    list_filter = (
        "status",
        "payment_method",
        "provider",
        "currency",
        "paid_at",
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
        "customer__name",
        "customer__phone",
        "customer__email",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
    )
    ordering = ("-created_at",)