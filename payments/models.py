# ============================================================
# 📂 payments/models.py
# 🧠 Primey Care | Payments Module
# ------------------------------------------------------------
# ✅ هذا الموديول يمثل طبقة التحصيل المالي
# ✅ يربط عملية الدفع مع:
#    - الطلب
#    - العميل
# ✅ يحتفظ بحالة الدفع ومراجع المزود وطرق الدفع
# ✅ جاهز لاحقًا للربط مع:
#    - الفواتير
#    - الاسترداد
#    - التسويات
#    - القيود المحاسبية
# ============================================================

from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models

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

    # ========================================================
    # 🆔 بيانات الدفع
    # ========================================================
    payment_number = models.CharField(
        max_length=100,
        unique=True,
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
            models.Index(fields=["payment_number"]),
            models.Index(fields=["status"]),
            models.Index(fields=["payment_method"]),
            models.Index(fields=["provider"]),
            models.Index(fields=["paid_at"]),
        ]

    def __str__(self):
        return f"{self.payment_number} - {self.customer}"

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

        if self.paid_amount > self.amount:
            raise ValidationError(
                {"paid_amount": "المبلغ المدفوع لا يمكن أن يكون أكبر من مبلغ العملية."}
            )

        if self.refunded_amount > self.paid_amount:
            raise ValidationError(
                {"refunded_amount": "المبلغ المسترد لا يمكن أن يكون أكبر من المبلغ المدفوع."}
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        self._sync_status()
        super().save(*args, **kwargs)

    def _sync_status(self):
        amount = Decimal(self.amount or Decimal("0.00"))
        paid_amount = Decimal(self.paid_amount or Decimal("0.00"))
        refunded_amount = Decimal(self.refunded_amount or Decimal("0.00"))

        # --------------------------------------------
        # حالات الاسترداد
        # --------------------------------------------
        if paid_amount > 0 and refunded_amount > 0:
            if refunded_amount == paid_amount:
                self.status = PaymentStatus.REFUNDED
                return
            elif refunded_amount < paid_amount:
                self.status = PaymentStatus.PARTIALLY_REFUNDED
                return

        # --------------------------------------------
        # حالات السداد
        # --------------------------------------------
        if paid_amount == Decimal("0.00"):
            if self.status not in {
                PaymentStatus.FAILED,
                PaymentStatus.CANCELLED,
                PaymentStatus.PROCESSING,
            }:
                self.status = PaymentStatus.PENDING
            return

        if paid_amount < amount:
            self.status = PaymentStatus.PARTIALLY_PAID
            return

        if paid_amount >= amount and amount > Decimal("0.00"):
            self.status = PaymentStatus.PAID
            return