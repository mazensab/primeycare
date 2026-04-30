# ============================================================
# 📂 api/whatsapp/logs.py
# Primey Care - System WhatsApp Logs API
# ------------------------------------------------------------
# ✅ يعرض سجلات رسائل WhatsApp الخاصة بالنظام
# ✅ يدعم البحث والفلترة
# ✅ متوافق مع WhatsApp Center Core V1
# ✅ لا يعتمد على company FK أو company_id
# ✅ يعتمد على:
#    - scope_type
#    - company_reference
#    - company_name
# ============================================================

from __future__ import annotations

from typing import Any

from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.views.decorators.http import require_GET

from api.whatsapp.helpers import json_ok
from whatsapp_center.models import ScopeType, WhatsAppMessageLog


# ============================================================
# 🔧 Helpers
# ============================================================

def _safe_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _safe_iso(value: Any):
    try:
        return value.isoformat() if value else None
    except Exception:
        return None


def _safe_int(value: Any, default: int = 200) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _get_attr(obj: Any, attr_name: str, default: Any = "") -> Any:
    try:
        return getattr(obj, attr_name, default)
    except Exception:
        return default


def _serialize_log(log: WhatsAppMessageLog) -> dict:
    template = getattr(log, "template", None)

    template_name = (
        _safe_str(getattr(log, "template_name_snapshot", ""))
        or _safe_str(getattr(template, "template_name", "")) if template else ""
    )

    company_reference = _safe_str(_get_attr(log, "company_reference", ""))
    company_name = _safe_str(_get_attr(log, "company_name", ""))

    return {
        "id": log.id,

        # ----------------------------------------------------
        # ✅ مفاتيح أساسية متوافقة مع الفرونت الحالي
        # ----------------------------------------------------
        "status": log.delivery_status,
        "direction": "OUTBOUND",
        "message_type": log.message_type,
        "recipient_phone": log.recipient_phone,
        "template_name": template_name,
        "created_at": _safe_iso(log.created_at),
        "provider_message_id": log.external_message_id or "",
        "error_message": log.failure_reason or "",
        "company_reference": company_reference,
        "company_name": company_name,
        "payload_summary": log.message_body or "",

        # ----------------------------------------------------
        # ✅ مفاتيح إضافية مفيدة للتوسعة لاحقًا
        # ----------------------------------------------------
        "scope_type": log.scope_type,
        "event_code": log.event_code,
        "trigger_source": log.trigger_source,
        "recipient_name": log.recipient_name,
        "recipient_role": _safe_str(_get_attr(log, "recipient_role", "")),
        "delivery_status": log.delivery_status,
        "provider": _safe_str(_get_attr(log, "provider", "")),
        "provider_status": log.provider_status,
        "failure_reason": log.failure_reason,
        "external_message_id": log.external_message_id or "",
        "language_code": _safe_str(_get_attr(log, "language_code", "")),
        "message_body": log.message_body,
        "header_text": _safe_str(_get_attr(log, "header_text", "")),
        "footer_text": _safe_str(_get_attr(log, "footer_text", "")),
        "attachment_url": _safe_str(_get_attr(log, "attachment_url", "")),
        "attachment_name": _safe_str(_get_attr(log, "attachment_name", "")),
        "mime_type": _safe_str(_get_attr(log, "mime_type", "")),
        "template_id": getattr(log, "template_id", None),
        "template_key": _safe_str(getattr(template, "template_key", "")) if template else "",
        "sent_at": _safe_iso(log.sent_at),
        "delivered_at": _safe_iso(log.delivered_at),
        "read_at": _safe_iso(log.read_at),
        "failed_at": _safe_iso(_get_attr(log, "failed_at", None)),
        "response_json": _get_attr(log, "response_json", {}) or {},
        "payload_json": _get_attr(log, "payload_json", {}) or {},
        "created_by_id": _get_attr(log, "created_by_id", None),
        "updated_at": _safe_iso(_get_attr(log, "updated_at", None)),
    }


# ============================================================
# 📋 Logs API
# ============================================================

@login_required
@require_GET
def system_whatsapp_logs(request):
    q = _safe_str(request.GET.get("q", ""))
    status = _safe_str(request.GET.get("status", ""))
    event_code = _safe_str(request.GET.get("event_code", ""))
    recipient_phone = _safe_str(request.GET.get("recipient_phone", ""))
    company_reference = _safe_str(request.GET.get("company_reference", ""))
    provider_status = _safe_str(request.GET.get("provider_status", ""))
    trigger_source = _safe_str(request.GET.get("trigger_source", ""))
    limit = _safe_int(request.GET.get("limit"), 200)

    if limit <= 0:
        limit = 200
    if limit > 500:
        limit = 500

    logs = (
        WhatsAppMessageLog.objects
        .filter(scope_type=ScopeType.SYSTEM)
        .select_related("template")
        .order_by("-created_at")
    )

    if status:
        logs = logs.filter(delivery_status=status)

    if event_code:
        logs = logs.filter(event_code=event_code)

    if recipient_phone:
        logs = logs.filter(recipient_phone__icontains=recipient_phone)

    if company_reference:
        logs = logs.filter(company_reference=company_reference)

    if provider_status:
        logs = logs.filter(provider_status=provider_status)

    if trigger_source:
        logs = logs.filter(trigger_source=trigger_source)

    if q:
        logs = logs.filter(
            Q(event_code__icontains=q)
            | Q(trigger_source__icontains=q)
            | Q(recipient_phone__icontains=q)
            | Q(recipient_name__icontains=q)
            | Q(recipient_role__icontains=q)
            | Q(template_name_snapshot__icontains=q)
            | Q(message_body__icontains=q)
            | Q(failure_reason__icontains=q)
            | Q(provider_status__icontains=q)
            | Q(external_message_id__icontains=q)
            | Q(company_reference__icontains=q)
            | Q(company_name__icontains=q)
        )

    logs = logs[:limit]
    results = [_serialize_log(log) for log in logs]

    return json_ok(
        "System WhatsApp logs loaded successfully",
        data=results,
        results=results,
        count=len(results),
        filters={
            "q": q,
            "status": status,
            "event_code": event_code,
            "recipient_phone": recipient_phone,
            "company_reference": company_reference,
            "provider_status": provider_status,
            "trigger_source": trigger_source,
            "limit": limit,
        },
    )