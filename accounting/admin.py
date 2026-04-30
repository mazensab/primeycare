# ============================================================
# 📂 accounting/admin.py
# 🧠 Primey Care | Accounting Admin
# ------------------------------------------------------------
# ✅ إدارة دليل الحسابات
# ✅ إدارة القيود اليومية
# ✅ إدارة أسطر القيود
# ✅ مناسب للمرحلة 12: Accounting Integration
# ------------------------------------------------------------
# ملاحظات:
# - يمنع تعديل أسطر القيود الملغية من خلال validation في models.py.
# - إجماليات القيد تتحدث تلقائيًا من JournalEntryLine.save/delete.
# - لوحة الإدارة هنا مخصصة للمراجعة والإدارة الداخلية.
# ============================================================

from django.contrib import admin
from django.core.exceptions import ValidationError
from django.utils.html import format_html

from .models import (
    Account,
    AccountNature,
    AccountType,
    JournalEntry,
    JournalEntryLine,
    JournalEntryStatus,
    PostingSource,
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
            return queryset.filter(total_debit=models_f("total_credit"))
        if self.value() == "no":
            return queryset.exclude(total_debit=models_f("total_credit"))
        return queryset


def models_f(field_name):
    """
    Helper صغير لتجنب استيراد F داخل أكثر من موضع.
    """
    from django.db.models import F

    return F(field_name)


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
        "description",
        "debit_amount",
        "credit_amount",
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
        if obj and obj.status == JournalEntryStatus.CANCELLED:
            return False
        return super().has_add_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        if obj and obj.status == JournalEntryStatus.CANCELLED:
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
        "account_type_badge",
        "nature_badge",
        "parent",
        "level",
        "is_group",
        "is_active",
        "can_post_display",
        "children_count",
        "created_at",
    )

    list_filter = (
        "account_type",
        "nature",
        "is_group",
        "is_active",
        "level",
        HasParentFilter,
        AccountPostingAvailabilityFilter,
        "created_at",
    )

    search_fields = (
        "code",
        "name",
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
                    "account_type",
                    "nature",
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
                    "is_active",
                    "can_post_display",
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

    autocomplete_fields = (
        "parent",
    )

    ordering = (
        "code",
    )

    actions = (
        "activate_accounts",
        "deactivate_accounts",
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
                "لم يتم تعطيل الحسابات المرتبطة بقيود: "
                + ", ".join(protected_codes),
                level="warning",
            )


# ============================================================
# 🧾 JournalEntry Admin
# ============================================================

@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "entry_number",
        "entry_date",
        "posting_source_badge",
        "status_badge",
        "reference",
        "external_reference",
        "total_debit",
        "total_credit",
        "balance_status",
        "currency",
        "posted_at",
        "created_at",
    )

    list_filter = (
        "status",
        "posting_source",
        "entry_date",
        "currency",
        "created_at",
    )

    search_fields = (
        "entry_number",
        "reference",
        "external_reference",
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
        "created_at",
        "updated_at",
    )

    fieldsets = (
        (
            "بيانات القيد",
            {
                "fields": (
                    "entry_number",
                    "entry_date",
                    "status",
                    "posting_source",
                    "currency",
                )
            },
        ),
        (
            "المراجع",
            {
                "fields": (
                    "reference",
                    "external_reference",
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
            "الوصف والملاحظات",
            {
                "fields": (
                    "description",
                    "notes",
                )
            },
        ),
        (
            "التتبع",
            {
                "classes": ("collapse",),
                "fields": (
                    "posted_at",
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
        "mark_selected_as_cancelled",
        "refresh_selected_totals",
    )

    list_per_page = 50
    date_hierarchy = "entry_date"
    save_on_top = True

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .prefetch_related("lines", "lines__account")
        )

    def posting_source_badge(self, obj):
        colors = {
            PostingSource.MANUAL: "#374151",
            getattr(PostingSource, "OPENING_BALANCE", "OPENING_BALANCE"): "#0f766e",
            PostingSource.ORDER: "#7c3aed",
            PostingSource.INVOICE: "#2563eb",
            PostingSource.PAYMENT: "#15803d",
            PostingSource.REFUND: "#dc2626",
            getattr(PostingSource, "AGENT_COMMISSION", "AGENT_COMMISSION"): "#b45309",
            getattr(PostingSource, "TREASURY", "TREASURY"): "#0369a1",
            PostingSource.ADJUSTMENT: "#9333ea",
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

        return format_html(
            '<span style="color:#92400e;font-weight:700;">مسودة</span>'
        )

    status_badge.short_description = "الحالة"
    status_badge.admin_order_field = "status"

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

        super().save_model(request, obj, form, change)

    @admin.action(description="تحديث إجماليات القيود المحددة")
    def refresh_selected_totals(self, request, queryset):
        updated = 0

        for entry in queryset:
            entry.refresh_totals(save=True) if hasattr(entry, "refresh_totals") else entry.save()
            updated += 1

        self.message_user(request, f"تم تحديث إجماليات {updated} قيد.")

    @admin.action(description="ترحيل القيود المحددة")
    def mark_selected_as_posted(self, request, queryset):
        posted_count = 0
        errors = []

        for entry in queryset:
            try:
                if hasattr(entry, "mark_as_posted"):
                    entry.mark_as_posted()
                else:
                    entry._sync_totals_from_lines()

                    if entry.total_debit != entry.total_credit:
                        raise ValidationError("القيد غير متوازن.")

                    if entry.total_debit <= 0:
                        raise ValidationError("القيد صفري.")

                    entry.status = JournalEntryStatus.POSTED
                    entry.save(
                        update_fields=[
                            "status",
                            "total_debit",
                            "total_credit",
                            "updated_at",
                        ]
                    )

                posted_count += 1

            except Exception as exc:
                errors.append(f"{entry.entry_number}: {exc}")

        if posted_count:
            self.message_user(request, f"تم ترحيل {posted_count} قيد.")

        for error in errors[:5]:
            self.message_user(request, error, level="error")

        if len(errors) > 5:
            self.message_user(
                request,
                f"يوجد {len(errors) - 5} أخطاء إضافية لم يتم عرضها.",
                level="warning",
            )

    @admin.action(description="إلغاء القيود المحددة")
    def mark_selected_as_cancelled(self, request, queryset):
        cancelled_count = 0

        for entry in queryset:
            if hasattr(entry, "mark_as_cancelled"):
                entry.mark_as_cancelled(reason="تم الإلغاء من لوحة الإدارة.")
            else:
                entry.status = JournalEntryStatus.CANCELLED
                entry.notes = f"{entry.notes}\nتم الإلغاء من لوحة الإدارة.".strip()
                entry.save(
                    update_fields=[
                        "status",
                        "notes",
                        "updated_at",
                    ]
                )

            cancelled_count += 1

        self.message_user(request, f"تم إلغاء {cancelled_count} قيد.")


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
        "line_type_display",
        "debit_amount",
        "credit_amount",
        "sort_order",
        "created_at",
    )

    list_filter = (
        "journal_entry__status",
        "journal_entry__posting_source",
        "journal_entry__entry_date",
        "account__account_type",
        "account__nature",
        "created_at",
    )

    search_fields = (
        "journal_entry__entry_number",
        "journal_entry__reference",
        "journal_entry__external_reference",
        "account__code",
        "account__name",
        "description",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )

    autocomplete_fields = (
        "journal_entry",
        "account",
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
            .select_related("journal_entry", "account")
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