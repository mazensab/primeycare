# ============================================================
# 📂 contracts/admin.py
# 🧠 Primey Care | Contracts Admin
# ------------------------------------------------------------
# ✅ إدارة العقود
# ✅ إدارة المنتجات المرتبطة بكل عقد
# ✅ فلاتر + بحث + عرض منظم
# ============================================================

from django.contrib import admin

from .models import Contract, ContractProduct


class ContractProductInline(admin.TabularInline):
    model = ContractProduct
    extra = 1
    fields = (
        "product",
        "is_active",
        "special_price",
        "discount_percentage",
        "coverage_notes",
    )


@admin.register(Contract)
class ContractAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "contract_number",
        "provider",
        "status",
        "pricing_model",
        "discount_percentage",
        "start_date",
        "end_date",
        "created_at",
    )
    list_filter = (
        "status",
        "pricing_model",
        "start_date",
        "end_date",
        "created_at",
        "provider",
    )
    search_fields = (
        "title",
        "contract_number",
        "provider__name",
        "provider_contact_name",
        "provider_contact_phone",
        "provider_contact_email",
        "notes",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
    )
    ordering = ("-created_at",)
    inlines = [ContractProductInline]


@admin.register(ContractProduct)
class ContractProductAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "contract",
        "product",
        "is_active",
        "special_price",
        "discount_percentage",
        "created_at",
    )
    list_filter = (
        "is_active",
        "created_at",
        "contract__status",
    )
    search_fields = (
        "contract__title",
        "contract__contract_number",
        "product__name",
        "coverage_notes",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
    )
    ordering = ("-created_at",)