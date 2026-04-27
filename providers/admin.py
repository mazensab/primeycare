# ============================================================
# 📂 providers/admin.py
# 🧠 Primey Care | Providers Admin
# ------------------------------------------------------------
# ✅ تسجيل موديول الجهات المقدمة للخدمة داخل لوحة الإدارة
# ✅ عرض احترافي ومنظم
# ✅ بحث + فلاتر + ترتيب
# ============================================================

from django.contrib import admin

from .models import Provider


@admin.register(Provider)
class ProviderAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "code",
        "provider_type",
        "status",
        "city",
        "contact_person",
        "phone",
        "is_featured",
        "created_at",
    )
    list_filter = (
        "provider_type",
        "status",
        "is_featured",
        "city",
        "created_at",
    )
    search_fields = (
        "name",
        "code",
        "contact_person",
        "phone",
        "mobile",
        "email",
        "city",
        "area",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
    )
    ordering = ("name",)