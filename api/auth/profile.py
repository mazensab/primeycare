# ===============================================================
# 📂 الملف: api/auth/profile.py
# 🧭 Primey Care — Auth Profile API
# 🚀 الإصدار: Primey Care Auth Profile API V2.0
# ---------------------------------------------------------------
# ✅ GET current login profile
# ✅ POST update current login profile
# ✅ Updates Django User + UserProfile safely
# ✅ CSRF protected
# ✅ Returns workspace / dashboard_path / permissions
# ✅ Does NOT edit operational actor data directly
# ---------------------------------------------------------------
# القاعدة المعتمدة:
# - صفحة المستخدمين / البروفايل تدير حساب الدخول فقط.
# - بيانات العميل تبقى في Customer.
# - بيانات مقدم الخدمة تبقى في Provider.
# - بيانات المندوب تبقى في Agent.
# - بيانات الوسيط تبقى في Broker.
# ===============================================================

from __future__ import annotations

import json
from typing import Any
from zoneinfo import available_timezones

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods

from auth_center.models import RoleChoices, UserProfile
from auth_center.permissions import (
    build_permissions_payload,
    get_user_permissions,
    get_user_role,
    get_user_workspace,
)

User = get_user_model()


# ===============================================================
# 🧩 Helpers
# ===============================================================

def _json_body(request) -> dict[str, Any]:
    try:
        if not request.body:
            return {}

        parsed = json.loads(request.body.decode("utf-8"))

        return parsed if isinstance(parsed, dict) else {}

    except Exception:
        return {}


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _clean_email(value: Any) -> str:
    return _clean_text(value).lower()


def _safe_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _safe_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _safe_int(value: Any) -> int | None:
    try:
        if value in (None, "", 0, "0"):
            return None

        parsed = int(value)
        return parsed if parsed > 0 else None

    except (TypeError, ValueError):
        return None


def _normalize_lower(value: Any) -> str:
    return str(value or "").strip().lower()


def _normalize_workspace(value: Any) -> str:
    workspace = _normalize_lower(value)

    if workspace in {"company", "center"}:
        return "provider"

    if workspace in {"system", "provider", "customer", "agent"}:
        return workspace

    return "system"


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


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


def _json_success(
    data: dict[str, Any],
    *,
    status: int = 200,
) -> JsonResponse:
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


def _field_was_sent(payload: dict[str, Any], key: str) -> bool:
    return key in payload


def _validate_email_or_error(value: str, field_name: str, errors: dict[str, str]) -> None:
    if not value:
        return

    try:
        validate_email(value)
    except ValidationError:
        errors[field_name] = "Invalid email format."


def _resolve_dashboard_path(workspace: str) -> str:
    mapping = {
        "system": "/system",
        "provider": "/provider",
        "customer": "/customer",
        "agent": "/agent",
    }

    return mapping.get(workspace, "/system")


def _extract_context_ids(profile: UserProfile) -> dict[str, int | None]:
    extra_data = _safe_dict(profile.extra_data or {})

    return {
        "company_id": _safe_int(extra_data.get("company_id") or extra_data.get("company")),
        "provider_id": _safe_int(
            extra_data.get("provider_id")
            or extra_data.get("provider")
            or extra_data.get("service_provider_id")
            or extra_data.get("service_provider")
        ),
        "center_id": _safe_int(extra_data.get("center_id") or extra_data.get("center")),
        "customer_id": _safe_int(extra_data.get("customer_id") or extra_data.get("customer")),
        "agent_id": _safe_int(extra_data.get("agent_id") or extra_data.get("agent")),
        "broker_id": _safe_int(extra_data.get("broker_id") or extra_data.get("broker")),
        "entity_id": _safe_int(extra_data.get("entity_id")),
    }


def _resolve_entity_type_and_id(
    *,
    workspace: str,
    profile: UserProfile,
    context_ids: dict[str, int | None],
) -> tuple[str | None, int | None]:
    extra_data = _safe_dict(profile.extra_data or {})
    explicit_entity_type = _normalize_lower(extra_data.get("entity_type"))

    if explicit_entity_type:
        return explicit_entity_type, context_ids.get("entity_id")

    role = _normalize_lower(profile.role)
    user_type = _normalize_lower(profile.user_type)

    if workspace == "system":
        return "system", None

    if workspace == "provider":
        if context_ids.get("center_id") or user_type == "center":
            return "center", context_ids.get("center_id")
        return "provider", context_ids.get("provider_id")

    if workspace == "customer":
        return "customer", context_ids.get("customer_id")

    if workspace == "agent":
        if context_ids.get("broker_id") or role == "broker_user" or user_type == "broker":
            return "broker", context_ids.get("broker_id")
        return "agent", context_ids.get("agent_id")

    return None, None


def _blocked_profile_fields(payload: dict[str, Any]) -> list[str]:
    blocked = {
        "user_type",
        "role",
        "workspace",
        "extra_data",
        "entity_type",
        "entity_id",
        "company_id",
        "provider_id",
        "center_id",
        "customer_id",
        "agent_id",
        "broker_id",
        "is_superuser",
        "is_staff",
        "is_active",
        "groups",
        "permissions",
        "permission_codes",
    }

    return sorted(key for key in payload.keys() if key in blocked)


def _build_profile_payload(user, profile: UserProfile) -> dict[str, Any]:
    role = get_user_role(user)
    workspace = _normalize_workspace(get_user_workspace(user))
    dashboard_path = _resolve_dashboard_path(workspace)
    permission_codes = sorted(get_user_permissions(user))
    permission_payload = build_permissions_payload(user)
    groups = list(user.groups.values_list("name", flat=True))
    context_ids = _extract_context_ids(profile)

    entity_type, entity_id = _resolve_entity_type_and_id(
        workspace=workspace,
        profile=profile,
        context_ids=context_ids,
    )

    full_name = (user.get_full_name() or "").strip()

    user_payload = {
        "id": user.id,
        "username": user.username,
        "email": user.email or "",
        "first_name": user.first_name or "",
        "last_name": user.last_name or "",
        "full_name": full_name,
        "is_active": bool(user.is_active),
        "is_staff": bool(user.is_staff),
        "is_superuser": bool(user.is_superuser),
        "last_login": _iso_datetime(user.last_login),
        "date_joined": _iso_datetime(getattr(user, "date_joined", None)),
    }

    profile_payload = {
        "id": profile.id,
        "display_name": profile.display_name,
        "avatar_url": profile.avatar_url,
        "bio": profile.bio,
        "phone_number": profile.phone_number,
        "whatsapp_number": profile.whatsapp_number,
        "alternate_email": profile.alternate_email,
        "preferred_language": profile.preferred_language,
        "timezone": profile.timezone,
        "user_type": profile.user_type,
        "role": profile.role,
        "workspace": workspace,
        "is_phone_verified": profile.is_phone_verified,
        "is_whatsapp_verified": profile.is_whatsapp_verified,
        "is_email_verified": profile.is_email_verified,
        "is_profile_completed": profile.is_profile_completed,
        "tags": _safe_list(profile.tags),
        "extra_data": _safe_dict(profile.extra_data),
        "last_profile_update_at": _iso_datetime(profile.last_profile_update_at),
        "created_at": _iso_datetime(getattr(profile, "created_at", None)),
        "updated_at": _iso_datetime(getattr(profile, "updated_at", None)),
    }

    permissions_payload = {
        "is_superuser": bool(user.is_superuser),
        "is_staff": bool(user.is_staff),
        "groups": groups,
        "codes": permission_codes,
    }

    response_payload = {
        "authenticated": True,
        "workspace": workspace,
        "dashboard_path": dashboard_path,
        "redirect_to": dashboard_path,
        "home_path": dashboard_path,

        "role": role,
        "user_type": profile.user_type,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "actor_type": entity_type,
        "actor_id": entity_id,

        "company_id": context_ids.get("company_id"),
        "provider_id": context_ids.get("provider_id"),
        "center_id": context_ids.get("center_id"),
        "customer_id": context_ids.get("customer_id"),
        "agent_id": context_ids.get("agent_id"),
        "broker_id": context_ids.get("broker_id"),

        "permission_codes": permission_codes,
        "permissions": permissions_payload,
        "profile_permissions": {
            **permission_payload.get("profile_permissions", {}),
            "workspace": workspace,
            "extra_data": _safe_dict(profile.extra_data),
        },

        "user": user_payload,
        "profile": profile_payload,
    }

    response_payload["data"] = {
        "authenticated": True,
        "workspace": workspace,
        "dashboard_path": dashboard_path,
        "redirect_to": dashboard_path,
        "role": role,
        "user_type": profile.user_type,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "actor_type": entity_type,
        "actor_id": entity_id,
        "company_id": context_ids.get("company_id"),
        "provider_id": context_ids.get("provider_id"),
        "center_id": context_ids.get("center_id"),
        "customer_id": context_ids.get("customer_id"),
        "agent_id": context_ids.get("agent_id"),
        "broker_id": context_ids.get("broker_id"),
        "user": user_payload,
        "profile": profile_payload,
        "permissions": permissions_payload,
        "permission_codes": permission_codes,
    }

    return response_payload


# ===============================================================
# 🚀 API
# ===============================================================

@login_required
@csrf_protect
@require_http_methods(["GET", "POST"])
def profile_api(request):
    user = request.user
    profile, _ = UserProfile.objects.get_or_create(user=user)

    if request.method == "GET":
        return _json_success(
            _build_profile_payload(user, profile),
            status=200,
        )

    payload = _json_body(request)

    blocked_fields = _blocked_profile_fields(payload)

    first_name = _clean_text(payload.get("first_name"))
    last_name = _clean_text(payload.get("last_name"))
    display_name = _clean_text(payload.get("display_name"))
    email = _clean_email(payload.get("email"))
    phone_number = _clean_text(payload.get("phone_number"))
    whatsapp_number = _clean_text(payload.get("whatsapp_number"))
    alternate_email = _clean_email(payload.get("alternate_email"))
    preferred_language = _clean_text(payload.get("preferred_language"))
    timezone_value = _clean_text(payload.get("timezone"))
    bio = _clean_text(payload.get("bio"))
    avatar_url = _clean_text(payload.get("avatar_url"))

    errors: dict[str, str] = {}

    if _field_was_sent(payload, "email") and email:
        _validate_email_or_error(email, "email", errors)

        email_exists = (
            User.objects
            .filter(email__iexact=email)
            .exclude(id=user.id)
            .exists()
        )
        if email_exists:
            errors["email"] = "This email is already used by another account."

    if _field_was_sent(payload, "alternate_email") and alternate_email:
        _validate_email_or_error(alternate_email, "alternate_email", errors)

    if _field_was_sent(payload, "preferred_language"):
        if preferred_language not in {"ar", "en"}:
            errors["preferred_language"] = "Preferred language must be 'ar' or 'en'."

    if _field_was_sent(payload, "timezone"):
        if timezone_value not in available_timezones():
            errors["timezone"] = "Invalid timezone."

    if errors:
        return _json_error(
            "Validation error.",
            status=400,
            errors=errors,
        )

    with transaction.atomic():
        user_update_fields: list[str] = []

        if _field_was_sent(payload, "first_name"):
            user.first_name = first_name
            user_update_fields.append("first_name")

        if _field_was_sent(payload, "last_name"):
            user.last_name = last_name
            user_update_fields.append("last_name")

        if _field_was_sent(payload, "email"):
            user.email = email
            user_update_fields.append("email")

        if user_update_fields:
            user.save(update_fields=sorted(set(user_update_fields)))

        profile_update_fields: list[str] = []

        if _field_was_sent(payload, "display_name"):
            profile.display_name = (
                display_name
                or (user.get_full_name() or "").strip()
                or user.username
            )
            profile_update_fields.append("display_name")

        elif not profile.display_name:
            profile.display_name = (user.get_full_name() or "").strip() or user.username
            profile_update_fields.append("display_name")

        if _field_was_sent(payload, "phone_number"):
            profile.phone_number = phone_number or None
            profile_update_fields.append("phone_number")

        if _field_was_sent(payload, "whatsapp_number"):
            profile.whatsapp_number = whatsapp_number or None
            profile_update_fields.append("whatsapp_number")

        if _field_was_sent(payload, "alternate_email"):
            profile.alternate_email = alternate_email or (user.email or None)
            profile_update_fields.append("alternate_email")

        elif not profile.alternate_email and user.email:
            profile.alternate_email = user.email
            profile_update_fields.append("alternate_email")

        if _field_was_sent(payload, "preferred_language"):
            profile.preferred_language = preferred_language or "ar"
            profile_update_fields.append("preferred_language")

        if _field_was_sent(payload, "timezone"):
            profile.timezone = timezone_value or "Asia/Riyadh"
            profile_update_fields.append("timezone")

        if _field_was_sent(payload, "bio"):
            profile.bio = bio
            profile_update_fields.append("bio")

        if _field_was_sent(payload, "avatar_url"):
            profile.avatar_url = avatar_url or None
            profile_update_fields.append("avatar_url")

        profile.is_profile_completed = bool(
            profile.display_name
            and (
                user.email
                or profile.alternate_email
                or profile.phone_number
                or profile.whatsapp_number
            )
        )
        profile_update_fields.append("is_profile_completed")

        profile.mark_profile_updated(commit=False)
        profile_update_fields.extend(["last_profile_update_at", "updated_at"])

        profile.save(update_fields=sorted(set(profile_update_fields)))

    response_payload = _build_profile_payload(user, profile)
    response_payload["message"] = "Profile updated successfully."

    if blocked_fields:
        response_payload["ignored_account_fields"] = blocked_fields
        response_payload["data"]["ignored_account_fields"] = blocked_fields

    return _json_success(
        response_payload,
        status=200,
    )