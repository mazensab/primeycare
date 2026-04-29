# ============================================================
# 📂 api/payments/reports.py
# 🧠 Payments Reports API — Primey Care
# ------------------------------------------------------------
# ✅ تقرير ملخص المدفوعات
# ✅ إجماليات حسب الحالة / الطريقة / المزود
# ✅ مناسب لصفحة reports في Frontend
# ============================================================

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

from django.apps import apps
from django.contrib.auth.decorators import login_required
from django.db.models import Count, Q, Sum
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


def _serialize_group_rows(rows: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    return [
        {
            key: row.get(key) or "",
            "count": row.get("count") or 0,
            "amount": _decimal_to_str(row.get("amount")),
            "paid_amount": _decimal_to_str(row.get("paid_amount")),
            "refunded_amount": _decimal_to_str(row.get("refunded_amount")),
        }
        for row in rows
    ]


@login_required
@require_GET
def payment_reports_api(request):
    try:
        Payment = _resolve_payment_model()
        company_id = _extract_company_id(request)

        queryset = Payment.objects.all()
        model_fields = {field.name for field in Payment._meta.fields}

        if company_id and "company" in model_fields:
            queryset = queryset.filter(company_id=company_id)

        date_from = request.GET.get("date_from")
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)

        date_to = request.GET.get("date_to")
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        customer_id = request.GET.get("customer_id")
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)

        invoice_id = request.GET.get("invoice_id")
        if invoice_id:
            queryset = queryset.filter(invoice_id=invoice_id)

        order_id = request.GET.get("order_id")
        if order_id:
            queryset = queryset.filter(order_id=order_id)

        status_filter = request.GET.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        totals = queryset.aggregate(
            total_count=Count("id"),
            total_amount=Sum("amount"),
            total_paid_amount=Sum("paid_amount"),
            total_refunded_amount=Sum("refunded_amount"),
            posted_treasury_count=Count("id", filter=Q(is_treasury_posted=True)),
            posted_accounting_count=Count("id", filter=Q(is_accounting_posted=True)),
            pending_treasury_count=Count("id", filter=Q(is_treasury_posted=False)),
            pending_accounting_count=Count("id", filter=Q(is_accounting_posted=False)),
        )

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

        latest_payments = list(
            queryset.select_related("invoice", "order", "customer")
            .order_by("-created_at", "-id")[:10]
        )

        latest = [
            {
                "id": payment.pk,
                "payment_number": payment.payment_number,
                "status": payment.status,
                "payment_method": payment.payment_method,
                "provider": payment.provider,
                "amount": _decimal_to_str(payment.amount),
                "paid_amount": _decimal_to_str(payment.paid_amount),
                "refunded_amount": _decimal_to_str(payment.refunded_amount),
                "currency": payment.currency,
                "invoice_id": payment.invoice_id,
                "order_id": payment.order_id,
                "customer_id": payment.customer_id,
                "customer_name": getattr(payment.customer, "name", "") if payment.customer_id else "",
                "created_at": payment.created_at.isoformat() if payment.created_at else None,
                "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
            }
            for payment in latest_payments
        ]

        return _json_success(
            {
                "summary": {
                    "total_count": totals.get("total_count") or 0,
                    "total_amount": _decimal_to_str(totals.get("total_amount")),
                    "total_paid_amount": _decimal_to_str(totals.get("total_paid_amount")),
                    "total_refunded_amount": _decimal_to_str(totals.get("total_refunded_amount")),
                    "posted_treasury_count": totals.get("posted_treasury_count") or 0,
                    "posted_accounting_count": totals.get("posted_accounting_count") or 0,
                    "pending_treasury_count": totals.get("pending_treasury_count") or 0,
                    "pending_accounting_count": totals.get("pending_accounting_count") or 0,
                },
                "by_status": _serialize_group_rows(by_status, "status"),
                "by_method": _serialize_group_rows(by_method, "payment_method"),
                "by_provider": _serialize_group_rows(by_provider, "provider"),
                "latest": latest,
            }
        )

    except Exception as exc:
        logger.exception("Failed to fetch payment reports: %s", exc)
        return _json_error("تعذر جلب تقارير المدفوعات.", status=500)