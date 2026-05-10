# ============================================================
# 📂 api/urls.py
# 🧠 Primey Care | Main API Router V2
# ------------------------------------------------------------
# ✅ نقطة تجميع جميع APIs الخاصة بالنظام
# ✅ يعتمد على include لكل موديول
# ✅ متوافق مع Frontend API-first
# ✅ Finance APIs:
#    - Invoices
#    - Payments
#    - Payment Gateways
# ✅ Accounting / Treasury APIs:
#    - Accounting V2
#    - Treasury V2
# ✅ Reports APIs:
#    - Overview
#    - Orders
#    - Invoices
#    - Payments
#    - Accounting
# ✅ Notification Center + legacy alias
# ✅ WhatsApp Center
# ------------------------------------------------------------
# ملاحظات مهمة:
# - لا نضع منطق أعمال هنا.
# - هذا الملف فقط لتجميع مسارات api/*.
# - منطق الفواتير والمدفوعات والبوابات داخل services الخاصة بها.
# - مسار الدفع المالي المعتمد:
#   Order → Invoice → Payment → Accounting → Treasury
# - مسار بوابات الدفع:
#   Gateway Transaction → Webhook/Lookup → Payment Confirm
#   → Accounting + Treasury
# ============================================================

from django.urls import include, path


# ============================================================
# 🌐 API URL Patterns
# ============================================================

urlpatterns = [
    # --------------------------------------------------------
    # 🔐 Authentication APIs
    # --------------------------------------------------------
    path(
        "auth/",
        include("api.auth.urls"),
    ),

    # --------------------------------------------------------
    # 👥 Core Business APIs
    # --------------------------------------------------------
    path(
        "customers/",
        include("api.customers.urls"),
    ),
    path(
        "agents/",
        include("api.agents.urls"),
    ),
    path(
        "products/",
        include("api.products.urls"),
    ),
    path(
        "providers/",
        include("api.providers.urls"),
    ),
    path(
        "contracts/",
        include("api.contracts.urls"),
    ),
    path(
        "service-items/",
        include("api.service_items.urls"),
    ),

    # --------------------------------------------------------
    # 👤 Users & Access Management APIs
    # --------------------------------------------------------
    path(
        "users/",
        include("api.users.urls"),
    ),

    # --------------------------------------------------------
    # 🧾 Orders & Operations APIs
    # --------------------------------------------------------
    path(
        "orders/",
        include("api.orders.urls"),
    ),
    path(
        "order-items/",
        include("api.order_items.urls"),
    ),

    # --------------------------------------------------------
    # 💳 Finance APIs
    # --------------------------------------------------------
    # /api/invoices/
    # /api/payments/
    # /api/payment-gateways/
    # --------------------------------------------------------
    path(
        "invoices/",
        include("api.invoices.urls"),
    ),
    path(
        "payments/",
        include("api.payments.urls"),
    ),
    path(
        "payment-gateways/",
        include("api.payment_gateways.urls"),
    ),

    # --------------------------------------------------------
    # 📒 Accounting & Treasury APIs
    # --------------------------------------------------------
    # /api/accounting/
    # /api/treasury/
    # --------------------------------------------------------
    path(
        "accounting/",
        include("api.accounting.urls"),
    ),
    path(
        "treasury/",
        include("api.treasury.urls"),
    ),

    # --------------------------------------------------------
    # 📈 Reports & System Modules APIs
    # --------------------------------------------------------
    # /api/reports/
    # /api/performance-center/
    # /api/notification-center/
    # /api/system-log/
    # --------------------------------------------------------
    path(
        "reports/",
        include("api.reports.urls"),
    ),
    path(
        "performance-center/",
        include("api.performance_center.urls"),
    ),
    path(
        "notification-center/",
        include("api.notification_center.urls"),
    ),
    path(
        "system-log/",
        include("api.system_log.urls"),
    ),

    # --------------------------------------------------------
    # 🔔 Notification Center Legacy Alias
    # --------------------------------------------------------
    # المسار الرسمي:
    # /api/notification-center/
    #
    # هذا alias احتياطي لأي استدعاءات قديمة مثل:
    # /api/notifications/
    # /api/notifications/inbox/
    #
    # مهم:
    # نستخدم namespace مختلف حتى لا يظهر تحذير:
    # urls.W005 URL namespace 'notification_center_api' isn't unique
    # --------------------------------------------------------
    path(
        "notifications/",
        include(
            ("api.notification_center.urls", "notification_center_api"),
            namespace="notifications_legacy_api",
        ),
    ),

    # --------------------------------------------------------
    # 💬 Communication APIs
    # --------------------------------------------------------
    path(
        "whatsapp/",
        include("api.whatsapp.urls"),
    ),
]