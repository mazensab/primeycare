# ===============================================================
# 📂 الملف: auth_center/tests.py
# 🧭 Primey Care — Auth Center Tests
# 🚀 الإصدار: Auth Center Tests V1.1
# ---------------------------------------------------------------
# ✅ اختبارات أساسية لموديول auth_center
# ✅ اختبار إنشاء UserProfile تلقائيًا
# ✅ اختبار القيم الافتراضية للملف
# ✅ اختبار إنشاء ActiveUserSession
# ✅ اختبار تعطيل الجلسة
# ✅ اختبار خدمات إنشاء مستخدمي Primey Care
# ===============================================================

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError
from django.test import TestCase

from auth_center.models import ActiveUserSession, UserProfile, UserType
from auth_center.services import (
    create_accountant_user,
    create_actor_user,
    create_agent_user,
    create_broker_user,
    create_center_user,
    create_customer_user,
    create_provider_user,
    create_staff_user,
)

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


# ===============================================================
# 🧩 Auth Center Services Tests
# ===============================================================

class AuthCenterServicesTests(TestCase):
    def test_create_customer_user_creates_user_profile_group_and_entity_data(self):
        result = create_customer_user(
            customer_id=12,
            email="customer@example.com",
            display_name="عميل تجريبي",
            phone_number="+966500000001",
            whatsapp_number="+966500000001",
        )

        user = result.user
        profile = result.profile

        self.assertTrue(result.created)
        self.assertIsNotNone(result.temporary_password)
        self.assertEqual(result.group_name, "CUSTOMER")
        self.assertEqual(result.entity_type, "customer")
        self.assertEqual(result.entity_id, 12)

        self.assertEqual(user.email, "customer@example.com")
        self.assertTrue(user.check_password(result.temporary_password))
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.is_active)

        self.assertEqual(profile.user_type, UserType.CUSTOMER)
        self.assertEqual(profile.display_name, "عميل تجريبي")
        self.assertEqual(profile.phone_number, "+966500000001")
        self.assertEqual(profile.whatsapp_number, "+966500000001")
        self.assertEqual(profile.extra_data.get("customer_id"), 12)
        self.assertEqual(profile.extra_data.get("entity_type"), "customer")
        self.assertEqual(profile.extra_data.get("entity_id"), 12)
        self.assertTrue(profile.is_profile_completed)

        self.assertTrue(Group.objects.filter(name="CUSTOMER").exists())
        self.assertTrue(user.groups.filter(name="CUSTOMER").exists())

    def test_create_center_user_routes_to_center_entity(self):
        result = create_center_user(
            center_id=7,
            email="center@example.com",
            display_name="مركز النخبة الطبي",
            phone_number="+966500000002",
        )

        user = result.user
        profile = result.profile

        self.assertTrue(result.created)
        self.assertEqual(result.group_name, "CENTER")
        self.assertEqual(result.entity_type, "center")
        self.assertEqual(result.entity_id, 7)

        self.assertEqual(profile.user_type, UserType.CENTER)
        self.assertEqual(profile.extra_data.get("center_id"), 7)
        self.assertEqual(profile.extra_data.get("entity_type"), "center")
        self.assertEqual(profile.extra_data.get("entity_id"), 7)

        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.groups.filter(name="CENTER").exists())

    def test_create_provider_user_routes_to_provider_entity(self):
        result = create_provider_user(
            provider_id=9,
            email="provider@example.com",
            display_name="مقدم خدمة تجريبي",
            phone_number="+966500000003",
        )

        user = result.user
        profile = result.profile

        self.assertTrue(result.created)
        self.assertEqual(result.group_name, "PROVIDER")
        self.assertEqual(result.entity_type, "provider")
        self.assertEqual(result.entity_id, 9)

        self.assertEqual(profile.user_type, UserType.PROVIDER)
        self.assertEqual(profile.extra_data.get("provider_id"), 9)
        self.assertEqual(profile.extra_data.get("entity_type"), "provider")
        self.assertEqual(profile.extra_data.get("entity_id"), 9)

        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.groups.filter(name="PROVIDER").exists())

    def test_create_agent_user_routes_to_agent_entity(self):
        result = create_agent_user(
            agent_id=5,
            email="agent@example.com",
            display_name="مندوب جدة",
            phone_number="+966500000004",
        )

        user = result.user
        profile = result.profile

        self.assertTrue(result.created)
        self.assertEqual(result.group_name, "AGENT")
        self.assertEqual(result.entity_type, "agent")
        self.assertEqual(result.entity_id, 5)

        self.assertEqual(profile.user_type, UserType.AGENT)
        self.assertEqual(profile.extra_data.get("agent_id"), 5)
        self.assertEqual(profile.extra_data.get("entity_type"), "agent")
        self.assertEqual(profile.extra_data.get("entity_id"), 5)

        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.groups.filter(name="AGENT").exists())

    def test_create_broker_user_routes_to_broker_entity(self):
        result = create_broker_user(
            broker_id=3,
            email="broker@example.com",
            display_name="وكيل جدة",
            phone_number="+966500000005",
        )

        user = result.user
        profile = result.profile

        self.assertTrue(result.created)
        self.assertEqual(result.group_name, "BROKER")
        self.assertEqual(result.entity_type, "broker")
        self.assertEqual(result.entity_id, 3)

        self.assertEqual(profile.user_type, UserType.BROKER)
        self.assertEqual(profile.extra_data.get("broker_id"), 3)
        self.assertEqual(profile.extra_data.get("entity_type"), "broker")
        self.assertEqual(profile.extra_data.get("entity_id"), 3)

        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.groups.filter(name="BROKER").exists())

    def test_create_accountant_user_is_staff_and_system_scope(self):
        result = create_accountant_user(
            email="accountant@example.com",
            display_name="محاسب النظام",
            phone_number="+966500000006",
        )

        user = result.user
        profile = result.profile

        self.assertTrue(result.created)
        self.assertEqual(result.group_name, "ACCOUNTANT")
        self.assertEqual(result.entity_type, "system")
        self.assertIsNone(result.entity_id)

        self.assertEqual(profile.user_type, UserType.ACCOUNTANT)
        self.assertEqual(profile.extra_data.get("entity_type"), "system")
        self.assertNotIn("entity_id", profile.extra_data)

        self.assertTrue(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.groups.filter(name="ACCOUNTANT").exists())

    def test_create_staff_user_is_staff(self):
        result = create_staff_user(
            email="staff@example.com",
            display_name="موظف النظام",
            phone_number="+966500000007",
        )

        user = result.user
        profile = result.profile

        self.assertTrue(result.created)
        self.assertEqual(result.group_name, "STAFF")
        self.assertEqual(result.entity_type, "system")
        self.assertIsNone(result.entity_id)

        self.assertEqual(profile.user_type, UserType.STAFF)
        self.assertTrue(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.groups.filter(name="STAFF").exists())

    def test_create_super_admin_user_is_staff_and_superuser(self):
        result = create_actor_user(
            user_type=UserType.SUPER_ADMIN,
            email="superadmin@example.com",
            display_name="سوبر أدمن",
            phone_number="+966500000008",
        )

        user = result.user
        profile = result.profile

        self.assertTrue(result.created)
        self.assertEqual(result.group_name, "SUPER_ADMIN")
        self.assertEqual(result.entity_type, "system")
        self.assertIsNone(result.entity_id)

        self.assertEqual(profile.user_type, UserType.SUPER_ADMIN)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.groups.filter(name="SUPER_ADMIN").exists())

    def test_create_actor_user_with_custom_password_does_not_return_temporary_password(self):
        result = create_customer_user(
            customer_id=20,
            email="custom-password@example.com",
            display_name="عميل بكلمة مرور مخصصة",
            password="StrongCustomPass123!",
        )

        self.assertTrue(result.created)
        self.assertIsNone(result.temporary_password)
        self.assertTrue(result.user.check_password("StrongCustomPass123!"))

    def test_create_actor_user_updates_existing_user_without_duplicate(self):
        first_result = create_customer_user(
            customer_id=30,
            email="duplicate@example.com",
            display_name="الاسم الأول",
            phone_number="+966500000009",
        )

        second_result = create_customer_user(
            customer_id=31,
            email="duplicate@example.com",
            display_name="الاسم الثاني",
            phone_number="+966500000010",
        )

        self.assertTrue(first_result.created)
        self.assertFalse(second_result.created)

        self.assertEqual(User.objects.filter(email__iexact="duplicate@example.com").count(), 1)

        user = second_result.user
        profile = user.profile

        self.assertEqual(first_result.user.id, second_result.user.id)
        self.assertEqual(profile.display_name, "الاسم الثاني")
        self.assertEqual(profile.phone_number, "+966500000010")
        self.assertEqual(profile.user_type, UserType.CUSTOMER)
        self.assertEqual(profile.extra_data.get("customer_id"), 31)
        self.assertEqual(profile.extra_data.get("entity_type"), "customer")
        self.assertEqual(profile.extra_data.get("entity_id"), 31)

    def test_create_actor_user_can_disable_group_creation(self):
        result = create_customer_user(
            customer_id=40,
            email="no-group@example.com",
            display_name="عميل بدون مجموعة",
            create_group=False,
        )

        self.assertTrue(result.created)
        self.assertIsNone(result.group_name)
        self.assertFalse(result.user.groups.exists())
        self.assertFalse(Group.objects.filter(name="CUSTOMER").exists())

    def test_create_actor_user_rejects_invalid_user_type(self):
        with self.assertRaises(ValidationError):
            create_actor_user(
                user_type="INVALID_TYPE",
                email="invalid@example.com",
                display_name="نوع غير صحيح",
            )

    def test_create_actor_user_rejects_invalid_email(self):
        with self.assertRaises(ValidationError):
            create_customer_user(
                customer_id=50,
                email="invalid-email",
                display_name="بريد غير صحيح",
            )

    def test_create_actor_user_rejects_invalid_language(self):
        with self.assertRaises(ValidationError):
            create_customer_user(
                customer_id=60,
                email="invalid-language@example.com",
                display_name="لغة غير صحيحة",
                preferred_language="fr",
            )

    def test_create_actor_user_with_update_existing_false_raises_when_user_exists(self):
        create_customer_user(
            customer_id=70,
            email="exists@example.com",
            display_name="مستخدم موجود",
        )

        with self.assertRaises(ValidationError):
            create_customer_user(
                customer_id=71,
                email="exists@example.com",
                display_name="مستخدم مكرر",
                update_existing=False,
            )