# ============================================================
# 📂 accounting/admin.py
# 🧠 Primey Care | Accounting Admin
# ------------------------------------------------------------
# ✅ إدارة دليل الحسابات
# ✅ إدارة القيود اليومية
# ✅ إدارة أسطر القيود
# ============================================================

from django.contrib import admin

from .models import Account, JournalEntry, JournalEntryLine


class JournalEntryLineInline(admin.TabularInline):
    model = JournalEntryLine
    extra = 1
    fields = (
        "account",
        "description",
        "debit_amount",
        "credit_amount",
        "sort_order",
    )


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "code",
        "name",
        "account_type",
        "nature",
        "parent",
        "level",
        "is_group",
        "is_active",
        "created_at",
    )
    list_filter = (
        "account_type",
        "nature",
        "is_group",
        "is_active",
        "level",
        "created_at",
    )
    search_fields = (
        "code",
        "name",
        "description",
    )
    readonly_fields = (
        "level",
        "created_at",
        "updated_at",
    )
    ordering = ("code",)


@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "entry_number",
        "entry_date",
        "posting_source",
        "status",
        "reference",
        "total_debit",
        "total_credit",
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
    )
    readonly_fields = (
        "total_debit",
        "total_credit",
        "created_at",
        "updated_at",
    )
    ordering = ("-entry_date", "-id")
    inlines = [JournalEntryLineInline]


@admin.register(JournalEntryLine)
class JournalEntryLineAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "journal_entry",
        "account",
        "debit_amount",
        "credit_amount",
        "sort_order",
        "created_at",
    )
    list_filter = (
        "journal_entry__status",
        "journal_entry__posting_source",
        "created_at",
    )
    search_fields = (
        "journal_entry__entry_number",
        "account__code",
        "account__name",
        "description",
    )
    ordering = ("journal_entry", "sort_order", "id")