# ============================================================
# 📂 api/payments/create.py
# 🧠 Create Payment API — Primey Care
# ------------------------------------------------------------
# ✅ إنشاء دفعة مرتبطة بفاتورة / طلب / عميل
# ✅ يدعم cash / bank_transfer / gateway
# ✅ لا يؤكد الدفع تلقائيًا إلا إذا تم تمرير confirm=true
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

from payments.models import PaymentMethod, PaymentProvider
from payments.services import PaymentServiceError, confirm_payment, create_payment

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


def _parse_json_body(request) -> dict[str, Any]:
    if not request.body:
        return {}

    try:
        return json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return {}


def _parse_decimal(value: Any) -> Decimal:
    if value in (None, ""):
        return Decimal("0.00")

    try:
        return Decimal(str(value))
    except Exception:
        return Decimal("0.00")


def _as_bool(value: Any, default: bool = False) -> bool:
    if value in (None, ""):
        return default

    if isinstance(value, bool):
        return value

    return str(value).lower() in {"true", "1", "yes", "y"}


def _get_model(app_label: str, model_name: str):
    try:
        return apps.get_model(app_label, model_name)
    except LookupError:
        return None


def _get_object_or_none(model, pk: Any):
    if not model or not pk:
        return None

    try:
        return model.objects.filter(pk=pk).first()
    except Exception:
        return None


def _first_non_empty(*values: Any) -> Any:
    for value in values:
        if value not in (None, "", [], {}, ()):
            return value
    return None


def _resolve_payment_method(value: str | None) -> str:
    normalized = (value or "").strip().upper()

    aliases = {
        "CASH": PaymentMethod.CASH,
        "BANK": PaymentMethod.BANK_TRANSFER,
        "BANK_TRANSFER": PaymentMethod.BANK_TRANSFER,
        "TRANSFER": PaymentMethod.BANK_TRANSFER,
        "GATEWAY": PaymentMethod.GATEWAY,
        "CARD": PaymentMethod.CREDIT_CARD,
        "CREDIT_CARD": PaymentMethod.CREDIT_CARD,
        "DEBIT_CARD": PaymentMethod.DEBIT_CARD,
        "APPLE_PAY": PaymentMethod.APPLE_PAY,
        "STC_PAY": PaymentMethod.STC_PAY,
        "TAMARA": PaymentMethod.TAMARA,
        "TABBY": PaymentMethod.TABBY,
        "WALLET": PaymentMethod.WALLET,
    }

    return aliases.get(normalized, PaymentMethod.CASH)


def _resolve_provider(value: str | None, payment_method: str) -> str:
    normalized = (value or "").strip().upper()

    aliases = {
        "INTERNAL": PaymentProvider.INTERNAL,
        "MANUAL": PaymentProvider.MANUAL,
        "BANK": PaymentProvider.BANK,
        "TAP": PaymentProvider.TAP,
        "TAMARA": PaymentProvider.TAMARA,
        "TABBY": PaymentProvider.TABBY,
        "OTHER": PaymentProvider.OTHER,
    }

    if normalized in aliases:
        return aliases[normalized]

    if payment_method == PaymentMethod.BANK_TRANSFER:
        return PaymentProvider.BANK

    if payment_method in {
        PaymentMethod.CREDIT_CARD,
        PaymentMethod.DEBIT_CARD,
        PaymentMethod.APPLE_PAY,
        PaymentMethod.STC_PAY,
        PaymentMethod.GATEWAY,
    }:
        return PaymentProvider.TAP

    return PaymentProvider.INTERNAL


def _serialize_payment(payment) -> dict[str, Any]:
    return {
        "id": payment.pk,
        "payment_number": payment.payment_number,
        "status": payment.status,
        "payment_method": payment.payment_method,
        "provider": payment.provider,
        "amount": str(payment.amount),
        "paid_amount": str(payment.paid_amount),
        "refunded_amount": str(payment.refunded_amount),
        "currency": payment.currency,
        "invoice_id": payment.invoice_id,
        "order_id": payment.order_id,
        "customer_id": payment.customer_id,
        "external_reference": payment.external_reference,
        "transaction_id": payment.transaction_id,
        "is_treasury_posted": payment.is_treasury_posted,
        "is_accounting_posted": payment.is_accounting_posted,
        "created_at": payment.created_at.isoformat() if payment.created_at else None,
        "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
    }


@login_required
@require_POST
def create_payment_api(request):
    try:
        body = _parse_json_body(request)

        Invoice = _get_model("invoices", "Invoice")
        Order = _get_model("orders", "Order")
        Customer = _get_model("customers", "Customer")

        invoice = _get_object_or_none(Invoice, body.get("invoice_id"))
        order = _get_object_or_none(Order, body.get("order_id"))
        customer = _get_object_or_none(Customer, body.get("customer_id"))

        if invoice:
            order = order or getattr(invoice, "order", None)
            customer = customer or getattr(invoice, "customer", None)

        if order:
            customer = customer or getattr(order, "customer", None)

        if not order:
            return _json_error("يجب تحديد الطلب أو فاتورة مرتبطة بطلب.", status=400)

        if not customer:
            return _json_error("يجب تحديد العميل أو اختيار طلب/فاتورة مرتبطة بعميل.", status=400)

        amount = _parse_decimal(
            _first_non_empty(
                body.get("amount"),
                body.get("paid_amount"),
                getattr(invoice, "remaining_amount", None) if invoice else None,
                getattr(invoice, "total_amount", None) if invoice else None,
                getattr(invoice, "grand_total", None) if invoice else None,
                getattr(invoice, "amount", None) if invoice else None,
            )
        )

        if amount <= Decimal("0.00"):
            return _json_error("مبلغ الدفع يجب أن يكون أكبر من صفر.", status=400)

        payment_method = _resolve_payment_method(body.get("payment_method") or body.get("method"))
        provider = _resolve_provider(body.get("provider"), payment_method)

        result = create_payment(
            order=order,
            customer=customer,
            invoice=invoice,
            amount=amount,
            payment_method=payment_method,
            provider=provider,
            currency=body.get("currency") or "SAR",
            external_reference=body.get("external_reference") or "",
            transaction_id=body.get("transaction_id") or "",
            notes=body.get("notes") or "",
        )

        payment = result.payment

        if _as_bool(body.get("confirm"), default=False):
            confirm_result = confirm_payment(
                payment=payment,
                actor=request.user,
                paid_amount=_parse_decimal(body.get("paid_amount") or amount),
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
            payment = confirm_result.payment
            payment.refresh_from_db()

        return _json_success(
            {
                "message": "تم إنشاء الدفعة بنجاح.",
                "payment": _serialize_payment(payment),
            },
            status=201,
        )

    except PaymentServiceError as exc:
        logger.warning("Payment creation validation failed: %s", exc)
        return _json_error(str(exc), status=400)

    except Exception as exc:
        logger.exception("Failed to create payment: %s", exc)
        return _json_error("تعذر إنشاء الدفعة.", status=500)