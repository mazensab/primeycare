# ============================================================
# 📂 api/agents/broker_detail.py
# 🧠 Primey Care | Broker Detail API V3 Login + Customers Ready
# ------------------------------------------------------------
# ✅ تفاصيل وسيط / وكيل مستقل
# ✅ Model-safe مع agents.models.Broker
# ✅ لا يعتمد على Enums غير مؤكدة
# ✅ يرجع broker بصيغ متعددة متوافقة مع الفرونت:
#    data / item / broker
# ✅ يدعم ملخص المندوبين المرتبطين Agent.broker
# ✅ يدعم حساب الدخول المرتبط بالوسيط Broker.user
# ✅ يدعم ملخص العملاء المرتبطين بالوسيط Customer.broker
# ✅ يدعم حقول مالية أساسية للوسيط
# ✅ يحاول استخدام كشف حساب الوسيط من agents.services عند توفره
# ✅ Protected by permissions:
#    brokers.view OR agents.view
# ✅ مناسب لصفحة:
#    /system/brokers/[id]
# ============================================================

from __future__ import annotations

import logging
from decimal import Decimal, InvalidOperation
from typing import Any, Callable

from django.contrib.auth.decorators import login_required
from django.core.exceptions import FieldDoesNotExist
from django.db.models import Sum
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from agents.models import Agent, Broker
from auth_center.permissions import PermissionCodes, any_permission_required
from customers.models import Customer

logger = logging.getLogger(__name__)


# ============================================================
# Optional Services
# ============================================================

try:
    from agents.services import build_broker_statement_payload as _build_real_broker_statement_payload
except Exception:  # pragma: no cover
    _build_real_broker_statement_payload = None


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


def _json_success(data: dict[str, Any], status: int = 200) -> JsonResponse:
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

def _clean_text(value: Any, fallback: str = "") -> str:
    if value is None:
        return fallback

    cleaned = str(value).strip()
    return cleaned or fallback


def _decimal_to_str(value: Any) -> str:
    if value in (None, ""):
        return "0.00"

    try:
        return str(Decimal(str(value)).quantize(Decimal("0.01")))
    except (InvalidOperation, TypeError, ValueError):
        return "0.00"


def _decimal_value(value: Any) -> Decimal:
    try:
        return Decimal(str(value or "0.00")).quantize(Decimal("0.01"))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0.00")


def _has_model_field(model: Any, field_name: str) -> bool:
    try:
        model._meta.get_field(field_name)
        return True
    except FieldDoesNotExist:
        return False
    except Exception:
        return False


def _safe_getattr(instance: Any, field_name: str, fallback: Any = "") -> Any:
    return getattr(instance, field_name, fallback)


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _first_existing_attr(instance: Any, names: list[str], fallback: Any = "") -> Any:
    for name in names:
        value = getattr(instance, name, None)
        if value not in (None, ""):
            return value

    return fallback


def _serialize_login_user(user: Any | None) -> dict[str, Any] | None:
    if not user:
        return None

    full_name = ""
    try:
        full_name = user.get_full_name()
    except Exception:
        full_name = ""

    return {
        "id": getattr(user, "pk", None),
        "username": getattr(user, "username", ""),
        "email": getattr(user, "email", ""),
        "first_name": getattr(user, "first_name", ""),
        "last_name": getattr(user, "last_name", ""),
        "full_name": full_name,
        "is_active": getattr(user, "is_active", False),
        "is_staff": getattr(user, "is_staff", False),
        "is_superuser": getattr(user, "is_superuser", False),
        "last_login": _iso_datetime(getattr(user, "last_login", None)),
        "date_joined": _iso_datetime(getattr(user, "date_joined", None)),
    }


# ============================================================
# Broker Serialization
# ============================================================

def serialize_broker(broker: Broker) -> dict[str, Any]:
    name = _first_existing_attr(
        broker,
        ["name", "full_name", "display_name", "broker_name"],
        str(broker),
    )

    broker_code = _first_existing_attr(
        broker,
        ["broker_code", "code"],
        "",
    )

    phone = _first_existing_attr(
        broker,
        ["phone", "phone_number", "mobile"],
        "",
    )

    commission_type = _clean_text(
        _first_existing_attr(
            broker,
            ["default_commission_type", "commission_type"],
            "",
        )
    )

    commission_value = _safe_getattr(
        broker,
        "default_commission_value",
        _safe_getattr(broker, "commission_value", Decimal("0.00")),
    )

    metadata = _safe_getattr(broker, "metadata", {}) or {}
    if not isinstance(metadata, dict):
        metadata = {}

    user = getattr(broker, "user", None)

    return {
        "id": broker.pk,
        "name": name,
        "full_name": name,
        "broker_name": name,
        "display_name": name,

        "broker_code": broker_code,
        "code": broker_code,
        "referral_code": _safe_getattr(broker, "referral_code", ""),

        "status": _safe_getattr(broker, "status", ""),

        "phone": phone,
        "phone_number": phone,
        "mobile": phone,
        "email": _safe_getattr(broker, "email", ""),
        "city": _safe_getattr(broker, "city", ""),
        "address": _safe_getattr(broker, "address", ""),

        "default_commission_type": commission_type,
        "commission_type": commission_type,
        "default_commission_value": _decimal_to_str(commission_value),
        "commission_value": _decimal_to_str(commission_value),

        "revenue_recognition_mode": _safe_getattr(
            broker,
            "revenue_recognition_mode",
            "",
        ),
        "settlement_mode": _safe_getattr(
            broker,
            "settlement_mode",
            "",
        ),

        "bank_name": _safe_getattr(broker, "bank_name", ""),
        "bank_account_name": _safe_getattr(broker, "bank_account_name", ""),
        "iban": _safe_getattr(broker, "iban", ""),

        "notes": _safe_getattr(broker, "notes", ""),
        "metadata": metadata,

        "has_login_user": bool(getattr(broker, "user_id", None)),
        "login_user": _serialize_login_user(user),

        "label": f"{name} · {broker_code}" if broker_code else name,
        "value": broker.pk,

        "created_at": _iso_datetime(_safe_getattr(broker, "created_at", None)),
        "updated_at": _iso_datetime(_safe_getattr(broker, "updated_at", None)),
    }


def serialize_agent_for_broker(agent: Agent) -> dict[str, Any]:
    name = _first_existing_attr(
        agent,
        ["full_name", "name", "display_name"],
        str(agent),
    )

    agent_code = _first_existing_attr(
        agent,
        ["agent_code", "code"],
        "",
    )

    phone = _first_existing_attr(
        agent,
        ["phone", "phone_number", "mobile"],
        "",
    )

    user = getattr(agent, "user", None)

    return {
        "id": agent.pk,
        "name": name,
        "full_name": name,
        "agent_name": name,
        "agent_code": agent_code,
        "code": agent_code,
        "referral_code": _safe_getattr(agent, "referral_code", ""),
        "status": _safe_getattr(agent, "status", ""),
        "phone": phone,
        "phone_number": phone,
        "email": _safe_getattr(agent, "email", ""),
        "city": _safe_getattr(agent, "city", ""),
        "broker_id": _safe_getattr(agent, "broker_id", None),
        "default_commission_type": _safe_getattr(agent, "default_commission_type", ""),
        "default_commission_value": _decimal_to_str(
            _safe_getattr(agent, "default_commission_value", Decimal("0.00"))
        ),
        "default_delivery_fee": _decimal_to_str(
            _safe_getattr(agent, "default_delivery_fee", Decimal("0.00"))
        ),
        "has_login_user": bool(getattr(agent, "user_id", None)),
        "login_user": _serialize_login_user(user),
        "created_at": _iso_datetime(_safe_getattr(agent, "created_at", None)),
        "updated_at": _iso_datetime(_safe_getattr(agent, "updated_at", None)),
    }


def serialize_customer_for_broker(customer: Customer) -> dict[str, Any]:
    name = _first_existing_attr(
        customer,
        ["display_name", "full_name", "company_name"],
        str(customer),
    )

    phone = _first_existing_attr(
        customer,
        ["whatsapp_number", "phone_number", "alternative_phone_number"],
        "",
    )

    user = getattr(customer, "user", None)
    agent = getattr(customer, "agent", None)

    return {
        "id": customer.pk,
        "customer_code": _safe_getattr(customer, "customer_code", ""),
        "name": name,
        "display_name": name,
        "customer_type": _safe_getattr(customer, "customer_type", ""),
        "status": _safe_getattr(customer, "status", ""),
        "source": _safe_getattr(customer, "source", ""),
        "phone": phone,
        "phone_number": phone,
        "whatsapp_number": _safe_getattr(customer, "whatsapp_number", ""),
        "email": _safe_getattr(customer, "email", ""),
        "city": _safe_getattr(customer, "city", ""),
        "agent_id": _safe_getattr(customer, "agent_id", None),
        "broker_id": _safe_getattr(customer, "broker_id", None),
        "agent": (
            {
                "id": agent.pk,
                "name": getattr(agent, "full_name", "") or str(agent),
                "agent_code": getattr(agent, "agent_code", "") or "",
                "code": getattr(agent, "agent_code", "") or "",
            }
            if agent
            else None
        ),
        "has_customer_account": bool(getattr(customer, "user_id", None)),
        "login_user": _serialize_login_user(user),
        "created_at": _iso_datetime(_safe_getattr(customer, "created_at", None)),
        "updated_at": _iso_datetime(_safe_getattr(customer, "updated_at", None)),
    }


# ============================================================
# Broker Querysets
# ============================================================

def _broker_agents_queryset(broker: Broker):
    if not _has_model_field(Agent, "broker"):
        return Agent.objects.none()

    return (
        Agent.objects
        .filter(broker_id=broker.pk)
        .select_related("user", "broker")
    )


def _broker_customers_queryset(broker: Broker):
    if not _has_model_field(Customer, "broker"):
        return Customer.objects.none()

    return (
        Customer.objects
        .filter(broker_id=broker.pk)
        .select_related("user", "agent", "broker")
    )


# ============================================================
# Broker Related Payloads
# ============================================================

def _build_broker_agents_payload(broker: Broker) -> dict[str, Any]:
    queryset = _broker_agents_queryset(broker)

    stats = {
        "agents_count": 0,
        "active_agents_count": 0,
        "inactive_agents_count": 0,
        "suspended_agents_count": 0,
        "draft_agents_count": 0,
        "agents_with_login_users_count": 0,
        "default_commission_total": "0.00",
        "default_delivery_fee_total": "0.00",
    }

    recent_agents: list[dict[str, Any]] = []

    try:
        stats["agents_count"] = queryset.count()
        stats["active_agents_count"] = queryset.filter(status="ACTIVE").count()
        stats["inactive_agents_count"] = queryset.filter(status="INACTIVE").count()
        stats["suspended_agents_count"] = queryset.filter(status="SUSPENDED").count()
        stats["draft_agents_count"] = queryset.filter(status="DRAFT").count()

        if _has_model_field(Agent, "user"):
            stats["agents_with_login_users_count"] = queryset.filter(
                user__isnull=False
            ).count()

        if _has_model_field(Agent, "default_commission_value"):
            commission_total = queryset.aggregate(
                total=Sum("default_commission_value")
            ).get("total")
            stats["default_commission_total"] = _decimal_to_str(commission_total)

        if _has_model_field(Agent, "default_delivery_fee"):
            delivery_total = queryset.aggregate(
                total=Sum("default_delivery_fee")
            ).get("total")
            stats["default_delivery_fee_total"] = _decimal_to_str(delivery_total)

        recent_agents = [
            serialize_agent_for_broker(agent)
            for agent in queryset.order_by("-id")[:10]
        ]

    except Exception as exc:
        logger.warning("Failed to build broker agents payload: %s", exc)

    return {
        "stats": stats,
        "recent_agents": recent_agents,
        "agents": recent_agents,
    }


def _build_broker_customers_payload(broker: Broker) -> dict[str, Any]:
    queryset = _broker_customers_queryset(broker)

    stats = {
        "customers_count": 0,
        "active_customers_count": 0,
        "inactive_customers_count": 0,
        "blocked_customers_count": 0,
        "lead_customers_count": 0,
        "customers_with_login_users_count": 0,
        "customers_with_agent_count": 0,
        "customers_without_agent_count": 0,
    }

    recent_customers: list[dict[str, Any]] = []

    try:
        stats["customers_count"] = queryset.count()
        stats["active_customers_count"] = queryset.filter(status="active").count()
        stats["inactive_customers_count"] = queryset.filter(status="inactive").count()
        stats["blocked_customers_count"] = queryset.filter(status="blocked").count()
        stats["lead_customers_count"] = queryset.filter(status="lead").count()

        if _has_model_field(Customer, "user"):
            stats["customers_with_login_users_count"] = queryset.filter(
                user__isnull=False
            ).count()

        if _has_model_field(Customer, "agent"):
            stats["customers_with_agent_count"] = queryset.filter(
                agent__isnull=False
            ).count()
            stats["customers_without_agent_count"] = queryset.filter(
                agent__isnull=True
            ).count()

        recent_customers = [
            serialize_customer_for_broker(customer)
            for customer in queryset.order_by("-id")[:10]
        ]

    except Exception as exc:
        logger.warning("Failed to build broker customers payload: %s", exc)

    return {
        "stats": stats,
        "recent_customers": recent_customers,
        "customers": recent_customers,
    }


def _build_broker_financial_summary(broker: Broker) -> dict[str, Any]:
    """
    يحاول استخدام كشف حساب الوسيط الحقيقي من agents.services.
    وإذا تعذر يرجع fallback آمن مبني على إعدادات الوسيط.
    """

    if callable(_build_real_broker_statement_payload):
        try:
            statement = _build_real_broker_statement_payload(
                broker,
                include_team_entries=True,
            )
            summary = statement.get("summary", {}) if isinstance(statement, dict) else {}

            if summary:
                return {
                    "currency": summary.get("currency", "SAR"),
                    "total_debit_amount": summary.get("total_debit_amount", "0.00"),
                    "total_credit_amount": summary.get("total_credit_amount", "0.00"),
                    "total_debit_paid_amount": summary.get("total_debit_paid_amount", "0.00"),
                    "total_credit_paid_amount": summary.get("total_credit_paid_amount", "0.00"),
                    "total_debit_remaining_amount": summary.get("total_debit_remaining_amount", "0.00"),
                    "total_credit_remaining_amount": summary.get("total_credit_remaining_amount", "0.00"),
                    "net_balance_amount": summary.get("net_balance_amount", "0.00"),
                    "broker_share_amount": summary.get("broker_share_amount", "0.00"),
                    "broker_share_paid_amount": summary.get("broker_share_paid_amount", "0.00"),
                    "broker_share_remaining_amount": summary.get("broker_share_remaining_amount", "0.00"),
                    "settlements_amount": summary.get("settlements_amount", "0.00"),
                    "amount_due_from_broker": summary.get("amount_due_from_broker", "0.00"),
                    "amount_due_to_broker": summary.get("amount_due_to_broker", "0.00"),
                    "has_financial_profile": True,
                    "source": "broker_statement",
                }

        except Exception as exc:
            logger.warning("Failed to build real broker financial summary: %s", exc)

    commission_value = _decimal_value(
        _safe_getattr(
            broker,
            "default_commission_value",
            Decimal("0.00"),
        )
    )

    commission_type = _clean_text(
        _safe_getattr(broker, "default_commission_type", "")
    ).upper()

    sample_amount = Decimal("200.00")

    estimated_commission = commission_value
    if commission_type == "PERCENTAGE":
        estimated_commission = (
            sample_amount * commission_value / Decimal("100.00")
        ).quantize(Decimal("0.01"))

    return {
        "currency": "SAR",
        "sample_amount": _decimal_to_str(sample_amount),
        "default_commission_type": commission_type,
        "default_commission_value": _decimal_to_str(commission_value),
        "estimated_commission_on_sample": _decimal_to_str(estimated_commission),
        "revenue_recognition_mode": _safe_getattr(
            broker,
            "revenue_recognition_mode",
            "",
        ),
        "settlement_mode": _safe_getattr(
            broker,
            "settlement_mode",
            "",
        ),
        "has_financial_profile": True,
        "source": "broker_settings_fallback",
    }


# ============================================================
# API
# ============================================================

@login_required
@require_GET
@any_permission_required(
    (
        PermissionCodes.BROKERS_VIEW,
        PermissionCodes.AGENTS_VIEW,
    )
)
def broker_detail_api(request, broker_id: int):
    try:
        broker = (
            Broker.objects
            .select_related("user")
            .filter(pk=broker_id)
            .first()
        )

        if not broker:
            return _json_error(
                "الوسيط غير موجود.",
                status=404,
                errors={
                    "broker_id": [
                        "لم يتم العثور على وسيط بهذا المعرّف."
                    ]
                },
            )

        broker_payload = serialize_broker(broker)
        agents_payload = _build_broker_agents_payload(broker)
        customers_payload = _build_broker_customers_payload(broker)
        financial_summary = _build_broker_financial_summary(broker)

        payload = {
            **broker_payload,
            "financial_summary": financial_summary,
            "agents_summary": agents_payload.get("stats", {}),
            "customers_summary": customers_payload.get("stats", {}),
            "recent_agents": agents_payload.get("recent_agents", []),
            "recent_customers": customers_payload.get("recent_customers", []),
            "agents": agents_payload.get("agents", []),
            "customers": customers_payload.get("customers", []),
        }

        return _json_success(
            {
                "message": "تم جلب تفاصيل الوسيط بنجاح.",
                "broker": payload,
                "item": payload,
                "data": {
                    "broker": payload,
                    "financial_summary": financial_summary,
                    "agents_summary": agents_payload.get("stats", {}),
                    "customers_summary": customers_payload.get("stats", {}),
                    "recent_agents": agents_payload.get("recent_agents", []),
                    "recent_customers": customers_payload.get("recent_customers", []),
                    "agents": agents_payload.get("agents", []),
                    "customers": customers_payload.get("customers", []),
                },
            },
            status=200,
        )

    except Exception as exc:
        logger.exception("Failed to load broker detail %s: %s", broker_id, exc)
        return _json_error("تعذر جلب تفاصيل الوسيط.", status=500)