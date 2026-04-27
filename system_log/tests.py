from django.contrib.auth import get_user_model
from django.test import TestCase

from system_log.models import SystemLog

User = get_user_model()


class SystemLogModelTests(TestCase):
    def test_create_system_log_without_company_reference(self):
        user = User.objects.create_user(username="tester1", password="12345678")

        log = SystemLog.objects.create(
            scope_type="SYSTEM",
            company_reference="",
            company_name="",
            user=user,
            module="whatsapp",
            action="send_test",
            event_code="system_test",
            severity="info",
            message="System log created successfully",
        )

        self.assertIsNotNone(log.id)
        self.assertEqual(log.scope_type, "SYSTEM")
        self.assertEqual(log.company_reference, "")
        self.assertEqual(log.module, "whatsapp")

    def test_create_company_scoped_log(self):
        log = SystemLog.objects.create(
            scope_type="COMPANY",
            company_reference="COMP-001",
            company_name="Primey Care Demo",
            module="payments",
            action="confirm",
            event_code="payment_confirmed",
            severity="warning",
            message="Payment confirmation log",
            status_code=200,
        )

        self.assertIsNotNone(log.id)
        self.assertEqual(log.scope_type, "COMPANY")
        self.assertEqual(log.company_reference, "COMP-001")
        self.assertEqual(log.company_name, "Primey Care Demo")
        self.assertEqual(log.status_code, 200)