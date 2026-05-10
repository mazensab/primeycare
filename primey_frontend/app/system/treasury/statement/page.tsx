"use client";

/* ============================================================
   📂 app/system/treasury/statement/page.tsx
   🧠 Primey Care | Treasury General Statement Page

   ✅ المسار:
      app/system/treasury/statement/page.tsx

   ✅ العمل:
      صفحة كشف حساب الخزينة العام داخل النظام.
      تعرض حركة الخزينة حسب الحساب، التاريخ، نوع الحركة، الحالة، والرصيد الجاري.

   ✅ الإصدار:
      Phase 17 UX Refinement + Treasury General Statement Build

   ✅ يعتمد على:
      - /api/treasury/transactions/
      - /api/treasury/accounts/
      - primey-locale
      - AuthProvider
      - sonner
      - /currency/sar.svg

   ✅ متوافق مع:
      - Treasury overview page
      - Treasury accounts pages
      - Treasury account statement page
      - Treasury vouchers pages
      - Treasury transactions pages
      - Centers / Customers approved UX standard

   ✅ الوظائف:
      - عرض كشف حساب الخزينة العام.
      - فلترة حسب حساب الخزينة.
      - فلترة حسب نوع الحركة.
      - فلترة حسب الحالة.
      - فلترة حسب التاريخ من / إلى.
      - بحث في صف مستقل.
      - فلاتر في صف مستقل.
      - حساب الرصيد الجاري محليًا حسب الفلاتر.
      - Excel export بصيغة .xls HTML Workbook.
      - Web PDF Print.
      - Error State مستقل.
      - Empty State ذكي.
      - Skeleton Loading.
      - صلاحيات آمنة بدون كسر system_admin/superuser.
      - أرقام إنجليزية دائمًا.
      - رمز SAR من /currency/sar.svg بعد الرقم.
      - استخدام sonner للتنبيهات.

   ------------------------------------------------------------
   ملاحظة:
      الملف المرفق كان خاصًا بقائمة القيود اليومية في المحاسبة وليس
      ملف كشف حساب الخزينة المطلوب، لذلك تم بناء هذه الصفحة من الصفر
      بنفس القاعدة والنمط المعتمد.
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Banknote,
  CalendarDays,
  Download,
  Eye,
  FileText,
  Loader2,
  Printer,
  RefreshCcw,
  Search,
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

type TransactionType =
  | "RECEIPT"
  | "PAYMENT"
  | "TRANSFER"
  | "ADJUSTMENT"
  | "UNKNOWN";

type TransactionStatus = "DRAFT" | "CONFIRMED" | "CANCELLED" | "UNKNOWN";

type TypeFilter = "ALL" | TransactionType;
type StatusFilter = "ALL" | TransactionStatus;
type AccountFilter = "ALL" | string;

type SortKey =
  | "transaction_date"
  | "transaction_number"
  | "transaction_type"
  | "status"
  | "account_name"
  | "amount";

type SortDirection = "asc" | "desc";

type TreasuryAccountOption = {
  id: string;
  name: string;
  code: string;
  current_balance: number;
};

type StatementRow = {
  id: string;
  transaction_number: string;
  transaction_type: TransactionType;
  status: TransactionStatus;
  amount: number;
  debit: number;
  credit: number;
  running_balance: number;
  transaction_date: string;
  account_id: string;
  account_name: string;
  account_code: string;
  to_account_id: string;
  to_account_name: string;
  to_account_code: string;
  source_reference: string;
  description: string;
  is_treasury_posted: boolean;
  is_accounting_posted: boolean;
  created_at: string;
};

type StatementSummary = {
  rows_count: number;
  opening_balance: number;
  total_debit: number;
  total_credit: number;
  closing_balance: number;
  confirmed_count: number;
  draft_count: number;
  cancelled_count: number;
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
  transactions?: unknown[];
  accounts?: unknown[];
};

const SAR_ICON_PATH = "/currency/sar.svg";
const PAGE_SIZE = 14;

const DEFAULT_SUMMARY: StatementSummary = {
  rows_count: 0,
  opening_balance: 0,
  total_debit: 0,
  total_credit: 0,
  closing_balance: 0,
  confirmed_count: 0,
  draft_count: 0,
  cancelled_count: 0,
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
    title: isArabic ? "كشف حساب الخزينة" : "Treasury Statement",
    subtitle: isArabic
      ? "مراجعة حركة الخزينة العامة مع الرصيد الجاري حسب الحساب والفترة ونوع الحركة."
      : "Review the general treasury statement with running balance by account, period, and transaction type.",

    back: isArabic ? "الخزينة" : "Treasury",
    accounts: isArabic ? "حسابات الخزينة" : "Treasury Accounts",
    transactions: isArabic ? "الحركات المالية" : "Transactions",
    vouchers: isArabic ? "السندات" : "Vouchers",
    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",

    summaryTitle: isArabic ? "ملخص كشف الحساب" : "Statement Summary",
    summaryDesc: isArabic
      ? "ملخص الأرصدة والحركات حسب الفلاتر الحالية."
      : "Balance and movement summary based on the current filters.",

    tableTitle: isArabic ? "حركة كشف الحساب" : "Statement Movements",
    tableDesc: isArabic
      ? "كل الحركات التي تؤثر على كشف حساب الخزينة."
      : "All movements affecting the treasury statement.",

    openingBalance: isArabic ? "رصيد افتتاحي" : "Opening Balance",
    totalDebit: isArabic ? "إجمالي مدين" : "Total Debit",
    totalCredit: isArabic ? "إجمالي دائن" : "Total Credit",
    closingBalance: isArabic ? "الرصيد الختامي" : "Closing Balance",
    rowsCount: isArabic ? "عدد الحركات" : "Rows Count",
    confirmedCount: isArabic ? "مؤكدة" : "Confirmed",
    draftCount: isArabic ? "مسودات" : "Drafts",
    cancelledCount: isArabic ? "ملغاة" : "Cancelled",
    treasuryPosted: isArabic ? "مرحّل خزينة" : "Treasury Posted",
    accountingPosted: isArabic ? "مرحّل محاسبيًا" : "Accounting Posted",

    searchPlaceholder: isArabic
      ? "ابحث برقم الحركة أو الحساب أو المرجع أو الوصف..."
      : "Search by transaction number, account, reference, or description...",

    allAccounts: isArabic ? "كل حسابات الخزينة" : "All Treasury Accounts",
    allTypes: isArabic ? "كل أنواع الحركات" : "All Transaction Types",
    allStatuses: isArabic ? "كل الحالات" : "All Statuses",
    fromDate: isArabic ? "من تاريخ" : "From Date",
    toDate: isArabic ? "إلى تاريخ" : "To Date",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",

    receipt: isArabic ? "قبض" : "Receipt",
    payment: isArabic ? "صرف" : "Payment",
    transfer: isArabic ? "تحويل" : "Transfer",
    adjustment: isArabic ? "تسوية" : "Adjustment",
    unknown: isArabic ? "غير محدد" : "Unknown",

    draft: isArabic ? "مسودة" : "Draft",
    confirmed: isArabic ? "مؤكد" : "Confirmed",
    cancelled: isArabic ? "ملغي" : "Cancelled",

    debit: isArabic ? "مدين" : "Debit",
    credit: isArabic ? "دائن" : "Credit",
    runningBalance: isArabic ? "الرصيد الجاري" : "Running Balance",
    posted: isArabic ? "مرحّل" : "Posted",
    notPosted: isArabic ? "غير مرحّل" : "Not Posted",
    accounting: isArabic ? "محاسبي" : "Accounting",
    treasury: isArabic ? "خزينة" : "Treasury",

    table: {
      date: isArabic ? "التاريخ" : "Date",
      number: isArabic ? "رقم الحركة" : "Transaction No.",
      type: isArabic ? "نوع الحركة" : "Type",
      status: isArabic ? "الحالة" : "Status",
      account: isArabic ? "الحساب" : "Account",
      debit: isArabic ? "مدين" : "Debit",
      credit: isArabic ? "دائن" : "Credit",
      balance: isArabic ? "الرصيد" : "Balance",
      reference: isArabic ? "المرجع" : "Reference",
      posting: isArabic ? "الترحيل" : "Posting",
      action: isArabic ? "الإجراء" : "Action",
    },

    view: isArabic ? "عرض" : "View",

    emptyTitle: isArabic ? "لا توجد حركات" : "No movements",
    emptyText: isArabic
      ? "ستظهر حركات كشف الحساب هنا بعد تسجيلها."
      : "Statement movements will appear here after they are recorded.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير البحث أو الفلاتر."
      : "Try changing the search or filters.",

    accessDeniedTitle: isArabic
      ? "غير مصرح بعرض كشف حساب الخزينة"
      : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض كشف حساب الخزينة. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view treasury statement. Contact your system administrator if you need access.",

    loadError: isArabic
      ? "تعذر تحميل كشف حساب الخزينة."
      : "Unable to load treasury statement.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    loadSuccess: isArabic
      ? "تم تحديث كشف حساب الخزينة بنجاح."
      : "Treasury statement refreshed successfully.",

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

function normalizeAccount(item: unknown): TreasuryAccountOption {
  const obj = asDict(item);

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || ""),
    name: String(getNestedValue(obj, ["name", "title", "label"]) || "-"),
    code: String(getNestedValue(obj, ["code", "account_code", "number"]) || "-"),
    current_balance: toNumber(
      getNestedValue(obj, ["current_balance", "balance", "available_balance"]),
    ),
  };
}

function normalizeStatementRow(item: unknown, index: number): StatementRow {
  const obj = asDict(item);
  const accountObj = asDict(obj.account || obj.treasury_account || obj.from_account);
  const toAccountObj = asDict(obj.to_account || obj.destination_account);

  const transactionType = normalizeTransactionType(
    getNestedValue(obj, ["transaction_type", "type", "kind", "voucher_type"]),
  );

  const amount = toNumber(getNestedValue(obj, ["amount", "total_amount", "value"]));

  const debit =
    transactionType === "RECEIPT" || transactionType === "ADJUSTMENT"
      ? amount
      : 0;

  const credit = transactionType === "PAYMENT" ? amount : 0;

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || `${index}`),
    transaction_number: String(
      getNestedValue(obj, [
        "transaction_number",
        "voucher_number",
        "number",
        "code",
        "reference",
      ]) || "-",
    ),
    transaction_type: transactionType,
    status: normalizeStatus(getNestedValue(obj, ["status", "state", "is_confirmed"])),
    amount,
    debit,
    credit,
    running_balance: 0,
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
        "accounting_reference",
        "ref",
      ]) || "",
    ),
    description: String(getNestedValue(obj, ["description", "notes", "memo"]) || ""),
    is_treasury_posted: Boolean(
      getNestedValue(obj, ["is_treasury_posted", "treasury_posted"]),
    ),
    is_accounting_posted: Boolean(
      getNestedValue(obj, ["is_accounting_posted", "accounting_posted"]),
    ),
    created_at: String(getNestedValue(obj, ["created_at", "created"]) || ""),
  };
}

function attachRunningBalance(rows: StatementRow[], openingBalance = 0) {
  let balance = openingBalance;

  return rows.map((item) => {
    const delta = item.debit - item.credit;
    balance += delta;

    return {
      ...item,
      running_balance: balance,
    };
  });
}

function buildSummary(rows: StatementRow[], openingBalance = 0): StatementSummary {
  const totalDebit = rows.reduce((sum, item) => sum + item.debit, 0);
  const totalCredit = rows.reduce((sum, item) => sum + item.credit, 0);

  return {
    rows_count: rows.length,
    opening_balance: openingBalance,
    total_debit: totalDebit,
    total_credit: totalCredit,
    closing_balance: openingBalance + totalDebit - totalCredit,
    confirmed_count: rows.filter((item) => item.status === "CONFIRMED").length,
    draft_count: rows.filter((item) => item.status === "DRAFT").length,
    cancelled_count: rows.filter((item) => item.status === "CANCELLED").length,
    treasury_posted_count: rows.filter((item) => item.is_treasury_posted).length,
    accounting_posted_count: rows.filter((item) => item.is_accounting_posted)
      .length,
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

function typeBadge(type: TransactionType, locale: AppLocale) {
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

function sortValue(row: StatementRow, key: SortKey): string | number {
  if (key === "amount") return row.amount;

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
          {Array.from({ length: 11 }).map((__, columnIndex) => (
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
  summary: StatementSummary;
  rows: StatementRow[];
}) {
  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const align = isArabic ? "right" : "left";
  const t = dictionary(locale);

  const rowsHtml = rows
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(formatDate(item.transaction_date, locale))}</td>
          <td>${escapeHtml(item.transaction_number)}</td>
          <td>${escapeHtml(transactionTypeLabel(item.transaction_type, locale))}</td>
          <td>${escapeHtml(statusLabel(item.status, locale))}</td>
          <td>${escapeHtml(item.account_name || "-")}</td>
          <td>${escapeHtml(item.account_code || "-")}</td>
          <td>${escapeHtml(formatMoney(item.debit))}</td>
          <td>${escapeHtml(formatMoney(item.credit))}</td>
          <td>${escapeHtml(formatMoney(item.running_balance))}</td>
          <td>${escapeHtml(item.source_reference || "-")}</td>
          <td>${escapeHtml(item.is_treasury_posted ? t.posted : t.notPosted)}</td>
          <td>${escapeHtml(item.is_accounting_posted ? t.posted : t.notPosted)}</td>
          <td>${escapeHtml(item.description || "-")}</td>
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
          <tr><td class="title" colspan="13">${escapeHtml(title)}</td></tr>
          <tr><td colspan="13"></td></tr>
          <tr><td class="section" colspan="13">${escapeHtml(t.summaryTitle)}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.generatedAt)}</td><td class="summary-value" colspan="12">${escapeHtml(new Date().toLocaleString("en-US"))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.openingBalance)}</td><td class="summary-value" colspan="12">${escapeHtml(formatMoney(summary.opening_balance))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalDebit)}</td><td class="summary-value" colspan="12">${escapeHtml(formatMoney(summary.total_debit))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalCredit)}</td><td class="summary-value" colspan="12">${escapeHtml(formatMoney(summary.total_credit))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.closingBalance)}</td><td class="summary-value" colspan="12">${escapeHtml(formatMoney(summary.closing_balance))}</td></tr>

          <tr><td colspan="13"></td></tr>
          <tr>
            <th>${escapeHtml(t.table.date)}</th>
            <th>${escapeHtml(t.table.number)}</th>
            <th>${escapeHtml(t.table.type)}</th>
            <th>${escapeHtml(t.table.status)}</th>
            <th>${escapeHtml(t.table.account)}</th>
            <th>${escapeHtml(isArabic ? "كود الحساب" : "Account Code")}</th>
            <th>${escapeHtml(t.table.debit)}</th>
            <th>${escapeHtml(t.table.credit)}</th>
            <th>${escapeHtml(t.table.balance)}</th>
            <th>${escapeHtml(t.table.reference)}</th>
            <th>${escapeHtml(t.treasuryPosted)}</th>
            <th>${escapeHtml(t.accountingPosted)}</th>
            <th>${escapeHtml(isArabic ? "الوصف" : "Description")}</th>
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
  summary: StatementSummary;
  rows: StatementRow[];
}) {
  const isArabic = locale === "ar";
  const t = dictionary(locale);
  const now = new Date().toLocaleString("en-US");

  const tableRows = rows
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(formatDate(item.transaction_date, locale))}</td>
          <td>${escapeHtml(item.transaction_number)}</td>
          <td>${escapeHtml(transactionTypeLabel(item.transaction_type, locale))}</td>
          <td>${escapeHtml(item.account_name || "-")}</td>
          <td>${escapeHtml(formatMoney(item.debit))}</td>
          <td>${escapeHtml(formatMoney(item.credit))}</td>
          <td>${escapeHtml(formatMoney(item.running_balance))}</td>
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
          <div class="summary-card"><span>${escapeHtml(t.openingBalance)}</span><strong>${formatMoney(summary.opening_balance)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.totalDebit)}</span><strong>${formatMoney(summary.total_debit)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.totalCredit)}</span><strong>${formatMoney(summary.total_credit)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.closingBalance)}</span><strong>${formatMoney(summary.closing_balance)}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${escapeHtml(t.table.date)}</th>
              <th>${escapeHtml(t.table.number)}</th>
              <th>${escapeHtml(t.table.type)}</th>
              <th>${escapeHtml(t.table.account)}</th>
              <th>${escapeHtml(t.table.debit)}</th>
              <th>${escapeHtml(t.table.credit)}</th>
              <th>${escapeHtml(t.table.balance)}</th>
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

export default function TreasuryStatementPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [rows, setRows] = useState<StatementRow[]>([]);
  const [accounts, setAccounts] = useState<TreasuryAccountOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [query, setQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState<AccountFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("transaction_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canView = hasSafePermission(
    auth,
    [
      "treasury.view",
      "treasury.statement.view",
      "treasury.transactions.view",
      "treasury.reports.view",
    ],
    "view",
  );

  const canExport = hasSafePermission(
    auth,
    ["treasury.export", "treasury.reports.export", "reports.export"],
    "action",
  );

  const canPrint = hasSafePermission(
    auth,
    ["treasury.print", "treasury.reports.print", "reports.print"],
    "action",
  );

  const canViewDetails = hasSafePermission(
    auth,
    ["treasury.view", "treasury.transactions.view"],
    "view",
  );

  const selectedAccount = useMemo(
    () => accounts.find((item) => item.id === accountFilter) || null,
    [accountFilter, accounts],
  );

  const openingBalance = selectedAccount?.current_balance || 0;

  const filteredRows = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    const filtered = rows.filter((item) => {
      const matchesAccount =
        accountFilter === "ALL"
          ? true
          : item.account_id === accountFilter ||
            item.account_code === accountFilter ||
            item.to_account_id === accountFilter ||
            item.to_account_code === accountFilter;

      const matchesType =
        typeFilter === "ALL" ? true : item.transaction_type === typeFilter;

      const matchesStatus =
        statusFilter === "ALL" ? true : item.status === statusFilter;

      const rowDate = item.transaction_date ? item.transaction_date.slice(0, 10) : "";

      const matchesFromDate = fromDate ? rowDate >= fromDate : true;
      const matchesToDate = toDate ? rowDate <= toDate : true;

      const matchesQuery = !cleanQuery
        ? true
        : [
            item.transaction_number,
            item.account_name,
            item.account_code,
            item.to_account_name,
            item.to_account_code,
            item.source_reference,
            item.description,
            transactionTypeLabel(item.transaction_type, locale),
            statusLabel(item.status, locale),
          ]
            .join(" ")
            .toLowerCase()
            .includes(cleanQuery);

      return (
        matchesAccount &&
        matchesType &&
        matchesStatus &&
        matchesFromDate &&
        matchesToDate &&
        matchesQuery
      );
    });

    const sorted = [...filtered].sort((a, b) => {
      const first = sortValue(a, sortKey);
      const second = sortValue(b, sortKey);

      if (typeof first === "number" && typeof second === "number") {
        return sortDirection === "asc" ? first - second : second - first;
      }

      return sortDirection === "asc"
        ? String(first).localeCompare(String(second))
        : String(second).localeCompare(String(first));
    });

    const balanceRows = attachRunningBalance(
      [...sorted].reverse(),
      accountFilter === "ALL" ? 0 : openingBalance,
    );

    return sortDirection === "desc" ? [...balanceRows].reverse() : balanceRows;
  }, [
    accountFilter,
    fromDate,
    locale,
    openingBalance,
    query,
    rows,
    sortDirection,
    sortKey,
    statusFilter,
    toDate,
    typeFilter,
  ]);

  const activeSummary = useMemo(
    () => buildSummary(filteredRows, accountFilter === "ALL" ? 0 : openingBalance),
    [accountFilter, filteredRows, openingBalance],
  );

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  const paginatedRows = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * PAGE_SIZE;

    return filteredRows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredRows, page, totalPages]);

  const hasSearchOrFilter =
    query.trim().length > 0 ||
    accountFilter !== "ALL" ||
    typeFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    Boolean(fromDate) ||
    Boolean(toDate);

  const typeOptions: Array<{ value: TypeFilter; label: string }> = [
    { value: "ALL", label: t.allTypes },
    { value: "RECEIPT", label: t.receipt },
    { value: "PAYMENT", label: t.payment },
    { value: "TRANSFER", label: t.transfer },
    { value: "ADJUSTMENT", label: t.adjustment },
  ];

  const statusOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: "ALL", label: t.allStatuses },
    { value: "DRAFT", label: t.draft },
    { value: "CONFIRMED", label: t.confirmed },
    { value: "CANCELLED", label: t.cancelled },
  ];

  const loadStatement = useCallback(
    async (showToast = false) => {
      if (!canView) {
        setRows([]);
        setAccounts([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");

        const [transactionsResponse, accountsResponse] = await Promise.allSettled([
          fetch(apiUrl("/api/treasury/transactions/?page_size=500"), {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: { Accept: "application/json" },
          }),
          fetch(apiUrl("/api/treasury/accounts/?page_size=500"), {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: { Accept: "application/json" },
          }),
        ]);

        async function readJson(result: PromiseSettledResult<Response>) {
          if (result.status !== "fulfilled") return null;

          const response = result.value;
          const payload = (await response.json().catch(() => null)) as
            | ApiEnvelope<unknown>
            | null;

          if ([400, 404, 405].includes(response.status)) return null;

          if (
            !response.ok ||
            payload?.ok === false ||
            payload?.success === false
          ) {
            throw new Error(
              payload?.message ||
                payload?.detail ||
                payload?.error ||
                `HTTP ${response.status}`,
            );
          }

          return payload;
        }

        const transactionsPayload = await readJson(transactionsResponse);
        const accountsPayload = await readJson(accountsResponse);

        const normalizedRows = extractRows(transactionsPayload, "transactions")
          .map(normalizeStatementRow)
          .filter((item) => item.id || item.transaction_number);

        const normalizedAccounts = extractRows(accountsPayload, "accounts")
          .map(normalizeAccount)
          .filter((item) => item.id || item.name);

        setRows(normalizedRows);
        setAccounts(normalizedAccounts);
        setPage(1);

        if (showToast) toast.success(t.loadSuccess);
      } catch (error) {
        console.error("Treasury statement load error:", error);
        setRows([]);
        setAccounts([]);
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
    setAccountFilter("ALL");
    setTypeFilter("ALL");
    setStatusFilter("ALL");
    setFromDate("");
    setToDate("");
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
      filename: `primey-care-treasury-statement-${new Date()
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "كشف الخزينة" : "Statement",
      title: t.title,
      locale,
      summary: activeSummary,
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
        summary: activeSummary,
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
    loadStatement(false);
  }, [authResolving, loadStatement]);

  useEffect(() => {
    setPage(1);
  }, [query, accountFilter, typeFilter, statusFilter, fromDate, toDate]);

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
          <Link href="/system/treasury">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>

          <Link href="/system/treasury/accounts">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <Wallet className="h-4 w-4" />
              <span>{t.accounts}</span>
            </Button>
          </Link>

          <Link href="/system/treasury/transactions">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <Banknote className="h-4 w-4" />
              <span>{t.transactions}</span>
            </Button>
          </Link>

          <Link href="/system/treasury/vouchers">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <FileText className="h-4 w-4" />
              <span>{t.vouchers}</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadStatement(true)}
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
              onClick={() => loadStatement(true)}
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
                    <MoneyText value={activeSummary.opening_balance} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.openingBalance}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                  <Wallet className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-2xl font-bold">
                    <MoneyText value={activeSummary.total_debit} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.totalDebit}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <ArrowUp className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-2xl font-bold">
                    <MoneyText value={activeSummary.total_credit} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.totalCredit}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                  <ArrowDown className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-2xl font-bold">
                    <MoneyText value={activeSummary.closing_balance} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.closingBalance}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                  <ShieldCheck className="h-5 w-5" />
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
              <span className="text-muted-foreground">{t.rowsCount}</span>
              <span className="font-semibold">
                {formatNumber(activeSummary.rows_count)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{t.confirmedCount}</span>
              <span className="font-semibold">
                {formatNumber(activeSummary.confirmed_count)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{t.treasuryPosted}</span>
              <span className="font-semibold">
                {formatNumber(activeSummary.treasury_posted_count)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{t.accountingPosted}</span>
              <span className="font-semibold">
                {formatNumber(activeSummary.accounting_posted_count)}
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
                onClick={() => loadStatement(true)}
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

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            <select
              value={accountFilter}
              onChange={(event) => setAccountFilter(event.target.value)}
              className="h-11 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="ALL">{t.allAccounts}</option>
              {accounts.map((account) => (
                <option key={account.id || account.code} value={account.id}>
                  {account.name} {account.code ? `(${account.code})` : ""}
                </option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
              className="h-11 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {typeOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

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

            <div className="relative">
              <CalendarDays
                className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${
                  isArabic ? "right-3" : "left-3"
                }`}
              />
              <Input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className={`h-11 rounded-xl ${isArabic ? "pr-10" : "pl-10"}`}
                dir="ltr"
                aria-label={t.fromDate}
              />
            </div>

            <div className="relative">
              <CalendarDays
                className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${
                  isArabic ? "right-3" : "left-3"
                }`}
              />
              <Input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className={`h-11 rounded-xl ${isArabic ? "pr-10" : "pl-10"}`}
                dir="ltr"
                aria-label={t.toDate}
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[130px]">
                      <button
                        type="button"
                        onClick={() => toggleSort("transaction_date")}
                        className="inline-flex items-center gap-1 font-medium"
                      >
                        {t.table.date}
                        {sortKey === "transaction_date" &&
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
                        onClick={() => toggleSort("transaction_number")}
                        className="inline-flex items-center gap-1 font-medium"
                      >
                        {t.table.number}
                        {sortKey === "transaction_number" &&
                          (sortDirection === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5" />
                          ))}
                      </button>
                    </TableHead>

                    <TableHead className="min-w-[120px]">{t.table.type}</TableHead>
                    <TableHead className="min-w-[120px]">
                      {t.table.status}
                    </TableHead>
                    <TableHead className="min-w-[220px]">
                      {t.table.account}
                    </TableHead>
                    <TableHead className="min-w-[130px]">
                      {t.table.debit}
                    </TableHead>
                    <TableHead className="min-w-[130px]">
                      {t.table.credit}
                    </TableHead>
                    <TableHead className="min-w-[150px]">
                      {t.table.balance}
                    </TableHead>
                    <TableHead className="min-w-[150px]">
                      {t.table.reference}
                    </TableHead>
                    <TableHead className="min-w-[170px]">
                      {t.table.posting}
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
                      <TableRow key={`${item.id}-${item.transaction_number}`}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(item.transaction_date, locale)}
                        </TableCell>

                        <TableCell className="font-semibold" dir="ltr">
                          {item.transaction_number || "-"}
                        </TableCell>

                        <TableCell>
                          {typeBadge(item.transaction_type, locale)}
                        </TableCell>

                        <TableCell>{statusBadge(item.status, locale)}</TableCell>

                        <TableCell>
                          <div className="min-w-[200px]">
                            <p className="font-medium">
                              {item.account_name || "-"}
                            </p>
                            <p className="text-xs text-muted-foreground" dir="ltr">
                              {item.account_code || "-"}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell>
                          <MoneyText value={item.debit} />
                        </TableCell>

                        <TableCell>
                          <MoneyText value={item.credit} />
                        </TableCell>

                        <TableCell className="font-semibold">
                          <MoneyText value={item.running_balance} />
                        </TableCell>

                        <TableCell>
                          <span dir="ltr">{item.source_reference || "-"}</span>
                        </TableCell>

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
                              {item.is_accounting_posted ? t.posted : t.notPosted}
                            </Badge>
                          </div>
                        </TableCell>

                        {canViewDetails ? (
                          <TableCell>
                            {isValidId(item.id) ? (
                              <Link href={`/system/treasury/transactions/${item.id}`}>
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
                        colSpan={canViewDetails ? 11 : 10}
                        className="h-44 text-center"
                      >
                        <div className="flex flex-col items-center justify-center gap-2">
                          <FileText className="h-10 w-10 text-muted-foreground/40" />
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