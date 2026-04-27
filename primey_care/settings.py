"""
====================================================================
📦 Primey Care — Core Bootstrap Settings
🛠️ Clean runnable base for initial backend startup
====================================================================
"""

from pathlib import Path
import os
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


# ============================================================
# 🧩 ENV HELPERS
# ============================================================

def env(key: str, default=None):
    return os.getenv(key, default)


def env_bool(key: str, default: bool = False) -> bool:
    value = os.getenv(key)
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def env_int(key: str, default: int = 0) -> int:
    value = os.getenv(key)
    if value is None:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


# ============================================================
# 🌍 ENVIRONMENT
# ============================================================

DJANGO_ENV = env("DJANGO_ENV", "local").strip().lower()
IS_LOCAL = DJANGO_ENV in ("local", "development", "dev")
IS_PRODUCTION = DJANGO_ENV in ("production", "prod")


# ============================================================
# ⚙️ CORE SECURITY
# ============================================================

SECRET_KEY = env(
    "DJANGO_SECRET_KEY",
    "django-insecure-primey-care-local-dev-key-change-me",
)

DEBUG = env_bool("DJANGO_DEBUG", True if IS_LOCAL else False)

ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
]

EXTRA_ALLOWED_HOSTS = [
    host.strip()
    for host in str(env("DJANGO_ALLOWED_HOSTS", "")).split(",")
    if host.strip()
]
ALLOWED_HOSTS += EXTRA_ALLOWED_HOSTS

SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

if IS_PRODUCTION:
    SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)
    SECURE_HSTS_SECONDS = env_int("SECURE_HSTS_SECONDS", 31536000)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", True)
    SECURE_HSTS_PRELOAD = env_bool("SECURE_HSTS_PRELOAD", True)
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
else:
    SECURE_SSL_REDIRECT = False
    SECURE_HSTS_SECONDS = 0
    SECURE_HSTS_INCLUDE_SUBDOMAINS = False
    SECURE_HSTS_PRELOAD = False
    SECURE_PROXY_SSL_HEADER = None


# ============================================================
# 🌐 PROJECT ROOTS
# ============================================================

ROOT_URLCONF = "primey_care.urls"
WSGI_APPLICATION = "primey_care.wsgi.application"
ASGI_APPLICATION = "primey_care.asgi.application"


# ============================================================
# 📦 INSTALLED APPS
# ============================================================

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party
    "corsheaders",

    # Core API package
    "api",

    # Primey Care Apps
    "auth_center.apps.AuthCenterConfig",
    "customers.apps.CustomersConfig",
    "products.apps.ProductsConfig",
    "orders.apps.OrdersConfig",
    "providers.apps.ProvidersConfig",
    "contracts.apps.ContractsConfig",
    "service_items.apps.ServiceItemsConfig",
    "order_items.apps.OrderItemsConfig",
    "payments.apps.PaymentsConfig",
    "agents.apps.AgentsConfig",
    "invoices.apps.InvoicesConfig",
    "accounting.apps.AccountingConfig",
    "treasury.apps.TreasuryConfig",

    # Payment Gateways
    "payment_gateways.apps.PaymentGatewaysConfig",

    # Notification Center
    "notification_center.apps.NotificationCenterConfig",

    # Performance Center
    "performance_center.apps.PerformanceCenterConfig",

    # WhatsApp Center
    "whatsapp_center.apps.WhatsappCenterConfig",

    # System Log
    "system_log.apps.SystemLogConfig",
]


# ============================================================
# 🌐 MIDDLEWARE
# ============================================================

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


# ============================================================
# 🎨 TEMPLATES
# ============================================================

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [
            BASE_DIR / "templates",
        ],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


# ============================================================
# 🗄️ DATABASE
# ============================================================

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": env("DB_NAME", "primey_care"),
        "USER": env("DB_USER", "root"),
        "PASSWORD": env("DB_PASSWORD", ""),
        "HOST": env("DB_HOST", "127.0.0.1"),
        "PORT": env("DB_PORT", "3306"),
        "OPTIONS": {
            "charset": "utf8mb4",
            "init_command": "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
        },
        "TEST": {
            "CHARSET": "utf8mb4",
            "COLLATION": "utf8mb4_unicode_ci",
        },
    }
}


# ============================================================
# 🔑 AUTH
# ============================================================

LOGIN_URL = "/admin/login/"
LOGIN_REDIRECT_URL = "/admin/"
LOGOUT_REDIRECT_URL = "/admin/login/"

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
]


# ============================================================
# 🌍 Localization
# ============================================================

LANGUAGE_CODE = "ar"
TIME_ZONE = "Asia/Riyadh"
USE_I18N = True
USE_TZ = True


# ============================================================
# 📂 Static / Media
# ============================================================

STATIC_URL = "/static/"
STATICFILES_DIRS = [
    BASE_DIR / "static",
]
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"


# ============================================================
# 🍪 Session / CSRF
# ============================================================

SESSION_COOKIE_NAME = "sessionid"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE", True) if IS_PRODUCTION else False

CSRF_COOKIE_NAME = "csrftoken"
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = env_bool("CSRF_COOKIE_SECURE", True) if IS_PRODUCTION else False

CSRF_USE_SESSIONS = False
CSRF_HEADER_NAME = "HTTP_X_CSRFTOKEN"

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

EXTRA_CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in str(env("CORS_ALLOWED_ORIGINS", "")).split(",")
    if origin.strip()
]
CORS_ALLOWED_ORIGINS += EXTRA_CORS_ALLOWED_ORIGINS

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

EXTRA_CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in str(env("CSRF_TRUSTED_ORIGINS", "")).split(",")
    if origin.strip()
]
CSRF_TRUSTED_ORIGINS += EXTRA_CSRF_TRUSTED_ORIGINS


# ============================================================
# 📧 EMAIL
# ============================================================

EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend",
)

EMAIL_HOST = env("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = env_int("EMAIL_PORT", 587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
EMAIL_USE_SSL = env_bool("EMAIL_USE_SSL", False)
EMAIL_TIMEOUT = env_int("EMAIL_TIMEOUT", 20)

DEFAULT_FROM_EMAIL = env(
    "DEFAULT_FROM_EMAIL",
    "Primey Care <no-reply@primeycare.local>",
)
SERVER_EMAIL = env("SERVER_EMAIL", DEFAULT_FROM_EMAIL)


# ============================================================
# 🔔 NOTIFICATION CENTER
# ============================================================

NOTIFICATION_APP_NAME = env("NOTIFICATION_APP_NAME", "Primey Care")
PROJECT_BRAND_NAME = env("PROJECT_BRAND_NAME", "Primey Care")
FRONTEND_BASE_URL = env("FRONTEND_BASE_URL", "http://localhost:3000")
SUPPORT_EMAIL = env("SUPPORT_EMAIL", "support@primeycare.local")

EMAIL_NOTIFICATIONS_ENABLED = env_bool("EMAIL_NOTIFICATIONS_ENABLED", True)
WHATSAPP_NOTIFICATIONS_ENABLED = env_bool("WHATSAPP_NOTIFICATIONS_ENABLED", True)

EMAIL_LOGO_URL = env("EMAIL_LOGO_URL", "")
PRIMEY_EMAIL_LOGO_URL = env("PRIMEY_EMAIL_LOGO_URL", EMAIL_LOGO_URL)

EMAIL_AUDIT_BCC = [
    item.strip()
    for item in str(env("EMAIL_AUDIT_BCC", "")).split(",")
    if item.strip()
]


# ============================================================
# 🔑 Default PK
# ============================================================

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"