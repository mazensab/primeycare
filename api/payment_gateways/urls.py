# ============================================================
# 📂 api/payment_gateways/urls.py
# 🧠 Primey Care | Payment Gateways API URLs V2
# ------------------------------------------------------------
# ✅ Gateway configs
# ✅ Gateway transactions
# ✅ Tamara checkout
# ✅ Tamara webhook
# ✅ Tap checkout
# ✅ Tap webhook
# ✅ Tap checkout status
# ✅ Tap success lookup
# ✅ Compatible with Payments / Accounting / Treasury flow
# ------------------------------------------------------------
# المسار المالي المعتمد لاحقًا:
# Gateway Checkout
# → PaymentGatewayTransaction
# → Webhook/Status Confirm
# → payments.services.confirm_payment
# → Accounting JournalEntry بعد commit
# → TreasuryTransaction بعد commit
# ============================================================

from django.urls import path

from .detail import (
    payment_gateway_config_detail_api,
    payment_gateway_transaction_detail_api,
)
from .list import (
    payment_gateway_configs_list_api,
    payment_gateway_transactions_list_api,
)
from .tamara_create_checkout import tamara_create_checkout_api
from .tamara_webhook import tamara_webhook_api
from .tap_checkout_status import tap_checkout_status_api
from .tap_create_checkout import tap_create_checkout_api
from .tap_success_lookup import tap_success_lookup_api
from .tap_webhook import tap_webhook_api


app_name = "api_payment_gateways"


urlpatterns = [
    # ========================================================
    # ⚙️ Gateway Configs
    # --------------------------------------------------------
    # GET/POST /api/payment-gateways/configs/
    # GET/PATCH /api/payment-gateways/configs/<provider>/
    # ========================================================
    path(
        "configs/",
        payment_gateway_configs_list_api,
        name="payment_gateway_configs_list_api",
    ),
    path(
        "configs/<str:provider>/",
        payment_gateway_config_detail_api,
        name="payment_gateway_config_detail_api",
    ),

    # ========================================================
    # 💳 Gateway Transactions
    # --------------------------------------------------------
    # GET /api/payment-gateways/transactions/
    # GET /api/payment-gateways/transactions/<id>/
    # ========================================================
    path(
        "transactions/",
        payment_gateway_transactions_list_api,
        name="payment_gateway_transactions_list_api",
    ),
    path(
        "transactions/<int:transaction_id>/",
        payment_gateway_transaction_detail_api,
        name="payment_gateway_transaction_detail_api",
    ),

    # ========================================================
    # 🟣 Tamara
    # --------------------------------------------------------
    # POST /api/payment-gateways/tamara/create-checkout/
    # POST /api/payment-gateways/tamara/webhook/
    # ========================================================
    path(
        "tamara/create-checkout/",
        tamara_create_checkout_api,
        name="tamara_create_checkout_api",
    ),
    path(
        "tamara/webhook/",
        tamara_webhook_api,
        name="tamara_webhook_api",
    ),

    # ========================================================
    # 🟢 Tap
    # --------------------------------------------------------
    # POST /api/payment-gateways/tap/create-checkout/
    # POST /api/payment-gateways/tap/webhook/
    # GET/POST /api/payment-gateways/tap/checkout-status/
    # GET/POST /api/payment-gateways/tap/success-lookup/
    # ========================================================
    path(
        "tap/create-checkout/",
        tap_create_checkout_api,
        name="tap_create_checkout_api",
    ),
    path(
        "tap/webhook/",
        tap_webhook_api,
        name="tap_webhook_api",
    ),
    path(
        "tap/checkout-status/",
        tap_checkout_status_api,
        name="tap_checkout_status_api",
    ),
    path(
        "tap/success-lookup/",
        tap_success_lookup_api,
        name="tap_success_lookup_api",
    ),
]