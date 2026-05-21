# ============================================================
# 📂 agents/admin.py
# 🧠 Primey Care | Agents, Brokers & Financial Admin
# ------------------------------------------------------------
# ✅ إدارة الوسطاء / الوكلاء
# ✅ إدارة المندوبين
# ✅ عرض حساب الدخول المرتبط بالوسيط والمندوب
# ✅ إدارة قواعد العمولات والحصص المالية
# ✅ إدارة السجلات المالية للمندوبين والوسطاء
# ✅ إدارة الطلبات المرتبطة بالمندوبين
# ✅ إدارة العمولات القديمة بتوافق خلفي
# ✅ مراجعة الربط المحاسبي وحالة الترحيل
# ============================================================

from __future__ import annotations

from django.contrib import admin

from .models import (
    Agent,
    AgentCommission,
    AgentFinancialEntry,
    AgentFinancialRule,
    AgentOrder,
    Broker,
)


# ============================================================
# 🔹 Shared Admin Helpers
# ============================================================

def _login_user_display(user) -> str:
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


# ============================================================
# 🤝 Brokers
# ============================================================

@admin.register(Broker)
class BrokerAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "broker_code",
        "referral_code",
        "has_login_user",
        "login_user_display",
        "phone",
        "email",
        "city",
        "status",
        "revenue_recognition_mode",
        "settlement_mode",
        "default_commission_type",
        "default_commission_value",
        "agents_count",
        "created_at",
    )
    list_filter = (
        "status",
        "user",
        "revenue_recognition_mode",
        "settlement_mode",
        "default_commission_type",
        "city",
        "created_at",
        "updated_at",
    )
    search_fields = (
        "name",
        "broker_code",
        "referral_code",
        "phone",
        "email",
        "city",
        "iban",
        "notes",
        "user__username",
        "user__email",
        "user__first_name",
        "user__last_name",
    )
    readonly_fields = (
        "has_login_user",
        "login_user_display",
        "created_at",
        "updated_at",
    )
    raw_id_fields = (
        "user",
        "created_by",
        "updated_by",
    )
    ordering = ("name",)
    list_per_page = 50

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
                    "حساب الدخول المرتبط بالوسيط. "
                    "حسب القاعدة المعتمدة، يتم إنشاء حساب الوسيط من صفحة/خدمة الوسطاء، "
                    "وليس من صفحة المستخدمين العامة."
                ),
            },
        ),
        (
            "بيانات الوسيط",
            {
                "fields": (
                    "name",
                    "broker_code",
                    "referral_code",
                    "status",
                )
            },
        ),
        (
            "بيانات التواصل",
            {
                "fields": (
                    "phone",
                    "email",
                    "city",
                    "address",
                )
            },
        ),
        (
            "الإعدادات المالية",
            {
                "fields": (
                    "default_commission_type",
                    "default_commission_value",
                    "revenue_recognition_mode",
                    "settlement_mode",
                )
            },
        ),
        (
            "البيانات البنكية",
            {
                "fields": (
                    "bank_name",
                    "bank_account_name",
                    "iban",
                )
            },
        ),
        (
            "ملاحظات وبيانات إضافية",
            {
                "fields": (
                    "notes",
                    "metadata",
                )
            },
        ),
        (
            "التتبع",
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

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("user", "created_by", "updated_by")
            .prefetch_related("agents")
        )

    @admin.display(boolean=True, description="حساب دخول")
    def has_login_user(self, obj: Broker) -> bool:
        return bool(obj.user_id)

    @admin.display(description="مستخدم الدخول")
    def login_user_display(self, obj: Broker) -> str:
        return _login_user_display(getattr(obj, "user", None))

    @admin.display(description="عدد المندوبين")
    def agents_count(self, obj: Broker) -> int:
        return obj.agents.count()


# ============================================================
# 👤 Agents
# ============================================================

@admin.register(Agent)
class AgentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "full_name",
        "agent_code",
        "referral_code",
        "broker",
        "has_login_user",
        "login_user_display",
        "phone",
        "email",
        "city",
        "status",
        "default_commission_type",
        "default_commission_value",
        "default_delivery_fee",
        "created_at",
    )
    list_filter = (
        "status",
        "user",
        "broker",
        "default_commission_type",
        "city",
        "created_at",
        "updated_at",
    )
    search_fields = (
        "full_name",
        "agent_code",
        "referral_code",
        "phone",
        "email",
        "city",
        "iban",
        "broker__name",
        "broker__broker_code",
        "broker__referral_code",
        "notes",
        "user__username",
        "user__email",
        "user__first_name",
        "user__last_name",
    )
    readonly_fields = (
        "has_login_user",
        "login_user_display",
        "created_at",
        "updated_at",
    )
    raw_id_fields = (
        "user",
        "broker",
        "created_by",
        "updated_by",
    )
    ordering = ("full_name",)
    list_per_page = 50

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
                    "حساب الدخول المرتبط بالمندوب. "
                    "حسب القاعدة المعتمدة، يتم إنشاء حساب المندوب من صفحة/خدمة المندوبين، "
                    "وليس من صفحة المستخدمين العامة."
                ),
            },
        ),
        (
            "بيانات المندوب",
            {
                "fields": (
                    "broker",
                    "full_name",
                    "agent_code",
                    "referral_code",
                    "status",
                )
            },
        ),
        (
            "بيانات التواصل",
            {
                "fields": (
                    "phone",
                    "email",
                    "city",
                    "address",
                )
            },
        ),
        (
            "إعدادات العمولة والتوصيل",
            {
                "fields": (
                    "default_commission_type",
                    "default_commission_value",
                    "default_delivery_fee",
                )
            },
        ),
        (
            "البيانات البنكية",
            {
                "fields": (
                    "bank_name",
                    "bank_account_name",
                    "iban",
                )
            },
        ),
        (
            "ملاحظات وبيانات إضافية",
            {
                "fields": (
                    "notes",
                    "metadata",
                )
            },
        ),
        (
            "التتبع",
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

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("user", "broker", "created_by", "updated_by")
        )

    @admin.display(boolean=True, description="حساب دخول")
    def has_login_user(self, obj: Agent) -> bool:
        return bool(obj.user_id)

    @admin.display(description="مستخدم الدخول")
    def login_user_display(self, obj: Agent) -> str:
        return _login_user_display(getattr(obj, "user", None))


# ============================================================
# 🧾 Financial Rules
# ============================================================

@admin.register(AgentFinancialRule)
class AgentFinancialRuleAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "rule_name",
        "rule_type",
        "scope",
        "broker",
        "agent",
        "product_type",
        "order_kind",
        "calculation_type",
        "calculation_base",
        "value",
        "min_amount",
        "max_amount",
        "priority",
        "is_active",
        "valid_from",
        "valid_until",
        "created_at",
    )
    list_filter = (
        "rule_type",
        "scope",
        "calculation_type",
        "calculation_base",
        "is_active",
        "broker",
        "agent",
        "product_type",
        "order_kind",
        "valid_from",
        "valid_until",
        "created_at",
    )
    search_fields = (
        "rule_name",
        "broker__name",
        "broker__broker_code",
        "agent__full_name",
        "agent__agent_code",
        "product__name",
        "product__code",
        "product_type",
        "order_kind",
        "contract__contract_number",
        "contract_product__offer_title",
        "provider__name",
        "provider__name_ar",
        "provider__name_en",
        "notes",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
    )
    raw_id_fields = (
        "broker",
        "agent",
        "product",
        "contract",
        "contract_product",
        "provider",
    )
    ordering = ("priority", "-created_at")
    list_per_page = 50

    fieldsets = (
        (
            "صاحب القاعدة",
            {
                "fields": (
                    "broker",
                    "agent",
                )
            },
        ),
        (
            "نوع القاعدة",
            {
                "fields": (
                    "rule_name",
                    "rule_type",
                    "scope",
                    "priority",
                    "is_active",
                )
            },
        ),
        (
            "شروط المطابقة",
            {
                "fields": (
                    "product",
                    "product_type",
                    "contract",
                    "contract_product",
                    "provider",
                    "order_kind",
                )
            },
        ),
        (
            "طريقة الحساب",
            {
                "fields": (
                    "calculation_type",
                    "calculation_base",
                    "value",
                    "min_amount",
                    "max_amount",
                )
            },
        ),
        (
            "صلاحية القاعدة",
            {
                "fields": (
                    "valid_from",
                    "valid_until",
                )
            },
        ),
        (
            "ملاحظات وبيانات إضافية",
            {
                "fields": (
                    "notes",
                    "metadata",
                )
            },
        ),
        (
            "التتبع",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )


# ============================================================
# 🔗 Agent Orders
# ============================================================

@admin.register(AgentOrder)
class AgentOrderAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "order",
        "agent",
        "broker",
        "customer",
        "commission_type",
        "commission_value",
        "sales_amount",
        "commission_amount",
        "referral_code_used",
        "created_at",
    )
    list_filter = (
        "commission_type",
        "agent",
        "broker",
        "customer",
        "created_at",
        "updated_at",
    )
    search_fields = (
        "order__id",
        "order__order_number",
        "agent__full_name",
        "agent__agent_code",
        "agent__referral_code",
        "broker__name",
        "broker__broker_code",
        "referral_code_used",
        "customer__display_name",
        "customer__first_name",
        "customer__last_name",
        "customer__phone_number",
        "notes",
    )
    readonly_fields = (
        "commission_amount",
        "created_at",
        "updated_at",
    )
    raw_id_fields = (
        "agent",
        "broker",
        "customer",
        "order",
    )
    ordering = ("-created_at",)
    list_per_page = 50

    fieldsets = (
        (
            "الربط التشغيلي",
            {
                "fields": (
                    "order",
                    "agent",
                    "broker",
                    "customer",
                    "referral_code_used",
                )
            },
        ),
        (
            "العمولة",
            {
                "fields": (
                    "commission_type",
                    "commission_value",
                    "sales_amount",
                    "commission_amount",
                )
            },
        ),
        (
            "ملاحظات وبيانات إضافية",
            {
                "fields": (
                    "notes",
                    "metadata",
                )
            },
        ),
        (
            "التتبع",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )


# ============================================================
# 💸 Legacy Agent Commissions
# ============================================================

@admin.register(AgentCommission)
class AgentCommissionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "agent",
        "broker",
        "order",
        "payment",
        "commission_status",
        "base_amount",
        "commission_amount",
        "paid_amount",
        "remaining_amount",
        "is_accounting_posted",
        "journal_entry_reference",
        "earned_at",
        "approved_at",
        "paid_at",
        "created_at",
    )
    list_filter = (
        "commission_status",
        "is_accounting_posted",
        "agent",
        "broker",
        "earned_at",
        "approved_at",
        "paid_at",
        "posted_at",
        "created_at",
        "updated_at",
    )
    search_fields = (
        "agent__full_name",
        "agent__agent_code",
        "agent__referral_code",
        "broker__name",
        "broker__broker_code",
        "order__id",
        "order__order_number",
        "payment__payment_number",
        "journal_entry_reference",
        "notes",
    )
    readonly_fields = (
        "remaining_amount",
        "created_at",
        "updated_at",
    )
    raw_id_fields = (
        "agent_order",
        "agent",
        "broker",
        "order",
        "payment",
        "journal_entry",
    )
    ordering = ("-created_at",)
    list_per_page = 50

    fieldsets = (
        (
            "مصدر العمولة",
            {
                "fields": (
                    "agent_order",
                    "agent",
                    "broker",
                    "order",
                    "payment",
                )
            },
        ),
        (
            "حالة العمولة",
            {
                "fields": (
                    "commission_status",
                    "earned_at",
                    "approved_at",
                    "paid_at",
                )
            },
        ),
        (
            "المبالغ",
            {
                "fields": (
                    "base_amount",
                    "commission_amount",
                    "paid_amount",
                    "remaining_amount",
                )
            },
        ),
        (
            "الربط المحاسبي",
            {
                "fields": (
                    "journal_entry",
                    "journal_entry_reference",
                    "is_accounting_posted",
                    "posted_at",
                )
            },
        ),
        (
            "ملاحظات وبيانات إضافية",
            {
                "fields": (
                    "notes",
                    "metadata",
                )
            },
        ),
        (
            "التتبع",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    @admin.display(description="المتبقي")
    def remaining_amount(self, obj):
        return obj.remaining_amount


# ============================================================
# 📒 Agent / Broker Financial Entries
# ============================================================

@admin.register(AgentFinancialEntry)
class AgentFinancialEntryAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "entry_number",
        "entry_type",
        "direction",
        "status",
        "agent",
        "broker",
        "order",
        "amount",
        "paid_amount",
        "remaining_amount",
        "currency",
        "is_accounting_posted",
        "journal_entry_reference",
        "earned_at",
        "approved_at",
        "settled_at",
        "paid_at",
        "created_at",
    )
    list_filter = (
        "entry_type",
        "direction",
        "status",
        "currency",
        "is_accounting_posted",
        "agent",
        "broker",
        "source_type",
        "earned_at",
        "approved_at",
        "settled_at",
        "paid_at",
        "posted_at",
        "created_at",
        "updated_at",
    )
    search_fields = (
        "entry_number",
        "reference",
        "source_type",
        "source_id",
        "source_number",
        "agent__full_name",
        "agent__agent_code",
        "broker__name",
        "broker__broker_code",
        "order__id",
        "order__order_number",
        "description",
        "journal_entry_reference",
    )
    readonly_fields = (
        "remaining_amount",
        "created_at",
        "updated_at",
    )
    raw_id_fields = (
        "agent",
        "broker",
        "order",
        "payment",
        "commission",
        "rule",
        "journal_entry",
        "created_by",
        "updated_by",
    )
    ordering = ("-created_at", "-id")
    list_per_page = 50
    date_hierarchy = "created_at"

    fieldsets = (
        (
            "الطرف",
            {
                "fields": (
                    "agent",
                    "broker",
                )
            },
        ),
        (
            "مصادر تشغيلية",
            {
                "fields": (
                    "order",
                    "payment",
                    "commission",
                    "rule",
                )
            },
        ),
        (
            "بيانات السطر المالي",
            {
                "fields": (
                    "entry_number",
                    "entry_type",
                    "direction",
                    "status",
                    "amount",
                    "paid_amount",
                    "remaining_amount",
                    "currency",
                    "description",
                    "reference",
                )
            },
        ),
        (
            "بيانات المصدر",
            {
                "fields": (
                    "source_type",
                    "source_id",
                    "source_number",
                )
            },
        ),
        (
            "الربط المحاسبي",
            {
                "fields": (
                    "journal_entry",
                    "journal_entry_reference",
                    "is_accounting_posted",
                    "posted_at",
                )
            },
        ),
        (
            "تواريخ مالية",
            {
                "fields": (
                    "earned_at",
                    "approved_at",
                    "settled_at",
                    "paid_at",
                )
            },
        ),
        (
            "بيانات إضافية",
            {
                "fields": (
                    "metadata",
                )
            },
        ),
        (
            "التتبع",
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

    @admin.display(description="المتبقي")
    def remaining_amount(self, obj):
        return obj.remaining_amount