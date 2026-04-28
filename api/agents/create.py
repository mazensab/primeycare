# ============================================================
# 📂 api/agents/create.py
# 🧠 Primey Care | Create Agent API
# ------------------------------------------------------------
# ✅ إنشاء مندوب جديد
# ✅ تحقق من المدخلات
# ✅ منع تكرار كود المندوب وكود الإحالة
# ✅ رسائل أخطاء واضحة للـ Frontend
# ✅ متوافق مع صفحة app/system/agents/create/page.tsx
# ============================================================

from __future__ import annotations

import json
import logging
from decimal import Decimal, InvalidOperation
from typing import Any

from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from agents.models import Agent, AgentStatus, CommissionType

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
        "message": message,
    }

    if errors:
        payload["errors"] = errors

    return JsonResponse(payload, status=status)


def _json_success(data: dict[str, Any], status: int = 201) -> JsonResponse:
    payload = {"ok": True}
    payload.update(data)
    return JsonResponse(payload, status=status)


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


def _decimal_value(value: Any, default: str = "0.00") -> Decimal:
    try:
        return Decimal(str(value if value not in (None, "") else default))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError("قيمة العمولة غير صالحة.")


def _serialize_validation_errors(exc: ValidationError) -> dict[str, Any]:
    if hasattr(exc, "message_dict"):
        return exc.message_dict

    if hasattr(exc, "messages"):
        return {"non_field_errors": exc.messages}

    return {"non_field_errors": [str(exc)]}


def _serialize_agent(agent: Agent) -> dict[str, Any]:
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
        "default_commission_type": agent.default_commission_type,
        "default_commission_value": str(agent.default_commission_value),
        "bank_name": agent.bank_name,
        "bank_account_name": agent.bank_account_name,
        "iban": agent.iban,
        "notes": agent.notes,
        "created_at": agent.created_at.isoformat() if agent.created_at else None,
        "updated_at": agent.updated_at.isoformat() if agent.updated_at else None,
    }


def _validate_payload(data: dict[str, Any]) -> dict[str, Any]:
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
    )

    errors: dict[str, list[str]] = {}

    if not full_name:
        errors.setdefault("full_name", []).append("اسم المندوب مطلوب.")

    if not agent_code:
        errors.setdefault("agent_code", []).append("كود المندوب مطلوب.")

    if not referral_code:
        errors.setdefault("referral_code", []).append("كود الإحالة مطلوب.")

    if status not in AgentStatus.values:
        errors.setdefault("status", []).append("حالة المندوب غير صحيحة.")

    if default_commission_type not in CommissionType.values:
        errors.setdefault("default_commission_type", []).append(
            "نوع العمولة غير صحيح."
        )

    if default_commission_value < 0:
        errors.setdefault("default_commission_value", []).append(
            "قيمة العمولة لا يمكن أن تكون سالبة."
        )

    if (
        default_commission_type == CommissionType.PERCENTAGE
        and default_commission_value > 100
    ):
        errors.setdefault("default_commission_value", []).append(
            "نسبة العمولة يجب أن تكون بين 0 و 100."
        )

    if agent_code and Agent.objects.filter(agent_code=agent_code).exists():
        errors.setdefault("agent_code", []).append("كود المندوب مستخدم مسبقًا.")

    if referral_code and Agent.objects.filter(referral_code=referral_code).exists():
        errors.setdefault("referral_code", []).append("كود الإحالة مستخدم مسبقًا.")

    if errors:
        raise ValidationError(errors)

    return {
        "full_name": full_name,
        "agent_code": agent_code,
        "referral_code": referral_code,
        "status": status,
        "phone": _clean_text(data.get("phone")),
        "email": _clean_email(data.get("email")),
        "city": _clean_text(data.get("city")),
        "address": _clean_text(data.get("address")),
        "default_commission_type": default_commission_type,
        "default_commission_value": default_commission_value,
        "bank_name": _clean_text(data.get("bank_name")),
        "bank_account_name": _clean_text(data.get("bank_account_name")),
        "iban": _clean_iban(data.get("iban")),
        "notes": _clean_text(data.get("notes")),
    }


# ============================================================
# API
# ============================================================

@login_required
@require_POST
def create_agent_api(request):
    try:
        data = _parse_json_body(request)

        if not data:
            return _json_error(
                "لم يتم إرسال بيانات صالحة.",
                status=400,
                errors={"body": ["JSON body is required."]},
            )

        validated_data = _validate_payload(data)

        with transaction.atomic():
            agent = Agent.objects.create(**validated_data)

        return _json_success(
            {
                "message": "تم إنشاء المندوب بنجاح.",
                "agent": _serialize_agent(agent),
            },
            status=201,
        )

    except ValidationError as exc:
        return _json_error(
            "تعذر إنشاء المندوب. يرجى مراجعة البيانات.",
            status=400,
            errors=_serialize_validation_errors(exc),
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