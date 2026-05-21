# ============================================================
# 📂 api/payments/reports.py
# 🧠 Payments Reports API — Primey Care V2.1
# ------------------------------------------------------------
# ✅ تقرير ملخص المدفوعات
# ✅ إجماليات حسب الحالة / الطريقة / المزود
# ✅ إجماليات الترحيل للمحاسبة والخزينة
# ✅ أحدث الدفعات مع العلاقات الأساسية
# ✅ فلاتر حسب التاريخ / العميل / الفاتورة / الطلب / الحالة
# ✅ بحث آمن حسب بيانات العميل الحالية
# ✅ يدعم رقم العميل الموحد normalized_phone
# ✅ Compatible with Customer Portal / OTP customer account fields
# ✅ Unified response: ok / success / data
# ✅ Compatible with Accounting / Treasury / Gateways flow
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

from customers.models import normalize_customer_phone


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


def _clean_upper(value: Any, default: str = "") -> str:
    return _clean_str(value, default).upper()


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
    total_amount = _money(total)

    if total_amount <= Decimal("0.00"):
        return Decimal("0.00")

    return _money(_money(part) * Decimal("100.00") / total_amount)


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

def _base_queryset(Payment, request):
    queryset = Payment.objects.select_related(
        "invoice",
        "order",
        "customer",
        "customer__user",
    ).all()

    company_id = _extract_company_id(request)
    model_fields = {field.name for field in Payment._meta.fields}

    if company_id and "company" in model_fields:
        queryset = queryset.filter(company_id=company_id)

    return queryset


def _apply_filters(queryset, request):
    date_from = _clean_str(request.GET.get("date_from"))
    date_to = _clean_str(request.GET.get("date_to"))
    paid_from = _clean_str(request.GET.get("paid_from"))
    paid_to = _clean_str(request.GET.get("paid_to"))

    customer_id = _clean_str(request.GET.get("customer_id"))
    invoice_id = _clean_str(request.GET.get("invoice_id"))
    order_id = _clean_str(request.GET.get("order_id"))

    status_filter = _clean_upper(request.GET.get("status"))
    method_filter = _clean_upper(request.GET.get("payment_method") or request.GET.get("method"))
    provider_filter = _clean_upper(request.GET.get("provider"))

    is_treasury_posted = _to_bool(request.GET.get("is_treasury_posted"), None)
    is_accounting_posted = _to_bool(request.GET.get("is_accounting_posted"), None)

    q = _clean_str(request.GET.get("q") or request.GET.get("search"))

    if date_from:
        queryset = queryset.filter(created_at__date__gte=date_from)

    if date_to:
        queryset = queryset.filter(created_at__date__lte=date_to)

    if paid_from:
        queryset = queryset.filter(paid_at__date__gte=paid_from)

    if paid_to:
        queryset = queryset.filter(paid_at__date__lte=paid_to)

    if customer_id:
        queryset = queryset.filter(customer_id=customer_id)

    if invoice_id:
        queryset = queryset.filter(invoice_id=invoice_id)

    if order_id:
        queryset = queryset.filter(order_id=order_id)

    if status_filter:
        queryset = queryset.filter(status=status_filter)

    if method_filter:
        queryset = queryset.filter(payment_method=method_filter)

    if provider_filter:
        queryset = queryset.filter(provider=provider_filter)

    if is_treasury_posted is not None:
        queryset = queryset.filter(is_treasury_posted=is_treasury_posted)

    if is_accounting_posted is not None:
        queryset = queryset.filter(is_accounting_posted=is_accounting_posted)

    if q:
        normalized_phone = normalize_customer_phone(q)

        search_filter = (
            Q(payment_number__icontains=q)
            | Q(external_reference__icontains=q)
            | Q(transaction_id__icontains=q)
            | Q(gateway_response_code__icontains=q)
            | Q(gateway_message__icontains=q)
            | Q(accounting_entry_reference__icontains=q)
            | Q(treasury_movement_reference__icontains=q)
            | Q(customer__customer_code__icontains=q)
            | Q(customer__display_name__icontains=q)
            | Q(customer__phone_number__icontains=q)
            | Q(customer__whatsapp_number__icontains=q)
            | Q(customer__normalized_phone__icontains=q)
            | Q(customer__email__icontains=q)
            | Q(customer__user__username__icontains=q)
            | Q(order__order_number__icontains=q)
            | Q(invoice__invoice_number__icontains=q)
        )

        if normalized_phone:
            search_filter |= Q(customer__normalized_phone__icontains=normalized_phone)

        queryset = queryset.filter(search_filter)

    return queryset


def _filters_payload(request) -> dict[str, Any]:
    return {
        "date_from": request.GET.get("date_from") or "",
        "date_to": request.GET.get("date_to") or "",
        "paid_from": request.GET.get("paid_from") or "",
        "paid_to": request.GET.get("paid_to") or "",
        "customer_id": request.GET.get("customer_id") or "",
        "invoice_id": request.GET.get("invoice_id") or "",
        "order_id": request.GET.get("order_id") or "",
        "status": request.GET.get("status") or "",
        "payment_method": request.GET.get("payment_method") or request.GET.get("method") or "",
        "provider": request.GET.get("provider") or "",
        "is_treasury_posted": request.GET.get("is_treasury_posted") or "",
        "is_accounting_posted": request.GET.get("is_accounting_posted") or "",
        "q": request.GET.get("q") or request.GET.get("search") or "",
    }


# ============================================================
# Serializers / Group Builders
# ============================================================

def _serialize_group_rows(rows: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    total_count = sum(int(row.get("count") or 0) for row in rows)
    total_amount = sum((_money(row.get("amount")) for row in rows), Decimal("0.00"))

    return [
        {
            key: row.get(key) or "",
            "count": row.get("count") or 0,
            "count_percentage": _percentage(row.get("count") or 0, total_count),
            "amount": _money(row.get("amount")),
            "amount_percentage": _percentage(row.get("amount"), total_amount),
            "paid_amount": _money(row.get("paid_amount")),
            "refunded_amount": _money(row.get("refunded_amount")),
            "net_collected_amount": _money(
                _money(row.get("paid_amount")) - _money(row.get("refunded_amount"))
            ),
        }
        for row in rows
    ]


def _serialize_latest_customer(customer) -> dict[str, Any] | None:
    if not customer:
        return None

    phone_number = (
        _safe_attr(customer, "phone_number", "")
        or _safe_attr(customer, "phone", "")
        or _safe_attr(customer, "mobile", "")
    )
    whatsapp_number = _safe_attr(customer, "whatsapp_number", "")
    user = _safe_attr(customer, "user", None)

    display_name = (
        _safe_attr(customer, "display_name", "")
        or _safe_attr(customer, "full_name", "")
        or _safe_attr(customer, "name", "")
        or _related_name(customer)
    )

    return {
        "id": _safe_attr(customer, "id", None),
        "customer_code": _safe_attr(customer, "customer_code", ""),
        "display_name": display_name,
        "name": display_name,
        "phone_number": phone_number,
        "whatsapp_number": whatsapp_number,
        "primary_contact_number": (
            whatsapp_number
            or phone_number
            or _safe_attr(customer, "alternative_phone_number", "")
        ),
        "email": _safe_attr(customer, "email", ""),
        "status": _safe_attr(customer, "status", ""),
        "normalized_phone": _safe_attr(customer, "normalized_phone", ""),
        "user_id": _safe_attr(customer, "user_id", None),
        "user_username": _safe_attr(user, "username", "") if user else "",
        "has_customer_account": bool(_safe_attr(customer, "user_id", None)),
        "is_phone_verified": bool(_safe_attr(customer, "phone_verified_at", None)),
        "is_whatsapp_verified": bool(_safe_attr(customer, "whatsapp_verified_at", None)),
        "last_login_at": _iso_datetime(_safe_attr(customer, "last_login_at", None)),
    }


def _serialize_latest_payment(payment) -> dict[str, Any]:
    customer = _safe_attr(payment, "customer", None)
    invoice = _safe_attr(payment, "invoice", None)
    order = _safe_attr(payment, "order", None)
    customer_payload = _serialize_latest_customer(customer)

    return {
        "id": payment.pk,
        "payment_number": _safe_attr(payment, "payment_number", ""),
        "reference": _safe_attr(payment, "payment_number", "") or f"PAY-{payment.pk}",
        "status": _safe_attr(payment, "status", ""),
        "payment_method": _safe_attr(payment, "payment_method", ""),
        "provider": _safe_attr(payment, "provider", ""),
        "amount": _money(_safe_attr(payment, "amount", "0.00")),
        "paid_amount": _money(_safe_attr(payment, "paid_amount", "0.00")),
        "refunded_amount": _money(_safe_attr(payment, "refunded_amount", "0.00")),
        "net_collected_amount": _money(_safe_attr(payment, "net_collected_amount", "0.00")),
        "currency": _safe_attr(payment, "currency", "SAR") or "SAR",

        "invoice_id": _safe_attr(payment, "invoice_id", None),
        "invoice_number": _safe_attr(invoice, "invoice_number", "") if invoice else "",

        "order_id": _safe_attr(payment, "order_id", None),
        "order_number": _safe_attr(order, "order_number", "") if order else "",

        "customer_id": _safe_attr(payment, "customer_id", None),
        "customer": customer_payload,
        "customer_name": _related_name(customer),
        "customer_phone": (
            _safe_attr(customer, "phone_number", "")
            or _safe_attr(customer, "whatsapp_number", "")
            or _safe_attr(customer, "phone", "")
        ) if customer else "",
        "customer_normalized_phone": _safe_attr(customer, "normalized_phone", "") if customer else "",
        "has_customer_account": bool(_safe_attr(customer, "user_id", None)) if customer else False,

        "external_reference": _safe_attr(payment, "external_reference", ""),
        "transaction_id": _safe_attr(payment, "transaction_id", ""),

        "is_treasury_posted": bool(_safe_attr(payment, "is_treasury_posted", False)),
        "is_accounting_posted": bool(_safe_attr(payment, "is_accounting_posted", False)),
        "treasury_movement_reference": _safe_attr(payment, "treasury_movement_reference", ""),
        "accounting_entry_reference": _safe_attr(payment, "accounting_entry_reference", ""),

        "created_at": _iso_datetime(_safe_attr(payment, "created_at", None)),
        "paid_at": _iso_datetime(_safe_attr(payment, "paid_at", None)),
    }


def _build_summary(queryset) -> dict[str, Any]:
    totals = queryset.aggregate(
        total_count=Count("id"),
        total_amount=Sum("amount"),
        total_paid_amount=Sum("paid_amount"),
        total_refunded_amount=Sum("refunded_amount"),
        posted_treasury_count=Count("id", filter=Q(is_treasury_posted=True)),
        posted_accounting_count=Count("id", filter=Q(is_accounting_posted=True)),
        pending_treasury_count=Count("id", filter=Q(is_treasury_posted=False)),
        pending_accounting_count=Count("id", filter=Q(is_accounting_posted=False)),
        gateway_payments_count=Count(
            "id",
            filter=(
                Q(external_reference__isnull=False)
                & ~Q(external_reference="")
            ) | (
                Q(transaction_id__isnull=False)
                & ~Q(transaction_id="")
            ),
        ),
    )

    total_count = totals.get("total_count") or 0
    total_amount = _money(totals.get("total_amount"))
    total_paid_amount = _money(totals.get("total_paid_amount"))
    total_refunded_amount = _money(totals.get("total_refunded_amount"))
    net_collected_amount = _money(total_paid_amount - total_refunded_amount)

    return {
        "total_count": total_count,
        "total_amount": total_amount,
        "total_paid_amount": total_paid_amount,
        "total_refunded_amount": total_refunded_amount,
        "net_collected_amount": net_collected_amount,

        "posted_treasury_count": totals.get("posted_treasury_count") or 0,
        "posted_accounting_count": totals.get("posted_accounting_count") or 0,
        "pending_treasury_count": totals.get("pending_treasury_count") or 0,
        "pending_accounting_count": totals.get("pending_accounting_count") or 0,

        "gateway_payments_count": totals.get("gateway_payments_count") or 0,

        "treasury_posting_rate": _percentage(totals.get("posted_treasury_count") or 0, total_count),
        "accounting_posting_rate": _percentage(totals.get("posted_accounting_count") or 0, total_count),
        "collection_rate": _percentage(total_paid_amount, total_amount),

        "currency": "SAR",
    }


def _build_breakdowns(queryset) -> dict[str, Any]:
    by_status = list(
        queryset.values("status")
        .annotate(
            count=Count("id"),
            amount=Sum("amount"),
            paid_amount=Sum("paid_amount"),
            refunded_amount=Sum("refunded_amount"),
        )
        .order_by("status")
    )

    by_method = list(
        queryset.values("payment_method")
        .annotate(
            count=Count("id"),
            amount=Sum("amount"),
            paid_amount=Sum("paid_amount"),
            refunded_amount=Sum("refunded_amount"),
        )
        .order_by("payment_method")
    )

    by_provider = list(
        queryset.values("provider")
        .annotate(
            count=Count("id"),
            amount=Sum("amount"),
            paid_amount=Sum("paid_amount"),
            refunded_amount=Sum("refunded_amount"),
        )
        .order_by("provider")
    )

    by_accounting_posting = list(
        queryset.values("is_accounting_posted")
        .annotate(
            count=Count("id"),
            amount=Sum("amount"),
            paid_amount=Sum("paid_amount"),
        )
        .order_by("is_accounting_posted")
    )

    by_treasury_posting = list(
        queryset.values("is_treasury_posted")
        .annotate(
            count=Count("id"),
            amount=Sum("amount"),
            paid_amount=Sum("paid_amount"),
        )
        .order_by("is_treasury_posted")
    )

    return {
        "by_status": _serialize_group_rows(by_status, "status"),
        "by_method": _serialize_group_rows(by_method, "payment_method"),
        "by_provider": _serialize_group_rows(by_provider, "provider"),
        "by_accounting_posting": [
            {
                "is_accounting_posted": bool(row.get("is_accounting_posted")),
                "label": "posted" if row.get("is_accounting_posted") else "pending",
                "count": row.get("count") or 0,
                "amount": _money(row.get("amount")),
                "paid_amount": _money(row.get("paid_amount")),
            }
            for row in by_accounting_posting
        ],
        "by_treasury_posting": [
            {
                "is_treasury_posted": bool(row.get("is_treasury_posted")),
                "label": "posted" if row.get("is_treasury_posted") else "pending",
                "count": row.get("count") or 0,
                "amount": _money(row.get("amount")),
                "paid_amount": _money(row.get("paid_amount")),
            }
            for row in by_treasury_posting
        ],
    }


# ============================================================
# API
# ============================================================

@login_required
@require_GET
def payment_reports_api(request):
    try:
        Payment = _resolve_payment_model()

        queryset = _base_queryset(Payment, request)
        queryset = _apply_filters(queryset, request)

        latest_payments = list(
            queryset
            .select_related("invoice", "order", "customer", "customer__user")
            .order_by("-created_at", "-id")[:10]
        )

        breakdowns = _build_breakdowns(queryset)

        payload = {
            "summary": _build_summary(queryset),
            **breakdowns,
            "latest": [
                _serialize_latest_payment(payment)
                for payment in latest_payments
            ],
            "latest_payments": [
                _serialize_latest_payment(payment)
                for payment in latest_payments
            ],
            "filters": _filters_payload(request),
        }

        return _json_success(
            payload,
            message="Payment reports loaded successfully.",
            extra={
                # توافق خلفي مع الفرونت القديم
                "summary": payload["summary"],
                "by_status": payload["by_status"],
                "by_method": payload["by_method"],
                "by_provider": payload["by_provider"],
                "latest": payload["latest"],
            },
        )

    except Exception as exc:
        logger.exception("Failed to fetch payment reports: %s", exc)
        return _json_error("تعذر جلب تقارير المدفوعات.", status=500)