"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useAuth,
  type AuthSession,
} from "@/components/providers/AuthProvider";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

import {
  ChevronLeft,
  ChevronRight,
  Home,
  Building2,
  CreditCard,
  FileText,
  Package,
  Settings,
  Users,
  Wallet,
  UserCog,
  BarChart3,
  MessageCircle,
  Send,
  Boxes,
  ShoppingCart,
  Briefcase,
  ShieldCheck,
  ReceiptText,
  Plus,
  ListChecks,
  Stethoscope,
  Calculator,
  BookOpenCheck,
  Landmark,
  PieChart,
  Layers3,
  Banknote,
  ArrowLeftRight,
  BellRing,
  Inbox,
  type LucideIcon,
} from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import {
  canAccess,
  hasPermission,
  isSystemAdmin,
  PERMISSIONS,
  type PermissionCheckInput,
} from "@/lib/permissions";

/* =====================================================
   TYPES
===================================================== */

type AppLocale = "ar" | "en";

type WorkspaceType =
  | "system"
  | "company"
  | "center"
  | "provider"
  | "customer"
  | "agent";

type NavItem = {
  title: {
    ar: string;
    en: string;
  };
  href: string;
  aliases?: string[];
  icon?: LucideIcon;
  items?: NavItem[];
  newTab?: boolean;
  isNew?: boolean;
  isComing?: boolean;
  isDataBadge?: string;
  roles?: string[];
  apps?: string[];

  permission?: string | null;
  permissions?: string[] | readonly string[] | null;
  anyPermissions?: string[] | readonly string[] | null;
  allPermissions?: string[] | readonly string[] | null;
  workspace?: string | null;
  workspaces?: string[] | readonly string[] | null;
};

type NavGroup = {
  title: {
    ar: string;
    en: string;
  };
  items: NavItem[];
};

type NavMainProps = {
  type: WorkspaceType;
};

type SidebarAuthSession = Partial<AuthSession>;

/* =====================================================
   SYSTEM NAV — PRIMEY CARE
===================================================== */

const systemNavItems: NavGroup[] = [
  {
    title: {
      ar: "لوحات النظام",
      en: "System Workspace",
    },
    items: [
      {
        title: { ar: "الرئيسية", en: "Home" },
        href: "/system",
        icon: Home,
        permission: PERMISSIONS.SYSTEM_VIEW,
        workspaces: ["system"],
      },
      {
        title: { ar: "المراكز", en: "Centers" },
        href: "/system/centers",
        icon: Building2,
        permission: PERMISSIONS.PROVIDERS_VIEW,
        workspaces: ["system"],
        items: [
          {
            title: { ar: "لوحة المراكز", en: "Centers Overview" },
            href: "/system/centers",
            icon: Building2,
            permission: PERMISSIONS.PROVIDERS_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "قائمة المراكز", en: "Centers List" },
            href: "/system/centers/list",
            icon: ListChecks,
            permission: PERMISSIONS.PROVIDERS_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "إنشاء مركز", en: "Create Center" },
            href: "/system/centers/create",
            icon: Plus,
            permission: PERMISSIONS.PROVIDERS_CREATE,
            workspaces: ["system"],
          },
        ],
      },
      {
        title: { ar: "العملاء", en: "Customers" },
        href: "/system/customers",
        icon: Users,
        permission: PERMISSIONS.CUSTOMERS_VIEW,
        workspaces: ["system"],
        items: [
          {
            title: { ar: "لوحة العملاء", en: "Customers Overview" },
            href: "/system/customers",
            icon: Users,
            permission: PERMISSIONS.CUSTOMERS_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "قائمة العملاء", en: "Customers List" },
            href: "/system/customers/list",
            icon: ListChecks,
            permission: PERMISSIONS.CUSTOMERS_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "إنشاء عميل", en: "Create Customer" },
            href: "/system/customers/create",
            icon: Plus,
            permission: PERMISSIONS.CUSTOMERS_CREATE,
            workspaces: ["system"],
          },
        ],
      },
      {
        title: { ar: "المندوبون", en: "Agents" },
        href: "/system/agents",
        icon: Briefcase,
        permission: PERMISSIONS.AGENTS_VIEW,
        workspaces: ["system"],
        items: [
          {
            title: { ar: "لوحة المندوبين", en: "Agents Overview" },
            href: "/system/agents",
            icon: Briefcase,
            permission: PERMISSIONS.AGENTS_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "قائمة المندوبين", en: "Agents List" },
            href: "/system/agents/list",
            icon: ListChecks,
            permission: PERMISSIONS.AGENTS_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "إنشاء مندوب", en: "Create Agent" },
            href: "/system/agents/create",
            icon: Plus,
            permission: PERMISSIONS.AGENTS_CREATE,
            workspaces: ["system"],
          },
        ],
      },
      {
        title: { ar: "المنتجات", en: "Products" },
        href: "/system/products",
        icon: Boxes,
        permission: PERMISSIONS.PRODUCTS_VIEW,
        workspaces: ["system"],
        items: [
          {
            title: { ar: "لوحة المنتجات", en: "Products Overview" },
            href: "/system/products",
            icon: Boxes,
            permission: PERMISSIONS.PRODUCTS_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "قائمة المنتجات", en: "Products List" },
            href: "/system/products/list",
            icon: ListChecks,
            permission: PERMISSIONS.PRODUCTS_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "إنشاء منتج", en: "Create Product" },
            href: "/system/products/create",
            icon: Plus,
            permission: PERMISSIONS.PRODUCTS_CREATE,
            workspaces: ["system"],
          },
        ],
      },
      {
        title: { ar: "الطلبات", en: "Orders" },
        href: "/system/orders",
        icon: ShoppingCart,
        permission: PERMISSIONS.ORDERS_VIEW,
        workspaces: ["system"],
        items: [
          {
            title: { ar: "لوحة الطلبات", en: "Orders Overview" },
            href: "/system/orders",
            icon: ShoppingCart,
            permission: PERMISSIONS.ORDERS_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "قائمة الطلبات", en: "Orders List" },
            href: "/system/orders/list",
            icon: ListChecks,
            permission: PERMISSIONS.ORDERS_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "إنشاء طلب", en: "Create Order" },
            href: "/system/orders/create",
            icon: Plus,
            permission: PERMISSIONS.ORDERS_CREATE,
            workspaces: ["system"],
          },
        ],
      },
      {
        title: { ar: "مقدمو الخدمة", en: "Providers" },
        href: "/system/providers",
        icon: Stethoscope,
        permission: PERMISSIONS.PROVIDERS_VIEW,
        workspaces: ["system"],
        items: [
          {
            title: { ar: "لوحة مقدمي الخدمة", en: "Providers Overview" },
            href: "/system/providers",
            icon: Stethoscope,
            permission: PERMISSIONS.PROVIDERS_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "قائمة مقدمي الخدمة", en: "Providers List" },
            href: "/system/providers/list",
            icon: ListChecks,
            permission: PERMISSIONS.PROVIDERS_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "إنشاء مقدم خدمة", en: "Create Provider" },
            href: "/system/providers/create",
            icon: Plus,
            permission: PERMISSIONS.PROVIDERS_CREATE,
            workspaces: ["system"],
          },
        ],
      },
      {
        title: { ar: "العقود", en: "Contracts" },
        href: "/system/contracts",
        icon: FileText,
        permission: PERMISSIONS.CONTRACTS_VIEW,
        workspaces: ["system"],
        items: [
          {
            title: { ar: "لوحة العقود", en: "Contracts Overview" },
            href: "/system/contracts",
            icon: FileText,
            permission: PERMISSIONS.CONTRACTS_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "قائمة العقود", en: "Contracts List" },
            href: "/system/contracts/list",
            icon: ListChecks,
            permission: PERMISSIONS.CONTRACTS_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "إنشاء عقد", en: "Create Contract" },
            href: "/system/contracts/create",
            icon: Plus,
            permission: PERMISSIONS.CONTRACTS_CREATE,
            workspaces: ["system"],
          },
        ],
      },
      {
        title: { ar: "الفواتير", en: "Invoices" },
        href: "/system/invoices",
        icon: ReceiptText,
        permission: PERMISSIONS.INVOICES_VIEW,
        workspaces: ["system"],
        items: [
          {
            title: { ar: "لوحة الفواتير", en: "Invoices Overview" },
            href: "/system/invoices",
            icon: ReceiptText,
            permission: PERMISSIONS.INVOICES_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "قائمة الفواتير", en: "Invoices List" },
            href: "/system/invoices/list",
            icon: ListChecks,
            permission: PERMISSIONS.INVOICES_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "إنشاء فاتورة", en: "Create Invoice" },
            href: "/system/invoices/create",
            icon: Plus,
            permission: PERMISSIONS.INVOICES_CREATE,
            workspaces: ["system"],
          },
        ],
      },
      {
        title: { ar: "المدفوعات", en: "Payments" },
        href: "/system/payments",
        icon: CreditCard,
        permission: PERMISSIONS.PAYMENTS_VIEW,
        workspaces: ["system"],
        items: [
          {
            title: { ar: "لوحة المدفوعات", en: "Payments Overview" },
            href: "/system/payments",
            icon: CreditCard,
            permission: PERMISSIONS.PAYMENTS_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "قائمة المدفوعات", en: "Payments List" },
            href: "/system/payments/list",
            icon: ListChecks,
            permission: PERMISSIONS.PAYMENTS_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "تسجيل دفعة", en: "Create Payment" },
            href: "/system/payments/create",
            icon: Plus,
            permission: PERMISSIONS.PAYMENTS_CREATE,
            workspaces: ["system"],
          },
        ],
      },
      {
        title: { ar: "المحاسبة", en: "Accounting" },
        href: "/system/accounting",
        icon: BarChart3,
        permission: PERMISSIONS.ACCOUNTING_VIEW,
        workspaces: ["system"],
        items: [
          {
            title: { ar: "لوحة المحاسبة", en: "Accounting Overview" },
            href: "/system/accounting",
            icon: Calculator,
            permission: PERMISSIONS.ACCOUNTING_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "دليل الحسابات", en: "Chart of Accounts" },
            href: "/system/accounting/accounts",
            icon: Layers3,
            permission: PERMISSIONS.ACCOUNTING_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "القيود اليومية", en: "Journal Entries" },
            href: "/system/accounting/journals",
            icon: ReceiptText,
            permission: PERMISSIONS.ACCOUNTING_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "دفتر الأستاذ", en: "General Ledger" },
            href: "/system/accounting/ledger",
            icon: BookOpenCheck,
            permission: PERMISSIONS.ACCOUNTING_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "ميزان المراجعة", en: "Trial Balance" },
            href: "/system/accounting/trial-balance",
            icon: ListChecks,
            permission: PERMISSIONS.ACCOUNTING_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "الأرباح والخسائر", en: "Profit & Loss" },
            href: "/system/accounting/profit-loss",
            icon: PieChart,
            permission: PERMISSIONS.ACCOUNTING_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "المركز المالي", en: "Balance Sheet" },
            href: "/system/accounting/balance-sheet",
            icon: Landmark,
            permission: PERMISSIONS.ACCOUNTING_VIEW,
            workspaces: ["system"],
          },
        ],
      },
      {
        title: { ar: "الخزينة", en: "Treasury" },
        href: "/system/treasury",
        icon: Wallet,
        permission: PERMISSIONS.TREASURY_VIEW,
        workspaces: ["system"],
        items: [
          {
            title: { ar: "لوحة الخزينة", en: "Treasury Overview" },
            href: "/system/treasury",
            icon: Wallet,
            permission: PERMISSIONS.TREASURY_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "حسابات الخزينة", en: "Treasury Accounts" },
            href: "/system/treasury/accounts",
            icon: Wallet,
            permission: PERMISSIONS.TREASURY_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "إنشاء حساب خزينة", en: "Create Treasury Account" },
            href: "/system/treasury/accounts/create",
            icon: Plus,
            permission: PERMISSIONS.TREASURY_CREATE,
            workspaces: ["system"],
          },
          {
            title: { ar: "الصناديق النقدية", en: "Cashboxes" },
            href: "/system/treasury/cashboxes",
            icon: Banknote,
            permission: PERMISSIONS.TREASURY_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "الحسابات البنكية", en: "Bank Accounts" },
            href: "/system/treasury/banks",
            icon: Building2,
            permission: PERMISSIONS.TREASURY_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "الحركات المالية", en: "Transactions" },
            href: "/system/treasury/transactions",
            icon: CreditCard,
            permission: PERMISSIONS.TREASURY_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "إضافة حركة مالية", en: "Create Transaction" },
            href: "/system/treasury/transactions/create",
            icon: Plus,
            permission: PERMISSIONS.TREASURY_CREATE,
            workspaces: ["system"],
          },
          {
            title: { ar: "التحويلات", en: "Transfers" },
            href: "/system/treasury/transfers",
            icon: ArrowLeftRight,
            permission: PERMISSIONS.TREASURY_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "إعدادات الخزينة", en: "Treasury Settings" },
            href: "/system/treasury/settings",
            icon: Settings,
            permission: PERMISSIONS.TREASURY_EDIT,
            workspaces: ["system"],
          },
        ],
      },
      {
        title: { ar: "التقارير", en: "Reports" },
        href: "/system/reports",
        icon: BarChart3,
        permission: PERMISSIONS.REPORTS_VIEW,
        workspaces: ["system"],
        items: [
          {
            title: { ar: "لوحة التقارير", en: "Reports Overview" },
            href: "/system/reports",
            icon: BarChart3,
            permission: PERMISSIONS.REPORTS_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "تقارير العملاء", en: "Customers Reports" },
            href: "/system/reports/customers",
            icon: Users,
            anyPermissions: [
              PERMISSIONS.REPORTS_VIEW,
              PERMISSIONS.REPORTS_CUSTOMERS_VIEW,
            ],
            workspaces: ["system"],
          },
          {
            title: { ar: "تقارير المراكز", en: "Centers Reports" },
            href: "/system/reports/providers",
            icon: Building2,
            anyPermissions: [
              PERMISSIONS.REPORTS_VIEW,
              PERMISSIONS.REPORTS_PROVIDERS_VIEW,
            ],
            workspaces: ["system"],
          },
          {
            title: { ar: "تقارير الطلبات", en: "Orders Reports" },
            href: "/system/reports/orders",
            icon: ShoppingCart,
            anyPermissions: [
              PERMISSIONS.REPORTS_VIEW,
              PERMISSIONS.REPORTS_ORDERS_VIEW,
            ],
            workspaces: ["system"],
          },
          {
            title: { ar: "تقارير الفواتير", en: "Invoices Reports" },
            href: "/system/reports/invoices",
            icon: ReceiptText,
            anyPermissions: [
              PERMISSIONS.REPORTS_VIEW,
              PERMISSIONS.REPORTS_INVOICES_VIEW,
            ],
            workspaces: ["system"],
          },
          {
            title: { ar: "تقارير المدفوعات", en: "Payments Reports" },
            href: "/system/reports/payments",
            icon: CreditCard,
            anyPermissions: [
              PERMISSIONS.REPORTS_VIEW,
              PERMISSIONS.REPORTS_PAYMENTS_VIEW,
            ],
            workspaces: ["system"],
          },
          {
            title: { ar: "تقارير المحاسبة", en: "Accounting Reports" },
            href: "/system/reports/accounting",
            icon: Calculator,
            anyPermissions: [
              PERMISSIONS.REPORTS_VIEW,
              PERMISSIONS.REPORTS_ACCOUNTING_VIEW,
              PERMISSIONS.ACCOUNTING_VIEW,
            ],
            workspaces: ["system"],
          },
        ],
      },
      {
        title: { ar: "الإشعارات", en: "Notifications" },
        href: "/system/notifications",
        icon: BellRing,
        anyPermissions: [PERMISSIONS.SYSTEM_VIEW, PERMISSIONS.SYSTEM_SETTINGS],
        workspaces: ["system"],
        items: [
          {
            title: { ar: "لوحة الإشعارات", en: "Notifications Overview" },
            href: "/system/notifications",
            icon: BellRing,
            anyPermissions: [PERMISSIONS.SYSTEM_VIEW, PERMISSIONS.SYSTEM_SETTINGS],
            workspaces: ["system"],
          },
          {
            title: { ar: "قائمة الإشعارات", en: "Notifications List" },
            href: "/system/notifications/list",
            icon: ListChecks,
            anyPermissions: [PERMISSIONS.SYSTEM_VIEW, PERMISSIONS.SYSTEM_SETTINGS],
            workspaces: ["system"],
          },
          {
            title: { ar: "إعدادات الإشعارات", en: "Notification Settings" },
            href: "/system/notifications/settings",
            icon: Settings,
            anyPermissions: [PERMISSIONS.SYSTEM_VIEW, PERMISSIONS.SYSTEM_SETTINGS],
            workspaces: ["system"],
          },
        ],
      },
      {
        title: { ar: "واتساب", en: "WhatsApp" },
        href: "/system/whatsapp",
        icon: MessageCircle,
        anyPermissions: [PERMISSIONS.SYSTEM_VIEW, PERMISSIONS.SYSTEM_SETTINGS],
        workspaces: ["system"],
        items: [
          {
            title: { ar: "لوحة واتساب", en: "WhatsApp Overview" },
            href: "/system/whatsapp",
            icon: MessageCircle,
            anyPermissions: [PERMISSIONS.SYSTEM_VIEW, PERMISSIONS.SYSTEM_SETTINGS],
            workspaces: ["system"],
          },
          {
            title: { ar: "صندوق المحادثات", en: "Inbox" },
            href: "/system/whatsapp/inbox",
            icon: Inbox,
            anyPermissions: [PERMISSIONS.SYSTEM_VIEW, PERMISSIONS.SYSTEM_SETTINGS],
            workspaces: ["system"],
          },
          {
            title: { ar: "السجلات", en: "Logs" },
            href: "/system/whatsapp/logs",
            icon: ListChecks,
            anyPermissions: [PERMISSIONS.SYSTEM_VIEW, PERMISSIONS.SYSTEM_SETTINGS],
            workspaces: ["system"],
          },
          {
            title: { ar: "القوالب", en: "Templates" },
            href: "/system/whatsapp/templates",
            icon: FileText,
            anyPermissions: [PERMISSIONS.SYSTEM_VIEW, PERMISSIONS.SYSTEM_SETTINGS],
            workspaces: ["system"],
          },
          {
            title: { ar: "البث الجماعي", en: "Broadcasts" },
            href: "/system/whatsapp/broadcasts",
            icon: Send,
            anyPermissions: [PERMISSIONS.SYSTEM_VIEW, PERMISSIONS.SYSTEM_SETTINGS],
            workspaces: ["system"],
          },
          {
            title: { ar: "إعدادات واتساب", en: "WhatsApp Settings" },
            href: "/system/whatsapp/settings",
            icon: Settings,
            anyPermissions: [PERMISSIONS.SYSTEM_VIEW, PERMISSIONS.SYSTEM_SETTINGS],
            workspaces: ["system"],
          },
        ],
      },
      {
        title: { ar: "مستخدمو النظام", en: "System Users" },
        href: "/system/users",
        icon: UserCog,
        permission: PERMISSIONS.USERS_VIEW,
        workspaces: ["system"],
        items: [
          {
            title: { ar: "لوحة المستخدمين", en: "Users Overview" },
            href: "/system/users",
            icon: UserCog,
            permission: PERMISSIONS.USERS_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "قائمة المستخدمين", en: "Users List" },
            href: "/system/users",
            icon: ListChecks,
            permission: PERMISSIONS.USERS_VIEW,
            workspaces: ["system"],
          },
          {
            title: { ar: "إضافة مستخدم", en: "Create User" },
            href: "/system/users/create",
            icon: Plus,
            permission: PERMISSIONS.USERS_CREATE,
            workspaces: ["system"],
          },
        ],
      },
      {
        title: { ar: "الإعدادات", en: "Settings" },
        href: "/system/settings",
        icon: Settings,
        permission: PERMISSIONS.SYSTEM_SETTINGS,
        workspaces: ["system"],
      },
    ],
  },
];

/* =====================================================
   CENTER / PROVIDER NAV
===================================================== */

const centerNavItems: NavGroup[] = [
  {
    title: {
      ar: "لوحة المركز",
      en: "Center Workspace",
    },
    items: [
      {
        title: { ar: "الرئيسية", en: "Home" },
        href: "/company",
        aliases: ["/center", "/provider"],
        icon: Home,
        permission: PERMISSIONS.PROVIDER_WORKSPACE_VIEW,
        workspaces: ["provider"],
      },
      {
        title: { ar: "العملاء", en: "Customers" },
        href: "/company/customers",
        aliases: ["/center/customers", "/provider/customers"],
        icon: Users,
        permission: PERMISSIONS.CUSTOMERS_VIEW,
        workspaces: ["provider"],
      },
      {
        title: { ar: "الطلبات", en: "Orders" },
        href: "/company/orders",
        aliases: ["/center/orders", "/provider/orders"],
        icon: ShoppingCart,
        anyPermissions: [
          PERMISSIONS.PROVIDER_ORDERS_VIEW,
          PERMISSIONS.ORDERS_VIEW,
        ],
        workspaces: ["provider"],
      },
      {
        title: { ar: "المنتجات", en: "Products" },
        href: "/company/products",
        aliases: ["/center/products", "/provider/products"],
        icon: Boxes,
        permission: PERMISSIONS.PRODUCTS_VIEW,
        workspaces: ["provider"],
      },
      {
        title: { ar: "العقود", en: "Contracts" },
        href: "/company/contracts",
        aliases: ["/center/contracts", "/provider/contracts"],
        icon: FileText,
        anyPermissions: [
          PERMISSIONS.PROVIDER_CONTRACTS_VIEW,
          PERMISSIONS.CONTRACTS_VIEW,
        ],
        workspaces: ["provider"],
      },
      {
        title: { ar: "الفواتير", en: "Invoices" },
        href: "/company/invoices",
        aliases: ["/center/invoices", "/provider/invoices"],
        icon: ReceiptText,
        permission: PERMISSIONS.INVOICES_VIEW,
        workspaces: ["provider"],
        items: [
          {
            title: { ar: "لوحة الفواتير", en: "Invoices Overview" },
            href: "/company/invoices",
            aliases: ["/center/invoices", "/provider/invoices"],
            icon: ReceiptText,
            permission: PERMISSIONS.INVOICES_VIEW,
            workspaces: ["provider"],
          },
          {
            title: { ar: "قائمة الفواتير", en: "Invoices List" },
            href: "/company/invoices/list",
            aliases: ["/center/invoices/list", "/provider/invoices/list"],
            icon: ListChecks,
            permission: PERMISSIONS.INVOICES_VIEW,
            workspaces: ["provider"],
          },
          {
            title: { ar: "إنشاء فاتورة", en: "Create Invoice" },
            href: "/company/invoices/create",
            aliases: ["/center/invoices/create", "/provider/invoices/create"],
            icon: Plus,
            permission: PERMISSIONS.INVOICES_CREATE,
            workspaces: ["provider"],
          },
        ],
      },
      {
        title: { ar: "المدفوعات", en: "Payments" },
        href: "/company/payments",
        aliases: ["/center/payments", "/provider/payments"],
        icon: CreditCard,
        permission: PERMISSIONS.PAYMENTS_VIEW,
        workspaces: ["provider"],
        items: [
          {
            title: { ar: "لوحة المدفوعات", en: "Payments Overview" },
            href: "/company/payments",
            aliases: ["/center/payments", "/provider/payments"],
            icon: CreditCard,
            permission: PERMISSIONS.PAYMENTS_VIEW,
            workspaces: ["provider"],
          },
          {
            title: { ar: "قائمة المدفوعات", en: "Payments List" },
            href: "/company/payments/list",
            aliases: ["/center/payments/list", "/provider/payments/list"],
            icon: ListChecks,
            permission: PERMISSIONS.PAYMENTS_VIEW,
            workspaces: ["provider"],
          },
          {
            title: { ar: "تسجيل دفعة", en: "Create Payment" },
            href: "/company/payments/create",
            aliases: ["/center/payments/create", "/provider/payments/create"],
            icon: Plus,
            permission: PERMISSIONS.PAYMENTS_CREATE,
            workspaces: ["provider"],
          },
        ],
      },
      {
        title: { ar: "المستخدمون", en: "Users" },
        href: "/company/users",
        aliases: ["/center/users", "/provider/users"],
        icon: UserCog,
        roles: ["provider_admin", "system_admin"],
        workspaces: ["provider"],
      },
      {
        title: { ar: "الإعدادات", en: "Settings" },
        href: "/company/settings",
        aliases: ["/center/settings", "/provider/settings"],
        icon: Settings,
        roles: ["provider_admin", "system_admin"],
        workspaces: ["provider"],
      },
    ],
  },
];

/* =====================================================
   CUSTOMER NAV
===================================================== */

const customerNavItems: NavGroup[] = [
  {
    title: {
      ar: "مساحة العميل",
      en: "Customer Workspace",
    },
    items: [
      {
        title: { ar: "الرئيسية", en: "Home" },
        href: "/customer",
        icon: Home,
        permission: PERMISSIONS.CUSTOMER_WORKSPACE_VIEW,
        workspaces: ["customer"],
      },
      {
        title: { ar: "طلباتي", en: "My Orders" },
        href: "/customer/orders",
        icon: ShoppingCart,
        anyPermissions: [
          PERMISSIONS.CUSTOMER_ORDERS_VIEW,
          PERMISSIONS.ORDERS_VIEW,
        ],
        workspaces: ["customer"],
      },
      {
        title: { ar: "فواتيري", en: "My Invoices" },
        href: "/customer/invoices",
        icon: ReceiptText,
        permission: PERMISSIONS.INVOICES_VIEW,
        workspaces: ["customer"],
      },
      {
        title: { ar: "مدفوعاتي", en: "My Payments" },
        href: "/customer/payments",
        icon: CreditCard,
        permission: PERMISSIONS.PAYMENTS_VIEW,
        workspaces: ["customer"],
      },
      {
        title: { ar: "الباقات والخدمات", en: "Plans & Services" },
        href: "/customer/products",
        icon: Package,
        permission: PERMISSIONS.CUSTOMER_WORKSPACE_VIEW,
        workspaces: ["customer"],
      },
      {
        title: { ar: "الدعم والمحادثات", en: "Support & Chats" },
        href: "/customer/support",
        icon: MessageCircle,
        permission: PERMISSIONS.CUSTOMER_WORKSPACE_VIEW,
        workspaces: ["customer"],
      },
      {
        title: { ar: "حسابي", en: "My Account" },
        href: "/customer/account",
        icon: ShieldCheck,
        permission: PERMISSIONS.CUSTOMER_WORKSPACE_VIEW,
        workspaces: ["customer"],
      },
      {
        title: { ar: "الإعدادات", en: "Settings" },
        href: "/customer/settings",
        icon: Settings,
        permission: PERMISSIONS.CUSTOMER_WORKSPACE_VIEW,
        workspaces: ["customer"],
      },
    ],
  },
];

/* =====================================================
   AGENT NAV
===================================================== */

const agentNavItems: NavGroup[] = [
  {
    title: {
      ar: "مساحة المندوب",
      en: "Agent Workspace",
    },
    items: [
      {
        title: { ar: "الرئيسية", en: "Home" },
        href: "/agent",
        icon: Home,
        permission: PERMISSIONS.AGENT_WORKSPACE_VIEW,
        workspaces: ["agent"],
      },
      {
        title: { ar: "عملائي", en: "My Customers" },
        href: "/agent/customers",
        icon: Users,
        anyPermissions: [
          PERMISSIONS.AGENT_CUSTOMERS_VIEW,
          PERMISSIONS.CUSTOMERS_VIEW,
        ],
        workspaces: ["agent"],
      },
      {
        title: { ar: "طلباتي", en: "My Orders" },
        href: "/agent/orders",
        icon: ShoppingCart,
        permission: PERMISSIONS.ORDERS_VIEW,
        workspaces: ["agent"],
      },
      {
        title: { ar: "عمولاتي", en: "My Commissions" },
        href: "/agent/commissions",
        icon: Wallet,
        permission: PERMISSIONS.AGENT_COMMISSIONS_VIEW,
        workspaces: ["agent"],
      },
      {
        title: { ar: "مدفوعاتي", en: "My Payments" },
        href: "/agent/payments",
        icon: CreditCard,
        permission: PERMISSIONS.PAYMENTS_VIEW,
        workspaces: ["agent"],
      },
      {
        title: { ar: "حسابي", en: "My Account" },
        href: "/agent/account",
        icon: ShieldCheck,
        permission: PERMISSIONS.AGENT_WORKSPACE_VIEW,
        workspaces: ["agent"],
      },
      {
        title: { ar: "الإعدادات", en: "Settings" },
        href: "/agent/settings",
        icon: Settings,
        permission: PERMISSIONS.AGENT_WORKSPACE_VIEW,
        workspaces: ["agent"],
      },
    ],
  },
];

/* =====================================================
   HELPERS
===================================================== */

function normalizePath(path: string): string {
  if (path === "/center" || path === "/provider") return "/company";

  if (path.startsWith("/center/")) {
    return path.replace("/center", "/company");
  }

  if (path.startsWith("/provider/")) {
    return path.replace("/provider", "/company");
  }

  return path;
}

function matchesHref(pathname: string, href: string): boolean {
  const normalizedPathname = normalizePath(pathname);
  const normalizedHref = normalizePath(href);
  const rootRoutes = [
    "/system",
    "/company",
    "/center",
    "/provider",
    "/customer",
    "/agent",
  ];

  if (rootRoutes.includes(normalizedHref)) {
    return normalizedPathname === normalizedHref;
  }

  return (
    normalizedPathname === normalizedHref ||
    normalizedPathname.startsWith(`${normalizedHref}/`)
  );
}

function isItemActive(pathname: string, item: NavItem): boolean {
  if (matchesHref(pathname, item.href)) {
    return true;
  }

  return (item.aliases || []).some((alias) => matchesHref(pathname, alias));
}

function normalizeLower(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function hasRequiredRole(
  itemRoles: string[] | readonly string[] | undefined,
  currentRole: string,
): boolean {
  if (!itemRoles || itemRoles.length === 0) return true;
  if (!currentRole) return false;

  return itemRoles.map(normalizeLower).includes(currentRole);
}

function hasRequiredApps(
  itemApps: string[] | undefined,
  enabledApps: string[],
): boolean {
  if (!itemApps || itemApps.length === 0) return true;

  return itemApps.some((app) => enabledApps.includes(app));
}

function getStoredLocale(): AppLocale {
  try {
    if (typeof window === "undefined") return "ar";

    const savedLocale = window.localStorage.getItem("primey-locale");
    if (savedLocale === "en") return "en";
    if (savedLocale === "ar") return "ar";

    const htmlLang = document.documentElement.lang;
    return htmlLang === "en" ? "en" : "ar";
  } catch (error) {
    console.error("Read locale error:", error);
    return "ar";
  }
}

function applyDocumentLocale(locale: AppLocale): void {
  try {
    if (typeof document === "undefined") return;

    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.body.dir = locale === "ar" ? "rtl" : "ltr";
  } catch (error) {
    console.error("Apply locale error:", error);
  }
}

function inferPermissionInputByHref(item: NavItem): PermissionCheckInput {
  if (
    item.permission ||
    item.permissions ||
    item.anyPermissions ||
    item.allPermissions ||
    item.roles ||
    item.workspace ||
    item.workspaces
  ) {
    return {
      permission: item.permission,
      permissions: item.permissions,
      anyPermissions: item.anyPermissions,
      allPermissions: item.allPermissions,
      roles: item.roles,
      workspace: item.workspace,
      workspaces: item.workspaces,
    };
  }

  const href = item.href;

  if (href === "/system") {
    return {
      permission: PERMISSIONS.SYSTEM_VIEW,
      workspaces: ["system"],
    };
  }

  if (href.startsWith("/system/notifications")) {
    return {
      anyPermissions: [PERMISSIONS.SYSTEM_VIEW, PERMISSIONS.SYSTEM_SETTINGS],
      workspaces: ["system"],
    };
  }

  if (href.startsWith("/system/whatsapp")) {
    return {
      anyPermissions: [PERMISSIONS.SYSTEM_VIEW, PERMISSIONS.SYSTEM_SETTINGS],
      workspaces: ["system"],
    };
  }

  if (href.startsWith("/system/reports")) {
    return {
      permission: PERMISSIONS.REPORTS_VIEW,
      workspaces: ["system"],
    };
  }

  if (href.startsWith("/system/users/create")) {
    return {
      permission: PERMISSIONS.USERS_CREATE,
      workspaces: ["system"],
    };
  }

  if (href.startsWith("/system/users")) {
    return {
      permission: PERMISSIONS.USERS_VIEW,
      workspaces: ["system"],
    };
  }

  if (href.startsWith("/system/settings")) {
    return {
      permission: PERMISSIONS.SYSTEM_SETTINGS,
      workspaces: ["system"],
    };
  }

  if (href.startsWith("/system/centers") || href.startsWith("/system/providers")) {
    return {
      permission: href.includes("/create")
        ? PERMISSIONS.PROVIDERS_CREATE
        : PERMISSIONS.PROVIDERS_VIEW,
      workspaces: ["system"],
    };
  }

  if (href.startsWith("/system/customers")) {
    return {
      permission: href.includes("/create")
        ? PERMISSIONS.CUSTOMERS_CREATE
        : PERMISSIONS.CUSTOMERS_VIEW,
      workspaces: ["system"],
    };
  }

  if (href.startsWith("/system/agents")) {
    return {
      permission: href.includes("/create")
        ? PERMISSIONS.AGENTS_CREATE
        : PERMISSIONS.AGENTS_VIEW,
      workspaces: ["system"],
    };
  }

  if (href.startsWith("/system/products")) {
    return {
      permission: href.includes("/create")
        ? PERMISSIONS.PRODUCTS_CREATE
        : PERMISSIONS.PRODUCTS_VIEW,
      workspaces: ["system"],
    };
  }

  if (href.startsWith("/system/orders")) {
    return {
      permission: href.includes("/create")
        ? PERMISSIONS.ORDERS_CREATE
        : PERMISSIONS.ORDERS_VIEW,
      workspaces: ["system"],
    };
  }

  if (href.startsWith("/system/contracts")) {
    return {
      permission: href.includes("/create")
        ? PERMISSIONS.CONTRACTS_CREATE
        : PERMISSIONS.CONTRACTS_VIEW,
      workspaces: ["system"],
    };
  }

  if (href.startsWith("/system/invoices")) {
    return {
      permission: href.includes("/create")
        ? PERMISSIONS.INVOICES_CREATE
        : PERMISSIONS.INVOICES_VIEW,
      workspaces: ["system"],
    };
  }

  if (href.startsWith("/system/payments")) {
    return {
      permission: href.includes("/create")
        ? PERMISSIONS.PAYMENTS_CREATE
        : PERMISSIONS.PAYMENTS_VIEW,
      workspaces: ["system"],
    };
  }

  if (href.startsWith("/system/accounting")) {
    return {
      permission: PERMISSIONS.ACCOUNTING_VIEW,
      workspaces: ["system"],
    };
  }

  if (href.startsWith("/system/treasury")) {
    return {
      permission:
        href.includes("/create") || href.includes("/settings")
          ? PERMISSIONS.TREASURY_CREATE
          : PERMISSIONS.TREASURY_VIEW,
      workspaces: ["system"],
    };
  }

  if (href.startsWith("/customer")) {
    return {
      permission: PERMISSIONS.CUSTOMER_WORKSPACE_VIEW,
      workspaces: ["customer"],
    };
  }

  if (href.startsWith("/agent")) {
    return {
      permission: PERMISSIONS.AGENT_WORKSPACE_VIEW,
      workspaces: ["agent"],
    };
  }

  if (
    href.startsWith("/company") ||
    href.startsWith("/center") ||
    href.startsWith("/provider")
  ) {
    return {
      permission: PERMISSIONS.PROVIDER_WORKSPACE_VIEW,
      workspaces: ["provider"],
    };
  }

  return {};
}

function canAccessNavItem(
  authSession: SidebarAuthSession,
  item: NavItem,
  currentRole: string,
  enabledApps: string[],
): boolean {
  const appAllowed = hasRequiredApps(item.apps, enabledApps);
  if (!appAllowed) return false;

  const roleAllowed = hasRequiredRole(item.roles, currentRole);
  if (!roleAllowed && !isSystemAdmin(authSession)) return false;

  const input = inferPermissionInputByHref(item);

  if (
    !input.permission &&
    !input.permissions &&
    !input.anyPermissions &&
    !input.allPermissions &&
    !input.workspace &&
    !input.workspaces
  ) {
    return true;
  }

  if (canAccess(authSession, input)) {
    return true;
  }

  if (input.permission && hasPermission(authSession, input.permission)) {
    return true;
  }

  return false;
}

function filterNavItems(
  items: NavItem[],
  authSession: SidebarAuthSession,
  currentRole: string,
  enabledApps: string[],
): NavItem[] {
  return items
    .map((item) => {
      const filteredChildren = item.items
        ? filterNavItems(item.items, authSession, currentRole, enabledApps)
        : undefined;

      return {
        ...item,
        items: filteredChildren,
      };
    })
    .filter((item) => {
      const ownAccess = canAccessNavItem(
        authSession,
        item,
        currentRole,
        enabledApps,
      );

      const hasVisibleChildren = Boolean(item.items && item.items.length > 0);

      return ownAccess || hasVisibleChildren;
    });
}

function filterNavGroups(
  groups: NavGroup[],
  authSession: SidebarAuthSession,
  currentRole: string,
  enabledApps: string[],
): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: filterNavItems(group.items, authSession, currentRole, enabledApps),
    }))
    .filter((group) => group.items.length > 0);
}

function hasActiveChild(pathname: string, item: NavItem): boolean {
  return Boolean(
    item.items?.some((subItem) => {
      if (isItemActive(pathname, subItem)) return true;

      return hasActiveChild(pathname, subItem);
    }),
  );
}

/* =====================================================
   COMPONENT
===================================================== */

export function NavMain({ type }: NavMainProps) {
  const pathname = usePathname();
  const authSession = useAuth() as SidebarAuthSession;

  const [locale, setLocale] = useState<AppLocale>("ar");

  const currentRole = String(authSession.role || "").toLowerCase();
  const enabledApps = Array.isArray(authSession.subscription?.apps)
    ? authSession.subscription.apps.map((app) => String(app).toLowerCase())
    : [];

  useEffect(() => {
    const syncLocale = () => {
      const nextLocale = getStoredLocale();

      applyDocumentLocale(nextLocale);
      setLocale(nextLocale);
    };

    const syncLocaleAfterPaint = () => {
      syncLocale();

      window.setTimeout(() => {
        syncLocale();
      }, 0);
    };

    syncLocaleAfterPaint();

    window.addEventListener("primey-locale-changed", syncLocaleAfterPaint);
    window.addEventListener("storage", syncLocaleAfterPaint);

    return () => {
      window.removeEventListener("primey-locale-changed", syncLocaleAfterPaint);
      window.removeEventListener("storage", syncLocaleAfterPaint);
    };
  }, []);

  const isArabic = locale === "ar";
  const ChevronIcon = isArabic ? ChevronLeft : ChevronRight;

  const navItems = useMemo(() => {
    if (type === "system") {
      return filterNavGroups(
        systemNavItems,
        authSession,
        currentRole,
        enabledApps,
      );
    }

    if (type === "customer") {
      return filterNavGroups(
        customerNavItems,
        authSession,
        currentRole,
        enabledApps,
      );
    }

    if (type === "agent") {
      return filterNavGroups(
        agentNavItems,
        authSession,
        currentRole,
        enabledApps,
      );
    }

    return filterNavGroups(
      centerNavItems,
      authSession,
      currentRole,
      enabledApps,
    );
  }, [type, authSession, currentRole, enabledApps]);

  return (
    <>
      {navItems.map((nav) => (
        <SidebarGroup key={nav.title.en}>
          <SidebarGroupLabel>
            {isArabic ? nav.title.ar : nav.title.en}
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {nav.items.map((item) => {
                const Icon = item.icon;
                const itemTitle = isArabic ? item.title.ar : item.title.en;
                const activeParent =
                  isItemActive(pathname, item) || hasActiveChild(pathname, item);

                if (item.items?.length) {
                  return (
                    <SidebarMenuItem key={item.title.en}>
                      <Collapsible defaultOpen={activeParent}>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            tooltip={itemTitle}
                            isActive={activeParent}
                          >
                            <div
                              className={`flex w-full items-center gap-2 ${
                                isArabic
                                  ? "flex-row-reverse text-right"
                                  : "flex-row text-left"
                              }`}
                            >
                              {Icon ? <Icon className="shrink-0" /> : null}

                              <span className="flex-1 truncate">
                                {itemTitle}
                              </span>

                              {item.isNew ? (
                                <SidebarMenuBadge>
                                  {isArabic ? "جديد" : "New"}
                                </SidebarMenuBadge>
                              ) : null}

                              <ChevronIcon className="h-4 w-4 shrink-0" />
                            </div>
                          </SidebarMenuButton>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.items.map((subItem) => {
                              const SubIcon = subItem.icon;
                              const subTitle = isArabic
                                ? subItem.title.ar
                                : subItem.title.en;

                              return (
                                <SidebarMenuSubItem key={subItem.title.en}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={isItemActive(pathname, subItem)}
                                  >
                                    <Link
                                      href={subItem.href}
                                      target={
                                        subItem.newTab ? "_blank" : undefined
                                      }
                                      className={`flex w-full items-center gap-2 ${
                                        isArabic
                                          ? "flex-row-reverse text-right"
                                          : "flex-row text-left"
                                      }`}
                                    >
                                      {SubIcon ? (
                                        <SubIcon className="h-4 w-4 shrink-0" />
                                      ) : null}

                                      <span className="flex-1 truncate">
                                        {subTitle}
                                      </span>

                                      {subItem.isNew ? (
                                        <SidebarMenuBadge>
                                          {isArabic ? "جديد" : "New"}
                                        </SidebarMenuBadge>
                                      ) : null}
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </Collapsible>
                    </SidebarMenuItem>
                  );
                }

                return (
                  <SidebarMenuItem key={item.title.en}>
                    <SidebarMenuButton
                      tooltip={itemTitle}
                      isActive={isItemActive(pathname, item)}
                      asChild
                    >
                      <Link
                        href={item.href}
                        target={item.newTab ? "_blank" : undefined}
                        className={`flex w-full items-center gap-2 ${
                          isArabic
                            ? "flex-row-reverse text-right"
                            : "flex-row text-left"
                        }`}
                      >
                        {Icon ? <Icon className="shrink-0" /> : null}

                        <span className="flex-1 truncate">{itemTitle}</span>
                      </Link>
                    </SidebarMenuButton>

                    {item.isNew ? (
                      <SidebarMenuBadge>
                        {isArabic ? "جديد" : "New"}
                      </SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}