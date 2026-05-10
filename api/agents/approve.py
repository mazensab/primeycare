# ============================================================
# 📂 api/agents/approve.py
# 🧠 Primey Care | Approve Agent Commission API V2
# ------------------------------------------------------------
# ✅ اعتماد عمولة مندوب
# ✅ تشغيل خدمة approve_commission الرسمية
# ✅ جدولة قيد استحقاق العمولة بعد commit
# ✅ متوافق مع Accounting Backend الجديد
# ✅ تجهيز استجابة مفهومة للـ Frontend
# ✅ أخطاء واضحة بدون كشف تفاصيل داخلية للمستخدم
# ============================================================

from __future__ import annotations

import json
import logging
from decimal import Decimal
from typing import Any

from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from agents.models import AgentCommission
from agents.services import (
    CommissionPostingError,
    CommissionValidationError,
    approve_commission,
)


logger = logging.getLogger(__name__)


# ============================================================
# JSON Helpers
# ============================================================

def _decimal_to_string(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)

    if isinstance(value, dict):
        return {key: _decimal_to_string(val) for key, val in value.items()}

    if isinstance(value, list):
        return [_decimal_to_string(item) for item in value]

    if isinstance(value, tuple):
        return tuple(_decimal_to_string(item) for item in value)

    return value


def _json_error(
    message: str,
    *,
    status: int = 400,
    errors: Any = None,
) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": False,
        "success": False,
        "message": message,
    }

    if errors is not None:
        payload["errors"] = _decimal_to_string(errors)

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


def _json_success(
    data: dict[str, Any],
    *,
    message: str = "تم تنفيذ العملية بنجاح.",
    status: int = 200,
) -> JsonResponse:
    return JsonResponse(
        {
            "ok": True,
            "success": True,
            "message": message,
            "data": _decimal_to_string(data),
        },
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
    except json.JSONDecodeError as exc:
        raise ValidationError("صيغة JSON غير صحيحة.") from exc

    if not isinstance(parsed, dict):
        raise ValidationError("جسم الطلب يجب أن يكون JSON Object.")

    return parsed


def _date_iso(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _bool_value(value: Any, default: bool = True) -> bool:
    if value in {None, ""}:
        return default

    if isinstance(value, bool):
        return value

    normalized = str(value).strip().lower()

    if normalized in {"1", "true", "yes", "y", "on"}:
        return True

    if normalized in {"0", "false", "no", "n", "off"}:
        return False

    return default


def _safe_attr(obj: Any, attr_name: str, default: Any = None) -> Any:
    try:
        return getattr(obj, attr_name, default)
    except Exception:
        return default


def _resolve_commission_reference(commission: AgentCommission) -> str:
    return str(
        _safe_attr(commission, "reference", "")
        or _safe_attr(commission, "commission_number", "")
        or _safe_attr(commission, "accounting_entry_reference", "")
        or _safe_attr(commission, "journal_entry_reference", "")
        or f"COM-{commission.pk}"
    )


def _serialize_agent(agent) -> dict[str, Any] | None:
    if not agent:
        return None

    return {
        "id": _safe_attr(agent, "id", None),
        "agent_code": _safe_attr(agent, "agent_code", ""),
        "full_name": _safe_attr(agent, "full_name", ""),
        "phone": _safe_attr(agent, "phone", ""),
        "email": _safe_attr(agent, "email", ""),
        "status": _safe_attr(agent, "status", ""),
    }


def _serialize_order(order) -> dict[str, Any] | None:
    if not order:
        return None

    return {
        "id": _safe_attr(order, "id", None),
        "order_number": (
            _safe_attr(order, "order_number", "")
            or _safe_attr(order, "number", "")
            or _safe_attr(order, "code", "")
        ),
        "status": _safe_attr(order, "status", ""),
        "total_amount": _safe_attr(order, "total_amount", None),
    }


def _serialize_payment(payment) -> dict[str, Any] | None:
    if not payment:
        return None

    return {
        "id": _safe_attr(payment, "id", None),
        "payment_number": _safe_attr(payment, "payment_number", ""),
        "status": _safe_attr(payment, "status", ""),
        "amount": _safe_attr(payment, "amount", None),
        "paid_amount": _safe_attr(payment, "paid_amount", None),
        "currency": _safe_attr(payment, "currency", "SAR"),
    }


def _serialize_commission(commission: AgentCommission, result: Any = None) -> dict[str, Any]:
    return {
        "id": commission.pk,
        "reference": _resolve_commission_reference(commission),
        "status_before": _safe_attr(result, "status_before", None),
        "status_after": _safe_attr(result, "status_after", None),
        "commission_status": commission.commission_status,
        "agent_id": commission.agent_id,
        "agent": _serialize_agent(_safe_attr(commission, "agent", None)),
        "order_id": commission.order_id,
        "order": _serialize_order(_safe_attr(commission, "order", None)),
        "agent_order_id": commission.agent_order_id,
        "payment_id": commission.payment_id,
        "payment": _serialize_payment(_safe_attr(commission, "payment", None)),
        "base_amount": commission.base_amount,
        "commission_amount": commission.commission_amount,
        "paid_amount": commission.paid_amount,
        "remaining_amount": _safe_attr(commission, "remaining_amount", None),
        "earned_at": _date_iso(commission.earned_at),
        "approved_at": _date_iso(commission.approved_at),
        "paid_at": _date_iso(commission.paid_at),
        "accounting": {
            "is_accounting_posted": bool(_safe_attr(commission, "is_accounting_posted", False)),
            "accounting_entry_reference": _safe_attr(commission, "accounting_entry_reference", ""),
            "journal_entry_reference": _safe_attr(commission, "journal_entry_reference", ""),
            "posting_reference": _safe_attr(commission, "posting_reference", ""),
            "posted_at": _date_iso(_safe_attr(commission, "posted_at", None)),
        },
        "created_at": _date_iso(_safe_attr(commission, "created_at", None)),
        "updated_at": _date_iso(_safe_attr(commission, "updated_at", None)),
    }


def _serialize_accounting_result(result: Any) -> dict[str, Any]:
    return {
        "requested": bool(_safe_attr(result, "accounting_post_requested", False)),
        "dispatched": bool(_safe_attr(result, "accounting_post_dispatched", False)),
        "message": _safe_attr(result, "accounting_post_message", ""),
    }


# ============================================================
# API
# ============================================================

@login_required
@require_POST
def approve_commission_api(request, commission_id: int):
    """
    اعتماد عمولة مندوب.

    Body اختياري:
    {
      "auto_post_accounting": true
    }
    """
    try:
        body = _parse_json_body(request)

        commission = (
            AgentCommission.objects.select_related(
                "agent",
                "order",
                "payment",
                "agent_order",
            )
            .filter(pk=commission_id)
            .first()
        )

        if not commission:
            return _json_error("العمولة غير موجودة.", status=404)

        auto_post_accounting = _bool_value(
            body.get("auto_post_accounting"),
            default=True,
        )

        result = approve_commission(
            commission=commission,
            actor=request.user,
            auto_post_accounting=auto_post_accounting,
        )

        commission = (
            AgentCommission.objects.select_related(
                "agent",
                "order",
                "payment",
                "agent_order",
            )
            .filter(pk=commission_id)
            .first()
        )

        return _json_success(
            {
                "commission": _serialize_commission(commission, result),
                "accounting": _serialize_accounting_result(result),
            },
            message="تم اعتماد العمولة بنجاح.",
        )

    except ValidationError as exc:
        logger.warning(
            "Invalid JSON/body while approving commission %s: %s",
            commission_id,
            exc,
        )
        return _json_error(
            "بيانات الطلب غير صحيحة.",
            status=400,
            errors=getattr(exc, "message_dict", None) or getattr(exc, "messages", None) or str(exc),
        )

    except CommissionValidationError as exc:
        logger.warning(
            "Commission validation error while approving commission %s: %s",
            commission_id,
            exc,
        )
        return _json_error(str(exc), status=400)

    except CommissionPostingError as exc:
        logger.exception(
            "Commission posting error while approving commission %s: %s",
            commission_id,
            exc,
        )
        return _json_error(
            "تمت محاولة اعتماد العمولة لكن فشل الترحيل المحاسبي.",
            status=500,
        )

    except Exception as exc:
        logger.exception("Failed to approve commission %s: %s", commission_id, exc)
        return _json_error("تعذر اعتماد العمولة.", status=500)