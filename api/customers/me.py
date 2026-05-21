# ============================================================
# 📂 api/customers/me.py
# 🧠 Primey Care | Customer Portal Me API V2
# ------------------------------------------------------------
# ✅ GET   /api/customers/me/
# ✅ PATCH /api/customers/me/
# ✅ POST  /api/customers/me/      -> توافق مع بعض عملاء الفرونت
# ✅ GET   /api/customers/me/statement/
# ------------------------------------------------------------
# ✅ يعرض بيانات العميل الحالي بعد تسجيل الدخول OTP
# ✅ يسمح للعميل بتحديث بياناته الأساسية فقط
# ✅ لا يسمح للعميل بتعديل المندوب أو الوسيط من بوابة العميل
# ✅ يعرض المندوب والوسيط المرتبطين بالعميل للقراءة فقط
# ✅ يعرض حساب دخول العميل Customer.user
# ✅ يعرض حساب دخول المندوب Agent.user
# ✅ يعرض حساب دخول الوسيط Broker.user
# ✅ يعرض كشف حساب العميل الحالي بدون تمرير customer_id
# ✅ يعتمد على UserProfile.extra_data.customer_id أو Customer.user
# ✅ متوافق مع صفحة /customer في الويب والتطبيق
# ============================================================

from __future__ import annotations

import json
import logging
from datetime import date
from decimal import Decimal
from typing import Any, Optional

from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.db.models import Sum
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods

from customers.models import Customer, normalize_customer_phone
from customers.services import (
    build_customer_me_payload,
    get_customer_for_user,
    update_customer_user_profile_context,
)

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
        "workspace": "customer",
        "dashboard_path": "/customer",
        "redirect_to": "/customer",
    }

    payload.update(_decimal_to_string(data))

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


# ============================================================
# 🧰 Helpers
# ============================================================

def _parse_json_body(request: HttpRequest) -> dict[str, Any]:
    if not request.body:
        return {}

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        raise ValueError("صيغة JSON غير صحيحة.")

    if not isinstance(payload, dict):
        raise ValueError("صيغة البيانات غير صحيحة.")

    return payload


def _clean_string(value: Any) -> str:
    if value is None:
        return ""

    return str(value).strip()


def _clean_email(value: Any) -> str:
    return _clean_string(value).lower()


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


def _validation_errors(exc: ValidationError) -> dict[str, Any]:
    if hasattr(exc, "message_dict"):
        return exc.message_dict

    if hasattr(exc, "messages"):
        return {"__all__": exc.messages}

    return {"__all__": [str(exc)]}


def _parse_bool(value: Optional[str], default: bool = True) -> bool:
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


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None

    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _read_date_param(request: HttpRequest, key: str) -> tuple[Optional[date], str | None]:
    raw_value = request.GET.get(key)
    parsed_value = _parse_date(raw_value)

    if raw_value and parsed_value is None:
        return None, f"صيغة {key} غير صحيحة. استخدم YYYY-MM-DD."

    return parsed_value, None


def _date_value(value: Any, *, field_label: str) -> date | None:
    raw = _clean_string(value)

    if not raw:
        return None

    try:
        return date.fromisoformat(raw[:10])
    except ValueError:
        raise ValidationError({field_label: [f"{field_label} يجب أن يكون بتاريخ صحيح."]})


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _get_current_customer_or_error(request: HttpRequest) -> tuple[Customer | None, JsonResponse | None]:
    customer = get_customer_for_user(request.user)

    if not customer:
        return None, _json_error(
            "لا يوجد ملف عميل مرتبط بهذا الحساب.",
            status=404,
            errors={
                "customer": [
                    "Current authenticated user is not linked to a customer profile."
                ]
            },
        )

    if customer.status == Customer.Status.BLOCKED:
        return None, _json_error(
            "حساب العميل موقوف. يرجى التواصل مع الدعم.",
            status=403,
        )

    return customer, None


def _refresh_customer(customer: Customer) -> Customer:
    refreshed = (
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
        .filter(pk=customer.pk)
        .first()
    )

    return refreshed or customer


def _safe_model_import(app_label: str, model_name: str):
    try:
        from django.apps import apps

        return apps.get_model(app_label, model_name)
    except Exception:
        return None


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


def _serialize_assigned_agent(agent: Any | None) -> dict[str, Any] | None:
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


def _serialize_assigned_broker(broker: Any | None) -> dict[str, Any] | None:
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


def _serialize_customer_for_statement(customer: Customer) -> dict[str, Any]:
    customer = _refresh_customer(customer)

    user = getattr(customer, "user", None)
    agent = getattr(customer, "agent", None)
    broker = getattr(customer, "broker", None)

    agent_payload = _serialize_assigned_agent(agent)
    broker_payload = _serialize_assigned_broker(broker)

    return {
        "id": customer.pk,
        "customer_code": customer.customer_code or "",
        "display_name": customer.display_name or "",
        "full_name": customer.full_name,
        "status": customer.status,
        "source": customer.source,
        "email": customer.email or "",
        "phone_number": customer.phone_number or "",
        "whatsapp_number": customer.whatsapp_number or "",
        "primary_contact_number": customer.primary_contact_number,

        "agent_id": customer.agent_id,
        "broker_id": customer.broker_id,
        "agent_name": customer.agent_name if hasattr(customer, "agent_name") else "",
        "broker_name": customer.broker_name if hasattr(customer, "broker_name") else "",
        "assigned_agent": agent_payload,
        "agent": agent_payload,
        "assigned_broker": broker_payload,
        "broker": broker_payload,

        "agent_user_id": (agent_payload or {}).get("user_id") if agent_payload else None,
        "agent_has_login_user": (agent_payload or {}).get("has_login_user") if agent_payload else False,
        "broker_user_id": (broker_payload or {}).get("user_id") if broker_payload else None,
        "broker_has_login_user": (broker_payload or {}).get("has_login_user") if broker_payload else False,

        "has_customer_account": bool(
            getattr(customer, "has_customer_account", False)
            or getattr(customer, "user_id", None)
        ),
        "normalized_phone": customer.normalized_phone or "",
        "login_identifier": customer.login_identifier,
        "user_id": customer.user_id,
        "user_username": user.username if user else "",
        "login_user": _serialize_login_user(user),
        "is_phone_verified": customer.is_phone_verified,
        "is_whatsapp_verified": customer.is_whatsapp_verified,
        "phone_verified_at": _iso_datetime(customer.phone_verified_at),
        "whatsapp_verified_at": _iso_datetime(customer.whatsapp_verified_at),
        "last_login_at": _iso_datetime(customer.last_login_at),
    }


def _enrich_customer_me_payload(
    *,
    user: Any,
    customer: Customer,
) -> dict[str, Any]:
    payload = build_customer_me_payload(user)
    customer = _refresh_customer(customer)

    current_customer_payload = _serialize_customer_for_statement(customer)

    payload["customer"] = {
        **(payload.get("customer") if isinstance(payload.get("customer"), dict) else {}),
        **current_customer_payload,
    }
    payload["item"] = payload["customer"]
    payload["assigned_agent"] = current_customer_payload.get("assigned_agent")
    payload["assigned_broker"] = current_customer_payload.get("assigned_broker")
    payload["agent"] = current_customer_payload.get("agent")
    payload["broker"] = current_customer_payload.get("broker")
    payload["login_user"] = current_customer_payload.get("login_user")
    payload["has_customer_account"] = current_customer_payload.get("has_customer_account")
    payload["data"] = {
        "customer": payload["customer"],
        "assigned_agent": payload["assigned_agent"],
        "assigned_broker": payload["assigned_broker"],
    }

    return payload


# ============================================================
# Fallback Statement
# ============================================================

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
            payload = _build_real_customer_statement_payload(
                customer=customer,
                date_from=date_from,
                date_to=date_to,
                include_orders=include_orders,
                include_invoices=include_invoices,
                include_payments=include_payments,
            )
            if isinstance(payload, dict):
                return payload
        except TypeError:
            try:
                payload = _build_real_customer_statement_payload(
                    customer,
                    date_from=date_from,
                    date_to=date_to,
                    include_orders=include_orders,
                    include_invoices=include_invoices,
                    include_payments=include_payments,
                )
                if isinstance(payload, dict):
                    return payload
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
# ✏️ Update Current Customer
# ============================================================

CUSTOMER_ME_UPDATABLE_FIELDS = {
    "first_name",
    "last_name",
    "email",
    "phone_number",
    "whatsapp_number",
    "alternative_phone_number",
    "gender",
    "date_of_birth",
    "national_id",
    "nationality",
    "city",
    "district",
    "street_address",
    "postal_code",
    "national_address_text",
}

# العميل لا يحق له تعديل العلاقة التجارية من بوابة العميل.
# هذه الحقول يتم تجاهلها عمدًا وتبقى مخصصة للنظام فقط.
CUSTOMER_ME_BLOCKED_ASSIGNMENT_FIELDS = {
    "agent",
    "agent_id",
    "sales_agent_id",
    "referral_agent_id",
    "broker",
    "broker_id",
    "referral_broker_id",
    "source",
}

GENDER_VALUES = {
    Customer.Gender.MALE,
    Customer.Gender.FEMALE,
    Customer.Gender.NOT_SPECIFIED,
}


def _normalize_gender(value: Any, current: str) -> str:
    cleaned = _clean_string(value)

    if not cleaned:
        return current

    normalized = cleaned.lower()

    return normalized if normalized in GENDER_VALUES else current


def _update_current_customer(
    *,
    request: HttpRequest,
    customer: Customer,
) -> JsonResponse:
    try:
        payload = _parse_json_body(request)

        allowed_payload_fields = CUSTOMER_ME_UPDATABLE_FIELDS
        ignored_fields = sorted(
            key for key in payload.keys() if key not in allowed_payload_fields
        )

        phone_changed = "phone_number" in payload or "whatsapp_number" in payload

        for field in CUSTOMER_ME_UPDATABLE_FIELDS:
            if field not in payload:
                continue

            value = payload.get(field)

            if field == "date_of_birth":
                setattr(customer, field, _date_value(value, field_label="date_of_birth"))
                continue

            if field == "email":
                setattr(customer, field, _clean_email(value))
                continue

            if field == "gender":
                setattr(customer, field, _normalize_gender(value, customer.gender))
                continue

            setattr(customer, field, _clean_string(value))

        # إذا غيّر العميل رقم الجوال أو الواتساب، نعيد احتساب normalized_phone.
        # لا نحدث phone_verified_at/whatsapp_verified_at هنا؛ التحقق يتم عبر OTP.
        if phone_changed:
            normalized_phone = normalize_customer_phone(
                customer.whatsapp_number or customer.phone_number
            )
            customer.normalized_phone = normalized_phone or None

            # عند تغيير الرقم، نعتبر التحقق السابق غير صالح.
            customer.phone_verified_at = None
            customer.whatsapp_verified_at = None

        customer.updated_by = request.user if request.user.is_authenticated else None
        customer.full_clean()
        customer.save()

        if customer.user_id:
            update_customer_user_profile_context(
                customer=customer,
                user=customer.user,
            )

        response_payload = _enrich_customer_me_payload(
            user=request.user,
            customer=customer,
        )
        response_payload["message"] = "تم تحديث بيانات العميل بنجاح."

        if phone_changed:
            response_payload["requires_phone_verification"] = True
            response_payload["message"] = (
                "تم تحديث بيانات العميل بنجاح. يلزم إعادة تحقق رقم الجوال."
            )

        if ignored_fields:
            response_payload["ignored_fields"] = ignored_fields

        blocked_assignment_fields = sorted(
            field for field in payload.keys() if field in CUSTOMER_ME_BLOCKED_ASSIGNMENT_FIELDS
        )
        if blocked_assignment_fields:
            response_payload["blocked_assignment_fields"] = blocked_assignment_fields

        return _json_success(response_payload)

    except ValueError as exc:
        return _json_error(str(exc), status=400)

    except ValidationError as exc:
        return _json_error(
            "بيانات العميل غير صحيحة.",
            status=400,
            errors=_validation_errors(exc),
        )

    except Exception as exc:
        logger.exception(
            "Failed to update customer me | user_id=%s | error=%s",
            getattr(request.user, "id", None),
            exc,
        )
        return _json_error("تعذر تحديث بيانات العميل.", status=500)


# ============================================================
# 👤 Current Customer API
# ============================================================

@login_required
@csrf_protect
@require_http_methods(["GET", "POST", "PATCH"])
def customer_me_api(request: HttpRequest) -> JsonResponse:
    customer, error_response = _get_current_customer_or_error(request)
    if error_response:
        return error_response

    if request.method == "GET":
        try:
            return _json_success(
                _enrich_customer_me_payload(
                    user=request.user,
                    customer=customer,
                )
            )
        except ValidationError as exc:
            return _json_error(
                "تعذر تحميل بيانات العميل.",
                status=400,
                errors=_validation_errors(exc),
            )
        except Exception as exc:
            logger.exception(
                "Failed to build customer me payload | user_id=%s | customer_id=%s | error=%s",
                getattr(request.user, "id", None),
                getattr(customer, "id", None),
                exc,
            )
            return _json_error("تعذر تحميل بيانات العميل.", status=500)

    return _update_current_customer(
        request=request,
        customer=customer,
    )


# ============================================================
# 🧾 Current Customer Statement API
# ============================================================

@login_required
@require_GET
def customer_me_statement_api(request: HttpRequest) -> JsonResponse:
    customer, error_response = _get_current_customer_or_error(request)
    if error_response:
        return error_response

    try:
        customer = _refresh_customer(customer)

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

        summary = statement_payload.get("summary")
        lines = statement_payload.get("lines")
        customer_payload = _serialize_customer_for_statement(customer)

        return _json_success(
            {
                "customer": customer_payload,
                "item": customer_payload,
                "assigned_agent": customer_payload.get("assigned_agent"),
                "assigned_broker": customer_payload.get("assigned_broker"),
                "agent": customer_payload.get("agent"),
                "broker": customer_payload.get("broker"),
                "filters": {
                    "date_from": date_from.isoformat() if date_from else None,
                    "date_to": date_to.isoformat() if date_to else None,
                    "include_orders": include_orders,
                    "include_invoices": include_invoices,
                    "include_payments": include_payments,
                },
                "statement": statement_payload,
                "summary": summary if isinstance(summary, dict) else {},
                "lines": lines if isinstance(lines, list) else [],
                "counts": {
                    "lines": len(lines) if isinstance(lines, list) else 0,
                    "orders": (summary or {}).get("orders_count", 0) if isinstance(summary, dict) else 0,
                    "invoices": (summary or {}).get("invoices_count", 0) if isinstance(summary, dict) else 0,
                    "payments": (summary or {}).get("payments_count", 0) if isinstance(summary, dict) else 0,
                },
                "data": {
                    "customer": customer_payload,
                    "statement": statement_payload,
                    "summary": summary if isinstance(summary, dict) else {},
                    "lines": lines if isinstance(lines, list) else [],
                },
            }
        )

    except Exception as exc:
        logger.exception(
            "Failed to build current customer statement | user_id=%s | customer_id=%s | error=%s",
            getattr(request.user, "id", None),
            getattr(customer, "id", None),
            exc,
        )
        return _json_error("تعذر إنشاء كشف حساب العميل.", status=500)