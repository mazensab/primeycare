# ============================================================
# 📂 contracts/models.py
# 🧠 Primey Care | Contracts Module
# ------------------------------------------------------------
# ✅ هذا الموديول يمثل طبقة الربط الرسمية بين:
#    - الجهات المقدمة للخدمة providers
#    - المنتجات products
# ✅ قابل للتوسع نحو:
#    - البرامج
#    - الخصومات
#    - الخدمات
#    - الأسعار
#    - نسبة النظام
#    - حدود الاستخدام
#    - شروط التغطية والتنفيذ
# ------------------------------------------------------------
# المرحلة الحالية:
# - Contract              العقد الرئيسي مع الجهة
# - ContractProduct       المنتجات المشمولة داخل العقد
# ============================================================

from django.core.exceptions import ValidationError
from django.db import models

from products.models import Product
from providers.models import Provider


class ContractStatus(models.TextChoices):
    DRAFT = "DRAFT", "مسودة"
    ACTIVE = "ACTIVE", "نشط"
    EXPIRED = "EXPIRED", "منتهي"
    TERMINATED = "TERMINATED", "ملغي"
    SUSPENDED = "SUSPENDED", "موقوف"


class PricingModel(models.TextChoices):
    FIXED = "FIXED", "سعر ثابت"
    PERCENTAGE = "PERCENTAGE", "نسبة"
    CUSTOM = "CUSTOM", "مخصص"
    FREE = "FREE", "مجاني"


class Contract(models.Model):
    # ========================================================
    # 🆔 البيانات الأساسية للعقد
    # ========================================================
    provider = models.ForeignKey(
        Provider,
        on_delete=models.CASCADE,
        related_name="contracts",
        verbose_name="الجهة المقدمة للخدمة",
    )
    title = models.CharField(
        max_length=255,
        verbose_name="عنوان العقد",
        help_text="اسم واضح للعقد ليسهل التعرف عليه",
    )
    contract_number = models.CharField(
        max_length=100,
        unique=True,
        verbose_name="رقم العقد",
        help_text="رقم مرجعي فريد للعقد",
    )
    status = models.CharField(
        max_length=20,
        choices=ContractStatus.choices,
        default=ContractStatus.DRAFT,
        verbose_name="حالة العقد",
    )

    # ========================================================
    # 📅 التواريخ
    # ========================================================
    start_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="تاريخ بداية العقد",
    )
    end_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="تاريخ نهاية العقد",
    )
    signed_at = models.DateField(
        null=True,
        blank=True,
        verbose_name="تاريخ التوقيع",
    )

    # ========================================================
    # 📞 بيانات الجهة داخل العقد
    # ========================================================
    provider_contact_name = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="اسم مسؤول الجهة",
    )
    provider_contact_phone = models.CharField(
        max_length=30,
        blank=True,
        verbose_name="جوال مسؤول الجهة",
    )
    provider_contact_email = models.EmailField(
        blank=True,
        verbose_name="بريد مسؤول الجهة",
    )

    # ========================================================
    # 💰 بيانات مالية عامة
    # ========================================================
    pricing_model = models.CharField(
        max_length=20,
        choices=PricingModel.choices,
        default=PricingModel.CUSTOM,
        verbose_name="آلية التسعير",
    )
    discount_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        verbose_name="نسبة الخصم العامة",
        help_text="خصم عام على مستوى العقد إن وجد",
    )
    system_commission_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        verbose_name="نسبة النظام",
        help_text="نسبة Primey Care من العمليات أو الخدمات المرتبطة بهذا العقد",
    )

    notes = models.TextField(
        blank=True,
        verbose_name="ملاحظات داخلية",
    )
    terms_and_conditions = models.TextField(
        blank=True,
        verbose_name="الشروط والأحكام",
    )

    # ========================================================
    # 🧾 التتبع
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
        db_table = "contracts"
        verbose_name = "عقد"
        verbose_name_plural = "العقود"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["provider"]),
            models.Index(fields=["start_date"]),
            models.Index(fields=["end_date"]),
            models.Index(fields=["pricing_model"]),
        ]

    def __str__(self):
        return f"{self.title} - {self.contract_number}"

    def clean(self):
        super().clean()

        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValidationError(
                {"end_date": "تاريخ نهاية العقد يجب أن يكون بعد تاريخ البداية."}
            )

        if self.discount_percentage is not None:
            if self.discount_percentage < 0 or self.discount_percentage > 100:
                raise ValidationError(
                    {"discount_percentage": "نسبة الخصم يجب أن تكون بين 0 و 100."}
                )

        if self.system_commission_percentage is not None:
            if self.system_commission_percentage < 0 or self.system_commission_percentage > 100:
                raise ValidationError(
                    {"system_commission_percentage": "نسبة النظام يجب أن تكون بين 0 و 100."}
                )


class ContractProduct(models.Model):
    # ========================================================
    # 🔗 ربط المنتجات داخل العقد
    # ========================================================
    contract = models.ForeignKey(
        Contract,
        on_delete=models.CASCADE,
        related_name="contract_products",
        verbose_name="العقد",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="product_contracts",
        verbose_name="المنتج",
    )

    # ========================================================
    # 💰 التسعير والخصم على مستوى المنتج داخل العقد
    # ========================================================
    is_active = models.BooleanField(
        default=True,
        verbose_name="نشط",
    )
    special_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="سعر خاص",
        help_text="يستخدم إذا كان للمنتج سعر خاص ضمن العقد",
    )
    discount_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        verbose_name="نسبة الخصم الخاصة",
        help_text="خصم خاص لهذا المنتج داخل العقد",
    )
    coverage_notes = models.TextField(
        blank=True,
        verbose_name="ملاحظات التغطية",
        help_text="تفاصيل أو شروط خاصة بهذا المنتج ضمن العقد",
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
        db_table = "contract_products"
        verbose_name = "منتج داخل عقد"
        verbose_name_plural = "منتجات العقود"
        ordering = ["-created_at"]
        unique_together = ("contract", "product")
        indexes = [
            models.Index(fields=["contract"]),
            models.Index(fields=["product"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return f"{self.contract.contract_number} - {self.product}"

    def clean(self):
        super().clean()

        if self.discount_percentage is not None:
            if self.discount_percentage < 0 or self.discount_percentage > 100:
                raise ValidationError(
                    {"discount_percentage": "نسبة الخصم يجب أن تكون بين 0 و 100."}
                )

        if self.special_price is not None and self.special_price < 0:
            raise ValidationError(
                {"special_price": "السعر الخاص لا يمكن أن يكون سالبًا."}
            )