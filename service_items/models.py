# ============================================================
# 📂 service_items/models.py
# 🧠 Primey Care | Service Items Module
# ------------------------------------------------------------
# ✅ هذا الموديول يمثل الخدمات التشغيلية الفعلية داخل العقود
# ✅ مرتبط بالعقد وبالمنتج داخل العقد
# ✅ جاهز لاحقًا للربط مع:
#    - الطلبات
#    - التنفيذ
#    - الموافقات
#    - التغطية
#    - الخصومات التفصيلية
#    - المطالبات والفوترة
# ------------------------------------------------------------
# المرحلة الحالية تشمل:
# - ContractServiceItem
# ============================================================

from django.core.exceptions import ValidationError
from django.db import models

from contracts.models import Contract, ContractProduct


class ServiceItemStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "نشط"
    INACTIVE = "INACTIVE", "غير نشط"
    DRAFT = "DRAFT", "مسودة"
    SUSPENDED = "SUSPENDED", "موقوف"


class CoverageType(models.TextChoices):
    INCLUDED = "INCLUDED", "مشمول"
    DISCOUNTED = "DISCOUNTED", "مخفض"
    CASH_ONLY = "CASH_ONLY", "نقدي فقط"
    APPROVAL_REQUIRED = "APPROVAL_REQUIRED", "يتطلب موافقة"
    NOT_INCLUDED = "NOT_INCLUDED", "غير مشمول"


class ContractServiceItem(models.Model):
    # ========================================================
    # 🔗 الربط الأساسي
    # ========================================================
    contract = models.ForeignKey(
        Contract,
        on_delete=models.CASCADE,
        related_name="service_items",
        verbose_name="العقد",
    )
    contract_product = models.ForeignKey(
        ContractProduct,
        on_delete=models.CASCADE,
        related_name="service_items",
        null=True,
        blank=True,
        verbose_name="المنتج داخل العقد",
        help_text="اختياري في المرحلة الحالية، ويستخدم عند ربط الخدمة بمنتج محدد داخل العقد",
    )

    # ========================================================
    # 🆔 بيانات الخدمة
    # ========================================================
    name = models.CharField(
        max_length=255,
        verbose_name="اسم الخدمة",
        help_text="مثل: كشف طبي، أشعة، تحليل، تنظيف أسنان، عملية ولادة...",
    )
    code = models.CharField(
        max_length=100,
        verbose_name="كود الخدمة",
        help_text="كود داخلي للخدمة داخل النظام",
    )
    status = models.CharField(
        max_length=20,
        choices=ServiceItemStatus.choices,
        default=ServiceItemStatus.ACTIVE,
        verbose_name="الحالة",
    )
    coverage_type = models.CharField(
        max_length=30,
        choices=CoverageType.choices,
        default=CoverageType.INCLUDED,
        verbose_name="نوع التغطية",
    )

    # ========================================================
    # 📝 الوصف والتفاصيل التشغيلية
    # ========================================================
    short_description = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="وصف مختصر",
    )
    description = models.TextField(
        blank=True,
        verbose_name="الوصف التفصيلي",
    )
    execution_notes = models.TextField(
        blank=True,
        verbose_name="ملاحظات التنفيذ",
        help_text="تعليمات أو ملاحظات تشغيلية خاصة بهذه الخدمة",
    )
    coverage_notes = models.TextField(
        blank=True,
        verbose_name="ملاحظات التغطية",
    )

    # ========================================================
    # 💰 التسعير والخصم
    # ========================================================
    base_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="السعر الأساسي",
        help_text="السعر المرجعي للخدمة قبل أي خصم أو تغطية",
    )
    special_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="السعر الخاص",
        help_text="سعر خاص ضمن هذا العقد إن وجد",
    )
    discount_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        verbose_name="نسبة الخصم",
    )
    requires_approval = models.BooleanField(
        default=False,
        verbose_name="يتطلب موافقة",
    )

    # ========================================================
    # 🔢 الحدود والاستخدام
    # ========================================================
    max_usage_per_customer = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="الحد الأقصى لكل عميل",
        help_text="عدد مرات الاستخدام المسموحة لكل عميل إن وجدت",
    )
    validity_days = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="صلاحية بالأيام",
        help_text="عدد الأيام المسموح فيها باستخدام هذه الخدمة بعد التفعيل أو الشراء",
    )

    # ========================================================
    # ⭐ خصائص إضافية
    # ========================================================
    is_featured = models.BooleanField(
        default=False,
        verbose_name="خدمة مميزة",
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
        db_table = "contract_service_items"
        verbose_name = "خدمة عقد"
        verbose_name_plural = "خدمات العقود"
        ordering = ["sort_order", "name"]
        unique_together = ("contract", "code")
        indexes = [
            models.Index(fields=["contract"]),
            models.Index(fields=["contract_product"]),
            models.Index(fields=["status"]),
            models.Index(fields=["coverage_type"]),
            models.Index(fields=["is_featured"]),
            models.Index(fields=["sort_order"]),
        ]

    def __str__(self):
        return f"{self.name} - {self.contract.contract_number}"

    def clean(self):
        super().clean()

        if self.contract_product and self.contract_product.contract_id != self.contract_id:
            raise ValidationError(
                {
                    "contract_product": "المنتج المختار لا ينتمي إلى نفس العقد المحدد."
                }
            )

        if self.discount_percentage is not None:
            if self.discount_percentage < 0 or self.discount_percentage > 100:
                raise ValidationError(
                    {"discount_percentage": "نسبة الخصم يجب أن تكون بين 0 و 100."}
                )

        if self.base_price is not None and self.base_price < 0:
            raise ValidationError(
                {"base_price": "السعر الأساسي لا يمكن أن يكون سالبًا."}
            )

        if self.special_price is not None and self.special_price < 0:
            raise ValidationError(
                {"special_price": "السعر الخاص لا يمكن أن يكون سالبًا."}
            )

        if self.coverage_type == CoverageType.APPROVAL_REQUIRED:
            self.requires_approval = True