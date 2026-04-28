# ===============================================================
# 📂 الملف: api/users/send_password_link.py
# 🧭 Primey Care — User Password Link API
# ---------------------------------------------------------------
# ✅ Generates password reset link for a user
# ✅ Does not send notification yet
# ✅ Ready for notification_center integration later
# ===============================================================

from __future__ import annotations

import json

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.contrib.auth.tokens import default_token_generator
from django.http import JsonResponse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST

User = get_user_model()


SYSTEM_ADMIN_GROUPS = {
    "SUPER_ADMIN",
    "SYSTEM",
    "SYSTEM_ADMIN",
    "ADMIN",
}


def _json_body(request) -> dict:
    try:
        if not request.body:
            return {}
        return json.loads(request.body.decode("utf-8"))
    except Exception:
        return {}


def _clean_text(value) -> str:
    return str(value or "").strip()


def _normalize_upper(value) -> str:
    return _clean_text(value).upper()


def _is_system_admin(user) -> bool:
    if not user.is_authenticated:
        return False

    if user.is_superuser:
        return True

    groups = {_normalize_upper(name) for name in user.groups.values_list("name", flat=True)}
    if groups & SYSTEM_ADMIN_GROUPS:
        return True

    profile = getattr(user, "profile", None)
    user_type = _normalize_upper(getattr(profile, "user_type", ""))
    return user_type in SYSTEM_ADMIN_GROUPS


@login_required
@require_POST
@csrf_protect
def users_send_password_link_api(request, user_id: int):
    if not _is_system_admin(request.user):
        return JsonResponse(
            {
                "success": False,
                "message": "You do not have permission to send password links.",
            },
            status=403,
        )

    user = User.objects.filter(id=user_id).select_related("profile").first()
    if not user:
        return JsonResponse(
            {
                "success": False,
                "message": "User not found.",
            },
            status=404,
        )

    if not user.is_active:
        return JsonResponse(
            {
                "success": False,
                "message": "Cannot send password link to inactive user.",
            },
            status=400,
        )

    payload = _json_body(request)

    frontend_base_url = (
        _clean_text(payload.get("frontend_base_url"))
        or _clean_text(getattr(settings, "FRONTEND_BASE_URL", ""))
        or _clean_text(getattr(settings, "FRONDEND_BASE_URL", ""))
        or "http://localhost:3000"
    ).rstrip("/")

    uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)

    reset_path = f"/reset-password?uid={uidb64}&token={token}"
    reset_url = f"{frontend_base_url}{reset_path}"

    return JsonResponse(
        {
            "success": True,
            "message": "Password reset link generated successfully. Notification sending will be connected later.",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email or "",
                "is_active": user.is_active,
            },
            "reset": {
                "uid": uidb64,
                "token": token,
                "reset_path": reset_path,
                "reset_url": reset_url,
            },
            "notification": {
                "sent": False,
                "channel": None,
                "reason": "notification_center integration is pending.",
            },
        },
        status=200,
    )