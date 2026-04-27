# ============================================================
# 📂 whatsapp_center/services.py
# 🧠 Primey Care - WhatsApp Services V1 Core
# ------------------------------------------------------------
# ✅ نسخة Core نظيفة مناسبة لـ Primey Care
# ✅ تدعم:
#    - Session Management
#    - Core Message Sending
#    - Retry Failed Messages
#    - System / Company Template Seeding
#    - Notification Center Bridge
# ✅ متوافقة مع:
#    - whatsapp_center/models.py V1 Core
#    - whatsapp_center/selectors.py V1 Core
# ✅ بدون Company FK مباشر
# ✅ بدون HR domain helpers في النسخة الأساسية
# ============================================================

from __future__ import annotations

import logging
from dataclasses import asdict
from typing import Any

from django.db import transaction
from django.utils import timezone

from .client import WhatsAppClient, WhatsAppSessionResult
from .models import (
    DeliveryStatus,
    MessageType,
    ScopeType,
    TemplateApprovalStatus,
    TemplateProviderSyncStatus,
    TriggerSource,
    WhatsAppMessageAttempt,
    WhatsAppMessageLog,
    WhatsAppTemplate,
)
from .selectors import (
    get_active_company_whatsapp_config,
    get_active_system_whatsapp_config,
    get_whatsapp_template,
)
from .template_builder import build_message_from_template
from .utils import normalize_phone_number, safe_text

logger = logging.getLogger(__name__)


# ============================================================
# 🔧 Internal Helpers
# ============================================================

def _safe_getattr(obj, attr_name: str, default=None):
    try:
        return getattr(obj, attr_name, default)
    except Exception:
        return default


def _stringify(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _resolve_company_reference(company=None, company_reference: str | None = None) -> str:
    if company_reference:
        return _stringify(company_reference)

    if not company:
        return ""

    for attr_name in ["company_reference", "reference", "code", "pk", "id"]:
        value = _safe_getattr(company, attr_name, None)
        if value not in [None, ""]:
            return _stringify(value)

    return ""


def _resolve_company_name(company=None, context: dict | None = None) -> str:
    if company:
        for attr_name in ["company_name", "name", "title"]:
            value = _stringify(_safe_getattr(company, attr_name, ""))
            if value:
                return value

    if isinstance(context, dict):
        for key in ["company_name", "company_title"]:
            value = _stringify(context.get(key))
            if value:
                return value

    return ""


def _build_client_from_config(config) -> WhatsAppClient:
    return WhatsAppClient(
        provider=getattr(config, "provider", "") or "",
        access_token=getattr(config, "access_token", "") or "",
        phone_number_id=getattr(config, "phone_number_id", "") or "",
        api_version=getattr(config, "api_version", "v22.0"),
        session_name=getattr(config, "session_name", "") or "primey-system-session",
    )


def _get_scope_config(
    scope_type: str,
    *,
    company=None,
    company_reference: str | None = None,
):
    """
    جلب WhatsApp config حسب الـ scope مع fallback آمن:
    - في V1 Core لا يوجد CompanyWhatsAppConfig فعلي
    - لذلك أي COMPANY scope سيعمل fallback إلى System config
    """
    if scope_type == ScopeType.COMPANY:
        company_config = None

        try:
            company_config = get_active_company_whatsapp_config(
                company=company,
                company_reference=company_reference,
            )
        except Exception:
            logger.exception(
                "Failed while resolving company WhatsApp config | company_reference=%s",
                _resolve_company_reference(company=company, company_reference=company_reference),
            )
            company_config = None

        if company_config:
            return company_config

        system_config = None
        try:
            system_config = get_active_system_whatsapp_config()
        except Exception:
            logger.exception("Failed while resolving fallback system WhatsApp config")
            system_config = None

        if system_config:
            logger.info(
                "WhatsApp config fallback applied | requested_scope=COMPANY | company_reference=%s | fallback_scope=SYSTEM | system_config_id=%s",
                _resolve_company_reference(company=company, company_reference=company_reference),
                getattr(system_config, "id", None),
            )
            return system_config

        return None

    try:
        return get_active_system_whatsapp_config()
    except Exception:
        logger.exception("Failed while resolving system WhatsApp config")
        return None


def _build_fallback_body(*, event_code: str, context: dict) -> str:
    explicit_message = safe_text(context.get("message"))
    if explicit_message:
        return explicit_message

    recipient_name = safe_text(context.get("recipient_name")) or "User"
    company_name = safe_text(context.get("company_name"))

    if event_code == "system_test_message":
        return explicit_message or "This is a system WhatsApp test message from Primey Care."

    if event_code == "company_created":
        if company_name:
            return f"Welcome to Primey Care. Your company '{company_name}' has been created successfully."
        return "Welcome to Primey Care. Your company has been created successfully."

    if event_code == "payment_details_sent":
        return (
            f"Payment details have been sent for {company_name or 'your account'}.\n"
            f"Invoice Number: {safe_text(context.get('invoice_number'))}\n"
            f"Amount: {safe_text(context.get('amount'))}\n"
            f"Link: {safe_text(context.get('payment_url'))}"
        )

    if event_code == "subscription_plan_upgrade_created":
        return (
            f"Upgrade request created for {company_name or 'your account'}.\n"
            f"Current Plan: {safe_text(context.get('current_plan_name'))}\n"
            f"New Plan: {safe_text(context.get('new_plan_name'))}\n"
            f"Invoice Number: {safe_text(context.get('invoice_number'))}\n"
            f"Amount: {safe_text(context.get('amount'))}"
        )

    if event_code == "subscription_plan_downgrade_requested":
        return (
            f"Downgrade request received for {company_name or 'your account'}.\n"
            f"Current Plan: {safe_text(context.get('current_plan_name'))}\n"
            f"Requested Plan: {safe_text(context.get('new_plan_name'))}"
        )

    if event_code == "subscription_renewal_invoice_created":
        return (
            f"Renewal invoice created for {company_name or 'your account'}.\n"
            f"Plan: {safe_text(context.get('plan_name'))}\n"
            f"Duration: {safe_text(context.get('duration'))}\n"
            f"Invoice Number: {safe_text(context.get('invoice_number'))}\n"
            f"Amount: {safe_text(context.get('amount'))}"
        )

    if event_code == "payment_confirmed_company_activated":
        return (
            f"Payment confirmed and company activated for {company_name or 'your account'}.\n"
            f"Invoice Number: {safe_text(context.get('invoice_number'))}\n"
            f"Plan: {safe_text(context.get('plan_name'))}\n"
            f"Amount: {safe_text(context.get('amount'))}\n"
            f"Payment Method: {safe_text(context.get('payment_method'))}"
        )

    if event_code == "cash_payment_confirmed":
        return (
            f"Cash payment confirmed for {company_name or 'your account'}.\n"
            f"Invoice Number: {safe_text(context.get('invoice_number'))}\n"
            f"Plan: {safe_text(context.get('plan_name'))}\n"
            f"Amount: {safe_text(context.get('amount'))}"
        )

    if event_code == "invoice_payment_details":
        return (
            f"Invoice details for {company_name or 'your account'}.\n"
            f"Invoice Number: {safe_text(context.get('invoice_number'))}\n"
            f"Amount: {safe_text(context.get('amount'))}\n"
            f"Status: {safe_text(context.get('payment_status'))}"
        )

    if event_code == "invoice_pdf_sent":
        return (
            f"Invoice PDF sent for {company_name or 'your account'}.\n"
            f"Invoice Number: {safe_text(context.get('invoice_number'))}\n"
            f"Amount: {safe_text(context.get('amount'))}"
        )

    if event_code == "subscription_expiring_7_days":
        days_left = context.get("days_left")
        if company_name and days_left:
            return f"Reminder: subscription for {company_name} expires in {days_left} days."
        return "Reminder: your subscription is expiring soon."

    if event_code == "system_user_created":
        return (
            f"Welcome {safe_text(context.get('full_name')) or recipient_name}.\n"
            f"Your account has been created successfully.\n"
            f"Username: {safe_text(context.get('username'))}\n"
            f"Email: {safe_text(context.get('email'))}"
        )

    if event_code == "system_user_password_changed":
        return (
            f"Hello {safe_text(context.get('full_name')) or recipient_name}.\n"
            f"Your account password has been changed successfully.\n"
            f"Changed At: {safe_text(context.get('changed_at'))}"
        )

    return f"Primey Care notification for {recipient_name}."


def _set_attr_if_exists(instance, field_name: str, value) -> bool:
    if hasattr(instance, field_name):
        setattr(instance, field_name, value)
        return True
    return False


def _sync_config_session_fields_from_result(config, result: WhatsAppSessionResult) -> None:
    update_fields: list[str] = []

    mapping = {
        "session_status": result.session_status or "disconnected",
        "session_connected_phone": result.connected_phone or "",
        "session_device_label": result.device_label or "",
        "session_qr_code": result.qr_code or "",
        "session_pairing_code": result.pairing_code or "",
        "last_error_message": result.error_message or "",
    }

    for field_name, field_value in mapping.items():
        if _set_attr_if_exists(config, field_name, field_value):
            update_fields.append(field_name)

    if result.connected and result.last_connected_at:
        if _set_attr_if_exists(config, "session_last_connected_at", timezone.now()):
            update_fields.append("session_last_connected_at")

    if _set_attr_if_exists(config, "last_health_check_at", timezone.now()):
        update_fields.append("last_health_check_at")

    if update_fields:
        seen = set()
        unique_fields = []
        for field in update_fields:
            if field not in seen:
                seen.add(field)
                unique_fields.append(field)

        config.save(update_fields=unique_fields)


def _session_result_to_payload(result: WhatsAppSessionResult) -> dict[str, Any]:
    return asdict(result)


def _is_session_not_connected_failure(log: WhatsAppMessageLog) -> bool:
    failure_reason = safe_text(getattr(log, "failure_reason", ""))
    response_json = getattr(log, "response_json", {}) or {}
    payload_json = getattr(log, "payload_json", {}) or {}

    candidates = [
        failure_reason,
        safe_text(getattr(log, "provider_status", "")),
        safe_text(response_json.get("message")),
        safe_text(response_json.get("error")),
        safe_text(payload_json.get("message")),
    ]

    normalized_text = " | ".join([item.lower() for item in candidates if item]).strip()

    session_markers = [
        "whatsapp session is not connected",
        "session is not connected",
        "not connected",
        "gateway_failed",
    ]

    return any(marker in normalized_text for marker in session_markers)


# ============================================================
# 🔁 Retry Failed Messages
# ============================================================

def _retry_existing_whatsapp_log(log: WhatsAppMessageLog):
    if not log:
        return None

    scope_type = getattr(log, "scope_type", "")
    company_reference = _stringify(getattr(log, "company_reference", ""))

    config = _get_scope_config(
        scope_type=scope_type,
        company_reference=company_reference,
    )
    if not config:
        log.delivery_status = DeliveryStatus.FAILED
        log.provider_status = "gateway_failed"
        log.failure_reason = "No active WhatsApp config found during retry"
        log.failed_at = timezone.now()
        log.save(
            update_fields=[
                "delivery_status",
                "provider_status",
                "failure_reason",
                "failed_at",
                "updated_at",
            ]
        )
        return log

    recipient_phone = normalize_phone_number(getattr(log, "recipient_phone", ""))
    if not recipient_phone:
        log.delivery_status = DeliveryStatus.FAILED
        log.provider_status = "validation_failed"
        log.failure_reason = "Invalid or missing recipient phone number during retry"
        log.failed_at = timezone.now()
        log.save(
            update_fields=[
                "delivery_status",
                "provider_status",
                "failure_reason",
                "failed_at",
                "updated_at",
            ]
        )
        return log

    client = _build_client_from_config(config)

    last_attempt_number = (
        WhatsAppMessageAttempt.objects
        .filter(message_log=log)
        .order_by("-attempt_number")
        .values_list("attempt_number", flat=True)
        .first()
        or 0
    )

    log.delivery_status = DeliveryStatus.QUEUED
    log.failure_reason = ""
    log.provider_status = ""
    log.save(
        update_fields=[
            "delivery_status",
            "failure_reason",
            "provider_status",
            "updated_at",
        ]
    )

    attempt = WhatsAppMessageAttempt.objects.create(
        message_log=log,
        attempt_number=last_attempt_number + 1,
        request_payload={
            "recipient_phone": recipient_phone,
            "event_code": getattr(log, "event_code", ""),
            "scope_type": scope_type,
            "company_reference": company_reference,
            "attachment_url": getattr(log, "attachment_url", ""),
            "provider": getattr(config, "provider", ""),
            "session_name": getattr(config, "session_name", ""),
            "retry": True,
        },
    )

    attachment_url = getattr(log, "attachment_url", "") or ""
    attachment_name = getattr(log, "attachment_name", "") or ""

    if attachment_url:
        result = client.send_document_message(
            to_phone=recipient_phone,
            document_url=attachment_url,
            caption=getattr(log, "message_body", "") or "",
            filename=attachment_name,
        )
    else:
        result = client.send_text_message(
            to_phone=recipient_phone,
            body=getattr(log, "message_body", "") or "",
        )

    attempt.response_payload = result.response_data or {}
    attempt.status_code = result.status_code
    attempt.provider_status = result.provider_status
    attempt.is_success = result.success
    attempt.error_message = result.error_message
    attempt.finished_at = timezone.now()
    attempt.save(
        update_fields=[
            "response_payload",
            "status_code",
            "provider_status",
            "is_success",
            "error_message",
            "finished_at",
        ]
    )

    response_data = result.response_data or {}
    if isinstance(response_data, dict) and any(
        key in response_data
        for key in [
            "session_status",
            "connected",
            "connected_phone",
            "device_label",
            "qr_code",
            "pairing_code",
            "last_connected_at",
            "message",
        ]
    ):
        session_result = WhatsAppSessionResult(
            success=bool(response_data.get("success", result.success)),
            status_code=int(response_data.get("status_code", result.status_code or 200)),
            session_status=str(response_data.get("session_status") or "disconnected"),
            connected=bool(response_data.get("connected", False)),
            connected_phone=str(response_data.get("connected_phone") or ""),
            device_label=str(response_data.get("device_label") or ""),
            qr_code=str(response_data.get("qr_code") or ""),
            pairing_code=str(response_data.get("pairing_code") or ""),
            last_connected_at=str(response_data.get("last_connected_at") or ""),
            response_data=response_data,
            error_message=str(response_data.get("message") or result.error_message or ""),
        )
        _sync_config_session_fields_from_result(config, session_result)

    if result.success:
        log.delivery_status = DeliveryStatus.SENT
        log.provider_status = result.provider_status
        log.external_message_id = result.external_message_id
        log.response_json = result.response_data or {}
        log.failure_reason = ""
        log.sent_at = timezone.now()
        log.failed_at = None
        log.save(
            update_fields=[
                "delivery_status",
                "provider_status",
                "external_message_id",
                "response_json",
                "failure_reason",
                "sent_at",
                "failed_at",
                "updated_at",
            ]
        )
    else:
        log.delivery_status = DeliveryStatus.FAILED
        log.provider_status = result.provider_status
        log.failure_reason = result.error_message
        log.response_json = result.response_data or {}
        log.failed_at = timezone.now()
        log.save(
            update_fields=[
                "delivery_status",
                "provider_status",
                "failure_reason",
                "response_json",
                "failed_at",
                "updated_at",
            ]
        )

    return log


@transaction.atomic
def retry_failed_whatsapp_messages_for_scope(
    *,
    scope_type: str,
    company=None,
    company_reference: str | None = None,
    limit: int = 100,
) -> dict[str, Any]:
    resolved_company_reference = _resolve_company_reference(
        company=company,
        company_reference=company_reference,
    )

    logs_qs = (
        WhatsAppMessageLog.objects
        .select_related("template")
        .filter(
            scope_type=scope_type,
            delivery_status=DeliveryStatus.FAILED,
        )
        .order_by("created_at")
    )

    if scope_type == ScopeType.COMPANY:
        logs_qs = logs_qs.filter(company_reference=resolved_company_reference)
    else:
        logs_qs = logs_qs.filter(company_reference="")

    retried = 0
    sent = 0
    failed_again = 0
    skipped = 0

    for log in logs_qs[:limit]:
        if not _is_session_not_connected_failure(log):
            skipped += 1
            continue

        retried += 1
        updated_log = _retry_existing_whatsapp_log(log)

        if updated_log and getattr(updated_log, "delivery_status", "") == DeliveryStatus.SENT:
            sent += 1
        else:
            failed_again += 1

    return {
        "success": True,
        "retried": retried,
        "sent": sent,
        "failed_again": failed_again,
        "skipped": skipped,
        "scope_type": scope_type,
        "company_reference": resolved_company_reference,
    }


def _auto_retry_failed_messages_after_reconnect(
    *,
    scope_type: str,
    company=None,
    company_reference: str | None = None,
    connected: bool,
) -> dict[str, Any]:
    if not connected:
        return {
            "success": True,
            "retried": 0,
            "sent": 0,
            "failed_again": 0,
            "skipped": 0,
            "auto_retry_triggered": False,
        }

    retry_result = retry_failed_whatsapp_messages_for_scope(
        scope_type=scope_type,
        company=company,
        company_reference=company_reference,
        limit=100,
    )
    retry_result["auto_retry_triggered"] = True
    return retry_result


# ============================================================
# 🧩 Template Seed Helpers
# ============================================================

def _build_seed_defaults(seed: dict[str, Any]) -> dict[str, Any]:
    return {
        "template_key": seed["template_key"],
        "template_name": seed["template_name"],
        "message_type": seed.get("message_type", MessageType.TEXT),
        "header_text": seed.get("header_text", ""),
        "body_text": seed["body_text"],
        "footer_text": seed.get("footer_text", ""),
        "button_text": seed.get("button_text", ""),
        "button_url": seed.get("button_url", ""),
        "meta_template_name": seed.get("meta_template_name", ""),
        "meta_template_namespace": seed.get("meta_template_namespace", ""),
        "approval_status": seed.get("approval_status", TemplateApprovalStatus.DRAFT),
        "provider_status": seed.get("provider_status", TemplateProviderSyncStatus.NOT_SYNCED),
        "rejection_reason": seed.get("rejection_reason", ""),
        "is_default": seed.get("is_default", True),
        "is_active": seed.get("is_active", True),
        "company_name": seed.get("company_name", ""),
    }


def _system_template_seed_rows() -> list[dict[str, Any]]:
    return [
        {
            "event_code": "system_test_message",
            "template_key": "system_test_message_ar",
            "template_name": "رسالة اختبار النظام",
            "language_code": "ar",
            "message_type": MessageType.TEXT,
            "body_text": "هذه رسالة اختبار واتساب من Primey Care.",
            "approval_status": TemplateApprovalStatus.APPROVED,
            "provider_status": TemplateProviderSyncStatus.NOT_SYNCED,
            "is_default": True,
            "is_active": True,
        },
        {
            "event_code": "system_test_message",
            "template_key": "system_test_message_en",
            "template_name": "System Test Message",
            "language_code": "en",
            "message_type": MessageType.TEXT,
            "body_text": "This is a WhatsApp test message from Primey Care.",
            "approval_status": TemplateApprovalStatus.APPROVED,
            "provider_status": TemplateProviderSyncStatus.NOT_SYNCED,
            "is_default": False,
            "is_active": True,
        },
        {
            "event_code": "company_created",
            "template_key": "system_company_created_ar",
            "template_name": "إنشاء شركة جديدة",
            "language_code": "ar",
            "message_type": MessageType.TEXT,
            "body_text": (
                "مرحبًا {{company_name}}،\n"
                "تم إنشاء شركتكم بنجاح في Primey Care.\n"
                "الباقة: {{plan_name}}\n"
                "تاريخ البداية: {{start_date}}\n"
                "تاريخ النهاية: {{end_date}}\n"
                "رابط الدخول:\n"
                "{{login_url}}"
            ),
            "approval_status": TemplateApprovalStatus.APPROVED,
            "provider_status": TemplateProviderSyncStatus.NOT_SYNCED,
            "is_default": True,
            "is_active": True,
        },
        {
            "event_code": "company_created",
            "template_key": "system_company_created_en",
            "template_name": "Company Created Welcome",
            "language_code": "en",
            "message_type": MessageType.TEXT,
            "body_text": (
                "Hello {{company_name}},\n"
                "Your company has been created successfully in Primey Care.\n"
                "Plan: {{plan_name}}\n"
                "Start Date: {{start_date}}\n"
                "End Date: {{end_date}}\n"
                "Login URL:\n"
                "{{login_url}}"
            ),
            "approval_status": TemplateApprovalStatus.APPROVED,
            "provider_status": TemplateProviderSyncStatus.NOT_SYNCED,
            "is_default": False,
            "is_active": True,
        },
        {
            "event_code": "payment_details_sent",
            "template_key": "system_payment_details_sent_ar",
            "template_name": "إرسال بيانات الدفع",
            "language_code": "ar",
            "message_type": MessageType.TEXT,
            "body_text": (
                "مرحبًا {{company_name}}،\n"
                "تم إرسال بيانات الدفع.\n"
                "رقم الفاتورة: {{invoice_number}}\n"
                "المبلغ: {{amount}}\n"
                "الرابط: {{payment_url}}"
            ),
            "approval_status": TemplateApprovalStatus.APPROVED,
            "provider_status": TemplateProviderSyncStatus.NOT_SYNCED,
            "is_default": True,
            "is_active": True,
        },
        {
            "event_code": "payment_details_sent",
            "template_key": "system_payment_details_sent_en",
            "template_name": "Payment Details Sent",
            "language_code": "en",
            "message_type": MessageType.TEXT,
            "body_text": (
                "Hello {{company_name}},\n"
                "Payment details have been sent.\n"
                "Invoice Number: {{invoice_number}}\n"
                "Amount: {{amount}}\n"
                "Payment Link: {{payment_url}}"
            ),
            "approval_status": TemplateApprovalStatus.APPROVED,
            "provider_status": TemplateProviderSyncStatus.NOT_SYNCED,
            "is_default": False,
            "is_active": True,
        },
        {
            "event_code": "subscription_expiring_7_days",
            "template_key": "system_subscription_expiring_7_days_ar",
            "template_name": "تنبيه قرب انتهاء الاشتراك",
            "language_code": "ar",
            "message_type": MessageType.TEXT,
            "body_text": (
                "مرحبًا {{company_name}}،\n"
                "اشتراككم الحالي سينتهي خلال {{days_left}} أيام.\n"
                "الباقة: {{plan_name}}\n"
                "تاريخ الانتهاء: {{end_date}}\n"
                "رابط التجديد:\n"
                "{{renewal_url}}"
            ),
            "approval_status": TemplateApprovalStatus.APPROVED,
            "provider_status": TemplateProviderSyncStatus.NOT_SYNCED,
            "is_default": True,
            "is_active": True,
        },
        {
            "event_code": "subscription_expiring_7_days",
            "template_key": "system_subscription_expiring_7_days_en",
            "template_name": "Subscription Expiring in 7 Days",
            "language_code": "en",
            "message_type": MessageType.TEXT,
            "body_text": (
                "Hello {{company_name}},\n"
                "Your current subscription will expire in {{days_left}} days.\n"
                "Plan: {{plan_name}}\n"
                "Expiry Date: {{end_date}}\n"
                "Renewal URL:\n"
                "{{renewal_url}}"
            ),
            "approval_status": TemplateApprovalStatus.APPROVED,
            "provider_status": TemplateProviderSyncStatus.NOT_SYNCED,
            "is_default": False,
            "is_active": True,
        },
        {
            "event_code": "system_user_created",
            "template_key": "system_user_created_ar",
            "template_name": "إنشاء مستخدم جديد",
            "language_code": "ar",
            "message_type": MessageType.TEXT,
            "body_text": (
                "مرحبًا {{full_name}}،\n"
                "تم إنشاء حسابك بنجاح.\n"
                "اسم المستخدم: {{username}}\n"
                "البريد الإلكتروني: {{email}}\n"
                "رابط الدخول:\n"
                "{{login_url}}"
            ),
            "approval_status": TemplateApprovalStatus.APPROVED,
            "provider_status": TemplateProviderSyncStatus.NOT_SYNCED,
            "is_default": True,
            "is_active": True,
        },
        {
            "event_code": "system_user_created",
            "template_key": "system_user_created_en",
            "template_name": "User Created Welcome",
            "language_code": "en",
            "message_type": MessageType.TEXT,
            "body_text": (
                "Hello {{full_name}},\n"
                "Your account has been created successfully.\n"
                "Username: {{username}}\n"
                "Email: {{email}}\n"
                "Login URL:\n"
                "{{login_url}}"
            ),
            "approval_status": TemplateApprovalStatus.APPROVED,
            "provider_status": TemplateProviderSyncStatus.NOT_SYNCED,
            "is_default": False,
            "is_active": True,
        },
        {
            "event_code": "system_user_password_changed",
            "template_key": "system_user_password_changed_ar",
            "template_name": "تغيير كلمة المرور",
            "language_code": "ar",
            "message_type": MessageType.TEXT,
            "body_text": (
                "مرحبًا {{full_name}}،\n"
                "تم تغيير كلمة المرور الخاصة بحسابك بنجاح.\n"
                "وقت التغيير: {{changed_at}}"
            ),
            "approval_status": TemplateApprovalStatus.APPROVED,
            "provider_status": TemplateProviderSyncStatus.NOT_SYNCED,
            "is_default": True,
            "is_active": True,
        },
        {
            "event_code": "system_user_password_changed",
            "template_key": "system_user_password_changed_en",
            "template_name": "Password Changed Notification",
            "language_code": "en",
            "message_type": MessageType.TEXT,
            "body_text": (
                "Hello {{full_name}},\n"
                "Your account password has been changed successfully.\n"
                "Changed At: {{changed_at}}"
            ),
            "approval_status": TemplateApprovalStatus.APPROVED,
            "provider_status": TemplateProviderSyncStatus.NOT_SYNCED,
            "is_default": False,
            "is_active": True,
        },
    ]


def _company_template_seed_rows() -> list[dict[str, Any]]:
    return [
        {
            "event_code": "company_created",
            "language_code": "ar",
            "template_name": "إنشاء شركة جديدة",
            "template_key": "company_created",
            "body_text": (
                "مرحبًا {{company_name}}،\n"
                "تم إنشاء شركتكم بنجاح في Primey Care.\n"
                "تفاصيل الاشتراك:\n"
                "- الباقة: {{plan_name}}\n"
                "- تاريخ البداية: {{start_date}}\n"
                "- تاريخ النهاية: {{end_date}}\n"
                "رابط الدخول:\n"
                "{{login_url}}"
            ),
            "footer_text": "Primey Care",
        },
        {
            "event_code": "company_created",
            "language_code": "en",
            "template_name": "Company Created Welcome",
            "template_key": "company_created",
            "body_text": (
                "Hello {{company_name}},\n"
                "Your company has been created successfully in Primey Care.\n"
                "Subscription details:\n"
                "- Plan: {{plan_name}}\n"
                "- Start Date: {{start_date}}\n"
                "- End Date: {{end_date}}\n"
                "Login URL:\n"
                "{{login_url}}"
            ),
            "footer_text": "Primey Care",
        },
        {
            "event_code": "payment_details_sent",
            "language_code": "ar",
            "template_name": "إرسال بيانات الدفع",
            "template_key": "payment_details_sent",
            "body_text": (
                "مرحبًا {{company_name}}،\n"
                "تم إرسال بيانات الدفع الخاصة باشتراككم.\n"
                "رقم الفاتورة: {{invoice_number}}\n"
                "المبلغ: {{amount}}\n"
                "الرابط: {{payment_url}}"
            ),
            "footer_text": "Primey Care",
        },
        {
            "event_code": "payment_details_sent",
            "language_code": "en",
            "template_name": "Payment Details Sent",
            "template_key": "payment_details_sent",
            "body_text": (
                "Hello {{company_name}},\n"
                "Your payment details have been sent.\n"
                "Invoice Number: {{invoice_number}}\n"
                "Amount: {{amount}}\n"
                "Payment Link: {{payment_url}}"
            ),
            "footer_text": "Primey Care",
        },
    ]


def _create_or_get_seed_template(
    *,
    scope_type: str,
    company=None,
    company_reference: str | None = None,
    company_name: str | None = None,
    seed: dict[str, Any],
    user=None,
):
    resolved_company_reference = ""
    if scope_type == ScopeType.COMPANY:
        resolved_company_reference = _resolve_company_reference(
            company=company,
            company_reference=company_reference,
        )

    item, created = WhatsAppTemplate.objects.get_or_create(
        scope_type=scope_type,
        company_reference=resolved_company_reference,
        event_code=seed["event_code"],
        language_code=seed["language_code"],
        version=1,
        defaults={
            **_build_seed_defaults(seed),
            "company_reference": resolved_company_reference,
            "company_name": company_name or seed.get("company_name", "") or "",
        },
    )

    if created and user and getattr(user, "is_authenticated", False):
        update_fields: list[str] = []

        if hasattr(item, "created_by"):
            item.created_by = user
            update_fields.append("created_by")

        if hasattr(item, "updated_by"):
            item.updated_by = user
            update_fields.append("updated_by")

        if update_fields:
            item.save(update_fields=update_fields)

    return item, created


# ============================================================
# 🖥 System Default Template Bootstrap
# ============================================================

@transaction.atomic
def ensure_system_default_whatsapp_templates(user=None) -> dict[str, Any]:
    existing_system_count = WhatsAppTemplate.objects.filter(
        scope_type=ScopeType.SYSTEM,
        company_reference="",
    ).count()

    if existing_system_count > 0:
        return {
            "created": 0,
            "existing": existing_system_count,
            "total_system_templates": existing_system_count,
        }

    created_count = 0

    for seed in _system_template_seed_rows():
        _, created = _create_or_get_seed_template(
            scope_type=ScopeType.SYSTEM,
            company=None,
            company_reference="",
            company_name="",
            seed=seed,
            user=user,
        )
        if created:
            created_count += 1

    total_system_templates = WhatsAppTemplate.objects.filter(
        scope_type=ScopeType.SYSTEM,
        company_reference="",
    ).count()

    return {
        "created": created_count,
        "existing": total_system_templates - created_count,
        "total_system_templates": total_system_templates,
    }


# ============================================================
# 🏢 Company Default Template Bootstrap
# ============================================================

@transaction.atomic
def ensure_company_default_whatsapp_templates(
    company=None,
    *,
    company_reference: str | None = None,
    company_name: str | None = None,
    user=None,
) -> dict[str, Any]:
    resolved_company_reference = _resolve_company_reference(
        company=company,
        company_reference=company_reference,
    )
    resolved_company_name = _resolve_company_name(company=company, context={"company_name": company_name or ""})

    if not resolved_company_reference:
        return {
            "created": 0,
            "existing": 0,
            "total_company_templates": 0,
        }

    created_count = 0
    existing_count = 0

    for seed in _company_template_seed_rows():
        _, created = _create_or_get_seed_template(
            scope_type=ScopeType.COMPANY,
            company=company,
            company_reference=resolved_company_reference,
            company_name=resolved_company_name,
            seed=seed,
            user=user,
        )
        if created:
            created_count += 1
        else:
            existing_count += 1

    total_company_templates = WhatsAppTemplate.objects.filter(
        scope_type=ScopeType.COMPANY,
        company_reference=resolved_company_reference,
    ).count()

    return {
        "created": created_count,
        "existing": existing_count,
        "total_company_templates": total_company_templates,
    }


# ============================================================
# 📡 Session Services
# ============================================================

@transaction.atomic
def get_whatsapp_session_status(
    *,
    scope_type: str,
    company=None,
    company_reference: str | None = None,
) -> dict[str, Any]:
    resolved_company_reference = _resolve_company_reference(
        company=company,
        company_reference=company_reference,
    )

    config = _get_scope_config(
        scope_type=scope_type,
        company=company,
        company_reference=resolved_company_reference,
    )

    if not config:
        return {
            "success": False,
            "message": "No active WhatsApp config found",
            "session_status": "failed",
            "connected": False,
        }

    client = _build_client_from_config(config)
    result = client.get_session_status()

    _sync_config_session_fields_from_result(config, result)

    payload = _session_result_to_payload(result)
    payload["session_name"] = getattr(config, "session_name", "") or "primey-system-session"
    payload["provider"] = getattr(config, "provider", "") or ""
    payload["company_reference"] = resolved_company_reference

    retry_result = _auto_retry_failed_messages_after_reconnect(
        scope_type=scope_type,
        company=company,
        company_reference=resolved_company_reference,
        connected=bool(result.connected),
    )
    payload["retry_result"] = retry_result

    return payload


@transaction.atomic
def create_whatsapp_qr_session(
    *,
    scope_type: str,
    company=None,
    company_reference: str | None = None,
) -> dict[str, Any]:
    resolved_company_reference = _resolve_company_reference(
        company=company,
        company_reference=company_reference,
    )

    config = _get_scope_config(
        scope_type=scope_type,
        company=company,
        company_reference=resolved_company_reference,
    )

    if not config:
        return {
            "success": False,
            "message": "No active WhatsApp config found",
            "session_status": "failed",
            "connected": False,
        }

    client = _build_client_from_config(config)
    result = client.create_qr_session()

    _sync_config_session_fields_from_result(config, result)

    payload = _session_result_to_payload(result)
    payload["session_name"] = getattr(config, "session_name", "") or "primey-system-session"
    payload["provider"] = getattr(config, "provider", "") or ""
    payload["company_reference"] = resolved_company_reference

    retry_result = _auto_retry_failed_messages_after_reconnect(
        scope_type=scope_type,
        company=company,
        company_reference=resolved_company_reference,
        connected=bool(result.connected),
    )
    payload["retry_result"] = retry_result

    return payload


@transaction.atomic
def create_whatsapp_pairing_code_session(
    *,
    scope_type: str,
    phone_number: str,
    company=None,
    company_reference: str | None = None,
) -> dict[str, Any]:
    resolved_company_reference = _resolve_company_reference(
        company=company,
        company_reference=company_reference,
    )

    config = _get_scope_config(
        scope_type=scope_type,
        company=company,
        company_reference=resolved_company_reference,
    )

    if not config:
        return {
            "success": False,
            "message": "No active WhatsApp config found",
            "session_status": "failed",
            "connected": False,
        }

    normalized_phone = normalize_phone_number(phone_number)

    if not normalized_phone:
        return {
            "success": False,
            "message": "phone_number is required",
            "session_status": "failed",
            "connected": False,
        }

    client = _build_client_from_config(config)
    result = client.create_pairing_code_session(phone_number=normalized_phone)

    _sync_config_session_fields_from_result(config, result)

    payload = _session_result_to_payload(result)
    payload["session_name"] = getattr(config, "session_name", "") or "primey-system-session"
    payload["provider"] = getattr(config, "provider", "") or ""
    payload["company_reference"] = resolved_company_reference

    retry_result = _auto_retry_failed_messages_after_reconnect(
        scope_type=scope_type,
        company=company,
        company_reference=resolved_company_reference,
        connected=bool(result.connected),
    )
    payload["retry_result"] = retry_result

    return payload


@transaction.atomic
def disconnect_whatsapp_session(
    *,
    scope_type: str,
    company=None,
    company_reference: str | None = None,
) -> dict[str, Any]:
    resolved_company_reference = _resolve_company_reference(
        company=company,
        company_reference=company_reference,
    )

    config = _get_scope_config(
        scope_type=scope_type,
        company=company,
        company_reference=resolved_company_reference,
    )

    if not config:
        return {
            "success": False,
            "message": "No active WhatsApp config found",
            "session_status": "failed",
            "connected": False,
        }

    client = _build_client_from_config(config)
    result = client.disconnect_session()

    _sync_config_session_fields_from_result(config, result)

    payload = _session_result_to_payload(result)
    payload["session_name"] = getattr(config, "session_name", "") or "primey-system-session"
    payload["provider"] = getattr(config, "provider", "") or ""
    payload["company_reference"] = resolved_company_reference

    return payload


# ============================================================
# 📨 Core Message Sending
# ============================================================

@transaction.atomic
def send_event_whatsapp_message(
    *,
    scope_type: str,
    event_code: str,
    recipient_phone: str,
    recipient_name: str = "",
    recipient_role: str = "",
    trigger_source: str = TriggerSource.SYSTEM,
    company=None,
    company_reference: str | None = None,
    company_name: str | None = None,
    language_code: str = "ar",
    context: dict | None = None,
    related_model: str = "",
    related_object_id: str = "",
    attachment_url: str = "",
    attachment_name: str = "",
    mime_type: str = "",
):
    context = context or {}
    normalized_phone = normalize_phone_number(recipient_phone)

    resolved_company_reference = ""
    resolved_company_name = ""

    if scope_type == ScopeType.COMPANY:
        resolved_company_reference = _resolve_company_reference(
            company=company,
            company_reference=company_reference,
        )
        resolved_company_name = (
            _stringify(company_name)
            or _resolve_company_name(company=company, context=context)
        )

    if not normalized_phone:
        log = WhatsAppMessageLog.objects.create(
            scope_type=scope_type,
            company_reference=resolved_company_reference,
            company_name=resolved_company_name,
            trigger_source=trigger_source,
            event_code=event_code,
            recipient_name=safe_text(recipient_name),
            recipient_phone=safe_text(recipient_phone) or "+0000000000",
            recipient_role=safe_text(recipient_role),
            message_type=MessageType.TEXT,
            language_code=language_code,
            message_body="",
            delivery_status=DeliveryStatus.FAILED,
            failure_reason="Invalid or missing recipient phone number",
            related_model=related_model,
            related_object_id=str(related_object_id or ""),
            payload_json=context,
        )
        return log

    config = _get_scope_config(
        scope_type=scope_type,
        company=company,
        company_reference=resolved_company_reference,
    )

    if not config:
        log = WhatsAppMessageLog.objects.create(
            scope_type=scope_type,
            company_reference=resolved_company_reference,
            company_name=resolved_company_name,
            trigger_source=trigger_source,
            event_code=event_code,
            recipient_name=safe_text(recipient_name),
            recipient_phone=normalized_phone,
            recipient_role=safe_text(recipient_role),
            message_type=MessageType.TEXT,
            language_code=language_code,
            message_body="",
            delivery_status=DeliveryStatus.FAILED,
            failure_reason="No active WhatsApp config found",
            related_model=related_model,
            related_object_id=str(related_object_id or ""),
            payload_json=context,
        )
        return log

    template = get_whatsapp_template(
        scope_type=scope_type,
        company=company,
        company_reference=resolved_company_reference,
        event_code=event_code,
        language_code=language_code,
    )

    built = build_message_from_template(template, context) if template else None
    message_type = MessageType.DOCUMENT if attachment_url else MessageType.TEXT
    if template:
        message_type = template.message_type or message_type

    if built and built.body_text:
        message_body = built.body_text
    else:
        message_body = _build_fallback_body(event_code=event_code, context=context)

    log = WhatsAppMessageLog.objects.create(
        scope_type=scope_type,
        company_reference=resolved_company_reference,
        company_name=resolved_company_name,
        trigger_source=trigger_source,
        event_code=event_code,
        recipient_name=safe_text(recipient_name),
        recipient_phone=normalized_phone,
        recipient_role=safe_text(recipient_role),
        message_type=message_type,
        template=template,
        template_name_snapshot=(template.template_name if template else ""),
        language_code=language_code,
        header_text=(built.header_text if built else ""),
        message_body=message_body,
        footer_text=(built.footer_text if built else ""),
        attachment_url=attachment_url or "",
        attachment_name=attachment_name or "",
        mime_type=mime_type or "",
        delivery_status=DeliveryStatus.QUEUED,
        related_model=related_model,
        related_object_id=str(related_object_id or ""),
        payload_json=context,
    )

    client = _build_client_from_config(config)

    attempt = WhatsAppMessageAttempt.objects.create(
        message_log=log,
        attempt_number=1,
        request_payload={
            "recipient_phone": normalized_phone,
            "event_code": event_code,
            "scope_type": scope_type,
            "company_reference": resolved_company_reference,
            "attachment_url": attachment_url,
            "provider": getattr(config, "provider", ""),
            "session_name": getattr(config, "session_name", ""),
        },
    )

    if attachment_url:
        result = client.send_document_message(
            to_phone=normalized_phone,
            document_url=attachment_url,
            caption=log.message_body,
            filename=attachment_name,
        )
    else:
        result = client.send_text_message(
            to_phone=normalized_phone,
            body=log.message_body,
        )

    attempt.response_payload = result.response_data or {}
    attempt.status_code = result.status_code
    attempt.provider_status = result.provider_status
    attempt.is_success = result.success
    attempt.error_message = result.error_message
    attempt.finished_at = timezone.now()
    attempt.save(
        update_fields=[
            "response_payload",
            "status_code",
            "provider_status",
            "is_success",
            "error_message",
            "finished_at",
        ]
    )

    response_data = result.response_data or {}
    if isinstance(response_data, dict) and any(
        key in response_data
        for key in [
            "session_status",
            "connected",
            "connected_phone",
            "device_label",
            "qr_code",
            "pairing_code",
            "last_connected_at",
            "message",
        ]
    ):
        session_result = WhatsAppSessionResult(
            success=bool(response_data.get("success", result.success)),
            status_code=int(response_data.get("status_code", result.status_code or 200)),
            session_status=str(response_data.get("session_status") or "disconnected"),
            connected=bool(response_data.get("connected", False)),
            connected_phone=str(response_data.get("connected_phone") or ""),
            device_label=str(response_data.get("device_label") or ""),
            qr_code=str(response_data.get("qr_code") or ""),
            pairing_code=str(response_data.get("pairing_code") or ""),
            last_connected_at=str(response_data.get("last_connected_at") or ""),
            response_data=response_data,
            error_message=str(response_data.get("message") or result.error_message or ""),
        )
        _sync_config_session_fields_from_result(config, session_result)

    if result.success:
        log.delivery_status = DeliveryStatus.SENT
        log.provider_status = result.provider_status
        log.external_message_id = result.external_message_id
        log.response_json = result.response_data or {}
        log.sent_at = timezone.now()
        log.failed_at = None
        log.failure_reason = ""
        log.save(
            update_fields=[
                "delivery_status",
                "provider_status",
                "external_message_id",
                "response_json",
                "sent_at",
                "failed_at",
                "failure_reason",
                "updated_at",
            ]
        )
    else:
        log.delivery_status = DeliveryStatus.FAILED
        log.provider_status = result.provider_status
        log.failure_reason = result.error_message
        log.response_json = result.response_data or {}
        log.failed_at = timezone.now()
        log.save(
            update_fields=[
                "delivery_status",
                "provider_status",
                "failure_reason",
                "response_json",
                "failed_at",
                "updated_at",
            ]
        )

    return log


# ============================================================
# 🔗 Notification Center Bridge
# ============================================================

def _infer_scope_type_from_company_reference(company_reference: str | None = None) -> str:
    return ScopeType.COMPANY if _stringify(company_reference) else ScopeType.SYSTEM


def _map_event_group_to_trigger_source(event_group: str | None) -> str:
    normalized = safe_text(event_group).lower()

    if normalized == "billing":
        return TriggerSource.BILLING
    if normalized in {"attendance", "biotime"}:
        return TriggerSource.ATTENDANCE
    if normalized == "leave":
        return TriggerSource.LEAVE
    if normalized == "payroll":
        return TriggerSource.PAYROLL
    if normalized in {"employee", "hr"}:
        return TriggerSource.EMPLOYEE
    if normalized == "company":
        return TriggerSource.COMPANY
    if normalized == "broadcast":
        return TriggerSource.BROADCAST

    return TriggerSource.SYSTEM


def _build_notification_center_context(
    *,
    event=None,
    delivery=None,
    recipient_name: str = "",
    base_context: dict | None = None,
) -> dict[str, Any]:
    context: dict[str, Any] = {}

    if isinstance(base_context, dict):
        context.update(base_context)

    if event:
        event_context = getattr(event, "context", {}) or {}
        if isinstance(event_context, dict):
            context.update(event_context)

        if not context.get("message"):
            context["message"] = safe_text(getattr(event, "message", ""))

        if not context.get("recipient_name"):
            target_user = getattr(event, "target_user", None)
            full_name_callable = getattr(target_user, "get_full_name", None)
            full_name = ""
            if callable(full_name_callable):
                full_name = safe_text(full_name_callable())

            context["recipient_name"] = (
                recipient_name
                or full_name
                or safe_text(getattr(target_user, "username", ""))
            )

        if not context.get("event_code"):
            context["event_code"] = safe_text(getattr(event, "event_code", ""))

        if not context.get("title"):
            context["title"] = safe_text(getattr(event, "title", ""))

        if not context.get("link"):
            context["link"] = safe_text(getattr(event, "link", ""))

    if delivery:
        if not context.get("delivery_id"):
            context["delivery_id"] = getattr(delivery, "id", None)

        if not context.get("subject"):
            context["subject"] = safe_text(getattr(delivery, "subject", ""))

        if not context.get("message"):
            context["message"] = safe_text(getattr(delivery, "rendered_message", ""))

        if not context.get("company_name"):
            context["company_name"] = safe_text(getattr(delivery, "company_name", ""))

    if recipient_name and not context.get("recipient_name"):
        context["recipient_name"] = recipient_name

    return context


@transaction.atomic
def send_notification_center_whatsapp_delivery(
    *,
    delivery,
    recipient_phone: str,
    recipient_name: str = "",
    recipient_role: str = "user",
    company=None,
    language_code: str = "ar",
    context: dict | None = None,
    attachment_url: str = "",
    attachment_name: str = "",
    mime_type: str = "",
):
    if not delivery:
        return None

    event = getattr(delivery, "event", None)
    resolved_company_reference = (
        _stringify(getattr(delivery, "company_reference", ""))
        or _stringify(getattr(event, "company_reference", ""))  # إن وجد
        or _resolve_company_reference(company=company)
    )
    resolved_company_name = (
        safe_text(getattr(delivery, "company_name", ""))
        or safe_text(getattr(event, "company_name", ""))  # إن وجد
        or _resolve_company_name(company=company, context=context or {})
    )

    resolved_language = (
        safe_text(language_code)
        or safe_text(getattr(delivery, "language_code", ""))
        or "ar"
    )
    resolved_event_code = safe_text(getattr(event, "event_code", "")) or "system_notification"
    resolved_event_group = safe_text(getattr(event, "event_group", "")) or "system"
    resolved_scope_type = _infer_scope_type_from_company_reference(resolved_company_reference)
    resolved_trigger_source = _map_event_group_to_trigger_source(resolved_event_group)

    final_context = _build_notification_center_context(
        event=event,
        delivery=delivery,
        recipient_name=recipient_name,
        base_context=context,
    )

    if resolved_company_name and not final_context.get("company_name"):
        final_context["company_name"] = resolved_company_name

    normalized_phone = normalize_phone_number(recipient_phone)
    if not normalized_phone:
        try:
            delivery.mark_attempt()
            delivery.mark_failed(
                error_message="Invalid or missing WhatsApp recipient phone",
                provider_response={
                    "channel": "whatsapp",
                    "reason": "INVALID_PHONE",
                },
            )
        except Exception:
            logger.exception(
                "Failed to update NotificationDelivery as failed | delivery_id=%s",
                getattr(delivery, "id", None),
            )
        return None

    try:
        delivery.mark_attempt()
    except Exception:
        logger.exception(
            "Failed to mark attempt on NotificationDelivery | delivery_id=%s",
            getattr(delivery, "id", None),
        )

    log = send_event_whatsapp_message(
        scope_type=resolved_scope_type,
        event_code=resolved_event_code,
        recipient_phone=normalized_phone,
        recipient_name=recipient_name or safe_text(final_context.get("recipient_name")),
        recipient_role=recipient_role,
        trigger_source=resolved_trigger_source,
        company=company,
        company_reference=resolved_company_reference,
        company_name=resolved_company_name,
        language_code=resolved_language,
        context=final_context,
        related_model=safe_text(getattr(event, "target_model", "")) or "notification_event",
        related_object_id=safe_text(getattr(event, "target_object_id", "")) or safe_text(getattr(event, "id", "")),
        attachment_url=attachment_url,
        attachment_name=attachment_name,
        mime_type=mime_type,
    )

    if not log:
        try:
            delivery.mark_failed(
                error_message="WhatsApp log was not created",
                provider_response={
                    "channel": "whatsapp",
                    "reason": "LOG_NOT_CREATED",
                },
            )
        except Exception:
            logger.exception(
                "Failed to update NotificationDelivery after WhatsApp log missing | delivery_id=%s",
                getattr(delivery, "id", None),
            )
        return None

    provider_response = {
        "channel": "whatsapp",
        "scope_type": resolved_scope_type,
        "event_code": resolved_event_code,
        "trigger_source": resolved_trigger_source,
        "company_reference": resolved_company_reference,
        "log_id": getattr(log, "id", None),
        "provider_status": safe_text(getattr(log, "provider_status", "")),
        "delivery_status": safe_text(getattr(log, "delivery_status", "")),
        "external_message_id": safe_text(getattr(log, "external_message_id", "")),
        "response_json": getattr(log, "response_json", {}) or {},
        "failure_reason": safe_text(getattr(log, "failure_reason", "")),
    }

    if getattr(log, "delivery_status", "") == DeliveryStatus.SENT:
        try:
            delivery.mark_sent(
                provider_message_id=safe_text(getattr(log, "external_message_id", "")) or str(getattr(log, "id", "")),
                provider_response=provider_response,
            )
        except Exception:
            logger.exception(
                "Failed to mark NotificationDelivery as sent | delivery_id=%s | log_id=%s",
                getattr(delivery, "id", None),
                getattr(log, "id", None),
            )
    else:
        try:
            delivery.mark_failed(
                error_message=safe_text(getattr(log, "failure_reason", "")) or "WHATSAPP_SEND_FAILED",
                provider_response=provider_response,
            )
        except Exception:
            logger.exception(
                "Failed to mark NotificationDelivery as failed | delivery_id=%s | log_id=%s",
                getattr(delivery, "id", None),
                getattr(log, "id", None),
            )

    return log