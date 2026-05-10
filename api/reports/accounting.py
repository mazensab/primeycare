# ============================================================
# 📂 api/reports/accounting.py
# 🧠 Primey Care | Accounting Central Report API V2
# ------------------------------------------------------------
# ✅ Accounting overview report
# ✅ Journal entries summary
# ✅ Journal lines debit / credit totals
# ✅ Trial balance style totals
# ✅ Accounts / cost centers / periods / fiscal years overview
# ✅ Taxes overview when available
# ✅ Compatible with rebuilt Accounting backend
# ============================================================

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.apps import apps
from django.db.models import Count, Q, Sum
from django.views.decorators.http import require_GET

from ._utils import (
    apply_date_filters,
    common_filters_from_request,
    get_base_queryset,
    json_success,
    normalize_money,
    report_meta,
    safe_count,
    safe_group_count,
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


def _normalize_money(value: Any) -> str:
    return normalize_money(_money(value))


def _model_or_none(app_label: str, model_name: str):
    try:
        return apps.get_model(app_label, model_name)
    except LookupError:
        return None


def _field_names(model) -> set[str]:
    if not model:
        return set()

    try:
        return {field.name for field in model._meta.fields}
    except Exception:
        return set()


def _has_field(model, field_name: str) -> bool:
    return field_name in _field_names(model)


def _safe_attr(obj: Any, attr_name: str, default: Any = None) -> Any:
    try:
        return getattr(obj, attr_name, default)
    except Exception:
        return default


def _safe_iso(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _safe_values(queryset, fields: list[str], limit: int = 100) -> list[dict[str, Any]]:
    if queryset is None:
        return []

    model_fields = _field_names(queryset.model)
    allowed = [field for field in fields if field in model_fields]

    if not allowed:
        return []

    try:
        return list(queryset.values(*allowed)[:limit])
    except Exception:
        return []


def _safe_sum_field(queryset, *field_names: str) -> Decimal:
    if queryset is None:
        return Decimal("0.00")

    model_fields = _field_names(queryset.model)

    for field_name in field_names:
        if field_name not in model_fields:
            continue

        try:
            return _money(queryset.aggregate(total=Sum(field_name)).get("total"))
        except Exception:
            continue

    return Decimal("0.00")


def _safe_count_filter(queryset, **filters) -> int:
    if queryset is None:
        return 0

    try:
        return int(queryset.filter(**filters).count() or 0)
    except Exception:
        return 0


def _safe_group_sum(queryset, group_field: str, sum_fields: list[str], limit: int = 20) -> list[dict[str, Any]]:
    if queryset is None:
        return []

    model_fields = _field_names(queryset.model)

    if group_field not in model_fields:
        return []

    annotations = {"count": Count("id")}

    for sum_field in sum_fields:
        if sum_field in model_fields:
            annotations[sum_field] = Sum(sum_field)

    try:
        rows = (
            queryset
            .values(group_field)
            .annotate(**annotations)
            .order_by(group_field)[:limit]
        )
    except Exception:
        return []

    result = []

    for row in rows:
        item = {
            group_field: row.get(group_field) or "",
            "count": row.get("count") or 0,
        }

        for sum_field in sum_fields:
            item[sum_field] = _normalize_money(row.get(sum_field))

        result.append(item)

    return result


# ============================================================
# Query Builders
# ============================================================

def _entry_queryset(filters: dict[str, Any]):
    queryset = (
        get_base_queryset("accounting", "JournalEntry")
        or get_base_queryset("accounting", "AccountingEntry")
        or get_base_queryset("accounting", "Entry")
    )

    if queryset is None:
        return None

    queryset = apply_date_filters(
        queryset,
        queryset.model,
        filters.get("date_from"),
        filters.get("date_to"),
    )

    model_fields = _field_names(queryset.model)

    status_value = filters.get("status") or filters.get("entry_status")
    if status_value and "status" in model_fields:
        queryset = queryset.filter(status=status_value)

    source_type = filters.get("source_type")
    if source_type and "source_type" in model_fields:
        queryset = queryset.filter(source_type=source_type)

    source_id = filters.get("source_id")
    if source_id and "source_id" in model_fields:
        queryset = queryset.filter(source_id=source_id)

    period_id = filters.get("period_id")
    if period_id and "period" in model_fields:
        queryset = queryset.filter(period_id=period_id)

    currency = filters.get("currency")
    if currency and "currency" in model_fields:
        queryset = queryset.filter(currency=currency)

    return queryset


def _line_queryset(filters: dict[str, Any]):
    queryset = (
        get_base_queryset("accounting", "JournalEntryLine")
        or get_base_queryset("accounting", "AccountingEntryLine")
        or get_base_queryset("accounting", "EntryLine")
    )

    if queryset is None:
        return None

    queryset = apply_date_filters(
        queryset,
        queryset.model,
        filters.get("date_from"),
        filters.get("date_to"),
    )

    model_fields = _field_names(queryset.model)

    account_id = filters.get("account_id")
    if account_id and "account" in model_fields:
        queryset = queryset.filter(account_id=account_id)

    cost_center_id = filters.get("cost_center_id")
    if cost_center_id and "cost_center" in model_fields:
        queryset = queryset.filter(cost_center_id=cost_center_id)

    tax_rate_id = filters.get("tax_rate_id")
    if tax_rate_id and "tax_rate" in model_fields:
        queryset = queryset.filter(tax_rate_id=tax_rate_id)

    party_type = filters.get("party_type")
    if party_type and "party_type" in model_fields:
        queryset = queryset.filter(party_type=party_type)

    party_id = filters.get("party_id")
    if party_id and "party_id" in model_fields:
        queryset = queryset.filter(party_id=party_id)

    return queryset


def _account_queryset():
    return (
        get_base_queryset("accounting", "Account")
        or get_base_queryset("accounting", "ChartOfAccount")
        or get_base_queryset("accounting", "LedgerAccount")
    )


def _cost_center_queryset():
    return get_base_queryset("accounting", "CostCenter")


def _period_queryset():
    return get_base_queryset("accounting", "AccountingPeriod")


def _fiscal_year_queryset():
    return get_base_queryset("accounting", "FiscalYear")


def _tax_rate_queryset():
    return get_base_queryset("accounting", "TaxRate")


def _tax_transaction_queryset(filters: dict[str, Any]):
    queryset = get_base_queryset("accounting", "TaxTransaction")

    if queryset is None:
        return None

    queryset = apply_date_filters(
        queryset,
        queryset.model,
        filters.get("date_from"),
        filters.get("date_to"),
    )

    model_fields = _field_names(queryset.model)

    tax_rate_id = filters.get("tax_rate_id")
    if tax_rate_id and "tax_rate" in model_fields:
        queryset = queryset.filter(tax_rate_id=tax_rate_id)

    direction = filters.get("direction")
    if direction and "direction" in model_fields:
        queryset = queryset.filter(direction=direction)

    source_type = filters.get("source_type")
    if source_type and "source_type" in model_fields:
        queryset = queryset.filter(source_type=source_type)

    return queryset


# ============================================================
# Builders
# ============================================================

def _build_entries_summary(entries) -> dict[str, Any]:
    if entries is None:
        return {
            "total_entries": 0,
            "posted_entries": 0,
            "draft_entries": 0,
            "cancelled_entries": 0,
            "auto_posted_entries": 0,
            "manual_entries": 0,
        }

    model = entries.model
    model_fields = _field_names(model)

    posted_entries = 0
    draft_entries = 0
    cancelled_entries = 0

    if "status" in model_fields:
        posted_entries = (
            _safe_count_filter(entries, status="POSTED")
            or _safe_count_filter(entries, status="posted")
        )
        draft_entries = (
            _safe_count_filter(entries, status="DRAFT")
            or _safe_count_filter(entries, status="draft")
        )
        cancelled_entries = (
            _safe_count_filter(entries, status="CANCELLED")
            or _safe_count_filter(entries, status="cancelled")
        )

    auto_posted_entries = 0
    manual_entries = 0

    if "is_auto_posted" in model_fields:
        auto_posted_entries = _safe_count_filter(entries, is_auto_posted=True)
        manual_entries = _safe_count_filter(entries, is_auto_posted=False)

    return {
        "total_entries": safe_count(entries),
        "posted_entries": posted_entries,
        "draft_entries": draft_entries,
        "cancelled_entries": cancelled_entries,
        "auto_posted_entries": auto_posted_entries,
        "manual_entries": manual_entries,
    }


def _build_lines_summary(lines) -> dict[str, Any]:
    debit_total = _safe_sum_field(lines, "debit", "debit_amount")
    credit_total = _safe_sum_field(lines, "credit", "credit_amount")
    tax_amount = _safe_sum_field(lines, "tax_amount")

    difference = _money(debit_total - credit_total)

    return {
        "total_lines": safe_count(lines),
        "total_debit": _normalize_money(debit_total),
        "total_credit": _normalize_money(credit_total),
        "difference": _normalize_money(difference),
        "is_balanced": difference == Decimal("0.00"),
        "tax_amount": _normalize_money(tax_amount),
    }


def _build_accounts_summary(accounts) -> dict[str, Any]:
    if accounts is None:
        return {
            "total_accounts": 0,
            "active_accounts": 0,
            "system_accounts": 0,
            "manual_allowed_accounts": 0,
            "group_accounts": 0,
        }

    model_fields = _field_names(accounts.model)

    return {
        "total_accounts": safe_count(accounts),
        "active_accounts": _safe_count_filter(accounts, status="ACTIVE") if "status" in model_fields else 0,
        "system_accounts": _safe_count_filter(accounts, is_system=True) if "is_system" in model_fields else 0,
        "manual_allowed_accounts": (
            _safe_count_filter(accounts, allow_manual_posting=True)
            if "allow_manual_posting" in model_fields
            else 0
        ),
        "group_accounts": _safe_count_filter(accounts, is_group=True) if "is_group" in model_fields else 0,
    }


def _build_cost_centers_summary(cost_centers) -> dict[str, Any]:
    if cost_centers is None:
        return {
            "total_cost_centers": 0,
            "active_cost_centers": 0,
            "group_cost_centers": 0,
        }

    model_fields = _field_names(cost_centers.model)

    return {
        "total_cost_centers": safe_count(cost_centers),
        "active_cost_centers": _safe_count_filter(cost_centers, status="ACTIVE") if "status" in model_fields else 0,
        "group_cost_centers": _safe_count_filter(cost_centers, is_group=True) if "is_group" in model_fields else 0,
    }


def _build_periods_summary(periods, fiscal_years) -> dict[str, Any]:
    period_fields = _field_names(periods.model) if periods is not None else set()
    fiscal_fields = _field_names(fiscal_years.model) if fiscal_years is not None else set()

    return {
        "total_periods": safe_count(periods),
        "open_periods": _safe_count_filter(periods, status="OPEN") if periods is not None and "status" in period_fields else 0,
        "closed_periods": _safe_count_filter(periods, status="CLOSED") if periods is not None and "status" in period_fields else 0,
        "locked_periods": _safe_count_filter(periods, status="LOCKED") if periods is not None and "status" in period_fields else 0,
        "total_fiscal_years": safe_count(fiscal_years),
        "current_fiscal_years": (
            _safe_count_filter(fiscal_years, is_current=True)
            if fiscal_years is not None and "is_current" in fiscal_fields
            else 0
        ),
    }


def _build_tax_summary(tax_rates, tax_transactions) -> dict[str, Any]:
    tax_amount = _safe_sum_field(tax_transactions, "tax_amount", "amount")
    taxable_amount = _safe_sum_field(tax_transactions, "taxable_amount")

    return {
        "total_tax_rates": safe_count(tax_rates),
        "active_tax_rates": (
            _safe_count_filter(tax_rates, is_active=True)
            if tax_rates is not None and "is_active" in _field_names(tax_rates.model)
            else 0
        ),
        "default_tax_rates": (
            _safe_count_filter(tax_rates, is_default=True)
            if tax_rates is not None and "is_default" in _field_names(tax_rates.model)
            else 0
        ),
        "total_tax_transactions": safe_count(tax_transactions),
        "taxable_amount": _normalize_money(taxable_amount),
        "tax_amount": _normalize_money(tax_amount),
    }


def _serialize_entry_row(entry: Any) -> dict[str, Any]:
    return {
        "id": _safe_attr(entry, "id", None),
        "entry_number": (
            _safe_attr(entry, "entry_number", "")
            or _safe_attr(entry, "number", "")
            or _safe_attr(entry, "reference", "")
            or f"JE-{_safe_attr(entry, 'id', '')}"
        ),
        "date": _safe_iso(
            _safe_attr(entry, "entry_date", None)
            or _safe_attr(entry, "date", None)
            or _safe_attr(entry, "posting_date", None)
            or _safe_attr(entry, "created_at", None)
        ),
        "status": _safe_attr(entry, "status", ""),
        "currency": _safe_attr(entry, "currency", "SAR") or "SAR",
        "description": _safe_attr(entry, "description", "") or _safe_attr(entry, "notes", ""),
        "source_type": _safe_attr(entry, "source_type", "") or _safe_attr(entry, "posting_source", ""),
        "source_id": _safe_attr(entry, "source_id", ""),
        "source_number": _safe_attr(entry, "source_number", ""),
        "reference": _safe_attr(entry, "reference", "") or _safe_attr(entry, "external_reference", ""),
        "is_auto_posted": bool(_safe_attr(entry, "is_auto_posted", False)),
        "created_at": _safe_iso(_safe_attr(entry, "created_at", None)),
    }


def _latest_entries(entries, limit: int = 20) -> list[dict[str, Any]]:
    if entries is None:
        return []

    try:
        rows = list(entries.order_by("-id")[:limit])
    except Exception:
        return []

    return [_serialize_entry_row(entry) for entry in rows]


# ============================================================
# API
# ============================================================

@require_GET
def accounting_report(request):
    filters = common_filters_from_request(request)

    entries = _entry_queryset(filters)
    lines = _line_queryset(filters)
    accounts = _account_queryset()
    cost_centers = _cost_center_queryset()
    periods = _period_queryset()
    fiscal_years = _fiscal_year_queryset()
    tax_rates = _tax_rate_queryset()
    tax_transactions = _tax_transaction_queryset(filters)

    lines_summary = _build_lines_summary(lines)
    entries_summary = _build_entries_summary(entries)
    accounts_summary = _build_accounts_summary(accounts)
    cost_centers_summary = _build_cost_centers_summary(cost_centers)
    periods_summary = _build_periods_summary(periods, fiscal_years)
    tax_summary = _build_tax_summary(tax_rates, tax_transactions)

    summary = {
        **entries_summary,
        **lines_summary,
        **accounts_summary,
        **cost_centers_summary,
        **periods_summary,
        **tax_summary,
    }

    data = {
        "meta": report_meta("accounting", "تقرير المحاسبة", "Accounting Report"),
        "filters": filters,
        "summary": summary,
        "charts": {
            "entries_by_status": safe_group_count(entries, ["status", "entry_status"]),
            "entries_by_source": safe_group_count(entries, ["source_type", "posting_source"]),
            "entries_by_currency": safe_group_count(entries, ["currency"]),
            "lines_by_account": safe_group_count(lines, ["account_id", "account"]),
            "lines_by_cost_center": safe_group_count(lines, ["cost_center_id", "cost_center"]),
            "lines_by_party_type": safe_group_count(lines, ["party_type"]),
            "accounts_by_type": safe_group_count(accounts, ["account_type", "type"]),
            "accounts_by_level": safe_group_count(accounts, ["level"]),
            "cost_centers_by_status": safe_group_count(cost_centers, ["status"]),
            "periods_by_status": safe_group_count(periods, ["status"]),
            "taxes_by_direction": safe_group_count(tax_transactions, ["direction"]),
        },
        "breakdowns": {
            "debit_credit_by_account": _safe_group_sum(
                lines,
                "account_id",
                ["debit", "credit", "debit_amount", "credit_amount", "tax_amount"],
                limit=30,
            ),
            "debit_credit_by_cost_center": _safe_group_sum(
                lines,
                "cost_center_id",
                ["debit", "credit", "debit_amount", "credit_amount", "tax_amount"],
                limit=30,
            ),
            "tax_by_rate": _safe_group_sum(
                tax_transactions,
                "tax_rate_id",
                ["taxable_amount", "tax_amount", "amount"],
                limit=30,
            ),
        },
        "links": {
            "chart_of_accounts": "/system/accounting/accounts",
            "journal_entries": "/system/accounting/journals",
            "ledger": "/system/accounting/ledger",
            "trial_balance": "/system/accounting/trial-balance",
            "profit_loss": "/system/accounting/profit-loss",
            "balance_sheet": "/system/accounting/balance-sheet",
            "cost_centers": "/system/accounting/cost-centers",
            "taxes": "/system/accounting/taxes",
            "periods": "/system/accounting/periods",
        },
        "rows": _latest_entries(entries, limit=50),
    }

    return json_success(data)