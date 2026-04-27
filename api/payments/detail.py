# ============================================================
# 📂 api/payments/detail.py
# 🧠 Payment Detail API — Primey Care
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
        "company_id": _value("company_id"),
        "amount": str(_value("amount") or _value("total_amount") or "0.00"),
        "payment_date": (
            (_value("payment_date") or _value("paid_date") or _value("date")).isoformat()
            if (_value("payment_date") or _value("paid_date") or _value("date"))
            else None
        ),
        "confirmed_at": _value("confirmed_at").isoformat() if _value("confirmed_at") else None,
        "notes": _value("notes"),
        "created_at": _value("created_at").isoformat() if _value("created_at") else None,
        "updated_at": _value("updated_at").isoformat() if _value("updated_at") else None,
    }


@login_required
@require_GET
def payment_detail_api(request, payment_id: int):
    try:
        Payment = _resolve_payment_model()
        company_id = _extract_company_id(request)

        queryset = Payment.objects.all()
        model_fields = {field.name for field in Payment._meta.fields}

        if company_id and "company" in model_fields:
            queryset = queryset.filter(company_id=company_id)

        payment = queryset.filter(pk=payment_id).first()
        if not payment:
            return _json_error("الدفعة غير موجودة.", status=404)

        return _json_success({"payment": _serialize_payment(payment)})
    except Exception as exc:
        logger.exception("Failed to fetch payment detail: %s", exc)
        return _json_error("تعذر جلب تفاصيل الدفعة.", status=500)