# ============================================================
# 📂 products/admin.py
# 🧭 Primey Care — Products Catalog Admin V2.7
# ------------------------------------------------------------
# ✅ يدير:
#    - Product Categories
#    - Catalog Products
#    - Cards
#    - Medical Services
#    - Memberships / Programs
#    - General Product Marketing Images
#    - Benefits
#    - Pricing Tiers
#    - Product Service Items
# ------------------------------------------------------------
# القاعدة المعتمدة:
# - Product = كتالوج ثابت
# - لا يتم ربط المنتج بمقدم خدمة عند الإنشاء
# - عروض وأسعار مقدمي الخدمة تكون في contracts.ContractProduct
# - provider داخل Product موجود للتوافق القديم فقط
# ============================================================

from __future__ import annotations

import json

from django.contrib import admin
from django.utils.html import format_html

from .models import (
    Product,
    ProductBenefit,
    ProductCategory,
    ProductPricingTier,
    ProductServiceItem,
)


# ============================================================
# 🔹 Shared Helpers
# ============================================================

def _badge(label: str, *, color: str = "#374151", background: str = "#f3f4f6") -> str:
    return format_html(
        '<span style="display:inline-block;padding:3px 8px;border-radius:999px;'
        'font-weight:700;color:{};background:{};">{}</span>',
        color,
        background,
        label,
    )


def _money(value) -> str:
    try:
        return f"{value:.2f}"
    except Exception:
        return str(value or "0.00")


def _json_pre(payload: dict) -> str:
    rendered = json.dumps(payload or {}, ensure_ascii=False, indent=2)
    return format_html(
        '<pre style="white-space:pre-wrap;direction:ltr;text-align:left;'
        'background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;'
        'padding:12px;max-width:100%;overflow:auto;">{}</pre>',
        rendered,
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
        "effective_price_display",
        "has_discount_display",
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
    readonly_fields = (
        "effective_price_display",
        "has_discount_display",
    )
    ordering = ("sort_order", "id")

    @admin.display(description="Effective Price")
    def effective_price_display(self, obj):
        if not obj.pk:
            return "-"
        return _money(obj.effective_price)

    @admin.display(boolean=True, description="Has Discount")
    def has_discount_display(self, obj):
        if not obj.pk:
            return False
        return obj.has_discount


class ProductServiceItemInline(admin.TabularInline):
    model = ProductServiceItem
    extra = 0
    fields = (
        "name",
        "description",
        "included_quantity",
        "unit_price",
        "discount_rate",
        "total_before_discount_display",
        "discount_amount_display",
        "total_after_discount_display",
        "requires_provider",
        "is_optional",
        "sort_order",
        "is_active",
    )
    readonly_fields = (
        "total_before_discount_display",
        "discount_amount_display",
        "total_after_discount_display",
    )
    ordering = ("sort_order", "id")

    @admin.display(description="Total Before Discount")
    def total_before_discount_display(self, obj):
        if not obj.pk:
            return "-"
        return _money(obj.total_before_discount)

    @admin.display(description="Discount Amount")
    def discount_amount_display(self, obj):
        if not obj.pk:
            return "-"
        return _money(obj.discount_amount)

    @admin.display(description="Total After Discount")
    def total_after_discount_display(self, obj):
        if not obj.pk:
            return "-"
        return _money(obj.total_after_discount)


# ============================================================
# 🔹 Product Category Admin
# ============================================================

@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "name",
        "category_type",
        "status_badge",
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

    @admin.display(description="Status")
    def status_badge(self, obj):
        if obj.status == ProductCategory.Status.ACTIVE:
            return _badge("Active", color="#166534", background="#dcfce7")
        return _badge("Inactive", color="#991b1b", background="#fee2e2")

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
        "product_type_badge",
        "category",
        "status_badge",
        "price",
        "discount_percentage",
        "sale_price",
        "price_after_discount_display",
        "has_discount_display",
        "currency_code",
        "has_duration",
        "duration_value",
        "duration_unit",
        "has_expiry",
        "is_offer",
        "show_on_landing",
        "show_on_mobile",
        "show_on_offers",
        "can_be_ordered",
        "can_be_used_in_contracts",
        "requires_provider",
        "catalog_source_badge",
        "is_available_for_order_display",
        "created_at",
    )

    list_filter = (
        "product_type",
        "category",
        "status",
        "billing_type",
        "fulfillment_type",
        "has_duration",
        "duration_unit",
        "has_expiry",
        "valid_from",
        "valid_until",
        "is_offer",
        "show_on_landing",
        "show_on_mobile",
        "show_on_offers",
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
        "offer_start_date",
        "offer_end_date",
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
        "offer_title",
        "offer_subtitle",
        "offer_badge",
        "offer_terms",
        "provider__code",
        "provider__name",
        "provider__name_ar",
        "provider__name_en",
    )

    readonly_fields = (
        "code",
        "slug",
        "price_before_discount_display",
        "discount_amount_display",
        "price_after_discount_display",
        "effective_price_display",
        "tax_amount_display",
        "total_price_with_tax_display",
        "has_discount_display",
        "is_catalog_product_display",
        "is_provider_product_display",
        "is_available_for_order_display",
        "has_thumbnail_image_display",
        "has_marketing_image_display",
        "is_current_offer_display",
        "catalog_payload_display",
        "checkout_payload_display",
        "created_at",
        "updated_at",
    )

    autocomplete_fields = (
        "category",
        "provider",
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
            "Core Information - بيانات الكتالوج الأساسية",
            {
                "description": (
                    "المنتج هنا كتالوج ثابت فقط. لا تربطه بمقدم خدمة في التطوير الجديد. "
                    "أسعار وعروض مقدمي الخدمة تكون من خلال ContractProduct داخل العقود."
                ),
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
                    "is_catalog_product_display",
                )
            },
        ),
        (
            "Descriptions - الوصف والمزايا",
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
            "Catalog Pricing - تسعير المنتج الأساسي",
            {
                "description": (
                    "هذا تسعير كتالوج عام. التسعير المختلف لكل مقدم خدمة يكون داخل ContractProduct."
                ),
                "fields": (
                    "currency_code",
                    "price",
                    "discount_percentage",
                    "sale_price",
                    "price_before_discount_display",
                    "discount_amount_display",
                    "price_after_discount_display",
                    "effective_price_display",
                    "has_discount_display",
                    "cost_price",
                    "is_taxable",
                    "tax_rate",
                    "tax_amount_display",
                    "total_price_with_tax_display",
                )
            },
        ),
        (
            "Duration / Validity - مدة المنتج وصلاحيته",
            {
                "fields": (
                    "has_duration",
                    "duration_value",
                    "duration_unit",
                    "has_expiry",
                    "valid_from",
                    "valid_until",
                    "is_available_for_order_display",
                )
            },
        ),
        (
            "Thumbnail Image - صورة رمزية داخل النظام",
            {
                "fields": (
                    "thumbnail_image_url",
                    "thumbnail_image_drive_file_id",
                    "thumbnail_image_drive_view_url",
                    "thumbnail_image_folder_id",
                    "thumbnail_image_folder_url",
                    "thumbnail_image_alt_text",
                    "has_thumbnail_image_display",
                )
            },
        ),
        (
            "Marketing Image - صورة المنتج العامة للهبوط والتطبيق والعروض",
            {
                "description": (
                    "هذه صورة المنتج العامة. صورة عرض مقدم الخدمة المحدد تكون داخل ContractProduct."
                ),
                "fields": (
                    "marketing_image_url",
                    "marketing_image_drive_file_id",
                    "marketing_image_drive_view_url",
                    "marketing_image_folder_id",
                    "marketing_image_folder_url",
                    "marketing_image_alt_text",
                    "has_marketing_image_display",
                )
            },
        ),
        (
            "General Marketing / Offer Controls - عروض عامة للمنتج",
            {
                "description": (
                    "هذه للعروض العامة على المنتج نفسه. عروض مقدم الخدمة المتغيرة تكون داخل ContractProduct."
                ),
                "fields": (
                    "is_offer",
                    "offer_title",
                    "offer_subtitle",
                    "offer_badge",
                    "offer_terms",
                    "offer_start_date",
                    "offer_end_date",
                    "show_on_landing",
                    "show_on_mobile",
                    "show_on_offers",
                    "is_current_offer_display",
                )
            },
        ),
        (
            "Sales Controls - التحكم بالبيع والاستخدام",
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
            "Discounts / Commissions - حدود الخصم والعمولات",
            {
                "fields": (
                    "max_discount_rate",
                    "default_agent_commission_rate",
                )
            },
        ),
        (
            "Payloads - بيانات جاهزة للربط",
            {
                "classes": ("collapse",),
                "description": (
                    "catalog_payload و checkout_payload مفيدة للاختبار والربط. "
                    "إذا كان المنتج يحتاج مقدم خدمة، فالـ checkout الحقيقي يجب أن يأتي من /api/offers/ عبر ContractProduct."
                ),
                "fields": (
                    "catalog_payload_display",
                    "checkout_payload_display",
                ),
            },
        ),
        (
            "Legacy Provider Link - ربط قديم لا يستخدم في التطوير الجديد",
            {
                "classes": ("collapse",),
                "description": (
                    "هذا الحقل موجود للتوافق مع بيانات قديمة فقط. "
                    "الربط الصحيح بين المنتج ومقدم الخدمة يكون من خلال ContractProduct داخل العقود."
                ),
                "fields": (
                    "provider",
                    "is_provider_product_display",
                ),
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
        "mark_as_offer",
        "unmark_as_offer",
        "show_selected_on_landing",
        "hide_selected_from_landing",
        "show_selected_on_mobile",
        "hide_selected_from_mobile",
        "show_selected_on_offers",
        "hide_selected_from_offers",
        "enable_contract_usage",
        "disable_contract_usage",
        "mark_as_featured",
        "unmark_as_featured",
    )

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related(
                "category",
                "provider",
                "created_by",
                "updated_by",
            )
        )

    @admin.display(description="Type")
    def product_type_badge(self, obj):
        colors = {
            Product.ProductType.CARD: ("#432a58", "#f4ecff"),
            Product.ProductType.MEDICAL_SERVICE: ("#075985", "#e0f2fe"),
            Product.ProductType.SERVICE: ("#075985", "#e0f2fe"),
            Product.ProductType.PROGRAM: ("#166534", "#dcfce7"),
            Product.ProductType.MEMBERSHIP: ("#92400e", "#fef3c7"),
            Product.ProductType.OTHER: ("#6b7280", "#f3f4f6"),
        }
        color, background = colors.get(obj.product_type, ("#374151", "#f3f4f6"))
        return _badge(obj.get_product_type_display(), color=color, background=background)

    @admin.display(description="Status")
    def status_badge(self, obj):
        colors = {
            Product.Status.DRAFT: ("#6b7280", "#f3f4f6"),
            Product.Status.ACTIVE: ("#166534", "#dcfce7"),
            Product.Status.INACTIVE: ("#92400e", "#fef3c7"),
            Product.Status.ARCHIVED: ("#991b1b", "#fee2e2"),
        }
        color, background = colors.get(obj.status, ("#374151", "#f3f4f6"))
        return _badge(obj.get_status_display(), color=color, background=background)

    @admin.display(description="Source")
    def catalog_source_badge(self, obj):
        if obj.is_catalog_product:
            return _badge("Catalog", color="#166534", background="#dcfce7")

        return _badge("Legacy Provider", color="#92400e", background="#fef3c7")

    @admin.display(description="Price Before Discount")
    def price_before_discount_display(self, obj):
        return _money(obj.price_before_discount)

    @admin.display(description="Discount Amount")
    def discount_amount_display(self, obj):
        return _money(obj.discount_amount)

    @admin.display(description="Price After Discount")
    def price_after_discount_display(self, obj):
        return _money(obj.price_after_discount)

    @admin.display(description="Effective Price")
    def effective_price_display(self, obj):
        return _money(obj.effective_price)

    @admin.display(boolean=True, description="Has Discount")
    def has_discount_display(self, obj):
        return obj.has_discount

    @admin.display(description="Tax Amount")
    def tax_amount_display(self, obj):
        return _money(obj.tax_amount)

    @admin.display(description="Total With Tax")
    def total_price_with_tax_display(self, obj):
        return _money(obj.total_price_with_tax)

    @admin.display(boolean=True, description="Catalog Product")
    def is_catalog_product_display(self, obj):
        return obj.is_catalog_product

    @admin.display(boolean=True, description="Legacy Provider Product")
    def is_provider_product_display(self, obj):
        return obj.is_provider_product

    @admin.display(boolean=True, description="Available For Order")
    def is_available_for_order_display(self, obj):
        return obj.is_available_for_order

    @admin.display(boolean=True, description="Thumbnail")
    def has_thumbnail_image_display(self, obj):
        return obj.has_thumbnail_image

    @admin.display(boolean=True, description="Marketing Image")
    def has_marketing_image_display(self, obj):
        return obj.has_marketing_image

    @admin.display(boolean=True, description="Current Offer")
    def is_current_offer_display(self, obj):
        return obj.is_current_offer

    @admin.display(description="Catalog Payload")
    def catalog_payload_display(self, obj):
        return _json_pre(obj.catalog_payload)

    @admin.display(description="Checkout Payload")
    def checkout_payload_display(self, obj):
        return _json_pre(obj.checkout_payload)

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

    @admin.action(description="Mark as offer")
    def mark_as_offer(self, request, queryset):
        queryset.update(is_offer=True)

    @admin.action(description="Unmark as offer")
    def unmark_as_offer(self, request, queryset):
        queryset.update(is_offer=False)

    @admin.action(description="Show on landing")
    def show_selected_on_landing(self, request, queryset):
        queryset.update(show_on_landing=True)

    @admin.action(description="Hide from landing")
    def hide_selected_from_landing(self, request, queryset):
        queryset.update(show_on_landing=False)

    @admin.action(description="Show on mobile")
    def show_selected_on_mobile(self, request, queryset):
        queryset.update(show_on_mobile=True)

    @admin.action(description="Hide from mobile")
    def hide_selected_from_mobile(self, request, queryset):
        queryset.update(show_on_mobile=False)

    @admin.action(description="Show on offers")
    def show_selected_on_offers(self, request, queryset):
        queryset.update(show_on_offers=True)

    @admin.action(description="Hide from offers")
    def hide_selected_from_offers(self, request, queryset):
        queryset.update(show_on_offers=False)

    @admin.action(description="Enable contract usage")
    def enable_contract_usage(self, request, queryset):
        queryset.update(can_be_used_in_contracts=True)

    @admin.action(description="Disable contract usage")
    def disable_contract_usage(self, request, queryset):
        queryset.update(can_be_used_in_contracts=False)

    @admin.action(description="Mark as featured")
    def mark_as_featured(self, request, queryset):
        queryset.update(is_featured=True)

    @admin.action(description="Unmark as featured")
    def unmark_as_featured(self, request, queryset):
        queryset.update(is_featured=False)

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

    autocomplete_fields = (
        "product",
    )

    ordering = (
        "product",
        "sort_order",
        "id",
    )

    list_per_page = 25
    date_hierarchy = "created_at"

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("product")


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
        "has_discount_display",
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

    autocomplete_fields = (
        "product",
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

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("product")

    @admin.display(description="Effective Price")
    def effective_price_display(self, obj):
        return _money(obj.effective_price)

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
        "discount_amount_display",
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

    autocomplete_fields = (
        "product",
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

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("product")

    @admin.display(description="Total Before Discount")
    def total_before_discount_display(self, obj):
        return _money(obj.total_before_discount)

    @admin.display(description="Discount Amount")
    def discount_amount_display(self, obj):
        return _money(obj.discount_amount)

    @admin.display(description="Total After Discount")
    def total_after_discount_display(self, obj):
        return _money(obj.total_after_discount)