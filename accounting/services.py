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
#    - عكس القيود المرحلة
#    - ميزان المراجعة
#    - الأستاذ العام
#    - قائمة الدخل
#    - الميزانية العمومية
# ------------------------------------------------------------
# ملاحظات مهمة:
# - Idempotent: لا يكرر القيود لنفس المصدر.
# - لا يرحّل على حساب تجميعي أو غير نشط.
# - لا ينشئ قيد مرحل قبل إنشاء أسطره.
# - يمنع استبدال أسطر قيد مرحل قائم حتى لا تتغير الدفاتر بصمت.
# - التقارير تعتمد افتراضيًا على القيود المرحلة والمعكوسة.
# - عند عكس القيد يتم إنشاء قيد عكسي مستقل.
# ============================================================

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import date, datetime, time
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Iterable, List, Optional

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from accounting.models import (
    Account,
    AccountingAccountPurpose,
    AccountingPeriod,
    AccountingPeriodStatus,
    AccountingRoutingRule,
    AccountingRoutingSource,
    CostCenter,
    JournalEntry,
    JournalEntryLine,
    JournalEntryStatus,
    PostingSource,
    TaxDirection,
    TaxRate,
    TaxTransaction,
)

from agents.models import AgentCommission
from invoices.models import Invoice, InvoiceStatus
from payments.models import Payment, PaymentStatus


# ============================================================
# 🧩 أكواد الحسابات التشغيلية المعتمدة داخل Primey Care
# ============================================================

ACCOUNT_CODE_ACCOUNTS_RECEIVABLE = "1103"
ACCOUNT_CODE_CASH_ON_HAND = "110101"
ACCOUNT_CODE_BANK = "110201"

ACCOUNT_CODE_MOYASAR_CLEARING = "110401"
ACCOUNT_CODE_TAP_CLEARING = "110402"
ACCOUNT_CODE_TAMARA_CLEARING = "110403"
ACCOUNT_CODE_TABBY_CLEARING = "110404"

ACCOUNT_CODE_REVENUE = "4101"
ACCOUNT_CODE_CARDS_REVENUE = "410101"
ACCOUNT_CODE_PROGRAMS_REVENUE = "410102"
ACCOUNT_CODE_SERVICES_REVENUE = "410103"
ACCOUNT_CODE_SUBSCRIPTIONS_REVENUE = "410104"

ACCOUNT_CODE_VAT_PAYABLE = "2105"
ACCOUNT_CODE_OUTPUT_VAT = "210501"
ACCOUNT_CODE_INPUT_VAT = "210502"

ACCOUNT_CODE_AGENT_COMMISSION_EXPENSE = "5103"
ACCOUNT_CODE_AGENT_COMMISSION_PAYABLE = "2110"
ACCOUNT_CODE_PROVIDER_PAYABLE = "2111"

ACCOUNT_CODE_BANK_FEES = "5213"
ACCOUNT_CODE_GATEWAY_FEES = "5214"
ACCOUNT_CODE_OTHER_EXPENSE = "5215"
ACCOUNT_CODE_OTHER_REVENUE = "4201"
ACCOUNT_CODE_OPENING_EQUITY = "3201"


POSTED_REPORT_STATUSES = {
    JournalEntryStatus.POSTED,
    JournalEntryStatus.REVERSED,
}


# ============================================================
# 🧾 DTO داخلي لأسطر القيد
# ============================================================

@dataclass(slots=True)
class EntryLinePayload:
    account: Account
    description: str
    debit_amount: Decimal = Decimal("0.00")
    credit_amount: Decimal = Decimal("0.00")
    sort_order: int = 0
    cost_center: Optional[CostCenter] = None
    tax_rate: Optional[TaxRate] = None
    tax_amount: Decimal = Decimal("0.00")
    party_type: str = ""
    party_id: str = ""
    source_line_id: str = ""
    metadata: Optional[dict[str, Any]] = None


# ============================================================
# 📊 DTOs — Trial Balance
# ============================================================

@dataclass(slots=True)
class TrialBalanceRow:
    account_id: int
    account_code: str
    account_name: str
    account_type: str
    is_group: bool
    total_debit: Decimal
    total_credit: Decimal
    net_debit: Decimal
    net_credit: Decimal


@dataclass(slots=True)
class TrialBalanceResult:
    currency: str
    date_from: Optional[str]
    date_to: Optional[str]
    total_accounts: int
    total_debit: Decimal
    total_credit: Decimal
    is_balanced: bool
    rows: list[TrialBalanceRow]


# ============================================================
# 📊 DTOs — General Ledger
# ============================================================

@dataclass(slots=True)
class LedgerLine:
    entry_id: int
    entry_number: str
    entry_date: str
    posting_source: str
    reference: str
    description: str
    debit_amount: Decimal
    credit_amount: Decimal
    running_balance: Decimal


@dataclass(slots=True)
class LedgerResult:
    account_id: int
    account_code: str
    account_name: str
    account_type: str
    currency: str
    date_from: Optional[str]
    date_to: Optional[str]
    opening_balance: Decimal
    total_debit: Decimal
    total_credit: Decimal
    closing_balance: Decimal
    lines: list[LedgerLine]


# ============================================================
# 📊 DTOs — Profit & Loss
# ============================================================

@dataclass(slots=True)
class ProfitLossRow:
    account_id: int
    account_code: str
    account_name: str
    account_type: str
    amount: Decimal


@dataclass(slots=True)
class ProfitLossSection:
    title: str
    total_amount: Decimal
    rows: list[ProfitLossRow]


@dataclass(slots=True)
class ProfitLossResult:
    currency: str
    date_from: Optional[str]
    date_to: Optional[str]
    revenue: ProfitLossSection
    expenses: ProfitLossSection
    net_profit: Decimal


# ============================================================
# 📊 DTOs — Balance Sheet
# ============================================================

@dataclass(slots=True)
class BalanceSheetRow:
    account_id: int
    account_code: str
    account_name: str
    account_type: str
    amount: Decimal


@dataclass(slots=True)
class BalanceSheetSection:
    title: str
    total_amount: Decimal
    rows: list[BalanceSheetRow]


@dataclass(slots=True)
class BalanceSheetResult:
    currency: str
    as_of_date: Optional[str]
    assets: BalanceSheetSection
    liabilities: BalanceSheetSection
    equity: BalanceSheetSection
    total_liabilities_and_equity: Decimal
    is_balanced: bool


# ============================================================
# 🛠️ Helpers عامة
# ============================================================

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


def _safe_getattr(obj: Any, attr_name: str, default: Any = None) -> Any:
    try:
        return getattr(obj, attr_name, default)
    except Exception:
        return default


def _choice_value(value: Any) -> str:
    raw = getattr(value, "value", value)
    return str(raw or "").strip().upper()


def _first_non_empty(*values):
    for value in values:
        if value not in (None, "", [], {}, ()):
            return value
    return None


def _build_entry_number(prefix: str, object_id: int | str | None) -> str:
    if object_id in [None, ""]:
        raise ValidationError("لا يمكن بناء رقم قيد بدون معرف.")
    return f"{prefix}-{object_id}"


def _build_reversal_entry_number(entry: JournalEntry) -> str:
    return f"REV-{entry.entry_number}"


def _date_from_datetime_or_today(value) -> date:
    if value:
        try:
            return value.date()
        except Exception:
            return value
    return timezone.localdate()


def _normalize_currency(value: str | None = None) -> str:
    return str(value or "SAR").strip().upper()


# ============================================================
# 🧭 Account Resolution
# ============================================================

def _get_required_account(account_code: str) -> Account:
    code = str(account_code or "").strip()

    if not code:
        raise ValidationError("كود الحساب المحاسبي مطلوب.")

    try:
        account = Account.objects.get(code=code)
    except Account.DoesNotExist as exc:
        raise ValidationError(
            f"الحساب المحاسبي المطلوب غير موجود. الكود المطلوب: {code}"
        ) from exc

    if not account.is_active:
        raise ValidationError(
            f"الحساب المحاسبي بالكود {code} ({account.name}) غير نشط."
        )

    if account.is_group:
        raise ValidationError(
            f"الحساب المحاسبي بالكود {code} ({account.name}) حساب تجميعي ولا يمكن الترحيل عليه."
        )

    return account


def _resolve_routing_account(
    *,
    source: str,
    purpose: str,
    fallback_code: str,
) -> Account:
    rule = (
        AccountingRoutingRule.objects.select_related("account")
        .filter(
            source=source,
            purpose=purpose,
            is_active=True,
            account__is_active=True,
            account__is_group=False,
        )
        .order_by("priority", "id")
        .first()
    )

    if rule and rule.account:
        return rule.account

    return _get_required_account(fallback_code)


def _resolve_default_tax_rate() -> TaxRate | None:
    return TaxRate.objects.filter(is_default=True, is_active=True).order_by("id").first()


def _resolve_period_for_date(entry_date: date) -> AccountingPeriod | None:
    return (
        AccountingPeriod.objects.filter(
            start_date__lte=entry_date,
            end_date__gte=entry_date,
            status=AccountingPeriodStatus.OPEN,
        )
        .order_by("start_date")
        .first()
    )


def _resolve_payment_treasury_account(payment: Payment) -> Account:
    """
    يحدد حساب الخزينة أو البنك أو حساب تسوية البوابة حسب وسيلة الدفع.
    """
    method = _choice_value(_safe_getattr(payment, "payment_method", ""))

    gateway_provider = _choice_value(
        _first_non_empty(
            _safe_getattr(payment, "provider", ""),
            _safe_getattr(payment, "payment_provider", ""),
            _safe_getattr(payment, "gateway_provider", ""),
        )
    )

    if gateway_provider == "MOYASAR" or method == "MOYASAR":
        return _get_required_account(ACCOUNT_CODE_MOYASAR_CLEARING)

    if gateway_provider == "TAP" or method == "TAP":
        return _get_required_account(ACCOUNT_CODE_TAP_CLEARING)

    if gateway_provider == "TAMARA" or method == "TAMARA":
        return _get_required_account(ACCOUNT_CODE_TAMARA_CLEARING)

    if gateway_provider == "TABBY" or method == "TABBY":
        return _get_required_account(ACCOUNT_CODE_TABBY_CLEARING)

    bank_methods = {
        "BANK",
        "BANK_TRANSFER",
        "TRANSFER",
        "WIRE_TRANSFER",
        "CREDIT_CARD",
        "DEBIT_CARD",
        "CARD",
        "MADA",
        "VISA",
        "MASTERCARD",
        "APPLE_PAY",
        "STC_PAY",
        "GATEWAY",
        "ONLINE",
    }

    if method in bank_methods:
        return _resolve_routing_account(
            source=AccountingRoutingSource.PAYMENT_RECEIPT,
            purpose=AccountingAccountPurpose.BANK,
            fallback_code=ACCOUNT_CODE_BANK,
        )

    return _resolve_routing_account(
        source=AccountingRoutingSource.PAYMENT_RECEIPT,
        purpose=AccountingAccountPurpose.CASH,
        fallback_code=ACCOUNT_CODE_CASH_ON_HAND,
    )


def _resolve_invoice_revenue_account(invoice: Invoice) -> Account:
    """
    يحاول تحديد حساب الإيراد حسب المنتج/الطلب إن توفرت معلومات النوع.
    """
    order = _safe_getattr(invoice, "order", None)
    product = _safe_getattr(order, "product", None)

    product_type = _choice_value(
        _first_non_empty(
            _safe_getattr(product, "product_type", ""),
            _safe_getattr(invoice, "product_type", ""),
        )
    )

    if product_type in {"CARD", "CARDS"}:
        return _get_required_account(ACCOUNT_CODE_CARDS_REVENUE)

    if product_type in {"PROGRAM", "PROGRAMS", "PACKAGE", "PACKAGES"}:
        return _get_required_account(ACCOUNT_CODE_PROGRAMS_REVENUE)

    if product_type in {"SUBSCRIPTION", "MEMBERSHIP"}:
        return _get_required_account(ACCOUNT_CODE_SUBSCRIPTIONS_REVENUE)

    if product_type in {"SERVICE", "SERVICES"}:
        return _get_required_account(ACCOUNT_CODE_SERVICES_REVENUE)

    return _resolve_routing_account(
        source=AccountingRoutingSource.SALES_INVOICE,
        purpose=AccountingAccountPurpose.SALES_REVENUE,
        fallback_code=ACCOUNT_CODE_REVENUE,
    )


# ============================================================
# 🧾 Entry Header / Lines
# ============================================================

def _get_or_create_entry_header(
    *,
    entry_number: str,
    entry_date,
    posting_source: str,
    reference: str,
    external_reference: str = "",
    description: str = "",
    notes: str = "",
    currency: str = "SAR",
    source_type: str = "",
    source_id: str = "",
    source_number: str = "",
    is_auto_posted: bool = True,
    actor=None,
) -> JournalEntry:
    """
    ينشئ رأس القيد كمسودة أولًا.
    لا ننشئه POSTED قبل الأسطر حتى لا يفشل validation في models.py.
    """
    if not entry_number:
        raise ValidationError("رقم القيد مطلوب.")

    if not entry_date:
        entry_date = timezone.localdate()

    entry_date = _date_from_datetime_or_today(entry_date)

    defaults = {
        "entry_date": entry_date,
        "period": _resolve_period_for_date(entry_date),
        "status": JournalEntryStatus.DRAFT,
        "posting_source": posting_source,
        "reference": reference,
        "external_reference": external_reference or "",
        "description": description or "",
        "notes": notes or "",
        "currency": _normalize_currency(currency),
        "source_type": str(source_type or "").strip(),
        "source_id": str(source_id or "").strip(),
        "source_number": str(source_number or "").strip(),
        "is_auto_posted": bool(is_auto_posted),
    }

    if actor is not None and getattr(actor, "is_authenticated", False):
        defaults["created_by"] = actor

    entry, created = JournalEntry.objects.get_or_create(
        entry_number=entry_number,
        defaults=defaults,
    )

    if not created:
        if entry.status == JournalEntryStatus.CANCELLED:
            raise ValidationError(
                f"القيد {entry.entry_number} موجود لكنه ملغي ولا يمكن إعادة استخدامه."
            )

        if entry.status == JournalEntryStatus.REVERSED:
            raise ValidationError(
                f"القيد {entry.entry_number} موجود لكنه معكوس ولا يمكن إعادة استخدامه."
            )

        if reference and entry.reference and entry.reference != reference:
            raise ValidationError(
                f"رقم القيد {entry.entry_number} مستخدم مسبقًا بمرجع مختلف."
            )

        if entry.status == JournalEntryStatus.POSTED and entry.lines.exists():
            return entry

        for field_name, value in defaults.items():
            setattr(entry, field_name, value)

        entry.save(
            update_fields=[
                "entry_date",
                "period",
                "posting_source",
                "reference",
                "external_reference",
                "description",
                "notes",
                "currency",
                "source_type",
                "source_id",
                "source_number",
                "is_auto_posted",
                "updated_at",
            ]
        )

    return entry


def _validate_entry_lines(lines: Iterable[EntryLinePayload]) -> list[EntryLinePayload]:
    prepared_lines = list(lines)

    if not prepared_lines:
        raise ValidationError("لا يمكن إنشاء قيد بدون أسطر.")

    total_debit = Decimal("0.00")
    total_credit = Decimal("0.00")

    for item in prepared_lines:
        if not item.account:
            raise ValidationError("كل سطر قيد يجب أن يحتوي على حساب.")

        if item.account.is_group:
            raise ValidationError(
                f"لا يمكن الترحيل على حساب تجميعي: {item.account.code} - {item.account.name}"
            )

        if not item.account.is_active:
            raise ValidationError(
                f"لا يمكن الترحيل على حساب غير نشط: {item.account.code} - {item.account.name}"
            )

        if item.cost_center and not item.cost_center.can_post:
            raise ValidationError(
                f"لا يمكن الترحيل على مركز تكلفة غير قابل للترحيل: {item.cost_center}"
            )

        debit = _money(item.debit_amount)
        credit = _money(item.credit_amount)

        if debit < Decimal("0.00") or credit < Decimal("0.00"):
            raise ValidationError("لا يمكن أن تكون مبالغ القيد سالبة.")

        if debit == Decimal("0.00") and credit == Decimal("0.00"):
            raise ValidationError("لا يمكن إنشاء سطر قيد بقيمة صفرية.")

        if debit > Decimal("0.00") and credit > Decimal("0.00"):
            raise ValidationError("لا يمكن أن يحتوي نفس السطر على مدين ودائن معًا.")

        total_debit += debit
        total_credit += credit

    if _money(total_debit) != _money(total_credit):
        raise ValidationError(
            f"القيد غير متوازن. إجمالي المدين: {_money(total_debit)}، "
            f"إجمالي الدائن: {_money(total_credit)}"
        )

    if _money(total_debit) <= Decimal("0.00"):
        raise ValidationError("لا يمكن إنشاء قيد بإجمالي صفري.")

    return prepared_lines


def _replace_entry_lines(
    entry: JournalEntry,
    lines: Iterable[EntryLinePayload],
    *,
    actor=None,
) -> JournalEntry:
    """
    يستبدل أسطر القيد إذا كان القيد مسودة فقط.
    إذا كان القيد مرحلًا وموجودًا مسبقًا يرجعه كما هو لضمان idempotency.
    """
    if not entry:
        raise ValidationError("القيد مطلوب.")

    if entry.status == JournalEntryStatus.CANCELLED:
        raise ValidationError("لا يمكن تعديل قيد ملغي.")

    if entry.status == JournalEntryStatus.REVERSED:
        raise ValidationError("لا يمكن تعديل قيد معكوس.")

    if entry.status == JournalEntryStatus.POSTED and entry.lines.exists():
        if not entry.is_balanced:
            raise ValidationError("القيد المرحل الموجود غير متوازن.")
        return entry

    prepared_lines = _validate_entry_lines(lines)

    entry.lines.all().delete()

    for item in prepared_lines:
        JournalEntryLine.objects.create(
            journal_entry=entry,
            account=item.account,
            cost_center=item.cost_center,
            description=item.description or "",
            debit_amount=_money(item.debit_amount),
            credit_amount=_money(item.credit_amount),
            sort_order=item.sort_order,
            tax_rate=item.tax_rate,
            tax_amount=_money(item.tax_amount),
            party_type=item.party_type or "",
            party_id=item.party_id or "",
            source_line_id=item.source_line_id or "",
            metadata=item.metadata or {},
        )

    entry._sync_totals_from_lines()

    if not entry.is_balanced:
        raise ValidationError("القيد الناتج غير متوازن محاسبيًا.")

    entry.mark_as_posted(actor=actor)
    return entry


def _create_tax_transaction_if_needed(
    *,
    entry: JournalEntry,
    tax_rate: TaxRate | None,
    direction: str,
    taxable_amount,
    tax_amount,
    source_type: str,
    source_id: str,
    source_number: str,
    description: str,
    currency: str = "SAR",
) -> TaxTransaction | None:
    taxable_amount = _money(taxable_amount)
    tax_amount = _money(tax_amount)

    if not tax_rate or tax_amount <= Decimal("0.00"):
        return None

    tax_transaction, _ = TaxTransaction.objects.update_or_create(
        tax_rate=tax_rate,
        direction=direction,
        source_type=source_type,
        source_id=str(source_id or ""),
        source_number=str(source_number or ""),
        defaults={
            "journal_entry": entry,
            "journal_line": entry.lines.filter(tax_rate=tax_rate).order_by("id").first(),
            "transaction_date": entry.entry_date,
            "taxable_amount": taxable_amount,
            "tax_amount": tax_amount,
            "currency": _normalize_currency(currency),
            "description": description,
            "metadata": {"entry_number": entry.entry_number},
        },
    )

    return tax_transaction


# ============================================================
# 🧾 إنشاء قيد عام
# ============================================================

@transaction.atomic
def create_manual_journal_entry(
    *,
    entry_number: str,
    entry_date,
    posting_source: str = PostingSource.MANUAL,
    reference: str = "",
    external_reference: str = "",
    description: str = "",
    notes: str = "",
    currency: str = "SAR",
    lines: List[EntryLinePayload],
    actor=None,
) -> JournalEntry:
    prepared_lines = _validate_entry_lines(lines)

    entry = _get_or_create_entry_header(
        entry_number=entry_number,
        entry_date=entry_date,
        posting_source=posting_source,
        reference=reference,
        external_reference=external_reference,
        description=description,
        notes=notes,
        currency=currency,
        source_type="manual",
        source_id=entry_number,
        source_number=entry_number,
        is_auto_posted=False,
        actor=actor,
    )

    return _replace_entry_lines(entry, prepared_lines, actor=actor)


# ============================================================
# 🧾 عكس قيد مرحل
# ============================================================

@transaction.atomic
def reverse_journal_entry(
    entry: JournalEntry,
    *,
    reversal_date=None,
    reason: str = "",
    actor=None,
) -> JournalEntry:
    if not entry:
        raise ValidationError("القيد المطلوب عكسه غير موجود.")

    entry = JournalEntry.objects.select_for_update().prefetch_related("lines").get(pk=entry.pk)

    if entry.status == JournalEntryStatus.CANCELLED:
        raise ValidationError("لا يمكن عكس قيد ملغي.")

    if entry.status == JournalEntryStatus.REVERSED:
        if entry.reversed_entry:
            return entry.reversed_entry
        raise ValidationError("القيد معكوس مسبقًا.")

    if entry.status != JournalEntryStatus.POSTED:
        raise ValidationError("يمكن عكس القيود المرحلة فقط.")

    if entry.reversed_entry_id:
        return entry.reversed_entry

    reversal_date = reversal_date or timezone.localdate()

    reversal = _get_or_create_entry_header(
        entry_number=_build_reversal_entry_number(entry),
        entry_date=reversal_date,
        posting_source=entry.posting_source,
        reference=f"REVERSAL:{entry.pk}",
        external_reference=entry.entry_number,
        description=f"قيد عكسي للقيد {entry.entry_number}",
        notes=reason or f"عكس القيد {entry.entry_number}",
        currency=entry.currency,
        source_type="journal_entry_reversal",
        source_id=str(entry.pk),
        source_number=entry.entry_number,
        is_auto_posted=True,
        actor=actor,
    )

    lines: list[EntryLinePayload] = []

    for index, line in enumerate(entry.lines.select_related("account", "cost_center", "tax_rate").order_by("sort_order", "id"), start=1):
        lines.append(
            EntryLinePayload(
                account=line.account,
                cost_center=line.cost_center,
                tax_rate=line.tax_rate,
                tax_amount=line.tax_amount,
                description=f"عكس: {line.description}",
                debit_amount=line.credit_amount,
                credit_amount=line.debit_amount,
                sort_order=index,
                party_type=line.party_type,
                party_id=line.party_id,
                source_line_id=str(line.pk),
                metadata={
                    "reversal_of_line_id": line.pk,
                    "original_entry_number": entry.entry_number,
                },
            )
        )

    reversal = _replace_entry_lines(reversal, lines, actor=actor)
    entry.mark_as_reversed(reversed_entry=reversal)

    reversal.reversal_of = entry
    reversal.save(update_fields=["reversal_of", "updated_at"])

    return reversal


# ============================================================
# 🧾 ترحيل إصدار الفاتورة
# ============================================================

@transaction.atomic
def post_invoice_issue(
    invoice: Invoice,
    *,
    receivable_account_code: str = ACCOUNT_CODE_ACCOUNTS_RECEIVABLE,
    revenue_account_code: str | None = None,
    output_vat_account_code: str = ACCOUNT_CODE_OUTPUT_VAT,
    actor=None,
) -> JournalEntry:
    if not invoice:
        raise ValidationError("الفاتورة مطلوبة.")

    if invoice.status == InvoiceStatus.CANCELLED:
        raise ValidationError("لا يمكن ترحيل فاتورة ملغاة.")

    if not invoice.pk:
        raise ValidationError("لا يمكن ترحيل فاتورة غير محفوظة.")

    receivable_account = _resolve_routing_account(
        source=AccountingRoutingSource.SALES_INVOICE,
        purpose=AccountingAccountPurpose.ACCOUNTS_RECEIVABLE,
        fallback_code=receivable_account_code,
    )

    revenue_account = (
        _get_required_account(revenue_account_code)
        if revenue_account_code
        else _resolve_invoice_revenue_account(invoice)
    )

    output_vat_account = _resolve_routing_account(
        source=AccountingRoutingSource.SALES_INVOICE,
        purpose=AccountingAccountPurpose.OUTPUT_VAT,
        fallback_code=output_vat_account_code,
    )

    taxable_amount = _money(_safe_getattr(invoice, "taxable_amount", None))
    tax_amount = _money(_safe_getattr(invoice, "tax_amount", None))
    total_amount = _money(_safe_getattr(invoice, "total_amount", None))

    if total_amount <= Decimal("0.00"):
        raise ValidationError("لا يمكن ترحيل فاتورة بإجمالي صفري أو سالب.")

    if taxable_amount <= Decimal("0.00"):
        taxable_amount = _money(total_amount - tax_amount)

    if taxable_amount < Decimal("0.00"):
        raise ValidationError("صافي الفاتورة قبل الضريبة لا يمكن أن يكون سالبًا.")

    invoice_number = _safe_getattr(invoice, "invoice_number", "") or f"INV-{invoice.pk}"
    issue_date = _safe_getattr(invoice, "issue_date", None) or timezone.localdate()
    currency = _safe_getattr(invoice, "currency", "SAR") or "SAR"
    order_id = _safe_getattr(invoice, "order_id", None)
    customer_id = _safe_getattr(invoice, "customer_id", None)

    tax_rate = _resolve_default_tax_rate() if tax_amount > Decimal("0.00") else None

    entry = _get_or_create_entry_header(
        entry_number=_build_entry_number("INV", invoice.pk),
        entry_date=issue_date,
        posting_source=PostingSource.INVOICE,
        reference=f"INVOICE:{invoice.pk}:ISSUE",
        external_reference=invoice_number,
        description=f"ترحيل إصدار فاتورة رقم {invoice_number}",
        notes=f"Order #{order_id}" if order_id else "",
        currency=currency,
        source_type="invoice",
        source_id=str(invoice.pk),
        source_number=invoice_number,
        is_auto_posted=True,
        actor=actor,
    )

    lines: List[EntryLinePayload] = [
        EntryLinePayload(
            account=receivable_account,
            description=f"إثبات مديونية العميل - فاتورة {invoice_number}",
            debit_amount=total_amount,
            credit_amount=Decimal("0.00"),
            sort_order=1,
            party_type="customer" if customer_id else "",
            party_id=str(customer_id or ""),
            source_line_id=str(invoice.pk),
        ),
        EntryLinePayload(
            account=revenue_account,
            description=f"إثبات إيراد الفاتورة {invoice_number}",
            debit_amount=Decimal("0.00"),
            credit_amount=taxable_amount,
            sort_order=2,
            source_line_id=str(invoice.pk),
        ),
    ]

    if tax_amount > Decimal("0.00"):
        lines.append(
            EntryLinePayload(
                account=output_vat_account,
                description=f"إثبات ضريبة القيمة المضافة - فاتورة {invoice_number}",
                debit_amount=Decimal("0.00"),
                credit_amount=tax_amount,
                sort_order=3,
                tax_rate=tax_rate,
                tax_amount=tax_amount,
                source_line_id=str(invoice.pk),
            )
        )

    entry = _replace_entry_lines(entry, lines, actor=actor)

    _create_tax_transaction_if_needed(
        entry=entry,
        tax_rate=tax_rate,
        direction=TaxDirection.OUTPUT,
        taxable_amount=taxable_amount,
        tax_amount=tax_amount,
        source_type="invoice",
        source_id=str(invoice.pk),
        source_number=invoice_number,
        description=f"ضريبة مخرجات لفاتورة {invoice_number}",
        currency=currency,
    )

    return entry


# ============================================================
# 💳 ترحيل تحصيل دفعة
# ============================================================

@transaction.atomic
def post_payment_receipt(
    payment: Payment,
    *,
    receivable_account_code: str = ACCOUNT_CODE_ACCOUNTS_RECEIVABLE,
    actor=None,
) -> JournalEntry:
    if not payment:
        raise ValidationError("الدفع مطلوب.")

    if not payment.pk:
        raise ValidationError("لا يمكن ترحيل دفعة غير محفوظة.")

    allowed_statuses = {
        PaymentStatus.PAID,
        PaymentStatus.PARTIALLY_PAID,
    }

    if payment.status not in allowed_statuses:
        raise ValidationError("لا يمكن ترحيل دفعة غير محصلة فعليًا.")

    paid_amount = _money(_safe_getattr(payment, "paid_amount", None))

    if paid_amount <= Decimal("0.00"):
        paid_amount = _money(_safe_getattr(payment, "amount", None))

    if paid_amount <= Decimal("0.00"):
        raise ValidationError("المبلغ المدفوع يجب أن يكون أكبر من صفر.")

    treasury_account = _resolve_payment_treasury_account(payment)

    receivable_account = _resolve_routing_account(
        source=AccountingRoutingSource.PAYMENT_RECEIPT,
        purpose=AccountingAccountPurpose.ACCOUNTS_RECEIVABLE,
        fallback_code=receivable_account_code,
    )

    payment_number = _safe_getattr(payment, "payment_number", "") or f"PAY-{payment.pk}"
    paid_at = _safe_getattr(payment, "paid_at", None)
    order_id = _safe_getattr(payment, "order_id", None)
    customer_id = _safe_getattr(payment, "customer_id", None)
    currency = _safe_getattr(payment, "currency", "SAR") or "SAR"

    entry = _get_or_create_entry_header(
        entry_number=_build_entry_number("PAY", payment.pk),
        entry_date=_date_from_datetime_or_today(paid_at),
        posting_source=PostingSource.PAYMENT,
        reference=f"PAYMENT:{payment.pk}:RECEIPT",
        external_reference=payment_number,
        description=f"ترحيل تحصيل دفعة رقم {payment_number}",
        notes=f"Order #{order_id}" if order_id else "",
        currency=currency,
        source_type="payment",
        source_id=str(payment.pk),
        source_number=payment_number,
        is_auto_posted=True,
        actor=actor,
    )

    lines: List[EntryLinePayload] = [
        EntryLinePayload(
            account=treasury_account,
            description=f"إثبات التحصيل - دفعة {payment_number}",
            debit_amount=paid_amount,
            credit_amount=Decimal("0.00"),
            sort_order=1,
            party_type="customer" if customer_id else "",
            party_id=str(customer_id or ""),
            source_line_id=str(payment.pk),
        ),
        EntryLinePayload(
            account=receivable_account,
            description=f"تسوية ذمم العميل - دفعة {payment_number}",
            debit_amount=Decimal("0.00"),
            credit_amount=paid_amount,
            sort_order=2,
            party_type="customer" if customer_id else "",
            party_id=str(customer_id or ""),
            source_line_id=str(payment.pk),
        ),
    ]

    return _replace_entry_lines(entry, lines, actor=actor)


# ============================================================
# 💸 ترحيل استحقاق عمولة مندوب
# ============================================================

@transaction.atomic
def post_agent_commission_accrual(
    agent_commission: AgentCommission,
    *,
    commission_expense_account_code: str = ACCOUNT_CODE_AGENT_COMMISSION_EXPENSE,
    commission_payable_account_code: str = ACCOUNT_CODE_AGENT_COMMISSION_PAYABLE,
    actor=None,
) -> JournalEntry:
    if not agent_commission:
        raise ValidationError("سجل العمولة مطلوب.")

    if not agent_commission.pk:
        raise ValidationError("لا يمكن ترحيل عمولة غير محفوظة.")

    commission_amount = _money(_safe_getattr(agent_commission, "commission_amount", None))

    if commission_amount <= Decimal("0.00"):
        raise ValidationError("قيمة العمولة يجب أن تكون أكبر من صفر.")

    expense_account = _resolve_routing_account(
        source=AccountingRoutingSource.AGENT_COMMISSION,
        purpose=AccountingAccountPurpose.AGENT_COMMISSION_EXPENSE,
        fallback_code=commission_expense_account_code,
    )

    payable_account = _resolve_routing_account(
        source=AccountingRoutingSource.AGENT_COMMISSION,
        purpose=AccountingAccountPurpose.AGENT_COMMISSION_PAYABLE,
        fallback_code=commission_payable_account_code,
    )

    earned_at = _safe_getattr(agent_commission, "earned_at", None)
    order_id = _safe_getattr(agent_commission, "order_id", None)
    agent_id = _safe_getattr(agent_commission, "agent_id", None)

    entry = _get_or_create_entry_header(
        entry_number=_build_entry_number("COM", agent_commission.pk),
        entry_date=_date_from_datetime_or_today(earned_at),
        posting_source=PostingSource.AGENT_COMMISSION,
        reference=f"AGENT_COMMISSION:{agent_commission.pk}:ACCRUAL",
        external_reference=str(order_id or ""),
        description=f"ترحيل استحقاق عمولة مندوب للطلب #{order_id or '-'}",
        notes=f"Agent #{agent_id}" if agent_id else "",
        currency="SAR",
        source_type="agent_commission",
        source_id=str(agent_commission.pk),
        source_number=str(order_id or ""),
        is_auto_posted=True,
        actor=actor,
    )

    lines: List[EntryLinePayload] = [
        EntryLinePayload(
            account=expense_account,
            description=f"مصروف عمولة مندوب - الطلب #{order_id or '-'}",
            debit_amount=commission_amount,
            credit_amount=Decimal("0.00"),
            sort_order=1,
            party_type="agent" if agent_id else "",
            party_id=str(agent_id or ""),
            source_line_id=str(agent_commission.pk),
        ),
        EntryLinePayload(
            account=payable_account,
            description=f"إثبات عمولة مستحقة للمندوب - الطلب #{order_id or '-'}",
            debit_amount=Decimal("0.00"),
            credit_amount=commission_amount,
            sort_order=2,
            party_type="agent" if agent_id else "",
            party_id=str(agent_id or ""),
            source_line_id=str(agent_commission.pk),
        ),
    ]

    return _replace_entry_lines(entry, lines, actor=actor)


# ============================================================
# 🔗 Aliases رسمية للتوافق مع services الأخرى
# ============================================================

@transaction.atomic
def post_invoice(
    invoice: Invoice,
    *,
    actor=None,
    receivable_account_code: str = ACCOUNT_CODE_ACCOUNTS_RECEIVABLE,
    revenue_account_code: str | None = None,
    output_vat_account_code: str = ACCOUNT_CODE_OUTPUT_VAT,
) -> JournalEntry:
    return post_invoice_issue(
        invoice,
        receivable_account_code=receivable_account_code,
        revenue_account_code=revenue_account_code,
        output_vat_account_code=output_vat_account_code,
        actor=actor,
    )


@transaction.atomic
def post_payment(
    payment: Payment,
    *,
    actor=None,
    receivable_account_code: str = ACCOUNT_CODE_ACCOUNTS_RECEIVABLE,
) -> JournalEntry:
    return post_payment_receipt(
        payment,
        receivable_account_code=receivable_account_code,
        actor=actor,
    )


@transaction.atomic
def post_payment_confirm(
    payment: Payment,
    *,
    actor=None,
    receivable_account_code: str = ACCOUNT_CODE_ACCOUNTS_RECEIVABLE,
) -> JournalEntry:
    return post_payment_receipt(
        payment,
        receivable_account_code=receivable_account_code,
        actor=actor,
    )


@transaction.atomic
def post_payment_confirmation(
    payment: Payment,
    *,
    actor=None,
    receivable_account_code: str = ACCOUNT_CODE_ACCOUNTS_RECEIVABLE,
) -> JournalEntry:
    return post_payment_receipt(
        payment,
        receivable_account_code=receivable_account_code,
        actor=actor,
    )


@transaction.atomic
def post_commission_accrual(
    commission: AgentCommission,
    *,
    actor=None,
    commission_expense_account_code: str = ACCOUNT_CODE_AGENT_COMMISSION_EXPENSE,
    commission_payable_account_code: str = ACCOUNT_CODE_AGENT_COMMISSION_PAYABLE,
) -> JournalEntry:
    return post_agent_commission_accrual(
        commission,
        commission_expense_account_code=commission_expense_account_code,
        commission_payable_account_code=commission_payable_account_code,
        actor=actor,
    )


@transaction.atomic
def post_agent_commission(
    commission: AgentCommission,
    *,
    actor=None,
    commission_expense_account_code: str = ACCOUNT_CODE_AGENT_COMMISSION_EXPENSE,
    commission_payable_account_code: str = ACCOUNT_CODE_AGENT_COMMISSION_PAYABLE,
) -> JournalEntry:
    return post_agent_commission_accrual(
        commission,
        commission_expense_account_code=commission_expense_account_code,
        commission_payable_account_code=commission_payable_account_code,
        actor=actor,
    )


# ============================================================
# 📊 Query Helpers للتقارير
# ============================================================

def _journal_lines_queryset(
    *,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    as_of_date: date | datetime | None = None,
    posted_only: bool = True,
    account: Account | None = None,
    cost_center: CostCenter | None = None,
):
    start_dt = _start_of_day(date_from)
    end_dt = _end_of_day(date_to)
    cutoff_dt = _end_of_day(as_of_date)

    lines_qs = JournalEntryLine.objects.select_related(
        "account",
        "journal_entry",
        "cost_center",
    )

    if posted_only:
        lines_qs = lines_qs.filter(journal_entry__status__in=POSTED_REPORT_STATUSES)

    if start_dt:
        lines_qs = lines_qs.filter(journal_entry__entry_date__gte=start_dt.date())

    if end_dt:
        lines_qs = lines_qs.filter(journal_entry__entry_date__lte=end_dt.date())

    if cutoff_dt:
        lines_qs = lines_qs.filter(journal_entry__entry_date__lte=cutoff_dt.date())

    if account:
        lines_qs = lines_qs.filter(account=account)

    if cost_center:
        lines_qs = lines_qs.filter(cost_center=cost_center)

    return lines_qs.order_by("account__code", "journal_entry__entry_date", "journal_entry__id", "id")


def _collect_account_totals(lines_qs, allowed_types: set[str] | None = None) -> dict[int, dict[str, Any]]:
    account_map: dict[int, dict[str, Any]] = {}

    for line in lines_qs:
        account = line.account
        account_type = str(_safe_getattr(account, "account_type", ""))

        if allowed_types and account_type not in allowed_types:
            continue

        account_id = account.pk

        if account_id not in account_map:
            account_map[account_id] = {
                "account_id": account.pk,
                "account_code": account.code,
                "account_name": account.name,
                "account_type": account_type,
                "is_group": bool(_safe_getattr(account, "is_group", False)),
                "total_debit": Decimal("0.00"),
                "total_credit": Decimal("0.00"),
            }

        account_map[account_id]["total_debit"] += _money(line.debit_amount)
        account_map[account_id]["total_credit"] += _money(line.credit_amount)

    return account_map


def _append_zero_accounts(
    account_map: dict[int, dict[str, Any]],
    *,
    account_types: set[str] | None = None,
) -> dict[int, dict[str, Any]]:
    qs = Account.objects.filter(is_active=True).order_by("code")

    if account_types:
        qs = qs.filter(account_type__in=account_types)

    for account in qs:
        account_map.setdefault(
            account.pk,
            {
                "account_id": account.pk,
                "account_code": account.code,
                "account_name": account.name,
                "account_type": str(_safe_getattr(account, "account_type", "")),
                "is_group": bool(_safe_getattr(account, "is_group", False)),
                "total_debit": Decimal("0.00"),
                "total_credit": Decimal("0.00"),
            },
        )

    return account_map


def _serialize_decimal_dict(data: dict[str, Any], keys: list[str]) -> dict[str, Any]:
    for key in keys:
        data[key] = str(data[key])
    return data


# ============================================================
# 🔁 Serializers
# ============================================================

def _serialize_trial_balance_row(row: TrialBalanceRow) -> dict[str, Any]:
    data = asdict(row)
    return _serialize_decimal_dict(
        data,
        ["total_debit", "total_credit", "net_debit", "net_credit"],
    )


def _serialize_trial_balance_result(result: TrialBalanceResult) -> dict[str, Any]:
    return {
        "currency": result.currency,
        "date_from": result.date_from,
        "date_to": result.date_to,
        "total_accounts": result.total_accounts,
        "total_debit": str(result.total_debit),
        "total_credit": str(result.total_credit),
        "is_balanced": result.is_balanced,
        "rows": [_serialize_trial_balance_row(row) for row in result.rows],
    }


def _serialize_ledger_line(row: LedgerLine) -> dict[str, Any]:
    data = asdict(row)
    return _serialize_decimal_dict(
        data,
        ["debit_amount", "credit_amount", "running_balance"],
    )


def _serialize_ledger_result(result: LedgerResult) -> dict[str, Any]:
    return {
        "account_id": result.account_id,
        "account_code": result.account_code,
        "account_name": result.account_name,
        "account_type": result.account_type,
        "currency": result.currency,
        "date_from": result.date_from,
        "date_to": result.date_to,
        "opening_balance": str(result.opening_balance),
        "total_debit": str(result.total_debit),
        "total_credit": str(result.total_credit),
        "closing_balance": str(result.closing_balance),
        "lines": [_serialize_ledger_line(row) for row in result.lines],
    }


def _serialize_profit_loss_row(row: ProfitLossRow) -> dict[str, Any]:
    data = asdict(row)
    data["amount"] = str(row.amount)
    return data


def _serialize_profit_loss_section(section: ProfitLossSection) -> dict[str, Any]:
    return {
        "title": section.title,
        "total_amount": str(section.total_amount),
        "rows": [_serialize_profit_loss_row(row) for row in section.rows],
    }


def _serialize_profit_loss_result(result: ProfitLossResult) -> dict[str, Any]:
    return {
        "currency": result.currency,
        "date_from": result.date_from,
        "date_to": result.date_to,
        "revenue": _serialize_profit_loss_section(result.revenue),
        "expenses": _serialize_profit_loss_section(result.expenses),
        "net_profit": str(result.net_profit),
    }


def _serialize_balance_sheet_row(row: BalanceSheetRow) -> dict[str, Any]:
    data = asdict(row)
    data["amount"] = str(row.amount)
    return data


def _serialize_balance_sheet_section(section: BalanceSheetSection) -> dict[str, Any]:
    return {
        "title": section.title,
        "total_amount": str(section.total_amount),
        "rows": [_serialize_balance_sheet_row(row) for row in section.rows],
    }


def _serialize_balance_sheet_result(result: BalanceSheetResult) -> dict[str, Any]:
    return {
        "currency": result.currency,
        "as_of_date": result.as_of_date,
        "assets": _serialize_balance_sheet_section(result.assets),
        "liabilities": _serialize_balance_sheet_section(result.liabilities),
        "equity": _serialize_balance_sheet_section(result.equity),
        "total_liabilities_and_equity": str(result.total_liabilities_and_equity),
        "is_balanced": result.is_balanced,
    }


# ============================================================
# 📊 Trial Balance
# ============================================================

def build_trial_balance(
    *,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    include_zero_accounts: bool = False,
    posted_only: bool = True,
    cost_center: CostCenter | None = None,
) -> TrialBalanceResult:
    start_dt = _start_of_day(date_from)
    end_dt = _end_of_day(date_to)

    lines_qs = _journal_lines_queryset(
        date_from=date_from,
        date_to=date_to,
        posted_only=posted_only,
        cost_center=cost_center,
    )

    account_map = _collect_account_totals(lines_qs)

    if include_zero_accounts:
        account_map = _append_zero_accounts(account_map)

    rows: list[TrialBalanceRow] = []

    for _, account_data in sorted(account_map.items(), key=lambda item: item[1]["account_code"]):
        total_debit = _money(account_data["total_debit"])
        total_credit = _money(account_data["total_credit"])
        net_value = _money(total_debit - total_credit)

        if not include_zero_accounts and total_debit == Decimal("0.00") and total_credit == Decimal("0.00"):
            continue

        rows.append(
            TrialBalanceRow(
                account_id=account_data["account_id"],
                account_code=account_data["account_code"],
                account_name=account_data["account_name"],
                account_type=account_data["account_type"],
                is_group=account_data["is_group"],
                total_debit=total_debit,
                total_credit=total_credit,
                net_debit=net_value if net_value > Decimal("0.00") else Decimal("0.00"),
                net_credit=abs(net_value) if net_value < Decimal("0.00") else Decimal("0.00"),
            )
        )

    total_debit = _money(sum((row.total_debit for row in rows), Decimal("0.00")))
    total_credit = _money(sum((row.total_credit for row in rows), Decimal("0.00")))

    return TrialBalanceResult(
        currency="SAR",
        date_from=start_dt.date().isoformat() if start_dt else None,
        date_to=end_dt.date().isoformat() if end_dt else None,
        total_accounts=len(rows),
        total_debit=total_debit,
        total_credit=total_credit,
        is_balanced=(total_debit == total_credit),
        rows=rows,
    )


def build_trial_balance_payload(
    *,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    include_zero_accounts: bool = False,
    posted_only: bool = True,
    cost_center: CostCenter | None = None,
) -> dict[str, Any]:
    result = build_trial_balance(
        date_from=date_from,
        date_to=date_to,
        include_zero_accounts=include_zero_accounts,
        posted_only=posted_only,
        cost_center=cost_center,
    )
    return _serialize_trial_balance_result(result)


# ============================================================
# 📘 General Ledger
# ============================================================

def build_general_ledger(
    *,
    account: Account,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    posted_only: bool = True,
) -> LedgerResult:
    if not account:
        raise ValidationError("الحساب مطلوب لبناء الأستاذ العام.")

    start_dt = _start_of_day(date_from)
    end_dt = _end_of_day(date_to)

    opening_lines_qs = JournalEntryLine.objects.select_related("journal_entry").filter(account=account)

    if posted_only:
        opening_lines_qs = opening_lines_qs.filter(journal_entry__status__in=POSTED_REPORT_STATUSES)

    if start_dt:
        opening_lines_qs = opening_lines_qs.filter(journal_entry__entry_date__lt=start_dt.date())
    else:
        opening_lines_qs = opening_lines_qs.none()

    opening_debit = Decimal("0.00")
    opening_credit = Decimal("0.00")

    for line in opening_lines_qs:
        opening_debit += _money(line.debit_amount)
        opening_credit += _money(line.credit_amount)

    opening_balance = _money(opening_debit - opening_credit)

    lines_qs = _journal_lines_queryset(
        date_from=date_from,
        date_to=date_to,
        posted_only=posted_only,
        account=account,
    ).order_by("journal_entry__entry_date", "journal_entry__id", "id")

    running_balance = opening_balance
    total_debit = Decimal("0.00")
    total_credit = Decimal("0.00")
    ledger_lines: list[LedgerLine] = []

    for line in lines_qs:
        debit = _money(line.debit_amount)
        credit = _money(line.credit_amount)
        running_balance = _money(running_balance + debit - credit)
        total_debit += debit
        total_credit += credit

        entry = line.journal_entry

        ledger_lines.append(
            LedgerLine(
                entry_id=entry.pk,
                entry_number=entry.entry_number,
                entry_date=entry.entry_date.isoformat(),
                posting_source=entry.posting_source,
                reference=entry.reference,
                description=line.description or entry.description,
                debit_amount=debit,
                credit_amount=credit,
                running_balance=running_balance,
            )
        )

    return LedgerResult(
        account_id=account.pk,
        account_code=account.code,
        account_name=account.name,
        account_type=account.account_type,
        currency=account.currency or "SAR",
        date_from=start_dt.date().isoformat() if start_dt else None,
        date_to=end_dt.date().isoformat() if end_dt else None,
        opening_balance=opening_balance,
        total_debit=_money(total_debit),
        total_credit=_money(total_credit),
        closing_balance=running_balance,
        lines=ledger_lines,
    )


def build_general_ledger_payload(
    *,
    account: Account,
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
    return _serialize_ledger_result(result)


# ============================================================
# 📈 Profit & Loss
# ============================================================

def build_profit_and_loss(
    *,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    posted_only: bool = True,
    include_zero_accounts: bool = False,
    cost_center: CostCenter | None = None,
) -> ProfitLossResult:
    start_dt = _start_of_day(date_from)
    end_dt = _end_of_day(date_to)

    lines_qs = _journal_lines_queryset(
        date_from=date_from,
        date_to=date_to,
        posted_only=posted_only,
        cost_center=cost_center,
    )

    account_map = _collect_account_totals(
        lines_qs,
        allowed_types={"REVENUE", "EXPENSE"},
    )

    if include_zero_accounts:
        account_map = _append_zero_accounts(
            account_map,
            account_types={"REVENUE", "EXPENSE"},
        )

    revenue_rows: list[ProfitLossRow] = []
    expense_rows: list[ProfitLossRow] = []

    for _, data in sorted(account_map.items(), key=lambda item: item[1]["account_code"]):
        account_type = data["account_type"]
        total_debit = _money(data["total_debit"])
        total_credit = _money(data["total_credit"])

        if account_type == "REVENUE":
            amount = _money(total_credit - total_debit)

            if not include_zero_accounts and amount == Decimal("0.00"):
                continue

            revenue_rows.append(
                ProfitLossRow(
                    account_id=data["account_id"],
                    account_code=data["account_code"],
                    account_name=data["account_name"],
                    account_type=account_type,
                    amount=amount,
                )
            )

        elif account_type == "EXPENSE":
            amount = _money(total_debit - total_credit)

            if not include_zero_accounts and amount == Decimal("0.00"):
                continue

            expense_rows.append(
                ProfitLossRow(
                    account_id=data["account_id"],
                    account_code=data["account_code"],
                    account_name=data["account_name"],
                    account_type=account_type,
                    amount=amount,
                )
            )

    total_revenue = _money(sum((row.amount for row in revenue_rows), Decimal("0.00")))
    total_expenses = _money(sum((row.amount for row in expense_rows), Decimal("0.00")))
    net_profit = _money(total_revenue - total_expenses)

    return ProfitLossResult(
        currency="SAR",
        date_from=start_dt.date().isoformat() if start_dt else None,
        date_to=end_dt.date().isoformat() if end_dt else None,
        revenue=ProfitLossSection(
            title="الإيرادات",
            total_amount=total_revenue,
            rows=revenue_rows,
        ),
        expenses=ProfitLossSection(
            title="المصاريف",
            total_amount=total_expenses,
            rows=expense_rows,
        ),
        net_profit=net_profit,
    )


def build_profit_and_loss_payload(
    *,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    posted_only: bool = True,
    include_zero_accounts: bool = False,
    cost_center: CostCenter | None = None,
) -> dict[str, Any]:
    result = build_profit_and_loss(
        date_from=date_from,
        date_to=date_to,
        posted_only=posted_only,
        include_zero_accounts=include_zero_accounts,
        cost_center=cost_center,
    )
    return _serialize_profit_loss_result(result)


# ============================================================
# 📘 Balance Sheet
# ============================================================

def build_balance_sheet(
    *,
    as_of_date: date | datetime | None = None,
    include_zero_accounts: bool = False,
    posted_only: bool = True,
    include_current_year_earnings: bool = True,
) -> BalanceSheetResult:
    cutoff_dt = _end_of_day(as_of_date)

    lines_qs = _journal_lines_queryset(
        as_of_date=as_of_date,
        posted_only=posted_only,
    )

    account_map = _collect_account_totals(
        lines_qs,
        allowed_types={"ASSET", "LIABILITY", "EQUITY"},
    )

    if include_zero_accounts:
        account_map = _append_zero_accounts(
            account_map,
            account_types={"ASSET", "LIABILITY", "EQUITY"},
        )

    asset_rows: list[BalanceSheetRow] = []
    liability_rows: list[BalanceSheetRow] = []
    equity_rows: list[BalanceSheetRow] = []

    for _, data in sorted(account_map.items(), key=lambda item: item[1]["account_code"]):
        account_type = data["account_type"]
        total_debit = _money(data["total_debit"])
        total_credit = _money(data["total_credit"])

        if account_type == "ASSET":
            amount = _money(total_debit - total_credit)

            if not include_zero_accounts and amount == Decimal("0.00"):
                continue

            asset_rows.append(
                BalanceSheetRow(
                    account_id=data["account_id"],
                    account_code=data["account_code"],
                    account_name=data["account_name"],
                    account_type=account_type,
                    amount=amount,
                )
            )

        elif account_type == "LIABILITY":
            amount = _money(total_credit - total_debit)

            if not include_zero_accounts and amount == Decimal("0.00"):
                continue

            liability_rows.append(
                BalanceSheetRow(
                    account_id=data["account_id"],
                    account_code=data["account_code"],
                    account_name=data["account_name"],
                    account_type=account_type,
                    amount=amount,
                )
            )

        elif account_type == "EQUITY":
            amount = _money(total_credit - total_debit)

            if not include_zero_accounts and amount == Decimal("0.00"):
                continue

            equity_rows.append(
                BalanceSheetRow(
                    account_id=data["account_id"],
                    account_code=data["account_code"],
                    account_name=data["account_name"],
                    account_type=account_type,
                    amount=amount,
                )
            )

    if include_current_year_earnings:
        pnl = build_profit_and_loss(
            date_from=None,
            date_to=as_of_date,
            posted_only=posted_only,
            include_zero_accounts=False,
        )
        current_earnings_amount = _money(pnl.net_profit)

        if include_zero_accounts or current_earnings_amount != Decimal("0.00"):
            equity_rows.append(
                BalanceSheetRow(
                    account_id=0,
                    account_code="CURRENT_EARNINGS",
                    account_name="صافي الربح الحالي",
                    account_type="EQUITY",
                    amount=current_earnings_amount,
                )
            )

    total_assets = _money(sum((row.amount for row in asset_rows), Decimal("0.00")))
    total_liabilities = _money(sum((row.amount for row in liability_rows), Decimal("0.00")))
    total_equity = _money(sum((row.amount for row in equity_rows), Decimal("0.00")))
    total_liabilities_and_equity = _money(total_liabilities + total_equity)

    return BalanceSheetResult(
        currency="SAR",
        as_of_date=cutoff_dt.date().isoformat() if cutoff_dt else None,
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