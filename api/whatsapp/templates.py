# ============================================================
# 📂 api/whatsapp/templates.py
# Primey Care - System WhatsApp Templates API
# ------------------------------------------------------------
# ✅ إدارة قوالب WhatsApp الخاصة بالنظام
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
from django.db import transaction
from django.db.models import Max, Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET, require_POST

from api.whatsapp.helpers import json_ok
from whatsapp_center.models import (
    MessageType,
    ScopeType,
    TemplateApprovalStatus,
    TemplateProviderSyncStatus,
    WhatsAppTemplate,
)


# ============================================================
# 🧩 Constants
# ============================================================

SYSTEM_COMPANY_REFERENCE = ""
SYSTEM_COMPANY_NAME = ""

MESSAGE_TYPE_VALUES = {choice[0] for choice in MessageType.choices}
APPROVAL_STATUS_VALUES = {choice[0] for choice in TemplateApprovalStatus.choices}
PROVIDER_STATUS_VALUES = {choice[0] for choice in TemplateProviderSyncStatus.choices}


# ============================================================
# ❌ Response Helpers
# ============================================================

def _json_error(message: str, status: int = 400, errors: dict | None = None):
    return JsonResponse(
        {
            "ok": False,
            "success": False,
            "message": message,
            "errors": errors or {},
        },
        status=status,
    )


# ============================================================
# 🧠 Small Helpers
# ============================================================

def _safe_iso(value: Any):
    try:
        return value.isoformat() if value else None
    except Exception:
        return None


def _clean_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def _build_body_preview(body_text: str, limit: int = 180) -> str:
    text = _clean_str(body_text)
    if not text:
        return ""

    if len(text) <= limit:
        return text

    return f"{text[:limit].rstrip()}..."


def _parse_json_body(request) -> dict:
    try:
        body = request.body.decode("utf-8") if request.body else "{}"
        parsed = json.loads(body or "{}")
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError as exc:
        raise ValueError("Invalid JSON payload") from exc


def _as_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value

    if value is None:
        return default

    if isinstance(value, str):
        normalized = value.strip().lower()

        if normalized in {"true", "1", "yes", "on"}:
            return True

        if normalized in {"false", "0", "no", "off"}:
            return False

    if isinstance(value, int):
        return value == 1

    return default


def _system_templates_queryset():
    return WhatsAppTemplate.objects.filter(
        scope_type=ScopeType.SYSTEM,
        company_reference=SYSTEM_COMPANY_REFERENCE,
    )


def _get_model_attr(obj: Any, attr_name: str, default: Any = "") -> Any:
    try:
        return getattr(obj, attr_name, default)
    except Exception:
        return default


# ============================================================
# 🧾 Serializer
# ============================================================

def _serialize_template(item: WhatsAppTemplate) -> dict:
    company_reference = _clean_str(_get_model_attr(item, "company_reference", ""))
    company_name = _clean_str(_get_model_attr(item, "company_name", ""))

    return {
        # ----------------------------------------------------
        # Core Fields
        # ----------------------------------------------------
        "id": item.id,
        "scope_type": item.scope_type,
        "company_reference": company_reference,
        "company_name": company_name,
        "event_code": item.event_code,
        "template_key": item.template_key,
        "template_name": item.template_name,
        "language_code": item.language_code,
        "message_type": item.message_type,
        "header_text": item.header_text,
        "body_text": item.body_text,
        "footer_text": item.footer_text,
        "button_text": item.button_text,
        "button_url": item.button_url,
        "meta_template_name": item.meta_template_name,
        "meta_template_namespace": item.meta_template_namespace,
        "is_default": item.is_default,
        "is_active": item.is_active,
        "version": item.version,
        "created_at": _safe_iso(item.created_at),
        "updated_at": _safe_iso(item.updated_at),

        # ----------------------------------------------------
        # Lifecycle
        # ----------------------------------------------------
        "approval_status": item.approval_status,
        "provider_status": item.provider_status,
        "rejection_reason": item.rejection_reason,
        "last_synced_at": _safe_iso(_get_model_attr(item, "last_synced_at", None)),

        # ----------------------------------------------------
        # Metadata
        # ----------------------------------------------------
        "created_by_id": _get_model_attr(item, "created_by_id", None),
        "updated_by_id": _get_model_attr(item, "updated_by_id", None),

        # ----------------------------------------------------
        # Frontend Helpers
        # ----------------------------------------------------
        "name": item.template_name or item.template_key or f"Template #{item.id}",
        "language": item.language_code,
        "status": item.approval_status,
        "category": item.event_code,
        "template_type": item.message_type,
        "body_preview": _build_body_preview(item.body_text),
    }


# ============================================================
# ✅ Validation
# ============================================================

def _validate_template_payload(payload: dict, is_update: bool = False):
    errors: dict[str, str] = {}

    event_code = _clean_str(payload.get("event_code"))
    template_key = _clean_str(payload.get("template_key"))
    template_name = _clean_str(payload.get("template_name"))
    language_code = _clean_str(payload.get("language_code"), "ar").lower()
    message_type = _clean_str(payload.get("message_type"), MessageType.TEXT).upper()

    header_text = _clean_str(payload.get("header_text"))
    body_text = _clean_str(payload.get("body_text"))
    footer_text = _clean_str(payload.get("footer_text"))
    button_text = _clean_str(payload.get("button_text"))
    button_url = _clean_str(payload.get("button_url"))

    meta_template_name = _clean_str(payload.get("meta_template_name"))
    meta_template_namespace = _clean_str(payload.get("meta_template_namespace"))

    approval_status = _clean_str(
        payload.get("approval_status"),
        TemplateApprovalStatus.DRAFT,
    ).upper()

    provider_status = _clean_str(
        payload.get("provider_status"),
        TemplateProviderSyncStatus.NOT_SYNCED,
    ).upper()

    rejection_reason = _clean_str(payload.get("rejection_reason"))

    is_default = _as_bool(payload.get("is_default"), False)
    is_active = _as_bool(payload.get("is_active"), True)

    if not is_update or "event_code" in payload:
        if not event_code:
            errors["event_code"] = "event_code is required."

    if not is_update or "template_key" in payload:
        if not template_key:
            errors["template_key"] = "template_key is required."

    if not is_update or "body_text" in payload:
        if not body_text:
            errors["body_text"] = "body_text is required."

    if message_type not in MESSAGE_TYPE_VALUES:
        errors["message_type"] = (
            f"message_type must be one of: {sorted(MESSAGE_TYPE_VALUES)}"
        )

    if approval_status not in APPROVAL_STATUS_VALUES:
        errors["approval_status"] = (
            f"approval_status must be one of: {sorted(APPROVAL_STATUS_VALUES)}"
        )

    if provider_status not in PROVIDER_STATUS_VALUES:
        errors["provider_status"] = (
            f"provider_status must be one of: {sorted(PROVIDER_STATUS_VALUES)}"
        )

    if approval_status != TemplateApprovalStatus.REJECTED:
        rejection_reason = ""

    cleaned = {
        "event_code": event_code,
        "template_key": template_key,
        "template_name": template_name,
        "language_code": language_code or "ar",
        "message_type": message_type,
        "header_text": header_text,
        "body_text": body_text,
        "footer_text": footer_text,
        "button_text": button_text,
        "button_url": button_url,
        "meta_template_name": meta_template_name,
        "meta_template_namespace": meta_template_namespace,
        "approval_status": approval_status,
        "provider_status": provider_status,
        "rejection_reason": rejection_reason,
        "is_default": is_default,
        "is_active": is_active,
    }

    return cleaned, errors


# ============================================================
# 🔧 Business Helpers
# ============================================================

def _ensure_unique_default(template: WhatsAppTemplate):
    """
    إذا تم تعليم قالب كافتراضي، نلغي الافتراضي عن بقية القوالب
    لنفس الحدث واللغة ضمن نفس النطاق.
    """
    if not template.is_default:
        return

    WhatsAppTemplate.objects.filter(
        scope_type=template.scope_type,
        company_reference=_clean_str(_get_model_attr(template, "company_reference", "")),
        event_code=template.event_code,
        language_code=template.language_code,
        is_default=True,
    ).exclude(pk=template.pk).update(is_default=False)


def _get_next_version(event_code: str, language_code: str) -> int:
    current = (
        _system_templates_queryset()
        .filter(
            event_code=event_code,
            language_code=language_code,
        )
        .aggregate(max_version=Max("version"))
    ).get("max_version") or 0

    return current + 1


def _find_duplicate_template(
    *,
    event_code: str,
    template_key: str,
    language_code: str,
    exclude_pk=None,
):
    qs = _system_templates_queryset().filter(
        event_code=event_code,
        template_key=template_key,
        language_code=language_code,
    )

    if exclude_pk is not None:
        qs = qs.exclude(pk=exclude_pk)

    return qs


def _get_system_template_or_404(template_id: int):
    return get_object_or_404(
        WhatsAppTemplate,
        pk=template_id,
        scope_type=ScopeType.SYSTEM,
        company_reference=SYSTEM_COMPANY_REFERENCE,
    )


# ============================================================
# 📋 List Templates
# ============================================================

@login_required
@require_GET
def system_whatsapp_templates(request):
    """
    إرجاع قوالب واتساب الخاصة بالنظام فقط.

    يدعم:
    - q               : بحث عام
    - status          : approval_status
    - provider_status : provider_status
    - language_code   : language
    - event_code      : event code
    - is_active       : true/false
    """
    q = _clean_str(request.GET.get("q"))
    status = _clean_str(request.GET.get("status")).upper()
    provider_status = _clean_str(request.GET.get("provider_status")).upper()
    language_code = _clean_str(request.GET.get("language_code")).lower()
    event_code = _clean_str(request.GET.get("event_code"))
    is_active = _clean_str(request.GET.get("is_active")).lower()

    templates = _system_templates_queryset()

    if status and status != "ALL":
        templates = templates.filter(approval_status=status)

    if provider_status and provider_status != "ALL":
        templates = templates.filter(provider_status=provider_status)

    if language_code:
        templates = templates.filter(language_code=language_code)

    if event_code:
        templates = templates.filter(event_code=event_code)

    if is_active in {"true", "false", "1", "0"}:
        templates = templates.filter(is_active=is_active in {"true", "1"})

    if q:
        templates = templates.filter(
            Q(event_code__icontains=q)
            | Q(template_key__icontains=q)
            | Q(template_name__icontains=q)
            | Q(language_code__icontains=q)
            | Q(message_type__icontains=q)
            | Q(body_text__icontains=q)
            | Q(header_text__icontains=q)
            | Q(footer_text__icontains=q)
            | Q(company_reference__icontains=q)
            | Q(company_name__icontains=q)
        )

    templates = templates.order_by("event_code", "-version", "-id")
    results = [_serialize_template(item) for item in templates]

    return json_ok(
        "System WhatsApp templates loaded successfully",
        data=results,
        results=results,
        count=len(results),
        filters={
            "q": q,
            "status": status,
            "provider_status": provider_status,
            "language_code": language_code,
            "event_code": event_code,
            "is_active": is_active,
        },
    )


# ============================================================
# ➕ Create Template
# ============================================================

@login_required
@require_POST
def system_whatsapp_template_create(request):
    try:
        payload = _parse_json_body(request)
    except ValueError as exc:
        return _json_error(str(exc), status=400)

    cleaned, errors = _validate_template_payload(payload, is_update=False)
    if errors:
        return _json_error("Validation error.", status=400, errors=errors)

    existing = _find_duplicate_template(
        event_code=cleaned["event_code"],
        template_key=cleaned["template_key"],
        language_code=cleaned["language_code"],
    ).exists()

    if existing:
        return _json_error(
            "A template with the same event_code, template_key, and language_code already exists.",
            status=409,
            errors={
                "template_key": "Duplicate template for the same event and language."
            },
        )

    with transaction.atomic():
        template = WhatsAppTemplate.objects.create(
            scope_type=ScopeType.SYSTEM,
            company_reference=SYSTEM_COMPANY_REFERENCE,
            company_name=SYSTEM_COMPANY_NAME,
            event_code=cleaned["event_code"],
            template_key=cleaned["template_key"],
            template_name=cleaned["template_name"],
            language_code=cleaned["language_code"],
            message_type=cleaned["message_type"],
            header_text=cleaned["header_text"],
            body_text=cleaned["body_text"],
            footer_text=cleaned["footer_text"],
            button_text=cleaned["button_text"],
            button_url=cleaned["button_url"],
            meta_template_name=cleaned["meta_template_name"],
            meta_template_namespace=cleaned["meta_template_namespace"],
            approval_status=cleaned["approval_status"],
            provider_status=cleaned["provider_status"],
            rejection_reason=cleaned["rejection_reason"],
            is_default=cleaned["is_default"],
            is_active=cleaned["is_active"],
            version=_get_next_version(
                event_code=cleaned["event_code"],
                language_code=cleaned["language_code"],
            ),
            created_by=request.user,
            updated_by=request.user,
        )

        _ensure_unique_default(template)

    return json_ok(
        "System WhatsApp template created successfully.",
        item=_serialize_template(template),
        data=_serialize_template(template),
    )


# ============================================================
# ✏️ Update Template
# ============================================================

@login_required
@require_POST
def system_whatsapp_template_update(request, template_id: int):
    template = _get_system_template_or_404(template_id)

    try:
        payload = _parse_json_body(request)
    except ValueError as exc:
        return _json_error(str(exc), status=400)

    cleaned, errors = _validate_template_payload(payload, is_update=True)
    if errors:
        return _json_error("Validation error.", status=400, errors=errors)

    with transaction.atomic():
        next_event_code = (
            cleaned["event_code"]
            if "event_code" in payload
            else template.event_code
        )
        next_template_key = (
            cleaned["template_key"]
            if "template_key" in payload
            else template.template_key
        )
        next_language_code = (
            cleaned["language_code"]
            if "language_code" in payload
            else template.language_code
        )

        duplicate_qs = _find_duplicate_template(
            event_code=next_event_code,
            template_key=next_template_key,
            language_code=next_language_code,
            exclude_pk=template.pk,
        )

        if duplicate_qs.exists():
            return _json_error(
                "A template with the same event_code, template_key, and language_code already exists.",
                status=409,
                errors={
                    "template_key": "Duplicate template for the same event and language."
                },
            )

        if "event_code" in payload:
            template.event_code = cleaned["event_code"]

        if "template_key" in payload:
            template.template_key = cleaned["template_key"]

        if "template_name" in payload:
            template.template_name = cleaned["template_name"]

        if "language_code" in payload:
            template.language_code = cleaned["language_code"]

        if "message_type" in payload:
            template.message_type = cleaned["message_type"]

        if "header_text" in payload:
            template.header_text = cleaned["header_text"]

        if "body_text" in payload:
            template.body_text = cleaned["body_text"]

        if "footer_text" in payload:
            template.footer_text = cleaned["footer_text"]

        if "button_text" in payload:
            template.button_text = cleaned["button_text"]

        if "button_url" in payload:
            template.button_url = cleaned["button_url"]

        if "meta_template_name" in payload:
            template.meta_template_name = cleaned["meta_template_name"]

        if "meta_template_namespace" in payload:
            template.meta_template_namespace = cleaned["meta_template_namespace"]

        if "approval_status" in payload:
            template.approval_status = cleaned["approval_status"]

        if "provider_status" in payload:
            template.provider_status = cleaned["provider_status"]

        if (
            "rejection_reason" in payload
            or cleaned["approval_status"] != TemplateApprovalStatus.REJECTED
        ):
            template.rejection_reason = cleaned["rejection_reason"]

        if "is_default" in payload:
            template.is_default = cleaned["is_default"]

        if "is_active" in payload:
            template.is_active = cleaned["is_active"]

        template.scope_type = ScopeType.SYSTEM
        template.company_reference = SYSTEM_COMPANY_REFERENCE
        template.company_name = SYSTEM_COMPANY_NAME
        template.updated_by = request.user
        template.save()

        _ensure_unique_default(template)

    return json_ok(
        "System WhatsApp template updated successfully.",
        item=_serialize_template(template),
        data=_serialize_template(template),
    )


# ============================================================
# 🔁 Toggle Template Active Status
# ============================================================

@login_required
@require_POST
def system_whatsapp_template_toggle(request, template_id: int):
    template = _get_system_template_or_404(template_id)

    template.is_active = not template.is_active
    template.updated_by = request.user
    template.save(update_fields=["is_active", "updated_by", "updated_at"])

    return json_ok(
        "System WhatsApp template status updated successfully.",
        item=_serialize_template(template),
        data=_serialize_template(template),
    )


# ============================================================
# 🗑 Delete Template
# ============================================================

@login_required
@require_POST
def system_whatsapp_template_delete(request, template_id: int):
    template = _get_system_template_or_404(template_id)

    template_data = _serialize_template(template)
    template.delete()

    return json_ok(
        "System WhatsApp template deleted successfully.",
        item=template_data,
        data=template_data,
    )