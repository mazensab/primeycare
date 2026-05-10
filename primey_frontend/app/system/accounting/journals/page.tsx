"use client";

/* ============================================================
   📂 app/system/accounting/journals/page.tsx
   🧠 Primey Care | Accounting Journal Entries List

   ✅ المسار:
      app/system/accounting/journals/page.tsx

   ✅ العمل:
      صفحة قائمة القيود اليومية داخل مديول المحاسبة.
      تعرض حالة القيود اليومية، الملخص المالي، وجدول القيود بنفس التصميم التشغيلي المعتمد.

   ✅ الإصدار:
      Phase 17 UX Refinement + Restore Approved Journals UI

   ✅ يعتمد على:
      - /api/accounting/journals/?page=1&page_size=20
      - /api/accounting/journal-entries/?page=1&page_size=20 كـ fallback آمن
      - primey-locale
      - AuthProvider
      - sonner
      - /currency/sar.svg

   ✅ متوافق مع:
      - Accounting module approved pattern
      - Journals previous working UI
      - Centers / Customers approved UX standard

   ✅ الوظائف:
      - عرض القيود اليومية بنفس التصميم السابق.
      - كرت حالة القيود اليومية مع الجدول والفلاتر والبحث.
      - كرت ملخص القيود الجانبي.
      - KPI cards أسفل الصفحة.
      - بحث في صف مستقل داخل الكرت.
      - فلاتر وأعمدة في صف منفصل.
      - Excel export بصيغة .xls HTML Workbook.
      - Web PDF Print.
      - Skeleton Loading.
      - Error State مستقل.
      - Empty State ذكي.
      - صلاحيات آمنة بدون كسر system_admin/superuser.
      - أرقام إنجليزية دائمًا.
      - رمز SAR من /currency/sar.svg بعد الرقم.

   ------------------------------------------------------------
   تحسينات هذا الإصدار:
      - الرجوع لتصميم الصفحة السابق الذي كان يعمل.
      - إزالة سبب خطأ 400 باستخدام page=1&page_size=20 بدل page_size=300.
      - عدم استخدام main / min-h-screen / max-w-*.
      - عدم تغيير بنية الصفحة أو تحويلها لتصميم آخر.
      - إضافة fallback آمن إذا اختلف اسم endpoint.
      - دعم مصادر الترحيل الجديدة بدون كسر التصميم.
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Columns3,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  PlusCircle,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  WalletCards,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

type JournalStatus =
  | "DRAFT"
  | "POSTED"
  | "CANCELLED"
  | "REVERSED"
  | "UNKNOWN";

type PostingSource =
  | "MANUAL"
  | "ORDER"
  | "PAYMENT"
  | "INVOICE"
  | "REFUND"
  | "ADJUSTMENT"
  | "TREASURY"
  | "COMMISSION"
  | "OPENING"
  | "SYSTEM"
  | "OTHER"
  | "UNKNOWN";

type StatusFilter = "ALL" | JournalStatus;
type SourceFilter = "ALL" | PostingSource;

type SortKey =
  | "entry_number"
  | "entry_date"
  | "posting_source"
  | "status"
  | "total_debit"
  | "total_credit"
  | "created_at";

type SortDirection = "asc" | "desc";

type JournalEntry = {
  id: string;
  entry_number: string;
  entry_date: string;
  status: JournalStatus;
  posting_source: PostingSource;
  reference: string;
  external_reference: string;
  description: string;
  notes: string;
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
  lines_count: number;
  cost_center_name: string;
  cost_center_code: string;
  created_at: string;
  updated_at: string;
};

type JournalsSummary = {
  total_entries: number;
  total_debit: number;
  total_credit: number;
  balanced_entries_count: number;
  unbalanced_entries_count: number;
  posted_entries_count: number;
  draft_entries_count: number;
  cancelled_entries_count: number;
  reversed_entries_count: number;
  cost_center_entries_count: number;
  is_balanced_total: boolean;
};

type JournalsPayload = {
  ok?: boolean;
  success?: boolean;
  message?: string;
  detail?: string;
  error?: string;
  count?: number;
  results?: unknown[];
  journal_entries?: unknown[];
  entries?: unknown[];
  items?: unknown[];
  rows?: unknown[];
  summary?: Partial<JournalsSummary>;
  data?: {
    count?: number;
    results?: unknown[];
    journal_entries?: unknown[];
    entries?: unknown[];
    items?: unknown[];
    rows?: unknown[];
    summary?: Partial<JournalsSummary>;
  };
  pagination?: {
    total_items?: number;
    count?: number;
    page?: number;
    page_size?: number;
    total_pages?: number;
  };
};

type VisibleColumns = {
  select: boolean;
  number: boolean;
  date: boolean;
  source: boolean;
  reference: boolean;
  debit: boolean;
  credit: boolean;
  status: boolean;
  balance: boolean;
  actions: boolean;
};

const SAR_ICON_PATH = "/currency/sar.svg";
const PAGE_SIZE = 20;

const DEFAULT_SUMMARY: JournalsSummary = {
  total_entries: 0,
  total_debit: 0,
  total_credit: 0,
  balanced_entries_count: 0,
  unbalanced_entries_count: 0,
  posted_entries_count: 0,
  draft_entries_count: 0,
  cancelled_entries_count: 0,
  reversed_entries_count: 0,
  cost_center_entries_count: 0,
  is_balanced_total: true,
};

const DEFAULT_COLUMNS: VisibleColumns = {
  select: true,
  number: true,
  date: true,
  source: true,
  reference: true,
  debit: true,
  credit: true,
  status: true,
  balance: false,
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
    title: isArabic ? "القيود اليومية" : "Journal Entries",
    subtitle: isArabic
      ? "إدارة ومراجعة القيود اليومية المرحلة والمسودات مع البحث، الفلاتر، الأعمدة، والتصدير."
      : "Manage and review posted and draft journal entries with search, filters, columns, and export.",

    accounting: isArabic ? "المحاسبة" : "Accounting",
    ledger: isArabic ? "دفتر الأستاذ" : "General Ledger",
    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    create: isArabic ? "إنشاء قيد" : "Create Entry",
    columns: isArabic ? "الأعمدة" : "Columns",
    filters: isArabic ? "الفلاتر" : "Filters",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",
    viewDetails: isArabic ? "عرض التفاصيل" : "View Details",

    statusCardTitle: isArabic ? "حالة القيود اليومية" : "Journal Status",
    statusCardDesc: isArabic
      ? "تحليل سريع للقيود، إجمالي المدين والدائن، وحالة التوازن."
      : "Quick analysis for entries, debit, credit, and balance state.",
    summaryCardTitle: isArabic ? "ملخص القيود" : "Entries Summary",
    summaryCardDesc: isArabic
      ? "أهم المؤشرات الحالية من القيود اليومية."
      : "Main current indicators from journal entries.",

    totalEntries: isArabic ? "إجمالي القيود" : "Total Entries",
    postedEntries: isArabic ? "قيود مرحلة" : "Posted Entries",
    draftEntries: isArabic ? "قيود مسودة" : "Draft Entries",
    unbalancedEntries: isArabic ? "غير متوازنة" : "Unbalanced",
    balancedEntries: isArabic ? "قيود متوازنة" : "Balanced Entries",
    costCenterEntries: isArabic ? "مرتبطة بمراكز تكلفة" : "With Cost Centers",

    totalDebit: isArabic ? "إجمالي المدين" : "Total Debit",
    totalCredit: isArabic ? "إجمالي الدائن" : "Total Credit",
    balanceDifference: isArabic ? "فرق التوازن" : "Balance Difference",

    all: isArabic ? "الكل" : "All",
    allStatuses: isArabic ? "الكل" : "All",
    allSources: isArabic ? "كل المصادر" : "All Sources",

    draft: isArabic ? "مسودة" : "Draft",
    posted: isArabic ? "مرحّل" : "Posted",
    cancelled: isArabic ? "ملغي" : "Cancelled",
    reversed: isArabic ? "معكوس" : "Reversed",
    unknown: isArabic ? "غير محدد" : "Unknown",

    manual: isArabic ? "يدوي" : "Manual",
    order: isArabic ? "طلب" : "Order",
    payment: isArabic ? "دفعة" : "Payment",
    invoice: isArabic ? "فاتورة" : "Invoice",
    refund: isArabic ? "استرداد" : "Refund",
    adjustment: isArabic ? "تسوية" : "Adjustment",
    treasury: isArabic ? "خزينة" : "Treasury",
    commission: isArabic ? "عمولة" : "Commission",
    opening: isArabic ? "رصيد افتتاحي" : "Opening",
    system: isArabic ? "النظام" : "System",
    other: isArabic ? "أخرى" : "Other",

    balanced: isArabic ? "متوازن" : "Balanced",
    notBalanced: isArabic ? "غير متوازن" : "Not Balanced",

    searchPlaceholder: isArabic
      ? "ابحث في رقم القيد أو المرجع أو الوصف..."
      : "Search by entry number, reference, or description...",

    table: {
      select: isArabic ? "تحديد" : "Select",
      number: isArabic ? "رقم القيد" : "Entry No.",
      date: isArabic ? "التاريخ" : "Date",
      source: isArabic ? "المصدر" : "Source",
      reference: isArabic ? "المرجع" : "Reference",
      debit: isArabic ? "إجمالي المدين" : "Total Debit",
      credit: isArabic ? "إجمالي الدائن" : "Total Credit",
      status: isArabic ? "الحالة" : "Status",
      balance: isArabic ? "التوازن" : "Balance",
      action: isArabic ? "الإجراء" : "Action",
    },

    emptyTitle: isArabic ? "لا توجد قيود يومية" : "No journal entries",
    emptyText: isArabic
      ? "ستظهر القيود اليومية هنا بعد تسجيل أول قيد."
      : "Journal entries will appear here after the first entry is recorded.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير البحث أو الفلاتر."
      : "Try changing the search or filters.",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض القيود" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض القيود اليومية. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view journal entries. Contact your system administrator if you need access.",

    apiError: isArabic
      ? "تعذر تحميل القيود اليومية."
      : "Unable to load journal entries.",
    apiErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    refreshSuccess: isArabic
      ? "تم تحديث القيود اليومية بنجاح."
      : "Journal entries refreshed successfully.",
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

    next: isArabic ? "التالي" : "Next",
    previous: isArabic ? "السابق" : "Previous",
    showing: isArabic ? "عرض" : "Showing",
    from: isArabic ? "من" : "of",
    generatedAt: isArabic ? "تاريخ التصدير" : "Generated At",
    printedAt: isArabic ? "تاريخ الطباعة" : "Printed At",
    rowsCount: isArabic ? "عدد السجلات" : "Rows Count",
    yes: isArabic ? "نعم" : "Yes",
    no: isArabic ? "لا" : "No",
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

function formatDate(value: string): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

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

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

function isValidId(id: unknown) {
  const value = String(id || "").trim();
  return value.length > 0 && value !== "-" && value !== "undefined";
}

function getValue(obj: Dict, key: string): unknown {
  const direct = obj[key];

  if (direct !== undefined && direct !== null && direct !== "") {
    return direct;
  }

  for (const container of [
    "entry",
    "journal",
    "journal_entry",
    "account",
    "cost_center",
    "costCenter",
    "data",
    "item",
  ]) {
    const nested = obj[container];

    if (nested && typeof nested === "object") {
      const value = (nested as Dict)[key];

      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }
  }

  return undefined;
}

function normalizeStatus(value: unknown): JournalStatus {
  const status = String(value || "").toUpperCase();

  if (status === "DRAFT") return "DRAFT";
  if (status === "POSTED" || status === "CONFIRMED") return "POSTED";
  if (status === "CANCELLED" || status === "CANCELED") return "CANCELLED";
  if (status === "REVERSED") return "REVERSED";

  return "UNKNOWN";
}

function normalizePostingSource(value: unknown): PostingSource {
  const source = String(value || "").toUpperCase();

  if (source.includes("COMMISSION")) return "COMMISSION";
  if (source.includes("PAYMENT")) return "PAYMENT";
  if (source.includes("INVOICE")) return "INVOICE";
  if (source.includes("ORDER")) return "ORDER";
  if (source.includes("TREASURY")) return "TREASURY";
  if (source.includes("OPENING")) return "OPENING";
  if (source.includes("ADJUSTMENT") || source.includes("SETTLEMENT")) {
    return "ADJUSTMENT";
  }
  if (source.includes("REFUND")) return "REFUND";
  if (source.includes("SYSTEM") || source.includes("AUTO")) return "SYSTEM";
  if (source.includes("MANUAL") || source.includes("USER")) return "MANUAL";
  if (source.includes("OTHER")) return "OTHER";

  return "UNKNOWN";
}

function toBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;

  if (value === undefined || value === null || value === "") return fallback;

  const clean = String(value).toLowerCase();

  if (["true", "1", "yes", "balanced"].includes(clean)) return true;
  if (["false", "0", "no", "unbalanced"].includes(clean)) return false;

  return fallback;
}

function normalizeJournalEntry(item: unknown): JournalEntry {
  const obj = asDict(item);

  const id = String(getValue(obj, "id") || "");
  const totalDebit = toNumber(
    getValue(obj, "total_debit") ||
      getValue(obj, "debit_amount") ||
      getValue(obj, "debit") ||
      0,
  );
  const totalCredit = toNumber(
    getValue(obj, "total_credit") ||
      getValue(obj, "credit_amount") ||
      getValue(obj, "credit") ||
      0,
  );

  return {
    id,
    entry_number: String(
      getValue(obj, "entry_number") ||
        getValue(obj, "journal_number") ||
        getValue(obj, "number") ||
        getValue(obj, "code") ||
        id ||
        "-",
    ),
    entry_date: String(
      getValue(obj, "entry_date") ||
        getValue(obj, "journal_date") ||
        getValue(obj, "date") ||
        getValue(obj, "created_at") ||
        "",
    ),
    status: normalizeStatus(getValue(obj, "status")),
    posting_source: normalizePostingSource(
      getValue(obj, "posting_source") ||
        getValue(obj, "source") ||
        getValue(obj, "source_type"),
    ),
    reference: String(getValue(obj, "reference") || ""),
    external_reference: String(
      getValue(obj, "external_reference") ||
        getValue(obj, "source_reference") ||
        "",
    ),
    description: String(
      getValue(obj, "description") ||
        getValue(obj, "memo") ||
        getValue(obj, "notes") ||
        "",
    ),
    notes: String(getValue(obj, "notes") || ""),
    total_debit: totalDebit,
    total_credit: totalCredit,
    is_balanced: toBoolean(
      getValue(obj, "is_balanced"),
      Math.abs(totalDebit - totalCredit) < 0.005,
    ),
    lines_count: toNumber(
      getValue(obj, "lines_count") ||
        getValue(obj, "items_count") ||
        getValue(obj, "details_count") ||
        getValue(obj, "lines") ||
        0,
    ),
    cost_center_name: String(getValue(obj, "cost_center_name") || ""),
    cost_center_code: String(getValue(obj, "cost_center_code") || ""),
    created_at: String(getValue(obj, "created_at") || ""),
    updated_at: String(getValue(obj, "updated_at") || ""),
  };
}

function extractRows(payload: JournalsPayload | null): unknown[] {
  if (!payload) return [];

  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.journal_entries)) return payload.journal_entries;
  if (Array.isArray(payload.entries)) return payload.entries;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.rows)) return payload.rows;

  if (Array.isArray(payload.data?.results)) return payload.data.results;
  if (Array.isArray(payload.data?.journal_entries)) {
    return payload.data.journal_entries;
  }
  if (Array.isArray(payload.data?.entries)) return payload.data.entries;
  if (Array.isArray(payload.data?.items)) return payload.data.items;
  if (Array.isArray(payload.data?.rows)) return payload.data.rows;

  return [];
}

function extractSummary(payload: JournalsPayload | null): Partial<JournalsSummary> {
  return payload?.data?.summary || payload?.summary || {};
}

function extractTotalCount(payload: JournalsPayload | null, rowsCount: number) {
  return (
    toNumber(payload?.pagination?.total_items) ||
    toNumber(payload?.pagination?.count) ||
    toNumber(payload?.data?.count) ||
    toNumber(payload?.count) ||
    rowsCount
  );
}

function normalizeSummary(
  rows: JournalEntry[],
  summary?: Partial<JournalsSummary>,
  totalCount?: number,
): JournalsSummary {
  const fallbackTotalDebit = rows.reduce(
    (sum, item) => sum + item.total_debit,
    0,
  );
  const fallbackTotalCredit = rows.reduce(
    (sum, item) => sum + item.total_credit,
    0,
  );

  const fallback: JournalsSummary = {
    total_entries: totalCount || rows.length,
    total_debit: fallbackTotalDebit,
    total_credit: fallbackTotalCredit,
    balanced_entries_count: rows.filter((item) => item.is_balanced).length,
    unbalanced_entries_count: rows.filter((item) => !item.is_balanced).length,
    posted_entries_count: rows.filter((item) => item.status === "POSTED").length,
    draft_entries_count: rows.filter((item) => item.status === "DRAFT").length,
    cancelled_entries_count: rows.filter((item) => item.status === "CANCELLED")
      .length,
    reversed_entries_count: rows.filter((item) => item.status === "REVERSED")
      .length,
    cost_center_entries_count: rows.filter(
      (item) => item.cost_center_name || item.cost_center_code,
    ).length,
    is_balanced_total: Math.abs(fallbackTotalDebit - fallbackTotalCredit) < 0.005,
  };

  return {
    total_entries: toNumber(summary?.total_entries) || fallback.total_entries,
    total_debit: toNumber(summary?.total_debit) || fallback.total_debit,
    total_credit: toNumber(summary?.total_credit) || fallback.total_credit,
    balanced_entries_count:
      toNumber(summary?.balanced_entries_count) ||
      fallback.balanced_entries_count,
    unbalanced_entries_count:
      toNumber(summary?.unbalanced_entries_count) ||
      fallback.unbalanced_entries_count,
    posted_entries_count:
      toNumber(summary?.posted_entries_count) || fallback.posted_entries_count,
    draft_entries_count:
      toNumber(summary?.draft_entries_count) || fallback.draft_entries_count,
    cancelled_entries_count:
      toNumber(summary?.cancelled_entries_count) ||
      fallback.cancelled_entries_count,
    reversed_entries_count:
      toNumber(summary?.reversed_entries_count) ||
      fallback.reversed_entries_count,
    cost_center_entries_count:
      toNumber(summary?.cost_center_entries_count) ||
      fallback.cost_center_entries_count,
    is_balanced_total:
      typeof summary?.is_balanced_total === "boolean"
        ? summary.is_balanced_total
        : fallback.is_balanced_total,
  };
}

function statusLabel(status: JournalStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<JournalStatus, string> = {
    DRAFT: t.draft,
    POSTED: t.posted,
    CANCELLED: t.cancelled,
    REVERSED: t.reversed,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function sourceLabel(source: PostingSource, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<PostingSource, string> = {
    MANUAL: t.manual,
    ORDER: t.order,
    PAYMENT: t.payment,
    INVOICE: t.invoice,
    REFUND: t.refund,
    ADJUSTMENT: t.adjustment,
    TREASURY: t.treasury,
    COMMISSION: t.commission,
    OPENING: t.opening,
    SYSTEM: t.system,
    OTHER: t.other,
    UNKNOWN: t.unknown,
  };

  return labels[source];
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

function statusBadge(status: JournalStatus, locale: AppLocale) {
  const label = statusLabel(status, locale);

  if (status === "POSTED") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (status === "DRAFT") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
        {label}
      </Badge>
    );
  }

  if (status === "CANCELLED" || status === "REVERSED") {
    return (
      <Badge variant="destructive" className="rounded-full px-3 py-1">
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="rounded-full px-3 py-1">
      {label}
    </Badge>
  );
}

function sourceBadge(source: PostingSource, locale: AppLocale) {
  const label = sourceLabel(source, locale);

  if (source === "PAYMENT" || source === "TREASURY") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (source === "INVOICE" || source === "ORDER") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
        {label}
      </Badge>
    );
  }

  if (source === "COMMISSION" || source === "OPENING") {
    return (
      <Badge className="rounded-full border-amber-200 bg-amber-50 px-3 py-1 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="rounded-full px-3 py-1">
      {label}
    </Badge>
  );
}

function balanceBadge(isBalanced: boolean, locale: AppLocale) {
  const t = dictionary(locale);

  if (isBalanced) {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {t.balanced}
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className="rounded-full px-3 py-1">
      {t.notBalanced}
    </Badge>
  );
}

function sortValue(row: JournalEntry, key: SortKey): string | number {
  if (key === "total_debit") return row.total_debit;
  if (key === "total_credit") return row.total_credit;

  return String(row[key] || "");
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
      {Array.from({ length: 3 }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columnsCount }).map((__, columnIndex) => (
            <TableCell key={columnIndex}>
              <SkeletonLine
                className={
                  columnIndex === 1
                    ? "h-8 w-28 rounded-lg"
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

function KpiCardSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <SkeletonLine className="h-8 w-28" />
                <SkeletonLine className="h-4 w-24" />
              </div>
              <SkeletonLine className="h-11 w-11 rounded-2xl" />
            </div>
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
            ${locale === "ar" ? "ملخص القيود" : "Entries Summary"}
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
  rows: JournalEntry[];
  summary: JournalsSummary;
  t: ReturnType<typeof dictionary>;
}) {
  const isArabic = locale === "ar";
  const now = new Date().toLocaleString("en-US");
  const difference = summary.total_debit - summary.total_credit;

  const tableRows = rows
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.entry_number || "-")}</td>
          <td>${escapeHtml(formatDate(item.entry_date || item.created_at))}</td>
          <td>${escapeHtml(sourceLabel(item.posting_source, locale))}</td>
          <td>${escapeHtml(statusLabel(item.status, locale))}</td>
          <td>${escapeHtml(formatMoney(item.total_debit))}</td>
          <td>${escapeHtml(formatMoney(item.total_credit))}</td>
          <td>${escapeHtml(item.reference || item.external_reference || "-")}</td>
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
          <div class="summary-card"><span>${escapeHtml(t.totalEntries)}</span><strong>${formatNumber(summary.total_entries)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.totalDebit)}</span><strong>${formatMoney(summary.total_debit)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.totalCredit)}</span><strong>${formatMoney(summary.total_credit)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.balanceDifference)}</span><strong>${formatMoney(difference)}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${escapeHtml(t.table.number)}</th>
              <th>${escapeHtml(t.table.date)}</th>
              <th>${escapeHtml(t.table.source)}</th>
              <th>${escapeHtml(t.table.status)}</th>
              <th>${escapeHtml(t.table.debit)}</th>
              <th>${escapeHtml(t.table.credit)}</th>
              <th>${escapeHtml(t.table.reference)}</th>
            </tr>
          </thead>
          <tbody>
            ${
              tableRows ||
              `<tr><td colspan="8" style="text-align:center">${escapeHtml(t.emptyTitle)}</td></tr>`
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

export default function SystemAccountingJournalsPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [rows, setRows] = useState<JournalEntry[]>([]);
  const [summary, setSummary] = useState<JournalsSummary>(DEFAULT_SUMMARY);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("entry_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] =
    useState<VisibleColumns>(DEFAULT_COLUMNS);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canView = hasSafePermission(
    auth,
    ["accounting.view", "accounting.journals.view"],
    "view",
  );

  const canCreate = hasSafePermission(
    auth,
    ["accounting.create", "accounting.journals.create", "accounting.post"],
    "action",
  );

  const canExport = hasSafePermission(
    auth,
    ["accounting.export", "reports.accounting.export"],
    "action",
  );

  const canPrint = hasSafePermission(
    auth,
    ["accounting.print", "reports.accounting.print"],
    "action",
  );

  const canViewDetails = hasSafePermission(
    auth,
    ["accounting.view", "accounting.journals.view", "accounting.detail"],
    "view",
  );

  const filteredRows = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    const filtered = rows.filter((item) => {
      const matchesStatus =
        statusFilter === "ALL" ? true : item.status === statusFilter;

      const matchesSource =
        sourceFilter === "ALL" ? true : item.posting_source === sourceFilter;

      const matchesQuery = !cleanQuery
        ? true
        : [
            item.entry_number,
            item.reference,
            item.external_reference,
            item.description,
            item.notes,
            statusLabel(item.status, locale),
            sourceLabel(item.posting_source, locale),
          ]
            .join(" ")
            .toLowerCase()
            .includes(cleanQuery);

      return matchesStatus && matchesSource && matchesQuery;
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
  }, [locale, query, rows, sortDirection, sortKey, sourceFilter, statusFilter]);

  const hasSearchOrFilter =
    query.trim().length > 0 ||
    statusFilter !== "ALL" ||
    sourceFilter !== "ALL";

  const allFilteredSelected =
    filteredRows.length > 0 &&
    filteredRows.every((item) => selectedIds.includes(item.id));

  const visibleColumnCount = Object.entries(visibleColumns).filter(
    ([key, value]) => value && (key !== "actions" || canViewDetails),
  ).length;

  const totalPages = Math.max(1, Math.ceil((totalRows || rows.length) / PAGE_SIZE));

  const statusOptions = useMemo(
    () => [
      { value: "ALL" as StatusFilter, label: t.allStatuses, count: rows.length },
      {
        value: "POSTED" as StatusFilter,
        label: t.posted,
        count: rows.filter((item) => item.status === "POSTED").length,
      },
      {
        value: "DRAFT" as StatusFilter,
        label: t.draft,
        count: rows.filter((item) => item.status === "DRAFT").length,
      },
      {
        value: "CANCELLED" as StatusFilter,
        label: t.cancelled,
        count: rows.filter((item) => item.status === "CANCELLED").length,
      },
      {
        value: "REVERSED" as StatusFilter,
        label: t.reversed,
        count: rows.filter((item) => item.status === "REVERSED").length,
      },
    ],
    [rows, t],
  );

  const sourceOptions = useMemo(
    () => [
      { value: "ALL" as SourceFilter, label: t.allSources, count: rows.length },
      {
        value: "PAYMENT" as SourceFilter,
        label: t.payment,
        count: rows.filter((item) => item.posting_source === "PAYMENT").length,
      },
      {
        value: "INVOICE" as SourceFilter,
        label: t.invoice,
        count: rows.filter((item) => item.posting_source === "INVOICE").length,
      },
      {
        value: "COMMISSION" as SourceFilter,
        label: t.commission,
        count: rows.filter((item) => item.posting_source === "COMMISSION").length,
      },
      {
        value: "TREASURY" as SourceFilter,
        label: t.treasury,
        count: rows.filter((item) => item.posting_source === "TREASURY").length,
      },
      {
        value: "MANUAL" as SourceFilter,
        label: t.manual,
        count: rows.filter((item) => item.posting_source === "MANUAL").length,
      },
    ],
    [rows, t],
  );

  const loadJournals = useCallback(
    async (pageNumber = page, showToast = false) => {
      if (!canView) {
        setRows([]);
        setSummary(DEFAULT_SUMMARY);
        setTotalRows(0);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");

        const endpoints = [
          `/api/accounting/journals/?page=${pageNumber}&page_size=${PAGE_SIZE}`,
          `/api/accounting/journal-entries/?page=${pageNumber}&page_size=${PAGE_SIZE}`,
          "/api/accounting/journals/",
          "/api/accounting/journal-entries/",
        ];

        let loadedPayload: JournalsPayload | null = null;
        let loaded = false;
        let lastError = "";

        for (const endpoint of endpoints) {
          const response = await fetch(apiUrl(endpoint), {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
          });

          const payload = (await response.json().catch(() => null)) as
            | JournalsPayload
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
          throw new Error(lastError || t.apiError);
        }

        const normalizedRows = extractRows(loadedPayload).map(normalizeJournalEntry);
        const count = extractTotalCount(loadedPayload, normalizedRows.length);

        setRows(normalizedRows);
        setTotalRows(count);
        setSummary(
          normalizeSummary(normalizedRows, extractSummary(loadedPayload), count),
        );
        setSelectedIds([]);
        setPage(pageNumber);

        if (showToast) {
          toast.success(t.refreshSuccess);
        }
      } catch (error) {
        console.error("Journal entries load error:", error);
        setRows([]);
        setSummary(DEFAULT_SUMMARY);
        setTotalRows(0);
        setErrorMessage(t.apiError);
        toast.error(t.apiError);
      } finally {
        setIsLoading(false);
      }
    },
    [canView, page, t.apiError, t.refreshSuccess],
  );

  function clearFilters() {
    setQuery("");
    setStatusFilter("ALL");
    setSourceFilter("ALL");
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("desc");
  }

  function toggleRow(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function toggleAllFiltered() {
    if (allFilteredSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !filteredRows.some((row) => row.id === id)),
      );
      return;
    }

    setSelectedIds((current) =>
      Array.from(new Set([...current, ...filteredRows.map((item) => item.id)])),
    );
  }

  function exportExcel() {
    if (!canExport) return;

    if (filteredRows.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const generatedAt = new Date();

    downloadExcel({
      filename: `primey-care-journal-entries-${generatedAt
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "القيود اليومية" : "Journal Entries",
      title: t.title,
      locale,
      summaryRows: [
        [t.generatedAt, generatedAt.toLocaleString("en-US")],
        [t.totalEntries, summary.total_entries],
        [t.totalDebit, formatMoney(summary.total_debit)],
        [t.totalCredit, formatMoney(summary.total_credit)],
        [t.balanceDifference, formatMoney(summary.total_debit - summary.total_credit)],
        [t.postedEntries, summary.posted_entries_count],
        [t.draftEntries, summary.draft_entries_count],
        [t.unbalancedEntries, summary.unbalanced_entries_count],
      ],
      headers: [
        "ID",
        t.table.number,
        t.table.date,
        t.table.source,
        t.table.status,
        t.table.reference,
        t.table.debit,
        t.table.credit,
        t.table.balance,
      ],
      rows: filteredRows.map((item) => [
        item.id || "-",
        item.entry_number || "-",
        formatDate(item.entry_date || item.created_at),
        sourceLabel(item.posting_source, locale),
        statusLabel(item.status, locale),
        item.reference || item.external_reference || "-",
        formatMoney(item.total_debit),
        formatMoney(item.total_credit),
        item.is_balanced ? t.yes : t.no,
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

      window.setTimeout(() => {
        syncLocale();
      }, 0);
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
    loadJournals(1, false);
  }, [authResolving, loadJournals]);

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
              <span>{t.accounting}</span>
            </Button>
          </Link>

          <Link href="/system/accounting/ledger">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <BookOpen className="h-4 w-4" />
              <span>{t.ledger}</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadJournals(page, true)}
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
            <Link href="/system/accounting/journals/create">
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
                  {t.apiErrorHint}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => loadJournals(page, true)}
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
                    {t.statusCardTitle}
                  </CardTitle>
                  <CardDescription>{t.statusCardDesc}</CardDescription>
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
                  <KpiCardSkeleton />
                ) : (
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border bg-background p-4">
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" />
                        {t.totalEntries}
                      </p>
                      <div className="mt-3 text-2xl font-bold">
                        {formatNumber(summary.total_entries)}
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-slate-950 dark:bg-slate-200" />
                    </div>

                    <div className="rounded-2xl border bg-background p-4">
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {t.balancedEntries}
                      </p>
                      <div className="mt-3 text-2xl font-bold">
                        {formatNumber(summary.balanced_entries_count)}
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-emerald-500" />
                    </div>

                    <div className="rounded-2xl border bg-background p-4">
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <TrendingUp className="h-3.5 w-3.5" />
                        {t.totalDebit}
                      </p>
                      <div className="mt-3 text-2xl font-bold">
                        <MoneyText value={summary.total_debit} />
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-slate-950 dark:bg-slate-200" />
                    </div>

                    <div className="rounded-2xl border bg-background p-4">
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <TrendingDown className="h-3.5 w-3.5" />
                        {t.totalCredit}
                      </p>
                      <div className="mt-3 text-2xl font-bold">
                        <MoneyText value={summary.total_credit} />
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-sky-500" />
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

                      <DropdownMenuContent align={isArabic ? "start" : "end"}>
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
                        <DropdownMenuLabel>{t.allSources}</DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        {sourceOptions.map((item) => (
                          <DropdownMenuCheckboxItem
                            key={item.value}
                            checked={sourceFilter === item.value}
                            onCheckedChange={() => setSourceFilter(item.value)}
                          >
                            {item.label} ({formatNumber(item.count)})
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-10 rounded-xl">
                          <Columns3 className="h-4 w-4" />
                          {t.columns}
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align={isArabic ? "start" : "end"}>
                        <DropdownMenuLabel>{t.columns}</DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        {Object.entries(visibleColumns).map(([key, value]) => {
                          if (key === "actions" && !canViewDetails) return null;

                          return (
                            <DropdownMenuCheckboxItem
                              key={key}
                              checked={value}
                              onCheckedChange={(checked) =>
                                setVisibleColumns((current) => ({
                                  ...current,
                                  [key]: Boolean(checked),
                                }))
                              }
                            >
                              {key === "select"
                                ? t.table.select
                                : key === "number"
                                  ? t.table.number
                                  : key === "date"
                                    ? t.table.date
                                    : key === "source"
                                      ? t.table.source
                                      : key === "reference"
                                        ? t.table.reference
                                        : key === "debit"
                                          ? t.table.debit
                                          : key === "credit"
                                            ? t.table.credit
                                            : key === "status"
                                              ? t.table.status
                                              : key === "balance"
                                                ? t.table.balance
                                                : t.table.action}
                            </DropdownMenuCheckboxItem>
                          );
                        })}
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
                          {visibleColumns.select ? (
                            <TableHead className="w-[48px]">
                              <Checkbox
                                checked={allFilteredSelected}
                                onCheckedChange={toggleAllFiltered}
                                aria-label={t.table.select}
                              />
                            </TableHead>
                          ) : null}

                          {visibleColumns.number ? (
                            <TableHead>
                              <button
                                type="button"
                                onClick={() => toggleSort("entry_number")}
                                className="inline-flex items-center gap-1 font-medium"
                              >
                                {t.table.number}
                                {sortKey === "entry_number" &&
                                  (sortDirection === "asc" ? (
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  ) : (
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  ))}
                              </button>
                            </TableHead>
                          ) : null}

                          {visibleColumns.date ? (
                            <TableHead>
                              <button
                                type="button"
                                onClick={() => toggleSort("entry_date")}
                                className="inline-flex items-center gap-1 font-medium"
                              >
                                {t.table.date}
                                {sortKey === "entry_date" &&
                                  (sortDirection === "asc" ? (
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  ) : (
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  ))}
                              </button>
                            </TableHead>
                          ) : null}

                          {visibleColumns.source ? (
                            <TableHead>{t.table.source}</TableHead>
                          ) : null}

                          {visibleColumns.reference ? (
                            <TableHead>{t.table.reference}</TableHead>
                          ) : null}

                          {visibleColumns.debit ? (
                            <TableHead>{t.table.debit}</TableHead>
                          ) : null}

                          {visibleColumns.credit ? (
                            <TableHead>{t.table.credit}</TableHead>
                          ) : null}

                          {visibleColumns.status ? (
                            <TableHead>{t.table.status}</TableHead>
                          ) : null}

                          {visibleColumns.balance ? (
                            <TableHead>{t.table.balance}</TableHead>
                          ) : null}

                          {visibleColumns.actions && canViewDetails ? (
                            <TableHead>{t.table.action}</TableHead>
                          ) : null}
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {isLoading ? (
                          <TableSkeleton columnsCount={visibleColumnCount || 1} />
                        ) : filteredRows.length > 0 ? (
                          filteredRows.map((item) => (
                            <TableRow key={`${item.id}-${item.entry_number}`}>
                              {visibleColumns.select ? (
                                <TableCell>
                                  <Checkbox
                                    checked={selectedIds.includes(item.id)}
                                    onCheckedChange={() => toggleRow(item.id)}
                                    aria-label={t.table.select}
                                  />
                                </TableCell>
                              ) : null}

                              {visibleColumns.number ? (
                                <TableCell>
                                  <div className="min-w-[100px] font-semibold">
                                    {item.entry_number || "-"}
                                  </div>
                                </TableCell>
                              ) : null}

                              {visibleColumns.date ? (
                                <TableCell>
                                  <span className="whitespace-nowrap">
                                    {formatDate(
                                      item.entry_date || item.created_at,
                                    )}
                                  </span>
                                </TableCell>
                              ) : null}

                              {visibleColumns.source ? (
                                <TableCell>
                                  {sourceBadge(item.posting_source, locale)}
                                </TableCell>
                              ) : null}

                              {visibleColumns.reference ? (
                                <TableCell>
                                  <div className="min-w-[160px]">
                                    <p className="truncate text-sm">
                                      {item.reference ||
                                        item.external_reference ||
                                        "-"}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {item.description || "-"}
                                    </p>
                                  </div>
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

                              {visibleColumns.status ? (
                                <TableCell>
                                  {statusBadge(item.status, locale)}
                                </TableCell>
                              ) : null}

                              {visibleColumns.balance ? (
                                <TableCell>
                                  {balanceBadge(item.is_balanced, locale)}
                                </TableCell>
                              ) : null}

                              {visibleColumns.actions && canViewDetails ? (
                                <TableCell>
                                  {isValidId(item.id) ? (
                                    <Link
                                      href={`/system/accounting/journals/${item.id}`}
                                    >
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 rounded-lg"
                                      >
                                        <Eye className="h-4 w-4" />
                                        <span className="sr-only">
                                          {t.viewDetails}
                                        </span>
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
                              className="h-36 text-center"
                            >
                              <div className="mx-auto max-w-md space-y-2">
                                <p className="font-semibold">
                                  {hasSearchOrFilter
                                    ? t.noResultsTitle
                                    : t.emptyTitle}
                                </p>
                                <p className="text-sm text-muted-foreground">
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
                                  <Link href="/system/accounting/journals/create">
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

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    {t.showing} {formatNumber(filteredRows.length)} {t.from}{" "}
                    {formatNumber(totalRows || rows.length)}
                  </p>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      disabled={isLoading || page <= 1}
                      onClick={() => loadJournals(page - 1, false)}
                    >
                      {t.previous}
                    </Button>

                    <Badge variant="outline" className="rounded-full px-3 py-1">
                      {formatNumber(page)} / {formatNumber(totalPages)}
                    </Badge>

                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      disabled={isLoading || page >= totalPages}
                      onClick={() => loadJournals(page + 1, false)}
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
                  <FileSpreadsheet className="h-4 w-4" />
                  {t.summaryCardTitle}
                </CardTitle>
                <CardDescription>{t.summaryCardDesc}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="rounded-2xl border bg-background p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950">
                      <ShieldCheck className="h-5 w-5" />
                    </div>

                    <div>
                      <p className="text-sm font-semibold">
                        {summary.is_balanced_total
                          ? t.balanced
                          : t.notBalanced}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.statusCardDesc}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">
                      {t.totalDebit}
                    </p>
                    <div className="mt-2 text-lg font-bold">
                      <MoneyText value={summary.total_debit} />
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">
                      {t.totalCredit}
                    </p>
                    <div className="mt-2 text-lg font-bold">
                      <MoneyText value={summary.total_credit} />
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">
                      {t.balancedEntries}
                    </p>
                    <div className="mt-2 text-lg font-bold">
                      {formatNumber(summary.balanced_entries_count)}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">
                      {t.unbalancedEntries}
                    </p>
                    <div className="mt-2 text-lg font-bold">
                      {formatNumber(summary.unbalanced_entries_count)}
                    </div>
                  </div>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-3 py-2 text-sm">
                    <span>{t.all}</span>
                    <span>{formatNumber(summary.total_entries)}</span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
                    <span>{t.posted}</span>
                    <span>{formatNumber(summary.posted_entries_count)}</span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
                    <span>{t.invoice}</span>
                    <span>
                      {formatNumber(
                        rows.filter((item) => item.posting_source === "INVOICE")
                          .length,
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {isLoading ? (
            <KpiCardSkeleton />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-2xl font-bold">
                        <MoneyText value={summary.total_credit} />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t.totalCredit}
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                      <TrendingDown className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-2xl font-bold">
                        {formatNumber(summary.balanced_entries_count)}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t.balancedEntries}
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
                        {formatNumber(summary.unbalanced_entries_count)}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t.unbalancedEntries}
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
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