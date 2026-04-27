# ============================================================
# 📂 api/invoices/list.py
# 🧠 Invoices API List — Primey Care
# ============================================================

from __future__ import annotations

import logging
from typing import Any

from django.apps import apps
from django.contrib.auth.decorators import login_required
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
    candidate_names = ["Invoice"]
    for model_name in candidate_names:
        try:
            return apps.get_model("invoices", model_name)
        except LookupError:
            continue
    raise LookupError("Invoice model was not found in invoices app.")


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


def _apply_company_scope(queryset, company_id: int | None):
    if not company_id:
        return queryset

    model_fields = {field.name for field in queryset.model._meta.fields}
    if "company" in model_fields:
        return queryset.filter(company_id=company_id)

    return queryset


def _serialize_invoice(invoice) -> dict[str, Any]:
    def _value(name: str, default=None):
        return getattr(invoice, name, default)

    return {
        "id": invoice.pk,
        "number": _value("number") or _value("invoice_number") or f"INV-{invoice.pk}",
        "status": _value("status"),
        "invoice_date": (
            (_value("invoice_date") or _value("issue_date") or _value("date")).isoformat()
            if (_value("invoice_date") or _value("issue_date") or _value("date"))
            else None
        ),
        "customer_id": _value("customer_id"),
        "order_id": _value("order_id"),
        "subtotal": str(_value("subtotal") or "0.00"),
        "tax_amount": str(_value("tax_amount") or _value("vat_amount") or "0.00"),
        "total_amount": str(
            _value("total_amount")
            or _value("grand_total")
            or _value("total")
            or "0.00"
        ),
    }


@login_required
@require_GET
def invoice_list_api(request):
    try:
        Invoice = _resolve_invoice_model()
        company_id = _extract_company_id(request)

        queryset = Invoice.objects.all().order_by("-id")
        queryset = _apply_company_scope(queryset, company_id)

        status_filter = request.GET.get("status")
        if status_filter and hasattr(Invoice, "status"):
            queryset = queryset.filter(status=status_filter)

        customer_id = request.GET.get("customer_id")
        if customer_id and "customer" in {f.name for f in Invoice._meta.fields}:
            queryset = queryset.filter(customer_id=customer_id)

        limit = request.GET.get("limit", "50")
        try:
            limit_value = max(1, min(int(limit), 200))
        except ValueError:
            limit_value = 50

        invoices = list(queryset[:limit_value])
        data = [_serialize_invoice(item) for item in invoices]

        return _json_success(
            {
                "count": len(data),
                "results": data,
            }
        )
    except Exception as exc:
        logger.exception("Failed to fetch invoice list: %s", exc)
        return _json_error("تعذر جلب قائمة الفواتير.", status=500)