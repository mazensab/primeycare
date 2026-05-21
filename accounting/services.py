# ============================================================
# 📂 accounting/services.py
# 🧠 Primey Care | Accounting Posting & Reporting Services
# ------------------------------------------------------------
# ✅ خدمات الترحيل المحاسبي الرسمية
# ✅ مبنية على شجرة الحسابات المعتمدة الجديدة
# ✅ تغطي:
#    - إنشاء قيود يدوية
#    - ترحيل إصدار الفاتورة
#    - ترحيل تحصيل الدفعة
#    - ترحيل استحقاق عمولة المندوب
#    - ترحيل عهد COD للمندوب/الوسيط
#    - ترحيل استحقاقات المندوبين والوسطاء والتوصيل
#    - تسويات الخزينة للمندوبين والوسطاء
#    - عكس القيود المرحلة
#    - ميزان المراجعة
#    - الأستاذ العام
#    - قائمة الدخل
#    - الأرباح والخسائر كتوافق خلفي
#    - الميزانية العمومية
# ------------------------------------------------------------
# ملاحظات مهمة:
# - Idempotent: لا يكرر القيود لنفس المصدر.
# - لا يرحّل على حساب تجميعي أو غير نشط.
# - لا ينشئ قيد مرحل قبل إنشاء أسطره.
# - يمنع استبدال أسطر قيد مرحل قائم حتى لا تتغير الدفاتر بصمت.
# - التقارير تعتمد افتراضيًا على القيود المرحلة والمعكوسة.
# - عند عكس القيد يتم إنشاء قيد عكسي مستقل.
# - يدعم الموديل الحالي الذي يستخدم JournalEntryLine.journal_entry.
# ============================================================

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass
from datetime import date, datetime, time
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Iterable

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q, QuerySet, Sum
from django.utils import timezone

from accounting.models import (
    Account,
    AccountNature,
    AccountType,
    AccountingAccountPurpose,
    AccountingPeriod,
    AccountingPeriodStatus,
    AccountingRoutingRule,
    AccountingRoutingSource,
    AccountingSettings,
    CostCenter,
    JournalEntry,
    JournalEntryLine,
    JournalEntryStatus,
    PostingSource,
    TaxDirection,
    TaxRate,
)

logger = logging.getLogger(__name__)


# ============================================================
# ⚙️ Constants
# ============================================================

MONEY_ZERO = Decimal("0.00")
MONEY_QUANT = Decimal("0.01")


# ============================================================
# 🧱 Exceptions
# ============================================================

class AccountingServiceError(Exception):
    """Base exception for accounting services."""


class AccountingConfigurationError(AccountingServiceError):
    """Raised when required accounting configuration is missing."""


class AccountingPostingError(AccountingServiceError):
    """Raised when posting cannot be completed."""


class AccountingReportError(AccountingServiceError):
    """Raised when report generation fails."""


# ============================================================
# 📦 DTOs
# ============================================================

@dataclass(slots=True)
class EntryLinePayload:
    account: Account
    description: str
    debit_amount: Decimal = MONEY_ZERO
    credit_amount: Decimal = MONEY_ZERO
    currency: str = "SAR"
    cost_center: CostCenter | None = None
    tax_rate: TaxRate | None = None
    tax_amount: Decimal = MONEY_ZERO
    party_type: str = ""
    party_id: str = ""
    source_line_id: str = ""
    sort_order: int = 0
    metadata: dict[str, Any] | None = None


@dataclass(slots=True)
class TrialBalanceRow:
    account_id: int
    account_code: str
    account_name: str
    account_type: str
    account_nature: str
    debit_amount: Decimal
    credit_amount: Decimal
    balance_amount: Decimal


@dataclass(slots=True)
class TrialBalanceResult:
    date_from: date | None
    date_to: date | None
    total_debit: Decimal
    total_credit: Decimal
    is_balanced: bool
    rows: list[TrialBalanceRow]


@dataclass(slots=True)
class GeneralLedgerLine:
    line_date: date
    entry_id: int
    entry_number: str
    posting_source: str
    reference: str
    description: str
    debit_amount: Decimal
    credit_amount: Decimal
    balance_after: Decimal
    currency: str
    party_type: str
    party_id: str
    source_line_id: str


@dataclass(slots=True)
class GeneralLedgerResult:
    account_id: int
    account_code: str
    account_name: str
    date_from: date | None
    date_to: date | None
    opening_balance: Decimal
    total_debit: Decimal
    total_credit: Decimal
    closing_balance: Decimal
    lines: list[GeneralLedgerLine]


@dataclass(slots=True)
class IncomeStatementRow:
    account_id: int
    account_code: str
    account_name: str
    amount: Decimal


@dataclass(slots=True)
class IncomeStatementResult:
    date_from: date | None
    date_to: date | None
    total_revenue: Decimal
    total_expense: Decimal
    net_income: Decimal
    revenue_rows: list[IncomeStatementRow]
    expense_rows: list[IncomeStatementRow]


@dataclass(slots=True)
class BalanceSheetRow:
    account_id: int
    account_code: str
    account_name: str
    amount: Decimal


@dataclass(slots=True)
class BalanceSheetSection:
    title: str
    total_amount: Decimal
    rows: list[BalanceSheetRow]


@dataclass(slots=True)
class BalanceSheetResult:
    as_of_date: date | None
    assets: BalanceSheetSection
    liabilities: BalanceSheetSection
    equity: BalanceSheetSection
    total_liabilities_and_equity: Decimal
    is_balanced: bool


# ============================================================
# 🛠️ Generic Helpers
# ============================================================

def _money(value: Any) -> Decimal:
    return Decimal(str(value or "0.00")).quantize(
        MONEY_QUANT,
        rounding=ROUND_HALF_UP,
    )


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _clean_code(value: Any) -> str:
    return str(value or "").strip().upper()


def _clean_currency(value: Any) -> str:
    return str(value or "SAR").strip().upper()


def _first_non_empty(*values: Any) -> Any:
    for value in values:
        if value not in (None, "", [], {}, ()):
            return value
    return None


def _safe_getattr(obj: Any, attr_name: str, default: Any = None) -> Any:
    try:
        return getattr(obj, attr_name, default)
    except Exception:
        return default


def _model_has_field(model_or_instance: Any, field_name: str) -> bool:
    try:
        model_or_instance._meta.get_field(field_name)
        return True
    except Exception:
        return False


def _ensure_aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None

    if timezone.is_naive(value):
        return timezone.make_aware(value, timezone.get_current_timezone())

    return value


def _coerce_to_date(value: date | datetime | None) -> date | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        return value.date()

    return value


def _coerce_to_datetime(value: date | datetime | None, *, end_of_day: bool = False) -> datetime | None:
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


def _entry_line_fk_name() -> str:
    if _model_has_field(JournalEntryLine, "journal_entry"):
        return "journal_entry"
    return "entry"


def _line_entry(line: JournalEntryLine) -> JournalEntry:
    return getattr(line, "journal_entry", None) or getattr(line, "entry", None)


def _set_line_entry_kwargs(entry: JournalEntry) -> dict[str, Any]:
    return {_entry_line_fk_name(): entry}


def _entry_lines_qs(entry: JournalEntry) -> QuerySet[JournalEntryLine]:
    fk_name = _entry_line_fk_name()
    return JournalEntryLine.objects.filter(**{fk_name: entry})


def _save_with_update_fields(instance: Any, update_fields: list[str]) -> None:
    unique_fields = [field for field in list(dict.fromkeys(update_fields)) if hasattr(instance, field)]

    if unique_fields:
        instance.save(update_fields=unique_fields)
    else:
        instance.save()


def _update_entry_totals(entry: JournalEntry) -> None:
    if hasattr(entry, "_sync_totals_from_lines"):
        entry._sync_totals_from_lines()
        return

    if hasattr(entry, "update_totals"):
        entry.update_totals()
        return

    totals = _entry_lines_qs(entry).aggregate(
        debit=Sum("debit_amount"),
        credit=Sum("credit_amount"),
    )
    entry.total_debit = _money(totals.get("debit") or MONEY_ZERO)
    entry.total_credit = _money(totals.get("credit") or MONEY_ZERO)
    entry.save(update_fields=["total_debit", "total_credit", "updated_at"])


def _post_entry(entry: JournalEntry, *, actor: Any = None) -> JournalEntry:
    if hasattr(entry, "mark_as_posted"):
        entry.mark_as_posted(actor=actor)
        entry.refresh_from_db()
        return entry

    if hasattr(entry, "post"):
        entry.post(actor=actor)
        entry.refresh_from_db()
        return entry

    _update_entry_totals(entry)

    if _money(entry.total_debit) != _money(entry.total_credit):
        raise AccountingPostingError("لا يمكن ترحيل قيد غير متوازن.")

    if _money(entry.total_debit) <= MONEY_ZERO:
        raise AccountingPostingError("لا يمكن ترحيل قيد بدون مبالغ.")

    entry.status = JournalEntryStatus.POSTED
    entry.posted_at = timezone.now()

    if actor is not None and getattr(actor, "is_authenticated", False) and hasattr(entry, "posted_by"):
        entry.posted_by = actor

    entry.save()
    entry.refresh_from_db()
    return entry


def _cancel_entry(entry: JournalEntry, *, actor: Any = None) -> JournalEntry:
    if hasattr(entry, "cancel"):
        entry.cancel(actor=actor)
        entry.refresh_from_db()
        return entry

    if entry.status != JournalEntryStatus.POSTED:
        raise AccountingPostingError("لا يمكن إلغاء قيد غير مرحل.")

    entry.status = JournalEntryStatus.CANCELLED
    entry.cancelled_at = timezone.now()

    if actor is not None and getattr(actor, "is_authenticated", False) and hasattr(entry, "cancelled_by"):
        entry.cancelled_by = actor

    entry.save()
    entry.refresh_from_db()
    return entry


# ============================================================
# ⚙️ Settings & Account Resolution
# ============================================================

def get_accounting_settings() -> AccountingSettings:
    if hasattr(AccountingSettings, "get_solo"):
        return AccountingSettings.get_solo()

    obj, _ = AccountingSettings.objects.get_or_create(pk=1)
    return obj


def _find_open_period(entry_date: date | None = None) -> AccountingPeriod | None:
    if not entry_date:
        entry_date = timezone.localdate()

    return (
        AccountingPeriod.objects.filter(
            start_date__lte=entry_date,
            end_date__gte=entry_date,
            status=AccountingPeriodStatus.OPEN,
        )
        .select_related("fiscal_year")
        .order_by("-start_date", "-id")
        .first()
    )


def _resolve_period(entry_date: date | None = None) -> AccountingPeriod | None:
    settings_obj = get_accounting_settings()
    period = _find_open_period(entry_date)

    if settings_obj.require_period_for_posting and not period:
        raise AccountingConfigurationError("لا توجد فترة محاسبية مفتوحة لتاريخ القيد.")

    return period


def _validate_postable_account(account: Account, field_name: str = "account") -> Account:
    if not account:
        raise AccountingConfigurationError(f"{field_name}: الحساب مطلوب.")

    if getattr(account, "is_group", False):
        raise AccountingConfigurationError(f"{field_name}: لا يمكن الترحيل على حساب تجميعي.")

    if not getattr(account, "is_active", True):
        raise AccountingConfigurationError(f"{field_name}: لا يمكن الترحيل على حساب غير نشط.")

    return account


def _resolve_account_by_purpose(
    purpose: str,
    *,
    source: str | None = None,
    required: bool = True,
) -> Account | None:
    qs = Account.objects.filter(purpose=purpose, is_active=True, is_group=False).order_by("code", "id")

    if qs.exists():
        return qs.first()

    if source:
        rule = (
            AccountingRoutingRule.objects.filter(
                source=source,
                purpose=purpose,
                is_active=True,
            )
            .select_related("account")
            .order_by("priority", "id")
            .first()
        )
        if rule:
            return _validate_postable_account(rule.account)

    if required:
        raise AccountingConfigurationError(
            f"لم يتم العثور على حساب نشط قابل للترحيل للغرض المحاسبي: {purpose}"
        )

    return None


def _resolve_routing_account(source: str, purpose: str, *, required: bool = True) -> Account | None:
    rule = (
        AccountingRoutingRule.objects.filter(
            source=source,
            purpose=purpose,
            is_active=True,
        )
        .select_related("account")
        .order_by("priority", "id")
        .first()
    )

    if rule:
        return _validate_postable_account(rule.account)

    return _resolve_account_by_purpose(
        purpose,
        source=source,
        required=required,
    )


def _resolve_tax_rate() -> TaxRate | None:
    settings_obj = get_accounting_settings()

    if settings_obj.default_tax_rate_id:
        return settings_obj.default_tax_rate

    return TaxRate.objects.filter(is_active=True, is_default=True).order_by("id").first()


def _resolve_tax_account(tax_rate: TaxRate | None, *, direction: str = TaxDirection.OUTPUT) -> Account | None:
    if not tax_rate:
        return _resolve_account_by_purpose(AccountingAccountPurpose.OUTPUT_VAT, required=False)

    if direction == TaxDirection.INPUT and tax_rate.purchase_account_id:
        return _validate_postable_account(tax_rate.purchase_account, "purchase_tax_account")

    if direction == TaxDirection.OUTPUT and tax_rate.sales_account_id:
        return _validate_postable_account(tax_rate.sales_account, "sales_tax_account")

    if direction == TaxDirection.INPUT:
        return _resolve_account_by_purpose(AccountingAccountPurpose.INPUT_VAT, required=False)

    return _resolve_account_by_purpose(AccountingAccountPurpose.OUTPUT_VAT, required=False)


# ============================================================
# 🧾 Journal Entry Core
# ============================================================

@transaction.atomic
def _get_or_create_entry_header(
    *,
    entry_number: str,
    entry_date: date,
    posting_source: str,
    reference: str = "",
    external_reference: str = "",
    description: str = "",
    notes: str = "",
    currency: str = "SAR",
    source_type: str = "",
    source_id: str = "",
    source_number: str = "",
    is_auto_posted: bool = True,
    actor: Any = None,
) -> JournalEntry:
    if not entry_number:
        raise AccountingPostingError("entry_number is required.")

    entry_date = entry_date or timezone.localdate()
    currency = _clean_currency(currency)
    period = _resolve_period(entry_date)

    defaults = {
        "entry_date": entry_date,
        "period": period,
        "status": JournalEntryStatus.DRAFT,
        "posting_source": posting_source,
        "reference": reference or "",
        "external_reference": external_reference or "",
        "description": description or "",
        "notes": notes or "",
        "currency": currency,
        "source_type": source_type or "",
        "source_id": source_id or "",
        "source_number": source_number or "",
        "is_auto_posted": is_auto_posted,
        "metadata": {},
    }

    if actor is not None and getattr(actor, "is_authenticated", False):
        if _model_has_field(JournalEntry, "created_by"):
            defaults["created_by"] = actor
        if _model_has_field(JournalEntry, "updated_by"):
            defaults["updated_by"] = actor

    entry, created = JournalEntry.objects.get_or_create(
        entry_number=entry_number,
        defaults=defaults,
    )

    if not created:
        if entry.status != JournalEntryStatus.DRAFT:
            return entry

        for field_name, value in defaults.items():
            if hasattr(entry, field_name):
                setattr(entry, field_name, value)

        entry.save()

    return entry


def _validate_line_payload(line: EntryLinePayload) -> EntryLinePayload:
    line.account = _validate_postable_account(line.account)
    line.debit_amount = _money(line.debit_amount)
    line.credit_amount = _money(line.credit_amount)
    line.tax_amount = _money(line.tax_amount)
    line.currency = _clean_currency(line.currency)

    if line.debit_amount > MONEY_ZERO and line.credit_amount > MONEY_ZERO:
        raise AccountingPostingError("لا يمكن أن يحتوي سطر القيد على مدين ودائن في نفس الوقت.")

    if line.debit_amount <= MONEY_ZERO and line.credit_amount <= MONEY_ZERO:
        raise AccountingPostingError("يجب أن يحتوي سطر القيد على مبلغ مدين أو دائن.")

    if line.tax_amount < MONEY_ZERO:
        raise AccountingPostingError("مبلغ الضريبة لا يمكن أن يكون سالبًا.")

    if line.cost_center and not line.cost_center.can_post:
        raise AccountingPostingError("مركز التكلفة غير نشط أو تجميعي.")

    return line


@transaction.atomic
def _replace_entry_lines(
    entry: JournalEntry,
    lines: Iterable[EntryLinePayload],
    *,
    actor: Any = None,
) -> JournalEntry:
    if not entry:
        raise AccountingPostingError("entry is required.")

    entry = JournalEntry.objects.select_for_update().get(pk=entry.pk)

    if entry.status != JournalEntryStatus.DRAFT:
        if _entry_lines_qs(entry).exists():
            return entry

        raise AccountingPostingError("لا يمكن إضافة أسطر إلى قيد غير مسودة.")

    line_payloads = [_validate_line_payload(line) for line in lines]

    total_debit = _money(sum((line.debit_amount for line in line_payloads), MONEY_ZERO))
    total_credit = _money(sum((line.credit_amount for line in line_payloads), MONEY_ZERO))

    if total_debit != total_credit:
        raise AccountingPostingError(
            f"القيد غير متوازن: المدين {total_debit} والدائن {total_credit}"
        )

    if total_debit <= MONEY_ZERO:
        raise AccountingPostingError("لا يمكن إنشاء قيد بمبالغ صفرية.")

    _entry_lines_qs(entry).delete()

    for index, line in enumerate(line_payloads, start=1):
        create_kwargs = _set_line_entry_kwargs(entry)
        create_kwargs.update(
            {
                "account": line.account,
                "description": line.description or "",
                "debit_amount": line.debit_amount,
                "credit_amount": line.credit_amount,
                "currency": line.currency or entry.currency,
                "cost_center": line.cost_center,
                "tax_rate": line.tax_rate,
                "party_type": line.party_type or "",
                "party_id": str(line.party_id or ""),
                "source_line_id": str(line.source_line_id or ""),
                "sort_order": line.sort_order or index,
                "metadata": line.metadata or {},
            }
        )

        if _model_has_field(JournalEntryLine, "tax_amount"):
            create_kwargs["tax_amount"] = line.tax_amount

        JournalEntryLine.objects.create(**create_kwargs)

    _update_entry_totals(entry)
    entry.refresh_from_db()

    return entry


@transaction.atomic
def create_manual_journal_entry(
    *,
    entry_number: str,
    entry_date: date,
    lines: Iterable[EntryLinePayload],
    description: str = "",
    notes: str = "",
    reference: str = "",
    external_reference: str = "",
    currency: str = "SAR",
    actor: Any = None,
    auto_post: bool = False,
) -> JournalEntry:
    entry = _get_or_create_entry_header(
        entry_number=entry_number,
        entry_date=entry_date,
        posting_source=PostingSource.MANUAL,
        reference=reference,
        external_reference=external_reference,
        description=description,
        notes=notes,
        currency=currency,
        source_type="manual",
        source_id="",
        source_number=entry_number,
        is_auto_posted=False,
        actor=actor,
    )

    entry = _replace_entry_lines(entry, lines, actor=actor)

    if auto_post:
        entry = _post_entry(entry, actor=actor)

    return entry


# ============================================================
# 📌 Source Amount Resolvers
# ============================================================

def _resolve_invoice_number(invoice: Any) -> str:
    return str(
        _first_non_empty(
            _safe_getattr(invoice, "invoice_number"),
            _safe_getattr(invoice, "number"),
            _safe_getattr(invoice, "code"),
            f"INV-{_safe_getattr(invoice, 'pk', 'unknown')}",
        )
    )


def _resolve_invoice_date(invoice: Any) -> date:
    value = _first_non_empty(
        _safe_getattr(invoice, "issued_at"),
        _safe_getattr(invoice, "invoice_date"),
        _safe_getattr(invoice, "created_at"),
        timezone.localdate(),
    )

    return _coerce_to_date(value) or timezone.localdate()


def _resolve_invoice_currency(invoice: Any) -> str:
    return _clean_currency(
        _first_non_empty(
            _safe_getattr(invoice, "currency_code"),
            _safe_getattr(invoice, "currency"),
            "SAR",
        )
    )


def _resolve_invoice_total(invoice: Any) -> Decimal:
    return _money(
        _first_non_empty(
            _safe_getattr(invoice, "total_amount"),
            _safe_getattr(invoice, "grand_total"),
            _safe_getattr(invoice, "amount"),
            MONEY_ZERO,
        )
    )


def _resolve_invoice_tax(invoice: Any) -> Decimal:
    return _money(
        _first_non_empty(
            _safe_getattr(invoice, "tax_amount"),
            _safe_getattr(invoice, "vat_amount"),
            MONEY_ZERO,
        )
    )


def _resolve_invoice_revenue(invoice: Any) -> Decimal:
    total = _resolve_invoice_total(invoice)
    tax = _resolve_invoice_tax(invoice)
    revenue = total - tax
    return _money(revenue if revenue > MONEY_ZERO else total)


def _resolve_payment_number(payment: Any) -> str:
    return str(
        _first_non_empty(
            _safe_getattr(payment, "payment_number"),
            _safe_getattr(payment, "reference"),
            _safe_getattr(payment, "number"),
            f"PAY-{_safe_getattr(payment, 'pk', 'unknown')}",
        )
    )


def _resolve_payment_date(payment: Any) -> date:
    value = _first_non_empty(
        _safe_getattr(payment, "paid_at"),
        _safe_getattr(payment, "payment_date"),
        _safe_getattr(payment, "created_at"),
        timezone.localdate(),
    )

    return _coerce_to_date(value) or timezone.localdate()


def _resolve_payment_currency(payment: Any) -> str:
    return _clean_currency(
        _first_non_empty(
            _safe_getattr(payment, "currency"),
            _safe_getattr(payment, "currency_code"),
            "SAR",
        )
    )


def _resolve_payment_amount(payment: Any) -> Decimal:
    return _money(
        _first_non_empty(
            _safe_getattr(payment, "paid_amount"),
            _safe_getattr(payment, "amount"),
            _safe_getattr(payment, "total_amount"),
            MONEY_ZERO,
        )
    )


def _resolve_payment_fees(payment: Any) -> Decimal:
    return _money(
        _first_non_empty(
            _safe_getattr(payment, "fees_amount"),
            _safe_getattr(payment, "gateway_fee_amount"),
            _safe_getattr(payment, "gateway_fees"),
            MONEY_ZERO,
        )
    )


def _resolve_payment_net(payment: Any) -> Decimal:
    explicit = _first_non_empty(
        _safe_getattr(payment, "net_amount"),
        _safe_getattr(payment, "settlement_amount"),
    )

    if explicit is not None:
        return _money(explicit)

    amount = _resolve_payment_amount(payment)
    fees = _resolve_payment_fees(payment)
    return _money(amount - fees)


def _resolve_order_number(order: Any) -> str:
    return str(
        _first_non_empty(
            _safe_getattr(order, "order_number"),
            _safe_getattr(order, "number"),
            f"ORD-{_safe_getattr(order, 'pk', 'unknown')}",
        )
    )


def _resolve_order_date(order: Any) -> date:
    value = _first_non_empty(
        _safe_getattr(order, "completed_at"),
        _safe_getattr(order, "delivered_at"),
        _safe_getattr(order, "confirmed_at"),
        _safe_getattr(order, "created_at"),
        timezone.localdate(),
    )
    return _coerce_to_date(value) or timezone.localdate()


def _resolve_order_currency(order: Any) -> str:
    return _clean_currency(
        _first_non_empty(
            _safe_getattr(order, "currency_code"),
            _safe_getattr(order, "currency"),
            "SAR",
        )
    )


def _resolve_financial_entry_number(financial_entry: Any) -> str:
    return str(
        _first_non_empty(
            _safe_getattr(financial_entry, "entry_number"),
            _safe_getattr(financial_entry, "reference"),
            f"AFE-{_safe_getattr(financial_entry, 'pk', 'unknown')}",
        )
    )


def _resolve_financial_entry_date(financial_entry: Any) -> date:
    value = _first_non_empty(
        _safe_getattr(financial_entry, "approved_at"),
        _safe_getattr(financial_entry, "earned_at"),
        _safe_getattr(financial_entry, "created_at"),
        timezone.localdate(),
    )
    return _coerce_to_date(value) or timezone.localdate()


# ============================================================
# 🧾 Invoice Posting
# ============================================================

@transaction.atomic
def post_invoice_issuance(invoice: Any, *, actor: Any = None) -> JournalEntry:
    if not invoice:
        raise AccountingPostingError("invoice is required.")

    invoice_id = _safe_getattr(invoice, "pk", None)
    invoice_number = _resolve_invoice_number(invoice)
    entry_number = f"INV-{invoice_id}"

    existing = JournalEntry.objects.filter(
        source_type="invoice",
        source_id=str(invoice_id),
        posting_source=PostingSource.INVOICE,
    ).order_by("id").first()

    if existing:
        return existing

    currency = _resolve_invoice_currency(invoice)
    invoice_date = _resolve_invoice_date(invoice)
    total_amount = _resolve_invoice_total(invoice)
    tax_amount = _resolve_invoice_tax(invoice)
    revenue_amount = _resolve_invoice_revenue(invoice)

    if total_amount <= MONEY_ZERO:
        raise AccountingPostingError("إجمالي الفاتورة يجب أن يكون أكبر من صفر.")

    receivable_account = _resolve_routing_account(
        AccountingRoutingSource.SALES_INVOICE,
        AccountingAccountPurpose.ACCOUNTS_RECEIVABLE,
    )
    revenue_account = _resolve_routing_account(
        AccountingRoutingSource.SALES_INVOICE,
        AccountingAccountPurpose.SALES_REVENUE,
    )

    tax_rate = _resolve_tax_rate()
    tax_account = _resolve_tax_account(tax_rate, direction=TaxDirection.OUTPUT) if tax_amount > MONEY_ZERO else None

    entry = _get_or_create_entry_header(
        entry_number=entry_number,
        entry_date=invoice_date,
        posting_source=PostingSource.INVOICE,
        reference=f"INVOICE:{invoice_id}:ISSUE",
        external_reference=invoice_number,
        description=f"إثبات إصدار فاتورة رقم {invoice_number}",
        notes="",
        currency=currency,
        source_type="invoice",
        source_id=str(invoice_id),
        source_number=invoice_number,
        is_auto_posted=True,
        actor=actor,
    )

    lines = [
        EntryLinePayload(
            account=receivable_account,
            description=f"ذمم عميل عن فاتورة {invoice_number}",
            debit_amount=total_amount,
            credit_amount=MONEY_ZERO,
            currency=currency,
            party_type="customer",
            party_id=str(_safe_getattr(invoice, "customer_id", "") or ""),
            source_line_id=str(invoice_id),
            sort_order=1,
            metadata={"invoice_id": invoice_id, "side": "receivable"},
        ),
        EntryLinePayload(
            account=revenue_account,
            description=f"إيراد فاتورة {invoice_number}",
            debit_amount=MONEY_ZERO,
            credit_amount=revenue_amount,
            currency=currency,
            party_type="customer",
            party_id=str(_safe_getattr(invoice, "customer_id", "") or ""),
            source_line_id=str(invoice_id),
            sort_order=2,
            metadata={"invoice_id": invoice_id, "side": "revenue"},
        ),
    ]

    if tax_amount > MONEY_ZERO:
        if not tax_account:
            raise AccountingConfigurationError("حساب ضريبة المخرجات غير مضبوط.")

        lines.append(
            EntryLinePayload(
                account=tax_account,
                description=f"ضريبة مخرجات فاتورة {invoice_number}",
                debit_amount=MONEY_ZERO,
                credit_amount=tax_amount,
                currency=currency,
                tax_rate=tax_rate,
                tax_amount=tax_amount,
                party_type="customer",
                party_id=str(_safe_getattr(invoice, "customer_id", "") or ""),
                source_line_id=str(invoice_id),
                sort_order=3,
                metadata={"invoice_id": invoice_id, "side": "output_vat"},
            )
        )

    entry = _replace_entry_lines(entry, lines, actor=actor)
    entry = _post_entry(entry, actor=actor)

    if hasattr(invoice, "journal_entry"):
        invoice.journal_entry = entry

    if hasattr(invoice, "journal_entry_reference"):
        invoice.journal_entry_reference = entry.entry_number

    if hasattr(invoice, "is_accounting_posted"):
        invoice.is_accounting_posted = True

    if hasattr(invoice, "posted_at") and not _safe_getattr(invoice, "posted_at"):
        invoice.posted_at = timezone.now()

    try:
        _save_with_update_fields(
            invoice,
            [
                "journal_entry",
                "journal_entry_reference",
                "is_accounting_posted",
                "posted_at",
                "updated_at",
            ],
        )
    except Exception:
        logger.debug("Invoice posting metadata update skipped.", exc_info=True)

    return entry


# ============================================================
# 💳 Payment Posting
# ============================================================

@transaction.atomic
def post_payment_receipt(payment: Any, *, actor: Any = None) -> JournalEntry:
    if not payment:
        raise AccountingPostingError("payment is required.")

    payment_id = _safe_getattr(payment, "pk", None)
    payment_number = _resolve_payment_number(payment)
    entry_number = f"PAY-{payment_id}"

    existing = JournalEntry.objects.filter(
        source_type="payment",
        source_id=str(payment_id),
        posting_source=PostingSource.PAYMENT,
    ).order_by("id").first()

    if existing:
        return existing

    currency = _resolve_payment_currency(payment)
    payment_date = _resolve_payment_date(payment)
    amount = _resolve_payment_amount(payment)
    fees = _resolve_payment_fees(payment)
    net_amount = _resolve_payment_net(payment)

    if amount <= MONEY_ZERO:
        raise AccountingPostingError("مبلغ الدفعة يجب أن يكون أكبر من صفر.")

    cash_account = _resolve_routing_account(
        AccountingRoutingSource.PAYMENT_RECEIPT,
        AccountingAccountPurpose.CASH,
    )
    receivable_account = _resolve_routing_account(
        AccountingRoutingSource.PAYMENT_RECEIPT,
        AccountingAccountPurpose.ACCOUNTS_RECEIVABLE,
    )
    gateway_fees_account = _resolve_account_by_purpose(
        AccountingAccountPurpose.GATEWAY_FEES,
        required=False,
    )

    entry = _get_or_create_entry_header(
        entry_number=entry_number,
        entry_date=payment_date,
        posting_source=PostingSource.PAYMENT,
        reference=f"PAYMENT:{payment_id}:RECEIPT",
        external_reference=payment_number,
        description=f"إثبات تحصيل دفعة رقم {payment_number}",
        notes="",
        currency=currency,
        source_type="payment",
        source_id=str(payment_id),
        source_number=payment_number,
        is_auto_posted=True,
        actor=actor,
    )

    lines = [
        EntryLinePayload(
            account=cash_account,
            description=f"قبض دفعة {payment_number}",
            debit_amount=net_amount if fees > MONEY_ZERO else amount,
            credit_amount=MONEY_ZERO,
            currency=currency,
            party_type="customer",
            party_id=str(_safe_getattr(payment, "customer_id", "") or ""),
            source_line_id=str(payment_id),
            sort_order=1,
            metadata={"payment_id": payment_id, "side": "cash"},
        ),
        EntryLinePayload(
            account=receivable_account,
            description=f"تخفيض ذمم عميل بدفعة {payment_number}",
            debit_amount=MONEY_ZERO,
            credit_amount=amount,
            currency=currency,
            party_type="customer",
            party_id=str(_safe_getattr(payment, "customer_id", "") or ""),
            source_line_id=str(payment_id),
            sort_order=2,
            metadata={"payment_id": payment_id, "side": "receivable"},
        ),
    ]

    if fees > MONEY_ZERO:
        if not gateway_fees_account:
            raise AccountingConfigurationError("حساب رسوم بوابة الدفع غير مضبوط.")

        lines.append(
            EntryLinePayload(
                account=gateway_fees_account,
                description=f"رسوم بوابة دفع للدفعة {payment_number}",
                debit_amount=fees,
                credit_amount=MONEY_ZERO,
                currency=currency,
                party_type="gateway",
                party_id=str(_safe_getattr(payment, "gateway_id", "") or ""),
                source_line_id=str(payment_id),
                sort_order=3,
                metadata={"payment_id": payment_id, "side": "gateway_fees"},
            )
        )

    entry = _replace_entry_lines(entry, lines, actor=actor)
    entry = _post_entry(entry, actor=actor)

    if hasattr(payment, "journal_entry"):
        payment.journal_entry = entry

    if hasattr(payment, "journal_entry_reference"):
        payment.journal_entry_reference = entry.entry_number

    if hasattr(payment, "is_accounting_posted"):
        payment.is_accounting_posted = True

    if hasattr(payment, "posted_at") and not _safe_getattr(payment, "posted_at"):
        payment.posted_at = timezone.now()

    try:
        _save_with_update_fields(
            payment,
            [
                "journal_entry",
                "journal_entry_reference",
                "is_accounting_posted",
                "posted_at",
                "updated_at",
            ],
        )
    except Exception:
        logger.debug("Payment posting metadata update skipped.", exc_info=True)

    return entry


# ============================================================
# 💸 Legacy Agent Commission Posting
# ============================================================

@transaction.atomic
def post_agent_commission_accrual(commission: Any, *, actor: Any = None) -> JournalEntry:
    if not commission:
        raise AccountingPostingError("commission is required.")

    commission_id = _safe_getattr(commission, "pk", None)
    entry_number = f"AGC-{commission_id}"

    existing = JournalEntry.objects.filter(
        source_type="agent_commission",
        source_id=str(commission_id),
        posting_source=PostingSource.AGENT_COMMISSION,
    ).order_by("id").first()

    if existing:
        return existing

    amount = _money(
        _first_non_empty(
            _safe_getattr(commission, "commission_amount"),
            _safe_getattr(commission, "amount"),
            MONEY_ZERO,
        )
    )

    if amount <= MONEY_ZERO:
        raise AccountingPostingError("قيمة عمولة المندوب يجب أن تكون أكبر من صفر.")

    currency = _clean_currency(
        _first_non_empty(
            _safe_getattr(_safe_getattr(commission, "order", None), "currency_code"),
            _safe_getattr(_safe_getattr(commission, "payment", None), "currency"),
            "SAR",
        )
    )

    entry_date = _coerce_to_date(
        _first_non_empty(
            _safe_getattr(commission, "approved_at"),
            _safe_getattr(commission, "earned_at"),
            _safe_getattr(commission, "created_at"),
            timezone.localdate(),
        )
    ) or timezone.localdate()

    expense_account = _resolve_routing_account(
        AccountingRoutingSource.AGENT_COMMISSION,
        AccountingAccountPurpose.AGENT_COMMISSION_EXPENSE,
    )
    payable_account = _resolve_routing_account(
        AccountingRoutingSource.AGENT_COMMISSION,
        AccountingAccountPurpose.AGENT_COMMISSION_PAYABLE,
    )

    reference = _first_non_empty(
        _safe_getattr(commission, "commission_number"),
        _safe_getattr(commission, "reference"),
        f"AGC-{commission_id}",
    )

    entry = _get_or_create_entry_header(
        entry_number=entry_number,
        entry_date=entry_date,
        posting_source=PostingSource.AGENT_COMMISSION,
        reference=f"AGENT_COMMISSION:{commission_id}:ACCRUAL",
        external_reference=str(reference),
        description=f"إثبات استحقاق عمولة مندوب {reference}",
        notes="",
        currency=currency,
        source_type="agent_commission",
        source_id=str(commission_id),
        source_number=str(reference),
        is_auto_posted=True,
        actor=actor,
    )

    agent_id = str(_safe_getattr(commission, "agent_id", "") or "")

    lines = [
        EntryLinePayload(
            account=expense_account,
            description=f"مصروف عمولة مندوب {reference}",
            debit_amount=amount,
            credit_amount=MONEY_ZERO,
            currency=currency,
            party_type="agent",
            party_id=agent_id,
            source_line_id=str(commission_id),
            sort_order=1,
            metadata={"commission_id": commission_id, "side": "expense"},
        ),
        EntryLinePayload(
            account=payable_account,
            description=f"مستحقات مندوب عن عمولة {reference}",
            debit_amount=MONEY_ZERO,
            credit_amount=amount,
            currency=currency,
            party_type="agent",
            party_id=agent_id,
            source_line_id=str(commission_id),
            sort_order=2,
            metadata={"commission_id": commission_id, "side": "payable"},
        ),
    ]

    entry = _replace_entry_lines(entry, lines, actor=actor)
    entry = _post_entry(entry, actor=actor)

    if hasattr(commission, "journal_entry"):
        commission.journal_entry = entry

    if hasattr(commission, "journal_entry_reference"):
        commission.journal_entry_reference = entry.entry_number

    if hasattr(commission, "is_accounting_posted"):
        commission.is_accounting_posted = True

    if hasattr(commission, "posted_at") and not _safe_getattr(commission, "posted_at"):
        commission.posted_at = timezone.now()

    try:
        _save_with_update_fields(
            commission,
            [
                "journal_entry",
                "journal_entry_reference",
                "is_accounting_posted",
                "posted_at",
                "updated_at",
            ],
        )
    except Exception:
        logger.debug("Commission posting metadata update skipped.", exc_info=True)

    return entry


post_commission_accrual = post_agent_commission_accrual
post_agent_commission = post_agent_commission_accrual


# ============================================================
# 📒 Agent / Broker Financial Entry Posting
# ============================================================

def _resolve_financial_entry_party(financial_entry: Any) -> tuple[str, str]:
    agent_id = _safe_getattr(financial_entry, "agent_id", None)
    broker_id = _safe_getattr(financial_entry, "broker_id", None)

    if agent_id:
        return "agent", str(agent_id)

    if broker_id:
        return "broker", str(broker_id)

    return "", ""


def _resolve_financial_entry_accounts(financial_entry: Any) -> tuple[Account, Account, str]:
    entry_type = str(_safe_getattr(financial_entry, "entry_type", "") or "").upper()

    if entry_type == "COD_CUSTODY":
        if _safe_getattr(financial_entry, "agent_id", None):
            custody = _resolve_routing_account(
                AccountingRoutingSource.AGENT_COD_CUSTODY,
                AccountingAccountPurpose.AGENT_CUSTODY,
            )
            clearing = _resolve_routing_account(
                AccountingRoutingSource.AGENT_COD_CUSTODY,
                AccountingAccountPurpose.ACCOUNTS_RECEIVABLE,
            )
            return custody, clearing, PostingSource.AGENT_COD_CUSTODY

        custody = _resolve_routing_account(
            AccountingRoutingSource.BROKER_COD_CUSTODY,
            AccountingAccountPurpose.BROKER_CUSTODY,
        )
        clearing = _resolve_routing_account(
            AccountingRoutingSource.BROKER_COD_CUSTODY,
            AccountingAccountPurpose.ACCOUNTS_RECEIVABLE,
        )
        return custody, clearing, PostingSource.BROKER_COD_CUSTODY

    if entry_type == "DELIVERY_FEE":
        expense = _resolve_routing_account(
            AccountingRoutingSource.AGENT_DELIVERY_FEE,
            AccountingAccountPurpose.AGENT_DELIVERY_EXPENSE,
        )
        payable = _resolve_routing_account(
            AccountingRoutingSource.AGENT_DELIVERY_FEE,
            AccountingAccountPurpose.AGENT_COMMISSION_PAYABLE,
        )
        return expense, payable, PostingSource.AGENT_DELIVERY_FEE

    if entry_type in {"SALES_COMMISSION", "COD_COLLECTION_FEE", "PROVIDER_CONTRACT_COMMISSION"}:
        expense = _resolve_routing_account(
            AccountingRoutingSource.AGENT_EARNING,
            AccountingAccountPurpose.AGENT_COMMISSION_EXPENSE,
        )
        payable = _resolve_routing_account(
            AccountingRoutingSource.AGENT_EARNING,
            AccountingAccountPurpose.AGENT_COMMISSION_PAYABLE,
        )
        return expense, payable, PostingSource.AGENT_EARNING

    if entry_type in {"BROKER_SHARE", "BROKER_COMMISSION"}:
        expense = _resolve_routing_account(
            AccountingRoutingSource.BROKER_EARNING,
            AccountingAccountPurpose.BROKER_COMMISSION_EXPENSE,
        )
        payable = _resolve_routing_account(
            AccountingRoutingSource.BROKER_EARNING,
            AccountingAccountPurpose.BROKER_COMMISSION_PAYABLE,
        )
        return expense, payable, PostingSource.BROKER_EARNING

    if entry_type in {"BONUS", "ADJUSTMENT"}:
        if _safe_getattr(financial_entry, "agent_id", None):
            expense = _resolve_routing_account(
                AccountingRoutingSource.AGENT_EARNING,
                AccountingAccountPurpose.AGENT_COMMISSION_EXPENSE,
            )
            payable = _resolve_routing_account(
                AccountingRoutingSource.AGENT_EARNING,
                AccountingAccountPurpose.AGENT_COMMISSION_PAYABLE,
            )
            return expense, payable, PostingSource.AGENT_EARNING

        expense = _resolve_routing_account(
            AccountingRoutingSource.BROKER_EARNING,
            AccountingAccountPurpose.BROKER_COMMISSION_EXPENSE,
        )
        payable = _resolve_routing_account(
            AccountingRoutingSource.BROKER_EARNING,
            AccountingAccountPurpose.BROKER_COMMISSION_PAYABLE,
        )
        return expense, payable, PostingSource.BROKER_EARNING

    if entry_type == "DEDUCTION":
        if _safe_getattr(financial_entry, "agent_id", None):
            payable = _resolve_routing_account(
                AccountingRoutingSource.AGENT_EARNING,
                AccountingAccountPurpose.AGENT_COMMISSION_PAYABLE,
            )
            income = _resolve_account_by_purpose(
                AccountingAccountPurpose.OTHER_REVENUE,
                required=True,
            )
            return payable, income, PostingSource.AGENT_EARNING

        payable = _resolve_routing_account(
            AccountingRoutingSource.BROKER_EARNING,
            AccountingAccountPurpose.BROKER_COMMISSION_PAYABLE,
        )
        income = _resolve_account_by_purpose(
            AccountingAccountPurpose.OTHER_REVENUE,
            required=True,
        )
        return payable, income, PostingSource.BROKER_EARNING

    raise AccountingPostingError(f"نوع السجل المالي غير مدعوم للترحيل المحاسبي: {entry_type}")


@transaction.atomic
def post_agent_financial_entry_accrual(financial_entry: Any, *, actor: Any = None) -> JournalEntry:
    if not financial_entry:
        raise AccountingPostingError("financial_entry is required.")

    entry_id = _safe_getattr(financial_entry, "pk", None)

    existing = JournalEntry.objects.filter(
        source_type="agent_financial_entry",
        source_id=str(entry_id),
    ).order_by("id").first()

    if existing:
        return existing

    amount = _money(_safe_getattr(financial_entry, "amount", MONEY_ZERO))

    if amount <= MONEY_ZERO:
        raise AccountingPostingError("مبلغ السجل المالي يجب أن يكون أكبر من صفر.")

    currency = _clean_currency(_safe_getattr(financial_entry, "currency", "SAR"))
    source_number = _resolve_financial_entry_number(financial_entry)
    entry_date = _resolve_financial_entry_date(financial_entry)
    account_a, account_b, posting_source = _resolve_financial_entry_accounts(financial_entry)
    party_type, party_id = _resolve_financial_entry_party(financial_entry)
    direction = str(_safe_getattr(financial_entry, "direction", "") or "").upper()
    entry_type = str(_safe_getattr(financial_entry, "entry_type", "") or "").upper()

    journal_entry = _get_or_create_entry_header(
        entry_number=f"AFE-{entry_id}",
        entry_date=entry_date,
        posting_source=posting_source,
        reference=f"AGENT_FINANCIAL_ENTRY:{entry_id}:POST",
        external_reference=source_number,
        description=_safe_getattr(financial_entry, "description", "") or f"ترحيل سجل مالي {source_number}",
        notes="",
        currency=currency,
        source_type="agent_financial_entry",
        source_id=str(entry_id),
        source_number=source_number,
        is_auto_posted=True,
        actor=actor,
    )

    if entry_type == "COD_CUSTODY":
        lines = [
            EntryLinePayload(
                account=account_a,
                description=f"إثبات عهدة COD {source_number}",
                debit_amount=amount,
                credit_amount=MONEY_ZERO,
                currency=currency,
                party_type=party_type,
                party_id=party_id,
                source_line_id=str(entry_id),
                sort_order=1,
                metadata={"financial_entry_id": entry_id, "side": "custody"},
            ),
            EntryLinePayload(
                account=account_b,
                description=f"تخفيض ذمم مقابل تحصيل COD {source_number}",
                debit_amount=MONEY_ZERO,
                credit_amount=amount,
                currency=currency,
                party_type=party_type,
                party_id=party_id,
                source_line_id=str(entry_id),
                sort_order=2,
                metadata={"financial_entry_id": entry_id, "side": "receivable"},
            ),
        ]

    elif direction == "DEBIT" and entry_type == "DEDUCTION":
        lines = [
            EntryLinePayload(
                account=account_a,
                description=f"تخفيض مستحقات طرف {source_number}",
                debit_amount=amount,
                credit_amount=MONEY_ZERO,
                currency=currency,
                party_type=party_type,
                party_id=party_id,
                source_line_id=str(entry_id),
                sort_order=1,
                metadata={"financial_entry_id": entry_id, "side": "payable_debit"},
            ),
            EntryLinePayload(
                account=account_b,
                description=f"إثبات خصم/إيراد مقابل {source_number}",
                debit_amount=MONEY_ZERO,
                credit_amount=amount,
                currency=currency,
                party_type=party_type,
                party_id=party_id,
                source_line_id=str(entry_id),
                sort_order=2,
                metadata={"financial_entry_id": entry_id, "side": "income_credit"},
            ),
        ]

    else:
        lines = [
            EntryLinePayload(
                account=account_a,
                description=f"مصروف/استحقاق {source_number}",
                debit_amount=amount,
                credit_amount=MONEY_ZERO,
                currency=currency,
                party_type=party_type,
                party_id=party_id,
                source_line_id=str(entry_id),
                sort_order=1,
                metadata={"financial_entry_id": entry_id, "side": "expense"},
            ),
            EntryLinePayload(
                account=account_b,
                description=f"مستحقات طرف {source_number}",
                debit_amount=MONEY_ZERO,
                credit_amount=amount,
                currency=currency,
                party_type=party_type,
                party_id=party_id,
                source_line_id=str(entry_id),
                sort_order=2,
                metadata={"financial_entry_id": entry_id, "side": "payable"},
            ),
        ]

    journal_entry = _replace_entry_lines(journal_entry, lines, actor=actor)
    journal_entry = _post_entry(journal_entry, actor=actor)

    if hasattr(financial_entry, "journal_entry"):
        financial_entry.journal_entry = journal_entry

    if hasattr(financial_entry, "journal_entry_reference"):
        financial_entry.journal_entry_reference = journal_entry.entry_number

    if hasattr(financial_entry, "is_accounting_posted"):
        financial_entry.is_accounting_posted = True

    if hasattr(financial_entry, "posted_at") and not _safe_getattr(financial_entry, "posted_at"):
        financial_entry.posted_at = timezone.now()

    try:
        _save_with_update_fields(
            financial_entry,
            [
                "journal_entry",
                "journal_entry_reference",
                "is_accounting_posted",
                "posted_at",
                "updated_at",
            ],
        )
    except Exception:
        logger.debug("Financial entry posting metadata update skipped.", exc_info=True)

    return journal_entry


post_agent_financial_entry = post_agent_financial_entry_accrual
post_broker_financial_entry_accrual = post_agent_financial_entry_accrual
post_agent_delivery_fee_accrual = post_agent_financial_entry_accrual
post_cod_collection_to_agent_custody = post_agent_financial_entry_accrual


# ============================================================
# 🏦 Treasury Settlement Posting Helpers
# ============================================================

def _resolve_treasury_transaction_amount(txn: Any) -> Decimal:
    return _money(
        _first_non_empty(
            _safe_getattr(txn, "net_amount"),
            _safe_getattr(txn, "amount"),
            MONEY_ZERO,
        )
    )


def _resolve_treasury_transaction_date(txn: Any) -> date:
    return _coerce_to_date(
        _first_non_empty(
            _safe_getattr(txn, "transaction_date"),
            _safe_getattr(txn, "confirmed_at"),
            _safe_getattr(txn, "created_at"),
            timezone.localdate(),
        )
    ) or timezone.localdate()


def _resolve_treasury_transaction_number(txn: Any) -> str:
    return str(
        _first_non_empty(
            _safe_getattr(txn, "transaction_number"),
            _safe_getattr(txn, "reference"),
            f"TRX-{_safe_getattr(txn, 'pk', 'unknown')}",
        )
    )


def _resolve_treasury_account_ledger_account(txn: Any) -> Account:
    treasury_account = _safe_getattr(txn, "treasury_account", None)

    if not treasury_account:
        raise AccountingPostingError("حساب الخزينة مطلوب.")

    ledger_account = _safe_getattr(treasury_account, "ledger_account", None)

    if not ledger_account:
        raise AccountingConfigurationError("حساب الخزينة غير مربوط بحساب محاسبي.")

    return _validate_postable_account(ledger_account, "treasury_ledger_account")


def _resolve_treasury_counterparty_account(txn: Any) -> Account:
    counterparty = _safe_getattr(txn, "counterparty_ledger_account", None)

    if not counterparty:
        raise AccountingConfigurationError("الحساب المحاسبي المقابل مطلوب لحركة الخزينة.")

    return _validate_postable_account(counterparty, "counterparty_ledger_account")


@transaction.atomic
def post_treasury_transaction_to_accounting(txn: Any, *, actor: Any = None) -> JournalEntry:
    if not txn:
        raise AccountingPostingError("treasury transaction is required.")

    txn_id = _safe_getattr(txn, "pk", None)
    txn_number = _resolve_treasury_transaction_number(txn)

    existing = JournalEntry.objects.filter(
        source_type="treasury_transaction",
        source_id=str(txn_id),
    ).order_by("id").first()

    if existing:
        return existing

    amount = _resolve_treasury_transaction_amount(txn)

    if amount <= MONEY_ZERO:
        raise AccountingPostingError("مبلغ حركة الخزينة يجب أن يكون أكبر من صفر.")

    currency = _clean_currency(
        _first_non_empty(
            _safe_getattr(txn, "currency"),
            _safe_getattr(_safe_getattr(txn, "treasury_account", None), "currency"),
            "SAR",
        )
    )
    txn_date = _resolve_treasury_transaction_date(txn)
    txn_type = str(_safe_getattr(txn, "transaction_type", "") or "").upper()

    treasury_account = _resolve_treasury_account_ledger_account(txn)

    entry = _get_or_create_entry_header(
        entry_number=f"TRY-{txn_id}",
        entry_date=txn_date,
        posting_source=PostingSource.TREASURY_TRANSFER if txn_type == "TRANSFER" else PostingSource.TREASURY,
        reference=f"TREASURY:{txn_id}:POST",
        external_reference=txn_number,
        description=_safe_getattr(txn, "description", "") or f"ترحيل حركة خزينة {txn_number}",
        notes=_safe_getattr(txn, "notes", "") or "",
        currency=currency,
        source_type="treasury_transaction",
        source_id=str(txn_id),
        source_number=txn_number,
        is_auto_posted=True,
        actor=actor,
    )

    party_type = str(_safe_getattr(txn, "party_type", "") or "")
    party_id = str(_safe_getattr(txn, "party_id", "") or "")

    if txn_type == "TRANSFER":
        destination = _safe_getattr(txn, "destination_account", None)
        destination_ledger = _safe_getattr(destination, "ledger_account", None)

        if not destination_ledger:
            raise AccountingConfigurationError("حساب الوجهة غير مربوط بحساب محاسبي.")

        destination_ledger = _validate_postable_account(destination_ledger, "destination_ledger_account")

        lines = [
            EntryLinePayload(
                account=destination_ledger,
                description=f"تحويل وارد {txn_number}",
                debit_amount=amount,
                credit_amount=MONEY_ZERO,
                currency=currency,
                party_type=party_type,
                party_id=party_id,
                source_line_id=str(txn_id),
                sort_order=1,
            ),
            EntryLinePayload(
                account=treasury_account,
                description=f"تحويل صادر {txn_number}",
                debit_amount=MONEY_ZERO,
                credit_amount=amount,
                currency=currency,
                party_type=party_type,
                party_id=party_id,
                source_line_id=str(txn_id),
                sort_order=2,
            ),
        ]

    elif txn_type in {"INCOME", "DEPOSIT", "OPENING_BALANCE", "ADJUSTMENT"}:
        counterparty = _resolve_treasury_counterparty_account(txn)

        lines = [
            EntryLinePayload(
                account=treasury_account,
                description=f"قبض خزينة {txn_number}",
                debit_amount=amount,
                credit_amount=MONEY_ZERO,
                currency=currency,
                party_type=party_type,
                party_id=party_id,
                source_line_id=str(txn_id),
                sort_order=1,
            ),
            EntryLinePayload(
                account=counterparty,
                description=f"الحساب المقابل لقبض {txn_number}",
                debit_amount=MONEY_ZERO,
                credit_amount=amount,
                currency=currency,
                party_type=party_type,
                party_id=party_id,
                source_line_id=str(txn_id),
                sort_order=2,
            ),
        ]

    elif txn_type in {"EXPENSE", "WITHDRAW", "REFUND", "FEE"}:
        counterparty = _resolve_treasury_counterparty_account(txn)

        lines = [
            EntryLinePayload(
                account=counterparty,
                description=f"الحساب المقابل لصرف {txn_number}",
                debit_amount=amount,
                credit_amount=MONEY_ZERO,
                currency=currency,
                party_type=party_type,
                party_id=party_id,
                source_line_id=str(txn_id),
                sort_order=1,
            ),
            EntryLinePayload(
                account=treasury_account,
                description=f"صرف خزينة {txn_number}",
                debit_amount=MONEY_ZERO,
                credit_amount=amount,
                currency=currency,
                party_type=party_type,
                party_id=party_id,
                source_line_id=str(txn_id),
                sort_order=2,
            ),
        ]
    else:
        raise AccountingPostingError(f"نوع حركة الخزينة غير مدعوم: {txn_type}")

    entry = _replace_entry_lines(entry, lines, actor=actor)
    entry = _post_entry(entry, actor=actor)

    if hasattr(txn, "journal_entry"):
        txn.journal_entry = entry

    if hasattr(txn, "journal_entry_reference"):
        txn.journal_entry_reference = entry.entry_number

    try:
        _save_with_update_fields(
            txn,
            ["journal_entry", "journal_entry_reference", "updated_at"],
        )
    except Exception:
        logger.debug("Treasury transaction posting metadata update skipped.", exc_info=True)

    return entry


def post_agent_custody_settlement(txn: Any, *, actor: Any = None) -> JournalEntry:
    return post_treasury_transaction_to_accounting(txn, actor=actor)


def post_broker_custody_settlement(txn: Any, *, actor: Any = None) -> JournalEntry:
    return post_treasury_transaction_to_accounting(txn, actor=actor)


def post_agent_commission_payout(txn: Any, *, actor: Any = None) -> JournalEntry:
    return post_treasury_transaction_to_accounting(txn, actor=actor)


# ============================================================
# 🔁 Reverse Journal Entries
# ============================================================

@transaction.atomic
def reverse_journal_entry(
    entry: JournalEntry,
    *,
    reversal_date: date | None = None,
    reason: str = "",
    actor: Any = None,
) -> JournalEntry:
    if not entry:
        raise AccountingPostingError("entry is required.")

    entry = JournalEntry.objects.select_for_update().get(pk=entry.pk)

    if entry.status != JournalEntryStatus.POSTED:
        raise AccountingPostingError("لا يمكن عكس قيد غير مرحل.")

    existing = JournalEntry.objects.filter(reversal_of=entry).order_by("id").first()
    if existing:
        return existing

    reversal_date = reversal_date or timezone.localdate()
    reversal_number = f"REV-{entry.entry_number}"

    reversal = _get_or_create_entry_header(
        entry_number=reversal_number,
        entry_date=reversal_date,
        posting_source=entry.posting_source,
        reference=f"REVERSAL:{entry.pk}",
        external_reference=entry.entry_number,
        description=f"عكس القيد {entry.entry_number}",
        notes=reason or "",
        currency=entry.currency,
        source_type=entry.source_type,
        source_id=entry.source_id,
        source_number=entry.source_number,
        is_auto_posted=True,
        actor=actor,
    )

    reversal.reversal_of = entry
    reversal.save(update_fields=["reversal_of", "updated_at"])

    lines: list[EntryLinePayload] = []
    for index, line in enumerate(
        _entry_lines_qs(entry)
        .select_related("account", "cost_center", "tax_rate")
        .order_by("sort_order", "id"),
        start=1,
    ):
        lines.append(
            EntryLinePayload(
                account=line.account,
                description=f"عكس: {line.description}",
                debit_amount=_money(line.credit_amount),
                credit_amount=_money(line.debit_amount),
                currency=line.currency,
                cost_center=line.cost_center,
                tax_rate=line.tax_rate,
                tax_amount=_money(_safe_getattr(line, "tax_amount", MONEY_ZERO)),
                party_type=line.party_type,
                party_id=line.party_id,
                source_line_id=line.source_line_id,
                sort_order=index,
                metadata={"reversal_of_line_id": line.pk},
            )
        )

    reversal = _replace_entry_lines(reversal, lines, actor=actor)
    reversal = _post_entry(reversal, actor=actor)

    entry.status = JournalEntryStatus.REVERSED
    if hasattr(entry, "reversed_entry"):
        entry.reversed_entry = reversal
    if hasattr(entry, "reversed_at"):
        entry.reversed_at = timezone.now()

    _save_with_update_fields(entry, ["status", "reversed_entry", "reversed_at", "updated_at"])

    return reversal


# ============================================================
# 📊 Reports Helpers
# ============================================================

def _posted_entries_filter(posted_only: bool = True) -> Q:
    if posted_only:
        return Q(**{f"{_entry_line_fk_name()}__status": JournalEntryStatus.POSTED})
    return Q()


def _entry_line_queryset(
    *,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    posted_only: bool = True,
) -> QuerySet[JournalEntryLine]:
    fk_name = _entry_line_fk_name()
    qs = JournalEntryLine.objects.select_related(
        fk_name,
        "account",
        "cost_center",
        "tax_rate",
    )

    if posted_only:
        qs = qs.filter(**{f"{fk_name}__status": JournalEntryStatus.POSTED})

    start_date = _coerce_to_date(date_from)
    end_date = _coerce_to_date(date_to)

    if start_date:
        qs = qs.filter(**{f"{fk_name}__entry_date__gte": start_date})

    if end_date:
        qs = qs.filter(**{f"{fk_name}__entry_date__lte": end_date})

    return qs


def _normal_account_balance(account: Account, debit: Decimal, credit: Decimal) -> Decimal:
    debit = _money(debit)
    credit = _money(credit)

    if account.nature == AccountNature.DEBIT:
        return _money(debit - credit)

    return _money(credit - debit)


def _serialize_decimal(value: Decimal) -> str:
    return str(_money(value))


# ============================================================
# 📊 Trial Balance
# ============================================================

def build_trial_balance(
    *,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    include_zero_accounts: bool = False,
    posted_only: bool = True,
) -> TrialBalanceResult:
    start_date = _coerce_to_date(date_from)
    end_date = _coerce_to_date(date_to)

    rows: list[TrialBalanceRow] = []
    total_debit = MONEY_ZERO
    total_credit = MONEY_ZERO

    accounts = Account.objects.filter(is_active=True, is_group=False).order_by("code")

    line_qs = _entry_line_queryset(
        date_from=start_date,
        date_to=end_date,
        posted_only=posted_only,
    )

    for account in accounts:
        totals = line_qs.filter(account=account).aggregate(
            debit=Sum("debit_amount"),
            credit=Sum("credit_amount"),
        )

        debit = _money(totals.get("debit") or MONEY_ZERO)
        credit = _money(totals.get("credit") or MONEY_ZERO)
        balance = _normal_account_balance(account, debit, credit)

        if not include_zero_accounts and debit == MONEY_ZERO and credit == MONEY_ZERO:
            continue

        rows.append(
            TrialBalanceRow(
                account_id=account.pk,
                account_code=account.code,
                account_name=account.name,
                account_type=account.account_type,
                account_nature=account.nature,
                debit_amount=debit,
                credit_amount=credit,
                balance_amount=balance,
            )
        )

        total_debit += debit
        total_credit += credit

    total_debit = _money(total_debit)
    total_credit = _money(total_credit)

    return TrialBalanceResult(
        date_from=start_date,
        date_to=end_date,
        total_debit=total_debit,
        total_credit=total_credit,
        is_balanced=(total_debit == total_credit),
        rows=rows,
    )


def _serialize_trial_balance_row(row: TrialBalanceRow) -> dict[str, Any]:
    data = asdict(row)
    data["debit_amount"] = _serialize_decimal(row.debit_amount)
    data["credit_amount"] = _serialize_decimal(row.credit_amount)
    data["balance_amount"] = _serialize_decimal(row.balance_amount)
    return data


def _serialize_trial_balance_result(result: TrialBalanceResult) -> dict[str, Any]:
    return {
        "date_from": result.date_from.isoformat() if result.date_from else None,
        "date_to": result.date_to.isoformat() if result.date_to else None,
        "total_debit": _serialize_decimal(result.total_debit),
        "total_credit": _serialize_decimal(result.total_credit),
        "is_balanced": result.is_balanced,
        "rows": [_serialize_trial_balance_row(row) for row in result.rows],
    }


def build_trial_balance_payload(
    *,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    include_zero_accounts: bool = False,
    posted_only: bool = True,
) -> dict[str, Any]:
    result = build_trial_balance(
        date_from=date_from,
        date_to=date_to,
        include_zero_accounts=include_zero_accounts,
        posted_only=posted_only,
    )
    return _serialize_trial_balance_result(result)


# ============================================================
# 📚 General Ledger
# ============================================================

def build_general_ledger(
    account: Account,
    *,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    posted_only: bool = True,
) -> GeneralLedgerResult:
    if not account:
        raise AccountingReportError("account is required.")

    start_date = _coerce_to_date(date_from)
    end_date = _coerce_to_date(date_to)
    fk_name = _entry_line_fk_name()

    before_qs = _entry_line_queryset(
        date_to=start_date,
        posted_only=posted_only,
    ).filter(account=account)

    if start_date:
        before_qs = before_qs.exclude(**{f"{fk_name}__entry_date": start_date})
    else:
        before_qs = before_qs.none()

    before_totals = before_qs.aggregate(
        debit=Sum("debit_amount"),
        credit=Sum("credit_amount"),
    )
    opening_balance = _normal_account_balance(
        account,
        _money(before_totals.get("debit") or MONEY_ZERO),
        _money(before_totals.get("credit") or MONEY_ZERO),
    )

    line_qs = _entry_line_queryset(
        date_from=start_date,
        date_to=end_date,
        posted_only=posted_only,
    ).filter(account=account).order_by(
        f"{fk_name}__entry_date",
        f"{fk_name}__id",
        "sort_order",
        "id",
    )

    balance = opening_balance
    total_debit = MONEY_ZERO
    total_credit = MONEY_ZERO
    lines: list[GeneralLedgerLine] = []

    for line in line_qs:
        entry = _line_entry(line)
        debit = _money(line.debit_amount)
        credit = _money(line.credit_amount)

        total_debit += debit
        total_credit += credit

        if account.nature == AccountNature.DEBIT:
            balance = _money(balance + debit - credit)
        else:
            balance = _money(balance + credit - debit)

        lines.append(
            GeneralLedgerLine(
                line_date=entry.entry_date,
                entry_id=entry.pk,
                entry_number=entry.entry_number,
                posting_source=entry.posting_source,
                reference=entry.reference,
                description=line.description or entry.description,
                debit_amount=debit,
                credit_amount=credit,
                balance_after=balance,
                currency=line.currency,
                party_type=line.party_type,
                party_id=line.party_id,
                source_line_id=line.source_line_id,
            )
        )

    return GeneralLedgerResult(
        account_id=account.pk,
        account_code=account.code,
        account_name=account.name,
        date_from=start_date,
        date_to=end_date,
        opening_balance=opening_balance,
        total_debit=_money(total_debit),
        total_credit=_money(total_credit),
        closing_balance=balance,
        lines=lines,
    )


def _serialize_general_ledger_line(line: GeneralLedgerLine) -> dict[str, Any]:
    data = asdict(line)
    data["line_date"] = line.line_date.isoformat() if line.line_date else None
    data["debit_amount"] = _serialize_decimal(line.debit_amount)
    data["credit_amount"] = _serialize_decimal(line.credit_amount)
    data["balance_after"] = _serialize_decimal(line.balance_after)
    return data


def _serialize_general_ledger_result(result: GeneralLedgerResult) -> dict[str, Any]:
    return {
        "account_id": result.account_id,
        "account_code": result.account_code,
        "account_name": result.account_name,
        "date_from": result.date_from.isoformat() if result.date_from else None,
        "date_to": result.date_to.isoformat() if result.date_to else None,
        "opening_balance": _serialize_decimal(result.opening_balance),
        "total_debit": _serialize_decimal(result.total_debit),
        "total_credit": _serialize_decimal(result.total_credit),
        "closing_balance": _serialize_decimal(result.closing_balance),
        "lines": [_serialize_general_ledger_line(line) for line in result.lines],
    }


def build_general_ledger_payload(
    account: Account,
    *,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    posted_only: bool = True,
) -> dict[str, Any]:
    result = build_general_ledger(
        account=account,
        date_from=date_from,
        date_to=date_to,
        posted_only=posted_only,
    )
    return _serialize_general_ledger_result(result)


# ============================================================
# 📈 Income Statement / Profit & Loss
# ============================================================

def _account_type_amounts(
    account_type: str,
    *,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    posted_only: bool = True,
    include_zero_accounts: bool = False,
) -> tuple[Decimal, list[IncomeStatementRow]]:
    line_qs = _entry_line_queryset(
        date_from=date_from,
        date_to=date_to,
        posted_only=posted_only,
    )

    total = MONEY_ZERO
    rows: list[IncomeStatementRow] = []

    accounts = Account.objects.filter(
        account_type=account_type,
        is_active=True,
        is_group=False,
    ).order_by("code")

    for account in accounts:
        totals = line_qs.filter(account=account).aggregate(
            debit=Sum("debit_amount"),
            credit=Sum("credit_amount"),
        )
        debit = _money(totals.get("debit") or MONEY_ZERO)
        credit = _money(totals.get("credit") or MONEY_ZERO)
        amount = _normal_account_balance(account, debit, credit)

        if not include_zero_accounts and amount == MONEY_ZERO:
            continue

        rows.append(
            IncomeStatementRow(
                account_id=account.pk,
                account_code=account.code,
                account_name=account.name,
                amount=amount,
            )
        )
        total += amount

    return _money(total), rows


def build_income_statement(
    *,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    include_zero_accounts: bool = False,
    posted_only: bool = True,
) -> IncomeStatementResult:
    start_date = _coerce_to_date(date_from)
    end_date = _coerce_to_date(date_to)

    total_revenue, revenue_rows = _account_type_amounts(
        AccountType.REVENUE,
        date_from=start_date,
        date_to=end_date,
        posted_only=posted_only,
        include_zero_accounts=include_zero_accounts,
    )

    total_expense, expense_rows = _account_type_amounts(
        AccountType.EXPENSE,
        date_from=start_date,
        date_to=end_date,
        posted_only=posted_only,
        include_zero_accounts=include_zero_accounts,
    )

    return IncomeStatementResult(
        date_from=start_date,
        date_to=end_date,
        total_revenue=total_revenue,
        total_expense=total_expense,
        net_income=_money(total_revenue - total_expense),
        revenue_rows=revenue_rows,
        expense_rows=expense_rows,
    )


def _serialize_income_statement_row(row: IncomeStatementRow) -> dict[str, Any]:
    data = asdict(row)
    data["amount"] = _serialize_decimal(row.amount)
    return data


def _serialize_income_statement_result(result: IncomeStatementResult) -> dict[str, Any]:
    return {
        "date_from": result.date_from.isoformat() if result.date_from else None,
        "date_to": result.date_to.isoformat() if result.date_to else None,
        "total_revenue": _serialize_decimal(result.total_revenue),
        "total_expense": _serialize_decimal(result.total_expense),
        "net_income": _serialize_decimal(result.net_income),
        "revenue_rows": [_serialize_income_statement_row(row) for row in result.revenue_rows],
        "expense_rows": [_serialize_income_statement_row(row) for row in result.expense_rows],
    }


def build_income_statement_payload(
    *,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    include_zero_accounts: bool = False,
    posted_only: bool = True,
) -> dict[str, Any]:
    result = build_income_statement(
        date_from=date_from,
        date_to=date_to,
        include_zero_accounts=include_zero_accounts,
        posted_only=posted_only,
    )
    return _serialize_income_statement_result(result)


def build_profit_and_loss(
    *,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    include_zero_accounts: bool = False,
    posted_only: bool = True,
) -> IncomeStatementResult:
    return build_income_statement(
        date_from=date_from,
        date_to=date_to,
        include_zero_accounts=include_zero_accounts,
        posted_only=posted_only,
    )


def build_profit_and_loss_payload(
    *,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    include_zero_accounts: bool = False,
    posted_only: bool = True,
) -> dict[str, Any]:
    result = build_profit_and_loss(
        date_from=date_from,
        date_to=date_to,
        include_zero_accounts=include_zero_accounts,
        posted_only=posted_only,
    )

    payload = _serialize_income_statement_result(result)

    payload.setdefault("total_income", payload.get("total_revenue", "0.00"))
    payload.setdefault("total_expenses", payload.get("total_expense", "0.00"))
    payload.setdefault("profit_or_loss", payload.get("net_income", "0.00"))
    payload.setdefault("income_rows", payload.get("revenue_rows", []))
    payload.setdefault("expense_rows", payload.get("expense_rows", []))

    return payload


# ============================================================
# 🧾 Balance Sheet
# ============================================================

def _balance_sheet_section(
    account_type: str,
    *,
    as_of_date: date | datetime | None = None,
    posted_only: bool = True,
    include_zero_accounts: bool = False,
) -> tuple[Decimal, list[BalanceSheetRow]]:
    line_qs = _entry_line_queryset(
        date_to=as_of_date,
        posted_only=posted_only,
    )

    total = MONEY_ZERO
    rows: list[BalanceSheetRow] = []

    accounts = Account.objects.filter(
        account_type=account_type,
        is_active=True,
        is_group=False,
    ).order_by("code")

    for account in accounts:
        totals = line_qs.filter(account=account).aggregate(
            debit=Sum("debit_amount"),
            credit=Sum("credit_amount"),
        )
        debit = _money(totals.get("debit") or MONEY_ZERO)
        credit = _money(totals.get("credit") or MONEY_ZERO)
        amount = _normal_account_balance(account, debit, credit)

        if not include_zero_accounts and amount == MONEY_ZERO:
            continue

        rows.append(
            BalanceSheetRow(
                account_id=account.pk,
                account_code=account.code,
                account_name=account.name,
                amount=amount,
            )
        )
        total += amount

    return _money(total), rows


def build_balance_sheet(
    *,
    as_of_date: date | datetime | None = None,
    include_zero_accounts: bool = False,
    posted_only: bool = True,
    include_current_year_earnings: bool = True,
) -> BalanceSheetResult:
    target_date = _coerce_to_date(as_of_date)

    total_assets, asset_rows = _balance_sheet_section(
        AccountType.ASSET,
        as_of_date=target_date,
        posted_only=posted_only,
        include_zero_accounts=include_zero_accounts,
    )

    total_liabilities, liability_rows = _balance_sheet_section(
        AccountType.LIABILITY,
        as_of_date=target_date,
        posted_only=posted_only,
        include_zero_accounts=include_zero_accounts,
    )

    total_equity, equity_rows = _balance_sheet_section(
        AccountType.EQUITY,
        as_of_date=target_date,
        posted_only=posted_only,
        include_zero_accounts=include_zero_accounts,
    )

    if include_current_year_earnings:
        income_result = build_income_statement(
            date_from=None,
            date_to=target_date,
            include_zero_accounts=False,
            posted_only=posted_only,
        )
        earnings = income_result.net_income
        if earnings != MONEY_ZERO:
            equity_rows.append(
                BalanceSheetRow(
                    account_id=0,
                    account_code="CURRENT_EARNINGS",
                    account_name="أرباح / خسائر الفترة",
                    amount=earnings,
                )
            )
            total_equity = _money(total_equity + earnings)

    total_liabilities_and_equity = _money(total_liabilities + total_equity)

    return BalanceSheetResult(
        as_of_date=target_date,
        assets=BalanceSheetSection(
            title="الأصول",
            total_amount=total_assets,
            rows=asset_rows,
        ),
        liabilities=BalanceSheetSection(
            title="الالتزامات",
            total_amount=total_liabilities,
            rows=liability_rows,
        ),
        equity=BalanceSheetSection(
            title="حقوق الملكية",
            total_amount=total_equity,
            rows=equity_rows,
        ),
        total_liabilities_and_equity=total_liabilities_and_equity,
        is_balanced=(total_assets == total_liabilities_and_equity),
    )


def _serialize_balance_sheet_row(row: BalanceSheetRow) -> dict[str, Any]:
    data = asdict(row)
    data["amount"] = _serialize_decimal(row.amount)
    return data


def _serialize_balance_sheet_section(section: BalanceSheetSection) -> dict[str, Any]:
    return {
        "title": section.title,
        "total_amount": _serialize_decimal(section.total_amount),
        "rows": [_serialize_balance_sheet_row(row) for row in section.rows],
    }


def _serialize_balance_sheet_result(result: BalanceSheetResult) -> dict[str, Any]:
    return {
        "as_of_date": result.as_of_date.isoformat() if result.as_of_date else None,
        "assets": _serialize_balance_sheet_section(result.assets),
        "liabilities": _serialize_balance_sheet_section(result.liabilities),
        "equity": _serialize_balance_sheet_section(result.equity),
        "total_liabilities_and_equity": _serialize_decimal(result.total_liabilities_and_equity),
        "is_balanced": result.is_balanced,
    }


def build_balance_sheet_payload(
    *,
    as_of_date: date | datetime | None = None,
    include_zero_accounts: bool = False,
    posted_only: bool = True,
    include_current_year_earnings: bool = True,
) -> dict[str, Any]:
    result = build_balance_sheet(
        as_of_date=as_of_date,
        include_zero_accounts=include_zero_accounts,
        posted_only=posted_only,
        include_current_year_earnings=include_current_year_earnings,
    )
    return _serialize_balance_sheet_result(result)