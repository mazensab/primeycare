"use client";

/* ============================================================
   📂 app/system/orders/[id]/page.tsx
   🧠 Primey Care | Order Details
   ------------------------------------------------------------
   ✅ المرحلة 17 + المرحلة 2
   ✅ مبني بنفس نمط تفاصيل المراكز/العملاء المعتمد
   ✅ Side Profile Card + Main Content
   ✅ Error State مستقل عن Not Found
   ✅ Skeleton Loading
   ✅ Web PDF Print
   ✅ Lifecycle Actions آمنة حسب الصلاحيات والحالة
   ✅ لا يوجد حذف نهائي
   ✅ لا توجد أزرار وهمية
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
import { useParams } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Copy,
  CreditCard,
  Eye,
  FileText,
  Loader2,
  Package,
  Printer,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Stethoscope,
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
import {
  Table,
  TableBody,
  TableCell,
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

type StatusAction =
  | "confirm"
  | "processing"
  | "complete"
  | "cancel"
  | "refund";

type OrderDetail = {
  id: number | string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  productId: string;
  productName: string;
  providerId: string;
  providerName: string;
  agentId: string;
  agentName: string;
  contractId: string;
  contractCode: string;
  invoiceId: string;
  invoiceNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  discountAmount: number;
  taxAmount: number;
  agentCommission: number;
  notes: string;
  internalNotes: string;
  createdAt: string;
  updatedAt: string;
  raw: Record<string, unknown>;
};

type OrderDetailResponse = {
  ok?: boolean;
  message?: string;
  data?: unknown;
  order?: unknown;
  item?: unknown;
};

type StatusApiResponse = {
  ok?: boolean;
  message?: string;
  data?: unknown;
  order?: unknown;
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
   API Helpers
============================================================ */

function apiUrl(path: string) {
  const base =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "";

  if (!base) return path;

  return `${base.replace(/\/$/, "")}${path}`;
}

function readCookie(name: string) {
  if (typeof document === "undefined") return "";

  const match = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.split("=")[1] || "") : "";
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

function unwrapOrder(payload: unknown): unknown {
  const wrapper = (payload || {}) as OrderDetailResponse;

  return wrapper.data || wrapper.order || wrapper.item || payload || {};
}

function normalizeOrderDetail(payload: unknown): OrderDetail {
  const obj = unwrapOrder(payload) as Record<string, unknown>;

  const customer = obj.customer as Record<string, unknown> | undefined;
  const product = obj.product as Record<string, unknown> | undefined;
  const provider = (obj.provider || obj.center) as
    | Record<string, unknown>
    | undefined;
  const agent = obj.agent as Record<string, unknown> | undefined;
  const invoice = obj.invoice as Record<string, unknown> | undefined;
  const contract = obj.contract as Record<string, unknown> | undefined;

  const id = getObjectValue(obj, "id") ?? "";

  const orderNumber =
    getObjectValue(obj, "order_number") ??
    getObjectValue(obj, "number") ??
    getObjectValue(obj, "reference") ??
    (id ? `ORD-${id}` : "-");

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
    customerId: String(
      getObjectValue(obj, "customer_id") ?? customer?.id ?? "",
    ),
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
    customerEmail: String(
      getObjectValue(obj, "customer_email") ?? customer?.email ?? "",
    ),
    productId: String(getObjectValue(obj, "product_id") ?? product?.id ?? ""),
    productName: String(
      getObjectValue(obj, "product_name") ??
        product?.name ??
        product?.title ??
        "-",
    ),
    providerId: String(
      getObjectValue(obj, "provider_id") ??
        getObjectValue(obj, "center_id") ??
        provider?.id ??
        "",
    ),
    providerName: String(
      getObjectValue(obj, "provider_name") ??
        getObjectValue(obj, "center_name") ??
        provider?.name ??
        "-",
    ),
    agentId: String(getObjectValue(obj, "agent_id") ?? agent?.id ?? ""),
    agentName: String(
      getObjectValue(obj, "agent_name") ??
        agent?.name ??
        agent?.full_name ??
        "-",
    ),
    contractId: String(
      getObjectValue(obj, "contract_id") ?? contract?.id ?? "",
    ),
    contractCode: String(
      getObjectValue(obj, "contract_code") ??
        contract?.code ??
        contract?.contract_number ??
        "",
    ),
    invoiceId: String(getObjectValue(obj, "invoice_id") ?? invoice?.id ?? ""),
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
    discountAmount: toNumber(
      getObjectValue(obj, "discount_amount") ??
        getObjectValue(obj, "discount") ??
        0,
    ),
    taxAmount: toNumber(getObjectValue(obj, "tax_amount") ?? 0),
    agentCommission: toNumber(
      getObjectValue(obj, "agent_commission") ??
        getObjectValue(obj, "commission_amount") ??
        0,
    ),
    notes: String(getObjectValue(obj, "notes") ?? ""),
    internalNotes: String(
      getObjectValue(obj, "internal_notes") ??
        getObjectValue(obj, "admin_notes") ??
        "",
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
    title: isArabic ? "تفاصيل الطلب" : "Order Details",
    subtitle: isArabic
      ? "عرض دورة الطلب، العميل، المنتج، المركز، العقد، الفاتورة، الدفع، والتنفيذ."
      : "View order lifecycle, customer, product, provider, contract, invoice, payment, and fulfillment.",

    back: isArabic ? "العودة للطلبات" : "Back to Orders",
    ordersList: isArabic ? "قائمة الطلبات" : "Orders List",
    refresh: isArabic ? "تحديث" : "Refresh",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    retry: isArabic ? "إعادة المحاولة" : "Retry",

    confirmOrder: isArabic ? "تأكيد الطلب" : "Confirm Order",
    startProcessing: isArabic ? "بدء التنفيذ" : "Start Processing",
    completeOrder: isArabic ? "إكمال الطلب" : "Complete Order",
    cancelOrder: isArabic ? "إلغاء الطلب" : "Cancel Order",
    refundOrder: isArabic ? "استرداد الطلب" : "Refund Order",

    confirmAction: isArabic
      ? "هل تريد تنفيذ هذا الإجراء على الطلب؟"
      : "Do you want to apply this action to the order?",

    overview: isArabic ? "نظرة عامة" : "Overview",
    overviewDesc: isArabic
      ? "بيانات الطلب الأساسية وحالته التشغيلية."
      : "Basic order information and operational status.",

    customer: isArabic ? "بيانات العميل" : "Customer Information",
    customerDesc: isArabic
      ? "اسم العميل وبيانات التواصل المرتبطة بالطلب."
      : "Customer name and contact information linked to the order.",

    productProvider: isArabic ? "المنتج والمركز" : "Product & Provider",
    productProviderDesc: isArabic
      ? "المنتج أو البرنامج والمركز أو مقدم الخدمة."
      : "Product/program and provider/center information.",

    financial: isArabic ? "البيانات المالية" : "Financial Details",
    financialDesc: isArabic
      ? "إجمالي الطلب والمدفوع والمتبقي والضريبة والعمولة."
      : "Order total, paid, remaining, tax, and commission.",

    links: isArabic ? "الروابط التشغيلية" : "Operational Links",
    linksDesc: isArabic
      ? "العقد والفاتورة والمندوب المرتبطين بالطلب."
      : "Contract, invoice, and agent linked to the order.",

    notes: isArabic ? "الملاحظات" : "Notes",
    notesDesc: isArabic
      ? "الملاحظات العامة والداخلية الخاصة بالطلب."
      : "General and internal notes for this order.",

    quickInfo: isArabic ? "معلومات سريعة" : "Quick Info",
    copy: isArabic ? "نسخ" : "Copy",
    copied: isArabic ? "تم النسخ بنجاح" : "Copied successfully",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الصفحة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض تفاصيل الطلبات. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view order details. Contact your system administrator if you need access.",

    notFoundTitle: isArabic ? "الطلب غير موجود" : "Order not found",
    notFoundText: isArabic
      ? "لم يتم العثور على الطلب المطلوب أو قد يكون غير متاح."
      : "The requested order could not be found or may not be available.",

    loadError: isArabic
      ? "تعذر تحميل تفاصيل الطلب."
      : "Unable to load order details.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    refreshSuccess: isArabic
      ? "تم تحديث تفاصيل الطلب بنجاح."
      : "Order details refreshed successfully.",
    actionSuccess: isArabic
      ? "تم تحديث حالة الطلب بنجاح."
      : "Order status updated successfully.",
    actionError: isArabic
      ? "تعذر تحديث حالة الطلب."
      : "Unable to update order status.",
    printReady: isArabic
      ? "تم تجهيز نافذة الطباعة."
      : "Print window prepared.",
    printError: isArabic
      ? "تعذر فتح نافذة الطباعة."
      : "Unable to open print window.",

    fields: {
      id: isArabic ? "المعرف" : "ID",
      orderNumber: isArabic ? "رقم الطلب" : "Order Number",
      status: isArabic ? "حالة الطلب" : "Order Status",
      paymentStatus: isArabic ? "حالة الدفع" : "Payment Status",
      fulfillmentStatus: isArabic ? "حالة التنفيذ" : "Fulfillment Status",
      customerName: isArabic ? "اسم العميل" : "Customer Name",
      customerPhone: isArabic ? "رقم الجوال" : "Phone",
      customerEmail: isArabic ? "البريد الإلكتروني" : "Email",
      productName: isArabic ? "المنتج" : "Product",
      providerName: isArabic ? "المركز / مقدم الخدمة" : "Provider / Center",
      agentName: isArabic ? "المندوب" : "Agent",
      contractCode: isArabic ? "العقد" : "Contract",
      invoiceNumber: isArabic ? "الفاتورة" : "Invoice",
      totalAmount: isArabic ? "إجمالي الطلب" : "Total Amount",
      paidAmount: isArabic ? "المدفوع" : "Paid Amount",
      remainingAmount: isArabic ? "المتبقي" : "Remaining",
      discountAmount: isArabic ? "الخصم" : "Discount",
      taxAmount: isArabic ? "الضريبة" : "Tax",
      agentCommission: isArabic ? "عمولة المندوب" : "Agent Commission",
      notes: isArabic ? "ملاحظات الطلب" : "Order Notes",
      internalNotes: isArabic ? "ملاحظات داخلية" : "Internal Notes",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      updatedAt: isArabic ? "آخر تحديث" : "Updated At",
    },

    orderStatuses: {
      pending: isArabic ? "معلق" : "Pending",
      confirmed: isArabic ? "مؤكد" : "Confirmed",
      processing: isArabic ? "قيد التنفيذ" : "Processing",
      completed: isArabic ? "مكتمل" : "Completed",
      cancelled: isArabic ? "ملغي" : "Cancelled",
      refunded: isArabic ? "مسترد" : "Refunded",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<OrderStatus, string>,

    paymentStatuses: {
      unpaid: isArabic ? "غير مدفوع" : "Unpaid",
      partial: isArabic ? "مدفوع جزئيًا" : "Partial",
      paid: isArabic ? "مدفوع" : "Paid",
      refunded: isArabic ? "مسترد" : "Refunded",
      cancelled: isArabic ? "ملغي" : "Cancelled",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<PaymentStatus, string>,

    fulfillmentStatuses: {
      not_started: isArabic ? "لم يبدأ" : "Not Started",
      in_progress: isArabic ? "قيد التنفيذ" : "In Progress",
      fulfilled: isArabic ? "منفذ" : "Fulfilled",
      failed: isArabic ? "فشل" : "Failed",
      cancelled: isArabic ? "ملغي" : "Cancelled",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<FulfillmentStatus, string>,

    empty: isArabic ? "لا توجد بيانات" : "No data",
    unavailable: isArabic ? "غير متوفر" : "Unavailable",
    printedAt: isArabic ? "تاريخ الطباعة" : "Printed At",
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

function isValidId(id: unknown) {
  const value = String(id || "").trim();

  return value.length > 0 && value !== "-" && value !== "undefined";
}

function orderStatusLabel(status: OrderStatus, locale: AppLocale) {
  return dictionary(locale).orderStatuses[status];
}

function paymentStatusLabel(status: PaymentStatus, locale: AppLocale) {
  return dictionary(locale).paymentStatuses[status];
}

function fulfillmentStatusLabel(status: FulfillmentStatus, locale: AppLocale) {
  return dictionary(locale).fulfillmentStatuses[status];
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

function statusBadge(status: OrderStatus, locale: AppLocale) {
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

function paymentBadge(status: PaymentStatus, locale: AppLocale) {
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

function fulfillmentBadge(status: FulfillmentStatus, locale: AppLocale) {
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

  return (
    <Badge variant="outline" className="rounded-full px-3 py-1">
      {label}
    </Badge>
  );
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function DetailSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardContent className="space-y-4 p-5">
          <SkeletonLine className="h-16 w-16 rounded-2xl" />
          <SkeletonLine className="h-6 w-48" />
          <SkeletonLine className="h-4 w-32" />
          <div className="grid gap-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonLine key={index} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index} className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="space-y-3 p-5">
              <SkeletonLine className="h-5 w-40" />
              <SkeletonLine className="h-4 w-full" />
              <SkeletonLine className="h-4 w-3/4" />
              <SkeletonLine className="h-4 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function copyToClipboard(value: string, successMessage: string) {
  if (!value || value === "-") return;

  navigator.clipboard.writeText(value);
  toast.success(successMessage);
}

function InfoRow({
  label,
  value,
  copyable,
  copiedMessage,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  copiedMessage: string;
}) {
  return (
    <TableRow>
      <TableCell className="w-[220px] text-muted-foreground">{label}</TableCell>
      <TableCell>
        <div className="flex items-center justify-between gap-3">
          <span className="break-words font-medium">{value || "-"}</span>

          {copyable && value && value !== "-" ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg"
              onClick={() => copyToClipboard(value, copiedMessage)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

function QuickInfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-background p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold">{value || "-"}</p>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <div className="mt-2 text-lg font-bold">{value}</div>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function TextSection({
  label,
  value,
  empty,
}: {
  label: string;
  value: string;
  empty: string;
}) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
        {value || empty}
      </p>
    </div>
  );
}

/* ============================================================
   Print
============================================================ */

function buildPrintHtml({
  locale,
  order,
  t,
}: {
  locale: AppLocale;
  order: OrderDetail;
  t: ReturnType<typeof dictionary>;
}) {
  const isArabic = locale === "ar";
  const now = new Date().toLocaleString("en-US");

  const rows: Array<[string, string]> = [
    [t.fields.orderNumber, order.orderNumber],
    [t.fields.customerName, order.customerName],
    [t.fields.customerPhone, order.customerPhone || "-"],
    [t.fields.productName, order.productName],
    [t.fields.providerName, order.providerName],
    [t.fields.agentName, order.agentName || "-"],
    [t.fields.contractCode, order.contractCode || "-"],
    [t.fields.invoiceNumber, order.invoiceNumber || "-"],
    [t.fields.status, orderStatusLabel(order.status, locale)],
    [t.fields.paymentStatus, paymentStatusLabel(order.paymentStatus, locale)],
    [
      t.fields.fulfillmentStatus,
      fulfillmentStatusLabel(order.fulfillmentStatus, locale),
    ],
    [t.fields.totalAmount, formatMoney(order.totalAmount)],
    [t.fields.paidAmount, formatMoney(order.paidAmount)],
    [t.fields.remainingAmount, formatMoney(order.remainingAmount)],
    [t.fields.discountAmount, formatMoney(order.discountAmount)],
    [t.fields.taxAmount, formatMoney(order.taxAmount)],
    [t.fields.agentCommission, formatMoney(order.agentCommission)],
    [t.fields.createdAt, formatDate(order.createdAt)],
    [t.fields.updatedAt, formatDate(order.updatedAt || order.createdAt)],
  ];

  return `
    <!doctype html>
    <html lang="${locale}" dir="${isArabic ? "rtl" : "ltr"}">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(t.title)}</title>
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
            gap: 16px;
            align-items: flex-start;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 14px;
            margin-bottom: 18px;
          }
          h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 800;
          }
          .meta {
            margin-top: 8px;
            font-size: 12px;
            line-height: 1.8;
            color: #6b7280;
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
            font-size: 13px;
            margin-bottom: 18px;
          }
          th,
          td {
            border: 1px solid #e5e7eb;
            padding: 10px 9px;
            text-align: ${isArabic ? "right" : "left"};
            vertical-align: top;
          }
          th {
            width: 240px;
            background: #f3f4f6;
            color: #111827;
          }
          .section-title {
            margin: 18px 0 8px;
            font-size: 16px;
            font-weight: 800;
          }
          .text-block {
            border: 1px solid #e5e7eb;
            padding: 12px;
            border-radius: 12px;
            line-height: 1.8;
            white-space: pre-wrap;
          }
          @page {
            size: A4;
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
            <h1>${escapeHtml(order.orderNumber)}</h1>
            <div class="meta">
              <div>${escapeHtml(t.fields.customerName)}: ${escapeHtml(order.customerName)}</div>
              <div>${escapeHtml(t.printedAt)}: ${escapeHtml(now)}</div>
            </div>
          </div>
          <div class="badge">Primey Care</div>
        </div>

        <table>
          <tbody>
            ${rows
              .map(
                ([label, value]) => `
                  <tr>
                    <th>${escapeHtml(label)}</th>
                    <td>${escapeHtml(value || "-")}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>

        <div class="section-title">${escapeHtml(t.fields.notes)}</div>
        <div class="text-block">${escapeHtml(order.notes || "-")}</div>

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

export default function SystemOrderDetailsPage() {
  const params = useParams();
  const auth = useAuth() as unknown;

  const orderId = String(params?.id || "");

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [actionLoading, setActionLoading] = useState<StatusAction | null>(null);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const authResolving = isAuthResolving(auth);

  const canViewOrders = hasSafePermission(
    auth,
    ["orders.view", "orders.detail", "orders.list"],
    "view",
  );

  const canViewOrdersList = hasSafePermission(
    auth,
    ["orders.view", "orders.list"],
    "view",
  );

  const canPrintOrders = hasSafePermission(
    auth,
    ["orders.print", "reports.print"],
    "action",
  );

  const canUpdateStatus = hasSafePermission(
    auth,
    ["orders.update", "orders.status", "orders.approve"],
    "action",
  );

  const canCancelOrders = hasSafePermission(
    auth,
    ["orders.cancel"],
    "action",
  );

  const canViewCustomers = hasSafePermission(
    auth,
    ["customers.view", "customers.detail"],
    "view",
  );

  const canViewProducts = hasSafePermission(
    auth,
    ["products.view", "products.detail"],
    "view",
  );

  const canViewProviders = hasSafePermission(
    auth,
    ["providers.view", "providers.detail", "centers.view", "centers.detail"],
    "view",
  );

  const canViewAgents = hasSafePermission(
    auth,
    ["agents.view", "agents.detail"],
    "view",
  );

  const canViewContracts = hasSafePermission(
    auth,
    ["contracts.view", "contracts.detail"],
    "view",
  );

  const canViewInvoices = hasSafePermission(
    auth,
    ["invoices.view", "invoices.detail"],
    "view",
  );

  const availableActions = useMemo(() => {
    if (!order) return [];

    const actions: Array<{
      key: StatusAction;
      label: string;
      icon: ComponentType<{ className?: string }>;
      allowed: boolean;
    }> = [];

    if (order.status === "pending") {
      actions.push({
        key: "confirm",
        label: t.confirmOrder,
        icon: BadgeCheck,
        allowed: canUpdateStatus,
      });
    }

    if (order.status === "confirmed") {
      actions.push({
        key: "processing",
        label: t.startProcessing,
        icon: RotateCcw,
        allowed: canUpdateStatus,
      });
    }

    if (order.status === "processing" || order.status === "confirmed") {
      actions.push({
        key: "complete",
        label: t.completeOrder,
        icon: CheckCircle2,
        allowed: canUpdateStatus,
      });
    }

    if (!["cancelled", "completed", "refunded"].includes(order.status)) {
      actions.push({
        key: "cancel",
        label: t.cancelOrder,
        icon: Ban,
        allowed: canCancelOrders,
      });
    }

    if (order.status === "completed" || order.paymentStatus === "paid") {
      actions.push({
        key: "refund",
        label: t.refundOrder,
        icon: CreditCard,
        allowed: canCancelOrders || canUpdateStatus,
      });
    }

    return actions.filter((action) => action.allowed);
  }, [canCancelOrders, canUpdateStatus, order, t]);

  const loadOrder = useCallback(
    async (showToast = false) => {
      if (!canViewOrders) {
        setIsLoading(false);
        setOrder(null);
        return;
      }

      if (!isValidId(orderId)) {
        setIsLoading(false);
        setOrder(null);
        setNotFound(true);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");
        setNotFound(false);

        const response = await fetch(
          apiUrl(`/api/orders/${encodeURIComponent(orderId)}/`),
          {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          },
        );

        const payload = (await response.json().catch(() => null)) as
          | OrderDetailResponse
          | null;

        if (response.status === 404) {
          setOrder(null);
          setNotFound(true);
          return;
        }

        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.message || `HTTP ${response.status}`);
        }

        const normalized = normalizeOrderDetail(payload);

        if (!isValidId(normalized.id)) {
          setOrder(null);
          setNotFound(true);
          return;
        }

        setOrder(normalized);

        if (showToast) {
          toast.success(t.refreshSuccess);
        }
      } catch (error) {
        console.error("Failed to load order details:", error);
        setOrder(null);
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [canViewOrders, orderId, t.loadError, t.refreshSuccess],
  );

  async function applyStatusAction(action: StatusAction) {
    if (!order || actionLoading) return;
    if (!window.confirm(t.confirmAction)) return;

    try {
      setActionLoading(action);

      const csrfToken = readCookie("csrftoken");

      const response = await fetch(
        apiUrl(`/api/orders/${encodeURIComponent(String(order.id))}/status/`),
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
          },
          body: JSON.stringify({ action }),
        },
      );

      const payload = (await response.json().catch(() => null)) as
        | StatusApiResponse
        | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message || `HTTP ${response.status}`);
      }

      const nextOrder = payload?.data || payload?.order;

      if (nextOrder) {
        setOrder(normalizeOrderDetail(nextOrder));
      } else {
        await loadOrder(false);
      }

      toast.success(t.actionSuccess);
    } catch (error) {
      console.error("Order status action error:", error);
      toast.error(t.actionError);
    } finally {
      setActionLoading(null);
    }
  }

  function printOrder() {
    if (!canPrintOrders || !order) return;

    const printWindow = window.open("", "_blank", "width=1000,height=800");

    if (!printWindow) {
      toast.error(t.printError);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      buildPrintHtml({
        locale,
        order,
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
    loadOrder(false);
  }, [authResolving, loadOrder]);

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
            {order?.orderNumber || t.title}
          </h1>

          <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
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

          {canViewOrdersList ? (
            <Link href="/system/orders/list">
              <Button
                variant="outline"
                className="h-10 w-full rounded-xl sm:w-auto"
              >
                <ClipboardList className="h-4 w-4" />
                <span>{t.ordersList}</span>
              </Button>
            </Link>
          ) : null}

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadOrder(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refresh}</span>
          </Button>

          {canPrintOrders && order ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={printOrder}
              disabled={isLoading || Boolean(errorMessage) || notFound}
            >
              <Printer className="h-4 w-4" />
              <span>{t.print}</span>
            </Button>
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
              onClick={() => loadOrder(true)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Not Found */}
      {!isLoading && !errorMessage && notFound ? (
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <ShoppingCart className="h-7 w-7 text-muted-foreground" />
            </div>

            <div>
              <p className="text-lg font-semibold">{t.notFoundTitle}</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                {t.notFoundText}
              </p>
            </div>

            {canViewOrdersList ? (
              <Link href="/system/orders/list">
                <Button className="mt-2 rounded-xl">
                  <ClipboardList className="h-4 w-4" />
                  {t.ordersList}
                </Button>
              </Link>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? <DetailSkeleton /> : null}

      {!isLoading && !errorMessage && order && !notFound ? (
        <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          {/* Side Profile */}
          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardContent className="space-y-5 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border bg-muted">
                    <ShoppingCart className="h-8 w-8" />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold">
                      {order.orderNumber}
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {order.customerName}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {statusBadge(order.status, locale)}
                      {paymentBadge(order.paymentStatus, locale)}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">
                    {t.fields.totalAmount}
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    <SarAmount value={order.totalAmount} />
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-full">
                      {t.fields.paidAmount}: {formatMoney(order.paidAmount)}
                    </Badge>
                    <Badge variant="outline" className="rounded-full">
                      {t.fields.remainingAmount}:{" "}
                      {formatMoney(order.remainingAmount)}
                    </Badge>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Button
                    variant="outline"
                    className="justify-start rounded-xl"
                    onClick={() => copyToClipboard(order.orderNumber, t.copied)}
                  >
                    <Copy className="h-4 w-4" />
                    {t.copy} {t.fields.orderNumber}
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start rounded-xl"
                    onClick={() => copyToClipboard(String(order.id), t.copied)}
                  >
                    <Copy className="h-4 w-4" />
                    {t.copy} {t.fields.id}
                  </Button>
                </div>

                {availableActions.length > 0 ? (
                  <div className="grid gap-2 border-t pt-4">
                    {availableActions.map((action) => {
                      const Icon = action.icon;

                      return (
                        <Button
                          key={action.key}
                          variant={
                            action.key === "cancel" || action.key === "refund"
                              ? "outline"
                              : "default"
                          }
                          className="justify-start rounded-xl"
                          disabled={Boolean(actionLoading)}
                          onClick={() => applyStatusAction(action.key)}
                        >
                          {actionLoading === action.key ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Icon className="h-4 w-4" />
                          )}
                          {action.label}
                        </Button>
                      );
                    })}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">
                  {t.quickInfo}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                <QuickInfoItem
                  icon={CalendarDays}
                  label={t.fields.createdAt}
                  value={formatDate(order.createdAt)}
                />

                <QuickInfoItem
                  icon={RefreshCcw}
                  label={t.fields.updatedAt}
                  value={formatDate(order.updatedAt || order.createdAt)}
                />

                <QuickInfoItem
                  icon={Package}
                  label={t.fields.productName}
                  value={order.productName || "-"}
                />

                <QuickInfoItem
                  icon={Stethoscope}
                  label={t.fields.providerName}
                  value={order.providerName || "-"}
                />
              </CardContent>
            </Card>
          </aside>

          {/* Main Content */}
          <main className="space-y-4">
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Eye className="h-4 w-4" />
                  {t.overview}
                </CardTitle>
                <CardDescription>{t.overviewDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="overflow-hidden rounded-xl border">
                  <Table>
                    <TableBody>
                      <InfoRow
                        label={t.fields.id}
                        value={String(order.id)}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.orderNumber}
                        value={order.orderNumber}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <TableRow>
                        <TableCell className="w-[220px] text-muted-foreground">
                          {t.fields.status}
                        </TableCell>
                        <TableCell>{statusBadge(order.status, locale)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="w-[220px] text-muted-foreground">
                          {t.fields.paymentStatus}
                        </TableCell>
                        <TableCell>
                          {paymentBadge(order.paymentStatus, locale)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="w-[220px] text-muted-foreground">
                          {t.fields.fulfillmentStatus}
                        </TableCell>
                        <TableCell>
                          {fulfillmentBadge(order.fulfillmentStatus, locale)}
                        </TableCell>
                      </TableRow>
                      <InfoRow
                        label={t.fields.createdAt}
                        value={formatDate(order.createdAt)}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.updatedAt}
                        value={formatDate(order.updatedAt || order.createdAt)}
                        copiedMessage={t.copied}
                      />
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <UserRound className="h-4 w-4" />
                  {t.customer}
                </CardTitle>
                <CardDescription>{t.customerDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <MetricCard
                    icon={UserRound}
                    label={t.fields.customerName}
                    value={
                      isValidId(order.customerId) && canViewCustomers ? (
                        <Link
                          href={`/system/customers/${order.customerId}`}
                          className="hover:underline"
                        >
                          {order.customerName}
                        </Link>
                      ) : (
                        order.customerName || "-"
                      )
                    }
                  />
                  <MetricCard
                    icon={Users}
                    label={t.fields.customerPhone}
                    value={order.customerPhone || "-"}
                  />
                  <MetricCard
                    icon={FileText}
                    label={t.fields.customerEmail}
                    value={order.customerEmail || "-"}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Package className="h-4 w-4" />
                  {t.productProvider}
                </CardTitle>
                <CardDescription>{t.productProviderDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <MetricCard
                    icon={Package}
                    label={t.fields.productName}
                    value={
                      isValidId(order.productId) && canViewProducts ? (
                        <Link
                          href={`/system/products/${order.productId}`}
                          className="hover:underline"
                        >
                          {order.productName}
                        </Link>
                      ) : (
                        order.productName || "-"
                      )
                    }
                  />

                  <MetricCard
                    icon={Stethoscope}
                    label={t.fields.providerName}
                    value={
                      isValidId(order.providerId) && canViewProviders ? (
                        <Link
                          href={`/system/providers/${order.providerId}`}
                          className="hover:underline"
                        >
                          {order.providerName}
                        </Link>
                      ) : (
                        order.providerName || "-"
                      )
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Wallet className="h-4 w-4" />
                  {t.financial}
                </CardTitle>
                <CardDescription>{t.financialDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <MetricCard
                    icon={Wallet}
                    label={t.fields.totalAmount}
                    value={<SarAmount value={order.totalAmount} />}
                  />
                  <MetricCard
                    icon={CreditCard}
                    label={t.fields.paidAmount}
                    value={<SarAmount value={order.paidAmount} />}
                  />
                  <MetricCard
                    icon={ShieldCheck}
                    label={t.fields.remainingAmount}
                    value={<SarAmount value={order.remainingAmount} />}
                  />
                  <MetricCard
                    icon={Ban}
                    label={t.fields.discountAmount}
                    value={<SarAmount value={order.discountAmount} />}
                  />
                  <MetricCard
                    icon={FileText}
                    label={t.fields.taxAmount}
                    value={<SarAmount value={order.taxAmount} />}
                  />
                  <MetricCard
                    icon={Users}
                    label={t.fields.agentCommission}
                    value={<SarAmount value={order.agentCommission} />}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <ClipboardList className="h-4 w-4" />
                  {t.links}
                </CardTitle>
                <CardDescription>{t.linksDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <MetricCard
                    icon={Users}
                    label={t.fields.agentName}
                    value={
                      isValidId(order.agentId) && canViewAgents ? (
                        <Link
                          href={`/system/agents/${order.agentId}`}
                          className="hover:underline"
                        >
                          {order.agentName || "-"}
                        </Link>
                      ) : (
                        order.agentName || "-"
                      )
                    }
                  />

                  <MetricCard
                    icon={FileText}
                    label={t.fields.contractCode}
                    value={
                      isValidId(order.contractId) && canViewContracts ? (
                        <Link
                          href={`/system/contracts/${order.contractId}`}
                          className="hover:underline"
                        >
                          {order.contractCode || "-"}
                        </Link>
                      ) : (
                        order.contractCode || "-"
                      )
                    }
                  />

                  <MetricCard
                    icon={CreditCard}
                    label={t.fields.invoiceNumber}
                    value={
                      isValidId(order.invoiceId) && canViewInvoices ? (
                        <Link
                          href={`/system/invoices/${order.invoiceId}`}
                          className="hover:underline"
                        >
                          {order.invoiceNumber || "-"}
                        </Link>
                      ) : (
                        order.invoiceNumber || "-"
                      )
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <FileText className="h-4 w-4" />
                  {t.notes}
                </CardTitle>
                <CardDescription>{t.notesDesc}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <TextSection
                  label={t.fields.notes}
                  value={order.notes}
                  empty={t.empty}
                />
                <TextSection
                  label={t.fields.internalNotes}
                  value={order.internalNotes}
                  empty={t.empty}
                />
              </CardContent>
            </Card>
          </main>
        </div>
      ) : null}
    </div>
  );
}