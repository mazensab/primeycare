# ============================================================
# 📂 products/admin.py
# 🧭 Primey Care — Products & Programs Admin
# ------------------------------------------------------------
# ✅ يدير:
#    - Product Categories
#    - Products / Cards / Programs / Services
#    - Benefits
#    - Pricing Tiers
#    - Product Service Items
# ============================================================

from django.contrib import admin

from .models import (
    Product,
    ProductBenefit,
    ProductCategory,
    ProductPricingTier,
    ProductServiceItem,
)


# ============================================================
# 🔹 Inlines
# ============================================================

class ProductBenefitInline(admin.TabularInline):
    model = ProductBenefit
    extra = 0
    fields = (
        "title",
        "description",
        "sort_order",
        "is_active",
    )
    ordering = ("sort_order", "id")


class ProductPricingTierInline(admin.TabularInline):
    model = ProductPricingTier
    extra = 0
    fields = (
        "name",
        "pricing_type",
        "currency_code",
        "price",
        "sale_price",
        "min_quantity",
        "max_quantity",
        "discount_rate",
        "agent_commission_rate",
        "provider_share_rate",
        "system_share_rate",
        "starts_at",
        "ends_at",
        "sort_order",
        "is_active",
    )
    ordering = ("sort_order", "id")


class ProductServiceItemInline(admin.TabularInline):
    model = ProductServiceItem
    extra = 0
    fields = (
        "name",
        "description",
        "included_quantity",
        "unit_price",
        "discount_rate",
        "requires_provider",
        "is_optional",
        "sort_order",
        "is_active",
    )
    ordering = ("sort_order", "id")


# ============================================================
# 🔹 Product Category Admin
# ============================================================

@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "name",
        "category_type",
        "status",
        "sort_order",
        "created_at",
    )

    list_filter = (
        "category_type",
        "status",
        "created_at",
    )

    search_fields = (
        "code",
        "name",
        "description",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )

    ordering = (
        "sort_order",
        "name",
    )

    list_per_page = 25
    date_hierarchy = "created_at"

    fieldsets = (
        (
            "Core Information",
            {
                "fields": (
                    "code",
                    "name",
                    "category_type",
                    "status",
                    "sort_order",
                    "description",
                )
            },
        ),
        (
            "Audit Information",
            {
                "classes": ("collapse",),
                "fields": (
                    "created_by",
                    "updated_by",
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )

    def save_model(self, request, obj, form, change):
        if not change and not obj.created_by:
            obj.created_by = request.user

        obj.updated_by = request.user
        super().save_model(request, obj, form, change)


# ============================================================
# 🔹 Product Admin
# ============================================================

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "name",
        "product_type",
        "category",
        "status",
        "billing_type",
        "fulfillment_type",
        "price",
        "sale_price",
        "currency_code",
        "is_public",
        "is_featured",
        "can_be_ordered",
        "can_be_used_in_contracts",
        "requires_provider",
        "created_at",
    )

    list_filter = (
        "product_type",
        "category",
        "status",
        "billing_type",
        "fulfillment_type",
        "is_public",
        "is_featured",
        "requires_approval",
        "allow_online_purchase",
        "allow_agent_sale",
        "allow_provider_sale",
        "can_be_ordered",
        "can_be_used_in_contracts",
        "requires_provider",
        "is_taxable",
        "currency_code",
        "created_at",
    )

    search_fields = (
        "code",
        "name",
        "slug",
        "short_description",
        "description",
        "features",
        "tags",
    )

    readonly_fields = (
        "code",
        "slug",
        "effective_price_display",
        "tax_amount_display",
        "total_price_with_tax_display",
        "created_at",
        "updated_at",
    )

    ordering = (
        "sort_order",
        "-created_at",
    )

    list_per_page = 25
    date_hierarchy = "created_at"

    inlines = [
        ProductBenefitInline,
        ProductPricingTierInline,
        ProductServiceItemInline,
    ]

    fieldsets = (
        (
            "Core Information",
            {
                "fields": (
                    "code",
                    "name",
                    "slug",
                    "product_type",
                    "category",
                    "status",
                    "billing_type",
                    "fulfillment_type",
                    "sort_order",
                )
            },
        ),
        (
            "Descriptions",
            {
                "fields": (
                    "short_description",
                    "description",
                    "features",
                    "terms_and_conditions",
                    "tags",
                )
            },
        ),
        (
            "Pricing",
            {
                "fields": (
                    "currency_code",
                    "price",
                    "sale_price",
                    "cost_price",
                    "effective_price_display",
                    "is_taxable",
                    "tax_rate",
                    "tax_amount_display",
                    "total_price_with_tax_display",
                )
            },
        ),
        (
            "Duration / Validity",
            {
                "fields": (
                    "duration_value",
                    "duration_unit",
                )
            },
        ),
        (
            "Sales Controls",
            {
                "fields": (
                    "is_public",
                    "is_featured",
                    "requires_approval",
                    "allow_online_purchase",
                    "allow_agent_sale",
                    "allow_provider_sale",
                    "can_be_ordered",
                    "can_be_used_in_contracts",
                    "requires_provider",
                )
            },
        ),
        (
            "Discounts / Commissions",
            {
                "fields": (
                    "max_discount_rate",
                    "default_agent_commission_rate",
                )
            },
        ),
        (
            "Audit Information",
            {
                "classes": ("collapse",),
                "fields": (
                    "created_by",
                    "updated_by",
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )

    actions = (
        "mark_as_active",
        "mark_as_inactive",
        "mark_as_archived",
        "enable_online_purchase",
        "disable_online_purchase",
        "enable_ordering",
        "disable_ordering",
    )

    @admin.display(description="Effective Price")
    def effective_price_display(self, obj):
        return obj.effective_price

    @admin.display(description="Tax Amount")
    def tax_amount_display(self, obj):
        return obj.tax_amount

    @admin.display(description="Total With Tax")
    def total_price_with_tax_display(self, obj):
        return obj.total_price_with_tax

    @admin.action(description="Mark selected products as active")
    def mark_as_active(self, request, queryset):
        queryset.update(status=Product.Status.ACTIVE)

    @admin.action(description="Mark selected products as inactive")
    def mark_as_inactive(self, request, queryset):
        queryset.update(status=Product.Status.INACTIVE)

    @admin.action(description="Mark selected products as archived")
    def mark_as_archived(self, request, queryset):
        queryset.update(status=Product.Status.ARCHIVED)

    @admin.action(description="Enable online purchase")
    def enable_online_purchase(self, request, queryset):
        queryset.update(allow_online_purchase=True)

    @admin.action(description="Disable online purchase")
    def disable_online_purchase(self, request, queryset):
        queryset.update(allow_online_purchase=False)

    @admin.action(description="Enable ordering")
    def enable_ordering(self, request, queryset):
        queryset.update(can_be_ordered=True)

    @admin.action(description="Disable ordering")
    def disable_ordering(self, request, queryset):
        queryset.update(can_be_ordered=False)

    def save_model(self, request, obj, form, change):
        if not change and not obj.created_by:
            obj.created_by = request.user

        obj.updated_by = request.user
        super().save_model(request, obj, form, change)


# ============================================================
# 🔹 Product Benefit Admin
# ============================================================

@admin.register(ProductBenefit)
class ProductBenefitAdmin(admin.ModelAdmin):
    list_display = (
        "product",
        "title",
        "sort_order",
        "is_active",
        "created_at",
    )

    list_filter = (
        "is_active",
        "created_at",
    )

    search_fields = (
        "product__code",
        "product__name",
        "title",
        "description",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )

    ordering = (
        "product",
        "sort_order",
        "id",
    )

    list_per_page = 25
    date_hierarchy = "created_at"


# ============================================================
# 🔹 Product Pricing Tier Admin
# ============================================================

@admin.register(ProductPricingTier)
class ProductPricingTierAdmin(admin.ModelAdmin):
    list_display = (
        "product",
        "name",
        "pricing_type",
        "currency_code",
        "price",
        "sale_price",
        "effective_price_display",
        "min_quantity",
        "max_quantity",
        "discount_rate",
        "agent_commission_rate",
        "provider_share_rate",
        "system_share_rate",
        "starts_at",
        "ends_at",
        "sort_order",
        "is_active",
        "created_at",
    )

    list_filter = (
        "pricing_type",
        "is_active",
        "currency_code",
        "starts_at",
        "ends_at",
        "created_at",
    )

    search_fields = (
        "product__code",
        "product__name",
        "name",
    )

    readonly_fields = (
        "effective_price_display",
        "has_discount_display",
        "created_at",
        "updated_at",
    )

    ordering = (
        "product",
        "sort_order",
        "id",
    )

    list_per_page = 25
    date_hierarchy = "created_at"

    fieldsets = (
        (
            "Core Information",
            {
                "fields": (
                    "product",
                    "name",
                    "pricing_type",
                    "currency_code",
                    "sort_order",
                    "is_active",
                )
            },
        ),
        (
            "Price",
            {
                "fields": (
                    "price",
                    "sale_price",
                    "effective_price_display",
                    "has_discount_display",
                    "min_quantity",
                    "max_quantity",
                    "discount_rate",
                )
            },
        ),
        (
            "Shares / Commissions",
            {
                "fields": (
                    "agent_commission_rate",
                    "provider_share_rate",
                    "system_share_rate",
                )
            },
        ),
        (
            "Availability",
            {
                "fields": (
                    "starts_at",
                    "ends_at",
                )
            },
        ),
        (
            "Audit Information",
            {
                "classes": ("collapse",),
                "fields": (
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )

    @admin.display(description="Effective Price")
    def effective_price_display(self, obj):
        return obj.effective_price

    @admin.display(boolean=True, description="Has Discount")
    def has_discount_display(self, obj):
        return obj.has_discount


# ============================================================
# 🔹 Product Service Item Admin
# ============================================================

@admin.register(ProductServiceItem)
class ProductServiceItemAdmin(admin.ModelAdmin):
    list_display = (
        "product",
        "name",
        "included_quantity",
        "unit_price",
        "discount_rate",
        "total_before_discount_display",
        "total_after_discount_display",
        "requires_provider",
        "is_optional",
        "sort_order",
        "is_active",
        "created_at",
    )

    list_filter = (
        "is_active",
        "requires_provider",
        "is_optional",
        "created_at",
    )

    search_fields = (
        "product__code",
        "product__name",
        "name",
        "description",
    )

    readonly_fields = (
        "total_before_discount_display",
        "discount_amount_display",
        "total_after_discount_display",
        "created_at",
        "updated_at",
    )

    ordering = (
        "product",
        "sort_order",
        "id",
    )

    list_per_page = 25
    date_hierarchy = "created_at"

    fieldsets = (
        (
            "Core Information",
            {
                "fields": (
                    "product",
                    "name",
                    "description",
                    "sort_order",
                    "is_active",
                )
            },
        ),
        (
            "Quantity / Pricing",
            {
                "fields": (
                    "included_quantity",
                    "unit_price",
                    "discount_rate",
                    "total_before_discount_display",
                    "discount_amount_display",
                    "total_after_discount_display",
                )
            },
        ),
        (
            "Controls",
            {
                "fields": (
                    "requires_provider",
                    "is_optional",
                )
            },
        ),
        (
            "Audit Information",
            {
                "classes": ("collapse",),
                "fields": (
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )

    @admin.display(description="Total Before Discount")
    def total_before_discount_display(self, obj):
        return obj.total_before_discount

    @admin.display(description="Discount Amount")
    def discount_amount_display(self, obj):
        return obj.discount_amount

    @admin.display(description="Total After Discount")
    def total_after_discount_display(self, obj):
        return obj.total_after_discount