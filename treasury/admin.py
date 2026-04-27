# ============================================================
# 📂 treasury/admin.py
# 🧠 Primey Care | Treasury Admin
# ------------------------------------------------------------
# ✅ إدارة الصناديق والحسابات البنكية
# ✅ إدارة الحركات المالية
# ============================================================

from django.contrib import admin

from .models import TreasuryAccount, TreasuryTransaction


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