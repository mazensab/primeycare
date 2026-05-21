# ===============================================================
# 📂 الملف: api/users/activate.py
# 🧭 Primey Care — User Activate API
# 🚀 الإصدار: Users Activate API V1.2
# ---------------------------------------------------------------
# ✅ Activate a user account
# ✅ Protected by permissions: users.disable
# ✅ صفحة المستخدمين لإدارة حساب الدخول فقط
# ✅ لا تعدّل بيانات العميل/المندوب/الوسيط/مقدم الخدمة
# ✅ Compatible response:
#    ok / success / user / item / data
# ===============================================================

from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST

from auth_center.permissions import PermissionCodes, permission_required

User = get_user_model()


# ===============================================================
# Helpers
# ===============================================================

def _json_error(
    message: str,
    *,
    status: int = 400,
    errors: dict[str, Any] | None = None,
) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": False,
        "success": False,
        "message": message,
    }

    if errors:
        payload["errors"] = errors

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


def _json_success(data: dict[str, Any], *, status: int = 200) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": True,
        "success": True,
    }
    payload.update(data)

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _serialize_profile(profile: Any | None) -> dict[str, Any] | None:
    if not profile:
        return None

    extra_data = getattr(profile, "extra_data", {})
    if not isinstance(extra_data, dict):
        extra_data = {}

    tags = getattr(profile, "tags", [])
    if not isinstance(tags, list):
        tags = []

    return {
        "display_name": getattr(profile, "display_name", "") or "",
        "user_type": getattr(profile, "user_type", "") or "",
        "role": getattr(profile, "role", "") or "",
        "phone_number": getattr(profile, "phone_number", None),
        "whatsapp_number": getattr(profile, "whatsapp_number", None),
        "alternate_email": getattr(profile, "alternate_email", None),
        "preferred_language": getattr(profile, "preferred_language", "ar") or "ar",
        "timezone": getattr(profile, "timezone", "Asia/Riyadh") or "Asia/Riyadh",
        "is_phone_verified": bool(getattr(profile, "is_phone_verified", False)),
        "is_whatsapp_verified": bool(getattr(profile, "is_whatsapp_verified", False)),
        "is_email_verified": bool(getattr(profile, "is_email_verified", False)),
        "is_profile_completed": bool(getattr(profile, "is_profile_completed", False)),
        "extra_data": extra_data,
        "tags": tags,
    }


def _serialize_user(user: Any) -> dict[str, Any]:
    profile = getattr(user, "profile", None)

    full_name = ""
    try:
        full_name = (user.get_full_name() or "").strip()
    except Exception:
        full_name = ""

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email or "",
        "first_name": user.first_name or "",
        "last_name": user.last_name or "",
        "full_name": full_name,
        "is_active": user.is_active,
        "status": "ACTIVE" if user.is_active else "INACTIVE",
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "last_login": _iso_datetime(user.last_login),
        "date_joined": _iso_datetime(user.date_joined),
        "profile": _serialize_profile(profile),
    }


# ===============================================================
# API
# ===============================================================

@login_required
@require_POST
@csrf_protect
@permission_required(PermissionCodes.USERS_DISABLE)
def users_activate_api(request, user_id: int):
    user = (
        User.objects
        .filter(id=user_id)
        .select_related("profile")
        .first()
    )

    if not user:
        return _json_error(
            "User not found.",
            status=404,
            errors={
                "user_id": [
                    "لم يتم العثور على المستخدم."
                ]
            },
        )

    if user.is_active:
        serialized_user = _serialize_user(user)

        return _json_success(
            {
                "message": "User is already active.",
                "user": serialized_user,
                "item": serialized_user,
                "data": {
                    "user": serialized_user,
                    "activation": {
                        "changed": False,
                    },
                },
                "activation": {
                    "changed": False,
                },
            },
            status=200,
        )

    with transaction.atomic():
        user.is_active = True
        user.save(update_fields=["is_active"])

    user = (
        User.objects
        .filter(id=user_id)
        .select_related("profile")
        .first()
    )

    serialized_user = _serialize_user(user)

    return _json_success(
        {
            "message": "User activated successfully.",
            "user": serialized_user,
            "item": serialized_user,
            "data": {
                "user": serialized_user,
                "activation": {
                    "changed": True,
                },
            },
            "activation": {
                "changed": True,
            },
        },
        status=200,
    )