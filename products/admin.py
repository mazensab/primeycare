# ============================================================
# 📂 products/admin.py
# 🧭 Primey Care — Products Admin
# ============================================================

from django.contrib import admin

from .models import (
    Product,
    ProductBenefit,
    ProductCategory,
    ProductPricingTier,
)


# ============================================================
# 🔹 Inlines
# ============================================================

class ProductBenefitInline(admin.TabularInline):
    model = ProductBenefit
    extra = 1
    fields = ("title", "description", "sort_order", "is_active")
    ordering = ("sort_order", "id")


class ProductPricingTierInline(admin.TabularInline):
    model = ProductPricingTier
    extra = 1
    fields = ("name", "price", "sale_price", "sort_order", "is_active")
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
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )

    ordering = ("sort_order", "name")

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
                "fields": (
                    "created_by",
                    "updated_by",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )


# ============================================================
# 🔹 Product Admin
# ============================================================

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "name",
        "product_type",
        "status",
        "billing_type",
        "price",
        "sale_price",
        "currency_code",
        "is_public",
        "is_featured",
        "created_at",
    )

    list_filter = (
        "product_type",
        "status",
        "billing_type",
        "is_public",
        "is_featured",
        "requires_approval",
        "allow_online_purchase",
        "is_taxable",
        "currency_code",
        "category",
        "created_at",
    )

    search_fields = (
        "code",
        "name",
        "slug",
        "short_description",
        "tags",
    )

    readonly_fields = (
        "code",
        "slug",
        "created_at",
        "updated_at",
    )

    ordering = ("sort_order", "-created_at")
    inlines = [ProductBenefitInline, ProductPricingTierInline]

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
                    "is_taxable",
                    "tax_rate",
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
                )
            },
        ),
        (
            "Audit Information",
            {
                "fields": (
                    "created_by",
                    "updated_by",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )


# ============================================================
# 🔹 Standalone Admins
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
    list_filter = ("is_active", "created_at")
    search_fields = ("product__name", "title")
    ordering = ("product", "sort_order", "id")


@admin.register(ProductPricingTier)
class ProductPricingTierAdmin(admin.ModelAdmin):
    list_display = (
        "product",
        "name",
        "price",
        "sale_price",
        "sort_order",
        "is_active",
        "created_at",
    )
    list_filter = ("is_active", "created_at")
    search_fields = ("product__name", "name")
    ordering = ("product", "sort_order", "id")