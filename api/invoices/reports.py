# ============================================================
# 📂 api/invoices/reports.py
# 🧠 Invoice Reports API — Primey Care V2
# ------------------------------------------------------------
# ✅ تقارير الفواتير
# ✅ إجماليات مالية
# ✅ توزيع حسب الحالة
# ✅ توزيع حسب النوع
# ✅ توزيع حسب الترحيل المحاسبي
# ✅ أحدث الفواتير مع العميل والطلب
# ✅ فلاتر موحدة حسب التاريخ / العميل / الطلب / الحالة
# ✅ Unified response: ok / success / data
# ✅ Compatible with Accounting / Payments / Treasury flow
# ============================================================

from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.apps import apps
from django.contrib.auth.decorators import login_required
from django.db.models import Count, Q, Sum
from django.http import JsonResponse
from django.views.decorators.http import require_GET


logger = logging.getLogger(__name__)


# ============================================================
# JSON Helpers
# ============================================================

def _decimal_to_string(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

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
    extra: dict[str, Any] | None = None,
) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": True,
        "success": True,
        "message": message,
        "data": _decimal_to_string(data),
    }

    if extra:
        payload.update(_decimal_to_string(extra))

    return JsonResponse(
        payload,
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


def _model_field_names(model) -> set[str]:
    return {field.name for field in model._meta.fields}


def _clean_str(value: Any, default: str = "") -> str:
    if value is None:
        return default

    cleaned = str(value).strip()
    return cleaned if cleaned else default


def _to_bool(value: Any, default: bool | None = None) -> bool | None:
    if value in (None, ""):
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
    if value is None:
        value = "0.00"

    try:
        return Decimal(str(value)).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )
    except Exception:
        return Decimal("0.00")


def _percentage(part: Any, total: Any) -> Decimal:
    total_value = Decimal(str(total or 0))

    if total_value <= Decimal("0"):
        return Decimal("0.00")

    return _money(Decimal(str(part or 0)) * Decimal("100.00") / total_value)


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


def _related_name(obj: Any) -> str:
    if not obj:
        return ""

    return (
        _safe_attr(obj, "display_name", "")
        or _safe_attr(obj, "full_name", "")
        or _safe_attr(obj, "name", "")
        or _safe_attr(obj, "title", "")
        or _safe_attr(obj, "invoice_number", "")
        or _safe_attr(obj, "order_number", "")
        or str(obj)
    )


# ============================================================
# Query Helpers
# ============================================================

def _base_queryset(Invoice, request):
    queryset = Invoice.objects.select_related(
        "customer",
        "order",
    ).all()

    company_id = _extract_company_id(request)
    model_fields = _model_field_names(Invoice)

    if company_id and "company" in model_fields:
        queryset = queryset.filter(company_id=company_id)

    return queryset


def _apply_filters(request, queryset):
    model_fields = _model_field_names(queryset.model)

    status_filter = _clean_str(request.GET.get("status"))
    invoice_type = _clean_str(request.GET.get("invoice_type"))
    customer_id = _clean_str(request.GET.get("customer_id"))
    order_id = _clean_str(request.GET.get("order_id"))

    date_from = _clean_str(request.GET.get("date_from"))
    date_to = _clean_str(request.GET.get("date_to"))
    created_from = _clean_str(request.GET.get("created_from"))
    created_to = _clean_str(request.GET.get("created_to"))

    is_accounting_posted = _to_bool(request.GET.get("is_accounting_posted"), None)
    accounting_entry_reference = _clean_str(request.GET.get("accounting_entry_reference"))

    q = _clean_str(request.GET.get("q") or request.GET.get("search"))

    if status_filter and "status" in model_fields:
        queryset = queryset.filter(status=status_filter)

    if invoice_type and "invoice_type" in model_fields:
        queryset = queryset.filter(invoice_type=invoice_type)

    if customer_id and "customer" in model_fields:
        queryset = queryset.filter(customer_id=customer_id)

    if order_id and "order" in model_fields:
        queryset = queryset.filter(order_id=order_id)

    if date_from and "issue_date" in model_fields:
        queryset = queryset.filter(issue_date__gte=date_from)

    if date_to and "issue_date" in model_fields:
        queryset = queryset.filter(issue_date__lte=date_to)

    if created_from and "created_at" in model_fields:
        queryset = queryset.filter(created_at__date__gte=created_from)

    if created_to and "created_at" in model_fields:
        queryset = queryset.filter(created_at__date__lte=created_to)

    if is_accounting_posted is not None and "is_accounting_posted" in model_fields:
        queryset = queryset.filter(is_accounting_posted=is_accounting_posted)

    if accounting_entry_reference and "accounting_entry_reference" in model_fields:
        queryset = queryset.filter(accounting_entry_reference__icontains=accounting_entry_reference)

    if q:
        queryset = queryset.filter(
            Q(invoice_number__icontains=q)
            | Q(customer__customer_code__icontains=q)
            | Q(customer__display_name__icontains=q)
            | Q(customer__full_name__icontains=q)
            | Q(customer__name__icontains=q)
            | Q(customer__phone__icontains=q)
            | Q(customer__phone_number__icontains=q)
            | Q(customer__email__icontains=q)
            | Q(order__order_number__icontains=q)
            | Q(accounting_entry_reference__icontains=q)
            | Q(notes__icontains=q)
            | Q(internal_notes__icontains=q)
        )

    return queryset


def _filters_payload(request) -> dict[str, Any]:
    return {
        "status": request.GET.get("status") or "",
        "invoice_type": request.GET.get("invoice_type") or "",
        "customer_id": request.GET.get("customer_id") or "",
        "order_id": request.GET.get("order_id") or "",
        "date_from": request.GET.get("date_from") or "",
        "date_to": request.GET.get("date_to") or "",
        "created_from": request.GET.get("created_from") or "",
        "created_to": request.GET.get("created_to") or "",
        "is_accounting_posted": request.GET.get("is_accounting_posted") or "",
        "accounting_entry_reference": request.GET.get("accounting_entry_reference") or "",
        "q": request.GET.get("q") or request.GET.get("search") or "",
    }


# ============================================================
# Serializers / Builders
# ============================================================

def _group_to_list(rows, key_name: str) -> list[dict[str, Any]]:
    rows = list(rows)
    total_count = sum(int(row.get("count") or 0) for row in rows)

    data: list[dict[str, Any]] = []

    for row in rows:
        count = row.get("count") or 0

        data.append(
            {
                key_name: row.get(key_name) or "UNKNOWN",
                "count": count,
                "count_percentage": _percentage(count, total_count),
                "subtotal": _money(row.get("subtotal")),
                "discount_amount": _money(row.get("discount_amount")),
                "taxable_amount": _money(row.get("taxable_amount")),
                "tax_amount": _money(row.get("tax_amount")),
                "total_amount": _money(row.get("total_amount")),
                "paid_amount": _money(row.get("paid_amount")),
                "due_amount": _money(row.get("due_amount")),
            }
        )

    return data


def _serialize_recent_invoice(invoice) -> dict[str, Any]:
    customer = _safe_attr(invoice, "customer", None)
    order = _safe_attr(invoice, "order", None)

    invoice_number = _safe_attr(invoice, "invoice_number", "") or f"INV-{invoice.pk}"

    return {
        "id": invoice.pk,
        "invoice_number": invoice_number,
        "number": invoice_number,
        "reference": invoice_number,

        "status": _safe_attr(invoice, "status", ""),
        "invoice_type": _safe_attr(invoice, "invoice_type", ""),

        "customer_id": _safe_attr(invoice, "customer_id", None),
        "customer_name": _related_name(customer),
        "customer_phone": (
            _safe_attr(customer, "phone_number", "")
            or _safe_attr(customer, "phone", "")
        ) if customer else "",

        "order_id": _safe_attr(invoice, "order_id", None),
        "order_number": _safe_attr(order, "order_number", "") if order else "",

        "issue_date": _iso_datetime(_safe_attr(invoice, "issue_date", None)),
        "due_date": _iso_datetime(_safe_attr(invoice, "due_date", None)),

        "subtotal": _money(_safe_attr(invoice, "subtotal", "0.00")),
        "discount_amount": _money(_safe_attr(invoice, "discount_amount", "0.00")),
        "tax_amount": _money(_safe_attr(invoice, "tax_amount", "0.00")),
        "total_amount": _money(_safe_attr(invoice, "total_amount", "0.00")),
        "paid_amount": _money(_safe_attr(invoice, "paid_amount", "0.00")),
        "due_amount": _money(_safe_attr(invoice, "due_amount", "0.00")),
        "currency": _safe_attr(invoice, "currency", "SAR") or "SAR",

        "is_accounting_posted": bool(_safe_attr(invoice, "is_accounting_posted", False)),
        "accounting_entry_reference": _safe_attr(invoice, "accounting_entry_reference", ""),

        "created_at": _iso_datetime(_safe_attr(invoice, "created_at", None)),
    }


def _build_summary(queryset) -> dict[str, Any]:
    totals = queryset.aggregate(
        count=Count("id"),
        subtotal=Sum("subtotal"),
        discount_amount=Sum("discount_amount"),
        taxable_amount=Sum("taxable_amount"),
        tax_amount=Sum("tax_amount"),
        total_amount=Sum("total_amount"),
        paid_amount=Sum("paid_amount"),
        due_amount=Sum("due_amount"),
        accounting_posted_count=Count("id", filter=Q(is_accounting_posted=True)),
        accounting_pending_count=Count("id", filter=Q(is_accounting_posted=False)),
        paid_invoices_count=Count("id", filter=Q(due_amount__lte=0)),
        unpaid_invoices_count=Count("id", filter=Q(due_amount__gt=0)),
    )

    total_amount = _money(totals.get("total_amount"))
    paid_amount = _money(totals.get("paid_amount"))
    due_amount = _money(totals.get("due_amount"))
    count = totals.get("count") or 0

    return {
        "count": count,
        "total_count": count,

        "subtotal": _money(totals.get("subtotal")),
        "discount_amount": _money(totals.get("discount_amount")),
        "taxable_amount": _money(totals.get("taxable_amount")),
        "tax_amount": _money(totals.get("tax_amount")),
        "total_amount": total_amount,
        "paid_amount": paid_amount,
        "due_amount": due_amount,

        "accounting_posted_count": totals.get("accounting_posted_count") or 0,
        "accounting_pending_count": totals.get("accounting_pending_count") or 0,
        "paid_invoices_count": totals.get("paid_invoices_count") or 0,
        "unpaid_invoices_count": totals.get("unpaid_invoices_count") or 0,

        "collection_rate": _percentage(paid_amount, total_amount),
        "due_rate": _percentage(due_amount, total_amount),
        "accounting_posting_rate": _percentage(
            totals.get("accounting_posted_count") or 0,
            count,
        ),

        "currency": "SAR",
    }


def _build_breakdowns(queryset) -> dict[str, Any]:
    by_status_rows = (
        queryset.values("status")
        .annotate(
            count=Count("id"),
            subtotal=Sum("subtotal"),
            discount_amount=Sum("discount_amount"),
            taxable_amount=Sum("taxable_amount"),
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
            discount_amount=Sum("discount_amount"),
            taxable_amount=Sum("taxable_amount"),
            tax_amount=Sum("tax_amount"),
            total_amount=Sum("total_amount"),
            paid_amount=Sum("paid_amount"),
            due_amount=Sum("due_amount"),
        )
        .order_by("invoice_type")
    )

    by_accounting_posting_rows = (
        queryset.values("is_accounting_posted")
        .annotate(
            count=Count("id"),
            total_amount=Sum("total_amount"),
            paid_amount=Sum("paid_amount"),
            due_amount=Sum("due_amount"),
        )
        .order_by("is_accounting_posted")
    )

    return {
        "by_status": _group_to_list(by_status_rows, "status"),
        "by_type": _group_to_list(by_type_rows, "invoice_type"),
        "by_accounting_posting": [
            {
                "is_accounting_posted": bool(row.get("is_accounting_posted")),
                "label": "posted" if row.get("is_accounting_posted") else "pending",
                "count": row.get("count") or 0,
                "total_amount": _money(row.get("total_amount")),
                "paid_amount": _money(row.get("paid_amount")),
                "due_amount": _money(row.get("due_amount")),
            }
            for row in by_accounting_posting_rows
        ],
    }


# ============================================================
# API
# ============================================================

@login_required
@require_GET
def invoice_reports_api(request):
    try:
        Invoice = _resolve_invoice_model()

        queryset = _base_queryset(Invoice, request)
        queryset = _apply_filters(request, queryset)

        recent_invoices = list(
            queryset
            .select_related("customer", "order")
            .order_by("-created_at", "-id")[:10]
        )

        breakdowns = _build_breakdowns(queryset)

        payload = {
            "summary": _build_summary(queryset),
            **breakdowns,
            "recent": [
                _serialize_recent_invoice(invoice)
                for invoice in recent_invoices
            ],
            "recent_invoices": [
                _serialize_recent_invoice(invoice)
                for invoice in recent_invoices
            ],
            "filters": _filters_payload(request),
        }

        return _json_success(
            payload,
            message="Invoice reports loaded successfully.",
            extra={
                # توافق خلفي مع الفرونت القديم
                "summary": payload["summary"],
                "by_status": payload["by_status"],
                "by_type": payload["by_type"],
                "recent": payload["recent"],
            },
        )

    except Exception as exc:
        logger.exception("Failed to fetch invoice reports: %s", exc)
        return _json_error("تعذر جلب تقارير الفواتير.", status=500)