# ============================================================
# 📂 api/invoices/create.py
# 🧠 Create Invoice API — Primey Care V2.1
# ------------------------------------------------------------
# ✅ إنشاء فاتورة من الطلب
# ✅ يستدعي invoices.services.create_invoice_from_order الرسمي فقط
# ✅ منع تكرار الفاتورة لنفس الطلب من خلال service
# ✅ اختيار إصدار مباشر اختياري issue_immediately
# ✅ عند الإصدار المباشر يتم جدولة الترحيل المحاسبي بعد commit
# ✅ متوافق مع Accounting Backend الجديد
# ✅ متوافق مع Customer Portal / OTP customer account fields
# ✅ استجابة موحدة للواجهة: ok / success / data
# ============================================================

from __future__ import annotations

import json
import logging
from datetime import date, datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any

from django.apps import apps
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from invoices.models import InvoiceStatus, InvoiceType
from invoices.services import (
    InvoiceServiceError,
    InvoiceValidationError,
    create_invoice_from_order,
)


logger = logging.getLogger(__name__)


# ============================================================
# JSON Helpers
# ============================================================

def _decimal_to_string(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)

    if isinstance(value, dict):
        return {key: _decimal_to_string(val) for key, val in value.items()}

    if isinstance(value, list):
        return [_decimal_to_string(item) for item in value]

    if isinstance(value, tuple):
        return tuple(_decimal_to_string(item) for item in value)

    return value


def _json_error(
    message: str,
    *,
    status: int = 400,
    errors: Any = None,
) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": False,
        "success": False,
        "message": message,
    }

    if errors is not None:
        payload["errors"] = _decimal_to_string(errors)

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


def _json_success(
    data: dict[str, Any],
    *,
    message: str = "تم تنفيذ العملية بنجاح.",
    status: int = 200,
) -> JsonResponse:
    return JsonResponse(
        {
            "ok": True,
            "success": True,
            "message": message,
            "data": _decimal_to_string(data),
        },
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


# ============================================================
# Safe Helpers
# ============================================================

def _parse_json_body(request) -> dict[str, Any]:
    if not request.body:
        return {}

    try:
        parsed = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise ValidationError("صيغة JSON غير صحيحة.") from exc

    if not isinstance(parsed, dict):
        raise ValidationError("جسم الطلب يجب أن يكون JSON Object.")

    return parsed


def _parse_bool(value: Any, default: bool = False) -> bool:
    if value in {None, ""}:
        return default

    if isinstance(value, bool):
        return value

    normalized = str(value).strip().lower()

    if normalized in {"1", "true", "yes", "y", "on"}:
        return True

    if normalized in {"0", "false", "no", "n", "off"}:
        return False

    return default


def _parse_date(value: Any, field_name: str) -> date | None:
    if value in {None, ""}:
        return None

    if isinstance(value, date):
        return value

    try:
        return datetime.strptime(str(value).strip(), "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValidationError({field_name: "صيغة التاريخ غير صحيحة. استخدم YYYY-MM-DD."}) from exc


def _parse_decimal(value: Any, field_name: str = "tax_rate", default: str = "15.00") -> Decimal:
    if value in (None, ""):
        value = default

    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValidationError({field_name: "القيمة المالية غير صحيحة."}) from exc

    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _extract_company_id(request) -> int | None:
    raw_value = (
        request.GET.get("company_id")
        or request.headers.get("X-Company-Id")
        or request.session.get("active_company_id")
    )

    if raw_value in {None, ""}:
        return None

    try:
        parsed = int(raw_value)
    except (TypeError, ValueError):
        return None

    return parsed if parsed > 0 else None


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _money(value: Any) -> Decimal:
    try:
        return Decimal(str(value or "0.00")).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )
    except Exception:
        return Decimal("0.00")


def _iso_date(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _safe_attr(obj: Any, attr_name: str, default: Any = None) -> Any:
    try:
        return getattr(obj, attr_name, default)
    except Exception:
        return default


def _resolve_order_model():
    try:
        return apps.get_model("orders", "Order")
    except LookupError as exc:
        raise LookupError("Order model was not found in orders app.") from exc


def _build_order_queryset(Order, request):
    queryset = (
        Order.objects
        .select_related(
            "customer",
            "customer__user",
            "product",
            "provider",
            "contract",
            "agent",
        )
        .all()
    )

    company_id = _extract_company_id(request)
    model_fields = {field.name for field in Order._meta.fields}

    if company_id and "company" in model_fields:
        queryset = queryset.filter(company_id=company_id)

    return queryset


# ============================================================
# Serialization
# ============================================================

def _serialize_customer(customer) -> dict[str, Any] | None:
    if not customer:
        return None

    full_name = (
        _safe_attr(customer, "full_name", "")
        or _safe_attr(customer, "name", "")
        or _safe_attr(customer, "display_name", "")
    )

    phone_number = (
        _safe_attr(customer, "phone_number", "")
        or _safe_attr(customer, "phone", "")
    )

    whatsapp_number = _safe_attr(customer, "whatsapp_number", "")

    user_id = _safe_attr(customer, "user_id", None)
    user = _safe_attr(customer, "user", None)

    return {
        "id": _safe_attr(customer, "id", None),
        "customer_code": _safe_attr(customer, "customer_code", ""),
        "name": full_name,
        "display_name": _safe_attr(customer, "display_name", "") or full_name,
        "full_name": full_name,
        "status": _safe_attr(customer, "status", ""),
        "phone": phone_number,
        "phone_number": phone_number,
        "whatsapp_number": whatsapp_number,
        "primary_contact_number": (
            whatsapp_number
            or phone_number
            or _safe_attr(customer, "alternative_phone_number", "")
        ),
        "email": _safe_attr(customer, "email", ""),
        "normalized_phone": _safe_attr(customer, "normalized_phone", ""),
        "user_id": user_id,
        "user_username": _safe_attr(user, "username", "") if user else "",
        "has_customer_account": bool(user_id),
        "is_phone_verified": bool(_safe_attr(customer, "phone_verified_at", None)),
        "is_whatsapp_verified": bool(_safe_attr(customer, "whatsapp_verified_at", None)),
        "phone_verified_at": _iso_datetime(_safe_attr(customer, "phone_verified_at", None)),
        "whatsapp_verified_at": _iso_datetime(_safe_attr(customer, "whatsapp_verified_at", None)),
        "last_login_at": _iso_datetime(_safe_attr(customer, "last_login_at", None)),
    }


def _serialize_order(order) -> dict[str, Any] | None:
    if not order:
        return None

    product = _safe_attr(order, "product", None)
    provider = _safe_attr(order, "provider", None)
    agent = _safe_attr(order, "agent", None)

    return {
        "id": _safe_attr(order, "id", None),
        "order_number": (
            _safe_attr(order, "order_number", "")
            or _safe_attr(order, "number", "")
            or _safe_attr(order, "code", "")
        ),
        "status": _safe_attr(order, "status", ""),
        "payment_status": _safe_attr(order, "payment_status", ""),
        "fulfillment_status": _safe_attr(order, "fulfillment_status", ""),
        "source": _safe_attr(order, "source", ""),
        "total_amount": _money(_safe_attr(order, "total_amount", "0.00")),
        "amount_paid": _money(_safe_attr(order, "amount_paid", "0.00")),
        "remaining_amount": _money(_safe_attr(order, "remaining_amount", "0.00")),
        "currency_code": _safe_attr(order, "currency_code", "SAR") or "SAR",
        "customer_id": _safe_attr(order, "customer_id", None),
        "customer": _serialize_customer(_safe_attr(order, "customer", None)),
        "product_id": _safe_attr(order, "product_id", None),
        "product": {
            "id": _safe_attr(product, "id", None),
            "name": _safe_attr(product, "name", ""),
            "code": _safe_attr(product, "code", ""),
            "product_type": _safe_attr(product, "product_type", ""),
        } if product else None,
        "provider_id": _safe_attr(order, "provider_id", None),
        "provider": {
            "id": _safe_attr(provider, "id", None),
            "name": (
                _safe_attr(provider, "name", "")
                or _safe_attr(provider, "display_name", "")
                or _safe_attr(provider, "provider_name", "")
            ),
            "code": (
                _safe_attr(provider, "code", "")
                or _safe_attr(provider, "provider_code", "")
            ),
        } if provider else None,
        "agent_id": _safe_attr(order, "agent_id", None),
        "agent": {
            "id": _safe_attr(agent, "id", None),
            "agent_code": _safe_attr(agent, "agent_code", ""),
            "name": (
                _safe_attr(agent, "display_name", "")
                or _safe_attr(agent, "full_name", "")
                or _safe_attr(agent, "name", "")
            ),
        } if agent else None,
        "created_at": _iso_datetime(_safe_attr(order, "created_at", None)),
        "updated_at": _iso_datetime(_safe_attr(order, "updated_at", None)),
    }


def _serialize_invoice(invoice) -> dict[str, Any]:
    invoice_number = (
        _safe_attr(invoice, "invoice_number", "")
        or _safe_attr(invoice, "number", "")
        or f"INV-{invoice.pk}"
    )

    return {
        "id": invoice.pk,
        "invoice_number": invoice_number,
        "number": invoice_number,
        "invoice_type": _safe_attr(invoice, "invoice_type", ""),
        "status": _safe_attr(invoice, "status", ""),
        "issue_date": _iso_date(_safe_attr(invoice, "issue_date", None)),
        "due_date": _iso_date(_safe_attr(invoice, "due_date", None)),
        "order_id": _safe_attr(invoice, "order_id", None),
        "order": _serialize_order(_safe_attr(invoice, "order", None)),
        "customer_id": _safe_attr(invoice, "customer_id", None),
        "customer": _serialize_customer(_safe_attr(invoice, "customer", None)),
        "subtotal": _money(_safe_attr(invoice, "subtotal", "0.00")),
        "discount_amount": _money(_safe_attr(invoice, "discount_amount", "0.00")),
        "taxable_amount": _money(_safe_attr(invoice, "taxable_amount", "0.00")),
        "tax_rate": _money(_safe_attr(invoice, "tax_rate", "0.00")),
        "tax_amount": _money(_safe_attr(invoice, "tax_amount", "0.00")),
        "total_amount": _money(_safe_attr(invoice, "total_amount", "0.00")),
        "paid_amount": _money(_safe_attr(invoice, "paid_amount", "0.00")),
        "due_amount": _money(_safe_attr(invoice, "due_amount", "0.00")),
        "currency": _safe_attr(invoice, "currency", "SAR") or "SAR",
        "notes": _safe_attr(invoice, "notes", ""),
        "internal_notes": _safe_attr(invoice, "internal_notes", ""),
        "accounting": {
            "is_accounting_posted": bool(_safe_attr(invoice, "is_accounting_posted", False)),
            "accounting_entry_reference": _safe_attr(invoice, "accounting_entry_reference", ""),
            "posted_at": _iso_datetime(_safe_attr(invoice, "posted_at", None)),
        },
        "created_at": _iso_datetime(_safe_attr(invoice, "created_at", None)),
        "updated_at": _iso_datetime(_safe_attr(invoice, "updated_at", None)),
    }


def _serialize_request_flags(
    *,
    sync_items: bool,
    issue_immediately: bool,
    auto_post_accounting: bool,
) -> dict[str, Any]:
    return {
        "sync_items": sync_items,
        "issue_immediately": issue_immediately,
        "auto_post_accounting": auto_post_accounting,
    }


# ============================================================
# API
# ============================================================

@login_required
@require_POST
def create_invoice_api(request):
    """
    إنشاء فاتورة من طلب.

    Body:
    {
      "order_id": 1,
      "invoice_type": "sales",
      "status": "draft",
      "issue_date": "2026-05-06",
      "due_date": "2026-05-13",
      "tax_rate": "15.00",
      "notes": "...",
      "internal_notes": "...",
      "sync_items": true,
      "issue_immediately": false,
      "auto_post_accounting": true
    }

    مبدأ مهم:
    - الإنشاء لا يعني الدفع.
    - الإصدار المباشر اختياري.
    - الترحيل المحاسبي يحدث فقط عند الإصدار.
    """
    try:
        body = _parse_json_body(request)

        order_id = body.get("order_id") or request.POST.get("order_id")
        if not order_id:
            return _json_error("order_id مطلوب لإنشاء الفاتورة.", status=400)

        Order = _resolve_order_model()
        order = _build_order_queryset(Order, request).filter(pk=order_id).first()

        if not order:
            return _json_error("الطلب غير موجود.", status=404)

        invoice_type = _clean_text(body.get("invoice_type") or InvoiceType.SALES).lower()
        if invoice_type not in InvoiceType.values:
            return _json_error("نوع الفاتورة غير صحيح.", status=400)

        status_value = _clean_text(body.get("status") or InvoiceStatus.DRAFT).lower()
        if status_value not in InvoiceStatus.values:
            return _json_error("حالة الفاتورة غير صحيحة.", status=400)

        issue_date = _parse_date(body.get("issue_date"), "issue_date")
        due_date = _parse_date(body.get("due_date"), "due_date")

        if issue_date and due_date and due_date < issue_date:
            return _json_error(
                "تاريخ الاستحقاق لا يمكن أن يكون قبل تاريخ الإصدار.",
                status=400,
                errors={
                    "due_date": [
                        "Due date must be greater than or equal to issue date."
                    ]
                },
            )

        tax_rate = _parse_decimal(
            body.get("tax_rate"),
            field_name="tax_rate",
            default="15.00",
        )

        notes = _clean_text(body.get("notes"))
        internal_notes = _clean_text(body.get("internal_notes"))

        sync_items = _parse_bool(
            body.get("sync_items"),
            default=True,
        )
        issue_immediately = _parse_bool(
            body.get("issue_immediately"),
            default=False,
        )
        auto_post_accounting = _parse_bool(
            body.get("auto_post_accounting"),
            default=True,
        )

        result = create_invoice_from_order(
            order=order,
            actor=request.user,
            invoice_type=invoice_type,
            status=status_value,
            issue_date=issue_date,
            due_date=due_date,
            tax_rate=tax_rate,
            notes=notes,
            internal_notes=internal_notes,
            sync_items=sync_items,
            issue_immediately=issue_immediately,
            auto_post_accounting=auto_post_accounting,
        )

        result.invoice.refresh_from_db()

        return _json_success(
            {
                "created": result.created,
                "invoice": _serialize_invoice(result.invoice),
                "order": _serialize_order(order),
                "customer": _serialize_customer(_safe_attr(order, "customer", None)),
                "flags": _serialize_request_flags(
                    sync_items=sync_items,
                    issue_immediately=issue_immediately,
                    auto_post_accounting=auto_post_accounting,
                ),
            },
            message=result.message or "تم إنشاء الفاتورة بنجاح.",
            status=201 if result.created else 200,
        )

    except ValidationError as exc:
        logger.warning("Invalid invoice creation request: %s", exc)
        return _json_error(
            "بيانات الطلب غير صحيحة.",
            status=400,
            errors=getattr(exc, "message_dict", None) or getattr(exc, "messages", None) or str(exc),
        )

    except InvoiceValidationError as exc:
        logger.warning("Invoice validation error while creating invoice: %s", exc)
        return _json_error(str(exc), status=400)

    except InvoiceServiceError as exc:
        logger.warning("Invoice service error while creating invoice: %s", exc)
        return _json_error(str(exc), status=400)

    except Exception as exc:
        logger.exception("Failed to create invoice: %s", exc)
        return _json_error("تعذر إنشاء الفاتورة.", status=500)