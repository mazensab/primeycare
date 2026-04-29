# ============================================================
# 📂 invoices/models.py
# 🧠 Primey Care | Invoices Module
# ------------------------------------------------------------
# ✅ طبقة الفواتير الرسمية
# ✅ ربط الفاتورة مع الطلب والعميل وعناصر الطلب والمدفوعات
# ✅ احتساب الإجماليات والضريبة والمتبقي
# ✅ دعم دورة الحالات: DRAFT / ISSUED / PARTIALLY_PAID / PAID
# ✅ جاهز للربط مع:
#    - Web PDF
#    - الإشعارات
#    - القيود المحاسبية
#    - التسويات
# ============================================================

from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from customers.models import Customer
from order_items.models import OrderItem
from orders.models import Order
from payments.models import Payment


MONEY_ZERO = Decimal("0.00")
MONEY_QUANT = Decimal("0.01")


def money(value) -> Decimal:
    try:
        return Decimal(str(value or MONEY_ZERO)).quantize(
            MONEY_QUANT,
            rounding=ROUND_HALF_UP,
        )
    except Exception:
        return MONEY_ZERO


class InvoiceStatus(models.TextChoices):
    DRAFT = "DRAFT", "مسودة"
    ISSUED = "ISSUED", "مصدرة"
    PARTIALLY_PAID = "PARTIALLY_PAID", "مدفوعة جزئيًا"
    PAID = "PAID", "مدفوعة"
    OVERDUE = "OVERDUE", "متأخرة"
    CANCELLED = "CANCELLED", "ملغاة"
    REFUNDED = "REFUNDED", "مستردة"


class InvoiceType(models.TextChoices):
    SALES = "SALES", "فاتورة مبيعات"
    TAX = "TAX", "فاتورة ضريبية"
    SIMPLIFIED = "SIMPLIFIED", "فاتورة مبسطة"
    CREDIT_NOTE = "CREDIT_NOTE", "إشعار دائن"
    DEBIT_NOTE = "DEBIT_NOTE", "إشعار مدين"


class Invoice(models.Model):
    # ========================================================
    # 🔗 الربط الأساسي
    # ========================================================
    order = models.OneToOneField(
        Order,
        on_delete=models.CASCADE,
        related_name="invoice",
        verbose_name="الطلب",
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="invoices",
        verbose_name="العميل",
    )

    # ========================================================
    # 🆔 بيانات الفاتورة
    # ========================================================
    invoice_number = models.CharField(
        max_length=100,
        unique=True,
        verbose_name="رقم الفاتورة",
        help_text="رقم مرجعي داخلي فريد للفاتورة",
    )
    invoice_type = models.CharField(
        max_length=20,
        choices=InvoiceType.choices,
        default=InvoiceType.SALES,
        verbose_name="نوع الفاتورة",
    )
    status = models.CharField(
        max_length=20,
        choices=InvoiceStatus.choices,
        default=InvoiceStatus.DRAFT,
        verbose_name="حالة الفاتورة",
    )

    # ========================================================
    # 📅 التواريخ
    # ========================================================
    issue_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="تاريخ الإصدار",
    )
    due_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="تاريخ الاستحقاق",
    )

    # ========================================================
    # 💰 البيانات المالية
    # ========================================================
    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=MONEY_ZERO,
        verbose_name="الإجمالي قبل الخصم والضريبة",
    )
    discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=MONEY_ZERO,
        verbose_name="إجمالي الخصم",
    )
    taxable_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=MONEY_ZERO,
        verbose_name="المبلغ الخاضع للضريبة",
    )
    tax_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("15.00"),
        verbose_name="نسبة الضريبة",
    )
    tax_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=MONEY_ZERO,
        verbose_name="قيمة الضريبة",
    )
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=MONEY_ZERO,
        verbose_name="الإجمالي النهائي",
    )
    paid_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=MONEY_ZERO,
        verbose_name="المبلغ المدفوع",
    )
    due_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=MONEY_ZERO,
        verbose_name="المبلغ المتبقي",
    )
    currency = models.CharField(
        max_length=10,
        default="SAR",
        verbose_name="العملة",
    )

    # ========================================================
    # 📝 ملاحظات
    # ========================================================
    notes = models.TextField(
        blank=True,
        verbose_name="ملاحظات",
    )
    internal_notes = models.TextField(
        blank=True,
        verbose_name="ملاحظات داخلية",
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
        db_table = "invoices"
        verbose_name = "فاتورة"
        verbose_name_plural = "الفواتير"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["invoice_number"]),
            models.Index(fields=["order"]),
            models.Index(fields=["customer"]),
            models.Index(fields=["status"]),
            models.Index(fields=["invoice_type"]),
            models.Index(fields=["issue_date"]),
            models.Index(fields=["due_date"]),
        ]

    def __str__(self):
        return f"{self.invoice_number} - {self.customer}"

    @property
    def is_editable(self) -> bool:
        return self.status == InvoiceStatus.DRAFT

    @property
    def is_issued(self) -> bool:
        return self.status in {
            InvoiceStatus.ISSUED,
            InvoiceStatus.PARTIALLY_PAID,
            InvoiceStatus.PAID,
        }

    @property
    def is_paid(self) -> bool:
        return self.status == InvoiceStatus.PAID

    @property
    def is_cancelled(self) -> bool:
        return self.status == InvoiceStatus.CANCELLED

    def clean(self):
        super().clean()

        if self.order_id and self.customer_id:
            order_customer_id = getattr(self.order, "customer_id", None)
            if order_customer_id and order_customer_id != self.customer_id:
                raise ValidationError(
                    {"customer": "العميل المحدد لا يطابق العميل المرتبط بالطلب."}
                )

        money_fields = [
            "subtotal",
            "discount_amount",
            "taxable_amount",
            "tax_amount",
            "total_amount",
            "paid_amount",
            "due_amount",
        ]

        for field_name in money_fields:
            value = getattr(self, field_name)
            if value is not None and value < 0:
                raise ValidationError({field_name: "القيمة لا يمكن أن تكون سالبة."})

        if self.tax_rate is not None and (self.tax_rate < 0 or self.tax_rate > 100):
            raise ValidationError({"tax_rate": "نسبة الضريبة يجب أن تكون بين 0 و 100."})

        if self.due_date and self.issue_date and self.due_date < self.issue_date:
            raise ValidationError(
                {"due_date": "تاريخ الاستحقاق يجب أن يكون بعد أو مساويًا لتاريخ الإصدار."}
            )

        if self.paid_amount > self.total_amount:
            raise ValidationError(
                {"paid_amount": "المبلغ المدفوع لا يمكن أن يكون أكبر من إجمالي الفاتورة."}
            )

        if self.status == InvoiceStatus.CANCELLED and self.paid_amount > MONEY_ZERO:
            raise ValidationError(
                {"status": "لا يمكن إلغاء فاتورة عليها مبالغ مدفوعة. استخدم آلية الاسترداد أو التسوية."}
            )

    def save(self, *args, **kwargs):
        self.recalculate_totals()
        self.refresh_payment_snapshot()
        self.sync_status()
        self.full_clean()
        super().save(*args, **kwargs)

    def recalculate_totals(self):
        """
        احتساب إجماليات الفاتورة من عناصر الطلب.
        ملاحظة:
        - عناصر الفاتورة للاحتفاظ بلقطة العرض.
        - المصدر المالي الأساسي هنا هو عناصر الطلب حتى لا يحدث اختلاف بين الطلب والفاتورة.
        """
        if not self.order_id:
            return

        subtotal = MONEY_ZERO
        discount_total = MONEY_ZERO

        items_qs = self.order.items.all()

        for item in items_qs:
            quantity = Decimal(str(getattr(item, "quantity", 1) or 1))
            unit_price = money(getattr(item, "unit_price", MONEY_ZERO))
            total_amount = money(getattr(item, "total_amount", MONEY_ZERO))

            line_subtotal = money(unit_price * quantity)
            line_discount = money(line_subtotal - total_amount)

            if line_discount < MONEY_ZERO:
                line_discount = MONEY_ZERO

            subtotal += line_subtotal
            discount_total += line_discount

        taxable_amount = money(subtotal - discount_total)
        if taxable_amount < MONEY_ZERO:
            taxable_amount = MONEY_ZERO

        tax_rate = Decimal(str(self.tax_rate or MONEY_ZERO))
        tax_amount = money(taxable_amount * tax_rate / Decimal("100"))
        total_amount = money(taxable_amount + tax_amount)

        self.subtotal = money(subtotal)
        self.discount_amount = money(discount_total)
        self.taxable_amount = money(taxable_amount)
        self.tax_amount = money(tax_amount)
        self.total_amount = money(total_amount)

    def refresh_payment_snapshot(self):
        if not self.order_id:
            self.paid_amount = MONEY_ZERO
            self.due_amount = money(self.total_amount)
            return

        payments_total = (
            self.order.payments.aggregate(total=models.Sum("paid_amount")).get("total")
            or MONEY_ZERO
        )

        self.paid_amount = money(payments_total)

        due_amount = money(self.total_amount - self.paid_amount)
        if due_amount < MONEY_ZERO:
            due_amount = MONEY_ZERO

        self.due_amount = money(due_amount)

    def sync_status(self):
        """
        مزامنة الحالة المالية بدون تحويل المسودة إلى مصدرة تلقائيًا.
        الإصدار الرسمي يتم من services.issue_invoice.
        """
        if self.status in {
            InvoiceStatus.CANCELLED,
            InvoiceStatus.REFUNDED,
        }:
            return

        total = money(self.total_amount)
        paid = money(self.paid_amount)

        if self.status == InvoiceStatus.DRAFT:
            return

        if total <= MONEY_ZERO:
            return

        if paid <= MONEY_ZERO:
            self.status = InvoiceStatus.ISSUED
            return

        if paid < total:
            self.status = InvoiceStatus.PARTIALLY_PAID
            return

        if paid >= total:
            self.status = InvoiceStatus.PAID
            return

    def mark_issued(self):
        if self.status == InvoiceStatus.CANCELLED:
            raise ValidationError("لا يمكن إصدار فاتورة ملغاة.")

        if self.total_amount <= MONEY_ZERO:
            self.recalculate_totals()

        if self.total_amount <= MONEY_ZERO:
            raise ValidationError("لا يمكن إصدار فاتورة بإجمالي صفر أو أقل.")

        self.status = InvoiceStatus.ISSUED
        if not self.issue_date:
            self.issue_date = timezone.localdate()

    def cancel(self):
        if self.paid_amount > MONEY_ZERO:
            raise ValidationError("لا يمكن إلغاء فاتورة عليها مبلغ مدفوع.")

        if self.status == InvoiceStatus.PAID:
            raise ValidationError("لا يمكن إلغاء فاتورة مدفوعة.")

        self.status = InvoiceStatus.CANCELLED


class InvoiceItem(models.Model):
    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name="items",
        verbose_name="الفاتورة",
    )
    order_item = models.ForeignKey(
        OrderItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invoice_items",
        verbose_name="عنصر الطلب",
    )

    title = models.CharField(
        max_length=255,
        verbose_name="الوصف",
    )
    quantity = models.PositiveIntegerField(
        default=1,
        verbose_name="الكمية",
    )
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=MONEY_ZERO,
        verbose_name="سعر الوحدة",
    )
    discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=MONEY_ZERO,
        verbose_name="الخصم",
    )
    line_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=MONEY_ZERO,
        verbose_name="الإجمالي",
    )
    sort_order = models.PositiveIntegerField(
        default=0,
        verbose_name="ترتيب العرض",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="تاريخ الإنشاء",
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="آخر تحديث",
    )

    class Meta:
        db_table = "invoice_items"
        verbose_name = "عنصر فاتورة"
        verbose_name_plural = "عناصر الفواتير"
        ordering = ["sort_order", "id"]
        indexes = [
            models.Index(fields=["invoice"]),
            models.Index(fields=["order_item"]),
            models.Index(fields=["sort_order"]),
        ]

    def __str__(self):
        return f"{self.title} - {self.invoice.invoice_number}"

    def clean(self):
        super().clean()

        if self.quantity < 1:
            raise ValidationError({"quantity": "الكمية يجب أن تكون أكبر من أو تساوي 1."})

        for field_name in ["unit_price", "discount_amount", "line_total"]:
            value = getattr(self, field_name)
            if value is not None and value < 0:
                raise ValidationError({field_name: "القيمة لا يمكن أن تكون سالبة."})

        if self.order_item_id and self.invoice_id:
            if self.order_item.order_id != self.invoice.order_id:
                raise ValidationError(
                    {"order_item": "عنصر الطلب المحدد لا ينتمي إلى نفس الطلب المرتبط بالفاتورة."}
                )

    def save(self, *args, **kwargs):
        self.recalculate_line_total()
        self.full_clean()
        super().save(*args, **kwargs)

    def recalculate_line_total(self):
        quantity = Decimal(str(self.quantity or 1))
        unit_price = money(self.unit_price)
        discount_amount = money(self.discount_amount)

        total = money((unit_price * quantity) - discount_amount)
        if total < MONEY_ZERO:
            total = MONEY_ZERO

        self.line_total = money(total)


class InvoicePayment(models.Model):
    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name="invoice_payments",
        verbose_name="الفاتورة",
    )
    payment = models.ForeignKey(
        Payment,
        on_delete=models.CASCADE,
        related_name="invoice_links",
        verbose_name="الدفعة",
    )
    amount_applied = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=MONEY_ZERO,
        verbose_name="المبلغ المربوط",
    )
    applied_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="تاريخ الربط",
    )
    notes = models.TextField(
        blank=True,
        verbose_name="ملاحظات",
    )

    class Meta:
        db_table = "invoice_payments"
        verbose_name = "دفعة فاتورة"
        verbose_name_plural = "دفعات الفواتير"
        unique_together = ("invoice", "payment")
        indexes = [
            models.Index(fields=["invoice"]),
            models.Index(fields=["payment"]),
            models.Index(fields=["applied_at"]),
        ]

    def __str__(self):
        return f"{self.invoice.invoice_number} - {self.payment.payment_number}"

    def clean(self):
        super().clean()

        if self.amount_applied is not None and self.amount_applied < 0:
            raise ValidationError(
                {"amount_applied": "المبلغ المربوط لا يمكن أن يكون سالبًا."}
            )

        if self.invoice_id and self.payment_id:
            if self.payment.order_id != self.invoice.order_id:
                raise ValidationError(
                    {"payment": "الدفعة المحددة لا تنتمي إلى نفس الطلب المرتبط بالفاتورة."}
                )

        if self.payment_id and self.amount_applied > self.payment.paid_amount:
            raise ValidationError(
                {"amount_applied": "المبلغ المربوط لا يمكن أن يكون أكبر من المبلغ المدفوع."}
            )

    def save(self, *args, **kwargs):
        self.amount_applied = money(self.amount_applied)
        self.full_clean()
        super().save(*args, **kwargs)

        invoice = self.invoice
        invoice.refresh_payment_snapshot()
        invoice.sync_status()
        invoice.save(
            update_fields=[
                "paid_amount",
                "due_amount",
                "status",
                "updated_at",
            ]
        )