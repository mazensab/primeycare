# ===============================================================
# 📂 الملف: auth_center/services.py
# 🧭 Primey Care — Auth Center Services
# 🚀 الإصدار: Primey Care Auth Services V1.0
# ---------------------------------------------------------------
# ✅ خدمة مركزية لإنشاء حسابات دخول لكل أطراف Primey Care
# ✅ تدعم:
#    - سوبر أدمن
#    - موظفي النظام
#    - المحاسبين
#    - العملاء
#    - المندوبين
#    - الوكلاء
#    - المراكز
#    - مقدمي الخدمة
# ✅ لا تربط auth_center مباشرة بأي موديول تشغيلي
# ✅ تحفظ الربط داخل UserProfile.extra_data بشكل مرن
# ✅ تستخدم Django Groups لتجهيز الصلاحيات لاحقًا
# ===============================================================

from __future__ import annotations

import secrets
import string
from dataclasses import dataclass
from typing import Any

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.utils.text import slugify

from auth_center.models import UserProfile, UserType

User = get_user_model()


# ===============================================================
# 📦 Result Object
# ===============================================================

@dataclass(frozen=True)
class ActorUserCreationResult:
    """
    نتيجة إنشاء أو تحديث مستخدم مرتبط بكيان داخل Primey Care.
    """

    user: Any
    profile: UserProfile
    created: bool
    temporary_password: str | None
    group_name: str | None
    entity_type: str | None
    entity_id: int | None
    message: str


# ===============================================================
# 🧩 Constants
# ===============================================================

SYSTEM_USER_TYPES = {
    UserType.SUPER_ADMIN,
    UserType.SYSTEM,
    UserType.STAFF,
    UserType.ACCOUNTANT,
}

PROVIDER_USER_TYPES = {
    UserType.PROVIDER,
    UserType.CENTER,
}

CUSTOMER_USER_TYPES = {
    UserType.CUSTOMER,
}

AGENT_USER_TYPES = {
    UserType.AGENT,
    UserType.BROKER,
}

SUPPORTED_USER_TYPES = {
    UserType.SUPER_ADMIN,
    UserType.SYSTEM,
    UserType.STAFF,
    UserType.ACCOUNTANT,
    UserType.CUSTOMER,
    UserType.AGENT,
    UserType.BROKER,
    UserType.PROVIDER,
    UserType.CENTER,
    UserType.PARTNER,
    UserType.COMPANY,
    UserType.OTHER,
}


GROUP_NAME_BY_USER_TYPE = {
    UserType.SUPER_ADMIN: "SUPER_ADMIN",
    UserType.SYSTEM: "SYSTEM",
    UserType.STAFF: "STAFF",
    UserType.ACCOUNTANT: "ACCOUNTANT",
    UserType.CUSTOMER: "CUSTOMER",
    UserType.AGENT: "AGENT",
    UserType.BROKER: "BROKER",
    UserType.PROVIDER: "PROVIDER",
    UserType.CENTER: "CENTER",
    UserType.PARTNER: "PARTNER",
    UserType.COMPANY: "COMPANY",
    UserType.OTHER: "OTHER",
}


# ===============================================================
# 🧹 Helpers
# ===============================================================

def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _clean_email(value: Any) -> str:
    return _clean_text(value).lower()


def _safe_int(value: Any) -> int | None:
    try:
        if value in (None, "", 0, "0"):
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _normalize_user_type(user_type: str | UserType | None) -> str:
    normalized = _clean_text(user_type).upper() or UserType.OTHER

    valid_values = {choice.value for choice in UserType}
    if normalized not in valid_values:
        raise ValidationError(f"Unsupported user_type: {normalized}")

    return normalized


def _validate_email_or_empty(email: str) -> None:
    if not email:
        return

    validate_email(email)


def _generate_secure_password(length: int = 16) -> str:
    """
    توليد كلمة مرور مؤقتة قوية.
    لاحقًا يمكن استبدال هذا بتدفق reset password token.
    """
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    while True:
        password = "".join(secrets.choice(alphabet) for _ in range(length))

        has_lower = any(ch.islower() for ch in password)
        has_upper = any(ch.isupper() for ch in password)
        has_digit = any(ch.isdigit() for ch in password)
        has_symbol = any(ch in "!@#$%^&*" for ch in password)

        if has_lower and has_upper and has_digit and has_symbol:
            return password


def _build_username(
    *,
    email: str,
    phone_number: str,
    display_name: str,
    user_type: str,
    entity_type: str | None,
    entity_id: int | None,
) -> str:
    """
    بناء username آمن وفريد قدر الإمكان.
    """
    if email:
        base = email.split("@")[0]
    elif phone_number:
        base = phone_number.replace("+", "").replace(" ", "").replace("-", "")
    elif display_name:
        base = slugify(display_name, allow_unicode=False) or "user"
    else:
        base = "user"

    prefix = _clean_text(entity_type).lower() or _clean_text(user_type).lower() or "user"
    suffix = str(entity_id) if entity_id else secrets.token_hex(3)

    username = f"{prefix}_{base}_{suffix}"
    username = username.replace(".", "_").replace("@", "_")
    username = username[:120]

    original = username
    counter = 1

    while User.objects.filter(username=username).exists():
        counter += 1
        username = f"{original[:110]}_{counter}"

    return username


def _resolve_entity_from_payload(
    *,
    user_type: str,
    entity_type: str | None,
    entity_id: int | None,
    customer_id: int | None,
    provider_id: int | None,
    center_id: int | None,
    agent_id: int | None,
    broker_id: int | None,
    company_id: int | None,
) -> tuple[str | None, int | None, dict[str, int]]:
    """
    توحيد entity_type / entity_id وبناء extra_data ids.
    """

    normalized_entity_type = _clean_text(entity_type).lower() or None
    normalized_entity_id = _safe_int(entity_id)

    ids: dict[str, int] = {}

    if company_id:
        ids["company_id"] = company_id

    if provider_id:
        ids["provider_id"] = provider_id

    if center_id:
        ids["center_id"] = center_id

    if customer_id:
        ids["customer_id"] = customer_id

    if agent_id:
        ids["agent_id"] = agent_id

    if broker_id:
        ids["broker_id"] = broker_id

    if normalized_entity_type and normalized_entity_id:
        ids[f"{normalized_entity_type}_id"] = normalized_entity_id

    if normalized_entity_type and normalized_entity_id:
        return normalized_entity_type, normalized_entity_id, ids

    if user_type == UserType.CUSTOMER and customer_id:
        return "customer", customer_id, ids

    if user_type == UserType.PROVIDER and provider_id:
        return "provider", provider_id, ids

    if user_type == UserType.CENTER and center_id:
        return "center", center_id, ids

    if user_type == UserType.AGENT and agent_id:
        return "agent", agent_id, ids

    if user_type == UserType.BROKER and broker_id:
        return "broker", broker_id, ids

    if user_type in SYSTEM_USER_TYPES:
        return "system", None, ids

    if user_type == UserType.COMPANY and company_id:
        return "company", company_id, ids

    return normalized_entity_type, normalized_entity_id, ids


def _get_or_create_group(user_type: str) -> Group | None:
    group_name = GROUP_NAME_BY_USER_TYPE.get(user_type)

    if not group_name:
        return None

    group, _ = Group.objects.get_or_create(name=group_name)
    return group


def _assign_group(user, user_type: str) -> str | None:
    group = _get_or_create_group(user_type)

    if not group:
        return None

    user.groups.add(group)
    return group.name


def _merge_extra_data(
    existing: dict[str, Any] | None,
    updates: dict[str, Any] | None,
) -> dict[str, Any]:
    base = existing.copy() if isinstance(existing, dict) else {}
    if isinstance(updates, dict):
        for key, value in updates.items():
            if value not in (None, ""):
                base[key] = value
    return base


def _find_existing_user(
    *,
    email: str,
    username: str | None,
    phone_number: str,
) -> Any | None:
    """
    البحث عن مستخدم موجود لتجنب إنشاء حسابات مكررة.
    الأولوية:
    1) username إن تم تمريره
    2) email
    3) phone_number داخل profile
    """

    if username:
        user = User.objects.filter(username=username).first()
        if user:
            return user

    if email:
        user = User.objects.filter(email__iexact=email).first()
        if user:
            return user

    if phone_number:
        profile = UserProfile.objects.filter(phone_number=phone_number).select_related("user").first()
        if profile:
            return profile.user

    return None


# ===============================================================
# 🚀 Public Service
# ===============================================================

@transaction.atomic
def create_actor_user(
    *,
    user_type: str | UserType,
    email: str | None = None,
    username: str | None = None,
    password: str | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
    display_name: str | None = None,
    phone_number: str | None = None,
    whatsapp_number: str | None = None,
    alternate_email: str | None = None,
    preferred_language: str = "ar",
    timezone: str = "Asia/Riyadh",
    entity_type: str | None = None,
    entity_id: int | None = None,
    customer_id: int | None = None,
    provider_id: int | None = None,
    center_id: int | None = None,
    agent_id: int | None = None,
    broker_id: int | None = None,
    company_id: int | None = None,
    is_active: bool = True,
    is_staff: bool | None = None,
    is_superuser: bool | None = None,
    extra_data: dict[str, Any] | None = None,
    tags: list[str] | None = None,
    create_group: bool = True,
    update_existing: bool = True,
) -> ActorUserCreationResult:
    """
    إنشاء أو تحديث مستخدم دخول لأي Actor داخل Primey Care.

    أمثلة الاستخدام:

    عميل:
        create_actor_user(
            user_type=UserType.CUSTOMER,
            email="customer@example.com",
            display_name="عميل تجريبي",
            customer_id=10,
        )

    مركز:
        create_actor_user(
            user_type=UserType.CENTER,
            email="center@example.com",
            display_name="مركز النخبة",
            center_id=5,
        )

    مقدم خدمة:
        create_actor_user(
            user_type=UserType.PROVIDER,
            email="provider@example.com",
            display_name="مقدم خدمة",
            provider_id=7,
        )

    مندوب:
        create_actor_user(
            user_type=UserType.AGENT,
            email="agent@example.com",
            display_name="مندوب جدة",
            agent_id=3,
        )

    محاسب:
        create_actor_user(
            user_type=UserType.ACCOUNTANT,
            email="accountant@example.com",
            display_name="محاسب النظام",
        )
    """

    normalized_user_type = _normalize_user_type(user_type)

    clean_email = _clean_email(email)
    clean_username = _clean_text(username)
    clean_first_name = _clean_text(first_name)
    clean_last_name = _clean_text(last_name)
    clean_display_name = _clean_text(display_name)
    clean_phone_number = _clean_text(phone_number)
    clean_whatsapp_number = _clean_text(whatsapp_number)
    clean_alternate_email = _clean_email(alternate_email)
    clean_language = _clean_text(preferred_language) or "ar"
    clean_timezone = _clean_text(timezone) or "Asia/Riyadh"

    _validate_email_or_empty(clean_email)
    _validate_email_or_empty(clean_alternate_email)

    if clean_language not in {"ar", "en"}:
        raise ValidationError("preferred_language must be 'ar' or 'en'.")

    resolved_entity_type, resolved_entity_id, entity_ids = _resolve_entity_from_payload(
        user_type=normalized_user_type,
        entity_type=entity_type,
        entity_id=_safe_int(entity_id),
        customer_id=_safe_int(customer_id),
        provider_id=_safe_int(provider_id),
        center_id=_safe_int(center_id),
        agent_id=_safe_int(agent_id),
        broker_id=_safe_int(broker_id),
        company_id=_safe_int(company_id),
    )

    if not clean_display_name:
        clean_display_name = " ".join(
            part for part in [clean_first_name, clean_last_name] if part
        ).strip()

    if not clean_display_name:
        clean_display_name = clean_email or clean_username or clean_phone_number or "Primey Care User"

    existing_user = _find_existing_user(
        email=clean_email,
        username=clean_username or None,
        phone_number=clean_phone_number,
    )

    created = False
    temporary_password: str | None = None

    if existing_user and not update_existing:
        raise ValidationError("User already exists.")

    if existing_user:
        user = existing_user
    else:
        created = True

        final_username = clean_username or _build_username(
            email=clean_email,
            phone_number=clean_phone_number,
            display_name=clean_display_name,
            user_type=normalized_user_type,
            entity_type=resolved_entity_type,
            entity_id=resolved_entity_id,
        )

        final_password = password or _generate_secure_password()
        temporary_password = final_password if not password else None

        user = User.objects.create_user(
            username=final_username,
            email=clean_email,
            password=final_password,
            first_name=clean_first_name,
            last_name=clean_last_name,
        )

    # -----------------------------------------------------------
    # تحديث حقول Django User
    # -----------------------------------------------------------
    user_dirty_fields: list[str] = []

    if clean_email and user.email != clean_email:
        user.email = clean_email
        user_dirty_fields.append("email")

    if clean_first_name and user.first_name != clean_first_name:
        user.first_name = clean_first_name
        user_dirty_fields.append("first_name")

    if clean_last_name and user.last_name != clean_last_name:
        user.last_name = clean_last_name
        user_dirty_fields.append("last_name")

    desired_is_staff = bool(normalized_user_type in SYSTEM_USER_TYPES) if is_staff is None else bool(is_staff)
    desired_is_superuser = bool(normalized_user_type == UserType.SUPER_ADMIN) if is_superuser is None else bool(is_superuser)

    if user.is_staff != desired_is_staff:
        user.is_staff = desired_is_staff
        user_dirty_fields.append("is_staff")

    if user.is_superuser != desired_is_superuser:
        user.is_superuser = desired_is_superuser
        user_dirty_fields.append("is_superuser")

    if user.is_active != bool(is_active):
        user.is_active = bool(is_active)
        user_dirty_fields.append("is_active")

    if password and existing_user:
        user.set_password(password)
        user_dirty_fields.append("password")

    if user_dirty_fields:
        user.save(update_fields=list(dict.fromkeys(user_dirty_fields)))

    # -----------------------------------------------------------
    # تحديث UserProfile
    # -----------------------------------------------------------
    profile, _ = UserProfile.objects.get_or_create(user=user)

    profile_extra_data = _merge_extra_data(profile.extra_data, extra_data)
    profile_extra_data = _merge_extra_data(profile_extra_data, entity_ids)

    if resolved_entity_type:
        profile_extra_data["entity_type"] = resolved_entity_type

    if resolved_entity_id:
        profile_extra_data["entity_id"] = resolved_entity_id

    profile.user_type = normalized_user_type
    profile.display_name = clean_display_name
    profile.phone_number = clean_phone_number or None
    profile.whatsapp_number = clean_whatsapp_number or clean_phone_number or None
    profile.alternate_email = clean_alternate_email or clean_email or None
    profile.preferred_language = clean_language
    profile.timezone = clean_timezone
    profile.extra_data = profile_extra_data

    if tags is not None:
        profile.tags = tags

    profile.is_profile_completed = bool(
        profile.display_name
        and (
            user.email
            or profile.alternate_email
            or profile.phone_number
            or profile.whatsapp_number
        )
    )

    profile.mark_profile_updated(commit=False)
    profile.save(
        update_fields=[
            "user_type",
            "display_name",
            "phone_number",
            "whatsapp_number",
            "alternate_email",
            "preferred_language",
            "timezone",
            "tags",
            "extra_data",
            "is_profile_completed",
            "last_profile_update_at",
            "updated_at",
        ]
    )

    group_name = None
    if create_group:
        group_name = _assign_group(user, normalized_user_type)

    message = "User created successfully." if created else "User updated successfully."

    return ActorUserCreationResult(
        user=user,
        profile=profile,
        created=created,
        temporary_password=temporary_password,
        group_name=group_name,
        entity_type=resolved_entity_type,
        entity_id=resolved_entity_id,
        message=message,
    )


# ===============================================================
# ✅ Convenience Wrappers
# ===============================================================

def create_customer_user(
    *,
    customer_id: int,
    email: str | None = None,
    display_name: str | None = None,
    phone_number: str | None = None,
    whatsapp_number: str | None = None,
    **kwargs,
) -> ActorUserCreationResult:
    return create_actor_user(
        user_type=UserType.CUSTOMER,
        customer_id=customer_id,
        email=email,
        display_name=display_name,
        phone_number=phone_number,
        whatsapp_number=whatsapp_number,
        **kwargs,
    )


def create_center_user(
    *,
    center_id: int,
    email: str | None = None,
    display_name: str | None = None,
    phone_number: str | None = None,
    whatsapp_number: str | None = None,
    **kwargs,
) -> ActorUserCreationResult:
    return create_actor_user(
        user_type=UserType.CENTER,
        center_id=center_id,
        email=email,
        display_name=display_name,
        phone_number=phone_number,
        whatsapp_number=whatsapp_number,
        **kwargs,
    )


def create_provider_user(
    *,
    provider_id: int,
    email: str | None = None,
    display_name: str | None = None,
    phone_number: str | None = None,
    whatsapp_number: str | None = None,
    **kwargs,
) -> ActorUserCreationResult:
    return create_actor_user(
        user_type=UserType.PROVIDER,
        provider_id=provider_id,
        email=email,
        display_name=display_name,
        phone_number=phone_number,
        whatsapp_number=whatsapp_number,
        **kwargs,
    )


def create_agent_user(
    *,
    agent_id: int,
    email: str | None = None,
    display_name: str | None = None,
    phone_number: str | None = None,
    whatsapp_number: str | None = None,
    **kwargs,
) -> ActorUserCreationResult:
    return create_actor_user(
        user_type=UserType.AGENT,
        agent_id=agent_id,
        email=email,
        display_name=display_name,
        phone_number=phone_number,
        whatsapp_number=whatsapp_number,
        **kwargs,
    )


def create_broker_user(
    *,
    broker_id: int,
    email: str | None = None,
    display_name: str | None = None,
    phone_number: str | None = None,
    whatsapp_number: str | None = None,
    **kwargs,
) -> ActorUserCreationResult:
    return create_actor_user(
        user_type=UserType.BROKER,
        broker_id=broker_id,
        email=email,
        display_name=display_name,
        phone_number=phone_number,
        whatsapp_number=whatsapp_number,
        **kwargs,
    )


def create_staff_user(
    *,
    email: str,
    display_name: str | None = None,
    user_type: str | UserType = UserType.STAFF,
    **kwargs,
) -> ActorUserCreationResult:
    return create_actor_user(
        user_type=user_type,
        email=email,
        display_name=display_name,
        **kwargs,
    )


def create_accountant_user(
    *,
    email: str,
    display_name: str | None = None,
    **kwargs,
) -> ActorUserCreationResult:
    return create_actor_user(
        user_type=UserType.ACCOUNTANT,
        email=email,
        display_name=display_name,
        **kwargs,
    )