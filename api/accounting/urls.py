# ============================================================
# 📂 api/accounting/urls.py
# 🧠 Accounting API URLs — Primey Care V1.5
# ------------------------------------------------------------
# ✅ Chart of Accounts
# ✅ Account Detail
# ✅ Account Detail Excel
# ✅ General Ledger
# ✅ General Ledger Excel
# ✅ Journal Entries
# ✅ Journal Entry Detail
# ✅ Journal Entries Excel
# ✅ Trial Balance
# ✅ Profit & Loss
# ✅ Balance Sheet
# ✅ Excel Export Hooks
# ============================================================

from django.urls import path

from .accounts import (
    accounting_accounts_api,
    accounting_accounts_excel_api,
)
from .detail import (
    accounting_account_detail_api,
    accounting_account_detail_excel_api,
)
from .journal_detail import accounting_journal_entry_detail_api
from .journals import (
    accounting_journal_entries_api,
    accounting_journal_entries_excel_api,
)
from .ledger import (
    accounting_general_ledger_api,
    accounting_general_ledger_excel_api,
)
from .list import (
    accounting_balance_sheet_api,
    accounting_balance_sheet_excel_api,
    accounting_profit_loss_api,
    accounting_profit_loss_excel_api,
    accounting_trial_balance_api,
    accounting_trial_balance_excel_api,
)

app_name = "api_accounting"

urlpatterns = [
    # ========================================================
    # 🌳 Chart of Accounts
    # ========================================================
    path(
        "accounts/",
        accounting_accounts_api,
        name="accounting_accounts_api",
    ),
    path(
        "accounts/excel/",
        accounting_accounts_excel_api,
        name="accounting_accounts_excel_api",
    ),

    # ========================================================
    # 📘 Account Detail
    # ========================================================
    path(
        "accounts/<int:account_id>/",
        accounting_account_detail_api,
        name="accounting_account_detail_api",
    ),
    path(
        "accounts/<int:account_id>/excel/",
        accounting_account_detail_excel_api,
        name="accounting_account_detail_excel_api",
    ),

    # ========================================================
    # 📚 General Ledger
    # ========================================================
    path(
        "ledger/",
        accounting_general_ledger_api,
        name="accounting_general_ledger_api",
    ),
    path(
        "ledger/excel/",
        accounting_general_ledger_excel_api,
        name="accounting_general_ledger_excel_api",
    ),

    # ========================================================
    # 🧾 Journal Entries
    # ========================================================
    path(
        "journals/",
        accounting_journal_entries_api,
        name="accounting_journal_entries_api",
    ),
    path(
        "journals/excel/",
        accounting_journal_entries_excel_api,
        name="accounting_journal_entries_excel_api",
    ),
    path(
        "journals/<int:journal_entry_id>/",
        accounting_journal_entry_detail_api,
        name="accounting_journal_entry_detail_api",
    ),

    # ========================================================
    # 📊 Financial Reports
    # ========================================================
    path(
        "reports/trial-balance/",
        accounting_trial_balance_api,
        name="accounting_trial_balance_api",
    ),
    path(
        "reports/trial-balance/excel/",
        accounting_trial_balance_excel_api,
        name="accounting_trial_balance_excel_api",
    ),
    path(
        "reports/profit-loss/",
        accounting_profit_loss_api,
        name="accounting_profit_loss_api",
    ),
    path(
        "reports/profit-loss/excel/",
        accounting_profit_loss_excel_api,
        name="accounting_profit_loss_excel_api",
    ),
    path(
        "reports/balance-sheet/",
        accounting_balance_sheet_api,
        name="accounting_balance_sheet_api",
    ),
    path(
        "reports/balance-sheet/excel/",
        accounting_balance_sheet_excel_api,
        name="accounting_balance_sheet_excel_api",
    ),
]