# ============================================================
# 📂 api/reports/customers.py
# 🧠 Primey Care | Customers Report API
# ============================================================

from django.views.decorators.http import require_GET

from ._utils import (
    apply_date_filters,
    apply_exact_filter,
    common_filters_from_request,
    get_base_queryset,
    json_success,
    report_meta,
    safe_count,
    safe_group_count,
)


@require_GET
def customers_report(request):
    filters = common_filters_from_request(request)

    queryset = get_base_queryset("customers", "Customer")
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

    data = {
        "meta": report_meta("customers", "تقرير العملاء", "Customers Report"),
        "filters": filters,
        "summary": {
            "total_customers": safe_count(queryset),
            "active_customers": safe_count(
                queryset.filter(status__in=["active", "ACTIVE"])
                if queryset is not None and "status" in {f.name for f in queryset.model._meta.get_fields()}
                else None
            ),
        },
        "charts": {
            "by_status": safe_group_count(queryset, ["status", "customer_status"]),
            "by_source": safe_group_count(queryset, ["source", "registration_source"]),
        },
        "rows": rows,
    }

    return json_success(data)