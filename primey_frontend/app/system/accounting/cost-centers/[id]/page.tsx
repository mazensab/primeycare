"use client";

/* ============================================================
   📂 app/system/accounting/cost-centers/[id]/page.tsx
   🧠 Primey Care | Accounting Cost Center Detail Page

   ✅ المسار:
      app/system/accounting/cost-centers/[id]/page.tsx

   ✅ العمل:
      صفحة تفاصيل مركز التكلفة داخل مديول المحاسبة.
      تعرض بيانات المركز، الحالة، الميزانية، ملخص الحركة، والحركات المحاسبية المرتبطة.

   ✅ الإصدار:
      Phase 17 UX Refinement + Accounting Cost Center Detail Build

   ✅ يعتمد على:
      - /api/accounting/cost-centers/{id}/
      - /api/accounting/reports/cost-centers/{id}/ كـ fallback آمن
      - /api/accounting/ledger/?cost_center_id={id} كـ fallback للحركات
      - primey-locale
      - AuthProvider
      - sonner
      - /currency/sar.svg

   ✅ متوافق مع:
      - Accounting cost centers page
      - Accounting cost centers create page
      - Accounting accounts detail page
      - Accounting journals approved pattern
      - Centers / Customers approved UX standard

   ✅ الوظائف:
      - عرض تفاصيل مركز التكلفة.
      - عرض ملخص المدين والدائن والصافي والميزانية.
      - عرض الحركات المحاسبية المرتبطة بالمركز.
      - بحث داخل الحركات.
      - فلاتر الفترة.
      - التحكم بالأعمدة.
      - فرز الحركات.
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
      - بناء الصفحة من الصفر بدل الصفحة المؤقتة.
      - الالتزام بالقاعدة: w-full space-y-4 بدون main/min-h-screen/max-w.
      - إزالة أي عبارات تقنية أو مؤقتة من واجهة المستخدم.
      - عدم عرض مسارات داخل الواجهة.
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
  Building2,
  CalendarDays,
  Columns3,
  Download,
  Eye,
  FileText,
  Filter,
  Layers3,
  Loader2,
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

type CostCenterStatus = "ACTIVE" | "INACTIVE" | "UNKNOWN";

type CostCenterKind =
  | "OPERATIONAL"
  | "ADMINISTRATIVE"
  | "SALES"
  | "SERVICE"
  | "OTHER"
  | "UNKNOWN";

type SortKey =
  | "entry_date"
  | "journal_entry_number"
  | "posting_source"
  | "reference"
  | "description"
  | "debit_amount"
  | "credit_amount"
  | "net_amount"
  | "created_at";

type SortDirection = "asc" | "desc";

type CostCenterDetail = {
  id: string;
  code: string;
  name: string;
  description: string;
  kind: CostCenterKind;
  status: CostCenterStatus;
  parent_id: string;
  parent_name: string;
  manager_name: string;
  estimated_budget: number;
  total_debit: number;
  total_credit: number;
  net_amount: number;
  accounts_count: number;
  transactions_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type CostCenterTransaction = {
  id: string;
  journal_entry_id: string;
  journal_entry_number: string;
  entry_date: string;
  posting_source: string;
  reference: string;
  external_reference: string;
  description: string;
  account_code: string;
  account_name: string;
  debit_amount: number;
  credit_amount: number;
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
  transactions?: unknown[];
  movements?: unknown[];
  entries?: unknown[];
  cost_center?: unknown;
  summary?: Partial<CostCenterDetail>;
};

type VisibleColumns = {
  entryDate: boolean;
  journalNumber: boolean;
  source: boolean;
  reference: boolean;
  account: boolean;
  description: boolean;
  debit: boolean;
  credit: boolean;
  net: boolean;
  actions: boolean;
};

const SAR_ICON_PATH = "/currency/sar.svg";
const PAGE_SIZE = 16;

const DEFAULT_COLUMNS: VisibleColumns = {
  entryDate: true,
  journalNumber: true,
  source: true,
  reference: true,
  account: true,
  description: true,
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
    title: isArabic ? "تفاصيل مركز التكلفة" : "Cost Center Details",
    subtitle: isArabic
      ? "عرض بيانات مركز التكلفة، الميزانية، والأرصدة والحركات المحاسبية المرتبطة."
      : "View cost center information, budget, balances, and linked accounting movements.",

    back: isArabic ? "مراكز التكلفة" : "Cost Centers",
    accounting: isArabic ? "لوحة المحاسبة" : "Accounting Overview",
    reports: isArabic ? "تقارير المحاسبة" : "Accounting Reports",
    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",

    statusTitle: isArabic ? "ملخص مركز التكلفة" : "Cost Center Summary",
    statusDesc: isArabic
      ? "مؤشرات مركز التكلفة حسب الفترة والبيانات الحالية."
      : "Cost center indicators based on current data and selected period.",
    infoTitle: isArabic ? "بيانات مركز التكلفة" : "Cost Center Information",
    infoDesc: isArabic
      ? "المعلومات الأساسية والتصنيف والحالة."
      : "Basic information, classification, and status.",
    transactionsTitle: isArabic ? "حركات مركز التكلفة" : "Cost Center Transactions",
    transactionsDesc: isArabic
      ? "القيود والحركات المحاسبية المرتبطة بمركز التكلفة."
      : "Journal entries and accounting movements linked to this cost center.",

    code: isArabic ? "الكود" : "Code",
    name: isArabic ? "الاسم" : "Name",
    kind: isArabic ? "النوع" : "Type",
    status: isArabic ? "الحالة" : "Status",
    parent: isArabic ? "المركز الأب" : "Parent Center",
    manager: isArabic ? "المسؤول" : "Manager",
    description: isArabic ? "الوصف" : "Description",
    createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
    updatedAt: isArabic ? "آخر تحديث" : "Updated At",

    estimatedBudget: isArabic ? "الميزانية التقديرية" : "Estimated Budget",
    totalDebit: isArabic ? "إجمالي المدين" : "Total Debit",
    totalCredit: isArabic ? "إجمالي الدائن" : "Total Credit",
    netAmount: isArabic ? "الصافي" : "Net Amount",
    accountsCount: isArabic ? "الحسابات المرتبطة" : "Linked Accounts",
    transactionsCount: isArabic ? "الحركات المرتبطة" : "Linked Transactions",

    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
    unknown: isArabic ? "غير محدد" : "Unknown",

    operational: isArabic ? "تشغيلي" : "Operational",
    administrative: isArabic ? "إداري" : "Administrative",
    sales: isArabic ? "مبيعات" : "Sales",
    service: isArabic ? "خدمة" : "Service",
    other: isArabic ? "أخرى" : "Other",

    filters: isArabic ? "الفلاتر" : "Filters",
    dateFrom: isArabic ? "من تاريخ" : "Date From",
    dateTo: isArabic ? "إلى تاريخ" : "Date To",
    applyFilters: isArabic ? "تطبيق الفلاتر" : "Apply Filters",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",

    searchPlaceholder: isArabic
      ? "ابحث في رقم القيد أو المرجع أو الحساب أو الوصف..."
      : "Search journal number, reference, account, or description...",
    columns: isArabic ? "الأعمدة" : "Columns",

    table: {
      entryDate: isArabic ? "التاريخ" : "Date",
      journalNumber: isArabic ? "رقم القيد" : "Journal No.",
      source: isArabic ? "المصدر" : "Source",
      reference: isArabic ? "المرجع" : "Reference",
      account: isArabic ? "الحساب" : "Account",
      description: isArabic ? "الوصف" : "Description",
      debit: isArabic ? "مدين" : "Debit",
      credit: isArabic ? "دائن" : "Credit",
      net: isArabic ? "الصافي" : "Net",
      action: isArabic ? "الإجراء" : "Action",
    },

    view: isArabic ? "عرض" : "View",

    emptyTitle: isArabic ? "لا توجد حركات" : "No transactions",
    emptyText: isArabic
      ? "لم يتم العثور على حركات محاسبية مرتبطة بمركز التكلفة حسب الفلاتر الحالية."
      : "No accounting movements were found for this cost center with the current filters.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير البحث أو الفلاتر."
      : "Try changing the search or filters.",

    notFoundTitle: isArabic ? "مركز التكلفة غير موجود" : "Cost center not found",
    notFoundText: isArabic
      ? "لم يتم العثور على مركز التكلفة المطلوب."
      : "The requested cost center could not be found.",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض مركز التكلفة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض تفاصيل مراكز التكلفة. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view cost center details. Contact your system administrator if you need access.",

    loadError: isArabic
      ? "تعذر تحميل تفاصيل مركز التكلفة."
      : "Unable to load cost center details.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    loadSuccess: isArabic
      ? "تم تحديث تفاصيل مركز التكلفة بنجاح."
      : "Cost center details refreshed successfully.",
    invalidDate: isArabic
      ? "لا يمكن أن يكون تاريخ البداية أكبر من تاريخ النهاية."
      : "Date from cannot be greater than date to.",

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
    "cost_center",
    "costCenter",
    "center",
    "account",
    "journal",
    "journal_entry",
    "entry",
    "line",
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

function extractData(payload: ApiEnvelope<unknown> | null): Dict {
  if (!payload) return {};

  const data = asDict(payload.data);

  if (data.cost_center && typeof data.cost_center === "object") {
    return data.cost_center as Dict;
  }

  if (payload.cost_center && typeof payload.cost_center === "object") {
    return payload.cost_center as Dict;
  }

  return Object.keys(data).length > 0 ? data : asDict(payload);
}

function extractTransactions(payload: ApiEnvelope<unknown> | null): unknown[] {
  if (!payload) return [];

  const data = asDict(payload.data);

  if (Array.isArray(payload.transactions)) return payload.transactions;
  if (Array.isArray(payload.movements)) return payload.movements;
  if (Array.isArray(payload.entries)) return payload.entries;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.items)) return payload.items;

  if (Array.isArray(data.transactions)) return data.transactions;
  if (Array.isArray(data.movements)) return data.movements;
  if (Array.isArray(data.entries)) return data.entries;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.items)) return data.items;

  return [];
}

function normalizeCostCenter(item: unknown): CostCenterDetail {
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
    estimated_budget: toNumber(
      getNestedValue(obj, ["estimated_budget", "budget_amount", "budget"]),
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

function normalizeTransaction(item: unknown, index: number): CostCenterTransaction {
  const obj = asDict(item);
  const debit = toNumber(
    getNestedValue(obj, ["debit_amount", "total_debit", "debit"]),
  );
  const credit = toNumber(
    getNestedValue(obj, ["credit_amount", "total_credit", "credit"]),
  );

  const explicitNet = getNestedValue(obj, [
    "net_amount",
    "movement_amount",
    "amount",
    "balance",
  ]);

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || `${index}`),
    journal_entry_id: String(
      getNestedValue(obj, [
        "journal_entry_id",
        "entry_id",
        "journal_id",
        "journal_entry",
      ]) || "",
    ),
    journal_entry_number: String(
      getNestedValue(obj, [
        "journal_entry_number",
        "entry_number",
        "journal_number",
        "number",
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
      getNestedValue(obj, [
        "description",
        "line_description",
        "entry_description",
        "memo",
        "notes",
      ]) || "",
    ),
    account_code: String(
      getNestedValue(obj, ["account_code", "code"]) || "",
    ),
    account_name: String(
      getNestedValue(obj, ["account_name", "name"]) || "",
    ),
    debit_amount: debit,
    credit_amount: credit,
    net_amount:
      explicitNet === undefined || explicitNet === null || explicitNet === ""
        ? debit - credit
        : toNumber(explicitNet),
    created_at: String(getNestedValue(obj, ["created_at", "created"]) || ""),
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

function sortValue(row: CostCenterTransaction, key: SortKey): string | number {
  if (key === "debit_amount") return row.debit_amount;
  if (key === "credit_amount") return row.credit_amount;
  if (key === "net_amount") return row.net_amount;

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
            ${locale === "ar" ? "ملخص مركز التكلفة" : "Cost Center Summary"}
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
  center,
  rows,
  t,
}: {
  locale: AppLocale;
  title: string;
  center: CostCenterDetail;
  rows: CostCenterTransaction[];
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
          <td>${escapeHtml([item.account_code, item.account_name].filter(Boolean).join(" - ") || "-")}</td>
          <td>${escapeHtml(item.description || "-")}</td>
          <td>${escapeHtml(formatMoney(item.debit_amount))}</td>
          <td>${escapeHtml(formatMoney(item.credit_amount))}</td>
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
              <div>${escapeHtml(center.code)} - ${escapeHtml(center.name)}</div>
              <div>${escapeHtml(t.printedAt)}: ${escapeHtml(now)}</div>
              <div>${escapeHtml(t.rowsCount)}: ${formatNumber(rows.length)}</div>
            </div>
          </div>
          <div class="badge">Primey Care</div>
        </div>

        <div class="summary-grid">
          <div class="summary-card"><span>${escapeHtml(t.estimatedBudget)}</span><strong>${formatMoney(center.estimated_budget)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.totalDebit)}</span><strong>${formatMoney(center.total_debit)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.totalCredit)}</span><strong>${formatMoney(center.total_credit)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.netAmount)}</span><strong>${formatMoney(center.net_amount)}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${escapeHtml(t.table.entryDate)}</th>
              <th>${escapeHtml(t.table.journalNumber)}</th>
              <th>${escapeHtml(t.table.source)}</th>
              <th>${escapeHtml(t.table.reference)}</th>
              <th>${escapeHtml(t.table.account)}</th>
              <th>${escapeHtml(t.table.description)}</th>
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

export default function AccountingCostCenterDetailPage() {
  const params = useParams<{ id?: string }>();
  const auth = useAuth() as unknown;

  const costCenterId = String(params?.id || "");

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [center, setCenter] = useState<CostCenterDetail | null>(null);
  const [transactions, setTransactions] = useState<CostCenterTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [notFound, setNotFound] = useState(false);

  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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
    ["accounting.view", "accounting.cost_centers.view"],
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

  const filteredTransactions = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    const filtered = transactions.filter((item) => {
      const itemDate = item.entry_date ? item.entry_date.slice(0, 10) : "";

      const matchesDateFrom = dateFrom ? itemDate >= dateFrom : true;
      const matchesDateTo = dateTo ? itemDate <= dateTo : true;

      const matchesQuery = !cleanQuery
        ? true
        : [
            item.journal_entry_number,
            item.posting_source,
            item.reference,
            item.external_reference,
            item.description,
            item.account_code,
            item.account_name,
          ]
            .join(" ")
            .toLowerCase()
            .includes(cleanQuery);

      return matchesDateFrom && matchesDateTo && matchesQuery;
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
  }, [dateFrom, dateTo, query, sortDirection, sortKey, transactions]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));

  const paginatedTransactions = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * PAGE_SIZE;

    return filteredTransactions.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredTransactions, page, totalPages]);

  const hasSearchOrFilter =
    query.trim().length > 0 || Boolean(dateFrom) || Boolean(dateTo);

  const visibleColumnCount = Object.entries(visibleColumns).filter(
    ([key, value]) => value && (key !== "actions" || canViewJournal),
  ).length;

  const columnOptions: Array<{ key: keyof VisibleColumns; label: string }> = [
    { key: "entryDate", label: t.table.entryDate },
    { key: "journalNumber", label: t.table.journalNumber },
    { key: "source", label: t.table.source },
    { key: "reference", label: t.table.reference },
    { key: "account", label: t.table.account },
    { key: "description", label: t.table.description },
    { key: "debit", label: t.table.debit },
    { key: "credit", label: t.table.credit },
    { key: "net", label: t.table.net },
    { key: "actions", label: t.table.action },
  ];

  const loadCostCenter = useCallback(
    async (showToast = false) => {
      if (!canView) {
        setIsLoading(false);
        return;
      }

      if (!costCenterId) {
        setIsLoading(false);
        setNotFound(true);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");
        setNotFound(false);

        const endpoints = [
          `/api/accounting/cost-centers/${costCenterId}/`,
          `/api/accounting/reports/cost-centers/${costCenterId}/`,
          `/api/accounting/ledger/${buildQuery({
            cost_center_id: costCenterId,
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

        const normalizedCenter = normalizeCostCenter(extractData(loadedPayload));
        const normalizedTransactions = extractTransactions(loadedPayload).map(
          normalizeTransaction,
        );

        const debitFromTransactions = normalizedTransactions.reduce(
          (sum, item) => sum + item.debit_amount,
          0,
        );
        const creditFromTransactions = normalizedTransactions.reduce(
          (sum, item) => sum + item.credit_amount,
          0,
        );

        const completedCenter: CostCenterDetail = {
          ...normalizedCenter,
          total_debit:
            normalizedCenter.total_debit || debitFromTransactions || 0,
          total_credit:
            normalizedCenter.total_credit || creditFromTransactions || 0,
          net_amount:
            normalizedCenter.net_amount ||
            debitFromTransactions - creditFromTransactions ||
            0,
          transactions_count:
            normalizedCenter.transactions_count ||
            normalizedTransactions.length ||
            0,
        };

        if (!isValidId(completedCenter.id) && !completedCenter.code) {
          setCenter(null);
          setTransactions([]);
          setNotFound(true);
          return;
        }

        setCenter(completedCenter);
        setTransactions(normalizedTransactions);
        setPage(1);

        if (showToast) {
          toast.success(t.loadSuccess);
        }
      } catch (error) {
        console.error("Cost center detail load error:", error);
        setCenter(null);
        setTransactions([]);
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [canView, costCenterId, t.loadError, t.loadSuccess],
  );

  function clearFilters() {
    setQuery("");
    setDateFrom("");
    setDateTo("");
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
    if (!canExport || !center) return;

    if (filteredTransactions.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const generatedAt = new Date();

    downloadExcel({
      filename: `primey-care-cost-center-${center.code || costCenterId}-${generatedAt
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "تفاصيل مركز التكلفة" : "Cost Center Detail",
      title: t.title,
      locale,
      summaryRows: [
        [t.generatedAt, generatedAt.toLocaleString("en-US")],
        [t.code, center.code],
        [t.name, center.name],
        [t.kind, kindLabel(center.kind, locale)],
        [t.status, statusLabel(center.status, locale)],
        [t.manager, center.manager_name || "-"],
        [t.estimatedBudget, formatMoney(center.estimated_budget)],
        [t.totalDebit, formatMoney(center.total_debit)],
        [t.totalCredit, formatMoney(center.total_credit)],
        [t.netAmount, formatMoney(center.net_amount)],
        [t.transactionsCount, center.transactions_count],
      ],
      headers: [
        t.table.entryDate,
        t.table.journalNumber,
        t.table.source,
        t.table.reference,
        t.table.account,
        t.table.description,
        t.table.debit,
        t.table.credit,
        t.table.net,
      ],
      rows: filteredTransactions.map((item) => [
        formatDate(item.entry_date, locale),
        item.journal_entry_number || "-",
        item.posting_source || "-",
        item.reference || "-",
        [item.account_code, item.account_name].filter(Boolean).join(" - ") ||
          "-",
        item.description || "-",
        formatMoney(item.debit_amount),
        formatMoney(item.credit_amount),
        formatMoney(item.net_amount),
      ]),
    });

    toast.success(t.exportSuccess);
  }

  function printPage() {
    if (!canPrint || !center) return;

    if (filteredTransactions.length === 0) {
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
        center,
        rows: filteredTransactions,
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
    loadCostCenter(false);
  }, [authResolving, loadCostCenter]);

  useEffect(() => {
    setPage(1);
  }, [query, dateFrom, dateTo]);

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
            {center
              ? [center.code, center.name].filter(Boolean).join(" - ")
              : t.subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link href="/system/accounting/cost-centers">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
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
            onClick={() => loadCostCenter(true)}
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
                filteredTransactions.length === 0 ||
                Boolean(errorMessage) ||
                !center
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
                filteredTransactions.length === 0 ||
                Boolean(errorMessage) ||
                !center
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
              onClick={() => loadCostCenter(true)}
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
              <Building2 className="h-5 w-5" />
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
          ) : center ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-2xl font-bold">
                        <MoneyText value={center.estimated_budget} />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t.estimatedBudget}
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
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
                        <MoneyText value={center.total_debit} />
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
                        <MoneyText value={center.total_credit} />
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
                        <MoneyText value={center.net_amount} />
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

          {center ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <Building2 className="h-4 w-4" />
                    {t.infoTitle}
                  </CardTitle>
                  <CardDescription>{t.infoDesc}</CardDescription>
                </CardHeader>

                <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">{t.code}</p>
                    <p className="mt-2 font-semibold" dir="ltr">
                      {center.code || "-"}
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">{t.name}</p>
                    <p className="mt-2 font-semibold">{center.name || "-"}</p>
                  </div>

                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">{t.kind}</p>
                    <div className="mt-2">{kindBadge(center.kind, locale)}</div>
                  </div>

                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">{t.status}</p>
                    <div className="mt-2">
                      {statusBadge(center.status, locale)}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">{t.parent}</p>
                    <p className="mt-2 font-semibold">
                      {center.parent_name || "-"}
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">{t.manager}</p>
                    <p className="mt-2 font-semibold">
                      {center.manager_name || "-"}
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-background p-4 md:col-span-2 xl:col-span-3">
                    <p className="text-xs text-muted-foreground">
                      {t.description}
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      {center.description || "-"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <BarChart3 className="h-4 w-4" />
                    {t.statusTitle}
                  </CardTitle>
                  <CardDescription>{t.statusDesc}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">
                      {t.estimatedBudget}
                    </p>
                    <div className="mt-2 text-xl font-bold">
                      <MoneyText value={center.estimated_budget} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border bg-background p-4">
                      <p className="text-xs text-muted-foreground">
                        {t.accountsCount}
                      </p>
                      <div className="mt-2 text-lg font-bold">
                        {formatNumber(center.accounts_count)}
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-background p-4">
                      <p className="text-xs text-muted-foreground">
                        {t.transactionsCount}
                      </p>
                      <div className="mt-2 text-lg font-bold">
                        {formatNumber(center.transactions_count)}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-3 py-2 text-sm">
                      <span>{t.totalDebit}</span>
                      <MoneyText value={center.total_debit} />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
                      <span>{t.totalCredit}</span>
                      <MoneyText value={center.total_credit} />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
                      <span>{t.netAmount}</span>
                      <MoneyText value={center.net_amount} />
                    </div>
                  </div>

                  <div className="grid gap-2 border-t pt-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarDays className="h-4 w-4" />
                      <span>{t.createdAt}</span>
                    </div>
                    <p className="text-sm">{formatDate(center.created_at, locale)}</p>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarDays className="h-4 w-4" />
                      <span>{t.updatedAt}</span>
                    </div>
                    <p className="text-sm">{formatDate(center.updated_at, locale)}</p>
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
                    {t.transactionsTitle}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {t.transactionsDesc}
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl"
                    onClick={() => loadCostCenter(true)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCcw className="h-4 w-4" />
                    )}
                    {t.applyFilters}
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
              <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_auto]">
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

                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="h-11 rounded-xl"
                  aria-label={t.dateFrom}
                />

                <Input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="h-11 rounded-xl"
                  aria-label={t.dateTo}
                />

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

                        {visibleColumns.journalNumber ? (
                          <TableHead className="min-w-[130px]">
                            <button
                              type="button"
                              onClick={() => toggleSort("journal_entry_number")}
                              className="inline-flex items-center gap-1 font-medium"
                            >
                              {t.table.journalNumber}
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

                        {visibleColumns.account ? (
                          <TableHead className="min-w-[180px]">
                            {t.table.account}
                          </TableHead>
                        ) : null}

                        {visibleColumns.description ? (
                          <TableHead className="min-w-[220px]">
                            {t.table.description}
                          </TableHead>
                        ) : null}

                        {visibleColumns.debit ? (
                          <TableHead className="min-w-[130px]">
                            <button
                              type="button"
                              onClick={() => toggleSort("debit_amount")}
                              className="inline-flex items-center gap-1 font-medium"
                            >
                              {t.table.debit}
                              {sortKey === "debit_amount" &&
                                (sortDirection === "asc" ? (
                                  <ArrowUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ArrowDown className="h-3.5 w-3.5" />
                                ))}
                            </button>
                          </TableHead>
                        ) : null}

                        {visibleColumns.credit ? (
                          <TableHead className="min-w-[130px]">
                            <button
                              type="button"
                              onClick={() => toggleSort("credit_amount")}
                              className="inline-flex items-center gap-1 font-medium"
                            >
                              {t.table.credit}
                              {sortKey === "credit_amount" &&
                                (sortDirection === "asc" ? (
                                  <ArrowUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ArrowDown className="h-3.5 w-3.5" />
                                ))}
                            </button>
                          </TableHead>
                        ) : null}

                        {visibleColumns.net ? (
                          <TableHead className="min-w-[130px]">
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
                      ) : paginatedTransactions.length > 0 ? (
                        paginatedTransactions.map((item) => (
                          <TableRow key={`${item.id}-${item.journal_entry_number}`}>
                            {visibleColumns.entryDate ? (
                              <TableCell className="whitespace-nowrap">
                                {formatDate(item.entry_date, locale)}
                              </TableCell>
                            ) : null}

                            {visibleColumns.journalNumber ? (
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

                            {visibleColumns.account ? (
                              <TableCell>
                                <div className="min-w-[170px]">
                                  <p className="font-medium">
                                    {item.account_name || "-"}
                                  </p>
                                  <p className="text-xs text-muted-foreground" dir="ltr">
                                    {item.account_code || "-"}
                                  </p>
                                </div>
                              </TableCell>
                            ) : null}

                            {visibleColumns.description ? (
                              <TableCell>
                                <span className="line-clamp-2 min-w-[200px] text-sm text-muted-foreground">
                                  {item.description || "-"}
                                </span>
                              </TableCell>
                            ) : null}

                            {visibleColumns.debit ? (
                              <TableCell>
                                <MoneyText value={item.debit_amount} />
                              </TableCell>
                            ) : null}

                            {visibleColumns.credit ? (
                              <TableCell>
                                <MoneyText value={item.credit_amount} />
                              </TableCell>
                            ) : null}

                            {visibleColumns.net ? (
                              <TableCell>
                                <MoneyText value={item.net_amount} />
                              </TableCell>
                            ) : null}

                            {visibleColumns.actions && canViewJournal ? (
                              <TableCell>
                                {isValidId(item.journal_entry_id) ? (
                                  <Link
                                    href={`/system/accounting/journals/${item.journal_entry_id}`}
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
                  {t.showing} {formatNumber(paginatedTransactions.length)}{" "}
                  {t.from} {formatNumber(filteredTransactions.length)}
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