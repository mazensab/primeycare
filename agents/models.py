# ============================================================
# 📂 agents/models.py
# 🧠 Primey Care | Agents & Commissions Module
# ------------------------------------------------------------
# ✅ المندوبين
# ✅ أكواد الإحالة
# ✅ ربط الطلبات بالمندوبين
# ✅ احتساب العمولات
# ✅ تتبع الاستحقاق / الاعتماد / الصرف
# ✅ جاهز لربط API + Frontend + Accounting
# ============================================================

from decimal import Decimal, ROUND_HALF_UP

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


class AgentStatus(models.TextChoices):
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


class Agent(models.Model):
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
        verbose_name="الحالة",
    )

    # ========================================================
    # 📞 بيانات التواصل
    # ========================================================
    phone = models.CharField(
        max_length=30,
        blank=True,
        verbose_name="رقم الجوال",
    )
    email = models.EmailField(
        blank=True,
        verbose_name="البريد الإلكتروني",
    )
    city = models.CharField(
        max_length=100,
        blank=True,
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
        db_table = "agents"
        verbose_name = "مندوب"
        verbose_name_plural = "المندوبون"
        ordering = ["full_name"]
        indexes = [
            models.Index(fields=["agent_code"]),
            models.Index(fields=["referral_code"]),
            models.Index(fields=["status"]),
            models.Index(fields=["city"]),
        ]

    def __str__(self):
        return f"{self.full_name} ({self.agent_code})"

    def clean(self):
        super().clean()

        self.agent_code = (self.agent_code or "").strip().upper()
        self.referral_code = (self.referral_code or "").strip().upper()
        self.phone = (self.phone or "").strip()
        self.email = (self.email or "").strip().lower()
        self.city = (self.city or "").strip()
        self.iban = (self.iban or "").strip().replace(" ", "").upper()

        if not self.full_name or not self.full_name.strip():
            raise ValidationError({"full_name": "اسم المندوب مطلوب."})

        if not self.agent_code:
            raise ValidationError({"agent_code": "كود المندوب مطلوب."})

        if not self.referral_code:
            raise ValidationError({"referral_code": "كود الإحالة مطلوب."})

        if self.default_commission_value is not None and self.default_commission_value < 0:
            raise ValidationError(
                {"default_commission_value": "قيمة العمولة لا يمكن أن تكون سالبة."}
            )

        if (
            self.default_commission_type == CommissionType.PERCENTAGE
            and self.default_commission_value > 100
        ):
            raise ValidationError(
                {"default_commission_value": "النسبة المئوية يجب أن تكون بين 0 و 100."}
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        self.default_commission_value = money(self.default_commission_value)
        super().save(*args, **kwargs)


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
        verbose_name="كود الإحالة المستخدم",
    )
    notes = models.TextField(
        blank=True,
        verbose_name="ملاحظات",
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
        db_table = "agent_orders"
        verbose_name = "طلب مرتبط بمندوب"
        verbose_name_plural = "الطلبات المرتبطة بالمندوبين"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["agent"]),
            models.Index(fields=["customer"]),
            models.Index(fields=["commission_type"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"Order #{self.order_id} - {self.agent.full_name}"

    def clean(self):
        super().clean()

        if not self.agent_id:
            raise ValidationError({"agent": "المندوب مطلوب."})

        if not self.order_id:
            raise ValidationError({"order": "الطلب مطلوب."})

        if not self.customer_id:
            raise ValidationError({"customer": "العميل مطلوب."})

        if self.agent_id and self.agent.status != AgentStatus.ACTIVE:
            raise ValidationError({"agent": "لا يمكن ربط الطلب بمندوب غير نشط."})

        order_customer_id = getattr(self.order, "customer_id", None)
        if self.customer_id and order_customer_id and self.customer_id != order_customer_id:
            raise ValidationError(
                {"customer": "العميل المحدد لا يطابق العميل المرتبط بالطلب."}
            )

        if self.commission_value is not None and self.commission_value < 0:
            raise ValidationError(
                {"commission_value": "قيمة العمولة لا يمكن أن تكون سالبة."}
            )

        if self.sales_amount is not None and self.sales_amount < 0:
            raise ValidationError(
                {"sales_amount": "قيمة البيع لا يمكن أن تكون سالبة."}
            )

        if (
            self.commission_type == CommissionType.PERCENTAGE
            and self.commission_value > 100
        ):
            raise ValidationError(
                {"commission_value": "النسبة المئوية يجب أن تكون بين 0 و 100."}
            )

    def save(self, *args, **kwargs):
        if self.agent_id:
            if not self.commission_type:
                self.commission_type = self.agent.default_commission_type

            if self.commission_value is None:
                self.commission_value = self.agent.default_commission_value

            if not self.referral_code_used:
                self.referral_code_used = self.agent.referral_code

        self.sales_amount = money(self.sales_amount)
        self.commission_value = money(self.commission_value)

        self.full_clean()
        self.recalculate_commission_amount()

        super().save(*args, **kwargs)

    def recalculate_commission_amount(self):
        sales_amount = money(self.sales_amount)
        commission_value = money(self.commission_value)

        if self.commission_type == CommissionType.PERCENTAGE:
            amount = (sales_amount * commission_value) / Decimal("100")
        else:
            amount = commission_value

        self.commission_amount = money(amount)


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

    earned_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ الاستحقاق",
    )
    approved_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ الاعتماد",
    )
    paid_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ الصرف",
    )

    notes = models.TextField(
        blank=True,
        verbose_name="ملاحظات",
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
        db_table = "agent_commissions"
        verbose_name = "عمولة مندوب"
        verbose_name_plural = "عمولات المندوبين"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["agent"]),
            models.Index(fields=["order"]),
            models.Index(fields=["payment"]),
            models.Index(fields=["commission_status"]),
            models.Index(fields=["earned_at"]),
            models.Index(fields=["approved_at"]),
            models.Index(fields=["paid_at"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"{self.agent.full_name} - {self.order_id} - {self.commission_amount}"

    @property
    def remaining_amount(self) -> Decimal:
        remaining = money(self.commission_amount) - money(self.paid_amount)
        return remaining if remaining > MONEY_ZERO else MONEY_ZERO

    def sync_from_agent_order(self):
        if not self.agent_order_id:
            return

        self.agent = self.agent_order.agent
        self.order = self.agent_order.order

        if not self.base_amount or self.base_amount == MONEY_ZERO:
            self.base_amount = self.agent_order.sales_amount

        if not self.commission_amount or self.commission_amount == MONEY_ZERO:
            self.commission_amount = self.agent_order.commission_amount

    def clean(self):
        super().clean()

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

        if self.payment_id and self.order_id and self.payment.order_id != self.order_id:
            raise ValidationError(
                {"payment": "عملية الدفع المحددة لا تنتمي إلى نفس الطلب."}
            )

        for field_name in ["base_amount", "commission_amount", "paid_amount"]:
            value = getattr(self, field_name)
            if value is not None and value < 0:
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

    def save(self, *args, **kwargs):
        self.sync_from_agent_order()

        self.base_amount = money(self.base_amount)
        self.commission_amount = money(self.commission_amount)
        self.paid_amount = money(self.paid_amount)

        if (
            self.commission_status != CommissionStatus.CANCELLED
            and self.commission_status != CommissionStatus.REVERSED
            and self.commission_amount > MONEY_ZERO
            and self.paid_amount == self.commission_amount
        ):
            self.commission_status = CommissionStatus.PAID
            if not self.paid_at:
                self.paid_at = timezone.now()

        self.full_clean()
        super().save(*args, **kwargs)