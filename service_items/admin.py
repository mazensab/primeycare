# ============================================================
# 📂 service_items/admin.py
# 🧠 Primey Care | Service Items Admin
# ------------------------------------------------------------
# ✅ إدارة خدمات العقود
# ✅ فلاتر + بحث + ترتيب
# ✅ جاهز للتوسع لاحقًا
# ============================================================

from django.contrib import admin

from .models import ContractServiceItem


@admin.register(ContractServiceItem)
class ContractServiceItemAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "code",
        "contract",
        "contract_product",
        "coverage_type",
        "status",
        "special_price",
        "discount_percentage",
        "requires_approval",
        "is_featured",
        "sort_order",
        "created_at",
    )
    list_filter = (
        "status",
        "coverage_type",
        "requires_approval",
        "is_featured",
        "contract",
        "created_at",
    )
    search_fields = (
        "name",
        "code",
        "short_description",
        "description",
        "execution_notes",
        "coverage_notes",
        "contract__title",
        "contract__contract_number",
        "contract__provider__name",
        "contract_product__product__name",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
    )
    ordering = ("sort_order", "name")