# ============================================================
# 📂 api/treasury/urls.py
# 🧠 Primey Care | Treasury API URLs V2
# ------------------------------------------------------------
# ✅ Treasury Accounts
# ✅ Cashboxes aliases
# ✅ Banks aliases
# ✅ Treasury Transactions
# ✅ Confirm transaction
# ✅ Cancel transaction
# ✅ Account statement
# ✅ Backward-compatible root alias
# ------------------------------------------------------------
# ملاحظات:
# - هذا الملف يربط فقط مسارات الخزينة.
# - منطق الإنشاء والتعديل في:
#   api/treasury/list.py
#   api/treasury/detail.py
# - حافظنا على نفس المسارات الحالية حتى لا ينكسر الربط مع الفرونت.
# ============================================================

from django.urls import path

from .detail import (
    treasury_account_detail,
    treasury_account_statement,
    treasury_transaction_cancel,
    treasury_transaction_confirm,
    treasury_transaction_detail,
)
from .list import (
    treasury_accounts,
    treasury_banks,
    treasury_cashboxes,
    treasury_transactions,
)


app_name = "api_treasury"


urlpatterns = [
    # ========================================================
    # 🏦 Treasury Accounts
    # ========================================================
    path(
        "accounts/",
        treasury_accounts,
        name="treasury_accounts",
    ),
    path(
        "accounts/<int:account_id>/",
        treasury_account_detail,
        name="treasury_account_detail",
    ),
    path(
        "accounts/<int:account_id>/statement/",
        treasury_account_statement,
        name="treasury_account_statement",
    ),

    # ========================================================
    # 💵 Cashboxes Aliases
    # ========================================================
    path(
        "cashboxes/",
        treasury_cashboxes,
        name="treasury_cashboxes",
    ),

    # ========================================================
    # 🏛️ Banks Aliases
    # ========================================================
    path(
        "banks/",
        treasury_banks,
        name="treasury_banks",
    ),

    # ========================================================
    # 🔁 Treasury Transactions
    # ========================================================
    path(
        "transactions/",
        treasury_transactions,
        name="treasury_transactions",
    ),
    path(
        "transactions/<int:transaction_id>/",
        treasury_transaction_detail,
        name="treasury_transaction_detail",
    ),
    path(
        "transactions/<int:transaction_id>/confirm/",
        treasury_transaction_confirm,
        name="treasury_transaction_confirm",
    ),
    path(
        "transactions/<int:transaction_id>/cancel/",
        treasury_transaction_cancel,
        name="treasury_transaction_cancel",
    ),

    # ========================================================
    # 🔙 Backward-compatible Root Alias
    # --------------------------------------------------------
    # حتى لو استدعت الواجهة:
    # /api/treasury/
    # يرجع قائمة حسابات الخزينة بدل 404.
    # ========================================================
    path(
        "",
        treasury_accounts,
        name="treasury_root",
    ),
]