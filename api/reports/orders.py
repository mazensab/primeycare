# ============================================================
# 📂 api/reports/orders.py
# 🧠 Primey Care | Orders Report API
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
def orders_report(request):
    filters = common_filters_from_request(request)

    queryset = get_base_queryset("orders", "Order")
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

    data = {
        "meta": report_meta("orders", "تقرير الطلبات", "Orders Report"),
        "filters": filters,
        "summary": {
            "total_orders": safe_count(queryset),
            "total_amount": normalize_money(total_amount),
        },
        "charts": {
            "by_status": safe_group_count(queryset, ["status", "order_status"]),
            "by_payment_status": safe_group_count(queryset, ["payment_status"]),
            "by_fulfillment_status": safe_group_count(queryset, ["fulfillment_status"]),
        },
        "rows": rows,
    }

    return json_success(data)