"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

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
  type LucideIcon,
} from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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

type SidebarAuthSession = {
  role?: string | null;
  subscription?: {
    apps?: string[] | null;
  } | null;
};

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
      },
      {
        title: { ar: "المراكز", en: "Centers" },
        href: "/system/centers",
        icon: Building2,
        items: [
          {
            title: { ar: "لوحة المراكز", en: "Centers Overview" },
            href: "/system/centers",
            icon: Building2,
          },
          {
            title: { ar: "قائمة المراكز", en: "Centers List" },
            href: "/system/centers/list",
            icon: ListChecks,
          },
          {
            title: { ar: "إنشاء مركز", en: "Create Center" },
            href: "/system/centers/create",
            icon: Plus,
          },
          {
            title: { ar: "تقارير المراكز", en: "Centers Reports" },
            href: "/system/centers/reports",
            icon: BarChart3,
          },
        ],
      },
      {
        title: { ar: "العملاء", en: "Customers" },
        href: "/system/customers",
        icon: Users,
        items: [
          {
            title: { ar: "لوحة العملاء", en: "Customers Overview" },
            href: "/system/customers",
            icon: Users,
          },
          {
            title: { ar: "قائمة العملاء", en: "Customers List" },
            href: "/system/customers/list",
            icon: ListChecks,
          },
          {
            title: { ar: "إنشاء عميل", en: "Create Customer" },
            href: "/system/customers/create",
            icon: Plus,
          },
          {
            title: { ar: "تقارير العملاء", en: "Customers Reports" },
            href: "/system/customers/reports",
            icon: BarChart3,
          },
        ],
      },
      {
        title: { ar: "المندوبون", en: "Agents" },
        href: "/system/agents",
        icon: Briefcase,
        items: [
          {
            title: { ar: "لوحة المندوبين", en: "Agents Overview" },
            href: "/system/agents",
            icon: Briefcase,
          },
          {
            title: { ar: "قائمة المندوبين", en: "Agents List" },
            href: "/system/agents/list",
            icon: ListChecks,
          },
          {
            title: { ar: "إنشاء مندوب", en: "Create Agent" },
            href: "/system/agents/create",
            icon: Plus,
          },
          {
            title: { ar: "تقارير المندوبين", en: "Agents Reports" },
            href: "/system/agents/reports",
            icon: BarChart3,
          },
        ],
      },
      {
        title: { ar: "المنتجات", en: "Products" },
        href: "/system/products",
        icon: Boxes,
        items: [
          {
            title: { ar: "لوحة المنتجات", en: "Products Overview" },
            href: "/system/products",
            icon: Boxes,
          },
          {
            title: { ar: "قائمة المنتجات", en: "Products List" },
            href: "/system/products/list",
            icon: ListChecks,
          },
          {
            title: { ar: "إنشاء منتج", en: "Create Product" },
            href: "/system/products/create",
            icon: Plus,
          },
          {
            title: { ar: "تقارير المنتجات", en: "Products Reports" },
            href: "/system/products/reports",
            icon: BarChart3,
          },
        ],
      },
      {
        title: { ar: "الطلبات", en: "Orders" },
        href: "/system/orders",
        icon: ShoppingCart,
        items: [
          {
            title: { ar: "لوحة الطلبات", en: "Orders Overview" },
            href: "/system/orders",
            icon: ShoppingCart,
          },
          {
            title: { ar: "قائمة الطلبات", en: "Orders List" },
            href: "/system/orders/list",
            icon: ListChecks,
          },
          {
            title: { ar: "إنشاء طلب", en: "Create Order" },
            href: "/system/orders/create",
            icon: Plus,
          },
          {
            title: { ar: "تقارير الطلبات", en: "Orders Reports" },
            href: "/system/orders/reports",
            icon: BarChart3,
          },
        ],
      },
      {
        title: { ar: "مقدمو الخدمة", en: "Providers" },
        href: "/system/providers",
        icon: Stethoscope,
        items: [
          {
            title: { ar: "لوحة مقدمي الخدمة", en: "Providers Overview" },
            href: "/system/providers",
            icon: Stethoscope,
          },
          {
            title: { ar: "قائمة مقدمي الخدمة", en: "Providers List" },
            href: "/system/providers/list",
            icon: ListChecks,
          },
          {
            title: { ar: "إنشاء مقدم خدمة", en: "Create Provider" },
            href: "/system/providers/create",
            icon: Plus,
          },
          {
            title: { ar: "تقارير مقدمي الخدمة", en: "Providers Reports" },
            href: "/system/providers/reports",
            icon: BarChart3,
          },
        ],
      },
      {
        title: { ar: "العقود", en: "Contracts" },
        href: "/system/contracts",
        icon: FileText,
        items: [
          {
            title: { ar: "لوحة العقود", en: "Contracts Overview" },
            href: "/system/contracts",
            icon: FileText,
          },
          {
            title: { ar: "قائمة العقود", en: "Contracts List" },
            href: "/system/contracts/list",
            icon: ListChecks,
          },
          {
            title: { ar: "إنشاء عقد", en: "Create Contract" },
            href: "/system/contracts/create",
            icon: Plus,
          },
          {
            title: { ar: "تقارير العقود", en: "Contracts Reports" },
            href: "/system/contracts/reports",
            icon: BarChart3,
          },
        ],
      },
      {
        title: { ar: "الفواتير", en: "Invoices" },
        href: "/system/invoices",
        icon: ReceiptText,
        items: [
          {
            title: { ar: "لوحة الفواتير", en: "Invoices Overview" },
            href: "/system/invoices",
            icon: ReceiptText,
          },
          {
            title: { ar: "قائمة الفواتير", en: "Invoices List" },
            href: "/system/invoices/list",
            icon: ListChecks,
          },
          {
            title: { ar: "إنشاء فاتورة", en: "Create Invoice" },
            href: "/system/invoices/create",
            icon: Plus,
          },
          {
            title: { ar: "تقارير الفواتير", en: "Invoices Reports" },
            href: "/system/invoices/reports",
            icon: BarChart3,
          },
        ],
      },
      {
        title: { ar: "المدفوعات", en: "Payments" },
        href: "/system/payments",
        icon: CreditCard,
        items: [
          {
            title: { ar: "لوحة المدفوعات", en: "Payments Overview" },
            href: "/system/payments",
            icon: CreditCard,
          },
          {
            title: { ar: "قائمة المدفوعات", en: "Payments List" },
            href: "/system/payments/list",
            icon: ListChecks,
          },
          {
            title: { ar: "تسجيل دفعة", en: "Create Payment" },
            href: "/system/payments/create",
            icon: Plus,
          },
          {
            title: { ar: "تقارير المدفوعات", en: "Payments Reports" },
            href: "/system/payments/reports",
            icon: BarChart3,
          },
        ],
      },
      {
        title: { ar: "المحاسبة", en: "Accounting" },
        href: "/system/accounting",
        icon: BarChart3,
        items: [
          {
            title: { ar: "لوحة المحاسبة", en: "Accounting Overview" },
            href: "/system/accounting",
            icon: Calculator,
          },
          {
            title: { ar: "دليل الحسابات", en: "Chart of Accounts" },
            href: "/system/accounting/accounts",
            icon: Layers3,
          },
          {
            title: { ar: "القيود اليومية", en: "Journal Entries" },
            href: "/system/accounting/journals",
            icon: ReceiptText,
          },
          {
            title: { ar: "دفتر الأستاذ", en: "General Ledger" },
            href: "/system/accounting/ledger",
            icon: BookOpenCheck,
          },
          {
            title: { ar: "تقارير المحاسبة", en: "Accounting Reports" },
            href: "/system/accounting/reports",
            icon: BarChart3,
          },
          {
            title: { ar: "ميزان المراجعة", en: "Trial Balance" },
            href: "/system/accounting/trial-balance",
            icon: ListChecks,
          },
          {
            title: { ar: "الأرباح والخسائر", en: "Profit & Loss" },
            href: "/system/accounting/profit-loss",
            icon: PieChart,
          },
          {
            title: { ar: "المركز المالي", en: "Balance Sheet" },
            href: "/system/accounting/balance-sheet",
            icon: Landmark,
          },
        ],
      },
      {
        title: { ar: "الخزينة", en: "Treasury" },
        href: "/system/treasury",
        icon: Wallet,
        items: [
          {
            title: { ar: "لوحة الخزينة", en: "Treasury Overview" },
            href: "/system/treasury",
            icon: Wallet,
          },
          {
            title: { ar: "حسابات الخزينة", en: "Treasury Accounts" },
            href: "/system/treasury/accounts",
            icon: Wallet,
          },
          {
            title: { ar: "إنشاء حساب خزينة", en: "Create Treasury Account" },
            href: "/system/treasury/accounts/create",
            icon: Plus,
          },
          {
            title: { ar: "الصناديق النقدية", en: "Cashboxes" },
            href: "/system/treasury/cashboxes",
            icon: Banknote,
          },
          {
            title: { ar: "الحسابات البنكية", en: "Bank Accounts" },
            href: "/system/treasury/banks",
            icon: Building2,
          },
          {
            title: { ar: "الحركات المالية", en: "Transactions" },
            href: "/system/treasury/transactions",
            icon: CreditCard,
          },
          {
            title: { ar: "إضافة حركة مالية", en: "Create Transaction" },
            href: "/system/treasury/transactions/create",
            icon: Plus,
          },
          {
            title: { ar: "التحويلات", en: "Transfers" },
            href: "/system/treasury/transfers",
            icon: ArrowLeftRight,
          },
          {
            title: { ar: "تقارير الخزينة", en: "Treasury Reports" },
            href: "/system/treasury/reports",
            icon: BarChart3,
          },
          {
            title: { ar: "إعدادات الخزينة", en: "Treasury Settings" },
            href: "/system/treasury/settings",
            icon: Settings,
          },
        ],
      },
      {
        title: { ar: "واتساب", en: "WhatsApp" },
        href: "/system/whatsapp",
        icon: MessageCircle,
        items: [
          {
            title: { ar: "الرئيسية", en: "Overview" },
            href: "/system/whatsapp",
          },
          {
            title: { ar: "الإعدادات", en: "Settings" },
            href: "/system/whatsapp/settings",
          },
          {
            title: { ar: "السجل", en: "Logs" },
            href: "/system/whatsapp/logs",
          },
          {
            title: { ar: "القوالب", en: "Templates" },
            href: "/system/whatsapp/templates",
          },
          {
            title: { ar: "البث الجماعي", en: "Broadcasts" },
            href: "/system/whatsapp/broadcasts",
          },
        ],
      },
      {
        title: { ar: "مستخدمو النظام", en: "System Users" },
        href: "/system/users",
        icon: UserCog,
        items: [
          {
            title: { ar: "لوحة المستخدمين", en: "Users Overview" },
            href: "/system/users",
            icon: UserCog,
          },
          {
            title: { ar: "قائمة المستخدمين", en: "Users List" },
            href: "/system/users",
            icon: ListChecks,
          },
          {
            title: { ar: "إضافة مستخدم", en: "Create User" },
            href: "/system/users/create",
            icon: Plus,
          },
        ],
      },
      {
        title: { ar: "الإعدادات", en: "Settings" },
        href: "/system/settings",
        icon: Settings,
      },
    ],
  },
];

/* =====================================================
   CENTER NAV
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
      },
      {
        title: { ar: "العملاء", en: "Customers" },
        href: "/company/customers",
        aliases: ["/center/customers", "/provider/customers"],
        icon: Users,
      },
      {
        title: { ar: "الطلبات", en: "Orders" },
        href: "/company/orders",
        aliases: ["/center/orders", "/provider/orders"],
        icon: ShoppingCart,
      },
      {
        title: { ar: "المنتجات", en: "Products" },
        href: "/company/products",
        aliases: ["/center/products", "/provider/products"],
        icon: Boxes,
      },
      {
        title: { ar: "العقود", en: "Contracts" },
        href: "/company/contracts",
        aliases: ["/center/contracts", "/provider/contracts"],
        icon: FileText,
      },
      {
        title: { ar: "الفواتير", en: "Invoices" },
        href: "/company/invoices",
        aliases: ["/center/invoices", "/provider/invoices"],
        icon: ReceiptText,
        items: [
          {
            title: { ar: "لوحة الفواتير", en: "Invoices Overview" },
            href: "/company/invoices",
            aliases: ["/center/invoices", "/provider/invoices"],
            icon: ReceiptText,
          },
          {
            title: { ar: "قائمة الفواتير", en: "Invoices List" },
            href: "/company/invoices/list",
            aliases: ["/center/invoices/list", "/provider/invoices/list"],
            icon: ListChecks,
          },
          {
            title: { ar: "إنشاء فاتورة", en: "Create Invoice" },
            href: "/company/invoices/create",
            aliases: ["/center/invoices/create", "/provider/invoices/create"],
            icon: Plus,
          },
          {
            title: { ar: "تقارير الفواتير", en: "Invoices Reports" },
            href: "/company/invoices/reports",
            aliases: ["/center/invoices/reports", "/provider/invoices/reports"],
            icon: BarChart3,
          },
        ],
      },
      {
        title: { ar: "المدفوعات", en: "Payments" },
        href: "/company/payments",
        aliases: ["/center/payments", "/provider/payments"],
        icon: CreditCard,
        items: [
          {
            title: { ar: "لوحة المدفوعات", en: "Payments Overview" },
            href: "/company/payments",
            aliases: ["/center/payments", "/provider/payments"],
            icon: CreditCard,
          },
          {
            title: { ar: "قائمة المدفوعات", en: "Payments List" },
            href: "/company/payments/list",
            aliases: ["/center/payments/list", "/provider/payments/list"],
            icon: ListChecks,
          },
          {
            title: { ar: "تسجيل دفعة", en: "Create Payment" },
            href: "/company/payments/create",
            aliases: ["/center/payments/create", "/provider/payments/create"],
            icon: Plus,
          },
          {
            title: { ar: "تقارير المدفوعات", en: "Payments Reports" },
            href: "/company/payments/reports",
            aliases: ["/center/payments/reports", "/provider/payments/reports"],
            icon: BarChart3,
          },
        ],
      },
      {
        title: { ar: "المحاسبة", en: "Accounting" },
        href: "/company/accounting",
        aliases: ["/center/accounting", "/provider/accounting"],
        icon: BarChart3,
        roles: ["owner", "admin", "manager"],
        items: [
          {
            title: { ar: "لوحة المحاسبة", en: "Accounting Overview" },
            href: "/company/accounting",
            aliases: ["/center/accounting", "/provider/accounting"],
            icon: Calculator,
          },
          {
            title: { ar: "دليل الحسابات", en: "Chart of Accounts" },
            href: "/company/accounting/accounts",
            aliases: ["/center/accounting/accounts", "/provider/accounting/accounts"],
            icon: Layers3,
          },
          {
            title: { ar: "القيود اليومية", en: "Journal Entries" },
            href: "/company/accounting/journals",
            aliases: ["/center/accounting/journals", "/provider/accounting/journals"],
            icon: ReceiptText,
          },
          {
            title: { ar: "دفتر الأستاذ", en: "General Ledger" },
            href: "/company/accounting/ledger",
            aliases: ["/center/accounting/ledger", "/provider/accounting/ledger"],
            icon: BookOpenCheck,
          },
          {
            title: { ar: "تقارير المحاسبة", en: "Accounting Reports" },
            href: "/company/accounting/reports",
            aliases: ["/center/accounting/reports", "/provider/accounting/reports"],
            icon: BarChart3,
          },
          {
            title: { ar: "ميزان المراجعة", en: "Trial Balance" },
            href: "/company/accounting/trial-balance",
            aliases: [
              "/center/accounting/trial-balance",
              "/provider/accounting/trial-balance",
            ],
            icon: ListChecks,
          },
          {
            title: { ar: "الأرباح والخسائر", en: "Profit & Loss" },
            href: "/company/accounting/profit-loss",
            aliases: [
              "/center/accounting/profit-loss",
              "/provider/accounting/profit-loss",
            ],
            icon: PieChart,
          },
          {
            title: { ar: "المركز المالي", en: "Balance Sheet" },
            href: "/company/accounting/balance-sheet",
            aliases: [
              "/center/accounting/balance-sheet",
              "/provider/accounting/balance-sheet",
            ],
            icon: Landmark,
          },
        ],
      },
      {
        title: { ar: "الخزينة", en: "Treasury" },
        href: "/company/treasury",
        aliases: ["/center/treasury", "/provider/treasury"],
        icon: Wallet,
        roles: ["owner", "admin", "manager"],
        items: [
          {
            title: { ar: "لوحة الخزينة", en: "Treasury Overview" },
            href: "/company/treasury",
            aliases: ["/center/treasury", "/provider/treasury"],
            icon: Wallet,
          },
          {
            title: { ar: "حسابات الخزينة", en: "Treasury Accounts" },
            href: "/company/treasury/accounts",
            aliases: ["/center/treasury/accounts", "/provider/treasury/accounts"],
            icon: Wallet,
          },
          {
            title: { ar: "إنشاء حساب خزينة", en: "Create Treasury Account" },
            href: "/company/treasury/accounts/create",
            aliases: [
              "/center/treasury/accounts/create",
              "/provider/treasury/accounts/create",
            ],
            icon: Plus,
          },
          {
            title: { ar: "الصناديق النقدية", en: "Cashboxes" },
            href: "/company/treasury/cashboxes",
            aliases: ["/center/treasury/cashboxes", "/provider/treasury/cashboxes"],
            icon: Banknote,
          },
          {
            title: { ar: "الحسابات البنكية", en: "Bank Accounts" },
            href: "/company/treasury/banks",
            aliases: ["/center/treasury/banks", "/provider/treasury/banks"],
            icon: Building2,
          },
          {
            title: { ar: "الحركات المالية", en: "Transactions" },
            href: "/company/treasury/transactions",
            aliases: [
              "/center/treasury/transactions",
              "/provider/treasury/transactions",
            ],
            icon: CreditCard,
          },
          {
            title: { ar: "إضافة حركة مالية", en: "Create Transaction" },
            href: "/company/treasury/transactions/create",
            aliases: [
              "/center/treasury/transactions/create",
              "/provider/treasury/transactions/create",
            ],
            icon: Plus,
          },
          {
            title: { ar: "التحويلات", en: "Transfers" },
            href: "/company/treasury/transfers",
            aliases: ["/center/treasury/transfers", "/provider/treasury/transfers"],
            icon: ArrowLeftRight,
          },
          {
            title: { ar: "تقارير الخزينة", en: "Treasury Reports" },
            href: "/company/treasury/reports",
            aliases: ["/center/treasury/reports", "/provider/treasury/reports"],
            icon: BarChart3,
          },
          {
            title: { ar: "إعدادات الخزينة", en: "Treasury Settings" },
            href: "/company/treasury/settings",
            aliases: ["/center/treasury/settings", "/provider/treasury/settings"],
            icon: Settings,
          },
        ],
      },
      {
        title: { ar: "واتساب", en: "WhatsApp" },
        href: "/company/whatsapp",
        aliases: ["/center/whatsapp", "/provider/whatsapp"],
        icon: Send,
        roles: ["owner", "admin", "manager"],
        items: [
          {
            title: { ar: "الرئيسية", en: "Overview" },
            href: "/company/whatsapp",
            aliases: ["/center/whatsapp", "/provider/whatsapp"],
          },
          {
            title: { ar: "الإعدادات", en: "Settings" },
            href: "/company/whatsapp/settings",
            aliases: ["/center/whatsapp/settings", "/provider/whatsapp/settings"],
          },
          {
            title: { ar: "السجل", en: "Logs" },
            href: "/company/whatsapp/logs",
            aliases: ["/center/whatsapp/logs", "/provider/whatsapp/logs"],
          },
          {
            title: { ar: "القوالب", en: "Templates" },
            href: "/company/whatsapp/templates",
            aliases: ["/center/whatsapp/templates", "/provider/whatsapp/templates"],
          },
        ],
      },
      {
        title: { ar: "المستخدمون", en: "Users" },
        href: "/company/users",
        aliases: ["/center/users", "/provider/users"],
        icon: UserCog,
        roles: ["owner", "admin"],
      },
      {
        title: { ar: "الإعدادات", en: "Settings" },
        href: "/company/settings",
        aliases: ["/center/settings", "/provider/settings"],
        icon: Settings,
        roles: ["owner", "admin"],
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
      },
      {
        title: { ar: "طلباتي", en: "My Orders" },
        href: "/customer/orders",
        icon: ShoppingCart,
      },
      {
        title: { ar: "فواتيري", en: "My Invoices" },
        href: "/customer/invoices",
        icon: ReceiptText,
      },
      {
        title: { ar: "مدفوعاتي", en: "My Payments" },
        href: "/customer/payments",
        icon: CreditCard,
      },
      {
        title: { ar: "الباقات والخدمات", en: "Plans & Services" },
        href: "/customer/products",
        icon: Package,
      },
      {
        title: { ar: "الدعم والمحادثات", en: "Support & Chats" },
        href: "/customer/support",
        icon: MessageCircle,
      },
      {
        title: { ar: "حسابي", en: "My Account" },
        href: "/customer/account",
        icon: ShieldCheck,
      },
      {
        title: { ar: "الإعدادات", en: "Settings" },
        href: "/customer/settings",
        icon: Settings,
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
      },
      {
        title: { ar: "عملائي", en: "My Customers" },
        href: "/agent/customers",
        icon: Users,
      },
      {
        title: { ar: "طلباتي", en: "My Orders" },
        href: "/agent/orders",
        icon: ShoppingCart,
      },
      {
        title: { ar: "عمولاتي", en: "My Commissions" },
        href: "/agent/commissions",
        icon: Wallet,
      },
      {
        title: { ar: "مدفوعاتي", en: "My Payments" },
        href: "/agent/payments",
        icon: CreditCard,
      },
      {
        title: { ar: "تقاريري", en: "My Reports" },
        href: "/agent/reports",
        icon: BarChart3,
      },
      {
        title: { ar: "حسابي", en: "My Account" },
        href: "/agent/account",
        icon: ShieldCheck,
      },
      {
        title: { ar: "الإعدادات", en: "Settings" },
        href: "/agent/settings",
        icon: Settings,
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

function hasRequiredRole(
  itemRoles: string[] | undefined,
  currentRole: string,
): boolean {
  if (!itemRoles || itemRoles.length === 0) return true;
  if (!currentRole) return false;

  return itemRoles.includes(currentRole);
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

function filterNavItems(
  items: NavItem[],
  currentRole: string,
  enabledApps: string[],
): NavItem[] {
  return items
    .filter((item) => {
      const roleAllowed = hasRequiredRole(item.roles, currentRole);
      const appAllowed = hasRequiredApps(item.apps, enabledApps);

      return roleAllowed && appAllowed;
    })
    .map((item) => ({
      ...item,
      items: item.items
        ? filterNavItems(item.items, currentRole, enabledApps)
        : undefined,
    }));
}

function filterNavGroups(
  groups: NavGroup[],
  currentRole: string,
  enabledApps: string[],
): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: filterNavItems(group.items, currentRole, enabledApps),
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
  const authSession = useAuth() as SidebarAuthSession | null;

  const [locale, setLocale] = useState<AppLocale>("ar");

  const currentRole = String(authSession?.role || "").toLowerCase();
  const enabledApps = Array.isArray(authSession?.subscription?.apps)
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
      return systemNavItems;
    }

    if (type === "customer") {
      return customerNavItems;
    }

    if (type === "agent") {
      return agentNavItems;
    }

    return filterNavGroups(centerNavItems, currentRole, enabledApps);
  }, [type, currentRole, enabledApps]);

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