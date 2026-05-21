# ===============================================================
# 📂 الملف: api/auth/whoami.py
# 🧭 Primey Care — Auth WhoAmI API
# 🚀 الإصدار: Primey Care WhoAmI V2.0
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
# ---------------------------------------------------------------
# ✅ Customer OTP Compatibility:
#    - Supports UserProfile.extra_data.customer_id
#    - Supports direct Customer.user link fallback
#    - Keeps /customer routing safe after OTP login
# ---------------------------------------------------------------
# ✅ Actor Direct Link Compatibility:
#    - Supports Provider.user -> provider workspace
#    - Supports Agent.user    -> agent workspace
#    - Supports Broker.user   -> agent workspace with broker entity
#    - Supports Customer.user -> customer workspace
# ---------------------------------------------------------------
# ✅ Important rule:
#    - Users page manages login account only.
#    - Operational data stays in Customer / Provider / Agent / Broker.
# ===============================================================

from __future__ import annotations

from typing import Any

from django.http import JsonResponse
from django.views.decorators.http import require_GET

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
# 🧩 Generic Helpers
# ===============================================================

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


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _model_has_field(model_class: Any, field_name: str) -> bool:
    try:
        model_class._meta.get_field(field_name)
        return True
    except Exception:
        return False


def _safe_attr(instance: Any, *names: str, default: Any = "") -> Any:
    if not instance:
        return default

    for name in names:
        try:
            value = getattr(instance, name, None)
        except Exception:
            value = None

        if value not in (None, ""):
            return value

    return default


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
# 🔗 Direct Actor Link Fallbacks
# ===============================================================

def _resolve_linked_customer_id(user: Any) -> int | None:
    if not user or not getattr(user, "is_authenticated", False):
        return None

    customer = (
        Customer.objects
        .filter(user=user)
        .only("id")
        .first()
    )

    return customer.pk if customer else None


def _resolve_linked_provider_id(user: Any) -> int | None:
    if not user or not getattr(user, "is_authenticated", False):
        return None

    if not _model_has_field(Provider, "user"):
        return None

    provider = (
        Provider.objects
        .filter(user=user)
        .only("id")
        .first()
    )

    return provider.pk if provider else None


def _resolve_linked_agent_id(user: Any) -> int | None:
    if not user or not getattr(user, "is_authenticated", False):
        return None

    if not _model_has_field(Agent, "user"):
        return None

    agent = (
        Agent.objects
        .filter(user=user)
        .only("id")
        .first()
    )

    return agent.pk if agent else None


def _resolve_linked_broker_id(user: Any) -> int | None:
    if not user or not getattr(user, "is_authenticated", False):
        return None

    if not _model_has_field(Broker, "user"):
        return None

    broker = (
        Broker.objects
        .filter(user=user)
        .only("id")
        .first()
    )

    return broker.pk if broker else None


def _resolve_context_ids(
    profile: UserProfile | None,
    *,
    user: Any | None = None,
) -> tuple[
    int | None,
    int | None,
    int | None,
    int | None,
    int | None,
    int | None,
]:
    """
    قراءة معرفات السياق من extra_data أو من الروابط المباشرة.

    الترتيب:
    company_id   -> توافق خلفي فقط
    provider_id  -> مقدم خدمة
    center_id    -> مركز
    customer_id  -> عميل
    agent_id     -> مندوب
    broker_id    -> وسيط / وكيل

    fallbacks المباشرة:
    - Provider.user
    - Customer.user
    - Agent.user
    - Broker.user
    """

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
    """
    تحديد هل المستخدم من مساحة النظام أم لا.

    مهم:
    - لا نعتبر provider/agent/broker/customer system user لمجرد وجود staff خطأ.
    - لكن superuser دائمًا system.
    - staff النظام الحقيقي يبقى system.
    """

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

    # حماية إضافية:
    # لو الحساب مرتبط فعليًا بجهة تشغيلية ولا يحمل دور نظامي،
    # لا ندخله system حتى لو is_staff كان true بالخطأ.
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
    """
    Primey Care workspace resolver.

    المساحات الرسمية:
    - system
    - provider
    - customer
    - agent

    ملاحظة:
    company/center توافق خلفي ويتم تحويلهما إلى provider.
    broker_user يدخل مساحة /agent لكن entity_type يكون broker.
    """

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

    if normalized_role in COMPANY_ROLE_NAMES or normalized_user_type in COMPANY_ROLE_NAMES:
        return "provider"

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
    """
    إرجاع entity_type / entity_id بشكل موحد للفرونت.

    أمثلة:
    customer_user -> customer / customer_id
    provider_admin -> provider أو center
    agent_user -> agent
    broker_user -> broker
    system_admin/accountant/support/viewer -> system / None
    """

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
# 📦 Payload Builders
# ===============================================================

def _anonymous_payload() -> dict[str, Any]:
    return {
        "ok": True,
        "success": True,
        "authenticated": False,

        "workspace": None,
        "dashboard_path": "/login",
        "redirect_to": "/login",
        "home_path": "/login",

        "is_system_user": False,
        "role": None,
        "user_type": None,
        "scope_type": None,
        "entity_type": None,
        "entity_id": None,
        "actor_type": None,
        "actor_id": None,

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
        "customer": None,
        "provider": None,
        "agent": None,
        "broker": None,
        "actor": None,
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
        "data": {
            "authenticated": False,
            "workspace": None,
            "dashboard_path": "/login",
            "user": None,
            "profile": None,
            "actor": None,
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

    update_fields: list[str] = []

    if hasattr(active_session, "is_current") and not active_session.is_current:
        active_session.is_current = True
        update_fields.append("is_current")

    if hasattr(active_session, "last_seen"):
        from django.utils import timezone

        active_session.last_seen = timezone.now()
        update_fields.append("last_seen")

    if update_fields:
        active_session.save(update_fields=sorted(set(update_fields)))

    return active_session


def _build_profile_extra_data(
    *,
    profile: UserProfile | None,
    company_id: int | None,
    provider_id: int | None,
    center_id: int | None,
    customer_id: int | None,
    agent_id: int | None,
    broker_id: int | None,
    entity_type: str | None = None,
    entity_id: int | None = None,
) -> dict[str, Any]:
    """
    نرجع extra_data بشكل متوافق مع الفرونت.
    إذا كانت المعرفات معروفة من الربط المباشر ولم تكن موجودة في extra_data،
    نضيفها في payload فقط بدون حفظ إجباري هنا.
    """

    extra_data = _safe_dict(profile.extra_data if profile else {})

    if company_id and not extra_data.get("company_id"):
        extra_data = {
            **extra_data,
            "company_id": company_id,
            "company": company_id,
        }

    if provider_id and not extra_data.get("provider_id"):
        extra_data = {
            **extra_data,
            "provider_id": provider_id,
            "provider": provider_id,
        }

    if center_id and not extra_data.get("center_id"):
        extra_data = {
            **extra_data,
            "center_id": center_id,
            "center": center_id,
        }

    if customer_id and not extra_data.get("customer_id"):
        extra_data = {
            **extra_data,
            "customer_id": customer_id,
            "customer": customer_id,
        }

    if agent_id and not extra_data.get("agent_id"):
        extra_data = {
            **extra_data,
            "agent_id": agent_id,
            "agent": agent_id,
        }

    if broker_id and not extra_data.get("broker_id"):
        extra_data = {
            **extra_data,
            "broker_id": broker_id,
            "broker": broker_id,
        }

    if entity_type and not extra_data.get("entity_type"):
        extra_data = {
            **extra_data,
            "entity_type": entity_type,
        }

    if entity_id and not extra_data.get("entity_id"):
        extra_data = {
            **extra_data,
            "entity_id": entity_id,
        }

    return extra_data


def _build_customer_context_payload(
    *,
    customer_id: int | None,
) -> dict[str, Any] | None:
    """
    معلومات خفيفة للعميل تفيد الفرونت بعد whoami.
    لا نرجع بيانات مالية أو حساسة هنا.
    """

    if not customer_id:
        return None

    customer = (
        Customer.objects
        .select_related(
            "user",
            "agent",
            "agent__user",
            "broker",
            "broker__user",
        )
        .filter(pk=customer_id)
        .first()
    )

    if not customer:
        return None

    user = getattr(customer, "user", None)
    agent = getattr(customer, "agent", None)
    broker = getattr(customer, "broker", None)

    return {
        "id": customer.pk,
        "customer_code": _safe_attr(customer, "customer_code"),
        "display_name": _safe_attr(customer, "display_name", "full_name", "company_name"),
        "full_name": _safe_attr(customer, "full_name", "display_name", "company_name"),
        "status": _safe_attr(customer, "status"),
        "source": _safe_attr(customer, "source"),
        "normalized_phone": _safe_attr(customer, "normalized_phone"),
        "phone_number": _safe_attr(customer, "phone_number"),
        "whatsapp_number": _safe_attr(customer, "whatsapp_number"),
        "email": _safe_attr(customer, "email"),
        "city": _safe_attr(customer, "city"),

        "agent_id": getattr(customer, "agent_id", None),
        "broker_id": getattr(customer, "broker_id", None),

        "agent": (
            {
                "id": agent.pk,
                "name": _safe_attr(agent, "full_name", "name"),
                "agent_code": _safe_attr(agent, "agent_code", "code"),
                "code": _safe_attr(agent, "agent_code", "code"),
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
                "name": _safe_attr(broker, "name", "full_name"),
                "broker_code": _safe_attr(broker, "broker_code", "code"),
                "code": _safe_attr(broker, "broker_code", "code"),
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
        "login_user": _serialize_login_user(user),

        "is_phone_verified": bool(getattr(customer, "is_phone_verified", False)),
        "is_whatsapp_verified": bool(getattr(customer, "is_whatsapp_verified", False)),
        "phone_verified_at": _iso_datetime(getattr(customer, "phone_verified_at", None)),
        "whatsapp_verified_at": _iso_datetime(getattr(customer, "whatsapp_verified_at", None)),
        "last_login_at": _iso_datetime(getattr(customer, "last_login_at", None)),
    }


def _build_provider_context_payload(
    *,
    provider_id: int | None,
) -> dict[str, Any] | None:
    """
    معلومات خفيفة لمقدم الخدمة المرتبط بحساب الدخول.
    """

    if not provider_id:
        return None

    queryset = Provider.objects.filter(pk=provider_id)

    if _model_has_field(Provider, "user"):
        queryset = queryset.select_related("user")

    provider = queryset.first()

    if not provider:
        return None

    user = getattr(provider, "user", None)

    display_name = (
        _safe_attr(provider, "name_ar")
        or _safe_attr(provider, "name")
        or _safe_attr(provider, "name_en")
        or ""
    )

    return {
        "id": provider.pk,
        "name": display_name,
        "display_name": display_name,
        "name_ar": _safe_attr(provider, "name_ar"),
        "name_en": _safe_attr(provider, "name_en"),
        "code": _safe_attr(provider, "code"),
        "provider_type": _safe_attr(provider, "provider_type"),
        "status": _safe_attr(provider, "status"),
        "city": _safe_attr(provider, "city"),
        "region": _safe_attr(provider, "region"),
        "area": _safe_attr(provider, "area"),
        "phone": _safe_attr(provider, "phone"),
        "mobile": _safe_attr(provider, "mobile"),
        "email": _safe_attr(provider, "email"),

        "user_id": getattr(provider, "user_id", None),
        "has_login_user": bool(getattr(provider, "user_id", None)),
        "login_user": _serialize_login_user(user),
    }


def _build_agent_context_payload(
    *,
    agent_id: int | None,
) -> dict[str, Any] | None:
    """
    معلومات خفيفة للمندوب المرتبط بحساب الدخول.
    """

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

    user = getattr(agent, "user", None)
    broker = getattr(agent, "broker", None)

    return {
        "id": agent.pk,
        "name": _safe_attr(agent, "full_name", "name"),
        "full_name": _safe_attr(agent, "full_name", "name"),
        "agent_code": _safe_attr(agent, "agent_code", "code"),
        "code": _safe_attr(agent, "agent_code", "code"),
        "referral_code": _safe_attr(agent, "referral_code"),
        "status": _safe_attr(agent, "status"),
        "phone": _safe_attr(agent, "phone", "phone_number"),
        "email": _safe_attr(agent, "email"),
        "city": _safe_attr(agent, "city"),

        "broker_id": getattr(agent, "broker_id", None),
        "broker": (
            {
                "id": broker.pk,
                "name": _safe_attr(broker, "name", "full_name"),
                "broker_code": _safe_attr(broker, "broker_code", "code"),
                "code": _safe_attr(broker, "broker_code", "code"),
                "user_id": getattr(broker, "user_id", None),
                "has_login_user": bool(getattr(broker, "user_id", None)),
                "login_user": _serialize_login_user(getattr(broker, "user", None)),
            }
            if broker
            else None
        ),

        "user_id": getattr(agent, "user_id", None),
        "has_login_user": bool(getattr(agent, "user_id", None)),
        "login_user": _serialize_login_user(user),
    }


def _build_broker_context_payload(
    *,
    broker_id: int | None,
) -> dict[str, Any] | None:
    """
    معلومات خفيفة للوسيط المرتبط بحساب الدخول.
    """

    if not broker_id:
        return None

    queryset = Broker.objects.filter(pk=broker_id)

    if _model_has_field(Broker, "user"):
        queryset = queryset.select_related("user")

    broker = queryset.first()

    if not broker:
        return None

    user = getattr(broker, "user", None)

    return {
        "id": broker.pk,
        "name": _safe_attr(broker, "name", "full_name"),
        "broker_name": _safe_attr(broker, "name", "full_name"),
        "broker_code": _safe_attr(broker, "broker_code", "code"),
        "code": _safe_attr(broker, "broker_code", "code"),
        "referral_code": _safe_attr(broker, "referral_code"),
        "status": _safe_attr(broker, "status"),
        "phone": _safe_attr(broker, "phone", "phone_number"),
        "email": _safe_attr(broker, "email"),
        "city": _safe_attr(broker, "city"),

        "user_id": getattr(broker, "user_id", None),
        "has_login_user": bool(getattr(broker, "user_id", None)),
        "login_user": _serialize_login_user(user),
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
# 🚀 API
# ===============================================================

@require_GET
def whoami_api(request):
    user = request.user

    if not user.is_authenticated:
        return JsonResponse(
            _anonymous_payload(),
            status=200,
            json_dumps_params={"ensure_ascii": False},
        )

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
    ) = _resolve_context_ids(
        profile,
        user=user,
    )

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
    profile_tags = _safe_list(profile.tags if profile else [])

    customer_payload = _build_customer_context_payload(
        customer_id=customer_id,
    )
    provider_payload = _build_provider_context_payload(
        provider_id=provider_id,
    )
    agent_payload = _build_agent_context_payload(
        agent_id=agent_id,
    )
    broker_payload = _build_broker_context_payload(
        broker_id=broker_id,
    )

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
        "tags": profile_tags,
        "extra_data": profile_extra_data,
    }

    session_payload = {
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
        "last_seen": _iso_datetime(getattr(active_session, "last_seen", None)) if active_session else None,
        "created_at": _iso_datetime(getattr(active_session, "created_at", None)) if active_session else None,
    }

    permissions_payload = {
        "is_superuser": bool(user.is_superuser),
        "is_staff": bool(user.is_staff),
        "groups": groups,
        "codes": permission_codes,
    }

    response_payload = {
        "ok": True,
        "success": True,
        "authenticated": True,

        # ---------------------------------------------------
        # ✅ Normalized top-level fields for frontend
        # ---------------------------------------------------
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
        # ✅ User / Profile payloads
        # ---------------------------------------------------
        "user": user_payload,
        "profile": profile_payload,

        # ---------------------------------------------------
        # ✅ Actor payloads
        # ---------------------------------------------------
        "customer": customer_payload,
        "provider": provider_payload,
        "agent": agent_payload,
        "broker": broker_payload,
        "actor": actor_payload,

        # ---------------------------------------------------
        # ✅ Session payload
        # ---------------------------------------------------
        "session": session_payload,

        # ---------------------------------------------------
        # ✅ Permissions payload
        # ---------------------------------------------------
        "permissions": permissions_payload,

        # ---------------------------------------------------
        # ✅ Compatibility payload from permissions core
        # ---------------------------------------------------
        "profile_permissions": {
            **permission_payload.get("profile_permissions", {}),
            "workspace": workspace,
            "extra_data": profile_extra_data,
        },

        # ---------------------------------------------------
        # ✅ Data wrapper for newer frontend helpers
        # ---------------------------------------------------
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

    return JsonResponse(
        response_payload,
        status=200,
        json_dumps_params={"ensure_ascii": False},
    )