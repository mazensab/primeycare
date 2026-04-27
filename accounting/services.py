# ============================================================
# 📂 accounting/services.py
# 🧠 Primey Care | Accounting Posting & Reporting Services
# ------------------------------------------------------------
# ✅ خدمات الترحيل المحاسبي الرسمية
# ✅ مبنية الآن على شجرة الحسابات المعتمدة المرسلة من المستخدم
# ✅ تغطي:
#    - ترحيل إصدار الفاتورة
#    - ترحيل تحصيل الدفعة
#    - ترحيل استحقاق عمولة المندوب
# ✅ Idempotent:
#    - تمنع تكرار إنشاء نفس القيد عند إعادة الاستدعاء
# ✅ متوافقة مع طبقات الخدمات الأخرى عبر aliases رسمية
# ✅ Trial Balance V1
# ✅ Profit & Loss V1
# ✅ Balance Sheet V1
# ------------------------------------------------------------
# ملاحظات مهمة:
# - تم استبدال الأكواد الافتراضية السابقة بالأكواد الفعلية
#   من شجرة الحسابات المعتمدة
# - هذه الطبقة لا تقوم بزرع الشجرة تلقائيًا
# - عند غياب الحساب المطلوب سترجع ValidationError واضحة
# - ميزان المراجعة يعتمد على القيود المرحلة فقط افتراضيًا
# - الأرباح والخسائر تعتمد على حسابات الإيرادات والمصاريف
# - المركز المالي يعتمد على:
#   ASSET / LIABILITY / EQUITY
#   مع إضافة صافي الربح الحالي إلى حقوق الملكية
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

@dataclass
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
# 🛠️ Helpers
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


def _get_required_account(account_code: str) -> Account:
    try:
        account = Account.objects.get(code=account_code, is_active=True)
    except Account.DoesNotExist as exc:
        account_name = SAUDI_COA.get(account_code, "غير معروف")
        raise ValidationError(
            f"الحساب المحاسبي المطلوب غير موجود أو غير نشط. "
            f"الكود المطلوب: {account_code} - {account_name}"
        ) from exc

    if account.is_group:
        raise ValidationError(
            f"الحساب المحاسبي بالكود {account_code} ({account.name}) حساب تجميعي "
            f"ولا يمكن الترحيل عليه."
        )

    return account


def _build_entry_number(prefix: str, object_id: int) -> str:
    return f"{prefix}-{object_id}"


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
    entry, _ = JournalEntry.objects.get_or_create(
        entry_number=entry_number,
        defaults={
            "entry_date": entry_date,
            "status": JournalEntryStatus.POSTED,
            "posting_source": posting_source,
            "reference": reference,
            "external_reference": external_reference,
            "description": description,
            "notes": notes,
            "currency": currency or "SAR",
            "posted_at": timezone.now(),
        },
    )
    return entry


def _replace_entry_lines(
    entry: JournalEntry,
    lines: Iterable[EntryLinePayload],
) -> JournalEntry:
    entry.lines.all().delete()

    for item in lines:
        JournalEntryLine.objects.create(
            journal_entry=entry,
            account=item.account,
            description=item.description,
            debit_amount=_money(item.debit_amount),
            credit_amount=_money(item.credit_amount),
            sort_order=item.sort_order,
        )

    entry.status = JournalEntryStatus.POSTED
    entry.posted_at = entry.posted_at or timezone.now()
    entry._sync_totals_from_lines()
    entry.save(
        update_fields=[
            "status",
            "posted_at",
            "total_debit",
            "total_credit",
            "updated_at",
        ]
    )

    if not entry.is_balanced:
        raise ValidationError("القيد الناتج غير متوازن محاسبيًا.")

    return entry


def _resolve_payment_treasury_account(payment: Payment) -> Account:
    if payment.payment_method in {
        "BANK_TRANSFER",
        "CREDIT_CARD",
        "DEBIT_CARD",
        "APPLE_PAY",
        "STC_PAY",
        "TAMARA",
        "TABBY",
    }:
        return _get_required_account(ACCOUNT_CODE_BANK)

    return _get_required_account(ACCOUNT_CODE_CASH_ON_HAND)


def _serialize_trial_balance_row(row: TrialBalanceRow) -> dict[str, Any]:
    data = asdict(row)
    for key in ["total_debit", "total_credit", "net_debit", "net_credit"]:
        data[key] = str(data[key])
    return data


def _serialize_trial_balance_result(result: TrialBalanceResult) -> dict[str, Any]:
    return {
        "currency": result.currency,
        "date_from": result.date_from,
        "date_to": result.date_to,
        "total_accounts": result.total_accounts,
        "total_debit": str(result.total_debit),
        "total_credit": str(result.total_credit),
        "rows": [_serialize_trial_balance_row(row) for row in result.rows],
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
    if not lines:
        raise ValidationError("لا يمكن إنشاء قيد بدون أسطر.")

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
    return _replace_entry_lines(entry, lines)


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

    receivable_account = _get_required_account(receivable_account_code)
    revenue_account = _get_required_account(revenue_account_code)
    output_vat_account = _get_required_account(output_vat_account_code)

    taxable_amount = _money(invoice.taxable_amount)
    tax_amount = _money(invoice.tax_amount)
    total_amount = _money(invoice.total_amount)

    if total_amount <= Decimal("0.00"):
        raise ValidationError("لا يمكن ترحيل فاتورة بإجمالي صفري أو سالب.")

    entry = _get_or_create_entry_header(
        entry_number=_build_entry_number("INV", invoice.id),
        entry_date=invoice.issue_date or timezone.localdate(),
        posting_source=PostingSource.INVOICE,
        reference=f"INVOICE:{invoice.id}:ISSUE",
        external_reference=invoice.invoice_number,
        description=f"ترحيل إصدار فاتورة رقم {invoice.invoice_number}",
        notes=f"Order #{invoice.order_id}",
        currency=invoice.currency or "SAR",
    )

    lines: List[EntryLinePayload] = [
        EntryLinePayload(
            account=receivable_account,
            description=f"إثبات مديونية العميل - فاتورة {invoice.invoice_number}",
            debit_amount=total_amount,
            credit_amount=Decimal("0.00"),
            sort_order=1,
        ),
        EntryLinePayload(
            account=revenue_account,
            description=f"إثبات إيراد الفاتورة {invoice.invoice_number}",
            debit_amount=Decimal("0.00"),
            credit_amount=taxable_amount,
            sort_order=2,
        ),
    ]

    if tax_amount > Decimal("0.00"):
        lines.append(
            EntryLinePayload(
                account=output_vat_account,
                description=f"إثبات ضريبة القيمة المضافة - فاتورة {invoice.invoice_number}",
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

    if payment.status not in {
        PaymentStatus.PAID,
        PaymentStatus.PARTIALLY_PAID,
        PaymentStatus.REFUNDED,
        PaymentStatus.PARTIALLY_REFUNDED,
    }:
        raise ValidationError("لا يمكن ترحيل دفعة غير محصلة فعليًا.")

    paid_amount = _money(payment.paid_amount)
    if paid_amount <= Decimal("0.00"):
        raise ValidationError("المبلغ المدفوع يجب أن يكون أكبر من صفر.")

    treasury_account = _resolve_payment_treasury_account(payment)
    receivable_account = _get_required_account(receivable_account_code)

    payment_number = payment.payment_number or f"PAY-{payment.id}"

    entry = _get_or_create_entry_header(
        entry_number=_build_entry_number("PAY", payment.id),
        entry_date=(payment.paid_at.date() if payment.paid_at else timezone.localdate()),
        posting_source=PostingSource.PAYMENT,
        reference=f"PAYMENT:{payment.id}:RECEIPT",
        external_reference=payment_number,
        description=f"ترحيل تحصيل دفعة رقم {payment_number}",
        notes=f"Order #{payment.order_id}",
        currency=payment.currency or "SAR",
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

    commission_amount = _money(agent_commission.commission_amount)
    if commission_amount <= Decimal("0.00"):
        raise ValidationError("قيمة العمولة يجب أن تكون أكبر من صفر.")

    expense_account = _get_required_account(commission_expense_account_code)
    payable_account = _get_required_account(commission_payable_account_code)

    entry = _get_or_create_entry_header(
        entry_number=_build_entry_number("COM", agent_commission.id),
        entry_date=(
            agent_commission.earned_at.date()
            if agent_commission.earned_at
            else timezone.localdate()
        ),
        posting_source=PostingSource.OTHER,
        reference=f"AGENT_COMMISSION:{agent_commission.id}:ACCRUAL",
        external_reference=str(agent_commission.order_id),
        description=f"ترحيل استحقاق عمولة مندوب للطلب #{agent_commission.order_id}",
        notes=f"Agent #{agent_commission.agent_id}",
        currency="SAR",
    )

    lines: List[EntryLinePayload] = [
        EntryLinePayload(
            account=expense_account,
            description=f"مصروف عمولة مندوب - الطلب #{agent_commission.order_id}",
            debit_amount=commission_amount,
            credit_amount=Decimal("0.00"),
            sort_order=1,
        ),
        EntryLinePayload(
            account=payable_account,
            description=f"إثبات عمولة مستحقة للمندوب - الطلب #{agent_commission.order_id}",
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
    - يعتمد على JournalEntryLine
    - يجمع المدين والدائن لكل حساب
    - يحسب صافي مدين أو صافي دائن
    - افتراضيًا يعتمد على القيود المرحلة فقط
    """
    start_dt = _start_of_day(date_from)
    end_dt = _end_of_day(date_to)

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

    account_map: dict[int, dict[str, Any]] = {}

    for line in lines_qs.order_by("account__code", "id"):
        account = line.account
        account_id = account.pk

        if account_id not in account_map:
            account_map[account_id] = {
                "account_id": account.pk,
                "account_code": account.code,
                "account_name": account.name,
                "account_type": str(_safe_getattr(account, "account_type", "")),
                "is_group": bool(_safe_getattr(account, "is_group", False)),
                "total_debit": Decimal("0.00"),
                "total_credit": Decimal("0.00"),
            }

        account_map[account_id]["total_debit"] += _money(line.debit_amount)
        account_map[account_id]["total_credit"] += _money(line.credit_amount)

    rows: list[TrialBalanceRow] = []

    if include_zero_accounts:
        accounts_qs = Account.objects.filter(is_active=True).order_by("code")
        for account in accounts_qs:
            account_data = account_map.get(
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

            total_debit = _money(account_data["total_debit"])
            total_credit = _money(account_data["total_credit"])
            net_value = _money(total_debit - total_credit)

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
    else:
        for _, account_data in sorted(account_map.items(), key=lambda item: item[1]["account_code"]):
            total_debit = _money(account_data["total_debit"])
            total_credit = _money(account_data["total_credit"])
            net_value = _money(total_debit - total_credit)

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
    - الإيرادات = صافي الدائن - المدين لحسابات REVENUE
    - المصاريف = صافي المدين - الدائن لحسابات EXPENSE
    - صافي الربح = إجمالي الإيرادات - إجمالي المصاريف
    """
    start_dt = _start_of_day(date_from)
    end_dt = _end_of_day(date_to)

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

    revenue_map: dict[int, dict[str, Any]] = {}
    expense_map: dict[int, dict[str, Any]] = {}

    for line in lines_qs.order_by("account__code", "id"):
        account = line.account
        account_type = str(_safe_getattr(account, "account_type", ""))

        if account_type not in {"REVENUE", "EXPENSE"}:
            continue

        target_map = revenue_map if account_type == "REVENUE" else expense_map

        if account.pk not in target_map:
            target_map[account.pk] = {
                "account_id": account.pk,
                "account_code": account.code,
                "account_name": account.name,
                "account_type": account_type,
                "total_debit": Decimal("0.00"),
                "total_credit": Decimal("0.00"),
            }

        target_map[account.pk]["total_debit"] += _money(line.debit_amount)
        target_map[account.pk]["total_credit"] += _money(line.credit_amount)

    if include_zero_accounts:
        income_accounts = Account.objects.filter(
            is_active=True,
            is_group=False,
            account_type="REVENUE",
        ).order_by("code")

        expense_accounts = Account.objects.filter(
            is_active=True,
            is_group=False,
            account_type="EXPENSE",
        ).order_by("code")

        for account in income_accounts:
            revenue_map.setdefault(
                account.pk,
                {
                    "account_id": account.pk,
                    "account_code": account.code,
                    "account_name": account.name,
                    "account_type": "REVENUE",
                    "total_debit": Decimal("0.00"),
                    "total_credit": Decimal("0.00"),
                },
            )

        for account in expense_accounts:
            expense_map.setdefault(
                account.pk,
                {
                    "account_id": account.pk,
                    "account_code": account.code,
                    "account_name": account.name,
                    "account_type": "EXPENSE",
                    "total_debit": Decimal("0.00"),
                    "total_credit": Decimal("0.00"),
                },
            )

    revenue_rows: list[ProfitLossRow] = []
    expense_rows: list[ProfitLossRow] = []

    for _, data in sorted(revenue_map.items(), key=lambda item: item[1]["account_code"]):
        amount = _money(data["total_credit"] - data["total_debit"])
        if not include_zero_accounts and amount == Decimal("0.00"):
            continue

        revenue_rows.append(
            ProfitLossRow(
                account_id=data["account_id"],
                account_code=data["account_code"],
                account_name=data["account_name"],
                account_type=data["account_type"],
                amount=amount if amount > Decimal("0.00") else Decimal("0.00"),
            )
        )

    for _, data in sorted(expense_map.items(), key=lambda item: item[1]["account_code"]):
        amount = _money(data["total_debit"] - data["total_credit"])
        if not include_zero_accounts and amount == Decimal("0.00"):
            continue

        expense_rows.append(
            ProfitLossRow(
                account_id=data["account_id"],
                account_code=data["account_code"],
                account_name=data["account_name"],
                account_type=data["account_type"],
                amount=amount if amount > Decimal("0.00") else Decimal("0.00"),
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
    - الأصول = صافي المدين - الدائن لحسابات ASSET
    - الالتزامات = صافي الدائن - المدين لحسابات LIABILITY
    - حقوق الملكية = صافي الدائن - المدين لحسابات EQUITY
    - يمكن إضافة صافي الربح الحالي ضمن حقوق الملكية
    """
    cutoff_dt = _end_of_day(as_of_date)

    lines_qs = JournalEntryLine.objects.select_related(
        "account",
        "journal_entry",
    )

    if posted_only:
        lines_qs = lines_qs.filter(journal_entry__status=JournalEntryStatus.POSTED)

    if cutoff_dt:
        lines_qs = lines_qs.filter(journal_entry__entry_date__lte=cutoff_dt.date())

    asset_map: dict[int, dict[str, Any]] = {}
    liability_map: dict[int, dict[str, Any]] = {}
    equity_map: dict[int, dict[str, Any]] = {}

    for line in lines_qs.order_by("account__code", "id"):
        account = line.account
        account_type = str(_safe_getattr(account, "account_type", ""))

        if account_type not in {"ASSET", "LIABILITY", "EQUITY"}:
            continue

        if account_type == "ASSET":
            target_map = asset_map
        elif account_type == "LIABILITY":
            target_map = liability_map
        else:
            target_map = equity_map

        if account.pk not in target_map:
            target_map[account.pk] = {
                "account_id": account.pk,
                "account_code": account.code,
                "account_name": account.name,
                "account_type": account_type,
                "total_debit": Decimal("0.00"),
                "total_credit": Decimal("0.00"),
            }

        target_map[account.pk]["total_debit"] += _money(line.debit_amount)
        target_map[account.pk]["total_credit"] += _money(line.credit_amount)

    if include_zero_accounts:
        asset_accounts = Account.objects.filter(
            is_active=True,
            is_group=False,
            account_type="ASSET",
        ).order_by("code")
        liability_accounts = Account.objects.filter(
            is_active=True,
            is_group=False,
            account_type="LIABILITY",
        ).order_by("code")
        equity_accounts = Account.objects.filter(
            is_active=True,
            is_group=False,
            account_type="EQUITY",
        ).order_by("code")

        for account in asset_accounts:
            asset_map.setdefault(
                account.pk,
                {
                    "account_id": account.pk,
                    "account_code": account.code,
                    "account_name": account.name,
                    "account_type": "ASSET",
                    "total_debit": Decimal("0.00"),
                    "total_credit": Decimal("0.00"),
                },
            )

        for account in liability_accounts:
            liability_map.setdefault(
                account.pk,
                {
                    "account_id": account.pk,
                    "account_code": account.code,
                    "account_name": account.name,
                    "account_type": "LIABILITY",
                    "total_debit": Decimal("0.00"),
                    "total_credit": Decimal("0.00"),
                },
            )

        for account in equity_accounts:
            equity_map.setdefault(
                account.pk,
                {
                    "account_id": account.pk,
                    "account_code": account.code,
                    "account_name": account.name,
                    "account_type": "EQUITY",
                    "total_debit": Decimal("0.00"),
                    "total_credit": Decimal("0.00"),
                },
            )

    asset_rows: list[BalanceSheetRow] = []
    liability_rows: list[BalanceSheetRow] = []
    equity_rows: list[BalanceSheetRow] = []

    for _, data in sorted(asset_map.items(), key=lambda item: item[1]["account_code"]):
        amount = _money(data["total_debit"] - data["total_credit"])
        if not include_zero_accounts and amount == Decimal("0.00"):
            continue

        asset_rows.append(
            BalanceSheetRow(
                account_id=data["account_id"],
                account_code=data["account_code"],
                account_name=data["account_name"],
                account_type=data["account_type"],
                amount=amount if amount > Decimal("0.00") else Decimal("0.00"),
            )
        )

    for _, data in sorted(liability_map.items(), key=lambda item: item[1]["account_code"]):
        amount = _money(data["total_credit"] - data["total_debit"])
        if not include_zero_accounts and amount == Decimal("0.00"):
            continue

        liability_rows.append(
            BalanceSheetRow(
                account_id=data["account_id"],
                account_code=data["account_code"],
                account_name=data["account_name"],
                account_type=data["account_type"],
                amount=amount if amount > Decimal("0.00") else Decimal("0.00"),
            )
        )

    for _, data in sorted(equity_map.items(), key=lambda item: item[1]["account_code"]):
        amount = _money(data["total_credit"] - data["total_debit"])
        if not include_zero_accounts and amount == Decimal("0.00"):
            continue

        equity_rows.append(
            BalanceSheetRow(
                account_id=data["account_id"],
                account_code=data["account_code"],
                account_name=data["account_name"],
                account_type=data["account_type"],
                amount=amount if amount > Decimal("0.00") else Decimal("0.00"),
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