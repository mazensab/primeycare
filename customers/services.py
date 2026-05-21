# ============================================================
# 📂 customers/services.py
# 🧠 Primey Care | Customer Services
# ------------------------------------------------------------
# ✅ خدمة رسمية لبناء كشف حساب العميل
# ✅ خدمات حساب العميل:
#    - توحيد رقم الجوال
#    - إنشاء/جلب العميل من رقم الجوال
#    - ربط العميل تجاريًا بالمندوب والوسيط
#    - إنشاء حساب User للعميل
#    - إنشاء OTP لدخول العميل
#    - تحقق OTP
#    - تجهيز بيانات /customer/me
# ------------------------------------------------------------
# ✅ تعتمد على:
#    - customers
#    - agents
#    - auth_center.UserProfile
#    - orders
#    - invoices
#    - payments
# ============================================================

from __future__ import annotations

import logging
import secrets
from dataclasses import asdict, dataclass
from datetime import date, datetime, time, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q, QuerySet, Sum
from django.utils import timezone

from agents.models import Agent, AgentStatus, Broker, BrokerStatus
from auth_center.models import UserProfile
from customers.models import Customer, CustomerLoginOTP, normalize_customer_phone
from invoices.models import Invoice
from orders.models import Order
from payments.models import Payment

logger = logging.getLogger(__name__)
User = get_user_model()


# ============================================================
# ⚙️ Customer Auth Settings
# ============================================================

DEFAULT_CUSTOMER_OTP_LENGTH = int(
    getattr(settings, "CUSTOMER_OTP_LENGTH", 6)
)

DEFAULT_CUSTOMER_OTP_EXPIRY_MINUTES = int(
    getattr(settings, "CUSTOMER_OTP_EXPIRY_MINUTES", 10)
)

DEFAULT_CUSTOMER_OTP_COOLDOWN_SECONDS = int(
    getattr(settings, "CUSTOMER_OTP_COOLDOWN_SECONDS", 60)
)

DEFAULT_CUSTOMER_OTP_MAX_ATTEMPTS = int(
    getattr(settings, "CUSTOMER_OTP_MAX_ATTEMPTS", 5)
)

CUSTOMER_PORTAL_ROLE = "customer_user"
CUSTOMER_PORTAL_USER_TYPE = "CUSTOMER_USER"
CUSTOMER_PORTAL_WORKSPACE = "customer"


# ============================================================
# 🧾 DTOs | Customer Auth
# ============================================================

@dataclass(slots=True)
class CustomerAccountResult:
    customer: Customer
    user: Any | None
    created_customer: bool
    created_user: bool


@dataclass(slots=True)
class CustomerOTPResult:
    customer: Customer
    otp: CustomerLoginOTP
    raw_code: str
    expires_at: datetime
    normalized_phone: str
    should_send_whatsapp: bool


@dataclass(slots=True)
class CustomerOTPVerificationResult:
    customer: Customer
    user: Any
    otp: CustomerLoginOTP
    verified: bool


# ============================================================
# 🧰 Customer Account Helpers
# ============================================================

def clean_text(value: Any) -> str:
    return str(value or "").strip()


def clean_email(value: Any) -> str:
    return clean_text(value).lower()


def normalize_customer_login_phone(value: Any) -> str:
    return normalize_customer_phone(clean_text(value))


def generate_customer_otp_code(length: int = DEFAULT_CUSTOMER_OTP_LENGTH) -> str:
    safe_length = max(4, min(int(length or DEFAULT_CUSTOMER_OTP_LENGTH), 8))
    start = 10 ** (safe_length - 1)
    end = (10 ** safe_length) - 1
    return str(secrets.randbelow(end - start + 1) + start)


def get_client_ip_from_request(request: Any) -> str | None:
    if not request:
        return None

    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip() or None

    return request.META.get("REMOTE_ADDR")


def get_user_agent_from_request(request: Any) -> str:
    if not request:
        return ""

    return clean_text(request.META.get("HTTP_USER_AGENT", ""))


def split_customer_name(display_name: str) -> tuple[str, str]:
    cleaned_name = clean_text(display_name)

    if not cleaned_name:
        return "عميل", ""

    parts = cleaned_name.split()
    if len(parts) == 1:
        return parts[0], ""

    return parts[0], " ".join(parts[1:])


def _int_or_none(value: Any) -> int | None:
    raw = clean_text(value)

    if not raw:
        return None

    try:
        parsed = int(raw)
    except (TypeError, ValueError):
        return None

    return parsed if parsed > 0 else None


def _resolve_agent_from_payload(
    payload: dict[str, Any] | None = None,
    *,
    agent: Agent | None = None,
    agent_id: int | str | None = None,
) -> Agent | None:
    if agent is not None:
        return agent

    data = payload or {}

    resolved_agent_id = (
        _int_or_none(agent_id)
        or _int_or_none(data.get("agent_id"))
        or _int_or_none(data.get("agent"))
        or _int_or_none(data.get("sales_agent_id"))
        or _int_or_none(data.get("referral_agent_id"))
    )

    if not resolved_agent_id:
        return None

    resolved_agent = (
        Agent.objects
        .select_related("broker", "user")
        .filter(pk=resolved_agent_id)
        .first()
    )

    if not resolved_agent:
        raise ValidationError({"agent_id": ["المندوب المحدد غير موجود."]})

    if getattr(resolved_agent, "status", "") != AgentStatus.ACTIVE:
        raise ValidationError({"agent_id": ["لا يمكن ربط العميل بمندوب غير نشط."]})

    return resolved_agent


def _resolve_broker_from_payload(
    payload: dict[str, Any] | None = None,
    *,
    broker: Broker | None = None,
    broker_id: int | str | None = None,
    agent: Agent | None = None,
) -> Broker | None:
    if broker is not None:
        resolved_broker = broker
    else:
        data = payload or {}

        resolved_broker_id = (
            _int_or_none(broker_id)
            or _int_or_none(data.get("broker_id"))
            or _int_or_none(data.get("broker"))
            or _int_or_none(data.get("referral_broker_id"))
        )

        resolved_broker = None

        if resolved_broker_id:
            resolved_broker = (
                Broker.objects
                .select_related("user")
                .filter(pk=resolved_broker_id)
                .first()
            )

            if not resolved_broker:
                raise ValidationError({"broker_id": ["الوسيط المحدد غير موجود."]})

    agent_broker = getattr(agent, "broker", None) if agent and getattr(agent, "broker_id", None) else None

    if resolved_broker and agent_broker and resolved_broker.pk != agent_broker.pk:
        raise ValidationError({"broker_id": ["الوسيط لا يطابق الوسيط المرتبط بالمندوب."]})

    if not resolved_broker and agent_broker:
        resolved_broker = agent_broker

    if resolved_broker and getattr(resolved_broker, "status", "") != BrokerStatus.ACTIVE:
        raise ValidationError({"broker_id": ["لا يمكن ربط العميل بوسيط غير نشط."]})

    return resolved_broker


def resolve_customer_assignment(
    payload: dict[str, Any] | None = None,
    *,
    agent: Agent | None = None,
    broker: Broker | None = None,
    agent_id: int | str | None = None,
    broker_id: int | str | None = None,
) -> tuple[Agent | None, Broker | None]:
    resolved_agent = _resolve_agent_from_payload(
        payload,
        agent=agent,
        agent_id=agent_id,
    )
    resolved_broker = _resolve_broker_from_payload(
        payload,
        broker=broker,
        broker_id=broker_id,
        agent=resolved_agent,
    )

    return resolved_agent, resolved_broker


def _serialize_assigned_agent(agent: Agent | None) -> dict[str, Any] | None:
    if not agent:
        return None

    return {
        "id": agent.pk,
        "agent_code": getattr(agent, "agent_code", "") or "",
        "code": getattr(agent, "agent_code", "") or "",
        "name": getattr(agent, "full_name", "") or str(agent),
        "full_name": getattr(agent, "full_name", "") or str(agent),
        "referral_code": getattr(agent, "referral_code", "") or "",
        "status": getattr(agent, "status", "") or "",
        "phone": getattr(agent, "phone", "") or "",
        "email": getattr(agent, "email", "") or "",
        "city": getattr(agent, "city", "") or "",
    }


def _serialize_assigned_broker(broker: Broker | None) -> dict[str, Any] | None:
    if not broker:
        return None

    return {
        "id": broker.pk,
        "broker_code": getattr(broker, "broker_code", "") or "",
        "code": getattr(broker, "broker_code", "") or "",
        "name": getattr(broker, "name", "") or str(broker),
        "broker_name": getattr(broker, "name", "") or str(broker),
        "referral_code": getattr(broker, "referral_code", "") or "",
        "status": getattr(broker, "status", "") or "",
        "phone": getattr(broker, "phone", "") or "",
        "email": getattr(broker, "email", "") or "",
        "city": getattr(broker, "city", "") or "",
    }


def find_customer_by_phone(phone_number: Any) -> Customer | None:
    normalized_phone = normalize_customer_login_phone(phone_number)

    if not normalized_phone:
        return None

    return (
        Customer.objects
        .select_related("user", "agent", "broker", "created_by", "updated_by")
        .filter(
            Q(normalized_phone=normalized_phone)
            | Q(phone_number=phone_number)
            | Q(whatsapp_number=phone_number)
        )
        .order_by("-created_at")
        .first()
    )


def _build_customer_defaults_from_payload(
    *,
    phone_number: str,
    payload: dict[str, Any] | None = None,
    source: str = Customer.Source.WEBSITE,
    agent: Agent | None = None,
    broker: Broker | None = None,
) -> dict[str, Any]:
    data = payload or {}

    first_name = clean_text(data.get("first_name"))
    last_name = clean_text(data.get("last_name"))
    display_name = clean_text(
        data.get("display_name")
        or data.get("full_name")
        or data.get("name")
    )

    if not first_name and not last_name:
        first_name, last_name = split_customer_name(display_name)

    whatsapp_number = clean_text(data.get("whatsapp_number")) or phone_number
    email = clean_email(data.get("email"))

    resolved_source = clean_text(data.get("source")) or source

    if agent and not data.get("source"):
        resolved_source = Customer.Source.AGENT

    if broker and not agent and not data.get("source"):
        resolved_source = Customer.Source.BROKER

    return {
        "customer_type": clean_text(data.get("customer_type")) or Customer.CustomerType.INDIVIDUAL,
        "status": clean_text(data.get("status")) or Customer.Status.ACTIVE,
        "source": resolved_source,
        "agent": agent,
        "broker": broker,
        "first_name": first_name,
        "last_name": last_name,
        "company_name": clean_text(data.get("company_name")),
        "gender": clean_text(data.get("gender")) or Customer.Gender.NOT_SPECIFIED,
        "date_of_birth": data.get("date_of_birth") or None,
        "national_id": clean_text(data.get("national_id")),
        "passport_number": clean_text(data.get("passport_number")),
        "nationality": clean_text(data.get("nationality")),
        "email": email,
        "phone_number": clean_text(data.get("phone_number")) or phone_number,
        "whatsapp_number": whatsapp_number,
        "alternative_phone_number": clean_text(data.get("alternative_phone_number")),
        "country": clean_text(data.get("country")) or "Saudi Arabia",
        "city": clean_text(data.get("city")),
        "district": clean_text(data.get("district")),
        "street_address": clean_text(data.get("street_address")),
        "postal_code": clean_text(data.get("postal_code")),
        "national_address_text": clean_text(data.get("national_address_text")),
        "notes": clean_text(data.get("notes")),
        "tags": clean_text(data.get("tags")),
    }


def _apply_customer_assignment(
    customer: Customer,
    *,
    agent: Agent | None = None,
    broker: Broker | None = None,
    update_assignment: bool = False,
) -> bool:
    changed_fields: list[str] = []

    if agent and (update_assignment or not customer.agent_id):
        if customer.agent_id != agent.pk:
            customer.agent = agent
            changed_fields.append("agent")

    if broker and (update_assignment or not customer.broker_id):
        if customer.broker_id != broker.pk:
            customer.broker = broker
            changed_fields.append("broker")

    if customer.agent_id and not customer.broker_id:
        agent_broker = getattr(customer.agent, "broker", None)
        if agent_broker:
            customer.broker = agent_broker
            changed_fields.append("broker")

    if not changed_fields:
        return False

    customer.save(update_fields=sorted(set(changed_fields + ["updated_at"])))
    return True


def _update_blank_customer_fields(
    customer: Customer,
    payload: dict[str, Any] | None = None,
    *,
    agent: Agent | None = None,
    broker: Broker | None = None,
    update_assignment: bool = False,
) -> bool:
    data = payload or {}
    changed_fields: list[str] = []

    candidate_fields = {
        "first_name": clean_text(data.get("first_name")),
        "last_name": clean_text(data.get("last_name")),
        "email": clean_email(data.get("email")),
        "phone_number": clean_text(data.get("phone_number")),
        "whatsapp_number": clean_text(data.get("whatsapp_number")),
        "city": clean_text(data.get("city")),
        "district": clean_text(data.get("district")),
        "street_address": clean_text(data.get("street_address")),
        "national_address_text": clean_text(data.get("national_address_text")),
    }

    display_name = clean_text(data.get("display_name") or data.get("full_name") or data.get("name"))
    if display_name and not customer.first_name and not customer.last_name:
        first_name, last_name = split_customer_name(display_name)
        candidate_fields["first_name"] = first_name
        candidate_fields["last_name"] = last_name

    for field, value in candidate_fields.items():
        if not value:
            continue

        current_value = clean_text(getattr(customer, field, ""))
        if current_value:
            continue

        setattr(customer, field, value)
        changed_fields.append(field)

    normalized_phone = normalize_customer_login_phone(
        customer.normalized_phone
        or customer.whatsapp_number
        or customer.phone_number
    )

    if normalized_phone and customer.normalized_phone != normalized_phone:
        customer.normalized_phone = normalized_phone
        changed_fields.append("normalized_phone")

    if changed_fields:
        changed_fields.append("updated_at")
        customer.save(update_fields=sorted(set(changed_fields)))

    assignment_changed = _apply_customer_assignment(
        customer,
        agent=agent,
        broker=broker,
        update_assignment=update_assignment,
    )

    return bool(changed_fields or assignment_changed)


def update_customer_user_profile_context(
    *,
    customer: Customer,
    user: Any,
    commit: bool = True,
) -> UserProfile:
    profile, _ = UserProfile.objects.get_or_create(user=user)

    extra_data = profile.extra_data if isinstance(profile.extra_data, dict) else {}
    extra_data["customer_id"] = customer.pk
    extra_data["customer"] = customer.pk

    if customer.agent_id:
        extra_data["agent_id"] = customer.agent_id
        extra_data["customer_agent_id"] = customer.agent_id
    else:
        extra_data.pop("agent_id", None)
        extra_data.pop("customer_agent_id", None)

    if customer.broker_id:
        extra_data["broker_id"] = customer.broker_id
        extra_data["customer_broker_id"] = customer.broker_id
    else:
        extra_data.pop("broker_id", None)
        extra_data.pop("customer_broker_id", None)

    profile.display_name = (
        customer.display_name
        or user.get_full_name()
        or user.username
    )
    profile.phone_number = customer.phone_number or customer.normalized_phone or None
    profile.whatsapp_number = customer.whatsapp_number or customer.phone_number or None
    profile.preferred_language = profile.preferred_language or "ar"
    profile.timezone = profile.timezone or "Asia/Riyadh"
    profile.user_type = CUSTOMER_PORTAL_USER_TYPE
    profile.role = CUSTOMER_PORTAL_ROLE
    profile.extra_data = extra_data
    profile.is_phone_verified = bool(customer.phone_verified_at)
    profile.is_whatsapp_verified = bool(customer.whatsapp_verified_at)
    profile.is_profile_completed = bool(profile.display_name and profile.phone_number)

    if commit:
        profile.save(
            update_fields=[
                "display_name",
                "phone_number",
                "whatsapp_number",
                "preferred_language",
                "timezone",
                "user_type",
                "role",
                "extra_data",
                "is_phone_verified",
                "is_whatsapp_verified",
                "is_profile_completed",
                "updated_at",
            ]
        )

    return profile


def create_customer_user_if_missing(
    customer: Customer,
    *,
    commit_customer: bool = True,
) -> tuple[Any, bool]:
    """
    إنشاء أو ربط User للعميل بشكل آمن.

    ✅ لا يعيد استخدام User مربوط بعميل آخر.
    ✅ يمنع خطأ:
       Customer and Linked User Account already exists.
    ✅ إذا وجد User بنفس الجوال لكنه مربوط بعميل آخر، ينشئ username آمن خاص بهذا العميل.
    ✅ يحافظ على ربط UserProfile.extra_data.customer_id بالعميل الحالي.
    ✅ يحفظ agent_id و broker_id داخل UserProfile.extra_data كسياق تجاري للعميل.
    """
    if customer.user_id:
        update_customer_user_profile_context(customer=customer, user=customer.user)
        return customer.user, False

    normalized_phone = normalize_customer_login_phone(
        customer.normalized_phone
        or customer.whatsapp_number
        or customer.phone_number
    )

    if not normalized_phone:
        raise ValidationError("لا يمكن إنشاء حساب للعميل بدون رقم جوال صحيح.")

    email = clean_email(customer.email)
    first_name = clean_text(customer.first_name)
    last_name = clean_text(customer.last_name)

    def _is_user_linked_to_another_customer(user_obj: Any) -> bool:
        if not user_obj:
            return False

        return Customer.objects.filter(user=user_obj).exclude(pk=customer.pk).exists()

    def _build_unique_customer_username() -> str:
        base_username = normalized_phone

        if not User.objects.filter(username=base_username).exists():
            return base_username

        customer_based_username = f"{normalized_phone}-customer-{customer.pk}"
        if not User.objects.filter(username=customer_based_username).exists():
            return customer_based_username

        suffix = 2
        while True:
            candidate = f"{normalized_phone}-customer-{customer.pk}-{suffix}"
            if not User.objects.filter(username=candidate).exists():
                return candidate
            suffix += 1

    user = User.objects.filter(username=normalized_phone).first()
    created_user = False

    # لا نستخدم User موجود بنفس username إذا كان مربوطًا بعميل آخر.
    if user and _is_user_linked_to_another_customer(user):
        logger.warning(
            "Customer user username conflict detected | customer_id=%s | normalized_phone=%s | existing_user_id=%s",
            customer.pk,
            normalized_phone,
            getattr(user, "id", None),
        )
        user = None

    # استخدام البريد فقط إذا كان المستخدم غير مربوط بعميل آخر.
    if not user and email:
        email_user = User.objects.filter(email__iexact=email).first()
        if email_user and not _is_user_linked_to_another_customer(email_user):
            user = email_user

    if not user:
        user = User(
            username=_build_unique_customer_username(),
            email=email,
            first_name=first_name,
            last_name=last_name,
            is_active=True,
        )
        user.set_unusable_password()
        user.save()
        created_user = True
    else:
        update_fields: list[str] = []

        if not user.email and email:
            user.email = email
            update_fields.append("email")

        if not user.first_name and first_name:
            user.first_name = first_name
            update_fields.append("first_name")

        if not user.last_name and last_name:
            user.last_name = last_name
            update_fields.append("last_name")

        if not user.is_active:
            user.is_active = True
            update_fields.append("is_active")

        if update_fields:
            user.save(update_fields=update_fields)

    # حماية إضافية قبل ربط user بالعميل.
    linked_customer = Customer.objects.filter(user=user).exclude(pk=customer.pk).first()
    if linked_customer:
        logger.warning(
            "Customer user link conflict blocked | customer_id=%s | linked_customer_id=%s | user_id=%s",
            customer.pk,
            linked_customer.pk,
            user.pk,
        )
        user = User(
            username=_build_unique_customer_username(),
            email=email,
            first_name=first_name,
            last_name=last_name,
            is_active=True,
        )
        user.set_unusable_password()
        user.save()
        created_user = True

    customer.user = user
    customer.normalized_phone = normalized_phone

    if commit_customer:
        customer.save(update_fields=["user", "normalized_phone", "updated_at"])

    update_customer_user_profile_context(customer=customer, user=user)

    return user, created_user


@transaction.atomic
def get_or_create_customer_from_phone(
    *,
    phone_number: Any,
    payload: dict[str, Any] | None = None,
    source: str = Customer.Source.WEBSITE,
    create_user: bool = False,
    created_by: Any | None = None,
    agent: Agent | None = None,
    broker: Broker | None = None,
    agent_id: int | str | None = None,
    broker_id: int | str | None = None,
    update_assignment: bool = False,
) -> CustomerAccountResult:
    normalized_phone = normalize_customer_login_phone(phone_number)

    if not normalized_phone:
        raise ValidationError("رقم الجوال غير صحيح.")

    resolved_agent, resolved_broker = resolve_customer_assignment(
        payload,
        agent=agent,
        broker=broker,
        agent_id=agent_id,
        broker_id=broker_id,
    )

    customer = (
        Customer.objects
        .select_related("user", "agent", "broker")
        .filter(normalized_phone=normalized_phone)
        .first()
    )

    created_customer = False
    created_user = False

    if not customer:
        defaults = _build_customer_defaults_from_payload(
            phone_number=clean_text(phone_number),
            payload=payload,
            source=source,
            agent=resolved_agent,
            broker=resolved_broker,
        )
        defaults["normalized_phone"] = normalized_phone
        defaults["created_by"] = created_by if getattr(created_by, "is_authenticated", False) else None
        defaults["updated_by"] = created_by if getattr(created_by, "is_authenticated", False) else None

        try:
            customer = Customer.objects.create(**defaults)
            created_customer = True
        except IntegrityError:
            customer = (
                Customer.objects
                .select_related("user", "agent", "broker")
                .filter(normalized_phone=normalized_phone)
                .first()
            )
            if not customer:
                raise

            _apply_customer_assignment(
                customer,
                agent=resolved_agent,
                broker=resolved_broker,
                update_assignment=update_assignment,
            )

    else:
        _update_blank_customer_fields(
            customer,
            payload,
            agent=resolved_agent,
            broker=resolved_broker,
            update_assignment=update_assignment,
        )

    user = customer.user

    if create_user:
        user, created_user = create_customer_user_if_missing(customer)

    return CustomerAccountResult(
        customer=customer,
        user=user,
        created_customer=created_customer,
        created_user=created_user,
    )


# ============================================================
# 🔐 Customer OTP Services
# ============================================================

def _get_recent_customer_otp(
    *,
    customer: Customer,
    normalized_phone: str,
    purpose: str,
) -> CustomerLoginOTP | None:
    cooldown_threshold = timezone.now() - timedelta(
        seconds=DEFAULT_CUSTOMER_OTP_COOLDOWN_SECONDS
    )

    return (
        CustomerLoginOTP.objects
        .filter(
            customer=customer,
            normalized_phone=normalized_phone,
            purpose=purpose,
            created_at__gte=cooldown_threshold,
            verified_at__isnull=True,
        )
        .order_by("-created_at")
        .first()
    )


@transaction.atomic
def create_customer_login_otp(
    *,
    phone_number: Any,
    payload: dict[str, Any] | None = None,
    purpose: str = CustomerLoginOTP.Purpose.LOGIN,
    source: str = Customer.Source.WEBSITE,
    request: Any | None = None,
    created_by: Any | None = None,
    enforce_cooldown: bool = True,
    agent: Agent | None = None,
    broker: Broker | None = None,
    agent_id: int | str | None = None,
    broker_id: int | str | None = None,
    update_assignment: bool = False,
) -> CustomerOTPResult:
    normalized_phone = normalize_customer_login_phone(phone_number)

    if not normalized_phone:
        raise ValidationError("رقم الجوال غير صحيح.")

    account_result = get_or_create_customer_from_phone(
        phone_number=phone_number,
        payload=payload,
        source=source,
        create_user=False,
        created_by=created_by,
        agent=agent,
        broker=broker,
        agent_id=agent_id,
        broker_id=broker_id,
        update_assignment=update_assignment,
    )

    customer = account_result.customer

    if customer.status == Customer.Status.BLOCKED:
        raise ValidationError("حساب العميل موقوف. يرجى التواصل مع الدعم.")

    if enforce_cooldown:
        recent_otp = _get_recent_customer_otp(
            customer=customer,
            normalized_phone=normalized_phone,
            purpose=purpose,
        )
        if recent_otp:
            raise ValidationError(
                f"تم إرسال رمز مؤخرًا. يرجى المحاولة بعد {DEFAULT_CUSTOMER_OTP_COOLDOWN_SECONDS} ثانية."
            )

    raw_code = generate_customer_otp_code()
    expires_at = timezone.now() + timedelta(
        minutes=DEFAULT_CUSTOMER_OTP_EXPIRY_MINUTES
    )

    metadata = {
        "source": source,
        "created_customer": account_result.created_customer,
        "channel": "whatsapp",
    }

    if customer.agent_id:
        metadata["agent_id"] = customer.agent_id

    if customer.broker_id:
        metadata["broker_id"] = customer.broker_id

    otp = CustomerLoginOTP.objects.create(
        customer=customer,
        phone_number=clean_text(phone_number),
        normalized_phone=normalized_phone,
        code_hash=make_password(raw_code),
        purpose=purpose,
        expires_at=expires_at,
        max_attempts=DEFAULT_CUSTOMER_OTP_MAX_ATTEMPTS,
        request_ip=get_client_ip_from_request(request),
        user_agent=get_user_agent_from_request(request),
        metadata=metadata,
    )

    return CustomerOTPResult(
        customer=customer,
        otp=otp,
        raw_code=raw_code,
        expires_at=expires_at,
        normalized_phone=normalized_phone,
        should_send_whatsapp=True,
    )


def send_customer_otp_whatsapp(
    *,
    customer: Customer,
    raw_code: str,
    purpose: str = CustomerLoginOTP.Purpose.LOGIN,
) -> dict[str, Any]:
    """
    إرسال OTP دخول العميل عبر WhatsApp Center.

    ✅ يستخدم WhatsApp Center الرسمي:
       whatsapp_center.services.send_event_whatsapp_message

    ✅ يعتمد على جلسة النظام:
       primey-care-system-session

    ✅ لا يرجع نجاحًا كاذبًا:
       إذا فشل الإرسال يتم رفع ValidationError حتى تظهر المشكلة في الواجهة.
    """
    phone_number = (
        customer.whatsapp_number
        or customer.phone_number
        or customer.normalized_phone
        or ""
    )

    phone_number = clean_text(phone_number)

    if not phone_number:
        raise ValidationError("لا يمكن إرسال رمز الدخول لعدم وجود رقم واتساب للعميل.")

    recipient_name = (
        customer.display_name
        or customer.full_name
        or customer.first_name
        or "عميل Primey Care"
    )

    message = (
        "مرحبًا بك في Primey Care\n"
        f"رمز الدخول الخاص بك: {raw_code}\n"
        f"الرمز صالح لمدة {DEFAULT_CUSTOMER_OTP_EXPIRY_MINUTES} دقائق.\n"
        "لا تشارك هذا الرمز مع أي شخص."
    )

    try:
        from whatsapp_center.models import DeliveryStatus, ScopeType, TriggerSource
        from whatsapp_center.services import send_event_whatsapp_message

        log = send_event_whatsapp_message(
            scope_type=ScopeType.SYSTEM,
            event_code="customer_login_otp",
            recipient_phone=phone_number,
            recipient_name=recipient_name,
            recipient_role="customer",
            trigger_source=TriggerSource.SYSTEM,
            language_code="ar",
            context={
                "message": message,
                "recipient_name": recipient_name,
                "customer_id": customer.pk,
                "purpose": purpose,
                "channel": "whatsapp",
                "agent_id": customer.agent_id,
                "broker_id": customer.broker_id,
            },
            related_model="customers.Customer",
            related_object_id=str(customer.pk),
        )

        if not log:
            raise ValidationError("تعذر إنشاء سجل إرسال واتساب لرمز الدخول.")

        delivery_status = clean_text(getattr(log, "delivery_status", ""))
        provider_status = clean_text(getattr(log, "provider_status", ""))
        failure_reason = clean_text(getattr(log, "failure_reason", ""))
        external_message_id = clean_text(getattr(log, "external_message_id", ""))

        is_sent = delivery_status == DeliveryStatus.SENT

        result = {
            "sent": is_sent,
            "channel": "whatsapp",
            "phone_number": phone_number,
            "recipient_name": recipient_name,
            "message_log_id": getattr(log, "id", None),
            "delivery_status": delivery_status,
            "provider_status": provider_status,
            "external_message_id": external_message_id,
            "failure_reason": failure_reason,
        }

        if not is_sent:
            logger.warning(
                "Customer OTP WhatsApp send failed | customer_id=%s | phone=%s | status=%s | provider_status=%s | reason=%s",
                customer.pk,
                phone_number,
                delivery_status,
                provider_status,
                failure_reason,
            )

            raise ValidationError(
                failure_reason
                or provider_status
                or "تعذر إرسال رمز الدخول عبر واتساب."
            )

        logger.info(
            "Customer OTP WhatsApp sent | customer_id=%s | phone=%s | log_id=%s | external_message_id=%s",
            customer.pk,
            phone_number,
            getattr(log, "id", None),
            external_message_id,
        )

        return result

    except ValidationError:
        raise

    except Exception as exc:
        logger.exception(
            "Customer OTP WhatsApp unexpected error | customer_id=%s | phone=%s | error=%s",
            customer.pk,
            phone_number,
            exc,
        )
        raise ValidationError("تعذر إرسال رمز الدخول عبر واتساب.")


@transaction.atomic
def verify_customer_login_otp(
    *,
    phone_number: Any,
    code: Any,
    purpose: str = CustomerLoginOTP.Purpose.LOGIN,
) -> CustomerOTPVerificationResult:
    normalized_phone = normalize_customer_login_phone(phone_number)
    raw_code = clean_text(code)

    if not normalized_phone:
        raise ValidationError("رقم الجوال غير صحيح.")

    if not raw_code:
        raise ValidationError("رمز التحقق مطلوب.")

    otp = (
        CustomerLoginOTP.objects
        .select_for_update()
        .select_related("customer", "customer__user", "customer__agent", "customer__broker")
        .filter(
            normalized_phone=normalized_phone,
            purpose=purpose,
            verified_at__isnull=True,
        )
        .order_by("-created_at")
        .first()
    )

    if not otp:
        raise ValidationError("رمز التحقق غير موجود أو تم استخدامه.")

    if otp.is_expired:
        raise ValidationError("انتهت صلاحية رمز التحقق.")

    if not otp.can_attempt:
        raise ValidationError("تم تجاوز عدد المحاولات المسموح.")

    if not check_password(raw_code, otp.code_hash):
        otp.register_failed_attempt()
        raise ValidationError("رمز التحقق غير صحيح.")

    customer = otp.customer

    if customer.status == Customer.Status.BLOCKED:
        raise ValidationError("حساب العميل موقوف. يرجى التواصل مع الدعم.")

    otp.mark_verified()

    now = timezone.now()
    customer.phone_verified_at = customer.phone_verified_at or now
    customer.whatsapp_verified_at = customer.whatsapp_verified_at or now
    customer.last_login_at = now
    customer.normalized_phone = normalized_phone
    customer.save(
        update_fields=[
            "phone_verified_at",
            "whatsapp_verified_at",
            "last_login_at",
            "normalized_phone",
            "updated_at",
        ]
    )

    user, _ = create_customer_user_if_missing(customer)
    update_customer_user_profile_context(customer=customer, user=user)

    return CustomerOTPVerificationResult(
        customer=customer,
        user=user,
        otp=otp,
        verified=True,
    )


# ============================================================
# 👤 Customer Me Payload
# ============================================================

def serialize_customer_account(customer: Customer) -> dict[str, Any]:
    agent = getattr(customer, "agent", None)
    broker = getattr(customer, "broker", None)

    return {
        "id": customer.pk,
        "customer_code": customer.customer_code or "",
        "customer_type": customer.customer_type,
        "status": customer.status,
        "source": customer.source,
        "agent_id": customer.agent_id,
        "broker_id": customer.broker_id,
        "assigned_agent": _serialize_assigned_agent(agent),
        "assigned_broker": _serialize_assigned_broker(broker),
        "agent_name": customer.agent_name if hasattr(customer, "agent_name") else "",
        "broker_name": customer.broker_name if hasattr(customer, "broker_name") else "",
        "display_name": customer.display_name or "",
        "full_name": customer.full_name,
        "first_name": customer.first_name or "",
        "last_name": customer.last_name or "",
        "company_name": customer.company_name or "",
        "gender": customer.gender,
        "date_of_birth": customer.date_of_birth.isoformat() if customer.date_of_birth else None,
        "national_id": customer.national_id or "",
        "nationality": customer.nationality or "",
        "email": customer.email or "",
        "phone_number": customer.phone_number or "",
        "whatsapp_number": customer.whatsapp_number or "",
        "alternative_phone_number": customer.alternative_phone_number or "",
        "primary_contact_number": customer.primary_contact_number,
        "normalized_phone": customer.normalized_phone or "",
        "country": customer.country or "",
        "city": customer.city or "",
        "district": customer.district or "",
        "street_address": customer.street_address or "",
        "postal_code": customer.postal_code or "",
        "national_address_text": customer.national_address_text or "",
        "has_customer_account": customer.has_customer_account,
        "is_phone_verified": customer.is_phone_verified,
        "is_whatsapp_verified": customer.is_whatsapp_verified,
        "phone_verified_at": customer.phone_verified_at.isoformat() if customer.phone_verified_at else None,
        "whatsapp_verified_at": customer.whatsapp_verified_at.isoformat() if customer.whatsapp_verified_at else None,
        "last_login_at": customer.last_login_at.isoformat() if customer.last_login_at else None,
        "created_at": customer.created_at.isoformat() if customer.created_at else None,
        "updated_at": customer.updated_at.isoformat() if customer.updated_at else None,
    }


def get_customer_for_user(user: Any) -> Customer | None:
    if not user or not getattr(user, "is_authenticated", False):
        return None

    customer = (
        Customer.objects
        .select_related("user", "agent", "broker")
        .filter(user=user)
        .first()
    )

    if customer:
        return customer

    profile = UserProfile.objects.filter(user=user).first()
    if not profile:
        return None

    extra_data = profile.extra_data if isinstance(profile.extra_data, dict) else {}
    customer_id = extra_data.get("customer_id") or extra_data.get("customer")

    if not customer_id:
        return None

    return (
        Customer.objects
        .select_related("user", "agent", "broker")
        .filter(pk=customer_id)
        .first()
    )


def build_customer_me_payload(user: Any) -> dict[str, Any]:
    customer = get_customer_for_user(user)

    if not customer:
        raise ValidationError("لا يوجد ملف عميل مرتبط بهذا الحساب.")

    orders_qs = Order.objects.filter(customer=customer)
    invoices_qs = Invoice.objects.filter(customer=customer)
    payments_qs = Payment.objects.filter(customer=customer)

    latest_orders = [
        {
            "id": order.pk,
            "order_number": order.order_number or "",
            "status": order.status,
            "payment_status": order.payment_status,
            "fulfillment_status": order.fulfillment_status,
            "total_amount": str(_money(order.total_amount)),
            "currency": getattr(order, "currency_code", "SAR") or "SAR",
            "created_at": order.created_at.isoformat() if order.created_at else None,
        }
        for order in orders_qs.order_by("-created_at")[:5]
    ]

    latest_invoices = [
        {
            "id": invoice.pk,
            "invoice_number": invoice.invoice_number or "",
            "status": invoice.status,
            "total_amount": str(_money(invoice.total_amount)),
            "paid_amount": str(_money(invoice.paid_amount)),
            "due_amount": str(_money(invoice.due_amount)),
            "currency": getattr(invoice, "currency", "SAR") or "SAR",
            "created_at": invoice.created_at.isoformat() if invoice.created_at else None,
        }
        for invoice in invoices_qs.order_by("-created_at")[:5]
    ]

    latest_payments = [
        {
            "id": payment.pk,
            "payment_number": payment.payment_number or "",
            "status": payment.status,
            "payment_method": payment.payment_method,
            "paid_amount": str(_money(payment.paid_amount or payment.amount)),
            "currency": getattr(payment, "currency", "SAR") or "SAR",
            "created_at": payment.created_at.isoformat() if payment.created_at else None,
        }
        for payment in payments_qs.order_by("-created_at")[:5]
    ]

    total_invoices_amount = _money(
        invoices_qs.aggregate(total=Sum("total_amount")).get("total") or "0.00"
    )
    total_paid_amount = _money(
        payments_qs.aggregate(total=Sum("paid_amount")).get("total") or "0.00"
    )
    total_due_amount = _money(total_invoices_amount - total_paid_amount)
    if total_due_amount < Decimal("0.00"):
        total_due_amount = Decimal("0.00")

    profile = UserProfile.objects.filter(user=user).first()

    assigned_agent = _serialize_assigned_agent(getattr(customer, "agent", None))
    assigned_broker = _serialize_assigned_broker(getattr(customer, "broker", None))

    return {
        "customer": serialize_customer_account(customer),
        "assigned_agent": assigned_agent,
        "assigned_broker": assigned_broker,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email or "",
            "first_name": user.first_name or "",
            "last_name": user.last_name or "",
            "full_name": (user.get_full_name() or "").strip(),
        },
        "profile": {
            "display_name": profile.display_name if profile else "",
            "phone_number": profile.phone_number if profile else None,
            "whatsapp_number": profile.whatsapp_number if profile else None,
            "preferred_language": profile.preferred_language if profile else "ar",
            "timezone": profile.timezone if profile else "Asia/Riyadh",
            "user_type": profile.user_type if profile else CUSTOMER_PORTAL_USER_TYPE,
            "role": profile.role if profile else CUSTOMER_PORTAL_ROLE,
            "extra_data": profile.extra_data if profile and isinstance(profile.extra_data, dict) else {},
        },
        "summary": {
            "orders_count": orders_qs.count(),
            "invoices_count": invoices_qs.count(),
            "payments_count": payments_qs.count(),
            "total_invoices_amount": str(total_invoices_amount),
            "total_paid_amount": str(total_paid_amount),
            "total_due_amount": str(total_due_amount),
            "currency": "SAR",
        },
        "latest_orders": latest_orders,
        "latest_invoices": latest_invoices,
        "latest_payments": latest_payments,
    }


# ============================================================
# 🧾 DTOs | Customer Statement
# ============================================================

@dataclass(slots=True)
class CustomerStatementSummary:
    customer_id: int
    customer_code: str
    customer_name: str
    customer_status: str
    primary_contact: str
    total_orders_count: int
    total_orders_amount: Decimal
    total_invoices_count: int
    total_invoices_amount: Decimal
    total_paid_amount: Decimal
    total_due_amount: Decimal
    currency: str


@dataclass(slots=True)
class CustomerStatementLine:
    line_type: str
    line_date: Optional[datetime]
    reference: str
    related_order_id: Optional[int]
    related_invoice_id: Optional[int]
    related_payment_id: Optional[int]
    description: str
    debit_amount: Decimal
    credit_amount: Decimal
    balance_after: Decimal
    currency: str
    status: str
    metadata: dict[str, Any]


@dataclass(slots=True)
class CustomerStatementResult:
    summary: CustomerStatementSummary
    lines: list[CustomerStatementLine]


# ============================================================
# 🛠️ Statement Helpers
# ============================================================

def _money(value: Decimal | int | float | str | None) -> Decimal:
    amount = Decimal(str(value or "0.00"))
    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _ensure_aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None

    if timezone.is_naive(value):
        return timezone.make_aware(value, timezone.get_current_timezone())

    return value


def _coerce_to_datetime(
    value: date | datetime | None,
    *,
    end_of_day: bool = False,
) -> datetime | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        return _ensure_aware(value)

    base_time = time.max if end_of_day else time.min
    return _ensure_aware(datetime.combine(value, base_time))


def _start_of_day(value: date | datetime | None) -> datetime | None:
    return _coerce_to_datetime(value, end_of_day=False)


def _end_of_day(value: date | datetime | None) -> datetime | None:
    return _coerce_to_datetime(value, end_of_day=True)


def _resolve_customer_display_name(customer: Customer) -> str:
    return (
        customer.display_name
        or customer.full_name
        or customer.customer_code
        or f"Customer #{customer.pk}"
    )


def _resolve_customer_contact(customer: Customer) -> str:
    return customer.primary_contact_number or customer.email or ""


def _resolve_currency_from_customer_data(
    orders_qs: QuerySet[Order],
    invoices_qs: QuerySet[Invoice],
    payments_qs: QuerySet[Payment],
) -> str:
    invoice_obj = invoices_qs.order_by("-created_at").first()
    if invoice_obj and getattr(invoice_obj, "currency", None):
        return invoice_obj.currency

    payment_obj = payments_qs.order_by("-created_at").first()
    if payment_obj and getattr(payment_obj, "currency", None):
        return payment_obj.currency

    order_obj = orders_qs.order_by("-created_at").first()
    if order_obj and getattr(order_obj, "currency_code", None):
        return order_obj.currency_code

    return "SAR"


def _serialize_summary(summary: CustomerStatementSummary) -> dict[str, Any]:
    data = asdict(summary)
    for key in [
        "total_orders_amount",
        "total_invoices_amount",
        "total_paid_amount",
        "total_due_amount",
    ]:
        data[key] = str(data[key])
    return data


def _serialize_line(line: CustomerStatementLine) -> dict[str, Any]:
    data = asdict(line)
    data["debit_amount"] = str(line.debit_amount)
    data["credit_amount"] = str(line.credit_amount)
    data["balance_after"] = str(line.balance_after)
    data["line_date"] = line.line_date.isoformat() if line.line_date else None
    return data


def _sort_datetime_fallback() -> datetime:
    return timezone.now()


# ============================================================
# 📥 Statement Collectors
# ============================================================

def _collect_order_lines(
    orders_qs: QuerySet[Order],
    *,
    date_from: datetime | None,
    date_to: datetime | None,
    currency: str,
) -> list[dict[str, Any]]:
    """
    خطوط تشغيلية اختيارية فقط.
    لا يُنصح بإدخالها في الكشف المالي الافتراضي حتى لا يحدث ازدواج
    مع الفاتورة.
    """
    lines: list[dict[str, Any]] = []

    queryset = orders_qs
    if date_from:
        queryset = queryset.filter(created_at__gte=date_from)
    if date_to:
        queryset = queryset.filter(created_at__lte=date_to)

    for order in queryset.order_by("created_at", "id"):
        amount = _money(order.total_amount)
        if amount <= Decimal("0.00"):
            continue

        lines.append(
            {
                "line_type": "ORDER",
                "line_date": _ensure_aware(order.created_at),
                "reference": order.order_number or f"ORD-{order.pk}",
                "related_order_id": order.pk,
                "related_invoice_id": None,
                "related_payment_id": None,
                "description": f"إنشاء طلب {order.order_number or order.pk}",
                "debit_amount": amount,
                "credit_amount": Decimal("0.00"),
                "currency": order.currency_code or currency,
                "status": order.status,
                "metadata": {
                    "payment_status": order.payment_status,
                    "fulfillment_status": order.fulfillment_status,
                    "product_name": order.product_name,
                    "is_operational_only": True,
                    "agent_id": getattr(order, "agent_id", None),
                    "delivery_agent_id": getattr(order, "delivery_agent_id", None),
                },
            }
        )

    return lines


def _collect_invoice_lines(
    invoices_qs: QuerySet[Invoice],
    *,
    date_from: datetime | None,
    date_to: datetime | None,
    currency: str,
) -> list[dict[str, Any]]:
    lines: list[dict[str, Any]] = []

    queryset = invoices_qs
    if date_from:
        queryset = queryset.filter(created_at__gte=date_from)
    if date_to:
        queryset = queryset.filter(created_at__lte=date_to)

    for invoice in queryset.order_by("created_at", "id"):
        amount = _money(invoice.total_amount)
        if amount <= Decimal("0.00"):
            continue

        if invoice.issue_date:
            issue_date_value = _ensure_aware(
                datetime.combine(invoice.issue_date, time.min)
            )
        else:
            issue_date_value = _ensure_aware(invoice.created_at)

        lines.append(
            {
                "line_type": "INVOICE",
                "line_date": issue_date_value,
                "reference": invoice.invoice_number or f"INV-{invoice.pk}",
                "related_order_id": invoice.order_id,
                "related_invoice_id": invoice.pk,
                "related_payment_id": None,
                "description": f"إصدار فاتورة {invoice.invoice_number or invoice.pk}",
                "debit_amount": amount,
                "credit_amount": Decimal("0.00"),
                "currency": invoice.currency or currency,
                "status": invoice.status,
                "metadata": {
                    "due_date": invoice.due_date.isoformat() if invoice.due_date else None,
                    "paid_amount": str(_money(invoice.paid_amount)),
                    "due_amount": str(_money(invoice.due_amount)),
                    "invoice_type": invoice.invoice_type,
                },
            }
        )

    return lines


def _collect_payment_lines(
    payments_qs: QuerySet[Payment],
    *,
    date_from: datetime | None,
    date_to: datetime | None,
    currency: str,
) -> list[dict[str, Any]]:
    lines: list[dict[str, Any]] = []

    queryset = payments_qs
    if date_from:
        queryset = queryset.filter(created_at__gte=date_from)
    if date_to:
        queryset = queryset.filter(created_at__lte=date_to)

    for payment in queryset.order_by("created_at", "id"):
        amount = _money(payment.paid_amount or payment.amount)
        if amount <= Decimal("0.00"):
            continue

        line_date = _ensure_aware(payment.paid_at or payment.created_at)

        lines.append(
            {
                "line_type": "PAYMENT",
                "line_date": line_date,
                "reference": payment.payment_number or f"PAY-{payment.pk}",
                "related_order_id": payment.order_id,
                "related_invoice_id": None,
                "related_payment_id": payment.pk,
                "description": f"تحصيل دفعة {payment.payment_number or payment.pk}",
                "debit_amount": Decimal("0.00"),
                "credit_amount": amount,
                "currency": payment.currency or currency,
                "status": payment.status,
                "metadata": {
                    "payment_method": payment.payment_method,
                    "provider": payment.provider,
                    "external_reference": payment.external_reference,
                    "transaction_id": payment.transaction_id,
                },
            }
        )

    return lines


# ============================================================
# 📊 Statement Summary Builder
# ============================================================

def _build_summary(
    customer: Customer,
    orders_qs: QuerySet[Order],
    invoices_qs: QuerySet[Invoice],
    payments_qs: QuerySet[Payment],
    *,
    currency: str,
) -> CustomerStatementSummary:
    total_orders_amount = _money(
        orders_qs.aggregate(total=Sum("total_amount")).get("total") or "0.00"
    )
    total_invoices_amount = _money(
        invoices_qs.aggregate(total=Sum("total_amount")).get("total") or "0.00"
    )
    total_paid_amount = _money(
        payments_qs.aggregate(total=Sum("paid_amount")).get("total") or "0.00"
    )
    total_due_amount = _money(total_invoices_amount - total_paid_amount)
    if total_due_amount < Decimal("0.00"):
        total_due_amount = Decimal("0.00")

    return CustomerStatementSummary(
        customer_id=customer.pk,
        customer_code=customer.customer_code or "",
        customer_name=_resolve_customer_display_name(customer),
        customer_status=customer.status,
        primary_contact=_resolve_customer_contact(customer),
        total_orders_count=orders_qs.count(),
        total_orders_amount=total_orders_amount,
        total_invoices_count=invoices_qs.count(),
        total_invoices_amount=total_invoices_amount,
        total_paid_amount=total_paid_amount,
        total_due_amount=total_due_amount,
        currency=currency,
    )


# ============================================================
# 🧾 Statement Builder
# ============================================================

def build_customer_statement(
    customer: Customer,
    *,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    include_orders: bool = False,
    include_invoices: bool = True,
    include_payments: bool = True,
) -> CustomerStatementResult:
    """
    بناء كشف حساب العميل.

    الفكرة المالية في V2:
    - الفاتورة تمثل حركة مدينة على العميل
    - الدفعة تمثل حركة دائنة على العميل
    - الطلب اختياري وتشغيلي فقط، ومُستبعد افتراضيًا من الرصيد المالي
    """
    if not customer:
        raise ValueError("customer is required")

    start_dt = _start_of_day(date_from)
    end_dt = _end_of_day(date_to)

    orders_qs = Order.objects.filter(customer=customer)
    invoices_qs = Invoice.objects.filter(customer=customer)
    payments_qs = Payment.objects.filter(customer=customer)

    currency = _resolve_currency_from_customer_data(
        orders_qs=orders_qs,
        invoices_qs=invoices_qs,
        payments_qs=payments_qs,
    )

    summary = _build_summary(
        customer=customer,
        orders_qs=orders_qs,
        invoices_qs=invoices_qs,
        payments_qs=payments_qs,
        currency=currency,
    )

    raw_lines: list[dict[str, Any]] = []

    if include_orders:
        raw_lines.extend(
            _collect_order_lines(
                orders_qs,
                date_from=start_dt,
                date_to=end_dt,
                currency=currency,
            )
        )

    if include_invoices:
        raw_lines.extend(
            _collect_invoice_lines(
                invoices_qs,
                date_from=start_dt,
                date_to=end_dt,
                currency=currency,
            )
        )

    if include_payments:
        raw_lines.extend(
            _collect_payment_lines(
                payments_qs,
                date_from=start_dt,
                date_to=end_dt,
                currency=currency,
            )
        )

    raw_lines.sort(
        key=lambda item: (
            item["line_date"] or _sort_datetime_fallback(),
            item["related_order_id"] or 0,
            item["related_invoice_id"] or 0,
            item["related_payment_id"] or 0,
            item["line_type"],
        )
    )

    balance = Decimal("0.00")
    statement_lines: list[CustomerStatementLine] = []

    for item in raw_lines:
        debit_amount = _money(item["debit_amount"])
        credit_amount = _money(item["credit_amount"])
        balance = _money(balance + debit_amount - credit_amount)

        statement_lines.append(
            CustomerStatementLine(
                line_type=item["line_type"],
                line_date=item["line_date"],
                reference=item["reference"],
                related_order_id=item["related_order_id"],
                related_invoice_id=item["related_invoice_id"],
                related_payment_id=item["related_payment_id"],
                description=item["description"],
                debit_amount=debit_amount,
                credit_amount=credit_amount,
                balance_after=balance,
                currency=item["currency"],
                status=item["status"],
                metadata=item["metadata"],
            )
        )

    return CustomerStatementResult(
        summary=summary,
        lines=statement_lines,
    )


# ============================================================
# 🌐 Serialized Statement Helper
# ============================================================

def build_customer_statement_payload(
    customer: Customer,
    *,
    date_from: date | datetime | None = None,
    date_to: date | datetime | None = None,
    include_orders: bool = False,
    include_invoices: bool = True,
    include_payments: bool = True,
) -> dict[str, Any]:
    """
    نسخة جاهزة مباشرة للـ API.
    """
    result = build_customer_statement(
        customer=customer,
        date_from=date_from,
        date_to=date_to,
        include_orders=include_orders,
        include_invoices=include_invoices,
        include_payments=include_payments,
    )

    return {
        "summary": _serialize_summary(result.summary),
        "lines": [_serialize_line(line) for line in result.lines],
    }