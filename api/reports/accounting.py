# ============================================================
# 📂 api/reports/accounting.py
# 🧠 Primey Care | Accounting Report API
# ============================================================

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
    safe_sum,
)


@require_GET
def accounting_report(request):
    filters = common_filters_from_request(request)

    entries = (
        get_base_queryset("accounting", "JournalEntry")
        or get_base_queryset("accounting", "AccountingEntry")
        or get_base_queryset("accounting", "Entry")
    )

    lines = (
        get_base_queryset("accounting", "JournalEntryLine")
        or get_base_queryset("accounting", "AccountingEntryLine")
        or get_base_queryset("accounting", "EntryLine")
    )

    entry_rows = []

    if entries is not None:
        entries = apply_date_filters(
            entries,
            entries.model,
            filters.get("date_from"),
            filters.get("date_to"),
        )

        try:
            entry_rows = list(entries.order_by("-id").values()[:100])
        except Exception:
            entry_rows = []

    debit_total = safe_sum(lines, ["debit", "debit_amount"])
    credit_total = safe_sum(lines, ["credit", "credit_amount"])

    data = {
        "meta": report_meta("accounting", "تقرير المحاسبة", "Accounting Report"),
        "filters": filters,
        "summary": {
            "total_entries": safe_count(entries),
            "total_lines": safe_count(lines),
            "total_debit": normalize_money(debit_total),
            "total_credit": normalize_money(credit_total),
            "difference": normalize_money(debit_total - credit_total),
        },
        "charts": {
            "entries_by_status": safe_group_count(entries, ["status", "entry_status"]),
            "lines_by_account": safe_group_count(lines, ["account_id", "account"]),
        },
        "links": {
            "ledger": "/system/accounting/ledger",
            "trial_balance": "/system/accounting/trial-balance",
            "profit_loss": "/system/accounting/profit-loss",
            "balance_sheet": "/system/accounting/balance-sheet",
        },
        "rows": entry_rows,
    }

    return json_success(data)