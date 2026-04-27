# ============================================================
# 📂 customers/admin.py
# 🧭 Primey Care — Customers Admin
# ============================================================

from django.contrib import admin
from .models import Customer


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = (
        "customer_code",
        "display_name",
        "customer_type",
        "status",
        "phone_number",
        "whatsapp_number",
        "email",
        "city",
        "created_at",
    )

    list_filter = (
        "customer_type",
        "status",
        "source",
        "gender",
        "city",
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
        "national_id",
        "passport_number",
    )

    readonly_fields = (
        "customer_code",
        "display_name",
        "created_at",
        "updated_at",
    )

    ordering = ("-created_at",)

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