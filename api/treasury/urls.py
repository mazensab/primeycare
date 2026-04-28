# ============================================================
# 📂 api/treasury/urls.py
# 🧠 Primey Care | Treasury API URLs
# ------------------------------------------------------------
# ✅ Accounts
# ✅ Transactions
# ✅ Confirm transaction
# ✅ Statement
# ============================================================

from django.urls import path

from .detail import (
    treasury_account_detail,
    treasury_account_statement,
    treasury_transaction_confirm,
    treasury_transaction_detail,
)
from .list import (
    treasury_accounts,
    treasury_transactions,
)


app_name = "api_treasury"

urlpatterns = [
    # ========================================================
    # Treasury Accounts
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
    # Treasury Transactions
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

    # ========================================================
    # Backward-compatible aliases
    # --------------------------------------------------------
    # حتى لو استدعيت /api/treasury/ مباشرة من الواجهة
    # يرجع قائمة الحسابات بدل 404
    # ========================================================
    path(
        "",
        treasury_accounts,
        name="treasury_root",
    ),
]