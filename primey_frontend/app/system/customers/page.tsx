"use client";

/* ============================================================
   📂 app/system/customers/page.tsx
   🧠 Primey Care | Customers Overview

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
  Activity,
  ArrowUpRight,
  Download,
  Eye,
  FileText,
  Loader2,
  PlusCircle,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
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

type CustomerStatus = "ACTIVE" | "INACTIVE" | "BLOCKED" | "UNKNOWN";

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  national_id: string;
  status: CustomerStatus;
  city: string;
  created_at: string;
  orders_count: number;
  invoices_count: number;
  payments_count: number;
  total_orders_amount: number;
  total_paid_amount: number;
  outstanding_amount: number;
};

type CustomersSummary = {
  total_customers: number;
  active_customers: number;
  inactive_customers: number;
  blocked_customers: number;
  total_orders: number;
  total_invoices: number;
  total_payments: number;
  total_orders_amount: number;
  total_paid_amount: number;
  outstanding_amount: number;
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
  customers?: unknown[];
  summary?: Partial<CustomersSummary>;
};

const SAR_ICON_PATH = "/currency/sar.svg";

const DEFAULT_SUMMARY: CustomersSummary = {
  total_customers: 0,
  active_customers: 0,
  inactive_customers: 0,
  blocked_customers: 0,
  total_orders: 0,
  total_invoices: 0,
  total_payments: 0,
  total_orders_amount: 0,
  total_paid_amount: 0,
  outstanding_amount: 0,
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
    title: isArabic ? "العملاء" : "Customers",
    subtitle: isArabic
      ? "لوحة متابعة العملاء والطلبات والفواتير والمدفوعات المرتبطة بهم."
      : "Customer overview with related orders, invoices, and payments.",

    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    customersList: isArabic ? "قائمة العملاء" : "Customers List",
    createCustomer: isArabic ? "إنشاء عميل" : "Create Customer",

    totalCustomers: isArabic ? "إجمالي العملاء" : "Total Customers",
    activeCustomers: isArabic ? "عملاء نشطون" : "Active Customers",
    totalOrders: isArabic ? "إجمالي الطلبات" : "Total Orders",
    outstandingAmount: isArabic ? "المبالغ المستحقة" : "Outstanding Amount",
    totalPaid: isArabic ? "إجمالي المدفوع" : "Total Paid",
    totalInvoices: isArabic ? "الفواتير" : "Invoices",
    totalPayments: isArabic ? "المدفوعات" : "Payments",
    inactiveCustomers: isArabic ? "غير نشطين" : "Inactive",
    blockedCustomers: isArabic ? "محظورين" : "Blocked",

    shortcutsTitle: isArabic ? "اختصارات العملاء" : "Customer Shortcuts",
    shortcutsDesc: isArabic
      ? "الوصول السريع لقائمة العملاء أو إنشاء عميل بعد تنظيف السايدر."
      : "Quick access to customer list and create page after sidebar cleanup.",

    latestTitle: isArabic ? "آخر العملاء" : "Latest Customers",
    latestDesc: isArabic
      ? "أحدث العملاء المسجلين مع ملخص العمليات."
      : "Latest registered customers with operational summary.",

    searchPlaceholder: isArabic
      ? "ابحث باسم العميل أو الجوال أو البريد أو المدينة..."
      : "Search by customer name, phone, email, or city...",

    table: {
      customer: isArabic ? "العميل" : "Customer",
      phone: isArabic ? "الجوال" : "Phone",
      city: isArabic ? "المدينة" : "City",
      status: isArabic ? "الحالة" : "Status",
      orders: isArabic ? "الطلبات" : "Orders",
      paid: isArabic ? "المدفوع" : "Paid",
      outstanding: isArabic ? "المستحق" : "Outstanding",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      action: isArabic ? "الإجراء" : "Action",
    },

    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
    blocked: isArabic ? "محظور" : "Blocked",
    unknown: isArabic ? "غير محدد" : "Unknown",

    view: isArabic ? "عرض" : "View",

    emptyTitle: isArabic ? "لا توجد بيانات عملاء" : "No customer data",
    emptyText: isArabic
      ? "ستظهر بيانات العملاء هنا بعد إنشاء أول عميل."
      : "Customer data will appear here after creating the first customer.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير كلمات البحث."
      : "Try changing your search terms.",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض العملاء" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض العملاء. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view customers. Contact your system administrator if you need access.",

    loadError: isArabic ? "تعذر تحميل بيانات العملاء." : "Unable to load customers.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    loadSuccess: isArabic ? "تم تحديث بيانات العملاء." : "Customers refreshed.",

    exportSuccess: isArabic ? "تم تجهيز ملف Excel." : "Excel file prepared.",
    exportEmpty: isArabic
      ? "لا توجد بيانات قابلة للتصدير."
      : "No data available to export.",
    printSuccess: isArabic ? "تم تجهيز نافذة الطباعة." : "Print window prepared.",
    printError: isArabic ? "تعذر فتح نافذة الطباعة." : "Unable to open print window.",

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

  for (const container of ["customer", "client", "profile", "data"]) {
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
  } as Partial<CustomersSummary>;
}

function normalizeCustomerStatus(value: unknown): CustomerStatus {
  const clean = String(value || "").toUpperCase();

  if (["ACTIVE", "ENABLED", "APPROVED"].includes(clean)) return "ACTIVE";
  if (["INACTIVE", "DISABLED", "PENDING"].includes(clean)) return "INACTIVE";
  if (["BLOCKED", "SUSPENDED", "BANNED"].includes(clean)) return "BLOCKED";

  return "UNKNOWN";
}

function normalizeCustomer(item: unknown, index: number): CustomerRow {
  const obj = asDict(item);

  const ordersCount = toNumber(
    getNestedValue(obj, ["orders_count", "total_orders", "orders"]),
  );

  const invoicesCount = toNumber(
    getNestedValue(obj, ["invoices_count", "total_invoices", "invoices"]),
  );

  const paymentsCount = toNumber(
    getNestedValue(obj, ["payments_count", "total_payments", "payments"]),
  );

  const totalOrdersAmount = toNumber(
    getNestedValue(obj, [
      "total_orders_amount",
      "orders_total",
      "total_amount",
      "total_spent",
    ]),
  );

  const totalPaidAmount = toNumber(
    getNestedValue(obj, ["total_paid_amount", "paid_amount", "payments_total"]),
  );

  const outstandingAmountValue = getNestedValue(obj, [
    "outstanding_amount",
    "remaining_amount",
    "balance_due",
  ]);

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || `${index}`),
    name: String(
      getNestedValue(obj, ["name", "full_name", "customer_name"]) || "-",
    ),
    phone: String(
      getNestedValue(obj, ["phone", "mobile", "customer_phone"]) || "",
    ),
    email: String(getNestedValue(obj, ["email", "customer_email"]) || ""),
    national_id: String(
      getNestedValue(obj, ["national_id", "identity_number", "id_number"]) || "",
    ),
    status: normalizeCustomerStatus(getNestedValue(obj, ["status", "state"])),
    city: String(getNestedValue(obj, ["city", "city_name", "address_city"]) || ""),
    created_at: String(getNestedValue(obj, ["created_at", "created"]) || ""),
    orders_count: ordersCount,
    invoices_count: invoicesCount,
    payments_count: paymentsCount,
    total_orders_amount: totalOrdersAmount,
    total_paid_amount: totalPaidAmount,
    outstanding_amount:
      outstandingAmountValue !== undefined && outstandingAmountValue !== null
        ? toNumber(outstandingAmountValue)
        : Math.max(totalOrdersAmount - totalPaidAmount, 0),
  };
}

function buildSummary(
  rows: CustomerRow[],
  apiSummary?: Partial<CustomersSummary>,
): CustomersSummary {
  const fallback: CustomersSummary = {
    total_customers: rows.length,
    active_customers: rows.filter((item) => item.status === "ACTIVE").length,
    inactive_customers: rows.filter((item) => item.status === "INACTIVE").length,
    blocked_customers: rows.filter((item) => item.status === "BLOCKED").length,
    total_orders: rows.reduce((sum, item) => sum + item.orders_count, 0),
    total_invoices: rows.reduce((sum, item) => sum + item.invoices_count, 0),
    total_payments: rows.reduce((sum, item) => sum + item.payments_count, 0),
    total_orders_amount: rows.reduce(
      (sum, item) => sum + item.total_orders_amount,
      0,
    ),
    total_paid_amount: rows.reduce(
      (sum, item) => sum + item.total_paid_amount,
      0,
    ),
    outstanding_amount: rows.reduce(
      (sum, item) => sum + item.outstanding_amount,
      0,
    ),
  };

  const api = asDict(apiSummary);

  return {
    total_customers:
      toNumber(api.total_customers) ||
      toNumber(api.customers_count) ||
      fallback.total_customers,
    active_customers:
      toNumber(api.active_customers) || fallback.active_customers,
    inactive_customers:
      toNumber(api.inactive_customers) || fallback.inactive_customers,
    blocked_customers:
      toNumber(api.blocked_customers) || fallback.blocked_customers,
    total_orders: toNumber(api.total_orders) || fallback.total_orders,
    total_invoices: toNumber(api.total_invoices) || fallback.total_invoices,
    total_payments: toNumber(api.total_payments) || fallback.total_payments,
    total_orders_amount:
      toNumber(api.total_orders_amount) || fallback.total_orders_amount,
    total_paid_amount:
      toNumber(api.total_paid_amount) ||
      toNumber(api.paid_amount) ||
      fallback.total_paid_amount,
    outstanding_amount:
      toNumber(api.outstanding_amount) || fallback.outstanding_amount,
  };
}

function statusLabel(status: CustomerStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<CustomerStatus, string> = {
    ACTIVE: t.active,
    INACTIVE: t.inactive,
    BLOCKED: t.blocked,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function statusBadge(status: CustomerStatus, locale: AppLocale) {
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

  if (status === "BLOCKED") {
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
  summary: CustomersSummary;
  rows: CustomerRow[];
}) {
  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const align = isArabic ? "right" : "left";
  const t = dictionary(locale);

  const rowsHtml = rows
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.phone || "-")}</td>
          <td>${escapeHtml(item.email || "-")}</td>
          <td>${escapeHtml(item.city || "-")}</td>
          <td>${escapeHtml(statusLabel(item.status, locale))}</td>
          <td>${escapeHtml(formatNumber(item.orders_count))}</td>
          <td>${escapeHtml(formatMoney(item.total_paid_amount))}</td>
          <td>${escapeHtml(formatMoney(item.outstanding_amount))}</td>
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
          <tr><td class="title" colspan="9">${escapeHtml(title)}</td></tr>
          <tr><td colspan="9"></td></tr>
          <tr><td class="section" colspan="9">${escapeHtml(t.generatedAt)}: ${escapeHtml(new Date().toLocaleString("en-US"))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalCustomers)}</td><td colspan="8">${escapeHtml(formatNumber(summary.total_customers))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.activeCustomers)}</td><td colspan="8">${escapeHtml(formatNumber(summary.active_customers))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalOrders)}</td><td colspan="8">${escapeHtml(formatNumber(summary.total_orders))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalPaid)}</td><td colspan="8">${escapeHtml(formatMoney(summary.total_paid_amount))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.outstandingAmount)}</td><td colspan="8">${escapeHtml(formatMoney(summary.outstanding_amount))}</td></tr>

          <tr><td colspan="9"></td></tr>
          <tr>
            <th>${escapeHtml(t.table.customer)}</th>
            <th>${escapeHtml(t.table.phone)}</th>
            <th>${escapeHtml("Email")}</th>
            <th>${escapeHtml(t.table.city)}</th>
            <th>${escapeHtml(t.table.status)}</th>
            <th>${escapeHtml(t.table.orders)}</th>
            <th>${escapeHtml(t.table.paid)}</th>
            <th>${escapeHtml(t.table.outstanding)}</th>
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
  summary: CustomersSummary;
  rows: CustomerRow[];
}) {
  const isArabic = locale === "ar";
  const t = dictionary(locale);

  const tableRows = rows
    .slice(0, 40)
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.phone || "-")}</td>
          <td>${escapeHtml(statusLabel(item.status, locale))}</td>
          <td>${escapeHtml(formatNumber(item.orders_count))}</td>
          <td>${escapeHtml(formatMoney(item.total_paid_amount))}</td>
          <td>${escapeHtml(formatMoney(item.outstanding_amount))}</td>
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
          <div class="box"><span>${escapeHtml(t.totalCustomers)}</span><strong>${escapeHtml(formatNumber(summary.total_customers))}</strong></div>
          <div class="box"><span>${escapeHtml(t.activeCustomers)}</span><strong>${escapeHtml(formatNumber(summary.active_customers))}</strong></div>
          <div class="box"><span>${escapeHtml(t.totalPaid)}</span><strong>${escapeHtml(formatMoney(summary.total_paid_amount))}</strong></div>
          <div class="box"><span>${escapeHtml(t.outstandingAmount)}</span><strong>${escapeHtml(formatMoney(summary.outstanding_amount))}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>${escapeHtml(t.table.customer)}</th>
              <th>${escapeHtml(t.table.phone)}</th>
              <th>${escapeHtml(t.table.status)}</th>
              <th>${escapeHtml(t.table.orders)}</th>
              <th>${escapeHtml(t.table.paid)}</th>
              <th>${escapeHtml(t.table.outstanding)}</th>
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

export default function SystemCustomersPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [summary, setSummary] = useState<CustomersSummary>(DEFAULT_SUMMARY);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canView = hasAnyPermission(
    auth,
    ["customers.view", "customers.list"],
    "view",
  );

  const canCreate = hasAnyPermission(
    auth,
    ["customers.create"],
    "action",
  );

  const canExport = hasAnyPermission(
    auth,
    ["customers.export", "reports.export"],
    "action",
  );

  const canPrint = hasAnyPermission(
    auth,
    ["customers.print", "reports.print"],
    "action",
  );

  const canViewDetails = hasAnyPermission(
    auth,
    ["customers.view"],
    "view",
  );

  const filteredRows = useMemo(() => {
    const clean = query.trim().toLowerCase();

    const sorted = [...rows].sort((a, b) =>
      String(b.created_at).localeCompare(String(a.created_at)),
    );

    if (!clean) return sorted.slice(0, 12);

    return sorted
      .filter((item) =>
        [
          item.name,
          item.phone,
          item.email,
          item.national_id,
          item.city,
          statusLabel(item.status, locale),
        ]
          .join(" ")
          .toLowerCase()
          .includes(clean),
      )
      .slice(0, 12);
  }, [locale, query, rows]);

  const activeSummary = useMemo(
    () => buildSummary(filteredRows),
    [filteredRows],
  );

  const displaySummary = query.trim() ? activeSummary : summary;
  const hasData = rows.length > 0;
  const hasSearch = query.trim().length > 0;

  const loadCustomers = useCallback(
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
          "/api/customers/list/?page_size=500",
          "/api/customers/?page_size=500",
        ]);

        if (!payload) {
          throw new Error(t.loadError);
        }

        const normalizedRows = extractRows(payload, "customers")
          .map(normalizeCustomer)
          .filter((item) => item.id || item.name);

        setRows(normalizedRows);
        setSummary(buildSummary(normalizedRows, extractSummary(payload)));

        if (showToast) toast.success(t.loadSuccess);
      } catch (error) {
        console.error("Customers overview load error:", error);
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
      filename: `primey-care-customers-${new Date().toISOString().slice(0, 10)}.xls`,
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
    loadCustomers(false);
  }, [authResolving, loadCustomers]);

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
            onClick={() => loadCustomers(true)}
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
              onClick={() => loadCustomers(true)}
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
              title={t.totalCustomers}
              value={formatNumber(displaySummary.total_customers)}
              icon={<Users className="h-5 w-5" />}
            />
            <KpiCard
              title={t.activeCustomers}
              value={formatNumber(displaySummary.active_customers)}
              icon={<UserCheck className="h-5 w-5" />}
            />
            <KpiCard
              title={t.totalPaid}
              value={<MoneyText value={displaySummary.total_paid_amount} />}
              icon={<WalletCards className="h-5 w-5" />}
            />
            <KpiCard
              title={t.outstandingAmount}
              value={<MoneyText value={displaySummary.outstanding_amount} />}
              icon={<Activity className="h-5 w-5" />}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MiniStat title={t.totalOrders} value={displaySummary.total_orders} />
            <MiniStat title={t.totalInvoices} value={displaySummary.total_invoices} />
            <MiniStat title={t.totalPayments} value={displaySummary.total_payments} />
            <MiniStat title={t.blockedCustomers} value={displaySummary.blocked_customers} />
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
                <Link href="/system/customers/list">
                  <Card className="h-full rounded-2xl border bg-background/70 shadow-sm transition hover:bg-muted/40">
                    <CardContent className="flex h-full items-start gap-3 p-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <FileText className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <p className="font-semibold">{t.customersList}</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {isArabic
                            ? "عرض العملاء مع البحث والفلاتر والإجراءات."
                            : "Open customer list with search, filters, and actions."}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                {canCreate ? (
                  <Link href="/system/customers/create">
                    <Card className="h-full rounded-2xl border bg-background/70 shadow-sm transition hover:bg-muted/40">
                      <CardContent className="flex h-full items-start gap-3 p-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <PlusCircle className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                          <p className="font-semibold">{t.createCustomer}</p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {isArabic
                              ? "إضافة عميل جديد للنظام."
                              : "Add a new customer to the system."}
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
                  <Link href="/system/customers/create">
                    <Button className="mt-2 rounded-xl">
                      <PlusCircle className="h-4 w-4" />
                      {t.createCustomer}
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

                <Link href="/system/customers/list">
                  <Button variant="outline" className="h-10 rounded-xl">
                    <ArrowUpRight className="h-4 w-4" />
                    {t.customersList}
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
                        <TableHead className="min-w-[220px]">
                          {t.table.customer}
                        </TableHead>
                        <TableHead className="min-w-[130px]">
                          {t.table.phone}
                        </TableHead>
                        <TableHead className="min-w-[110px]">
                          {t.table.city}
                        </TableHead>
                        <TableHead className="min-w-[120px]">
                          {t.table.status}
                        </TableHead>
                        <TableHead className="min-w-[90px]">
                          {t.table.orders}
                        </TableHead>
                        <TableHead className="min-w-[130px]">
                          {t.table.paid}
                        </TableHead>
                        <TableHead className="min-w-[130px]">
                          {t.table.outstanding}
                        </TableHead>
                        <TableHead className="min-w-[120px]">
                          {t.table.createdAt}
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
                          <TableRow key={`${item.id}-${item.phone}`}>
                            <TableCell>
                              <div className="min-w-[200px]">
                                <p className="font-semibold">{item.name}</p>
                                <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                                  {item.email || item.national_id || "-"}
                                </p>
                              </div>
                            </TableCell>

                            <TableCell dir="ltr">{item.phone || "-"}</TableCell>
                            <TableCell>{item.city || "-"}</TableCell>
                            <TableCell>{statusBadge(item.status, locale)}</TableCell>
                            <TableCell>{formatNumber(item.orders_count)}</TableCell>
                            <TableCell>
                              <MoneyText value={item.total_paid_amount} />
                            </TableCell>
                            <TableCell>
                              <MoneyText value={item.outstanding_amount} />
                            </TableCell>
                            <TableCell>
                              {formatDate(item.created_at, locale)}
                            </TableCell>

                            {canViewDetails ? (
                              <TableCell>
                                {isValidId(item.id) ? (
                                  <Link href={`/system/customers/${item.id}`}>
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
                            colSpan={canViewDetails ? 9 : 8}
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

  console.warn("Customers endpoint fallback failed:", lastError);
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