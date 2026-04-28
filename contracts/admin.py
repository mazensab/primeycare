# ============================================================
# 📂 contracts/admin.py
# 🧠 Primey Care | Contracts Admin
# ------------------------------------------------------------
# ✅ إدارة العقود
# ✅ إدارة المنتجات المرتبطة بكل عقد
# ✅ فلاتر + بحث + عرض منظم
# ✅ عرض نسبة النظام ونسب الخصم
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
    autocomplete_fields = ("product",)


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
        "system_commission_percentage",
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
        "terms_and_conditions",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
    )
    autocomplete_fields = ("provider",)
    ordering = ("-created_at",)
    inlines = [ContractProductInline]

    fieldsets = (
        (
            "بيانات العقد الأساسية",
            {
                "fields": (
                    "provider",
                    "title",
                    "contract_number",
                    "status",
                )
            },
        ),
        (
            "تواريخ العقد",
            {
                "fields": (
                    "start_date",
                    "end_date",
                    "signed_at",
                )
            },
        ),
        (
            "بيانات مسؤول الجهة",
            {
                "fields": (
                    "provider_contact_name",
                    "provider_contact_phone",
                    "provider_contact_email",
                )
            },
        ),
        (
            "البيانات المالية",
            {
                "fields": (
                    "pricing_model",
                    "discount_percentage",
                    "system_commission_percentage",
                )
            },
        ),
        (
            "الشروط والملاحظات",
            {
                "fields": (
                    "terms_and_conditions",
                    "notes",
                )
            },
        ),
        (
            "التتبع",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )


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
    autocomplete_fields = (
        "contract",
        "product",
    )
    ordering = ("-created_at",)