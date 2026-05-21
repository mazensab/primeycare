# ============================================================
# 📂 notification_center/routing.py
# 🧠 Primey Care - Notification Center WebSocket Routing
# ------------------------------------------------------------
# ✅ يربط WebSocket الإشعارات الحية مع ASGI
# ✅ المسار الرسمي المستخدم في الفرونت:
#    /ws/system/notifications/
# ✅ يدعم نسخة بدون slash لتجنب 404 أثناء التطوير
# ✅ يعتمد على NotificationConsumer الموجود
# ============================================================

from __future__ import annotations

from django.urls import re_path

from notification_center.consumers import NotificationConsumer


websocket_urlpatterns = [
    re_path(
        r"^ws/system/notifications/$",
        NotificationConsumer.as_asgi(),
        name="system_notifications_ws",
    ),
    re_path(
        r"^ws/system/notifications$",
        NotificationConsumer.as_asgi(),
        name="system_notifications_ws_no_slash",
    ),
]