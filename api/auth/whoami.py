# ===============================================================
# 📂 الملف: api/auth/whoami.py
# 🧭 Primey Care — Auth WhoAmI API
# 🚀 الإصدار: Primey Care WhoAmI V1.3
# ---------------------------------------------------------------
# ✅ Returns current authenticated user context
# ✅ Returns anonymous-safe payload when not authenticated
# ✅ Returns normalized workspace / redirect payload
# ✅ Returns role + permission codes for Frontend Guards
# ✅ Uses auth_center.permissions as the single permissions source
# ✅ Compatible with frontend login + middleware guards
# ✅ Compatible with Primey Care workspaces:
#    /system
#    /provider
#    /customer
#    /agent
# ===============================================================

from __future__ import annotations

from typing import Any

from django.http import JsonResponse
from django.views.decorators.http import require_GET

from auth_center.models import ActiveUserSession, RoleChoices, UserProfile
from auth_center.permissions import (
    build_permissions_payload,
    get_user_permissions,
    get_user_role,
    get_user_workspace,
)


# ===============================================================
# 🧩 Role / Workspace Constants
# ===============================================================

SYSTEM_ROLE_NAMES = {
    "SYSTEM",
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "SUPPORT",
    "INTERNAL",
    "ADMIN",
    "STAFF",
    "ACCOUNTANT",
    "FINANCE",
    "FINANCE_MANAGER",
    "TREASURY",
    "VIEWER",
}

SYSTEM_PERMISSION_ROLES = {
    str(RoleChoices.SYSTEM_ADMIN).lower(),
    str(RoleChoices.ACCOUNTANT).lower(),
    str(RoleChoices.SUPPORT).lower(),
    str(RoleChoices.VIEWER).lower(),
}

ACCOUNTANT_ROLE_NAMES = {
    "ACCOUNTANT",
    "FINANCE",
    "FINANCE_MANAGER",
    "TREASURY",
}

# توافق خلفي فقط، لا نستخدمه كمساحة واجهة جديدة.
COMPANY_ROLE_NAMES = {
    "COMPANY",
    "COMPANY_ADMIN",
    "COMPANY_OWNER",
    "OWNER",
    "HR",
}

PROVIDER_ROLE_NAMES = {
    "PROVIDER",
    "PROVIDER_ADMIN",
    "CENTER",
    "CENTER_ADMIN",
    "SERVICE_PROVIDER",
}

CENTER_ROLE_NAMES = {
    "CENTER",
    "CENTER_ADMIN",
}

CUSTOMER_ROLE_NAMES = {
    "CUSTOMER",
    "CUSTOMER_USER",
}

AGENT_ROLE_NAMES = {
    "AGENT",
    "BROKER",
    "AGENT_ADMIN",
    "BROKER_ADMIN",
    "AGENT_USER",
}

BROKER_ROLE_NAMES = {
    "BROKER",
    "BROKER_ADMIN",
}


# ===============================================================
# 🧩 Helpers
# ===============================================================

def _safe_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _safe_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _safe_int(value: Any) -> int | None:
    try:
        if value in (None, "", 0, "0"):
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _normalize_upper(value: Any) -> str:
    return str(value or "").strip().upper()


def _normalize_lower(value: Any) -> str:
    return str(value or "").strip().lower()


def _normalize_workspace(value: Any) -> str:
    workspace = _normalize_lower(value)

    if workspace in {"company", "center"}:
        return "provider"

    if workspace in {"system", "provider", "customer", "agent"}:
        return workspace

    return "system"


def _resolve_context_ids(
    profile: UserProfile | None,
) -> tuple[
    int | None,
    int | None,
    int | None,
    int | None,
    int | None,
    int | None,
]:
    """
    قراءة معرفات السياق من extra_data أو من خصائص مباشرة إن وُجدت.

    الترتيب:
    company_id   -> توافق خلفي فقط
    provider_id  -> مقدم خدمة
    center_id    -> مركز
    customer_id  -> عميل
    agent_id     -> مندوب
    broker_id    -> وكيل
    """
    if not profile:
        return None, None, None, None, None, None

    extra_data = _safe_dict(getattr(profile, "extra_data", {}) or {})

    company_id = _safe_int(
        extra_data.get("company_id")
        or extra_data.get("company")
        or getattr(profile, "company_id", None)
    )

    provider_id = _safe_int(
        extra_data.get("provider_id")
        or extra_data.get("provider")
        or extra_data.get("service_provider_id")
        or extra_data.get("service_provider")
        or getattr(profile, "provider_id", None)
    )

    center_id = _safe_int(
        extra_data.get("center_id")
        or extra_data.get("center")
        or getattr(profile, "center_id", None)
    )

    customer_id = _safe_int(
        extra_data.get("customer_id")
        or extra_data.get("customer")
        or getattr(profile, "customer_id", None)
    )

    agent_id = _safe_int(
        extra_data.get("agent_id")
        or extra_data.get("agent")
        or getattr(profile, "agent_id", None)
    )

    broker_id = _safe_int(
        extra_data.get("broker_id")
        or extra_data.get("broker")
        or getattr(profile, "broker_id", None)
    )

    return company_id, provider_id, center_id, customer_id, agent_id, broker_id


def _resolve_system_user(
    *,
    user: Any,
    profile: UserProfile | None,
    groups: list[str],
    role: str,
) -> bool:
    """
    تحديد هل المستخدم من مساحة النظام أم لا.

    يدخل /system:
    - superuser
    - staff
    - role من أدوار النظام الجديدة:
      system_admin / accountant / support / viewer
    - user_type قديم من أدوار النظام
    - أي مجموعة قديمة من مجموعات النظام
    """
    if bool(getattr(user, "is_superuser", False)) or bool(getattr(user, "is_staff", False)):
        return True

    normalized_role = _normalize_lower(role)
    if normalized_role in SYSTEM_PERMISSION_ROLES:
        return True

    normalized_groups = {_normalize_upper(item) for item in groups}
    if normalized_groups & SYSTEM_ROLE_NAMES:
        return True

    if normalized_groups & ACCOUNTANT_ROLE_NAMES:
        return True

    if profile:
        user_type = _normalize_upper(getattr(profile, "user_type", ""))
        if user_type in SYSTEM_ROLE_NAMES or user_type in ACCOUNTANT_ROLE_NAMES:
            return True

    return False


def _resolve_workspace(
    *,
    fallback_workspace: str,
    is_system_user: bool,
    provider_id: int | None,
    center_id: int | None,
    customer_id: int | None,
    agent_id: int | None,
    broker_id: int | None,
    role: str,
    user_type: str,
) -> str:
    """
    Primey Care workspace resolver.

    المساحات الرسمية:
    - system
    - provider
    - customer
    - agent

    ملاحظة:
    company/center توافق خلفي ويتم تحويلهما إلى provider.
    """
    normalized_role = _normalize_upper(role)
    normalized_user_type = _normalize_upper(user_type)
    normalized_fallback_workspace = _normalize_workspace(fallback_workspace)

    if is_system_user:
        return "system"

    if (
        provider_id
        or center_id
        or normalized_role in PROVIDER_ROLE_NAMES
        or normalized_role in CENTER_ROLE_NAMES
        or normalized_user_type in PROVIDER_ROLE_NAMES
        or normalized_user_type in CENTER_ROLE_NAMES
        or normalized_fallback_workspace == "provider"
    ):
        return "provider"

    if (
        customer_id
        or normalized_role in CUSTOMER_ROLE_NAMES
        or normalized_user_type in CUSTOMER_ROLE_NAMES
        or normalized_fallback_workspace == "customer"
    ):
        return "customer"

    if (
        agent_id
        or broker_id
        or normalized_role in AGENT_ROLE_NAMES
        or normalized_role in BROKER_ROLE_NAMES
        or normalized_user_type in AGENT_ROLE_NAMES
        or normalized_user_type in BROKER_ROLE_NAMES
        or normalized_fallback_workspace == "agent"
    ):
        return "agent"

    if normalized_role in COMPANY_ROLE_NAMES or normalized_user_type in COMPANY_ROLE_NAMES:
        return "provider"

    return normalized_fallback_workspace


def _resolve_dashboard_path(workspace: str) -> str:
    """
    مسار الداشبورد النهائي بعد تسجيل الدخول.
    """
    mapping = {
        "system": "/system",
        "provider": "/provider",
        "customer": "/customer",
        "agent": "/agent",
    }
    return mapping.get(workspace, "/system")


def _resolve_entity(
    *,
    workspace: str,
    role: str,
    user_type: str,
    provider_id: int | None,
    center_id: int | None,
    customer_id: int | None,
    agent_id: int | None,
    broker_id: int | None,
) -> tuple[str | None, int | None]:
    """
    إرجاع entity_type / entity_id بشكل موحد للفرونت.

    أمثلة:
    customer_user -> customer / customer_id
    provider_admin -> provider أو center
    agent_user -> agent أو broker
    system_admin/accountant/support/viewer -> system / None
    """
    normalized_role = _normalize_upper(role)
    normalized_user_type = _normalize_upper(user_type)

    if workspace == "system":
        return "system", None

    if workspace == "provider":
        if center_id or normalized_role in CENTER_ROLE_NAMES or normalized_user_type in CENTER_ROLE_NAMES:
            return "center", center_id
        return "provider", provider_id

    if workspace == "customer":
        return "customer", customer_id

    if workspace == "agent":
        if broker_id or normalized_role in BROKER_ROLE_NAMES or normalized_user_type in BROKER_ROLE_NAMES:
            return "broker", broker_id
        return "agent", agent_id

    return None, None


def _resolve_scope_type(
    *,
    is_system_user: bool,
    entity_type: str | None,
    role: str,
) -> str:
    if is_system_user:
        return "SYSTEM"

    if entity_type:
        return _normalize_upper(entity_type)

    return _normalize_upper(role or "OTHER")


def _anonymous_payload() -> dict[str, Any]:
    return {
        "authenticated": False,
        "workspace": None,
        "dashboard_path": "/login",
        "is_system_user": False,
        "role": None,
        "user_type": None,
        "scope_type": None,
        "entity_type": None,
        "entity_id": None,

        "company_id": None,
        "provider_id": None,
        "center_id": None,
        "customer_id": None,
        "agent_id": None,
        "broker_id": None,

        "is_superuser": False,
        "is_staff": False,

        "user": None,
        "profile": None,
        "session": None,

        "permission_codes": [],
        "permissions": {
            "is_superuser": False,
            "is_staff": False,
            "groups": [],
            "codes": [],
        },
        "profile_permissions": {
            "display_name": "",
            "user_type": "",
            "role": RoleChoices.VIEWER,
            "workspace": None,
            "preferred_language": "ar",
            "timezone": "Asia/Riyadh",
            "extra_data": {},
        },
    }


def _touch_active_session(
    *,
    user: Any,
    session_key: str | None,
    request: Any,
) -> ActiveUserSession | None:
    if not session_key:
        return None

    active_session = ActiveUserSession.objects.filter(
        session_key=session_key,
        user=user,
        is_active=True,
    ).first()

    if not active_session:
        return None

    if not active_session.is_current:
        active_session.is_current = True
        active_session.save(update_fields=["is_current", "last_seen"])
    else:
        active_session.save(update_fields=["last_seen"])

    return active_session


# ===============================================================
# 🚀 API
# ===============================================================

@require_GET
def whoami_api(request):
    user = request.user

    if not user.is_authenticated:
        return JsonResponse(_anonymous_payload(), status=200)

    profile = UserProfile.objects.filter(user=user).first()
    session_key = request.session.session_key

    active_session = _touch_active_session(
        user=user,
        session_key=session_key,
        request=request,
    )

    full_name = (user.get_full_name() or "").strip()
    groups = list(user.groups.values_list("name", flat=True))

    (
        company_id,
        provider_id,
        center_id,
        customer_id,
        agent_id,
        broker_id,
    ) = _resolve_context_ids(profile)

    permission_payload = build_permissions_payload(user)

    role = get_user_role(user)
    fallback_workspace = get_user_workspace(user)
    user_type = _normalize_upper(getattr(profile, "user_type", "OTHER")) if profile else "OTHER"
    permission_codes = sorted(get_user_permissions(user))

    is_system_user = _resolve_system_user(
        user=user,
        profile=profile,
        groups=groups,
        role=role,
    )

    workspace = _resolve_workspace(
        fallback_workspace=fallback_workspace,
        is_system_user=is_system_user,
        provider_id=provider_id,
        center_id=center_id,
        customer_id=customer_id,
        agent_id=agent_id,
        broker_id=broker_id,
        role=role,
        user_type=user_type,
    )

    dashboard_path = _resolve_dashboard_path(workspace)

    entity_type, entity_id = _resolve_entity(
        workspace=workspace,
        role=role,
        user_type=user_type,
        provider_id=provider_id,
        center_id=center_id,
        customer_id=customer_id,
        agent_id=agent_id,
        broker_id=broker_id,
    )

    scope_type = _resolve_scope_type(
        is_system_user=is_system_user,
        entity_type=entity_type,
        role=role,
    )

    profile_extra_data = _safe_dict(profile.extra_data if profile else {})
    profile_tags = _safe_list(profile.tags if profile else [])

    return JsonResponse(
        {
            "authenticated": True,

            # ---------------------------------------------------
            # ✅ Normalized top-level fields for frontend
            # ---------------------------------------------------
            "workspace": workspace,
            "dashboard_path": dashboard_path,
            "is_system_user": is_system_user,
            "role": role,
            "user_type": user_type,
            "scope_type": scope_type,
            "entity_type": entity_type,
            "entity_id": entity_id,

            # قائمة مباشرة للفرونت حتى يستخدم:
            # session.permission_codes.includes("customers.create")
            "permission_codes": permission_codes,

            # ---------------------------------------------------
            # ✅ Context IDs
            # ---------------------------------------------------
            "company_id": company_id,
            "provider_id": provider_id,
            "center_id": center_id,
            "customer_id": customer_id,
            "agent_id": agent_id,
            "broker_id": broker_id,

            # ---------------------------------------------------
            # ✅ Django user flags
            # ---------------------------------------------------
            "is_superuser": bool(user.is_superuser),
            "is_staff": bool(user.is_staff),

            # ---------------------------------------------------
            # ✅ User payload
            # ---------------------------------------------------
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email or "",
                "first_name": user.first_name or "",
                "last_name": user.last_name or "",
                "full_name": full_name,
                "last_login": user.last_login.isoformat() if user.last_login else None,
            },

            # ---------------------------------------------------
            # ✅ Profile payload
            # ---------------------------------------------------
            "profile": {
                "display_name": profile.display_name if profile else "",
                "avatar_url": profile.avatar_url if profile else None,
                "bio": profile.bio if profile else "",
                "phone_number": profile.phone_number if profile else None,
                "whatsapp_number": profile.whatsapp_number if profile else None,
                "alternate_email": profile.alternate_email if profile else None,
                "preferred_language": profile.preferred_language if profile else "ar",
                "timezone": profile.timezone if profile else "Asia/Riyadh",
                "user_type": getattr(profile, "user_type", "OTHER") if profile else "OTHER",
                "role": getattr(profile, "role", RoleChoices.VIEWER) if profile else RoleChoices.VIEWER,
                "workspace": workspace,
                "is_phone_verified": profile.is_phone_verified if profile else False,
                "is_whatsapp_verified": profile.is_whatsapp_verified if profile else False,
                "is_email_verified": profile.is_email_verified if profile else False,
                "is_profile_completed": profile.is_profile_completed if profile else False,
                "tags": profile_tags,
                "extra_data": profile_extra_data,
            },

            # ---------------------------------------------------
            # ✅ Session payload
            # ---------------------------------------------------
            "session": {
                "key": active_session.session_key if active_session else session_key,
                "version": (
                    active_session.session_version
                    if active_session
                    else request.session.get("session_version", 1)
                ),
                "auth_channel": active_session.auth_channel if active_session else None,
                "is_current": active_session.is_current if active_session else False,
                "is_active": active_session.is_active if active_session else False,
                "ip_address": active_session.ip_address if active_session else None,
                "last_seen": (
                    active_session.last_seen.isoformat()
                    if active_session and active_session.last_seen
                    else None
                ),
                "created_at": (
                    active_session.created_at.isoformat()
                    if active_session and active_session.created_at
                    else None
                ),
            },

            # ---------------------------------------------------
            # ✅ Permissions payload
            # ---------------------------------------------------
            "permissions": {
                "is_superuser": bool(user.is_superuser),
                "is_staff": bool(user.is_staff),
                "groups": groups,
                "codes": permission_codes,
            },

            # ---------------------------------------------------
            # ✅ Compatibility payload from permissions core
            # ---------------------------------------------------
            "profile_permissions": {
                **permission_payload.get("profile_permissions", {}),
                "workspace": workspace,
                "extra_data": profile_extra_data,
            },
        },
        status=200,
    )