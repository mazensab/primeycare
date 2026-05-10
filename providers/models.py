# ============================================================
# 📂 providers/models.py
# 🧠 Primey Care | Providers Module
# ------------------------------------------------------------
# ✅ الجهات المقدمة للخدمة:
#    - مستشفيات
#    - مراكز طبية
#    - عيادات
#    - مختبرات
#    - صيدليات
#    - شركاء
# ✅ يدعم الإدخال اليدوي من النظام
# ✅ يدعم الاستيراد من ملفات Excel للشبكة الطبية
# ✅ يمنع التكرار عبر import_key بدل الاعتماد على الاسم فقط
# ✅ يسمح بتحديث بيانات الجهة عند إعادة الاستيراد
# ✅ يدعم الاسم العربي والإنجليزي بشكل مستقل
# ✅ يدعم السجل التجاري والرقم الضريبي
# ✅ يدعم صورة وشعار مقدم الخدمة عبر Google Drive
# ✅ يدعم مجلد مستقل ومرفقات لكل مقدم خدمة في Google Drive
# ------------------------------------------------------------
# ملاحظات مهمة:
# - name يبقى موجودًا للتوافق الخلفي مع كل الصفحات والـ APIs الحالية.
# - name_ar و name_en تستخدم للفصل الواضح بين الاسم العربي والإنجليزي.
# - code يبقى unique لأنه كود داخلي للنظام.
# - import_key هو المفتاح الآمن لمنع تكرار سجلات Excel.
# - ProviderDocument يخزن ملفات مقدم الخدمة بدون تضخيم جدول Provider.
# ============================================================

from django.conf import settings
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


class ProviderDocumentType(models.TextChoices):
    LOGO = "logo", "شعار مقدم الخدمة"
    IMAGE = "image", "صورة مقدم الخدمة"
    PRODUCT_IMAGE = "product_image", "صورة منتج / خدمة"
    CONTRACT_FILE = "contract_file", "ملف عقد"
    COMMERCIAL_REGISTRATION = "commercial_registration", "ملف السجل التجاري"
    TAX_CERTIFICATE = "tax_certificate", "الشهادة الضريبية"
    LICENSE = "license", "ترخيص"
    OTHER = "other", "ملف آخر"


class Provider(models.Model):
    # ========================================================
    # 🆔 البيانات الأساسية
    # ========================================================
    name = models.CharField(
        max_length=255,
        verbose_name="اسم الجهة",
        help_text="اسم الجهة المستخدم للتوافق الخلفي والبحث العام",
    )
    name_ar = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="اسم الجهة بالعربي",
        help_text="الاسم العربي الرسمي لمقدم الخدمة",
    )
    name_en = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="اسم الجهة بالإنجليزي",
        help_text="الاسم الإنجليزي الرسمي لمقدم الخدمة",
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
    # 🧾 البيانات النظامية / الضريبية
    # ========================================================
    commercial_registration = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="السجل التجاري",
        help_text="رقم السجل التجاري لمقدم الخدمة",
    )
    tax_number = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="الرقم الضريبي",
        help_text="الرقم الضريبي / رقم ضريبة القيمة المضافة",
    )

    # ========================================================
    # 🖼️ الهوية البصرية والملفات الرئيسية
    # ========================================================
    logo_url = models.URLField(
        max_length=1000,
        blank=True,
        verbose_name="رابط شعار مقدم الخدمة",
        help_text="الرابط العام للشعار بعد رفعه إلى Google Drive",
    )
    logo_drive_file_id = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Google Drive File ID للشعار",
    )
    image_url = models.URLField(
        max_length=1000,
        blank=True,
        verbose_name="رابط صورة مقدم الخدمة",
        help_text="الرابط العام للصورة بعد رفعها إلى Google Drive",
    )
    image_drive_file_id = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Google Drive File ID للصورة",
    )

    # ========================================================
    # 📁 Google Drive
    # ========================================================
    drive_folder_id = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Google Drive Folder ID",
        help_text="معرف مجلد مقدم الخدمة في Google Drive",
    )
    drive_folder_url = models.URLField(
        max_length=1000,
        blank=True,
        verbose_name="رابط مجلد Google Drive",
        help_text="الرابط العام أو الإداري لمجلد مقدم الخدمة في Google Drive",
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
    region = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="المنطقة",
        help_text="المنطقة الإدارية القادمة من ملف الشبكة أو الإدخال اليدوي",
    )
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
    street = models.CharField(
        max_length=150,
        blank=True,
        verbose_name="الشارع",
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
    # 🏷️ بيانات التصنيف والاستيراد
    # ========================================================
    source_category = models.CharField(
        max_length=150,
        blank=True,
        verbose_name="التصنيف من المصدر",
        help_text="التصنيف كما ورد في ملف Excel مثل مستشفى، مجمع، عيادة، مختبر",
    )
    import_key = models.CharField(
        max_length=500,
        blank=True,
        null=True,
        unique=True,
        verbose_name="مفتاح الاستيراد",
        help_text="مفتاح داخلي يمنع تكرار السجل عند الاستيراد من Excel",
    )
    import_source = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="مصدر الاستيراد",
        help_text="مثال: medical_network_excel",
    )
    external_reference = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="مرجع خارجي",
        help_text="رقم أو معرف خارجي من الملف عند توفره",
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
    last_imported_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="آخر استيراد",
        help_text="آخر مرة تم فيها إنشاء أو تحديث السجل من ملف استيراد",
    )
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
        ordering = ["name", "city", "area"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["name_ar"]),
            models.Index(fields=["name_en"]),
            models.Index(fields=["code"]),
            models.Index(fields=["provider_type"]),
            models.Index(fields=["status"]),
            models.Index(fields=["commercial_registration"]),
            models.Index(fields=["tax_number"]),
            models.Index(fields=["region"]),
            models.Index(fields=["city"]),
            models.Index(fields=["area"]),
            models.Index(fields=["source_category"]),
            models.Index(fields=["import_key"]),
            models.Index(fields=["import_source"]),
            models.Index(fields=["is_featured"]),
            models.Index(fields=["drive_folder_id"]),
        ]

    def __str__(self):
        location = self.city or self.region or "-"
        display_name = self.name_ar or self.name or self.name_en or "-"
        return f"{display_name} ({self.code}) - {location}"

    @property
    def display_name_ar(self) -> str:
        return self.name_ar or self.name or ""

    @property
    def display_name_en(self) -> str:
        return self.name_en or self.name or ""


class ProviderDocument(models.Model):
    # ========================================================
    # 📎 مرفقات مقدم الخدمة
    # ========================================================
    provider = models.ForeignKey(
        Provider,
        on_delete=models.CASCADE,
        related_name="documents",
        verbose_name="مقدم الخدمة",
    )
    file_type = models.CharField(
        max_length=50,
        choices=ProviderDocumentType.choices,
        default=ProviderDocumentType.OTHER,
        verbose_name="نوع الملف",
    )
    title = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="عنوان الملف",
    )
    description = models.TextField(
        blank=True,
        verbose_name="وصف الملف",
    )

    # ========================================================
    # 🔗 Google Drive File Data
    # ========================================================
    file_url = models.URLField(
        max_length=1000,
        verbose_name="رابط الملف",
    )
    drive_file_id = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Google Drive File ID",
    )
    drive_folder_id = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Google Drive Folder ID",
    )

    # ========================================================
    # 🧩 File Metadata
    # ========================================================
    original_filename = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="اسم الملف الأصلي",
    )
    content_type = models.CharField(
        max_length=150,
        blank=True,
        verbose_name="نوع المحتوى",
    )
    size_bytes = models.PositiveBigIntegerField(
        default=0,
        verbose_name="حجم الملف بالبايت",
    )
    is_primary = models.BooleanField(
        default=False,
        verbose_name="ملف رئيسي",
        help_text="يستخدم لتمييز الشعار أو الصورة الرئيسية عند الحاجة",
    )

    # ========================================================
    # 👤 Audit
    # ========================================================
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="uploaded_provider_documents",
        verbose_name="تم الرفع بواسطة",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="تاريخ الرفع",
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="آخر تحديث",
    )

    class Meta:
        db_table = "provider_documents"
        verbose_name = "مرفق مقدم خدمة"
        verbose_name_plural = "مرفقات مقدمي الخدمة"
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["provider", "file_type"]),
            models.Index(fields=["provider", "is_primary"]),
            models.Index(fields=["drive_file_id"]),
            models.Index(fields=["drive_folder_id"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        provider_name = self.provider.name_ar or self.provider.name or self.provider.name_en
        file_label = self.title or self.original_filename or self.file_type
        return f"{provider_name} - {file_label}"