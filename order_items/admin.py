# ============================================================
# 📂 order_items/admin.py
# 🧠 Primey Care | Order Items Admin
# ------------------------------------------------------------
# ✅ إدارة العناصر التشغيلية داخل الطلبات
# ✅ عرض السعر والخصم والتنفيذ
# ✅ فلاتر + بحث + ترتيب
# ============================================================

from django.contrib import admin

from .models import OrderItem


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "order",
        "product",
        "provider",
        "service_item",
        "quantity",
        "unit_price",
        "discount_percentage",
        "net_unit_price",
        "total_amount",
        "status",
        "fulfillment_status",
        "requires_approval",
        "created_at",
    )
    list_filter = (
        "status",
        "fulfillment_status",
        "requires_approval",
        "provider",
        "contract",
        "created_at",
    )
    search_fields = (
        "title",
        "code",
        "order__id",
        "product__name",
        "provider__name",
        "contract__title",
        "contract__contract_number",
        "service_item__name",
        "approval_notes",
        "execution_notes",
        "internal_notes",
    )
    readonly_fields = (
        "net_unit_price",
        "total_amount",
        "created_at",
        "updated_at",
    )
    ordering = ("-created_at",)