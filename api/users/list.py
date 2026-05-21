# ===============================================================
# 📂 الملف: api/users/list.py
# 🧭 Primey Care — Users List API
# 🚀 الإصدار: Users List API V1.2 Actor-Link Ready
# ---------------------------------------------------------------
# ✅ List users
# ✅ Search / filter / pagination
# ✅ Session protected
# ✅ Protected by permissions: users.view
# ✅ يعرض حسابات الدخول فقط بدون تكرار بيانات الكيانات
# ✅ يدعم الربط التشغيلي:
#    - Customer.user
#    - Provider.user
#    - Agent.user
#    - Broker.user
# ✅ يدعم role / user_type / workspace / entity_type filters
# ✅ يدعم broker_user
# ===============================================================

from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.db.models import Count, Q
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from agents.models import Agent, Broker
from auth_center.models import RoleChoices
from auth_center.permissions import (
    PermissionCodes,
    get_user_role,
    get_user_workspace,
    permission_required,
)
from customers.models import Customer
from providers.models import Provider

User = get_user_model()


# ===============================================================
# 🧰 Helpers
# ===============================================================

def _normalize_upper(value: Any) -> str:
    return str(value or "").strip().upper()


def _normalize_lower(value: Any) -> str:
    return str(value or "").strip().lower()


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _safe_int(value: Any, default: int) -> int:
    try:
        parsed = int(value)
        return parsed if parsed > 0 else default
    except (TypeError, ValueError):
        return default


def _positive_int_or_none(value: Any) -> int | None:
    raw = _clean_text(value)

    if not raw:
        return None

    try:
        parsed = int(raw)
    except (TypeError, ValueError):
        return None

    return parsed if parsed > 0 else None


def _parse_bool_filter(value: Any) -> bool | None:
    normalized = _normalize_lower(value)

    if normalized in {"true", "1", "yes", "y", "on", "active", "نشط"}:
        return True

    if normalized in {"false", "0", "no", "n", "off", "inactive", "disabled", "غير_نشط"}:
        return False

    return None


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _safe_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _safe_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _safe_profile(user: Any):
    try:
        return user.profile
    except Exception:
        return None


def _profile_extra(profile: Any) -> dict[str, Any]:
    if not profile:
        return {}

    return _safe_dict(getattr(profile, "extra_data", {}) or {})


def _extract_id_from_profile(profile: Any, *keys: str) -> int | None:
    extra_data = _profile_extra(profile)

    for key in keys:
        value = extra_data.get(key)
        parsed = _positive_int_or_none(value)
        if parsed:
            return parsed

    return None


# ===============================================================
# 🔗 Actor Link Helpers
# ===============================================================

def _get_linked_customer(user: Any, profile: Any = None) -> Customer | None:
    customer_id = _extract_id_from_profile(profile, "customer_id", "customer")

    queryset = Customer.objects.select_related("agent", "broker").all()

    if customer_id:
        customer = queryset.filter(pk=customer_id).first()
        if customer:
            return customer

    return queryset.filter(user=user).first()


def _get_linked_provider(user: Any, profile: Any = None) -> Provider | None:
    provider_id = _extract_id_from_profile(profile, "provider_id", "provider", "service_provider_id")

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
# 🧾 Serializer
# ===============================================================

def _serialize_user(user) -> dict[str, Any]:
    profile = _safe_profile(user)
    groups = list(user.groups.values_list("name", flat=True))

    role = get_user_role(user)
    workspace = get_user_workspace(user)

    entity_payload = _resolve_entity_payload(
        user=user,
        profile=profile,
        role=role,
        workspace=workspace,
    )

    extra_data = _profile_extra(profile)

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
        "last_login": _iso_datetime(user.last_login),
        "date_joined": _iso_datetime(user.date_joined),
        "groups": groups,

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

        "profile": {
            "display_name": profile.display_name if profile else "",
            "user_type": profile.user_type if profile else "OTHER",
            "role": profile.role if profile else RoleChoices.VIEWER,
            "workspace": workspace,
            "phone_number": profile.phone_number if profile else None,
            "whatsapp_number": profile.whatsapp_number if profile else None,
            "alternate_email": profile.alternate_email if profile else None,
            "preferred_language": profile.preferred_language if profile else "ar",
            "timezone": profile.timezone if profile else "Asia/Riyadh",
            "is_phone_verified": profile.is_phone_verified if profile else False,
            "is_whatsapp_verified": profile.is_whatsapp_verified if profile else False,
            "is_email_verified": profile.is_email_verified if profile else False,
            "is_profile_completed": profile.is_profile_completed if profile else False,
            "extra_data": extra_data,
            "tags": _safe_list(profile.tags if profile else []),
        },
    }


# ===============================================================
# 🔍 Query Builder
# ===============================================================

def _build_queryset(request):
    q = _clean_text(request.GET.get("q") or request.GET.get("search"))
    user_type = _normalize_upper(request.GET.get("user_type", ""))
    role = _normalize_lower(request.GET.get("role", ""))
    workspace = _normalize_lower(request.GET.get("workspace", ""))
    entity_type = _normalize_lower(request.GET.get("entity_type", ""))
    is_active = _parse_bool_filter(request.GET.get("is_active"))

    queryset = (
        User.objects.all()
        .select_related("profile")
        .prefetch_related("groups")
        .order_by("-date_joined", "-id")
    )

    if q:
        queryset = queryset.filter(
            Q(username__icontains=q)
            | Q(email__icontains=q)
            | Q(first_name__icontains=q)
            | Q(last_name__icontains=q)
            | Q(profile__display_name__icontains=q)
            | Q(profile__phone_number__icontains=q)
            | Q(profile__whatsapp_number__icontains=q)
            | Q(profile__alternate_email__icontains=q)
            | Q(profile__extra_data__icontains=q)
            | Q(groups__name__icontains=q)
        ).distinct()

    if user_type:
        queryset = queryset.filter(profile__user_type=user_type)

    if role:
        queryset = queryset.filter(profile__role=role)

    if is_active is not None:
        queryset = queryset.filter(is_active=is_active)

    if workspace:
        # فلترة تقريبية حسب الدور/النوع؛ التحديد النهائي يظهر في serializer.
        if workspace == "system":
            queryset = queryset.filter(
                Q(is_superuser=True)
                | Q(is_staff=True)
                | Q(profile__role__in=[
                    RoleChoices.SYSTEM_ADMIN,
                    RoleChoices.ACCOUNTANT,
                    RoleChoices.SUPPORT,
                    RoleChoices.VIEWER,
                ])
                | Q(profile__user_type__in=[
                    "SUPER_ADMIN",
                    "SYSTEM",
                    "STAFF",
                    "ACCOUNTANT",
                ])
            )

        elif workspace == "provider":
            queryset = queryset.filter(
                Q(profile__role=RoleChoices.PROVIDER_ADMIN)
                | Q(profile__user_type__in=["PROVIDER", "CENTER"])
            )

        elif workspace == "customer":
            queryset = queryset.filter(
                Q(profile__role=RoleChoices.CUSTOMER_USER)
                | Q(profile__user_type="CUSTOMER")
            )

        elif workspace == "agent":
            queryset = queryset.filter(
                Q(profile__role__in=[
                    RoleChoices.AGENT_USER,
                    RoleChoices.BROKER_USER,
                ])
                | Q(profile__user_type__in=["AGENT", "BROKER"])
            )

    if entity_type:
        if entity_type == "customer":
            queryset = queryset.filter(
                Q(profile__user_type="CUSTOMER")
                | Q(profile__role=RoleChoices.CUSTOMER_USER)
                | Q(profile__extra_data__has_key="customer_id")
            )

        elif entity_type == "provider":
            queryset = queryset.filter(
                Q(profile__user_type="PROVIDER")
                | Q(profile__role=RoleChoices.PROVIDER_ADMIN)
                | Q(profile__extra_data__has_key="provider_id")
            )

        elif entity_type == "agent":
            queryset = queryset.filter(
                Q(profile__user_type="AGENT")
                | Q(profile__role=RoleChoices.AGENT_USER)
                | Q(profile__extra_data__has_key="agent_id")
            )

        elif entity_type == "broker":
            queryset = queryset.filter(
                Q(profile__user_type="BROKER")
                | Q(profile__role=RoleChoices.BROKER_USER)
                | Q(profile__extra_data__has_key="broker_id")
            )

        elif entity_type == "system":
            queryset = queryset.filter(
                Q(is_superuser=True)
                | Q(is_staff=True)
                | Q(profile__role__in=[
                    RoleChoices.SYSTEM_ADMIN,
                    RoleChoices.ACCOUNTANT,
                    RoleChoices.SUPPORT,
                    RoleChoices.VIEWER,
                ])
            )

    return queryset


def _build_summary() -> dict[str, Any]:
    base_queryset = User.objects.select_related("profile").all()

    role_counts = {
        item["profile__role"] or "unknown": item["total"]
        for item in base_queryset.values("profile__role").annotate(total=Count("id"))
    }

    user_type_counts = {
        item["profile__user_type"] or "OTHER": item["total"]
        for item in base_queryset.values("profile__user_type").annotate(total=Count("id"))
    }

    return {
        "total": base_queryset.count(),
        "active": base_queryset.filter(is_active=True).count(),
        "inactive": base_queryset.filter(is_active=False).count(),
        "staff": base_queryset.filter(is_staff=True).count(),
        "superusers": base_queryset.filter(is_superuser=True).count(),

        "system_admin": role_counts.get(RoleChoices.SYSTEM_ADMIN, 0),
        "accountant": role_counts.get(RoleChoices.ACCOUNTANT, 0),
        "support": role_counts.get(RoleChoices.SUPPORT, 0),
        "viewer": role_counts.get(RoleChoices.VIEWER, 0),
        "provider_admin": role_counts.get(RoleChoices.PROVIDER_ADMIN, 0),
        "customer_user": role_counts.get(RoleChoices.CUSTOMER_USER, 0),
        "agent_user": role_counts.get(RoleChoices.AGENT_USER, 0),
        "broker_user": role_counts.get(RoleChoices.BROKER_USER, 0),

        "providers": user_type_counts.get("PROVIDER", 0),
        "customers": user_type_counts.get("CUSTOMER", 0),
        "agents": user_type_counts.get("AGENT", 0),
        "brokers": user_type_counts.get("BROKER", 0),
    }


# ===============================================================
# 🌐 API
# ===============================================================

@login_required
@require_GET
@permission_required(PermissionCodes.USERS_VIEW)
def users_list_api(request):
    page = _safe_int(request.GET.get("page"), 1)
    per_page = _safe_int(
        request.GET.get("per_page") or request.GET.get("page_size"),
        20,
    )
    per_page = min(per_page, 100)

    queryset = _build_queryset(request)

    total = queryset.count()
    start = (page - 1) * per_page
    end = start + per_page

    users = [_serialize_user(user) for user in queryset[start:end]]
    total_pages = (total + per_page - 1) // per_page if per_page else 1

    return JsonResponse(
        {
            "ok": True,
            "success": True,
            "message": "Users loaded successfully.",
            "count": total,
            "page": page,
            "page_size": per_page,
            "per_page": per_page,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_previous": page > 1,
            "summary": _build_summary(),
            "results": users,
            "users": users,
            "data": users,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "page_size": per_page,
                "total": total,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_previous": page > 1,
            },
        },
        status=200,
        json_dumps_params={"ensure_ascii": False},
    )