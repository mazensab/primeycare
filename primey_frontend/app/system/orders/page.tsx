"use client";

/* ============================================================
   📂 app/system/orders/page.tsx
   🧠 Primey Care | Orders Overview

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
  ClipboardList,
  CreditCard,
  Download,
  Eye,
  FileText,
  Loader2,
  Package,
  PlusCircle,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShoppingCart,
  TimerReset,
  Truck,
  UserRound,
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

type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED"
  | "UNKNOWN";

type PaymentStatus =
  | "UNPAID"
  | "PARTIAL"
  | "PAID"
  | "REFUNDED"
  | "CANCELLED"
  | "UNKNOWN";

type FulfillmentStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "FULFILLED"
  | "FAILED"
  | "CANCELLED"
  | "UNKNOWN";

type OrderRow = {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  product_id: string;
  product_name: string;
  provider_id: string;
  provider_name: string;
  agent_id: string;
  agent_name: string;
  invoice_id: string;
  invoice_number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  agent_commission: number;
  created_at: string;
};

type OrdersSummary = {
  total_orders: number;
  pending_orders: number;
  confirmed_orders: number;
  processing_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  refunded_orders: number;
  paid_orders: number;
  unpaid_orders: number;
  partial_orders: number;
  fulfilled_orders: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  agent_commission: number;
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
  orders?: unknown[];
  summary?: Partial<OrdersSummary>;
  stats?: Partial<OrdersSummary>;
};

const SAR_ICON_PATH = "/currency/sar.svg";

const DEFAULT_SUMMARY: OrdersSummary = {
  total_orders: 0,
  pending_orders: 0,
  confirmed_orders: 0,
  processing_orders: 0,
  completed_orders: 0,
  cancelled_orders: 0,
  refunded_orders: 0,
  paid_orders: 0,
  unpaid_orders: 0,
  partial_orders: 0,
  fulfilled_orders: 0,
  total_amount: 0,
  paid_amount: 0,
  remaining_amount: 0,
  agent_commission: 0,
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
    title: isArabic ? "الطلبات" : "Orders",
    subtitle: isArabic
      ? "لوحة متابعة دورة الطلب من الإنشاء وحتى الدفع والتنفيذ."
      : "Overview of the order lifecycle from creation to payment and fulfillment.",

    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    ordersList: isArabic ? "قائمة الطلبات" : "Orders List",
    createOrder: isArabic ? "إنشاء طلب" : "Create Order",

    totalOrders: isArabic ? "إجمالي الطلبات" : "Total Orders",
    pendingOrders: isArabic ? "بانتظار التأكيد" : "Pending",
    completedOrders: isArabic ? "طلبات مكتملة" : "Completed",
    processingOrders: isArabic ? "قيد التنفيذ" : "Processing",
    paidOrders: isArabic ? "طلبات مدفوعة" : "Paid Orders",
    totalAmount: isArabic ? "إجمالي الطلبات" : "Total Amount",
    paidAmount: isArabic ? "إجمالي المدفوع" : "Paid Amount",
    remainingAmount: isArabic ? "المتبقي" : "Remaining",
    agentCommission: isArabic ? "عمولات المندوبين" : "Agent Commissions",
    cancelledOrders: isArabic ? "ملغاة" : "Cancelled",
    fulfilledOrders: isArabic ? "منفذة" : "Fulfilled",

    shortcutsTitle: isArabic ? "اختصارات الطلبات" : "Order Shortcuts",
    shortcutsDesc: isArabic
      ? "الوصول السريع لقائمة الطلبات أو إنشاء طلب بعد تنظيف السايدر."
      : "Quick access to order list and create page after sidebar cleanup.",

    latestTitle: isArabic ? "أحدث الطلبات" : "Latest Orders",
    latestDesc: isArabic
      ? "أحدث الطلبات مع العميل والمنتج والحالة والمبلغ."
      : "Latest orders with customer, product, status, and amount.",

    searchPlaceholder: isArabic
      ? "ابحث برقم الطلب أو العميل أو المنتج أو مقدم الخدمة..."
      : "Search by order number, customer, product, or provider...",

    table: {
      order: isArabic ? "الطلب" : "Order",
      customer: isArabic ? "العميل" : "Customer",
      product: isArabic ? "المنتج" : "Product",
      provider: isArabic ? "مقدم الخدمة" : "Provider",
      status: isArabic ? "حالة الطلب" : "Order Status",
      payment: isArabic ? "الدفع" : "Payment",
      fulfillment: isArabic ? "التنفيذ" : "Fulfillment",
      total: isArabic ? "الإجمالي" : "Total",
      paid: isArabic ? "المدفوع" : "Paid",
      remaining: isArabic ? "المتبقي" : "Remaining",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      action: isArabic ? "الإجراء" : "Action",
    },

    pending: isArabic ? "بانتظار التأكيد" : "Pending",
    confirmed: isArabic ? "مؤكد" : "Confirmed",
    processing: isArabic ? "قيد التنفيذ" : "Processing",
    completed: isArabic ? "مكتمل" : "Completed",
    cancelled: isArabic ? "ملغى" : "Cancelled",
    refunded: isArabic ? "مسترد" : "Refunded",
    unknown: isArabic ? "غير محدد" : "Unknown",

    unpaid: isArabic ? "غير مدفوع" : "Unpaid",
    partial: isArabic ? "مدفوع جزئيًا" : "Partial",
    paid: isArabic ? "مدفوع" : "Paid",

    notStarted: isArabic ? "لم يبدأ" : "Not Started",
    inProgress: isArabic ? "قيد التنفيذ" : "In Progress",
    fulfilled: isArabic ? "منفذ" : "Fulfilled",
    failed: isArabic ? "فشل" : "Failed",

    view: isArabic ? "عرض" : "View",

    emptyTitle: isArabic ? "لا توجد بيانات طلبات" : "No order data",
    emptyText: isArabic
      ? "ستظهر الطلبات هنا بعد إنشاء أول طلب."
      : "Orders will appear here after creating the first order.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير كلمات البحث."
      : "Try changing your search terms.",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الطلبات" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض الطلبات. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view orders. Contact your system administrator if you need access.",

    loadError: isArabic ? "تعذر تحميل بيانات الطلبات." : "Unable to load orders.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    loadSuccess: isArabic ? "تم تحديث بيانات الطلبات." : "Orders refreshed.",

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

  for (const container of [
    "order",
    "customer",
    "client",
    "product",
    "provider",
    "center",
    "agent",
    "invoice",
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
  } as Partial<OrdersSummary>;
}

function normalizeOrderStatus(value: unknown): OrderStatus {
  const clean = String(value || "").toUpperCase();

  if (["PENDING", "DRAFT", "NEW"].includes(clean)) return "PENDING";
  if (["CONFIRMED", "APPROVED"].includes(clean)) return "CONFIRMED";
  if (["PROCESSING", "IN_PROGRESS"].includes(clean)) return "PROCESSING";
  if (["COMPLETED", "DONE", "FINISHED"].includes(clean)) return "COMPLETED";
  if (["CANCELLED", "CANCELED", "VOID"].includes(clean)) return "CANCELLED";
  if (["REFUNDED", "RETURNED"].includes(clean)) return "REFUNDED";

  return "UNKNOWN";
}

function normalizePaymentStatus(value: unknown): PaymentStatus {
  const clean = String(value || "").toUpperCase();

  if (["UNPAID", "PENDING", "NOT_PAID"].includes(clean)) return "UNPAID";
  if (["PARTIAL", "PARTIALLY_PAID"].includes(clean)) return "PARTIAL";
  if (["PAID", "CONFIRMED", "SUCCESS"].includes(clean)) return "PAID";
  if (["REFUNDED"].includes(clean)) return "REFUNDED";
  if (["CANCELLED", "CANCELED"].includes(clean)) return "CANCELLED";

  return "UNKNOWN";
}

function normalizeFulfillmentStatus(value: unknown): FulfillmentStatus {
  const clean = String(value || "").toUpperCase();

  if (["NOT_STARTED", "NEW", "PENDING"].includes(clean)) return "NOT_STARTED";
  if (["IN_PROGRESS", "PROCESSING"].includes(clean)) return "IN_PROGRESS";
  if (["FULFILLED", "DONE", "COMPLETED"].includes(clean)) return "FULFILLED";
  if (["FAILED"].includes(clean)) return "FAILED";
  if (["CANCELLED", "CANCELED"].includes(clean)) return "CANCELLED";

  return "UNKNOWN";
}

function normalizeOrder(item: unknown, index: number): OrderRow {
  const obj = asDict(item);
  const customerObj = asDict(obj.customer || obj.client);
  const productObj = asDict(obj.product || obj.program || obj.service);
  const providerObj = asDict(obj.provider || obj.center);
  const agentObj = asDict(obj.agent);
  const invoiceObj = asDict(obj.invoice);

  const totalAmount = toNumber(
    getNestedValue(obj, ["total_amount", "grand_total", "amount", "order_total"]),
  );

  const paidAmount = toNumber(
    getNestedValue(obj, ["paid_amount", "total_paid", "payments_total"]),
  );

  const remainingValue = getNestedValue(obj, [
    "remaining_amount",
    "balance_due",
    "outstanding_amount",
  ]);

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || `${index}`),
    order_number: String(
      getNestedValue(obj, ["order_number", "number", "code", "reference"]) || "-",
    ),
    customer_id: String(customerObj.id || getNestedValue(obj, ["customer_id"]) || ""),
    customer_name: String(
      customerObj.name ||
        customerObj.full_name ||
        getNestedValue(obj, ["customer_name", "client_name"]) ||
        "-",
    ),
    customer_phone: String(
      customerObj.phone ||
        customerObj.mobile ||
        getNestedValue(obj, ["customer_phone", "phone", "mobile"]) ||
        "",
    ),
    product_id: String(productObj.id || getNestedValue(obj, ["product_id"]) || ""),
    product_name: String(
      productObj.name ||
        productObj.title ||
        getNestedValue(obj, ["product_name", "program_name", "service_name"]) ||
        "-",
    ),
    provider_id: String(
      providerObj.id || getNestedValue(obj, ["provider_id", "center_id"]) || "",
    ),
    provider_name: String(
      providerObj.name ||
        providerObj.title ||
        getNestedValue(obj, ["provider_name", "center_name"]) ||
        "-",
    ),
    agent_id: String(agentObj.id || getNestedValue(obj, ["agent_id"]) || ""),
    agent_name: String(
      agentObj.name || getNestedValue(obj, ["agent_name"]) || "",
    ),
    invoice_id: String(invoiceObj.id || getNestedValue(obj, ["invoice_id"]) || ""),
    invoice_number: String(
      invoiceObj.invoice_number ||
        invoiceObj.number ||
        getNestedValue(obj, ["invoice_number"]) ||
        "",
    ),
    status: normalizeOrderStatus(getNestedValue(obj, ["status", "state"])),
    payment_status: normalizePaymentStatus(
      getNestedValue(obj, ["payment_status", "payment_state"]),
    ),
    fulfillment_status: normalizeFulfillmentStatus(
      getNestedValue(obj, ["fulfillment_status", "execution_status"]),
    ),
    total_amount: totalAmount,
    paid_amount: paidAmount,
    remaining_amount:
      remainingValue !== undefined && remainingValue !== null
        ? toNumber(remainingValue)
        : Math.max(totalAmount - paidAmount, 0),
    agent_commission: toNumber(
      getNestedValue(obj, ["agent_commission", "commission_amount"]),
    ),
    created_at: String(getNestedValue(obj, ["created_at", "created"]) || ""),
  };
}

function buildSummary(
  rows: OrderRow[],
  apiSummary?: Partial<OrdersSummary>,
): OrdersSummary {
  const fallback: OrdersSummary = {
    total_orders: rows.length,
    pending_orders: rows.filter((item) => item.status === "PENDING").length,
    confirmed_orders: rows.filter((item) => item.status === "CONFIRMED").length,
    processing_orders: rows.filter((item) => item.status === "PROCESSING").length,
    completed_orders: rows.filter((item) => item.status === "COMPLETED").length,
    cancelled_orders: rows.filter((item) => item.status === "CANCELLED").length,
    refunded_orders: rows.filter((item) => item.status === "REFUNDED").length,
    paid_orders: rows.filter((item) => item.payment_status === "PAID").length,
    unpaid_orders: rows.filter((item) => item.payment_status === "UNPAID").length,
    partial_orders: rows.filter((item) => item.payment_status === "PARTIAL").length,
    fulfilled_orders: rows.filter((item) => item.fulfillment_status === "FULFILLED")
      .length,
    total_amount: rows.reduce((sum, item) => sum + item.total_amount, 0),
    paid_amount: rows.reduce((sum, item) => sum + item.paid_amount, 0),
    remaining_amount: rows.reduce((sum, item) => sum + item.remaining_amount, 0),
    agent_commission: rows.reduce((sum, item) => sum + item.agent_commission, 0),
  };

  const api = asDict(apiSummary);

  return {
    total_orders:
      toNumber(api.total_orders) || toNumber(api.orders_count) || fallback.total_orders,
    pending_orders: toNumber(api.pending_orders) || fallback.pending_orders,
    confirmed_orders: toNumber(api.confirmed_orders) || fallback.confirmed_orders,
    processing_orders: toNumber(api.processing_orders) || fallback.processing_orders,
    completed_orders: toNumber(api.completed_orders) || fallback.completed_orders,
    cancelled_orders: toNumber(api.cancelled_orders) || fallback.cancelled_orders,
    refunded_orders: toNumber(api.refunded_orders) || fallback.refunded_orders,
    paid_orders: toNumber(api.paid_orders) || fallback.paid_orders,
    unpaid_orders: toNumber(api.unpaid_orders) || fallback.unpaid_orders,
    partial_orders: toNumber(api.partial_orders) || fallback.partial_orders,
    fulfilled_orders: toNumber(api.fulfilled_orders) || fallback.fulfilled_orders,
    total_amount: toNumber(api.total_amount) || fallback.total_amount,
    paid_amount: toNumber(api.paid_amount) || fallback.paid_amount,
    remaining_amount: toNumber(api.remaining_amount) || fallback.remaining_amount,
    agent_commission: toNumber(api.agent_commission) || fallback.agent_commission,
  };
}

function orderStatusLabel(status: OrderStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<OrderStatus, string> = {
    PENDING: t.pending,
    CONFIRMED: t.confirmed,
    PROCESSING: t.processing,
    COMPLETED: t.completed,
    CANCELLED: t.cancelled,
    REFUNDED: t.refunded,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function paymentStatusLabel(status: PaymentStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<PaymentStatus, string> = {
    UNPAID: t.unpaid,
    PARTIAL: t.partial,
    PAID: t.paid,
    REFUNDED: t.refunded,
    CANCELLED: t.cancelled,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function fulfillmentStatusLabel(status: FulfillmentStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<FulfillmentStatus, string> = {
    NOT_STARTED: t.notStarted,
    IN_PROGRESS: t.inProgress,
    FULFILLED: t.fulfilled,
    FAILED: t.failed,
    CANCELLED: t.cancelled,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function orderStatusBadge(status: OrderStatus, locale: AppLocale) {
  const label = orderStatusLabel(status, locale);

  if (status === "COMPLETED" || status === "CONFIRMED") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (status === "PENDING" || status === "PROCESSING") {
    return (
      <Badge className="rounded-full border-amber-200 bg-amber-50 px-3 py-1 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
        {label}
      </Badge>
    );
  }

  if (status === "CANCELLED" || status === "REFUNDED") {
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

function paymentStatusBadge(status: PaymentStatus, locale: AppLocale) {
  const label = paymentStatusLabel(status, locale);

  if (status === "PAID") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (status === "PARTIAL" || status === "UNPAID") {
    return (
      <Badge className="rounded-full border-amber-200 bg-amber-50 px-3 py-1 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
        {label}
      </Badge>
    );
  }

  if (status === "CANCELLED" || status === "REFUNDED") {
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
  summary: OrdersSummary;
  rows: OrderRow[];
}) {
  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const align = isArabic ? "right" : "left";
  const t = dictionary(locale);

  const rowsHtml = rows
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.order_number)}</td>
          <td>${escapeHtml(item.customer_name)}</td>
          <td>${escapeHtml(item.customer_phone || "-")}</td>
          <td>${escapeHtml(item.product_name || "-")}</td>
          <td>${escapeHtml(item.provider_name || "-")}</td>
          <td>${escapeHtml(orderStatusLabel(item.status, locale))}</td>
          <td>${escapeHtml(paymentStatusLabel(item.payment_status, locale))}</td>
          <td>${escapeHtml(formatMoney(item.total_amount))}</td>
          <td>${escapeHtml(formatMoney(item.paid_amount))}</td>
          <td>${escapeHtml(formatMoney(item.remaining_amount))}</td>
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
          <tr><td class="title" colspan="11">${escapeHtml(title)}</td></tr>
          <tr><td colspan="11"></td></tr>
          <tr><td class="section" colspan="11">${escapeHtml(t.generatedAt)}: ${escapeHtml(new Date().toLocaleString("en-US"))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalOrders)}</td><td colspan="10">${escapeHtml(formatNumber(summary.total_orders))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.completedOrders)}</td><td colspan="10">${escapeHtml(formatNumber(summary.completed_orders))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalAmount)}</td><td colspan="10">${escapeHtml(formatMoney(summary.total_amount))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.paidAmount)}</td><td colspan="10">${escapeHtml(formatMoney(summary.paid_amount))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.remainingAmount)}</td><td colspan="10">${escapeHtml(formatMoney(summary.remaining_amount))}</td></tr>

          <tr><td colspan="11"></td></tr>
          <tr>
            <th>${escapeHtml(t.table.order)}</th>
            <th>${escapeHtml(t.table.customer)}</th>
            <th>${escapeHtml("Phone")}</th>
            <th>${escapeHtml(t.table.product)}</th>
            <th>${escapeHtml(t.table.provider)}</th>
            <th>${escapeHtml(t.table.status)}</th>
            <th>${escapeHtml(t.table.payment)}</th>
            <th>${escapeHtml(t.table.total)}</th>
            <th>${escapeHtml(t.table.paid)}</th>
            <th>${escapeHtml(t.table.remaining)}</th>
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
  summary: OrdersSummary;
  rows: OrderRow[];
}) {
  const isArabic = locale === "ar";
  const t = dictionary(locale);

  const tableRows = rows
    .slice(0, 40)
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.order_number)}</td>
          <td>${escapeHtml(item.customer_name)}</td>
          <td>${escapeHtml(item.product_name)}</td>
          <td>${escapeHtml(orderStatusLabel(item.status, locale))}</td>
          <td>${escapeHtml(paymentStatusLabel(item.payment_status, locale))}</td>
          <td>${escapeHtml(formatMoney(item.total_amount))}</td>
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
          <div class="box"><span>${escapeHtml(t.totalOrders)}</span><strong>${escapeHtml(formatNumber(summary.total_orders))}</strong></div>
          <div class="box"><span>${escapeHtml(t.completedOrders)}</span><strong>${escapeHtml(formatNumber(summary.completed_orders))}</strong></div>
          <div class="box"><span>${escapeHtml(t.paidAmount)}</span><strong>${escapeHtml(formatMoney(summary.paid_amount))}</strong></div>
          <div class="box"><span>${escapeHtml(t.remainingAmount)}</span><strong>${escapeHtml(formatMoney(summary.remaining_amount))}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>${escapeHtml(t.table.order)}</th>
              <th>${escapeHtml(t.table.customer)}</th>
              <th>${escapeHtml(t.table.product)}</th>
              <th>${escapeHtml(t.table.status)}</th>
              <th>${escapeHtml(t.table.payment)}</th>
              <th>${escapeHtml(t.table.total)}</th>
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

export default function SystemOrdersPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [summary, setSummary] = useState<OrdersSummary>(DEFAULT_SUMMARY);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canView = hasAnyPermission(auth, ["orders.view", "orders.list"], "view");
  const canCreate = hasAnyPermission(auth, ["orders.create"], "action");
  const canExport = hasAnyPermission(
    auth,
    ["orders.export", "reports.export"],
    "action",
  );
  const canPrint = hasAnyPermission(
    auth,
    ["orders.print", "reports.print"],
    "action",
  );
  const canViewDetails = hasAnyPermission(auth, ["orders.view"], "view");

  const filteredRows = useMemo(() => {
    const clean = query.trim().toLowerCase();

    const sorted = [...rows].sort((a, b) =>
      String(b.created_at).localeCompare(String(a.created_at)),
    );

    if (!clean) return sorted.slice(0, 12);

    return sorted
      .filter((item) =>
        [
          item.order_number,
          item.customer_name,
          item.customer_phone,
          item.product_name,
          item.provider_name,
          item.agent_name,
          item.invoice_number,
          orderStatusLabel(item.status, locale),
          paymentStatusLabel(item.payment_status, locale),
          fulfillmentStatusLabel(item.fulfillment_status, locale),
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

  const loadOrders = useCallback(
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
          "/api/orders/list/?page_size=500",
          "/api/orders/?page_size=500",
        ]);

        if (!payload) {
          throw new Error(t.loadError);
        }

        const normalizedRows = extractRows(payload, "orders")
          .map(normalizeOrder)
          .filter((item) => item.id || item.order_number);

        setRows(normalizedRows);
        setSummary(buildSummary(normalizedRows, extractSummary(payload)));

        if (showToast) toast.success(t.loadSuccess);
      } catch (error) {
        console.error("Orders overview load error:", error);
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
      filename: `primey-care-orders-${new Date().toISOString().slice(0, 10)}.xls`,
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
    loadOrders(false);
  }, [authResolving, loadOrders]);

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
            onClick={() => loadOrders(true)}
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
              onClick={() => loadOrders(true)}
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
              title={t.totalOrders}
              value={formatNumber(displaySummary.total_orders)}
              icon={<ShoppingCart className="h-5 w-5" />}
            />
            <KpiCard
              title={t.completedOrders}
              value={formatNumber(displaySummary.completed_orders)}
              icon={<BadgeCheck className="h-5 w-5" />}
            />
            <KpiCard
              title={t.paidAmount}
              value={<MoneyText value={displaySummary.paid_amount} />}
              icon={<WalletCards className="h-5 w-5" />}
            />
            <KpiCard
              title={t.remainingAmount}
              value={<MoneyText value={displaySummary.remaining_amount} />}
              icon={<TimerReset className="h-5 w-5" />}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MiniStat title={t.pendingOrders} value={displaySummary.pending_orders} />
            <MiniStat
              title={t.processingOrders}
              value={displaySummary.processing_orders}
            />
            <MiniStat title={t.paidOrders} value={displaySummary.paid_orders} />
            <MiniStat title={t.fulfilledOrders} value={displaySummary.fulfilled_orders} />
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
                <Link href="/system/orders/list">
                  <Card className="h-full rounded-2xl border bg-background/70 shadow-sm transition hover:bg-muted/40">
                    <CardContent className="flex h-full items-start gap-3 p-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <FileText className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <p className="font-semibold">{t.ordersList}</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {isArabic
                            ? "عرض الطلبات مع البحث والفلاتر والإجراءات."
                            : "Open orders with search, filters, and actions."}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                {canCreate ? (
                  <Link href="/system/orders/create">
                    <Card className="h-full rounded-2xl border bg-background/70 shadow-sm transition hover:bg-muted/40">
                      <CardContent className="flex h-full items-start gap-3 p-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <PlusCircle className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                          <p className="font-semibold">{t.createOrder}</p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {isArabic
                              ? "إنشاء طلب جديد وربطه بالعميل والمنتج."
                              : "Create a new order and link it to customer and product."}
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
                <ShoppingCart className="h-12 w-12 text-muted-foreground/40" />
                <p className="text-lg font-semibold">{t.emptyTitle}</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  {t.emptyText}
                </p>

                {canCreate ? (
                  <Link href="/system/orders/create">
                    <Button className="mt-2 rounded-xl">
                      <PlusCircle className="h-4 w-4" />
                      {t.createOrder}
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

                <Link href="/system/orders/list">
                  <Button variant="outline" className="h-10 rounded-xl">
                    <ArrowUpRight className="h-4 w-4" />
                    {t.ordersList}
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
                        <TableHead className="min-w-[150px]">
                          {t.table.order}
                        </TableHead>
                        <TableHead className="min-w-[220px]">
                          {t.table.customer}
                        </TableHead>
                        <TableHead className="min-w-[180px]">
                          {t.table.product}
                        </TableHead>
                        <TableHead className="min-w-[160px]">
                          {t.table.provider}
                        </TableHead>
                        <TableHead className="min-w-[130px]">
                          {t.table.status}
                        </TableHead>
                        <TableHead className="min-w-[120px]">
                          {t.table.payment}
                        </TableHead>
                        <TableHead className="min-w-[130px]">
                          {t.table.fulfillment}
                        </TableHead>
                        <TableHead className="min-w-[130px]">
                          {t.table.total}
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
                          <TableRow key={`${item.id}-${item.order_number}`}>
                            <TableCell className="font-semibold" dir="ltr">
                              {item.order_number}
                            </TableCell>

                            <TableCell>
                              <div className="min-w-[200px]">
                                <p className="font-semibold">{item.customer_name}</p>
                                <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                                  {item.customer_phone || "-"}
                                </p>
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="min-w-[160px]">
                                <p className="font-medium">{item.product_name}</p>
                                {item.invoice_number ? (
                                  <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                                    {item.invoice_number}
                                  </p>
                                ) : null}
                              </div>
                            </TableCell>

                            <TableCell>{item.provider_name || "-"}</TableCell>
                            <TableCell>{orderStatusBadge(item.status, locale)}</TableCell>
                            <TableCell>{paymentStatusBadge(item.payment_status, locale)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="rounded-full">
                                {fulfillmentStatusLabel(item.fulfillment_status, locale)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <MoneyText value={item.total_amount} />
                            </TableCell>
                            <TableCell>
                              {formatDate(item.created_at, locale)}
                            </TableCell>

                            {canViewDetails ? (
                              <TableCell>
                                {isValidId(item.id) ? (
                                  <Link href={`/system/orders/${item.id}`}>
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

  console.warn("Orders endpoint fallback failed:", lastError);
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