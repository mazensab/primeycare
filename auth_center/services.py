# ===============================================================
# 📂 الملف: auth_center/services.py
# 🧭 Primey Care — Auth Center Services
# 🚀 الإصدار: Primey Care Auth Services V1.3
# ---------------------------------------------------------------
# ✅ خدمة مركزية لإنشاء حسابات دخول لكل أطراف Primey Care
# ✅ تدعم:
#    - system_admin
#    - provider_admin
#    - customer_user
#    - agent_user
#    - broker_user
#    - accountant
#    - support
#    - viewer
# ---------------------------------------------------------------
# ✅ لا تربط auth_center مباشرة بأي موديول تشغيلي
# ✅ تحفظ الربط داخل UserProfile.extra_data بشكل مرن
# ✅ تستخدم Django Groups لتجهيز الصلاحيات لاحقًا
# ✅ تجعل الوسيط Broker يملك role مستقل broker_user
# ✅ تدعم linked في نتيجة الإنشاء للتوافق مع agents/contracts/providers
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

from auth_center.models import (
    RoleChoices,
    UserProfile,
    UserType,
    resolve_default_role_for_user_type,
)

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
    linked: bool = False


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
}

BROKER_USER_TYPES = {
    UserType.BROKER,
}

SERVICE_NETWORK_USER_TYPES = {
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

SUPPORTED_ROLES = {
    RoleChoices.SYSTEM_ADMIN,
    RoleChoices.PROVIDER_ADMIN,
    RoleChoices.CUSTOMER_USER,
    RoleChoices.AGENT_USER,
    RoleChoices.BROKER_USER,
    RoleChoices.ACCOUNTANT,
    RoleChoices.SUPPORT,
    RoleChoices.VIEWER,
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

GROUP_NAME_BY_ROLE = {
    RoleChoices.SYSTEM_ADMIN: "role_system_admin",
    RoleChoices.PROVIDER_ADMIN: "role_provider_admin",
    RoleChoices.CUSTOMER_USER: "role_customer_user",
    RoleChoices.AGENT_USER: "role_agent_user",
    RoleChoices.BROKER_USER: "role_broker_user",
    RoleChoices.ACCOUNTANT: "role_accountant",
    RoleChoices.SUPPORT: "role_support",
    RoleChoices.VIEWER: "role_viewer",
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
        parsed = int(value)
        return parsed if parsed > 0 else None
    except (TypeError, ValueError):
        return None


def _choice_value(value: Any) -> str:
    """
    يدعم TextChoices أو string عادي.
    """
    if hasattr(value, "value"):
        return str(value.value)

    return str(value)


def _choice_values(values: set[Any]) -> set[str]:
    return {_choice_value(item) for item in values}


def _normalize_user_type(user_type: str | UserType | None) -> str:
    normalized = _clean_text(_choice_value(user_type)).upper() or _choice_value(UserType.OTHER)
    valid_values = _choice_values(SUPPORTED_USER_TYPES)

    if normalized not in valid_values:
        raise ValidationError(f"Unsupported user_type: {normalized}")

    return normalized


def _normalize_role(role: str | RoleChoices | None) -> str | None:
    if role in (None, ""):
        return None

    normalized = _clean_text(_choice_value(role)).lower()
    valid_values = _choice_values(SUPPORTED_ROLES)

    if normalized not in valid_values:
        raise ValidationError(f"Unsupported role: {normalized}")

    return normalized


def _resolve_role(*, user_type: str, role: str | RoleChoices | None) -> str:
    explicit_role = _normalize_role(role)
    if explicit_role:
        return explicit_role

    resolved = resolve_default_role_for_user_type(user_type)
    return _normalize_role(resolved) or _choice_value(RoleChoices.VIEWER)


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


def _compact_username_part(value: str) -> str:
    compacted = (
        _clean_text(value)
        .replace("+", "")
        .replace(" ", "")
        .replace("-", "")
        .replace(".", "_")
        .replace("@", "_")
    )

    compacted = slugify(compacted, allow_unicode=False) or compacted
    compacted = compacted.replace("-", "_")

    return compacted or "user"


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
        base = phone_number
    elif display_name:
        base = display_name
    else:
        base = "user"

    prefix = _compact_username_part(entity_type or user_type or "user")
    base_part = _compact_username_part(base)
    suffix = str(entity_id) if entity_id else secrets.token_hex(3)

    username = f"{prefix}_{base_part}_{suffix}"[:120]

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
        return normalized_entity_type, normalized_entity_id, ids

    if user_type == _choice_value(UserType.CUSTOMER) and customer_id:
        return "customer", customer_id, ids

    if user_type == _choice_value(UserType.PROVIDER) and provider_id:
        return "provider", provider_id, ids

    if user_type == _choice_value(UserType.CENTER) and center_id:
        return "center", center_id, ids

    if user_type == _choice_value(UserType.AGENT) and agent_id:
        return "agent", agent_id, ids

    if user_type == _choice_value(UserType.BROKER) and broker_id:
        return "broker", broker_id, ids

    if user_type in _choice_values(SYSTEM_USER_TYPES):
        return "system", None, ids

    if user_type == _choice_value(UserType.COMPANY) and company_id:
        return "company", company_id, ids

    return normalized_entity_type, normalized_entity_id, ids


def _get_or_create_group(group_name: str | None) -> Group | None:
    if not group_name:
        return None

    group, _ = Group.objects.get_or_create(name=group_name)
    return group


def _assign_groups(user, user_type: str, role: str) -> str | None:
    """
    تعيين مجموعات Django.

    - group قديم حسب user_type للتوافق.
    - group جديد حسب role للصلاحيات.
    """
    legacy_group_name = GROUP_NAME_BY_USER_TYPE.get(user_type)
    role_group_name = GROUP_NAME_BY_ROLE.get(role)

    legacy_group = _get_or_create_group(legacy_group_name)
    role_group = _get_or_create_group(role_group_name)

    if legacy_group:
        user.groups.add(legacy_group)

    if role_group:
        user.groups.add(role_group)
        return role_group.name

    return legacy_group.name if legacy_group else None


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


def _merge_tags(existing: Any, updates: list[str] | None) -> list[str]:
    if updates is None:
        if isinstance(existing, list):
            return existing
        return []

    base: list[str] = []

    if isinstance(existing, list):
        base.extend(str(item) for item in existing if _clean_text(item))

    for item in updates:
        cleaned = _clean_text(item)
        if cleaned and cleaned not in base:
            base.append(cleaned)

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
        profile = (
            UserProfile.objects
            .filter(
                phone_number=phone_number,
            )
            .select_related("user")
            .first()
        )
        if profile:
            return profile.user

        profile = (
            UserProfile.objects
            .filter(
                whatsapp_number=phone_number,
            )
            .select_related("user")
            .first()
        )
        if profile:
            return profile.user

    return None


def _profile_update_fields(profile: UserProfile) -> list[str]:
    fields = [
        "user_type",
        "role",
        "display_name",
        "phone_number",
        "whatsapp_number",
        "alternate_email",
        "preferred_language",
        "timezone",
        "extra_data",
        "is_profile_completed",
        "last_profile_update_at",
        "updated_at",
    ]

    if hasattr(profile, "tags"):
        fields.append("tags")

    return fields


# ===============================================================
# 🚀 Public Service
# ===============================================================

@transaction.atomic
def create_actor_user(
    *,
    user_type: str | UserType,
    role: str | RoleChoices | None = None,
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
    """

    normalized_user_type = _normalize_user_type(user_type)
    normalized_role = _resolve_role(user_type=normalized_user_type, role=role)

    if normalized_role not in _choice_values(SUPPORTED_ROLES):
        raise ValidationError(f"Unsupported role: {normalized_role}")

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

    if clean_username and user.username != clean_username:
        user.username = clean_username
        user_dirty_fields.append("username")

    if clean_email and user.email != clean_email:
        user.email = clean_email
        user_dirty_fields.append("email")

    if clean_first_name and user.first_name != clean_first_name:
        user.first_name = clean_first_name
        user_dirty_fields.append("first_name")

    if clean_last_name and user.last_name != clean_last_name:
        user.last_name = clean_last_name
        user_dirty_fields.append("last_name")

    desired_is_staff = (
        normalized_role in {
            _choice_value(RoleChoices.SYSTEM_ADMIN),
            _choice_value(RoleChoices.ACCOUNTANT),
            _choice_value(RoleChoices.SUPPORT),
        }
        if is_staff is None
        else bool(is_staff)
    )

    desired_is_superuser = (
        normalized_role == _choice_value(RoleChoices.SYSTEM_ADMIN)
        if is_superuser is None
        else bool(is_superuser)
    )

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

    profile_extra_data["role"] = normalized_role
    profile_extra_data["user_type"] = normalized_user_type

    profile.user_type = normalized_user_type
    profile.role = normalized_role
    profile.display_name = clean_display_name
    profile.phone_number = clean_phone_number or None
    profile.whatsapp_number = clean_whatsapp_number or clean_phone_number or None
    profile.alternate_email = clean_alternate_email or clean_email or None
    profile.preferred_language = clean_language
    profile.timezone = clean_timezone
    profile.extra_data = profile_extra_data

    if hasattr(profile, "tags"):
        profile.tags = _merge_tags(profile.tags, tags)

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
    profile.save(update_fields=_profile_update_fields(profile))

    group_name = None
    if create_group:
        group_name = _assign_groups(user, normalized_user_type, normalized_role)

    linked = bool(resolved_entity_type or resolved_entity_id or entity_ids)

    if created:
        message = "User created successfully."
    elif linked:
        message = "User updated and linked successfully."
    else:
        message = "User updated successfully."

    return ActorUserCreationResult(
        user=user,
        profile=profile,
        created=created,
        temporary_password=temporary_password,
        group_name=group_name,
        entity_type=resolved_entity_type,
        entity_id=resolved_entity_id,
        message=message,
        linked=linked,
    )


# ===============================================================
# ✅ Convenience Wrappers
# ===============================================================

def create_system_admin_user(
    *,
    email: str,
    display_name: str | None = None,
    **kwargs,
) -> ActorUserCreationResult:
    return create_actor_user(
        user_type=UserType.SUPER_ADMIN,
        role=RoleChoices.SYSTEM_ADMIN,
        email=email,
        display_name=display_name,
        **kwargs,
    )


def create_support_user(
    *,
    email: str,
    display_name: str | None = None,
    **kwargs,
) -> ActorUserCreationResult:
    return create_actor_user(
        user_type=UserType.STAFF,
        role=RoleChoices.SUPPORT,
        email=email,
        display_name=display_name,
        **kwargs,
    )


def create_viewer_user(
    *,
    email: str,
    display_name: str | None = None,
    **kwargs,
) -> ActorUserCreationResult:
    return create_actor_user(
        user_type=UserType.STAFF,
        role=RoleChoices.VIEWER,
        email=email,
        display_name=display_name,
        **kwargs,
    )


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
        role=RoleChoices.CUSTOMER_USER,
        customer_id=customer_id,
        entity_type="customer",
        entity_id=customer_id,
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
        role=RoleChoices.PROVIDER_ADMIN,
        center_id=center_id,
        entity_type="center",
        entity_id=center_id,
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
        role=RoleChoices.PROVIDER_ADMIN,
        provider_id=provider_id,
        entity_type="provider",
        entity_id=provider_id,
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
        role=RoleChoices.AGENT_USER,
        agent_id=agent_id,
        entity_type="agent",
        entity_id=agent_id,
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
        role=RoleChoices.BROKER_USER,
        broker_id=broker_id,
        entity_type="broker",
        entity_id=broker_id,
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
    role: str | RoleChoices = RoleChoices.SUPPORT,
    **kwargs,
) -> ActorUserCreationResult:
    return create_actor_user(
        user_type=user_type,
        role=role,
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
        role=RoleChoices.ACCOUNTANT,
        email=email,
        display_name=display_name,
        **kwargs,
    )