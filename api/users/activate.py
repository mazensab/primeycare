# ===============================================================
# 📂 الملف: api/users/activate.py
# 🧭 Primey Care — User Activate API
# 🚀 الإصدار: Users Activate API V1.1
# ---------------------------------------------------------------
# ✅ Activate a user account
# ✅ Protected by permissions: users.disable
# ===============================================================

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST

from auth_center.permissions import PermissionCodes, permission_required

User = get_user_model()


@login_required
@require_POST
@csrf_protect
@permission_required(PermissionCodes.USERS_DISABLE)
def users_activate_api(request, user_id: int):
    user = User.objects.filter(id=user_id).first()
    if not user:
        return JsonResponse(
            {
                "success": False,
                "message": "User not found.",
            },
            status=404,
        )

    if user.is_active:
        return JsonResponse(
            {
                "success": True,
                "message": "User is already active.",
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "is_active": user.is_active,
                },
            },
            status=200,
        )

    user.is_active = True
    user.save(update_fields=["is_active"])

    return JsonResponse(
        {
            "success": True,
            "message": "User activated successfully.",
            "user": {
                "id": user.id,
                "username": user.username,
                "is_active": user.is_active,
            },
        },
        status=200,
    )