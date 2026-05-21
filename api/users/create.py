# ===============================================================
# 📂 الملف: api/users/create.py
# 🧭 Primey Care — User Create API
# 🚀 الإصدار: Users Create API V1.2 Actor-Link Safe
# ---------------------------------------------------------------
# ✅ Create actor user
# ✅ Uses auth_center.services.create_actor_user
# ✅ Supports:
#    - system users
#    - provider users
#    - customer users
#    - agent users
#    - broker users
# ✅ Protected by permissions: users.create
# ---------------------------------------------------------------
# قاعدة مهمة:
# - صفحة المستخدمين لإدارة حساب الدخول.
# - موظفو النظام يمكن إنشاؤهم من هنا مباشرة.
# - العميل/المندوب/الوسيط/مقدم الخدمة يجب أن يكون لديهم entity_id واضح
#   حتى لا ننشئ حساب دخول مفصول عن الكيان التشغيلي.
# ===============================================================

from __future__ import annotations

import json
from typing import Any

from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST

from auth_center.models import RoleChoices, UserType, resolve_default_role_for_user_type
from auth_center.permissions import PermissionCodes, permission_required
from auth_center.services import create_actor_user


# ===============================================================
# Helpers
# ===============================================================

def _json_body(request) -> dict[str, Any]:
    try:
        if not request.body:
            return {}

        payload = json.loads(request.body.decode("utf-8"))
        return payload if isinstance(payload, dict) else {}

    except Exception:
        return {}


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _clean_email(value: Any) -> str:
    return _clean_text(value).lower()


def _normalize_upper(value: Any) -> str:
    return _clean_text(value).upper()


def _normalize_lower(value: Any) -> str:
    return _clean_text(value).lower()


def _safe_int(value: Any) -> int | None:
    try:
        if value in (None, "", 0, "0"):
            return None

        parsed = int(value)
        return parsed if parsed > 0 else None

    except (TypeError, ValueError):
        return None


def _parse_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default

    if isinstance(value, bool):
        return value

    if isinstance(value, (int, float)):
        return bool(value)

    normalized = str(value).strip().lower()

    if normalized in {"1", "true", "yes", "y", "on", "نعم", "صح", "active"}:
        return True

    if normalized in {"0", "false", "no", "n", "off", "لا", "خطأ", "inactive"}:
        return False

    return default


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


def _enum_values(enum_cls) -> set[str]:
    values: set[str] = set()

    try:
        for choice in enum_cls:
            values.add(str(choice.value))
    except Exception:
        pass

    return values


def _resolve_enum_value(enum_cls, candidates: list[str]) -> str:
    values = _enum_values(enum_cls)

    if not values:
        return ""

    by_upper = {value.upper(): value for value in values}
    by_lower = {value.lower(): value for value in values}

    for candidate in candidates:
        clean = _clean_text(candidate)

        if not clean:
            continue

        if clean in values:
            return clean

        upper = clean.upper()
        lower = clean.lower()

        if upper in by_upper:
            return by_upper[upper]

        if lower in by_lower:
            return by_lower[lower]

    return ""


def _resolve_user_type_alias(value: Any) -> str:
    clean = _clean_text(value)
    upper = clean.upper()
    lower = clean.lower()

    candidates = [clean, upper, lower]

    alias_candidates = {
        "SYSTEM_ADMIN": ["SUPER_ADMIN", "SYSTEM", "STAFF", "OTHER"],
        "SUPER_ADMIN": ["SUPER_ADMIN", "SYSTEM", "STAFF", "OTHER"],
        "SUPERUSER": ["SUPER_ADMIN", "SYSTEM", "STAFF", "OTHER"],
        "ADMIN": ["SUPER_ADMIN", "SYSTEM", "STAFF", "OTHER"],

        "ACCOUNTANT": ["ACCOUNTANT", "STAFF", "SYSTEM", "OTHER"],
        "SUPPORT": ["STAFF", "SYSTEM", "OTHER"],
        "VIEWER": ["OTHER", "STAFF"],

        "PROVIDER_ADMIN": ["PROVIDER", "CENTER"],
        "PROVIDER": ["PROVIDER", "CENTER"],
        "CENTER_ADMIN": ["CENTER", "PROVIDER"],
        "CENTER": ["CENTER", "PROVIDER"],

        "CUSTOMER_USER": ["CUSTOMER"],
        "CUSTOMER": ["CUSTOMER"],
        "CLIENT": ["CUSTOMER"],

        "AGENT_USER": ["AGENT"],
        "AGENT": ["AGENT"],

        "BROKER_USER": ["BROKER"],
        "BROKER": ["BROKER"],
    }

    candidates.extend(alias_candidates.get(upper, []))
    candidates.extend(alias_candidates.get(lower.upper(), []))

    return _resolve_enum_value(UserType, candidates)


def _resolve_role_alias(value: Any, normalized_user_type: str = "") -> str:
    clean = _clean_text(value)
    upper = clean.upper()
    lower = clean.lower()

    candidates = [clean, lower, upper]

    alias_candidates = {
        "SYSTEM_ADMIN": ["system_admin", "viewer"],
        "SUPER_ADMIN": ["system_admin", "viewer"],
        "SUPERUSER": ["system_admin", "viewer"],
        "ADMIN": ["system_admin", "viewer"],

        "ACCOUNTANT": ["accountant", "viewer"],
        "SUPPORT": ["support", "viewer"],
        "VIEWER": ["viewer"],

        "PROVIDER_ADMIN": ["provider_admin", "viewer"],
        "PROVIDER": ["provider_admin", "viewer"],
        "CENTER_ADMIN": ["provider_admin", "viewer"],
        "CENTER": ["provider_admin", "viewer"],

        "CUSTOMER_USER": ["customer_user", "viewer"],
        "CUSTOMER": ["customer_user", "viewer"],
        "CLIENT": ["customer_user", "viewer"],

        "AGENT_USER": ["agent_user", "viewer"],
        "AGENT": ["agent_user", "viewer"],

        "BROKER_USER": ["broker_user", "viewer"],
        "BROKER": ["broker_user", "viewer"],
    }

    candidates.extend(alias_candidates.get(upper, []))

    resolved = _resolve_enum_value(RoleChoices, candidates)
    if resolved:
        return resolved

    if normalized_user_type:
        try:
            default_role = resolve_default_role_for_user_type(normalized_user_type)
            resolved_default = _resolve_enum_value(RoleChoices, [str(default_role)])
            if resolved_default:
                return resolved_default
        except Exception:
            pass

    return ""


def _validation_error_payload(exc: ValidationError) -> dict[str, Any]:
    if hasattr(exc, "message_dict"):
        return exc.message_dict

    if hasattr(exc, "messages"):
        return {"detail": exc.messages}

    return {"detail": [str(exc)]}


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


def _serialize_result(result) -> dict[str, Any]:
    user = result.user
    profile = result.profile

    full_name = ""
    try:
        full_name = (user.get_full_name() or "").strip()
    except Exception:
        full_name = ""

    user_payload: dict[str, Any] = {
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
        "last_login": _iso_datetime(getattr(user, "last_login", None)),
        "date_joined": _iso_datetime(getattr(user, "date_joined", None)),
        "profile": _serialize_profile(profile),

        "created": result.created,
        "group_name": result.group_name,
        "entity_type": result.entity_type,
        "entity_id": result.entity_id,
        "temporary_password": result.temporary_password,
    }

    return user_payload


# ===============================================================
# Entity Safety
# ===============================================================

ENTITY_REQUIRED_BY_USER_TYPE = {
    "CUSTOMER": ("customer", "customer_id"),
    "PROVIDER": ("provider", "provider_id"),
    "CENTER": ("center", "center_id"),
    "AGENT": ("agent", "agent_id"),
    "BROKER": ("broker", "broker_id"),
}

SYSTEM_USER_TYPES = {
    "SUPER_ADMIN",
    "SYSTEM",
    "STAFF",
    "ACCOUNTANT",
    "OTHER",
}


def _resolve_entity_context(
    *,
    payload: dict[str, Any],
    user_type: str,
) -> dict[str, Any]:
    entity_type = _normalize_lower(payload.get("entity_type"))
    entity_id = _safe_int(payload.get("entity_id"))

    customer_id = _safe_int(payload.get("customer_id"))
    provider_id = _safe_int(payload.get("provider_id"))
    center_id = _safe_int(payload.get("center_id"))
    agent_id = _safe_int(payload.get("agent_id"))
    broker_id = _safe_int(payload.get("broker_id"))
    company_id = _safe_int(payload.get("company_id"))

    if entity_id and not entity_type:
        raise ValidationError(
            {
                "entity_type": [
                    "entity_type مطلوب عند إرسال entity_id."
                ]
            }
        )

    if entity_type and not entity_id:
        entity_id_by_type = {
            "customer": customer_id,
            "provider": provider_id,
            "center": center_id,
            "agent": agent_id,
            "broker": broker_id,
            "company": company_id,
        }
        entity_id = entity_id_by_type.get(entity_type)

    required = ENTITY_REQUIRED_BY_USER_TYPE.get(user_type)

    if required:
        required_entity_type, required_id_key = required
        required_id = {
            "customer_id": customer_id,
            "provider_id": provider_id,
            "center_id": center_id,
            "agent_id": agent_id,
            "broker_id": broker_id,
        }.get(required_id_key)

        if not required_id and not (entity_type == required_entity_type and entity_id):
            raise ValidationError(
                {
                    required_id_key: [
                        (
                            f"لا يمكن إنشاء حساب {user_type} من صفحة المستخدمين "
                            "بدون ربطه بالكيان التشغيلي المناسب."
                        )
                    ]
                }
            )

        if not entity_type:
            entity_type = required_entity_type

        if not entity_id:
            entity_id = required_id

    if user_type in SYSTEM_USER_TYPES:
        # موظفو النظام لا يحتاجون entity_id.
        return {
            "entity_type": entity_type or None,
            "entity_id": entity_id,
            "customer_id": customer_id,
            "provider_id": provider_id,
            "center_id": center_id,
            "agent_id": agent_id,
            "broker_id": broker_id,
            "company_id": company_id,
        }

    return {
        "entity_type": entity_type or None,
        "entity_id": entity_id,
        "customer_id": customer_id,
        "provider_id": provider_id,
        "center_id": center_id,
        "agent_id": agent_id,
        "broker_id": broker_id,
        "company_id": company_id,
    }


def _prepare_extra_data(
    *,
    payload: dict[str, Any],
    entity_context: dict[str, Any],
    role: str,
    user_type: str,
) -> dict[str, Any] | None:
    extra_data = payload.get("extra_data") if isinstance(payload.get("extra_data"), dict) else {}

    cleaned_extra = {
        key: value
        for key, value in extra_data.items()
        if value not in (None, "")
    }

    cleaned_extra["role"] = role
    cleaned_extra["user_type"] = user_type

    for key in (
        "customer_id",
        "provider_id",
        "center_id",
        "agent_id",
        "broker_id",
        "company_id",
    ):
        value = entity_context.get(key)
        if value:
            cleaned_extra[key] = value

    entity_type = entity_context.get("entity_type")
    entity_id = entity_context.get("entity_id")

    if entity_type:
        cleaned_extra["entity_type"] = entity_type

    if entity_id:
        cleaned_extra["entity_id"] = entity_id

    notes = _clean_text(payload.get("notes"))
    if notes:
        cleaned_extra["notes"] = notes

    workspace = _normalize_lower(payload.get("workspace"))
    if workspace:
        cleaned_extra["workspace"] = workspace

    return cleaned_extra or None


# ===============================================================
# API
# ===============================================================

@login_required
@require_POST
@csrf_protect
@permission_required(PermissionCodes.USERS_CREATE)
def users_create_api(request):
    payload = _json_body(request)

    raw_user_type = _clean_text(payload.get("user_type"))
    if not raw_user_type:
        return _json_error(
            "Validation error.",
            status=400,
            errors={"user_type": ["user_type is required."]},
        )

    normalized_user_type = _resolve_user_type_alias(raw_user_type)
    if not normalized_user_type:
        return _json_error(
            "Validation error.",
            status=400,
            errors={"user_type": [f"Unsupported user_type: {raw_user_type}"]},
        )

    raw_role = _clean_text(payload.get("role"))
    normalized_role = _resolve_role_alias(raw_role, normalized_user_type) if raw_role else ""

    if not normalized_role:
        normalized_role = str(resolve_default_role_for_user_type(normalized_user_type))

    email = _clean_email(payload.get("email"))
    username = _clean_text(payload.get("username"))
    phone_number = _clean_text(
        payload.get("phone_number")
        or payload.get("phone")
        or payload.get("mobile")
        or payload.get("mobile_number")
    )
    whatsapp_number = _clean_text(
        payload.get("whatsapp_number")
        or payload.get("whatsapp")
        or phone_number
    )

    if not email and not username and not phone_number:
        return _json_error(
            "Validation error.",
            status=400,
            errors={
                "identifier": [
                    "At least one of email, username, or phone_number is required."
                ]
            },
        )

    preferred_language = _clean_text(payload.get("preferred_language")) or "ar"
    if preferred_language not in {"ar", "en"}:
        return _json_error(
            "Validation error.",
            status=400,
            errors={
                "preferred_language": [
                    "preferred_language must be 'ar' or 'en'."
                ]
            },
        )

    try:
        entity_context = _resolve_entity_context(
            payload=payload,
            user_type=normalized_user_type,
        )

        extra_data = _prepare_extra_data(
            payload=payload,
            entity_context=entity_context,
            role=normalized_role,
            user_type=normalized_user_type,
        )

        result = create_actor_user(
            user_type=normalized_user_type,
            role=normalized_role,
            email=email or None,
            username=username or None,
            password=_clean_text(payload.get("password")) or None,
            first_name=_clean_text(payload.get("first_name")) or None,
            last_name=_clean_text(payload.get("last_name")) or None,
            display_name=_clean_text(payload.get("display_name")) or None,
            phone_number=phone_number or None,
            whatsapp_number=whatsapp_number or None,
            alternate_email=_clean_email(payload.get("alternate_email")) or None,
            preferred_language=preferred_language,
            timezone=_clean_text(payload.get("timezone")) or "Asia/Riyadh",
            entity_type=entity_context.get("entity_type"),
            entity_id=entity_context.get("entity_id"),
            customer_id=entity_context.get("customer_id"),
            provider_id=entity_context.get("provider_id"),
            center_id=entity_context.get("center_id"),
            agent_id=entity_context.get("agent_id"),
            broker_id=entity_context.get("broker_id"),
            company_id=entity_context.get("company_id"),
            is_active=_parse_bool(payload.get("is_active"), default=True),
            is_staff=(
                _parse_bool(payload.get("is_staff"), default=False)
                if "is_staff" in payload
                else None
            ),
            is_superuser=(
                _parse_bool(payload.get("is_superuser"), default=False)
                if "is_superuser" in payload
                else None
            ),
            extra_data=extra_data,
            tags=payload.get("tags") if isinstance(payload.get("tags"), list) else None,
            create_group=_parse_bool(payload.get("create_group"), default=True),
            update_existing=_parse_bool(payload.get("update_existing"), default=True),
        )

    except ValidationError as exc:
        return _json_error(
            "Validation error.",
            status=400,
            errors=_validation_error_payload(exc),
        )

    except Exception as exc:
        return _json_error(
            "Unable to create user.",
            status=500,
            errors={"detail": [str(exc)]},
        )

    serialized_user = _serialize_result(result)

    return _json_success(
        {
            "message": result.message,
            "user": serialized_user,
            "item": serialized_user,
            "data": {
                "user": serialized_user,
                "created": result.created,
                "group_name": result.group_name,
                "entity_type": result.entity_type,
                "entity_id": result.entity_id,
                "temporary_password": result.temporary_password,
            },
            "created": result.created,
            "group_name": result.group_name,
            "entity_type": result.entity_type,
            "entity_id": result.entity_id,
            "temporary_password": result.temporary_password,
        },
        status=201 if result.created else 200,
    )