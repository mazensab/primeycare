from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from notification_center.models import (
    Notification,
    NotificationChannel,
    NotificationDelivery,
    NotificationDeliveryStatus,
    NotificationEvent,
    NotificationEventStatus,
)
from notification_center.services import (
    create_notification,
    notify_agent_commission_approved,
    notify_agent_commission_registered,
    notify_invoice_issued,
    notify_invoice_paid,
    notify_order_created,
    notify_order_status_changed,
    notify_payment_confirmed,
)

User = get_user_model()


class NotificationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="mazen",
            password="123456",
            email="mazen@example.com",
        )
        self.user.mobile_number = "+966500000001"

    def test_create_notification(self):
        n = create_notification(
            recipient=self.user,
            title="T",
            message="M",
            notification_type="system",
        )

        self.assertIsNotNone(n)
        self.assertEqual(n.recipient, self.user)
        self.assertEqual(n.title, "T")
        self.assertEqual(n.message, "M")
        self.assertFalse(n.is_read)

        self.assertEqual(Notification.objects.count(), 1)
        self.assertEqual(NotificationEvent.objects.count(), 1)
        self.assertEqual(NotificationDelivery.objects.count(), 1)

        event = NotificationEvent.objects.first()
        delivery = NotificationDelivery.objects.first()

        self.assertIsNotNone(event)
        self.assertIsNotNone(delivery)

        self.assertEqual(n.event, event)
        self.assertEqual(event.target_user, self.user)
        self.assertEqual(event.event_code, "system")
        self.assertEqual(event.event_group, "system")
        self.assertEqual(event.status, NotificationEventStatus.PROCESSED)

        self.assertEqual(delivery.event, event)
        self.assertEqual(delivery.notification, n)
        self.assertEqual(delivery.recipient, self.user)
        self.assertEqual(delivery.channel, NotificationChannel.IN_APP)
        self.assertEqual(delivery.status, NotificationDeliveryStatus.SENT)
        self.assertEqual(delivery.attempts, 1)

    @override_settings(
        EMAIL_NOTIFICATIONS_ENABLED=True,
        EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
        DEFAULT_FROM_EMAIL="info@example.com",
        FRONTEND_BASE_URL="https://primeycare.test",
    )
    def test_create_notification_with_email_creates_email_delivery(self):
        n = create_notification(
            recipient=self.user,
            title="Email Title",
            message="Email Body",
            notification_type="system",
            send_email=True,
        )

        self.assertIsNotNone(n)
        self.assertEqual(Notification.objects.count(), 1)
        self.assertEqual(NotificationEvent.objects.count(), 1)
        self.assertEqual(NotificationDelivery.objects.count(), 2)

        event = NotificationEvent.objects.first()
        deliveries = NotificationDelivery.objects.filter(event=event).order_by("id")

        self.assertIsNotNone(event)
        self.assertEqual(event.status, NotificationEventStatus.PROCESSED)
        self.assertEqual(deliveries.count(), 2)

        in_app_delivery = deliveries.filter(channel=NotificationChannel.IN_APP).first()
        email_delivery = deliveries.filter(channel=NotificationChannel.EMAIL).first()

        self.assertIsNotNone(in_app_delivery)
        self.assertIsNotNone(email_delivery)

        self.assertEqual(in_app_delivery.status, NotificationDeliveryStatus.SENT)
        self.assertEqual(email_delivery.status, NotificationDeliveryStatus.SENT)
        self.assertEqual(email_delivery.destination, self.user.email)
        self.assertEqual(email_delivery.notification, n)
        self.assertEqual(email_delivery.attempts, 1)

    @patch("notification_center.services._send_notification_whatsapp")
    @override_settings(WHATSAPP_NOTIFICATIONS_ENABLED=True)
    def test_create_notification_with_whatsapp_creates_whatsapp_delivery(
        self,
        mock_send_whatsapp,
    ):
        mock_send_whatsapp.return_value = (
            True,
            {
                "provider": "whatsapp_center",
                "recipient_phone": "+966500000001",
                "recipient_name": "Mazen",
                "status": "sent",
                "log_id": 999,
                "external_message_id": "wamid.test.123",
                "delivery_status": "SENT",
                "provider_status": "sent",
                "failure_reason": "",
            },
        )

        n = create_notification(
            recipient=self.user,
            title="WhatsApp Title",
            message="WhatsApp Body",
            notification_type="system",
            send_whatsapp=True,
            whatsapp_phone="+966500000001",
            whatsapp_recipient_name="Mazen",
            whatsapp_recipient_role="user",
        )

        self.assertIsNotNone(n)
        self.assertEqual(Notification.objects.count(), 1)
        self.assertEqual(NotificationEvent.objects.count(), 1)
        self.assertEqual(NotificationDelivery.objects.count(), 2)

        event = NotificationEvent.objects.first()
        deliveries = NotificationDelivery.objects.filter(event=event).order_by("id")

        self.assertIsNotNone(event)
        self.assertEqual(event.status, NotificationEventStatus.PROCESSED)
        self.assertEqual(deliveries.count(), 2)

        in_app_delivery = deliveries.filter(channel=NotificationChannel.IN_APP).first()
        whatsapp_delivery = deliveries.filter(channel=NotificationChannel.WHATSAPP).first()

        self.assertIsNotNone(in_app_delivery)
        self.assertIsNotNone(whatsapp_delivery)

        self.assertEqual(in_app_delivery.status, NotificationDeliveryStatus.SENT)
        self.assertEqual(whatsapp_delivery.status, NotificationDeliveryStatus.SENT)
        self.assertEqual(whatsapp_delivery.destination, "+966500000001")
        self.assertEqual(whatsapp_delivery.notification, n)
        self.assertEqual(whatsapp_delivery.provider_name, "whatsapp_center")
        self.assertEqual(whatsapp_delivery.provider_message_id, "wamid.test.123")
        self.assertEqual(whatsapp_delivery.attempts, 1)

        mock_send_whatsapp.assert_called_once()

    @override_settings(WHATSAPP_NOTIFICATIONS_ENABLED=False)
    def test_create_notification_with_whatsapp_disabled_marks_delivery_failed(self):
        n = create_notification(
            recipient=self.user,
            title="WhatsApp Disabled",
            message="Body",
            notification_type="system",
            send_whatsapp=True,
            whatsapp_phone="+966500000001",
        )

        self.assertIsNotNone(n)
        self.assertEqual(Notification.objects.count(), 1)
        self.assertEqual(NotificationEvent.objects.count(), 1)
        self.assertEqual(NotificationDelivery.objects.count(), 2)

        event = NotificationEvent.objects.first()
        whatsapp_delivery = NotificationDelivery.objects.filter(
            event=event,
            channel=NotificationChannel.WHATSAPP,
        ).first()

        self.assertIsNotNone(event)
        self.assertIsNotNone(whatsapp_delivery)
        self.assertEqual(event.status, NotificationEventStatus.PARTIAL)
        self.assertEqual(whatsapp_delivery.status, NotificationDeliveryStatus.FAILED)
        self.assertEqual(whatsapp_delivery.attempts, 1)
        self.assertEqual(whatsapp_delivery.error_message, "WHATSAPP_NOTIFICATIONS_DISABLED")

    def test_create_notification_without_recipient_returns_none(self):
        n = create_notification(
            recipient=None,
            title="T",
            message="M",
            notification_type="system",
        )

        self.assertIsNone(n)
        self.assertEqual(Notification.objects.count(), 0)
        self.assertEqual(NotificationEvent.objects.count(), 0)
        self.assertEqual(NotificationDelivery.objects.count(), 0)

    def test_create_notification_empty_title_and_message_returns_none(self):
        n = create_notification(
            recipient=self.user,
            title="",
            message="",
            notification_type="system",
        )

        self.assertIsNone(n)
        self.assertEqual(Notification.objects.count(), 0)
        self.assertEqual(NotificationEvent.objects.count(), 0)
        self.assertEqual(NotificationDelivery.objects.count(), 0)

    def test_mark_notification_as_read(self):
        n = create_notification(
            recipient=self.user,
            title="Read Test",
            message="Read Body",
            notification_type="system",
        )

        self.assertIsNotNone(n)
        self.assertFalse(n.is_read)
        self.assertIsNone(n.read_at)

        n.mark_as_read()
        n.refresh_from_db()

        self.assertTrue(n.is_read)
        self.assertIsNotNone(n.read_at)

    @override_settings(
        FRONTEND_BASE_URL="",
        FRONTEND_URL="",
        NEXT_PUBLIC_APP_URL="",
    )
    def test_relative_link_does_not_force_localhost(self):
        invoice = SimpleNamespace(
            id=501,
            pk=501,
            invoice_number="INV-5001",
            total_amount="100.00",
        )

        n = notify_invoice_issued(
            recipient=self.user,
            invoice=invoice,
        )

        self.assertIsNotNone(n)
        self.assertEqual(n.link, "/system/invoices/501")


class PrimeyCareDomainNotificationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="primey_user",
            password="123456",
            email="primey@example.com",
        )

    def test_notify_order_created(self):
        customer = SimpleNamespace(name="Mazen Customer")
        order = SimpleNamespace(
            id=101,
            pk=101,
            order_number="ORD-1001",
            customer=customer,
            total_amount="1500.00",
        )

        n = notify_order_created(
            recipient=self.user,
            order=order,
        )

        self.assertIsNotNone(n)
        self.assertEqual(n.notification_type, "order")
        self.assertEqual(n.severity, "success")
        self.assertEqual(n.link, "/system/orders/101")

        event = n.event
        self.assertEqual(event.event_code, "order_created")
        self.assertEqual(event.event_group, "orders")
        self.assertEqual(event.target_user, self.user)
        self.assertEqual(event.target_model, "SimpleNamespace")
        self.assertEqual(event.target_object_id, "101")
        self.assertEqual(event.context["order_id"], "101")
        self.assertEqual(event.context["order_number"], "ORD-1001")
        self.assertEqual(event.context["customer_name"], "Mazen Customer")
        self.assertEqual(event.context["total_amount"], "1,500.00 SAR")

    def test_notify_order_status_changed_confirmed(self):
        order = SimpleNamespace(
            id=102,
            pk=102,
            order_number="ORD-1002",
            status="confirmed",
        )

        n = notify_order_status_changed(
            recipient=self.user,
            order=order,
            status="confirmed",
        )

        self.assertIsNotNone(n)
        self.assertEqual(n.notification_type, "order")
        self.assertEqual(n.severity, "success")
        self.assertEqual(n.link, "/system/orders/102")
        self.assertEqual(n.event.event_code, "order_status_changed")
        self.assertEqual(n.event.event_group, "orders")
        self.assertEqual(n.event.context["status"], "confirmed")

    def test_notify_order_status_changed_cancelled(self):
        order = SimpleNamespace(
            id=103,
            pk=103,
            order_number="ORD-1003",
            status="cancelled",
        )

        n = notify_order_status_changed(
            recipient=self.user,
            order=order,
            status="cancelled",
        )

        self.assertIsNotNone(n)
        self.assertEqual(n.notification_type, "order")
        self.assertEqual(n.severity, "warning")
        self.assertEqual(n.event.event_code, "order_status_changed")
        self.assertEqual(n.event.context["status"], "cancelled")

    def test_notify_invoice_issued(self):
        invoice = SimpleNamespace(
            id=201,
            pk=201,
            invoice_number="INV-2001",
            total_amount="575.50",
        )

        n = notify_invoice_issued(
            recipient=self.user,
            invoice=invoice,
        )

        self.assertIsNotNone(n)
        self.assertEqual(n.notification_type, "invoice")
        self.assertEqual(n.severity, "success")
        self.assertEqual(n.link, "/system/invoices/201")
        self.assertEqual(n.event.event_code, "invoice_issued")
        self.assertEqual(n.event.event_group, "invoices")
        self.assertEqual(n.event.context["invoice_id"], "201")
        self.assertEqual(n.event.context["invoice_number"], "INV-2001")
        self.assertEqual(n.event.context["total_amount"], "575.50 SAR")

    def test_notify_invoice_paid(self):
        invoice = SimpleNamespace(
            id=202,
            pk=202,
            invoice_number="INV-2002",
            total_amount="700.00",
        )

        n = notify_invoice_paid(
            recipient=self.user,
            invoice=invoice,
        )

        self.assertIsNotNone(n)
        self.assertEqual(n.notification_type, "invoice")
        self.assertEqual(n.severity, "success")
        self.assertEqual(n.link, "/system/invoices/202")
        self.assertEqual(n.event.event_code, "invoice_paid")
        self.assertEqual(n.event.event_group, "invoices")
        self.assertEqual(n.event.context["invoice_id"], "202")
        self.assertEqual(n.event.context["invoice_number"], "INV-2002")
        self.assertEqual(n.event.context["total_amount"], "700.00 SAR")

    def test_notify_payment_confirmed(self):
        payment = SimpleNamespace(
            id=301,
            pk=301,
            payment_number="PAY-3001",
            amount="575.50",
        )

        n = notify_payment_confirmed(
            recipient=self.user,
            payment=payment,
        )

        self.assertIsNotNone(n)
        self.assertEqual(n.notification_type, "payment")
        self.assertEqual(n.severity, "success")
        self.assertEqual(n.link, "/system/payments/301")
        self.assertEqual(n.event.event_code, "payment_confirmed")
        self.assertEqual(n.event.event_group, "payments")
        self.assertEqual(n.event.context["payment_id"], "301")
        self.assertEqual(n.event.context["payment_reference"], "PAY-3001")
        self.assertEqual(n.event.context["paid_amount"], "575.50 SAR")

    def test_notify_agent_commission_registered(self):
        commission = SimpleNamespace(
            id=401,
            pk=401,
            commission_number="COM-4001",
            amount="80.00",
        )

        n = notify_agent_commission_registered(
            recipient=self.user,
            commission=commission,
        )

        self.assertIsNotNone(n)
        self.assertEqual(n.notification_type, "agent_commission")
        self.assertEqual(n.severity, "info")
        self.assertEqual(n.link, "/system/agents")
        self.assertEqual(n.event.event_code, "agent_commission_registered")
        self.assertEqual(n.event.event_group, "agents")
        self.assertEqual(n.event.context["commission_id"], "401")
        self.assertEqual(n.event.context["commission_reference"], "COM-4001")
        self.assertEqual(n.event.context["commission_amount"], "80.00 SAR")

    def test_notify_agent_commission_approved(self):
        commission = SimpleNamespace(
            id=402,
            pk=402,
            commission_number="COM-4002",
            amount="120.00",
        )

        n = notify_agent_commission_approved(
            recipient=self.user,
            commission=commission,
        )

        self.assertIsNotNone(n)
        self.assertEqual(n.notification_type, "agent_commission")
        self.assertEqual(n.severity, "success")
        self.assertEqual(n.link, "/system/agents")
        self.assertEqual(n.event.event_code, "agent_commission_approved")
        self.assertEqual(n.event.event_group, "agents")
        self.assertEqual(n.event.context["commission_id"], "402")
        self.assertEqual(n.event.context["commission_reference"], "COM-4002")
        self.assertEqual(n.event.context["commission_amount"], "120.00 SAR")