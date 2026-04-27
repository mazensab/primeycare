# ============================================================
# 📂 invoices/models.py
# 🧠 Primey Care | Invoices Module
# ------------------------------------------------------------
# ✅ هذا الموديول يمثل طبقة الفواتير
# ✅ يربط الفاتورة مع:
#    - الطلب
#    - العميل
#    - عناصر الطلب
#    - المدفوعات
# ✅ يحتفظ بلقطة مالية رسمية قابلة للتوسع
# ✅ جاهز لاحقًا للربط مع:
#    - PDF invoices
#    - الإشعارات
#    - القيود المحاسبية
#    - التسويات
# ============================================================

from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db import models

from customers.models import Customer
from order_items.models import OrderItem
from orders.models import Order
from payments.models import Payment


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
        default=Decimal("0.00"),
        verbose_name="الإجمالي قبل الخصم والضريبة",
    )
    discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="إجمالي الخصم",
    )
    taxable_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
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
        default=Decimal("0.00"),
        verbose_name="قيمة الضريبة",
    )
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="الإجمالي النهائي",
    )
    paid_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="المبلغ المدفوع",
    )
    due_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
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

    def save(self, *args, **kwargs):
        self.full_clean()
        self._recalculate_from_order()
        self._sync_payment_snapshot()
        self._sync_status()
        super().save(*args, **kwargs)

    def _recalculate_from_order(self):
        items = self.order.items.all()

        subtotal = Decimal("0.00")
        discount_total = Decimal("0.00")

        for item in items:
            line_subtotal = Decimal(item.unit_price or Decimal("0.00")) * Decimal(item.quantity or 1)
            line_net_total = Decimal(item.total_amount or Decimal("0.00"))
            line_discount = line_subtotal - line_net_total

            if line_discount < 0:
                line_discount = Decimal("0.00")

            subtotal += line_subtotal
            discount_total += line_discount

        taxable_amount = subtotal - discount_total
        if taxable_amount < 0:
            taxable_amount = Decimal("0.00")

        tax_rate = Decimal(self.tax_rate or Decimal("0.00"))
        tax_amount = (taxable_amount * tax_rate / Decimal("100")).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )
        total_amount = (taxable_amount + tax_amount).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )

        self.subtotal = subtotal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        self.discount_amount = discount_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        self.taxable_amount = taxable_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        self.tax_amount = tax_amount
        self.total_amount = total_amount

    def _sync_payment_snapshot(self):
        payments_total = (
            self.order.payments.aggregate(total=models.Sum("paid_amount")).get("total")
            or Decimal("0.00")
        )
        self.paid_amount = Decimal(payments_total).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )

        due_amount = Decimal(self.total_amount or Decimal("0.00")) - Decimal(self.paid_amount or Decimal("0.00"))
        if due_amount < 0:
            due_amount = Decimal("0.00")

        self.due_amount = due_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    def _sync_status(self):
        if self.status == InvoiceStatus.CANCELLED:
            return

        total = Decimal(self.total_amount or Decimal("0.00"))
        paid = Decimal(self.paid_amount or Decimal("0.00"))

        if paid <= Decimal("0.00"):
            if self.status != InvoiceStatus.DRAFT:
                self.status = InvoiceStatus.ISSUED
            return

        if paid < total:
            self.status = InvoiceStatus.PARTIALLY_PAID
            return

        if paid >= total and total > Decimal("0.00"):
            self.status = InvoiceStatus.PAID
            return


class InvoiceItem(models.Model):
    # ========================================================
    # 📦 عناصر الفاتورة
    # ========================================================
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
        default=Decimal("0.00"),
        verbose_name="سعر الوحدة",
    )
    discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="الخصم",
    )
    line_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
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

        if self.order_item_id and self.order_item.order_id != self.invoice.order_id:
            raise ValidationError(
                {"order_item": "عنصر الطلب المحدد لا ينتمي إلى نفس الطلب المرتبط بالفاتورة."}
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        self._recalculate_line_total()
        super().save(*args, **kwargs)

    def _recalculate_line_total(self):
        quantity = Decimal(self.quantity or 1)
        unit_price = Decimal(self.unit_price or Decimal("0.00"))
        discount_amount = Decimal(self.discount_amount or Decimal("0.00"))

        total = (unit_price * quantity) - discount_amount
        if total < 0:
            total = Decimal("0.00")

        self.line_total = total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class InvoicePayment(models.Model):
    # ========================================================
    # 💳 ربط المدفوعات بالفاتورة
    # ========================================================
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
        default=Decimal("0.00"),
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

        if self.payment.order_id != self.invoice.order_id:
            raise ValidationError(
                {"payment": "الدفعة المحددة لا تنتمي إلى نفس الطلب المرتبط بالفاتورة."}
            )

        if self.amount_applied > self.payment.paid_amount:
            raise ValidationError(
                {"amount_applied": "المبلغ المربوط لا يمكن أن يكون أكبر من المبلغ المدفوع."}
            )