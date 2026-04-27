# ============================================================
# 📂 payment_gateways/apps.py
# 🧠 Primey Care - Payment Gateways App Config
# ============================================================

from django.apps import AppConfig


class PaymentGatewaysConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "payment_gateways"
    verbose_name = "Payment Gateways"