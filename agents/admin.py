# ============================================================
# 📂 agents/admin.py
# 🧠 Primey Care | Agents Admin
# ------------------------------------------------------------
# ✅ إدارة المندوبين
# ✅ إدارة الطلبات المرتبطة بالمندوبين
# ✅ إدارة العمولات
# ✅ مراجعة حالة الاستحقاق والاعتماد والصرف
# ============================================================

from django.contrib import admin

from .models import Agent, AgentCommission, AgentOrder


@admin.register(Agent)
class AgentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "full_name",
        "agent_code",
        "referral_code",
        "phone",
        "email",
        "city",
        "status",
        "default_commission_type",
        "default_commission_value",
        "created_at",
    )
    list_filter = (
        "status",
        "default_commission_type",
        "city",
        "created_at",
        "updated_at",
    )
    search_fields = (
        "full_name",
        "agent_code",
        "referral_code",
        "phone",
        "email",
        "city",
        "iban",
        "notes",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
    )
    ordering = ("full_name",)
    list_per_page = 50

    fieldsets = (
        (
            "بيانات المندوب",
            {
                "fields": (
                    "full_name",
                    "agent_code",
                    "referral_code",
                    "status",
                )
            },
        ),
        (
            "بيانات التواصل",
            {
                "fields": (
                    "phone",
                    "email",
                    "city",
                    "address",
                )
            },
        ),
        (
            "إعداد العمولة",
            {
                "fields": (
                    "default_commission_type",
                    "default_commission_value",
                )
            },
        ),
        (
            "البيانات البنكية",
            {
                "fields": (
                    "bank_name",
                    "bank_account_name",
                    "iban",
                )
            },
        ),
        (
            "ملاحظات وتتبع",
            {
                "fields": (
                    "notes",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )


@admin.register(AgentOrder)
class AgentOrderAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "order",
        "agent",
        "customer",
        "commission_type",
        "commission_value",
        "sales_amount",
        "commission_amount",
        "referral_code_used",
        "created_at",
    )
    list_filter = (
        "commission_type",
        "agent",
        "customer",
        "created_at",
        "updated_at",
    )
    search_fields = (
        "order__id",
        "agent__full_name",
        "agent__agent_code",
        "agent__referral_code",
        "referral_code_used",
        "customer__name",
        "customer__phone",
        "notes",
    )
    readonly_fields = (
        "commission_amount",
        "created_at",
        "updated_at",
    )
    ordering = ("-created_at",)
    list_per_page = 50
    autocomplete_fields = (
        "agent",
        "customer",
        "order",
    )

    fieldsets = (
        (
            "الربط التشغيلي",
            {
                "fields": (
                    "order",
                    "agent",
                    "customer",
                    "referral_code_used",
                )
            },
        ),
        (
            "العمولة",
            {
                "fields": (
                    "commission_type",
                    "commission_value",
                    "sales_amount",
                    "commission_amount",
                )
            },
        ),
        (
            "ملاحظات وتتبع",
            {
                "fields": (
                    "notes",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )


@admin.register(AgentCommission)
class AgentCommissionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "agent",
        "order",
        "payment",
        "commission_status",
        "base_amount",
        "commission_amount",
        "paid_amount",
        "remaining_amount",
        "earned_at",
        "approved_at",
        "paid_at",
        "created_at",
    )
    list_filter = (
        "commission_status",
        "agent",
        "earned_at",
        "approved_at",
        "paid_at",
        "created_at",
        "updated_at",
    )
    search_fields = (
        "agent__full_name",
        "agent__agent_code",
        "agent__referral_code",
        "order__id",
        "payment__payment_number",
        "notes",
    )
    readonly_fields = (
        "remaining_amount",
        "created_at",
        "updated_at",
    )
    ordering = ("-created_at",)
    list_per_page = 50
    autocomplete_fields = (
        "agent_order",
        "agent",
        "order",
        "payment",
    )

    fieldsets = (
        (
            "مصدر العمولة",
            {
                "fields": (
                    "agent_order",
                    "agent",
                    "order",
                    "payment",
                )
            },
        ),
        (
            "حالة العمولة",
            {
                "fields": (
                    "commission_status",
                    "earned_at",
                    "approved_at",
                    "paid_at",
                )
            },
        ),
        (
            "المبالغ",
            {
                "fields": (
                    "base_amount",
                    "commission_amount",
                    "paid_amount",
                    "remaining_amount",
                )
            },
        ),
        (
            "ملاحظات وتتبع",
            {
                "fields": (
                    "notes",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    @admin.display(description="المتبقي")
    def remaining_amount(self, obj):
        return obj.remaining_amount