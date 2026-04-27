# ============================================================
# 📂 api/whatsapp/logs.py
# Primey Care - System WhatsApp Logs API
# ============================================================

from __future__ import annotations

from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.views.decorators.http import require_GET

from whatsapp_center.models import ScopeType, WhatsAppMessageLog
from api.whatsapp.helpers import json_ok


def _safe_iso(value):
    return value.isoformat() if value else None


@login_required
@require_GET
def system_whatsapp_logs(request):
    q = (request.GET.get("q") or "").strip()
    status = (request.GET.get("status") or "").strip()
    event_code = (request.GET.get("event_code") or "").strip()
    recipient_phone = (request.GET.get("recipient_phone") or "").strip()
    limit_raw = (request.GET.get("limit") or "200").strip()

    try:
        limit = int(limit_raw)
    except ValueError:
        limit = 200

    if limit <= 0:
        limit = 200
    if limit > 500:
        limit = 500

    logs = (
        WhatsAppMessageLog.objects
        .filter(scope_type=ScopeType.SYSTEM)
        .select_related("template", "company")
        .order_by("-created_at")
    )

    if status:
        logs = logs.filter(delivery_status=status)

    if event_code:
        logs = logs.filter(event_code=event_code)

    if recipient_phone:
        logs = logs.filter(recipient_phone__icontains=recipient_phone)

    if q:
        logs = logs.filter(
            Q(event_code__icontains=q)
            | Q(recipient_phone__icontains=q)
            | Q(recipient_name__icontains=q)
            | Q(template_name_snapshot__icontains=q)
            | Q(message_body__icontains=q)
            | Q(failure_reason__icontains=q)
            | Q(provider_status__icontains=q)
        )

    logs = logs[:limit]

    results = []
    for log in logs:
        results.append(
            {
                "id": log.id,

                # ----------------------------------------------------
                # ✅ مفاتيح أساسية متوافقة مع الفرونت الحالي
                # ----------------------------------------------------
                "status": log.delivery_status,
                "direction": "OUTBOUND",
                "message_type": log.message_type,
                "recipient_phone": log.recipient_phone,
                "template_name": log.template_name_snapshot or (
                    getattr(log.template, "template_name", "") if log.template else ""
                ),
                "created_at": _safe_iso(log.created_at),
                "provider_message_id": log.external_message_id or "",
                "error_message": log.failure_reason or "",
                "company_name": getattr(log.company, "name", "") if log.company else "",
                "payload_summary": log.message_body or "",

                # ----------------------------------------------------
                # ✅ مفاتيح إضافية مفيدة للتوسعة لاحقًا
                # ----------------------------------------------------
                "scope_type": log.scope_type,
                "company_id": log.company_id,
                "event_code": log.event_code,
                "trigger_source": log.trigger_source,
                "recipient_name": log.recipient_name,
                "delivery_status": log.delivery_status,
                "provider_status": log.provider_status,
                "failure_reason": log.failure_reason,
                "message_body": log.message_body,
                "header_text": getattr(log, "header_text", ""),
                "footer_text": getattr(log, "footer_text", ""),
                "attachment_url": getattr(log, "attachment_url", ""),
                "attachment_name": getattr(log, "attachment_name", ""),
                "mime_type": getattr(log, "mime_type", ""),
                "sent_at": _safe_iso(log.sent_at),
                "delivered_at": _safe_iso(log.delivered_at),
                "read_at": _safe_iso(log.read_at),
                "failed_at": _safe_iso(getattr(log, "failed_at", None)),
                "response_json": log.response_json if getattr(log, "response_json", None) else {},
                "payload_json": log.payload_json if getattr(log, "payload_json", None) else {},
            }
        )

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
            "limit": limit,
        },
    )