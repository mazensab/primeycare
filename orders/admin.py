# ============================================================
# 📂 orders/admin.py
# 🧭 Primey Care — Orders Admin
# ============================================================

from django.contrib import admin

from .models import Order, OrderStatusHistory


class OrderStatusHistoryInline(admin.TabularInline):
    model = OrderStatusHistory
    extra = 0
    fields = ("from_status", "to_status", "note", "changed_by", "created_at")
    readonly_fields = ("created_at",)
    ordering = ("-created_at",)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "order_number",
        "customer",
        "product",
        "status",
        "payment_status",
        "fulfillment_status",
        "currency_code",
        "total_amount",
        "amount_paid",
        "source",
        "created_at",
    )

    list_filter = (
        "status",
        "payment_status",
        "fulfillment_status",
        "source",
        "currency_code",
        "product__product_type",
        "created_at",
    )

    search_fields = (
        "order_number",
        "customer__customer_code",
        "customer__display_name",
        "customer__phone_number",
        "customer__whatsapp_number",
        "customer__email",
        "product__code",
        "product__name",
        "issue_reference",
    )

    readonly_fields = (
        "order_number",
        "product_name",
        "product_type",
        "currency_code",
        "subtotal_amount",
        "total_amount",
        "created_at",
        "updated_at",
    )

    ordering = ("-created_at",)
    inlines = [OrderStatusHistoryInline]

    fieldsets = (
        (
            "Core Information",
            {
                "fields": (
                    "order_number",
                    "customer",
                    "product",
                    "status",
                    "payment_status",
                    "fulfillment_status",
                    "source",
                )
            },
        ),
        (
            "Product Snapshot",
            {
                "fields": (
                    "product_name",
                    "product_type",
                    "currency_code",
                )
            },
        ),
        (
            "Pricing",
            {
                "fields": (
                    "unit_price",
                    "quantity",
                    "subtotal_amount",
                    "discount_amount",
                    "tax_amount",
                    "total_amount",
                    "amount_paid",
                )
            },
        ),
        (
            "Fulfillment",
            {
                "fields": (
                    "issue_reference",
                    "issued_at",
                )
            },
        ),
        (
            "Notes",
            {
                "fields": (
                    "customer_notes",
                    "internal_notes",
                    "cancellation_reason",
                )
            },
        ),
        (
            "Audit Information",
            {
                "fields": (
                    "created_by",
                    "updated_by",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )


@admin.register(OrderStatusHistory)
class OrderStatusHistoryAdmin(admin.ModelAdmin):
    list_display = (
        "order",
        "from_status",
        "to_status",
        "changed_by",
        "created_at",
    )

    list_filter = (
        "to_status",
        "created_at",
    )

    search_fields = (
        "order__order_number",
        "note",
    )

    readonly_fields = ("created_at",)
    ordering = ("-created_at",)