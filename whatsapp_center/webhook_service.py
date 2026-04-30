# ============================================================
# 📂 whatsapp_center/webhook_service.py
# 🧠 Primey Care - WhatsApp Webhook Service V1 Core
# ------------------------------------------------------------
# ✅ يدعم:
#    - Raw webhook audit storage
#    - Safe provider normalization
#    - Safe status normalization
#    - Idempotent inbound event detection
#    - Message log status update
#    - Inbox Runtime Engine
#      * Contact create/update
#      * Conversation create/update
#      * ConversationMessage create/update
#
# ✅ متوافق مع Primey Care WhatsApp Models V1 Core
# ✅ لا يستخدم company FK مباشر
# ✅ يعتمد على:
#    - scope_type
#    - company_reference
#    - company_name
# ============================================================

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from django.db import transaction
from django.utils import timezone

from .models import (
    ConversationDirection,
    DeliveryStatus,
    MessageType,
    ScopeType,
    WhatsAppContact,
    WhatsAppConversation,
    WhatsAppConversationMessage,
    WhatsAppMessageLog,
    WhatsAppWebhookEvent,
)
from .utils import normalize_phone_number

logger = logging.getLogger(__name__)


# ============================================================
# 🔧 Generic Helpers
# ============================================================

def _safe_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _safe_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _safe_bool(value: Any) -> bool:
    return bool(value)


def _normalize_provider(provider: str) -> str:
    value = _safe_str(provider).lower()

    if value in {"meta", "meta_cloud_api"}:
        return "META"

    if value in {"whatsapp_web_session", "web_session", "baileys", "baileys_gateway"}:
        return "whatsapp_web_session"

    return _safe_str(provider or "META") or "META"


def _resolve_scope_type(scope_type: str) -> str:
    value = _safe_str(scope_type).upper()
    if value == ScopeType.COMPANY:
        return ScopeType.COMPANY
    return ScopeType.SYSTEM


def _resolve_company_reference(
    *,
    company=None,
    company_reference: str | None = None,
    payload: dict | None = None,
    message_item: dict | None = None,
) -> str:
    if company_reference:
        return _safe_str(company_reference)

    payload = _safe_dict(payload)
    message_item = _safe_dict(message_item)

    for source in [message_item, payload]:
        for key in ["company_reference", "company_id", "company_code", "tenant_reference"]:
            value = _safe_str(source.get(key))
            if value:
                return value

    if company is not None:
        for attr_name in ["company_reference", "reference", "code", "pk", "id"]:
            value = getattr(company, attr_name, None)
            if value not in [None, ""]:
                return _safe_str(value)

    return ""


def _resolve_company_name(
    *,
    company=None,
    company_name: str | None = None,
    payload: dict | None = None,
    message_item: dict | None = None,
) -> str:
    if company_name:
        return _safe_str(company_name)

    payload = _safe_dict(payload)
    message_item = _safe_dict(message_item)

    for source in [message_item, payload]:
        for key in ["company_name", "company_title", "tenant_name"]:
            value = _safe_str(source.get(key))
            if value:
                return value

    if company is not None:
        for attr_name in ["company_name", "name", "title"]:
            value = _safe_str(getattr(company, attr_name, ""))
            if value:
                return value

    return ""


def _system_company_reference() -> str:
    return ""


def _clean_company_reference_for_scope(
    *,
    scope_type: str,
    company_reference: str = "",
) -> str:
    resolved_scope = _resolve_scope_type(scope_type)
    if resolved_scope == ScopeType.COMPANY:
        return _safe_str(company_reference)
    return _system_company_reference()


def normalize_status_value(value: Any) -> str:
    """
    توحيد حالات الرسائل القادمة من مزودات مختلفة.
    """
    if value is None:
        return ""

    if isinstance(value, bool):
        return ""

    if isinstance(value, (int, float)):
        numeric = int(value)
        mapping = {
            0: "",
            1: "sent",
            2: "delivered",
            3: "read",
            4: "read",
            5: "failed",
        }
        return mapping.get(numeric, "")

    status = _safe_str(value).lower()

    if status in {"sent", "server_ack", "ack"}:
        return "sent"

    if status in {"delivered", "delivery_ack"}:
        return "delivered"

    if status in {"read", "read_ack", "played"}:
        return "read"

    if status in {"failed", "error", "message_failed"}:
        return "failed"

    return status


def _normalize_runtime_message_type(message_type: str, media_type: str = "") -> str:
    """
    تحويل أنواع الرسائل القادمة من Baileys / gateway إلى MessageType الداخلي.
    """
    msg_type = _safe_str(message_type).lower()
    media_type = _safe_str(media_type).lower()

    if media_type:
        return MessageType.DOCUMENT

    if msg_type in {
        "conversation",
        "extendedtextmessage",
        "extended_text_message",
        "buttonsresponsemessage",
        "buttons_response_message",
        "listresponsemessage",
        "list_response_message",
        "templatebuttonreplymessage",
        "template_button_reply_message",
        "text",
    }:
        return MessageType.TEXT

    if msg_type in {"template", "templatemessage", "template_message"}:
        return MessageType.TEMPLATE

    if msg_type:
        return MessageType.DOCUMENT

    return MessageType.TEXT


def _parse_message_datetime(message_item: dict[str, Any]):
    """
    محاولة قراءة وقت الرسالة بشكل آمن.
    """
    timestamp_iso = _safe_str(message_item.get("timestamp_iso"))
    if timestamp_iso:
        try:
            parsed = datetime.fromisoformat(timestamp_iso.replace("Z", "+00:00"))
            if timezone.is_naive(parsed):
                return timezone.make_aware(parsed, timezone.get_current_timezone())
            return parsed
        except Exception:
            pass

    timestamp = message_item.get("timestamp")
    if isinstance(timestamp, (int, float)) and timestamp:
        try:
            return datetime.fromtimestamp(int(timestamp), tz=timezone.utc)
        except Exception:
            pass

    return timezone.now()


def _extract_external_message_id(message_item: dict[str, Any]) -> str:
    return _safe_str(
        message_item.get("message_id")
        or message_item.get("external_message_id")
        or message_item.get("id")
        or message_item.get("key_id")
    )


# ============================================================
# 🌐 Webhook Event Storage
# ============================================================

def store_webhook_event(
    *,
    payload: dict,
    event_type: str = "",
    external_message_id: str = "",
    scope_type: str = ScopeType.SYSTEM,
    company=None,
    company_reference: str | None = None,
    company_name: str | None = None,
    provider: str = "META",
):
    """
    تخزين webhook event الخام كما وصل من المزود / gateway.

    Primey Care V1:
    لا نستخدم company FK مباشر.
    نعتمد على scope_type + company_reference + company_name.
    """
    payload = _safe_dict(payload)
    resolved_scope_type = _resolve_scope_type(scope_type)
    resolved_company_reference = _clean_company_reference_for_scope(
        scope_type=resolved_scope_type,
        company_reference=_resolve_company_reference(
            company=company,
            company_reference=company_reference,
            payload=payload,
        ),
    )
    resolved_company_name = (
        _resolve_company_name(
            company=company,
            company_name=company_name,
            payload=payload,
        )
        if resolved_scope_type == ScopeType.COMPANY
        else ""
    )

    return WhatsAppWebhookEvent.objects.create(
        scope_type=resolved_scope_type,
        company_reference=resolved_company_reference,
        company_name=resolved_company_name,
        provider=_normalize_provider(provider),
        event_type=_safe_str(event_type) or "provider_webhook",
        external_message_id=_safe_str(external_message_id),
        payload_json=payload,
    )


def inbound_event_exists(
    *,
    external_message_id: str,
    scope_type: str = ScopeType.SYSTEM,
    company=None,
    company_reference: str | None = None,
    event_type: str = "inbound_message",
) -> bool:
    """
    تحقق idempotent:
    هل تم تخزين نفس الرسالة الواردة مسبقًا؟
    """
    external_message_id = _safe_str(external_message_id)
    if not external_message_id:
        return False

    resolved_scope_type = _resolve_scope_type(scope_type)
    resolved_company_reference = _clean_company_reference_for_scope(
        scope_type=resolved_scope_type,
        company_reference=_resolve_company_reference(
            company=company,
            company_reference=company_reference,
        ),
    )

    return WhatsAppWebhookEvent.objects.filter(
        scope_type=resolved_scope_type,
        company_reference=resolved_company_reference,
        external_message_id=external_message_id,
        event_type=event_type,
    ).exists()


def store_inbound_message_event(
    *,
    payload: dict,
    external_message_id: str,
    scope_type: str = ScopeType.SYSTEM,
    company=None,
    company_reference: str | None = None,
    company_name: str | None = None,
    provider: str = "whatsapp_web_session",
):
    """
    تخزين رسالة واردة كـ event مستقل.
    """
    return store_webhook_event(
        payload=payload,
        event_type="inbound_message",
        external_message_id=external_message_id,
        scope_type=scope_type,
        company=company,
        company_reference=company_reference,
        company_name=company_name,
        provider=provider,
    )


# ============================================================
# 🧾 Message Log Resolvers
# ============================================================

def get_message_log_by_external_message_id(*, external_message_id: str):
    external_message_id = _safe_str(external_message_id)
    if not external_message_id:
        return None

    return (
        WhatsAppMessageLog.objects
        .filter(external_message_id=external_message_id)
        .order_by("-id")
        .first()
    )


def get_conversation_message_by_external_message_id(*, external_message_id: str):
    external_message_id = _safe_str(external_message_id)
    if not external_message_id:
        return None

    return (
        WhatsAppConversationMessage.objects
        .filter(external_message_id=external_message_id)
        .order_by("-id")
        .first()
    )


# ============================================================
# 🔄 Status Update Engine
# ============================================================

def apply_status_update_to_message(*, external_message_id: str, new_status: str):
    """
    تطبيق حالة الرسالة على آخر سجل مطابق في WhatsAppMessageLog.
    """
    external_message_id = _safe_str(external_message_id)
    if not external_message_id:
        return None

    log = get_message_log_by_external_message_id(
        external_message_id=external_message_id,
    )
    if not log:
        return None

    status = normalize_status_value(new_status)
    if not status:
        return log

    now = timezone.now()
    changed_fields: list[str] = []

    if status == "sent":
        if log.delivery_status != DeliveryStatus.SENT:
            log.delivery_status = DeliveryStatus.SENT
            changed_fields.append("delivery_status")

        if not log.sent_at:
            log.sent_at = now
            changed_fields.append("sent_at")

    elif status == "delivered":
        if log.delivery_status != DeliveryStatus.DELIVERED:
            log.delivery_status = DeliveryStatus.DELIVERED
            changed_fields.append("delivery_status")

        if not log.delivered_at:
            log.delivered_at = now
            changed_fields.append("delivered_at")

        if not log.sent_at:
            log.sent_at = now
            changed_fields.append("sent_at")

    elif status == "read":
        if log.delivery_status != DeliveryStatus.READ:
            log.delivery_status = DeliveryStatus.READ
            changed_fields.append("delivery_status")

        if not log.read_at:
            log.read_at = now
            changed_fields.append("read_at")

        if not log.delivered_at:
            log.delivered_at = now
            changed_fields.append("delivered_at")

        if not log.sent_at:
            log.sent_at = now
            changed_fields.append("sent_at")

    elif status == "failed":
        if log.delivery_status != DeliveryStatus.FAILED:
            log.delivery_status = DeliveryStatus.FAILED
            changed_fields.append("delivery_status")

        if not log.failed_at:
            log.failed_at = now
            changed_fields.append("failed_at")

    if log.provider_status != _safe_str(new_status):
        log.provider_status = _safe_str(new_status)
        changed_fields.append("provider_status")

    if changed_fields:
        if "updated_at" not in changed_fields:
            changed_fields.append("updated_at")
        log.save(update_fields=list(dict.fromkeys(changed_fields)))

    return log


def apply_status_update_to_conversation_message(
    *,
    external_message_id: str,
    new_status: str,
):
    """
    تطبيق الحالة على طبقة Runtime للشات.
    """
    external_message_id = _safe_str(external_message_id)
    if not external_message_id:
        return None

    message = get_conversation_message_by_external_message_id(
        external_message_id=external_message_id,
    )
    if not message:
        return None

    status = normalize_status_value(new_status)
    if not status:
        return message

    now = timezone.now()
    changed_fields: list[str] = []

    if message.provider_status != _safe_str(new_status):
        message.provider_status = _safe_str(new_status)
        changed_fields.append("provider_status")

    if status == "sent":
        if message.delivery_status != DeliveryStatus.SENT:
            message.delivery_status = DeliveryStatus.SENT
            changed_fields.append("delivery_status")
        if not message.sent_at:
            message.sent_at = now
            changed_fields.append("sent_at")

    elif status == "delivered":
        if message.delivery_status != DeliveryStatus.DELIVERED:
            message.delivery_status = DeliveryStatus.DELIVERED
            changed_fields.append("delivery_status")
        if not message.delivered_at:
            message.delivered_at = now
            changed_fields.append("delivered_at")
        if not message.sent_at:
            message.sent_at = now
            changed_fields.append("sent_at")

    elif status == "read":
        if message.delivery_status != DeliveryStatus.READ:
            message.delivery_status = DeliveryStatus.READ
            changed_fields.append("delivery_status")
        if not message.read_at:
            message.read_at = now
            changed_fields.append("read_at")
        if not message.delivered_at:
            message.delivered_at = now
            changed_fields.append("delivered_at")
        if not message.sent_at:
            message.sent_at = now
            changed_fields.append("sent_at")
        if not message.is_read:
            message.is_read = True
            changed_fields.append("is_read")

    elif status == "failed":
        if message.delivery_status != DeliveryStatus.FAILED:
            message.delivery_status = DeliveryStatus.FAILED
            changed_fields.append("delivery_status")
        if not message.failed_at:
            message.failed_at = now
            changed_fields.append("failed_at")

    if changed_fields:
        if "updated_at" not in changed_fields:
            changed_fields.append("updated_at")
        message.save(update_fields=list(dict.fromkeys(changed_fields)))

    return message


def apply_provider_status_webhook(
    *,
    payload: dict,
    external_message_id: str,
    new_status: str,
    scope_type: str = ScopeType.SYSTEM,
    company=None,
    company_reference: str | None = None,
    company_name: str | None = None,
    provider: str = "whatsapp_web_session",
):
    """
    تخزين webhook حالة الرسالة ثم تطبيقها على:
    - WhatsAppMessageLog
    - WhatsAppConversationMessage إن وجدت
    """
    external_message_id = _safe_str(external_message_id)
    if not external_message_id:
        return {
            "success": False,
            "message": "external_message_id is required.",
            "message_log_updated": False,
            "conversation_message_updated": False,
        }

    event = store_webhook_event(
        payload=payload,
        event_type="message_status",
        external_message_id=external_message_id,
        scope_type=scope_type,
        company=company,
        company_reference=company_reference,
        company_name=company_name,
        provider=provider,
    )

    log = apply_status_update_to_message(
        external_message_id=external_message_id,
        new_status=new_status,
    )

    conversation_message = apply_status_update_to_conversation_message(
        external_message_id=external_message_id,
        new_status=new_status,
    )

    return {
        "success": True,
        "webhook_event_id": event.id,
        "message_log_updated": bool(log),
        "conversation_message_updated": bool(conversation_message),
    }


# ============================================================
# 📦 Payload Helpers
# ============================================================

def build_inbound_runtime_snapshot(*, payload: dict) -> dict[str, Any]:
    """
    Snapshot مبسط ومفيد عند بناء Runtime Layer.
    """
    payload = _safe_dict(payload)
    message = _safe_dict(payload.get("message"))

    return {
        "provider": _safe_str(payload.get("provider")),
        "source": _safe_str(payload.get("source")),
        "event_type": _safe_str(payload.get("event_type") or payload.get("event")),
        "scope_type": _safe_str(payload.get("scope_type") or ScopeType.SYSTEM),
        "company_reference": _safe_str(payload.get("company_reference")),
        "company_name": _safe_str(payload.get("company_name")),
        "session_name": _safe_str(payload.get("session_name")),
        "message_id": _extract_external_message_id(message),
        "sender_phone": _safe_str(message.get("sender_phone")),
        "remote_phone": _safe_str(message.get("remote_phone")),
        "sender_jid": _safe_str(message.get("sender_jid")),
        "remote_jid": _safe_str(message.get("remote_jid")),
        "push_name": _safe_str(message.get("push_name")),
        "message_type": _safe_str(message.get("message_type")),
        "text": _safe_str(message.get("text")),
        "caption": _safe_str(message.get("caption")),
        "media_type": _safe_str(message.get("media_type")),
        "mime_type": _safe_str(message.get("mime_type")),
        "file_name": _safe_str(message.get("file_name")),
        "timestamp": message.get("timestamp") or 0,
        "timestamp_iso": _safe_str(message.get("timestamp_iso")),
        "from_me": bool(message.get("from_me", False)),
        "is_group": bool(message.get("is_group", False)),
        "is_broadcast": bool(message.get("is_broadcast", False)),
        "is_status": bool(message.get("is_status", False)),
    }


def build_inbound_event_payload(
    *,
    root_payload: dict,
    message_item: dict,
    scope_type: str = ScopeType.SYSTEM,
    company_reference: str = "",
    company_name: str = "",
) -> dict[str, Any]:
    """
    بناء payload مستقل لكل رسالة واردة.
    """
    return {
        "provider": root_payload.get("provider") or "whatsapp_web_session",
        "source": root_payload.get("source") or "baileys_gateway",
        "event": "inbound_message",
        "event_type": "inbound_message",
        "scope_type": _resolve_scope_type(scope_type),
        "company_reference": _safe_str(company_reference),
        "company_name": _safe_str(company_name),
        "session_name": root_payload.get("session_name") or "",
        "received_at": root_payload.get("received_at") or "",
        "message": message_item,
    }


# ============================================================
# 💬 Inbox Runtime Helpers
# ============================================================

def resolve_normalized_phone(*, message_item: dict) -> str:
    candidates = [
        message_item.get("sender_phone"),
        message_item.get("remote_phone"),
        message_item.get("from"),
        message_item.get("phone"),
    ]

    for candidate in candidates:
        normalized = normalize_phone_number(_safe_str(candidate))
        if normalized:
            return normalized

    return ""


def resolve_or_create_contact(
    *,
    scope_type: str,
    company=None,
    company_reference: str | None = None,
    company_name: str | None = None,
    message_item: dict,
) -> WhatsAppContact | None:
    scope_type = _resolve_scope_type(scope_type)
    resolved_company_reference = _clean_company_reference_for_scope(
        scope_type=scope_type,
        company_reference=_resolve_company_reference(
            company=company,
            company_reference=company_reference,
            message_item=message_item,
        ),
    )
    resolved_company_name = (
        _resolve_company_name(
            company=company,
            company_name=company_name,
            message_item=message_item,
        )
        if scope_type == ScopeType.COMPANY
        else ""
    )

    phone_number = resolve_normalized_phone(message_item=message_item)
    if not phone_number:
        return None

    message_at = _parse_message_datetime(message_item)

    defaults = {
        "company_name": resolved_company_name,
        "display_name": _safe_str(
            message_item.get("push_name")
            or message_item.get("sender_name")
            or message_item.get("name")
            or ""
        ),
        "push_name": _safe_str(message_item.get("push_name")),
        "wa_jid": _safe_str(
            message_item.get("sender_jid")
            or message_item.get("remote_jid")
            or message_item.get("jid")
        ),
        "profile_name": _safe_str(message_item.get("push_name")),
        "last_seen_at": timezone.now(),
        "last_message_at": message_at,
        "extra_json": {
            "session_name": _safe_str(message_item.get("session_name")),
            "source": "webhook",
        },
    }

    contact, created = WhatsAppContact.objects.get_or_create(
        scope_type=scope_type,
        company_reference=resolved_company_reference,
        phone_number=phone_number,
        defaults=defaults,
    )

    update_fields: list[str] = []

    if created:
        return contact

    if resolved_company_name and contact.company_name != resolved_company_name:
        contact.company_name = resolved_company_name
        update_fields.append("company_name")

    display_name = _safe_str(
        message_item.get("push_name")
        or message_item.get("sender_name")
        or message_item.get("name")
        or ""
    )
    if display_name and contact.display_name != display_name:
        contact.display_name = display_name
        update_fields.append("display_name")

    push_name = _safe_str(message_item.get("push_name"))
    if push_name and contact.push_name != push_name:
        contact.push_name = push_name
        update_fields.append("push_name")

    wa_jid = _safe_str(
        message_item.get("sender_jid")
        or message_item.get("remote_jid")
        or message_item.get("jid")
    )
    if wa_jid and contact.wa_jid != wa_jid:
        contact.wa_jid = wa_jid
        update_fields.append("wa_jid")

    if contact.last_seen_at is None or contact.last_seen_at <= timezone.now():
        contact.last_seen_at = timezone.now()
        update_fields.append("last_seen_at")

    if contact.last_message_at != message_at:
        contact.last_message_at = message_at
        update_fields.append("last_message_at")

    if update_fields:
        if "updated_at" not in update_fields:
            update_fields.append("updated_at")
        contact.save(update_fields=list(dict.fromkeys(update_fields)))

    return contact


def resolve_or_create_conversation(
    *,
    scope_type: str,
    company=None,
    company_reference: str | None = None,
    company_name: str | None = None,
    contact: WhatsAppContact,
    message_item: dict,
) -> WhatsAppConversation:
    scope_type = _resolve_scope_type(scope_type)
    resolved_company_reference = _clean_company_reference_for_scope(
        scope_type=scope_type,
        company_reference=_resolve_company_reference(
            company=company,
            company_reference=company_reference,
            message_item=message_item,
        ),
    )
    resolved_company_name = (
        _resolve_company_name(
            company=company,
            company_name=company_name,
            message_item=message_item,
        )
        if scope_type == ScopeType.COMPANY
        else ""
    )

    session_name = _safe_str(message_item.get("session_name"))

    conversation = (
        WhatsAppConversation.objects
        .filter(
            scope_type=scope_type,
            company_reference=resolved_company_reference,
            contact=contact,
        )
        .order_by("-last_message_at", "-id")
        .first()
    )

    if conversation:
        update_fields: list[str] = []

        if resolved_company_name and conversation.company_name != resolved_company_name:
            conversation.company_name = resolved_company_name
            update_fields.append("company_name")

        if session_name and conversation.session_name != session_name:
            conversation.session_name = session_name
            update_fields.append("session_name")

        if update_fields:
            if "updated_at" not in update_fields:
                update_fields.append("updated_at")
            conversation.save(update_fields=list(dict.fromkeys(update_fields)))

        return conversation

    return WhatsAppConversation.objects.create(
        scope_type=scope_type,
        company_reference=resolved_company_reference,
        company_name=resolved_company_name,
        contact=contact,
        session_name=session_name,
        status="OPEN",
        unread_count=0,
        last_message_preview="",
        last_message_at=None,
        extra_json={},
    )


def conversation_message_exists(
    *,
    external_message_id: str,
    scope_type: str,
    company=None,
    company_reference: str | None = None,
) -> bool:
    external_message_id = _safe_str(external_message_id)
    if not external_message_id:
        return False

    resolved_scope_type = _resolve_scope_type(scope_type)
    resolved_company_reference = _clean_company_reference_for_scope(
        scope_type=resolved_scope_type,
        company_reference=_resolve_company_reference(
            company=company,
            company_reference=company_reference,
        ),
    )

    return WhatsAppConversationMessage.objects.filter(
        external_message_id=external_message_id,
        scope_type=resolved_scope_type,
        company_reference=resolved_company_reference,
    ).exists()


def create_inbound_conversation_message(
    *,
    root_payload: dict,
    scope_type: str,
    company=None,
    company_reference: str | None = None,
    company_name: str | None = None,
    message_item: dict,
    contact: WhatsAppContact,
    conversation: WhatsAppConversation,
    webhook_event: WhatsAppWebhookEvent | None,
) -> WhatsAppConversationMessage | None:
    scope_type = _resolve_scope_type(scope_type)
    resolved_company_reference = _clean_company_reference_for_scope(
        scope_type=scope_type,
        company_reference=_resolve_company_reference(
            company=company,
            company_reference=company_reference,
            payload=root_payload,
            message_item=message_item,
        ),
    )
    resolved_company_name = (
        _resolve_company_name(
            company=company,
            company_name=company_name,
            payload=root_payload,
            message_item=message_item,
        )
        if scope_type == ScopeType.COMPANY
        else ""
    )

    external_message_id = _extract_external_message_id(message_item)
    if not external_message_id:
        return None

    if conversation_message_exists(
        external_message_id=external_message_id,
        scope_type=scope_type,
        company=company,
        company_reference=resolved_company_reference,
    ):
        return None

    body_text = _safe_str(message_item.get("text"))
    caption = _safe_str(message_item.get("caption"))
    message_created_at = _parse_message_datetime(message_item)

    message = WhatsAppConversationMessage.objects.create(
        conversation=conversation,
        scope_type=scope_type,
        company_reference=resolved_company_reference,
        company_name=resolved_company_name,
        direction=ConversationDirection.INBOUND,
        message_type=_normalize_runtime_message_type(
            message_type=_safe_str(message_item.get("message_type")),
            media_type=_safe_str(message_item.get("media_type")),
        ),
        external_message_id=external_message_id,
        provider=_normalize_provider(root_payload.get("provider") or "whatsapp_web_session"),
        provider_status="received",
        delivery_status=DeliveryStatus.DELIVERED,
        wa_jid=_safe_str(
            message_item.get("sender_jid")
            or message_item.get("remote_jid")
            or message_item.get("jid")
        ),
        sender_phone=contact.phone_number,
        sender_name=contact.display_name or contact.push_name,
        body_text=body_text,
        caption=caption,
        attachment_url=_safe_str(message_item.get("attachment_url")),
        attachment_name=_safe_str(message_item.get("file_name")),
        mime_type=_safe_str(message_item.get("mime_type")),
        media_type=_safe_str(message_item.get("media_type")),
        is_read=False,
        is_from_me=False,
        replied_to_external_message_id=_safe_str(
            message_item.get("replied_to_external_message_id")
            or message_item.get("quoted_message_id")
        ),
        payload_json=message_item,
        extra_json={
            "session_name": _safe_str(root_payload.get("session_name")),
            "source": _safe_str(root_payload.get("source")),
            "is_group": _safe_bool(message_item.get("is_group")),
            "is_broadcast": _safe_bool(message_item.get("is_broadcast")),
            "is_status": _safe_bool(message_item.get("is_status")),
        },
        webhook_event=webhook_event,
        message_log=None,
        message_created_at=message_created_at,
        delivered_at=timezone.now(),
    )

    preview = body_text or caption or _safe_str(message_item.get("media_type")) or "Message"

    conversation.last_message_preview = preview[:1000]
    conversation.last_message_at = message_created_at
    conversation.unread_count = (conversation.unread_count or 0) + 1

    update_fields = [
        "last_message_preview",
        "last_message_at",
        "unread_count",
        "updated_at",
    ]

    session_name = _safe_str(root_payload.get("session_name"))
    if session_name and conversation.session_name != session_name:
        conversation.session_name = session_name
        update_fields.append("session_name")

    if resolved_company_name and conversation.company_name != resolved_company_name:
        conversation.company_name = resolved_company_name
        update_fields.append("company_name")

    conversation.save(update_fields=list(dict.fromkeys(update_fields)))

    contact.last_message_at = message_created_at
    contact.last_seen_at = timezone.now()

    contact_update_fields = ["last_message_at", "last_seen_at", "updated_at"]
    if resolved_company_name and contact.company_name != resolved_company_name:
        contact.company_name = resolved_company_name
        contact_update_fields.append("company_name")

    contact.save(update_fields=list(dict.fromkeys(contact_update_fields)))

    return message


# ============================================================
# 🚀 Inbox Engine
# ============================================================

def create_or_update_inbox_from_webhook(
    *,
    payload: dict,
    scope_type: str = ScopeType.SYSTEM,
    company=None,
    company_reference: str | None = None,
    company_name: str | None = None,
) -> dict[str, int]:
    """
    إنشاء / تحديث Inbox Runtime من payload يحتوي على messages.

    الناتج:
    {
        "created_count": x,
        "skipped_count": y,
    }

    Primey Care V1:
    - لا يعتمد على company FK.
    - يستخدم scope_type + company_reference.
    """
    payload = _safe_dict(payload)
    scope_type = _resolve_scope_type(payload.get("scope_type") or scope_type)

    resolved_company_reference = _clean_company_reference_for_scope(
        scope_type=scope_type,
        company_reference=_resolve_company_reference(
            company=company,
            company_reference=company_reference,
            payload=payload,
        ),
    )

    resolved_company_name = (
        _resolve_company_name(
            company=company,
            company_name=company_name,
            payload=payload,
        )
        if scope_type == ScopeType.COMPANY
        else ""
    )

    created_count = 0
    skipped_count = 0

    messages = payload.get("messages", []) or []

    for item in messages:
        if not isinstance(item, dict):
            skipped_count += 1
            continue

        external_message_id = _extract_external_message_id(item)

        if not external_message_id:
            skipped_count += 1
            continue

        if _safe_bool(item.get("from_me")):
            skipped_count += 1
            continue

        if _safe_bool(item.get("is_status")):
            skipped_count += 1
            continue

        normalized_phone = resolve_normalized_phone(message_item=item)
        if not normalized_phone:
            skipped_count += 1
            continue

        if inbound_event_exists(
            external_message_id=external_message_id,
            scope_type=scope_type,
            company=company,
            company_reference=resolved_company_reference,
            event_type="inbound_message",
        ):
            skipped_count += 1
            continue

        inbound_payload = build_inbound_event_payload(
            root_payload=payload,
            message_item=item,
            scope_type=scope_type,
            company_reference=resolved_company_reference,
            company_name=resolved_company_name,
        )

        try:
            with transaction.atomic():
                inbound_event = store_inbound_message_event(
                    payload=inbound_payload,
                    external_message_id=external_message_id,
                    scope_type=scope_type,
                    company=company,
                    company_reference=resolved_company_reference,
                    company_name=resolved_company_name,
                    provider=_normalize_provider(
                        payload.get("provider") or "whatsapp_web_session"
                    ),
                )

                contact = resolve_or_create_contact(
                    scope_type=scope_type,
                    company=company,
                    company_reference=resolved_company_reference,
                    company_name=resolved_company_name,
                    message_item=item,
                )
                if not contact:
                    raise ValueError("Failed to resolve contact")

                conversation = resolve_or_create_conversation(
                    scope_type=scope_type,
                    company=company,
                    company_reference=resolved_company_reference,
                    company_name=resolved_company_name,
                    contact=contact,
                    message_item=item,
                )

                message = create_inbound_conversation_message(
                    root_payload=payload,
                    scope_type=scope_type,
                    company=company,
                    company_reference=resolved_company_reference,
                    company_name=resolved_company_name,
                    message_item=item,
                    contact=contact,
                    conversation=conversation,
                    webhook_event=inbound_event,
                )

                if not message:
                    raise ValueError("Conversation message already exists")

                created_count += 1

        except Exception as exc:
            skipped_count += 1
            logger.warning(
                "Skipped inbound WhatsApp message | external_message_id=%s | error=%s",
                external_message_id,
                exc,
            )
            continue

    return {
        "created_count": created_count,
        "skipped_count": skipped_count,
    }