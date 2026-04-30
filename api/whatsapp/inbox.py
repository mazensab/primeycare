# ============================================================
# 📂 api/whatsapp/inbox.py
# Primey Care - System WhatsApp Inbox APIs
# ------------------------------------------------------------
# ✅ يدعم:
# - Inbox conversations list
# - Conversation details
# - Conversation messages
# - Inbox summary
# - Mark conversation as read
# - Update conversation status
# - Toggle resolved / pinned
#
# ✅ متوافق مع WhatsApp Center Core V1
# ✅ لا يعتمد على company FK أو company_id
# ✅ يعتمد على:
#    - scope_type
#    - company_reference
#    - company_name
# ============================================================

from __future__ import annotations

import json
from typing import Any

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST

from whatsapp_center.models import ConversationStatus, ScopeType
from whatsapp_center.selectors import (
    get_system_whatsapp_conversation_by_id,
    get_system_whatsapp_inbox,
    get_system_whatsapp_inbox_summary,
    get_system_whatsapp_messages,
)


# ============================================================
# 🔧 Helpers
# ============================================================

def _safe_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _safe_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value

    value = _safe_str(value).lower()
    return value in {"1", "true", "yes", "on"}


def _safe_iso(value: Any) -> str | None:
    try:
        return value.isoformat() if value else None
    except Exception:
        return None


def _read_json_body(request) -> dict:
    try:
        if not request.body:
            return {}
        parsed = json.loads(request.body.decode("utf-8"))
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _get_attr(obj: Any, attr_name: str, default: Any = "") -> Any:
    try:
        return getattr(obj, attr_name, default)
    except Exception:
        return default


def _json_success(**payload):
    return JsonResponse(
        {
            "ok": True,
            "success": True,
            **payload,
        },
        status=200,
    )


def _json_error(message: str, status: int = 400, **extra):
    return JsonResponse(
        {
            "ok": False,
            "success": False,
            "message": message,
            **extra,
        },
        status=status,
    )


# ============================================================
# 🧾 Serializers
# ============================================================

def _serialize_contact(contact) -> dict:
    if not contact:
        return {}

    return {
        "id": contact.id,
        "scope_type": contact.scope_type,
        "company_reference": _get_attr(contact, "company_reference", "") or "",
        "company_name": _get_attr(contact, "company_name", "") or "",
        "phone_number": contact.phone_number,
        "display_name": contact.display_name,
        "push_name": contact.push_name,
        "wa_jid": contact.wa_jid,
        "profile_name": contact.profile_name,
        "is_blocked": contact.is_blocked,
        "is_business": contact.is_business,
        "last_message_at": _safe_iso(contact.last_message_at),
        "last_seen_at": _safe_iso(contact.last_seen_at),
        "notes": contact.notes,
        "extra_json": contact.extra_json or {},
        "created_at": _safe_iso(contact.created_at),
        "updated_at": _safe_iso(contact.updated_at),
    }


def _serialize_assigned_user(user) -> dict:
    if not user:
        return {
            "id": None,
            "name": "",
            "email": "",
            "username": "",
        }

    assigned_to_name = ""

    get_full_name = getattr(user, "get_full_name", None)
    if callable(get_full_name):
        assigned_to_name = _safe_str(get_full_name())

    if not assigned_to_name:
        assigned_to_name = (
            _safe_str(getattr(user, "full_name", ""))
            or _safe_str(getattr(user, "username", ""))
            or _safe_str(getattr(user, "email", ""))
        )

    return {
        "id": getattr(user, "id", None),
        "name": assigned_to_name,
        "email": _safe_str(getattr(user, "email", "")),
        "username": _safe_str(getattr(user, "username", "")),
    }


def _serialize_conversation(conversation) -> dict:
    contact = getattr(conversation, "contact", None)
    assigned_to = getattr(conversation, "assigned_to", None)
    assigned_user = _serialize_assigned_user(assigned_to)

    return {
        "id": conversation.id,
        "scope_type": conversation.scope_type,
        "company_reference": _get_attr(conversation, "company_reference", "") or "",
        "company_name": _get_attr(conversation, "company_name", "") or "",
        "status": conversation.status,
        "subject": conversation.subject,
        "assigned_to_id": getattr(conversation, "assigned_to_id", None),
        "assigned_to_name": assigned_user["name"],
        "assigned_to": assigned_user,
        "session_name": conversation.session_name,
        "unread_count": conversation.unread_count,
        "last_message_preview": conversation.last_message_preview,
        "last_message_at": _safe_iso(conversation.last_message_at),
        "is_pinned": conversation.is_pinned,
        "is_muted": conversation.is_muted,
        "is_resolved": conversation.is_resolved,
        "extra_json": conversation.extra_json or {},
        "created_at": _safe_iso(conversation.created_at),
        "updated_at": _safe_iso(conversation.updated_at),
        "contact": _serialize_contact(contact),
    }


def _serialize_message(message) -> dict:
    return {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "scope_type": message.scope_type,
        "company_reference": _get_attr(message, "company_reference", "") or "",
        "company_name": _get_attr(message, "company_name", "") or "",
        "direction": message.direction,
        "message_type": message.message_type,
        "external_message_id": message.external_message_id,
        "provider": message.provider,
        "provider_status": message.provider_status,
        "delivery_status": message.delivery_status,
        "wa_jid": message.wa_jid,
        "sender_phone": message.sender_phone,
        "sender_name": message.sender_name,
        "body_text": message.body_text,
        "caption": message.caption,
        "attachment_url": message.attachment_url,
        "attachment_name": message.attachment_name,
        "mime_type": message.mime_type,
        "media_type": message.media_type,
        "is_read": message.is_read,
        "is_from_me": message.is_from_me,
        "replied_to_external_message_id": message.replied_to_external_message_id,
        "payload_json": message.payload_json or {},
        "extra_json": message.extra_json or {},
        "webhook_event_id": message.webhook_event_id,
        "message_log_id": message.message_log_id,
        "message_created_at": _safe_iso(message.message_created_at),
        "sent_at": _safe_iso(message.sent_at),
        "delivered_at": _safe_iso(message.delivered_at),
        "read_at": _safe_iso(message.read_at),
        "failed_at": _safe_iso(message.failed_at),
        "created_at": _safe_iso(message.created_at),
        "updated_at": _safe_iso(message.updated_at),
    }


# ============================================================
# 📥 Inbox Summary
# ============================================================

@login_required
@require_GET
def system_whatsapp_inbox_summary(request):
    search = _safe_str(request.GET.get("search", ""))
    assigned_to_id = _safe_int(request.GET.get("assigned_to_id"), 0) or None

    summary = get_system_whatsapp_inbox_summary(
        search=search,
        assigned_to_id=assigned_to_id,
    )

    return _json_success(
        message="System WhatsApp inbox summary loaded successfully",
        scope_type=ScopeType.SYSTEM,
        summary=summary,
        data=summary,
    )


# ============================================================
# 📋 Inbox Conversations List
# ============================================================

@login_required
@require_GET
def system_whatsapp_inbox_list(request):
    search = _safe_str(request.GET.get("search", ""))
    status_value = _safe_str(request.GET.get("status", ""))
    assigned_to_id = _safe_int(request.GET.get("assigned_to_id"), 0) or None
    only_unread = _safe_bool(request.GET.get("only_unread", False))

    is_resolved_param = request.GET.get("is_resolved", None)
    if is_resolved_param is None:
        is_resolved = None
    else:
        is_resolved = _safe_bool(is_resolved_param)

    limit = _safe_int(request.GET.get("limit"), 50)
    if limit <= 0:
        limit = 50
    if limit > 200:
        limit = 200

    conversations = get_system_whatsapp_inbox(
        search=search,
        status=status_value,
        assigned_to_id=assigned_to_id,
        only_unread=only_unread,
        is_resolved=is_resolved,
        limit=limit,
    )

    data = [_serialize_conversation(item) for item in conversations]

    return _json_success(
        message="System WhatsApp inbox conversations loaded successfully",
        scope_type=ScopeType.SYSTEM,
        count=len(data),
        results=data,
        data=data,
        filters={
            "search": search,
            "status": status_value,
            "assigned_to_id": assigned_to_id,
            "only_unread": only_unread,
            "is_resolved": is_resolved,
            "limit": limit,
        },
    )


# ============================================================
# 💬 Conversation Details
# ============================================================

@login_required
@require_GET
def system_whatsapp_conversation_detail(request, conversation_id: int):
    conversation = get_system_whatsapp_conversation_by_id(conversation_id)
    if not conversation:
        return _json_error("Conversation not found", status=404)

    serialized = _serialize_conversation(conversation)

    return _json_success(
        message="System WhatsApp conversation loaded successfully",
        conversation=serialized,
        data=serialized,
    )


# ============================================================
# 📨 Conversation Messages
# ============================================================

@login_required
@require_GET
def system_whatsapp_conversation_messages(request, conversation_id: int):
    conversation = get_system_whatsapp_conversation_by_id(conversation_id)
    if not conversation:
        return _json_error("Conversation not found", status=404)

    limit = _safe_int(request.GET.get("limit"), 100)
    if limit <= 0:
        limit = 100
    if limit > 500:
        limit = 500

    messages = get_system_whatsapp_messages(
        conversation_id=conversation_id,
        limit=limit,
    )

    data = [_serialize_message(item) for item in messages]

    return _json_success(
        message="System WhatsApp conversation messages loaded successfully",
        conversation=_serialize_conversation(conversation),
        count=len(data),
        results=data,
        data=data,
        filters={
            "conversation_id": conversation_id,
            "limit": limit,
        },
    )


# ============================================================
# ✅ Mark Conversation As Read
# ============================================================

@login_required
@require_POST
def system_whatsapp_mark_conversation_read(request, conversation_id: int):
    conversation = get_system_whatsapp_conversation_by_id(conversation_id)
    if not conversation:
        return _json_error("Conversation not found", status=404)

    updated_messages = (
        conversation.messages
        .filter(is_read=False, is_from_me=False)
        .update(is_read=True)
    )

    conversation.unread_count = 0
    conversation.save(update_fields=["unread_count", "updated_at"])

    return _json_success(
        message="Conversation marked as read",
        conversation_id=conversation.id,
        updated_messages=updated_messages,
        unread_count=conversation.unread_count,
        conversation=_serialize_conversation(conversation),
    )


# ============================================================
# 🔄 Update Conversation Status
# ============================================================

@login_required
@require_POST
def system_whatsapp_update_conversation_status(request, conversation_id: int):
    conversation = get_system_whatsapp_conversation_by_id(conversation_id)
    if not conversation:
        return _json_error("Conversation not found", status=404)

    body = _read_json_body(request)
    status_value = _safe_str(body.get("status") or request.POST.get("status", ""))

    allowed_statuses = {
        ConversationStatus.OPEN,
        ConversationStatus.CLOSED,
        ConversationStatus.ARCHIVED,
        ConversationStatus.SPAM,
    }

    if status_value not in allowed_statuses:
        return _json_error(
            "Invalid conversation status",
            status=400,
            allowed_statuses=sorted(allowed_statuses),
        )

    conversation.status = status_value
    conversation.save(update_fields=["status", "updated_at"])

    return _json_success(
        message="Conversation status updated successfully",
        conversation=_serialize_conversation(conversation),
    )


# ============================================================
# 🧩 Toggle Resolved
# ============================================================

@login_required
@require_POST
def system_whatsapp_toggle_conversation_resolved(request, conversation_id: int):
    conversation = get_system_whatsapp_conversation_by_id(conversation_id)
    if not conversation:
        return _json_error("Conversation not found", status=404)

    body = _read_json_body(request)
    is_resolved = _safe_bool(
        body.get(
            "is_resolved",
            request.POST.get("is_resolved", not conversation.is_resolved),
        )
    )

    conversation.is_resolved = is_resolved
    conversation.save(update_fields=["is_resolved", "updated_at"])

    return _json_success(
        message="Conversation resolved state updated successfully",
        conversation=_serialize_conversation(conversation),
    )


# ============================================================
# 📌 Toggle Pinned
# ============================================================

@login_required
@require_POST
def system_whatsapp_toggle_conversation_pinned(request, conversation_id: int):
    conversation = get_system_whatsapp_conversation_by_id(conversation_id)
    if not conversation:
        return _json_error("Conversation not found", status=404)

    body = _read_json_body(request)
    is_pinned = _safe_bool(
        body.get(
            "is_pinned",
            request.POST.get("is_pinned", not conversation.is_pinned),
        )
    )

    conversation.is_pinned = is_pinned
    conversation.save(update_fields=["is_pinned", "updated_at"])

    return _json_success(
        message="Conversation pinned state updated successfully",
        conversation=_serialize_conversation(conversation),
    )