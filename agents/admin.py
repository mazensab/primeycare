# ============================================================
# 📂 agents/admin.py
# 🧠 Primey Care | Agents Admin
# ------------------------------------------------------------
# ✅ إدارة المندوبين
# ✅ إدارة الطلبات المرتبطة بالمندوبين
# ✅ إدارة العمولات
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
    )
    search_fields = (
        "full_name",
        "agent_code",
        "referral_code",
        "phone",
        "email",
        "city",
        "notes",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
    )
    ordering = ("full_name",)


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
        "created_at",
    )
    list_filter = (
        "commission_type",
        "agent",
        "created_at",
    )
    search_fields = (
        "order__id",
        "agent__full_name",
        "agent__agent_code",
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
        "earned_at",
        "paid_at",
        "created_at",
    )
    list_filter = (
        "commission_status",
        "agent",
        "earned_at",
        "paid_at",
        "created_at",
    )
    search_fields = (
        "agent__full_name",
        "agent__agent_code",
        "order__id",
        "payment__payment_number",
        "notes",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
    )
    ordering = ("-created_at",)