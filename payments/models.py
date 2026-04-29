# ============================================================
# 📂 payments/models.py
# 🧠 Primey Care | Payments Module
# ------------------------------------------------------------
# ✅ طبقة التحصيل المالي الرسمية
# ✅ ربط الدفع مع:
#    - الطلب
#    - العميل
#    - الفاتورة
# ✅ جاهز للربط مع:
#    - الخزينة
#    - المحاسبة
#    - بوابات الدفع
#    - الاسترداد
# ✅ منع القيم السالبة وعدم تطابق العميل/الطلب/الفاتورة
# ✅ توليد رقم دفع تلقائي عند عدم تمريره
# ============================================================

from __future__ import annotations

from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from customers.models import Customer
from orders.models import Order


class PaymentMethod(models.TextChoices):
    CASH = "CASH", "نقدي"
    BANK_TRANSFER = "BANK_TRANSFER", "تحويل بنكي"
    CREDIT_CARD = "CREDIT_CARD", "بطاقة ائتمانية"
    DEBIT_CARD = "DEBIT_CARD", "بطاقة مدى / خصم"
    WALLET = "WALLET", "محفظة"
    APPLE_PAY = "APPLE_PAY", "Apple Pay"
    STC_PAY = "STC_PAY", "STC Pay"
    TAMARA = "TAMARA", "تمارا"
    TABBY = "TABBY", "تابي"
    GATEWAY = "GATEWAY", "بوابة دفع"
    OTHER = "OTHER", "أخرى"


class PaymentStatus(models.TextChoices):
    PENDING = "PENDING", "قيد الانتظار"
    PROCESSING = "PROCESSING", "قيد المعالجة"
    PAID = "PAID", "مدفوع"
    PARTIALLY_PAID = "PARTIALLY_PAID", "مدفوع جزئيًا"
    FAILED = "FAILED", "فشل"
    CANCELLED = "CANCELLED", "ملغي"
    REFUNDED = "REFUNDED", "مسترد"
    PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED", "مسترد جزئيًا"


class PaymentProvider(models.TextChoices):
    INTERNAL = "INTERNAL", "داخلي"
    TAP = "TAP", "Tap"
    TAMARA = "TAMARA", "Tamara"
    TABBY = "TABBY", "Tabby"
    MANUAL = "MANUAL", "يدوي"
    BANK = "BANK", "بنك"
    OTHER = "OTHER", "أخرى"


class Payment(models.Model):
    # ========================================================
    # 🔗 الربط الأساسي
    # ========================================================
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="payments",
        verbose_name="الطلب",
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="payments",
        verbose_name="العميل",
    )
    invoice = models.ForeignKey(
        "invoices.Invoice",
        on_delete=models.PROTECT,
        related_name="payments",
        null=True,
        blank=True,
        verbose_name="الفاتورة",
        help_text="الفاتورة المرتبطة بعملية الدفع إن وجدت.",
    )

    # ========================================================
    # 🆔 بيانات الدفع
    # ========================================================
    payment_number = models.CharField(
        max_length=100,
        unique=True,
        blank=True,
        verbose_name="رقم الدفع",
        help_text="رقم مرجعي داخلي فريد لعملية الدفع",
    )
    status = models.CharField(
        max_length=30,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
        verbose_name="حالة الدفع",
    )
    payment_method = models.CharField(
        max_length=30,
        choices=PaymentMethod.choices,
        default=PaymentMethod.CASH,
        verbose_name="طريقة الدفع",
    )
    provider = models.CharField(
        max_length=20,
        choices=PaymentProvider.choices,
        default=PaymentProvider.INTERNAL,
        verbose_name="مزود الدفع",
    )

    # ========================================================
    # 💰 البيانات المالية
    # ========================================================
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="المبلغ",
    )
    paid_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="المبلغ المدفوع",
    )
    refunded_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="المبلغ المسترد",
    )
    currency = models.CharField(
        max_length=10,
        default="SAR",
        verbose_name="العملة",
    )

    # ========================================================
    # 🏦 مراجع الخزينة والمحاسبة
    # ========================================================
    treasury_movement_reference = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="مرجع حركة الخزينة",
        help_text="مرجع اختياري لحركة الخزينة المرتبطة بالدفع.",
    )
    accounting_entry_reference = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="مرجع القيد المحاسبي",
        help_text="مرجع اختياري للقيد المحاسبي المرتبط بالدفع.",
    )
    is_treasury_posted = models.BooleanField(
        default=False,
        verbose_name="تم ترحيل الخزينة",
    )
    is_accounting_posted = models.BooleanField(
        default=False,
        verbose_name="تم ترحيل المحاسبة",
    )

    # ========================================================
    # 🔖 المراجع الخارجية
    # ========================================================
    external_reference = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="مرجع خارجي",
        help_text="رقم العملية لدى مزود الدفع أو البنك",
    )
    transaction_id = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Transaction ID",
    )
    gateway_response_code = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="Gateway Code",
    )
    gateway_message = models.TextField(
        blank=True,
        verbose_name="رسالة البوابة",
    )

    # ========================================================
    # 📝 ملاحظات تشغيلية
    # ========================================================
    notes = models.TextField(
        blank=True,
        verbose_name="ملاحظات",
    )
    failure_reason = models.TextField(
        blank=True,
        verbose_name="سبب الفشل",
    )

    # ========================================================
    # 📅 التواريخ
    # ========================================================
    initiated_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="وقت بدء الدفع",
    )
    paid_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="وقت السداد",
    )
    refunded_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="وقت الاسترداد",
    )
    cancelled_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="وقت الإلغاء",
    )

    # ========================================================
    # 🕒 التتبع
    # ========================================================
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="تاريخ الإنشاء",
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="آخر تحديث",
    )

    class Meta:
        db_table = "payments"
        verbose_name = "دفعة"
        verbose_name_plural = "المدفوعات"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["order"]),
            models.Index(fields=["customer"]),
            models.Index(fields=["invoice"]),
            models.Index(fields=["payment_number"]),
            models.Index(fields=["status"]),
            models.Index(fields=["payment_method"]),
            models.Index(fields=["provider"]),
            models.Index(fields=["paid_at"]),
            models.Index(fields=["is_treasury_posted"]),
            models.Index(fields=["is_accounting_posted"]),
        ]

    def __str__(self):
        return f"{self.payment_number} - {self.customer}"

    @property
    def is_paid(self) -> bool:
        return self.status == PaymentStatus.PAID

    @property
    def is_confirmed(self) -> bool:
        return self.status in {
            PaymentStatus.PAID,
            PaymentStatus.PARTIALLY_PAID,
        }

    @property
    def remaining_amount(self) -> Decimal:
        amount = Decimal(self.amount or Decimal("0.00"))
        paid_amount = Decimal(self.paid_amount or Decimal("0.00"))
        remaining = amount - paid_amount
        return remaining if remaining > Decimal("0.00") else Decimal("0.00")

    @property
    def net_collected_amount(self) -> Decimal:
        paid_amount = Decimal(self.paid_amount or Decimal("0.00"))
        refunded_amount = Decimal(self.refunded_amount or Decimal("0.00"))
        net = paid_amount - refunded_amount
        return net if net > Decimal("0.00") else Decimal("0.00")

    def clean(self):
        super().clean()

        money_fields = ["amount", "paid_amount", "refunded_amount"]
        for field_name in money_fields:
            value = getattr(self, field_name)
            if value is not None and value < 0:
                raise ValidationError({field_name: "القيمة لا يمكن أن تكون سالبة."})

        if self.order_id and self.customer_id:
            order_customer_id = getattr(self.order, "customer_id", None)
            if order_customer_id and order_customer_id != self.customer_id:
                raise ValidationError(
                    {"customer": "العميل المحدد لا يطابق العميل المرتبط بالطلب."}
                )

        if self.invoice_id:
            invoice_customer_id = getattr(self.invoice, "customer_id", None)
            invoice_order_id = getattr(self.invoice, "order_id", None)

            if invoice_customer_id and self.customer_id and invoice_customer_id != self.customer_id:
                raise ValidationError(
                    {"invoice": "الفاتورة المحددة لا تتبع نفس العميل المرتبط بالدفع."}
                )

            if invoice_order_id and self.order_id and invoice_order_id != self.order_id:
                raise ValidationError(
                    {"invoice": "الفاتورة المحددة لا تتبع نفس الطلب المرتبط بالدفع."}
                )

        if self.paid_amount > self.amount:
            raise ValidationError(
                {"paid_amount": "المبلغ المدفوع لا يمكن أن يكون أكبر من مبلغ العملية."}
            )

        if self.refunded_amount > self.paid_amount:
            raise ValidationError(
                {"refunded_amount": "المبلغ المسترد لا يمكن أن يكون أكبر من المبلغ المدفوع."}
            )

        if self.status == PaymentStatus.PAID and self.paid_amount <= Decimal("0.00"):
            raise ValidationError(
                {"paid_amount": "لا يمكن جعل الدفعة مدفوعة بدون مبلغ مدفوع."}
            )

        if self.status == PaymentStatus.CANCELLED and self.paid_amount > Decimal("0.00"):
            raise ValidationError(
                {"status": "لا يمكن إلغاء دفعة تحتوي على مبلغ مدفوع. استخدم الاسترداد بدلًا من الإلغاء."}
            )

    def save(self, *args, **kwargs):
        if not self.payment_number:
            self.payment_number = self.generate_payment_number()

        self._sync_status()
        self.full_clean()
        super().save(*args, **kwargs)

    @classmethod
    def generate_payment_number(cls) -> str:
        today = timezone.localdate()
        prefix = f"PAY-{today:%Y%m%d}"

        last_payment = (
            cls.objects.filter(payment_number__startswith=prefix)
            .order_by("-id")
            .only("payment_number")
            .first()
        )

        next_serial = 1
        if last_payment and last_payment.payment_number:
            try:
                next_serial = int(last_payment.payment_number.split("-")[-1]) + 1
            except (TypeError, ValueError):
                next_serial = 1

        return f"{prefix}-{next_serial:05d}"

    def _sync_status(self):
        amount = Decimal(self.amount or Decimal("0.00"))
        paid_amount = Decimal(self.paid_amount or Decimal("0.00"))
        refunded_amount = Decimal(self.refunded_amount or Decimal("0.00"))

        if self.status in {
            PaymentStatus.FAILED,
            PaymentStatus.CANCELLED,
            PaymentStatus.PROCESSING,
        } and paid_amount == Decimal("0.00"):
            return

        # --------------------------------------------
        # حالات الاسترداد
        # --------------------------------------------
        if paid_amount > Decimal("0.00") and refunded_amount > Decimal("0.00"):
            if refunded_amount == paid_amount:
                self.status = PaymentStatus.REFUNDED
                return

            if refunded_amount < paid_amount:
                self.status = PaymentStatus.PARTIALLY_REFUNDED
                return

        # --------------------------------------------
        # حالات السداد
        # --------------------------------------------
        if paid_amount == Decimal("0.00"):
            self.status = PaymentStatus.PENDING
            return

        if amount > Decimal("0.00") and paid_amount < amount:
            self.status = PaymentStatus.PARTIALLY_PAID
            return

        if amount > Decimal("0.00") and paid_amount >= amount:
            self.status = PaymentStatus.PAID
            return