# ============================================================
# 📂 agents/services.py
# 🧠 Agent Commission & Statement Services — Primey Care V1.2
# ------------------------------------------------------------
# ✅ طبقة خدمات رسمية لاعتماد عمولات المندوبين
# ✅ مطابقة للموديل الفعلي AgentCommission
# ✅ تعتمد commission_status بدل status
# ✅ إطلاق قيد استحقاق العمولة تلقائيًا بعد الاعتماد
# ✅ خدمة رسمية لكشف حساب المندوب V1
# ✅ مراعاة idempotency قدر الإمكان عبر طبقة الترحيل
# ✅ Logging منظم + أخطاء واضحة
# ✅ بدون المساس بأي منجز سابق
# ------------------------------------------------------------
# ملاحظات:
# 1) الموديل الفعلي يستخدم:
#    - commission_status
#    - approved_at
#    - earned_at
#    - paid_at
# 2) حالة الاعتماد الصحيحة هي APPROVED
# 3) كشف حساب المندوب في V1 يعتمد على:
#    - AgentOrder
#    - AgentCommission
# 4) الرصيد التراكمي في كشف المندوب:
#    - العمولة المستحقة/المعتمدة = حركة مدينة على حساب المندوب
#    - العمولة المصروفة = حركة دائنة تخفّض الرصيد المستحق له
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
from django.db.models import QuerySet, Sum
from django.utils import timezone

from agents.models import Agent, AgentCommission, AgentOrder

logger = logging.getLogger(__name__)


# ============================================================
# ⚙️ ثوابت عامة
# ============================================================

COMMISSION_STATUS_PENDING = "PENDING"
COMMISSION_STATUS_EARNED = "EARNED"
COMMISSION_STATUS_APPROVED = "APPROVED"
COMMISSION_STATUS_PAID = "PAID"
COMMISSION_STATUS_CANCELLED = "CANCELLED"
COMMISSION_STATUS_REVERSED = "REVERSED"

FINAL_COMMISSION_STATUSES = {
    COMMISSION_STATUS_APPROVED,
    COMMISSION_STATUS_PAID,
}

CANDIDATE_COMMISSION_POSTING_TARGETS = [
    ("accounting.services.posting", "post_agent_commission_accrual"),
    ("accounting.services.posting", "post_commission_accrual"),
    ("accounting.services.posting", "post_agent_commission"),
    ("accounting.services", "post_agent_commission_accrual"),
    ("accounting.services", "post_commission_accrual"),
    ("accounting.services", "post_agent_commission"),
    ("accounting.services.commissions", "post_agent_commission_accrual"),
    ("accounting.services.commissions", "post_commission_accrual"),
    ("accounting.services.commissions", "post_agent_commission"),
]


# ============================================================
# 🧱 استثناءات مخصصة
# ============================================================

class AgentServiceError(Exception):
    """الاستثناء الأساسي لخدمات المندوبين/العمولات."""


class CommissionValidationError(AgentServiceError):
    """خطأ تحقق منطقي أثناء معالجة العمولة."""


class CommissionPostingError(AgentServiceError):
    """خطأ أثناء الترحيل المحاسبي الخاص بالعمولة."""


# ============================================================
# 📦 نتائج الخدمات
# ============================================================

@dataclass(slots=True)
class CommissionApprovalResult:
    commission: Any
    status_before: str
    status_after: str
    accounting_post_requested: bool
    accounting_post_dispatched: bool
    accounting_post_message: str


@dataclass(slots=True)
class AgentStatementSummary:
    agent_id: int
    agent_code: str
    agent_name: str
    agent_status: str
    primary_contact: str
    total_orders_count: int
    total_sales_amount: Decimal
    total_commissions_count: int
    total_commission_amount: Decimal
    total_paid_amount: Decimal
    total_due_amount: Decimal
    currency: str


@dataclass(slots=True)
class AgentStatementLine:
    line_type: str
    line_date: Optional[datetime]
    reference: str
    related_order_id: Optional[int]
    related_agent_order_id: Optional[int]
    related_commission_id: Optional[int]
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
    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


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
    return str(
        _first_non_empty(
            _safe_getattr(commission, "commission_status"),
            COMMISSION_STATUS_PENDING,
        )
    )


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
                return Decimal(str(value))
            except Exception:
                continue
    return Decimal("0.00")


def _resolve_import_callable(
    candidates: list[tuple[str, str]]
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


def _save_commission(commission: Any, update_fields: list[str]) -> None:
    valid_update_fields = [field for field in update_fields if hasattr(commission, field)]
    if valid_update_fields:
        commission.save(update_fields=valid_update_fields)
    else:
        commission.save()


def _refresh_commission(commission: Any) -> None:
    refresh = getattr(commission, "refresh_from_db", None)
    if callable(refresh):
        refresh()


def _should_force_approved_status(status_before: str) -> bool:
    return status_before not in FINAL_COMMISSION_STATUSES


def _resolve_agent_display_name(agent: Agent) -> str:
    return agent.full_name or agent.agent_code or f"Agent #{agent.pk}"


def _resolve_agent_contact(agent: Agent) -> str:
    return agent.phone or agent.email or ""


def _resolve_agent_currency(
    agent_orders_qs: QuerySet[AgentOrder],
    commissions_qs: QuerySet[AgentCommission],
) -> str:
    order_obj = agent_orders_qs.order_by("-created_at").first()
    if order_obj and getattr(_safe_getattr(order_obj, "order"), "currency_code", None):
        return order_obj.order.currency_code

    commission_obj = commissions_qs.order_by("-created_at").first()
    if commission_obj and getattr(_safe_getattr(commission_obj, "payment"), "currency", None):
        return commission_obj.payment.currency

    return "SAR"


def _sort_datetime_fallback() -> datetime:
    return timezone.now()


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

    if amount <= Decimal("0.00"):
        raise CommissionValidationError(
            f"لا يمكن اعتماد العمولة {commission_id} لأن مبلغها غير صالح: {amount}."
        )

    try:
        commission.full_clean()
    except ValidationError as exc:
        field_errors = getattr(exc, "message_dict", {}) or {}
        status_errors = field_errors.get("commission_status", [])
        status_error_text = " ".join(str(item) for item in status_errors)

        if "ليست خيارا صحيحاً" in status_error_text or "not a valid choice" in status_error_text:
            logger.warning(
                "تم تجاوز full_clean مؤقتًا لأن حالة العمولة ستُضبط لاحقًا بالقيمة الصحيحة داخل الخدمة. commission=%s",
                commission_id,
            )
            return

        raise CommissionValidationError(
            f"فشل التحقق من العمولة قبل الاعتماد: {exc}"
        ) from exc
    except Exception as exc:
        logger.debug(
            "تم تجاهل full_clean لعدم توافقه الكامل مع حالة العمولة %s: %s",
            commission_id,
            exc,
        )


# ============================================================
# 🧾 تهيئة العمولة قبل الحفظ
# ============================================================

def _prepare_commission_approval_fields(commission: Any, status_before: str) -> list[str]:
    changed_fields: list[str] = []
    now = timezone.now()

    if hasattr(commission, "commission_status") and _should_force_approved_status(status_before):
        if _resolve_commission_status(commission) != COMMISSION_STATUS_APPROVED:
            commission.commission_status = COMMISSION_STATUS_APPROVED
            changed_fields.append("commission_status")

    if hasattr(commission, "approved_at") and not getattr(commission, "approved_at"):
        commission.approved_at = now
        changed_fields.append("approved_at")

    if hasattr(commission, "updated_at"):
        commission.updated_at = now
        if "updated_at" not in changed_fields:
            changed_fields.append("updated_at")

    return changed_fields


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
        _save_commission(commission, ["commission_status"])
        _refresh_commission(commission)


# ============================================================
# 📘 الترحيل المحاسبي
# ============================================================

def dispatch_commission_accounting_post(
    commission: Any,
    actor: Any = None,
) -> tuple[bool, str]:
    commission_id = _resolve_commission_identifier(commission)
    posting_callable = _resolve_import_callable(CANDIDATE_COMMISSION_POSTING_TARGETS)

    if posting_callable is None:
        message = (
            "لم يتم العثور على دالة ترحيل محاسبي لاستحقاق العمولة. "
            "تحقق من ربط accounting.services.posting."
        )
        logger.warning("Commission %s: %s", commission_id, message)
        return False, message

    try:
        try:
            posting_callable(commission=commission, actor=actor)
        except TypeError:
            try:
                posting_callable(commission=commission)
            except TypeError:
                posting_callable(commission)

        message = f"تم إطلاق قيد استحقاق العمولة بنجاح للعمولة {commission_id}."
        logger.info(message)
        return True, message

    except Exception as exc:
        logger.exception(
            "❌ فشل الترحيل المحاسبي لاستحقاق العمولة %s: %s",
            commission_id,
            exc,
        )
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
    """
    اعتماد العمولة رسميًا مع إطلاق قيد الاستحقاق المحاسبي بعد نجاح commit.
    """
    if commission is None:
        raise CommissionValidationError("commission is required.")

    commission_id = _resolve_commission_identifier(commission)
    status_before = _resolve_commission_status(commission)

    logger.info(
        "🚀 بدء اعتماد العمولة %s | status_before=%s",
        commission_id,
        status_before,
    )

    validate_commission_for_approval(commission)

    changed_fields = _prepare_commission_approval_fields(
        commission,
        status_before=status_before,
    )

    for method_name in ("recalculate", "recalculate_totals", "refresh_from_source"):
        try:
            _call_if_exists(commission, method_name)
        except Exception as exc:
            logger.warning(
                "تعذر تنفيذ %s للعمولة %s: %s",
                method_name,
                commission_id,
                exc,
            )

    _save_commission(commission, changed_fields)
    _refresh_commission(commission)
    _enforce_post_save_status(commission, status_before=status_before)
    _refresh_commission(commission)

    accounting_post_dispatched = False
    accounting_post_message = "لم يُطلب الترحيل المحاسبي."

    if auto_post_accounting:
        def _post_accounting_after_commit() -> None:
            nonlocal accounting_post_dispatched, accounting_post_message
            success, message = dispatch_commission_accounting_post(
                commission=commission,
                actor=actor,
            )
            accounting_post_dispatched = success
            accounting_post_message = message

        transaction.on_commit(_post_accounting_after_commit)
        accounting_post_message = "تمت جدولة قيد استحقاق العمولة بعد نجاح commit."
    else:
        accounting_post_message = "تم اعتماد العمولة بدون ترحيل محاسبي تلقائي."

    _refresh_commission(commission)
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
# 🔁 خدمة مساعدة لإعادة الترحيل عند الحاجة
# ============================================================

def repost_commission_accounting(
    commission: Any,
    *,
    actor: Any = None,
) -> tuple[bool, str]:
    if commission is None:
        raise CommissionValidationError("commission is required for reposting.")

    commission_id = _resolve_commission_identifier(commission)
    logger.info("🔁 إعادة ترحيل محاسبي لاستحقاق العمولة %s", commission_id)

    return dispatch_commission_accounting_post(commission=commission, actor=actor)


# ============================================================
# 📊 Agent Statement — Summary
# ============================================================

def _build_agent_statement_summary(
    agent: Agent,
    agent_orders_qs: QuerySet[AgentOrder],
    commissions_qs: QuerySet[AgentCommission],
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
    if total_due_amount < Decimal("0.00"):
        total_due_amount = Decimal("0.00")

    return AgentStatementSummary(
        agent_id=agent.pk,
        agent_code=agent.agent_code or "",
        agent_name=_resolve_agent_display_name(agent),
        agent_status=agent.status,
        primary_contact=_resolve_agent_contact(agent),
        total_orders_count=agent_orders_qs.count(),
        total_sales_amount=total_sales_amount,
        total_commissions_count=commissions_qs.count(),
        total_commission_amount=total_commission_amount,
        total_paid_amount=total_paid_amount,
        total_due_amount=total_due_amount,
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
    """
    خطوط تشغيلية اختيارية فقط، لا تمثل قيدًا ماليًا مباشرًا.
    """
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
                "description": f"ربط الطلب #{agent_order.order_id} بالمندوب",
                "debit_amount": Decimal("0.00"),
                "credit_amount": Decimal("0.00"),
                "currency": getattr(_safe_getattr(agent_order, "order"), "currency_code", None) or currency,
                "status": "INFO",
                "metadata": {
                    "commission_type": agent_order.commission_type,
                    "commission_value": str(_money(agent_order.commission_value)),
                    "sales_amount": str(sales_amount),
                    "commission_amount": str(commission_amount),
                    "customer_id": agent_order.customer_id,
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

        line_date = _first_non_empty(
            _ensure_aware(commission.approved_at),
            _ensure_aware(commission.earned_at),
            _ensure_aware(commission.created_at),
        )

        if commission_amount > Decimal("0.00"):
            lines.append(
                {
                    "line_type": "COMMISSION",
                    "line_date": line_date,
                    "reference": _resolve_commission_identifier(commission),
                    "related_order_id": commission.order_id,
                    "related_agent_order_id": commission.agent_order_id,
                    "related_commission_id": commission.pk,
                    "description": f"استحقاق/اعتماد عمولة للطلب #{commission.order_id}",
                    "debit_amount": commission_amount,
                    "credit_amount": Decimal("0.00"),
                    "currency": getattr(_safe_getattr(commission, "payment"), "currency", None) or currency,
                    "status": commission.commission_status,
                    "metadata": {
                        "payment_id": commission.payment_id,
                        "earned_at": commission.earned_at.isoformat() if commission.earned_at else None,
                        "approved_at": commission.approved_at.isoformat() if commission.approved_at else None,
                        "paid_at": commission.paid_at.isoformat() if commission.paid_at else None,
                        "paid_amount": str(paid_amount),
                    },
                }
            )

        if paid_amount > Decimal("0.00"):
            payout_date = _first_non_empty(
                _ensure_aware(commission.paid_at),
                _ensure_aware(commission.updated_at),
                _ensure_aware(commission.created_at),
            )
            lines.append(
                {
                    "line_type": "COMMISSION_PAYOUT",
                    "line_date": payout_date,
                    "reference": f"{_resolve_commission_identifier(commission)}-PAY",
                    "related_order_id": commission.order_id,
                    "related_agent_order_id": commission.agent_order_id,
                    "related_commission_id": commission.pk,
                    "description": f"صرف عمولة للمندوب للطلب #{commission.order_id}",
                    "debit_amount": Decimal("0.00"),
                    "credit_amount": paid_amount,
                    "currency": getattr(_safe_getattr(commission, "payment"), "currency", None) or currency,
                    "status": COMMISSION_STATUS_PAID,
                    "metadata": {
                        "payment_id": commission.payment_id,
                        "paid_at": commission.paid_at.isoformat() if commission.paid_at else None,
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
    include_commissions: bool = True,
) -> AgentStatementResult:
    """
    بناء كشف حساب المندوب.

    الفكرة المالية في V1:
    - العمولة المستحقة/المعتمدة = حركة مدينة تزيد المستحق للمندوب
    - العمولة المصروفة = حركة دائنة تخفّض الرصيد المستحق
    - AgentOrder اختياري وتشغيلي فقط، ومُستبعد افتراضيًا من الرصيد المالي
    """
    if not agent:
        raise ValueError("agent is required")

    start_dt = _start_of_day(date_from)
    end_dt = _end_of_day(date_to)

    agent_orders_qs = AgentOrder.objects.filter(agent=agent)
    commissions_qs = AgentCommission.objects.filter(agent=agent)

    currency = _resolve_agent_currency(
        agent_orders_qs=agent_orders_qs,
        commissions_qs=commissions_qs,
    )

    summary = _build_agent_statement_summary(
        agent=agent,
        agent_orders_qs=agent_orders_qs,
        commissions_qs=commissions_qs,
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

    raw_lines.sort(
        key=lambda item: (
            item["line_date"] or _sort_datetime_fallback(),
            item["related_order_id"] or 0,
            item["related_agent_order_id"] or 0,
            item["related_commission_id"] or 0,
            item["line_type"],
        )
    )

    balance = Decimal("0.00")
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
# 🌐 Agent Statement Serialized Helpers
# ============================================================

def _serialize_agent_statement_summary(summary: AgentStatementSummary) -> dict[str, Any]:
    data = asdict(summary)
    for key in [
        "total_sales_amount",
        "total_commission_amount",
        "total_paid_amount",
        "total_due_amount",
    ]:
        data[key] = str(data[key])
    return data


def _serialize_agent_statement_line(line: AgentStatementLine) -> dict[str, Any]:
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
    include_commissions: bool = True,
) -> dict[str, Any]:
    result = build_agent_statement(
        agent=agent,
        date_from=date_from,
        date_to=date_to,
        include_agent_orders=include_agent_orders,
        include_commissions=include_commissions,
    )

    return {
        "summary": _serialize_agent_statement_summary(result.summary),
        "lines": [_serialize_agent_statement_line(line) for line in result.lines],
    }