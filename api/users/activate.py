# ===============================================================
# 📂 الملف: api/users/activate.py
# 🧭 Primey Care — User Activate API
# ---------------------------------------------------------------
# ✅ Activate a user account
# ===============================================================

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST

User = get_user_model()


SYSTEM_ADMIN_GROUPS = {
    "SUPER_ADMIN",
    "SYSTEM",
    "SYSTEM_ADMIN",
    "ADMIN",
}


def _normalize_upper(value) -> str:
    return str(value or "").strip().upper()


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
def users_activate_api(request, user_id: int):
    if not _is_system_admin(request.user):
        return JsonResponse(
            {
                "success": False,
                "message": "You do not have permission to activate users.",
            },
            status=403,
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