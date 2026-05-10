"use client";

/* ============================================================
   📂 app/system/treasury/reports/page.tsx
   🧠 Primey Care | Treasury Reports Page

   ✅ المسار:
      app/system/treasury/reports/page.tsx

   ✅ العمل:
      صفحة تقارير الخزينة داخل النظام.
      تعرض ملخص الخزينة، أرصدة الحسابات، الصناديق، البنوك، الحركات، التحويلات، وحالة الترحيل.

   ✅ الإصدار:
      Phase 17 UX Refinement + Treasury Reports Build

   ✅ يعتمد على:
      - /api/treasury/reports/summary/
      - /api/treasury/accounts/
      - /api/treasury/transactions/
      - primey-locale
      - AuthProvider
      - sonner
      - /currency/sar.svg

   ✅ متوافق مع:
      - Treasury overview page
      - Treasury accounts pages
      - Treasury transactions pages
      - Treasury transfers page
      - Central reports module
      - Centers / Customers approved UX standard

   ✅ الوظائف:
      - تقرير ملخص الخزينة.
      - تقرير أرصدة الحسابات.
      - تقرير الصناديق والبنوك.
      - تقرير الحركات المالية.
      - تقرير التحويلات.
      - حالة ترحيل الخزينة والمحاسبة.
      - البحث في صف مستقل.
      - الفلاتر والأعمدة في صف مستقل.
      - فلترة حسب نوع الحساب ونوع الحركة وحالة الحركة.
      - Excel export بصيغة .xls HTML Workbook.
      - Web PDF Print.
      - Error State مستقل.
      - Empty State ذكي.
      - Skeleton Loading.
      - صلاحيات آمنة بدون كسر system_admin/superuser.
      - أرقام إنجليزية دائمًا.
      - رمز SAR من /currency/sar.svg بعد الرقم.
      - استخدام sonner للتنبيهات.

   ------------------------------------------------------------
   تحسينات هذا الإصدار:
      - الملف المرفق كان شبه فارغ، وتم بناء صفحة التقارير كاملة من الصفر.
      - الالتزام بالقاعدة: w-full space-y-4 بدون main/min-h-screen/max-w.
      - عدم عرض أي مسارات أو عبارات تقنية داخل واجهة المستخدم.
      - إخفاء الأزرار غير المصرح بها بدل تعطيلها.
      - استخدام Excel HTML Workbook بدل CSV أو XLSX.
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Banknote,
  Building2,
  Columns3,
  CreditCard,
  Download,
  Eye,
  Filter,
  Landmark,
  Loader2,
  Printer,
  Receipt,
  RefreshCcw,
  Search,
  ShieldCheck,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ============================================================
   Types
============================================================ */

type AppLocale = "ar" | "en";
type Dict = Record<string, unknown>;

type AccountType = "CASHBOX" | "BANK" | "WALLET" | "OTHER";
type AccountStatus = "ACTIVE" | "INACTIVE" | "CLOSED" | "UNKNOWN";

type TransactionType =
  | "RECEIPT"
  | "PAYMENT"
  | "TRANSFER"
  | "ADJUSTMENT"
  | "UNKNOWN";

type TransactionStatus = "DRAFT" | "CONFIRMED" | "CANCELLED" | "UNKNOWN";

type AccountTypeFilter = "ALL" | AccountType;
type TransactionTypeFilter = "ALL" | TransactionType;
type TransactionStatusFilter = "ALL" | TransactionStatus;

type TreasuryAccountRow = {
  id: string;
  code: string;
  name: string;
  account_type: AccountType;
  status: AccountStatus;
  current_balance: number;
  opening_balance: number;
  bank_name: string;
  account_number: string;
  iban: string;
  is_default: boolean;
};

type TreasuryTransactionRow = {
  id: string;
  transaction_number: string;
  transaction_type: TransactionType;
  status: TransactionStatus;
  amount: number;
  transaction_date: string;
  account_id: string;
  account_name: string;
  account_code: string;
  source_reference: string;
  description: string;
  is_treasury_posted: boolean;
  is_accounting_posted: boolean;
};

type TreasuryReportsSummary = {
  total_accounts: number;
  active_accounts: number;
  cashbox_accounts: number;
  bank_accounts: number;
  total_balance: number;
  opening_balance_total: number;

  total_transactions: number;
  confirmed_transactions: number;
  draft_transactions: number;
  cancelled_transactions: number;

  receipts_count: number;
  payments_count: number;
  transfers_count: number;

  receipts_total: number;
  payments_total: number;
  transfers_total: number;
  net_total: number;

  treasury_posted_count: number;
  accounting_posted_count: number;
  unposted_count: number;
};

type ApiEnvelope<T> = {
  ok?: boolean;
  success?: boolean;
  message?: string;
  detail?: string;
  error?: string;
  data?: T;
  results?: unknown[];
  items?: unknown[];
  rows?: unknown[];
  accounts?: unknown[];
  transactions?: unknown[];
  summary?: Partial<TreasuryReportsSummary>;
};

type VisibleColumns = {
  code: boolean;
  account: boolean;
  type: boolean;
  status: boolean;
  balance: boolean;
  openingBalance: boolean;
  defaultAccount: boolean;
  bankInfo: boolean;
  actions: boolean;
};

const SAR_ICON_PATH = "/currency/sar.svg";
const PAGE_SIZE = 14;

const DEFAULT_COLUMNS: VisibleColumns = {
  code: true,
  account: true,
  type: true,
  status: true,
  balance: true,
  openingBalance: true,
  defaultAccount: true,
  bankInfo: true,
  actions: true,
};

const DEFAULT_SUMMARY: TreasuryReportsSummary = {
  total_accounts: 0,
  active_accounts: 0,
  cashbox_accounts: 0,
  bank_accounts: 0,
  total_balance: 0,
  opening_balance_total: 0,

  total_transactions: 0,
  confirmed_transactions: 0,
  draft_transactions: 0,
  cancelled_transactions: 0,

  receipts_count: 0,
  payments_count: 0,
  transfers_count: 0,

  receipts_total: 0,
  payments_total: 0,
  transfers_total: 0,
  net_total: 0,

  treasury_posted_count: 0,
  accounting_posted_count: 0,
  unposted_count: 0,
};

/* ============================================================
   Locale / API
============================================================ */

function readLocale(): AppLocale {
  try {
    if (typeof window === "undefined") return "ar";

    const saved =
      window.localStorage.getItem("primey-locale") ||
      window.localStorage.getItem("locale") ||
      window.localStorage.getItem("lang");

    if (saved === "en") return "en";
    if (saved === "ar") return "ar";

    return document.documentElement.lang === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

function applyDocumentLocale(locale: AppLocale) {
  try {
    if (typeof document === "undefined") return;

    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.body.dir = locale === "ar" ? "rtl" : "ltr";
  } catch (error) {
    console.error("Apply locale error:", error);
  }
}

function apiUrl(path: string) {
  const base =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "";

  if (!base) return path;

  return `${base.replace(/\/$/, "")}${path}`;
}

/* ============================================================
   Auth / Permissions
============================================================ */

function asDict(value: unknown): Dict {
  return value && typeof value === "object" ? (value as Dict) : {};
}

function getNested(source: Dict, keys: string[]) {
  for (const key of keys) {
    const value = source[key];

    if (value && typeof value === "object") return value as Dict;
  }

  return {};
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .flatMap((value) => {
          if (!value) return [];

          if (typeof value === "string") return [value];

          if (Array.isArray(value)) {
            return value.flatMap((item) => {
              if (typeof item === "string") return [item];

              if (item && typeof item === "object") {
                const obj = item as Dict;

                return [
                  obj.code,
                  obj.codename,
                  obj.permission,
                  obj.name,
                  obj.role,
                ].filter(Boolean) as string[];
              }

              return [];
            });
          }

          if (value && typeof value === "object") {
            const obj = value as Dict;

            return [
              obj.code,
              obj.codename,
              obj.permission,
              obj.name,
              obj.role,
            ].filter(Boolean) as string[];
          }

          return [];
        })
        .map((item) => String(item).trim())
        .filter(Boolean),
    ),
  );
}

function getAuthUser(authValue: unknown) {
  const auth = asDict(authValue);

  return getNested(auth, [
    "user",
    "currentUser",
    "profile",
    "account",
    "session",
    "data",
  ]);
}

function getAuthRoles(authValue: unknown): string[] {
  const auth = asDict(authValue);
  const user = getAuthUser(authValue);

  return uniqueStrings([
    auth.role,
    auth.roles,
    auth.user_role,
    auth.userType,
    auth.user_type,
    auth.workspace,
    auth.workspaces,
    auth.type,
    user.role,
    user.roles,
    user.user_role,
    user.userType,
    user.user_type,
    user.workspace,
    user.workspaces,
    user.type,
  ]).map((item) => item.toLowerCase());
}

function getAuthPermissionCodes(authValue: unknown): string[] {
  const auth = asDict(authValue);
  const user = getAuthUser(authValue);

  const authPermissions = asDict(auth.permissions);
  const userPermissions = asDict(user.permissions);
  const authProfilePermissions = asDict(auth.profile_permissions);
  const userProfilePermissions = asDict(user.profile_permissions);

  return uniqueStrings([
    auth.permission_codes,
    auth.permissions,
    auth.codes,
    auth.profile_permissions,
    authPermissions.codes,
    authProfilePermissions.codes,
    user.permission_codes,
    user.permissions,
    user.codes,
    user.profile_permissions,
    userPermissions.codes,
    userProfilePermissions.codes,
  ]);
}

function isAuthResolving(authValue: unknown) {
  const auth = asDict(authValue);

  return Boolean(
    auth.isLoading ||
      auth.loading ||
      auth.isInitializing ||
      auth.initializing ||
      auth.pending,
  );
}

function isSystemAdmin(authValue: unknown) {
  const auth = asDict(authValue);
  const user = getAuthUser(authValue);
  const roles = getAuthRoles(authValue);

  return (
    Boolean(auth.is_superuser) ||
    Boolean(auth.isSuperuser) ||
    Boolean(auth.is_system_admin) ||
    Boolean(auth.isSystemAdmin) ||
    Boolean(user.is_superuser) ||
    Boolean(user.isSuperuser) ||
    Boolean(user.is_system_admin) ||
    Boolean(user.isSystemAdmin) ||
    roles.some((role) =>
      [
        "system_admin",
        "superuser",
        "super_admin",
        "superadmin",
        "admin",
        "administrator",
      ].includes(role),
    )
  );
}

function hasSafePermission(
  authValue: unknown,
  codes: string[],
  mode: "view" | "action",
) {
  if (isSystemAdmin(authValue)) return true;

  const permissions = getAuthPermissionCodes(authValue);

  if (permissions.length > 0) {
    return codes.some((code) => permissions.includes(code));
  }

  const roles = getAuthRoles(authValue);

  if (roles.length > 0) {
    if (mode === "view") {
      return roles.some((role) =>
        [
          "system_admin",
          "superuser",
          "super_admin",
          "accountant",
          "support",
          "viewer",
        ].includes(role),
      );
    }

    return roles.some((role) =>
      ["system_admin", "superuser", "super_admin", "accountant"].includes(role),
    );
  }

  return true;
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "تقارير الخزينة" : "Treasury Reports",
    subtitle: isArabic
      ? "تحليل أرصدة الخزينة والصناديق والبنوك والحركات والتحويلات وحالة الترحيل."
      : "Analyze treasury balances, cashboxes, banks, transactions, transfers, and posting status.",

    back: isArabic ? "الخزينة" : "Treasury",
    accounts: isArabic ? "حسابات الخزينة" : "Treasury Accounts",
    transactions: isArabic ? "الحركات المالية" : "Transactions",
    transfers: isArabic ? "التحويلات" : "Transfers",
    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",

    summaryTitle: isArabic ? "ملخص الخزينة" : "Treasury Summary",
    summaryDesc: isArabic
      ? "مؤشرات مالية وتشغيلية مختصرة عن الخزينة."
      : "Short financial and operational treasury indicators.",

    accountsTitle: isArabic ? "أرصدة الحسابات" : "Account Balances",
    accountsDesc: isArabic
      ? "أرصدة الصناديق والبنوك وحسابات الخزينة."
      : "Balances for cashboxes, banks, and treasury accounts.",

    movementsTitle: isArabic ? "ملخص الحركات" : "Movements Summary",
    movementsDesc: isArabic
      ? "سندات القبض والصرف والتحويلات وحالة الترحيل."
      : "Receipts, payments, transfers, and posting status.",

    totalAccounts: isArabic ? "إجمالي الحسابات" : "Total Accounts",
    activeAccounts: isArabic ? "حسابات نشطة" : "Active Accounts",
    cashboxes: isArabic ? "الصناديق" : "Cashboxes",
    banks: isArabic ? "البنوك" : "Banks",
    totalBalance: isArabic ? "إجمالي الرصيد" : "Total Balance",
    openingBalanceTotal: isArabic
      ? "إجمالي الرصيد الافتتاحي"
      : "Opening Balance Total",

    totalTransactions: isArabic ? "إجمالي الحركات" : "Total Transactions",
    confirmedTransactions: isArabic ? "حركات مؤكدة" : "Confirmed Transactions",
    draftTransactions: isArabic ? "مسودات" : "Drafts",
    cancelledTransactions: isArabic ? "ملغاة" : "Cancelled",

    receipts: isArabic ? "سندات قبض" : "Receipts",
    payments: isArabic ? "سندات صرف" : "Payments",
    transfersCount: isArabic ? "تحويلات" : "Transfers",
    receiptsTotal: isArabic ? "إجمالي القبض" : "Total Receipts",
    paymentsTotal: isArabic ? "إجمالي الصرف" : "Total Payments",
    transfersTotal: isArabic ? "إجمالي التحويلات" : "Total Transfers",
    netTotal: isArabic ? "الصافي" : "Net Total",

    treasuryPosted: isArabic ? "مرحّل خزينة" : "Treasury Posted",
    accountingPosted: isArabic ? "مرحّل محاسبيًا" : "Accounting Posted",
    unposted: isArabic ? "غير مرحّل" : "Unposted",

    searchPlaceholder: isArabic
      ? "ابحث باسم الحساب أو الكود أو البنك أو رقم الحساب..."
      : "Search by account name, code, bank, or account number...",

    filters: isArabic ? "الفلاتر" : "Filters",
    columns: isArabic ? "الأعمدة" : "Columns",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",

    allAccountTypes: isArabic ? "كل أنواع الحسابات" : "All Account Types",
    allTransactionTypes: isArabic ? "كل أنواع الحركات" : "All Transaction Types",
    allStatuses: isArabic ? "كل الحالات" : "All Statuses",

    cashbox: isArabic ? "صندوق" : "Cashbox",
    bank: isArabic ? "بنك" : "Bank",
    wallet: isArabic ? "محفظة" : "Wallet",
    other: isArabic ? "أخرى" : "Other",

    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
    closed: isArabic ? "مغلق" : "Closed",
    unknown: isArabic ? "غير محدد" : "Unknown",

    receipt: isArabic ? "قبض" : "Receipt",
    payment: isArabic ? "صرف" : "Payment",
    transfer: isArabic ? "تحويل" : "Transfer",
    adjustment: isArabic ? "تسوية" : "Adjustment",

    draft: isArabic ? "مسودة" : "Draft",
    confirmed: isArabic ? "مؤكد" : "Confirmed",
    cancelled: isArabic ? "ملغي" : "Cancelled",

    defaultAccount: isArabic ? "افتراضي" : "Default",
    regularAccount: isArabic ? "عادي" : "Regular",

    posted: isArabic ? "مرحّل" : "Posted",
    notPosted: isArabic ? "غير مرحّل" : "Not Posted",

    table: {
      code: isArabic ? "الكود" : "Code",
      account: isArabic ? "الحساب" : "Account",
      type: isArabic ? "النوع" : "Type",
      status: isArabic ? "الحالة" : "Status",
      balance: isArabic ? "الرصيد" : "Balance",
      openingBalance: isArabic ? "الرصيد الافتتاحي" : "Opening Balance",
      defaultAccount: isArabic ? "الافتراضي" : "Default",
      bankInfo: isArabic ? "بيانات البنك" : "Bank Info",
      action: isArabic ? "الإجراء" : "Action",
    },

    view: isArabic ? "عرض" : "View",

    emptyTitle: isArabic ? "لا توجد حسابات خزينة" : "No treasury accounts",
    emptyText: isArabic
      ? "ستظهر أرصدة حسابات الخزينة هنا بعد إنشائها."
      : "Treasury account balances will appear here after they are created.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير البحث أو الفلاتر."
      : "Try changing the search or filters.",

    accessDeniedTitle: isArabic
      ? "غير مصرح بعرض تقارير الخزينة"
      : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض تقارير الخزينة. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view treasury reports. Contact your system administrator if you need access.",

    loadError: isArabic
      ? "تعذر تحميل تقارير الخزينة."
      : "Unable to load treasury reports.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    loadSuccess: isArabic
      ? "تم تحديث تقارير الخزينة بنجاح."
      : "Treasury reports refreshed successfully.",

    exportSuccess: isArabic
      ? "تم تجهيز ملف Excel بنجاح."
      : "Excel file prepared successfully.",
    exportEmpty: isArabic
      ? "لا توجد بيانات قابلة للتصدير."
      : "No data available to export.",
    printSuccess: isArabic
      ? "تم تجهيز نافذة الطباعة."
      : "Print window prepared.",
    printError: isArabic
      ? "تعذر فتح نافذة الطباعة."
      : "Unable to open print window.",

    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",
    showing: isArabic ? "عرض" : "Showing",
    from: isArabic ? "من" : "of",
    generatedAt: isArabic ? "تاريخ التصدير" : "Generated At",
    printedAt: isArabic ? "تاريخ الطباعة" : "Printed At",
    rowsCount: isArabic ? "عدد السجلات" : "Rows Count",
  };
}

/* ============================================================
   Helpers
============================================================ */

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: unknown): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatMoney(value: unknown): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function escapeHtml(value: string | number) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getNestedValue(obj: Dict, keys: string[]): unknown {
  for (const key of keys) {
    const value = obj[key];

    if (value !== undefined && value !== null && value !== "") return value;
  }

  for (const container of [
    "account",
    "treasury_account",
    "cashbox",
    "bank",
    "transaction",
    "treasury_transaction",
    "item",
    "data",
  ]) {
    const nested = obj[container];

    if (nested && typeof nested === "object") {
      const value = getNestedValue(nested as Dict, keys);

      if (value !== undefined && value !== null && value !== "") return value;
    }
  }

  return undefined;
}

function extractRows(payload: ApiEnvelope<unknown> | null, key: string): unknown[] {
  if (!payload) return [];

  const data = asDict(payload.data);
  const directValue = (payload as Dict)[key];

  if (Array.isArray(directValue)) return directValue;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.rows)) return payload.rows;

  if (Array.isArray(data[key])) return data[key] as unknown[];
  if (Array.isArray(data.results)) return data.results as unknown[];
  if (Array.isArray(data.items)) return data.items as unknown[];
  if (Array.isArray(data.rows)) return data.rows as unknown[];

  if (Array.isArray(payload.data)) return payload.data;

  return [];
}

function extractSummary(payload: ApiEnvelope<unknown> | null) {
  if (!payload) return {};

  const data = asDict(payload.data);

  return {
    ...asDict(payload.summary),
    ...asDict(data.summary),
    ...asDict(data.totals),
    ...asDict(data),
  } as Partial<TreasuryReportsSummary>;
}

function normalizeAccountType(value: unknown): AccountType {
  const clean = String(value || "").toUpperCase();

  if (["CASHBOX", "CASH", "BOX"].includes(clean)) return "CASHBOX";
  if (["BANK", "BANK_ACCOUNT"].includes(clean)) return "BANK";
  if (["WALLET", "E_WALLET"].includes(clean)) return "WALLET";

  return "OTHER";
}

function normalizeAccountStatus(value: unknown): AccountStatus {
  const clean = String(value || "").toUpperCase();

  if (["ACTIVE", "OPEN", "ENABLED", "TRUE"].includes(clean)) return "ACTIVE";
  if (["INACTIVE", "DISABLED", "FALSE"].includes(clean)) return "INACTIVE";
  if (["CLOSED", "LOCKED"].includes(clean)) return "CLOSED";

  if (typeof value === "boolean") return value ? "ACTIVE" : "INACTIVE";

  return "UNKNOWN";
}

function normalizeTransactionType(value: unknown): TransactionType {
  const clean = String(value || "").toUpperCase();

  if (["RECEIPT", "INCOME", "RECEIVE", "CASH_IN"].includes(clean)) return "RECEIPT";
  if (["PAYMENT", "EXPENSE", "PAY", "CASH_OUT"].includes(clean)) return "PAYMENT";
  if (["TRANSFER", "INTERNAL_TRANSFER"].includes(clean)) return "TRANSFER";
  if (["ADJUSTMENT", "OPENING_BALANCE"].includes(clean)) return "ADJUSTMENT";

  return "UNKNOWN";
}

function normalizeTransactionStatus(value: unknown): TransactionStatus {
  const clean = String(value || "").toUpperCase();

  if (["DRAFT", "PENDING"].includes(clean)) return "DRAFT";
  if (["CONFIRMED", "POSTED", "APPROVED", "TRUE"].includes(clean)) {
    return "CONFIRMED";
  }
  if (["CANCELLED", "CANCELED", "VOID"].includes(clean)) return "CANCELLED";

  if (typeof value === "boolean") return value ? "CONFIRMED" : "DRAFT";

  return "UNKNOWN";
}

function normalizeAccount(item: unknown): TreasuryAccountRow {
  const obj = asDict(item);

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || ""),
    code: String(getNestedValue(obj, ["code", "account_code", "number"]) || "-"),
    name: String(getNestedValue(obj, ["name", "title", "label"]) || "-"),
    account_type: normalizeAccountType(
      getNestedValue(obj, ["account_type", "type", "kind"]),
    ),
    status: normalizeAccountStatus(
      getNestedValue(obj, ["status", "state", "is_active"]),
    ),
    current_balance: toNumber(
      getNestedValue(obj, ["current_balance", "balance", "available_balance"]),
    ),
    opening_balance: toNumber(
      getNestedValue(obj, ["opening_balance", "initial_balance"]),
    ),
    bank_name: String(getNestedValue(obj, ["bank_name", "bank"]) || ""),
    account_number: String(
      getNestedValue(obj, ["account_number", "bank_account_number"]) || "",
    ),
    iban: String(getNestedValue(obj, ["iban", "IBAN"]) || ""),
    is_default: Boolean(getNestedValue(obj, ["is_default", "default"])),
  };
}

function normalizeTransaction(item: unknown, index: number): TreasuryTransactionRow {
  const obj = asDict(item);
  const accountObj = asDict(obj.account || obj.treasury_account);

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || `${index}`),
    transaction_number: String(
      getNestedValue(obj, [
        "transaction_number",
        "voucher_number",
        "number",
        "code",
        "reference",
      ]) || "-",
    ),
    transaction_type: normalizeTransactionType(
      getNestedValue(obj, ["transaction_type", "type", "kind", "voucher_type"]),
    ),
    status: normalizeTransactionStatus(
      getNestedValue(obj, ["status", "state", "is_confirmed"]),
    ),
    amount: toNumber(getNestedValue(obj, ["amount", "total_amount", "value"])),
    transaction_date: String(
      getNestedValue(obj, ["transaction_date", "date", "created_at"]) || "",
    ),
    account_id: String(
      getNestedValue(obj, ["account_id", "treasury_account_id"]) ||
        accountObj.id ||
        "",
    ),
    account_name: String(
      accountObj.name ||
        accountObj.title ||
        getNestedValue(obj, ["account_name", "treasury_account_name"]) ||
        "",
    ),
    account_code: String(
      accountObj.code ||
        accountObj.account_code ||
        getNestedValue(obj, ["account_code", "treasury_account_code"]) ||
        "",
    ),
    source_reference: String(
      getNestedValue(obj, [
        "source_reference",
        "external_reference",
        "payment_reference",
        "ref",
      ]) || "",
    ),
    description: String(getNestedValue(obj, ["description", "notes", "memo"]) || ""),
    is_treasury_posted: Boolean(
      getNestedValue(obj, ["is_treasury_posted", "treasury_posted"]),
    ),
    is_accounting_posted: Boolean(
      getNestedValue(obj, ["is_accounting_posted", "accounting_posted"]),
    ),
  };
}

function buildSummary(
  accounts: TreasuryAccountRow[],
  transactions: TreasuryTransactionRow[],
  apiSummary?: Partial<TreasuryReportsSummary>,
): TreasuryReportsSummary {
  const receipts = transactions.filter((item) => item.transaction_type === "RECEIPT");
  const payments = transactions.filter((item) => item.transaction_type === "PAYMENT");
  const transfers = transactions.filter(
    (item) => item.transaction_type === "TRANSFER",
  );

  const receiptsTotal = receipts.reduce((sum, item) => sum + item.amount, 0);
  const paymentsTotal = payments.reduce((sum, item) => sum + item.amount, 0);
  const transfersTotal = transfers.reduce((sum, item) => sum + item.amount, 0);

  const fallback: TreasuryReportsSummary = {
    total_accounts: accounts.length,
    active_accounts: accounts.filter((item) => item.status === "ACTIVE").length,
    cashbox_accounts: accounts.filter((item) => item.account_type === "CASHBOX")
      .length,
    bank_accounts: accounts.filter((item) => item.account_type === "BANK").length,
    total_balance: accounts.reduce((sum, item) => sum + item.current_balance, 0),
    opening_balance_total: accounts.reduce(
      (sum, item) => sum + item.opening_balance,
      0,
    ),

    total_transactions: transactions.length,
    confirmed_transactions: transactions.filter(
      (item) => item.status === "CONFIRMED",
    ).length,
    draft_transactions: transactions.filter((item) => item.status === "DRAFT")
      .length,
    cancelled_transactions: transactions.filter(
      (item) => item.status === "CANCELLED",
    ).length,

    receipts_count: receipts.length,
    payments_count: payments.length,
    transfers_count: transfers.length,

    receipts_total: receiptsTotal,
    payments_total: paymentsTotal,
    transfers_total: transfersTotal,
    net_total: receiptsTotal - paymentsTotal,

    treasury_posted_count: transactions.filter((item) => item.is_treasury_posted)
      .length,
    accounting_posted_count: transactions.filter(
      (item) => item.is_accounting_posted,
    ).length,
    unposted_count: transactions.filter(
      (item) => !item.is_treasury_posted || !item.is_accounting_posted,
    ).length,
  };

  const api = apiSummary as Dict;

  return {
    total_accounts:
      toNumber(apiSummary?.total_accounts) ||
      toNumber(api.accounts_count) ||
      fallback.total_accounts,
    active_accounts:
      toNumber(apiSummary?.active_accounts) || fallback.active_accounts,
    cashbox_accounts:
      toNumber(apiSummary?.cashbox_accounts) ||
      toNumber(api.cashboxes_count) ||
      fallback.cashbox_accounts,
    bank_accounts:
      toNumber(apiSummary?.bank_accounts) ||
      toNumber(api.banks_count) ||
      fallback.bank_accounts,
    total_balance:
      toNumber(apiSummary?.total_balance) ||
      toNumber(api.current_balance_total) ||
      fallback.total_balance,
    opening_balance_total:
      toNumber(apiSummary?.opening_balance_total) ||
      fallback.opening_balance_total,

    total_transactions:
      toNumber(apiSummary?.total_transactions) ||
      toNumber(api.transactions_count) ||
      fallback.total_transactions,
    confirmed_transactions:
      toNumber(apiSummary?.confirmed_transactions) ||
      fallback.confirmed_transactions,
    draft_transactions:
      toNumber(apiSummary?.draft_transactions) || fallback.draft_transactions,
    cancelled_transactions:
      toNumber(apiSummary?.cancelled_transactions) ||
      fallback.cancelled_transactions,

    receipts_count:
      toNumber(apiSummary?.receipts_count) || fallback.receipts_count,
    payments_count:
      toNumber(apiSummary?.payments_count) || fallback.payments_count,
    transfers_count:
      toNumber(apiSummary?.transfers_count) || fallback.transfers_count,

    receipts_total:
      toNumber(apiSummary?.receipts_total) ||
      toNumber(api.receipt_total) ||
      fallback.receipts_total,
    payments_total:
      toNumber(apiSummary?.payments_total) ||
      toNumber(api.payment_total) ||
      fallback.payments_total,
    transfers_total:
      toNumber(apiSummary?.transfers_total) ||
      toNumber(api.transfer_total) ||
      fallback.transfers_total,
    net_total: toNumber(apiSummary?.net_total) || fallback.net_total,

    treasury_posted_count:
      toNumber(apiSummary?.treasury_posted_count) ||
      fallback.treasury_posted_count,
    accounting_posted_count:
      toNumber(apiSummary?.accounting_posted_count) ||
      fallback.accounting_posted_count,
    unposted_count: toNumber(apiSummary?.unposted_count) || fallback.unposted_count,
  };
}

function accountTypeLabel(type: AccountType, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<AccountType, string> = {
    CASHBOX: t.cashbox,
    BANK: t.bank,
    WALLET: t.wallet,
    OTHER: t.other,
  };

  return labels[type];
}

function accountStatusLabel(status: AccountStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<AccountStatus, string> = {
    ACTIVE: t.active,
    INACTIVE: t.inactive,
    CLOSED: t.closed,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function transactionTypeLabel(type: TransactionType, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<TransactionType, string> = {
    RECEIPT: t.receipt,
    PAYMENT: t.payment,
    TRANSFER: t.transfer,
    ADJUSTMENT: t.adjustment,
    UNKNOWN: t.unknown,
  };

  return labels[type];
}

function transactionStatusLabel(status: TransactionStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<TransactionStatus, string> = {
    DRAFT: t.draft,
    CONFIRMED: t.confirmed,
    CANCELLED: t.cancelled,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function accountTypeBadge(type: AccountType, locale: AppLocale) {
  const label = accountTypeLabel(type, locale);

  if (type === "CASHBOX") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (type === "BANK") {
    return (
      <Badge className="rounded-full border-sky-200 bg-sky-50 px-3 py-1 text-sky-700 hover:bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-300">
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="rounded-full px-3 py-1">
      {label}
    </Badge>
  );
}

function accountStatusBadge(status: AccountStatus, locale: AppLocale) {
  const label = accountStatusLabel(status, locale);

  if (status === "ACTIVE") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (status === "INACTIVE") {
    return (
      <Badge className="rounded-full border-amber-200 bg-amber-50 px-3 py-1 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
        {label}
      </Badge>
    );
  }

  if (status === "CLOSED") {
    return (
      <Badge variant="secondary" className="rounded-full px-3 py-1">
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="rounded-full px-3 py-1">
      {label}
    </Badge>
  );
}

function isValidId(value: unknown) {
  const id = String(value || "").trim();

  return id && id !== "-" && id !== "undefined" && id !== "null";
}

function SarIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <Image
      src={SAR_ICON_PATH}
      alt=""
      width={16}
      height={16}
      className={className}
    />
  );
}

function MoneyText({ value }: { value: unknown }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span>{formatMoney(value)}</span>
      <SarIcon className="h-3.5 w-3.5" />
    </span>
  );
}

/* ============================================================
   Skeleton
============================================================ */

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function KpiSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-5">
            <SkeletonLine className="h-8 w-28" />
            <SkeletonLine className="mt-3 h-4 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TableSkeleton({ columnsCount }: { columnsCount: number }) {
  return (
    <>
      {Array.from({ length: 7 }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columnsCount }).map((__, columnIndex) => (
            <TableCell key={columnIndex}>
              <SkeletonLine
                className={
                  columnIndex === 1
                    ? "h-8 w-44 rounded-lg"
                    : "h-4 w-24 rounded-lg"
                }
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/* ============================================================
   Export / Print
============================================================ */

function downloadExcel({
  filename,
  worksheetName,
  title,
  locale,
  summary,
  accounts,
  transactions,
}: {
  filename: string;
  worksheetName: string;
  title: string;
  locale: AppLocale;
  summary: TreasuryReportsSummary;
  accounts: TreasuryAccountRow[];
  transactions: TreasuryTransactionRow[];
}) {
  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const align = isArabic ? "right" : "left";
  const t = dictionary(locale);

  const accountsRows = accounts
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.code)}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(accountTypeLabel(item.account_type, locale))}</td>
          <td>${escapeHtml(accountStatusLabel(item.status, locale))}</td>
          <td>${escapeHtml(formatMoney(item.current_balance))}</td>
          <td>${escapeHtml(formatMoney(item.opening_balance))}</td>
          <td>${escapeHtml(item.is_default ? t.defaultAccount : t.regularAccount)}</td>
          <td>${escapeHtml(item.bank_name || "-")}</td>
          <td>${escapeHtml(item.account_number || "-")}</td>
          <td>${escapeHtml(item.iban || "-")}</td>
        </tr>`,
    )
    .join("");

  const transactionsRows = transactions
    .slice(0, 100)
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.transaction_number)}</td>
          <td>${escapeHtml(transactionTypeLabel(item.transaction_type, locale))}</td>
          <td>${escapeHtml(transactionStatusLabel(item.status, locale))}</td>
          <td>${escapeHtml(item.account_name || "-")}</td>
          <td>${escapeHtml(formatMoney(item.amount))}</td>
          <td>${escapeHtml(item.is_treasury_posted ? t.posted : t.notPosted)}</td>
          <td>${escapeHtml(item.is_accounting_posted ? t.posted : t.notPosted)}</td>
          <td>${escapeHtml(item.source_reference || "-")}</td>
        </tr>`,
    )
    .join("");

  const workbook = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>${escapeHtml(worksheetName)}</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayRightToLeft>${isArabic ? "True" : "False"}</x:DisplayRightToLeft>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { direction: ${dir}; font-family: Arial, sans-serif; }
          table { border-collapse: collapse; width: 100%; }
          th, td {
            border: 1px solid #d9e2ef;
            padding: 8px;
            text-align: ${align};
            vertical-align: top;
            mso-number-format: "\\@";
          }
          th { background: #d8ecfb; color: #000; font-weight: 700; }
          .title { font-size: 20px; font-weight: 700; text-align: center; background: #fff; }
          .section { font-weight: 700; background: #eef6ff; }
          .summary-label { font-weight: 700; background: #f8fafc; width: 240px; }
          .summary-value { font-weight: 700; }
        </style>
      </head>

      <body dir="${dir}">
        <table>
          <tr><td class="title" colspan="10">${escapeHtml(title)}</td></tr>
          <tr><td colspan="10"></td></tr>
          <tr><td class="section" colspan="10">${escapeHtml(t.summaryTitle)}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.generatedAt)}</td><td class="summary-value" colspan="9">${escapeHtml(new Date().toLocaleString("en-US"))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalAccounts)}</td><td class="summary-value" colspan="9">${escapeHtml(formatNumber(summary.total_accounts))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalBalance)}</td><td class="summary-value" colspan="9">${escapeHtml(formatMoney(summary.total_balance))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalTransactions)}</td><td class="summary-value" colspan="9">${escapeHtml(formatNumber(summary.total_transactions))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.receiptsTotal)}</td><td class="summary-value" colspan="9">${escapeHtml(formatMoney(summary.receipts_total))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.paymentsTotal)}</td><td class="summary-value" colspan="9">${escapeHtml(formatMoney(summary.payments_total))}</td></tr>

          <tr><td colspan="10"></td></tr>
          <tr><td class="section" colspan="10">${escapeHtml(t.accountsTitle)}</td></tr>
          <tr>
            <th>${escapeHtml(t.table.code)}</th>
            <th>${escapeHtml(t.table.account)}</th>
            <th>${escapeHtml(t.table.type)}</th>
            <th>${escapeHtml(t.table.status)}</th>
            <th>${escapeHtml(t.table.balance)}</th>
            <th>${escapeHtml(t.table.openingBalance)}</th>
            <th>${escapeHtml(t.table.defaultAccount)}</th>
            <th>${escapeHtml(isArabic ? "اسم البنك" : "Bank Name")}</th>
            <th>${escapeHtml(isArabic ? "رقم الحساب" : "Account Number")}</th>
            <th>${escapeHtml("IBAN")}</th>
          </tr>
          ${accountsRows}

          <tr><td colspan="10"></td></tr>
          <tr><td class="section" colspan="10">${escapeHtml(t.movementsTitle)}</td></tr>
          <tr>
            <th>${escapeHtml(isArabic ? "رقم الحركة" : "Transaction No.")}</th>
            <th>${escapeHtml(isArabic ? "نوع الحركة" : "Type")}</th>
            <th>${escapeHtml(t.table.status)}</th>
            <th>${escapeHtml(t.table.account)}</th>
            <th>${escapeHtml(isArabic ? "المبلغ" : "Amount")}</th>
            <th>${escapeHtml(t.treasuryPosted)}</th>
            <th>${escapeHtml(t.accountingPosted)}</th>
            <th>${escapeHtml(isArabic ? "المرجع" : "Reference")}</th>
          </tr>
          ${transactionsRows}
        </table>
      </body>
    </html>`;

  const blob = new Blob([workbook], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

function buildPrintHtml({
  locale,
  title,
  summary,
  accounts,
}: {
  locale: AppLocale;
  title: string;
  summary: TreasuryReportsSummary;
  accounts: TreasuryAccountRow[];
}) {
  const isArabic = locale === "ar";
  const t = dictionary(locale);
  const now = new Date().toLocaleString("en-US");

  const rows = accounts
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.code)}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(accountTypeLabel(item.account_type, locale))}</td>
          <td>${escapeHtml(accountStatusLabel(item.status, locale))}</td>
          <td>${escapeHtml(formatMoney(item.current_balance))}</td>
          <td>${escapeHtml(item.is_default ? t.defaultAccount : t.regularAccount)}</td>
        </tr>`,
    )
    .join("");

  return `
    <!doctype html>
    <html lang="${locale}" dir="${isArabic ? "rtl" : "ltr"}">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 24px;
            font-family: Arial, Tahoma, sans-serif;
            color: #111827;
            background: #fff;
            direction: ${isArabic ? "rtl" : "ltr"};
            text-align: ${isArabic ? "right" : "left"};
          }
          .print-header {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 18px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 14px;
          }
          h1 { margin: 0; font-size: 22px; font-weight: 800; }
          .meta { margin-top: 8px; color: #6b7280; font-size: 12px; line-height: 1.8; }
          .badge {
            border: 1px solid #d1d5db;
            border-radius: 999px;
            padding: 4px 10px;
            font-size: 12px;
            height: fit-content;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 18px;
          }
          .summary-card {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 10px;
          }
          .summary-card span {
            display: block;
            color: #6b7280;
            font-size: 11px;
            margin-bottom: 5px;
          }
          .summary-card strong { font-size: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #f3f4f6; color: #111827; font-weight: 700; }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 9px 8px;
            text-align: ${isArabic ? "right" : "left"};
            vertical-align: top;
          }
          tr:nth-child(even) td { background: #fafafa; }
          @page { size: A4 landscape; margin: 12mm; }
          @media print { body { padding: 0; } }
        </style>
      </head>

      <body>
        <div class="print-header">
          <div>
            <h1>${escapeHtml(title)}</h1>
            <div class="meta">
              <div>${escapeHtml(t.printedAt)}: ${escapeHtml(now)}</div>
              <div>${escapeHtml(t.rowsCount)}: ${formatNumber(accounts.length)}</div>
            </div>
          </div>
          <div class="badge">Primey Care</div>
        </div>

        <div class="summary-grid">
          <div class="summary-card"><span>${escapeHtml(t.totalAccounts)}</span><strong>${formatNumber(summary.total_accounts)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.totalBalance)}</span><strong>${formatMoney(summary.total_balance)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.totalTransactions)}</span><strong>${formatNumber(summary.total_transactions)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.netTotal)}</span><strong>${formatMoney(summary.net_total)}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${escapeHtml(t.table.code)}</th>
              <th>${escapeHtml(t.table.account)}</th>
              <th>${escapeHtml(t.table.type)}</th>
              <th>${escapeHtml(t.table.status)}</th>
              <th>${escapeHtml(t.table.balance)}</th>
              <th>${escapeHtml(t.table.defaultAccount)}</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows ||
              `<tr><td colspan="7" style="text-align:center">${escapeHtml(t.emptyTitle)}</td></tr>`
            }
          </tbody>
        </table>

        <script>
          window.addEventListener("load", () => {
            window.focus();
            window.print();
          });
        </script>
      </body>
    </html>
  `;
}

/* ============================================================
   Page
============================================================ */

export default function TreasuryReportsPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [accounts, setAccounts] = useState<TreasuryAccountRow[]>([]);
  const [transactions, setTransactions] = useState<TreasuryTransactionRow[]>([]);
  const [summary, setSummary] =
    useState<TreasuryReportsSummary>(DEFAULT_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [query, setQuery] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] =
    useState<AccountTypeFilter>("ALL");
  const [transactionTypeFilter, setTransactionTypeFilter] =
    useState<TransactionTypeFilter>("ALL");
  const [transactionStatusFilter, setTransactionStatusFilter] =
    useState<TransactionStatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [visibleColumns, setVisibleColumns] =
    useState<VisibleColumns>(DEFAULT_COLUMNS);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canView = hasSafePermission(
    auth,
    ["treasury.view", "treasury.reports.view", "reports.view"],
    "view",
  );

  const canExport = hasSafePermission(
    auth,
    ["treasury.export", "treasury.reports.export", "reports.export"],
    "action",
  );

  const canPrint = hasSafePermission(
    auth,
    ["treasury.print", "treasury.reports.print", "reports.print"],
    "action",
  );

  const canViewAccounts = hasSafePermission(
    auth,
    ["treasury.view", "treasury.accounts.view"],
    "view",
  );

  const filteredAccounts = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return accounts.filter((item) => {
      const matchesAccountType =
        accountTypeFilter === "ALL" ? true : item.account_type === accountTypeFilter;

      const matchesQuery = !cleanQuery
        ? true
        : [
            item.code,
            item.name,
            item.bank_name,
            item.account_number,
            item.iban,
            accountTypeLabel(item.account_type, locale),
            accountStatusLabel(item.status, locale),
          ]
            .join(" ")
            .toLowerCase()
            .includes(cleanQuery);

      return matchesAccountType && matchesQuery;
    });
  }, [accountTypeFilter, accounts, locale, query]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((item) => {
      const matchesType =
        transactionTypeFilter === "ALL"
          ? true
          : item.transaction_type === transactionTypeFilter;

      const matchesStatus =
        transactionStatusFilter === "ALL"
          ? true
          : item.status === transactionStatusFilter;

      return matchesType && matchesStatus;
    });
  }, [transactionStatusFilter, transactionTypeFilter, transactions]);

  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / PAGE_SIZE));

  const paginatedAccounts = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * PAGE_SIZE;

    return filteredAccounts.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredAccounts, page, totalPages]);

  const hasSearchOrFilter =
    query.trim().length > 0 ||
    accountTypeFilter !== "ALL" ||
    transactionTypeFilter !== "ALL" ||
    transactionStatusFilter !== "ALL";

  const visibleColumnCount = Object.entries(visibleColumns).filter(
    ([key, value]) => value && (key !== "actions" || canViewAccounts),
  ).length;

  const accountTypeOptions = useMemo(
    () => [
      {
        value: "ALL" as AccountTypeFilter,
        label: t.allAccountTypes,
        count: accounts.length,
      },
      {
        value: "CASHBOX" as AccountTypeFilter,
        label: t.cashbox,
        count: accounts.filter((item) => item.account_type === "CASHBOX").length,
      },
      {
        value: "BANK" as AccountTypeFilter,
        label: t.bank,
        count: accounts.filter((item) => item.account_type === "BANK").length,
      },
      {
        value: "WALLET" as AccountTypeFilter,
        label: t.wallet,
        count: accounts.filter((item) => item.account_type === "WALLET").length,
      },
      {
        value: "OTHER" as AccountTypeFilter,
        label: t.other,
        count: accounts.filter((item) => item.account_type === "OTHER").length,
      },
    ],
    [accounts, t],
  );

  const transactionTypeOptions = useMemo(
    () => [
      {
        value: "ALL" as TransactionTypeFilter,
        label: t.allTransactionTypes,
        count: transactions.length,
      },
      {
        value: "RECEIPT" as TransactionTypeFilter,
        label: t.receipt,
        count: transactions.filter((item) => item.transaction_type === "RECEIPT")
          .length,
      },
      {
        value: "PAYMENT" as TransactionTypeFilter,
        label: t.payment,
        count: transactions.filter((item) => item.transaction_type === "PAYMENT")
          .length,
      },
      {
        value: "TRANSFER" as TransactionTypeFilter,
        label: t.transfer,
        count: transactions.filter((item) => item.transaction_type === "TRANSFER")
          .length,
      },
      {
        value: "ADJUSTMENT" as TransactionTypeFilter,
        label: t.adjustment,
        count: transactions.filter(
          (item) => item.transaction_type === "ADJUSTMENT",
        ).length,
      },
    ],
    [transactions, t],
  );

  const transactionStatusOptions = useMemo(
    () => [
      {
        value: "ALL" as TransactionStatusFilter,
        label: t.allStatuses,
        count: transactions.length,
      },
      {
        value: "DRAFT" as TransactionStatusFilter,
        label: t.draft,
        count: transactions.filter((item) => item.status === "DRAFT").length,
      },
      {
        value: "CONFIRMED" as TransactionStatusFilter,
        label: t.confirmed,
        count: transactions.filter((item) => item.status === "CONFIRMED").length,
      },
      {
        value: "CANCELLED" as TransactionStatusFilter,
        label: t.cancelled,
        count: transactions.filter((item) => item.status === "CANCELLED").length,
      },
    ],
    [transactions, t],
  );

  const columnOptions: Array<{ key: keyof VisibleColumns; label: string }> = [
    { key: "code", label: t.table.code },
    { key: "account", label: t.table.account },
    { key: "type", label: t.table.type },
    { key: "status", label: t.table.status },
    { key: "balance", label: t.table.balance },
    { key: "openingBalance", label: t.table.openingBalance },
    { key: "defaultAccount", label: t.table.defaultAccount },
    { key: "bankInfo", label: t.table.bankInfo },
    { key: "actions", label: t.table.action },
  ];

  const filteredSummary = useMemo(
    () => buildSummary(filteredAccounts, filteredTransactions),
    [filteredAccounts, filteredTransactions],
  );

  const loadReports = useCallback(
    async (showToast = false) => {
      if (!canView) {
        setAccounts([]);
        setTransactions([]);
        setSummary(DEFAULT_SUMMARY);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");

        const [summaryResponse, accountsResponse, transactionsResponse] =
          await Promise.allSettled([
            fetch(apiUrl("/api/treasury/reports/summary/"), {
              method: "GET",
              credentials: "include",
              cache: "no-store",
              headers: { Accept: "application/json" },
            }),
            fetch(apiUrl("/api/treasury/accounts/?page_size=500"), {
              method: "GET",
              credentials: "include",
              cache: "no-store",
              headers: { Accept: "application/json" },
            }),
            fetch(apiUrl("/api/treasury/transactions/?page_size=500"), {
              method: "GET",
              credentials: "include",
              cache: "no-store",
              headers: { Accept: "application/json" },
            }),
          ]);

        async function readJson(result: PromiseSettledResult<Response>) {
          if (result.status !== "fulfilled") return null;

          const response = result.value;
          const payload = (await response.json().catch(() => null)) as
            | ApiEnvelope<unknown>
            | null;

          if ([400, 404, 405].includes(response.status)) return null;

          if (
            !response.ok ||
            payload?.ok === false ||
            payload?.success === false
          ) {
            throw new Error(
              payload?.message ||
                payload?.detail ||
                payload?.error ||
                `HTTP ${response.status}`,
            );
          }

          return payload;
        }

        const summaryPayload = await readJson(summaryResponse);
        const accountsPayload = await readJson(accountsResponse);
        const transactionsPayload = await readJson(transactionsResponse);

        const normalizedAccounts = extractRows(accountsPayload, "accounts")
          .map(normalizeAccount)
          .filter((item) => item.id || item.name);

        const normalizedTransactions = extractRows(
          transactionsPayload,
          "transactions",
        )
          .map(normalizeTransaction)
          .filter((item) => item.id || item.transaction_number);

        setAccounts(normalizedAccounts);
        setTransactions(normalizedTransactions);
        setSummary(
          buildSummary(
            normalizedAccounts,
            normalizedTransactions,
            extractSummary(summaryPayload),
          ),
        );
        setPage(1);

        if (showToast) toast.success(t.loadSuccess);
      } catch (error) {
        console.error("Treasury reports load error:", error);
        setAccounts([]);
        setTransactions([]);
        setSummary(DEFAULT_SUMMARY);
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [canView, t.loadError, t.loadSuccess],
  );

  function clearFilters() {
    setQuery("");
    setAccountTypeFilter("ALL");
    setTransactionTypeFilter("ALL");
    setTransactionStatusFilter("ALL");
    setPage(1);
  }

  function exportExcel() {
    if (!canExport) return;

    if (filteredAccounts.length === 0 && filteredTransactions.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    downloadExcel({
      filename: `primey-care-treasury-reports-${new Date()
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "تقارير الخزينة" : "Treasury Reports",
      title: t.title,
      locale,
      summary: hasSearchOrFilter ? filteredSummary : summary,
      accounts: filteredAccounts,
      transactions: filteredTransactions,
    });

    toast.success(t.exportSuccess);
  }

  function printPage() {
    if (!canPrint) return;

    if (filteredAccounts.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) {
      toast.error(t.printError);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      buildPrintHtml({
        locale,
        title: t.title,
        summary: hasSearchOrFilter ? filteredSummary : summary,
        accounts: filteredAccounts,
      }),
    );
    printWindow.document.close();

    toast.success(t.printSuccess);
  }

  useEffect(() => {
    const syncLocale = () => {
      const nextLocale = readLocale();

      applyDocumentLocale(nextLocale);
      setLocale(nextLocale);
    };

    const syncAfterPaint = () => {
      syncLocale();
      window.setTimeout(syncLocale, 0);
    };

    syncAfterPaint();

    window.addEventListener("primey-locale-changed", syncAfterPaint);
    window.addEventListener("storage", syncAfterPaint);

    return () => {
      window.removeEventListener("primey-locale-changed", syncAfterPaint);
      window.removeEventListener("storage", syncAfterPaint);
    };
  }, []);

  useEffect(() => {
    if (authResolving) return;
    loadReports(false);
  }, [authResolving, loadReports]);

  useEffect(() => {
    setPage(1);
  }, [query, accountTypeFilter, transactionTypeFilter, transactionStatusFilter]);

  if (!authResolving && !canView) {
    return (
      <div className="w-full space-y-4" dir={isArabic ? "rtl" : "ltr"}>
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 shadow-sm">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <XCircle className="h-5 w-5" />
            </div>

            <div>
              <p className="font-semibold text-destructive">
                {t.accessDeniedTitle}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.accessDeniedText}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeSummary = hasSearchOrFilter ? filteredSummary : summary;

  return (
    <div className="w-full space-y-4" dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t.title}
          </h1>

          <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
            {t.subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link href="/system/treasury">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>

          <Link href="/system/treasury/accounts">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <Wallet className="h-4 w-4" />
              <span>{t.accounts}</span>
            </Button>
          </Link>

          <Link href="/system/treasury/transactions">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <CreditCard className="h-4 w-4" />
              <span>{t.transactions}</span>
            </Button>
          </Link>

          <Link href="/system/treasury/transfers">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <BarChart3 className="h-4 w-4" />
              <span>{t.transfers}</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadReports(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refresh}</span>
          </Button>

          {canExport ? (
            <Button
              className="h-10 rounded-xl"
              onClick={exportExcel}
              disabled={isLoading || Boolean(errorMessage)}
            >
              <Download className="h-4 w-4" />
              <span>{t.exportExcel}</span>
            </Button>
          ) : null}

          {canPrint ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={printPage}
              disabled={isLoading || Boolean(errorMessage)}
            >
              <Printer className="h-4 w-4" />
              <span>{t.print}</span>
            </Button>
          ) : null}
        </div>
      </div>

      {!isLoading && errorMessage ? (
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <XCircle className="h-5 w-5" />
              </div>

              <div>
                <p className="font-semibold text-destructive">{errorMessage}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.loadErrorHint}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => loadReports(true)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <KpiSkeleton />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-2xl font-bold">
                    <MoneyText value={activeSummary.total_balance} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.totalBalance}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                  <Wallet className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-2xl font-bold">
                    {formatNumber(activeSummary.total_accounts)}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.totalAccounts}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-2xl font-bold">
                    {formatNumber(activeSummary.total_transactions)}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.totalTransactions}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                  <CreditCard className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-2xl font-bold">
                    <MoneyText value={activeSummary.net_total} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.netTotal}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300">
                  <BarChart3 className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-2xl border bg-card shadow-sm xl:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Landmark className="h-4 w-4" />
              {t.summaryTitle}
            </CardTitle>
            <CardDescription>{t.summaryDesc}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
              <span>{t.cashboxes}</span>
              <span className="font-semibold">
                {formatNumber(activeSummary.cashbox_accounts)}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
              <span>{t.banks}</span>
              <span className="font-semibold">
                {formatNumber(activeSummary.bank_accounts)}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
              <span>{t.activeAccounts}</span>
              <span className="font-semibold">
                {formatNumber(activeSummary.active_accounts)}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
              <span>{t.openingBalanceTotal}</span>
              <MoneyText value={activeSummary.opening_balance_total} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm xl:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Receipt className="h-4 w-4" />
              {t.movementsTitle}
            </CardTitle>
            <CardDescription>{t.movementsDesc}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
              <span>{t.receipts}</span>
              <span className="font-semibold">
                {formatNumber(activeSummary.receipts_count)}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
              <span>{t.payments}</span>
              <span className="font-semibold">
                {formatNumber(activeSummary.payments_count)}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
              <span>{t.transfersCount}</span>
              <span className="font-semibold">
                {formatNumber(activeSummary.transfers_count)}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
              <span>{t.receiptsTotal}</span>
              <MoneyText value={activeSummary.receipts_total} />
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
              <span>{t.paymentsTotal}</span>
              <MoneyText value={activeSummary.payments_total} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm xl:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <ShieldCheck className="h-4 w-4" />
              {t.treasuryPosted}
            </CardTitle>
            <CardDescription>{t.movementsDesc}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
              <span>{t.treasuryPosted}</span>
              <span className="font-semibold">
                {formatNumber(activeSummary.treasury_posted_count)}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
              <span>{t.accountingPosted}</span>
              <span className="font-semibold">
                {formatNumber(activeSummary.accounting_posted_count)}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
              <span>{t.unposted}</span>
              <span className="font-semibold">
                {formatNumber(activeSummary.unposted_count)}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
              <span>{t.confirmedTransactions}</span>
              <span className="font-semibold">
                {formatNumber(activeSummary.confirmed_transactions)}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
              <span>{t.cancelledTransactions}</span>
              <span className="font-semibold">
                {formatNumber(activeSummary.cancelled_transactions)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader className="space-y-4 pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base font-bold">
                {t.accountsTitle}
              </CardTitle>
              <CardDescription className="mt-1">{t.accountsDesc}</CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => loadReports(true)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                {t.refresh}
              </Button>

              {hasSearchOrFilter ? (
                <Button
                  variant="outline"
                  className="h-10 rounded-xl"
                  onClick={clearFilters}
                >
                  {t.clearFilters}
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="relative w-full">
            <Search
              className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${
                isArabic ? "right-3" : "left-3"
              }`}
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.searchPlaceholder}
              className={`h-11 rounded-xl ${isArabic ? "pr-10" : "pl-10"}`}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 rounded-xl">
                    <Filter className="h-4 w-4" />
                    {t.filters}
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align={isArabic ? "start" : "end"}
                  className="w-80 rounded-2xl"
                >
                  <div dir={isArabic ? "rtl" : "ltr"}>
                    <DropdownMenuLabel>{t.allAccountTypes}</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {accountTypeOptions.map((item) => (
                      <DropdownMenuCheckboxItem
                        key={item.value}
                        checked={accountTypeFilter === item.value}
                        onCheckedChange={() => setAccountTypeFilter(item.value)}
                      >
                        {item.label} ({formatNumber(item.count)})
                      </DropdownMenuCheckboxItem>
                    ))}

                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>{t.allTransactionTypes}</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {transactionTypeOptions.map((item) => (
                      <DropdownMenuCheckboxItem
                        key={item.value}
                        checked={transactionTypeFilter === item.value}
                        onCheckedChange={() => setTransactionTypeFilter(item.value)}
                      >
                        {item.label} ({formatNumber(item.count)})
                      </DropdownMenuCheckboxItem>
                    ))}

                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>{t.allStatuses}</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {transactionStatusOptions.map((item) => (
                      <DropdownMenuCheckboxItem
                        key={item.value}
                        checked={transactionStatusFilter === item.value}
                        onCheckedChange={() =>
                          setTransactionStatusFilter(item.value)
                        }
                      >
                        {item.label} ({formatNumber(item.count)})
                      </DropdownMenuCheckboxItem>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 rounded-xl">
                    <Columns3 className="h-4 w-4" />
                    {t.columns}
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align={isArabic ? "start" : "end"}
                  className="w-64 rounded-2xl"
                >
                  <div dir={isArabic ? "rtl" : "ltr"}>
                    <DropdownMenuLabel>{t.columns}</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {columnOptions.map((column) => {
                      if (column.key === "actions" && !canViewAccounts) {
                        return null;
                      }

                      return (
                        <DropdownMenuCheckboxItem
                          key={column.key}
                          checked={visibleColumns[column.key]}
                          onCheckedChange={(checked) =>
                            setVisibleColumns((current) => ({
                              ...current,
                              [column.key]: Boolean(checked),
                            }))
                          }
                        >
                          {column.label}
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {visibleColumns.code ? (
                      <TableHead className="min-w-[120px]">
                        {t.table.code}
                      </TableHead>
                    ) : null}

                    {visibleColumns.account ? (
                      <TableHead className="min-w-[220px]">
                        {t.table.account}
                      </TableHead>
                    ) : null}

                    {visibleColumns.type ? (
                      <TableHead className="min-w-[120px]">
                        {t.table.type}
                      </TableHead>
                    ) : null}

                    {visibleColumns.status ? (
                      <TableHead className="min-w-[120px]">
                        {t.table.status}
                      </TableHead>
                    ) : null}

                    {visibleColumns.balance ? (
                      <TableHead className="min-w-[150px]">
                        {t.table.balance}
                      </TableHead>
                    ) : null}

                    {visibleColumns.openingBalance ? (
                      <TableHead className="min-w-[160px]">
                        {t.table.openingBalance}
                      </TableHead>
                    ) : null}

                    {visibleColumns.defaultAccount ? (
                      <TableHead className="min-w-[110px]">
                        {t.table.defaultAccount}
                      </TableHead>
                    ) : null}

                    {visibleColumns.bankInfo ? (
                      <TableHead className="min-w-[260px]">
                        {t.table.bankInfo}
                      </TableHead>
                    ) : null}

                    {visibleColumns.actions && canViewAccounts ? (
                      <TableHead className="min-w-[100px]">
                        {t.table.action}
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading ? (
                    <TableSkeleton columnsCount={visibleColumnCount || 1} />
                  ) : paginatedAccounts.length > 0 ? (
                    paginatedAccounts.map((item) => (
                      <TableRow key={`${item.id}-${item.code}`}>
                        {visibleColumns.code ? (
                          <TableCell className="font-semibold" dir="ltr">
                            {item.code || "-"}
                          </TableCell>
                        ) : null}

                        {visibleColumns.account ? (
                          <TableCell>
                            <div className="min-w-[200px]">
                              <p className="font-medium">{item.name || "-"}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.is_default
                                  ? t.defaultAccount
                                  : t.regularAccount}
                              </p>
                            </div>
                          </TableCell>
                        ) : null}

                        {visibleColumns.type ? (
                          <TableCell>
                            {accountTypeBadge(item.account_type, locale)}
                          </TableCell>
                        ) : null}

                        {visibleColumns.status ? (
                          <TableCell>
                            {accountStatusBadge(item.status, locale)}
                          </TableCell>
                        ) : null}

                        {visibleColumns.balance ? (
                          <TableCell>
                            <MoneyText value={item.current_balance} />
                          </TableCell>
                        ) : null}

                        {visibleColumns.openingBalance ? (
                          <TableCell>
                            <MoneyText value={item.opening_balance} />
                          </TableCell>
                        ) : null}

                        {visibleColumns.defaultAccount ? (
                          <TableCell>
                            {item.is_default ? (
                              <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                                {t.defaultAccount}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="rounded-full px-3 py-1">
                                {t.regularAccount}
                              </Badge>
                            )}
                          </TableCell>
                        ) : null}

                        {visibleColumns.bankInfo ? (
                          <TableCell>
                            <div className="min-w-[240px] text-sm">
                              <p className="font-medium">{item.bank_name || "-"}</p>
                              <p className="text-xs text-muted-foreground" dir="ltr">
                                {item.account_number || "-"}
                              </p>
                              <p
                                className="line-clamp-1 text-xs text-muted-foreground"
                                dir="ltr"
                              >
                                {item.iban || "-"}
                              </p>
                            </div>
                          </TableCell>
                        ) : null}

                        {visibleColumns.actions && canViewAccounts ? (
                          <TableCell>
                            {isValidId(item.id) ? (
                              <Link href={`/system/treasury/accounts/${item.id}`}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 rounded-lg"
                                >
                                  <Eye className="h-4 w-4" />
                                  <span className="sr-only">{t.view}</span>
                                </Button>
                              </Link>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                -
                              </span>
                            )}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={visibleColumnCount || 1}
                        className="h-44 text-center"
                      >
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Building2 className="h-10 w-10 text-muted-foreground/40" />
                          <p className="font-semibold">
                            {hasSearchOrFilter ? t.noResultsTitle : t.emptyTitle}
                          </p>
                          <p className="max-w-md text-sm text-muted-foreground">
                            {hasSearchOrFilter ? t.noResultsText : t.emptyText}
                          </p>

                          {hasSearchOrFilter ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2 rounded-xl"
                              onClick={clearFilters}
                            >
                              {t.clearFilters}
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              {t.showing} {formatNumber(paginatedAccounts.length)} {t.from}{" "}
              {formatNumber(filteredAccounts.length)}
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                {t.previous}
              </Button>

              <Badge variant="outline" className="rounded-full px-3 py-1">
                {formatNumber(Math.min(page, totalPages))} /{" "}
                {formatNumber(totalPages)}
              </Badge>

              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={page >= totalPages || isLoading}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
              >
                {t.next}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}