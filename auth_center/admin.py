# ===============================================================
# 📂 الملف: auth_center/admin.py
# 🧭 Primey Care — Auth Center Admin
# 🚀 الإصدار: Auth Center Admin V1.0
# ---------------------------------------------------------------
# ✅ تسجيل موديلات auth_center داخل لوحة التحكم
# ✅ إدارة UserProfile
# ✅ إدارة ActiveUserSession
# ===============================================================

from django.contrib import admin

from .models import ActiveUserSession, UserProfile


# ===============================================================
# 👤 User Profile Admin
# ===============================================================

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "display_name",
        "user_type",
        "phone_number",
        "whatsapp_number",
        "preferred_language",
        "is_profile_completed",
        "created_at",
    )
    list_filter = (
        "user_type",
        "preferred_language",
        "is_phone_verified",
        "is_whatsapp_verified",
        "is_email_verified",
        "is_profile_completed",
        "created_at",
    )
    search_fields = (
        "user__username",
        "user__email",
        "display_name",
        "phone_number",
        "whatsapp_number",
        "alternate_email",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
        "last_profile_update_at",
    )
    autocomplete_fields = ("user",)

    fieldsets = (
        ("الربط الأساسي", {
            "fields": (
                "user",
                "user_type",
            )
        }),
        ("بيانات العرض", {
            "fields": (
                "display_name",
                "avatar_url",
                "bio",
            )
        }),
        ("بيانات التواصل", {
            "fields": (
                "phone_number",
                "whatsapp_number",
                "alternate_email",
            )
        }),
        ("التفضيلات", {
            "fields": (
                "preferred_language",
                "timezone",
            )
        }),
        ("حالات التوثيق", {
            "fields": (
                "is_phone_verified",
                "is_whatsapp_verified",
                "is_email_verified",
                "is_profile_completed",
            )
        }),
        ("بيانات مرنة", {
            "fields": (
                "tags",
                "extra_data",
            )
        }),
        ("التتبع", {
            "fields": (
                "last_profile_update_at",
                "created_at",
                "updated_at",
            )
        }),
    )


# ===============================================================
# 🔐 Active User Session Admin
# ===============================================================

@admin.register(ActiveUserSession)
class ActiveUserSessionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "auth_channel",
        "session_key",
        "is_current",
        "is_active",
        "ip_address",
        "last_seen",
        "created_at",
    )
    list_filter = (
        "auth_channel",
        "is_current",
        "is_active",
        "created_at",
        "last_seen",
    )
    search_fields = (
        "user__username",
        "user__email",
        "session_key",
        "ip_address",
        "device_name",
        "device_id",
        "location_hint",
    )
    readonly_fields = (
        "created_at",
        "last_seen",
        "logged_out_at",
    )
    autocomplete_fields = ("user",)

    fieldsets = (
        ("الربط الأساسي", {
            "fields": (
                "user",
                "session_key",
                "session_version",
                "auth_channel",
            )
        }),
        ("بيانات الجهاز", {
            "fields": (
                "device_name",
                "device_id",
                "user_agent",
            )
        }),
        ("الشبكة والموقع", {
            "fields": (
                "ip_address",
                "location_hint",
            )
        }),
        ("الحالة", {
            "fields": (
                "is_current",
                "is_active",
                "logged_out_at",
            )
        }),
        ("التتبع", {
            "fields": (
                "created_at",
                "last_seen",
            )
        }),
    )