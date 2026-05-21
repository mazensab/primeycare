# ============================================================
# 📂 treasury/services.py
# 🧠 Primey Care | Treasury Services
# ------------------------------------------------------------
# ✅ خدمات الخزينة الرسمية
# ✅ مبنية لتتكامل مع شجرة الحسابات والتوجيه المحاسبي
# ✅ تغطي:
#    - إنشاء حركة خزينة
#    - تأكيد حركة خزينة
#    - إلغاء حركة خزينة
#    - إنشاء حركة قبض من دفعة
#    - إنشاء سند قبض يدوي بحساب مقابل
#    - إنشاء سند صرف يدوي بحساب مقابل
#    - تسوية عهدة مندوب
#    - تسوية عهدة وسيط
#    - صرف مستحقات مندوب
#    - ربط حركة الخزينة بالقيد المحاسبي عند الطلب
#    - دوال ربط رسمية للدفعات من payments.services
#    - كشف حساب الخزينة / البنوك
# ------------------------------------------------------------
# قواعد مهمة:
# - التأكيد يتم مرة واحدة فقط.
# - الإلغاء يعكس أثر الحركة المؤكدة من داخل Model.
# - حركة الدفع لا تكرر القيد المحاسبي إذا كانت الدفعة مرحّلة أصلًا.
# - سند القبض/الصرف/التسوية/التحويل ينشئ قيدًا عند توفر الحساب المقابل.
# - عند إجبار post_to_accounting=True يجب توفر الحسابات المطلوبة وإلا يفشل بوضوح.
# ============================================================

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass
from datetime import date, datetime, time
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q, QuerySet
from django.utils import timezone

from payments.models import Payment, PaymentStatus
from treasury.models import (
    TreasuryAccount,
    TreasuryAccountStatus,
    TreasuryAccountType,
    TreasuryTransaction,
    TreasuryTransactionSource,
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


def _clean_text(value) -> str:
    return str(value or "").strip()


def _choice_value(value: Any) -> str:
    raw = getattr(value, "value", value)
    return str(raw or "").strip().upper()


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


def _build_transaction_number(prefix: str, object_id: int | str) -> str:
    if object_id in [None, ""]:
        raise ValidationError("لا يمكن بناء رقم حركة خزينة بدون معرف.")
    return f"{prefix}-{object_id}"


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


def _model_has_field(model_or_instance: Any, field_name: str) -> bool:
    try:
        model_or_instance._meta.get_field(field_name)
        return True
    except Exception:
        return False


def _set_model_field_if_exists(instance: Any, field_name: str, value: Any) -> bool:
    if _model_has_field(instance, field_name):
        setattr(instance, field_name, value)
        return True
    return False


def _save_existing_fields(instance: Any, fields: list[str]) -> None:
    update_fields = [field for field in dict.fromkeys(fields) if hasattr(instance, field)]
    if update_fields:
        instance.save(update_fields=update_fields)
    else:
        instance.save()


def _resolve_payment_currency(payment: Payment) -> str:
    return str(
        _first_non_empty(
            _safe_getattr(payment, "currency"),
            _safe_getattr(payment, "currency_code"),
            "SAR",
        )
    ).upper()


def _resolve_payment_method(payment: Payment) -> str:
    return _choice_value(
        _first_non_empty(
            _safe_getattr(payment, "payment_method"),
            _safe_getattr(payment, "method"),
            "CASH",
        )
    )


def _resolve_payment_provider(payment: Payment) -> str:
    return _choice_value(
        _first_non_empty(
            _safe_getattr(payment, "provider"),
            _safe_getattr(payment, "payment_provider"),
            _safe_getattr(payment, "gateway_provider"),
            "",
        )
    )


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


def _resolve_payment_fees_amount(payment: Payment) -> Decimal:
    return _money(
        _first_non_empty(
            _safe_getattr(payment, "fees_amount"),
            _safe_getattr(payment, "gateway_fee_amount"),
            _safe_getattr(payment, "gateway_fees"),
            "0.00",
        )
    )


def _resolve_payment_net_amount(payment: Payment) -> Decimal:
    explicit_net = _first_non_empty(
        _safe_getattr(payment, "net_amount"),
        _safe_getattr(payment, "settlement_amount"),
    )

    if explicit_net is not None:
        return _money(explicit_net)

    paid_amount = _resolve_paid_amount(payment)
    fees_amount = _resolve_payment_fees_amount(payment)
    return _money(paid_amount - fees_amount)


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


def _resolve_payment_number(payment: Payment) -> str:
    return str(
        _first_non_empty(
            _safe_getattr(payment, "payment_number"),
            _safe_getattr(payment, "reference"),
            _safe_getattr(payment, "number"),
            f"PAY-{payment.pk}",
        )
    )


def _resolve_payment_external_reference(payment: Payment) -> str:
    return str(
        _first_non_empty(
            _safe_getattr(payment, "gateway_reference"),
            _safe_getattr(payment, "external_reference"),
            _safe_getattr(payment, "provider_reference"),
            _safe_getattr(payment, "transaction_id"),
            _resolve_payment_number(payment),
        )
    )


def _resolve_payment_party_data(payment: Payment) -> tuple[str, str, str]:
    customer = _safe_getattr(payment, "customer", None)
    customer_id = _safe_getattr(payment, "customer_id", None)

    if customer_id:
        name = _first_non_empty(
            _safe_getattr(customer, "full_name"),
            f"{_safe_getattr(customer, 'first_name', '')} {_safe_getattr(customer, 'last_name', '')}".strip(),
            _safe_getattr(customer, "name"),
            _safe_getattr(customer, "email"),
            _safe_getattr(customer, "phone_number"),
            f"Customer #{customer_id}",
        )
        return "customer", str(customer_id), str(name or "")

    return "", "", ""


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


def _resolve_transaction_type_from_payment(payment: Payment) -> str:
    return TreasuryTransactionType.INCOME


def _resolve_source_from_payment(payment: Payment) -> str:
    provider = _resolve_payment_provider(payment)
    method = _resolve_payment_method(payment)

    if provider and provider not in {"INTERNAL", "CASH"}:
        return TreasuryTransactionSource.GATEWAY

    if method in {
        "GATEWAY",
        "ONLINE",
        "CARD",
        "CREDIT_CARD",
        "DEBIT_CARD",
        "MADA",
        "VISA",
        "MASTERCARD",
        "APPLE_PAY",
        "STC_PAY",
        "TAMARA",
        "TABBY",
        "TAP",
        "MOYASAR",
    }:
        return TreasuryTransactionSource.GATEWAY

    return TreasuryTransactionSource.PAYMENT


def _resolve_active_treasury_account_for_payment(payment: Payment) -> TreasuryAccount:
    company_id = _resolve_payment_company_id(payment)
    currency = _resolve_payment_currency(payment)
    payment_method = _resolve_payment_method(payment)
    payment_provider = _resolve_payment_provider(payment)

    queryset = TreasuryAccount.objects.filter(status=TreasuryAccountStatus.ACTIVE)

    if company_id and _model_has_field(TreasuryAccount, "company"):
        queryset = queryset.filter(company_id=company_id)

    currency_qs = queryset.filter(currency=currency)
    if currency_qs.exists():
        queryset = currency_qs

    if payment_method in {"CASH"}:
        typed_qs = queryset.filter(account_type=TreasuryAccountType.CASHBOX)
        if typed_qs.filter(is_default=True).exists():
            return typed_qs.filter(is_default=True).order_by("id").first()
        if typed_qs.exists():
            return typed_qs.order_by("id").first()

    if payment_method in {"BANK", "BANK_TRANSFER", "TRANSFER", "WIRE_TRANSFER"}:
        typed_qs = queryset.filter(account_type=TreasuryAccountType.BANK)
        if typed_qs.filter(is_default=True).exists():
            return typed_qs.filter(is_default=True).order_by("id").first()
        if typed_qs.exists():
            return typed_qs.order_by("id").first()

    gateway_methods = {
        "GATEWAY",
        "ONLINE",
        "CARD",
        "CREDIT_CARD",
        "DEBIT_CARD",
        "MADA",
        "VISA",
        "MASTERCARD",
        "APPLE_PAY",
        "STC_PAY",
        "TAMARA",
        "TABBY",
        "TAP",
        "MOYASAR",
    }

    if payment_method in gateway_methods or payment_provider not in {"", "INTERNAL", "CASH"}:
        gateway_qs = queryset.filter(account_type=TreasuryAccountType.GATEWAY)

        if payment_provider:
            provider_qs = gateway_qs.filter(provider_name__icontains=payment_provider)
            if provider_qs.exists():
                gateway_qs = provider_qs

        if gateway_qs.filter(is_default=True).exists():
            return gateway_qs.filter(is_default=True).order_by("id").first()

        if gateway_qs.exists():
            return gateway_qs.order_by("id").first()

        bank_qs = queryset.filter(account_type=TreasuryAccountType.BANK)
        if bank_qs.exists():
            return bank_qs.order_by("id").first()

    default_candidate = queryset.filter(is_default=True).order_by("id").first()
    if default_candidate:
        return default_candidate

    candidate = queryset.order_by("id").first()
    if candidate:
        return candidate

    raise ValidationError("لا يوجد حساب خزينة نشط مناسب لربط الدفعة.")


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
            _safe_getattr(account, "code"),
            _safe_getattr(account, "account_number"),
            _safe_getattr(account, "iban"),
            "",
        )
    )


def _resolve_treasury_transaction_datetime(txn: TreasuryTransaction) -> datetime | None:
    tx_date = _safe_getattr(txn, "transaction_date")
    if tx_date:
        return _coerce_to_datetime(tx_date, end_of_day=False)

    value = _first_non_empty(
        _safe_getattr(txn, "created_at"),
        _safe_getattr(txn, "updated_at"),
    )
    if value:
        return _ensure_aware(value)

    return None


def _sort_datetime_fallback() -> datetime:
    return timezone.now()


def _is_inflow_for_account(txn: TreasuryTransaction, treasury_account: TreasuryAccount) -> bool:
    txn_type = str(_safe_getattr(txn, "transaction_type", ""))

    if txn_type in {
        TreasuryTransactionType.INCOME,
        TreasuryTransactionType.OPENING_BALANCE,
        TreasuryTransactionType.DEPOSIT,
        TreasuryTransactionType.ADJUSTMENT,
    }:
        return txn.treasury_account_id == treasury_account.pk

    if txn_type == TreasuryTransactionType.TRANSFER:
        return txn.destination_account_id == treasury_account.pk

    return False


def _is_outflow_for_account(txn: TreasuryTransaction, treasury_account: TreasuryAccount) -> bool:
    txn_type = str(_safe_getattr(txn, "transaction_type", ""))

    if txn_type in {
        TreasuryTransactionType.EXPENSE,
        TreasuryTransactionType.WITHDRAW,
        TreasuryTransactionType.REFUND,
        TreasuryTransactionType.FEE,
    }:
        return txn.treasury_account_id == treasury_account.pk

    if txn_type == TreasuryTransactionType.TRANSFER:
        return txn.treasury_account_id == treasury_account.pk

    return False


def _safe_get_account_by_purpose(purpose: str):
    try:
        from accounting.models import Account

        return (
            Account.objects.filter(
                purpose=purpose,
                is_active=True,
                is_group=False,
            )
            .order_by("code", "id")
            .first()
        )
    except Exception:
        logger.exception("تعذر جلب الحساب حسب الغرض المحاسبي: %s", purpose)
        return None


def _resolve_agent_custody_account():
    from accounting.models import AccountingAccountPurpose

    return _safe_get_account_by_purpose(AccountingAccountPurpose.AGENT_CUSTODY)


def _resolve_broker_custody_account():
    from accounting.models import AccountingAccountPurpose

    return _safe_get_account_by_purpose(AccountingAccountPurpose.BROKER_CUSTODY)


def _resolve_agent_payable_account():
    from accounting.models import AccountingAccountPurpose

    return _safe_get_account_by_purpose(AccountingAccountPurpose.AGENT_COMMISSION_PAYABLE)


def _resolve_broker_payable_account():
    from accounting.models import AccountingAccountPurpose

    return _safe_get_account_by_purpose(AccountingAccountPurpose.BROKER_COMMISSION_PAYABLE)


def _has_accounting_link(txn: TreasuryTransaction) -> bool:
    return bool(
        _safe_getattr(txn, "journal_entry_id")
        or _clean_text(_safe_getattr(txn, "journal_entry_reference"))
    )


def _is_payment_backed_transaction(txn: TreasuryTransaction) -> bool:
    return (
        str(_safe_getattr(txn, "source_type", "")).lower() == "payment"
        or str(_safe_getattr(txn, "source", "")).upper() == str(TreasuryTransactionSource.PAYMENT).upper()
        or str(_safe_getattr(txn, "reference", "")).upper().startswith("PAYMENT:")
    )


def _has_counterparty_or_transfer(txn: TreasuryTransaction) -> bool:
    txn_type = str(_safe_getattr(txn, "transaction_type", ""))

    if txn_type == TreasuryTransactionType.TRANSFER:
        return bool(_safe_getattr(txn, "destination_account_id"))

    return bool(_safe_getattr(txn, "counterparty_ledger_account_id"))


def _should_auto_post_treasury_accounting(
    txn: TreasuryTransaction,
    *,
    explicit_post_to_accounting: bool | None,
) -> bool:
    if _has_accounting_link(txn):
        return False

    if explicit_post_to_accounting is False:
        return False

    if _is_payment_backed_transaction(txn):
        return explicit_post_to_accounting is True

    if explicit_post_to_accounting is True:
        return True

    return _has_counterparty_or_transfer(txn)


def _post_treasury_transaction_to_accounting_if_needed(
    txn: TreasuryTransaction,
    *,
    actor=None,
    post_to_accounting: bool | None = None,
) -> TreasuryTransaction:
    txn.refresh_from_db()

    if txn.status != TreasuryTransactionStatus.CONFIRMED:
        return txn

    should_post = _should_auto_post_treasury_accounting(
        txn,
        explicit_post_to_accounting=post_to_accounting,
    )

    if not should_post:
        return txn

    if post_to_accounting is True and not _has_counterparty_or_transfer(txn):
        raise ValidationError("لا يمكن إنشاء قيد محاسبي لحركة الخزينة بدون حساب مقابل أو حساب وجهة للتحويل.")

    if not _has_counterparty_or_transfer(txn):
        return txn

    from accounting.services import post_treasury_transaction_to_accounting

    entry = post_treasury_transaction_to_accounting(txn, actor=actor)
    txn.refresh_from_db()

    if entry and not _has_accounting_link(txn):
        if _model_has_field(txn, "journal_entry"):
            txn.journal_entry = entry

        if _model_has_field(txn, "journal_entry_reference"):
            txn.journal_entry_reference = entry.entry_number

        _save_existing_fields(txn, ["journal_entry", "journal_entry_reference", "updated_at"])

    return txn


# ============================================================
# 🔁 Serializers
# ============================================================

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
    counterparty_ledger_account=None,
    reference: str = "",
    external_reference: str = "",
    description: str = "",
    notes: str = "",
    journal_entry=None,
    journal_entry_reference: str = "",
    source: str = TreasuryTransactionSource.MANUAL,
    source_type: str = "",
    source_id: str = "",
    source_number: str = "",
    party_type: str = "",
    party_id: str = "",
    party_name: str = "",
    fees_amount=Decimal("0.00"),
    net_amount=None,
    metadata: Optional[dict[str, Any]] = None,
    actor=None,
    post_to_accounting: bool | None = None,
) -> TreasuryTransaction:
    """
    إنشاء حركة خزينة عامة.
    الدالة idempotent عبر transaction_number.

    عند status=CONFIRMED:
    - تطبق أثر الرصيد من Model.
    - تنشئ قيدًا محاسبيًا إذا post_to_accounting=True.
    - أو تلقائيًا للحركات غير التابعة للدفعات عند وجود counterparty_ledger_account أو transfer.
    """
    if not transaction_number:
        raise ValidationError("رقم حركة الخزينة مطلوب.")

    if not treasury_account:
        raise ValidationError("حساب الخزينة مطلوب.")

    if treasury_account.status != TreasuryAccountStatus.ACTIVE:
        raise ValidationError("لا يمكن إنشاء حركة على حساب خزينة غير نشط.")

    amount = _money(amount)
    fees_amount = _money(fees_amount)
    net_amount = _money(net_amount if net_amount is not None else amount - fees_amount)

    if amount <= Decimal("0.00"):
        raise ValidationError("مبلغ الحركة يجب أن يكون أكبر من صفر.")

    if fees_amount < Decimal("0.00"):
        raise ValidationError("مبلغ الرسوم لا يمكن أن يكون سالبًا.")

    if fees_amount > amount:
        raise ValidationError("مبلغ الرسوم لا يمكن أن يكون أكبر من مبلغ الحركة.")

    if net_amount <= Decimal("0.00"):
        raise ValidationError("صافي مبلغ الحركة يجب أن يكون أكبر من صفر.")

    if transaction_type == TreasuryTransactionType.TRANSFER and not destination_account:
        raise ValidationError("حساب الوجهة مطلوب في تحويلات الخزينة.")

    if destination_account and destination_account.pk == treasury_account.pk:
        raise ValidationError("لا يمكن التحويل إلى نفس حساب الخزينة.")

    defaults = {
        "transaction_type": transaction_type,
        "source": source or TreasuryTransactionSource.MANUAL,
        "status": status,
        "transaction_date": transaction_date or timezone.localdate(),
        "treasury_account": treasury_account,
        "destination_account": destination_account,
        "amount": amount,
        "fees_amount": fees_amount,
        "net_amount": net_amount,
        "currency": (currency or treasury_account.currency or "SAR").upper(),
        "reference": reference or "",
        "external_reference": external_reference or "",
        "description": description or "",
        "notes": notes or "",
        "journal_entry": journal_entry,
        "journal_entry_reference": journal_entry_reference or getattr(journal_entry, "entry_number", "") or "",
        "source_type": _clean_text(source_type),
        "source_id": _clean_text(source_id),
        "source_number": _clean_text(source_number),
        "party_type": _clean_text(party_type),
        "party_id": _clean_text(party_id),
        "party_name": _clean_text(party_name),
        "metadata": metadata or {},
    }

    if counterparty_ledger_account is not None and _model_has_field(TreasuryTransaction, "counterparty_ledger_account"):
        defaults["counterparty_ledger_account"] = counterparty_ledger_account

    if actor is not None and getattr(actor, "is_authenticated", False):
        if _model_has_field(TreasuryTransaction, "created_by"):
            defaults["created_by"] = actor

    txn, created = TreasuryTransaction.objects.get_or_create(
        transaction_number=transaction_number,
        defaults=defaults,
    )

    if not created:
        if txn.status == TreasuryTransactionStatus.CANCELLED:
            return txn

        if txn.status == TreasuryTransactionStatus.CONFIRMED:
            return _post_treasury_transaction_to_accounting_if_needed(
                txn,
                actor=actor,
                post_to_accounting=post_to_accounting,
            )

        for field_name, value in defaults.items():
            if hasattr(txn, field_name):
                setattr(txn, field_name, value)

        txn.save()

    if status == TreasuryTransactionStatus.CONFIRMED:
        txn = confirm_treasury_transaction(
            txn,
            actor=actor,
            post_to_accounting=post_to_accounting,
        )

    return txn


# ============================================================
# ✅ تأكيد حركة خزينة
# ============================================================

@transaction.atomic
def confirm_treasury_transaction(
    transaction_obj: TreasuryTransaction,
    *,
    actor=None,
    post_to_accounting: bool | None = None,
) -> TreasuryTransaction:
    """
    تأكيد الحركة وتطبيق أثرها على الرصيد.
    بعدها يتم إنشاء القيد المحاسبي إذا كان مطلوبًا أو إذا كانت حركة مستقلة لها حساب مقابل.
    """
    if not transaction_obj:
        raise ValidationError("حركة الخزينة مطلوبة.")

    transaction_obj = TreasuryTransaction.objects.select_for_update().get(
        pk=transaction_obj.pk
    )

    if transaction_obj.status == TreasuryTransactionStatus.CANCELLED:
        raise ValidationError("لا يمكن تأكيد حركة خزينة ملغاة.")

    if transaction_obj.status != TreasuryTransactionStatus.CONFIRMED:
        if hasattr(transaction_obj, "mark_as_confirmed"):
            transaction_obj.mark_as_confirmed(actor=actor)
        else:
            transaction_obj.status = TreasuryTransactionStatus.CONFIRMED
            if actor is not None and getattr(actor, "is_authenticated", False):
                if _model_has_field(transaction_obj, "confirmed_by"):
                    transaction_obj.confirmed_by = actor
            _save_existing_fields(transaction_obj, ["status", "confirmed_by", "updated_at"])

    transaction_obj.refresh_from_db()

    transaction_obj = _post_treasury_transaction_to_accounting_if_needed(
        transaction_obj,
        actor=actor,
        post_to_accounting=post_to_accounting,
    )

    transaction_obj.refresh_from_db()
    return transaction_obj


# ============================================================
# ❌ إلغاء حركة خزينة
# ============================================================

@transaction.atomic
def cancel_treasury_transaction(
    transaction_obj: TreasuryTransaction,
    *,
    actor=None,
    reason: str = "",
) -> TreasuryTransaction:
    """
    إلغاء حركة خزينة.
    إذا كانت الحركة مؤكدة سيتم عكس أثرها على الرصيد من داخل Model.
    ملاحظة: عكس القيد المحاسبي يدار من المحاسبة عند الحاجة ولا يتم حذفه.
    """
    if not transaction_obj:
        raise ValidationError("حركة الخزينة مطلوبة.")

    transaction_obj = TreasuryTransaction.objects.select_for_update().get(
        pk=transaction_obj.pk
    )

    if transaction_obj.status == TreasuryTransactionStatus.CANCELLED:
        return transaction_obj

    if hasattr(transaction_obj, "mark_as_cancelled"):
        transaction_obj.mark_as_cancelled(actor=actor, reason=reason)
    else:
        transaction_obj.status = TreasuryTransactionStatus.CANCELLED
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
    actor=None,
) -> TreasuryTransaction:
    """
    إنشاء حركة قبض بالخزينة من دفعة مؤكدة/محصلة.

    القاعدة:
    - افتراضيًا لا ننشئ قيدًا جديدًا للحركة لأن post_payment_receipt ينشئ قيد الدفعة.
    - إذا مررنا post_to_accounting=True يتم ربط الحركة بقيد الدفعة نفسه لا إنشاء أثر مزدوج.
    """
    if not payment:
        raise ValidationError("الدفع مطلوب.")

    if payment.status not in {
        PaymentStatus.PAID,
        PaymentStatus.PARTIALLY_PAID,
    }:
        raise ValidationError("لا يمكن إنشاء حركة خزينة من دفعة غير محصلة فعليًا.")

    if treasury_account.status != TreasuryAccountStatus.ACTIVE:
        raise ValidationError("الحساب الخزيني المحدد غير نشط.")

    paid_amount = _resolve_paid_amount(payment)
    fees_amount = _resolve_payment_fees_amount(payment)
    net_amount = _resolve_payment_net_amount(payment)

    if paid_amount <= Decimal("0.00"):
        raise ValidationError("المبلغ المدفوع يجب أن يكون أكبر من صفر.")

    payment_number = _resolve_payment_number(payment)
    external_reference = _resolve_payment_external_reference(payment)
    transaction_number = _build_transaction_number("TRX-PAY", payment.pk)

    party_type, party_id, party_name = _resolve_payment_party_data(payment)

    entry = None
    if post_to_accounting:
        from accounting.services import post_payment_receipt

        entry = post_payment_receipt(payment, actor=actor)

    txn = create_treasury_transaction(
        transaction_number=transaction_number,
        transaction_type=_resolve_transaction_type_from_payment(payment),
        source=_resolve_source_from_payment(payment),
        treasury_account=treasury_account,
        transaction_date=_resolve_payment_effective_date(payment),
        amount=paid_amount,
        fees_amount=fees_amount,
        net_amount=net_amount,
        currency=_resolve_payment_currency(payment) or treasury_account.currency or "SAR",
        status=(
            TreasuryTransactionStatus.CONFIRMED
            if auto_confirm
            else TreasuryTransactionStatus.DRAFT
        ),
        reference=f"PAYMENT:{payment.pk}:TREASURY_RECEIPT",
        external_reference=external_reference,
        description=f"إثبات قبض دفعة رقم {payment_number} في الخزينة",
        notes=f"Order #{_safe_getattr(payment, 'order_id', '')}",
        journal_entry=entry,
        journal_entry_reference=getattr(entry, "entry_number", "") if entry else "",
        source_type="payment",
        source_id=str(payment.pk),
        source_number=payment_number,
        party_type=party_type,
        party_id=party_id,
        party_name=party_name,
        metadata={
            "payment_method": _resolve_payment_method(payment),
            "payment_provider": _resolve_payment_provider(payment),
            "order_id": _safe_getattr(payment, "order_id", None),
            "invoice_id": _safe_getattr(payment, "invoice_id", None),
            "customer_id": _safe_getattr(payment, "customer_id", None),
            "accounting_policy": "payment_entry_reused_if_post_to_accounting_true",
        },
        actor=actor,
        post_to_accounting=False,
    )

    if auto_confirm and txn.status != TreasuryTransactionStatus.CONFIRMED:
        txn = confirm_treasury_transaction(txn, actor=actor, post_to_accounting=False)

    if entry and (txn.journal_entry_id != entry.pk or txn.journal_entry_reference != entry.entry_number):
        if _model_has_field(txn, "journal_entry"):
            txn.journal_entry = entry
        if _model_has_field(txn, "journal_entry_reference"):
            txn.journal_entry_reference = entry.entry_number
        _save_existing_fields(txn, ["journal_entry", "journal_entry_reference", "updated_at"])

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
        actor=actor,
    )


@transaction.atomic
def create_payment_treasury_movement(
    payment: Payment,
    *,
    actor=None,
    auto_confirm: bool = True,
    post_to_accounting: bool = False,
) -> TreasuryTransaction:
    return create_payment_receipt_movement(
        payment,
        actor=actor,
        auto_confirm=auto_confirm,
        post_to_accounting=post_to_accounting,
    )


# ============================================================
# 🧾 سند قبض عام
# ============================================================

@transaction.atomic
def create_receipt_voucher_transaction(
    *,
    treasury_account: TreasuryAccount,
    amount,
    counterparty_ledger_account=None,
    transaction_date=None,
    reference: str = "",
    external_reference: str = "",
    description: str = "",
    notes: str = "",
    party_type: str = "",
    party_id: str = "",
    party_name: str = "",
    source: str = TreasuryTransactionSource.MANUAL,
    source_type: str = "manual_receipt",
    source_id: str = "",
    source_number: str = "",
    auto_confirm: bool = True,
    post_to_accounting: bool = True,
    actor=None,
) -> TreasuryTransaction:
    """
    سند قبض مستقل:
    من حـ/الخزينة
      إلى حـ/الحساب المقابل
    """
    transaction_number = _build_transaction_number(
        "TRX-RCV",
        _first_non_empty(source_number, source_id, reference, int(timezone.now().timestamp())),
    )

    txn = create_treasury_transaction(
        transaction_number=transaction_number,
        transaction_type=TreasuryTransactionType.INCOME,
        source=source,
        treasury_account=treasury_account,
        counterparty_ledger_account=counterparty_ledger_account,
        transaction_date=transaction_date or timezone.localdate(),
        amount=amount,
        fees_amount=Decimal("0.00"),
        net_amount=amount,
        currency=treasury_account.currency or "SAR",
        status=TreasuryTransactionStatus.DRAFT,
        reference=reference,
        external_reference=external_reference,
        description=description or "سند قبض",
        notes=notes,
        source_type=source_type,
        source_id=str(source_id or ""),
        source_number=str(source_number or reference or ""),
        party_type=party_type,
        party_id=str(party_id or ""),
        party_name=party_name,
        metadata={"voucher_type": "receipt"},
        actor=actor,
        post_to_accounting=False,
    )

    if auto_confirm:
        txn = confirm_treasury_transaction(
            txn,
            actor=actor,
            post_to_accounting=post_to_accounting,
        )

    return txn


# ============================================================
# 🧾 سند صرف عام
# ============================================================

@transaction.atomic
def create_payment_voucher_transaction(
    *,
    treasury_account: TreasuryAccount,
    amount,
    counterparty_ledger_account=None,
    transaction_date=None,
    reference: str = "",
    external_reference: str = "",
    description: str = "",
    notes: str = "",
    party_type: str = "",
    party_id: str = "",
    party_name: str = "",
    source: str = TreasuryTransactionSource.MANUAL,
    source_type: str = "manual_payment",
    source_id: str = "",
    source_number: str = "",
    auto_confirm: bool = True,
    post_to_accounting: bool = True,
    actor=None,
) -> TreasuryTransaction:
    """
    سند صرف مستقل:
    من حـ/الحساب المقابل
      إلى حـ/الخزينة
    """
    transaction_number = _build_transaction_number(
        "TRX-PMT",
        _first_non_empty(source_number, source_id, reference, int(timezone.now().timestamp())),
    )

    txn = create_treasury_transaction(
        transaction_number=transaction_number,
        transaction_type=TreasuryTransactionType.EXPENSE,
        source=source,
        treasury_account=treasury_account,
        counterparty_ledger_account=counterparty_ledger_account,
        transaction_date=transaction_date or timezone.localdate(),
        amount=amount,
        fees_amount=Decimal("0.00"),
        net_amount=amount,
        currency=treasury_account.currency or "SAR",
        status=TreasuryTransactionStatus.DRAFT,
        reference=reference,
        external_reference=external_reference,
        description=description or "سند صرف",
        notes=notes,
        source_type=source_type,
        source_id=str(source_id or ""),
        source_number=str(source_number or reference or ""),
        party_type=party_type,
        party_id=str(party_id or ""),
        party_name=party_name,
        metadata={"voucher_type": "payment"},
        actor=actor,
        post_to_accounting=False,
    )

    if auto_confirm:
        txn = confirm_treasury_transaction(
            txn,
            actor=actor,
            post_to_accounting=post_to_accounting,
        )

    return txn


# ============================================================
# 🤝 تسوية عهدة مندوب / وسيط
# ============================================================

@transaction.atomic
def create_agent_custody_settlement_transaction(
    *,
    treasury_account: TreasuryAccount,
    agent,
    amount,
    reference: str = "",
    notes: str = "",
    auto_confirm: bool = True,
    post_to_accounting: bool = True,
    actor=None,
) -> TreasuryTransaction:
    """
    توريد عهدة مندوب:
    من حـ/الخزينة
      إلى حـ/عهدة المندوبين
    """
    custody_account = _resolve_agent_custody_account()
    if not custody_account and post_to_accounting:
        raise ValidationError("حساب عهدة المندوبين غير موجود في شجرة الحسابات.")

    agent_id = _safe_getattr(agent, "pk", None)
    agent_name = _first_non_empty(
        _safe_getattr(agent, "full_name"),
        _safe_getattr(agent, "name"),
        f"Agent #{agent_id}" if agent_id else "",
    )
    agent_code = _first_non_empty(
        _safe_getattr(agent, "agent_code"),
        _safe_getattr(agent, "code"),
        agent_id,
    )

    return create_receipt_voucher_transaction(
        treasury_account=treasury_account,
        amount=amount,
        counterparty_ledger_account=custody_account,
        reference=reference or f"AGENT-CUSTODY-SETTLEMENT:{agent_code}",
        description=f"توريد عهدة مندوب {agent_name}",
        notes=notes,
        party_type="agent",
        party_id=str(agent_id or ""),
        party_name=str(agent_name or ""),
        source=TreasuryTransactionSource.MANUAL,
        source_type="agent_custody_settlement",
        source_id=str(agent_id or ""),
        source_number=str(reference or agent_code or ""),
        auto_confirm=auto_confirm,
        post_to_accounting=post_to_accounting,
        actor=actor,
    )


@transaction.atomic
def create_broker_custody_settlement_transaction(
    *,
    treasury_account: TreasuryAccount,
    broker,
    amount,
    reference: str = "",
    notes: str = "",
    auto_confirm: bool = True,
    post_to_accounting: bool = True,
    actor=None,
) -> TreasuryTransaction:
    """
    توريد عهدة وسيط:
    من حـ/الخزينة
      إلى حـ/عهدة الوسطاء
    """
    custody_account = _resolve_broker_custody_account()
    if not custody_account and post_to_accounting:
        raise ValidationError("حساب عهدة الوسطاء غير موجود في شجرة الحسابات.")

    broker_id = _safe_getattr(broker, "pk", None)
    broker_name = _first_non_empty(
        _safe_getattr(broker, "full_name"),
        _safe_getattr(broker, "name"),
        f"Broker #{broker_id}" if broker_id else "",
    )
    broker_code = _first_non_empty(
        _safe_getattr(broker, "broker_code"),
        _safe_getattr(broker, "code"),
        broker_id,
    )

    return create_receipt_voucher_transaction(
        treasury_account=treasury_account,
        amount=amount,
        counterparty_ledger_account=custody_account,
        reference=reference or f"BROKER-CUSTODY-SETTLEMENT:{broker_code}",
        description=f"توريد عهدة وسيط {broker_name}",
        notes=notes,
        party_type="broker",
        party_id=str(broker_id or ""),
        party_name=str(broker_name or ""),
        source=TreasuryTransactionSource.MANUAL,
        source_type="broker_custody_settlement",
        source_id=str(broker_id or ""),
        source_number=str(reference or broker_code or ""),
        auto_confirm=auto_confirm,
        post_to_accounting=post_to_accounting,
        actor=actor,
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
    post_to_accounting: bool = True,
    commission=None,
    actor=None,
) -> TreasuryTransaction:
    """
    حركة صرف تشغيلية لعمولة مندوب.

    القيد عند الصرف:
    من حـ/مستحقات المندوبين
      إلى حـ/الخزينة
    """
    amount = _money(amount)
    if amount <= Decimal("0.00"):
        raise ValidationError("المبلغ يجب أن يكون أكبر من صفر.")

    if not treasury_account:
        raise ValidationError("حساب الخزينة مطلوب.")

    if treasury_account.status != TreasuryAccountStatus.ACTIVE:
        raise ValidationError("الحساب الخزيني المحدد غير نشط.")

    payable_account = _resolve_agent_payable_account()
    if not payable_account and post_to_accounting:
        raise ValidationError("حساب مستحقات المندوبين غير موجود في شجرة الحسابات.")

    transaction_number = f"TRX-COM-{reference}"

    agent_id = _safe_getattr(commission, "agent_id", None) if commission else None
    agent = _safe_getattr(commission, "agent", None) if commission else None
    agent_name = _first_non_empty(
        _safe_getattr(agent, "full_name", None),
        _safe_getattr(agent, "name", None),
        f"Agent #{agent_id}" if agent_id else "",
    )

    txn = create_treasury_transaction(
        transaction_number=transaction_number,
        transaction_type=TreasuryTransactionType.EXPENSE,
        source=TreasuryTransactionSource.AGENT_COMMISSION,
        treasury_account=treasury_account,
        counterparty_ledger_account=payable_account,
        transaction_date=timezone.localdate(),
        amount=amount,
        fees_amount=Decimal("0.00"),
        net_amount=amount,
        currency=treasury_account.currency or "SAR",
        status=TreasuryTransactionStatus.DRAFT,
        reference=reference,
        external_reference=str(_safe_getattr(commission, "pk", "")) if commission else reference,
        description=description,
        notes=notes,
        source_type="agent_commission_payout",
        source_id=str(_safe_getattr(commission, "pk", "")) if commission else "",
        source_number=str(reference or ""),
        party_type="agent" if agent_id else "",
        party_id=str(agent_id or ""),
        party_name=str(agent_name or ""),
        metadata={
            "commission_id": _safe_getattr(commission, "pk", None) if commission else None,
            "order_id": _safe_getattr(commission, "order_id", None) if commission else None,
            "payment_id": _safe_getattr(commission, "payment_id", None) if commission else None,
            "payout_type": "agent_commission",
        },
        actor=actor,
        post_to_accounting=False,
    )

    if auto_confirm:
        txn = confirm_treasury_transaction(
            txn,
            actor=actor,
            post_to_accounting=post_to_accounting,
        )

    return txn


# ============================================================
# 🔁 تحويل بين حسابين خزينة
# ============================================================

@transaction.atomic
def create_treasury_transfer_transaction(
    *,
    source_account: TreasuryAccount,
    destination_account: TreasuryAccount,
    amount,
    transaction_date=None,
    reference: str = "",
    external_reference: str = "",
    description: str = "",
    notes: str = "",
    auto_confirm: bool = True,
    post_to_accounting: bool = True,
    actor=None,
) -> TreasuryTransaction:
    """
    تحويل بين خزينة وبنك/صندوق:
    من حـ/حساب الوجهة
      إلى حـ/حساب المصدر
    """
    transfer_ref = reference or f"TRANSFER-{source_account.pk}-{destination_account.pk}-{int(timezone.now().timestamp())}"

    txn = create_treasury_transaction(
        transaction_number=_build_transaction_number("TRX-TRF", transfer_ref),
        transaction_type=TreasuryTransactionType.TRANSFER,
        source=TreasuryTransactionSource.TRANSFER if hasattr(TreasuryTransactionSource, "TRANSFER") else TreasuryTransactionSource.MANUAL,
        treasury_account=source_account,
        destination_account=destination_account,
        transaction_date=transaction_date or timezone.localdate(),
        amount=amount,
        fees_amount=Decimal("0.00"),
        net_amount=amount,
        currency=source_account.currency or destination_account.currency or "SAR",
        status=TreasuryTransactionStatus.DRAFT,
        reference=transfer_ref,
        external_reference=external_reference,
        description=description or f"تحويل من {source_account} إلى {destination_account}",
        notes=notes,
        source_type="treasury_transfer",
        source_id="",
        source_number=transfer_ref,
        metadata={"transfer_type": "internal_treasury_transfer"},
        actor=actor,
        post_to_accounting=False,
    )

    if auto_confirm:
        txn = confirm_treasury_transaction(
            txn,
            actor=actor,
            post_to_accounting=post_to_accounting,
        )

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
        amount = _money(
            _first_non_empty(
                _safe_getattr(txn, "net_amount", None),
                _safe_getattr(txn, "amount", None),
            )
        )

        if _is_inflow_for_account(txn, treasury_account):
            inflow_total += amount

        if _is_outflow_for_account(txn, treasury_account):
            outflow_total += amount

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
    treasury_account: TreasuryAccount,
    currency: str,
) -> list[dict[str, Any]]:
    lines: list[dict[str, Any]] = []

    for txn in transactions_qs.order_by("transaction_date", "id"):
        amount = _money(
            _first_non_empty(
                _safe_getattr(txn, "net_amount", None),
                _safe_getattr(txn, "amount", None),
            )
        )

        if amount <= Decimal("0.00"):
            continue

        txn_type = str(_safe_getattr(txn, "transaction_type", ""))

        debit_amount = Decimal("0.00")
        credit_amount = Decimal("0.00")

        if _is_inflow_for_account(txn, treasury_account):
            debit_amount = amount

        if _is_outflow_for_account(txn, treasury_account):
            credit_amount = amount

        if debit_amount == Decimal("0.00") and credit_amount == Decimal("0.00"):
            continue

        line_description = _first_non_empty(
            _safe_getattr(txn, "description"),
            _safe_getattr(txn, "notes"),
            f"حركة خزينة رقم {txn.pk}",
        )

        if txn_type == TreasuryTransactionType.TRANSFER:
            if txn.destination_account_id == treasury_account.pk:
                line_description = f"تحويل وارد: {line_description}"
            elif txn.treasury_account_id == treasury_account.pk:
                line_description = f"تحويل صادر: {line_description}"

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
                "description": line_description,
                "debit_amount": debit_amount,
                "credit_amount": credit_amount,
                "currency": _safe_getattr(txn, "currency", None) or currency,
                "status": str(_safe_getattr(txn, "status", "")),
                "metadata": {
                    "reference": _safe_getattr(txn, "reference"),
                    "external_reference": _safe_getattr(txn, "external_reference"),
                    "source": _safe_getattr(txn, "source"),
                    "source_type": _safe_getattr(txn, "source_type"),
                    "source_id": _safe_getattr(txn, "source_id"),
                    "source_number": _safe_getattr(txn, "source_number"),
                    "party_type": _safe_getattr(txn, "party_type"),
                    "party_id": _safe_getattr(txn, "party_id"),
                    "party_name": _safe_getattr(txn, "party_name"),
                    "amount": str(_money(_safe_getattr(txn, "amount", "0.00"))),
                    "fees_amount": str(_money(_safe_getattr(txn, "fees_amount", "0.00"))),
                    "net_amount": str(_money(_safe_getattr(txn, "net_amount", "0.00"))),
                    "journal_entry_id": _safe_getattr(txn, "journal_entry_id"),
                    "journal_entry_reference": _safe_getattr(txn, "journal_entry_reference"),
                    "counterparty_ledger_account_id": _safe_getattr(txn, "counterparty_ledger_account_id"),
                    "source_account_id": _safe_getattr(txn, "treasury_account_id"),
                    "destination_account_id": _safe_getattr(txn, "destination_account_id"),
                    "balance_before": str(_money(_safe_getattr(txn, "balance_before", "0.00"))),
                    "balance_after": str(_money(_safe_getattr(txn, "balance_after", "0.00"))),
                    "balance_applied": bool(_safe_getattr(txn, "balance_applied", False)),
                    "balance_reversed": bool(_safe_getattr(txn, "balance_reversed", False)),
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
    if not treasury_account:
        raise ValueError("treasury_account is required")

    start_dt = _start_of_day(date_from)
    end_dt = _end_of_day(date_to)

    transactions_qs = TreasuryTransaction.objects.filter(
        Q(treasury_account=treasury_account)
        | Q(destination_account=treasury_account)
    ).select_related(
        "treasury_account",
        "destination_account",
        "journal_entry",
    )

    if _model_has_field(TreasuryTransaction, "counterparty_ledger_account"):
        transactions_qs = transactions_qs.select_related("counterparty_ledger_account")

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
        treasury_account=treasury_account,
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