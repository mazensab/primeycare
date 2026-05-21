# ============================================================
# 📂 api/agents/create.py
# 🧠 Primey Care | Create Agent API V7 Login-User Ready
# ------------------------------------------------------------
# ✅ إنشاء مندوب جديد
# ✅ ربط المندوب بالوسيط / الوكيل broker_id
# ✅ حفظ عمولة البيع الافتراضية على Agent
# ✅ حفظ عمولة التوصيل الافتراضية على Agent
# ✅ إنشاء قواعد مالية متعددة AgentFinancialRule
# ✅ إنشاء حساب دخول اختياري للمندوب:
#    create_login_user / create_user / create_account
# ✅ ربط Agent.user مع User عبر agents.services.create_login_user_for_agent
# ✅ مطابق فعليًا مع agents.models:
#    AgentFinancialRule.rule_name
#    AgentFinancialRule.calculation_type
#    AgentFinancialRule.value
#    AgentFinancialRule.product / product_id
#    AgentFinancialRule.provider / provider_id
#    AgentFinancialRule.contract / contract_id
#    AgentFinancialRule.contract_product / contract_product_id
# ✅ يقبل من الواجهة:
#    financial_rules / rules / commission_rules
# ✅ يقبل aliases من الفرونت:
#    name -> rule_name
#    commission_type -> calculation_type
#    commission_value -> value
# ✅ يدعم:
#    GLOBAL / PRODUCT_TYPE / PRODUCT / CONTRACT / CONTRACT_PRODUCT / PROVIDER / ORDER_KIND
# ✅ Protected by permissions: agents.create
# ✅ رسائل أخطاء واضحة
# ============================================================

from __future__ import annotations

import json
import logging
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST

from agents.models import (
    Agent,
    AgentFinancialRule,
    AgentStatus,
    Broker,
    BrokerStatus,
    CalculationBase,
    CalculationType,
    CommissionType,
    FinancialRuleScope,
    FinancialRuleType,
)
from agents.services import AgentServiceError, create_login_user_for_agent
from auth_center.permissions import PermissionCodes, permission_required

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


def _clean_lower(value: Any) -> str:
    return _clean_text(value).lower()


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


def _int_value(value: Any, *, field_label: str, required: bool = False) -> int | None:
    raw = _clean_text(value)

    if not raw:
        if required:
            raise ValidationError({field_label: [f"{field_label} مطلوب."]})
        return None

    try:
        parsed = int(raw)
    except (TypeError, ValueError):
        raise ValidationError({field_label: [f"{field_label} يجب أن يكون رقمًا صحيحًا."]})

    if parsed <= 0:
        raise ValidationError({field_label: [f"{field_label} يجب أن يكون أكبر من صفر."]})

    return parsed


def _bool_value(value: Any, default: bool = True) -> bool:
    if value in (None, ""):
        return default

    if isinstance(value, bool):
        return value

    raw = str(value).strip().lower()

    if raw in {"1", "true", "yes", "y", "on", "نعم", "صح"}:
        return True

    if raw in {"0", "false", "no", "n", "off", "لا", "خطأ"}:
        return False

    return default


def _date_value(value: Any, *, field_label: str) -> date | None:
    raw = _clean_text(value)

    if not raw:
        return None

    try:
        return date.fromisoformat(raw[:10])
    except ValueError:
        raise ValidationError({field_label: [f"{field_label} يجب أن يكون بتاريخ صحيح."]})


def _enum_values(enum_class: Any) -> set[str]:
    try:
        return set(enum_class.values)
    except Exception:
        values: set[str] = set()

        for key in dir(enum_class):
            if key.startswith("_"):
                continue

            value = getattr(enum_class, key, None)

            if isinstance(value, str):
                values.add(value)

        return values


def _serialize_validation_errors(exc: ValidationError) -> dict[str, Any]:
    if hasattr(exc, "message_dict"):
        return exc.message_dict

    if hasattr(exc, "messages"):
        return {"non_field_errors": exc.messages}

    return {"non_field_errors": [str(exc)]}


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


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


def _build_login_user_payload(data: dict[str, Any], agent: Agent) -> dict[str, Any]:
    agent_name = getattr(agent, "full_name", "") or str(agent)
    agent_phone = getattr(agent, "phone", "") or ""

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
            or agent_name
        ) or None,
        "phone_number": _clean_text(
            data.get("login_phone")
            or data.get("login_phone_number")
            or data.get("phone")
            or data.get("phone_number")
            or agent_phone
        ) or None,
        "whatsapp_number": _clean_text(
            data.get("login_whatsapp")
            or data.get("login_whatsapp_number")
            or data.get("whatsapp_number")
            or data.get("phone")
            or agent_phone
        ) or None,
    }


def _create_agent_login_user_safely(
    *,
    agent: Agent,
    data: dict[str, Any],
    actor: Any,
):
    login_payload = _build_login_user_payload(data, agent)

    if not (
        login_payload.get("email")
        or login_payload.get("username")
        or login_payload.get("phone_number")
    ):
        raise ValidationError(
            {
                "login_user": [
                    "لإنشاء حساب دخول للمندوب، يجب توفر بريد إلكتروني أو اسم مستخدم أو رقم جوال."
                ]
            }
        )

    return create_login_user_for_agent(
        agent=agent,
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
# Serializers
# ============================================================

def _serialize_broker(broker: Broker | None) -> dict[str, Any] | None:
    if not broker:
        return None

    user = getattr(broker, "user", None)

    return {
        "id": broker.pk,
        "name": getattr(broker, "name", "") or str(broker),
        "full_name": getattr(broker, "name", "") or str(broker),
        "broker_name": getattr(broker, "name", "") or str(broker),
        "broker_code": getattr(broker, "broker_code", ""),
        "code": getattr(broker, "broker_code", ""),
        "referral_code": getattr(broker, "referral_code", ""),
        "status": getattr(broker, "status", ""),
        "phone": getattr(broker, "phone", ""),
        "email": getattr(broker, "email", ""),
        "city": getattr(broker, "city", ""),
        "user_id": getattr(broker, "user_id", None),
        "has_login_user": bool(getattr(broker, "user_id", None)),
        "login_user": _serialize_login_user(user),
    }


def _serialize_rule(rule: AgentFinancialRule) -> dict[str, Any]:
    return {
        "id": rule.pk,
        "agent_id": rule.agent_id,
        "broker_id": rule.broker_id,
        "rule_name": rule.rule_name,
        "name": rule.rule_name,
        "rule_type": rule.rule_type,
        "scope": rule.scope,
        "calculation_type": rule.calculation_type,
        "commission_type": rule.calculation_type,
        "calculation_base": rule.calculation_base,
        "value": str(rule.value),
        "commission_value": str(rule.value),
        "min_amount": str(rule.min_amount),
        "max_amount": str(rule.max_amount) if rule.max_amount is not None else "",
        "priority": rule.priority,
        "is_active": rule.is_active,
        "valid_from": rule.valid_from.isoformat() if rule.valid_from else None,
        "valid_until": rule.valid_until.isoformat() if rule.valid_until else None,
        "product_id": rule.product_id,
        "provider_id": rule.provider_id,
        "contract_id": rule.contract_id,
        "contract_product_id": rule.contract_product_id,
        "product_type": rule.product_type,
        "order_kind": rule.order_kind,
        "notes": rule.notes,
        "created_at": rule.created_at.isoformat() if rule.created_at else None,
        "updated_at": rule.updated_at.isoformat() if rule.updated_at else None,
    }


def _serialize_agent(
    agent: Agent,
    rules: list[AgentFinancialRule] | None = None,
) -> dict[str, Any]:
    broker = getattr(agent, "broker", None)
    user = getattr(agent, "user", None)
    broker_payload = _serialize_broker(broker)

    return {
        "id": agent.pk,
        "full_name": agent.full_name,
        "name": agent.full_name,
        "agent_code": agent.agent_code,
        "code": agent.agent_code,
        "referral_code": agent.referral_code,
        "status": agent.status,
        "phone": agent.phone,
        "email": agent.email,
        "city": agent.city,
        "address": agent.address,

        "user_id": getattr(agent, "user_id", None),
        "has_login_user": bool(getattr(agent, "user_id", None)),
        "login_user": _serialize_login_user(user),

        "broker_id": agent.broker_id,
        "broker": broker_payload,
        "broker_user_id": (broker_payload or {}).get("user_id") if broker_payload else None,
        "broker_has_login_user": (broker_payload or {}).get("has_login_user") if broker_payload else False,
        "broker_name": (broker_payload or {}).get("name", "") if broker_payload else "",
        "broker_code": (broker_payload or {}).get("broker_code", "") if broker_payload else "",

        "default_commission_type": agent.default_commission_type,
        "default_commission_value": str(agent.default_commission_value),
        "default_delivery_fee": str(agent.default_delivery_fee),

        "bank_name": agent.bank_name,
        "bank_account_name": agent.bank_account_name,
        "iban": agent.iban,
        "notes": agent.notes,

        "rules": [_serialize_rule(rule) for rule in (rules or [])],
        "created_at": agent.created_at.isoformat() if agent.created_at else None,
        "updated_at": agent.updated_at.isoformat() if agent.updated_at else None,
    }


# ============================================================
# Agent Validation
# ============================================================

def _validate_broker(data: dict[str, Any]) -> Broker | None:
    broker_id = (
        data.get("broker_id")
        or data.get("broker")
        or data.get("broker_pk")
        or data.get("parent_broker_id")
    )

    parsed_id = _int_value(broker_id, field_label="broker_id", required=False)

    if not parsed_id:
        return None

    broker = Broker.objects.select_related("user").filter(pk=parsed_id).first()

    if not broker:
        raise ValidationError({"broker_id": ["الوسيط المحدد غير موجود."]})

    if broker.status != BrokerStatus.ACTIVE:
        raise ValidationError({"broker_id": ["لا يمكن ربط المندوب بوسيط غير نشط."]})

    return broker


def _validate_agent_payload(data: dict[str, Any]) -> tuple[dict[str, Any], Broker | None]:
    full_name = _clean_text(
        data.get("full_name")
        or data.get("name")
        or data.get("agent_name")
    )
    agent_code = _clean_upper(
        data.get("agent_code")
        or data.get("code")
    )
    referral_code = _clean_upper(
        data.get("referral_code")
        or data.get("ref_code")
    )

    status = _clean_upper(data.get("status") or AgentStatus.ACTIVE)
    default_commission_type = _clean_upper(
        data.get("default_commission_type")
        or data.get("commission_type")
        or CommissionType.PERCENTAGE
    )
    default_commission_value = _decimal_value(
        data.get("default_commission_value")
        if "default_commission_value" in data
        else data.get("commission_value"),
        default="0.00",
        field_label="default_commission_value",
    )
    default_delivery_fee = _decimal_value(
        data.get("default_delivery_fee")
        if "default_delivery_fee" in data
        else data.get("delivery_fee"),
        default="0.00",
        field_label="default_delivery_fee",
    )

    errors: dict[str, list[str]] = {}

    if not full_name:
        errors.setdefault("full_name", []).append("اسم المندوب مطلوب.")

    if not agent_code:
        errors.setdefault("agent_code", []).append("كود المندوب مطلوب.")

    if not referral_code:
        errors.setdefault("referral_code", []).append("كود الإحالة مطلوب.")

    if status not in _enum_values(AgentStatus):
        errors.setdefault("status", []).append("حالة المندوب غير صحيحة.")

    if default_commission_type not in _enum_values(CommissionType):
        errors.setdefault("default_commission_type", []).append("نوع عمولة البيع غير صحيح.")

    if default_commission_value < Decimal("0.00"):
        errors.setdefault("default_commission_value", []).append("قيمة عمولة البيع لا يمكن أن تكون سالبة.")

    if default_commission_type == CommissionType.PERCENTAGE and default_commission_value > Decimal("100.00"):
        errors.setdefault("default_commission_value", []).append("نسبة عمولة البيع يجب أن تكون بين 0 و 100.")

    if default_delivery_fee < Decimal("0.00"):
        errors.setdefault("default_delivery_fee", []).append("عمولة التوصيل لا يمكن أن تكون سالبة.")

    if agent_code and Agent.objects.filter(agent_code=agent_code).exists():
        errors.setdefault("agent_code", []).append("كود المندوب مستخدم مسبقًا.")

    if referral_code and Agent.objects.filter(referral_code=referral_code).exists():
        errors.setdefault("referral_code", []).append("كود الإحالة مستخدم مسبقًا.")

    broker: Broker | None = None

    try:
        broker = _validate_broker(data)
    except ValidationError as exc:
        serialized = _serialize_validation_errors(exc)
        for key, value in serialized.items():
            errors.setdefault(key, []).extend(value if isinstance(value, list) else [str(value)])

    if errors:
        raise ValidationError(errors)

    metadata = data.get("metadata")
    if not isinstance(metadata, dict):
        metadata = {}

    metadata.update(
        {
            "source": "api_agents_create",
            "financial_ready": True,
            "broker_id": broker.pk if broker else None,
            "default_delivery_fee": str(default_delivery_fee),
            "create_login_user_requested": _should_create_login_user(data),
        }
    )

    validated_data: dict[str, Any] = {
        "full_name": full_name,
        "agent_code": agent_code,
        "referral_code": referral_code,
        "status": status,
        "phone": _clean_text(data.get("phone") or data.get("phone_number") or data.get("mobile")),
        "email": _clean_email(data.get("email")),
        "city": _clean_text(data.get("city")),
        "address": _clean_text(data.get("address")),
        "default_commission_type": default_commission_type,
        "default_commission_value": default_commission_value,
        "default_delivery_fee": default_delivery_fee,
        "bank_name": _clean_text(data.get("bank_name")),
        "bank_account_name": _clean_text(data.get("bank_account_name")),
        "iban": _clean_iban(data.get("iban")),
        "notes": _clean_text(data.get("notes")),
        "metadata": metadata,
    }

    if broker:
        validated_data["broker"] = broker

    return validated_data, broker


# ============================================================
# Rules Validation
# ============================================================

def _extract_rules(data: dict[str, Any]) -> list[dict[str, Any]]:
    raw_rules = (
        data.get("financial_rules")
        or data.get("rules")
        or data.get("commission_rules")
        or []
    )

    if raw_rules in (None, ""):
        return []

    if not isinstance(raw_rules, list):
        raise ValidationError({"financial_rules": ["قواعد العمولات يجب أن تكون قائمة."]})

    cleaned_rules: list[dict[str, Any]] = []

    for index, item in enumerate(raw_rules):
        if not isinstance(item, dict):
            raise ValidationError({"financial_rules": [f"قاعدة العمولة رقم {index + 1} غير صحيحة."]})

        cleaned_rules.append(item)

    return cleaned_rules


def _validate_rule_type(raw_value: Any, *, index: int) -> str:
    value = _clean_upper(
        raw_value
        or FinancialRuleType.SALES_COMMISSION
    )

    if value not in _enum_values(FinancialRuleType):
        raise ValidationError({
            f"financial_rules[{index}].rule_type": [
                "نوع قاعدة العمولة غير صحيح."
            ]
        })

    return value


def _validate_rule_scope(raw_value: Any, *, index: int) -> str:
    value = _clean_upper(
        raw_value
        or FinancialRuleScope.GLOBAL
    )

    if value not in _enum_values(FinancialRuleScope):
        raise ValidationError({
            f"financial_rules[{index}].scope": [
                "نطاق قاعدة العمولة غير صحيح."
            ]
        })

    return value


def _validate_calculation_type(raw_value: Any, *, index: int) -> str:
    value = _clean_upper(
        raw_value
        or CalculationType.PERCENTAGE
    )

    if value not in _enum_values(CalculationType):
        raise ValidationError({
            f"financial_rules[{index}].calculation_type": [
                "طريقة حساب العمولة غير صحيحة."
            ]
        })

    return value


def _validate_calculation_base(raw_value: Any, *, index: int) -> str:
    value = _clean_upper(
        raw_value
        or CalculationBase.NET_BEFORE_TAX
    )

    if value not in _enum_values(CalculationBase):
        raise ValidationError({
            f"financial_rules[{index}].calculation_base": [
                "أساس حساب العمولة غير صحيح."
            ]
        })

    return value


def _validate_scope_target(
    *,
    scope: str,
    rule_data: dict[str, Any],
    index: int,
) -> dict[str, Any]:
    fields: dict[str, Any] = {}

    if scope == FinancialRuleScope.PRODUCT:
        fields["product_id"] = _int_value(
            rule_data.get("product_id"),
            field_label=f"financial_rules[{index}].product_id",
            required=True,
        )

    elif scope == FinancialRuleScope.PROVIDER:
        fields["provider_id"] = _int_value(
            rule_data.get("provider_id"),
            field_label=f"financial_rules[{index}].provider_id",
            required=True,
        )

    elif scope == FinancialRuleScope.CONTRACT:
        fields["contract_id"] = _int_value(
            rule_data.get("contract_id"),
            field_label=f"financial_rules[{index}].contract_id",
            required=True,
        )

    elif scope == FinancialRuleScope.CONTRACT_PRODUCT:
        fields["contract_product_id"] = _int_value(
            rule_data.get("contract_product_id") or rule_data.get("offer_id"),
            field_label=f"financial_rules[{index}].contract_product_id",
            required=True,
        )

    elif scope == FinancialRuleScope.PRODUCT_TYPE:
        product_type = _clean_lower(rule_data.get("product_type"))

        if not product_type:
            raise ValidationError({
                f"financial_rules[{index}].product_type": [
                    "نوع المنتج مطلوب لهذا النطاق."
                ]
            })

        fields["product_type"] = product_type

    elif scope == FinancialRuleScope.ORDER_KIND:
        order_kind = _clean_lower(rule_data.get("order_kind"))

        if not order_kind:
            raise ValidationError({
                f"financial_rules[{index}].order_kind": [
                    "نوع الطلب مطلوب لهذا النطاق."
                ]
            })

        fields["order_kind"] = order_kind

    return fields


def _build_rule_payload(
    *,
    agent: Agent,
    broker: Broker | None,
    rule_data: dict[str, Any],
    index: int,
) -> dict[str, Any]:
    rule_type = _validate_rule_type(
        rule_data.get("rule_type")
        or rule_data.get("type")
        or rule_data.get("entry_type"),
        index=index,
    )
    scope = _validate_rule_scope(
        rule_data.get("scope"),
        index=index,
    )
    calculation_type = _validate_calculation_type(
        rule_data.get("calculation_type")
        or rule_data.get("commission_type")
        or rule_data.get("value_type")
        or rule_data.get("amount_type"),
        index=index,
    )
    calculation_base = _validate_calculation_base(
        rule_data.get("calculation_base")
        or rule_data.get("base"),
        index=index,
    )
    value = _decimal_value(
        rule_data.get("value")
        if "value" in rule_data
        else rule_data.get("commission_value")
        if "commission_value" in rule_data
        else rule_data.get("amount")
        if "amount" in rule_data
        else rule_data.get("rule_value"),
        default="0.00",
        field_label=f"financial_rules[{index}].value",
    )

    min_amount = _decimal_value(
        rule_data.get("min_amount"),
        default="0.00",
        field_label=f"financial_rules[{index}].min_amount",
    )

    max_amount_raw = rule_data.get("max_amount")
    max_amount = None
    if max_amount_raw not in (None, ""):
        max_amount = _decimal_value(
            max_amount_raw,
            default="0.00",
            field_label=f"financial_rules[{index}].max_amount",
        )

    if value < Decimal("0.00"):
        raise ValidationError({
            f"financial_rules[{index}].value": [
                "قيمة قاعدة العمولة لا يمكن أن تكون سالبة."
            ]
        })

    if calculation_type == CalculationType.PERCENTAGE and value > Decimal("100.00"):
        raise ValidationError({
            f"financial_rules[{index}].value": [
                "النسبة يجب أن تكون بين 0 و 100."
            ]
        })

    if min_amount < Decimal("0.00"):
        raise ValidationError({
            f"financial_rules[{index}].min_amount": [
                "الحد الأدنى لا يمكن أن يكون سالبًا."
            ]
        })

    if max_amount is not None and max_amount < min_amount:
        raise ValidationError({
            f"financial_rules[{index}].max_amount": [
                "الحد الأعلى لا يمكن أن يكون أقل من الحد الأدنى."
            ]
        })

    priority = _int_value(
        rule_data.get("priority") or 100,
        field_label=f"financial_rules[{index}].priority",
        required=True,
    ) or 100

    valid_from = _date_value(
        rule_data.get("valid_from")
        or rule_data.get("start_date"),
        field_label=f"financial_rules[{index}].valid_from",
    )
    valid_until = _date_value(
        rule_data.get("valid_until")
        or rule_data.get("end_date"),
        field_label=f"financial_rules[{index}].valid_until",
    )

    if valid_from and valid_until and valid_until < valid_from:
        raise ValidationError({
            f"financial_rules[{index}].valid_until": [
                "تاريخ نهاية القاعدة لا يمكن أن يكون قبل تاريخ البداية."
            ]
        })

    rule_name = _clean_text(
        rule_data.get("rule_name")
        or rule_data.get("name")
        or rule_data.get("title")
    )

    if not rule_name:
        rule_name = f"{agent.agent_code} - {rule_type} - {scope}"

    payload: dict[str, Any] = {
        "agent": agent,
        "rule_name": rule_name,
        "rule_type": rule_type,
        "scope": scope,
        "calculation_type": calculation_type,
        "calculation_base": calculation_base,
        "value": value,
        "min_amount": min_amount,
        "max_amount": max_amount,
        "priority": priority,
        "valid_from": valid_from,
        "valid_until": valid_until,
        "is_active": _bool_value(rule_data.get("is_active"), default=True),
        "notes": _clean_text(rule_data.get("notes")),
        "metadata": {
            "source": "api_agents_create",
            "raw": rule_data,
            "created_at": timezone.now().isoformat(),
        },
    }

    if broker:
        payload["broker"] = broker

    payload.update(
        _validate_scope_target(
            scope=scope,
            rule_data=rule_data,
            index=index,
        )
    )

    return payload


def _create_financial_rules(
    *,
    agent: Agent,
    broker: Broker | None,
    rules_data: list[dict[str, Any]],
) -> list[AgentFinancialRule]:
    created_rules: list[AgentFinancialRule] = []

    for index, rule_data in enumerate(rules_data):
        payload = _build_rule_payload(
            agent=agent,
            broker=broker,
            rule_data=rule_data,
            index=index,
        )

        rule = AgentFinancialRule.objects.create(**payload)
        created_rules.append(rule)

    return created_rules


def _default_rules_from_agent_payload(
    *,
    agent_payload: dict[str, Any],
    raw_data: dict[str, Any],
) -> list[dict[str, Any]]:
    auto_create = _bool_value(
        raw_data.get("auto_create_default_rules"),
        default=True,
    )

    existing_rules = _extract_rules(raw_data)

    if existing_rules:
        return existing_rules

    if not auto_create:
        return []

    rules: list[dict[str, Any]] = [
        {
            "rule_name": "عمولة بيع افتراضية",
            "rule_type": FinancialRuleType.SALES_COMMISSION,
            "scope": FinancialRuleScope.GLOBAL,
            "calculation_type": agent_payload["default_commission_type"],
            "value": str(agent_payload["default_commission_value"]),
            "calculation_base": CalculationBase.NET_BEFORE_TAX,
            "priority": 100,
            "is_active": True,
        }
    ]

    delivery_fee = agent_payload.get("default_delivery_fee", Decimal("0.00"))

    if delivery_fee and delivery_fee > Decimal("0.00"):
        rules.append(
            {
                "rule_name": "عمولة توصيل افتراضية",
                "rule_type": FinancialRuleType.DELIVERY_FEE,
                "scope": FinancialRuleScope.GLOBAL,
                "calculation_type": CalculationType.FIXED,
                "value": str(delivery_fee),
                "calculation_base": CalculationBase.NET_BEFORE_TAX,
                "priority": 110,
                "is_active": True,
            }
        )

    return rules


# ============================================================
# API
# ============================================================

@login_required
@require_POST
@csrf_protect
@permission_required(PermissionCodes.AGENTS_CREATE)
def create_agent_api(request):
    try:
        data = _parse_json_body(request)

        if not data:
            return _json_error(
                "لم يتم إرسال بيانات صالحة.",
                status=400,
                errors={"body": ["JSON body is required."]},
            )

        validated_data, broker = _validate_agent_payload(data)

        rules_data = _default_rules_from_agent_payload(
            agent_payload=validated_data,
            raw_data=data,
        )

        create_login_user = _should_create_login_user(data)
        login_result = None

        with transaction.atomic():
            agent = Agent.objects.create(**validated_data)

            created_rules = _create_financial_rules(
                agent=agent,
                broker=broker,
                rules_data=rules_data,
            )

            if create_login_user:
                login_result = _create_agent_login_user_safely(
                    agent=agent,
                    data=data,
                    actor=request.user,
                )

            agent = (
                Agent.objects
                .select_related("broker", "broker__user", "user")
                .get(pk=agent.pk)
            )

        serialized_agent = _serialize_agent(agent, created_rules)
        login_payload = _serialize_login_result(login_result)

        response_payload: dict[str, Any] = {
            "message": (
                "تم إنشاء المندوب وحساب الدخول بنجاح."
                if create_login_user and serialized_agent.get("has_login_user")
                else "تم إنشاء المندوب بنجاح."
            ),
            "agent": serialized_agent,
            "item": serialized_agent,
            "rules": [_serialize_rule(rule) for rule in created_rules],
            "created_rules_count": len(created_rules),
            "create_login_user": create_login_user,
            "data": {
                "agent": serialized_agent,
                "rules": [_serialize_rule(rule) for rule in created_rules],
                "created_rules_count": len(created_rules),
                "create_login_user": create_login_user,
                **login_payload,
            },
            **login_payload,
        }

        return _json_success(response_payload, status=201)

    except ValidationError as exc:
        return _json_error(
            "تعذر إنشاء المندوب. يرجى مراجعة البيانات.",
            status=400,
            errors=_serialize_validation_errors(exc),
        )

    except AgentServiceError as exc:
        logger.warning("Agent login user service error: %s", exc)
        return _json_error(
            "تم رفض إنشاء أو ربط حساب دخول المندوب.",
            status=400,
            errors={"login_user": [str(exc)]},
        )

    except IntegrityError as exc:
        logger.warning("Agent integrity error: %s", exc)
        return _json_error(
            "تعذر إنشاء المندوب بسبب تكرار كود المندوب أو كود الإحالة.",
            status=409,
        )

    except Exception as exc:
        logger.exception("Failed to create agent: %s", exc)
        return _json_error("تعذر إنشاء المندوب.", status=500)