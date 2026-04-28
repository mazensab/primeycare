# ===============================================================
# 📂 الملف: api/users/create.py
# 🧭 Primey Care — User Create API
# 🚀 الإصدار: Users Create API V1.1
# ---------------------------------------------------------------
# ✅ Create actor user
# ✅ Uses auth_center.services.create_actor_user
# ✅ Supports system / provider / customer / agent users
# ✅ Protected by permissions: users.create
# ===============================================================

from __future__ import annotations

import json

from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST

from auth_center.permissions import PermissionCodes, permission_required
from auth_center.services import create_actor_user


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


def _safe_int(value):
    try:
        if value in (None, "", 0, "0"):
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _bad_request(message: str, errors: dict | None = None):
    return JsonResponse(
        {
            "success": False,
            "message": message,
            "errors": errors or {},
        },
        status=400,
    )


def _serialize_result(result) -> dict:
    user = result.user
    profile = result.profile

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
        "profile": {
            "display_name": profile.display_name,
            "user_type": profile.user_type,
            "role": profile.role,
            "phone_number": profile.phone_number,
            "whatsapp_number": profile.whatsapp_number,
            "alternate_email": profile.alternate_email,
            "preferred_language": profile.preferred_language,
            "timezone": profile.timezone,
            "extra_data": profile.extra_data,
            "tags": profile.tags,
        },
        "created": result.created,
        "group_name": result.group_name,
        "entity_type": result.entity_type,
        "entity_id": result.entity_id,
        "temporary_password": result.temporary_password,
    }


@login_required
@require_POST
@csrf_protect
@permission_required(PermissionCodes.USERS_CREATE)
def users_create_api(request):
    payload = _json_body(request)

    user_type = _normalize_upper(payload.get("user_type"))
    if not user_type:
        return _bad_request(
            "Validation error.",
            {"user_type": "user_type is required."},
        )

    email = _clean_text(payload.get("email")).lower()
    username = _clean_text(payload.get("username"))
    phone_number = _clean_text(payload.get("phone_number"))

    if not email and not username and not phone_number:
        return _bad_request(
            "Validation error.",
            {
                "identifier": "At least one of email, username, or phone_number is required.",
            },
        )

    try:
        result = create_actor_user(
            user_type=user_type,
            role=_clean_text(payload.get("role")).lower() or None,
            email=email or None,
            username=username or None,
            password=_clean_text(payload.get("password")) or None,
            first_name=_clean_text(payload.get("first_name")) or None,
            last_name=_clean_text(payload.get("last_name")) or None,
            display_name=_clean_text(payload.get("display_name")) or None,
            phone_number=phone_number or None,
            whatsapp_number=_clean_text(payload.get("whatsapp_number")) or None,
            alternate_email=_clean_text(payload.get("alternate_email")).lower() or None,
            preferred_language=_clean_text(payload.get("preferred_language")) or "ar",
            timezone=_clean_text(payload.get("timezone")) or "Asia/Riyadh",
            entity_type=_clean_text(payload.get("entity_type")) or None,
            entity_id=_safe_int(payload.get("entity_id")),
            customer_id=_safe_int(payload.get("customer_id")),
            provider_id=_safe_int(payload.get("provider_id")),
            center_id=_safe_int(payload.get("center_id")),
            agent_id=_safe_int(payload.get("agent_id")),
            broker_id=_safe_int(payload.get("broker_id")),
            company_id=_safe_int(payload.get("company_id")),
            is_active=bool(payload.get("is_active", True)),
            is_staff=payload.get("is_staff") if "is_staff" in payload else None,
            is_superuser=payload.get("is_superuser") if "is_superuser" in payload else None,
            extra_data=payload.get("extra_data") if isinstance(payload.get("extra_data"), dict) else None,
            tags=payload.get("tags") if isinstance(payload.get("tags"), list) else None,
            create_group=bool(payload.get("create_group", True)),
            update_existing=bool(payload.get("update_existing", True)),
        )
    except ValidationError as exc:
        return _bad_request(
            "Validation error.",
            {"detail": exc.messages if hasattr(exc, "messages") else str(exc)},
        )
    except Exception as exc:
        return JsonResponse(
            {
                "success": False,
                "message": "Unable to create user.",
                "errors": {"detail": str(exc)},
            },
            status=500,
        )

    return JsonResponse(
        {
            "success": True,
            "message": result.message,
            "user": _serialize_result(result),
        },
        status=201 if result.created else 200,
    )