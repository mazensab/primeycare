# ============================================================
# 📂 api/customers/detail.py
# 🧠 Primey Care | Customer Detail API V3 Login-User Ready
# ------------------------------------------------------------
# ✅ GET    /api/customers/<id>/  -> تفاصيل العميل
# ✅ PATCH  /api/customers/<id>/  -> تعديل جزئي
# ✅ POST   /api/customers/<id>/  -> تعديل جزئي للتوافق
# ✅ DELETE /api/customers/<id>/  -> حذف العميل عند السماح فقط
# ------------------------------------------------------------
# ✅ يدعم حساب دخول العميل:
#    - Customer.user
#    - login_user.profile
#    - normalized_phone
#    - phone_verified_at
#    - whatsapp_verified_at
#    - last_login_at
# ✅ يدعم إنشاء/ربط حساب دخول للعميل عند التعديل:
#    - create_user / create_login_user / create_account = true
#    - login_username / login_email / login_password
#    - login_display_name / login_phone / login_whatsapp
# ✅ يستخدم auth_center.services.create_actor_user
# ✅ fallback آمن إلى customers.services.create_customer_user_if_missing
# ✅ يدعم العلاقة التجارية:
#    - Customer.agent
#    - Customer.broker
# ✅ يعرض حساب دخول المندوب Agent.user
# ✅ يعرض حساب دخول الوسيط Broker.user
# ✅ يحافظ على شكل Response السابق بدون كسر الفرونت
# ✅ Protected by permissions:
#    - GET           customers.view
#    - POST/PATCH    customers.edit
#    - DELETE        customers.delete
# ------------------------------------------------------------
# ملاحظة:
# - قيم Customer choices في الموديل lowercase، لذلك normalization هنا lower()
# ============================================================

from __future__ import annotations

import json
import logging
from datetime import date
from typing import Any

from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods

from auth_center.permissions import PermissionCodes, has_permission
from auth_center.services import create_actor_user
from customers.models import Customer, normalize_customer_phone
from customers.services import (
    create_customer_user_if_missing,
    resolve_customer_assignment,
)

from .list import serialize_customer

logger = logging.getLogger(__name__)


# ============================================================
# 🔐 Permissions
# ============================================================

def _permission_code(name: str, fallback: str) -> str:
    return str(getattr(PermissionCodes, name, fallback))


PERMISSION_CUSTOMERS_VIEW = _permission_code("CUSTOMERS_VIEW", "customers.view")
PERMISSION_CUSTOMERS_EDIT = _permission_code("CUSTOMERS_EDIT", "customers.edit")
PERMISSION_CUSTOMERS_DELETE = _permission_code("CUSTOMERS_DELETE", "customers.delete")


def _required_permission_for_method(method: str) -> str:
    if method == "GET":
        return PERMISSION_CUSTOMERS_VIEW

    if method in {"POST", "PATCH"}:
        return PERMISSION_CUSTOMERS_EDIT

    if method == "DELETE":
        return PERMISSION_CUSTOMERS_DELETE

    return PERMISSION_CUSTOMERS_VIEW


def _has_required_permission(user: Any, permission_code: str) -> bool:
    try:
        if getattr(user, "is_superuser", False):
            return True

        profile = getattr(user, "profile", None)
        role = str(getattr(profile, "role", "") or "").lower()
        user_type = str(getattr(profile, "user_type", "") or "").upper()

        if role == "system_admin" or user_type in {"SUPER_ADMIN", "SYSTEM_ADMIN"}:
            return True

        return bool(has_permission(user, permission_code))
    except Exception:
        return False


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
# 🧰 Helpers
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


def _normalize_choice(value: Any, allowed: set[str], current: str) -> str:
    cleaned = _clean_string(value)

    if not cleaned:
        return current

    normalized = cleaned.lower()

    return normalized if normalized in allowed else current


def _date_value(value: Any, *, field_label: str) -> date | None:
    raw = _clean_string(value)

    if not raw:
        return None

    try:
        return date.fromisoformat(raw[:10])
    except ValueError:
        raise ValidationError({field_label: [f"{field_label} يجب أن يكون بتاريخ صحيح."]})


def _date_iso(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _validation_errors(exc: ValidationError) -> dict[str, Any]:
    if hasattr(exc, "message_dict"):
        return exc.message_dict

    if hasattr(exc, "messages"):
        return {"__all__": exc.messages}

    return {"__all__": [str(exc)]}


def _get_customer(customer_id: int) -> Customer | None:
    return (
        Customer.objects
        .select_related(
            "user",
            "user__profile",
            "agent",
            "agent__user",
            "agent__user__profile",
            "agent__broker",
            "agent__broker__user",
            "agent__broker__user__profile",
            "broker",
            "broker__user",
            "broker__user__profile",
            "created_by",
            "updated_by",
        )
        .filter(pk=customer_id)
        .first()
    )


def _should_create_customer_user(payload: dict[str, Any]) -> bool:
    return _parse_bool(
        payload.get("create_login_user")
        if "create_login_user" in payload
        else payload.get("create_user")
        if "create_user" in payload
        else payload.get("create_account"),
        default=False,
    )


def _customer_display_name(customer: Customer) -> str:
    if customer.customer_type == Customer.CustomerType.CORPORATE:
        return customer.company_name or customer.display_name or str(customer)

    full_name = " ".join(
        part for part in [customer.first_name, customer.last_name] if part
    ).strip()

    return (
        full_name
        or customer.display_name
        or customer.phone_number
        or customer.whatsapp_number
        or str(customer)
    )


# ============================================================
# 👤 Login User Serialization / Detail Payload
# ============================================================

def _serialize_user_profile(user: Any | None) -> dict[str, Any] | None:
    if not user:
        return None

    profile = getattr(user, "profile", None)
    if not profile:
        return None

    return {
        "id": getattr(profile, "pk", None),
        "display_name": getattr(profile, "display_name", "") or "",
        "user_type": getattr(profile, "user_type", "") or "",
        "role": getattr(profile, "role", "") or "",
        "phone_number": getattr(profile, "phone_number", "") or "",
        "whatsapp_number": getattr(profile, "whatsapp_number", "") or "",
        "alternate_email": getattr(profile, "alternate_email", "") or "",
        "preferred_language": getattr(profile, "preferred_language", "") or "",
        "timezone": getattr(profile, "timezone", "") or "",
        "extra_data": getattr(profile, "extra_data", {}) or {},
        "tags": getattr(profile, "tags", []) or [],
    }


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
        "last_login": _date_iso(getattr(user, "last_login", None)),
        "date_joined": _date_iso(getattr(user, "date_joined", None)),
        "profile": _serialize_user_profile(user),
    }


def _attach_profile_to_user_payload(payload: dict[str, Any], user: Any | None) -> None:
    if not payload or not user:
        return

    payload["profile"] = _serialize_user_profile(user)


def _serialize_customer_detail(customer: Customer) -> dict[str, Any]:
    data = serialize_customer(customer)

    customer_user = getattr(customer, "user", None)
    agent = getattr(customer, "agent", None)
    broker = getattr(customer, "broker", None)

    data["user_id"] = getattr(customer, "user_id", None)
    data["has_customer_account"] = bool(getattr(customer, "user_id", None))
    data["login_user"] = _serialize_login_user(customer_user)

    if isinstance(data.get("agent"), dict) and agent:
        _attach_profile_to_user_payload(
            data["agent"].get("login_user"),
            getattr(agent, "user", None),
        )

    if isinstance(data.get("assigned_agent"), dict) and agent:
        _attach_profile_to_user_payload(
            data["assigned_agent"].get("login_user"),
            getattr(agent, "user", None),
        )

    if isinstance(data.get("broker"), dict) and broker:
        _attach_profile_to_user_payload(
            data["broker"].get("login_user"),
            getattr(broker, "user", None),
        )

    if isinstance(data.get("assigned_broker"), dict) and broker:
        _attach_profile_to_user_payload(
            data["assigned_broker"].get("login_user"),
            getattr(broker, "user", None),
        )

    return data


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

    القاعدة:
    - Customer.user = User
    - user_type = CUSTOMER
    - role = customer_user
    - workspace = customer
    - entity_type = customer
    - entity_id = customer.id

    fallback:
    - customers.services.create_customer_user_if_missing
    """

    existing_user = getattr(customer, "user", None)
    if existing_user:
        return existing_user, False, True, "Customer already has a linked login user."

    display_name = (
        _clean_string(payload.get("login_display_name"))
        or _clean_string(payload.get("display_name"))
        or _customer_display_name(customer)
    )

    login_email = (
        _clean_email(payload.get("login_email"))
        or _clean_email(payload.get("user_email"))
        or _clean_email(payload.get("email"))
        or _clean_email(customer.email)
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
                "source": "api_customers_detail_update",
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
            "create_actor_user failed for customer detail update | customer=%s | error=%s",
            customer.pk,
            exc,
        )

        user, created = create_customer_user_if_missing(customer)

        if user and getattr(customer, "user_id", None) != getattr(user, "pk", None):
            customer.user = user
            customer.save(update_fields=["user", "updated_at"])

        return user, bool(created), bool(user), "تم إنشاء/ربط حساب العميل عبر المسار الاحتياطي."


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
# ✏️ Update
# ============================================================

UPDATABLE_FIELDS = {
    "customer_type",
    "status",
    "source",
    "normalized_phone",
    "first_name",
    "last_name",
    "company_name",
    "gender",
    "date_of_birth",
    "national_id",
    "passport_number",
    "nationality",
    "email",
    "phone_number",
    "whatsapp_number",
    "alternative_phone_number",
    "country",
    "city",
    "district",
    "street_address",
    "postal_code",
    "national_address_text",
    "notes",
    "tags",
}

ASSIGNMENT_FIELDS = {
    "agent_id",
    "agent",
    "sales_agent_id",
    "referral_agent_id",
    "broker_id",
    "broker",
    "referral_broker_id",
}

ACTION_FIELDS = {
    "create_user",
    "create_login_user",
    "create_account",
    "update_assignment",
    "preferred_language",
    "timezone",
}

LOGIN_USER_FIELDS = {
    "login_username",
    "username",
    "login_email",
    "user_email",
    "login_password",
    "password",
    "login_display_name",
    "login_phone",
    "login_phone_number",
    "login_whatsapp",
    "login_whatsapp_number",
}

BLOCKED_ACCOUNT_FIELDS = {
    "user",
    "user_id",
    "login_user",
    "has_customer_account",
    "phone_verified_at",
    "whatsapp_verified_at",
    "last_login_at",
}

VERIFICATION_ACTION_FIELDS = {
    "is_phone_verified",
    "is_whatsapp_verified",
    "phone_verified",
    "whatsapp_verified",
}

CHOICE_FIELDS = {
    "customer_type": CUSTOMER_TYPE_VALUES,
    "status": STATUS_VALUES,
    "source": SOURCE_VALUES,
    "gender": GENDER_VALUES,
}


def _apply_customer_field_update(
    *,
    customer: Customer,
    field: str,
    value: Any,
) -> None:
    if field == "date_of_birth":
        customer.date_of_birth = _date_value(value, field_label="date_of_birth")
        return

    if field in CHOICE_FIELDS:
        current_value = getattr(customer, field)
        normalized_value = _normalize_choice(
            value,
            CHOICE_FIELDS[field],
            current_value,
        )
        setattr(customer, field, normalized_value)
        return

    if field == "email":
        setattr(customer, field, _clean_email(value))
        return

    if field == "normalized_phone":
        normalized_phone = normalize_customer_phone(value)
        setattr(customer, field, normalized_phone or None)
        return

    if field == "tags":
        setattr(customer, field, _clean_tags(value))
        return

    setattr(customer, field, _clean_string(value))


def _apply_customer_verification_update(
    *,
    customer: Customer,
    payload: dict[str, Any],
) -> list[str]:
    changed_fields: list[str] = []

    if "is_phone_verified" in payload or "phone_verified" in payload:
        verified = _parse_bool(
            payload.get("is_phone_verified")
            if "is_phone_verified" in payload
            else payload.get("phone_verified"),
            default=False,
        )
        new_value = None
        if verified:
            from django.utils import timezone
            new_value = timezone.now()

        if customer.phone_verified_at != new_value:
            customer.phone_verified_at = new_value
            changed_fields.append("phone_verified_at")

    if "is_whatsapp_verified" in payload or "whatsapp_verified" in payload:
        verified = _parse_bool(
            payload.get("is_whatsapp_verified")
            if "is_whatsapp_verified" in payload
            else payload.get("whatsapp_verified"),
            default=False,
        )
        new_value = None
        if verified:
            from django.utils import timezone
            new_value = timezone.now()

        if customer.whatsapp_verified_at != new_value:
            customer.whatsapp_verified_at = new_value
            changed_fields.append("whatsapp_verified_at")

    return changed_fields


def _apply_customer_assignment_update(
    *,
    customer: Customer,
    payload: dict[str, Any],
) -> list[str]:
    has_assignment_payload = any(field in payload for field in ASSIGNMENT_FIELDS)

    if not has_assignment_payload:
        return []

    update_assignment = _parse_bool(
        payload.get("update_assignment"),
        default=True,
    )

    raw_agent_value = (
        payload.get("agent_id")
        or payload.get("agent")
        or payload.get("sales_agent_id")
        or payload.get("referral_agent_id")
    )
    raw_broker_value = (
        payload.get("broker_id")
        or payload.get("broker")
        or payload.get("referral_broker_id")
    )

    resolved_agent, resolved_broker = resolve_customer_assignment(
        payload,
        agent_id=raw_agent_value,
        broker_id=raw_broker_value,
    )

    changed_fields: list[str] = []

    # --------------------------------------------------------
    # Clear assignment when empty value is explicitly sent.
    # --------------------------------------------------------
    if (
        "agent_id" in payload
        or "agent" in payload
        or "sales_agent_id" in payload
        or "referral_agent_id" in payload
    ):
        if raw_agent_value in ("", None, 0, "0") and update_assignment:
            if customer.agent_id:
                customer.agent = None
                changed_fields.append("agent")

    if (
        "broker_id" in payload
        or "broker" in payload
        or "referral_broker_id" in payload
    ):
        if raw_broker_value in ("", None, 0, "0") and update_assignment:
            if customer.broker_id:
                customer.broker = None
                changed_fields.append("broker")

    # --------------------------------------------------------
    # Apply resolved assignment.
    # --------------------------------------------------------
    if resolved_agent and (update_assignment or not customer.agent_id):
        if customer.agent_id != resolved_agent.pk:
            customer.agent = resolved_agent
            changed_fields.append("agent")

    if resolved_broker and (update_assignment or not customer.broker_id):
        if customer.broker_id != resolved_broker.pk:
            customer.broker = resolved_broker
            changed_fields.append("broker")

    # --------------------------------------------------------
    # If agent has broker and no broker was explicitly selected,
    # inherit broker from agent to keep customer → agent → broker.
    # --------------------------------------------------------
    if customer.agent_id and not customer.broker_id:
        agent_broker = getattr(customer.agent, "broker", None)
        if agent_broker:
            customer.broker = agent_broker
            changed_fields.append("broker")

    return sorted(set(changed_fields))


def _update_customer(request: HttpRequest, customer: Customer) -> JsonResponse:
    try:
        payload = _parse_json_body(request)

        allowed_payload_fields = (
            UPDATABLE_FIELDS
            | ASSIGNMENT_FIELDS
            | ACTION_FIELDS
            | LOGIN_USER_FIELDS
            | VERIFICATION_ACTION_FIELDS
            | BLOCKED_ACCOUNT_FIELDS
        )

        ignored_fields = sorted(
            key for key in payload.keys() if key not in allowed_payload_fields
        )

        ignored_account_fields = sorted(
            key for key in payload.keys() if key in BLOCKED_ACCOUNT_FIELDS
        )

        with transaction.atomic():
            for field in UPDATABLE_FIELDS:
                if field not in payload:
                    continue

                _apply_customer_field_update(
                    customer=customer,
                    field=field,
                    value=payload.get(field),
                )

            assignment_changed_fields = _apply_customer_assignment_update(
                customer=customer,
                payload=payload,
            )

            verification_changed_fields = _apply_customer_verification_update(
                customer=customer,
                payload=payload,
            )

            customer.updated_by = request.user if request.user.is_authenticated else None

            customer.full_clean()
            customer.save()

            login_user = None
            login_user_created = False
            login_user_linked = False
            login_message = ""

            if _should_create_customer_user(payload):
                login_user, login_user_created, login_user_linked, login_message = (
                    _create_login_user_for_customer(
                        customer=customer,
                        payload=payload,
                        actor=request.user,
                    )
                )

            customer = _get_customer(customer.pk) or customer

        serialized_customer = _serialize_customer_detail(customer)

        response_data: dict[str, Any] = {
            "message": (
                "تم تحديث بيانات العميل وحساب الدخول بنجاح."
                if _should_create_customer_user(payload) and serialized_customer.get("has_customer_account")
                else "تم تحديث بيانات العميل بنجاح."
            ),
            "customer": serialized_customer,
            "item": serialized_customer,
            "data": {
                "customer": serialized_customer,
                "created_user": login_user_created,
                "login_user_created": login_user_created,
                "login_user_linked": login_user_linked,
                "login_message": login_message,
                "login_user": _serialize_login_user(login_user),
            },
            "created_user": login_user_created,
            "login_user_created": login_user_created,
            "login_user_linked": login_user_linked,
            "login_message": login_message,
            "login_user": _serialize_login_user(login_user),
        }

        if ignored_fields:
            response_data["ignored_fields"] = ignored_fields

        if ignored_account_fields:
            response_data["ignored_account_fields"] = ignored_account_fields

        if assignment_changed_fields:
            response_data["assignment_changed_fields"] = assignment_changed_fields

        if verification_changed_fields:
            response_data["verification_changed_fields"] = verification_changed_fields

        return _json_success(response_data)

    except ValueError as exc:
        return _json_error(str(exc), status=400)

    except IntegrityError:
        return _json_error(
            "رقم الجوال الموحد مستخدم مسبقًا مع عميل آخر.",
            status=409,
            errors={
                "normalized_phone": [
                    "Normalized phone must be unique per customer."
                ]
            },
        )

    except ValidationError as exc:
        return _json_error(
            "بيانات العميل غير صحيحة.",
            status=400,
            errors=_validation_errors(exc),
        )

    except Exception as exc:
        logger.exception(
            "Failed to update customer | customer_id=%s | error=%s",
            customer.pk,
            exc,
        )
        return _json_error("تعذر تحديث بيانات العميل.", status=500)


# ============================================================
# 🗑️ Delete
# ============================================================

def _delete_customer(customer: Customer) -> JsonResponse:
    try:
        customer_id = customer.pk
        customer_name = (
            customer.display_name
            or customer.customer_code
            or f"Customer #{customer.pk}"
        )

        customer.delete()

        return _json_success(
            {
                "message": "تم حذف العميل بنجاح.",
                "deleted_customer": {
                    "id": customer_id,
                    "display_name": customer_name,
                },
                "data": {
                    "deleted_customer": {
                        "id": customer_id,
                        "display_name": customer_name,
                    }
                },
            }
        )

    except ProtectedError:
        return _json_error(
            "لا يمكن حذف العميل لوجود بيانات مرتبطة به. يمكن تعطيله بدل الحذف.",
            status=409,
        )

    except Exception as exc:
        logger.exception(
            "Failed to delete customer | customer_id=%s | error=%s",
            customer.pk,
            exc,
        )
        return _json_error("تعذر حذف العميل.", status=500)


# ============================================================
# 🌐 API Entry
# ============================================================

@login_required
@csrf_protect
@require_http_methods(["GET", "POST", "PATCH", "DELETE"])
def customer_detail_api(request: HttpRequest, customer_id: int) -> JsonResponse:
    required_permission = _required_permission_for_method(request.method)

    if not _has_required_permission(request.user, required_permission):
        return _forbidden(required_permission)

    customer = _get_customer(customer_id)

    if not customer:
        return _json_error("العميل غير موجود.", status=404)

    if request.method == "GET":
        serialized_customer = _serialize_customer_detail(customer)

        return _json_success(
            {
                "message": "تم جلب تفاصيل العميل بنجاح.",
                "customer": serialized_customer,
                "item": serialized_customer,
                "data": {
                    "customer": serialized_customer,
                },
            }
        )

    if request.method in {"POST", "PATCH"}:
        return _update_customer(request, customer)

    if request.method == "DELETE":
        return _delete_customer(customer)

    return _json_error("طريقة الطلب غير مدعومة.", status=405)