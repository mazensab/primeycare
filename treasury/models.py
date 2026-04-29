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
# ------------------------------------------------------------
# ملاحظات مهمة:
# - أثر الرصيد يطبق مرة واحدة فقط عند التأكيد.
# - عند إلغاء حركة مؤكدة يتم عكس أثرها على الرصيد.
# - لا يسمح بتعديل الحقول المالية الجوهرية بعد التأكيد.
# ============================================================

from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db import models, transaction

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


def _money(value) -> Decimal:
    amount = Decimal(str(value or "0.00"))
    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


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
            self.account_number = ""
            self.iban = ""
            self.branch_name = ""

        if self.account_type == TreasuryAccountType.BANK and not self.bank_name:
            raise ValidationError(
                {"bank_name": "اسم البنك مطلوب عند اختيار حساب بنكي."}
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


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

        if (
            self.destination_account_id
            and self.destination_account_id == self.treasury_account_id
        ):
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

        if self.treasury_account and self.treasury_account.status != TreasuryAccountStatus.ACTIVE:
            raise ValidationError(
                {"treasury_account": "لا يمكن استخدام حساب خزينة غير نشط."}
            )

        if (
            self.destination_account
            and self.destination_account.status != TreasuryAccountStatus.ACTIVE
        ):
            raise ValidationError(
                {"destination_account": "لا يمكن التحويل إلى حساب خزينة غير نشط."}
            )

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
            "treasury_account_id": previous.treasury_account_id,
            "destination_account_id": previous.destination_account_id,
            "amount": _money(previous.amount),
            "currency": previous.currency,
        }

        current_fields = {
            "transaction_type": self.transaction_type,
            "treasury_account_id": self.treasury_account_id,
            "destination_account_id": self.destination_account_id,
            "amount": _money(self.amount),
            "currency": self.currency,
        }

        if protected_fields != current_fields:
            raise ValidationError(
                "لا يمكن تعديل بيانات مالية جوهرية لحركة خزينة مؤكدة. "
                "قم بإنشاء حركة تسوية بدل تعديل الحركة الأصلية."
            )

        if self.status == TreasuryTransactionStatus.DRAFT:
            raise ValidationError("لا يمكن إعادة حركة مؤكدة إلى مسودة.")

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
            ):
                self.apply_balance_effect()

            if (
                previous_status == TreasuryTransactionStatus.CONFIRMED
                and self.status == TreasuryTransactionStatus.CANCELLED
            ):
                self.reverse_balance_effect()

    def _lock_primary_account(self) -> TreasuryAccount:
        return TreasuryAccount.objects.select_for_update().get(pk=self.treasury_account_id)

    def _lock_transfer_accounts(self) -> tuple[TreasuryAccount, TreasuryAccount]:
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

    def apply_balance_effect(self):
        amount = _money(self.amount)

        with transaction.atomic():
            if self.transaction_type in {
                TreasuryTransactionType.INCOME,
                TreasuryTransactionType.OPENING_BALANCE,
                TreasuryTransactionType.DEPOSIT,
                TreasuryTransactionType.ADJUSTMENT,
            }:
                primary = self._lock_primary_account()
                primary.current_balance = _money(primary.current_balance) + amount
                primary.save(update_fields=["current_balance", "updated_at"])
                return

            if self.transaction_type in {
                TreasuryTransactionType.EXPENSE,
                TreasuryTransactionType.WITHDRAW,
            }:
                primary = self._lock_primary_account()
                new_balance = _money(primary.current_balance) - amount

                if new_balance < Decimal("0.00"):
                    raise ValidationError("لا يمكن أن يصبح رصيد الحساب سالبًا.")

                primary.current_balance = new_balance
                primary.save(update_fields=["current_balance", "updated_at"])
                return

            if self.transaction_type == TreasuryTransactionType.TRANSFER:
                if not self.destination_account_id:
                    raise ValidationError("الحساب الوجهة مطلوب للتحويل.")

                primary, destination = self._lock_transfer_accounts()

                new_source_balance = _money(primary.current_balance) - amount
                if new_source_balance < Decimal("0.00"):
                    raise ValidationError("الرصيد غير كافٍ لإتمام التحويل.")

                destination_new_balance = _money(destination.current_balance) + amount

                primary.current_balance = new_source_balance
                destination.current_balance = destination_new_balance

                primary.save(update_fields=["current_balance", "updated_at"])
                destination.save(update_fields=["current_balance", "updated_at"])
                return

    def reverse_balance_effect(self):
        amount = _money(self.amount)

        with transaction.atomic():
            if self.transaction_type in {
                TreasuryTransactionType.INCOME,
                TreasuryTransactionType.OPENING_BALANCE,
                TreasuryTransactionType.DEPOSIT,
                TreasuryTransactionType.ADJUSTMENT,
            }:
                primary = self._lock_primary_account()
                new_balance = _money(primary.current_balance) - amount

                if new_balance < Decimal("0.00"):
                    raise ValidationError(
                        "لا يمكن إلغاء الحركة لأن الإلغاء سيجعل رصيد الحساب سالبًا."
                    )

                primary.current_balance = new_balance
                primary.save(update_fields=["current_balance", "updated_at"])
                return

            if self.transaction_type in {
                TreasuryTransactionType.EXPENSE,
                TreasuryTransactionType.WITHDRAW,
            }:
                primary = self._lock_primary_account()
                primary.current_balance = _money(primary.current_balance) + amount
                primary.save(update_fields=["current_balance", "updated_at"])
                return

            if self.transaction_type == TreasuryTransactionType.TRANSFER:
                if not self.destination_account_id:
                    raise ValidationError("الحساب الوجهة مطلوب لعكس التحويل.")

                primary, destination = self._lock_transfer_accounts()

                destination_new_balance = _money(destination.current_balance) - amount
                if destination_new_balance < Decimal("0.00"):
                    raise ValidationError(
                        "لا يمكن إلغاء التحويل لأن رصيد الحساب الوجهة غير كافٍ."
                    )

                source_new_balance = _money(primary.current_balance) + amount

                primary.current_balance = source_new_balance
                destination.current_balance = destination_new_balance

                primary.save(update_fields=["current_balance", "updated_at"])
                destination.save(update_fields=["current_balance", "updated_at"])
                return