# ============================================================
# 📂 treasury/admin.py
# 🧠 Primey Care | Treasury Admin
# ------------------------------------------------------------
# ✅ إدارة الصناديق والحسابات البنكية وبوابات الدفع
# ✅ إدارة الحركات المالية
# ✅ دعم الحساب المحاسبي المقابل counterparty_ledger_account
# ✅ عرض المصدر والطرف والربط المحاسبي
# ✅ عرض الرصيد قبل/بعد وأثر الرصيد
# ✅ عرض حالة الترحيل المحاسبي
# ✅ إجراءات تأكيد وإلغاء حركات الخزينة من لوحة الإدارة
# ============================================================

from __future__ import annotations

from django.contrib import admin, messages
from django.core.exceptions import ValidationError
from django.utils.html import format_html

from .models import (
    TreasuryAccount,
    TreasuryAccountStatus,
    TreasuryAccountType,
    TreasuryTransaction,
    TreasuryTransactionSource,
    TreasuryTransactionStatus,
    TreasuryTransactionType,
)
from .services import (
    cancel_treasury_transaction,
    confirm_treasury_transaction,
)


# ============================================================
# 🧩 Filters
# ============================================================

class TreasuryBalanceEffectFilter(admin.SimpleListFilter):
    title = "أثر الرصيد"
    parameter_name = "balance_effect"

    def lookups(self, request, model_admin):
        return (
            ("applied", "تم تطبيق الرصيد"),
            ("not_applied", "لم يطبق الرصيد"),
            ("reversed", "تم عكس الرصيد"),
            ("not_reversed", "لم يعكس الرصيد"),
        )

    def queryset(self, request, queryset):
        if self.value() == "applied":
            return queryset.filter(balance_applied=True)

        if self.value() == "not_applied":
            return queryset.filter(balance_applied=False)

        if self.value() == "reversed":
            return queryset.filter(balance_reversed=True)

        if self.value() == "not_reversed":
            return queryset.filter(balance_reversed=False)

        return queryset


class TreasuryHasJournalEntryFilter(admin.SimpleListFilter):
    title = "له قيد محاسبي"
    parameter_name = "has_journal_entry"

    def lookups(self, request, model_admin):
        return (
            ("yes", "نعم"),
            ("no", "لا"),
        )

    def queryset(self, request, queryset):
        if self.value() == "yes":
            return queryset.filter(journal_entry__isnull=False)

        if self.value() == "no":
            return queryset.filter(journal_entry__isnull=True)

        return queryset


class TreasuryHasCounterpartyAccountFilter(admin.SimpleListFilter):
    title = "له حساب مقابل"
    parameter_name = "has_counterparty_account"

    def lookups(self, request, model_admin):
        return (
            ("yes", "نعم"),
            ("no", "لا"),
        )

    def queryset(self, request, queryset):
        if self.value() == "yes":
            return queryset.filter(counterparty_ledger_account__isnull=False)

        if self.value() == "no":
            return queryset.filter(counterparty_ledger_account__isnull=True)

        return queryset


class TreasuryAccountLedgerLinkFilter(admin.SimpleListFilter):
    title = "مرتبط بحساب محاسبي"
    parameter_name = "has_ledger_account"

    def lookups(self, request, model_admin):
        return (
            ("yes", "مرتبط"),
            ("no", "غير مرتبط"),
        )

    def queryset(self, request, queryset):
        if self.value() == "yes":
            return queryset.filter(ledger_account__isnull=False)

        if self.value() == "no":
            return queryset.filter(ledger_account__isnull=True)

        return queryset


# ============================================================
# 💼 TreasuryAccount Admin
# ============================================================

@admin.register(TreasuryAccount)
class TreasuryAccountAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "code",
        "name",
        "account_type_badge",
        "status_badge",
        "currency",
        "opening_balance",
        "current_balance",
        "ledger_account",
        "bank_name",
        "provider_name",
        "is_default",
        "allow_negative_balance",
        "created_at",
    )

    list_filter = (
        "account_type",
        "status",
        "currency",
        "is_default",
        "allow_negative_balance",
        TreasuryAccountLedgerLinkFilter,
        "created_at",
    )

    search_fields = (
        "name",
        "code",
        "bank_name",
        "account_holder_name",
        "account_number",
        "iban",
        "branch_name",
        "provider_name",
        "merchant_id",
        "description",
        "ledger_account__code",
        "ledger_account__name",
    )

    readonly_fields = (
        "current_balance",
        "created_at",
        "updated_at",
    )

    autocomplete_fields = (
        "ledger_account",
    )

    fieldsets = (
        (
            "بيانات الحساب",
            {
                "fields": (
                    "name",
                    "code",
                    "account_type",
                    "status",
                    "currency",
                    "ledger_account",
                    "description",
                )
            },
        ),
        (
            "الرصيد",
            {
                "fields": (
                    "opening_balance",
                    "current_balance",
                    "allow_negative_balance",
                    "is_default",
                )
            },
        ),
        (
            "بيانات البنك",
            {
                "classes": ("collapse",),
                "fields": (
                    "bank_name",
                    "account_holder_name",
                    "account_number",
                    "iban",
                    "branch_name",
                ),
            },
        ),
        (
            "بيانات بوابة الدفع / المحفظة",
            {
                "classes": ("collapse",),
                "fields": (
                    "provider_name",
                    "merchant_id",
                    "settlement_days",
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
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )

    ordering = (
        "account_type",
        "code",
    )

    actions = (
        "activate_accounts",
        "deactivate_accounts",
        "suspend_accounts",
    )

    list_per_page = 50
    save_on_top = True

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("ledger_account")
        )

    @admin.display(description="نوع الحساب", ordering="account_type")
    def account_type_badge(self, obj):
        colors = {
            TreasuryAccountType.CASHBOX: "#15803d",
            TreasuryAccountType.BANK: "#2563eb",
            TreasuryAccountType.GATEWAY: "#7c3aed",
            TreasuryAccountType.WALLET: "#0f766e",
        }

        color = colors.get(obj.account_type, "#374151")

        return format_html(
            '<span style="color:{};font-weight:700;">{}</span>',
            color,
            obj.get_account_type_display(),
        )

    @admin.display(description="الحالة", ordering="status")
    def status_badge(self, obj):
        if obj.status == TreasuryAccountStatus.ACTIVE:
            return format_html(
                '<span style="color:#166534;font-weight:700;">نشط</span>'
            )

        if obj.status == TreasuryAccountStatus.SUSPENDED:
            return format_html(
                '<span style="color:#92400e;font-weight:700;">موقوف</span>'
            )

        if obj.status == TreasuryAccountStatus.CLOSED:
            return format_html(
                '<span style="color:#4b5563;font-weight:700;">مغلق</span>'
            )

        return format_html(
            '<span style="color:#991b1b;font-weight:700;">غير نشط</span>'
        )

    @admin.action(description="تفعيل الحسابات المحددة")
    def activate_accounts(self, request, queryset):
        updated = queryset.update(status=TreasuryAccountStatus.ACTIVE)
        self.message_user(
            request,
            f"تم تفعيل {updated} حساب خزينة.",
            level=messages.SUCCESS,
        )

    @admin.action(description="تعطيل الحسابات المحددة")
    def deactivate_accounts(self, request, queryset):
        blocked_codes = []
        updated_count = 0

        for account in queryset:
            if account.current_balance != 0:
                blocked_codes.append(account.code)
                continue

            account.status = TreasuryAccountStatus.INACTIVE
            account.save(update_fields=["status", "updated_at"])
            updated_count += 1

        if updated_count:
            self.message_user(
                request,
                f"تم تعطيل {updated_count} حساب خزينة.",
                level=messages.SUCCESS,
            )

        if blocked_codes:
            self.message_user(
                request,
                "لم يتم تعطيل الحسابات التي لديها رصيد حالي: "
                + ", ".join(blocked_codes),
                level=messages.WARNING,
            )

    @admin.action(description="إيقاف الحسابات المحددة")
    def suspend_accounts(self, request, queryset):
        updated = queryset.update(status=TreasuryAccountStatus.SUSPENDED)
        self.message_user(
            request,
            f"تم إيقاف {updated} حساب خزينة.",
            level=messages.WARNING,
        )


# ============================================================
# 🧾 TreasuryTransaction Admin
# ============================================================

@admin.register(TreasuryTransaction)
class TreasuryTransactionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "transaction_number",
        "transaction_date",
        "transaction_type_badge",
        "source_badge",
        "status_badge",
        "treasury_account",
        "destination_account",
        "counterparty_ledger_account",
        "amount",
        "fees_amount",
        "net_amount",
        "currency",
        "party_display",
        "source_display",
        "accounting_status_badge",
        "journal_entry_link",
        "balance_effect_badge",
        "created_at",
    )

    list_filter = (
        "transaction_type",
        "source",
        "status",
        "transaction_date",
        "currency",
        "treasury_account",
        "destination_account",
        "counterparty_ledger_account",
        TreasuryHasCounterpartyAccountFilter,
        TreasuryBalanceEffectFilter,
        TreasuryHasJournalEntryFilter,
        "party_type",
        "created_at",
    )

    search_fields = (
        "transaction_number",
        "reference",
        "external_reference",
        "source_type",
        "source_id",
        "source_number",
        "party_type",
        "party_id",
        "party_name",
        "description",
        "notes",
        "journal_entry_reference",
        "journal_entry__entry_number",
        "treasury_account__name",
        "treasury_account__code",
        "destination_account__name",
        "destination_account__code",
        "counterparty_ledger_account__code",
        "counterparty_ledger_account__name",
    )

    readonly_fields = (
        "balance_applied",
        "balance_reversed",
        "balance_before",
        "balance_after",
        "confirmed_at",
        "cancelled_at",
        "created_at",
        "updated_at",
    )

    autocomplete_fields = (
        "treasury_account",
        "destination_account",
        "counterparty_ledger_account",
        "journal_entry",
        "created_by",
        "confirmed_by",
        "cancelled_by",
    )

    fieldsets = (
        (
            "بيانات الحركة",
            {
                "fields": (
                    "transaction_number",
                    "transaction_type",
                    "source",
                    "status",
                    "transaction_date",
                    "currency",
                )
            },
        ),
        (
            "الحسابات",
            {
                "fields": (
                    "treasury_account",
                    "destination_account",
                    "counterparty_ledger_account",
                )
            },
        ),
        (
            "المبالغ",
            {
                "fields": (
                    "amount",
                    "fees_amount",
                    "net_amount",
                )
            },
        ),
        (
            "المصدر والمرجع",
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
            "الطرف المرتبط",
            {
                "classes": ("collapse",),
                "fields": (
                    "party_type",
                    "party_id",
                    "party_name",
                ),
            },
        ),
        (
            "الربط المحاسبي",
            {
                "fields": (
                    "journal_entry",
                    "journal_entry_reference",
                )
            },
        ),
        (
            "أثر الرصيد",
            {
                "fields": (
                    "balance_applied",
                    "balance_reversed",
                    "balance_before",
                    "balance_after",
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
            "المستخدمون",
            {
                "classes": ("collapse",),
                "fields": (
                    "created_by",
                    "confirmed_by",
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
                    "confirmed_at",
                    "cancelled_at",
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )

    ordering = (
        "-transaction_date",
        "-id",
    )

    list_per_page = 50
    date_hierarchy = "transaction_date"
    save_on_top = True

    actions = (
        "confirm_selected_transactions",
        "cancel_selected_transactions",
    )

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related(
                "treasury_account",
                "destination_account",
                "counterparty_ledger_account",
                "journal_entry",
                "created_by",
                "confirmed_by",
                "cancelled_by",
            )
        )

    @admin.display(description="نوع الحركة", ordering="transaction_type")
    def transaction_type_badge(self, obj):
        colors = {
            TreasuryTransactionType.INCOME: "#15803d",
            TreasuryTransactionType.EXPENSE: "#b45309",
            TreasuryTransactionType.TRANSFER: "#2563eb",
            TreasuryTransactionType.OPENING_BALANCE: "#0f766e",
            TreasuryTransactionType.ADJUSTMENT: "#9333ea",
            TreasuryTransactionType.DEPOSIT: "#166534",
            TreasuryTransactionType.WITHDRAW: "#991b1b",
            TreasuryTransactionType.REFUND: "#dc2626",
            TreasuryTransactionType.FEE: "#7c2d12",
        }

        color = colors.get(obj.transaction_type, "#374151")

        return format_html(
            '<span style="color:{};font-weight:700;">{}</span>',
            color,
            obj.get_transaction_type_display(),
        )

    @admin.display(description="المصدر", ordering="source")
    def source_badge(self, obj):
        colors = {
            TreasuryTransactionSource.MANUAL: "#374151",
            TreasuryTransactionSource.MANUAL_RECEIPT: "#15803d",
            TreasuryTransactionSource.MANUAL_PAYMENT: "#b45309",
            TreasuryTransactionSource.PAYMENT: "#15803d",
            TreasuryTransactionSource.INVOICE: "#2563eb",
            TreasuryTransactionSource.ORDER: "#7c3aed",
            TreasuryTransactionSource.REFUND: "#dc2626",
            TreasuryTransactionSource.TRANSFER: "#0369a1",
            TreasuryTransactionSource.GATEWAY: "#9333ea",
            TreasuryTransactionSource.AGENT_COMMISSION: "#b45309",
            TreasuryTransactionSource.AGENT_COD_COLLECTION: "#0f766e",
            TreasuryTransactionSource.AGENT_CASH_SETTLEMENT: "#166534",
            TreasuryTransactionSource.AGENT_EARNING_SETTLEMENT: "#7c2d12",
            TreasuryTransactionSource.BROKER_COMMISSION: "#6d28d9",
            TreasuryTransactionSource.BROKER_CASH_SETTLEMENT: "#047857",
            TreasuryTransactionSource.BROKER_EARNING_SETTLEMENT: "#92400e",
            TreasuryTransactionSource.ACCOUNTING: "#0f766e",
            TreasuryTransactionSource.OPENING_BALANCE: "#4b5563",
            TreasuryTransactionSource.ADJUSTMENT: "#7c2d12",
            TreasuryTransactionSource.OTHER: "#4b5563",
        }

        color = colors.get(obj.source, "#374151")

        return format_html(
            '<span style="color:{};font-weight:700;">{}</span>',
            color,
            obj.get_source_display(),
        )

    @admin.display(description="الحالة", ordering="status")
    def status_badge(self, obj):
        if obj.status == TreasuryTransactionStatus.CONFIRMED:
            return format_html(
                '<span style="color:#166534;font-weight:700;">مؤكدة</span>'
            )

        if obj.status == TreasuryTransactionStatus.CANCELLED:
            return format_html(
                '<span style="color:#991b1b;font-weight:700;">ملغاة</span>'
            )

        return format_html(
            '<span style="color:#92400e;font-weight:700;">مسودة</span>'
        )

    @admin.display(description="الطرف")
    def party_display(self, obj):
        if obj.party_type or obj.party_id or obj.party_name:
            name = obj.party_name or "-"
            party_type = obj.party_type or "-"
            party_id = obj.party_id or "-"
            return f"{party_type}:{party_id} - {name}"

        return "-"

    @admin.display(description="مصدر الربط")
    def source_display(self, obj):
        if obj.source_type or obj.source_id or obj.source_number:
            return f"{obj.source_type or '-'}:{obj.source_id or '-'} / {obj.source_number or '-'}"

        return "-"

    @admin.display(description="القيد المحاسبي", ordering="journal_entry_reference")
    def journal_entry_link(self, obj):
        if obj.journal_entry:
            return obj.journal_entry.entry_number

        if obj.journal_entry_reference:
            return obj.journal_entry_reference

        return "-"

    @admin.display(description="الترحيل المحاسبي")
    def accounting_status_badge(self, obj):
        if obj.journal_entry_id or obj.journal_entry_reference:
            return format_html(
                '<span style="color:#166534;font-weight:700;">مرحل</span>'
            )

        if obj.status == TreasuryTransactionStatus.CONFIRMED:
            return format_html(
                '<span style="color:#92400e;font-weight:700;">مؤكد بلا قيد</span>'
            )

        return format_html(
            '<span style="color:#6b7280;font-weight:700;">غير مرحل</span>'
        )

    @admin.display(description="أثر الرصيد")
    def balance_effect_badge(self, obj):
        if obj.balance_applied and obj.balance_reversed:
            return format_html(
                '<span style="color:#7c2d12;font-weight:700;">مطبق ومعكوس</span>'
            )

        if obj.balance_applied:
            return format_html(
                '<span style="color:#166534;font-weight:700;">مطبق</span>'
            )

        return format_html(
            '<span style="color:#991b1b;font-weight:700;">غير مطبق</span>'
        )

    def save_model(self, request, obj, form, change):
        if not obj.pk and request.user and request.user.is_authenticated:
            obj.created_by = request.user

        super().save_model(request, obj, form, change)

    @admin.action(description="تأكيد الحركات المحددة")
    def confirm_selected_transactions(self, request, queryset):
        confirmed_count = 0
        skipped_count = 0

        for transaction_obj in queryset:
            try:
                if transaction_obj.status == TreasuryTransactionStatus.CONFIRMED:
                    confirm_treasury_transaction(
                        transaction_obj,
                        actor=request.user,
                        post_to_accounting=None,
                    )
                    skipped_count += 1
                    continue

                if transaction_obj.status == TreasuryTransactionStatus.CANCELLED:
                    self.message_user(
                        request,
                        f"تعذر تأكيد الحركة {transaction_obj.transaction_number}: الحركة ملغاة.",
                        level=messages.ERROR,
                    )
                    continue

                confirm_treasury_transaction(
                    transaction_obj,
                    actor=request.user,
                    post_to_accounting=None,
                )
                confirmed_count += 1

            except ValidationError as exc:
                self.message_user(
                    request,
                    f"تعذر تأكيد الحركة {transaction_obj.transaction_number}: {exc}",
                    level=messages.ERROR,
                )
            except Exception as exc:
                self.message_user(
                    request,
                    f"خطأ غير متوقع أثناء تأكيد الحركة {transaction_obj.transaction_number}: {exc}",
                    level=messages.ERROR,
                )

        if confirmed_count:
            self.message_user(
                request,
                f"تم تأكيد {confirmed_count} حركة خزينة بنجاح.",
                level=messages.SUCCESS,
            )

        if skipped_count:
            self.message_user(
                request,
                f"تم تجاوز أو إعادة فحص {skipped_count} حركة لأنها مؤكدة مسبقًا.",
                level=messages.WARNING,
            )

    @admin.action(description="إلغاء الحركات المحددة")
    def cancel_selected_transactions(self, request, queryset):
        cancelled_count = 0
        skipped_count = 0

        for transaction_obj in queryset:
            try:
                if transaction_obj.status == TreasuryTransactionStatus.CANCELLED:
                    skipped_count += 1
                    continue

                cancel_treasury_transaction(
                    transaction_obj,
                    actor=request.user,
                    reason="تم الإلغاء من لوحة الإدارة.",
                )
                cancelled_count += 1

            except ValidationError as exc:
                self.message_user(
                    request,
                    f"تعذر إلغاء الحركة {transaction_obj.transaction_number}: {exc}",
                    level=messages.ERROR,
                )
            except Exception as exc:
                self.message_user(
                    request,
                    f"خطأ غير متوقع أثناء إلغاء الحركة {transaction_obj.transaction_number}: {exc}",
                    level=messages.ERROR,
                )

        if cancelled_count:
            self.message_user(
                request,
                f"تم إلغاء {cancelled_count} حركة خزينة.",
                level=messages.SUCCESS,
            )

        if skipped_count:
            self.message_user(
                request,
                f"تم تجاوز {skipped_count} حركة لأنها ملغاة مسبقًا.",
                level=messages.WARNING,
            )