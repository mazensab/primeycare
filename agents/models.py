# ============================================================
# 📂 agents/models.py
# 🧠 Primey Care | Agents & Commissions Module
# ------------------------------------------------------------
# ✅ هذا الموديول يمثل:
#    - المندوبين
#    - أكواد المندوبين
#    - ربط الطلبات بالمندوبين
#    - احتساب العمولات
#    - تتبع الصرف والاستحقاق
# ✅ جاهز لاحقًا للتوسع نحو:
#    - محافظ المندوبين
#    - كشف حساب المندوب
#    - دفعات العمولات
#    - نسب عمولة حسب المنتج أو التصنيف
# ============================================================

from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db import models

from customers.models import Customer
from orders.models import Order
from payments.models import Payment


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
        default=Decimal("0.00"),
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
        default=Decimal("0.00"),
        verbose_name="قيمة البيع المحتسبة",
    )
    commission_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
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
        ]

    def __str__(self):
        return f"Order #{self.order_id} - {self.agent.full_name}"

    def clean(self):
        super().clean()

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
        if not self.commission_type:
            self.commission_type = self.agent.default_commission_type
        if self.commission_value in (None, Decimal("0.00")):
            self.commission_value = self.agent.default_commission_value

        self.full_clean()
        self._recalculate_commission_amount()
        super().save(*args, **kwargs)

    def _recalculate_commission_amount(self):
        sales_amount = Decimal(self.sales_amount or Decimal("0.00"))
        commission_value = Decimal(self.commission_value or Decimal("0.00"))

        if self.commission_type == CommissionType.PERCENTAGE:
            amount = (sales_amount * commission_value) / Decimal("100")
        else:
            amount = commission_value

        self.commission_amount = amount.quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )


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
        default=Decimal("0.00"),
        verbose_name="قيمة الأساس",
    )
    commission_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="قيمة العمولة",
    )
    paid_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
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
            models.Index(fields=["paid_at"]),
        ]

    def __str__(self):
        return f"{self.agent.full_name} - {self.order_id} - {self.commission_amount}"

    def clean(self):
        super().clean()

        for field_name in ["base_amount", "commission_amount", "paid_amount"]:
            value = getattr(self, field_name)
            if value is not None and value < 0:
                raise ValidationError({field_name: "القيمة لا يمكن أن تكون سالبة."})

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

        if self.paid_amount > self.commission_amount:
            raise ValidationError(
                {"paid_amount": "المبلغ المصروف لا يمكن أن يكون أكبر من قيمة العمولة."}
            )