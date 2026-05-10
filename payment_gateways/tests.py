# ============================================================
# 📂 payment_gateways/tests.py
# 🧠 Primey Care - Payment Gateways Tests V2
# ------------------------------------------------------------
# ✅ اختبار إعدادات بوابات الدفع
# ✅ اختبار عمليات PaymentGatewayTransaction
# ✅ اختبار Webhook Logs
# ✅ اختبار Services بدون اتصال خارجي فعلي
# ✅ اختبار Tamara Webhook
# ✅ اختبار Tap Webhook
# ✅ اختبار منع التكرار والبحث بالمراجع
# ============================================================

from __future__ import annotations

from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase

from payment_gateways.models import (
    PaymentGatewayConfig,
    PaymentGatewayEnvironment,
    PaymentGatewayProvider,
    PaymentGatewayTransaction,
    PaymentGatewayTransactionStatus,
    PaymentGatewayWebhookLog,
    PaymentGatewayWebhookStatus,
)
from payment_gateways.services import (
    PaymentGatewayValidationError,
    create_gateway_transaction,
    create_webhook_log,
    find_transaction_by_local_reference,
    find_transaction_by_remote_reference,
    handle_tamara_webhook,
    handle_tap_webhook,
    update_transaction_from_gateway_response,
    verify_tamara_webhook_token,
    verify_tap_hashstring,
)


# ============================================================
# Helpers
# ============================================================

def create_tamara_config(
    *,
    is_enabled: bool = True,
    verify_webhook: bool = True,
    notification_token: str = "tamara-test-token",
) -> PaymentGatewayConfig:
    return PaymentGatewayConfig.objects.create(
        provider=PaymentGatewayProvider.TAMARA,
        display_name="Tamara Test",
        environment=PaymentGatewayEnvironment.SANDBOX,
        is_enabled=is_enabled,
        is_default=True,
        api_token="tamara-api-token",
        notification_token=notification_token,
        verify_webhook=verify_webhook,
        base_url="https://api-sandbox.tamara.co",
        merchant_callback_url="https://primey.test/tamara/callback",
    )


def create_tap_config(
    *,
    is_enabled: bool = True,
    verify_webhook: bool = False,
) -> PaymentGatewayConfig:
    return PaymentGatewayConfig.objects.create(
        provider=PaymentGatewayProvider.TAP,
        display_name="Tap Test",
        environment=PaymentGatewayEnvironment.SANDBOX,
        is_enabled=is_enabled,
        is_default=True,
        secret_key="tap-secret-key",
        public_key="tap-public-key",
        source_id="src_all",
        verify_webhook=verify_webhook,
        base_url="https://api.tap.company/v2",
    )


def create_tamara_transaction(
    *,
    status: str = PaymentGatewayTransactionStatus.REQUIRES_ACTION,
    local_reference_type: str = "INVOICE",
    local_reference_id: str = "1",
    local_reference: str = "INV-TEST-1",
    remote_order_id: str = "tamara-order-1",
    remote_checkout_id: str = "tamara-checkout-1",
) -> PaymentGatewayTransaction:
    return create_gateway_transaction(
        provider=PaymentGatewayProvider.TAMARA,
        amount=Decimal("115.00"),
        currency="SAR",
        payment_method="TAMARA",
        local_reference_type=local_reference_type,
        local_reference_id=local_reference_id,
        local_reference=local_reference,
        customer_name="Mazen Test",
        customer_email="mazen@example.com",
        customer_phone="0500000000",
        remote_order_id=remote_order_id,
        remote_checkout_id=remote_checkout_id,
        gateway_reference=local_reference,
        status=status,
    )


def create_tap_transaction(
    *,
    status: str = PaymentGatewayTransactionStatus.REQUIRES_ACTION,
    local_reference_type: str = "INVOICE",
    local_reference_id: str = "1",
    local_reference: str = "INV-TAP-1",
    remote_transaction_id: str = "tap-charge-1",
) -> PaymentGatewayTransaction:
    return create_gateway_transaction(
        provider=PaymentGatewayProvider.TAP,
        amount=Decimal("115.00"),
        currency="SAR",
        payment_method="CREDIT_CARD",
        local_reference_type=local_reference_type,
        local_reference_id=local_reference_id,
        local_reference=local_reference,
        customer_name="Mazen Test",
        customer_email="mazen@example.com",
        customer_phone="0500000000",
        remote_transaction_id=remote_transaction_id,
        gateway_reference=local_reference,
        status=status,
    )


# ============================================================
# Config Tests
# ============================================================

class PaymentGatewayConfigTests(TestCase):
    def test_create_tamara_config_successfully(self):
        config = create_tamara_config()

        self.assertEqual(config.provider, PaymentGatewayProvider.TAMARA)
        self.assertTrue(config.is_enabled)
        self.assertTrue(config.has_credentials)
        self.assertIn("****", config.masked_api_token)

    def test_create_tap_config_successfully(self):
        config = create_tap_config()

        self.assertEqual(config.provider, PaymentGatewayProvider.TAP)
        self.assertTrue(config.is_enabled)
        self.assertTrue(config.has_credentials)
        self.assertIn("****", config.masked_secret_key)

    def test_tamara_config_requires_api_token(self):
        config = PaymentGatewayConfig(
            provider=PaymentGatewayProvider.TAMARA,
            display_name="Invalid Tamara",
            environment=PaymentGatewayEnvironment.SANDBOX,
            is_enabled=True,
            base_url="https://api-sandbox.tamara.co",
        )

        with self.assertRaises(ValidationError):
            config.full_clean()

    def test_tap_config_requires_secret_key(self):
        config = PaymentGatewayConfig(
            provider=PaymentGatewayProvider.TAP,
            display_name="Invalid Tap",
            environment=PaymentGatewayEnvironment.SANDBOX,
            is_enabled=True,
            base_url="https://api.tap.company/v2",
        )

        with self.assertRaises(ValidationError):
            config.full_clean()

    def test_config_rejects_non_https_base_url(self):
        config = PaymentGatewayConfig(
            provider=PaymentGatewayProvider.TAP,
            display_name="Invalid Tap URL",
            environment=PaymentGatewayEnvironment.SANDBOX,
            is_enabled=True,
            secret_key="tap-secret-key",
            base_url="http://api.tap.company/v2",
        )

        with self.assertRaises(ValidationError):
            config.full_clean()


# ============================================================
# Transaction Tests
# ============================================================

class PaymentGatewayTransactionTests(TestCase):
    def test_create_gateway_transaction_successfully(self):
        tx = create_tamara_transaction()

        self.assertEqual(tx.provider, PaymentGatewayProvider.TAMARA)
        self.assertEqual(tx.amount, Decimal("115.00"))
        self.assertEqual(tx.currency, "SAR")
        self.assertEqual(tx.local_reference_type, "INVOICE")
        self.assertEqual(tx.local_reference_id, "1")
        self.assertEqual(tx.local_reference, "INV-TEST-1")
        self.assertTrue(tx.is_pending)
        self.assertFalse(tx.is_final)

    def test_create_gateway_transaction_rejects_zero_amount(self):
        with self.assertRaises(PaymentGatewayValidationError):
            create_gateway_transaction(
                provider=PaymentGatewayProvider.TAMARA,
                amount=Decimal("0.00"),
                local_reference_type="INVOICE",
                local_reference_id="1",
                local_reference="INV-ZERO",
            )

    def test_transaction_mark_success(self):
        tx = create_tamara_transaction()

        tx.mark_success(
            gateway_status="PAID",
            webhook_payload={"status": "PAID"},
            note="Test success",
        )

        tx.refresh_from_db()

        self.assertEqual(tx.status, PaymentGatewayTransactionStatus.SUCCESS)
        self.assertEqual(tx.gateway_status, "PAID")
        self.assertTrue(tx.is_success)
        self.assertTrue(tx.is_final)
        self.assertTrue(tx.is_webhook_verified)
        self.assertIsNotNone(tx.paid_at)

    def test_transaction_mark_failed(self):
        tx = create_tamara_transaction()

        tx.mark_failed(
            gateway_status="FAILED",
            error_message="Payment declined",
            webhook_payload={"status": "FAILED"},
        )

        tx.refresh_from_db()

        self.assertEqual(tx.status, PaymentGatewayTransactionStatus.FAILED)
        self.assertTrue(tx.is_failed)
        self.assertTrue(tx.is_final)
        self.assertEqual(tx.error_message, "Payment declined")

    def test_transaction_mark_cancelled(self):
        tx = create_tamara_transaction()

        tx.mark_cancelled(gateway_status="CANCELLED")

        tx.refresh_from_db()

        self.assertEqual(tx.status, PaymentGatewayTransactionStatus.CANCELLED)
        self.assertTrue(tx.is_cancelled)
        self.assertTrue(tx.is_final)

    def test_transaction_mark_refunded(self):
        tx = create_tamara_transaction(status=PaymentGatewayTransactionStatus.SUCCESS)

        tx.mark_refunded(gateway_status="REFUNDED")

        tx.refresh_from_db()

        self.assertEqual(tx.status, PaymentGatewayTransactionStatus.REFUNDED)
        self.assertTrue(tx.is_refunded)
        self.assertTrue(tx.is_final)

    def test_update_transaction_from_gateway_response(self):
        tx = create_tamara_transaction(remote_order_id="")

        update_transaction_from_gateway_response(
            tx,
            payment_url="https://checkout.tamara.test/pay",
            remote_order_id="order-updated",
            remote_checkout_id="checkout-updated",
            gateway_status="CREATED",
            response_payload={"order_id": "order-updated"},
            status=PaymentGatewayTransactionStatus.REQUIRES_ACTION,
        )

        tx.refresh_from_db()

        self.assertEqual(tx.remote_order_id, "order-updated")
        self.assertEqual(tx.remote_checkout_id, "checkout-updated")
        self.assertEqual(tx.gateway_status, "CREATED")
        self.assertEqual(tx.payment_url, "https://checkout.tamara.test/pay")

    def test_find_transaction_by_remote_reference(self):
        tx = create_tamara_transaction(remote_order_id="remote-order-find")

        found = find_transaction_by_remote_reference(
            provider=PaymentGatewayProvider.TAMARA,
            remote_order_id="remote-order-find",
        )

        self.assertIsNotNone(found)
        self.assertEqual(found.pk, tx.pk)

    def test_find_transaction_by_local_reference(self):
        tx = create_tamara_transaction(local_reference="INV-LOCAL-FIND")

        found = find_transaction_by_local_reference(
            provider=PaymentGatewayProvider.TAMARA,
            local_reference="INV-LOCAL-FIND",
        )

        self.assertIsNotNone(found)
        self.assertEqual(found.pk, tx.pk)


# ============================================================
# Webhook Log Tests
# ============================================================

class PaymentGatewayWebhookLogTests(TestCase):
    def test_create_webhook_log_successfully(self):
        tx = create_tamara_transaction()

        log = create_webhook_log(
            provider=PaymentGatewayProvider.TAMARA,
            event_type="order_approved",
            status=PaymentGatewayWebhookStatus.RECEIVED,
            transaction_obj=tx,
            signature_valid=True,
            remote_order_id=tx.remote_order_id,
            payload={"status": "APPROVED"},
        )

        self.assertEqual(log.provider, PaymentGatewayProvider.TAMARA)
        self.assertEqual(log.transaction_id, tx.pk)
        self.assertEqual(log.status, PaymentGatewayWebhookStatus.RECEIVED)
        self.assertTrue(log.signature_valid)

    def test_webhook_log_mark_processed(self):
        log = create_webhook_log(
            provider=PaymentGatewayProvider.TAMARA,
            event_type="order_approved",
            payload={"status": "APPROVED"},
        )

        log.mark_processed({"success": True})

        log.refresh_from_db()

        self.assertEqual(log.status, PaymentGatewayWebhookStatus.PROCESSED)
        self.assertTrue(log.is_processed)
        self.assertIsNotNone(log.processed_at)

    def test_webhook_log_mark_failed(self):
        log = create_webhook_log(
            provider=PaymentGatewayProvider.TAP,
            event_type="charge",
            payload={"status": "FAILED"},
        )

        log.mark_failed("Invalid signature", {"success": False})

        log.refresh_from_db()

        self.assertEqual(log.status, PaymentGatewayWebhookStatus.FAILED)
        self.assertTrue(log.is_failed)
        self.assertEqual(log.error_message, "Invalid signature")
        self.assertIsNotNone(log.processed_at)

    def test_webhook_log_mark_rejected(self):
        log = create_webhook_log(
            provider=PaymentGatewayProvider.TAMARA,
            event_type="order_failed",
            payload={"status": "FAILED"},
        )

        log.mark_rejected("Invalid token", {"success": False})

        log.refresh_from_db()

        self.assertEqual(log.status, PaymentGatewayWebhookStatus.REJECTED)
        self.assertTrue(log.is_rejected)
        self.assertFalse(log.signature_valid)


# ============================================================
# Verification Tests
# ============================================================

class PaymentGatewayVerificationTests(TestCase):
    def test_verify_tamara_webhook_token_success(self):
        config = create_tamara_config(notification_token="secret-token")

        is_valid = verify_tamara_webhook_token(
            config=config,
            incoming_token="secret-token",
            request_body=b'{"status":"PAID"}',
        )

        self.assertTrue(is_valid)

    def test_verify_tamara_webhook_token_failure(self):
        config = create_tamara_config(notification_token="secret-token")

        is_valid = verify_tamara_webhook_token(
            config=config,
            incoming_token="wrong-token",
            request_body=b'{"status":"PAID"}',
        )

        self.assertFalse(is_valid)

    def test_verify_tamara_webhook_skip_when_disabled(self):
        config = create_tamara_config(
            verify_webhook=False,
            notification_token="secret-token",
        )

        is_valid = verify_tamara_webhook_token(
            config=config,
            incoming_token="wrong-token",
            request_body=b'{}',
        )

        self.assertTrue(is_valid)

    def test_verify_tap_hashstring_skip_when_disabled(self):
        config = create_tap_config(verify_webhook=False)

        is_valid = verify_tap_hashstring(
            config=config,
            header_hash="wrong-hash",
            payload={
                "id": "chg_1",
                "amount": "115.00",
                "currency": "SAR",
                "status": "CAPTURED",
            },
        )

        self.assertTrue(is_valid)


# ============================================================
# Tamara Webhook Handler Tests
# ============================================================

class TamaraWebhookHandlerTests(TestCase):
    def test_handle_tamara_webhook_success_with_matching_transaction(self):
        create_tamara_config(notification_token="tamara-test-token")
        tx = create_tamara_transaction(
            local_reference="INV-TAMARA-WEBHOOK",
            remote_order_id="tamara-order-webhook",
            remote_checkout_id="tamara-checkout-webhook",
        )

        result = handle_tamara_webhook(
            payload={
                "event_type": "order_approved",
                "order_id": "tamara-order-webhook",
                "checkout_id": "tamara-checkout-webhook",
                "order_reference_id": "INV-TAMARA-WEBHOOK",
                "status": "PAID",
            },
            headers={"tamaraToken": "tamara-test-token"},
            request_body=b'{"status":"PAID"}',
            incoming_token="tamara-test-token",
        )

        tx.refresh_from_db()

        self.assertTrue(result["success"])
        self.assertTrue(result["transaction_found"])
        self.assertEqual(result["transaction_id"], tx.pk)
        self.assertEqual(tx.status, PaymentGatewayTransactionStatus.SUCCESS)
        self.assertTrue(tx.is_webhook_verified)
        self.assertIsNotNone(tx.paid_at)

        log = PaymentGatewayWebhookLog.objects.filter(transaction=tx).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.status, PaymentGatewayWebhookStatus.PROCESSED)

    def test_handle_tamara_webhook_invalid_token(self):
        create_tamara_config(notification_token="valid-token")
        tx = create_tamara_transaction(
            local_reference="INV-TAMARA-INVALID",
            remote_order_id="tamara-order-invalid",
        )

        result = handle_tamara_webhook(
            payload={
                "event_type": "order_approved",
                "order_id": "tamara-order-invalid",
                "order_reference_id": "INV-TAMARA-INVALID",
                "status": "PAID",
            },
            headers={"tamaraToken": "wrong-token"},
            request_body=b'{"status":"PAID"}',
            incoming_token="wrong-token",
        )

        tx.refresh_from_db()

        self.assertFalse(result["success"])
        self.assertEqual(tx.status, PaymentGatewayTransactionStatus.REQUIRES_ACTION)

        log = PaymentGatewayWebhookLog.objects.filter(transaction=tx).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.status, PaymentGatewayWebhookStatus.FAILED)
        self.assertFalse(log.signature_valid)

    def test_handle_tamara_webhook_without_matching_transaction(self):
        create_tamara_config(notification_token="tamara-test-token")

        result = handle_tamara_webhook(
            payload={
                "event_type": "order_approved",
                "order_id": "unknown-order",
                "order_reference_id": "UNKNOWN-REFERENCE",
                "status": "PAID",
            },
            headers={"tamaraToken": "tamara-test-token"},
            request_body=b'{"status":"PAID"}',
            incoming_token="tamara-test-token",
        )

        self.assertTrue(result["success"])
        self.assertFalse(result["transaction_found"])
        self.assertIsNone(result["transaction_id"])

        log = PaymentGatewayWebhookLog.objects.first()
        self.assertIsNotNone(log)
        self.assertEqual(log.status, PaymentGatewayWebhookStatus.PROCESSED)


# ============================================================
# Tap Webhook Handler Tests
# ============================================================

class TapWebhookHandlerTests(TestCase):
    def test_handle_tap_webhook_success_with_matching_transaction(self):
        create_tap_config(verify_webhook=False)
        tx = create_tap_transaction(
            local_reference="INV-TAP-WEBHOOK",
            remote_transaction_id="tap-charge-webhook",
        )

        result = handle_tap_webhook(
            payload={
                "object": "charge",
                "id": "tap-charge-webhook",
                "status": "CAPTURED",
                "amount": "115.00",
                "currency": "SAR",
                "reference": {
                    "transaction": "INV-TAP-WEBHOOK",
                    "order": "INV-TAP-WEBHOOK",
                },
            },
            headers={"hashstring": "ignored"},
            header_hash="ignored",
        )

        tx.refresh_from_db()

        self.assertTrue(result["success"])
        self.assertTrue(result["transaction_found"])
        self.assertEqual(result["transaction_id"], tx.pk)
        self.assertEqual(tx.status, PaymentGatewayTransactionStatus.SUCCESS)
        self.assertTrue(tx.is_webhook_verified)
        self.assertIsNotNone(tx.paid_at)

        log = PaymentGatewayWebhookLog.objects.filter(transaction=tx).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.status, PaymentGatewayWebhookStatus.PROCESSED)

    def test_handle_tap_webhook_failed_status(self):
        create_tap_config(verify_webhook=False)
        tx = create_tap_transaction(
            local_reference="INV-TAP-FAILED",
            remote_transaction_id="tap-charge-failed",
        )

        result = handle_tap_webhook(
            payload={
                "object": "charge",
                "id": "tap-charge-failed",
                "status": "DECLINED",
                "amount": "115.00",
                "currency": "SAR",
                "reference": {
                    "transaction": "INV-TAP-FAILED",
                    "order": "INV-TAP-FAILED",
                },
            },
            headers={},
            header_hash="",
        )

        tx.refresh_from_db()

        self.assertTrue(result["success"])
        self.assertEqual(tx.status, PaymentGatewayTransactionStatus.FAILED)
        self.assertFalse(tx.is_success)

    def test_handle_tap_webhook_without_matching_transaction(self):
        create_tap_config(verify_webhook=False)

        result = handle_tap_webhook(
            payload={
                "object": "charge",
                "id": "unknown-charge",
                "status": "CAPTURED",
                "amount": "115.00",
                "currency": "SAR",
                "reference": {
                    "transaction": "UNKNOWN",
                    "order": "UNKNOWN",
                },
            },
            headers={},
            header_hash="",
        )

        self.assertTrue(result["success"])
        self.assertFalse(result["transaction_found"])
        self.assertIsNone(result["transaction_id"])

        log = PaymentGatewayWebhookLog.objects.first()
        self.assertIsNotNone(log)
        self.assertEqual(log.status, PaymentGatewayWebhookStatus.PROCESSED)