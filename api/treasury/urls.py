# ============================================================
# 📂 api/treasury/urls.py
# 🧠 Primey Care | Treasury API URLs V3
# ------------------------------------------------------------
# ✅ Treasury Accounts
# ✅ Cashboxes aliases
# ✅ Banks aliases
# ✅ Treasury Transactions
# ✅ Receipt vouchers aliases
# ✅ Payment vouchers aliases
# ✅ Transfers aliases
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
# - مسارات السندات والتحويلات aliases تمر على نفس treasury_transactions.
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
    # 🧾 Receipt Vouchers Aliases
    # --------------------------------------------------------
    # سندات القبض تستخدم نفس منطق حركات الخزينة.
    # عند الإنشاء يرسل الفرونت:
    # transaction_type=INCOME
    # source=MANUAL
    # counterparty_ledger_account_id
    # post_to_accounting=true عند الحاجة
    # ========================================================
    path(
        "vouchers/receipt/",
        treasury_transactions,
        name="treasury_receipt_vouchers",
    ),
    path(
        "vouchers/receipt/<int:transaction_id>/",
        treasury_transaction_detail,
        name="treasury_receipt_voucher_detail",
    ),
    path(
        "vouchers/receipt/<int:transaction_id>/confirm/",
        treasury_transaction_confirm,
        name="treasury_receipt_voucher_confirm",
    ),
    path(
        "vouchers/receipt/<int:transaction_id>/cancel/",
        treasury_transaction_cancel,
        name="treasury_receipt_voucher_cancel",
    ),

    # ========================================================
    # 💸 Payment Vouchers Aliases
    # --------------------------------------------------------
    # سندات الصرف تستخدم نفس منطق حركات الخزينة.
    # عند الإنشاء يرسل الفرونت:
    # transaction_type=EXPENSE
    # source=MANUAL
    # counterparty_ledger_account_id
    # post_to_accounting=true عند الحاجة
    # ========================================================
    path(
        "vouchers/payment/",
        treasury_transactions,
        name="treasury_payment_vouchers",
    ),
    path(
        "vouchers/payment/<int:transaction_id>/",
        treasury_transaction_detail,
        name="treasury_payment_voucher_detail",
    ),
    path(
        "vouchers/payment/<int:transaction_id>/confirm/",
        treasury_transaction_confirm,
        name="treasury_payment_voucher_confirm",
    ),
    path(
        "vouchers/payment/<int:transaction_id>/cancel/",
        treasury_transaction_cancel,
        name="treasury_payment_voucher_cancel",
    ),

    # ========================================================
    # 🔄 Transfers Aliases
    # --------------------------------------------------------
    # التحويلات تستخدم نفس منطق حركات الخزينة.
    # عند الإنشاء يرسل الفرونت:
    # transaction_type=TRANSFER
    # treasury_account_id
    # destination_account_id
    # post_to_accounting=true عند الحاجة
    # ========================================================
    path(
        "transfers/",
        treasury_transactions,
        name="treasury_transfers",
    ),
    path(
        "transfers/<int:transaction_id>/",
        treasury_transaction_detail,
        name="treasury_transfer_detail",
    ),
    path(
        "transfers/<int:transaction_id>/confirm/",
        treasury_transaction_confirm,
        name="treasury_transfer_confirm",
    ),
    path(
        "transfers/<int:transaction_id>/cancel/",
        treasury_transaction_cancel,
        name="treasury_transfer_cancel",
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