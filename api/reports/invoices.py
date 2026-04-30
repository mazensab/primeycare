# ============================================================
# 📂 api/reports/invoices.py
# 🧠 Primey Care | Invoices Report API
# ============================================================

from django.views.decorators.http import require_GET

from ._utils import (
    apply_date_filters,
    apply_exact_filter,
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
def invoices_report(request):
    filters = common_filters_from_request(request)

    queryset = get_base_queryset("invoices", "Invoice")
    rows = []

    if queryset is not None:
        model = queryset.model
        queryset = apply_date_filters(
            queryset,
            model,
            filters.get("date_from"),
            filters.get("date_to"),
        )
        queryset = apply_exact_filter(queryset, model, "status", filters.get("status"))

        try:
            rows = list(queryset.order_by("-id").values()[:100])
        except Exception:
            rows = []

    total_amount = safe_sum(
        queryset,
        ["total_amount", "grand_total", "amount", "net_amount", "subtotal"],
    )
    paid_amount = safe_sum(
        queryset,
        ["paid_amount", "amount_paid", "collected_amount"],
    )
    tax_amount = safe_sum(
        queryset,
        ["tax_amount", "vat_amount", "total_tax"],
    )

    data = {
        "meta": report_meta("invoices", "تقرير الفواتير", "Invoices Report"),
        "filters": filters,
        "summary": {
            "total_invoices": safe_count(queryset),
            "total_amount": normalize_money(total_amount),
            "paid_amount": normalize_money(paid_amount),
            "tax_amount": normalize_money(tax_amount),
            "remaining_amount": normalize_money(total_amount - paid_amount),
        },
        "charts": {
            "by_status": safe_group_count(queryset, ["status", "invoice_status"]),
        },
        "rows": rows,
    }

    return json_success(data)