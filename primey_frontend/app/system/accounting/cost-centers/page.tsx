"use client";

/* ============================================================
   📂 app/system/accounting/cost-centers/page.tsx
   🧠 Primey Care | Accounting Cost Centers Page

   ✅ المسار:
      app/system/accounting/cost-centers/page.tsx

   ✅ العمل:
      صفحة مراكز التكلفة داخل مديول المحاسبة.
      تعرض مراكز التكلفة، حالتها، الأرصدة المرتبطة، وعدد الحركات/الحسابات المرتبطة.

   ✅ الإصدار:
      Phase 17 UX Refinement + Accounting Cost Centers Build

   ✅ يعتمد على:
      - /api/accounting/cost-centers/
      - /api/accounting/reports/cost-centers/ كـ fallback آمن
      - primey-locale
      - AuthProvider
      - sonner
      - /currency/sar.svg

   ✅ متوافق مع:
      - Accounting accounts page
      - Accounting journals approved pattern
      - Centers / Customers approved UX standard

   ✅ الوظائف:
      - عرض مراكز التكلفة.
      - بحث في صف مستقل.
      - الفلاتر والأعمدة في صف منفصل.
      - فلترة حسب الحالة والنوع.
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
      - بناء الصفحة من الصفر كمركز تكلفة وليس صفحة تفاصيل حساب.
      - الالتزام بالقاعدة: w-full space-y-4 بدون main/min-h-screen/max-w.
      - إزالة أي عبارات تقنية أو مؤقتة من واجهة المستخدم.
      - إزالة localhost و API_BASE_URL الثابت.
      - استخدام sonner للتنبيهات.
      - استخدام Excel HTML Workbook بدل CSV أو فتح ملف من الباكند.
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  Building2,
  Columns3,
  Download,
  Eye,
  Filter,
  Layers3,
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

type CostCenterStatus = "ACTIVE" | "INACTIVE" | "UNKNOWN";
type CostCenterKind = "OPERATIONAL" | "ADMINISTRATIVE" | "SALES" | "SERVICE" | "OTHER" | "UNKNOWN";

type StatusFilter = "ALL" | CostCenterStatus;
type KindFilter = "ALL" | CostCenterKind;

type SortKey =
  | "code"
  | "name"
  | "kind"
  | "status"
  | "total_debit"
  | "total_credit"
  | "net_amount"
  | "transactions_count"
  | "created_at";

type SortDirection = "asc" | "desc";

type CostCenterRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  kind: CostCenterKind;
  status: CostCenterStatus;
  parent_id: string;
  parent_name: string;
  manager_name: string;
  total_debit: number;
  total_credit: number;
  net_amount: number;
  accounts_count: number;
  transactions_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type CostCentersSummary = {
  total_centers: number;
  active_centers: number;
  inactive_centers: number;
  total_debit: number;
  total_credit: number;
  net_amount: number;
  accounts_count: number;
  transactions_count: number;
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
  cost_centers?: unknown[];
  summary?: Partial<CostCentersSummary>;
  count?: number;
  pagination?: {
    total_items?: number;
    count?: number;
  };
};

type VisibleColumns = {
  code: boolean;
  name: boolean;
  kind: boolean;
  status: boolean;
  manager: boolean;
  totalDebit: boolean;
  totalCredit: boolean;
  netAmount: boolean;
  transactions: boolean;
  actions: boolean;
};

const SAR_ICON_PATH = "/currency/sar.svg";
const PAGE_SIZE = 16;

const DEFAULT_COLUMNS: VisibleColumns = {
  code: true,
  name: true,
  kind: true,
  status: true,
  manager: true,
  totalDebit: true,
  totalCredit: true,
  netAmount: true,
  transactions: true,
  actions: true,
};

const DEFAULT_SUMMARY: CostCentersSummary = {
  total_centers: 0,
  active_centers: 0,
  inactive_centers: 0,
  total_debit: 0,
  total_credit: 0,
  net_amount: 0,
  accounts_count: 0,
  transactions_count: 0,
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
    title: isArabic ? "مراكز التكلفة" : "Cost Centers",
    subtitle: isArabic
      ? "إدارة ومراجعة مراكز التكلفة المرتبطة بالحسابات والحركات المحاسبية."
      : "Manage and review cost centers linked to accounting accounts and movements.",

    back: isArabic ? "لوحة المحاسبة" : "Accounting Overview",
    reports: isArabic ? "تقارير المحاسبة" : "Accounting Reports",
    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    create: isArabic ? "إنشاء مركز تكلفة" : "Create Cost Center",

    statusTitle: isArabic ? "حالة مراكز التكلفة" : "Cost Centers Status",
    statusDesc: isArabic
      ? "تحليل سريع للمراكز النشطة وغير النشطة والحركات المرتبطة."
      : "Quick analysis of active, inactive, and linked movements.",
    summaryTitle: isArabic ? "ملخص مراكز التكلفة" : "Cost Centers Summary",
    summaryDesc: isArabic
      ? "أهم مؤشرات مراكز التكلفة حسب البيانات الحالية."
      : "Key indicators for current cost center data.",

    totalCenters: isArabic ? "إجمالي المراكز" : "Total Centers",
    activeCenters: isArabic ? "مراكز نشطة" : "Active Centers",
    inactiveCenters: isArabic ? "مراكز غير نشطة" : "Inactive Centers",
    accountsCount: isArabic ? "الحسابات المرتبطة" : "Linked Accounts",
    transactionsCount: isArabic ? "الحركات المرتبطة" : "Linked Transactions",
    totalDebit: isArabic ? "إجمالي المدين" : "Total Debit",
    totalCredit: isArabic ? "إجمالي الدائن" : "Total Credit",
    netAmount: isArabic ? "الصافي" : "Net Amount",

    searchPlaceholder: isArabic
      ? "ابحث باسم المركز أو الكود أو المسؤول..."
      : "Search by name, code, or manager...",

    filters: isArabic ? "الفلاتر" : "Filters",
    columns: isArabic ? "الأعمدة" : "Columns",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",

    all: isArabic ? "الكل" : "All",
    allStatuses: isArabic ? "كل الحالات" : "All Statuses",
    allKinds: isArabic ? "كل الأنواع" : "All Types",

    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
    unknown: isArabic ? "غير محدد" : "Unknown",

    operational: isArabic ? "تشغيلي" : "Operational",
    administrative: isArabic ? "إداري" : "Administrative",
    sales: isArabic ? "مبيعات" : "Sales",
    service: isArabic ? "خدمة" : "Service",
    other: isArabic ? "أخرى" : "Other",

    table: {
      code: isArabic ? "الكود" : "Code",
      name: isArabic ? "اسم مركز التكلفة" : "Cost Center Name",
      kind: isArabic ? "النوع" : "Type",
      status: isArabic ? "الحالة" : "Status",
      manager: isArabic ? "المسؤول" : "Manager",
      debit: isArabic ? "المدين" : "Debit",
      credit: isArabic ? "الدائن" : "Credit",
      net: isArabic ? "الصافي" : "Net",
      transactions: isArabic ? "الحركات" : "Transactions",
      action: isArabic ? "الإجراء" : "Action",
    },

    view: isArabic ? "عرض" : "View",

    emptyTitle: isArabic ? "لا توجد مراكز تكلفة" : "No cost centers",
    emptyText: isArabic
      ? "ستظهر مراكز التكلفة هنا بعد إنشائها أو ربطها بالحركات."
      : "Cost centers will appear here after they are created or linked to movements.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير البحث أو الفلاتر."
      : "Try changing the search or filters.",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض مراكز التكلفة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض مراكز التكلفة. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view cost centers. Contact your system administrator if you need access.",

    loadError: isArabic
      ? "تعذر تحميل مراكز التكلفة."
      : "Unable to load cost centers.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    loadSuccess: isArabic
      ? "تم تحديث مراكز التكلفة بنجاح."
      : "Cost centers refreshed successfully.",

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

  for (const container of ["cost_center", "costCenter", "center", "item", "data"]) {
    const nested = obj[container];

    if (nested && typeof nested === "object") {
      const value = getNestedValue(nested as Dict, keys);

      if (value !== undefined && value !== null && value !== "") return value;
    }
  }

  return undefined;
}

function normalizeStatus(value: unknown): CostCenterStatus {
  const clean = String(value || "").toUpperCase();

  if (["ACTIVE", "ENABLED", "OPEN"].includes(clean)) return "ACTIVE";
  if (["INACTIVE", "DISABLED", "CLOSED"].includes(clean)) return "INACTIVE";

  if (typeof value === "boolean") return value ? "ACTIVE" : "INACTIVE";

  return "UNKNOWN";
}

function normalizeKind(value: unknown): CostCenterKind {
  const clean = String(value || "").toUpperCase();

  if (["OPERATIONAL", "OPERATIONS", "OPERATION"].includes(clean)) {
    return "OPERATIONAL";
  }

  if (["ADMINISTRATIVE", "ADMIN"].includes(clean)) {
    return "ADMINISTRATIVE";
  }

  if (["SALES", "SALE"].includes(clean)) return "SALES";
  if (["SERVICE", "SERVICES"].includes(clean)) return "SERVICE";
  if (["OTHER", "GENERAL"].includes(clean)) return "OTHER";

  return "UNKNOWN";
}

function extractRows(payload: ApiEnvelope<unknown> | null): unknown[] {
  if (!payload) return [];

  const data = asDict(payload.data);

  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.cost_centers)) return payload.cost_centers;

  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.cost_centers)) return data.cost_centers;

  if (Array.isArray(payload.data)) return payload.data;

  return [];
}

function extractSummary(payload: ApiEnvelope<unknown> | null) {
  if (!payload) return {};

  const data = asDict(payload.data);

  return {
    ...asDict(payload.summary),
    ...asDict(data.summary),
  } as Partial<CostCentersSummary>;
}

function normalizeCostCenter(item: unknown): CostCenterRow {
  const obj = asDict(item);
  const parent = asDict(obj.parent || obj.parent_cost_center);
  const manager = asDict(obj.manager || obj.owner || obj.responsible_user);

  const totalDebit = toNumber(
    getNestedValue(obj, ["total_debit", "debit", "debit_amount"]),
  );

  const totalCredit = toNumber(
    getNestedValue(obj, ["total_credit", "credit", "credit_amount"]),
  );

  const explicitNet = getNestedValue(obj, [
    "net_amount",
    "net_balance",
    "balance",
    "closing_balance",
  ]);

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || ""),
    code: String(getNestedValue(obj, ["code", "cost_center_code", "number"]) || "-"),
    name: String(
      getNestedValue(obj, ["name", "cost_center_name", "title", "name_ar"]) ||
        "-",
    ),
    description: String(
      getNestedValue(obj, ["description", "notes", "memo"]) || "",
    ),
    kind: normalizeKind(getNestedValue(obj, ["kind", "type", "category"])),
    status: normalizeStatus(
      getNestedValue(obj, ["status", "is_active", "active"]),
    ),
    parent_id: String(parent.id || getNestedValue(obj, ["parent_id"]) || ""),
    parent_name: String(parent.name || parent.title || ""),
    manager_name: String(
      manager.name ||
        manager.full_name ||
        manager.email ||
        getNestedValue(obj, ["manager_name", "owner_name", "responsible_name"]) ||
        "",
    ),
    total_debit: totalDebit,
    total_credit: totalCredit,
    net_amount:
      explicitNet === undefined || explicitNet === null || explicitNet === ""
        ? totalDebit - totalCredit
        : toNumber(explicitNet),
    accounts_count: toNumber(
      getNestedValue(obj, ["accounts_count", "linked_accounts_count"]),
    ),
    transactions_count: toNumber(
      getNestedValue(obj, [
        "transactions_count",
        "entries_count",
        "movements_count",
        "lines_count",
      ]),
    ),
    is_active:
      normalizeStatus(getNestedValue(obj, ["status", "is_active", "active"])) ===
      "ACTIVE",
    created_at: String(getNestedValue(obj, ["created_at", "created"]) || ""),
    updated_at: String(getNestedValue(obj, ["updated_at", "modified"]) || ""),
  };
}

function buildSummary(
  rows: CostCenterRow[],
  apiSummary?: Partial<CostCentersSummary>,
): CostCentersSummary {
  const fallback: CostCentersSummary = {
    total_centers: rows.length,
    active_centers: rows.filter((item) => item.status === "ACTIVE").length,
    inactive_centers: rows.filter((item) => item.status === "INACTIVE").length,
    total_debit: rows.reduce((sum, item) => sum + item.total_debit, 0),
    total_credit: rows.reduce((sum, item) => sum + item.total_credit, 0),
    net_amount: rows.reduce((sum, item) => sum + item.net_amount, 0),
    accounts_count: rows.reduce((sum, item) => sum + item.accounts_count, 0),
    transactions_count: rows.reduce(
      (sum, item) => sum + item.transactions_count,
      0,
    ),
  };

  return {
    total_centers: toNumber(apiSummary?.total_centers) || fallback.total_centers,
    active_centers: toNumber(apiSummary?.active_centers) || fallback.active_centers,
    inactive_centers:
      toNumber(apiSummary?.inactive_centers) || fallback.inactive_centers,
    total_debit: toNumber(apiSummary?.total_debit) || fallback.total_debit,
    total_credit: toNumber(apiSummary?.total_credit) || fallback.total_credit,
    net_amount:
      apiSummary?.net_amount === undefined
        ? fallback.net_amount
        : toNumber(apiSummary.net_amount),
    accounts_count: toNumber(apiSummary?.accounts_count) || fallback.accounts_count,
    transactions_count:
      toNumber(apiSummary?.transactions_count) || fallback.transactions_count,
  };
}

function statusLabel(status: CostCenterStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<CostCenterStatus, string> = {
    ACTIVE: t.active,
    INACTIVE: t.inactive,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function kindLabel(kind: CostCenterKind, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<CostCenterKind, string> = {
    OPERATIONAL: t.operational,
    ADMINISTRATIVE: t.administrative,
    SALES: t.sales,
    SERVICE: t.service,
    OTHER: t.other,
    UNKNOWN: t.unknown,
  };

  return labels[kind];
}

function statusBadge(status: CostCenterStatus, locale: AppLocale) {
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

function kindBadge(kind: CostCenterKind, locale: AppLocale) {
  const label = kindLabel(kind, locale);

  if (kind === "OPERATIONAL" || kind === "SERVICE") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
        {label}
      </Badge>
    );
  }

  if (kind === "SALES") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (kind === "ADMINISTRATIVE") {
    return (
      <Badge className="rounded-full border-violet-200 bg-violet-50 px-3 py-1 text-violet-700 hover:bg-violet-50 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300">
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

function sortValue(row: CostCenterRow, key: SortKey): string | number {
  if (key === "total_debit") return row.total_debit;
  if (key === "total_credit") return row.total_credit;
  if (key === "net_amount") return row.net_amount;
  if (key === "transactions_count") return row.transactions_count;

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
            ${locale === "ar" ? "ملخص مراكز التكلفة" : "Cost Centers Summary"}
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
  rows: CostCenterRow[];
  summary: CostCentersSummary;
  t: ReturnType<typeof dictionary>;
}) {
  const isArabic = locale === "ar";
  const now = new Date().toLocaleString("en-US");

  const tableRows = rows
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.code)}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(kindLabel(item.kind, locale))}</td>
          <td>${escapeHtml(statusLabel(item.status, locale))}</td>
          <td>${escapeHtml(item.manager_name || "-")}</td>
          <td>${escapeHtml(formatMoney(item.total_debit))}</td>
          <td>${escapeHtml(formatMoney(item.total_credit))}</td>
          <td>${escapeHtml(formatMoney(item.net_amount))}</td>
          <td>${escapeHtml(formatNumber(item.transactions_count))}</td>
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
          <div class="summary-card"><span>${escapeHtml(t.totalCenters)}</span><strong>${formatNumber(summary.total_centers)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.activeCenters)}</span><strong>${formatNumber(summary.active_centers)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.totalDebit)}</span><strong>${formatMoney(summary.total_debit)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.totalCredit)}</span><strong>${formatMoney(summary.total_credit)}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${escapeHtml(t.table.code)}</th>
              <th>${escapeHtml(t.table.name)}</th>
              <th>${escapeHtml(t.table.kind)}</th>
              <th>${escapeHtml(t.table.status)}</th>
              <th>${escapeHtml(t.table.manager)}</th>
              <th>${escapeHtml(t.table.debit)}</th>
              <th>${escapeHtml(t.table.credit)}</th>
              <th>${escapeHtml(t.table.net)}</th>
              <th>${escapeHtml(t.table.transactions)}</th>
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

export default function AccountingCostCentersPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [rows, setRows] = useState<CostCenterRow[]>([]);
  const [summary, setSummary] = useState<CostCentersSummary>(DEFAULT_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [kindFilter, setKindFilter] = useState<KindFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [visibleColumns, setVisibleColumns] =
    useState<VisibleColumns>(DEFAULT_COLUMNS);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canView = hasSafePermission(
    auth,
    ["accounting.view", "accounting.cost_centers.view"],
    "view",
  );

  const canCreate = hasSafePermission(
    auth,
    ["accounting.create", "accounting.cost_centers.create", "accounting.manage"],
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
    ["accounting.view", "accounting.cost_centers.view"],
    "view",
  );

  const filteredRows = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    const filtered = rows.filter((item) => {
      const matchesStatus =
        statusFilter === "ALL" ? true : item.status === statusFilter;

      const matchesKind = kindFilter === "ALL" ? true : item.kind === kindFilter;

      const matchesQuery = !cleanQuery
        ? true
        : [
            item.code,
            item.name,
            item.description,
            item.manager_name,
            item.parent_name,
            kindLabel(item.kind, locale),
            statusLabel(item.status, locale),
          ]
            .join(" ")
            .toLowerCase()
            .includes(cleanQuery);

      return matchesStatus && matchesKind && matchesQuery;
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
  }, [kindFilter, locale, query, rows, sortDirection, sortKey, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  const paginatedRows = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * PAGE_SIZE;

    return filteredRows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredRows, page, totalPages]);

  const hasSearchOrFilter =
    query.trim().length > 0 || statusFilter !== "ALL" || kindFilter !== "ALL";

  const visibleColumnCount = Object.entries(visibleColumns).filter(
    ([key, value]) => value && (key !== "actions" || canViewDetails),
  ).length;

  const statusOptions = useMemo(
    () => [
      { value: "ALL" as StatusFilter, label: t.allStatuses, count: rows.length },
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
    ],
    [rows, t],
  );

  const kindOptions = useMemo(
    () => [
      { value: "ALL" as KindFilter, label: t.allKinds, count: rows.length },
      {
        value: "OPERATIONAL" as KindFilter,
        label: t.operational,
        count: rows.filter((item) => item.kind === "OPERATIONAL").length,
      },
      {
        value: "ADMINISTRATIVE" as KindFilter,
        label: t.administrative,
        count: rows.filter((item) => item.kind === "ADMINISTRATIVE").length,
      },
      {
        value: "SALES" as KindFilter,
        label: t.sales,
        count: rows.filter((item) => item.kind === "SALES").length,
      },
      {
        value: "SERVICE" as KindFilter,
        label: t.service,
        count: rows.filter((item) => item.kind === "SERVICE").length,
      },
      {
        value: "OTHER" as KindFilter,
        label: t.other,
        count: rows.filter((item) => item.kind === "OTHER").length,
      },
    ],
    [rows, t],
  );

  const columnOptions: Array<{ key: keyof VisibleColumns; label: string }> = [
    { key: "code", label: t.table.code },
    { key: "name", label: t.table.name },
    { key: "kind", label: t.table.kind },
    { key: "status", label: t.table.status },
    { key: "manager", label: t.table.manager },
    { key: "totalDebit", label: t.table.debit },
    { key: "totalCredit", label: t.table.credit },
    { key: "netAmount", label: t.table.net },
    { key: "transactions", label: t.table.transactions },
    { key: "actions", label: t.table.action },
  ];

  const loadCostCenters = useCallback(
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
          "/api/accounting/cost-centers/?page_size=500",
          "/api/accounting/reports/cost-centers/?page_size=500",
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
          .map(normalizeCostCenter)
          .filter((item) => item.id || item.code || item.name);

        setRows(normalizedRows);
        setSummary(buildSummary(normalizedRows, extractSummary(loadedPayload)));
        setPage(1);

        if (showToast) {
          toast.success(t.loadSuccess);
        }
      } catch (error) {
        console.error("Cost centers load error:", error);
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
    setKindFilter("ALL");
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
      filename: `primey-care-cost-centers-${generatedAt
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "مراكز التكلفة" : "Cost Centers",
      title: t.title,
      locale,
      summaryRows: [
        [t.generatedAt, generatedAt.toLocaleString("en-US")],
        [t.totalCenters, summary.total_centers],
        [t.activeCenters, summary.active_centers],
        [t.inactiveCenters, summary.inactive_centers],
        [t.totalDebit, formatMoney(summary.total_debit)],
        [t.totalCredit, formatMoney(summary.total_credit)],
        [t.netAmount, formatMoney(summary.net_amount)],
        [t.transactionsCount, summary.transactions_count],
      ],
      headers: [
        "ID",
        t.table.code,
        t.table.name,
        t.table.kind,
        t.table.status,
        t.table.manager,
        t.table.debit,
        t.table.credit,
        t.table.net,
        t.table.transactions,
      ],
      rows: filteredRows.map((item) => [
        item.id || "-",
        item.code || "-",
        item.name || "-",
        kindLabel(item.kind, locale),
        statusLabel(item.status, locale),
        item.manager_name || "-",
        formatMoney(item.total_debit),
        formatMoney(item.total_credit),
        formatMoney(item.net_amount),
        item.transactions_count,
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
    loadCostCenters(false);
  }, [authResolving, loadCostCenters]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, kindFilter]);

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
            onClick={() => loadCostCenters(true)}
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
              disabled={isLoading || filteredRows.length === 0 || Boolean(errorMessage)}
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
              disabled={isLoading || filteredRows.length === 0 || Boolean(errorMessage)}
            >
              <Printer className="h-4 w-4" />
              <span>{t.print}</span>
            </Button>
          ) : null}

          {canCreate ? (
            <Link href="/system/accounting/cost-centers/create">
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
              onClick={() => loadCostCenters(true)}
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
                        <Building2 className="h-3.5 w-3.5" />
                        {t.totalCenters}
                      </p>
                      <div className="mt-3 text-2xl font-bold">
                        {formatNumber(summary.total_centers)}
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-slate-950 dark:bg-slate-200" />
                    </div>

                    <div className="rounded-2xl border bg-background p-4">
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {t.activeCenters}
                      </p>
                      <div className="mt-3 text-2xl font-bold">
                        {formatNumber(summary.active_centers)}
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
                      <div className="mt-3 h-2 rounded-full bg-sky-500" />
                    </div>

                    <div className="rounded-2xl border bg-background p-4">
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <TrendingDown className="h-3.5 w-3.5" />
                        {t.totalCredit}
                      </p>
                      <div className="mt-3 text-2xl font-bold">
                        <MoneyText value={summary.total_credit} />
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
                          <DropdownMenuLabel>{t.allKinds}</DropdownMenuLabel>
                          <DropdownMenuSeparator />

                          {kindOptions.map((item) => (
                            <DropdownMenuCheckboxItem
                              key={item.value}
                              checked={kindFilter === item.value}
                              onCheckedChange={() => setKindFilter(item.value)}
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
                          {visibleColumns.code ? (
                            <TableHead className="min-w-[110px]">
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

                          {visibleColumns.kind ? (
                            <TableHead className="min-w-[120px]">
                              {t.table.kind}
                            </TableHead>
                          ) : null}

                          {visibleColumns.status ? (
                            <TableHead className="min-w-[120px]">
                              {t.table.status}
                            </TableHead>
                          ) : null}

                          {visibleColumns.manager ? (
                            <TableHead className="min-w-[150px]">
                              {t.table.manager}
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

                          {visibleColumns.netAmount ? (
                            <TableHead className="min-w-[140px]">
                              <button
                                type="button"
                                onClick={() => toggleSort("net_amount")}
                                className="inline-flex items-center gap-1 font-medium"
                              >
                                {t.table.net}
                                {sortKey === "net_amount" &&
                                  (sortDirection === "asc" ? (
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  ) : (
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  ))}
                              </button>
                            </TableHead>
                          ) : null}

                          {visibleColumns.transactions ? (
                            <TableHead className="min-w-[120px]">
                              <button
                                type="button"
                                onClick={() => toggleSort("transactions_count")}
                                className="inline-flex items-center gap-1 font-medium"
                              >
                                {t.table.transactions}
                                {sortKey === "transactions_count" &&
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
                            <TableRow key={`${item.id}-${item.code}`}>
                              {visibleColumns.code ? (
                                <TableCell className="font-semibold" dir="ltr">
                                  {item.code || "-"}
                                </TableCell>
                              ) : null}

                              {visibleColumns.name ? (
                                <TableCell>
                                  <div className="min-w-[200px]">
                                    <p className="font-medium">
                                      {item.name || "-"}
                                    </p>
                                    <p className="line-clamp-1 text-xs text-muted-foreground">
                                      {item.description || item.parent_name || "-"}
                                    </p>
                                  </div>
                                </TableCell>
                              ) : null}

                              {visibleColumns.kind ? (
                                <TableCell>{kindBadge(item.kind, locale)}</TableCell>
                              ) : null}

                              {visibleColumns.status ? (
                                <TableCell>
                                  {statusBadge(item.status, locale)}
                                </TableCell>
                              ) : null}

                              {visibleColumns.manager ? (
                                <TableCell>{item.manager_name || "-"}</TableCell>
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

                              {visibleColumns.netAmount ? (
                                <TableCell>
                                  <MoneyText value={item.net_amount} />
                                </TableCell>
                              ) : null}

                              {visibleColumns.transactions ? (
                                <TableCell>
                                  {formatNumber(item.transactions_count)}
                                </TableCell>
                              ) : null}

                              {visibleColumns.actions && canViewDetails ? (
                                <TableCell>
                                  {isValidId(item.id) ? (
                                    <Link
                                      href={`/system/accounting/cost-centers/${item.id}`}
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
                                <Building2 className="h-10 w-10 text-muted-foreground/40" />
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
                                  <Link href="/system/accounting/cost-centers/create">
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
                      <Building2 className="h-5 w-5" />
                    </div>

                    <div>
                      <p className="text-sm font-semibold">{t.totalCenters}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(summary.total_centers)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">
                      {t.activeCenters}
                    </p>
                    <div className="mt-2 text-lg font-bold">
                      {formatNumber(summary.active_centers)}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">
                      {t.inactiveCenters}
                    </p>
                    <div className="mt-2 text-lg font-bold">
                      {formatNumber(summary.inactive_centers)}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">
                      {t.accountsCount}
                    </p>
                    <div className="mt-2 text-lg font-bold">
                      {formatNumber(summary.accounts_count)}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">
                      {t.transactionsCount}
                    </p>
                    <div className="mt-2 text-lg font-bold">
                      {formatNumber(summary.transactions_count)}
                    </div>
                  </div>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-3 py-2 text-sm">
                    <span>{t.totalDebit}</span>
                    <MoneyText value={summary.total_debit} />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
                    <span>{t.totalCredit}</span>
                    <MoneyText value={summary.total_credit} />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
                    <span>{t.netAmount}</span>
                    <MoneyText value={summary.net_amount} />
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
                        {formatNumber(summary.active_centers)}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t.activeCenters}
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
                        <MoneyText value={summary.total_debit} />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t.totalDebit}
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
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

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
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
                        {formatNumber(summary.transactions_count)}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t.transactionsCount}
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