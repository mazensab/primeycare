# ============================================================
# 📂 treasury/services.py
# 🧠 Primey Care | Treasury Services
# ------------------------------------------------------------
# ✅ خدمات الخزينة الرسمية
# ✅ مبنية لتتكامل مع شجرة الحسابات المعتمدة
# ✅ تغطي:
#    - إنشاء حركة خزينة
#    - تأكيد حركة خزينة
#    - إنشاء حركة قبض من دفعة
#    - إنشاء حركة صرف عمولة مندوب
#    - دوال ربط رسمية للدفعات من payments.services
#    - كشف حساب الخزينة / البنوك V1
# ------------------------------------------------------------
# ملاحظات:
# - التأكيد يتم مرة واحدة فقط
# - تمت إضافة wrappers رسمية:
#    - create_payment_treasury_movement
#    - create_payment_receipt_movement
# - تمت إضافة resolver لاختيار الحساب الخزيني المناسب تلقائيًا
# - تمت إضافة Treasury Statement V1 فوق نفس الملف
# ============================================================

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass
from datetime import date, datetime, time
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import QuerySet, Sum
from django.utils import timezone

from payments.models import Payment, PaymentStatus
from treasury.models import (
    TreasuryAccount,
    TreasuryTransaction,
    TreasuryTransactionStatus,
    TreasuryTransactionType,
)

logger = logging.getLogger(__name__)


# ============================================================
# 🧾 DTOs — Treasury Statement
# ============================================================

@dataclass(slots=True)
class TreasuryStatementSummary:
    treasury_account_id: int
    treasury_account_name: str
    treasury_account_code: str
    treasury_account_status: str
    currency: str
    total_inflow_amount: Decimal
    total_outflow_amount: Decimal
    net_movement_amount: Decimal
    total_transactions_count: int
    confirmed_transactions_count: int


@dataclass(slots=True)
class TreasuryStatementLine:
    line_type: str
    line_date: Optional[datetime]
    reference: str
    transaction_id: Optional[int]
    description: str
    debit_amount: Decimal
    credit_amount: Decimal
    balance_after: Decimal
    currency: str
    status: str
    metadata: dict[str, Any]


@dataclass(slots=True)
class TreasuryStatementResult:
    summary: TreasuryStatementSummary
    lines: list[TreasuryStatementLine]


# ============================================================
# 🛠️ Helpers
# ============================================================

def _money(value) -> Decimal:
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


def _build_transaction_number(prefix: str, object_id: int) -> str:
    return f"{prefix}-{object_id}"


def _resolve_transaction_type_from_payment(payment: Payment) -> str:
    """
    حاليًا جميع عمليات التحصيل تعتبر قبض.
    ويمكن لاحقًا تخصيص منطق مختلف لبعض الطرق.
    """
    return TreasuryTransactionType.INCOME


def _safe_getattr(obj, attr_name: str, default=None):
    try:
        return getattr(obj, attr_name, default)
    except Exception:
        return default


def _first_non_empty(*values):
    for value in values:
        if value not in (None, "", [], {}, ()):
            return value
    return None


def _resolve_payment_currency(payment: Payment) -> str:
    return str(
        _first_non_empty(
            _safe_getattr(payment, "currency"),
            "SAR",
        )
    )


def _resolve_payment_method(payment: Payment) -> str:
    return str(
        _first_non_empty(
            _safe_getattr(payment, "payment_method"),
            _safe_getattr(payment, "method"),
            "CASH",
        )
    ).upper()


def _resolve_payment_company_id(payment: Payment) -> Optional[int]:
    return _first_non_empty(
        _safe_getattr(payment, "company_id"),
        _safe_getattr(_safe_getattr(payment, "invoice"), "company_id"),
        _safe_getattr(_safe_getattr(payment, "order"), "company_id"),
        _safe_getattr(_safe_getattr(payment, "customer"), "company_id"),
    )


def _resolve_paid_amount(payment: Payment) -> Decimal:
    return _money(
        _first_non_empty(
            _safe_getattr(payment, "paid_amount"),
            _safe_getattr(payment, "amount"),
            _safe_getattr(payment, "total_amount"),
            "0.00",
        )
    )


def _resolve_payment_effective_date(payment: Payment):
    paid_at = _safe_getattr(payment, "paid_at")
    if paid_at:
        try:
            return paid_at.date()
        except Exception:
            pass

    payment_date = _safe_getattr(payment, "payment_date")
    if payment_date:
        return payment_date

    paid_date = _safe_getattr(payment, "paid_date")
    if paid_date:
        return paid_date

    date_value = _safe_getattr(payment, "date")
    if date_value:
        return date_value

    return timezone.localdate()


def _resolve_active_treasury_account_for_payment(payment: Payment) -> TreasuryAccount:
    """
    اختيار الحساب الخزيني الأنسب تلقائيًا للدفعة.

    منطق الاختيار الحالي:
    1) تقييد بالشركة إن وُجدت على الحساب
    2) تفضيل الحساب النشط
    3) تفضيل مطابقة العملة
    4) تفضيل الاسم حسب طريقة الدفع:
       - CASH => صندوق / نقد / cash
       - BANK / TRANSFER => بنك / bank
    5) fallback إلى أول حساب نشط مناسب
    """
    company_id = _resolve_payment_company_id(payment)
    currency = _resolve_payment_currency(payment)
    payment_method = _resolve_payment_method(payment)

    queryset = TreasuryAccount.objects.all()

    model_fields = {field.name for field in TreasuryAccount._meta.fields}

    if "status" in model_fields:
        queryset = queryset.filter(status="ACTIVE")

    if company_id and "company" in model_fields:
        queryset = queryset.filter(company_id=company_id)

    if "currency" in model_fields:
        currency_qs = queryset.filter(currency=currency)
        if currency_qs.exists():
            queryset = currency_qs

    preferred_keywords = []
    if payment_method in {"CASH"}:
        preferred_keywords = ["cash", "نقد", "صندوق"]
    elif payment_method in {"BANK", "BANK_TRANSFER", "TRANSFER"}:
        preferred_keywords = ["bank", "بنك"]
    else:
        preferred_keywords = []

    for keyword in preferred_keywords:
        candidate = queryset.filter(name__icontains=keyword).order_by("id").first()
        if candidate:
            return candidate

    candidate = queryset.order_by("id").first()
    if candidate:
        return candidate

    raise ValidationError("لا يوجد حساب خزينة نشط مناسب لربط الدفعة.")


def _resolve_payment_identifier_for_log(payment: Payment) -> str:
    return str(
        _first_non_empty(
            _safe_getattr(payment, "payment_number"),
            _safe_getattr(payment, "reference"),
            _safe_getattr(payment, "number"),
            _safe_getattr(payment, "pk"),
            "unknown-payment",
        )
    )


def _resolve_treasury_account_display_name(account: TreasuryAccount) -> str:
    return str(
        _first_non_empty(
            _safe_getattr(account, "name"),
            _safe_getattr(account, "account_name"),
            f"TreasuryAccount #{_safe_getattr(account, 'pk', 'unknown')}",
        )
    )


def _resolve_treasury_account_code(account: TreasuryAccount) -> str:
    return str(
        _first_non_empty(
            _safe_getattr(account, "account_number"),
            _safe_getattr(account, "code"),
            _safe_getattr(account, "iban"),
            "",
        )
    )


def _resolve_treasury_transaction_datetime(txn: TreasuryTransaction) -> datetime | None:
    value = _first_non_empty(
        _safe_getattr(txn, "created_at"),
        _safe_getattr(txn, "updated_at"),
    )
    if value:
        return _ensure_aware(value)

    tx_date = _safe_getattr(txn, "transaction_date")
    if tx_date:
        return _coerce_to_datetime(tx_date, end_of_day=False)

    return None


def _serialize_treasury_statement_summary(summary: TreasuryStatementSummary) -> dict[str, Any]:
    data = asdict(summary)
    for key in [
        "total_inflow_amount",
        "total_outflow_amount",
        "net_movement_amount",
    ]:
        data[key] = str(data[key])
    return data


def _serialize_treasury_statement_line(line: TreasuryStatementLine) -> dict[str, Any]:
    data = asdict(line)
    data["debit_amount"] = str(line.debit_amount)
    data["credit_amount"] = str(line.credit_amount)
    data["balance_after"] = str(line.balance_after)
    data["line_date"] = line.line_date.isoformat() if line.line_date else None
    return data


def _sort_datetime_fallback() -> datetime:
    return timezone.now()


# ============================================================
# 🧾 إنشاء حركة خزينة عامة
# ============================================================

@transaction.atomic
def create_treasury_transaction(
    *,
    transaction_number: str,
    transaction_type: str,
    treasury_account: TreasuryAccount,
    transaction_date,
    amount,
    currency: str = "SAR",
    status: str = TreasuryTransactionStatus.DRAFT,
    destination_account: Optional[TreasuryAccount] = None,
    reference: str = "",
    external_reference: str = "",
    description: str = "",
    notes: str = "",
    journal_entry_reference: str = "",
) -> TreasuryTransaction:
    """
    إنشاء حركة خزينة عامة.
    """
    txn, created = TreasuryTransaction.objects.get_or_create(
        transaction_number=transaction_number,
        defaults={
            "transaction_type": transaction_type,
            "status": status,
            "transaction_date": transaction_date,
            "treasury_account": treasury_account,
            "destination_account": destination_account,
            "amount": _money(amount),
            "currency": currency or treasury_account.currency or "SAR",
            "reference": reference,
            "external_reference": external_reference,
            "description": description,
            "notes": notes,
            "journal_entry_reference": journal_entry_reference,
        },
    )

    if not created:
        return txn

    return txn


# ============================================================
# ✅ تأكيد حركة خزينة
# ============================================================

@transaction.atomic
def confirm_treasury_transaction(
    transaction_obj: TreasuryTransaction,
) -> TreasuryTransaction:
    """
    تأكيد الحركة وتطبيق أثرها على الرصيد.
    """
    if not transaction_obj:
        raise ValidationError("حركة الخزينة مطلوبة.")

    if transaction_obj.status == TreasuryTransactionStatus.CANCELLED:
        raise ValidationError("لا يمكن تأكيد حركة خزينة ملغاة.")

    if transaction_obj.status == TreasuryTransactionStatus.CONFIRMED:
        return transaction_obj

    transaction_obj.status = TreasuryTransactionStatus.CONFIRMED
    transaction_obj.save(update_fields=["status", "updated_at"])
    transaction_obj.refresh_from_db()
    return transaction_obj


# ============================================================
# 💳 إنشاء حركة قبض من دفعة
# ============================================================

@transaction.atomic
def create_payment_receipt_transaction(
    payment: Payment,
    *,
    treasury_account: TreasuryAccount,
    auto_confirm: bool = True,
    post_to_accounting: bool = False,
) -> TreasuryTransaction:
    """
    إنشاء حركة قبض بالخزينة من دفعة مؤكدة/محصلة.
    ويمكن اختياريًا ترحيلها محاسبيًا أيضًا.
    """
    if not payment:
        raise ValidationError("الدفع مطلوب.")

    if payment.status not in {
        PaymentStatus.PAID,
        PaymentStatus.PARTIALLY_PAID,
        PaymentStatus.REFUNDED,
        PaymentStatus.PARTIALLY_REFUNDED,
    }:
        raise ValidationError("لا يمكن إنشاء حركة خزينة من دفعة غير محصلة فعليًا.")

    if treasury_account.status != "ACTIVE":
        raise ValidationError("الحساب الخزيني المحدد غير نشط.")

    paid_amount = _resolve_paid_amount(payment)
    if paid_amount <= Decimal("0.00"):
        raise ValidationError("المبلغ المدفوع يجب أن يكون أكبر من صفر.")

    payment_number = _first_non_empty(
        _safe_getattr(payment, "payment_number"),
        _safe_getattr(payment, "reference"),
        f"PAY-{payment.id}",
    )

    transaction_number = _build_transaction_number("TRX-PAY", payment.id)

    txn = create_treasury_transaction(
        transaction_number=transaction_number,
        transaction_type=_resolve_transaction_type_from_payment(payment),
        treasury_account=treasury_account,
        transaction_date=_resolve_payment_effective_date(payment),
        amount=paid_amount,
        currency=_resolve_payment_currency(payment) or treasury_account.currency or "SAR",
        status=(
            TreasuryTransactionStatus.CONFIRMED
            if auto_confirm
            else TreasuryTransactionStatus.DRAFT
        ),
        reference=f"PAYMENT:{payment.id}:TREASURY_RECEIPT",
        external_reference=payment_number,
        description=f"إثبات قبض دفعة رقم {payment_number} في الخزينة",
        notes=f"Order #{_safe_getattr(payment, 'order_id', '')}",
    )

    if auto_confirm and txn.status != TreasuryTransactionStatus.CONFIRMED:
        txn = confirm_treasury_transaction(txn)

    if post_to_accounting:
        from accounting.services import post_payment_receipt

        entry = post_payment_receipt(payment)
        if txn.journal_entry_reference != entry.entry_number:
            txn.journal_entry_reference = entry.entry_number
            txn.save(update_fields=["journal_entry_reference", "updated_at"])

    return txn


# ============================================================
# 🔗 Wrapper رسمي لمسار payments.services
# ============================================================

@transaction.atomic
def create_payment_receipt_movement(
    payment: Payment,
    *,
    actor=None,
    auto_confirm: bool = True,
    post_to_accounting: bool = False,
) -> TreasuryTransaction:
    """
    Wrapper رسمي متوافق مع payments.services.
    يختار الحساب الخزيني المناسب تلقائيًا ثم ينشئ حركة قبض.
    """
    if not payment:
        raise ValidationError("الدفع مطلوب.")

    treasury_account = _resolve_active_treasury_account_for_payment(payment)

    logger.info(
        "💳 إنشاء حركة قبض خزينة للدفعة %s باستخدام الحساب الخزيني %s",
        _resolve_payment_identifier_for_log(payment),
        treasury_account.pk,
    )

    return create_payment_receipt_transaction(
        payment,
        treasury_account=treasury_account,
        auto_confirm=auto_confirm,
        post_to_accounting=post_to_accounting,
    )


@transaction.atomic
def create_payment_treasury_movement(
    payment: Payment,
    *,
    actor=None,
    auto_confirm: bool = True,
    post_to_accounting: bool = False,
) -> TreasuryTransaction:
    """
    اسم بديل رسمي تبحث عنه payments.services.
    """
    return create_payment_receipt_movement(
        payment,
        actor=actor,
        auto_confirm=auto_confirm,
        post_to_accounting=post_to_accounting,
    )


# ============================================================
# 💸 إنشاء حركة صرف عمولة مندوب
# ============================================================

@transaction.atomic
def create_agent_commission_payout_transaction(
    *,
    treasury_account: TreasuryAccount,
    amount,
    reference: str,
    description: str,
    notes: str = "",
    auto_confirm: bool = True,
) -> TreasuryTransaction:
    """
    حركة صرف تشغيلية لعمولة مندوب أو أي صرف مشابه.
    """
    amount = _money(amount)
    if amount <= Decimal("0.00"):
        raise ValidationError("المبلغ يجب أن يكون أكبر من صفر.")

    transaction_number = f"TRX-COM-{reference}"

    txn = create_treasury_transaction(
        transaction_number=transaction_number,
        transaction_type=TreasuryTransactionType.EXPENSE,
        treasury_account=treasury_account,
        transaction_date=timezone.localdate(),
        amount=amount,
        currency=treasury_account.currency or "SAR",
        status=(
            TreasuryTransactionStatus.CONFIRMED
            if auto_confirm
            else TreasuryTransactionStatus.DRAFT
        ),
        reference=reference,
        description=description,
        notes=notes,
    )

    if auto_confirm and txn.status != TreasuryTransactionStatus.CONFIRMED:
        txn = confirm_treasury_transaction(txn)

    return txn


# ============================================================
# 📊 Treasury Statement — Summary
# ============================================================

def _build_treasury_statement_summary(
    treasury_account: TreasuryAccount,
    transactions_qs: QuerySet[TreasuryTransaction],
) -> TreasuryStatementSummary:
    inflow_total = Decimal("0.00")
    outflow_total = Decimal("0.00")

    for txn in transactions_qs:
        amount = _money(txn.amount)
        txn_type = str(_safe_getattr(txn, "transaction_type", ""))

        if txn_type == TreasuryTransactionType.INCOME:
            inflow_total += amount
        elif txn_type == TreasuryTransactionType.EXPENSE:
            outflow_total += amount
        elif txn_type == TreasuryTransactionType.TRANSFER:
            # التحويل لا نحسبه تلقائيًا داخل صافي هذا الحساب إلا
            # لاحقًا في V2 إذا أردنا دعم جهتي التحويل بدقة أعلى
            continue

    inflow_total = _money(inflow_total)
    outflow_total = _money(outflow_total)
    net_movement_amount = _money(inflow_total - outflow_total)

    return TreasuryStatementSummary(
        treasury_account_id=treasury_account.pk,
        treasury_account_name=_resolve_treasury_account_display_name(treasury_account),
        treasury_account_code=_resolve_treasury_account_code(treasury_account),
        treasury_account_status=str(_safe_getattr(treasury_account, "status", "")),
        currency=str(_safe_getattr(treasury_account, "currency", "SAR")),
        total_inflow_amount=inflow_total,
        total_outflow_amount=outflow_total,
        net_movement_amount=net_movement_amount,
        total_transactions_count=transactions_qs.count(),
        confirmed_transactions_count=transactions_qs.filter(
            status=TreasuryTransactionStatus.CONFIRMED
        ).count(),
    )


# ============================================================
# 📥 Treasury Statement Collectors
# ============================================================

def _collect_treasury_lines(
    transactions_qs: QuerySet[TreasuryTransaction],
    *,
    currency: str,
) -> list[dict[str, Any]]:
    lines: list[dict[str, Any]] = []

    for txn in transactions_qs.order_by("transaction_date", "id"):
        amount = _money(txn.amount)
        if amount <= Decimal("0.00"):
            continue

        txn_type = str(_safe_getattr(txn, "transaction_type", ""))
        debit_amount = Decimal("0.00")
        credit_amount = Decimal("0.00")

        if txn_type == TreasuryTransactionType.INCOME:
            debit_amount = amount
        elif txn_type == TreasuryTransactionType.EXPENSE:
            credit_amount = amount
        elif txn_type == TreasuryTransactionType.TRANSFER:
            # في V1 سنعرض التحويل بشكل معلوماتي على أنه حركة محايدة
            # ويمكن تطويره لاحقًا بحسب وجهة التحويل.
            debit_amount = Decimal("0.00")
            credit_amount = Decimal("0.00")

        lines.append(
            {
                "line_type": txn_type or "TREASURY",
                "line_date": _resolve_treasury_transaction_datetime(txn),
                "reference": _first_non_empty(
                    _safe_getattr(txn, "transaction_number"),
                    _safe_getattr(txn, "reference"),
                    f"TRX-{txn.pk}",
                ),
                "transaction_id": txn.pk,
                "description": _first_non_empty(
                    _safe_getattr(txn, "description"),
                    _safe_getattr(txn, "notes"),
                    f"حركة خزينة رقم {txn.pk}",
                ),
                "debit_amount": debit_amount,
                "credit_amount": credit_amount,
                "currency": _safe_getattr(txn, "currency", None) or currency,
                "status": str(_safe_getattr(txn, "status", "")),
                "metadata": {
                    "reference": _safe_getattr(txn, "reference"),
                    "external_reference": _safe_getattr(txn, "external_reference"),
                    "journal_entry_reference": _safe_getattr(txn, "journal_entry_reference"),
                    "destination_account_id": _safe_getattr(txn, "destination_account_id"),
                    "transaction_date": (
                        _safe_getattr(txn, "transaction_date").isoformat()
                        if _safe_getattr(txn, "transaction_date")
                        else None
                    ),
                },
            }
        )

    return lines


# ============================================================
# 🧾 Treasury Statement Builder
# ============================================================

def build_treasury_statement(
    treasury_account: TreasuryAccount,
    *,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    include_draft: bool = True,
    include_cancelled: bool = False,
) -> TreasuryStatementResult:
    """
    بناء كشف حساب الخزينة / البنك.

    الفكرة المالية في V1:
    - INCOME = مدين يزيد رصيد الحساب
    - EXPENSE = دائن يخفض رصيد الحساب
    - TRANSFER يظهر معلوماتيًا في هذه المرحلة
    """
    if not treasury_account:
        raise ValueError("treasury_account is required")

    start_dt = _start_of_day(date_from)
    end_dt = _end_of_day(date_to)

    transactions_qs = TreasuryTransaction.objects.filter(treasury_account=treasury_account)

    if "transaction_date" in {field.name for field in TreasuryTransaction._meta.fields}:
        if start_dt:
            transactions_qs = transactions_qs.filter(transaction_date__gte=start_dt.date())
        if end_dt:
            transactions_qs = transactions_qs.filter(transaction_date__lte=end_dt.date())

    if not include_draft:
        transactions_qs = transactions_qs.exclude(status=TreasuryTransactionStatus.DRAFT)

    if not include_cancelled:
        transactions_qs = transactions_qs.exclude(status=TreasuryTransactionStatus.CANCELLED)

    currency = str(_safe_getattr(treasury_account, "currency", "SAR"))

    summary = _build_treasury_statement_summary(
        treasury_account=treasury_account,
        transactions_qs=transactions_qs,
    )

    raw_lines = _collect_treasury_lines(
        transactions_qs=transactions_qs,
        currency=currency,
    )

    raw_lines.sort(
        key=lambda item: (
            item["line_date"] or _sort_datetime_fallback(),
            item["transaction_id"] or 0,
            item["line_type"],
        )
    )

    balance = Decimal("0.00")
    statement_lines: list[TreasuryStatementLine] = []

    for item in raw_lines:
        debit_amount = _money(item["debit_amount"])
        credit_amount = _money(item["credit_amount"])
        balance = _money(balance + debit_amount - credit_amount)

        statement_lines.append(
            TreasuryStatementLine(
                line_type=item["line_type"],
                line_date=item["line_date"],
                reference=item["reference"],
                transaction_id=item["transaction_id"],
                description=item["description"],
                debit_amount=debit_amount,
                credit_amount=credit_amount,
                balance_after=balance,
                currency=item["currency"],
                status=item["status"],
                metadata=item["metadata"],
            )
        )

    return TreasuryStatementResult(
        summary=summary,
        lines=statement_lines,
    )


# ============================================================
# 🌐 Treasury Statement Serialized Helpers
# ============================================================

def build_treasury_statement_payload(
    treasury_account: TreasuryAccount,
    *,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    include_draft: bool = True,
    include_cancelled: bool = False,
) -> dict[str, Any]:
    result = build_treasury_statement(
        treasury_account=treasury_account,
        date_from=date_from,
        date_to=date_to,
        include_draft=include_draft,
        include_cancelled=include_cancelled,
    )

    return {
        "summary": _serialize_treasury_statement_summary(result.summary),
        "lines": [_serialize_treasury_statement_line(line) for line in result.lines],
    }