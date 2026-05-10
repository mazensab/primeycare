# ============================================================
# 📂 payment_gateways/models.py
# 🧠 Primey Care - Payment Gateways Models V2
# ------------------------------------------------------------
# ✅ نماذج عامة ومرنة لتكامل بوابات الدفع الخارجية
# ✅ مستقلة عن مسار onboarding القديم
# ✅ تدعم Tamara / Tap كبداية
# ✅ مناسبة للربط مع orders / invoices / payments
# ✅ تحفظ:
#    - إعدادات البوابة
#    - العمليات المحلية/البعيدة
#    - سجلات الـ webhook
# ✅ بدون إضافة حقول جديدة حتى لا نحتاج Migration الآن
# ============================================================

from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from urllib.parse import urlparse

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
# 🔧 Shared Helpers
# ============================================================

def _clean_str(value: object, default: str = "") -> str:
    if value is None:
        return default

    cleaned = str(value).strip()
    return cleaned if cleaned else default


def _money(value: object) -> Decimal:
    try:
        return Decimal(str(value or "0.00")).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0.00")


def _is_https_url(value: str) -> bool:
    cleaned = _clean_str(value)

    if not cleaned:
        return True

    parsed = urlparse(cleaned)

    return parsed.scheme == "https" and bool(parsed.netloc)


def _append_note(existing: str, note: str) -> str:
    existing = _clean_str(existing)
    note = _clean_str(note)

    if not note:
        return existing

    if not existing:
        return note

    if note in existing:
        return existing

    return f"{existing}\n{note}".strip()


# ============================================================
# 🏦 Payment Gateway Config
# ============================================================

class PaymentGatewayConfig(models.Model):
    """
    إعدادات كل بوابة دفع.

    مثال:
    - Tamara config
    - Tap config

    ملاحظة:
    provider حاليًا unique، وهذا مناسب لأن النظام يستخدم إعدادًا واحدًا لكل مزود.
    يمكن لاحقًا إزالة unique وإضافة company/config scope إذا احتجنا تعدد إعدادات.
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
        provider = _clean_str(self.provider).upper()

        if self.timeout_seconds <= 0:
            raise ValidationError({"timeout_seconds": "Timeout must be greater than zero."})

        if self.environment not in PaymentGatewayEnvironment.values:
            raise ValidationError({"environment": "Invalid gateway environment."})

        if self.base_url and not _is_https_url(self.base_url):
            raise ValidationError({"base_url": "Base URL must use HTTPS."})

        if self.merchant_callback_url and not _is_https_url(self.merchant_callback_url):
            raise ValidationError({"merchant_callback_url": "Merchant callback URL must use HTTPS."})

        if provider == PaymentGatewayProvider.TAMARA:
            if not _clean_str(self.api_token):
                raise ValidationError({"api_token": "Tamara requires api_token."})

        if provider == PaymentGatewayProvider.TAP:
            if not _clean_str(self.secret_key):
                raise ValidationError({"secret_key": "Tap requires secret_key."})

        if self.extra_config is None:
            self.extra_config = {}

        if not isinstance(self.extra_config, dict):
            raise ValidationError({"extra_config": "Extra config must be a JSON object."})

    def save(self, *args, **kwargs):
        self.provider = _clean_str(self.provider).upper()
        self.display_name = _clean_str(self.display_name)
        self.environment = _clean_str(
            self.environment,
            PaymentGatewayEnvironment.SANDBOX,
        ).lower()

        self.base_url = _clean_str(self.base_url)
        self.api_token = _clean_str(self.api_token)
        self.secret_key = _clean_str(self.secret_key)
        self.public_key = _clean_str(self.public_key)
        self.merchant_id = _clean_str(self.merchant_id)
        self.source_id = _clean_str(self.source_id)
        self.notification_token = _clean_str(self.notification_token)
        self.webhook_secret = _clean_str(self.webhook_secret)
        self.merchant_callback_url = _clean_str(self.merchant_callback_url)
        self.notes = _clean_str(self.notes)

        if self.extra_config is None:
            self.extra_config = {}

        self.full_clean()
        return super().save(*args, **kwargs)

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

    @property
    def has_credentials(self) -> bool:
        if self.provider == PaymentGatewayProvider.TAMARA:
            return bool(_clean_str(self.api_token))

        if self.provider == PaymentGatewayProvider.TAP:
            return bool(_clean_str(self.secret_key))

        return False

    @staticmethod
    def _mask_secret(value: str) -> str:
        value = _clean_str(value)

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
    تمثل أي عملية دفع / checkout / charge / order على بوابة خارجية.

    الربط المرن:
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

    def clean(self) -> None:
        if self.provider and self.provider not in PaymentGatewayProvider.values:
            raise ValidationError({"provider": "Invalid payment gateway provider."})

        if self.status and self.status not in PaymentGatewayTransactionStatus.values:
            raise ValidationError({"status": "Invalid payment gateway transaction status."})

        if _money(self.amount) < Decimal("0.00"):
            raise ValidationError({"amount": "Amount cannot be negative."})

        if self.currency and len(_clean_str(self.currency)) > 10:
            raise ValidationError({"currency": "Currency value is too long."})

        if self.payment_url and not _is_https_url(self.payment_url):
            raise ValidationError({"payment_url": "Payment URL must use HTTPS."})

        if self.redirect_url and not _is_https_url(self.redirect_url):
            raise ValidationError({"redirect_url": "Redirect URL must use HTTPS."})

        if self.request_payload is None:
            self.request_payload = {}

        if self.response_payload is None:
            self.response_payload = {}

        if self.latest_webhook_payload is None:
            self.latest_webhook_payload = {}

        if not isinstance(self.request_payload, dict):
            raise ValidationError({"request_payload": "Request payload must be a JSON object."})

        if not isinstance(self.response_payload, dict):
            raise ValidationError({"response_payload": "Response payload must be a JSON object."})

        if not isinstance(self.latest_webhook_payload, dict):
            raise ValidationError({"latest_webhook_payload": "Latest webhook payload must be a JSON object."})

    def save(self, *args, **kwargs):
        self.provider = _clean_str(self.provider).upper()
        self.status = _clean_str(self.status, PaymentGatewayTransactionStatus.PENDING).upper()
        self.gateway_status = _clean_str(self.gateway_status)
        self.payment_method = _clean_str(self.payment_method).upper()
        self.currency = _clean_str(self.currency, "SAR").upper()

        self.local_reference_type = _clean_str(self.local_reference_type).upper()
        self.local_reference_id = _clean_str(self.local_reference_id)
        self.local_reference = _clean_str(self.local_reference)

        self.customer_name = _clean_str(self.customer_name)
        self.customer_email = _clean_str(self.customer_email).lower()
        self.customer_phone = _clean_str(self.customer_phone)

        self.remote_transaction_id = _clean_str(self.remote_transaction_id)
        self.remote_order_id = _clean_str(self.remote_order_id)
        self.remote_checkout_id = _clean_str(self.remote_checkout_id)
        self.gateway_reference = _clean_str(self.gateway_reference)

        self.payment_url = _clean_str(self.payment_url)
        self.redirect_url = _clean_str(self.redirect_url)
        self.notes = _clean_str(self.notes)
        self.error_message = _clean_str(self.error_message)

        self.amount = _money(self.amount)

        if self.request_payload is None:
            self.request_payload = {}

        if self.response_payload is None:
            self.response_payload = {}

        if self.latest_webhook_payload is None:
            self.latest_webhook_payload = {}

        self.full_clean()
        return super().save(*args, **kwargs)

    @property
    def is_success(self) -> bool:
        return self.status == PaymentGatewayTransactionStatus.SUCCESS

    @property
    def is_failed(self) -> bool:
        return self.status == PaymentGatewayTransactionStatus.FAILED

    @property
    def is_cancelled(self) -> bool:
        return self.status == PaymentGatewayTransactionStatus.CANCELLED

    @property
    def is_refunded(self) -> bool:
        return self.status == PaymentGatewayTransactionStatus.REFUNDED

    @property
    def is_pending(self) -> bool:
        return self.status in {
            PaymentGatewayTransactionStatus.PENDING,
            PaymentGatewayTransactionStatus.INITIATED,
            PaymentGatewayTransactionStatus.PROCESSING,
            PaymentGatewayTransactionStatus.REQUIRES_ACTION,
        }

    @property
    def is_final(self) -> bool:
        return self.status in {
            PaymentGatewayTransactionStatus.SUCCESS,
            PaymentGatewayTransactionStatus.FAILED,
            PaymentGatewayTransactionStatus.CANCELLED,
            PaymentGatewayTransactionStatus.REFUNDED,
            PaymentGatewayTransactionStatus.EXPIRED,
        }

    @property
    def remote_reference(self) -> str:
        return (
            self.remote_transaction_id
            or self.remote_order_id
            or self.remote_checkout_id
            or self.gateway_reference
            or ""
        )

    @property
    def local_reference_key(self) -> str:
        if self.local_reference:
            return self.local_reference

        if self.local_reference_type or self.local_reference_id:
            return f"{self.local_reference_type}:{self.local_reference_id}".strip(":")

        return ""

    def mark_success(
        self,
        *,
        gateway_status: str = "",
        webhook_payload: dict | None = None,
        response_payload: dict | None = None,
        note: str = "",
        webhook_verified: bool = True,
    ) -> None:
        now = timezone.now()

        self.status = PaymentGatewayTransactionStatus.SUCCESS
        self.gateway_status = _clean_str(gateway_status) or self.gateway_status
        self.is_webhook_verified = bool(webhook_verified)
        self.last_webhook_at = now
        self.paid_at = self.paid_at or now
        self.error_message = ""

        if webhook_payload is not None:
            self.latest_webhook_payload = webhook_payload

        if response_payload is not None:
            self.response_payload = response_payload

        self.notes = _append_note(self.notes, note)

        self.save(
            update_fields=[
                "status",
                "gateway_status",
                "is_webhook_verified",
                "last_webhook_at",
                "paid_at",
                "latest_webhook_payload",
                "response_payload",
                "notes",
                "error_message",
                "updated_at",
            ]
        )

    def mark_failed(
        self,
        *,
        gateway_status: str = "",
        error_message: str = "",
        webhook_payload: dict | None = None,
        response_payload: dict | None = None,
        note: str = "",
    ) -> None:
        self.status = PaymentGatewayTransactionStatus.FAILED
        self.gateway_status = _clean_str(gateway_status) or self.gateway_status
        self.error_message = _clean_str(error_message) or self.error_message
        self.last_webhook_at = timezone.now()

        if webhook_payload is not None:
            self.latest_webhook_payload = webhook_payload

        if response_payload is not None:
            self.response_payload = response_payload

        self.notes = _append_note(self.notes, note)

        self.save(
            update_fields=[
                "status",
                "gateway_status",
                "error_message",
                "last_webhook_at",
                "latest_webhook_payload",
                "response_payload",
                "notes",
                "updated_at",
            ]
        )

    def mark_cancelled(
        self,
        *,
        gateway_status: str = "",
        webhook_payload: dict | None = None,
        response_payload: dict | None = None,
        note: str = "",
    ) -> None:
        self.status = PaymentGatewayTransactionStatus.CANCELLED
        self.gateway_status = _clean_str(gateway_status) or self.gateway_status
        self.last_webhook_at = timezone.now()

        if webhook_payload is not None:
            self.latest_webhook_payload = webhook_payload

        if response_payload is not None:
            self.response_payload = response_payload

        self.notes = _append_note(self.notes, note)

        self.save(
            update_fields=[
                "status",
                "gateway_status",
                "last_webhook_at",
                "latest_webhook_payload",
                "response_payload",
                "notes",
                "updated_at",
            ]
        )

    def mark_refunded(
        self,
        *,
        gateway_status: str = "",
        webhook_payload: dict | None = None,
        response_payload: dict | None = None,
        note: str = "",
    ) -> None:
        self.status = PaymentGatewayTransactionStatus.REFUNDED
        self.gateway_status = _clean_str(gateway_status) or self.gateway_status
        self.last_webhook_at = timezone.now()

        if webhook_payload is not None:
            self.latest_webhook_payload = webhook_payload

        if response_payload is not None:
            self.response_payload = response_payload

        self.notes = _append_note(self.notes, note)

        self.save(
            update_fields=[
                "status",
                "gateway_status",
                "last_webhook_at",
                "latest_webhook_payload",
                "response_payload",
                "notes",
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

    def clean(self) -> None:
        if self.provider and self.provider not in PaymentGatewayProvider.values:
            raise ValidationError({"provider": "Invalid payment gateway provider."})

        if self.status and self.status not in PaymentGatewayWebhookStatus.values:
            raise ValidationError({"status": "Invalid webhook status."})

        if self.headers is None:
            self.headers = {}

        if self.payload is None:
            self.payload = {}

        if self.processing_result is None:
            self.processing_result = {}

        if not isinstance(self.headers, dict):
            raise ValidationError({"headers": "Headers must be a JSON object."})

        if not isinstance(self.payload, dict):
            raise ValidationError({"payload": "Payload must be a JSON object."})

        if not isinstance(self.processing_result, dict):
            raise ValidationError({"processing_result": "Processing result must be a JSON object."})

    def save(self, *args, **kwargs):
        self.provider = _clean_str(self.provider).upper()
        self.status = _clean_str(self.status, PaymentGatewayWebhookStatus.RECEIVED).upper()
        self.event_type = _clean_str(self.event_type)
        self.remote_transaction_id = _clean_str(self.remote_transaction_id)
        self.remote_order_id = _clean_str(self.remote_order_id)
        self.remote_checkout_id = _clean_str(self.remote_checkout_id)
        self.error_message = _clean_str(self.error_message)
        self.notes = _clean_str(self.notes)

        if self.headers is None:
            self.headers = {}

        if self.payload is None:
            self.payload = {}

        if self.processing_result is None:
            self.processing_result = {}

        self.full_clean()
        return super().save(*args, **kwargs)

    @property
    def is_processed(self) -> bool:
        return self.status == PaymentGatewayWebhookStatus.PROCESSED

    @property
    def is_failed(self) -> bool:
        return self.status == PaymentGatewayWebhookStatus.FAILED

    @property
    def is_rejected(self) -> bool:
        return self.status == PaymentGatewayWebhookStatus.REJECTED

    def mark_verified(self, result: dict | None = None) -> None:
        self.status = PaymentGatewayWebhookStatus.VERIFIED
        self.signature_valid = True

        if result is not None:
            self.processing_result = result

        self.save(
            update_fields=[
                "status",
                "signature_valid",
                "processing_result",
            ]
        )

    def mark_rejected(self, error_message: str = "", result: dict | None = None) -> None:
        self.status = PaymentGatewayWebhookStatus.REJECTED
        self.signature_valid = False
        self.processed_at = timezone.now()
        self.error_message = _clean_str(error_message)

        if result is not None:
            self.processing_result = result

        self.save(
            update_fields=[
                "status",
                "signature_valid",
                "processed_at",
                "error_message",
                "processing_result",
            ]
        )

    def mark_processed(self, result: dict | None = None) -> None:
        self.status = PaymentGatewayWebhookStatus.PROCESSED
        self.processed_at = timezone.now()

        if result is not None:
            self.processing_result = result

        self.save(
            update_fields=[
                "status",
                "processed_at",
                "processing_result",
            ]
        )

    def mark_failed(self, error_message: str = "", result: dict | None = None) -> None:
        self.status = PaymentGatewayWebhookStatus.FAILED
        self.processed_at = timezone.now()
        self.error_message = _clean_str(error_message)

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