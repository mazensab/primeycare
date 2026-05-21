# ============================================================
# 📂 customers/admin.py
# 🧭 Primey Care — Customers Admin
# ------------------------------------------------------------
# ✅ إدارة العملاء
# ✅ عرض حساب المستخدم المرتبط بالعميل
# ✅ عرض رقم الدخول الموحد والتحقق
# ✅ عرض العلاقة التجارية مع المندوب والوسيط
# ✅ إدارة ومراجعة Customer OTP بدون كشف الكود الخام
# ============================================================

from __future__ import annotations

from django.contrib import admin
from django.utils.html import format_html

from .models import Customer, CustomerLoginOTP


# ============================================================
# 🧩 Customer Admin
# ============================================================

@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = (
        "customer_code",
        "display_name",
        "customer_type",
        "status",
        "source",
        "agent_display",
        "broker_display",
        "account_status_badge",
        "normalized_phone",
        "phone_verified_badge",
        "whatsapp_verified_badge",
        "phone_number",
        "whatsapp_number",
        "email",
        "city",
        "last_login_at",
        "created_at",
    )

    list_filter = (
        "customer_type",
        "status",
        "source",
        "agent",
        "broker",
        "gender",
        "city",
        "phone_verified_at",
        "whatsapp_verified_at",
        "last_login_at",
        "created_at",
    )

    search_fields = (
        "customer_code",
        "display_name",
        "first_name",
        "last_name",
        "company_name",
        "email",
        "phone_number",
        "whatsapp_number",
        "normalized_phone",
        "national_id",
        "passport_number",
        "agent__full_name",
        "agent__agent_code",
        "agent__referral_code",
        "agent__phone",
        "agent__email",
        "broker__name",
        "broker__broker_code",
        "broker__referral_code",
        "broker__phone",
        "broker__email",
        "user__username",
        "user__email",
        "user__first_name",
        "user__last_name",
    )

    readonly_fields = (
        "customer_code",
        "display_name",
        "agent_display",
        "broker_display",
        "normalized_phone",
        "phone_verified_at",
        "whatsapp_verified_at",
        "last_login_at",
        "created_at",
        "updated_at",
    )

    autocomplete_fields = (
        "agent",
        "broker",
        "user",
        "created_by",
        "updated_by",
    )

    ordering = ("-created_at",)
    list_select_related = (
        "agent",
        "broker",
        "user",
        "created_by",
        "updated_by",
    )

    date_hierarchy = "created_at"
    list_per_page = 50

    fieldsets = (
        (
            "Core Information",
            {
                "fields": (
                    "customer_code",
                    "customer_type",
                    "status",
                    "source",
                    "display_name",
                )
            },
        ),
        (
            "Commercial Assignment / العلاقة التجارية",
            {
                "fields": (
                    "agent",
                    "agent_display",
                    "broker",
                    "broker_display",
                ),
                "description": (
                    "تستخدم هذه العلاقة لربط العميل تجاريًا بالمندوب والوسيط. "
                    "إذا تم اختيار مندوب مرتبط بوسيط، يتم ضبط الوسيط تلقائيًا من الموديل عند الحفظ "
                    "في حال لم يتم اختيار وسيط يدويًا."
                ),
            },
        ),
        (
            "Customer Portal Account",
            {
                "fields": (
                    "user",
                    "normalized_phone",
                    "phone_verified_at",
                    "whatsapp_verified_at",
                    "last_login_at",
                ),
                "description": (
                    "Customer portal login is based on normalized phone number "
                    "and WhatsApp OTP verification."
                ),
            },
        ),
        (
            "Personal / Company Information",
            {
                "fields": (
                    "first_name",
                    "last_name",
                    "company_name",
                    "gender",
                    "date_of_birth",
                    "nationality",
                    "national_id",
                    "passport_number",
                )
            },
        ),
        (
            "Contact Information",
            {
                "fields": (
                    "email",
                    "phone_number",
                    "whatsapp_number",
                    "alternative_phone_number",
                )
            },
        ),
        (
            "Address Information",
            {
                "fields": (
                    "country",
                    "city",
                    "district",
                    "street_address",
                    "postal_code",
                    "national_address_text",
                )
            },
        ),
        (
            "Business Information",
            {
                "fields": (
                    "tags",
                    "notes",
                )
            },
        ),
        (
            "Audit Information",
            {
                "fields": (
                    "created_by",
                    "updated_by",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    @admin.display(description="Agent / المندوب")
    def agent_display(self, obj: Customer) -> str:
        agent = getattr(obj, "agent", None)

        if not agent:
            return "-"

        name = (
            getattr(agent, "display_name", "")
            or getattr(agent, "full_name", "")
            or getattr(agent, "name", "")
            or f"Agent #{agent.pk}"
        )
        code = getattr(agent, "agent_code", "") or getattr(agent, "code", "")

        if code:
            return f"{name} — {code}"

        return name

    @admin.display(description="Broker / الوسيط")
    def broker_display(self, obj: Customer) -> str:
        broker = getattr(obj, "broker", None)

        if not broker:
            return "-"

        name = (
            getattr(broker, "display_name", "")
            or getattr(broker, "name", "")
            or f"Broker #{broker.pk}"
        )
        code = getattr(broker, "broker_code", "")

        if code:
            return f"{name} — {code}"

        return name

    @admin.display(description="Account")
    def account_status_badge(self, obj: Customer) -> str:
        if obj.user_id:
            return format_html(
                '<span style="color:#166534;font-weight:700;">Linked</span>'
            )

        return format_html(
            '<span style="color:#92400e;font-weight:700;">No account</span>'
        )

    @admin.display(description="Phone Verified")
    def phone_verified_badge(self, obj: Customer) -> str:
        if obj.phone_verified_at:
            return format_html(
                '<span style="color:#166534;font-weight:700;">Verified</span>'
            )

        return format_html(
            '<span style="color:#991b1b;font-weight:700;">Not verified</span>'
        )

    @admin.display(description="WhatsApp Verified")
    def whatsapp_verified_badge(self, obj: Customer) -> str:
        if obj.whatsapp_verified_at:
            return format_html(
                '<span style="color:#166534;font-weight:700;">Verified</span>'
            )

        return format_html(
            '<span style="color:#991b1b;font-weight:700;">Not verified</span>'
        )


# ============================================================
# 🔐 Customer Login OTP Admin
# ============================================================

@admin.register(CustomerLoginOTP)
class CustomerLoginOTPAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "customer",
        "normalized_phone",
        "purpose",
        "otp_status_badge",
        "attempts_count",
        "max_attempts",
        "expires_at",
        "verified_at",
        "created_at",
    )

    list_filter = (
        "purpose",
        "verified_at",
        "expires_at",
        "created_at",
    )

    search_fields = (
        "customer__customer_code",
        "customer__display_name",
        "customer__phone_number",
        "customer__whatsapp_number",
        "phone_number",
        "normalized_phone",
        "request_ip",
    )

    readonly_fields = (
        "customer",
        "phone_number",
        "normalized_phone",
        "code_hash",
        "purpose",
        "expires_at",
        "verified_at",
        "attempts_count",
        "max_attempts",
        "request_ip",
        "user_agent",
        "metadata",
        "created_at",
        "updated_at",
    )

    ordering = ("-created_at",)
    list_select_related = ("customer",)
    date_hierarchy = "created_at"
    list_per_page = 50

    fieldsets = (
        (
            "OTP Information",
            {
                "fields": (
                    "customer",
                    "phone_number",
                    "normalized_phone",
                    "purpose",
                    "code_hash",
                )
            },
        ),
        (
            "Verification Status",
            {
                "fields": (
                    "expires_at",
                    "verified_at",
                    "attempts_count",
                    "max_attempts",
                )
            },
        ),
        (
            "Request Context",
            {
                "fields": (
                    "request_ip",
                    "user_agent",
                    "metadata",
                )
            },
        ),
        (
            "Audit Information",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    def has_add_permission(self, request) -> bool:
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False

    @admin.display(description="Status")
    def otp_status_badge(self, obj: CustomerLoginOTP) -> str:
        if obj.is_verified:
            return format_html(
                '<span style="color:#166534;font-weight:700;">Verified</span>'
            )

        if obj.is_expired:
            return format_html(
                '<span style="color:#991b1b;font-weight:700;">Expired</span>'
            )

        if not obj.can_attempt:
            return format_html(
                '<span style="color:#92400e;font-weight:700;">Blocked</span>'
            )

        return format_html(
            '<span style="color:#1d4ed8;font-weight:700;">Active</span>'
        )