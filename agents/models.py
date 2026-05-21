# ============================================================
# 📂 agents/models.py
# 🧠 Primey Care | Agents, Brokers & Financial Entries Module V3.0
# ------------------------------------------------------------
# ✅ المندوبين
# ✅ الوسطاء / الوكلاء
# ✅ أكواد الإحالة
# ✅ ربط المندوب بمستخدم النظام
# ✅ ربط الوسيط بمستخدم النظام
# ✅ ربط الطلبات بالمندوبين والوسطاء
# ✅ قواعد عمولات متعددة حسب:
#    - المنتج
#    - نوع المنتج
#    - العقد
#    - مقدم الخدمة
#    - نوع العملية
# ✅ دعم:
#    - حصة النظام
#    - حصة الوسيط
#    - عمولة مندوب البيع
#    - قيمة توصيل مندوب التوصيل
#    - عهدة COD
#    - توريدات نقدية
#    - خصومات / بونص / تسويات
# ✅ تتبع الاستحقاق / الاعتماد / الصرف
# ✅ جاهز للربط مع Accounting / Treasury / Orders
# ------------------------------------------------------------
# القاعدة المالية المعتمدة:
# - تحصيل COD لا يعني دخول النقد إلى خزينة الشركة مباشرة.
# - الكاش المحصل يصبح عهدة على من حصّله فعليًا.
# - مندوب البيع ومندوب التوصيل قد يكونان شخصين مختلفين.
# - الوسيط قد يكون له مناديب وحصة مستقلة.
# - كل بند مالي يجب أن يظهر في كشف حساب الطرف ويُرحّل محاسبيًا.
# ============================================================

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from customers.models import Customer
from orders.models import Order
from payments.models import Payment


MONEY_ZERO = Decimal("0.00")
MONEY_QUANT = Decimal("0.01")


def money(value) -> Decimal:
    return Decimal(str(value or "0.00")).quantize(
        MONEY_QUANT,
        rounding=ROUND_HALF_UP,
    )


# ============================================================
# 🔹 Shared Choices
# ============================================================

class AgentStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "نشط"
    INACTIVE = "INACTIVE", "غير نشط"
    SUSPENDED = "SUSPENDED", "موقوف"
    DRAFT = "DRAFT", "مسودة"


class BrokerStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "نشط"
    INACTIVE = "INACTIVE", "غير نشط"
    SUSPENDED = "SUSPENDED", "موقوف"
    DRAFT = "DRAFT", "مسودة"


class CommissionType(models.TextChoices):
    PERCENTAGE = "PERCENTAGE", "نسبة مئوية"
    FIXED = "FIXED", "مبلغ ثابت"


class CommissionStatus(models.TextChoices):
    PENDING = "PENDING", "قيد الانتظار"
    EARNED = "EARNED", "مستحقة"
    APPROVED = "APPROVED", "معتمدة"
    PAID = "PAID", "مدفوعة"
    CANCELLED = "CANCELLED", "ملغاة"
    REVERSED = "REVERSED", "معكوسة"


class FinancialRuleType(models.TextChoices):
    PLATFORM_SHARE = "PLATFORM_SHARE", "حصة النظام"
    BROKER_SHARE = "BROKER_SHARE", "حصة الوسيط"
    SALES_COMMISSION = "SALES_COMMISSION", "عمولة بيع"
    DELIVERY_FEE = "DELIVERY_FEE", "قيمة توصيل"
    COD_COLLECTION = "COD_COLLECTION", "عمولة تحصيل COD"
    PROVIDER_CONTRACT_COMMISSION = "PROVIDER_CONTRACT_COMMISSION", "عمولة عقد مقدم خدمة"
    BONUS = "BONUS", "بونص"
    DEDUCTION = "DEDUCTION", "خصم"
    ADJUSTMENT = "ADJUSTMENT", "تسوية"
    OTHER = "OTHER", "أخرى"


class FinancialRuleScope(models.TextChoices):
    GLOBAL = "GLOBAL", "عام"
    PRODUCT_TYPE = "PRODUCT_TYPE", "حسب نوع المنتج"
    PRODUCT = "PRODUCT", "حسب المنتج"
    CONTRACT = "CONTRACT", "حسب العقد"
    CONTRACT_PRODUCT = "CONTRACT_PRODUCT", "حسب عرض مقدم الخدمة"
    PROVIDER = "PROVIDER", "حسب مقدم الخدمة"
    ORDER_KIND = "ORDER_KIND", "حسب نوع الطلب"
    OTHER = "OTHER", "أخرى"


class CalculationType(models.TextChoices):
    PERCENTAGE = "PERCENTAGE", "نسبة"
    FIXED = "FIXED", "مبلغ ثابت"


class CalculationBase(models.TextChoices):
    GROSS_AMOUNT = "GROSS_AMOUNT", "إجمالي المبلغ"
    NET_BEFORE_TAX = "NET_BEFORE_TAX", "الصافي قبل الضريبة"
    TOTAL_WITH_TAX = "TOTAL_WITH_TAX", "الإجمالي شامل الضريبة"
    PLATFORM_SHARE = "PLATFORM_SHARE", "حصة النظام"
    BROKER_SHARE = "BROKER_SHARE", "حصة الوسيط"
    CUSTOM_AMOUNT = "CUSTOM_AMOUNT", "مبلغ مخصص"


class FinancialEntryType(models.TextChoices):
    PLATFORM_SHARE = "PLATFORM_SHARE", "حصة النظام"
    BROKER_SHARE = "BROKER_SHARE", "حصة وسيط"
    SALES_COMMISSION = "SALES_COMMISSION", "عمولة بيع"
    DELIVERY_FEE = "DELIVERY_FEE", "قيمة توصيل"
    COD_CUSTODY = "COD_CUSTODY", "عهدة COD"
    COD_COLLECTION_FEE = "COD_COLLECTION_FEE", "عمولة تحصيل COD"
    PROVIDER_CONTRACT_COMMISSION = "PROVIDER_CONTRACT_COMMISSION", "عمولة عقد مقدم خدمة"
    CASH_SETTLEMENT = "CASH_SETTLEMENT", "توريد نقدي"
    PAYOUT = "PAYOUT", "صرف مستحق"
    BONUS = "BONUS", "بونص"
    DEDUCTION = "DEDUCTION", "خصم"
    ADJUSTMENT = "ADJUSTMENT", "تسوية"
    REVERSAL = "REVERSAL", "عكس"
    OTHER = "OTHER", "أخرى"


class FinancialEntryDirection(models.TextChoices):
    DEBIT = "DEBIT", "مدين على الطرف"
    CREDIT = "CREDIT", "دائن للطرف"


class FinancialEntryStatus(models.TextChoices):
    DRAFT = "DRAFT", "مسودة"
    PENDING = "PENDING", "قيد الانتظار"
    EARNED = "EARNED", "مستحق"
    APPROVED = "APPROVED", "معتمد"
    SETTLED = "SETTLED", "مسوى"
    PAID = "PAID", "مدفوع"
    CANCELLED = "CANCELLED", "ملغى"
    REVERSED = "REVERSED", "معكوس"


class RevenueRecognitionMode(models.TextChoices):
    GROSS_SALE = "GROSS_SALE", "كامل البيع إيراد"
    NET_PLATFORM_SHARE = "NET_PLATFORM_SHARE", "حصة النظام فقط إيراد"


class SettlementMode(models.TextChoices):
    AGENT_LEVEL = "AGENT_LEVEL", "التسوية على مستوى المندوب"
    BROKER_LEVEL = "BROKER_LEVEL", "التسوية على مستوى الوسيط"
    AGENT_WITH_BROKER_SUMMARY = "AGENT_WITH_BROKER_SUMMARY", "تفصيل مندوب مع ملخص وسيط"


# ============================================================
# 🧩 Broker / Agency
# ============================================================

class Broker(models.Model):
    # ========================================================
    # 👤 ربط الوسيط بمستخدم النظام
    # ========================================================
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="broker_profile",
        verbose_name="مستخدم النظام المرتبط",
        help_text="يربط الوسيط بحساب مستخدم نوعه BROKER عند الحاجة.",
    )

    # ========================================================
    # 🆔 بيانات الوسيط
    # ========================================================
    name = models.CharField(
        max_length=255,
        verbose_name="اسم الوسيط",
    )

    broker_code = models.CharField(
        max_length=50,
        unique=True,
        verbose_name="كود الوسيط",
    )

    referral_code = models.CharField(
        max_length=50,
        unique=True,
        verbose_name="كود إحالة الوسيط",
        help_text="يستخدم عند ربط الطلبات أو الفرق بالوسيط.",
    )

    status = models.CharField(
        max_length=20,
        choices=BrokerStatus.choices,
        default=BrokerStatus.ACTIVE,
        db_index=True,
        verbose_name="الحالة",
    )

    # ========================================================
    # 📞 بيانات التواصل
    # ========================================================
    phone = models.CharField(
        max_length=30,
        blank=True,
        db_index=True,
        verbose_name="رقم الجوال",
    )

    email = models.EmailField(
        blank=True,
        db_index=True,
        verbose_name="البريد الإلكتروني",
    )

    city = models.CharField(
        max_length=100,
        blank=True,
        db_index=True,
        verbose_name="المدينة",
    )

    address = models.TextField(
        blank=True,
        verbose_name="العنوان",
    )

    # ========================================================
    # 💰 إعدادات مالية عامة
    # ========================================================
    default_commission_type = models.CharField(
        max_length=20,
        choices=CommissionType.choices,
        default=CommissionType.FIXED,
        verbose_name="نوع عمولة الوسيط الافتراضية",
    )

    default_commission_value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=MONEY_ZERO,
        verbose_name="قيمة عمولة الوسيط الافتراضية",
    )

    revenue_recognition_mode = models.CharField(
        max_length=30,
        choices=RevenueRecognitionMode.choices,
        default=RevenueRecognitionMode.GROSS_SALE,
        db_index=True,
        verbose_name="طريقة الاعتراف بالإيراد",
        help_text="هل كامل البيع إيراد للشركة أم حصة النظام فقط.",
    )

    settlement_mode = models.CharField(
        max_length=40,
        choices=SettlementMode.choices,
        default=SettlementMode.AGENT_WITH_BROKER_SUMMARY,
        db_index=True,
        verbose_name="طريقة التسوية",
        help_text="تحدد هل العهدة والتسوية على المندوب أم الوسيط.",
    )

    # ========================================================
    # 🏦 بيانات مالية
    # ========================================================
    bank_name = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="اسم البنك",
    )

    bank_account_name = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="اسم صاحب الحساب",
    )

    iban = models.CharField(
        max_length=34,
        blank=True,
        verbose_name="IBAN",
    )

    # ========================================================
    # 📝 ملاحظات وامتدادات
    # ========================================================
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
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="brokers_created",
        verbose_name="أنشئ بواسطة",
    )

    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="brokers_updated",
        verbose_name="آخر تعديل بواسطة",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="تاريخ الإنشاء",
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="آخر تحديث",
    )

    class Meta:
        db_table = "brokers"
        verbose_name = "وسيط"
        verbose_name_plural = "الوسطاء"
        ordering = ["name"]
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["broker_code"]),
            models.Index(fields=["referral_code"]),
            models.Index(fields=["status"]),
            models.Index(fields=["city"]),
            models.Index(fields=["phone"]),
            models.Index(fields=["email"]),
            models.Index(fields=["revenue_recognition_mode"]),
            models.Index(fields=["settlement_mode"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.broker_code})"

    @property
    def display_name(self) -> str:
        return self.name

    @property
    def is_active(self) -> bool:
        return self.status == BrokerStatus.ACTIVE

    def clean(self):
        super().clean()

        self.name = (self.name or "").strip()
        self.broker_code = (self.broker_code or "").strip().upper()
        self.referral_code = (self.referral_code or "").strip().upper()
        self.phone = (self.phone or "").strip()
        self.email = (self.email or "").strip().lower()
        self.city = (self.city or "").strip()
        self.address = (self.address or "").strip()
        self.bank_name = (self.bank_name or "").strip()
        self.bank_account_name = (self.bank_account_name or "").strip()
        self.iban = (self.iban or "").strip().replace(" ", "").upper()
        self.notes = (self.notes or "").strip()
        self.default_commission_value = money(self.default_commission_value)

        if not self.name:
            raise ValidationError({"name": "اسم الوسيط مطلوب."})

        if not self.broker_code:
            raise ValidationError({"broker_code": "كود الوسيط مطلوب."})

        if not self.referral_code:
            raise ValidationError({"referral_code": "كود إحالة الوسيط مطلوب."})

        if self.default_commission_value < MONEY_ZERO:
            raise ValidationError(
                {"default_commission_value": "قيمة العمولة لا يمكن أن تكون سالبة."}
            )

        if (
            self.default_commission_type == CommissionType.PERCENTAGE
            and self.default_commission_value > Decimal("100.00")
        ):
            raise ValidationError(
                {"default_commission_value": "النسبة المئوية يجب أن تكون بين 0 و 100."}
            )

    def save(self, *args, **kwargs):
        self.default_commission_value = money(self.default_commission_value)
        self.full_clean()
        super().save(*args, **kwargs)


# ============================================================
# 🧩 Agent
# ============================================================

class Agent(models.Model):
    # ========================================================
    # 👤 ربط المندوب بمستخدم النظام
    # ========================================================
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_profile",
        verbose_name="مستخدم النظام المرتبط",
        help_text="يربط المندوب بحساب مستخدم حتى يتم التعرف عليه تلقائيًا عند إنشاء الطلب.",
    )

    # ========================================================
    # 🤝 الوسيط التابع له
    # ========================================================
    broker = models.ForeignKey(
        Broker,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agents",
        verbose_name="الوسيط",
        help_text="إذا كان المندوب تابعًا لوسيط أو وكيل.",
    )

    # ========================================================
    # 🆔 بيانات المندوب الأساسية
    # ========================================================
    full_name = models.CharField(
        max_length=255,
        verbose_name="اسم المندوب",
    )

    agent_code = models.CharField(
        max_length=50,
        unique=True,
        verbose_name="كود المندوب",
        help_text="كود داخلي أو تسويقي فريد للمندوب",
    )

    referral_code = models.CharField(
        max_length=50,
        unique=True,
        verbose_name="كود الإحالة",
        help_text="الكود الذي يستخدم في البيع أو الإحالة",
    )

    status = models.CharField(
        max_length=20,
        choices=AgentStatus.choices,
        default=AgentStatus.ACTIVE,
        db_index=True,
        verbose_name="الحالة",
    )

    # ========================================================
    # 📞 بيانات التواصل
    # ========================================================
    phone = models.CharField(
        max_length=30,
        blank=True,
        db_index=True,
        verbose_name="رقم الجوال",
    )

    email = models.EmailField(
        blank=True,
        db_index=True,
        verbose_name="البريد الإلكتروني",
    )

    city = models.CharField(
        max_length=100,
        blank=True,
        db_index=True,
        verbose_name="المدينة",
    )

    address = models.TextField(
        blank=True,
        verbose_name="العنوان",
    )

    # ========================================================
    # 💰 إعداد العمولة الافتراضية
    # ========================================================
    default_commission_type = models.CharField(
        max_length=20,
        choices=CommissionType.choices,
        default=CommissionType.PERCENTAGE,
        verbose_name="نوع العمولة الافتراضي",
    )

    default_commission_value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=MONEY_ZERO,
        verbose_name="قيمة العمولة الافتراضية",
        help_text="نسبة مئوية أو مبلغ ثابت حسب النوع المحدد",
    )

    default_delivery_fee = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=MONEY_ZERO,
        verbose_name="قيمة التوصيل الافتراضية",
        help_text="تستخدم كقيمة افتراضية إذا كان المندوب هو مندوب التوصيل ولم توجد قاعدة خاصة.",
    )

    # ========================================================
    # 🏦 بيانات مالية
    # ========================================================
    bank_name = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="اسم البنك",
    )

    bank_account_name = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="اسم صاحب الحساب",
    )

    iban = models.CharField(
        max_length=34,
        blank=True,
        verbose_name="IBAN",
    )

    # ========================================================
    # 📝 ملاحظات
    # ========================================================
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
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agents_created",
        verbose_name="أنشئ بواسطة",
    )

    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agents_updated",
        verbose_name="آخر تعديل بواسطة",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="تاريخ الإنشاء",
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="آخر تحديث",
    )

    class Meta:
        db_table = "agents"
        verbose_name = "مندوب"
        verbose_name_plural = "المندوبون"
        ordering = ["full_name"]
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["broker"]),
            models.Index(fields=["agent_code"]),
            models.Index(fields=["referral_code"]),
            models.Index(fields=["status"]),
            models.Index(fields=["city"]),
            models.Index(fields=["phone"]),
            models.Index(fields=["email"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.full_name} ({self.agent_code})"

    # ========================================================
    # 🔹 Compatibility Properties
    # ========================================================
    @property
    def display_name(self) -> str:
        return self.full_name

    @property
    def name(self) -> str:
        return self.full_name

    @property
    def phone_number(self) -> str:
        return self.phone

    @property
    def code(self) -> str:
        return self.agent_code

    @property
    def is_active(self) -> bool:
        return self.status == AgentStatus.ACTIVE

    @property
    def broker_name(self) -> str:
        return self.broker.name if self.broker_id else ""

    def clean(self):
        super().clean()

        self.full_name = (self.full_name or "").strip()
        self.agent_code = (self.agent_code or "").strip().upper()
        self.referral_code = (self.referral_code or "").strip().upper()
        self.phone = (self.phone or "").strip()
        self.email = (self.email or "").strip().lower()
        self.city = (self.city or "").strip()
        self.address = (self.address or "").strip()
        self.bank_name = (self.bank_name or "").strip()
        self.bank_account_name = (self.bank_account_name or "").strip()
        self.iban = (self.iban or "").strip().replace(" ", "").upper()
        self.notes = (self.notes or "").strip()
        self.default_commission_value = money(self.default_commission_value)
        self.default_delivery_fee = money(self.default_delivery_fee)

        if not self.full_name:
            raise ValidationError({"full_name": "اسم المندوب مطلوب."})

        if not self.agent_code:
            raise ValidationError({"agent_code": "كود المندوب مطلوب."})

        if not self.referral_code:
            raise ValidationError({"referral_code": "كود الإحالة مطلوب."})

        if self.broker_id and self.broker.status != BrokerStatus.ACTIVE:
            raise ValidationError({"broker": "لا يمكن ربط المندوب بوسيط غير نشط."})

        if self.default_commission_value < MONEY_ZERO:
            raise ValidationError(
                {"default_commission_value": "قيمة العمولة لا يمكن أن تكون سالبة."}
            )

        if self.default_delivery_fee < MONEY_ZERO:
            raise ValidationError(
                {"default_delivery_fee": "قيمة التوصيل لا يمكن أن تكون سالبة."}
            )

        if (
            self.default_commission_type == CommissionType.PERCENTAGE
            and self.default_commission_value > Decimal("100.00")
        ):
            raise ValidationError(
                {"default_commission_value": "النسبة المئوية يجب أن تكون بين 0 و 100."}
            )

    def save(self, *args, **kwargs):
        self.default_commission_value = money(self.default_commission_value)
        self.default_delivery_fee = money(self.default_delivery_fee)
        self.full_clean()
        super().save(*args, **kwargs)


# ============================================================
# 🧩 Agent Financial Rule
# ============================================================

class AgentFinancialRule(models.Model):
    # ========================================================
    # 🔗 صاحب القاعدة
    # ========================================================
    broker = models.ForeignKey(
        Broker,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="financial_rules",
        verbose_name="الوسيط",
        help_text="إذا كانت القاعدة خاصة بوسيط.",
    )

    agent = models.ForeignKey(
        Agent,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="financial_rules",
        verbose_name="المندوب",
        help_text="إذا كانت القاعدة خاصة بمندوب معين.",
    )

    # ========================================================
    # 🧾 نوع القاعدة ونطاقها
    # ========================================================
    rule_name = models.CharField(
        max_length=255,
        verbose_name="اسم القاعدة",
    )

    rule_type = models.CharField(
        max_length=50,
        choices=FinancialRuleType.choices,
        db_index=True,
        verbose_name="نوع القاعدة",
    )

    scope = models.CharField(
        max_length=50,
        choices=FinancialRuleScope.choices,
        default=FinancialRuleScope.GLOBAL,
        db_index=True,
        verbose_name="نطاق القاعدة",
    )

    # ========================================================
    # 🎯 شروط المطابقة
    # ========================================================
    product = models.ForeignKey(
        "products.Product",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_financial_rules",
        verbose_name="المنتج",
    )

    product_type = models.CharField(
        max_length=50,
        blank=True,
        db_index=True,
        verbose_name="نوع المنتج",
    )

    contract = models.ForeignKey(
        "contracts.Contract",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_financial_rules",
        verbose_name="العقد",
    )

    contract_product = models.ForeignKey(
        "contracts.ContractProduct",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_financial_rules",
        verbose_name="عرض مقدم الخدمة",
    )

    provider = models.ForeignKey(
        "providers.Provider",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_financial_rules",
        verbose_name="مقدم الخدمة",
    )

    order_kind = models.CharField(
        max_length=50,
        blank=True,
        db_index=True,
        verbose_name="نوع الطلب",
    )

    # ========================================================
    # 💰 طريقة الحساب
    # ========================================================
    calculation_type = models.CharField(
        max_length=20,
        choices=CalculationType.choices,
        default=CalculationType.FIXED,
        verbose_name="طريقة الحساب",
    )

    calculation_base = models.CharField(
        max_length=40,
        choices=CalculationBase.choices,
        default=CalculationBase.NET_BEFORE_TAX,
        verbose_name="أساس الحساب",
    )

    value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=MONEY_ZERO,
        verbose_name="القيمة",
        help_text="نسبة أو مبلغ ثابت حسب طريقة الحساب.",
    )

    min_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=MONEY_ZERO,
        verbose_name="حد أدنى اختياري",
    )

    max_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="حد أعلى اختياري",
    )

    priority = models.PositiveIntegerField(
        default=100,
        db_index=True,
        verbose_name="الأولوية",
        help_text="الأولوية الأقل رقمًا تطبق أولًا عند تعدد القواعد.",
    )

    # ========================================================
    # 📅 صلاحية القاعدة
    # ========================================================
    valid_from = models.DateField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="صالحة من",
    )

    valid_until = models.DateField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="صالحة حتى",
    )

    is_active = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name="نشطة",
    )

    # ========================================================
    # 📝 ملاحظات وامتدادات
    # ========================================================
    notes = models.TextField(
        blank=True,
        verbose_name="ملاحظات",
    )

    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بيانات إضافية",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="تاريخ الإنشاء",
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="آخر تحديث",
    )

    class Meta:
        db_table = "agent_financial_rules"
        verbose_name = "قاعدة مالية للمندوب/الوسيط"
        verbose_name_plural = "القواعد المالية للمندوبين والوسطاء"
        ordering = ["priority", "-created_at"]
        indexes = [
            models.Index(fields=["broker"]),
            models.Index(fields=["agent"]),
            models.Index(fields=["rule_type"]),
            models.Index(fields=["scope"]),
            models.Index(fields=["product"]),
            models.Index(fields=["product_type"]),
            models.Index(fields=["contract"]),
            models.Index(fields=["contract_product"]),
            models.Index(fields=["provider"]),
            models.Index(fields=["order_kind"]),
            models.Index(fields=["calculation_type"]),
            models.Index(fields=["calculation_base"]),
            models.Index(fields=["priority"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["valid_from", "valid_until"]),
        ]

    def __str__(self) -> str:
        owner = self.agent or self.broker or "عام"
        return f"{self.rule_name} - {owner}"

    @property
    def is_percentage(self) -> bool:
        return self.calculation_type == CalculationType.PERCENTAGE

    @property
    def is_fixed(self) -> bool:
        return self.calculation_type == CalculationType.FIXED

    def clean(self):
        super().clean()

        self.rule_name = (self.rule_name or "").strip()
        self.product_type = (self.product_type or "").strip().lower()
        self.order_kind = (self.order_kind or "").strip().lower()
        self.notes = (self.notes or "").strip()
        self.value = money(self.value)
        self.min_amount = money(self.min_amount)

        if self.max_amount is not None:
            self.max_amount = money(self.max_amount)

        if not self.rule_name:
            raise ValidationError({"rule_name": "اسم القاعدة مطلوب."})

        if self.broker_id and self.agent_id and self.agent.broker_id and self.agent.broker_id != self.broker_id:
            raise ValidationError(
                {"agent": "المندوب المحدد لا يتبع الوسيط المحدد."}
            )

        if self.value < MONEY_ZERO:
            raise ValidationError({"value": "قيمة القاعدة لا يمكن أن تكون سالبة."})

        if self.calculation_type == CalculationType.PERCENTAGE and self.value > Decimal("100.00"):
            raise ValidationError({"value": "النسبة يجب أن تكون بين 0 و 100."})

        if self.min_amount < MONEY_ZERO:
            raise ValidationError({"min_amount": "الحد الأدنى لا يمكن أن يكون سالبًا."})

        if self.max_amount is not None and self.max_amount < MONEY_ZERO:
            raise ValidationError({"max_amount": "الحد الأعلى لا يمكن أن يكون سالبًا."})

        if self.max_amount is not None and self.max_amount < self.min_amount:
            raise ValidationError({"max_amount": "الحد الأعلى لا يمكن أن يكون أقل من الحد الأدنى."})

        if self.valid_from and self.valid_until and self.valid_until < self.valid_from:
            raise ValidationError({"valid_until": "تاريخ النهاية لا يمكن أن يكون قبل تاريخ البداية."})

        if self.scope == FinancialRuleScope.PRODUCT and not self.product_id:
            raise ValidationError({"product": "المنتج مطلوب عند اختيار نطاق حسب المنتج."})

        if self.scope == FinancialRuleScope.PRODUCT_TYPE and not self.product_type:
            raise ValidationError({"product_type": "نوع المنتج مطلوب عند اختيار نطاق حسب نوع المنتج."})

        if self.scope == FinancialRuleScope.CONTRACT and not self.contract_id:
            raise ValidationError({"contract": "العقد مطلوب عند اختيار نطاق حسب العقد."})

        if self.scope == FinancialRuleScope.CONTRACT_PRODUCT and not self.contract_product_id:
            raise ValidationError({"contract_product": "عرض مقدم الخدمة مطلوب عند اختيار هذا النطاق."})

        if self.scope == FinancialRuleScope.PROVIDER and not self.provider_id:
            raise ValidationError({"provider": "مقدم الخدمة مطلوب عند اختيار نطاق حسب مقدم الخدمة."})

        if self.scope == FinancialRuleScope.ORDER_KIND and not self.order_kind:
            raise ValidationError({"order_kind": "نوع الطلب مطلوب عند اختيار نطاق حسب نوع الطلب."})

    def save(self, *args, **kwargs):
        self.value = money(self.value)
        self.min_amount = money(self.min_amount)
        if self.max_amount is not None:
            self.max_amount = money(self.max_amount)
        self.full_clean()
        super().save(*args, **kwargs)

    def calculate_amount(self, base_amount) -> Decimal:
        base = money(base_amount)

        if self.calculation_type == CalculationType.PERCENTAGE:
            calculated = money((base * self.value) / Decimal("100.00"))
        else:
            calculated = money(self.value)

        if self.min_amount and calculated < self.min_amount:
            calculated = money(self.min_amount)

        if self.max_amount is not None and calculated > self.max_amount:
            calculated = money(self.max_amount)

        return calculated


# ============================================================
# 🧩 AgentOrder — Legacy Compatible
# ============================================================

class AgentOrder(models.Model):
    # ========================================================
    # 🔗 ربط الطلب بالمندوب
    # ========================================================
    order = models.OneToOneField(
        Order,
        on_delete=models.CASCADE,
        related_name="agent_link",
        verbose_name="الطلب",
    )

    agent = models.ForeignKey(
        Agent,
        on_delete=models.PROTECT,
        related_name="agent_orders",
        verbose_name="المندوب",
    )

    broker = models.ForeignKey(
        Broker,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_orders",
        verbose_name="الوسيط",
        help_text="Snapshot للوسيط وقت ربط الطلب بالمندوب.",
    )

    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="agent_orders",
        verbose_name="العميل",
    )

    # ========================================================
    # 💰 إعداد العمولة المطبقة على هذا الطلب
    # ========================================================
    commission_type = models.CharField(
        max_length=20,
        choices=CommissionType.choices,
        verbose_name="نوع العمولة",
    )

    commission_value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name="قيمة العمولة",
    )

    sales_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=MONEY_ZERO,
        verbose_name="قيمة البيع المحتسبة",
    )

    commission_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=MONEY_ZERO,
        verbose_name="قيمة العمولة المحتسبة",
    )

    # ========================================================
    # 📌 بيانات إضافية
    # ========================================================
    referral_code_used = models.CharField(
        max_length=50,
        blank=True,
        db_index=True,
        verbose_name="كود الإحالة المستخدم",
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
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="تاريخ الإنشاء",
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="آخر تحديث",
    )

    class Meta:
        db_table = "agent_orders"
        verbose_name = "طلب مرتبط بمندوب"
        verbose_name_plural = "الطلبات المرتبطة بالمندوبين"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["agent"]),
            models.Index(fields=["broker"]),
            models.Index(fields=["customer"]),
            models.Index(fields=["commission_type"]),
            models.Index(fields=["referral_code_used"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self) -> str:
        return f"Order #{self.order_id} - {self.agent.full_name}"

    def clean(self):
        super().clean()

        self.referral_code_used = (self.referral_code_used or "").strip().upper()
        self.notes = (self.notes or "").strip()
        self.sales_amount = money(self.sales_amount)
        self.commission_value = money(self.commission_value)
        self.commission_amount = money(self.commission_amount)

        if not self.agent_id:
            raise ValidationError({"agent": "المندوب مطلوب."})

        if not self.order_id:
            raise ValidationError({"order": "الطلب مطلوب."})

        if not self.customer_id:
            raise ValidationError({"customer": "العميل مطلوب."})

        if self.agent_id and self.agent.status != AgentStatus.ACTIVE:
            raise ValidationError({"agent": "لا يمكن ربط الطلب بمندوب غير نشط."})

        if self.broker_id and self.broker.status != BrokerStatus.ACTIVE:
            raise ValidationError({"broker": "لا يمكن ربط الطلب بوسيط غير نشط."})

        if self.agent_id and self.broker_id and self.agent.broker_id and self.agent.broker_id != self.broker_id:
            raise ValidationError(
                {"broker": "الوسيط لا يطابق الوسيط المرتبط بالمندوب."}
            )

        order_customer_id = getattr(self.order, "customer_id", None)
        if self.customer_id and order_customer_id and self.customer_id != order_customer_id:
            raise ValidationError(
                {"customer": "العميل المحدد لا يطابق العميل المرتبط بالطلب."}
            )

        if self.commission_value < MONEY_ZERO:
            raise ValidationError(
                {"commission_value": "قيمة العمولة لا يمكن أن تكون سالبة."}
            )

        if self.sales_amount < MONEY_ZERO:
            raise ValidationError(
                {"sales_amount": "قيمة البيع لا يمكن أن تكون سالبة."}
            )

        if (
            self.commission_type == CommissionType.PERCENTAGE
            and self.commission_value > Decimal("100.00")
        ):
            raise ValidationError(
                {"commission_value": "النسبة المئوية يجب أن تكون بين 0 و 100."}
            )

    def save(self, *args, **kwargs):
        if self.agent_id:
            if not self.broker_id and self.agent.broker_id:
                self.broker = self.agent.broker

            if not self.commission_type:
                self.commission_type = self.agent.default_commission_type

            if self.commission_value is None:
                self.commission_value = self.agent.default_commission_value

            if not self.referral_code_used:
                self.referral_code_used = self.agent.referral_code

        self.sales_amount = money(self.sales_amount)
        self.commission_value = money(self.commission_value)

        self.recalculate_commission_amount()
        self.full_clean()

        super().save(*args, **kwargs)

    def recalculate_commission_amount(self):
        sales_amount = money(self.sales_amount)
        commission_value = money(self.commission_value)

        if self.commission_type == CommissionType.PERCENTAGE:
            amount = (sales_amount * commission_value) / Decimal("100")
        else:
            amount = commission_value

        self.commission_amount = money(amount)


# ============================================================
# 🧩 AgentCommission — Legacy Compatible
# ============================================================

class AgentCommission(models.Model):
    # ========================================================
    # 💸 سجل العمولة
    # ========================================================
    agent_order = models.ForeignKey(
        AgentOrder,
        on_delete=models.CASCADE,
        related_name="commissions",
        verbose_name="طلب المندوب",
    )

    agent = models.ForeignKey(
        Agent,
        on_delete=models.PROTECT,
        related_name="commissions",
        verbose_name="المندوب",
    )

    broker = models.ForeignKey(
        Broker,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="commissions",
        verbose_name="الوسيط",
    )

    order = models.ForeignKey(
        Order,
        on_delete=models.PROTECT,
        related_name="commissions",
        verbose_name="الطلب",
    )

    payment = models.ForeignKey(
        Payment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="commissions",
        verbose_name="الدفع المرتبط",
    )

    commission_status = models.CharField(
        max_length=20,
        choices=CommissionStatus.choices,
        default=CommissionStatus.PENDING,
        db_index=True,
        verbose_name="حالة العمولة",
    )

    base_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=MONEY_ZERO,
        verbose_name="قيمة الأساس",
    )

    commission_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=MONEY_ZERO,
        verbose_name="قيمة العمولة",
    )

    paid_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=MONEY_ZERO,
        verbose_name="المبلغ المصروف",
    )

    # ========================================================
    # 🔗 الربط المحاسبي
    # ========================================================
    journal_entry = models.ForeignKey(
        "accounting.JournalEntry",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_commissions",
        verbose_name="قيد الاستحقاق المحاسبي",
    )

    journal_entry_reference = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="مرجع القيد",
    )

    is_accounting_posted = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="مرحل محاسبيًا",
    )

    posted_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="تاريخ الترحيل المحاسبي",
    )

    earned_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="تاريخ الاستحقاق",
    )

    approved_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="تاريخ الاعتماد",
    )

    paid_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="تاريخ الصرف",
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

    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="تاريخ الإنشاء",
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="آخر تحديث",
    )

    class Meta:
        db_table = "agent_commissions"
        verbose_name = "عمولة مندوب"
        verbose_name_plural = "عمولات المندوبين"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["agent"]),
            models.Index(fields=["broker"]),
            models.Index(fields=["order"]),
            models.Index(fields=["payment"]),
            models.Index(fields=["commission_status"]),
            models.Index(fields=["is_accounting_posted"]),
            models.Index(fields=["journal_entry"]),
            models.Index(fields=["journal_entry_reference"]),
            models.Index(fields=["earned_at"]),
            models.Index(fields=["approved_at"]),
            models.Index(fields=["paid_at"]),
            models.Index(fields=["posted_at"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.agent.full_name} - {self.order_id} - {self.commission_amount}"

    @property
    def remaining_amount(self) -> Decimal:
        remaining = money(self.commission_amount) - money(self.paid_amount)
        return remaining if remaining > MONEY_ZERO else MONEY_ZERO

    @property
    def accounting_entry_reference(self) -> str:
        return self.journal_entry_reference

    @accounting_entry_reference.setter
    def accounting_entry_reference(self, value: str) -> None:
        self.journal_entry_reference = value or ""

    def sync_from_agent_order(self):
        if not self.agent_order_id:
            return

        self.agent = self.agent_order.agent
        self.order = self.agent_order.order

        if not self.broker_id and self.agent_order.broker_id:
            self.broker = self.agent_order.broker

        if not self.base_amount or self.base_amount == MONEY_ZERO:
            self.base_amount = self.agent_order.sales_amount

        if not self.commission_amount or self.commission_amount == MONEY_ZERO:
            self.commission_amount = self.agent_order.commission_amount

    def clean(self):
        super().clean()

        self.notes = (self.notes or "").strip()
        self.journal_entry_reference = (self.journal_entry_reference or "").strip()
        self.base_amount = money(self.base_amount)
        self.commission_amount = money(self.commission_amount)
        self.paid_amount = money(self.paid_amount)

        if not self.agent_order_id:
            raise ValidationError({"agent_order": "طلب المندوب مطلوب."})

        if self.agent_order_id:
            if self.agent_id and self.agent_order.agent_id != self.agent_id:
                raise ValidationError(
                    {"agent": "المندوب المحدد لا يطابق المندوب المرتبط بطلب المندوب."}
                )

            if self.order_id and self.agent_order.order_id != self.order_id:
                raise ValidationError(
                    {"order": "الطلب المحدد لا يطابق الطلب المرتبط بطلب المندوب."}
                )

        if self.broker_id and self.agent_id and self.agent.broker_id and self.agent.broker_id != self.broker_id:
            raise ValidationError({"broker": "الوسيط لا يطابق وسيط المندوب."})

        if self.payment_id and self.order_id and self.payment.order_id != self.order_id:
            raise ValidationError(
                {"payment": "عملية الدفع المحددة لا تنتمي إلى نفس الطلب."}
            )

        for field_name in ["base_amount", "commission_amount", "paid_amount"]:
            value = getattr(self, field_name)
            if value is not None and value < MONEY_ZERO:
                raise ValidationError({field_name: "القيمة لا يمكن أن تكون سالبة."})

        if money(self.paid_amount) > money(self.commission_amount):
            raise ValidationError(
                {"paid_amount": "المبلغ المصروف لا يمكن أن يكون أكبر من قيمة العمولة."}
            )

        if self.commission_status == CommissionStatus.PAID:
            if money(self.paid_amount) <= MONEY_ZERO:
                raise ValidationError(
                    {"paid_amount": "لا يمكن جعل العمولة مدفوعة بدون مبلغ مصروف."}
                )

            if not self.paid_at:
                self.paid_at = timezone.now()

        if self.commission_status == CommissionStatus.APPROVED and not self.approved_at:
            self.approved_at = timezone.now()

        if self.commission_status in {
            CommissionStatus.EARNED,
            CommissionStatus.APPROVED,
            CommissionStatus.PAID,
        } and not self.earned_at:
            self.earned_at = timezone.now()

        if self.is_accounting_posted and not self.posted_at:
            self.posted_at = timezone.now()

    def save(self, *args, **kwargs):
        self.sync_from_agent_order()

        self.base_amount = money(self.base_amount)
        self.commission_amount = money(self.commission_amount)
        self.paid_amount = money(self.paid_amount)

        if (
            self.commission_status not in {
                CommissionStatus.CANCELLED,
                CommissionStatus.REVERSED,
            }
            and self.commission_amount > MONEY_ZERO
            and self.paid_amount == self.commission_amount
        ):
            self.commission_status = CommissionStatus.PAID
            if not self.paid_at:
                self.paid_at = timezone.now()

        self.full_clean()
        super().save(*args, **kwargs)


# ============================================================
# 🧩 AgentFinancialEntry
# ============================================================

class AgentFinancialEntry(models.Model):
    # ========================================================
    # 👥 الطرف
    # ========================================================
    agent = models.ForeignKey(
        Agent,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="financial_entries",
        verbose_name="المندوب",
    )

    broker = models.ForeignKey(
        Broker,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="financial_entries",
        verbose_name="الوسيط",
    )

    # ========================================================
    # 🔗 مصادر تشغيلية
    # ========================================================
    order = models.ForeignKey(
        Order,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_financial_entries",
        verbose_name="الطلب",
    )

    payment = models.ForeignKey(
        Payment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_financial_entries",
        verbose_name="الدفع",
    )

    commission = models.ForeignKey(
        AgentCommission,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="financial_entries",
        verbose_name="العمولة القديمة المرتبطة",
    )

    rule = models.ForeignKey(
        AgentFinancialRule,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="financial_entries",
        verbose_name="القاعدة المالية",
    )

    # ========================================================
    # 🧾 بيانات السطر المالي
    # ========================================================
    entry_number = models.CharField(
        max_length=100,
        unique=True,
        verbose_name="رقم السطر المالي",
    )

    entry_type = models.CharField(
        max_length=50,
        choices=FinancialEntryType.choices,
        db_index=True,
        verbose_name="نوع السطر",
    )

    direction = models.CharField(
        max_length=20,
        choices=FinancialEntryDirection.choices,
        db_index=True,
        verbose_name="الاتجاه",
        help_text="مدين على الطرف أو دائن له.",
    )

    status = models.CharField(
        max_length=20,
        choices=FinancialEntryStatus.choices,
        default=FinancialEntryStatus.PENDING,
        db_index=True,
        verbose_name="الحالة",
    )

    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=MONEY_ZERO,
        verbose_name="المبلغ",
    )

    paid_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=MONEY_ZERO,
        verbose_name="المبلغ المسدد",
    )

    currency = models.CharField(
        max_length=10,
        default="SAR",
        db_index=True,
        verbose_name="العملة",
    )

    description = models.TextField(
        blank=True,
        verbose_name="الوصف",
    )

    reference = models.CharField(
        max_length=120,
        blank=True,
        db_index=True,
        verbose_name="مرجع",
    )

    source_type = models.CharField(
        max_length=80,
        blank=True,
        db_index=True,
        verbose_name="نوع المصدر",
        help_text="order, treasury, settlement, manual, contract, payment...",
    )

    source_id = models.CharField(
        max_length=80,
        blank=True,
        db_index=True,
        verbose_name="معرف المصدر",
    )

    source_number = models.CharField(
        max_length=120,
        blank=True,
        db_index=True,
        verbose_name="رقم المصدر",
    )

    # ========================================================
    # 🔗 الربط المحاسبي
    # ========================================================
    journal_entry = models.ForeignKey(
        "accounting.JournalEntry",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_financial_entries",
        verbose_name="القيد المحاسبي",
    )

    journal_entry_reference = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="مرجع القيد",
    )

    is_accounting_posted = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="مرحل محاسبيًا",
    )

    posted_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="تاريخ الترحيل",
    )

    # ========================================================
    # 📅 تواريخ مالية
    # ========================================================
    earned_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="تاريخ الاستحقاق",
    )

    approved_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="تاريخ الاعتماد",
    )

    settled_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="تاريخ التسوية",
    )

    paid_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="تاريخ الدفع",
    )

    # ========================================================
    # 🧩 بيانات إضافية
    # ========================================================
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بيانات إضافية",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_financial_entries_created",
        verbose_name="أنشئ بواسطة",
    )

    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_financial_entries_updated",
        verbose_name="آخر تعديل بواسطة",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="تاريخ الإنشاء",
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="آخر تحديث",
    )

    class Meta:
        db_table = "agent_financial_entries"
        verbose_name = "سطر مالي للمندوب/الوسيط"
        verbose_name_plural = "السجلات المالية للمندوبين والوسطاء"
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["agent"]),
            models.Index(fields=["broker"]),
            models.Index(fields=["order"]),
            models.Index(fields=["payment"]),
            models.Index(fields=["commission"]),
            models.Index(fields=["rule"]),
            models.Index(fields=["entry_number"]),
            models.Index(fields=["entry_type"]),
            models.Index(fields=["direction"]),
            models.Index(fields=["status"]),
            models.Index(fields=["currency"]),
            models.Index(fields=["reference"]),
            models.Index(fields=["source_type"]),
            models.Index(fields=["source_id"]),
            models.Index(fields=["source_number"]),
            models.Index(fields=["journal_entry"]),
            models.Index(fields=["journal_entry_reference"]),
            models.Index(fields=["is_accounting_posted"]),
            models.Index(fields=["earned_at"]),
            models.Index(fields=["approved_at"]),
            models.Index(fields=["settled_at"]),
            models.Index(fields=["paid_at"]),
            models.Index(fields=["posted_at"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["entry_type", "status"]),
            models.Index(fields=["source_type", "source_id"]),
        ]

    def __str__(self) -> str:
        return f"{self.entry_number} - {self.entry_type} - {self.amount}"

    @property
    def remaining_amount(self) -> Decimal:
        remaining = money(self.amount) - money(self.paid_amount)
        return remaining if remaining > MONEY_ZERO else MONEY_ZERO

    @property
    def is_debit(self) -> bool:
        return self.direction == FinancialEntryDirection.DEBIT

    @property
    def is_credit(self) -> bool:
        return self.direction == FinancialEntryDirection.CREDIT

    @property
    def accounting_entry_reference(self) -> str:
        return self.journal_entry_reference

    @accounting_entry_reference.setter
    def accounting_entry_reference(self, value: str) -> None:
        self.journal_entry_reference = value or ""

    def clean(self):
        super().clean()

        self.entry_number = (self.entry_number or "").strip().upper()
        self.currency = (self.currency or "SAR").strip().upper()
        self.description = (self.description or "").strip()
        self.reference = (self.reference or "").strip()
        self.source_type = (self.source_type or "").strip().lower()
        self.source_id = (self.source_id or "").strip()
        self.source_number = (self.source_number or "").strip()
        self.journal_entry_reference = (self.journal_entry_reference or "").strip()

        self.amount = money(self.amount)
        self.paid_amount = money(self.paid_amount)

        if not self.entry_number:
            raise ValidationError({"entry_number": "رقم السطر المالي مطلوب."})

        if not self.agent_id and not self.broker_id:
            raise ValidationError("يجب تحديد مندوب أو وسيط للسطر المالي.")

        if self.agent_id and self.broker_id and self.agent.broker_id and self.agent.broker_id != self.broker_id:
            raise ValidationError({"broker": "الوسيط لا يطابق وسيط المندوب."})

        if self.amount <= MONEY_ZERO:
            raise ValidationError({"amount": "المبلغ يجب أن يكون أكبر من صفر."})

        if self.paid_amount < MONEY_ZERO:
            raise ValidationError({"paid_amount": "المبلغ المسدد لا يمكن أن يكون سالبًا."})

        if self.paid_amount > self.amount:
            raise ValidationError({"paid_amount": "المبلغ المسدد لا يمكن أن يتجاوز مبلغ السطر."})

        if self.status in {
            FinancialEntryStatus.EARNED,
            FinancialEntryStatus.APPROVED,
            FinancialEntryStatus.SETTLED,
            FinancialEntryStatus.PAID,
        } and not self.earned_at:
            self.earned_at = timezone.now()

        if self.status == FinancialEntryStatus.APPROVED and not self.approved_at:
            self.approved_at = timezone.now()

        if self.status == FinancialEntryStatus.SETTLED and not self.settled_at:
            self.settled_at = timezone.now()

        if self.status == FinancialEntryStatus.PAID:
            if self.paid_amount <= MONEY_ZERO:
                self.paid_amount = self.amount

            if not self.paid_at:
                self.paid_at = timezone.now()

        if self.is_accounting_posted and not self.posted_at:
            self.posted_at = timezone.now()

    def save(self, *args, **kwargs):
        self.amount = money(self.amount)
        self.paid_amount = money(self.paid_amount)

        if not self.broker_id and self.agent_id and self.agent.broker_id:
            self.broker = self.agent.broker

        self.full_clean()
        super().save(*args, **kwargs)