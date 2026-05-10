"use client";

/* ============================================================
   📂 app/system/invoices/[id]/page.tsx
   🧠 Primey Care | Invoice Details
   ------------------------------------------------------------
   ✅ تفاصيل الفاتورة
   ✅ إصدار / إلغاء حسب الصلاحيات والحالة
   ✅ تسجيل دفعة للفواتير غير المسددة
   ✅ Web PDF Print
   ✅ Skeleton / Error / Not Found
   ✅ Phase 17 UX + Phase 2 Permissions
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CalendarDays,
  CheckCircle2,
  Copy,
  CreditCard,
  FileText,
  Loader2,
  Printer,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  ShoppingCart,
  UserRound,
  WalletCards,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/AuthProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

type InvoiceItemRow = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  subtotal: number;
  total_amount: number;
};

type PaymentRow = {
  id: string;
  payment_number: string;
  payment_method: string;
  status: string;
  amount: number;
  paid_at: string;
  reference: string;
};

type InvoiceDetails = {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  payment_status: PaymentStatus;

  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;

  order_id: string;
  order_number: string;

  issue_date: string;
  due_date: string;
  created_at: string;
  source_reference: string;
  notes: string;

  subtotal: number;
  discount_amount: number;
  taxable_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;

  items: InvoiceItemRow[];
  payments: PaymentRow[];
};

type ApiEnvelope<T> = {
  ok?: boolean;
  success?: boolean;
  message?: string;
  detail?: string;
  error?: string;
  data?: T;
  invoice?: unknown;
  item?: unknown;
  results?: unknown[];
  items?: unknown[];
  rows?: unknown[];
  payments?: unknown[];
};

const SAR_ICON_PATH = "/currency/sar.svg";

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

function getCookie(name: string) {
  try {
    if (typeof document === "undefined") return "";

    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);

    if (parts.length === 2) return parts.pop()?.split(";").shift() || "";

    return "";
  } catch {
    return "";
  }
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
    title: isArabic ? "تفاصيل الفاتورة" : "Invoice Details",
    subtitle: isArabic
      ? "عرض بيانات الفاتورة والبنود والمدفوعات المرتبطة بها."
      : "View invoice information, line items, and related payments.",

    back: isArabic ? "قائمة الفواتير" : "Invoices List",
    dashboard: isArabic ? "الفواتير" : "Invoices",
    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    issue: isArabic ? "إصدار الفاتورة" : "Issue Invoice",
    cancel: isArabic ? "إلغاء الفاتورة" : "Cancel Invoice",
    createPayment: isArabic ? "تسجيل دفعة" : "Create Payment",

    profileTitle: isArabic ? "بطاقة الفاتورة" : "Invoice Card",
    invoiceInfo: isArabic ? "بيانات الفاتورة" : "Invoice Information",
    customerInfo: isArabic ? "بيانات العميل" : "Customer Information",
    orderInfo: isArabic ? "بيانات الطلب" : "Order Information",
    totalsTitle: isArabic ? "الإجماليات" : "Totals",
    itemsTitle: isArabic ? "بنود الفاتورة" : "Invoice Items",
    paymentsTitle: isArabic ? "المدفوعات" : "Payments",
    paymentsDesc: isArabic
      ? "المدفوعات المرتبطة بهذه الفاتورة."
      : "Payments related to this invoice.",

    invoiceNumber: isArabic ? "رقم الفاتورة" : "Invoice No.",
    customer: isArabic ? "العميل" : "Customer",
    phone: isArabic ? "الجوال" : "Phone",
    email: isArabic ? "البريد الإلكتروني" : "Email",
    order: isArabic ? "الطلب" : "Order",
    issueDate: isArabic ? "تاريخ الإصدار" : "Issue Date",
    dueDate: isArabic ? "تاريخ الاستحقاق" : "Due Date",
    createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
    status: isArabic ? "حالة الفاتورة" : "Invoice Status",
    paymentStatus: isArabic ? "حالة الدفع" : "Payment Status",
    sourceReference: isArabic ? "المرجع" : "Reference",
    notes: isArabic ? "ملاحظات" : "Notes",

    subtotal: isArabic ? "الإجمالي قبل الخصم" : "Subtotal",
    discountAmount: isArabic ? "الخصم" : "Discount",
    taxableAmount: isArabic ? "الخاضع للضريبة" : "Taxable",
    taxAmount: isArabic ? "الضريبة" : "Tax",
    totalAmount: isArabic ? "إجمالي الفاتورة" : "Invoice Total",
    paidAmount: isArabic ? "المدفوع" : "Paid",
    remainingAmount: isArabic ? "المتبقي" : "Remaining",

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
      description: isArabic ? "الوصف" : "Description",
      quantity: isArabic ? "الكمية" : "Qty",
      unitPrice: isArabic ? "سعر الوحدة" : "Unit Price",
      discount: isArabic ? "الخصم" : "Discount",
      tax: isArabic ? "الضريبة" : "Tax",
      total: isArabic ? "الإجمالي" : "Total",
      paymentNo: isArabic ? "رقم الدفعة" : "Payment No.",
      method: isArabic ? "طريقة الدفع" : "Method",
      date: isArabic ? "التاريخ" : "Date",
      amount: isArabic ? "المبلغ" : "Amount",
      reference: isArabic ? "المرجع" : "Reference",
      action: isArabic ? "الإجراء" : "Action",
    },

    view: isArabic ? "عرض" : "View",
    copy: isArabic ? "نسخ" : "Copy",
    copied: isArabic ? "تم النسخ." : "Copied.",
    notAvailable: isArabic ? "غير متوفر" : "Not available",

    emptyItems: isArabic ? "لا توجد بنود مسجلة." : "No items recorded.",
    emptyPayments: isArabic ? "لا توجد مدفوعات مسجلة." : "No payments recorded.",

    accessDeniedTitle: isArabic
      ? "غير مصرح بعرض الفاتورة"
      : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض تفاصيل الفواتير. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view invoice details. Contact your system administrator if you need access.",

    notFoundTitle: isArabic ? "الفاتورة غير موجودة" : "Invoice not found",
    notFoundText: isArabic
      ? "لم يتم العثور على الفاتورة المطلوبة."
      : "The requested invoice could not be found.",

    loadError: isArabic ? "تعذر تحميل الفاتورة." : "Unable to load invoice.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",

    issueConfirm: isArabic
      ? "هل تريد إصدار هذه الفاتورة؟"
      : "Issue this invoice?",
    cancelConfirm: isArabic
      ? "هل تريد إلغاء هذه الفاتورة؟"
      : "Cancel this invoice?",
    issueSuccess: isArabic
      ? "تم إصدار الفاتورة بنجاح."
      : "Invoice issued successfully.",
    cancelSuccess: isArabic
      ? "تم إلغاء الفاتورة بنجاح."
      : "Invoice cancelled successfully.",
    actionError: isArabic
      ? "تعذر تنفيذ العملية."
      : "Unable to complete the action.",
    printSuccess: isArabic
      ? "تم تجهيز نافذة الطباعة."
      : "Print window prepared.",
    printError: isArabic
      ? "تعذر فتح نافذة الطباعة."
      : "Unable to open print window.",
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

function normalizeItem(item: unknown, index: number): InvoiceItemRow {
  const obj = asDict(item);

  const quantity = toNumber(getNestedValue(obj, ["quantity", "qty"]));
  const unitPrice = toNumber(
    getNestedValue(obj, ["unit_price", "price", "unitPrice"]),
  );
  const discount = toNumber(
    getNestedValue(obj, ["discount_amount", "discount"]),
  );
  const taxRate = toNumber(getNestedValue(obj, ["tax_rate", "vat_rate"]));
  const taxAmount = toNumber(getNestedValue(obj, ["tax_amount", "vat_amount"]));

  const subtotalValue = getNestedValue(obj, ["subtotal", "sub_total"]);
  const totalValue = getNestedValue(obj, ["total_amount", "total", "line_total"]);

  const subtotal =
    subtotalValue !== undefined && subtotalValue !== null
      ? toNumber(subtotalValue)
      : quantity * unitPrice;

  const total =
    totalValue !== undefined && totalValue !== null
      ? toNumber(totalValue)
      : Math.max(subtotal - discount, 0) + taxAmount;

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || `${index}`),
    description: String(
      getNestedValue(obj, ["description", "name", "title", "label"]) || "-",
    ),
    quantity,
    unit_price: unitPrice,
    discount_amount: discount,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    subtotal,
    total_amount: total,
  };
}

function normalizePayment(item: unknown, index: number): PaymentRow {
  const obj = asDict(item);

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || `${index}`),
    payment_number: String(
      getNestedValue(obj, ["payment_number", "number", "code", "reference"]) ||
        "-",
    ),
    payment_method: String(
      getNestedValue(obj, ["payment_method", "method", "type"]) || "-",
    ),
    status: String(getNestedValue(obj, ["status", "state"]) || "-"),
    amount: toNumber(getNestedValue(obj, ["amount", "paid_amount", "total"])),
    paid_at: String(
      getNestedValue(obj, ["paid_at", "payment_date", "created_at", "date"]) ||
        "",
    ),
    reference: String(
      getNestedValue(obj, [
        "source_reference",
        "external_reference",
        "transaction_reference",
        "ref",
      ]) || "",
    ),
  };
}

function normalizeInvoice(payload: unknown): InvoiceDetails {
  const root = asDict(payload);
  const data = asDict(root.data);
  const invoiceObj = asDict(
    root.invoice || data.invoice || data.item || root.item || root.data || root,
  );
  const customerObj = asDict(invoiceObj.customer || invoiceObj.client);
  const orderObj = asDict(invoiceObj.order);

  const totalAmount = toNumber(
    getNestedValue(invoiceObj, [
      "total_amount",
      "grand_total",
      "net_amount",
      "amount",
      "total",
    ]),
  );

  const paidAmount = toNumber(
    getNestedValue(invoiceObj, ["paid_amount", "amount_paid", "collected_amount"]),
  );

  const remainingValue = getNestedValue(invoiceObj, [
    "remaining_amount",
    "balance_due",
    "due_amount",
  ]);

  const rawItems =
    extractRows({ data: invoiceObj }, "items").length > 0
      ? extractRows({ data: invoiceObj }, "items")
      : extractRows({ data: invoiceObj }, "lines");

  const rawPayments =
    extractRows({ data: invoiceObj }, "payments").length > 0
      ? extractRows({ data: invoiceObj }, "payments")
      : extractRows(root as ApiEnvelope<unknown>, "payments");

  return {
    id: String(getNestedValue(invoiceObj, ["id", "uuid", "pk"]) || ""),
    invoice_number: String(
      getNestedValue(invoiceObj, [
        "invoice_number",
        "number",
        "code",
        "reference",
      ]) || "-",
    ),
    status: normalizeInvoiceStatus(
      getNestedValue(invoiceObj, ["status", "invoice_status", "state"]),
    ),
    payment_status: normalizePaymentStatus(
      getNestedValue(invoiceObj, [
        "payment_status",
        "paid_status",
        "collection_status",
      ]),
    ),

    customer_id: String(
      customerObj.id ||
        getNestedValue(invoiceObj, ["customer_id", "client_id"]) ||
        "",
    ),
    customer_name: String(
      customerObj.name ||
        customerObj.full_name ||
        getNestedValue(invoiceObj, [
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
        getNestedValue(invoiceObj, ["customer_phone", "phone", "mobile"]) ||
        "",
    ),
    customer_email: String(
      customerObj.email || getNestedValue(invoiceObj, ["customer_email", "email"]) || "",
    ),

    order_id: String(orderObj.id || getNestedValue(invoiceObj, ["order_id"]) || ""),
    order_number: String(
      orderObj.order_number ||
        orderObj.number ||
        getNestedValue(invoiceObj, ["order_number", "order_reference"]) ||
        "-",
    ),

    issue_date: String(
      getNestedValue(invoiceObj, ["issue_date", "issued_at", "date", "created_at"]) ||
        "",
    ),
    due_date: String(
      getNestedValue(invoiceObj, ["due_date", "payment_due_date"]) || "",
    ),
    created_at: String(getNestedValue(invoiceObj, ["created_at", "created"]) || ""),
    source_reference: String(
      getNestedValue(invoiceObj, [
        "source_reference",
        "external_reference",
        "payment_reference",
        "ref",
      ]) || "",
    ),
    notes: String(getNestedValue(invoiceObj, ["notes", "description", "memo"]) || ""),

    subtotal: toNumber(getNestedValue(invoiceObj, ["subtotal", "sub_total"])),
    discount_amount: toNumber(
      getNestedValue(invoiceObj, ["discount_amount", "discount", "total_discount"]),
    ),
    taxable_amount: toNumber(
      getNestedValue(invoiceObj, ["taxable_amount", "net_before_tax"]),
    ),
    tax_amount: toNumber(
      getNestedValue(invoiceObj, ["tax_amount", "vat_amount", "total_tax"]),
    ),
    total_amount: totalAmount,
    paid_amount: paidAmount,
    remaining_amount:
      remainingValue !== undefined && remainingValue !== null
        ? toNumber(remainingValue)
        : Math.max(totalAmount - paidAmount, 0),

    items: rawItems.map(normalizeItem),
    payments: rawPayments.map(normalizePayment),
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
    <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardContent className="space-y-4 p-5">
          <SkeletonLine className="h-12 w-12 rounded-2xl" />
          <SkeletonLine className="h-7 w-44 rounded-xl" />
          <SkeletonLine className="h-4 w-32 rounded-xl" />
          <div className="space-y-3 pt-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonLine key={index} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="space-y-3 p-5">
              <SkeletonLine className="h-6 w-48 rounded-xl" />
              <SkeletonLine className="h-20 w-full rounded-xl" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   Print
============================================================ */

function buildPrintHtml({
  locale,
  invoice,
}: {
  locale: AppLocale;
  invoice: InvoiceDetails;
}) {
  const isArabic = locale === "ar";
  const t = dictionary(locale);
  const now = new Date().toLocaleString("en-US");

  const itemRows = invoice.items
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.description)}</td>
          <td>${escapeHtml(formatNumber(item.quantity))}</td>
          <td>${escapeHtml(formatMoney(item.unit_price))}</td>
          <td>${escapeHtml(formatMoney(item.discount_amount))}</td>
          <td>${escapeHtml(formatMoney(item.tax_amount))}</td>
          <td>${escapeHtml(formatMoney(item.total_amount))}</td>
        </tr>`,
    )
    .join("");

  return `
    <!doctype html>
    <html lang="${locale}" dir="${isArabic ? "rtl" : "ltr"}">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(invoice.invoice_number)}</title>
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
          h1 { margin: 0; font-size: 24px; font-weight: 800; }
          .meta { margin-top: 8px; color: #6b7280; font-size: 12px; line-height: 1.8; }
          .badge {
            border: 1px solid #d1d5db;
            border-radius: 999px;
            padding: 5px 12px;
            font-size: 12px;
            height: fit-content;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            margin-bottom: 18px;
          }
          .box {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 12px;
          }
          .box h2 { margin: 0 0 10px; font-size: 14px; }
          .row { display: flex; justify-content: space-between; gap: 10px; margin-top: 8px; font-size: 12px; }
          .label { color: #6b7280; }
          .value { font-weight: 700; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 14px; }
          th { background: #f3f4f6; color: #111827; font-weight: 700; }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 9px 8px;
            text-align: ${isArabic ? "right" : "left"};
            vertical-align: top;
          }
          .totals {
            margin-top: 16px;
            margin-inline-start: auto;
            width: 360px;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 12px;
          }
          @page { size: A4; margin: 12mm; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>${escapeHtml(t.title)}</h1>
            <div class="meta">
              <div>${escapeHtml(t.invoiceNumber)}: ${escapeHtml(invoice.invoice_number)}</div>
              <div>${escapeHtml(t.printedAt)}: ${escapeHtml(now)}</div>
            </div>
          </div>
          <div class="badge">Primey Care</div>
        </div>

        <div class="grid">
          <div class="box">
            <h2>${escapeHtml(t.invoiceInfo)}</h2>
            <div class="row"><span class="label">${escapeHtml(t.status)}</span><span class="value">${escapeHtml(invoiceStatusLabel(invoice.status, locale))}</span></div>
            <div class="row"><span class="label">${escapeHtml(t.paymentStatus)}</span><span class="value">${escapeHtml(paymentStatusLabel(invoice.payment_status, locale))}</span></div>
            <div class="row"><span class="label">${escapeHtml(t.issueDate)}</span><span class="value">${escapeHtml(formatDate(invoice.issue_date, locale))}</span></div>
            <div class="row"><span class="label">${escapeHtml(t.dueDate)}</span><span class="value">${escapeHtml(formatDate(invoice.due_date, locale))}</span></div>
          </div>

          <div class="box">
            <h2>${escapeHtml(t.customerInfo)}</h2>
            <div class="row"><span class="label">${escapeHtml(t.customer)}</span><span class="value">${escapeHtml(invoice.customer_name)}</span></div>
            <div class="row"><span class="label">${escapeHtml(t.phone)}</span><span class="value">${escapeHtml(invoice.customer_phone || "-")}</span></div>
            <div class="row"><span class="label">${escapeHtml(t.order)}</span><span class="value">${escapeHtml(invoice.order_number || "-")}</span></div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${escapeHtml(t.table.description)}</th>
              <th>${escapeHtml(t.table.quantity)}</th>
              <th>${escapeHtml(t.table.unitPrice)}</th>
              <th>${escapeHtml(t.table.discount)}</th>
              <th>${escapeHtml(t.table.tax)}</th>
              <th>${escapeHtml(t.table.total)}</th>
            </tr>
          </thead>
          <tbody>
            ${
              itemRows ||
              `<tr><td colspan="7" style="text-align:center">${escapeHtml(t.emptyItems)}</td></tr>`
            }
          </tbody>
        </table>

        <div class="totals">
          <div class="row"><span class="label">${escapeHtml(t.subtotal)}</span><span class="value">${escapeHtml(formatMoney(invoice.subtotal))}</span></div>
          <div class="row"><span class="label">${escapeHtml(t.discountAmount)}</span><span class="value">${escapeHtml(formatMoney(invoice.discount_amount))}</span></div>
          <div class="row"><span class="label">${escapeHtml(t.taxAmount)}</span><span class="value">${escapeHtml(formatMoney(invoice.tax_amount))}</span></div>
          <div class="row"><span class="label">${escapeHtml(t.paidAmount)}</span><span class="value">${escapeHtml(formatMoney(invoice.paid_amount))}</span></div>
          <div class="row"><span class="label">${escapeHtml(t.remainingAmount)}</span><span class="value">${escapeHtml(formatMoney(invoice.remaining_amount))}</span></div>
          <div class="row"><span class="label">${escapeHtml(t.totalAmount)}</span><span class="value">${escapeHtml(formatMoney(invoice.total_amount))}</span></div>
        </div>

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

export default function SystemInvoiceDetailsPage() {
  const params = useParams<{ id?: string | string[] }>();
  const auth = useAuth() as unknown;

  const invoiceId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notFound, setNotFound] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canView = hasSafePermission(
    auth,
    ["invoices.view", "billing.invoices.view"],
    "view",
  );

  const canIssue = hasSafePermission(
    auth,
    ["invoices.issue", "invoices.update", "billing.invoices.issue"],
    "action",
  );

  const canCancel = hasSafePermission(
    auth,
    ["invoices.cancel", "invoices.update", "billing.invoices.cancel"],
    "action",
  );

  const canPrint = hasSafePermission(
    auth,
    ["invoices.print", "reports.print"],
    "action",
  );

  const canCreatePayment = hasSafePermission(
    auth,
    ["payments.create", "billing.payments.create"],
    "action",
  );

  const canViewOrder = hasSafePermission(auth, ["orders.view"], "view");
  const canViewCustomer = hasSafePermission(auth, ["customers.view"], "view");
  const canViewPayment = hasSafePermission(auth, ["payments.view"], "view");

  const currentInvoiceStatus: InvoiceStatus = invoice?.status ?? "UNKNOWN";
  const currentPaymentStatus: PaymentStatus = invoice?.payment_status ?? "UNKNOWN";
  const currentRemainingAmount = invoice?.remaining_amount ?? 0;
  const currentInvoiceId = invoice?.id ?? "";

  const canIssueCurrent =
    invoice !== null &&
    canIssue &&
    ["DRAFT", "UNKNOWN"].includes(currentInvoiceStatus) &&
    currentInvoiceStatus !== "CANCELLED";

  const canCancelCurrent =
    invoice !== null &&
    canCancel &&
    !["PAID", "CANCELLED"].includes(currentInvoiceStatus) &&
    currentPaymentStatus !== "PAID";

  const canCreatePaymentCurrent =
    invoice !== null &&
    canCreatePayment &&
    currentInvoiceStatus !== "CANCELLED" &&
    currentRemainingAmount > 0 &&
    Boolean(currentInvoiceId);

  const loadInvoice = useCallback(
    async (showToast = false) => {
      if (!canView || !invoiceId) {
        setInvoice(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");
        setNotFound(false);

        const endpoints = [
          `/api/invoices/${invoiceId}/`,
          `/api/invoices/detail/${invoiceId}/`,
          `/api/invoices/detail/?id=${invoiceId}`,
        ];

        let payload: ApiEnvelope<unknown> | null = null;
        let lastStatus = 0;
        let lastError = "";

        for (const endpoint of endpoints) {
          const response = await fetch(apiUrl(endpoint), {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: { Accept: "application/json" },
          });

          lastStatus = response.status;

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
          if (lastStatus === 404) {
            setNotFound(true);
            setInvoice(null);
            return;
          }

          throw new Error(lastError || t.loadError);
        }

        setInvoice(normalizeInvoice(payload));

        if (showToast) {
          toast.success(t.refresh);
        }
      } catch (error) {
        console.error("Load invoice details error:", error);
        setInvoice(null);
        setErrorMessage(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [canView, invoiceId, t.loadError, t.refresh],
  );

  async function runInvoiceAction(action: "issue" | "cancel") {
    if (!invoice || !invoice.id) return;

    const confirmed = window.confirm(
      action === "issue" ? t.issueConfirm : t.cancelConfirm,
    );

    if (!confirmed) return;

    try {
      setIsActionLoading(true);

      const csrfToken = getCookie("csrftoken");

      const endpoints =
        action === "issue"
          ? ["/api/invoices/issue/", `/api/invoices/${invoice.id}/issue/`]
          : ["/api/invoices/cancel/", `/api/invoices/${invoice.id}/cancel/`];

      let success = false;
      let lastError = "";

      for (const endpoint of endpoints) {
        const response = await fetch(apiUrl(endpoint), {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
          },
          body: JSON.stringify({
            invoice_id: invoice.id,
            id: invoice.id,
          }),
        });

        const payload = (await response.json().catch(() => null)) as
          | ApiEnvelope<unknown>
          | null;

        if (
          response.ok &&
          payload?.ok !== false &&
          payload?.success !== false
        ) {
          success = true;
          break;
        }

        lastError =
          payload?.message ||
          payload?.detail ||
          payload?.error ||
          `HTTP ${response.status}`;
      }

      if (!success) {
        throw new Error(lastError || t.actionError);
      }

      toast.success(action === "issue" ? t.issueSuccess : t.cancelSuccess);
      await loadInvoice(false);
    } catch (error) {
      console.error("Invoice action error:", error);
      toast.error(t.actionError);
    } finally {
      setIsActionLoading(false);
    }
  }

  function printPage() {
    if (!invoice) return;

    const printWindow = window.open("", "_blank", "width=980,height=720");

    if (!printWindow) {
      toast.error(t.printError);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      buildPrintHtml({
        locale,
        invoice,
      }),
    );
    printWindow.document.close();

    toast.success(t.printSuccess);
  }

  function copyValue(value: string) {
    if (!value) return;

    navigator.clipboard.writeText(value);
    toast.success(t.copied);
  }

  useEffect(() => {
    const nextLocale = readLocale();

    setLocale(nextLocale);
    applyDocumentLocale(nextLocale);
  }, []);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  if (authResolving) {
    return (
      <div className="w-full space-y-4" dir={isArabic ? "rtl" : "ltr"}>
        <PageSkeleton />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="w-full space-y-4" dir={isArabic ? "rtl" : "ltr"}>
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 shadow-sm">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <ShieldCheck className="h-5 w-5" />
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
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              <ReceiptText className="h-3.5 w-3.5" />
              {t.dashboard}
            </Badge>

            {invoice ? invoiceStatusBadge(invoice.status, locale) : null}
            {invoice ? paymentStatusBadge(invoice.payment_status, locale) : null}
          </div>

          <h1 className="mt-3 text-xl font-bold tracking-tight lg:text-2xl">
            {invoice?.invoice_number || t.title}
          </h1>

          <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
            {t.subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
          <Link href="/system/invoices/list">
            <Button variant="outline" className="h-10 w-full rounded-xl sm:w-auto">
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadInvoice(true)}
            disabled={isLoading || isActionLoading}
          >
            <RefreshCcw className="h-4 w-4" />
            <span>{t.refresh}</span>
          </Button>

          {canPrint ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={printPage}
              disabled={isLoading || isActionLoading || !invoice}
            >
              <Printer className="h-4 w-4" />
              <span>{t.print}</span>
            </Button>
          ) : null}

          {canIssueCurrent ? (
            <Button
              className="h-10 rounded-xl"
              onClick={() => runInvoiceAction("issue")}
              disabled={isActionLoading}
            >
              {isActionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <span>{t.issue}</span>
            </Button>
          ) : null}

          {canCancelCurrent ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl text-destructive hover:text-destructive"
              onClick={() => runInvoiceAction("cancel")}
              disabled={isActionLoading}
            >
              {isActionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Ban className="h-4 w-4" />
              )}
              <span>{t.cancel}</span>
            </Button>
          ) : null}

          {canCreatePaymentCurrent ? (
            <Link href={`/system/payments/create?invoice=${currentInvoiceId}`}>
              <Button className="h-10 w-full rounded-xl sm:w-auto">
                <CreditCard className="h-4 w-4" />
                <span>{t.createPayment}</span>
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
                <AlertTriangle className="h-5 w-5" />
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
              onClick={() => loadInvoice(true)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && notFound ? (
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-lg font-semibold">{t.notFoundTitle}</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {t.notFoundText}
            </p>
            <Link href="/system/invoices/list">
              <Button className="mt-2 rounded-xl">
                <ArrowLeft className="h-4 w-4" />
                {t.back}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? <PageSkeleton /> : null}

      {!isLoading && invoice ? (
        <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ReceiptText className="h-5 w-5" />
                  {t.profileTitle}
                </CardTitle>
                <CardDescription>{invoice.invoice_number}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                  <ReceiptText className="h-7 w-7 text-muted-foreground" />
                </div>

                <div>
                  <p className="text-lg font-bold">{invoice.invoice_number}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {invoiceStatusBadge(invoice.status, locale)}
                    {paymentStatusBadge(invoice.payment_status, locale)}
                  </div>
                </div>

                <div className="grid gap-3">
                  <InfoItem
                    label={t.customer}
                    value={invoice.customer_name}
                    icon={<UserRound className="h-4 w-4" />}
                  />
                  <InfoItem
                    label={t.order}
                    value={invoice.order_number}
                    icon={<ShoppingCart className="h-4 w-4" />}
                  />
                  <InfoItem
                    label={t.issueDate}
                    value={formatDate(invoice.issue_date, locale)}
                    icon={<CalendarDays className="h-4 w-4" />}
                  />
                  <InfoItem
                    label={t.totalAmount}
                    value={formatMoney(invoice.total_amount)}
                    icon={<WalletCards className="h-4 w-4" />}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader>
                <CardTitle>{t.totalsTitle}</CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                <TotalRow label={t.subtotal} value={invoice.subtotal} />
                <TotalRow label={t.discountAmount} value={invoice.discount_amount} />
                <TotalRow label={t.taxAmount} value={invoice.tax_amount} />
                <TotalRow label={t.paidAmount} value={invoice.paid_amount} />
                <TotalRow label={t.remainingAmount} value={invoice.remaining_amount} />
                <div className="border-t pt-3">
                  <TotalRow
                    label={t.totalAmount}
                    value={invoice.total_amount}
                    strong
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {t.invoiceInfo}
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  <DetailBox label={t.invoiceNumber} value={invoice.invoice_number} onCopy={() => copyValue(invoice.invoice_number)} />
                  <DetailBox label={t.status} value={invoiceStatusLabel(invoice.status, locale)} />
                  <DetailBox label={t.paymentStatus} value={paymentStatusLabel(invoice.payment_status, locale)} />
                  <DetailBox label={t.issueDate} value={formatDate(invoice.issue_date, locale)} />
                  <DetailBox label={t.dueDate} value={formatDate(invoice.due_date, locale)} />
                  <DetailBox label={t.createdAt} value={formatDate(invoice.created_at, locale)} />
                  <DetailBox label={t.sourceReference} value={invoice.source_reference || t.notAvailable} onCopy={invoice.source_reference ? () => copyValue(invoice.source_reference) : undefined} />
                </div>

                {invoice.notes ? (
                  <Alert className="mt-4 rounded-2xl">
                    <FileText className="h-4 w-4" />
                    <AlertTitle>{t.notes}</AlertTitle>
                    <AlertDescription className="whitespace-pre-wrap">
                      {invoice.notes}
                    </AlertDescription>
                  </Alert>
                ) : null}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserRound className="h-5 w-5" />
                    {t.customerInfo}
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-3">
                  <DetailBox label={t.customer} value={invoice.customer_name} />
                  <DetailBox label={t.phone} value={invoice.customer_phone || t.notAvailable} />
                  <DetailBox label={t.email} value={invoice.customer_email || t.notAvailable} />

                  {canViewCustomer && isValidId(invoice.customer_id) ? (
                    <Link href={`/system/customers/${invoice.customer_id}`}>
                      <Button variant="outline" className="w-full rounded-xl">
                        <UserRound className="h-4 w-4" />
                        {t.view}
                      </Button>
                    </Link>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    {t.orderInfo}
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-3">
                  <DetailBox label={t.order} value={invoice.order_number} />
                  <DetailBox label={t.sourceReference} value={invoice.source_reference || t.notAvailable} />

                  {canViewOrder && isValidId(invoice.order_id) ? (
                    <Link href={`/system/orders/${invoice.order_id}`}>
                      <Button variant="outline" className="w-full rounded-xl">
                        <ShoppingCart className="h-4 w-4" />
                        {t.view}
                      </Button>
                    </Link>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader>
                <CardTitle>{t.itemsTitle}</CardTitle>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>{t.table.description}</TableHead>
                        <TableHead>{t.table.quantity}</TableHead>
                        <TableHead>{t.table.unitPrice}</TableHead>
                        <TableHead>{t.table.discount}</TableHead>
                        <TableHead>{t.table.tax}</TableHead>
                        <TableHead>{t.table.total}</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {invoice.items.length > 0 ? (
                        invoice.items.map((item, index) => (
                          <TableRow key={item.id}>
                            <TableCell>{formatNumber(index + 1)}</TableCell>
                            <TableCell className="min-w-[220px]">
                              {item.description}
                            </TableCell>
                            <TableCell>{formatNumber(item.quantity)}</TableCell>
                            <TableCell>
                              <MoneyText value={item.unit_price} />
                            </TableCell>
                            <TableCell>
                              <MoneyText value={item.discount_amount} />
                            </TableCell>
                            <TableCell>
                              <MoneyText value={item.tax_amount} />
                            </TableCell>
                            <TableCell>
                              <MoneyText value={item.total_amount} />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                            {t.emptyItems}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  {t.paymentsTitle}
                </CardTitle>
                <CardDescription>{t.paymentsDesc}</CardDescription>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.table.paymentNo}</TableHead>
                        <TableHead>{t.table.method}</TableHead>
                        <TableHead>{t.status}</TableHead>
                        <TableHead>{t.table.amount}</TableHead>
                        <TableHead>{t.table.date}</TableHead>
                        <TableHead>{t.table.reference}</TableHead>
                        {canViewPayment ? <TableHead>{t.table.action}</TableHead> : null}
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {invoice.payments.length > 0 ? (
                        invoice.payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>{payment.payment_number}</TableCell>
                            <TableCell>{payment.payment_method}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="rounded-full">
                                {payment.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <MoneyText value={payment.amount} />
                            </TableCell>
                            <TableCell>{formatDate(payment.paid_at, locale)}</TableCell>
                            <TableCell>{payment.reference || "-"}</TableCell>
                            {canViewPayment ? (
                              <TableCell>
                                {isValidId(payment.id) ? (
                                  <Link href={`/system/payments/${payment.id}`}>
                                    <Button variant="outline" size="sm" className="rounded-xl">
                                      {t.view}
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
                            colSpan={canViewPayment ? 7 : 6}
                            className="py-8 text-center text-muted-foreground"
                          >
                            {t.emptyPayments}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ============================================================
   Small Components
============================================================ */

function InfoItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-background p-3">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold">{value || "-"}</p>
      </div>
    </div>
  );
}

function DetailBox({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
}) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="min-w-0 break-words text-sm font-semibold">{value || "-"}</p>
        {onCopy ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-lg"
            onClick={onCopy}
          >
            <Copy className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function TotalRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={strong ? "font-bold" : "text-sm text-muted-foreground"}>
        {label}
      </span>
      <span className={strong ? "text-lg font-bold" : "text-sm font-semibold"}>
        <MoneyText value={value} />
      </span>
    </div>
  );
}