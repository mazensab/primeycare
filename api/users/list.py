# ===============================================================
# 📂 الملف: api/users/list.py
# 🧭 Primey Care — Users List API
# 🚀 الإصدار: Users List API V1.1
# ---------------------------------------------------------------
# ✅ List users
# ✅ Search / filter / pagination
# ✅ Session protected
# ✅ Protected by permissions: users.view
# ===============================================================

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from auth_center.permissions import PermissionCodes, permission_required

User = get_user_model()


def _normalize_upper(value) -> str:
    return str(value or "").strip().upper()


def _safe_int(value, default: int) -> int:
    try:
        value = int(value)
        return value if value > 0 else default
    except (TypeError, ValueError):
        return default


def _serialize_user(user) -> dict:
    profile = getattr(user, "profile", None)
    groups = list(user.groups.values_list("name", flat=True))

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email or "",
        "first_name": user.first_name or "",
        "last_name": user.last_name or "",
        "full_name": (user.get_full_name() or "").strip(),
        "is_active": user.is_active,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "date_joined": user.date_joined.isoformat() if user.date_joined else None,
        "groups": groups,
        "profile": {
            "display_name": profile.display_name if profile else "",
            "user_type": profile.user_type if profile else "OTHER",
            "role": profile.role if profile else "viewer",
            "phone_number": profile.phone_number if profile else None,
            "whatsapp_number": profile.whatsapp_number if profile else None,
            "alternate_email": profile.alternate_email if profile else None,
            "preferred_language": profile.preferred_language if profile else "ar",
            "timezone": profile.timezone if profile else "Asia/Riyadh",
            "is_profile_completed": profile.is_profile_completed if profile else False,
            "extra_data": profile.extra_data if profile else {},
            "tags": profile.tags if profile else [],
        },
    }


@login_required
@require_GET
@permission_required(PermissionCodes.USERS_VIEW)
def users_list_api(request):
    q = str(request.GET.get("q", "") or "").strip()
    user_type = _normalize_upper(request.GET.get("user_type", ""))
    is_active = str(request.GET.get("is_active", "") or "").strip().lower()

    page = _safe_int(request.GET.get("page"), 1)
    per_page = _safe_int(request.GET.get("per_page"), 20)
    per_page = min(per_page, 100)

    queryset = (
        User.objects.all()
        .select_related("profile")
        .prefetch_related("groups")
        .order_by("-date_joined", "-id")
    )

    if q:
        queryset = queryset.filter(
            Q(username__icontains=q)
            | Q(email__icontains=q)
            | Q(first_name__icontains=q)
            | Q(last_name__icontains=q)
            | Q(profile__display_name__icontains=q)
            | Q(profile__phone_number__icontains=q)
            | Q(profile__whatsapp_number__icontains=q)
        )

    if user_type:
        queryset = queryset.filter(profile__user_type=user_type)

    if is_active in {"true", "1", "yes"}:
        queryset = queryset.filter(is_active=True)
    elif is_active in {"false", "0", "no"}:
        queryset = queryset.filter(is_active=False)

    total = queryset.count()
    start = (page - 1) * per_page
    end = start + per_page

    users = [_serialize_user(user) for user in queryset[start:end]]

    return JsonResponse(
        {
            "success": True,
            "message": "Users loaded successfully.",
            "results": users,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "total_pages": (total + per_page - 1) // per_page if per_page else 1,
            },
        },
        status=200,
    )