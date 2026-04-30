# ============================================================
# 📂 accounting/services.py
# 🧠 Primey Care | Accounting Posting & Reporting Services
# ------------------------------------------------------------
# ✅ خدمات الترحيل المحاسبي الرسمية
# ✅ مبنية على شجرة الحسابات المعتمدة
# ✅ تغطي:
#    - ترحيل إصدار الفاتورة
#    - ترحيل تحصيل الدفعة
#    - ترحيل استحقاق عمولة المندوب
#    - إنشاء قيود يدوية
#    - ميزان المراجعة
#    - قائمة الدخل
#    - الميزانية العمومية
# ------------------------------------------------------------
# ملاحظات مهمة:
# - Idempotent: لا يكرر القيود لنفس المصدر.
# - لا يرحّل على حساب تجميعي أو غير نشط.
# - لا ينشئ قيد مرحل قبل إنشاء أسطره.
# - يمنع استبدال أسطر قيد مرحل قائم حتى لا تتغير الدفاتر بصمت.
# - التقارير تعتمد افتراضيًا على القيود المرحلة فقط.
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
    JournalEntry,
    JournalEntryLine,
    JournalEntryStatus,
    PostingSource,
)
from agents.models import AgentCommission
from invoices.models import Invoice, InvoiceStatus
from payments.models import Payment, PaymentStatus


# ============================================================
# 🧩 شجرة الحسابات المعتمدة — مرجع رسمي داخل النظام
# ============================================================

SAUDI_COA = {
    "1": "الأصول",
    "11": "أصول متداولة",
    "1101": "النقد ومايعادله",
    "110101": "النقدية في الخزينة",
    "110102": "العهد النقدية",
    "1102": "النقدية في البنك",
    "110201": "حساب البنك الجاري - اسم البنك",
    "110202": "بنك تجريبي",
    "1103": "المدينون",
    "1104": "مصروفات مقدمة",
    "110401": "تأمين طبي مقدم",
    "110402": "إيجار مقدم",
    "1105": "مدفوعات مقدمة للموظفين",
    "1106": "المخزون",
    "12": "أصول غير متداولة",
    "1201": "عقارات وآلات ومعدات",
    "120101": "الأراضي",
    "120102": "المباني",
    "120103": "المعدات",
    "120104": "أجهزة مكتبية وطابعات",
    "1202": "الأصول غير الملموسة",
    "1203": "العقارات الاستثمارية",
    "2": "الالتزامات",
    "21": "الالتزامات المتداولة",
    "2101": "الدائنون",
    "2102": "مصروفات مستحقة",
    "2103": "الرواتب المستحقة",
    "2104": "قروض قصيرة الأجل",
    "2105": "ضريبة القيمة المضافة المستحقة",
    "2106": "الضرائب المستحقة",
    "2107": "إيرادات غير مكتسبة",
    "2108": "مستحقات المؤسسة العامة للتأمينات الاجتماعية",
    "2109": "مجمع الاستهلاك",
    "210901": "مجمع استهلاك المباني",
    "210902": "مجمع استهلاك المعدات",
    "210903": "مجمع استهلاك أجهزة مكتبية وطابعات",
    "22": "التزامات غير متداولة",
    "2201": "قروض طويلة أجل",
    "2202": "مخصص مكافأة نهاية الخدمة",
    "3": "حقوق الملكية",
    "31": "رأس المال",
    "3101": "رأس المال المسجل",
    "3102": "رأس المال الإضافي المدفوع",
    "32": "حقوق ملكية أخرى",
    "3201": "أرصدة افتتاحية",
    "33": "احتياطيات",
    "3301": "احتياطي نظامي",
    "3302": "احتياطي ترجمة عملات أجنبية",
    "34": "الأرباح المبقاة (أو الخسائر)",
    "3401": "الأرباح والخسائر العاملة",
    "3402": "الأرباح المبقاة (أو الخسائر)",
    "4": "الإيرادات",
    "41": "الإيرادات التشغيلية",
    "4101": "إيرادات المبيعات/ الخدمات",
    "42": "الإيرادات غير التشغيلية",
    "4201": "إيرادات أخرى",
    "5": "المصاريف",
    "51": "التكاليف المباشرة",
    "5101": "تكلفة البضاعة المباعة",
    "5102": "رواتب وأجور",
    "5103": "عمولات البيع",
    "5104": "شحن وتخليص جمركي",
    "52": "التكاليف التشغيلية",
    "5201": "الرواتب والرسوم الإدارية",
    "5202": "تأمين طبي",
    "5203": "مصاريف تسويقية ودعائية",
    "5204": "مصاريف الإيجار",
    "5205": "عمولات وحوافز",
    "5206": "تذاكر سفر",
    "5207": "التأمينات الاجتماعية",
    "5208": "الرسوم الحكومية",
    "5209": "رسوم واشتراكات",
    "5210": "مصاريف خدمات المكتب",
    "5211": "مصاريف مكتبية ومطبوعات",
    "5212": "مصاريف ضيافة",
    "5213": "عمولات بنكية",
    "5214": "مصاريف أخرى",
    "5215": "مصاريف الإهلاك",
    "521501": "مصروف إهلاك المباني",
    "521502": "مصروف إهلاك المعدات",
    "521503": "مصروف إهلاك أجهزة مكتبية وطابعات",
    "5219": "مصروف نقل ومواصلات",
    "53": "مصاريف غير التشغيلية",
    "5301": "الزكاة",
    "5302": "الضرائب",
    "5303": "ترجمة عملات أجنبية",
    "5304": "فوائد",
}


# ============================================================
# 🧩 أكواد الحسابات التشغيلية المعتمدة داخل Primey Care
# ============================================================

ACCOUNT_CODE_ACCOUNTS_RECEIVABLE = "1103"
ACCOUNT_CODE_CASH_ON_HAND = "110101"
ACCOUNT_CODE_BANK = "110201"
ACCOUNT_CODE_REVENUE = "4101"
ACCOUNT_CODE_OUTPUT_VAT = "2105"
ACCOUNT_CODE_AGENT_COMMISSION_EXPENSE = "5103"
ACCOUNT_CODE_AGENT_COMMISSION_PAYABLE = "2102"


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
    """
    يرجع قيمة TextChoices أو Enum أو string بشكل موحد.
    """
    raw = getattr(value, "value", value)
    return str(raw or "").strip().upper()


def _get_posting_source_value(source_name: str, fallback: str = PostingSource.OTHER) -> str:
    """
    يحافظ على التوافق إذا كان PostingSource في migration قديم لا يحتوي بعض القيم.
    """
    return getattr(PostingSource, source_name, fallback)


def _build_entry_number(prefix: str, object_id: int | str | None) -> str:
    if object_id in [None, ""]:
        raise ValidationError("لا يمكن بناء رقم قيد بدون معرف.")
    return f"{prefix}-{object_id}"


def _get_required_account(account_code: str) -> Account:
    code = str(account_code or "").strip()

    if not code:
        raise ValidationError("كود الحساب المحاسبي مطلوب.")

    try:
        account = Account.objects.get(code=code)
    except Account.DoesNotExist as exc:
        account_name = SAUDI_COA.get(code, "غير معروف")
        raise ValidationError(
            f"الحساب المحاسبي المطلوب غير موجود. "
            f"الكود المطلوب: {code} - {account_name}"
        ) from exc

    if not account.is_active:
        raise ValidationError(
            f"الحساب المحاسبي بالكود {code} ({account.name}) غير نشط."
        )

    if account.is_group:
        raise ValidationError(
            f"الحساب المحاسبي بالكود {code} ({account.name}) حساب تجميعي "
            f"ولا يمكن الترحيل عليه."
        )

    return account


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
) -> JournalEntry:
    """
    ينشئ رأس القيد كمسودة أولًا.
    لا ننشئه POSTED قبل الأسطر حتى لا يفشل validation في models.py.
    """
    if not entry_number:
        raise ValidationError("رقم القيد مطلوب.")

    if not entry_date:
        entry_date = timezone.localdate()

    entry, created = JournalEntry.objects.get_or_create(
        entry_number=entry_number,
        defaults={
            "entry_date": entry_date,
            "status": JournalEntryStatus.DRAFT,
            "posting_source": posting_source,
            "reference": reference,
            "external_reference": external_reference or "",
            "description": description or "",
            "notes": notes or "",
            "currency": (currency or "SAR").upper(),
        },
    )

    if not created:
        if entry.status == JournalEntryStatus.CANCELLED:
            raise ValidationError(
                f"القيد {entry.entry_number} موجود لكنه ملغي ولا يمكن إعادة استخدامه."
            )

        if reference and entry.reference and entry.reference != reference:
            raise ValidationError(
                f"رقم القيد {entry.entry_number} مستخدم مسبقًا بمرجع مختلف."
            )

        if entry.status == JournalEntryStatus.POSTED and entry.lines.exists():
            return entry

        entry.entry_date = entry_date
        entry.posting_source = posting_source
        entry.reference = reference
        entry.external_reference = external_reference or entry.external_reference or ""
        entry.description = description or entry.description or ""
        entry.notes = notes or entry.notes or ""
        entry.currency = (currency or entry.currency or "SAR").upper()
        entry.save(
            update_fields=[
                "entry_date",
                "posting_source",
                "reference",
                "external_reference",
                "description",
                "notes",
                "currency",
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
) -> JournalEntry:
    """
    يستبدل أسطر القيد إذا كان القيد مسودة فقط.
    إذا كان القيد مرحلًا وموجودًا مسبقًا يرجعه كما هو لضمان idempotency.
    """
    if not entry:
        raise ValidationError("القيد مطلوب.")

    if entry.status == JournalEntryStatus.CANCELLED:
        raise ValidationError("لا يمكن تعديل قيد ملغي.")

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
            description=item.description or "",
            debit_amount=_money(item.debit_amount),
            credit_amount=_money(item.credit_amount),
            sort_order=item.sort_order,
        )

    entry._sync_totals_from_lines()

    if not entry.is_balanced:
        raise ValidationError("القيد الناتج غير متوازن محاسبيًا.")

    if hasattr(entry, "mark_as_posted"):
        entry.mark_as_posted()
    else:
        entry.status = JournalEntryStatus.POSTED
        entry.posted_at = entry.posted_at or timezone.now()
        entry.save(
            update_fields=[
                "status",
                "posted_at",
                "total_debit",
                "total_credit",
                "updated_at",
            ]
        )

    return entry


def _resolve_payment_treasury_account(payment: Payment) -> Account:
    """
    يحدد حساب الخزينة أو البنك حسب وسيلة الدفع.
    """
    method = _choice_value(_safe_getattr(payment, "payment_method", ""))

    bank_methods = {
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
        "TAMARA",
        "TABBY",
        "TAP",
        "GATEWAY",
        "ONLINE",
    }

    if method in bank_methods:
        return _get_required_account(ACCOUNT_CODE_BANK)

    return _get_required_account(ACCOUNT_CODE_CASH_ON_HAND)


def _serialize_decimal_dict(data: dict[str, Any], keys: list[str]) -> dict[str, Any]:
    for key in keys:
        data[key] = str(data[key])
    return data


# ============================================================
# 🔁 Serializers — Trial Balance
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


# ============================================================
# 🔁 Serializers — Profit & Loss
# ============================================================

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


# ============================================================
# 🔁 Serializers — Balance Sheet
# ============================================================

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
    )

    return _replace_entry_lines(entry, prepared_lines)


# ============================================================
# 🧾 ترحيل إصدار الفاتورة
# ============================================================

@transaction.atomic
def post_invoice_issue(
    invoice: Invoice,
    *,
    receivable_account_code: str = ACCOUNT_CODE_ACCOUNTS_RECEIVABLE,
    revenue_account_code: str = ACCOUNT_CODE_REVENUE,
    output_vat_account_code: str = ACCOUNT_CODE_OUTPUT_VAT,
) -> JournalEntry:
    if not invoice:
        raise ValidationError("الفاتورة مطلوبة.")

    if invoice.status == InvoiceStatus.CANCELLED:
        raise ValidationError("لا يمكن ترحيل فاتورة ملغاة.")

    if not invoice.pk:
        raise ValidationError("لا يمكن ترحيل فاتورة غير محفوظة.")

    receivable_account = _get_required_account(receivable_account_code)
    revenue_account = _get_required_account(revenue_account_code)
    output_vat_account = _get_required_account(output_vat_account_code)

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

    entry = _get_or_create_entry_header(
        entry_number=_build_entry_number("INV", invoice.pk),
        entry_date=issue_date,
        posting_source=PostingSource.INVOICE,
        reference=f"INVOICE:{invoice.pk}:ISSUE",
        external_reference=invoice_number,
        description=f"ترحيل إصدار فاتورة رقم {invoice_number}",
        notes=f"Order #{order_id}" if order_id else "",
        currency=currency,
    )

    lines: List[EntryLinePayload] = [
        EntryLinePayload(
            account=receivable_account,
            description=f"إثبات مديونية العميل - فاتورة {invoice_number}",
            debit_amount=total_amount,
            credit_amount=Decimal("0.00"),
            sort_order=1,
        ),
        EntryLinePayload(
            account=revenue_account,
            description=f"إثبات إيراد الفاتورة {invoice_number}",
            debit_amount=Decimal("0.00"),
            credit_amount=taxable_amount,
            sort_order=2,
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
            )
        )

    return _replace_entry_lines(entry, lines)


# ============================================================
# 💳 ترحيل تحصيل دفعة
# ============================================================

@transaction.atomic
def post_payment_receipt(
    payment: Payment,
    *,
    receivable_account_code: str = ACCOUNT_CODE_ACCOUNTS_RECEIVABLE,
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
    receivable_account = _get_required_account(receivable_account_code)

    payment_number = _safe_getattr(payment, "payment_number", "") or f"PAY-{payment.pk}"
    paid_at = _safe_getattr(payment, "paid_at", None)
    order_id = _safe_getattr(payment, "order_id", None)
    currency = _safe_getattr(payment, "currency", "SAR") or "SAR"

    entry = _get_or_create_entry_header(
        entry_number=_build_entry_number("PAY", payment.pk),
        entry_date=(paid_at.date() if paid_at else timezone.localdate()),
        posting_source=PostingSource.PAYMENT,
        reference=f"PAYMENT:{payment.pk}:RECEIPT",
        external_reference=payment_number,
        description=f"ترحيل تحصيل دفعة رقم {payment_number}",
        notes=f"Order #{order_id}" if order_id else "",
        currency=currency,
    )

    lines: List[EntryLinePayload] = [
        EntryLinePayload(
            account=treasury_account,
            description=f"إثبات التحصيل - دفعة {payment_number}",
            debit_amount=paid_amount,
            credit_amount=Decimal("0.00"),
            sort_order=1,
        ),
        EntryLinePayload(
            account=receivable_account,
            description=f"تسوية ذمم العميل - دفعة {payment_number}",
            debit_amount=Decimal("0.00"),
            credit_amount=paid_amount,
            sort_order=2,
        ),
    ]

    return _replace_entry_lines(entry, lines)


# ============================================================
# 💸 ترحيل استحقاق عمولة مندوب
# ============================================================

@transaction.atomic
def post_agent_commission_accrual(
    agent_commission: AgentCommission,
    *,
    commission_expense_account_code: str = ACCOUNT_CODE_AGENT_COMMISSION_EXPENSE,
    commission_payable_account_code: str = ACCOUNT_CODE_AGENT_COMMISSION_PAYABLE,
) -> JournalEntry:
    if not agent_commission:
        raise ValidationError("سجل العمولة مطلوب.")

    if not agent_commission.pk:
        raise ValidationError("لا يمكن ترحيل عمولة غير محفوظة.")

    commission_amount = _money(_safe_getattr(agent_commission, "commission_amount", None))

    if commission_amount <= Decimal("0.00"):
        raise ValidationError("قيمة العمولة يجب أن تكون أكبر من صفر.")

    expense_account = _get_required_account(commission_expense_account_code)
    payable_account = _get_required_account(commission_payable_account_code)

    earned_at = _safe_getattr(agent_commission, "earned_at", None)
    order_id = _safe_getattr(agent_commission, "order_id", None)
    agent_id = _safe_getattr(agent_commission, "agent_id", None)

    posting_source = _get_posting_source_value(
        "AGENT_COMMISSION",
        fallback=PostingSource.OTHER,
    )

    entry = _get_or_create_entry_header(
        entry_number=_build_entry_number("COM", agent_commission.pk),
        entry_date=(earned_at.date() if earned_at else timezone.localdate()),
        posting_source=posting_source,
        reference=f"AGENT_COMMISSION:{agent_commission.pk}:ACCRUAL",
        external_reference=str(order_id or ""),
        description=f"ترحيل استحقاق عمولة مندوب للطلب #{order_id or '-'}",
        notes=f"Agent #{agent_id}" if agent_id else "",
        currency="SAR",
    )

    lines: List[EntryLinePayload] = [
        EntryLinePayload(
            account=expense_account,
            description=f"مصروف عمولة مندوب - الطلب #{order_id or '-'}",
            debit_amount=commission_amount,
            credit_amount=Decimal("0.00"),
            sort_order=1,
        ),
        EntryLinePayload(
            account=payable_account,
            description=f"إثبات عمولة مستحقة للمندوب - الطلب #{order_id or '-'}",
            debit_amount=Decimal("0.00"),
            credit_amount=commission_amount,
            sort_order=2,
        ),
    ]

    return _replace_entry_lines(entry, lines)


# ============================================================
# 🔗 Aliases رسمية للتوافق مع services الأخرى
# ============================================================

@transaction.atomic
def post_invoice(
    invoice: Invoice,
    *,
    actor=None,
    receivable_account_code: str = ACCOUNT_CODE_ACCOUNTS_RECEIVABLE,
    revenue_account_code: str = ACCOUNT_CODE_REVENUE,
    output_vat_account_code: str = ACCOUNT_CODE_OUTPUT_VAT,
) -> JournalEntry:
    return post_invoice_issue(
        invoice,
        receivable_account_code=receivable_account_code,
        revenue_account_code=revenue_account_code,
        output_vat_account_code=output_vat_account_code,
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
):
    start_dt = _start_of_day(date_from)
    end_dt = _end_of_day(date_to)
    cutoff_dt = _end_of_day(as_of_date)

    lines_qs = JournalEntryLine.objects.select_related(
        "account",
        "journal_entry",
    )

    if posted_only:
        lines_qs = lines_qs.filter(journal_entry__status=JournalEntryStatus.POSTED)

    if start_dt:
        lines_qs = lines_qs.filter(journal_entry__entry_date__gte=start_dt.date())

    if end_dt:
        lines_qs = lines_qs.filter(journal_entry__entry_date__lte=end_dt.date())

    if cutoff_dt:
        lines_qs = lines_qs.filter(journal_entry__entry_date__lte=cutoff_dt.date())

    return lines_qs.order_by("account__code", "id")


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


# ============================================================
# 📊 Trial Balance V1
# ============================================================

def build_trial_balance(
    *,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    include_zero_accounts: bool = False,
    posted_only: bool = True,
) -> TrialBalanceResult:
    """
    بناء ميزان المراجعة.

    المنطق:
    - يعتمد على JournalEntryLine.
    - يجمع المدين والدائن لكل حساب.
    - يحسب صافي مدين أو صافي دائن.
    - افتراضيًا يعتمد على القيود المرحلة فقط.
    """
    start_dt = _start_of_day(date_from)
    end_dt = _end_of_day(date_to)

    lines_qs = _journal_lines_queryset(
        date_from=date_from,
        date_to=date_to,
        posted_only=posted_only,
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
) -> dict[str, Any]:
    result = build_trial_balance(
        date_from=date_from,
        date_to=date_to,
        include_zero_accounts=include_zero_accounts,
        posted_only=posted_only,
    )
    return _serialize_trial_balance_result(result)


# ============================================================
# 📈 Profit & Loss V1
# ============================================================

def build_profit_and_loss(
    *,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    posted_only: bool = True,
    include_zero_accounts: bool = False,
) -> ProfitLossResult:
    """
    بناء تقرير الأرباح والخسائر.

    المنطق:
    - الإيرادات = صافي الدائن - المدين لحسابات REVENUE.
    - المصاريف = صافي المدين - الدائن لحسابات EXPENSE.
    - صافي الربح = إجمالي الإيرادات - إجمالي المصاريف.
    """
    start_dt = _start_of_day(date_from)
    end_dt = _end_of_day(date_to)

    lines_qs = _journal_lines_queryset(
        date_from=date_from,
        date_to=date_to,
        posted_only=posted_only,
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
) -> dict[str, Any]:
    result = build_profit_and_loss(
        date_from=date_from,
        date_to=date_to,
        posted_only=posted_only,
        include_zero_accounts=include_zero_accounts,
    )
    return _serialize_profit_loss_result(result)


# ============================================================
# 📘 Balance Sheet V1
# ============================================================

def build_balance_sheet(
    *,
    as_of_date: date | datetime | None = None,
    include_zero_accounts: bool = False,
    posted_only: bool = True,
    include_current_year_earnings: bool = True,
) -> BalanceSheetResult:
    """
    بناء المركز المالي.

    المنطق:
    - الأصول = صافي المدين - الدائن لحسابات ASSET.
    - الالتزامات = صافي الدائن - المدين لحسابات LIABILITY.
    - حقوق الملكية = صافي الدائن - المدين لحسابات EQUITY.
    - يمكن إضافة صافي الربح الحالي ضمن حقوق الملكية.
    """
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