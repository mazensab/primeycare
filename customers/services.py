# ============================================================
# 📂 customers/services.py
# 🧠 Primey Care | Customer Statement Services
# ------------------------------------------------------------
# ✅ خدمة رسمية لبناء كشف حساب العميل
# ✅ تعتمد على:
#    - invoices
#    - payments
# ✅ تدعم orders اختياريًا لأغراض تشغيلية فقط
# ✅ تولد:
#    - ملخص مالي
#    - خطوط كشف حساب زمنية
#    - رصيد تراكمي
# ✅ جاهزة للربط لاحقًا مع API / UI / PDF
# ------------------------------------------------------------
# ملاحظات:
# 1) هذه النسخة V2 مالية أنظف من V1
# 2) لا تعتمد على القيود المحاسبية مباشرة في هذه المرحلة
# 3) الافتراضي الآن:
#    - include_orders=False
#    - include_invoices=True
#    - include_payments=True
# 4) تم توحيد التواريخ لتكون timezone-aware
# ============================================================

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import date, datetime, time
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional

from django.db.models import QuerySet, Sum
from django.utils import timezone

from customers.models import Customer
from invoices.models import Invoice
from orders.models import Order
from payments.models import Payment


# ============================================================
# 🧾 DTOs
# ============================================================

@dataclass(slots=True)
class CustomerStatementSummary:
    customer_id: int
    customer_code: str
    customer_name: str
    customer_status: str
    primary_contact: str
    total_orders_count: int
    total_orders_amount: Decimal
    total_invoices_count: int
    total_invoices_amount: Decimal
    total_paid_amount: Decimal
    total_due_amount: Decimal
    currency: str


@dataclass(slots=True)
class CustomerStatementLine:
    line_type: str
    line_date: Optional[datetime]
    reference: str
    related_order_id: Optional[int]
    related_invoice_id: Optional[int]
    related_payment_id: Optional[int]
    description: str
    debit_amount: Decimal
    credit_amount: Decimal
    balance_after: Decimal
    currency: str
    status: str
    metadata: dict[str, Any]


@dataclass(slots=True)
class CustomerStatementResult:
    summary: CustomerStatementSummary
    lines: list[CustomerStatementLine]


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


def _resolve_customer_display_name(customer: Customer) -> str:
    return (
        customer.display_name
        or customer.full_name
        or customer.customer_code
        or f"Customer #{customer.pk}"
    )


def _resolve_customer_contact(customer: Customer) -> str:
    return customer.primary_contact_number or customer.email or ""


def _resolve_currency_from_customer_data(
    orders_qs: QuerySet[Order],
    invoices_qs: QuerySet[Invoice],
    payments_qs: QuerySet[Payment],
) -> str:
    invoice_obj = invoices_qs.order_by("-created_at").first()
    if invoice_obj and getattr(invoice_obj, "currency", None):
        return invoice_obj.currency

    payment_obj = payments_qs.order_by("-created_at").first()
    if payment_obj and getattr(payment_obj, "currency", None):
        return payment_obj.currency

    order_obj = orders_qs.order_by("-created_at").first()
    if order_obj and getattr(order_obj, "currency_code", None):
        return order_obj.currency_code

    return "SAR"


def _serialize_summary(summary: CustomerStatementSummary) -> dict[str, Any]:
    data = asdict(summary)
    for key in [
        "total_orders_amount",
        "total_invoices_amount",
        "total_paid_amount",
        "total_due_amount",
    ]:
        data[key] = str(data[key])
    return data


def _serialize_line(line: CustomerStatementLine) -> dict[str, Any]:
    data = asdict(line)
    data["debit_amount"] = str(line.debit_amount)
    data["credit_amount"] = str(line.credit_amount)
    data["balance_after"] = str(line.balance_after)
    data["line_date"] = line.line_date.isoformat() if line.line_date else None
    return data


def _sort_datetime_fallback() -> datetime:
    return timezone.now()


# ============================================================
# 📥 Collectors
# ============================================================

def _collect_order_lines(
    orders_qs: QuerySet[Order],
    *,
    date_from: datetime | None,
    date_to: datetime | None,
    currency: str,
) -> list[dict[str, Any]]:
    """
    خطوط تشغيلية اختيارية فقط.
    لا يُنصح بإدخالها في الكشف المالي الافتراضي حتى لا يحدث ازدواج
    مع الفاتورة.
    """
    lines: list[dict[str, Any]] = []

    queryset = orders_qs
    if date_from:
        queryset = queryset.filter(created_at__gte=date_from)
    if date_to:
        queryset = queryset.filter(created_at__lte=date_to)

    for order in queryset.order_by("created_at", "id"):
        amount = _money(order.total_amount)
        if amount <= Decimal("0.00"):
            continue

        lines.append(
            {
                "line_type": "ORDER",
                "line_date": _ensure_aware(order.created_at),
                "reference": order.order_number or f"ORD-{order.pk}",
                "related_order_id": order.pk,
                "related_invoice_id": None,
                "related_payment_id": None,
                "description": f"إنشاء طلب {order.order_number or order.pk}",
                "debit_amount": amount,
                "credit_amount": Decimal("0.00"),
                "currency": order.currency_code or currency,
                "status": order.status,
                "metadata": {
                    "payment_status": order.payment_status,
                    "fulfillment_status": order.fulfillment_status,
                    "product_name": order.product_name,
                    "is_operational_only": True,
                },
            }
        )

    return lines


def _collect_invoice_lines(
    invoices_qs: QuerySet[Invoice],
    *,
    date_from: datetime | None,
    date_to: datetime | None,
    currency: str,
) -> list[dict[str, Any]]:
    lines: list[dict[str, Any]] = []

    queryset = invoices_qs
    if date_from:
        queryset = queryset.filter(created_at__gte=date_from)
    if date_to:
        queryset = queryset.filter(created_at__lte=date_to)

    for invoice in queryset.order_by("created_at", "id"):
        amount = _money(invoice.total_amount)
        if amount <= Decimal("0.00"):
            continue

        if invoice.issue_date:
            issue_date_value = _ensure_aware(
                datetime.combine(invoice.issue_date, time.min)
            )
        else:
            issue_date_value = _ensure_aware(invoice.created_at)

        lines.append(
            {
                "line_type": "INVOICE",
                "line_date": issue_date_value,
                "reference": invoice.invoice_number or f"INV-{invoice.pk}",
                "related_order_id": invoice.order_id,
                "related_invoice_id": invoice.pk,
                "related_payment_id": None,
                "description": f"إصدار فاتورة {invoice.invoice_number or invoice.pk}",
                "debit_amount": amount,
                "credit_amount": Decimal("0.00"),
                "currency": invoice.currency or currency,
                "status": invoice.status,
                "metadata": {
                    "due_date": invoice.due_date.isoformat() if invoice.due_date else None,
                    "paid_amount": str(_money(invoice.paid_amount)),
                    "due_amount": str(_money(invoice.due_amount)),
                    "invoice_type": invoice.invoice_type,
                },
            }
        )

    return lines


def _collect_payment_lines(
    payments_qs: QuerySet[Payment],
    *,
    date_from: datetime | None,
    date_to: datetime | None,
    currency: str,
) -> list[dict[str, Any]]:
    lines: list[dict[str, Any]] = []

    queryset = payments_qs
    if date_from:
        queryset = queryset.filter(created_at__gte=date_from)
    if date_to:
        queryset = queryset.filter(created_at__lte=date_to)

    for payment in queryset.order_by("created_at", "id"):
        amount = _money(payment.paid_amount or payment.amount)
        if amount <= Decimal("0.00"):
            continue

        line_date = _ensure_aware(payment.paid_at or payment.created_at)

        lines.append(
            {
                "line_type": "PAYMENT",
                "line_date": line_date,
                "reference": payment.payment_number or f"PAY-{payment.pk}",
                "related_order_id": payment.order_id,
                "related_invoice_id": None,
                "related_payment_id": payment.pk,
                "description": f"تحصيل دفعة {payment.payment_number or payment.pk}",
                "debit_amount": Decimal("0.00"),
                "credit_amount": amount,
                "currency": payment.currency or currency,
                "status": payment.status,
                "metadata": {
                    "payment_method": payment.payment_method,
                    "provider": payment.provider,
                    "external_reference": payment.external_reference,
                    "transaction_id": payment.transaction_id,
                },
            }
        )

    return lines


# ============================================================
# 📊 Summary Builder
# ============================================================

def _build_summary(
    customer: Customer,
    orders_qs: QuerySet[Order],
    invoices_qs: QuerySet[Invoice],
    payments_qs: QuerySet[Payment],
    *,
    currency: str,
) -> CustomerStatementSummary:
    total_orders_amount = _money(
        orders_qs.aggregate(total=Sum("total_amount")).get("total") or "0.00"
    )
    total_invoices_amount = _money(
        invoices_qs.aggregate(total=Sum("total_amount")).get("total") or "0.00"
    )
    total_paid_amount = _money(
        payments_qs.aggregate(total=Sum("paid_amount")).get("total") or "0.00"
    )
    total_due_amount = _money(total_invoices_amount - total_paid_amount)
    if total_due_amount < Decimal("0.00"):
        total_due_amount = Decimal("0.00")

    return CustomerStatementSummary(
        customer_id=customer.pk,
        customer_code=customer.customer_code or "",
        customer_name=_resolve_customer_display_name(customer),
        customer_status=customer.status,
        primary_contact=_resolve_customer_contact(customer),
        total_orders_count=orders_qs.count(),
        total_orders_amount=total_orders_amount,
        total_invoices_count=invoices_qs.count(),
        total_invoices_amount=total_invoices_amount,
        total_paid_amount=total_paid_amount,
        total_due_amount=total_due_amount,
        currency=currency,
    )


# ============================================================
# 🧾 Statement Builder
# ============================================================

def build_customer_statement(
    customer: Customer,
    *,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    include_orders: bool = False,
    include_invoices: bool = True,
    include_payments: bool = True,
) -> CustomerStatementResult:
    """
    بناء كشف حساب العميل.

    الفكرة المالية في V2:
    - الفاتورة تمثل حركة مدينة على العميل
    - الدفعة تمثل حركة دائنة على العميل
    - الطلب اختياري وتشغيلي فقط، ومُستبعد افتراضيًا من الرصيد المالي
    """
    if not customer:
        raise ValueError("customer is required")

    start_dt = _start_of_day(date_from)
    end_dt = _end_of_day(date_to)

    orders_qs = Order.objects.filter(customer=customer)
    invoices_qs = Invoice.objects.filter(customer=customer)
    payments_qs = Payment.objects.filter(customer=customer)

    currency = _resolve_currency_from_customer_data(
        orders_qs=orders_qs,
        invoices_qs=invoices_qs,
        payments_qs=payments_qs,
    )

    summary = _build_summary(
        customer=customer,
        orders_qs=orders_qs,
        invoices_qs=invoices_qs,
        payments_qs=payments_qs,
        currency=currency,
    )

    raw_lines: list[dict[str, Any]] = []

    if include_orders:
        raw_lines.extend(
            _collect_order_lines(
                orders_qs,
                date_from=start_dt,
                date_to=end_dt,
                currency=currency,
            )
        )

    if include_invoices:
        raw_lines.extend(
            _collect_invoice_lines(
                invoices_qs,
                date_from=start_dt,
                date_to=end_dt,
                currency=currency,
            )
        )

    if include_payments:
        raw_lines.extend(
            _collect_payment_lines(
                payments_qs,
                date_from=start_dt,
                date_to=end_dt,
                currency=currency,
            )
        )

    raw_lines.sort(
        key=lambda item: (
            item["line_date"] or _sort_datetime_fallback(),
            item["related_order_id"] or 0,
            item["related_invoice_id"] or 0,
            item["related_payment_id"] or 0,
            item["line_type"],
        )
    )

    balance = Decimal("0.00")
    statement_lines: list[CustomerStatementLine] = []

    for item in raw_lines:
        debit_amount = _money(item["debit_amount"])
        credit_amount = _money(item["credit_amount"])
        balance = _money(balance + debit_amount - credit_amount)

        statement_lines.append(
            CustomerStatementLine(
                line_type=item["line_type"],
                line_date=item["line_date"],
                reference=item["reference"],
                related_order_id=item["related_order_id"],
                related_invoice_id=item["related_invoice_id"],
                related_payment_id=item["related_payment_id"],
                description=item["description"],
                debit_amount=debit_amount,
                credit_amount=credit_amount,
                balance_after=balance,
                currency=item["currency"],
                status=item["status"],
                metadata=item["metadata"],
            )
        )

    return CustomerStatementResult(
        summary=summary,
        lines=statement_lines,
    )


# ============================================================
# 🌐 Serialized Helper
# ============================================================

def build_customer_statement_payload(
    customer: Customer,
    *,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    include_orders: bool = False,
    include_invoices: bool = True,
    include_payments: bool = True,
) -> dict[str, Any]:
    """
    نسخة جاهزة مباشرة للـ API.
    """
    result = build_customer_statement(
        customer=customer,
        date_from=date_from,
        date_to=date_to,
        include_orders=include_orders,
        include_invoices=include_invoices,
        include_payments=include_payments,
    )

    return {
        "summary": _serialize_summary(result.summary),
        "lines": [_serialize_line(line) for line in result.lines],
    }