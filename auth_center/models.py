# ===============================================================
# 📂 الملف: auth_center/models.py
# 🧭 Primey Care — Auth Center Models
# 🚀 الإصدار: Primey Care Auth Core V1.3
# ---------------------------------------------------------------
# ✅ نواة هوية عامة تخدم:
#    - سوبر أدمن النظام
#    - المحاسبين
#    - موظفي الدعم
#    - مستخدمي القراءة فقط
#    - العملاء
#    - المندوبين
#    - الوسطاء / الوكلاء
#    - المراكز
#    - مزودي الخدمة
#    - أي Actor مستقبلي داخل المنصة
# ---------------------------------------------------------------
# ✅ بدون أي ربط مباشر مع HR / Company / Billing
# ✅ قابلة للتوسع بدون إعادة بناء لاحقة
# ✅ تدعم جلسات نشطة متعددة وتتبع الهوية العامة
# ✅ متوافقة مع مساحات Primey Care:
#    /system
#    /provider
#    /customer
#    /agent
# ---------------------------------------------------------------
# ✅ V1.3:
#    - إضافة RoleChoices.BROKER_USER كدور مستقل للوسيط
#    - الإبقاء على UserType.BROKER كتوافق تشغيلي
#    - جعل وسيط النظام يملك role مستقل broker_user بدل agent_user
# ===============================================================

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

User = get_user_model()


# ===============================================================
# 🎭 User Type Choices
# ===============================================================

class UserType(models.TextChoices):
    """
    نوع المستخدم العام داخل Primey Care.

    هذا الحقل يصف نوع الـ Actor التشغيلي داخل المنصة.
    أما الصلاحيات الفعلية فيتم التحكم بها عبر UserProfile.role.

    ملاحظة مهمة:
    - COMPANY أبقيناه كتوافق خلفي فقط حتى لا نكسر أي بيانات أو اختبارات قديمة.
    - المساحات الرسمية الجديدة في الواجهة:
        SYSTEM / SUPER_ADMIN / STAFF / ACCOUNTANT -> /system
        PROVIDER / CENTER                         -> /provider
        CUSTOMER                                  -> /customer
        AGENT / BROKER                            -> /agent
    """

    SUPER_ADMIN = "SUPER_ADMIN", "Super Admin"
    SYSTEM = "SYSTEM", "System User"
    STAFF = "STAFF", "Staff"
    ACCOUNTANT = "ACCOUNTANT", "Accountant"

    CUSTOMER = "CUSTOMER", "Customer"

    AGENT = "AGENT", "Agent"
    BROKER = "BROKER", "Broker"

    PROVIDER = "PROVIDER", "Provider"
    CENTER = "CENTER", "Center"

    PARTNER = "PARTNER", "Partner"

    # توافق خلفي مؤقت
    COMPANY = "COMPANY", "Company User"

    OTHER = "OTHER", "Other"


# ===============================================================
# 🛡️ Role Choices
# ===============================================================

class RoleChoices(models.TextChoices):
    """
    الدور الرسمي المعتمد للصلاحيات داخل Primey Care.

    هذا هو الحقل الذي ستعتمد عليه:
    - Backend permission checks
    - Frontend guards
    - Sidebar permissions
    - Action permissions

    ملاحظة:
    - agent_user مخصص للمندوب.
    - broker_user مخصص للوسيط / الوكيل.
    - كلاهما حاليًا يفتح مساحة /agent، لكن الصلاحيات والسياق يختلفان.
    """

    SYSTEM_ADMIN = "system_admin", "System Admin"
    PROVIDER_ADMIN = "provider_admin", "Provider Admin"
    CUSTOMER_USER = "customer_user", "Customer User"
    AGENT_USER = "agent_user", "Agent User"
    BROKER_USER = "broker_user", "Broker User"
    ACCOUNTANT = "accountant", "Accountant"
    SUPPORT = "support", "Support"
    VIEWER = "viewer", "Viewer"


DEFAULT_ROLE_BY_USER_TYPE = {
    UserType.SUPER_ADMIN: RoleChoices.SYSTEM_ADMIN,
    UserType.SYSTEM: RoleChoices.SUPPORT,
    UserType.STAFF: RoleChoices.SUPPORT,
    UserType.ACCOUNTANT: RoleChoices.ACCOUNTANT,
    UserType.CUSTOMER: RoleChoices.CUSTOMER_USER,
    UserType.AGENT: RoleChoices.AGENT_USER,
    UserType.BROKER: RoleChoices.BROKER_USER,
    UserType.PROVIDER: RoleChoices.PROVIDER_ADMIN,
    UserType.CENTER: RoleChoices.PROVIDER_ADMIN,
    UserType.PARTNER: RoleChoices.VIEWER,
    UserType.COMPANY: RoleChoices.VIEWER,
    UserType.OTHER: RoleChoices.VIEWER,
}


def resolve_default_role_for_user_type(user_type: str | None) -> str:
    """
    إرجاع الدور الافتراضي المناسب بناءً على user_type القديم.
    """
    normalized_user_type = str(user_type or UserType.OTHER).upper()
    return str(DEFAULT_ROLE_BY_USER_TYPE.get(normalized_user_type, RoleChoices.VIEWER))


# ===============================================================
# 👤 Universal User Profile
# ===============================================================

class UserProfile(models.Model):
    """
    👤 ملف هوية عام للمستخدم داخل المنصة.

    هذا الملف هو الطبقة الموحدة للبيانات العامة المشتركة بين جميع أنواع المستخدمين.
    لا يحتوي على ربط مباشر مع company / employee / customer / agent / center / provider
    لأن هذا الربط يجب أن يبقى داخل الموديولات المتخصصة أو داخل extra_data بشكل مرن.
    """

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile",
        verbose_name="المستخدم",
    )

    # -----------------------------------------------------------
    # 🧭 التصنيف العام للمستخدم
    # -----------------------------------------------------------
    user_type = models.CharField(
        max_length=30,
        choices=UserType.choices,
        default=UserType.OTHER,
        db_index=True,
        verbose_name="نوع المستخدم",
    )

    # -----------------------------------------------------------
    # 🛡️ الدور الرسمي للصلاحيات
    # -----------------------------------------------------------
    role = models.CharField(
        max_length=50,
        choices=RoleChoices.choices,
        default=RoleChoices.VIEWER,
        db_index=True,
        verbose_name="الدور",
        help_text="الدور الرسمي المستخدم للصلاحيات والسايدر والحماية في الواجهة والباك إند.",
    )

    # -----------------------------------------------------------
    # 🪪 بيانات العرض العامة
    # -----------------------------------------------------------
    display_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        verbose_name="الاسم المعروض",
        help_text="اسم العرض العام المستخدم في الواجهات والإشعارات.",
    )

    avatar_url = models.URLField(
        blank=True,
        null=True,
        verbose_name="رابط الصورة",
    )

    bio = models.TextField(
        blank=True,
        default="",
        verbose_name="نبذة مختصرة",
    )

    # -----------------------------------------------------------
    # 📱 بيانات التواصل العامة
    # -----------------------------------------------------------
    phone_number = models.CharField(
        max_length=30,
        blank=True,
        null=True,
        db_index=True,
        verbose_name="رقم الجوال",
    )

    whatsapp_number = models.CharField(
        max_length=30,
        blank=True,
        null=True,
        db_index=True,
        verbose_name="رقم واتساب",
    )

    alternate_email = models.EmailField(
        blank=True,
        null=True,
        verbose_name="بريد إلكتروني بديل",
    )

    # -----------------------------------------------------------
    # 🌍 تفضيلات عامة
    # -----------------------------------------------------------
    preferred_language = models.CharField(
        max_length=10,
        default="ar",
        verbose_name="اللغة المفضلة",
    )

    timezone = models.CharField(
        max_length=64,
        default="Asia/Riyadh",
        verbose_name="المنطقة الزمنية",
    )

    # -----------------------------------------------------------
    # 🔐 حالات عامة
    # -----------------------------------------------------------
    is_phone_verified = models.BooleanField(
        default=False,
        verbose_name="تم توثيق الجوال",
    )

    is_whatsapp_verified = models.BooleanField(
        default=False,
        verbose_name="تم توثيق الواتساب",
    )

    is_email_verified = models.BooleanField(
        default=False,
        verbose_name="تم توثيق البريد",
    )

    is_profile_completed = models.BooleanField(
        default=False,
        verbose_name="الملف مكتمل",
    )

    # -----------------------------------------------------------
    # 🧩 امتدادات مرنة
    # -----------------------------------------------------------
    tags = models.JSONField(
        default=list,
        blank=True,
        verbose_name="وسوم",
        help_text="وسوم مرنة لتصنيف المستخدم لاحقًا بدون تعديل البنية.",
    )

    extra_data = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بيانات إضافية",
        help_text="أي بيانات عامة إضافية لا تستحق إنشاء أعمدة مستقلة لها.",
    )

    # -----------------------------------------------------------
    # 🕒 حقول التتبع
    # -----------------------------------------------------------
    last_profile_update_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="آخر تحديث للملف",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="تاريخ الإنشاء",
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="آخر تحديث",
    )

    def __str__(self) -> str:
        return self.display_name or self.user.get_username()

    @property
    def full_name(self) -> str:
        """
        اسم العرض النهائي:
        1) display_name
        2) Django full name
        3) username
        """
        if self.display_name:
            return self.display_name.strip()

        full_name = (self.user.get_full_name() or "").strip()
        if full_name:
            return full_name

        return self.user.get_username()

    @property
    def workspace(self) -> str:
        """
        المساحة الافتراضية حسب الدور.
        """
        if self.role in {
            RoleChoices.SYSTEM_ADMIN,
            RoleChoices.ACCOUNTANT,
            RoleChoices.SUPPORT,
            RoleChoices.VIEWER,
        }:
            return "system"

        if self.role == RoleChoices.PROVIDER_ADMIN:
            return "provider"

        if self.role == RoleChoices.CUSTOMER_USER:
            return "customer"

        if self.role in {RoleChoices.AGENT_USER, RoleChoices.BROKER_USER}:
            return "agent"

        return "system"

    @property
    def is_system_user(self) -> bool:
        return self.workspace == "system"

    @property
    def is_provider_user(self) -> bool:
        return self.role == RoleChoices.PROVIDER_ADMIN

    @property
    def is_customer_user(self) -> bool:
        return self.role == RoleChoices.CUSTOMER_USER

    @property
    def is_agent_user(self) -> bool:
        return self.role == RoleChoices.AGENT_USER

    @property
    def is_broker_user(self) -> bool:
        return self.role == RoleChoices.BROKER_USER

    def sync_role_from_user_type(self, commit: bool = True) -> None:
        """
        ضبط الدور بناءً على user_type عند الحاجة.
        لا تستخدم هذه الدالة لتغيير صلاحية مخصصة يدويًا إلا عند إنشاء المستخدم أو التصحيح.
        """
        self.role = resolve_default_role_for_user_type(self.user_type)
        if commit:
            self.save(update_fields=["role", "updated_at"])

    def mark_profile_updated(self, commit: bool = True) -> None:
        """
        تحديث تاريخ آخر تعديل على الملف.
        """
        self.last_profile_update_at = timezone.now()
        if commit:
            self.save(update_fields=["last_profile_update_at", "updated_at"])

    class Meta:
        verbose_name = "ملف المستخدم"
        verbose_name_plural = "ملفات المستخدمين"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user_type"]),
            models.Index(fields=["role"]),
            models.Index(fields=["phone_number"]),
            models.Index(fields=["whatsapp_number"]),
            models.Index(fields=["created_at"]),
        ]


# ===============================================================
# 🔐 Active User Session Registry
# ===============================================================

class ActiveUserSession(models.Model):
    """
    🔐 تسجيل الجلسات النشطة داخل النظام.

    ✔ يدعم Multi-Login
    ✔ يدعم Session Monitor
    ✔ يدعم Force Logout
    ✔ يدعم Version Sync
    ✔ لا يؤثر على Django Session Engine
    ✔ مناسب للويب حاليًا وقابل للتوسع لاحقًا للموبايل/الأجهزة
    """

    class AuthChannel(models.TextChoices):
        WEB = "WEB", "Web"
        MOBILE = "MOBILE", "Mobile"
        API = "API", "API"
        OTHER = "OTHER", "Other"

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="active_sessions",
        verbose_name="المستخدم",
    )

    session_key = models.CharField(
        max_length=128,
        unique=True,
        verbose_name="Session Key",
    )

    session_version = models.PositiveIntegerField(
        default=1,
        verbose_name="Session Version",
    )

    auth_channel = models.CharField(
        max_length=20,
        choices=AuthChannel.choices,
        default=AuthChannel.WEB,
        db_index=True,
        verbose_name="قناة الدخول",
    )

    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        verbose_name="IP Address",
    )

    user_agent = models.TextField(
        null=True,
        blank=True,
        verbose_name="User Agent",
    )

    device_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        verbose_name="اسم الجهاز",
    )

    device_id = models.CharField(
        max_length=255,
        blank=True,
        default="",
        verbose_name="معرف الجهاز",
    )

    location_hint = models.CharField(
        max_length=255,
        blank=True,
        default="",
        verbose_name="مؤشر الموقع",
    )

    is_current = models.BooleanField(
        default=False,
        verbose_name="الجلسة الحالية",
    )

    is_active = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name="نشطة",
    )

    logged_out_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="وقت تسجيل الخروج",
    )

    last_seen = models.DateTimeField(
        auto_now=True,
        verbose_name="آخر نشاط",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="تاريخ الإنشاء",
    )

    def __str__(self) -> str:
        return f"{self.user.get_username()} — {self.session_key}"

    def mark_logged_out(self, commit: bool = True) -> None:
        """
        تعطيل الجلسة بشكل صريح.
        """
        self.is_active = False
        self.is_current = False
        self.logged_out_at = timezone.now()

        if commit:
            self.save(
                update_fields=[
                    "is_active",
                    "is_current",
                    "logged_out_at",
                    "last_seen",
                ]
            )

    class Meta:
        verbose_name = "جلسة مستخدم نشطة"
        verbose_name_plural = "الجلسات النشطة"
        ordering = ["-last_seen", "-created_at"]
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["session_key"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["auth_channel"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["last_seen"]),
        ]


# ===============================================================
# 🔁 Auto Create / Sync UserProfile
# ===============================================================

@receiver(post_save, sender=User)
def ensure_user_profile(sender, instance, created, **kwargs):
    """
    إنشاء ملف UserProfile تلقائيًا لجميع المستخدمين.

    الهدف:
    - جعل auth_center طبقة موحدة ثابتة لكل actor يدخل النظام
    - منع الحاجة لإدارة يدوية للـ profile في كل موديول
    """
    if created:
        display_name = (instance.get_full_name() or "").strip() or instance.get_username()

        UserProfile.objects.get_or_create(
            user=instance,
            defaults={
                "display_name": display_name,
                "alternate_email": instance.email or None,
                "user_type": UserType.OTHER,
                "role": RoleChoices.VIEWER,
            },
        )
        return

    profile, _ = UserProfile.objects.get_or_create(user=instance)

    dirty_fields: list[str] = []

    desired_display_name = (instance.get_full_name() or "").strip() or instance.get_username()
    if not profile.display_name and desired_display_name:
        profile.display_name = desired_display_name
        dirty_fields.append("display_name")

    if not profile.role:
        profile.role = resolve_default_role_for_user_type(profile.user_type)
        dirty_fields.append("role")

    if instance.email and profile.alternate_email != instance.email:
        if not profile.alternate_email:
            profile.alternate_email = instance.email
            dirty_fields.append("alternate_email")

    if dirty_fields:
        dirty_fields.append("updated_at")
        profile.save(update_fields=dirty_fields)