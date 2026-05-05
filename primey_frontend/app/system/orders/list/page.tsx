"use client";

/* ============================================================
   📂 app/system/orders/list/page.tsx
   🧠 Primey Care | Orders List
   ------------------------------------------------------------
   ✅ المرحلة 17 + المرحلة 2
   ✅ مبني بنفس نمط قائمة المراكز/العملاء المعتمد
   ✅ البحث في صف مستقل
   ✅ الفلاتر والأعمدة في صف مستقل تحت البحث
   ✅ Excel export بصيغة .xls HTML Workbook
   ✅ Web PDF Print
   ✅ Error State مستقل
   ✅ Empty State ذكي
   ✅ Loading Skeleton
   ✅ حماية روابط التفاصيل والأزرار والطلبات
   ✅ fallback آمن لـ system_admin / superadmin
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ استخدام toast من sonner
   ✅ استخدام رمز SAR الرسمي /currency/sar.svg
   ✅ بدون localhost hardcoded
   ✅ الأرقام تبقى بالإنجليزية
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  ColumnsIcon,
  CreditCard,
  Download,
  Eye,
  FileText,
  Loader2,
  MoreHorizontal,
  Package,
  PlusCircle,
  Printer,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingCart,
  UserRound,
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
type FulfillmentFilter = "all" | FulfillmentStatus;

type SortKey =
  | "orderNumber"
  | "customerName"
  | "productName"
  | "providerName"
  | "agentName"
  | "status"
  | "paymentStatus"
  | "totalAmount"
  | "createdAt";

type SortDirection = "asc" | "desc";

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
};

type VisibleColumns = {
  order: boolean;
  customer: boolean;
  product: boolean;
  provider: boolean;
  agent: boolean;
  amount: boolean;
  payment: boolean;
  fulfillment: boolean;
  status: boolean;
  createdAt: boolean;
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
  const provider = (obj.provider || obj.center) as
    | Record<string, unknown>
    | undefined;
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
    title: isArabic ? "قائمة الطلبات" : "Orders List",
    subtitle: isArabic
      ? "إدارة الطلبات مع البحث والفلاتر والأعمدة والفرز والتصدير."
      : "Manage orders with search, filters, columns, sorting, and export.",

    back: isArabic ? "لوحة الطلبات" : "Orders Overview",
    createOrder: isArabic ? "إنشاء طلب" : "Create Order",
    refresh: isArabic ? "تحديث" : "Refresh",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",
    columns: isArabic ? "الأعمدة" : "Columns",

    tableTitle: isArabic ? "بيانات الطلبات" : "Orders Data",
    tableSubtitle: isArabic
      ? "استعرض الطلبات، رتّب البيانات، وخصص الأعمدة حسب احتياجك."
      : "Browse orders, sort data, and customize columns as needed.",

    searchPlaceholder: isArabic
      ? "ابحث برقم الطلب أو العميل أو المنتج أو المركز أو المندوب..."
      : "Search by order number, customer, product, provider, or agent...",

    all: isArabic ? "الكل" : "All",
    allStatuses: isArabic ? "كل الحالات" : "All Statuses",
    allPayments: isArabic ? "كل حالات الدفع" : "All Payments",
    allFulfillment: isArabic ? "كل حالات التنفيذ" : "All Fulfillment",

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
    ordersValue: isArabic ? "قيمة الطلبات" : "Orders Value",
    remainingAmount: isArabic ? "الرصيد المتبقي" : "Remaining Amount",

    selectedRows: isArabic ? "صفوف محددة" : "row(s) selected",
    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",
    page: isArabic ? "صفحة" : "Page",
    from: isArabic ? "من" : "of",

    emptyTitle: isArabic ? "لا توجد طلبات بعد" : "No orders yet",
    emptyText: isArabic
      ? "عند إنشاء طلبات جديدة ستظهر بياناتها هنا مباشرة."
      : "New orders will appear here once they are created.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير كلمات البحث أو فلاتر الحالة والدفع والتنفيذ."
      : "Try changing search keywords, status, payment, or fulfillment filters.",

    actions: isArabic ? "الإجراءات" : "Actions",
    viewDetails: isArabic ? "عرض التفاصيل" : "View Details",
    copyOrder: isArabic ? "نسخ رقم الطلب" : "Copy Order Number",
    copyId: isArabic ? "نسخ المعرف" : "Copy ID",
    copied: isArabic ? "تم النسخ بنجاح" : "Copied successfully",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الصفحة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض بيانات الطلبات. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view orders data. Contact your system administrator if you need access.",

    loadError: isArabic
      ? "تعذر تحميل قائمة الطلبات."
      : "Unable to load orders list.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    refreshSuccess: isArabic
      ? "تم تحديث قائمة الطلبات بنجاح."
      : "Orders list refreshed successfully.",
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
    filterPayment: isArabic ? "فلتر الدفع" : "Payment Filter",
    filterFulfillment: isArabic ? "فلتر التنفيذ" : "Fulfillment Filter",

    table: {
      id: isArabic ? "المعرف" : "ID",
      order: isArabic ? "الطلب" : "Order",
      customer: isArabic ? "العميل" : "Customer",
      product: isArabic ? "المنتج" : "Product",
      provider: isArabic ? "المركز" : "Provider",
      agent: isArabic ? "المندوب" : "Agent",
      amount: isArabic ? "المبلغ" : "Amount",
      paidAmount: isArabic ? "المدفوع" : "Paid Amount",
      remainingAmount: isArabic ? "المتبقي" : "Remaining",
      commission: isArabic ? "عمولة المندوب" : "Agent Commission",
      payment: isArabic ? "الدفع" : "Payment",
      fulfillment: isArabic ? "التنفيذ" : "Fulfillment",
      status: isArabic ? "الحالة" : "Status",
      invoice: isArabic ? "الفاتورة" : "Invoice",
      contract: isArabic ? "العقد" : "Contract",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      updatedAt: isArabic ? "آخر تحديث" : "Updated",
      actions: isArabic ? "الإجراء" : "Action",
    },

    printTitle: isArabic ? "قائمة الطلبات" : "Orders List",
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

function fulfillmentStatusLabel(status: FulfillmentStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<FulfillmentStatus, string> = {
    not_started: t.notStarted,
    in_progress: t.inProgress,
    fulfilled: t.fulfilled,
    failed: t.failed,
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

function fulfillmentStatusBadge(status: FulfillmentStatus, locale: AppLocale) {
  const label = fulfillmentStatusLabel(status, locale);

  if (status === "fulfilled") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (status === "in_progress") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
        {label}
      </Badge>
    );
  }

  if (status === "failed" || status === "cancelled") {
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

function getColumnLabels(locale: AppLocale) {
  const t = dictionary(locale);

  return {
    order: t.table.order,
    customer: t.table.customer,
    product: t.table.product,
    provider: t.table.provider,
    agent: t.table.agent,
    amount: t.table.amount,
    payment: t.table.payment,
    fulfillment: t.table.fulfillment,
    status: t.table.status,
    createdAt: t.table.createdAt,
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
          <td>${escapeHtml(order.agentName || "-")}</td>
          <td>${escapeHtml(formatMoney(order.totalAmount))}</td>
          <td>${escapeHtml(paymentStatusLabel(order.paymentStatus, locale))}</td>
          <td>${escapeHtml(fulfillmentStatusLabel(order.fulfillmentStatus, locale))}</td>
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
              <th>${escapeHtml(t.table.agent)}</th>
              <th>${escapeHtml(t.table.amount)}</th>
              <th>${escapeHtml(t.table.payment)}</th>
              <th>${escapeHtml(t.table.fulfillment)}</th>
              <th>${escapeHtml(t.table.status)}</th>
              <th>${escapeHtml(t.table.createdAt)}</th>
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

export default function SystemOrdersListPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [fulfillmentFilter, setFulfillmentFilter] =
    useState<FulfillmentFilter>("all");

  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [pageIndex, setPageIndex] = useState(0);

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    order: true,
    customer: true,
    product: true,
    provider: true,
    agent: true,
    amount: true,
    payment: true,
    fulfillment: true,
    status: true,
    createdAt: true,
    actions: true,
  });

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

  const safeVisibleColumns = useMemo<VisibleColumns>(
    () => ({
      ...visibleColumns,
      actions: visibleColumns.actions && canViewOrderDetails,
    }),
    [canViewOrderDetails, visibleColumns],
  );

  const columnLabels = useMemo(() => getColumnLabels(locale), [locale]);

  const stats = useMemo(() => {
    const total = orders.length;
    const completed = orders.filter((item) => item.status === "completed").length;
    const totalAmount = orders.reduce((sum, item) => sum + item.totalAmount, 0);
    const remainingAmount = orders.reduce(
      (sum, item) => sum + item.remainingAmount,
      0,
    );

    return {
      total,
      completed,
      totalAmount,
      remainingAmount,
    };
  }, [orders]);

  const statusOptions = useMemo(
    () => [
      { value: "all" as StatusFilter, label: t.allStatuses, count: orders.length },
      {
        value: "pending" as StatusFilter,
        label: t.pending,
        count: orders.filter((item) => item.status === "pending").length,
      },
      {
        value: "confirmed" as StatusFilter,
        label: t.confirmed,
        count: orders.filter((item) => item.status === "confirmed").length,
      },
      {
        value: "processing" as StatusFilter,
        label: t.processing,
        count: orders.filter((item) => item.status === "processing").length,
      },
      {
        value: "completed" as StatusFilter,
        label: t.completed,
        count: orders.filter((item) => item.status === "completed").length,
      },
      {
        value: "cancelled" as StatusFilter,
        label: t.cancelled,
        count: orders.filter((item) => item.status === "cancelled").length,
      },
      {
        value: "refunded" as StatusFilter,
        label: t.refunded,
        count: orders.filter((item) => item.status === "refunded").length,
      },
    ],
    [orders, t],
  );

  const paymentOptions = useMemo(
    () => [
      { value: "all" as PaymentFilter, label: t.allPayments, count: orders.length },
      {
        value: "paid" as PaymentFilter,
        label: t.paid,
        count: orders.filter((item) => item.paymentStatus === "paid").length,
      },
      {
        value: "partial" as PaymentFilter,
        label: t.partial,
        count: orders.filter((item) => item.paymentStatus === "partial").length,
      },
      {
        value: "unpaid" as PaymentFilter,
        label: t.unpaid,
        count: orders.filter((item) => item.paymentStatus === "unpaid").length,
      },
      {
        value: "refunded" as PaymentFilter,
        label: t.refunded,
        count: orders.filter((item) => item.paymentStatus === "refunded").length,
      },
    ],
    [orders, t],
  );

  const fulfillmentOptions = useMemo(
    () => [
      { value: "all" as FulfillmentFilter, label: t.allFulfillment },
      { value: "not_started" as FulfillmentFilter, label: t.notStarted },
      { value: "in_progress" as FulfillmentFilter, label: t.inProgress },
      { value: "fulfilled" as FulfillmentFilter, label: t.fulfilled },
      { value: "failed" as FulfillmentFilter, label: t.failed },
      { value: "cancelled" as FulfillmentFilter, label: t.cancelled },
    ],
    [t],
  );

  const filteredOrders = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === "all" ? true : order.status === statusFilter;

      const matchesPayment =
        paymentFilter === "all" ? true : order.paymentStatus === paymentFilter;

      const matchesFulfillment =
        fulfillmentFilter === "all"
          ? true
          : order.fulfillmentStatus === fulfillmentFilter;

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
            fulfillmentStatusLabel(order.fulfillmentStatus, locale),
          ]
            .join(" ")
            .toLowerCase()
            .includes(cleanQuery);

      return (
        matchesStatus && matchesPayment && matchesFulfillment && matchesQuery
      );
    });
  }, [fulfillmentFilter, locale, orders, paymentFilter, query, statusFilter]);

  const sortedOrders = useMemo(() => {
    const rows = [...filteredOrders];

    rows.sort((firstOrder, secondOrder) => {
      let first: string | number = "";
      let second: string | number = "";

      if (sortKey === "orderNumber") {
        first = firstOrder.orderNumber.toLowerCase();
        second = secondOrder.orderNumber.toLowerCase();
      }

      if (sortKey === "customerName") {
        first = firstOrder.customerName.toLowerCase();
        second = secondOrder.customerName.toLowerCase();
      }

      if (sortKey === "productName") {
        first = firstOrder.productName.toLowerCase();
        second = secondOrder.productName.toLowerCase();
      }

      if (sortKey === "providerName") {
        first = firstOrder.providerName.toLowerCase();
        second = secondOrder.providerName.toLowerCase();
      }

      if (sortKey === "agentName") {
        first = firstOrder.agentName.toLowerCase();
        second = secondOrder.agentName.toLowerCase();
      }

      if (sortKey === "status") {
        first = firstOrder.status.toLowerCase();
        second = secondOrder.status.toLowerCase();
      }

      if (sortKey === "paymentStatus") {
        first = firstOrder.paymentStatus.toLowerCase();
        second = secondOrder.paymentStatus.toLowerCase();
      }

      if (sortKey === "totalAmount") {
        first = firstOrder.totalAmount;
        second = secondOrder.totalAmount;
      }

      if (sortKey === "createdAt") {
        first = new Date(firstOrder.createdAt || firstOrder.updatedAt || 0).getTime();
        second = new Date(secondOrder.createdAt || secondOrder.updatedAt || 0).getTime();
      }

      if (first < second) return sortDirection === "asc" ? -1 : 1;
      if (first > second) return sortDirection === "asc" ? 1 : -1;

      return 0;
    });

    return rows;
  }, [filteredOrders, sortDirection, sortKey]);

  const exportRows = useMemo(() => {
    if (selectedIds.length > 0) {
      return sortedOrders.filter((order) => selectedIds.includes(order.id));
    }

    return sortedOrders;
  }, [selectedIds, sortedOrders]);

  const pageCount = Math.max(1, Math.ceil(sortedOrders.length / PAGE_SIZE));

  const pageRows = useMemo(() => {
    const start = pageIndex * PAGE_SIZE;
    return sortedOrders.slice(start, start + PAGE_SIZE);
  }, [pageIndex, sortedOrders]);

  const selectedOnPage = pageRows.filter((row) =>
    selectedIds.includes(row.id),
  ).length;

  const allPageSelected =
    pageRows.length > 0 && selectedOnPage === pageRows.length;

  const hasSearchOrFilter =
    query.trim().length > 0 ||
    statusFilter !== "all" ||
    paymentFilter !== "all" ||
    fulfillmentFilter !== "all";

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
    setStatusFilter("all");
    setPaymentFilter("all");
    setFulfillmentFilter("all");
  }

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

        const response = await fetch(apiUrl("/api/orders/?page_size=200"), {
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
        console.error("Failed to load orders list:", error);
        setOrders([]);
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [canViewOrders, t.loadError, t.refreshSuccess],
  );

  function exportExcel() {
    if (!canExportOrders) return;

    if (exportRows.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const generatedAt = new Date();

    const statusLabelText =
      statusOptions.find((item) => item.value === statusFilter)?.label || t.all;

    const paymentLabelText =
      paymentOptions.find((item) => item.value === paymentFilter)?.label || t.all;

    const fulfillmentLabelText =
      fulfillmentOptions.find((item) => item.value === fulfillmentFilter)?.label ||
      t.all;

    downloadExcel({
      filename: `primey-care-orders-list-${generatedAt
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "قائمة الطلبات" : "Orders List",
      title: t.title,
      locale,
      summaryRows: [
        [t.generatedAt, generatedAt.toLocaleString("en-US")],
        [
          t.reportScope,
          selectedIds.length > 0 ? t.selectedScope : t.currentFilteredData,
        ],
        [
          t.table.order,
          `${formatNumber(exportRows.length)} / ${formatNumber(orders.length)}`,
        ],
        [t.totalOrders, stats.total],
        [t.completedOrders, stats.completed],
        [t.ordersValue, formatMoney(stats.totalAmount)],
        [t.remainingAmount, formatMoney(stats.remainingAmount)],
      ],
      filterRows: [
        [t.filterSearch, query || t.all],
        [t.filterStatus, statusLabelText],
        [t.filterPayment, paymentLabelText],
        [t.filterFulfillment, fulfillmentLabelText],
      ],
      headers: [
        t.table.id,
        t.table.order,
        t.table.customer,
        t.table.product,
        t.table.provider,
        t.table.agent,
        t.table.amount,
        t.table.paidAmount,
        t.table.remainingAmount,
        t.table.commission,
        t.table.payment,
        t.table.fulfillment,
        t.table.status,
        t.table.invoice,
        t.table.contract,
        t.table.createdAt,
        t.table.updatedAt,
      ],
      rows: exportRows.map((order) => [
        String(order.id || "-"),
        order.orderNumber || "-",
        order.customerName || "-",
        order.productName || "-",
        order.providerName || "-",
        order.agentName || "-",
        formatMoney(order.totalAmount),
        formatMoney(order.paidAmount),
        formatMoney(order.remainingAmount),
        formatMoney(order.agentCommission),
        paymentStatusLabel(order.paymentStatus, locale),
        fulfillmentStatusLabel(order.fulfillmentStatus, locale),
        orderStatusLabel(order.status, locale),
        order.invoiceNumber || "-",
        order.contractCode || "-",
        formatDate(order.createdAt),
        formatDate(order.updatedAt || order.createdAt),
      ]),
    });

    toast.success(t.exportSuccess);
  }

  function printList() {
    if (!canPrintOrders) return;

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
    loadOrders(false);
  }, [authResolving, loadOrders]);

  useEffect(() => {
    setPageIndex(0);
    setSelectedIds([]);
  }, [query, statusFilter, paymentFilter, fulfillmentFilter]);

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
          <Link href="/system/orders">
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
              onClick={exportExcel}
              disabled={
                isLoading || exportRows.length === 0 || Boolean(errorMessage)
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
              onClick={printList}
              disabled={
                isLoading || exportRows.length === 0 || Boolean(errorMessage)
              }
            >
              <Printer className="h-4 w-4" />
              <span>{t.print}</span>
            </Button>
          ) : null}

          {canCreateOrders ? (
            <Link href="/system/orders/create">
              <Button className="h-10 w-full rounded-xl sm:w-auto">
                <PlusCircle className="h-4 w-4" />
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
                    title: t.totalOrders,
                    value: stats.total,
                    percent: stats.total > 0 ? 100 : 0,
                    icon: ShoppingCart,
                    isMoney: false,
                  },
                  {
                    title: t.completedOrders,
                    value: stats.completed,
                    percent: percent(stats.completed, stats.total),
                    icon: BadgeCheck,
                    isMoney: false,
                  },
                  {
                    title: t.ordersValue,
                    value: stats.totalAmount,
                    percent: stats.totalAmount > 0 ? 100 : 0,
                    icon: Wallet,
                    isMoney: true,
                  },
                  {
                    title: t.remainingAmount,
                    value: stats.remainingAmount,
                    percent: percent(stats.remainingAmount, stats.totalAmount),
                    icon: CreditCard,
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

                    <div className="flex flex-wrap gap-2">
                      {paymentOptions.map((item) => (
                        <Button
                          key={item.value}
                          variant={
                            paymentFilter === item.value ? "default" : "outline"
                          }
                          className="h-10 rounded-xl"
                          onClick={() => setPaymentFilter(item.value)}
                        >
                          <span>{item.label}</span>
                          <Badge
                            variant={
                              paymentFilter === item.value ? "secondary" : "outline"
                            }
                            className="ms-1 rounded-full"
                          >
                            {formatNumber(item.count)}
                          </Badge>
                        </Button>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {fulfillmentOptions.map((item) => (
                        <Button
                          key={item.value}
                          variant={
                            fulfillmentFilter === item.value
                              ? "default"
                              : "outline"
                          }
                          className="h-10 rounded-xl"
                          onClick={() => setFulfillmentFilter(item.value)}
                        >
                          {item.label}
                        </Button>
                      ))}
                    </div>
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
                          if (key === "actions" && !canViewOrderDetails) {
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

                          {safeVisibleColumns.order ? (
                            <SortableHead
                              label={t.table.order}
                              onClick={() => toggleSort("orderNumber")}
                            />
                          ) : null}

                          {safeVisibleColumns.customer ? (
                            <SortableHead
                              label={t.table.customer}
                              onClick={() => toggleSort("customerName")}
                            />
                          ) : null}

                          {safeVisibleColumns.product ? (
                            <SortableHead
                              label={t.table.product}
                              onClick={() => toggleSort("productName")}
                            />
                          ) : null}

                          {safeVisibleColumns.provider ? (
                            <SortableHead
                              label={t.table.provider}
                              onClick={() => toggleSort("providerName")}
                            />
                          ) : null}

                          {safeVisibleColumns.agent ? (
                            <SortableHead
                              label={t.table.agent}
                              onClick={() => toggleSort("agentName")}
                            />
                          ) : null}

                          {safeVisibleColumns.amount ? (
                            <SortableHead
                              label={t.table.amount}
                              onClick={() => toggleSort("totalAmount")}
                            />
                          ) : null}

                          {safeVisibleColumns.payment ? (
                            <SortableHead
                              label={t.table.payment}
                              onClick={() => toggleSort("paymentStatus")}
                            />
                          ) : null}

                          {safeVisibleColumns.fulfillment ? (
                            <TableHead>{t.table.fulfillment}</TableHead>
                          ) : null}

                          {safeVisibleColumns.status ? (
                            <SortableHead
                              label={t.table.status}
                              onClick={() => toggleSort("status")}
                            />
                          ) : null}

                          {safeVisibleColumns.createdAt ? (
                            <SortableHead
                              label={t.table.createdAt}
                              onClick={() => toggleSort("createdAt")}
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
                          pageRows.map((order) => (
                            <TableRow
                              key={`${order.id}-${order.orderNumber}`}
                              data-state={
                                selectedIds.includes(order.id)
                                  ? "selected"
                                  : undefined
                              }
                            >
                              <TableCell>
                                <Checkbox
                                  checked={selectedIds.includes(order.id)}
                                  onCheckedChange={() => toggleRow(order.id)}
                                  aria-label="Select row"
                                />
                              </TableCell>

                              {safeVisibleColumns.order ? (
                                <TableCell className="font-medium">
                                  <div className="min-w-[150px]">
                                    <p>{order.orderNumber || `#${order.id}`}</p>
                                    {order.invoiceNumber ? (
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        {order.invoiceNumber}
                                      </p>
                                    ) : null}
                                  </div>
                                </TableCell>
                              ) : null}

                              {safeVisibleColumns.customer ? (
                                <TableCell>
                                  <div className="flex min-w-[200px] items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted">
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
                              ) : null}

                              {safeVisibleColumns.product ? (
                                <TableCell>
                                  <div className="flex min-w-[200px] items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted">
                                      <Package className="h-4 w-4" />
                                    </div>

                                    <div className="min-w-0">
                                      <p className="truncate font-medium">
                                        {order.productName || "-"}
                                      </p>
                                      <p className="truncate text-xs text-muted-foreground">
                                        {order.contractCode || "-"}
                                      </p>
                                    </div>
                                  </div>
                                </TableCell>
                              ) : null}

                              {safeVisibleColumns.provider ? (
                                <TableCell>
                                  <div className="min-w-[150px]">
                                    <p className="truncate">
                                      {order.providerName || "-"}
                                    </p>
                                  </div>
                                </TableCell>
                              ) : null}

                              {safeVisibleColumns.agent ? (
                                <TableCell>
                                  <div className="min-w-[130px]">
                                    <p className="truncate">
                                      {order.agentName || "-"}
                                    </p>
                                  </div>
                                </TableCell>
                              ) : null}

                              {safeVisibleColumns.amount ? (
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
                              ) : null}

                              {safeVisibleColumns.payment ? (
                                <TableCell>
                                  {paymentStatusBadge(order.paymentStatus, locale)}
                                </TableCell>
                              ) : null}

                              {safeVisibleColumns.fulfillment ? (
                                <TableCell>
                                  {fulfillmentStatusBadge(
                                    order.fulfillmentStatus,
                                    locale,
                                  )}
                                </TableCell>
                              ) : null}

                              {safeVisibleColumns.status ? (
                                <TableCell>
                                  {orderStatusBadge(order.status, locale)}
                                </TableCell>
                              ) : null}

                              {safeVisibleColumns.createdAt ? (
                                <TableCell>
                                  {formatDate(order.createdAt)}
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

                                      {isValidOrderId(order.id) ? (
                                        <DropdownMenuItem asChild>
                                          <Link href={`/system/orders/${order.id}`}>
                                            <Eye className="h-4 w-4" />
                                            {t.viewDetails}
                                          </Link>
                                        </DropdownMenuItem>
                                      ) : null}

                                      <DropdownMenuItem
                                        onClick={() => {
                                          navigator.clipboard.writeText(
                                            String(order.orderNumber || "-"),
                                          );
                                          toast.success(t.copied);
                                        }}
                                      >
                                        {t.copyOrder}
                                      </DropdownMenuItem>

                                      <DropdownMenuItem
                                        onClick={() => {
                                          navigator.clipboard.writeText(
                                            String(order.id || "-"),
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
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <div className="flex-1 text-sm text-muted-foreground">
                    {formatNumber(selectedIds.length)} /{" "}
                    {formatNumber(sortedOrders.length)} {t.selectedRows}
                  </div>

                  <div className="text-sm text-muted-foreground">
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