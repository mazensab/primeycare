# ============================================================
# 📂 api/agents/list.py
# 🧠 Primey Care | Agents List + Commissions List API V4
# ------------------------------------------------------------
# ✅ /api/agents/                  -> قائمة المندوبين
# ✅ /api/agents/commissions/      -> قائمة العمولات
# ✅ إحصائيات جاهزة للـ Frontend
# ✅ بحث + فلترة + Pagination
# ✅ يدعم ربط المندوب بالوسيط Agent.broker
# ✅ يدعم حساب دخول المندوب Agent.user
# ✅ يدعم حساب دخول الوسيط Broker.user
# ✅ يدعم AgentFinancialEntry:
#    - COD_CUSTODY
#    - SALES_COMMISSION
#    - DELIVERY_FEE
#    - BROKER_SHARE
# ✅ يعرض ما على المندوب وما له وصافي الرصيد
# ✅ يحافظ على AgentOrder و AgentCommission للتوافق الخلفي
# ✅ Protected by permissions:
#    agents.view / brokers.view
#    agents.commissions.view / broker_commissions.view
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

from agents.models import Agent, AgentCommission, AgentFinancialEntry, AgentOrder
from auth_center.permissions import PermissionCodes, any_permission_required

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
    status: int = 400,
    *,
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
    status: int = 200,
    *,
    message: str = "تم تنفيذ العملية بنجاح.",
) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": True,
        "success": True,
        "message": message,
        "data": _decimal_to_string(data),
    }

    # توافق مع الواجهة الحالية التي تعتمد على المفاتيح في أعلى الاستجابة.
    payload.update(_decimal_to_string(data))

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


# ============================================================
# Safe Helpers
# ============================================================

def _money(value: Any) -> str:
    try:
        return str(Decimal(str(value or "0.00")).quantize(Decimal("0.01")))
    except Exception:
        return "0.00"


def _safe_decimal(value: Any) -> Decimal:
    try:
        return Decimal(str(value or "0.00")).quantize(Decimal("0.01"))
    except Exception:
        return Decimal("0.00")


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


def _to_bool(value: Any, default: bool | None = None) -> bool | None:
    if value in (None, ""):
        return default

    if isinstance(value, bool):
        return value

    raw = str(value).strip().lower()

    if raw in {"1", "true", "yes", "y", "on", "نعم", "صح", "active"}:
        return True

    if raw in {"0", "false", "no", "n", "off", "لا", "خطأ", "inactive"}:
        return False

    return default


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _safe_attr(obj: Any, *names: str, default: Any = "") -> Any:
    if not obj:
        return default

    for name in names:
        try:
            value = getattr(obj, name, None)
        except Exception:
            value = None

        if value not in (None, ""):
            return value

    return default


def _customer_name(customer: Any) -> str:
    if not customer:
        return ""

    return (
        getattr(customer, "display_name", None)
        or getattr(customer, "full_name", None)
        or getattr(customer, "name", None)
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


def _entry_type_key(name: str) -> str:
    return str(name or "").strip().upper()


def _direction_key(name: str) -> str:
    return str(name or "").strip().upper()


def _positive(value: Decimal) -> Decimal:
    return value if value > Decimal("0.00") else Decimal("0.00")


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
        "last_login": _date_iso(getattr(user, "last_login", None)),
        "date_joined": _date_iso(getattr(user, "date_joined", None)),
    }


# ============================================================
# Financial Summary Helpers
# ============================================================

def _empty_financial_summary() -> dict[str, Any]:
    return {
        "financial_entries_count": 0,
        "accounting_posted_count": 0,

        "total_debit_amount": Decimal("0.00"),
        "total_credit_amount": Decimal("0.00"),
        "total_debit_paid_amount": Decimal("0.00"),
        "total_credit_paid_amount": Decimal("0.00"),
        "total_debit_remaining_amount": Decimal("0.00"),
        "total_credit_remaining_amount": Decimal("0.00"),
        "net_balance_amount": Decimal("0.00"),

        "cod_custody_amount": Decimal("0.00"),
        "cod_custody_paid_amount": Decimal("0.00"),
        "cod_custody_remaining_amount": Decimal("0.00"),

        "sales_commission_amount": Decimal("0.00"),
        "sales_commission_paid_amount": Decimal("0.00"),
        "sales_commission_remaining_amount": Decimal("0.00"),

        "delivery_fee_amount": Decimal("0.00"),
        "delivery_fee_paid_amount": Decimal("0.00"),
        "delivery_fee_remaining_amount": Decimal("0.00"),

        "broker_share_amount": Decimal("0.00"),
        "broker_share_paid_amount": Decimal("0.00"),
        "broker_share_remaining_amount": Decimal("0.00"),

        "amount_due_from_agent": Decimal("0.00"),
        "amount_due_to_agent": Decimal("0.00"),
    }


def _finalize_financial_summary(summary: dict[str, Any]) -> dict[str, Any]:
    summary["total_debit_remaining_amount"] = _positive(
        _safe_decimal(summary["total_debit_amount"])
        - _safe_decimal(summary["total_debit_paid_amount"])
    )
    summary["total_credit_remaining_amount"] = _positive(
        _safe_decimal(summary["total_credit_amount"])
        - _safe_decimal(summary["total_credit_paid_amount"])
    )

    summary["cod_custody_remaining_amount"] = _positive(
        _safe_decimal(summary["cod_custody_amount"])
        - _safe_decimal(summary["cod_custody_paid_amount"])
    )
    summary["sales_commission_remaining_amount"] = _positive(
        _safe_decimal(summary["sales_commission_amount"])
        - _safe_decimal(summary["sales_commission_paid_amount"])
    )
    summary["delivery_fee_remaining_amount"] = _positive(
        _safe_decimal(summary["delivery_fee_amount"])
        - _safe_decimal(summary["delivery_fee_paid_amount"])
    )
    summary["broker_share_remaining_amount"] = _positive(
        _safe_decimal(summary["broker_share_amount"])
        - _safe_decimal(summary["broker_share_paid_amount"])
    )

    summary["amount_due_from_agent"] = summary["total_debit_remaining_amount"]
    summary["amount_due_to_agent"] = summary["total_credit_remaining_amount"]
    summary["net_balance_amount"] = (
        _safe_decimal(summary["amount_due_from_agent"])
        - _safe_decimal(summary["amount_due_to_agent"])
    )

    return summary


def _build_financial_summary_map(agent_ids: list[int]) -> dict[int, dict[str, Any]]:
    summaries: dict[int, dict[str, Any]] = {
        int(agent_id): _empty_financial_summary()
        for agent_id in agent_ids
    }

    if not agent_ids:
        return summaries

    count_rows = (
        AgentFinancialEntry.objects.filter(agent_id__in=agent_ids)
        .values("agent_id")
        .annotate(
            entries_count=Count("id"),
            accounting_posted_count=Count(
                "id",
                filter=(
                    Q(is_accounting_posted=True)
                    | Q(journal_entry_id__isnull=False)
                    | ~Q(journal_entry_reference="")
                ),
            ),
        )
    )

    for row in count_rows:
        agent_id = int(row["agent_id"])
        summary = summaries.setdefault(agent_id, _empty_financial_summary())
        summary["financial_entries_count"] = row.get("entries_count") or 0
        summary["accounting_posted_count"] = row.get("accounting_posted_count") or 0

    amount_rows = (
        AgentFinancialEntry.objects.filter(agent_id__in=agent_ids)
        .values("agent_id", "entry_type", "direction")
        .annotate(
            amount_total=Sum("amount"),
            paid_total=Sum("paid_amount"),
        )
    )

    for row in amount_rows:
        agent_id = int(row["agent_id"])
        entry_type = _entry_type_key(row.get("entry_type"))
        direction = _direction_key(row.get("direction"))

        amount_total = _safe_decimal(row.get("amount_total"))
        paid_total = _safe_decimal(row.get("paid_total"))

        summary = summaries.setdefault(agent_id, _empty_financial_summary())

        if direction == "DEBIT":
            summary["total_debit_amount"] += amount_total
            summary["total_debit_paid_amount"] += paid_total

        elif direction == "CREDIT":
            summary["total_credit_amount"] += amount_total
            summary["total_credit_paid_amount"] += paid_total

        if entry_type == "COD_CUSTODY":
            summary["cod_custody_amount"] += amount_total
            summary["cod_custody_paid_amount"] += paid_total

        elif entry_type == "SALES_COMMISSION":
            summary["sales_commission_amount"] += amount_total
            summary["sales_commission_paid_amount"] += paid_total

        elif entry_type == "DELIVERY_FEE":
            summary["delivery_fee_amount"] += amount_total
            summary["delivery_fee_paid_amount"] += paid_total

        elif entry_type == "BROKER_SHARE":
            summary["broker_share_amount"] += amount_total
            summary["broker_share_paid_amount"] += paid_total

    for agent_id, summary in summaries.items():
        summaries[agent_id] = _finalize_financial_summary(summary)

    return summaries


def _format_financial_summary(summary: dict[str, Any]) -> dict[str, Any]:
    return {
        "financial_entries_count": summary.get("financial_entries_count", 0),
        "accounting_posted_count": summary.get("accounting_posted_count", 0),

        "total_debit_amount": _money(summary.get("total_debit_amount")),
        "total_credit_amount": _money(summary.get("total_credit_amount")),
        "total_debit_paid_amount": _money(summary.get("total_debit_paid_amount")),
        "total_credit_paid_amount": _money(summary.get("total_credit_paid_amount")),
        "total_debit_remaining_amount": _money(summary.get("total_debit_remaining_amount")),
        "total_credit_remaining_amount": _money(summary.get("total_credit_remaining_amount")),
        "net_balance_amount": _money(summary.get("net_balance_amount")),

        "cod_custody_amount": _money(summary.get("cod_custody_amount")),
        "cod_custody_paid_amount": _money(summary.get("cod_custody_paid_amount")),
        "cod_custody_remaining_amount": _money(summary.get("cod_custody_remaining_amount")),

        "sales_commission_amount": _money(summary.get("sales_commission_amount")),
        "sales_commission_paid_amount": _money(summary.get("sales_commission_paid_amount")),
        "sales_commission_remaining_amount": _money(summary.get("sales_commission_remaining_amount")),

        "delivery_fee_amount": _money(summary.get("delivery_fee_amount")),
        "delivery_fee_paid_amount": _money(summary.get("delivery_fee_paid_amount")),
        "delivery_fee_remaining_amount": _money(summary.get("delivery_fee_remaining_amount")),

        "broker_share_amount": _money(summary.get("broker_share_amount")),
        "broker_share_paid_amount": _money(summary.get("broker_share_paid_amount")),
        "broker_share_remaining_amount": _money(summary.get("broker_share_remaining_amount")),

        "amount_due_from_agent": _money(summary.get("amount_due_from_agent")),
        "amount_due_to_agent": _money(summary.get("amount_due_to_agent")),
    }


def _aggregate_financial_totals_for_agents(agent_ids: list[int]) -> dict[str, Any]:
    summary_map = _build_financial_summary_map(agent_ids)
    totals = _empty_financial_summary()

    for summary in summary_map.values():
        for key in totals.keys():
            if key in {"financial_entries_count", "accounting_posted_count"}:
                totals[key] += int(summary.get(key) or 0)
            else:
                totals[key] += _safe_decimal(summary.get(key))

    return _finalize_financial_summary(totals)


# ============================================================
# Serializers
# ============================================================

def _serialize_broker_from_agent(agent: Agent) -> dict[str, Any] | None:
    broker = getattr(agent, "broker", None)

    if not broker:
        return None

    broker_user = getattr(broker, "user", None)

    return {
        "id": broker.pk,
        "broker_code": _safe_attr(broker, "broker_code", "code"),
        "code": _safe_attr(broker, "broker_code", "code"),
        "name": _safe_attr(broker, "name", "full_name"),
        "broker_name": _safe_attr(broker, "name", "full_name"),
        "status": _safe_attr(broker, "status"),
        "phone": _safe_attr(broker, "phone", "phone_number"),
        "email": _safe_attr(broker, "email"),
        "has_login_user": bool(getattr(broker, "user_id", None)),
        "user_id": getattr(broker, "user_id", None),
        "login_user": _serialize_login_user(broker_user),
    }


def _serialize_agent(
    agent: Agent,
    *,
    financial_summary: dict[str, Any] | None = None,
) -> dict[str, Any]:
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

    financial_summary = financial_summary or _empty_financial_summary()
    formatted_financial = _format_financial_summary(financial_summary)
    broker = _serialize_broker_from_agent(agent)
    agent_user = getattr(agent, "user", None)

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
        "login_user": _serialize_login_user(agent_user),

        "broker_id": agent.broker_id,
        "broker": broker,
        "broker_user_id": (broker or {}).get("user_id") if broker else None,
        "broker_has_login_user": (broker or {}).get("has_login_user") if broker else False,
        "broker_name": broker["name"] if broker else "",
        "broker_code": broker["broker_code"] if broker else "",

        "default_commission_type": agent.default_commission_type,
        "default_commission_value": _money(agent.default_commission_value),
        "default_delivery_fee": _money(getattr(agent, "default_delivery_fee", "0.00")),

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

        "financial_summary": formatted_financial,
        **formatted_financial,

        "created_at": _date_iso(agent.created_at),
        "updated_at": _date_iso(agent.updated_at),
    }


def _serialize_commission(commission: AgentCommission) -> dict[str, Any]:
    agent = getattr(commission, "agent", None)
    broker = getattr(commission, "broker", None)
    order = getattr(commission, "order", None)
    payment = getattr(commission, "payment", None)
    agent_order = getattr(commission, "agent_order", None)
    customer = getattr(agent_order, "customer", None) if agent_order else None
    journal_entry = _safe_attr(commission, "journal_entry", default=None)

    journal_reference = (
        _safe_attr(journal_entry, "entry_number")
        or _safe_attr(commission, "journal_entry_reference")
        or _safe_attr(commission, "accounting_entry_reference")
        or _safe_attr(commission, "posting_reference")
    )

    return {
        "id": commission.pk,
        "reference": f"COM-{commission.pk}",
        "status": commission.commission_status,
        "commission_status": commission.commission_status,

        "agent_id": commission.agent_id,
        "agent_name": getattr(agent, "full_name", "") if agent else "",
        "agent_code": getattr(agent, "agent_code", "") if agent else "",
        "agent_user_id": getattr(agent, "user_id", None) if agent else None,
        "agent_has_login_user": bool(getattr(agent, "user_id", None)) if agent else False,
        "referral_code": getattr(agent, "referral_code", "") if agent else "",

        "broker_id": commission.broker_id,
        "broker_name": _safe_attr(broker, "name", "full_name") if broker else "",
        "broker_code": _safe_attr(broker, "broker_code", "code") if broker else "",
        "broker_user_id": getattr(broker, "user_id", None) if broker else None,
        "broker_has_login_user": bool(getattr(broker, "user_id", None)) if broker else False,

        "order_id": commission.order_id,
        "order_number": getattr(order, "order_number", "") if order else "",
        "payment_id": commission.payment_id,
        "payment_number": getattr(payment, "payment_number", "") if payment else "",
        "customer_id": getattr(customer, "pk", None),
        "customer_name": _customer_name(customer),

        "base_amount": _money(commission.base_amount),
        "amount": _money(commission.commission_amount),
        "commission_amount": _money(commission.commission_amount),
        "paid_amount": _money(commission.paid_amount),
        "remaining_amount": _money(commission.remaining_amount),

        "journal_entry_id": (
            getattr(journal_entry, "pk", None)
            if journal_entry
            else _safe_attr(commission, "journal_entry_id", default=None)
        ),
        "journal_entry_reference": journal_reference,
        "is_accounting_posted": bool(
            _safe_attr(commission, "is_accounting_posted", default=False)
            or journal_reference
        ),

        "earned_at": _date_iso(commission.earned_at),
        "approved_at": _date_iso(commission.approved_at),
        "paid_at": _date_iso(commission.paid_at),
        "created_at": _date_iso(commission.created_at),
        "updated_at": _date_iso(commission.updated_at),
        "notes": commission.notes,
    }


# ============================================================
# Query Builders
# ============================================================

def _build_agents_queryset(request):
    queryset = (
        Agent.objects
        .select_related("user", "broker", "broker__user")
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
        numeric_search = None
        try:
            numeric_search = int(search)
        except Exception:
            numeric_search = None

        search_q = (
            Q(full_name__icontains=search)
            | Q(agent_code__icontains=search)
            | Q(referral_code__icontains=search)
            | Q(phone__icontains=search)
            | Q(email__icontains=search)
            | Q(city__icontains=search)
            | Q(user__username__icontains=search)
            | Q(user__email__icontains=search)
            | Q(broker__name__icontains=search)
            | Q(broker__broker_code__icontains=search)
            | Q(broker__referral_code__icontains=search)
            | Q(broker__user__username__icontains=search)
            | Q(broker__user__email__icontains=search)
        )

        if numeric_search:
            search_q |= Q(pk=numeric_search)

        queryset = queryset.filter(search_q)

    status_filter = (request.GET.get("status") or "").strip().upper()
    if status_filter:
        queryset = queryset.filter(status=status_filter)

    city = (request.GET.get("city") or "").strip()
    if city:
        queryset = queryset.filter(city__icontains=city)

    commission_type = (request.GET.get("commission_type") or "").strip().upper()
    if commission_type:
        queryset = queryset.filter(default_commission_type=commission_type)

    broker_id = (request.GET.get("broker_id") or "").strip()
    if broker_id:
        queryset = queryset.filter(broker_id=broker_id)

    has_broker = _to_bool(request.GET.get("has_broker"), None)
    if has_broker is True:
        queryset = queryset.filter(broker__isnull=False)
    elif has_broker is False:
        queryset = queryset.filter(broker__isnull=True)

    has_login_user = _to_bool(request.GET.get("has_login_user"), None)
    if has_login_user is True:
        queryset = queryset.filter(user__isnull=False)
    elif has_login_user is False:
        queryset = queryset.filter(user__isnull=True)

    broker_has_login_user = _to_bool(request.GET.get("broker_has_login_user"), None)
    if broker_has_login_user is True:
        queryset = queryset.filter(broker__user__isnull=False)
    elif broker_has_login_user is False:
        queryset = queryset.filter(
            broker__isnull=False,
            broker__user__isnull=True,
        )

    has_cod_custody = _to_bool(request.GET.get("has_cod_custody"), None)
    if has_cod_custody is True:
        agent_ids = AgentFinancialEntry.objects.filter(
            entry_type="COD_CUSTODY",
            agent_id__isnull=False,
        ).values("agent_id")
        queryset = queryset.filter(pk__in=agent_ids)
    elif has_cod_custody is False:
        agent_ids = AgentFinancialEntry.objects.filter(
            entry_type="COD_CUSTODY",
            agent_id__isnull=False,
        ).values("agent_id")
        queryset = queryset.exclude(pk__in=agent_ids)

    has_financial_balance = _to_bool(request.GET.get("has_financial_balance"), None)
    if has_financial_balance is True:
        agent_ids = AgentFinancialEntry.objects.filter(
            agent_id__isnull=False,
        ).values("agent_id")
        queryset = queryset.filter(pk__in=agent_ids)
    elif has_financial_balance is False:
        agent_ids = AgentFinancialEntry.objects.filter(
            agent_id__isnull=False,
        ).values("agent_id")
        queryset = queryset.exclude(pk__in=agent_ids)

    return queryset


def _build_commissions_queryset(request):
    queryset = (
        AgentCommission.objects.select_related(
            "agent",
            "agent__user",
            "broker",
            "broker__user",
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
        numeric_search = None
        try:
            numeric_search = int(search)
        except Exception:
            numeric_search = None

        search_q = (
            Q(agent__full_name__icontains=search)
            | Q(agent__agent_code__icontains=search)
            | Q(agent__referral_code__icontains=search)
            | Q(agent__user__username__icontains=search)
            | Q(agent__user__email__icontains=search)
            | Q(order__order_number__icontains=search)
            | Q(payment__payment_number__icontains=search)
            | Q(notes__icontains=search)
            | Q(broker__name__icontains=search)
            | Q(broker__broker_code__icontains=search)
            | Q(broker__referral_code__icontains=search)
            | Q(broker__user__username__icontains=search)
            | Q(broker__user__email__icontains=search)
        )

        if numeric_search:
            search_q |= (
                Q(pk=numeric_search)
                | Q(order_id=numeric_search)
                | Q(payment_id=numeric_search)
            )

        queryset = queryset.filter(search_q)

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

    broker_id = request.GET.get("broker_id")
    if broker_id:
        queryset = queryset.filter(broker_id=broker_id)

    order_id = request.GET.get("order_id")
    if order_id:
        queryset = queryset.filter(order_id=order_id)

    is_accounting_posted = _to_bool(request.GET.get("is_accounting_posted"), None)
    if is_accounting_posted is True:
        posted_q = Q()
        posted_q |= Q(journal_entry_reference__isnull=False) & ~Q(journal_entry_reference="")
        posted_q |= Q(accounting_entry_reference__isnull=False) & ~Q(accounting_entry_reference="")
        posted_q |= Q(posting_reference__isnull=False) & ~Q(posting_reference="")
        posted_q |= Q(journal_entry__isnull=False)
        queryset = queryset.filter(posted_q)
    elif is_accounting_posted is False:
        queryset = queryset.filter(
            Q(journal_entry_reference__isnull=True) | Q(journal_entry_reference=""),
            Q(accounting_entry_reference__isnull=True) | Q(accounting_entry_reference=""),
            Q(posting_reference__isnull=True) | Q(posting_reference=""),
            journal_entry__isnull=True,
        )

    return queryset


# ============================================================
# Stats
# ============================================================

def _build_legacy_agent_stats(queryset) -> dict[str, Any]:
    total_count = queryset.count()
    active_count = queryset.filter(status="ACTIVE").count()
    inactive_count = queryset.filter(status="INACTIVE").count()
    suspended_count = queryset.filter(status="SUSPENDED").count()
    draft_count = queryset.filter(status="DRAFT").count()

    with_broker_count = queryset.filter(broker__isnull=False).count()
    without_broker_count = queryset.filter(broker__isnull=True).count()
    with_login_user_count = queryset.filter(user__isnull=False).count()
    without_login_user_count = queryset.filter(user__isnull=True).count()
    broker_with_login_user_count = queryset.filter(broker__user__isnull=False).count()

    totals = queryset.aggregate(
        total_sales=Sum("agent_orders__sales_amount"),
        total_commission=Sum("commissions__commission_amount"),
        total_paid=Sum("commissions__paid_amount"),
    )

    return {
        "total_agents": total_count,
        "active_agents": active_count,
        "inactive_agents": inactive_count,
        "suspended_agents": suspended_count,
        "draft_agents": draft_count,

        "agents_with_broker": with_broker_count,
        "agents_without_broker": without_broker_count,
        "agents_with_login_user": with_login_user_count,
        "agents_without_login_user": without_login_user_count,
        "agents_with_broker_login_user": broker_with_login_user_count,

        "total_sales": _money(totals.get("total_sales")),
        "total_commission": _money(totals.get("total_commission")),
        "total_paid": _money(totals.get("total_paid")),
    }


def _build_financial_agent_stats(queryset) -> dict[str, Any]:
    agent_ids = list(queryset.values_list("id", flat=True))
    totals = _aggregate_financial_totals_for_agents(agent_ids)

    return {
        "financial_entries_count": totals.get("financial_entries_count", 0),
        "accounting_posted_count": totals.get("accounting_posted_count", 0),

        "cod_custody_amount": _money(totals.get("cod_custody_amount")),
        "cod_custody_remaining_amount": _money(totals.get("cod_custody_remaining_amount")),

        "sales_commission_amount": _money(totals.get("sales_commission_amount")),
        "sales_commission_remaining_amount": _money(totals.get("sales_commission_remaining_amount")),

        "delivery_fee_amount": _money(totals.get("delivery_fee_amount")),
        "delivery_fee_remaining_amount": _money(totals.get("delivery_fee_remaining_amount")),

        "broker_share_amount": _money(totals.get("broker_share_amount")),
        "broker_share_remaining_amount": _money(totals.get("broker_share_remaining_amount")),

        "amount_due_from_agents": _money(totals.get("amount_due_from_agent")),
        "amount_due_to_agents": _money(totals.get("amount_due_to_agent")),
        "net_balance_amount": _money(totals.get("net_balance_amount")),
    }


# ============================================================
# APIs
# ============================================================

@login_required
@require_GET
@any_permission_required(
    (
        PermissionCodes.AGENTS_VIEW,
        PermissionCodes.BROKERS_VIEW,
    )
)
def agent_list_api(request):
    try:
        queryset = _build_agents_queryset(request)

        legacy_stats = _build_legacy_agent_stats(queryset)
        financial_stats = _build_financial_agent_stats(queryset)

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

        page_agent_ids = [agent.pk for agent in page_obj.object_list]
        financial_summary_map = _build_financial_summary_map(page_agent_ids)

        results = [
            _serialize_agent(
                agent,
                financial_summary=financial_summary_map.get(agent.pk),
            )
            for agent in page_obj.object_list
        ]

        response_data = {
            "count": paginator.count,
            "page": page_obj.number,
            "page_size": page_size,
            "num_pages": paginator.num_pages,
            "has_next": page_obj.has_next(),
            "has_previous": page_obj.has_previous(),
            "results": results,
            "agents": results,
            "stats": {
                **legacy_stats,
                **financial_stats,
            },
            "filters": {
                "search": request.GET.get("search") or request.GET.get("q") or "",
                "status": request.GET.get("status") or "",
                "city": request.GET.get("city") or "",
                "commission_type": request.GET.get("commission_type") or "",
                "broker_id": request.GET.get("broker_id") or "",
                "has_broker": request.GET.get("has_broker") or "",
                "has_login_user": request.GET.get("has_login_user") or "",
                "broker_has_login_user": request.GET.get("broker_has_login_user") or "",
                "has_cod_custody": request.GET.get("has_cod_custody") or "",
                "has_financial_balance": request.GET.get("has_financial_balance") or "",
            },
            "pagination": {
                "count": paginator.count,
                "page": page_obj.number,
                "page_size": page_size,
                "num_pages": paginator.num_pages,
                "has_next": page_obj.has_next(),
                "has_previous": page_obj.has_previous(),
            },
        }

        return _json_success(
            response_data,
            message="تم جلب قائمة المندوبين بنجاح.",
        )

    except Exception as exc:
        logger.exception("Failed to fetch agents list: %s", exc)
        return _json_error("تعذر جلب قائمة المندوبين.", status=500)


@login_required
@require_GET
@any_permission_required(
    (
        PermissionCodes.AGENTS_COMMISSIONS_VIEW,
        PermissionCodes.BROKER_COMMISSIONS_VIEW,
        PermissionCodes.AGENTS_VIEW,
        PermissionCodes.BROKERS_VIEW,
    )
)
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

        response_data = {
            "count": paginator.count,
            "page": page_obj.number,
            "page_size": page_size,
            "num_pages": paginator.num_pages,
            "has_next": page_obj.has_next(),
            "has_previous": page_obj.has_previous(),
            "results": results,
            "commissions": results,
            "stats": {
                "total_base": _money(totals.get("total_base")),
                "total_commission": _money(totals.get("total_commission")),
                "total_paid": _money(totals.get("total_paid")),
                "total_remaining": _money(
                    _safe_decimal(totals.get("total_commission"))
                    - _safe_decimal(totals.get("total_paid"))
                ),
            },
            "filters": {
                "search": request.GET.get("search") or request.GET.get("q") or "",
                "status": request.GET.get("status") or request.GET.get("commission_status") or "",
                "agent_id": request.GET.get("agent_id") or "",
                "broker_id": request.GET.get("broker_id") or "",
                "order_id": request.GET.get("order_id") or "",
                "is_accounting_posted": request.GET.get("is_accounting_posted") or "",
            },
            "pagination": {
                "count": paginator.count,
                "page": page_obj.number,
                "page_size": page_size,
                "num_pages": paginator.num_pages,
                "has_next": page_obj.has_next(),
                "has_previous": page_obj.has_previous(),
            },
        }

        return _json_success(
            response_data,
            message="تم جلب قائمة العمولات بنجاح.",
        )

    except Exception as exc:
        logger.exception("Failed to fetch commission list: %s", exc)
        return _json_error("تعذر جلب قائمة العمولات.", status=500)