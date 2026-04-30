# ============================================================
# 📂 api/reports/overview.py
# 🧠 Primey Care | Reports Overview API
# ============================================================

from django.views.decorators.http import require_GET

from ._utils import (
    get_base_queryset,
    json_success,
    normalize_money,
    report_meta,
    safe_count,
    safe_sum,
)


@require_GET
def reports_overview(request):
    customers = get_base_queryset("customers", "Customer")
    providers = get_base_queryset("providers", "Provider")
    orders = get_base_queryset("orders", "Order")
    invoices = get_base_queryset("invoices", "Invoice")
    payments = get_base_queryset("payments", "Payment")

    orders_total = safe_sum(
        orders,
        ["total_amount", "grand_total", "amount", "net_amount", "subtotal"],
    )
    invoices_total = safe_sum(
        invoices,
        ["total_amount", "grand_total", "amount", "net_amount", "subtotal"],
    )
    payments_total = safe_sum(
        payments,
        ["amount", "paid_amount", "total_amount", "net_amount"],
    )

    data = {
        "meta": report_meta("overview", "لوحة التقارير", "Reports Overview"),
        "summary": {
            "customers_count": safe_count(customers),
            "providers_count": safe_count(providers),
            "orders_count": safe_count(orders),
            "invoices_count": safe_count(invoices),
            "payments_count": safe_count(payments),
            "orders_total": normalize_money(orders_total),
            "invoices_total": normalize_money(invoices_total),
            "payments_total": normalize_money(payments_total),
        },
        "modules": [
            {
                "key": "customers",
                "title_ar": "تقارير العملاء",
                "title_en": "Customers Reports",
                "href": "/system/reports/customers",
                "api": "/api/reports/customers/",
            },
            {
                "key": "providers",
                "title_ar": "تقارير المراكز",
                "title_en": "Providers Reports",
                "href": "/system/reports/providers",
                "api": "/api/reports/providers/",
            },
            {
                "key": "orders",
                "title_ar": "تقارير الطلبات",
                "title_en": "Orders Reports",
                "href": "/system/reports/orders",
                "api": "/api/reports/orders/",
            },
            {
                "key": "invoices",
                "title_ar": "تقارير الفواتير",
                "title_en": "Invoices Reports",
                "href": "/system/reports/invoices",
                "api": "/api/reports/invoices/",
            },
            {
                "key": "payments",
                "title_ar": "تقارير المدفوعات",
                "title_en": "Payments Reports",
                "href": "/system/reports/payments",
                "api": "/api/reports/payments/",
            },
            {
                "key": "accounting",
                "title_ar": "تقارير المحاسبة",
                "title_en": "Accounting Reports",
                "href": "/system/reports/accounting",
                "api": "/api/reports/accounting/",
            },
        ],
    }

    return json_success(data)