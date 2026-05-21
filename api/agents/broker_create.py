# ============================================================
# 📂 api/agents/broker_create.py
# 🧠 Primey Care | Broker Create API V4 Login-User Ready
# ------------------------------------------------------------
# ✅ إنشاء وسيط / وكيل جديد
# ✅ مطابق وآمن مع agents.models.Broker
# ✅ لا يستورد Enums غير مؤكدة من agents.models
# ✅ يقرأ choices من حقول Broker مباشرة عند توفرها
# ✅ يدعم:
#    name / broker_code / referral_code / status
#    phone / email / city / address
#    default_commission_type / default_commission_value
#    revenue_recognition_mode / settlement_mode
#    bank_name / bank_account_name / iban / notes
# ✅ توليد broker_code و referral_code عند عدم إرسالها
# ✅ منع التكرار
# ✅ إنشاء حساب دخول اختياري للوسيط:
#    create_login_user / create_user / create_account
# ✅ ربط Broker.user مع User عبر agents.services.create_login_user_for_broker
# ✅ يحافظ على broker_user من auth_center
# ✅ Response متوافق مع /api/agents/brokers/
# ============================================================

from __future__ import annotations

import json
import logging
import random
import string
from decimal import Decimal, InvalidOperation
from typing import Any

from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST

from agents.models import Broker
from agents.services import AgentServiceError, create_login_user_for_broker
from auth_center.permissions import PermissionCodes, any_permission_required

logger = logging.getLogger(__name__)


# ============================================================
# JSON Helpers
# ============================================================

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


def _json_success(data: dict[str, Any], status: int = 201) -> JsonResponse:
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


# ============================================================
# Safe Helpers
# ============================================================

def _parse_json_body(request) -> dict[str, Any]:
    if not request.body:
        return {}

    try:
        parsed = json.loads(request.body.decode("utf-8"))
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _clean_upper(value: Any) -> str:
    return _clean_text(value).upper()


def _clean_email(value: Any) -> str:
    return _clean_text(value).lower()


def _clean_iban(value: Any) -> str:
    return _clean_text(value).replace(" ", "").upper()


def _parse_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default

    if isinstance(value, bool):
        return value

    if isinstance(value, (int, float)):
        return bool(value)

    normalized = str(value).strip().lower()

    if normalized in {"1", "true", "yes", "y", "on", "نعم", "صح"}:
        return True

    if normalized in {"0", "false", "no", "n", "off", "لا", "خطأ"}:
        return False

    return default


def _decimal_value(
    value: Any,
    default: str = "0.00",
    *,
    field_label: str = "القيمة",
) -> Decimal:
    try:
        return Decimal(str(value if value not in (None, "") else default)).quantize(
            Decimal("0.01")
        )
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError({field_label: [f"{field_label} غير صالحة."]})


def _model_field_names() -> set[str]:
    return {field.name for field in Broker._meta.get_fields()}


def _has_field(field_name: str) -> bool:
    return field_name in _model_field_names()


def _field_choice_values(field_name: str) -> set[str]:
    try:
        field = Broker._meta.get_field(field_name)
    except Exception:
        return set()

    values: set[str] = set()

    for choice in getattr(field, "choices", []) or []:
        if isinstance(choice, (list, tuple)) and len(choice) >= 1:
            values.add(str(choice[0]))

    return values


def _field_default(field_name: str, fallback: str) -> str:
    try:
        field = Broker._meta.get_field(field_name)
        default = getattr(field, "default", None)

        if default not in (None, "") and not callable(default):
            return str(default)
    except Exception:
        pass

    return fallback


def _safe_choice(
    *,
    field_name: str,
    value: Any,
    fallback: str,
    label: str,
    errors: dict[str, list[str]],
) -> str:
    cleaned = _clean_upper(value or _field_default(field_name, fallback))
    allowed = _field_choice_values(field_name)

    if allowed and cleaned not in allowed:
        errors.setdefault(field_name, []).append(f"{label} غير صحيح.")

    return cleaned


def _serialize_validation_errors(exc: ValidationError) -> dict[str, Any]:
    if hasattr(exc, "message_dict"):
        return exc.message_dict

    if hasattr(exc, "messages"):
        return {"non_field_errors": exc.messages}

    return {"non_field_errors": [str(exc)]}


def _random_code(prefix: str, length: int = 6) -> str:
    chars = string.ascii_uppercase + string.digits
    suffix = "".join(random.choice(chars) for _ in range(length))
    return f"{prefix}-{suffix}"


def _unique_broker_code(prefix: str = "BRK") -> str:
    if not _has_field("broker_code"):
        return ""

    for _ in range(20):
        code = _random_code(prefix)
        if not Broker.objects.filter(broker_code=code).exists():
            return code

    return f"{prefix}-{Broker.objects.count() + 1:06d}"


def _unique_referral_code(prefix: str = "REF-BRK") -> str:
    if not _has_field("referral_code"):
        return ""

    for _ in range(20):
        code = _random_code(prefix)
        if not Broker.objects.filter(referral_code=code).exists():
            return code

    return f"{prefix}-{Broker.objects.count() + 1:06d}"


def _set_if_field(payload: dict[str, Any], field_name: str, value: Any) -> None:
    if _has_field(field_name):
        payload[field_name] = value


def _should_create_login_user(data: dict[str, Any]) -> bool:
    return _parse_bool(
        data.get("create_login_user")
        or data.get("create_user")
        or data.get("create_account"),
        False,
    )


# ============================================================
# Login User Helpers
# ============================================================

def _serialize_login_user(user: Any | None) -> dict[str, Any] | None:
    if not user:
        return None

    full_name = ""
    try:
        full_name = user.get_full_name()
    except Exception:
        full_name = ""

    return {
        "id": getattr(user, "pk", None),
        "username": getattr(user, "username", ""),
        "email": getattr(user, "email", ""),
        "first_name": getattr(user, "first_name", ""),
        "last_name": getattr(user, "last_name", ""),
        "full_name": full_name,
        "is_active": getattr(user, "is_active", False),
        "is_staff": getattr(user, "is_staff", False),
        "is_superuser": getattr(user, "is_superuser", False),
        "last_login": (
            user.last_login.isoformat()
            if getattr(user, "last_login", None)
            else None
        ),
        "date_joined": (
            user.date_joined.isoformat()
            if getattr(user, "date_joined", None)
            else None
        ),
    }


def _build_login_user_payload(data: dict[str, Any], broker: Broker) -> dict[str, Any]:
    broker_name = getattr(broker, "name", "") or str(broker)
    broker_phone = getattr(broker, "phone", "") or getattr(broker, "phone_number", "")

    return {
        "username": _clean_text(
            data.get("login_username")
            or data.get("username")
            or ""
        ) or None,
        "email": _clean_email(
            data.get("login_email")
            or data.get("user_email")
            or data.get("email")
        ) or None,
        "password": data.get("login_password") or data.get("password") or None,
        "display_name": _clean_text(
            data.get("login_display_name")
            or data.get("display_name")
            or broker_name
        ) or None,
        "phone_number": _clean_text(
            data.get("login_phone")
            or data.get("login_phone_number")
            or data.get("phone")
            or data.get("phone_number")
            or broker_phone
        ) or None,
        "whatsapp_number": _clean_text(
            data.get("login_whatsapp")
            or data.get("login_whatsapp_number")
            or data.get("whatsapp_number")
            or data.get("phone")
            or broker_phone
        ) or None,
    }


def _create_broker_login_user_safely(
    *,
    broker: Broker,
    data: dict[str, Any],
    actor: Any,
):
    login_payload = _build_login_user_payload(data, broker)

    if not (
        login_payload.get("email")
        or login_payload.get("username")
        or login_payload.get("phone_number")
    ):
        raise ValidationError(
            {
                "login_user": [
                    "لإنشاء حساب دخول للوسيط، يجب توفر بريد إلكتروني أو اسم مستخدم أو رقم جوال."
                ]
            }
        )

    return create_login_user_for_broker(
        broker=broker,
        email=login_payload["email"],
        username=login_payload["username"],
        password=login_payload["password"],
        display_name=login_payload["display_name"],
        phone_number=login_payload["phone_number"],
        whatsapp_number=login_payload["whatsapp_number"],
        actor=actor,
    )


def _serialize_login_result(login_result: Any | None) -> dict[str, Any]:
    if not login_result:
        return {
            "login_user": None,
            "login_user_created": False,
            "login_user_linked": False,
            "temporary_password": None,
            "login_message": "",
        }

    user = getattr(login_result, "user", None)

    return {
        "login_user": _serialize_login_user(user),
        "login_user_created": bool(getattr(login_result, "created", False)),
        "login_user_linked": bool(getattr(login_result, "linked", True if user else False)),
        "temporary_password": getattr(login_result, "temporary_password", None),
        "login_message": getattr(login_result, "message", ""),
    }


# ============================================================
# Serializer
# ============================================================

def serialize_broker(broker: Broker) -> dict[str, Any]:
    name = getattr(broker, "name", "") or str(broker)
    code = getattr(broker, "broker_code", "") or getattr(broker, "code", "")
    phone = getattr(broker, "phone", "") or getattr(broker, "phone_number", "")
    user = getattr(broker, "user", None)

    return {
        "id": broker.pk,
        "name": name,
        "full_name": name,
        "broker_name": name,
        "broker_code": code,
        "code": code,
        "referral_code": getattr(broker, "referral_code", ""),
        "status": getattr(broker, "status", ""),
        "phone": phone,
        "phone_number": phone,
        "email": getattr(broker, "email", ""),
        "city": getattr(broker, "city", ""),
        "address": getattr(broker, "address", ""),
        "default_commission_type": getattr(broker, "default_commission_type", ""),
        "default_commission_value": str(
            getattr(broker, "default_commission_value", Decimal("0.00"))
            or Decimal("0.00")
        ),
        "revenue_recognition_mode": getattr(broker, "revenue_recognition_mode", ""),
        "settlement_mode": getattr(broker, "settlement_mode", ""),
        "bank_name": getattr(broker, "bank_name", ""),
        "bank_account_name": getattr(broker, "bank_account_name", ""),
        "iban": getattr(broker, "iban", ""),
        "notes": getattr(broker, "notes", ""),
        "metadata": getattr(broker, "metadata", {}) or {},
        "has_login_user": bool(getattr(broker, "user_id", None)),
        "login_user": _serialize_login_user(user),
        "label": f"{name} · {code}" if code else name,
        "value": broker.pk,
        "created_at": (
            broker.created_at.isoformat()
            if getattr(broker, "created_at", None)
            else None
        ),
        "updated_at": (
            broker.updated_at.isoformat()
            if getattr(broker, "updated_at", None)
            else None
        ),
    }


# ============================================================
# Validation
# ============================================================

def _validate_broker_payload(data: dict[str, Any]) -> dict[str, Any]:
    name = _clean_text(
        data.get("name")
        or data.get("full_name")
        or data.get("broker_name")
    )

    broker_code = _clean_upper(
        data.get("broker_code")
        or data.get("code")
    )

    referral_code = _clean_upper(
        data.get("referral_code")
        or data.get("ref_code")
    )

    errors: dict[str, list[str]] = {}

    if not name:
        errors.setdefault("name", []).append("اسم الوسيط مطلوب.")

    if _has_field("broker_code") and not broker_code:
        broker_code = _unique_broker_code()

    if _has_field("referral_code") and not referral_code:
        referral_code = _unique_referral_code()

    status = _safe_choice(
        field_name="status",
        value=data.get("status"),
        fallback="ACTIVE",
        label="حالة الوسيط",
        errors=errors,
    )

    default_commission_type = _safe_choice(
        field_name="default_commission_type",
        value=data.get("default_commission_type") or data.get("commission_type"),
        fallback="FIXED",
        label="نوع عمولة الوسيط",
        errors=errors,
    )

    default_commission_value = _decimal_value(
        data.get("default_commission_value")
        if "default_commission_value" in data
        else data.get("commission_value"),
        default="0.00",
        field_label="default_commission_value",
    )

    revenue_recognition_mode = _safe_choice(
        field_name="revenue_recognition_mode",
        value=data.get("revenue_recognition_mode"),
        fallback="GROSS_SALE",
        label="طريقة إثبات إيراد الوسيط",
        errors=errors,
    )

    settlement_mode = _safe_choice(
        field_name="settlement_mode",
        value=data.get("settlement_mode"),
        fallback="AGENT_WITH_BROKER_SUMMARY",
        label="طريقة تسوية الوسيط",
        errors=errors,
    )

    if default_commission_value < Decimal("0.00"):
        errors.setdefault("default_commission_value", []).append(
            "قيمة عمولة الوسيط لا يمكن أن تكون سالبة."
        )

    if (
        default_commission_type == "PERCENTAGE"
        and default_commission_value > Decimal("100.00")
    ):
        errors.setdefault("default_commission_value", []).append(
            "نسبة عمولة الوسيط يجب أن تكون بين 0 و 100."
        )

    if (
        _has_field("broker_code")
        and broker_code
        and Broker.objects.filter(broker_code=broker_code).exists()
    ):
        errors.setdefault("broker_code", []).append("كود الوسيط مستخدم مسبقًا.")

    if (
        _has_field("referral_code")
        and referral_code
        and Broker.objects.filter(referral_code=referral_code).exists()
    ):
        errors.setdefault("referral_code", []).append("كود إحالة الوسيط مستخدم مسبقًا.")

    if errors:
        raise ValidationError(errors)

    metadata = data.get("metadata")
    if not isinstance(metadata, dict):
        metadata = {}

    metadata.update(
        {
            "source": "api_agents_broker_create",
            "financial_ready": True,
            "auto_generated_broker_code": not bool(
                _clean_text(data.get("broker_code") or data.get("code"))
            ),
            "auto_generated_referral_code": not bool(
                _clean_text(data.get("referral_code") or data.get("ref_code"))
            ),
            "create_login_user_requested": _should_create_login_user(data),
        }
    )

    payload: dict[str, Any] = {}

    _set_if_field(payload, "name", name)
    _set_if_field(payload, "broker_code", broker_code)
    _set_if_field(payload, "referral_code", referral_code)
    _set_if_field(payload, "status", status)
    _set_if_field(
        payload,
        "phone",
        _clean_text(
            data.get("phone")
            or data.get("phone_number")
            or data.get("mobile")
        ),
    )
    _set_if_field(payload, "email", _clean_email(data.get("email")))
    _set_if_field(payload, "city", _clean_text(data.get("city")))
    _set_if_field(payload, "address", _clean_text(data.get("address")))
    _set_if_field(payload, "default_commission_type", default_commission_type)
    _set_if_field(payload, "default_commission_value", default_commission_value)
    _set_if_field(payload, "revenue_recognition_mode", revenue_recognition_mode)
    _set_if_field(payload, "settlement_mode", settlement_mode)
    _set_if_field(payload, "bank_name", _clean_text(data.get("bank_name")))
    _set_if_field(payload, "bank_account_name", _clean_text(data.get("bank_account_name")))
    _set_if_field(payload, "iban", _clean_iban(data.get("iban")))
    _set_if_field(payload, "notes", _clean_text(data.get("notes")))
    _set_if_field(payload, "metadata", metadata)

    return payload


# ============================================================
# API
# ============================================================

@login_required
@require_POST
@csrf_protect
@any_permission_required(
    (
        PermissionCodes.BROKERS_CREATE,
        PermissionCodes.AGENTS_CREATE,
    )
)
def create_broker_api(request):
    try:
        data = _parse_json_body(request)

        if not data:
            return _json_error(
                "لم يتم إرسال بيانات صالحة.",
                status=400,
                errors={"body": ["JSON body is required."]},
            )

        validated_data = _validate_broker_payload(data)
        create_login_user = _should_create_login_user(data)

        login_result = None

        with transaction.atomic():
            broker = Broker.objects.create(**validated_data)

            if create_login_user:
                login_result = _create_broker_login_user_safely(
                    broker=broker,
                    data=data,
                    actor=request.user,
                )

            broker = (
                Broker.objects
                .select_related("user")
                .get(pk=broker.pk)
            )

        serialized_broker = serialize_broker(broker)
        login_payload = _serialize_login_result(login_result)

        response_payload: dict[str, Any] = {
            "message": (
                "تم إنشاء الوسيط وحساب الدخول بنجاح."
                if create_login_user and serialized_broker.get("has_login_user")
                else "تم إنشاء الوسيط بنجاح."
            ),
            "broker": serialized_broker,
            "item": serialized_broker,
            "data": {
                "broker": serialized_broker,
                "create_login_user": create_login_user,
                **login_payload,
            },
            "create_login_user": create_login_user,
            **login_payload,
        }

        return _json_success(response_payload, status=201)

    except ValidationError as exc:
        return _json_error(
            "تعذر إنشاء الوسيط. يرجى مراجعة البيانات.",
            status=400,
            errors=_serialize_validation_errors(exc),
        )

    except AgentServiceError as exc:
        logger.warning("Broker login user service error: %s", exc)
        return _json_error(
            "تم رفض إنشاء أو ربط حساب دخول الوسيط.",
            status=400,
            errors={"login_user": [str(exc)]},
        )

    except IntegrityError as exc:
        logger.warning("Broker integrity error: %s", exc)
        return _json_error(
            "تعذر إنشاء الوسيط بسبب تكرار كود الوسيط أو كود الإحالة.",
            status=409,
        )

    except Exception as exc:
        logger.exception("Failed to create broker: %s", exc)
        return _json_error("تعذر إنشاء الوسيط.", status=500)