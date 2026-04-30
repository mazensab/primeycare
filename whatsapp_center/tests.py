# ============================================================
# 📂 whatsapp_center/tests.py
# 🧠 Primey Care - WhatsApp Center Tests V1 Core
# ------------------------------------------------------------
# ✅ يغطي:
#    - Phone utils
#    - Template seed
#    - Send message
#    - Retry failed messages
#    - Safe tasks
#    - Webhook runtime inbox
#    - Status webhook updates
#    - Primey Care event router
#    - Notification Center bridge
# ============================================================

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from notification_center.models import (
    NotificationChannel,
    NotificationDelivery,
    NotificationDeliveryStatus,
    NotificationEvent,
    NotificationEventStatus,
)

from whatsapp_center.event_router import (
    notify_agent_commission_approved,
    notify_agent_commission_registered,
    notify_invoice_issued,
    notify_invoice_paid,
    notify_order_created,
    notify_payment_confirmed,
)
from whatsapp_center.models import (
    ConversationDirection,
    DeliveryStatus,
    ScopeType,
    SystemWhatsAppConfig,
    WhatsAppContact,
    WhatsAppConversation,
    WhatsAppConversationMessage,
    WhatsAppMessageAttempt,
    WhatsAppMessageLog,
    WhatsAppTemplate,
    WhatsAppWebhookEvent,
)
from whatsapp_center.services import (
    ensure_company_default_whatsapp_templates,
    ensure_system_default_whatsapp_templates,
    retry_failed_whatsapp_messages_for_scope,
    send_event_whatsapp_message,
    send_notification_center_whatsapp_delivery,
)
from whatsapp_center.tasks import (
    run_retry_failed_company_whatsapp_messages,
    run_retry_failed_system_whatsapp_messages,
    run_scheduled_broadcasts,
    run_subscription_expiry_reminders,
)
from whatsapp_center.utils import is_valid_phone_number, normalize_phone_number
from whatsapp_center.webhook_service import (
    apply_provider_status_webhook,
    apply_status_update_to_message,
    create_or_update_inbox_from_webhook,
    inbound_event_exists,
    normalize_status_value,
    store_webhook_event,
)

User = get_user_model()


# ============================================================
# Helpers
# ============================================================

def build_success_gateway_result(
    *,
    external_message_id: str = "wamid.test.123",
    provider_status: str = "sent",
):
    result = MagicMock()
    result.success = True
    result.status_code = 200
    result.provider_status = provider_status
    result.external_message_id = external_message_id
    result.error_message = ""
    result.response_data = {"message": "ok"}
    return result


def build_failed_gateway_result(
    *,
    error_message: str = "Gateway failed",
    provider_status: str = "failed",
):
    result = MagicMock()
    result.success = False
    result.status_code = 500
    result.provider_status = provider_status
    result.external_message_id = ""
    result.error_message = error_message
    result.response_data = {"error": error_message}
    return result


def create_active_system_config():
    return SystemWhatsAppConfig.objects.create(
        provider="whatsapp_web_session",
        is_enabled=True,
        is_active=True,
        session_name="primey-system-session",
        api_version="v22.0",
    )


def create_notification_delivery_for_bridge():
    user = User.objects.create_user(
        username="bridge_user",
        password="123456",
        email="bridge@example.com",
    )

    event = NotificationEvent.objects.create(
        company_reference="",
        company_name="",
        target_user=user,
        event_code="payment_confirmed",
        event_group="billing",
        severity="success",
        status=NotificationEventStatus.PENDING,
        language_code="ar",
        title="تم تأكيد الدفعة",
        message="تم تأكيد دفعتك بنجاح.",
        link="/system/payments/1",
        context={
            "message": "تم تأكيد دفعتك بنجاح.",
            "payment_id": "1",
            "amount": "150.00",
        },
        source="whatsapp_center.tests",
    )

    delivery = NotificationDelivery.objects.create(
        event=event,
        recipient=user,
        channel=NotificationChannel.WHATSAPP,
        status=NotificationDeliveryStatus.PENDING,
        destination="+966555555555",
        subject="تم تأكيد الدفعة",
        rendered_message="تم تأكيد دفعتك بنجاح.",
        language_code="ar",
        provider_name="whatsapp_center",
    )

    return event, delivery


# ============================================================
# Utils
# ============================================================

class WhatsAppUtilsTests(TestCase):
    def test_normalize_phone_number(self):
        self.assertEqual(normalize_phone_number("00966555555555"), "+966555555555")
        self.assertEqual(normalize_phone_number("966555555555"), "+966555555555")
        self.assertEqual(normalize_phone_number("+966555555555"), "+966555555555")
        self.assertEqual(normalize_phone_number(" 966 55 555 5555 "), "+966555555555")
        self.assertEqual(normalize_phone_number("0555555555"), "+966555555555")
        self.assertEqual(normalize_phone_number("555555555"), "+966555555555")

    def test_is_valid_phone_number(self):
        self.assertTrue(is_valid_phone_number("+966555555555"))
        self.assertTrue(is_valid_phone_number("966555555555"))
        self.assertTrue(is_valid_phone_number("0555555555"))
        self.assertFalse(is_valid_phone_number("055555"))
        self.assertFalse(is_valid_phone_number(""))

    def test_normalize_status_value(self):
        self.assertEqual(normalize_status_value("server_ack"), "sent")
        self.assertEqual(normalize_status_value("delivery_ack"), "delivered")
        self.assertEqual(normalize_status_value("read_ack"), "read")
        self.assertEqual(normalize_status_value("message_failed"), "failed")
        self.assertEqual(normalize_status_value(1), "sent")
        self.assertEqual(normalize_status_value(2), "delivered")
        self.assertEqual(normalize_status_value(4), "read")
        self.assertEqual(normalize_status_value(5), "failed")
        self.assertEqual(normalize_status_value(True), "")


# ============================================================
# Template Seeds
# ============================================================

class WhatsAppTemplateSeedTests(TestCase):
    def test_ensure_system_default_whatsapp_templates_creates_templates(self):
        result = ensure_system_default_whatsapp_templates()

        self.assertGreater(result["created"], 0)
        self.assertGreater(result["total_system_templates"], 0)

        self.assertTrue(
            WhatsAppTemplate.objects.filter(
                scope_type=ScopeType.SYSTEM,
                company_reference="",
            ).exists()
        )

    def test_ensure_system_default_whatsapp_templates_is_idempotent(self):
        first = ensure_system_default_whatsapp_templates()
        second = ensure_system_default_whatsapp_templates()

        self.assertGreaterEqual(first["created"], 1)
        self.assertEqual(second["created"], 0)

    def test_ensure_company_default_whatsapp_templates_creates_company_templates(self):
        result = ensure_company_default_whatsapp_templates(
            company_reference="COMP-001",
            company_name="Primey Care Demo",
        )

        self.assertGreater(result["created"], 0)
        self.assertGreater(result["total_company_templates"], 0)

        self.assertTrue(
            WhatsAppTemplate.objects.filter(
                scope_type=ScopeType.COMPANY,
                company_reference="COMP-001",
            ).exists()
        )

    def test_ensure_company_default_whatsapp_templates_without_reference_is_safe(self):
        result = ensure_company_default_whatsapp_templates(
            company_reference="",
            company_name="No Ref",
        )

        self.assertEqual(result["created"], 0)
        self.assertEqual(result["total_company_templates"], 0)


# ============================================================
# Send Message
# ============================================================

class WhatsAppSendMessageTests(TestCase):
    def setUp(self):
        self.config = create_active_system_config()

    def test_send_event_whatsapp_message_invalid_phone_creates_failed_log(self):
        log = send_event_whatsapp_message(
            scope_type=ScopeType.SYSTEM,
            event_code="system_test_message",
            recipient_phone="",
            recipient_name="Mazen",
        )

        self.assertIsNotNone(log)
        self.assertEqual(log.delivery_status, DeliveryStatus.FAILED)
        self.assertIn("Invalid or missing recipient phone number", log.failure_reason)

    @patch("whatsapp_center.services.WhatsAppClient")
    def test_send_event_whatsapp_message_success(self, mock_client_class):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.send_text_message.return_value = build_success_gateway_result(
            external_message_id="wamid.test.123",
        )

        log = send_event_whatsapp_message(
            scope_type=ScopeType.SYSTEM,
            event_code="system_test_message",
            recipient_phone="+966555555555",
            recipient_name="Mazen",
            context={"message": "Test message"},
        )

        self.assertIsNotNone(log)
        self.assertEqual(log.scope_type, ScopeType.SYSTEM)
        self.assertEqual(log.company_reference, "")
        self.assertEqual(log.delivery_status, DeliveryStatus.SENT)
        self.assertEqual(log.external_message_id, "wamid.test.123")
        self.assertEqual(WhatsAppMessageAttempt.objects.count(), 1)

    @patch("whatsapp_center.services.WhatsAppClient")
    def test_send_event_whatsapp_message_failed_send(self, mock_client_class):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.send_text_message.return_value = build_failed_gateway_result(
            error_message="Gateway failed",
        )

        log = send_event_whatsapp_message(
            scope_type=ScopeType.SYSTEM,
            event_code="system_test_message",
            recipient_phone="+966555555555",
            recipient_name="Mazen",
            context={"message": "Test failed send"},
        )

        self.assertIsNotNone(log)
        self.assertEqual(log.delivery_status, DeliveryStatus.FAILED)
        self.assertEqual(log.provider_status, "failed")
        self.assertIn("Gateway failed", log.failure_reason)
        self.assertEqual(WhatsAppMessageAttempt.objects.count(), 1)

    @patch("whatsapp_center.services.WhatsAppClient")
    def test_send_company_scope_falls_back_to_system_config(self, mock_client_class):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.send_text_message.return_value = build_success_gateway_result(
            external_message_id="wamid.company.001",
        )

        log = send_event_whatsapp_message(
            scope_type=ScopeType.COMPANY,
            company_reference="PROVIDER-001",
            company_name="Prime Provider",
            event_code="system_test_message",
            recipient_phone="+966555555555",
            recipient_name="Provider Admin",
            context={"message": "Company scope fallback message"},
        )

        self.assertIsNotNone(log)
        self.assertEqual(log.scope_type, ScopeType.COMPANY)
        self.assertEqual(log.company_reference, "PROVIDER-001")
        self.assertEqual(log.company_name, "Prime Provider")
        self.assertEqual(log.delivery_status, DeliveryStatus.SENT)
        self.assertEqual(log.external_message_id, "wamid.company.001")


# ============================================================
# Retry
# ============================================================

class WhatsAppRetryTests(TestCase):
    def setUp(self):
        self.config = create_active_system_config()

    @patch("whatsapp_center.services.WhatsAppClient")
    def test_retry_failed_whatsapp_messages_for_scope(self, mock_client_class):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.send_text_message.return_value = build_success_gateway_result(
            external_message_id="wamid.retry.001",
        )

        log = WhatsAppMessageLog.objects.create(
            scope_type=ScopeType.SYSTEM,
            company_reference="",
            company_name="",
            trigger_source="system",
            event_code="system_test_message",
            recipient_name="Retry User",
            recipient_phone="+966555555555",
            recipient_role="user",
            message_type="TEXT",
            language_code="ar",
            message_body="retry me",
            delivery_status=DeliveryStatus.FAILED,
            failure_reason="WhatsApp session is not connected",
            provider_status="gateway_failed",
        )

        result = retry_failed_whatsapp_messages_for_scope(
            scope_type=ScopeType.SYSTEM,
            limit=10,
        )

        log.refresh_from_db()

        self.assertTrue(result["success"])
        self.assertEqual(result["retried"], 1)
        self.assertEqual(result["sent"], 1)
        self.assertEqual(log.delivery_status, DeliveryStatus.SENT)
        self.assertEqual(log.external_message_id, "wamid.retry.001")
        self.assertEqual(log.attempts.count(), 1)

    def test_retry_skips_non_session_failures(self):
        WhatsAppMessageLog.objects.create(
            scope_type=ScopeType.SYSTEM,
            company_reference="",
            company_name="",
            trigger_source="system",
            event_code="system_test_message",
            recipient_name="Retry User",
            recipient_phone="+966555555555",
            recipient_role="user",
            message_type="TEXT",
            language_code="ar",
            message_body="retry me",
            delivery_status=DeliveryStatus.FAILED,
            failure_reason="Validation failed",
            provider_status="validation_failed",
        )

        result = retry_failed_whatsapp_messages_for_scope(
            scope_type=ScopeType.SYSTEM,
            limit=10,
        )

        self.assertTrue(result["success"])
        self.assertEqual(result["retried"], 0)
        self.assertEqual(result["sent"], 0)
        self.assertEqual(result["skipped"], 1)

    @patch("whatsapp_center.services.WhatsAppClient")
    def test_retry_failed_company_whatsapp_messages_for_scope(self, mock_client_class):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.send_text_message.return_value = build_success_gateway_result(
            external_message_id="wamid.company.retry.001",
        )

        log = WhatsAppMessageLog.objects.create(
            scope_type=ScopeType.COMPANY,
            company_reference="PROVIDER-001",
            company_name="Prime Provider",
            trigger_source="system",
            event_code="system_test_message",
            recipient_name="Company Retry User",
            recipient_phone="+966555555555",
            recipient_role="provider_admin",
            message_type="TEXT",
            language_code="ar",
            message_body="retry company message",
            delivery_status=DeliveryStatus.FAILED,
            failure_reason="WhatsApp session is not connected",
            provider_status="gateway_failed",
        )

        result = retry_failed_whatsapp_messages_for_scope(
            scope_type=ScopeType.COMPANY,
            company_reference="PROVIDER-001",
            limit=10,
        )

        log.refresh_from_db()

        self.assertTrue(result["success"])
        self.assertEqual(result["retried"], 1)
        self.assertEqual(result["sent"], 1)
        self.assertEqual(log.delivery_status, DeliveryStatus.SENT)
        self.assertEqual(log.external_message_id, "wamid.company.retry.001")


# ============================================================
# Tasks
# ============================================================

class WhatsAppTasksTests(TestCase):
    def setUp(self):
        self.config = create_active_system_config()

    def test_run_scheduled_broadcasts_is_safe_placeholder(self):
        result = run_scheduled_broadcasts()

        self.assertTrue(result["success"])
        self.assertEqual(result["task_name"], "run_scheduled_broadcasts")
        self.assertFalse(result["data"]["broadcast_module_enabled"])

    def test_run_subscription_expiry_reminders_is_safe_placeholder(self):
        result = run_subscription_expiry_reminders()

        self.assertTrue(result["success"])
        self.assertEqual(result["task_name"], "run_subscription_expiry_reminders")
        self.assertFalse(result["data"]["subscription_source_connected"])

    @patch("whatsapp_center.services.WhatsAppClient")
    def test_run_retry_failed_system_whatsapp_messages(self, mock_client_class):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.send_text_message.return_value = build_success_gateway_result(
            external_message_id="wamid.task.retry.001",
        )

        WhatsAppMessageLog.objects.create(
            scope_type=ScopeType.SYSTEM,
            company_reference="",
            company_name="",
            trigger_source="system",
            event_code="system_test_message",
            recipient_name="Task Retry User",
            recipient_phone="+966555555555",
            recipient_role="user",
            message_type="TEXT",
            language_code="ar",
            message_body="task retry",
            delivery_status=DeliveryStatus.FAILED,
            failure_reason="WhatsApp session is not connected",
            provider_status="gateway_failed",
        )

        result = run_retry_failed_system_whatsapp_messages(limit=10)

        self.assertTrue(result["success"])
        self.assertEqual(result["task_name"], "run_retry_failed_system_whatsapp_messages")
        self.assertEqual(result["data"]["retried"], 1)
        self.assertEqual(result["data"]["sent"], 1)

    def test_run_retry_failed_company_whatsapp_messages_requires_reference(self):
        result = run_retry_failed_company_whatsapp_messages(company_reference="")

        self.assertFalse(result["success"])
        self.assertEqual(result["task_name"], "run_retry_failed_company_whatsapp_messages")
        self.assertIn("company_reference is required", result["message"])


# ============================================================
# Webhook Storage / Status
# ============================================================

class WhatsAppWebhookStorageTests(TestCase):
    def test_store_webhook_event_system_scope_without_company_fk(self):
        event = store_webhook_event(
            payload={"hello": "world"},
            event_type="message_status",
            external_message_id="wamid.status.001",
            scope_type=ScopeType.SYSTEM,
            provider="whatsapp_web_session",
        )

        self.assertIsNotNone(event)
        self.assertEqual(event.scope_type, ScopeType.SYSTEM)
        self.assertEqual(event.company_reference, "")
        self.assertEqual(event.company_name, "")
        self.assertEqual(event.external_message_id, "wamid.status.001")

    def test_store_webhook_event_company_scope_uses_company_reference(self):
        event = store_webhook_event(
            payload={
                "company_reference": "PROVIDER-001",
                "company_name": "Prime Provider",
            },
            event_type="provider_webhook",
            external_message_id="wamid.company.event.001",
            scope_type=ScopeType.COMPANY,
            company_reference="PROVIDER-001",
            company_name="Prime Provider",
            provider="whatsapp_web_session",
        )

        self.assertIsNotNone(event)
        self.assertEqual(event.scope_type, ScopeType.COMPANY)
        self.assertEqual(event.company_reference, "PROVIDER-001")
        self.assertEqual(event.company_name, "Prime Provider")

    def test_inbound_event_exists_uses_company_reference(self):
        store_webhook_event(
            payload={"company_reference": "PROVIDER-001"},
            event_type="inbound_message",
            external_message_id="wamid.inbound.exists.001",
            scope_type=ScopeType.COMPANY,
            company_reference="PROVIDER-001",
            company_name="Prime Provider",
            provider="whatsapp_web_session",
        )

        self.assertTrue(
            inbound_event_exists(
                external_message_id="wamid.inbound.exists.001",
                scope_type=ScopeType.COMPANY,
                company_reference="PROVIDER-001",
                event_type="inbound_message",
            )
        )

        self.assertFalse(
            inbound_event_exists(
                external_message_id="wamid.inbound.exists.001",
                scope_type=ScopeType.COMPANY,
                company_reference="OTHER",
                event_type="inbound_message",
            )
        )

    def test_apply_status_update_to_message(self):
        log = WhatsAppMessageLog.objects.create(
            scope_type=ScopeType.SYSTEM,
            company_reference="",
            company_name="",
            trigger_source="system",
            event_code="system_test_message",
            recipient_name="Status User",
            recipient_phone="+966555555555",
            recipient_role="user",
            message_type="TEXT",
            language_code="ar",
            message_body="status update",
            delivery_status=DeliveryStatus.SENT,
            external_message_id="wamid.status.update.001",
            provider_status="sent",
        )

        updated = apply_status_update_to_message(
            external_message_id="wamid.status.update.001",
            new_status="delivered",
        )

        log.refresh_from_db()

        self.assertIsNotNone(updated)
        self.assertEqual(log.delivery_status, DeliveryStatus.DELIVERED)
        self.assertEqual(log.provider_status, "delivered")
        self.assertIsNotNone(log.delivered_at)

    def test_apply_provider_status_webhook_updates_message_log(self):
        log = WhatsAppMessageLog.objects.create(
            scope_type=ScopeType.SYSTEM,
            company_reference="",
            company_name="",
            trigger_source="system",
            event_code="system_test_message",
            recipient_name="Status User",
            recipient_phone="+966555555555",
            recipient_role="user",
            message_type="TEXT",
            language_code="ar",
            message_body="status update",
            delivery_status=DeliveryStatus.SENT,
            external_message_id="wamid.status.webhook.001",
            provider_status="sent",
        )

        result = apply_provider_status_webhook(
            payload={"status": "read"},
            external_message_id="wamid.status.webhook.001",
            new_status="read",
            scope_type=ScopeType.SYSTEM,
            provider="whatsapp_web_session",
        )

        log.refresh_from_db()

        self.assertTrue(result["success"])
        self.assertTrue(result["message_log_updated"])
        self.assertEqual(log.delivery_status, DeliveryStatus.READ)
        self.assertIsNotNone(log.read_at)
        self.assertEqual(WhatsAppWebhookEvent.objects.count(), 1)


# ============================================================
# Webhook Runtime Inbox
# ============================================================

class WhatsAppWebhookInboxRuntimeTests(TestCase):
    def test_create_or_update_inbox_from_webhook_creates_runtime_records(self):
        payload = {
            "provider": "whatsapp_web_session",
            "source": "baileys_gateway",
            "scope_type": ScopeType.SYSTEM,
            "session_name": "primey-system-session",
            "messages": [
                {
                    "message_id": "wamid.inbound.001",
                    "sender_phone": "0555555555",
                    "sender_jid": "966555555555@s.whatsapp.net",
                    "push_name": "Mazen",
                    "message_type": "conversation",
                    "text": "السلام عليكم",
                    "timestamp": 1714470000,
                    "from_me": False,
                    "is_status": False,
                }
            ],
        }

        result = create_or_update_inbox_from_webhook(
            payload=payload,
            scope_type=ScopeType.SYSTEM,
        )

        self.assertEqual(result["created_count"], 1)
        self.assertEqual(result["skipped_count"], 0)

        self.assertEqual(WhatsAppWebhookEvent.objects.count(), 1)
        self.assertEqual(WhatsAppContact.objects.count(), 1)
        self.assertEqual(WhatsAppConversation.objects.count(), 1)
        self.assertEqual(WhatsAppConversationMessage.objects.count(), 1)

        contact = WhatsAppContact.objects.first()
        conversation = WhatsAppConversation.objects.first()
        message = WhatsAppConversationMessage.objects.first()

        self.assertEqual(contact.scope_type, ScopeType.SYSTEM)
        self.assertEqual(contact.company_reference, "")
        self.assertEqual(contact.phone_number, "+966555555555")
        self.assertEqual(contact.display_name, "Mazen")

        self.assertEqual(conversation.scope_type, ScopeType.SYSTEM)
        self.assertEqual(conversation.company_reference, "")
        self.assertEqual(conversation.unread_count, 1)
        self.assertEqual(conversation.last_message_preview, "السلام عليكم")

        self.assertEqual(message.direction, ConversationDirection.INBOUND)
        self.assertEqual(message.delivery_status, DeliveryStatus.DELIVERED)
        self.assertEqual(message.external_message_id, "wamid.inbound.001")
        self.assertEqual(message.sender_phone, "+966555555555")
        self.assertEqual(message.body_text, "السلام عليكم")

    def test_create_or_update_inbox_from_webhook_is_idempotent(self):
        payload = {
            "provider": "whatsapp_web_session",
            "source": "baileys_gateway",
            "scope_type": ScopeType.SYSTEM,
            "session_name": "primey-system-session",
            "messages": [
                {
                    "message_id": "wamid.inbound.duplicate.001",
                    "sender_phone": "+966555555555",
                    "push_name": "Mazen",
                    "message_type": "conversation",
                    "text": "رسالة مكررة",
                    "from_me": False,
                    "is_status": False,
                }
            ],
        }

        first = create_or_update_inbox_from_webhook(
            payload=payload,
            scope_type=ScopeType.SYSTEM,
        )
        second = create_or_update_inbox_from_webhook(
            payload=payload,
            scope_type=ScopeType.SYSTEM,
        )

        self.assertEqual(first["created_count"], 1)
        self.assertEqual(second["created_count"], 0)
        self.assertEqual(second["skipped_count"], 1)
        self.assertEqual(WhatsAppConversationMessage.objects.count(), 1)
        self.assertEqual(WhatsAppWebhookEvent.objects.count(), 1)

    def test_create_or_update_inbox_from_webhook_skips_from_me_and_status(self):
        payload = {
            "provider": "whatsapp_web_session",
            "messages": [
                {
                    "message_id": "wamid.from.me.001",
                    "sender_phone": "+966555555555",
                    "text": "outbound echo",
                    "from_me": True,
                    "is_status": False,
                },
                {
                    "message_id": "wamid.status.001",
                    "sender_phone": "+966555555555",
                    "text": "status",
                    "from_me": False,
                    "is_status": True,
                },
            ],
        }

        result = create_or_update_inbox_from_webhook(
            payload=payload,
            scope_type=ScopeType.SYSTEM,
        )

        self.assertEqual(result["created_count"], 0)
        self.assertEqual(result["skipped_count"], 2)
        self.assertEqual(WhatsAppConversationMessage.objects.count(), 0)

    def test_create_or_update_company_inbox_uses_company_reference(self):
        payload = {
            "provider": "whatsapp_web_session",
            "source": "baileys_gateway",
            "scope_type": ScopeType.COMPANY,
            "company_reference": "PROVIDER-001",
            "company_name": "Prime Provider",
            "session_name": "provider-session",
            "messages": [
                {
                    "message_id": "wamid.company.inbound.001",
                    "sender_phone": "+966555555555",
                    "sender_jid": "966555555555@s.whatsapp.net",
                    "push_name": "Provider Client",
                    "message_type": "conversation",
                    "text": "رسالة للجهة",
                    "from_me": False,
                    "is_status": False,
                }
            ],
        }

        result = create_or_update_inbox_from_webhook(
            payload=payload,
            scope_type=ScopeType.COMPANY,
            company_reference="PROVIDER-001",
            company_name="Prime Provider",
        )

        self.assertEqual(result["created_count"], 1)

        contact = WhatsAppContact.objects.first()
        conversation = WhatsAppConversation.objects.first()
        message = WhatsAppConversationMessage.objects.first()
        event = WhatsAppWebhookEvent.objects.first()

        self.assertEqual(contact.scope_type, ScopeType.COMPANY)
        self.assertEqual(contact.company_reference, "PROVIDER-001")
        self.assertEqual(contact.company_name, "Prime Provider")

        self.assertEqual(conversation.scope_type, ScopeType.COMPANY)
        self.assertEqual(conversation.company_reference, "PROVIDER-001")
        self.assertEqual(conversation.company_name, "Prime Provider")

        self.assertEqual(message.scope_type, ScopeType.COMPANY)
        self.assertEqual(message.company_reference, "PROVIDER-001")
        self.assertEqual(message.company_name, "Prime Provider")

        self.assertEqual(event.scope_type, ScopeType.COMPANY)
        self.assertEqual(event.company_reference, "PROVIDER-001")
        self.assertEqual(event.company_name, "Prime Provider")


# ============================================================
# Primey Care Event Router
# ============================================================

class WhatsAppPrimeyCareEventRouterTests(TestCase):
    def setUp(self):
        self.config = create_active_system_config()

    @patch("whatsapp_center.services.WhatsAppClient")
    def test_notify_order_created(self, mock_client_class):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.send_text_message.return_value = build_success_gateway_result(
            external_message_id="wamid.order.001",
        )

        customer = SimpleNamespace(
            pk=10,
            full_name="Mazen Customer",
            phone="+966555555555",
        )
        order = SimpleNamespace(
            pk=100,
            order_number="ORD-100",
            status="pending",
            total_amount="299.00",
            customer=customer,
        )

        log = notify_order_created(
            order=order,
            recipient_phone="+966555555555",
            customer=customer,
        )

        self.assertIsNotNone(log)
        self.assertEqual(log.event_code, "order_created")
        self.assertEqual(log.delivery_status, DeliveryStatus.SENT)
        self.assertEqual(log.external_message_id, "wamid.order.001")
        self.assertIn("ORD-100", log.message_body)

    @patch("whatsapp_center.services.WhatsAppClient")
    def test_notify_invoice_issued(self, mock_client_class):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.send_text_message.return_value = build_success_gateway_result(
            external_message_id="wamid.invoice.issued.001",
        )

        customer = SimpleNamespace(
            pk=10,
            full_name="Mazen Customer",
        )
        invoice = SimpleNamespace(
            pk=200,
            invoice_number="INV-200",
            total_amount="450.00",
            status="issued",
            customer=customer,
        )

        log = notify_invoice_issued(
            invoice=invoice,
            recipient_phone="+966555555555",
            customer=customer,
        )

        self.assertIsNotNone(log)
        self.assertEqual(log.event_code, "invoice_issued")
        self.assertEqual(log.delivery_status, DeliveryStatus.SENT)
        self.assertEqual(log.external_message_id, "wamid.invoice.issued.001")
        self.assertIn("INV-200", log.message_body)

    @patch("whatsapp_center.services.WhatsAppClient")
    def test_notify_invoice_paid(self, mock_client_class):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.send_text_message.return_value = build_success_gateway_result(
            external_message_id="wamid.invoice.paid.001",
        )

        customer = SimpleNamespace(pk=10, full_name="Mazen Customer")
        payment = SimpleNamespace(pk=300, amount="450.00")
        invoice = SimpleNamespace(
            pk=200,
            invoice_number="INV-200",
            total_amount="450.00",
            paid_amount="450.00",
            status="paid",
            customer=customer,
        )

        log = notify_invoice_paid(
            invoice=invoice,
            payment=payment,
            recipient_phone="+966555555555",
            customer=customer,
        )

        self.assertIsNotNone(log)
        self.assertEqual(log.event_code, "invoice_paid")
        self.assertEqual(log.delivery_status, DeliveryStatus.SENT)
        self.assertIn("INV-200", log.message_body)

    @patch("whatsapp_center.services.WhatsAppClient")
    def test_notify_payment_confirmed(self, mock_client_class):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.send_text_message.return_value = build_success_gateway_result(
            external_message_id="wamid.payment.confirmed.001",
        )

        customer = SimpleNamespace(pk=10, full_name="Mazen Customer")
        invoice = SimpleNamespace(pk=200, invoice_number="INV-200", customer=customer)
        payment = SimpleNamespace(
            pk=300,
            amount="450.00",
            payment_method="cash",
            reference_number="REF-001",
            invoice=invoice,
            customer=customer,
        )

        log = notify_payment_confirmed(
            payment=payment,
            invoice=invoice,
            recipient_phone="+966555555555",
            customer=customer,
        )

        self.assertIsNotNone(log)
        self.assertEqual(log.event_code, "payment_confirmed")
        self.assertEqual(log.delivery_status, DeliveryStatus.SENT)
        self.assertIn("450.00", log.message_body)

    @patch("whatsapp_center.services.WhatsAppClient")
    def test_notify_agent_commission_registered(self, mock_client_class):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.send_text_message.return_value = build_success_gateway_result(
            external_message_id="wamid.agent.registered.001",
        )

        agent = SimpleNamespace(pk=50, full_name="Agent One")
        commission = SimpleNamespace(
            pk=500,
            agent=agent,
            commission_amount="75.00",
            status="registered",
        )

        log = notify_agent_commission_registered(
            commission=commission,
            agent=agent,
            recipient_phone="+966555555555",
        )

        self.assertIsNotNone(log)
        self.assertEqual(log.event_code, "agent_commission_registered")
        self.assertEqual(log.delivery_status, DeliveryStatus.SENT)
        self.assertIn("75.00", log.message_body)

    @patch("whatsapp_center.services.WhatsAppClient")
    def test_notify_agent_commission_approved(self, mock_client_class):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.send_text_message.return_value = build_success_gateway_result(
            external_message_id="wamid.agent.approved.001",
        )

        agent = SimpleNamespace(pk=50, full_name="Agent One")
        commission = SimpleNamespace(
            pk=500,
            agent=agent,
            commission_amount="75.00",
            status="approved",
        )

        log = notify_agent_commission_approved(
            commission=commission,
            agent=agent,
            recipient_phone="+966555555555",
        )

        self.assertIsNotNone(log)
        self.assertEqual(log.event_code, "agent_commission_approved")
        self.assertEqual(log.delivery_status, DeliveryStatus.SENT)
        self.assertIn("75.00", log.message_body)


# ============================================================
# Notification Center Bridge
# ============================================================

class WhatsAppNotificationCenterBridgeTests(TestCase):
    def setUp(self):
        self.config = create_active_system_config()

    @patch("whatsapp_center.services.WhatsAppClient")
    def test_send_notification_center_whatsapp_delivery_success(self, mock_client_class):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.send_text_message.return_value = build_success_gateway_result(
            external_message_id="wamid.notification.bridge.001",
        )

        _, delivery = create_notification_delivery_for_bridge()

        log = send_notification_center_whatsapp_delivery(
            delivery=delivery,
            recipient_phone="+966555555555",
            recipient_name="Bridge User",
            recipient_role="customer",
            language_code="ar",
            context={"message": "تم تأكيد دفعتك بنجاح."},
        )

        delivery.refresh_from_db()

        self.assertIsNotNone(log)
        self.assertEqual(log.event_code, "payment_confirmed")
        self.assertEqual(log.recipient_phone, "+966555555555")
        self.assertEqual(log.delivery_status, DeliveryStatus.SENT)
        self.assertEqual(log.external_message_id, "wamid.notification.bridge.001")
        self.assertEqual(delivery.status, NotificationDeliveryStatus.SENT)
        self.assertEqual(delivery.provider_message_id, "wamid.notification.bridge.001")

    def test_send_notification_center_whatsapp_delivery_invalid_phone_marks_delivery_failed(self):
        _, delivery = create_notification_delivery_for_bridge()

        log = send_notification_center_whatsapp_delivery(
            delivery=delivery,
            recipient_phone="0555",
            recipient_name="Bridge User",
            recipient_role="customer",
            language_code="ar",
            context={"message": "Invalid phone test"},
        )

        delivery.refresh_from_db()

        self.assertIsNone(log)
        self.assertEqual(delivery.status, NotificationDeliveryStatus.FAILED)
        self.assertIn("Invalid or missing WhatsApp recipient phone", delivery.error_message)