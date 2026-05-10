# ============================================================
# 📂 api/accounting/urls.py
# 🧠 Accounting API URLs — Primey Care V2
# ------------------------------------------------------------
# ✅ Chart of Accounts
# ✅ Account Detail
# ✅ General Ledger
# ✅ Journal Entries
# ✅ Journal Entry Detail
# ✅ Financial Reports
# ✅ Cost Centers
# ✅ Fiscal Years
# ✅ Accounting Periods
# ✅ Tax Rates
# ✅ Tax Transactions
# ✅ Accounting Routing Rules
# ✅ Accounting Settings
# ✅ Excel Export Hooks
# ------------------------------------------------------------
# ملاحظات:
# - هذه الطبقة تربط APIs المحاسبة بعد إعادة بناء Backend المالي.
# - لا يوجد هنا منطق أعمال؛ المنطق في ملفات api/accounting/*.py
# - راعينا بقاء المسارات القديمة حتى لا ينكسر الفرونت الحالي.
# ============================================================

from django.urls import path

from .accounts import (
    accounting_accounts_api,
    accounting_accounts_excel_api,
)
from .cost_centers import (
    accounting_cost_center_detail_api,
    accounting_cost_center_status_api,
    accounting_cost_centers_api,
    accounting_cost_centers_excel_api,
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
from .periods import (
    accounting_fiscal_year_detail_api,
    accounting_fiscal_year_set_current_api,
    accounting_fiscal_year_status_api,
    accounting_fiscal_years_api,
    accounting_fiscal_years_excel_api,
    accounting_period_detail_api,
    accounting_period_status_api,
    accounting_periods_api,
    accounting_periods_excel_api,
)
from .routing import (
    accounting_routing_rule_detail_api,
    accounting_routing_rule_status_api,
    accounting_routing_rules_api,
    accounting_routing_rules_excel_api,
    accounting_settings_api,
)
from .taxes import (
    accounting_tax_rate_detail_api,
    accounting_tax_rate_set_default_api,
    accounting_tax_rate_status_api,
    accounting_tax_rates_api,
    accounting_tax_rates_excel_api,
    accounting_tax_transaction_detail_api,
    accounting_tax_transactions_api,
    accounting_tax_transactions_excel_api,
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

    # ========================================================
    # 🧩 Cost Centers
    # ========================================================
    path(
        "cost-centers/",
        accounting_cost_centers_api,
        name="accounting_cost_centers_api",
    ),
    path(
        "cost-centers/excel/",
        accounting_cost_centers_excel_api,
        name="accounting_cost_centers_excel_api",
    ),
    path(
        "cost-centers/<int:cost_center_id>/",
        accounting_cost_center_detail_api,
        name="accounting_cost_center_detail_api",
    ),
    path(
        "cost-centers/<int:cost_center_id>/status/",
        accounting_cost_center_status_api,
        name="accounting_cost_center_status_api",
    ),

    # ========================================================
    # 📅 Fiscal Years
    # ========================================================
    path(
        "fiscal-years/",
        accounting_fiscal_years_api,
        name="accounting_fiscal_years_api",
    ),
    path(
        "fiscal-years/excel/",
        accounting_fiscal_years_excel_api,
        name="accounting_fiscal_years_excel_api",
    ),
    path(
        "fiscal-years/<int:fiscal_year_id>/",
        accounting_fiscal_year_detail_api,
        name="accounting_fiscal_year_detail_api",
    ),
    path(
        "fiscal-years/<int:fiscal_year_id>/status/",
        accounting_fiscal_year_status_api,
        name="accounting_fiscal_year_status_api",
    ),
    path(
        "fiscal-years/<int:fiscal_year_id>/set-current/",
        accounting_fiscal_year_set_current_api,
        name="accounting_fiscal_year_set_current_api",
    ),

    # ========================================================
    # 📆 Accounting Periods
    # ========================================================
    path(
        "periods/",
        accounting_periods_api,
        name="accounting_periods_api",
    ),
    path(
        "periods/excel/",
        accounting_periods_excel_api,
        name="accounting_periods_excel_api",
    ),
    path(
        "periods/<int:period_id>/",
        accounting_period_detail_api,
        name="accounting_period_detail_api",
    ),
    path(
        "periods/<int:period_id>/status/",
        accounting_period_status_api,
        name="accounting_period_status_api",
    ),

    # ========================================================
    # 🧾 Tax Rates
    # ========================================================
    path(
        "tax-rates/",
        accounting_tax_rates_api,
        name="accounting_tax_rates_api",
    ),
    path(
        "tax-rates/excel/",
        accounting_tax_rates_excel_api,
        name="accounting_tax_rates_excel_api",
    ),
    path(
        "tax-rates/<int:tax_rate_id>/",
        accounting_tax_rate_detail_api,
        name="accounting_tax_rate_detail_api",
    ),
    path(
        "tax-rates/<int:tax_rate_id>/status/",
        accounting_tax_rate_status_api,
        name="accounting_tax_rate_status_api",
    ),
    path(
        "tax-rates/<int:tax_rate_id>/set-default/",
        accounting_tax_rate_set_default_api,
        name="accounting_tax_rate_set_default_api",
    ),

    # ========================================================
    # 🧾 Tax Transactions
    # ========================================================
    path(
        "tax-transactions/",
        accounting_tax_transactions_api,
        name="accounting_tax_transactions_api",
    ),
    path(
        "tax-transactions/excel/",
        accounting_tax_transactions_excel_api,
        name="accounting_tax_transactions_excel_api",
    ),
    path(
        "tax-transactions/<int:tax_transaction_id>/",
        accounting_tax_transaction_detail_api,
        name="accounting_tax_transaction_detail_api",
    ),

    # ========================================================
    # 🧭 Accounting Routing Rules
    # ========================================================
    path(
        "routing-rules/",
        accounting_routing_rules_api,
        name="accounting_routing_rules_api",
    ),
    path(
        "routing-rules/excel/",
        accounting_routing_rules_excel_api,
        name="accounting_routing_rules_excel_api",
    ),
    path(
        "routing-rules/<int:rule_id>/",
        accounting_routing_rule_detail_api,
        name="accounting_routing_rule_detail_api",
    ),
    path(
        "routing-rules/<int:rule_id>/status/",
        accounting_routing_rule_status_api,
        name="accounting_routing_rule_status_api",
    ),

    # ========================================================
    # ⚙️ Accounting Settings
    # ========================================================
    path(
        "settings/",
        accounting_settings_api,
        name="accounting_settings_api",
    ),
]