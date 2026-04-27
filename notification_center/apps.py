# ============================================================
# 📂 notification_center/apps.py
# 🧠 Primey Care - Notification Center App Config
# ------------------------------------------------------------
# ✅ لا يعتمد على channels
# ✅ لا يعتمد على signals
# ✅ safe bootstrap
# ============================================================

from django.apps import AppConfig


class NotificationCenterConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "notification_center"
    verbose_name = "Notification Center"