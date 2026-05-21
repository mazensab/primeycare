# ===============================================================
# 📂 الملف: api/auth/login.py
# 🧭 Primey Care — Auth Login API
# 🚀 الإصدار: Primey Care Login API V2.0
# ---------------------------------------------------------------
# ✅ Session-based login
# ✅ Supports username / email / phone / whatsapp
# ✅ Creates / updates ActiveUserSession
# ✅ CSRF protected
# ✅ Returns workspace / dashboard_path / redirect_to
# ✅ Returns actor entity context:
#    system / provider / customer / agent / broker
# ✅ Compatible with:
#    Provider.user
#    Customer.user
#    Agent.user
#    Broker.user
# ===============================================================

from __future__ import annotations

import json
import logging
from typing import Any

from django.contrib.auth import authenticate, get_user_model, login
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST

from agents.models import Agent, Broker
from auth_center.models import ActiveUserSession, RoleChoices, UserProfile
from auth_center.permissions import (
    build_permissions_payload,
    get_user_permissions,
    get_user_role,
    get_user_workspace,
)
from customers.models import Customer
from providers.models import Provider

logger = logging.getLogger(__name__)
User = get_user_model()


# ===============================================================
# 🧩 Constants
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
    "system_admin",
    "accountant",
    "support",
    "viewer",
}

ACCOUNTANT_ROLE_NAMES = {
    "ACCOUNTANT",
    "FINANCE",
    "FINANCE_MANAGER",
    "TREASURY",
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

CUSTOMER_ROLE_LOWER_NAMES = {
    "customer",
    "customer_user",
}

AGENT_ROLE_NAMES = {
    "AGENT",
    "AGENT_ADMIN",
    "AGENT_USER",
}

BROKER_ROLE_NAMES = {
    "BROKER",
    "BROKER_ADMIN",
    "BROKER_USER",
}

AGENT_ROLE_LOWER_NAMES = {
    "agent",
    "agent_user",
}

BROKER_ROLE_LOWER_NAMES = {
    "broker",
    "broker_user",
}


# ===============================================================
# 🔧 JSON Helpers
# ===============================================================

def _json_body(request) -> dict[str, Any]:
    try:
        if not request.body:
            return {}

        parsed = json.loads(request.body.decode("utf-8"))

        return parsed if isinstance(parsed, dict) else {}

    except Exception:
        return {}


def _json_error(
    message: str,
    status: int = 400,
    *,
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


# ===============================================================
# 🧰 Safe Helpers
# ===============================================================

def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _normalize_upper(value: Any) -> str:
    return str(value or "").strip().upper()


def _normalize_lower(value: Any) -> str:
    return str(value or "").strip().lower()


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


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _get_client_ip(request) -> str | None:
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")

    if forwarded_for:
        return forwarded_for.split(",")[0].strip() or None

    return request.META.get("REMOTE_ADDR")


def _model_has_field(model_class: Any, field_name: str) -> bool:
    try:
        model_class._meta.get_field(field_name)
        return True
    except Exception:
        return False


def _normalize_workspace(value: Any) -> str:
    workspace = _normalize_lower(value)

    if workspace in {"company", "center"}:
        return "provider"

    if workspace in {"system", "provider", "customer", "agent"}:
        return workspace

    return "system"


def _serialize_login_user(user: Any | None) -> dict[str, Any] | None:
    if not user:
        return None

    full_name = ""
    try:
        full_name = (user.get_full_name() or "").strip()
    except Exception:
        full_name = ""

    return {
        "id": getattr(user, "pk", None),
        "username": getattr(user, "username", "") or "",
        "email": getattr(user, "email", "") or "",
        "first_name": getattr(user, "first_name", "") or "",
        "last_name": getattr(user, "last_name", "") or "",
        "full_name": full_name,
        "is_active": bool(getattr(user, "is_active", False)),
        "is_staff": bool(getattr(user, "is_staff", False)),
        "is_superuser": bool(getattr(user, "is_superuser", False)),
        "last_login": _iso_datetime(getattr(user, "last_login", None)),
        "date_joined": _iso_datetime(getattr(user, "date_joined", None)),
    }


# ===============================================================
# 🔐 Identifier Resolution
# ===============================================================

def _resolve_username_from_identifier(identifier: str) -> str:
    """
    يدعم تسجيل الدخول عبر:
    - username
    - email
    - phone_number
    - whatsapp_number

    مهم:
    عملاء OTP قد يكون username هو رقم الجوال.
    ومستخدمو المندوب/الوسيط/مقدم الخدمة قد يكون لهم username أو email أو phone.
    """

    cleaned = _clean_text(identifier)

    if not cleaned:
        return ""

    user = User.objects.filter(username=cleaned).only("username").first()
    if user:
        return user.username

    if "@" in cleaned:
        user = User.objects.filter(email__iexact=cleaned).only("username").first()
        if user:
            return user.username

    profile = (
        UserProfile.objects
        .filter(phone_number=cleaned)
        .select_related("user")
        .only("user__username")
        .first()
    )
    if profile:
        return profile.user.username

    profile = (
        UserProfile.objects
        .filter(whatsapp_number=cleaned)
        .select_related("user")
        .only("user__username")
        .first()
    )
    if profile:
        return profile.user.username

    return cleaned


# ===============================================================
# 🔗 Direct Actor Link Fallbacks
# ===============================================================

def _resolve_linked_customer_id(user: Any) -> int | None:
    if not user or not getattr(user, "is_authenticated", False):
        return None

    customer = Customer.objects.filter(user=user).only("id").first()

    return customer.pk if customer else None


def _resolve_linked_provider_id(user: Any) -> int | None:
    if not user or not getattr(user, "is_authenticated", False):
        return None

    if not _model_has_field(Provider, "user"):
        return None

    provider = Provider.objects.filter(user=user).only("id").first()

    return provider.pk if provider else None


def _resolve_linked_agent_id(user: Any) -> int | None:
    if not user or not getattr(user, "is_authenticated", False):
        return None

    if not _model_has_field(Agent, "user"):
        return None

    agent = Agent.objects.filter(user=user).only("id").first()

    return agent.pk if agent else None


def _resolve_linked_broker_id(user: Any) -> int | None:
    if not user or not getattr(user, "is_authenticated", False):
        return None

    if not _model_has_field(Broker, "user"):
        return None

    broker = Broker.objects.filter(user=user).only("id").first()

    return broker.pk if broker else None


def _resolve_context_ids(
    profile: UserProfile | None,
    *,
    user: Any,
) -> tuple[
    int | None,
    int | None,
    int | None,
    int | None,
    int | None,
    int | None,
]:
    linked_provider_id = _resolve_linked_provider_id(user)
    linked_customer_id = _resolve_linked_customer_id(user)
    linked_agent_id = _resolve_linked_agent_id(user)
    linked_broker_id = _resolve_linked_broker_id(user)

    if not profile:
        return (
            None,
            linked_provider_id,
            None,
            linked_customer_id,
            linked_agent_id,
            linked_broker_id,
        )

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
        or linked_provider_id
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
        or linked_customer_id
    )

    agent_id = _safe_int(
        extra_data.get("agent_id")
        or extra_data.get("agent")
        or getattr(profile, "agent_id", None)
        or linked_agent_id
    )

    broker_id = _safe_int(
        extra_data.get("broker_id")
        or extra_data.get("broker")
        or getattr(profile, "broker_id", None)
        or linked_broker_id
    )

    return company_id, provider_id, center_id, customer_id, agent_id, broker_id


# ===============================================================
# 🧭 Workspace Resolution
# ===============================================================

def _resolve_system_user(
    *,
    user: Any,
    profile: UserProfile | None,
    groups: list[str],
    role: str,
    provider_id: int | None,
    customer_id: int | None,
    agent_id: int | None,
    broker_id: int | None,
) -> bool:
    if bool(getattr(user, "is_superuser", False)):
        return True

    normalized_role = _normalize_lower(role)
    normalized_role_upper = _normalize_upper(role)

    if normalized_role in SYSTEM_PERMISSION_ROLES:
        return True

    normalized_groups = {_normalize_upper(item) for item in groups}

    if normalized_groups & SYSTEM_ROLE_NAMES:
        return True

    if normalized_groups & ACCOUNTANT_ROLE_NAMES:
        return True

    user_type = _normalize_upper(getattr(profile, "user_type", "")) if profile else ""

    if user_type in SYSTEM_ROLE_NAMES or user_type in ACCOUNTANT_ROLE_NAMES:
        return True

    if provider_id or customer_id or agent_id or broker_id:
        return False

    if bool(getattr(user, "is_staff", False)) and normalized_role_upper in SYSTEM_ROLE_NAMES:
        return True

    return bool(getattr(user, "is_staff", False)) and not (
        provider_id or customer_id or agent_id or broker_id
    )


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
    normalized_role = _normalize_upper(role)
    normalized_role_lower = _normalize_lower(role)
    normalized_user_type = _normalize_upper(user_type)
    normalized_user_type_lower = _normalize_lower(user_type)
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
        or normalized_role_lower in CUSTOMER_ROLE_LOWER_NAMES
        or normalized_user_type_lower in CUSTOMER_ROLE_LOWER_NAMES
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
        or normalized_role_lower in AGENT_ROLE_LOWER_NAMES
        or normalized_role_lower in BROKER_ROLE_LOWER_NAMES
        or normalized_user_type_lower in AGENT_ROLE_LOWER_NAMES
        or normalized_user_type_lower in BROKER_ROLE_LOWER_NAMES
        or normalized_fallback_workspace == "agent"
    ):
        return "agent"

    return normalized_fallback_workspace


def _resolve_dashboard_path(workspace: str) -> str:
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
    normalized_role = _normalize_upper(role)
    normalized_role_lower = _normalize_lower(role)
    normalized_user_type = _normalize_upper(user_type)
    normalized_user_type_lower = _normalize_lower(user_type)

    if workspace == "system":
        return "system", None

    if workspace == "provider":
        if center_id or normalized_role in CENTER_ROLE_NAMES or normalized_user_type in CENTER_ROLE_NAMES:
            return "center", center_id

        return "provider", provider_id

    if workspace == "customer":
        return "customer", customer_id

    if workspace == "agent":
        if (
            broker_id
            or normalized_role in BROKER_ROLE_NAMES
            or normalized_user_type in BROKER_ROLE_NAMES
            or normalized_role_lower in BROKER_ROLE_LOWER_NAMES
            or normalized_user_type_lower in BROKER_ROLE_LOWER_NAMES
        ):
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


# ===============================================================
# 📦 Actor Context Payloads
# ===============================================================

def _build_profile_extra_data(
    *,
    profile: UserProfile | None,
    company_id: int | None,
    provider_id: int | None,
    center_id: int | None,
    customer_id: int | None,
    agent_id: int | None,
    broker_id: int | None,
    entity_type: str | None,
    entity_id: int | None,
) -> dict[str, Any]:
    extra_data = _safe_dict(profile.extra_data if profile else {})

    if company_id and not extra_data.get("company_id"):
        extra_data = {**extra_data, "company_id": company_id, "company": company_id}

    if provider_id and not extra_data.get("provider_id"):
        extra_data = {**extra_data, "provider_id": provider_id, "provider": provider_id}

    if center_id and not extra_data.get("center_id"):
        extra_data = {**extra_data, "center_id": center_id, "center": center_id}

    if customer_id and not extra_data.get("customer_id"):
        extra_data = {**extra_data, "customer_id": customer_id, "customer": customer_id}

    if agent_id and not extra_data.get("agent_id"):
        extra_data = {**extra_data, "agent_id": agent_id, "agent": agent_id}

    if broker_id and not extra_data.get("broker_id"):
        extra_data = {**extra_data, "broker_id": broker_id, "broker": broker_id}

    if entity_type and not extra_data.get("entity_type"):
        extra_data = {**extra_data, "entity_type": entity_type}

    if entity_id and not extra_data.get("entity_id"):
        extra_data = {**extra_data, "entity_id": entity_id}

    return extra_data


def _build_customer_payload(customer_id: int | None) -> dict[str, Any] | None:
    if not customer_id:
        return None

    customer = (
        Customer.objects
        .select_related("user", "agent", "agent__user", "broker", "broker__user")
        .filter(pk=customer_id)
        .first()
    )

    if not customer:
        return None

    agent = getattr(customer, "agent", None)
    broker = getattr(customer, "broker", None)

    return {
        "id": customer.pk,
        "customer_code": getattr(customer, "customer_code", "") or "",
        "display_name": getattr(customer, "display_name", "") or getattr(customer, "full_name", "") or "",
        "full_name": getattr(customer, "full_name", "") or getattr(customer, "display_name", "") or "",
        "status": getattr(customer, "status", "") or "",
        "source": getattr(customer, "source", "") or "",
        "phone_number": getattr(customer, "phone_number", "") or "",
        "whatsapp_number": getattr(customer, "whatsapp_number", "") or "",
        "email": getattr(customer, "email", "") or "",
        "city": getattr(customer, "city", "") or "",
        "agent_id": getattr(customer, "agent_id", None),
        "broker_id": getattr(customer, "broker_id", None),
        "agent": (
            {
                "id": agent.pk,
                "name": getattr(agent, "full_name", "") or "",
                "agent_code": getattr(agent, "agent_code", "") or "",
                "code": getattr(agent, "agent_code", "") or "",
                "user_id": getattr(agent, "user_id", None),
                "has_login_user": bool(getattr(agent, "user_id", None)),
                "login_user": _serialize_login_user(getattr(agent, "user", None)),
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
                "user_id": getattr(broker, "user_id", None),
                "has_login_user": bool(getattr(broker, "user_id", None)),
                "login_user": _serialize_login_user(getattr(broker, "user", None)),
            }
            if broker
            else None
        ),
        "user_id": getattr(customer, "user_id", None),
        "has_login_user": bool(getattr(customer, "user_id", None)),
        "has_customer_account": bool(getattr(customer, "user_id", None)),
        "login_user": _serialize_login_user(getattr(customer, "user", None)),
    }


def _build_provider_payload(provider_id: int | None) -> dict[str, Any] | None:
    if not provider_id:
        return None

    queryset = Provider.objects.filter(pk=provider_id)

    if _model_has_field(Provider, "user"):
        queryset = queryset.select_related("user")

    provider = queryset.first()

    if not provider:
        return None

    display_name = (
        getattr(provider, "name_ar", "")
        or getattr(provider, "name", "")
        or getattr(provider, "name_en", "")
        or ""
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
        "user_id": getattr(provider, "user_id", None),
        "has_login_user": bool(getattr(provider, "user_id", None)),
        "login_user": _serialize_login_user(getattr(provider, "user", None)),
    }


def _build_agent_payload(agent_id: int | None) -> dict[str, Any] | None:
    if not agent_id:
        return None

    queryset = Agent.objects.filter(pk=agent_id).select_related("broker")

    if _model_has_field(Agent, "user"):
        queryset = queryset.select_related("user", "broker")

    try:
        queryset = queryset.select_related("broker__user")
    except Exception:
        pass

    agent = queryset.first()

    if not agent:
        return None

    broker = getattr(agent, "broker", None)

    return {
        "id": agent.pk,
        "name": getattr(agent, "full_name", "") or "",
        "full_name": getattr(agent, "full_name", "") or "",
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
                "user_id": getattr(broker, "user_id", None),
                "has_login_user": bool(getattr(broker, "user_id", None)),
                "login_user": _serialize_login_user(getattr(broker, "user", None)),
            }
            if broker
            else None
        ),
        "user_id": getattr(agent, "user_id", None),
        "has_login_user": bool(getattr(agent, "user_id", None)),
        "login_user": _serialize_login_user(getattr(agent, "user", None)),
    }


def _build_broker_payload(broker_id: int | None) -> dict[str, Any] | None:
    if not broker_id:
        return None

    queryset = Broker.objects.filter(pk=broker_id)

    if _model_has_field(Broker, "user"):
        queryset = queryset.select_related("user")

    broker = queryset.first()

    if not broker:
        return None

    return {
        "id": broker.pk,
        "name": getattr(broker, "name", "") or "",
        "broker_name": getattr(broker, "name", "") or "",
        "broker_code": getattr(broker, "broker_code", "") or "",
        "code": getattr(broker, "broker_code", "") or "",
        "referral_code": getattr(broker, "referral_code", "") or "",
        "status": getattr(broker, "status", "") or "",
        "phone": getattr(broker, "phone", "") or "",
        "email": getattr(broker, "email", "") or "",
        "city": getattr(broker, "city", "") or "",
        "user_id": getattr(broker, "user_id", None),
        "has_login_user": bool(getattr(broker, "user_id", None)),
        "login_user": _serialize_login_user(getattr(broker, "user", None)),
    }


def _resolve_actor_payload(
    *,
    entity_type: str | None,
    customer_payload: dict[str, Any] | None,
    provider_payload: dict[str, Any] | None,
    agent_payload: dict[str, Any] | None,
    broker_payload: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if entity_type == "customer":
        return customer_payload

    if entity_type in {"provider", "center"}:
        return provider_payload

    if entity_type == "agent":
        return agent_payload

    if entity_type == "broker":
        return broker_payload

    return None


# ===============================================================
# 🔐 Session Helpers
# ===============================================================

def _get_auth_channel_value() -> str:
    return getattr(ActiveUserSession.AuthChannel, "WEB", "WEB")


def _create_or_update_active_session(
    *,
    request,
    user,
) -> ActiveUserSession | None:
    if not request.session.session_key:
        request.session.save()

    session_key = request.session.session_key

    if not session_key:
        return None

    ip_address = _get_client_ip(request)
    user_agent = request.META.get("HTTP_USER_AGENT", "")

    with transaction.atomic():
        ActiveUserSession.objects.filter(
            user=user,
            is_current=True,
        ).exclude(session_key=session_key).update(is_current=False)

        active_session, created = ActiveUserSession.objects.get_or_create(
            session_key=session_key,
            defaults={
                "user": user,
                "session_version": 1,
                "auth_channel": _get_auth_channel_value(),
                "ip_address": ip_address,
                "user_agent": user_agent,
                "is_current": True,
                "is_active": True,
            },
        )

        update_fields: list[str] = []

        if not created:
            active_session.user = user
            active_session.auth_channel = _get_auth_channel_value()
            active_session.ip_address = ip_address
            active_session.user_agent = user_agent
            active_session.is_current = True
            active_session.is_active = True

            update_fields.extend(
                [
                    "user",
                    "auth_channel",
                    "ip_address",
                    "user_agent",
                    "is_current",
                    "is_active",
                ]
            )

        if hasattr(active_session, "last_seen"):
            active_session.last_seen = timezone.now()
            update_fields.append("last_seen")

        if update_fields:
            active_session.save(update_fields=sorted(set(update_fields)))

        request.session["session_version"] = active_session.session_version
        request.session.modified = True

    return active_session


# ===============================================================
# 📦 Login Context Builder
# ===============================================================

def _build_login_context_payload(
    *,
    request,
    user,
    active_session: ActiveUserSession | None,
) -> dict[str, Any]:
    profile = UserProfile.objects.filter(user=user).first()
    groups = list(user.groups.values_list("name", flat=True))
    full_name = (user.get_full_name() or "").strip()

    (
        company_id,
        provider_id,
        center_id,
        customer_id,
        agent_id,
        broker_id,
    ) = _resolve_context_ids(
        profile,
        user=user,
    )

    role = get_user_role(user)
    fallback_workspace = get_user_workspace(user)
    user_type = _normalize_upper(getattr(profile, "user_type", "OTHER")) if profile else "OTHER"
    permission_codes = sorted(get_user_permissions(user))
    permission_payload = build_permissions_payload(user)

    is_system_user = _resolve_system_user(
        user=user,
        profile=profile,
        groups=groups,
        role=role,
        provider_id=provider_id,
        customer_id=customer_id,
        agent_id=agent_id,
        broker_id=broker_id,
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

    profile_extra_data = _build_profile_extra_data(
        profile=profile,
        company_id=company_id,
        provider_id=provider_id,
        center_id=center_id,
        customer_id=customer_id,
        agent_id=agent_id,
        broker_id=broker_id,
        entity_type=entity_type,
        entity_id=entity_id,
    )

    customer_payload = _build_customer_payload(customer_id)
    provider_payload = _build_provider_payload(provider_id)
    agent_payload = _build_agent_payload(agent_id)
    broker_payload = _build_broker_payload(broker_id)

    actor_payload = _resolve_actor_payload(
        entity_type=entity_type,
        customer_payload=customer_payload,
        provider_payload=provider_payload,
        agent_payload=agent_payload,
        broker_payload=broker_payload,
    )

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
        "tags": _safe_list(profile.tags if profile else []),
        "extra_data": profile_extra_data,
    }

    session_payload = {
        "key": active_session.session_key if active_session else request.session.session_key,
        "version": (
            active_session.session_version
            if active_session
            else request.session.get("session_version", 1)
        ),
        "auth_channel": active_session.auth_channel if active_session else None,
        "is_current": active_session.is_current if active_session else False,
        "is_active": active_session.is_active if active_session else False,
        "ip_address": active_session.ip_address if active_session else None,
        "last_seen": _iso_datetime(getattr(active_session, "last_seen", None)) if active_session else None,
        "created_at": _iso_datetime(getattr(active_session, "created_at", None)) if active_session else None,
    }

    permissions_payload = {
        "is_superuser": bool(user.is_superuser),
        "is_staff": bool(user.is_staff),
        "groups": groups,
        "codes": permission_codes,
    }

    return {
        "authenticated": True,
        "workspace": workspace,
        "dashboard_path": dashboard_path,
        "redirect_to": dashboard_path,
        "home_path": dashboard_path,

        "is_system_user": is_system_user,
        "role": role,
        "user_type": user_type,
        "scope_type": scope_type,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "actor_type": entity_type,
        "actor_id": entity_id,

        "company_id": company_id,
        "provider_id": provider_id,
        "center_id": center_id,
        "customer_id": customer_id,
        "agent_id": agent_id,
        "broker_id": broker_id,

        "is_superuser": bool(user.is_superuser),
        "is_staff": bool(user.is_staff),

        "permission_codes": permission_codes,

        "user": user_payload,
        "profile": profile_payload,

        "customer": customer_payload,
        "provider": provider_payload,
        "agent": agent_payload,
        "broker": broker_payload,
        "actor": actor_payload,

        "session": session_payload,

        "permissions": permissions_payload,

        "profile_permissions": {
            **permission_payload.get("profile_permissions", {}),
            "workspace": workspace,
            "extra_data": profile_extra_data,
        },

        "data": {
            "authenticated": True,
            "workspace": workspace,
            "dashboard_path": dashboard_path,
            "redirect_to": dashboard_path,
            "is_system_user": is_system_user,
            "role": role,
            "user_type": user_type,
            "scope_type": scope_type,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "actor_type": entity_type,
            "actor_id": entity_id,
            "company_id": company_id,
            "provider_id": provider_id,
            "center_id": center_id,
            "customer_id": customer_id,
            "agent_id": agent_id,
            "broker_id": broker_id,
            "user": user_payload,
            "profile": profile_payload,
            "customer": customer_payload,
            "provider": provider_payload,
            "agent": agent_payload,
            "broker": broker_payload,
            "actor": actor_payload,
            "session": session_payload,
            "permissions": permissions_payload,
            "permission_codes": permission_codes,
        },
    }


# ===============================================================
# 🚀 API
# ===============================================================

@require_POST
@csrf_protect
def login_api(request):
    payload = _json_body(request)

    identifier = _clean_text(
        payload.get("identifier")
        or payload.get("username")
        or payload.get("email")
        or payload.get("phone_number")
        or payload.get("phone")
        or payload.get("whatsapp_number")
        or payload.get("whatsapp")
    )
    password = _clean_text(payload.get("password"))

    errors: dict[str, str] = {}

    if not identifier:
        errors["identifier"] = "Username, email, or phone number is required."

    if not password:
        errors["password"] = "Password is required."

    if errors:
        return _json_error(
            "Validation error.",
            status=400,
            errors=errors,
        )

    username = _resolve_username_from_identifier(identifier)

    user = authenticate(
        request=request,
        username=username,
        password=password,
    )

    if not user:
        return _json_error(
            "Invalid credentials.",
            status=401,
        )

    if not user.is_active:
        return _json_error(
            "This account is inactive.",
            status=403,
        )

    login(request, user)

    active_session = _create_or_update_active_session(
        request=request,
        user=user,
    )

    context_payload = _build_login_context_payload(
        request=request,
        user=user,
        active_session=active_session,
    )

    return _json_success(
        {
            "message": "Login successful.",
            **context_payload,
        },
        status=200,
    )