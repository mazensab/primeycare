# ============================================================
# 📂 orders/models.py
# 🧭 Primey Care — Orders Module V2.5
# ------------------------------------------------------------
# ✅ يربط العميل بالمنتج
# ✅ يدعم الطلب من Product مباشر أو من ContractProduct Offer
# ✅ يدعم دورة الطلب الكاملة Order Lifecycle
# ✅ يدعم طلبات:
#    - بطاقة
#    - برنامج طبي
#    - خدمة مرة واحدة
#    - اشتراك
# ✅ يدعم مدة الاشتراك / صلاحية البطاقة
# ✅ يدعم موعد الخدمة الاختياري
# ✅ يدعم طريقة الدفع المختارة كـ snapshot داخل الطلب
# ✅ يدعم كاش عند الاستلام COD
# ✅ يدعم مندوب البيع ومندوب التوصيل بشكل منفصل
# ✅ يدعم مراحل تجهيز وطباعة وتسليم البطاقة
# ✅ يدعم خط زمني تشغيلي كامل للطلب
# ✅ يدعم الربط مع:
#    - Product
#    - ContractProduct Offer
#    - Provider / Center
#    - Contract
#    - Agent
#    - Delivery Agent
#    - Invoice عبر العلاقة العكسية من invoices.Invoice.order
# ✅ يحفظ السعر وقت الطلب
# ✅ يحفظ Snapshot العرض وقت الطلب
# ✅ يدعم حالات الطلب والدفع والتنفيذ
# ✅ جاهز للربط مع الفواتير والمدفوعات والخزينة والعمولات
# ------------------------------------------------------------
# القاعدة المعتمدة:
# - Product = كتالوج ثابت
# - ContractProduct = عرض/سعر/خصم المنتج حسب مقدم الخدمة والعقد
# - Order يحفظ Snapshot ولا يتأثر بتغيير المنتج أو العقد لاحقًا
# ============================================================

from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone

from customers.models import Customer
from products.models import Product


# ============================================================
# 🧩 Order Model
# ============================================================

class Order(models.Model):
    # --------------------------------------------------------
    # 🔹 Choice Enums
    # --------------------------------------------------------
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PENDING = "pending", "Pending"
        CONFIRMED = "confirmed", "Confirmed"
        PROCESSING = "processing", "Processing"
        CARD_READY = "card_ready", "Card Ready"
        ASSIGNED_FOR_DELIVERY = "assigned_for_delivery", "Assigned for Delivery"
        OUT_FOR_DELIVERY = "out_for_delivery", "Out for Delivery"
        DELIVERED = "delivered", "Delivered"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"
        REFUNDED = "refunded", "Refunded"

    class PaymentStatus(models.TextChoices):
        UNPAID = "unpaid", "Unpaid"
        COD_PENDING = "cod_pending", "Cash on Delivery Pending"
        PARTIALLY_PAID = "partially_paid", "Partially Paid"
        PAID = "paid", "Paid"
        FAILED = "failed", "Failed"
        REFUNDED = "refunded", "Refunded"

    class OrderSource(models.TextChoices):
        WEBSITE = "website", "Website"
        WHATSAPP = "whatsapp", "WhatsApp"
        AGENT = "agent", "Agent"
        ADMIN = "admin", "Admin"
        MOBILE_APP = "mobile_app", "Mobile App"
        LANDING = "landing", "Landing"
        CHECKOUT = "checkout", "Checkout"
        OTHER = "other", "Other"

    class FulfillmentStatus(models.TextChoices):
        NOT_STARTED = "not_started", "Not Started"
        PENDING = "pending", "Pending"
        IN_PROGRESS = "in_progress", "In Progress"
        ISSUED = "issued", "Issued"
        READY = "ready", "Ready"
        ASSIGNED = "assigned", "Assigned"
        OUT_FOR_DELIVERY = "out_for_delivery", "Out for Delivery"
        DELIVERED = "delivered", "Delivered"
        FAILED = "failed", "Failed"
        RETURNED = "returned", "Returned"

    class OrderKind(models.TextChoices):
        GENERAL = "general", "General"
        CARD = "card", "Card"
        PROGRAM = "program", "Program"
        SERVICE = "service", "Service"
        SUBSCRIPTION = "subscription", "Subscription"

    class PaymentMethod(models.TextChoices):
        NONE = "none", "None"
        CASH = "cash", "Cash"
        CASH_ON_DELIVERY = "cash_on_delivery", "Cash on Delivery"
        BANK_TRANSFER = "bank_transfer", "Bank Transfer"
        CARD = "card", "Card"
        PAYMENT_GATEWAY = "payment_gateway", "Payment Gateway"
        WALLET = "wallet", "Wallet"
        TAMARA = "tamara", "Tamara"
        TABBY = "tabby", "Tabby"
        OTHER = "other", "Other"

    class OfferSource(models.TextChoices):
        NONE = "none", "None"
        PRODUCT = "product", "Product"
        CONTRACT_PRODUCT = "contract_product", "Contract Product"
        MANUAL = "manual", "Manual"

    # --------------------------------------------------------
    # 🔹 Core Fields
    # --------------------------------------------------------
    order_number = models.CharField(
        max_length=30,
        unique=True,
        blank=True,
        db_index=True,
        verbose_name="Order Number",
        help_text="Auto-generated unique order number.",
    )

    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="orders",
        verbose_name="Customer",
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="orders",
        verbose_name="Product",
    )

    order_kind = models.CharField(
        max_length=30,
        choices=OrderKind.choices,
        default=OrderKind.GENERAL,
        db_index=True,
        verbose_name="Order Kind",
        help_text="Business type of this order: card, program, service, subscription, or general.",
    )

    # --------------------------------------------------------
    # 🔹 Offer / Contract Product Link
    # --------------------------------------------------------
    contract_product = models.ForeignKey(
        "contracts.ContractProduct",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
        verbose_name="Contract Product Offer",
        help_text="Selected provider offer used to price this order when coming from landing/offers/checkout.",
    )

    offer_source = models.CharField(
        max_length=30,
        choices=OfferSource.choices,
        default=OfferSource.NONE,
        db_index=True,
        verbose_name="Offer Source",
        help_text="Where the order pricing snapshot came from.",
    )

    offer_title = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Offer Title Snapshot",
    )

    offer_badge = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="Offer Badge Snapshot",
    )

    # --------------------------------------------------------
    # 🔹 Lifecycle Relations
    # --------------------------------------------------------
    provider = models.ForeignKey(
        "providers.Provider",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
        verbose_name="Provider / Center",
        help_text="Resolved provider/center for this order when applicable.",
    )

    contract = models.ForeignKey(
        "contracts.Contract",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
        verbose_name="Contract",
        help_text="Resolved contract used to price/fulfill this order when applicable.",
    )

    agent = models.ForeignKey(
        "agents.Agent",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sales_orders",
        verbose_name="Sales Agent",
        help_text="Sales/referral agent linked to this order. Resolved automatically for agent users or referral codes.",
    )

    delivery_agent = models.ForeignKey(
        "agents.Agent",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="delivery_orders",
        verbose_name="Delivery Agent",
        help_text="Agent assigned to deliver the card/order and collect COD amount when applicable.",
    )

    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
        verbose_name="Order Status",
    )

    payment_status = models.CharField(
        max_length=30,
        choices=PaymentStatus.choices,
        default=PaymentStatus.UNPAID,
        db_index=True,
        verbose_name="Payment Status",
    )

    fulfillment_status = models.CharField(
        max_length=30,
        choices=FulfillmentStatus.choices,
        default=FulfillmentStatus.NOT_STARTED,
        db_index=True,
        verbose_name="Fulfillment Status",
    )

    source = models.CharField(
        max_length=20,
        choices=OrderSource.choices,
        default=OrderSource.ADMIN,
        db_index=True,
        verbose_name="Order Source",
    )

    # --------------------------------------------------------
    # 🔹 Subscription / Service Timing
    # --------------------------------------------------------
    starts_at = models.DateField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="Start Date",
        help_text="Start date for card/program/subscription validity.",
    )

    ends_at = models.DateField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="End Date",
        help_text="End date for card/program/subscription validity.",
    )

    scheduled_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="Scheduled At",
        help_text="Optional appointment/execution datetime for one-time services.",
    )

    # --------------------------------------------------------
    # 🔹 Lifecycle Timestamps
    # --------------------------------------------------------
    confirmed_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="Confirmed At",
    )

    card_printed_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="Card Printed At",
    )

    card_ready_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="Card Ready At",
    )

    assigned_for_delivery_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="Assigned for Delivery At",
    )

    out_for_delivery_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="Out for Delivery At",
    )

    delivered_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="Delivered At",
    )

    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="Completed At",
    )

    # --------------------------------------------------------
    # 🔹 Payment Snapshot
    # --------------------------------------------------------
    payment_method = models.CharField(
        max_length=30,
        choices=PaymentMethod.choices,
        default=PaymentMethod.NONE,
        db_index=True,
        verbose_name="Payment Method",
        help_text="Selected payment method at order creation time.",
    )

    payment_reference = models.CharField(
        max_length=120,
        blank=True,
        db_index=True,
        verbose_name="Payment Reference",
        help_text="Optional external or internal payment reference.",
    )

    cash_collected_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Cash Collected Amount",
        help_text="Amount collected by delivery agent for COD orders.",
    )

    cash_collected_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="Cash Collected At",
    )

    cash_collected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders_cash_collected",
        verbose_name="Cash Collected By",
    )

    # --------------------------------------------------------
    # 🔹 Referral / Attribution Snapshot
    # --------------------------------------------------------
    referral_code_used = models.CharField(
        max_length=100,
        blank=True,
        db_index=True,
        verbose_name="Referral Code Used",
        help_text="Agent/referral/employee code used when creating the order.",
    )

    # --------------------------------------------------------
    # 🔹 Product / Offer Snapshot Fields
    # --------------------------------------------------------
    product_name = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Product Name Snapshot",
    )

    product_type = models.CharField(
        max_length=30,
        blank=True,
        db_index=True,
        verbose_name="Product Type Snapshot",
    )

    currency_code = models.CharField(
        max_length=10,
        default="SAR",
        db_index=True,
        verbose_name="Currency Code",
    )

    unit_price_before_discount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Unit Price Before Discount",
        help_text="Snapshot of original unit price before discount.",
    )

    unit_discount_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Unit Discount Percentage",
        help_text="Snapshot discount percentage used for this order.",
    )

    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Unit Price",
        help_text="Final unit price after discount.",
    )

    quantity = models.PositiveIntegerField(
        default=1,
        verbose_name="Quantity",
    )

    subtotal_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Subtotal Amount",
    )

    discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Discount Amount",
    )

    tax_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Tax Amount",
    )

    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Total Amount",
    )

    amount_paid = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Amount Paid",
    )

    # --------------------------------------------------------
    # 🔹 Fulfillment / Issue Data
    # --------------------------------------------------------
    issue_reference = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="Issue Reference",
        help_text="Used for card/program/service issue reference.",
    )

    issued_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Issued At",
    )

    # --------------------------------------------------------
    # 🔹 Notes
    # --------------------------------------------------------
    customer_notes = models.TextField(
        blank=True,
        verbose_name="Customer Notes",
    )

    internal_notes = models.TextField(
        blank=True,
        verbose_name="Internal Notes",
    )

    delivery_notes = models.TextField(
        blank=True,
        verbose_name="Delivery Notes",
    )

    cancellation_reason = models.TextField(
        blank=True,
        verbose_name="Cancellation Reason",
    )

    # --------------------------------------------------------
    # 🔹 Audit Fields
    # --------------------------------------------------------
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders_created",
        verbose_name="Created By",
    )

    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders_updated",
        verbose_name="Updated By",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="Created At",
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="Updated At",
    )

    # --------------------------------------------------------
    # 🔹 Meta
    # --------------------------------------------------------
    class Meta:
        verbose_name = "Order"
        verbose_name_plural = "Orders"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["order_number"]),
            models.Index(fields=["status", "payment_status"]),
            models.Index(fields=["status", "fulfillment_status"]),
            models.Index(fields=["source"]),
            models.Index(fields=["order_kind"]),
            models.Index(fields=["offer_source"]),
            models.Index(fields=["payment_method"]),
            models.Index(fields=["customer", "created_at"]),
            models.Index(fields=["product", "created_at"]),
            models.Index(fields=["contract_product", "created_at"]),
            models.Index(fields=["provider", "created_at"]),
            models.Index(fields=["contract", "created_at"]),
            models.Index(fields=["agent", "created_at"]),
            models.Index(fields=["delivery_agent", "created_at"]),
            models.Index(fields=["fulfillment_status"]),
            models.Index(fields=["currency_code"]),
            models.Index(fields=["starts_at", "ends_at"]),
            models.Index(fields=["scheduled_at"]),
            models.Index(fields=["referral_code_used"]),
            models.Index(fields=["confirmed_at"]),
            models.Index(fields=["card_ready_at"]),
            models.Index(fields=["assigned_for_delivery_at"]),
            models.Index(fields=["out_for_delivery_at"]),
            models.Index(fields=["delivered_at"]),
            models.Index(fields=["cash_collected_at"]),
        ]

    # --------------------------------------------------------
    # 🔹 String Representation
    # --------------------------------------------------------
    def __str__(self) -> str:
        return self.order_number or f"Order #{self.pk}"

    # --------------------------------------------------------
    # 🔹 Derived Helpers
    # --------------------------------------------------------
    @property
    def remaining_amount(self) -> Decimal:
        remaining = (self.total_amount or Decimal("0.00")) - (self.amount_paid or Decimal("0.00"))
        return remaining if remaining > Decimal("0.00") else Decimal("0.00")

    @property
    def is_paid(self) -> bool:
        return self.payment_status == self.PaymentStatus.PAID

    @property
    def is_cash_on_delivery(self) -> bool:
        return self.payment_method == self.PaymentMethod.CASH_ON_DELIVERY

    @property
    def is_subscription_like(self) -> bool:
        return self.order_kind in {
            self.OrderKind.CARD,
            self.OrderKind.PROGRAM,
            self.OrderKind.SUBSCRIPTION,
        }

    @property
    def is_service_like(self) -> bool:
        return self.order_kind == self.OrderKind.SERVICE

    @property
    def has_offer(self) -> bool:
        return bool(self.contract_product_id)

    @property
    def duration_days(self) -> int | None:
        if not self.starts_at or not self.ends_at:
            return None

        days = (self.ends_at - self.starts_at).days + 1
        return days if days > 0 else 0

    @property
    def can_be_confirmed(self) -> bool:
        return self.status in {self.Status.DRAFT, self.Status.PENDING}

    @property
    def can_be_marked_card_ready(self) -> bool:
        return self.status in {self.Status.CONFIRMED, self.Status.PROCESSING}

    @property
    def can_be_assigned_for_delivery(self) -> bool:
        return self.status in {
            self.Status.CONFIRMED,
            self.Status.PROCESSING,
            self.Status.CARD_READY,
        }

    @property
    def can_start_delivery(self) -> bool:
        return self.status == self.Status.ASSIGNED_FOR_DELIVERY and bool(self.delivery_agent_id)

    @property
    def can_be_delivered(self) -> bool:
        return self.status == self.Status.OUT_FOR_DELIVERY

    @property
    def can_be_completed(self) -> bool:
        if self.status not in {self.Status.DELIVERED, self.Status.CONFIRMED, self.Status.PROCESSING}:
            return False

        if self.is_cash_on_delivery and self.payment_status != self.PaymentStatus.PAID:
            return False

        return self.fulfillment_status in {
            self.FulfillmentStatus.ISSUED,
            self.FulfillmentStatus.DELIVERED,
        }

    @property
    def can_be_cancelled(self) -> bool:
        return self.status not in {
            self.Status.CANCELLED,
            self.Status.REFUNDED,
            self.Status.COMPLETED,
            self.Status.DELIVERED,
        }

    @property
    def has_invoice(self) -> bool:
        try:
            return bool(self.invoice)
        except Exception:
            return False

    # --------------------------------------------------------
    # 🔹 Internal Helpers
    # --------------------------------------------------------
    def _generate_order_number(self) -> str:
        if self.pk:
            return f"ORD-{self.pk:06d}"
        return ""

    def _resolve_order_kind_from_product_type(self) -> str | None:
        product_type = (self.product_type or "").strip().lower()

        if product_type in {"card", "cards", "membership", "membership_card"}:
            return self.OrderKind.CARD

        if product_type in {"program", "programs", "medical_program"}:
            return self.OrderKind.PROGRAM

        if product_type in {"service", "services", "medical_service"}:
            return self.OrderKind.SERVICE

        if product_type in {"subscription", "subscriptions", "plan", "plans"}:
            return self.OrderKind.SUBSCRIPTION

        return None

    def _sync_relations_from_contract_product(self) -> None:
        if not self.contract_product_id:
            return

        contract_product = self.contract_product

        if getattr(contract_product, "product_id", None):
            self.product = contract_product.product

        contract = getattr(contract_product, "contract", None)

        if contract:
            self.contract = contract
            if getattr(contract, "provider_id", None):
                self.provider = contract.provider

        if self.offer_source == self.OfferSource.NONE:
            self.offer_source = self.OfferSource.CONTRACT_PRODUCT

    def _sync_product_snapshot(self) -> None:
        if not self.product_id:
            return

        self.product_name = getattr(self.product, "name", "") or ""
        self.product_type = getattr(self.product, "product_type", "") or ""
        self.currency_code = (getattr(self.product, "currency_code", "") or "SAR").strip().upper()

        if self.order_kind == self.OrderKind.GENERAL:
            resolved_kind = self._resolve_order_kind_from_product_type()
            if resolved_kind:
                self.order_kind = resolved_kind

    def _sync_offer_snapshot(self) -> None:
        if self.contract_product_id:
            contract_product = self.contract_product

            self.offer_title = (
                getattr(contract_product, "offer_title", "")
                or getattr(self.product, "offer_title", "")
                or getattr(self.product, "name", "")
                or ""
            )
            self.offer_badge = getattr(contract_product, "offer_badge", "") or ""

            before = getattr(contract_product, "effective_price_before_discount", None)
            after = getattr(contract_product, "effective_price_after_discount", None)
            discount = getattr(contract_product, "discount_percentage", Decimal("0.00"))

            if before is not None:
                self.unit_price_before_discount = before or Decimal("0.00")

            if after is not None:
                self.unit_price = after or Decimal("0.00")

            self.unit_discount_percentage = discount or Decimal("0.00")

            if self.offer_source == self.OfferSource.NONE:
                self.offer_source = self.OfferSource.CONTRACT_PRODUCT
            return

        if self.product_id:
            self.offer_title = getattr(self.product, "offer_title", "") or ""
            self.offer_badge = getattr(self.product, "offer_badge", "") or ""

            before = getattr(self.product, "price_before_discount", None) or getattr(self.product, "price", Decimal("0.00"))
            after = getattr(self.product, "price_after_discount", None) or getattr(self.product, "effective_price", before)
            discount = getattr(self.product, "discount_percentage", Decimal("0.00"))

            if not self.unit_price_before_discount or self.unit_price_before_discount <= Decimal("0.00"):
                self.unit_price_before_discount = before or Decimal("0.00")

            if not self.unit_price or self.unit_price <= Decimal("0.00"):
                self.unit_price = after or Decimal("0.00")

            self.unit_discount_percentage = discount or Decimal("0.00")

            if self.offer_source == self.OfferSource.NONE and (self.offer_title or self.unit_discount_percentage > Decimal("0.00")):
                self.offer_source = self.OfferSource.PRODUCT

    def _resolve_unit_price(self) -> Decimal:
        if self.unit_price and self.unit_price > Decimal("0.00"):
            return self.unit_price

        if self.contract_product_id:
            effective_offer_price = getattr(self.contract_product, "effective_price_after_discount", None)
            if effective_offer_price is not None:
                return effective_offer_price or Decimal("0.00")

        effective_price = getattr(self.product, "price_after_discount", None)
        if effective_price is not None:
            return effective_price or Decimal("0.00")

        legacy_effective_price = getattr(self.product, "effective_price", None)
        if legacy_effective_price is not None:
            return legacy_effective_price or Decimal("0.00")

        return getattr(self.product, "price", Decimal("0.00")) or Decimal("0.00")

    def _recalculate_amounts(self) -> None:
        self.unit_price = self._resolve_unit_price()

        if not self.unit_price_before_discount or self.unit_price_before_discount <= Decimal("0.00"):
            self.unit_price_before_discount = self.unit_price

        quantity = self.quantity or 1
        subtotal_before_discount = self.unit_price_before_discount * Decimal(quantity)
        subtotal_after_discount = self.unit_price * Decimal(quantity)

        if not self.discount_amount or self.discount_amount <= Decimal("0.00"):
            calculated_discount = subtotal_before_discount - subtotal_after_discount
            self.discount_amount = calculated_discount if calculated_discount > Decimal("0.00") else Decimal("0.00")

        tax = self.tax_amount or Decimal("0.00")
        total = subtotal_after_discount + tax

        if total < Decimal("0.00"):
            total = Decimal("0.00")

        self.subtotal_amount = subtotal_before_discount
        self.total_amount = total

    def _sync_payment_status(self) -> None:
        total = self.total_amount or Decimal("0.00")
        paid = self.amount_paid or Decimal("0.00")

        if self.payment_method == self.PaymentMethod.CASH_ON_DELIVERY and paid <= Decimal("0.00"):
            self.payment_status = self.PaymentStatus.COD_PENDING
            return

        if total <= Decimal("0.00") and paid <= Decimal("0.00"):
            self.payment_status = self.PaymentStatus.UNPAID
            return

        if paid <= Decimal("0.00"):
            self.payment_status = self.PaymentStatus.UNPAID
            return

        if paid >= total:
            self.payment_status = self.PaymentStatus.PAID
            return

        self.payment_status = self.PaymentStatus.PARTIALLY_PAID

    def _sync_lifecycle_timestamps(self) -> None:
        now = timezone.now()

        if self.status == self.Status.CONFIRMED and not self.confirmed_at:
            self.confirmed_at = now

        if self.status == self.Status.CARD_READY and not self.card_ready_at:
            self.card_ready_at = now

        if self.status == self.Status.ASSIGNED_FOR_DELIVERY and not self.assigned_for_delivery_at:
            self.assigned_for_delivery_at = now

        if self.status == self.Status.OUT_FOR_DELIVERY and not self.out_for_delivery_at:
            self.out_for_delivery_at = now

        if self.status == self.Status.DELIVERED and not self.delivered_at:
            self.delivered_at = now

        if self.status == self.Status.COMPLETED and not self.completed_at:
            self.completed_at = now

        if self.fulfillment_status == self.FulfillmentStatus.ISSUED and not self.issued_at:
            self.issued_at = now

        if self.fulfillment_status == self.FulfillmentStatus.READY and not self.card_ready_at:
            self.card_ready_at = now

        if self.fulfillment_status == self.FulfillmentStatus.DELIVERED and not self.delivered_at:
            self.delivered_at = now

        if self.payment_status == self.PaymentStatus.PAID and self.is_cash_on_delivery and self.cash_collected_amount > Decimal("0.00") and not self.cash_collected_at:
            self.cash_collected_at = now

    def _normalize_strings(self) -> None:
        self.customer_notes = (self.customer_notes or "").strip()
        self.internal_notes = (self.internal_notes or "").strip()
        self.delivery_notes = (self.delivery_notes or "").strip()
        self.cancellation_reason = (self.cancellation_reason or "").strip()
        self.issue_reference = (self.issue_reference or "").strip()
        self.currency_code = (self.currency_code or "SAR").strip().upper()
        self.payment_reference = (self.payment_reference or "").strip()
        self.referral_code_used = (self.referral_code_used or "").strip()
        self.offer_title = (self.offer_title or "").strip()
        self.offer_badge = (self.offer_badge or "").strip()

    def _expand_update_fields(self, update_fields) -> set[str] | None:
        if update_fields is None:
            return None

        expanded = set(update_fields)

        calculated_fields = {
            "product",
            "product_name",
            "product_type",
            "provider",
            "contract",
            "offer_source",
            "offer_title",
            "offer_badge",
            "currency_code",
            "unit_price_before_discount",
            "unit_discount_percentage",
            "unit_price",
            "subtotal_amount",
            "discount_amount",
            "total_amount",
            "payment_status",
            "updated_at",
        }

        lifecycle_fields = {
            "confirmed_at",
            "card_printed_at",
            "card_ready_at",
            "assigned_for_delivery_at",
            "out_for_delivery_at",
            "delivered_at",
            "completed_at",
            "issued_at",
            "cash_collected_at",
            "updated_at",
        }

        trigger_fields = {
            "product",
            "product_id",
            "contract_product",
            "contract_product_id",
            "provider",
            "provider_id",
            "contract",
            "contract_id",
            "unit_price_before_discount",
            "unit_discount_percentage",
            "unit_price",
            "quantity",
            "discount_amount",
            "tax_amount",
            "amount_paid",
            "currency_code",
            "order_kind",
            "offer_source",
            "payment_method",
            "status",
            "fulfillment_status",
            "cash_collected_amount",
        }

        if expanded & trigger_fields:
            expanded |= calculated_fields
            expanded |= lifecycle_fields

        return expanded

    # --------------------------------------------------------
    # 🔹 Validation
    # --------------------------------------------------------
    def clean(self) -> None:
        super().clean()

        self._normalize_strings()

        if not self.customer_id:
            raise ValidationError("Customer is required.")

        if not self.product_id:
            raise ValidationError("Product is required.")

        if self.contract_product_id:
            if self.contract_product.product_id != self.product_id:
                raise ValidationError("Selected offer does not belong to the selected product.")

            if self.contract_product.contract_id and self.contract_id and self.contract_product.contract_id != self.contract_id:
                raise ValidationError("Selected offer does not belong to the selected contract.")

            if self.contract_product.contract_id and self.provider_id and self.contract_product.contract.provider_id != self.provider_id:
                raise ValidationError("Selected offer does not belong to the selected provider.")

            if not self.contract_product.is_currently_available and self.status not in {
                self.Status.DRAFT,
                self.Status.CANCELLED,
            }:
                raise ValidationError("Selected offer is not currently available.")

        if self.quantity <= 0:
            raise ValidationError("Quantity must be greater than zero.")

        if self.unit_price_before_discount < Decimal("0.00"):
            raise ValidationError("Unit price before discount cannot be negative.")

        if self.unit_discount_percentage < Decimal("0.00") or self.unit_discount_percentage > Decimal("100.00"):
            raise ValidationError("Unit discount percentage must be between 0 and 100.")

        if self.unit_price < Decimal("0.00"):
            raise ValidationError("Unit price cannot be negative.")

        if self.discount_amount < Decimal("0.00"):
            raise ValidationError("Discount amount cannot be negative.")

        if self.tax_amount < Decimal("0.00"):
            raise ValidationError("Tax amount cannot be negative.")

        if self.amount_paid < Decimal("0.00"):
            raise ValidationError("Amount paid cannot be negative.")

        if self.cash_collected_amount < Decimal("0.00"):
            raise ValidationError("Cash collected amount cannot be negative.")

        if self.amount_paid > self.total_amount and self.total_amount > Decimal("0.00"):
            raise ValidationError("Amount paid cannot exceed total amount.")

        if self.discount_amount > self.subtotal_amount and self.subtotal_amount > Decimal("0.00"):
            raise ValidationError("Discount amount cannot exceed subtotal amount.")

        if self.cash_collected_amount > self.total_amount and self.total_amount > Decimal("0.00"):
            raise ValidationError("Cash collected amount cannot exceed total amount.")

        if self.starts_at and self.ends_at and self.ends_at < self.starts_at:
            raise ValidationError("End date cannot be before start date.")

        if self.status == self.Status.CANCELLED and not self.cancellation_reason:
            raise ValidationError("Cancellation reason is required when order is cancelled.")

        if self.status == self.Status.ASSIGNED_FOR_DELIVERY and not self.delivery_agent_id:
            raise ValidationError("Delivery agent is required when order is assigned for delivery.")

        if self.status == self.Status.OUT_FOR_DELIVERY and not self.delivery_agent_id:
            raise ValidationError("Delivery agent is required before starting delivery.")

        if self.status == self.Status.DELIVERED and self.fulfillment_status != self.FulfillmentStatus.DELIVERED:
            raise ValidationError("Delivered orders must have delivered fulfillment status.")

        if self.status == self.Status.COMPLETED and self.fulfillment_status not in {
            self.FulfillmentStatus.ISSUED,
            self.FulfillmentStatus.DELIVERED,
        }:
            raise ValidationError("Completed orders must have completed fulfillment progress.")

        if self.is_cash_on_delivery and self.status in {self.Status.DELIVERED, self.Status.COMPLETED}:
            if self.payment_status != self.PaymentStatus.PAID:
                raise ValidationError("Cash on delivery orders must be paid before delivery/completion.")

            if self.cash_collected_amount <= Decimal("0.00"):
                raise ValidationError("Cash collected amount is required for delivered COD orders.")

        if self.fulfillment_status == self.FulfillmentStatus.ISSUED and not self.issued_at:
            raise ValidationError("Issued orders must have issued_at date.")

        product_status = getattr(self.product, "status", None)
        product_active_status = getattr(Product.Status, "ACTIVE", "active")

        if product_status != product_active_status and self.status not in {
            self.Status.DRAFT,
            self.Status.CANCELLED,
        }:
            raise ValidationError("Cannot place/keep an active order on an inactive product.")

        customer_status = getattr(self.customer, "status", None)
        customer_blocked_status = getattr(Customer.Status, "BLOCKED", "blocked")

        if customer_status == customer_blocked_status:
            raise ValidationError("Cannot create order for a blocked customer.")

    # --------------------------------------------------------
    # 🔹 Save Logic
    # --------------------------------------------------------
    def save(self, *args, **kwargs):
        self._sync_relations_from_contract_product()
        self._sync_product_snapshot()
        self._sync_offer_snapshot()
        self._recalculate_amounts()
        self._sync_payment_status()
        self._sync_lifecycle_timestamps()

        update_fields = kwargs.get("update_fields")
        if update_fields is not None:
            kwargs["update_fields"] = self._expand_update_fields(update_fields)

        self.full_clean()
        is_new = self.pk is None

        with transaction.atomic():
            super().save(*args, **kwargs)

            if is_new and not self.order_number:
                self.order_number = self._generate_order_number()
                super().save(update_fields=["order_number"])


# ============================================================
# 🧩 Order Timeline
# ============================================================

class OrderTimeline(models.Model):
    class EventType(models.TextChoices):
        CREATED = "created", "Created"
        UPDATED = "updated", "Updated"
        CONFIRMED = "confirmed", "Confirmed"
        CARD_PRINTED = "card_printed", "Card Printed"
        CARD_READY = "card_ready", "Card Ready"
        DELIVERY_ASSIGNED = "delivery_assigned", "Delivery Assigned"
        OUT_FOR_DELIVERY = "out_for_delivery", "Out for Delivery"
        DELIVERED = "delivered", "Delivered"
        CASH_COLLECTED = "cash_collected", "Cash Collected"
        PAYMENT_UPDATED = "payment_updated", "Payment Updated"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"
        REFUNDED = "refunded", "Refunded"
        NOTE = "note", "Note"
        SYSTEM = "system", "System"

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="timeline",
        verbose_name="Order",
    )

    event_type = models.CharField(
        max_length=40,
        choices=EventType.choices,
        default=EventType.UPDATED,
        db_index=True,
        verbose_name="Event Type",
    )

    from_status = models.CharField(
        max_length=30,
        blank=True,
        verbose_name="From Order Status",
    )

    to_status = models.CharField(
        max_length=30,
        blank=True,
        verbose_name="To Order Status",
    )

    from_payment_status = models.CharField(
        max_length=30,
        blank=True,
        verbose_name="From Payment Status",
    )

    to_payment_status = models.CharField(
        max_length=30,
        blank=True,
        verbose_name="To Payment Status",
    )

    from_fulfillment_status = models.CharField(
        max_length=30,
        blank=True,
        verbose_name="From Fulfillment Status",
    )

    to_fulfillment_status = models.CharField(
        max_length=30,
        blank=True,
        verbose_name="To Fulfillment Status",
    )

    title = models.CharField(
        max_length=180,
        verbose_name="Title",
    )

    description = models.TextField(
        blank=True,
        verbose_name="Description",
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Amount",
    )

    agent = models.ForeignKey(
        "agents.Agent",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_timeline_sales_events",
        verbose_name="Sales Agent",
    )

    delivery_agent = models.ForeignKey(
        "agents.Agent",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_timeline_delivery_events",
        verbose_name="Delivery Agent",
    )

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_timeline_events",
        verbose_name="Actor",
    )

    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Metadata",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="Created At",
    )

    class Meta:
        verbose_name = "Order Timeline"
        verbose_name_plural = "Order Timeline"
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["order", "created_at"]),
            models.Index(fields=["event_type", "created_at"]),
            models.Index(fields=["to_status", "created_at"]),
            models.Index(fields=["to_payment_status", "created_at"]),
            models.Index(fields=["to_fulfillment_status", "created_at"]),
            models.Index(fields=["actor", "created_at"]),
            models.Index(fields=["agent", "created_at"]),
            models.Index(fields=["delivery_agent", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.order.order_number} | {self.event_type} | {self.title}"


# ============================================================
# 🧩 Order Status History
# ------------------------------------------------------------
# موجود للتوافق مع الكود السابق.
# الاعتماد التشغيلي الجديد يكون على OrderTimeline.
# ============================================================

class OrderStatusHistory(models.Model):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="status_history",
        verbose_name="Order",
    )

    from_status = models.CharField(
        max_length=30,
        blank=True,
        verbose_name="From Status",
    )

    to_status = models.CharField(
        max_length=30,
        verbose_name="To Status",
    )

    note = models.TextField(
        blank=True,
        verbose_name="Note",
    )

    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_status_changes",
        verbose_name="Changed By",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="Created At",
    )

    class Meta:
        verbose_name = "Order Status History"
        verbose_name_plural = "Order Status History"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["order", "created_at"]),
            models.Index(fields=["to_status", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.order.order_number} | {self.from_status} -> {self.to_status}"