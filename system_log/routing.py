# ================================================================
# 📂 system_log/routing.py
# 🌐 Primey Care - System Log WebSocket Routing
# ================================================================

from django.urls import re_path

from .consumers import SystemLogConsumer

websocket_urlpatterns = [
    re_path(
        r"^ws/system-log/live/system/$",
        SystemLogConsumer.as_asgi(),
        {"scope_type": "system"},
    ),
    re_path(
        r"^ws/system-log/live/company/(?P<company_reference>[^/]+)/$",
        SystemLogConsumer.as_asgi(),
        {"scope_type": "company"},
    ),
]