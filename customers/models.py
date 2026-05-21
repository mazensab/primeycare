# ============================================================
# 📂 customers/models.py
# 🧭 Primey Care — Customers Module
# ------------------------------------------------------------
# ✅ الموديل الأساسي للعملاء
# ✅ يدعم إدارة العملاء من النظام
# ✅ يدعم ربط العميل بحساب مستخدم
# ✅ يدعم دخول العميل برقم الجوال + OTP واتساب
# ✅ يدعم ربط العميل تجاريًا بالمندوب والوسيط
# ✅ مناسب للبناء عليه لاحقًا في:
#    - الطلبات
#    - العضويات / البطاقات
#    - البرامج
#    - المدفوعات
#    - الواتساب
#    - كشف الحساب
#    - تقارير المندوبين والوسطاء
# ============================================================

from __future__ import annotations

import re

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


# ============================================================
# 🧰 Shared Helpers
# ============================================================

def normalize_customer_phone(value: str | None) -> str:
    """
    توحيد رقم الجوال للاستخدام كمعرف دخول آمن.

    أمثلة:
    - 05xxxxxxxx  -> 9665xxxxxxxx
    - +9665xxxxxx -> 9665xxxxxxxx
    - 009665xxxxx -> 9665xxxxxxxx

    ملاحظة:
    هذه الدالة لا تتحقق من صحة الرقم بشكل نهائي، لكنها تنظفه وتوحده
    حتى تستخدمه الخدمات و OTP والبحث.
    """
    raw_value = str(value or "").strip()

    if not raw_value:
        return ""

    digits = re.sub(r"\D+", "", raw_value)

    if not digits:
        return ""

    if digits.startswith("00"):
        digits = digits[2:]

    if digits.startswith("0") and len(digits) == 10:
        digits = f"966{digits[1:]}"

    if digits.startswith("5") and len(digits) == 9:
        digits = f"966{digits}"

    return digits


# ============================================================
# 🧩 Customer Model
# ============================================================

class Customer(models.Model):
    # --------------------------------------------------------
    # 🔹 Choice Enums
    # --------------------------------------------------------
    class CustomerType(models.TextChoices):
        INDIVIDUAL = "individual", "Individual"
        CORPORATE = "corporate", "Corporate"

    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"
        NOT_SPECIFIED = "not_specified", "Not Specified"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"
        BLOCKED = "blocked", "Blocked"
        LEAD = "lead", "Lead"

    class Source(models.TextChoices):
        WEBSITE = "website", "Website"
        WHATSAPP = "whatsapp", "WhatsApp"
        AGENT = "agent", "Agent"
        BROKER = "broker", "Broker"
        ADMIN = "admin", "Admin"
        IMPORT = "import", "Import"
        OTHER = "other", "Other"

    # --------------------------------------------------------
    # 🔹 Core Identity
    # --------------------------------------------------------
    customer_code = models.CharField(
        max_length=30,
        unique=True,
        blank=True,
        db_index=True,
        verbose_name="Customer Code",
        help_text="Auto-generated unique customer code.",
    )

    customer_type = models.CharField(
        max_length=20,
        choices=CustomerType.choices,
        default=CustomerType.INDIVIDUAL,
        db_index=True,
        verbose_name="Customer Type",
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
        verbose_name="Status",
    )

    source = models.CharField(
        max_length=20,
        choices=Source.choices,
        default=Source.ADMIN,
        db_index=True,
        verbose_name="Source",
    )

    # --------------------------------------------------------
    # 🔹 Commercial Assignment
    # --------------------------------------------------------
    agent = models.ForeignKey(
        "agents.Agent",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="customers",
        db_index=True,
        verbose_name="Linked Agent",
        help_text="Sales or delivery agent related to this customer.",
    )

    broker = models.ForeignKey(
        "agents.Broker",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="customers",
        db_index=True,
        verbose_name="Linked Broker",
        help_text="Broker related to this customer. Can be resolved from the selected agent.",
    )

    # --------------------------------------------------------
    # 🔹 Linked User Account
    # --------------------------------------------------------
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="customer_profile",
        verbose_name="Linked User Account",
        help_text="Django user account used for customer portal login.",
    )

    normalized_phone = models.CharField(
        max_length=30,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        verbose_name="Normalized Login Phone",
        help_text="Normalized unique phone number used for customer OTP login.",
    )

    phone_verified_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Phone Verified At",
    )

    whatsapp_verified_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="WhatsApp Verified At",
    )

    last_login_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Last Customer Login At",
    )

    # --------------------------------------------------------
    # 🔹 Individual / Corporate Names
    # --------------------------------------------------------
    first_name = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="First Name",
    )

    last_name = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="Last Name",
    )

    company_name = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Company Name",
    )

    display_name = models.CharField(
        max_length=255,
        blank=True,
        db_index=True,
        verbose_name="Display Name",
        help_text="Calculated display name used in listings and relations.",
    )

    # --------------------------------------------------------
    # 🔹 Personal / Legal Info
    # --------------------------------------------------------
    gender = models.CharField(
        max_length=20,
        choices=Gender.choices,
        default=Gender.NOT_SPECIFIED,
        verbose_name="Gender",
    )

    date_of_birth = models.DateField(
        null=True,
        blank=True,
        verbose_name="Date of Birth",
    )

    national_id = models.CharField(
        max_length=50,
        blank=True,
        db_index=True,
        verbose_name="National ID / Iqama",
    )

    passport_number = models.CharField(
        max_length=50,
        blank=True,
        verbose_name="Passport Number",
    )

    nationality = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="Nationality",
    )

    # --------------------------------------------------------
    # 🔹 Contact Info
    # --------------------------------------------------------
    email = models.EmailField(
        blank=True,
        db_index=True,
        verbose_name="Email",
    )

    phone_number = models.CharField(
        max_length=30,
        blank=True,
        db_index=True,
        verbose_name="Phone Number",
    )

    whatsapp_number = models.CharField(
        max_length=30,
        blank=True,
        db_index=True,
        verbose_name="WhatsApp Number",
    )

    alternative_phone_number = models.CharField(
        max_length=30,
        blank=True,
        verbose_name="Alternative Phone Number",
    )

    # --------------------------------------------------------
    # 🔹 Address Info
    # --------------------------------------------------------
    country = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="Country",
    )

    city = models.CharField(
        max_length=100,
        blank=True,
        db_index=True,
        verbose_name="City",
    )

    district = models.CharField(
        max_length=150,
        blank=True,
        verbose_name="District",
    )

    street_address = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Street Address",
    )

    postal_code = models.CharField(
        max_length=20,
        blank=True,
        verbose_name="Postal Code",
    )

    national_address_text = models.TextField(
        blank=True,
        verbose_name="National Address",
    )

    # --------------------------------------------------------
    # 🔹 Business / Notes
    # --------------------------------------------------------
    notes = models.TextField(
        blank=True,
        verbose_name="Internal Notes",
    )

    tags = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Tags",
        help_text="Comma-separated tags for quick filtering.",
    )

    # --------------------------------------------------------
    # 🔹 Audit Fields
    # --------------------------------------------------------
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="customers_created",
        verbose_name="Created By",
    )

    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="customers_updated",
        verbose_name="Updated By",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="Created At",
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="Updated At",
    )

    # --------------------------------------------------------
    # 🔹 Meta
    # --------------------------------------------------------
    class Meta:
        verbose_name = "Customer"
        verbose_name_plural = "Customers"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["customer_code"]),
            models.Index(fields=["customer_type", "status"]),
            models.Index(fields=["agent"]),
            models.Index(fields=["broker"]),
            models.Index(fields=["agent", "broker"]),
            models.Index(fields=["source"]),
            models.Index(fields=["display_name"]),
            models.Index(fields=["email"]),
            models.Index(fields=["phone_number"]),
            models.Index(fields=["whatsapp_number"]),
            models.Index(fields=["normalized_phone"]),
            models.Index(fields=["city"]),
            models.Index(fields=["created_at"]),
        ]

    # --------------------------------------------------------
    # 🔹 String Representation
    # --------------------------------------------------------
    def __str__(self) -> str:
        return self.display_name or self.customer_code or f"Customer #{self.pk}"

    # --------------------------------------------------------
    # 🔹 Derived Helpers
    # --------------------------------------------------------
    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def primary_contact_number(self) -> str:
        return self.whatsapp_number or self.phone_number or self.alternative_phone_number or ""

    @property
    def is_active_customer(self) -> bool:
        return self.status == self.Status.ACTIVE

    @property
    def has_customer_account(self) -> bool:
        return bool(self.user_id)

    @property
    def is_phone_verified(self) -> bool:
        return bool(self.phone_verified_at)

    @property
    def is_whatsapp_verified(self) -> bool:
        return bool(self.whatsapp_verified_at)

    @property
    def login_identifier(self) -> str:
        return self.normalized_phone or normalize_customer_phone(self.primary_contact_number)

    @property
    def agent_name(self) -> str:
        if not self.agent_id:
            return ""

        return (
            getattr(self.agent, "display_name", "")
            or getattr(self.agent, "full_name", "")
            or getattr(self.agent, "name", "")
            or ""
        )

    @property
    def broker_name(self) -> str:
        if not self.broker_id:
            return ""

        return (
            getattr(self.broker, "display_name", "")
            or getattr(self.broker, "name", "")
            or ""
        )

    @property
    def has_agent(self) -> bool:
        return bool(self.agent_id)

    @property
    def has_broker(self) -> bool:
        return bool(self.broker_id)

    # --------------------------------------------------------
    # 🔹 Public Actions
    # --------------------------------------------------------
    def mark_phone_verified(self, *, commit: bool = True) -> None:
        now = timezone.now()
        self.phone_verified_at = now

        if commit:
            self.save(update_fields=["phone_verified_at", "updated_at"])

    def mark_whatsapp_verified(self, *, commit: bool = True) -> None:
        now = timezone.now()
        self.whatsapp_verified_at = now

        if commit:
            self.save(update_fields=["whatsapp_verified_at", "updated_at"])

    def mark_customer_login(self, *, commit: bool = True) -> None:
        self.last_login_at = timezone.now()

        if commit:
            self.save(update_fields=["last_login_at", "updated_at"])

    # --------------------------------------------------------
    # 🔹 Internal Assignment Helpers
    # --------------------------------------------------------
    def _sync_broker_from_agent(self) -> None:
        if not self.agent_id:
            return

        agent_broker_id = getattr(self.agent, "broker_id", None)

        if agent_broker_id and not self.broker_id:
            self.broker = self.agent.broker

    # --------------------------------------------------------
    # 🔹 Validation
    # --------------------------------------------------------
    def clean(self) -> None:
        super().clean()

        if self.customer_type == self.CustomerType.INDIVIDUAL:
            if not self.first_name and not self.last_name:
                raise ValidationError(
                    "Individual customer must have at least first name or last name."
                )

        if self.customer_type == self.CustomerType.CORPORATE:
            if not self.company_name:
                raise ValidationError(
                    "Corporate customer must have a company name."
                )

        if not self.email and not self.phone_number and not self.whatsapp_number:
            raise ValidationError(
                "At least one contact method is required: email, phone number, or WhatsApp number."
            )

        if self.date_of_birth and self.date_of_birth > timezone.localdate():
            raise ValidationError("Date of birth cannot be in the future.")

        normalized_phone = normalize_customer_phone(
            self.normalized_phone or self.whatsapp_number or self.phone_number
        )

        if normalized_phone and len(normalized_phone) < 9:
            raise ValidationError(
                {"normalized_phone": "Normalized phone number is too short."}
            )

        self.normalized_phone = normalized_phone or None

        if self.agent_id:
            agent_status = str(getattr(self.agent, "status", "") or "").strip().upper()
            if agent_status and agent_status != "ACTIVE":
                raise ValidationError(
                    {"agent": "لا يمكن ربط العميل بمندوب غير نشط."}
                )

        if self.broker_id:
            broker_status = str(getattr(self.broker, "status", "") or "").strip().upper()
            if broker_status and broker_status != "ACTIVE":
                raise ValidationError(
                    {"broker": "لا يمكن ربط العميل بوسيط غير نشط."}
                )

        if self.agent_id and self.broker_id:
            agent_broker_id = getattr(self.agent, "broker_id", None)

            if agent_broker_id and agent_broker_id != self.broker_id:
                raise ValidationError(
                    {"broker": "الوسيط لا يطابق الوسيط المرتبط بالمندوب."}
                )

    # --------------------------------------------------------
    # 🔹 Internal Helpers
    # --------------------------------------------------------
    def _build_display_name(self) -> str:
        if self.customer_type == self.CustomerType.CORPORATE:
            return self.company_name.strip()

        return self.full_name or self.primary_contact_number or self.email or ""

    def _generate_customer_code(self) -> str:
        if self.pk:
            return f"CUST-{self.pk:06d}"
        return ""

    # --------------------------------------------------------
    # 🔹 Save Logic
    # --------------------------------------------------------
    def save(self, *args, **kwargs):
        self.first_name = (self.first_name or "").strip()
        self.last_name = (self.last_name or "").strip()
        self.company_name = (self.company_name or "").strip()
        self.email = (self.email or "").strip().lower()
        self.phone_number = (self.phone_number or "").strip()
        self.whatsapp_number = (self.whatsapp_number or "").strip()
        self.alternative_phone_number = (self.alternative_phone_number or "").strip()
        self.country = (self.country or "").strip()
        self.city = (self.city or "").strip()
        self.district = (self.district or "").strip()
        self.street_address = (self.street_address or "").strip()
        self.postal_code = (self.postal_code or "").strip()
        self.nationality = (self.nationality or "").strip()
        self.national_id = (self.national_id or "").strip()
        self.passport_number = (self.passport_number or "").strip()
        self.tags = (self.tags or "").strip()

        if not self.normalized_phone:
            self.normalized_phone = normalize_customer_phone(
                self.whatsapp_number or self.phone_number
            ) or None
        else:
            self.normalized_phone = normalize_customer_phone(self.normalized_phone) or None

        self._sync_broker_from_agent()
        self.display_name = self._build_display_name()

        self.full_clean()
        is_new = self.pk is None

        super().save(*args, **kwargs)

        if is_new and not self.customer_code:
            self.customer_code = self._generate_customer_code()
            super().save(update_fields=["customer_code"])


# ============================================================
# 🔐 Customer Login OTP
# ============================================================

class CustomerLoginOTP(models.Model):
    class Purpose(models.TextChoices):
        LOGIN = "login", "Login"
        VERIFY_PHONE = "verify_phone", "Verify Phone"
        VERIFY_WHATSAPP = "verify_whatsapp", "Verify WhatsApp"

    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="login_otps",
        verbose_name="Customer",
    )

    phone_number = models.CharField(
        max_length=30,
        db_index=True,
        verbose_name="Phone Number",
        help_text="Original phone number used for OTP request.",
    )

    normalized_phone = models.CharField(
        max_length=30,
        db_index=True,
        verbose_name="Normalized Phone Number",
        help_text="Normalized phone number used for OTP verification.",
    )

    code_hash = models.CharField(
        max_length=128,
        verbose_name="OTP Code Hash",
        help_text="Hashed OTP code. Never store the raw OTP.",
    )

    purpose = models.CharField(
        max_length=30,
        choices=Purpose.choices,
        default=Purpose.LOGIN,
        db_index=True,
        verbose_name="Purpose",
    )

    expires_at = models.DateTimeField(
        db_index=True,
        verbose_name="Expires At",
    )

    verified_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Verified At",
    )

    attempts_count = models.PositiveSmallIntegerField(
        default=0,
        verbose_name="Attempts Count",
    )

    max_attempts = models.PositiveSmallIntegerField(
        default=5,
        verbose_name="Max Attempts",
    )

    request_ip = models.GenericIPAddressField(
        null=True,
        blank=True,
        verbose_name="Request IP",
    )

    user_agent = models.TextField(
        blank=True,
        verbose_name="User Agent",
    )

    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Metadata",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="Created At",
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="Updated At",
    )

    class Meta:
        verbose_name = "Customer Login OTP"
        verbose_name_plural = "Customer Login OTPs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["customer", "purpose", "created_at"]),
            models.Index(fields=["normalized_phone", "purpose", "created_at"]),
            models.Index(fields=["expires_at"]),
            models.Index(fields=["verified_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.customer_id} | {self.normalized_phone} | {self.purpose}"

    @property
    def is_expired(self) -> bool:
        return timezone.now() > self.expires_at

    @property
    def is_verified(self) -> bool:
        return bool(self.verified_at)

    @property
    def can_attempt(self) -> bool:
        return not self.is_verified and not self.is_expired and self.attempts_count < self.max_attempts

    def clean(self) -> None:
        super().clean()

        self.phone_number = (self.phone_number or "").strip()
        self.normalized_phone = normalize_customer_phone(self.normalized_phone or self.phone_number)

        if not self.normalized_phone:
            raise ValidationError(
                {"normalized_phone": "Normalized phone number is required."}
            )

        if not self.code_hash:
            raise ValidationError({"code_hash": "OTP code hash is required."})

        if not self.expires_at:
            raise ValidationError({"expires_at": "OTP expiry date is required."})

    def mark_verified(self, *, commit: bool = True) -> None:
        self.verified_at = timezone.now()

        if commit:
            self.save(update_fields=["verified_at", "updated_at"])

    def register_failed_attempt(self, *, commit: bool = True) -> None:
        self.attempts_count += 1

        if commit:
            self.save(update_fields=["attempts_count", "updated_at"])

    def save(self, *args, **kwargs):
        self.phone_number = (self.phone_number or "").strip()
        self.normalized_phone = normalize_customer_phone(
            self.normalized_phone or self.phone_number
        )
        self.user_agent = (self.user_agent or "").strip()

        self.full_clean()

        super().save(*args, **kwargs)