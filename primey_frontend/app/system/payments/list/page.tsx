"use client";

/* ============================================================
   📂 app/system/payments/list/page.tsx
   🧠 Primey Care | Payments List

   ✅ المسار:
      app/system/payments/list/page.tsx

   ✅ العمل:
      صفحة قائمة المدفوعات داخل النظام.
      تعرض المدفوعات مع البحث والفلاتر والأعمدة والتصدير والطباعة.

   ✅ الإصدار:
      Phase 17 UX Refinement + Phase 2 Permissions

   ✅ يعتمد على:
      - /api/payments/list/
      - /api/payments/
      - primey-locale
      - AuthProvider
      - sonner
      - /currency/sar.svg

   ✅ متوافق مع:
      - Payments dashboard page
      - Payments create page
      - Payments detail page
      - Invoices pages
      - Orders pages
      - Centers / Customers approved UX standard

   ✅ الوظائف:
      - عرض قائمة المدفوعات.
      - البحث في صف مستقل.
      - الفلاتر والأعمدة في صف مستقل تحت البحث.
      - فلترة حسب حالة الدفعة وطريقة الدفع.
      - التحكم بالأعمدة.
      - فرز الأعمدة المهمة.
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
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Columns3,
  CreditCard,
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

type PaymentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "FAILED"
  | "REFUNDED"
  | "UNKNOWN";

type PaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "GATEWAY"
  | "CARD"
  | "WALLET"
  | "TAMARA"
  | "TABBY"
  | "UNKNOWN";

type StatusFilter = "ALL" | PaymentStatus;
type MethodFilter = "ALL" | PaymentMethod;

type SortKey =
  | "payment_date"
  | "payment_number"
  | "customer_name"
  | "invoice_number"
  | "order_number"
  | "status"
  | "payment_method"
  | "amount"
  | "created_at";

type SortDirection = "asc" | "desc";

type PaymentRow = {
  id: string;
  payment_number: string;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  invoice_id: string;
  invoice_number: string;
  order_id: string;
  order_number: string;
  payment_date: string;
  created_at: string;
  reference: string;
  notes: string;
  is_treasury_posted: boolean;
  is_accounting_posted: boolean;
};

type PaymentSummary = {
  total_payments: number;
  confirmed_payments: number;
  pending_payments: number;
  cancelled_payments: number;
  failed_payments: number;
  refunded_payments: number;
  total_amount: number;
  confirmed_amount: number;
  pending_amount: number;
  cancelled_amount: number;
  treasury_posted_count: number;
  accounting_posted_count: number;
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
  payments?: unknown[];
  summary?: Partial<PaymentSummary>;
};

type VisibleColumns = {
  paymentDate: boolean;
  paymentNumber: boolean;
  customer: boolean;
  invoice: boolean;
  order: boolean;
  method: boolean;
  status: boolean;
  amount: boolean;
  reference: boolean;
  posting: boolean;
  actions: boolean;
};

const SAR_ICON_PATH = "/currency/sar.svg";
const PAGE_SIZE = 14;

const DEFAULT_COLUMNS: VisibleColumns = {
  paymentDate: true,
  paymentNumber: true,
  customer: true,
  invoice: true,
  order: true,
  method: true,
  status: true,
  amount: true,
  reference: true,
  posting: true,
  actions: true,
};

const DEFAULT_SUMMARY: PaymentSummary = {
  total_payments: 0,
  confirmed_payments: 0,
  pending_payments: 0,
  cancelled_payments: 0,
  failed_payments: 0,
  refunded_payments: 0,
  total_amount: 0,
  confirmed_amount: 0,
  pending_amount: 0,
  cancelled_amount: 0,
  treasury_posted_count: 0,
  accounting_posted_count: 0,
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
    title: isArabic ? "قائمة المدفوعات" : "Payments List",
    subtitle: isArabic
      ? "إدارة ومراجعة المدفوعات وحالات التأكيد والترحيل المالي."
      : "Manage and review payments, confirmation status, and financial posting.",

    back: isArabic ? "المدفوعات" : "Payments",
    create: isArabic ? "تسجيل دفعة" : "Create Payment",
    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",

    summaryTitle: isArabic ? "ملخص القائمة" : "List Summary",
    tableTitle: isArabic ? "المدفوعات" : "Payments",
    tableDesc: isArabic
      ? "قائمة المدفوعات مع طريقة الدفع والحالة والترحيل."
      : "Payments list with method, status, and posting information.",

    totalPayments: isArabic ? "إجمالي المدفوعات" : "Total Payments",
    confirmedPayments: isArabic ? "مدفوعات مؤكدة" : "Confirmed Payments",
    pendingPayments: isArabic ? "بانتظار التأكيد" : "Pending Payments",
    cancelledPayments: isArabic ? "مدفوعات ملغاة" : "Cancelled Payments",
    failedPayments: isArabic ? "فاشلة" : "Failed",
    refundedPayments: isArabic ? "مستردة" : "Refunded",
    totalAmount: isArabic ? "إجمالي المبالغ" : "Total Amount",
    confirmedAmount: isArabic ? "المحصل المؤكد" : "Confirmed Amount",
    pendingAmount: isArabic ? "غير مؤكد" : "Pending Amount",
    cancelledAmount: isArabic ? "مبالغ ملغاة" : "Cancelled Amount",
    treasuryPosted: isArabic ? "مرحّل خزينة" : "Treasury Posted",
    accountingPosted: isArabic ? "مرحّل محاسبيًا" : "Accounting Posted",

    searchPlaceholder: isArabic
      ? "ابحث برقم الدفعة أو العميل أو الفاتورة أو الطلب أو المرجع..."
      : "Search by payment number, customer, invoice, order, or reference...",

    columns: isArabic ? "الأعمدة" : "Columns",
    allStatuses: isArabic ? "كل حالات الدفعة" : "All Payment Statuses",
    allMethods: isArabic ? "كل طرق الدفع" : "All Payment Methods",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",

    pending: isArabic ? "بانتظار التأكيد" : "Pending",
    confirmed: isArabic ? "مؤكدة" : "Confirmed",
    cancelled: isArabic ? "ملغاة" : "Cancelled",
    failed: isArabic ? "فاشلة" : "Failed",
    refunded: isArabic ? "مستردة" : "Refunded",
    unknown: isArabic ? "غير محدد" : "Unknown",

    cash: isArabic ? "نقدًا" : "Cash",
    bankTransfer: isArabic ? "تحويل بنكي" : "Bank Transfer",
    gateway: isArabic ? "بوابة دفع" : "Gateway",
    card: isArabic ? "بطاقة" : "Card",
    wallet: isArabic ? "محفظة" : "Wallet",
    tamara: isArabic ? "تمارا" : "Tamara",
    tabby: isArabic ? "تابي" : "Tabby",

    table: {
      date: isArabic ? "تاريخ الدفع" : "Payment Date",
      number: isArabic ? "رقم الدفعة" : "Payment No.",
      customer: isArabic ? "العميل" : "Customer",
      invoice: isArabic ? "الفاتورة" : "Invoice",
      order: isArabic ? "الطلب" : "Order",
      method: isArabic ? "طريقة الدفع" : "Method",
      status: isArabic ? "الحالة" : "Status",
      amount: isArabic ? "المبلغ" : "Amount",
      reference: isArabic ? "المرجع" : "Reference",
      posting: isArabic ? "الترحيل" : "Posting",
      action: isArabic ? "الإجراء" : "Action",
    },

    treasury: isArabic ? "خزينة" : "Treasury",
    accounting: isArabic ? "محاسبة" : "Accounting",
    posted: isArabic ? "مرحّل" : "Posted",
    notPosted: isArabic ? "غير مرحّل" : "Not Posted",
    view: isArabic ? "عرض" : "View",

    emptyTitle: isArabic ? "لا توجد مدفوعات" : "No payments",
    emptyText: isArabic
      ? "ستظهر المدفوعات هنا بعد تسجيلها."
      : "Payments will appear here after they are recorded.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير البحث أو الفلاتر."
      : "Try changing the search or filters.",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض المدفوعات" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض المدفوعات. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view payments. Contact your system administrator if you need access.",

    loadError: isArabic ? "تعذر تحميل المدفوعات." : "Unable to load payments.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    loadSuccess: isArabic
      ? "تم تحديث المدفوعات بنجاح."
      : "Payments refreshed successfully.",

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
    "invoice",
    "order",
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
  } as Partial<PaymentSummary>;
}

function normalizePaymentStatus(value: unknown): PaymentStatus {
  const clean = String(value || "").toUpperCase();

  if (["PENDING", "DRAFT", "NEW"].includes(clean)) return "PENDING";
  if (["CONFIRMED", "PAID", "SUCCESS", "APPROVED", "POSTED"].includes(clean)) {
    return "CONFIRMED";
  }
  if (["CANCELLED", "CANCELED", "VOID"].includes(clean)) return "CANCELLED";
  if (["FAILED", "REJECTED", "ERROR"].includes(clean)) return "FAILED";
  if (["REFUNDED", "REVERSED"].includes(clean)) return "REFUNDED";

  return "UNKNOWN";
}

function normalizePaymentMethod(value: unknown): PaymentMethod {
  const clean = String(value || "").toUpperCase();

  if (clean === "CASH") return "CASH";
  if (["BANK_TRANSFER", "TRANSFER", "BANK"].includes(clean)) {
    return "BANK_TRANSFER";
  }
  if (["GATEWAY", "MOYASAR", "TAP", "ONLINE"].includes(clean)) {
    return "GATEWAY";
  }
  if (["CARD", "CREDIT_CARD", "DEBIT_CARD", "MADA"].includes(clean)) {
    return "CARD";
  }
  if (["WALLET", "APPLE_PAY", "STC_PAY"].includes(clean)) return "WALLET";
  if (clean === "TAMARA") return "TAMARA";
  if (clean === "TABBY") return "TABBY";

  return "UNKNOWN";
}

function normalizePayment(item: unknown, index: number): PaymentRow {
  const obj = asDict(item);
  const customerObj = asDict(obj.customer || obj.client);
  const invoiceObj = asDict(obj.invoice);
  const orderObj = asDict(obj.order);

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || `${index}`),
    payment_number: String(
      getNestedValue(obj, ["payment_number", "number", "code", "reference"]) ||
        "-",
    ),
    payment_method: normalizePaymentMethod(
      getNestedValue(obj, ["payment_method", "method", "type"]),
    ),
    status: normalizePaymentStatus(getNestedValue(obj, ["status", "state"])),
    amount: toNumber(getNestedValue(obj, ["amount", "paid_amount", "total"])),
    customer_id: String(
      customerObj.id || getNestedValue(obj, ["customer_id", "client_id"]) || "",
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
    invoice_id: String(invoiceObj.id || getNestedValue(obj, ["invoice_id"]) || ""),
    invoice_number: String(
      invoiceObj.invoice_number ||
        invoiceObj.number ||
        getNestedValue(obj, ["invoice_number", "invoice_reference"]) ||
        "-",
    ),
    order_id: String(orderObj.id || getNestedValue(obj, ["order_id"]) || ""),
    order_number: String(
      orderObj.order_number ||
        orderObj.number ||
        getNestedValue(obj, ["order_number", "order_reference"]) ||
        "-",
    ),
    payment_date: String(
      getNestedValue(obj, ["payment_date", "paid_at", "date", "created_at"]) ||
        "",
    ),
    created_at: String(getNestedValue(obj, ["created_at", "created"]) || ""),
    reference: String(
      getNestedValue(obj, [
        "source_reference",
        "external_reference",
        "transaction_reference",
        "gateway_reference",
        "ref",
      ]) || "",
    ),
    notes: String(getNestedValue(obj, ["notes", "description", "memo"]) || ""),
    is_treasury_posted: Boolean(
      getNestedValue(obj, ["is_treasury_posted", "treasury_posted"]),
    ),
    is_accounting_posted: Boolean(
      getNestedValue(obj, ["is_accounting_posted", "accounting_posted"]),
    ),
  };
}

function buildSummary(
  rows: PaymentRow[],
  apiSummary?: Partial<PaymentSummary>,
): PaymentSummary {
  const fallback: PaymentSummary = {
    total_payments: rows.length,
    confirmed_payments: rows.filter((item) => item.status === "CONFIRMED").length,
    pending_payments: rows.filter((item) => item.status === "PENDING").length,
    cancelled_payments: rows.filter((item) => item.status === "CANCELLED").length,
    failed_payments: rows.filter((item) => item.status === "FAILED").length,
    refunded_payments: rows.filter((item) => item.status === "REFUNDED").length,
    total_amount: rows.reduce((sum, item) => sum + item.amount, 0),
    confirmed_amount: rows
      .filter((item) => item.status === "CONFIRMED")
      .reduce((sum, item) => sum + item.amount, 0),
    pending_amount: rows
      .filter((item) => item.status === "PENDING")
      .reduce((sum, item) => sum + item.amount, 0),
    cancelled_amount: rows
      .filter((item) => item.status === "CANCELLED")
      .reduce((sum, item) => sum + item.amount, 0),
    treasury_posted_count: rows.filter((item) => item.is_treasury_posted).length,
    accounting_posted_count: rows.filter((item) => item.is_accounting_posted)
      .length,
  };

  const api = asDict(apiSummary);

  return {
    total_payments:
      toNumber(apiSummary?.total_payments) ||
      toNumber(api.payments_count) ||
      fallback.total_payments,
    confirmed_payments:
      toNumber(apiSummary?.confirmed_payments) || fallback.confirmed_payments,
    pending_payments:
      toNumber(apiSummary?.pending_payments) || fallback.pending_payments,
    cancelled_payments:
      toNumber(apiSummary?.cancelled_payments) || fallback.cancelled_payments,
    failed_payments:
      toNumber(apiSummary?.failed_payments) || fallback.failed_payments,
    refunded_payments:
      toNumber(apiSummary?.refunded_payments) || fallback.refunded_payments,
    total_amount:
      toNumber(apiSummary?.total_amount) ||
      toNumber(api.total_collected) ||
      fallback.total_amount,
    confirmed_amount:
      toNumber(apiSummary?.confirmed_amount) ||
      toNumber(api.collected_amount) ||
      fallback.confirmed_amount,
    pending_amount:
      toNumber(apiSummary?.pending_amount) || fallback.pending_amount,
    cancelled_amount:
      toNumber(apiSummary?.cancelled_amount) || fallback.cancelled_amount,
    treasury_posted_count:
      toNumber(apiSummary?.treasury_posted_count) ||
      fallback.treasury_posted_count,
    accounting_posted_count:
      toNumber(apiSummary?.accounting_posted_count) ||
      fallback.accounting_posted_count,
  };
}

function paymentStatusLabel(status: PaymentStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<PaymentStatus, string> = {
    PENDING: t.pending,
    CONFIRMED: t.confirmed,
    CANCELLED: t.cancelled,
    FAILED: t.failed,
    REFUNDED: t.refunded,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function paymentMethodLabel(method: PaymentMethod, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<PaymentMethod, string> = {
    CASH: t.cash,
    BANK_TRANSFER: t.bankTransfer,
    GATEWAY: t.gateway,
    CARD: t.card,
    WALLET: t.wallet,
    TAMARA: t.tamara,
    TABBY: t.tabby,
    UNKNOWN: t.unknown,
  };

  return labels[method];
}

function paymentStatusBadge(status: PaymentStatus, locale: AppLocale) {
  const label = paymentStatusLabel(status, locale);

  if (status === "CONFIRMED") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (status === "PENDING") {
    return (
      <Badge className="rounded-full border-amber-200 bg-amber-50 px-3 py-1 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
        {label}
      </Badge>
    );
  }

  if (status === "CANCELLED" || status === "FAILED") {
    return (
      <Badge className="rounded-full border-rose-200 bg-rose-50 px-3 py-1 text-rose-700 hover:bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
        {label}
      </Badge>
    );
  }

  if (status === "REFUNDED") {
    return (
      <Badge className="rounded-full border-sky-200 bg-sky-50 px-3 py-1 text-sky-700 hover:bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-300">
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

function methodBadge(method: PaymentMethod, locale: AppLocale) {
  return (
    <Badge variant="outline" className="rounded-full px-3 py-1">
      {paymentMethodLabel(method, locale)}
    </Badge>
  );
}

function sortValue(row: PaymentRow, key: SortKey): string | number {
  if (key === "amount") return row.amount;

  return String(row[key] || "");
}

function isValidId(value: unknown) {
  const id = String(value || "").trim();

  return id && id !== "-" && id !== "undefined" && id !== "null";
}

function hasActiveFilters(
  query: string,
  statusFilter: StatusFilter,
  methodFilter: MethodFilter,
) {
  return query.trim().length > 0 || statusFilter !== "ALL" || methodFilter !== "ALL";
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

function TableSkeleton({ columnsCount }: { columnsCount: number }) {
  return (
    <>
      {Array.from({ length: 7 }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columnsCount }).map((__, columnIndex) => (
            <TableCell key={columnIndex}>
              <SkeletonLine
                className={
                  columnIndex === 2
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
  summary: PaymentSummary;
  rows: PaymentRow[];
}) {
  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const align = isArabic ? "right" : "left";
  const t = dictionary(locale);

  const rowsHtml = rows
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(formatDate(item.payment_date, locale))}</td>
          <td>${escapeHtml(item.payment_number)}</td>
          <td>${escapeHtml(item.customer_name)}</td>
          <td>${escapeHtml(item.customer_phone || "-")}</td>
          <td>${escapeHtml(item.invoice_number || "-")}</td>
          <td>${escapeHtml(item.order_number || "-")}</td>
          <td>${escapeHtml(paymentMethodLabel(item.payment_method, locale))}</td>
          <td>${escapeHtml(paymentStatusLabel(item.status, locale))}</td>
          <td>${escapeHtml(formatMoney(item.amount))}</td>
          <td>${escapeHtml(item.reference || "-")}</td>
          <td>${escapeHtml(item.is_treasury_posted ? t.posted : t.notPosted)}</td>
          <td>${escapeHtml(item.is_accounting_posted ? t.posted : t.notPosted)}</td>
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
          <tr><td class="title" colspan="12">${escapeHtml(title)}</td></tr>
          <tr><td colspan="12"></td></tr>
          <tr><td class="section" colspan="12">${escapeHtml(t.summaryTitle)}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.generatedAt)}</td><td class="summary-value" colspan="11">${escapeHtml(new Date().toLocaleString("en-US"))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalPayments)}</td><td class="summary-value" colspan="11">${escapeHtml(formatNumber(summary.total_payments))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalAmount)}</td><td class="summary-value" colspan="11">${escapeHtml(formatMoney(summary.total_amount))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.confirmedAmount)}</td><td class="summary-value" colspan="11">${escapeHtml(formatMoney(summary.confirmed_amount))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.pendingAmount)}</td><td class="summary-value" colspan="11">${escapeHtml(formatMoney(summary.pending_amount))}</td></tr>

          <tr><td colspan="12"></td></tr>
          <tr>
            <th>${escapeHtml(t.table.date)}</th>
            <th>${escapeHtml(t.table.number)}</th>
            <th>${escapeHtml(t.table.customer)}</th>
            <th>${escapeHtml(isArabic ? "جوال العميل" : "Customer Phone")}</th>
            <th>${escapeHtml(t.table.invoice)}</th>
            <th>${escapeHtml(t.table.order)}</th>
            <th>${escapeHtml(t.table.method)}</th>
            <th>${escapeHtml(t.table.status)}</th>
            <th>${escapeHtml(t.table.amount)}</th>
            <th>${escapeHtml(t.table.reference)}</th>
            <th>${escapeHtml(t.treasuryPosted)}</th>
            <th>${escapeHtml(t.accountingPosted)}</th>
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
  summary: PaymentSummary;
  rows: PaymentRow[];
}) {
  const isArabic = locale === "ar";
  const t = dictionary(locale);
  const now = new Date().toLocaleString("en-US");

  const tableRows = rows
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(formatDate(item.payment_date, locale))}</td>
          <td>${escapeHtml(item.payment_number)}</td>
          <td>${escapeHtml(item.customer_name)}</td>
          <td>${escapeHtml(paymentMethodLabel(item.payment_method, locale))}</td>
          <td>${escapeHtml(paymentStatusLabel(item.status, locale))}</td>
          <td>${escapeHtml(formatMoney(item.amount))}</td>
          <td>${escapeHtml(item.reference || "-")}</td>
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
          <div class="summary-card"><span>${escapeHtml(t.totalPayments)}</span><strong>${formatNumber(summary.total_payments)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.totalAmount)}</span><strong>${formatMoney(summary.total_amount)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.confirmedAmount)}</span><strong>${formatMoney(summary.confirmed_amount)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.pendingAmount)}</span><strong>${formatMoney(summary.pending_amount)}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${escapeHtml(t.table.date)}</th>
              <th>${escapeHtml(t.table.number)}</th>
              <th>${escapeHtml(t.table.customer)}</th>
              <th>${escapeHtml(t.table.method)}</th>
              <th>${escapeHtml(t.table.status)}</th>
              <th>${escapeHtml(t.table.amount)}</th>
              <th>${escapeHtml(t.table.reference)}</th>
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

export default function SystemPaymentsListPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [summary, setSummary] = useState<PaymentSummary>(DEFAULT_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("payment_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [visibleColumns, setVisibleColumns] =
    useState<VisibleColumns>(DEFAULT_COLUMNS);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canView = hasSafePermission(
    auth,
    ["payments.view", "billing.payments.view"],
    "view",
  );

  const canCreate = hasSafePermission(
    auth,
    ["payments.create", "billing.payments.create"],
    "action",
  );

  const canExport = hasSafePermission(
    auth,
    ["payments.export", "reports.export"],
    "action",
  );

  const canPrint = hasSafePermission(
    auth,
    ["payments.print", "reports.print"],
    "action",
  );

  const canViewDetails = hasSafePermission(
    auth,
    ["payments.view", "billing.payments.view"],
    "view",
  );

  const filteredRows = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    const filtered = rows.filter((item) => {
      const matchesStatus =
        statusFilter === "ALL" ? true : item.status === statusFilter;

      const matchesMethod =
        methodFilter === "ALL" ? true : item.payment_method === methodFilter;

      const matchesQuery = !cleanQuery
        ? true
        : [
            item.payment_number,
            item.customer_name,
            item.customer_phone,
            item.invoice_number,
            item.order_number,
            item.reference,
            item.notes,
            paymentStatusLabel(item.status, locale),
            paymentMethodLabel(item.payment_method, locale),
          ]
            .join(" ")
            .toLowerCase()
            .includes(cleanQuery);

      return matchesStatus && matchesMethod && matchesQuery;
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
  }, [locale, methodFilter, query, rows, sortDirection, sortKey, statusFilter]);

  const activeSummary = useMemo(() => buildSummary(filteredRows), [filteredRows]);

  const displaySummary = hasActiveFilters(query, statusFilter, methodFilter)
    ? activeSummary
    : summary;

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  const paginatedRows = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * PAGE_SIZE;

    return filteredRows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredRows, page, totalPages]);

  const hasSearchOrFilter =
    query.trim().length > 0 || statusFilter !== "ALL" || methodFilter !== "ALL";

  const statusOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: "ALL", label: t.allStatuses },
    { value: "PENDING", label: t.pending },
    { value: "CONFIRMED", label: t.confirmed },
    { value: "CANCELLED", label: t.cancelled },
    { value: "FAILED", label: t.failed },
    { value: "REFUNDED", label: t.refunded },
  ];

  const methodOptions: Array<{ value: MethodFilter; label: string }> = [
    { value: "ALL", label: t.allMethods },
    { value: "CASH", label: t.cash },
    { value: "BANK_TRANSFER", label: t.bankTransfer },
    { value: "GATEWAY", label: t.gateway },
    { value: "CARD", label: t.card },
    { value: "WALLET", label: t.wallet },
    { value: "TAMARA", label: t.tamara },
    { value: "TABBY", label: t.tabby },
  ];

  const columnOptions: Array<{ key: keyof VisibleColumns; label: string }> = [
    { key: "paymentDate", label: t.table.date },
    { key: "paymentNumber", label: t.table.number },
    { key: "customer", label: t.table.customer },
    { key: "invoice", label: t.table.invoice },
    { key: "order", label: t.table.order },
    { key: "method", label: t.table.method },
    { key: "status", label: t.table.status },
    { key: "amount", label: t.table.amount },
    { key: "reference", label: t.table.reference },
    { key: "posting", label: t.table.posting },
    { key: "actions", label: t.table.action },
  ];

  const visibleColumnCount = Object.entries(visibleColumns).filter(
    ([key, value]) => value && (key !== "actions" || canViewDetails),
  ).length;

  const loadPayments = useCallback(
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
          "/api/payments/list/?page_size=500",
          "/api/payments/?page_size=500",
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

        const normalizedRows = extractRows(payload, "payments")
          .map(normalizePayment)
          .filter((item) => item.id || item.payment_number);

        setRows(normalizedRows);
        setSummary(buildSummary(normalizedRows, extractSummary(payload)));
        setPage(1);

        if (showToast) toast.success(t.loadSuccess);
      } catch (error) {
        console.error("Payments list load error:", error);
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
    setMethodFilter("ALL");
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
      filename: `primey-care-payments-list-${new Date()
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "قائمة المدفوعات" : "Payments List",
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
    loadPayments(false);
  }, [authResolving, loadPayments]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, methodFilter]);

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
          <Link href="/system/payments">
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
            onClick={() => loadPayments(true)}
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
            <Link href="/system/payments/create">
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
              onClick={() => loadPayments(true)}
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
                    {formatNumber(displaySummary.total_payments)}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.totalPayments}
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
                    <MoneyText value={displaySummary.confirmed_amount} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.confirmedAmount}
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
                    <MoneyText value={displaySummary.pending_amount} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.pendingAmount}
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
              <span className="text-muted-foreground">
                {t.confirmedPayments}
              </span>
              <span className="font-semibold">
                {formatNumber(displaySummary.confirmed_payments)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{t.pendingPayments}</span>
              <span className="font-semibold">
                {formatNumber(displaySummary.pending_payments)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{t.treasuryPosted}</span>
              <span className="font-semibold">
                {formatNumber(displaySummary.treasury_posted_count)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                {t.accountingPosted}
              </span>
              <span className="font-semibold">
                {formatNumber(displaySummary.accounting_posted_count)}
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
                {t.tableTitle}
              </CardTitle>
              <CardDescription className="mt-1">{t.tableDesc}</CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => loadPayments(true)}
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

          <div className="grid w-full gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
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
              value={methodFilter}
              onChange={(event) =>
                setMethodFilter(event.target.value as MethodFilter)
              }
              className="h-11 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {methodOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

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
                    if (column.key === "actions" && !canViewDetails) {
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
                    {visibleColumns.paymentDate ? (
                      <TableHead className="min-w-[130px]">
                        <button
                          type="button"
                          onClick={() => toggleSort("payment_date")}
                          className="inline-flex items-center gap-1 font-medium"
                        >
                          {t.table.date}
                          {sortKey === "payment_date" &&
                            (sortDirection === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5" />
                            ))}
                        </button>
                      </TableHead>
                    ) : null}

                    {visibleColumns.paymentNumber ? (
                      <TableHead className="min-w-[150px]">
                        <button
                          type="button"
                          onClick={() => toggleSort("payment_number")}
                          className="inline-flex items-center gap-1 font-medium"
                        >
                          {t.table.number}
                          {sortKey === "payment_number" &&
                            (sortDirection === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5" />
                            ))}
                        </button>
                      </TableHead>
                    ) : null}

                    {visibleColumns.customer ? (
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
                    ) : null}

                    {visibleColumns.invoice ? (
                      <TableHead className="min-w-[130px]">
                        <button
                          type="button"
                          onClick={() => toggleSort("invoice_number")}
                          className="inline-flex items-center gap-1 font-medium"
                        >
                          {t.table.invoice}
                          {sortKey === "invoice_number" &&
                            (sortDirection === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5" />
                            ))}
                        </button>
                      </TableHead>
                    ) : null}

                    {visibleColumns.order ? (
                      <TableHead className="min-w-[130px]">
                        <button
                          type="button"
                          onClick={() => toggleSort("order_number")}
                          className="inline-flex items-center gap-1 font-medium"
                        >
                          {t.table.order}
                          {sortKey === "order_number" &&
                            (sortDirection === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5" />
                            ))}
                        </button>
                      </TableHead>
                    ) : null}

                    {visibleColumns.method ? (
                      <TableHead className="min-w-[130px]">
                        {t.table.method}
                      </TableHead>
                    ) : null}

                    {visibleColumns.status ? (
                      <TableHead className="min-w-[130px]">
                        {t.table.status}
                      </TableHead>
                    ) : null}

                    {visibleColumns.amount ? (
                      <TableHead className="min-w-[140px]">
                        <button
                          type="button"
                          onClick={() => toggleSort("amount")}
                          className="inline-flex items-center gap-1 font-medium"
                        >
                          {t.table.amount}
                          {sortKey === "amount" &&
                            (sortDirection === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5" />
                            ))}
                        </button>
                      </TableHead>
                    ) : null}

                    {visibleColumns.reference ? (
                      <TableHead className="min-w-[160px]">
                        {t.table.reference}
                      </TableHead>
                    ) : null}

                    {visibleColumns.posting ? (
                      <TableHead className="min-w-[170px]">
                        {t.table.posting}
                      </TableHead>
                    ) : null}

                    {visibleColumns.actions && canViewDetails ? (
                      <TableHead className="min-w-[90px]">
                        {t.table.action}
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading ? (
                    <TableSkeleton columnsCount={visibleColumnCount || 1} />
                  ) : paginatedRows.length > 0 ? (
                    paginatedRows.map((item) => (
                      <TableRow key={`${item.id}-${item.payment_number}`}>
                        {visibleColumns.paymentDate ? (
                          <TableCell className="whitespace-nowrap">
                            {formatDate(item.payment_date, locale)}
                          </TableCell>
                        ) : null}

                        {visibleColumns.paymentNumber ? (
                          <TableCell className="font-semibold" dir="ltr">
                            {item.payment_number || "-"}
                          </TableCell>
                        ) : null}

                        {visibleColumns.customer ? (
                          <TableCell>
                            <div className="min-w-[200px]">
                              <p className="font-medium">
                                {item.customer_name || "-"}
                              </p>
                              <p
                                className="text-xs text-muted-foreground"
                                dir="ltr"
                              >
                                {item.customer_phone || "-"}
                              </p>
                            </div>
                          </TableCell>
                        ) : null}

                        {visibleColumns.invoice ? (
                          <TableCell dir="ltr">
                            {item.invoice_number || "-"}
                          </TableCell>
                        ) : null}

                        {visibleColumns.order ? (
                          <TableCell dir="ltr">{item.order_number || "-"}</TableCell>
                        ) : null}

                        {visibleColumns.method ? (
                          <TableCell>{methodBadge(item.payment_method, locale)}</TableCell>
                        ) : null}

                        {visibleColumns.status ? (
                          <TableCell>{paymentStatusBadge(item.status, locale)}</TableCell>
                        ) : null}

                        {visibleColumns.amount ? (
                          <TableCell>
                            <MoneyText value={item.amount} />
                          </TableCell>
                        ) : null}

                        {visibleColumns.reference ? (
                          <TableCell dir="ltr">{item.reference || "-"}</TableCell>
                        ) : null}

                        {visibleColumns.posting ? (
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge
                                variant="outline"
                                className="w-fit rounded-full px-3 py-1"
                              >
                                {t.treasury}:{" "}
                                {item.is_treasury_posted ? t.posted : t.notPosted}
                              </Badge>
                              <Badge
                                variant="outline"
                                className="w-fit rounded-full px-3 py-1"
                              >
                                {t.accounting}:{" "}
                                {item.is_accounting_posted
                                  ? t.posted
                                  : t.notPosted}
                              </Badge>
                            </div>
                          </TableCell>
                        ) : null}

                        {visibleColumns.actions && canViewDetails ? (
                          <TableCell>
                            {isValidId(item.id) ? (
                              <Link href={`/system/payments/${item.id}`}>
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
                          <CreditCard className="h-10 w-10 text-muted-foreground/40" />
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
                            <Link href="/system/payments/create">
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