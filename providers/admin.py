# ============================================================
# 📂 providers/admin.py
# 🧠 Primey Care | Providers Admin
# ------------------------------------------------------------
# ✅ تسجيل موديول الجهات المقدمة للخدمة داخل لوحة الإدارة
# ✅ عرض احترافي ومنظم
# ✅ بحث + فلاتر + ترتيب
# ✅ دعم حقول الشبكة الطبية المستوردة من Excel
# ✅ دعم الاسم العربي والإنجليزي
# ✅ دعم السجل التجاري والرقم الضريبي
# ✅ دعم شعار وصورة مقدم الخدمة عبر Google Drive
# ✅ دعم مرفقات مقدم الخدمة ProviderDocument
# ✅ دعم حساب الدخول الرئيسي لمقدم الخدمة Provider.user
# ============================================================

from django.contrib import admin

from .models import Provider, ProviderDocument


# ============================================================
# 🔹 Provider Documents Inline
# ============================================================

class ProviderDocumentInline(admin.TabularInline):
    model = ProviderDocument
    extra = 0

    fields = (
        "file_type",
        "title",
        "is_primary",
        "file_url",
        "drive_file_id",
        "drive_folder_id",
        "original_filename",
        "content_type",
        "size_bytes",
        "uploaded_by",
        "created_at",
    )

    readonly_fields = (
        "file_url",
        "drive_file_id",
        "drive_folder_id",
        "original_filename",
        "content_type",
        "size_bytes",
        "uploaded_by",
        "created_at",
    )

    can_delete = True
    show_change_link = True


# ============================================================
# 🔹 Provider Admin
# ============================================================

@admin.register(Provider)
class ProviderAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "display_provider_name",
        "name_ar",
        "name_en",
        "code",
        "provider_type",
        "status",
        "has_login_user",
        "login_user_display",
        "commercial_registration",
        "tax_number",
        "region",
        "city",
        "area",
        "source_category",
        "import_source",
        "phone",
        "mobile",
        "has_logo",
        "has_image",
        "has_drive_folder",
        "is_featured",
        "last_imported_at",
        "created_at",
    )

    list_filter = (
        "provider_type",
        "status",
        "is_featured",
        "user",
        "region",
        "city",
        "source_category",
        "import_source",
        "last_imported_at",
        "created_at",
    )

    search_fields = (
        "name",
        "name_ar",
        "name_en",
        "code",
        "commercial_registration",
        "tax_number",
        "contact_person",
        "phone",
        "mobile",
        "email",
        "region",
        "city",
        "area",
        "street",
        "address",
        "source_category",
        "import_source",
        "external_reference",
        "drive_folder_id",
        "logo_drive_file_id",
        "image_drive_file_id",
        "notes",
        "user__username",
        "user__email",
        "user__first_name",
        "user__last_name",
    )

    readonly_fields = (
        "has_login_user",
        "login_user_display",
        "import_key",
        "last_imported_at",
        "created_at",
        "updated_at",
    )

    autocomplete_fields = (
        "user",
    )

    ordering = ("name", "city", "area")

    inlines = (ProviderDocumentInline,)

    fieldsets = (
        (
            "حساب الدخول",
            {
                "fields": (
                    "user",
                    "has_login_user",
                    "login_user_display",
                ),
                "description": (
                    "حساب الدخول الرئيسي لمقدم الخدمة. "
                    "حسب القاعدة المعتمدة، لا يتم إنشاء الحساب عند إنشاء مقدم الخدمة، "
                    "بل يتم إنشاؤه اختياريًا عند إنشاء أو تفعيل عقد مقدم الخدمة."
                ),
            },
        ),
        (
            "البيانات الأساسية",
            {
                "fields": (
                    "name",
                    "name_ar",
                    "name_en",
                    "code",
                    "provider_type",
                    "status",
                    "is_featured",
                )
            },
        ),
        (
            "البيانات النظامية والضريبية",
            {
                "fields": (
                    "commercial_registration",
                    "tax_number",
                )
            },
        ),
        (
            "الهوية البصرية",
            {
                "fields": (
                    "logo_url",
                    "logo_drive_file_id",
                    "image_url",
                    "image_drive_file_id",
                )
            },
        ),
        (
            "Google Drive",
            {
                "fields": (
                    "drive_folder_id",
                    "drive_folder_url",
                )
            },
        ),
        (
            "بيانات التواصل",
            {
                "fields": (
                    "contact_person",
                    "phone",
                    "mobile",
                    "email",
                    "website",
                )
            },
        ),
        (
            "بيانات الموقع",
            {
                "fields": (
                    "region",
                    "city",
                    "area",
                    "street",
                    "address",
                    "google_maps_link",
                )
            },
        ),
        (
            "بيانات الشبكة الطبية والاستيراد",
            {
                "fields": (
                    "source_category",
                    "external_reference",
                    "import_source",
                    "import_key",
                    "last_imported_at",
                )
            },
        ),
        (
            "بيانات تشغيلية",
            {
                "fields": (
                    "notes",
                )
            },
        ),
        (
            "التتبع الزمني",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("user")
        )

    @admin.display(description="اسم مقدم الخدمة")
    def display_provider_name(self, obj: Provider) -> str:
        return obj.name_ar or obj.name or obj.name_en or "-"

    @admin.display(boolean=True, description="حساب دخول")
    def has_login_user(self, obj: Provider) -> bool:
        return bool(obj.user_id)

    @admin.display(description="مستخدم الدخول")
    def login_user_display(self, obj: Provider) -> str:
        user = getattr(obj, "user", None)

        if not user:
            return "-"

        full_name = (
            getattr(user, "get_full_name", lambda: "")()
            or getattr(user, "username", "")
            or f"User #{user.pk}"
        )

        email = getattr(user, "email", "") or ""

        if email:
            return f"{full_name} — {email}"

        return full_name

    @admin.display(boolean=True, description="شعار")
    def has_logo(self, obj: Provider) -> bool:
        return bool(obj.logo_url or obj.logo_drive_file_id)

    @admin.display(boolean=True, description="صورة")
    def has_image(self, obj: Provider) -> bool:
        return bool(obj.image_url or obj.image_drive_file_id)

    @admin.display(boolean=True, description="مجلد Drive")
    def has_drive_folder(self, obj: Provider) -> bool:
        return bool(obj.drive_folder_id)


# ============================================================
# 🔹 Provider Document Admin
# ============================================================

@admin.register(ProviderDocument)
class ProviderDocumentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "provider",
        "file_type",
        "title",
        "is_primary",
        "original_filename",
        "content_type",
        "size_bytes",
        "uploaded_by",
        "created_at",
    )

    list_filter = (
        "file_type",
        "is_primary",
        "content_type",
        "created_at",
    )

    search_fields = (
        "provider__name",
        "provider__name_ar",
        "provider__name_en",
        "provider__code",
        "title",
        "description",
        "original_filename",
        "file_url",
        "drive_file_id",
        "drive_folder_id",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )

    autocomplete_fields = (
        "provider",
        "uploaded_by",
    )

    ordering = ("-created_at", "-id")

    fieldsets = (
        (
            "بيانات مقدم الخدمة",
            {
                "fields": (
                    "provider",
                    "file_type",
                    "title",
                    "description",
                    "is_primary",
                )
            },
        ),
        (
            "بيانات Google Drive",
            {
                "fields": (
                    "file_url",
                    "drive_file_id",
                    "drive_folder_id",
                )
            },
        ),
        (
            "بيانات الملف",
            {
                "fields": (
                    "original_filename",
                    "content_type",
                    "size_bytes",
                    "uploaded_by",
                )
            },
        ),
        (
            "التتبع الزمني",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )