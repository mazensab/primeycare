"use client";

/* ============================================================
   📂 app/system/accounting/periods/[id]/page.tsx
   🧠 Primey Care | Accounting Period Detail Page

   ✅ المسار:
      app/system/accounting/periods/[id]/page.tsx

   ✅ العمل:
      صفحة تفاصيل الفترة المحاسبية داخل مديول المحاسبة.
      تعرض بيانات الفترة، السنة المالية، حالة الإقفال، والقيود المحاسبية المرتبطة.

   ✅ الإصدار:
      Phase 17 UX Refinement + Accounting Period Detail Build

   ✅ يعتمد على:
      - /api/accounting/periods/{id}/
      - /api/accounting/fiscal-periods/{id}/ كـ fallback آمن
      - /api/accounting/reports/periods/{id}/ كـ fallback آمن
      - /api/accounting/journals/?period_id={id} كـ fallback للقيود
      - primey-locale
      - AuthProvider
      - sonner
      - /currency/sar.svg

   ✅ متوافق مع:
      - Accounting periods page
      - Accounting periods create page
      - Accounting fiscal years pages
      - Accounting journals approved pattern
      - Centers / Customers approved UX standard

   ✅ الوظائف:
      - عرض تفاصيل الفترة المحاسبية.
      - عرض السنة المالية المرتبطة.
      - عرض حالة الفترة: مفتوحة / مغلقة / مقفلة.
      - عرض ملخص القيود والمدين والدائن والصافي.
      - عرض القيود المحاسبية المرتبطة بالفترة.
      - بحث داخل القيود.
      - فلترة حسب حالة القيد.
      - التحكم بالأعمدة.
      - فرز القيود.
      - صفحات محلية.
      - Excel export بصيغة .xls HTML Workbook.
      - Web PDF Print.
      - Error State مستقل.
      - Not Found State مستقل.
      - Empty State ذكي.
      - Skeleton Loading.
      - صلاحيات آمنة بدون كسر system_admin/superuser.
      - أرقام إنجليزية دائمًا.
      - رمز SAR من /currency/sar.svg بعد الرقم.

   ------------------------------------------------------------
   تحسينات هذا الإصدار:
      - الملف المرفق كان صفحة إنشاء قيد يومية وليس تفاصيل فترة محاسبية.
      - تم بناء الصفحة من الصفر بنفس النمط المعتمد.
      - الالتزام بالقاعدة: w-full space-y-4 بدون main/min-h-screen/max-w.
      - إزالة أي عبارات تقنية أو مؤقتة من واجهة المستخدم.
      - عدم استخدام localhost.
      - استخدام sonner للتنبيهات.
      - استخدام Excel HTML Workbook بدل CSV.
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
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
  FileText,
  Filter,
  Layers3,
  Loader2,
  LockKeyhole,
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
type JournalStatus = "DRAFT" | "POSTED" | "CANCELLED" | "UNKNOWN";
type JournalStatusFilter = "ALL" | JournalStatus;

type SortKey =
  | "entry_date"
  | "journal_entry_number"
  | "posting_source"
  | "reference"
  | "status"
  | "total_debit"
  | "total_credit"
  | "created_at";

type SortDirection = "asc" | "desc";

type AccountingPeriodDetail = {
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
  net_amount: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

type PeriodJournalRow = {
  id: string;
  journal_entry_number: string;
  entry_date: string;
  posting_source: string;
  reference: string;
  external_reference: string;
  description: string;
  status: JournalStatus;
  total_debit: number;
  total_credit: number;
  net_amount: number;
  created_at: string;
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
  entries?: unknown[];
  journals?: unknown[];
  journal_entries?: unknown[];
  period?: unknown;
  accounting_period?: unknown;
  fiscal_period?: unknown;
  summary?: Partial<AccountingPeriodDetail>;
};

type VisibleColumns = {
  entryDate: boolean;
  number: boolean;
  source: boolean;
  reference: boolean;
  description: boolean;
  status: boolean;
  debit: boolean;
  credit: boolean;
  net: boolean;
  actions: boolean;
};

const SAR_ICON_PATH = "/currency/sar.svg";
const PAGE_SIZE = 16;

const DEFAULT_COLUMNS: VisibleColumns = {
  entryDate: true,
  number: true,
  source: true,
  reference: true,
  description: true,
  status: true,
  debit: true,
  credit: true,
  net: true,
  actions: true,
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

function buildQuery(params: Record<string, string | number | boolean | null>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === "") return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();

  return query ? `?${query}` : "";
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
    title: isArabic ? "تفاصيل الفترة المحاسبية" : "Accounting Period Details",
    subtitle: isArabic
      ? "عرض بيانات الفترة المحاسبية والسنة المالية وحالة الإقفال والقيود المرتبطة."
      : "View accounting period information, fiscal year, closing status, and linked entries.",

    back: isArabic ? "الفترات المحاسبية" : "Accounting Periods",
    accounting: isArabic ? "لوحة المحاسبة" : "Accounting Overview",
    fiscalYears: isArabic ? "السنوات المالية" : "Fiscal Years",
    reports: isArabic ? "تقارير المحاسبة" : "Accounting Reports",
    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",

    infoTitle: isArabic ? "بيانات الفترة" : "Period Information",
    infoDesc: isArabic
      ? "المعلومات الأساسية للفترة وحالة الإقفال."
      : "Basic period information and closing status.",
    summaryTitle: isArabic ? "ملخص الفترة" : "Period Summary",
    summaryDesc: isArabic
      ? "أهم مؤشرات الفترة المحاسبية الحالية."
      : "Key indicators for this accounting period.",
    journalsTitle: isArabic ? "قيود الفترة" : "Period Journal Entries",
    journalsDesc: isArabic
      ? "القيود المحاسبية المرتبطة بهذه الفترة."
      : "Journal entries linked to this accounting period.",

    name: isArabic ? "اسم الفترة" : "Period Name",
    number: isArabic ? "رقم الفترة" : "Period Number",
    fiscalYear: isArabic ? "السنة المالية" : "Fiscal Year",
    period: isArabic ? "الفترة" : "Period",
    startDate: isArabic ? "تاريخ البداية" : "Start Date",
    endDate: isArabic ? "تاريخ النهاية" : "End Date",
    status: isArabic ? "الحالة" : "Status",
    notes: isArabic ? "ملاحظات" : "Notes",
    createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
    updatedAt: isArabic ? "آخر تحديث" : "Updated At",
    closedAt: isArabic ? "تاريخ الإقفال" : "Closed At",
    closedBy: isArabic ? "أغلق بواسطة" : "Closed By",

    open: isArabic ? "مفتوحة" : "Open",
    closed: isArabic ? "مغلقة" : "Closed",
    locked: isArabic ? "مقفلة" : "Locked",
    unknown: isArabic ? "غير محدد" : "Unknown",

    draft: isArabic ? "مسودة" : "Draft",
    posted: isArabic ? "مرحل" : "Posted",
    cancelled: isArabic ? "ملغي" : "Cancelled",

    entriesCount: isArabic ? "القيود المرتبطة" : "Linked Entries",
    totalDebit: isArabic ? "إجمالي المدين" : "Total Debit",
    totalCredit: isArabic ? "إجمالي الدائن" : "Total Credit",
    netAmount: isArabic ? "الصافي" : "Net Amount",

    searchPlaceholder: isArabic
      ? "ابحث برقم القيد أو المرجع أو المصدر أو الوصف..."
      : "Search by entry number, reference, source, or description...",

    filters: isArabic ? "الفلاتر" : "Filters",
    columns: isArabic ? "الأعمدة" : "Columns",
    allStatuses: isArabic ? "كل الحالات" : "All Statuses",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",

    table: {
      entryDate: isArabic ? "التاريخ" : "Date",
      number: isArabic ? "رقم القيد" : "Entry No.",
      source: isArabic ? "المصدر" : "Source",
      reference: isArabic ? "المرجع" : "Reference",
      description: isArabic ? "الوصف" : "Description",
      status: isArabic ? "الحالة" : "Status",
      debit: isArabic ? "المدين" : "Debit",
      credit: isArabic ? "الدائن" : "Credit",
      net: isArabic ? "الصافي" : "Net",
      action: isArabic ? "الإجراء" : "Action",
    },

    view: isArabic ? "عرض" : "View",

    emptyTitle: isArabic ? "لا توجد قيود" : "No journal entries",
    emptyText: isArabic
      ? "لم يتم العثور على قيود محاسبية مرتبطة بهذه الفترة."
      : "No journal entries were found for this accounting period.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير البحث أو الفلاتر."
      : "Try changing the search or filters.",

    notFoundTitle: isArabic ? "الفترة المحاسبية غير موجودة" : "Accounting period not found",
    notFoundText: isArabic
      ? "لم يتم العثور على الفترة المحاسبية المطلوبة."
      : "The requested accounting period could not be found.",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الفترة المحاسبية" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض تفاصيل الفترات المحاسبية. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view accounting period details. Contact your system administrator if you need access.",

    loadError: isArabic
      ? "تعذر تحميل تفاصيل الفترة المحاسبية."
      : "Unable to load accounting period details.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    loadSuccess: isArabic
      ? "تم تحديث تفاصيل الفترة المحاسبية بنجاح."
      : "Accounting period details refreshed successfully.",

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
    "journal",
    "journal_entry",
    "entry",
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

function normalizePeriodStatus(value: unknown): PeriodStatus {
  const clean = String(value || "").toUpperCase();

  if (["OPEN", "ACTIVE"].includes(clean)) return "OPEN";
  if (["CLOSED"].includes(clean)) return "CLOSED";
  if (["LOCKED", "POSTED"].includes(clean)) return "LOCKED";

  if (typeof value === "boolean") return value ? "OPEN" : "CLOSED";

  return "UNKNOWN";
}

function normalizeJournalStatus(value: unknown): JournalStatus {
  const clean = String(value || "").toUpperCase();

  if (["DRAFT", "NEW"].includes(clean)) return "DRAFT";
  if (["POSTED", "APPROVED", "CONFIRMED"].includes(clean)) return "POSTED";
  if (["CANCELLED", "CANCELED", "VOID"].includes(clean)) return "CANCELLED";

  return "UNKNOWN";
}

function extractData(payload: ApiEnvelope<unknown> | null): Dict {
  if (!payload) return {};

  const data = asDict(payload.data);

  if (data.period && typeof data.period === "object") {
    return data.period as Dict;
  }

  if (data.accounting_period && typeof data.accounting_period === "object") {
    return data.accounting_period as Dict;
  }

  if (data.fiscal_period && typeof data.fiscal_period === "object") {
    return data.fiscal_period as Dict;
  }

  if (payload.period && typeof payload.period === "object") {
    return payload.period as Dict;
  }

  if (payload.accounting_period && typeof payload.accounting_period === "object") {
    return payload.accounting_period as Dict;
  }

  if (payload.fiscal_period && typeof payload.fiscal_period === "object") {
    return payload.fiscal_period as Dict;
  }

  return Object.keys(data).length > 0 ? data : asDict(payload);
}

function extractJournals(payload: ApiEnvelope<unknown> | null): unknown[] {
  if (!payload) return [];

  const data = asDict(payload.data);

  if (Array.isArray(payload.journal_entries)) return payload.journal_entries;
  if (Array.isArray(payload.journals)) return payload.journals;
  if (Array.isArray(payload.entries)) return payload.entries;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.items)) return payload.items;

  if (Array.isArray(data.journal_entries)) return data.journal_entries;
  if (Array.isArray(data.journals)) return data.journals;
  if (Array.isArray(data.entries)) return data.entries;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.items)) return data.items;

  return [];
}

function normalizePeriod(item: unknown): AccountingPeriodDetail {
  const obj = asDict(item);
  const fiscalYear = asDict(obj.fiscal_year || obj.fiscalYear || obj.year);

  const debit = toNumber(
    getNestedValue(obj, ["total_debit", "debit", "debit_amount"]),
  );

  const credit = toNumber(
    getNestedValue(obj, ["total_credit", "credit", "credit_amount"]),
  );

  const explicitNet = getNestedValue(obj, [
    "net_amount",
    "net_balance",
    "balance",
  ]);

  const status = normalizePeriodStatus(
    getNestedValue(obj, ["status", "state", "is_open", "is_closed"]),
  );

  const periodNumber = toNumber(
    getNestedValue(obj, ["period_number", "number", "month", "sequence"]),
  );

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || ""),
    name: String(
      getNestedValue(obj, ["name", "title", "label", "period_name"]) ||
        `Period ${periodNumber || 1}`,
    ),
    period_number: periodNumber || 1,
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
    total_debit: debit,
    total_credit: credit,
    net_amount:
      explicitNet === undefined || explicitNet === null || explicitNet === ""
        ? debit - credit
        : toNumber(explicitNet),
    notes: String(getNestedValue(obj, ["notes", "description", "memo"]) || ""),
    created_at: String(getNestedValue(obj, ["created_at", "created"]) || ""),
    updated_at: String(getNestedValue(obj, ["updated_at", "modified"]) || ""),
  };
}

function normalizeJournal(item: unknown, index: number): PeriodJournalRow {
  const obj = asDict(item);

  const debit = toNumber(
    getNestedValue(obj, ["total_debit", "debit", "debit_amount"]),
  );

  const credit = toNumber(
    getNestedValue(obj, ["total_credit", "credit", "credit_amount"]),
  );

  const explicitNet = getNestedValue(obj, [
    "net_amount",
    "net_balance",
    "difference",
  ]);

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || `${index}`),
    journal_entry_number: String(
      getNestedValue(obj, [
        "journal_entry_number",
        "entry_number",
        "journal_number",
        "number",
        "code",
      ]) || "-",
    ),
    entry_date: String(
      getNestedValue(obj, ["entry_date", "journal_date", "date", "created_at"]) ||
        "",
    ),
    posting_source: String(
      getNestedValue(obj, ["posting_source", "source", "source_type"]) || "-",
    ),
    reference: String(
      getNestedValue(obj, ["reference", "source_reference", "ref"]) || "",
    ),
    external_reference: String(
      getNestedValue(obj, ["external_reference", "external_ref"]) || "",
    ),
    description: String(
      getNestedValue(obj, ["description", "memo", "notes", "entry_description"]) ||
        "",
    ),
    status: normalizeJournalStatus(
      getNestedValue(obj, ["status", "state", "posting_status", "is_posted"]),
    ),
    total_debit: debit,
    total_credit: credit,
    net_amount:
      explicitNet === undefined || explicitNet === null || explicitNet === ""
        ? debit - credit
        : toNumber(explicitNet),
    created_at: String(getNestedValue(obj, ["created_at", "created"]) || ""),
  };
}

function periodStatusLabel(status: PeriodStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<PeriodStatus, string> = {
    OPEN: t.open,
    CLOSED: t.closed,
    LOCKED: t.locked,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function journalStatusLabel(status: JournalStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<JournalStatus, string> = {
    DRAFT: t.draft,
    POSTED: t.posted,
    CANCELLED: t.cancelled,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function periodStatusBadge(status: PeriodStatus, locale: AppLocale) {
  const label = periodStatusLabel(status, locale);

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

function journalStatusBadge(status: JournalStatus, locale: AppLocale) {
  const label = journalStatusLabel(status, locale);

  if (status === "POSTED") {
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

  if (status === "CANCELLED") {
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

function sortValue(row: PeriodJournalRow, key: SortKey): string | number {
  if (key === "total_debit") return row.total_debit;
  if (key === "total_credit") return row.total_credit;

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
                    ? "h-8 w-40 rounded-lg"
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
            ${locale === "ar" ? "ملخص الفترة المحاسبية" : "Accounting Period Summary"}
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
  period,
  rows,
  t,
}: {
  locale: AppLocale;
  title: string;
  period: AccountingPeriodDetail;
  rows: PeriodJournalRow[];
  t: ReturnType<typeof dictionary>;
}) {
  const isArabic = locale === "ar";
  const now = new Date().toLocaleString("en-US");

  const tableRows = rows
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(formatDate(item.entry_date, locale))}</td>
          <td>${escapeHtml(item.journal_entry_number || "-")}</td>
          <td>${escapeHtml(item.posting_source || "-")}</td>
          <td>${escapeHtml(item.reference || "-")}</td>
          <td>${escapeHtml(item.description || "-")}</td>
          <td>${escapeHtml(journalStatusLabel(item.status, locale))}</td>
          <td>${escapeHtml(formatMoney(item.total_debit))}</td>
          <td>${escapeHtml(formatMoney(item.total_credit))}</td>
          <td>${escapeHtml(formatMoney(item.net_amount))}</td>
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
              <div>${escapeHtml(period.name)} - ${escapeHtml(period.fiscal_year || period.fiscal_year_name || "-")}</div>
              <div>${escapeHtml(t.printedAt)}: ${escapeHtml(now)}</div>
              <div>${escapeHtml(t.rowsCount)}: ${formatNumber(rows.length)}</div>
            </div>
          </div>
          <div class="badge">Primey Care</div>
        </div>

        <div class="summary-grid">
          <div class="summary-card"><span>${escapeHtml(t.entriesCount)}</span><strong>${formatNumber(period.journal_entries_count)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.totalDebit)}</span><strong>${formatMoney(period.total_debit)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.totalCredit)}</span><strong>${formatMoney(period.total_credit)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.netAmount)}</span><strong>${formatMoney(period.net_amount)}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${escapeHtml(t.table.entryDate)}</th>
              <th>${escapeHtml(t.table.number)}</th>
              <th>${escapeHtml(t.table.source)}</th>
              <th>${escapeHtml(t.table.reference)}</th>
              <th>${escapeHtml(t.table.description)}</th>
              <th>${escapeHtml(t.table.status)}</th>
              <th>${escapeHtml(t.table.debit)}</th>
              <th>${escapeHtml(t.table.credit)}</th>
              <th>${escapeHtml(t.table.net)}</th>
            </tr>
          </thead>
          <tbody>
            ${
              tableRows ||
              `<tr><td colspan="10" style="text-align:center">${escapeHtml(t.emptyTitle)}</td></tr>`
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

export default function AccountingPeriodDetailPage() {
  const params = useParams<{ id?: string }>();
  const auth = useAuth() as unknown;

  const periodId = String(params?.id || "");

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [period, setPeriod] = useState<AccountingPeriodDetail | null>(null);
  const [journals, setJournals] = useState<PeriodJournalRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [notFound, setNotFound] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<JournalStatusFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("entry_date");
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

  const canViewJournal = hasSafePermission(
    auth,
    ["accounting.view", "accounting.journals.view"],
    "view",
  );

  const filteredJournals = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    const filtered = journals.filter((item) => {
      const matchesStatus =
        statusFilter === "ALL" ? true : item.status === statusFilter;

      const matchesQuery = !cleanQuery
        ? true
        : [
            item.journal_entry_number,
            item.posting_source,
            item.reference,
            item.external_reference,
            item.description,
            journalStatusLabel(item.status, locale),
          ]
            .join(" ")
            .toLowerCase()
            .includes(cleanQuery);

      return matchesStatus && matchesQuery;
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
  }, [journals, locale, query, sortDirection, sortKey, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredJournals.length / PAGE_SIZE));

  const paginatedJournals = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * PAGE_SIZE;

    return filteredJournals.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredJournals, page, totalPages]);

  const hasSearchOrFilter = query.trim().length > 0 || statusFilter !== "ALL";

  const visibleColumnCount = Object.entries(visibleColumns).filter(
    ([key, value]) => value && (key !== "actions" || canViewJournal),
  ).length;

  const statusOptions = useMemo(
    () => [
      { value: "ALL" as JournalStatusFilter, label: t.allStatuses, count: journals.length },
      {
        value: "DRAFT" as JournalStatusFilter,
        label: t.draft,
        count: journals.filter((item) => item.status === "DRAFT").length,
      },
      {
        value: "POSTED" as JournalStatusFilter,
        label: t.posted,
        count: journals.filter((item) => item.status === "POSTED").length,
      },
      {
        value: "CANCELLED" as JournalStatusFilter,
        label: t.cancelled,
        count: journals.filter((item) => item.status === "CANCELLED").length,
      },
    ],
    [journals, t],
  );

  const columnOptions: Array<{ key: keyof VisibleColumns; label: string }> = [
    { key: "entryDate", label: t.table.entryDate },
    { key: "number", label: t.table.number },
    { key: "source", label: t.table.source },
    { key: "reference", label: t.table.reference },
    { key: "description", label: t.table.description },
    { key: "status", label: t.table.status },
    { key: "debit", label: t.table.debit },
    { key: "credit", label: t.table.credit },
    { key: "net", label: t.table.net },
    { key: "actions", label: t.table.action },
  ];

  const loadPeriod = useCallback(
    async (showToast = false) => {
      if (!canView) {
        setIsLoading(false);
        return;
      }

      if (!periodId) {
        setIsLoading(false);
        setNotFound(true);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");
        setNotFound(false);

        const endpoints = [
          `/api/accounting/periods/${periodId}/`,
          `/api/accounting/fiscal-periods/${periodId}/`,
          `/api/accounting/reports/periods/${periodId}/`,
          `/api/accounting/journals/${buildQuery({
            period_id: periodId,
            page_size: 500,
          })}`,
          `/api/accounting/journal-entries/${buildQuery({
            period_id: periodId,
            page_size: 500,
          })}`,
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

        const normalizedPeriod = normalizePeriod(extractData(loadedPayload));
        const normalizedJournals = extractJournals(loadedPayload).map(
          normalizeJournal,
        );

        const debitFromJournals = normalizedJournals.reduce(
          (sum, item) => sum + item.total_debit,
          0,
        );
        const creditFromJournals = normalizedJournals.reduce(
          (sum, item) => sum + item.total_credit,
          0,
        );

        const completedPeriod: AccountingPeriodDetail = {
          ...normalizedPeriod,
          journal_entries_count:
            normalizedPeriod.journal_entries_count ||
            normalizedJournals.length ||
            0,
          total_debit: normalizedPeriod.total_debit || debitFromJournals,
          total_credit: normalizedPeriod.total_credit || creditFromJournals,
          net_amount:
            normalizedPeriod.net_amount ||
            debitFromJournals - creditFromJournals ||
            0,
        };

        if (!isValidId(completedPeriod.id) && !completedPeriod.name) {
          setPeriod(null);
          setJournals([]);
          setNotFound(true);
          return;
        }

        setPeriod(completedPeriod);
        setJournals(normalizedJournals);
        setPage(1);

        if (showToast) {
          toast.success(t.loadSuccess);
        }
      } catch (error) {
        console.error("Accounting period detail load error:", error);
        setPeriod(null);
        setJournals([]);
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [canView, periodId, t.loadError, t.loadSuccess],
  );

  function clearFilters() {
    setQuery("");
    setStatusFilter("ALL");
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
    if (!canExport || !period) return;

    if (filteredJournals.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const generatedAt = new Date();

    downloadExcel({
      filename: `primey-care-period-${period.period_number}-${generatedAt
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "تفاصيل الفترة" : "Period Detail",
      title: t.title,
      locale,
      summaryRows: [
        [t.generatedAt, generatedAt.toLocaleString("en-US")],
        [t.name, period.name],
        [t.number, period.period_number],
        [t.fiscalYear, [period.fiscal_year, period.fiscal_year_name].filter(Boolean).join(" - ") || "-"],
        [t.status, periodStatusLabel(period.status, locale)],
        [t.startDate, formatDate(period.start_date, locale)],
        [t.endDate, formatDate(period.end_date, locale)],
        [t.entriesCount, period.journal_entries_count],
        [t.totalDebit, formatMoney(period.total_debit)],
        [t.totalCredit, formatMoney(period.total_credit)],
        [t.netAmount, formatMoney(period.net_amount)],
      ],
      headers: [
        "ID",
        t.table.entryDate,
        t.table.number,
        t.table.source,
        t.table.reference,
        t.table.description,
        t.table.status,
        t.table.debit,
        t.table.credit,
        t.table.net,
      ],
      rows: filteredJournals.map((item) => [
        item.id || "-",
        formatDate(item.entry_date, locale),
        item.journal_entry_number || "-",
        item.posting_source || "-",
        item.reference || "-",
        item.description || "-",
        journalStatusLabel(item.status, locale),
        formatMoney(item.total_debit),
        formatMoney(item.total_credit),
        formatMoney(item.net_amount),
      ]),
    });

    toast.success(t.exportSuccess);
  }

  function printPage() {
    if (!canPrint || !period) return;

    if (filteredJournals.length === 0) {
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
        period,
        rows: filteredJournals,
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
    loadPeriod(false);
  }, [authResolving, loadPeriod]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

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
            {period
              ? [period.name, period.fiscal_year || period.fiscal_year_name]
                  .filter(Boolean)
                  .join(" - ")
              : t.subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link href="/system/accounting/periods">
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

          <Link href="/system/accounting">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <BarChart3 className="h-4 w-4" />
              <span>{t.accounting}</span>
            </Button>
          </Link>

          <Link href="/system/reports/accounting">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <FileText className="h-4 w-4" />
              <span>{t.reports}</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadPeriod(true)}
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
                isLoading ||
                filteredJournals.length === 0 ||
                Boolean(errorMessage) ||
                !period
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
                isLoading ||
                filteredJournals.length === 0 ||
                Boolean(errorMessage) ||
                !period
              }
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
              onClick={() => loadPeriod(true)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && notFound ? (
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
              <CalendarClock className="h-5 w-5" />
            </div>

            <div>
              <p className="font-semibold">{t.notFoundTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.notFoundText}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!errorMessage && !notFound ? (
        <>
          {isLoading ? (
            <KpiSkeleton />
          ) : period ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-2xl font-bold">
                        {formatNumber(period.journal_entries_count)}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t.entriesCount}
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                      <Layers3 className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-2xl font-bold">
                        <MoneyText value={period.total_debit} />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t.totalDebit}
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                      <WalletCards className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-2xl font-bold">
                        <MoneyText value={period.total_credit} />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t.totalCredit}
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-2xl font-bold">
                        <MoneyText value={period.net_amount} />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t.netAmount}
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {period ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <CalendarClock className="h-4 w-4" />
                    {t.infoTitle}
                  </CardTitle>
                  <CardDescription>{t.infoDesc}</CardDescription>
                </CardHeader>

                <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">{t.number}</p>
                    <p className="mt-2 font-semibold" dir="ltr">
                      {formatNumber(period.period_number)}
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">{t.name}</p>
                    <p className="mt-2 font-semibold">{period.name || "-"}</p>
                  </div>

                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">{t.status}</p>
                    <div className="mt-2">
                      {periodStatusBadge(period.status, locale)}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">
                      {t.fiscalYear}
                    </p>
                    <p className="mt-2 font-semibold" dir="ltr">
                      {period.fiscal_year || "-"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {period.fiscal_year_name || "-"}
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">
                      {t.startDate}
                    </p>
                    <p className="mt-2 font-semibold">
                      {formatDate(period.start_date, locale)}
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">{t.endDate}</p>
                    <p className="mt-2 font-semibold">
                      {formatDate(period.end_date, locale)}
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-background p-4 md:col-span-2 xl:col-span-3">
                    <p className="text-xs text-muted-foreground">{t.notes}</p>
                    <p className="mt-2 text-sm leading-6">
                      {period.notes || "-"}
                    </p>
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
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border bg-background p-4">
                      <p className="text-xs text-muted-foreground">
                        {t.entriesCount}
                      </p>
                      <div className="mt-2 text-lg font-bold">
                        {formatNumber(period.journal_entries_count)}
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-background p-4">
                      <p className="text-xs text-muted-foreground">
                        {t.netAmount}
                      </p>
                      <div className="mt-2 text-lg font-bold">
                        <MoneyText value={period.net_amount} />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-3 py-2 text-sm">
                      <span>{t.totalDebit}</span>
                      <MoneyText value={period.total_debit} />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
                      <span>{t.totalCredit}</span>
                      <MoneyText value={period.total_credit} />
                    </div>
                  </div>

                  <div className="grid gap-2 border-t pt-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarDays className="h-4 w-4" />
                      <span>{t.createdAt}</span>
                    </div>
                    <p className="text-sm">
                      {formatDate(period.created_at, locale)}
                    </p>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarDays className="h-4 w-4" />
                      <span>{t.updatedAt}</span>
                    </div>
                    <p className="text-sm">
                      {formatDate(period.updated_at, locale)}
                    </p>

                    {period.is_closed ? (
                      <>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <LockKeyhole className="h-4 w-4" />
                          <span>{t.closedAt}</span>
                        </div>
                        <p className="text-sm">
                          {formatDate(period.closed_at, locale)}
                        </p>

                        <p className="text-sm text-muted-foreground">
                          {t.closedBy}
                        </p>
                        <p className="text-sm">{period.closed_by_name || "-"}</p>
                      </>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="space-y-4 pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="text-base font-bold">
                    {t.journalsTitle}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {t.journalsDesc}
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl"
                    onClick={() => loadPeriod(true)}
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
              <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
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

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-11 rounded-xl">
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
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-11 rounded-xl">
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
                        if (column.key === "actions" && !canViewJournal) {
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

              <div className="overflow-hidden rounded-xl border">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {visibleColumns.entryDate ? (
                          <TableHead className="min-w-[120px]">
                            <button
                              type="button"
                              onClick={() => toggleSort("entry_date")}
                              className="inline-flex items-center gap-1 font-medium"
                            >
                              {t.table.entryDate}
                              {sortKey === "entry_date" &&
                                (sortDirection === "asc" ? (
                                  <ArrowUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ArrowDown className="h-3.5 w-3.5" />
                                ))}
                            </button>
                          </TableHead>
                        ) : null}

                        {visibleColumns.number ? (
                          <TableHead className="min-w-[130px]">
                            <button
                              type="button"
                              onClick={() => toggleSort("journal_entry_number")}
                              className="inline-flex items-center gap-1 font-medium"
                            >
                              {t.table.number}
                              {sortKey === "journal_entry_number" &&
                                (sortDirection === "asc" ? (
                                  <ArrowUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ArrowDown className="h-3.5 w-3.5" />
                                ))}
                            </button>
                          </TableHead>
                        ) : null}

                        {visibleColumns.source ? (
                          <TableHead className="min-w-[120px]">
                            {t.table.source}
                          </TableHead>
                        ) : null}

                        {visibleColumns.reference ? (
                          <TableHead className="min-w-[140px]">
                            {t.table.reference}
                          </TableHead>
                        ) : null}

                        {visibleColumns.description ? (
                          <TableHead className="min-w-[220px]">
                            {t.table.description}
                          </TableHead>
                        ) : null}

                        {visibleColumns.status ? (
                          <TableHead className="min-w-[120px]">
                            {t.table.status}
                          </TableHead>
                        ) : null}

                        {visibleColumns.debit ? (
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

                        {visibleColumns.credit ? (
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

                        {visibleColumns.net ? (
                          <TableHead className="min-w-[140px]">
                            {t.table.net}
                          </TableHead>
                        ) : null}

                        {visibleColumns.actions && canViewJournal ? (
                          <TableHead className="min-w-[100px]">
                            {t.table.action}
                          </TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {isLoading ? (
                        <TableSkeleton columnsCount={visibleColumnCount || 1} />
                      ) : paginatedJournals.length > 0 ? (
                        paginatedJournals.map((item) => (
                          <TableRow key={`${item.id}-${item.journal_entry_number}`}>
                            {visibleColumns.entryDate ? (
                              <TableCell className="whitespace-nowrap">
                                {formatDate(item.entry_date, locale)}
                              </TableCell>
                            ) : null}

                            {visibleColumns.number ? (
                              <TableCell className="font-semibold">
                                {item.journal_entry_number || "-"}
                              </TableCell>
                            ) : null}

                            {visibleColumns.source ? (
                              <TableCell>{item.posting_source || "-"}</TableCell>
                            ) : null}

                            {visibleColumns.reference ? (
                              <TableCell>{item.reference || "-"}</TableCell>
                            ) : null}

                            {visibleColumns.description ? (
                              <TableCell>
                                <span className="line-clamp-2 min-w-[200px] text-sm text-muted-foreground">
                                  {item.description || "-"}
                                </span>
                              </TableCell>
                            ) : null}

                            {visibleColumns.status ? (
                              <TableCell>
                                {journalStatusBadge(item.status, locale)}
                              </TableCell>
                            ) : null}

                            {visibleColumns.debit ? (
                              <TableCell>
                                <MoneyText value={item.total_debit} />
                              </TableCell>
                            ) : null}

                            {visibleColumns.credit ? (
                              <TableCell>
                                <MoneyText value={item.total_credit} />
                              </TableCell>
                            ) : null}

                            {visibleColumns.net ? (
                              <TableCell>
                                <MoneyText value={item.net_amount} />
                              </TableCell>
                            ) : null}

                            {visibleColumns.actions && canViewJournal ? (
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
                              <Layers3 className="h-10 w-10 text-muted-foreground/40" />
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
                  {t.showing} {formatNumber(paginatedJournals.length)} {t.from}{" "}
                  {formatNumber(filteredJournals.length)}
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
        </>
      ) : null}
    </div>
  );
}