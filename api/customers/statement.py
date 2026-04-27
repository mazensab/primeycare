# ============================================================
# 📂 api/customers/statement.py
# 🧠 Primey Care | Customer Statement API
# ============================================================

from __future__ import annotations

import logging
from datetime import date
from typing import Any, Optional

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from customers.models import Customer
from customers.services import build_customer_statement_payload

logger = logging.getLogger(__name__)


def _json_error(message: str, status: int = 400) -> JsonResponse:
    return JsonResponse(
        {
            "ok": False,
            "message": message,
        },
        status=status,
    )


def _json_success(data: dict[str, Any], status: int = 200) -> JsonResponse:
    payload = {"ok": True}
    payload.update(data)
    return JsonResponse(payload, status=status)


def _parse_bool(value: Optional[str], default: bool = True) -> bool:
    if value is None:
        return default

    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "y", "on"}:
        return True
    if normalized in {"0", "false", "no", "n", "off"}:
        return False
    return default


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


@login_required
@require_GET
def customer_statement_api(request, customer_id: int):
    try:
        customer = Customer.objects.filter(pk=customer_id).first()
        if not customer:
            return _json_error("العميل غير موجود.", status=404)

        date_from = _parse_date(request.GET.get("date_from"))
        date_to = _parse_date(request.GET.get("date_to"))

        if request.GET.get("date_from") and date_from is None:
            return _json_error("صيغة date_from غير صحيحة. استخدم YYYY-MM-DD.", status=400)

        if request.GET.get("date_to") and date_to is None:
            return _json_error("صيغة date_to غير صحيحة. استخدم YYYY-MM-DD.", status=400)

        include_orders = _parse_bool(request.GET.get("include_orders"), default=True)
        include_invoices = _parse_bool(request.GET.get("include_invoices"), default=True)
        include_payments = _parse_bool(request.GET.get("include_payments"), default=True)

        payload = build_customer_statement_payload(
            customer=customer,
            date_from=date_from,
            date_to=date_to,
            include_orders=include_orders,
            include_invoices=include_invoices,
            include_payments=include_payments,
        )

        return _json_success(
            {
                "customer": {
                    "id": customer.pk,
                    "customer_code": customer.customer_code,
                    "display_name": customer.display_name,
                    "status": customer.status,
                    "email": customer.email,
                    "phone_number": customer.phone_number,
                    "whatsapp_number": customer.whatsapp_number,
                },
                "statement": payload,
            }
        )

    except Exception as exc:
        logger.exception(
            "Failed to build customer statement | customer_id=%s | error=%s",
            customer_id,
            exc,
        )
        return _json_error("تعذر إنشاء كشف حساب العميل.", status=500)