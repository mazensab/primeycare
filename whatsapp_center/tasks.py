# ============================================================
# 📂 whatsapp_center/tasks.py
# 🧠 Primey Care - WhatsApp Tasks V1 Core
# ------------------------------------------------------------
# ✅ ملف مهام آمن لا يكسر النظام عند الاستيراد
# ✅ لا يعتمد على BroadcastStatus أو WhatsAppBroadcast لأنها غير موجودة حاليًا
# ✅ جاهز لاحقًا للربط مع:
#    - APScheduler
#    - Celery
#    - Django management commands
# ✅ يدعم حاليًا:
#    - Placeholder آمن للبث المجدول
#    - Placeholder آمن لتذكيرات انتهاء الاشتراك
#    - Retry للرسائل الفاشلة عند الحاجة
# ============================================================

from __future__ import annotations

import logging
from typing import Any

from django.utils import timezone

from .models import ScopeType
from .services import retry_failed_whatsapp_messages_for_scope

logger = logging.getLogger(__name__)


# ============================================================
# 🔧 Helpers
# ============================================================

def _task_result(
    *,
    success: bool = True,
    task_name: str,
    message: str = "",
    data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    نتيجة موحدة وآمنة لكل مهام WhatsApp Center.

    الهدف:
    - عدم كسر أي scheduler مستقبلي.
    - تسهيل قراءة نتيجة المهمة من logs أو shell.
    """
    return {
        "success": success,
        "task_name": task_name,
        "message": message,
        "data": data or {},
        "executed_at": timezone.now().isoformat(),
    }


# ============================================================
# 📣 Scheduled Broadcasts
# ============================================================

def run_scheduled_broadcasts() -> dict[str, Any]:
    """
    تنفيذ الرسائل الجماعية المجدولة.

    ملاحظة مهمة:
    - موديل WhatsAppBroadcast غير موجود حاليًا في WhatsApp Center Core V1.
    - لذلك هذه المهمة تبقى آمنة وترجع نتيجة واضحة بدل أن تكسر النظام.
    - عند إضافة broadcast module لاحقًا، نربطها هنا رسميًا.
    """
    logger.info("WhatsApp scheduled broadcasts skipped: broadcast module is not enabled yet.")

    return _task_result(
        task_name="run_scheduled_broadcasts",
        message="Broadcast module is not enabled yet in WhatsApp Center Core V1.",
        data={
            "created": 0,
            "sent": 0,
            "failed": 0,
            "skipped": 0,
            "broadcast_module_enabled": False,
        },
    )


# ============================================================
# ⏰ Subscription Expiry Reminders
# ============================================================

def run_subscription_expiry_reminders() -> dict[str, Any]:
    """
    تذكيرات انتهاء الاشتراك.

    ملاحظة:
    - لا يوجد billing/subscription workflow رسمي مرتبط هنا حتى الآن.
    - عند ربط الاشتراكات لاحقًا، يتم جلب الاشتراكات التي تنتهي خلال 7 أيام
      ثم إرسال رسائل WhatsApp من خلال send_event_whatsapp_message.
    """
    logger.info("WhatsApp subscription expiry reminders skipped: subscription source is not connected yet.")

    return _task_result(
        task_name="run_subscription_expiry_reminders",
        message="Subscription reminder source is not connected yet.",
        data={
            "checked": 0,
            "sent": 0,
            "failed": 0,
            "skipped": 0,
            "subscription_source_connected": False,
        },
    )


# ============================================================
# 🔁 Retry Failed Messages
# ============================================================

def run_retry_failed_system_whatsapp_messages(limit: int = 100) -> dict[str, Any]:
    """
    إعادة محاولة إرسال رسائل النظام الفاشلة.

    تستخدم الخدمة الرسمية:
    retry_failed_whatsapp_messages_for_scope
    """
    try:
        result = retry_failed_whatsapp_messages_for_scope(
            scope_type=ScopeType.SYSTEM,
            limit=limit,
        )

        return _task_result(
            task_name="run_retry_failed_system_whatsapp_messages",
            message="System failed WhatsApp messages retry completed.",
            data=result,
        )

    except Exception as exc:
        logger.exception("Failed to retry system WhatsApp messages.")

        return _task_result(
            success=False,
            task_name="run_retry_failed_system_whatsapp_messages",
            message=str(exc),
            data={
                "retried": 0,
                "sent": 0,
                "failed_again": 0,
                "skipped": 0,
            },
        )


def run_retry_failed_company_whatsapp_messages(
    *,
    company_reference: str,
    limit: int = 100,
) -> dict[str, Any]:
    """
    إعادة محاولة إرسال رسائل شركة/جهة محددة.

    في Primey Care Core V1 لا يوجد Company FK مباشر.
    لذلك نعتمد على company_reference فقط.
    """
    clean_company_reference = str(company_reference or "").strip()

    if not clean_company_reference:
        return _task_result(
            success=False,
            task_name="run_retry_failed_company_whatsapp_messages",
            message="company_reference is required.",
            data={
                "retried": 0,
                "sent": 0,
                "failed_again": 0,
                "skipped": 0,
            },
        )

    try:
        result = retry_failed_whatsapp_messages_for_scope(
            scope_type=ScopeType.COMPANY,
            company_reference=clean_company_reference,
            limit=limit,
        )

        return _task_result(
            task_name="run_retry_failed_company_whatsapp_messages",
            message="Company failed WhatsApp messages retry completed.",
            data=result,
        )

    except Exception as exc:
        logger.exception(
            "Failed to retry company WhatsApp messages | company_reference=%s",
            clean_company_reference,
        )

        return _task_result(
            success=False,
            task_name="run_retry_failed_company_whatsapp_messages",
            message=str(exc),
            data={
                "company_reference": clean_company_reference,
                "retried": 0,
                "sent": 0,
                "failed_again": 0,
                "skipped": 0,
            },
        )