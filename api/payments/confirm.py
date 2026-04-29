# ============================================================
# 📂 api/payments/confirm.py
# 🧠 Confirm Payment API — Primey Care
# ------------------------------------------------------------
# ✅ تأكيد الدفعة
# ✅ تمرير paid_amount عند الحاجة
# ✅ تمرير مراجع البنك / البوابة
# ✅ جدولة الخزينة والمحاسبة بعد commit
# ============================================================

from __future__ import annotations

import json
import logging
from decimal import Decimal
from typing import Any

from django.apps import apps
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from payments.services import PaymentServiceError, confirm_payment

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


def _parse_decimal(value: Any) -> Decimal | None:
    if value in (None, ""):
        return None

    try:
        return Decimal(str(value))
    except Exception:
        return None


def _as_bool(value: Any, default: bool = True) -> bool:
    if value in (None, ""):
        return default

    if isinstance(value, bool):
        return value

    return str(value).lower() in {"true", "1", "yes", "y"}


def _serialize_confirmed_payment(payment) -> dict[str, Any]:
    return {
        "id": payment.pk,
        "payment_number": payment.payment_number,
        "status": payment.status,
        "amount": str(payment.amount),
        "paid_amount": str(payment.paid_amount),
        "refunded_amount": str(payment.refunded_amount),
        "currency": payment.currency,
        "invoice_id": payment.invoice_id,
        "order_id": payment.order_id,
        "customer_id": payment.customer_id,
        "payment_method": payment.payment_method,
        "provider": payment.provider,
        "external_reference": payment.external_reference,
        "transaction_id": payment.transaction_id,
        "treasury_movement_reference": payment.treasury_movement_reference,
        "accounting_entry_reference": payment.accounting_entry_reference,
        "is_treasury_posted": payment.is_treasury_posted,
        "is_accounting_posted": payment.is_accounting_posted,
        "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
        "updated_at": payment.updated_at.isoformat() if payment.updated_at else None,
    }


@login_required
@require_POST
def confirm_payment_api(request, payment_id: int):
    try:
        Payment = _resolve_payment_model()
        company_id = _extract_company_id(request)
        body = _parse_json_body(request)

        queryset = Payment.objects.select_related(
            "invoice",
            "order",
            "customer",
        ).all()

        model_fields = {field.name for field in Payment._meta.fields}

        if company_id and "company" in model_fields:
            queryset = queryset.filter(company_id=company_id)

        payment = queryset.filter(pk=payment_id).first()
        if not payment:
            return _json_error("الدفعة غير موجودة.", status=404)

        paid_amount = _parse_decimal(body.get("paid_amount"))

        result = confirm_payment(
            payment=payment,
            actor=request.user,
            paid_amount=paid_amount,
            external_reference=body.get("external_reference"),
            transaction_id=body.get("transaction_id"),
            gateway_response_code=body.get("gateway_response_code"),
            gateway_message=body.get("gateway_message"),
            auto_create_treasury_movement=_as_bool(
                body.get("auto_create_treasury_movement"),
                default=True,
            ),
            auto_post_accounting=_as_bool(
                body.get("auto_post_accounting"),
                default=True,
            ),
        )

        result.payment.refresh_from_db()

        return _json_success(
            {
                "message": "تم تأكيد الدفعة بنجاح.",
                "payment": _serialize_confirmed_payment(result.payment),
                "status_before": result.status_before,
                "status_after": result.status_after,
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

    except PaymentServiceError as exc:
        logger.warning("Payment confirmation validation failed %s: %s", payment_id, exc)
        return _json_error(str(exc), status=400)

    except Exception as exc:
        logger.exception("Failed to confirm payment %s: %s", payment_id, exc)
        return _json_error("تعذر تأكيد الدفعة.", status=500)