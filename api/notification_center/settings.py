# ============================================================
# 📂 api/notification_center/settings.py
# Primey Care - Notification Center Settings API
# ------------------------------------------------------------
# ✅ إعدادات Notification Center من settings/env
# ✅ بدون localhost fallback
# ✅ متوافق مع FRONTEND_BASE_URL / FRONTEND_URL / NEXT_PUBLIC_APP_URL
# ✅ endpoint للعرض والاعتماد المؤقت بدون تخزين دائم
# ============================================================

from __future__ import annotations

from django.conf import settings as django_settings
from django.views.decorators.http import require_http_methods

from . import ensure_authenticated, json_success, parse_json_body, to_bool


def _clean_text(value) -> str:
    return str(value).strip() if value is not None else ""


def _setting_text(name: str, default: str = "") -> str:
    return _clean_text(getattr(django_settings, name, default))


def _frontend_base_url() -> str:
    """
    لا نستخدم localhost كـ fallback.
    يتم تحديد رابط الواجهة من env/settings فقط.
    """
    return (
        _setting_text("FRONTEND_BASE_URL")
        or _setting_text("FRONTEND_URL")
        or _setting_text("NEXT_PUBLIC_APP_URL")
    ).rstrip("/")


def _email_audit_bcc():
    raw = getattr(django_settings, "EMAIL_AUDIT_BCC", [])

    if not raw:
        return []

    if isinstance(raw, str):
        return [item.strip() for item in raw.split(",") if item.strip()]

    if isinstance(raw, (list, tuple, set)):
        return [str(item).strip() for item in raw if str(item).strip()]

    return []


def _effective_settings() -> dict:
    return {
        "app_name": _setting_text("NOTIFICATION_APP_NAME", "Primey Care") or "Primey Care",
        "project_brand_name": _setting_text("PROJECT_BRAND_NAME", "Primey Care") or "Primey Care",
        "frontend_base_url": _frontend_base_url(),
        "support_email": (
            _setting_text("SUPPORT_EMAIL")
            or _setting_text("DEFAULT_SUPPORT_EMAIL")
            or "support@primeycare.local"
        ),
        "email_notifications_enabled": bool(
            getattr(django_settings, "EMAIL_NOTIFICATIONS_ENABLED", True)
        ),
        "whatsapp_notifications_enabled": bool(
            getattr(django_settings, "WHATSAPP_NOTIFICATIONS_ENABLED", True)
        ),
        "email_logo_url": _setting_text("EMAIL_LOGO_URL"),
        "primey_email_logo_url": _setting_text("PRIMEY_EMAIL_LOGO_URL"),
        "email_audit_bcc": _email_audit_bcc(),
        "available_channels": [
            "in_app",
            "email",
            "whatsapp",
        ],
        "readonly": True,
        "note": "These values are configuration-derived from Django settings/env. No persistent writable notification settings model exists yet.",
    }


@require_http_methods(["GET", "POST"])
def notification_center_settings_api(request):
    auth_error = ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method == "GET":
        return json_success(
            "Notification center settings loaded successfully",
            data=_effective_settings(),
        )

    payload = parse_json_body(request)
    current = _effective_settings()

    requested = {
        "app_name": _clean_text(payload.get("app_name")) or current["app_name"],
        "project_brand_name": (
            _clean_text(payload.get("project_brand_name"))
            or current["project_brand_name"]
        ),
        "frontend_base_url": (
            _clean_text(payload.get("frontend_base_url"))
            or current["frontend_base_url"]
        ).rstrip("/"),
        "support_email": _clean_text(payload.get("support_email")) or current["support_email"],
        "email_notifications_enabled": to_bool(
            payload.get("email_notifications_enabled"),
            current["email_notifications_enabled"],
        ),
        "whatsapp_notifications_enabled": to_bool(
            payload.get("whatsapp_notifications_enabled"),
            current["whatsapp_notifications_enabled"],
        ),
        "email_logo_url": _clean_text(payload.get("email_logo_url")) or current["email_logo_url"],
        "primey_email_logo_url": (
            _clean_text(payload.get("primey_email_logo_url"))
            or current["primey_email_logo_url"]
        ),
        "email_audit_bcc": payload.get("email_audit_bcc", current["email_audit_bcc"]),
        "available_channels": current["available_channels"],
        "readonly": True,
        "persisted": False,
        "note": "Settings request acknowledged only. To persist these values, set them in Django settings/env or add a dedicated settings model later.",
    }

    return json_success(
        "Notification center settings acknowledged successfully",
        data=requested,
    )