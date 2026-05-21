# ===============================================================
# 📂 الملف: auth_center/permissions.py
# 🧭 Primey Care — Roles & Permissions Core
# 🚀 الإصدار: Primey Care Permissions V1.4
# ---------------------------------------------------------------
# ✅ مصدر مركزي للصلاحيات في Backend
# ✅ بدون اعتماد على Django REST Framework
# ✅ يستخدمه Backend APIs
# ✅ يغذي whoami للـ Frontend Guards والسايدر
# ✅ متوافق مع:
#    - system_admin
#    - accountant
#    - support
#    - viewer
#    - provider_admin
#    - customer_user
#    - agent_user
#    - broker_user
# ---------------------------------------------------------------
# ✅ V1.4:
#    - إضافة broker_user كدور مستقل للوسيط
#    - إضافة صلاحيات Workspace خاصة بالوسيط
#    - إبقاء broker_user على مساحة /agent حاليًا
#    - الحفاظ على توافق whoami.py و AuthProvider.tsx
# ===============================================================

from __future__ import annotations

from functools import wraps
from typing import Any, Callable, Iterable

from django.core.exceptions import PermissionDenied
from django.http import JsonResponse

from auth_center.models import RoleChoices, UserProfile


# ===============================================================
# 🧩 Permission Codes
# ===============================================================

class PermissionCodes:
    # -----------------------------------------------------------
    # System / Dashboard
    # -----------------------------------------------------------
    SYSTEM_VIEW = "system.view"
    SYSTEM_DASHBOARD_VIEW = "system.dashboard.view"
    SYSTEM_SETTINGS = "system.settings"
    SYSTEM_AUDIT_VIEW = "system.audit.view"

    # -----------------------------------------------------------
    # Users
    # -----------------------------------------------------------
    USERS_VIEW = "users.view"
    USERS_CREATE = "users.create"
    USERS_EDIT = "users.edit"
    USERS_DISABLE = "users.disable"
    USERS_DELETE = "users.delete"
    USERS_RESET_PASSWORD = "users.reset_password"
    USERS_EXPORT = "users.export"

    # -----------------------------------------------------------
    # Customers
    # -----------------------------------------------------------
    CUSTOMERS_VIEW = "customers.view"
    CUSTOMERS_CREATE = "customers.create"
    CUSTOMERS_EDIT = "customers.edit"
    CUSTOMERS_DELETE = "customers.delete"
    CUSTOMERS_EXPORT = "customers.export"

    # -----------------------------------------------------------
    # Providers / Centers
    # -----------------------------------------------------------
    PROVIDERS_VIEW = "providers.view"
    PROVIDERS_CREATE = "providers.create"
    PROVIDERS_EDIT = "providers.edit"
    PROVIDERS_DELETE = "providers.delete"
    PROVIDERS_EXPORT = "providers.export"

    CENTERS_VIEW = "centers.view"
    CENTERS_CREATE = "centers.create"
    CENTERS_EDIT = "centers.edit"
    CENTERS_DELETE = "centers.delete"
    CENTERS_EXPORT = "centers.export"

    # -----------------------------------------------------------
    # Agents / Brokers
    # -----------------------------------------------------------
    AGENTS_VIEW = "agents.view"
    AGENTS_CREATE = "agents.create"
    AGENTS_EDIT = "agents.edit"
    AGENTS_DELETE = "agents.delete"
    AGENTS_EXPORT = "agents.export"
    AGENTS_COMMISSIONS_VIEW = "agents.commissions.view"
    AGENTS_COMMISSIONS_APPROVE = "agents.commissions.approve"

    BROKERS_VIEW = "brokers.view"
    BROKERS_CREATE = "brokers.create"
    BROKERS_EDIT = "brokers.edit"
    BROKERS_DELETE = "brokers.delete"
    BROKERS_EXPORT = "brokers.export"

    # -----------------------------------------------------------
    # Products
    # -----------------------------------------------------------
    PRODUCTS_VIEW = "products.view"
    PRODUCTS_CREATE = "products.create"
    PRODUCTS_EDIT = "products.edit"
    PRODUCTS_DELETE = "products.delete"
    PRODUCTS_EXPORT = "products.export"

    # -----------------------------------------------------------
    # Contracts
    # -----------------------------------------------------------
    CONTRACTS_VIEW = "contracts.view"
    CONTRACTS_CREATE = "contracts.create"
    CONTRACTS_EDIT = "contracts.edit"
    CONTRACTS_DELETE = "contracts.delete"
    CONTRACTS_APPROVE = "contracts.approve"
    CONTRACTS_EXPORT = "contracts.export"

    # -----------------------------------------------------------
    # Service Items / Order Items
    # -----------------------------------------------------------
    SERVICE_ITEMS_VIEW = "service_items.view"
    SERVICE_ITEMS_CREATE = "service_items.create"
    SERVICE_ITEMS_EDIT = "service_items.edit"
    SERVICE_ITEMS_DELETE = "service_items.delete"
    SERVICE_ITEMS_EXPORT = "service_items.export"

    ORDER_ITEMS_VIEW = "order_items.view"
    ORDER_ITEMS_CREATE = "order_items.create"
    ORDER_ITEMS_EDIT = "order_items.edit"
    ORDER_ITEMS_DELETE = "order_items.delete"

    # -----------------------------------------------------------
    # Orders
    # -----------------------------------------------------------
    ORDERS_VIEW = "orders.view"
    ORDERS_CREATE = "orders.create"
    ORDERS_EDIT = "orders.edit"
    ORDERS_DELETE = "orders.delete"
    ORDERS_APPROVE = "orders.approve"
    ORDERS_EXPORT = "orders.export"

    # -----------------------------------------------------------
    # Invoices
    # -----------------------------------------------------------
    INVOICES_VIEW = "invoices.view"
    INVOICES_CREATE = "invoices.create"
    INVOICES_EDIT = "invoices.edit"
    INVOICES_DELETE = "invoices.delete"
    INVOICES_ISSUE = "invoices.issue"
    INVOICES_CANCEL = "invoices.cancel"
    INVOICES_EXPORT = "invoices.export"

    # -----------------------------------------------------------
    # Payments
    # -----------------------------------------------------------
    PAYMENTS_VIEW = "payments.view"
    PAYMENTS_CREATE = "payments.create"
    PAYMENTS_EDIT = "payments.edit"
    PAYMENTS_DELETE = "payments.delete"
    PAYMENTS_CONFIRM = "payments.confirm"
    PAYMENTS_CANCEL = "payments.cancel"
    PAYMENTS_EXPORT = "payments.export"

    # -----------------------------------------------------------
    # Accounting
    # -----------------------------------------------------------
    ACCOUNTING_VIEW = "accounting.view"
    ACCOUNTING_DASHBOARD_VIEW = "accounting.dashboard.view"
    ACCOUNTING_POST = "accounting.post"
    ACCOUNTING_EXPORT = "accounting.export"

    ACCOUNTING_ACCOUNTS_VIEW = "accounting.accounts.view"
    ACCOUNTING_ACCOUNTS_CREATE = "accounting.accounts.create"
    ACCOUNTING_ACCOUNTS_EDIT = "accounting.accounts.edit"
    ACCOUNTING_ACCOUNTS_DELETE = "accounting.accounts.delete"
    ACCOUNTING_ACCOUNTS_EXPORT = "accounting.accounts.export"

    ACCOUNTING_JOURNALS_VIEW = "accounting.journals.view"
    ACCOUNTING_JOURNALS_CREATE = "accounting.journals.create"
    ACCOUNTING_JOURNALS_EDIT = "accounting.journals.edit"
    ACCOUNTING_JOURNALS_POST = "accounting.journals.post"
    ACCOUNTING_JOURNALS_DELETE = "accounting.journals.delete"
    ACCOUNTING_JOURNALS_EXPORT = "accounting.journals.export"

    ACCOUNTING_LEDGER_VIEW = "accounting.ledger.view"
    ACCOUNTING_LEDGER_EXPORT = "accounting.ledger.export"

    ACCOUNTING_TRIAL_BALANCE_VIEW = "accounting.trial_balance.view"
    ACCOUNTING_TRIAL_BALANCE_EXPORT = "accounting.trial_balance.export"

    ACCOUNTING_PROFIT_LOSS_VIEW = "accounting.profit_loss.view"
    ACCOUNTING_PROFIT_LOSS_EXPORT = "accounting.profit_loss.export"

    ACCOUNTING_BALANCE_SHEET_VIEW = "accounting.balance_sheet.view"
    ACCOUNTING_BALANCE_SHEET_EXPORT = "accounting.balance_sheet.export"

    ACCOUNTING_REPORTS_VIEW = "accounting.reports.view"
    ACCOUNTING_REPORTS_EXPORT = "accounting.reports.export"

    # -----------------------------------------------------------
    # Treasury
    # -----------------------------------------------------------
    TREASURY_VIEW = "treasury.view"
    TREASURY_DASHBOARD_VIEW = "treasury.dashboard.view"
    TREASURY_CREATE = "treasury.create"
    TREASURY_EDIT = "treasury.edit"
    TREASURY_DELETE = "treasury.delete"
    TREASURY_EXPORT = "treasury.export"

    TREASURY_ACCOUNTS_VIEW = "treasury.accounts.view"
    TREASURY_ACCOUNTS_CREATE = "treasury.accounts.create"
    TREASURY_ACCOUNTS_EDIT = "treasury.accounts.edit"
    TREASURY_ACCOUNTS_DELETE = "treasury.accounts.delete"
    TREASURY_ACCOUNTS_EXPORT = "treasury.accounts.export"

    TREASURY_CASHBOXES_VIEW = "treasury.cashboxes.view"
    TREASURY_CASHBOXES_CREATE = "treasury.cashboxes.create"
    TREASURY_CASHBOXES_EDIT = "treasury.cashboxes.edit"
    TREASURY_CASHBOXES_DELETE = "treasury.cashboxes.delete"
    TREASURY_CASHBOXES_EXPORT = "treasury.cashboxes.export"

    TREASURY_BANKS_VIEW = "treasury.banks.view"
    TREASURY_BANKS_CREATE = "treasury.banks.create"
    TREASURY_BANKS_EDIT = "treasury.banks.edit"
    TREASURY_BANKS_DELETE = "treasury.banks.delete"
    TREASURY_BANKS_EXPORT = "treasury.banks.export"

    TREASURY_TRANSACTIONS_VIEW = "treasury.transactions.view"
    TREASURY_TRANSACTIONS_CREATE = "treasury.transactions.create"
    TREASURY_TRANSACTIONS_EDIT = "treasury.transactions.edit"
    TREASURY_TRANSACTIONS_CONFIRM = "treasury.transactions.confirm"
    TREASURY_TRANSACTIONS_CANCEL = "treasury.transactions.cancel"
    TREASURY_TRANSACTIONS_DELETE = "treasury.transactions.delete"
    TREASURY_TRANSACTIONS_EXPORT = "treasury.transactions.export"

    TREASURY_TRANSFERS_VIEW = "treasury.transfers.view"
    TREASURY_TRANSFERS_CREATE = "treasury.transfers.create"
    TREASURY_TRANSFERS_EDIT = "treasury.transfers.edit"
    TREASURY_TRANSFERS_CONFIRM = "treasury.transfers.confirm"
    TREASURY_TRANSFERS_CANCEL = "treasury.transfers.cancel"
    TREASURY_TRANSFERS_DELETE = "treasury.transfers.delete"
    TREASURY_TRANSFERS_EXPORT = "treasury.transfers.export"

    TREASURY_REPORTS_VIEW = "treasury.reports.view"
    TREASURY_REPORTS_EXPORT = "treasury.reports.export"
    TREASURY_SETTINGS_VIEW = "treasury.settings.view"
    TREASURY_SETTINGS_EDIT = "treasury.settings.edit"

    # -----------------------------------------------------------
    # Reports
    # -----------------------------------------------------------
    REPORTS_VIEW = "reports.view"
    REPORTS_EXPORT = "reports.export"

    # -----------------------------------------------------------
    # WhatsApp / Notifications
    # -----------------------------------------------------------
    WHATSAPP_VIEW = "whatsapp.view"
    WHATSAPP_SETTINGS = "whatsapp.settings"
    WHATSAPP_TEMPLATES_VIEW = "whatsapp.templates.view"
    WHATSAPP_TEMPLATES_CREATE = "whatsapp.templates.create"
    WHATSAPP_TEMPLATES_EDIT = "whatsapp.templates.edit"
    WHATSAPP_TEMPLATES_DELETE = "whatsapp.templates.delete"
    WHATSAPP_BROADCASTS_VIEW = "whatsapp.broadcasts.view"
    WHATSAPP_BROADCASTS_CREATE = "whatsapp.broadcasts.create"
    WHATSAPP_LOGS_VIEW = "whatsapp.logs.view"

    NOTIFICATIONS_VIEW = "notifications.view"
    NOTIFICATIONS_CREATE = "notifications.create"
    NOTIFICATIONS_SEND = "notifications.send"

    # -----------------------------------------------------------
    # Payment Gateways
    # -----------------------------------------------------------
    PAYMENT_GATEWAYS_VIEW = "payment_gateways.view"
    PAYMENT_GATEWAYS_CONFIGURE = "payment_gateways.configure"

    # -----------------------------------------------------------
    # Provider Workspace
    # -----------------------------------------------------------
    PROVIDER_WORKSPACE_VIEW = "provider_workspace.view"
    PROVIDER_DASHBOARD_VIEW = "provider.dashboard.view"
    PROVIDER_ORDERS_VIEW = "provider_orders.view"
    PROVIDER_CONTRACTS_VIEW = "provider_contracts.view"
    PROVIDER_INVOICES_VIEW = "provider_invoices.view"
    PROVIDER_PAYMENTS_VIEW = "provider_payments.view"
    PROVIDER_REPORTS_VIEW = "provider_reports.view"

    # -----------------------------------------------------------
    # Customer Workspace
    # -----------------------------------------------------------
    CUSTOMER_WORKSPACE_VIEW = "customer_workspace.view"
    CUSTOMER_DASHBOARD_VIEW = "customer.dashboard.view"
    CUSTOMER_ORDERS_VIEW = "customer_orders.view"
    CUSTOMER_CARDS_VIEW = "customer_cards.view"
    CUSTOMER_INVOICES_VIEW = "customer_invoices.view"
    CUSTOMER_PAYMENTS_VIEW = "customer_payments.view"
    CUSTOMER_SUPPORT_VIEW = "customer_support.view"

    # -----------------------------------------------------------
    # Agent Workspace
    # -----------------------------------------------------------
    AGENT_WORKSPACE_VIEW = "agent_workspace.view"
    AGENT_DASHBOARD_VIEW = "agent.dashboard.view"
    AGENT_CUSTOMERS_VIEW = "agent_customers.view"
    AGENT_COMMISSIONS_VIEW = "agent_commissions.view"
    AGENT_ORDERS_VIEW = "agent_orders.view"
    AGENT_REPORTS_VIEW = "agent_reports.view"

    # -----------------------------------------------------------
    # Broker Workspace
    # -----------------------------------------------------------
    BROKER_WORKSPACE_VIEW = "broker_workspace.view"
    BROKER_DASHBOARD_VIEW = "broker.dashboard.view"
    BROKER_AGENTS_VIEW = "broker_agents.view"
    BROKER_CUSTOMERS_VIEW = "broker_customers.view"
    BROKER_COMMISSIONS_VIEW = "broker_commissions.view"
    BROKER_ORDERS_VIEW = "broker_orders.view"
    BROKER_REPORTS_VIEW = "broker_reports.view"


ALL_PERMISSIONS: set[str] = {
    value
    for key, value in PermissionCodes.__dict__.items()
    if key.isupper() and isinstance(value, str)
}


# ===============================================================
# 🧠 Normalizers
# ===============================================================

def _normalize_role_value(role: str | RoleChoices | None) -> str:
    return str(role or RoleChoices.VIEWER).strip().lower()


def _normalize_workspace_value(workspace: str | None) -> str:
    value = str(workspace or "").strip().lower()

    if value in {"company", "center"}:
        return "provider"

    if value in {"system", "provider", "customer", "agent"}:
        return value

    return "system"


def _normalize_permission_codes(
    permission_codes: Iterable[str] | None,
) -> set[str]:
    if not permission_codes:
        return set()

    return {
        str(permission_code).strip()
        for permission_code in permission_codes
        if str(permission_code or "").strip()
    }


def _normalize_role_codes(roles: Iterable[str | RoleChoices] | None) -> set[str]:
    if not roles:
        return set()

    return {
        _normalize_role_value(role)
        for role in roles
        if str(role or "").strip()
    }


# ===============================================================
# 🧱 Permission Groups
# ===============================================================

SYSTEM_READ_PERMISSIONS: set[str] = {
    PermissionCodes.SYSTEM_VIEW,
    PermissionCodes.SYSTEM_DASHBOARD_VIEW,
    PermissionCodes.USERS_VIEW,

    PermissionCodes.CUSTOMERS_VIEW,
    PermissionCodes.PROVIDERS_VIEW,
    PermissionCodes.CENTERS_VIEW,
    PermissionCodes.AGENTS_VIEW,
    PermissionCodes.BROKERS_VIEW,
    PermissionCodes.PRODUCTS_VIEW,
    PermissionCodes.CONTRACTS_VIEW,
    PermissionCodes.SERVICE_ITEMS_VIEW,
    PermissionCodes.ORDERS_VIEW,
    PermissionCodes.ORDER_ITEMS_VIEW,
    PermissionCodes.INVOICES_VIEW,
    PermissionCodes.PAYMENTS_VIEW,

    PermissionCodes.ACCOUNTING_VIEW,
    PermissionCodes.ACCOUNTING_DASHBOARD_VIEW,
    PermissionCodes.ACCOUNTING_ACCOUNTS_VIEW,
    PermissionCodes.ACCOUNTING_JOURNALS_VIEW,
    PermissionCodes.ACCOUNTING_LEDGER_VIEW,
    PermissionCodes.ACCOUNTING_TRIAL_BALANCE_VIEW,
    PermissionCodes.ACCOUNTING_PROFIT_LOSS_VIEW,
    PermissionCodes.ACCOUNTING_BALANCE_SHEET_VIEW,
    PermissionCodes.ACCOUNTING_REPORTS_VIEW,

    PermissionCodes.TREASURY_VIEW,
    PermissionCodes.TREASURY_DASHBOARD_VIEW,
    PermissionCodes.TREASURY_ACCOUNTS_VIEW,
    PermissionCodes.TREASURY_CASHBOXES_VIEW,
    PermissionCodes.TREASURY_BANKS_VIEW,
    PermissionCodes.TREASURY_TRANSACTIONS_VIEW,
    PermissionCodes.TREASURY_TRANSFERS_VIEW,
    PermissionCodes.TREASURY_REPORTS_VIEW,
    PermissionCodes.TREASURY_SETTINGS_VIEW,

    PermissionCodes.REPORTS_VIEW,
    PermissionCodes.WHATSAPP_VIEW,
    PermissionCodes.WHATSAPP_TEMPLATES_VIEW,
    PermissionCodes.WHATSAPP_BROADCASTS_VIEW,
    PermissionCodes.WHATSAPP_LOGS_VIEW,
    PermissionCodes.NOTIFICATIONS_VIEW,
    PermissionCodes.PAYMENT_GATEWAYS_VIEW,
}

EXPORT_PERMISSIONS: set[str] = {
    PermissionCodes.CUSTOMERS_EXPORT,
    PermissionCodes.PROVIDERS_EXPORT,
    PermissionCodes.CENTERS_EXPORT,
    PermissionCodes.AGENTS_EXPORT,
    PermissionCodes.BROKERS_EXPORT,
    PermissionCodes.PRODUCTS_EXPORT,
    PermissionCodes.CONTRACTS_EXPORT,
    PermissionCodes.SERVICE_ITEMS_EXPORT,
    PermissionCodes.ORDERS_EXPORT,
    PermissionCodes.INVOICES_EXPORT,
    PermissionCodes.PAYMENTS_EXPORT,
    PermissionCodes.ACCOUNTING_EXPORT,
    PermissionCodes.ACCOUNTING_ACCOUNTS_EXPORT,
    PermissionCodes.ACCOUNTING_JOURNALS_EXPORT,
    PermissionCodes.ACCOUNTING_LEDGER_EXPORT,
    PermissionCodes.ACCOUNTING_TRIAL_BALANCE_EXPORT,
    PermissionCodes.ACCOUNTING_PROFIT_LOSS_EXPORT,
    PermissionCodes.ACCOUNTING_BALANCE_SHEET_EXPORT,
    PermissionCodes.ACCOUNTING_REPORTS_EXPORT,
    PermissionCodes.TREASURY_EXPORT,
    PermissionCodes.TREASURY_ACCOUNTS_EXPORT,
    PermissionCodes.TREASURY_CASHBOXES_EXPORT,
    PermissionCodes.TREASURY_BANKS_EXPORT,
    PermissionCodes.TREASURY_TRANSACTIONS_EXPORT,
    PermissionCodes.TREASURY_TRANSFERS_EXPORT,
    PermissionCodes.TREASURY_REPORTS_EXPORT,
    PermissionCodes.REPORTS_EXPORT,
}

ACCOUNTING_FULL_PERMISSIONS: set[str] = {
    PermissionCodes.ACCOUNTING_VIEW,
    PermissionCodes.ACCOUNTING_DASHBOARD_VIEW,
    PermissionCodes.ACCOUNTING_POST,
    PermissionCodes.ACCOUNTING_EXPORT,

    PermissionCodes.ACCOUNTING_ACCOUNTS_VIEW,
    PermissionCodes.ACCOUNTING_ACCOUNTS_CREATE,
    PermissionCodes.ACCOUNTING_ACCOUNTS_EDIT,
    PermissionCodes.ACCOUNTING_ACCOUNTS_EXPORT,

    PermissionCodes.ACCOUNTING_JOURNALS_VIEW,
    PermissionCodes.ACCOUNTING_JOURNALS_CREATE,
    PermissionCodes.ACCOUNTING_JOURNALS_EDIT,
    PermissionCodes.ACCOUNTING_JOURNALS_POST,
    PermissionCodes.ACCOUNTING_JOURNALS_EXPORT,

    PermissionCodes.ACCOUNTING_LEDGER_VIEW,
    PermissionCodes.ACCOUNTING_LEDGER_EXPORT,

    PermissionCodes.ACCOUNTING_TRIAL_BALANCE_VIEW,
    PermissionCodes.ACCOUNTING_TRIAL_BALANCE_EXPORT,

    PermissionCodes.ACCOUNTING_PROFIT_LOSS_VIEW,
    PermissionCodes.ACCOUNTING_PROFIT_LOSS_EXPORT,

    PermissionCodes.ACCOUNTING_BALANCE_SHEET_VIEW,
    PermissionCodes.ACCOUNTING_BALANCE_SHEET_EXPORT,

    PermissionCodes.ACCOUNTING_REPORTS_VIEW,
    PermissionCodes.ACCOUNTING_REPORTS_EXPORT,
}

TREASURY_FULL_PERMISSIONS: set[str] = {
    PermissionCodes.TREASURY_VIEW,
    PermissionCodes.TREASURY_DASHBOARD_VIEW,
    PermissionCodes.TREASURY_CREATE,
    PermissionCodes.TREASURY_EDIT,
    PermissionCodes.TREASURY_EXPORT,

    PermissionCodes.TREASURY_ACCOUNTS_VIEW,
    PermissionCodes.TREASURY_ACCOUNTS_CREATE,
    PermissionCodes.TREASURY_ACCOUNTS_EDIT,
    PermissionCodes.TREASURY_ACCOUNTS_EXPORT,

    PermissionCodes.TREASURY_CASHBOXES_VIEW,
    PermissionCodes.TREASURY_CASHBOXES_CREATE,
    PermissionCodes.TREASURY_CASHBOXES_EDIT,
    PermissionCodes.TREASURY_CASHBOXES_EXPORT,

    PermissionCodes.TREASURY_BANKS_VIEW,
    PermissionCodes.TREASURY_BANKS_CREATE,
    PermissionCodes.TREASURY_BANKS_EDIT,
    PermissionCodes.TREASURY_BANKS_EXPORT,

    PermissionCodes.TREASURY_TRANSACTIONS_VIEW,
    PermissionCodes.TREASURY_TRANSACTIONS_CREATE,
    PermissionCodes.TREASURY_TRANSACTIONS_EDIT,
    PermissionCodes.TREASURY_TRANSACTIONS_CONFIRM,
    PermissionCodes.TREASURY_TRANSACTIONS_CANCEL,
    PermissionCodes.TREASURY_TRANSACTIONS_EXPORT,

    PermissionCodes.TREASURY_TRANSFERS_VIEW,
    PermissionCodes.TREASURY_TRANSFERS_CREATE,
    PermissionCodes.TREASURY_TRANSFERS_EDIT,
    PermissionCodes.TREASURY_TRANSFERS_CONFIRM,
    PermissionCodes.TREASURY_TRANSFERS_CANCEL,
    PermissionCodes.TREASURY_TRANSFERS_EXPORT,

    PermissionCodes.TREASURY_REPORTS_VIEW,
    PermissionCodes.TREASURY_REPORTS_EXPORT,
    PermissionCodes.TREASURY_SETTINGS_VIEW,
}


# ===============================================================
# 🛡️ Role Permissions Matrix
# ===============================================================

VIEWER_PERMISSIONS: set[str] = set(SYSTEM_READ_PERMISSIONS)

ACCOUNTANT_PERMISSIONS: set[str] = {
    PermissionCodes.SYSTEM_VIEW,
    PermissionCodes.SYSTEM_DASHBOARD_VIEW,

    # Read operational records needed for accounting.
    PermissionCodes.CUSTOMERS_VIEW,
    PermissionCodes.PROVIDERS_VIEW,
    PermissionCodes.CENTERS_VIEW,
    PermissionCodes.AGENTS_VIEW,
    PermissionCodes.BROKERS_VIEW,
    PermissionCodes.PRODUCTS_VIEW,
    PermissionCodes.CONTRACTS_VIEW,
    PermissionCodes.SERVICE_ITEMS_VIEW,
    PermissionCodes.ORDERS_VIEW,
    PermissionCodes.ORDER_ITEMS_VIEW,

    # Invoices.
    PermissionCodes.INVOICES_VIEW,
    PermissionCodes.INVOICES_CREATE,
    PermissionCodes.INVOICES_EDIT,
    PermissionCodes.INVOICES_ISSUE,
    PermissionCodes.INVOICES_EXPORT,

    # Payments.
    PermissionCodes.PAYMENTS_VIEW,
    PermissionCodes.PAYMENTS_CREATE,
    PermissionCodes.PAYMENTS_EDIT,
    PermissionCodes.PAYMENTS_CONFIRM,
    PermissionCodes.PAYMENTS_EXPORT,

    # Accounting / Treasury.
    *ACCOUNTING_FULL_PERMISSIONS,
    *TREASURY_FULL_PERMISSIONS,

    # Reports.
    PermissionCodes.REPORTS_VIEW,
    PermissionCodes.REPORTS_EXPORT,
}

SUPPORT_PERMISSIONS: set[str] = {
    PermissionCodes.SYSTEM_VIEW,
    PermissionCodes.SYSTEM_DASHBOARD_VIEW,

    # Customers.
    PermissionCodes.CUSTOMERS_VIEW,
    PermissionCodes.CUSTOMERS_CREATE,
    PermissionCodes.CUSTOMERS_EDIT,
    PermissionCodes.CUSTOMERS_EXPORT,

    # Providers / Centers.
    PermissionCodes.PROVIDERS_VIEW,
    PermissionCodes.PROVIDERS_EXPORT,
    PermissionCodes.CENTERS_VIEW,
    PermissionCodes.CENTERS_EXPORT,

    # Agents / Brokers.
    PermissionCodes.AGENTS_VIEW,
    PermissionCodes.AGENTS_EXPORT,
    PermissionCodes.BROKERS_VIEW,
    PermissionCodes.BROKERS_EXPORT,

    # Products / contracts / services / orders.
    PermissionCodes.PRODUCTS_VIEW,
    PermissionCodes.CONTRACTS_VIEW,
    PermissionCodes.SERVICE_ITEMS_VIEW,

    PermissionCodes.ORDERS_VIEW,
    PermissionCodes.ORDERS_CREATE,
    PermissionCodes.ORDERS_EDIT,
    PermissionCodes.ORDERS_EXPORT,
    PermissionCodes.ORDER_ITEMS_VIEW,
    PermissionCodes.ORDER_ITEMS_CREATE,
    PermissionCodes.ORDER_ITEMS_EDIT,

    # Billing read-only support.
    PermissionCodes.INVOICES_VIEW,
    PermissionCodes.PAYMENTS_VIEW,

    # WhatsApp / notifications.
    PermissionCodes.WHATSAPP_VIEW,
    PermissionCodes.WHATSAPP_TEMPLATES_VIEW,
    PermissionCodes.WHATSAPP_BROADCASTS_VIEW,
    PermissionCodes.WHATSAPP_LOGS_VIEW,
    PermissionCodes.NOTIFICATIONS_VIEW,
    PermissionCodes.NOTIFICATIONS_CREATE,
    PermissionCodes.NOTIFICATIONS_SEND,

    # Reports read-only.
    PermissionCodes.REPORTS_VIEW,
}

PROVIDER_ADMIN_PERMISSIONS: set[str] = {
    PermissionCodes.PROVIDER_WORKSPACE_VIEW,
    PermissionCodes.PROVIDER_DASHBOARD_VIEW,
    PermissionCodes.PROVIDER_ORDERS_VIEW,
    PermissionCodes.PROVIDER_CONTRACTS_VIEW,
    PermissionCodes.PROVIDER_INVOICES_VIEW,
    PermissionCodes.PROVIDER_PAYMENTS_VIEW,
    PermissionCodes.PROVIDER_REPORTS_VIEW,

    PermissionCodes.CUSTOMERS_VIEW,
    PermissionCodes.ORDERS_VIEW,
    PermissionCodes.CONTRACTS_VIEW,
    PermissionCodes.PRODUCTS_VIEW,
    PermissionCodes.SERVICE_ITEMS_VIEW,

    PermissionCodes.INVOICES_VIEW,
    PermissionCodes.INVOICES_CREATE,
    PermissionCodes.INVOICES_EXPORT,

    PermissionCodes.PAYMENTS_VIEW,
    PermissionCodes.PAYMENTS_CREATE,
    PermissionCodes.PAYMENTS_EXPORT,

    PermissionCodes.REPORTS_VIEW,
}

CUSTOMER_USER_PERMISSIONS: set[str] = {
    PermissionCodes.CUSTOMER_WORKSPACE_VIEW,
    PermissionCodes.CUSTOMER_DASHBOARD_VIEW,
    PermissionCodes.CUSTOMER_ORDERS_VIEW,
    PermissionCodes.CUSTOMER_CARDS_VIEW,
    PermissionCodes.CUSTOMER_INVOICES_VIEW,
    PermissionCodes.CUSTOMER_PAYMENTS_VIEW,
    PermissionCodes.CUSTOMER_SUPPORT_VIEW,

    PermissionCodes.ORDERS_VIEW,
    PermissionCodes.ORDERS_CREATE,

    PermissionCodes.INVOICES_VIEW,
    PermissionCodes.PAYMENTS_VIEW,
    PermissionCodes.PRODUCTS_VIEW,
}

AGENT_USER_PERMISSIONS: set[str] = {
    PermissionCodes.AGENT_WORKSPACE_VIEW,
    PermissionCodes.AGENT_DASHBOARD_VIEW,
    PermissionCodes.AGENT_CUSTOMERS_VIEW,
    PermissionCodes.AGENT_COMMISSIONS_VIEW,
    PermissionCodes.AGENT_ORDERS_VIEW,
    PermissionCodes.AGENT_REPORTS_VIEW,

    PermissionCodes.CUSTOMERS_VIEW,
    PermissionCodes.CUSTOMERS_CREATE,

    PermissionCodes.ORDERS_VIEW,
    PermissionCodes.ORDERS_CREATE,

    PermissionCodes.PRODUCTS_VIEW,

    PermissionCodes.INVOICES_VIEW,
    PermissionCodes.PAYMENTS_VIEW,

    PermissionCodes.REPORTS_VIEW,
}

BROKER_USER_PERMISSIONS: set[str] = {
    PermissionCodes.BROKER_WORKSPACE_VIEW,
    PermissionCodes.BROKER_DASHBOARD_VIEW,
    PermissionCodes.BROKER_AGENTS_VIEW,
    PermissionCodes.BROKER_CUSTOMERS_VIEW,
    PermissionCodes.BROKER_COMMISSIONS_VIEW,
    PermissionCodes.BROKER_ORDERS_VIEW,
    PermissionCodes.BROKER_REPORTS_VIEW,

    # مساحة التشغيل الحالية مشتركة على /agent.
    PermissionCodes.AGENT_WORKSPACE_VIEW,
    PermissionCodes.AGENT_DASHBOARD_VIEW,
    PermissionCodes.AGENT_CUSTOMERS_VIEW,
    PermissionCodes.AGENT_COMMISSIONS_VIEW,
    PermissionCodes.AGENT_ORDERS_VIEW,
    PermissionCodes.AGENT_REPORTS_VIEW,

    # قراءة فريقه وعملائه وطلباته.
    PermissionCodes.AGENTS_VIEW,
    PermissionCodes.BROKERS_VIEW,
    PermissionCodes.CUSTOMERS_VIEW,
    PermissionCodes.ORDERS_VIEW,
    PermissionCodes.INVOICES_VIEW,
    PermissionCodes.PAYMENTS_VIEW,
    PermissionCodes.PRODUCTS_VIEW,
    PermissionCodes.REPORTS_VIEW,
}

PERMISSIONS_BY_ROLE: dict[str, set[str]] = {
    _normalize_role_value(RoleChoices.SYSTEM_ADMIN): set(ALL_PERMISSIONS),
    _normalize_role_value(RoleChoices.ACCOUNTANT): set(ACCOUNTANT_PERMISSIONS),
    _normalize_role_value(RoleChoices.SUPPORT): set(SUPPORT_PERMISSIONS),
    _normalize_role_value(RoleChoices.PROVIDER_ADMIN): set(PROVIDER_ADMIN_PERMISSIONS),
    _normalize_role_value(RoleChoices.CUSTOMER_USER): set(CUSTOMER_USER_PERMISSIONS),
    _normalize_role_value(RoleChoices.AGENT_USER): set(AGENT_USER_PERMISSIONS),
    _normalize_role_value(RoleChoices.BROKER_USER): set(BROKER_USER_PERMISSIONS),
    _normalize_role_value(RoleChoices.VIEWER): set(VIEWER_PERMISSIONS),
}


# ===============================================================
# 🧠 User Helpers
# ===============================================================

def get_user_profile(user: Any) -> UserProfile | None:
    if not user or not getattr(user, "is_authenticated", False):
        return None

    try:
        return user.profile
    except UserProfile.DoesNotExist:
        return None
    except AttributeError:
        return None


def get_user_role(user: Any) -> str:
    profile = get_user_profile(user)

    if not profile:
        if getattr(user, "is_superuser", False):
            return _normalize_role_value(RoleChoices.SYSTEM_ADMIN)
        if getattr(user, "is_staff", False):
            return _normalize_role_value(RoleChoices.SUPPORT)
        return _normalize_role_value(RoleChoices.VIEWER)

    role = getattr(profile, "role", RoleChoices.VIEWER)

    if not role:
        return _normalize_role_value(RoleChoices.VIEWER)

    return _normalize_role_value(role)


def get_user_workspace(user: Any) -> str:
    profile = get_user_profile(user)

    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return "system"

    if profile:
        workspace = getattr(profile, "workspace", None)
        if workspace:
            return _normalize_workspace_value(workspace)

    role = get_user_role(user)

    if role in {
        _normalize_role_value(RoleChoices.SYSTEM_ADMIN),
        _normalize_role_value(RoleChoices.ACCOUNTANT),
        _normalize_role_value(RoleChoices.SUPPORT),
        _normalize_role_value(RoleChoices.VIEWER),
    }:
        return "system"

    if role == _normalize_role_value(RoleChoices.PROVIDER_ADMIN):
        return "provider"

    if role == _normalize_role_value(RoleChoices.CUSTOMER_USER):
        return "customer"

    if role in {
        _normalize_role_value(RoleChoices.AGENT_USER),
        _normalize_role_value(RoleChoices.BROKER_USER),
    }:
        return "agent"

    return "system"


def get_role_permissions(role: str | RoleChoices | None) -> set[str]:
    role_value = _normalize_role_value(role)
    return set(PERMISSIONS_BY_ROLE.get(role_value, set()))


def get_user_permissions(user: Any) -> set[str]:
    if not user or not getattr(user, "is_authenticated", False):
        return set()

    if getattr(user, "is_superuser", False):
        return set(ALL_PERMISSIONS)

    role = get_user_role(user)
    return get_role_permissions(role)


def is_system_admin(user: Any) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False

    if getattr(user, "is_superuser", False):
        return True

    return get_user_role(user) == _normalize_role_value(RoleChoices.SYSTEM_ADMIN)


def has_permission(user: Any, permission_code: str) -> bool:
    permission_code = str(permission_code or "").strip()

    if not permission_code:
        return False

    if not user or not getattr(user, "is_authenticated", False):
        return False

    if getattr(user, "is_superuser", False):
        return True

    return permission_code in get_user_permissions(user)


def has_any_permission(
    user: Any,
    permission_codes: list[str] | tuple[str, ...] | set[str],
) -> bool:
    codes = _normalize_permission_codes(permission_codes)

    if not codes:
        return False

    return any(has_permission(user, permission_code) for permission_code in codes)


def has_all_permissions(
    user: Any,
    permission_codes: list[str] | tuple[str, ...] | set[str],
) -> bool:
    codes = _normalize_permission_codes(permission_codes)

    if not codes:
        return False

    return all(has_permission(user, permission_code) for permission_code in codes)


def has_role(user: Any, role: str | RoleChoices) -> bool:
    return get_user_role(user) == _normalize_role_value(role)


def has_any_role(
    user: Any,
    roles: list[str | RoleChoices] | tuple[str | RoleChoices, ...] | set[str | RoleChoices],
) -> bool:
    normalized_roles = _normalize_role_codes(roles)

    if not normalized_roles:
        return False

    return get_user_role(user) in normalized_roles


def has_workspace(user: Any, workspace: str) -> bool:
    if not workspace:
        return False

    return get_user_workspace(user) == _normalize_workspace_value(workspace)


def has_any_workspace(
    user: Any,
    workspaces: list[str] | tuple[str, ...] | set[str],
) -> bool:
    normalized_workspaces = {
        _normalize_workspace_value(workspace)
        for workspace in workspaces
        if str(workspace or "").strip()
    }

    if not normalized_workspaces:
        return False

    return get_user_workspace(user) in normalized_workspaces


def can_access(
    user: Any,
    *,
    permission: str | None = None,
    permissions: list[str] | tuple[str, ...] | set[str] | None = None,
    any_permissions: list[str] | tuple[str, ...] | set[str] | None = None,
    all_permissions: list[str] | tuple[str, ...] | set[str] | None = None,
    role: str | RoleChoices | None = None,
    roles: list[str | RoleChoices] | tuple[str | RoleChoices, ...] | set[str | RoleChoices] | None = None,
    workspace: str | None = None,
    workspaces: list[str] | tuple[str, ...] | set[str] | None = None,
) -> bool:
    """
    فحص موحد مشابه للواجهة:
    - permission: صلاحية واحدة
    - permissions / any_permissions: يكفي امتلاك أي واحدة
    - all_permissions: يجب امتلاك الكل
    - role / roles: تحقق من الدور
    - workspace / workspaces: تحقق من مساحة العمل
    """
    if not user or not getattr(user, "is_authenticated", False):
        return False

    if getattr(user, "is_superuser", False):
        return True

    if is_system_admin(user):
        return True

    if role and not has_role(user, role):
        return False

    if roles and not has_any_role(user, roles):
        return False

    if workspace and not has_workspace(user, workspace):
        return False

    if workspaces and not has_any_workspace(user, workspaces):
        return False

    if permission and not has_permission(user, permission):
        return False

    if permissions and not has_any_permission(user, permissions):
        return False

    if any_permissions and not has_any_permission(user, any_permissions):
        return False

    if all_permissions and not has_all_permissions(user, all_permissions):
        return False

    return True


def require_permission(user: Any, permission_code: str) -> None:
    if not has_permission(user, permission_code):
        raise PermissionDenied("You do not have permission to perform this action.")


def require_any_permission(
    user: Any,
    permission_codes: list[str] | tuple[str, ...] | set[str],
) -> None:
    if not has_any_permission(user, permission_codes):
        raise PermissionDenied("You do not have permission to perform this action.")


def require_all_permissions(
    user: Any,
    permission_codes: list[str] | tuple[str, ...] | set[str],
) -> None:
    if not has_all_permissions(user, permission_codes):
        raise PermissionDenied("You do not have permission to perform this action.")


# ===============================================================
# 🧰 Function-Based API Decorators
# ===============================================================

def permission_required(permission_code: str):
    """
    Decorator مناسب للـ Django function based API views.
    يرجع JsonResponse 403 بدون الحاجة إلى Django REST Framework.
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            if not has_permission(request.user, permission_code):
                return JsonResponse(
                    {
                        "success": False,
                        "ok": False,
                        "message": "غير مصرح لك بتنفيذ هذا الإجراء.",
                        "required_permission": permission_code,
                    },
                    status=403,
                )

            return func(request, *args, **kwargs)

        return wrapper

    return decorator


def any_permission_required(
    permission_codes: list[str] | tuple[str, ...] | set[str],
):
    """
    Decorator يسمح بالمرور عند امتلاك أي صلاحية من القائمة.
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            if not has_any_permission(request.user, permission_codes):
                return JsonResponse(
                    {
                        "success": False,
                        "ok": False,
                        "message": "غير مصرح لك بتنفيذ هذا الإجراء.",
                        "required_permissions": sorted(
                            _normalize_permission_codes(permission_codes)
                        ),
                    },
                    status=403,
                )

            return func(request, *args, **kwargs)

        return wrapper

    return decorator


def all_permissions_required(
    permission_codes: list[str] | tuple[str, ...] | set[str],
):
    """
    Decorator يسمح بالمرور فقط عند امتلاك جميع الصلاحيات المطلوبة.
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            if not has_all_permissions(request.user, permission_codes):
                return JsonResponse(
                    {
                        "success": False,
                        "ok": False,
                        "message": "غير مصرح لك بتنفيذ هذا الإجراء.",
                        "required_permissions": sorted(
                            _normalize_permission_codes(permission_codes)
                        ),
                    },
                    status=403,
                )

            return func(request, *args, **kwargs)

        return wrapper

    return decorator


def role_required(role: str | RoleChoices):
    """
    Decorator يسمح بالمرور لدور واحد فقط.
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            if not has_role(request.user, role) and not is_system_admin(request.user):
                return JsonResponse(
                    {
                        "success": False,
                        "ok": False,
                        "message": "غير مصرح لك بتنفيذ هذا الإجراء.",
                        "required_role": _normalize_role_value(role),
                    },
                    status=403,
                )

            return func(request, *args, **kwargs)

        return wrapper

    return decorator


def any_role_required(
    roles: list[str | RoleChoices] | tuple[str | RoleChoices, ...] | set[str | RoleChoices],
):
    """
    Decorator يسمح بالمرور عند امتلاك أي دور من القائمة.
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            if not has_any_role(request.user, roles) and not is_system_admin(request.user):
                return JsonResponse(
                    {
                        "success": False,
                        "ok": False,
                        "message": "غير مصرح لك بتنفيذ هذا الإجراء.",
                        "required_roles": sorted(_normalize_role_codes(roles)),
                    },
                    status=403,
                )

            return func(request, *args, **kwargs)

        return wrapper

    return decorator


# ===============================================================
# 📤 Frontend Payload Helper
# ===============================================================

def build_permissions_payload(user: Any) -> dict[str, Any]:
    """
    Payload جاهز لإرجاعه من whoami إلى الواجهة.
    هذا هو الجسر الرسمي بين Backend permissions والـ Frontend guards/sidebar.
    """
    profile = get_user_profile(user)
    permissions_set = get_user_permissions(user)

    groups: list[str] = []
    if user and getattr(user, "is_authenticated", False):
        groups = list(user.groups.values_list("name", flat=True))

    role = get_user_role(user)
    workspace = get_user_workspace(user)

    return {
        "authenticated": bool(user and getattr(user, "is_authenticated", False)),
        "role": role,
        "workspace": workspace,
        "is_superuser": bool(getattr(user, "is_superuser", False)),
        "is_staff": bool(getattr(user, "is_staff", False)),
        "permission_codes": sorted(permissions_set),
        "permissions": {
            "codes": sorted(permissions_set),
            "groups": groups,
            "is_superuser": bool(getattr(user, "is_superuser", False)),
            "is_staff": bool(getattr(user, "is_staff", False)),
        },
        "profile_permissions": {
            "display_name": profile.display_name if profile else "",
            "user_type": profile.user_type if profile else "",
            "role": profile.role if profile else _normalize_role_value(RoleChoices.VIEWER),
            "workspace": workspace,
            "preferred_language": profile.preferred_language if profile else "ar",
            "timezone": profile.timezone if profile else "Asia/Riyadh",
            "extra_data": profile.extra_data if profile else {},
        },
    }


# ===============================================================
# 🧾 Exported Registry
# ===============================================================

def get_all_permissions() -> list[str]:
    return sorted(ALL_PERMISSIONS)


def get_permissions_matrix() -> dict[str, list[str]]:
    return {
        role: sorted(permissions)
        for role, permissions in PERMISSIONS_BY_ROLE.items()
    }