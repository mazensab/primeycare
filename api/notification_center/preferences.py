# ============================================================
# 📂 api/notification_center/preferences.py
# Primey Care - Notification Center Preferences API
# ============================================================

from __future__ import annotations

from django.views.decorators.http import require_http_methods

from . import ensure_authenticated, json_success, parse_json_body, to_bool


@require_http_methods(["GET", "POST"])
def notification_center_preferences_api(request):
    auth_error = ensure_authenticated(request)
    if auth_error:
        return auth_error

    user = request.user

    if request.method == "GET":
        return json_success(
            "Notification preferences loaded successfully",
            data={
                "user_id": user.id,
                "email_notifications_enabled": True,
                "whatsapp_notifications_enabled": True,
                "in_app_notifications_enabled": True,
                "preferred_language": getattr(user, "preferred_language", "ar") or "ar",
                "note": "No dedicated preferences model exists yet. This endpoint currently returns logical defaults.",
            },
        )

    payload = parse_json_body(request)

    return json_success(
        "Notification preferences updated successfully",
        data={
            "user_id": user.id,
            "email_notifications_enabled": to_bool(payload.get("email_notifications_enabled"), True),
            "whatsapp_notifications_enabled": to_bool(payload.get("whatsapp_notifications_enabled"), True),
            "in_app_notifications_enabled": to_bool(payload.get("in_app_notifications_enabled"), True),
            "preferred_language": str(payload.get("preferred_language") or getattr(user, "preferred_language", "ar") or "ar"),
            "note": "Preferences are acknowledged at API level. No dedicated persistence model exists yet.",
        },
    )