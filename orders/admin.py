# ============================================================
# 📂 orders/admin.py
# 🧭 Primey Care — Orders Admin V2.6
# ------------------------------------------------------------
# ✅ إدارة الطلبات
# ✅ عرض بيانات العميل المرتبطة بالحساب و OTP
# ✅ دعم البحث برقم الجوال الموحد
# ✅ دعم حقول نوع الطلب والاشتراك والدفع والإحالة
# ✅ دعم الطلب من Product مباشر أو ContractProduct Offer
# ✅ دعم Snapshot العرض والسعر وقت الطلب
# ✅ دعم مندوب البيع ومندوب التوصيل
# ✅ دعم تحصيل الكاش عند الاستلام
# ✅ دعم مراحل تجهيز وطباعة وتسليم البطاقة
# ✅ تحسين الأداء عبر select_related / prefetch_related
# ✅ عرض تاريخ حالة الطلب القديم للتوافق
# ✅ عرض خط الزمن التشغيلي OrderTimeline
# ============================================================

from __future__ import annotations

from django.contrib import admin
from django.utils.html import format_html

from .models import Order, OrderStatusHistory, OrderTimeline


# ============================================================
# 🧩 Inline: Order Status History
# ============================================================

class OrderStatusHistoryInline(admin.TabularInline):
    model = OrderStatusHistory
    extra = 0
    fields = (
        "from_status",
        "to_status",
        "note",
        "changed_by",
        "created_at",
    )
    readonly_fields = (
        "from_status",
        "to_status",
        "note",
        "changed_by",
        "created_at",
    )
    can_delete = False
    ordering = ("-created_at",)

    def has_add_permission(self, request, obj=None) -> bool:
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False


# ============================================================
# 🧩 Inline: Order Timeline
# ============================================================

class OrderTimelineInline(admin.TabularInline):
    model = OrderTimeline
    extra = 0
    fields = (
        "event_type",
        "title",
        "from_status",
        "to_status",
        "from_payment_status",
        "to_payment_status",
        "from_fulfillment_status",
        "to_fulfillment_status",
        "amount",
        "agent",
        "delivery_agent",
        "actor",
        "created_at",
    )
    readonly_fields = (
        "event_type",
        "title",
        "from_status",
        "to_status",
        "from_payment_status",
        "to_payment_status",
        "from_fulfillment_status",
        "to_fulfillment_status",
        "amount",
        "agent",
        "delivery_agent",
        "actor",
        "created_at",
    )
    can_delete = False
    ordering = ("-created_at", "-id")

    def has_add_permission(self, request, obj=None) -> bool:
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False


# ============================================================
# 📦 Order Admin
# ============================================================

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "order_number",
        "customer_display",
        "customer_phone_display",
        "customer_account_badge",
        "product",
        "contract_product_display",
        "offer_source_badge",
        "order_kind_badge",
        "provider",
        "contract",
        "agent",
        "delivery_agent",
        "linked_invoice",
        "status_badge",
        "payment_status_badge",
        "fulfillment_status_badge",
        "payment_method_badge",
        "cash_collected_badge",
        "starts_at",
        "ends_at",
        "duration_days_display",
        "scheduled_at",
        "currency_code",
        "unit_price_before_discount",
        "unit_discount_percentage",
        "unit_price",
        "total_amount",
        "amount_paid",
        "remaining_amount_display",
        "source",
        "referral_code_used",
        "created_at",
    )

    list_filter = (
        "status",
        "payment_status",
        "fulfillment_status",
        "source",
        "order_kind",
        "offer_source",
        "payment_method",
        "currency_code",
        "product__product_type",
        "contract_product__is_active",
        "contract_product__is_featured",
        "contract_product__show_on_landing",
        "contract_product__show_on_mobile",
        "contract_product__show_on_offers",
        "customer__status",
        "customer__phone_verified_at",
        "customer__whatsapp_verified_at",
        "starts_at",
        "ends_at",
        "scheduled_at",
        "confirmed_at",
        "card_printed_at",
        "card_ready_at",
        "assigned_for_delivery_at",
        "out_for_delivery_at",
        "delivered_at",
        "completed_at",
        "cash_collected_at",
        "created_at",
    )

    search_fields = (
        "order_number",
        "customer__customer_code",
        "customer__display_name",
        "customer__phone_number",
        "customer__whatsapp_number",
        "customer__normalized_phone",
        "customer__email",
        "customer__user__username",
        "product__code",
        "product__name",
        "contract_product__offer_title",
        "contract_product__offer_subtitle",
        "contract_product__offer_badge",
        "contract_product__product__code",
        "contract_product__product__name",
        "provider__name",
        "provider__display_name",
        "provider__provider_name",
        "provider__name_ar",
        "provider__name_en",
        "contract__contract_number",
        "contract__title",
        "agent__agent_code",
        "agent__full_name",
        "delivery_agent__agent_code",
        "delivery_agent__full_name",
        "payment_reference",
        "referral_code_used",
        "offer_title",
        "offer_badge",
        "issue_reference",
        "customer_notes",
        "internal_notes",
        "delivery_notes",
    )

    readonly_fields = (
        "order_number",
        "linked_invoice",
        "customer_account_summary",
        "product_name",
        "product_type",
        "currency_code",
        "offer_title",
        "offer_badge",
        "subtotal_amount",
        "total_amount",
        "remaining_amount_display",
        "duration_days_display",
        "confirmed_at",
        "card_printed_at",
        "card_ready_at",
        "assigned_for_delivery_at",
        "out_for_delivery_at",
        "delivered_at",
        "completed_at",
        "cash_collected_at",
        "created_at",
        "updated_at",
    )

    autocomplete_fields = (
        "customer",
        "product",
        "contract_product",
        "provider",
        "contract",
        "agent",
        "delivery_agent",
        "cash_collected_by",
        "created_by",
        "updated_by",
    )

    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    list_per_page = 50
    inlines = [OrderTimelineInline, OrderStatusHistoryInline]

    fieldsets = (
        (
            "Core Information",
            {
                "fields": (
                    "order_number",
                    "customer",
                    "customer_account_summary",
                    "product",
                    "order_kind",
                    "status",
                    "payment_status",
                    "fulfillment_status",
                    "source",
                )
            },
        ),
        (
            "Offer / Contract Product Snapshot",
            {
                "fields": (
                    "contract_product",
                    "offer_source",
                    "offer_title",
                    "offer_badge",
                )
            },
        ),
        (
            "Lifecycle Relations",
            {
                "fields": (
                    "provider",
                    "contract",
                    "agent",
                    "delivery_agent",
                    "linked_invoice",
                    "referral_code_used",
                )
            },
        ),
        (
            "Subscription / Service Timing",
            {
                "fields": (
                    "starts_at",
                    "ends_at",
                    "duration_days_display",
                    "scheduled_at",
                )
            },
        ),
        (
            "Lifecycle Timestamps",
            {
                "fields": (
                    "confirmed_at",
                    "card_printed_at",
                    "card_ready_at",
                    "assigned_for_delivery_at",
                    "out_for_delivery_at",
                    "delivered_at",
                    "completed_at",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            "Payment Snapshot",
            {
                "fields": (
                    "payment_method",
                    "payment_reference",
                    "cash_collected_amount",
                    "cash_collected_at",
                    "cash_collected_by",
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
            "Pricing Snapshot",
            {
                "fields": (
                    "unit_price_before_discount",
                    "unit_discount_percentage",
                    "unit_price",
                    "quantity",
                    "subtotal_amount",
                    "discount_amount",
                    "tax_amount",
                    "total_amount",
                    "amount_paid",
                    "remaining_amount_display",
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
                    "delivery_notes",
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

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related(
                "customer",
                "customer__user",
                "product",
                "contract_product",
                "contract_product__product",
                "contract_product__contract",
                "contract_product__contract__provider",
                "provider",
                "contract",
                "agent",
                "delivery_agent",
                "cash_collected_by",
                "created_by",
                "updated_by",
            )
            .prefetch_related(
                "status_history",
                "timeline",
            )
        )

    @admin.display(description="Customer")
    def customer_display(self, obj: Order) -> str:
        if not obj.customer_id:
            return "-"

        return (
            obj.customer.display_name
            or obj.customer.customer_code
            or f"Customer #{obj.customer_id}"
        )

    @admin.display(description="Customer Phone")
    def customer_phone_display(self, obj: Order) -> str:
        if not obj.customer_id:
            return "-"

        return (
            obj.customer.normalized_phone
            or obj.customer.whatsapp_number
            or obj.customer.phone_number
            or "-"
        )

    @admin.display(description="Customer Account")
    def customer_account_badge(self, obj: Order) -> str:
        if not obj.customer_id:
            return "-"

        if obj.customer.user_id:
            return format_html(
                '<span style="color:#166534;font-weight:700;">Linked</span>'
            )

        return format_html(
            '<span style="color:#92400e;font-weight:700;">No account</span>'
        )

    @admin.display(description="Offer")
    def contract_product_display(self, obj: Order) -> str:
        if not obj.contract_product_id:
            return "-"

        title = (
            obj.offer_title
            or getattr(obj.contract_product, "offer_title", "")
            or getattr(obj.contract_product.product, "name", "")
            or f"Offer #{obj.contract_product_id}"
        )

        return format_html(
            '<span style="display:inline-block;padding:3px 8px;border-radius:999px;'
            'font-weight:700;color:#432a58;background:#f4ecff;">#{}</span><br>'
            '<small>{}</small>',
            obj.contract_product_id,
            title,
        )

    @admin.display(description="Offer Source")
    def offer_source_badge(self, obj: Order) -> str:
        value = obj.offer_source or Order.OfferSource.NONE

        colors = {
            Order.OfferSource.CONTRACT_PRODUCT: ("#432a58", "#f4ecff"),
            Order.OfferSource.PRODUCT: ("#075985", "#e0f2fe"),
            Order.OfferSource.MANUAL: ("#92400e", "#fef3c7"),
            Order.OfferSource.NONE: ("#6b7280", "#f3f4f6"),
        }

        fg, bg = colors.get(value, ("#374151", "#f3f4f6"))

        return format_html(
            '<span style="display:inline-block;padding:3px 8px;border-radius:999px;'
            'font-weight:700;color:{};background:{};">{}</span>',
            fg,
            bg,
            obj.get_offer_source_display(),
        )

    @admin.display(description="Order Kind")
    def order_kind_badge(self, obj: Order) -> str:
        value = obj.order_kind or Order.OrderKind.GENERAL

        colors = {
            Order.OrderKind.CARD: ("#432a58", "#f4ecff"),
            Order.OrderKind.PROGRAM: ("#166534", "#dcfce7"),
            Order.OrderKind.SERVICE: ("#075985", "#e0f2fe"),
            Order.OrderKind.SUBSCRIPTION: ("#92400e", "#fef3c7"),
            Order.OrderKind.GENERAL: ("#374151", "#f3f4f6"),
        }

        fg, bg = colors.get(value, ("#374151", "#f3f4f6"))

        return format_html(
            '<span style="display:inline-block;padding:3px 8px;border-radius:999px;'
            'font-weight:700;color:{};background:{};">{}</span>',
            fg,
            bg,
            obj.get_order_kind_display(),
        )

    @admin.display(description="Status")
    def status_badge(self, obj: Order) -> str:
        value = obj.status or Order.Status.PENDING

        colors = {
            Order.Status.DRAFT: ("#6b7280", "#f3f4f6"),
            Order.Status.PENDING: ("#92400e", "#fef3c7"),
            Order.Status.CONFIRMED: ("#075985", "#e0f2fe"),
            Order.Status.PROCESSING: ("#3730a3", "#e0e7ff"),
            Order.Status.CARD_READY: ("#432a58", "#f4ecff"),
            Order.Status.ASSIGNED_FOR_DELIVERY: ("#1d4ed8", "#dbeafe"),
            Order.Status.OUT_FOR_DELIVERY: ("#0f766e", "#ccfbf1"),
            Order.Status.DELIVERED: ("#166534", "#dcfce7"),
            Order.Status.COMPLETED: ("#166534", "#dcfce7"),
            Order.Status.CANCELLED: ("#991b1b", "#fee2e2"),
            Order.Status.REFUNDED: ("#7c2d12", "#ffedd5"),
        }

        fg, bg = colors.get(value, ("#374151", "#f3f4f6"))

        return format_html(
            '<span style="display:inline-block;padding:3px 8px;border-radius:999px;'
            'font-weight:700;color:{};background:{};">{}</span>',
            fg,
            bg,
            obj.get_status_display(),
        )

    @admin.display(description="Payment")
    def payment_status_badge(self, obj: Order) -> str:
        value = obj.payment_status or Order.PaymentStatus.UNPAID

        colors = {
            Order.PaymentStatus.UNPAID: ("#92400e", "#fef3c7"),
            Order.PaymentStatus.COD_PENDING: ("#92400e", "#fef3c7"),
            Order.PaymentStatus.PARTIALLY_PAID: ("#075985", "#e0f2fe"),
            Order.PaymentStatus.PAID: ("#166534", "#dcfce7"),
            Order.PaymentStatus.FAILED: ("#991b1b", "#fee2e2"),
            Order.PaymentStatus.REFUNDED: ("#7c2d12", "#ffedd5"),
        }

        fg, bg = colors.get(value, ("#374151", "#f3f4f6"))

        return format_html(
            '<span style="display:inline-block;padding:3px 8px;border-radius:999px;'
            'font-weight:700;color:{};background:{};">{}</span>',
            fg,
            bg,
            obj.get_payment_status_display(),
        )

    @admin.display(description="Fulfillment")
    def fulfillment_status_badge(self, obj: Order) -> str:
        value = obj.fulfillment_status or Order.FulfillmentStatus.NOT_STARTED

        colors = {
            Order.FulfillmentStatus.NOT_STARTED: ("#6b7280", "#f3f4f6"),
            Order.FulfillmentStatus.PENDING: ("#92400e", "#fef3c7"),
            Order.FulfillmentStatus.IN_PROGRESS: ("#3730a3", "#e0e7ff"),
            Order.FulfillmentStatus.ISSUED: ("#432a58", "#f4ecff"),
            Order.FulfillmentStatus.READY: ("#432a58", "#f4ecff"),
            Order.FulfillmentStatus.ASSIGNED: ("#1d4ed8", "#dbeafe"),
            Order.FulfillmentStatus.OUT_FOR_DELIVERY: ("#0f766e", "#ccfbf1"),
            Order.FulfillmentStatus.DELIVERED: ("#166534", "#dcfce7"),
            Order.FulfillmentStatus.FAILED: ("#991b1b", "#fee2e2"),
            Order.FulfillmentStatus.RETURNED: ("#7c2d12", "#ffedd5"),
        }

        fg, bg = colors.get(value, ("#374151", "#f3f4f6"))

        return format_html(
            '<span style="display:inline-block;padding:3px 8px;border-radius:999px;'
            'font-weight:700;color:{};background:{};">{}</span>',
            fg,
            bg,
            obj.get_fulfillment_status_display(),
        )

    @admin.display(description="Payment Method")
    def payment_method_badge(self, obj: Order) -> str:
        value = obj.payment_method or Order.PaymentMethod.NONE

        colors = {
            Order.PaymentMethod.CASH: ("#166534", "#dcfce7"),
            Order.PaymentMethod.CASH_ON_DELIVERY: ("#166534", "#dcfce7"),
            Order.PaymentMethod.BANK_TRANSFER: ("#075985", "#e0f2fe"),
            Order.PaymentMethod.CARD: ("#432a58", "#f4ecff"),
            Order.PaymentMethod.PAYMENT_GATEWAY: ("#432a58", "#f4ecff"),
            Order.PaymentMethod.TAMARA: ("#92400e", "#fef3c7"),
            Order.PaymentMethod.TABBY: ("#92400e", "#fef3c7"),
            Order.PaymentMethod.WALLET: ("#3730a3", "#e0e7ff"),
            Order.PaymentMethod.NONE: ("#6b7280", "#f3f4f6"),
            Order.PaymentMethod.OTHER: ("#374151", "#f3f4f6"),
        }

        fg, bg = colors.get(value, ("#374151", "#f3f4f6"))

        return format_html(
            '<span style="display:inline-block;padding:3px 8px;border-radius:999px;'
            'font-weight:700;color:{};background:{};">{}</span>',
            fg,
            bg,
            obj.get_payment_method_display(),
        )

    @admin.display(description="COD")
    def cash_collected_badge(self, obj: Order) -> str:
        if obj.payment_method != Order.PaymentMethod.CASH_ON_DELIVERY:
            return "-"

        if obj.payment_status == Order.PaymentStatus.PAID and obj.cash_collected_amount > 0:
            return format_html(
                '<span style="display:inline-block;padding:3px 8px;border-radius:999px;'
                'font-weight:700;color:#166534;background:#dcfce7;">Collected: {}</span>',
                obj.cash_collected_amount,
            )

        return format_html(
            '<span style="display:inline-block;padding:3px 8px;border-radius:999px;'
            'font-weight:700;color:#92400e;background:#fef3c7;">Pending</span>'
        )

    @admin.display(description="Customer Account Summary")
    def customer_account_summary(self, obj: Order) -> str:
        if not obj.customer_id:
            return "-"

        customer = obj.customer

        account_status = "Linked" if customer.user_id else "No account"
        phone_verified = "Yes" if customer.phone_verified_at else "No"
        whatsapp_verified = "Yes" if customer.whatsapp_verified_at else "No"

        return format_html(
            "<div>"
            "<strong>Code:</strong> {}<br>"
            "<strong>Name:</strong> {}<br>"
            "<strong>Phone:</strong> {}<br>"
            "<strong>Normalized:</strong> {}<br>"
            "<strong>Account:</strong> {}<br>"
            "<strong>Phone verified:</strong> {}<br>"
            "<strong>WhatsApp verified:</strong> {}"
            "</div>",
            customer.customer_code or "-",
            customer.display_name or "-",
            customer.phone_number or customer.whatsapp_number or "-",
            customer.normalized_phone or "-",
            account_status,
            phone_verified,
            whatsapp_verified,
        )

    @admin.display(description="Duration Days")
    def duration_days_display(self, obj: Order) -> str:
        if obj.duration_days is None:
            return "-"

        return str(obj.duration_days)

    @admin.display(description="Remaining")
    def remaining_amount_display(self, obj: Order) -> str:
        return str(obj.remaining_amount)

    @admin.display(description="Invoice")
    def linked_invoice(self, obj: Order):
        invoice = self._get_order_invoice(obj)
        return invoice or "-"

    def _get_order_invoice(self, obj: Order):
        try:
            invoice = obj.invoice
        except Exception:
            return None

        if hasattr(invoice, "all"):
            return invoice.all().first()

        return invoice


# ============================================================
# 🧾 Order Timeline Admin
# ============================================================

@admin.register(OrderTimeline)
class OrderTimelineAdmin(admin.ModelAdmin):
    list_display = (
        "order",
        "event_type",
        "title",
        "from_status",
        "to_status",
        "from_payment_status",
        "to_payment_status",
        "from_fulfillment_status",
        "to_fulfillment_status",
        "amount",
        "agent",
        "delivery_agent",
        "actor",
        "created_at",
    )

    list_filter = (
        "event_type",
        "to_status",
        "to_payment_status",
        "to_fulfillment_status",
        "created_at",
    )

    search_fields = (
        "order__order_number",
        "order__customer__customer_code",
        "order__customer__display_name",
        "order__customer__normalized_phone",
        "title",
        "description",
        "agent__agent_code",
        "agent__full_name",
        "delivery_agent__agent_code",
        "delivery_agent__full_name",
    )

    readonly_fields = (
        "order",
        "event_type",
        "from_status",
        "to_status",
        "from_payment_status",
        "to_payment_status",
        "from_fulfillment_status",
        "to_fulfillment_status",
        "title",
        "description",
        "amount",
        "agent",
        "delivery_agent",
        "actor",
        "metadata",
        "created_at",
    )

    autocomplete_fields = (
        "order",
        "agent",
        "delivery_agent",
        "actor",
    )

    ordering = ("-created_at", "-id")
    date_hierarchy = "created_at"
    list_per_page = 50

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related(
                "order",
                "order__customer",
                "agent",
                "delivery_agent",
                "actor",
            )
        )

    def has_add_permission(self, request) -> bool:
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False


# ============================================================
# 🧾 Order Status History Admin
# ============================================================

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
        "order__customer__customer_code",
        "order__customer__display_name",
        "order__customer__normalized_phone",
        "note",
    )

    readonly_fields = (
        "order",
        "from_status",
        "to_status",
        "note",
        "changed_by",
        "created_at",
    )

    autocomplete_fields = (
        "order",
        "changed_by",
    )

    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    list_per_page = 50

    def has_add_permission(self, request) -> bool:
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False