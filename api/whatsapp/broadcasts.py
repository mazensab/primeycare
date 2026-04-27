# ============================================================
# 📂 api/whatsapp/broadcasts.py
# Primey Care - System WhatsApp Broadcast APIs (Core-Compatible)
# ============================================================
# ✅ متوافق مع WhatsApp Center Core V1 الحالي
# ✅ بدون أي اعتماد على موديلات غير موجودة مثل:
#    - WhatsAppBroadcast
#    - WhatsAppBroadcastRecipient
#    - BroadcastAudienceType
#    - BroadcastStatus
#    - RecipientType
# ✅ يدعم حاليًا:
#    - List recent broadcast logs from WhatsAppMessageLog
#    - Immediate manual broadcast to RAW_NUMBERS
#    - Optional SYSTEM_USERS audience
# ✅ يؤجل:
#    - draft/execute lifecycle
#    - stored broadcast campaigns
#    - company-based audience engines
# ============================================================

from __future__ import annotations

import json
import uuid
from typing import Any

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_GET, require_POST

from api.whatsapp.helpers import clean_phone, json_bad_request, json_ok, json_server_error
from whatsapp_center.models import ScopeType, TriggerSource, WhatsAppMessageLog
from whatsapp_center.services import send_event_whatsapp_message

User = get_user_model()


# ============================================================
# 🧩 Supported Audience / Message Types
# ============================================================
ALLOWED_MESSAGE_TYPES = {
    "TEXT",
    "DOCUMENT",
}

ALLOWED_AUDIENCE_TYPES = {
    "RAW_NUMBERS",
    "SYSTEM_USERS",
}


# ============================================================
# 🔧 Helpers
# ============================================================
def _json_body(request) -> dict:
    try:
        if not request.body:
            return {}
        return json.loads(request.body.decode("utf-8"))
    except Exception:
        return {}


def _safe_str(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _normalize_raw_numbers(value) -> list[str]:
    if not value:
        return []

    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]

    if isinstance(value, str):
        if "," in value:
            return [item.strip() for item in value.split(",") if item.strip()]
        return [line.strip() for line in value.splitlines() if line.strip()]

    return []


def _get_user_phone(user) -> str:
    for field_name in [
        "mobile",
        "phone",
        "phone_number",
        "mobile_number",
        "whatsapp_number",
    ]:
        value = _safe_str(getattr(user, field_name, ""))
        if value:
            return value

    for profile_attr in ["profile", "userprofile"]:
        profile = getattr(user, profile_attr, None)
        if not profile:
            continue

        for field_name in [
            "mobile",
            "phone",
            "phone_number",
            "mobile_number",
            "whatsapp_number",
        ]:
            value = _safe_str(getattr(profile, field_name, ""))
            if value:
                return value

    return ""


def _get_user_display_name(user) -> str:
    get_full_name = getattr(user, "get_full_name", None)
    if callable(get_full_name):
        full_name = _safe_str(get_full_name())
        if full_name:
            return full_name

    return (
        _safe_str(getattr(user, "full_name", ""))
        or _safe_str(getattr(user, "username", ""))
        or _safe_str(getattr(user, "email", ""))
        or "User"
    )


def _resolve_system_users_recipients() -> list[dict[str, str]]:
    recipients: list[dict[str, str]] = []
    seen: set[str] = set()

    try:
        users = User.objects.filter(is_active=True).order_by("id")
    except Exception:
        users = User.objects.none()

    for user in users:
        phone = clean_phone(_get_user_phone(user))
        if not phone:
            continue

        if phone in seen:
            continue

        seen.add(phone)
        recipients.append(
            {
                "recipient_name": _get_user_display_name(user),
                "recipient_phone": phone,
                "recipient_role": "user",
            }
        )

    return recipients


def _resolve_raw_recipients(raw_numbers: list[str]) -> list[dict[str, str]]:
    recipients: list[dict[str, str]] = []
    seen: set[str] = set()

    for raw_phone in raw_numbers:
        phone = clean_phone(raw_phone)
        if not phone:
            continue

        if phone in seen:
            continue

        seen.add(phone)
        recipients.append(
            {
                "recipient_name": "Raw Recipient",
                "recipient_phone": phone,
                "recipient_role": "raw",
            }
        )

    return recipients


def _resolve_broadcast_recipients(audience_type: str, raw_numbers: list[str]) -> list[dict[str, str]]:
    if audience_type == "RAW_NUMBERS":
        return _resolve_raw_recipients(raw_numbers)

    if audience_type == "SYSTEM_USERS":
        return _resolve_system_users_recipients()

    return []


def _serialize_broadcast_log(log: WhatsAppMessageLog) -> dict:
    return {
        "id": log.id,
        "broadcast_run_id": log.related_object_id or "",
        "title": log.message_subject or "",
        "recipient_name": log.recipient_name,
        "recipient_phone": log.recipient_phone,
        "recipient_role": log.recipient_role,
        "message_type": log.message_type,
        "event_code": log.event_code,
        "trigger_source": log.trigger_source,
        "delivery_status": log.delivery_status,
        "provider_status": log.provider_status,
        "failure_reason": log.failure_reason,
        "external_message_id": log.external_message_id,
        "message_body": log.message_body,
        "attachment_url": log.attachment_url,
        "attachment_name": log.attachment_name,
        "mime_type": log.mime_type,
        "created_at": log.created_at.isoformat() if log.created_at else None,
        "sent_at": log.sent_at.isoformat() if log.sent_at else None,
        "delivered_at": log.delivered_at.isoformat() if log.delivered_at else None,
        "read_at": log.read_at.isoformat() if log.read_at else None,
    }


# ============================================================
# 📋 List
# ============================================================
@login_required
@require_GET
def system_whatsapp_broadcasts(request):
    """
    بما أن Core الحالي لا يحتوي موديلات broadcast campaigns،
    فإن هذا endpoint يعرض آخر رسائل broadcast الفعلية المسجلة في WhatsAppMessageLog.
    """
    limit_raw = _safe_str(request.GET.get("limit") or "100")

    try:
        limit = int(limit_raw)
    except ValueError:
        limit = 100

    if limit <= 0:
        limit = 100
    if limit > 500:
        limit = 500

    logs = (
        WhatsAppMessageLog.objects
        .filter(
            scope_type=ScopeType.SYSTEM,
            trigger_source=TriggerSource.BROADCAST,
        )
        .order_by("-created_at")[:limit]
    )

    results = [_serialize_broadcast_log(item) for item in logs]

    return json_ok(
        "System WhatsApp broadcast logs loaded successfully",
        results=results,
        data=results,
        count=len(results),
        mode="log_backed_broadcasts",
    )


# ============================================================
# ➕ Create + Execute Immediately
# ============================================================
@login_required
@require_POST
def system_whatsapp_broadcast_create(request):
    """
    في Core الحالي لا يوجد WhatsAppBroadcast model،
    لذلك create هنا ينفّذ البث مباشرة ويعيد النتائج.
    """
    body = _json_body(request)

    title = _safe_str(body.get("title"))
    message_type = _safe_str(body.get("message_type") or "TEXT").upper()
    message_body = _safe_str(body.get("message_body"))
    audience_type = _safe_str(body.get("audience_type") or "RAW_NUMBERS").upper()
    raw_numbers = _normalize_raw_numbers(body.get("raw_numbers"))
    attachment_url = _safe_str(body.get("attachment_url"))
    attachment_name = _safe_str(body.get("attachment_name"))
    mime_type = _safe_str(body.get("mime_type"))

    errors = {}

    if not title:
        errors["title"] = "title is required"

    if not message_body:
        errors["message_body"] = "message_body is required"

    if message_type not in ALLOWED_MESSAGE_TYPES:
        errors["message_type"] = f"Invalid message_type. Allowed: {sorted(ALLOWED_MESSAGE_TYPES)}"

    if audience_type not in ALLOWED_AUDIENCE_TYPES:
        errors["audience_type"] = f"Invalid audience_type. Allowed: {sorted(ALLOWED_AUDIENCE_TYPES)}"

    if audience_type == "RAW_NUMBERS" and not raw_numbers:
        errors["raw_numbers"] = "raw_numbers is required when audience_type is RAW_NUMBERS"

    if message_type == "DOCUMENT" and not attachment_url:
        errors["attachment_url"] = "attachment_url is required when message_type is DOCUMENT"

    if errors:
        return json_bad_request("Validation error", errors=errors)

    try:
        recipients = _resolve_broadcast_recipients(audience_type, raw_numbers)
        if not recipients:
            return json_bad_request("No valid recipients found for this broadcast")

        broadcast_run_id = str(uuid.uuid4())
        sent_count = 0
        failed_count = 0
        results: list[dict[str, Any]] = []

        for item in recipients:
            log = send_event_whatsapp_message(
                scope_type=ScopeType.SYSTEM,
                trigger_source=TriggerSource.BROADCAST,
                event_code="system_broadcast_manual",
                recipient_phone=item["recipient_phone"],
                recipient_name=item["recipient_name"],
                recipient_role=item["recipient_role"],
                context={
                    "broadcast_title": title,
                    "message": message_body,
                    "recipient_name": item["recipient_name"],
                    "recipient_phone": item["recipient_phone"],
                },
                related_model="ImmediateBroadcast",
                related_object_id=broadcast_run_id,
                attachment_url=attachment_url if message_type == "DOCUMENT" else "",
                attachment_name=attachment_name if message_type == "DOCUMENT" else "",
                mime_type=mime_type if message_type == "DOCUMENT" else "",
            )

            serialized = _serialize_broadcast_log(log)
            serialized["broadcast_title"] = title
            results.append(serialized)

            if _safe_str(getattr(log, "delivery_status", "")) == "SENT":
                sent_count += 1
            else:
                failed_count += 1

        return json_ok(
            "System WhatsApp broadcast executed successfully",
            data={
                "broadcast_run_id": broadcast_run_id,
                "title": title,
                "audience_type": audience_type,
                "message_type": message_type,
                "total_recipients": len(recipients),
                "sent_count": sent_count,
                "failed_count": failed_count,
                "results": results,
            },
            mode="immediate_execution",
        )

    except Exception as exc:
        return json_server_error(
            "Failed to execute system WhatsApp broadcast",
            error=str(exc),
        )


# ============================================================
# 🔎 Detail
# ============================================================
@login_required
@require_GET
def system_whatsapp_broadcast_detail(request, broadcast_id: int):
    """
    غير مدعوم حاليًا لأن Core لا يحتوي stored broadcast model.
    """
    return json_bad_request(
        "Stored broadcast detail is not available in WhatsApp Core V1 yet",
        broadcast_id=broadcast_id,
        mode="not_supported_yet",
    )


# ============================================================
# 🚀 Execute
# ============================================================
@login_required
@require_POST
def system_whatsapp_broadcast_execute(request, broadcast_id: int):
    """
    غير مدعوم حاليًا لأن Core لا يحتوي stored broadcast model.
    """
    return json_bad_request(
        "Stored broadcast execute is not available in WhatsApp Core V1 yet",
        broadcast_id=broadcast_id,
        mode="not_supported_yet",
    )