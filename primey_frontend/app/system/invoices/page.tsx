"use client";

/* ============================================================
   📂 app/system/invoices/page.tsx
   🧠 Primey Care | Invoices Dashboard

   ✅ المسار:
      app/system/invoices/page.tsx

   ✅ العمل:
      صفحة لوحة الفواتير داخل النظام.
      تعرض ملخص الفواتير، إجماليات المبالغ، حالة الإصدار، حالة الدفع، وآخر الفواتير.

   ✅ الإصدار:
      Phase 17 UX Refinement + Phase 2 Permissions

   ✅ يعتمد على:
      - /api/invoices/list/
      - /api/invoices/
      - primey-locale
      - AuthProvider
      - sonner
      - /currency/sar.svg

   ✅ متوافق مع:
      - Invoices list page
      - Invoices create page
      - Invoices detail page
      - Central reports module
      - Centers / Customers approved UX standard

   ✅ الوظائف:
      - عرض ملخص الفواتير.
      - عرض آخر الفواتير.
      - البحث في صف مستقل.
      - الفلاتر في صف مستقل.
      - فلترة حسب حالة الفاتورة وحالة الدفع.
      - Excel export بصيغة .xls HTML Workbook.
      - Web PDF Print.
      - Error State مستقل.
      - Empty State ذكي.
      - Skeleton Loading.
      - صلاحيات آمنة بدون كسر system_admin/superuser.
      - إخفاء الأزرار غير المصرح بها بدل تعطيلها.
      - أرقام إنجليزية دائمًا.
      - رمز SAR من /currency/sar.svg بعد الرقم.
      - استخدام sonner للتنبيهات.
      - بدون localhost hardcoded.
      - بدون إظهار مسارات أو عبارات تقنية داخل الواجهة.

   ✅ إصلاحات هذا الإصدار:
      - إصلاح TypeError الخاص بـ invoices_count عند apiSummary undefined.
      - جعل buildSummary تستخدم asDict(apiSummary) بدل cast غير آمن.
      - إضافة fallback للتحميل من /api/invoices/list/ ثم /api/invoices/.
      - تحسين قراءة رسائل الخطأ بدون كسر الصفحة.
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Loader2,
  PlusCircle,
  Printer,
  ReceiptText,
  RefreshCcw,
  Search,
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

type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PAID"
  | "PARTIALLY_PAID"
  | "CANCELLED"
  | "OVERDUE"
  | "UNKNOWN";

type PaymentStatus =
  | "UNPAID"
  | "PARTIAL"
  | "PAID"
  | "REFUNDED"
  | "CANCELLED"
  | "UNKNOWN";

type StatusFilter = "ALL" | InvoiceStatus;
type PaymentFilter = "ALL" | PaymentStatus;

type SortKey =
  | "issue_date"
  | "invoice_number"
  | "customer_name"
  | "status"
  | "payment_status"
  | "total_amount"
  | "paid_amount"
  | "remaining_amount"
  | "created_at";

type SortDirection = "asc" | "desc";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_phone: string;
  customer_id: string;
  order_number: string;
  order_id: string;
  status: InvoiceStatus;
  payment_status: PaymentStatus;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  issue_date: string;
  due_date: string;
  created_at: string;
  source_reference: string;
  notes: string;
};

type InvoiceSummary = {
  total_invoices: number;
  issued_invoices: number;
  paid_invoices: number;
  partial_invoices: number;
  unpaid_invoices: number;
  cancelled_invoices: number;
  overdue_invoices: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  tax_amount: number;
  discount_amount: number;
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
  invoices?: unknown[];
  summary?: Partial<InvoiceSummary>;
};

const SAR_ICON_PATH = "/currency/sar.svg";
const PAGE_SIZE = 10;

const DEFAULT_SUMMARY: InvoiceSummary = {
  total_invoices: 0,
  issued_invoices: 0,
  paid_invoices: 0,
  partial_invoices: 0,
  unpaid_invoices: 0,
  cancelled_invoices: 0,
  overdue_invoices: 0,
  total_amount: 0,
  paid_amount: 0,
  remaining_amount: 0,
  tax_amount: 0,
  discount_amount: 0,
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
    title: isArabic ? "الفواتير" : "Invoices",
    subtitle: isArabic
      ? "متابعة الفواتير وإجماليات المبالغ وحالة الإصدار والدفع."
      : "Track invoices, totals, issue status, and payment status.",

    list: isArabic ? "قائمة الفواتير" : "Invoices List",
    create: isArabic ? "إنشاء فاتورة" : "Create Invoice",
    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",

    summaryTitle: isArabic ? "ملخص الفواتير" : "Invoices Summary",
    latestTitle: isArabic ? "آخر الفواتير" : "Latest Invoices",
    latestDesc: isArabic
      ? "آخر الفواتير المسجلة حسب الفلاتر الحالية."
      : "Latest invoices based on the current filters.",

    totalInvoices: isArabic ? "إجمالي الفواتير" : "Total Invoices",
    issuedInvoices: isArabic ? "فواتير مصدرة" : "Issued Invoices",
    paidInvoices: isArabic ? "فواتير مدفوعة" : "Paid Invoices",
    partialInvoices: isArabic ? "مدفوعة جزئيًا" : "Partially Paid",
    unpaidInvoices: isArabic ? "غير مدفوعة" : "Unpaid",
    cancelledInvoices: isArabic ? "ملغاة" : "Cancelled",
    overdueInvoices: isArabic ? "متأخرة" : "Overdue",
    totalAmount: isArabic ? "إجمالي الفواتير" : "Total Amount",
    paidAmount: isArabic ? "المحصل" : "Paid Amount",
    remainingAmount: isArabic ? "المتبقي" : "Remaining",
    taxAmount: isArabic ? "الضريبة" : "Tax",
    discountAmount: isArabic ? "الخصومات" : "Discounts",

    searchPlaceholder: isArabic
      ? "ابحث برقم الفاتورة أو العميل أو الطلب أو المرجع..."
      : "Search by invoice number, customer, order, or reference...",

    allStatuses: isArabic ? "كل حالات الفاتورة" : "All Invoice Statuses",
    allPaymentStatuses: isArabic
      ? "كل حالات الدفع"
      : "All Payment Statuses",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",

    draft: isArabic ? "مسودة" : "Draft",
    issued: isArabic ? "مصدرة" : "Issued",
    paid: isArabic ? "مدفوعة" : "Paid",
    partiallyPaid: isArabic ? "مدفوعة جزئيًا" : "Partially Paid",
    cancelled: isArabic ? "ملغاة" : "Cancelled",
    overdue: isArabic ? "متأخرة" : "Overdue",
    unpaid: isArabic ? "غير مدفوعة" : "Unpaid",
    refunded: isArabic ? "مستردة" : "Refunded",
    unknown: isArabic ? "غير محدد" : "Unknown",

    table: {
      date: isArabic ? "تاريخ الإصدار" : "Issue Date",
      number: isArabic ? "رقم الفاتورة" : "Invoice No.",
      customer: isArabic ? "العميل" : "Customer",
      order: isArabic ? "الطلب" : "Order",
      status: isArabic ? "حالة الفاتورة" : "Invoice Status",
      payment: isArabic ? "حالة الدفع" : "Payment Status",
      total: isArabic ? "الإجمالي" : "Total",
      paid: isArabic ? "المدفوع" : "Paid",
      remaining: isArabic ? "المتبقي" : "Remaining",
      dueDate: isArabic ? "تاريخ الاستحقاق" : "Due Date",
      action: isArabic ? "الإجراء" : "Action",
    },

    view: isArabic ? "عرض" : "View",

    emptyTitle: isArabic ? "لا توجد فواتير" : "No invoices",
    emptyText: isArabic
      ? "ستظهر الفواتير هنا بعد إنشائها."
      : "Invoices will appear here after they are created.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير البحث أو الفلاتر."
      : "Try changing the search or filters.",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الفواتير" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض الفواتير. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view invoices. Contact your system administrator if you need access.",

    loadError: isArabic ? "تعذر تحميل الفواتير." : "Unable to load invoices.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    loadSuccess: isArabic
      ? "تم تحديث الفواتير بنجاح."
      : "Invoices refreshed successfully.",

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
    "customer",
    "client",
    "order",
    "invoice",
    "payment",
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
  } as Partial<InvoiceSummary>;
}

function normalizeInvoiceStatus(value: unknown): InvoiceStatus {
  const clean = String(value || "").toUpperCase();

  if (["DRAFT", "PENDING"].includes(clean)) return "DRAFT";
  if (["ISSUED", "APPROVED", "POSTED"].includes(clean)) return "ISSUED";
  if (["PAID", "FULLY_PAID"].includes(clean)) return "PAID";
  if (["PARTIALLY_PAID", "PARTIAL", "PARTIAL_PAID"].includes(clean)) {
    return "PARTIALLY_PAID";
  }
  if (["CANCELLED", "CANCELED", "VOID"].includes(clean)) return "CANCELLED";
  if (["OVERDUE", "LATE"].includes(clean)) return "OVERDUE";

  return "UNKNOWN";
}

function normalizePaymentStatus(value: unknown): PaymentStatus {
  const clean = String(value || "").toUpperCase();

  if (["UNPAID", "NOT_PAID", "PENDING"].includes(clean)) return "UNPAID";
  if (["PARTIAL", "PARTIALLY_PAID", "PARTIAL_PAID"].includes(clean)) {
    return "PARTIAL";
  }
  if (["PAID", "FULLY_PAID"].includes(clean)) return "PAID";
  if (["REFUNDED"].includes(clean)) return "REFUNDED";
  if (["CANCELLED", "CANCELED", "VOID"].includes(clean)) return "CANCELLED";

  return "UNKNOWN";
}

function normalizeInvoice(item: unknown, index: number): InvoiceRow {
  const obj = asDict(item);
  const customerObj = asDict(obj.customer || obj.client);
  const orderObj = asDict(obj.order);

  const totalAmount = toNumber(
    getNestedValue(obj, [
      "total_amount",
      "grand_total",
      "net_amount",
      "amount",
      "total",
    ]),
  );

  const paidAmount = toNumber(
    getNestedValue(obj, ["paid_amount", "amount_paid", "collected_amount"]),
  );

  const remainingValue = getNestedValue(obj, [
    "remaining_amount",
    "balance_due",
    "due_amount",
  ]);

  const remainingAmount =
    remainingValue !== undefined && remainingValue !== null
      ? toNumber(remainingValue)
      : Math.max(totalAmount - paidAmount, 0);

  const status = normalizeInvoiceStatus(
    getNestedValue(obj, ["status", "invoice_status", "state"]),
  );

  const paymentStatus = normalizePaymentStatus(
    getNestedValue(obj, ["payment_status", "paid_status", "collection_status"]),
  );

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || `${index}`),
    invoice_number: String(
      getNestedValue(obj, ["invoice_number", "number", "code", "reference"]) ||
        "-",
    ),
    customer_name: String(
      customerObj.name ||
        customerObj.full_name ||
        getNestedValue(obj, [
          "customer_name",
          "client_name",
          "beneficiary_name",
          "name",
        ]) ||
        "-",
    ),
    customer_phone: String(
      customerObj.phone ||
        customerObj.mobile ||
        getNestedValue(obj, ["customer_phone", "phone", "mobile"]) ||
        "",
    ),
    customer_id: String(
      customerObj.id || getNestedValue(obj, ["customer_id", "client_id"]) || "",
    ),
    order_number: String(
      orderObj.order_number ||
        orderObj.number ||
        getNestedValue(obj, ["order_number", "order_reference"]) ||
        "-",
    ),
    order_id: String(orderObj.id || getNestedValue(obj, ["order_id"]) || ""),
    status,
    payment_status:
      paymentStatus === "UNKNOWN"
        ? status === "PAID"
          ? "PAID"
          : status === "PARTIALLY_PAID"
            ? "PARTIAL"
            : "UNPAID"
        : paymentStatus,
    subtotal: toNumber(getNestedValue(obj, ["subtotal", "sub_total"])),
    discount_amount: toNumber(
      getNestedValue(obj, ["discount_amount", "discount", "total_discount"]),
    ),
    tax_amount: toNumber(
      getNestedValue(obj, ["tax_amount", "vat_amount", "total_tax"]),
    ),
    total_amount: totalAmount,
    paid_amount: paidAmount,
    remaining_amount: remainingAmount,
    issue_date: String(
      getNestedValue(obj, ["issue_date", "issued_at", "date", "created_at"]) ||
        "",
    ),
    due_date: String(getNestedValue(obj, ["due_date", "payment_due_date"]) || ""),
    created_at: String(getNestedValue(obj, ["created_at", "created"]) || ""),
    source_reference: String(
      getNestedValue(obj, [
        "source_reference",
        "external_reference",
        "payment_reference",
        "ref",
      ]) || "",
    ),
    notes: String(getNestedValue(obj, ["notes", "description", "memo"]) || ""),
  };
}

function buildSummary(
  rows: InvoiceRow[],
  apiSummary?: Partial<InvoiceSummary>,
): InvoiceSummary {
  const fallback: InvoiceSummary = {
    total_invoices: rows.length,
    issued_invoices: rows.filter((item) => item.status === "ISSUED").length,
    paid_invoices: rows.filter(
      (item) => item.status === "PAID" || item.payment_status === "PAID",
    ).length,
    partial_invoices: rows.filter(
      (item) =>
        item.status === "PARTIALLY_PAID" || item.payment_status === "PARTIAL",
    ).length,
    unpaid_invoices: rows.filter((item) => item.payment_status === "UNPAID")
      .length,
    cancelled_invoices: rows.filter((item) => item.status === "CANCELLED")
      .length,
    overdue_invoices: rows.filter((item) => item.status === "OVERDUE").length,
    total_amount: rows.reduce((sum, item) => sum + item.total_amount, 0),
    paid_amount: rows.reduce((sum, item) => sum + item.paid_amount, 0),
    remaining_amount: rows.reduce((sum, item) => sum + item.remaining_amount, 0),
    tax_amount: rows.reduce((sum, item) => sum + item.tax_amount, 0),
    discount_amount: rows.reduce((sum, item) => sum + item.discount_amount, 0),
  };

  const api = asDict(apiSummary);

  return {
    total_invoices:
      toNumber(apiSummary?.total_invoices) ||
      toNumber(api.invoices_count) ||
      fallback.total_invoices,
    issued_invoices:
      toNumber(apiSummary?.issued_invoices) || fallback.issued_invoices,
    paid_invoices: toNumber(apiSummary?.paid_invoices) || fallback.paid_invoices,
    partial_invoices:
      toNumber(apiSummary?.partial_invoices) || fallback.partial_invoices,
    unpaid_invoices:
      toNumber(apiSummary?.unpaid_invoices) || fallback.unpaid_invoices,
    cancelled_invoices:
      toNumber(apiSummary?.cancelled_invoices) || fallback.cancelled_invoices,
    overdue_invoices:
      toNumber(apiSummary?.overdue_invoices) || fallback.overdue_invoices,
    total_amount:
      toNumber(apiSummary?.total_amount) ||
      toNumber(api.total_revenue) ||
      fallback.total_amount,
    paid_amount:
      toNumber(apiSummary?.paid_amount) ||
      toNumber(api.collected_amount) ||
      fallback.paid_amount,
    remaining_amount:
      toNumber(apiSummary?.remaining_amount) ||
      toNumber(api.outstanding_amount) ||
      fallback.remaining_amount,
    tax_amount: toNumber(apiSummary?.tax_amount) || fallback.tax_amount,
    discount_amount:
      toNumber(apiSummary?.discount_amount) || fallback.discount_amount,
  };
}

function invoiceStatusLabel(status: InvoiceStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<InvoiceStatus, string> = {
    DRAFT: t.draft,
    ISSUED: t.issued,
    PAID: t.paid,
    PARTIALLY_PAID: t.partiallyPaid,
    CANCELLED: t.cancelled,
    OVERDUE: t.overdue,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function paymentStatusLabel(status: PaymentStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<PaymentStatus, string> = {
    UNPAID: t.unpaid,
    PARTIAL: t.partiallyPaid,
    PAID: t.paid,
    REFUNDED: t.refunded,
    CANCELLED: t.cancelled,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function invoiceStatusBadge(status: InvoiceStatus, locale: AppLocale) {
  const label = invoiceStatusLabel(status, locale);

  if (status === "PAID" || status === "ISSUED") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (status === "PARTIALLY_PAID" || status === "DRAFT") {
    return (
      <Badge className="rounded-full border-amber-200 bg-amber-50 px-3 py-1 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
        {label}
      </Badge>
    );
  }

  if (status === "OVERDUE" || status === "CANCELLED") {
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

  if (status === "PARTIAL") {
    return (
      <Badge className="rounded-full border-amber-200 bg-amber-50 px-3 py-1 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
        {label}
      </Badge>
    );
  }

  if (status === "UNPAID" || status === "CANCELLED") {
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

function sortValue(row: InvoiceRow, key: SortKey): string | number {
  if (["total_amount", "paid_amount", "remaining_amount"].includes(key)) {
    return row[key as "total_amount" | "paid_amount" | "remaining_amount"];
  }

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

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
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

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 7 }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: 10 }).map((__, columnIndex) => (
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

/* ============================================================
   Export / Print
============================================================ */

function downloadExcel({
  filename,
  worksheetName,
  title,
  locale,
  summary,
  rows,
}: {
  filename: string;
  worksheetName: string;
  title: string;
  locale: AppLocale;
  summary: InvoiceSummary;
  rows: InvoiceRow[];
}) {
  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const align = isArabic ? "right" : "left";
  const t = dictionary(locale);

  const rowsHtml = rows
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(formatDate(item.issue_date, locale))}</td>
          <td>${escapeHtml(item.invoice_number)}</td>
          <td>${escapeHtml(item.customer_name)}</td>
          <td>${escapeHtml(item.order_number || "-")}</td>
          <td>${escapeHtml(invoiceStatusLabel(item.status, locale))}</td>
          <td>${escapeHtml(paymentStatusLabel(item.payment_status, locale))}</td>
          <td>${escapeHtml(formatMoney(item.total_amount))}</td>
          <td>${escapeHtml(formatMoney(item.paid_amount))}</td>
          <td>${escapeHtml(formatMoney(item.remaining_amount))}</td>
          <td>${escapeHtml(formatDate(item.due_date, locale))}</td>
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
                  <x:DisplayRightToLeft>${isArabic ? "True" : "False"}</x:DisplayRightToLeft>
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
          <tr><td class="title" colspan="10">${escapeHtml(title)}</td></tr>
          <tr><td colspan="10"></td></tr>
          <tr><td class="section" colspan="10">${escapeHtml(t.summaryTitle)}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.generatedAt)}</td><td class="summary-value" colspan="9">${escapeHtml(new Date().toLocaleString("en-US"))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalInvoices)}</td><td class="summary-value" colspan="9">${escapeHtml(formatNumber(summary.total_invoices))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalAmount)}</td><td class="summary-value" colspan="9">${escapeHtml(formatMoney(summary.total_amount))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.paidAmount)}</td><td class="summary-value" colspan="9">${escapeHtml(formatMoney(summary.paid_amount))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.remainingAmount)}</td><td class="summary-value" colspan="9">${escapeHtml(formatMoney(summary.remaining_amount))}</td></tr>

          <tr><td colspan="10"></td></tr>
          <tr>
            <th>${escapeHtml(t.table.date)}</th>
            <th>${escapeHtml(t.table.number)}</th>
            <th>${escapeHtml(t.table.customer)}</th>
            <th>${escapeHtml(t.table.order)}</th>
            <th>${escapeHtml(t.table.status)}</th>
            <th>${escapeHtml(t.table.payment)}</th>
            <th>${escapeHtml(t.table.total)}</th>
            <th>${escapeHtml(t.table.paid)}</th>
            <th>${escapeHtml(t.table.remaining)}</th>
            <th>${escapeHtml(t.table.dueDate)}</th>
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
  summary: InvoiceSummary;
  rows: InvoiceRow[];
}) {
  const isArabic = locale === "ar";
  const t = dictionary(locale);
  const now = new Date().toLocaleString("en-US");

  const tableRows = rows
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(formatDate(item.issue_date, locale))}</td>
          <td>${escapeHtml(item.invoice_number)}</td>
          <td>${escapeHtml(item.customer_name)}</td>
          <td>${escapeHtml(invoiceStatusLabel(item.status, locale))}</td>
          <td>${escapeHtml(paymentStatusLabel(item.payment_status, locale))}</td>
          <td>${escapeHtml(formatMoney(item.total_amount))}</td>
          <td>${escapeHtml(formatMoney(item.remaining_amount))}</td>
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
          .print-header {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 18px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 14px;
          }
          h1 { margin: 0; font-size: 22px; font-weight: 800; }
          .meta { margin-top: 8px; color: #6b7280; font-size: 12px; line-height: 1.8; }
          .badge {
            border: 1px solid #d1d5db;
            border-radius: 999px;
            padding: 4px 10px;
            font-size: 12px;
            height: fit-content;
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
          <div class="summary-card"><span>${escapeHtml(t.totalInvoices)}</span><strong>${formatNumber(summary.total_invoices)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.totalAmount)}</span><strong>${formatMoney(summary.total_amount)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.paidAmount)}</span><strong>${formatMoney(summary.paid_amount)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.remainingAmount)}</span><strong>${formatMoney(summary.remaining_amount)}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${escapeHtml(t.table.date)}</th>
              <th>${escapeHtml(t.table.number)}</th>
              <th>${escapeHtml(t.table.customer)}</th>
              <th>${escapeHtml(t.table.status)}</th>
              <th>${escapeHtml(t.table.payment)}</th>
              <th>${escapeHtml(t.table.total)}</th>
              <th>${escapeHtml(t.table.remaining)}</th>
            </tr>
          </thead>
          <tbody>
            ${
              tableRows ||
              `<tr><td colspan="8" style="text-align:center">${escapeHtml(t.emptyTitle)}</td></tr>`
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

export default function SystemInvoicesPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary>(DEFAULT_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("issue_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canView = hasSafePermission(
    auth,
    ["invoices.view", "billing.invoices.view"],
    "view",
  );

  const canCreate = hasSafePermission(
    auth,
    ["invoices.create", "billing.invoices.create"],
    "action",
  );

  const canExport = hasSafePermission(
    auth,
    ["invoices.export", "reports.export"],
    "action",
  );

  const canPrint = hasSafePermission(
    auth,
    ["invoices.print", "reports.print"],
    "action",
  );

  const canViewDetails = hasSafePermission(
    auth,
    ["invoices.view", "billing.invoices.view"],
    "view",
  );

  const filteredRows = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    const filtered = rows.filter((item) => {
      const matchesStatus =
        statusFilter === "ALL" ? true : item.status === statusFilter;

      const matchesPayment =
        paymentFilter === "ALL" ? true : item.payment_status === paymentFilter;

      const matchesQuery = !cleanQuery
        ? true
        : [
            item.invoice_number,
            item.customer_name,
            item.customer_phone,
            item.order_number,
            item.source_reference,
            item.notes,
            invoiceStatusLabel(item.status, locale),
            paymentStatusLabel(item.payment_status, locale),
          ]
            .join(" ")
            .toLowerCase()
            .includes(cleanQuery);

      return matchesStatus && matchesPayment && matchesQuery;
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
  }, [locale, paymentFilter, query, rows, sortDirection, sortKey, statusFilter]);

  const activeSummary = useMemo(() => buildSummary(filteredRows), [filteredRows]);

  const displaySummary =
    query.trim().length > 0 || statusFilter !== "ALL" || paymentFilter !== "ALL"
      ? activeSummary
      : summary;

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  const paginatedRows = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * PAGE_SIZE;

    return filteredRows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredRows, page, totalPages]);

  const hasSearchOrFilter =
    query.trim().length > 0 || statusFilter !== "ALL" || paymentFilter !== "ALL";

  const statusOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: "ALL", label: t.allStatuses },
    { value: "DRAFT", label: t.draft },
    { value: "ISSUED", label: t.issued },
    { value: "PAID", label: t.paid },
    { value: "PARTIALLY_PAID", label: t.partiallyPaid },
    { value: "OVERDUE", label: t.overdue },
    { value: "CANCELLED", label: t.cancelled },
  ];

  const paymentOptions: Array<{ value: PaymentFilter; label: string }> = [
    { value: "ALL", label: t.allPaymentStatuses },
    { value: "UNPAID", label: t.unpaid },
    { value: "PARTIAL", label: t.partiallyPaid },
    { value: "PAID", label: t.paid },
    { value: "REFUNDED", label: t.refunded },
    { value: "CANCELLED", label: t.cancelled },
  ];

  const loadInvoices = useCallback(
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
          "/api/invoices/list/?page_size=500",
          "/api/invoices/?page_size=500",
        ];

        let payload: ApiEnvelope<unknown> | null = null;
        let lastError = "";

        for (const endpoint of endpoints) {
          const response = await fetch(apiUrl(endpoint), {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: { Accept: "application/json" },
          });

          const responsePayload = (await response.json().catch(() => null)) as
            | ApiEnvelope<unknown>
            | null;

          if (
            response.ok &&
            responsePayload?.ok !== false &&
            responsePayload?.success !== false
          ) {
            payload = responsePayload;
            break;
          }

          lastError =
            responsePayload?.message ||
            responsePayload?.detail ||
            responsePayload?.error ||
            `HTTP ${response.status}`;
        }

        if (!payload) {
          throw new Error(lastError || t.loadError);
        }

        const normalizedRows = extractRows(payload, "invoices")
          .map(normalizeInvoice)
          .filter((item) => item.id || item.invoice_number);

        setRows(normalizedRows);
        setSummary(buildSummary(normalizedRows, extractSummary(payload)));
        setPage(1);

        if (showToast) toast.success(t.loadSuccess);
      } catch (error) {
        console.error("Invoices dashboard load error:", error);
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
    setPaymentFilter("ALL");
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

    downloadExcel({
      filename: `primey-care-invoices-${new Date().toISOString().slice(0, 10)}.xls`,
      worksheetName: isArabic ? "الفواتير" : "Invoices",
      title: t.title,
      locale,
      summary: displaySummary,
      rows: filteredRows,
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
        summary: displaySummary,
        rows: filteredRows,
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
    loadInvoices(false);
  }, [authResolving, loadInvoices]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, paymentFilter]);

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
          <Link href="/system/invoices/list">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.list}</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadInvoices(true)}
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
                isLoading || filteredRows.length === 0 || Boolean(errorMessage)
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
                isLoading || filteredRows.length === 0 || Boolean(errorMessage)
              }
            >
              <Printer className="h-4 w-4" />
              <span>{t.print}</span>
            </Button>
          ) : null}

          {canCreate ? (
            <Link href="/system/invoices/create">
              <Button className="h-10 w-full rounded-xl sm:w-auto">
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
                <p className="font-semibold text-destructive">{errorMessage}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.loadErrorHint}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => loadInvoices(true)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <KpiSkeleton />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-2xl font-bold">
                    {formatNumber(displaySummary.total_invoices)}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.totalInvoices}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                  <ReceiptText className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-2xl font-bold">
                    <MoneyText value={displaySummary.total_amount} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.totalAmount}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
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
                    <MoneyText value={displaySummary.paid_amount} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.paidAmount}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-2xl font-bold">
                    <MoneyText value={displaySummary.remaining_amount} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.remainingAmount}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                  <FileText className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{t.paidInvoices}</span>
              <span className="font-semibold">
                {formatNumber(displaySummary.paid_invoices)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{t.partialInvoices}</span>
              <span className="font-semibold">
                {formatNumber(displaySummary.partial_invoices)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{t.unpaidInvoices}</span>
              <span className="font-semibold">
                {formatNumber(displaySummary.unpaid_invoices)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                {t.cancelledInvoices}
              </span>
              <span className="font-semibold">
                {formatNumber(displaySummary.cancelled_invoices)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader className="space-y-4 pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base font-bold">
                {t.latestTitle}
              </CardTitle>
              <CardDescription className="mt-1">{t.latestDesc}</CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => loadInvoices(true)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                {t.refresh}
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

          <div className="grid gap-2 md:grid-cols-2">
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
              className="h-11 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {statusOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              value={paymentFilter}
              onChange={(event) =>
                setPaymentFilter(event.target.value as PaymentFilter)
              }
              className="h-11 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {paymentOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-hidden rounded-xl border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[130px]">
                      <button
                        type="button"
                        onClick={() => toggleSort("issue_date")}
                        className="inline-flex items-center gap-1 font-medium"
                      >
                        {t.table.date}
                        {sortKey === "issue_date" &&
                          (sortDirection === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5" />
                          ))}
                      </button>
                    </TableHead>

                    <TableHead className="min-w-[150px]">
                      <button
                        type="button"
                        onClick={() => toggleSort("invoice_number")}
                        className="inline-flex items-center gap-1 font-medium"
                      >
                        {t.table.number}
                        {sortKey === "invoice_number" &&
                          (sortDirection === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5" />
                          ))}
                      </button>
                    </TableHead>

                    <TableHead className="min-w-[220px]">
                      <button
                        type="button"
                        onClick={() => toggleSort("customer_name")}
                        className="inline-flex items-center gap-1 font-medium"
                      >
                        {t.table.customer}
                        {sortKey === "customer_name" &&
                          (sortDirection === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5" />
                          ))}
                      </button>
                    </TableHead>

                    <TableHead className="min-w-[130px]">{t.table.order}</TableHead>
                    <TableHead className="min-w-[130px]">
                      {t.table.status}
                    </TableHead>
                    <TableHead className="min-w-[130px]">
                      {t.table.payment}
                    </TableHead>
                    <TableHead className="min-w-[140px]">
                      {t.table.total}
                    </TableHead>
                    <TableHead className="min-w-[140px]">
                      {t.table.paid}
                    </TableHead>
                    <TableHead className="min-w-[140px]">
                      {t.table.remaining}
                    </TableHead>

                    {canViewDetails ? (
                      <TableHead className="min-w-[90px]">
                        {t.table.action}
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading ? (
                    <TableSkeleton />
                  ) : paginatedRows.length > 0 ? (
                    paginatedRows.map((item) => (
                      <TableRow key={`${item.id}-${item.invoice_number}`}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(item.issue_date, locale)}
                        </TableCell>

                        <TableCell className="font-semibold" dir="ltr">
                          {item.invoice_number || "-"}
                        </TableCell>

                        <TableCell>
                          <div className="min-w-[200px]">
                            <p className="font-medium">
                              {item.customer_name || "-"}
                            </p>
                            <p className="text-xs text-muted-foreground" dir="ltr">
                              {item.customer_phone || "-"}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell dir="ltr">{item.order_number || "-"}</TableCell>

                        <TableCell>{invoiceStatusBadge(item.status, locale)}</TableCell>

                        <TableCell>
                          {paymentStatusBadge(item.payment_status, locale)}
                        </TableCell>

                        <TableCell>
                          <MoneyText value={item.total_amount} />
                        </TableCell>

                        <TableCell>
                          <MoneyText value={item.paid_amount} />
                        </TableCell>

                        <TableCell>
                          <MoneyText value={item.remaining_amount} />
                        </TableCell>

                        {canViewDetails ? (
                          <TableCell>
                            {isValidId(item.id) ? (
                              <Link href={`/system/invoices/${item.id}`}>
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
                        className="h-44 text-center"
                      >
                        <div className="flex flex-col items-center justify-center gap-2">
                          <ReceiptText className="h-10 w-10 text-muted-foreground/40" />
                          <p className="font-semibold">
                            {hasSearchOrFilter ? t.noResultsTitle : t.emptyTitle}
                          </p>
                          <p className="max-w-md text-sm text-muted-foreground">
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
                          ) : canCreate ? (
                            <Link href="/system/invoices/create">
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
    </div>
  );
}