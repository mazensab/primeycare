# ===============================================================
# 📂 الملف: api/users/deactivate.py
# 🧭 Primey Care — User Deactivate API
# 🚀 الإصدار: Users Deactivate API V1.1
# ---------------------------------------------------------------
# ✅ Deactivate a user account
# ✅ Prevents self-deactivation
# ✅ Deactivates active sessions
# ✅ Protected by permissions: users.disable
# ===============================================================

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST

from auth_center.models import ActiveUserSession
from auth_center.permissions import PermissionCodes, permission_required

User = get_user_model()


@login_required
@require_POST
@csrf_protect
@permission_required(PermissionCodes.USERS_DISABLE)
def users_deactivate_api(request, user_id: int):
    if request.user.id == user_id:
        return JsonResponse(
            {
                "success": False,
                "message": "You cannot deactivate your own account.",
            },
            status=400,
        )

    user = User.objects.filter(id=user_id).first()
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
                "success": True,
                "message": "User is already inactive.",
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "is_active": user.is_active,
                },
            },
            status=200,
        )

    user.is_active = False
    user.save(update_fields=["is_active"])

    ActiveUserSession.objects.filter(user=user, is_active=True).update(
        is_active=False,
        is_current=False,
    )

    return JsonResponse(
        {
            "success": True,
            "message": "User deactivated successfully.",
            "user": {
                "id": user.id,
                "username": user.username,
                "is_active": user.is_active,
            },
        },
        status=200,
    )