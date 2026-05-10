# ============================================================
# 📂 accounting/models.py
# 🧠 Primey Care | Accounting Module
# ------------------------------------------------------------
# ✅ هذا الموديول يمثل الأساس المحاسبي الحقيقي للنظام
# ✅ يشمل:
#    - شجرة الحسابات
#    - السنوات والفترات المالية
#    - مراكز التكلفة
#    - إعدادات التوجيه المحاسبي
#    - الضرائب
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
# - لا يسمح بتعديل أسطر قيد مرحل أو ملغي.
# - لا يسمح بسطر قيد فيه مدين ودائن معًا.
# - لا يسمح بسطر قيد صفري.
# - إجماليات القيد تتحدث تلقائيًا عند إضافة/تعديل/حذف الأسطر.
# - يدعم مصادر ترحيل واضحة للربط مع النظام.
# - يدعم الفترات المالية ومراكز التكلفة والتوجيه المحاسبي.
# ============================================================

from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
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
    REVERSED = "REVERSED", "معكوس"


class PostingSource(models.TextChoices):
    MANUAL = "MANUAL", "يدوي"
    OPENING_BALANCE = "OPENING_BALANCE", "رصيد افتتاحي"
    ORDER = "ORDER", "طلب"
    INVOICE = "INVOICE", "فاتورة"
    PAYMENT = "PAYMENT", "دفعة"
    REFUND = "REFUND", "استرداد"
    AGENT_COMMISSION = "AGENT_COMMISSION", "عمولة مندوب"
    TREASURY = "TREASURY", "خزينة"
    TREASURY_TRANSFER = "TREASURY_TRANSFER", "تحويل خزينة"
    EXPENSE = "EXPENSE", "مصروف"
    INCOME = "INCOME", "إيراد"
    TAX = "TAX", "ضريبة"
    ADJUSTMENT = "ADJUSTMENT", "تسوية"
    SYSTEM = "SYSTEM", "نظام"
    OTHER = "OTHER", "أخرى"


class FiscalYearStatus(models.TextChoices):
    OPEN = "OPEN", "مفتوحة"
    CLOSED = "CLOSED", "مغلقة"
    ARCHIVED = "ARCHIVED", "مؤرشفة"


class AccountingPeriodStatus(models.TextChoices):
    OPEN = "OPEN", "مفتوحة"
    CLOSED = "CLOSED", "مغلقة"
    LOCKED = "LOCKED", "مقفلة"


class CostCenterStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "نشط"
    INACTIVE = "INACTIVE", "غير نشط"


class TaxType(models.TextChoices):
    VAT = "VAT", "ضريبة القيمة المضافة"
    WITHHOLDING = "WITHHOLDING", "ضريبة استقطاع"
    ZAKAT = "ZAKAT", "زكاة"
    OTHER = "OTHER", "أخرى"


class TaxDirection(models.TextChoices):
    OUTPUT = "OUTPUT", "ضريبة مبيعات"
    INPUT = "INPUT", "ضريبة مشتريات"
    SETTLEMENT = "SETTLEMENT", "تسوية ضريبية"


class AccountingRoutingSource(models.TextChoices):
    SALES_INVOICE = "SALES_INVOICE", "فاتورة مبيعات"
    PURCHASE_INVOICE = "PURCHASE_INVOICE", "فاتورة مشتريات"
    PAYMENT_RECEIPT = "PAYMENT_RECEIPT", "قبض دفعة"
    PAYMENT_REFUND = "PAYMENT_REFUND", "استرداد دفعة"
    TREASURY_INCOME = "TREASURY_INCOME", "قبض خزينة"
    TREASURY_EXPENSE = "TREASURY_EXPENSE", "صرف خزينة"
    TREASURY_TRANSFER = "TREASURY_TRANSFER", "تحويل خزينة"
    EXPENSE = "EXPENSE", "مصروف"
    INCOME = "INCOME", "إيراد"
    AGENT_COMMISSION = "AGENT_COMMISSION", "عمولة مندوب"
    TAX_SETTLEMENT = "TAX_SETTLEMENT", "تسوية ضريبية"
    OPENING_BALANCE = "OPENING_BALANCE", "رصيد افتتاحي"
    OTHER = "OTHER", "أخرى"


class AccountingAccountPurpose(models.TextChoices):
    ACCOUNTS_RECEIVABLE = "ACCOUNTS_RECEIVABLE", "ذمم العملاء"
    ACCOUNTS_PAYABLE = "ACCOUNTS_PAYABLE", "ذمم الموردين"
    CASH = "CASH", "الصندوق"
    BANK = "BANK", "البنك"
    SALES_REVENUE = "SALES_REVENUE", "إيرادات المبيعات"
    OTHER_REVENUE = "OTHER_REVENUE", "إيرادات أخرى"
    OUTPUT_VAT = "OUTPUT_VAT", "ضريبة مخرجات"
    INPUT_VAT = "INPUT_VAT", "ضريبة مدخلات"
    VAT_PAYABLE = "VAT_PAYABLE", "ضريبة مستحقة"
    DISCOUNT_ALLOWED = "DISCOUNT_ALLOWED", "خصم مسموح"
    DISCOUNT_EARNED = "DISCOUNT_EARNED", "خصم مكتسب"
    COST_OF_SALES = "COST_OF_SALES", "تكلفة المبيعات"
    EXPENSE = "EXPENSE", "مصروف"
    AGENT_COMMISSION_EXPENSE = "AGENT_COMMISSION_EXPENSE", "مصروف عمولة مندوب"
    AGENT_COMMISSION_PAYABLE = "AGENT_COMMISSION_PAYABLE", "مستحقات مندوب"
    GATEWAY_FEES = "GATEWAY_FEES", "رسوم بوابة دفع"
    ROUNDING = "ROUNDING", "فروقات تقريب"
    OPENING_EQUITY = "OPENING_EQUITY", "حقوق أرصدة افتتاحية"
    SUSPENSE = "SUSPENSE", "حساب معلق"
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


def _normalise_code(value) -> str:
    return str(value or "").strip()


def _normalise_currency(value) -> str:
    return str(value or "SAR").strip().upper()


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
    name_en = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="اسم الحساب بالإنجليزية",
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
    # ⚙️ إعدادات تشغيلية
    # ========================================================
    allow_manual_posting = models.BooleanField(
        default=True,
        verbose_name="يسمح بالترحيل اليدوي",
    )
    is_system = models.BooleanField(
        default=False,
        verbose_name="حساب نظامي",
        help_text="الحسابات النظامية تستخدم في التوجيه المحاسبي ولا يفضل حذفها.",
    )
    currency = models.CharField(
        max_length=10,
        default="SAR",
        verbose_name="العملة",
    )
    opening_balance = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="الرصيد الافتتاحي",
    )

    # ========================================================
    # 📝 بيانات إضافية
    # ========================================================
    description = models.TextField(
        blank=True,
        verbose_name="الوصف",
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بيانات إضافية",
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
            models.Index(fields=["level"]),
            models.Index(fields=["is_group"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["is_system"]),
            models.Index(fields=["currency"]),
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

        self.code = _normalise_code(self.code)
        self.name = str(self.name or "").strip()
        self.name_en = str(self.name_en or "").strip()
        self.currency = _normalise_currency(self.currency)
        self.opening_balance = money(self.opening_balance)

        if not self.code:
            raise ValidationError({"code": "كود الحساب مطلوب."})

        if not self.name:
            raise ValidationError({"name": "اسم الحساب مطلوب."})

        if self.opening_balance < Decimal("0.00"):
            raise ValidationError({"opening_balance": "الرصيد الافتتاحي لا يمكن أن يكون سالبًا."})

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

        if self.is_group:
            self.allow_manual_posting = False

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

    @property
    def can_manual_post(self) -> bool:
        return bool(self.can_post and self.allow_manual_posting)


# ============================================================
# 🧩 CostCenter | مراكز التكلفة
# ============================================================

class CostCenter(models.Model):
    name = models.CharField(
        max_length=255,
        verbose_name="اسم مركز التكلفة",
    )
    name_en = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="اسم مركز التكلفة بالإنجليزية",
    )
    code = models.CharField(
        max_length=50,
        unique=True,
        verbose_name="كود مركز التكلفة",
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="children",
        verbose_name="مركز التكلفة الأب",
    )
    level = models.PositiveIntegerField(
        default=1,
        verbose_name="المستوى",
    )
    is_group = models.BooleanField(
        default=False,
        verbose_name="مركز تجميعي",
    )
    status = models.CharField(
        max_length=20,
        choices=CostCenterStatus.choices,
        default=CostCenterStatus.ACTIVE,
        verbose_name="الحالة",
    )
    description = models.TextField(
        blank=True,
        verbose_name="الوصف",
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بيانات إضافية",
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
        db_table = "accounting_cost_centers"
        verbose_name = "مركز تكلفة"
        verbose_name_plural = "مراكز التكلفة"
        ordering = ["code"]
        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["parent"]),
            models.Index(fields=["level"]),
            models.Index(fields=["is_group"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"

    def clean(self):
        super().clean()

        self.code = _normalise_code(self.code)
        self.name = str(self.name or "").strip()
        self.name_en = str(self.name_en or "").strip()

        if not self.code:
            raise ValidationError({"code": "كود مركز التكلفة مطلوب."})

        if not self.name:
            raise ValidationError({"name": "اسم مركز التكلفة مطلوب."})

        if self.parent_id:
            if self.pk and self.parent_id == self.pk:
                raise ValidationError({"parent": "لا يمكن أن يكون مركز التكلفة أبًا لنفسه."})

            if self.parent and not self.parent.is_group:
                raise ValidationError({"parent": "مركز التكلفة الأب يجب أن يكون تجميعيًا."})

            self._validate_no_parent_cycle()
            self.level = (self.parent.level or 1) + 1
        else:
            self.level = 1

    def _validate_no_parent_cycle(self):
        if not self.pk or not self.parent_id:
            return

        current_parent = self.parent
        visited_ids = set()

        while current_parent:
            if current_parent.pk in visited_ids:
                raise ValidationError({"parent": "يوجد تكرار غير صحيح داخل شجرة مراكز التكلفة."})

            if current_parent.pk == self.pk:
                raise ValidationError({"parent": "لا يمكن ربط مركز التكلفة بأحد فروعه."})

            visited_ids.add(current_parent.pk)
            current_parent = current_parent.parent

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def can_post(self) -> bool:
        return bool(self.status == CostCenterStatus.ACTIVE and not self.is_group)


# ============================================================
# 📅 FiscalYear | السنة المالية
# ============================================================

class FiscalYear(models.Model):
    name = models.CharField(
        max_length=100,
        verbose_name="اسم السنة المالية",
    )
    start_date = models.DateField(
        verbose_name="تاريخ البداية",
    )
    end_date = models.DateField(
        verbose_name="تاريخ النهاية",
    )
    status = models.CharField(
        max_length=20,
        choices=FiscalYearStatus.choices,
        default=FiscalYearStatus.OPEN,
        verbose_name="الحالة",
    )
    is_current = models.BooleanField(
        default=False,
        verbose_name="السنة الحالية",
    )
    description = models.TextField(
        blank=True,
        verbose_name="الوصف",
    )
    closed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ الإغلاق",
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
        db_table = "accounting_fiscal_years"
        verbose_name = "سنة مالية"
        verbose_name_plural = "السنوات المالية"
        ordering = ["-start_date"]
        indexes = [
            models.Index(fields=["start_date"]),
            models.Index(fields=["end_date"]),
            models.Index(fields=["status"]),
            models.Index(fields=["is_current"]),
        ]

    def __str__(self):
        return self.name

    def clean(self):
        super().clean()

        self.name = str(self.name or "").strip()

        if not self.name:
            raise ValidationError({"name": "اسم السنة المالية مطلوب."})

        if not self.start_date:
            raise ValidationError({"start_date": "تاريخ بداية السنة المالية مطلوب."})

        if not self.end_date:
            raise ValidationError({"end_date": "تاريخ نهاية السنة المالية مطلوب."})

        if self.end_date < self.start_date:
            raise ValidationError({"end_date": "تاريخ النهاية يجب أن يكون بعد تاريخ البداية."})

        if self.status == FiscalYearStatus.CLOSED and not self.closed_at:
            self.closed_at = timezone.now()

    def save(self, *args, **kwargs):
        self.full_clean()

        if self.is_current:
            FiscalYear.objects.exclude(pk=self.pk).update(is_current=False)

        super().save(*args, **kwargs)

    @property
    def is_closed(self) -> bool:
        return self.status in {FiscalYearStatus.CLOSED, FiscalYearStatus.ARCHIVED}


# ============================================================
# 📆 AccountingPeriod | الفترة المحاسبية
# ============================================================

class AccountingPeriod(models.Model):
    fiscal_year = models.ForeignKey(
        FiscalYear,
        on_delete=models.PROTECT,
        related_name="periods",
        verbose_name="السنة المالية",
    )
    name = models.CharField(
        max_length=100,
        verbose_name="اسم الفترة",
    )
    start_date = models.DateField(
        verbose_name="تاريخ البداية",
    )
    end_date = models.DateField(
        verbose_name="تاريخ النهاية",
    )
    status = models.CharField(
        max_length=20,
        choices=AccountingPeriodStatus.choices,
        default=AccountingPeriodStatus.OPEN,
        verbose_name="الحالة",
    )
    is_adjustment_period = models.BooleanField(
        default=False,
        verbose_name="فترة تسويات",
    )
    closed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ الإغلاق",
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
        db_table = "accounting_periods"
        verbose_name = "فترة محاسبية"
        verbose_name_plural = "الفترات المحاسبية"
        ordering = ["start_date"]
        indexes = [
            models.Index(fields=["fiscal_year"]),
            models.Index(fields=["start_date"]),
            models.Index(fields=["end_date"]),
            models.Index(fields=["status"]),
            models.Index(fields=["is_adjustment_period"]),
            models.Index(fields=["fiscal_year", "status"]),
        ]

    def __str__(self):
        return f"{self.fiscal_year.name} - {self.name}"

    def clean(self):
        super().clean()

        self.name = str(self.name or "").strip()

        if not self.name:
            raise ValidationError({"name": "اسم الفترة مطلوب."})

        if not self.start_date:
            raise ValidationError({"start_date": "تاريخ بداية الفترة مطلوب."})

        if not self.end_date:
            raise ValidationError({"end_date": "تاريخ نهاية الفترة مطلوب."})

        if self.end_date < self.start_date:
            raise ValidationError({"end_date": "تاريخ النهاية يجب أن يكون بعد تاريخ البداية."})

        if self.fiscal_year_id:
            if self.start_date < self.fiscal_year.start_date or self.end_date > self.fiscal_year.end_date:
                raise ValidationError("الفترة المحاسبية يجب أن تكون داخل نطاق السنة المالية.")

            if self.fiscal_year.is_closed:
                raise ValidationError({"fiscal_year": "لا يمكن تعديل فترة داخل سنة مالية مغلقة أو مؤرشفة."})

        if self.status in {AccountingPeriodStatus.CLOSED, AccountingPeriodStatus.LOCKED} and not self.closed_at:
            self.closed_at = timezone.now()

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def is_open(self) -> bool:
        return self.status == AccountingPeriodStatus.OPEN

    @property
    def is_closed(self) -> bool:
        return self.status in {AccountingPeriodStatus.CLOSED, AccountingPeriodStatus.LOCKED}


# ============================================================
# 🧾 TaxRate | الضرائب
# ============================================================

class TaxRate(models.Model):
    name = models.CharField(
        max_length=100,
        verbose_name="اسم الضريبة",
    )
    code = models.CharField(
        max_length=50,
        unique=True,
        verbose_name="كود الضريبة",
    )
    tax_type = models.CharField(
        max_length=20,
        choices=TaxType.choices,
        default=TaxType.VAT,
        verbose_name="نوع الضريبة",
    )
    rate = models.DecimalField(
        max_digits=7,
        decimal_places=4,
        default=Decimal("0.00"),
        verbose_name="النسبة",
    )
    sales_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        related_name="sales_tax_rates",
        null=True,
        blank=True,
        verbose_name="حساب ضريبة المبيعات",
    )
    purchase_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        related_name="purchase_tax_rates",
        null=True,
        blank=True,
        verbose_name="حساب ضريبة المشتريات",
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="نشطة",
    )
    is_default = models.BooleanField(
        default=False,
        verbose_name="افتراضية",
    )
    description = models.TextField(
        blank=True,
        verbose_name="الوصف",
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
        db_table = "accounting_tax_rates"
        verbose_name = "ضريبة"
        verbose_name_plural = "الضرائب"
        ordering = ["code"]
        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["tax_type"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["is_default"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"

    def clean(self):
        super().clean()

        self.code = _normalise_code(self.code)
        self.name = str(self.name or "").strip()
        self.rate = money(self.rate)

        if not self.code:
            raise ValidationError({"code": "كود الضريبة مطلوب."})

        if not self.name:
            raise ValidationError({"name": "اسم الضريبة مطلوب."})

        if self.rate < Decimal("0.00"):
            raise ValidationError({"rate": "نسبة الضريبة لا يمكن أن تكون سالبة."})

        if self.sales_account and not self.sales_account.can_post:
            raise ValidationError({"sales_account": "حساب ضريبة المبيعات يجب أن يكون حسابًا قابلًا للترحيل."})

        if self.purchase_account and not self.purchase_account.can_post:
            raise ValidationError({"purchase_account": "حساب ضريبة المشتريات يجب أن يكون حسابًا قابلًا للترحيل."})

    def save(self, *args, **kwargs):
        self.full_clean()

        if self.is_default:
            TaxRate.objects.exclude(pk=self.pk).filter(tax_type=self.tax_type).update(is_default=False)

        super().save(*args, **kwargs)


# ============================================================
# ⚙️ AccountingSettings | إعدادات المحاسبة العامة
# ============================================================

class AccountingSettings(models.Model):
    default_currency = models.CharField(
        max_length=10,
        default="SAR",
        verbose_name="العملة الافتراضية",
    )
    default_tax_rate = models.ForeignKey(
        TaxRate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="default_in_settings",
        verbose_name="الضريبة الافتراضية",
    )
    auto_post_invoices = models.BooleanField(
        default=True,
        verbose_name="ترحيل الفواتير تلقائيًا",
    )
    auto_post_payments = models.BooleanField(
        default=True,
        verbose_name="ترحيل المدفوعات تلقائيًا",
    )
    auto_post_treasury = models.BooleanField(
        default=False,
        verbose_name="ترحيل الخزينة تلقائيًا",
    )
    require_period_for_posting = models.BooleanField(
        default=False,
        verbose_name="إلزام الفترة عند الترحيل",
    )
    allow_posting_without_cost_center = models.BooleanField(
        default=True,
        verbose_name="السماح بالترحيل بدون مركز تكلفة",
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بيانات إضافية",
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
        db_table = "accounting_settings"
        verbose_name = "إعدادات المحاسبة"
        verbose_name_plural = "إعدادات المحاسبة"

    def __str__(self):
        return "إعدادات المحاسبة العامة"

    def clean(self):
        super().clean()
        self.default_currency = _normalise_currency(self.default_currency)

    def save(self, *args, **kwargs):
        self.pk = 1
        self.full_clean()
        super().save(*args, **kwargs)

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


# ============================================================
# 🧭 AccountingRoutingRule | قواعد التوجيه المحاسبي
# ============================================================

class AccountingRoutingRule(models.Model):
    source = models.CharField(
        max_length=50,
        choices=AccountingRoutingSource.choices,
        verbose_name="مصدر العملية",
    )
    purpose = models.CharField(
        max_length=80,
        choices=AccountingAccountPurpose.choices,
        verbose_name="الغرض المحاسبي",
    )
    account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        related_name="routing_rules",
        verbose_name="الحساب",
    )
    tax_rate = models.ForeignKey(
        TaxRate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="routing_rules",
        verbose_name="الضريبة",
    )
    cost_center = models.ForeignKey(
        CostCenter,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="routing_rules",
        verbose_name="مركز التكلفة",
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="نشطة",
    )
    priority = models.PositiveIntegerField(
        default=100,
        verbose_name="الأولوية",
    )
    description = models.TextField(
        blank=True,
        verbose_name="الوصف",
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بيانات إضافية",
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
        db_table = "accounting_routing_rules"
        verbose_name = "قاعدة توجيه محاسبي"
        verbose_name_plural = "قواعد التوجيه المحاسبي"
        ordering = ["source", "purpose", "priority"]
        indexes = [
            models.Index(fields=["source"]),
            models.Index(fields=["purpose"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["priority"]),
            models.Index(fields=["source", "purpose", "is_active"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["source", "purpose", "account", "tax_rate", "cost_center"],
                name="unique_accounting_routing_rule_scope",
            )
        ]

    def __str__(self):
        return f"{self.get_source_display()} - {self.get_purpose_display()}"

    def clean(self):
        super().clean()

        if self.account and not self.account.can_post:
            raise ValidationError({"account": "حساب التوجيه يجب أن يكون حسابًا نشطًا وغير تجميعي."})

        if self.cost_center and not self.cost_center.can_post:
            raise ValidationError({"cost_center": "مركز التكلفة يجب أن يكون نشطًا وغير تجميعي."})


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
    period = models.ForeignKey(
        AccountingPeriod,
        on_delete=models.PROTECT,
        related_name="journal_entries",
        null=True,
        blank=True,
        verbose_name="الفترة المحاسبية",
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
    source_type = models.CharField(
        max_length=80,
        blank=True,
        verbose_name="نوع المصدر",
        help_text="مثال: invoice, payment, treasury_transaction",
    )
    source_id = models.CharField(
        max_length=80,
        blank=True,
        verbose_name="معرف المصدر",
    )
    source_number = models.CharField(
        max_length=120,
        blank=True,
        verbose_name="رقم المصدر",
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
    # 🔁 عكس القيود
    # ========================================================
    reversal_of = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="reversal_entries",
        verbose_name="قيد عكسي لـ",
    )
    reversed_entry = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="original_reversed_entries",
        verbose_name="القيد العكسي",
    )
    reversed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ العكس",
    )

    # ========================================================
    # ⚙️ تشغيل
    # ========================================================
    is_auto_posted = models.BooleanField(
        default=False,
        verbose_name="مرحل آليًا",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_journal_entries",
        verbose_name="أنشئ بواسطة",
    )
    posted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="posted_journal_entries",
        verbose_name="رحل بواسطة",
    )
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cancelled_journal_entries",
        verbose_name="ألغي بواسطة",
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
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بيانات إضافية",
    )

    # ========================================================
    # 🕒 التتبع
    # ========================================================
    posted_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ الترحيل",
    )
    cancelled_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ الإلغاء",
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
            models.Index(fields=["period"]),
            models.Index(fields=["status"]),
            models.Index(fields=["posting_source"]),
            models.Index(fields=["reference"]),
            models.Index(fields=["external_reference"]),
            models.Index(fields=["source_type"]),
            models.Index(fields=["source_id"]),
            models.Index(fields=["source_number"]),
            models.Index(fields=["currency"]),
            models.Index(fields=["is_auto_posted"]),
            models.Index(fields=["status", "entry_date"]),
            models.Index(fields=["posting_source", "reference"]),
            models.Index(fields=["source_type", "source_id"]),
        ]

    def __str__(self):
        return f"{self.entry_number} - {self.entry_date}"

    # ========================================================
    # ✅ Validation
    # ========================================================

    def clean(self):
        super().clean()

        self.entry_number = _normalise_code(self.entry_number)
        self.currency = _normalise_currency(self.currency)
        self.reference = str(self.reference or "").strip()
        self.external_reference = str(self.external_reference or "").strip()
        self.source_type = str(self.source_type or "").strip()
        self.source_id = str(self.source_id or "").strip()
        self.source_number = str(self.source_number or "").strip()

        if not self.entry_number:
            raise ValidationError({"entry_number": "رقم القيد مطلوب."})

        if not self.entry_date:
            raise ValidationError({"entry_date": "تاريخ القيد مطلوب."})

        for field_name in ["total_debit", "total_credit"]:
            value = getattr(self, field_name)
            if value is not None and value < 0:
                raise ValidationError({field_name: "القيمة لا يمكن أن تكون سالبة."})

        self.total_debit = money(self.total_debit)
        self.total_credit = money(self.total_credit)

        if self.period:
            if not (self.period.start_date <= self.entry_date <= self.period.end_date):
                raise ValidationError({"period": "تاريخ القيد خارج نطاق الفترة المحاسبية."})

            if self.status == JournalEntryStatus.POSTED and self.period.is_closed:
                raise ValidationError({"period": "لا يمكن ترحيل قيد داخل فترة محاسبية مغلقة."})

        if self.status == JournalEntryStatus.POSTED:
            self._validate_posting_rules()

        if self.status == JournalEntryStatus.CANCELLED:
            if not self.cancelled_at:
                self.cancelled_at = timezone.now()
            if not self.notes:
                self.notes = "تم إلغاء القيد."

        if self.status == JournalEntryStatus.REVERSED:
            if not self.reversed_at:
                self.reversed_at = timezone.now()

    def _validate_posting_rules(self):
        if self.total_debit != self.total_credit:
            raise ValidationError("لا يمكن ترحيل قيد غير متوازن.")

        if self.total_debit <= Decimal("0.00"):
            raise ValidationError("لا يمكن ترحيل قيد بإجمالي صفري.")

        if not self.posted_at:
            self.posted_at = timezone.now()

        if not self.period_id:
            self.period = self._resolve_period_for_date()

        settings_obj = AccountingSettings.get_solo()
        if settings_obj.require_period_for_posting and not self.period_id:
            raise ValidationError("الفترة المحاسبية مطلوبة قبل ترحيل القيد.")

        if self.period and self.period.is_closed:
            raise ValidationError("لا يمكن الترحيل داخل فترة محاسبية مغلقة.")

    def _resolve_period_for_date(self):
        try:
            return AccountingPeriod.objects.filter(
                start_date__lte=self.entry_date,
                end_date__gte=self.entry_date,
                status=AccountingPeriodStatus.OPEN,
            ).order_by("start_date").first()
        except Exception:
            return None

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

    def save(self, *args, **kwargs):
        if self.pk:
            self._sync_totals_from_lines()

        self.full_clean()
        super().save(*args, **kwargs)

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

    def mark_as_posted(self, *, actor=None):
        """
        ترحيل القيد بعد التأكد من توازنه.
        """
        if self.status == JournalEntryStatus.POSTED:
            return

        if self.status in {JournalEntryStatus.CANCELLED, JournalEntryStatus.REVERSED}:
            raise ValidationError("لا يمكن ترحيل قيد ملغي أو معكوس.")

        self._sync_totals_from_lines()

        if not self.lines.exists():
            raise ValidationError("لا يمكن ترحيل قيد بدون أسطر.")

        if not self.is_balanced:
            raise ValidationError("لا يمكن ترحيل قيد غير متوازن.")

        if self.total_debit <= Decimal("0.00"):
            raise ValidationError("لا يمكن ترحيل قيد بإجمالي صفري.")

        self.status = JournalEntryStatus.POSTED
        self.posted_at = self.posted_at or timezone.now()

        if actor is not None and getattr(actor, "is_authenticated", False):
            self.posted_by = actor

        self.save(
            update_fields=[
                "status",
                "posted_at",
                "posted_by",
                "period",
                "total_debit",
                "total_credit",
                "updated_at",
            ]
        )

    def mark_as_cancelled(self, *, reason: str = "", actor=None):
        """
        إلغاء القيد.
        ملاحظة:
        الإلغاء هنا يغير الحالة فقط.
        عكس الأثر المحاسبي يجب أن يتم بقيد عكسي مستقل من services.
        """
        if self.status == JournalEntryStatus.CANCELLED:
            return

        if self.status == JournalEntryStatus.POSTED:
            raise ValidationError(
                "لا يفضل إلغاء قيد مرحل مباشرة. أنشئ قيدًا عكسيًا من services."
            )

        self.status = JournalEntryStatus.CANCELLED
        self.cancelled_at = self.cancelled_at or timezone.now()

        if actor is not None and getattr(actor, "is_authenticated", False):
            self.cancelled_by = actor

        if reason:
            self.notes = f"{self.notes}\nسبب الإلغاء: {reason}".strip()
        elif not self.notes:
            self.notes = "تم إلغاء القيد."

        self.save(
            update_fields=[
                "status",
                "notes",
                "cancelled_at",
                "cancelled_by",
                "updated_at",
            ]
        )

    def mark_as_reversed(self, *, reversed_entry=None):
        if self.status != JournalEntryStatus.POSTED:
            raise ValidationError("يمكن عكس القيود المرحلة فقط.")

        self.status = JournalEntryStatus.REVERSED
        self.reversed_entry = reversed_entry
        self.reversed_at = timezone.now()
        self.save(
            update_fields=[
                "status",
                "reversed_entry",
                "reversed_at",
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
    def is_reversed(self) -> bool:
        return self.status == JournalEntryStatus.REVERSED

    @property
    def can_edit_lines(self) -> bool:
        """
        يسمح بتعديل الأسطر فقط للمسودة.
        القيود المرحلة أو الملغية أو المعكوسة لا تعدل.
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
    cost_center = models.ForeignKey(
        CostCenter,
        on_delete=models.SET_NULL,
        related_name="journal_lines",
        null=True,
        blank=True,
        verbose_name="مركز التكلفة",
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

    # ========================================================
    # 🧾 الضرائب
    # ========================================================
    tax_rate = models.ForeignKey(
        TaxRate,
        on_delete=models.SET_NULL,
        related_name="journal_lines",
        null=True,
        blank=True,
        verbose_name="الضريبة",
    )
    tax_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="مبلغ الضريبة",
    )

    # ========================================================
    # 🔗 الطرف والمصدر
    # ========================================================
    party_type = models.CharField(
        max_length=80,
        blank=True,
        verbose_name="نوع الطرف",
        help_text="مثال: customer, provider, agent, employee",
    )
    party_id = models.CharField(
        max_length=80,
        blank=True,
        verbose_name="معرف الطرف",
    )
    source_line_id = models.CharField(
        max_length=120,
        blank=True,
        verbose_name="معرف سطر المصدر",
    )

    sort_order = models.PositiveIntegerField(
        default=0,
        verbose_name="ترتيب العرض",
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بيانات إضافية",
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
            models.Index(fields=["cost_center"]),
            models.Index(fields=["tax_rate"]),
            models.Index(fields=["party_type"]),
            models.Index(fields=["party_id"]),
            models.Index(fields=["source_line_id"]),
            models.Index(fields=["sort_order"]),
            models.Index(fields=["journal_entry", "sort_order"]),
            models.Index(fields=["account", "created_at"]),
            models.Index(fields=["cost_center", "created_at"]),
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

        if self.journal_entry and not self.journal_entry.can_edit_lines:
            raise ValidationError("لا يمكن تعديل أو إضافة أسطر على قيد غير مسودة.")

        if self.account:
            if self.account.is_group:
                raise ValidationError(
                    {"account": "لا يمكن الترحيل على حساب تجميعي."}
                )

            if not self.account.is_active:
                raise ValidationError(
                    {"account": "لا يمكن الترحيل على حساب غير نشط."}
                )

        if self.cost_center and not self.cost_center.can_post:
            raise ValidationError(
                {"cost_center": "لا يمكن الترحيل على مركز تكلفة تجميعي أو غير نشط."}
            )

        self.debit_amount = money(self.debit_amount)
        self.credit_amount = money(self.credit_amount)
        self.tax_amount = money(self.tax_amount)

        if self.debit_amount < 0:
            raise ValidationError({"debit_amount": "القيمة لا يمكن أن تكون سالبة."})

        if self.credit_amount < 0:
            raise ValidationError({"credit_amount": "القيمة لا يمكن أن تكون سالبة."})

        if self.tax_amount < 0:
            raise ValidationError({"tax_amount": "مبلغ الضريبة لا يمكن أن يكون سالبًا."})

        if self.debit_amount == Decimal("0.00") and self.credit_amount == Decimal("0.00"):
            raise ValidationError(
                "يجب إدخال قيمة مدين أو دائن في سطر القيد."
            )

        if self.debit_amount > Decimal("0.00") and self.credit_amount > Decimal("0.00"):
            raise ValidationError(
                "لا يمكن أن يحتوي نفس السطر على قيمة مدين ودائن معًا."
            )

        self.party_type = str(self.party_type or "").strip()
        self.party_id = str(self.party_id or "").strip()
        self.source_line_id = str(self.source_line_id or "").strip()

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

        if self.journal_entry_id:
            self.journal_entry.refresh_totals(save=True)

    def delete(self, *args, **kwargs):
        journal_entry = self.journal_entry if self.journal_entry_id else None

        if journal_entry and not journal_entry.can_edit_lines:
            raise ValidationError("لا يمكن حذف سطر من قيد غير مسودة.")

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


# ============================================================
# 🧾 TaxTransaction | حركة ضريبية
# ============================================================

class TaxTransaction(models.Model):
    tax_rate = models.ForeignKey(
        TaxRate,
        on_delete=models.PROTECT,
        related_name="tax_transactions",
        verbose_name="الضريبة",
    )
    journal_entry = models.ForeignKey(
        JournalEntry,
        on_delete=models.PROTECT,
        related_name="tax_transactions",
        null=True,
        blank=True,
        verbose_name="القيد المحاسبي",
    )
    journal_line = models.ForeignKey(
        JournalEntryLine,
        on_delete=models.PROTECT,
        related_name="tax_transactions",
        null=True,
        blank=True,
        verbose_name="سطر القيد",
    )
    direction = models.CharField(
        max_length=20,
        choices=TaxDirection.choices,
        verbose_name="اتجاه الضريبة",
    )
    transaction_date = models.DateField(
        verbose_name="تاريخ الحركة",
    )
    taxable_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="المبلغ الخاضع للضريبة",
    )
    tax_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="مبلغ الضريبة",
    )
    currency = models.CharField(
        max_length=10,
        default="SAR",
        verbose_name="العملة",
    )
    source_type = models.CharField(
        max_length=80,
        blank=True,
        verbose_name="نوع المصدر",
    )
    source_id = models.CharField(
        max_length=80,
        blank=True,
        verbose_name="معرف المصدر",
    )
    source_number = models.CharField(
        max_length=120,
        blank=True,
        verbose_name="رقم المصدر",
    )
    description = models.TextField(
        blank=True,
        verbose_name="الوصف",
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بيانات إضافية",
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
        db_table = "accounting_tax_transactions"
        verbose_name = "حركة ضريبية"
        verbose_name_plural = "الحركات الضريبية"
        ordering = ["-transaction_date", "-id"]
        indexes = [
            models.Index(fields=["tax_rate"]),
            models.Index(fields=["journal_entry"]),
            models.Index(fields=["journal_line"]),
            models.Index(fields=["direction"]),
            models.Index(fields=["transaction_date"]),
            models.Index(fields=["source_type"]),
            models.Index(fields=["source_id"]),
            models.Index(fields=["currency"]),
        ]

    def __str__(self):
        return f"{self.get_direction_display()} - {self.tax_amount}"

    def clean(self):
        super().clean()

        if not self.transaction_date:
            raise ValidationError({"transaction_date": "تاريخ الحركة الضريبية مطلوب."})

        self.taxable_amount = money(self.taxable_amount)
        self.tax_amount = money(self.tax_amount)
        self.currency = _normalise_currency(self.currency)
        self.source_type = str(self.source_type or "").strip()
        self.source_id = str(self.source_id or "").strip()
        self.source_number = str(self.source_number or "").strip()

        if self.taxable_amount < Decimal("0.00"):
            raise ValidationError({"taxable_amount": "المبلغ الخاضع للضريبة لا يمكن أن يكون سالبًا."})

        if self.tax_amount < Decimal("0.00"):
            raise ValidationError({"tax_amount": "مبلغ الضريبة لا يمكن أن يكون سالبًا."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)