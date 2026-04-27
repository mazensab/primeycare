# ============================================================
# 📂 accounting/models.py
# 🧠 Primey Care | Accounting Module
# ------------------------------------------------------------
# ✅ هذا الموديول يمثل الأساس المحاسبي الحقيقي للنظام
# ✅ المرحلة الحالية تشمل:
#    - شجرة الحسابات
#    - القيود اليومية
#    - أسطر القيود
# ✅ جاهز لاحقًا للربط مع:
#    - الفواتير
#    - المدفوعات
#    - الصناديق
#    - البنوك
#    - التسويات
#    - التقارير المالية
# ============================================================

from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db import models


class AccountType(models.TextChoices):
    ASSET = "ASSET", "أصل"
    LIABILITY = "LIABILITY", "خصم"
    EQUITY = "EQUITY", "حقوق ملكية"
    REVENUE = "REVENUE", "إيراد"
    EXPENSE = "EXPENSE", "مصروف"


class AccountNature(models.TextChoices):
    DEBIT = "DEBIT", "مدين"
    CREDIT = "CREDIT", "دائن"


class JournalEntryStatus(models.TextChoices):
    DRAFT = "DRAFT", "مسودة"
    POSTED = "POSTED", "مرحل"
    CANCELLED = "CANCELLED", "ملغي"


class PostingSource(models.TextChoices):
    MANUAL = "MANUAL", "يدوي"
    ORDER = "ORDER", "طلب"
    PAYMENT = "PAYMENT", "دفعة"
    INVOICE = "INVOICE", "فاتورة"
    REFUND = "REFUND", "استرداد"
    ADJUSTMENT = "ADJUSTMENT", "تسوية"
    OTHER = "OTHER", "أخرى"


class Account(models.Model):
    # ========================================================
    # 🧾 البيانات الأساسية للحساب
    # ========================================================
    name = models.CharField(
        max_length=255,
        verbose_name="اسم الحساب",
    )
    code = models.CharField(
        max_length=50,
        unique=True,
        verbose_name="كود الحساب",
        help_text="كود فريد للحساب داخل دليل الحسابات",
    )
    account_type = models.CharField(
        max_length=20,
        choices=AccountType.choices,
        verbose_name="نوع الحساب",
    )
    nature = models.CharField(
        max_length=10,
        choices=AccountNature.choices,
        verbose_name="طبيعة الحساب",
        help_text="الطبيعة الافتراضية للحساب: مدين أو دائن",
    )

    # ========================================================
    # 🌳 الهيكل الشجري
    # ========================================================
    parent = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="children",
        verbose_name="الحساب الأب",
    )
    level = models.PositiveIntegerField(
        default=1,
        verbose_name="المستوى",
    )
    is_group = models.BooleanField(
        default=False,
        verbose_name="حساب تجميعي",
        help_text="إذا كان مفعّلًا فهذا الحساب للتجميع وليس للترحيل المباشر",
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="نشط",
    )

    # ========================================================
    # 📝 بيانات إضافية
    # ========================================================
    description = models.TextField(
        blank=True,
        verbose_name="الوصف",
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
        db_table = "accounting_accounts"
        verbose_name = "حساب"
        verbose_name_plural = "دليل الحسابات"
        ordering = ["code"]
        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["account_type"]),
            models.Index(fields=["nature"]),
            models.Index(fields=["parent"]),
            models.Index(fields=["is_group"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"

    def clean(self):
        super().clean()

        if self.parent_id:
            if self.parent_id == self.id:
                raise ValidationError({"parent": "لا يمكن أن يكون الحساب أبًا لنفسه."})

            if self.parent and not self.parent.is_group:
                raise ValidationError(
                    {"parent": "الحساب الأب يجب أن يكون حسابًا تجميعيًا."}
                )

            if self.parent:
                self.level = (self.parent.level or 1) + 1
        else:
            self.level = 1


class JournalEntry(models.Model):
    # ========================================================
    # 🧾 القيد اليومي
    # ========================================================
    entry_number = models.CharField(
        max_length=100,
        unique=True,
        verbose_name="رقم القيد",
        help_text="رقم مرجعي داخلي فريد للقيد",
    )
    entry_date = models.DateField(
        verbose_name="تاريخ القيد",
    )
    status = models.CharField(
        max_length=20,
        choices=JournalEntryStatus.choices,
        default=JournalEntryStatus.DRAFT,
        verbose_name="الحالة",
    )
    posting_source = models.CharField(
        max_length=20,
        choices=PostingSource.choices,
        default=PostingSource.MANUAL,
        verbose_name="مصدر القيد",
    )

    # ========================================================
    # 🔗 مرجع تشغيلي عام
    # ========================================================
    reference = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="مرجع",
        help_text="مثل رقم فاتورة أو دفعة أو طلب",
    )
    external_reference = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="مرجع خارجي",
    )

    # ========================================================
    # 💰 ملخص مالي
    # ========================================================
    total_debit = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="إجمالي المدين",
    )
    total_credit = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="إجمالي الدائن",
    )
    currency = models.CharField(
        max_length=10,
        default="SAR",
        verbose_name="العملة",
    )

    # ========================================================
    # 📝 ملاحظات
    # ========================================================
    description = models.TextField(
        blank=True,
        verbose_name="الوصف",
    )
    notes = models.TextField(
        blank=True,
        verbose_name="ملاحظات",
    )

    # ========================================================
    # 🕒 التتبع
    # ========================================================
    posted_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ الترحيل",
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
        db_table = "accounting_journal_entries"
        verbose_name = "قيد يومية"
        verbose_name_plural = "القيود اليومية"
        ordering = ["-entry_date", "-id"]
        indexes = [
            models.Index(fields=["entry_number"]),
            models.Index(fields=["entry_date"]),
            models.Index(fields=["status"]),
            models.Index(fields=["posting_source"]),
            models.Index(fields=["reference"]),
        ]

    def __str__(self):
        return f"{self.entry_number} - {self.entry_date}"

    def clean(self):
        super().clean()

        for field_name in ["total_debit", "total_credit"]:
            value = getattr(self, field_name)
            if value is not None and value < 0:
                raise ValidationError({field_name: "القيمة لا يمكن أن تكون سالبة."})

    def save(self, *args, **kwargs):
        self.full_clean()
        if self.pk:
            self._sync_totals_from_lines()
            self.full_clean()
        super().save(*args, **kwargs)

    def _sync_totals_from_lines(self):
        debit_total = Decimal("0.00")
        credit_total = Decimal("0.00")

        for line in self.lines.all():
            debit_total += Decimal(line.debit_amount or Decimal("0.00"))
            credit_total += Decimal(line.credit_amount or Decimal("0.00"))

        self.total_debit = debit_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        self.total_credit = credit_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    @property
    def is_balanced(self):
        return Decimal(self.total_debit or 0) == Decimal(self.total_credit or 0)


class JournalEntryLine(models.Model):
    # ========================================================
    # 🧾 سطر القيد
    # ========================================================
    journal_entry = models.ForeignKey(
        JournalEntry,
        on_delete=models.CASCADE,
        related_name="lines",
        verbose_name="القيد",
    )
    account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        related_name="journal_lines",
        verbose_name="الحساب",
    )

    description = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="الوصف",
    )
    debit_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="مدين",
    )
    credit_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="دائن",
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
        db_table = "accounting_journal_entry_lines"
        verbose_name = "سطر قيد"
        verbose_name_plural = "أسطر القيود"
        ordering = ["sort_order", "id"]
        indexes = [
            models.Index(fields=["journal_entry"]),
            models.Index(fields=["account"]),
            models.Index(fields=["sort_order"]),
        ]

    def __str__(self):
        return f"{self.journal_entry.entry_number} - {self.account.code}"

    def clean(self):
        super().clean()

        if self.account and self.account.is_group:
            raise ValidationError(
                {"account": "لا يمكن الترحيل على حساب تجميعي."}
            )

        if self.debit_amount < 0:
            raise ValidationError({"debit_amount": "القيمة لا يمكن أن تكون سالبة."})

        if self.credit_amount < 0:
            raise ValidationError({"credit_amount": "القيمة لا يمكن أن تكون سالبة."})

        debit = Decimal(self.debit_amount or Decimal("0.00"))
        credit = Decimal(self.credit_amount or Decimal("0.00"))

        if debit == Decimal("0.00") and credit == Decimal("0.00"):
            raise ValidationError(
                "يجب إدخال قيمة مدين أو دائن في سطر القيد."
            )

        if debit > Decimal("0.00") and credit > Decimal("0.00"):
            raise ValidationError(
                "لا يمكن أن يحتوي نفس السطر على قيمة مدين ودائن معًا."
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

        if self.journal_entry_id:
            self.journal_entry._sync_totals_from_lines()
            super(JournalEntry, self.journal_entry).save(update_fields=["total_debit", "total_credit", "updated_at"])