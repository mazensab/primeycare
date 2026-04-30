# ============================================================
# 📂 api/whatsapp/webhook.py
# Primey Care - System WhatsApp Webhook API
# ------------------------------------------------------------
# ✅ يدعم:
# - Meta-style verify endpoint
# - Internal Gateway Token Validation
# - Raw webhook audit storage
# - Baileys messages.upsert intake
# - Baileys messages.update intake
# - Legacy statuses intake
# - Delegation to webhook_service Inbox Engine
#
# ✅ متوافق مع WhatsApp Center Core V1
# ✅ لا يعتمد على company FK
# ✅ يعتمد على:
#    - scope_type
#    - company_reference
#    - company_name
# ============================================================

from __future__ import annotations

import json
import os
from typing import Any

from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from whatsapp_center.models import ScopeType
from whatsapp_center.selectors import get_active_system_whatsapp_config
from whatsapp_center.webhook_service import (
    apply_status_update_to_conversation_message,
    apply_status_update_to_message,
    create_or_update_inbox_from_webhook,
    normalize_status_value,
    store_webhook_event,
)


# ============================================================
# 🔐 Security Helpers
# ============================================================

def _safe_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _safe_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _get_internal_webhook_token() -> str:
    """
    التوكن الداخلي بين Gateway و Django.

    أولوية القراءة:
    1) Django settings
    2) Environment variable
    """
    return _safe_str(
        getattr(settings, "WHATSAPP_BACKEND_WEBHOOK_TOKEN", "")
        or os.getenv("WHATSAPP_BACKEND_WEBHOOK_TOKEN", "")
        or os.getenv("BACKEND_WEBHOOK_TOKEN", "")
    )


def _is_internal_webhook_authorized(request) -> bool:
    """
    التحقق من أن الطلب قادم من الـ gateway الداخلي.

    يدعم:
    - Authorization: Bearer <token>
    - X-Primey-Webhook-Token: <token>
    """
    expected_token = _get_internal_webhook_token()

    # إذا لم يتم ضبط توكن داخلي، نسمح مؤقتًا حتى لا نكسر البيئة الحالية.
    if not expected_token:
        return True

    auth_header = _safe_str(request.headers.get("Authorization", ""))
    token_header = _safe_str(request.headers.get("X-Primey-Webhook-Token", ""))

    if auth_header == f"Bearer {expected_token}":
        return True

    if token_header == expected_token:
        return True

    return False


# ============================================================
# 🔍 Verify Helpers
# ============================================================

def _get_verify_token_from_system_config() -> str:
    """
    جلب verify token من الإعدادات النشطة للنظام إن وجد.
    """
    try:
        config = get_active_system_whatsapp_config()
        if not config:
            return ""
        return _safe_str(getattr(config, "webhook_verify_token", ""))
    except Exception:
        return ""


def _get_expected_verify_token() -> str:
    """
    أولوية verify token:
    1) من SystemWhatsAppConfig
    2) من Django settings
    3) من environment
    """
    return (
        _get_verify_token_from_system_config()
        or _safe_str(getattr(settings, "WHATSAPP_WEBHOOK_VERIFY_TOKEN", ""))
        or _safe_str(os.getenv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", ""))
    )


# ============================================================
# 🧠 Payload Parsing Helpers
# ============================================================

def _normalize_provider(provider_value: Any) -> str:
    provider = _safe_str(provider_value).lower()

    if provider in {"meta", "meta_cloud_api"}:
        return "META"

    if provider in {
        "whatsapp_web_session",
        "web_session",
        "baileys",
        "baileys_gateway",
    }:
        return "whatsapp_web_session"

    return _safe_str(provider_value or "META") or "META"


def _resolve_scope_type(payload: dict[str, Any]) -> str:
    """
    يحدد نطاق webhook:
    - SYSTEM افتراضيًا
    - COMPANY عند وجود scope_type=COMPANY أو company_reference
    """
    raw_scope = _safe_str(payload.get("scope_type")).upper()
    company_reference = _safe_str(
        payload.get("company_reference")
        or payload.get("company_id")
        or payload.get("company_code")
        or payload.get("tenant_reference")
    )

    if raw_scope == ScopeType.COMPANY or company_reference:
        return ScopeType.COMPANY

    return ScopeType.SYSTEM


def _resolve_company_reference(payload: dict[str, Any]) -> str:
    for key in [
        "company_reference",
        "company_id",
        "company_code",
        "tenant_reference",
        "provider_id",
        "center_id",
    ]:
        value = _safe_str(payload.get(key))
        if value:
            return value

    return ""


def _resolve_company_name(payload: dict[str, Any]) -> str:
    for key in [
        "company_name",
        "company_title",
        "tenant_name",
        "provider_name",
        "center_name",
    ]:
        value = _safe_str(payload.get(key))
        if value:
            return value

    return ""


def _extract_external_message_id_from_payload(payload: dict[str, Any]) -> str:
    """
    محاولة استخراج external_message_id للـ audit event العام.
    هذا لا يؤثر على رسائل inbound المفصلة لأنها تعالج داخل webhook_service.
    """
    for key in ["external_message_id", "message_id", "id", "wamid"]:
        value = _safe_str(payload.get(key))
        if value:
            return value

    messages = payload.get("messages")
    if isinstance(messages, list) and messages:
        first = _safe_dict(messages[0])
        for key in ["message_id", "external_message_id", "id", "key_id"]:
            value = _safe_str(first.get(key))
            if value:
                return value

    statuses = payload.get("statuses")
    if isinstance(statuses, list) and statuses:
        first = _safe_dict(statuses[0])
        value = _safe_str(first.get("id") or first.get("message_id"))
        if value:
            return value

    updates = payload.get("message_updates")
    if isinstance(updates, list) and updates:
        first = _safe_dict(updates[0])
        value = _safe_str(
            first.get("message_id")
            or first.get("external_message_id")
            or first.get("id")
        )
        if value:
            return value

    return ""


def _extract_legacy_statuses(payload: dict[str, Any]) -> list[dict[str, str]]:
    """
    دعم الشكل القديم:
    {
        "statuses": [{"id": "...", "status": "delivered"}]
    }
    """
    normalized: list[dict[str, str]] = []

    for item in payload.get("statuses", []) or []:
        if not isinstance(item, dict):
            continue

        external_message_id = _safe_str(
            item.get("id")
            or item.get("message_id")
            or item.get("external_message_id")
        )
        new_status = normalize_status_value(item.get("status"))

        if external_message_id and new_status:
            normalized.append(
                {
                    "external_message_id": external_message_id,
                    "new_status": new_status,
                }
            )

    return normalized


def _extract_gateway_message_updates(payload: dict[str, Any]) -> list[dict[str, str]]:
    """
    دعم الشكل الجديد القادم من Gateway:
    {
        "event": "messages.update",
        "message_updates": [
            {
                "message_id": "...",
                "update": {
                    "status": "read"
                }
            }
        ]
    }
    """
    normalized: list[dict[str, str]] = []

    for item in payload.get("message_updates", []) or []:
        if not isinstance(item, dict):
            continue

        external_message_id = _safe_str(
            item.get("message_id")
            or item.get("external_message_id")
            or item.get("id")
        )

        update = item.get("update", {}) or {}
        if not isinstance(update, dict):
            update = {}

        candidate_status = (
            update.get("status")
            or update.get("delivery_status")
            or update.get("ack")
            or update.get("messageStatus")
            or item.get("status")
            or item.get("delivery_status")
            or item.get("ack")
        )

        new_status = normalize_status_value(candidate_status)

        if external_message_id and new_status:
            normalized.append(
                {
                    "external_message_id": external_message_id,
                    "new_status": new_status,
                }
            )

    return normalized


def _collect_status_updates(payload: dict[str, Any]) -> list[dict[str, str]]:
    updates: list[dict[str, str]] = []
    updates.extend(_extract_legacy_statuses(payload))
    updates.extend(_extract_gateway_message_updates(payload))
    return updates


def _apply_status_updates(payload: dict[str, Any]) -> int:
    """
    تطبيق status updates على:
    - WhatsAppMessageLog
    - WhatsAppConversationMessage
    """
    applied_count = 0

    for item in _collect_status_updates(payload):
        external_message_id = item.get("external_message_id") or ""
        new_status = item.get("new_status") or ""

        if not external_message_id or not new_status:
            continue

        log = apply_status_update_to_message(
            external_message_id=external_message_id,
            new_status=new_status,
        )
        if log:
            applied_count += 1

        conversation_message = apply_status_update_to_conversation_message(
            external_message_id=external_message_id,
            new_status=new_status,
        )
        if conversation_message:
            applied_count += 1

    return applied_count


def _read_payload(request) -> dict[str, Any] | None:
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return None

    if not isinstance(payload, dict):
        return None

    return payload


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


def _json_success(**payload):
    return JsonResponse(
        {
            "ok": True,
            "success": True,
            **payload,
        },
        status=200,
    )


# ============================================================
# 🌐 Verify Endpoint
# ============================================================

@require_GET
def system_whatsapp_webhook_verify(request):
    verify_token = _safe_str(request.GET.get("hub.verify_token"))
    challenge = _safe_str(request.GET.get("hub.challenge"))

    expected_verify_token = _get_expected_verify_token()

    # إذا لا يوجد توكن مضبوط:
    # نحافظ على السلوك الحالي دون كسر البيئة.
    if not expected_verify_token:
        if verify_token:
            return HttpResponse(challenge or "OK")
        return HttpResponse("Missing verify token", status=400)

    if verify_token and verify_token == expected_verify_token:
        return HttpResponse(challenge or "OK")

    return HttpResponse("Invalid verify token", status=403)


# ============================================================
# 📥 Webhook Receive Endpoint
# ============================================================

@csrf_exempt
@require_POST
def system_whatsapp_webhook_receive(request):
    if not _is_internal_webhook_authorized(request):
        return _json_error(
            "Unauthorized webhook token",
            status=401,
        )

    payload = _read_payload(request)
    if payload is None:
        return _json_error(
            "Invalid JSON or payload must be a JSON object",
            status=400,
        )

    provider = _normalize_provider(payload.get("provider") or "META")
    event_type = _safe_str(
        payload.get("event_type")
        or payload.get("event")
        or "provider_webhook"
    )

    scope_type = _resolve_scope_type(payload)
    company_reference = _resolve_company_reference(payload)
    company_name = _resolve_company_name(payload)

    if scope_type == ScopeType.SYSTEM:
        company_reference = ""
        company_name = ""

    audit_event_id = None
    inbound_created = 0
    inbound_skipped = 0
    applied_status_updates = 0

    # --------------------------------------------------------
    # 1) Audit Store — نحفظ payload الخام كاملًا أولًا
    # --------------------------------------------------------
    try:
        audit_event = store_webhook_event(
            payload=payload,
            event_type=event_type or "provider_webhook",
            external_message_id=_extract_external_message_id_from_payload(payload),
            scope_type=scope_type,
            company_reference=company_reference,
            company_name=company_name,
            provider=provider,
        )
        audit_event_id = getattr(audit_event, "id", None)
    except Exception:
        # لا نوقف المعالجة بسبب فشل الـ audit store
        audit_event_id = None

    # --------------------------------------------------------
    # 2) Inbound Messages Intake + Runtime Creation
    # --------------------------------------------------------
    try:
        if payload.get("messages"):
            result = create_or_update_inbox_from_webhook(
                payload=payload,
                scope_type=scope_type,
                company_reference=company_reference,
                company_name=company_name,
            ) or {}

            inbound_created = int(result.get("created_count", 0) or 0)
            inbound_skipped = int(result.get("skipped_count", 0) or 0)
    except Exception:
        inbound_created = 0
        inbound_skipped = 0

    # --------------------------------------------------------
    # 3) Status Updates Intake
    # --------------------------------------------------------
    try:
        applied_status_updates = _apply_status_updates(payload)
    except Exception:
        applied_status_updates = 0

    return _json_success(
        message="Webhook received",
        event_type=event_type,
        provider=provider,
        scope_type=scope_type,
        company_reference=company_reference,
        company_name=company_name,
        audit_event_id=audit_event_id,
        inbound_created=inbound_created,
        inbound_skipped=inbound_skipped,
        applied_status_updates=applied_status_updates,
    )