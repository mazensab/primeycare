# ============================================================
# 📂 contracts/admin.py
# 🧠 Primey Care | Contracts Admin V2.7
# ------------------------------------------------------------
# ✅ إدارة العقود
# ✅ إدارة منتجات/عروض العقد
# ✅ Product ثابت داخل الكتالوج
# ✅ ContractProduct = تسعير/عرض المنتج حسب عقد مقدم الخدمة
# ✅ دعم عروض صفحة الهبوط والتطبيق وصفحة العروض
# ✅ عرض السعر قبل الخصم وبعد الخصم والخصم الفعلي
# ✅ عرض checkout_payload للربط مع /api/offers/ و /api/orders/
# ------------------------------------------------------------
# القاعدة المعتمدة:
# - Product = كتالوج ثابت.
# - Provider = مقدم خدمة.
# - Contract = عقد مقدم الخدمة.
# - ContractProduct = عرض/سعر/خصم المنتج حسب مقدم الخدمة والعقد.
# ============================================================

from __future__ import annotations

import json

from django.contrib import admin
from django.utils.html import format_html

from .models import Contract, ContractProduct, ContractStatus


# ============================================================
# 🔹 Shared Display Helpers
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


# ============================================================
# 🧾 ContractProduct Inline
# ============================================================

class ContractProductInline(admin.StackedInline):
    model = ContractProduct
    extra = 0
    autocomplete_fields = ("product",)

    fields = (
        (
            "product",
            "is_active",
        ),
        (
            "priority",
            "is_featured",
        ),
        (
            "price_before_discount",
            "discount_percentage",
            "price_after_discount",
        ),
        (
            "special_price",
            "system_commission_percentage",
        ),
        (
            "effective_price_before_discount_display",
            "effective_price_after_discount_display",
        ),
        (
            "discount_amount_display",
            "has_discount_display",
        ),
        (
            "effective_system_commission_percentage_display",
            "is_currently_available_display",
        ),
        (
            "usage_limit",
        ),
        "coverage_notes",
        "terms",
        (
            "offer_title",
            "offer_badge",
        ),
        "offer_subtitle",
        "offer_description",
        "offer_terms",
        (
            "offer_start_date",
            "offer_end_date",
        ),
        (
            "show_on_landing",
            "show_on_mobile",
            "show_on_offers",
        ),
        "marketing_image_url",
        "marketing_image_alt_text",
        "checkout_payload_display",
        (
            "created_at",
            "updated_at",
        ),
    )

    readonly_fields = (
        "effective_price_before_discount_display",
        "effective_price_after_discount_display",
        "discount_amount_display",
        "has_discount_display",
        "effective_system_commission_percentage_display",
        "is_currently_available_display",
        "checkout_payload_display",
        "created_at",
        "updated_at",
    )

    ordering = (
        "priority",
        "-is_featured",
        "-created_at",
    )

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related(
                "contract",
                "contract__provider",
                "product",
                "product__category",
            )
        )

    @admin.display(description="السعر الفعلي قبل الخصم")
    def effective_price_before_discount_display(self, obj):
        return _money(obj.effective_price_before_discount)

    @admin.display(description="السعر الفعلي بعد الخصم")
    def effective_price_after_discount_display(self, obj):
        return _money(obj.effective_price_after_discount)

    @admin.display(description="قيمة الخصم")
    def discount_amount_display(self, obj):
        return _money(obj.discount_amount)

    @admin.display(boolean=True, description="يوجد خصم")
    def has_discount_display(self, obj):
        return obj.has_discount

    @admin.display(description="نسبة النظام الفعلية")
    def effective_system_commission_percentage_display(self, obj):
        return obj.effective_system_commission_percentage

    @admin.display(boolean=True, description="متاح حاليًا")
    def is_currently_available_display(self, obj):
        return obj.is_currently_available

    @admin.display(description="Checkout Payload")
    def checkout_payload_display(self, obj):
        payload = json.dumps(
            obj.checkout_payload,
            ensure_ascii=False,
            indent=2,
        )

        return format_html(
            '<pre style="white-space:pre-wrap;direction:ltr;text-align:left;'
            'background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;'
            'padding:12px;max-width:100%;overflow:auto;">{}</pre>',
            payload,
        )


# ============================================================
# 🧾 Contract Admin
# ============================================================

@admin.register(Contract)
class ContractAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "contract_number",
        "provider",
        "status_badge",
        "is_currently_valid_display",
        "pricing_model",
        "discount_percentage",
        "system_commission_percentage",
        "start_date",
        "end_date",
        "created_at",
    )

    list_filter = (
        "status",
        "pricing_model",
        "start_date",
        "end_date",
        "created_at",
        "provider",
    )

    search_fields = (
        "title",
        "contract_number",
        "provider__name",
        "provider__name_ar",
        "provider__name_en",
        "provider_contact_name",
        "provider_contact_phone",
        "provider_contact_email",
        "notes",
        "terms_and_conditions",
    )

    readonly_fields = (
        "is_currently_valid_display",
        "created_at",
        "updated_at",
    )

    autocomplete_fields = ("provider",)

    ordering = ("-created_at",)

    date_hierarchy = "created_at"

    list_per_page = 25

    inlines = [ContractProductInline]

    fieldsets = (
        (
            "بيانات العقد الأساسية",
            {
                "fields": (
                    "provider",
                    "title",
                    "contract_number",
                    "status",
                    "is_currently_valid_display",
                )
            },
        ),
        (
            "تواريخ العقد",
            {
                "fields": (
                    "start_date",
                    "end_date",
                    "signed_at",
                )
            },
        ),
        (
            "بيانات مسؤول الجهة",
            {
                "fields": (
                    "provider_contact_name",
                    "provider_contact_phone",
                    "provider_contact_email",
                )
            },
        ),
        (
            "البيانات المالية العامة",
            {
                "fields": (
                    "pricing_model",
                    "discount_percentage",
                    "system_commission_percentage",
                )
            },
        ),
        (
            "الشروط والملاحظات",
            {
                "fields": (
                    "terms_and_conditions",
                    "notes",
                )
            },
        ),
        (
            "التتبع",
            {
                "classes": ("collapse",),
                "fields": (
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    actions = (
        "mark_as_active",
        "mark_as_draft",
        "mark_as_suspended",
        "mark_as_terminated",
    )

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("provider")
        )

    @admin.display(description="الحالة")
    def status_badge(self, obj: Contract) -> str:
        colors = {
            ContractStatus.DRAFT: ("#6b7280", "#f3f4f6"),
            ContractStatus.ACTIVE: ("#166534", "#dcfce7"),
            ContractStatus.EXPIRED: ("#7c2d12", "#ffedd5"),
            ContractStatus.TERMINATED: ("#991b1b", "#fee2e2"),
            ContractStatus.SUSPENDED: ("#92400e", "#fef3c7"),
        }

        color, background = colors.get(obj.status, ("#374151", "#f3f4f6"))
        return _badge(obj.get_status_display(), color=color, background=background)

    @admin.display(boolean=True, description="ساري حاليًا")
    def is_currently_valid_display(self, obj):
        return obj.is_currently_valid

    @admin.action(description="تفعيل العقود المحددة")
    def mark_as_active(self, request, queryset):
        queryset.update(status=ContractStatus.ACTIVE)

    @admin.action(description="تحويل العقود المحددة إلى مسودة")
    def mark_as_draft(self, request, queryset):
        queryset.update(status=ContractStatus.DRAFT)

    @admin.action(description="إيقاف العقود المحددة")
    def mark_as_suspended(self, request, queryset):
        queryset.update(status=ContractStatus.SUSPENDED)

    @admin.action(description="إنهاء العقود المحددة")
    def mark_as_terminated(self, request, queryset):
        queryset.update(status=ContractStatus.TERMINATED)


# ============================================================
# 🧾 ContractProduct Admin
# ============================================================

@admin.register(ContractProduct)
class ContractProductAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "contract",
        "provider_display",
        "product",
        "active_badge",
        "is_currently_available_display",
        "featured_badge",
        "priority",
        "price_before_discount",
        "discount_percentage",
        "price_after_discount",
        "effective_price_before_discount_display",
        "effective_price_after_discount_display",
        "discount_amount_display",
        "has_discount_display",
        "system_commission_percentage",
        "effective_system_commission_percentage_display",
        "show_on_landing",
        "show_on_mobile",
        "show_on_offers",
        "offer_start_date",
        "offer_end_date",
        "created_at",
    )

    list_filter = (
        "is_active",
        "is_featured",
        "show_on_landing",
        "show_on_mobile",
        "show_on_offers",
        "contract__status",
        "contract__provider",
        "offer_start_date",
        "offer_end_date",
        "created_at",
    )

    search_fields = (
        "contract__title",
        "contract__contract_number",
        "contract__provider__name",
        "contract__provider__name_ar",
        "contract__provider__name_en",
        "product__code",
        "product__name",
        "offer_title",
        "offer_subtitle",
        "offer_badge",
        "offer_description",
        "coverage_notes",
        "terms",
        "offer_terms",
    )

    readonly_fields = (
        "provider_display",
        "effective_price_before_discount_display",
        "effective_price_after_discount_display",
        "discount_amount_display",
        "has_discount_display",
        "effective_system_commission_percentage_display",
        "is_currently_available_display",
        "checkout_payload_display",
        "created_at",
        "updated_at",
    )

    autocomplete_fields = (
        "contract",
        "product",
    )

    ordering = (
        "priority",
        "-is_featured",
        "-created_at",
    )

    date_hierarchy = "created_at"

    list_per_page = 25

    fieldsets = (
        (
            "الربط الأساسي",
            {
                "fields": (
                    "contract",
                    "provider_display",
                    "product",
                    "is_active",
                    "is_currently_available_display",
                    "priority",
                    "is_featured",
                )
            },
        ),
        (
            "التسعير داخل العقد",
            {
                "fields": (
                    "price_before_discount",
                    "discount_percentage",
                    "price_after_discount",
                    "special_price",
                    "effective_price_before_discount_display",
                    "effective_price_after_discount_display",
                    "discount_amount_display",
                    "has_discount_display",
                    "system_commission_percentage",
                    "effective_system_commission_percentage_display",
                )
            },
        ),
        (
            "التغطية والشروط",
            {
                "fields": (
                    "usage_limit",
                    "coverage_notes",
                    "terms",
                )
            },
        ),
        (
            "بيانات العرض التسويقي",
            {
                "fields": (
                    "offer_title",
                    "offer_subtitle",
                    "offer_badge",
                    "offer_description",
                    "offer_terms",
                    "offer_start_date",
                    "offer_end_date",
                )
            },
        ),
        (
            "ظهور العرض",
            {
                "fields": (
                    "show_on_landing",
                    "show_on_mobile",
                    "show_on_offers",
                )
            },
        ),
        (
            "صورة العرض",
            {
                "fields": (
                    "marketing_image_url",
                    "marketing_image_alt_text",
                )
            },
        ),
        (
            "Payload الربط مع الطلب",
            {
                "classes": ("collapse",),
                "fields": (
                    "checkout_payload_display",
                )
            },
        ),
        (
            "التتبع",
            {
                "classes": ("collapse",),
                "fields": (
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    actions = (
        "activate_selected",
        "deactivate_selected",
        "mark_as_featured",
        "unmark_as_featured",
        "show_selected_on_landing",
        "hide_selected_from_landing",
        "show_selected_on_mobile",
        "hide_selected_from_mobile",
        "show_selected_on_offers",
        "hide_selected_from_offers",
    )

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related(
                "contract",
                "contract__provider",
                "product",
                "product__category",
            )
        )

    @admin.display(description="مقدم الخدمة")
    def provider_display(self, obj):
        provider = obj.provider
        return provider if provider else "-"

    @admin.display(description="نشط")
    def active_badge(self, obj):
        if obj.is_active:
            return _badge("نشط", color="#166534", background="#dcfce7")

        return _badge("موقوف", color="#991b1b", background="#fee2e2")

    @admin.display(description="مميز")
    def featured_badge(self, obj):
        if obj.is_featured:
            return _badge("مميز", color="#432a58", background="#f4ecff")

        return _badge("عادي", color="#6b7280", background="#f3f4f6")

    @admin.display(description="السعر الفعلي قبل الخصم")
    def effective_price_before_discount_display(self, obj):
        return _money(obj.effective_price_before_discount)

    @admin.display(description="السعر الفعلي بعد الخصم")
    def effective_price_after_discount_display(self, obj):
        return _money(obj.effective_price_after_discount)

    @admin.display(description="قيمة الخصم")
    def discount_amount_display(self, obj):
        return _money(obj.discount_amount)

    @admin.display(boolean=True, description="يوجد خصم")
    def has_discount_display(self, obj):
        return obj.has_discount

    @admin.display(description="نسبة النظام الفعلية")
    def effective_system_commission_percentage_display(self, obj):
        return obj.effective_system_commission_percentage

    @admin.display(boolean=True, description="متاح حاليًا")
    def is_currently_available_display(self, obj):
        return obj.is_currently_available

    @admin.display(description="Checkout Payload")
    def checkout_payload_display(self, obj):
        payload = json.dumps(
            obj.checkout_payload,
            ensure_ascii=False,
            indent=2,
        )

        return format_html(
            '<pre style="white-space:pre-wrap;direction:ltr;text-align:left;'
            'background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;'
            'padding:12px;max-width:100%;overflow:auto;">{}</pre>',
            payload,
        )

    @admin.action(description="تفعيل عروض المنتجات المحددة")
    def activate_selected(self, request, queryset):
        queryset.update(is_active=True)

    @admin.action(description="إيقاف عروض المنتجات المحددة")
    def deactivate_selected(self, request, queryset):
        queryset.update(is_active=False)

    @admin.action(description="تمييز العروض المحددة")
    def mark_as_featured(self, request, queryset):
        queryset.update(is_featured=True)

    @admin.action(description="إلغاء تمييز العروض المحددة")
    def unmark_as_featured(self, request, queryset):
        queryset.update(is_featured=False)

    @admin.action(description="إظهار العروض المحددة في صفحة الهبوط")
    def show_selected_on_landing(self, request, queryset):
        queryset.update(show_on_landing=True)

    @admin.action(description="إخفاء العروض المحددة من صفحة الهبوط")
    def hide_selected_from_landing(self, request, queryset):
        queryset.update(show_on_landing=False)

    @admin.action(description="إظهار العروض المحددة في التطبيق")
    def show_selected_on_mobile(self, request, queryset):
        queryset.update(show_on_mobile=True)

    @admin.action(description="إخفاء العروض المحددة من التطبيق")
    def hide_selected_from_mobile(self, request, queryset):
        queryset.update(show_on_mobile=False)

    @admin.action(description="إظهار العروض المحددة في صفحة العروض")
    def show_selected_on_offers(self, request, queryset):
        queryset.update(show_on_offers=True)

    @admin.action(description="إخفاء العروض المحددة من صفحة العروض")
    def hide_selected_from_offers(self, request, queryset):
        queryset.update(show_on_offers=False)