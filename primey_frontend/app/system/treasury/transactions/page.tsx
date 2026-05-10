"use client";

/* ============================================================
   📂 app/system/treasury/transactions/page.tsx
   🧠 Primey Care | Treasury Transactions Page

   ✅ المسار:
      app/system/treasury/transactions/page.tsx

   ✅ العمل:
      صفحة الحركات المالية داخل الخزينة.
      تعرض سندات القبض وسندات الصرف والتحويلات والتسويات مع الحسابات والمبالغ والحالة.

   ✅ الإصدار:
      Phase 17 UX Refinement + Treasury Transactions Build

   ✅ يعتمد على:
      - /api/treasury/transactions/
      - /api/treasury/accounts/
      - primey-locale
      - AuthProvider
      - sonner
      - /currency/sar.svg

   ✅ متوافق مع:
      - Treasury overview page
      - Treasury accounts page
      - Treasury account statement page
      - Treasury transaction details/create pages
      - Centers / Customers approved UX standard

   ✅ الوظائف:
      - عرض جميع حركات الخزينة.
      - سندات القبض.
      - سندات الصرف.
      - التحويلات.
      - التسويات.
      - البحث في صف مستقل.
      - الفلاتر والأعمدة في صف مستقل.
      - فلترة حسب النوع والحالة والحساب.
      - التحكم بالأعمدة.
      - فرز الأعمدة المهمة.
      - صفحات محلية.
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
   تحسينات هذا الإصدار:
      - الملف المرفق كان غير مكتمل، وتم بناء الصفحة كاملة بنفس النمط التشغيلي المعتمد.
      - الالتزام بالقاعدة: w-full space-y-4 بدون main/min-h-screen/max-w.
      - عدم عرض أي مسارات أو عبارات تقنية داخل واجهة المستخدم.
      - إخفاء الأزرار غير المصرح بها بدل تعطيلها.
      - استخدام Excel HTML Workbook بدل CSV أو XLSX.
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUp,
  Banknote,
  Columns3,
  CreditCard,
  Download,
  Eye,
  Filter,
  Loader2,
  PlusCircle,
  Printer,
  Receipt,
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
  | "amount"
  | "account_name"
  | "created_at";

type SortDirection = "asc" | "desc";

type TreasuryAccountOption = {
  id: string;
  name: string;
  code: string;
};

type TreasuryTransactionRow = {
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
  source_reference: string;
  description: string;
  is_accounting_posted: boolean;
  is_treasury_posted: boolean;
  created_at: string;
};

type TransactionsSummary = {
  total_transactions: number;
  confirmed_transactions: number;
  draft_transactions: number;
  cancelled_transactions: number;
  receipts_count: number;
  payments_count: number;
  transfers_count: number;
  adjustments_count: number;
  receipts_total: number;
  payments_total: number;
  transfers_total: number;
  net_total: number;
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
  summary?: Partial<TransactionsSummary>;
};

type VisibleColumns = {
  date: boolean;
  number: boolean;
  type: boolean;
  status: boolean;
  account: boolean;
  amount: boolean;
  reference: boolean;
  posting: boolean;
  description: boolean;
  actions: boolean;
};

const SAR_ICON_PATH = "/currency/sar.svg";
const PAGE_SIZE = 14;

const DEFAULT_COLUMNS: VisibleColumns = {
  date: true,
  number: true,
  type: true,
  status: true,
  account: true,
  amount: true,
  reference: true,
  posting: true,
  description: true,
  actions: true,
};

const DEFAULT_SUMMARY: TransactionsSummary = {
  total_transactions: 0,
  confirmed_transactions: 0,
  draft_transactions: 0,
  cancelled_transactions: 0,
  receipts_count: 0,
  payments_count: 0,
  transfers_count: 0,
  adjustments_count: 0,
  receipts_total: 0,
  payments_total: 0,
  transfers_total: 0,
  net_total: 0,
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
    title: isArabic ? "الحركات المالية" : "Treasury Transactions",
    subtitle: isArabic
      ? "إدارة سندات القبض والصرف والتحويلات والتسويات داخل الخزينة."
      : "Manage receipts, payments, transfers, and adjustments inside treasury.",

    back: isArabic ? "الخزينة" : "Treasury",
    accounts: isArabic ? "حسابات الخزينة" : "Treasury Accounts",
    create: isArabic ? "إنشاء حركة" : "Create Transaction",
    createReceipt: isArabic ? "سند قبض" : "Receipt Voucher",
    createPayment: isArabic ? "سند صرف" : "Payment Voucher",
    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",

    summaryTitle: isArabic ? "ملخص الحركات" : "Transactions Summary",
    summaryDesc: isArabic
      ? "مؤشرات مختصرة عن سندات القبض والصرف والتحويلات."
      : "Short indicators for receipts, payments, and transfers.",

    tableTitle: isArabic ? "قائمة الحركات المالية" : "Transactions List",
    tableDesc: isArabic
      ? "كل الحركات المسجلة في الخزينة مع حالة التأكيد والترحيل."
      : "All treasury movements with confirmation and posting status.",

    totalTransactions: isArabic ? "إجمالي الحركات" : "Total Transactions",
    confirmedTransactions: isArabic ? "حركات مؤكدة" : "Confirmed Transactions",
    draftTransactions: isArabic ? "مسودات" : "Drafts",
    cancelledTransactions: isArabic ? "ملغاة" : "Cancelled",
    receiptsCount: isArabic ? "عدد سندات القبض" : "Receipts Count",
    paymentsCount: isArabic ? "عدد سندات الصرف" : "Payments Count",
    transfersCount: isArabic ? "عدد التحويلات" : "Transfers Count",
    adjustmentsCount: isArabic ? "عدد التسويات" : "Adjustments Count",
    receiptsTotal: isArabic ? "إجمالي القبض" : "Total Receipts",
    paymentsTotal: isArabic ? "إجمالي الصرف" : "Total Payments",
    transfersTotal: isArabic ? "إجمالي التحويلات" : "Total Transfers",
    netTotal: isArabic ? "صافي الحركة" : "Net Movement",

    searchPlaceholder: isArabic
      ? "ابحث برقم الحركة أو الحساب أو المرجع أو الوصف..."
      : "Search by transaction number, account, reference, or description...",

    filters: isArabic ? "الفلاتر" : "Filters",
    columns: isArabic ? "الأعمدة" : "Columns",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",

    allTypes: isArabic ? "كل الأنواع" : "All Types",
    allStatuses: isArabic ? "كل الحالات" : "All Statuses",
    allAccounts: isArabic ? "كل الحسابات" : "All Accounts",

    receipt: isArabic ? "قبض" : "Receipt",
    payment: isArabic ? "صرف" : "Payment",
    transfer: isArabic ? "تحويل" : "Transfer",
    adjustment: isArabic ? "تسوية" : "Adjustment",
    unknown: isArabic ? "غير محدد" : "Unknown",

    draft: isArabic ? "مسودة" : "Draft",
    confirmed: isArabic ? "مؤكدة" : "Confirmed",
    cancelled: isArabic ? "ملغاة" : "Cancelled",

    posted: isArabic ? "مرحّل" : "Posted",
    notPosted: isArabic ? "غير مرحّل" : "Not Posted",
    accounting: isArabic ? "محاسبي" : "Accounting",
    treasury: isArabic ? "خزينة" : "Treasury",

    table: {
      date: isArabic ? "التاريخ" : "Date",
      number: isArabic ? "رقم الحركة" : "Transaction No.",
      type: isArabic ? "النوع" : "Type",
      status: isArabic ? "الحالة" : "Status",
      account: isArabic ? "الحساب" : "Account",
      amount: isArabic ? "المبلغ" : "Amount",
      reference: isArabic ? "المرجع" : "Reference",
      posting: isArabic ? "الترحيل" : "Posting",
      description: isArabic ? "الوصف" : "Description",
      action: isArabic ? "الإجراء" : "Action",
    },

    view: isArabic ? "عرض" : "View",

    emptyTitle: isArabic ? "لا توجد حركات مالية" : "No transactions",
    emptyText: isArabic
      ? "ستظهر سندات القبض والصرف والتحويلات هنا بعد تسجيلها."
      : "Receipts, payments, and transfers will appear here after they are recorded.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير البحث أو الفلاتر."
      : "Try changing the search or filters.",

    accessDeniedTitle: isArabic
      ? "غير مصرح بعرض الحركات المالية"
      : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض حركات الخزينة. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view treasury transactions. Contact your system administrator if you need access.",

    loadError: isArabic
      ? "تعذر تحميل الحركات المالية."
      : "Unable to load treasury transactions.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    loadSuccess: isArabic
      ? "تم تحديث الحركات المالية بنجاح."
      : "Treasury transactions refreshed successfully.",

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
    "account",
    "treasury_account",
    "cashbox",
    "bank",
    "from_account",
    "to_account",
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

function extractSummary(payload: ApiEnvelope<unknown> | null) {
  if (!payload) return {};

  const data = asDict(payload.data);

  return {
    ...asDict(payload.summary),
    ...asDict(data.summary),
    ...asDict(data.totals),
    ...asDict(data),
  } as Partial<TransactionsSummary>;
}

function normalizeTransactionType(value: unknown): TransactionType {
  const clean = String(value || "").toUpperCase();

  if (["RECEIPT", "INCOME", "RECEIVE", "CASH_IN"].includes(clean)) return "RECEIPT";
  if (["PAYMENT", "EXPENSE", "PAY", "CASH_OUT"].includes(clean)) return "PAYMENT";
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
  };
}

function normalizeTransaction(item: unknown, index: number): TreasuryTransactionRow {
  const obj = asDict(item);
  const accountObj = asDict(obj.account || obj.treasury_account);

  const accountId = String(
    getNestedValue(obj, [
      "account_id",
      "treasury_account_id",
      "cashbox_id",
      "bank_id",
    ]) ||
      accountObj.id ||
      accountObj.uuid ||
      "",
  );

  const accountName = String(
    accountObj.name ||
      accountObj.title ||
      getNestedValue(obj, [
        "account_name",
        "treasury_account_name",
        "cashbox_name",
        "bank_name",
      ]) ||
      "",
  );

  const accountCode = String(
    accountObj.code ||
      accountObj.account_code ||
      getNestedValue(obj, ["account_code", "treasury_account_code"]) ||
      "",
  );

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
    transaction_type: normalizeTransactionType(
      getNestedValue(obj, ["transaction_type", "type", "kind", "voucher_type"]),
    ),
    status: normalizeStatus(getNestedValue(obj, ["status", "state", "is_confirmed"])),
    amount: toNumber(getNestedValue(obj, ["amount", "total_amount", "value"])),
    currency: String(getNestedValue(obj, ["currency"]) || "SAR"),
    transaction_date: String(
      getNestedValue(obj, ["transaction_date", "date", "created_at"]) || "",
    ),
    account_id: accountId,
    account_name: accountName,
    account_code: accountCode,
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
    is_accounting_posted: Boolean(
      getNestedValue(obj, ["is_accounting_posted", "accounting_posted"]),
    ),
    is_treasury_posted: Boolean(
      getNestedValue(obj, ["is_treasury_posted", "treasury_posted"]),
    ),
    created_at: String(getNestedValue(obj, ["created_at", "created"]) || ""),
  };
}

function buildSummary(
  rows: TreasuryTransactionRow[],
  apiSummary?: Partial<TransactionsSummary>,
): TransactionsSummary {
  const receipts = rows.filter((item) => item.transaction_type === "RECEIPT");
  const payments = rows.filter((item) => item.transaction_type === "PAYMENT");
  const transfers = rows.filter((item) => item.transaction_type === "TRANSFER");
  const adjustments = rows.filter(
    (item) => item.transaction_type === "ADJUSTMENT",
  );

  const receiptsTotal = receipts.reduce((sum, item) => sum + item.amount, 0);
  const paymentsTotal = payments.reduce((sum, item) => sum + item.amount, 0);
  const transfersTotal = transfers.reduce((sum, item) => sum + item.amount, 0);

  const fallback: TransactionsSummary = {
    total_transactions: rows.length,
    confirmed_transactions: rows.filter((item) => item.status === "CONFIRMED").length,
    draft_transactions: rows.filter((item) => item.status === "DRAFT").length,
    cancelled_transactions: rows.filter((item) => item.status === "CANCELLED").length,
    receipts_count: receipts.length,
    payments_count: payments.length,
    transfers_count: transfers.length,
    adjustments_count: adjustments.length,
    receipts_total: receiptsTotal,
    payments_total: paymentsTotal,
    transfers_total: transfersTotal,
    net_total: receiptsTotal - paymentsTotal,
  };

  return {
    total_transactions:
      toNumber(apiSummary?.total_transactions) || fallback.total_transactions,
    confirmed_transactions:
      toNumber(apiSummary?.confirmed_transactions) ||
      fallback.confirmed_transactions,
    draft_transactions:
      toNumber(apiSummary?.draft_transactions) || fallback.draft_transactions,
    cancelled_transactions:
      toNumber(apiSummary?.cancelled_transactions) ||
      fallback.cancelled_transactions,
    receipts_count:
      toNumber(apiSummary?.receipts_count) || fallback.receipts_count,
    payments_count:
      toNumber(apiSummary?.payments_count) || fallback.payments_count,
    transfers_count:
      toNumber(apiSummary?.transfers_count) || fallback.transfers_count,
    adjustments_count:
      toNumber(apiSummary?.adjustments_count) || fallback.adjustments_count,
    receipts_total:
      toNumber(apiSummary?.receipts_total) ||
      toNumber((apiSummary as Dict)?.receipt_total) ||
      fallback.receipts_total,
    payments_total:
      toNumber(apiSummary?.payments_total) ||
      toNumber((apiSummary as Dict)?.payment_total) ||
      fallback.payments_total,
    transfers_total:
      toNumber(apiSummary?.transfers_total) ||
      toNumber((apiSummary as Dict)?.transfer_total) ||
      fallback.transfers_total,
    net_total: toNumber(apiSummary?.net_total) || fallback.net_total,
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

function sortValue(row: TreasuryTransactionRow, key: SortKey): string | number {
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

/* ============================================================
   Skeleton
============================================================ */

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
  summary: TransactionsSummary;
  rows: TreasuryTransactionRow[];
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
          <td>${escapeHtml(formatMoney(item.amount))}</td>
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
          <tr><td class="title" colspan="11">${escapeHtml(title)}</td></tr>
          <tr><td colspan="11"></td></tr>
          <tr><td class="section" colspan="11">${escapeHtml(t.summaryTitle)}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.generatedAt)}</td><td class="summary-value" colspan="10">${escapeHtml(new Date().toLocaleString("en-US"))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalTransactions)}</td><td class="summary-value" colspan="10">${escapeHtml(formatNumber(summary.total_transactions))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.confirmedTransactions)}</td><td class="summary-value" colspan="10">${escapeHtml(formatNumber(summary.confirmed_transactions))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.receiptsTotal)}</td><td class="summary-value" colspan="10">${escapeHtml(formatMoney(summary.receipts_total))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.paymentsTotal)}</td><td class="summary-value" colspan="10">${escapeHtml(formatMoney(summary.payments_total))}</td></tr>

          <tr><td colspan="11"></td></tr>
          <tr>
            <th>${escapeHtml(t.table.date)}</th>
            <th>${escapeHtml(t.table.number)}</th>
            <th>${escapeHtml(t.table.type)}</th>
            <th>${escapeHtml(t.table.status)}</th>
            <th>${escapeHtml(t.table.account)}</th>
            <th>${escapeHtml(isArabic ? "كود الحساب" : "Account Code")}</th>
            <th>${escapeHtml(t.table.amount)}</th>
            <th>${escapeHtml(t.table.reference)}</th>
            <th>${escapeHtml(t.treasury)}</th>
            <th>${escapeHtml(t.accounting)}</th>
            <th>${escapeHtml(t.table.description)}</th>
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
  summary: TransactionsSummary;
  rows: TreasuryTransactionRow[];
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
          <td>${escapeHtml(statusLabel(item.status, locale))}</td>
          <td>${escapeHtml(item.account_name || "-")}</td>
          <td>${escapeHtml(formatMoney(item.amount))}</td>
          <td>${escapeHtml(item.source_reference || "-")}</td>
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
          <div class="summary-card"><span>${escapeHtml(t.totalTransactions)}</span><strong>${formatNumber(summary.total_transactions)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.confirmedTransactions)}</span><strong>${formatNumber(summary.confirmed_transactions)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.receiptsTotal)}</span><strong>${formatMoney(summary.receipts_total)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.paymentsTotal)}</span><strong>${formatMoney(summary.payments_total)}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${escapeHtml(t.table.date)}</th>
              <th>${escapeHtml(t.table.number)}</th>
              <th>${escapeHtml(t.table.type)}</th>
              <th>${escapeHtml(t.table.status)}</th>
              <th>${escapeHtml(t.table.account)}</th>
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

export default function TreasuryTransactionsPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [rows, setRows] = useState<TreasuryTransactionRow[]>([]);
  const [accounts, setAccounts] = useState<TreasuryAccountOption[]>([]);
  const [summary, setSummary] = useState<TransactionsSummary>(DEFAULT_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [accountFilter, setAccountFilter] = useState<AccountFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("transaction_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [visibleColumns, setVisibleColumns] =
    useState<VisibleColumns>(DEFAULT_COLUMNS);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canView = hasSafePermission(
    auth,
    ["treasury.view", "treasury.transactions.view"],
    "view",
  );

  const canCreate = hasSafePermission(
    auth,
    ["treasury.create", "treasury.transactions.create", "treasury.manage"],
    "action",
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

  const filteredRows = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    const filtered = rows.filter((item) => {
      const matchesType =
        typeFilter === "ALL" ? true : item.transaction_type === typeFilter;

      const matchesStatus =
        statusFilter === "ALL" ? true : item.status === statusFilter;

      const matchesAccount =
        accountFilter === "ALL"
          ? true
          : item.account_id === accountFilter || item.account_code === accountFilter;

      const matchesQuery = !cleanQuery
        ? true
        : [
            item.transaction_number,
            item.account_name,
            item.account_code,
            item.source_reference,
            item.description,
            transactionTypeLabel(item.transaction_type, locale),
            statusLabel(item.status, locale),
          ]
            .join(" ")
            .toLowerCase()
            .includes(cleanQuery);

      return matchesType && matchesStatus && matchesAccount && matchesQuery;
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
  }, [
    accountFilter,
    locale,
    query,
    rows,
    sortDirection,
    sortKey,
    statusFilter,
    typeFilter,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  const paginatedRows = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * PAGE_SIZE;

    return filteredRows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredRows, page, totalPages]);

  const hasSearchOrFilter =
    query.trim().length > 0 ||
    typeFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    accountFilter !== "ALL";

  const visibleColumnCount = Object.entries(visibleColumns).filter(
    ([key, value]) => value && (key !== "actions" || canViewDetails),
  ).length;

  const typeOptions = useMemo(
    () => [
      { value: "ALL" as TypeFilter, label: t.allTypes, count: rows.length },
      {
        value: "RECEIPT" as TypeFilter,
        label: t.receipt,
        count: rows.filter((item) => item.transaction_type === "RECEIPT").length,
      },
      {
        value: "PAYMENT" as TypeFilter,
        label: t.payment,
        count: rows.filter((item) => item.transaction_type === "PAYMENT").length,
      },
      {
        value: "TRANSFER" as TypeFilter,
        label: t.transfer,
        count: rows.filter((item) => item.transaction_type === "TRANSFER").length,
      },
      {
        value: "ADJUSTMENT" as TypeFilter,
        label: t.adjustment,
        count: rows.filter((item) => item.transaction_type === "ADJUSTMENT").length,
      },
    ],
    [rows, t],
  );

  const statusOptions = useMemo(
    () => [
      { value: "ALL" as StatusFilter, label: t.allStatuses, count: rows.length },
      {
        value: "DRAFT" as StatusFilter,
        label: t.draft,
        count: rows.filter((item) => item.status === "DRAFT").length,
      },
      {
        value: "CONFIRMED" as StatusFilter,
        label: t.confirmed,
        count: rows.filter((item) => item.status === "CONFIRMED").length,
      },
      {
        value: "CANCELLED" as StatusFilter,
        label: t.cancelled,
        count: rows.filter((item) => item.status === "CANCELLED").length,
      },
    ],
    [rows, t],
  );

  const accountOptions = useMemo(() => {
    const fromRows = rows
      .filter((item) => item.account_id || item.account_code || item.account_name)
      .map((item) => ({
        id: item.account_id || item.account_code || item.account_name,
        name: item.account_name || item.account_code || "-",
        code: item.account_code || "",
      }));

    const merged = [...accounts, ...fromRows];

    return Array.from(
      new Map(
        merged
          .filter((item) => item.id || item.name)
          .map((item) => [item.id || item.name, item]),
      ).values(),
    );
  }, [accounts, rows]);

  const columnOptions: Array<{ key: keyof VisibleColumns; label: string }> = [
    { key: "date", label: t.table.date },
    { key: "number", label: t.table.number },
    { key: "type", label: t.table.type },
    { key: "status", label: t.table.status },
    { key: "account", label: t.table.account },
    { key: "amount", label: t.table.amount },
    { key: "reference", label: t.table.reference },
    { key: "posting", label: t.table.posting },
    { key: "description", label: t.table.description },
    { key: "actions", label: t.table.action },
  ];

  const loadTransactions = useCallback(
    async (showToast = false) => {
      if (!canView) {
        setRows([]);
        setAccounts([]);
        setSummary(DEFAULT_SUMMARY);
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
          .map(normalizeTransaction)
          .filter((item) => item.id || item.transaction_number);

        const normalizedAccounts = extractRows(accountsPayload, "accounts")
          .map(normalizeAccount)
          .filter((item) => item.id || item.name);

        setRows(normalizedRows);
        setAccounts(normalizedAccounts);
        setSummary(buildSummary(normalizedRows, extractSummary(transactionsPayload)));
        setPage(1);

        if (showToast) toast.success(t.loadSuccess);
      } catch (error) {
        console.error("Treasury transactions load error:", error);
        setRows([]);
        setAccounts([]);
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
    setTypeFilter("ALL");
    setStatusFilter("ALL");
    setAccountFilter("ALL");
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
      filename: `primey-care-treasury-transactions-${new Date()
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "الحركات المالية" : "Transactions",
      title: t.title,
      locale,
      summary,
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
        summary,
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
    loadTransactions(false);
  }, [authResolving, loadTransactions]);

  useEffect(() => {
    setPage(1);
  }, [query, typeFilter, statusFilter, accountFilter]);

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

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadTransactions(true)}
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
            <Link href="/system/treasury/transactions/create">
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
                <p className="font-semibold text-destructive">
                  {errorMessage}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.loadErrorHint}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => loadTransactions(true)}
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
                    {formatNumber(summary.total_transactions)}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.totalTransactions}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                  <CreditCard className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-2xl font-bold">
                    {formatNumber(summary.confirmed_transactions)}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.confirmedTransactions}
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
                    <MoneyText value={summary.receipts_total} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.receiptsTotal}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                  <Receipt className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-2xl font-bold">
                    <MoneyText value={summary.payments_total} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.paymentsTotal}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                  <Banknote className="h-5 w-5" />
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
              <span className="text-muted-foreground">{t.receiptsCount}</span>
              <span className="font-semibold">{formatNumber(summary.receipts_count)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{t.paymentsCount}</span>
              <span className="font-semibold">{formatNumber(summary.payments_count)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{t.transfersCount}</span>
              <span className="font-semibold">{formatNumber(summary.transfers_count)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{t.netTotal}</span>
              <span className="font-semibold">
                <MoneyText value={summary.net_total} />
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
                onClick={() => loadTransactions(true)}
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

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 rounded-xl">
                    <Filter className="h-4 w-4" />
                    {t.filters}
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align={isArabic ? "start" : "end"}
                  className="w-80 rounded-2xl"
                >
                  <div dir={isArabic ? "rtl" : "ltr"}>
                    <DropdownMenuLabel>{t.allTypes}</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {typeOptions.map((item) => (
                      <DropdownMenuCheckboxItem
                        key={item.value}
                        checked={typeFilter === item.value}
                        onCheckedChange={() => setTypeFilter(item.value)}
                      >
                        {item.label} ({formatNumber(item.count)})
                      </DropdownMenuCheckboxItem>
                    ))}

                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>{t.allStatuses}</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {statusOptions.map((item) => (
                      <DropdownMenuCheckboxItem
                        key={item.value}
                        checked={statusFilter === item.value}
                        onCheckedChange={() => setStatusFilter(item.value)}
                      >
                        {item.label} ({formatNumber(item.count)})
                      </DropdownMenuCheckboxItem>
                    ))}

                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>{t.allAccounts}</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    <DropdownMenuCheckboxItem
                      checked={accountFilter === "ALL"}
                      onCheckedChange={() => setAccountFilter("ALL")}
                    >
                      {t.allAccounts} ({formatNumber(rows.length)})
                    </DropdownMenuCheckboxItem>

                    {accountOptions.slice(0, 30).map((item) => (
                      <DropdownMenuCheckboxItem
                        key={item.id || item.name}
                        checked={accountFilter === (item.id || item.code)}
                        onCheckedChange={() => setAccountFilter(item.id || item.code)}
                      >
                        {item.name} {item.code ? `(${item.code})` : ""}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 rounded-xl">
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
          </div>

          <div className="overflow-hidden rounded-xl border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {visibleColumns.date ? (
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
                    ) : null}

                    {visibleColumns.number ? (
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
                    ) : null}

                    {visibleColumns.type ? (
                      <TableHead className="min-w-[120px]">{t.table.type}</TableHead>
                    ) : null}

                    {visibleColumns.status ? (
                      <TableHead className="min-w-[120px]">{t.table.status}</TableHead>
                    ) : null}

                    {visibleColumns.account ? (
                      <TableHead className="min-w-[220px]">
                        <button
                          type="button"
                          onClick={() => toggleSort("account_name")}
                          className="inline-flex items-center gap-1 font-medium"
                        >
                          {t.table.account}
                          {sortKey === "account_name" &&
                            (sortDirection === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5" />
                            ))}
                        </button>
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
                      <TableHead className="min-w-[150px]">
                        {t.table.reference}
                      </TableHead>
                    ) : null}

                    {visibleColumns.posting ? (
                      <TableHead className="min-w-[170px]">
                        {t.table.posting}
                      </TableHead>
                    ) : null}

                    {visibleColumns.description ? (
                      <TableHead className="min-w-[220px]">
                        {t.table.description}
                      </TableHead>
                    ) : null}

                    {visibleColumns.actions && canViewDetails ? (
                      <TableHead className="min-w-[100px]">
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
                      <TableRow key={`${item.id}-${item.transaction_number}`}>
                        {visibleColumns.date ? (
                          <TableCell className="whitespace-nowrap">
                            {formatDate(item.transaction_date, locale)}
                          </TableCell>
                        ) : null}

                        {visibleColumns.number ? (
                          <TableCell className="font-semibold" dir="ltr">
                            {item.transaction_number || "-"}
                          </TableCell>
                        ) : null}

                        {visibleColumns.type ? (
                          <TableCell>
                            {transactionTypeBadge(item.transaction_type, locale)}
                          </TableCell>
                        ) : null}

                        {visibleColumns.status ? (
                          <TableCell>{statusBadge(item.status, locale)}</TableCell>
                        ) : null}

                        {visibleColumns.account ? (
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
                        ) : null}

                        {visibleColumns.amount ? (
                          <TableCell>
                            <MoneyText value={item.amount} />
                          </TableCell>
                        ) : null}

                        {visibleColumns.reference ? (
                          <TableCell>
                            <span dir="ltr">{item.source_reference || "-"}</span>
                          </TableCell>
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
                                {item.is_accounting_posted ? t.posted : t.notPosted}
                              </Badge>
                            </div>
                          </TableCell>
                        ) : null}

                        {visibleColumns.description ? (
                          <TableCell>
                            <span className="line-clamp-2 min-w-[200px] text-sm text-muted-foreground">
                              {item.description || "-"}
                            </span>
                          </TableCell>
                        ) : null}

                        {visibleColumns.actions && canViewDetails ? (
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
                            <Link href="/system/treasury/transactions/create">
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