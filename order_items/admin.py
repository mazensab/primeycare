# ============================================================
# 📂 order_items/admin.py
# 🧠 Primey Care | Order Items Admin V2.2
# ------------------------------------------------------------
# ✅ إدارة العناصر التشغيلية داخل الطلبات
# ✅ عرض نوع العنصر واللقطات التشغيلية
# ✅ عرض عرض ContractProduct المرتبط بالعنصر
# ✅ عرض Snapshot العرض والسعر وقت الطلب
# ✅ عرض السعر قبل الخصم وبعد الخصم والتنفيذ
# ✅ عرض الموافقات ومواعيد التنفيذ
# ✅ فلاتر + بحث + ترتيب
# ------------------------------------------------------------
# القاعدة المعتمدة:
# - Product = كتالوج ثابت
# - ContractProduct = عرض/سعر/خصم المنتج حسب مقدم الخدمة والعقد
# - OrderItem يحفظ Snapshot ولا يتأثر بتغيير العرض لاحقًا
# ============================================================

from __future__ import annotations

from django.contrib import admin
from django.utils.html import format_html

from .models import (
    FulfillmentStatus,
    OrderItem,
    OrderItemKind,
    OrderItemOfferSource,
    OrderItemStatus,
)


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "item_kind_badge",
        "offer_source_badge",
        "order",
        "product",
        "contract_product_display",
        "provider",
        "contract",
        "service_item",
        "fulfillment_reference",
        "quantity",
        "unit_price_before_discount",
        "unit_discount_percentage",
        "unit_price",
        "discount_percentage",
        "discount_amount",
        "net_unit_price",
        "total_amount",
        "status_badge",
        "fulfillment_status_badge",
        "requires_approval",
        "scheduled_at",
        "fulfilled_at",
        "created_at",
    )

    list_filter = (
        "item_kind",
        "offer_source",
        "status",
        "fulfillment_status",
        "requires_approval",
        "provider",
        "contract",
        "contract_product",
        "product_type",
        "currency_code",
        "scheduled_at",
        "approval_requested_at",
        "approved_at",
        "rejected_at",
        "started_at",
        "fulfilled_at",
        "cancelled_at",
        "created_at",
    )

    search_fields = (
        "title",
        "code",
        "fulfillment_reference",
        "offer_title",
        "offer_badge",
        "order__id",
        "order__order_number",
        "order__offer_title",
        "order__offer_badge",
        "product__name",
        "product__code",
        "product_name",
        "product_type",
        "provider__name",
        "provider__display_name",
        "provider__provider_name",
        "provider__name_ar",
        "provider__name_en",
        "provider_name",
        "contract__title",
        "contract__contract_number",
        "contract_number",
        "contract_product__offer_title",
        "contract_product__offer_subtitle",
        "contract_product__offer_badge",
        "contract_product__product__name",
        "contract_product__product__code",
        "contract_product__contract__contract_number",
        "service_item__name",
        "approval_notes",
        "execution_notes",
        "internal_notes",
    )

    readonly_fields = (
        "product_name",
        "product_type",
        "provider_name",
        "contract_number",
        "currency_code",
        "offer_title",
        "offer_badge",
        "net_unit_price",
        "total_amount",
        "line_total_before_discount_display",
        "line_total_after_discount_display",
        "approval_requested_at",
        "approved_at",
        "rejected_at",
        "started_at",
        "fulfilled_at",
        "cancelled_at",
        "created_at",
        "updated_at",
    )

    autocomplete_fields = (
        "order",
        "product",
        "provider",
        "contract",
        "contract_product",
        "service_item",
    )

    fieldsets = (
        (
            "Basic Information",
            {
                "fields": (
                    "order",
                    "item_kind",
                    "title",
                    "code",
                    "fulfillment_reference",
                    "status",
                    "fulfillment_status",
                )
            },
        ),
        (
            "Relations",
            {
                "fields": (
                    "product",
                    "provider",
                    "contract",
                    "contract_product",
                    "service_item",
                )
            },
        ),
        (
            "Offer Snapshot",
            {
                "fields": (
                    "offer_source",
                    "offer_title",
                    "offer_badge",
                )
            },
        ),
        (
            "Operational Snapshot",
            {
                "fields": (
                    "product_name",
                    "product_type",
                    "provider_name",
                    "contract_number",
                    "currency_code",
                )
            },
        ),
        (
            "Pricing Snapshot",
            {
                "fields": (
                    "quantity",
                    "unit_price_before_discount",
                    "unit_discount_percentage",
                    "unit_price",
                    "discount_percentage",
                    "discount_amount",
                    "line_total_before_discount_display",
                    "line_total_after_discount_display",
                    "net_unit_price",
                    "total_amount",
                )
            },
        ),
        (
            "Approval / Execution",
            {
                "fields": (
                    "requires_approval",
                    "approval_notes",
                    "execution_notes",
                    "internal_notes",
                    "scheduled_at",
                    "approval_requested_at",
                    "approved_at",
                    "rejected_at",
                    "started_at",
                    "fulfilled_at",
                    "cancelled_at",
                )
            },
        ),
        (
            "Audit",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    list_per_page = 50

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related(
                "order",
                "order__customer",
                "order__contract_product",
                "order__contract_product__product",
                "order__contract_product__contract",
                "order__contract_product__contract__provider",
                "product",
                "provider",
                "contract",
                "contract_product",
                "contract_product__product",
                "contract_product__contract",
                "contract_product__contract__provider",
                "service_item",
            )
        )

    @admin.display(description="Kind")
    def item_kind_badge(self, obj: OrderItem) -> str:
        value = obj.item_kind or OrderItemKind.PRODUCT

        colors = {
            OrderItemKind.PRODUCT: ("#374151", "#f3f4f6"),
            OrderItemKind.CARD: ("#432a58", "#f4ecff"),
            OrderItemKind.PROGRAM: ("#166534", "#dcfce7"),
            OrderItemKind.SERVICE: ("#075985", "#e0f2fe"),
            OrderItemKind.SUBSCRIPTION: ("#92400e", "#fef3c7"),
            OrderItemKind.OTHER: ("#6b7280", "#f3f4f6"),
        }

        fg, bg = colors.get(value, ("#374151", "#f3f4f6"))

        return format_html(
            '<span style="display:inline-block;padding:3px 8px;border-radius:999px;'
            'font-weight:700;color:{};background:{};">{}</span>',
            fg,
            bg,
            obj.get_item_kind_display(),
        )

    @admin.display(description="Offer Source")
    def offer_source_badge(self, obj: OrderItem) -> str:
        value = obj.offer_source or OrderItemOfferSource.NONE

        colors = {
            OrderItemOfferSource.CONTRACT_PRODUCT: ("#432a58", "#f4ecff"),
            OrderItemOfferSource.PRODUCT: ("#075985", "#e0f2fe"),
            OrderItemOfferSource.MANUAL: ("#92400e", "#fef3c7"),
            OrderItemOfferSource.NONE: ("#6b7280", "#f3f4f6"),
        }

        fg, bg = colors.get(value, ("#374151", "#f3f4f6"))

        return format_html(
            '<span style="display:inline-block;padding:3px 8px;border-radius:999px;'
            'font-weight:700;color:{};background:{};">{}</span>',
            fg,
            bg,
            obj.get_offer_source_display(),
        )

    @admin.display(description="Offer")
    def contract_product_display(self, obj: OrderItem) -> str:
        if not obj.contract_product_id:
            return "-"

        title = (
            obj.offer_title
            or getattr(obj.contract_product, "offer_title", "")
            or getattr(getattr(obj.contract_product, "product", None), "name", "")
            or f"Offer #{obj.contract_product_id}"
        )

        badge = obj.offer_badge or getattr(obj.contract_product, "offer_badge", "")

        if badge:
            return format_html(
                '<span style="display:inline-block;padding:3px 8px;border-radius:999px;'
                'font-weight:700;color:#432a58;background:#f4ecff;">#{}</span><br>'
                '<strong>{}</strong><br>'
                '<small style="color:#92400e;">{}</small>',
                obj.contract_product_id,
                title,
                badge,
            )

        return format_html(
            '<span style="display:inline-block;padding:3px 8px;border-radius:999px;'
            'font-weight:700;color:#432a58;background:#f4ecff;">#{}</span><br>'
            '<strong>{}</strong>',
            obj.contract_product_id,
            title,
        )

    @admin.display(description="Status")
    def status_badge(self, obj: OrderItem) -> str:
        value = obj.status or OrderItemStatus.PENDING

        colors = {
            OrderItemStatus.PENDING: ("#92400e", "#fef3c7"),
            OrderItemStatus.APPROVAL_PENDING: ("#92400e", "#fef3c7"),
            OrderItemStatus.APPROVED: ("#166534", "#dcfce7"),
            OrderItemStatus.REJECTED: ("#991b1b", "#fee2e2"),
            OrderItemStatus.SCHEDULED: ("#075985", "#e0f2fe"),
            OrderItemStatus.IN_PROGRESS: ("#3730a3", "#e0e7ff"),
            OrderItemStatus.COMPLETED: ("#166534", "#dcfce7"),
            OrderItemStatus.CANCELLED: ("#991b1b", "#fee2e2"),
        }

        fg, bg = colors.get(value, ("#374151", "#f3f4f6"))

        return format_html(
            '<span style="display:inline-block;padding:3px 8px;border-radius:999px;'
            'font-weight:700;color:{};background:{};">{}</span>',
            fg,
            bg,
            obj.get_status_display(),
        )

    @admin.display(description="Fulfillment")
    def fulfillment_status_badge(self, obj: OrderItem) -> str:
        value = obj.fulfillment_status or FulfillmentStatus.NOT_STARTED

        colors = {
            FulfillmentStatus.NOT_STARTED: ("#6b7280", "#f3f4f6"),
            FulfillmentStatus.PARTIAL: ("#075985", "#e0f2fe"),
            FulfillmentStatus.COMPLETED: ("#166534", "#dcfce7"),
            FulfillmentStatus.FAILED: ("#991b1b", "#fee2e2"),
            FulfillmentStatus.CANCELLED: ("#991b1b", "#fee2e2"),
        }

        fg, bg = colors.get(value, ("#374151", "#f3f4f6"))

        return format_html(
            '<span style="display:inline-block;padding:3px 8px;border-radius:999px;'
            'font-weight:700;color:{};background:{};">{}</span>',
            fg,
            bg,
            obj.get_fulfillment_status_display(),
        )

    @admin.display(description="Before Discount")
    def line_total_before_discount_display(self, obj: OrderItem) -> str:
        return str(obj.line_total_before_discount)

    @admin.display(description="After Discount")
    def line_total_after_discount_display(self, obj: OrderItem) -> str:
        return str(obj.line_total_after_discount)