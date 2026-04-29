# ============================================================
# 📂 api/payments/cancel.py
# 🧠 Cancel Payment API — Primey Care
# ------------------------------------------------------------
# ✅ إلغاء آمن للدفعات غير المؤكدة
# ✅ لا يحذف السجل
# ============================================================

from __future__ import annotations

import json
import logging
from typing import Any

from django.apps import apps
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from payments.services import PaymentServiceError, cancel_payment

logger = logging.getLogger(__name__)


def _json_error(message: str, status: int = 400, details: Any = None) -> JsonResponse:
    payload: dict[str, Any] = {"ok": False, "message": message}
    if details is not None:
        payload["details"] = details
    return JsonResponse(payload, status=status)


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


def _parse_json_body(request) -> dict[str, Any]:
    if not request.body:
        return {}

    try:
        return json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return {}


@login_required
@require_POST
def cancel_payment_api(request, payment_id: int):
    try:
        Payment = _resolve_payment_model()
        company_id = _extract_company_id(request)
        body = _parse_json_body(request)

        queryset = Payment.objects.all()
        model_fields = {field.name for field in Payment._meta.fields}

        if company_id and "company" in model_fields:
            queryset = queryset.filter(company_id=company_id)

        payment = queryset.filter(pk=payment_id).first()
        if not payment:
            return _json_error("الدفعة غير موجودة.", status=404)

        result = cancel_payment(
            payment=payment,
            actor=request.user,
            reason=body.get("reason") or body.get("failure_reason") or "",
        )

        return _json_success(
            {
                "message": "تم إلغاء الدفعة بنجاح.",
                "payment": {
                    "id": result.payment.pk,
                    "payment_number": result.payment.payment_number,
                    "status_before": result.status_before,
                    "status_after": result.status_after,
                    "cancelled_at": result.payment.cancelled_at.isoformat()
                    if result.payment.cancelled_at
                    else None,
                },
            }
        )

    except PaymentServiceError as exc:
        logger.warning("Payment cancel validation failed %s: %s", payment_id, exc)
        return _json_error(str(exc), status=400)

    except Exception as exc:
        logger.exception("Failed to cancel payment %s: %s", payment_id, exc)
        return _json_error("تعذر إلغاء الدفعة.", status=500)