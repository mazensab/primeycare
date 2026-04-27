# ============================================================
# 📂 whatsapp_center/models.py
# 🧠 Primey Care - WhatsApp Center Models V1 Core
# ------------------------------------------------------------
# ✅ نسخة Core نظيفة مناسبة لـ Primey Care
# ✅ تدعم:
#    - System WhatsApp Config
#    - WhatsApp Templates
#    - Message Logs
#    - Retry Attempts
#    - Webhook Events
#    - WhatsApp Contacts
#    - WhatsApp Conversations
#    - WhatsApp Conversation Messages
# ✅ بدون ربط مباشر مع:
#    - company_manager
#    - employee_center
# ✅ جاهزة للبناء فوقها لاحقًا:
#    - company scope
#    - broadcasts
#    - reminders
# ============================================================

from __future__ import annotations

from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone


# ============================================================
# 🧩 Common Choices
# ============================================================

class WhatsAppProvider(models.TextChoices):
    META = "META", "Meta"
    TWILIO = "TWILIO", "Twilio"
    UNIFONIC = "UNIFONIC", "Unifonic"
    OTHER = "OTHER", "Other"

    WEB_SESSION = "whatsapp_web_session", "WhatsApp Web Session"
    META_CLOUD_API = "meta_cloud_api", "Meta Cloud API"


class SessionMode(models.TextChoices):
    QR = "qr", "QR"
    PAIRING_CODE = "pairing_code", "Pairing Code"


class SessionStatus(models.TextChoices):
    DISCONNECTED = "disconnected", "Disconnected"
    QR_PENDING = "qr_pending", "QR Pending"
    PAIR_PENDING = "pair_pending", "Pair Pending"
    CONNECTED = "connected", "Connected"
    FAILED = "failed", "Failed"


class ScopeType(models.TextChoices):
    SYSTEM = "SYSTEM", "System"
    COMPANY = "COMPANY", "Company"


class MessageType(models.TextChoices):
    TEXT = "TEXT", "Text"
    TEMPLATE = "TEMPLATE", "Template"
    DOCUMENT = "DOCUMENT", "Document"


class DeliveryStatus(models.TextChoices):
    QUEUED = "QUEUED", "Queued"
    SENT = "SENT", "Sent"
    DELIVERED = "DELIVERED", "Delivered"
    READ = "READ", "Read"
    FAILED = "FAILED", "Failed"
    CANCELLED = "CANCELLED", "Cancelled"


class TriggerSource(models.TextChoices):
    SYSTEM = "system", "System"
    BILLING = "billing", "Billing"
    ATTENDANCE = "attendance", "Attendance"
    LEAVE = "leave", "Leave"
    PAYROLL = "payroll", "Payroll"
    EMPLOYEE = "employee", "Employee"
    COMPANY = "company", "Company"
    BROADCAST = "broadcast", "Broadcast"


class ConversationStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    CLOSED = "CLOSED", "Closed"
    ARCHIVED = "ARCHIVED", "Archived"
    SPAM = "SPAM", "Spam"


class ConversationDirection(models.TextChoices):
    INBOUND = "INBOUND", "Inbound"
    OUTBOUND = "OUTBOUND", "Outbound"


class TemplateApprovalStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    PENDING = "PENDING", "Pending"
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"


class TemplateProviderSyncStatus(models.TextChoices):
    NOT_SYNCED = "NOT_SYNCED", "Not Synced"
    SYNCED = "SYNCED", "Synced"
    FAILED = "FAILED", "Failed"


# ============================================================
# 🔐 Validators
# ============================================================

phone_validator = RegexValidator(
    regex=r"^\+?[1-9]\d{7,14}$",
    message="Phone number must be in international format, e.g. +9665XXXXXXXX",
)


# ============================================================
# 🏢 Generic Scoped Base
# ============================================================

class ScopedCompanyMixin(models.Model):
    scope_type = models.CharField(
        max_length=20,
        choices=ScopeType.choices,
        default=ScopeType.SYSTEM,
        db_index=True,
        verbose_name="Scope Type",
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

    class Meta:
        abstract = True

    def clean_scope(self) -> None:
        if self.scope_type == ScopeType.SYSTEM:
            self.company_reference = ""
            self.company_name = ""

    def save(self, *args, **kwargs):
        self.clean_scope()
        return super().save(*args, **kwargs)


# ============================================================
# ⚙️ System WhatsApp Config
# ============================================================

class SystemWhatsAppConfig(models.Model):
    provider = models.CharField(
        max_length=50,
        choices=WhatsAppProvider.choices,
        default=WhatsAppProvider.WEB_SESSION,
    )
    is_enabled = models.BooleanField(default=False)
    is_active = models.BooleanField(default=False)

    business_name = models.CharField(max_length=255, blank=True)
    phone_number = models.CharField(max_length=20, blank=True, validators=[phone_validator])
    phone_number_id = models.CharField(max_length=255, blank=True)
    business_account_id = models.CharField(max_length=255, blank=True)
    app_id = models.CharField(max_length=255, blank=True)

    access_token = models.TextField(blank=True)
    webhook_verify_token = models.CharField(max_length=255, blank=True)
    webhook_callback_url = models.URLField(blank=True)
    webhook_verified = models.BooleanField(default=False)

    api_version = models.CharField(max_length=50, default="v22.0")
    default_language_code = models.CharField(max_length=20, default="ar")
    default_country_code = models.CharField(max_length=10, default="966")

    allow_broadcasts = models.BooleanField(default=True)
    send_test_enabled = models.BooleanField(default=True)
    default_test_recipient = models.CharField(max_length=20, blank=True)

    session_name = models.CharField(max_length=255, default="primey-system-session")
    session_mode = models.CharField(
        max_length=30,
        choices=SessionMode.choices,
        default=SessionMode.QR,
    )
    session_status = models.CharField(
        max_length=30,
        choices=SessionStatus.choices,
        default=SessionStatus.DISCONNECTED,
    )
    session_connected_phone = models.CharField(max_length=30, blank=True)
    session_device_label = models.CharField(max_length=255, blank=True)
    session_last_connected_at = models.DateTimeField(null=True, blank=True)
    session_qr_code = models.TextField(blank=True)
    session_pairing_code = models.CharField(max_length=100, blank=True)

    last_health_check_at = models.DateTimeField(null=True, blank=True)
    last_error_message = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "System WhatsApp Config"
        verbose_name_plural = "System WhatsApp Configs"
        ordering = ["-id"]

    def __str__(self) -> str:
        return f"System WhatsApp Config #{self.pk}"


# ============================================================
# 🧾 WhatsApp Template
# ============================================================

class WhatsAppTemplate(ScopedCompanyMixin):
    event_code = models.CharField(max_length=100, db_index=True)
    template_key = models.CharField(max_length=100, db_index=True)
    template_name = models.CharField(max_length=255, blank=True)
    language_code = models.CharField(max_length=20, default="ar", db_index=True)

    message_type = models.CharField(
        max_length=20,
        choices=MessageType.choices,
        default=MessageType.TEXT,
    )

    header_text = models.TextField(blank=True)
    body_text = models.TextField()
    footer_text = models.TextField(blank=True)

    button_text = models.CharField(max_length=255, blank=True)
    button_url = models.URLField(blank=True)

    meta_template_name = models.CharField(max_length=255, blank=True)
    meta_template_namespace = models.CharField(max_length=255, blank=True)

    approval_status = models.CharField(
        max_length=20,
        choices=TemplateApprovalStatus.choices,
        default=TemplateApprovalStatus.DRAFT,
        db_index=True,
    )
    provider_status = models.CharField(
        max_length=20,
        choices=TemplateProviderSyncStatus.choices,
        default=TemplateProviderSyncStatus.NOT_SYNCED,
        db_index=True,
    )
    rejection_reason = models.TextField(blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)

    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True, db_index=True)
    version = models.PositiveIntegerField(default=1)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_whatsapp_templates",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_whatsapp_templates",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "WhatsApp Template"
        verbose_name_plural = "WhatsApp Templates"
        ordering = ["scope_type", "event_code", "-version", "-id"]
        indexes = [
            models.Index(fields=["scope_type", "event_code"]),
            models.Index(fields=["company_reference", "event_code"]),
            models.Index(fields=["language_code"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["approval_status"]),
            models.Index(fields=["provider_status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["scope_type", "company_reference", "event_code", "language_code", "version"],
                name="uniq_whatsapp_template_scope_companyref_event_lang_version",
            )
        ]

    def __str__(self) -> str:
        return f"{self.scope_type} | {self.event_code} | v{self.version}"


# ============================================================
# 📨 WhatsApp Message Log
# ============================================================

class WhatsAppMessageLog(ScopedCompanyMixin):
    trigger_source = models.CharField(
        max_length=50,
        choices=TriggerSource.choices,
        default=TriggerSource.SYSTEM,
    )
    event_code = models.CharField(max_length=100, blank=True, db_index=True)

    recipient_name = models.CharField(max_length=255, blank=True)
    recipient_phone = models.CharField(max_length=20, validators=[phone_validator], db_index=True)
    recipient_role = models.CharField(max_length=100, blank=True)

    message_type = models.CharField(
        max_length=20,
        choices=MessageType.choices,
        default=MessageType.TEXT,
    )

    template = models.ForeignKey(
        "WhatsAppTemplate",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="message_logs",
    )
    template_name_snapshot = models.CharField(max_length=255, blank=True)
    language_code = models.CharField(max_length=20, default="ar")

    message_subject = models.CharField(max_length=255, blank=True)
    header_text = models.TextField(blank=True)
    message_body = models.TextField(blank=True)
    footer_text = models.TextField(blank=True)

    attachment_url = models.URLField(blank=True)
    attachment_name = models.CharField(max_length=255, blank=True)
    mime_type = models.CharField(max_length=100, blank=True)

    external_message_id = models.CharField(max_length=255, blank=True, db_index=True)
    provider_status = models.CharField(max_length=255, blank=True)
    delivery_status = models.CharField(
        max_length=20,
        choices=DeliveryStatus.choices,
        default=DeliveryStatus.QUEUED,
        db_index=True,
    )

    failure_reason = models.TextField(blank=True)
    failure_code = models.CharField(max_length=100, blank=True)

    related_model = models.CharField(max_length=100, blank=True)
    related_object_id = models.CharField(max_length=100, blank=True)

    payload_json = models.JSONField(default=dict, blank=True)
    response_json = models.JSONField(default=dict, blank=True)

    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    failed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "WhatsApp Message Log"
        verbose_name_plural = "WhatsApp Message Logs"
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["company_reference", "created_at"]),
            models.Index(fields=["scope_type", "created_at"]),
            models.Index(fields=["event_code"]),
            models.Index(fields=["delivery_status"]),
            models.Index(fields=["recipient_phone"]),
            models.Index(fields=["external_message_id"]),
        ]

    def __str__(self) -> str:
        return f"{self.recipient_phone} | {self.delivery_status} | {self.created_at:%Y-%m-%d %H:%M}"


# ============================================================
# 🔁 WhatsApp Message Attempt
# ============================================================

class WhatsAppMessageAttempt(models.Model):
    message_log = models.ForeignKey(
        WhatsAppMessageLog,
        on_delete=models.CASCADE,
        related_name="attempts",
    )
    attempt_number = models.PositiveIntegerField(default=1)

    request_payload = models.JSONField(default=dict, blank=True)
    response_payload = models.JSONField(default=dict, blank=True)

    status_code = models.PositiveIntegerField(null=True, blank=True)
    provider_status = models.CharField(max_length=255, blank=True)
    is_success = models.BooleanField(default=False)
    error_message = models.TextField(blank=True)

    started_at = models.DateTimeField(default=timezone.now)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "WhatsApp Message Attempt"
        verbose_name_plural = "WhatsApp Message Attempts"
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["message_log", "attempt_number"],
                name="uniq_whatsapp_attempt_per_message",
            )
        ]

    def __str__(self) -> str:
        return f"Attempt #{self.attempt_number} for Log #{self.message_log_id}"


# ============================================================
# 🌐 WhatsApp Webhook Event
# ============================================================

class WhatsAppWebhookEvent(ScopedCompanyMixin):
    provider = models.CharField(
        max_length=50,
        choices=WhatsAppProvider.choices,
        default=WhatsAppProvider.META,
    )
    event_type = models.CharField(max_length=100, blank=True, db_index=True)
    external_message_id = models.CharField(max_length=255, blank=True, db_index=True)

    payload_json = models.JSONField(default=dict, blank=True)

    is_processed = models.BooleanField(default=False, db_index=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    processing_error = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "WhatsApp Webhook Event"
        verbose_name_plural = "WhatsApp Webhook Events"
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["external_message_id"]),
            models.Index(fields=["event_type"]),
            models.Index(fields=["is_processed"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self) -> str:
        return f"Webhook {self.event_type or 'unknown'} #{self.pk}"


# ============================================================
# 💬 WhatsApp Contact
# ============================================================

class WhatsAppContact(ScopedCompanyMixin):
    phone_number = models.CharField(max_length=20, validators=[phone_validator])
    display_name = models.CharField(max_length=255, blank=True)
    push_name = models.CharField(max_length=255, blank=True)

    wa_jid = models.CharField(max_length=255, blank=True)
    profile_name = models.CharField(max_length=255, blank=True)

    is_blocked = models.BooleanField(default=False)
    is_business = models.BooleanField(default=False)

    last_message_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)

    notes = models.TextField(blank=True)
    extra_json = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "WhatsApp Contact"
        verbose_name_plural = "WhatsApp Contacts"
        ordering = ["-last_message_at", "-id"]
        indexes = [
            models.Index(fields=["scope_type", "phone_number"]),
            models.Index(fields=["company_reference", "phone_number"]),
            models.Index(fields=["last_message_at"]),
            models.Index(fields=["is_blocked"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["scope_type", "company_reference", "phone_number"],
                name="uniq_whatsapp_contact_scope_companyref_phone",
            )
        ]

    def __str__(self) -> str:
        return self.display_name or self.phone_number


# ============================================================
# 🧵 WhatsApp Conversation
# ============================================================

class WhatsAppConversation(ScopedCompanyMixin):
    contact = models.ForeignKey(
        WhatsAppContact,
        on_delete=models.CASCADE,
        related_name="conversations",
    )

    status = models.CharField(
        max_length=20,
        choices=ConversationStatus.choices,
        default=ConversationStatus.OPEN,
    )

    subject = models.CharField(max_length=255, blank=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_whatsapp_conversations",
    )

    session_name = models.CharField(max_length=255, blank=True)

    unread_count = models.PositiveIntegerField(default=0)
    last_message_preview = models.TextField(blank=True)
    last_message_at = models.DateTimeField(null=True, blank=True, db_index=True)

    is_pinned = models.BooleanField(default=False)
    is_muted = models.BooleanField(default=False)
    is_resolved = models.BooleanField(default=False)

    extra_json = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "WhatsApp Conversation"
        verbose_name_plural = "WhatsApp Conversations"
        ordering = ["-last_message_at", "-id"]
        indexes = [
            models.Index(fields=["scope_type", "status"]),
            models.Index(fields=["company_reference", "status"]),
            models.Index(fields=["contact", "status"]),
            models.Index(fields=["assigned_to"]),
            models.Index(fields=["last_message_at"]),
            models.Index(fields=["is_pinned"]),
            models.Index(fields=["is_resolved"]),
        ]

    def __str__(self) -> str:
        return f"{self.contact} | {self.status}"


# ============================================================
# 📨 WhatsApp Conversation Message
# ============================================================

class WhatsAppConversationMessage(ScopedCompanyMixin):
    conversation = models.ForeignKey(
        WhatsAppConversation,
        on_delete=models.CASCADE,
        related_name="messages",
    )

    direction = models.CharField(
        max_length=20,
        choices=ConversationDirection.choices,
        default=ConversationDirection.INBOUND,
    )

    message_type = models.CharField(
        max_length=20,
        choices=MessageType.choices,
        default=MessageType.TEXT,
    )

    external_message_id = models.CharField(max_length=255, blank=True, db_index=True)
    provider = models.CharField(
        max_length=50,
        choices=WhatsAppProvider.choices,
        default=WhatsAppProvider.WEB_SESSION,
    )
    provider_status = models.CharField(max_length=255, blank=True)
    delivery_status = models.CharField(
        max_length=20,
        choices=DeliveryStatus.choices,
        default=DeliveryStatus.QUEUED,
        db_index=True,
    )

    wa_jid = models.CharField(max_length=255, blank=True)
    sender_phone = models.CharField(max_length=20, blank=True, db_index=True)
    sender_name = models.CharField(max_length=255, blank=True)

    body_text = models.TextField(blank=True)
    caption = models.TextField(blank=True)

    attachment_url = models.URLField(blank=True)
    attachment_name = models.CharField(max_length=255, blank=True)
    mime_type = models.CharField(max_length=100, blank=True)
    media_type = models.CharField(max_length=50, blank=True)

    is_read = models.BooleanField(default=False)
    is_from_me = models.BooleanField(default=False)

    replied_to_external_message_id = models.CharField(max_length=255, blank=True)

    payload_json = models.JSONField(default=dict, blank=True)
    extra_json = models.JSONField(default=dict, blank=True)

    webhook_event = models.ForeignKey(
        WhatsAppWebhookEvent,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="conversation_messages",
    )
    message_log = models.ForeignKey(
        WhatsAppMessageLog,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="conversation_messages",
    )

    message_created_at = models.DateTimeField(null=True, blank=True, db_index=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    failed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "WhatsApp Conversation Message"
        verbose_name_plural = "WhatsApp Conversation Messages"
        ordering = ["created_at", "id"]
        indexes = [
            models.Index(fields=["conversation", "created_at"]),
            models.Index(fields=["scope_type", "created_at"]),
            models.Index(fields=["company_reference", "created_at"]),
            models.Index(fields=["direction"]),
            models.Index(fields=["delivery_status"]),
            models.Index(fields=["external_message_id"]),
            models.Index(fields=["sender_phone"]),
            models.Index(fields=["message_created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.direction} | {self.external_message_id or self.pk}"