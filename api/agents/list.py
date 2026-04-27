# ============================================================
# 📂 api/agents/list.py
# 🧠 Agent Commissions API List — Primey Care
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
        "amount": str(_value("amount") or _value("commission_amount") or "0.00"),
        "approval_date": (
            (_value("approved_date") or _value("approval_date") or _value("date")).isoformat()
            if (_value("approved_date") or _value("approval_date") or _value("date"))
            else None
        ),
    }


@login_required
@require_GET
def commission_list_api(request):
    try:
        Commission = _resolve_commission_model()
        company_id = _extract_company_id(request)

        queryset = Commission.objects.all().order_by("-id")
        model_fields = {field.name for field in Commission._meta.fields}

        if company_id and "company" in model_fields:
            queryset = queryset.filter(company_id=company_id)

        status_filter = request.GET.get("status")
        if status_filter and "status" in model_fields:
            queryset = queryset.filter(status=status_filter)

        agent_id = request.GET.get("agent_id")
        if agent_id and "agent" in model_fields:
            queryset = queryset.filter(agent_id=agent_id)

        limit = request.GET.get("limit", "50")
        try:
            limit_value = max(1, min(int(limit), 200))
        except ValueError:
            limit_value = 50

        commissions = list(queryset[:limit_value])
        data = [_serialize_commission(item) for item in commissions]

        return _json_success(
            {
                "count": len(data),
                "results": data,
            }
        )
    except Exception as exc:
        logger.exception("Failed to fetch commission list: %s", exc)
        return _json_error("تعذر جلب قائمة العمولات.", status=500)