# ============================================================
# 📂 products/models.py
# 🧭 Primey Care — Products & Catalog Module V2.7
# ------------------------------------------------------------
# ✅ القاعدة المعتمدة:
#    - Product = كتالوج ثابت
#    - Product لا يرتبط بمقدم الخدمة عند الإنشاء
#    - Provider pricing/offers تكون داخل ContractProduct
#    - ContractProduct = سعر/خصم/عرض المنتج حسب مقدم الخدمة والعقد
# ------------------------------------------------------------
# ✅ يدعم:
#    - Cards
#    - Medical Services
#    - Memberships
#    - Programs
#    - General Offers
#    - Landing / Mobile / Offers Marketing Images
#    - Pricing Tiers
#    - Benefits
# ------------------------------------------------------------
# ملاحظة:
# - provider داخل Product بقي للتوافق القديم فقط.
# - التطوير الجديد يجب أن يعتمد على:
#   Product -> ContractProduct -> Contract -> Provider
# ============================================================

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


# ============================================================
# 🧩 Product Category
# ============================================================

class ProductCategory(models.Model):
    class CategoryType(models.TextChoices):
        MEMBERSHIP = "membership", "Membership"
        CARD = "card", "Card"
        MEDICAL_SERVICE = "medical_service", "Medical Service"
        PROGRAM = "program", "Program"
        SERVICE = "service", "Service"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"

    code = models.CharField(
        max_length=30,
        unique=True,
        db_index=True,
        verbose_name="Code",
        help_text="Unique internal category code.",
    )

    name = models.CharField(
        max_length=150,
        unique=True,
        db_index=True,
        verbose_name="Name",
    )

    category_type = models.CharField(
        max_length=30,
        choices=CategoryType.choices,
        default=CategoryType.PROGRAM,
        db_index=True,
        verbose_name="Category Type",
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
        verbose_name="Status",
    )

    description = models.TextField(
        blank=True,
        verbose_name="Description",
    )

    sort_order = models.PositiveIntegerField(
        default=0,
        verbose_name="Sort Order",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="product_categories_created",
        verbose_name="Created By",
    )

    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="product_categories_updated",
        verbose_name="Updated By",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="Created At",
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="Updated At",
    )

    class Meta:
        verbose_name = "Product Category"
        verbose_name_plural = "Product Categories"
        ordering = ["sort_order", "name"]
        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["name"]),
            models.Index(fields=["category_type", "status"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.code})"

    def clean(self) -> None:
        super().clean()

        self.code = (self.code or "").strip().upper()
        self.name = (self.name or "").strip()
        self.description = (self.description or "").strip()

        if not self.code:
            raise ValidationError("Category code is required.")

        if not self.name:
            raise ValidationError("Category name is required.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


# ============================================================
# 🧩 Product
# ------------------------------------------------------------
# المنتج هنا يمثل كتالوج ثابت:
# - بطاقة
# - خدمة طبية
# - برنامج عام
# - عضوية
#
# لا نربط المنتج بمقدم الخدمة عند الإنشاء.
# مقدم الخدمة والأسعار المختلفة والعروض الخاصة تكون داخل:
# contracts.ContractProduct
#
# provider field بقي مؤقتًا للتوافق مع البيانات والكود القديم،
# ولا يجب الاعتماد عليه في التطوير الجديد.
# ============================================================

class Product(models.Model):
    class ProductType(models.TextChoices):
        MEMBERSHIP = "membership", "Membership"
        CARD = "card", "Card"
        MEDICAL_SERVICE = "medical_service", "Medical Service"
        PROGRAM = "program", "Program"
        SERVICE = "service", "Service"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"
        ARCHIVED = "archived", "Archived"

    class BillingType(models.TextChoices):
        ONE_TIME = "one_time", "One Time"
        RECURRING = "recurring", "Recurring"

    class DurationUnit(models.TextChoices):
        DAY = "day", "Day"
        MONTH = "month", "Month"
        YEAR = "year", "Year"
        NONE = "none", "None"

    class FulfillmentType(models.TextChoices):
        DIGITAL = "digital", "Digital"
        PHYSICAL = "physical", "Physical"
        BOTH = "both", "Both"
        SERVICE_BASED = "service_based", "Service Based"
        NONE = "none", "None"

    # ========================================================
    # 🆔 Core Information
    # ========================================================

    code = models.CharField(
        max_length=40,
        unique=True,
        blank=True,
        db_index=True,
        verbose_name="Product Code",
        help_text="Auto-generated unique product code.",
    )

    name = models.CharField(
        max_length=255,
        db_index=True,
        verbose_name="Name",
    )

    slug = models.SlugField(
        max_length=255,
        unique=True,
        blank=True,
        allow_unicode=True,
        verbose_name="Slug",
    )

    product_type = models.CharField(
        max_length=30,
        choices=ProductType.choices,
        default=ProductType.CARD,
        db_index=True,
        verbose_name="Product Type",
        help_text="Catalog type: card, medical service, membership, program, etc.",
    )

    category = models.ForeignKey(
        ProductCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="products",
        verbose_name="Category",
    )

    # ========================================================
    # ⚠️ Deprecated Provider Link
    # --------------------------------------------------------
    # أبقيناه مؤقتًا حتى لا تنكسر البيانات القديمة.
    # التطوير الجديد لا يربط المنتج بمقدم خدمة هنا.
    # الربط الصحيح:
    # Product -> ContractProduct -> Contract -> Provider
    # ========================================================

    provider = models.ForeignKey(
        "providers.Provider",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="legacy_products",
        verbose_name="Legacy Provider",
        help_text="Deprecated. Do not use for new products. Provider-specific pricing/offers must use ContractProduct.",
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
        verbose_name="Status",
    )

    billing_type = models.CharField(
        max_length=20,
        choices=BillingType.choices,
        default=BillingType.ONE_TIME,
        db_index=True,
        verbose_name="Billing Type",
    )

    fulfillment_type = models.CharField(
        max_length=30,
        choices=FulfillmentType.choices,
        default=FulfillmentType.DIGITAL,
        db_index=True,
        verbose_name="Fulfillment Type",
    )

    # ========================================================
    # 📝 Descriptions
    # ========================================================

    short_description = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Short Description",
    )

    description = models.TextField(
        blank=True,
        verbose_name="Description",
    )

    terms_and_conditions = models.TextField(
        blank=True,
        verbose_name="Terms and Conditions",
    )

    features = models.TextField(
        blank=True,
        verbose_name="Features",
        help_text="Can store bullet points or structured text for now.",
    )

    tags = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Tags",
        help_text="Comma-separated tags for quick filtering.",
    )

    # ========================================================
    # 🖼️ Product Images
    # --------------------------------------------------------
    # thumbnail_*: صورة رمزية داخل النظام.
    # marketing_*: صورة تسويقية للبطاقات أو المنتجات العامة.
    # عروض مقدمي الخدمة تستخدم ContractProduct marketing image.
    # ========================================================

    thumbnail_image_url = models.URLField(
        max_length=1000,
        blank=True,
        verbose_name="Thumbnail Image URL",
        help_text="Small symbolic image used inside the admin/system UI.",
    )

    thumbnail_image_drive_file_id = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Thumbnail Drive File ID",
    )

    thumbnail_image_drive_view_url = models.URLField(
        max_length=1000,
        blank=True,
        verbose_name="Thumbnail Drive View URL",
    )

    thumbnail_image_folder_id = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Thumbnail Folder ID",
    )

    thumbnail_image_folder_url = models.URLField(
        max_length=1000,
        blank=True,
        verbose_name="Thumbnail Folder URL",
    )

    thumbnail_image_alt_text = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Thumbnail Alt Text",
    )

    marketing_image_url = models.URLField(
        max_length=1000,
        blank=True,
        verbose_name="Marketing Image URL",
        help_text="Large marketing image used for landing, offers, mobile app, and campaigns.",
    )

    marketing_image_drive_file_id = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Marketing Drive File ID",
    )

    marketing_image_drive_view_url = models.URLField(
        max_length=1000,
        blank=True,
        verbose_name="Marketing Drive View URL",
    )

    marketing_image_folder_id = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Marketing Folder ID",
    )

    marketing_image_folder_url = models.URLField(
        max_length=1000,
        blank=True,
        verbose_name="Marketing Folder URL",
    )

    marketing_image_alt_text = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Marketing Alt Text",
    )

    # ========================================================
    # 💰 Catalog Pricing
    # --------------------------------------------------------
    # price = السعر قبل الخصم
    # discount_percentage = نسبة الخصم الافتراضية
    # sale_price = السعر بعد الخصم
    #
    # الأسعار الخاصة بمقدم الخدمة تكون في ContractProduct.
    # ========================================================

    currency_code = models.CharField(
        max_length=10,
        default="SAR",
        db_index=True,
        verbose_name="Currency Code",
    )

    price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Price Before Discount",
    )

    discount_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Default Discount Percentage (%)",
        help_text="Default catalog discount. Provider-specific discount is stored in ContractProduct.",
    )

    sale_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Price After Discount",
    )

    cost_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Cost Price",
    )

    is_taxable = models.BooleanField(
        default=False,
        verbose_name="Is Taxable",
    )

    tax_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Tax Rate (%)",
    )

    # ========================================================
    # ⏳ Duration / Product Validity
    # --------------------------------------------------------
    # Cards usually require duration.
    # Medical services may or may not require duration.
    # has_expiry is for product availability/end date.
    # ========================================================

    has_duration = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="Has Duration",
    )

    duration_value = models.PositiveIntegerField(
        default=0,
        verbose_name="Duration Value",
        help_text="Example: 12 months / 30 days / 1 year.",
    )

    duration_unit = models.CharField(
        max_length=20,
        choices=DurationUnit.choices,
        default=DurationUnit.NONE,
        verbose_name="Duration Unit",
    )

    has_expiry = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="Has Expiry",
        help_text="If enabled, product visibility/orderability can be limited by valid_from/valid_until.",
    )

    valid_from = models.DateField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="Valid From",
    )

    valid_until = models.DateField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="Valid Until",
    )

    # ========================================================
    # 📣 General Marketing / Offer Controls
    # --------------------------------------------------------
    # للبطاقات والعروض العامة.
    # عروض مقدم الخدمة المتغيرة تكون في ContractProduct.
    # ========================================================

    is_offer = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="Is Offer",
        help_text="Marks this catalog product as a customer-facing general offer.",
    )

    offer_title = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Offer Title",
        help_text="Optional marketing title for landing/offers/mobile display.",
    )

    offer_subtitle = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Offer Subtitle",
    )

    offer_badge = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="Offer Badge",
        help_text="Example: Limited Offer, Free Card, New Program.",
    )

    offer_terms = models.TextField(
        blank=True,
        verbose_name="Offer Terms",
    )

    offer_start_date = models.DateField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="Offer Start Date",
    )

    offer_end_date = models.DateField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="Offer End Date",
    )

    show_on_landing = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="Show On Landing",
    )

    show_on_mobile = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="Show On Mobile",
    )

    show_on_offers = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="Show On Offers",
    )

    # ========================================================
    # 🛒 Sales Controls
    # ========================================================

    is_public = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name="Is Public",
    )

    is_featured = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="Is Featured",
    )

    requires_approval = models.BooleanField(
        default=False,
        verbose_name="Requires Approval",
    )

    allow_online_purchase = models.BooleanField(
        default=True,
        verbose_name="Allow Online Purchase",
    )

    allow_agent_sale = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name="Allow Agent Sale",
    )

    allow_provider_sale = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="Allow Provider Sale",
    )

    can_be_ordered = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name="Can Be Ordered",
    )

    can_be_used_in_contracts = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name="Can Be Used In Contracts",
        help_text="Medical services should usually be usable in contracts.",
    )

    requires_provider = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="Requires Provider",
        help_text="If true, the product requires a ContractProduct/provider offer at order time.",
    )

    max_discount_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Max Discount Rate (%)",
    )

    default_agent_commission_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Default Agent Commission Rate (%)",
    )

    sort_order = models.PositiveIntegerField(
        default=0,
        verbose_name="Sort Order",
    )

    # ========================================================
    # 🧾 Audit Information
    # ========================================================

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="products_created",
        verbose_name="Created By",
    )

    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="products_updated",
        verbose_name="Updated By",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="Created At",
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="Updated At",
    )

    class Meta:
        verbose_name = "Product"
        verbose_name_plural = "Products"
        ordering = ["sort_order", "-created_at"]
        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["slug"]),
            models.Index(fields=["name"]),
            models.Index(fields=["provider"]),
            models.Index(fields=["product_type", "status"]),
            models.Index(fields=["provider", "product_type"]),
            models.Index(fields=["provider", "status"]),
            models.Index(fields=["billing_type"]),
            models.Index(fields=["fulfillment_type"]),
            models.Index(fields=["is_public", "is_featured"]),
            models.Index(fields=["is_offer", "status"]),
            models.Index(fields=["show_on_landing", "status"]),
            models.Index(fields=["show_on_mobile", "status"]),
            models.Index(fields=["show_on_offers", "status"]),
            models.Index(fields=["offer_start_date", "offer_end_date"]),
            models.Index(fields=["has_duration"]),
            models.Index(fields=["has_expiry"]),
            models.Index(fields=["valid_from", "valid_until"]),
            models.Index(fields=["can_be_ordered", "status"]),
            models.Index(fields=["can_be_used_in_contracts", "status"]),
            models.Index(fields=["requires_provider"]),
            models.Index(fields=["currency_code"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.code})" if self.code else self.name

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
    # 💰 Price Helpers
    # ========================================================

    @property
    def price_before_discount(self) -> Decimal:
        return self._money(self.price)

    @property
    def discount_amount(self) -> Decimal:
        price = self.price_before_discount
        discount = self._percent(self.discount_percentage)

        if price <= Decimal("0.00") or discount <= Decimal("0.00"):
            return Decimal("0.00")

        return self._money((price * discount) / Decimal("100.00"))

    @property
    def price_after_discount(self) -> Decimal:
        price = self.price_before_discount

        if self.sale_price is not None:
            return self._money(self.sale_price)

        if self.discount_percentage and self.discount_percentage > Decimal("0.00"):
            return self._money(price - self.discount_amount)

        return price

    @property
    def effective_price(self) -> Decimal:
        return self.price_after_discount

    @property
    def tax_amount(self) -> Decimal:
        if not self.is_taxable:
            return Decimal("0.00")

        return self._money((self.effective_price * self._percent(self.tax_rate)) / Decimal("100.00"))

    @property
    def total_price_with_tax(self) -> Decimal:
        return self._money(self.effective_price + self.tax_amount)

    @property
    def has_discount(self) -> bool:
        return self.price_after_discount < self.price_before_discount

    # ========================================================
    # 🧩 Type Helpers
    # ========================================================

    @property
    def is_active_product(self) -> bool:
        return self.status == self.Status.ACTIVE

    @property
    def is_card(self) -> bool:
        return self.product_type == self.ProductType.CARD

    @property
    def is_program(self) -> bool:
        return self.product_type == self.ProductType.PROGRAM

    @property
    def is_service(self) -> bool:
        return self.product_type == self.ProductType.SERVICE

    @property
    def is_medical_service(self) -> bool:
        return self.product_type == self.ProductType.MEDICAL_SERVICE

    @property
    def is_membership(self) -> bool:
        return self.product_type == self.ProductType.MEMBERSHIP

    @property
    def is_provider_product(self) -> bool:
        return self.provider_id is not None

    @property
    def is_catalog_product(self) -> bool:
        return self.provider_id is None

    @property
    def has_thumbnail_image(self) -> bool:
        return bool(self.thumbnail_image_url or self.thumbnail_image_drive_file_id)

    @property
    def has_marketing_image(self) -> bool:
        return bool(self.marketing_image_url or self.marketing_image_drive_file_id)

    # ========================================================
    # ⏳ Date / Offer Helpers
    # ========================================================

    @property
    def is_valid_by_date(self) -> bool:
        if not self.has_expiry:
            return True

        today = timezone.localdate()

        if self.valid_from and self.valid_from > today:
            return False

        if self.valid_until and self.valid_until < today:
            return False

        return True

    @property
    def is_current_offer(self) -> bool:
        if not self.is_offer:
            return False

        if self.status != self.Status.ACTIVE:
            return False

        today = timezone.localdate()

        if self.offer_start_date and self.offer_start_date > today:
            return False

        if self.offer_end_date and self.offer_end_date < today:
            return False

        return True

    @property
    def is_available_for_order(self) -> bool:
        return bool(
            self.status == self.Status.ACTIVE
            and self.can_be_ordered
            and self.is_valid_by_date
        )

    # ========================================================
    # 📦 Payload Helpers
    # ========================================================

    @property
    def catalog_payload(self) -> dict:
        return {
            "product_id": self.id,
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "slug": self.slug,
            "product_type": self.product_type,
            "category_id": self.category_id,
            "status": self.status,
            "currency_code": self.currency_code,
            "price_before_discount": str(self.price_before_discount),
            "discount_percentage": str(self._percent(self.discount_percentage)),
            "discount_amount": str(self.discount_amount),
            "price_after_discount": str(self.price_after_discount),
            "effective_price": str(self.effective_price),
            "has_discount": self.has_discount,
            "has_duration": self.has_duration,
            "duration_value": self.duration_value,
            "duration_unit": self.duration_unit,
            "has_expiry": self.has_expiry,
            "valid_from": self.valid_from.isoformat() if self.valid_from else None,
            "valid_until": self.valid_until.isoformat() if self.valid_until else None,
            "is_offer": self.is_offer,
            "offer_title": self.offer_title,
            "offer_subtitle": self.offer_subtitle,
            "offer_badge": self.offer_badge,
            "offer_start_date": self.offer_start_date.isoformat() if self.offer_start_date else None,
            "offer_end_date": self.offer_end_date.isoformat() if self.offer_end_date else None,
            "show_on_landing": self.show_on_landing,
            "show_on_mobile": self.show_on_mobile,
            "show_on_offers": self.show_on_offers,
            "requires_provider": self.requires_provider,
            "can_be_ordered": self.can_be_ordered,
            "can_be_used_in_contracts": self.can_be_used_in_contracts,
            "is_available_for_order": self.is_available_for_order,
        }

    @property
    def checkout_payload(self) -> dict:
        return {
            "product_id": self.id,
            "offer_source": "product",
            "offer_title": self.offer_title or self.name,
            "offer_badge": self.offer_badge,
            "order_kind": self.product_type or "general",
            "payment_method": "none",
            "quantity": 1,
            "currency_code": self.currency_code or "SAR",
            "unit_price_before_discount": str(self.price_before_discount),
            "unit_discount_percentage": str(self._percent(self.discount_percentage)),
            "unit_price": str(self.price_after_discount),
            "discount_amount": str(self.discount_amount),
            "total_amount": str(self.price_after_discount),
            "source": "website",
        }

    # ========================================================
    # 🧠 Internal Generators
    # ========================================================

    def _generate_code(self) -> str:
        prefix_map = {
            self.ProductType.MEMBERSHIP: "MEM",
            self.ProductType.CARD: "CRD",
            self.ProductType.MEDICAL_SERVICE: "MED",
            self.ProductType.PROGRAM: "PRG",
            self.ProductType.SERVICE: "SRV",
            self.ProductType.OTHER: "PRD",
        }

        prefix = prefix_map.get(self.product_type, "PRD")

        if self.pk:
            return f"{prefix}-{self.pk:06d}"

        return ""

    def _generate_slug(self) -> str:
        from django.utils.text import slugify

        base_name = (self.name or "").strip()

        if not base_name:
            return ""

        base_slug = slugify(base_name, allow_unicode=True)

        if not base_slug:
            base_slug = "product"

        slug_candidate = base_slug
        counter = 2

        while Product.objects.exclude(pk=self.pk).filter(slug=slug_candidate).exists():
            slug_candidate = f"{base_slug}-{counter}"
            counter += 1

        return slug_candidate

    # ========================================================
    # ✅ Cleaning / Validation
    # ========================================================

    def _normalize_strings(self) -> None:
        self.code = (self.code or "").strip().upper()
        self.name = (self.name or "").strip()
        self.slug = (self.slug or "").strip()
        self.short_description = (self.short_description or "").strip()
        self.description = (self.description or "").strip()
        self.terms_and_conditions = (self.terms_and_conditions or "").strip()
        self.features = (self.features or "").strip()
        self.currency_code = (self.currency_code or "SAR").strip().upper()
        self.tags = (self.tags or "").strip()

        self.offer_title = (self.offer_title or "").strip()
        self.offer_subtitle = (self.offer_subtitle or "").strip()
        self.offer_badge = (self.offer_badge or "").strip()
        self.offer_terms = (self.offer_terms or "").strip()

        self.thumbnail_image_url = (self.thumbnail_image_url or "").strip()
        self.thumbnail_image_drive_file_id = (self.thumbnail_image_drive_file_id or "").strip()
        self.thumbnail_image_drive_view_url = (self.thumbnail_image_drive_view_url or "").strip()
        self.thumbnail_image_folder_id = (self.thumbnail_image_folder_id or "").strip()
        self.thumbnail_image_folder_url = (self.thumbnail_image_folder_url or "").strip()
        self.thumbnail_image_alt_text = (self.thumbnail_image_alt_text or "").strip()

        self.marketing_image_url = (self.marketing_image_url or "").strip()
        self.marketing_image_drive_file_id = (self.marketing_image_drive_file_id or "").strip()
        self.marketing_image_drive_view_url = (self.marketing_image_drive_view_url or "").strip()
        self.marketing_image_folder_id = (self.marketing_image_folder_id or "").strip()
        self.marketing_image_folder_url = (self.marketing_image_folder_url or "").strip()
        self.marketing_image_alt_text = (self.marketing_image_alt_text or "").strip()

    def _normalize_numbers(self) -> None:
        self.price = self._money(self.price)
        self.discount_percentage = self._percent(self.discount_percentage)

        if self.sale_price is not None:
            self.sale_price = self._money(self.sale_price)

        if self.cost_price is not None:
            self.cost_price = self._money(self.cost_price)

        self.tax_rate = self._percent(self.tax_rate)
        self.max_discount_rate = self._percent(self.max_discount_rate)
        self.default_agent_commission_rate = self._percent(self.default_agent_commission_rate)

    def clean(self) -> None:
        super().clean()

        self._normalize_strings()
        self._normalize_numbers()

        if not self.name:
            raise ValidationError("Product name is required.")

        if self.sale_price is not None and self.sale_price > self.price:
            raise ValidationError("Sale price cannot be greater than base price.")

        if self.offer_start_date and self.offer_end_date and self.offer_end_date < self.offer_start_date:
            raise ValidationError(
                {"offer_end_date": "Offer end date must be after offer start date."}
            )

        if self.valid_from and self.valid_until and self.valid_until < self.valid_from:
            raise ValidationError(
                {"valid_until": "Product valid until date must be after valid from date."}
            )

        if self.has_duration:
            if self.duration_value <= 0:
                raise ValidationError("Products with duration must have a valid duration value.")

            if self.duration_unit == self.DurationUnit.NONE:
                raise ValidationError("Products with duration must have a valid duration unit.")

        if not self.has_duration:
            if self.duration_unit == self.DurationUnit.NONE and self.duration_value not in (0,):
                raise ValidationError("Products with no duration must have duration value 0.")

        if self.has_expiry and not self.valid_until:
            raise ValidationError("Products with expiry must have a valid_until date.")

        if self.billing_type == self.BillingType.RECURRING:
            self.has_duration = True

            if self.duration_value <= 0:
                raise ValidationError("Recurring products must have a valid duration value.")

            if self.duration_unit == self.DurationUnit.NONE:
                raise ValidationError("Recurring products must have a valid duration unit.")

        if self.product_type in [self.ProductType.CARD, self.ProductType.MEMBERSHIP]:
            self.has_duration = True

            if self.duration_value <= 0:
                raise ValidationError("Cards and memberships must have a valid duration value.")

            if self.duration_unit == self.DurationUnit.NONE:
                raise ValidationError("Cards and memberships must have a valid duration unit.")

        if self.product_type in [self.ProductType.MEDICAL_SERVICE, self.ProductType.SERVICE]:
            if self.billing_type == self.BillingType.RECURRING:
                raise ValidationError("Medical service products should not use recurring billing by default.")

            self.can_be_used_in_contracts = True

        if self.requires_provider and not self.can_be_used_in_contracts:
            raise ValidationError("Products that require a provider must be usable in contracts.")

        # الخدمات الطبية عادة تحتاج عرض/عقد عند البيع الفعلي.
        # لكن لا نربطها بمقدم خدمة مباشرة داخل Product.
        if self.product_type == self.ProductType.MEDICAL_SERVICE:
            self.requires_provider = True
            self.can_be_used_in_contracts = True

        # توافق قديم فقط.
        # لا نحذف provider الآن حتى لا نكسر بيانات قديمة.
        if self.provider_id:
            self.requires_provider = True
            self.can_be_used_in_contracts = True

    def save(self, *args, **kwargs):
        is_new = self.pk is None

        if not self.slug:
            self.slug = self._generate_slug()

        # إذا أدخل المستخدم نسبة خصم ولم يدخل sale_price، نحسبه تلقائيًا.
        if self.sale_price is None and self.discount_percentage and self.discount_percentage > Decimal("0.00"):
            discount_amount = (self.price * self.discount_percentage) / Decimal("100.00")
            self.sale_price = self._money(self.price - discount_amount)

        # إذا أدخل sale_price ولم يدخل نسبة خصم، نحسب نسبة تقريبية.
        if (
            self.sale_price is not None
            and self.price > Decimal("0.00")
            and (self.discount_percentage is None or self.discount_percentage == Decimal("0.00"))
            and self.sale_price < self.price
        ):
            self.discount_percentage = self._percent(
                ((self.price - self.sale_price) / self.price) * Decimal("100.00")
            )

        self.full_clean()
        super().save(*args, **kwargs)

        if is_new and not self.code:
            self.code = self._generate_code()
            super().save(update_fields=["code"])


# ============================================================
# 🧩 Product Benefit
# ============================================================

class ProductBenefit(models.Model):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="benefits",
        verbose_name="Product",
    )

    title = models.CharField(
        max_length=255,
        verbose_name="Title",
    )

    description = models.TextField(
        blank=True,
        verbose_name="Description",
    )

    sort_order = models.PositiveIntegerField(
        default=0,
        verbose_name="Sort Order",
    )

    is_active = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name="Is Active",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Created At",
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="Updated At",
    )

    class Meta:
        verbose_name = "Product Benefit"
        verbose_name_plural = "Product Benefits"
        ordering = ["sort_order", "id"]
        indexes = [
            models.Index(fields=["product", "is_active"]),
            models.Index(fields=["sort_order"]),
        ]

    def __str__(self) -> str:
        return f"{self.product.name} - {self.title}"

    def clean(self) -> None:
        super().clean()

        self.title = (self.title or "").strip()
        self.description = (self.description or "").strip()

        if not self.title:
            raise ValidationError("Benefit title is required.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


# ============================================================
# 🧩 Product Pricing Tier
# ============================================================

class ProductPricingTier(models.Model):
    class PricingType(models.TextChoices):
        STANDARD = "standard", "Standard"
        CUSTOMER = "customer", "Customer"
        AGENT = "agent", "Agent"
        PROVIDER = "provider", "Provider"
        CONTRACT = "contract", "Contract"
        PROMOTIONAL = "promotional", "Promotional"

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="pricing_tiers",
        verbose_name="Product",
    )

    name = models.CharField(
        max_length=150,
        verbose_name="Tier Name",
    )

    pricing_type = models.CharField(
        max_length=30,
        choices=PricingType.choices,
        default=PricingType.STANDARD,
        db_index=True,
        verbose_name="Pricing Type",
    )

    currency_code = models.CharField(
        max_length=10,
        default="SAR",
        db_index=True,
        verbose_name="Currency Code",
    )

    price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name="Price",
    )

    sale_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Sale Price",
    )

    min_quantity = models.PositiveIntegerField(
        default=1,
        verbose_name="Minimum Quantity",
    )

    max_quantity = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="Maximum Quantity",
    )

    discount_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Discount Rate (%)",
    )

    agent_commission_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Agent Commission Rate (%)",
    )

    provider_share_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Provider Share Rate (%)",
    )

    system_share_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="System Share Rate (%)",
    )

    starts_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="Starts At",
    )

    ends_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="Ends At",
    )

    sort_order = models.PositiveIntegerField(
        default=0,
        verbose_name="Sort Order",
    )

    is_active = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name="Is Active",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Created At",
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="Updated At",
    )

    class Meta:
        verbose_name = "Product Pricing Tier"
        verbose_name_plural = "Product Pricing Tiers"
        ordering = ["sort_order", "id"]
        indexes = [
            models.Index(fields=["product", "is_active"]),
            models.Index(fields=["product", "pricing_type"]),
            models.Index(fields=["pricing_type", "is_active"]),
            models.Index(fields=["currency_code"]),
            models.Index(fields=["starts_at", "ends_at"]),
            models.Index(fields=["sort_order"]),
        ]

    def __str__(self) -> str:
        return f"{self.product.name} - {self.name}"

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

    @property
    def effective_price(self) -> Decimal:
        if self.sale_price is not None:
            return self._money(self.sale_price)

        return self._money(self.price)

    @property
    def has_discount(self) -> bool:
        return (
            self.sale_price is not None
            and self.sale_price >= Decimal("0.00")
            and self.sale_price < self.price
        )

    def clean(self) -> None:
        super().clean()

        self.name = (self.name or "").strip()
        self.currency_code = (self.currency_code or "SAR").strip().upper()

        self.price = self._money(self.price)

        if self.sale_price is not None:
            self.sale_price = self._money(self.sale_price)

        self.discount_rate = self._percent(self.discount_rate)
        self.agent_commission_rate = self._percent(self.agent_commission_rate)
        self.provider_share_rate = self._percent(self.provider_share_rate)
        self.system_share_rate = self._percent(self.system_share_rate)

        if not self.name:
            raise ValidationError("Tier name is required.")

        if self.sale_price is not None and self.sale_price > self.price:
            raise ValidationError("Tier sale price cannot be greater than tier price.")

        if self.min_quantity <= 0:
            raise ValidationError("Minimum quantity must be greater than zero.")

        if self.max_quantity is not None and self.max_quantity < self.min_quantity:
            raise ValidationError("Maximum quantity cannot be less than minimum quantity.")

        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            raise ValidationError("Pricing tier end date must be after start date.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


# ============================================================
# 🧩 Product Service Item
# ------------------------------------------------------------
# هذا الموديل يجهّز البرامج والباقات لاحتواء خدمات داخلية.
# مثال:
#   برنامج الولادة يحتوي:
#   - كشف
#   - متابعة
#   - خصم أشعة
# ============================================================

class ProductServiceItem(models.Model):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="service_items",
        verbose_name="Product",
    )

    name = models.CharField(
        max_length=255,
        verbose_name="Service Item Name",
    )

    description = models.TextField(
        blank=True,
        verbose_name="Description",
    )

    included_quantity = models.PositiveIntegerField(
        default=1,
        verbose_name="Included Quantity",
    )

    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Unit Price",
    )

    discount_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Discount Rate (%)",
    )

    requires_provider = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name="Requires Provider",
    )

    is_optional = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="Is Optional",
    )

    is_active = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name="Is Active",
    )

    sort_order = models.PositiveIntegerField(
        default=0,
        verbose_name="Sort Order",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Created At",
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="Updated At",
    )

    class Meta:
        verbose_name = "Product Service Item"
        verbose_name_plural = "Product Service Items"
        ordering = ["sort_order", "id"]
        indexes = [
            models.Index(fields=["product", "is_active"]),
            models.Index(fields=["requires_provider"]),
            models.Index(fields=["is_optional"]),
            models.Index(fields=["sort_order"]),
        ]

    def __str__(self) -> str:
        return f"{self.product.name} - {self.name}"

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

    @property
    def total_before_discount(self) -> Decimal:
        return self._money(self.unit_price * Decimal(self.included_quantity or 1))

    @property
    def discount_amount(self) -> Decimal:
        return self._money((self.total_before_discount * self._percent(self.discount_rate)) / Decimal("100.00"))

    @property
    def total_after_discount(self) -> Decimal:
        return self._money(self.total_before_discount - self.discount_amount)

    def clean(self) -> None:
        super().clean()

        self.name = (self.name or "").strip()
        self.description = (self.description or "").strip()
        self.unit_price = self._money(self.unit_price)
        self.discount_rate = self._percent(self.discount_rate)

        if not self.name:
            raise ValidationError("Service item name is required.")

        if self.included_quantity <= 0:
            raise ValidationError("Included quantity must be greater than zero.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)