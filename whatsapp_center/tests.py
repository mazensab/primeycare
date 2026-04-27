# ============================================================
# 📂 whatsapp_center/tests.py
# 🧠 Primey Care - WhatsApp Center Tests V1 Core
# ============================================================

from __future__ import annotations

from unittest.mock import MagicMock, patch

from django.test import TestCase

from whatsapp_center.models import (
    DeliveryStatus,
    ScopeType,
    SystemWhatsAppConfig,
    WhatsAppMessageAttempt,
    WhatsAppMessageLog,
    WhatsAppTemplate,
)
from whatsapp_center.services import (
    ensure_company_default_whatsapp_templates,
    ensure_system_default_whatsapp_templates,
    retry_failed_whatsapp_messages_for_scope,
    send_event_whatsapp_message,
)
from whatsapp_center.utils import is_valid_phone_number, normalize_phone_number


class WhatsAppUtilsTests(TestCase):
    def test_normalize_phone_number(self):
        self.assertEqual(normalize_phone_number("00966555555555"), "+966555555555")
        self.assertEqual(normalize_phone_number("966555555555"), "+966555555555")
        self.assertEqual(normalize_phone_number("+966555555555"), "+966555555555")
        self.assertEqual(normalize_phone_number(" 966 55 555 5555 "), "+966555555555")

    def test_is_valid_phone_number(self):
        self.assertTrue(is_valid_phone_number("+966555555555"))
        self.assertTrue(is_valid_phone_number("966555555555"))
        self.assertFalse(is_valid_phone_number("055555"))
        self.assertFalse(is_valid_phone_number(""))


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


class WhatsAppSendMessageTests(TestCase):
    def setUp(self):
        self.config = SystemWhatsAppConfig.objects.create(
            provider="whatsapp_web_session",
            is_enabled=True,
            is_active=True,
            session_name="primey-system-session",
            api_version="v22.0",
        )

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

        result = MagicMock()
        result.success = True
        result.status_code = 200
        result.provider_status = "sent"
        result.external_message_id = "wamid.test.123"
        result.error_message = ""
        result.response_data = {"message": "ok"}
        mock_client.send_text_message.return_value = result

        log = send_event_whatsapp_message(
            scope_type=ScopeType.SYSTEM,
            event_code="system_test_message",
            recipient_phone="+966555555555",
            recipient_name="Mazen",
            context={"message": "Test message"},
        )

        self.assertIsNotNone(log)
        self.assertEqual(log.delivery_status, DeliveryStatus.SENT)
        self.assertEqual(log.external_message_id, "wamid.test.123")
        self.assertEqual(WhatsAppMessageAttempt.objects.count(), 1)

    @patch("whatsapp_center.services.WhatsAppClient")
    def test_send_event_whatsapp_message_failed_send(self, mock_client_class):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client

        result = MagicMock()
        result.success = False
        result.status_code = 500
        result.provider_status = "failed"
        result.external_message_id = ""
        result.error_message = "Gateway failed"
        result.response_data = {"error": "Gateway failed"}
        mock_client.send_text_message.return_value = result

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


class WhatsAppRetryTests(TestCase):
    def setUp(self):
        self.config = SystemWhatsAppConfig.objects.create(
            provider="whatsapp_web_session",
            is_enabled=True,
            is_active=True,
            session_name="primey-system-session",
            api_version="v22.0",
        )

    @patch("whatsapp_center.services.WhatsAppClient")
    def test_retry_failed_whatsapp_messages_for_scope(self, mock_client_class):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client

        retry_result = MagicMock()
        retry_result.success = True
        retry_result.status_code = 200
        retry_result.provider_status = "sent"
        retry_result.external_message_id = "wamid.retry.001"
        retry_result.error_message = ""
        retry_result.response_data = {"message": "ok"}
        mock_client.send_text_message.return_value = retry_result

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