"use client";

/* ============================================================
   📂 app/system/treasury/transactions/[id]/page.tsx
   🧠 Primey Care | Treasury Transaction Details Page

   ✅ المسار:
      app/system/treasury/transactions/[id]/page.tsx

   ✅ العمل:
      صفحة تفاصيل حركة خزينة داخل النظام.
      تعرض بيانات سند القبض أو الصرف أو التحويل أو التسوية، الحسابات، المبلغ، الحالة، والترحيل.

   ✅ الإصدار:
      Phase 17 UX Refinement + Treasury Transaction Details Build

   ✅ يعتمد على:
      - /api/treasury/transactions/{id}/
      - /api/treasury/transactions/{id}/confirm/
      - /api/treasury/transactions/{id}/cancel/
      - /api/treasury/accounts/
      - primey-locale
      - AuthProvider
      - sonner
      - /currency/sar.svg

   ✅ متوافق مع:
      - Treasury overview page
      - Treasury transactions page
      - Treasury transaction create page
      - Treasury accounts page
      - Treasury account statement page
      - Centers / Customers approved UX standard

   ✅ الوظائف:
      - عرض تفاصيل الحركة المالية.
      - عرض نوع الحركة والحالة والمبلغ والتاريخ والمرجع.
      - عرض حساب الخزينة وحساب المستلم للتحويل الداخلي.
      - عرض حالة ترحيل الخزينة والترحيل المحاسبي.
      - تأكيد الحركة إذا كانت مسودة.
      - إلغاء الحركة إذا لم تكن ملغاة.
      - Web PDF Print.
      - Error State مستقل.
      - Not Found State مستقل.
      - Skeleton Loading.
      - صلاحيات آمنة بدون كسر system_admin/superuser.
      - أرقام إنجليزية دائمًا.
      - رمز SAR من /currency/sar.svg بعد الرقم.
      - استخدام sonner للتنبيهات.

   ------------------------------------------------------------
   تحسينات هذا الإصدار:
      - بناء صفحة التفاصيل كاملة بنفس النمط التشغيلي المعتمد.
      - الالتزام بالقاعدة: w-full space-y-4 بدون main/min-h-screen/max-w.
      - عدم عرض أي مسارات أو عبارات تقنية داخل واجهة المستخدم.
      - إخفاء الأزرار غير المصرح بها بدل تعطيلها.
      - عدم تنفيذ حذف فعلي، فقط إلغاء آمن عند توفر endpoint.
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Copy,
  CreditCard,
  FileText,
  Loader2,
  Printer,
  Receipt,
  RefreshCcw,
  ShieldCheck,
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

/* ============================================================
   Types
============================================================ */

type AppLocale = "ar" | "en";
type Dict = Record<string, unknown>;

type TransactionType =
  | "RECEIPT"
  | "PAYMENT"
  | "TRANSFER"
  | "ADJUSTMENT"
  | "UNKNOWN";

type TransactionStatus = "DRAFT" | "CONFIRMED" | "CANCELLED" | "UNKNOWN";

type TransactionDetails = {
  id: string;
  transaction_number: string;
  transaction_type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  transaction_date: string;
  account_id: string;
  account_name: string;
  account_code: string;
  to_account_id: string;
  to_account_name: string;
  to_account_code: string;
  source_reference: string;
  description: string;
  notes: string;
  is_treasury_posted: boolean;
  is_accounting_posted: boolean;
  treasury_reference: string;
  accounting_reference: string;
  created_at: string;
  updated_at: string;
};

type ApiEnvelope<T> = {
  ok?: boolean;
  success?: boolean;
  message?: string;
  detail?: string;
  error?: string;
  data?: T;
  transaction?: unknown;
  treasury_transaction?: unknown;
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

    if (parts.length === 2) {
      return parts.pop()?.split(";").shift() || "";
    }

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
    title: isArabic ? "تفاصيل الحركة المالية" : "Treasury Transaction Details",
    subtitle: isArabic
      ? "مراجعة تفاصيل سند القبض أو الصرف أو التحويل أو التسوية."
      : "Review receipt, payment, transfer, or adjustment details.",

    back: isArabic ? "الحركات المالية" : "Transactions",
    treasury: isArabic ? "الخزينة" : "Treasury",
    accounts: isArabic ? "حسابات الخزينة" : "Treasury Accounts",
    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    confirm: isArabic ? "تأكيد الحركة" : "Confirm Transaction",
    cancel: isArabic ? "إلغاء الحركة" : "Cancel Transaction",
    confirming: isArabic ? "جاري التأكيد..." : "Confirming...",
    cancelling: isArabic ? "جاري الإلغاء..." : "Cancelling...",
    copy: isArabic ? "نسخ" : "Copy",

    infoTitle: isArabic ? "بيانات الحركة" : "Transaction Information",
    infoDesc: isArabic
      ? "المعلومات الأساسية والتشغيلية للحركة المالية."
      : "Basic and operational information for the transaction.",

    accountTitle: isArabic ? "الحسابات المرتبطة" : "Linked Accounts",
    accountDesc: isArabic
      ? "حساب الخزينة وحساب المستلم عند وجود تحويل داخلي."
      : "Treasury account and destination account when this is an internal transfer.",

    postingTitle: isArabic ? "حالة الترحيل" : "Posting Status",
    postingDesc: isArabic
      ? "حالة ترحيل الحركة في الخزينة والمحاسبة."
      : "Treasury and accounting posting status.",

    notesTitle: isArabic ? "الوصف والملاحظات" : "Description and Notes",
    notesDesc: isArabic
      ? "المرجع والوصف والملاحظات المسجلة على الحركة."
      : "Reference, description, and notes recorded on this transaction.",

    transactionNumber: isArabic ? "رقم الحركة" : "Transaction No.",
    transactionType: isArabic ? "نوع الحركة" : "Transaction Type",
    status: isArabic ? "الحالة" : "Status",
    amount: isArabic ? "المبلغ" : "Amount",
    date: isArabic ? "تاريخ الحركة" : "Transaction Date",
    sourceReference: isArabic ? "المرجع" : "Reference",
    account: isArabic ? "حساب الخزينة" : "Treasury Account",
    fromAccount: isArabic ? "حساب المصدر" : "Source Account",
    toAccount: isArabic ? "حساب المستلم" : "Destination Account",
    description: isArabic ? "الوصف" : "Description",
    notes: isArabic ? "ملاحظات" : "Notes",
    createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
    updatedAt: isArabic ? "آخر تحديث" : "Updated At",

    receipt: isArabic ? "سند قبض" : "Receipt Voucher",
    payment: isArabic ? "سند صرف" : "Payment Voucher",
    transfer: isArabic ? "تحويل داخلي" : "Internal Transfer",
    adjustment: isArabic ? "تسوية مالية" : "Adjustment",
    unknown: isArabic ? "غير محدد" : "Unknown",

    draft: isArabic ? "مسودة" : "Draft",
    confirmed: isArabic ? "مؤكدة" : "Confirmed",
    cancelled: isArabic ? "ملغاة" : "Cancelled",

    treasuryPosted: isArabic ? "ترحيل الخزينة" : "Treasury Posting",
    accountingPosted: isArabic ? "الترحيل المحاسبي" : "Accounting Posting",
    posted: isArabic ? "مرحّل" : "Posted",
    notPosted: isArabic ? "غير مرحّل" : "Not Posted",
    treasuryReference: isArabic ? "مرجع الخزينة" : "Treasury Reference",
    accountingReference: isArabic ? "مرجع المحاسبة" : "Accounting Reference",

    notSet: isArabic ? "غير محدد" : "Not set",

    accessDeniedTitle: isArabic
      ? "غير مصرح بعرض الحركة المالية"
      : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض تفاصيل حركات الخزينة. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view treasury transaction details. Contact your system administrator if you need access.",

    notFoundTitle: isArabic ? "الحركة المالية غير موجودة" : "Transaction not found",
    notFoundText: isArabic
      ? "لم يتم العثور على الحركة المالية المطلوبة."
      : "The requested treasury transaction could not be found.",

    loadError: isArabic
      ? "تعذر تحميل تفاصيل الحركة المالية."
      : "Unable to load treasury transaction details.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    loadSuccess: isArabic
      ? "تم تحديث تفاصيل الحركة بنجاح."
      : "Transaction details refreshed successfully.",

    confirmSuccess: isArabic
      ? "تم تأكيد الحركة المالية بنجاح."
      : "Transaction confirmed successfully.",
    confirmError: isArabic
      ? "تعذر تأكيد الحركة المالية."
      : "Unable to confirm transaction.",
    cancelSuccess: isArabic
      ? "تم إلغاء الحركة المالية بنجاح."
      : "Transaction cancelled successfully.",
    cancelError: isArabic
      ? "تعذر إلغاء الحركة المالية."
      : "Unable to cancel transaction.",

    confirmPrompt: isArabic
      ? "هل تريد تأكيد هذه الحركة المالية؟"
      : "Confirm this treasury transaction?",
    cancelPrompt: isArabic
      ? "هل تريد إلغاء هذه الحركة المالية؟"
      : "Cancel this treasury transaction?",

    printSuccess: isArabic
      ? "تم تجهيز نافذة الطباعة."
      : "Print window prepared.",
    printError: isArabic
      ? "تعذر فتح نافذة الطباعة."
      : "Unable to open print window.",
    copied: isArabic ? "تم النسخ." : "Copied.",
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
    "account",
    "treasury_account",
    "from_account",
    "to_account",
    "destination_account",
    "cashbox",
    "bank",
    "transaction",
    "treasury_transaction",
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

function extractTransactionData(payload: ApiEnvelope<unknown> | null): Dict {
  if (!payload) return {};

  const data = asDict(payload.data);

  if (payload.transaction && typeof payload.transaction === "object") {
    return payload.transaction as Dict;
  }

  if (
    payload.treasury_transaction &&
    typeof payload.treasury_transaction === "object"
  ) {
    return payload.treasury_transaction as Dict;
  }

  if (data.transaction && typeof data.transaction === "object") {
    return data.transaction as Dict;
  }

  if (data.treasury_transaction && typeof data.treasury_transaction === "object") {
    return data.treasury_transaction as Dict;
  }

  return Object.keys(data).length > 0 ? data : asDict(payload);
}

function normalizeTransactionType(value: unknown): TransactionType {
  const clean = String(value || "").toUpperCase();

  if (["RECEIPT", "INCOME", "RECEIVE", "CASH_IN"].includes(clean)) {
    return "RECEIPT";
  }

  if (["PAYMENT", "EXPENSE", "PAY", "CASH_OUT"].includes(clean)) {
    return "PAYMENT";
  }

  if (["TRANSFER", "INTERNAL_TRANSFER"].includes(clean)) return "TRANSFER";
  if (["ADJUSTMENT", "OPENING_BALANCE"].includes(clean)) return "ADJUSTMENT";

  return "UNKNOWN";
}

function normalizeStatus(value: unknown): TransactionStatus {
  const clean = String(value || "").toUpperCase();

  if (["DRAFT", "PENDING"].includes(clean)) return "DRAFT";
  if (["CONFIRMED", "POSTED", "APPROVED", "TRUE"].includes(clean)) {
    return "CONFIRMED";
  }
  if (["CANCELLED", "CANCELED", "VOID"].includes(clean)) return "CANCELLED";

  if (typeof value === "boolean") return value ? "CONFIRMED" : "DRAFT";

  return "UNKNOWN";
}

function normalizeTransaction(item: unknown): TransactionDetails {
  const obj = asDict(item);

  const accountObj = asDict(obj.account || obj.treasury_account || obj.from_account);
  const toAccountObj = asDict(obj.to_account || obj.destination_account);

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || ""),
    transaction_number: String(
      getNestedValue(obj, [
        "transaction_number",
        "voucher_number",
        "number",
        "code",
        "reference",
      ]) || "-",
    ),
    transaction_type: normalizeTransactionType(
      getNestedValue(obj, ["transaction_type", "type", "kind", "voucher_type"]),
    ),
    status: normalizeStatus(getNestedValue(obj, ["status", "state", "is_confirmed"])),
    amount: toNumber(getNestedValue(obj, ["amount", "total_amount", "value"])),
    currency: String(getNestedValue(obj, ["currency"]) || "SAR"),
    transaction_date: String(
      getNestedValue(obj, ["transaction_date", "date", "created_at"]) || "",
    ),

    account_id: String(
      getNestedValue(obj, [
        "account_id",
        "treasury_account_id",
        "from_account_id",
        "cashbox_id",
        "bank_id",
      ]) ||
        accountObj.id ||
        accountObj.uuid ||
        "",
    ),
    account_name: String(
      accountObj.name ||
        accountObj.title ||
        getNestedValue(obj, [
          "account_name",
          "treasury_account_name",
          "from_account_name",
          "cashbox_name",
          "bank_name",
        ]) ||
        "",
    ),
    account_code: String(
      accountObj.code ||
        accountObj.account_code ||
        getNestedValue(obj, [
          "account_code",
          "treasury_account_code",
          "from_account_code",
        ]) ||
        "",
    ),

    to_account_id: String(
      getNestedValue(obj, ["to_account_id", "destination_account_id"]) ||
        toAccountObj.id ||
        toAccountObj.uuid ||
        "",
    ),
    to_account_name: String(
      toAccountObj.name ||
        toAccountObj.title ||
        getNestedValue(obj, ["to_account_name", "destination_account_name"]) ||
        "",
    ),
    to_account_code: String(
      toAccountObj.code ||
        toAccountObj.account_code ||
        getNestedValue(obj, ["to_account_code", "destination_account_code"]) ||
        "",
    ),

    source_reference: String(
      getNestedValue(obj, [
        "source_reference",
        "external_reference",
        "payment_reference",
        "ref",
      ]) || "",
    ),
    description: String(getNestedValue(obj, ["description", "notes", "memo"]) || ""),
    notes: String(getNestedValue(obj, ["internal_notes", "extra_notes"]) || ""),

    is_treasury_posted: Boolean(
      getNestedValue(obj, ["is_treasury_posted", "treasury_posted"]),
    ),
    is_accounting_posted: Boolean(
      getNestedValue(obj, ["is_accounting_posted", "accounting_posted"]),
    ),
    treasury_reference: String(
      getNestedValue(obj, ["treasury_reference", "treasury_posting_reference"]) ||
        "",
    ),
    accounting_reference: String(
      getNestedValue(obj, [
        "accounting_reference",
        "journal_entry_reference",
        "accounting_posting_reference",
      ]) || "",
    ),
    created_at: String(getNestedValue(obj, ["created_at", "created"]) || ""),
    updated_at: String(getNestedValue(obj, ["updated_at", "modified"]) || ""),
  };
}

function transactionTypeLabel(type: TransactionType, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<TransactionType, string> = {
    RECEIPT: t.receipt,
    PAYMENT: t.payment,
    TRANSFER: t.transfer,
    ADJUSTMENT: t.adjustment,
    UNKNOWN: t.unknown,
  };

  return labels[type];
}

function statusLabel(status: TransactionStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<TransactionStatus, string> = {
    DRAFT: t.draft,
    CONFIRMED: t.confirmed,
    CANCELLED: t.cancelled,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function transactionTypeBadge(type: TransactionType, locale: AppLocale) {
  const label = transactionTypeLabel(type, locale);

  if (type === "RECEIPT") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (type === "PAYMENT") {
    return (
      <Badge className="rounded-full border-rose-200 bg-rose-50 px-3 py-1 text-rose-700 hover:bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
        {label}
      </Badge>
    );
  }

  if (type === "TRANSFER") {
    return (
      <Badge className="rounded-full border-sky-200 bg-sky-50 px-3 py-1 text-sky-700 hover:bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-300">
        {label}
      </Badge>
    );
  }

  if (type === "ADJUSTMENT") {
    return (
      <Badge className="rounded-full border-violet-200 bg-violet-50 px-3 py-1 text-violet-700 hover:bg-violet-50 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300">
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

function statusBadge(status: TransactionStatus, locale: AppLocale) {
  const label = statusLabel(status, locale);

  if (status === "CONFIRMED") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (status === "DRAFT") {
    return (
      <Badge className="rounded-full border-amber-200 bg-amber-50 px-3 py-1 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
        {label}
      </Badge>
    );
  }

  if (status === "CANCELLED") {
    return (
      <Badge variant="secondary" className="rounded-full px-3 py-1">
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

function DetailsSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="grid gap-4 p-5 md:grid-cols-3">
              {Array.from({ length: 6 }).map((__, itemIndex) => (
                <div key={itemIndex} className="rounded-2xl border bg-background p-4">
                  <SkeletonLine className="h-3 w-20" />
                  <SkeletonLine className="mt-3 h-5 w-32" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardContent className="space-y-4 p-5">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonLine key={index} className="h-10 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoBox({
  label,
  value,
  dir,
}: {
  label: string;
  value: React.ReactNode;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-2 font-semibold" dir={dir}>
        {value || "-"}
      </div>
    </div>
  );
}

function buildPrintHtml({
  locale,
  title,
  transaction,
}: {
  locale: AppLocale;
  title: string;
  transaction: TransactionDetails;
}) {
  const isArabic = locale === "ar";
  const t = dictionary(locale);
  const now = new Date().toLocaleString("en-US");

  const rows = [
    [t.transactionNumber, transaction.transaction_number],
    [t.transactionType, transactionTypeLabel(transaction.transaction_type, locale)],
    [t.status, statusLabel(transaction.status, locale)],
    [t.date, formatDate(transaction.transaction_date, locale)],
    [t.amount, formatMoney(transaction.amount)],
    [t.account, `${transaction.account_name || "-"} ${transaction.account_code ? `(${transaction.account_code})` : ""}`],
    [t.toAccount, `${transaction.to_account_name || "-"} ${transaction.to_account_code ? `(${transaction.to_account_code})` : ""}`],
    [t.sourceReference, transaction.source_reference || "-"],
    [t.treasuryPosted, transaction.is_treasury_posted ? t.posted : t.notPosted],
    [t.accountingPosted, transaction.is_accounting_posted ? t.posted : t.notPosted],
    [t.description, transaction.description || "-"],
    [t.notes, transaction.notes || "-"],
  ]
    .map(
      ([label, value]) => `
        <tr>
          <th>${escapeHtml(label)}</th>
          <td>${escapeHtml(value)}</td>
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
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th {
            width: 240px;
            background: #f3f4f6;
            color: #111827;
            font-weight: 700;
          }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 10px 9px;
            text-align: ${isArabic ? "right" : "left"};
            vertical-align: top;
          }
          @page { size: A4; margin: 12mm; }
          @media print { body { padding: 0; } }
        </style>
      </head>

      <body>
        <div class="print-header">
          <div>
            <h1>${escapeHtml(title)}</h1>
            <div class="meta">
              <div>${escapeHtml(transaction.transaction_number)}</div>
              <div>${escapeHtml(t.printedAt)}: ${escapeHtml(now)}</div>
            </div>
          </div>
          <div class="badge">Primey Care</div>
        </div>

        <table>
          <tbody>${rows}</tbody>
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

export default function TreasuryTransactionDetailsPage() {
  const params = useParams<{ id?: string }>();
  const auth = useAuth() as unknown;

  const transactionId = String(params?.id || "");

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [transaction, setTransaction] = useState<TransactionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notFound, setNotFound] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canView = hasSafePermission(
    auth,
    ["treasury.view", "treasury.transactions.view"],
    "view",
  );

  const canConfirm = hasSafePermission(
    auth,
    ["treasury.confirm", "treasury.transactions.confirm", "treasury.manage"],
    "action",
  );

  const canCancel = hasSafePermission(
    auth,
    ["treasury.cancel", "treasury.transactions.cancel", "treasury.manage"],
    "action",
  );

  const canPrint = hasSafePermission(
    auth,
    ["treasury.print", "treasury.reports.print", "reports.print"],
    "action",
  );

  const currentTransactionId = transaction?.id ?? "";
  const currentTransactionStatus: TransactionStatus =
    transaction?.status ?? "UNKNOWN";

  const canShowConfirm =
    transaction !== null &&
    Boolean(currentTransactionId) &&
    canConfirm &&
    currentTransactionStatus === "DRAFT" &&
    !isConfirming &&
    !isCancelling;

  const canShowCancel =
    transaction !== null &&
    Boolean(currentTransactionId) &&
    canCancel &&
    currentTransactionStatus !== "CANCELLED" &&
    !isConfirming &&
    !isCancelling;

  const loadTransaction = useCallback(
    async (showToast = false) => {
      if (!canView) {
        setIsLoading(false);
        return;
      }

      if (!transactionId) {
        setIsLoading(false);
        setNotFound(true);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");
        setNotFound(false);

        const response = await fetch(
          apiUrl(`/api/treasury/transactions/${transactionId}/`),
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: { Accept: "application/json" },
          },
        );

        const payload = (await response.json().catch(() => null)) as
          | ApiEnvelope<unknown>
          | null;

        if (response.status === 404) {
          setTransaction(null);
          setNotFound(true);
          return;
        }

        if (!response.ok || payload?.ok === false || payload?.success === false) {
          throw new Error(
            payload?.message ||
              payload?.detail ||
              payload?.error ||
              `HTTP ${response.status}`,
          );
        }

        const normalized = normalizeTransaction(extractTransactionData(payload));

        if (!isValidId(normalized.id) && !normalized.transaction_number) {
          setTransaction(null);
          setNotFound(true);
          return;
        }

        setTransaction(normalized);

        if (showToast) {
          toast.success(t.loadSuccess);
        }
      } catch (error) {
        console.error("Treasury transaction details load error:", error);
        setTransaction(null);
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [canView, t.loadError, t.loadSuccess, transactionId],
  );

  async function runTransactionAction(
    action: "confirm" | "cancel",
    endpoint: string,
  ) {
    if (!transaction) return;

    const confirmed = window.confirm(
      action === "confirm" ? t.confirmPrompt : t.cancelPrompt,
    );

    if (!confirmed) return;

    try {
      if (action === "confirm") {
        setIsConfirming(true);
      } else {
        setIsCancelling(true);
      }

      const csrfToken = getCookie("csrftoken");

      const response = await fetch(apiUrl(endpoint), {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
        },
        body: JSON.stringify({ id: currentTransactionId }),
      });

      const payload = (await response.json().catch(() => null)) as
        | ApiEnvelope<unknown>
        | null;

      if (!response.ok || payload?.ok === false || payload?.success === false) {
        throw new Error(
          payload?.message ||
            payload?.detail ||
            payload?.error ||
            `HTTP ${response.status}`,
        );
      }

      toast.success(action === "confirm" ? t.confirmSuccess : t.cancelSuccess);
      await loadTransaction(false);
    } catch (error) {
      console.error(`Treasury transaction ${action} error:`, error);
      toast.error(action === "confirm" ? t.confirmError : t.cancelError);
    } finally {
      setIsConfirming(false);
      setIsCancelling(false);
    }
  }

  function printPage() {
    if (!canPrint || !transaction) return;

    const printWindow = window.open("", "_blank", "width=1000,height=800");

    if (!printWindow) {
      toast.error(t.printError);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      buildPrintHtml({
        locale,
        title: t.title,
        transaction,
      }),
    );
    printWindow.document.close();

    toast.success(t.printSuccess);
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t.copied);
    } catch {
      toast.success(t.copied);
    }
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
    loadTransaction(false);
  }, [authResolving, loadTransaction]);

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
            {transaction
              ? `${transaction.transaction_number} - ${transactionTypeLabel(
                  transaction.transaction_type,
                  locale,
                )}`
              : t.subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link href="/system/treasury/transactions">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>

          <Link href="/system/treasury">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <Wallet className="h-4 w-4" />
              <span>{t.treasury}</span>
            </Button>
          </Link>

          <Link href="/system/treasury/accounts">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <CreditCard className="h-4 w-4" />
              <span>{t.accounts}</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadTransaction(true)}
            disabled={isLoading || isConfirming || isCancelling}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refresh}</span>
          </Button>

          {canPrint ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={printPage}
              disabled={isLoading || !transaction}
            >
              <Printer className="h-4 w-4" />
              <span>{t.print}</span>
            </Button>
          ) : null}

          {canShowConfirm ? (
            <Button
              className="h-10 rounded-xl"
              onClick={() =>
                runTransactionAction(
                  "confirm",
                  `/api/treasury/transactions/${currentTransactionId}/confirm/`,
                )
              }
            >
              {isConfirming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <span>{isConfirming ? t.confirming : t.confirm}</span>
            </Button>
          ) : null}

          {canShowCancel ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() =>
                runTransactionAction(
                  "cancel",
                  `/api/treasury/transactions/${currentTransactionId}/cancel/`,
                )
              }
            >
              {isCancelling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <span>{isCancelling ? t.cancelling : t.cancel}</span>
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
              onClick={() => loadTransaction(true)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && notFound ? (
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
              <CreditCard className="h-5 w-5" />
            </div>

            <div>
              <p className="font-semibold">{t.notFoundTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.notFoundText}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? <DetailsSkeleton /> : null}

      {!isLoading && transaction && !errorMessage && !notFound ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-2xl font-bold">
                        <MoneyText value={transaction.amount} />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t.amount}
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                      <Banknote className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="mt-1">{transactionTypeBadge(transaction.transaction_type, locale)}</div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {t.transactionType}
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                      {transaction.transaction_type === "RECEIPT" ? (
                        <Receipt className="h-5 w-5" />
                      ) : transaction.transaction_type === "PAYMENT" ? (
                        <Banknote className="h-5 w-5" />
                      ) : transaction.transaction_type === "TRANSFER" ? (
                        <ArrowLeftRight className="h-5 w-5" />
                      ) : (
                        <CreditCard className="h-5 w-5" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="mt-1">{statusBadge(transaction.status, locale)}</div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {t.status}
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-2xl font-bold">
                        {formatDate(transaction.transaction_date, locale)}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t.date}
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300">
                      <CalendarDays className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <FileText className="h-4 w-4" />
                  {t.infoTitle}
                </CardTitle>
                <CardDescription>{t.infoDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <InfoBox
                  label={t.transactionNumber}
                  value={
                    <span className="inline-flex items-center gap-2">
                      <span>{transaction.transaction_number || "-"}</span>
                      {transaction.transaction_number ? (
                        <button
                          type="button"
                          onClick={() => copyText(transaction.transaction_number)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span className="sr-only">{t.copy}</span>
                        </button>
                      ) : null}
                    </span>
                  }
                  dir="ltr"
                />

                <InfoBox
                  label={t.transactionType}
                  value={transactionTypeBadge(transaction.transaction_type, locale)}
                />

                <InfoBox
                  label={t.status}
                  value={statusBadge(transaction.status, locale)}
                />

                <InfoBox
                  label={t.amount}
                  value={<MoneyText value={transaction.amount} />}
                />

                <InfoBox
                  label={t.date}
                  value={formatDate(transaction.transaction_date, locale)}
                />

                <InfoBox
                  label={t.sourceReference}
                  value={transaction.source_reference || "-"}
                  dir="ltr"
                />

                <InfoBox
                  label={t.createdAt}
                  value={formatDate(transaction.created_at, locale)}
                />

                <InfoBox
                  label={t.updatedAt}
                  value={formatDate(transaction.updated_at, locale)}
                />
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Wallet className="h-4 w-4" />
                  {t.accountTitle}
                </CardTitle>
                <CardDescription>{t.accountDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4 md:grid-cols-2">
                <InfoBox
                  label={
                    transaction.transaction_type === "TRANSFER"
                      ? t.fromAccount
                      : t.account
                  }
                  value={
                    <div>
                      <p>{transaction.account_name || t.notSet}</p>
                      <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                        {transaction.account_code || "-"}
                      </p>
                    </div>
                  }
                />

                {transaction.transaction_type === "TRANSFER" ? (
                  <InfoBox
                    label={t.toAccount}
                    value={
                      <div>
                        <p>{transaction.to_account_name || t.notSet}</p>
                        <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                          {transaction.to_account_code || "-"}
                        </p>
                      </div>
                    }
                  />
                ) : null}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <ShieldCheck className="h-4 w-4" />
                  {t.postingTitle}
                </CardTitle>
                <CardDescription>{t.postingDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4 md:grid-cols-2">
                <InfoBox
                  label={t.treasuryPosted}
                  value={
                    transaction.is_treasury_posted ? (
                      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                        {t.posted}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="rounded-full px-3 py-1">
                        {t.notPosted}
                      </Badge>
                    )
                  }
                />

                <InfoBox
                  label={t.accountingPosted}
                  value={
                    transaction.is_accounting_posted ? (
                      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                        {t.posted}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="rounded-full px-3 py-1">
                        {t.notPosted}
                      </Badge>
                    )
                  }
                />

                <InfoBox
                  label={t.treasuryReference}
                  value={transaction.treasury_reference || "-"}
                  dir="ltr"
                />

                <InfoBox
                  label={t.accountingReference}
                  value={transaction.accounting_reference || "-"}
                  dir="ltr"
                />
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <FileText className="h-4 w-4" />
                  {t.notesTitle}
                </CardTitle>
                <CardDescription>{t.notesDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6">
                    {transaction.description || "-"}
                  </p>
                </div>

                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">{t.notes}</p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6">
                    {transaction.notes || "-"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4">
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <CheckCircle2 className="h-4 w-4" />
                  {t.infoTitle}
                </CardTitle>
                <CardDescription>{t.infoDesc}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
                  <span>{t.transactionNumber}</span>
                  <span className="font-semibold" dir="ltr">
                    {transaction.transaction_number}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
                  <span>{t.amount}</span>
                  <MoneyText value={transaction.amount} />
                </div>

                <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
                  <span>{t.status}</span>
                  {statusBadge(transaction.status, locale)}
                </div>

                <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
                  <span>{t.transactionType}</span>
                  {transactionTypeBadge(transaction.transaction_type, locale)}
                </div>

                <div className="grid gap-2 pt-2">
                  {canShowConfirm ? (
                    <Button
                      type="button"
                      className="h-11 rounded-2xl"
                      onClick={() =>
                        runTransactionAction(
                          "confirm",
                          `/api/treasury/transactions/${currentTransactionId}/confirm/`,
                        )
                      }
                    >
                      {isConfirming ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {isConfirming ? t.confirming : t.confirm}
                    </Button>
                  ) : null}

                  {canShowCancel ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-2xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() =>
                        runTransactionAction(
                          "cancel",
                          `/api/treasury/transactions/${currentTransactionId}/cancel/`,
                        )
                      }
                    >
                      {isCancelling ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      {isCancelling ? t.cancelling : t.cancel}
                    </Button>
                  ) : null}

                  {canPrint ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-2xl"
                      onClick={printPage}
                    >
                      <Printer className="h-4 w-4" />
                      {t.print}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {transaction.transaction_type === "RECEIPT" ? (
                    <Receipt className="h-4 w-4" />
                  ) : transaction.transaction_type === "PAYMENT" ? (
                    <Banknote className="h-4 w-4" />
                  ) : transaction.transaction_type === "TRANSFER" ? (
                    <ArrowLeftRight className="h-4 w-4" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  {transactionTypeLabel(transaction.transaction_type, locale)}
                </div>

                <p className="text-sm leading-6 text-muted-foreground">
                  {transaction.description || t.subtitle}
                </p>

                <div className="text-2xl font-bold">
                  <MoneyText value={transaction.amount} />
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      ) : null}
    </div>
  );
}