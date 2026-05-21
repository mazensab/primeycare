# ============================================================
# 📂 api/customers/list.py
# 🧠 Primey Care | Customers List & Create API V3 Login-User Ready
# ------------------------------------------------------------
# ✅ GET  /api/customers/  -> قائمة العملاء
# ✅ POST /api/customers/  -> إنشاء عميل جديد من النظام
# ✅ يدعم البحث والفلاتر والترقيم
# ✅ يدعم حساب دخول العميل فعليًا:
#    - create_login_user / create_user / create_account
#    - login_username / login_email / login_password
#    - login_display_name / login_phone / login_whatsapp
#    - Customer.user
#    - UserProfile:
#      user_type = CUSTOMER
#      role = customer_user
#      workspace = customer
#      entity_type = customer
#      entity_id = customer.id
# ✅ fallback آمن إلى customers.services.create_customer_user_if_missing
# ✅ يدعم العلاقة التجارية:
#    - Customer.agent
#    - Customer.broker
# ✅ يعرض حساب دخول العميل/المندوب/الوسيط
# ✅ Protected by permissions:
#    - GET  customers.view
#    - POST customers.create
# ============================================================

from __future__ import annotations

import json
import logging
from typing import Any

from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator
from django.db import transaction
from django.db.models import Q, QuerySet
from django.http import HttpRequest, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods

from auth_center.permissions import PermissionCodes, has_permission
from auth_center.services import create_actor_user
from customers.models import Customer, normalize_customer_phone
from customers.services import (
    create_customer_user_if_missing,
    resolve_customer_assignment,
)

logger = logging.getLogger(__name__)


# ============================================================
# 🔧 Response Helpers
# ============================================================

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


def _json_success(data: dict[str, Any], status: int = 200) -> JsonResponse:
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


def _forbidden(required_permission: str) -> JsonResponse:
    return _json_error(
        "غير مصرح لك بتنفيذ هذا الإجراء.",
        status=403,
        errors={"required_permission": [required_permission]},
    )


# ============================================================
# 🧰 Parsing Helpers
# ============================================================

def _parse_json_body(request: HttpRequest) -> dict[str, Any]:
    if not request.body:
        return {}

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        raise ValueError("صيغة JSON غير صحيحة.")

    if not isinstance(payload, dict):
        raise ValueError("صيغة البيانات غير صحيحة.")

    return payload


def _safe_int(
    value: Any,
    default: int,
    *,
    minimum: int = 1,
    maximum: int = 200,
) -> int:
    try:
        number = int(value or default)
    except (TypeError, ValueError):
        number = default

    return max(minimum, min(number, maximum))


def _positive_int_or_none(value: Any) -> int | None:
    raw = _clean_string(value)

    if not raw:
        return None

    try:
        parsed = int(raw)
    except (TypeError, ValueError):
        return None

    return parsed if parsed > 0 else None


def _clean_string(value: Any) -> str:
    if value is None:
        return ""

    return str(value).strip()


def _clean_email(value: Any) -> str:
    return _clean_string(value).lower()


def _clean_tags(value: Any) -> str:
    if value is None:
        return ""

    if isinstance(value, list):
        return ", ".join(
            _clean_string(item)
            for item in value
            if _clean_string(item)
        )

    return _clean_string(value)


def _parse_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default

    if isinstance(value, bool):
        return value

    normalized = str(value).strip().lower()

    if normalized in {"1", "true", "yes", "y", "on", "نعم", "صح", "active"}:
        return True

    if normalized in {"0", "false", "no", "n", "off", "لا", "خطأ", "inactive"}:
        return False

    return default


def _parse_bool_filter(value: Any) -> bool | None:
    if value in (None, ""):
        return None

    if isinstance(value, bool):
        return value

    normalized = str(value).strip().lower()

    if normalized in {"1", "true", "yes", "y", "on", "نعم", "صح", "active"}:
        return True

    if normalized in {"0", "false", "no", "n", "off", "لا", "خطأ", "inactive"}:
        return False

    return None


def _normalize_choice(value: Any, allowed: set[str], default: str) -> str:
    cleaned = _clean_string(value)

    if not cleaned:
        return default

    normalized = cleaned.lower()

    return normalized if normalized in allowed else default


def _normalize_optional_choice(value: Any, allowed: set[str]) -> str:
    cleaned = _clean_string(value)

    if not cleaned:
        return ""

    normalized = cleaned.lower()

    return normalized if normalized in allowed else ""


def _validation_errors(exc: ValidationError) -> dict[str, Any]:
    if hasattr(exc, "message_dict"):
        return exc.message_dict

    if hasattr(exc, "messages"):
        return {"__all__": exc.messages}

    return {"__all__": [str(exc)]}


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _safe_getattr(instance: Any, field_name: str, fallback: Any = "") -> Any:
    return getattr(instance, field_name, fallback)


def _customer_display_name(customer: Customer) -> str:
    if customer.customer_type == Customer.CustomerType.CORPORATE:
        return customer.company_name or customer.display_name or str(customer)

    full_name = " ".join(
        part for part in [customer.first_name, customer.last_name] if part
    ).strip()

    return full_name or customer.display_name or customer.phone_number or customer.whatsapp_number or str(customer)


# ============================================================
# ✅ Choice Sets
# ============================================================

CUSTOMER_TYPE_VALUES = {
    Customer.CustomerType.INDIVIDUAL,
    Customer.CustomerType.CORPORATE,
}

STATUS_VALUES = {
    Customer.Status.ACTIVE,
    Customer.Status.INACTIVE,
    Customer.Status.BLOCKED,
    Customer.Status.LEAD,
}

SOURCE_VALUES = {
    Customer.Source.WEBSITE,
    Customer.Source.WHATSAPP,
    Customer.Source.AGENT,
    Customer.Source.BROKER,
    Customer.Source.ADMIN,
    Customer.Source.IMPORT,
    Customer.Source.OTHER,
}

GENDER_VALUES = {
    Customer.Gender.MALE,
    Customer.Gender.FEMALE,
    Customer.Gender.NOT_SPECIFIED,
}


# ============================================================
# 🧾 Serialization
# ============================================================

def _serialize_user(user: Any | None) -> dict[str, Any] | None:
    if not user:
        return None

    full_name = ""
    try:
        full_name = (user.get_full_name() or "").strip()
    except Exception:
        full_name = ""

    return {
        "id": getattr(user, "pk", None),
        "username": getattr(user, "username", ""),
        "email": getattr(user, "email", ""),
        "first_name": getattr(user, "first_name", ""),
        "last_name": getattr(user, "last_name", ""),
        "full_name": full_name,
        "is_active": bool(getattr(user, "is_active", False)),
        "is_staff": bool(getattr(user, "is_staff", False)),
        "is_superuser": bool(getattr(user, "is_superuser", False)),
        "last_login": _iso_datetime(getattr(user, "last_login", None)),
        "date_joined": _iso_datetime(getattr(user, "date_joined", None)),
    }


def _serialize_agent(agent: Any | None) -> dict[str, Any] | None:
    if not agent:
        return None

    user = getattr(agent, "user", None)
    broker = getattr(agent, "broker", None)

    return {
        "id": getattr(agent, "pk", None),
        "agent_code": getattr(agent, "agent_code", "") or "",
        "code": getattr(agent, "agent_code", "") or "",
        "name": getattr(agent, "full_name", "") or str(agent),
        "full_name": getattr(agent, "full_name", "") or str(agent),
        "referral_code": getattr(agent, "referral_code", "") or "",
        "status": getattr(agent, "status", "") or "",
        "phone": getattr(agent, "phone", "") or "",
        "email": getattr(agent, "email", "") or "",
        "city": getattr(agent, "city", "") or "",
        "broker_id": getattr(agent, "broker_id", None),
        "broker_name": getattr(broker, "name", "") if broker else "",
        "user_id": getattr(agent, "user_id", None),
        "has_login_user": bool(getattr(agent, "user_id", None)),
        "login_user": _serialize_user(user),
    }


def _serialize_broker(broker: Any | None) -> dict[str, Any] | None:
    if not broker:
        return None

    user = getattr(broker, "user", None)

    return {
        "id": getattr(broker, "pk", None),
        "broker_code": getattr(broker, "broker_code", "") or "",
        "code": getattr(broker, "broker_code", "") or "",
        "name": getattr(broker, "name", "") or str(broker),
        "broker_name": getattr(broker, "name", "") or str(broker),
        "referral_code": getattr(broker, "referral_code", "") or "",
        "status": getattr(broker, "status", "") or "",
        "phone": getattr(broker, "phone", "") or "",
        "email": getattr(broker, "email", "") or "",
        "city": getattr(broker, "city", "") or "",
        "user_id": getattr(broker, "user_id", None),
        "has_login_user": bool(getattr(broker, "user_id", None)),
        "login_user": _serialize_user(user),
    }


def serialize_customer(customer: Customer) -> dict[str, Any]:
    user = getattr(customer, "user", None)
    agent = getattr(customer, "agent", None)
    broker = getattr(customer, "broker", None)

    agent_payload = _serialize_agent(agent)
    broker_payload = _serialize_broker(broker)

    return {
        "id": customer.pk,
        "customer_code": customer.customer_code or "",
        "customer_type": customer.customer_type,
        "status": customer.status,
        "source": customer.source,

        "agent_id": customer.agent_id,
        "broker_id": customer.broker_id,
        "agent_name": (
            getattr(customer, "agent_name", "")
            if hasattr(customer, "agent_name")
            else (agent_payload or {}).get("name", "")
        ),
        "broker_name": (
            getattr(customer, "broker_name", "")
            if hasattr(customer, "broker_name")
            else (broker_payload or {}).get("name", "")
        ),
        "assigned_agent": agent_payload,
        "agent": agent_payload,
        "assigned_broker": broker_payload,
        "broker": broker_payload,

        "agent_user_id": (agent_payload or {}).get("user_id") if agent_payload else None,
        "agent_has_login_user": (agent_payload or {}).get("has_login_user") if agent_payload else False,
        "broker_user_id": (broker_payload or {}).get("user_id") if broker_payload else None,
        "broker_has_login_user": (broker_payload or {}).get("has_login_user") if broker_payload else False,

        "user_id": customer.user_id,
        "user_username": user.username if user else "",
        "login_user": _serialize_user(user),
        "has_customer_account": bool(
            getattr(customer, "has_customer_account", False)
            or getattr(customer, "user_id", None)
        ),
        "normalized_phone": customer.normalized_phone or "",
        "login_identifier": getattr(customer, "login_identifier", "") or "",
        "is_phone_verified": bool(getattr(customer, "is_phone_verified", False)),
        "is_whatsapp_verified": bool(getattr(customer, "is_whatsapp_verified", False)),
        "phone_verified_at": _iso_datetime(customer.phone_verified_at),
        "whatsapp_verified_at": _iso_datetime(customer.whatsapp_verified_at),
        "last_login_at": _iso_datetime(customer.last_login_at),

        "first_name": customer.first_name or "",
        "last_name": customer.last_name or "",
        "company_name": customer.company_name or "",
        "display_name": customer.display_name or "",
        "full_name": customer.full_name,
        "gender": customer.gender,
        "date_of_birth": (
            customer.date_of_birth.isoformat()
            if customer.date_of_birth
            else None
        ),
        "national_id": customer.national_id or "",
        "passport_number": customer.passport_number or "",
        "nationality": customer.nationality or "",
        "email": customer.email or "",
        "phone_number": customer.phone_number or "",
        "whatsapp_number": customer.whatsapp_number or "",
        "alternative_phone_number": customer.alternative_phone_number or "",
        "primary_contact_number": customer.primary_contact_number,
        "country": customer.country or "",
        "city": customer.city or "",
        "district": customer.district or "",
        "street_address": customer.street_address or "",
        "postal_code": customer.postal_code or "",
        "national_address_text": customer.national_address_text or "",
        "notes": customer.notes or "",
        "tags": customer.tags or "",

        "created_by_id": customer.created_by_id,
        "updated_by_id": customer.updated_by_id,
        "created_at": _iso_datetime(customer.created_at),
        "updated_at": _iso_datetime(customer.updated_at),
    }


# ============================================================
# 🔐 Customer Login User Creation
# ============================================================

def _create_login_user_for_customer(
    *,
    customer: Customer,
    payload: dict[str, Any],
    actor: Any,
) -> tuple[Any | None, bool, bool, str]:
    """
    ينشئ ويربط حساب دخول للعميل عبر auth_center.services.create_actor_user.
    fallback إلى create_customer_user_if_missing إذا تعذر المسار المركزي.
    return:
        user, created, linked, message
    """

    display_name = (
        _clean_string(payload.get("login_display_name"))
        or _clean_string(payload.get("display_name"))
        or _customer_display_name(customer)
    )

    login_email = (
        _clean_email(payload.get("login_email"))
        or _clean_email(payload.get("user_email"))
        or _clean_email(payload.get("email"))
        or None
    )

    login_username = (
        _clean_string(payload.get("login_username"))
        or _clean_string(payload.get("username"))
        or None
    )

    login_phone = (
        _clean_string(payload.get("login_phone"))
        or _clean_string(payload.get("login_phone_number"))
        or _clean_string(payload.get("phone_number"))
        or _clean_string(payload.get("phone"))
        or _clean_string(customer.phone_number)
        or _clean_string(customer.whatsapp_number)
        or None
    )

    login_whatsapp = (
        _clean_string(payload.get("login_whatsapp"))
        or _clean_string(payload.get("login_whatsapp_number"))
        or _clean_string(payload.get("whatsapp_number"))
        or _clean_string(payload.get("whatsapp"))
        or _clean_string(customer.whatsapp_number)
        or _clean_string(customer.phone_number)
        or None
    )

    password = (
        _clean_string(payload.get("login_password"))
        or _clean_string(payload.get("password"))
        or None
    )

    if not login_email and not login_username and not login_phone and not login_whatsapp:
        raise ValidationError({
            "login_user": [
                "لا يمكن إنشاء حساب دخول للعميل بدون بريد أو اسم مستخدم أو رقم جوال."
            ]
        })

    try:
        result = create_actor_user(
            user_type="CUSTOMER",
            role="customer_user",
            email=login_email,
            username=login_username,
            password=password,
            first_name=customer.first_name or None,
            last_name=customer.last_name or None,
            display_name=display_name or None,
            phone_number=login_phone,
            whatsapp_number=login_whatsapp,
            alternate_email=None,
            preferred_language=_clean_string(payload.get("preferred_language")) or "ar",
            timezone=_clean_string(payload.get("timezone")) or "Asia/Riyadh",
            entity_type="customer",
            entity_id=customer.pk,
            customer_id=customer.pk,
            is_active=True,
            is_staff=False,
            is_superuser=False,
            extra_data={
                "source": "api_customers_create",
                "customer_id": customer.pk,
                "entity_type": "customer",
                "entity_id": customer.pk,
                "workspace": "customer",
                "created_by_user_id": getattr(actor, "pk", None),
            },
            tags=["customer"],
            create_group=True,
            update_existing=True,
        )

        user = result.user

        if getattr(customer, "user_id", None) != getattr(user, "pk", None):
            customer.user = user
            customer.save(update_fields=["user", "updated_at"])

        return user, bool(result.created), bool(getattr(result, "linked", True)), result.message

    except Exception as exc:
        logger.warning(
            "create_actor_user failed for customer=%s, fallback will be used | error=%s",
            customer.pk,
            exc,
        )

        user, created = create_customer_user_if_missing(customer)

        if user and getattr(customer, "user_id", None) != getattr(user, "pk", None):
            customer.user = user
            customer.save(update_fields=["user", "updated_at"])

        return user, bool(created), bool(user), "تم إنشاء/ربط حساب العميل عبر المسار الاحتياطي."


# ============================================================
# 🔍 Query Builder
# ============================================================

def _build_customers_queryset(request: HttpRequest) -> QuerySet[Customer]:
    queryset = (
        Customer.objects
        .select_related(
            "user",
            "agent",
            "agent__user",
            "agent__broker",
            "agent__broker__user",
            "broker",
            "broker__user",
            "created_by",
            "updated_by",
        )
        .all()
    )

    query = _clean_string(request.GET.get("q") or request.GET.get("search"))
    status = _normalize_optional_choice(request.GET.get("status"), STATUS_VALUES)
    customer_type = _normalize_optional_choice(
        request.GET.get("customer_type") or request.GET.get("type"),
        CUSTOMER_TYPE_VALUES,
    )
    source = _normalize_optional_choice(request.GET.get("source"), SOURCE_VALUES)
    city = _clean_string(request.GET.get("city"))

    agent_id = _positive_int_or_none(
        request.GET.get("agent_id")
        or request.GET.get("agent")
        or request.GET.get("sales_agent_id")
    )
    broker_id = _positive_int_or_none(
        request.GET.get("broker_id")
        or request.GET.get("broker")
    )

    account_status = _clean_string(
        request.GET.get("account_status")
        or request.GET.get("account")
    ).lower()

    verified = _clean_string(
        request.GET.get("verified")
        or request.GET.get("verification")
    ).lower()

    has_customer_account = _parse_bool_filter(
        request.GET.get("has_customer_account")
        or request.GET.get("has_account")
    )
    has_agent = _parse_bool_filter(request.GET.get("has_agent"))
    has_broker = _parse_bool_filter(request.GET.get("has_broker"))
    agent_has_login_user = _parse_bool_filter(request.GET.get("agent_has_login_user"))
    broker_has_login_user = _parse_bool_filter(request.GET.get("broker_has_login_user"))

    if query:
        normalized_query_phone = normalize_customer_phone(query)
        numeric_query = _positive_int_or_none(query)

        search_filter = (
            Q(customer_code__icontains=query)
            | Q(display_name__icontains=query)
            | Q(first_name__icontains=query)
            | Q(last_name__icontains=query)
            | Q(company_name__icontains=query)
            | Q(email__icontains=query)
            | Q(phone_number__icontains=query)
            | Q(whatsapp_number__icontains=query)
            | Q(normalized_phone__icontains=query)
            | Q(national_id__icontains=query)
            | Q(passport_number__icontains=query)
            | Q(city__icontains=query)
            | Q(tags__icontains=query)
            | Q(user__username__icontains=query)
            | Q(user__email__icontains=query)
            | Q(user__first_name__icontains=query)
            | Q(user__last_name__icontains=query)
            | Q(agent__full_name__icontains=query)
            | Q(agent__agent_code__icontains=query)
            | Q(agent__referral_code__icontains=query)
            | Q(agent__phone__icontains=query)
            | Q(agent__email__icontains=query)
            | Q(agent__user__username__icontains=query)
            | Q(agent__user__email__icontains=query)
            | Q(broker__name__icontains=query)
            | Q(broker__broker_code__icontains=query)
            | Q(broker__referral_code__icontains=query)
            | Q(broker__phone__icontains=query)
            | Q(broker__email__icontains=query)
            | Q(broker__user__username__icontains=query)
            | Q(broker__user__email__icontains=query)
        )

        if normalized_query_phone:
            search_filter |= Q(normalized_phone__icontains=normalized_query_phone)

        if numeric_query:
            search_filter |= Q(pk=numeric_query)

        queryset = queryset.filter(search_filter)

    if status:
        queryset = queryset.filter(status=status)

    if customer_type:
        queryset = queryset.filter(customer_type=customer_type)

    if source:
        queryset = queryset.filter(source=source)

    if city:
        queryset = queryset.filter(city__icontains=city)

    if agent_id:
        queryset = queryset.filter(agent_id=agent_id)

    if broker_id:
        queryset = queryset.filter(broker_id=broker_id)

    if has_customer_account is True:
        queryset = queryset.filter(user__isnull=False)
    elif has_customer_account is False:
        queryset = queryset.filter(user__isnull=True)

    if has_agent is True:
        queryset = queryset.filter(agent__isnull=False)
    elif has_agent is False:
        queryset = queryset.filter(agent__isnull=True)

    if has_broker is True:
        queryset = queryset.filter(broker__isnull=False)
    elif has_broker is False:
        queryset = queryset.filter(broker__isnull=True)

    if agent_has_login_user is True:
        queryset = queryset.filter(agent__user__isnull=False)
    elif agent_has_login_user is False:
        queryset = queryset.filter(agent__isnull=False, agent__user__isnull=True)

    if broker_has_login_user is True:
        queryset = queryset.filter(broker__user__isnull=False)
    elif broker_has_login_user is False:
        queryset = queryset.filter(broker__isnull=False, broker__user__isnull=True)

    if account_status in {"linked", "has_account", "with_account"}:
        queryset = queryset.filter(user__isnull=False)

    if account_status in {"missing", "no_account", "without_account"}:
        queryset = queryset.filter(user__isnull=True)

    if account_status in {"with_agent", "has_agent"}:
        queryset = queryset.filter(agent__isnull=False)

    if account_status in {"without_agent", "no_agent"}:
        queryset = queryset.filter(agent__isnull=True)

    if account_status in {"with_broker", "has_broker"}:
        queryset = queryset.filter(broker__isnull=False)

    if account_status in {"without_broker", "no_broker"}:
        queryset = queryset.filter(broker__isnull=True)

    if verified in {"phone", "phone_verified"}:
        queryset = queryset.filter(phone_verified_at__isnull=False)

    if verified in {"whatsapp", "whatsapp_verified"}:
        queryset = queryset.filter(whatsapp_verified_at__isnull=False)

    if verified in {"unverified", "not_verified"}:
        queryset = queryset.filter(
            phone_verified_at__isnull=True,
            whatsapp_verified_at__isnull=True,
        )

    ordering = _clean_string(request.GET.get("ordering")) or "-created_at"
    allowed_ordering = {
        "created_at",
        "-created_at",
        "updated_at",
        "-updated_at",
        "last_login_at",
        "-last_login_at",
        "display_name",
        "-display_name",
        "customer_code",
        "-customer_code",
        "status",
        "-status",
        "customer_type",
        "-customer_type",
        "source",
        "-source",
        "city",
        "-city",
        "normalized_phone",
        "-normalized_phone",
        "agent__full_name",
        "-agent__full_name",
        "broker__name",
        "-broker__name",
    }

    if ordering not in allowed_ordering:
        ordering = "-created_at"

    return queryset.order_by(ordering)


# ============================================================
# 📥 Create Customer
# ============================================================

def _create_customer(request: HttpRequest) -> JsonResponse:
    try:
        payload = _parse_json_body(request)

        customer_type = _normalize_choice(
            payload.get("customer_type"),
            CUSTOMER_TYPE_VALUES,
            Customer.CustomerType.INDIVIDUAL,
        )
        status = _normalize_choice(
            payload.get("status"),
            STATUS_VALUES,
            Customer.Status.ACTIVE,
        )
        source = _normalize_choice(
            payload.get("source"),
            SOURCE_VALUES,
            Customer.Source.ADMIN,
        )
        gender = _normalize_choice(
            payload.get("gender"),
            GENDER_VALUES,
            Customer.Gender.NOT_SPECIFIED,
        )

        resolved_agent, resolved_broker = resolve_customer_assignment(payload)

        if resolved_agent and not payload.get("source"):
            source = Customer.Source.AGENT

        if resolved_broker and not resolved_agent and not payload.get("source"):
            source = Customer.Source.BROKER

        phone_number = _clean_string(
            payload.get("phone_number")
            or payload.get("phone")
            or payload.get("mobile")
        )
        whatsapp_number = _clean_string(
            payload.get("whatsapp_number")
            or payload.get("whatsapp")
            or phone_number
        )
        normalized_phone = normalize_customer_phone(
            payload.get("normalized_phone")
            or whatsapp_number
            or phone_number
        ) or None

        create_login_user = _parse_bool(
            payload.get("create_login_user")
            if "create_login_user" in payload
            else payload.get("create_user")
            if "create_user" in payload
            else payload.get("create_account"),
            default=False,
        )

        now = timezone.now()

        is_phone_verified = _parse_bool(
            payload.get("is_phone_verified")
            or payload.get("phone_verified"),
            default=False,
        )
        is_whatsapp_verified = _parse_bool(
            payload.get("is_whatsapp_verified")
            or payload.get("whatsapp_verified"),
            default=False,
        )

        login_user = None
        login_user_created = False
        login_user_linked = False
        login_message = ""

        with transaction.atomic():
            customer = Customer(
                customer_type=customer_type,
                status=status,
                source=source,
                agent=resolved_agent,
                broker=resolved_broker,
                normalized_phone=normalized_phone,
                first_name=_clean_string(payload.get("first_name")),
                last_name=_clean_string(payload.get("last_name")),
                company_name=_clean_string(payload.get("company_name")),
                display_name=_clean_string(payload.get("display_name")),
                gender=gender,
                date_of_birth=payload.get("date_of_birth") or None,
                national_id=_clean_string(payload.get("national_id")),
                passport_number=_clean_string(payload.get("passport_number")),
                nationality=_clean_string(payload.get("nationality")),
                email=_clean_email(payload.get("email")),
                phone_number=phone_number,
                whatsapp_number=whatsapp_number,
                alternative_phone_number=_clean_string(
                    payload.get("alternative_phone_number")
                    or payload.get("alternative_phone")
                ),
                country=_clean_string(payload.get("country")),
                city=_clean_string(payload.get("city")),
                district=_clean_string(payload.get("district")),
                street_address=_clean_string(payload.get("street_address")),
                postal_code=_clean_string(payload.get("postal_code")),
                national_address_text=_clean_string(
                    payload.get("national_address_text")
                ),
                notes=_clean_string(payload.get("notes")),
                tags=_clean_tags(payload.get("tags")),
                created_by=request.user if request.user.is_authenticated else None,
                updated_by=request.user if request.user.is_authenticated else None,
            )

            if is_phone_verified and hasattr(customer, "phone_verified_at"):
                customer.phone_verified_at = now

            if is_whatsapp_verified and hasattr(customer, "whatsapp_verified_at"):
                customer.whatsapp_verified_at = now

            customer.full_clean()
            customer.save()

            if create_login_user:
                login_user, login_user_created, login_user_linked, login_message = (
                    _create_login_user_for_customer(
                        customer=customer,
                        payload=payload,
                        actor=request.user,
                    )
                )

            customer = (
                Customer.objects
                .select_related(
                    "user",
                    "agent",
                    "agent__user",
                    "agent__broker",
                    "agent__broker__user",
                    "broker",
                    "broker__user",
                    "created_by",
                    "updated_by",
                )
                .get(pk=customer.pk)
            )

        customer_payload = serialize_customer(customer)

        return _json_success(
            {
                "message": (
                    "تم إنشاء العميل وحساب الدخول بنجاح."
                    if create_login_user and customer_payload.get("has_customer_account")
                    else "تم إنشاء العميل بنجاح."
                ),
                "customer": customer_payload,
                "item": customer_payload,
                "data": {
                    "customer": customer_payload,
                    "created_user": login_user_created,
                    "login_user_created": login_user_created,
                    "login_user_linked": login_user_linked,
                    "login_message": login_message,
                    "login_user": _serialize_user(login_user),
                },
                "created_user": login_user_created,
                "login_user_created": login_user_created,
                "login_user_linked": login_user_linked,
                "login_message": login_message,
                "login_user": _serialize_user(login_user),
            },
            status=201,
        )

    except ValueError as exc:
        return _json_error(str(exc), status=400)

    except ValidationError as exc:
        return _json_error(
            "بيانات العميل غير صحيحة.",
            status=400,
            errors=_validation_errors(exc),
        )

    except Exception as exc:
        logger.exception("Failed to create customer | error=%s", exc)
        return _json_error("تعذر إنشاء العميل.", status=500)


# ============================================================
# 📤 List Customers
# ============================================================

def _build_summary(queryset: QuerySet[Customer]) -> dict[str, Any]:
    return {
        "total": queryset.count(),

        "active": queryset.filter(status=Customer.Status.ACTIVE).count(),
        "inactive": queryset.filter(status=Customer.Status.INACTIVE).count(),
        "blocked": queryset.filter(status=Customer.Status.BLOCKED).count(),
        "lead": queryset.filter(status=Customer.Status.LEAD).count(),

        "individual": queryset.filter(
            customer_type=Customer.CustomerType.INDIVIDUAL
        ).count(),
        "corporate": queryset.filter(
            customer_type=Customer.CustomerType.CORPORATE
        ).count(),

        "with_account": queryset.filter(user__isnull=False).count(),
        "without_account": queryset.filter(user__isnull=True).count(),

        "with_agent": queryset.filter(agent__isnull=False).count(),
        "without_agent": queryset.filter(agent__isnull=True).count(),

        "with_broker": queryset.filter(broker__isnull=False).count(),
        "without_broker": queryset.filter(broker__isnull=True).count(),

        "with_agent_login_user": queryset.filter(agent__user__isnull=False).count(),
        "with_broker_login_user": queryset.filter(broker__user__isnull=False).count(),

        "phone_verified": queryset.filter(phone_verified_at__isnull=False).count(),
        "whatsapp_verified": queryset.filter(
            whatsapp_verified_at__isnull=False
        ).count(),
        "unverified": queryset.filter(
            phone_verified_at__isnull=True,
            whatsapp_verified_at__isnull=True,
        ).count(),

        "from_agent": queryset.filter(source=Customer.Source.AGENT).count(),
        "from_broker": queryset.filter(source=Customer.Source.BROKER).count(),
        "from_admin": queryset.filter(source=Customer.Source.ADMIN).count(),
        "from_website": queryset.filter(source=Customer.Source.WEBSITE).count(),
        "from_whatsapp": queryset.filter(source=Customer.Source.WHATSAPP).count(),
        "from_import": queryset.filter(source=Customer.Source.IMPORT).count(),
    }


def _list_customers(request: HttpRequest) -> JsonResponse:
    try:
        queryset = _build_customers_queryset(request)

        page_number = _safe_int(
            request.GET.get("page"),
            default=1,
            minimum=1,
            maximum=100000,
        )
        page_size = _safe_int(
            request.GET.get("page_size") or request.GET.get("limit"),
            default=50,
            minimum=1,
            maximum=200,
        )

        paginator = Paginator(queryset, page_size)

        try:
            page_obj = paginator.page(page_number)
        except PageNotAnInteger:
            page_obj = paginator.page(1)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages or 1)

        results = [
            serialize_customer(customer)
            for customer in page_obj.object_list
        ]

        summary = _build_summary(queryset)

        response_data = {
            "count": paginator.count,
            "page": page_obj.number,
            "page_size": page_size,
            "total_pages": paginator.num_pages,
            "num_pages": paginator.num_pages,
            "has_next": page_obj.has_next(),
            "has_previous": page_obj.has_previous(),
            "summary": summary,
            "results": results,
            "customers": results,
            "filters": {
                "search": request.GET.get("search") or request.GET.get("q") or "",
                "status": request.GET.get("status") or "",
                "customer_type": request.GET.get("customer_type") or request.GET.get("type") or "",
                "source": request.GET.get("source") or "",
                "city": request.GET.get("city") or "",
                "agent_id": request.GET.get("agent_id") or request.GET.get("agent") or "",
                "broker_id": request.GET.get("broker_id") or request.GET.get("broker") or "",
                "account_status": request.GET.get("account_status") or request.GET.get("account") or "",
                "verified": request.GET.get("verified") or request.GET.get("verification") or "",
                "has_customer_account": request.GET.get("has_customer_account") or request.GET.get("has_account") or "",
                "has_agent": request.GET.get("has_agent") or "",
                "has_broker": request.GET.get("has_broker") or "",
                "agent_has_login_user": request.GET.get("agent_has_login_user") or "",
                "broker_has_login_user": request.GET.get("broker_has_login_user") or "",
                "ordering": request.GET.get("ordering") or "-created_at",
            },
            "pagination": {
                "count": paginator.count,
                "page": page_obj.number,
                "page_size": page_size,
                "total_pages": paginator.num_pages,
                "num_pages": paginator.num_pages,
                "has_next": page_obj.has_next(),
                "has_previous": page_obj.has_previous(),
            },
            "data": {
                "count": paginator.count,
                "results": results,
                "customers": results,
                "summary": summary,
            },
        }

        return _json_success(response_data)

    except Exception as exc:
        logger.exception("Failed to list customers | error=%s", exc)
        return _json_error("تعذر تحميل قائمة العملاء.", status=500)


# ============================================================
# 🌐 API Entry
# ============================================================

@login_required
@csrf_protect
@require_http_methods(["GET", "POST"])
def customers_list_create_api(request: HttpRequest) -> JsonResponse:
    if request.method == "POST":
        if not has_permission(request.user, PermissionCodes.CUSTOMERS_CREATE):
            return _forbidden(PermissionCodes.CUSTOMERS_CREATE)

        return _create_customer(request)

    if not has_permission(request.user, PermissionCodes.CUSTOMERS_VIEW):
        return _forbidden(PermissionCodes.CUSTOMERS_VIEW)

    return _list_customers(request)