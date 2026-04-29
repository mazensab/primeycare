# ============================================================
# 📂 api/invoices/reports.py
# 🧠 Invoice Reports API — Primey Care
# ------------------------------------------------------------
# ✅ تقارير الفواتير
# ✅ إجماليات مالية
# ✅ توزيع حسب الحالة
# ✅ توزيع حسب النوع
# ✅ مناسب لصفحة /system/invoices/reports
# ============================================================

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

from django.apps import apps
from django.contrib.auth.decorators import login_required
from django.db.models import Count, Sum
from django.http import JsonResponse
from django.views.decorators.http import require_GET

logger = logging.getLogger(__name__)


def _json_error(message: str, status: int = 400) -> JsonResponse:
    return JsonResponse({"ok": False, "message": message}, status=status)


def _json_success(data: dict[str, Any], status: int = 200) -> JsonResponse:
    payload = {"ok": True}
    payload.update(data)
    return JsonResponse(payload, status=status)


def _resolve_invoice_model():
    try:
        return apps.get_model("invoices", "Invoice")
    except LookupError as exc:
        raise LookupError("Invoice model was not found in invoices app.") from exc


def _extract_company_id(request) -> int | None:
    raw_value = (
        request.GET.get("company_id")
        or request.headers.get("X-Company-Id")
        or request.session.get("active_company_id")
    )
    try:
        return int(raw_value) if raw_value else None
    except (TypeError, ValueError):
        return None


def _decimal_to_str(value) -> str:
    try:
        return str(Decimal(str(value or "0.00")).quantize(Decimal("0.01")))
    except Exception:
        return "0.00"


def _apply_filters(request, queryset):
    company_id = _extract_company_id(request)
    model_fields = {field.name for field in queryset.model._meta.fields}

    if company_id and "company" in model_fields:
        queryset = queryset.filter(company_id=company_id)

    status_filter = request.GET.get("status")
    if status_filter:
        queryset = queryset.filter(status=status_filter)

    invoice_type = request.GET.get("invoice_type")
    if invoice_type:
        queryset = queryset.filter(invoice_type=invoice_type)

    customer_id = request.GET.get("customer_id")
    if customer_id:
        queryset = queryset.filter(customer_id=customer_id)

    order_id = request.GET.get("order_id")
    if order_id:
        queryset = queryset.filter(order_id=order_id)

    date_from = request.GET.get("date_from")
    if date_from:
        queryset = queryset.filter(issue_date__gte=date_from)

    date_to = request.GET.get("date_to")
    if date_to:
        queryset = queryset.filter(issue_date__lte=date_to)

    return queryset


def _group_to_list(rows, key_name: str) -> list[dict[str, Any]]:
    data = []

    for row in rows:
        data.append(
            {
                key_name: row.get(key_name) or "UNKNOWN",
                "count": row.get("count") or 0,
                "subtotal": _decimal_to_str(row.get("subtotal")),
                "tax_amount": _decimal_to_str(row.get("tax_amount")),
                "total_amount": _decimal_to_str(row.get("total_amount")),
                "paid_amount": _decimal_to_str(row.get("paid_amount")),
                "due_amount": _decimal_to_str(row.get("due_amount")),
            }
        )

    return data


@login_required
@require_GET
def invoice_reports_api(request):
    try:
        Invoice = _resolve_invoice_model()

        queryset = Invoice.objects.all()
        queryset = _apply_filters(request, queryset)

        totals = queryset.aggregate(
            count=Count("id"),
            subtotal=Sum("subtotal"),
            discount_amount=Sum("discount_amount"),
            taxable_amount=Sum("taxable_amount"),
            tax_amount=Sum("tax_amount"),
            total_amount=Sum("total_amount"),
            paid_amount=Sum("paid_amount"),
            due_amount=Sum("due_amount"),
        )

        by_status_rows = (
            queryset.values("status")
            .annotate(
                count=Count("id"),
                subtotal=Sum("subtotal"),
                tax_amount=Sum("tax_amount"),
                total_amount=Sum("total_amount"),
                paid_amount=Sum("paid_amount"),
                due_amount=Sum("due_amount"),
            )
            .order_by("status")
        )

        by_type_rows = (
            queryset.values("invoice_type")
            .annotate(
                count=Count("id"),
                subtotal=Sum("subtotal"),
                tax_amount=Sum("tax_amount"),
                total_amount=Sum("total_amount"),
                paid_amount=Sum("paid_amount"),
                due_amount=Sum("due_amount"),
            )
            .order_by("invoice_type")
        )

        recent_invoices = list(
            queryset.select_related("customer", "order")
            .order_by("-created_at", "-id")[:10]
        )

        recent = []
        for invoice in recent_invoices:
            recent.append(
                {
                    "id": invoice.pk,
                    "invoice_number": getattr(invoice, "invoice_number", None) or f"INV-{invoice.pk}",
                    "status": getattr(invoice, "status", None),
                    "invoice_type": getattr(invoice, "invoice_type", None),
                    "customer_name": getattr(getattr(invoice, "customer", None), "name", "") or "",
                    "issue_date": (
                        getattr(invoice, "issue_date", None).isoformat()
                        if getattr(invoice, "issue_date", None)
                        else None
                    ),
                    "total_amount": _decimal_to_str(getattr(invoice, "total_amount", None)),
                    "paid_amount": _decimal_to_str(getattr(invoice, "paid_amount", None)),
                    "due_amount": _decimal_to_str(getattr(invoice, "due_amount", None)),
                    "currency": getattr(invoice, "currency", "SAR") or "SAR",
                }
            )

        return _json_success(
            {
                "summary": {
                    "count": totals.get("count") or 0,
                    "subtotal": _decimal_to_str(totals.get("subtotal")),
                    "discount_amount": _decimal_to_str(totals.get("discount_amount")),
                    "taxable_amount": _decimal_to_str(totals.get("taxable_amount")),
                    "tax_amount": _decimal_to_str(totals.get("tax_amount")),
                    "total_amount": _decimal_to_str(totals.get("total_amount")),
                    "paid_amount": _decimal_to_str(totals.get("paid_amount")),
                    "due_amount": _decimal_to_str(totals.get("due_amount")),
                    "currency": "SAR",
                },
                "by_status": _group_to_list(by_status_rows, "status"),
                "by_type": _group_to_list(by_type_rows, "invoice_type"),
                "recent": recent,
            }
        )

    except Exception as exc:
        logger.exception("Failed to fetch invoice reports: %s", exc)
        return _json_error("تعذر جلب تقارير الفواتير.", status=500)