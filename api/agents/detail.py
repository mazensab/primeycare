# ============================================================
# 📂 api/agents/detail.py
# 🧠 Commission Detail API — Primey Care
# ============================================================

from __future__ import annotations

import logging
from typing import Any

from django.apps import apps
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_GET

logger = logging.getLogger(__name__)


def _json_error(message: str, status: int = 400) -> JsonResponse:
    return JsonResponse({"ok": False, "message": message}, status=status)


def _json_success(data: dict[str, Any], status: int = 200) -> JsonResponse:
    payload = {"ok": True}
    payload.update(data)
    return JsonResponse(payload, status=status)


def _resolve_commission_model():
    for model_name in ["AgentCommission", "Commission", "SalesCommission"]:
        try:
            return apps.get_model("agents", model_name)
        except LookupError:
            continue
    raise LookupError("Commission model was not found in agents app.")


def _extract_company_id(request) -> int | None:
    raw_value = (
        request.GET.get("company_id")
        or request.headers.get("X-Company-Id")
        or request.session.get("active_company_id")
    )
    try:
        return int(raw_value) if raw_value else None
    except (TypeError, ValueError):
        return None


def _serialize_commission(commission) -> dict[str, Any]:
    def _value(name: str, default=None):
        return getattr(commission, name, default)

    return {
        "id": commission.pk,
        "reference": _value("reference") or _value("commission_number") or f"COM-{commission.pk}",
        "status": _value("status"),
        "agent_id": _value("agent_id"),
        "invoice_id": _value("invoice_id"),
        "order_id": _value("order_id"),
        "company_id": _value("company_id"),
        "amount": str(_value("amount") or _value("commission_amount") or "0.00"),
        "approved_at": _value("approved_at").isoformat() if _value("approved_at") else None,
        "approval_date": (
            (_value("approved_date") or _value("approval_date") or _value("date")).isoformat()
            if (_value("approved_date") or _value("approval_date") or _value("date"))
            else None
        ),
        "notes": _value("notes"),
        "created_at": _value("created_at").isoformat() if _value("created_at") else None,
        "updated_at": _value("updated_at").isoformat() if _value("updated_at") else None,
    }


@login_required
@require_GET
def commission_detail_api(request, commission_id: int):
    try:
        Commission = _resolve_commission_model()
        company_id = _extract_company_id(request)

        queryset = Commission.objects.all()
        model_fields = {field.name for field in Commission._meta.fields}

        if company_id and "company" in model_fields:
            queryset = queryset.filter(company_id=company_id)

        commission = queryset.filter(pk=commission_id).first()
        if not commission:
            return _json_error("العمولة غير موجودة.", status=404)

        return _json_success({"commission": _serialize_commission(commission)})
    except Exception as exc:
        logger.exception("Failed to fetch commission detail: %s", exc)
        return _json_error("تعذر جلب تفاصيل العمولة.", status=500)