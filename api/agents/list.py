# ============================================================
# 📂 api/agents/list.py
# 🧠 Primey Care | Agents List + Commissions List API
# ------------------------------------------------------------
# ✅ /api/agents/                  -> قائمة المندوبين
# ✅ /api/agents/commissions/      -> قائمة العمولات
# ✅ إحصائيات جاهزة للـ Frontend
# ✅ بحث + فلترة + Pagination
# ✅ بدون DRF للحفاظ على بنية المشروع الحالية
# ============================================================

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

from django.contrib.auth.decorators import login_required
from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator
from django.db.models import Count, Q, Sum
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from agents.models import Agent, AgentCommission, AgentOrder

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


def _int_param(value: Any, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
        return max(minimum, min(parsed, maximum))
    except (TypeError, ValueError):
        return default


def _date_iso(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
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


# ============================================================
# Serializers
# ============================================================

def _serialize_agent(agent: Agent) -> dict[str, Any]:
    total_customers = getattr(agent, "total_customers", 0) or 0
    total_orders = getattr(agent, "total_orders", 0) or 0
    total_sales = getattr(agent, "total_sales", Decimal("0.00")) or Decimal("0.00")
    pending_commission = (
        getattr(agent, "pending_commission", Decimal("0.00")) or Decimal("0.00")
    )
    approved_commission = (
        getattr(agent, "approved_commission", Decimal("0.00")) or Decimal("0.00")
    )
    paid_commission = (
        getattr(agent, "paid_commission", Decimal("0.00")) or Decimal("0.00")
    )
    accounting_posted_commission = (
        getattr(agent, "accounting_posted_commission", Decimal("0.00"))
        or Decimal("0.00")
    )

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
        "total_customers": total_customers,
        "customers_count": total_customers,
        "total_orders": total_orders,
        "orders_count": total_orders,
        "total_sales": _money(total_sales),
        "sales_total": _money(total_sales),
        "pending_commission": _money(pending_commission),
        "approved_commission": _money(approved_commission),
        "paid_commission": _money(paid_commission),
        "accounting_posted_commission": _money(accounting_posted_commission),
        "created_at": _date_iso(agent.created_at),
        "updated_at": _date_iso(agent.updated_at),
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
        "order_number": getattr(order, "order_number", "") if order else "",
    }


# ============================================================
# Query Builders
# ============================================================

def _build_agents_queryset(request):
    queryset = (
        Agent.objects.all()
        .annotate(
            total_customers=Count("agent_orders__customer", distinct=True),
            total_orders=Count("agent_orders", distinct=True),
            total_sales=Sum("agent_orders__sales_amount"),
            pending_commission=Sum(
                "commissions__commission_amount",
                filter=Q(commissions__commission_status="PENDING"),
            ),
            approved_commission=Sum(
                "commissions__commission_amount",
                filter=Q(commissions__commission_status="APPROVED"),
            ),
            paid_commission=Sum(
                "commissions__paid_amount",
                filter=Q(commissions__commission_status="PAID"),
            ),
            accounting_posted_commission=Sum(
                "commissions__commission_amount",
                filter=Q(commissions__commission_status__in=["APPROVED", "PAID"]),
            ),
        )
        .order_by("full_name", "id")
    )

    search = (request.GET.get("search") or request.GET.get("q") or "").strip()
    if search:
        queryset = queryset.filter(
            Q(full_name__icontains=search)
            | Q(agent_code__icontains=search)
            | Q(referral_code__icontains=search)
            | Q(phone__icontains=search)
            | Q(email__icontains=search)
            | Q(city__icontains=search)
        )

    status_filter = (request.GET.get("status") or "").strip().upper()
    if status_filter:
        queryset = queryset.filter(status=status_filter)

    city = (request.GET.get("city") or "").strip()
    if city:
        queryset = queryset.filter(city__icontains=city)

    commission_type = (request.GET.get("commission_type") or "").strip().upper()
    if commission_type:
        queryset = queryset.filter(default_commission_type=commission_type)

    return queryset


def _build_commissions_queryset(request):
    queryset = (
        AgentCommission.objects.select_related(
            "agent",
            "order",
            "payment",
            "agent_order",
            "agent_order__customer",
        )
        .all()
        .order_by("-created_at", "-id")
    )

    search = (request.GET.get("search") or request.GET.get("q") or "").strip()
    if search:
        queryset = queryset.filter(
            Q(agent__full_name__icontains=search)
            | Q(agent__agent_code__icontains=search)
            | Q(agent__referral_code__icontains=search)
            | Q(order__id__icontains=search)
            | Q(payment__payment_number__icontains=search)
            | Q(notes__icontains=search)
        )

    status_filter = (
        request.GET.get("status")
        or request.GET.get("commission_status")
        or ""
    ).strip().upper()
    if status_filter:
        queryset = queryset.filter(commission_status=status_filter)

    agent_id = request.GET.get("agent_id")
    if agent_id:
        queryset = queryset.filter(agent_id=agent_id)

    order_id = request.GET.get("order_id")
    if order_id:
        queryset = queryset.filter(order_id=order_id)

    return queryset


# ============================================================
# APIs
# ============================================================

@login_required
@require_GET
def agent_list_api(request):
    try:
        queryset = _build_agents_queryset(request)

        total_count = queryset.count()
        active_count = queryset.filter(status="ACTIVE").count()
        inactive_count = queryset.filter(status="INACTIVE").count()
        suspended_count = queryset.filter(status="SUSPENDED").count()
        draft_count = queryset.filter(status="DRAFT").count()

        totals = queryset.aggregate(
            total_sales=Sum("agent_orders__sales_amount"),
            total_commission=Sum("commissions__commission_amount"),
            total_paid=Sum("commissions__paid_amount"),
        )

        page_number = _int_param(request.GET.get("page"), 1, 1, 100000)
        page_size = _int_param(
            request.GET.get("page_size") or request.GET.get("limit"),
            50,
            1,
            200,
        )

        paginator = Paginator(queryset, page_size)

        try:
            page_obj = paginator.page(page_number)
        except PageNotAnInteger:
            page_obj = paginator.page(1)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages or 1)

        results = [_serialize_agent(agent) for agent in page_obj.object_list]

        return _json_success(
            {
                "count": paginator.count,
                "page": page_obj.number,
                "page_size": page_size,
                "num_pages": paginator.num_pages,
                "has_next": page_obj.has_next(),
                "has_previous": page_obj.has_previous(),
                "results": results,
                "stats": {
                    "total_agents": total_count,
                    "active_agents": active_count,
                    "inactive_agents": inactive_count,
                    "suspended_agents": suspended_count,
                    "draft_agents": draft_count,
                    "total_sales": _money(totals.get("total_sales")),
                    "total_commission": _money(totals.get("total_commission")),
                    "total_paid": _money(totals.get("total_paid")),
                },
            }
        )
    except Exception as exc:
        logger.exception("Failed to fetch agents list: %s", exc)
        return _json_error("تعذر جلب قائمة المندوبين.", status=500)


@login_required
@require_GET
def commission_list_api(request):
    try:
        queryset = _build_commissions_queryset(request)

        page_number = _int_param(request.GET.get("page"), 1, 1, 100000)
        page_size = _int_param(
            request.GET.get("page_size") or request.GET.get("limit"),
            50,
            1,
            200,
        )

        paginator = Paginator(queryset, page_size)

        try:
            page_obj = paginator.page(page_number)
        except PageNotAnInteger:
            page_obj = paginator.page(1)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages or 1)

        totals = queryset.aggregate(
            total_base=Sum("base_amount"),
            total_commission=Sum("commission_amount"),
            total_paid=Sum("paid_amount"),
        )

        results = [
            _serialize_commission(commission)
            for commission in page_obj.object_list
        ]

        return _json_success(
            {
                "count": paginator.count,
                "page": page_obj.number,
                "page_size": page_size,
                "num_pages": paginator.num_pages,
                "has_next": page_obj.has_next(),
                "has_previous": page_obj.has_previous(),
                "results": results,
                "stats": {
                    "total_base": _money(totals.get("total_base")),
                    "total_commission": _money(totals.get("total_commission")),
                    "total_paid": _money(totals.get("total_paid")),
                },
            }
        )
    except Exception as exc:
        logger.exception("Failed to fetch commission list: %s", exc)
        return _json_error("تعذر جلب قائمة العمولات.", status=500)