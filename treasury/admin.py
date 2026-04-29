# ============================================================
# 📂 treasury/admin.py
# 🧠 Primey Care | Treasury Admin
# ------------------------------------------------------------
# ✅ إدارة الصناديق والحسابات البنكية
# ✅ إدارة الحركات المالية
# ✅ إجراءات تأكيد وإلغاء حركات الخزينة من لوحة الإدارة
# ============================================================

from django.contrib import admin, messages
from django.core.exceptions import ValidationError

from .models import TreasuryAccount, TreasuryTransaction, TreasuryTransactionStatus
from .services import confirm_treasury_transaction


@admin.register(TreasuryAccount)
class TreasuryAccountAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "code",
        "account_type",
        "status",
        "currency",
        "opening_balance",
        "current_balance",
        "bank_name",
        "ledger_account",
        "is_default",
        "created_at",
    )
    list_filter = (
        "account_type",
        "status",
        "currency",
        "is_default",
        "created_at",
    )
    search_fields = (
        "name",
        "code",
        "bank_name",
        "account_holder_name",
        "account_number",
        "iban",
        "description",
    )
    readonly_fields = (
        "current_balance",
        "created_at",
        "updated_at",
    )
    ordering = ("account_type", "code")
    list_per_page = 50


@admin.register(TreasuryTransaction)
class TreasuryTransactionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "transaction_number",
        "transaction_type",
        "status",
        "transaction_date",
        "treasury_account",
        "destination_account",
        "amount",
        "currency",
        "reference",
        "created_at",
    )
    list_filter = (
        "transaction_type",
        "status",
        "transaction_date",
        "currency",
        "created_at",
    )
    search_fields = (
        "transaction_number",
        "reference",
        "external_reference",
        "description",
        "notes",
        "journal_entry_reference",
        "treasury_account__name",
        "treasury_account__code",
        "destination_account__name",
        "destination_account__code",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
    )
    ordering = ("-transaction_date", "-id")
    list_per_page = 50
    actions = (
        "confirm_selected_transactions",
        "cancel_selected_transactions",
    )

    @admin.action(description="تأكيد الحركات المحددة")
    def confirm_selected_transactions(self, request, queryset):
        confirmed_count = 0
        skipped_count = 0

        for transaction_obj in queryset:
            try:
                if transaction_obj.status == TreasuryTransactionStatus.CONFIRMED:
                    skipped_count += 1
                    continue

                confirm_treasury_transaction(transaction_obj)
                confirmed_count += 1
            except ValidationError as exc:
                self.message_user(
                    request,
                    f"تعذر تأكيد الحركة {transaction_obj.transaction_number}: {exc}",
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
                f"تم تجاوز {skipped_count} حركة لأنها مؤكدة مسبقًا.",
                level=messages.WARNING,
            )

    @admin.action(description="إلغاء الحركات المحددة")
    def cancel_selected_transactions(self, request, queryset):
        cancelled_count = 0

        for transaction_obj in queryset:
            try:
                if transaction_obj.status == TreasuryTransactionStatus.CANCELLED:
                    continue

                transaction_obj.status = TreasuryTransactionStatus.CANCELLED
                transaction_obj.save(update_fields=["status", "updated_at"])
                cancelled_count += 1
            except ValidationError as exc:
                self.message_user(
                    request,
                    f"تعذر إلغاء الحركة {transaction_obj.transaction_number}: {exc}",
                    level=messages.ERROR,
                )

        if cancelled_count:
            self.message_user(
                request,
                f"تم إلغاء {cancelled_count} حركة خزينة بنجاح.",
                level=messages.SUCCESS,
            )