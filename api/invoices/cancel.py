# ============================================================
# 📂 api/invoices/cancel.py
# 🧠 Cancel Invoice API — Primey Care
# ------------------------------------------------------------
# ✅ إلغاء آمن للفاتورة
# ✅ لا يحذف الفاتورة
# ✅ يمنع إلغاء الفواتير المدفوعة
# ============================================================

from __future__ import annotations

import json
import logging
from decimal import Decimal
from typing import Any

from django.apps import apps
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from invoices.services import (
    InvoiceServiceError,
    InvoiceValidationError,
    cancel_invoice,
)

logger = logging.getLogger(__name__)


def _json_error(message: str, status: int = 400, *, details: Any = None) -> JsonResponse:
    payload: dict[str, Any] = {"ok": False, "message": message}
    if details is not None:
        payload["details"] = details
    return JsonResponse(payload, status=status)


def _json_success(data: dict[str, Any], status: int = 200) -> JsonResponse:
    payload = {"ok": True}
    payload.update(data)
    return JsonResponse(payload, status=status)


def _parse_json_body(request) -> dict[str, Any]:
    if not request.body:
        return {}

    try:
        return json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return {}


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


def _serialize_invoice(invoice) -> dict[str, Any]:
    return {
        "id": invoice.pk,
        "invoice_number": getattr(invoice, "invoice_number", None) or f"INV-{invoice.pk}",
        "number": getattr(invoice, "invoice_number", None) or f"INV-{invoice.pk}",
        "status": getattr(invoice, "status", None),
        "order_id": getattr(invoice, "order_id", None),
        "customer_id": getattr(invoice, "customer_id", None),
        "total_amount": _decimal_to_str(getattr(invoice, "total_amount", None)),
        "paid_amount": _decimal_to_str(getattr(invoice, "paid_amount", None)),
        "due_amount": _decimal_to_str(getattr(invoice, "due_amount", None)),
        "currency": getattr(invoice, "currency", "SAR") or "SAR",
    }


@login_required
@require_POST
def cancel_invoice_api(request, invoice_id: int):
    try:
        Invoice = _resolve_invoice_model()
        company_id = _extract_company_id(request)
        body = _parse_json_body(request)

        queryset = Invoice.objects.select_related("customer", "order").all()
        model_fields = {field.name for field in Invoice._meta.fields}

        if company_id and "company" in model_fields:
            queryset = queryset.filter(company_id=company_id)

        invoice = queryset.filter(pk=invoice_id).first()
        if not invoice:
            return _json_error("الفاتورة غير موجودة.", status=404)

        reason = str(body.get("reason") or "").strip()

        result = cancel_invoice(
            invoice=invoice,
            actor=request.user,
            reason=reason,
        )

        result.invoice.refresh_from_db()

        return _json_success(
            {
                "message": result.message,
                "invoice": _serialize_invoice(result.invoice),
                "transition": {
                    "status_before": result.status_before,
                    "status_after": result.status_after,
                },
            }
        )

    except InvoiceValidationError as exc:
        return _json_error(str(exc), status=400)

    except InvoiceServiceError as exc:
        return _json_error(str(exc), status=400)

    except Exception as exc:
        logger.exception("Failed to cancel invoice %s: %s", invoice_id, exc)
        return _json_error("تعذر إلغاء الفاتورة.", status=500)