# ============================================================
# 📂 api/agents/detail.py
# 🧠 Primey Care | Agent Detail + Statement + Commission Detail API V5
# ------------------------------------------------------------
# ✅ /api/agents/<agent_id>/                     -> تفاصيل مندوب
# ✅ /api/agents/<agent_id>/?include_statement=1 -> تفاصيل + كشف حساب تفصيلي
# ✅ /api/agents/commissions/<commission_id>/    -> تفاصيل عمولة
# ✅ يدعم AgentFinancialEntry:
#    - COD_CUSTODY
#    - SALES_COMMISSION
#    - DELIVERY_FEE
#    - BROKER_SHARE
#    - SETTLEMENT / PAYOUT / ADJUSTMENT
# ✅ يعرض حساب دخول المندوب Agent.user
# ✅ يعرض حساب دخول الوسيط Broker.user
# ✅ يعرض العملاء المرتبطين بالمندوب Customer.agent
# ✅ يعرض ما على المندوب وما له وصافي الرصيد
# ✅ يعرض paid_amount / remaining_amount لكل حركة
# ✅ يعرض journal_entry_id / journal_entry_reference لكل حركة
# ✅ يحافظ على التوافق الخلفي مع AgentOrder و AgentCommission
# ✅ Protected by permissions:
#    agents.view / brokers.view
#    agents.commissions.view / broker_commissions.view
# ============================================================

from __future__ import annotations

import logging
from datetime import datetime
from decimal import Decimal
from typing import Any

from django.contrib.auth.decorators import login_required
from django.db.models import Q, Sum
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from agents.models import (
    Agent,
    AgentCommission,
    AgentFinancialEntry,
    AgentOrder,
)
from auth_center.permissions import PermissionCodes, any_permission_required
from customers.models import Customer

logger = logging.getLogger(__name__)


# ============================================================
# Optional Services
# ============================================================

try:
    from agents.services import build_agent_statement_payload as _build_real_agent_statement_payload
except Exception:  # pragma: no cover
    _build_real_agent_statement_payload = None


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
    payload = {
        "ok": True,
        "success": True,
        "message": message,
        "data": _decimal_to_string(data),
    }

    # توافق مع الفرونت القديم الذي يتوقع المفاتيح في أعلى الاستجابة.
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


def _to_bool(value: Any, default: bool = False) -> bool:
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


def _model_has_field(model_or_instance: Any, field_name: str) -> bool:
    try:
        model_or_instance._meta.get_field(field_name)
        return True
    except Exception:
        return False


def _entry_remaining_amount(entry: AgentFinancialEntry) -> Decimal:
    remaining = getattr(entry, "remaining_amount", None)

    if remaining is not None:
        return _safe_decimal(remaining)

    return max(
        Decimal("0.00"),
        _safe_decimal(getattr(entry, "amount", "0.00"))
        - _safe_decimal(getattr(entry, "paid_amount", "0.00")),
    )


def _is_debit_entry(entry: AgentFinancialEntry) -> bool:
    return str(getattr(entry, "direction", "")).upper() == "DEBIT"


def _is_credit_entry(entry: AgentFinancialEntry) -> bool:
    return str(getattr(entry, "direction", "")).upper() == "CREDIT"


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
# Querysets
# ============================================================

def _agent_queryset():
    return Agent.objects.select_related("broker", "broker__user", "user").all()


def _agent_orders_queryset(agent: Agent):
    return (
        AgentOrder.objects.select_related(
            "order",
            "customer",
            "customer__user",
            "agent",
            "agent__user",
            "broker",
            "broker__user",
        )
        .filter(agent=agent)
        .order_by("-created_at", "-id")
    )


def _commissions_queryset(agent: Agent):
    return (
        AgentCommission.objects.select_related(
            "agent",
            "agent__user",
            "broker",
            "broker__user",
            "order",
            "payment",
            "agent_order",
            "agent_order__customer",
            "agent_order__customer__user",
        )
        .filter(agent=agent)
        .order_by("-created_at", "-id")
    )


def _financial_entries_queryset(agent: Agent):
    queryset = AgentFinancialEntry.objects.filter(agent=agent)

    for relation in (
        "agent",
        "agent__user",
        "broker",
        "broker__user",
        "order",
        "payment",
        "commission",
        "rule",
        "journal_entry",
    ):
        try:
            queryset = queryset.select_related(relation)
        except Exception:
            pass

    return queryset.order_by("-created_at", "-id")


def _customers_queryset(agent: Agent):
    if not _model_has_field(Customer, "agent"):
        return Customer.objects.none()

    return (
        Customer.objects
        .filter(agent=agent)
        .select_related("user", "agent", "agent__user", "broker", "broker__user")
        .order_by("-created_at", "-id")
    )


# ============================================================
# Statement Fallback
# ============================================================

def _empty_statement_summary() -> dict[str, Any]:
    return {
        "currency": "SAR",

        "total_debit_amount": "0.00",
        "total_credit_amount": "0.00",
        "total_debit_paid_amount": "0.00",
        "total_credit_paid_amount": "0.00",
        "total_debit_remaining_amount": "0.00",
        "total_credit_remaining_amount": "0.00",
        "net_balance_amount": "0.00",

        "cod_custody_amount": "0.00",
        "cod_custody_paid_amount": "0.00",
        "cod_custody_remaining_amount": "0.00",

        "sales_commission_amount": "0.00",
        "sales_commission_paid_amount": "0.00",
        "sales_commission_remaining_amount": "0.00",

        "delivery_fee_amount": "0.00",
        "delivery_fee_paid_amount": "0.00",
        "delivery_fee_remaining_amount": "0.00",

        "broker_share_amount": "0.00",
        "broker_share_paid_amount": "0.00",
        "broker_share_remaining_amount": "0.00",

        "settlements_amount": "0.00",
        "amount_due_from_agent": "0.00",
        "amount_due_to_agent": "0.00",
    }


def _build_fallback_agent_statement_payload(
    *,
    agent: Agent,
    date_from=None,
    date_to=None,
    include_financial_entries: bool = True,
) -> dict[str, Any]:
    entries_qs = _financial_entries_queryset(agent)

    if date_from:
        entries_qs = entries_qs.filter(created_at__date__gte=date_from)

    if date_to:
        entries_qs = entries_qs.filter(created_at__date__lte=date_to)

    summary = {
        key: _safe_decimal(value)
        for key, value in _empty_statement_summary().items()
        if key != "currency"
    }
    summary["currency"] = "SAR"

    lines: list[dict[str, Any]] = []

    for entry in entries_qs:
        amount = _safe_decimal(getattr(entry, "amount", "0.00"))
        paid_amount = _safe_decimal(getattr(entry, "paid_amount", "0.00"))
        remaining_amount = _entry_remaining_amount(entry)
        entry_type = str(getattr(entry, "entry_type", "")).upper()

        if _is_debit_entry(entry):
            summary["total_debit_amount"] += amount
            summary["total_debit_paid_amount"] += paid_amount

        if _is_credit_entry(entry):
            summary["total_credit_amount"] += amount
            summary["total_credit_paid_amount"] += paid_amount

        if entry_type == "COD_CUSTODY":
            summary["cod_custody_amount"] += amount
            summary["cod_custody_paid_amount"] += paid_amount
        elif entry_type == "SALES_COMMISSION":
            summary["sales_commission_amount"] += amount
            summary["sales_commission_paid_amount"] += paid_amount
        elif entry_type == "DELIVERY_FEE":
            summary["delivery_fee_amount"] += amount
            summary["delivery_fee_paid_amount"] += paid_amount
        elif entry_type == "BROKER_SHARE":
            summary["broker_share_amount"] += amount
            summary["broker_share_paid_amount"] += paid_amount
        elif entry_type in {"SETTLEMENT", "PAYOUT"}:
            summary["settlements_amount"] += paid_amount or amount

        if include_financial_entries:
            lines.append(_serialize_financial_entry(entry))

    summary["total_debit_remaining_amount"] = max(
        Decimal("0.00"),
        summary["total_debit_amount"] - summary["total_debit_paid_amount"],
    )
    summary["total_credit_remaining_amount"] = max(
        Decimal("0.00"),
        summary["total_credit_amount"] - summary["total_credit_paid_amount"],
    )

    summary["cod_custody_remaining_amount"] = max(
        Decimal("0.00"),
        summary["cod_custody_amount"] - summary["cod_custody_paid_amount"],
    )
    summary["sales_commission_remaining_amount"] = max(
        Decimal("0.00"),
        summary["sales_commission_amount"] - summary["sales_commission_paid_amount"],
    )
    summary["delivery_fee_remaining_amount"] = max(
        Decimal("0.00"),
        summary["delivery_fee_amount"] - summary["delivery_fee_paid_amount"],
    )
    summary["broker_share_remaining_amount"] = max(
        Decimal("0.00"),
        summary["broker_share_amount"] - summary["broker_share_paid_amount"],
    )

    summary["amount_due_from_agent"] = summary["total_debit_remaining_amount"]
    summary["amount_due_to_agent"] = summary["total_credit_remaining_amount"]
    summary["net_balance_amount"] = (
        summary["amount_due_from_agent"] - summary["amount_due_to_agent"]
    )

    formatted_summary = {
        key: (_money(value) if key != "currency" else value)
        for key, value in summary.items()
    }

    return {
        "summary": formatted_summary,
        "lines": lines,
        "source": "agent_financial_entries_fallback",
    }


def _build_agent_statement_payload_safe(
    *,
    agent: Agent,
    date_from=None,
    date_to=None,
    include_agent_orders: bool = False,
    include_commissions: bool = False,
    include_financial_entries: bool = True,
) -> dict[str, Any]:
    if callable(_build_real_agent_statement_payload):
        try:
            return _build_real_agent_statement_payload(
                agent=agent,
                date_from=date_from,
                date_to=date_to,
                include_agent_orders=include_agent_orders,
                include_commissions=include_commissions,
                include_financial_entries=include_financial_entries,
            )
        except TypeError:
            try:
                return _build_real_agent_statement_payload(
                    agent,
                    date_from=date_from,
                    date_to=date_to,
                    include_agent_orders=include_agent_orders,
                    include_commissions=include_commissions,
                    include_financial_entries=include_financial_entries,
                )
            except Exception as exc:
                logger.warning("Failed to build real agent statement payload: %s", exc)
        except Exception as exc:
            logger.warning("Failed to build real agent statement payload: %s", exc)

    return _build_fallback_agent_statement_payload(
        agent=agent,
        date_from=date_from,
        date_to=date_to,
        include_financial_entries=include_financial_entries,
    )


# ============================================================
# Serializers
# ============================================================

def _serialize_broker_from_agent(agent: Agent) -> dict[str, Any] | None:
    broker = getattr(agent, "broker", None)

    if not broker:
        return None

    user = getattr(broker, "user", None)

    return {
        "id": broker.pk,
        "broker_code": _safe_attr(broker, "broker_code", "code"),
        "code": _safe_attr(broker, "broker_code", "code"),
        "name": _safe_attr(broker, "name", "full_name"),
        "broker_name": _safe_attr(broker, "name", "full_name"),
        "status": _safe_attr(broker, "status"),
        "phone": _safe_attr(broker, "phone", "phone_number"),
        "email": _safe_attr(broker, "email"),
        "user_id": getattr(broker, "user_id", None),
        "has_login_user": bool(getattr(broker, "user_id", None)),
        "login_user": _serialize_login_user(user),
    }


def _serialize_agent(agent: Agent, stats: dict[str, Any] | None = None) -> dict[str, Any]:
    stats = stats or {}

    broker = _serialize_broker_from_agent(agent)
    user = getattr(agent, "user", None)

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

        "total_customers": stats.get("total_customers", 0),
        "customers_count": stats.get("total_customers", 0),
        "active_customers_count": stats.get("active_customers_count", 0),
        "lead_customers_count": stats.get("lead_customers_count", 0),
        "customers_with_login_users_count": stats.get("customers_with_login_users_count", 0),

        "total_orders": stats.get("total_orders", 0),
        "orders_count": stats.get("total_orders", 0),

        "total_sales": _money(stats.get("total_sales")),
        "pending_commission": _money(stats.get("pending_commission")),
        "approved_commission": _money(stats.get("approved_commission")),
        "paid_commission": _money(stats.get("paid_commission")),
        "total_commission": _money(stats.get("total_commission")),
        "due_commission": _money(stats.get("due_commission")),

        "financial_entries_count": stats.get("financial_entries_count", 0),
        "cod_custody_amount": _money(stats.get("cod_custody_amount")),
        "cod_custody_remaining_amount": _money(stats.get("cod_custody_remaining_amount")),
        "amount_due_from_agent": _money(stats.get("amount_due_from_agent")),
        "amount_due_to_agent": _money(stats.get("amount_due_to_agent")),
        "net_balance_amount": _money(stats.get("net_balance_amount")),

        "created_at": _date_iso(agent.created_at),
        "updated_at": _date_iso(agent.updated_at),
    }


def _serialize_customer_for_agent(customer: Customer) -> dict[str, Any]:
    name = _customer_name(customer)
    phone = (
        getattr(customer, "whatsapp_number", "")
        or getattr(customer, "phone_number", "")
        or getattr(customer, "alternative_phone_number", "")
    )

    user = getattr(customer, "user", None)
    broker = getattr(customer, "broker", None)

    return {
        "id": customer.pk,
        "customer_code": getattr(customer, "customer_code", ""),
        "name": name,
        "display_name": name,
        "customer_type": getattr(customer, "customer_type", ""),
        "status": getattr(customer, "status", ""),
        "source": getattr(customer, "source", ""),
        "phone": phone,
        "phone_number": phone,
        "whatsapp_number": getattr(customer, "whatsapp_number", ""),
        "email": getattr(customer, "email", ""),
        "city": getattr(customer, "city", ""),
        "agent_id": getattr(customer, "agent_id", None),
        "broker_id": getattr(customer, "broker_id", None),
        "broker": (
            {
                "id": broker.pk,
                "name": _safe_attr(broker, "name", "full_name"),
                "broker_code": _safe_attr(broker, "broker_code", "code"),
                "code": _safe_attr(broker, "broker_code", "code"),
                "has_login_user": bool(getattr(broker, "user_id", None)),
                "user_id": getattr(broker, "user_id", None),
            }
            if broker
            else None
        ),
        "broker_name": _safe_attr(broker, "name") if broker else "",
        "has_customer_account": bool(getattr(customer, "user_id", None)),
        "login_user": _serialize_login_user(user),
        "created_at": _date_iso(getattr(customer, "created_at", None)),
        "updated_at": _date_iso(getattr(customer, "updated_at", None)),
    }


def _serialize_agent_order(agent_order: AgentOrder) -> dict[str, Any]:
    order = getattr(agent_order, "order", None)
    customer = getattr(agent_order, "customer", None)
    agent = getattr(agent_order, "agent", None)
    broker = getattr(agent_order, "broker", None)

    return {
        "id": agent_order.pk,
        "order_id": agent_order.order_id,
        "order_number": _order_number(order),
        "agent_id": agent_order.agent_id,
        "agent_name": _safe_attr(agent, "full_name", "name") if agent else "",
        "agent_code": _safe_attr(agent, "agent_code", "code") if agent else "",
        "agent_user_id": getattr(agent, "user_id", None) if agent else None,
        "customer_id": agent_order.customer_id,
        "customer_name": _customer_name(customer),
        "broker_id": getattr(agent_order, "broker_id", None),
        "broker_name": _safe_attr(broker, "name") if broker else "",
        "broker_code": _safe_attr(broker, "broker_code", "code") if broker else "",
        "broker_user_id": getattr(broker, "user_id", None) if broker else None,
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
        "order_number": _order_number(order),
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


def _serialize_financial_entry(entry: AgentFinancialEntry) -> dict[str, Any]:
    agent = getattr(entry, "agent", None)
    broker = getattr(entry, "broker", None)
    order = getattr(entry, "order", None)
    payment = getattr(entry, "payment", None)
    commission = getattr(entry, "commission", None)
    rule = getattr(entry, "rule", None)
    journal_entry = getattr(entry, "journal_entry", None)

    amount = _safe_decimal(getattr(entry, "amount", "0.00"))
    paid_amount = _safe_decimal(getattr(entry, "paid_amount", "0.00"))
    remaining_amount = _entry_remaining_amount(entry)

    return {
        "id": entry.pk,
        "entry_number": entry.entry_number,
        "entry_type": entry.entry_type,
        "entry_type_label": (
            entry.get_entry_type_display()
            if hasattr(entry, "get_entry_type_display")
            else entry.entry_type
        ),
        "direction": entry.direction,
        "direction_label": (
            entry.get_direction_display()
            if hasattr(entry, "get_direction_display")
            else entry.direction
        ),
        "status": entry.status,
        "status_label": (
            entry.get_status_display()
            if hasattr(entry, "get_status_display")
            else entry.status
        ),

        "amount": _money(amount),
        "paid_amount": _money(paid_amount),
        "remaining_amount": _money(remaining_amount),
        "currency": entry.currency,

        "debit_amount": _money(amount if _is_debit_entry(entry) else Decimal("0.00")),
        "credit_amount": _money(amount if _is_credit_entry(entry) else Decimal("0.00")),

        "agent_id": entry.agent_id,
        "agent_name": _safe_attr(agent, "full_name", "name") if agent else "",
        "agent_code": _safe_attr(agent, "agent_code", "code") if agent else "",
        "agent_user_id": getattr(agent, "user_id", None) if agent else None,
        "agent_has_login_user": bool(getattr(agent, "user_id", None)) if agent else False,

        "broker_id": entry.broker_id,
        "broker_name": _safe_attr(broker, "name", "full_name") if broker else "",
        "broker_code": _safe_attr(broker, "broker_code", "code") if broker else "",
        "broker_user_id": getattr(broker, "user_id", None) if broker else None,
        "broker_has_login_user": bool(getattr(broker, "user_id", None)) if broker else False,

        "order_id": entry.order_id,
        "order_number": _order_number(order),
        "payment_id": entry.payment_id,
        "payment_number": _safe_attr(payment, "payment_number", "number") if payment else "",
        "commission_id": entry.commission_id,
        "commission_reference": f"COM-{commission.pk}" if commission else "",
        "rule_id": entry.rule_id,
        "rule_name": _safe_attr(rule, "name") if rule else "",

        "description": entry.description,
        "reference": entry.reference,
        "source_type": entry.source_type,
        "source_id": entry.source_id,
        "source_number": entry.source_number,

        "journal_entry_id": entry.journal_entry_id,
        "journal_entry_reference": (
            entry.journal_entry_reference
            or _safe_attr(journal_entry, "entry_number")
        ),
        "journal_entry_number": _safe_attr(journal_entry, "entry_number"),
        "is_accounting_posted": bool(
            entry.is_accounting_posted
            or entry.journal_entry_id
            or entry.journal_entry_reference
        ),

        "earned_at": _date_iso(entry.earned_at),
        "approved_at": _date_iso(entry.approved_at),
        "settled_at": _date_iso(getattr(entry, "settled_at", None)),
        "paid_at": _date_iso(entry.paid_at),
        "posted_at": _date_iso(entry.posted_at),
        "created_at": _date_iso(entry.created_at),
        "updated_at": _date_iso(entry.updated_at),

        "metadata": entry.metadata or {},
    }


# ============================================================
# Stats
# ============================================================

def _build_agent_customers_stats(customers_qs) -> dict[str, Any]:
    return {
        "total_customers": customers_qs.count(),
        "active_customers_count": customers_qs.filter(status="active").count(),
        "inactive_customers_count": customers_qs.filter(status="inactive").count(),
        "blocked_customers_count": customers_qs.filter(status="blocked").count(),
        "lead_customers_count": customers_qs.filter(status="lead").count(),
        "customers_with_login_users_count": customers_qs.filter(user__isnull=False).count(),
    }


def _build_agent_legacy_stats(
    *,
    agent_orders_qs,
    commissions_qs,
    customers_qs=None,
) -> dict[str, Any]:
    customer_stats = (
        _build_agent_customers_stats(customers_qs)
        if customers_qs is not None
        else {
            "total_customers": agent_orders_qs.values("customer_id").distinct().count(),
            "active_customers_count": 0,
            "inactive_customers_count": 0,
            "blocked_customers_count": 0,
            "lead_customers_count": 0,
            "customers_with_login_users_count": 0,
        }
    )

    stats = {
        **customer_stats,
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
        "due_commission": Decimal("0.00"),
    }

    total_paid = commissions_qs.aggregate(total=Sum("paid_amount")).get("total") or Decimal("0.00")
    total_commission = stats["total_commission"] or Decimal("0.00")
    stats["due_commission"] = total_commission - total_paid

    return stats


def _build_financial_stats_from_statement(statement_payload: dict[str, Any]) -> dict[str, Any]:
    summary = statement_payload.get("summary") or {}

    return {
        "financial_entries_count": len(statement_payload.get("lines") or []),
        "cod_custody_amount": summary.get("cod_custody_amount", "0.00"),
        "cod_custody_paid_amount": summary.get("cod_custody_paid_amount", "0.00"),
        "cod_custody_remaining_amount": summary.get("cod_custody_remaining_amount", "0.00"),

        "sales_commission_amount": summary.get("sales_commission_amount", "0.00"),
        "sales_commission_paid_amount": summary.get("sales_commission_paid_amount", "0.00"),
        "sales_commission_remaining_amount": summary.get("sales_commission_remaining_amount", "0.00"),

        "delivery_fee_amount": summary.get("delivery_fee_amount", "0.00"),
        "delivery_fee_paid_amount": summary.get("delivery_fee_paid_amount", "0.00"),
        "delivery_fee_remaining_amount": summary.get("delivery_fee_remaining_amount", "0.00"),

        "broker_share_amount": summary.get("broker_share_amount", "0.00"),
        "broker_share_paid_amount": summary.get("broker_share_paid_amount", "0.00"),
        "broker_share_remaining_amount": summary.get("broker_share_remaining_amount", "0.00"),

        "amount_due_from_agent": summary.get("amount_due_from_agent", "0.00"),
        "amount_due_to_agent": summary.get("amount_due_to_agent", "0.00"),
        "net_balance_amount": summary.get("net_balance_amount", "0.00"),

        "total_debit_amount": summary.get("total_debit_amount", "0.00"),
        "total_credit_amount": summary.get("total_credit_amount", "0.00"),
        "total_debit_paid_amount": summary.get("total_debit_paid_amount", "0.00"),
        "total_credit_paid_amount": summary.get("total_credit_paid_amount", "0.00"),
        "total_debit_remaining_amount": summary.get("total_debit_remaining_amount", "0.00"),
        "total_credit_remaining_amount": summary.get("total_credit_remaining_amount", "0.00"),

        "settlements_amount": summary.get("settlements_amount", "0.00"),
    }


def _format_stats_for_response(stats: dict[str, Any]) -> dict[str, Any]:
    money_keys = {
        "total_sales",
        "pending_commission",
        "approved_commission",
        "paid_commission",
        "total_commission",
        "due_commission",

        "cod_custody_amount",
        "cod_custody_paid_amount",
        "cod_custody_remaining_amount",

        "sales_commission_amount",
        "sales_commission_paid_amount",
        "sales_commission_remaining_amount",

        "delivery_fee_amount",
        "delivery_fee_paid_amount",
        "delivery_fee_remaining_amount",

        "broker_share_amount",
        "broker_share_paid_amount",
        "broker_share_remaining_amount",

        "amount_due_from_agent",
        "amount_due_to_agent",
        "net_balance_amount",

        "total_debit_amount",
        "total_credit_amount",
        "total_debit_paid_amount",
        "total_credit_paid_amount",
        "total_debit_remaining_amount",
        "total_credit_remaining_amount",

        "settlements_amount",
    }

    formatted: dict[str, Any] = {}

    for key, value in stats.items():
        formatted[key] = _money(value) if key in money_keys else value

    return formatted


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
def agent_detail_api(request, agent_id: int):
    try:
        agent = _agent_queryset().filter(pk=agent_id).first()

        if not agent:
            return _json_error("المندوب غير موجود.", status=404)

        agent_orders_qs = _agent_orders_queryset(agent)
        commissions_qs = _commissions_queryset(agent)
        financial_entries_qs = _financial_entries_queryset(agent)
        customers_qs = _customers_queryset(agent)

        date_from = _parse_date(request.GET.get("date_from"))
        date_to = _parse_date(request.GET.get("date_to"))

        include_statement = _to_bool(request.GET.get("include_statement"), False)
        include_agent_orders = _to_bool(request.GET.get("include_agent_orders"), False)
        include_commissions = _to_bool(request.GET.get("include_commissions"), False)
        include_financial_entries = _to_bool(request.GET.get("include_financial_entries"), True)
        include_customers = _to_bool(request.GET.get("include_customers"), True)

        statement_payload = _build_agent_statement_payload_safe(
            agent=agent,
            date_from=date_from,
            date_to=date_to,
            include_agent_orders=include_agent_orders,
            include_commissions=include_commissions,
            include_financial_entries=include_financial_entries,
        )

        legacy_stats = _build_agent_legacy_stats(
            agent_orders_qs=agent_orders_qs,
            commissions_qs=commissions_qs,
            customers_qs=customers_qs,
        )
        financial_stats = _build_financial_stats_from_statement(statement_payload)

        stats = {
            **legacy_stats,
            **financial_stats,
        }

        recent_orders = [
            _serialize_agent_order(agent_order)
            for agent_order in agent_orders_qs[:10]
        ]

        recent_commissions = [
            _serialize_commission(commission)
            for commission in commissions_qs[:10]
        ]

        recent_financial_entries = [
            _serialize_financial_entry(entry)
            for entry in financial_entries_qs[:20]
        ]

        recent_customers = (
            [
                _serialize_customer_for_agent(customer)
                for customer in customers_qs[:10]
            ]
            if include_customers
            else []
        )

        customers_summary = _build_agent_customers_stats(customers_qs)
        agent_payload = _serialize_agent(agent, stats)

        payload: dict[str, Any] = {
            "agent": agent_payload,
            "item": agent_payload,
            "stats": _format_stats_for_response(stats),
            "customers_summary": customers_summary,
            "financial_summary": statement_payload.get("summary", {}),
            "recent_customers": recent_customers,
            "customers": recent_customers,
            "recent_orders": recent_orders,
            "orders": recent_orders,
            "recent_commissions": recent_commissions,
            "commissions": recent_commissions,
            "recent_financial_entries": recent_financial_entries,
            "financial_entries": recent_financial_entries,
            "counts": {
                "customers": customers_qs.count(),
                "orders": agent_orders_qs.count(),
                "commissions": commissions_qs.count(),
                "financial_entries": financial_entries_qs.count(),
                "statement_lines": len(statement_payload.get("lines") or []),
            },
            "filters": {
                "date_from": date_from.isoformat() if date_from else None,
                "date_to": date_to.isoformat() if date_to else None,
                "include_statement": include_statement,
                "include_agent_orders": include_agent_orders,
                "include_commissions": include_commissions,
                "include_financial_entries": include_financial_entries,
                "include_customers": include_customers,
            },
        }

        if include_statement:
            payload["statement"] = statement_payload

        return _json_success(
            payload,
            message="تم جلب تفاصيل المندوب بنجاح.",
        )

    except Exception as exc:
        logger.exception("Failed to fetch agent detail: %s", exc)
        return _json_error("تعذر جلب تفاصيل المندوب.", status=500)


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
def commission_detail_api(request, commission_id: int):
    try:
        commission = (
            AgentCommission.objects.select_related(
                "agent",
                "agent__user",
                "broker",
                "broker__user",
                "order",
                "payment",
                "agent_order",
                "agent_order__customer",
                "agent_order__customer__user",
            )
            .filter(pk=commission_id)
            .first()
        )

        if not commission:
            return _json_error("العمولة غير موجودة.", status=404)

        related_financial_entries = (
            AgentFinancialEntry.objects.filter(
                Q(commission_id=commission.pk)
                | Q(source_type="commission", source_id=str(commission.pk))
            )
            .select_related(
                "agent",
                "agent__user",
                "broker",
                "broker__user",
                "order",
                "payment",
                "commission",
                "rule",
                "journal_entry",
            )
            .order_by("-created_at", "-id")
        )

        commission_payload = _serialize_commission(commission)

        payload = {
            "commission": commission_payload,
            "item": commission_payload,
            "related_financial_entries": [
                _serialize_financial_entry(entry)
                for entry in related_financial_entries[:20]
            ],
            "counts": {
                "related_financial_entries": related_financial_entries.count(),
            },
        }

        return _json_success(
            payload,
            message="تم جلب تفاصيل العمولة بنجاح.",
        )

    except Exception as exc:
        logger.exception("Failed to fetch commission detail: %s", exc)
        return _json_error("تعذر جلب تفاصيل العمولة.", status=500)