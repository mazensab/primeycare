"use client";

/* ============================================================
   📂 app/system/agents/list/page.tsx
   🧠 Primey Care | Agents List
   ------------------------------------------------------------
   ✅ المسار: /system/agents/list
   ✅ الإصدار: v2.0.0 - Centers Pattern + Safe Permissions

   ✅ العمل:
      قائمة كاملة للمندوبين مع البحث والفلاتر والفرز وإدارة الأعمدة
      والتصدير والطباعة.

   ✅ المعيار:
      - مبني بصريًا على نمط المراكز والعملاء المعتمد.
      - دمج UX Refinement مع حماية المرحلة 2.
      - لا يتم إظهار مسارات تقنية أو API داخل الواجهة.
      - لا توجد روابط تقارير داخل الوحدة.
      - البحث في صف مستقل.
      - الفلاتر وإدارة الأعمدة في صف مستقل تحت البحث.
      - Excel بصيغة .xls HTML Workbook.
      - Web PDF Print.
      - Error State مستقل عن Empty State.
      - Skeleton Loading.
      - Empty State ذكي.
      - روابط التفاصيل آمنة وتتحقق من id.
      - إخفاء الأزرار غير المصرح بها بدل تعطيلها.
      - عدم كسر تحميل البيانات للمستخدم system_admin / superadmin.
      - استخدام /currency/sar.svg.
      - الأرقام بالإنجليزية.
      - بدون localhost hardcoded.
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  ArrowLeft,
  BadgeCheck,
  ColumnsIcon,
  Download,
  Eye,
  HandCoins,
  Loader2,
  MapPin,
  MoreHorizontal,
  Phone,
  PlusCircle,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  Star,
  UserRound,
  Users,
  Wallet,
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
  DropdownMenuItem,
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

type AgentStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "DRAFT"
  | "UNKNOWN";

type CommissionType = "PERCENTAGE" | "FIXED" | "UNKNOWN";

type StatusFilter = "ALL" | AgentStatus;
type CommissionFilter = "ALL" | CommissionType;

type SortKey =
  | "agentCode"
  | "fullName"
  | "referralCode"
  | "city"
  | "status"
  | "totalOrders"
  | "totalSales"
  | "approvedCommission";

type SortDirection = "asc" | "desc";

type AuthRecord = Record<string, unknown>;

type Agent = {
  id: number | string;
  fullName: string;
  agentCode: string;
  referralCode: string;
  status: AgentStatus;
  phone: string;
  email: string;
  city: string;
  address: string;
  defaultCommissionType: CommissionType;
  defaultCommissionValue: number;
  totalCustomers: number;
  totalOrders: number;
  totalSales: number;
  pendingCommission: number;
  approvedCommission: number;
  paidCommission: number;
  accountingPostedCommission: number;
  bankName: string;
  bankAccountName: string;
  iban: string;
  notes: string;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
  raw: Record<string, unknown>;
};

type AgentsApiStats = {
  total_agents?: number | string;
  active_agents?: number | string;
  inactive_agents?: number | string;
  suspended_agents?: number | string;
  draft_agents?: number | string;
  total_sales?: number | string;
  total_commission?: number | string;
  total_paid?: number | string;
};

type AgentsApiResponse = {
  ok?: boolean;
  message?: string;
  count?: number;
  results?: unknown[];
  data?: unknown[] | { results?: unknown[]; items?: unknown[]; agents?: unknown[] };
  items?: unknown[];
  agents?: unknown[];
  stats?: AgentsApiStats;
};

type VisibleColumns = {
  agent: boolean;
  code: boolean;
  referral: boolean;
  city: boolean;
  contact: boolean;
  customers: boolean;
  orders: boolean;
  sales: boolean;
  commission: boolean;
  status: boolean;
  actions: boolean;
};

type ExcelSheetOptions = {
  filename: string;
  worksheetName: string;
  title: string;
  locale: AppLocale;
  summaryRows: Array<[string, string | number]>;
  filterRows: Array<[string, string | number]>;
  headers: string[];
  rows: Array<Array<string | number>>;
};

const SAR_ICON_PATH = "/currency/sar.svg";
const PAGE_SIZE = 10;

/* ============================================================
   Locale Helpers
============================================================ */

function readLocale(): AppLocale {
  try {
    if (typeof window === "undefined") return "ar";

    const savedLocale = window.localStorage.getItem("primey-locale");

    if (savedLocale === "en") return "en";
    if (savedLocale === "ar") return "ar";

    return document.documentElement.lang === "en" ? "en" : "ar";
  } catch (error) {
    console.error("Read locale error:", error);
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

/* ============================================================
   API Helper
============================================================ */

function apiUrl(path: string) {
  const base =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "";

  if (!base) return path;

  return `${base.replace(/\/$/, "")}${path}`;
}

/* ============================================================
   Permission Helpers
============================================================ */

function asRecord(value: unknown): AuthRecord {
  return value && typeof value === "object" ? (value as AuthRecord) : {};
}

function getNestedRecord(source: AuthRecord, keys: string[]) {
  for (const key of keys) {
    const value = source[key];

    if (value && typeof value === "object") {
      return value as AuthRecord;
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
                const obj = item as AuthRecord;

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
            const obj = value as AuthRecord;

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

function getAuthUser(authValue: unknown): AuthRecord {
  const auth = asRecord(authValue);

  return getNestedRecord(auth, [
    "user",
    "currentUser",
    "profile",
    "account",
    "session",
    "data",
  ]);
}

function getAuthRoles(authValue: unknown): string[] {
  const auth = asRecord(authValue);
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
  const auth = asRecord(authValue);
  const user = getAuthUser(authValue);

  const authPermissions = asRecord(auth.permissions);
  const userPermissions = asRecord(user.permissions);
  const authProfilePermissions = asRecord(auth.profile_permissions);
  const userProfilePermissions = asRecord(user.profile_permissions);

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
  const auth = asRecord(authValue);

  return Boolean(
    auth.isLoading ||
      auth.loading ||
      auth.isInitializing ||
      auth.initializing ||
      auth.pending,
  );
}

function isSystemAdmin(authValue: unknown) {
  const auth = asRecord(authValue);
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

function hasKnownPermissionSignal(authValue: unknown) {
  return (
    getAuthRoles(authValue).length > 0 ||
    getAuthPermissionCodes(authValue).length > 0
  );
}

function hasPermissionCode(authValue: unknown, codes: string[]) {
  const permissions = getAuthPermissionCodes(authValue);

  if (permissions.length === 0) return undefined;

  return codes.some((code) => permissions.includes(code));
}

function hasSafePermission(
  authValue: unknown,
  codes: string[],
  mode: "view" | "action",
) {
  if (isSystemAdmin(authValue)) return true;

  const explicitPermission = hasPermissionCode(authValue, codes);

  if (typeof explicitPermission === "boolean") {
    return explicitPermission;
  }

  const roles = getAuthRoles(authValue);

  if (roles.length > 0) {
    if (mode === "view") {
      return roles.some((role) =>
        ["system_admin", "superuser", "super_admin", "support", "accountant", "viewer"].includes(role),
      );
    }

    return roles.some((role) =>
      ["system_admin", "superuser", "super_admin"].includes(role),
    );
  }

  if (!hasKnownPermissionSignal(authValue)) {
    return true;
  }

  return mode === "view";
}

/* ============================================================
   Normalizers
============================================================ */

function normalizeApiList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== "object") return [];

  const data = payload as AgentsApiResponse;

  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.agents)) return data.agents;
  if (Array.isArray(data.data)) return data.data;

  if (data.data && typeof data.data === "object") {
    const nested = data.data;

    if (Array.isArray(nested.results)) return nested.results;
    if (Array.isArray(nested.items)) return nested.items;
    if (Array.isArray(nested.agents)) return nested.agents;
  }

  return [];
}

function extractNestedValue(obj: Record<string, unknown>, key: string): unknown {
  const direct = obj[key];

  if (direct !== undefined && direct !== null && direct !== "") {
    return direct;
  }

  const containers = ["agent", "stats", "summary", "commissions"];

  for (const container of containers) {
    const nested = obj[container];

    if (nested && typeof nested === "object") {
      const nestedObj = nested as Record<string, unknown>;
      const value = nestedObj[key];

      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }
  }

  return undefined;
}

function normalizeStatus(value: unknown): AgentStatus {
  const status = String(value || "").toUpperCase();

  if (status === "ACTIVE") return "ACTIVE";
  if (status === "INACTIVE") return "INACTIVE";
  if (status === "SUSPENDED") return "SUSPENDED";
  if (status === "DRAFT") return "DRAFT";

  if (value === true) return "ACTIVE";
  if (value === false) return "INACTIVE";

  return "UNKNOWN";
}

function normalizeCommissionType(value: unknown): CommissionType {
  const commissionType = String(value || "").toUpperCase();

  if (commissionType === "PERCENTAGE") return "PERCENTAGE";
  if (commissionType === "FIXED") return "FIXED";

  return "UNKNOWN";
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const clean = String(value ?? "")
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(clean);

  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeAgent(item: unknown): Agent {
  const obj = (item || {}) as Record<string, unknown>;

  const id =
    extractNestedValue(obj, "id") ??
    extractNestedValue(obj, "agent_id") ??
    "";

  const fullName =
    extractNestedValue(obj, "full_name") ??
    extractNestedValue(obj, "name") ??
    extractNestedValue(obj, "agent_name") ??
    "-";

  const agentCode =
    extractNestedValue(obj, "agent_code") ??
    extractNestedValue(obj, "code") ??
    (id ? `AGT-${id}` : "-");

  const referralCode =
    extractNestedValue(obj, "referral_code") ??
    extractNestedValue(obj, "reference") ??
    extractNestedValue(obj, "ref_code") ??
    "-";

  return {
    id: id as number | string,
    fullName: String(fullName || "-"),
    agentCode: String(agentCode || "-"),
    referralCode: String(referralCode || "-"),
    status: normalizeStatus(extractNestedValue(obj, "status")),
    phone: String(extractNestedValue(obj, "phone") ?? ""),
    email: String(extractNestedValue(obj, "email") ?? ""),
    city: String(extractNestedValue(obj, "city") ?? ""),
    address: String(extractNestedValue(obj, "address") ?? ""),
    defaultCommissionType: normalizeCommissionType(
      extractNestedValue(obj, "default_commission_type") ??
        extractNestedValue(obj, "commission_type"),
    ),
    defaultCommissionValue: toNumber(
      extractNestedValue(obj, "default_commission_value") ??
        extractNestedValue(obj, "commission_value") ??
        0,
    ),
    totalCustomers: toNumber(
      extractNestedValue(obj, "total_customers") ??
        extractNestedValue(obj, "customers_count") ??
        extractNestedValue(obj, "customer_count") ??
        0,
    ),
    totalOrders: toNumber(
      extractNestedValue(obj, "total_orders") ??
        extractNestedValue(obj, "orders_count") ??
        extractNestedValue(obj, "order_count") ??
        0,
    ),
    totalSales: toNumber(
      extractNestedValue(obj, "total_sales") ??
        extractNestedValue(obj, "sales_total") ??
        extractNestedValue(obj, "orders_total") ??
        0,
    ),
    pendingCommission: toNumber(
      extractNestedValue(obj, "pending_commission") ??
        extractNestedValue(obj, "pending_commissions") ??
        0,
    ),
    approvedCommission: toNumber(
      extractNestedValue(obj, "approved_commission") ??
        extractNestedValue(obj, "approved_commissions") ??
        extractNestedValue(obj, "total_commission") ??
        0,
    ),
    paidCommission: toNumber(
      extractNestedValue(obj, "paid_commission") ??
        extractNestedValue(obj, "paid_commissions") ??
        0,
    ),
    accountingPostedCommission: toNumber(
      extractNestedValue(obj, "accounting_posted_commission") ??
        extractNestedValue(obj, "posted_commission") ??
        0,
    ),
    bankName: String(extractNestedValue(obj, "bank_name") ?? ""),
    bankAccountName: String(extractNestedValue(obj, "bank_account_name") ?? ""),
    iban: String(extractNestedValue(obj, "iban") ?? ""),
    notes: String(extractNestedValue(obj, "notes") ?? ""),
    isFeatured: Boolean(
      extractNestedValue(obj, "is_featured") ??
        extractNestedValue(obj, "featured") ??
        false,
    ),
    createdAt: String(extractNestedValue(obj, "created_at") ?? ""),
    updatedAt: String(extractNestedValue(obj, "updated_at") ?? ""),
    raw: obj,
  };
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "قائمة المندوبين" : "Agents List",
    subtitle: isArabic
      ? "إدارة المندوبين مع البحث والفلاتر والأعمدة والفرز والتصدير."
      : "Manage agents with search, filters, columns, sorting, and export.",

    back: isArabic ? "لوحة المندوبين" : "Agents Overview",
    createAgent: isArabic ? "إنشاء مندوب" : "Create Agent",
    refresh: isArabic ? "تحديث" : "Refresh",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",
    columns: isArabic ? "الأعمدة" : "Columns",

    tableTitle: isArabic ? "بيانات المندوبين" : "Agents Data",
    tableSubtitle: isArabic
      ? "استعرض المندوبين، رتّب البيانات، وخصص الأعمدة حسب احتياجك."
      : "Browse agents, sort data, and customize columns as needed.",

    searchPlaceholder: isArabic
      ? "ابحث باسم المندوب أو الكود أو الإحالة أو المدينة أو الجوال..."
      : "Search by agent name, code, referral, city, or phone...",

    all: isArabic ? "الكل" : "All",
    allStatuses: isArabic ? "كل الحالات" : "All Statuses",
    allCommissions: isArabic ? "كل العمولات" : "All Commissions",

    totalAgents: isArabic ? "إجمالي المندوبين" : "Total Agents",
    activeAgents: isArabic ? "النشطون" : "Active Agents",
    totalOrders: isArabic ? "الطلبات" : "Orders",
    totalCommissions: isArabic ? "العمولات" : "Commissions",

    active: isArabic ? "نشط" : "Active",
    draft: isArabic ? "مسودة" : "Draft",
    suspended: isArabic ? "موقوف" : "Suspended",
    inactive: isArabic ? "غير نشط" : "Inactive",
    unknown: isArabic ? "غير محدد" : "Unknown",

    percentage: isArabic ? "نسبة" : "Percentage",
    fixed: isArabic ? "مبلغ ثابت" : "Fixed Amount",

    featuredLabel: isArabic ? "مميز" : "Featured",
    normalLabel: isArabic ? "عادي" : "Normal",

    selectedRows: isArabic ? "صفوف محددة" : "row(s) selected",
    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",
    page: isArabic ? "صفحة" : "Page",
    from: isArabic ? "من" : "of",

    emptyTitle: isArabic ? "لا يوجد مندوبون بعد" : "No agents yet",
    emptyText: isArabic
      ? "عند إضافة مندوبين جدد ستظهر بياناتهم هنا مباشرة."
      : "New agents will appear here once they are added.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير كلمات البحث أو فلاتر الحالة والعمولة."
      : "Try changing search keywords, status filters, or commission filters.",

    actions: isArabic ? "الإجراءات" : "Actions",
    viewDetails: isArabic ? "عرض التفاصيل" : "View Details",
    copyCode: isArabic ? "نسخ كود المندوب" : "Copy Agent Code",
    copyId: isArabic ? "نسخ المعرف" : "Copy ID",
    copied: isArabic ? "تم النسخ بنجاح" : "Copied successfully",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الصفحة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض بيانات المندوبين. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view agents data. Contact your system administrator if you need access.",

    loadError: isArabic
      ? "تعذر تحميل قائمة المندوبين."
      : "Unable to load agents list.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    refreshSuccess: isArabic
      ? "تم تحديث قائمة المندوبين بنجاح."
      : "Agents list refreshed successfully.",
    exportSuccess: isArabic
      ? "تم تجهيز ملف Excel بنجاح."
      : "Excel file prepared successfully.",
    exportEmpty: isArabic
      ? "لا توجد بيانات قابلة للتصدير."
      : "No data available to export.",
    printReady: isArabic
      ? "تم تجهيز نافذة الطباعة."
      : "Print window prepared.",
    printError: isArabic
      ? "تعذر فتح نافذة الطباعة."
      : "Unable to open print window.",

    generatedAt: isArabic ? "تاريخ التصدير" : "Generated At",
    reportScope: isArabic ? "نطاق التقرير" : "Report Scope",
    currentFilteredData: isArabic
      ? "حسب الفلاتر الحالية"
      : "Current filtered data",
    selectedScope: isArabic ? "الصفوف المحددة" : "Selected rows",
    filterSearch: isArabic ? "البحث" : "Search",
    filterStatus: isArabic ? "فلتر الحالة" : "Status Filter",
    filterCommission: isArabic ? "فلتر العمولة" : "Commission Filter",

    table: {
      id: isArabic ? "المعرف" : "ID",
      agent: isArabic ? "المندوب" : "Agent",
      code: isArabic ? "الكود" : "Code",
      referral: isArabic ? "كود الإحالة" : "Referral Code",
      city: isArabic ? "المدينة" : "City",
      contact: isArabic ? "التواصل" : "Contact",
      customers: isArabic ? "العملاء" : "Customers",
      orders: isArabic ? "الطلبات" : "Orders",
      sales: isArabic ? "المبيعات" : "Sales",
      commission: isArabic ? "العمولة" : "Commission",
      commissionType: isArabic ? "نوع العمولة" : "Commission Type",
      pendingCommission: isArabic ? "عمولة معلقة" : "Pending Commission",
      approvedCommission: isArabic ? "عمولة معتمدة" : "Approved Commission",
      paidCommission: isArabic ? "عمولة مدفوعة" : "Paid Commission",
      status: isArabic ? "الحالة" : "Status",
      actions: isArabic ? "الإجراء" : "Action",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      updatedAt: isArabic ? "آخر تحديث" : "Updated",
    },

    printTitle: isArabic ? "قائمة المندوبين" : "Agents List",
    printedAt: isArabic ? "تاريخ الطباعة" : "Printed At",
    rowsCount: isArabic ? "عدد السجلات" : "Rows Count",
  };
}

/* ============================================================
   UI Helpers
============================================================ */

function formatNumber(value: number | string): string {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return "0";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(numericValue);
}

function formatMoney(value: number | string): string {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return "0.00";

  return numericValue.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

function statusLabel(status: AgentStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<AgentStatus, string> = {
    ACTIVE: t.active,
    INACTIVE: t.inactive,
    SUSPENDED: t.suspended,
    DRAFT: t.draft,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function commissionLabel(type: CommissionType, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<CommissionType, string> = {
    PERCENTAGE: t.percentage,
    FIXED: t.fixed,
    UNKNOWN: t.unknown,
  };

  return labels[type];
}

function statusBadge(status: AgentStatus, locale: AppLocale) {
  const label = statusLabel(status, locale);

  if (status === "ACTIVE") {
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

  if (status === "SUSPENDED") {
    return (
      <Badge className="rounded-full border-orange-200 bg-orange-50 px-3 py-1 text-orange-700 hover:bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300">
        {label}
      </Badge>
    );
  }

  if (status === "INACTIVE") {
    return (
      <Badge variant="outline" className="rounded-full px-3 py-1">
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

function isValidAgentId(id: Agent["id"]) {
  const value = String(id || "").trim();

  return value.length > 0 && value !== "-" && value !== "undefined";
}

function SarAmount({ value }: { value: number | string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span>{formatMoney(value)}</span>
      <Image
        src={SAR_ICON_PATH}
        alt=""
        width={14}
        height={14}
        className="h-3.5 w-3.5"
      />
    </span>
  );
}

function getColumnLabels(locale: AppLocale) {
  const t = dictionary(locale);

  return {
    agent: t.table.agent,
    code: t.table.code,
    referral: t.table.referral,
    city: t.table.city,
    contact: t.table.contact,
    customers: t.table.customers,
    orders: t.table.orders,
    sales: t.table.sales,
    commission: t.table.commission,
    status: t.table.status,
    actions: t.actions,
  } satisfies Record<keyof VisibleColumns, string>;
}

/* ============================================================
   Export / Print
============================================================ */

function downloadExcel(options: ExcelSheetOptions) {
  const dir = options.locale === "ar" ? "rtl" : "ltr";
  const align = options.locale === "ar" ? "right" : "left";
  const colspan = Math.max(options.headers.length, 2);

  const summaryHtml = options.summaryRows
    .map(
      ([label, value]) => `
        <tr>
          <td class="summary-label">${escapeHtml(label)}</td>
          <td class="summary-value">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  const filterHtml = options.filterRows
    .map(
      ([label, value]) => `
        <tr>
          <td class="summary-label">${escapeHtml(label)}</td>
          <td class="summary-value">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  const headerHtml = options.headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join("");

  const rowsHtml = options.rows
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
                <x:Name>${escapeHtml(options.worksheetName)}</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayRightToLeft>${options.locale === "ar" ? "True" : "False"}</x:DisplayRightToLeft>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body {
            direction: ${dir};
            font-family: Arial, sans-serif;
          }
          table {
            border-collapse: collapse;
            width: 100%;
          }
          th,
          td {
            border: 1px solid #d9e2ef;
            padding: 8px;
            text-align: ${align};
            vertical-align: top;
            mso-number-format: "\\@";
          }
          th {
            background: #d8ecfb;
            color: #000000;
            font-weight: 700;
          }
          .title {
            font-size: 20px;
            font-weight: 700;
            text-align: center;
            background: #ffffff;
          }
          .section {
            font-weight: 700;
            background: #eef6ff;
          }
          .summary-label {
            font-weight: 700;
            background: #f8fafc;
            width: 240px;
          }
          .summary-value {
            font-weight: 700;
          }
        </style>
      </head>
      <body dir="${dir}">
        <table>
          <tr>
            <td class="title" colspan="${colspan}">
              ${escapeHtml(options.title)}
            </td>
          </tr>
          <tr><td colspan="${colspan}"></td></tr>
          <tr><td class="section" colspan="${colspan}">
            ${options.locale === "ar" ? "ملخص القائمة" : "List Summary"}
          </td></tr>
          ${summaryHtml}
          <tr><td colspan="${colspan}"></td></tr>
          <tr><td class="section" colspan="${colspan}">
            ${options.locale === "ar" ? "الفلاتر المستخدمة" : "Applied Filters"}
          </td></tr>
          ${filterHtml}
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
  anchor.download = options.filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

function buildPrintHtml({
  locale,
  title,
  rows,
  t,
}: {
  locale: AppLocale;
  title: string;
  rows: Agent[];
  t: ReturnType<typeof dictionary>;
}) {
  const isArabic = locale === "ar";
  const now = new Date().toLocaleString("en-US");

  const tableRows = rows
    .map(
      (agent, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(agent.agentCode || "-")}</td>
          <td>${escapeHtml(agent.fullName || "-")}</td>
          <td>${escapeHtml(agent.referralCode || "-")}</td>
          <td>${escapeHtml(agent.city || "-")}</td>
          <td>${escapeHtml(agent.phone || agent.email || "-")}</td>
          <td>${escapeHtml(formatNumber(agent.totalCustomers))}</td>
          <td>${escapeHtml(formatNumber(agent.totalOrders))}</td>
          <td>${escapeHtml(formatMoney(agent.totalSales))}</td>
          <td>${escapeHtml(formatMoney(agent.approvedCommission))}</td>
          <td>${escapeHtml(statusLabel(agent.status, locale))}</td>
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
          h1 {
            margin: 0;
            font-size: 22px;
            font-weight: 800;
          }
          .meta {
            margin-top: 8px;
            color: #6b7280;
            font-size: 12px;
            line-height: 1.8;
          }
          .badge {
            display: inline-block;
            border: 1px solid #d1d5db;
            border-radius: 999px;
            padding: 4px 10px;
            font-size: 12px;
            color: #374151;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          th {
            background: #f3f4f6;
            color: #111827;
            font-weight: 700;
          }
          th,
          td {
            border: 1px solid #e5e7eb;
            padding: 9px 8px;
            text-align: ${isArabic ? "right" : "left"};
            vertical-align: top;
          }
          tr:nth-child(even) td {
            background: #fafafa;
          }
          @page {
            size: A4 landscape;
            margin: 12mm;
          }
          @media print {
            body { padding: 0; }
          }
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

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${escapeHtml(t.table.code)}</th>
              <th>${escapeHtml(t.table.agent)}</th>
              <th>${escapeHtml(t.table.referral)}</th>
              <th>${escapeHtml(t.table.city)}</th>
              <th>${escapeHtml(t.table.contact)}</th>
              <th>${escapeHtml(t.table.customers)}</th>
              <th>${escapeHtml(t.table.orders)}</th>
              <th>${escapeHtml(t.table.sales)}</th>
              <th>${escapeHtml(t.table.commission)}</th>
              <th>${escapeHtml(t.table.status)}</th>
            </tr>
          </thead>
          <tbody>
            ${
              tableRows ||
              `<tr><td colspan="11" style="text-align:center">${escapeHtml(t.emptyTitle)}</td></tr>`
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
   Skeleton
============================================================ */

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function StatCardSkeleton() {
  return (
    <Card className="rounded-2xl border bg-card shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <SkeletonLine className="h-7 w-16" />
            <SkeletonLine className="h-4 w-28" />
          </div>
          <SkeletonLine className="h-10 w-10 rounded-xl" />
        </div>
        <div className="mt-4 flex items-center gap-2">
          <SkeletonLine className="h-3 w-8" />
          <SkeletonLine className="h-2 flex-1" />
        </div>
      </CardContent>
    </Card>
  );
}

function TableRowsSkeleton({ columnsCount }: { columnsCount: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columnsCount }).map((__, columnIndex) => (
            <TableCell key={columnIndex}>
              <SkeletonLine
                className={
                  columnIndex === 1
                    ? "h-9 w-56 rounded-lg"
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
   Page
============================================================ */

export default function SystemAgentsListPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [apiStats, setApiStats] = useState<AgentsApiStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [commissionFilter, setCommissionFilter] =
    useState<CommissionFilter>("ALL");

  const [sortKey, setSortKey] = useState<SortKey>("fullName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [pageIndex, setPageIndex] = useState(0);

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    agent: true,
    code: true,
    referral: true,
    city: true,
    contact: true,
    customers: true,
    orders: true,
    sales: true,
    commission: true,
    status: true,
    actions: true,
  });

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const authResolving = isAuthResolving(auth);

  const canViewAgents = hasSafePermission(
    auth,
    ["agents.view", "agents.list"],
    "view",
  );

  const canCreateAgents = hasSafePermission(
    auth,
    ["agents.create"],
    "action",
  );

  const canExportAgents = hasSafePermission(
    auth,
    ["agents.export", "reports.export"],
    "action",
  );

  const canPrintAgents = hasSafePermission(
    auth,
    ["agents.print", "reports.print"],
    "action",
  );

  const canViewAgentDetails = hasSafePermission(
    auth,
    ["agents.view", "agents.detail"],
    "view",
  );

  const canViewCommissions = hasSafePermission(
    auth,
    ["agents.commissions.view"],
    "view",
  );

  const safeVisibleColumns = useMemo<VisibleColumns>(
    () => ({
      ...visibleColumns,
      commission: visibleColumns.commission && canViewCommissions,
      actions: visibleColumns.actions && canViewAgentDetails,
    }),
    [canViewAgentDetails, canViewCommissions, visibleColumns],
  );

  const columnLabels = useMemo(() => getColumnLabels(locale), [locale]);

  const stats = useMemo(() => {
    const total = toNumber(apiStats?.total_agents) || agents.length;

    const active =
      toNumber(apiStats?.active_agents) ||
      agents.filter((item) => item.status === "ACTIVE").length;

    const suspended =
      toNumber(apiStats?.suspended_agents) ||
      agents.filter((item) => item.status === "SUSPENDED").length;

    const inactive =
      toNumber(apiStats?.inactive_agents) ||
      agents.filter((item) => item.status === "INACTIVE").length;

    const draft =
      toNumber(apiStats?.draft_agents) ||
      agents.filter((item) => item.status === "DRAFT").length;

    const totalOrders = agents.reduce((sum, item) => sum + item.totalOrders, 0);

    const totalCommissions =
      toNumber(apiStats?.total_commission) ||
      agents.reduce((sum, item) => sum + item.approvedCommission, 0);

    return {
      total,
      active,
      suspended,
      inactive,
      draft,
      totalOrders,
      totalCommissions,
    };
  }, [agents, apiStats]);

  const statusOptions = useMemo(
    () => [
      { value: "ALL" as StatusFilter, label: t.allStatuses, count: agents.length },
      { value: "ACTIVE" as StatusFilter, label: t.active, count: stats.active },
      { value: "DRAFT" as StatusFilter, label: t.draft, count: stats.draft },
      {
        value: "SUSPENDED" as StatusFilter,
        label: t.suspended,
        count: stats.suspended,
      },
      {
        value: "INACTIVE" as StatusFilter,
        label: t.inactive,
        count: stats.inactive,
      },
    ],
    [agents.length, stats, t],
  );

  const commissionOptions = useMemo(
    () => [
      { value: "ALL" as CommissionFilter, label: t.allCommissions },
      { value: "PERCENTAGE" as CommissionFilter, label: t.percentage },
      { value: "FIXED" as CommissionFilter, label: t.fixed },
    ],
    [t],
  );

  const filteredAgents = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return agents.filter((agent) => {
      const matchesStatus =
        statusFilter === "ALL" ? true : agent.status === statusFilter;

      const matchesCommission =
        commissionFilter === "ALL"
          ? true
          : agent.defaultCommissionType === commissionFilter;

      const matchesQuery = !cleanQuery
        ? true
        : [
            agent.fullName,
            agent.agentCode,
            agent.referralCode,
            agent.city,
            agent.phone,
            agent.email,
            agent.status,
            agent.defaultCommissionType,
          ]
            .join(" ")
            .toLowerCase()
            .includes(cleanQuery);

      return matchesStatus && matchesCommission && matchesQuery;
    });
  }, [agents, commissionFilter, query, statusFilter]);

  const sortedAgents = useMemo(() => {
    const rows = [...filteredAgents];

    rows.sort((firstAgent, secondAgent) => {
      let first: string | number = "";
      let second: string | number = "";

      if (sortKey === "agentCode") {
        first = firstAgent.agentCode.toLowerCase();
        second = secondAgent.agentCode.toLowerCase();
      }

      if (sortKey === "fullName") {
        first = firstAgent.fullName.toLowerCase();
        second = secondAgent.fullName.toLowerCase();
      }

      if (sortKey === "referralCode") {
        first = firstAgent.referralCode.toLowerCase();
        second = secondAgent.referralCode.toLowerCase();
      }

      if (sortKey === "city") {
        first = firstAgent.city.toLowerCase();
        second = secondAgent.city.toLowerCase();
      }

      if (sortKey === "status") {
        first = firstAgent.status.toLowerCase();
        second = secondAgent.status.toLowerCase();
      }

      if (sortKey === "totalOrders") {
        first = firstAgent.totalOrders;
        second = secondAgent.totalOrders;
      }

      if (sortKey === "totalSales") {
        first = firstAgent.totalSales;
        second = secondAgent.totalSales;
      }

      if (sortKey === "approvedCommission") {
        first = firstAgent.approvedCommission;
        second = secondAgent.approvedCommission;
      }

      if (first < second) return sortDirection === "asc" ? -1 : 1;
      if (first > second) return sortDirection === "asc" ? 1 : -1;

      return 0;
    });

    return rows;
  }, [filteredAgents, sortDirection, sortKey]);

  const exportRows = useMemo(() => {
    if (selectedIds.length > 0) {
      return sortedAgents.filter((agent) => selectedIds.includes(agent.id));
    }

    return sortedAgents;
  }, [selectedIds, sortedAgents]);

  const pageCount = Math.max(1, Math.ceil(sortedAgents.length / PAGE_SIZE));

  const pageRows = useMemo(() => {
    const start = pageIndex * PAGE_SIZE;
    return sortedAgents.slice(start, start + PAGE_SIZE);
  }, [pageIndex, sortedAgents]);

  const selectedOnPage = pageRows.filter((row) =>
    selectedIds.includes(row.id),
  ).length;

  const allPageSelected =
    pageRows.length > 0 && selectedOnPage === pageRows.length;

  const hasSearchOrFilter =
    query.trim().length > 0 ||
    statusFilter !== "ALL" ||
    commissionFilter !== "ALL";

  const visibleTableColumnsCount =
    1 + Object.values(safeVisibleColumns).filter(Boolean).length;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  function toggleRow(id: string | number) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function toggleAllPageRows() {
    const pageIds = pageRows.map((row) => row.id);

    if (allPageSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !pageIds.includes(id)),
      );
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...pageIds])));
  }

  function clearFilters() {
    setQuery("");
    setStatusFilter("ALL");
    setCommissionFilter("ALL");
  }

  const loadAgents = useCallback(
    async (showToast = false) => {
      if (!canViewAgents) {
        setIsLoading(false);
        setAgents([]);
        setApiStats(null);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");

        const response = await fetch(apiUrl("/api/agents/?page_size=200"), {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        const payload = (await response.json().catch(() => null)) as
          | AgentsApiResponse
          | null;

        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.message || `HTTP ${response.status}`);
        }

        setAgents(normalizeApiList(payload).map(normalizeAgent));
        setApiStats(payload?.stats || null);

        if (showToast) {
          toast.success(t.refreshSuccess);
        }
      } catch (error) {
        console.error("Failed to load agents list:", error);
        setAgents([]);
        setApiStats(null);
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [canViewAgents, t.loadError, t.refreshSuccess],
  );

  function exportExcel() {
    if (!canExportAgents) return;

    if (exportRows.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const generatedAt = new Date();

    const statusLabelText =
      statusOptions.find((item) => item.value === statusFilter)?.label || t.all;

    const commissionLabelText =
      commissionOptions.find((item) => item.value === commissionFilter)?.label ||
      t.all;

    downloadExcel({
      filename: `primey-care-agents-list-${generatedAt
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "قائمة المندوبين" : "Agents List",
      title: t.title,
      locale,
      summaryRows: [
        [t.generatedAt, generatedAt.toLocaleString("en-US")],
        [
          t.reportScope,
          selectedIds.length > 0 ? t.selectedScope : t.currentFilteredData,
        ],
        [
          t.table.agent,
          `${formatNumber(exportRows.length)} / ${formatNumber(agents.length)}`,
        ],
        [t.totalAgents, stats.total],
        [t.activeAgents, stats.active],
        [t.totalOrders, stats.totalOrders],
        [t.totalCommissions, formatMoney(stats.totalCommissions)],
      ],
      filterRows: [
        [t.filterSearch, query || t.all],
        [t.filterStatus, statusLabelText],
        [t.filterCommission, commissionLabelText],
      ],
      headers: [
        t.table.id,
        t.table.agent,
        t.table.code,
        t.table.referral,
        t.table.city,
        t.table.contact,
        t.table.customers,
        t.table.orders,
        t.table.sales,
        t.table.commissionType,
        t.table.pendingCommission,
        t.table.approvedCommission,
        t.table.paidCommission,
        t.table.status,
        t.table.createdAt,
        t.table.updatedAt,
      ],
      rows: exportRows.map((agent) => [
        String(agent.id || "-"),
        agent.fullName || "-",
        agent.agentCode || "-",
        agent.referralCode || "-",
        agent.city || "-",
        agent.phone || agent.email || "-",
        agent.totalCustomers,
        agent.totalOrders,
        formatMoney(agent.totalSales),
        commissionLabel(agent.defaultCommissionType, locale),
        formatMoney(agent.pendingCommission),
        formatMoney(agent.approvedCommission),
        formatMoney(agent.paidCommission),
        statusLabel(agent.status, locale),
        formatDate(agent.createdAt),
        formatDate(agent.updatedAt || agent.createdAt),
      ]),
    });

    toast.success(t.exportSuccess);
  }

  function printList() {
    if (!canPrintAgents) return;

    if (exportRows.length === 0) {
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
        title: t.printTitle,
        rows: exportRows,
        t,
      }),
    );
    printWindow.document.close();

    toast.success(t.printReady);
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
    loadAgents(false);
  }, [authResolving, loadAgents]);

  useEffect(() => {
    setPageIndex(0);
    setSelectedIds([]);
  }, [query, statusFilter, commissionFilter]);

  if (!authResolving && !canViewAgents) {
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
      {/* Header */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t.title}
          </h1>

          <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
            {t.subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link href="/system/agents">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadAgents(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refresh}</span>
          </Button>

          {canExportAgents ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={exportExcel}
              disabled={isLoading || exportRows.length === 0 || Boolean(errorMessage)}
            >
              <Download className="h-4 w-4" />
              <span>{t.exportExcel}</span>
            </Button>
          ) : null}

          {canPrintAgents ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={printList}
              disabled={isLoading || exportRows.length === 0 || Boolean(errorMessage)}
            >
              <Printer className="h-4 w-4" />
              <span>{t.print}</span>
            </Button>
          ) : null}

          {canCreateAgents ? (
            <Link href="/system/agents/create">
              <Button className="h-10 w-full rounded-xl sm:w-auto">
                <PlusCircle className="h-4 w-4" />
                <span>{t.createAgent}</span>
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      {/* Error State */}
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
              onClick={() => loadAgents(true)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!errorMessage ? (
        <>
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {isLoading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <StatCardSkeleton key={index} />
                ))
              : [
                  {
                    title: t.totalAgents,
                    value: stats.total,
                    percent: stats.total > 0 ? 100 : 0,
                    icon: Users,
                  },
                  {
                    title: t.activeAgents,
                    value: stats.active,
                    percent: stats.total
                      ? Math.round((stats.active / stats.total) * 100)
                      : 0,
                    icon: BadgeCheck,
                  },
                  {
                    title: t.totalOrders,
                    value: stats.totalOrders,
                    percent: stats.total ? 100 : 0,
                    icon: ShieldCheck,
                  },
                  {
                    title: t.totalCommissions,
                    value: stats.totalCommissions,
                    percent: stats.total ? 100 : 0,
                    icon: HandCoins,
                    isMoney: true,
                  },
                ].map((item) => {
                  const Icon = item.icon;

                  return (
                    <Card
                      key={item.title}
                      className="rounded-2xl border bg-card shadow-sm"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-2xl font-bold">
                              {item.isMoney ? (
                                <SarAmount value={item.value} />
                              ) : (
                                formatNumber(item.value)
                              )}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {item.title}
                            </p>
                          </div>

                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                            <Icon className="h-5 w-5" />
                          </div>
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            {formatNumber(item.percent)}%
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${item.percent}%` }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
          </div>

          {/* Table */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                {t.tableTitle}
              </CardTitle>
              <CardDescription>{t.tableSubtitle}</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="w-full space-y-4">
                {/* Search Row */}
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

                {/* Filters Row */}
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="grid flex-1 gap-3">
                    <div className="flex flex-wrap gap-2">
                      {statusOptions.map((item) => (
                        <Button
                          key={item.value}
                          variant={
                            statusFilter === item.value ? "default" : "outline"
                          }
                          className="h-10 rounded-xl"
                          onClick={() => setStatusFilter(item.value)}
                        >
                          <span>{item.label}</span>
                          <Badge
                            variant={
                              statusFilter === item.value ? "secondary" : "outline"
                            }
                            className="ms-1 rounded-full"
                          >
                            {formatNumber(item.count)}
                          </Badge>
                        </Button>
                      ))}
                    </div>

                    {canViewCommissions ? (
                      <div className="flex flex-wrap gap-2">
                        {commissionOptions.map((item) => (
                          <Button
                            key={item.value}
                            variant={
                              commissionFilter === item.value
                                ? "default"
                                : "outline"
                            }
                            className="h-10 rounded-xl"
                            onClick={() => setCommissionFilter(item.value)}
                          >
                            {item.label}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {hasSearchOrFilter ? (
                      <Button
                        variant="outline"
                        className="h-10 rounded-xl"
                        onClick={clearFilters}
                      >
                        {t.clearFilters}
                      </Button>
                    ) : null}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-10 rounded-xl">
                          <ColumnsIcon className="h-4 w-4" />
                          <span>{t.columns}</span>
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align={isArabic ? "start" : "end"}>
                        {Object.entries(visibleColumns).map(([key, value]) => {
                          if (key === "commission" && !canViewCommissions) {
                            return null;
                          }

                          if (key === "actions" && !canViewAgentDetails) {
                            return null;
                          }

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
                              {columnLabels[key as keyof VisibleColumns]}
                            </DropdownMenuCheckboxItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={allPageSelected}
                              onCheckedChange={toggleAllPageRows}
                              aria-label="Select all"
                            />
                          </TableHead>

                          {safeVisibleColumns.agent ? (
                            <SortableHead
                              label={t.table.agent}
                              onClick={() => toggleSort("fullName")}
                            />
                          ) : null}

                          {safeVisibleColumns.code ? (
                            <SortableHead
                              label={t.table.code}
                              onClick={() => toggleSort("agentCode")}
                            />
                          ) : null}

                          {safeVisibleColumns.referral ? (
                            <SortableHead
                              label={t.table.referral}
                              onClick={() => toggleSort("referralCode")}
                            />
                          ) : null}

                          {safeVisibleColumns.city ? (
                            <SortableHead
                              label={t.table.city}
                              onClick={() => toggleSort("city")}
                            />
                          ) : null}

                          {safeVisibleColumns.contact ? (
                            <TableHead>{t.table.contact}</TableHead>
                          ) : null}

                          {safeVisibleColumns.customers ? (
                            <TableHead>{t.table.customers}</TableHead>
                          ) : null}

                          {safeVisibleColumns.orders ? (
                            <SortableHead
                              label={t.table.orders}
                              onClick={() => toggleSort("totalOrders")}
                            />
                          ) : null}

                          {safeVisibleColumns.sales ? (
                            <SortableHead
                              label={t.table.sales}
                              onClick={() => toggleSort("totalSales")}
                            />
                          ) : null}

                          {safeVisibleColumns.commission ? (
                            <SortableHead
                              label={t.table.commission}
                              onClick={() => toggleSort("approvedCommission")}
                            />
                          ) : null}

                          {safeVisibleColumns.status ? (
                            <SortableHead
                              label={t.table.status}
                              onClick={() => toggleSort("status")}
                            />
                          ) : null}

                          {safeVisibleColumns.actions ? (
                            <TableHead>{t.table.actions}</TableHead>
                          ) : null}
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {isLoading ? (
                          <TableRowsSkeleton
                            columnsCount={visibleTableColumnsCount}
                          />
                        ) : pageRows.length > 0 ? (
                          pageRows.map((agent) => (
                            <TableRow
                              key={`${agent.id}-${agent.agentCode}`}
                              data-state={
                                selectedIds.includes(agent.id)
                                  ? "selected"
                                  : undefined
                              }
                            >
                              <TableCell>
                                <Checkbox
                                  checked={selectedIds.includes(agent.id)}
                                  onCheckedChange={() => toggleRow(agent.id)}
                                  aria-label="Select row"
                                />
                              </TableCell>

                              {safeVisibleColumns.agent ? (
                                <TableCell>
                                  <div className="flex min-w-[240px] items-center gap-4">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-muted">
                                      <UserRound className="h-5 w-5" />
                                    </div>

                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="truncate font-medium">
                                          {agent.fullName}
                                        </span>

                                        {agent.isFeatured ? (
                                          <Star className="size-4 fill-orange-400 text-orange-400" />
                                        ) : null}
                                      </div>

                                      <div className="text-muted-foreground mt-1 truncate text-xs">
                                        {agent.email || agent.phone || agent.agentCode}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                              ) : null}

                              {safeVisibleColumns.code ? (
                                <TableCell className="font-medium">
                                  {agent.agentCode || `#${agent.id}`}
                                </TableCell>
                              ) : null}

                              {safeVisibleColumns.referral ? (
                                <TableCell>
                                  <Badge
                                    variant="secondary"
                                    className="rounded-full"
                                  >
                                    {agent.referralCode || "-"}
                                  </Badge>
                                </TableCell>
                              ) : null}

                              {safeVisibleColumns.city ? (
                                <TableCell>
                                  <div className="flex min-w-[120px] items-center gap-2">
                                    <MapPin className="text-muted-foreground h-3.5 w-3.5" />
                                    <span>{agent.city || "-"}</span>
                                  </div>
                                </TableCell>
                              ) : null}

                              {safeVisibleColumns.contact ? (
                                <TableCell>
                                  <div className="flex min-w-[130px] items-center gap-2">
                                    <Phone className="text-muted-foreground h-3.5 w-3.5" />
                                    <span>{agent.phone || agent.email || "-"}</span>
                                  </div>
                                </TableCell>
                              ) : null}

                              {safeVisibleColumns.customers ? (
                                <TableCell>
                                  {formatNumber(agent.totalCustomers)}
                                </TableCell>
                              ) : null}

                              {safeVisibleColumns.orders ? (
                                <TableCell>
                                  {formatNumber(agent.totalOrders)}
                                </TableCell>
                              ) : null}

                              {safeVisibleColumns.sales ? (
                                <TableCell>
                                  <SarAmount value={agent.totalSales} />
                                </TableCell>
                              ) : null}

                              {safeVisibleColumns.commission ? (
                                <TableCell>
                                  <div className="space-y-1">
                                    <p className="font-semibold">
                                      <SarAmount value={agent.approvedCommission} />
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {commissionLabel(
                                        agent.defaultCommissionType,
                                        locale,
                                      )}{" "}
                                      {agent.defaultCommissionValue
                                        ? formatNumber(agent.defaultCommissionValue)
                                        : "-"}
                                    </p>
                                  </div>
                                </TableCell>
                              ) : null}

                              {safeVisibleColumns.status ? (
                                <TableCell>
                                  {statusBadge(agent.status, locale)}
                                </TableCell>
                              ) : null}

                              {safeVisibleColumns.actions ? (
                                <TableCell>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        className="h-8 w-8 p-0"
                                      >
                                        <span className="sr-only">
                                          {t.actions}
                                        </span>
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>

                                    <DropdownMenuContent
                                      align={isArabic ? "start" : "end"}
                                    >
                                      <DropdownMenuLabel>
                                        {t.actions}
                                      </DropdownMenuLabel>
                                      <DropdownMenuSeparator />

                                      {isValidAgentId(agent.id) ? (
                                        <DropdownMenuItem asChild>
                                          <Link href={`/system/agents/${agent.id}`}>
                                            <Eye className="h-4 w-4" />
                                            {t.viewDetails}
                                          </Link>
                                        </DropdownMenuItem>
                                      ) : null}

                                      <DropdownMenuItem
                                        onClick={() => {
                                          navigator.clipboard.writeText(
                                            String(agent.agentCode || "-"),
                                          );
                                          toast.success(t.copied);
                                        }}
                                      >
                                        {t.copyCode}
                                      </DropdownMenuItem>

                                      <DropdownMenuItem
                                        onClick={() => {
                                          navigator.clipboard.writeText(
                                            String(agent.id || "-"),
                                          );
                                          toast.success(t.copied);
                                        }}
                                      >
                                        {t.copyId}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              ) : null}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={visibleTableColumnsCount}
                              className="h-36 text-center"
                            >
                              <div className="mx-auto max-w-md space-y-2">
                                <p className="font-semibold">
                                  {hasSearchOrFilter
                                    ? t.noResultsTitle
                                    : t.emptyTitle}
                                </p>
                                <p className="text-muted-foreground text-sm">
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

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <div className="text-muted-foreground flex-1 text-sm">
                    {formatNumber(selectedIds.length)} /{" "}
                    {formatNumber(sortedAgents.length)} {t.selectedRows}
                  </div>

                  <div className="text-muted-foreground text-sm">
                    {t.page} {formatNumber(pageIndex + 1)} {t.from}{" "}
                    {formatNumber(pageCount)}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() =>
                        setPageIndex((current) => Math.max(current - 1, 0))
                      }
                      disabled={pageIndex === 0}
                    >
                      {t.previous}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() =>
                        setPageIndex((current) =>
                          Math.min(current + 1, pageCount - 1),
                        )
                      }
                      disabled={pageIndex >= pageCount - 1}
                    >
                      {t.next}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

/* ============================================================
   Small Components
============================================================ */

function SortableHead({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <TableHead>
      <Button className="-ms-3" variant="ghost" onClick={onClick}>
        {label}
        <ArrowDownUp className="h-3 w-3" />
      </Button>
    </TableHead>
  );
}