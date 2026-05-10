# ============================================================
# 📂 api/reports/overview.py
# 🧠 Primey Care | Reports Overview API V2
# ------------------------------------------------------------
# ✅ Central reports overview
# ✅ Customers / Providers / Orders / Invoices / Payments totals
# ✅ Accounting / Treasury operational indicators
# ✅ Compatible with rebuilt Accounting / Treasury / Payments flow
# ✅ Unified response through reports._utils.json_success
# ============================================================

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.db.models import Count, Q, Sum
from django.views.decorators.http import require_GET

from ._utils import (
    get_base_queryset,
    json_success,
    normalize_money,
    report_meta,
    safe_count,
    safe_group_count,
    safe_sum,
)


# ============================================================
# Safe Helpers
# ============================================================

def _money(value: Any) -> Decimal:
    if value is None:
        value = "0.00"

    try:
        return Decimal(str(value)).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )
    except Exception:
        return Decimal("0.00")


def _normalize_money(value: Any) -> float:
    return normalize_money(_money(value))


def _field_names(queryset) -> set[str]:
    if queryset is None:
        return set()

    try:
        return {field.name for field in queryset.model._meta.fields}
    except Exception:
        return set()


def _safe_count_filter(queryset, **filters) -> int:
    if queryset is None:
        return 0

    try:
        return int(queryset.filter(**filters).count() or 0)
    except Exception:
        return 0


def _safe_sum_field(queryset, *fields: str) -> Decimal:
    if queryset is None:
        return Decimal("0.00")

    model_fields = _field_names(queryset)

    for field in fields:
        if field not in model_fields:
            continue

        try:
            return _money(queryset.aggregate(total=Sum(field)).get("total"))
        except Exception:
            continue

    return Decimal("0.00")


def _percentage(part: Any, total: Any) -> float:
    total_value = Decimal(str(total or 0))

    if total_value <= Decimal("0"):
        return 0.0

    return _normalize_money(Decimal(str(part or 0)) * Decimal("100.00") / total_value)


def _latest_count(queryset, limit: int = 5) -> int:
    if queryset is None:
        return 0

    try:
        return len(list(queryset.order_by("-id")[:limit]))
    except Exception:
        return 0


# ============================================================
# Summary Builders
# ============================================================

def _build_customers_summary(customers) -> dict[str, Any]:
    return {
        "count": safe_count(customers),
        "by_status": safe_group_count(customers, ["status"]),
    }


def _build_providers_summary(providers) -> dict[str, Any]:
    return {
        "count": safe_count(providers),
        "by_status": safe_group_count(providers, ["status"]),
        "by_type": safe_group_count(providers, ["provider_type", "type"]),
    }


def _build_orders_summary(orders) -> dict[str, Any]:
    total_orders = safe_count(orders)
    total_amount = safe_sum(
        orders,
        ["total_amount", "grand_total", "amount", "net_amount", "subtotal"],
    )
    paid_amount = safe_sum(
        orders,
        ["amount_paid", "paid_amount"],
    )

    fields = _field_names(orders)

    completed = (
        _safe_count_filter(orders, status="COMPLETED")
        or _safe_count_filter(orders, status="completed")
        if "status" in fields
        else 0
    )
    cancelled = (
        _safe_count_filter(orders, status="CANCELLED")
        or _safe_count_filter(orders, status="cancelled")
        if "status" in fields
        else 0
    )

    return {
        "count": total_orders,
        "total_amount": _normalize_money(total_amount),
        "paid_amount": _normalize_money(paid_amount),
        "remaining_amount": _normalize_money(_money(total_amount) - _money(paid_amount)),
        "completed_count": completed,
        "cancelled_count": cancelled,
        "completion_rate": _percentage(completed, total_orders),
        "collection_rate": _percentage(paid_amount, total_amount),
        "by_status": safe_group_count(orders, ["status", "order_status"]),
        "by_payment_status": safe_group_count(orders, ["payment_status"]),
        "by_fulfillment_status": safe_group_count(orders, ["fulfillment_status"]),
    }


def _build_invoices_summary(invoices) -> dict[str, Any]:
    total_invoices = safe_count(invoices)

    subtotal = _safe_sum_field(invoices, "subtotal", "amount")
    total_amount = safe_sum(
        invoices,
        ["total_amount", "grand_total", "amount", "net_amount", "subtotal"],
    )
    paid_amount = safe_sum(
        invoices,
        ["paid_amount", "amount_paid", "collected_amount"],
    )
    due_amount = _safe_sum_field(invoices, "due_amount")
    tax_amount = safe_sum(
        invoices,
        ["tax_amount", "vat_amount", "total_tax"],
    )

    fields = _field_names(invoices)

    accounting_posted = (
        _safe_count_filter(invoices, is_accounting_posted=True)
        if "is_accounting_posted" in fields
        else 0
    )
    accounting_pending = (
        _safe_count_filter(invoices, is_accounting_posted=False)
        if "is_accounting_posted" in fields
        else 0
    )

    return {
        "count": total_invoices,
        "subtotal": _normalize_money(subtotal),
        "tax_amount": _normalize_money(tax_amount),
        "total_amount": _normalize_money(total_amount),
        "paid_amount": _normalize_money(paid_amount),
        "due_amount": _normalize_money(due_amount if due_amount else _money(total_amount) - _money(paid_amount)),
        "accounting_posted_count": accounting_posted,
        "accounting_pending_count": accounting_pending,
        "collection_rate": _percentage(paid_amount, total_amount),
        "accounting_posting_rate": _percentage(accounting_posted, total_invoices),
        "by_status": safe_group_count(invoices, ["status", "invoice_status"]),
        "by_type": safe_group_count(invoices, ["invoice_type", "type"]),
    }


def _build_payments_summary(payments) -> dict[str, Any]:
    total_payments = safe_count(payments)

    amount = safe_sum(
        payments,
        ["amount", "paid_amount", "total_amount", "net_amount"],
    )
    paid_amount = _safe_sum_field(payments, "paid_amount", "amount")
    refunded_amount = _safe_sum_field(payments, "refunded_amount")
    net_collected = _money(paid_amount) - _money(refunded_amount)

    fields = _field_names(payments)

    accounting_posted = (
        _safe_count_filter(payments, is_accounting_posted=True)
        if "is_accounting_posted" in fields
        else 0
    )
    accounting_pending = (
        _safe_count_filter(payments, is_accounting_posted=False)
        if "is_accounting_posted" in fields
        else 0
    )
    treasury_posted = (
        _safe_count_filter(payments, is_treasury_posted=True)
        if "is_treasury_posted" in fields
        else 0
    )
    treasury_pending = (
        _safe_count_filter(payments, is_treasury_posted=False)
        if "is_treasury_posted" in fields
        else 0
    )

    gateway_payments = 0
    if "external_reference" in fields or "transaction_id" in fields:
        try:
            gateway_payments = payments.filter(
                Q(external_reference__isnull=False)
                | Q(transaction_id__isnull=False)
            ).count()
        except Exception:
            gateway_payments = 0

    return {
        "count": total_payments,
        "amount": _normalize_money(amount),
        "paid_amount": _normalize_money(paid_amount),
        "refunded_amount": _normalize_money(refunded_amount),
        "net_collected_amount": _normalize_money(net_collected),
        "accounting_posted_count": accounting_posted,
        "accounting_pending_count": accounting_pending,
        "treasury_posted_count": treasury_posted,
        "treasury_pending_count": treasury_pending,
        "gateway_payments_count": gateway_payments,
        "collection_rate": _percentage(paid_amount, amount),
        "accounting_posting_rate": _percentage(accounting_posted, total_payments),
        "treasury_posting_rate": _percentage(treasury_posted, total_payments),
        "by_status": safe_group_count(payments, ["status", "payment_status"]),
        "by_method": safe_group_count(payments, ["payment_method", "method", "payment_type", "gateway"]),
        "by_provider": safe_group_count(payments, ["provider", "gateway_provider"]),
    }


def _build_accounting_summary(entries, lines) -> dict[str, Any]:
    total_entries = safe_count(entries)
    total_lines = safe_count(lines)

    debit_total = _safe_sum_field(lines, "debit", "debit_amount")
    credit_total = _safe_sum_field(lines, "credit", "credit_amount")
    difference = _money(debit_total) - _money(credit_total)

    fields = _field_names(entries)

    posted_entries = (
        _safe_count_filter(entries, status="POSTED")
        or _safe_count_filter(entries, status="posted")
        if "status" in fields
        else 0
    )

    auto_posted = (
        _safe_count_filter(entries, is_auto_posted=True)
        if "is_auto_posted" in fields
        else 0
    )

    return {
        "entries_count": total_entries,
        "lines_count": total_lines,
        "posted_entries_count": posted_entries,
        "auto_posted_entries_count": auto_posted,
        "total_debit": _normalize_money(debit_total),
        "total_credit": _normalize_money(credit_total),
        "difference": _normalize_money(difference),
        "is_balanced": difference == Decimal("0.00"),
        "by_status": safe_group_count(entries, ["status", "entry_status"]),
        "by_source": safe_group_count(entries, ["source_type", "posting_source"]),
    }


def _build_treasury_summary(accounts, transactions) -> dict[str, Any]:
    accounts_count = safe_count(accounts)
    transactions_count = safe_count(transactions)

    amount = safe_sum(
        transactions,
        ["amount", "net_amount"],
    )
    fees_amount = _safe_sum_field(transactions, "fees_amount")
    net_amount = _safe_sum_field(transactions, "net_amount", "amount")

    fields = _field_names(transactions)

    confirmed = (
        _safe_count_filter(transactions, status="CONFIRMED")
        or _safe_count_filter(transactions, status="confirmed")
        if "status" in fields
        else 0
    )
    cancelled = (
        _safe_count_filter(transactions, status="CANCELLED")
        or _safe_count_filter(transactions, status="cancelled")
        if "status" in fields
        else 0
    )

    balance_applied = (
        _safe_count_filter(transactions, balance_applied=True)
        if "balance_applied" in fields
        else 0
    )

    return {
        "accounts_count": accounts_count,
        "transactions_count": transactions_count,
        "amount": _normalize_money(amount),
        "fees_amount": _normalize_money(fees_amount),
        "net_amount": _normalize_money(net_amount),
        "confirmed_transactions_count": confirmed,
        "cancelled_transactions_count": cancelled,
        "balance_applied_count": balance_applied,
        "confirmation_rate": _percentage(confirmed, transactions_count),
        "by_account_type": safe_group_count(accounts, ["account_type", "type"]),
        "by_transaction_status": safe_group_count(transactions, ["status"]),
        "by_transaction_type": safe_group_count(transactions, ["transaction_type", "type"]),
        "by_source": safe_group_count(transactions, ["source", "source_type"]),
    }


def _build_system_health(
    *,
    invoices_summary: dict[str, Any],
    payments_summary: dict[str, Any],
    accounting_summary: dict[str, Any],
    treasury_summary: dict[str, Any],
) -> dict[str, Any]:
    accounting_pending = int(invoices_summary.get("accounting_pending_count") or 0) + int(
        payments_summary.get("accounting_pending_count") or 0
    )
    treasury_pending = int(payments_summary.get("treasury_pending_count") or 0)

    warnings = []

    if accounting_pending:
        warnings.append(
            {
                "key": "accounting_pending",
                "message_ar": "توجد عمليات لم تترحل محاسبيًا.",
                "message_en": "Some operations are not posted to accounting.",
                "count": accounting_pending,
            }
        )

    if treasury_pending:
        warnings.append(
            {
                "key": "treasury_pending",
                "message_ar": "توجد مدفوعات لم تترحل إلى الخزينة.",
                "message_en": "Some payments are not posted to treasury.",
                "count": treasury_pending,
            }
        )

    if not accounting_summary.get("is_balanced", True):
        warnings.append(
            {
                "key": "accounting_unbalanced",
                "message_ar": "إجمالي المدين لا يساوي إجمالي الدائن.",
                "message_en": "Accounting debit and credit totals are not balanced.",
                "count": 1,
            }
        )

    return {
        "ok": len(warnings) == 0,
        "warnings_count": len(warnings),
        "warnings": warnings,
        "posting": {
            "accounting_pending": accounting_pending,
            "treasury_pending": treasury_pending,
            "accounting_posting_rate": payments_summary.get("accounting_posting_rate", 0),
            "treasury_posting_rate": payments_summary.get("treasury_posting_rate", 0),
        },
        "balance": {
            "accounting_is_balanced": bool(accounting_summary.get("is_balanced", True)),
            "accounting_difference": accounting_summary.get("difference", 0),
        },
    }


# ============================================================
# API
# ============================================================

@require_GET
def reports_overview(request):
    customers = get_base_queryset("customers", "Customer")
    providers = get_base_queryset("providers", "Provider")
    orders = get_base_queryset("orders", "Order")
    invoices = get_base_queryset("invoices", "Invoice")
    payments = get_base_queryset("payments", "Payment")

    accounting_entries = (
        get_base_queryset("accounting", "JournalEntry")
        or get_base_queryset("accounting", "AccountingEntry")
        or get_base_queryset("accounting", "Entry")
    )
    accounting_lines = (
        get_base_queryset("accounting", "JournalEntryLine")
        or get_base_queryset("accounting", "AccountingEntryLine")
        or get_base_queryset("accounting", "EntryLine")
    )

    treasury_accounts = get_base_queryset("treasury", "TreasuryAccount")
    treasury_transactions = get_base_queryset("treasury", "TreasuryTransaction")

    customers_summary = _build_customers_summary(customers)
    providers_summary = _build_providers_summary(providers)
    orders_summary = _build_orders_summary(orders)
    invoices_summary = _build_invoices_summary(invoices)
    payments_summary = _build_payments_summary(payments)
    accounting_summary = _build_accounting_summary(accounting_entries, accounting_lines)
    treasury_summary = _build_treasury_summary(treasury_accounts, treasury_transactions)

    data = {
        "meta": report_meta("overview", "لوحة التقارير", "Reports Overview"),
        "summary": {
            # توافق خلفي
            "customers_count": customers_summary["count"],
            "providers_count": providers_summary["count"],
            "orders_count": orders_summary["count"],
            "invoices_count": invoices_summary["count"],
            "payments_count": payments_summary["count"],
            "orders_total": orders_summary["total_amount"],
            "invoices_total": invoices_summary["total_amount"],
            "payments_total": payments_summary["paid_amount"],

            # مؤشرات جديدة
            "orders_paid_amount": orders_summary["paid_amount"],
            "orders_remaining_amount": orders_summary["remaining_amount"],
            "invoices_paid_amount": invoices_summary["paid_amount"],
            "invoices_due_amount": invoices_summary["due_amount"],
            "payments_net_collected_amount": payments_summary["net_collected_amount"],
            "payments_refunded_amount": payments_summary["refunded_amount"],

            "accounting_entries_count": accounting_summary["entries_count"],
            "accounting_lines_count": accounting_summary["lines_count"],
            "treasury_accounts_count": treasury_summary["accounts_count"],
            "treasury_transactions_count": treasury_summary["transactions_count"],

            "currency": "SAR",
        },
        "modules_summary": {
            "customers": customers_summary,
            "providers": providers_summary,
            "orders": orders_summary,
            "invoices": invoices_summary,
            "payments": payments_summary,
            "accounting": accounting_summary,
            "treasury": treasury_summary,
        },
        "system_health": _build_system_health(
            invoices_summary=invoices_summary,
            payments_summary=payments_summary,
            accounting_summary=accounting_summary,
            treasury_summary=treasury_summary,
        ),
        "quick_counts": {
            "latest_customers": _latest_count(customers),
            "latest_providers": _latest_count(providers),
            "latest_orders": _latest_count(orders),
            "latest_invoices": _latest_count(invoices),
            "latest_payments": _latest_count(payments),
        },
        "modules": [
            {
                "key": "customers",
                "title_ar": "تقارير العملاء",
                "title_en": "Customers Reports",
                "href": "/system/reports/customers",
                "api": "/api/reports/customers/",
                "count": customers_summary["count"],
            },
            {
                "key": "providers",
                "title_ar": "تقارير المراكز",
                "title_en": "Providers Reports",
                "href": "/system/reports/providers",
                "api": "/api/reports/providers/",
                "count": providers_summary["count"],
            },
            {
                "key": "orders",
                "title_ar": "تقارير الطلبات",
                "title_en": "Orders Reports",
                "href": "/system/reports/orders",
                "api": "/api/reports/orders/",
                "count": orders_summary["count"],
                "amount": orders_summary["total_amount"],
            },
            {
                "key": "invoices",
                "title_ar": "تقارير الفواتير",
                "title_en": "Invoices Reports",
                "href": "/system/reports/invoices",
                "api": "/api/reports/invoices/",
                "count": invoices_summary["count"],
                "amount": invoices_summary["total_amount"],
            },
            {
                "key": "payments",
                "title_ar": "تقارير المدفوعات",
                "title_en": "Payments Reports",
                "href": "/system/reports/payments",
                "api": "/api/reports/payments/",
                "count": payments_summary["count"],
                "amount": payments_summary["paid_amount"],
            },
            {
                "key": "accounting",
                "title_ar": "تقارير المحاسبة",
                "title_en": "Accounting Reports",
                "href": "/system/reports/accounting",
                "api": "/api/reports/accounting/",
                "count": accounting_summary["entries_count"],
                "is_balanced": accounting_summary["is_balanced"],
            },
            {
                "key": "treasury",
                "title_ar": "تقارير الخزينة",
                "title_en": "Treasury Reports",
                "href": "/system/treasury/reports",
                "api": "/api/treasury/reports/",
                "count": treasury_summary["transactions_count"],
                "amount": treasury_summary["net_amount"],
            },
        ],
    }

    return json_success(data)