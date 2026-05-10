# ============================================================
# 📂 api/invoices/issue.py
# 🧠 Issue Invoice API — Primey Care V2
# ------------------------------------------------------------
# ✅ إصدار فاتورة
# ✅ يستدعي invoices.services.issue_invoice الرسمي فقط
# ✅ لا يعدّل حالة الفاتورة مباشرة داخل API
# ✅ لا يحول الفاتورة إلى PAID أثناء الإصدار
# ✅ جدولة الترحيل المحاسبي بعد commit
# ✅ متوافق مع Accounting Backend الجديد
# ✅ استجابة موحدة للواجهة: ok / success / data
# ============================================================

from __future__ import annotations

import json
import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.apps import apps
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from invoices.services import (
    InvoicePostingError,
    InvoiceServiceError,
    InvoiceValidationError,
    issue_invoice,
)


logger = logging.getLogger(__name__)


# ============================================================
# JSON Helpers
# ============================================================

def _decimal_to_string(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)

    if isinstance(value, dict):
        return {key: _decimal_to_string(val) for key, val in value.items()}

    if isinstance(value, list):
        return [_decimal_to_string(item) for item in value]

    if isinstance(value, tuple):
        return tuple(_decimal_to_string(item) for item in value)

    return value


def _json_error(
    message: str,
    *,
    status: int = 400,
    errors: Any = None,
) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": False,
        "success": False,
        "message": message,
    }

    if errors is not None:
        payload["errors"] = _decimal_to_string(errors)

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


def _json_success(
    data: dict[str, Any],
    *,
    message: str = "تم تنفيذ العملية بنجاح.",
    status: int = 200,
) -> JsonResponse:
    return JsonResponse(
        {
            "ok": True,
            "success": True,
            "message": message,
            "data": _decimal_to_string(data),
        },
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


# ============================================================
# Safe Helpers
# ============================================================

def _resolve_invoice_model():
    try:
        return apps.get_model("invoices", "Invoice")
    except LookupError as exc:
        raise LookupError("Invoice model was not found in invoices app.") from exc


def _parse_json_body(request) -> dict[str, Any]:
    if not request.body:
        return {}

    try:
        parsed = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise ValidationError("صيغة JSON غير صحيحة.") from exc

    if not isinstance(parsed, dict):
        raise ValidationError("جسم الطلب يجب أن يكون JSON Object.")

    return parsed


def _extract_company_id(request) -> int | None:
    raw_value = (
        request.GET.get("company_id")
        or request.headers.get("X-Company-Id")
        or request.session.get("active_company_id")
    )

    if raw_value in {None, ""}:
        return None

    try:
        parsed = int(raw_value)
    except (TypeError, ValueError):
        return None

    return parsed if parsed > 0 else None


def _parse_bool(value: Any, default: bool = True) -> bool:
    if value in {None, ""}:
        return default

    if isinstance(value, bool):
        return value

    normalized = str(value).strip().lower()

    if normalized in {"1", "true", "yes", "y", "on"}:
        return True

    if normalized in {"0", "false", "no", "n", "off"}:
        return False

    return default


def _money(value: Any) -> Decimal:
    try:
        return Decimal(str(value or "0.00")).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )
    except Exception:
        return Decimal("0.00")


def _iso_date(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _safe_attr(obj: Any, attr_name: str, default: Any = None) -> Any:
    try:
        return getattr(obj, attr_name, default)
    except Exception:
        return default


def _serialize_customer(customer) -> dict[str, Any] | None:
    if not customer:
        return None

    return {
        "id": _safe_attr(customer, "id", None),
        "name": (
            _safe_attr(customer, "full_name", "")
            or _safe_attr(customer, "name", "")
            or _safe_attr(customer, "display_name", "")
        ),
        "phone": _safe_attr(customer, "phone", ""),
        "email": _safe_attr(customer, "email", ""),
    }


def _serialize_order(order) -> dict[str, Any] | None:
    if not order:
        return None

    return {
        "id": _safe_attr(order, "id", None),
        "order_number": (
            _safe_attr(order, "order_number", "")
            or _safe_attr(order, "number", "")
            or _safe_attr(order, "code", "")
        ),
        "status": _safe_attr(order, "status", ""),
        "total_amount": _safe_attr(order, "total_amount", None),
    }


def _serialize_invoice(invoice) -> dict[str, Any]:
    invoice_number = (
        _safe_attr(invoice, "invoice_number", "")
        or _safe_attr(invoice, "number", "")
        or f"INV-{invoice.pk}"
    )

    return {
        "id": invoice.pk,
        "invoice_number": invoice_number,
        "number": invoice_number,
        "invoice_type": _safe_attr(invoice, "invoice_type", ""),
        "status": _safe_attr(invoice, "status", ""),
        "issue_date": _iso_date(_safe_attr(invoice, "issue_date", None)),
        "due_date": _iso_date(_safe_attr(invoice, "due_date", None)),
        "order_id": _safe_attr(invoice, "order_id", None),
        "order": _serialize_order(_safe_attr(invoice, "order", None)),
        "customer_id": _safe_attr(invoice, "customer_id", None),
        "customer": _serialize_customer(_safe_attr(invoice, "customer", None)),
        "subtotal": _money(_safe_attr(invoice, "subtotal", "0.00")),
        "discount_amount": _money(_safe_attr(invoice, "discount_amount", "0.00")),
        "taxable_amount": _money(_safe_attr(invoice, "taxable_amount", "0.00")),
        "tax_rate": _money(_safe_attr(invoice, "tax_rate", "0.00")),
        "tax_amount": _money(_safe_attr(invoice, "tax_amount", "0.00")),
        "total_amount": _money(_safe_attr(invoice, "total_amount", "0.00")),
        "paid_amount": _money(_safe_attr(invoice, "paid_amount", "0.00")),
        "due_amount": _money(_safe_attr(invoice, "due_amount", "0.00")),
        "currency": _safe_attr(invoice, "currency", "SAR") or "SAR",
        "notes": _safe_attr(invoice, "notes", ""),
        "internal_notes": _safe_attr(invoice, "internal_notes", ""),
        "accounting": {
            "is_accounting_posted": bool(_safe_attr(invoice, "is_accounting_posted", False)),
            "accounting_entry_reference": _safe_attr(invoice, "accounting_entry_reference", ""),
            "posted_at": _iso_datetime(_safe_attr(invoice, "posted_at", None)),
        },
        "created_at": _iso_datetime(_safe_attr(invoice, "created_at", None)),
        "updated_at": _iso_datetime(_safe_attr(invoice, "updated_at", None)),
    }


def _serialize_result_flags(result) -> dict[str, Any]:
    return {
        "transition": {
            "status_before": _safe_attr(result, "status_before", None),
            "status_after": _safe_attr(result, "status_after", None),
        },
        "accounting": {
            "requested": bool(_safe_attr(result, "accounting_post_requested", False)),
            "dispatched": bool(_safe_attr(result, "accounting_post_dispatched", False)),
            "message": _safe_attr(result, "accounting_post_message", ""),
        },
    }


def _build_invoice_queryset(Invoice, request):
    queryset = Invoice.objects.select_related(
        "customer",
        "order",
    ).all()

    company_id = _extract_company_id(request)
    model_fields = {field.name for field in Invoice._meta.fields}

    if company_id and "company" in model_fields:
        queryset = queryset.filter(company_id=company_id)

    return queryset


# ============================================================
# API
# ============================================================

@login_required
@require_POST
def issue_invoice_api(request, invoice_id: int):
    """
    إصدار الفاتورة رسميًا.

    Body اختياري:
    {
      "auto_post_accounting": true
    }

    مبدأ مهم:
    - الإصدار لا يعني الدفع.
    - الدفع يتم من payments لاحقًا.
    """
    try:
        Invoice = _resolve_invoice_model()
        body = _parse_json_body(request)

        invoice = _build_invoice_queryset(Invoice, request).filter(pk=invoice_id).first()

        if not invoice:
            return _json_error("الفاتورة غير موجودة.", status=404)

        auto_post_accounting = _parse_bool(
            body.get("auto_post_accounting"),
            default=True,
        )

        result = issue_invoice(
            invoice=invoice,
            actor=request.user,
            auto_post_accounting=auto_post_accounting,
        )

        result.invoice.refresh_from_db()

        flags = _serialize_result_flags(result)

        return _json_success(
            {
                "invoice": _serialize_invoice(result.invoice),
                "transition": flags["transition"],
                "accounting": flags["accounting"],
            },
            message="تم إصدار الفاتورة بنجاح.",
        )

    except ValidationError as exc:
        logger.warning(
            "Invalid invoice issue request %s: %s",
            invoice_id,
            exc,
        )
        return _json_error(
            "بيانات الطلب غير صحيحة.",
            status=400,
            errors=getattr(exc, "message_dict", None) or getattr(exc, "messages", None) or str(exc),
        )

    except InvoiceValidationError as exc:
        logger.warning(
            "Invoice validation error while issuing invoice %s: %s",
            invoice_id,
            exc,
        )
        return _json_error(str(exc), status=400)

    except InvoicePostingError as exc:
        logger.exception(
            "Invoice posting error while issuing invoice %s: %s",
            invoice_id,
            exc,
        )
        return _json_error(
            "تمت محاولة إصدار الفاتورة لكن فشل الترحيل المحاسبي.",
            status=500,
        )

    except InvoiceServiceError as exc:
        logger.warning(
            "Invoice service error while issuing invoice %s: %s",
            invoice_id,
            exc,
        )
        return _json_error(str(exc), status=400)

    except Exception as exc:
        logger.exception("Failed to issue invoice %s: %s", invoice_id, exc)
        return _json_error("تعذر إصدار الفاتورة.", status=500)