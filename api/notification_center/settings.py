# ============================================================
# 📂 api/notification_center/settings.py
# Primey Care - Notification Center Settings API
# ============================================================

from __future__ import annotations

from django.conf import settings as django_settings
from django.views.decorators.http import require_http_methods

from . import ensure_authenticated, json_success, parse_json_body, to_bool


@require_http_methods(["GET", "POST"])
def notification_center_settings_api(request):
    auth_error = ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method == "GET":
        return json_success(
            "Notification center settings loaded successfully",
            data={
                "app_name": getattr(django_settings, "NOTIFICATION_APP_NAME", "Primey Care"),
                "project_brand_name": getattr(django_settings, "PROJECT_BRAND_NAME", "Primey Care"),
                "frontend_base_url": getattr(django_settings, "FRONTEND_BASE_URL", "http://127.0.0.1:3000"),
                "support_email": getattr(django_settings, "SUPPORT_EMAIL", "support@primeycare.local"),
                "email_notifications_enabled": bool(getattr(django_settings, "EMAIL_NOTIFICATIONS_ENABLED", True)),
                "whatsapp_notifications_enabled": bool(getattr(django_settings, "WHATSAPP_NOTIFICATIONS_ENABLED", True)),
                "email_logo_url": getattr(django_settings, "EMAIL_LOGO_URL", ""),
                "primey_email_logo_url": getattr(django_settings, "PRIMEY_EMAIL_LOGO_URL", ""),
                "email_audit_bcc": getattr(django_settings, "EMAIL_AUDIT_BCC", []),
                "note": "These values are configuration-derived. No writable settings model exists yet.",
            },
        )

    payload = parse_json_body(request)

    return json_success(
        "Notification center settings acknowledged successfully",
        data={
            "app_name": str(payload.get("app_name") or getattr(django_settings, "NOTIFICATION_APP_NAME", "Primey Care")),
            "project_brand_name": str(payload.get("project_brand_name") or getattr(django_settings, "PROJECT_BRAND_NAME", "Primey Care")),
            "frontend_base_url": str(payload.get("frontend_base_url") or getattr(django_settings, "FRONTEND_BASE_URL", "http://127.0.0.1:3000")),
            "support_email": str(payload.get("support_email") or getattr(django_settings, "SUPPORT_EMAIL", "support@primeycare.local")),
            "email_notifications_enabled": to_bool(payload.get("email_notifications_enabled"), bool(getattr(django_settings, "EMAIL_NOTIFICATIONS_ENABLED", True))),
            "whatsapp_notifications_enabled": to_bool(payload.get("whatsapp_notifications_enabled"), bool(getattr(django_settings, "WHATSAPP_NOTIFICATIONS_ENABLED", True))),
            "note": "No dedicated persistent settings model exists yet. This endpoint currently returns the effective requested values.",
        },
    )