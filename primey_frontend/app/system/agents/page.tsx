"use client";

/* ============================================================
   📂 app/system/agents/page.tsx
   🧠 Primey Care | Agents Overview

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
  ArrowUpRight,
  BadgeCheck,
  Download,
  Eye,
  FileText,
  HandCoins,
  Loader2,
  MapPin,
  Phone,
  PlusCircle,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  Star,
  TrendingUp,
  UserCheck,
  Users,
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

type AgentStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DRAFT" | "UNKNOWN";
type CommissionType = "PERCENTAGE" | "FIXED" | "UNKNOWN";

type AgentRow = {
  id: string;
  agent_code: string;
  referral_code: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  status: AgentStatus;
  commission_type: CommissionType;
  commission_value: number;
  total_customers: number;
  total_orders: number;
  total_sales: number;
  pending_commission: number;
  approved_commission: number;
  paid_commission: number;
  accounting_posted_commission: number;
  bank_name: string;
  iban: string;
  is_featured: boolean;
  created_at: string;
};

type AgentsSummary = {
  total_agents: number;
  active_agents: number;
  inactive_agents: number;
  suspended_agents: number;
  draft_agents: number;
  featured_agents: number;
  total_customers: number;
  total_orders: number;
  total_sales: number;
  pending_commission: number;
  approved_commission: number;
  paid_commission: number;
  accounting_posted_commission: number;
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
  agents?: unknown[];
  summary?: Partial<AgentsSummary>;
  stats?: Partial<AgentsSummary>;
};

const SAR_ICON_PATH = "/currency/sar.svg";

const DEFAULT_SUMMARY: AgentsSummary = {
  total_agents: 0,
  active_agents: 0,
  inactive_agents: 0,
  suspended_agents: 0,
  draft_agents: 0,
  featured_agents: 0,
  total_customers: 0,
  total_orders: 0,
  total_sales: 0,
  pending_commission: 0,
  approved_commission: 0,
  paid_commission: 0,
  accounting_posted_commission: 0,
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
      ["system_admin", "superuser", "super_admin", "support"].includes(role),
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
    title: isArabic ? "المندوبون" : "Agents",
    subtitle: isArabic
      ? "لوحة متابعة المندوبين والمبيعات والعملاء والعمولات المرتبطة بهم."
      : "Overview for agents, sales, customers, and related commissions.",

    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    agentsList: isArabic ? "قائمة المندوبين" : "Agents List",
    createAgent: isArabic ? "إنشاء مندوب" : "Create Agent",

    totalAgents: isArabic ? "إجمالي المندوبين" : "Total Agents",
    activeAgents: isArabic ? "مندوبون نشطون" : "Active Agents",
    totalCustomers: isArabic ? "عملاء المندوبين" : "Agent Customers",
    totalOrders: isArabic ? "طلبات المندوبين" : "Agent Orders",
    totalSales: isArabic ? "إجمالي المبيعات" : "Total Sales",
    pendingCommission: isArabic ? "عمولات معلقة" : "Pending Commission",
    approvedCommission: isArabic ? "عمولات معتمدة" : "Approved Commission",
    paidCommission: isArabic ? "عمولات مدفوعة" : "Paid Commission",
    accountingPostedCommission: isArabic ? "مرحلة محاسبيًا" : "Accounting Posted",
    featuredAgents: isArabic ? "مندوبون مميزون" : "Featured Agents",
    suspendedAgents: isArabic ? "مندوبون موقوفون" : "Suspended Agents",

    shortcutsTitle: isArabic ? "اختصارات المندوبين" : "Agent Shortcuts",
    shortcutsDesc: isArabic
      ? "الوصول السريع لقائمة المندوبين أو إنشاء مندوب بعد تنظيف السايدر."
      : "Quick access to agent list and create page after sidebar cleanup.",

    latestTitle: isArabic ? "أحدث المندوبين" : "Latest Agents",
    latestDesc: isArabic
      ? "أحدث المندوبين مع الحالة والمبيعات والعمولات."
      : "Latest agents with status, sales, and commissions.",

    searchPlaceholder: isArabic
      ? "ابحث باسم المندوب أو الكود أو الجوال أو المدينة..."
      : "Search by agent name, code, phone, or city...",

    table: {
      agent: isArabic ? "المندوب" : "Agent",
      code: isArabic ? "الكود" : "Code",
      city: isArabic ? "المدينة" : "City",
      contact: isArabic ? "التواصل" : "Contact",
      status: isArabic ? "الحالة" : "Status",
      customers: isArabic ? "العملاء" : "Customers",
      orders: isArabic ? "الطلبات" : "Orders",
      sales: isArabic ? "المبيعات" : "Sales",
      commission: isArabic ? "العمولة" : "Commission",
      paid: isArabic ? "المدفوع" : "Paid",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      action: isArabic ? "الإجراء" : "Action",
    },

    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
    suspended: isArabic ? "موقوف" : "Suspended",
    draft: isArabic ? "مسودة" : "Draft",
    unknown: isArabic ? "غير محدد" : "Unknown",

    percentage: isArabic ? "نسبة" : "Percentage",
    fixed: isArabic ? "مبلغ ثابت" : "Fixed",
    featured: isArabic ? "مميز" : "Featured",
    view: isArabic ? "عرض" : "View",

    emptyTitle: isArabic ? "لا توجد بيانات مندوبين" : "No agent data",
    emptyText: isArabic
      ? "ستظهر بيانات المندوبين هنا بعد إنشاء أول مندوب."
      : "Agent data will appear here after creating the first agent.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير كلمات البحث."
      : "Try changing your search terms.",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض المندوبين" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض المندوبين. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view agents. Contact your system administrator if you need access.",

    loadError: isArabic
      ? "تعذر تحميل بيانات المندوبين."
      : "Unable to load agents.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    loadSuccess: isArabic
      ? "تم تحديث بيانات المندوبين."
      : "Agents refreshed.",

    exportSuccess: isArabic ? "تم تجهيز ملف Excel." : "Excel file prepared.",
    exportEmpty: isArabic
      ? "لا توجد بيانات قابلة للتصدير."
      : "No data available to export.",
    printSuccess: isArabic ? "تم تجهيز نافذة الطباعة." : "Print window prepared.",
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

  for (const container of ["agent", "user", "profile", "data", "stats"]) {
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
    ...asDict(payload.stats),
    ...asDict(data.summary),
    ...asDict(data.stats),
    ...asDict(data.totals),
    ...asDict(data),
  } as Partial<AgentsSummary>;
}

function normalizeStatus(value: unknown): AgentStatus {
  const clean = String(value || "").toUpperCase();

  if (["ACTIVE", "ENABLED", "APPROVED"].includes(clean)) return "ACTIVE";
  if (["INACTIVE", "DISABLED"].includes(clean)) return "INACTIVE";
  if (["SUSPENDED", "BLOCKED", "BANNED"].includes(clean)) return "SUSPENDED";
  if (["DRAFT", "PENDING", "NEW"].includes(clean)) return "DRAFT";

  return "UNKNOWN";
}

function normalizeCommissionType(value: unknown): CommissionType {
  const clean = String(value || "").toUpperCase();

  if (["PERCENTAGE", "PERCENT", "RATE"].includes(clean)) return "PERCENTAGE";
  if (["FIXED", "AMOUNT"].includes(clean)) return "FIXED";

  return "UNKNOWN";
}

function normalizeAgent(item: unknown, index: number): AgentRow {
  const obj = asDict(item);

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || `${index}`),
    agent_code: String(getNestedValue(obj, ["agent_code", "code", "number"]) || "-"),
    referral_code: String(
      getNestedValue(obj, ["referral_code", "ref_code", "affiliate_code"]) || "",
    ),
    name: String(
      getNestedValue(obj, ["full_name", "name", "agent_name", "username"]) || "-",
    ),
    phone: String(getNestedValue(obj, ["phone", "mobile", "phone_number"]) || ""),
    email: String(getNestedValue(obj, ["email", "agent_email"]) || ""),
    city: String(getNestedValue(obj, ["city", "city_name"]) || ""),
    address: String(getNestedValue(obj, ["address", "full_address"]) || ""),
    status: normalizeStatus(getNestedValue(obj, ["status", "state"])),
    commission_type: normalizeCommissionType(
      getNestedValue(obj, [
        "default_commission_type",
        "commission_type",
        "defaultCommissionType",
      ]),
    ),
    commission_value: toNumber(
      getNestedValue(obj, [
        "default_commission_value",
        "commission_value",
        "defaultCommissionValue",
      ]),
    ),
    total_customers: toNumber(
      getNestedValue(obj, ["total_customers", "customers_count"]),
    ),
    total_orders: toNumber(getNestedValue(obj, ["total_orders", "orders_count"])),
    total_sales: toNumber(getNestedValue(obj, ["total_sales", "sales_total"])),
    pending_commission: toNumber(
      getNestedValue(obj, ["pending_commission", "pending_commission_amount"]),
    ),
    approved_commission: toNumber(
      getNestedValue(obj, ["approved_commission", "approved_commission_amount"]),
    ),
    paid_commission: toNumber(
      getNestedValue(obj, ["paid_commission", "paid_commission_amount"]),
    ),
    accounting_posted_commission: toNumber(
      getNestedValue(obj, [
        "accounting_posted_commission",
        "posted_commission",
        "accounting_posted_commission_amount",
      ]),
    ),
    bank_name: String(getNestedValue(obj, ["bank_name", "bank"]) || ""),
    iban: String(getNestedValue(obj, ["iban", "bank_iban"]) || ""),
    is_featured: Boolean(getNestedValue(obj, ["is_featured", "featured"])),
    created_at: String(getNestedValue(obj, ["created_at", "created"]) || ""),
  };
}

function buildSummary(
  rows: AgentRow[],
  apiSummary?: Partial<AgentsSummary>,
): AgentsSummary {
  const fallback: AgentsSummary = {
    total_agents: rows.length,
    active_agents: rows.filter((item) => item.status === "ACTIVE").length,
    inactive_agents: rows.filter((item) => item.status === "INACTIVE").length,
    suspended_agents: rows.filter((item) => item.status === "SUSPENDED").length,
    draft_agents: rows.filter((item) => item.status === "DRAFT").length,
    featured_agents: rows.filter((item) => item.is_featured).length,
    total_customers: rows.reduce((sum, item) => sum + item.total_customers, 0),
    total_orders: rows.reduce((sum, item) => sum + item.total_orders, 0),
    total_sales: rows.reduce((sum, item) => sum + item.total_sales, 0),
    pending_commission: rows.reduce(
      (sum, item) => sum + item.pending_commission,
      0,
    ),
    approved_commission: rows.reduce(
      (sum, item) => sum + item.approved_commission,
      0,
    ),
    paid_commission: rows.reduce((sum, item) => sum + item.paid_commission, 0),
    accounting_posted_commission: rows.reduce(
      (sum, item) => sum + item.accounting_posted_commission,
      0,
    ),
  };

  const api = asDict(apiSummary);

  return {
    total_agents:
      toNumber(api.total_agents) ||
      toNumber(api.agents_count) ||
      fallback.total_agents,
    active_agents: toNumber(api.active_agents) || fallback.active_agents,
    inactive_agents: toNumber(api.inactive_agents) || fallback.inactive_agents,
    suspended_agents:
      toNumber(api.suspended_agents) || fallback.suspended_agents,
    draft_agents: toNumber(api.draft_agents) || fallback.draft_agents,
    featured_agents: toNumber(api.featured_agents) || fallback.featured_agents,
    total_customers:
      toNumber(api.total_customers) ||
      toNumber(api.customers_count) ||
      fallback.total_customers,
    total_orders:
      toNumber(api.total_orders) ||
      toNumber(api.orders_count) ||
      fallback.total_orders,
    total_sales:
      toNumber(api.total_sales) ||
      toNumber(api.sales_total) ||
      fallback.total_sales,
    pending_commission:
      toNumber(api.pending_commission) || fallback.pending_commission,
    approved_commission:
      toNumber(api.approved_commission) || fallback.approved_commission,
    paid_commission: toNumber(api.paid_commission) || fallback.paid_commission,
    accounting_posted_commission:
      toNumber(api.accounting_posted_commission) ||
      fallback.accounting_posted_commission,
  };
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

function commissionTypeLabel(type: CommissionType, locale: AppLocale) {
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
      <Badge className="rounded-full border-amber-200 bg-amber-50 px-3 py-1 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
        {label}
      </Badge>
    );
  }

  if (status === "INACTIVE" || status === "SUSPENDED") {
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
        <CardContent className="grid gap-3 p-5 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <SkeletonLine key={index} className="h-24 w-full rounded-2xl" />
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardContent className="space-y-3 p-5">
          <SkeletonLine className="h-7 w-48" />
          {Array.from({ length: 7 }).map((_, index) => (
            <SkeletonLine key={index} className="h-12 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
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
  rows,
}: {
  filename: string;
  title: string;
  locale: AppLocale;
  summary: AgentsSummary;
  rows: AgentRow[];
}) {
  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const align = isArabic ? "right" : "left";
  const t = dictionary(locale);

  const rowsHtml = rows
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.agent_code)}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.referral_code || "-")}</td>
          <td>${escapeHtml(statusLabel(item.status, locale))}</td>
          <td>${escapeHtml(item.city || "-")}</td>
          <td>${escapeHtml(item.phone || "-")}</td>
          <td>${escapeHtml(formatNumber(item.total_customers))}</td>
          <td>${escapeHtml(formatNumber(item.total_orders))}</td>
          <td>${escapeHtml(formatMoney(item.total_sales))}</td>
          <td>${escapeHtml(formatMoney(item.pending_commission))}</td>
          <td>${escapeHtml(formatMoney(item.paid_commission))}</td>
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
          <tr><td class="title" colspan="12">${escapeHtml(title)}</td></tr>
          <tr><td colspan="12"></td></tr>
          <tr><td class="section" colspan="12">${escapeHtml(t.generatedAt)}: ${escapeHtml(new Date().toLocaleString("en-US"))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalAgents)}</td><td colspan="11">${escapeHtml(formatNumber(summary.total_agents))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.activeAgents)}</td><td colspan="11">${escapeHtml(formatNumber(summary.active_agents))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalSales)}</td><td colspan="11">${escapeHtml(formatMoney(summary.total_sales))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.pendingCommission)}</td><td colspan="11">${escapeHtml(formatMoney(summary.pending_commission))}</td></tr>

          <tr><td colspan="12"></td></tr>
          <tr>
            <th>${escapeHtml(t.table.code)}</th>
            <th>${escapeHtml(t.table.agent)}</th>
            <th>${escapeHtml("Referral")}</th>
            <th>${escapeHtml(t.table.status)}</th>
            <th>${escapeHtml(t.table.city)}</th>
            <th>${escapeHtml(t.table.contact)}</th>
            <th>${escapeHtml(t.table.customers)}</th>
            <th>${escapeHtml(t.table.orders)}</th>
            <th>${escapeHtml(t.table.sales)}</th>
            <th>${escapeHtml(t.pendingCommission)}</th>
            <th>${escapeHtml(t.paidCommission)}</th>
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
  summary: AgentsSummary;
  rows: AgentRow[];
}) {
  const isArabic = locale === "ar";
  const t = dictionary(locale);

  const tableRows = rows
    .slice(0, 40)
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.agent_code)}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(statusLabel(item.status, locale))}</td>
          <td>${escapeHtml(item.city || "-")}</td>
          <td>${escapeHtml(formatNumber(item.total_orders))}</td>
          <td>${escapeHtml(formatMoney(item.total_sales))}</td>
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
          <div class="box"><span>${escapeHtml(t.totalAgents)}</span><strong>${escapeHtml(formatNumber(summary.total_agents))}</strong></div>
          <div class="box"><span>${escapeHtml(t.activeAgents)}</span><strong>${escapeHtml(formatNumber(summary.active_agents))}</strong></div>
          <div class="box"><span>${escapeHtml(t.totalSales)}</span><strong>${escapeHtml(formatMoney(summary.total_sales))}</strong></div>
          <div class="box"><span>${escapeHtml(t.pendingCommission)}</span><strong>${escapeHtml(formatMoney(summary.pending_commission))}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>${escapeHtml(t.table.code)}</th>
              <th>${escapeHtml(t.table.agent)}</th>
              <th>${escapeHtml(t.table.status)}</th>
              <th>${escapeHtml(t.table.city)}</th>
              <th>${escapeHtml(t.table.orders)}</th>
              <th>${escapeHtml(t.table.sales)}</th>
            </tr>
          </thead>
          <tbody>${tableRows || `<tr><td colspan="6">${escapeHtml(t.emptyTitle)}</td></tr>`}</tbody>
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
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [summary, setSummary] = useState<AgentsSummary>(DEFAULT_SUMMARY);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canView = hasAnyPermission(auth, ["agents.view", "agents.list"], "view");
  const canCreate = hasAnyPermission(auth, ["agents.create"], "action");

  const canExport = hasAnyPermission(
    auth,
    ["agents.export", "reports.export"],
    "action",
  );

  const canPrint = hasAnyPermission(
    auth,
    ["agents.print", "reports.print"],
    "action",
  );

  const canViewDetails = hasAnyPermission(auth, ["agents.view"], "view");

  const filteredRows = useMemo(() => {
    const clean = query.trim().toLowerCase();

    const sorted = [...rows].sort((a, b) =>
      String(b.created_at).localeCompare(String(a.created_at)),
    );

    if (!clean) return sorted.slice(0, 12);

    return sorted
      .filter((item) =>
        [
          item.agent_code,
          item.referral_code,
          item.name,
          item.phone,
          item.email,
          item.city,
          item.address,
          statusLabel(item.status, locale),
          commissionTypeLabel(item.commission_type, locale),
        ]
          .join(" ")
          .toLowerCase()
          .includes(clean),
      )
      .slice(0, 12);
  }, [locale, query, rows]);

  const activeSummary = useMemo(() => buildSummary(filteredRows), [filteredRows]);

  const displaySummary = query.trim() ? activeSummary : summary;
  const hasData = rows.length > 0;
  const hasSearch = query.trim().length > 0;

  const loadAgents = useCallback(
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

        const payload = await loadFirstAvailable([
          "/api/agents/list/?page_size=500",
          "/api/agents/?page_size=500",
        ]);

        if (!payload) {
          throw new Error(t.loadError);
        }

        const normalizedRows = extractRows(payload, "agents")
          .map(normalizeAgent)
          .filter((item) => item.id || item.name);

        setRows(normalizedRows);
        setSummary(buildSummary(normalizedRows, extractSummary(payload)));

        if (showToast) toast.success(t.loadSuccess);
      } catch (error) {
        console.error("Agents overview load error:", error);
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

  function exportExcel() {
    if (!canExport) return;

    if (!hasData) {
      toast.error(t.exportEmpty);
      return;
    }

    downloadExcel({
      filename: `primey-care-agents-${new Date().toISOString().slice(0, 10)}.xls`,
      title: t.title,
      locale,
      summary: displaySummary,
      rows: hasSearch ? filteredRows : rows,
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
        summary: displaySummary,
        rows: hasSearch ? filteredRows : rows,
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
    loadAgents(false);
  }, [authResolving, loadAgents]);

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
              onClick={() => loadAgents(true)}
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
              title={t.totalAgents}
              value={formatNumber(displaySummary.total_agents)}
              icon={<Users className="h-5 w-5" />}
            />
            <KpiCard
              title={t.activeAgents}
              value={formatNumber(displaySummary.active_agents)}
              icon={<BadgeCheck className="h-5 w-5" />}
            />
            <KpiCard
              title={t.totalSales}
              value={<MoneyText value={displaySummary.total_sales} />}
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <KpiCard
              title={t.pendingCommission}
              value={<MoneyText value={displaySummary.pending_commission} />}
              icon={<HandCoins className="h-5 w-5" />}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MiniStat title={t.totalCustomers} value={displaySummary.total_customers} />
            <MiniStat title={t.totalOrders} value={displaySummary.total_orders} />
            <MiniMoneyStat
              title={t.approvedCommission}
              value={displaySummary.approved_commission}
            />
            <MiniMoneyStat title={t.paidCommission} value={displaySummary.paid_commission} />
          </div>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">
                {t.shortcutsTitle}
              </CardTitle>
              <CardDescription>{t.shortcutsDesc}</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                <Link href="/system/agents/list">
                  <Card className="h-full rounded-2xl border bg-background/70 shadow-sm transition hover:bg-muted/40">
                    <CardContent className="flex h-full items-start gap-3 p-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <FileText className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <p className="font-semibold">{t.agentsList}</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {isArabic
                            ? "عرض المندوبين مع البحث والفلاتر والإجراءات."
                            : "Open agents with search, filters, and actions."}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                {canCreate ? (
                  <Link href="/system/agents/create">
                    <Card className="h-full rounded-2xl border bg-background/70 shadow-sm transition hover:bg-muted/40">
                      <CardContent className="flex h-full items-start gap-3 p-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <PlusCircle className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                          <p className="font-semibold">{t.createAgent}</p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {isArabic
                              ? "إضافة مندوب جديد وربطه بعمليات البيع."
                              : "Add a new agent and link them to sales operations."}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ) : null}
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
                <Users className="h-12 w-12 text-muted-foreground/40" />
                <p className="text-lg font-semibold">{t.emptyTitle}</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  {t.emptyText}
                </p>

                {canCreate ? (
                  <Link href="/system/agents/create">
                    <Button className="mt-2 rounded-xl">
                      <PlusCircle className="h-4 w-4" />
                      {t.createAgent}
                    </Button>
                  </Link>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {hasData && hasSearch && filteredRows.length === 0 ? (
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

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-base font-bold">
                    {t.latestTitle}
                  </CardTitle>
                  <CardDescription>{t.latestDesc}</CardDescription>
                </div>

                <Link href="/system/agents/list">
                  <Button variant="outline" className="h-10 rounded-xl">
                    <ArrowUpRight className="h-4 w-4" />
                    {t.agentsList}
                  </Button>
                </Link>
              </div>
            </CardHeader>

            <CardContent>
              <div className="overflow-hidden rounded-xl border">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[230px]">
                          {t.table.agent}
                        </TableHead>
                        <TableHead className="min-w-[120px]">
                          {t.table.code}
                        </TableHead>
                        <TableHead className="min-w-[120px]">
                          {t.table.city}
                        </TableHead>
                        <TableHead className="min-w-[160px]">
                          {t.table.contact}
                        </TableHead>
                        <TableHead className="min-w-[120px]">
                          {t.table.status}
                        </TableHead>
                        <TableHead className="min-w-[90px]">
                          {t.table.orders}
                        </TableHead>
                        <TableHead className="min-w-[130px]">
                          {t.table.sales}
                        </TableHead>
                        <TableHead className="min-w-[130px]">
                          {t.table.commission}
                        </TableHead>
                        <TableHead className="min-w-[120px]">
                          {t.table.paid}
                        </TableHead>
                        {canViewDetails ? (
                          <TableHead className="min-w-[90px]">
                            {t.table.action}
                          </TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {filteredRows.length > 0 ? (
                        filteredRows.map((item) => (
                          <TableRow key={`${item.id}-${item.agent_code}`}>
                            <TableCell>
                              <div className="min-w-[210px]">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold">{item.name}</p>
                                  {item.is_featured ? (
                                    <Badge variant="outline" className="rounded-full">
                                      <Star className="h-3 w-3" />
                                      {t.featured}
                                    </Badge>
                                  ) : null}
                                </div>

                                <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                                  {item.referral_code || item.email || "-"}
                                </p>
                              </div>
                            </TableCell>

                            <TableCell className="font-medium" dir="ltr">
                              {item.agent_code}
                            </TableCell>

                            <TableCell>
                              <span className="inline-flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                {item.city || "-"}
                              </span>
                            </TableCell>

                            <TableCell>
                              <div className="min-w-[140px]">
                                <p
                                  className="inline-flex items-center gap-1.5 text-sm"
                                  dir="ltr"
                                >
                                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                  {item.phone || "-"}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {item.email || "-"}
                                </p>
                              </div>
                            </TableCell>

                            <TableCell>{statusBadge(item.status, locale)}</TableCell>
                            <TableCell>{formatNumber(item.total_orders)}</TableCell>

                            <TableCell>
                              <MoneyText value={item.total_sales} />
                            </TableCell>

                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <MoneyText value={item.pending_commission} />
                                <span className="text-xs text-muted-foreground">
                                  {commissionTypeLabel(item.commission_type, locale)}{" "}
                                  {item.commission_type === "PERCENTAGE"
                                    ? `${formatNumber(item.commission_value)}%`
                                    : item.commission_value > 0
                                      ? formatMoney(item.commission_value)
                                      : ""}
                                </span>
                              </div>
                            </TableCell>

                            <TableCell>
                              <MoneyText value={item.paid_commission} />
                            </TableCell>

                            {canViewDetails ? (
                              <TableCell>
                                {isValidId(item.id) ? (
                                  <Link href={`/system/agents/${item.id}`}>
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
                            colSpan={canViewDetails ? 10 : 9}
                            className="h-32 text-center"
                          >
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

  console.warn("Agents endpoint fallback failed:", lastError);
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

function MiniMoneyStat({ title, value }: { title: string; value: number }) {
  return (
    <Card className="rounded-2xl border bg-card shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">{title}</span>
          <span className="text-lg font-bold">
            <MoneyText value={value} />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}