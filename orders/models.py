# ============================================================
# 📂 orders/models.py
# 🧭 Primey Care — Orders Module
# ------------------------------------------------------------
# ✅ يربط العميل بالمنتج
# ✅ يحفظ السعر وقت الطلب
# ✅ يدعم حالات الطلب والدفع
# ✅ جاهز للتوسع لاحقًا مع:
#    - المدفوعات
#    - الإصدار
#    - البطاقات
#    - البرامج
#    - الوكلاء والعمولات
# ============================================================

from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction

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
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"
        REFUNDED = "refunded", "Refunded"

    class PaymentStatus(models.TextChoices):
        UNPAID = "unpaid", "Unpaid"
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
        OTHER = "other", "Other"

    class FulfillmentStatus(models.TextChoices):
        NOT_STARTED = "not_started", "Not Started"
        IN_PROGRESS = "in_progress", "In Progress"
        ISSUED = "issued", "Issued"
        DELIVERED = "delivered", "Delivered"
        FAILED = "failed", "Failed"

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

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
        verbose_name="Order Status",
    )

    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.UNPAID,
        db_index=True,
        verbose_name="Payment Status",
    )

    fulfillment_status = models.CharField(
        max_length=20,
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
    # 🔹 Snapshot Fields
    # --------------------------------------------------------
    product_name = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Product Name Snapshot",
    )

    product_type = models.CharField(
        max_length=20,
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

    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Unit Price",
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
        help_text="Will be used later for card/program issuance reference.",
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
            models.Index(fields=["source"]),
            models.Index(fields=["customer", "created_at"]),
            models.Index(fields=["product", "created_at"]),
            models.Index(fields=["fulfillment_status"]),
            models.Index(fields=["currency_code"]),
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
    def can_be_cancelled(self) -> bool:
        return self.status not in {
            self.Status.CANCELLED,
            self.Status.REFUNDED,
            self.Status.COMPLETED,
        }

    # --------------------------------------------------------
    # 🔹 Internal Helpers
    # --------------------------------------------------------
    def _generate_order_number(self) -> str:
        if self.pk:
            return f"ORD-{self.pk:06d}"
        return ""

    def _resolve_unit_price(self) -> Decimal:
        if self.unit_price and self.unit_price > Decimal("0.00"):
            return self.unit_price
        return self.product.effective_price or Decimal("0.00")

    def _sync_product_snapshot(self) -> None:
        self.product_name = self.product.name
        self.product_type = self.product.product_type
        self.currency_code = self.product.currency_code or "SAR"

    def _recalculate_amounts(self) -> None:
        self.unit_price = self._resolve_unit_price()

        quantity = self.quantity or 1
        subtotal = self.unit_price * Decimal(quantity)
        discount = self.discount_amount or Decimal("0.00")
        tax = self.tax_amount or Decimal("0.00")
        total = subtotal - discount + tax

        if total < Decimal("0.00"):
            total = Decimal("0.00")

        self.subtotal_amount = subtotal
        self.total_amount = total

    def _sync_payment_status(self) -> None:
        total = self.total_amount or Decimal("0.00")
        paid = self.amount_paid or Decimal("0.00")

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

    # --------------------------------------------------------
    # 🔹 Validation
    # --------------------------------------------------------
    def clean(self) -> None:
        super().clean()

        self.customer_notes = (self.customer_notes or "").strip()
        self.internal_notes = (self.internal_notes or "").strip()
        self.cancellation_reason = (self.cancellation_reason or "").strip()
        self.issue_reference = (self.issue_reference or "").strip()
        self.currency_code = (self.currency_code or "SAR").strip().upper()

        if not self.customer_id:
            raise ValidationError("Customer is required.")

        if not self.product_id:
            raise ValidationError("Product is required.")

        if self.quantity <= 0:
            raise ValidationError("Quantity must be greater than zero.")

        if self.unit_price < Decimal("0.00"):
            raise ValidationError("Unit price cannot be negative.")

        if self.discount_amount < Decimal("0.00"):
            raise ValidationError("Discount amount cannot be negative.")

        if self.tax_amount < Decimal("0.00"):
            raise ValidationError("Tax amount cannot be negative.")

        if self.amount_paid < Decimal("0.00"):
            raise ValidationError("Amount paid cannot be negative.")

        if self.discount_amount > self.subtotal_amount and self.subtotal_amount > Decimal("0.00"):
            raise ValidationError("Discount amount cannot exceed subtotal amount.")

        if self.status == self.Status.CANCELLED and not self.cancellation_reason:
            raise ValidationError("Cancellation reason is required when order is cancelled.")

        if self.product.status != Product.Status.ACTIVE and self.status not in {
            self.Status.DRAFT,
            self.Status.CANCELLED,
        }:
            raise ValidationError("Cannot place/keep an active order on an inactive product.")

        if self.customer.status == Customer.Status.BLOCKED:
            raise ValidationError("Cannot create order for a blocked customer.")

    # --------------------------------------------------------
    # 🔹 Save Logic
    # --------------------------------------------------------
    def save(self, *args, **kwargs):
        self._sync_product_snapshot()
        self._recalculate_amounts()
        self._sync_payment_status()

        self.full_clean()
        is_new = self.pk is None

        with transaction.atomic():
            super().save(*args, **kwargs)

            if is_new and not self.order_number:
                self.order_number = self._generate_order_number()
                super().save(update_fields=["order_number"])


# ============================================================
# 🧩 Order Status History
# ============================================================

class OrderStatusHistory(models.Model):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="status_history",
        verbose_name="Order",
    )

    from_status = models.CharField(
        max_length=20,
        blank=True,
        verbose_name="From Status",
    )

    to_status = models.CharField(
        max_length=20,
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

    def __str__(self) -> str:
        return f"{self.order.order_number} | {self.from_status} -> {self.to_status}"