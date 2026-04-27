# ============================================================
# 📂 api/payments/confirm.py
# 🧠 Confirm Payment API — Primey Care
# ============================================================

from __future__ import annotations

import json
import logging
from typing import Any

from django.apps import apps
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from payments.services import confirm_payment

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


def _parse_json_body(request) -> dict[str, Any]:
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return {}


@login_required
@require_POST
def confirm_payment_api(request, payment_id: int):
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

        auto_create_treasury_movement = body.get("auto_create_treasury_movement", True)
        auto_post_accounting = body.get("auto_post_accounting", True)

        result = confirm_payment(
            payment=payment,
            actor=request.user,
            auto_create_treasury_movement=bool(auto_create_treasury_movement),
            auto_post_accounting=bool(auto_post_accounting),
        )

        return _json_success(
            {
                "message": "تم تأكيد الدفعة بنجاح.",
                "payment": {
                    "id": result.payment.pk,
                    "status_before": result.status_before,
                    "status_after": result.status_after,
                },
                "treasury": {
                    "requested": result.treasury_requested,
                    "dispatched": result.treasury_dispatched,
                    "message": result.treasury_message,
                },
                "accounting": {
                    "requested": result.accounting_post_requested,
                    "dispatched": result.accounting_post_dispatched,
                    "message": result.accounting_post_message,
                },
            }
        )
    except Exception as exc:
        logger.exception("Failed to confirm payment %s: %s", payment_id, exc)
        return _json_error("تعذر تأكيد الدفعة.", status=500)