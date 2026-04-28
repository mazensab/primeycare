# ===============================================================
# 📂 الملف: api/users/send_password_link.py
# 🧭 Primey Care — User Password Link API
# 🚀 الإصدار: Users Password Link API V1.1
# ---------------------------------------------------------------
# ✅ Generates password reset link for a user
# ✅ Does not send notification yet
# ✅ Ready for notification_center integration later
# ✅ Protected by permissions: users.edit
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

from auth_center.permissions import PermissionCodes, permission_required

User = get_user_model()


def _json_body(request) -> dict:
    try:
        if not request.body:
            return {}
        return json.loads(request.body.decode("utf-8"))
    except Exception:
        return {}


def _clean_text(value) -> str:
    return str(value or "").strip()


@login_required
@require_POST
@csrf_protect
@permission_required(PermissionCodes.USERS_EDIT)
def users_send_password_link_api(request, user_id: int):
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