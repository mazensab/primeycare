# ============================================================
# 📂 providers/models.py
# 🧠 Primey Care | Providers Module
# ------------------------------------------------------------
# ✅ الجهات المقدمة للخدمة:
#    - مستشفيات
#    - مراكز
#    - صيدليات
#    - شركاء
# ✅ هذا هو الأساس التشغيلي الأول للموديول
# ✅ سيتم لاحقًا ربطه مع:
#    - العقود
#    - البرامج
#    - الخصومات
#    - الخدمات
#    - الطلبات والتنفيذ
# ------------------------------------------------------------
# ملاحظات:
# - حافظنا على التصميم بسيطًا ونظيفًا كبداية صحيحة
# - أضفنا حقولًا عملية قابلة للتوسع لاحقًا
# - جاهز للإدارة من Django Admin
# ============================================================

from django.db import models


class ProviderType(models.TextChoices):
    HOSPITAL = "HOSPITAL", "مستشفى"
    MEDICAL_CENTER = "MEDICAL_CENTER", "مركز طبي"
    PHARMACY = "PHARMACY", "صيدلية"
    PARTNER = "PARTNER", "شريك"
    LAB = "LAB", "مختبر"
    CLINIC = "CLINIC", "عيادة"
    OTHER = "OTHER", "أخرى"


class ProviderStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "نشط"
    INACTIVE = "INACTIVE", "غير نشط"
    SUSPENDED = "SUSPENDED", "موقوف"
    DRAFT = "DRAFT", "مسودة"


class Provider(models.Model):
    # ========================================================
    # 🆔 البيانات الأساسية
    # ========================================================
    name = models.CharField(
        max_length=255,
        unique=True,
        verbose_name="اسم الجهة",
        help_text="الاسم الرسمي للجهة المقدمة للخدمة",
    )
    code = models.CharField(
        max_length=50,
        unique=True,
        verbose_name="كود الجهة",
        help_text="كود داخلي فريد للربط والإدارة",
    )
    provider_type = models.CharField(
        max_length=30,
        choices=ProviderType.choices,
        default=ProviderType.OTHER,
        verbose_name="نوع الجهة",
    )
    status = models.CharField(
        max_length=20,
        choices=ProviderStatus.choices,
        default=ProviderStatus.ACTIVE,
        verbose_name="الحالة",
    )

    # ========================================================
    # 📞 بيانات التواصل
    # ========================================================
    contact_person = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="الشخص المسؤول",
    )
    phone = models.CharField(
        max_length=30,
        blank=True,
        verbose_name="رقم الهاتف",
    )
    mobile = models.CharField(
        max_length=30,
        blank=True,
        verbose_name="رقم الجوال",
    )
    email = models.EmailField(
        blank=True,
        verbose_name="البريد الإلكتروني",
    )
    website = models.URLField(
        blank=True,
        verbose_name="الموقع الإلكتروني",
    )

    # ========================================================
    # 📍 بيانات الموقع
    # ========================================================
    city = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="المدينة",
    )
    area = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="الحي / المنطقة",
    )
    address = models.TextField(
        blank=True,
        verbose_name="العنوان",
    )
    google_maps_link = models.URLField(
        blank=True,
        verbose_name="رابط خرائط جوجل",
    )

    # ========================================================
    # 💼 بيانات تشغيلية
    # ========================================================
    notes = models.TextField(
        blank=True,
        verbose_name="ملاحظات",
    )
    is_featured = models.BooleanField(
        default=False,
        verbose_name="جهة مميزة",
        help_text="تستخدم لإبراز الجهة في الواجهات أو العروض",
    )

    # ========================================================
    # 🕒 التتبع الزمني
    # ========================================================
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="تاريخ الإنشاء",
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="آخر تحديث",
    )

    class Meta:
        db_table = "providers"
        verbose_name = "جهة خدمة"
        verbose_name_plural = "جهات الخدمة"
        ordering = ["name"]
        indexes = [
            models.Index(fields=["provider_type"]),
            models.Index(fields=["status"]),
            models.Index(fields=["city"]),
            models.Index(fields=["is_featured"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"