# ============================================================
# 📂 accounting/models.py
# 🧠 Primey Care | Accounting Module
# ------------------------------------------------------------
# ✅ هذا الموديول يمثل الأساس المحاسبي الحقيقي للنظام
# ✅ يشمل:
#    - شجرة الحسابات
#    - القيود اليومية
#    - أسطر القيود
# ✅ جاهز للربط الفعلي مع:
#    - الفواتير
#    - المدفوعات
#    - الخزينة
#    - البنوك
#    - عمولات المندوبين
#    - التسويات
#    - التقارير المالية
# ------------------------------------------------------------
# ملاحظات مهمة:
# - لا يسمح بالترحيل على حساب تجميعي.
# - لا يسمح بالترحيل على حساب غير نشط.
# - لا يسمح بسطر قيد فيه مدين ودائن معًا.
# - لا يسمح بسطر قيد صفري.
# - إجماليات القيد تتحدث تلقائيًا عند إضافة/تعديل/حذف الأسطر.
# - يدعم مصادر ترحيل واضحة للربط مع النظام.
# ============================================================

from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


# ============================================================
# 🧾 الثوابت والاختيارات
# ============================================================

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
    OPENING_BALANCE = "OPENING_BALANCE", "رصيد افتتاحي"
    ORDER = "ORDER", "طلب"
    INVOICE = "INVOICE", "فاتورة"
    PAYMENT = "PAYMENT", "دفعة"
    REFUND = "REFUND", "استرداد"
    AGENT_COMMISSION = "AGENT_COMMISSION", "عمولة مندوب"
    TREASURY = "TREASURY", "خزينة"
    ADJUSTMENT = "ADJUSTMENT", "تسوية"
    OTHER = "OTHER", "أخرى"


# ============================================================
# 🛠️ Helpers
# ============================================================

def money(value) -> Decimal:
    """
    توحيد تقريب المبالغ داخل طبقة الموديل.
    """
    return Decimal(str(value or "0.00")).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )


# ============================================================
# 🌳 Account | دليل الحسابات
# ============================================================

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
            models.Index(fields=["account_type", "is_active"]),
            models.Index(fields=["parent", "is_active"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"

    # ========================================================
    # ✅ Validation
    # ========================================================

    def clean(self):
        super().clean()

        if not self.code:
            raise ValidationError({"code": "كود الحساب مطلوب."})

        self.code = str(self.code).strip()

        if not self.name:
            raise ValidationError({"name": "اسم الحساب مطلوب."})

        self.name = str(self.name).strip()

        if self.parent_id:
            if self.pk and self.parent_id == self.pk:
                raise ValidationError({"parent": "لا يمكن أن يكون الحساب أبًا لنفسه."})

            if self.parent and not self.parent.is_group:
                raise ValidationError(
                    {"parent": "الحساب الأب يجب أن يكون حسابًا تجميعيًا."}
                )

            if self.parent and self.parent.account_type != self.account_type:
                raise ValidationError(
                    {"parent": "نوع الحساب يجب أن يطابق نوع الحساب الأب."}
                )

            self._validate_no_parent_cycle()
            self.level = (self.parent.level or 1) + 1
        else:
            self.level = 1

    def _validate_no_parent_cycle(self):
        """
        منع تكوين دورة داخل شجرة الحسابات:
        مثال خطأ:
        A -> B -> C -> A
        """
        if not self.pk or not self.parent_id:
            return

        current_parent = self.parent
        visited_ids = set()

        while current_parent:
            if current_parent.pk in visited_ids:
                raise ValidationError({"parent": "يوجد تكرار غير صحيح داخل شجرة الحسابات."})

            if current_parent.pk == self.pk:
                raise ValidationError({"parent": "لا يمكن ربط الحساب بأحد فروعه."})

            visited_ids.add(current_parent.pk)
            current_parent = current_parent.parent

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    # ========================================================
    # Helpers
    # ========================================================

    @property
    def has_children(self) -> bool:
        if not self.pk:
            return False
        return self.children.exists()

    @property
    def can_post(self) -> bool:
        return bool(self.is_active and not self.is_group)


# ============================================================
# 🧾 JournalEntry | القيد اليومي
# ============================================================

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
        max_length=30,
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
            models.Index(fields=["external_reference"]),
            models.Index(fields=["status", "entry_date"]),
            models.Index(fields=["posting_source", "reference"]),
        ]

    def __str__(self):
        return f"{self.entry_number} - {self.entry_date}"

    # ========================================================
    # ✅ Validation
    # ========================================================

    def clean(self):
        super().clean()

        if not self.entry_number:
            raise ValidationError({"entry_number": "رقم القيد مطلوب."})

        self.entry_number = str(self.entry_number).strip()

        if not self.entry_date:
            raise ValidationError({"entry_date": "تاريخ القيد مطلوب."})

        self.currency = str(self.currency or "SAR").strip().upper()

        for field_name in ["total_debit", "total_credit"]:
            value = getattr(self, field_name)
            if value is not None and value < 0:
                raise ValidationError({field_name: "القيمة لا يمكن أن تكون سالبة."})

        self.total_debit = money(self.total_debit)
        self.total_credit = money(self.total_credit)

        if self.status == JournalEntryStatus.POSTED:
            if self.total_debit != self.total_credit:
                raise ValidationError("لا يمكن ترحيل قيد غير متوازن.")

            if self.total_debit <= Decimal("0.00"):
                raise ValidationError("لا يمكن ترحيل قيد بإجمالي صفري.")

            if not self.posted_at:
                self.posted_at = timezone.now()

        if self.status == JournalEntryStatus.CANCELLED and not self.notes:
            self.notes = "تم إلغاء القيد."

    def save(self, *args, **kwargs):
        if self.pk:
            self._sync_totals_from_lines()

        self.full_clean()
        super().save(*args, **kwargs)

    # ========================================================
    # 💰 Totals
    # ========================================================

    def _sync_totals_from_lines(self):
        """
        تحديث إجماليات القيد من الأسطر.
        """
        debit_total = Decimal("0.00")
        credit_total = Decimal("0.00")

        if not self.pk:
            self.total_debit = money(debit_total)
            self.total_credit = money(credit_total)
            return

        for line in self.lines.all():
            debit_total += money(line.debit_amount)
            credit_total += money(line.credit_amount)

        self.total_debit = money(debit_total)
        self.total_credit = money(credit_total)

    def refresh_totals(self, *, save: bool = True):
        """
        تحديث إجماليات القيد وحفظها.
        تستخدم بعد إنشاء/تعديل/حذف أسطر القيد.
        """
        if not self.pk:
            return

        self._sync_totals_from_lines()

        if save:
            super(JournalEntry, self).save(
                update_fields=[
                    "total_debit",
                    "total_credit",
                    "updated_at",
                ]
            )

    # ========================================================
    # 🚀 Posting Helpers
    # ========================================================

    def mark_as_posted(self):
        """
        ترحيل القيد بعد التأكد من توازنه.
        """
        self._sync_totals_from_lines()

        if not self.lines.exists():
            raise ValidationError("لا يمكن ترحيل قيد بدون أسطر.")

        if not self.is_balanced:
            raise ValidationError("لا يمكن ترحيل قيد غير متوازن.")

        if self.total_debit <= Decimal("0.00"):
            raise ValidationError("لا يمكن ترحيل قيد بإجمالي صفري.")

        self.status = JournalEntryStatus.POSTED
        self.posted_at = self.posted_at or timezone.now()
        self.save(
            update_fields=[
                "status",
                "posted_at",
                "total_debit",
                "total_credit",
                "updated_at",
            ]
        )

    def mark_as_cancelled(self, *, reason: str = ""):
        """
        إلغاء القيد.
        ملاحظة:
        الإلغاء هنا يغير الحالة فقط.
        عكس الأثر المحاسبي يجب أن يتم بقيد عكسي مستقل من services.
        """
        if self.status == JournalEntryStatus.CANCELLED:
            return

        self.status = JournalEntryStatus.CANCELLED

        if reason:
            self.notes = f"{self.notes}\nسبب الإلغاء: {reason}".strip()
        elif not self.notes:
            self.notes = "تم إلغاء القيد."

        self.save(
            update_fields=[
                "status",
                "notes",
                "updated_at",
            ]
        )

    # ========================================================
    # Properties
    # ========================================================

    @property
    def is_balanced(self) -> bool:
        return money(self.total_debit) == money(self.total_credit)

    @property
    def is_posted(self) -> bool:
        return self.status == JournalEntryStatus.POSTED

    @property
    def is_cancelled(self) -> bool:
        return self.status == JournalEntryStatus.CANCELLED

    @property
    def can_edit_lines(self) -> bool:
        """
        يسمح بتعديل الأسطر فقط للمسودة.
        القيود المرحلة أو الملغية لا تعدل من الواجهة.
        أما services الرسمية تستطيع بناء القيد قبل الترحيل.
        """
        return self.status == JournalEntryStatus.DRAFT


# ============================================================
# 🧾 JournalEntryLine | أسطر القيود
# ============================================================

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
        db_table = "accounting_journal_entry_lines"
        verbose_name = "سطر قيد"
        verbose_name_plural = "أسطر القيود"
        ordering = ["sort_order", "id"]
        indexes = [
            models.Index(fields=["journal_entry"]),
            models.Index(fields=["account"]),
            models.Index(fields=["sort_order"]),
            models.Index(fields=["journal_entry", "sort_order"]),
            models.Index(fields=["account", "created_at"]),
        ]

    def __str__(self):
        if self.journal_entry_id and self.account_id:
            return f"{self.journal_entry.entry_number} - {self.account.code}"
        return "سطر قيد"

    # ========================================================
    # ✅ Validation
    # ========================================================

    def clean(self):
        super().clean()

        if not self.journal_entry_id:
            raise ValidationError({"journal_entry": "القيد مطلوب."})

        if not self.account_id:
            raise ValidationError({"account": "الحساب مطلوب."})

        if self.journal_entry and self.journal_entry.status == JournalEntryStatus.CANCELLED:
            raise ValidationError("لا يمكن تعديل أو إضافة أسطر على قيد ملغي.")

        if self.account:
            if self.account.is_group:
                raise ValidationError(
                    {"account": "لا يمكن الترحيل على حساب تجميعي."}
                )

            if not self.account.is_active:
                raise ValidationError(
                    {"account": "لا يمكن الترحيل على حساب غير نشط."}
                )

        self.debit_amount = money(self.debit_amount)
        self.credit_amount = money(self.credit_amount)

        if self.debit_amount < 0:
            raise ValidationError({"debit_amount": "القيمة لا يمكن أن تكون سالبة."})

        if self.credit_amount < 0:
            raise ValidationError({"credit_amount": "القيمة لا يمكن أن تكون سالبة."})

        if self.debit_amount == Decimal("0.00") and self.credit_amount == Decimal("0.00"):
            raise ValidationError(
                "يجب إدخال قيمة مدين أو دائن في سطر القيد."
            )

        if self.debit_amount > Decimal("0.00") and self.credit_amount > Decimal("0.00"):
            raise ValidationError(
                "لا يمكن أن يحتوي نفس السطر على قيمة مدين ودائن معًا."
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

        if self.journal_entry_id:
            self.journal_entry.refresh_totals(save=True)

    def delete(self, *args, **kwargs):
        journal_entry = self.journal_entry if self.journal_entry_id else None

        if journal_entry and journal_entry.status == JournalEntryStatus.CANCELLED:
            raise ValidationError("لا يمكن حذف سطر من قيد ملغي.")

        result = super().delete(*args, **kwargs)

        if journal_entry:
            journal_entry.refresh_totals(save=True)

        return result

    # ========================================================
    # Properties
    # ========================================================

    @property
    def line_type(self) -> str:
        if self.debit_amount > Decimal("0.00"):
            return "DEBIT"
        if self.credit_amount > Decimal("0.00"):
            return "CREDIT"
        return "ZERO"

    @property
    def amount(self) -> Decimal:
        if self.debit_amount > Decimal("0.00"):
            return money(self.debit_amount)
        return money(self.credit_amount)