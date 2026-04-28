# ============================================================
# 📂 api/agents/approve.py
# 🧠 Primey Care | Approve Agent Commission API
# ------------------------------------------------------------
# ✅ اعتماد عمولة مندوب
# ✅ تشغيل خدمة approve_commission الرسمية
# ✅ تجهيز استجابة مفهومة للـ Frontend
# ✅ أخطاء واضحة بدون كشف تفاصيل داخلية للمستخدم
# ============================================================

from __future__ import annotations

import json
import logging
from typing import Any

from django.contrib.auth.decorators import login_required
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

def _json_error(message: str, status: int = 400) -> JsonResponse:
    return JsonResponse(
        {
            "ok": False,
            "message": message,
        },
        status=status,
    )


def _json_success(data: dict[str, Any], status: int = 200) -> JsonResponse:
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


def _date_iso(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _bool_value(value: Any, default: bool = True) -> bool:
    if value is None:
        return default

    if isinstance(value, bool):
        return value

    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "y", "on"}:
        return True
    if normalized in {"0", "false", "no", "n", "off"}:
        return False

    return default


# ============================================================
# API
# ============================================================

@login_required
@require_POST
def approve_commission_api(request, commission_id: int):
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

        commission.refresh_from_db()

        return _json_success(
            {
                "message": "تم اعتماد العمولة بنجاح.",
                "commission": {
                    "id": commission.pk,
                    "reference": f"COM-{commission.pk}",
                    "status_before": result.status_before,
                    "status_after": result.status_after,
                    "commission_status": commission.commission_status,
                    "agent_id": commission.agent_id,
                    "order_id": commission.order_id,
                    "base_amount": str(commission.base_amount),
                    "commission_amount": str(commission.commission_amount),
                    "paid_amount": str(commission.paid_amount),
                    "remaining_amount": str(commission.remaining_amount),
                    "earned_at": _date_iso(commission.earned_at),
                    "approved_at": _date_iso(commission.approved_at),
                    "paid_at": _date_iso(commission.paid_at),
                },
                "accounting": {
                    "requested": result.accounting_post_requested,
                    "dispatched": result.accounting_post_dispatched,
                    "message": result.accounting_post_message,
                },
            }
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