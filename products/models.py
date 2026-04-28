# ============================================================
# 📂 products/models.py
# 🧭 Primey Care — Products & Programs Module
# ------------------------------------------------------------
# ✅ يدعم:
#    - Memberships
#    - Cards
#    - Programs
#    - Services
#    - Pricing Tiers
#    - Benefits
# ✅ جاهز للربط مع:
#    - Orders
#    - Contracts
#    - Providers / Centers
#    - Invoices
#    - Payments
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
    class CategoryType(models.TextChoices):
        MEMBERSHIP = "membership", "Membership"
        CARD = "card", "Card"
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

        if not self.code:
            raise ValidationError("Category code is required.")

        if not self.name:
            raise ValidationError("Category name is required.")


# ============================================================
# 🧩 Product
# ============================================================

class Product(models.Model):
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

    class FulfillmentType(models.TextChoices):
        DIGITAL = "digital", "Digital"
        PHYSICAL = "physical", "Physical"
        BOTH = "both", "Both"
        SERVICE_BASED = "service_based", "Service Based"
        NONE = "none", "None"

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

    fulfillment_type = models.CharField(
        max_length=30,
        choices=FulfillmentType.choices,
        default=FulfillmentType.DIGITAL,
        db_index=True,
        verbose_name="Fulfillment Type",
    )

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
    )

    requires_provider = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="Requires Provider",
        help_text="Use this for services/programs that must be linked to a provider or contract.",
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
            models.Index(fields=["product_type", "status"]),
            models.Index(fields=["billing_type"]),
            models.Index(fields=["fulfillment_type"]),
            models.Index(fields=["is_public", "is_featured"]),
            models.Index(fields=["can_be_ordered", "status"]),
            models.Index(fields=["can_be_used_in_contracts", "status"]),
            models.Index(fields=["requires_provider"]),
            models.Index(fields=["currency_code"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.code})" if self.code else self.name

    @property
    def effective_price(self) -> Decimal:
        if self.sale_price is not None and self.sale_price >= Decimal("0.00"):
            return self.sale_price
        return self.price

    @property
    def tax_amount(self) -> Decimal:
        if not self.is_taxable:
            return Decimal("0.00")
        return (self.effective_price * self.tax_rate) / Decimal("100.00")

    @property
    def total_price_with_tax(self) -> Decimal:
        return self.effective_price + self.tax_amount

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
    def is_membership(self) -> bool:
        return self.product_type == self.ProductType.MEMBERSHIP

    def _generate_code(self) -> str:
        prefix_map = {
            self.ProductType.MEMBERSHIP: "MEM",
            self.ProductType.CARD: "CRD",
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

        if self.tax_rate > Decimal("100.00"):
            raise ValidationError("Tax rate cannot be greater than 100%.")

        if self.max_discount_rate < Decimal("0.00"):
            raise ValidationError("Max discount rate cannot be negative.")

        if self.max_discount_rate > Decimal("100.00"):
            raise ValidationError("Max discount rate cannot be greater than 100%.")

        if self.default_agent_commission_rate < Decimal("0.00"):
            raise ValidationError("Default agent commission rate cannot be negative.")

        if self.default_agent_commission_rate > Decimal("100.00"):
            raise ValidationError("Default agent commission rate cannot be greater than 100%.")

        if self.billing_type == self.BillingType.RECURRING:
            if self.duration_value <= 0:
                raise ValidationError("Recurring products must have a valid duration value.")

            if self.duration_unit == self.DurationUnit.NONE:
                raise ValidationError("Recurring products must have a valid duration unit.")

        if self.billing_type == self.BillingType.ONE_TIME:
            if self.duration_unit == self.DurationUnit.NONE and self.duration_value not in (0,):
                raise ValidationError("One-time products with no duration must have duration value 0.")

        if self.product_type in [self.ProductType.CARD, self.ProductType.MEMBERSHIP]:
            if self.duration_value <= 0:
                raise ValidationError("Cards and memberships must have a valid duration value.")

            if self.duration_unit == self.DurationUnit.NONE:
                raise ValidationError("Cards and memberships must have a valid duration unit.")

        if self.product_type == self.ProductType.SERVICE:
            if self.billing_type == self.BillingType.RECURRING:
                raise ValidationError("Service products should not use recurring billing by default.")

        if self.requires_provider and not self.can_be_used_in_contracts:
            raise ValidationError("Products that require a provider must be usable in contracts.")

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
        indexes = [
            models.Index(fields=["product", "is_active"]),
            models.Index(fields=["sort_order"]),
        ]

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

    @property
    def effective_price(self) -> Decimal:
        if self.sale_price is not None and self.sale_price >= Decimal("0.00"):
            return self.sale_price
        return self.price

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

        if not self.name:
            raise ValidationError("Tier name is required.")

        if self.price < Decimal("0.00"):
            raise ValidationError("Tier price cannot be negative.")

        if self.sale_price is not None and self.sale_price < Decimal("0.00"):
            raise ValidationError("Tier sale price cannot be negative.")

        if self.sale_price is not None and self.sale_price > self.price:
            raise ValidationError("Tier sale price cannot be greater than tier price.")

        if self.min_quantity <= 0:
            raise ValidationError("Minimum quantity must be greater than zero.")

        if self.max_quantity is not None and self.max_quantity < self.min_quantity:
            raise ValidationError("Maximum quantity cannot be less than minimum quantity.")

        if self.discount_rate < Decimal("0.00"):
            raise ValidationError("Discount rate cannot be negative.")

        if self.discount_rate > Decimal("100.00"):
            raise ValidationError("Discount rate cannot be greater than 100%.")

        if self.agent_commission_rate < Decimal("0.00"):
            raise ValidationError("Agent commission rate cannot be negative.")

        if self.agent_commission_rate > Decimal("100.00"):
            raise ValidationError("Agent commission rate cannot be greater than 100%.")

        if self.provider_share_rate < Decimal("0.00"):
            raise ValidationError("Provider share rate cannot be negative.")

        if self.provider_share_rate > Decimal("100.00"):
            raise ValidationError("Provider share rate cannot be greater than 100%.")

        if self.system_share_rate < Decimal("0.00"):
            raise ValidationError("System share rate cannot be negative.")

        if self.system_share_rate > Decimal("100.00"):
            raise ValidationError("System share rate cannot be greater than 100%.")

        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            raise ValidationError("Pricing tier end date must be after start date.")


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

    @property
    def total_before_discount(self) -> Decimal:
        return self.unit_price * Decimal(self.included_quantity)

    @property
    def discount_amount(self) -> Decimal:
        return (self.total_before_discount * self.discount_rate) / Decimal("100.00")

    @property
    def total_after_discount(self) -> Decimal:
        return self.total_before_discount - self.discount_amount

    def clean(self) -> None:
        super().clean()

        self.name = (self.name or "").strip()

        if not self.name:
            raise ValidationError("Service item name is required.")

        if self.included_quantity <= 0:
            raise ValidationError("Included quantity must be greater than zero.")

        if self.unit_price < Decimal("0.00"):
            raise ValidationError("Unit price cannot be negative.")

        if self.discount_rate < Decimal("0.00"):
            raise ValidationError("Discount rate cannot be negative.")

        if self.discount_rate > Decimal("100.00"):
            raise ValidationError("Discount rate cannot be greater than 100%.")