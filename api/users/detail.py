# ===============================================================
# 📂 الملف: api/users/detail.py
# 🧭 Primey Care — User Detail API
# 🚀 الإصدار: Users Detail API V1.1
# ---------------------------------------------------------------
# ✅ GET user details
# ✅ PATCH update user/profile
# ✅ Protected by permissions:
#    - GET   users.view
#    - PATCH users.edit
# ===============================================================

from __future__ import annotations

import json

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods

from auth_center.models import RoleChoices, UserProfile, UserType, resolve_default_role_for_user_type
from auth_center.permissions import PermissionCodes, has_permission

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


def _normalize_upper(value) -> str:
    return _clean_text(value).upper()


def _forbidden(required_permission: str):
    return JsonResponse(
        {
            "success": False,
            "message": "You do not have permission to manage users.",
            "required_permission": required_permission,
        },
        status=403,
    )


def _not_found():
    return JsonResponse(
        {
            "success": False,
            "message": "User not found.",
        },
        status=404,
    )


def _bad_request(message: str, errors: dict | None = None):
    return JsonResponse(
        {
            "success": False,
            "message": message,
            "errors": errors or {},
        },
        status=400,
    )


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
            "avatar_url": profile.avatar_url if profile else None,
            "bio": profile.bio if profile else "",
            "user_type": profile.user_type if profile else "OTHER",
            "role": profile.role if profile else RoleChoices.VIEWER,
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


def _validate_user_type(value: str) -> str:
    normalized = _normalize_upper(value)
    if not normalized:
        return ""

    valid_values = {choice.value for choice in UserType}
    if normalized not in valid_values:
        raise ValidationError(f"Unsupported user_type: {normalized}")

    return normalized


def _validate_role(value: str) -> str:
    normalized = _clean_text(value).lower()
    if not normalized:
        return ""

    valid_values = {choice.value for choice in RoleChoices}
    if normalized not in valid_values:
        raise ValidationError(f"Unsupported role: {normalized}")

    return normalized


@login_required
@require_http_methods(["GET", "PATCH"])
@csrf_protect
def users_detail_api(request, user_id: int):
    required_permission = (
        PermissionCodes.USERS_VIEW
        if request.method == "GET"
        else PermissionCodes.USERS_EDIT
    )

    if not has_permission(request.user, required_permission):
        return _forbidden(required_permission)

    user = (
        User.objects.filter(id=user_id)
        .select_related("profile")
        .prefetch_related("groups")
        .first()
    )

    if not user:
        return _not_found()

    if request.method == "GET":
        return JsonResponse(
            {
                "success": True,
                "message": "User loaded successfully.",
                "user": _serialize_user(user),
            },
            status=200,
        )

    payload = _json_body(request)
    errors = {}

    email = _clean_text(payload.get("email")).lower() if "email" in payload else None
    username = _clean_text(payload.get("username")) if "username" in payload else None
    user_type = _clean_text(payload.get("user_type")) if "user_type" in payload else None
    role = _clean_text(payload.get("role")) if "role" in payload else None

    if email:
        try:
            validate_email(email)
        except ValidationError:
            errors["email"] = "Invalid email format."

        if User.objects.filter(email__iexact=email).exclude(id=user.id).exists():
            errors["email"] = "This email is already used by another user."

    if username:
        if User.objects.filter(username=username).exclude(id=user.id).exists():
            errors["username"] = "This username is already used by another user."

    normalized_user_type = ""
    if user_type is not None:
        try:
            normalized_user_type = _validate_user_type(user_type)
        except ValidationError as exc:
            errors["user_type"] = exc.messages if hasattr(exc, "messages") else str(exc)

    normalized_role = ""
    if role is not None:
        try:
            normalized_role = _validate_role(role)
        except ValidationError as exc:
            errors["role"] = exc.messages if hasattr(exc, "messages") else str(exc)

    preferred_language = _clean_text(payload.get("preferred_language")) if "preferred_language" in payload else None
    if preferred_language and preferred_language not in {"ar", "en"}:
        errors["preferred_language"] = "Preferred language must be 'ar' or 'en'."

    if errors:
        return _bad_request("Validation error.", errors)

    with transaction.atomic():
        user_dirty_fields = []

        if username is not None and username and user.username != username:
            user.username = username
            user_dirty_fields.append("username")

        if email is not None and user.email != email:
            user.email = email
            user_dirty_fields.append("email")

        if "first_name" in payload:
            user.first_name = _clean_text(payload.get("first_name"))
            user_dirty_fields.append("first_name")

        if "last_name" in payload:
            user.last_name = _clean_text(payload.get("last_name"))
            user_dirty_fields.append("last_name")

        if "is_active" in payload:
            if user.id == request.user.id and not bool(payload.get("is_active")):
                return _bad_request(
                    "Validation error.",
                    {"is_active": "You cannot deactivate your own account."},
                )
            user.is_active = bool(payload.get("is_active"))
            user_dirty_fields.append("is_active")

        if "is_staff" in payload:
            user.is_staff = bool(payload.get("is_staff"))
            user_dirty_fields.append("is_staff")

        if "is_superuser" in payload:
            if user.id == request.user.id and not bool(payload.get("is_superuser")):
                return _bad_request(
                    "Validation error.",
                    {"is_superuser": "You cannot remove superuser from your own account."},
                )
            user.is_superuser = bool(payload.get("is_superuser"))
            user_dirty_fields.append("is_superuser")

        if "password" in payload and _clean_text(payload.get("password")):
            password = _clean_text(payload.get("password"))
            if len(password) < 8:
                return _bad_request(
                    "Validation error.",
                    {"password": "Password must be at least 8 characters."},
                )
            user.set_password(password)
            user_dirty_fields.append("password")

        if user_dirty_fields:
            user.save(update_fields=list(dict.fromkeys(user_dirty_fields)))

        profile, _ = UserProfile.objects.get_or_create(user=user)

        profile_dirty_fields = []

        if normalized_user_type:
            profile.user_type = normalized_user_type
            profile_dirty_fields.append("user_type")

        if normalized_role:
            profile.role = normalized_role
            profile_dirty_fields.append("role")
        elif normalized_user_type and "role" not in payload:
            profile.role = resolve_default_role_for_user_type(normalized_user_type)
            profile_dirty_fields.append("role")

        editable_profile_fields = {
            "display_name",
            "avatar_url",
            "bio",
            "phone_number",
            "whatsapp_number",
            "alternate_email",
            "preferred_language",
            "timezone",
        }

        nullable_profile_fields = {
            "avatar_url",
            "phone_number",
            "whatsapp_number",
            "alternate_email",
        }

        for field in editable_profile_fields:
            if field in payload:
                value = _clean_text(payload.get(field))
                setattr(
                    profile,
                    field,
                    value or None if field in nullable_profile_fields else value,
                )
                profile_dirty_fields.append(field)

        if "extra_data" in payload and isinstance(payload.get("extra_data"), dict):
            profile.extra_data = payload.get("extra_data")
            profile_dirty_fields.append("extra_data")

        if "tags" in payload and isinstance(payload.get("tags"), list):
            profile.tags = payload.get("tags")
            profile_dirty_fields.append("tags")

        profile.is_profile_completed = bool(
            profile.display_name
            and (
                user.email
                or profile.alternate_email
                or profile.phone_number
                or profile.whatsapp_number
            )
        )
        profile_dirty_fields.append("is_profile_completed")

        profile.mark_profile_updated(commit=False)
        profile_dirty_fields.extend(["last_profile_update_at", "updated_at"])

        profile.save(update_fields=list(dict.fromkeys(profile_dirty_fields)))

    user.refresh_from_db()

    return JsonResponse(
        {
            "success": True,
            "message": "User updated successfully.",
            "user": _serialize_user(user),
        },
        status=200,
    )