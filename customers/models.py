# ============================================================
# 📂 customers/models.py
# 🧭 Primey Care — Customers Module
# ------------------------------------------------------------
# ✅ الموديل الأساسي للعملاء
# ✅ مناسب للبناء عليه لاحقًا في:
#    - الطلبات
#    - العضويات / البطاقات
#    - البرامج
#    - المدفوعات
#    - الواتساب
#    - كشف الحساب
# ============================================================

from __future__ import annotations

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


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
            models.Index(fields=["display_name"]),
            models.Index(fields=["email"]),
            models.Index(fields=["phone_number"]),
            models.Index(fields=["whatsapp_number"]),
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

    # --------------------------------------------------------
    # 🔹 Validation
    # --------------------------------------------------------
    def clean(self) -> None:
        super().clean()

        if self.customer_type == self.CustomerType.INDIVIDUAL:
            if not self.first_name or not self.last_name:
                raise ValidationError(
                    "Individual customer must have first name and last name."
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

    # --------------------------------------------------------
    # 🔹 Internal Helpers
    # --------------------------------------------------------
    def _build_display_name(self) -> str:
        if self.customer_type == self.CustomerType.CORPORATE:
            return self.company_name.strip()

        return self.full_name

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

        self.display_name = self._build_display_name()

        self.full_clean()
        is_new = self.pk is None

        super().save(*args, **kwargs)

        if is_new and not self.customer_code:
            self.customer_code = self._generate_customer_code()
            super().save(update_fields=["customer_code"])