# ============================================================
# 📂 api/customers/auth.py
# 🧠 Primey Care | Customer Portal OTP Auth API V2
# ------------------------------------------------------------
# ✅ POST /api/customers/auth/request-otp/
# ✅ POST /api/customers/auth/verify-otp/
# ✅ POST /api/customers/auth/logout/
# ------------------------------------------------------------
# ✅ دخول العميل برقم الجوال + OTP واتساب
# ✅ إنشاء Customer تلقائيًا إذا غير موجود
# ✅ ربط العميل اختياريًا بالمندوب والوسيط عند طلب OTP
# ✅ إنشاء User تلقائيًا بعد تحقق OTP
# ✅ إنشاء Session وربط ActiveUserSession
# ✅ يعرض حساب دخول العميل Customer.user
# ✅ يعرض حساب دخول المندوب Agent.user
# ✅ يعرض حساب دخول الوسيط Broker.user
# ✅ متوافق مع whoami.py ومساحة /customer
# ✅ جاهز لصفحة الهبوط / التطبيق / بوابة العميل
# ============================================================

from __future__ import annotations

import json
import logging
from typing import Any

from django.conf import settings
from django.contrib.auth import login, logout
from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import HttpRequest, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST

from auth_center.models import ActiveUserSession
from customers.models import Customer, CustomerLoginOTP
from customers.services import (
    build_customer_me_payload,
    create_customer_login_otp,
    send_customer_otp_whatsapp,
    verify_customer_login_otp,
)

logger = logging.getLogger(__name__)


# ============================================================
# 🔧 Response Helpers
# ============================================================

def _json_error(
    message: str,
    status: int = 400,
    *,
    errors: dict[str, Any] | None = None,
    extra: dict[str, Any] | None = None,
) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": False,
        "success": False,
        "message": message,
    }

    if errors:
        payload["errors"] = errors

    if extra:
        payload.update(extra)

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


def _json_success(
    data: dict[str, Any],
    status: int = 200,
) -> JsonResponse:
    payload: dict[str, Any] = {
        "ok": True,
        "success": True,
    }
    payload.update(data)

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


# ============================================================
# 🧰 Request Helpers
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
    return str(value or "").strip()


def _clean_email(value: Any) -> str:
    return _clean_string(value).lower()


def _parse_bool(value: Any, default: bool = False) -> bool:
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


def _positive_int_or_none(value: Any) -> int | None:
    raw = _clean_string(value)

    if not raw:
        return None

    try:
        parsed = int(raw)
    except (TypeError, ValueError):
        return None

    return parsed if parsed > 0 else None


def _validation_errors(exc: ValidationError) -> dict[str, Any]:
    if hasattr(exc, "message_dict"):
        return exc.message_dict

    if hasattr(exc, "messages"):
        return {"__all__": exc.messages}

    return {"__all__": [str(exc)]}


def _get_client_ip(request: HttpRequest) -> str | None:
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip() or None

    return request.META.get("REMOTE_ADDR")


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _extract_agent_id(payload: dict[str, Any]) -> int | None:
    return (
        _positive_int_or_none(payload.get("agent_id"))
        or _positive_int_or_none(payload.get("agent"))
        or _positive_int_or_none(payload.get("sales_agent_id"))
        or _positive_int_or_none(payload.get("referral_agent_id"))
    )


def _extract_broker_id(payload: dict[str, Any]) -> int | None:
    return (
        _positive_int_or_none(payload.get("broker_id"))
        or _positive_int_or_none(payload.get("broker"))
        or _positive_int_or_none(payload.get("referral_broker_id"))
    )


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


def _build_customer_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """
    تجهيز بيانات العميل المرسلة من صفحة الاشتراك أو التطبيق.

    لا نجبر كل الحقول الآن لأن بعض التدفقات تكون مختصرة:
    - صفحة هبوط.
    - تطبيق.
    - طلب مندوب.
    - Checkout خارجي.

    ملاحظة:
    agent_id / broker_id تمرر هنا أيضًا حتى تستفيد منها services عند إنشاء العميل.
    """
    full_name = _clean_string(
        payload.get("full_name")
        or payload.get("name")
        or payload.get("display_name")
    )

    phone_number = _clean_string(
        payload.get("phone_number")
        or payload.get("phone")
        or payload.get("mobile_number")
        or payload.get("mobile")
    )

    whatsapp_number = _clean_string(
        payload.get("whatsapp_number")
        or payload.get("whatsapp")
        or phone_number
    )

    agent_id = _extract_agent_id(payload)
    broker_id = _extract_broker_id(payload)

    source = _clean_string(payload.get("source")) or Customer.Source.WEBSITE

    if agent_id and not payload.get("source"):
        source = Customer.Source.AGENT

    if broker_id and not agent_id and not payload.get("source"):
        source = Customer.Source.BROKER

    return {
        "first_name": _clean_string(payload.get("first_name")),
        "last_name": _clean_string(payload.get("last_name")),
        "display_name": full_name,
        "full_name": full_name,
        "name": full_name,
        "email": _clean_email(payload.get("email")),
        "phone_number": phone_number,
        "whatsapp_number": whatsapp_number,
        "city": _clean_string(payload.get("city")),
        "district": _clean_string(payload.get("district")),
        "street_address": _clean_string(
            payload.get("street_address")
            or payload.get("address")
        ),
        "national_address_text": _clean_string(payload.get("national_address_text")),
        "source": source,
        "gender": _clean_string(payload.get("gender")),
        "national_id": _clean_string(payload.get("national_id")),
        "nationality": _clean_string(payload.get("nationality")),
        "notes": _clean_string(payload.get("notes")),
        "tags": _clean_string(payload.get("tags")),
        "agent_id": agent_id,
        "broker_id": broker_id,
    }


# ============================================================
# 🧾 Serializers
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


def _serialize_customer_for_auth(
    customer: Customer,
    normalized_phone: str | None = None,
) -> dict[str, Any]:
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

        "phone_number": customer.phone_number or "",
        "whatsapp_number": customer.whatsapp_number or "",
        "primary_contact_number": customer.primary_contact_number,
        "normalized_phone": normalized_phone or customer.normalized_phone or "",

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

        "user_id": customer.user_id,
        "user_username": user.username if user else "",
        "login_user": _serialize_login_user(user),
        "has_customer_account": bool(
            getattr(customer, "has_customer_account", False)
            or getattr(customer, "user_id", None)
        ),

        "is_phone_verified": bool(getattr(customer, "is_phone_verified", False)),
        "is_whatsapp_verified": bool(getattr(customer, "is_whatsapp_verified", False)),
        "phone_verified_at": _iso_datetime(customer.phone_verified_at),
        "whatsapp_verified_at": _iso_datetime(customer.whatsapp_verified_at),
        "last_login_at": _iso_datetime(customer.last_login_at),
    }


def _enrich_customer_payload_from_me(user: Any, customer: Customer) -> dict[str, Any]:
    """
    build_customer_me_payload هو المصدر الأساسي للبوابة.
    نضيف عليه العلاقات التجارية وحسابات الدخول حتى يكون response موحدًا.
    """
    customer = _refresh_customer(customer)
    base_payload = build_customer_me_payload(user)

    auth_customer_payload = _serialize_customer_for_auth(customer)

    current_customer = base_payload.get("customer")
    if not isinstance(current_customer, dict):
        current_customer = {}

    enriched_customer = {
        **current_customer,
        **auth_customer_payload,
    }

    base_payload["customer"] = enriched_customer
    base_payload["item"] = enriched_customer
    base_payload["assigned_agent"] = auth_customer_payload.get("assigned_agent")
    base_payload["agent"] = auth_customer_payload.get("agent")
    base_payload["assigned_broker"] = auth_customer_payload.get("assigned_broker")
    base_payload["broker"] = auth_customer_payload.get("broker")
    base_payload["login_user"] = auth_customer_payload.get("login_user")
    base_payload["has_customer_account"] = auth_customer_payload.get("has_customer_account")
    base_payload["data"] = {
        "customer": enriched_customer,
        "assigned_agent": base_payload.get("assigned_agent"),
        "assigned_broker": base_payload.get("assigned_broker"),
        "user": base_payload.get("user"),
        "profile": base_payload.get("profile"),
        "summary": base_payload.get("summary"),
    }

    return base_payload


# ============================================================
# 🔐 Session Helpers
# ============================================================

def _get_auth_channel_value() -> str:
    """
    ActiveUserSession.AuthChannel قد يحتوي WEB فقط حاليًا.
    نستخدم WEB حتى لا نكسر الموديل الحالي.
    """
    return getattr(ActiveUserSession.AuthChannel, "WEB", "WEB")


def _create_or_update_customer_session(
    *,
    request: HttpRequest,
    user: Any,
) -> ActiveUserSession | None:
    if not request.session.session_key:
        request.session.save()

    session_key = request.session.session_key
    if not session_key:
        return None

    ip_address = _get_client_ip(request)
    user_agent = request.META.get("HTTP_USER_AGENT", "")

    with transaction.atomic():
        ActiveUserSession.objects.filter(
            user=user,
            is_current=True,
        ).exclude(session_key=session_key).update(is_current=False)

        active_session, created = ActiveUserSession.objects.get_or_create(
            session_key=session_key,
            defaults={
                "user": user,
                "session_version": 1,
                "auth_channel": _get_auth_channel_value(),
                "ip_address": ip_address,
                "user_agent": user_agent,
                "is_current": True,
                "is_active": True,
            },
        )

        update_fields: list[str] = []

        if created:
            pass
        else:
            active_session.user = user
            active_session.auth_channel = _get_auth_channel_value()
            active_session.ip_address = ip_address
            active_session.user_agent = user_agent
            active_session.is_current = True
            active_session.is_active = True

            update_fields.extend(
                [
                    "user",
                    "auth_channel",
                    "ip_address",
                    "user_agent",
                    "is_current",
                    "is_active",
                ]
            )

        if hasattr(active_session, "last_seen"):
            active_session.last_seen = timezone.now()
            update_fields.append("last_seen")

        if update_fields:
            active_session.save(update_fields=sorted(set(update_fields)))

        request.session["session_version"] = active_session.session_version
        request.session.modified = True

    return active_session


def _deactivate_current_session(request: HttpRequest) -> None:
    session_key = request.session.session_key

    if request.user.is_authenticated and session_key:
        session = ActiveUserSession.objects.filter(
            session_key=session_key,
            user=request.user,
            is_active=True,
        ).first()

        if session:
            if hasattr(session, "mark_logged_out"):
                session.mark_logged_out()
                return

            session.is_active = False
            session.is_current = False
            update_fields = ["is_active", "is_current"]

            if hasattr(session, "logged_out_at"):
                session.logged_out_at = timezone.now()
                update_fields.append("logged_out_at")

            session.save(update_fields=update_fields)


# ============================================================
# 📤 Request OTP
# ============================================================

@require_POST
@csrf_protect
def request_customer_otp_api(request: HttpRequest) -> JsonResponse:
    """
    إرسال OTP للعميل عبر واتساب.

    Body:
    {
      "phone_number": "05xxxxxxxx",
      "full_name": "اسم العميل",
      "city": "المدينة",
      "source": "website",
      "agent_id": 3,
      "broker_id": 1,
      "update_assignment": false
    }
    """
    try:
        payload = _parse_json_body(request)

        phone_number = _clean_string(
            payload.get("phone_number")
            or payload.get("phone")
            or payload.get("whatsapp_number")
            or payload.get("whatsapp")
            or payload.get("mobile_number")
            or payload.get("mobile")
        )

        if not phone_number:
            return _json_error(
                "رقم الجوال مطلوب.",
                status=400,
                errors={"phone_number": ["Phone number is required."]},
            )

        source = _clean_string(payload.get("source")) or Customer.Source.WEBSITE
        customer_payload = _build_customer_payload(payload)

        agent_id = _extract_agent_id(payload)
        broker_id = _extract_broker_id(payload)

        if agent_id and not payload.get("source"):
            source = Customer.Source.AGENT

        if broker_id and not agent_id and not payload.get("source"):
            source = Customer.Source.BROKER

        # مهم:
        # لا نغير ربط العميل القديم بالمندوب/الوسيط إلا لو أرسل الفرونت update_assignment=true.
        update_assignment = _parse_bool(
            payload.get("update_assignment"),
            default=False,
        )

        otp_result = create_customer_login_otp(
            phone_number=phone_number,
            payload=customer_payload,
            purpose=CustomerLoginOTP.Purpose.LOGIN,
            source=source,
            request=request,
            created_by=request.user if request.user.is_authenticated else None,
            enforce_cooldown=True,
            agent_id=agent_id,
            broker_id=broker_id,
            update_assignment=update_assignment,
        )

        customer = _refresh_customer(otp_result.customer)

        whatsapp_result = send_customer_otp_whatsapp(
            customer=customer,
            raw_code=otp_result.raw_code,
            purpose=CustomerLoginOTP.Purpose.LOGIN,
        )

        customer_payload_for_response = _serialize_customer_for_auth(
            customer,
            normalized_phone=otp_result.normalized_phone,
        )

        response_payload: dict[str, Any] = {
            "message": "تم إرسال رمز الدخول إلى رقم الواتساب المسجل.",
            "workspace": "customer",
            "dashboard_path": "/customer",
            "redirect_to": "/customer",
            "customer": customer_payload_for_response,
            "item": customer_payload_for_response,
            "assignment": {
                "agent_id": customer.agent_id,
                "broker_id": customer.broker_id,
                "assigned_agent": customer_payload_for_response.get("assigned_agent"),
                "assigned_broker": customer_payload_for_response.get("assigned_broker"),
                "agent": customer_payload_for_response.get("agent"),
                "broker": customer_payload_for_response.get("broker"),
                "update_assignment": update_assignment,
            },
            "otp": {
                "expires_at": otp_result.expires_at.isoformat(),
                "purpose": CustomerLoginOTP.Purpose.LOGIN,
                "channel": "whatsapp",
            },
            "delivery": whatsapp_result,
            "data": {
                "customer": customer_payload_for_response,
                "assignment": {
                    "agent_id": customer.agent_id,
                    "broker_id": customer.broker_id,
                    "assigned_agent": customer_payload_for_response.get("assigned_agent"),
                    "assigned_broker": customer_payload_for_response.get("assigned_broker"),
                },
                "otp": {
                    "expires_at": otp_result.expires_at.isoformat(),
                    "purpose": CustomerLoginOTP.Purpose.LOGIN,
                    "channel": "whatsapp",
                },
                "delivery": whatsapp_result,
            },
        }

        # للتطوير المحلي فقط.
        # عند ربط WhatsApp Center فعليًا، يبقى هذا الحقل ظاهرًا فقط في DEBUG.
        if bool(getattr(settings, "DEBUG", False)):
            response_payload["debug_otp"] = otp_result.raw_code
            response_payload["data"]["debug_otp"] = otp_result.raw_code

        return _json_success(response_payload, status=200)

    except ValueError as exc:
        return _json_error(str(exc), status=400)

    except ValidationError as exc:
        return _json_error(
            "تعذر إرسال رمز الدخول.",
            status=400,
            errors=_validation_errors(exc),
        )

    except Exception as exc:
        logger.exception("Failed to request customer OTP | error=%s", exc)
        return _json_error("تعذر إرسال رمز الدخول.", status=500)


# ============================================================
# ✅ Verify OTP
# ============================================================

@require_POST
@csrf_protect
def verify_customer_otp_api(request: HttpRequest) -> JsonResponse:
    """
    تحقق OTP وتسجيل دخول العميل.

    Body:
    {
      "phone_number": "05xxxxxxxx",
      "code": "123456"
    }
    """
    try:
        payload = _parse_json_body(request)

        phone_number = _clean_string(
            payload.get("phone_number")
            or payload.get("phone")
            or payload.get("whatsapp_number")
            or payload.get("whatsapp")
            or payload.get("mobile_number")
            or payload.get("mobile")
        )

        code = _clean_string(
            payload.get("code")
            or payload.get("otp")
            or payload.get("verification_code")
        )

        if not phone_number:
            return _json_error(
                "رقم الجوال مطلوب.",
                status=400,
                errors={"phone_number": ["Phone number is required."]},
            )

        if not code:
            return _json_error(
                "رمز التحقق مطلوب.",
                status=400,
                errors={"code": ["OTP code is required."]},
            )

        verification_result = verify_customer_login_otp(
            phone_number=phone_number,
            code=code,
            purpose=CustomerLoginOTP.Purpose.LOGIN,
        )

        user = verification_result.user
        customer = _refresh_customer(verification_result.customer)

        if not user.is_active:
            return _json_error(
                "حساب العميل غير مفعل.",
                status=403,
            )

        login(request, user)

        active_session = _create_or_update_customer_session(
            request=request,
            user=user,
        )

        customer_payload = _enrich_customer_payload_from_me(
            user=user,
            customer=customer,
        )

        response_payload = {
            "message": "تم تسجيل دخول العميل بنجاح.",
            "workspace": "customer",
            "dashboard_path": "/customer",
            "redirect_to": "/customer",
            "customer": customer_payload.get("customer") or _serialize_customer_for_auth(customer),
            "item": customer_payload.get("customer") or _serialize_customer_for_auth(customer),
            "assigned_agent": customer_payload.get("assigned_agent"),
            "assigned_broker": customer_payload.get("assigned_broker"),
            "agent": customer_payload.get("agent"),
            "broker": customer_payload.get("broker"),
            "user": customer_payload.get("user"),
            "profile": customer_payload.get("profile"),
            "summary": customer_payload.get("summary"),
            "latest_orders": customer_payload.get("latest_orders", []),
            "latest_invoices": customer_payload.get("latest_invoices", []),
            "latest_payments": customer_payload.get("latest_payments", []),
            "session": {
                "key": active_session.session_key if active_session else request.session.session_key,
                "version": request.session.get("session_version", 1),
                "auth_channel": active_session.auth_channel if active_session else None,
                "is_current": active_session.is_current if active_session else True,
                "is_active": active_session.is_active if active_session else True,
            },
            "data": {
                "customer": customer_payload.get("customer"),
                "assigned_agent": customer_payload.get("assigned_agent"),
                "assigned_broker": customer_payload.get("assigned_broker"),
                "user": customer_payload.get("user"),
                "profile": customer_payload.get("profile"),
                "summary": customer_payload.get("summary"),
            },
        }

        return _json_success(response_payload, status=200)

    except ValueError as exc:
        return _json_error(str(exc), status=400)

    except ValidationError as exc:
        return _json_error(
            "تعذر التحقق من رمز الدخول.",
            status=400,
            errors=_validation_errors(exc),
        )

    except Exception as exc:
        logger.exception("Failed to verify customer OTP | error=%s", exc)
        return _json_error("تعذر التحقق من رمز الدخول.", status=500)


# ============================================================
# 🚪 Logout
# ============================================================

@require_POST
@csrf_protect
def customer_logout_api(request: HttpRequest) -> JsonResponse:
    """
    خروج العميل من بوابة العميل.
    """
    try:
        _deactivate_current_session(request)

        logout(request)

        try:
            request.session.flush()
        except Exception:
            pass

        response = _json_success(
            {
                "message": "تم تسجيل الخروج بنجاح.",
                "redirect_to": "/",
                "data": {
                    "redirect_to": "/",
                },
            },
            status=200,
        )

        response.delete_cookie("sessionid", path="/", samesite="Lax")
        response.delete_cookie("csrftoken", path="/", samesite="Lax")

        return response

    except Exception as exc:
        logger.exception("Failed to logout customer | error=%s", exc)
        return _json_error("تعذر تسجيل الخروج.", status=500)