# ============================================================
# 📂 api/payments/list.py
# 🧠 Payments API List — Primey Care
# ------------------------------------------------------------
# ✅ قائمة المدفوعات
# ✅ فلترة حسب الحالة / الطريقة / المزود / الفاتورة / الطلب / العميل
# ✅ بحث بالرقم والمرجع الخارجي والعميل
# ✅ جاهز لصفحات Frontend
# ============================================================

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

from django.apps import apps
from django.contrib.auth.decorators import login_required
from django.db.models import Q, Sum
from django.http import JsonResponse
from django.views.decorators.http import require_GET

logger = logging.getLogger(__name__)


def _json_error(message: str, status: int = 400) -> JsonResponse:
    return JsonResponse({"ok": False, "message": message}, status=status)


def _json_success(data: dict[str, Any], status: int = 200) -> JsonResponse:
    payload = {"ok": True}
    payload.update(data)
    return JsonResponse(payload, status=status)


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
    try:
        return int(raw_value) if raw_value else None
    except (TypeError, ValueError):
        return None


def _decimal_to_str(value: Any) -> str:
    try:
        return str(Decimal(str(value or "0.00")))
    except Exception:
        return "0.00"


def _date_to_iso(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _safe_related_name(obj: Any, field_name: str) -> str:
    related_obj = getattr(obj, field_name, None)
    if not related_obj:
        return ""

    return (
        getattr(related_obj, "name", None)
        or getattr(related_obj, "full_name", None)
        or getattr(related_obj, "title", None)
        or str(related_obj)
    )


def _serialize_payment(payment) -> dict[str, Any]:
    return {
        "id": payment.pk,
        "payment_number": payment.payment_number,
        "reference": payment.payment_number or f"PAY-{payment.pk}",
        "status": payment.status,
        "payment_method": payment.payment_method,
        "provider": payment.provider,
        "currency": payment.currency,
        "amount": _decimal_to_str(payment.amount),
        "paid_amount": _decimal_to_str(payment.paid_amount),
        "refunded_amount": _decimal_to_str(payment.refunded_amount),
        "remaining_amount": _decimal_to_str(getattr(payment, "remaining_amount", 0)),
        "net_collected_amount": _decimal_to_str(getattr(payment, "net_collected_amount", 0)),
        "invoice_id": payment.invoice_id,
        "order_id": payment.order_id,
        "customer_id": payment.customer_id,
        "customer_name": _safe_related_name(payment, "customer"),
        "external_reference": payment.external_reference,
        "transaction_id": payment.transaction_id,
        "gateway_response_code": payment.gateway_response_code,
        "gateway_message": payment.gateway_message,
        "treasury_movement_reference": payment.treasury_movement_reference,
        "accounting_entry_reference": payment.accounting_entry_reference,
        "is_treasury_posted": payment.is_treasury_posted,
        "is_accounting_posted": payment.is_accounting_posted,
        "paid_at": _date_to_iso(payment.paid_at),
        "initiated_at": _date_to_iso(payment.initiated_at),
        "refunded_at": _date_to_iso(payment.refunded_at),
        "cancelled_at": _date_to_iso(payment.cancelled_at),
        "created_at": _date_to_iso(payment.created_at),
        "updated_at": _date_to_iso(payment.updated_at),
        "notes": payment.notes,
        "failure_reason": payment.failure_reason,
    }


@login_required
@require_GET
def payment_list_api(request):
    try:
        Payment = _resolve_payment_model()
        company_id = _extract_company_id(request)

        queryset = (
            Payment.objects.select_related(
                "invoice",
                "order",
                "customer",
            )
            .all()
            .order_by("-created_at", "-id")
        )

        model_fields = {field.name for field in Payment._meta.fields}

        if company_id and "company" in model_fields:
            queryset = queryset.filter(company_id=company_id)

        status_filter = request.GET.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        method_filter = request.GET.get("payment_method") or request.GET.get("method")
        if method_filter:
            queryset = queryset.filter(payment_method=method_filter)

        provider_filter = request.GET.get("provider")
        if provider_filter:
            queryset = queryset.filter(provider=provider_filter)

        invoice_id = request.GET.get("invoice_id")
        if invoice_id:
            queryset = queryset.filter(invoice_id=invoice_id)

        order_id = request.GET.get("order_id")
        if order_id:
            queryset = queryset.filter(order_id=order_id)

        customer_id = request.GET.get("customer_id")
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)

        is_treasury_posted = request.GET.get("is_treasury_posted")
        if is_treasury_posted in {"true", "false", "1", "0"}:
            queryset = queryset.filter(
                is_treasury_posted=is_treasury_posted in {"true", "1"}
            )

        is_accounting_posted = request.GET.get("is_accounting_posted")
        if is_accounting_posted in {"true", "false", "1", "0"}:
            queryset = queryset.filter(
                is_accounting_posted=is_accounting_posted in {"true", "1"}
            )

        date_from = request.GET.get("date_from")
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)

        date_to = request.GET.get("date_to")
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        search = (request.GET.get("search") or request.GET.get("q") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(payment_number__icontains=search)
                | Q(external_reference__icontains=search)
                | Q(transaction_id__icontains=search)
                | Q(customer__name__icontains=search)
                | Q(customer__phone__icontains=search)
                | Q(customer__email__icontains=search)
            )

        total_count = queryset.count()

        totals = queryset.aggregate(
            total_amount=Sum("amount"),
            total_paid_amount=Sum("paid_amount"),
            total_refunded_amount=Sum("refunded_amount"),
        )

        limit = request.GET.get("limit", "50")
        offset = request.GET.get("offset", "0")

        try:
            limit_value = max(1, min(int(limit), 200))
        except ValueError:
            limit_value = 50

        try:
            offset_value = max(0, int(offset))
        except ValueError:
            offset_value = 0

        payments = list(queryset[offset_value : offset_value + limit_value])

        return _json_success(
            {
                "count": len(payments),
                "total_count": total_count,
                "limit": limit_value,
                "offset": offset_value,
                "next_offset": offset_value + limit_value if total_count > offset_value + limit_value else None,
                "totals": {
                    "amount": _decimal_to_str(totals.get("total_amount")),
                    "paid_amount": _decimal_to_str(totals.get("total_paid_amount")),
                    "refunded_amount": _decimal_to_str(totals.get("total_refunded_amount")),
                },
                "results": [_serialize_payment(item) for item in payments],
            }
        )

    except Exception as exc:
        logger.exception("Failed to fetch payment list: %s", exc)
        return _json_error("تعذر جلب قائمة الدفعات.", status=500)