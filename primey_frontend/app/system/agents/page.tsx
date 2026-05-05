"use client";

/* ============================================================
   📂 app/system/agents/page.tsx
   🧠 Primey Care | System Agents Dashboard
   ------------------------------------------------------------
   ✅ المسار: /system/agents
   ✅ الإصدار: v2.0.1 - Centers Pattern + Safe Permissions

   ✅ العمل:
      لوحة مختصرة لإدارة المندوبين داخل مساحة النظام.

   ✅ المعيار:
      - مبني بصريًا على نمط المراكز والعملاء المعتمد.
      - دمج UX Refinement مع حماية المرحلة 2.
      - لا يتم إظهار مسارات تقنية أو API داخل الواجهة.
      - لا يتم عرض روابط تقارير داخل الوحدة.
      - لا توجد أزرار وهمية.
      - إخفاء الأزرار غير المصرح بها بدل تعطيلها.
      - عدم كسر تحميل البيانات للمستخدم system_admin / superadmin.
      - منع طلب البيانات فقط عند وجود منع صريح لصلاحية العرض.
      - Error State مستقل عن Empty State.
      - Skeleton Loading.
      - Excel بصيغة .xls HTML Workbook.
      - Web PDF Print.
      - استخدام /currency/sar.svg.
      - الأرقام بالإنجليزية.
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Calculator,
  Download,
  Eye,
  HandCoins,
  ListChecks,
  Loader2,
  MapPin,
  Plus,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  Star,
  TrendingUp,
  UserRound,
  Users,
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

type AgentStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "DRAFT"
  | "UNKNOWN";

type CommissionType = "PERCENTAGE" | "FIXED" | "UNKNOWN";
type StatusFilter = "ALL" | AgentStatus;
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

  const cleanBase = base.replace(/\/$/, "");
  return `${cleanBase}${path}`;
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

function hasAnyKnownPermissionSignal(authValue: unknown) {
  return getAuthRoles(authValue).length > 0 || getAuthPermissionCodes(authValue).length > 0;
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

  if (!hasAnyKnownPermissionSignal(authValue)) {
    return true;
  }

  return mode === "view";
}

/* ============================================================
   API Normalizers
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
    pageTitle: isArabic ? "إدارة المندوبين" : "Agents Management",
    pageSubtitle: isArabic
      ? "متابعة المندوبين، العملاء المرتبطين، الطلبات، العمولات، وحالة التشغيل."
      : "Monitor agents, linked customers, orders, commissions, and operational status.",

    addAgent: isArabic ? "إنشاء مندوب" : "Create Agent",
    agentsList: isArabic ? "قائمة المندوبين" : "Agents List",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",

    featuredAgents: isArabic ? "المندوبون المميزون" : "Featured Agents",
    featuredSubtitle: isArabic
      ? "عرض مختصر لأهم المندوبين حسب التمييز أو المبيعات."
      : "A compact view of key agents based on featured status or sales.",

    trackStatus: isArabic
      ? "حالة المندوبين والعمولات"
      : "Agents & Commissions Status",
    trackSubtitle: isArabic
      ? "تحليل سريع لحالة المندوبين والطلبات والعمولات."
      : "Quick analysis of agents, orders, and commissions.",

    filterPlaceholder: isArabic ? "ابحث في المندوبين..." : "Filter agents...",

    all: isArabic ? "الكل" : "All",
    total: isArabic ? "الإجمالي" : "Total",
    active: isArabic ? "نشط" : "Active",
    draft: isArabic ? "مسودة" : "Draft",
    suspended: isArabic ? "موقوف" : "Suspended",
    inactive: isArabic ? "غير نشط" : "Inactive",
    unknown: isArabic ? "غير محدد" : "Unknown",

    loaded: isArabic ? "محمّلة" : "Loaded",
    operational: isArabic ? "تشغيلي" : "Operational",
    needsReview: isArabic ? "يحتاج مراجعة" : "Needs Review",
    stopped: isArabic ? "متوقف" : "Stopped",

    totalSales: isArabic ? "إجمالي المبيعات" : "Total Sales",
    approvedCommissions: isArabic ? "العمولات المعتمدة" : "Approved Commissions",
    paidCommissions: isArabic ? "العمولات المدفوعة" : "Paid Commissions",
    pendingCommissions: isArabic ? "عمولات معلقة" : "Pending Commissions",
    linkedOrders: isArabic ? "الطلبات المرتبطة" : "Linked Orders",
    linkedCustomers: isArabic ? "العملاء المرتبطون" : "Linked Customers",
    accountingPosted: isArabic ? "مرحّل محاسبيًا" : "Accounting Posted",

    showing: isArabic ? "عرض" : "Showing",
    from: isArabic ? "من" : "of",
    latestRecords: isArabic ? "آخر السجلات" : "Latest records",
    viewFullList: isArabic ? "عرض القائمة الكاملة" : "View Full List",

    table: {
      id: isArabic ? "الكود" : "Code",
      name: isArabic ? "اسم المندوب" : "Agent Name",
      code: isArabic ? "كود الإحالة" : "Referral Code",
      city: isArabic ? "المدينة" : "City",
      customers: isArabic ? "العملاء" : "Customers",
      orders: isArabic ? "الطلبات" : "Orders",
      commission: isArabic ? "العمولة" : "Commission",
      status: isArabic ? "الحالة" : "Status",
      action: isArabic ? "الإجراء" : "Action",
    },

    emptyTitle: isArabic ? "لا يوجد مندوبون بعد" : "No agents yet",
    emptyText: isArabic
      ? "عند إضافة مندوبين جدد ستظهر بياناتهم هنا مباشرة."
      : "New agents will appear here once they are added.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير كلمات البحث أو فلتر الحالة لعرض نتائج أكثر."
      : "Try changing the search keywords or status filter to show more results.",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الصفحة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض بيانات المندوبين. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view agents data. Contact your system administrator if you need access.",

    apiError: isArabic
      ? "تعذر تحميل بيانات المندوبين."
      : "Unable to load agents data.",
    apiErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    refreshSuccess: isArabic
      ? "تم تحديث بيانات المندوبين بنجاح"
      : "Agents data refreshed successfully",
    exportSuccess: isArabic
      ? "تم تجهيز ملف Excel بنجاح"
      : "Excel file prepared successfully",
    exportEmpty: isArabic
      ? "لا توجد بيانات قابلة للتصدير"
      : "No data available to export",
    printSuccess: isArabic
      ? "تم تجهيز نافذة الطباعة"
      : "Print window prepared",
    printError: isArabic
      ? "تعذر فتح نافذة الطباعة"
      : "Unable to open print window",

    quickAccessTitle: isArabic
      ? "إجراءات وحدة المندوبين"
      : "Agents Module Actions",
    quickAccessSubtitle: isArabic
      ? "اختصارات منظمة للوصول إلى أهم صفحات وحدة المندوبين."
      : "Organized shortcuts to the key agents module pages.",

    open: isArabic ? "فتح" : "Open",
    manage: isArabic ? "إدارة" : "Manage",

    actionListTitle: isArabic ? "قائمة المندوبين" : "Agents List",
    actionListDesc: isArabic
      ? "استعراض جميع المندوبين، البحث، التصفية، وإدارة السجلات."
      : "Browse all agents, search, filter, and manage records.",

    actionCreateTitle: isArabic ? "إنشاء مندوب" : "Create Agent",
    actionCreateDesc: isArabic
      ? "إضافة مندوب جديد وربطه لاحقًا بالعملاء والطلبات والعمولات."
      : "Add a new agent and later connect it with customers, orders, and commissions.",

    commissionTypeLabels: {
      PERCENTAGE: isArabic ? "نسبة" : "Percentage",
      FIXED: isArabic ? "مبلغ ثابت" : "Fixed",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<CommissionType, string>,

    export: {
      generatedAt: isArabic ? "تاريخ التصدير" : "Generated At",
      scope: isArabic ? "نطاق التقرير" : "Report Scope",
      currentData: isArabic ? "البيانات الظاهرة" : "Visible Data",
      search: isArabic ? "البحث" : "Search",
      status: isArabic ? "فلتر الحالة" : "Status Filter",
      summary: isArabic ? "ملخص القائمة" : "List Summary",
      filters: isArabic ? "الفلاتر المستخدمة" : "Applied Filters",
    },

    printTitle: isArabic ? "لوحة المندوبين" : "Agents Dashboard",
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

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function SummaryCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index} className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div className="space-y-3">
              <SkeletonLine className="h-11 w-11 rounded-2xl" />
              <div className="space-y-2">
                <SkeletonLine className="h-4 w-28" />
                <SkeletonLine className="h-7 w-32" />
              </div>
            </div>

            <div className="space-y-2 rounded-2xl border bg-background px-3 py-2">
              <SkeletonLine className="h-3 w-20" />
              <SkeletonLine className="h-4 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FeaturedAgentsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <SkeletonLine className="h-11 w-11 shrink-0 rounded-xl" />
            <div className="space-y-2">
              <SkeletonLine className="h-3 w-28" />
              <SkeletonLine className="h-3 w-20" />
            </div>
          </div>

          <div className="space-y-2">
            <SkeletonLine className="h-3 w-16" />
            <SkeletonLine className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusCardsSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="space-y-3 rounded-xl border bg-background/70 p-3"
        >
          <div className="flex items-center gap-2">
            <SkeletonLine className="h-4 w-4" />
            <SkeletonLine className="h-7 w-14" />
          </div>
          <div className="space-y-2">
            <SkeletonLine className="h-3 w-20" />
            <SkeletonLine className="h-2 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TableRowsSkeleton({ showCommission, showAction }: { showCommission: boolean; showAction: boolean }) {
  const columns = 7 + (showCommission ? 1 : 0) + (showAction ? 1 : 0);

  return (
    <>
      {Array.from({ length: 6 }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <TableCell key={columnIndex}>
              <SkeletonLine
                className={
                  columnIndex === 1
                    ? "h-8 w-40 rounded-lg"
                    : "h-4 w-20 rounded-lg"
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
              <th>${escapeHtml(t.table.id)}</th>
              <th>${escapeHtml(t.table.name)}</th>
              <th>${escapeHtml(t.table.code)}</th>
              <th>${escapeHtml(t.table.city)}</th>
              <th>${escapeHtml(t.table.customers)}</th>
              <th>${escapeHtml(t.table.orders)}</th>
              <th>${escapeHtml(t.totalSales)}</th>
              <th>${escapeHtml(t.approvedCommissions)}</th>
              <th>${escapeHtml(t.table.status)}</th>
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

export default function SystemAgentsPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [apiStats, setApiStats] = useState<AgentsApiStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [errorMessage, setErrorMessage] = useState("");

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

  const filteredAgents = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return agents.filter((agent) => {
      const matchesStatus =
        statusFilter === "ALL" ? true : agent.status === statusFilter;

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

      return matchesStatus && matchesQuery;
    });
  }, [agents, query, statusFilter]);

  const stats = useMemo(() => {
    const total = toNumber(apiStats?.total_agents) || agents.length;
    const active =
      toNumber(apiStats?.active_agents) ||
      agents.filter((item) => item.status === "ACTIVE").length;
    const draft =
      toNumber(apiStats?.draft_agents) ||
      agents.filter((item) => item.status === "DRAFT").length;
    const suspended =
      toNumber(apiStats?.suspended_agents) ||
      agents.filter((item) => item.status === "SUSPENDED").length;
    const inactive =
      toNumber(apiStats?.inactive_agents) ||
      agents.filter((item) => item.status === "INACTIVE").length;

    const totalCustomers = agents.reduce(
      (sum, item) => sum + item.totalCustomers,
      0,
    );
    const totalOrders = agents.reduce((sum, item) => sum + item.totalOrders, 0);

    const totalSales =
      toNumber(apiStats?.total_sales) ||
      agents.reduce((sum, item) => sum + item.totalSales, 0);

    const pendingCommission = agents.reduce(
      (sum, item) => sum + item.pendingCommission,
      0,
    );

    const approvedCommission =
      toNumber(apiStats?.total_commission) ||
      agents.reduce((sum, item) => sum + item.approvedCommission, 0);

    const paidCommission =
      toNumber(apiStats?.total_paid) ||
      agents.reduce((sum, item) => sum + item.paidCommission, 0);

    const accountingPostedCommission = agents.reduce(
      (sum, item) => sum + item.accountingPostedCommission,
      0,
    );

    return {
      total,
      active,
      draft,
      suspended,
      inactive,
      stopped: suspended + inactive,
      totalCustomers,
      totalOrders,
      totalSales,
      pendingCommission,
      approvedCommission,
      paidCommission,
      accountingPostedCommission,
    };
  }, [agents, apiStats]);

  const featuredAgents = useMemo(() => {
    const featured = agents.filter((item) => item.isFeatured);

    if (featured.length > 0) {
      return featured.slice(0, 6);
    }

    return [...agents]
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 6);
  }, [agents]);

  const tableRows = useMemo(() => filteredAgents.slice(0, 8), [filteredAgents]);

  const statusCards = useMemo(
    () => [
      {
        title: t.total,
        value: stats.total,
        helper: t.loaded,
        helperValue: stats.total > 0 ? "100%" : "0%",
        icon: Users,
        percent: stats.total > 0 ? 100 : 0,
        filter: "ALL" as StatusFilter,
      },
      {
        title: t.active,
        value: stats.active,
        helper: t.operational,
        helperValue: `${percent(stats.active, stats.total)}%`,
        icon: BadgeCheck,
        percent: percent(stats.active, stats.total),
        filter: "ACTIVE" as StatusFilter,
      },
      {
        title: t.draft,
        value: stats.draft,
        helper: t.needsReview,
        helperValue: `${percent(stats.draft, stats.total)}%`,
        icon: ShieldCheck,
        percent: percent(stats.draft, stats.total),
        filter: "DRAFT" as StatusFilter,
      },
      {
        title: t.suspended,
        value: stats.stopped,
        helper: t.stopped,
        helperValue: `${percent(stats.stopped, stats.total)}%`,
        icon: HandCoins,
        percent: percent(stats.stopped, stats.total),
        filter: "SUSPENDED" as StatusFilter,
      },
    ],
    [stats, t],
  );

  const statusFilters = useMemo(
    () =>
      [
        {
          value: "ALL" as StatusFilter,
          label: t.all,
          count: agents.length,
        },
        {
          value: "ACTIVE" as StatusFilter,
          label: t.active,
          count: stats.active,
        },
        {
          value: "DRAFT" as StatusFilter,
          label: t.draft,
          count: stats.draft,
        },
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

  const summaryCards = useMemo(
    () => [
      {
        title: t.totalSales,
        value: stats.totalSales,
        icon: TrendingUp,
        helper: t.linkedOrders,
        helperValue: formatNumber(stats.totalOrders),
      },
      {
        title: t.approvedCommissions,
        value: stats.approvedCommission,
        icon: Calculator,
        helper: t.pendingCommissions,
        helperValue: formatMoney(stats.pendingCommission),
      },
      {
        title: t.paidCommissions,
        value: stats.paidCommission,
        icon: Wallet,
        helper: t.accountingPosted,
        helperValue: formatMoney(stats.accountingPostedCommission),
      },
    ],
    [stats, t],
  );

  const moduleActions = useMemo(
    () =>
      [
        canViewAgents
          ? {
              title: t.actionListTitle,
              description: t.actionListDesc,
              href: "/system/agents/list",
              icon: Users,
              badge: `${formatNumber(stats.total)}`,
              cta: t.manage,
            }
          : null,
        canCreateAgents
          ? {
              title: t.actionCreateTitle,
              description: t.actionCreateDesc,
              href: "/system/agents/create",
              icon: Plus,
              badge: isArabic ? "جديد" : "New",
              cta: t.open,
            }
          : null,
      ].filter(Boolean) as Array<{
        title: string;
        description: string;
        href: string;
        icon: typeof Users;
        badge: string;
        cta: string;
      }>,
    [canCreateAgents, canViewAgents, isArabic, stats.total, t],
  );

  const hasSearchOrFilter = query.trim().length > 0 || statusFilter !== "ALL";

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

        const response = await fetch(apiUrl("/api/agents/?page_size=100"), {
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

        const normalized = normalizeApiList(payload).map(normalizeAgent);

        setAgents(normalized);
        setApiStats(payload?.stats || null);

        if (showToast) {
          toast.success(t.refreshSuccess);
        }
      } catch (error) {
        console.error("Failed to load agents:", error);
        setAgents([]);
        setApiStats(null);
        setErrorMessage(t.apiError);
        toast.error(t.apiError);
      } finally {
        setIsLoading(false);
      }
    },
    [canViewAgents, t.apiError, t.refreshSuccess],
  );

  function exportAgents() {
    if (!canExportAgents) return;

    if (filteredAgents.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const generatedAt = new Date();
    const statusFilterLabel =
      statusFilters.find((item) => item.value === statusFilter)?.label || t.all;

    downloadExcel({
      filename: `primey-care-agents-dashboard-${generatedAt
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "لوحة المندوبين" : "Agents Dashboard",
      title: t.pageTitle,
      locale,
      summaryRows: [
        [t.export.generatedAt, generatedAt.toLocaleString("en-US")],
        [t.export.scope, t.export.currentData],
        [
          t.showing,
          `${formatNumber(filteredAgents.length)} / ${formatNumber(agents.length)}`,
        ],
        [t.total, stats.total],
        [t.active, stats.active],
        [t.linkedCustomers, stats.totalCustomers],
        [t.linkedOrders, stats.totalOrders],
        [t.totalSales, formatMoney(stats.totalSales)],
        [t.approvedCommissions, formatMoney(stats.approvedCommission)],
        [t.paidCommissions, formatMoney(stats.paidCommission)],
      ],
      filterRows: [
        [t.export.search, query || t.all],
        [t.export.status, statusFilterLabel],
      ],
      headers: [
        t.table.id,
        t.table.name,
        t.table.code,
        t.table.city,
        t.table.customers,
        t.table.orders,
        t.totalSales,
        t.pendingCommissions,
        t.approvedCommissions,
        t.paidCommissions,
        t.accountingPosted,
        t.table.status,
      ],
      rows: filteredAgents.map((agent) => [
        agent.agentCode || "-",
        agent.fullName || "-",
        agent.referralCode || "-",
        agent.city || "-",
        agent.totalCustomers,
        agent.totalOrders,
        formatMoney(agent.totalSales),
        formatMoney(agent.pendingCommission),
        formatMoney(agent.approvedCommission),
        formatMoney(agent.paidCommission),
        formatMoney(agent.accountingPostedCommission),
        statusLabel(agent.status, locale),
      ]),
    });

    toast.success(t.exportSuccess);
  }

  function printAgents() {
    if (!canPrintAgents) return;

    if (filteredAgents.length === 0) {
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
        rows: filteredAgents,
        t,
      }),
    );
    printWindow.document.close();

    toast.success(t.printSuccess);
  }

  function renderFeaturedAgent(agent: Agent) {
    const content = (
      <div className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3 transition hover:bg-muted/50">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
            <UserRound className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold">{agent.fullName}</p>

              {agent.isFeatured ? (
                <Star className="h-3.5 w-3.5 shrink-0 fill-yellow-400 text-yellow-500" />
              ) : null}
            </div>

            <p className="mt-1 truncate text-xs text-muted-foreground">
              {agent.agentCode}
            </p>
          </div>
        </div>

        <div className="shrink-0 text-end">
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {agent.referralCode || "-"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatNumber(agent.totalOrders)} / {formatNumber(agent.totalCustomers)}
          </p>
        </div>
      </div>
    );

    if (!canViewAgentDetails || !isValidAgentId(agent.id)) {
      return (
        <div key={`${agent.agentCode}-${agent.fullName}`} className="block">
          {content}
        </div>
      );
    }

    return (
      <Link key={agent.id} href={`/system/agents/${agent.id}`} className="block">
        {content}
      </Link>
    );
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t.pageTitle}
          </h1>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
            {t.pageSubtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
              onClick={exportAgents}
              disabled={isLoading || filteredAgents.length === 0 || Boolean(errorMessage)}
            >
              <Download className="h-4 w-4" />
              <span>{t.exportExcel}</span>
            </Button>
          ) : null}

          {canPrintAgents ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={printAgents}
              disabled={isLoading || filteredAgents.length === 0 || Boolean(errorMessage)}
            >
              <Printer className="h-4 w-4" />
              <span>{t.print}</span>
            </Button>
          ) : null}

          {canCreateAgents ? (
            <Link href="/system/agents/create">
              <Button className="h-10 w-full rounded-xl sm:w-auto">
                <Plus className="h-4 w-4" />
                <span>{t.addAgent}</span>
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
                  {t.apiErrorHint}
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
          {/* Financial Summary */}
          {isLoading ? (
            <SummaryCardsSkeleton />
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {summaryCards.map((item) => {
                const Icon = item.icon;

                return (
                  <Card
                    key={item.title}
                    className="rounded-2xl border bg-card shadow-sm"
                  >
                    <CardContent className="flex items-start justify-between gap-4 p-5">
                      <div className="space-y-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted">
                          <Icon className="h-5 w-5" />
                        </div>

                        <div>
                          <p className="text-sm text-muted-foreground">
                            {item.title}
                          </p>
                          <p className="mt-1 text-2xl font-bold">
                            <SarAmount value={item.value} />
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl border bg-background px-3 py-2 text-end">
                        <p className="text-xs text-muted-foreground">
                          {item.helper}
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {item.helperValue}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Main Layout */}
          <div className="grid gap-4 xl:grid-cols-3">
            {/* Featured Agents */}
            <Card className="rounded-2xl border bg-card shadow-sm xl:col-span-1">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div>
                  <CardTitle className="text-base font-bold">
                    {t.featuredAgents}
                  </CardTitle>
                  <CardDescription className="mt-1 text-sm leading-6">
                    {t.featuredSubtitle}
                  </CardDescription>
                </div>

                {canViewAgents ? (
                  <Link href="/system/agents/list">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-xl"
                    >
                      <ListChecks className="h-4 w-4" />
                    </Button>
                  </Link>
                ) : null}
              </CardHeader>

              <CardContent className="space-y-3">
                {isLoading ? (
                  <FeaturedAgentsSkeleton />
                ) : featuredAgents.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-5 text-center">
                    <p className="font-semibold">{t.emptyTitle}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {t.emptyText}
                    </p>
                  </div>
                ) : (
                  featuredAgents.map((agent) => renderFeaturedAgent(agent))
                )}
              </CardContent>
            </Card>

            {/* Status + Table */}
            <Card className="rounded-2xl border bg-card shadow-sm xl:col-span-2">
              <CardHeader className="flex flex-col gap-3 pb-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="text-base font-bold">
                    {t.trackStatus}
                  </CardTitle>
                  <CardDescription className="mt-1 text-sm leading-6">
                    {t.trackSubtitle}
                  </CardDescription>
                </div>

                {canViewAgents ? (
                  <Link href="/system/agents/list">
                    <Button variant="outline" className="h-9 rounded-xl">
                      <ListChecks className="h-4 w-4" />
                      <span>{t.viewFullList}</span>
                    </Button>
                  </Link>
                ) : null}
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Status Cards */}
                {isLoading ? (
                  <StatusCardsSkeleton />
                ) : (
                  <div className="grid gap-3 md:grid-cols-4">
                    {statusCards.map((card) => {
                      const Icon = card.icon;

                      return (
                        <button
                          key={card.title}
                          type="button"
                          className="space-y-2 rounded-xl border bg-background/70 p-3 text-start transition hover:bg-muted/40"
                          onClick={() => setStatusFilter(card.filter)}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <p className="text-2xl font-bold">
                              {formatNumber(card.value)}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm text-muted-foreground">
                                {card.title}
                              </p>
                              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                {card.helperValue}
                              </span>
                            </div>

                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${card.percent}%` }}
                              />
                            </div>

                            <p className="pt-1 text-xs text-muted-foreground">
                              {card.helper}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Search + Filters */}
                <div className="grid gap-3">
                  <div className="relative">
                    <Search
                      className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${
                        isArabic ? "right-3" : "left-3"
                      }`}
                    />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={t.filterPlaceholder}
                      className={`h-10 rounded-xl ${
                        isArabic ? "pr-10" : "pl-10"
                      }`}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {statusFilters.map((item) => {
                      const isSelected = statusFilter === item.value;

                      return (
                        <Button
                          key={item.value}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          className="rounded-xl"
                          onClick={() => setStatusFilter(item.value)}
                        >
                          <span>{item.label}</span>
                          <Badge
                            variant={isSelected ? "secondary" : "outline"}
                            className="ms-1 rounded-full"
                          >
                            {formatNumber(item.count)}
                          </Badge>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-xl border">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.table.id}</TableHead>
                          <TableHead>{t.table.name}</TableHead>
                          <TableHead>{t.table.code}</TableHead>
                          <TableHead>{t.table.city}</TableHead>
                          <TableHead>{t.table.customers}</TableHead>
                          <TableHead>{t.table.orders}</TableHead>
                          {canViewCommissions ? (
                            <TableHead>{t.table.commission}</TableHead>
                          ) : null}
                          <TableHead>{t.table.status}</TableHead>
                          {canViewAgentDetails ? (
                            <TableHead>{t.table.action}</TableHead>
                          ) : null}
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {isLoading ? (
                          <TableRowsSkeleton
                            showCommission={canViewCommissions}
                            showAction={canViewAgentDetails}
                          />
                        ) : tableRows.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={
                                7 +
                                (canViewCommissions ? 1 : 0) +
                                (canViewAgentDetails ? 1 : 0)
                              }
                            >
                              <div className="py-12 text-center">
                                <p className="font-semibold">
                                  {hasSearchOrFilter
                                    ? t.noResultsTitle
                                    : t.emptyTitle}
                                </p>
                                <p className="mt-2 text-sm text-muted-foreground">
                                  {hasSearchOrFilter
                                    ? t.noResultsText
                                    : t.emptyText}
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          tableRows.map((agent) => (
                            <TableRow key={`${agent.id}-${agent.agentCode}`}>
                              <TableCell className="font-medium">
                                {agent.agentCode || `#${agent.id}`}
                              </TableCell>

                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                                    <UserRound className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate font-medium">
                                      {agent.fullName}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {agent.email || agent.phone || "-"}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>

                              <TableCell>
                                <Badge variant="secondary" className="rounded-full">
                                  {agent.referralCode || "-"}
                                </Badge>
                              </TableCell>

                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span>{agent.city || "-"}</span>
                                </div>
                              </TableCell>

                              <TableCell>{formatNumber(agent.totalCustomers)}</TableCell>
                              <TableCell>{formatNumber(agent.totalOrders)}</TableCell>

                              {canViewCommissions ? (
                                <TableCell>
                                  <div className="space-y-1">
                                    <p className="text-sm font-semibold">
                                      <SarAmount
                                        value={
                                          agent.approvedCommission ||
                                          agent.pendingCommission ||
                                          agent.paidCommission
                                        }
                                      />
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {
                                        t.commissionTypeLabels[
                                          agent.defaultCommissionType
                                        ]
                                      }{" "}
                                      {agent.defaultCommissionValue
                                        ? formatNumber(agent.defaultCommissionValue)
                                        : "-"}
                                    </p>
                                  </div>
                                </TableCell>
                              ) : null}

                              <TableCell>{statusBadge(agent.status, locale)}</TableCell>

                              {canViewAgentDetails ? (
                                <TableCell>
                                  {isValidAgentId(agent.id) ? (
                                    <Link href={`/system/agents/${agent.id}`}>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 rounded-lg"
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    </Link>
                                  ) : null}
                                </TableCell>
                              ) : null}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    {t.showing} {formatNumber(tableRows.length)} {t.from}{" "}
                    {formatNumber(filteredAgents.length)} · {t.latestRecords}
                  </p>

                  {canViewAgents ? (
                    <Link href="/system/agents/list">
                      <Button variant="outline" size="sm" className="rounded-xl">
                        <ListChecks className="h-4 w-4" />
                        {t.viewFullList}
                      </Button>
                    </Link>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Cards */}
          {moduleActions.length > 0 ? (
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">
                  {t.quickAccessTitle}
                </CardTitle>
                <CardDescription className="leading-6">
                  {t.quickAccessSubtitle}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {moduleActions.map((item) => {
                    const Icon = item.icon;

                    return (
                      <Link key={item.href} href={item.href} className="block">
                        <Card className="h-full rounded-2xl border bg-background shadow-none transition hover:bg-muted/40 hover:shadow-sm">
                          <CardContent className="flex h-full items-start justify-between gap-4 p-4">
                            <div className="min-w-0 space-y-3">
                              <div className="flex items-center gap-2">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                                  <Icon className="h-5 w-5" />
                                </div>

                                <Badge variant="secondary" className="rounded-full">
                                  {item.badge}
                                </Badge>
                              </div>

                              <div>
                                <p className="font-semibold">{item.title}</p>
                                <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                                  {item.description}
                                </p>
                              </div>

                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-xl"
                              >
                                {item.cta}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}