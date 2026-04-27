# ============================================================
# 📂 payment_gateways/models.py
# 🧠 Primey Care - Payment Gateways Models
# ------------------------------------------------------------
# ✅ نماذج عامة ومرنة لتكامل بوابات الدفع الخارجية
# ✅ مستقلة عن مسار onboarding القديم
# ✅ تدعم Tamara / Tap كبداية
# ✅ مناسبة للربط لاحقًا مع orders / invoices / payments
# ✅ تحفظ:
#    - إعدادات البوابة
#    - العمليات المحلية/البعيدة
#    - سجلات الـ webhook
# ------------------------------------------------------------
# ملاحظات:
# - هذا التصميم عام وقابل للتوسع
# - لا يفرض ارتباطًا مباشرًا بموديل Invoice أو Order الآن
# - يستخدم local_reference_type + local_reference_id بشكل مرن
# ============================================================

from __future__ import annotations

from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


# ============================================================
# 🎯 Choices
# ============================================================

class PaymentGatewayProvider(models.TextChoices):
    TAMARA = "TAMARA", "Tamara"
    TAP = "TAP", "Tap"


class PaymentGatewayEnvironment(models.TextChoices):
    SANDBOX = "sandbox", "Sandbox"
    PRODUCTION = "production", "Production"


class PaymentGatewayTransactionStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    INITIATED = "INITIATED", "Initiated"
    PROCESSING = "PROCESSING", "Processing"
    REQUIRES_ACTION = "REQUIRES_ACTION", "Requires Action"
    SUCCESS = "SUCCESS", "Success"
    FAILED = "FAILED", "Failed"
    CANCELLED = "CANCELLED", "Cancelled"
    REFUNDED = "REFUNDED", "Refunded"
    EXPIRED = "EXPIRED", "Expired"


class PaymentGatewayWebhookStatus(models.TextChoices):
    RECEIVED = "RECEIVED", "Received"
    VERIFIED = "VERIFIED", "Verified"
    REJECTED = "REJECTED", "Rejected"
    PROCESSED = "PROCESSED", "Processed"
    FAILED = "FAILED", "Failed"


# ============================================================
# 🏦 Payment Gateway Config
# ============================================================

class PaymentGatewayConfig(models.Model):
    """
    إعدادات كل بوابة دفع.

    مثال:
    - Tamara واحد
    - Tap واحد

    ويمكن لاحقًا التوسع إن احتجنا أكثر من config لكل مزود.
    """

    provider = models.CharField(
        max_length=20,
        choices=PaymentGatewayProvider.choices,
        unique=True,
        verbose_name="مزود البوابة",
    )
    display_name = models.CharField(
        max_length=150,
        blank=True,
        default="",
        verbose_name="الاسم الظاهر",
    )
    environment = models.CharField(
        max_length=20,
        choices=PaymentGatewayEnvironment.choices,
        default=PaymentGatewayEnvironment.SANDBOX,
        verbose_name="البيئة",
    )

    is_enabled = models.BooleanField(
        default=False,
        verbose_name="مفعلة",
    )
    is_default = models.BooleanField(
        default=False,
        verbose_name="الافتراضية",
        help_text="تستخدم لاحقًا عند وجود أكثر من بوابة مفعلة.",
    )

    # --------------------------------------------
    # بيانات الاتصال العامة
    # --------------------------------------------
    base_url = models.URLField(
        blank=True,
        default="",
        verbose_name="Base URL",
    )
    timeout_seconds = models.PositiveIntegerField(
        default=30,
        verbose_name="مهلة الطلب بالثواني",
    )
    verify_webhook = models.BooleanField(
        default=True,
        verbose_name="التحقق من webhook",
    )

    # --------------------------------------------
    # مفاتيح عامة/خاصة حسب نوع البوابة
    # --------------------------------------------
    api_token = models.TextField(
        blank=True,
        default="",
        verbose_name="API Token",
    )
    secret_key = models.TextField(
        blank=True,
        default="",
        verbose_name="Secret Key",
    )
    public_key = models.TextField(
        blank=True,
        default="",
        verbose_name="Public Key",
    )
    merchant_id = models.CharField(
        max_length=255,
        blank=True,
        default="",
        verbose_name="Merchant ID",
    )
    source_id = models.CharField(
        max_length=255,
        blank=True,
        default="",
        verbose_name="Source ID",
    )
    notification_token = models.TextField(
        blank=True,
        default="",
        verbose_name="Notification Token",
    )
    webhook_secret = models.TextField(
        blank=True,
        default="",
        verbose_name="Webhook Secret",
    )
    merchant_callback_url = models.URLField(
        blank=True,
        default="",
        verbose_name="Merchant Callback URL",
    )

    # --------------------------------------------
    # إعدادات إضافية مرنة
    # --------------------------------------------
    extra_config = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="إعدادات إضافية",
    )
    notes = models.TextField(
        blank=True,
        default="",
        verbose_name="ملاحظات",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="تاريخ الإنشاء",
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="آخر تحديث",
    )

    class Meta:
        verbose_name = "Payment Gateway Config"
        verbose_name_plural = "Payment Gateway Configs"
        ordering = ["provider"]

    def __str__(self) -> str:
        return self.display_name or self.get_provider_display()

    def clean(self) -> None:
        if self.timeout_seconds <= 0:
            raise ValidationError({"timeout_seconds": "Timeout must be greater than zero."})

        provider = (self.provider or "").upper()

        if provider == PaymentGatewayProvider.TAMARA:
            if not self.api_token.strip():
                raise ValidationError({"api_token": "Tamara requires api_token."})

        if provider == PaymentGatewayProvider.TAP:
            if not self.secret_key.strip():
                raise ValidationError({"secret_key": "Tap requires secret_key."})

    @property
    def masked_api_token(self) -> str:
        return self._mask_secret(self.api_token)

    @property
    def masked_secret_key(self) -> str:
        return self._mask_secret(self.secret_key)

    @property
    def masked_public_key(self) -> str:
        return self._mask_secret(self.public_key)

    @property
    def masked_notification_token(self) -> str:
        return self._mask_secret(self.notification_token)

    @staticmethod
    def _mask_secret(value: str) -> str:
        value = (value or "").strip()
        if not value:
            return ""
        if len(value) <= 8:
            return "*" * len(value)
        return f"{value[:4]}{'*' * (len(value) - 8)}{value[-4:]}"


# ============================================================
# 💳 Payment Gateway Transaction
# ============================================================

class PaymentGatewayTransaction(models.Model):
    """
    تمثل أي عملية دفع/checkout/charge/order على بوابة خارجية.

    ربط مرن:
    - local_reference_type: INVOICE / ORDER / PAYMENT / MANUAL / ...
    - local_reference_id: رقم السجل المحلي
    - local_reference: مرجع نصي واضح مثل INV-1001
    """

    provider = models.CharField(
        max_length=20,
        choices=PaymentGatewayProvider.choices,
        db_index=True,
        verbose_name="مزود البوابة",
    )
    status = models.CharField(
        max_length=30,
        choices=PaymentGatewayTransactionStatus.choices,
        default=PaymentGatewayTransactionStatus.PENDING,
        db_index=True,
        verbose_name="الحالة المحلية",
    )
    gateway_status = models.CharField(
        max_length=100,
        blank=True,
        default="",
        db_index=True,
        verbose_name="حالة البوابة",
    )

    payment_method = models.CharField(
        max_length=50,
        blank=True,
        default="",
        verbose_name="طريقة الدفع",
    )
    currency = models.CharField(
        max_length=10,
        default="SAR",
        verbose_name="العملة",
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="المبلغ",
    )

    local_reference_type = models.CharField(
        max_length=50,
        blank=True,
        default="",
        db_index=True,
        verbose_name="نوع المرجع المحلي",
    )
    local_reference_id = models.CharField(
        max_length=100,
        blank=True,
        default="",
        db_index=True,
        verbose_name="رقم المرجع المحلي",
    )
    local_reference = models.CharField(
        max_length=255,
        blank=True,
        default="",
        db_index=True,
        verbose_name="المرجع المحلي",
    )

    customer_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        verbose_name="اسم العميل",
    )
    customer_email = models.EmailField(
        blank=True,
        default="",
        verbose_name="بريد العميل",
    )
    customer_phone = models.CharField(
        max_length=50,
        blank=True,
        default="",
        verbose_name="جوال العميل",
    )

    remote_transaction_id = models.CharField(
        max_length=255,
        blank=True,
        default="",
        db_index=True,
        verbose_name="Remote Transaction ID",
    )
    remote_order_id = models.CharField(
        max_length=255,
        blank=True,
        default="",
        db_index=True,
        verbose_name="Remote Order ID",
    )
    remote_checkout_id = models.CharField(
        max_length=255,
        blank=True,
        default="",
        db_index=True,
        verbose_name="Remote Checkout ID",
    )
    gateway_reference = models.CharField(
        max_length=255,
        blank=True,
        default="",
        db_index=True,
        verbose_name="Gateway Reference",
    )

    payment_url = models.URLField(
        blank=True,
        default="",
        verbose_name="رابط الدفع",
    )
    redirect_url = models.URLField(
        blank=True,
        default="",
        verbose_name="رابط الإرجاع",
    )

    is_webhook_verified = models.BooleanField(
        default=False,
        verbose_name="تم التحقق من webhook",
    )
    last_webhook_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="آخر webhook",
    )
    paid_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ السداد",
    )

    request_payload = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Payload الطلب",
    )
    response_payload = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Payload الاستجابة",
    )
    latest_webhook_payload = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="آخر Webhook Payload",
    )

    notes = models.TextField(
        blank=True,
        default="",
        verbose_name="ملاحظات",
    )
    error_message = models.TextField(
        blank=True,
        default="",
        verbose_name="رسالة الخطأ",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="تاريخ الإنشاء",
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="آخر تحديث",
    )

    class Meta:
        verbose_name = "Payment Gateway Transaction"
        verbose_name_plural = "Payment Gateway Transactions"
        ordering = ["-id"]
        indexes = [
            models.Index(fields=["provider", "status"]),
            models.Index(fields=["provider", "remote_transaction_id"]),
            models.Index(fields=["provider", "remote_order_id"]),
            models.Index(fields=["provider", "local_reference_type", "local_reference_id"]),
        ]

    def __str__(self) -> str:
        reference = self.local_reference or f"{self.local_reference_type}:{self.local_reference_id}"
        remote = self.remote_transaction_id or self.remote_order_id or self.remote_checkout_id
        return f"{self.provider} | {reference or '-'} | {remote or '-'}"

    @property
    def is_success(self) -> bool:
        return self.status == PaymentGatewayTransactionStatus.SUCCESS

    @property
    def is_final(self) -> bool:
        return self.status in {
            PaymentGatewayTransactionStatus.SUCCESS,
            PaymentGatewayTransactionStatus.FAILED,
            PaymentGatewayTransactionStatus.CANCELLED,
            PaymentGatewayTransactionStatus.REFUNDED,
            PaymentGatewayTransactionStatus.EXPIRED,
        }

    def mark_success(
        self,
        *,
        gateway_status: str = "",
        webhook_payload: dict | None = None,
    ) -> None:
        self.status = PaymentGatewayTransactionStatus.SUCCESS
        self.gateway_status = (gateway_status or self.gateway_status or "").strip()
        self.is_webhook_verified = True
        self.last_webhook_at = timezone.now()
        self.paid_at = self.paid_at or timezone.now()

        if webhook_payload:
            self.latest_webhook_payload = webhook_payload

        self.save(
            update_fields=[
                "status",
                "gateway_status",
                "is_webhook_verified",
                "last_webhook_at",
                "paid_at",
                "latest_webhook_payload",
                "updated_at",
            ]
        )

    def mark_failed(
        self,
        *,
        gateway_status: str = "",
        error_message: str = "",
        webhook_payload: dict | None = None,
    ) -> None:
        self.status = PaymentGatewayTransactionStatus.FAILED
        self.gateway_status = (gateway_status or self.gateway_status or "").strip()
        self.error_message = (error_message or self.error_message or "").strip()
        self.last_webhook_at = timezone.now()

        if webhook_payload:
            self.latest_webhook_payload = webhook_payload

        self.save(
            update_fields=[
                "status",
                "gateway_status",
                "error_message",
                "last_webhook_at",
                "latest_webhook_payload",
                "updated_at",
            ]
        )


# ============================================================
# 🪝 Payment Gateway Webhook Log
# ============================================================

class PaymentGatewayWebhookLog(models.Model):
    """
    سجل كامل للـ webhook الواردة من مزودات الدفع.
    """

    provider = models.CharField(
        max_length=20,
        choices=PaymentGatewayProvider.choices,
        db_index=True,
        verbose_name="مزود البوابة",
    )
    status = models.CharField(
        max_length=20,
        choices=PaymentGatewayWebhookStatus.choices,
        default=PaymentGatewayWebhookStatus.RECEIVED,
        db_index=True,
        verbose_name="حالة السجل",
    )
    event_type = models.CharField(
        max_length=150,
        blank=True,
        default="",
        db_index=True,
        verbose_name="نوع الحدث",
    )

    transaction = models.ForeignKey(
        PaymentGatewayTransaction,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="webhook_logs",
        verbose_name="العملية المرتبطة",
    )

    signature_valid = models.BooleanField(
        default=False,
        verbose_name="التوقيع صحيح",
    )
    remote_transaction_id = models.CharField(
        max_length=255,
        blank=True,
        default="",
        db_index=True,
        verbose_name="Remote Transaction ID",
    )
    remote_order_id = models.CharField(
        max_length=255,
        blank=True,
        default="",
        db_index=True,
        verbose_name="Remote Order ID",
    )
    remote_checkout_id = models.CharField(
        max_length=255,
        blank=True,
        default="",
        db_index=True,
        verbose_name="Remote Checkout ID",
    )

    headers = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Headers",
    )
    payload = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Payload",
    )
    processing_result = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="نتيجة المعالجة",
    )

    error_message = models.TextField(
        blank=True,
        default="",
        verbose_name="رسالة الخطأ",
    )
    notes = models.TextField(
        blank=True,
        default="",
        verbose_name="ملاحظات",
    )

    received_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="وقت الاستلام",
    )
    processed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="وقت المعالجة",
    )

    class Meta:
        verbose_name = "Payment Gateway Webhook Log"
        verbose_name_plural = "Payment Gateway Webhook Logs"
        ordering = ["-id"]
        indexes = [
            models.Index(fields=["provider", "status"]),
            models.Index(fields=["provider", "event_type"]),
            models.Index(fields=["provider", "remote_transaction_id"]),
            models.Index(fields=["provider", "remote_order_id"]),
        ]

    def __str__(self) -> str:
        return f"{self.provider} | {self.event_type or 'webhook'} | {self.status}"

    def mark_processed(self, result: dict | None = None) -> None:
        self.status = PaymentGatewayWebhookStatus.PROCESSED
        self.processed_at = timezone.now()
        if result is not None:
            self.processing_result = result

        self.save(update_fields=["status", "processed_at", "processing_result"])

    def mark_failed(self, error_message: str = "", result: dict | None = None) -> None:
        self.status = PaymentGatewayWebhookStatus.FAILED
        self.processed_at = timezone.now()
        self.error_message = (error_message or "").strip()

        if result is not None:
            self.processing_result = result

        self.save(
            update_fields=[
                "status",
                "processed_at",
                "error_message",
                "processing_result",
            ]
        )