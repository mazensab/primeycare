# ===============================================================
# 📂 الملف: api/users/detail.py
# 🧭 Primey Care — User Detail API
# 🚀 الإصدار: Users Detail API V1.3 Actor-Link Ready
# ---------------------------------------------------------------
# ✅ GET user details
# ✅ PATCH update user/profile
# ✅ صفحة المستخدمين لإدارة حساب الدخول فقط:
#    - تفعيل / تعطيل
#    - تغيير كلمة مرور
#    - تعديل بيانات الدخول
#    - تعديل الدور ونوع المستخدم
# ---------------------------------------------------------------
# ✅ لا يتم تعديل بيانات العميل/المندوب/الوسيط/مقدم الخدمة من هنا
# ✅ يعرض الربط التشغيلي فقط:
#    - Customer.user
#    - Provider.user
#    - Agent.user
#    - Broker.user
# ✅ يدعم broker_user
# ✅ Supports frontend aliases:
#    - phone / mobile -> phone_number
#    - CUSTOMER_USER / AGENT_USER / BROKER_USER / PROVIDER_ADMIN aliases
#    - workspace/status/notes safely through profile.extra_data
# ✅ Protected by permissions:
#    - GET   users.view
#    - PATCH users.edit
# ===============================================================

from __future__ import annotations

import json
from typing import Any

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods

from agents.models import Agent, Broker
from auth_center.models import (
    RoleChoices,
    UserProfile,
    UserType,
    resolve_default_role_for_user_type,
)
from auth_center.permissions import (
    PermissionCodes,
    get_user_role,
    get_user_workspace,
    has_permission,
)
from customers.models import Customer
from providers.models import Provider

User = get_user_model()


# ===============================================================
# Helpers
# ===============================================================

def _json_body(request) -> dict:
    try:
        if not request.body:
            return {}
        payload = json.loads(request.body.decode("utf-8"))
        return payload if isinstance(payload, dict) else {}
    except Exception:
        return {}


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _normalize_upper(value: Any) -> str:
    return _clean_text(value).upper()


def _normalize_lower(value: Any) -> str:
    return _clean_text(value).lower()


def _safe_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _safe_list(value: Any) -> list:
    return value if isinstance(value, list) else []


def _safe_int(value: Any) -> int | None:
    try:
        if value in (None, "", 0, "0"):
            return None
        parsed = int(value)
        return parsed if parsed > 0 else None
    except (TypeError, ValueError):
        return None


def _bool_from_payload(value: Any) -> bool:
    if isinstance(value, bool):
        return value

    cleaned = _normalize_lower(value)

    if cleaned in {"1", "true", "yes", "active", "enabled", "نشط"}:
        return True

    if cleaned in {"0", "false", "no", "inactive", "disabled", "غير نشط"}:
        return False

    return bool(value)


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _forbidden(required_permission: str):
    return JsonResponse(
        {
            "ok": False,
            "success": False,
            "message": "You do not have permission to manage users.",
            "required_permission": required_permission,
        },
        status=403,
        json_dumps_params={"ensure_ascii": False},
    )


def _not_found():
    return JsonResponse(
        {
            "ok": False,
            "success": False,
            "message": "User not found.",
        },
        status=404,
        json_dumps_params={"ensure_ascii": False},
    )


def _bad_request(message: str, errors: dict | None = None):
    return JsonResponse(
        {
            "ok": False,
            "success": False,
            "message": message,
            "errors": errors or {},
        },
        status=400,
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


def _resolve_user_type_alias(value: str) -> str:
    clean = _clean_text(value)
    upper = clean.upper()
    lower = clean.lower()

    candidates = [clean, upper, lower]

    alias_candidates = {
        "SYSTEM_ADMIN": ["SUPER_ADMIN", "SYSTEM", "STAFF", "OTHER"],
        "SUPER_ADMIN": ["SUPER_ADMIN", "SYSTEM", "STAFF", "OTHER"],
        "SUPERUSER": ["SUPER_ADMIN", "SYSTEM", "STAFF", "OTHER"],
        "ADMIN": ["SUPER_ADMIN", "SYSTEM", "STAFF", "OTHER"],

        "PROVIDER_ADMIN": ["PROVIDER", "CENTER", "COMPANY"],
        "PROVIDER": ["PROVIDER", "CENTER", "COMPANY"],
        "CENTER_ADMIN": ["CENTER", "PROVIDER"],
        "CENTER": ["CENTER", "PROVIDER"],

        "CUSTOMER_USER": ["CUSTOMER"],
        "CUSTOMER": ["CUSTOMER"],
        "CLIENT": ["CUSTOMER"],

        "AGENT_USER": ["AGENT"],
        "AGENT": ["AGENT"],

        "BROKER_USER": ["BROKER"],
        "BROKER": ["BROKER"],

        "ACCOUNTANT": ["ACCOUNTANT", "STAFF", "SYSTEM", "OTHER"],
        "SUPPORT": ["STAFF", "SYSTEM", "OTHER"],
        "VIEWER": ["OTHER", "STAFF"],
    }

    candidates.extend(alias_candidates.get(upper, []))
    candidates.extend(alias_candidates.get(lower.upper(), []))

    return _resolve_enum_value(UserType, candidates)


def _resolve_role_alias(value: str, normalized_user_type: str = "") -> str:
    clean = _clean_text(value)
    upper = clean.upper()
    lower = clean.lower()

    candidates = [clean, lower, upper]

    alias_candidates = {
        "SYSTEM_ADMIN": ["system_admin", "viewer"],
        "SUPER_ADMIN": ["system_admin", "viewer"],
        "SUPERUSER": ["system_admin", "viewer"],
        "ADMIN": ["system_admin", "viewer"],

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

        "ACCOUNTANT": ["accountant", "viewer"],
        "SUPPORT": ["support", "viewer"],
        "VIEWER": ["viewer"],
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


def _validate_user_type(value: str) -> str:
    normalized = _clean_text(value)
    if not normalized:
        return ""

    resolved = _resolve_user_type_alias(normalized)
    if not resolved:
        raise ValidationError(f"Unsupported user_type: {normalized}")

    return resolved


def _validate_role(value: str, normalized_user_type: str = "") -> str:
    normalized = _clean_text(value)
    if not normalized:
        return ""

    resolved = _resolve_role_alias(normalized, normalized_user_type)
    if not resolved:
        raise ValidationError(f"Unsupported role: {normalized}")

    return resolved


def _resolve_profile_phone(payload: dict) -> str | None:
    for key in ("phone_number", "phone", "mobile", "mobile_number"):
        if key in payload:
            return _clean_text(payload.get(key))

    return None


def _resolve_profile_whatsapp(payload: dict) -> str | None:
    for key in ("whatsapp_number", "whatsapp", "phone_number", "phone", "mobile", "mobile_number"):
        if key in payload:
            return _clean_text(payload.get(key))

    return None


def _resolve_status_to_is_active(payload: dict) -> bool | None:
    if "is_active" in payload:
        return _bool_from_payload(payload.get("is_active"))

    if "status" in payload:
        status = _normalize_upper(payload.get("status"))

        if status in {"ACTIVE", "ENABLED", "نشط"}:
            return True

        if status in {"INACTIVE", "DISABLED", "غير نشط"}:
            return False

    return None


def _profile_extra_data(profile) -> dict:
    return _safe_dict(getattr(profile, "extra_data", {}) or {}).copy()


# ===============================================================
# Actor Link Helpers
# ===============================================================

def _extract_id_from_profile(profile: Any, *keys: str) -> int | None:
    extra_data = _profile_extra_data(profile) if profile else {}

    for key in keys:
        parsed = _safe_int(extra_data.get(key))
        if parsed:
            return parsed

    return None


def _get_linked_customer(user: Any, profile: Any = None) -> Customer | None:
    customer_id = _extract_id_from_profile(profile, "customer_id", "customer")

    queryset = Customer.objects.select_related("agent", "broker").all()

    if customer_id:
        customer = queryset.filter(pk=customer_id).first()
        if customer:
            return customer

    return queryset.filter(user=user).first()


def _get_linked_provider(user: Any, profile: Any = None) -> Provider | None:
    provider_id = _extract_id_from_profile(
        profile,
        "provider_id",
        "provider",
        "service_provider_id",
    )

    queryset = Provider.objects.all()

    if provider_id:
        provider = queryset.filter(pk=provider_id).first()
        if provider:
            return provider

    return queryset.filter(user=user).first()


def _get_linked_agent(user: Any, profile: Any = None) -> Agent | None:
    agent_id = _extract_id_from_profile(profile, "agent_id", "agent")

    queryset = Agent.objects.select_related("broker").all()

    if agent_id:
        agent = queryset.filter(pk=agent_id).first()
        if agent:
            return agent

    return queryset.filter(user=user).first()


def _get_linked_broker(user: Any, profile: Any = None) -> Broker | None:
    broker_id = _extract_id_from_profile(profile, "broker_id", "broker")

    queryset = Broker.objects.all()

    if broker_id:
        broker = queryset.filter(pk=broker_id).first()
        if broker:
            return broker

    return queryset.filter(user=user).first()


def _serialize_customer(customer: Customer | None) -> dict[str, Any] | None:
    if not customer:
        return None

    agent = getattr(customer, "agent", None)
    broker = getattr(customer, "broker", None)

    return {
        "id": customer.pk,
        "customer_code": getattr(customer, "customer_code", "") or "",
        "display_name": getattr(customer, "display_name", "") or "",
        "full_name": getattr(customer, "full_name", "") or "",
        "status": getattr(customer, "status", "") or "",
        "source": getattr(customer, "source", "") or "",
        "phone_number": getattr(customer, "phone_number", "") or "",
        "whatsapp_number": getattr(customer, "whatsapp_number", "") or "",
        "normalized_phone": getattr(customer, "normalized_phone", "") or "",
        "agent_id": getattr(customer, "agent_id", None),
        "broker_id": getattr(customer, "broker_id", None),
        "agent": (
            {
                "id": agent.pk,
                "name": getattr(agent, "full_name", "") or "",
                "agent_code": getattr(agent, "agent_code", "") or "",
                "code": getattr(agent, "agent_code", "") or "",
            }
            if agent
            else None
        ),
        "broker": (
            {
                "id": broker.pk,
                "name": getattr(broker, "name", "") or "",
                "broker_code": getattr(broker, "broker_code", "") or "",
                "code": getattr(broker, "broker_code", "") or "",
            }
            if broker
            else None
        ),
    }


def _serialize_provider(provider: Provider | None) -> dict[str, Any] | None:
    if not provider:
        return None

    display_name = (
        getattr(provider, "name_ar", "") or
        getattr(provider, "name", "") or
        getattr(provider, "name_en", "") or
        str(provider)
    )

    return {
        "id": provider.pk,
        "name": display_name,
        "display_name": display_name,
        "name_ar": getattr(provider, "name_ar", "") or "",
        "name_en": getattr(provider, "name_en", "") or "",
        "code": getattr(provider, "code", "") or "",
        "provider_type": getattr(provider, "provider_type", "") or "",
        "status": getattr(provider, "status", "") or "",
        "city": getattr(provider, "city", "") or "",
        "region": getattr(provider, "region", "") or "",
        "phone": getattr(provider, "phone", "") or "",
        "mobile": getattr(provider, "mobile", "") or "",
        "email": getattr(provider, "email", "") or "",
    }


def _serialize_agent(agent: Agent | None) -> dict[str, Any] | None:
    if not agent:
        return None

    broker = getattr(agent, "broker", None)

    return {
        "id": agent.pk,
        "name": getattr(agent, "full_name", "") or str(agent),
        "full_name": getattr(agent, "full_name", "") or str(agent),
        "agent_code": getattr(agent, "agent_code", "") or "",
        "code": getattr(agent, "agent_code", "") or "",
        "referral_code": getattr(agent, "referral_code", "") or "",
        "status": getattr(agent, "status", "") or "",
        "phone": getattr(agent, "phone", "") or "",
        "email": getattr(agent, "email", "") or "",
        "city": getattr(agent, "city", "") or "",
        "broker_id": getattr(agent, "broker_id", None),
        "broker": (
            {
                "id": broker.pk,
                "name": getattr(broker, "name", "") or "",
                "broker_code": getattr(broker, "broker_code", "") or "",
                "code": getattr(broker, "broker_code", "") or "",
            }
            if broker
            else None
        ),
    }


def _serialize_broker(broker: Broker | None) -> dict[str, Any] | None:
    if not broker:
        return None

    return {
        "id": broker.pk,
        "name": getattr(broker, "name", "") or str(broker),
        "broker_name": getattr(broker, "name", "") or str(broker),
        "broker_code": getattr(broker, "broker_code", "") or "",
        "code": getattr(broker, "broker_code", "") or "",
        "referral_code": getattr(broker, "referral_code", "") or "",
        "status": getattr(broker, "status", "") or "",
        "phone": getattr(broker, "phone", "") or "",
        "email": getattr(broker, "email", "") or "",
        "city": getattr(broker, "city", "") or "",
    }


def _resolve_entity_payload(
    *,
    user: Any,
    profile: Any,
    role: str,
    workspace: str,
) -> dict[str, Any]:
    customer = _get_linked_customer(user, profile)
    provider = _get_linked_provider(user, profile)
    agent = _get_linked_agent(user, profile)
    broker = _get_linked_broker(user, profile)

    customer_payload = _serialize_customer(customer)
    provider_payload = _serialize_provider(provider)
    agent_payload = _serialize_agent(agent)
    broker_payload = _serialize_broker(broker)

    entity_type: str | None = None
    entity_id: int | None = None

    if workspace == "customer" or role == _normalize_lower(RoleChoices.CUSTOMER_USER):
        entity_type = "customer"
        entity_id = customer.pk if customer else None

    elif workspace == "provider" or role == _normalize_lower(RoleChoices.PROVIDER_ADMIN):
        entity_type = "provider"
        entity_id = provider.pk if provider else None

    elif role == _normalize_lower(RoleChoices.BROKER_USER):
        entity_type = "broker"
        entity_id = broker.pk if broker else None

    elif workspace == "agent" or role == _normalize_lower(RoleChoices.AGENT_USER):
        entity_type = "agent"
        entity_id = agent.pk if agent else None

    elif workspace == "system":
        entity_type = "system"
        entity_id = None

    return {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "customer_id": customer.pk if customer else None,
        "provider_id": provider.pk if provider else None,
        "agent_id": agent.pk if agent else None,
        "broker_id": broker.pk if broker else None,
        "customer": customer_payload,
        "provider": provider_payload,
        "agent": agent_payload,
        "broker": broker_payload,
    }


# ===============================================================
# Serializers
# ===============================================================

def _serialize_user(user) -> dict:
    profile = getattr(user, "profile", None)
    groups = list(user.groups.values_list("name", flat=True))

    extra_data = _profile_extra_data(profile) if profile else {}

    phone_number = profile.phone_number if profile else None
    whatsapp_number = profile.whatsapp_number if profile else None

    user_type = profile.user_type if profile else UserType.OTHER
    role = get_user_role(user)
    workspace = get_user_workspace(user)

    entity_payload = _resolve_entity_payload(
        user=user,
        profile=profile,
        role=role,
        workspace=workspace,
    )

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email or "",
        "first_name": user.first_name or "",
        "last_name": user.last_name or "",
        "full_name": (user.get_full_name() or "").strip(),
        "is_active": user.is_active,
        "status": "ACTIVE" if user.is_active else "INACTIVE",
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "last_login": _iso_datetime(user.last_login),
        "date_joined": _iso_datetime(user.date_joined),
        "groups": groups,

        # ✅ حقول مسطحة لتسهيل قراءة الفرونت
        "user_type": user_type,
        "role": role,
        "workspace": workspace,
        "entity_type": entity_payload["entity_type"],
        "entity_id": entity_payload["entity_id"],

        "customer_id": entity_payload["customer_id"],
        "provider_id": entity_payload["provider_id"],
        "agent_id": entity_payload["agent_id"],
        "broker_id": entity_payload["broker_id"],

        "customer": entity_payload["customer"],
        "provider": entity_payload["provider"],
        "agent": entity_payload["agent"],
        "broker": entity_payload["broker"],

        "phone": phone_number or whatsapp_number or "",
        "mobile": phone_number or whatsapp_number or "",
        "phone_number": phone_number,
        "whatsapp_number": whatsapp_number,
        "notes": extra_data.get("notes") or "",

        "profile": {
            "display_name": profile.display_name if profile else "",
            "avatar_url": profile.avatar_url if profile else None,
            "bio": profile.bio if profile else "",
            "user_type": user_type,
            "role": profile.role if profile else RoleChoices.VIEWER,
            "workspace": workspace,
            "phone_number": phone_number,
            "whatsapp_number": whatsapp_number,
            "alternate_email": profile.alternate_email if profile else None,
            "preferred_language": profile.preferred_language if profile else "ar",
            "timezone": profile.timezone if profile else "Asia/Riyadh",
            "is_phone_verified": profile.is_phone_verified if profile else False,
            "is_whatsapp_verified": profile.is_whatsapp_verified if profile else False,
            "is_email_verified": profile.is_email_verified if profile else False,
            "is_profile_completed": profile.is_profile_completed if profile else False,
            "extra_data": extra_data,
            "tags": profile.tags if profile else [],
        },
    }


# ===============================================================
# Update Helpers
# ===============================================================

ENTITY_LINK_FIELDS = {
    "customer_id",
    "customer",
    "provider_id",
    "provider",
    "agent_id",
    "agent",
    "broker_id",
    "broker",
    "entity_id",
    "entity_type",
}


def _sync_profile_extra_data(
    *,
    profile: UserProfile,
    payload: dict,
) -> tuple[dict, list[str]]:
    extra_data = _profile_extra_data(profile)
    ignored_entity_fields = sorted(key for key in payload.keys() if key in ENTITY_LINK_FIELDS)

    # صفحة المستخدمين لا تعدّل روابط الكيانات التشغيلية.
    # الربط يتم من صفحات الكيان نفسه:
    # - المندوب من صفحة المندوب
    # - الوسيط من صفحة الوسيط
    # - مقدم الخدمة من العقد
    # - العميل من التسجيل/OTP أو صفحة العميل
    for key in ignored_entity_fields:
        pass

    if "workspace" in payload:
        workspace = _clean_text(payload.get("workspace"))
        if workspace:
            extra_data["workspace"] = workspace
        else:
            extra_data.pop("workspace", None)

    if "notes" in payload:
        notes = _clean_text(payload.get("notes"))
        if notes:
            extra_data["notes"] = notes
        else:
            extra_data.pop("notes", None)

    if "extra_data" in payload and isinstance(payload.get("extra_data"), dict):
        incoming_extra = payload.get("extra_data") or {}
        safe_extra = {
            key: value
            for key, value in incoming_extra.items()
            if key not in ENTITY_LINK_FIELDS
        }

        extra_data = {
            **extra_data,
            **safe_extra,
        }

    return extra_data, ignored_entity_fields


# ===============================================================
# API
# ===============================================================

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
        serialized_user = _serialize_user(user)

        return JsonResponse(
            {
                "ok": True,
                "success": True,
                "message": "User loaded successfully.",
                "user": serialized_user,
                "item": serialized_user,
                "data": serialized_user,
            },
            status=200,
            json_dumps_params={"ensure_ascii": False},
        )

    payload = _json_body(request)
    errors: dict[str, Any] = {}

    email = _clean_text(payload.get("email")).lower() if "email" in payload else None
    username = _clean_text(payload.get("username")) if "username" in payload else None
    user_type = _clean_text(payload.get("user_type")) if "user_type" in payload else None
    role = _clean_text(payload.get("role")) if "role" in payload else None
    preferred_language = (
        _clean_text(payload.get("preferred_language"))
        if "preferred_language" in payload
        else None
    )

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
            errors["user_type"] = (
                exc.messages if hasattr(exc, "messages") else str(exc)
            )

    normalized_role = ""
    if role is not None:
        try:
            normalized_role = _validate_role(role, normalized_user_type)
        except ValidationError as exc:
            errors["role"] = (
                exc.messages if hasattr(exc, "messages") else str(exc)
            )

    if preferred_language and preferred_language not in {"ar", "en"}:
        errors["preferred_language"] = "Preferred language must be 'ar' or 'en'."

    if errors:
        return _bad_request("Validation error.", errors)

    ignored_entity_fields: list[str] = []

    with transaction.atomic():
        user_dirty_fields: list[str] = []

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

        next_is_active = _resolve_status_to_is_active(payload)
        if next_is_active is not None:
            if user.id == request.user.id and not next_is_active:
                return _bad_request(
                    "Validation error.",
                    {"is_active": "You cannot deactivate your own account."},
                )

            user.is_active = next_is_active
            user_dirty_fields.append("is_active")

        if "is_staff" in payload:
            user.is_staff = _bool_from_payload(payload.get("is_staff"))
            user_dirty_fields.append("is_staff")

        if "is_superuser" in payload:
            next_is_superuser = _bool_from_payload(payload.get("is_superuser"))

            if user.id == request.user.id and not next_is_superuser:
                return _bad_request(
                    "Validation error.",
                    {
                        "is_superuser": "You cannot remove superuser from your own account."
                    },
                )

            user.is_superuser = next_is_superuser
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
        profile_dirty_fields: list[str] = []

        if normalized_user_type:
            profile.user_type = normalized_user_type
            profile_dirty_fields.append("user_type")

        if normalized_role:
            profile.role = normalized_role
            profile_dirty_fields.append("role")
        elif normalized_user_type and "role" not in payload:
            profile.role = resolve_default_role_for_user_type(normalized_user_type)
            profile_dirty_fields.append("role")

        phone_number = _resolve_profile_phone(payload)
        if phone_number is not None:
            profile.phone_number = phone_number or None
            profile_dirty_fields.append("phone_number")

        whatsapp_number = _resolve_profile_whatsapp(payload)
        if whatsapp_number is not None:
            profile.whatsapp_number = whatsapp_number or None
            profile_dirty_fields.append("whatsapp_number")

        editable_profile_fields = {
            "display_name",
            "avatar_url",
            "bio",
            "alternate_email",
            "preferred_language",
            "timezone",
        }

        nullable_profile_fields = {
            "avatar_url",
            "alternate_email",
        }

        for field in editable_profile_fields:
            if field in payload:
                value = _clean_text(payload.get(field))

                if field in nullable_profile_fields:
                    setattr(profile, field, value or None)
                else:
                    setattr(profile, field, value)

                profile_dirty_fields.append(field)

        extra_data, ignored_entity_fields = _sync_profile_extra_data(
            profile=profile,
            payload=payload,
        )

        if extra_data != _profile_extra_data(profile):
            profile.extra_data = extra_data
            profile_dirty_fields.append("extra_data")

        if "tags" in payload and isinstance(payload.get("tags"), list):
            profile.tags = _safe_list(payload.get("tags"))
            profile_dirty_fields.append("tags")

        display_name = _clean_text(getattr(profile, "display_name", ""))

        profile.is_profile_completed = bool(
            display_name
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

    user = (
        User.objects.filter(id=user_id)
        .select_related("profile")
        .prefetch_related("groups")
        .first()
    )

    serialized_user = _serialize_user(user)

    response_payload = {
        "ok": True,
        "success": True,
        "message": "User updated successfully.",
        "user": serialized_user,
        "item": serialized_user,
        "data": serialized_user,
    }

    if ignored_entity_fields:
        response_payload["ignored_entity_fields"] = ignored_entity_fields

    return JsonResponse(
        response_payload,
        status=200,
        json_dumps_params={"ensure_ascii": False},
    )