# ============================================================
# 📂 api/urls.py
# 🧠 Primey Care | Main API Router
# ------------------------------------------------------------
# ✅ نقطة تجميع جميع APIs الخاصة بالنظام
# ✅ يعتمد على include لكل موديول
# ✅ متوافق مع Frontend API-first
# ============================================================

from django.urls import include, path


# ============================================================
# 🌐 API URL Patterns
# ============================================================

urlpatterns = [
    # --------------------------------------------------------
    # 🔐 Authentication APIs
    # --------------------------------------------------------
    path("auth/", include("api.auth.urls")),

    # --------------------------------------------------------
    # 👥 Core Business APIs
    # --------------------------------------------------------
    path("customers/", include("api.customers.urls")),
    path("agents/", include("api.agents.urls")),
    path("products/", include("api.products.urls")),
    path("providers/", include("api.providers.urls")),
    path("contracts/", include("api.contracts.urls")),
    path("service-items/", include("api.service_items.urls")),

    # --------------------------------------------------------
    # 🧾 Orders & Operations APIs
    # --------------------------------------------------------
    path("orders/", include("api.orders.urls")),
    path("order-items/", include("api.order_items.urls")),

    # --------------------------------------------------------
    # 💳 Finance APIs
    # --------------------------------------------------------
    path("invoices/", include("api.invoices.urls")),
    path("payments/", include("api.payments.urls")),
    path("payment-gateways/", include("api.payment_gateways.urls")),
    path("accounting/", include("api.accounting.urls")),

    # --------------------------------------------------------
    # 📈 System Modules APIs
    # --------------------------------------------------------
    path("performance-center/", include("api.performance_center.urls")),
    path("notification-center/", include("api.notification_center.urls")),
    path("system-log/", include("api.system_log.urls")),

    # --------------------------------------------------------
    # 💬 Communication APIs
    # --------------------------------------------------------
    path("whatsapp/", include("api.whatsapp.urls")),
]