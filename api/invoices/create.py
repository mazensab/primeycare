# ============================================================
# 📂 api/invoices/create.py
# 🧠 Create Invoice API — Primey Care
# ------------------------------------------------------------
# ✅ إنشاء فاتورة من الطلب
# ✅ منع تكرار الفاتورة لنفس الطلب
# ✅ اختيار إصدار مباشر اختياري
# ✅ ربط مع invoices.services.create_invoice_from_order
# ============================================================

from __future__ import annotations

import json
import logging
from datetime import datetime
from decimal import Decimal
from typing import Any

from django.apps import apps
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from invoices.models import InvoiceStatus, InvoiceType
from invoices.services import (
    InvoiceServiceError,
    InvoiceValidationError,
    create_invoice_from_order,
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


def _parse_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default

    if isinstance(value, bool):
        return value

    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y", "on"}

    return bool(value)


def _parse_date(value: Any):
    if not value:
        return None

    if hasattr(value, "isoformat"):
        return value

    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date()
    except ValueError:
        raise InvoiceValidationError("صيغة التاريخ غير صحيحة. استخدم YYYY-MM-DD.")


def _parse_decimal(value: Any, default: str = "15.00") -> Decimal:
    if value in (None, ""):
        return Decimal(default)

    try:
        return Decimal(str(value))
    except Exception as exc:
        raise InvoiceValidationError("قيمة الضريبة غير صحيحة.") from exc


def _resolve_order_model():
    try:
        return apps.get_model("orders", "Order")
    except LookupError as exc:
        raise LookupError("Order model was not found in orders app.") from exc


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
        "invoice_type": getattr(invoice, "invoice_type", None),
        "status": getattr(invoice, "status", None),
        "issue_date": (
            getattr(invoice, "issue_date", None).isoformat()
            if getattr(invoice, "issue_date", None)
            else None
        ),
        "due_date": (
            getattr(invoice, "due_date", None).isoformat()
            if getattr(invoice, "due_date", None)
            else None
        ),
        "order_id": getattr(invoice, "order_id", None),
        "customer_id": getattr(invoice, "customer_id", None),
        "subtotal": _decimal_to_str(getattr(invoice, "subtotal", None)),
        "discount_amount": _decimal_to_str(getattr(invoice, "discount_amount", None)),
        "taxable_amount": _decimal_to_str(getattr(invoice, "taxable_amount", None)),
        "tax_rate": _decimal_to_str(getattr(invoice, "tax_rate", None)),
        "tax_amount": _decimal_to_str(getattr(invoice, "tax_amount", None)),
        "total_amount": _decimal_to_str(getattr(invoice, "total_amount", None)),
        "paid_amount": _decimal_to_str(getattr(invoice, "paid_amount", None)),
        "due_amount": _decimal_to_str(getattr(invoice, "due_amount", None)),
        "currency": getattr(invoice, "currency", "SAR") or "SAR",
    }


@login_required
@require_POST
def create_invoice_api(request):
    try:
        body = _parse_json_body(request)

        order_id = body.get("order_id") or request.POST.get("order_id")
        if not order_id:
            return _json_error("order_id مطلوب لإنشاء الفاتورة.", status=400)

        Order = _resolve_order_model()

        order = Order.objects.filter(pk=order_id).first()
        if not order:
            return _json_error("الطلب غير موجود.", status=404)

        invoice_type = body.get("invoice_type") or InvoiceType.SALES
        if invoice_type not in InvoiceType.values:
            return _json_error("نوع الفاتورة غير صحيح.", status=400)

        status = body.get("status") or InvoiceStatus.DRAFT
        if status not in InvoiceStatus.values:
            return _json_error("حالة الفاتورة غير صحيحة.", status=400)

        issue_date = _parse_date(body.get("issue_date"))
        due_date = _parse_date(body.get("due_date"))
        tax_rate = _parse_decimal(body.get("tax_rate"), default="15.00")
        notes = str(body.get("notes") or "")
        internal_notes = str(body.get("internal_notes") or "")

        sync_items = _parse_bool(body.get("sync_items"), default=True)
        issue_immediately = _parse_bool(body.get("issue_immediately"), default=False)
        auto_post_accounting = _parse_bool(body.get("auto_post_accounting"), default=True)

        result = create_invoice_from_order(
            order=order,
            actor=request.user,
            invoice_type=invoice_type,
            status=status,
            issue_date=issue_date,
            due_date=due_date,
            tax_rate=tax_rate,
            notes=notes,
            internal_notes=internal_notes,
            sync_items=sync_items,
            issue_immediately=issue_immediately,
            auto_post_accounting=auto_post_accounting,
        )

        result.invoice.refresh_from_db()

        return _json_success(
            {
                "message": result.message,
                "created": result.created,
                "invoice": _serialize_invoice(result.invoice),
            },
            status=201 if result.created else 200,
        )

    except InvoiceValidationError as exc:
        return _json_error(str(exc), status=400)

    except InvoiceServiceError as exc:
        return _json_error(str(exc), status=400)

    except Exception as exc:
        logger.exception("Failed to create invoice: %s", exc)
        return _json_error("تعذر إنشاء الفاتورة.", status=500)