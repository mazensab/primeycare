# ===============================================================
# 📂 الملف: auth_center/tests.py
# 🧭 Primey Care — Auth Center Tests
# 🚀 الإصدار: Auth Center Tests V1.0
# ---------------------------------------------------------------
# ✅ اختبارات أساسية لموديول auth_center
# ✅ اختبار إنشاء UserProfile تلقائيًا
# ✅ اختبار القيم الافتراضية للملف
# ✅ اختبار إنشاء ActiveUserSession
# ✅ اختبار تعطيل الجلسة
# ===============================================================

from django.contrib.auth import get_user_model
from django.test import TestCase

from auth_center.models import ActiveUserSession, UserProfile, UserType

User = get_user_model()


# ===============================================================
# 👤 UserProfile Tests
# ===============================================================

class UserProfileModelTests(TestCase):
    def test_profile_is_created_automatically_when_user_is_created(self):
        user = User.objects.create_user(
            username="testuser1",
            email="test1@example.com",
            password="StrongPass123",
            first_name="Primey",
            last_name="Care",
        )

        profile = UserProfile.objects.filter(user=user).first()

        self.assertIsNotNone(profile)
        self.assertEqual(profile.user, user)
        self.assertEqual(profile.user_type, UserType.OTHER)
        self.assertEqual(profile.full_name, "Primey Care")
        self.assertEqual(profile.alternate_email, "test1@example.com")

    def test_profile_defaults_are_valid(self):
        user = User.objects.create_user(
            username="testuser2",
            email="test2@example.com",
            password="StrongPass123",
        )

        profile = user.profile

        self.assertEqual(profile.display_name, "testuser2")
        self.assertEqual(profile.preferred_language, "ar")
        self.assertEqual(profile.timezone, "Asia/Riyadh")
        self.assertEqual(profile.tags, [])
        self.assertEqual(profile.extra_data, {})
        self.assertFalse(profile.is_phone_verified)
        self.assertFalse(profile.is_whatsapp_verified)
        self.assertFalse(profile.is_email_verified)
        self.assertFalse(profile.is_profile_completed)

    def test_profile_string_representation(self):
        user = User.objects.create_user(
            username="testuser3",
            email="test3@example.com",
            password="StrongPass123",
        )

        profile = user.profile
        profile.display_name = "عرض المستخدم"
        profile.save(update_fields=["display_name"])

        self.assertEqual(str(profile), "عرض المستخدم")


# ===============================================================
# 🔐 ActiveUserSession Tests
# ===============================================================

class ActiveUserSessionModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="sessionuser",
            email="session@example.com",
            password="StrongPass123",
        )

    def test_can_create_active_session(self):
        session = ActiveUserSession.objects.create(
            user=self.user,
            session_key="session-key-001",
            session_version=1,
            auth_channel=ActiveUserSession.AuthChannel.WEB,
            ip_address="127.0.0.1",
            user_agent="Mozilla/5.0",
            device_name="Chrome on Windows",
            device_id="device-001",
            location_hint="Jeddah",
            is_current=True,
            is_active=True,
        )

        self.assertEqual(session.user, self.user)
        self.assertEqual(session.session_key, "session-key-001")
        self.assertEqual(session.auth_channel, ActiveUserSession.AuthChannel.WEB)
        self.assertTrue(session.is_current)
        self.assertTrue(session.is_active)

    def test_mark_logged_out_disables_session(self):
        session = ActiveUserSession.objects.create(
            user=self.user,
            session_key="session-key-002",
            auth_channel=ActiveUserSession.AuthChannel.WEB,
            is_current=True,
            is_active=True,
        )

        session.mark_logged_out()
        session.refresh_from_db()

        self.assertFalse(session.is_active)
        self.assertFalse(session.is_current)
        self.assertIsNotNone(session.logged_out_at)