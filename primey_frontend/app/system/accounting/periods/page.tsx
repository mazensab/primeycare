"use client";

/* ============================================================
   📂 app/system/accounting/periods/page.tsx
   🧠 Primey Care | Accounting Periods Page

   ✅ المسار:
      app/system/accounting/periods/page.tsx

   ✅ العمل:
      صفحة الفترات المحاسبية داخل مديول المحاسبة.
      تعرض الفترات المحاسبية، السنة المالية المرتبطة، حالة الفترة، الإقفال، وعدد القيود والحركات المالية.

   ✅ الإصدار:
      Phase 17 UX Refinement + Accounting Periods Build

   ✅ يعتمد على:
      - /api/accounting/periods/
      - /api/accounting/fiscal-periods/ كـ fallback آمن
      - /api/accounting/reports/periods/ كـ fallback آمن
      - primey-locale
      - AuthProvider
      - sonner
      - /currency/sar.svg

   ✅ متوافق مع:
      - Accounting fiscal years pages
      - Accounting accounts / journals / cost centers pages
      - Centers / Customers approved UX standard

   ✅ الوظائف:
      - عرض الفترات المحاسبية.
      - عرض السنة المالية المرتبطة بكل فترة.
      - عرض الحالة: مفتوحة، مغلقة، مقفلة، غير محددة.
      - بحث في صف مستقل.
      - الفلاتر والأعمدة في صف منفصل.
      - فلترة حسب الحالة والسنة المالية.
      - فرز الأعمدة.
      - صفحات محلية.
      - Excel export بصيغة .xls HTML Workbook.
      - Web PDF Print.
      - Error State مستقل.
      - Empty State ذكي.
      - Skeleton Loading.
      - صلاحيات آمنة بدون كسر system_admin/superuser.
      - أرقام إنجليزية دائمًا.
      - رمز SAR من /currency/sar.svg بعد الرقم.

   ------------------------------------------------------------
   تحسينات هذا الإصدار:
      - بناء الصفحة من الصفر لأن الملف المرفق كان تفاصيل قيد يومية وليس صفحة فترات.
      - الالتزام بالقاعدة: w-full space-y-4 بدون main/min-h-screen/max-w.
      - إزالة أي عبارات تقنية أو مؤقتة من واجهة المستخدم.
      - استخدام sonner للتنبيهات.
      - استخدام Excel HTML Workbook بدل CSV أو XLSX.
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Columns3,
  Download,
  Eye,
  Filter,
  Layers3,
  Loader2,
  LockKeyhole,
  PlusCircle,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  UnlockKeyhole,
  WalletCards,
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

type PeriodStatus = "OPEN" | "CLOSED" | "LOCKED" | "UNKNOWN";
type StatusFilter = "ALL" | PeriodStatus;
type FiscalYearFilter = "ALL" | string;

type SortKey =
  | "period_number"
  | "name"
  | "fiscal_year"
  | "start_date"
  | "end_date"
  | "status"
  | "journal_entries_count"
  | "total_debit"
  | "total_credit"
  | "created_at";

type SortDirection = "asc" | "desc";

type AccountingPeriodRow = {
  id: string;
  name: string;
  period_number: number;
  fiscal_year_id: string;
  fiscal_year: string;
  fiscal_year_name: string;
  start_date: string;
  end_date: string;
  status: PeriodStatus;
  is_closed: boolean;
  closed_at: string;
  closed_by_name: string;
  journal_entries_count: number;
  total_debit: number;
  total_credit: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

type PeriodsSummary = {
  total_periods: number;
  open_periods: number;
  closed_periods: number;
  locked_periods: number;
  fiscal_years_count: number;
  journal_entries_count: number;
  total_debit: number;
  total_credit: number;
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
  periods?: unknown[];
  fiscal_periods?: unknown[];
  accounting_periods?: unknown[];
  summary?: Partial<PeriodsSummary>;
};

type VisibleColumns = {
  number: boolean;
  name: boolean;
  fiscalYear: boolean;
  period: boolean;
  status: boolean;
  entriesCount: boolean;
  totalDebit: boolean;
  totalCredit: boolean;
  actions: boolean;
};

const SAR_ICON_PATH = "/currency/sar.svg";
const PAGE_SIZE = 16;

const DEFAULT_COLUMNS: VisibleColumns = {
  number: true,
  name: true,
  fiscalYear: true,
  period: true,
  status: true,
  entriesCount: true,
  totalDebit: true,
  totalCredit: true,
  actions: true,
};

const DEFAULT_SUMMARY: PeriodsSummary = {
  total_periods: 0,
  open_periods: 0,
  closed_periods: 0,
  locked_periods: 0,
  fiscal_years_count: 0,
  journal_entries_count: 0,
  total_debit: 0,
  total_credit: 0,
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

    if (value && typeof value === "object") {
      return value as Dict;
    }
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
    title: isArabic ? "الفترات المحاسبية" : "Accounting Periods",
    subtitle: isArabic
      ? "إدارة ومراجعة الفترات المحاسبية المرتبطة بالسنوات المالية والقيود والحركات."
      : "Manage and review accounting periods linked to fiscal years, journal entries, and movements.",

    back: isArabic ? "لوحة المحاسبة" : "Accounting Overview",
    fiscalYears: isArabic ? "السنوات المالية" : "Fiscal Years",
    reports: isArabic ? "تقارير المحاسبة" : "Accounting Reports",
    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    create: isArabic ? "إنشاء فترة" : "Create Period",

    statusTitle: isArabic ? "حالة الفترات المحاسبية" : "Accounting Periods Status",
    statusDesc: isArabic
      ? "ملخص الفترات المفتوحة والمغلقة والقيود المرتبطة."
      : "Summary of open, closed, and linked journal periods.",
    summaryTitle: isArabic ? "ملخص الفترات" : "Periods Summary",
    summaryDesc: isArabic
      ? "أهم مؤشرات الفترات المحاسبية حسب البيانات الحالية."
      : "Key indicators for current accounting period data.",

    totalPeriods: isArabic ? "إجمالي الفترات" : "Total Periods",
    openPeriods: isArabic ? "فترات مفتوحة" : "Open Periods",
    closedPeriods: isArabic ? "فترات مغلقة" : "Closed Periods",
    lockedPeriods: isArabic ? "فترات مقفلة" : "Locked Periods",
    fiscalYearsCount: isArabic ? "سنوات مالية" : "Fiscal Years",
    entriesCount: isArabic ? "القيود المرتبطة" : "Linked Entries",
    totalDebit: isArabic ? "إجمالي المدين" : "Total Debit",
    totalCredit: isArabic ? "إجمالي الدائن" : "Total Credit",

    searchPlaceholder: isArabic
      ? "ابحث باسم الفترة أو السنة المالية أو الملاحظات..."
      : "Search by period name, fiscal year, or notes...",

    filters: isArabic ? "الفلاتر" : "Filters",
    columns: isArabic ? "الأعمدة" : "Columns",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",

    allStatuses: isArabic ? "كل الحالات" : "All Statuses",
    allFiscalYears: isArabic ? "كل السنوات المالية" : "All Fiscal Years",

    open: isArabic ? "مفتوحة" : "Open",
    closed: isArabic ? "مغلقة" : "Closed",
    locked: isArabic ? "مقفلة" : "Locked",
    unknown: isArabic ? "غير محدد" : "Unknown",

    table: {
      number: isArabic ? "رقم الفترة" : "Period No.",
      name: isArabic ? "اسم الفترة" : "Period Name",
      fiscalYear: isArabic ? "السنة المالية" : "Fiscal Year",
      period: isArabic ? "الفترة" : "Period",
      status: isArabic ? "الحالة" : "Status",
      entries: isArabic ? "القيود" : "Entries",
      debit: isArabic ? "المدين" : "Debit",
      credit: isArabic ? "الدائن" : "Credit",
      action: isArabic ? "الإجراء" : "Action",
    },

    view: isArabic ? "عرض" : "View",

    emptyTitle: isArabic ? "لا توجد فترات محاسبية" : "No accounting periods",
    emptyText: isArabic
      ? "ستظهر الفترات المحاسبية هنا بعد إنشائها أو ربطها بالسنوات المالية."
      : "Accounting periods will appear here after they are created or linked to fiscal years.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير البحث أو الفلاتر."
      : "Try changing the search or filters.",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الفترات المحاسبية" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض الفترات المحاسبية. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view accounting periods. Contact your system administrator if you need access.",

    loadError: isArabic
      ? "تعذر تحميل الفترات المحاسبية."
      : "Unable to load accounting periods.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    loadSuccess: isArabic
      ? "تم تحديث الفترات المحاسبية بنجاح."
      : "Accounting periods refreshed successfully.",

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

  for (const container of [
    "period",
    "accounting_period",
    "fiscal_period",
    "fiscal_year",
    "fiscalYear",
    "year",
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

function normalizeStatus(value: unknown): PeriodStatus {
  const clean = String(value || "").toUpperCase();

  if (["OPEN", "ACTIVE"].includes(clean)) return "OPEN";
  if (["CLOSED"].includes(clean)) return "CLOSED";
  if (["LOCKED", "POSTED"].includes(clean)) return "LOCKED";

  if (typeof value === "boolean") return value ? "OPEN" : "CLOSED";

  return "UNKNOWN";
}

function extractRows(payload: ApiEnvelope<unknown> | null): unknown[] {
  if (!payload) return [];

  const data = asDict(payload.data);

  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.periods)) return payload.periods;
  if (Array.isArray(payload.fiscal_periods)) return payload.fiscal_periods;
  if (Array.isArray(payload.accounting_periods)) return payload.accounting_periods;

  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.periods)) return data.periods;
  if (Array.isArray(data.fiscal_periods)) return data.fiscal_periods;
  if (Array.isArray(data.accounting_periods)) return data.accounting_periods;

  if (Array.isArray(payload.data)) return payload.data;

  return [];
}

function extractSummary(payload: ApiEnvelope<unknown> | null) {
  if (!payload) return {};

  const data = asDict(payload.data);

  return {
    ...asDict(payload.summary),
    ...asDict(data.summary),
  } as Partial<PeriodsSummary>;
}

function normalizePeriod(item: unknown, index: number): AccountingPeriodRow {
  const obj = asDict(item);
  const fiscalYear = asDict(obj.fiscal_year || obj.fiscalYear || obj.year);

  const periodNumber = toNumber(
    getNestedValue(obj, ["period_number", "number", "month", "sequence"]),
  );

  const status = normalizeStatus(
    getNestedValue(obj, ["status", "state", "is_open", "is_closed"]),
  );

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || `${index}`),
    name: String(
      getNestedValue(obj, ["name", "title", "label", "period_name"]) ||
        `Period ${periodNumber || index + 1}`,
    ),
    period_number: periodNumber || index + 1,
    fiscal_year_id: String(
      fiscalYear.id || getNestedValue(obj, ["fiscal_year_id", "year_id"]) || "",
    ),
    fiscal_year: String(
      fiscalYear.year ||
        fiscalYear.code ||
        getNestedValue(obj, ["fiscal_year", "year", "fiscal_year_code"]) ||
        "",
    ),
    fiscal_year_name: String(
      fiscalYear.name ||
        fiscalYear.title ||
        getNestedValue(obj, ["fiscal_year_name", "year_name"]) ||
        "",
    ),
    start_date: String(
      getNestedValue(obj, ["start_date", "date_from", "from_date"]) || "",
    ),
    end_date: String(
      getNestedValue(obj, ["end_date", "date_to", "to_date"]) || "",
    ),
    status,
    is_closed:
      Boolean(getNestedValue(obj, ["is_closed", "closed"])) ||
      status === "CLOSED" ||
      status === "LOCKED",
    closed_at: String(getNestedValue(obj, ["closed_at", "locked_at"]) || ""),
    closed_by_name: String(
      getNestedValue(obj, ["closed_by_name", "locked_by_name"]) || "",
    ),
    journal_entries_count: toNumber(
      getNestedValue(obj, [
        "journal_entries_count",
        "entries_count",
        "transactions_count",
      ]),
    ),
    total_debit: toNumber(
      getNestedValue(obj, ["total_debit", "debit", "debit_amount"]),
    ),
    total_credit: toNumber(
      getNestedValue(obj, ["total_credit", "credit", "credit_amount"]),
    ),
    notes: String(getNestedValue(obj, ["notes", "description", "memo"]) || ""),
    created_at: String(getNestedValue(obj, ["created_at", "created"]) || ""),
    updated_at: String(getNestedValue(obj, ["updated_at", "modified"]) || ""),
  };
}

function buildSummary(
  rows: AccountingPeriodRow[],
  apiSummary?: Partial<PeriodsSummary>,
): PeriodsSummary {
  const fiscalYears = new Set(
    rows
      .map((item) => item.fiscal_year_id || item.fiscal_year)
      .filter(Boolean),
  );

  const fallback: PeriodsSummary = {
    total_periods: rows.length,
    open_periods: rows.filter((item) => item.status === "OPEN").length,
    closed_periods: rows.filter((item) => item.status === "CLOSED").length,
    locked_periods: rows.filter((item) => item.status === "LOCKED").length,
    fiscal_years_count: fiscalYears.size,
    journal_entries_count: rows.reduce(
      (sum, item) => sum + item.journal_entries_count,
      0,
    ),
    total_debit: rows.reduce((sum, item) => sum + item.total_debit, 0),
    total_credit: rows.reduce((sum, item) => sum + item.total_credit, 0),
  };

  return {
    total_periods: toNumber(apiSummary?.total_periods) || fallback.total_periods,
    open_periods: toNumber(apiSummary?.open_periods) || fallback.open_periods,
    closed_periods:
      toNumber(apiSummary?.closed_periods) || fallback.closed_periods,
    locked_periods:
      toNumber(apiSummary?.locked_periods) || fallback.locked_periods,
    fiscal_years_count:
      toNumber(apiSummary?.fiscal_years_count) || fallback.fiscal_years_count,
    journal_entries_count:
      toNumber(apiSummary?.journal_entries_count) ||
      fallback.journal_entries_count,
    total_debit: toNumber(apiSummary?.total_debit) || fallback.total_debit,
    total_credit: toNumber(apiSummary?.total_credit) || fallback.total_credit,
  };
}

function statusLabel(status: PeriodStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<PeriodStatus, string> = {
    OPEN: t.open,
    CLOSED: t.closed,
    LOCKED: t.locked,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function statusBadge(status: PeriodStatus, locale: AppLocale) {
  const label = statusLabel(status, locale);

  if (status === "OPEN") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        <UnlockKeyhole className="me-1 h-3.5 w-3.5" />
        {label}
      </Badge>
    );
  }

  if (status === "CLOSED") {
    return (
      <Badge className="rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <LockKeyhole className="me-1 h-3.5 w-3.5" />
        {label}
      </Badge>
    );
  }

  if (status === "LOCKED") {
    return (
      <Badge className="rounded-full border-violet-200 bg-violet-50 px-3 py-1 text-violet-700 hover:bg-violet-50 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300">
        <ShieldCheck className="me-1 h-3.5 w-3.5" />
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

function sortValue(row: AccountingPeriodRow, key: SortKey): string | number {
  if (key === "period_number") return row.period_number;
  if (key === "journal_entries_count") return row.journal_entries_count;
  if (key === "total_debit") return row.total_debit;
  if (key === "total_credit") return row.total_credit;
  if (key === "fiscal_year") return row.fiscal_year;

  return String(row[key] || "");
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

/* ============================================================
   Export / Print
============================================================ */

function downloadExcel({
  filename,
  worksheetName,
  title,
  locale,
  summaryRows,
  headers,
  rows,
}: {
  filename: string;
  worksheetName: string;
  title: string;
  locale: AppLocale;
  summaryRows: Array<[string, string | number]>;
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  const dir = locale === "ar" ? "rtl" : "ltr";
  const align = locale === "ar" ? "right" : "left";
  const colspan = Math.max(headers.length, 2);

  const summaryHtml = summaryRows
    .map(
      ([label, value]) => `
        <tr>
          <td class="summary-label">${escapeHtml(label)}</td>
          <td class="summary-value">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  const headerHtml = headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join("");

  const rowsHtml = rows
    .map(
      (row) => `
        <tr>
          ${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}
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
                  <x:DisplayRightToLeft>${locale === "ar" ? "True" : "False"}</x:DisplayRightToLeft>
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
          <tr><td class="title" colspan="${colspan}">${escapeHtml(title)}</td></tr>
          <tr><td colspan="${colspan}"></td></tr>
          <tr><td class="section" colspan="${colspan}">
            ${locale === "ar" ? "ملخص الفترات المحاسبية" : "Accounting Periods Summary"}
          </td></tr>
          ${summaryHtml}
          <tr><td colspan="${colspan}"></td></tr>
          <tr>${headerHtml}</tr>
          ${rowsHtml}
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
  rows,
  summary,
  t,
}: {
  locale: AppLocale;
  title: string;
  rows: AccountingPeriodRow[];
  summary: PeriodsSummary;
  t: ReturnType<typeof dictionary>;
}) {
  const isArabic = locale === "ar";
  const now = new Date().toLocaleString("en-US");

  const tableRows = rows
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.period_number)}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.fiscal_year || item.fiscal_year_name || "-")}</td>
          <td>${escapeHtml(formatDate(item.start_date, locale))} - ${escapeHtml(formatDate(item.end_date, locale))}</td>
          <td>${escapeHtml(statusLabel(item.status, locale))}</td>
          <td>${escapeHtml(formatNumber(item.journal_entries_count))}</td>
          <td>${escapeHtml(formatMoney(item.total_debit))}</td>
          <td>${escapeHtml(formatMoney(item.total_credit))}</td>
        </tr>
      `,
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
            background: #ffffff;
            direction: ${isArabic ? "rtl" : "ltr"};
            text-align: ${isArabic ? "right" : "left"};
          }
          .print-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 16px;
            margin-bottom: 18px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 14px;
          }
          h1 { margin: 0; font-size: 22px; font-weight: 800; }
          .meta { margin-top: 8px; color: #6b7280; font-size: 12px; line-height: 1.8; }
          .badge {
            display: inline-block;
            border: 1px solid #d1d5db;
            border-radius: 999px;
            padding: 4px 10px;
            font-size: 12px;
            color: #374151;
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
              <div>${escapeHtml(t.rowsCount)}: ${formatNumber(rows.length)}</div>
            </div>
          </div>
          <div class="badge">Primey Care</div>
        </div>

        <div class="summary-grid">
          <div class="summary-card"><span>${escapeHtml(t.totalPeriods)}</span><strong>${formatNumber(summary.total_periods)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.openPeriods)}</span><strong>${formatNumber(summary.open_periods)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.closedPeriods)}</span><strong>${formatNumber(summary.closed_periods)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.entriesCount)}</span><strong>${formatNumber(summary.journal_entries_count)}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${escapeHtml(t.table.number)}</th>
              <th>${escapeHtml(t.table.name)}</th>
              <th>${escapeHtml(t.table.fiscalYear)}</th>
              <th>${escapeHtml(t.table.period)}</th>
              <th>${escapeHtml(t.table.status)}</th>
              <th>${escapeHtml(t.table.entries)}</th>
              <th>${escapeHtml(t.table.debit)}</th>
              <th>${escapeHtml(t.table.credit)}</th>
            </tr>
          </thead>
          <tbody>
            ${
              tableRows ||
              `<tr><td colspan="9" style="text-align:center">${escapeHtml(t.emptyTitle)}</td></tr>`
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

export default function AccountingPeriodsPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [rows, setRows] = useState<AccountingPeriodRow[]>([]);
  const [summary, setSummary] = useState<PeriodsSummary>(DEFAULT_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [fiscalYearFilter, setFiscalYearFilter] =
    useState<FiscalYearFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("start_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [visibleColumns, setVisibleColumns] =
    useState<VisibleColumns>(DEFAULT_COLUMNS);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canView = hasSafePermission(
    auth,
    ["accounting.view", "accounting.periods.view", "accounting.fiscal_years.view"],
    "view",
  );

  const canCreate = hasSafePermission(
    auth,
    ["accounting.create", "accounting.periods.create", "accounting.manage"],
    "action",
  );

  const canExport = hasSafePermission(
    auth,
    ["accounting.export", "reports.accounting.export", "reports.export"],
    "action",
  );

  const canPrint = hasSafePermission(
    auth,
    ["accounting.print", "reports.accounting.print", "reports.print"],
    "action",
  );

  const canViewDetails = hasSafePermission(
    auth,
    ["accounting.view", "accounting.periods.view"],
    "view",
  );

  const fiscalYearOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string; count: number }>();

    rows.forEach((item) => {
      const value = item.fiscal_year_id || item.fiscal_year || item.fiscal_year_name;

      if (!value) return;

      const label = [item.fiscal_year, item.fiscal_year_name]
        .filter(Boolean)
        .join(" - ");

      const current = map.get(value);

      map.set(value, {
        value,
        label: label || value,
        count: (current?.count || 0) + 1,
      });
    });

    return [
      { value: "ALL", label: t.allFiscalYears, count: rows.length },
      ...Array.from(map.values()).sort((a, b) => b.label.localeCompare(a.label)),
    ];
  }, [rows, t.allFiscalYears]);

  const filteredRows = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    const filtered = rows.filter((item) => {
      const matchesStatus =
        statusFilter === "ALL" ? true : item.status === statusFilter;

      const fiscalYearValue =
        item.fiscal_year_id || item.fiscal_year || item.fiscal_year_name;

      const matchesFiscalYear =
        fiscalYearFilter === "ALL" ? true : fiscalYearValue === fiscalYearFilter;

      const matchesQuery = !cleanQuery
        ? true
        : [
            item.name,
            item.period_number,
            item.fiscal_year,
            item.fiscal_year_name,
            item.notes,
            statusLabel(item.status, locale),
          ]
            .join(" ")
            .toLowerCase()
            .includes(cleanQuery);

      return matchesStatus && matchesFiscalYear && matchesQuery;
    });

    return [...filtered].sort((a, b) => {
      const first = sortValue(a, sortKey);
      const second = sortValue(b, sortKey);

      if (typeof first === "number" && typeof second === "number") {
        return sortDirection === "asc" ? first - second : second - first;
      }

      return sortDirection === "asc"
        ? String(first).localeCompare(String(second))
        : String(second).localeCompare(String(first));
    });
  }, [
    fiscalYearFilter,
    locale,
    query,
    rows,
    sortDirection,
    sortKey,
    statusFilter,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  const paginatedRows = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * PAGE_SIZE;

    return filteredRows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredRows, page, totalPages]);

  const hasSearchOrFilter =
    query.trim().length > 0 ||
    statusFilter !== "ALL" ||
    fiscalYearFilter !== "ALL";

  const visibleColumnCount = Object.entries(visibleColumns).filter(
    ([key, value]) => value && (key !== "actions" || canViewDetails),
  ).length;

  const statusOptions = useMemo(
    () => [
      {
        value: "ALL" as StatusFilter,
        label: t.allStatuses,
        count: rows.length,
      },
      {
        value: "OPEN" as StatusFilter,
        label: t.open,
        count: rows.filter((item) => item.status === "OPEN").length,
      },
      {
        value: "CLOSED" as StatusFilter,
        label: t.closed,
        count: rows.filter((item) => item.status === "CLOSED").length,
      },
      {
        value: "LOCKED" as StatusFilter,
        label: t.locked,
        count: rows.filter((item) => item.status === "LOCKED").length,
      },
    ],
    [rows, t],
  );

  const columnOptions: Array<{ key: keyof VisibleColumns; label: string }> = [
    { key: "number", label: t.table.number },
    { key: "name", label: t.table.name },
    { key: "fiscalYear", label: t.table.fiscalYear },
    { key: "period", label: t.table.period },
    { key: "status", label: t.table.status },
    { key: "entriesCount", label: t.table.entries },
    { key: "totalDebit", label: t.table.debit },
    { key: "totalCredit", label: t.table.credit },
    { key: "actions", label: t.table.action },
  ];

  const loadPeriods = useCallback(
    async (showToast = false) => {
      if (!canView) {
        setRows([]);
        setSummary(DEFAULT_SUMMARY);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");

        const endpoints = [
          "/api/accounting/periods/?page_size=500",
          "/api/accounting/fiscal-periods/?page_size=500",
          "/api/accounting/reports/periods/?page_size=500",
        ];

        let loadedPayload: ApiEnvelope<unknown> | null = null;
        let loaded = false;
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

          if ([400, 404, 405].includes(response.status)) {
            lastError =
              payload?.message ||
              payload?.detail ||
              payload?.error ||
              `HTTP ${response.status}`;
            continue;
          }

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

          loadedPayload = payload;
          loaded = true;
          break;
        }

        if (!loaded || !loadedPayload) {
          throw new Error(lastError || t.loadError);
        }

        const normalizedRows = extractRows(loadedPayload)
          .map(normalizePeriod)
          .filter((item) => item.id || item.name || item.period_number);

        setRows(normalizedRows);
        setSummary(buildSummary(normalizedRows, extractSummary(loadedPayload)));
        setPage(1);

        if (showToast) {
          toast.success(t.loadSuccess);
        }
      } catch (error) {
        console.error("Accounting periods load error:", error);
        setRows([]);
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
    setStatusFilter("ALL");
    setFiscalYearFilter("ALL");
    setPage(1);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  function exportExcel() {
    if (!canExport) return;

    if (filteredRows.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const generatedAt = new Date();

    downloadExcel({
      filename: `primey-care-accounting-periods-${generatedAt
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "الفترات المحاسبية" : "Accounting Periods",
      title: t.title,
      locale,
      summaryRows: [
        [t.generatedAt, generatedAt.toLocaleString("en-US")],
        [t.totalPeriods, summary.total_periods],
        [t.openPeriods, summary.open_periods],
        [t.closedPeriods, summary.closed_periods],
        [t.lockedPeriods, summary.locked_periods],
        [t.fiscalYearsCount, summary.fiscal_years_count],
        [t.entriesCount, summary.journal_entries_count],
        [t.totalDebit, formatMoney(summary.total_debit)],
        [t.totalCredit, formatMoney(summary.total_credit)],
      ],
      headers: [
        "ID",
        t.table.number,
        t.table.name,
        t.table.fiscalYear,
        t.table.period,
        t.table.status,
        t.table.entries,
        t.table.debit,
        t.table.credit,
      ],
      rows: filteredRows.map((item) => [
        item.id || "-",
        item.period_number,
        item.name || "-",
        [item.fiscal_year, item.fiscal_year_name].filter(Boolean).join(" - ") ||
          "-",
        `${formatDate(item.start_date, locale)} - ${formatDate(
          item.end_date,
          locale,
        )}`,
        statusLabel(item.status, locale),
        item.journal_entries_count,
        formatMoney(item.total_debit),
        formatMoney(item.total_credit),
      ]),
    });

    toast.success(t.exportSuccess);
  }

  function printPage() {
    if (!canPrint) return;

    if (filteredRows.length === 0) {
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
        rows: filteredRows,
        summary,
        t,
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
    loadPeriods(false);
  }, [authResolving, loadPeriods]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, fiscalYearFilter]);

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
          <Link href="/system/accounting">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>

          <Link href="/system/accounting/fiscal-years">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <CalendarDays className="h-4 w-4" />
              <span>{t.fiscalYears}</span>
            </Button>
          </Link>

          <Link href="/system/reports/accounting">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <BarChart3 className="h-4 w-4" />
              <span>{t.reports}</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadPeriods(true)}
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
              disabled={
                isLoading || filteredRows.length === 0 || Boolean(errorMessage)
              }
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
              disabled={
                isLoading || filteredRows.length === 0 || Boolean(errorMessage)
              }
            >
              <Printer className="h-4 w-4" />
              <span>{t.print}</span>
            </Button>
          ) : null}

          {canCreate ? (
            <Link href="/system/accounting/periods/create">
              <Button
                variant="outline"
                className="h-10 w-full rounded-xl sm:w-auto"
              >
                <PlusCircle className="h-4 w-4" />
                <span>{t.create}</span>
              </Button>
            </Link>
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
                <p className="font-semibold text-destructive">
                  {errorMessage}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.loadErrorHint}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => loadPeriods(true)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!errorMessage ? (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="flex flex-col gap-3 pb-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="text-base font-bold">
                    {t.statusTitle}
                  </CardTitle>
                  <CardDescription>{t.statusDesc}</CardDescription>
                </div>

                {canExport ? (
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl"
                    onClick={exportExcel}
                    disabled={isLoading || filteredRows.length === 0}
                  >
                    <Download className="h-4 w-4" />
                    {t.exportExcel}
                  </Button>
                ) : null}
              </CardHeader>

              <CardContent className="space-y-4">
                {isLoading ? (
                  <KpiSkeleton />
                ) : (
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border bg-background p-4">
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {t.totalPeriods}
                      </p>
                      <div className="mt-3 text-2xl font-bold">
                        {formatNumber(summary.total_periods)}
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-slate-950 dark:bg-slate-200" />
                    </div>

                    <div className="rounded-2xl border bg-background p-4">
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <UnlockKeyhole className="h-3.5 w-3.5" />
                        {t.openPeriods}
                      </p>
                      <div className="mt-3 text-2xl font-bold">
                        {formatNumber(summary.open_periods)}
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-emerald-500" />
                    </div>

                    <div className="rounded-2xl border bg-background p-4">
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <LockKeyhole className="h-3.5 w-3.5" />
                        {t.closedPeriods}
                      </p>
                      <div className="mt-3 text-2xl font-bold">
                        {formatNumber(summary.closed_periods)}
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-sky-500" />
                    </div>

                    <div className="rounded-2xl border bg-background p-4">
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Layers3 className="h-3.5 w-3.5" />
                        {t.entriesCount}
                      </p>
                      <div className="mt-3 text-2xl font-bold">
                        {formatNumber(summary.journal_entries_count)}
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-violet-500" />
                    </div>
                  </div>
                )}

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
                        className="w-72 rounded-2xl"
                      >
                        <div dir={isArabic ? "rtl" : "ltr"}>
                          <DropdownMenuLabel>{t.allStatuses}</DropdownMenuLabel>
                          <DropdownMenuSeparator />

                          {statusOptions.map((item) => (
                            <DropdownMenuCheckboxItem
                              key={item.value}
                              checked={statusFilter === item.value}
                              onCheckedChange={() => setStatusFilter(item.value)}
                            >
                              {item.label} ({formatNumber(item.count)})
                            </DropdownMenuCheckboxItem>
                          ))}

                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>
                            {t.allFiscalYears}
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />

                          {fiscalYearOptions.map((item) => (
                            <DropdownMenuCheckboxItem
                              key={item.value}
                              checked={fiscalYearFilter === item.value}
                              onCheckedChange={() =>
                                setFiscalYearFilter(item.value)
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
                            if (column.key === "actions" && !canViewDetails) {
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

                <div className="overflow-hidden rounded-xl border">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {visibleColumns.number ? (
                            <TableHead className="min-w-[120px]">
                              <button
                                type="button"
                                onClick={() => toggleSort("period_number")}
                                className="inline-flex items-center gap-1 font-medium"
                              >
                                {t.table.number}
                                {sortKey === "period_number" &&
                                  (sortDirection === "asc" ? (
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  ) : (
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  ))}
                              </button>
                            </TableHead>
                          ) : null}

                          {visibleColumns.name ? (
                            <TableHead className="min-w-[220px]">
                              <button
                                type="button"
                                onClick={() => toggleSort("name")}
                                className="inline-flex items-center gap-1 font-medium"
                              >
                                {t.table.name}
                                {sortKey === "name" &&
                                  (sortDirection === "asc" ? (
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  ) : (
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  ))}
                              </button>
                            </TableHead>
                          ) : null}

                          {visibleColumns.fiscalYear ? (
                            <TableHead className="min-w-[180px]">
                              <button
                                type="button"
                                onClick={() => toggleSort("fiscal_year")}
                                className="inline-flex items-center gap-1 font-medium"
                              >
                                {t.table.fiscalYear}
                                {sortKey === "fiscal_year" &&
                                  (sortDirection === "asc" ? (
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  ) : (
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  ))}
                              </button>
                            </TableHead>
                          ) : null}

                          {visibleColumns.period ? (
                            <TableHead className="min-w-[230px]">
                              {t.table.period}
                            </TableHead>
                          ) : null}

                          {visibleColumns.status ? (
                            <TableHead className="min-w-[120px]">
                              {t.table.status}
                            </TableHead>
                          ) : null}

                          {visibleColumns.entriesCount ? (
                            <TableHead className="min-w-[120px]">
                              <button
                                type="button"
                                onClick={() =>
                                  toggleSort("journal_entries_count")
                                }
                                className="inline-flex items-center gap-1 font-medium"
                              >
                                {t.table.entries}
                                {sortKey === "journal_entries_count" &&
                                  (sortDirection === "asc" ? (
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  ) : (
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  ))}
                              </button>
                            </TableHead>
                          ) : null}

                          {visibleColumns.totalDebit ? (
                            <TableHead className="min-w-[140px]">
                              <button
                                type="button"
                                onClick={() => toggleSort("total_debit")}
                                className="inline-flex items-center gap-1 font-medium"
                              >
                                {t.table.debit}
                                {sortKey === "total_debit" &&
                                  (sortDirection === "asc" ? (
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  ) : (
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  ))}
                              </button>
                            </TableHead>
                          ) : null}

                          {visibleColumns.totalCredit ? (
                            <TableHead className="min-w-[140px]">
                              <button
                                type="button"
                                onClick={() => toggleSort("total_credit")}
                                className="inline-flex items-center gap-1 font-medium"
                              >
                                {t.table.credit}
                                {sortKey === "total_credit" &&
                                  (sortDirection === "asc" ? (
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  ) : (
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  ))}
                              </button>
                            </TableHead>
                          ) : null}

                          {visibleColumns.actions && canViewDetails ? (
                            <TableHead className="min-w-[100px]">
                              {t.table.action}
                            </TableHead>
                          ) : null}
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {isLoading ? (
                          <TableSkeleton columnsCount={visibleColumnCount || 1} />
                        ) : paginatedRows.length > 0 ? (
                          paginatedRows.map((item) => (
                            <TableRow key={`${item.id}-${item.period_number}`}>
                              {visibleColumns.number ? (
                                <TableCell className="font-semibold" dir="ltr">
                                  {formatNumber(item.period_number)}
                                </TableCell>
                              ) : null}

                              {visibleColumns.name ? (
                                <TableCell>
                                  <div className="min-w-[200px]">
                                    <p className="font-medium">
                                      {item.name || "-"}
                                    </p>
                                    <p className="line-clamp-1 text-xs text-muted-foreground">
                                      {item.notes || "-"}
                                    </p>
                                  </div>
                                </TableCell>
                              ) : null}

                              {visibleColumns.fiscalYear ? (
                                <TableCell>
                                  <div className="min-w-[160px]">
                                    <p className="font-medium" dir="ltr">
                                      {item.fiscal_year || "-"}
                                    </p>
                                    <p className="line-clamp-1 text-xs text-muted-foreground">
                                      {item.fiscal_year_name || "-"}
                                    </p>
                                  </div>
                                </TableCell>
                              ) : null}

                              {visibleColumns.period ? (
                                <TableCell>
                                  <div className="flex min-w-[210px] items-center gap-2 text-sm">
                                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                                    <span>
                                      {formatDate(item.start_date, locale)} -{" "}
                                      {formatDate(item.end_date, locale)}
                                    </span>
                                  </div>
                                </TableCell>
                              ) : null}

                              {visibleColumns.status ? (
                                <TableCell>
                                  {statusBadge(item.status, locale)}
                                </TableCell>
                              ) : null}

                              {visibleColumns.entriesCount ? (
                                <TableCell>
                                  {formatNumber(item.journal_entries_count)}
                                </TableCell>
                              ) : null}

                              {visibleColumns.totalDebit ? (
                                <TableCell>
                                  <MoneyText value={item.total_debit} />
                                </TableCell>
                              ) : null}

                              {visibleColumns.totalCredit ? (
                                <TableCell>
                                  <MoneyText value={item.total_credit} />
                                </TableCell>
                              ) : null}

                              {visibleColumns.actions && canViewDetails ? (
                                <TableCell>
                                  {isValidId(item.id) ? (
                                    <Link
                                      href={`/system/accounting/periods/${item.id}`}
                                    >
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 rounded-lg"
                                      >
                                        <Eye className="h-4 w-4" />
                                        <span className="sr-only">{t.view}</span>
                                      </Button>
                                    </Link>
                                  ) : null}
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
                                <CalendarClock className="h-10 w-10 text-muted-foreground/40" />
                                <p className="font-semibold">
                                  {hasSearchOrFilter
                                    ? t.noResultsTitle
                                    : t.emptyTitle}
                                </p>
                                <p className="max-w-md text-sm text-muted-foreground">
                                  {hasSearchOrFilter
                                    ? t.noResultsText
                                    : t.emptyText}
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
                                ) : canCreate ? (
                                  <Link href="/system/accounting/periods/create">
                                    <Button size="sm" className="mt-2 rounded-xl">
                                      <PlusCircle className="h-4 w-4" />
                                      {t.create}
                                    </Button>
                                  </Link>
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
                    {t.showing} {formatNumber(paginatedRows.length)} {t.from}{" "}
                    {formatNumber(filteredRows.length)}
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

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <BarChart3 className="h-4 w-4" />
                  {t.summaryTitle}
                </CardTitle>
                <CardDescription>{t.summaryDesc}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="rounded-2xl border bg-background p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950">
                      <CalendarClock className="h-5 w-5" />
                    </div>

                    <div>
                      <p className="text-sm font-semibold">{t.totalPeriods}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(summary.total_periods)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">
                      {t.openPeriods}
                    </p>
                    <div className="mt-2 text-lg font-bold">
                      {formatNumber(summary.open_periods)}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">
                      {t.closedPeriods}
                    </p>
                    <div className="mt-2 text-lg font-bold">
                      {formatNumber(summary.closed_periods)}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">
                      {t.lockedPeriods}
                    </p>
                    <div className="mt-2 text-lg font-bold">
                      {formatNumber(summary.locked_periods)}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">
                      {t.fiscalYearsCount}
                    </p>
                    <div className="mt-2 text-lg font-bold">
                      {formatNumber(summary.fiscal_years_count)}
                    </div>
                  </div>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-3 py-2 text-sm">
                    <span>{t.entriesCount}</span>
                    <span>{formatNumber(summary.journal_entries_count)}</span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
                    <span>{t.totalDebit}</span>
                    <MoneyText value={summary.total_debit} />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
                    <span>{t.totalCredit}</span>
                    <MoneyText value={summary.total_credit} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {isLoading ? (
            <KpiSkeleton />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-2xl font-bold">
                        {formatNumber(summary.open_periods)}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t.openPeriods}
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                      <UnlockKeyhole className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-2xl font-bold">
                        {formatNumber(summary.closed_periods)}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t.closedPeriods}
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                      <LockKeyhole className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-2xl font-bold">
                        {formatNumber(summary.journal_entries_count)}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t.entriesCount}
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
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
                        <MoneyText value={summary.total_debit} />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t.totalDebit}
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300">
                      <WalletCards className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}