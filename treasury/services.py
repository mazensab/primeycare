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
#    - إنشاء حركة صرف عمولة مندوب
#    - ربط حركة الخزينة بالقيد المحاسبي عند الطلب
#    - دوال ربط رسمية للدفعات من payments.services
#    - كشف حساب الخزينة / البنوك
# ------------------------------------------------------------
# ملاحظات:
# - التأكيد يتم مرة واحدة فقط.
# - الإلغاء يعكس أثر الحركة المؤكدة من داخل Model.
# - يدعم التحويلات الواردة والصادرة في كشف الحساب.
# - يدعم الحقول الجديدة: source/source_type/source_id/source_number.
# - يدعم الربط المباشر مع JournalEntry.
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


def _resolve_payment_currency(payment: Payment) -> str:
    return str(
        _first_non_empty(
            _safe_getattr(payment, "currency"),
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
    """
    الدفعة المحصلة تعتبر قبض خزينة.
    """
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
    """
    اختيار الحساب الخزيني الأنسب تلقائيًا للدفعة.

    المنطق:
    1) النشطة فقط
    2) مطابقة الشركة إذا كان الحقل موجودًا مستقبلًا
    3) مطابقة العملة
    4) تفضيل الحساب الافتراضي المناسب
    5) اختيار النوع حسب طريقة الدفع/المزود:
       - CASH => CASHBOX
       - BANK_TRANSFER => BANK
       - gateway/card/wallet/Tamara/Tabby/Tap/Moyasar => GATEWAY ثم BANK fallback
    6) fallback إلى أول حساب نشط مناسب
    """
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
) -> TreasuryTransaction:
    """
    إنشاء حركة خزينة عامة.
    الدالة idempotent عبر transaction_number.
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

    if actor is not None and getattr(actor, "is_authenticated", False):
        defaults["created_by"] = actor

    txn, created = TreasuryTransaction.objects.get_or_create(
        transaction_number=transaction_number,
        defaults=defaults,
    )

    if not created:
        if txn.status == TreasuryTransactionStatus.CANCELLED:
            return txn

        if txn.status == TreasuryTransactionStatus.CONFIRMED:
            return txn

        for field_name, value in defaults.items():
            setattr(txn, field_name, value)

        txn.save()

    return txn


# ============================================================
# ✅ تأكيد حركة خزينة
# ============================================================

@transaction.atomic
def confirm_treasury_transaction(
    transaction_obj: TreasuryTransaction,
    *,
    actor=None,
) -> TreasuryTransaction:
    """
    تأكيد الحركة وتطبيق أثرها على الرصيد.
    """
    if not transaction_obj:
        raise ValidationError("حركة الخزينة مطلوبة.")

    transaction_obj = TreasuryTransaction.objects.select_for_update().get(
        pk=transaction_obj.pk
    )

    if transaction_obj.status == TreasuryTransactionStatus.CANCELLED:
        raise ValidationError("لا يمكن تأكيد حركة خزينة ملغاة.")

    if transaction_obj.status == TreasuryTransactionStatus.CONFIRMED:
        return transaction_obj

    if hasattr(transaction_obj, "mark_as_confirmed"):
        transaction_obj.mark_as_confirmed(actor=actor)
    else:
        transaction_obj.status = TreasuryTransactionStatus.CONFIRMED
        if actor is not None and getattr(actor, "is_authenticated", False):
            transaction_obj.confirmed_by = actor
        transaction_obj.save(update_fields=["status", "confirmed_by", "updated_at"])

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
    ويمكن اختياريًا ترحيلها محاسبيًا وربط الحركة بالقيد.
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
        },
        actor=actor,
    )

    if auto_confirm and txn.status != TreasuryTransactionStatus.CONFIRMED:
        txn = confirm_treasury_transaction(txn, actor=actor)

    if entry and (txn.journal_entry_id != entry.pk or txn.journal_entry_reference != entry.entry_number):
        txn.journal_entry = entry
        txn.journal_entry_reference = entry.entry_number
        txn.save(update_fields=["journal_entry", "journal_entry_reference", "updated_at"])

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
    post_to_accounting: bool = False,
    commission=None,
    actor=None,
) -> TreasuryTransaction:
    """
    حركة صرف تشغيلية لعمولة مندوب أو أي صرف مشابه.
    """
    amount = _money(amount)
    if amount <= Decimal("0.00"):
        raise ValidationError("المبلغ يجب أن يكون أكبر من صفر.")

    if not treasury_account:
        raise ValidationError("حساب الخزينة مطلوب.")

    if treasury_account.status != TreasuryAccountStatus.ACTIVE:
        raise ValidationError("الحساب الخزيني المحدد غير نشط.")

    entry = None
    if post_to_accounting and commission is not None:
        from accounting.services import post_agent_commission_accrual

        entry = post_agent_commission_accrual(commission, actor=actor)

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
        transaction_date=timezone.localdate(),
        amount=amount,
        fees_amount=Decimal("0.00"),
        net_amount=amount,
        currency=treasury_account.currency or "SAR",
        status=(
            TreasuryTransactionStatus.CONFIRMED
            if auto_confirm
            else TreasuryTransactionStatus.DRAFT
        ),
        reference=reference,
        external_reference=str(_safe_getattr(commission, "pk", "")) if commission else reference,
        description=description,
        notes=notes,
        journal_entry=entry,
        journal_entry_reference=getattr(entry, "entry_number", "") if entry else "",
        source_type="agent_commission",
        source_id=str(_safe_getattr(commission, "pk", "")) if commission else "",
        source_number=str(reference or ""),
        party_type="agent" if agent_id else "",
        party_id=str(agent_id or ""),
        party_name=str(agent_name or ""),
        metadata={
            "commission_id": _safe_getattr(commission, "pk", None) if commission else None,
            "order_id": _safe_getattr(commission, "order_id", None) if commission else None,
            "payment_id": _safe_getattr(commission, "payment_id", None) if commission else None,
        },
        actor=actor,
    )

    if auto_confirm and txn.status != TreasuryTransactionStatus.CONFIRMED:
        txn = confirm_treasury_transaction(txn, actor=actor)

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
    """
    بناء كشف حساب الخزينة / البنك.

    الفكرة المالية:
    - INCOME / OPENING_BALANCE / DEPOSIT / ADJUSTMENT = مدين يزيد الرصيد
    - EXPENSE / WITHDRAW / REFUND / FEE = دائن يخفض الرصيد
    - TRANSFER:
        - إذا الحساب مصدر التحويل => دائن
        - إذا الحساب وجهة التحويل => مدين
    """
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