# ============================================================
# 📂 contracts/models.py
# 🧠 Primey Care | Contracts Module V2.7
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
#    - عروض صفحة الهبوط والتطبيق
# ------------------------------------------------------------
# القاعدة المعتمدة:
# - Product = منتج ثابت في الكتالوج
# - Provider = مقدم خدمة
# - Contract = عقد مقدم الخدمة
# - ContractProduct = عرض/تسعير المنتج داخل عقد مقدم الخدمة
# ------------------------------------------------------------
# مهم:
# - المنتج لا يرتبط بمقدم الخدمة مباشرة.
# - مقدم الخدمة يأتي من العقد: Contract.provider
# - العرض الذي يراه العميل يأتي من ContractProduct
# - الطلب يحفظ contract_product كسناب شوت للعرض والسعر
# ============================================================

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from products.models import Product
from providers.models import Provider


# ============================================================
# 🧩 Choices
# ============================================================

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


# ============================================================
# 🧾 Contract
# ============================================================

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
        default=Decimal("0.00"),
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        verbose_name="نسبة الخصم العامة",
        help_text="خصم عام على مستوى العقد إن وجد",
    )

    system_commission_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(0), MaxValueValidator(100)],
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
            models.Index(fields=["status", "start_date", "end_date"]),
            models.Index(fields=["provider", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.title} - {self.contract_number}"

    @property
    def is_active(self) -> bool:
        return self.status == ContractStatus.ACTIVE

    @property
    def is_currently_valid(self) -> bool:
        today = timezone.localdate()

        if self.status != ContractStatus.ACTIVE:
            return False

        if self.start_date and self.start_date > today:
            return False

        if self.end_date and self.end_date < today:
            return False

        return True

    def _normalize_strings(self) -> None:
        self.title = (self.title or "").strip()
        self.contract_number = (self.contract_number or "").strip()
        self.provider_contact_name = (self.provider_contact_name or "").strip()
        self.provider_contact_phone = (self.provider_contact_phone or "").strip()
        self.provider_contact_email = (self.provider_contact_email or "").strip().lower()
        self.notes = (self.notes or "").strip()
        self.terms_and_conditions = (self.terms_and_conditions or "").strip()

    def clean(self) -> None:
        super().clean()
        self._normalize_strings()

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

    def save(self, *args, **kwargs):
        self._normalize_strings()
        self.full_clean()
        super().save(*args, **kwargs)


# ============================================================
# 🧾 Contract Product / Provider Offer
# ============================================================

class ContractProduct(models.Model):
    # ========================================================
    # 🔗 ربط المنتج داخل عقد مقدم الخدمة
    # --------------------------------------------------------
    # المنتج لا يرتبط بمقدم الخدمة مباشرة.
    # مقدم الخدمة يأتي من العقد:
    # self.contract.provider
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
    # ⚙️ الحالة والتحكم
    # ========================================================
    is_active = models.BooleanField(
        default=True,
        verbose_name="نشط",
    )

    priority = models.PositiveIntegerField(
        default=100,
        verbose_name="ترتيب العرض",
        help_text="كلما كان الرقم أقل ظهر العرض قبل غيره.",
    )

    # ========================================================
    # 💰 التسعير والخصم داخل العقد
    # ========================================================
    price_before_discount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="السعر قبل الخصم",
        help_text="السعر الفعلي للمنتج لدى مقدم الخدمة قبل الخصم.",
    )

    discount_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        verbose_name="نسبة الخصم الخاصة",
        help_text="خصم خاص لهذا المنتج داخل العقد.",
    )

    price_after_discount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="السعر بعد الخصم",
        help_text="السعر النهائي المعروض للعميل بعد الخصم.",
    )

    # حقل قديم موجود سابقًا.
    # أبقيناه لحماية التوافق مع أي كود قديم يعتمد عليه.
    special_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="سعر خاص قديم",
        help_text="حقل توافق قديم. يفضل استخدام السعر قبل الخصم والسعر بعد الخصم في التطوير الجديد.",
    )

    system_commission_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        verbose_name="نسبة النظام الخاصة",
        help_text="إن تركت فارغة سيتم استخدام نسبة النظام من العقد.",
    )

    # ========================================================
    # 🧾 التغطية والشروط
    # ========================================================
    coverage_notes = models.TextField(
        blank=True,
        verbose_name="ملاحظات التغطية",
        help_text="تفاصيل أو شروط خاصة بهذا المنتج ضمن العقد.",
    )

    terms = models.TextField(
        blank=True,
        verbose_name="شروط المنتج داخل العقد",
        help_text="شروط تنفيذ أو استخدام هذا المنتج لدى مقدم الخدمة.",
    )

    usage_limit = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="حد الاستخدام",
        help_text="عدد مرات الاستخدام المسموح بها إن وجد.",
    )

    # ========================================================
    # 🏷️ بيانات العرض التسويقي
    # ========================================================
    offer_title = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="عنوان العرض",
        help_text="عنوان تسويقي يظهر في صفحة الهبوط أو التطبيق.",
    )

    offer_subtitle = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="وصف مختصر للعرض",
    )

    offer_badge = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="شارة العرض",
        help_text="مثال: عرض خاص، الأكثر طلبًا، خصم محدود.",
    )

    offer_description = models.TextField(
        blank=True,
        verbose_name="وصف العرض",
    )

    offer_terms = models.TextField(
        blank=True,
        verbose_name="شروط العرض",
    )

    offer_start_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="تاريخ بداية العرض",
    )

    offer_end_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="تاريخ نهاية العرض",
    )

    marketing_image_url = models.URLField(
        max_length=1000,
        blank=True,
        verbose_name="رابط صورة العرض",
    )

    marketing_image_alt_text = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="النص البديل لصورة العرض",
    )

    # ========================================================
    # 👁️ الظهور في القنوات
    # ========================================================
    show_on_landing = models.BooleanField(
        default=False,
        verbose_name="إظهار في صفحة الهبوط",
    )

    show_on_mobile = models.BooleanField(
        default=False,
        verbose_name="إظهار في التطبيق",
    )

    show_on_offers = models.BooleanField(
        default=False,
        verbose_name="إظهار في صفحة العروض",
    )

    is_featured = models.BooleanField(
        default=False,
        verbose_name="عرض مميز",
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
        db_table = "contract_products"
        verbose_name = "منتج داخل عقد"
        verbose_name_plural = "منتجات العقود"
        ordering = ["priority", "-is_featured", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["contract", "product"],
                name="unique_contract_product",
            ),
        ]
        indexes = [
            models.Index(fields=["contract"]),
            models.Index(fields=["product"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["show_on_landing"]),
            models.Index(fields=["show_on_mobile"]),
            models.Index(fields=["show_on_offers"]),
            models.Index(fields=["is_featured"]),
            models.Index(fields=["priority"]),
            models.Index(fields=["offer_start_date"]),
            models.Index(fields=["offer_end_date"]),
            models.Index(fields=["is_active", "show_on_landing"]),
            models.Index(fields=["is_active", "show_on_offers"]),
            models.Index(fields=["product", "is_active"]),
            models.Index(fields=["contract", "is_active"]),
        ]

    def __str__(self) -> str:
        contract_number = getattr(self.contract, "contract_number", "") or f"Contract #{self.contract_id}"
        product_name = getattr(self.product, "name", "") or f"Product #{self.product_id}"
        return f"{contract_number} - {product_name}"

    # ========================================================
    # 🔹 Money / Percent Helpers
    # ========================================================
    def _money(self, value, default: Decimal = Decimal("0.00")) -> Decimal:
        if value in (None, ""):
            parsed = default
        else:
            try:
                parsed = Decimal(str(value))
            except Exception:
                parsed = default

        if parsed < Decimal("0.00"):
            parsed = Decimal("0.00")

        return parsed.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    def _percent(self, value, default: Decimal = Decimal("0.00")) -> Decimal:
        parsed = self._money(value, default)

        if parsed > Decimal("100.00"):
            parsed = Decimal("100.00")

        return parsed

    # ========================================================
    # 🔹 Relation Helpers
    # ========================================================
    @property
    def provider(self):
        return self.contract.provider if self.contract_id else None

    # ========================================================
    # 🔹 Commission Helpers
    # ========================================================
    @property
    def effective_system_commission_percentage(self) -> Decimal:
        if self.system_commission_percentage is not None:
            return self._percent(self.system_commission_percentage)

        if self.contract and self.contract.system_commission_percentage is not None:
            return self._percent(self.contract.system_commission_percentage)

        return Decimal("0.00")

    # ========================================================
    # 🔹 Price Helpers
    # ========================================================
    @property
    def effective_price_before_discount(self) -> Decimal:
        if self.price_before_discount is not None:
            return self._money(self.price_before_discount)

        product_price_fields = [
            "base_price",
            "price_before_discount",
            "original_price",
            "price",
        ]

        for field_name in product_price_fields:
            if hasattr(self.product, field_name):
                value = getattr(self.product, field_name)
                if value is not None:
                    return self._money(value)

        if self.special_price is not None:
            return self._money(self.special_price)

        if self.price_after_discount is not None:
            return self._money(self.price_after_discount)

        return Decimal("0.00")

    @property
    def effective_price_after_discount(self) -> Decimal:
        if self.price_after_discount is not None:
            return self._money(self.price_after_discount)

        if self.special_price is not None:
            return self._money(self.special_price)

        price_before_discount = self.effective_price_before_discount
        discount = self._percent(self.discount_percentage)

        if price_before_discount <= Decimal("0.00"):
            return Decimal("0.00")

        if discount <= Decimal("0.00"):
            return self._money(price_before_discount)

        discount_amount = (price_before_discount * discount) / Decimal("100.00")
        return self._money(price_before_discount - discount_amount)

    @property
    def discount_amount(self) -> Decimal:
        amount = self.effective_price_before_discount - self.effective_price_after_discount

        if amount < Decimal("0.00"):
            return Decimal("0.00")

        return self._money(amount)

    @property
    def has_discount(self) -> bool:
        return self.effective_price_after_discount < self.effective_price_before_discount

    # ========================================================
    # 🔹 Availability Helpers
    # ========================================================
    @property
    def is_offer_date_valid(self) -> bool:
        today = timezone.localdate()

        if self.offer_start_date and self.offer_start_date > today:
            return False

        if self.offer_end_date and self.offer_end_date < today:
            return False

        return True

    @property
    def is_currently_available(self) -> bool:
        return bool(
            self.is_active
            and self.contract
            and self.contract.is_currently_valid
            and self.product
            and self.is_product_active
            and self.is_offer_date_valid
        )

    @property
    def is_product_active(self) -> bool:
        product_status = str(getattr(self.product, "status", "") or "").strip().lower()
        return product_status == "active"

    # ========================================================
    # 🔹 Payload Helpers
    # ========================================================
    @property
    def checkout_payload(self) -> dict:
        provider = self.provider

        return {
            "offer_id": self.id,
            "contract_product_id": self.id,
            "contract_id": self.contract_id,
            "product_id": self.product_id,
            "provider_id": getattr(provider, "id", None),
            "offer_source": "contract_product",
            "offer_title": self.offer_title or getattr(self.product, "name", ""),
            "offer_badge": self.offer_badge,
            "price_before_discount": str(self.effective_price_before_discount),
            "price_after_discount": str(self.effective_price_after_discount),
            "discount_percentage": str(self._percent(self.discount_percentage)),
            "discount_amount": str(self.discount_amount),
            "unit_price_before_discount": str(self.effective_price_before_discount),
            "unit_discount_percentage": str(self._percent(self.discount_percentage)),
            "unit_price": str(self.effective_price_after_discount),
            "currency_code": getattr(self.product, "currency_code", "SAR") or "SAR",
        }

    # ========================================================
    # 🔹 Cleaning / Validation
    # ========================================================
    def _normalize_strings(self) -> None:
        self.coverage_notes = (self.coverage_notes or "").strip()
        self.terms = (self.terms or "").strip()
        self.offer_title = (self.offer_title or "").strip()
        self.offer_subtitle = (self.offer_subtitle or "").strip()
        self.offer_badge = (self.offer_badge or "").strip()
        self.offer_description = (self.offer_description or "").strip()
        self.offer_terms = (self.offer_terms or "").strip()
        self.marketing_image_url = (self.marketing_image_url or "").strip()
        self.marketing_image_alt_text = (self.marketing_image_alt_text or "").strip()

    def clean(self) -> None:
        super().clean()
        self._normalize_strings()

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

        if self.price_before_discount is not None and self.price_before_discount < 0:
            raise ValidationError(
                {"price_before_discount": "السعر قبل الخصم لا يمكن أن يكون سالبًا."}
            )

        if self.price_after_discount is not None and self.price_after_discount < 0:
            raise ValidationError(
                {"price_after_discount": "السعر بعد الخصم لا يمكن أن يكون سالبًا."}
            )

        if self.special_price is not None and self.special_price < 0:
            raise ValidationError(
                {"special_price": "السعر الخاص لا يمكن أن يكون سالبًا."}
            )

        if (
            self.price_before_discount is not None
            and self.price_after_discount is not None
            and self.price_after_discount > self.price_before_discount
        ):
            raise ValidationError(
                {"price_after_discount": "السعر بعد الخصم لا يجب أن يكون أكبر من السعر قبل الخصم."}
            )

        if (
            self.offer_start_date
            and self.offer_end_date
            and self.offer_end_date < self.offer_start_date
        ):
            raise ValidationError(
                {"offer_end_date": "تاريخ نهاية العرض يجب أن يكون بعد تاريخ بداية العرض."}
            )

        if self.contract_id and self.product_id:
            provider = self.provider
            if not provider:
                raise ValidationError({"contract": "العقد يجب أن يكون مرتبطًا بمقدم خدمة صحيح."})

    def save(self, *args, **kwargs):
        self._normalize_strings()

        if self.price_before_discount is not None:
            self.price_before_discount = self._money(self.price_before_discount)

        if self.discount_percentage is not None:
            self.discount_percentage = self._percent(self.discount_percentage)

        if self.system_commission_percentage is not None:
            self.system_commission_percentage = self._percent(self.system_commission_percentage)

        if self.price_after_discount is not None:
            self.price_after_discount = self._money(self.price_after_discount)

        if self.special_price is not None:
            self.special_price = self._money(self.special_price)

        if self.price_after_discount is None and self.price_before_discount is not None:
            discount = self._percent(self.discount_percentage)

            if discount > Decimal("0.00"):
                discount_amount = (self.price_before_discount * discount) / Decimal("100.00")
                self.price_after_discount = self._money(self.price_before_discount - discount_amount)
            else:
                self.price_after_discount = self._money(self.price_before_discount)

        if self.special_price is None and self.price_after_discount is not None:
            self.special_price = self._money(self.price_after_discount)

        self.full_clean()
        super().save(*args, **kwargs)