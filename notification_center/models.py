# ============================================================
# 📂 notification_center/models.py
# 🧠 Primey Care - Notification Center Models
# ------------------------------------------------------------
# ✅ مستقل عن company_manager
# ✅ مناسب لـ Primey Care
# ✅ يدعم:
#    - Notification
#    - NotificationEvent
#    - NotificationDelivery
# ✅ يدعم In-App + Email + WhatsApp
# ============================================================

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import models
from django.utils import timezone

User = get_user_model()


# ============================================================
# Enums
# ============================================================

class NotificationSeverity(models.TextChoices):
    INFO = "info", "Info"
    SUCCESS = "success", "Success"
    WARNING = "warning", "Warning"
    ERROR = "error", "Error"
    CRITICAL = "critical", "Critical"


class NotificationEventStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PROCESSED = "processed", "Processed"
    PARTIAL = "partial", "Partial"
    FAILED = "failed", "Failed"
    CANCELLED = "cancelled", "Cancelled"


class NotificationChannel(models.TextChoices):
    IN_APP = "in_app", "In-App"
    EMAIL = "email", "Email"
    WHATSAPP = "whatsapp", "WhatsApp"
    SMS = "sms", "SMS"
    PUSH = "push", "Push"


class NotificationDeliveryStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    SENT = "sent", "Sent"
    FAILED = "failed", "Failed"
    SKIPPED = "skipped", "Skipped"
    RETRYING = "retrying", "Retrying"
    CANCELLED = "cancelled", "Cancelled"


# ============================================================
# Notification
# ============================================================

class Notification(models.Model):
    """
    الإشعار الداخلي داخل النظام.
    """

    company_reference = models.CharField(
        max_length=100,
        blank=True,
        default="",
        db_index=True,
        verbose_name="Company Reference",
    )
    company_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        db_index=True,
        verbose_name="Company Name",
    )

    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notifications",
        verbose_name="Recipient",
    )

    recipient_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        verbose_name="Recipient Name",
    )

    title = models.CharField(
        max_length=200,
        verbose_name="Title",
    )
    message = models.TextField(
        verbose_name="Message",
    )

    notification_type = models.CharField(
        max_length=50,
        default="system",
        db_index=True,
        verbose_name="Notification Type",
    )

    severity = models.CharField(
        max_length=20,
        choices=NotificationSeverity.choices,
        default=NotificationSeverity.INFO,
        db_index=True,
        verbose_name="Severity",
    )

    link = models.CharField(
        max_length=500,
        blank=True,
        default="",
        verbose_name="Link",
    )

    event = models.ForeignKey(
        "NotificationEvent",
        on_delete=models.SET_NULL,
        related_name="notifications",
        null=True,
        blank=True,
        verbose_name="Event",
    )

    is_read = models.BooleanField(
        default=False,
        verbose_name="Is Read",
    )
    read_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Read At",
    )

    created_at = models.DateTimeField(
        default=timezone.now,
        db_index=True,
        verbose_name="Created At",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"
        indexes = [
            models.Index(fields=["recipient", "is_read"]),
            models.Index(fields=["recipient", "-created_at"]),
            models.Index(fields=["company_reference", "-created_at"]),
            models.Index(fields=["notification_type", "severity"]),
        ]

    def mark_as_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=["is_read", "read_at"])

    def __str__(self):
        return f"{self.title} -> {self.recipient}"


# ============================================================
# Notification Event
# ============================================================

class NotificationEvent(models.Model):
    """
    الحدث الأصلي قبل الإرسال عبر القنوات.
    """

    company_reference = models.CharField(
        max_length=100,
        blank=True,
        default="",
        db_index=True,
        verbose_name="Company Reference",
    )
    company_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        db_index=True,
        verbose_name="Company Name",
    )

    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="triggered_notification_events",
        null=True,
        blank=True,
        verbose_name="Actor",
    )

    target_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="targeted_notification_events",
        null=True,
        blank=True,
        verbose_name="Target User",
    )

    event_code = models.CharField(
        max_length=100,
        db_index=True,
        verbose_name="Event Code",
    )
    event_group = models.CharField(
        max_length=50,
        default="system",
        db_index=True,
        verbose_name="Event Group",
    )

    severity = models.CharField(
        max_length=20,
        choices=NotificationSeverity.choices,
        default=NotificationSeverity.INFO,
        db_index=True,
        verbose_name="Severity",
    )

    status = models.CharField(
        max_length=20,
        choices=NotificationEventStatus.choices,
        default=NotificationEventStatus.PENDING,
        db_index=True,
        verbose_name="Status",
    )

    language_code = models.CharField(
        max_length=10,
        default="ar",
        db_index=True,
        verbose_name="Language Code",
    )

    target_model = models.CharField(
        max_length=100,
        blank=True,
        default="",
        verbose_name="Target Model",
    )
    target_object_id = models.CharField(
        max_length=100,
        blank=True,
        default="",
        verbose_name="Target Object ID",
    )

    title = models.CharField(
        max_length=200,
        blank=True,
        default="",
        verbose_name="Title",
    )
    message = models.TextField(
        blank=True,
        default="",
        verbose_name="Message",
    )
    link = models.CharField(
        max_length=500,
        blank=True,
        default="",
        verbose_name="Link",
    )

    context = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Context",
    )

    source = models.CharField(
        max_length=100,
        blank=True,
        default="",
        verbose_name="Source",
    )

    created_at = models.DateTimeField(
        default=timezone.now,
        db_index=True,
        verbose_name="Created At",
    )
    processed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Processed At",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Notification Event"
        verbose_name_plural = "Notification Events"
        indexes = [
            models.Index(fields=["event_code", "-created_at"]),
            models.Index(fields=["event_group", "-created_at"]),
            models.Index(fields=["company_reference", "-created_at"]),
            models.Index(fields=["target_user", "-created_at"]),
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["severity", "-created_at"]),
            models.Index(fields=["language_code", "-created_at"]),
        ]

    def mark_processed(self, status: str = NotificationEventStatus.PROCESSED):
        self.status = status
        self.processed_at = timezone.now()
        self.save(update_fields=["status", "processed_at"])

    def mark_failed(self):
        self.status = NotificationEventStatus.FAILED
        self.processed_at = timezone.now()
        self.save(update_fields=["status", "processed_at"])

    def __str__(self):
        return f"{self.event_code} #{self.pk}"


# ============================================================
# Notification Delivery
# ============================================================

class NotificationDelivery(models.Model):
    """
    تتبع كل قناة بشكل مستقل.
    """

    event = models.ForeignKey(
        NotificationEvent,
        on_delete=models.CASCADE,
        related_name="deliveries",
        verbose_name="Event",
    )

    company_reference = models.CharField(
        max_length=100,
        blank=True,
        default="",
        db_index=True,
        verbose_name="Company Reference",
    )
    company_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        db_index=True,
        verbose_name="Company Name",
    )

    recipient = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="notification_deliveries",
        null=True,
        blank=True,
        verbose_name="Recipient",
    )

    channel = models.CharField(
        max_length=20,
        choices=NotificationChannel.choices,
        db_index=True,
        verbose_name="Channel",
    )

    status = models.CharField(
        max_length=20,
        choices=NotificationDeliveryStatus.choices,
        default=NotificationDeliveryStatus.PENDING,
        db_index=True,
        verbose_name="Status",
    )

    destination = models.CharField(
        max_length=255,
        blank=True,
        default="",
        verbose_name="Destination",
    )

    subject = models.CharField(
        max_length=255,
        blank=True,
        default="",
        verbose_name="Subject",
    )
    rendered_message = models.TextField(
        blank=True,
        default="",
        verbose_name="Rendered Message",
    )

    template_key = models.CharField(
        max_length=120,
        blank=True,
        default="",
        db_index=True,
        verbose_name="Template Key",
    )
    language_code = models.CharField(
        max_length=10,
        default="ar",
        db_index=True,
        verbose_name="Language Code",
    )

    provider_name = models.CharField(
        max_length=100,
        blank=True,
        default="",
        verbose_name="Provider Name",
    )
    provider_message_id = models.CharField(
        max_length=255,
        blank=True,
        default="",
        db_index=True,
        verbose_name="Provider Message ID",
    )
    provider_response = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Provider Response",
    )

    error_message = models.TextField(
        blank=True,
        default="",
        verbose_name="Error Message",
    )
    attempts = models.PositiveIntegerField(
        default=0,
        verbose_name="Attempts",
    )
    max_attempts = models.PositiveIntegerField(
        default=3,
        verbose_name="Max Attempts",
    )

    notification = models.ForeignKey(
        Notification,
        on_delete=models.SET_NULL,
        related_name="deliveries",
        null=True,
        blank=True,
        verbose_name="Notification",
    )

    created_at = models.DateTimeField(
        default=timezone.now,
        db_index=True,
        verbose_name="Created At",
    )
    last_attempt_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Last Attempt At",
    )
    sent_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Sent At",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Notification Delivery"
        verbose_name_plural = "Notification Deliveries"
        indexes = [
            models.Index(fields=["event", "channel"]),
            models.Index(fields=["recipient", "channel"]),
            models.Index(fields=["status", "channel"]),
            models.Index(fields=["company_reference", "-created_at"]),
            models.Index(fields=["provider_message_id"]),
            models.Index(fields=["template_key", "language_code"]),
        ]

    def mark_attempt(self):
        self.attempts += 1
        self.last_attempt_at = timezone.now()
        self.save(update_fields=["attempts", "last_attempt_at"])

    def mark_sent(
        self,
        *,
        provider_message_id: str | None = None,
        provider_response: dict | None = None,
    ):
        self.status = NotificationDeliveryStatus.SENT
        self.sent_at = timezone.now()
        self.last_attempt_at = timezone.now()

        if provider_message_id is not None:
            self.provider_message_id = str(provider_message_id).strip()

        if provider_response is not None:
            self.provider_response = provider_response

        self.save(
            update_fields=[
                "status",
                "sent_at",
                "last_attempt_at",
                "provider_message_id",
                "provider_response",
            ]
        )

    def mark_failed(
        self,
        error_message: str | None = None,
        provider_response: dict | None = None,
    ):
        self.status = NotificationDeliveryStatus.FAILED
        self.last_attempt_at = timezone.now()

        if error_message is not None:
            self.error_message = str(error_message).strip()

        if provider_response is not None:
            self.provider_response = provider_response

        self.save(
            update_fields=[
                "status",
                "last_attempt_at",
                "error_message",
                "provider_response",
            ]
        )

    def mark_skipped(self, reason: str | None = None):
        self.status = NotificationDeliveryStatus.SKIPPED
        self.last_attempt_at = timezone.now()

        if reason is not None:
            self.error_message = str(reason).strip()

        self.save(
            update_fields=[
                "status",
                "last_attempt_at",
                "error_message",
            ]
        )

    def should_retry(self) -> bool:
        return (
            self.status in {
                NotificationDeliveryStatus.FAILED,
                NotificationDeliveryStatus.RETRYING,
            }
            and self.attempts < self.max_attempts
        )

    def __str__(self):
        return f"{self.event.event_code} -> {self.channel} -> {self.status}"