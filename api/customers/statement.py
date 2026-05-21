# ============================================================
# 📂 api/customers/statement.py
# 🧠 Primey Care | Customer Statement API V2
# ------------------------------------------------------------
# ✅ GET /api/customers/<id>/statement/
# ✅ يدعم:
#    - date_from=YYYY-MM-DD
#    - date_to=YYYY-MM-DD
#    - include_orders=true/false
#    - include_invoices=true/false
#    - include_payments=true/false
# ------------------------------------------------------------
# ✅ متوافق مع حساب العميل:
#    - Customer.user
#    - normalized_phone
#    - has_customer_account
#    - phone / whatsapp verification
# ✅ متوافق مع الربط التجاري:
#    - Customer.agent
#    - Customer.broker
# ✅ يعرض حساب دخول المندوب Agent.user
# ✅ يعرض حساب دخول الوسيط Broker.user
# ✅ Protected by permission: customers.view
# ✅ يحافظ على statement و summary و lines بدون كسر الفرونت
# ============================================================

from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal
from typing import Any

from django.contrib.auth.decorators import login_required
from django.db.models import Q, Sum
from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_GET

from auth_center.permissions import PermissionCodes, has_permission
from customers.models import Customer

logger = logging.getLogger(__name__)


# ============================================================
# Optional Services
# ============================================================

try:
    from customers.services import build_customer_statement_payload as _build_real_customer_statement_payload
except Exception:  # pragma: no cover
    _build_real_customer_statement_payload = None


# ============================================================
# 🔧 Response Helpers
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
    status: int = 400,
    *,
    errors: dict[str, Any] | None = None,
) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": False,
        "success": False,
        "message": message,
    }

    if errors:
        payload["errors"] = errors

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


def _json_success(data: dict[str, Any], status: int = 200) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": True,
        "success": True,
    }
    payload.update(_decimal_to_string(data))

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


def _forbidden(required_permission: str) -> JsonResponse:
    return _json_error(
        "غير مصرح لك بتنفيذ هذا الإجراء.",
        status=403,
        errors={"required_permission": [required_permission]},
    )


# ============================================================
# 🧰 Safe Helpers
# ============================================================

def _money(value: Any) -> str:
    try:
        return str(Decimal(str(value or "0.00")).quantize(Decimal("0.01")))
    except Exception:
        return "0.00"


def _safe_decimal(value: Any) -> Decimal:
    try:
        return Decimal(str(value or "0.00")).quantize(Decimal("0.01"))
    except Exception:
        return Decimal("0.00")


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _parse_bool(value: Any, default: bool = True) -> bool:
    if value is None:
        return default

    if isinstance(value, bool):
        return value

    normalized = str(value).strip().lower()

    if normalized in {"1", "true", "yes", "y", "on", "نعم", "صح"}:
        return True

    if normalized in {"0", "false", "no", "n", "off", "لا", "خطأ"}:
        return False

    return default


def _parse_date(value: Any) -> date | None:
    raw = _clean_text(value)

    if not raw:
        return None

    try:
        return date.fromisoformat(raw[:10])
    except ValueError:
        return None


def _read_date_param(request: HttpRequest, key: str) -> tuple[date | None, str | None]:
    raw_value = request.GET.get(key)
    parsed_value = _parse_date(raw_value)

    if raw_value and parsed_value is None:
        return None, f"صيغة {key} غير صحيحة. استخدم YYYY-MM-DD."

    return parsed_value, None


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


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


def _customer_name(customer: Any) -> str:
    if not customer:
        return ""

    return (
        getattr(customer, "display_name", None)
        or getattr(customer, "full_name", None)
        or getattr(customer, "company_name", None)
        or str(customer)
    )


def _order_number(order: Any) -> str:
    if not order:
        return ""

    return (
        getattr(order, "order_number", None)
        or getattr(order, "number", None)
        or f"ORD-{getattr(order, 'pk', '')}"
    )


# ============================================================
# Serializers
# ============================================================

def _serialize_login_user(user: Any | None) -> dict[str, Any] | None:
    if not user:
        return None

    full_name = ""
    try:
        full_name = (user.get_full_name() or "").strip()
    except Exception:
        full_name = ""

    return {
        "id": getattr(user, "pk", None),
        "username": getattr(user, "username", ""),
        "email": getattr(user, "email", ""),
        "first_name": getattr(user, "first_name", ""),
        "last_name": getattr(user, "last_name", ""),
        "full_name": full_name,
        "is_active": bool(getattr(user, "is_active", False)),
        "is_staff": bool(getattr(user, "is_staff", False)),
        "is_superuser": bool(getattr(user, "is_superuser", False)),
        "last_login": _iso_datetime(getattr(user, "last_login", None)),
        "date_joined": _iso_datetime(getattr(user, "date_joined", None)),
    }


def _serialize_agent(agent: Any | None) -> dict[str, Any] | None:
    if not agent:
        return None

    user = getattr(agent, "user", None)
    broker = getattr(agent, "broker", None)

    return {
        "id": getattr(agent, "pk", None),
        "agent_code": getattr(agent, "agent_code", "") or "",
        "code": getattr(agent, "agent_code", "") or "",
        "name": getattr(agent, "full_name", "") or str(agent),
        "full_name": getattr(agent, "full_name", "") or str(agent),
        "referral_code": getattr(agent, "referral_code", "") or "",
        "status": getattr(agent, "status", "") or "",
        "phone": getattr(agent, "phone", "") or "",
        "email": getattr(agent, "email", "") or "",
        "city": getattr(agent, "city", "") or "",
        "broker_id": getattr(agent, "broker_id", None),
        "broker_name": getattr(broker, "name", "") if broker else "",
        "user_id": getattr(agent, "user_id", None),
        "has_login_user": bool(getattr(agent, "user_id", None)),
        "login_user": _serialize_login_user(user),
    }


def _serialize_broker(broker: Any | None) -> dict[str, Any] | None:
    if not broker:
        return None

    user = getattr(broker, "user", None)

    return {
        "id": getattr(broker, "pk", None),
        "broker_code": getattr(broker, "broker_code", "") or "",
        "code": getattr(broker, "broker_code", "") or "",
        "name": getattr(broker, "name", "") or str(broker),
        "broker_name": getattr(broker, "name", "") or str(broker),
        "referral_code": getattr(broker, "referral_code", "") or "",
        "status": getattr(broker, "status", "") or "",
        "phone": getattr(broker, "phone", "") or "",
        "email": getattr(broker, "email", "") or "",
        "city": getattr(broker, "city", "") or "",
        "user_id": getattr(broker, "user_id", None),
        "has_login_user": bool(getattr(broker, "user_id", None)),
        "login_user": _serialize_login_user(user),
    }


def _serialize_statement_customer(customer: Customer) -> dict[str, Any]:
    user = getattr(customer, "user", None)
    agent = getattr(customer, "agent", None)
    broker = getattr(customer, "broker", None)

    agent_payload = _serialize_agent(agent)
    broker_payload = _serialize_broker(broker)

    return {
        "id": customer.pk,
        "customer_code": customer.customer_code or "",
        "customer_type": customer.customer_type,
        "status": customer.status,
        "source": customer.source,

        "display_name": customer.display_name or "",
        "full_name": customer.full_name,
        "first_name": customer.first_name or "",
        "last_name": customer.last_name or "",
        "company_name": customer.company_name or "",

        "email": customer.email or "",
        "phone_number": customer.phone_number or "",
        "whatsapp_number": customer.whatsapp_number or "",
        "alternative_phone_number": customer.alternative_phone_number or "",
        "primary_contact_number": customer.primary_contact_number,

        "city": customer.city or "",
        "country": customer.country or "",
        "district": customer.district or "",

        "agent_id": customer.agent_id,
        "broker_id": customer.broker_id,
        "agent": agent_payload,
        "assigned_agent": agent_payload,
        "broker": broker_payload,
        "assigned_broker": broker_payload,

        "agent_user_id": (agent_payload or {}).get("user_id") if agent_payload else None,
        "agent_has_login_user": (agent_payload or {}).get("has_login_user") if agent_payload else False,
        "broker_user_id": (broker_payload or {}).get("user_id") if broker_payload else None,
        "broker_has_login_user": (broker_payload or {}).get("has_login_user") if broker_payload else False,

        "user_id": customer.user_id,
        "user_username": user.username if user else "",
        "login_user": _serialize_login_user(user),
        "has_customer_account": bool(
            getattr(customer, "has_customer_account", False)
            or getattr(customer, "user_id", None)
        ),
        "normalized_phone": customer.normalized_phone or "",
        "login_identifier": getattr(customer, "login_identifier", "") or "",
        "is_phone_verified": bool(getattr(customer, "is_phone_verified", False)),
        "is_whatsapp_verified": bool(getattr(customer, "is_whatsapp_verified", False)),
        "phone_verified_at": _iso_datetime(customer.phone_verified_at),
        "whatsapp_verified_at": _iso_datetime(customer.whatsapp_verified_at),
        "last_login_at": _iso_datetime(customer.last_login_at),

        "created_at": _iso_datetime(customer.created_at),
        "updated_at": _iso_datetime(customer.updated_at),
    }


# ============================================================
# Fallback Statement
# ============================================================

def _empty_statement_summary() -> dict[str, Any]:
    return {
        "currency": "SAR",
        "orders_count": 0,
        "invoices_count": 0,
        "payments_count": 0,
        "total_orders_amount": "0.00",
        "total_invoices_amount": "0.00",
        "total_paid_amount": "0.00",
        "total_remaining_amount": "0.00",
        "balance_amount": "0.00",
    }


def _safe_model_import(app_label: str, model_name: str):
    try:
        from django.apps import apps

        return apps.get_model(app_label, model_name)
    except Exception:
        return None


def _build_fallback_customer_statement_payload(
    *,
    customer: Customer,
    date_from: date | None = None,
    date_to: date | None = None,
    include_orders: bool = True,
    include_invoices: bool = True,
    include_payments: bool = True,
) -> dict[str, Any]:
    lines: list[dict[str, Any]] = []
    summary = {
        "currency": "SAR",
        "orders_count": 0,
        "invoices_count": 0,
        "payments_count": 0,
        "total_orders_amount": Decimal("0.00"),
        "total_invoices_amount": Decimal("0.00"),
        "total_paid_amount": Decimal("0.00"),
        "total_remaining_amount": Decimal("0.00"),
        "balance_amount": Decimal("0.00"),
    }

    Order = _safe_model_import("orders", "Order")
    Invoice = _safe_model_import("invoices", "Invoice")
    Payment = _safe_model_import("payments", "Payment")

    if include_orders and Order is not None:
        orders_qs = Order.objects.filter(customer=customer)

        if date_from:
            orders_qs = orders_qs.filter(created_at__date__gte=date_from)
        if date_to:
            orders_qs = orders_qs.filter(created_at__date__lte=date_to)

        summary["orders_count"] = orders_qs.count()

        try:
            total_orders = orders_qs.aggregate(total=Sum("total_amount")).get("total")
        except Exception:
            total_orders = None

        summary["total_orders_amount"] = _safe_decimal(total_orders)

        for order in orders_qs.order_by("-created_at", "-id")[:50]:
            amount = _safe_decimal(
                getattr(order, "total_amount", None)
                or getattr(order, "grand_total", None)
                or getattr(order, "amount", None)
            )
            lines.append(
                {
                    "type": "order",
                    "source": "orders",
                    "id": order.pk,
                    "number": _order_number(order),
                    "date": _iso_datetime(getattr(order, "created_at", None)),
                    "description": f"طلب {_order_number(order)}",
                    "debit": _money(amount),
                    "credit": "0.00",
                    "amount": _money(amount),
                    "status": getattr(order, "status", ""),
                }
            )

    if include_invoices and Invoice is not None:
        invoices_qs = Invoice.objects.filter(customer=customer)

        if date_from:
            invoices_qs = invoices_qs.filter(created_at__date__gte=date_from)
        if date_to:
            invoices_qs = invoices_qs.filter(created_at__date__lte=date_to)

        summary["invoices_count"] = invoices_qs.count()

        try:
            total_invoices = invoices_qs.aggregate(total=Sum("total_amount")).get("total")
        except Exception:
            total_invoices = None

        summary["total_invoices_amount"] = _safe_decimal(total_invoices)

        for invoice in invoices_qs.order_by("-created_at", "-id")[:50]:
            invoice_number = (
                getattr(invoice, "invoice_number", None)
                or getattr(invoice, "number", None)
                or f"INV-{invoice.pk}"
            )
            amount = _safe_decimal(
                getattr(invoice, "total_amount", None)
                or getattr(invoice, "grand_total", None)
                or getattr(invoice, "amount", None)
            )
            remaining = _safe_decimal(
                getattr(invoice, "remaining_amount", None)
                or Decimal("0.00")
            )

            summary["total_remaining_amount"] += remaining

            lines.append(
                {
                    "type": "invoice",
                    "source": "invoices",
                    "id": invoice.pk,
                    "number": invoice_number,
                    "date": _iso_datetime(getattr(invoice, "created_at", None)),
                    "description": f"فاتورة {invoice_number}",
                    "debit": _money(amount),
                    "credit": "0.00",
                    "amount": _money(amount),
                    "remaining_amount": _money(remaining),
                    "status": getattr(invoice, "status", ""),
                }
            )

    if include_payments and Payment is not None:
        payments_qs = Payment.objects.filter(customer=customer)

        if date_from:
            payments_qs = payments_qs.filter(created_at__date__gte=date_from)
        if date_to:
            payments_qs = payments_qs.filter(created_at__date__lte=date_to)

        summary["payments_count"] = payments_qs.count()

        try:
            total_paid = payments_qs.aggregate(total=Sum("amount")).get("total")
        except Exception:
            total_paid = None

        summary["total_paid_amount"] = _safe_decimal(total_paid)

        for payment in payments_qs.order_by("-created_at", "-id")[:50]:
            payment_number = (
                getattr(payment, "payment_number", None)
                or getattr(payment, "number", None)
                or f"PAY-{payment.pk}"
            )
            amount = _safe_decimal(getattr(payment, "amount", None))

            lines.append(
                {
                    "type": "payment",
                    "source": "payments",
                    "id": payment.pk,
                    "number": payment_number,
                    "date": _iso_datetime(getattr(payment, "created_at", None)),
                    "description": f"دفعة {payment_number}",
                    "debit": "0.00",
                    "credit": _money(amount),
                    "amount": _money(amount),
                    "status": getattr(payment, "status", ""),
                }
            )

    if summary["total_remaining_amount"] == Decimal("0.00"):
        summary["total_remaining_amount"] = max(
            Decimal("0.00"),
            summary["total_invoices_amount"] - summary["total_paid_amount"],
        )

    summary["balance_amount"] = (
        summary["total_invoices_amount"] - summary["total_paid_amount"]
    )

    formatted_summary = {
        key: (_money(value) if isinstance(value, Decimal) else value)
        for key, value in summary.items()
    }

    lines = sorted(
        lines,
        key=lambda item: item.get("date") or "",
        reverse=True,
    )

    return {
        "summary": formatted_summary,
        "lines": lines,
        "source": "fallback_customer_statement",
    }


def _build_customer_statement_payload_safe(
    *,
    customer: Customer,
    date_from: date | None,
    date_to: date | None,
    include_orders: bool,
    include_invoices: bool,
    include_payments: bool,
) -> dict[str, Any]:
    if callable(_build_real_customer_statement_payload):
        try:
            statement_payload = _build_real_customer_statement_payload(
                customer=customer,
                date_from=date_from,
                date_to=date_to,
                include_orders=include_orders,
                include_invoices=include_invoices,
                include_payments=include_payments,
            )

            if isinstance(statement_payload, dict):
                return statement_payload

        except TypeError:
            try:
                statement_payload = _build_real_customer_statement_payload(
                    customer,
                    date_from=date_from,
                    date_to=date_to,
                    include_orders=include_orders,
                    include_invoices=include_invoices,
                    include_payments=include_payments,
                )

                if isinstance(statement_payload, dict):
                    return statement_payload

            except Exception as exc:
                logger.warning("Failed to build real customer statement payload: %s", exc)

        except Exception as exc:
            logger.warning("Failed to build real customer statement payload: %s", exc)

    return _build_fallback_customer_statement_payload(
        customer=customer,
        date_from=date_from,
        date_to=date_to,
        include_orders=include_orders,
        include_invoices=include_invoices,
        include_payments=include_payments,
    )


# ============================================================
# 🌐 API Entry
# ============================================================

@login_required
@require_GET
def customer_statement_api(request: HttpRequest, customer_id: int) -> JsonResponse:
    if not has_permission(request.user, PermissionCodes.CUSTOMERS_VIEW):
        return _forbidden(PermissionCodes.CUSTOMERS_VIEW)

    try:
        customer = (
            Customer.objects
            .select_related(
                "user",
                "agent",
                "agent__user",
                "agent__broker",
                "agent__broker__user",
                "broker",
                "broker__user",
                "created_by",
                "updated_by",
            )
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

        statement_payload = _build_customer_statement_payload_safe(
            customer=customer,
            date_from=date_from,
            date_to=date_to,
            include_orders=include_orders,
            include_invoices=include_invoices,
            include_payments=include_payments,
        )

        summary = _get_statement_summary(statement_payload)
        lines = _get_statement_lines(statement_payload)
        customer_payload = _serialize_statement_customer(customer)

        response_payload = {
            "message": "تم إنشاء كشف حساب العميل بنجاح.",
            "customer": customer_payload,
            "item": customer_payload,
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
            "counts": {
                "lines": len(lines),
                "orders": summary.get("orders_count", 0),
                "invoices": summary.get("invoices_count", 0),
                "payments": summary.get("payments_count", 0),
            },
            "data": {
                "customer": customer_payload,
                "statement": statement_payload,
                "summary": summary,
                "lines": lines,
            },
        }

        return _json_success(response_payload, status=200)

    except Exception as exc:
        logger.exception(
            "Failed to build customer statement | customer_id=%s | error=%s",
            customer_id,
            exc,
        )
        return _json_error("تعذر إنشاء كشف حساب العميل.", status=500)