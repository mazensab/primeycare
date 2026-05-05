"use client";

/* ============================================================
   📂 app/system/orders/page.tsx
   🧠 Primey Care | Orders Dashboard
   ------------------------------------------------------------
   ✅ المسار: /system/orders
   ✅ الإصدار: v2.0.0 - Centers Pattern + Safe Permissions

   ✅ العمل:
      لوحة تشغيلية مختصرة لإدارة الطلبات ودورة الطلب.

   ✅ Backend:
      GET /api/orders/?page_size=100

   ✅ المعيار:
      - مبني بصريًا على نمط المراكز والعملاء المعتمد.
      - دمج UX Refinement مع حماية المرحلة 2.
      - لا يتم إظهار مسارات تقنية أو API داخل الواجهة.
      - لا توجد روابط تقارير داخل الوحدة.
      - لا توجد أزرار وهمية.
      - إخفاء الأزرار غير المصرح بها بدل تعطيلها.
      - عدم كسر system_admin / superadmin.
      - منع طلب البيانات فقط عند وجود منع صريح لصلاحية العرض.
      - Error State مستقل عن Empty State.
      - Skeleton Loading.
      - Empty State ذكي.
      - البحث في صف مستقل.
      - الفلاتر في صف مستقل تحت البحث.
      - Excel بصيغة .xls HTML Workbook.
      - Web PDF Print.
      - استخدام /currency/sar.svg.
      - الأرقام بالإنجليزية.
      - دعم عربي / إنجليزي عبر primey-locale.
      - استخدام sonner للتنبيهات.
      - بدون localhost hardcoded.
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  ClipboardList,
  CreditCard,
  Download,
  Eye,
  FileText,
  Layers3,
  ListChecks,
  Loader2,
  Package,
  Plus,
  Printer,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingCart,
  UserRound,
  Users,
  Wallet,
  XCircle,
  type LucideIcon,
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
type AuthRecord = Record<string, unknown>;

type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "completed"
  | "cancelled"
  | "refunded"
  | "UNKNOWN";

type PaymentStatus =
  | "unpaid"
  | "partial"
  | "paid"
  | "refunded"
  | "cancelled"
  | "UNKNOWN";

type FulfillmentStatus =
  | "not_started"
  | "in_progress"
  | "fulfilled"
  | "failed"
  | "cancelled"
  | "UNKNOWN";

type StatusFilter = "all" | OrderStatus;
type PaymentFilter = "all" | PaymentStatus;

type Order = {
  id: number | string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  productName: string;
  providerName: string;
  agentName: string;
  contractCode: string;
  invoiceNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  agentCommission: number;
  createdAt: string;
  updatedAt: string;
  raw: Record<string, unknown>;
};

type OrdersApiResponse = {
  ok?: boolean;
  message?: string;
  count?: number;
  results?: unknown[];
  orders?: unknown[];
  items?: unknown[];
  data?:
    | unknown[]
    | {
        results?: unknown[];
        orders?: unknown[];
        items?: unknown[];
      };
  stats?: Record<string, unknown>;
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
        [
          "system_admin",
          "superuser",
          "super_admin",
          "support",
          "accountant",
          "viewer",
        ].includes(role),
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

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const clean = String(value ?? "")
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(clean);

  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeOrderStatus(value: unknown): OrderStatus {
  const status = String(value || "").toLowerCase();

  if (status === "pending") return "pending";
  if (status === "confirmed") return "confirmed";
  if (status === "processing") return "processing";
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  if (status === "refunded") return "refunded";

  return "UNKNOWN";
}

function normalizePaymentStatus(value: unknown): PaymentStatus {
  const status = String(value || "").toLowerCase();

  if (status === "unpaid") return "unpaid";
  if (status === "partial") return "partial";
  if (status === "paid") return "paid";
  if (status === "refunded") return "refunded";
  if (status === "cancelled") return "cancelled";

  return "UNKNOWN";
}

function normalizeFulfillmentStatus(value: unknown): FulfillmentStatus {
  const status = String(value || "").toLowerCase();

  if (status === "not_started") return "not_started";
  if (status === "in_progress") return "in_progress";
  if (status === "fulfilled") return "fulfilled";
  if (status === "failed") return "failed";
  if (status === "cancelled") return "cancelled";

  return "UNKNOWN";
}

function getObjectValue(obj: Record<string, unknown>, key: string): unknown {
  const direct = obj[key];

  if (direct !== undefined && direct !== null && direct !== "") {
    return direct;
  }

  const containers = [
    "order",
    "customer",
    "product",
    "provider",
    "center",
    "agent",
    "invoice",
    "contract",
    "summary",
    "totals",
  ];

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

function extractOrders(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== "object") return [];

  const response = payload as OrdersApiResponse;

  if (Array.isArray(response.results)) return response.results;
  if (Array.isArray(response.orders)) return response.orders;
  if (Array.isArray(response.items)) return response.items;
  if (Array.isArray(response.data)) return response.data;

  if (response.data && typeof response.data === "object") {
    if (Array.isArray(response.data.results)) return response.data.results;
    if (Array.isArray(response.data.orders)) return response.data.orders;
    if (Array.isArray(response.data.items)) return response.data.items;
  }

  return [];
}

function normalizeOrder(item: unknown): Order {
  const obj = (item || {}) as Record<string, unknown>;

  const id = getObjectValue(obj, "id") ?? "";
  const orderNumber =
    getObjectValue(obj, "order_number") ??
    getObjectValue(obj, "number") ??
    getObjectValue(obj, "reference") ??
    (id ? `ORD-${id}` : "-");

  const customer = obj.customer as Record<string, unknown> | undefined;
  const product = obj.product as Record<string, unknown> | undefined;
  const provider = (obj.provider || obj.center) as Record<string, unknown> | undefined;
  const agent = obj.agent as Record<string, unknown> | undefined;
  const invoice = obj.invoice as Record<string, unknown> | undefined;
  const contract = obj.contract as Record<string, unknown> | undefined;

  const totalAmount = toNumber(
    getObjectValue(obj, "total_amount") ??
      getObjectValue(obj, "amount") ??
      getObjectValue(obj, "final_amount") ??
      getObjectValue(obj, "grand_total") ??
      0,
  );

  const paidAmount = toNumber(
    getObjectValue(obj, "paid_amount") ??
      getObjectValue(obj, "amount_paid") ??
      0,
  );

  return {
    id: id as number | string,
    orderNumber: String(orderNumber || "-"),
    customerName: String(
      getObjectValue(obj, "customer_name") ??
        customer?.name ??
        customer?.full_name ??
        "-",
    ),
    customerPhone: String(
      getObjectValue(obj, "customer_phone") ??
        customer?.phone ??
        customer?.mobile ??
        "",
    ),
    productName: String(
      getObjectValue(obj, "product_name") ??
        product?.name ??
        product?.title ??
        "-",
    ),
    providerName: String(
      getObjectValue(obj, "provider_name") ??
        getObjectValue(obj, "center_name") ??
        provider?.name ??
        "-",
    ),
    agentName: String(
      getObjectValue(obj, "agent_name") ??
        agent?.name ??
        agent?.full_name ??
        "-",
    ),
    contractCode: String(
      getObjectValue(obj, "contract_code") ??
        contract?.code ??
        contract?.contract_number ??
        "",
    ),
    invoiceNumber: String(
      getObjectValue(obj, "invoice_number") ??
        invoice?.invoice_number ??
        invoice?.number ??
        "",
    ),
    status: normalizeOrderStatus(getObjectValue(obj, "status")),
    paymentStatus: normalizePaymentStatus(
      getObjectValue(obj, "payment_status"),
    ),
    fulfillmentStatus: normalizeFulfillmentStatus(
      getObjectValue(obj, "fulfillment_status") ??
        getObjectValue(obj, "implementation_status"),
    ),
    totalAmount,
    paidAmount,
    remainingAmount: toNumber(
      getObjectValue(obj, "remaining_amount") ??
        getObjectValue(obj, "balance_due") ??
        Math.max(totalAmount - paidAmount, 0),
    ),
    agentCommission: toNumber(
      getObjectValue(obj, "agent_commission") ??
        getObjectValue(obj, "commission_amount") ??
        0,
    ),
    createdAt: String(getObjectValue(obj, "created_at") ?? ""),
    updatedAt: String(getObjectValue(obj, "updated_at") ?? ""),
    raw: obj,
  };
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    pageTitle: isArabic ? "إدارة الطلبات" : "Orders Management",
    pageSubtitle: isArabic
      ? "متابعة دورة الطلبات، العملاء، المنتجات، المراكز، الفواتير، والمدفوعات."
      : "Monitor order lifecycle, customers, products, providers, invoices, and payments.",

    createOrder: isArabic ? "إنشاء طلب" : "Create Order",
    ordersList: isArabic ? "قائمة الطلبات" : "Orders List",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",

    searchPlaceholder: isArabic
      ? "ابحث برقم الطلب أو العميل أو المنتج أو المركز أو المندوب..."
      : "Search by order number, customer, product, provider, or agent...",

    all: isArabic ? "الكل" : "All",
    allStatuses: isArabic ? "كل الحالات" : "All Statuses",
    allPayments: isArabic ? "كل حالات الدفع" : "All Payments",

    pending: isArabic ? "معلق" : "Pending",
    confirmed: isArabic ? "مؤكد" : "Confirmed",
    processing: isArabic ? "قيد التنفيذ" : "Processing",
    completed: isArabic ? "مكتمل" : "Completed",
    cancelled: isArabic ? "ملغي" : "Cancelled",
    refunded: isArabic ? "مسترد" : "Refunded",
    unknown: isArabic ? "غير محدد" : "Unknown",

    unpaid: isArabic ? "غير مدفوع" : "Unpaid",
    partial: isArabic ? "مدفوع جزئيًا" : "Partial",
    paid: isArabic ? "مدفوع" : "Paid",

    notStarted: isArabic ? "لم يبدأ" : "Not Started",
    inProgress: isArabic ? "قيد التنفيذ" : "In Progress",
    fulfilled: isArabic ? "منفذ" : "Fulfilled",
    failed: isArabic ? "فشل" : "Failed",

    totalOrders: isArabic ? "إجمالي الطلبات" : "Total Orders",
    completedOrders: isArabic ? "الطلبات المكتملة" : "Completed Orders",
    totalRevenue: isArabic ? "قيمة الطلبات" : "Orders Value",
    unpaidBalance: isArabic ? "الرصيد المتبقي" : "Unpaid Balance",

    latestOrders: isArabic ? "آخر الطلبات" : "Latest Orders",
    latestOrdersDesc: isArabic
      ? "عرض مختصر لأحدث الطلبات حسب الفلاتر الحالية."
      : "A compact view of the latest orders based on current filters.",

    lifecycleTitle: isArabic ? "حالة دورة الطلب" : "Order Lifecycle Status",
    lifecycleDesc: isArabic
      ? "تحليل سريع لحالات الطلبات والدفع والتنفيذ."
      : "Quick analysis of order, payment, and fulfillment statuses.",

    quickAccessTitle: isArabic ? "إجراءات وحدة الطلبات" : "Orders Module Actions",
    quickAccessSubtitle: isArabic
      ? "اختصارات منظمة للوصول إلى أهم صفحات وحدة الطلبات."
      : "Organized shortcuts to key orders module pages.",
    actionListTitle: isArabic ? "قائمة الطلبات" : "Orders List",
    actionListDesc: isArabic
      ? "استعراض جميع الطلبات، البحث، الفلترة، وإدارة السجلات."
      : "Browse all orders, search, filter, and manage records.",
    actionCreateTitle: isArabic ? "إنشاء طلب" : "Create Order",
    actionCreateDesc: isArabic
      ? "إنشاء طلب جديد وربطه بالعميل والمنتج والمركز والمندوب."
      : "Create a new order and link it with customer, product, provider, and agent.",
    open: isArabic ? "فتح" : "Open",
    manage: isArabic ? "إدارة" : "Manage",
    viewFullList: isArabic ? "عرض القائمة الكاملة" : "View Full List",

    table: {
      order: isArabic ? "الطلب" : "Order",
      customer: isArabic ? "العميل" : "Customer",
      product: isArabic ? "المنتج" : "Product",
      provider: isArabic ? "المركز" : "Provider",
      agent: isArabic ? "المندوب" : "Agent",
      amount: isArabic ? "المبلغ" : "Amount",
      payment: isArabic ? "الدفع" : "Payment",
      status: isArabic ? "الحالة" : "Status",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      action: isArabic ? "الإجراء" : "Action",
    },

    emptyTitle: isArabic ? "لا توجد طلبات بعد" : "No orders yet",
    emptyText: isArabic
      ? "عند إنشاء طلبات جديدة ستظهر بياناتها هنا مباشرة."
      : "New orders will appear here once they are created.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير كلمات البحث أو فلاتر الحالة والدفع."
      : "Try changing search keywords, status filters, or payment filters.",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الصفحة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض بيانات الطلبات. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view orders data. Contact your system administrator if you need access.",

    apiError: isArabic
      ? "تعذر تحميل بيانات الطلبات."
      : "Unable to load orders data.",
    apiErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    refreshSuccess: isArabic
      ? "تم تحديث بيانات الطلبات بنجاح."
      : "Orders data refreshed successfully.",
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

    export: {
      generatedAt: isArabic ? "تاريخ التصدير" : "Generated At",
      scope: isArabic ? "نطاق التقرير" : "Report Scope",
      currentData: isArabic ? "حسب الفلاتر الحالية" : "Current filtered data",
      search: isArabic ? "البحث" : "Search",
      status: isArabic ? "فلتر الحالة" : "Status Filter",
      payment: isArabic ? "فلتر الدفع" : "Payment Filter",
    },

    showing: isArabic ? "عرض" : "Showing",
    from: isArabic ? "من" : "of",
    latestRecords: isArabic ? "آخر السجلات" : "Latest records",
    printedAt: isArabic ? "تاريخ الطباعة" : "Printed At",
    rowsCount: isArabic ? "عدد السجلات" : "Rows Count",
    printTitle: isArabic ? "لوحة الطلبات" : "Orders Dashboard",
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

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

function isValidOrderId(id: Order["id"]) {
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

function orderStatusLabel(status: OrderStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<OrderStatus, string> = {
    pending: t.pending,
    confirmed: t.confirmed,
    processing: t.processing,
    completed: t.completed,
    cancelled: t.cancelled,
    refunded: t.refunded,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function paymentStatusLabel(status: PaymentStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<PaymentStatus, string> = {
    unpaid: t.unpaid,
    partial: t.partial,
    paid: t.paid,
    refunded: t.refunded,
    cancelled: t.cancelled,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function orderStatusBadge(status: OrderStatus, locale: AppLocale) {
  const label = orderStatusLabel(status, locale);

  if (status === "completed") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (status === "confirmed" || status === "processing") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
        {label}
      </Badge>
    );
  }

  if (status === "pending") {
    return (
      <Badge className="rounded-full border-orange-200 bg-orange-50 px-3 py-1 text-orange-700 hover:bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300">
        {label}
      </Badge>
    );
  }

  if (status === "cancelled" || status === "refunded") {
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

function paymentStatusBadge(status: PaymentStatus, locale: AppLocale) {
  const label = paymentStatusLabel(status, locale);

  if (status === "paid") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (status === "partial") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
        {label}
      </Badge>
    );
  }

  if (status === "unpaid") {
    return (
      <Badge className="rounded-full border-orange-200 bg-orange-50 px-3 py-1 text-orange-700 hover:bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300">
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

/* ============================================================
   Skeleton
============================================================ */

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function SummaryCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <SkeletonLine className="h-7 w-20" />
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
      ))}
    </div>
  );
}

function StatusCardsSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="space-y-3 rounded-xl border bg-background/70 p-3"
        >
          <SkeletonLine className="h-7 w-14" />
          <SkeletonLine className="h-4 w-20" />
          <SkeletonLine className="h-2 w-full" />
        </div>
      ))}
    </div>
  );
}

function TableRowsSkeleton({ columnsCount }: { columnsCount: number }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columnsCount }).map((__, columnIndex) => (
            <TableCell key={columnIndex}>
              <SkeletonLine
                className={
                  columnIndex === 1
                    ? "h-9 w-52 rounded-lg"
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
  rows: Order[];
  t: ReturnType<typeof dictionary>;
}) {
  const isArabic = locale === "ar";
  const now = new Date().toLocaleString("en-US");

  const tableRows = rows
    .map(
      (order, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(order.orderNumber || "-")}</td>
          <td>${escapeHtml(order.customerName || "-")}</td>
          <td>${escapeHtml(order.productName || "-")}</td>
          <td>${escapeHtml(order.providerName || "-")}</td>
          <td>${escapeHtml(formatMoney(order.totalAmount))}</td>
          <td>${escapeHtml(paymentStatusLabel(order.paymentStatus, locale))}</td>
          <td>${escapeHtml(orderStatusLabel(order.status, locale))}</td>
          <td>${escapeHtml(formatDate(order.createdAt))}</td>
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
              <th>${escapeHtml(t.table.order)}</th>
              <th>${escapeHtml(t.table.customer)}</th>
              <th>${escapeHtml(t.table.product)}</th>
              <th>${escapeHtml(t.table.provider)}</th>
              <th>${escapeHtml(t.table.amount)}</th>
              <th>${escapeHtml(t.table.payment)}</th>
              <th>${escapeHtml(t.table.status)}</th>
              <th>${escapeHtml(t.table.createdAt)}</th>
            </tr>
          </thead>
          <tbody>
            ${
              tableRows ||
              `<tr><td colspan="9" style="text-align:center">${escapeHtml(t.emptyTitle)}</td></tr>`
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

export default function SystemOrdersPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [errorMessage, setErrorMessage] = useState("");

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const authResolving = isAuthResolving(auth);

  const canViewOrders = hasSafePermission(
    auth,
    ["orders.view", "orders.list"],
    "view",
  );

  const canCreateOrders = hasSafePermission(
    auth,
    ["orders.create"],
    "action",
  );

  const canExportOrders = hasSafePermission(
    auth,
    ["orders.export", "reports.export"],
    "action",
  );

  const canPrintOrders = hasSafePermission(
    auth,
    ["orders.print", "reports.print"],
    "action",
  );

  const canViewOrderDetails = hasSafePermission(
    auth,
    ["orders.view", "orders.detail"],
    "view",
  );

  const stats = useMemo(() => {
    const total = orders.length;
    const completed = orders.filter((item) => item.status === "completed").length;
    const pending = orders.filter((item) => item.status === "pending").length;
    const confirmed = orders.filter((item) => item.status === "confirmed").length;
    const processing = orders.filter((item) => item.status === "processing").length;
    const cancelled = orders.filter((item) => item.status === "cancelled").length;
    const refunded = orders.filter((item) => item.status === "refunded").length;
    const paid = orders.filter((item) => item.paymentStatus === "paid").length;
    const partial = orders.filter((item) => item.paymentStatus === "partial").length;
    const unpaid = orders.filter((item) => item.paymentStatus === "unpaid").length;

    const totalRevenue = orders.reduce((sum, item) => sum + item.totalAmount, 0);
    const paidAmount = orders.reduce((sum, item) => sum + item.paidAmount, 0);
    const unpaidBalance = orders.reduce(
      (sum, item) => sum + item.remainingAmount,
      0,
    );

    return {
      total,
      completed,
      pending,
      confirmed,
      processing,
      cancelled,
      refunded,
      paid,
      partial,
      unpaid,
      totalRevenue,
      paidAmount,
      unpaidBalance,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === "all" ? true : order.status === statusFilter;

      const matchesPayment =
        paymentFilter === "all" ? true : order.paymentStatus === paymentFilter;

      const matchesQuery = !cleanQuery
        ? true
        : [
            order.orderNumber,
            order.customerName,
            order.customerPhone,
            order.productName,
            order.providerName,
            order.agentName,
            order.contractCode,
            order.invoiceNumber,
            order.status,
            order.paymentStatus,
            order.fulfillmentStatus,
            orderStatusLabel(order.status, locale),
            paymentStatusLabel(order.paymentStatus, locale),
          ]
            .join(" ")
            .toLowerCase()
            .includes(cleanQuery);

      return matchesStatus && matchesPayment && matchesQuery;
    });
  }, [locale, orders, paymentFilter, query, statusFilter]);

  const latestOrders = useMemo(
    () =>
      [...filteredOrders]
        .sort((a, b) => {
          const first = new Date(a.createdAt || a.updatedAt || 0).getTime();
          const second = new Date(b.createdAt || b.updatedAt || 0).getTime();

          return second - first;
        })
        .slice(0, 8),
    [filteredOrders],
  );

  const hasSearchOrFilter =
    query.trim().length > 0 ||
    statusFilter !== "all" ||
    paymentFilter !== "all";

  const statusFilters = useMemo(
    () => [
      { value: "all" as StatusFilter, label: t.allStatuses, count: orders.length },
      { value: "pending" as StatusFilter, label: t.pending, count: stats.pending },
      {
        value: "confirmed" as StatusFilter,
        label: t.confirmed,
        count: stats.confirmed,
      },
      {
        value: "processing" as StatusFilter,
        label: t.processing,
        count: stats.processing,
      },
      {
        value: "completed" as StatusFilter,
        label: t.completed,
        count: stats.completed,
      },
      {
        value: "cancelled" as StatusFilter,
        label: t.cancelled,
        count: stats.cancelled,
      },
    ],
    [orders.length, stats, t],
  );

  const paymentFilters = useMemo(
    () => [
      { value: "all" as PaymentFilter, label: t.allPayments, count: orders.length },
      { value: "paid" as PaymentFilter, label: t.paid, count: stats.paid },
      { value: "partial" as PaymentFilter, label: t.partial, count: stats.partial },
      { value: "unpaid" as PaymentFilter, label: t.unpaid, count: stats.unpaid },
      {
        value: "refunded" as PaymentFilter,
        label: t.refunded,
        count: orders.filter((item) => item.paymentStatus === "refunded").length,
      },
    ],
    [orders, stats, t],
  );

  const summaryCards = useMemo(
    () => [
      {
        title: t.totalOrders,
        value: stats.total,
        icon: ShoppingCart,
        helper: t.completedOrders,
        helperValue: formatNumber(stats.completed),
        percent: stats.total > 0 ? 100 : 0,
        isMoney: false,
      },
      {
        title: t.completedOrders,
        value: stats.completed,
        icon: BadgeCheck,
        helper: t.totalOrders,
        helperValue: `${percent(stats.completed, stats.total)}%`,
        percent: percent(stats.completed, stats.total),
        isMoney: false,
      },
      {
        title: t.totalRevenue,
        value: stats.totalRevenue,
        icon: Wallet,
        helper: t.paid,
        helperValue: formatMoney(stats.paidAmount),
        percent: stats.totalRevenue
          ? percent(stats.paidAmount, stats.totalRevenue)
          : 0,
        isMoney: true,
      },
      {
        title: t.unpaidBalance,
        value: stats.unpaidBalance,
        icon: CreditCard,
        helper: t.unpaid,
        helperValue: formatNumber(stats.unpaid),
        percent: stats.totalRevenue
          ? percent(stats.unpaidBalance, stats.totalRevenue)
          : 0,
        isMoney: true,
      },
    ],
    [stats, t],
  );

  const lifecycleCards = useMemo(
    () => [
      {
        title: t.pending,
        value: stats.pending,
        icon: CalendarClock,
        percent: percent(stats.pending, stats.total),
        filter: "pending" as StatusFilter,
      },
      {
        title: t.confirmed,
        value: stats.confirmed,
        icon: ShieldCheck,
        percent: percent(stats.confirmed, stats.total),
        filter: "confirmed" as StatusFilter,
      },
      {
        title: t.processing,
        value: stats.processing,
        icon: RotateCcw,
        percent: percent(stats.processing, stats.total),
        filter: "processing" as StatusFilter,
      },
      {
        title: t.completed,
        value: stats.completed,
        icon: BadgeCheck,
        percent: percent(stats.completed, stats.total),
        filter: "completed" as StatusFilter,
      },
      {
        title: t.cancelled,
        value: stats.cancelled,
        icon: XCircle,
        percent: percent(stats.cancelled, stats.total),
        filter: "cancelled" as StatusFilter,
      },
      {
        title: t.refunded,
        value: stats.refunded,
        icon: CreditCard,
        percent: percent(stats.refunded, stats.total),
        filter: "refunded" as StatusFilter,
      },
    ],
    [stats, t],
  );

  const moduleActions = useMemo(
    () =>
      [
        canViewOrders
          ? {
              title: t.actionListTitle,
              description: t.actionListDesc,
              href: "/system/orders/list",
              icon: ListChecks,
              badge: `${formatNumber(stats.total)}`,
              cta: t.manage,
            }
          : null,
        canCreateOrders
          ? {
              title: t.actionCreateTitle,
              description: t.actionCreateDesc,
              href: "/system/orders/create",
              icon: Plus,
              badge: isArabic ? "جديد" : "New",
              cta: t.open,
            }
          : null,
      ].filter(Boolean) as Array<{
        title: string;
        description: string;
        href: string;
        icon: LucideIcon;
        badge: string;
        cta: string;
      }>,
    [canCreateOrders, canViewOrders, isArabic, stats.total, t],
  );

  const loadOrders = useCallback(
    async (showToast = false) => {
      if (!canViewOrders) {
        setIsLoading(false);
        setOrders([]);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");

        const response = await fetch(apiUrl("/api/orders/?page_size=100"), {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        const payload = (await response.json().catch(() => null)) as
          | OrdersApiResponse
          | null;

        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.message || `HTTP ${response.status}`);
        }

        setOrders(extractOrders(payload).map(normalizeOrder));

        if (showToast) {
          toast.success(t.refreshSuccess);
        }
      } catch (error) {
        console.error("Failed to load orders:", error);
        setOrders([]);
        setErrorMessage(t.apiError);
        toast.error(t.apiError);
      } finally {
        setIsLoading(false);
      }
    },
    [canViewOrders, t.apiError, t.refreshSuccess],
  );

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
    setPaymentFilter("all");
  }

  function exportOrders() {
    if (!canExportOrders) return;

    if (filteredOrders.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const generatedAt = new Date();

    const statusFilterLabel =
      statusFilters.find((item) => item.value === statusFilter)?.label || t.all;

    const paymentFilterLabel =
      paymentFilters.find((item) => item.value === paymentFilter)?.label || t.all;

    downloadExcel({
      filename: `primey-care-orders-dashboard-${generatedAt
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "لوحة الطلبات" : "Orders Dashboard",
      title: t.pageTitle,
      locale,
      summaryRows: [
        [t.export.generatedAt, generatedAt.toLocaleString("en-US")],
        [t.export.scope, t.export.currentData],
        [
          t.table.order,
          `${formatNumber(filteredOrders.length)} / ${formatNumber(
            orders.length,
          )}`,
        ],
        [t.totalOrders, stats.total],
        [t.completedOrders, stats.completed],
        [t.totalRevenue, formatMoney(stats.totalRevenue)],
        [t.unpaidBalance, formatMoney(stats.unpaidBalance)],
      ],
      filterRows: [
        [t.export.search, query || t.all],
        [t.export.status, statusFilterLabel],
        [t.export.payment, paymentFilterLabel],
      ],
      headers: [
        t.table.order,
        t.table.customer,
        t.table.product,
        t.table.provider,
        t.table.agent,
        t.table.amount,
        t.table.payment,
        t.table.status,
        t.table.createdAt,
      ],
      rows: filteredOrders.map((order) => [
        order.orderNumber || "-",
        order.customerName || "-",
        order.productName || "-",
        order.providerName || "-",
        order.agentName || "-",
        formatMoney(order.totalAmount),
        paymentStatusLabel(order.paymentStatus, locale),
        orderStatusLabel(order.status, locale),
        formatDate(order.createdAt),
      ]),
    });

    toast.success(t.exportSuccess);
  }

  function printOrders() {
    if (!canPrintOrders) return;

    if (filteredOrders.length === 0) {
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
        rows: filteredOrders,
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
    loadOrders(false);
  }, [authResolving, loadOrders]);

  if (!authResolving && !canViewOrders) {
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

          {canExportOrders ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={exportOrders}
              disabled={
                isLoading ||
                filteredOrders.length === 0 ||
                Boolean(errorMessage)
              }
            >
              <Download className="h-4 w-4" />
              <span>{t.exportExcel}</span>
            </Button>
          ) : null}

          {canPrintOrders ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={printOrders}
              disabled={
                isLoading ||
                filteredOrders.length === 0 ||
                Boolean(errorMessage)
              }
            >
              <Printer className="h-4 w-4" />
              <span>{t.print}</span>
            </Button>
          ) : null}

          {canViewOrders ? (
            <Link href="/system/orders/list">
              <Button variant="outline" className="h-10 w-full rounded-xl sm:w-auto">
                <ListChecks className="h-4 w-4" />
                <span>{t.ordersList}</span>
              </Button>
            </Link>
          ) : null}

          {canCreateOrders ? (
            <Link href="/system/orders/create">
              <Button className="h-10 w-full rounded-xl sm:w-auto">
                <Plus className="h-4 w-4" />
                <span>{t.createOrder}</span>
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
              onClick={() => loadOrders(true)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!errorMessage ? (
        <>
          {/* Summary */}
          {isLoading ? (
            <SummaryCardsSkeleton />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((item) => {
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

                      <div className="mt-2 text-xs text-muted-foreground">
                        {item.helper}: {item.helperValue}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Lifecycle */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                {t.lifecycleTitle}
              </CardTitle>
              <CardDescription>{t.lifecycleDesc}</CardDescription>
            </CardHeader>

            <CardContent>
              {isLoading ? (
                <StatusCardsSkeleton />
              ) : (
                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                  {lifecycleCards.map((card) => {
                    const Icon = card.icon;

                    return (
                      <button
                        key={card.title}
                        type="button"
                        className="space-y-2 rounded-xl border bg-background/70 p-3 text-start transition hover:bg-muted/40"
                        onClick={() => setStatusFilter(card.filter)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-2xl font-bold">
                            {formatNumber(card.value)}
                          </p>
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm text-muted-foreground">
                              {card.title}
                            </p>
                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              {formatNumber(card.percent)}%
                            </span>
                          </div>

                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${card.percent}%` }}
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Orders Table */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="flex flex-col gap-3 pb-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-base font-bold">
                  {t.latestOrders}
                </CardTitle>
                <CardDescription className="mt-1 text-sm leading-6">
                  {t.latestOrdersDesc}
                </CardDescription>
              </div>

              {canViewOrders ? (
                <Link href="/system/orders/list">
                  <Button variant="outline" className="h-9 rounded-xl">
                    <ListChecks className="h-4 w-4" />
                    <span>{t.viewFullList}</span>
                  </Button>
                </Link>
              ) : null}
            </CardHeader>

            <CardContent className="space-y-4">
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
              <div className="grid gap-3">
                <div className="flex flex-wrap gap-2">
                  {statusFilters.map((item) => {
                    const isSelected = statusFilter === item.value;

                    return (
                      <Button
                        key={item.value}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        className="h-10 rounded-xl"
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

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    {paymentFilters.map((item) => {
                      const isSelected = paymentFilter === item.value;

                      return (
                        <Button
                          key={item.value}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          className="h-10 rounded-xl"
                          onClick={() => setPaymentFilter(item.value)}
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
                        <TableHead>{t.table.order}</TableHead>
                        <TableHead>{t.table.customer}</TableHead>
                        <TableHead>{t.table.product}</TableHead>
                        <TableHead>{t.table.provider}</TableHead>
                        <TableHead>{t.table.amount}</TableHead>
                        <TableHead>{t.table.payment}</TableHead>
                        <TableHead>{t.table.status}</TableHead>
                        <TableHead>{t.table.createdAt}</TableHead>
                        {canViewOrderDetails ? (
                          <TableHead>{t.table.action}</TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {isLoading ? (
                        <TableRowsSkeleton
                          columnsCount={canViewOrderDetails ? 9 : 8}
                        />
                      ) : latestOrders.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={canViewOrderDetails ? 9 : 8}
                            className="h-36 text-center"
                          >
                            <div className="mx-auto max-w-md space-y-2">
                              <p className="font-semibold">
                                {hasSearchOrFilter
                                  ? t.noResultsTitle
                                  : t.emptyTitle}
                              </p>
                              <p className="text-sm text-muted-foreground">
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
                      ) : (
                        latestOrders.map((order) => (
                          <TableRow key={`${order.id}-${order.orderNumber}`}>
                            <TableCell className="font-medium">
                              <div className="min-w-[140px]">
                                <p>{order.orderNumber || `#${order.id}`}</p>
                                {order.invoiceNumber ? (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {order.invoiceNumber}
                                  </p>
                                ) : null}
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="flex min-w-[180px] items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                                  <UserRound className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-medium">
                                    {order.customerName || "-"}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {order.customerPhone || "-"}
                                  </p>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="flex min-w-[180px] items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                                  <Package className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-medium">
                                    {order.productName || "-"}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {order.agentName || "-"}
                                  </p>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="min-w-[150px]">
                                <p className="truncate">{order.providerName || "-"}</p>
                                {order.contractCode ? (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {order.contractCode}
                                  </p>
                                ) : null}
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-semibold">
                                  <SarAmount value={order.totalAmount} />
                                </p>
                                {order.remainingAmount > 0 ? (
                                  <p className="text-xs text-muted-foreground">
                                    <SarAmount value={order.remainingAmount} />
                                  </p>
                                ) : null}
                              </div>
                            </TableCell>

                            <TableCell>
                              {paymentStatusBadge(order.paymentStatus, locale)}
                            </TableCell>

                            <TableCell>
                              {orderStatusBadge(order.status, locale)}
                            </TableCell>

                            <TableCell>{formatDate(order.createdAt)}</TableCell>

                            {canViewOrderDetails ? (
                              <TableCell>
                                {isValidOrderId(order.id) ? (
                                  <Link href={`/system/orders/${order.id}`}>
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

              <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <p>
                  {t.showing} {formatNumber(latestOrders.length)} {t.from}{" "}
                  {formatNumber(filteredOrders.length)} · {t.latestRecords}
                </p>

                {canViewOrders ? (
                  <Link href="/system/orders/list">
                    <Button variant="outline" size="sm" className="rounded-xl">
                      <ListChecks className="h-4 w-4" />
                      {t.viewFullList}
                    </Button>
                  </Link>
                ) : null}
              </div>
            </CardContent>
          </Card>

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

                                <Badge
                                  variant="secondary"
                                  className="rounded-full"
                                >
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