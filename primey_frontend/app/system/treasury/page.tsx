"use client";

/* ============================================================
   📂 app/system/treasury/page.tsx
   🧠 Primey Care | Treasury Overview

   ✅ المرحلة 17 + المرحلة 2
   ✅ نفس النمط المعتمد
   ✅ w-full space-y-4
   ✅ بدون main / min-h-screen / max-w
   ✅ أزرار انتقال للصفحات التي أزلناها من السايدر
   ✅ Skeleton Loading
   ✅ Error State مستقل
   ✅ Empty State ذكي
   ✅ Excel .xls HTML Workbook
   ✅ Web PDF Print
   ✅ sonner
   ✅ SAR icon من /currency/sar.svg
   ✅ صلاحيات آمنة مع fallback لـ system_admin / superuser
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Banknote,
  BarChart3,
  Building2,
  CreditCard,
  Download,
  Eye,
  FileText,
  Landmark,
  Loader2,
  PlusCircle,
  Printer,
  ReceiptText,
  RefreshCcw,
  Search,
  Settings,
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

type TreasuryAccountType = "CASHBOX" | "BANK" | "WALLET" | "OTHER";
type TreasuryStatus = "ACTIVE" | "INACTIVE" | "CLOSED" | "UNKNOWN";
type TransactionType = "RECEIPT" | "PAYMENT" | "TRANSFER" | "ADJUSTMENT" | "UNKNOWN";
type TransactionStatus = "DRAFT" | "CONFIRMED" | "CANCELLED" | "UNKNOWN";

type TreasuryAccount = {
  id: string;
  name: string;
  code: string;
  account_type: TreasuryAccountType;
  status: TreasuryStatus;
  current_balance: number;
  currency: string;
  is_default: boolean;
  created_at: string;
};

type TreasuryTransaction = {
  id: string;
  transaction_number: string;
  transaction_type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  transaction_date: string;
  account_name: string;
  description: string;
};

type TreasurySummary = {
  total_accounts: number;
  active_accounts: number;
  cashbox_accounts: number;
  bank_accounts: number;
  wallet_accounts: number;
  total_balance: number;
  total_transactions: number;
  confirmed_transactions: number;
  receipt_total: number;
  payment_total: number;
  transfer_total: number;
  transfers_count: number;
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
  transfers?: unknown[];
  summary?: Partial<TreasurySummary>;
};

type Shortcut = {
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  href: string;
  icon: ReactNode;
  permission: "view" | "create" | "edit" | "reports";
};

const SAR_ICON_PATH = "/currency/sar.svg";

const DEFAULT_SUMMARY: TreasurySummary = {
  total_accounts: 0,
  active_accounts: 0,
  cashbox_accounts: 0,
  bank_accounts: 0,
  wallet_accounts: 0,
  total_balance: 0,
  total_transactions: 0,
  confirmed_transactions: 0,
  receipt_total: 0,
  payment_total: 0,
  transfer_total: 0,
  transfers_count: 0,
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

function hasAnyPermission(
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
    title: isArabic ? "الخزينة" : "Treasury",
    subtitle: isArabic
      ? "متابعة الأرصدة والحركات والسندات والتحويلات المالية من لوحة واحدة."
      : "Track balances, transactions, vouchers, and transfers from one place.",

    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",

    totalBalance: isArabic ? "إجمالي الرصيد" : "Total Balance",
    totalAccounts: isArabic ? "حسابات الخزينة" : "Treasury Accounts",
    cashboxes: isArabic ? "الصناديق" : "Cashboxes",
    banks: isArabic ? "البنوك" : "Banks",
    receipts: isArabic ? "إجمالي القبض" : "Total Receipts",
    payments: isArabic ? "إجمالي الصرف" : "Total Payments",
    transfers: isArabic ? "التحويلات" : "Transfers",
    transactions: isArabic ? "الحركات المالية" : "Transactions",

    shortcutsTitle: isArabic ? "اختصارات الخزينة" : "Treasury Shortcuts",
    shortcutsDesc: isArabic
      ? "الوصول السريع للصفحات الداخلية بعد تنظيف السايدر."
      : "Quick access to internal treasury pages after sidebar cleanup.",

    accountsTitle: isArabic ? "أهم حسابات الخزينة" : "Top Treasury Accounts",
    accountsDesc: isArabic
      ? "أعلى الحسابات حسب الرصيد الحالي."
      : "Top accounts by current balance.",
    transactionsTitle: isArabic ? "آخر الحركات المالية" : "Latest Transactions",
    transactionsDesc: isArabic
      ? "أحدث الحركات المسجلة في الخزينة."
      : "Latest recorded treasury transactions.",

    searchPlaceholder: isArabic
      ? "ابحث في الحسابات أو الحركات..."
      : "Search accounts or transactions...",

    table: {
      account: isArabic ? "الحساب" : "Account",
      type: isArabic ? "النوع" : "Type",
      status: isArabic ? "الحالة" : "Status",
      balance: isArabic ? "الرصيد" : "Balance",
      number: isArabic ? "الرقم" : "Number",
      date: isArabic ? "التاريخ" : "Date",
      transactionType: isArabic ? "نوع الحركة" : "Transaction Type",
      amount: isArabic ? "المبلغ" : "Amount",
      description: isArabic ? "الوصف" : "Description",
      action: isArabic ? "الإجراء" : "Action",
    },

    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
    closed: isArabic ? "مغلق" : "Closed",
    unknown: isArabic ? "غير محدد" : "Unknown",

    cashbox: isArabic ? "صندوق" : "Cashbox",
    bank: isArabic ? "بنك" : "Bank",
    wallet: isArabic ? "محفظة" : "Wallet",
    other: isArabic ? "أخرى" : "Other",

    receipt: isArabic ? "قبض" : "Receipt",
    payment: isArabic ? "صرف" : "Payment",
    transfer: isArabic ? "تحويل" : "Transfer",
    adjustment: isArabic ? "تسوية" : "Adjustment",

    confirmed: isArabic ? "مؤكد" : "Confirmed",
    draft: isArabic ? "مسودة" : "Draft",
    cancelled: isArabic ? "ملغى" : "Cancelled",

    view: isArabic ? "عرض" : "View",

    emptyTitle: isArabic ? "لا توجد بيانات خزينة" : "No treasury data",
    emptyText: isArabic
      ? "ستظهر بيانات الخزينة بعد إنشاء الحسابات والحركات."
      : "Treasury data will appear after creating accounts and transactions.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير كلمات البحث."
      : "Try changing your search terms.",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الخزينة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض الخزينة. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view treasury. Contact your system administrator if you need access.",

    loadError: isArabic ? "تعذر تحميل بيانات الخزينة." : "Unable to load treasury data.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    loadSuccess: isArabic ? "تم تحديث بيانات الخزينة." : "Treasury data refreshed.",

    exportSuccess: isArabic ? "تم تجهيز ملف Excel." : "Excel file prepared.",
    exportEmpty: isArabic ? "لا توجد بيانات قابلة للتصدير." : "No data available to export.",
    printSuccess: isArabic ? "تم تجهيز نافذة الطباعة." : "Print window prepared.",
    printError: isArabic ? "تعذر فتح نافذة الطباعة." : "Unable to open print window.",

    generatedAt: isArabic ? "تاريخ التصدير" : "Generated At",
    printedAt: isArabic ? "تاريخ الطباعة" : "Printed At",
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

function formatDate(value: string, locale: AppLocale): string {
  if (!value) return locale === "ar" ? "غير محدد" : "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
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

  for (const container of ["account", "treasury_account", "transaction", "data"]) {
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
  } as Partial<TreasurySummary>;
}

function normalizeAccountType(value: unknown): TreasuryAccountType {
  const clean = String(value || "").toUpperCase();

  if (["CASHBOX", "CASH", "CASH_BOX"].includes(clean)) return "CASHBOX";
  if (["BANK", "BANK_ACCOUNT"].includes(clean)) return "BANK";
  if (["WALLET", "DIGITAL_WALLET"].includes(clean)) return "WALLET";

  return "OTHER";
}

function normalizeStatus(value: unknown): TreasuryStatus {
  const clean = String(value || "").toUpperCase();

  if (["ACTIVE", "OPEN", "ENABLED"].includes(clean)) return "ACTIVE";
  if (["INACTIVE", "DISABLED"].includes(clean)) return "INACTIVE";
  if (["CLOSED", "LOCKED"].includes(clean)) return "CLOSED";

  return "UNKNOWN";
}

function normalizeTransactionType(value: unknown): TransactionType {
  const clean = String(value || "").toUpperCase();

  if (["RECEIPT", "INCOME", "DEPOSIT"].includes(clean)) return "RECEIPT";
  if (["PAYMENT", "EXPENSE", "WITHDRAWAL"].includes(clean)) return "PAYMENT";
  if (["TRANSFER"].includes(clean)) return "TRANSFER";
  if (["ADJUSTMENT"].includes(clean)) return "ADJUSTMENT";

  return "UNKNOWN";
}

function normalizeTransactionStatus(value: unknown): TransactionStatus {
  const clean = String(value || "").toUpperCase();

  if (["DRAFT", "PENDING", "NEW"].includes(clean)) return "DRAFT";
  if (["CONFIRMED", "POSTED", "APPROVED"].includes(clean)) return "CONFIRMED";
  if (["CANCELLED", "CANCELED", "VOID"].includes(clean)) return "CANCELLED";

  return "UNKNOWN";
}

function normalizeAccount(item: unknown, index: number): TreasuryAccount {
  const obj = asDict(item);

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || `${index}`),
    name: String(getNestedValue(obj, ["name", "title", "account_name"]) || "-"),
    code: String(getNestedValue(obj, ["code", "account_code", "number"]) || "-"),
    account_type: normalizeAccountType(
      getNestedValue(obj, ["account_type", "type", "kind"]),
    ),
    status: normalizeStatus(getNestedValue(obj, ["status", "state"])),
    current_balance: toNumber(
      getNestedValue(obj, ["current_balance", "balance", "amount"]),
    ),
    currency: String(getNestedValue(obj, ["currency"]) || "SAR"),
    is_default: Boolean(getNestedValue(obj, ["is_default", "default"])),
    created_at: String(getNestedValue(obj, ["created_at", "created"]) || ""),
  };
}

function normalizeTransaction(item: unknown, index: number): TreasuryTransaction {
  const obj = asDict(item);
  const accountObj = asDict(obj.account || obj.treasury_account);

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || `${index}`),
    transaction_number: String(
      getNestedValue(obj, ["transaction_number", "number", "code", "reference"]) ||
        "-",
    ),
    transaction_type: normalizeTransactionType(
      getNestedValue(obj, ["transaction_type", "type", "kind"]),
    ),
    status: normalizeTransactionStatus(getNestedValue(obj, ["status", "state"])),
    amount: toNumber(getNestedValue(obj, ["amount", "total"])),
    currency: String(getNestedValue(obj, ["currency"]) || "SAR"),
    transaction_date: String(
      getNestedValue(obj, ["transaction_date", "date", "created_at"]) || "",
    ),
    account_name: String(
      accountObj.name ||
        getNestedValue(obj, ["account_name", "treasury_account_name"]) ||
        "-",
    ),
    description: String(getNestedValue(obj, ["description", "notes", "memo"]) || ""),
  };
}

function buildSummary(
  accounts: TreasuryAccount[],
  transactions: TreasuryTransaction[],
  apiSummary?: Partial<TreasurySummary>,
): TreasurySummary {
  const confirmedTransactions = transactions.filter(
    (item) => item.status === "CONFIRMED",
  );

  const fallback: TreasurySummary = {
    total_accounts: accounts.length,
    active_accounts: accounts.filter((item) => item.status === "ACTIVE").length,
    cashbox_accounts: accounts.filter((item) => item.account_type === "CASHBOX").length,
    bank_accounts: accounts.filter((item) => item.account_type === "BANK").length,
    wallet_accounts: accounts.filter((item) => item.account_type === "WALLET").length,
    total_balance: accounts.reduce((sum, item) => sum + item.current_balance, 0),
    total_transactions: transactions.length,
    confirmed_transactions: confirmedTransactions.length,
    receipt_total: confirmedTransactions
      .filter((item) => item.transaction_type === "RECEIPT")
      .reduce((sum, item) => sum + item.amount, 0),
    payment_total: confirmedTransactions
      .filter((item) => item.transaction_type === "PAYMENT")
      .reduce((sum, item) => sum + item.amount, 0),
    transfer_total: confirmedTransactions
      .filter((item) => item.transaction_type === "TRANSFER")
      .reduce((sum, item) => sum + item.amount, 0),
    transfers_count: confirmedTransactions.filter(
      (item) => item.transaction_type === "TRANSFER",
    ).length,
  };

  const api = asDict(apiSummary);

  return {
    total_accounts:
      toNumber(api.total_accounts) ||
      toNumber(api.accounts_count) ||
      fallback.total_accounts,
    active_accounts: toNumber(api.active_accounts) || fallback.active_accounts,
    cashbox_accounts: toNumber(api.cashbox_accounts) || fallback.cashbox_accounts,
    bank_accounts: toNumber(api.bank_accounts) || fallback.bank_accounts,
    wallet_accounts: toNumber(api.wallet_accounts) || fallback.wallet_accounts,
    total_balance:
      toNumber(api.total_balance) ||
      toNumber(api.balance_total) ||
      fallback.total_balance,
    total_transactions:
      toNumber(api.total_transactions) ||
      toNumber(api.transactions_count) ||
      fallback.total_transactions,
    confirmed_transactions:
      toNumber(api.confirmed_transactions) || fallback.confirmed_transactions,
    receipt_total:
      toNumber(api.receipt_total) ||
      toNumber(api.receipts_total) ||
      fallback.receipt_total,
    payment_total:
      toNumber(api.payment_total) ||
      toNumber(api.payments_total) ||
      fallback.payment_total,
    transfer_total:
      toNumber(api.transfer_total) ||
      toNumber(api.transfers_total) ||
      fallback.transfer_total,
    transfers_count: toNumber(api.transfers_count) || fallback.transfers_count,
  };
}

function accountTypeLabel(type: TreasuryAccountType, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<TreasuryAccountType, string> = {
    CASHBOX: t.cashbox,
    BANK: t.bank,
    WALLET: t.wallet,
    OTHER: t.other,
  };

  return labels[type];
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

function statusLabel(status: TreasuryStatus | TransactionStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<string, string> = {
    ACTIVE: t.active,
    INACTIVE: t.inactive,
    CLOSED: t.closed,
    DRAFT: t.draft,
    CONFIRMED: t.confirmed,
    CANCELLED: t.cancelled,
    UNKNOWN: t.unknown,
  };

  return labels[status] || t.unknown;
}

function statusBadge(status: TreasuryStatus | TransactionStatus, locale: AppLocale) {
  const label = statusLabel(status, locale);

  if (status === "ACTIVE" || status === "CONFIRMED") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (status === "DRAFT") {
    return (
      <Badge className="rounded-full border-amber-200 bg-amber-50 px-3 py-1 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
        {label}
      </Badge>
    );
  }

  if (status === "CANCELLED" || status === "CLOSED") {
    return (
      <Badge className="rounded-full border-rose-200 bg-rose-50 px-3 py-1 text-rose-700 hover:bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
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

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function PageSkeleton() {
  return (
    <div className="space-y-4">
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="space-y-3 p-5">
            <SkeletonLine className="h-7 w-48" />
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonLine key={index} className="h-12 w-full rounded-xl" />
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="space-y-3 p-5">
            <SkeletonLine className="h-7 w-40" />
            {Array.from({ length: 5 }).map((_, index) => (
              <SkeletonLine key={index} className="h-14 w-full rounded-xl" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ============================================================
   Export / Print
============================================================ */

function downloadExcel({
  filename,
  title,
  locale,
  summary,
  accounts,
  transactions,
}: {
  filename: string;
  title: string;
  locale: AppLocale;
  summary: TreasurySummary;
  accounts: TreasuryAccount[];
  transactions: TreasuryTransaction[];
}) {
  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const align = isArabic ? "right" : "left";
  const t = dictionary(locale);

  const accountRows = accounts
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.code)}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(accountTypeLabel(item.account_type, locale))}</td>
          <td>${escapeHtml(statusLabel(item.status, locale))}</td>
          <td>${escapeHtml(formatMoney(item.current_balance))}</td>
        </tr>`,
    )
    .join("");

  const transactionRows = transactions
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(formatDate(item.transaction_date, locale))}</td>
          <td>${escapeHtml(item.transaction_number)}</td>
          <td>${escapeHtml(transactionTypeLabel(item.transaction_type, locale))}</td>
          <td>${escapeHtml(statusLabel(item.status, locale))}</td>
          <td>${escapeHtml(formatMoney(item.amount))}</td>
          <td>${escapeHtml(item.account_name)}</td>
          <td>${escapeHtml(item.description || "-")}</td>
        </tr>`,
    )
    .join("");

  const workbook = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8" />
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
          th { background: #d8ecfb; font-weight: 700; }
          .title { font-size: 20px; font-weight: 700; text-align: center; background: #fff; }
          .section { font-weight: 700; background: #eef6ff; }
          .summary-label { font-weight: 700; background: #f8fafc; width: 240px; }
        </style>
      </head>
      <body dir="${dir}">
        <table>
          <tr><td class="title" colspan="7">${escapeHtml(title)}</td></tr>
          <tr><td colspan="7"></td></tr>
          <tr><td class="section" colspan="7">${escapeHtml(t.generatedAt)}: ${escapeHtml(new Date().toLocaleString("en-US"))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalBalance)}</td><td colspan="6">${escapeHtml(formatMoney(summary.total_balance))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalAccounts)}</td><td colspan="6">${escapeHtml(formatNumber(summary.total_accounts))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.transactions)}</td><td colspan="6">${escapeHtml(formatNumber(summary.total_transactions))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.receipts)}</td><td colspan="6">${escapeHtml(formatMoney(summary.receipt_total))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.payments)}</td><td colspan="6">${escapeHtml(formatMoney(summary.payment_total))}</td></tr>

          <tr><td colspan="7"></td></tr>
          <tr><td class="section" colspan="7">${escapeHtml(t.accountsTitle)}</td></tr>
          <tr>
            <th>${escapeHtml(t.table.account)}</th>
            <th>${escapeHtml(t.table.account)}</th>
            <th>${escapeHtml(t.table.type)}</th>
            <th>${escapeHtml(t.table.status)}</th>
            <th>${escapeHtml(t.table.balance)}</th>
            <th colspan="2"></th>
          </tr>
          ${accountRows}

          <tr><td colspan="7"></td></tr>
          <tr><td class="section" colspan="7">${escapeHtml(t.transactionsTitle)}</td></tr>
          <tr>
            <th>${escapeHtml(t.table.date)}</th>
            <th>${escapeHtml(t.table.number)}</th>
            <th>${escapeHtml(t.table.transactionType)}</th>
            <th>${escapeHtml(t.table.status)}</th>
            <th>${escapeHtml(t.table.amount)}</th>
            <th>${escapeHtml(t.table.account)}</th>
            <th>${escapeHtml(t.table.description)}</th>
          </tr>
          ${transactionRows}
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
  transactions,
}: {
  locale: AppLocale;
  title: string;
  summary: TreasurySummary;
  accounts: TreasuryAccount[];
  transactions: TreasuryTransaction[];
}) {
  const isArabic = locale === "ar";
  const t = dictionary(locale);

  const accountRows = accounts
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.code)}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(accountTypeLabel(item.account_type, locale))}</td>
          <td>${escapeHtml(formatMoney(item.current_balance))}</td>
        </tr>`,
    )
    .join("");

  const transactionRows = transactions
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(formatDate(item.transaction_date, locale))}</td>
          <td>${escapeHtml(item.transaction_number)}</td>
          <td>${escapeHtml(transactionTypeLabel(item.transaction_type, locale))}</td>
          <td>${escapeHtml(formatMoney(item.amount))}</td>
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
          .header {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 14px;
            margin-bottom: 18px;
          }
          h1 { margin: 0; font-size: 22px; font-weight: 800; }
          .meta { margin-top: 8px; color: #6b7280; font-size: 12px; }
          .badge {
            border: 1px solid #d1d5db;
            border-radius: 999px;
            padding: 5px 12px;
            font-size: 12px;
            height: fit-content;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 18px;
          }
          .box {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 10px;
          }
          .box span { color: #6b7280; display: block; font-size: 11px; }
          .box strong { display: block; margin-top: 6px; font-size: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
          th { background: #f3f4f6; font-weight: 700; }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 8px;
            text-align: ${isArabic ? "right" : "left"};
          }
          h2 { margin: 18px 0 8px; font-size: 15px; }
          @page { size: A4 landscape; margin: 12mm; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>${escapeHtml(title)}</h1>
            <div class="meta">${escapeHtml(t.printedAt)}: ${escapeHtml(new Date().toLocaleString("en-US"))}</div>
          </div>
          <div class="badge">Primey Care</div>
        </div>

        <div class="grid">
          <div class="box"><span>${escapeHtml(t.totalBalance)}</span><strong>${escapeHtml(formatMoney(summary.total_balance))}</strong></div>
          <div class="box"><span>${escapeHtml(t.totalAccounts)}</span><strong>${escapeHtml(formatNumber(summary.total_accounts))}</strong></div>
          <div class="box"><span>${escapeHtml(t.receipts)}</span><strong>${escapeHtml(formatMoney(summary.receipt_total))}</strong></div>
          <div class="box"><span>${escapeHtml(t.payments)}</span><strong>${escapeHtml(formatMoney(summary.payment_total))}</strong></div>
        </div>

        <h2>${escapeHtml(t.accountsTitle)}</h2>
        <table>
          <thead>
            <tr>
              <th>${escapeHtml(t.table.account)}</th>
              <th>${escapeHtml(t.table.account)}</th>
              <th>${escapeHtml(t.table.type)}</th>
              <th>${escapeHtml(t.table.balance)}</th>
            </tr>
          </thead>
          <tbody>${accountRows || `<tr><td colspan="4">${escapeHtml(t.emptyTitle)}</td></tr>`}</tbody>
        </table>

        <h2>${escapeHtml(t.transactionsTitle)}</h2>
        <table>
          <thead>
            <tr>
              <th>${escapeHtml(t.table.date)}</th>
              <th>${escapeHtml(t.table.number)}</th>
              <th>${escapeHtml(t.table.transactionType)}</th>
              <th>${escapeHtml(t.table.amount)}</th>
            </tr>
          </thead>
          <tbody>${transactionRows || `<tr><td colspan="4">${escapeHtml(t.emptyTitle)}</td></tr>`}</tbody>
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

export default function SystemTreasuryPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [transactions, setTransactions] = useState<TreasuryTransaction[]>([]);
  const [summary, setSummary] = useState<TreasurySummary>(DEFAULT_SUMMARY);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canView = hasAnyPermission(
    auth,
    ["treasury.view", "treasury.accounts.view", "finance.treasury.view"],
    "view",
  );

  const canCreate = hasAnyPermission(
    auth,
    ["treasury.create", "treasury.transactions.create", "finance.treasury.create"],
    "action",
  );

  const canEdit = hasAnyPermission(
    auth,
    ["treasury.edit", "treasury.settings", "finance.treasury.edit"],
    "action",
  );

  const canExport = hasAnyPermission(
    auth,
    ["treasury.export", "reports.export"],
    "action",
  );

  const canPrint = hasAnyPermission(
    auth,
    ["treasury.print", "reports.print"],
    "action",
  );

  const shortcuts: Shortcut[] = useMemo(
    () => [
      {
        titleAr: "حسابات الخزينة",
        titleEn: "Treasury Accounts",
        descriptionAr: "إدارة أرصدة وحسابات الخزينة.",
        descriptionEn: "Manage treasury accounts and balances.",
        href: "/system/treasury/accounts",
        icon: <Landmark className="h-5 w-5" />,
        permission: "view",
      },
      {
        titleAr: "إنشاء حساب خزينة",
        titleEn: "Create Treasury Account",
        descriptionAr: "إضافة صندوق أو حساب بنكي جديد.",
        descriptionEn: "Add a cashbox or bank account.",
        href: "/system/treasury/accounts/create",
        icon: <PlusCircle className="h-5 w-5" />,
        permission: "create",
      },
      {
        titleAr: "الصناديق النقدية",
        titleEn: "Cashboxes",
        descriptionAr: "عرض وإدارة الصناديق النقدية.",
        descriptionEn: "View and manage cashboxes.",
        href: "/system/treasury/cashboxes",
        icon: <Banknote className="h-5 w-5" />,
        permission: "view",
      },
      {
        titleAr: "الحسابات البنكية",
        titleEn: "Bank Accounts",
        descriptionAr: "عرض وإدارة الحسابات البنكية.",
        descriptionEn: "View and manage bank accounts.",
        href: "/system/treasury/banks",
        icon: <Building2 className="h-5 w-5" />,
        permission: "view",
      },
      {
        titleAr: "الحركات المالية",
        titleEn: "Transactions",
        descriptionAr: "مراجعة جميع حركات القبض والصرف.",
        descriptionEn: "Review receipt and payment transactions.",
        href: "/system/treasury/transactions",
        icon: <CreditCard className="h-5 w-5" />,
        permission: "view",
      },
      {
        titleAr: "إضافة حركة مالية",
        titleEn: "Create Transaction",
        descriptionAr: "تسجيل حركة مالية جديدة.",
        descriptionEn: "Record a new treasury transaction.",
        href: "/system/treasury/transactions/create",
        icon: <PlusCircle className="h-5 w-5" />,
        permission: "create",
      },
      {
        titleAr: "السندات المالية",
        titleEn: "Financial Vouchers",
        descriptionAr: "عرض سندات القبض والصرف.",
        descriptionEn: "View receipt and payment vouchers.",
        href: "/system/treasury/vouchers",
        icon: <ReceiptText className="h-5 w-5" />,
        permission: "view",
      },
      {
        titleAr: "سند قبض",
        titleEn: "Receipt Voucher",
        descriptionAr: "إنشاء سند قبض جديد.",
        descriptionEn: "Create a new receipt voucher.",
        href: "/system/treasury/vouchers/receipt",
        icon: <PlusCircle className="h-5 w-5" />,
        permission: "create",
      },
      {
        titleAr: "سند صرف",
        titleEn: "Payment Voucher",
        descriptionAr: "إنشاء سند صرف جديد.",
        descriptionEn: "Create a new payment voucher.",
        href: "/system/treasury/vouchers/payment",
        icon: <Banknote className="h-5 w-5" />,
        permission: "create",
      },
      {
        titleAr: "التحويلات",
        titleEn: "Transfers",
        descriptionAr: "إدارة التحويلات بين الحسابات.",
        descriptionEn: "Manage transfers between accounts.",
        href: "/system/treasury/transfers",
        icon: <ArrowLeftRight className="h-5 w-5" />,
        permission: "view",
      },
      {
        titleAr: "كشف الحساب",
        titleEn: "Statement",
        descriptionAr: "عرض كشف حساب الخزينة العام.",
        descriptionEn: "View treasury account statement.",
        href: "/system/treasury/statement",
        icon: <FileText className="h-5 w-5" />,
        permission: "view",
      },
      {
        titleAr: "تقارير الخزينة",
        titleEn: "Treasury Reports",
        descriptionAr: "تحليل ومراجعة تقارير الخزينة.",
        descriptionEn: "Analyze treasury reports.",
        href: "/system/treasury/reports",
        icon: <BarChart3 className="h-5 w-5" />,
        permission: "reports",
      },
      {
        titleAr: "إعدادات الخزينة",
        titleEn: "Treasury Settings",
        descriptionAr: "إعدادات الحسابات والترحيل.",
        descriptionEn: "Treasury and posting settings.",
        href: "/system/treasury/settings",
        icon: <Settings className="h-5 w-5" />,
        permission: "edit",
      },
    ],
    [],
  );

  const visibleShortcuts = useMemo(
    () =>
      shortcuts.filter((item) => {
        if (item.permission === "view") return canView;
        if (item.permission === "create") return canCreate;
        if (item.permission === "edit") return canEdit;
        if (item.permission === "reports") return canView || canExport;

        return true;
      }),
    [canCreate, canEdit, canExport, canView, shortcuts],
  );

  const filteredAccounts = useMemo(() => {
    const clean = query.trim().toLowerCase();

    const sorted = [...accounts].sort(
      (a, b) => b.current_balance - a.current_balance,
    );

    if (!clean) return sorted.slice(0, 8);

    return sorted
      .filter((item) =>
        [
          item.name,
          item.code,
          accountTypeLabel(item.account_type, locale),
          statusLabel(item.status, locale),
        ]
          .join(" ")
          .toLowerCase()
          .includes(clean),
      )
      .slice(0, 8);
  }, [accounts, locale, query]);

  const filteredTransactions = useMemo(() => {
    const clean = query.trim().toLowerCase();

    const sorted = [...transactions].sort((a, b) =>
      String(b.transaction_date).localeCompare(String(a.transaction_date)),
    );

    if (!clean) return sorted.slice(0, 8);

    return sorted
      .filter((item) =>
        [
          item.transaction_number,
          item.account_name,
          item.description,
          transactionTypeLabel(item.transaction_type, locale),
          statusLabel(item.status, locale),
        ]
          .join(" ")
          .toLowerCase()
          .includes(clean),
      )
      .slice(0, 8);
  }, [locale, query, transactions]);

  const hasData = accounts.length > 0 || transactions.length > 0;
  const hasSearch = query.trim().length > 0;

  const loadTreasury = useCallback(
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

        const [accountsPayload, transactionsPayload, summaryPayload] =
          await Promise.all([
            loadFirstAvailable([
              "/api/treasury/accounts/?page_size=500",
              "/api/treasury/accounts/list/?page_size=500",
              "/api/treasury/?page_size=500",
            ]),
            loadFirstAvailable([
              "/api/treasury/transactions/?page_size=500",
              "/api/treasury/transactions/list/?page_size=500",
            ]),
            loadFirstAvailable([
              "/api/treasury/reports/summary/",
              "/api/treasury/summary/",
            ]),
          ]);

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
          buildSummary(normalizedAccounts, normalizedTransactions, {
            ...extractSummary(accountsPayload),
            ...extractSummary(transactionsPayload),
            ...extractSummary(summaryPayload),
          }),
        );

        if (showToast) toast.success(t.loadSuccess);
      } catch (error) {
        console.error("Treasury overview load error:", error);
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

  function exportExcel() {
    if (!canExport) return;

    if (!hasData) {
      toast.error(t.exportEmpty);
      return;
    }

    downloadExcel({
      filename: `primey-care-treasury-${new Date().toISOString().slice(0, 10)}.xls`,
      title: t.title,
      locale,
      summary,
      accounts,
      transactions,
    });

    toast.success(t.exportSuccess);
  }

  function printPage() {
    if (!canPrint) return;

    if (!hasData) {
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
        summary,
        accounts,
        transactions,
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
    loadTreasury(false);
  }, [authResolving, loadTreasury]);

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
          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadTreasury(true)}
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
              disabled={isLoading || !hasData || Boolean(errorMessage)}
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
              disabled={isLoading || !hasData || Boolean(errorMessage)}
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
              onClick={() => loadTreasury(true)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <PageSkeleton />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title={t.totalBalance}
              value={<MoneyText value={summary.total_balance} />}
              icon={<Wallet className="h-5 w-5" />}
            />
            <KpiCard
              title={t.totalAccounts}
              value={formatNumber(summary.total_accounts)}
              icon={<Landmark className="h-5 w-5" />}
            />
            <KpiCard
              title={t.receipts}
              value={<MoneyText value={summary.receipt_total} />}
              icon={<ReceiptText className="h-5 w-5" />}
            />
            <KpiCard
              title={t.payments}
              value={<MoneyText value={summary.payment_total} />}
              icon={<Banknote className="h-5 w-5" />}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MiniStat title={t.cashboxes} value={summary.cashbox_accounts} />
            <MiniStat title={t.banks} value={summary.bank_accounts} />
            <MiniStat title={t.transactions} value={summary.total_transactions} />
            <MiniStat title={t.transfers} value={summary.transfers_count} />
          </div>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">
                {t.shortcutsTitle}
              </CardTitle>
              <CardDescription>{t.shortcutsDesc}</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visibleShortcuts.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <Card className="h-full rounded-2xl border bg-background/70 shadow-sm transition hover:bg-muted/40">
                      <CardContent className="flex h-full items-start gap-3 p-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          {item.icon}
                        </div>

                        <div className="min-w-0">
                          <p className="font-semibold">
                            {isArabic ? item.titleAr : item.titleEn}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {isArabic ? item.descriptionAr : item.descriptionEn}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-4">
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
            </CardContent>
          </Card>

          {!hasData ? (
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
                <Wallet className="h-12 w-12 text-muted-foreground/40" />
                <p className="text-lg font-semibold">{t.emptyTitle}</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  {t.emptyText}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {hasData && hasSearch && filteredAccounts.length === 0 && filteredTransactions.length === 0 ? (
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
                <Search className="h-12 w-12 text-muted-foreground/40" />
                <p className="text-lg font-semibold">{t.noResultsTitle}</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  {t.noResultsText}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold">
                  {t.transactionsTitle}
                </CardTitle>
                <CardDescription>{t.transactionsDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="overflow-hidden rounded-xl border">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[120px]">
                            {t.table.date}
                          </TableHead>
                          <TableHead className="min-w-[140px]">
                            {t.table.number}
                          </TableHead>
                          <TableHead className="min-w-[130px]">
                            {t.table.transactionType}
                          </TableHead>
                          <TableHead className="min-w-[130px]">
                            {t.table.status}
                          </TableHead>
                          <TableHead className="min-w-[140px]">
                            {t.table.amount}
                          </TableHead>
                          <TableHead className="min-w-[180px]">
                            {t.table.account}
                          </TableHead>
                          <TableHead className="min-w-[90px]">
                            {t.table.action}
                          </TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {filteredTransactions.length > 0 ? (
                          filteredTransactions.map((item) => (
                            <TableRow key={`${item.id}-${item.transaction_number}`}>
                              <TableCell>
                                {formatDate(item.transaction_date, locale)}
                              </TableCell>
                              <TableCell className="font-semibold" dir="ltr">
                                {item.transaction_number}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="rounded-full">
                                  {transactionTypeLabel(item.transaction_type, locale)}
                                </Badge>
                              </TableCell>
                              <TableCell>{statusBadge(item.status, locale)}</TableCell>
                              <TableCell>
                                <MoneyText value={item.amount} />
                              </TableCell>
                              <TableCell>{item.account_name}</TableCell>
                              <TableCell>
                                {isValidId(item.id) ? (
                                  <Link href={`/system/treasury/transactions/${item.id}`}>
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
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={7} className="h-32 text-center">
                              <p className="text-sm text-muted-foreground">
                                {hasSearch ? t.noResultsText : t.emptyText}
                              </p>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold">
                  {t.accountsTitle}
                </CardTitle>
                <CardDescription>{t.accountsDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  {filteredAccounts.length > 0 ? (
                    filteredAccounts.map((item) => (
                      <Link
                        key={`${item.id}-${item.code}`}
                        href={
                          isValidId(item.id)
                            ? `/system/treasury/accounts/${item.id}`
                            : "/system/treasury/accounts"
                        }
                      >
                        <div className="rounded-2xl border bg-background/70 p-4 transition hover:bg-muted/40">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold">{item.name}</p>
                              <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                                {item.code}
                              </p>
                            </div>

                            <div className="text-end">
                              <div className="font-bold">
                                <MoneyText value={item.current_balance} />
                              </div>
                              <div className="mt-2 flex justify-end">
                                {statusBadge(item.status, locale)}
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                            <span>{accountTypeLabel(item.account_type, locale)}</span>
                            {item.is_default ? (
                              <span className="inline-flex items-center gap-1">
                                <ShieldCheck className="h-4 w-4" />
                                {locale === "ar" ? "افتراضي" : "Default"}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                      {hasSearch ? t.noResultsText : t.emptyText}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   Small Components
============================================================ */

async function loadFirstAvailable(endpoints: string[]) {
  let lastError = "";

  for (const endpoint of endpoints) {
    const response = await fetch(apiUrl(endpoint), {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    const payload = (await response.json().catch(() => null)) as
      | ApiEnvelope<unknown>
      | null;

    if (response.ok && payload?.ok !== false && payload?.success !== false) {
      return payload;
    }

    lastError =
      payload?.message ||
      payload?.detail ||
      payload?.error ||
      `HTTP ${response.status}`;
  }

  console.warn("Treasury endpoint fallback failed:", lastError);
  return null;
}

function KpiCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: ReactNode;
  icon: ReactNode;
}) {
  return (
    <Card className="rounded-2xl border bg-card shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-bold">{value}</div>
            <p className="mt-1 text-sm text-muted-foreground">{title}</p>
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ title, value }: { title: string; value: number }) {
  return (
    <Card className="rounded-2xl border bg-card shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">{title}</span>
          <span className="text-lg font-bold">{formatNumber(value)}</span>
        </div>
      </CardContent>
    </Card>
  );
}