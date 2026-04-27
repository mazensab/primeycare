# ============================================================
# 📂 whatsapp_center/selectors.py
# 🧠 Primey Care - WhatsApp Selectors V1 Core
# ------------------------------------------------------------
# ✅ متوافق مع WhatsApp Center Models V1 Core
# ✅ لا يعتمد على CompanyWhatsAppConfig
# ✅ لا يعتمد على FK company مباشر
# ✅ يعتمد على:
#    - scope_type
#    - company_reference
# ✅ يدعم:
#    - system config
#    - template fallback
#    - inbox selectors
#    - messages selectors
#    - summary selectors
# ============================================================

from __future__ import annotations

from typing import Optional

from django.db.models import Q

from .models import (
    ScopeType,
    SystemWhatsAppConfig,
    WhatsAppContact,
    WhatsAppConversation,
    WhatsAppConversationMessage,
    WhatsAppTemplate,
)
from .utils import normalize_phone_number


# ============================================================
# 🔧 Internal Helpers
# ============================================================

def _normalize_language_code(language_code: str) -> str:
    value = (language_code or "").strip().lower()
    return value if value in {"ar", "en"} else "ar"


def _build_language_candidates(language_code: str) -> list[str]:
    normalized = _normalize_language_code(language_code)
    candidates: list[str] = []

    for item in [normalized, "ar", "en"]:
        if item not in candidates:
            candidates.append(item)

    return candidates


def _normalize_search_term(value: str) -> str:
    return (value or "").strip()


def _normalize_status_filter(value: str) -> str:
    return (value or "").strip().upper()


def _normalize_limit(limit: int | None, default: int = 50, maximum: int = 500) -> int:
    try:
        parsed = int(limit or default)
    except Exception:
        parsed = default

    if parsed <= 0:
        return default

    return min(parsed, maximum)


def _resolve_company_reference(*, company=None, company_reference: str | None = None) -> str:
    if company_reference:
        return str(company_reference).strip()

    if company is None:
        return ""

    for attr_name in ["company_reference", "reference", "code", "pk", "id"]:
        value = getattr(company, attr_name, None)
        if value not in [None, ""]:
            return str(value).strip()

    return ""


def _system_scope_company_reference() -> str:
    return ""


def _get_company_template_candidate(
    *,
    company_reference: str,
    event_code: str,
    language_code: str,
):
    if not company_reference:
        return None

    return (
        WhatsAppTemplate.objects
        .filter(
            scope_type=ScopeType.COMPANY,
            company_reference=company_reference,
            event_code=event_code,
            language_code=language_code,
            is_active=True,
        )
        .order_by("-is_default", "-version", "-id")
        .first()
    )


def _get_system_template_candidate(
    *,
    event_code: str,
    language_code: str,
):
    return (
        WhatsAppTemplate.objects
        .filter(
            scope_type=ScopeType.SYSTEM,
            company_reference=_system_scope_company_reference(),
            event_code=event_code,
            language_code=language_code,
            is_active=True,
        )
        .order_by("-is_default", "-version", "-id")
        .first()
    )


# ============================================================
# ⚙️ Config Selectors
# ============================================================

def get_active_system_whatsapp_config() -> Optional[SystemWhatsAppConfig]:
    return (
        SystemWhatsAppConfig.objects
        .filter(is_enabled=True, is_active=True)
        .order_by("-id")
        .first()
    )


def get_active_company_whatsapp_config(company=None, company_reference: str | None = None):
    """
    Primey Care V1 Core:
    لا يوجد CompanyWhatsAppConfig بعد.
    نعيد None ليكمل services.py الـ fallback إلى system config.
    """
    return None


# ============================================================
# 📨 Template Selector
# ============================================================

def get_whatsapp_template(
    *,
    scope_type: str,
    event_code: str,
    language_code: str = "ar",
    company=None,
    company_reference: str | None = None,
):
    """
    جلب أفضل قالب متاح بترتيب مرن وآمن:

    1) إذا كان Company Scope ومعنا company/company_reference:
       - نحاول قالب الشركة باللغة المطلوبة
       - ثم العربية
       - ثم الإنجليزية

    2) بعدها دائمًا نحاول System Scope كـ fallback:
       - باللغة المطلوبة
       - ثم العربية
       - ثم الإنجليزية
    """
    language_candidates = _build_language_candidates(language_code)
    resolved_company_reference = _resolve_company_reference(
        company=company,
        company_reference=company_reference,
    )

    if scope_type == ScopeType.COMPANY and resolved_company_reference:
        for lang in language_candidates:
            company_template = _get_company_template_candidate(
                company_reference=resolved_company_reference,
                event_code=event_code,
                language_code=lang,
            )
            if company_template:
                return company_template

    for lang in language_candidates:
        system_template = _get_system_template_candidate(
            event_code=event_code,
            language_code=lang,
        )
        if system_template:
            return system_template

    return None


# ============================================================
# 💬 Conversation Query Builders
# ============================================================

def _build_system_conversations_queryset():
    return (
        WhatsAppConversation.objects
        .filter(
            scope_type=ScopeType.SYSTEM,
            company_reference=_system_scope_company_reference(),
        )
        .select_related("contact", "assigned_to")
        .order_by("-is_pinned", "-last_message_at", "-id")
    )


def _build_company_conversations_queryset(*, company=None, company_reference: str | None = None):
    resolved_company_reference = _resolve_company_reference(
        company=company,
        company_reference=company_reference,
    )
    if not resolved_company_reference:
        return WhatsAppConversation.objects.none()

    return (
        WhatsAppConversation.objects
        .filter(
            scope_type=ScopeType.COMPANY,
            company_reference=resolved_company_reference,
        )
        .select_related("contact", "assigned_to")
        .order_by("-is_pinned", "-last_message_at", "-id")
    )


def _apply_conversation_search(queryset, search: str):
    search = _normalize_search_term(search)
    if not search:
        return queryset

    normalized_phone = normalize_phone_number(search)
    phone_candidates = [search]
    if normalized_phone:
        phone_candidates.append(normalized_phone)

    return queryset.filter(
        Q(contact__display_name__icontains=search)
        | Q(contact__push_name__icontains=search)
        | Q(contact__phone_number__in=phone_candidates)
        | Q(contact__wa_jid__icontains=search)
        | Q(subject__icontains=search)
        | Q(last_message_preview__icontains=search)
    )


def _apply_conversation_filters(
    queryset,
    *,
    status: str = "",
    assigned_to_id: int | None = None,
    only_unread: bool = False,
    is_resolved: bool | None = None,
):
    normalized_status = _normalize_status_filter(status)
    if normalized_status:
        queryset = queryset.filter(status=normalized_status)

    if assigned_to_id:
        queryset = queryset.filter(assigned_to_id=assigned_to_id)

    if only_unread:
        queryset = queryset.filter(unread_count__gt=0)

    if is_resolved is not None:
        queryset = queryset.filter(is_resolved=bool(is_resolved))

    return queryset


# ============================================================
# 💬 System Conversation Selectors
# ============================================================

def get_system_whatsapp_inbox(
    *,
    search: str = "",
    status: str = "",
    assigned_to_id: int | None = None,
    only_unread: bool = False,
    is_resolved: bool | None = None,
    limit: int | None = 50,
):
    queryset = _build_system_conversations_queryset()
    queryset = _apply_conversation_search(queryset, search=search)
    queryset = _apply_conversation_filters(
        queryset,
        status=status,
        assigned_to_id=assigned_to_id,
        only_unread=only_unread,
        is_resolved=is_resolved,
    )
    return queryset[:_normalize_limit(limit)]


def get_system_whatsapp_conversation_by_id(conversation_id: int):
    if not conversation_id:
        return None

    return (
        _build_system_conversations_queryset()
        .filter(id=conversation_id)
        .first()
    )


def get_system_whatsapp_contact_by_phone(phone_number: str):
    normalized_phone = normalize_phone_number(phone_number)
    if not normalized_phone:
        return None

    return (
        WhatsAppContact.objects
        .filter(
            scope_type=ScopeType.SYSTEM,
            company_reference=_system_scope_company_reference(),
            phone_number=normalized_phone,
        )
        .order_by("-last_message_at", "-id")
        .first()
    )


def get_system_whatsapp_conversation_by_contact_phone(phone_number: str):
    contact = get_system_whatsapp_contact_by_phone(phone_number)
    if not contact:
        return None

    return (
        _build_system_conversations_queryset()
        .filter(contact=contact)
        .first()
    )


def get_system_whatsapp_messages(
    *,
    conversation_id: int,
    limit: int | None = 100,
):
    if not conversation_id:
        return WhatsAppConversationMessage.objects.none()

    queryset = (
        WhatsAppConversationMessage.objects
        .filter(
            conversation_id=conversation_id,
            scope_type=ScopeType.SYSTEM,
            company_reference=_system_scope_company_reference(),
        )
        .select_related("conversation", "webhook_event", "message_log")
        .order_by("message_created_at", "created_at", "id")
    )

    return queryset[:_normalize_limit(limit, default=100, maximum=2000)]


def get_system_whatsapp_last_message(*, conversation_id: int):
    if not conversation_id:
        return None

    return (
        WhatsAppConversationMessage.objects
        .filter(
            conversation_id=conversation_id,
            scope_type=ScopeType.SYSTEM,
            company_reference=_system_scope_company_reference(),
        )
        .order_by("-message_created_at", "-created_at", "-id")
        .first()
    )


def get_system_whatsapp_inbox_summary(
    *,
    search: str = "",
    assigned_to_id: int | None = None,
):
    queryset = _build_system_conversations_queryset()
    queryset = _apply_conversation_search(queryset, search=search)

    if assigned_to_id:
        queryset = queryset.filter(assigned_to_id=assigned_to_id)

    return {
        "total_conversations": queryset.count(),
        "open_conversations": queryset.filter(status="OPEN").count(),
        "closed_conversations": queryset.filter(status="CLOSED").count(),
        "archived_conversations": queryset.filter(status="ARCHIVED").count(),
        "spam_conversations": queryset.filter(status="SPAM").count(),
        "unread_conversations": queryset.filter(unread_count__gt=0).count(),
        "resolved_conversations": queryset.filter(is_resolved=True).count(),
        "pinned_conversations": queryset.filter(is_pinned=True).count(),
    }


# ============================================================
# 💬 Company Conversation Selectors
# ============================================================

def get_company_whatsapp_inbox(
    *,
    company=None,
    company_reference: str | None = None,
    search: str = "",
    status: str = "",
    assigned_to_id: int | None = None,
    only_unread: bool = False,
    is_resolved: bool | None = None,
    limit: int | None = 50,
):
    queryset = _build_company_conversations_queryset(
        company=company,
        company_reference=company_reference,
    )
    queryset = _apply_conversation_search(queryset, search=search)
    queryset = _apply_conversation_filters(
        queryset,
        status=status,
        assigned_to_id=assigned_to_id,
        only_unread=only_unread,
        is_resolved=is_resolved,
    )

    return queryset[:_normalize_limit(limit)]


def get_company_whatsapp_conversation_by_id(
    *,
    company=None,
    company_reference: str | None = None,
    conversation_id: int,
):
    if not conversation_id:
        return None

    return (
        _build_company_conversations_queryset(
            company=company,
            company_reference=company_reference,
        )
        .filter(id=conversation_id)
        .first()
    )


def get_company_whatsapp_contact_by_phone(
    *,
    company=None,
    company_reference: str | None = None,
    phone_number: str,
):
    resolved_company_reference = _resolve_company_reference(
        company=company,
        company_reference=company_reference,
    )
    if not resolved_company_reference:
        return None

    normalized_phone = normalize_phone_number(phone_number)
    if not normalized_phone:
        return None

    return (
        WhatsAppContact.objects
        .filter(
            scope_type=ScopeType.COMPANY,
            company_reference=resolved_company_reference,
            phone_number=normalized_phone,
        )
        .order_by("-last_message_at", "-id")
        .first()
    )


def get_company_whatsapp_conversation_by_contact_phone(
    *,
    company=None,
    company_reference: str | None = None,
    phone_number: str,
):
    contact = get_company_whatsapp_contact_by_phone(
        company=company,
        company_reference=company_reference,
        phone_number=phone_number,
    )
    if not contact:
        return None

    return (
        _build_company_conversations_queryset(
            company=company,
            company_reference=company_reference,
        )
        .filter(contact=contact)
        .first()
    )


def get_company_whatsapp_messages(
    *,
    company=None,
    company_reference: str | None = None,
    conversation_id: int,
    limit: int | None = 100,
):
    resolved_company_reference = _resolve_company_reference(
        company=company,
        company_reference=company_reference,
    )
    if not resolved_company_reference or not conversation_id:
        return WhatsAppConversationMessage.objects.none()

    queryset = (
        WhatsAppConversationMessage.objects
        .filter(
            conversation_id=conversation_id,
            scope_type=ScopeType.COMPANY,
            company_reference=resolved_company_reference,
        )
        .select_related("conversation", "webhook_event", "message_log")
        .order_by("message_created_at", "created_at", "id")
    )

    return queryset[:_normalize_limit(limit, default=100, maximum=2000)]


def get_company_whatsapp_last_message(
    *,
    company=None,
    company_reference: str | None = None,
    conversation_id: int,
):
    resolved_company_reference = _resolve_company_reference(
        company=company,
        company_reference=company_reference,
    )
    if not resolved_company_reference or not conversation_id:
        return None

    return (
        WhatsAppConversationMessage.objects
        .filter(
            conversation_id=conversation_id,
            scope_type=ScopeType.COMPANY,
            company_reference=resolved_company_reference,
        )
        .order_by("-message_created_at", "-created_at", "-id")
        .first()
    )


def get_company_whatsapp_inbox_summary(
    *,
    company=None,
    company_reference: str | None = None,
    search: str = "",
    assigned_to_id: int | None = None,
):
    queryset = _build_company_conversations_queryset(
        company=company,
        company_reference=company_reference,
    )
    queryset = _apply_conversation_search(queryset, search=search)

    if assigned_to_id:
        queryset = queryset.filter(assigned_to_id=assigned_to_id)

    return {
        "total_conversations": queryset.count(),
        "open_conversations": queryset.filter(status="OPEN").count(),
        "closed_conversations": queryset.filter(status="CLOSED").count(),
        "archived_conversations": queryset.filter(status="ARCHIVED").count(),
        "spam_conversations": queryset.filter(status="SPAM").count(),
        "unread_conversations": queryset.filter(unread_count__gt=0).count(),
        "resolved_conversations": queryset.filter(is_resolved=True).count(),
        "pinned_conversations": queryset.filter(is_pinned=True).count(),
    }