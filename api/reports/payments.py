# ============================================================
# 📂 api/reports/payments.py
# 🧠 Primey Care | Payments Report API
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
def payments_report(request):
    filters = common_filters_from_request(request)

    queryset = get_base_queryset("payments", "Payment")
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
        queryset = apply_exact_filter(
            queryset,
            model,
            "payment_method",
            filters.get("payment_method"),
        )

        try:
            rows = list(queryset.order_by("-id").values()[:100])
        except Exception:
            rows = []

    total_amount = safe_sum(
        queryset,
        ["amount", "paid_amount", "total_amount", "net_amount"],
    )

    data = {
        "meta": report_meta("payments", "تقرير المدفوعات", "Payments Report"),
        "filters": filters,
        "summary": {
            "total_payments": safe_count(queryset),
            "total_amount": normalize_money(total_amount),
        },
        "charts": {
            "by_status": safe_group_count(queryset, ["status", "payment_status"]),
            "by_method": safe_group_count(
                queryset,
                ["payment_method", "method", "payment_type", "gateway"],
            ),
        },
        "rows": rows,
    }

    return json_success(data)