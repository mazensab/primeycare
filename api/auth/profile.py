# ===============================================================
# 📂 الملف: api/auth/profile.py
# 🧭 Primey Care — Auth Profile API
# ---------------------------------------------------------------
# ✅ GET current profile
# ✅ POST update current profile
# ✅ Updates Django user + UserProfile safely
# ===============================================================

from __future__ import annotations

import json
from zoneinfo import available_timezones

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from auth_center.models import UserProfile

User = get_user_model()


def _json_body(request) -> dict:
    try:
        if not request.body:
            return {}
        return json.loads(request.body.decode("utf-8"))
    except Exception:
        return {}


def _clean_text(value: str | None) -> str:
    return (value or "").strip()


def _bad_request(message: str, errors: dict | None = None):
    return JsonResponse(
        {
            "success": False,
            "message": message,
            "errors": errors or {},
        },
        status=400,
    )


@login_required
@require_http_methods(["GET", "POST"])
def profile_api(request):
    user = request.user
    profile, _ = UserProfile.objects.get_or_create(user=user)

    if request.method == "GET":
        return JsonResponse(
            {
                "success": True,
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email or "",
                    "first_name": user.first_name or "",
                    "last_name": user.last_name or "",
                    "full_name": (user.get_full_name() or "").strip(),
                },
                "profile": {
                    "display_name": profile.display_name,
                    "avatar_url": profile.avatar_url,
                    "bio": profile.bio,
                    "phone_number": profile.phone_number,
                    "whatsapp_number": profile.whatsapp_number,
                    "alternate_email": profile.alternate_email,
                    "preferred_language": profile.preferred_language,
                    "timezone": profile.timezone,
                    "user_type": profile.user_type,
                    "is_phone_verified": profile.is_phone_verified,
                    "is_whatsapp_verified": profile.is_whatsapp_verified,
                    "is_email_verified": profile.is_email_verified,
                    "is_profile_completed": profile.is_profile_completed,
                    "tags": profile.tags,
                    "extra_data": profile.extra_data,
                },
            },
            status=200,
        )

    payload = _json_body(request)

    first_name = _clean_text(payload.get("first_name"))
    last_name = _clean_text(payload.get("last_name"))
    display_name = _clean_text(payload.get("display_name"))
    email = _clean_text(payload.get("email")).lower()
    phone_number = _clean_text(payload.get("phone_number"))
    whatsapp_number = _clean_text(payload.get("whatsapp_number"))
    alternate_email = _clean_text(payload.get("alternate_email")).lower()
    preferred_language = _clean_text(payload.get("preferred_language")) or "ar"
    timezone_value = _clean_text(payload.get("timezone")) or "Asia/Riyadh"
    bio = _clean_text(payload.get("bio"))
    avatar_url = _clean_text(payload.get("avatar_url"))

    errors = {}

    if email:
        try:
            validate_email(email)
        except ValidationError:
            errors["email"] = "Invalid email format."

        email_exists = (
            User.objects.filter(email__iexact=email)
            .exclude(id=user.id)
            .exists()
        )
        if email_exists:
            errors["email"] = "This email is already used by another account."

    if alternate_email:
        try:
            validate_email(alternate_email)
        except ValidationError:
            errors["alternate_email"] = "Invalid alternate email format."

    if preferred_language not in {"ar", "en"}:
        errors["preferred_language"] = "Preferred language must be 'ar' or 'en'."

    if timezone_value not in available_timezones():
        errors["timezone"] = "Invalid timezone."

    if errors:
        return _bad_request("Validation error.", errors)

    with transaction.atomic():
        user.first_name = first_name
        user.last_name = last_name
        if email:
            user.email = email
        user.save(update_fields=["first_name", "last_name", "email"])

        profile.display_name = display_name or (user.get_full_name() or "").strip() or user.username
        profile.phone_number = phone_number or None
        profile.whatsapp_number = whatsapp_number or None
        profile.alternate_email = alternate_email or (user.email or None)
        profile.preferred_language = preferred_language
        profile.timezone = timezone_value
        profile.bio = bio
        profile.avatar_url = avatar_url or None
        profile.is_profile_completed = bool(profile.display_name and (user.email or profile.alternate_email))
        profile.mark_profile_updated(commit=False)
        profile.save(
            update_fields=[
                "display_name",
                "phone_number",
                "whatsapp_number",
                "alternate_email",
                "preferred_language",
                "timezone",
                "bio",
                "avatar_url",
                "is_profile_completed",
                "last_profile_update_at",
                "updated_at",
            ]
        )

    return JsonResponse(
        {
            "success": True,
            "message": "Profile updated successfully.",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email or "",
                "first_name": user.first_name or "",
                "last_name": user.last_name or "",
                "full_name": (user.get_full_name() or "").strip(),
            },
            "profile": {
                "display_name": profile.display_name,
                "avatar_url": profile.avatar_url,
                "bio": profile.bio,
                "phone_number": profile.phone_number,
                "whatsapp_number": profile.whatsapp_number,
                "alternate_email": profile.alternate_email,
                "preferred_language": profile.preferred_language,
                "timezone": profile.timezone,
                "user_type": profile.user_type,
                "is_profile_completed": profile.is_profile_completed,
                "last_profile_update_at": profile.last_profile_update_at.isoformat() if profile.last_profile_update_at else None,
            },
        },
        status=200,
    )