"use client";

/* ============================================================
   📂 app/system/accounting/page.tsx
   🧠 Primey Care | Accounting Overview

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
  BarChart3,
  BookOpenCheck,
  Building2,
  Calculator,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Landmark,
  Layers3,
  ListChecks,
  Loader2,
  PieChart,
  PlusCircle,
  Printer,
  ReceiptText,
  RefreshCcw,
  Scale,
  Search,
  Settings,
  TrendingDown,
  TrendingUp,
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

type JournalStatus =
  | "DRAFT"
  | "POSTED"
  | "CONFIRMED"
  | "CANCELLED"
  | "REVERSED"
  | "UNKNOWN";

type AccountType =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "REVENUE"
  | "EXPENSE"
  | "UNKNOWN";

type JournalEntry = {
  id: string;
  entry_number: string;
  entry_date: string;
  status: JournalStatus;
  posting_source: string;
  reference: string;
  description: string;
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
  cost_center_name: string;
  created_at: string;
};

type TrialBalanceRow = {
  id: string;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  total_debit: number;
  total_credit: number;
  net_debit: number;
  net_credit: number;
};

type AccountingSummary = {
  total_accounts: number;
  total_debit: number;
  total_credit: number;
  balance_difference: number;
  total_journals: number;
  posted_journals: number;
  draft_journals: number;
  unbalanced_journals: number;
  revenue_total: number;
  expenses_total: number;
  net_profit: number;
  assets_total: number;
  liabilities_total: number;
  equity_total: number;
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
  journals?: unknown[];
  journal_entries?: unknown[];
  entries?: unknown[];
  summary?: Partial<AccountingSummary>;
};

type Shortcut = {
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  href: string;
  icon: ReactNode;
  permission: "view" | "create" | "post" | "reports" | "settings";
};

const SAR_ICON_PATH = "/currency/sar.svg";

const DEFAULT_SUMMARY: AccountingSummary = {
  total_accounts: 0,
  total_debit: 0,
  total_credit: 0,
  balance_difference: 0,
  total_journals: 0,
  posted_journals: 0,
  draft_journals: 0,
  unbalanced_journals: 0,
  revenue_total: 0,
  expenses_total: 0,
  net_profit: 0,
  assets_total: 0,
  liabilities_total: 0,
  equity_total: 0,
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
    title: isArabic ? "المحاسبة" : "Accounting",
    subtitle: isArabic
      ? "متابعة القيود، ميزان المراجعة، الأرباح والخسائر، المركز المالي، ومراكز التكلفة من لوحة واحدة."
      : "Track journals, trial balance, profit and loss, balance sheet, and cost centers from one place.",

    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",

    totalDebit: isArabic ? "إجمالي المدين" : "Total Debit",
    totalCredit: isArabic ? "إجمالي الدائن" : "Total Credit",
    balanceDifference: isArabic ? "فرق التوازن" : "Balance Difference",
    totalAccounts: isArabic ? "الحسابات" : "Accounts",
    totalJournals: isArabic ? "القيود اليومية" : "Journal Entries",
    postedJournals: isArabic ? "قيود مرحلة" : "Posted Journals",
    draftJournals: isArabic ? "قيود مسودة" : "Draft Journals",
    unbalancedJournals: isArabic ? "قيود غير متوازنة" : "Unbalanced Journals",
    netProfit: isArabic ? "صافي الربح" : "Net Profit",
    revenue: isArabic ? "الإيرادات" : "Revenue",
    expenses: isArabic ? "المصروفات" : "Expenses",
    assets: isArabic ? "الأصول" : "Assets",
    liabilities: isArabic ? "الالتزامات" : "Liabilities",
    equity: isArabic ? "حقوق الملكية" : "Equity",

    shortcutsTitle: isArabic ? "اختصارات المحاسبة" : "Accounting Shortcuts",
    shortcutsDesc: isArabic
      ? "الوصول السريع للصفحات الداخلية بعد تنظيف السايدر."
      : "Quick access to internal accounting pages after sidebar cleanup.",

    trialBalanceTitle: isArabic ? "ميزان المراجعة المختصر" : "Trial Balance Summary",
    trialBalanceDesc: isArabic
      ? "أهم الحسابات من ميزان المراجعة حسب الحركة."
      : "Key accounts from the trial balance by movement.",
    journalsTitle: isArabic ? "آخر القيود اليومية" : "Latest Journal Entries",
    journalsDesc: isArabic
      ? "أحدث القيود المسجلة في النظام."
      : "Latest accounting journals recorded in the system.",

    searchPlaceholder: isArabic
      ? "ابحث في الحسابات أو القيود..."
      : "Search accounts or journals...",

    table: {
      accountCode: isArabic ? "الكود" : "Code",
      accountName: isArabic ? "الحساب" : "Account",
      type: isArabic ? "النوع" : "Type",
      debit: isArabic ? "مدين" : "Debit",
      credit: isArabic ? "دائن" : "Credit",
      netDebit: isArabic ? "صافي مدين" : "Net Debit",
      netCredit: isArabic ? "صافي دائن" : "Net Credit",
      date: isArabic ? "التاريخ" : "Date",
      number: isArabic ? "رقم القيد" : "Journal No.",
      source: isArabic ? "المصدر" : "Source",
      status: isArabic ? "الحالة" : "Status",
      amount: isArabic ? "المبلغ" : "Amount",
      costCenter: isArabic ? "مركز التكلفة" : "Cost Center",
      action: isArabic ? "الإجراء" : "Action",
    },

    asset: isArabic ? "أصول" : "Assets",
    liability: isArabic ? "التزامات" : "Liabilities",
    equityType: isArabic ? "حقوق ملكية" : "Equity",
    revenueType: isArabic ? "إيرادات" : "Revenue",
    expense: isArabic ? "مصروفات" : "Expenses",
    unknown: isArabic ? "غير محدد" : "Unknown",

    posted: isArabic ? "مرحل" : "Posted",
    confirmed: isArabic ? "مؤكد" : "Confirmed",
    draft: isArabic ? "مسودة" : "Draft",
    cancelled: isArabic ? "ملغى" : "Cancelled",
    reversed: isArabic ? "معكوس" : "Reversed",
    balanced: isArabic ? "متوازن" : "Balanced",
    unbalanced: isArabic ? "غير متوازن" : "Unbalanced",

    view: isArabic ? "عرض" : "View",

    emptyTitle: isArabic ? "لا توجد بيانات محاسبية" : "No accounting data",
    emptyText: isArabic
      ? "ستظهر البيانات بعد إنشاء الحسابات والقيود."
      : "Accounting data will appear after creating accounts and journals.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير كلمات البحث."
      : "Try changing your search terms.",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض المحاسبة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض المحاسبة. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view accounting. Contact your system administrator if you need access.",

    loadError: isArabic
      ? "تعذر تحميل بيانات المحاسبة."
      : "Unable to load accounting data.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    loadSuccess: isArabic
      ? "تم تحديث بيانات المحاسبة."
      : "Accounting data refreshed.",

    exportSuccess: isArabic ? "تم تجهيز ملف Excel." : "Excel file prepared.",
    exportEmpty: isArabic
      ? "لا توجد بيانات قابلة للتصدير."
      : "No data available to export.",
    printSuccess: isArabic
      ? "تم تجهيز نافذة الطباعة."
      : "Print window prepared.",
    printError: isArabic
      ? "تعذر فتح نافذة الطباعة."
      : "Unable to open print window.",

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

  for (const container of ["account", "journal", "entry", "data"]) {
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
  } as Partial<AccountingSummary>;
}

function normalizeAccountType(value: unknown): AccountType {
  const clean = String(value || "").toUpperCase();

  if (["ASSET", "ASSETS"].includes(clean)) return "ASSET";
  if (["LIABILITY", "LIABILITIES"].includes(clean)) return "LIABILITY";
  if (["EQUITY"].includes(clean)) return "EQUITY";
  if (["REVENUE", "INCOME"].includes(clean)) return "REVENUE";
  if (["EXPENSE", "EXPENSES"].includes(clean)) return "EXPENSE";

  return "UNKNOWN";
}

function normalizeJournalStatus(value: unknown): JournalStatus {
  const clean = String(value || "").toUpperCase();

  if (["DRAFT", "PENDING", "NEW"].includes(clean)) return "DRAFT";
  if (["POSTED"].includes(clean)) return "POSTED";
  if (["CONFIRMED", "APPROVED"].includes(clean)) return "CONFIRMED";
  if (["CANCELLED", "CANCELED", "VOID"].includes(clean)) return "CANCELLED";
  if (["REVERSED"].includes(clean)) return "REVERSED";

  return "UNKNOWN";
}

function normalizeTrialRow(item: unknown, index: number): TrialBalanceRow {
  const obj = asDict(item);

  return {
    id: String(
      getNestedValue(obj, ["id", "account_id", "uuid", "pk"]) || `${index}`,
    ),
    account_code: String(
      getNestedValue(obj, ["account_code", "code", "number"]) || "-",
    ),
    account_name: String(
      getNestedValue(obj, ["account_name", "name", "title"]) || "-",
    ),
    account_type: normalizeAccountType(
      getNestedValue(obj, ["account_type", "type", "kind"]),
    ),
    total_debit: toNumber(getNestedValue(obj, ["total_debit", "debit"])),
    total_credit: toNumber(getNestedValue(obj, ["total_credit", "credit"])),
    net_debit: toNumber(getNestedValue(obj, ["net_debit"])),
    net_credit: toNumber(getNestedValue(obj, ["net_credit"])),
  };
}

function normalizeJournal(item: unknown, index: number): JournalEntry {
  const obj = asDict(item);
  const costCenter = asDict(obj.cost_center);

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || `${index}`),
    entry_number: String(
      getNestedValue(obj, ["entry_number", "journal_number", "number", "code"]) ||
        "-",
    ),
    entry_date: String(
      getNestedValue(obj, ["entry_date", "journal_date", "date", "created_at"]) ||
        "",
    ),
    status: normalizeJournalStatus(getNestedValue(obj, ["status", "state"])),
    posting_source: String(
      getNestedValue(obj, ["posting_source", "source", "type"]) || "-",
    ),
    reference: String(
      getNestedValue(obj, ["reference", "external_reference", "ref"]) || "",
    ),
    description: String(
      getNestedValue(obj, ["description", "notes", "memo"]) || "",
    ),
    total_debit: toNumber(getNestedValue(obj, ["total_debit", "debit"])),
    total_credit: toNumber(getNestedValue(obj, ["total_credit", "credit"])),
    is_balanced: Boolean(
      getNestedValue(obj, ["is_balanced", "balanced"]) ??
        (toNumber(getNestedValue(obj, ["total_debit"])) ===
          toNumber(getNestedValue(obj, ["total_credit"]))),
    ),
    cost_center_name: String(
      costCenter.name || getNestedValue(obj, ["cost_center_name"]) || "",
    ),
    created_at: String(getNestedValue(obj, ["created_at", "created"]) || ""),
  };
}

function buildSummary({
  trialRows,
  journals,
  trialPayload,
  profitLossPayload,
  balanceSheetPayload,
}: {
  trialRows: TrialBalanceRow[];
  journals: JournalEntry[];
  trialPayload?: Partial<AccountingSummary>;
  profitLossPayload?: ApiEnvelope<unknown> | null;
  balanceSheetPayload?: ApiEnvelope<unknown> | null;
}): AccountingSummary {
  const trialData = asDict(trialPayload);
  const profitData = asDict(profitLossPayload?.data);
  const balanceData = asDict(balanceSheetPayload?.data);

  const revenue = asDict(profitData.revenue);
  const expenses = asDict(profitData.expenses);
  const assets = asDict(balanceData.assets);
  const liabilities = asDict(balanceData.liabilities);
  const equity = asDict(balanceData.equity);

  const totalDebit =
    toNumber(trialData.total_debit) ||
    trialRows.reduce((sum, item) => sum + item.total_debit, 0);

  const totalCredit =
    toNumber(trialData.total_credit) ||
    trialRows.reduce((sum, item) => sum + item.total_credit, 0);

  return {
    total_accounts:
      toNumber(trialData.total_accounts) ||
      toNumber(trialData.accounts_count) ||
      trialRows.length,
    total_debit: totalDebit,
    total_credit: totalCredit,
    balance_difference: Math.abs(totalDebit - totalCredit),
    total_journals: journals.length,
    posted_journals: journals.filter((item) =>
      ["POSTED", "CONFIRMED"].includes(item.status),
    ).length,
    draft_journals: journals.filter((item) => item.status === "DRAFT").length,
    unbalanced_journals: journals.filter((item) => !item.is_balanced).length,
    revenue_total:
      toNumber(revenue.total_amount) ||
      trialRows
        .filter((item) => item.account_type === "REVENUE")
        .reduce((sum, item) => sum + Math.max(item.total_credit - item.total_debit, 0), 0),
    expenses_total:
      toNumber(expenses.total_amount) ||
      trialRows
        .filter((item) => item.account_type === "EXPENSE")
        .reduce((sum, item) => sum + Math.max(item.total_debit - item.total_credit, 0), 0),
    net_profit: toNumber(profitData.net_profit),
    assets_total:
      toNumber(assets.total_amount) ||
      trialRows
        .filter((item) => item.account_type === "ASSET")
        .reduce((sum, item) => sum + Math.max(item.total_debit - item.total_credit, 0), 0),
    liabilities_total:
      toNumber(liabilities.total_amount) ||
      trialRows
        .filter((item) => item.account_type === "LIABILITY")
        .reduce((sum, item) => sum + Math.max(item.total_credit - item.total_debit, 0), 0),
    equity_total:
      toNumber(equity.total_amount) ||
      trialRows
        .filter((item) => item.account_type === "EQUITY")
        .reduce((sum, item) => sum + Math.max(item.total_credit - item.total_debit, 0), 0),
  };
}

function accountTypeLabel(type: AccountType, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<AccountType, string> = {
    ASSET: t.asset,
    LIABILITY: t.liability,
    EQUITY: t.equityType,
    REVENUE: t.revenueType,
    EXPENSE: t.expense,
    UNKNOWN: t.unknown,
  };

  return labels[type];
}

function journalStatusLabel(status: JournalStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<JournalStatus, string> = {
    DRAFT: t.draft,
    POSTED: t.posted,
    CONFIRMED: t.confirmed,
    CANCELLED: t.cancelled,
    REVERSED: t.reversed,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function journalStatusBadge(status: JournalStatus, locale: AppLocale) {
  const label = journalStatusLabel(status, locale);

  if (status === "POSTED" || status === "CONFIRMED") {
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

  if (status === "CANCELLED" || status === "REVERSED") {
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

      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardContent className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <SkeletonLine key={index} className="h-24 w-full rounded-2xl" />
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
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
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonLine key={index} className="h-12 w-full rounded-xl" />
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
  trialRows,
  journals,
}: {
  filename: string;
  title: string;
  locale: AppLocale;
  summary: AccountingSummary;
  trialRows: TrialBalanceRow[];
  journals: JournalEntry[];
}) {
  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const align = isArabic ? "right" : "left";
  const t = dictionary(locale);

  const trialHtml = trialRows
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.account_code)}</td>
          <td>${escapeHtml(item.account_name)}</td>
          <td>${escapeHtml(accountTypeLabel(item.account_type, locale))}</td>
          <td>${escapeHtml(formatMoney(item.total_debit))}</td>
          <td>${escapeHtml(formatMoney(item.total_credit))}</td>
          <td>${escapeHtml(formatMoney(item.net_debit))}</td>
          <td>${escapeHtml(formatMoney(item.net_credit))}</td>
        </tr>`,
    )
    .join("");

  const journalsHtml = journals
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(formatDate(item.entry_date, locale))}</td>
          <td>${escapeHtml(item.entry_number)}</td>
          <td>${escapeHtml(journalStatusLabel(item.status, locale))}</td>
          <td>${escapeHtml(item.posting_source || "-")}</td>
          <td>${escapeHtml(formatMoney(item.total_debit))}</td>
          <td>${escapeHtml(formatMoney(item.total_credit))}</td>
          <td>${escapeHtml(item.cost_center_name || "-")}</td>
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
          <tr><td class="summary-label">${escapeHtml(t.totalDebit)}</td><td colspan="6">${escapeHtml(formatMoney(summary.total_debit))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalCredit)}</td><td colspan="6">${escapeHtml(formatMoney(summary.total_credit))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.balanceDifference)}</td><td colspan="6">${escapeHtml(formatMoney(summary.balance_difference))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.netProfit)}</td><td colspan="6">${escapeHtml(formatMoney(summary.net_profit))}</td></tr>

          <tr><td colspan="7"></td></tr>
          <tr><td class="section" colspan="7">${escapeHtml(t.trialBalanceTitle)}</td></tr>
          <tr>
            <th>${escapeHtml(t.table.accountCode)}</th>
            <th>${escapeHtml(t.table.accountName)}</th>
            <th>${escapeHtml(t.table.type)}</th>
            <th>${escapeHtml(t.table.debit)}</th>
            <th>${escapeHtml(t.table.credit)}</th>
            <th>${escapeHtml(t.table.netDebit)}</th>
            <th>${escapeHtml(t.table.netCredit)}</th>
          </tr>
          ${trialHtml}

          <tr><td colspan="7"></td></tr>
          <tr><td class="section" colspan="7">${escapeHtml(t.journalsTitle)}</td></tr>
          <tr>
            <th>${escapeHtml(t.table.date)}</th>
            <th>${escapeHtml(t.table.number)}</th>
            <th>${escapeHtml(t.table.status)}</th>
            <th>${escapeHtml(t.table.source)}</th>
            <th>${escapeHtml(t.table.debit)}</th>
            <th>${escapeHtml(t.table.credit)}</th>
            <th>${escapeHtml(t.table.costCenter)}</th>
          </tr>
          ${journalsHtml}
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
  trialRows,
  journals,
}: {
  locale: AppLocale;
  title: string;
  summary: AccountingSummary;
  trialRows: TrialBalanceRow[];
  journals: JournalEntry[];
}) {
  const isArabic = locale === "ar";
  const t = dictionary(locale);

  const trialHtml = trialRows
    .slice(0, 10)
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.account_code)}</td>
          <td>${escapeHtml(item.account_name)}</td>
          <td>${escapeHtml(formatMoney(item.total_debit))}</td>
          <td>${escapeHtml(formatMoney(item.total_credit))}</td>
        </tr>`,
    )
    .join("");

  const journalsHtml = journals
    .slice(0, 10)
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(formatDate(item.entry_date, locale))}</td>
          <td>${escapeHtml(item.entry_number)}</td>
          <td>${escapeHtml(journalStatusLabel(item.status, locale))}</td>
          <td>${escapeHtml(formatMoney(item.total_debit))}</td>
          <td>${escapeHtml(formatMoney(item.total_credit))}</td>
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
          <div class="box"><span>${escapeHtml(t.totalDebit)}</span><strong>${escapeHtml(formatMoney(summary.total_debit))}</strong></div>
          <div class="box"><span>${escapeHtml(t.totalCredit)}</span><strong>${escapeHtml(formatMoney(summary.total_credit))}</strong></div>
          <div class="box"><span>${escapeHtml(t.balanceDifference)}</span><strong>${escapeHtml(formatMoney(summary.balance_difference))}</strong></div>
          <div class="box"><span>${escapeHtml(t.netProfit)}</span><strong>${escapeHtml(formatMoney(summary.net_profit))}</strong></div>
        </div>

        <h2>${escapeHtml(t.trialBalanceTitle)}</h2>
        <table>
          <thead>
            <tr>
              <th>${escapeHtml(t.table.accountCode)}</th>
              <th>${escapeHtml(t.table.accountName)}</th>
              <th>${escapeHtml(t.table.debit)}</th>
              <th>${escapeHtml(t.table.credit)}</th>
            </tr>
          </thead>
          <tbody>${trialHtml || `<tr><td colspan="4">${escapeHtml(t.emptyTitle)}</td></tr>`}</tbody>
        </table>

        <h2>${escapeHtml(t.journalsTitle)}</h2>
        <table>
          <thead>
            <tr>
              <th>${escapeHtml(t.table.date)}</th>
              <th>${escapeHtml(t.table.number)}</th>
              <th>${escapeHtml(t.table.status)}</th>
              <th>${escapeHtml(t.table.debit)}</th>
              <th>${escapeHtml(t.table.credit)}</th>
            </tr>
          </thead>
          <tbody>${journalsHtml || `<tr><td colspan="5">${escapeHtml(t.emptyTitle)}</td></tr>`}</tbody>
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

export default function SystemAccountingPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [trialRows, setTrialRows] = useState<TrialBalanceRow[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [summary, setSummary] = useState<AccountingSummary>(DEFAULT_SUMMARY);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canView = hasAnyPermission(
    auth,
    ["accounting.view", "finance.accounting.view"],
    "view",
  );

  const canCreate = hasAnyPermission(
    auth,
    ["accounting.create", "accounting.journals.create"],
    "action",
  );

  const canPost = hasAnyPermission(
    auth,
    ["accounting.post", "accounting.journals.post"],
    "action",
  );

  const canReports = hasAnyPermission(
    auth,
    ["accounting.reports.view", "reports.accounting.view", "reports.view"],
    "view",
  );

  const canSettings = hasAnyPermission(
    auth,
    ["accounting.settings", "accounting.edit"],
    "action",
  );

  const canExport = hasAnyPermission(
    auth,
    ["accounting.export", "reports.export"],
    "action",
  );

  const canPrint = hasAnyPermission(
    auth,
    ["accounting.print", "reports.print"],
    "action",
  );

  const shortcuts: Shortcut[] = useMemo(
    () => [
      {
        titleAr: "دليل الحسابات",
        titleEn: "Chart of Accounts",
        descriptionAr: "عرض الحسابات الرئيسية والفرعية.",
        descriptionEn: "View parent and child accounts.",
        href: "/system/accounting/accounts",
        icon: <Layers3 className="h-5 w-5" />,
        permission: "view",
      },
      {
        titleAr: "إنشاء حساب محاسبي",
        titleEn: "Create Account",
        descriptionAr: "إضافة حساب جديد داخل دليل الحسابات.",
        descriptionEn: "Add a new account to the chart.",
        href: "/system/accounting/accounts/create",
        icon: <PlusCircle className="h-5 w-5" />,
        permission: "create",
      },
      {
        titleAr: "القيود اليومية",
        titleEn: "Journal Entries",
        descriptionAr: "مراجعة القيود المحاسبية وترحيلها.",
        descriptionEn: "Review and post journal entries.",
        href: "/system/accounting/journals",
        icon: <ReceiptText className="h-5 w-5" />,
        permission: "view",
      },
      {
        titleAr: "إنشاء قيد يومية",
        titleEn: "Create Journal Entry",
        descriptionAr: "إدخال قيد محاسبي يدوي.",
        descriptionEn: "Create a manual journal entry.",
        href: "/system/accounting/journals/create",
        icon: <PlusCircle className="h-5 w-5" />,
        permission: "create",
      },
      {
        titleAr: "مراكز التكلفة",
        titleEn: "Cost Centers",
        descriptionAr: "إدارة مراكز التكلفة والتحليل.",
        descriptionEn: "Manage cost centers and analysis.",
        href: "/system/accounting/cost-centers",
        icon: <Landmark className="h-5 w-5" />,
        permission: "view",
      },
      {
        titleAr: "إنشاء مركز تكلفة",
        titleEn: "Create Cost Center",
        descriptionAr: "إضافة مركز تكلفة جديد.",
        descriptionEn: "Add a new cost center.",
        href: "/system/accounting/cost-centers/create",
        icon: <PlusCircle className="h-5 w-5" />,
        permission: "create",
      },
      {
        titleAr: "قواعد التوجيه المحاسبي",
        titleEn: "Accounting Routing Rules",
        descriptionAr: "ضبط قواعد الترحيل المحاسبي الآلي.",
        descriptionEn: "Configure automatic accounting routing.",
        href: "/system/accounting/routing-rules",
        icon: <ArrowLeftRight className="h-5 w-5" />,
        permission: "settings",
      },
      {
        titleAr: "السنوات المالية",
        titleEn: "Fiscal Years",
        descriptionAr: "إدارة السنوات المالية.",
        descriptionEn: "Manage fiscal years.",
        href: "/system/accounting/fiscal-years",
        icon: <BookOpenCheck className="h-5 w-5" />,
        permission: "view",
      },
      {
        titleAr: "إنشاء سنة مالية",
        titleEn: "Create Fiscal Year",
        descriptionAr: "إضافة سنة مالية جديدة.",
        descriptionEn: "Create a new fiscal year.",
        href: "/system/accounting/fiscal-years/create",
        icon: <PlusCircle className="h-5 w-5" />,
        permission: "create",
      },
      {
        titleAr: "الفترات المحاسبية",
        titleEn: "Accounting Periods",
        descriptionAr: "إدارة الفترات المحاسبية والإغلاق.",
        descriptionEn: "Manage accounting periods and closing.",
        href: "/system/accounting/periods",
        icon: <ListChecks className="h-5 w-5" />,
        permission: "view",
      },
      {
        titleAr: "إنشاء فترة محاسبية",
        titleEn: "Create Accounting Period",
        descriptionAr: "إضافة فترة محاسبية جديدة.",
        descriptionEn: "Create a new accounting period.",
        href: "/system/accounting/periods/create",
        icon: <PlusCircle className="h-5 w-5" />,
        permission: "create",
      },
      {
        titleAr: "تقارير المحاسبة",
        titleEn: "Accounting Reports",
        descriptionAr: "الوصول لتقارير المحاسبة التشغيلية.",
        descriptionEn: "Open operational accounting reports.",
        href: "/system/accounting/reports",
        icon: <BarChart3 className="h-5 w-5" />,
        permission: "reports",
      },
      {
        titleAr: "الضرائب",
        titleEn: "Taxes",
        descriptionAr: "إدارة إعدادات وقيود الضريبة.",
        descriptionEn: "Manage tax settings and entries.",
        href: "/system/accounting/taxes",
        icon: <PieChart className="h-5 w-5" />,
        permission: "settings",
      },
      {
        titleAr: "الأصول الثابتة",
        titleEn: "Fixed Assets",
        descriptionAr: "متابعة الأصول الثابتة والاستهلاك.",
        descriptionEn: "Track fixed assets and depreciation.",
        href: "/system/accounting/fixed-assets",
        icon: <Building2 className="h-5 w-5" />,
        permission: "view",
      },
      {
        titleAr: "دفتر الأستاذ",
        titleEn: "General Ledger",
        descriptionAr: "عرض حركات دفتر الأستاذ العام.",
        descriptionEn: "View general ledger movements.",
        href: "/system/accounting/ledger",
        icon: <BookOpenCheck className="h-5 w-5" />,
        permission: "reports",
      },
      {
        titleAr: "ميزان المراجعة",
        titleEn: "Trial Balance",
        descriptionAr: "عرض أرصدة الحسابات المدينة والدائنة.",
        descriptionEn: "View debit and credit account balances.",
        href: "/system/accounting/trial-balance",
        icon: <Scale className="h-5 w-5" />,
        permission: "reports",
      },
      {
        titleAr: "الأرباح والخسائر",
        titleEn: "Profit & Loss",
        descriptionAr: "تحليل الإيرادات والمصروفات.",
        descriptionEn: "Analyze revenue and expenses.",
        href: "/system/accounting/profit-loss",
        icon: <TrendingUp className="h-5 w-5" />,
        permission: "reports",
      },
      {
        titleAr: "المركز المالي",
        titleEn: "Balance Sheet",
        descriptionAr: "عرض الأصول والالتزامات وحقوق الملكية.",
        descriptionEn: "View assets, liabilities, and equity.",
        href: "/system/accounting/balance-sheet",
        icon: <Calculator className="h-5 w-5" />,
        permission: "reports",
      },
    ],
    [],
  );

  const visibleShortcuts = useMemo(
    () =>
      shortcuts.filter((item) => {
        if (item.permission === "view") return canView;
        if (item.permission === "create") return canCreate;
        if (item.permission === "post") return canPost;
        if (item.permission === "reports") return canReports || canExport;
        if (item.permission === "settings") return canSettings;

        return true;
      }),
    [canCreate, canExport, canPost, canReports, canSettings, canView, shortcuts],
  );

  const filteredTrialRows = useMemo(() => {
    const clean = query.trim().toLowerCase();

    const sorted = [...trialRows].sort(
      (a, b) =>
        b.total_debit +
        b.total_credit -
        (a.total_debit + a.total_credit),
    );

    if (!clean) return sorted.slice(0, 8);

    return sorted
      .filter((item) =>
        [
          item.account_code,
          item.account_name,
          accountTypeLabel(item.account_type, locale),
        ]
          .join(" ")
          .toLowerCase()
          .includes(clean),
      )
      .slice(0, 8);
  }, [locale, query, trialRows]);

  const filteredJournals = useMemo(() => {
    const clean = query.trim().toLowerCase();

    const sorted = [...journals].sort((a, b) =>
      String(b.entry_date || b.created_at).localeCompare(
        String(a.entry_date || a.created_at),
      ),
    );

    if (!clean) return sorted.slice(0, 8);

    return sorted
      .filter((item) =>
        [
          item.entry_number,
          item.posting_source,
          item.reference,
          item.description,
          item.cost_center_name,
          journalStatusLabel(item.status, locale),
        ]
          .join(" ")
          .toLowerCase()
          .includes(clean),
      )
      .slice(0, 8);
  }, [journals, locale, query]);

  const hasData = trialRows.length > 0 || journals.length > 0;
  const hasSearch = query.trim().length > 0;

  const loadAccounting = useCallback(
    async (showToast = false) => {
      if (!canView) {
        setTrialRows([]);
        setJournals([]);
        setSummary(DEFAULT_SUMMARY);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");

        const [trialPayload, journalsPayload, profitPayload, balancePayload] =
          await Promise.all([
            loadFirstAvailable([
              "/api/accounting/reports/trial-balance/",
              "/api/accounting/trial-balance/",
            ]),
            loadFirstAvailable([
              "/api/accounting/journals/?page_size=500",
              "/api/accounting/journal-entries/?page_size=500",
              "/api/accounting/journals/list/?page_size=500",
            ]),
            loadFirstAvailable([
              "/api/accounting/reports/profit-loss/",
              "/api/accounting/profit-loss/",
            ]),
            loadFirstAvailable([
              "/api/accounting/reports/balance-sheet/",
              "/api/accounting/balance-sheet/",
            ]),
          ]);

        const normalizedTrialRows = extractRows(trialPayload, "rows")
          .map(normalizeTrialRow)
          .filter((item) => item.account_code || item.account_name);

        const normalizedJournals = [
          ...extractRows(journalsPayload, "journals"),
          ...extractRows(journalsPayload, "journal_entries"),
          ...extractRows(journalsPayload, "entries"),
        ]
          .map(normalizeJournal)
          .filter((item) => item.id || item.entry_number);

        setTrialRows(normalizedTrialRows);
        setJournals(normalizedJournals);
        setSummary(
          buildSummary({
            trialRows: normalizedTrialRows,
            journals: normalizedJournals,
            trialPayload: extractSummary(trialPayload),
            profitLossPayload: profitPayload,
            balanceSheetPayload: balancePayload,
          }),
        );

        if (showToast) toast.success(t.loadSuccess);
      } catch (error) {
        console.error("Accounting overview load error:", error);
        setTrialRows([]);
        setJournals([]);
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
      filename: `primey-care-accounting-${new Date().toISOString().slice(0, 10)}.xls`,
      title: t.title,
      locale,
      summary,
      trialRows,
      journals,
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
        trialRows,
        journals,
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
    loadAccounting(false);
  }, [authResolving, loadAccounting]);

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
            onClick={() => loadAccounting(true)}
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
              onClick={() => loadAccounting(true)}
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
              title={t.totalDebit}
              value={<MoneyText value={summary.total_debit} />}
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <KpiCard
              title={t.totalCredit}
              value={<MoneyText value={summary.total_credit} />}
              icon={<TrendingDown className="h-5 w-5" />}
            />
            <KpiCard
              title={t.balanceDifference}
              value={<MoneyText value={summary.balance_difference} />}
              icon={<Scale className="h-5 w-5" />}
            />
            <KpiCard
              title={t.netProfit}
              value={<MoneyText value={summary.net_profit} />}
              icon={<PieChart className="h-5 w-5" />}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MiniStat title={t.totalAccounts} value={summary.total_accounts} />
            <MiniStat title={t.totalJournals} value={summary.total_journals} />
            <MiniStat title={t.postedJournals} value={summary.posted_journals} />
            <MiniStat
              title={t.unbalancedJournals}
              value={summary.unbalanced_journals}
            />
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
                <Calculator className="h-12 w-12 text-muted-foreground/40" />
                <p className="text-lg font-semibold">{t.emptyTitle}</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  {t.emptyText}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {hasData &&
          hasSearch &&
          filteredTrialRows.length === 0 &&
          filteredJournals.length === 0 ? (
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
                  {t.journalsTitle}
                </CardTitle>
                <CardDescription>{t.journalsDesc}</CardDescription>
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
                            {t.table.status}
                          </TableHead>
                          <TableHead className="min-w-[150px]">
                            {t.table.source}
                          </TableHead>
                          <TableHead className="min-w-[130px]">
                            {t.table.debit}
                          </TableHead>
                          <TableHead className="min-w-[130px]">
                            {t.table.credit}
                          </TableHead>
                          <TableHead className="min-w-[90px]">
                            {t.table.action}
                          </TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {filteredJournals.length > 0 ? (
                          filteredJournals.map((item) => (
                            <TableRow key={`${item.id}-${item.entry_number}`}>
                              <TableCell>
                                {formatDate(item.entry_date, locale)}
                              </TableCell>
                              <TableCell className="font-semibold" dir="ltr">
                                {item.entry_number}
                              </TableCell>
                              <TableCell>
                                {journalStatusBadge(item.status, locale)}
                              </TableCell>
                              <TableCell>{item.posting_source || "-"}</TableCell>
                              <TableCell>
                                <MoneyText value={item.total_debit} />
                              </TableCell>
                              <TableCell>
                                <MoneyText value={item.total_credit} />
                              </TableCell>
                              <TableCell>
                                {isValidId(item.id) ? (
                                  <Link href={`/system/accounting/journals/${item.id}`}>
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
                  {t.trialBalanceTitle}
                </CardTitle>
                <CardDescription>{t.trialBalanceDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  {filteredTrialRows.length > 0 ? (
                    filteredTrialRows.map((item) => (
                      <Link
                        key={`${item.id}-${item.account_code}`}
                        href={
                          isValidId(item.id)
                            ? `/system/accounting/accounts/${item.id}`
                            : "/system/accounting/accounts"
                        }
                      >
                        <div className="rounded-2xl border bg-background/70 p-4 transition hover:bg-muted/40">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold">
                                {item.account_name}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                                {item.account_code}
                              </p>
                            </div>

                            <Badge variant="outline" className="rounded-full">
                              {accountTypeLabel(item.account_type, locale)}
                            </Badge>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-xl bg-muted/40 p-3">
                              <p className="text-xs text-muted-foreground">
                                {t.table.debit}
                              </p>
                              <p className="mt-1 font-bold">
                                <MoneyText value={item.total_debit} />
                              </p>
                            </div>

                            <div className="rounded-xl bg-muted/40 p-3">
                              <p className="text-xs text-muted-foreground">
                                {t.table.credit}
                              </p>
                              <p className="mt-1 font-bold">
                                <MoneyText value={item.total_credit} />
                              </p>
                            </div>
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

  console.warn("Accounting endpoint fallback failed:", lastError);
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