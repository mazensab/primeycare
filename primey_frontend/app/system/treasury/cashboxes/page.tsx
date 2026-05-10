"use client";

/* ============================================================
   📂 app/system/treasury/cashboxes/page.tsx
   🧠 Primey Care | Treasury Cashboxes Page

   ✅ المسار:
      app/system/treasury/cashboxes/page.tsx

   ✅ العمل:
      صفحة صناديق الخزينة داخل النظام.
      تعرض حسابات الصناديق النقدية، الأرصدة، الحالة، الحساب الافتراضي، وروابط التفاصيل وكشف الحساب.

   ✅ الإصدار:
      Phase 17 UX Refinement + Treasury Cashboxes Build

   ✅ يعتمد على:
      - /api/treasury/accounts/
      - /api/treasury/reports/summary/
      - primey-locale
      - AuthProvider
      - sonner
      - /currency/sar.svg

   ✅ متوافق مع:
      - Treasury overview page
      - Treasury accounts page
      - Treasury account details page
      - Treasury account statement page
      - Centers / Customers approved UX standard

   ✅ الوظائف:
      - عرض صناديق الخزينة فقط.
      - البحث في صف مستقل.
      - الفلاتر والأعمدة في صف مستقل.
      - فلترة حسب الحالة والحساب الافتراضي.
      - التحكم بالأعمدة.
      - فرز الأعمدة المهمة.
      - صفحات محلية.
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
      - الملف المرفق كان صفحة خزينة عامة، وتم استخدامه كمرجع للنمط فقط.
      - بناء صفحة الصناديق كاملة بنفس النمط التشغيلي المعتمد.
      - الالتزام بالقاعدة: w-full space-y-4 بدون main/min-h-screen/max-w.
      - عدم عرض أي مسارات أو عبارات تقنية داخل واجهة المستخدم.
      - إخفاء الأزرار غير المصرح بها بدل تعطيلها.
      - استخدام Excel HTML Workbook بدل CSV أو XLSX.
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Banknote,
  Columns3,
  Download,
  Eye,
  FileText,
  Filter,
  Loader2,
  PlusCircle,
  Printer,
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

type AccountStatus = "ACTIVE" | "INACTIVE" | "CLOSED" | "UNKNOWN";
type StatusFilter = "ALL" | AccountStatus;
type DefaultFilter = "ALL" | "DEFAULT" | "REGULAR";

type SortKey =
  | "name"
  | "code"
  | "status"
  | "current_balance"
  | "opening_balance"
  | "created_at";

type SortDirection = "asc" | "desc";

type CashboxRow = {
  id: string;
  name: string;
  code: string;
  status: AccountStatus;
  current_balance: number;
  opening_balance: number;
  currency: string;
  is_default: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
};

type CashboxesSummary = {
  total_cashboxes: number;
  active_cashboxes: number;
  inactive_cashboxes: number;
  default_cashboxes: number;
  total_balance: number;
  opening_balance_total: number;
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
  summary?: Partial<CashboxesSummary>;
};

type VisibleColumns = {
  code: boolean;
  name: boolean;
  status: boolean;
  balance: boolean;
  openingBalance: boolean;
  default: boolean;
  notes: boolean;
  createdAt: boolean;
  actions: boolean;
};

const SAR_ICON_PATH = "/currency/sar.svg";
const PAGE_SIZE = 14;

const DEFAULT_COLUMNS: VisibleColumns = {
  code: true,
  name: true,
  status: true,
  balance: true,
  openingBalance: true,
  default: true,
  notes: true,
  createdAt: true,
  actions: true,
};

const DEFAULT_SUMMARY: CashboxesSummary = {
  total_cashboxes: 0,
  active_cashboxes: 0,
  inactive_cashboxes: 0,
  default_cashboxes: 0,
  total_balance: 0,
  opening_balance_total: 0,
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
    title: isArabic ? "الصناديق" : "Cashboxes",
    subtitle: isArabic
      ? "إدارة صناديق النقد ومراجعة الأرصدة والحالة والحساب الافتراضي."
      : "Manage cashboxes, balances, status, and default treasury cash accounts.",

    back: isArabic ? "الخزينة" : "Treasury",
    accounts: isArabic ? "حسابات الخزينة" : "Treasury Accounts",
    create: isArabic ? "إنشاء صندوق" : "Create Cashbox",
    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",

    summaryTitle: isArabic ? "ملخص الصناديق" : "Cashboxes Summary",
    summaryDesc: isArabic
      ? "مؤشرات مختصرة عن صناديق الخزينة وأرصدتها."
      : "Short indicators for treasury cashboxes and balances.",

    tableTitle: isArabic ? "قائمة الصناديق" : "Cashboxes List",
    tableDesc: isArabic
      ? "الصناديق النقدية المستخدمة في سندات القبض والصرف والتحويلات."
      : "Cash accounts used for receipts, payments, and transfers.",

    totalCashboxes: isArabic ? "إجمالي الصناديق" : "Total Cashboxes",
    activeCashboxes: isArabic ? "صناديق نشطة" : "Active Cashboxes",
    inactiveCashboxes: isArabic ? "صناديق غير نشطة" : "Inactive Cashboxes",
    defaultCashboxes: isArabic ? "صناديق افتراضية" : "Default Cashboxes",
    totalBalance: isArabic ? "إجمالي الرصيد" : "Total Balance",
    openingBalanceTotal: isArabic
      ? "إجمالي الرصيد الافتتاحي"
      : "Opening Balance Total",

    searchPlaceholder: isArabic
      ? "ابحث باسم الصندوق أو الكود أو الملاحظات..."
      : "Search by cashbox name, code, or notes...",

    filters: isArabic ? "الفلاتر" : "Filters",
    columns: isArabic ? "الأعمدة" : "Columns",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",

    allStatuses: isArabic ? "كل الحالات" : "All Statuses",
    allDefaults: isArabic ? "كل الحسابات" : "All Accounts",

    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
    closed: isArabic ? "مغلق" : "Closed",
    unknown: isArabic ? "غير محدد" : "Unknown",

    defaultAccount: isArabic ? "افتراضي" : "Default",
    regularAccount: isArabic ? "عادي" : "Regular",
    onlyDefault: isArabic ? "الافتراضي فقط" : "Default Only",
    onlyRegular: isArabic ? "العادي فقط" : "Regular Only",

    table: {
      code: isArabic ? "الكود" : "Code",
      name: isArabic ? "اسم الصندوق" : "Cashbox Name",
      status: isArabic ? "الحالة" : "Status",
      balance: isArabic ? "الرصيد" : "Balance",
      openingBalance: isArabic ? "الرصيد الافتتاحي" : "Opening Balance",
      default: isArabic ? "الافتراضي" : "Default",
      notes: isArabic ? "ملاحظات" : "Notes",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      action: isArabic ? "الإجراء" : "Action",
    },

    view: isArabic ? "عرض" : "View",
    statement: isArabic ? "كشف الحساب" : "Statement",

    emptyTitle: isArabic ? "لا توجد صناديق" : "No cashboxes",
    emptyText: isArabic
      ? "ستظهر صناديق الخزينة هنا بعد إنشائها."
      : "Treasury cashboxes will appear here after they are created.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير البحث أو الفلاتر."
      : "Try changing the search or filters.",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الصناديق" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض صناديق الخزينة. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view cashboxes. Contact your system administrator if you need access.",

    loadError: isArabic ? "تعذر تحميل الصناديق." : "Unable to load cashboxes.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    loadSuccess: isArabic
      ? "تم تحديث الصناديق بنجاح."
      : "Cashboxes refreshed successfully.",

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
    "account",
    "treasury_account",
    "cashbox",
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

function extractRows(payload: ApiEnvelope<unknown> | null): unknown[] {
  if (!payload) return [];

  const data = asDict(payload.data);

  if (Array.isArray(payload.accounts)) return payload.accounts;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.rows)) return payload.rows;

  if (Array.isArray(data.accounts)) return data.accounts as unknown[];
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
  } as Partial<CashboxesSummary>;
}

function normalizeStatus(value: unknown): AccountStatus {
  const clean = String(value || "").toUpperCase();

  if (["ACTIVE", "OPEN", "ENABLED", "TRUE"].includes(clean)) return "ACTIVE";
  if (["INACTIVE", "DISABLED", "FALSE"].includes(clean)) return "INACTIVE";
  if (["CLOSED", "LOCKED"].includes(clean)) return "CLOSED";

  if (typeof value === "boolean") return value ? "ACTIVE" : "INACTIVE";

  return "UNKNOWN";
}

function isCashbox(item: unknown) {
  const obj = asDict(item);
  const type = String(
    getNestedValue(obj, ["account_type", "type", "kind"]) || "",
  ).toUpperCase();

  return ["CASHBOX", "CASH", "BOX"].includes(type);
}

function normalizeCashbox(item: unknown): CashboxRow {
  const obj = asDict(item);

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || ""),
    name: String(getNestedValue(obj, ["name", "title", "label"]) || "-"),
    code: String(getNestedValue(obj, ["code", "account_code", "number"]) || "-"),
    status: normalizeStatus(getNestedValue(obj, ["status", "state", "is_active"])),
    current_balance: toNumber(
      getNestedValue(obj, ["current_balance", "balance", "available_balance"]),
    ),
    opening_balance: toNumber(
      getNestedValue(obj, ["opening_balance", "initial_balance"]),
    ),
    currency: String(getNestedValue(obj, ["currency"]) || "SAR"),
    is_default: Boolean(getNestedValue(obj, ["is_default", "default"])),
    notes: String(getNestedValue(obj, ["notes", "description", "memo"]) || ""),
    created_at: String(getNestedValue(obj, ["created_at", "created"]) || ""),
    updated_at: String(getNestedValue(obj, ["updated_at", "modified"]) || ""),
  };
}

function buildSummary(
  rows: CashboxRow[],
  apiSummary?: Partial<CashboxesSummary>,
): CashboxesSummary {
  const fallback: CashboxesSummary = {
    total_cashboxes: rows.length,
    active_cashboxes: rows.filter((item) => item.status === "ACTIVE").length,
    inactive_cashboxes: rows.filter((item) => item.status === "INACTIVE").length,
    default_cashboxes: rows.filter((item) => item.is_default).length,
    total_balance: rows.reduce((sum, item) => sum + item.current_balance, 0),
    opening_balance_total: rows.reduce(
      (sum, item) => sum + item.opening_balance,
      0,
    ),
  };

  return {
    total_cashboxes:
      toNumber(apiSummary?.total_cashboxes) ||
      toNumber((apiSummary as Dict)?.cashbox_accounts) ||
      fallback.total_cashboxes,
    active_cashboxes:
      toNumber(apiSummary?.active_cashboxes) || fallback.active_cashboxes,
    inactive_cashboxes:
      toNumber(apiSummary?.inactive_cashboxes) || fallback.inactive_cashboxes,
    default_cashboxes:
      toNumber(apiSummary?.default_cashboxes) || fallback.default_cashboxes,
    total_balance:
      toNumber(apiSummary?.total_balance) || fallback.total_balance,
    opening_balance_total:
      toNumber(apiSummary?.opening_balance_total) ||
      fallback.opening_balance_total,
  };
}

function statusLabel(status: AccountStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<AccountStatus, string> = {
    ACTIVE: t.active,
    INACTIVE: t.inactive,
    CLOSED: t.closed,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function statusBadge(status: AccountStatus, locale: AppLocale) {
  const label = statusLabel(status, locale);

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

function sortValue(row: CashboxRow, key: SortKey): string | number {
  if (key === "current_balance") return row.current_balance;
  if (key === "opening_balance") return row.opening_balance;

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
  rows,
}: {
  filename: string;
  worksheetName: string;
  title: string;
  locale: AppLocale;
  summary: CashboxesSummary;
  rows: CashboxRow[];
}) {
  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const align = isArabic ? "right" : "left";
  const t = dictionary(locale);

  const rowsHtml = rows
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.code)}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(statusLabel(item.status, locale))}</td>
          <td>${escapeHtml(formatMoney(item.current_balance))}</td>
          <td>${escapeHtml(formatMoney(item.opening_balance))}</td>
          <td>${escapeHtml(item.is_default ? t.defaultAccount : t.regularAccount)}</td>
          <td>${escapeHtml(item.notes || "-")}</td>
          <td>${escapeHtml(formatDate(item.created_at, locale))}</td>
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
          <tr><td class="title" colspan="8">${escapeHtml(title)}</td></tr>
          <tr><td colspan="8"></td></tr>
          <tr><td class="section" colspan="8">${escapeHtml(t.summaryTitle)}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.generatedAt)}</td><td class="summary-value" colspan="7">${escapeHtml(new Date().toLocaleString("en-US"))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalCashboxes)}</td><td class="summary-value" colspan="7">${escapeHtml(formatNumber(summary.total_cashboxes))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.activeCashboxes)}</td><td class="summary-value" colspan="7">${escapeHtml(formatNumber(summary.active_cashboxes))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalBalance)}</td><td class="summary-value" colspan="7">${escapeHtml(formatMoney(summary.total_balance))}</td></tr>

          <tr><td colspan="8"></td></tr>
          <tr>
            <th>${escapeHtml(t.table.code)}</th>
            <th>${escapeHtml(t.table.name)}</th>
            <th>${escapeHtml(t.table.status)}</th>
            <th>${escapeHtml(t.table.balance)}</th>
            <th>${escapeHtml(t.table.openingBalance)}</th>
            <th>${escapeHtml(t.table.default)}</th>
            <th>${escapeHtml(t.table.notes)}</th>
            <th>${escapeHtml(t.table.createdAt)}</th>
          </tr>
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
  summary,
  rows,
}: {
  locale: AppLocale;
  title: string;
  summary: CashboxesSummary;
  rows: CashboxRow[];
}) {
  const isArabic = locale === "ar";
  const t = dictionary(locale);
  const now = new Date().toLocaleString("en-US");

  const tableRows = rows
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.code)}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(statusLabel(item.status, locale))}</td>
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
              <div>${escapeHtml(t.rowsCount)}: ${formatNumber(rows.length)}</div>
            </div>
          </div>
          <div class="badge">Primey Care</div>
        </div>

        <div class="summary-grid">
          <div class="summary-card"><span>${escapeHtml(t.totalCashboxes)}</span><strong>${formatNumber(summary.total_cashboxes)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.activeCashboxes)}</span><strong>${formatNumber(summary.active_cashboxes)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.defaultCashboxes)}</span><strong>${formatNumber(summary.default_cashboxes)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.totalBalance)}</span><strong>${formatMoney(summary.total_balance)}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${escapeHtml(t.table.code)}</th>
              <th>${escapeHtml(t.table.name)}</th>
              <th>${escapeHtml(t.table.status)}</th>
              <th>${escapeHtml(t.table.balance)}</th>
              <th>${escapeHtml(t.table.default)}</th>
            </tr>
          </thead>
          <tbody>
            ${
              tableRows ||
              `<tr><td colspan="6" style="text-align:center">${escapeHtml(t.emptyTitle)}</td></tr>`
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

export default function TreasuryCashboxesPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [rows, setRows] = useState<CashboxRow[]>([]);
  const [summary, setSummary] = useState<CashboxesSummary>(DEFAULT_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [defaultFilter, setDefaultFilter] = useState<DefaultFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [visibleColumns, setVisibleColumns] =
    useState<VisibleColumns>(DEFAULT_COLUMNS);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canView = hasSafePermission(
    auth,
    ["treasury.view", "treasury.accounts.view"],
    "view",
  );

  const canCreate = hasSafePermission(
    auth,
    ["treasury.create", "treasury.accounts.create", "treasury.manage"],
    "action",
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

  const canViewDetails = hasSafePermission(
    auth,
    ["treasury.view", "treasury.accounts.view"],
    "view",
  );

  const filteredRows = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    const filtered = rows.filter((item) => {
      const matchesStatus =
        statusFilter === "ALL" ? true : item.status === statusFilter;

      const matchesDefault =
        defaultFilter === "ALL"
          ? true
          : defaultFilter === "DEFAULT"
            ? item.is_default
            : !item.is_default;

      const matchesQuery = !cleanQuery
        ? true
        : [
            item.name,
            item.code,
            item.notes,
            statusLabel(item.status, locale),
            item.is_default ? t.defaultAccount : t.regularAccount,
          ]
            .join(" ")
            .toLowerCase()
            .includes(cleanQuery);

      return matchesStatus && matchesDefault && matchesQuery;
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
  }, [defaultFilter, locale, query, rows, sortDirection, sortKey, statusFilter, t]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  const paginatedRows = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * PAGE_SIZE;

    return filteredRows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredRows, page, totalPages]);

  const hasSearchOrFilter =
    query.trim().length > 0 ||
    statusFilter !== "ALL" ||
    defaultFilter !== "ALL";

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
        value: "ACTIVE" as StatusFilter,
        label: t.active,
        count: rows.filter((item) => item.status === "ACTIVE").length,
      },
      {
        value: "INACTIVE" as StatusFilter,
        label: t.inactive,
        count: rows.filter((item) => item.status === "INACTIVE").length,
      },
      {
        value: "CLOSED" as StatusFilter,
        label: t.closed,
        count: rows.filter((item) => item.status === "CLOSED").length,
      },
    ],
    [rows, t],
  );

  const defaultOptions = useMemo(
    () => [
      {
        value: "ALL" as DefaultFilter,
        label: t.allDefaults,
        count: rows.length,
      },
      {
        value: "DEFAULT" as DefaultFilter,
        label: t.onlyDefault,
        count: rows.filter((item) => item.is_default).length,
      },
      {
        value: "REGULAR" as DefaultFilter,
        label: t.onlyRegular,
        count: rows.filter((item) => !item.is_default).length,
      },
    ],
    [rows, t],
  );

  const columnOptions: Array<{ key: keyof VisibleColumns; label: string }> = [
    { key: "code", label: t.table.code },
    { key: "name", label: t.table.name },
    { key: "status", label: t.table.status },
    { key: "balance", label: t.table.balance },
    { key: "openingBalance", label: t.table.openingBalance },
    { key: "default", label: t.table.default },
    { key: "notes", label: t.table.notes },
    { key: "createdAt", label: t.table.createdAt },
    { key: "actions", label: t.table.action },
  ];

  const loadCashboxes = useCallback(
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

        const [accountsResponse, summaryResponse] = await Promise.allSettled([
          fetch(apiUrl("/api/treasury/accounts/?account_type=CASHBOX&page_size=500"), {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: { Accept: "application/json" },
          }),
          fetch(apiUrl("/api/treasury/reports/summary/"), {
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

        const accountsPayload = await readJson(accountsResponse);
        const summaryPayload = await readJson(summaryResponse);

        const normalizedRows = extractRows(accountsPayload)
          .filter(isCashbox)
          .map(normalizeCashbox)
          .filter((item) => item.id || item.name);

        setRows(normalizedRows);
        setSummary(buildSummary(normalizedRows, extractSummary(summaryPayload)));
        setPage(1);

        if (showToast) toast.success(t.loadSuccess);
      } catch (error) {
        console.error("Treasury cashboxes load error:", error);
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
    setDefaultFilter("ALL");
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

    downloadExcel({
      filename: `primey-care-treasury-cashboxes-${new Date()
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "الصناديق" : "Cashboxes",
      title: t.title,
      locale,
      summary,
      rows: filteredRows,
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
        summary,
        rows: filteredRows,
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
    loadCashboxes(false);
  }, [authResolving, loadCashboxes]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, defaultFilter]);

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

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadCashboxes(true)}
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
            <Link href="/system/treasury/accounts/create">
              <Button className="h-10 w-full rounded-xl sm:w-auto">
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
              onClick={() => loadCashboxes(true)}
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
                    {formatNumber(summary.total_cashboxes)}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.totalCashboxes}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                  <Banknote className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-2xl font-bold">
                    {formatNumber(summary.active_cashboxes)}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.activeCashboxes}
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
                    {formatNumber(summary.default_cashboxes)}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.defaultCashboxes}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
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
                    <MoneyText value={summary.total_balance} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.totalBalance}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300">
                  <Banknote className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader className="space-y-4 pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base font-bold">
                {t.tableTitle}
              </CardTitle>
              <CardDescription className="mt-1">{t.tableDesc}</CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => loadCashboxes(true)}
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
                    <DropdownMenuLabel>{t.allDefaults}</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {defaultOptions.map((item) => (
                      <DropdownMenuCheckboxItem
                        key={item.value}
                        checked={defaultFilter === item.value}
                        onCheckedChange={() => setDefaultFilter(item.value)}
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
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {visibleColumns.code ? (
                      <TableHead className="min-w-[120px]">
                        <button
                          type="button"
                          onClick={() => toggleSort("code")}
                          className="inline-flex items-center gap-1 font-medium"
                        >
                          {t.table.code}
                          {sortKey === "code" &&
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

                    {visibleColumns.status ? (
                      <TableHead className="min-w-[120px]">
                        {t.table.status}
                      </TableHead>
                    ) : null}

                    {visibleColumns.balance ? (
                      <TableHead className="min-w-[150px]">
                        <button
                          type="button"
                          onClick={() => toggleSort("current_balance")}
                          className="inline-flex items-center gap-1 font-medium"
                        >
                          {t.table.balance}
                          {sortKey === "current_balance" &&
                            (sortDirection === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5" />
                            ))}
                        </button>
                      </TableHead>
                    ) : null}

                    {visibleColumns.openingBalance ? (
                      <TableHead className="min-w-[160px]">
                        <button
                          type="button"
                          onClick={() => toggleSort("opening_balance")}
                          className="inline-flex items-center gap-1 font-medium"
                        >
                          {t.table.openingBalance}
                          {sortKey === "opening_balance" &&
                            (sortDirection === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5" />
                            ))}
                        </button>
                      </TableHead>
                    ) : null}

                    {visibleColumns.default ? (
                      <TableHead className="min-w-[110px]">
                        {t.table.default}
                      </TableHead>
                    ) : null}

                    {visibleColumns.notes ? (
                      <TableHead className="min-w-[220px]">
                        {t.table.notes}
                      </TableHead>
                    ) : null}

                    {visibleColumns.createdAt ? (
                      <TableHead className="min-w-[140px]">
                        <button
                          type="button"
                          onClick={() => toggleSort("created_at")}
                          className="inline-flex items-center gap-1 font-medium"
                        >
                          {t.table.createdAt}
                          {sortKey === "created_at" &&
                            (sortDirection === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5" />
                            ))}
                        </button>
                      </TableHead>
                    ) : null}

                    {visibleColumns.actions && canViewDetails ? (
                      <TableHead className="min-w-[150px]">
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
                      <TableRow key={`${item.id}-${item.code}`}>
                        {visibleColumns.code ? (
                          <TableCell className="font-semibold" dir="ltr">
                            {item.code || "-"}
                          </TableCell>
                        ) : null}

                        {visibleColumns.name ? (
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

                        {visibleColumns.status ? (
                          <TableCell>{statusBadge(item.status, locale)}</TableCell>
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

                        {visibleColumns.default ? (
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

                        {visibleColumns.notes ? (
                          <TableCell>
                            <span className="line-clamp-2 min-w-[200px] text-sm text-muted-foreground">
                              {item.notes || "-"}
                            </span>
                          </TableCell>
                        ) : null}

                        {visibleColumns.createdAt ? (
                          <TableCell className="whitespace-nowrap">
                            {formatDate(item.created_at, locale)}
                          </TableCell>
                        ) : null}

                        {visibleColumns.actions && canViewDetails ? (
                          <TableCell>
                            {isValidId(item.id) ? (
                              <div className="flex items-center gap-2">
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

                                <Link
                                  href={`/system/treasury/accounts/${item.id}/statement`}
                                >
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 rounded-lg"
                                  >
                                    <FileText className="h-4 w-4" />
                                    <span className="sr-only">{t.statement}</span>
                                  </Button>
                                </Link>
                              </div>
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
                          <Banknote className="h-10 w-10 text-muted-foreground/40" />
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
                          ) : canCreate ? (
                            <Link href="/system/treasury/accounts/create">
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
    </div>
  );
}