# ============================================================
# 📂 api/payments/list.py
# 🧠 Payments API List — Primey Care V2
# ------------------------------------------------------------
# ✅ قائمة المدفوعات
# ✅ فلترة حسب الحالة / الطريقة / المزود / الفاتورة / الطلب / العميل
# ✅ فلترة حسب الترحيل للخزينة والمحاسبة
# ✅ بحث برقم الدفعة / المرجع الخارجي / العملية / العميل
# ✅ Summary مالي مناسب للواجهة
# ✅ Pagination بنمط page/page_size مع دعم limit/offset القديم
# ✅ Unified response: ok / success / data / results
# ✅ Compatible with Accounting / Treasury / Gateways flow
# ============================================================

from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.apps import apps
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
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

def _resolve_payment_model():
    try:
        return apps.get_model("payments", "Payment")
    except LookupError as exc:
        raise LookupError("Payment model was not found in payments app.") from exc


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


def _clean_str(value: Any, default: str = "") -> str:
    if value is None:
        return default

    cleaned = str(value).strip()
    return cleaned if cleaned else default


def _to_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except Exception:
        return default


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


def _safe_related_name(obj: Any, field_name: str) -> str:
    related_obj = _safe_attr(obj, field_name, None)

    if not related_obj:
        return ""

    return (
        _safe_attr(related_obj, "display_name", "")
        or _safe_attr(related_obj, "full_name", "")
        or _safe_attr(related_obj, "name", "")
        or _safe_attr(related_obj, "title", "")
        or str(related_obj)
    )


def _parse_page_params(request) -> tuple[int, int]:
    """
    يدعم النمط الجديد page/page_size.
    ويبقي limit/offset للتوافق القديم عبر extra response.
    """
    page = max(_to_int(request.GET.get("page"), 1), 1)
    page_size = min(max(_to_int(request.GET.get("page_size"), 50), 1), 200)

    if request.GET.get("limit"):
        page_size = min(max(_to_int(request.GET.get("limit"), page_size), 1), 200)

    if request.GET.get("offset") and not request.GET.get("page"):
        offset = max(_to_int(request.GET.get("offset"), 0), 0)
        page = (offset // page_size) + 1

    return page, page_size


def _paginate(queryset, *, page: int, page_size: int) -> dict[str, Any]:
    paginator = Paginator(queryset, page_size)
    current_page = paginator.get_page(page)

    offset = (current_page.number - 1) * page_size

    return {
        "items": list(current_page.object_list),
        "pagination": {
            "page": current_page.number,
            "page_size": page_size,
            "total_pages": paginator.num_pages,
            "total_items": paginator.count,
            "has_next": current_page.has_next(),
            "has_previous": current_page.has_previous(),
            "limit": page_size,
            "offset": offset,
            "next_offset": offset + page_size if current_page.has_next() else None,
        },
    }


# ============================================================
# Serializers
# ============================================================

def _serialize_invoice(invoice) -> dict[str, Any] | None:
    if not invoice:
        return None

    return {
        "id": _safe_attr(invoice, "id", None),
        "invoice_number": _safe_attr(invoice, "invoice_number", ""),
        "status": _safe_attr(invoice, "status", ""),
        "total_amount": _safe_attr(invoice, "total_amount", None),
        "paid_amount": _safe_attr(invoice, "paid_amount", None),
        "due_amount": _safe_attr(invoice, "due_amount", None),
        "accounting_entry_reference": _safe_attr(invoice, "accounting_entry_reference", ""),
        "is_accounting_posted": bool(_safe_attr(invoice, "is_accounting_posted", False)),
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
        "payment_status": _safe_attr(order, "payment_status", ""),
        "total_amount": _safe_attr(order, "total_amount", None),
        "amount_paid": _safe_attr(order, "amount_paid", None),
        "remaining_amount": _safe_attr(order, "remaining_amount", None),
    }


def _serialize_customer(customer) -> dict[str, Any] | None:
    if not customer:
        return None

    return {
        "id": _safe_attr(customer, "id", None),
        "customer_code": _safe_attr(customer, "customer_code", ""),
        "name": (
            _safe_attr(customer, "display_name", "")
            or _safe_attr(customer, "full_name", "")
            or _safe_attr(customer, "name", "")
        ),
        "phone": (
            _safe_attr(customer, "phone_number", "")
            or _safe_attr(customer, "phone", "")
            or _safe_attr(customer, "mobile", "")
        ),
        "email": _safe_attr(customer, "email", ""),
    }


def _serialize_payment(payment) -> dict[str, Any]:
    invoice = _safe_attr(payment, "invoice", None)
    order = _safe_attr(payment, "order", None)
    customer = _safe_attr(payment, "customer", None)

    return {
        "id": payment.pk,
        "payment_number": _safe_attr(payment, "payment_number", ""),
        "reference": _safe_attr(payment, "payment_number", "") or f"PAY-{payment.pk}",

        "status": _safe_attr(payment, "status", ""),
        "payment_method": _safe_attr(payment, "payment_method", ""),
        "provider": _safe_attr(payment, "provider", ""),
        "currency": _safe_attr(payment, "currency", "SAR") or "SAR",

        "amount": _money(_safe_attr(payment, "amount", "0.00")),
        "paid_amount": _money(_safe_attr(payment, "paid_amount", "0.00")),
        "refunded_amount": _money(_safe_attr(payment, "refunded_amount", "0.00")),
        "remaining_amount": _money(_safe_attr(payment, "remaining_amount", "0.00")),
        "net_collected_amount": _money(_safe_attr(payment, "net_collected_amount", "0.00")),

        "invoice_id": _safe_attr(payment, "invoice_id", None),
        "invoice": _serialize_invoice(invoice),

        "order_id": _safe_attr(payment, "order_id", None),
        "order": _serialize_order(order),

        "customer_id": _safe_attr(payment, "customer_id", None),
        "customer": _serialize_customer(customer),
        "customer_name": _safe_related_name(payment, "customer"),

        "external_reference": _safe_attr(payment, "external_reference", ""),
        "transaction_id": _safe_attr(payment, "transaction_id", ""),
        "gateway_response_code": _safe_attr(payment, "gateway_response_code", ""),
        "gateway_message": _safe_attr(payment, "gateway_message", ""),

        "treasury_movement_reference": _safe_attr(payment, "treasury_movement_reference", ""),
        "accounting_entry_reference": _safe_attr(payment, "accounting_entry_reference", ""),
        "is_treasury_posted": bool(_safe_attr(payment, "is_treasury_posted", False)),
        "is_accounting_posted": bool(_safe_attr(payment, "is_accounting_posted", False)),

        "initiated_at": _iso_datetime(_safe_attr(payment, "initiated_at", None)),
        "paid_at": _iso_datetime(_safe_attr(payment, "paid_at", None)),
        "refunded_at": _iso_datetime(_safe_attr(payment, "refunded_at", None)),
        "cancelled_at": _iso_datetime(_safe_attr(payment, "cancelled_at", None)),
        "created_at": _iso_datetime(_safe_attr(payment, "created_at", None)),
        "updated_at": _iso_datetime(_safe_attr(payment, "updated_at", None)),

        "notes": _safe_attr(payment, "notes", ""),
        "failure_reason": _safe_attr(payment, "failure_reason", ""),
    }


# ============================================================
# Query Helpers
# ============================================================

def _payment_queryset(Payment, request):
    queryset = (
        Payment.objects.select_related(
            "invoice",
            "order",
            "customer",
        )
        .all()
        .order_by("-created_at", "-id")
    )

    company_id = _extract_company_id(request)
    model_fields = {field.name for field in Payment._meta.fields}

    if company_id and "company" in model_fields:
        queryset = queryset.filter(company_id=company_id)

    return queryset


def _apply_filters(queryset, request):
    status_filter = _clean_str(request.GET.get("status"))
    method_filter = _clean_str(request.GET.get("payment_method") or request.GET.get("method"))
    provider_filter = _clean_str(request.GET.get("provider"))

    invoice_id = _clean_str(request.GET.get("invoice_id"))
    order_id = _clean_str(request.GET.get("order_id"))
    customer_id = _clean_str(request.GET.get("customer_id"))

    external_reference = _clean_str(request.GET.get("external_reference"))
    transaction_id = _clean_str(request.GET.get("transaction_id"))
    accounting_entry_reference = _clean_str(request.GET.get("accounting_entry_reference"))
    treasury_movement_reference = _clean_str(request.GET.get("treasury_movement_reference"))

    is_treasury_posted = _to_bool(request.GET.get("is_treasury_posted"), None)
    is_accounting_posted = _to_bool(request.GET.get("is_accounting_posted"), None)

    date_from = _clean_str(request.GET.get("date_from"))
    date_to = _clean_str(request.GET.get("date_to"))
    paid_from = _clean_str(request.GET.get("paid_from"))
    paid_to = _clean_str(request.GET.get("paid_to"))

    search = _clean_str(request.GET.get("search") or request.GET.get("q"))

    if status_filter:
        queryset = queryset.filter(status=status_filter)

    if method_filter:
        queryset = queryset.filter(payment_method=method_filter)

    if provider_filter:
        queryset = queryset.filter(provider=provider_filter)

    if invoice_id:
        queryset = queryset.filter(invoice_id=invoice_id)

    if order_id:
        queryset = queryset.filter(order_id=order_id)

    if customer_id:
        queryset = queryset.filter(customer_id=customer_id)

    if external_reference:
        queryset = queryset.filter(external_reference__icontains=external_reference)

    if transaction_id:
        queryset = queryset.filter(transaction_id__icontains=transaction_id)

    if accounting_entry_reference:
        queryset = queryset.filter(accounting_entry_reference__icontains=accounting_entry_reference)

    if treasury_movement_reference:
        queryset = queryset.filter(treasury_movement_reference__icontains=treasury_movement_reference)

    if is_treasury_posted is not None:
        queryset = queryset.filter(is_treasury_posted=is_treasury_posted)

    if is_accounting_posted is not None:
        queryset = queryset.filter(is_accounting_posted=is_accounting_posted)

    if date_from:
        queryset = queryset.filter(created_at__date__gte=date_from)

    if date_to:
        queryset = queryset.filter(created_at__date__lte=date_to)

    if paid_from:
        queryset = queryset.filter(paid_at__date__gte=paid_from)

    if paid_to:
        queryset = queryset.filter(paid_at__date__lte=paid_to)

    if search:
        queryset = queryset.filter(
            Q(payment_number__icontains=search)
            | Q(external_reference__icontains=search)
            | Q(transaction_id__icontains=search)
            | Q(gateway_response_code__icontains=search)
            | Q(gateway_message__icontains=search)
            | Q(treasury_movement_reference__icontains=search)
            | Q(accounting_entry_reference__icontains=search)
            | Q(customer__customer_code__icontains=search)
            | Q(customer__display_name__icontains=search)
            | Q(customer__full_name__icontains=search)
            | Q(customer__name__icontains=search)
            | Q(customer__phone__icontains=search)
            | Q(customer__phone_number__icontains=search)
            | Q(customer__email__icontains=search)
        )

    return queryset


# ============================================================
# Summary
# ============================================================

def _build_summary(queryset) -> dict[str, Any]:
    totals = queryset.aggregate(
        total_count=Count("id"),
        total_amount=Sum("amount"),
        total_paid_amount=Sum("paid_amount"),
        total_refunded_amount=Sum("refunded_amount"),
        posted_treasury_count=Count("id", filter=Q(is_treasury_posted=True)),
        unposted_treasury_count=Count("id", filter=Q(is_treasury_posted=False)),
        posted_accounting_count=Count("id", filter=Q(is_accounting_posted=True)),
        unposted_accounting_count=Count("id", filter=Q(is_accounting_posted=False)),
    )

    status_breakdown = list(
        queryset
        .values("status")
        .annotate(
            count=Count("id"),
            amount=Sum("amount"),
            paid_amount=Sum("paid_amount"),
            refunded_amount=Sum("refunded_amount"),
        )
        .order_by("status")
    )

    provider_breakdown = list(
        queryset
        .values("provider")
        .annotate(
            count=Count("id"),
            amount=Sum("amount"),
            paid_amount=Sum("paid_amount"),
            refunded_amount=Sum("refunded_amount"),
        )
        .order_by("provider")
    )

    method_breakdown = list(
        queryset
        .values("payment_method")
        .annotate(
            count=Count("id"),
            amount=Sum("amount"),
            paid_amount=Sum("paid_amount"),
            refunded_amount=Sum("refunded_amount"),
        )
        .order_by("payment_method")
    )

    return {
        "total_count": totals["total_count"] or 0,
        "total_amount": _money(totals["total_amount"]),
        "total_paid_amount": _money(totals["total_paid_amount"]),
        "total_refunded_amount": _money(totals["total_refunded_amount"]),
        "net_collected_amount": _money(
            _money(totals["total_paid_amount"]) - _money(totals["total_refunded_amount"])
        ),
        "posted_treasury_count": totals["posted_treasury_count"] or 0,
        "unposted_treasury_count": totals["unposted_treasury_count"] or 0,
        "posted_accounting_count": totals["posted_accounting_count"] or 0,
        "unposted_accounting_count": totals["unposted_accounting_count"] or 0,
        "currency": "SAR",
        "status_breakdown": [
            {
                "status": item["status"],
                "count": item["count"] or 0,
                "amount": _money(item["amount"]),
                "paid_amount": _money(item["paid_amount"]),
                "refunded_amount": _money(item["refunded_amount"]),
            }
            for item in status_breakdown
        ],
        "provider_breakdown": [
            {
                "provider": item["provider"],
                "count": item["count"] or 0,
                "amount": _money(item["amount"]),
                "paid_amount": _money(item["paid_amount"]),
                "refunded_amount": _money(item["refunded_amount"]),
            }
            for item in provider_breakdown
        ],
        "method_breakdown": [
            {
                "payment_method": item["payment_method"],
                "count": item["count"] or 0,
                "amount": _money(item["amount"]),
                "paid_amount": _money(item["paid_amount"]),
                "refunded_amount": _money(item["refunded_amount"]),
            }
            for item in method_breakdown
        ],
    }


def _filters_payload(request) -> dict[str, Any]:
    return {
        "status": request.GET.get("status") or "",
        "payment_method": request.GET.get("payment_method") or request.GET.get("method") or "",
        "provider": request.GET.get("provider") or "",
        "invoice_id": request.GET.get("invoice_id") or "",
        "order_id": request.GET.get("order_id") or "",
        "customer_id": request.GET.get("customer_id") or "",
        "external_reference": request.GET.get("external_reference") or "",
        "transaction_id": request.GET.get("transaction_id") or "",
        "accounting_entry_reference": request.GET.get("accounting_entry_reference") or "",
        "treasury_movement_reference": request.GET.get("treasury_movement_reference") or "",
        "is_treasury_posted": request.GET.get("is_treasury_posted") or "",
        "is_accounting_posted": request.GET.get("is_accounting_posted") or "",
        "date_from": request.GET.get("date_from") or "",
        "date_to": request.GET.get("date_to") or "",
        "paid_from": request.GET.get("paid_from") or "",
        "paid_to": request.GET.get("paid_to") or "",
        "q": request.GET.get("q") or request.GET.get("search") or "",
    }


# ============================================================
# API
# ============================================================

@login_required
@require_GET
def payment_list_api(request):
    try:
        Payment = _resolve_payment_model()

        queryset = _payment_queryset(Payment, request)
        queryset = _apply_filters(queryset, request)

        page, page_size = _parse_page_params(request)
        paginated = _paginate(queryset, page=page, page_size=page_size)

        items = [_serialize_payment(item) for item in paginated["items"]]
        pagination = paginated["pagination"]

        return _json_success(
            {
                "items": items,
                "results": items,
                "summary": _build_summary(queryset),
                "totals": {
                    "amount": _build_summary(queryset)["total_amount"],
                    "paid_amount": _build_summary(queryset)["total_paid_amount"],
                    "refunded_amount": _build_summary(queryset)["total_refunded_amount"],
                    "net_collected_amount": _build_summary(queryset)["net_collected_amount"],
                },
                "pagination": pagination,
                "filters": _filters_payload(request),
            },
            message="Payments loaded successfully.",
            extra={
                # توافق خلفي مع الفرونت القديم
                "count": len(items),
                "total_count": pagination["total_items"],
                "limit": pagination["limit"],
                "offset": pagination["offset"],
                "next_offset": pagination["next_offset"],
                "results": items,
            },
        )

    except Exception as exc:
        logger.exception("Failed to fetch payment list: %s", exc)
        return _json_error("تعذر جلب قائمة الدفعات.", status=500)