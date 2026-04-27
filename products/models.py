# ============================================================
# 📂 products/models.py
# 🧭 Primey Care — Products Module
# ------------------------------------------------------------
# ✅ يدعم:
#    - العضويات Memberships
#    - البطاقات Cards
#    - البرامج Programs
#    - المنتجات القابلة للبيع لاحقًا
# ✅ مرن للتوسع لاحقًا مع:
#    - الطلبات
#    - الخصومات
#    - العمولات
#    - العقود
#    - كشف الحساب
# ============================================================

from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


# ============================================================
# 🧩 Product Category
# ============================================================

class ProductCategory(models.Model):
    # --------------------------------------------------------
    # 🔹 Choice Enums
    # --------------------------------------------------------
    class CategoryType(models.TextChoices):
        MEMBERSHIP = "membership", "Membership"
        CARD = "card", "Card"
        PROGRAM = "program", "Program"
        SERVICE = "service", "Service"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"

    # --------------------------------------------------------
    # 🔹 Core Fields
    # --------------------------------------------------------
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
        max_length=20,
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

    # --------------------------------------------------------
    # 🔹 Audit Fields
    # --------------------------------------------------------
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

    # --------------------------------------------------------
    # 🔹 Meta
    # --------------------------------------------------------
    class Meta:
        verbose_name = "Product Category"
        verbose_name_plural = "Product Categories"
        ordering = ["sort_order", "name"]

    # --------------------------------------------------------
    # 🔹 String Representation
    # --------------------------------------------------------
    def __str__(self) -> str:
        return f"{self.name} ({self.code})"

    # --------------------------------------------------------
    # 🔹 Validation
    # --------------------------------------------------------
    def clean(self) -> None:
        super().clean()
        self.code = (self.code or "").strip().upper()
        self.name = (self.name or "").strip()

        if not self.code:
            raise ValidationError("Category code is required.")

        if not self.name:
            raise ValidationError("Category name is required.")


# ============================================================
# 🧩 Product
# ============================================================

class Product(models.Model):
    # --------------------------------------------------------
    # 🔹 Choice Enums
    # --------------------------------------------------------
    class ProductType(models.TextChoices):
        MEMBERSHIP = "membership", "Membership"
        CARD = "card", "Card"
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

    # --------------------------------------------------------
    # 🔹 Core Fields
    # --------------------------------------------------------
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
        verbose_name="Slug",
    )

    product_type = models.CharField(
        max_length=20,
        choices=ProductType.choices,
        default=ProductType.PROGRAM,
        db_index=True,
        verbose_name="Product Type",
    )

    category = models.ForeignKey(
        ProductCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="products",
        verbose_name="Category",
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

    # --------------------------------------------------------
    # 🔹 Display / Marketing
    # --------------------------------------------------------
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

    # --------------------------------------------------------
    # 🔹 Pricing
    # --------------------------------------------------------
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
        verbose_name="Price",
    )

    sale_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Sale Price",
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

    # --------------------------------------------------------
    # 🔹 Validity / Duration
    # --------------------------------------------------------
    duration_value = models.PositiveIntegerField(
        default=0,
        verbose_name="Duration Value",
        help_text="Example: 12 months / 30 days / 1 year",
    )

    duration_unit = models.CharField(
        max_length=20,
        choices=DurationUnit.choices,
        default=DurationUnit.NONE,
        verbose_name="Duration Unit",
    )

    # --------------------------------------------------------
    # 🔹 Sales Controls
    # --------------------------------------------------------
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

    sort_order = models.PositiveIntegerField(
        default=0,
        verbose_name="Sort Order",
    )

    # --------------------------------------------------------
    # 🔹 Audit Fields
    # --------------------------------------------------------
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

    # --------------------------------------------------------
    # 🔹 Meta
    # --------------------------------------------------------
    class Meta:
        verbose_name = "Product"
        verbose_name_plural = "Products"
        ordering = ["sort_order", "-created_at"]
        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["slug"]),
            models.Index(fields=["name"]),
            models.Index(fields=["product_type", "status"]),
            models.Index(fields=["is_public", "is_featured"]),
            models.Index(fields=["currency_code"]),
            models.Index(fields=["created_at"]),
        ]

    # --------------------------------------------------------
    # 🔹 String Representation
    # --------------------------------------------------------
    def __str__(self) -> str:
        return f"{self.name} ({self.code})" if self.code else self.name

    # --------------------------------------------------------
    # 🔹 Derived Properties
    # --------------------------------------------------------
    @property
    def effective_price(self) -> Decimal:
        if self.sale_price is not None and self.sale_price >= Decimal("0.00"):
            return self.sale_price
        return self.price

    @property
    def is_active_product(self) -> bool:
        return self.status == self.Status.ACTIVE

    @property
    def has_discount(self) -> bool:
        return (
            self.sale_price is not None
            and self.sale_price >= Decimal("0.00")
            and self.sale_price < self.price
        )

    # --------------------------------------------------------
    # 🔹 Internal Helpers
    # --------------------------------------------------------
    def _generate_code(self) -> str:
        if self.pk:
            return f"PRD-{self.pk:06d}"
        return ""

    def _generate_slug(self) -> str:
        from django.utils.text import slugify

        base_name = (self.name or "").strip()
        if not base_name:
            return ""

        base_slug = slugify(base_name)
        if not base_slug:
            base_slug = "product"

        slug_candidate = base_slug
        counter = 2

        while Product.objects.exclude(pk=self.pk).filter(slug=slug_candidate).exists():
            slug_candidate = f"{base_slug}-{counter}"
            counter += 1

        return slug_candidate

    # --------------------------------------------------------
    # 🔹 Validation
    # --------------------------------------------------------
    def clean(self) -> None:
        super().clean()

        self.name = (self.name or "").strip()
        self.short_description = (self.short_description or "").strip()
        self.currency_code = (self.currency_code or "SAR").strip().upper()
        self.tags = (self.tags or "").strip()

        if not self.name:
            raise ValidationError("Product name is required.")

        if self.price < Decimal("0.00"):
            raise ValidationError("Price cannot be negative.")

        if self.sale_price is not None and self.sale_price < Decimal("0.00"):
            raise ValidationError("Sale price cannot be negative.")

        if self.cost_price is not None and self.cost_price < Decimal("0.00"):
            raise ValidationError("Cost price cannot be negative.")

        if self.sale_price is not None and self.sale_price > self.price:
            raise ValidationError("Sale price cannot be greater than base price.")

        if self.tax_rate < Decimal("0.00"):
            raise ValidationError("Tax rate cannot be negative.")

        if self.billing_type == self.BillingType.RECURRING:
            if self.duration_value <= 0:
                raise ValidationError("Recurring products must have a valid duration value.")

            if self.duration_unit == self.DurationUnit.NONE:
                raise ValidationError("Recurring products must have a valid duration unit.")

        if self.billing_type == self.BillingType.ONE_TIME:
            if self.duration_unit == self.DurationUnit.NONE and self.duration_value not in (0,):
                raise ValidationError("One-time products with no duration must have duration value 0.")

    # --------------------------------------------------------
    # 🔹 Save Logic
    # --------------------------------------------------------
    def save(self, *args, **kwargs):
        self.full_clean()
        is_new = self.pk is None

        if not self.slug:
            self.slug = self._generate_slug()

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

    def __str__(self) -> str:
        return f"{self.product.name} - {self.title}"

    def clean(self) -> None:
        super().clean()
        self.title = (self.title or "").strip()
        if not self.title:
            raise ValidationError("Benefit title is required.")


# ============================================================
# 🧩 Product Pricing Tier
# ============================================================

class ProductPricingTier(models.Model):
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

    def __str__(self) -> str:
        return f"{self.product.name} - {self.name}"

    def clean(self) -> None:
        super().clean()
        self.name = (self.name or "").strip()

        if not self.name:
            raise ValidationError("Tier name is required.")

        if self.price < Decimal("0.00"):
            raise ValidationError("Tier price cannot be negative.")

        if self.sale_price is not None and self.sale_price < Decimal("0.00"):
            raise ValidationError("Tier sale price cannot be negative.")

        if self.sale_price is not None and self.sale_price > self.price:
            raise ValidationError("Tier sale price cannot be greater than tier price.")