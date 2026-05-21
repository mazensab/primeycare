# ============================================================
# 📂 treasury/models.py
# 🧠 Primey Care | Treasury Module
# ------------------------------------------------------------
# ✅ هذا الموديول يمثل:
#    - الصناديق النقدية
#    - الحسابات البنكية
#    - الحركات المالية
# ✅ جاهز للربط مع:
#    - المدفوعات
#    - الفواتير
#    - القيود اليومية
#    - التسويات
#    - كشوف الحساب
#    - التقارير المالية
# ------------------------------------------------------------
# ملاحظات مهمة:
# - أثر الرصيد يطبق مرة واحدة فقط عند التأكيد.
# - عند إلغاء حركة مؤكدة يتم عكس أثرها على الرصيد.
# - لا يسمح بتعديل الحقول المالية الجوهرية بعد التأكيد.
# - يدعم ربط الحركة بحساب الخزينة والحساب المحاسبي المقابل والقيد المحاسبي.
# - يدعم مصدر الحركة والطرف المرتبط والمرجع الخارجي.
# ============================================================

from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone

from accounting.models import Account


# ============================================================
# 🧾 الثوابت والاختيارات
# ============================================================

class TreasuryAccountType(models.TextChoices):
    CASHBOX = "CASHBOX", "صندوق نقدي"
    BANK = "BANK", "حساب بنكي"
    GATEWAY = "GATEWAY", "بوابة دفع"
    WALLET = "WALLET", "محفظة إلكترونية"


class TreasuryAccountStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "نشط"
    INACTIVE = "INACTIVE", "غير نشط"
    SUSPENDED = "SUSPENDED", "موقوف"
    CLOSED = "CLOSED", "مغلق"


class TreasuryTransactionType(models.TextChoices):
    INCOME = "INCOME", "قبض"
    EXPENSE = "EXPENSE", "صرف"
    TRANSFER = "TRANSFER", "تحويل"
    OPENING_BALANCE = "OPENING_BALANCE", "رصيد افتتاحي"
    ADJUSTMENT = "ADJUSTMENT", "تسوية"
    DEPOSIT = "DEPOSIT", "إيداع"
    WITHDRAW = "WITHDRAW", "سحب"
    REFUND = "REFUND", "استرداد"
    FEE = "FEE", "رسوم"


class TreasuryTransactionStatus(models.TextChoices):
    DRAFT = "DRAFT", "مسودة"
    CONFIRMED = "CONFIRMED", "مؤكدة"
    CANCELLED = "CANCELLED", "ملغاة"


class TreasuryTransactionSource(models.TextChoices):
    MANUAL = "MANUAL", "يدوي"
    MANUAL_RECEIPT = "MANUAL_RECEIPT", "سند قبض يدوي"
    MANUAL_PAYMENT = "MANUAL_PAYMENT", "سند صرف يدوي"

    PAYMENT = "PAYMENT", "دفعة"
    INVOICE = "INVOICE", "فاتورة"
    ORDER = "ORDER", "طلب"
    REFUND = "REFUND", "استرداد"
    TRANSFER = "TRANSFER", "تحويل"
    GATEWAY = "GATEWAY", "بوابة دفع"

    AGENT_COMMISSION = "AGENT_COMMISSION", "عمولة مندوب"
    AGENT_COD_COLLECTION = "AGENT_COD_COLLECTION", "تحصيل COD بواسطة مندوب"
    AGENT_CASH_SETTLEMENT = "AGENT_CASH_SETTLEMENT", "توريد عهدة مندوب"
    AGENT_EARNING_SETTLEMENT = "AGENT_EARNING_SETTLEMENT", "تسوية مستحقات مندوب"

    BROKER_COMMISSION = "BROKER_COMMISSION", "عمولة وسيط"
    BROKER_CASH_SETTLEMENT = "BROKER_CASH_SETTLEMENT", "توريد عهدة وسيط"
    BROKER_EARNING_SETTLEMENT = "BROKER_EARNING_SETTLEMENT", "تسوية مستحقات وسيط"

    ACCOUNTING = "ACCOUNTING", "محاسبة"
    OPENING_BALANCE = "OPENING_BALANCE", "رصيد افتتاحي"
    ADJUSTMENT = "ADJUSTMENT", "تسوية"
    OTHER = "OTHER", "أخرى"


# ============================================================
# 🛠️ Helpers
# ============================================================

def _money(value) -> Decimal:
    amount = Decimal(str(value or "0.00"))
    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _clean_text(value) -> str:
    return str(value or "").strip()


def _clean_currency(value) -> str:
    return str(value or "SAR").strip().upper()


# ============================================================
# 💼 TreasuryAccount | حساب خزينة / بنك / بوابة دفع
# ============================================================

class TreasuryAccount(models.Model):
    # ========================================================
    # 🆔 بيانات الحساب الخزيني
    # ========================================================
    name = models.CharField(
        max_length=255,
        verbose_name="اسم الحساب",
    )
    code = models.CharField(
        max_length=50,
        unique=True,
        verbose_name="كود الحساب",
        help_text="كود داخلي فريد للصندوق أو البنك أو بوابة الدفع",
    )
    account_type = models.CharField(
        max_length=20,
        choices=TreasuryAccountType.choices,
        verbose_name="نوع الحساب",
    )
    status = models.CharField(
        max_length=20,
        choices=TreasuryAccountStatus.choices,
        default=TreasuryAccountStatus.ACTIVE,
        verbose_name="الحالة",
    )

    # ========================================================
    # 🔗 الربط المحاسبي
    # ========================================================
    ledger_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        related_name="treasury_accounts",
        null=True,
        blank=True,
        verbose_name="الحساب المحاسبي",
        help_text="الحساب المقابل في دليل الحسابات",
    )

    # ========================================================
    # 💰 الرصيد
    # ========================================================
    opening_balance = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="الرصيد الافتتاحي",
    )
    current_balance = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="الرصيد الحالي",
    )
    currency = models.CharField(
        max_length=10,
        default="SAR",
        verbose_name="العملة",
    )

    # ========================================================
    # 🏦 بيانات بنكية
    # ========================================================
    bank_name = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="اسم البنك",
    )
    account_holder_name = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="اسم صاحب الحساب",
    )
    account_number = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="رقم الحساب",
    )
    iban = models.CharField(
        max_length=34,
        blank=True,
        verbose_name="IBAN",
    )
    branch_name = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="اسم الفرع",
    )

    # ========================================================
    # 🌐 بيانات بوابات الدفع / المحافظ
    # ========================================================
    provider_name = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="اسم مزود الدفع",
        help_text="مثل Moyasar أو Tap أو Tamara أو Tabby",
    )
    merchant_id = models.CharField(
        max_length=150,
        blank=True,
        verbose_name="معرف التاجر",
    )
    settlement_days = models.PositiveIntegerField(
        default=0,
        verbose_name="أيام التسوية",
        help_text="عدد الأيام المتوقعة لتسوية مبالغ بوابة الدفع",
    )

    # ========================================================
    # 📝 إضافي
    # ========================================================
    description = models.TextField(
        blank=True,
        verbose_name="الوصف",
    )
    is_default = models.BooleanField(
        default=False,
        verbose_name="حساب افتراضي",
    )
    allow_negative_balance = models.BooleanField(
        default=False,
        verbose_name="السماح برصيد سالب",
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
        db_table = "treasury_accounts"
        verbose_name = "حساب خزينة"
        verbose_name_plural = "حسابات الخزينة"
        ordering = ["account_type", "code"]
        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["account_type"]),
            models.Index(fields=["status"]),
            models.Index(fields=["currency"]),
            models.Index(fields=["is_default"]),
            models.Index(fields=["ledger_account"]),
            models.Index(fields=["provider_name"]),
            models.Index(fields=["account_type", "status"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"

    # ========================================================
    # ✅ Validation
    # ========================================================

    def clean(self):
        super().clean()

        self.name = _clean_text(self.name)
        self.code = _clean_text(self.code)
        self.currency = _clean_currency(self.currency)
        self.bank_name = _clean_text(self.bank_name)
        self.account_holder_name = _clean_text(self.account_holder_name)
        self.account_number = _clean_text(self.account_number)
        self.iban = _clean_text(self.iban).replace(" ", "").upper()
        self.branch_name = _clean_text(self.branch_name)
        self.provider_name = _clean_text(self.provider_name)
        self.merchant_id = _clean_text(self.merchant_id)

        self.opening_balance = _money(self.opening_balance)
        self.current_balance = _money(self.current_balance)

        if not self.name:
            raise ValidationError({"name": "اسم حساب الخزينة مطلوب."})

        if not self.code:
            raise ValidationError({"code": "كود حساب الخزينة مطلوب."})

        for field_name in ["opening_balance", "current_balance"]:
            value = getattr(self, field_name)
            if value is not None and value < 0 and not self.allow_negative_balance:
                raise ValidationError(
                    {field_name: "القيمة لا يمكن أن تكون سالبة إلا عند تفعيل السماح بالرصيد السالب."}
                )

        if self.ledger_account:
            if self.ledger_account.is_group:
                raise ValidationError(
                    {"ledger_account": "لا يمكن ربط الخزينة بحساب محاسبي تجميعي."}
                )

            if not self.ledger_account.is_active:
                raise ValidationError(
                    {"ledger_account": "لا يمكن ربط الخزينة بحساب محاسبي غير نشط."}
                )

        if self.account_type == TreasuryAccountType.CASHBOX:
            self.bank_name = ""
            self.account_number = ""
            self.iban = ""
            self.branch_name = ""
            self.provider_name = ""
            self.merchant_id = ""
            self.settlement_days = 0

        if self.account_type == TreasuryAccountType.BANK:
            self.provider_name = ""
            self.merchant_id = ""

            if not self.bank_name:
                raise ValidationError(
                    {"bank_name": "اسم البنك مطلوب عند اختيار حساب بنكي."}
                )

            if self.iban and len(self.iban) < 15:
                raise ValidationError(
                    {"iban": "رقم IBAN غير صحيح."}
                )

        if self.account_type in {TreasuryAccountType.GATEWAY, TreasuryAccountType.WALLET}:
            self.bank_name = self.bank_name or self.provider_name

            if not self.provider_name:
                raise ValidationError(
                    {"provider_name": "اسم مزود الدفع مطلوب عند اختيار بوابة دفع أو محفظة."}
                )

        if self.status == TreasuryAccountStatus.CLOSED and self.current_balance != Decimal("0.00"):
            raise ValidationError(
                {"status": "لا يمكن إغلاق حساب خزينة لديه رصيد حالي غير صفري."}
            )

    def save(self, *args, **kwargs):
        self.full_clean()

        if self.is_default:
            TreasuryAccount.objects.exclude(pk=self.pk).filter(
                account_type=self.account_type,
                currency=self.currency,
            ).update(is_default=False)

        super().save(*args, **kwargs)

    # ========================================================
    # Helpers
    # ========================================================

    @property
    def is_active(self) -> bool:
        return self.status == TreasuryAccountStatus.ACTIVE

    @property
    def is_cashbox(self) -> bool:
        return self.account_type == TreasuryAccountType.CASHBOX

    @property
    def is_bank(self) -> bool:
        return self.account_type == TreasuryAccountType.BANK

    @property
    def is_gateway(self) -> bool:
        return self.account_type == TreasuryAccountType.GATEWAY

    @property
    def is_wallet(self) -> bool:
        return self.account_type == TreasuryAccountType.WALLET


# ============================================================
# 🧾 TreasuryTransaction | حركة خزينة
# ============================================================

class TreasuryTransaction(models.Model):
    # ========================================================
    # 🧾 بيانات الحركة المالية
    # ========================================================
    transaction_number = models.CharField(
        max_length=100,
        unique=True,
        verbose_name="رقم الحركة",
        help_text="رقم مرجعي داخلي فريد للحركة",
    )
    transaction_type = models.CharField(
        max_length=30,
        choices=TreasuryTransactionType.choices,
        verbose_name="نوع الحركة",
    )
    source = models.CharField(
        max_length=40,
        choices=TreasuryTransactionSource.choices,
        default=TreasuryTransactionSource.MANUAL,
        verbose_name="مصدر الحركة",
    )
    status = models.CharField(
        max_length=20,
        choices=TreasuryTransactionStatus.choices,
        default=TreasuryTransactionStatus.DRAFT,
        verbose_name="الحالة",
    )
    transaction_date = models.DateField(
        verbose_name="تاريخ الحركة",
    )

    # ========================================================
    # 🔗 الحسابات
    # ========================================================
    treasury_account = models.ForeignKey(
        TreasuryAccount,
        on_delete=models.PROTECT,
        related_name="transactions",
        verbose_name="الحساب الأساسي",
    )
    destination_account = models.ForeignKey(
        TreasuryAccount,
        on_delete=models.PROTECT,
        related_name="incoming_transfers",
        null=True,
        blank=True,
        verbose_name="الحساب الوجهة",
        help_text="يستخدم في حالة التحويل",
    )
    counterparty_ledger_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        related_name="treasury_counterparty_transactions",
        null=True,
        blank=True,
        verbose_name="الحساب المحاسبي المقابل",
        help_text=(
            "الحساب المحاسبي المقابل لحركة القبض أو الصرف أو التسوية. "
            "مثال: ذمم العملاء، عهدة مندوب، مستحقات مندوب، دائنون، مصروف، إيراد."
        ),
    )

    # ========================================================
    # 💰 بيانات مالية
    # ========================================================
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="المبلغ",
    )
    fees_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="مبلغ الرسوم",
    )
    net_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="صافي المبلغ",
    )
    currency = models.CharField(
        max_length=10,
        default="SAR",
        verbose_name="العملة",
    )

    # ========================================================
    # 🔖 مراجع تشغيلية
    # ========================================================
    reference = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="مرجع",
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
        help_text="مثال: payment, invoice, order, gateway_transaction",
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
    # 👤 الطرف المرتبط
    # ========================================================
    party_type = models.CharField(
        max_length=80,
        blank=True,
        verbose_name="نوع الطرف",
        help_text="مثال: customer, provider, agent, broker, employee",
    )
    party_id = models.CharField(
        max_length=80,
        blank=True,
        verbose_name="معرف الطرف",
    )
    party_name = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="اسم الطرف",
    )

    # ========================================================
    # 📝 وصف وملاحظات
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
    # 🔗 ربط محاسبي
    # ========================================================
    journal_entry = models.ForeignKey(
        "accounting.JournalEntry",
        on_delete=models.SET_NULL,
        related_name="treasury_transactions",
        null=True,
        blank=True,
        verbose_name="القيد المحاسبي",
    )
    journal_entry_reference = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="مرجع القيد",
        help_text="يستخدم للتوافق مع الربط السابق أو عند عدم توفر القيد كعلاقة مباشرة",
    )

    # ========================================================
    # 🔐 تطبيق الرصيد
    # ========================================================
    balance_applied = models.BooleanField(
        default=False,
        verbose_name="تم تطبيق أثر الرصيد",
    )
    balance_reversed = models.BooleanField(
        default=False,
        verbose_name="تم عكس أثر الرصيد",
    )
    balance_before = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="الرصيد قبل",
    )
    balance_after = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="الرصيد بعد",
    )

    # ========================================================
    # 👥 المستخدمون
    # ========================================================
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_treasury_transactions",
        verbose_name="أنشئت بواسطة",
    )
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="confirmed_treasury_transactions",
        verbose_name="أكدت بواسطة",
    )
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cancelled_treasury_transactions",
        verbose_name="ألغيت بواسطة",
    )

    # ========================================================
    # 🧩 بيانات إضافية
    # ========================================================
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بيانات إضافية",
    )

    # ========================================================
    # 🕒 التتبع
    # ========================================================
    confirmed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ التأكيد",
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
        db_table = "treasury_transactions"
        verbose_name = "حركة خزينة"
        verbose_name_plural = "حركات الخزينة"
        ordering = ["-transaction_date", "-id"]
        indexes = [
            models.Index(fields=["transaction_number"]),
            models.Index(fields=["transaction_type"]),
            models.Index(fields=["source"]),
            models.Index(fields=["status"]),
            models.Index(fields=["transaction_date"]),
            models.Index(fields=["treasury_account"]),
            models.Index(fields=["destination_account"]),
            models.Index(fields=["counterparty_ledger_account"]),
            models.Index(fields=["reference"]),
            models.Index(fields=["external_reference"]),
            models.Index(fields=["source_type"]),
            models.Index(fields=["source_id"]),
            models.Index(fields=["source_number"]),
            models.Index(fields=["party_type"]),
            models.Index(fields=["party_id"]),
            models.Index(fields=["journal_entry"]),
            models.Index(fields=["journal_entry_reference"]),
            models.Index(fields=["currency"]),
            models.Index(fields=["balance_applied"]),
            models.Index(fields=["balance_reversed"]),
            models.Index(fields=["status", "transaction_date"]),
            models.Index(fields=["source", "source_id"]),
        ]

    def __str__(self):
        return f"{self.transaction_number} - {self.transaction_type}"

    # ========================================================
    # ✅ Validation
    # ========================================================

    def clean(self):
        super().clean()

        self.transaction_number = _clean_text(self.transaction_number)
        self.reference = _clean_text(self.reference)
        self.external_reference = _clean_text(self.external_reference)
        self.source_type = _clean_text(self.source_type)
        self.source_id = _clean_text(self.source_id)
        self.source_number = _clean_text(self.source_number)
        self.party_type = _clean_text(self.party_type)
        self.party_id = _clean_text(self.party_id)
        self.party_name = _clean_text(self.party_name)
        self.currency = _clean_currency(self.currency)

        self.amount = _money(self.amount)
        self.fees_amount = _money(self.fees_amount)
        self.net_amount = _money(self.net_amount)
        self.balance_before = _money(self.balance_before)
        self.balance_after = _money(self.balance_after)

        if not self.transaction_number:
            raise ValidationError({"transaction_number": "رقم الحركة مطلوب."})

        if not self.transaction_date:
            raise ValidationError({"transaction_date": "تاريخ الحركة مطلوب."})

        if self.amount <= Decimal("0.00"):
            raise ValidationError({"amount": "المبلغ يجب أن يكون أكبر من صفر."})

        if self.fees_amount < Decimal("0.00"):
            raise ValidationError({"fees_amount": "مبلغ الرسوم لا يمكن أن يكون سالبًا."})

        if self.fees_amount > self.amount:
            raise ValidationError({"fees_amount": "الرسوم لا يمكن أن تكون أكبر من مبلغ الحركة."})

        calculated_net_amount = _money(self.amount - self.fees_amount)
        if self.net_amount == Decimal("0.00") or self.net_amount != calculated_net_amount:
            self.net_amount = calculated_net_amount

        if self.destination_account_id and self.destination_account_id == self.treasury_account_id:
            raise ValidationError(
                {"destination_account": "لا يمكن التحويل إلى نفس الحساب."}
            )

        if self.transaction_type == TreasuryTransactionType.TRANSFER:
            if not self.destination_account:
                raise ValidationError(
                    {"destination_account": "الحساب الوجهة مطلوب في حالة التحويل."}
                )
        else:
            if self.destination_account:
                raise ValidationError(
                    {"destination_account": "الحساب الوجهة يستخدم فقط في حالة التحويل."}
                )

        if self.destination_account and self.currency and self.destination_account.currency != self.currency:
            raise ValidationError(
                {"currency": "عملة الحركة يجب أن تطابق عملة الحساب الوجهة."}
            )

        if self.treasury_account and self.currency != self.treasury_account.currency:
            raise ValidationError(
                {"currency": "عملة الحركة يجب أن تطابق عملة الحساب الأساسي."}
            )

        if self.treasury_account and self.treasury_account.status != TreasuryAccountStatus.ACTIVE:
            raise ValidationError(
                {"treasury_account": "لا يمكن استخدام حساب خزينة غير نشط."}
            )

        if self.destination_account and self.destination_account.status != TreasuryAccountStatus.ACTIVE:
            raise ValidationError(
                {"destination_account": "لا يمكن التحويل إلى حساب خزينة غير نشط."}
            )

        if self.counterparty_ledger_account:
            if self.counterparty_ledger_account.is_group:
                raise ValidationError(
                    {"counterparty_ledger_account": "لا يمكن استخدام حساب محاسبي تجميعي كحساب مقابل."}
                )

            if not self.counterparty_ledger_account.is_active:
                raise ValidationError(
                    {"counterparty_ledger_account": "لا يمكن استخدام حساب محاسبي غير نشط كحساب مقابل."}
                )

        sources_requiring_counterparty = {
            TreasuryTransactionSource.MANUAL_RECEIPT,
            TreasuryTransactionSource.MANUAL_PAYMENT,
            TreasuryTransactionSource.AGENT_CASH_SETTLEMENT,
            TreasuryTransactionSource.AGENT_EARNING_SETTLEMENT,
            TreasuryTransactionSource.BROKER_CASH_SETTLEMENT,
            TreasuryTransactionSource.BROKER_EARNING_SETTLEMENT,
        }

        types_requiring_counterparty = {
            TreasuryTransactionType.INCOME,
            TreasuryTransactionType.EXPENSE,
            TreasuryTransactionType.DEPOSIT,
            TreasuryTransactionType.WITHDRAW,
            TreasuryTransactionType.REFUND,
            TreasuryTransactionType.FEE,
        }

        if (
            self.transaction_type in types_requiring_counterparty
            and self.source in sources_requiring_counterparty
            and not self.counterparty_ledger_account_id
            and not self.journal_entry_id
        ):
            raise ValidationError(
                {
                    "counterparty_ledger_account": (
                        "الحساب المحاسبي المقابل مطلوب لهذه الحركة حتى يمكن إنشاء القيد المحاسبي تلقائيًا."
                    )
                }
            )

        if self.transaction_type == TreasuryTransactionType.TRANSFER and self.counterparty_ledger_account_id:
            raise ValidationError(
                {"counterparty_ledger_account": "التحويل الداخلي يستخدم حساب الوجهة ولا يحتاج حسابًا مقابلًا."}
            )

        if self.status == TreasuryTransactionStatus.CONFIRMED and not self.confirmed_at:
            self.confirmed_at = timezone.now()

        if self.status == TreasuryTransactionStatus.CANCELLED and not self.cancelled_at:
            self.cancelled_at = timezone.now()

    # ========================================================
    # 🔐 حماية تعديل الحركات المؤكدة
    # ========================================================

    def _get_previous_instance(self):
        if self._state.adding or not self.pk:
            return None

        return TreasuryTransaction.objects.filter(pk=self.pk).first()

    def _ensure_confirmed_transaction_not_mutated(self, previous):
        if not previous:
            return

        if previous.status != TreasuryTransactionStatus.CONFIRMED:
            return

        protected_fields = {
            "transaction_type": previous.transaction_type,
            "source": previous.source,
            "treasury_account_id": previous.treasury_account_id,
            "destination_account_id": previous.destination_account_id,
            "counterparty_ledger_account_id": previous.counterparty_ledger_account_id,
            "amount": _money(previous.amount),
            "fees_amount": _money(previous.fees_amount),
            "currency": previous.currency,
            "transaction_date": previous.transaction_date,
        }

        current_fields = {
            "transaction_type": self.transaction_type,
            "source": self.source,
            "treasury_account_id": self.treasury_account_id,
            "destination_account_id": self.destination_account_id,
            "counterparty_ledger_account_id": self.counterparty_ledger_account_id,
            "amount": _money(self.amount),
            "fees_amount": _money(self.fees_amount),
            "currency": self.currency,
            "transaction_date": self.transaction_date,
        }

        if protected_fields != current_fields:
            raise ValidationError(
                "لا يمكن تعديل بيانات مالية جوهرية لحركة خزينة مؤكدة. "
                "قم بإنشاء حركة تسوية بدل تعديل الحركة الأصلية."
            )

        if self.status == TreasuryTransactionStatus.DRAFT:
            raise ValidationError("لا يمكن إعادة حركة مؤكدة إلى مسودة.")

        if previous.status == TreasuryTransactionStatus.CONFIRMED and self.status == TreasuryTransactionStatus.CANCELLED:
            return

    def save(self, *args, **kwargs):
        previous = self._get_previous_instance()
        previous_status = previous.status if previous else None

        self._ensure_confirmed_transaction_not_mutated(previous)
        self.full_clean()

        with transaction.atomic():
            super().save(*args, **kwargs)

            if (
                self.status == TreasuryTransactionStatus.CONFIRMED
                and previous_status != TreasuryTransactionStatus.CONFIRMED
                and not self.balance_applied
            ):
                self.apply_balance_effect()

            if (
                previous_status == TreasuryTransactionStatus.CONFIRMED
                and self.status == TreasuryTransactionStatus.CANCELLED
                and self.balance_applied
                and not self.balance_reversed
            ):
                self.reverse_balance_effect()

    # ========================================================
    # 🔒 Lock Helpers
    # ========================================================

    def _lock_primary_account(self) -> TreasuryAccount:
        return TreasuryAccount.objects.select_for_update().get(pk=self.treasury_account_id)

    def _lock_transfer_accounts(self) -> tuple[TreasuryAccount, TreasuryAccount]:
        if not self.destination_account_id:
            raise ValidationError("الحساب الوجهة مطلوب للتحويل.")

        account_ids = sorted([self.treasury_account_id, self.destination_account_id])

        locked_accounts = {
            account.pk: account
            for account in TreasuryAccount.objects.select_for_update().filter(
                pk__in=account_ids
            )
        }

        primary = locked_accounts.get(self.treasury_account_id)
        destination = locked_accounts.get(self.destination_account_id)

        if not primary or not destination:
            raise ValidationError("تعذر قفل حسابات الخزينة المطلوبة.")

        return primary, destination

    # ========================================================
    # 💰 Balance Logic
    # ========================================================

    def apply_balance_effect(self):
        """
        تطبيق أثر الحركة على الرصيد مرة واحدة فقط.
        """
        if self.balance_applied:
            return

        amount = _money(self.net_amount if self.net_amount else self.amount)

        if amount <= Decimal("0.00"):
            raise ValidationError("صافي مبلغ الحركة يجب أن يكون أكبر من صفر.")

        with transaction.atomic():
            if self.transaction_type in {
                TreasuryTransactionType.INCOME,
                TreasuryTransactionType.OPENING_BALANCE,
                TreasuryTransactionType.DEPOSIT,
                TreasuryTransactionType.ADJUSTMENT,
            }:
                primary = self._lock_primary_account()

                self.balance_before = _money(primary.current_balance)
                primary.current_balance = _money(primary.current_balance) + amount
                self.balance_after = _money(primary.current_balance)

                primary.save(update_fields=["current_balance", "updated_at"])

                self.balance_applied = True
                super(TreasuryTransaction, self).save(
                    update_fields=[
                        "balance_before",
                        "balance_after",
                        "balance_applied",
                        "confirmed_at",
                        "updated_at",
                    ]
                )
                return

            if self.transaction_type in {
                TreasuryTransactionType.EXPENSE,
                TreasuryTransactionType.WITHDRAW,
                TreasuryTransactionType.REFUND,
                TreasuryTransactionType.FEE,
            }:
                primary = self._lock_primary_account()

                self.balance_before = _money(primary.current_balance)
                new_balance = _money(primary.current_balance) - amount

                if new_balance < Decimal("0.00") and not primary.allow_negative_balance:
                    raise ValidationError("لا يمكن أن يصبح رصيد الحساب سالبًا.")

                primary.current_balance = new_balance
                self.balance_after = _money(primary.current_balance)

                primary.save(update_fields=["current_balance", "updated_at"])

                self.balance_applied = True
                super(TreasuryTransaction, self).save(
                    update_fields=[
                        "balance_before",
                        "balance_after",
                        "balance_applied",
                        "confirmed_at",
                        "updated_at",
                    ]
                )
                return

            if self.transaction_type == TreasuryTransactionType.TRANSFER:
                primary, destination = self._lock_transfer_accounts()

                self.balance_before = _money(primary.current_balance)

                new_source_balance = _money(primary.current_balance) - amount
                if new_source_balance < Decimal("0.00") and not primary.allow_negative_balance:
                    raise ValidationError("الرصيد غير كافٍ لإتمام التحويل.")

                destination_new_balance = _money(destination.current_balance) + amount

                primary.current_balance = new_source_balance
                destination.current_balance = destination_new_balance
                self.balance_after = _money(primary.current_balance)

                primary.save(update_fields=["current_balance", "updated_at"])
                destination.save(update_fields=["current_balance", "updated_at"])

                self.balance_applied = True
                super(TreasuryTransaction, self).save(
                    update_fields=[
                        "balance_before",
                        "balance_after",
                        "balance_applied",
                        "confirmed_at",
                        "updated_at",
                    ]
                )
                return

    def reverse_balance_effect(self):
        """
        عكس أثر الحركة عند الإلغاء مرة واحدة فقط.
        """
        if self.balance_reversed:
            return

        if not self.balance_applied:
            return

        amount = _money(self.net_amount if self.net_amount else self.amount)

        with transaction.atomic():
            if self.transaction_type in {
                TreasuryTransactionType.INCOME,
                TreasuryTransactionType.OPENING_BALANCE,
                TreasuryTransactionType.DEPOSIT,
                TreasuryTransactionType.ADJUSTMENT,
            }:
                primary = self._lock_primary_account()
                new_balance = _money(primary.current_balance) - amount

                if new_balance < Decimal("0.00") and not primary.allow_negative_balance:
                    raise ValidationError(
                        "لا يمكن إلغاء الحركة لأن الإلغاء سيجعل رصيد الحساب سالبًا."
                    )

                primary.current_balance = new_balance
                primary.save(update_fields=["current_balance", "updated_at"])

                self.balance_reversed = True
                self.cancelled_at = self.cancelled_at or timezone.now()
                super(TreasuryTransaction, self).save(
                    update_fields=[
                        "balance_reversed",
                        "cancelled_at",
                        "updated_at",
                    ]
                )
                return

            if self.transaction_type in {
                TreasuryTransactionType.EXPENSE,
                TreasuryTransactionType.WITHDRAW,
                TreasuryTransactionType.REFUND,
                TreasuryTransactionType.FEE,
            }:
                primary = self._lock_primary_account()
                primary.current_balance = _money(primary.current_balance) + amount
                primary.save(update_fields=["current_balance", "updated_at"])

                self.balance_reversed = True
                self.cancelled_at = self.cancelled_at or timezone.now()
                super(TreasuryTransaction, self).save(
                    update_fields=[
                        "balance_reversed",
                        "cancelled_at",
                        "updated_at",
                    ]
                )
                return

            if self.transaction_type == TreasuryTransactionType.TRANSFER:
                primary, destination = self._lock_transfer_accounts()

                destination_new_balance = _money(destination.current_balance) - amount
                if destination_new_balance < Decimal("0.00") and not destination.allow_negative_balance:
                    raise ValidationError(
                        "لا يمكن إلغاء التحويل لأن رصيد الحساب الوجهة غير كافٍ."
                    )

                source_new_balance = _money(primary.current_balance) + amount

                primary.current_balance = source_new_balance
                destination.current_balance = destination_new_balance

                primary.save(update_fields=["current_balance", "updated_at"])
                destination.save(update_fields=["current_balance", "updated_at"])

                self.balance_reversed = True
                self.cancelled_at = self.cancelled_at or timezone.now()
                super(TreasuryTransaction, self).save(
                    update_fields=[
                        "balance_reversed",
                        "cancelled_at",
                        "updated_at",
                    ]
                )
                return

    # ========================================================
    # 🚀 Status Helpers
    # ========================================================

    def mark_as_confirmed(self, *, actor=None):
        if self.status == TreasuryTransactionStatus.CANCELLED:
            raise ValidationError("لا يمكن تأكيد حركة خزينة ملغاة.")

        if self.status == TreasuryTransactionStatus.CONFIRMED:
            return

        self.status = TreasuryTransactionStatus.CONFIRMED
        self.confirmed_at = self.confirmed_at or timezone.now()

        if actor is not None and getattr(actor, "is_authenticated", False):
            self.confirmed_by = actor

        self.save(
            update_fields=[
                "status",
                "confirmed_at",
                "confirmed_by",
                "updated_at",
            ]
        )

    def mark_as_cancelled(self, *, actor=None, reason: str = ""):
        if self.status == TreasuryTransactionStatus.CANCELLED:
            return

        self.status = TreasuryTransactionStatus.CANCELLED
        self.cancelled_at = self.cancelled_at or timezone.now()

        if actor is not None and getattr(actor, "is_authenticated", False):
            self.cancelled_by = actor

        if reason:
            self.notes = f"{self.notes}\nسبب الإلغاء: {reason}".strip()

        self.save(
            update_fields=[
                "status",
                "cancelled_at",
                "cancelled_by",
                "notes",
                "updated_at",
            ]
        )

    # ========================================================
    # Properties
    # ========================================================

    @property
    def has_accounting_entry(self) -> bool:
        return bool(self.journal_entry_id or self.journal_entry_reference)

    @property
    def needs_accounting_posting(self) -> bool:
        return self.is_confirmed and not self.has_accounting_entry

    @property
    def is_agent_settlement(self) -> bool:
        return self.source in {
            TreasuryTransactionSource.AGENT_CASH_SETTLEMENT,
            TreasuryTransactionSource.AGENT_EARNING_SETTLEMENT,
        }

    @property
    def is_broker_settlement(self) -> bool:
        return self.source in {
            TreasuryTransactionSource.BROKER_CASH_SETTLEMENT,
            TreasuryTransactionSource.BROKER_EARNING_SETTLEMENT,
        }

    @property
    def is_draft(self) -> bool:
        return self.status == TreasuryTransactionStatus.DRAFT

    @property
    def is_confirmed(self) -> bool:
        return self.status == TreasuryTransactionStatus.CONFIRMED

    @property
    def is_cancelled(self) -> bool:
        return self.status == TreasuryTransactionStatus.CANCELLED

    @property
    def is_inflow(self) -> bool:
        return self.transaction_type in {
            TreasuryTransactionType.INCOME,
            TreasuryTransactionType.OPENING_BALANCE,
            TreasuryTransactionType.DEPOSIT,
            TreasuryTransactionType.ADJUSTMENT,
        }

    @property
    def is_outflow(self) -> bool:
        return self.transaction_type in {
            TreasuryTransactionType.EXPENSE,
            TreasuryTransactionType.WITHDRAW,
            TreasuryTransactionType.REFUND,
            TreasuryTransactionType.FEE,
        }

    @property
    def is_transfer(self) -> bool:
        return self.transaction_type == TreasuryTransactionType.TRANSFER