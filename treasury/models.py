# ============================================================
# 📂 treasury/models.py
# 🧠 Primey Care | Treasury Module
# ------------------------------------------------------------
# ✅ هذا الموديول يمثل:
#    - الصناديق النقدية
#    - الحسابات البنكية
#    - الحركات المالية
# ✅ جاهز لاحقًا للربط مع:
#    - المدفوعات
#    - الفواتير
#    - القيود اليومية
#    - التسويات
#    - كشوف الحساب
# ============================================================

from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db import models

from accounting.models import Account


class TreasuryAccountType(models.TextChoices):
    CASHBOX = "CASHBOX", "صندوق نقدي"
    BANK = "BANK", "حساب بنكي"


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


class TreasuryTransactionStatus(models.TextChoices):
    DRAFT = "DRAFT", "مسودة"
    CONFIRMED = "CONFIRMED", "مؤكدة"
    CANCELLED = "CANCELLED", "ملغاة"


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
        help_text="كود داخلي فريد للصندوق أو البنك",
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
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"

    def clean(self):
        super().clean()

        for field_name in ["opening_balance", "current_balance"]:
            value = getattr(self, field_name)
            if value is not None and value < 0:
                raise ValidationError({field_name: "القيمة لا يمكن أن تكون سالبة."})

        if self.ledger_account and self.ledger_account.is_group:
            raise ValidationError(
                {"ledger_account": "لا يمكن ربط الخزينة بحساب محاسبي تجميعي."}
            )

        if self.account_type == TreasuryAccountType.CASHBOX:
            self.bank_name = ""
            self.account_holder_name = self.account_holder_name or ""
            self.account_number = ""
            self.iban = ""
            self.branch_name = ""

        if self.account_type == TreasuryAccountType.BANK and not self.bank_name:
            raise ValidationError(
                {"bank_name": "اسم البنك مطلوب عند اختيار حساب بنكي."}
            )


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
        max_length=20,
        choices=TreasuryTransactionType.choices,
        verbose_name="نوع الحركة",
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

    # ========================================================
    # 💰 بيانات مالية
    # ========================================================
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="المبلغ",
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
    # 🔗 ربط محاسبي مستقبلي
    # ========================================================
    journal_entry_reference = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="مرجع القيد",
        help_text="يستخدم لاحقًا بعد ربط الترحيل المحاسبي",
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
        db_table = "treasury_transactions"
        verbose_name = "حركة خزينة"
        verbose_name_plural = "حركات الخزينة"
        ordering = ["-transaction_date", "-id"]
        indexes = [
            models.Index(fields=["transaction_number"]),
            models.Index(fields=["transaction_type"]),
            models.Index(fields=["status"]),
            models.Index(fields=["transaction_date"]),
            models.Index(fields=["treasury_account"]),
            models.Index(fields=["destination_account"]),
            models.Index(fields=["reference"]),
        ]

    def __str__(self):
        return f"{self.transaction_number} - {self.transaction_type}"

    def clean(self):
        super().clean()

        if self.amount is not None and self.amount <= 0:
            raise ValidationError({"amount": "المبلغ يجب أن يكون أكبر من صفر."})

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

        if (
            self.destination_account
            and self.currency
            and self.destination_account.currency != self.currency
        ):
            raise ValidationError(
                {"currency": "عملة الحركة يجب أن تطابق عملة الحساب الوجهة."}
            )

        if self.treasury_account and self.currency != self.treasury_account.currency:
            raise ValidationError(
                {"currency": "عملة الحركة يجب أن تطابق عملة الحساب الأساسي."}
            )

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        previous_status = None

        if not is_new and self.pk:
            previous_status = (
                TreasuryTransaction.objects.filter(pk=self.pk)
                .values_list("status", flat=True)
                .first()
            )

        self.full_clean()
        super().save(*args, **kwargs)

        if self.status == TreasuryTransactionStatus.CONFIRMED:
            if is_new or previous_status != TreasuryTransactionStatus.CONFIRMED:
                self.apply_balance_effect()

    def apply_balance_effect(self):
        primary = self.treasury_account
        amount = Decimal(self.amount or Decimal("0.00")).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )

        if self.transaction_type in {
            TreasuryTransactionType.INCOME,
            TreasuryTransactionType.OPENING_BALANCE,
            TreasuryTransactionType.DEPOSIT,
        }:
            primary.current_balance = Decimal(primary.current_balance or Decimal("0.00")) + amount
            primary.save(update_fields=["current_balance", "updated_at"])
            return

        if self.transaction_type in {
            TreasuryTransactionType.EXPENSE,
            TreasuryTransactionType.WITHDRAW,
        }:
            new_balance = Decimal(primary.current_balance or Decimal("0.00")) - amount
            if new_balance < 0:
                raise ValidationError("لا يمكن أن يصبح رصيد الحساب سالبًا.")
            primary.current_balance = new_balance
            primary.save(update_fields=["current_balance", "updated_at"])
            return

        if self.transaction_type == TreasuryTransactionType.ADJUSTMENT:
            primary.current_balance = Decimal(primary.current_balance or Decimal("0.00")) + amount
            primary.save(update_fields=["current_balance", "updated_at"])
            return

        if self.transaction_type == TreasuryTransactionType.TRANSFER:
            if not self.destination_account:
                raise ValidationError("الحساب الوجهة مطلوب للتحويل.")

            new_source_balance = Decimal(primary.current_balance or Decimal("0.00")) - amount
            if new_source_balance < 0:
                raise ValidationError("الرصيد غير كافٍ لإتمام التحويل.")

            destination = self.destination_account
            destination_new_balance = Decimal(destination.current_balance or Decimal("0.00")) + amount

            primary.current_balance = new_source_balance
            destination.current_balance = destination_new_balance

            primary.save(update_fields=["current_balance", "updated_at"])
            destination.save(update_fields=["current_balance", "updated_at"])