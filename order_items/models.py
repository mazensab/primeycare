# ============================================================
# 📂 order_items/models.py
# 🧠 Primey Care | Order Items Module
# ------------------------------------------------------------
# ✅ هذا الموديول يمثل العناصر التشغيلية الفعلية داخل الطلب
# ✅ يربط الطلب مع:
#    - المنتج
#    - الخدمة التشغيلية
#    - الجهة المقدمة
#    - العقد المرجعي
# ✅ يحتفظ بلقطة سعرية وقت إنشاء الطلب
# ✅ جاهز لاحقًا للربط مع:
#    - الموافقات
#    - التنفيذ
#    - المطالبات
#    - الفوترة
#    - السداد
# ============================================================

from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models

from contracts.models import Contract, ContractProduct
from orders.models import Order
from products.models import Product
from providers.models import Provider
from service_items.models import ContractServiceItem


class OrderItemStatus(models.TextChoices):
    PENDING = "PENDING", "قيد الانتظار"
    APPROVAL_PENDING = "APPROVAL_PENDING", "بانتظار الموافقة"
    APPROVED = "APPROVED", "تمت الموافقة"
    REJECTED = "REJECTED", "مرفوض"
    SCHEDULED = "SCHEDULED", "مجدول"
    IN_PROGRESS = "IN_PROGRESS", "قيد التنفيذ"
    COMPLETED = "COMPLETED", "مكتمل"
    CANCELLED = "CANCELLED", "ملغي"


class FulfillmentStatus(models.TextChoices):
    NOT_STARTED = "NOT_STARTED", "لم يبدأ"
    PARTIAL = "PARTIAL", "منفذ جزئيًا"
    COMPLETED = "COMPLETED", "منفذ بالكامل"
    FAILED = "FAILED", "فشل التنفيذ"
    CANCELLED = "CANCELLED", "تم الإلغاء"


class OrderItem(models.Model):
    # ========================================================
    # 🔗 الربط الأساسي
    # ========================================================
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="items",
        verbose_name="الطلب",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="order_items",
        verbose_name="المنتج",
    )
    provider = models.ForeignKey(
        Provider,
        on_delete=models.PROTECT,
        related_name="order_items",
        null=True,
        blank=True,
        verbose_name="الجهة المقدمة",
    )
    contract = models.ForeignKey(
        Contract,
        on_delete=models.PROTECT,
        related_name="order_items",
        null=True,
        blank=True,
        verbose_name="العقد المرجعي",
    )
    contract_product = models.ForeignKey(
        ContractProduct,
        on_delete=models.PROTECT,
        related_name="order_items",
        null=True,
        blank=True,
        verbose_name="المنتج داخل العقد",
    )
    service_item = models.ForeignKey(
        ContractServiceItem,
        on_delete=models.PROTECT,
        related_name="order_items",
        null=True,
        blank=True,
        verbose_name="الخدمة التشغيلية",
    )

    # ========================================================
    # 🆔 بيانات العنصر
    # ========================================================
    title = models.CharField(
        max_length=255,
        verbose_name="عنوان العنصر",
        help_text="اسم واضح لما تم طلبه فعليًا",
    )
    code = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="كود العنصر",
        help_text="كود داخلي أو مرجعي اختياري",
    )
    status = models.CharField(
        max_length=30,
        choices=OrderItemStatus.choices,
        default=OrderItemStatus.PENDING,
        verbose_name="حالة العنصر",
    )
    fulfillment_status = models.CharField(
        max_length=20,
        choices=FulfillmentStatus.choices,
        default=FulfillmentStatus.NOT_STARTED,
        verbose_name="حالة التنفيذ",
    )

    # ========================================================
    # 🔢 الكمية
    # ========================================================
    quantity = models.PositiveIntegerField(
        default=1,
        verbose_name="الكمية",
    )

    # ========================================================
    # 💰 اللقطة السعرية وقت الطلب
    # ========================================================
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="سعر الوحدة",
    )
    discount_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="نسبة الخصم",
    )
    discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="قيمة الخصم",
    )
    net_unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="صافي سعر الوحدة",
    )
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="الإجمالي النهائي",
    )

    # ========================================================
    # ✅ الموافقات والتنفيذ
    # ========================================================
    requires_approval = models.BooleanField(
        default=False,
        verbose_name="يتطلب موافقة",
    )
    approval_notes = models.TextField(
        blank=True,
        verbose_name="ملاحظات الموافقة",
    )
    execution_notes = models.TextField(
        blank=True,
        verbose_name="ملاحظات التنفيذ",
    )
    internal_notes = models.TextField(
        blank=True,
        verbose_name="ملاحظات داخلية",
    )

    # ========================================================
    # 📅 تواريخ تشغيلية
    # ========================================================
    scheduled_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="موعد التنفيذ",
    )
    fulfilled_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ الإكمال",
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
        db_table = "order_items"
        verbose_name = "عنصر طلب"
        verbose_name_plural = "عناصر الطلبات"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["order"]),
            models.Index(fields=["product"]),
            models.Index(fields=["provider"]),
            models.Index(fields=["contract"]),
            models.Index(fields=["service_item"]),
            models.Index(fields=["status"]),
            models.Index(fields=["fulfillment_status"]),
            models.Index(fields=["requires_approval"]),
        ]

    def __str__(self):
        return f"{self.title} - Order #{self.order_id}"

    def clean(self):
        super().clean()

        if self.quantity < 1:
            raise ValidationError({"quantity": "الكمية يجب أن تكون أكبر من أو تساوي 1."})

        if self.discount_percentage < 0 or self.discount_percentage > 100:
            raise ValidationError(
                {"discount_percentage": "نسبة الخصم يجب أن تكون بين 0 و 100."}
            )

        for field_name in ["unit_price", "discount_amount", "net_unit_price", "total_amount"]:
            value = getattr(self, field_name)
            if value is not None and value < 0:
                raise ValidationError({field_name: "القيمة لا يمكن أن تكون سالبة."})

        if self.contract and self.provider and self.contract.provider_id != self.provider_id:
            raise ValidationError(
                {"contract": "العقد المحدد لا ينتمي إلى الجهة المقدمة المختارة."}
            )

        if (
            self.contract_product
            and self.contract
            and self.contract_product.contract_id != self.contract_id
        ):
            raise ValidationError(
                {"contract_product": "المنتج داخل العقد لا ينتمي إلى نفس العقد المحدد."}
            )

        if self.service_item:
            if self.contract and self.service_item.contract_id != self.contract_id:
                raise ValidationError(
                    {"service_item": "الخدمة لا تنتمي إلى نفس العقد المحدد."}
                )

            if (
                self.contract_product
                and self.service_item.contract_product_id
                and self.service_item.contract_product_id != self.contract_product_id
            ):
                raise ValidationError(
                    {"service_item": "الخدمة لا تنتمي إلى المنتج داخل العقد المحدد."}
                )

            if self.provider and self.service_item.contract.provider_id != self.provider_id:
                raise ValidationError(
                    {"provider": "الخدمة المختارة مرتبطة بجهة مختلفة عن الجهة المحددة."}
                )

            if self.requires_approval is False and self.service_item.requires_approval:
                self.requires_approval = True

        if self.contract and not self.provider:
            self.provider = self.contract.provider

    def save(self, *args, **kwargs):
        self.full_clean()
        self._recalculate_totals()
        super().save(*args, **kwargs)

    def _recalculate_totals(self):
        quantity = Decimal(self.quantity or 1)
        unit_price = Decimal(self.unit_price or Decimal("0.00"))
        discount_percentage = Decimal(self.discount_percentage or Decimal("0.00"))
        discount_amount = Decimal(self.discount_amount or Decimal("0.00"))

        percentage_discount_value = (unit_price * discount_percentage) / Decimal("100")
        net_unit = unit_price - percentage_discount_value - discount_amount

        if net_unit < 0:
            net_unit = Decimal("0.00")

        total = net_unit * quantity

        self.net_unit_price = net_unit.quantize(Decimal("0.01"))
        self.total_amount = total.quantize(Decimal("0.01"))