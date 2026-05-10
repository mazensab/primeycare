"use client";

/* ============================================================
   📂 app/system/reports/orders/page.tsx
   🧠 Primey Care | Orders Reports Page

   ✅ المسار:
      app/system/reports/orders/page.tsx

   ✅ العمل:
      صفحة تقرير الطلبات المركزية داخل وحدة التقارير.
      تعرض ملخص الطلبات وجدولًا تحليليًا قابلًا للبحث والتصفية والتصدير والطباعة.

   ✅ الإصدار:
      Phase 17 UX Refinement + Central Reports Orders Review

   ✅ يعتمد على:
      - /api/reports/orders/
      - /api/orders/ كـ fallback آمن عند عدم توفر تقرير مخصص
      - primey-locale
      - AuthProvider
      - sonner
      - /currency/sar.svg

   ✅ متوافق مع صفحات:
      - Centers approved UX pattern
      - Customers approved UX pattern
      - Central Reports module

   ✅ الوظائف:
      - عرض مؤشرات تقرير الطلبات.
      - تحليل الطلبات حسب حالة الطلب وحالة الدفع وحالة التنفيذ.
      - عرض القيم المالية: الإجمالي والمدفوع والمتبقي.
      - البحث في صف مستقل.
      - فلاتر حالة الطلب وحالة الدفع في صفوف منظمة.
      - جدول تحليلي للبيانات.
      - Excel export بصيغة .xls HTML Workbook.
      - Web PDF Print.
      - Skeleton Loading.
      - Error State مستقل.
      - Empty State ذكي.
      - إخفاء الإجراءات حسب الصلاحيات قدر الإمكان.

   ------------------------------------------------------------
   تحسينات هذا الإصدار:
      - توحيد الترويسة الداخلية حسب النمط المعتمد.
      - الحفاظ على التقارير داخل المسار المركزي فقط.
      - دعم fallback آمن للصلاحيات بدون كسر system_admin/superuser.
      - استخدام الرقم ثم رمز SAR عند عرض القيم المالية.
      - منع عرض أي مسارات تقنية أو عبارات API داخل واجهة المستخدم.
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  FileText,
  Loader2,
  PackageCheck,
  Printer,
  RefreshCcw,
  Search,
  ShoppingCart,
  UserRound,
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
  | "FAILED"
  | "UNKNOWN";

type FulfillmentStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "UNKNOWN";

type StatusFilter = "ALL" | OrderStatus;
type PaymentFilter = "ALL" | PaymentStatus;

type OrderReportRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  providerName: string;
  productName: string;
  agentName: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  invoiceId: string;
  invoiceNumber: string;
  createdAt: string;
  confirmedAt: string;
  completedAt: string;
  cancelledAt: string;
};

type OrdersReportSummary = {
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
  invoiced_orders: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
};

type OrdersReportResponse = {
  ok?: boolean;
  success?: boolean;
  message?: string;
  data?: {
    summary?: Partial<OrdersReportSummary>;
    results?: unknown[];
    orders?: unknown[];
    items?: unknown[];
    rows?: unknown[];
  };
  summary?: Partial<OrdersReportSummary>;
  results?: unknown[];
  orders?: unknown[];
  items?: unknown[];
  rows?: unknown[];
};

const SAR_ICON_PATH = "/currency/sar.svg";

const DEFAULT_SUMMARY: OrdersReportSummary = {
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
  invoiced_orders: 0,
  total_amount: 0,
  paid_amount: 0,
  remaining_amount: 0,
};

/* ============================================================
   Locale / API
============================================================ */

function readLocale(): AppLocale {
  try {
    if (typeof window === "undefined") return "ar";

    const saved = window.localStorage.getItem("primey-locale");

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
          "support",
          "accountant",
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
    title: isArabic ? "تقارير الطلبات" : "Orders Reports",
    subtitle: isArabic
      ? "تحليل الطلبات حسب الحالة والدفع والتنفيذ والعميل والمركز والمنتج والفاتورة."
      : "Analyze orders by status, payment, fulfillment, customer, provider, product, and invoice.",

    back: isArabic ? "مركز التقارير" : "Reports Center",
    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",
    viewDetails: isArabic ? "عرض التفاصيل" : "View Details",

    searchPlaceholder: isArabic
      ? "ابحث برقم الطلب أو العميل أو المركز أو المنتج أو المندوب أو الفاتورة..."
      : "Search by order number, customer, provider, product, agent, or invoice...",

    all: isArabic ? "الكل" : "All",
    allStatuses: isArabic ? "كل حالات الطلب" : "All Order Statuses",
    allPaymentStatuses: isArabic ? "كل حالات الدفع" : "All Payment Statuses",

    totalOrders: isArabic ? "إجمالي الطلبات" : "Total Orders",
    completedOrders: isArabic ? "طلبات مكتملة" : "Completed Orders",
    paidOrders: isArabic ? "طلبات مدفوعة" : "Paid Orders",
    totalAmount: isArabic ? "إجمالي قيمة الطلبات" : "Total Orders Value",
    paidAmount: isArabic ? "المدفوع" : "Paid Amount",
    remainingAmount: isArabic ? "المتبقي" : "Remaining Amount",

    pending: isArabic ? "قيد الانتظار" : "Pending",
    confirmed: isArabic ? "مؤكد" : "Confirmed",
    processing: isArabic ? "قيد التنفيذ" : "Processing",
    completed: isArabic ? "مكتمل" : "Completed",
    cancelled: isArabic ? "ملغي" : "Cancelled",
    refunded: isArabic ? "مسترد" : "Refunded",
    unknown: isArabic ? "غير محدد" : "Unknown",

    unpaid: isArabic ? "غير مدفوع" : "Unpaid",
    partial: isArabic ? "مدفوع جزئيًا" : "Partial",
    paid: isArabic ? "مدفوع" : "Paid",
    failed: isArabic ? "فشل الدفع" : "Failed",

    distributionTitle: isArabic ? "توزيع حالات الطلب" : "Order Status Distribution",
    distributionDesc: isArabic
      ? "تحليل سريع لحالات الطلبات."
      : "Quick analysis of order statuses.",

    paymentDistributionTitle: isArabic
      ? "توزيع حالات الدفع"
      : "Payment Status Distribution",
    paymentDistributionDesc: isArabic
      ? "تحليل سريع لحالات الدفع المرتبطة بالطلبات."
      : "Quick analysis of payment statuses linked to orders.",

    financialTitle: isArabic ? "المؤشرات المالية" : "Financial Indicators",
    financialDesc: isArabic
      ? "ملخص قيمة الطلبات والمدفوع والمتبقي."
      : "Summary of total order value, paid amount, and remaining amount.",

    tableTitle: isArabic ? "بيانات تقرير الطلبات" : "Orders Report Data",
    tableDesc: isArabic
      ? "جدول تحليلي للطلبات حسب الفلاتر الحالية."
      : "Analytical orders table based on current filters.",

    table: {
      order: isArabic ? "الطلب" : "Order",
      customer: isArabic ? "العميل" : "Customer",
      provider: isArabic ? "المركز" : "Provider",
      product: isArabic ? "المنتج / البرنامج" : "Product / Program",
      agent: isArabic ? "المندوب" : "Agent",
      status: isArabic ? "حالة الطلب" : "Order Status",
      paymentStatus: isArabic ? "حالة الدفع" : "Payment Status",
      fulfillmentStatus: isArabic ? "حالة التنفيذ" : "Fulfillment Status",
      totalAmount: isArabic ? "الإجمالي" : "Total",
      paidAmount: isArabic ? "المدفوع" : "Paid",
      remainingAmount: isArabic ? "المتبقي" : "Remaining",
      invoice: isArabic ? "الفاتورة" : "Invoice",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      completedAt: isArabic ? "تاريخ الإكمال" : "Completed At",
      action: isArabic ? "الإجراء" : "Action",
    },

    emptyTitle: isArabic ? "لا توجد بيانات طلبات" : "No orders data",
    emptyText: isArabic
      ? "ستظهر بيانات تقرير الطلبات هنا عند توفر سجلات."
      : "Orders report data will appear here when records are available.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير كلمات البحث أو فلاتر الحالة والدفع."
      : "Try changing search keywords, order status, or payment status.",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض التقرير" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض تقارير الطلبات. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view orders reports. Contact your system administrator if you need access.",

    apiError: isArabic
      ? "تعذر تحميل تقرير الطلبات."
      : "Unable to load orders report.",
    apiErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    refreshSuccess: isArabic
      ? "تم تحديث تقرير الطلبات بنجاح."
      : "Orders report refreshed successfully.",
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

    showing: isArabic ? "عرض" : "Showing",
    from: isArabic ? "من" : "of",
    generatedAt: isArabic ? "تاريخ التصدير" : "Generated At",
    reportScope: isArabic ? "نطاق التقرير" : "Report Scope",
    currentFilteredData: isArabic
      ? "حسب الفلاتر الحالية"
      : "Current filtered data",
    filterSearch: isArabic ? "البحث" : "Search",
    filterStatus: isArabic ? "فلتر حالة الطلب" : "Order Status Filter",
    filterPayment: isArabic ? "فلتر حالة الدفع" : "Payment Status Filter",
    printedAt: isArabic ? "تاريخ الطباعة" : "Printed At",
    rowsCount: isArabic ? "عدد السجلات" : "Rows Count",
    printTitle: isArabic ? "تقرير الطلبات" : "Orders Report",
  };
}

/* ============================================================
   Normalizers
============================================================ */

function toNumber(value: unknown): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeOrderStatus(value: unknown): OrderStatus {
  const status = String(value || "").toUpperCase();

  if (status === "PENDING") return "PENDING";
  if (status === "CONFIRMED" || status === "APPROVED") return "CONFIRMED";
  if (status === "PROCESSING" || status === "IN_PROGRESS") return "PROCESSING";
  if (status === "COMPLETED" || status === "DONE") return "COMPLETED";
  if (status === "CANCELLED" || status === "CANCELED") return "CANCELLED";
  if (status === "REFUNDED") return "REFUNDED";

  return "UNKNOWN";
}

function normalizePaymentStatus(value: unknown): PaymentStatus {
  const status = String(value || "").toUpperCase();

  if (status === "UNPAID" || status === "PENDING") return "UNPAID";
  if (status === "PARTIAL" || status === "PARTIALLY_PAID") return "PARTIAL";
  if (status === "PAID" || status === "CONFIRMED") return "PAID";
  if (status === "REFUNDED") return "REFUNDED";
  if (status === "FAILED") return "FAILED";

  return "UNKNOWN";
}

function normalizeFulfillmentStatus(value: unknown): FulfillmentStatus {
  const status = String(value || "").toUpperCase();

  if (status === "NOT_STARTED" || status === "PENDING") return "NOT_STARTED";
  if (status === "IN_PROGRESS" || status === "PROCESSING") return "IN_PROGRESS";
  if (status === "DELIVERED") return "DELIVERED";
  if (status === "COMPLETED" || status === "DONE") return "COMPLETED";
  if (status === "CANCELLED" || status === "CANCELED") return "CANCELLED";

  return "UNKNOWN";
}

function getValue(obj: Dict, key: string): unknown {
  const direct = obj[key];

  if (direct !== undefined && direct !== null && direct !== "") {
    return direct;
  }

  for (const container of [
    "order",
    "customer",
    "provider",
    "center",
    "product",
    "program",
    "agent",
    "invoice",
    "summary",
    "data",
    "item",
  ]) {
    const nested = obj[container];

    if (nested && typeof nested === "object") {
      const value = (nested as Dict)[key];

      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }
  }

  return undefined;
}

function extractRows(payload: OrdersReportResponse | null): unknown[] {
  if (!payload) return [];

  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.orders)) return payload.orders;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.rows)) return payload.rows;

  if (Array.isArray(payload.data?.results)) return payload.data.results;
  if (Array.isArray(payload.data?.orders)) return payload.data.orders;
  if (Array.isArray(payload.data?.items)) return payload.data.items;
  if (Array.isArray(payload.data?.rows)) return payload.data.rows;

  return [];
}

function extractSummary(
  payload: OrdersReportResponse | null,
): Partial<OrdersReportSummary> {
  return payload?.data?.summary || payload?.summary || {};
}

function normalizeOrder(item: unknown): OrderReportRow {
  const obj = asDict(item);

  const id = String(getValue(obj, "id") || "");
  const customer = asDict(obj.customer);
  const provider = asDict(obj.provider || obj.center);
  const product = asDict(obj.product || obj.program);
  const agent = asDict(obj.agent);
  const invoice = asDict(obj.invoice);

  const totalAmount =
    getValue(obj, "total_amount") ||
    getValue(obj, "grand_total") ||
    getValue(obj, "amount") ||
    0;

  const paidAmount =
    getValue(obj, "paid_amount") || getValue(obj, "total_paid") || 0;

  const remainingAmount =
    getValue(obj, "remaining_amount") ||
    getValue(obj, "balance_due") ||
    Math.max(0, toNumber(totalAmount) - toNumber(paidAmount));

  return {
    id,
    orderNumber: String(
      getValue(obj, "order_number") ||
        getValue(obj, "number") ||
        getValue(obj, "reference") ||
        getValue(obj, "issue_reference") ||
        id ||
        "-",
    ),
    customerName: String(
      getValue(obj, "customer_name") ||
        customer.full_name ||
        customer.name ||
        "-",
    ),
    customerPhone: String(
      getValue(obj, "customer_phone") ||
        customer.mobile ||
        customer.phone ||
        "",
    ),
    providerName: String(
      getValue(obj, "provider_name") ||
        getValue(obj, "center_name") ||
        provider.name ||
        "-",
    ),
    productName: String(
      getValue(obj, "product_name") ||
        getValue(obj, "program_name") ||
        product.name ||
        product.title ||
        "-",
    ),
    agentName: String(
      getValue(obj, "agent_name") || agent.name || agent.full_name || "-",
    ),
    status: normalizeOrderStatus(getValue(obj, "status")),
    paymentStatus: normalizePaymentStatus(
      getValue(obj, "payment_status") || getValue(obj, "payment_state"),
    ),
    fulfillmentStatus: normalizeFulfillmentStatus(
      getValue(obj, "fulfillment_status") || getValue(obj, "execution_status"),
    ),
    totalAmount: toNumber(totalAmount),
    paidAmount: toNumber(paidAmount),
    remainingAmount: toNumber(remainingAmount),
    invoiceId: String(invoice.id || getValue(obj, "invoice_id") || ""),
    invoiceNumber: String(
      invoice.number ||
        invoice.invoice_number ||
        getValue(obj, "invoice_number") ||
        "",
    ),
    createdAt: String(getValue(obj, "created_at") || ""),
    confirmedAt: String(getValue(obj, "confirmed_at") || ""),
    completedAt: String(getValue(obj, "completed_at") || ""),
    cancelledAt: String(getValue(obj, "cancelled_at") || ""),
  };
}

function normalizeSummary(
  rows: OrderReportRow[],
  summary?: Partial<OrdersReportSummary>,
): OrdersReportSummary {
  const fallback: OrdersReportSummary = {
    total_orders: rows.length,
    pending_orders: rows.filter((item) => item.status === "PENDING").length,
    confirmed_orders: rows.filter((item) => item.status === "CONFIRMED").length,
    processing_orders: rows.filter((item) => item.status === "PROCESSING").length,
    completed_orders: rows.filter((item) => item.status === "COMPLETED").length,
    cancelled_orders: rows.filter((item) => item.status === "CANCELLED").length,
    refunded_orders: rows.filter((item) => item.status === "REFUNDED").length,
    paid_orders: rows.filter((item) => item.paymentStatus === "PAID").length,
    unpaid_orders: rows.filter((item) => item.paymentStatus === "UNPAID").length,
    partial_orders: rows.filter((item) => item.paymentStatus === "PARTIAL")
      .length,
    invoiced_orders: rows.filter((item) => item.invoiceId || item.invoiceNumber)
      .length,
    total_amount: rows.reduce((sum, item) => sum + item.totalAmount, 0),
    paid_amount: rows.reduce((sum, item) => sum + item.paidAmount, 0),
    remaining_amount: rows.reduce((sum, item) => sum + item.remainingAmount, 0),
  };

  return {
    total_orders: toNumber(summary?.total_orders ?? fallback.total_orders),
    pending_orders: toNumber(summary?.pending_orders ?? fallback.pending_orders),
    confirmed_orders: toNumber(
      summary?.confirmed_orders ?? fallback.confirmed_orders,
    ),
    processing_orders: toNumber(
      summary?.processing_orders ?? fallback.processing_orders,
    ),
    completed_orders: toNumber(
      summary?.completed_orders ?? fallback.completed_orders,
    ),
    cancelled_orders: toNumber(
      summary?.cancelled_orders ?? fallback.cancelled_orders,
    ),
    refunded_orders: toNumber(
      summary?.refunded_orders ?? fallback.refunded_orders,
    ),
    paid_orders: toNumber(summary?.paid_orders ?? fallback.paid_orders),
    unpaid_orders: toNumber(summary?.unpaid_orders ?? fallback.unpaid_orders),
    partial_orders: toNumber(summary?.partial_orders ?? fallback.partial_orders),
    invoiced_orders: toNumber(
      summary?.invoiced_orders ?? fallback.invoiced_orders,
    ),
    total_amount: toNumber(summary?.total_amount ?? fallback.total_amount),
    paid_amount: toNumber(summary?.paid_amount ?? fallback.paid_amount),
    remaining_amount: toNumber(
      summary?.remaining_amount ?? fallback.remaining_amount,
    ),
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

function isValidId(id: unknown) {
  const value = String(id || "").trim();

  return value.length > 0 && value !== "-" && value !== "undefined";
}

function statusLabel(status: OrderStatus, locale: AppLocale) {
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

function paymentLabel(status: PaymentStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<PaymentStatus, string> = {
    UNPAID: t.unpaid,
    PARTIAL: t.partial,
    PAID: t.paid,
    REFUNDED: t.refunded,
    FAILED: t.failed,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function fulfillmentLabel(status: FulfillmentStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<FulfillmentStatus, string> = {
    NOT_STARTED: t.pending,
    IN_PROGRESS: t.processing,
    DELIVERED: t.confirmed,
    COMPLETED: t.completed,
    CANCELLED: t.cancelled,
    UNKNOWN: t.unknown,
  };

  return labels[status];
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

function MoneyText({ value }: { value: number | string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{formatMoney(value)}</span>
      <SarIcon className="h-3.5 w-3.5" />
    </span>
  );
}

function orderStatusBadge(status: OrderStatus, locale: AppLocale) {
  const label = statusLabel(status, locale);

  if (status === "COMPLETED" || status === "CONFIRMED") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (status === "PENDING" || status === "PROCESSING") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
        {label}
      </Badge>
    );
  }

  if (status === "CANCELLED" || status === "REFUNDED") {
    return (
      <Badge variant="destructive" className="rounded-full px-3 py-1">
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
  const label = paymentLabel(status, locale);

  if (status === "PAID") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (status === "PARTIAL") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
        {label}
      </Badge>
    );
  }

  if (status === "FAILED" || status === "REFUNDED") {
    return (
      <Badge variant="destructive" className="rounded-full px-3 py-1">
        {label}
      </Badge>
    );
  }

  if (status === "UNPAID") {
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
                <SkeletonLine className="h-4 w-32" />
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

function TableRowsSkeleton({ columnsCount }: { columnsCount: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columnsCount }).map((__, columnIndex) => (
            <TableCell key={columnIndex}>
              <SkeletonLine
                className={
                  columnIndex === 0
                    ? "h-10 w-56 rounded-lg"
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
  summaryRows,
  filterRows,
  headers,
  rows,
}: {
  filename: string;
  worksheetName: string;
  title: string;
  locale: AppLocale;
  summaryRows: Array<[string, string | number]>;
  filterRows: Array<[string, string | number]>;
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

  const filterHtml = filterRows
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
            ${locale === "ar" ? "ملخص التقرير" : "Report Summary"}
          </td></tr>
          ${summaryHtml}
          <tr><td colspan="${colspan}"></td></tr>
          <tr><td class="section" colspan="${colspan}">
            ${locale === "ar" ? "الفلاتر المستخدمة" : "Applied Filters"}
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
  rows: OrderReportRow[];
  summary: OrdersReportSummary;
  t: ReturnType<typeof dictionary>;
}) {
  const isArabic = locale === "ar";
  const now = new Date().toLocaleString("en-US");

  const tableRows = rows
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.orderNumber || "-")}</td>
          <td>${escapeHtml(item.customerName || "-")}</td>
          <td>${escapeHtml(item.providerName || "-")}</td>
          <td>${escapeHtml(item.productName || "-")}</td>
          <td>${escapeHtml(statusLabel(item.status, locale))}</td>
          <td>${escapeHtml(paymentLabel(item.paymentStatus, locale))}</td>
          <td>${escapeHtml(formatMoney(item.totalAmount))}</td>
          <td>${escapeHtml(formatMoney(item.paidAmount))}</td>
          <td>${escapeHtml(formatDate(item.createdAt))}</td>
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
          <div class="summary-card"><span>${escapeHtml(t.totalOrders)}</span><strong>${formatNumber(summary.total_orders)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.completedOrders)}</span><strong>${formatNumber(summary.completed_orders)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.paidOrders)}</span><strong>${formatNumber(summary.paid_orders)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.totalAmount)}</span><strong>${formatMoney(summary.total_amount)}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${escapeHtml(t.table.order)}</th>
              <th>${escapeHtml(t.table.customer)}</th>
              <th>${escapeHtml(t.table.provider)}</th>
              <th>${escapeHtml(t.table.product)}</th>
              <th>${escapeHtml(t.table.status)}</th>
              <th>${escapeHtml(t.table.paymentStatus)}</th>
              <th>${escapeHtml(t.table.totalAmount)}</th>
              <th>${escapeHtml(t.table.paidAmount)}</th>
              <th>${escapeHtml(t.table.createdAt)}</th>
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

export default function SystemOrdersReportsPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [rows, setRows] = useState<OrderReportRow[]>([]);
  const [summary, setSummary] = useState<OrdersReportSummary>(DEFAULT_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("ALL");

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canViewReport = hasSafePermission(
    auth,
    ["reports.view", "reports.orders.view", "orders.view"],
    "view",
  );

  const canViewOrderDetails = hasSafePermission(
    auth,
    ["orders.view", "orders.detail"],
    "view",
  );

  const canExportReport = hasSafePermission(
    auth,
    ["reports.export", "reports.orders.export", "orders.export"],
    "action",
  );

  const canPrintReport = hasSafePermission(
    auth,
    ["reports.print", "reports.orders.print"],
    "action",
  );

  const filteredRows = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return rows.filter((item) => {
      const matchesStatus =
        statusFilter === "ALL" ? true : item.status === statusFilter;

      const matchesPayment =
        paymentFilter === "ALL" ? true : item.paymentStatus === paymentFilter;

      const matchesQuery = !cleanQuery
        ? true
        : [
            item.orderNumber,
            item.customerName,
            item.customerPhone,
            item.providerName,
            item.productName,
            item.agentName,
            item.invoiceNumber,
            statusLabel(item.status, locale),
            paymentLabel(item.paymentStatus, locale),
            fulfillmentLabel(item.fulfillmentStatus, locale),
          ]
            .join(" ")
            .toLowerCase()
            .includes(cleanQuery);

      return matchesStatus && matchesPayment && matchesQuery;
    });
  }, [locale, paymentFilter, query, rows, statusFilter]);

  const filteredSummary = useMemo(
    () => normalizeSummary(filteredRows),
    [filteredRows],
  );

  const hasSearchOrFilter =
    query.trim().length > 0 ||
    statusFilter !== "ALL" ||
    paymentFilter !== "ALL";

  const statusOptions = useMemo(
    () => [
      { value: "ALL" as StatusFilter, label: t.allStatuses, count: rows.length },
      {
        value: "PENDING" as StatusFilter,
        label: t.pending,
        count: rows.filter((item) => item.status === "PENDING").length,
      },
      {
        value: "CONFIRMED" as StatusFilter,
        label: t.confirmed,
        count: rows.filter((item) => item.status === "CONFIRMED").length,
      },
      {
        value: "PROCESSING" as StatusFilter,
        label: t.processing,
        count: rows.filter((item) => item.status === "PROCESSING").length,
      },
      {
        value: "COMPLETED" as StatusFilter,
        label: t.completed,
        count: rows.filter((item) => item.status === "COMPLETED").length,
      },
      {
        value: "CANCELLED" as StatusFilter,
        label: t.cancelled,
        count: rows.filter((item) => item.status === "CANCELLED").length,
      },
    ],
    [rows, t],
  );

  const paymentOptions = useMemo(
    () => [
      {
        value: "ALL" as PaymentFilter,
        label: t.allPaymentStatuses,
        count: rows.length,
      },
      {
        value: "UNPAID" as PaymentFilter,
        label: t.unpaid,
        count: rows.filter((item) => item.paymentStatus === "UNPAID").length,
      },
      {
        value: "PARTIAL" as PaymentFilter,
        label: t.partial,
        count: rows.filter((item) => item.paymentStatus === "PARTIAL").length,
      },
      {
        value: "PAID" as PaymentFilter,
        label: t.paid,
        count: rows.filter((item) => item.paymentStatus === "PAID").length,
      },
      {
        value: "REFUNDED" as PaymentFilter,
        label: t.refunded,
        count: rows.filter((item) => item.paymentStatus === "REFUNDED").length,
      },
      {
        value: "FAILED" as PaymentFilter,
        label: t.failed,
        count: rows.filter((item) => item.paymentStatus === "FAILED").length,
      },
    ],
    [rows, t],
  );

  const summaryCards = useMemo(
    () => [
      {
        title: t.totalOrders,
        value: summary.total_orders,
        icon: ShoppingCart,
        helper: t.completedOrders,
        helperValue: formatNumber(summary.completed_orders),
        percent: summary.total_orders > 0 ? 100 : 0,
        isMoney: false,
      },
      {
        title: t.completedOrders,
        value: summary.completed_orders,
        icon: CheckCircle2,
        helper: t.totalOrders,
        helperValue: `${percent(
          summary.completed_orders,
          summary.total_orders,
        )}%`,
        percent: percent(summary.completed_orders, summary.total_orders),
        isMoney: false,
      },
      {
        title: t.paidOrders,
        value: summary.paid_orders,
        icon: CreditCard,
        helper: t.paidAmount,
        helperValue: formatMoney(summary.paid_amount),
        percent: percent(summary.paid_orders, summary.total_orders),
        isMoney: false,
      },
      {
        title: t.totalAmount,
        value: summary.total_amount,
        icon: Wallet,
        helper: t.remainingAmount,
        helperValue: formatMoney(summary.remaining_amount),
        percent: summary.total_amount > 0 ? 100 : 0,
        isMoney: true,
      },
    ],
    [summary, t],
  );

  const statusCards = useMemo(
    () => [
      {
        title: t.pending,
        value: summary.pending_orders,
        icon: ShoppingCart,
        filter: "PENDING" as StatusFilter,
        percent: percent(summary.pending_orders, summary.total_orders),
      },
      {
        title: t.processing,
        value: summary.processing_orders,
        icon: PackageCheck,
        filter: "PROCESSING" as StatusFilter,
        percent: percent(summary.processing_orders, summary.total_orders),
      },
      {
        title: t.completed,
        value: summary.completed_orders,
        icon: CheckCircle2,
        filter: "COMPLETED" as StatusFilter,
        percent: percent(summary.completed_orders, summary.total_orders),
      },
      {
        title: t.cancelled,
        value: summary.cancelled_orders,
        icon: XCircle,
        filter: "CANCELLED" as StatusFilter,
        percent: percent(summary.cancelled_orders, summary.total_orders),
      },
    ],
    [summary, t],
  );

  const paymentCards = useMemo(
    () => [
      {
        title: t.unpaid,
        value: summary.unpaid_orders,
        icon: Wallet,
        filter: "UNPAID" as PaymentFilter,
        percent: percent(summary.unpaid_orders, summary.total_orders),
      },
      {
        title: t.partial,
        value: summary.partial_orders,
        icon: CreditCard,
        filter: "PARTIAL" as PaymentFilter,
        percent: percent(summary.partial_orders, summary.total_orders),
      },
      {
        title: t.paid,
        value: summary.paid_orders,
        icon: CheckCircle2,
        filter: "PAID" as PaymentFilter,
        percent: percent(summary.paid_orders, summary.total_orders),
      },
      {
        title: t.refunded,
        value: summary.refunded_orders,
        icon: XCircle,
        filter: "REFUNDED" as PaymentFilter,
        percent: percent(summary.refunded_orders, summary.total_orders),
      },
    ],
    [summary, t],
  );

  const loadReport = useCallback(
    async (showToast = false) => {
      if (!canViewReport) {
        setIsLoading(false);
        setRows([]);
        setSummary(DEFAULT_SUMMARY);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");

        const endpoints = [
          "/api/reports/orders/",
          "/api/orders/?page_size=300",
        ];

        let loadedPayload: OrdersReportResponse | null = null;
        let loaded = false;

        for (const endpoint of endpoints) {
          const response = await fetch(apiUrl(endpoint), {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
          });

          const payload = (await response.json().catch(() => null)) as
            | OrdersReportResponse
            | null;

          if (response.status === 404 || response.status === 405) {
            loadedPayload = payload;
            continue;
          }

          if (
            !response.ok ||
            payload?.ok === false ||
            payload?.success === false
          ) {
            throw new Error(payload?.message || `HTTP ${response.status}`);
          }

          loadedPayload = payload;
          loaded = true;
          break;
        }

        if (!loaded) {
          throw new Error(
            loadedPayload?.message || "Unable to load orders report",
          );
        }

        const normalizedRows = extractRows(loadedPayload).map(normalizeOrder);

        setRows(normalizedRows);
        setSummary(
          normalizeSummary(normalizedRows, extractSummary(loadedPayload)),
        );

        if (showToast) {
          toast.success(t.refreshSuccess);
        }
      } catch (error) {
        console.error("Orders report load error:", error);
        setRows([]);
        setSummary(DEFAULT_SUMMARY);
        setErrorMessage(t.apiError);
        toast.error(t.apiError);
      } finally {
        setIsLoading(false);
      }
    },
    [canViewReport, t.apiError, t.refreshSuccess],
  );

  function clearFilters() {
    setQuery("");
    setStatusFilter("ALL");
    setPaymentFilter("ALL");
  }

  function exportExcel() {
    if (!canExportReport) return;

    if (filteredRows.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const generatedAt = new Date();

    const statusFilterLabel =
      statusOptions.find((item) => item.value === statusFilter)?.label || t.all;

    const paymentFilterLabel =
      paymentOptions.find((item) => item.value === paymentFilter)?.label ||
      t.all;

    downloadExcel({
      filename: `primey-care-orders-report-${generatedAt
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "تقرير الطلبات" : "Orders Report",
      title: t.title,
      locale,
      summaryRows: [
        [t.generatedAt, generatedAt.toLocaleString("en-US")],
        [t.reportScope, t.currentFilteredData],
        [t.totalOrders, filteredSummary.total_orders],
        [t.completedOrders, filteredSummary.completed_orders],
        [t.paidOrders, filteredSummary.paid_orders],
        [t.totalAmount, formatMoney(filteredSummary.total_amount)],
        [t.paidAmount, formatMoney(filteredSummary.paid_amount)],
        [t.remainingAmount, formatMoney(filteredSummary.remaining_amount)],
      ],
      filterRows: [
        [t.filterSearch, query || t.all],
        [t.filterStatus, statusFilterLabel],
        [t.filterPayment, paymentFilterLabel],
      ],
      headers: [
        "ID",
        t.table.order,
        t.table.customer,
        t.table.provider,
        t.table.product,
        t.table.agent,
        t.table.status,
        t.table.paymentStatus,
        t.table.fulfillmentStatus,
        t.table.totalAmount,
        t.table.paidAmount,
        t.table.remainingAmount,
        t.table.invoice,
        t.table.createdAt,
        t.table.completedAt,
      ],
      rows: filteredRows.map((item) => [
        item.id || "-",
        item.orderNumber || "-",
        item.customerName || "-",
        item.providerName || "-",
        item.productName || "-",
        item.agentName || "-",
        statusLabel(item.status, locale),
        paymentLabel(item.paymentStatus, locale),
        fulfillmentLabel(item.fulfillmentStatus, locale),
        formatMoney(item.totalAmount),
        formatMoney(item.paidAmount),
        formatMoney(item.remainingAmount),
        item.invoiceNumber || item.invoiceId || "-",
        formatDate(item.createdAt),
        formatDate(item.completedAt),
      ]),
    });

    toast.success(t.exportSuccess);
  }

  function printReport() {
    if (!canPrintReport) return;

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
        title: t.printTitle,
        rows: filteredRows,
        summary: filteredSummary,
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
    loadReport(false);
  }, [authResolving, loadReport]);

  if (!authResolving && !canViewReport) {
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
          <Link href="/system/reports">
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
            onClick={() => loadReport(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refresh}</span>
          </Button>

          {canExportReport ? (
            <Button
              variant="outline"
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

          {canPrintReport ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={printReport}
              disabled={
                isLoading || filteredRows.length === 0 || Boolean(errorMessage)
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
                  {t.apiErrorHint}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => loadReport(true)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!errorMessage ? (
        <>
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
                          <div className="text-2xl font-bold">
                            {item.isMoney ? (
                              <MoneyText value={item.value} />
                            ) : (
                              formatNumber(item.value)
                            )}
                          </div>
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
                        {item.helper}
                        {item.helperValue ? `: ${item.helperValue}` : ""}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                {t.financialTitle}
              </CardTitle>
              <CardDescription>{t.financialDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">{t.totalAmount}</p>
                <div className="mt-2 text-lg font-bold">
                  <MoneyText value={summary.total_amount} />
                </div>
              </div>

              <div className="rounded-2xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">{t.paidAmount}</p>
                <div className="mt-2 text-lg font-bold">
                  <MoneyText value={summary.paid_amount} />
                </div>
              </div>

              <div className="rounded-2xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">
                  {t.remainingAmount}
                </p>
                <div className="mt-2 text-lg font-bold">
                  <MoneyText value={summary.remaining_amount} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                {t.distributionTitle}
              </CardTitle>
              <CardDescription>{t.distributionDesc}</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {isLoading
                  ? Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={index}
                        className="space-y-3 rounded-xl border bg-background/70 p-3"
                      >
                        <SkeletonLine className="h-7 w-14" />
                        <SkeletonLine className="h-4 w-20" />
                        <SkeletonLine className="h-2 w-full" />
                      </div>
                    ))
                  : statusCards.map((card) => {
                      const Icon = card.icon;

                      return (
                        <button
                          key={card.filter}
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
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                {t.paymentDistributionTitle}
              </CardTitle>
              <CardDescription>{t.paymentDistributionDesc}</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {isLoading
                  ? Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={index}
                        className="space-y-3 rounded-xl border bg-background/70 p-3"
                      >
                        <SkeletonLine className="h-7 w-14" />
                        <SkeletonLine className="h-4 w-20" />
                        <SkeletonLine className="h-2 w-full" />
                      </div>
                    ))
                  : paymentCards.map((card) => {
                      const Icon = card.icon;

                      return (
                        <button
                          key={card.filter}
                          type="button"
                          className="space-y-2 rounded-xl border bg-background/70 p-3 text-start transition hover:bg-muted/40"
                          onClick={() => setPaymentFilter(card.filter)}
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
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <FileText className="h-4 w-4" />
                {t.tableTitle}
              </CardTitle>
              <CardDescription>{t.tableDesc}</CardDescription>
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

              <div className="grid gap-3">
                <div className="flex flex-wrap gap-2">
                  {statusOptions.map((item) => {
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
                    {paymentOptions.map((item) => {
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
                        <TableHead>{t.table.provider}</TableHead>
                        <TableHead>{t.table.product}</TableHead>
                        <TableHead>{t.table.agent}</TableHead>
                        <TableHead>{t.table.status}</TableHead>
                        <TableHead>{t.table.paymentStatus}</TableHead>
                        <TableHead>{t.table.fulfillmentStatus}</TableHead>
                        <TableHead>{t.table.totalAmount}</TableHead>
                        <TableHead>{t.table.paidAmount}</TableHead>
                        <TableHead>{t.table.remainingAmount}</TableHead>
                        <TableHead>{t.table.invoice}</TableHead>
                        <TableHead>{t.table.createdAt}</TableHead>
                        {canViewOrderDetails ? (
                          <TableHead>{t.table.action}</TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {isLoading ? (
                        <TableRowsSkeleton
                          columnsCount={canViewOrderDetails ? 14 : 13}
                        />
                      ) : filteredRows.length > 0 ? (
                        filteredRows.map((item) => (
                          <TableRow key={`${item.id}-${item.orderNumber}`}>
                            <TableCell>
                              <div className="flex min-w-[180px] items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted">
                                  <ShoppingCart className="h-4 w-4" />
                                </div>

                                <div className="min-w-0">
                                  <p className="truncate font-medium">
                                    {item.orderNumber || "-"}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {formatDate(item.createdAt)}
                                  </p>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="flex min-w-[170px] items-center gap-2">
                                <UserRound className="h-4 w-4 text-muted-foreground" />
                                <div className="min-w-0">
                                  <p className="truncate">
                                    {item.customerName || "-"}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {item.customerPhone || "-"}
                                  </p>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              <span className="min-w-[150px] whitespace-nowrap">
                                {item.providerName || "-"}
                              </span>
                            </TableCell>

                            <TableCell>
                              <span className="min-w-[160px] whitespace-nowrap">
                                {item.productName || "-"}
                              </span>
                            </TableCell>

                            <TableCell>
                              <span className="whitespace-nowrap">
                                {item.agentName || "-"}
                              </span>
                            </TableCell>

                            <TableCell>
                              {orderStatusBadge(item.status, locale)}
                            </TableCell>

                            <TableCell>
                              {paymentStatusBadge(item.paymentStatus, locale)}
                            </TableCell>

                            <TableCell>
                              <Badge variant="secondary" className="rounded-full px-3 py-1">
                                {fulfillmentLabel(item.fulfillmentStatus, locale)}
                              </Badge>
                            </TableCell>

                            <TableCell>
                              <MoneyText value={item.totalAmount} />
                            </TableCell>

                            <TableCell>
                              <MoneyText value={item.paidAmount} />
                            </TableCell>

                            <TableCell>
                              <MoneyText value={item.remainingAmount} />
                            </TableCell>

                            <TableCell>
                              <span className="whitespace-nowrap">
                                {item.invoiceNumber || item.invoiceId || "-"}
                              </span>
                            </TableCell>

                            <TableCell>
                              <span className="whitespace-nowrap">
                                {formatDate(item.createdAt)}
                              </span>
                            </TableCell>

                            {canViewOrderDetails ? (
                              <TableCell>
                                {isValidId(item.id) ? (
                                  <Link href={`/system/orders/${item.id}`}>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 rounded-lg"
                                    >
                                      <Eye className="h-4 w-4" />
                                      <span className="sr-only">
                                        {t.viewDetails}
                                      </span>
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
                            colSpan={canViewOrderDetails ? 14 : 13}
                            className="h-36 text-center"
                          >
                            <div className="mx-auto max-w-md space-y-2">
                              <p className="font-semibold">
                                {hasSearchOrFilter
                                  ? t.noResultsTitle
                                  : t.emptyTitle}
                              </p>
                              <p className="text-sm text-muted-foreground">
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

              <p className="text-sm text-muted-foreground">
                {t.showing} {formatNumber(filteredRows.length)} {t.from}{" "}
                {formatNumber(rows.length)}
              </p>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}