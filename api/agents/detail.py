# ============================================================
# 📂 api/agents/detail.py
# 🧠 Primey Care | Agent Detail + Commission Detail API
# ------------------------------------------------------------
# ✅ /api/agents/<agent_id>/                     -> تفاصيل مندوب
# ✅ /api/agents/<agent_id>/?include_statement=1 -> تفاصيل + كشف حساب
# ✅ /api/agents/commissions/<commission_id>/    -> تفاصيل عمولة
# ============================================================

from __future__ import annotations

import logging
from datetime import datetime
from decimal import Decimal
from typing import Any

from django.contrib.auth.decorators import login_required
from django.db.models import Count, Q, Sum
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from agents.models import Agent, AgentCommission, AgentOrder
from agents.services import build_agent_statement_payload

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

def _money(value: Any) -> str:
    try:
        return str(Decimal(str(value or "0.00")).quantize(Decimal("0.01")))
    except Exception:
        return "0.00"


def _date_iso(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _parse_date(value: str | None):
    if not value:
        return None

    try:
        return datetime.fromisoformat(value).date()
    except Exception:
        return None


def _customer_name(customer: Any) -> str:
    if not customer:
        return ""

    return (
        getattr(customer, "name", None)
        or getattr(customer, "full_name", None)
        or getattr(customer, "customer_name", None)
        or str(customer)
    )


def _order_number(order: Any) -> str:
    if not order:
        return ""

    return (
        getattr(order, "order_number", None)
        or getattr(order, "number", None)
        or f"ORD-{getattr(order, 'pk', '')}"
    )


# ============================================================
# Serializers
# ============================================================

def _serialize_agent(agent: Agent, stats: dict[str, Any] | None = None) -> dict[str, Any]:
    stats = stats or {}

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
        "default_commission_value": _money(agent.default_commission_value),
        "bank_name": agent.bank_name,
        "bank_account_name": agent.bank_account_name,
        "iban": agent.iban,
        "notes": agent.notes,
        "total_customers": stats.get("total_customers", 0),
        "customers_count": stats.get("total_customers", 0),
        "total_orders": stats.get("total_orders", 0),
        "orders_count": stats.get("total_orders", 0),
        "total_sales": _money(stats.get("total_sales")),
        "pending_commission": _money(stats.get("pending_commission")),
        "approved_commission": _money(stats.get("approved_commission")),
        "paid_commission": _money(stats.get("paid_commission")),
        "total_commission": _money(stats.get("total_commission")),
        "due_commission": _money(stats.get("due_commission")),
        "created_at": _date_iso(agent.created_at),
        "updated_at": _date_iso(agent.updated_at),
    }


def _serialize_agent_order(agent_order: AgentOrder) -> dict[str, Any]:
    order = getattr(agent_order, "order", None)
    customer = getattr(agent_order, "customer", None)

    return {
        "id": agent_order.pk,
        "order_id": agent_order.order_id,
        "order_number": _order_number(order),
        "agent_id": agent_order.agent_id,
        "customer_id": agent_order.customer_id,
        "customer_name": _customer_name(customer),
        "commission_type": agent_order.commission_type,
        "commission_value": _money(agent_order.commission_value),
        "sales_amount": _money(agent_order.sales_amount),
        "commission_amount": _money(agent_order.commission_amount),
        "referral_code_used": agent_order.referral_code_used,
        "notes": agent_order.notes,
        "created_at": _date_iso(agent_order.created_at),
        "updated_at": _date_iso(agent_order.updated_at),
    }


def _serialize_commission(commission: AgentCommission) -> dict[str, Any]:
    agent = getattr(commission, "agent", None)
    order = getattr(commission, "order", None)
    payment = getattr(commission, "payment", None)
    agent_order = getattr(commission, "agent_order", None)
    customer = getattr(agent_order, "customer", None) if agent_order else None

    return {
        "id": commission.pk,
        "reference": f"COM-{commission.pk}",
        "status": commission.commission_status,
        "commission_status": commission.commission_status,
        "agent_id": commission.agent_id,
        "agent_name": getattr(agent, "full_name", ""),
        "agent_code": getattr(agent, "agent_code", ""),
        "referral_code": getattr(agent, "referral_code", ""),
        "order_id": commission.order_id,
        "order_number": _order_number(order),
        "payment_id": commission.payment_id,
        "payment_number": getattr(payment, "payment_number", ""),
        "customer_id": getattr(customer, "pk", None),
        "customer_name": _customer_name(customer),
        "base_amount": _money(commission.base_amount),
        "amount": _money(commission.commission_amount),
        "commission_amount": _money(commission.commission_amount),
        "paid_amount": _money(commission.paid_amount),
        "remaining_amount": _money(commission.remaining_amount),
        "earned_at": _date_iso(commission.earned_at),
        "approved_at": _date_iso(commission.approved_at),
        "paid_at": _date_iso(commission.paid_at),
        "created_at": _date_iso(commission.created_at),
        "updated_at": _date_iso(commission.updated_at),
        "notes": commission.notes,
    }


# ============================================================
# APIs
# ============================================================

@login_required
@require_GET
def agent_detail_api(request, agent_id: int):
    try:
        agent = Agent.objects.filter(pk=agent_id).first()
        if not agent:
            return _json_error("المندوب غير موجود.", status=404)

        agent_orders_qs = (
            AgentOrder.objects.select_related("order", "customer", "agent")
            .filter(agent=agent)
            .order_by("-created_at", "-id")
        )

        commissions_qs = (
            AgentCommission.objects.select_related(
                "agent",
                "order",
                "payment",
                "agent_order",
                "agent_order__customer",
            )
            .filter(agent=agent)
            .order_by("-created_at", "-id")
        )

        stats = {
            "total_customers": agent_orders_qs.values("customer_id").distinct().count(),
            "total_orders": agent_orders_qs.count(),
            "total_sales": agent_orders_qs.aggregate(total=Sum("sales_amount")).get("total"),
            "pending_commission": commissions_qs.filter(
                commission_status="PENDING"
            ).aggregate(total=Sum("commission_amount")).get("total"),
            "approved_commission": commissions_qs.filter(
                commission_status="APPROVED"
            ).aggregate(total=Sum("commission_amount")).get("total"),
            "paid_commission": commissions_qs.filter(
                commission_status="PAID"
            ).aggregate(total=Sum("paid_amount")).get("total"),
            "total_commission": commissions_qs.aggregate(
                total=Sum("commission_amount")
            ).get("total"),
            "due_commission": commissions_qs.aggregate(
                total=Sum("commission_amount")
            ).get("total")
            or Decimal("0.00"),
        }

        total_paid = commissions_qs.aggregate(total=Sum("paid_amount")).get("total") or Decimal("0.00")
        total_commission = stats["total_commission"] or Decimal("0.00")
        stats["due_commission"] = total_commission - total_paid

        recent_orders = [
            _serialize_agent_order(agent_order)
            for agent_order in agent_orders_qs[:10]
        ]

        recent_commissions = [
            _serialize_commission(commission)
            for commission in commissions_qs[:10]
        ]

        payload: dict[str, Any] = {
            "agent": _serialize_agent(agent, stats),
            "stats": {
                key: _money(value)
                if key.endswith("commission") or key in {"total_sales", "total_commission", "due_commission"}
                else value
                for key, value in stats.items()
            },
            "recent_orders": recent_orders,
            "recent_commissions": recent_commissions,
        }

        include_statement = request.GET.get("include_statement") in {"1", "true", "True", "yes"}
        if include_statement:
            date_from = _parse_date(request.GET.get("date_from"))
            date_to = _parse_date(request.GET.get("date_to"))
            include_agent_orders = request.GET.get("include_agent_orders") in {
                "1",
                "true",
                "True",
                "yes",
            }

            payload["statement"] = build_agent_statement_payload(
                agent=agent,
                date_from=date_from,
                date_to=date_to,
                include_agent_orders=include_agent_orders,
                include_commissions=True,
            )

        return _json_success(payload)

    except Exception as exc:
        logger.exception("Failed to fetch agent detail: %s", exc)
        return _json_error("تعذر جلب تفاصيل المندوب.", status=500)


@login_required
@require_GET
def commission_detail_api(request, commission_id: int):
    try:
        commission = (
            AgentCommission.objects.select_related(
                "agent",
                "order",
                "payment",
                "agent_order",
                "agent_order__customer",
            )
            .filter(pk=commission_id)
            .first()
        )

        if not commission:
            return _json_error("العمولة غير موجودة.", status=404)

        return _json_success(
            {
                "commission": _serialize_commission(commission),
            }
        )

    except Exception as exc:
        logger.exception("Failed to fetch commission detail: %s", exc)
        return _json_error("تعذر جلب تفاصيل العمولة.", status=500)