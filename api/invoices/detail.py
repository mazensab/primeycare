# ============================================================
# 📂 api/invoices/detail.py
# 🧠 Invoice Detail API — Primey Care
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
    for model_name in ["Invoice"]:
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
        "issued_at": _value("issued_at").isoformat() if _value("issued_at") else None,
        "customer_id": _value("customer_id"),
        "order_id": _value("order_id"),
        "company_id": _value("company_id"),
        "subtotal": str(_value("subtotal") or "0.00"),
        "tax_amount": str(_value("tax_amount") or _value("vat_amount") or "0.00"),
        "discount_amount": str(_value("discount_amount") or "0.00"),
        "total_amount": str(
            _value("total_amount")
            or _value("grand_total")
            or _value("total")
            or "0.00"
        ),
        "notes": _value("notes"),
        "created_at": _value("created_at").isoformat() if _value("created_at") else None,
        "updated_at": _value("updated_at").isoformat() if _value("updated_at") else None,
    }


@login_required
@require_GET
def invoice_detail_api(request, invoice_id: int):
    try:
        Invoice = _resolve_invoice_model()
        company_id = _extract_company_id(request)

        queryset = Invoice.objects.all()
        model_fields = {field.name for field in Invoice._meta.fields}

        if company_id and "company" in model_fields:
            queryset = queryset.filter(company_id=company_id)

        invoice = queryset.filter(pk=invoice_id).first()
        if not invoice:
            return _json_error("الفاتورة غير موجودة.", status=404)

        return _json_success({"invoice": _serialize_invoice(invoice)})
    except Exception as exc:
        logger.exception("Failed to fetch invoice detail: %s", exc)
        return _json_error("تعذر جلب تفاصيل الفاتورة.", status=500)