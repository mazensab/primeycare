# ===============================================================
# 📂 الملف: api/auth/whoami.py
# 🧭 Primey Care — Auth WhoAmI API
# ---------------------------------------------------------------
# ✅ Returns current authenticated user context
# ✅ Returns anonymous-safe payload when not authenticated
# ✅ Returns normalized workspace / redirect payload
# ✅ Compatible with frontend login + middleware guards
# ===============================================================

from __future__ import annotations

from typing import Any

from django.http import JsonResponse
from django.views.decorators.http import require_GET

from auth_center.models import ActiveUserSession, UserProfile


# ===============================================================
# 🧩 Helpers
# ===============================================================

SYSTEM_ROLE_NAMES = {
    "SYSTEM",
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "SUPPORT",
    "INTERNAL",
    "ADMIN",
}

COMPANY_ROLE_NAMES = {
    "COMPANY",
    "COMPANY_ADMIN",
    "COMPANY_OWNER",
    "OWNER",
    "HR",
}

CENTER_ROLE_NAMES = {
    "CENTER",
    "CENTER_ADMIN",
}

CUSTOMER_ROLE_NAMES = {
    "CUSTOMER",
}

AGENT_ROLE_NAMES = {
    "AGENT",
}


def _safe_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _safe_int(value: Any) -> int | None:
    try:
        if value in (None, "", 0, "0"):
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _normalize_upper(value: Any) -> str:
    return str(value or "").strip().upper()


def _resolve_context_ids(profile: UserProfile | None) -> tuple[int | None, int | None, int | None, int | None]:
    """
    نحاول قراءة المعرّفات من extra_data أو من خصائص مباشرة إن وُجدت.
    هذا يجعل whoami مرنًا حتى لو تغيّرت بنية UserProfile لاحقًا.
    """
    if not profile:
        return None, None, None, None

    extra_data = _safe_dict(getattr(profile, "extra_data", {}) or {})

    company_id = _safe_int(
        extra_data.get("company_id")
        or extra_data.get("company")
        or getattr(profile, "company_id", None)
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

    return company_id, center_id, customer_id, agent_id


def _resolve_system_user(user, profile: UserProfile | None, groups: list[str]) -> bool:
    if user.is_superuser or user.is_staff:
        return True

    normalized_groups = {_normalize_upper(item) for item in groups}
    if normalized_groups & SYSTEM_ROLE_NAMES:
        return True

    if profile:
        user_type = _normalize_upper(getattr(profile, "user_type", ""))
        if user_type in SYSTEM_ROLE_NAMES:
            return True

    return False


def _resolve_role(user, profile: UserProfile | None, is_system_user: bool) -> str:
    if user.is_superuser:
        return "SUPER_ADMIN"

    if profile:
        profile_user_type = _normalize_upper(getattr(profile, "user_type", ""))
        if profile_user_type:
            return profile_user_type

    if is_system_user:
        return "SYSTEM"

    return "OTHER"


def _resolve_workspace(
    is_system_user: bool,
    company_id: int | None,
    center_id: int | None,
    customer_id: int | None,
    agent_id: int | None,
    role: str,
) -> str:
    if is_system_user:
        return "system"

    if company_id or role in COMPANY_ROLE_NAMES:
        return "company"

    if center_id or role in CENTER_ROLE_NAMES:
        return "center"

    if customer_id or role in CUSTOMER_ROLE_NAMES:
        return "customer"

    if agent_id or role in AGENT_ROLE_NAMES:
        return "agent"

    return "system"


def _resolve_dashboard_path(workspace: str) -> str:
    mapping = {
        "system": "/system",
        "company": "/company",
        "center": "/center",
        "customer": "/customer",
        "agent": "/agent",
    }
    return mapping.get(workspace, "/system")


def _anonymous_payload():
    return {
        "authenticated": False,
        "workspace": None,
        "dashboard_path": "/login",
        "is_system_user": False,
        "role": None,
        "user_type": None,
        "scope_type": None,
        "company_id": None,
        "center_id": None,
        "customer_id": None,
        "agent_id": None,
        "is_superuser": False,
        "is_staff": False,
        "user": None,
        "profile": None,
        "session": None,
        "permissions": {
            "is_superuser": False,
            "is_staff": False,
            "groups": [],
        },
    }


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
    active_session = None

    if session_key:
        active_session = ActiveUserSession.objects.filter(
            session_key=session_key,
            user=user,
            is_active=True,
        ).first()

        if active_session:
            if not active_session.is_current:
                active_session.is_current = True
                active_session.save(update_fields=["is_current", "last_seen"])
            else:
                active_session.save(update_fields=["last_seen"])

    full_name = (user.get_full_name() or "").strip()
    groups = list(user.groups.values_list("name", flat=True))

    company_id, center_id, customer_id, agent_id = _resolve_context_ids(profile)
    is_system_user = _resolve_system_user(user, profile, groups)
    role = _resolve_role(user, profile, is_system_user)
    user_type = _normalize_upper(getattr(profile, "user_type", "OTHER")) if profile else "OTHER"
    scope_type = "SYSTEM" if is_system_user else role
    workspace = _resolve_workspace(
        is_system_user=is_system_user,
        company_id=company_id,
        center_id=center_id,
        customer_id=customer_id,
        agent_id=agent_id,
        role=role,
    )
    dashboard_path = _resolve_dashboard_path(workspace)

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
            "company_id": company_id,
            "center_id": center_id,
            "customer_id": customer_id,
            "agent_id": agent_id,
            "is_superuser": user.is_superuser,
            "is_staff": user.is_staff,

            # ---------------------------------------------------
            # ✅ Original structured payload
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
                "is_phone_verified": profile.is_phone_verified if profile else False,
                "is_whatsapp_verified": profile.is_whatsapp_verified if profile else False,
                "is_email_verified": profile.is_email_verified if profile else False,
                "is_profile_completed": profile.is_profile_completed if profile else False,
                "tags": profile.tags if profile else [],
                "extra_data": profile.extra_data if profile else {},
            },
            "session": {
                "key": active_session.session_key if active_session else session_key,
                "version": active_session.session_version if active_session else request.session.get("session_version", 1),
                "auth_channel": active_session.auth_channel if active_session else None,
                "is_current": active_session.is_current if active_session else False,
                "is_active": active_session.is_active if active_session else False,
                "ip_address": active_session.ip_address if active_session else None,
                "last_seen": active_session.last_seen.isoformat() if active_session and active_session.last_seen else None,
                "created_at": active_session.created_at.isoformat() if active_session and active_session.created_at else None,
            },
            "permissions": {
                "is_superuser": user.is_superuser,
                "is_staff": user.is_staff,
                "groups": groups,
            },
        },
        status=200,
    )