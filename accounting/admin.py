# ============================================================
# 📂 accounting/admin.py
# 🧠 Primey Care | Accounting Admin
# ------------------------------------------------------------
# ✅ إدارة دليل الحسابات
# ✅ إدارة مراكز التكلفة
# ✅ إدارة السنوات والفترات المالية
# ✅ إدارة الضرائب
# ✅ إدارة إعدادات وقواعد التوجيه المحاسبي
# ✅ إدارة القيود اليومية وأسطر القيود
# ✅ إدارة الحركات الضريبية
# ------------------------------------------------------------
# ملاحظات:
# - يمنع تعديل أسطر القيود المرحلة أو الملغية من خلال validation في models.py.
# - إجماليات القيد تتحدث تلقائيًا من JournalEntryLine.save/delete.
# - لوحة الإدارة هنا مخصصة للمراجعة والإدارة الداخلية.
# ============================================================

from django.contrib import admin, messages
from django.core.exceptions import ValidationError
from django.db.models import F
from django.utils.html import format_html

from .models import (
    Account,
    AccountNature,
    AccountType,
    AccountingPeriod,
    AccountingPeriodStatus,
    AccountingRoutingRule,
    AccountingRoutingSource,
    AccountingSettings,
    CostCenter,
    CostCenterStatus,
    FiscalYear,
    FiscalYearStatus,
    JournalEntry,
    JournalEntryLine,
    JournalEntryStatus,
    PostingSource,
    TaxRate,
    TaxTransaction,
)


# ============================================================
# 🧩 Filters
# ============================================================

class HasParentFilter(admin.SimpleListFilter):
    title = "له حساب أب"
    parameter_name = "has_parent"

    def lookups(self, request, model_admin):
        return (
            ("yes", "نعم"),
            ("no", "لا"),
        )

    def queryset(self, request, queryset):
        if self.value() == "yes":
            return queryset.filter(parent__isnull=False)
        if self.value() == "no":
            return queryset.filter(parent__isnull=True)
        return queryset


class AccountPostingAvailabilityFilter(admin.SimpleListFilter):
    title = "قابل للترحيل"
    parameter_name = "can_post"

    def lookups(self, request, model_admin):
        return (
            ("yes", "قابل للترحيل"),
            ("no", "غير قابل للترحيل"),
        )

    def queryset(self, request, queryset):
        if self.value() == "yes":
            return queryset.filter(is_active=True, is_group=False)
        if self.value() == "no":
            return queryset.exclude(is_active=True, is_group=False)
        return queryset


class CostCenterPostingAvailabilityFilter(admin.SimpleListFilter):
    title = "قابل للترحيل"
    parameter_name = "can_post"

    def lookups(self, request, model_admin):
        return (
            ("yes", "قابل للترحيل"),
            ("no", "غير قابل للترحيل"),
        )

    def queryset(self, request, queryset):
        if self.value() == "yes":
            return queryset.filter(status=CostCenterStatus.ACTIVE, is_group=False)
        if self.value() == "no":
            return queryset.exclude(status=CostCenterStatus.ACTIVE, is_group=False)
        return queryset


class IsBalancedFilter(admin.SimpleListFilter):
    title = "متوازن"
    parameter_name = "is_balanced"

    def lookups(self, request, model_admin):
        return (
            ("yes", "متوازن"),
            ("no", "غير متوازن"),
        )

    def queryset(self, request, queryset):
        if self.value() == "yes":
            return queryset.filter(total_debit=F("total_credit"))
        if self.value() == "no":
            return queryset.exclude(total_debit=F("total_credit"))
        return queryset


class PeriodClosedFilter(admin.SimpleListFilter):
    title = "حالة الإغلاق"
    parameter_name = "period_closed"

    def lookups(self, request, model_admin):
        return (
            ("open", "مفتوحة"),
            ("closed", "مغلقة/مقفلة"),
        )

    def queryset(self, request, queryset):
        if self.value() == "open":
            return queryset.filter(status=AccountingPeriodStatus.OPEN)
        if self.value() == "closed":
            return queryset.filter(
                status__in=[
                    AccountingPeriodStatus.CLOSED,
                    AccountingPeriodStatus.LOCKED,
                ]
            )
        return queryset


# ============================================================
# 🧾 JournalEntryLine Inline
# ============================================================

class JournalEntryLineInline(admin.TabularInline):
    model = JournalEntryLine
    extra = 0
    min_num = 0
    can_delete = True
    show_change_link = True

    fields = (
        "sort_order",
        "account",
        "cost_center",
        "description",
        "debit_amount",
        "credit_amount",
        "tax_rate",
        "tax_amount",
        "party_type",
        "party_id",
        "line_type_display",
        "created_at",
        "updated_at",
    )

    readonly_fields = (
        "line_type_display",
        "created_at",
        "updated_at",
    )

    autocomplete_fields = (
        "account",
        "cost_center",
        "tax_rate",
    )

    ordering = (
        "sort_order",
        "id",
    )

    def line_type_display(self, obj):
        if not obj or not obj.pk:
            return "-"

        if obj.debit_amount and obj.debit_amount > 0:
            return format_html(
                '<span style="color:#166534;font-weight:700;">مدين</span>'
            )

        if obj.credit_amount and obj.credit_amount > 0:
            return format_html(
                '<span style="color:#1d4ed8;font-weight:700;">دائن</span>'
            )

        return format_html(
            '<span style="color:#991b1b;font-weight:700;">صفري</span>'
        )

    line_type_display.short_description = "نوع السطر"

    def has_add_permission(self, request, obj=None):
        if obj and not obj.can_edit_lines:
            return False
        return super().has_add_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        if obj and not obj.can_edit_lines:
            return False
        return super().has_delete_permission(request, obj)


# ============================================================
# 🌳 Account Admin
# ============================================================

@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "code",
        "name",
        "name_en",
        "account_type_badge",
        "nature_badge",
        "parent",
        "level",
        "is_group",
        "is_active",
        "allow_manual_posting",
        "is_system",
        "currency",
        "can_post_display",
        "children_count",
        "created_at",
    )

    list_filter = (
        "account_type",
        "nature",
        "is_group",
        "is_active",
        "allow_manual_posting",
        "is_system",
        "currency",
        "level",
        HasParentFilter,
        AccountPostingAvailabilityFilter,
        "created_at",
    )

    search_fields = (
        "code",
        "name",
        "name_en",
        "description",
        "parent__code",
        "parent__name",
    )

    readonly_fields = (
        "level",
        "children_count",
        "can_post_display",
        "created_at",
        "updated_at",
    )

    fieldsets = (
        (
            "البيانات الأساسية",
            {
                "fields": (
                    "code",
                    "name",
                    "name_en",
                    "account_type",
                    "nature",
                    "currency",
                    "description",
                )
            },
        ),
        (
            "الهيكل الشجري",
            {
                "fields": (
                    "parent",
                    "level",
                    "is_group",
                    "children_count",
                )
            },
        ),
        (
            "التشغيل والحالة",
            {
                "fields": (
                    "is_active",
                    "allow_manual_posting",
                    "is_system",
                    "opening_balance",
                    "can_post_display",
                )
            },
        ),
        (
            "بيانات إضافية",
            {
                "classes": ("collapse",),
                "fields": (
                    "metadata",
                ),
            },
        ),
        (
            "التتبع",
            {
                "classes": ("collapse",),
                "fields": (
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )

    autocomplete_fields = (
        "parent",
    )

    ordering = (
        "code",
    )

    actions = (
        "activate_accounts",
        "deactivate_accounts",
        "mark_as_system",
        "unmark_as_system",
    )

    list_per_page = 50
    save_on_top = True

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("parent")
            .prefetch_related("children")
        )

    def account_type_badge(self, obj):
        colors = {
            AccountType.ASSET: "#2563eb",
            AccountType.LIABILITY: "#9333ea",
            AccountType.EQUITY: "#0f766e",
            AccountType.REVENUE: "#15803d",
            AccountType.EXPENSE: "#b45309",
        }

        color = colors.get(obj.account_type, "#374151")
        return format_html(
            '<span style="color:{};font-weight:700;">{}</span>',
            color,
            obj.get_account_type_display(),
        )

    account_type_badge.short_description = "نوع الحساب"
    account_type_badge.admin_order_field = "account_type"

    def nature_badge(self, obj):
        if obj.nature == AccountNature.DEBIT:
            return format_html(
                '<span style="color:#166534;font-weight:700;">مدين</span>'
            )

        if obj.nature == AccountNature.CREDIT:
            return format_html(
                '<span style="color:#1d4ed8;font-weight:700;">دائن</span>'
            )

        return "-"

    nature_badge.short_description = "الطبيعة"
    nature_badge.admin_order_field = "nature"

    def can_post_display(self, obj):
        can_post = bool(obj.is_active and not obj.is_group)

        if can_post:
            return format_html(
                '<span style="color:#166534;font-weight:700;">قابل للترحيل</span>'
            )

        return format_html(
            '<span style="color:#991b1b;font-weight:700;">غير قابل للترحيل</span>'
        )

    can_post_display.short_description = "قابل للترحيل"

    def children_count(self, obj):
        if not obj or not obj.pk:
            return 0
        return obj.children.count()

    children_count.short_description = "عدد الحسابات الفرعية"

    @admin.action(description="تفعيل الحسابات المحددة")
    def activate_accounts(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f"تم تفعيل {updated} حساب.")

    @admin.action(description="تعطيل الحسابات المحددة")
    def deactivate_accounts(self, request, queryset):
        protected_codes = []
        disabled_count = 0

        for account in queryset:
            if account.is_system:
                protected_codes.append(f"{account.code} نظامي")
                continue

            if account.journal_lines.exists():
                protected_codes.append(account.code)
                continue

            account.is_active = False
            account.save(update_fields=["is_active", "updated_at"])
            disabled_count += 1

        if disabled_count:
            self.message_user(request, f"تم تعطيل {disabled_count} حساب.")

        if protected_codes:
            self.message_user(
                request,
                "لم يتم تعطيل الحسابات المحمية أو المرتبطة بقيود: "
                + ", ".join(protected_codes),
                level=messages.WARNING,
            )

    @admin.action(description="تعليم الحسابات المحددة كحسابات نظامية")
    def mark_as_system(self, request, queryset):
        updated = queryset.update(is_system=True)
        self.message_user(request, f"تم تعليم {updated} حساب كحساب نظامي.")

    @admin.action(description="إلغاء تعليم الحسابات المحددة كحسابات نظامية")
    def unmark_as_system(self, request, queryset):
        updated = queryset.update(is_system=False)
        self.message_user(request, f"تم إلغاء تعليم {updated} حساب كحساب نظامي.")


# ============================================================
# 🧩 CostCenter Admin
# ============================================================

@admin.register(CostCenter)
class CostCenterAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "code",
        "name",
        "name_en",
        "parent",
        "level",
        "is_group",
        "status_badge",
        "can_post_display",
        "children_count",
        "created_at",
    )

    list_filter = (
        "status",
        "is_group",
        "level",
        HasParentFilter,
        CostCenterPostingAvailabilityFilter,
        "created_at",
    )

    search_fields = (
        "code",
        "name",
        "name_en",
        "description",
        "parent__code",
        "parent__name",
    )

    readonly_fields = (
        "level",
        "children_count",
        "can_post_display",
        "created_at",
        "updated_at",
    )

    fieldsets = (
        (
            "البيانات الأساسية",
            {
                "fields": (
                    "code",
                    "name",
                    "name_en",
                    "description",
                )
            },
        ),
        (
            "الهيكل الشجري",
            {
                "fields": (
                    "parent",
                    "level",
                    "is_group",
                    "children_count",
                )
            },
        ),
        (
            "الحالة",
            {
                "fields": (
                    "status",
                    "can_post_display",
                )
            },
        ),
        (
            "بيانات إضافية",
            {
                "classes": ("collapse",),
                "fields": (
                    "metadata",
                ),
            },
        ),
        (
            "التتبع",
            {
                "classes": ("collapse",),
                "fields": (
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )

    autocomplete_fields = (
        "parent",
    )

    ordering = ("code",)
    list_per_page = 50
    save_on_top = True

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("parent")
            .prefetch_related("children")
        )

    def status_badge(self, obj):
        if obj.status == CostCenterStatus.ACTIVE:
            return format_html(
                '<span style="color:#166534;font-weight:700;">نشط</span>'
            )

        return format_html(
            '<span style="color:#991b1b;font-weight:700;">غير نشط</span>'
        )

    status_badge.short_description = "الحالة"
    status_badge.admin_order_field = "status"

    def can_post_display(self, obj):
        if obj.can_post:
            return format_html(
                '<span style="color:#166534;font-weight:700;">قابل للترحيل</span>'
            )

        return format_html(
            '<span style="color:#991b1b;font-weight:700;">غير قابل للترحيل</span>'
        )

    can_post_display.short_description = "قابل للترحيل"

    def children_count(self, obj):
        if not obj or not obj.pk:
            return 0
        return obj.children.count()

    children_count.short_description = "عدد الفروع"


# ============================================================
# 📅 FiscalYear Admin
# ============================================================

@admin.register(FiscalYear)
class FiscalYearAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "start_date",
        "end_date",
        "status_badge",
        "is_current",
        "closed_at",
        "created_at",
    )

    list_filter = (
        "status",
        "is_current",
        "start_date",
        "end_date",
        "created_at",
    )

    search_fields = (
        "name",
        "description",
    )

    readonly_fields = (
        "closed_at",
        "created_at",
        "updated_at",
    )

    fieldsets = (
        (
            "بيانات السنة المالية",
            {
                "fields": (
                    "name",
                    "start_date",
                    "end_date",
                    "status",
                    "is_current",
                    "description",
                )
            },
        ),
        (
            "الإغلاق والتتبع",
            {
                "classes": ("collapse",),
                "fields": (
                    "closed_at",
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )

    ordering = ("-start_date",)
    date_hierarchy = "start_date"
    list_per_page = 50
    save_on_top = True

    def status_badge(self, obj):
        if obj.status == FiscalYearStatus.OPEN:
            return format_html(
                '<span style="color:#166534;font-weight:700;">مفتوحة</span>'
            )

        if obj.status == FiscalYearStatus.CLOSED:
            return format_html(
                '<span style="color:#991b1b;font-weight:700;">مغلقة</span>'
            )

        return format_html(
            '<span style="color:#4b5563;font-weight:700;">مؤرشفة</span>'
        )

    status_badge.short_description = "الحالة"
    status_badge.admin_order_field = "status"


# ============================================================
# 📆 AccountingPeriod Admin
# ============================================================

@admin.register(AccountingPeriod)
class AccountingPeriodAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "fiscal_year",
        "start_date",
        "end_date",
        "status_badge",
        "is_adjustment_period",
        "closed_at",
        "created_at",
    )

    list_filter = (
        "status",
        "is_adjustment_period",
        PeriodClosedFilter,
        "fiscal_year",
        "start_date",
        "end_date",
        "created_at",
    )

    search_fields = (
        "name",
        "fiscal_year__name",
    )

    readonly_fields = (
        "closed_at",
        "created_at",
        "updated_at",
    )

    autocomplete_fields = (
        "fiscal_year",
    )

    fieldsets = (
        (
            "بيانات الفترة",
            {
                "fields": (
                    "fiscal_year",
                    "name",
                    "start_date",
                    "end_date",
                    "status",
                    "is_adjustment_period",
                )
            },
        ),
        (
            "الإغلاق والتتبع",
            {
                "classes": ("collapse",),
                "fields": (
                    "closed_at",
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )

    ordering = ("-fiscal_year__start_date", "start_date")
    date_hierarchy = "start_date"
    list_per_page = 50
    save_on_top = True

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("fiscal_year")

    def status_badge(self, obj):
        if obj.status == AccountingPeriodStatus.OPEN:
            return format_html(
                '<span style="color:#166534;font-weight:700;">مفتوحة</span>'
            )

        if obj.status == AccountingPeriodStatus.CLOSED:
            return format_html(
                '<span style="color:#991b1b;font-weight:700;">مغلقة</span>'
            )

        return format_html(
            '<span style="color:#7c2d12;font-weight:700;">مقفلة</span>'
        )

    status_badge.short_description = "الحالة"
    status_badge.admin_order_field = "status"


# ============================================================
# 🧾 TaxRate Admin
# ============================================================

@admin.register(TaxRate)
class TaxRateAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "code",
        "name",
        "tax_type",
        "rate",
        "sales_account",
        "purchase_account",
        "is_active",
        "is_default",
        "created_at",
    )

    list_filter = (
        "tax_type",
        "is_active",
        "is_default",
        "created_at",
    )

    search_fields = (
        "code",
        "name",
        "description",
        "sales_account__code",
        "sales_account__name",
        "purchase_account__code",
        "purchase_account__name",
    )

    autocomplete_fields = (
        "sales_account",
        "purchase_account",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )

    fieldsets = (
        (
            "بيانات الضريبة",
            {
                "fields": (
                    "code",
                    "name",
                    "tax_type",
                    "rate",
                    "is_active",
                    "is_default",
                    "description",
                )
            },
        ),
        (
            "الربط المحاسبي",
            {
                "fields": (
                    "sales_account",
                    "purchase_account",
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
                ),
            },
        ),
    )

    ordering = ("code",)
    list_per_page = 50
    save_on_top = True


# ============================================================
# ⚙️ AccountingSettings Admin
# ============================================================

@admin.register(AccountingSettings)
class AccountingSettingsAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "default_currency",
        "default_tax_rate",
        "auto_post_invoices",
        "auto_post_payments",
        "auto_post_treasury",
        "require_period_for_posting",
        "allow_posting_without_cost_center",
        "updated_at",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )

    autocomplete_fields = (
        "default_tax_rate",
    )

    fieldsets = (
        (
            "الإعدادات العامة",
            {
                "fields": (
                    "default_currency",
                    "default_tax_rate",
                )
            },
        ),
        (
            "الترحيل الآلي",
            {
                "fields": (
                    "auto_post_invoices",
                    "auto_post_payments",
                    "auto_post_treasury",
                )
            },
        ),
        (
            "سياسات الترحيل",
            {
                "fields": (
                    "require_period_for_posting",
                    "allow_posting_without_cost_center",
                )
            },
        ),
        (
            "بيانات إضافية",
            {
                "classes": ("collapse",),
                "fields": (
                    "metadata",
                ),
            },
        ),
        (
            "التتبع",
            {
                "classes": ("collapse",),
                "fields": (
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )

    def has_add_permission(self, request):
        if AccountingSettings.objects.exists():
            return False
        return super().has_add_permission(request)

    def has_delete_permission(self, request, obj=None):
        return False


# ============================================================
# 🧭 AccountingRoutingRule Admin
# ============================================================

@admin.register(AccountingRoutingRule)
class AccountingRoutingRuleAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "source_badge",
        "purpose",
        "account",
        "tax_rate",
        "cost_center",
        "is_active",
        "priority",
        "created_at",
    )

    list_filter = (
        "source",
        "purpose",
        "is_active",
        "priority",
        "created_at",
    )

    search_fields = (
        "source",
        "purpose",
        "description",
        "account__code",
        "account__name",
        "tax_rate__code",
        "tax_rate__name",
        "cost_center__code",
        "cost_center__name",
    )

    autocomplete_fields = (
        "account",
        "tax_rate",
        "cost_center",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )

    fieldsets = (
        (
            "قاعدة التوجيه",
            {
                "fields": (
                    "source",
                    "purpose",
                    "account",
                    "tax_rate",
                    "cost_center",
                    "is_active",
                    "priority",
                    "description",
                )
            },
        ),
        (
            "بيانات إضافية",
            {
                "classes": ("collapse",),
                "fields": (
                    "metadata",
                ),
            },
        ),
        (
            "التتبع",
            {
                "classes": ("collapse",),
                "fields": (
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )

    ordering = ("source", "purpose", "priority")
    list_per_page = 50
    save_on_top = True

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("account", "tax_rate", "cost_center")
        )

    def source_badge(self, obj):
        colors = {
            AccountingRoutingSource.SALES_INVOICE: "#2563eb",
            AccountingRoutingSource.PAYMENT_RECEIPT: "#15803d",
            AccountingRoutingSource.TREASURY_INCOME: "#0f766e",
            AccountingRoutingSource.TREASURY_EXPENSE: "#b45309",
            AccountingRoutingSource.TREASURY_TRANSFER: "#0369a1",
            AccountingRoutingSource.AGENT_COMMISSION: "#7c2d12",
            AccountingRoutingSource.TAX_SETTLEMENT: "#9333ea",
            AccountingRoutingSource.OPENING_BALANCE: "#4b5563",
        }

        color = colors.get(obj.source, "#374151")
        return format_html(
            '<span style="color:{};font-weight:700;">{}</span>',
            color,
            obj.get_source_display(),
        )

    source_badge.short_description = "مصدر العملية"
    source_badge.admin_order_field = "source"


# ============================================================
# 🧾 JournalEntry Admin
# ============================================================

@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "entry_number",
        "entry_date",
        "period",
        "posting_source_badge",
        "status_badge",
        "reference",
        "source_display",
        "external_reference",
        "total_debit",
        "total_credit",
        "balance_status",
        "currency",
        "is_auto_posted",
        "posted_at",
        "created_at",
    )

    list_filter = (
        "status",
        "posting_source",
        "period",
        "entry_date",
        "currency",
        "is_auto_posted",
        IsBalancedFilter,
        "created_at",
    )

    search_fields = (
        "entry_number",
        "reference",
        "external_reference",
        "source_type",
        "source_id",
        "source_number",
        "description",
        "notes",
        "lines__account__code",
        "lines__account__name",
    )

    readonly_fields = (
        "total_debit",
        "total_credit",
        "balance_status",
        "posted_at",
        "cancelled_at",
        "reversed_at",
        "created_at",
        "updated_at",
    )

    autocomplete_fields = (
        "period",
        "reversal_of",
        "reversed_entry",
        "created_by",
        "posted_by",
        "cancelled_by",
    )

    fieldsets = (
        (
            "بيانات القيد",
            {
                "fields": (
                    "entry_number",
                    "entry_date",
                    "period",
                    "status",
                    "posting_source",
                    "currency",
                    "is_auto_posted",
                )
            },
        ),
        (
            "المراجع التشغيلية",
            {
                "fields": (
                    "reference",
                    "external_reference",
                    "source_type",
                    "source_id",
                    "source_number",
                )
            },
        ),
        (
            "الإجماليات",
            {
                "fields": (
                    "total_debit",
                    "total_credit",
                    "balance_status",
                )
            },
        ),
        (
            "عكس القيود",
            {
                "classes": ("collapse",),
                "fields": (
                    "reversal_of",
                    "reversed_entry",
                    "reversed_at",
                ),
            },
        ),
        (
            "الوصف والملاحظات",
            {
                "fields": (
                    "description",
                    "notes",
                )
            },
        ),
        (
            "المستخدمون",
            {
                "classes": ("collapse",),
                "fields": (
                    "created_by",
                    "posted_by",
                    "cancelled_by",
                ),
            },
        ),
        (
            "بيانات إضافية",
            {
                "classes": ("collapse",),
                "fields": (
                    "metadata",
                ),
            },
        ),
        (
            "التتبع",
            {
                "classes": ("collapse",),
                "fields": (
                    "posted_at",
                    "cancelled_at",
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )

    ordering = (
        "-entry_date",
        "-id",
    )

    inlines = [
        JournalEntryLineInline,
    ]

    actions = (
        "mark_selected_as_posted",
        "refresh_selected_totals",
    )

    list_per_page = 50
    date_hierarchy = "entry_date"
    save_on_top = True

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related(
                "period",
                "period__fiscal_year",
                "reversal_of",
                "reversed_entry",
                "created_by",
                "posted_by",
                "cancelled_by",
            )
            .prefetch_related("lines", "lines__account")
        )

    def posting_source_badge(self, obj):
        colors = {
            PostingSource.MANUAL: "#374151",
            PostingSource.OPENING_BALANCE: "#0f766e",
            PostingSource.ORDER: "#7c3aed",
            PostingSource.INVOICE: "#2563eb",
            PostingSource.PAYMENT: "#15803d",
            PostingSource.REFUND: "#dc2626",
            PostingSource.AGENT_COMMISSION: "#b45309",
            PostingSource.TREASURY: "#0369a1",
            getattr(PostingSource, "TREASURY_TRANSFER", "TREASURY_TRANSFER"): "#0891b2",
            getattr(PostingSource, "EXPENSE", "EXPENSE"): "#b45309",
            getattr(PostingSource, "INCOME", "INCOME"): "#15803d",
            getattr(PostingSource, "TAX", "TAX"): "#9333ea",
            PostingSource.ADJUSTMENT: "#9333ea",
            getattr(PostingSource, "SYSTEM", "SYSTEM"): "#4b5563",
            PostingSource.OTHER: "#4b5563",
        }

        color = colors.get(obj.posting_source, "#374151")
        return format_html(
            '<span style="color:{};font-weight:700;">{}</span>',
            color,
            obj.get_posting_source_display(),
        )

    posting_source_badge.short_description = "مصدر القيد"
    posting_source_badge.admin_order_field = "posting_source"

    def status_badge(self, obj):
        if obj.status == JournalEntryStatus.POSTED:
            return format_html(
                '<span style="color:#166534;font-weight:700;">مرحل</span>'
            )

        if obj.status == JournalEntryStatus.CANCELLED:
            return format_html(
                '<span style="color:#991b1b;font-weight:700;">ملغي</span>'
            )

        if obj.status == JournalEntryStatus.REVERSED:
            return format_html(
                '<span style="color:#7c2d12;font-weight:700;">معكوس</span>'
            )

        return format_html(
            '<span style="color:#92400e;font-weight:700;">مسودة</span>'
        )

    status_badge.short_description = "الحالة"
    status_badge.admin_order_field = "status"

    def source_display(self, obj):
        if obj.source_type or obj.source_id:
            return f"{obj.source_type or '-'}:{obj.source_id or '-'}"
        return "-"

    source_display.short_description = "المصدر"

    def balance_status(self, obj):
        if not obj or not obj.pk:
            return "-"

        if obj.total_debit == obj.total_credit and obj.total_debit > 0:
            return format_html(
                '<span style="color:#166534;font-weight:700;">متوازن</span>'
            )

        if obj.total_debit == obj.total_credit and obj.total_debit == 0:
            return format_html(
                '<span style="color:#92400e;font-weight:700;">صفري</span>'
            )

        return format_html(
            '<span style="color:#991b1b;font-weight:700;">غير متوازن</span>'
        )

    balance_status.short_description = "حالة التوازن"

    def save_model(self, request, obj, form, change):
        if obj.status == JournalEntryStatus.POSTED and not obj.pk:
            raise ValidationError(
                "أنشئ القيد كمسودة أولًا ثم أضف الأسطر وبعدها قم بالترحيل."
            )

        if not obj.pk and request.user and request.user.is_authenticated:
            obj.created_by = request.user

        super().save_model(request, obj, form, change)

    @admin.action(description="تحديث إجماليات القيود المحددة")
    def refresh_selected_totals(self, request, queryset):
        updated = 0

        for entry in queryset:
            entry.refresh_totals(save=True)
            updated += 1

        self.message_user(request, f"تم تحديث إجماليات {updated} قيد.")

    @admin.action(description="ترحيل القيود المحددة")
    def mark_selected_as_posted(self, request, queryset):
        posted_count = 0
        errors = []

        for entry in queryset:
            try:
                entry.mark_as_posted(actor=request.user)
                posted_count += 1
            except Exception as exc:
                errors.append(f"{entry.entry_number}: {exc}")

        if posted_count:
            self.message_user(request, f"تم ترحيل {posted_count} قيد.")

        for error in errors[:5]:
            self.message_user(request, error, level=messages.ERROR)

        if len(errors) > 5:
            self.message_user(
                request,
                f"يوجد {len(errors) - 5} أخطاء إضافية لم يتم عرضها.",
                level=messages.WARNING,
            )


# ============================================================
# 🧾 JournalEntryLine Admin
# ============================================================

@admin.register(JournalEntryLine)
class JournalEntryLineAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "journal_entry_link",
        "entry_date",
        "entry_status",
        "posting_source",
        "account_code",
        "account_name",
        "cost_center",
        "line_type_display",
        "debit_amount",
        "credit_amount",
        "tax_rate",
        "tax_amount",
        "party_type",
        "party_id",
        "sort_order",
        "created_at",
    )

    list_filter = (
        "journal_entry__status",
        "journal_entry__posting_source",
        "journal_entry__entry_date",
        "account__account_type",
        "account__nature",
        "cost_center",
        "tax_rate",
        "party_type",
        "created_at",
    )

    search_fields = (
        "journal_entry__entry_number",
        "journal_entry__reference",
        "journal_entry__external_reference",
        "journal_entry__source_type",
        "journal_entry__source_id",
        "account__code",
        "account__name",
        "cost_center__code",
        "cost_center__name",
        "description",
        "party_type",
        "party_id",
        "source_line_id",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )

    autocomplete_fields = (
        "journal_entry",
        "account",
        "cost_center",
        "tax_rate",
    )

    ordering = (
        "-journal_entry__entry_date",
        "journal_entry",
        "sort_order",
        "id",
    )

    list_per_page = 100
    date_hierarchy = "journal_entry__entry_date"

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related(
                "journal_entry",
                "account",
                "cost_center",
                "tax_rate",
            )
        )

    def journal_entry_link(self, obj):
        return obj.journal_entry.entry_number

    journal_entry_link.short_description = "رقم القيد"
    journal_entry_link.admin_order_field = "journal_entry__entry_number"

    def entry_date(self, obj):
        return obj.journal_entry.entry_date

    entry_date.short_description = "تاريخ القيد"
    entry_date.admin_order_field = "journal_entry__entry_date"

    def entry_status(self, obj):
        status = obj.journal_entry.status

        if status == JournalEntryStatus.POSTED:
            return format_html(
                '<span style="color:#166534;font-weight:700;">مرحل</span>'
            )

        if status == JournalEntryStatus.CANCELLED:
            return format_html(
                '<span style="color:#991b1b;font-weight:700;">ملغي</span>'
            )

        if status == JournalEntryStatus.REVERSED:
            return format_html(
                '<span style="color:#7c2d12;font-weight:700;">معكوس</span>'
            )

        return format_html(
            '<span style="color:#92400e;font-weight:700;">مسودة</span>'
        )

    entry_status.short_description = "حالة القيد"
    entry_status.admin_order_field = "journal_entry__status"

    def posting_source(self, obj):
        return obj.journal_entry.get_posting_source_display()

    posting_source.short_description = "مصدر القيد"
    posting_source.admin_order_field = "journal_entry__posting_source"

    def account_code(self, obj):
        return obj.account.code

    account_code.short_description = "كود الحساب"
    account_code.admin_order_field = "account__code"

    def account_name(self, obj):
        return obj.account.name

    account_name.short_description = "اسم الحساب"
    account_name.admin_order_field = "account__name"

    def line_type_display(self, obj):
        if obj.debit_amount and obj.debit_amount > 0:
            return format_html(
                '<span style="color:#166534;font-weight:700;">مدين</span>'
            )

        if obj.credit_amount and obj.credit_amount > 0:
            return format_html(
                '<span style="color:#1d4ed8;font-weight:700;">دائن</span>'
            )

        return format_html(
            '<span style="color:#991b1b;font-weight:700;">صفري</span>'
        )

    line_type_display.short_description = "نوع السطر"


# ============================================================
# 🧾 TaxTransaction Admin
# ============================================================

@admin.register(TaxTransaction)
class TaxTransactionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "tax_rate",
        "direction",
        "transaction_date",
        "taxable_amount",
        "tax_amount",
        "currency",
        "source_type",
        "source_id",
        "source_number",
        "journal_entry",
        "created_at",
    )

    list_filter = (
        "direction",
        "tax_rate",
        "transaction_date",
        "currency",
        "source_type",
        "created_at",
    )

    search_fields = (
        "source_type",
        "source_id",
        "source_number",
        "description",
        "tax_rate__code",
        "tax_rate__name",
        "journal_entry__entry_number",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )

    autocomplete_fields = (
        "tax_rate",
        "journal_entry",
        "journal_line",
    )

    fieldsets = (
        (
            "بيانات الحركة الضريبية",
            {
                "fields": (
                    "tax_rate",
                    "direction",
                    "transaction_date",
                    "taxable_amount",
                    "tax_amount",
                    "currency",
                    "description",
                )
            },
        ),
        (
            "المصدر والربط",
            {
                "fields": (
                    "source_type",
                    "source_id",
                    "source_number",
                    "journal_entry",
                    "journal_line",
                )
            },
        ),
        (
            "بيانات إضافية",
            {
                "classes": ("collapse",),
                "fields": (
                    "metadata",
                ),
            },
        ),
        (
            "التتبع",
            {
                "classes": ("collapse",),
                "fields": (
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )

    ordering = ("-transaction_date", "-id")
    date_hierarchy = "transaction_date"
    list_per_page = 100

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related(
                "tax_rate",
                "journal_entry",
                "journal_line",
            )
        )