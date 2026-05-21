# ===============================================================
# 📂 الملف: auth_center/admin.py
# 🧭 Primey Care — Auth Center Admin
# 🚀 الإصدار: Auth Center Admin V1.1
# ---------------------------------------------------------------
# ✅ تسجيل موديلات auth_center داخل لوحة التحكم
# ✅ إدارة UserProfile
# ✅ إدارة ActiveUserSession
# ✅ عرض user_type + role لأن role هو مصدر الصلاحيات
# ✅ دعم broker_user / agent_user / provider_admin / customer_user
# ===============================================================

from __future__ import annotations

from django.contrib import admin
from django.utils import timezone

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
        "full_name",
        "user_type",
        "role",
        "workspace",
        "phone_number",
        "whatsapp_number",
        "preferred_language",
        "is_profile_completed",
        "created_at",
    )

    list_filter = (
        "user_type",
        "role",
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
        "user__first_name",
        "user__last_name",
        "display_name",
        "user_type",
        "role",
        "phone_number",
        "whatsapp_number",
        "alternate_email",
    )

    readonly_fields = (
        "full_name",
        "workspace",
        "created_at",
        "updated_at",
        "last_profile_update_at",
    )

    autocomplete_fields = ("user",)
    list_select_related = ("user",)
    ordering = ("-created_at",)

    fieldsets = (
        (
            "الربط الأساسي",
            {
                "fields": (
                    "user",
                    "user_type",
                    "role",
                    "workspace",
                )
            },
        ),
        (
            "بيانات العرض",
            {
                "fields": (
                    "display_name",
                    "full_name",
                    "avatar_url",
                    "bio",
                )
            },
        ),
        (
            "بيانات التواصل",
            {
                "fields": (
                    "phone_number",
                    "whatsapp_number",
                    "alternate_email",
                )
            },
        ),
        (
            "التفضيلات",
            {
                "fields": (
                    "preferred_language",
                    "timezone",
                )
            },
        ),
        (
            "حالات التوثيق",
            {
                "fields": (
                    "is_phone_verified",
                    "is_whatsapp_verified",
                    "is_email_verified",
                    "is_profile_completed",
                )
            },
        ),
        (
            "بيانات مرنة",
            {
                "fields": (
                    "tags",
                    "extra_data",
                )
            },
        ),
        (
            "التتبع",
            {
                "fields": (
                    "last_profile_update_at",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    actions = (
        "sync_selected_roles_from_user_type",
        "mark_selected_profiles_updated",
    )

    @admin.action(description="مزامنة الدور من نوع المستخدم للعناصر المحددة")
    def sync_selected_roles_from_user_type(self, request, queryset):
        updated = 0

        for profile in queryset:
            profile.sync_role_from_user_type(commit=True)
            updated += 1

        self.message_user(
            request,
            f"تمت مزامنة الدور لعدد {updated} ملف مستخدم.",
        )

    @admin.action(description="تحديث تاريخ آخر تعديل للملفات المحددة")
    def mark_selected_profiles_updated(self, request, queryset):
        updated = queryset.update(
            last_profile_update_at=timezone.now(),
            updated_at=timezone.now(),
        )

        self.message_user(
            request,
            f"تم تحديث تاريخ آخر تعديل لعدد {updated} ملف مستخدم.",
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
        "session_version",
        "is_current",
        "is_active",
        "ip_address",
        "last_seen",
        "logged_out_at",
        "created_at",
    )

    list_filter = (
        "auth_channel",
        "is_current",
        "is_active",
        "created_at",
        "last_seen",
        "logged_out_at",
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
    list_select_related = ("user",)
    ordering = ("-last_seen", "-created_at")

    fieldsets = (
        (
            "الربط الأساسي",
            {
                "fields": (
                    "user",
                    "session_key",
                    "session_version",
                    "auth_channel",
                )
            },
        ),
        (
            "بيانات الجهاز",
            {
                "fields": (
                    "device_name",
                    "device_id",
                    "user_agent",
                )
            },
        ),
        (
            "الشبكة والموقع",
            {
                "fields": (
                    "ip_address",
                    "location_hint",
                )
            },
        ),
        (
            "الحالة",
            {
                "fields": (
                    "is_current",
                    "is_active",
                    "logged_out_at",
                )
            },
        ),
        (
            "التتبع",
            {
                "fields": (
                    "created_at",
                    "last_seen",
                )
            },
        ),
    )

    actions = (
        "mark_sessions_inactive",
        "mark_sessions_active",
    )

    @admin.action(description="تعطيل الجلسات المحددة")
    def mark_sessions_inactive(self, request, queryset):
        now = timezone.now()
        updated = queryset.update(
            is_active=False,
            is_current=False,
            logged_out_at=now,
        )

        self.message_user(
            request,
            f"تم تعطيل {updated} جلسة.",
        )

    @admin.action(description="تفعيل الجلسات المحددة")
    def mark_sessions_active(self, request, queryset):
        updated = queryset.update(
            is_active=True,
            logged_out_at=None,
        )

        self.message_user(
            request,
            f"تم تفعيل {updated} جلسة.",
        )