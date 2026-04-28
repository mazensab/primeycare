# ============================================================
# 📂 api/customers/statement.py
# 🧠 Primey Care | Customer Statement API
# ------------------------------------------------------------
# ✅ GET /api/customers/<id>/statement/
# ✅ يدعم:
#    - date_from=YYYY-MM-DD
#    - date_to=YYYY-MM-DD
#    - include_orders=true/false
#    - include_invoices=true/false
#    - include_payments=true/false
# ------------------------------------------------------------
# تحسينات هذا الإصدار:
# - توحيد شكل الأخطاء
# - التحقق من نطاق التاريخ
# - select_related خفيف للعميل
# - إرجاع summary و lines أيضًا في الجذر لتسهيل الفرونت
# - الحفاظ على statement كما هو بدون كسر الصفحات الحالية
# ============================================================

from __future__ import annotations

import logging
from datetime import date
from typing import Any, Optional

from django.contrib.auth.decorators import login_required
from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_GET

from customers.models import Customer
from customers.services import build_customer_statement_payload

logger = logging.getLogger(__name__)


# ============================================================
# 🔧 Response Helpers
# ============================================================

def _json_error(
    message: str,
    status: int = 400,
    *,
    errors: dict[str, Any] | None = None,
) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": False,
        "message": message,
    }

    if errors:
        payload["errors"] = errors

    return JsonResponse(payload, status=status)


def _json_success(data: dict[str, Any], status: int = 200) -> JsonResponse:
    payload = {"ok": True}
    payload.update(data)
    return JsonResponse(payload, status=status)


# ============================================================
# 🧰 Parsers
# ============================================================

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


def _read_date_param(request: HttpRequest, key: str) -> tuple[Optional[date], str | None]:
    raw_value = request.GET.get(key)
    parsed_value = _parse_date(raw_value)

    if raw_value and parsed_value is None:
        return None, f"صيغة {key} غير صحيحة. استخدم YYYY-MM-DD."

    return parsed_value, None


def _get_statement_summary(payload: dict[str, Any]) -> dict[str, Any]:
    summary = payload.get("summary")

    if isinstance(summary, dict):
        return summary

    return {}


def _get_statement_lines(payload: dict[str, Any]) -> list[Any]:
    lines = payload.get("lines")

    if isinstance(lines, list):
        return lines

    return []


# ============================================================
# 🌐 API Entry
# ============================================================

@login_required
@require_GET
def customer_statement_api(request: HttpRequest, customer_id: int) -> JsonResponse:
    try:
        customer = (
            Customer.objects
            .select_related("created_by", "updated_by")
            .filter(pk=customer_id)
            .first()
        )

        if not customer:
            return _json_error("العميل غير موجود.", status=404)

        date_from, date_from_error = _read_date_param(request, "date_from")
        if date_from_error:
            return _json_error(date_from_error, status=400)

        date_to, date_to_error = _read_date_param(request, "date_to")
        if date_to_error:
            return _json_error(date_to_error, status=400)

        if date_from and date_to and date_from > date_to:
            return _json_error(
                "تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية.",
                status=400,
                errors={
                    "date_from": ["date_from must be before or equal date_to."],
                    "date_to": ["date_to must be after or equal date_from."],
                },
            )

        include_orders = _parse_bool(
            request.GET.get("include_orders"),
            default=True,
        )
        include_invoices = _parse_bool(
            request.GET.get("include_invoices"),
            default=True,
        )
        include_payments = _parse_bool(
            request.GET.get("include_payments"),
            default=True,
        )

        statement_payload = build_customer_statement_payload(
            customer=customer,
            date_from=date_from,
            date_to=date_to,
            include_orders=include_orders,
            include_invoices=include_invoices,
            include_payments=include_payments,
        )

        summary = _get_statement_summary(statement_payload)
        lines = _get_statement_lines(statement_payload)

        return _json_success(
            {
                "customer": {
                    "id": customer.pk,
                    "customer_code": customer.customer_code or "",
                    "display_name": customer.display_name or "",
                    "status": customer.status,
                    "email": customer.email or "",
                    "phone_number": customer.phone_number or "",
                    "whatsapp_number": customer.whatsapp_number or "",
                },
                "filters": {
                    "date_from": date_from.isoformat() if date_from else None,
                    "date_to": date_to.isoformat() if date_to else None,
                    "include_orders": include_orders,
                    "include_invoices": include_invoices,
                    "include_payments": include_payments,
                },
                "statement": statement_payload,
                "summary": summary,
                "lines": lines,
            }
        )

    except Exception as exc:
        logger.exception(
            "Failed to build customer statement | customer_id=%s | error=%s",
            customer_id,
            exc,
        )
        return _json_error("تعذر إنشاء كشف حساب العميل.", status=500)