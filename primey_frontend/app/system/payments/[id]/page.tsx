"use client";

/* ============================================================
   📂 app/system/payments/[id]/page.tsx
   🧠 Primey Care | Payment Details
   ------------------------------------------------------------
   ✅ تفاصيل الدفعة
   ✅ تأكيد / إلغاء حسب الصلاحيات والحالة
   ✅ عرض العميل / الفاتورة / الطلب / الترحيل
   ✅ Web PDF Print
   ✅ Skeleton / Error / Not Found
   ✅ Phase 17 UX + Phase 2 Permissions
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
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

type PaymentDetails = {
  id: string;
  payment_number: string;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  amount: number;

  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;

  invoice_id: string;
  invoice_number: string;
  invoice_total_amount: number;
  invoice_remaining_amount: number;

  order_id: string;
  order_number: string;
  order_total_amount: number;

  payment_date: string;
  confirmed_at: string;
  cancelled_at: string;
  created_at: string;

  reference: string;
  gateway_reference: string;
  transaction_reference: string;
  notes: string;
  cancellation_reason: string;

  is_treasury_posted: boolean;
  is_accounting_posted: boolean;
  treasury_reference: string;
  accounting_reference: string;
};

type ApiEnvelope<T> = {
  ok?: boolean;
  success?: boolean;
  message?: string;
  detail?: string;
  error?: string;
  data?: T;
  payment?: unknown;
  item?: unknown;
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
    title: isArabic ? "تفاصيل الدفعة" : "Payment Details",
    subtitle: isArabic
      ? "عرض بيانات الدفعة والعميل والفاتورة والطلب والترحيل المالي."
      : "View payment, customer, invoice, order, treasury, and accounting details.",

    back: isArabic ? "قائمة المدفوعات" : "Payments List",
    dashboard: isArabic ? "المدفوعات" : "Payments",
    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    confirm: isArabic ? "تأكيد الدفعة" : "Confirm Payment",
    cancel: isArabic ? "إلغاء الدفعة" : "Cancel Payment",
    view: isArabic ? "عرض" : "View",
    copy: isArabic ? "نسخ" : "Copy",
    copied: isArabic ? "تم النسخ." : "Copied.",

    profileTitle: isArabic ? "بطاقة الدفعة" : "Payment Card",
    paymentInfo: isArabic ? "بيانات الدفعة" : "Payment Information",
    customerInfo: isArabic ? "بيانات العميل" : "Customer Information",
    invoiceInfo: isArabic ? "بيانات الفاتورة" : "Invoice Information",
    orderInfo: isArabic ? "بيانات الطلب" : "Order Information",
    postingInfo: isArabic ? "الترحيل المالي" : "Financial Posting",
    referencesInfo: isArabic ? "مراجع العملية" : "Transaction References",

    paymentNumber: isArabic ? "رقم الدفعة" : "Payment No.",
    method: isArabic ? "طريقة الدفع" : "Method",
    status: isArabic ? "الحالة" : "Status",
    amount: isArabic ? "المبلغ" : "Amount",
    paymentDate: isArabic ? "تاريخ الدفع" : "Payment Date",
    confirmedAt: isArabic ? "تاريخ التأكيد" : "Confirmed At",
    cancelledAt: isArabic ? "تاريخ الإلغاء" : "Cancelled At",
    createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",

    customer: isArabic ? "العميل" : "Customer",
    phone: isArabic ? "الجوال" : "Phone",
    email: isArabic ? "البريد الإلكتروني" : "Email",

    invoice: isArabic ? "الفاتورة" : "Invoice",
    invoiceTotal: isArabic ? "إجمالي الفاتورة" : "Invoice Total",
    invoiceRemaining: isArabic ? "متبقي الفاتورة" : "Invoice Remaining",

    order: isArabic ? "الطلب" : "Order",
    orderTotal: isArabic ? "إجمالي الطلب" : "Order Total",

    reference: isArabic ? "المرجع" : "Reference",
    gatewayReference: isArabic ? "مرجع البوابة" : "Gateway Reference",
    transactionReference: isArabic ? "مرجع العملية" : "Transaction Reference",
    notes: isArabic ? "ملاحظات" : "Notes",
    cancellationReason: isArabic ? "سبب الإلغاء" : "Cancellation Reason",

    treasury: isArabic ? "الخزينة" : "Treasury",
    accounting: isArabic ? "المحاسبة" : "Accounting",
    posted: isArabic ? "مرحل" : "Posted",
    notPosted: isArabic ? "غير مرحل" : "Not Posted",
    treasuryReference: isArabic ? "مرجع الخزينة" : "Treasury Reference",
    accountingReference: isArabic ? "مرجع المحاسبة" : "Accounting Reference",

    pending: isArabic ? "قيد الانتظار" : "Pending",
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

    notAvailable: isArabic ? "غير متوفر" : "Not available",

    accessDeniedTitle: isArabic
      ? "غير مصرح بعرض الدفعة"
      : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض تفاصيل المدفوعات."
      : "You do not have permission to view payment details.",

    notFoundTitle: isArabic ? "الدفعة غير موجودة" : "Payment not found",
    notFoundText: isArabic
      ? "لم يتم العثور على الدفعة المطلوبة."
      : "The requested payment could not be found.",

    loadError: isArabic ? "تعذر تحميل الدفعة." : "Unable to load payment.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",

    confirmConfirm: isArabic
      ? "هل تريد تأكيد هذه الدفعة؟"
      : "Confirm this payment?",
    cancelConfirm: isArabic
      ? "هل تريد إلغاء هذه الدفعة؟"
      : "Cancel this payment?",

    confirmSuccess: isArabic
      ? "تم تأكيد الدفعة بنجاح."
      : "Payment confirmed successfully.",
    cancelSuccess: isArabic
      ? "تم إلغاء الدفعة بنجاح."
      : "Payment cancelled successfully.",
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

function normalizePaymentStatus(value: unknown): PaymentStatus {
  const clean = String(value || "").toUpperCase();

  if (["PENDING", "DRAFT", "UNCONFIRMED"].includes(clean)) return "PENDING";
  if (["CONFIRMED", "PAID", "SUCCESS", "COMPLETED"].includes(clean)) {
    return "CONFIRMED";
  }
  if (["CANCELLED", "CANCELED", "VOID"].includes(clean)) return "CANCELLED";
  if (["FAILED", "ERROR", "DECLINED"].includes(clean)) return "FAILED";
  if (["REFUNDED"].includes(clean)) return "REFUNDED";

  return "UNKNOWN";
}

function normalizePaymentMethod(value: unknown): PaymentMethod {
  const clean = String(value || "").toUpperCase();

  if (["CASH"].includes(clean)) return "CASH";
  if (["BANK_TRANSFER", "TRANSFER", "BANK"].includes(clean)) {
    return "BANK_TRANSFER";
  }
  if (["GATEWAY", "ONLINE", "ONLINE_PAYMENT"].includes(clean)) return "GATEWAY";
  if (["CARD", "MADA", "VISA", "MASTER_CARD", "MASTERCARD"].includes(clean)) {
    return "CARD";
  }
  if (["WALLET", "APPLE_PAY", "STC_PAY"].includes(clean)) return "WALLET";
  if (["TAMARA"].includes(clean)) return "TAMARA";
  if (["TABBY"].includes(clean)) return "TABBY";

  return "UNKNOWN";
}

function normalizePayment(payload: unknown): PaymentDetails {
  const root = asDict(payload);
  const data = asDict(root.data);
  const paymentObj = asDict(
    root.payment || data.payment || data.item || root.item || root.data || root,
  );

  const customerObj = asDict(paymentObj.customer || paymentObj.client);
  const invoiceObj = asDict(paymentObj.invoice);
  const orderObj = asDict(paymentObj.order);

  return {
    id: String(getNestedValue(paymentObj, ["id", "uuid", "pk"]) || ""),
    payment_number: String(
      getNestedValue(paymentObj, [
        "payment_number",
        "number",
        "code",
        "reference",
      ]) || "-",
    ),
    payment_method: normalizePaymentMethod(
      getNestedValue(paymentObj, ["payment_method", "method", "type"]),
    ),
    status: normalizePaymentStatus(
      getNestedValue(paymentObj, ["status", "payment_status", "state"]),
    ),
    amount: toNumber(getNestedValue(paymentObj, ["amount", "paid_amount", "total"])),

    customer_id: String(
      customerObj.id ||
        getNestedValue(paymentObj, ["customer_id", "client_id"]) ||
        "",
    ),
    customer_name: String(
      customerObj.name ||
        customerObj.full_name ||
        getNestedValue(paymentObj, [
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
        getNestedValue(paymentObj, ["customer_phone", "phone", "mobile"]) ||
        "",
    ),
    customer_email: String(
      customerObj.email ||
        getNestedValue(paymentObj, ["customer_email", "email"]) ||
        "",
    ),

    invoice_id: String(invoiceObj.id || getNestedValue(paymentObj, ["invoice_id"]) || ""),
    invoice_number: String(
      invoiceObj.invoice_number ||
        invoiceObj.number ||
        getNestedValue(paymentObj, ["invoice_number", "invoice_reference"]) ||
        "-",
    ),
    invoice_total_amount: toNumber(
      invoiceObj.total_amount ||
        getNestedValue(paymentObj, ["invoice_total_amount", "invoice_total"]),
    ),
    invoice_remaining_amount: toNumber(
      invoiceObj.remaining_amount ||
        getNestedValue(paymentObj, [
          "invoice_remaining_amount",
          "invoice_remaining",
          "remaining_amount",
        ]),
    ),

    order_id: String(orderObj.id || getNestedValue(paymentObj, ["order_id"]) || ""),
    order_number: String(
      orderObj.order_number ||
        orderObj.number ||
        getNestedValue(paymentObj, ["order_number", "order_reference"]) ||
        "-",
    ),
    order_total_amount: toNumber(
      orderObj.total_amount ||
        getNestedValue(paymentObj, ["order_total_amount", "order_total"]),
    ),

    payment_date: String(
      getNestedValue(paymentObj, [
        "payment_date",
        "paid_at",
        "date",
        "created_at",
      ]) || "",
    ),
    confirmed_at: String(getNestedValue(paymentObj, ["confirmed_at"]) || ""),
    cancelled_at: String(getNestedValue(paymentObj, ["cancelled_at", "canceled_at"]) || ""),
    created_at: String(getNestedValue(paymentObj, ["created_at", "created"]) || ""),

    reference: String(
      getNestedValue(paymentObj, [
        "source_reference",
        "external_reference",
        "reference",
        "ref",
      ]) || "",
    ),
    gateway_reference: String(
      getNestedValue(paymentObj, [
        "gateway_reference",
        "gateway_ref",
        "gateway_transaction_id",
      ]) || "",
    ),
    transaction_reference: String(
      getNestedValue(paymentObj, [
        "transaction_reference",
        "transaction_id",
        "payment_reference",
      ]) || "",
    ),
    notes: String(getNestedValue(paymentObj, ["notes", "description", "memo"]) || ""),
    cancellation_reason: String(
      getNestedValue(paymentObj, ["cancellation_reason", "cancel_reason"]) || "",
    ),

    is_treasury_posted: Boolean(
      getNestedValue(paymentObj, ["is_treasury_posted", "treasury_posted"]),
    ),
    is_accounting_posted: Boolean(
      getNestedValue(paymentObj, ["is_accounting_posted", "accounting_posted"]),
    ),
    treasury_reference: String(
      getNestedValue(paymentObj, ["treasury_reference", "treasury_ref"]) || "",
    ),
    accounting_reference: String(
      getNestedValue(paymentObj, ["accounting_reference", "accounting_ref"]) || "",
    ),
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

function methodBadge(method: PaymentMethod, locale: AppLocale) {
  return (
    <Badge variant="secondary" className="rounded-full px-3 py-1">
      {paymentMethodLabel(method, locale)}
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
        {Array.from({ length: 4 }).map((_, index) => (
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
  payment,
}: {
  locale: AppLocale;
  payment: PaymentDetails;
}) {
  const isArabic = locale === "ar";
  const t = dictionary(locale);
  const now = new Date().toLocaleString("en-US");

  const row = (label: string, value: string) => `
    <div class="row">
      <span class="label">${escapeHtml(label)}</span>
      <span class="value">${escapeHtml(value || "-")}</span>
    </div>
  `;

  return `
    <!doctype html>
    <html lang="${locale}" dir="${isArabic ? "rtl" : "ltr"}">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(payment.payment_number)}</title>
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
          @page { size: A4; margin: 12mm; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>${escapeHtml(t.title)}</h1>
            <div class="meta">
              <div>${escapeHtml(t.paymentNumber)}: ${escapeHtml(payment.payment_number)}</div>
              <div>${escapeHtml(t.printedAt)}: ${escapeHtml(now)}</div>
            </div>
          </div>
          <div class="badge">Primey Care</div>
        </div>

        <div class="grid">
          <div class="box">
            <h2>${escapeHtml(t.paymentInfo)}</h2>
            ${row(t.status, paymentStatusLabel(payment.status, locale))}
            ${row(t.method, paymentMethodLabel(payment.payment_method, locale))}
            ${row(t.amount, formatMoney(payment.amount))}
            ${row(t.paymentDate, formatDate(payment.payment_date, locale))}
            ${row(t.confirmedAt, formatDate(payment.confirmed_at, locale))}
            ${row(t.cancelledAt, formatDate(payment.cancelled_at, locale))}
          </div>

          <div class="box">
            <h2>${escapeHtml(t.customerInfo)}</h2>
            ${row(t.customer, payment.customer_name)}
            ${row(t.phone, payment.customer_phone || "-")}
            ${row(t.email, payment.customer_email || "-")}
          </div>

          <div class="box">
            <h2>${escapeHtml(t.invoiceInfo)}</h2>
            ${row(t.invoice, payment.invoice_number || "-")}
            ${row(t.invoiceTotal, formatMoney(payment.invoice_total_amount))}
            ${row(t.invoiceRemaining, formatMoney(payment.invoice_remaining_amount))}
          </div>

          <div class="box">
            <h2>${escapeHtml(t.postingInfo)}</h2>
            ${row(t.treasury, payment.is_treasury_posted ? t.posted : t.notPosted)}
            ${row(t.accounting, payment.is_accounting_posted ? t.posted : t.notPosted)}
            ${row(t.treasuryReference, payment.treasury_reference || "-")}
            ${row(t.accountingReference, payment.accounting_reference || "-")}
          </div>
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

export default function SystemPaymentDetailsPage() {
  const params = useParams<{ id?: string | string[] }>();
  const auth = useAuth() as unknown;

  const paymentId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notFound, setNotFound] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canView = hasSafePermission(
    auth,
    ["payments.view", "billing.payments.view"],
    "view",
  );

  const canConfirm = hasSafePermission(
    auth,
    ["payments.confirm", "payments.update", "billing.payments.confirm"],
    "action",
  );

  const canCancel = hasSafePermission(
    auth,
    ["payments.cancel", "payments.update", "billing.payments.cancel"],
    "action",
  );

  const canPrint = hasSafePermission(
    auth,
    ["payments.print", "reports.print"],
    "action",
  );

  const canViewInvoice = hasSafePermission(auth, ["invoices.view"], "view");
  const canViewOrder = hasSafePermission(auth, ["orders.view"], "view");
  const canViewCustomer = hasSafePermission(auth, ["customers.view"], "view");

  const currentPaymentStatus: PaymentStatus = payment?.status ?? "UNKNOWN";
  const currentPaymentId = payment?.id ?? "";

  const canConfirmCurrent =
    payment !== null &&
    canConfirm &&
    currentPaymentStatus === "PENDING" &&
    Boolean(currentPaymentId);

  const canCancelCurrent =
    payment !== null &&
    canCancel &&
    currentPaymentStatus === "PENDING" &&
    Boolean(currentPaymentId);

  const loadPayment = useCallback(
    async (showToast = false) => {
      if (!canView || !paymentId) {
        setPayment(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");
        setNotFound(false);

        const endpoints = [
          `/api/payments/${paymentId}/`,
          `/api/payments/detail/${paymentId}/`,
          `/api/payments/detail/?id=${paymentId}`,
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
            setPayment(null);
            return;
          }

          throw new Error(lastError || t.loadError);
        }

        setPayment(normalizePayment(payload));

        if (showToast) {
          toast.success(t.refresh);
        }
      } catch (error) {
        console.error("Load payment details error:", error);
        setPayment(null);
        setErrorMessage(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [canView, paymentId, t.loadError, t.refresh],
  );

  async function runPaymentAction(action: "confirm" | "cancel") {
    if (!payment || !payment.id) return;

    const confirmed = window.confirm(
      action === "confirm" ? t.confirmConfirm : t.cancelConfirm,
    );

    if (!confirmed) return;

    try {
      setIsActionLoading(true);

      const csrfToken = getCookie("csrftoken");

      const endpoints =
        action === "confirm"
          ? ["/api/payments/confirm/", `/api/payments/${payment.id}/confirm/`]
          : ["/api/payments/cancel/", `/api/payments/${payment.id}/cancel/`];

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
            payment_id: payment.id,
            id: payment.id,
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

      toast.success(action === "confirm" ? t.confirmSuccess : t.cancelSuccess);
      await loadPayment(false);
    } catch (error) {
      console.error("Payment action error:", error);
      toast.error(t.actionError);
    } finally {
      setIsActionLoading(false);
    }
  }

  function printPage() {
    if (!payment) return;

    const printWindow = window.open("", "_blank", "width=980,height=720");

    if (!printWindow) {
      toast.error(t.printError);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      buildPrintHtml({
        locale,
        payment,
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
    loadPayment();
  }, [loadPayment]);

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
              <CreditCard className="h-3.5 w-3.5" />
              {t.dashboard}
            </Badge>

            {payment ? paymentStatusBadge(payment.status, locale) : null}
            {payment ? methodBadge(payment.payment_method, locale) : null}
          </div>

          <h1 className="mt-3 text-xl font-bold tracking-tight lg:text-2xl">
            {payment?.payment_number || t.title}
          </h1>

          <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
            {t.subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
          <Link href="/system/payments/list">
            <Button variant="outline" className="h-10 w-full rounded-xl sm:w-auto">
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadPayment(true)}
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
              disabled={isLoading || isActionLoading || !payment}
            >
              <Printer className="h-4 w-4" />
              <span>{t.print}</span>
            </Button>
          ) : null}

          {canConfirmCurrent ? (
            <Button
              className="h-10 rounded-xl"
              onClick={() => runPaymentAction("confirm")}
              disabled={isActionLoading}
            >
              {isActionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <span>{t.confirm}</span>
            </Button>
          ) : null}

          {canCancelCurrent ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl text-destructive hover:text-destructive"
              onClick={() => runPaymentAction("cancel")}
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
              onClick={() => loadPayment(true)}
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
            <Link href="/system/payments/list">
              <Button className="mt-2 rounded-xl">
                <ArrowLeft className="h-4 w-4" />
                {t.back}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? <PageSkeleton /> : null}

      {!isLoading && payment ? (
        <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ReceiptText className="h-5 w-5" />
                  {t.profileTitle}
                </CardTitle>
                <CardDescription>{payment.payment_number}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                  <CreditCard className="h-7 w-7 text-muted-foreground" />
                </div>

                <div>
                  <p className="text-lg font-bold">{payment.payment_number}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {paymentStatusBadge(payment.status, locale)}
                    {methodBadge(payment.payment_method, locale)}
                  </div>
                </div>

                <div className="grid gap-3">
                  <InfoItem
                    label={t.customer}
                    value={payment.customer_name}
                    icon={<UserRound className="h-4 w-4" />}
                  />
                  <InfoItem
                    label={t.invoice}
                    value={payment.invoice_number}
                    icon={<FileText className="h-4 w-4" />}
                  />
                  <InfoItem
                    label={t.paymentDate}
                    value={formatDate(payment.payment_date, locale)}
                    icon={<CalendarDays className="h-4 w-4" />}
                  />
                  <InfoItem
                    label={t.amount}
                    value={formatMoney(payment.amount)}
                    icon={<WalletCards className="h-4 w-4" />}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader>
                <CardTitle>{t.amount}</CardTitle>
              </CardHeader>

              <CardContent>
                <div className="rounded-2xl border bg-background p-5">
                  <p className="text-sm text-muted-foreground">{t.amount}</p>
                  <p className="mt-2 text-2xl font-bold">
                    <MoneyText value={payment.amount} />
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <KpiCard
                title={t.amount}
                value={<MoneyText value={payment.amount} />}
                icon={<WalletCards className="h-5 w-5" />}
              />
              <KpiCard
                title={t.treasury}
                value={payment.is_treasury_posted ? t.posted : t.notPosted}
                icon={<ReceiptText className="h-5 w-5" />}
              />
              <KpiCard
                title={t.accounting}
                value={payment.is_accounting_posted ? t.posted : t.notPosted}
                icon={<FileText className="h-5 w-5" />}
              />
            </div>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold">
                  {t.paymentInfo}
                </CardTitle>
              </CardHeader>

              <CardContent className="grid gap-3 md:grid-cols-2">
                <DetailBox
                  label={t.paymentNumber}
                  value={payment.payment_number}
                  onCopy={() => copyValue(payment.payment_number)}
                  copyLabel={t.copy}
                />
                <DetailBox
                  label={t.status}
                  value={paymentStatusLabel(payment.status, locale)}
                />
                <DetailBox
                  label={t.method}
                  value={paymentMethodLabel(payment.payment_method, locale)}
                />
                <DetailBox
                  label={t.amount}
                  value={formatMoney(payment.amount)}
                />
                <DetailBox
                  label={t.paymentDate}
                  value={formatDate(payment.payment_date, locale)}
                />
                <DetailBox
                  label={t.confirmedAt}
                  value={formatDate(payment.confirmed_at, locale)}
                />
                <DetailBox
                  label={t.cancelledAt}
                  value={formatDate(payment.cancelled_at, locale)}
                />
                <DetailBox
                  label={t.createdAt}
                  value={formatDate(payment.created_at, locale)}
                />
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-bold">
                    {t.customerInfo}
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-3">
                  <DetailBox label={t.customer} value={payment.customer_name} />
                  <DetailBox
                    label={t.phone}
                    value={payment.customer_phone || t.notAvailable}
                  />
                  <DetailBox
                    label={t.email}
                    value={payment.customer_email || t.notAvailable}
                  />

                  {canViewCustomer && isValidId(payment.customer_id) ? (
                    <Link href={`/system/customers/${payment.customer_id}`}>
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
                  <CardTitle className="text-base font-bold">
                    {t.invoiceInfo}
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <div className="flex items-start gap-3 rounded-2xl border p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <FileText className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-semibold" dir="ltr">
                        {payment.invoice_number || t.notAvailable}
                      </p>

                      <div className="mt-3 grid gap-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">
                            {t.invoiceTotal}
                          </span>
                          <MoneyText value={payment.invoice_total_amount} />
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">
                            {t.invoiceRemaining}
                          </span>
                          <MoneyText value={payment.invoice_remaining_amount} />
                        </div>
                      </div>

                      {canViewInvoice && isValidId(payment.invoice_id) ? (
                        <Link href={`/system/invoices/${payment.invoice_id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 rounded-xl"
                          >
                            {t.view}
                          </Button>
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold">
                  {t.orderInfo}
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div className="flex items-start gap-3 rounded-2xl border p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ShoppingCart className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold" dir="ltr">
                      {payment.order_number || t.notAvailable}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t.orderTotal}:{" "}
                      <span className="font-medium text-foreground">
                        <MoneyText value={payment.order_total_amount} />
                      </span>
                    </p>

                    {canViewOrder && isValidId(payment.order_id) ? (
                      <Link href={`/system/orders/${payment.order_id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 rounded-xl"
                        >
                          {t.view}
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold">
                  {t.postingInfo}
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  <PostingBox
                    title={t.treasury}
                    isPosted={payment.is_treasury_posted}
                    reference={payment.treasury_reference}
                    postedLabel={t.posted}
                    notPostedLabel={t.notPosted}
                    referenceLabel={t.treasuryReference}
                  />

                  <PostingBox
                    title={t.accounting}
                    isPosted={payment.is_accounting_posted}
                    reference={payment.accounting_reference}
                    postedLabel={t.posted}
                    notPostedLabel={t.notPosted}
                    referenceLabel={t.accountingReference}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold">
                  {t.referencesInfo}
                </CardTitle>
              </CardHeader>

              <CardContent className="grid gap-3 md:grid-cols-3">
                <ReferenceBox
                  label={t.reference}
                  value={payment.reference}
                  onCopy={() => copyValue(payment.reference)}
                  copyLabel={t.copy}
                />
                <ReferenceBox
                  label={t.gatewayReference}
                  value={payment.gateway_reference}
                  onCopy={() => copyValue(payment.gateway_reference)}
                  copyLabel={t.copy}
                />
                <ReferenceBox
                  label={t.transactionReference}
                  value={payment.transaction_reference}
                  onCopy={() => copyValue(payment.transaction_reference)}
                  copyLabel={t.copy}
                />
              </CardContent>
            </Card>

            {payment.notes || payment.cancellation_reason ? (
              <Alert className="rounded-2xl">
                <FileText className="h-4 w-4" />
                <AlertTitle>
                  {payment.cancellation_reason ? t.cancellationReason : t.notes}
                </AlertTitle>
                <AlertDescription>
                  {payment.cancellation_reason || payment.notes}
                </AlertDescription>
              </Alert>
            ) : null}

            {payment.status === "CANCELLED" && payment.cancelled_at ? (
              <Alert className="rounded-2xl border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
                <Ban className="h-4 w-4" />
                <AlertTitle>{t.cancelled}</AlertTitle>
                <AlertDescription>
                  {t.cancelledAt}: {formatDate(payment.cancelled_at, locale)}
                </AlertDescription>
              </Alert>
            ) : null}
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
  icon: ReactNode;
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
  copyLabel,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
  copyLabel?: string;
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
            title={copyLabel}
          >
            <Copy className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
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

function PostingBox({
  title,
  isPosted,
  reference,
  postedLabel,
  notPostedLabel,
  referenceLabel,
}: {
  title: string;
  isPosted: boolean;
  reference: string;
  postedLabel: string;
  notPostedLabel: string;
  referenceLabel: string;
}) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">{title}</p>
        <Badge variant="outline" className="rounded-full">
          {isPosted ? postedLabel : notPostedLabel}
        </Badge>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">{referenceLabel}</p>
      <p className="mt-1 font-medium" dir="ltr">
        {reference || "-"}
      </p>
    </div>
  );
}

function ReferenceBox({
  label,
  value,
  onCopy,
  copyLabel,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copyLabel: string;
}) {
  return (
    <div className="rounded-2xl border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="truncate font-medium" dir="ltr">
          {value || "-"}
        </p>

        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={onCopy}
            title={copyLabel}
          >
            <Copy className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}