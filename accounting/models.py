# ============================================================
# 📂 accounting/models.py
# 🧠 Primey Care | Accounting Module V3.1 Safe Expansion
# ------------------------------------------------------------
# ✅ شجرة الحسابات
# ✅ السنوات والفترات المالية
# ✅ مراكز التكلفة
# ✅ إعدادات التوجيه المحاسبي
# ✅ الضرائب والحركات الضريبية
# ✅ القيود اليومية وأسطر القيود
# ✅ توسعات مالية جديدة بدون حذف الحقول القديمة:
#    - عهدة المندوبين
#    - عهدة الوسطاء
#    - مستحقات المندوبين
#    - مستحقات الوسطاء
#    - قيمة التوصيل
#    - حصة النظام
#    - سندات الخزينة
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
    AGENT_EARNING = "AGENT_EARNING", "استحقاق مندوب"
    AGENT_DELIVERY_FEE = "AGENT_DELIVERY_FEE", "قيمة توصيل مندوب"
    AGENT_COD_CUSTODY = "AGENT_COD_CUSTODY", "عهدة COD مندوب"
    AGENT_SETTLEMENT = "AGENT_SETTLEMENT", "تسوية مندوب"

    BROKER_COMMISSION = "BROKER_COMMISSION", "عمولة وسيط"
    BROKER_EARNING = "BROKER_EARNING", "استحقاق وسيط"
    BROKER_COD_CUSTODY = "BROKER_COD_CUSTODY", "عهدة COD وسيط"
    BROKER_SETTLEMENT = "BROKER_SETTLEMENT", "تسوية وسيط"

    TREASURY = "TREASURY", "خزينة"
    TREASURY_TRANSFER = "TREASURY_TRANSFER", "تحويل خزينة"
    TREASURY_RECEIPT = "TREASURY_RECEIPT", "سند قبض"
    TREASURY_PAYMENT = "TREASURY_PAYMENT", "سند صرف"

    PROVIDER_CONTRACT = "PROVIDER_CONTRACT", "عقد مقدم خدمة"
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
    TREASURY_MANUAL_RECEIPT = "TREASURY_MANUAL_RECEIPT", "سند قبض يدوي"
    TREASURY_MANUAL_PAYMENT = "TREASURY_MANUAL_PAYMENT", "سند صرف يدوي"

    AGENT_COMMISSION = "AGENT_COMMISSION", "عمولة مندوب"
    AGENT_EARNING = "AGENT_EARNING", "استحقاق مندوب"
    AGENT_DELIVERY_FEE = "AGENT_DELIVERY_FEE", "قيمة توصيل مندوب"
    AGENT_COD_CUSTODY = "AGENT_COD_CUSTODY", "عهدة COD مندوب"
    AGENT_SETTLEMENT = "AGENT_SETTLEMENT", "تسوية مندوب"

    BROKER_COMMISSION = "BROKER_COMMISSION", "عمولة وسيط"
    BROKER_EARNING = "BROKER_EARNING", "استحقاق وسيط"
    BROKER_COD_CUSTODY = "BROKER_COD_CUSTODY", "عهدة COD وسيط"
    BROKER_SETTLEMENT = "BROKER_SETTLEMENT", "تسوية وسيط"

    PLATFORM_SHARE = "PLATFORM_SHARE", "حصة النظام"
    PROVIDER_CONTRACT = "PROVIDER_CONTRACT", "عقد مقدم خدمة"
    EXPENSE = "EXPENSE", "مصروف"
    INCOME = "INCOME", "إيراد"
    TAX_SETTLEMENT = "TAX_SETTLEMENT", "تسوية ضريبية"
    OPENING_BALANCE = "OPENING_BALANCE", "رصيد افتتاحي"
    OTHER = "OTHER", "أخرى"


class AccountingAccountPurpose(models.TextChoices):
    ACCOUNTS_RECEIVABLE = "ACCOUNTS_RECEIVABLE", "ذمم العملاء"
    ACCOUNTS_PAYABLE = "ACCOUNTS_PAYABLE", "ذمم الموردين"
    CASH = "CASH", "الصندوق"
    BANK = "BANK", "البنك"

    SALES_REVENUE = "SALES_REVENUE", "إيرادات المبيعات"
    PLATFORM_SHARE_REVENUE = "PLATFORM_SHARE_REVENUE", "إيراد حصة النظام / المنصة"
    OTHER_REVENUE = "OTHER_REVENUE", "إيرادات أخرى"

    OUTPUT_VAT = "OUTPUT_VAT", "ضريبة مخرجات"
    INPUT_VAT = "INPUT_VAT", "ضريبة مدخلات"
    VAT_PAYABLE = "VAT_PAYABLE", "ضريبة مستحقة"

    DISCOUNT_ALLOWED = "DISCOUNT_ALLOWED", "خصم مسموح"
    DISCOUNT_EARNED = "DISCOUNT_EARNED", "خصم مكتسب"
    COST_OF_SALES = "COST_OF_SALES", "تكلفة المبيعات"
    EXPENSE = "EXPENSE", "مصروف"

    AGENT_CUSTODY = "AGENT_CUSTODY", "عهدة المندوبين"
    AGENT_COMMISSION_EXPENSE = "AGENT_COMMISSION_EXPENSE", "مصروف عمولة مندوب"
    AGENT_DELIVERY_EXPENSE = "AGENT_DELIVERY_EXPENSE", "مصروف توصيل مندوب"
    AGENT_COMMISSION_PAYABLE = "AGENT_COMMISSION_PAYABLE", "مستحقات مندوب"
    AGENT_SETTLEMENT = "AGENT_SETTLEMENT", "تسويات مناديب"

    BROKER_CUSTODY = "BROKER_CUSTODY", "عهدة الوسطاء"
    BROKER_COMMISSION_EXPENSE = "BROKER_COMMISSION_EXPENSE", "مصروف عمولة وسيط"
    BROKER_COMMISSION_PAYABLE = "BROKER_COMMISSION_PAYABLE", "مستحقات وسيط"
    BROKER_SETTLEMENT = "BROKER_SETTLEMENT", "تسويات وسطاء"

    PROVIDER_PAYABLE = "PROVIDER_PAYABLE", "مستحقات مقدم خدمة"
    PROVIDER_CONTRACT_COMMISSION_EXPENSE = "PROVIDER_CONTRACT_COMMISSION_EXPENSE", "مصروف عمولة عقد مقدم خدمة"

    GATEWAY_FEES = "GATEWAY_FEES", "رسوم بوابة دفع"
    ROUNDING = "ROUNDING", "فروقات تقريب"
    OPENING_EQUITY = "OPENING_EQUITY", "حقوق أرصدة افتتاحية"
    SUSPENSE = "SUSPENSE", "حساب معلق"
    OTHER = "OTHER", "أخرى"


# ============================================================
# 🛠️ Helpers
# ============================================================

def money(value) -> Decimal:
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
    name = models.CharField(max_length=255, verbose_name="اسم الحساب")
    name_en = models.CharField(max_length=255, blank=True, verbose_name="اسم الحساب بالإنجليزية")
    code = models.CharField(max_length=50, unique=True, verbose_name="كود الحساب")
    account_type = models.CharField(max_length=20, choices=AccountType.choices, verbose_name="نوع الحساب")
    nature = models.CharField(max_length=10, choices=AccountNature.choices, verbose_name="طبيعة الحساب")

    purpose = models.CharField(
        max_length=80,
        choices=AccountingAccountPurpose.choices,
        default=AccountingAccountPurpose.OTHER,
        db_index=True,
        verbose_name="الغرض المحاسبي",
    )

    parent = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        related_name="children",
        null=True,
        blank=True,
        verbose_name="الحساب الأب",
    )
    level = models.PositiveIntegerField(default=1, verbose_name="المستوى")
    is_group = models.BooleanField(default=False, verbose_name="حساب تجميعي")
    is_active = models.BooleanField(default=True, verbose_name="نشط")
    is_system = models.BooleanField(default=False, verbose_name="حساب نظامي")
    allow_manual_posting = models.BooleanField(default=True, verbose_name="السماح بالترحيل اليدوي")
    opening_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"), verbose_name="الرصيد الافتتاحي")
    currency = models.CharField(max_length=10, default="SAR", verbose_name="العملة")
    description = models.TextField(blank=True, verbose_name="الوصف")
    metadata = models.JSONField(default=dict, blank=True, verbose_name="بيانات إضافية")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")

    class Meta:
        db_table = "accounting_accounts"
        verbose_name = "حساب"
        verbose_name_plural = "دليل الحسابات"
        ordering = ["code"]
        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["account_type"]),
            models.Index(fields=["nature"]),
            models.Index(fields=["purpose"]),
            models.Index(fields=["parent"]),
            models.Index(fields=["level"]),
            models.Index(fields=["is_group"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["is_system"]),
            models.Index(fields=["currency"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"

    @property
    def can_post(self) -> bool:
        return self.is_active and not self.is_group

    def clean(self):
        super().clean()
        self.code = _normalise_code(self.code)
        self.currency = _normalise_currency(self.currency)
        self.name = str(self.name or "").strip()
        self.name_en = str(self.name_en or "").strip()
        self.opening_balance = money(self.opening_balance)

        if not self.code:
            raise ValidationError({"code": "كود الحساب مطلوب."})

        if not self.name:
            raise ValidationError({"name": "اسم الحساب مطلوب."})

        if self.parent_id and self.parent_id == self.pk:
            raise ValidationError({"parent": "لا يمكن أن يكون الحساب أبًا لنفسه."})

        if self.parent and not self.parent.is_group:
            raise ValidationError({"parent": "الحساب الأب يجب أن يكون حسابًا تجميعيًا."})

        if self.is_group and self.allow_manual_posting:
            self.allow_manual_posting = False

        if not self.is_active and self.allow_manual_posting:
            self.allow_manual_posting = False

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


# ============================================================
# 📅 FiscalYear | السنة المالية
# ============================================================

class FiscalYear(models.Model):
    name = models.CharField(max_length=100, verbose_name="اسم السنة المالية")
    start_date = models.DateField(verbose_name="تاريخ البداية")
    end_date = models.DateField(verbose_name="تاريخ النهاية")
    status = models.CharField(max_length=20, choices=FiscalYearStatus.choices, default=FiscalYearStatus.OPEN, verbose_name="الحالة")
    is_current = models.BooleanField(default=False, verbose_name="السنة الحالية")
    is_default = models.BooleanField(default=False, verbose_name="افتراضية")
    description = models.TextField(blank=True, verbose_name="الوصف")
    notes = models.TextField(blank=True, verbose_name="ملاحظات")
    closed_at = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ الإغلاق")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")

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
            models.Index(fields=["is_default"]),
        ]

    def __str__(self):
        return self.name

    def clean(self):
        super().clean()

        if self.start_date and self.end_date and self.end_date <= self.start_date:
            raise ValidationError({"end_date": "تاريخ نهاية السنة يجب أن يكون بعد تاريخ البداية."})

        if self.status == FiscalYearStatus.CLOSED and not self.closed_at:
            self.closed_at = timezone.now()

    def save(self, *args, **kwargs):
        self.full_clean()

        if self.is_current:
            FiscalYear.objects.exclude(pk=self.pk).update(is_current=False)

        if self.is_default:
            FiscalYear.objects.exclude(pk=self.pk).update(is_default=False)

        super().save(*args, **kwargs)


# ============================================================
# 📆 AccountingPeriod | الفترة المحاسبية
# ============================================================

class AccountingPeriod(models.Model):
    fiscal_year = models.ForeignKey(FiscalYear, on_delete=models.PROTECT, related_name="periods", verbose_name="السنة المالية")
    name = models.CharField(max_length=100, verbose_name="اسم الفترة")
    start_date = models.DateField(verbose_name="تاريخ البداية")
    end_date = models.DateField(verbose_name="تاريخ النهاية")
    status = models.CharField(max_length=20, choices=AccountingPeriodStatus.choices, default=AccountingPeriodStatus.OPEN, verbose_name="الحالة")
    is_adjustment_period = models.BooleanField(default=False, verbose_name="فترة تسويات")
    notes = models.TextField(blank=True, verbose_name="ملاحظات")
    closed_at = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ الإغلاق")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")

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
        ]
        constraints = [
            models.UniqueConstraint(fields=["fiscal_year", "name"], name="unique_accounting_period_name_per_year"),
            models.UniqueConstraint(fields=["fiscal_year", "start_date", "end_date"], name="unique_accounting_period_range_per_year"),
        ]

    def __str__(self):
        return f"{self.fiscal_year.name} - {self.name}"

    @property
    def can_post(self) -> bool:
        return self.status == AccountingPeriodStatus.OPEN

    def clean(self):
        super().clean()

        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValidationError({"end_date": "تاريخ نهاية الفترة لا يمكن أن يكون قبل تاريخ البداية."})

        if self.fiscal_year_id:
            if self.start_date and self.start_date < self.fiscal_year.start_date:
                raise ValidationError({"start_date": "تاريخ بداية الفترة خارج نطاق السنة المالية."})

            if self.end_date and self.end_date > self.fiscal_year.end_date:
                raise ValidationError({"end_date": "تاريخ نهاية الفترة خارج نطاق السنة المالية."})

            if self.status == AccountingPeriodStatus.OPEN and self.fiscal_year.status != FiscalYearStatus.OPEN:
                raise ValidationError({"status": "لا يمكن فتح فترة داخل سنة مالية غير مفتوحة."})

        if self.status in {AccountingPeriodStatus.CLOSED, AccountingPeriodStatus.LOCKED} and not self.closed_at:
            self.closed_at = timezone.now()

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


# ============================================================
# 🏷️ CostCenter | مركز تكلفة
# ============================================================

class CostCenter(models.Model):
    name = models.CharField(max_length=255, verbose_name="اسم مركز التكلفة")
    name_en = models.CharField(max_length=255, blank=True, verbose_name="اسم مركز التكلفة بالإنجليزية")
    code = models.CharField(max_length=50, unique=True, verbose_name="كود مركز التكلفة")
    parent = models.ForeignKey("self", on_delete=models.PROTECT, related_name="children", null=True, blank=True, verbose_name="مركز التكلفة الأب")
    level = models.PositiveIntegerField(default=1, verbose_name="المستوى")
    is_group = models.BooleanField(default=False, verbose_name="مركز تكلفة تجميعي")
    status = models.CharField(max_length=20, choices=CostCenterStatus.choices, default=CostCenterStatus.ACTIVE, verbose_name="الحالة")
    description = models.TextField(blank=True, verbose_name="الوصف")
    metadata = models.JSONField(default=dict, blank=True, verbose_name="بيانات إضافية")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")

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

    @property
    def can_post(self) -> bool:
        return self.status == CostCenterStatus.ACTIVE and not self.is_group

    def clean(self):
        super().clean()
        self.code = _normalise_code(self.code)
        self.name = str(self.name or "").strip()
        self.name_en = str(self.name_en or "").strip()

        if not self.code:
            raise ValidationError({"code": "كود مركز التكلفة مطلوب."})

        if not self.name:
            raise ValidationError({"name": "اسم مركز التكلفة مطلوب."})

        if self.parent_id and self.parent_id == self.pk:
            raise ValidationError({"parent": "لا يمكن أن يكون مركز التكلفة أبًا لنفسه."})

        if self.parent and not self.parent.is_group:
            raise ValidationError({"parent": "مركز التكلفة الأب يجب أن يكون تجميعيًا."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


# ============================================================
# 🧾 TaxRate | الضرائب
# ============================================================

class TaxRate(models.Model):
    code = models.CharField(max_length=50, unique=True, verbose_name="كود الضريبة")
    name = models.CharField(max_length=255, verbose_name="اسم الضريبة")
    tax_type = models.CharField(max_length=20, choices=TaxType.choices, default=TaxType.VAT, verbose_name="نوع الضريبة")
    direction = models.CharField(max_length=20, choices=TaxDirection.choices, default=TaxDirection.OUTPUT, verbose_name="اتجاه الضريبة")
    rate = models.DecimalField(max_digits=7, decimal_places=4, default=Decimal("15.0000"), verbose_name="النسبة")
    sales_account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="tax_sales_rates", null=True, blank=True, verbose_name="حساب ضريبة المبيعات")
    purchase_account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="tax_purchase_rates", null=True, blank=True, verbose_name="حساب ضريبة المشتريات")
    is_active = models.BooleanField(default=True, verbose_name="نشطة")
    is_default = models.BooleanField(default=False, verbose_name="افتراضية")
    description = models.TextField(blank=True, verbose_name="الوصف")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")

    class Meta:
        db_table = "accounting_tax_rates"
        verbose_name = "ضريبة"
        verbose_name_plural = "الضرائب"
        ordering = ["code"]
        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["tax_type"]),
            models.Index(fields=["direction"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["is_default"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"

    def clean(self):
        super().clean()
        self.code = _normalise_code(self.code)
        self.name = str(self.name or "").strip()
        self.rate = Decimal(str(self.rate or "0.0000")).quantize(Decimal("0.0001"))

        if not self.code:
            raise ValidationError({"code": "كود الضريبة مطلوب."})

        if not self.name:
            raise ValidationError({"name": "اسم الضريبة مطلوب."})

        if self.rate < Decimal("0.0000"):
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
    default_currency = models.CharField(max_length=10, default="SAR", verbose_name="العملة الافتراضية")
    default_tax_rate = models.ForeignKey(TaxRate, on_delete=models.SET_NULL, null=True, blank=True, related_name="default_in_settings", verbose_name="الضريبة الافتراضية")
    auto_post_invoices = models.BooleanField(default=True, verbose_name="ترحيل الفواتير تلقائيًا")
    auto_post_payments = models.BooleanField(default=True, verbose_name="ترحيل المدفوعات تلقائيًا")
    auto_post_treasury = models.BooleanField(default=False, verbose_name="ترحيل الخزينة تلقائيًا")

    auto_post_cod_custody = models.BooleanField(default=True, verbose_name="ترحيل عهد COD تلقائيًا")
    auto_post_agent_earnings = models.BooleanField(default=True, verbose_name="ترحيل استحقاقات المندوبين تلقائيًا")
    auto_post_broker_earnings = models.BooleanField(default=True, verbose_name="ترحيل استحقاقات الوسطاء تلقائيًا")
    auto_post_agent_settlements = models.BooleanField(default=True, verbose_name="ترحيل تسويات المندوبين تلقائيًا")
    auto_post_broker_settlements = models.BooleanField(default=True, verbose_name="ترحيل تسويات الوسطاء تلقائيًا")

    require_period_for_posting = models.BooleanField(default=False, verbose_name="إلزام الفترة عند الترحيل")
    allow_posting_without_cost_center = models.BooleanField(default=True, verbose_name="السماح بالترحيل بدون مركز تكلفة")
    metadata = models.JSONField(default=dict, blank=True, verbose_name="بيانات إضافية")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")

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
    source = models.CharField(max_length=50, choices=AccountingRoutingSource.choices, verbose_name="مصدر العملية")
    purpose = models.CharField(max_length=80, choices=AccountingAccountPurpose.choices, verbose_name="الغرض المحاسبي")
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="routing_rules", verbose_name="الحساب")
    tax_rate = models.ForeignKey(TaxRate, on_delete=models.SET_NULL, null=True, blank=True, related_name="routing_rules", verbose_name="الضريبة")
    cost_center = models.ForeignKey(CostCenter, on_delete=models.SET_NULL, null=True, blank=True, related_name="routing_rules", verbose_name="مركز التكلفة")
    is_active = models.BooleanField(default=True, verbose_name="نشطة")
    priority = models.PositiveIntegerField(default=100, verbose_name="الأولوية")
    description = models.TextField(blank=True, verbose_name="الوصف")
    metadata = models.JSONField(default=dict, blank=True, verbose_name="بيانات إضافية")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")

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
    entry_number = models.CharField(max_length=100, unique=True, verbose_name="رقم القيد")
    entry_date = models.DateField(verbose_name="تاريخ القيد")
    period = models.ForeignKey(AccountingPeriod, on_delete=models.PROTECT, related_name="journal_entries", null=True, blank=True, verbose_name="الفترة المحاسبية")
    status = models.CharField(max_length=20, choices=JournalEntryStatus.choices, default=JournalEntryStatus.DRAFT, verbose_name="الحالة")
    posting_source = models.CharField(max_length=30, choices=PostingSource.choices, default=PostingSource.MANUAL, verbose_name="مصدر القيد")

    reference = models.CharField(max_length=255, blank=True, verbose_name="مرجع")
    external_reference = models.CharField(max_length=255, blank=True, verbose_name="مرجع خارجي")
    source_type = models.CharField(max_length=80, blank=True, verbose_name="نوع المصدر")
    source_id = models.CharField(max_length=80, blank=True, verbose_name="معرف المصدر")
    source_number = models.CharField(max_length=120, blank=True, verbose_name="رقم المصدر")

    description = models.TextField(blank=True, verbose_name="الوصف")
    notes = models.TextField(blank=True, verbose_name="ملاحظات")
    currency = models.CharField(max_length=10, default="SAR", verbose_name="العملة")

    is_auto_posted = models.BooleanField(default=False, verbose_name="قيد آلي")
    posted_at = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ الترحيل")
    posted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name="posted_journal_entries", null=True, blank=True, verbose_name="رحل بواسطة")

    cancelled_at = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ الإلغاء")
    cancelled_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name="cancelled_journal_entries", null=True, blank=True, verbose_name="ألغي بواسطة")

    reversal_of = models.ForeignKey("self", on_delete=models.SET_NULL, related_name="reversal_entries", null=True, blank=True, verbose_name="عكس القيد")
    reversed_entry = models.ForeignKey("self", on_delete=models.SET_NULL, related_name="legacy_reversed_entries", null=True, blank=True, verbose_name="القيد العكسي")
    reversed_at = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ العكس")

    total_debit = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"), verbose_name="إجمالي المدين")
    total_credit = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"), verbose_name="إجمالي الدائن")

    metadata = models.JSONField(default=dict, blank=True, verbose_name="بيانات إضافية")

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name="created_journal_entries", null=True, blank=True, verbose_name="أنشئ بواسطة")
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name="updated_journal_entries", null=True, blank=True, verbose_name="آخر تعديل بواسطة")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")

    class Meta:
        db_table = "accounting_journal_entries"
        verbose_name = "قيد يومية"
        verbose_name_plural = "قيود اليومية"
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
            models.Index(fields=["reversal_of"]),
            models.Index(fields=["reversed_entry"]),
            models.Index(fields=["status", "entry_date"]),
            models.Index(fields=["source_type", "source_id"]),
        ]

    def __str__(self):
        return f"{self.entry_number} - {self.entry_date}"

    @property
    def is_posted(self) -> bool:
        return self.status == JournalEntryStatus.POSTED

    @property
    def is_draft(self) -> bool:
        return self.status == JournalEntryStatus.DRAFT

    @property
    def is_cancelled(self) -> bool:
        return self.status == JournalEntryStatus.CANCELLED

    @property
    def is_reversed(self) -> bool:
        return self.status == JournalEntryStatus.REVERSED

    @property
    def is_balanced(self) -> bool:
        return money(self.total_debit) == money(self.total_credit)

    @property
    def can_edit(self) -> bool:
        return self.status == JournalEntryStatus.DRAFT

    def clean(self):
        super().clean()
        self.entry_number = _normalise_code(self.entry_number)
        self.currency = _normalise_currency(self.currency)
        self.total_debit = money(self.total_debit)
        self.total_credit = money(self.total_credit)

        if not self.entry_number:
            raise ValidationError({"entry_number": "رقم القيد مطلوب."})

        if not self.entry_date:
            raise ValidationError({"entry_date": "تاريخ القيد مطلوب."})

        if self.period_id and not self.period.can_post:
            raise ValidationError({"period": "لا يمكن الترحيل في فترة غير مفتوحة."})

        if self.status == JournalEntryStatus.POSTED:
            if not self.posted_at:
                self.posted_at = timezone.now()

            if not self.is_balanced:
                raise ValidationError("لا يمكن ترحيل قيد غير متوازن.")

            if self.total_debit <= Decimal("0.00"):
                raise ValidationError("لا يمكن ترحيل قيد بدون مبالغ.")

        if self.status in {JournalEntryStatus.CANCELLED, JournalEntryStatus.REVERSED}:
            if not self.cancelled_at:
                self.cancelled_at = timezone.now()

        if self.status == JournalEntryStatus.REVERSED and not self.reversed_at:
            self.reversed_at = timezone.now()

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def update_totals(self):
        totals = self.lines.aggregate(
            debit=models.Sum("debit_amount"),
            credit=models.Sum("credit_amount"),
        )

        self.total_debit = money(totals.get("debit") or "0.00")
        self.total_credit = money(totals.get("credit") or "0.00")

        super().save(update_fields=["total_debit", "total_credit", "updated_at"])

    def post(self, *, actor=None):
        self.update_totals()

        if not self.is_balanced:
            raise ValidationError("لا يمكن ترحيل قيد غير متوازن.")

        if self.total_debit <= Decimal("0.00"):
            raise ValidationError("لا يمكن ترحيل قيد بدون مبالغ.")

        self.status = JournalEntryStatus.POSTED
        self.posted_at = timezone.now()

        if actor is not None and getattr(actor, "is_authenticated", False):
            self.posted_by = actor

        self.save(update_fields=["status", "posted_at", "posted_by", "total_debit", "total_credit", "updated_at"])

    def cancel(self, *, actor=None):
        if self.status == JournalEntryStatus.POSTED:
            self.status = JournalEntryStatus.CANCELLED
            self.cancelled_at = timezone.now()

            if actor is not None and getattr(actor, "is_authenticated", False):
                self.cancelled_by = actor

            self.save(update_fields=["status", "cancelled_at", "cancelled_by", "updated_at"])
            return

        raise ValidationError("لا يمكن إلغاء قيد غير مرحل.")


# ============================================================
# 🧾 JournalEntryLine | أسطر القيود
# ============================================================

class JournalEntryLine(models.Model):
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name="lines", verbose_name="القيد")
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="journal_lines", verbose_name="الحساب")
    description = models.TextField(blank=True, verbose_name="الوصف")
    debit_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"), verbose_name="مدين")
    credit_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"), verbose_name="دائن")
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"), verbose_name="مبلغ الضريبة")
    currency = models.CharField(max_length=10, default="SAR", verbose_name="العملة")
    cost_center = models.ForeignKey(CostCenter, on_delete=models.SET_NULL, related_name="journal_lines", null=True, blank=True, verbose_name="مركز التكلفة")
    tax_rate = models.ForeignKey(TaxRate, on_delete=models.SET_NULL, related_name="journal_lines", null=True, blank=True, verbose_name="الضريبة")

    party_type = models.CharField(max_length=80, blank=True, verbose_name="نوع الطرف")
    party_id = models.CharField(max_length=80, blank=True, verbose_name="معرف الطرف")
    source_line_id = models.CharField(max_length=120, blank=True, verbose_name="معرف السطر من المصدر")
    sort_order = models.PositiveIntegerField(default=0, verbose_name="ترتيب السطر")
    metadata = models.JSONField(default=dict, blank=True, verbose_name="بيانات إضافية")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")

    class Meta:
        db_table = "accounting_journal_entry_lines"
        verbose_name = "سطر قيد"
        verbose_name_plural = "أسطر القيود"
        ordering = ["journal_entry", "sort_order", "id"]
        indexes = [
            models.Index(fields=["journal_entry"]),
            models.Index(fields=["account"]),
            models.Index(fields=["cost_center"]),
            models.Index(fields=["tax_rate"]),
            models.Index(fields=["party_type"]),
            models.Index(fields=["party_id"]),
            models.Index(fields=["source_line_id"]),
            models.Index(fields=["sort_order"]),
        ]

    def __str__(self):
        return f"{self.journal_entry.entry_number} - {self.account.code}"

    @property
    def entry(self):
        return self.journal_entry

    def clean(self):
        super().clean()
        self.currency = _normalise_currency(self.currency)
        self.debit_amount = money(self.debit_amount)
        self.credit_amount = money(self.credit_amount)
        self.tax_amount = money(self.tax_amount)

        if not self.account_id:
            raise ValidationError({"account": "الحساب مطلوب."})

        if self.account and not self.account.can_post:
            raise ValidationError({"account": "لا يمكن الترحيل على حساب تجميعي أو غير نشط."})

        if self.debit_amount > 0 and self.credit_amount > 0:
            raise ValidationError("لا يمكن أن يحتوي سطر القيد على مدين ودائن في نفس الوقت.")

        if self.debit_amount <= 0 and self.credit_amount <= 0:
            raise ValidationError("يجب أن يحتوي سطر القيد على مبلغ مدين أو دائن.")

        if self.tax_amount < Decimal("0.00"):
            raise ValidationError({"tax_amount": "مبلغ الضريبة لا يمكن أن يكون سالبًا."})

        if self.journal_entry_id and self.journal_entry.status != JournalEntryStatus.DRAFT:
            raise ValidationError("لا يمكن تعديل أسطر قيد غير مسودة.")

        if self.cost_center and not self.cost_center.can_post:
            raise ValidationError({"cost_center": "مركز التكلفة غير نشط أو تجميعي."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
        self.journal_entry.update_totals()

    def delete(self, *args, **kwargs):
        journal_entry = self.journal_entry
        super().delete(*args, **kwargs)
        journal_entry.update_totals()


# ============================================================
# 🧾 TaxTransaction | حركة ضريبية
# ============================================================

class TaxTransaction(models.Model):
    tax_rate = models.ForeignKey(TaxRate, on_delete=models.PROTECT, related_name="tax_transactions", verbose_name="الضريبة")
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.PROTECT, related_name="tax_transactions", null=True, blank=True, verbose_name="القيد المحاسبي")
    journal_line = models.ForeignKey(JournalEntryLine, on_delete=models.PROTECT, related_name="tax_transactions", null=True, blank=True, verbose_name="سطر القيد")
    direction = models.CharField(max_length=20, choices=TaxDirection.choices, verbose_name="اتجاه الضريبة")
    transaction_date = models.DateField(verbose_name="تاريخ الحركة")
    taxable_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"), verbose_name="المبلغ الخاضع للضريبة")
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"), verbose_name="مبلغ الضريبة")
    currency = models.CharField(max_length=10, default="SAR", verbose_name="العملة")
    source_type = models.CharField(max_length=80, blank=True, verbose_name="نوع المصدر")
    source_id = models.CharField(max_length=80, blank=True, verbose_name="معرف المصدر")
    source_number = models.CharField(max_length=120, blank=True, verbose_name="رقم المصدر")
    description = models.TextField(blank=True, verbose_name="الوصف")
    metadata = models.JSONField(default=dict, blank=True, verbose_name="بيانات إضافية")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")

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

        if not self.tax_rate_id:
            raise ValidationError({"tax_rate": "الضريبة مطلوبة."})

        if not self.transaction_date:
            raise ValidationError({"transaction_date": "تاريخ الحركة الضريبية مطلوب."})

        self.taxable_amount = money(self.taxable_amount)
        self.tax_amount = money(self.tax_amount)
        self.currency = _normalise_currency(self.currency)
        self.source_type = str(self.source_type or "").strip()
        self.source_id = str(self.source_id or "").strip()
        self.source_number = str(self.source_number or "").strip()
        self.description = str(self.description or "").strip()

        if self.taxable_amount < Decimal("0.00"):
            raise ValidationError({"taxable_amount": "المبلغ الخاضع للضريبة لا يمكن أن يكون سالبًا."})

        if self.tax_amount < Decimal("0.00"):
            raise ValidationError({"tax_amount": "مبلغ الضريبة لا يمكن أن يكون سالبًا."})

        if self.journal_line_id and self.journal_entry_id:
            if self.journal_line.journal_entry_id != self.journal_entry_id:
                raise ValidationError({"journal_line": "سطر القيد لا يتبع القيد المحاسبي المحدد."})

        if self.journal_line_id and self.journal_line.tax_rate_id:
            if self.journal_line.tax_rate_id != self.tax_rate_id:
                raise ValidationError({"tax_rate": "الضريبة لا تطابق الضريبة المرتبطة بسطر القيد."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)