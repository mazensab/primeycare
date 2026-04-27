# ============================================================
# 📂 api/payments/list.py
# 🧠 Payments API List — Primey Care
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


def _resolve_payment_model():
    for model_name in ["Payment"]:
        try:
            return apps.get_model("payments", model_name)
        except LookupError:
            continue
    raise LookupError("Payment model was not found in payments app.")


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


def _serialize_payment(payment) -> dict[str, Any]:
    def _value(name: str, default=None):
        return getattr(payment, name, default)

    return {
        "id": payment.pk,
        "reference": _value("reference") or _value("payment_number") or f"PAY-{payment.pk}",
        "status": _value("status"),
        "payment_method": _value("payment_method") or _value("method"),
        "invoice_id": _value("invoice_id"),
        "customer_id": _value("customer_id"),
        "amount": str(_value("amount") or _value("total_amount") or "0.00"),
        "payment_date": (
            (_value("payment_date") or _value("paid_date") or _value("date")).isoformat()
            if (_value("payment_date") or _value("paid_date") or _value("date"))
            else None
        ),
    }


@login_required
@require_GET
def payment_list_api(request):
    try:
        Payment = _resolve_payment_model()
        company_id = _extract_company_id(request)

        queryset = Payment.objects.all().order_by("-id")
        model_fields = {field.name for field in Payment._meta.fields}

        if company_id and "company" in model_fields:
            queryset = queryset.filter(company_id=company_id)

        status_filter = request.GET.get("status")
        if status_filter and "status" in model_fields:
            queryset = queryset.filter(status=status_filter)

        invoice_id = request.GET.get("invoice_id")
        if invoice_id and "invoice" in model_fields:
            queryset = queryset.filter(invoice_id=invoice_id)

        limit = request.GET.get("limit", "50")
        try:
            limit_value = max(1, min(int(limit), 200))
        except ValueError:
            limit_value = 50

        payments = list(queryset[:limit_value])
        data = [_serialize_payment(item) for item in payments]

        return _json_success(
            {
                "count": len(data),
                "results": data,
            }
        )
    except Exception as exc:
        logger.exception("Failed to fetch payment list: %s", exc)
        return _json_error("تعذر جلب قائمة الدفعات.", status=500)