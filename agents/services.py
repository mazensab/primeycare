# ============================================================
# 📂 agents/services.py
# 🧠 Primey Care | Agents, Brokers & Financial Services V3.1
# ------------------------------------------------------------
# ✅ إنشاء ربط الطلب بالمندوب
# ✅ إنشاء العمولة القديمة للتوافق الخلفي
# ✅ إنشاء سجلات مالية تفصيلية AgentFinancialEntry
# ✅ دعم الوسطاء / الوكلاء Broker
# ✅ دعم قواعد مالية متعددة AgentFinancialRule
# ✅ دعم عمولة بيع، توصيل، حصة وسيط، عهدة COD، بونص، خصم، تسوية
# ✅ اعتماد العمولة مع earned_at + approved_at
# ✅ إطلاق قيد استحقاق العمولة بعد commit
# ✅ كشف حساب المندوب من السجلات المالية الجديدة بالتفصيل
# ✅ كشف حساب الوسيط وفريقه
# ✅ إظهار كل حركة مالية مع المسدد والمتبقي والقيد المحاسبي
# ✅ Logging منظم + أخطاء واضحة
# ✅ بدون كسر المنجز السابق
# ------------------------------------------------------------
# القاعدة المالية:
# - AgentCommission بقي للتوافق.
# - AgentFinancialEntry هو السجل المالي التفصيلي الجديد.
# - تحصيل COD لا يدخل خزينة الشركة مباشرة، بل يصبح عهدة على من حصّل.
# - مندوب البيع ومندوب التوصيل قد يكونان طرفين مختلفين.
# - الوسيط له حصة مستقلة وكشف حساب مستقل.
# - الرصيد في كشف المندوب:
#   debit  = ما على المندوب / عهدة عليه.
#   credit = ما للمندوب / مستحق له.
#   net_balance = debit_remaining - credit_remaining.
# ============================================================

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass
from datetime import date, datetime, time
from decimal import Decimal, ROUND_HALF_UP
from importlib import import_module
from typing import Any, Callable, Optional

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q, QuerySet, Sum
from django.utils import timezone

from agents.models import (
    Agent,
    AgentCommission,
    AgentFinancialEntry,
    AgentFinancialRule,
    AgentOrder,
    AgentStatus,
    Broker,
    BrokerStatus,
    CalculationBase,
    CommissionStatus,
    FinancialEntryDirection,
    FinancialEntryStatus,
    FinancialEntryType,
    FinancialRuleScope,
    FinancialRuleType,
)

logger = logging.getLogger(__name__)


# ============================================================
# ⚙️ ثوابت عامة
# ============================================================

MONEY_ZERO = Decimal("0.00")
MONEY_QUANT = Decimal("0.01")

COMMISSION_STATUS_PENDING = CommissionStatus.PENDING
COMMISSION_STATUS_EARNED = CommissionStatus.EARNED
COMMISSION_STATUS_APPROVED = CommissionStatus.APPROVED
COMMISSION_STATUS_PAID = CommissionStatus.PAID
COMMISSION_STATUS_CANCELLED = CommissionStatus.CANCELLED
COMMISSION_STATUS_REVERSED = CommissionStatus.REVERSED

FINAL_COMMISSION_STATUSES = {
    COMMISSION_STATUS_APPROVED,
    COMMISSION_STATUS_PAID,
}

POSTABLE_COMMISSION_STATUSES = {
    COMMISSION_STATUS_APPROVED,
    COMMISSION_STATUS_PAID,
}

CANDIDATE_COMMISSION_POSTING_TARGETS = [
    ("accounting.services", "post_agent_commission_accrual"),
    ("accounting.services", "post_commission_accrual"),
    ("accounting.services", "post_agent_commission"),
    ("accounting.services.posting", "post_agent_commission_accrual"),
    ("accounting.services.posting", "post_commission_accrual"),
    ("accounting.services.posting", "post_agent_commission"),
    ("accounting.services.commissions", "post_agent_commission_accrual"),
    ("accounting.services.commissions", "post_commission_accrual"),
    ("accounting.services.commissions", "post_agent_commission"),
]

CANDIDATE_FINANCIAL_ENTRY_POSTING_TARGETS = [
    ("accounting.services", "post_agent_financial_entry_accrual"),
    ("accounting.services", "post_agent_financial_entry"),
    ("accounting.services", "post_financial_entry"),
    ("accounting.services.posting", "post_agent_financial_entry_accrual"),
    ("accounting.services.posting", "post_agent_financial_entry"),
    ("accounting.services.entries", "post_agent_financial_entry_accrual"),
    ("accounting.services.entries", "post_agent_financial_entry"),
]


# ============================================================
# 🧱 استثناءات مخصصة
# ============================================================

class AgentServiceError(Exception):
    """الاستثناء الأساسي لخدمات المندوبين والوسطاء."""


class CommissionValidationError(AgentServiceError):
    """خطأ تحقق منطقي أثناء معالجة العمولة."""


class CommissionPostingError(AgentServiceError):
    """خطأ أثناء الترحيل المحاسبي الخاص بالعمولة."""


class AgentFinancialEntryError(AgentServiceError):
    """خطأ أثناء إنشاء أو معالجة السجل المالي."""


# ============================================================
# 📦 نتائج الخدمات
# ============================================================

@dataclass(slots=True)
class AgentOrderCreationResult:
    agent_order: AgentOrder
    commission: AgentCommission | None
    commission_created: bool


@dataclass(slots=True)
class CommissionApprovalResult:
    commission: Any
    status_before: str
    status_after: str
    accounting_post_requested: bool
    accounting_post_dispatched: bool
    accounting_post_message: str


@dataclass(slots=True)
class FinancialEntryCreationResult:
    entry: AgentFinancialEntry
    created: bool


@dataclass(slots=True)
class FinancialEntrySettlementResult:
    entry: AgentFinancialEntry
    status_before: str
    status_after: str
    paid_before: Decimal
    paid_after: Decimal
    paid_delta: Decimal
    remaining_amount: Decimal


@dataclass(slots=True)
class AgentStatementSummary:
    agent_id: int
    agent_code: str
    agent_name: str
    agent_status: str
    broker_id: int | None
    broker_name: str
    primary_contact: str

    total_orders_count: int
    total_sales_amount: Decimal

    total_commissions_count: int
    total_commission_amount: Decimal
    total_paid_amount: Decimal
    total_due_amount: Decimal

    total_debit_amount: Decimal
    total_credit_amount: Decimal
    total_debit_paid_amount: Decimal
    total_credit_paid_amount: Decimal
    total_debit_remaining_amount: Decimal
    total_credit_remaining_amount: Decimal
    net_balance_amount: Decimal

    cod_custody_amount: Decimal
    cod_custody_paid_amount: Decimal
    cod_custody_remaining_amount: Decimal

    sales_commission_amount: Decimal
    sales_commission_paid_amount: Decimal
    sales_commission_remaining_amount: Decimal

    delivery_fee_amount: Decimal
    delivery_fee_paid_amount: Decimal
    delivery_fee_remaining_amount: Decimal

    broker_share_amount: Decimal
    broker_share_paid_amount: Decimal
    broker_share_remaining_amount: Decimal

    adjustments_debit_amount: Decimal
    adjustments_credit_amount: Decimal
    settlements_amount: Decimal

    amount_due_from_agent: Decimal
    amount_due_to_agent: Decimal
    currency: str


@dataclass(slots=True)
class BrokerStatementSummary:
    broker_id: int
    broker_code: str
    broker_name: str
    broker_status: str
    agents_count: int

    total_debit_amount: Decimal
    total_credit_amount: Decimal
    total_debit_paid_amount: Decimal
    total_credit_paid_amount: Decimal
    total_debit_remaining_amount: Decimal
    total_credit_remaining_amount: Decimal
    net_balance_amount: Decimal

    broker_share_amount: Decimal
    broker_share_paid_amount: Decimal
    broker_share_remaining_amount: Decimal

    settlements_amount: Decimal
    amount_due_from_broker: Decimal
    amount_due_to_broker: Decimal
    currency: str


@dataclass(slots=True)
class AgentStatementLine:
    line_type: str
    line_date: Optional[datetime]
    reference: str
    related_order_id: Optional[int]
    related_agent_order_id: Optional[int]
    related_commission_id: Optional[int]
    related_financial_entry_id: Optional[int]
    description: str
    debit_amount: Decimal
    credit_amount: Decimal
    balance_after: Decimal
    currency: str
    status: str
    metadata: dict[str, Any]


@dataclass(slots=True)
class AgentStatementResult:
    summary: AgentStatementSummary
    lines: list[AgentStatementLine]


@dataclass(slots=True)
class BrokerStatementResult:
    summary: BrokerStatementSummary
    lines: list[AgentStatementLine]

@dataclass(slots=True)
class AgentLoginUserResult:
    agent: Agent
    user: Any
    profile: Any
    created: bool
    linked: bool
    message: str
    auth_result: Any = None


@dataclass(slots=True)
class BrokerLoginUserResult:
    broker: Broker
    user: Any
    profile: Any
    created: bool
    linked: bool
    message: str
    auth_result: Any = None


# ============================================================
# 🛠️ Helpers عامة
# ============================================================

def _safe_getattr(obj: Any, attr_name: str, default: Any = None) -> Any:
    try:
        return getattr(obj, attr_name, default)
    except Exception:
        return default


def _first_non_empty(*values: Any) -> Any:
    for value in values:
        if value not in (None, "", [], {}, ()):
            return value
    return None


def _call_if_exists(obj: Any, method_name: str, *args: Any, **kwargs: Any) -> Any:
    method = getattr(obj, method_name, None)
    if callable(method):
        return method(*args, **kwargs)
    return None


def _money(value: Decimal | int | float | str | None) -> Decimal:
    amount = Decimal(str(value or "0.00"))
    return amount.quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)


def _positive_money(value: Decimal | int | float | str | None) -> Decimal:
    amount = _money(value)
    return amount if amount > MONEY_ZERO else MONEY_ZERO


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _clean_code(value: Any) -> str:
    return str(value or "").strip().upper()


def _ensure_aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if timezone.is_naive(value):
        return timezone.make_aware(value, timezone.get_current_timezone())
    return value


def _coerce_to_datetime(
    value: date | datetime | None,
    *,
    end_of_day: bool = False,
) -> datetime | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        return _ensure_aware(value)

    base_time = time.max if end_of_day else time.min
    return _ensure_aware(datetime.combine(value, base_time))


def _start_of_day(value: date | datetime | None) -> datetime | None:
    return _coerce_to_datetime(value, end_of_day=False)


def _end_of_day(value: date | datetime | None) -> datetime | None:
    return _coerce_to_datetime(value, end_of_day=True)


def _sort_datetime_fallback() -> datetime:
    return timezone.now()


def _enum_value(enum_class: Any, attr_name: str, fallback: str) -> str:
    return str(getattr(enum_class, attr_name, fallback))


def _resolve_import_callable(
    candidates: list[tuple[str, str]],
) -> Optional[Callable[..., Any]]:
    for module_path, function_name in candidates:
        try:
            module = import_module(module_path)
            fn = getattr(module, function_name, None)

            if callable(fn):
                logger.info("✅ تم العثور على الدالة: %s.%s", module_path, function_name)
                return fn

        except Exception as exc:
            logger.debug(
                "تعذر تحميل %s.%s أثناء البحث عن الدالة المطلوبة: %s",
                module_path,
                function_name,
                exc,
            )
            continue

    return None


def _call_commission_posting_with_fallbacks(
    posting_callable: Callable[..., Any],
    commission: Any,
    actor: Any = None,
) -> Any:
    try:
        return posting_callable(commission=commission, actor=actor)
    except TypeError:
        try:
            return posting_callable(commission=commission)
        except TypeError:
            return posting_callable(commission)


def _call_financial_entry_posting_with_fallbacks(
    posting_callable: Callable[..., Any],
    entry: AgentFinancialEntry,
    actor: Any = None,
) -> Any:
    try:
        return posting_callable(financial_entry=entry, actor=actor)
    except TypeError:
        try:
            return posting_callable(entry=entry, actor=actor)
        except TypeError:
            try:
                return posting_callable(financial_entry=entry)
            except TypeError:
                try:
                    return posting_callable(entry=entry)
                except TypeError:
                    return posting_callable(entry)


def _save_instance(instance: Any, update_fields: list[str]) -> None:
    valid_update_fields = [
        field
        for field in list(dict.fromkeys(update_fields))
        if hasattr(instance, field)
    ]

    if valid_update_fields:
        instance.save(update_fields=valid_update_fields)
    else:
        instance.save()


def _refresh(instance: Any) -> None:
    refresh = getattr(instance, "refresh_from_db", None)
    if callable(refresh):
        refresh()


def _resolve_agent_display_name(agent: Agent) -> str:
    return agent.full_name or agent.agent_code or f"Agent #{agent.pk}"


def _resolve_broker_display_name(broker: Broker | None) -> str:
    if not broker:
        return ""
    return broker.name or broker.broker_code or f"Broker #{broker.pk}"


def _resolve_agent_contact(agent: Agent) -> str:
    return agent.phone or agent.email or ""

# ============================================================
# 🔐 Login User Linking Services
# ============================================================

def _get_user_profile(user: Any) -> Any | None:
    if user is None:
        return None

    profile = getattr(user, "profile", None)

    if profile is not None:
        return profile

    return getattr(user, "userprofile", None)


def _update_profile_extra_data(
    *,
    user: Any,
    entity_type: str,
    entity_id: int,
    extra_keys: dict[str, Any],
) -> Any | None:
    profile = _get_user_profile(user)

    if profile is None:
        return None

    extra_data = getattr(profile, "extra_data", None) or {}
    if not isinstance(extra_data, dict):
        extra_data = {}

    extra_data.update(extra_keys)
    extra_data["entity_type"] = entity_type
    extra_data["entity_id"] = entity_id

    update_fields: list[str] = []

    if hasattr(profile, "extra_data"):
        profile.extra_data = extra_data
        update_fields.append("extra_data")

    if hasattr(profile, "user_type"):
        profile.user_type = entity_type.upper()
        update_fields.append("user_type")

    if hasattr(profile, "updated_at"):
        profile.updated_at = timezone.now()
        update_fields.append("updated_at")

    if update_fields:
        _save_instance(profile, update_fields)

    return profile


def _build_agent_login_defaults(agent: Agent) -> dict[str, str]:
    return {
        "display_name": _resolve_agent_display_name(agent),
        "email": _clean_text(agent.email),
        "phone_number": _clean_text(agent.phone),
        "whatsapp_number": _clean_text(agent.phone),
    }


def _build_broker_login_defaults(broker: Broker) -> dict[str, str]:
    return {
        "display_name": _resolve_broker_display_name(broker),
        "email": _clean_text(broker.email),
        "phone_number": _clean_text(broker.phone),
        "whatsapp_number": _clean_text(broker.phone),
    }


@transaction.atomic
def link_user_to_agent(
    *,
    agent: Agent,
    user: Any,
    actor: Any = None,
    sync_profile: bool = True,
) -> AgentLoginUserResult:
    if not agent:
        raise AgentServiceError("agent is required.")

    if not user:
        raise AgentServiceError("user is required.")

    agent = Agent.objects.select_for_update().get(pk=agent.pk)

    existing_agent = (
        Agent.objects
        .select_for_update()
        .filter(user=user)
        .exclude(pk=agent.pk)
        .first()
    )

    if existing_agent:
        raise AgentServiceError(
            f"هذا المستخدم مرتبط مسبقًا بمندوب آخر: {existing_agent}."
        )

    linked = False

    if agent.user_id != getattr(user, "pk", None):
        agent.user = user

        if actor is not None and getattr(actor, "is_authenticated", False):
            agent.updated_by = actor

        update_fields = ["user"]

        if hasattr(agent, "updated_at"):
            update_fields.append("updated_at")

        if (
            actor is not None
            and getattr(actor, "is_authenticated", False)
            and hasattr(agent, "updated_by_id")
        ):
            update_fields.append("updated_by")

        agent.save(update_fields=update_fields)
        linked = True

    profile = None

    if sync_profile:
        profile = _update_profile_extra_data(
            user=user,
            entity_type="agent",
            entity_id=agent.pk,
            extra_keys={
                "agent_id": agent.pk,
                "agent_code": agent.agent_code,
                "broker_id": agent.broker_id,
            },
        )
    else:
        profile = _get_user_profile(user)

    return AgentLoginUserResult(
        agent=agent,
        user=user,
        profile=profile,
        created=False,
        linked=linked,
        message="تم ربط حساب الدخول بالمندوب بنجاح." if linked else "حساب الدخول مرتبط بالمندوب مسبقًا.",
    )


@transaction.atomic
def link_user_to_broker(
    *,
    broker: Broker,
    user: Any,
    actor: Any = None,
    sync_profile: bool = True,
) -> BrokerLoginUserResult:
    if not broker:
        raise AgentServiceError("broker is required.")

    if not user:
        raise AgentServiceError("user is required.")

    broker = Broker.objects.select_for_update().get(pk=broker.pk)

    existing_broker = (
        Broker.objects
        .select_for_update()
        .filter(user=user)
        .exclude(pk=broker.pk)
        .first()
    )

    if existing_broker:
        raise AgentServiceError(
            f"هذا المستخدم مرتبط مسبقًا بوسيط آخر: {existing_broker}."
        )

    linked = False

    if broker.user_id != getattr(user, "pk", None):
        broker.user = user

        if actor is not None and getattr(actor, "is_authenticated", False):
            broker.updated_by = actor

        update_fields = ["user"]

        if hasattr(broker, "updated_at"):
            update_fields.append("updated_at")

        if (
            actor is not None
            and getattr(actor, "is_authenticated", False)
            and hasattr(broker, "updated_by_id")
        ):
            update_fields.append("updated_by")

        broker.save(update_fields=update_fields)
        linked = True

    profile = None

    if sync_profile:
        profile = _update_profile_extra_data(
            user=user,
            entity_type="broker",
            entity_id=broker.pk,
            extra_keys={
                "broker_id": broker.pk,
                "broker_code": broker.broker_code,
            },
        )
    else:
        profile = _get_user_profile(user)

    return BrokerLoginUserResult(
        broker=broker,
        user=user,
        profile=profile,
        created=False,
        linked=linked,
        message="تم ربط حساب الدخول بالوسيط بنجاح." if linked else "حساب الدخول مرتبط بالوسيط مسبقًا.",
    )


@transaction.atomic
def create_login_user_for_agent(
    *,
    agent: Agent,
    email: str | None = None,
    username: str | None = None,
    password: str | None = None,
    display_name: str | None = None,
    phone_number: str | None = None,
    whatsapp_number: str | None = None,
    actor: Any = None,
    **kwargs: Any,
) -> AgentLoginUserResult:
    if not agent:
        raise AgentServiceError("agent is required.")

    agent = (
        Agent.objects
        .select_for_update()
        .select_related("user", "broker")
        .get(pk=agent.pk)
    )

    if agent.user_id:
        profile = _get_user_profile(agent.user)

        return AgentLoginUserResult(
            agent=agent,
            user=agent.user,
            profile=profile,
            created=False,
            linked=False,
            message="المندوب لديه حساب دخول مرتبط مسبقًا.",
        )

    defaults = _build_agent_login_defaults(agent)

    try:
        from auth_center.services import create_agent_user
    except Exception as exc:
        raise AgentServiceError(
            "تعذر تحميل خدمة إنشاء مستخدم المندوب من auth_center.services."
        ) from exc

    create_kwargs: dict[str, Any] = {
        "agent_id": agent.pk,
        "email": _clean_text(email) or defaults["email"] or None,
        "display_name": _clean_text(display_name) or defaults["display_name"],
        "phone_number": _clean_text(phone_number) or defaults["phone_number"] or None,
        "whatsapp_number": _clean_text(whatsapp_number) or defaults["whatsapp_number"] or None,
        **kwargs,
    }

    if username:
        create_kwargs["username"] = _clean_text(username)

    if password:
        create_kwargs["password"] = password

    auth_result = create_agent_user(**create_kwargs)
    user = getattr(auth_result, "user", None)

    if not user:
        raise AgentServiceError("لم تُرجع خدمة auth_center مستخدمًا صالحًا للمندوب.")

    link_result = link_user_to_agent(
        agent=agent,
        user=user,
        actor=actor,
        sync_profile=True,
    )

    return AgentLoginUserResult(
        agent=link_result.agent,
        user=user,
        profile=link_result.profile or getattr(auth_result, "profile", None),
        created=bool(getattr(auth_result, "created", False)),
        linked=link_result.linked,
        message="تم إنشاء وربط حساب دخول المندوب بنجاح.",
        auth_result=auth_result,
    )


@transaction.atomic
def create_login_user_for_broker(
    *,
    broker: Broker,
    email: str | None = None,
    username: str | None = None,
    password: str | None = None,
    display_name: str | None = None,
    phone_number: str | None = None,
    whatsapp_number: str | None = None,
    actor: Any = None,
    **kwargs: Any,
) -> BrokerLoginUserResult:
    if not broker:
        raise AgentServiceError("broker is required.")

    broker = (
        Broker.objects
        .select_for_update()
        .select_related("user")
        .get(pk=broker.pk)
    )

    if broker.user_id:
        profile = _get_user_profile(broker.user)

        return BrokerLoginUserResult(
            broker=broker,
            user=broker.user,
            profile=profile,
            created=False,
            linked=False,
            message="الوسيط لديه حساب دخول مرتبط مسبقًا.",
        )

    defaults = _build_broker_login_defaults(broker)

    try:
        from auth_center.services import create_broker_user
    except Exception as exc:
        raise AgentServiceError(
            "تعذر تحميل خدمة إنشاء مستخدم الوسيط من auth_center.services."
        ) from exc

    create_kwargs: dict[str, Any] = {
        "broker_id": broker.pk,
        "email": _clean_text(email) or defaults["email"] or None,
        "display_name": _clean_text(display_name) or defaults["display_name"],
        "phone_number": _clean_text(phone_number) or defaults["phone_number"] or None,
        "whatsapp_number": _clean_text(whatsapp_number) or defaults["whatsapp_number"] or None,
        **kwargs,
    }

    if username:
        create_kwargs["username"] = _clean_text(username)

    if password:
        create_kwargs["password"] = password

    auth_result = create_broker_user(**create_kwargs)
    user = getattr(auth_result, "user", None)

    if not user:
        raise AgentServiceError("لم تُرجع خدمة auth_center مستخدمًا صالحًا للوسيط.")

    link_result = link_user_to_broker(
        broker=broker,
        user=user,
        actor=actor,
        sync_profile=True,
    )

    return BrokerLoginUserResult(
        broker=link_result.broker,
        user=user,
        profile=link_result.profile or getattr(auth_result, "profile", None),
        created=bool(getattr(auth_result, "created", False)),
        linked=link_result.linked,
        message="تم إنشاء وربط حساب دخول الوسيط بنجاح.",
        auth_result=auth_result,
    )


def _resolve_commission_identifier(commission: Any) -> str:
    return str(
        _first_non_empty(
            _safe_getattr(commission, "reference"),
            _safe_getattr(commission, "commission_number"),
            _safe_getattr(commission, "number"),
            _safe_getattr(commission, "code"),
            f"COM-{_safe_getattr(commission, 'pk', 'unknown')}",
        )
    )


def _resolve_commission_status(commission: Any) -> str:
    return str(_first_non_empty(_safe_getattr(commission, "commission_status"), COMMISSION_STATUS_PENDING))


def _resolve_commission_amount(commission: Any) -> Decimal:
    candidates = [
        _safe_getattr(commission, "commission_amount"),
        _safe_getattr(commission, "amount"),
        _safe_getattr(commission, "net_amount"),
        _safe_getattr(commission, "value"),
        _safe_getattr(commission, "total_amount"),
    ]

    for value in candidates:
        if value is not None:
            try:
                return _money(value)
            except Exception:
                continue

    return MONEY_ZERO


def _resolve_order_currency(order: Any, default: str = "SAR") -> str:
    return str(
        _first_non_empty(
            _safe_getattr(order, "currency_code"),
            _safe_getattr(order, "currency"),
            default,
        )
    ).upper()


def _resolve_order_number(order: Any) -> str:
    return str(
        _first_non_empty(
            _safe_getattr(order, "order_number"),
            _safe_getattr(order, "number"),
            f"ORD-{_safe_getattr(order, 'pk', 'unknown')}",
        )
    )


def _resolve_order_product_type(order: Any) -> str:
    return str(
        _first_non_empty(
            _safe_getattr(order, "product_type"),
            _safe_getattr(_safe_getattr(order, "product"), "product_type"),
            "",
        )
    ).strip().lower()


def _resolve_order_kind(order: Any) -> str:
    return str(_first_non_empty(_safe_getattr(order, "order_kind"), "")).strip().lower()


def _resolve_order_base_amount(order: Any, base: str | None = None) -> Decimal:
    base = str(base or CalculationBase.NET_BEFORE_TAX).upper()

    if base == CalculationBase.GROSS_AMOUNT:
        return _money(_safe_getattr(order, "total_amount", "0.00"))

    if base == CalculationBase.TOTAL_WITH_TAX:
        return _money(_safe_getattr(order, "total_amount", "0.00"))

    if base == CalculationBase.NET_BEFORE_TAX:
        subtotal = _money(_safe_getattr(order, "subtotal_amount", "0.00"))
        discount = _money(_safe_getattr(order, "discount_amount", "0.00"))
        net = _money(subtotal - discount)
        return net if net > MONEY_ZERO else _money(_safe_getattr(order, "total_amount", "0.00"))

    if base == CalculationBase.PLATFORM_SHARE:
        return _money(_safe_getattr(order, "platform_share_amount", "0.00"))

    if base == CalculationBase.BROKER_SHARE:
        return _money(_safe_getattr(order, "broker_share_amount", "0.00"))

    return _money(_safe_getattr(order, "total_amount", "0.00"))


def _resolve_agent_currency(
    agent_orders_qs: QuerySet[AgentOrder],
    commissions_qs: QuerySet[AgentCommission],
    financial_entries_qs: QuerySet[AgentFinancialEntry] | None = None,
) -> str:
    if financial_entries_qs is not None:
        entry_obj = financial_entries_qs.order_by("-created_at").first()
        if entry_obj and entry_obj.currency:
            return entry_obj.currency

    order_obj = agent_orders_qs.order_by("-created_at").first()
    if order_obj and getattr(_safe_getattr(order_obj, "order"), "currency_code", None):
        return order_obj.order.currency_code

    commission_obj = commissions_qs.order_by("-created_at").first()
    if commission_obj and getattr(_safe_getattr(commission_obj, "payment"), "currency", None):
        return commission_obj.payment.currency

    return "SAR"


def _build_entry_number(
    *,
    prefix: str,
    source_type: str,
    source_id: Any,
    entry_type: str,
    agent_id: Any = None,
    broker_id: Any = None,
) -> str:
    source_type = _clean_code(source_type or "MANUAL")
    entry_type = _clean_code(entry_type or "ENTRY")
    source_id = _clean_code(source_id or "0")
    party = f"A{agent_id}" if agent_id else f"B{broker_id}" if broker_id else "P0"
    return f"{prefix}-{source_type}-{source_id}-{entry_type}-{party}"[:100]


def _entry_remaining_amount(entry: AgentFinancialEntry) -> Decimal:
    remaining = getattr(entry, "remaining_amount", None)

    if remaining is not None:
        try:
            return _positive_money(remaining)
        except Exception:
            pass

    amount = _money(getattr(entry, "amount", "0.00"))
    paid_amount = _money(getattr(entry, "paid_amount", "0.00"))
    remaining_amount = amount - paid_amount
    return remaining_amount if remaining_amount > MONEY_ZERO else MONEY_ZERO


def _entry_paid_amount(entry: AgentFinancialEntry) -> Decimal:
    return _positive_money(getattr(entry, "paid_amount", "0.00"))


def _is_debit_entry(entry: AgentFinancialEntry) -> bool:
    return str(entry.direction).upper() == str(FinancialEntryDirection.DEBIT).upper()


def _is_credit_entry(entry: AgentFinancialEntry) -> bool:
    return str(entry.direction).upper() == str(FinancialEntryDirection.CREDIT).upper()


def _is_settlement_like_entry_type(entry_type: str) -> bool:
    normalized = str(entry_type or "").strip().upper()
    return normalized in {
        "SETTLEMENT",
        "AGENT_SETTLEMENT",
        "BROKER_SETTLEMENT",
        "PAYOUT",
        "PAYMENT",
        "DEDUCTION",
        "ADJUSTMENT",
        "CUSTODY_SETTLEMENT",
        "COMMISSION_PAYOUT",
    }


def _entry_type_value(attr_name: str, fallback: str) -> str:
    return _enum_value(FinancialEntryType, attr_name, fallback)


def _is_commission_accounting_posted(commission: Any) -> bool:
    if hasattr(commission, "is_accounting_posted"):
        return bool(_safe_getattr(commission, "is_accounting_posted", False))

    reference = _first_non_empty(
        _safe_getattr(commission, "accounting_entry_reference"),
        _safe_getattr(commission, "journal_entry_reference"),
        _safe_getattr(commission, "posting_reference"),
    )

    return bool(reference)


def _mark_commission_accounting_posted(commission: Any, result: Any) -> None:
    update_fields: list[str] = []

    reference = _first_non_empty(
        _safe_getattr(result, "entry_number"),
        _safe_getattr(result, "journal_number"),
        _safe_getattr(result, "reference"),
        _safe_getattr(result, "number"),
        _safe_getattr(result, "id"),
    )

    if hasattr(commission, "journal_entry") and result is not None and hasattr(result, "pk"):
        commission.journal_entry = result
        update_fields.append("journal_entry")

    if hasattr(commission, "is_accounting_posted"):
        commission.is_accounting_posted = True
        update_fields.append("is_accounting_posted")

    if reference and hasattr(commission, "accounting_entry_reference"):
        commission.accounting_entry_reference = str(reference)
        update_fields.append("accounting_entry_reference")

    if reference and hasattr(commission, "journal_entry_reference"):
        commission.journal_entry_reference = str(reference)
        update_fields.append("journal_entry_reference")

    if reference and hasattr(commission, "posting_reference"):
        commission.posting_reference = str(reference)
        update_fields.append("posting_reference")

    if hasattr(commission, "posted_at") and not _safe_getattr(commission, "posted_at"):
        commission.posted_at = timezone.now()
        update_fields.append("posted_at")

    if hasattr(commission, "updated_at"):
        commission.updated_at = timezone.now()
        update_fields.append("updated_at")

    if update_fields:
        _save_instance(commission, update_fields)


def _mark_financial_entry_accounting_posted(entry: AgentFinancialEntry, result: Any) -> None:
    update_fields: list[str] = []

    reference = _first_non_empty(
        _safe_getattr(result, "entry_number"),
        _safe_getattr(result, "journal_number"),
        _safe_getattr(result, "reference"),
        _safe_getattr(result, "number"),
        _safe_getattr(result, "id"),
    )

    if hasattr(entry, "journal_entry") and result is not None and hasattr(result, "pk"):
        entry.journal_entry = result
        update_fields.append("journal_entry")

    if hasattr(entry, "is_accounting_posted"):
        entry.is_accounting_posted = True
        update_fields.append("is_accounting_posted")

    if reference and hasattr(entry, "journal_entry_reference"):
        entry.journal_entry_reference = str(reference)
        update_fields.append("journal_entry_reference")

    if hasattr(entry, "posted_at") and not entry.posted_at:
        entry.posted_at = timezone.now()
        update_fields.append("posted_at")

    if hasattr(entry, "updated_at"):
        entry.updated_at = timezone.now()
        update_fields.append("updated_at")

    if update_fields:
        _save_instance(entry, update_fields)


def _load_commission_for_posting(commission_pk: int) -> AgentCommission:
    return (
        AgentCommission.objects.select_related(
            "agent",
            "broker",
            "order",
            "payment",
            "agent_order",
        )
        .get(pk=commission_pk)
    )


# ============================================================
# 📒 Financial Entry Core
# ============================================================

@transaction.atomic
def create_agent_financial_entry(
    *,
    entry_number: str,
    entry_type: str,
    direction: str,
    amount: Decimal | int | float | str,
    agent: Agent | None = None,
    broker: Broker | None = None,
    order: Any | None = None,
    payment: Any | None = None,
    commission: AgentCommission | None = None,
    rule: AgentFinancialRule | None = None,
    status: str = FinancialEntryStatus.PENDING,
    paid_amount: Decimal | int | float | str | None = None,
    currency: str = "SAR",
    description: str = "",
    reference: str = "",
    source_type: str = "",
    source_id: str = "",
    source_number: str = "",
    metadata: dict[str, Any] | None = None,
    actor: Any = None,
    auto_post_accounting: bool = False,
) -> FinancialEntryCreationResult:
    if not entry_number:
        raise AgentFinancialEntryError("entry_number is required.")

    if not agent and not broker:
        raise AgentFinancialEntryError("agent or broker is required.")

    amount = _money(amount)
    paid_amount = _money(paid_amount or MONEY_ZERO)

    if amount <= MONEY_ZERO:
        raise AgentFinancialEntryError("amount must be greater than zero.")

    if paid_amount < MONEY_ZERO:
        raise AgentFinancialEntryError("paid_amount cannot be negative.")

    if paid_amount > amount:
        raise AgentFinancialEntryError("paid_amount cannot exceed amount.")

    if agent and not broker and agent.broker_id:
        broker = agent.broker

    defaults = {
        "agent": agent,
        "broker": broker,
        "order": order,
        "payment": payment,
        "commission": commission,
        "rule": rule,
        "entry_type": entry_type,
        "direction": direction,
        "status": status,
        "amount": amount,
        "paid_amount": paid_amount,
        "currency": str(currency or "SAR").upper(),
        "description": _clean_text(description),
        "reference": _clean_text(reference),
        "source_type": _clean_text(source_type).lower(),
        "source_id": _clean_text(source_id),
        "source_number": _clean_text(source_number),
        "metadata": metadata or {},
    }

    if actor is not None and getattr(actor, "is_authenticated", False):
        defaults["created_by"] = actor
        defaults["updated_by"] = actor

    entry, created = AgentFinancialEntry.objects.get_or_create(
        entry_number=_clean_code(entry_number),
        defaults=defaults,
    )

    if not created:
        protected_statuses = {
            FinancialEntryStatus.SETTLED,
            FinancialEntryStatus.PAID,
            FinancialEntryStatus.CANCELLED,
            FinancialEntryStatus.REVERSED,
        }

        if entry.status not in protected_statuses and not entry.is_accounting_posted:
            for field_name, value in defaults.items():
                setattr(entry, field_name, value)

            if actor is not None and getattr(actor, "is_authenticated", False):
                entry.updated_by = actor

            entry.save()

    if auto_post_accounting:
        post_financial_entry_to_accounting(entry, actor=actor)

    return FinancialEntryCreationResult(entry=entry, created=created)


def approve_financial_entry(
    entry: AgentFinancialEntry,
    *,
    actor: Any = None,
    auto_post_accounting: bool = False,
) -> AgentFinancialEntry:
    if not entry:
        raise AgentFinancialEntryError("entry is required.")

    entry = AgentFinancialEntry.objects.select_for_update().get(pk=entry.pk)

    if entry.status in {
        FinancialEntryStatus.CANCELLED,
        FinancialEntryStatus.REVERSED,
    }:
        raise AgentFinancialEntryError("لا يمكن اعتماد سجل مالي ملغي أو معكوس.")

    if entry.status not in {
        FinancialEntryStatus.APPROVED,
        FinancialEntryStatus.SETTLED,
        FinancialEntryStatus.PAID,
    }:
        entry.status = FinancialEntryStatus.APPROVED
        entry.approved_at = entry.approved_at or timezone.now()
        entry.earned_at = entry.earned_at or timezone.now()

    if actor is not None and getattr(actor, "is_authenticated", False):
        entry.updated_by = actor

    entry.save()

    if auto_post_accounting:
        post_financial_entry_to_accounting(entry, actor=actor)

    return entry


def mark_financial_entry_paid(
    entry: AgentFinancialEntry,
    *,
    paid_amount: Decimal | int | float | str | None = None,
    actor: Any = None,
    paid_at: datetime | None = None,
) -> AgentFinancialEntry:
    if not entry:
        raise AgentFinancialEntryError("entry is required.")

    entry = AgentFinancialEntry.objects.select_for_update().get(pk=entry.pk)

    amount = _money(paid_amount if paid_amount is not None else entry.amount)

    if amount <= MONEY_ZERO:
        raise AgentFinancialEntryError("مبلغ الدفع يجب أن يكون أكبر من صفر.")

    current_paid = _money(entry.paid_amount)
    new_paid = _money(current_paid + amount)

    if new_paid > entry.amount:
        raise AgentFinancialEntryError("إجمالي المسدد لا يمكن أن يتجاوز مبلغ السجل.")

    entry.paid_amount = new_paid

    if entry.paid_amount >= entry.amount:
        entry.status = FinancialEntryStatus.PAID
        entry.paid_at = paid_at or timezone.now()
    elif entry.status not in {
        FinancialEntryStatus.APPROVED,
        FinancialEntryStatus.SETTLED,
        FinancialEntryStatus.PAID,
    }:
        entry.status = FinancialEntryStatus.APPROVED
        entry.approved_at = entry.approved_at or timezone.now()

    if actor is not None and getattr(actor, "is_authenticated", False):
        entry.updated_by = actor

    entry.save()
    return entry


@transaction.atomic
def settle_financial_entry(
    entry: AgentFinancialEntry,
    *,
    amount: Decimal | int | float | str | None = None,
    actor: Any = None,
    paid_at: datetime | None = None,
    notes: str = "",
) -> FinancialEntrySettlementResult:
    if not entry:
        raise AgentFinancialEntryError("entry is required.")

    entry = AgentFinancialEntry.objects.select_for_update().get(pk=entry.pk)

    status_before = entry.status
    paid_before = _money(entry.paid_amount)
    remaining_before = _entry_remaining_amount(entry)

    if entry.status in {
        FinancialEntryStatus.CANCELLED,
        FinancialEntryStatus.REVERSED,
    }:
        raise AgentFinancialEntryError("لا يمكن تسوية سجل مالي ملغي أو معكوس.")

    settlement_amount = _money(amount if amount is not None else remaining_before)

    if settlement_amount <= MONEY_ZERO:
        raise AgentFinancialEntryError("مبلغ التسوية يجب أن يكون أكبر من صفر.")

    if settlement_amount > remaining_before:
        raise AgentFinancialEntryError("مبلغ التسوية لا يمكن أن يتجاوز المتبقي من السجل.")

    entry.paid_amount = _money(paid_before + settlement_amount)

    if entry.paid_amount >= entry.amount:
        entry.status = FinancialEntryStatus.PAID
        entry.paid_at = paid_at or timezone.now()
        if hasattr(FinancialEntryStatus, "SETTLED"):
            entry.status = FinancialEntryStatus.SETTLED
            entry.settled_at = getattr(entry, "settled_at", None) or timezone.now()
    else:
        entry.status = FinancialEntryStatus.APPROVED
        entry.approved_at = entry.approved_at or timezone.now()

    if notes:
        metadata = entry.metadata or {}
        metadata.setdefault("settlements", [])
        metadata["settlements"].append(
            {
                "amount": str(settlement_amount),
                "paid_before": str(paid_before),
                "paid_after": str(entry.paid_amount),
                "notes": notes,
                "settled_at": (paid_at or timezone.now()).isoformat(),
                "actor_id": getattr(actor, "pk", None) if actor is not None else None,
            }
        )
        entry.metadata = metadata

    if actor is not None and getattr(actor, "is_authenticated", False):
        entry.updated_by = actor

    entry.save()

    return FinancialEntrySettlementResult(
        entry=entry,
        status_before=status_before,
        status_after=entry.status,
        paid_before=paid_before,
        paid_after=_money(entry.paid_amount),
        paid_delta=settlement_amount,
        remaining_amount=_entry_remaining_amount(entry),
    )


def post_financial_entry_to_accounting(
    entry: AgentFinancialEntry,
    *,
    actor: Any = None,
) -> tuple[bool, str]:
    if entry is None:
        raise AgentFinancialEntryError("entry is required for accounting posting.")

    _refresh(entry)

    if entry.is_accounting_posted or entry.journal_entry_id or entry.journal_entry_reference:
        message = f"تم تجاوز الترحيل لأن السجل المالي {entry.entry_number} مرحل مسبقًا."
        logger.info(message)
        return True, message

    if entry.status not in {
        FinancialEntryStatus.APPROVED,
        FinancialEntryStatus.EARNED,
        FinancialEntryStatus.SETTLED,
        FinancialEntryStatus.PAID,
    }:
        message = f"لا يمكن ترحيل السجل المالي {entry.entry_number} لأنه غير معتمد."
        logger.warning(message)
        return False, message

    posting_callable = _resolve_import_callable(CANDIDATE_FINANCIAL_ENTRY_POSTING_TARGETS)

    if posting_callable is None:
        message = "لم يتم العثور على دالة ترحيل محاسبي للسجلات المالية."
        logger.warning("Financial entry %s: %s", entry.entry_number, message)
        return False, message

    try:
        result = _call_financial_entry_posting_with_fallbacks(
            posting_callable,
            entry=entry,
            actor=actor,
        )

        _refresh(entry)

        if not entry.is_accounting_posted:
            _mark_financial_entry_accounting_posted(entry, result)

        message = f"تم ترحيل السجل المالي {entry.entry_number} محاسبيًا بنجاح."
        logger.info(message)
        return True, message

    except Exception as exc:
        logger.exception("❌ فشل ترحيل السجل المالي %s: %s", entry.entry_number, exc)
        raise AgentFinancialEntryError(
            f"فشل ترحيل السجل المالي {entry.entry_number}: {exc}"
        ) from exc
    
    # ============================================================
# 🧮 Financial Rules
# ============================================================

def _rule_matches_order(rule: AgentFinancialRule, order: Any) -> bool:
    if not rule.is_active:
        return False

    today = timezone.localdate()

    if rule.valid_from and rule.valid_from > today:
        return False

    if rule.valid_until and rule.valid_until < today:
        return False

    if rule.scope == FinancialRuleScope.GLOBAL:
        return True

    if rule.scope == FinancialRuleScope.PRODUCT:
        return bool(rule.product_id and rule.product_id == _safe_getattr(order, "product_id"))

    if rule.scope == FinancialRuleScope.PRODUCT_TYPE:
        return bool(rule.product_type and rule.product_type == _resolve_order_product_type(order))

    if rule.scope == FinancialRuleScope.CONTRACT:
        return bool(rule.contract_id and rule.contract_id == _safe_getattr(order, "contract_id"))

    if rule.scope == FinancialRuleScope.CONTRACT_PRODUCT:
        return bool(rule.contract_product_id and rule.contract_product_id == _safe_getattr(order, "contract_product_id"))

    if rule.scope == FinancialRuleScope.PROVIDER:
        return bool(rule.provider_id and rule.provider_id == _safe_getattr(order, "provider_id"))

    if rule.scope == FinancialRuleScope.ORDER_KIND:
        return bool(rule.order_kind and rule.order_kind == _resolve_order_kind(order))

    return False


def get_applicable_financial_rules(
    *,
    order: Any,
    rule_type: str,
    agent: Agent | None = None,
    broker: Broker | None = None,
) -> QuerySet[AgentFinancialRule]:
    queryset = AgentFinancialRule.objects.filter(
        rule_type=rule_type,
        is_active=True,
    )

    party_filter = Q(agent__isnull=True, broker__isnull=True)

    if broker:
        party_filter |= Q(broker=broker, agent__isnull=True)

    if agent:
        party_filter |= Q(agent=agent)

    queryset = queryset.filter(party_filter).order_by("priority", "-created_at", "-id")

    rule_ids = [
        rule.pk
        for rule in queryset
        if _rule_matches_order(rule, order)
    ]

    return AgentFinancialRule.objects.filter(pk__in=rule_ids).order_by("priority", "-created_at", "-id")


def resolve_best_financial_rule(
    *,
    order: Any,
    rule_type: str,
    agent: Agent | None = None,
    broker: Broker | None = None,
) -> AgentFinancialRule | None:
    return get_applicable_financial_rules(
        order=order,
        rule_type=rule_type,
        agent=agent,
        broker=broker,
    ).first()


def calculate_rule_amount(
    *,
    rule: AgentFinancialRule,
    order: Any,
    fallback_base_amount: Decimal | int | float | str | None = None,
) -> Decimal:
    base_amount = (
        _money(fallback_base_amount)
        if fallback_base_amount is not None
        else _resolve_order_base_amount(order, rule.calculation_base)
    )
    return rule.calculate_amount(base_amount)


# ============================================================
# 🔗 إنشاء ربط الطلب بالمندوب
# ============================================================

@transaction.atomic
def create_agent_order(
    *,
    order: Any,
    agent: Agent,
    customer: Any | None = None,
    sales_amount: Decimal | int | float | str | None = None,
    commission_type: str | None = None,
    commission_value: Decimal | int | float | str | None = None,
    referral_code_used: str = "",
    notes: str = "",
    create_commission: bool = True,
    create_financial_entry: bool = True,
) -> AgentOrderCreationResult:
    if not order:
        raise CommissionValidationError("order is required.")

    if not agent:
        raise CommissionValidationError("agent is required.")

    if agent.status != AgentStatus.ACTIVE:
        raise CommissionValidationError("لا يمكن ربط الطلب بمندوب غير نشط.")

    broker = agent.broker if agent.broker_id else None

    if broker and broker.status != BrokerStatus.ACTIVE:
        raise CommissionValidationError("لا يمكن ربط الطلب بوسيط غير نشط.")

    resolved_customer = customer or getattr(order, "customer", None)
    if not resolved_customer:
        raise CommissionValidationError("لا يمكن تحديد العميل المرتبط بالطلب.")

    resolved_sales_amount = _money(
        _first_non_empty(
            sales_amount,
            getattr(order, "total_amount", None),
            getattr(order, "grand_total", None),
            getattr(order, "net_amount", None),
            getattr(order, "amount", None),
            "0.00",
        )
    )

    agent_order, _created = AgentOrder.objects.update_or_create(
        order=order,
        defaults={
            "agent": agent,
            "broker": broker,
            "customer": resolved_customer,
            "commission_type": commission_type or agent.default_commission_type,
            "commission_value": _money(
                commission_value
                if commission_value is not None
                else agent.default_commission_value
            ),
            "sales_amount": resolved_sales_amount,
            "referral_code_used": referral_code_used or agent.referral_code,
            "notes": notes,
            "metadata": {
                "source": "create_agent_order",
                "order_number": _resolve_order_number(order),
                "broker_id": broker.pk if broker else None,
            },
        },
    )

    commission = None
    commission_created = False

    if create_commission:
        commission, commission_created = create_commission_from_agent_order(
            agent_order=agent_order,
        )

        if create_financial_entry and commission:
            create_sales_commission_financial_entry_from_commission(
                commission=commission,
                status=FinancialEntryStatus.PENDING,
            )

    return AgentOrderCreationResult(
        agent_order=agent_order,
        commission=commission,
        commission_created=commission_created,
    )


@transaction.atomic
def create_commission_from_agent_order(
    *,
    agent_order: AgentOrder,
    payment: Any | None = None,
    status: str = COMMISSION_STATUS_PENDING,
    notes: str = "",
) -> tuple[AgentCommission, bool]:
    if not agent_order:
        raise CommissionValidationError("agent_order is required.")

    agent_order.recalculate_commission_amount()
    agent_order.save()

    commission, created = AgentCommission.objects.update_or_create(
        agent_order=agent_order,
        defaults={
            "agent": agent_order.agent,
            "broker": agent_order.broker,
            "order": agent_order.order,
            "payment": payment,
            "commission_status": status,
            "base_amount": _money(agent_order.sales_amount),
            "commission_amount": _money(agent_order.commission_amount),
            "notes": notes,
            "metadata": {
                "source": "create_commission_from_agent_order",
                "agent_order_id": agent_order.pk,
                "broker_id": agent_order.broker_id,
            },
        },
    )

    return commission, created


def create_sales_commission_financial_entry_from_commission(
    *,
    commission: AgentCommission,
    status: str = FinancialEntryStatus.PENDING,
) -> FinancialEntryCreationResult:
    if not commission:
        raise AgentFinancialEntryError("commission is required.")

    entry_number = _build_entry_number(
        prefix="AFE",
        source_type="commission",
        source_id=commission.pk,
        entry_type=FinancialEntryType.SALES_COMMISSION,
        agent_id=commission.agent_id,
        broker_id=commission.broker_id,
    )

    return create_agent_financial_entry(
        entry_number=entry_number,
        entry_type=FinancialEntryType.SALES_COMMISSION,
        direction=FinancialEntryDirection.CREDIT,
        amount=commission.commission_amount,
        agent=commission.agent,
        broker=commission.broker,
        order=commission.order,
        payment=commission.payment,
        commission=commission,
        status=status,
        currency=_resolve_order_currency(commission.order),
        description=f"عمولة بيع للطلب {_resolve_order_number(commission.order)}",
        reference=_resolve_commission_identifier(commission),
        source_type="commission",
        source_id=str(commission.pk),
        source_number=_resolve_commission_identifier(commission),
        metadata={
            "agent_order_id": commission.agent_order_id,
            "base_amount": str(_money(commission.base_amount)),
            "commission_amount": str(_money(commission.commission_amount)),
        },
    )


# ============================================================
# ✅ التحقق قبل الاعتماد
# ============================================================

def validate_commission_for_approval(commission: Any) -> None:
    if commission is None:
        raise CommissionValidationError("لم يتم تمرير عمولة صالحة.")

    commission_id = _resolve_commission_identifier(commission)
    status = _resolve_commission_status(commission)
    amount = _resolve_commission_amount(commission)

    if status in {COMMISSION_STATUS_CANCELLED, COMMISSION_STATUS_REVERSED}:
        raise CommissionValidationError(
            f"لا يمكن اعتماد العمولة {commission_id} لأن حالتها الحالية هي {status}."
        )

    if status == COMMISSION_STATUS_PAID:
        raise CommissionValidationError(
            f"لا يمكن إعادة اعتماد العمولة {commission_id} لأنها مدفوعة."
        )

    if amount <= MONEY_ZERO:
        raise CommissionValidationError(
            f"لا يمكن اعتماد العمولة {commission_id} لأن مبلغها غير صالح: {amount}."
        )

    try:
        commission.full_clean()
    except ValidationError as exc:
        raise CommissionValidationError(f"فشل التحقق من العمولة قبل الاعتماد: {exc}") from exc


def _should_force_approved_status(status_before: str) -> bool:
    return status_before not in FINAL_COMMISSION_STATUSES


def _prepare_commission_approval_fields(commission: Any, status_before: str) -> list[str]:
    changed_fields: list[str] = []
    now = timezone.now()

    if hasattr(commission, "commission_status") and _should_force_approved_status(status_before):
        if _resolve_commission_status(commission) != COMMISSION_STATUS_APPROVED:
            commission.commission_status = COMMISSION_STATUS_APPROVED
            changed_fields.append("commission_status")

    if hasattr(commission, "earned_at") and not getattr(commission, "earned_at"):
        commission.earned_at = now
        changed_fields.append("earned_at")

    if hasattr(commission, "approved_at") and not getattr(commission, "approved_at"):
        commission.approved_at = now
        changed_fields.append("approved_at")

    if hasattr(commission, "updated_at"):
        commission.updated_at = now
        changed_fields.append("updated_at")

    return list(dict.fromkeys(changed_fields))


def _enforce_post_save_status(commission: Any, status_before: str) -> None:
    if not hasattr(commission, "commission_status"):
        return

    expected_status = (
        COMMISSION_STATUS_APPROVED
        if _should_force_approved_status(status_before)
        else status_before
    )
    current_status = _resolve_commission_status(commission)

    if current_status != expected_status:
        logger.warning(
            "⚠️ تم اكتشاف تغيير غير متوقع في حالة العمولة %s بعد الحفظ: %s -> %s. سيتم تثبيت الحالة الصحيحة %s.",
            _resolve_commission_identifier(commission),
            status_before,
            current_status,
            expected_status,
        )
        commission.commission_status = expected_status
        _save_instance(commission, ["commission_status", "updated_at"])
        _refresh(commission)


# ============================================================
# 📘 الترحيل المحاسبي للعمولة القديمة
# ============================================================

def dispatch_commission_accounting_post(
    commission: Any,
    actor: Any = None,
) -> tuple[bool, str]:
    if commission is None:
        raise CommissionPostingError("commission is required for accounting posting.")

    _refresh(commission)

    commission_id = _resolve_commission_identifier(commission)
    status = _resolve_commission_status(commission)

    if _is_commission_accounting_posted(commission):
        message = f"تم تجاوز الترحيل المحاسبي لأن العمولة {commission_id} مرحلة محاسبيًا مسبقًا."
        logger.info(message)
        return True, message

    if status not in POSTABLE_COMMISSION_STATUSES:
        message = f"لا يمكن ترحيل العمولة {commission_id} محاسبيًا لأنها غير معتمدة."
        logger.warning(message)
        return False, message

    posting_callable = _resolve_import_callable(CANDIDATE_COMMISSION_POSTING_TARGETS)

    if posting_callable is None:
        message = (
            "لم يتم العثور على دالة ترحيل محاسبي لاستحقاق العمولة. "
            "تحقق من ربط accounting.services.post_agent_commission_accrual."
        )
        logger.warning("Commission %s: %s", commission_id, message)
        return False, message

    try:
        result = _call_commission_posting_with_fallbacks(
            posting_callable,
            commission=commission,
            actor=actor,
        )

        _refresh(commission)

        if not _is_commission_accounting_posted(commission):
            _mark_commission_accounting_posted(commission, result)

        try:
            financial_result = create_sales_commission_financial_entry_from_commission(
                commission=commission,
                status=FinancialEntryStatus.APPROVED,
            )
            financial_entry = financial_result.entry

            if hasattr(result, "pk"):
                financial_entry.journal_entry = result

            if hasattr(result, "entry_number"):
                financial_entry.journal_entry_reference = result.entry_number

            financial_entry.is_accounting_posted = True
            financial_entry.posted_at = financial_entry.posted_at or timezone.now()
            financial_entry.save()
        except Exception as entry_exc:
            logger.warning(
                "تعذر مزامنة السجل المالي للعمولة %s بعد الترحيل: %s",
                commission_id,
                entry_exc,
            )

        message = f"تم إطلاق قيد استحقاق العمولة بنجاح للعمولة {commission_id}."
        logger.info(message)
        return True, message

    except Exception as exc:
        logger.exception("❌ فشل الترحيل المحاسبي لاستحقاق العمولة %s: %s", commission_id, exc)
        raise CommissionPostingError(
            f"فشل الترحيل المحاسبي لاستحقاق العمولة {commission_id}: {exc}"
        ) from exc


# ============================================================
# 🚀 الخدمة الرسمية: اعتماد العمولة
# ============================================================

@transaction.atomic
def approve_commission(
    commission: Any,
    *,
    actor: Any = None,
    auto_post_accounting: bool = True,
) -> CommissionApprovalResult:
    if commission is None:
        raise CommissionValidationError("commission is required.")

    commission = AgentCommission.objects.select_for_update().get(pk=commission.pk)

    commission_id = _resolve_commission_identifier(commission)
    status_before = _resolve_commission_status(commission)

    logger.info("🚀 بدء اعتماد العمولة %s | status_before=%s", commission_id, status_before)

    validate_commission_for_approval(commission)

    for method_name in ("recalculate", "recalculate_totals", "refresh_from_source"):
        try:
            _call_if_exists(commission, method_name)
        except Exception as exc:
            logger.warning("تعذر تنفيذ %s للعمولة %s: %s", method_name, commission_id, exc)

    changed_fields = _prepare_commission_approval_fields(
        commission,
        status_before=status_before,
    )

    _save_instance(commission, changed_fields)
    _refresh(commission)
    _enforce_post_save_status(commission, status_before=status_before)
    _refresh(commission)

    try:
        create_sales_commission_financial_entry_from_commission(
            commission=commission,
            status=FinancialEntryStatus.APPROVED,
        )
    except Exception as exc:
        logger.warning("تعذر إنشاء/اعتماد السجل المالي للعمولة %s: %s", commission_id, exc)

    accounting_post_dispatched = False
    accounting_post_message = "لم يُطلب الترحيل المحاسبي."

    if auto_post_accounting:
        commission_pk = commission.pk

        def _post_accounting_after_commit(commission_id_for_callback: int = commission_pk) -> None:
            fresh_commission = _load_commission_for_posting(commission_id_for_callback)
            dispatch_commission_accounting_post(
                commission=fresh_commission,
                actor=actor,
            )

        transaction.on_commit(_post_accounting_after_commit)
        accounting_post_message = "تمت جدولة قيد استحقاق العمولة بعد نجاح commit."
    else:
        accounting_post_message = "تم اعتماد العمولة بدون ترحيل محاسبي تلقائي."

    _refresh(commission)
    status_after = _resolve_commission_status(commission)

    logger.info(
        "✅ تم اعتماد العمولة %s | status_after=%s | accounting=%s",
        commission_id,
        status_after,
        auto_post_accounting,
    )

    return CommissionApprovalResult(
        commission=commission,
        status_before=status_before,
        status_after=status_after,
        accounting_post_requested=auto_post_accounting,
        accounting_post_dispatched=accounting_post_dispatched,
        accounting_post_message=accounting_post_message,
    )


# ============================================================
# 💵 صرف العمولة القديمة
# ============================================================

@transaction.atomic
def mark_commission_paid(
    commission: AgentCommission,
    *,
    paid_amount: Decimal | int | float | str | None = None,
    payment: Any | None = None,
    actor: Any = None,
    paid_at: datetime | None = None,
) -> AgentCommission:
    if commission is None:
        raise CommissionValidationError("commission is required.")

    commission = AgentCommission.objects.select_for_update().get(pk=commission.pk)

    if commission.commission_status not in {
        COMMISSION_STATUS_APPROVED,
        COMMISSION_STATUS_EARNED,
        COMMISSION_STATUS_PENDING,
    }:
        raise CommissionValidationError(
            f"لا يمكن صرف العمولة بحالتها الحالية: {commission.commission_status}"
        )

    amount = _money(paid_amount if paid_amount is not None else commission.commission_amount)

    if amount <= MONEY_ZERO:
        raise CommissionValidationError("مبلغ الصرف يجب أن يكون أكبر من صفر.")

    if amount > _money(commission.commission_amount):
        raise CommissionValidationError("مبلغ الصرف لا يمكن أن يتجاوز قيمة العمولة.")

    commission.paid_amount = amount
    commission.commission_status = COMMISSION_STATUS_PAID
    commission.paid_at = paid_at or timezone.now()

    if payment is not None:
        commission.payment = payment

    update_fields = [
        "paid_amount",
        "commission_status",
        "paid_at",
        "payment",
        "updated_at",
    ]
    _save_instance(commission, update_fields)
    _refresh(commission)

    try:
        result = create_sales_commission_financial_entry_from_commission(
            commission=commission,
            status=FinancialEntryStatus.PAID,
        )
        result.entry.paid_amount = amount
        result.entry.status = FinancialEntryStatus.PAID
        result.entry.paid_at = commission.paid_at
        if actor is not None and getattr(actor, "is_authenticated", False):
            result.entry.updated_by = actor
        result.entry.save()
    except Exception as exc:
        logger.warning("تعذر تحديث السجل المالي لصرف العمولة %s: %s", commission.pk, exc)

    logger.info("✅ تم تعليم العمولة %s كمدفوعة بواسطة %s", _resolve_commission_identifier(commission), actor)

    return commission


def repost_commission_accounting(
    commission: Any,
    *,
    actor: Any = None,
) -> tuple[bool, str]:
    if commission is None:
        raise CommissionValidationError("commission is required for reposting.")

    commission_id = _resolve_commission_identifier(commission)
    logger.info("🔁 إعادة ترحيل محاسبي لاستحقاق العمولة %s", commission_id)

    return dispatch_commission_accounting_post(
        commission=commission,
        actor=actor,
    )


# ============================================================
# 🧮 إنشاء السجلات المالية من الطلب
# ============================================================

def create_sales_commission_entry_for_order(
    *,
    order: Any,
    agent: Agent,
    actor: Any = None,
) -> AgentFinancialEntry | None:
    if not order or not agent:
        return None

    broker = agent.broker if agent.broker_id else None
    rule = resolve_best_financial_rule(
        order=order,
        rule_type=FinancialRuleType.SALES_COMMISSION,
        agent=agent,
        broker=broker,
    )

    if rule:
        amount = calculate_rule_amount(rule=rule, order=order)
    else:
        base = _resolve_order_base_amount(order, CalculationBase.NET_BEFORE_TAX)
        if agent.default_commission_type == "PERCENTAGE":
            amount = _money(base * _money(agent.default_commission_value) / Decimal("100.00"))
        else:
            amount = _money(agent.default_commission_value)

    if amount <= MONEY_ZERO:
        return None

    entry_number = _build_entry_number(
        prefix="AFE",
        source_type="order",
        source_id=_safe_getattr(order, "pk"),
        entry_type=FinancialEntryType.SALES_COMMISSION,
        agent_id=agent.pk,
        broker_id=broker.pk if broker else None,
    )

    result = create_agent_financial_entry(
        entry_number=entry_number,
        entry_type=FinancialEntryType.SALES_COMMISSION,
        direction=FinancialEntryDirection.CREDIT,
        amount=amount,
        agent=agent,
        broker=broker,
        order=order,
        rule=rule,
        status=FinancialEntryStatus.EARNED,
        currency=_resolve_order_currency(order),
        description=f"عمولة بيع للطلب {_resolve_order_number(order)}",
        reference=_resolve_order_number(order),
        source_type="order",
        source_id=str(_safe_getattr(order, "pk", "")),
        source_number=_resolve_order_number(order),
        metadata={
            "rule_id": rule.pk if rule else None,
            "base_amount": str(_resolve_order_base_amount(order, rule.calculation_base if rule else CalculationBase.NET_BEFORE_TAX)),
            "agent_id": agent.pk,
            "broker_id": broker.pk if broker else None,
        },
        actor=actor,
    )

    return result.entry


def create_delivery_fee_entry_for_order(
    *,
    order: Any,
    delivery_agent: Agent,
    actor: Any = None,
) -> AgentFinancialEntry | None:
    if not order or not delivery_agent:
        return None

    broker = delivery_agent.broker if delivery_agent.broker_id else None
    rule = resolve_best_financial_rule(
        order=order,
        rule_type=FinancialRuleType.DELIVERY_FEE,
        agent=delivery_agent,
        broker=broker,
    )

    if rule:
        amount = calculate_rule_amount(rule=rule, order=order)
    else:
        amount = _money(delivery_agent.default_delivery_fee)

    if amount <= MONEY_ZERO:
        return None

    entry_number = _build_entry_number(
        prefix="AFE",
        source_type="order",
        source_id=_safe_getattr(order, "pk"),
        entry_type=FinancialEntryType.DELIVERY_FEE,
        agent_id=delivery_agent.pk,
        broker_id=broker.pk if broker else None,
    )

    result = create_agent_financial_entry(
        entry_number=entry_number,
        entry_type=FinancialEntryType.DELIVERY_FEE,
        direction=FinancialEntryDirection.CREDIT,
        amount=amount,
        agent=delivery_agent,
        broker=broker,
        order=order,
        rule=rule,
        status=FinancialEntryStatus.EARNED,
        currency=_resolve_order_currency(order),
        description=f"قيمة توصيل للطلب {_resolve_order_number(order)}",
        reference=_resolve_order_number(order),
        source_type="order",
        source_id=str(_safe_getattr(order, "pk", "")),
        source_number=_resolve_order_number(order),
        metadata={
            "rule_id": rule.pk if rule else None,
            "delivery_agent_id": delivery_agent.pk,
            "broker_id": broker.pk if broker else None,
        },
        actor=actor,
    )

    return result.entry


def create_broker_share_entry_for_order(
    *,
    order: Any,
    broker: Broker,
    actor: Any = None,
) -> AgentFinancialEntry | None:
    if not order or not broker:
        return None

    rule = resolve_best_financial_rule(
        order=order,
        rule_type=FinancialRuleType.BROKER_SHARE,
        broker=broker,
    )

    if rule:
        amount = calculate_rule_amount(rule=rule, order=order)
    else:
        base = _resolve_order_base_amount(order, CalculationBase.NET_BEFORE_TAX)
        if broker.default_commission_type == "PERCENTAGE":
            amount = _money(base * _money(broker.default_commission_value) / Decimal("100.00"))
        else:
            amount = _money(broker.default_commission_value)

    if amount <= MONEY_ZERO:
        return None

    entry_number = _build_entry_number(
        prefix="BFE",
        source_type="order",
        source_id=_safe_getattr(order, "pk"),
        entry_type=FinancialEntryType.BROKER_SHARE,
        broker_id=broker.pk,
    )

    result = create_agent_financial_entry(
        entry_number=entry_number,
        entry_type=FinancialEntryType.BROKER_SHARE,
        direction=FinancialEntryDirection.CREDIT,
        amount=amount,
        broker=broker,
        order=order,
        rule=rule,
        status=FinancialEntryStatus.EARNED,
        currency=_resolve_order_currency(order),
        description=f"حصة وسيط للطلب {_resolve_order_number(order)}",
        reference=_resolve_order_number(order),
        source_type="order",
        source_id=str(_safe_getattr(order, "pk", "")),
        source_number=_resolve_order_number(order),
        metadata={
            "rule_id": rule.pk if rule else None,
            "broker_id": broker.pk,
        },
        actor=actor,
    )

    return result.entry


def create_cod_custody_entry_for_order(
    *,
    order: Any,
    collector_agent: Agent | None = None,
    collector_broker: Broker | None = None,
    amount: Any | None = None,
    actor: Any = None,
) -> AgentFinancialEntry | None:
    if not order:
        return None

    collected_amount = _money(
        _first_non_empty(
            amount,
            _safe_getattr(order, "cash_collected_amount"),
            _safe_getattr(order, "total_amount"),
            "0.00",
        )
    )

    if collected_amount <= MONEY_ZERO:
        return None

    agent = collector_agent
    broker = collector_broker

    if not agent and not broker:
        agent = _safe_getattr(order, "delivery_agent", None) or _safe_getattr(order, "agent", None)

    if agent and not broker and agent.broker_id:
        broker = agent.broker

    if not agent and not broker:
        return None

    party_agent_id = agent.pk if agent else None
    party_broker_id = broker.pk if broker and not agent else broker.pk if broker else None

    entry_number = _build_entry_number(
        prefix="AFE",
        source_type="cod",
        source_id=_safe_getattr(order, "pk"),
        entry_type=FinancialEntryType.COD_CUSTODY,
        agent_id=party_agent_id,
        broker_id=party_broker_id,
    )

    result = create_agent_financial_entry(
        entry_number=entry_number,
        entry_type=FinancialEntryType.COD_CUSTODY,
        direction=FinancialEntryDirection.DEBIT,
        amount=collected_amount,
        agent=agent,
        broker=broker,
        order=order,
        status=FinancialEntryStatus.EARNED,
        currency=_resolve_order_currency(order),
        description=f"عهدة تحصيل COD للطلب {_resolve_order_number(order)}",
        reference=_resolve_order_number(order),
        source_type="order_cod",
        source_id=str(_safe_getattr(order, "pk", "")),
        source_number=_resolve_order_number(order),
        metadata={
            "cash_collected_amount": str(collected_amount),
            "collector_agent_id": agent.pk if agent else None,
            "collector_broker_id": broker.pk if broker else None,
        },
        actor=actor,
    )

    return result.entry


@transaction.atomic
def create_order_financial_entries(
    *,
    order: Any,
    actor: Any = None,
    include_sales_commission: bool = True,
    include_delivery_fee: bool = True,
    include_broker_share: bool = True,
    include_cod_custody: bool = True,
    auto_post_accounting: bool = False,
) -> list[AgentFinancialEntry]:
    if not order:
        raise AgentFinancialEntryError("order is required.")

    entries: list[AgentFinancialEntry] = []

    sales_agent = _safe_getattr(order, "agent", None)
    delivery_agent = _safe_getattr(order, "delivery_agent", None)

    if include_sales_commission and sales_agent:
        entry = create_sales_commission_entry_for_order(
            order=order,
            agent=sales_agent,
            actor=actor,
        )
        if entry:
            entries.append(entry)

    if include_delivery_fee and delivery_agent:
        entry = create_delivery_fee_entry_for_order(
            order=order,
            delivery_agent=delivery_agent,
            actor=actor,
        )
        if entry:
            entries.append(entry)

    broker = None
    if sales_agent and sales_agent.broker_id:
        broker = sales_agent.broker
    elif delivery_agent and delivery_agent.broker_id:
        broker = delivery_agent.broker

    if include_broker_share and broker:
        entry = create_broker_share_entry_for_order(
            order=order,
            broker=broker,
            actor=actor,
        )
        if entry:
            entries.append(entry)

    is_cod = bool(_safe_getattr(order, "is_cash_on_delivery", False))
    cash_collected_amount = _money(_safe_getattr(order, "cash_collected_amount", "0.00"))

    if include_cod_custody and is_cod and cash_collected_amount > MONEY_ZERO:
        collector_agent = delivery_agent or sales_agent
        entry = create_cod_custody_entry_for_order(
            order=order,
            collector_agent=collector_agent,
            amount=cash_collected_amount,
            actor=actor,
        )
        if entry:
            entries.append(entry)

    if auto_post_accounting:
        for entry in entries:
            post_financial_entry_to_accounting(entry, actor=actor)

    return entries


# ============================================================
# 📊 Statement Calculation Helpers
# ============================================================

def _financial_entries_amounts(queryset: QuerySet[AgentFinancialEntry]) -> dict[str, Decimal]:
    total_debit_amount = _money(
        queryset.filter(direction=FinancialEntryDirection.DEBIT)
        .aggregate(total=Sum("amount"))
        .get("total")
        or "0.00"
    )
    total_credit_amount = _money(
        queryset.filter(direction=FinancialEntryDirection.CREDIT)
        .aggregate(total=Sum("amount"))
        .get("total")
        or "0.00"
    )
    total_debit_paid_amount = _money(
        queryset.filter(direction=FinancialEntryDirection.DEBIT)
        .aggregate(total=Sum("paid_amount"))
        .get("total")
        or "0.00"
    )
    total_credit_paid_amount = _money(
        queryset.filter(direction=FinancialEntryDirection.CREDIT)
        .aggregate(total=Sum("paid_amount"))
        .get("total")
        or "0.00"
    )

    total_debit_remaining_amount = _money(total_debit_amount - total_debit_paid_amount)
    total_credit_remaining_amount = _money(total_credit_amount - total_credit_paid_amount)

    if total_debit_remaining_amount < MONEY_ZERO:
        total_debit_remaining_amount = MONEY_ZERO

    if total_credit_remaining_amount < MONEY_ZERO:
        total_credit_remaining_amount = MONEY_ZERO

    return {
        "total_debit_amount": total_debit_amount,
        "total_credit_amount": total_credit_amount,
        "total_debit_paid_amount": total_debit_paid_amount,
        "total_credit_paid_amount": total_credit_paid_amount,
        "total_debit_remaining_amount": total_debit_remaining_amount,
        "total_credit_remaining_amount": total_credit_remaining_amount,
        "net_balance_amount": _money(total_debit_remaining_amount - total_credit_remaining_amount),
    }


def _amounts_for_entry_type(
    queryset: QuerySet[AgentFinancialEntry],
    entry_type: str,
) -> dict[str, Decimal]:
    typed_qs = queryset.filter(entry_type=entry_type)

    amount = _money(
        typed_qs.aggregate(total=Sum("amount")).get("total") or "0.00"
    )
    paid_amount = _money(
        typed_qs.aggregate(total=Sum("paid_amount")).get("total") or "0.00"
    )
    remaining_amount = _money(amount - paid_amount)

    if remaining_amount < MONEY_ZERO:
        remaining_amount = MONEY_ZERO

    return {
        "amount": amount,
        "paid_amount": paid_amount,
        "remaining_amount": remaining_amount,
    }


def _sum_settlement_like_amount(queryset: QuerySet[AgentFinancialEntry]) -> Decimal:
    settlement_types = [
        _entry_type_value("SETTLEMENT", "SETTLEMENT"),
        _entry_type_value("AGENT_SETTLEMENT", "AGENT_SETTLEMENT"),
        _entry_type_value("BROKER_SETTLEMENT", "BROKER_SETTLEMENT"),
        _entry_type_value("PAYOUT", "PAYOUT"),
        _entry_type_value("PAYMENT", "PAYMENT"),
        _entry_type_value("CUSTODY_SETTLEMENT", "CUSTODY_SETTLEMENT"),
        _entry_type_value("COMMISSION_PAYOUT", "COMMISSION_PAYOUT"),
    ]

    return _money(
        queryset.filter(entry_type__in=settlement_types)
        .aggregate(total=Sum("amount"))
        .get("total")
        or "0.00"
    )


# ============================================================
# 📊 Agent Statement — Summary
# ============================================================

def _build_agent_statement_summary(
    agent: Agent,
    agent_orders_qs: QuerySet[AgentOrder],
    commissions_qs: QuerySet[AgentCommission],
    financial_entries_qs: QuerySet[AgentFinancialEntry],
    *,
    currency: str,
) -> AgentStatementSummary:
    total_sales_amount = _money(
        agent_orders_qs.aggregate(total=Sum("sales_amount")).get("total") or "0.00"
    )
    total_commission_amount = _money(
        commissions_qs.aggregate(total=Sum("commission_amount")).get("total") or "0.00"
    )
    total_paid_amount = _money(
        commissions_qs.aggregate(total=Sum("paid_amount")).get("total") or "0.00"
    )
    total_due_amount = _money(total_commission_amount - total_paid_amount)
    if total_due_amount < MONEY_ZERO:
        total_due_amount = MONEY_ZERO

    amounts = _financial_entries_amounts(financial_entries_qs)

    cod = _amounts_for_entry_type(
        financial_entries_qs,
        _entry_type_value("COD_CUSTODY", "COD_CUSTODY"),
    )
    sales = _amounts_for_entry_type(
        financial_entries_qs,
        _entry_type_value("SALES_COMMISSION", "SALES_COMMISSION"),
    )
    delivery = _amounts_for_entry_type(
        financial_entries_qs,
        _entry_type_value("DELIVERY_FEE", "DELIVERY_FEE"),
    )
    broker_share = _amounts_for_entry_type(
        financial_entries_qs,
        _entry_type_value("BROKER_SHARE", "BROKER_SHARE"),
    )

    adjustments_debit_amount = _money(
        financial_entries_qs.filter(
            direction=FinancialEntryDirection.DEBIT,
            entry_type__in=[
                _entry_type_value("ADJUSTMENT", "ADJUSTMENT"),
                _entry_type_value("DEDUCTION", "DEDUCTION"),
                _entry_type_value("BONUS", "BONUS"),
            ],
        )
        .aggregate(total=Sum("amount"))
        .get("total")
        or "0.00"
    )
    adjustments_credit_amount = _money(
        financial_entries_qs.filter(
            direction=FinancialEntryDirection.CREDIT,
            entry_type__in=[
                _entry_type_value("ADJUSTMENT", "ADJUSTMENT"),
                _entry_type_value("DEDUCTION", "DEDUCTION"),
                _entry_type_value("BONUS", "BONUS"),
            ],
        )
        .aggregate(total=Sum("amount"))
        .get("total")
        or "0.00"
    )

    amount_due_from_agent = amounts["total_debit_remaining_amount"]
    amount_due_to_agent = amounts["total_credit_remaining_amount"]

    return AgentStatementSummary(
        agent_id=agent.pk,
        agent_code=agent.agent_code or "",
        agent_name=_resolve_agent_display_name(agent),
        agent_status=agent.status,
        broker_id=agent.broker_id,
        broker_name=_resolve_broker_display_name(agent.broker if agent.broker_id else None),
        primary_contact=_resolve_agent_contact(agent),

        total_orders_count=agent_orders_qs.count(),
        total_sales_amount=total_sales_amount,

        total_commissions_count=commissions_qs.count(),
        total_commission_amount=total_commission_amount,
        total_paid_amount=total_paid_amount,
        total_due_amount=total_due_amount,

        total_debit_amount=amounts["total_debit_amount"],
        total_credit_amount=amounts["total_credit_amount"],
        total_debit_paid_amount=amounts["total_debit_paid_amount"],
        total_credit_paid_amount=amounts["total_credit_paid_amount"],
        total_debit_remaining_amount=amounts["total_debit_remaining_amount"],
        total_credit_remaining_amount=amounts["total_credit_remaining_amount"],
        net_balance_amount=amounts["net_balance_amount"],

        cod_custody_amount=cod["amount"],
        cod_custody_paid_amount=cod["paid_amount"],
        cod_custody_remaining_amount=cod["remaining_amount"],

        sales_commission_amount=sales["amount"],
        sales_commission_paid_amount=sales["paid_amount"],
        sales_commission_remaining_amount=sales["remaining_amount"],

        delivery_fee_amount=delivery["amount"],
        delivery_fee_paid_amount=delivery["paid_amount"],
        delivery_fee_remaining_amount=delivery["remaining_amount"],

        broker_share_amount=broker_share["amount"],
        broker_share_paid_amount=broker_share["paid_amount"],
        broker_share_remaining_amount=broker_share["remaining_amount"],

        adjustments_debit_amount=adjustments_debit_amount,
        adjustments_credit_amount=adjustments_credit_amount,
        settlements_amount=_sum_settlement_like_amount(financial_entries_qs),

        amount_due_from_agent=amount_due_from_agent,
        amount_due_to_agent=amount_due_to_agent,
        currency=currency,
    )

# ============================================================
# 📥 Agent Statement Collectors
# ============================================================

def _collect_agent_order_lines(
    agent_orders_qs: QuerySet[AgentOrder],
    *,
    date_from: datetime | None,
    date_to: datetime | None,
    currency: str,
) -> list[dict[str, Any]]:
    lines: list[dict[str, Any]] = []

    queryset = agent_orders_qs

    if date_from:
        queryset = queryset.filter(created_at__gte=date_from)

    if date_to:
        queryset = queryset.filter(created_at__lte=date_to)

    for agent_order in queryset.order_by("created_at", "id"):
        sales_amount = _money(agent_order.sales_amount)
        commission_amount = _money(agent_order.commission_amount)

        lines.append(
            {
                "line_type": "AGENT_ORDER",
                "line_date": _ensure_aware(agent_order.created_at),
                "reference": f"AO-{agent_order.pk}",
                "related_order_id": agent_order.order_id,
                "related_agent_order_id": agent_order.pk,
                "related_commission_id": None,
                "related_financial_entry_id": None,
                "description": f"ربط الطلب #{agent_order.order_id} بالمندوب",
                "debit_amount": MONEY_ZERO,
                "credit_amount": MONEY_ZERO,
                "currency": getattr(_safe_getattr(agent_order, "order"), "currency_code", None) or currency,
                "status": "INFO",
                "metadata": {
                    "commission_type": agent_order.commission_type,
                    "commission_value": str(_money(agent_order.commission_value)),
                    "sales_amount": str(sales_amount),
                    "commission_amount": str(commission_amount),
                    "customer_id": agent_order.customer_id,
                    "broker_id": agent_order.broker_id,
                    "order_number": _resolve_order_number(agent_order.order),
                    "is_operational_only": True,
                },
            }
        )

    return lines


def _collect_commission_lines(
    commissions_qs: QuerySet[AgentCommission],
    *,
    date_from: datetime | None,
    date_to: datetime | None,
    currency: str,
) -> list[dict[str, Any]]:
    lines: list[dict[str, Any]] = []

    queryset = commissions_qs

    if date_from:
        queryset = queryset.filter(created_at__gte=date_from)

    if date_to:
        queryset = queryset.filter(created_at__lte=date_to)

    for commission in queryset.order_by("created_at", "id"):
        commission_amount = _money(commission.commission_amount)
        paid_amount = _money(commission.paid_amount)
        remaining_amount = commission_amount - paid_amount

        if remaining_amount < MONEY_ZERO:
            remaining_amount = MONEY_ZERO

        line_date = _first_non_empty(
            _ensure_aware(commission.approved_at),
            _ensure_aware(commission.earned_at),
            _ensure_aware(commission.created_at),
        )

        if commission_amount > MONEY_ZERO:
            lines.append(
                {
                    "line_type": "LEGACY_COMMISSION",
                    "line_date": line_date,
                    "reference": _resolve_commission_identifier(commission),
                    "related_order_id": commission.order_id,
                    "related_agent_order_id": commission.agent_order_id,
                    "related_commission_id": commission.pk,
                    "related_financial_entry_id": None,
                    "description": f"عمولة قديمة للطلب #{commission.order_id}",
                    "debit_amount": MONEY_ZERO,
                    "credit_amount": commission_amount,
                    "currency": getattr(_safe_getattr(commission, "payment"), "currency", None) or currency,
                    "status": commission.commission_status,
                    "metadata": {
                        "payment_id": commission.payment_id,
                        "broker_id": commission.broker_id,
                        "earned_at": commission.earned_at.isoformat() if commission.earned_at else None,
                        "approved_at": commission.approved_at.isoformat() if commission.approved_at else None,
                        "paid_at": commission.paid_at.isoformat() if commission.paid_at else None,
                        "paid_amount": str(paid_amount),
                        "remaining_amount": str(remaining_amount),
                        "journal_entry_id": _safe_getattr(commission, "journal_entry_id"),
                        "journal_entry_reference": _first_non_empty(
                            _safe_getattr(commission, "journal_entry_reference"),
                            _safe_getattr(commission, "accounting_entry_reference"),
                            _safe_getattr(commission, "posting_reference"),
                            "",
                        ),
                        "is_accounting_posted": _is_commission_accounting_posted(commission),
                        "legacy": True,
                    },
                }
            )

        if paid_amount > MONEY_ZERO:
            payout_date = _first_non_empty(
                _ensure_aware(commission.paid_at),
                _ensure_aware(commission.updated_at),
                _ensure_aware(commission.created_at),
            )

            lines.append(
                {
                    "line_type": "LEGACY_COMMISSION_PAYOUT",
                    "line_date": payout_date,
                    "reference": f"{_resolve_commission_identifier(commission)}-PAY",
                    "related_order_id": commission.order_id,
                    "related_agent_order_id": commission.agent_order_id,
                    "related_commission_id": commission.pk,
                    "related_financial_entry_id": None,
                    "description": f"صرف عمولة قديمة للطلب #{commission.order_id}",
                    "debit_amount": paid_amount,
                    "credit_amount": MONEY_ZERO,
                    "currency": getattr(_safe_getattr(commission, "payment"), "currency", None) or currency,
                    "status": COMMISSION_STATUS_PAID,
                    "metadata": {
                        "payment_id": commission.payment_id,
                        "broker_id": commission.broker_id,
                        "paid_at": commission.paid_at.isoformat() if commission.paid_at else None,
                        "paid_amount": str(paid_amount),
                        "remaining_amount": str(remaining_amount),
                        "legacy": True,
                    },
                }
            )

    return lines


def _build_financial_entry_metadata(entry: AgentFinancialEntry) -> dict[str, Any]:
    remaining_amount = _entry_remaining_amount(entry)
    paid_amount = _entry_paid_amount(entry)
    order = _safe_getattr(entry, "order", None)
    journal_entry = _safe_getattr(entry, "journal_entry", None)

    return {
        "entry_id": entry.pk,
        "entry_number": entry.entry_number,
        "entry_type": entry.entry_type,
        "entry_type_label": entry.get_entry_type_display() if hasattr(entry, "get_entry_type_display") else entry.entry_type,
        "direction": entry.direction,
        "direction_label": entry.get_direction_display() if hasattr(entry, "get_direction_display") else entry.direction,
        "agent_id": entry.agent_id,
        "agent_code": _safe_getattr(entry.agent, "agent_code", "") if entry.agent_id else "",
        "agent_name": _resolve_agent_display_name(entry.agent) if entry.agent_id else "",
        "broker_id": entry.broker_id,
        "broker_code": _safe_getattr(entry.broker, "broker_code", "") if entry.broker_id else "",
        "broker_name": _resolve_broker_display_name(entry.broker if entry.broker_id else None),
        "payment_id": entry.payment_id,
        "commission_id": entry.commission_id,
        "rule_id": entry.rule_id,
        "amount": str(_money(entry.amount)),
        "paid_amount": str(paid_amount),
        "remaining_amount": str(remaining_amount),
        "source_type": entry.source_type,
        "source_id": entry.source_id,
        "source_number": entry.source_number,
        "journal_entry_id": entry.journal_entry_id,
        "journal_entry_reference": entry.journal_entry_reference,
        "journal_entry_number": _safe_getattr(journal_entry, "entry_number", ""),
        "is_accounting_posted": entry.is_accounting_posted,
        "posted_at": entry.posted_at.isoformat() if entry.posted_at else None,
        "earned_at": entry.earned_at.isoformat() if entry.earned_at else None,
        "approved_at": entry.approved_at.isoformat() if entry.approved_at else None,
        "settled_at": entry.settled_at.isoformat() if _safe_getattr(entry, "settled_at") else None,
        "paid_at": entry.paid_at.isoformat() if entry.paid_at else None,
        "order_id": entry.order_id,
        "order_number": _resolve_order_number(order) if order else "",
        "customer_id": _safe_getattr(order, "customer_id") if order else None,
        "product_id": _safe_getattr(order, "product_id") if order else None,
        "provider_id": _safe_getattr(order, "provider_id") if order else None,
        "contract_id": _safe_getattr(order, "contract_id") if order else None,
        "contract_product_id": _safe_getattr(order, "contract_product_id") if order else None,
        "raw_metadata": entry.metadata or {},
    }


def _collect_financial_entry_lines(
    financial_entries_qs: QuerySet[AgentFinancialEntry],
    *,
    date_from: datetime | None,
    date_to: datetime | None,
    currency: str,
) -> list[dict[str, Any]]:
    lines: list[dict[str, Any]] = []

    queryset = financial_entries_qs

    if date_from:
        queryset = queryset.filter(created_at__gte=date_from)

    if date_to:
        queryset = queryset.filter(created_at__lte=date_to)

    for entry in queryset.order_by("created_at", "id"):
        amount = _money(entry.amount)
        paid_amount = _entry_paid_amount(entry)
        remaining_amount = _entry_remaining_amount(entry)

        debit_amount = amount if _is_debit_entry(entry) else MONEY_ZERO
        credit_amount = amount if _is_credit_entry(entry) else MONEY_ZERO

        line_date = _first_non_empty(
            _ensure_aware(entry.approved_at),
            _ensure_aware(entry.earned_at),
            _ensure_aware(_safe_getattr(entry, "settled_at")),
            _ensure_aware(entry.paid_at),
            _ensure_aware(entry.created_at),
        )

        metadata = _build_financial_entry_metadata(entry)

        lines.append(
            {
                "line_type": entry.entry_type,
                "line_date": line_date,
                "reference": entry.entry_number,
                "related_order_id": entry.order_id,
                "related_agent_order_id": None,
                "related_commission_id": entry.commission_id,
                "related_financial_entry_id": entry.pk,
                "description": entry.description or entry.get_entry_type_display(),
                "debit_amount": debit_amount,
                "credit_amount": credit_amount,
                "currency": entry.currency or currency,
                "status": entry.status,
                "metadata": metadata,
            }
        )

        if paid_amount > MONEY_ZERO:
            if _is_debit_entry(entry):
                settlement_debit = MONEY_ZERO
                settlement_credit = paid_amount
                settlement_description = f"تسوية/تحصيل من المندوب مقابل {entry.description or entry.entry_number}"
            else:
                settlement_debit = paid_amount
                settlement_credit = MONEY_ZERO
                settlement_description = f"صرف/تسوية مستحق للمندوب مقابل {entry.description or entry.entry_number}"

            lines.append(
                {
                    "line_type": f"{entry.entry_type}_SETTLEMENT",
                    "line_date": _first_non_empty(
                        _ensure_aware(entry.paid_at),
                        _ensure_aware(_safe_getattr(entry, "settled_at")),
                        line_date,
                    ),
                    "reference": f"{entry.entry_number}-SETTLED",
                    "related_order_id": entry.order_id,
                    "related_agent_order_id": None,
                    "related_commission_id": entry.commission_id,
                    "related_financial_entry_id": entry.pk,
                    "description": settlement_description,
                    "debit_amount": settlement_debit,
                    "credit_amount": settlement_credit,
                    "currency": entry.currency or currency,
                    "status": entry.status,
                    "metadata": {
                        **metadata,
                        "is_settlement_line": True,
                        "settled_amount": str(paid_amount),
                        "remaining_after_settlement": str(remaining_amount),
                    },
                }
            )

    return lines


# ============================================================
# 🧾 Agent Statement Builder
# ============================================================

def build_agent_statement(
    agent: Agent,
    *,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    include_agent_orders: bool = False,
    include_commissions: bool = False,
    include_financial_entries: bool = True,
) -> AgentStatementResult:
    if not agent:
        raise ValueError("agent is required")

    start_dt = _start_of_day(date_from)
    end_dt = _end_of_day(date_to)

    agent_orders_qs = AgentOrder.objects.filter(agent=agent).select_related(
        "agent",
        "broker",
        "customer",
        "order",
    )
    commissions_qs = AgentCommission.objects.filter(agent=agent).select_related(
        "agent",
        "broker",
        "order",
        "payment",
        "agent_order",
    )
    financial_entries_qs = AgentFinancialEntry.objects.filter(agent=agent).select_related(
        "agent",
        "broker",
        "order",
        "payment",
        "commission",
        "rule",
        "journal_entry",
    )

    filtered_agent_orders_qs = agent_orders_qs
    filtered_commissions_qs = commissions_qs
    filtered_financial_entries_qs = financial_entries_qs

    if start_dt:
        filtered_agent_orders_qs = filtered_agent_orders_qs.filter(created_at__gte=start_dt)
        filtered_commissions_qs = filtered_commissions_qs.filter(created_at__gte=start_dt)
        filtered_financial_entries_qs = filtered_financial_entries_qs.filter(created_at__gte=start_dt)

    if end_dt:
        filtered_agent_orders_qs = filtered_agent_orders_qs.filter(created_at__lte=end_dt)
        filtered_commissions_qs = filtered_commissions_qs.filter(created_at__lte=end_dt)
        filtered_financial_entries_qs = filtered_financial_entries_qs.filter(created_at__lte=end_dt)

    currency = _resolve_agent_currency(
        agent_orders_qs=agent_orders_qs,
        commissions_qs=commissions_qs,
        financial_entries_qs=financial_entries_qs,
    )

    summary = _build_agent_statement_summary(
        agent=agent,
        agent_orders_qs=filtered_agent_orders_qs,
        commissions_qs=filtered_commissions_qs,
        financial_entries_qs=filtered_financial_entries_qs,
        currency=currency,
    )

    raw_lines: list[dict[str, Any]] = []

    if include_agent_orders:
        raw_lines.extend(
            _collect_agent_order_lines(
                agent_orders_qs,
                date_from=start_dt,
                date_to=end_dt,
                currency=currency,
            )
        )

    if include_commissions:
        raw_lines.extend(
            _collect_commission_lines(
                commissions_qs,
                date_from=start_dt,
                date_to=end_dt,
                currency=currency,
            )
        )

    if include_financial_entries:
        raw_lines.extend(
            _collect_financial_entry_lines(
                financial_entries_qs,
                date_from=start_dt,
                date_to=end_dt,
                currency=currency,
            )
        )

    raw_lines.sort(
        key=lambda item: (
            item["line_date"] or _sort_datetime_fallback(),
            item["related_order_id"] or 0,
            item["related_agent_order_id"] or 0,
            item["related_commission_id"] or 0,
            item["related_financial_entry_id"] or 0,
            item["line_type"],
        )
    )

    balance = MONEY_ZERO
    statement_lines: list[AgentStatementLine] = []

    for item in raw_lines:
        debit_amount = _money(item["debit_amount"])
        credit_amount = _money(item["credit_amount"])
        balance = _money(balance + debit_amount - credit_amount)

        statement_lines.append(
            AgentStatementLine(
                line_type=item["line_type"],
                line_date=item["line_date"],
                reference=item["reference"],
                related_order_id=item["related_order_id"],
                related_agent_order_id=item["related_agent_order_id"],
                related_commission_id=item["related_commission_id"],
                related_financial_entry_id=item["related_financial_entry_id"],
                description=item["description"],
                debit_amount=debit_amount,
                credit_amount=credit_amount,
                balance_after=balance,
                currency=item["currency"],
                status=item["status"],
                metadata=item["metadata"],
            )
        )

    return AgentStatementResult(
        summary=summary,
        lines=statement_lines,
    )


# ============================================================
# 🧾 Broker Statement Builder
# ============================================================

def build_broker_statement(
    broker: Broker,
    *,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    include_team_entries: bool = True,
) -> BrokerStatementResult:
    if not broker:
        raise ValueError("broker is required")

    start_dt = _start_of_day(date_from)
    end_dt = _end_of_day(date_to)

    financial_entries_qs = AgentFinancialEntry.objects.filter(broker=broker).select_related(
        "agent",
        "broker",
        "order",
        "payment",
        "commission",
        "rule",
        "journal_entry",
    )

    if not include_team_entries:
        financial_entries_qs = financial_entries_qs.filter(agent__isnull=True)

    filtered_qs = financial_entries_qs

    if start_dt:
        filtered_qs = filtered_qs.filter(created_at__gte=start_dt)

    if end_dt:
        filtered_qs = filtered_qs.filter(created_at__lte=end_dt)

    currency_obj = filtered_qs.order_by("-created_at").first()
    currency = currency_obj.currency if currency_obj and currency_obj.currency else "SAR"

    amounts = _financial_entries_amounts(filtered_qs)
    broker_share = _amounts_for_entry_type(
        filtered_qs,
        _entry_type_value("BROKER_SHARE", "BROKER_SHARE"),
    )

    amount_due_from_broker = amounts["total_debit_remaining_amount"]
    amount_due_to_broker = amounts["total_credit_remaining_amount"]

    summary = BrokerStatementSummary(
        broker_id=broker.pk,
        broker_code=broker.broker_code,
        broker_name=broker.name,
        broker_status=broker.status,
        agents_count=broker.agents.count(),

        total_debit_amount=amounts["total_debit_amount"],
        total_credit_amount=amounts["total_credit_amount"],
        total_debit_paid_amount=amounts["total_debit_paid_amount"],
        total_credit_paid_amount=amounts["total_credit_paid_amount"],
        total_debit_remaining_amount=amounts["total_debit_remaining_amount"],
        total_credit_remaining_amount=amounts["total_credit_remaining_amount"],
        net_balance_amount=amounts["net_balance_amount"],

        broker_share_amount=broker_share["amount"],
        broker_share_paid_amount=broker_share["paid_amount"],
        broker_share_remaining_amount=broker_share["remaining_amount"],

        settlements_amount=_sum_settlement_like_amount(filtered_qs),
        amount_due_from_broker=amount_due_from_broker,
        amount_due_to_broker=amount_due_to_broker,
        currency=currency,
    )

    raw_lines = _collect_financial_entry_lines(
        financial_entries_qs,
        date_from=start_dt,
        date_to=end_dt,
        currency=currency,
    )

    raw_lines.sort(
        key=lambda item: (
            item["line_date"] or _sort_datetime_fallback(),
            item["related_order_id"] or 0,
            item["related_financial_entry_id"] or 0,
            item["line_type"],
        )
    )

    balance = MONEY_ZERO
    statement_lines: list[AgentStatementLine] = []

    for item in raw_lines:
        debit_amount = _money(item["debit_amount"])
        credit_amount = _money(item["credit_amount"])
        balance = _money(balance + debit_amount - credit_amount)

        statement_lines.append(
            AgentStatementLine(
                line_type=item["line_type"],
                line_date=item["line_date"],
                reference=item["reference"],
                related_order_id=item["related_order_id"],
                related_agent_order_id=item["related_agent_order_id"],
                related_commission_id=item["related_commission_id"],
                related_financial_entry_id=item["related_financial_entry_id"],
                description=item["description"],
                debit_amount=debit_amount,
                credit_amount=credit_amount,
                balance_after=balance,
                currency=item["currency"],
                status=item["status"],
                metadata=item["metadata"],
            )
        )

    return BrokerStatementResult(
        summary=summary,
        lines=statement_lines,
    )


# ============================================================
# 🌐 Serialized Helpers
# ============================================================

def _serialize_decimal_fields(data: dict[str, Any], keys: list[str]) -> dict[str, Any]:
    for key in keys:
        if key in data:
            data[key] = str(data[key])
    return data


def _serialize_agent_statement_summary(summary: AgentStatementSummary) -> dict[str, Any]:
    data = asdict(summary)

    return _serialize_decimal_fields(
        data,
        [
            "total_sales_amount",
            "total_commission_amount",
            "total_paid_amount",
            "total_due_amount",

            "total_debit_amount",
            "total_credit_amount",
            "total_debit_paid_amount",
            "total_credit_paid_amount",
            "total_debit_remaining_amount",
            "total_credit_remaining_amount",
            "net_balance_amount",

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

            "adjustments_debit_amount",
            "adjustments_credit_amount",
            "settlements_amount",

            "amount_due_from_agent",
            "amount_due_to_agent",
        ],
    )


def _serialize_broker_statement_summary(summary: BrokerStatementSummary) -> dict[str, Any]:
    data = asdict(summary)

    return _serialize_decimal_fields(
        data,
        [
            "total_debit_amount",
            "total_credit_amount",
            "total_debit_paid_amount",
            "total_credit_paid_amount",
            "total_debit_remaining_amount",
            "total_credit_remaining_amount",
            "net_balance_amount",

            "broker_share_amount",
            "broker_share_paid_amount",
            "broker_share_remaining_amount",

            "settlements_amount",
            "amount_due_from_broker",
            "amount_due_to_broker",
        ],
    )


def _serialize_statement_line(line: AgentStatementLine) -> dict[str, Any]:
    data = asdict(line)
    data["debit_amount"] = str(line.debit_amount)
    data["credit_amount"] = str(line.credit_amount)
    data["balance_after"] = str(line.balance_after)
    data["line_date"] = line.line_date.isoformat() if line.line_date else None
    return data


def build_agent_statement_payload(
    agent: Agent,
    *,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    include_agent_orders: bool = False,
    include_commissions: bool = False,
    include_financial_entries: bool = True,
) -> dict[str, Any]:
    result = build_agent_statement(
        agent=agent,
        date_from=date_from,
        date_to=date_to,
        include_agent_orders=include_agent_orders,
        include_commissions=include_commissions,
        include_financial_entries=include_financial_entries,
    )

    return {
        "summary": _serialize_agent_statement_summary(result.summary),
        "lines": [_serialize_statement_line(line) for line in result.lines],
    }


def build_broker_statement_payload(
    broker: Broker,
    *,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    include_team_entries: bool = True,
) -> dict[str, Any]:
    result = build_broker_statement(
        broker=broker,
        date_from=date_from,
        date_to=date_to,
        include_team_entries=include_team_entries,
    )

    return {
        "summary": _serialize_broker_statement_summary(result.summary),
        "lines": [_serialize_statement_line(line) for line in result.lines],
    }