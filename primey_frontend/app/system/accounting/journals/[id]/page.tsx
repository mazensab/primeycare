"use client";

/* ============================================================
   📂 app/system/accounting/journals/[id]/page.tsx
   🧠 Primey Care | Journal Entry Detail

   ✅ المسار:
      app/system/accounting/journals/[id]/page.tsx

   ✅ العمل:
      صفحة تفاصيل قيد اليومية داخل مديول المحاسبة.
      تعرض بيانات القيد، حالة الترحيل، مصدر القيد، المدين والدائن، وسطور القيد.

   ✅ الإصدار:
      Phase 17 UX Refinement + Accounting Journal Detail Fix

   ✅ يعتمد على:
      - /api/accounting/journals/{id}/
      - /api/accounting/journal-entries/{id}/ كـ fallback آمن
      - primey-locale
      - AuthProvider
      - sonner
      - /currency/sar.svg

   ✅ متوافق مع:
      - Accounting module approved pattern
      - Accounting journals list page
      - Centers approved UX pattern
      - Customers approved UX pattern

   ✅ الوظائف:
      - عرض تفاصيل قيد اليومية.
      - عرض ملخص المدين والدائن وفرق التوازن.
      - عرض بيانات القيد الأساسية.
      - عرض سطور القيد.
      - دعم مراكز التكلفة في السطور.
      - البحث داخل سطور القيد.
      - التحكم بالأعمدة المرئية.
      - Excel export بصيغة .xls HTML Workbook.
      - Web PDF Print.
      - Skeleton Loading.
      - Error State مستقل.
      - Not Found State مستقل.
      - إخفاء الإجراءات حسب الصلاحيات قدر الإمكان.

   ------------------------------------------------------------
   تحسينات هذا الإصدار:
      - إصلاح تكرار مفتاح notBalanced داخل القاموس.
      - الحفاظ على نمط النظام: w-full space-y-4 بدون main/min-h-screen.
      - تحسين fallback للتحميل عند 400 / 404 / 405.
      - دعم مصادر الترحيل الجديدة: خزينة، عمولة، رصيد افتتاحي، نظام.
      - دعم مراكز التكلفة داخل جدول السطور.
      - استخدام الرقم ثم رمز SAR عند عرض القيم المالية.
      - منع عرض أي عبارات تقنية أو مسارات داخل واجهة المستخدم.
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  ArrowLeft,
  Calculator,
  CheckCircle2,
  ColumnsIcon,
  Download,
  FileText,
  Layers3,
  Loader2,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
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

type JournalStatus =
  | "DRAFT"
  | "POSTED"
  | "CANCELLED"
  | "REVERSED"
  | "UNKNOWN";

type PostingSource =
  | "MANUAL"
  | "ORDER"
  | "PAYMENT"
  | "INVOICE"
  | "REFUND"
  | "ADJUSTMENT"
  | "TREASURY"
  | "COMMISSION"
  | "OPENING"
  | "SYSTEM"
  | "OTHER"
  | "UNKNOWN";

type SortKey =
  | "sort_order"
  | "account_code"
  | "account_name"
  | "account_type"
  | "description"
  | "debit_amount"
  | "credit_amount";

type SortDirection = "asc" | "desc";

type JournalLine = {
  id: string;
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  normal_balance: string;
  cost_center_id: string;
  cost_center_code: string;
  cost_center_name: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  sort_order: number;
};

type JournalDetail = {
  id: string;
  entry_number: string;
  entry_date: string;
  status: JournalStatus;
  posting_source: PostingSource;
  reference: string;
  external_reference: string;
  description: string;
  notes: string;
  currency: string;
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
  posted_at: string;
  created_at: string;
  updated_at: string;
  lines: JournalLine[];
};

type ApiEnvelope<T> = {
  ok?: boolean;
  success?: boolean;
  message?: string;
  detail?: string;
  error?: string;
  data?: T;
};

type VisibleColumns = {
  sortOrder: boolean;
  accountCode: boolean;
  accountName: boolean;
  accountType: boolean;
  normalBalance: boolean;
  costCenter: boolean;
  description: boolean;
  debitAmount: boolean;
  creditAmount: boolean;
};

const SAR_ICON_PATH = "/currency/sar.svg";

const DEFAULT_COLUMNS: VisibleColumns = {
  sortOrder: true,
  accountCode: true,
  accountName: true,
  accountType: true,
  normalBalance: false,
  costCenter: true,
  description: true,
  debitAmount: true,
  creditAmount: true,
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
    title: isArabic ? "تفاصيل قيد اليومية" : "Journal Entry Details",
    subtitle: isArabic
      ? "مراجعة بيانات القيد وسطور الحسابات ومراكز التكلفة والتوازن بين المدين والدائن."
      : "Review entry details, account lines, cost centers, and debit-credit balance.",

    back: isArabic ? "القيود اليومية" : "Journal Entries",
    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    columns: isArabic ? "الأعمدة" : "Columns",
    clearSearch: isArabic ? "مسح البحث" : "Clear Search",

    entryInfo: isArabic ? "بيانات القيد" : "Entry Information",
    entryInfoDesc: isArabic
      ? "المعلومات الأساسية للقيد ومصدر الترحيل."
      : "Basic information and posting source.",
    financialSummary: isArabic ? "ملخص مالي" : "Financial Summary",
    financialSummaryDesc: isArabic
      ? "إجمالي المدين والدائن وفرق التوازن."
      : "Total debit, total credit, and balance difference.",
    linesTitle: isArabic ? "سطور القيد" : "Journal Lines",
    linesDesc: isArabic
      ? "تفاصيل الحسابات ومراكز التكلفة والمبالغ."
      : "Account, cost center, and amount details.",

    entryNumber: isArabic ? "رقم القيد" : "Entry Number",
    entryDate: isArabic ? "تاريخ القيد" : "Entry Date",
    status: isArabic ? "الحالة" : "Status",
    postingSource: isArabic ? "مصدر الترحيل" : "Posting Source",
    reference: isArabic ? "المرجع" : "Reference",
    externalReference: isArabic ? "مرجع خارجي" : "External Reference",
    description: isArabic ? "الوصف" : "Description",
    notes: isArabic ? "ملاحظات" : "Notes",
    postedAt: isArabic ? "تاريخ الترحيل" : "Posted At",
    createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
    updatedAt: isArabic ? "آخر تحديث" : "Updated At",

    totalDebit: isArabic ? "إجمالي المدين" : "Total Debit",
    totalCredit: isArabic ? "إجمالي الدائن" : "Total Credit",
    difference: isArabic ? "فرق التوازن" : "Difference",
    linesCount: isArabic ? "عدد السطور" : "Lines Count",
    balanced: isArabic ? "متوازن" : "Balanced",
    notBalanced: isArabic ? "غير متوازن" : "Not Balanced",

    draft: isArabic ? "مسودة" : "Draft",
    posted: isArabic ? "مرحّل" : "Posted",
    cancelled: isArabic ? "ملغي" : "Cancelled",
    reversed: isArabic ? "معكوس" : "Reversed",
    unknown: isArabic ? "غير محدد" : "Unknown",

    manual: isArabic ? "يدوي" : "Manual",
    order: isArabic ? "طلب" : "Order",
    payment: isArabic ? "دفعة" : "Payment",
    invoice: isArabic ? "فاتورة" : "Invoice",
    refund: isArabic ? "استرداد" : "Refund",
    adjustment: isArabic ? "تسوية" : "Adjustment",
    treasury: isArabic ? "خزينة" : "Treasury",
    commission: isArabic ? "عمولة" : "Commission",
    opening: isArabic ? "رصيد افتتاحي" : "Opening Balance",
    system: isArabic ? "النظام" : "System",
    other: isArabic ? "أخرى" : "Other",

    searchPlaceholder: isArabic
      ? "ابحث في الحساب أو الوصف أو مركز التكلفة..."
      : "Search account, description, or cost center...",

    table: {
      sortOrder: isArabic ? "الترتيب" : "Order",
      accountCode: isArabic ? "رمز الحساب" : "Account Code",
      accountName: isArabic ? "اسم الحساب" : "Account Name",
      accountType: isArabic ? "نوع الحساب" : "Account Type",
      normalBalance: isArabic ? "الطبيعة" : "Normal Balance",
      costCenter: isArabic ? "مركز التكلفة" : "Cost Center",
      description: isArabic ? "الوصف" : "Description",
      debit: isArabic ? "مدين" : "Debit",
      credit: isArabic ? "دائن" : "Credit",
    },

    emptyTitle: isArabic ? "لا توجد سطور للقيد" : "No journal lines",
    emptyText: isArabic
      ? "لا توجد سطور محاسبية مرتبطة بهذا القيد."
      : "There are no accounting lines linked to this entry.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير كلمات البحث داخل سطور القيد."
      : "Try changing the search keywords inside entry lines.",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض القيد" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض تفاصيل القيود اليومية. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view journal entry details. Contact your system administrator if you need access.",

    notFoundTitle: isArabic ? "القيد غير موجود" : "Entry not found",
    notFoundText: isArabic
      ? "لم يتم العثور على قيد اليومية المطلوب."
      : "The requested journal entry could not be found.",

    apiError: isArabic
      ? "تعذر تحميل تفاصيل القيد."
      : "Unable to load journal entry details.",
    apiErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    refreshSuccess: isArabic
      ? "تم تحديث تفاصيل القيد بنجاح."
      : "Journal entry details refreshed successfully.",
    exportSuccess: isArabic
      ? "تم تجهيز ملف Excel بنجاح."
      : "Excel file prepared successfully.",
    exportEmpty: isArabic
      ? "لا توجد سطور قابلة للتصدير."
      : "No lines available to export.",
    printSuccess: isArabic
      ? "تم تجهيز نافذة الطباعة."
      : "Print window prepared.",
    printError: isArabic
      ? "تعذر فتح نافذة الطباعة."
      : "Unable to open print window.",

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

function formatDateTime(value: string, locale: AppLocale): string {
  if (!value) return locale === "ar" ? "غير محدد" : "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
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

function getValue(obj: Dict, key: string): unknown {
  const direct = obj[key];

  if (direct !== undefined && direct !== null && direct !== "") {
    return direct;
  }

  for (const container of [
    "entry",
    "journal",
    "journal_entry",
    "account",
    "chart_account",
    "cost_center",
    "costCenter",
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

function normalizeStatus(value: unknown): JournalStatus {
  const status = String(value || "").toUpperCase();

  if (status === "DRAFT") return "DRAFT";
  if (status === "POSTED" || status === "CONFIRMED") return "POSTED";
  if (status === "CANCELLED" || status === "CANCELED") return "CANCELLED";
  if (status === "REVERSED") return "REVERSED";

  return "UNKNOWN";
}

function normalizePostingSource(value: unknown): PostingSource {
  const source = String(value || "").toUpperCase();

  if (source.includes("COMMISSION")) return "COMMISSION";
  if (source.includes("PAYMENT")) return "PAYMENT";
  if (source.includes("INVOICE")) return "INVOICE";
  if (source.includes("ORDER")) return "ORDER";
  if (source.includes("TREASURY")) return "TREASURY";
  if (source.includes("OPENING")) return "OPENING";
  if (source.includes("ADJUSTMENT") || source.includes("SETTLEMENT")) {
    return "ADJUSTMENT";
  }
  if (source.includes("REFUND")) return "REFUND";
  if (source.includes("SYSTEM") || source.includes("AUTO")) return "SYSTEM";
  if (source.includes("MANUAL") || source.includes("USER")) return "MANUAL";
  if (source.includes("OTHER")) return "OTHER";

  return "UNKNOWN";
}

function toBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;

  if (value === undefined || value === null || value === "") return fallback;

  const clean = String(value).toLowerCase();

  if (["true", "1", "yes", "balanced"].includes(clean)) return true;
  if (["false", "0", "no", "unbalanced"].includes(clean)) return false;

  return fallback;
}

function normalizeLine(item: unknown, index: number): JournalLine {
  const obj = asDict(item);
  const account = asDict(obj.account || obj.chart_account);
  const costCenter = asDict(obj.cost_center || obj.costCenter);

  return {
    id: String(getValue(obj, "id") || `${index}`),
    account_id: String(account.id || getValue(obj, "account_id") || ""),
    account_code: String(account.code || getValue(obj, "account_code") || ""),
    account_name: String(account.name || getValue(obj, "account_name") || ""),
    account_type: String(
      account.type || account.account_type || getValue(obj, "account_type") || "",
    ),
    normal_balance: String(
      account.normal_balance || getValue(obj, "normal_balance") || "",
    ),
    cost_center_id: String(costCenter.id || getValue(obj, "cost_center_id") || ""),
    cost_center_code: String(
      costCenter.code || getValue(obj, "cost_center_code") || "",
    ),
    cost_center_name: String(
      costCenter.name || getValue(obj, "cost_center_name") || "",
    ),
    description: String(
      getValue(obj, "description") ||
        getValue(obj, "memo") ||
        getValue(obj, "notes") ||
        "",
    ),
    debit_amount: toNumber(
      getValue(obj, "debit_amount") || getValue(obj, "debit") || 0,
    ),
    credit_amount: toNumber(
      getValue(obj, "credit_amount") || getValue(obj, "credit") || 0,
    ),
    sort_order: toNumber(getValue(obj, "sort_order") ?? index + 1),
  };
}

function normalizeJournalDetail(payload: unknown): JournalDetail | null {
  const envelope = asDict(payload);
  const source =
    envelope.data && typeof envelope.data === "object"
      ? asDict(envelope.data)
      : envelope;

  if (!source || Object.keys(source).length === 0) return null;

  const linesSource =
    source.lines ||
    source.items ||
    source.entries ||
    source.details ||
    asDict(source.data).lines ||
    [];

  const lines = Array.isArray(linesSource)
    ? linesSource.map((line, index) => normalizeLine(line, index))
    : [];

  const totalDebit =
    getValue(source, "total_debit") ||
    lines.reduce((sum, line) => sum + line.debit_amount, 0);

  const totalCredit =
    getValue(source, "total_credit") ||
    lines.reduce((sum, line) => sum + line.credit_amount, 0);

  const debitNumber = toNumber(totalDebit);
  const creditNumber = toNumber(totalCredit);

  return {
    id: String(getValue(source, "id") || ""),
    entry_number: String(
      getValue(source, "entry_number") ||
        getValue(source, "journal_number") ||
        getValue(source, "number") ||
        "-",
    ),
    entry_date: String(
      getValue(source, "entry_date") ||
        getValue(source, "journal_date") ||
        getValue(source, "date") ||
        "",
    ),
    status: normalizeStatus(getValue(source, "status")),
    posting_source: normalizePostingSource(
      getValue(source, "posting_source") ||
        getValue(source, "source") ||
        getValue(source, "source_type"),
    ),
    reference: String(getValue(source, "reference") || ""),
    external_reference: String(
      getValue(source, "external_reference") ||
        getValue(source, "source_reference") ||
        "",
    ),
    description: String(
      getValue(source, "description") ||
        getValue(source, "memo") ||
        getValue(source, "notes") ||
        "",
    ),
    notes: String(getValue(source, "notes") || ""),
    currency: String(getValue(source, "currency") || "SAR"),
    total_debit: debitNumber,
    total_credit: creditNumber,
    is_balanced: toBoolean(
      getValue(source, "is_balanced"),
      Math.abs(debitNumber - creditNumber) < 0.005,
    ),
    posted_at: String(getValue(source, "posted_at") || ""),
    created_at: String(getValue(source, "created_at") || ""),
    updated_at: String(getValue(source, "updated_at") || ""),
    lines,
  };
}

function statusLabel(status: JournalStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<JournalStatus, string> = {
    DRAFT: t.draft,
    POSTED: t.posted,
    CANCELLED: t.cancelled,
    REVERSED: t.reversed,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function sourceLabel(source: PostingSource, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<PostingSource, string> = {
    MANUAL: t.manual,
    ORDER: t.order,
    PAYMENT: t.payment,
    INVOICE: t.invoice,
    REFUND: t.refund,
    ADJUSTMENT: t.adjustment,
    TREASURY: t.treasury,
    COMMISSION: t.commission,
    OPENING: t.opening,
    SYSTEM: t.system,
    OTHER: t.other,
    UNKNOWN: t.unknown,
  };

  return labels[source];
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

function statusBadge(status: JournalStatus, locale: AppLocale) {
  const label = statusLabel(status, locale);

  if (status === "POSTED") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (status === "DRAFT") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
        {label}
      </Badge>
    );
  }

  if (status === "CANCELLED" || status === "REVERSED") {
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

function sourceBadge(source: PostingSource, locale: AppLocale) {
  const label = sourceLabel(source, locale);

  if (source === "PAYMENT" || source === "TREASURY") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (source === "INVOICE" || source === "ORDER") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
        {label}
      </Badge>
    );
  }

  if (source === "COMMISSION" || source === "OPENING") {
    return (
      <Badge className="rounded-full border-amber-200 bg-amber-50 px-3 py-1 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
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

function balanceBadge(isBalanced: boolean, locale: AppLocale) {
  const t = dictionary(locale);

  if (isBalanced) {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {t.balanced}
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className="rounded-full px-3 py-1">
      {t.notBalanced}
    </Badge>
  );
}

function sortValue(row: JournalLine, key: SortKey): string | number {
  if (key === "debit_amount") return row.debit_amount;
  if (key === "credit_amount") return row.credit_amount;
  if (key === "sort_order") return row.sort_order;

  return String(row[key] || "");
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
      {Array.from({ length: 6 }).map((_, rowIndex) => (
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
  summaryRows,
  headers,
  rows,
}: {
  filename: string;
  worksheetName: string;
  title: string;
  locale: AppLocale;
  summaryRows: Array<[string, string | number]>;
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
            ${locale === "ar" ? "ملخص القيد" : "Entry Summary"}
          </td></tr>
          ${summaryHtml}
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
  entry,
  rows,
  t,
}: {
  locale: AppLocale;
  title: string;
  entry: JournalDetail;
  rows: JournalLine[];
  t: ReturnType<typeof dictionary>;
}) {
  const isArabic = locale === "ar";
  const now = new Date().toLocaleString("en-US");
  const difference = entry.total_debit - entry.total_credit;

  const tableRows = rows
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.account_code || "-")}</td>
          <td>${escapeHtml(item.account_name || "-")}</td>
          <td>${escapeHtml(item.cost_center_name || "-")}</td>
          <td>${escapeHtml(item.description || "-")}</td>
          <td>${escapeHtml(formatMoney(item.debit_amount))}</td>
          <td>${escapeHtml(formatMoney(item.credit_amount))}</td>
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
              <div>${escapeHtml(t.entryNumber)}: ${escapeHtml(entry.entry_number)}</div>
              <div>${escapeHtml(t.printedAt)}: ${escapeHtml(now)}</div>
              <div>${escapeHtml(t.rowsCount)}: ${formatNumber(rows.length)}</div>
            </div>
          </div>
          <div class="badge">Primey Care</div>
        </div>

        <div class="summary-grid">
          <div class="summary-card"><span>${escapeHtml(t.totalDebit)}</span><strong>${formatMoney(entry.total_debit)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.totalCredit)}</span><strong>${formatMoney(entry.total_credit)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.difference)}</span><strong>${formatMoney(difference)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.linesCount)}</span><strong>${formatNumber(entry.lines.length)}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${escapeHtml(t.table.accountCode)}</th>
              <th>${escapeHtml(t.table.accountName)}</th>
              <th>${escapeHtml(t.table.costCenter)}</th>
              <th>${escapeHtml(t.table.description)}</th>
              <th>${escapeHtml(t.table.debit)}</th>
              <th>${escapeHtml(t.table.credit)}</th>
            </tr>
          </thead>
          <tbody>
            ${
              tableRows ||
              `<tr><td colspan="7" style="text-align:center">${escapeHtml(t.emptyTitle)}</td></tr>`
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

export default function JournalEntryDetailPage() {
  const params = useParams<{ id?: string }>();
  const auth = useAuth() as unknown;

  const journalId = String(params?.id || "");

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [entry, setEntry] = useState<JournalDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sort_order");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [visibleColumns, setVisibleColumns] =
    useState<VisibleColumns>(DEFAULT_COLUMNS);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canView = hasSafePermission(
    auth,
    ["accounting.view", "accounting.journals.view", "accounting.detail"],
    "view",
  );

  const canExport = hasSafePermission(
    auth,
    ["accounting.export", "reports.accounting.export"],
    "action",
  );

  const canPrint = hasSafePermission(
    auth,
    ["accounting.print", "reports.accounting.print"],
    "action",
  );

  const filteredLines = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    const lines = (entry?.lines || []).filter((line) => {
      if (!cleanQuery) return true;

      return [
        line.account_code,
        line.account_name,
        line.account_type,
        line.normal_balance,
        line.cost_center_code,
        line.cost_center_name,
        line.description,
      ]
        .join(" ")
        .toLowerCase()
        .includes(cleanQuery);
    });

    return [...lines].sort((a, b) => {
      const first = sortValue(a, sortKey);
      const second = sortValue(b, sortKey);

      if (typeof first === "number" && typeof second === "number") {
        return sortDirection === "asc" ? first - second : second - first;
      }

      return sortDirection === "asc"
        ? String(first).localeCompare(String(second))
        : String(second).localeCompare(String(first));
    });
  }, [entry?.lines, query, sortDirection, sortKey]);

  const visibleColumnCount = Object.values(visibleColumns).filter(Boolean).length;
  const difference = entry ? entry.total_debit - entry.total_credit : 0;

  const summaryCards = useMemo(
    () => [
      {
        title: t.totalDebit,
        value: entry?.total_debit || 0,
        icon: Calculator,
        helper: t.financialSummary,
        isMoney: true,
      },
      {
        title: t.totalCredit,
        value: entry?.total_credit || 0,
        icon: CheckCircle2,
        helper: t.financialSummary,
        isMoney: true,
      },
      {
        title: t.difference,
        value: difference,
        icon: ShieldCheck,
        helper: entry?.is_balanced ? t.balanced : t.notBalanced,
        isMoney: true,
      },
      {
        title: t.linesCount,
        value: entry?.lines.length || 0,
        icon: Layers3,
        helper: t.linesTitle,
        isMoney: false,
      },
    ],
    [difference, entry, t],
  );

  const loadEntry = useCallback(
    async (showToast = false) => {
      if (!canView) {
        setIsLoading(false);
        return;
      }

      if (!journalId) {
        setIsLoading(false);
        setNotFound(true);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");
        setNotFound(false);

        const endpoints = [
          `/api/accounting/journals/${journalId}/`,
          `/api/accounting/journal-entries/${journalId}/`,
        ];

        let loadedPayload: unknown = null;
        let loaded = false;

        for (const endpoint of endpoints) {
          const response = await fetch(apiUrl(endpoint), {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: { Accept: "application/json" },
          });

          const payload = (await response.json().catch(() => null)) as
            | ApiEnvelope<unknown>
            | unknown
            | null;

          if ([400, 404, 405].includes(response.status)) {
            loadedPayload = payload;
            continue;
          }

          const envelope = payload as ApiEnvelope<unknown> | null;

          if (
            !response.ok ||
            envelope?.ok === false ||
            envelope?.success === false
          ) {
            throw new Error(
              envelope?.message ||
                envelope?.detail ||
                envelope?.error ||
                `HTTP ${response.status}`,
            );
          }

          loadedPayload = payload;
          loaded = true;
          break;
        }

        if (!loaded) {
          setEntry(null);
          setNotFound(true);
          return;
        }

        const normalized = normalizeJournalDetail(loadedPayload);

        if (!normalized || !normalized.id) {
          setEntry(null);
          setNotFound(true);
          return;
        }

        setEntry(normalized);

        if (showToast) {
          toast.success(t.refreshSuccess);
        }
      } catch (error) {
        console.error("Journal detail load error:", error);
        setEntry(null);
        setErrorMessage(t.apiError);
        toast.error(t.apiError);
      } finally {
        setIsLoading(false);
      }
    },
    [canView, journalId, t.apiError, t.refreshSuccess],
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  function exportExcel() {
    if (!canExport || !entry) return;

    if (filteredLines.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const generatedAt = new Date();

    downloadExcel({
      filename: `primey-care-journal-entry-${entry.entry_number || journalId}-${generatedAt
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "تفاصيل القيد" : "Journal Entry",
      title: t.title,
      locale,
      summaryRows: [
        [t.generatedAt, generatedAt.toLocaleString("en-US")],
        [t.entryNumber, entry.entry_number],
        [t.entryDate, formatDate(entry.entry_date, locale)],
        [t.status, statusLabel(entry.status, locale)],
        [t.postingSource, sourceLabel(entry.posting_source, locale)],
        [t.reference, entry.reference || "-"],
        [t.totalDebit, formatMoney(entry.total_debit)],
        [t.totalCredit, formatMoney(entry.total_credit)],
        [t.difference, formatMoney(difference)],
        [t.linesCount, entry.lines.length],
      ],
      headers: [
        t.table.sortOrder,
        t.table.accountCode,
        t.table.accountName,
        t.table.accountType,
        t.table.normalBalance,
        t.table.costCenter,
        t.table.description,
        t.table.debit,
        t.table.credit,
      ],
      rows: filteredLines.map((line) => [
        line.sort_order || "-",
        line.account_code || "-",
        line.account_name || "-",
        line.account_type || "-",
        line.normal_balance || "-",
        [line.cost_center_code, line.cost_center_name].filter(Boolean).join(" - ") ||
          "-",
        line.description || "-",
        formatMoney(line.debit_amount),
        formatMoney(line.credit_amount),
      ]),
    });

    toast.success(t.exportSuccess);
  }

  function printPage() {
    if (!canPrint || !entry) return;

    if (filteredLines.length === 0) {
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
        entry,
        rows: filteredLines,
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
    loadEntry(false);
  }, [authResolving, loadEntry]);

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
          <Link href="/system/accounting/journals">
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
            onClick={() => loadEntry(true)}
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
              variant="outline"
              className="h-10 rounded-xl"
              onClick={exportExcel}
              disabled={isLoading || !entry || filteredLines.length === 0}
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
              disabled={isLoading || !entry || filteredLines.length === 0}
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
              onClick={() => loadEntry(true)}
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
              <FileText className="h-5 w-5" />
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

      {!errorMessage && !notFound ? (
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

                      <div className="mt-2 text-xs text-muted-foreground">
                        {item.helper}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {entry ? (
            <>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <Card className="rounded-2xl border bg-card shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base font-bold">
                      <FileText className="h-4 w-4" />
                      {t.entryInfo}
                    </CardTitle>
                    <CardDescription>{t.entryInfoDesc}</CardDescription>
                  </CardHeader>

                  <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-2xl border bg-background p-4">
                      <p className="text-xs text-muted-foreground">
                        {t.entryNumber}
                      </p>
                      <p className="mt-2 font-semibold">
                        {entry.entry_number || "-"}
                      </p>
                    </div>

                    <div className="rounded-2xl border bg-background p-4">
                      <p className="text-xs text-muted-foreground">
                        {t.entryDate}
                      </p>
                      <p className="mt-2 font-semibold">
                        {formatDate(entry.entry_date, locale)}
                      </p>
                    </div>

                    <div className="rounded-2xl border bg-background p-4">
                      <p className="text-xs text-muted-foreground">
                        {t.status}
                      </p>
                      <div className="mt-2">
                        {statusBadge(entry.status, locale)}
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-background p-4">
                      <p className="text-xs text-muted-foreground">
                        {t.postingSource}
                      </p>
                      <div className="mt-2">
                        {sourceBadge(entry.posting_source, locale)}
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-background p-4">
                      <p className="text-xs text-muted-foreground">
                        {t.reference}
                      </p>
                      <p className="mt-2 font-semibold">
                        {entry.reference || "-"}
                      </p>
                    </div>

                    <div className="rounded-2xl border bg-background p-4">
                      <p className="text-xs text-muted-foreground">
                        {t.externalReference}
                      </p>
                      <p className="mt-2 font-semibold">
                        {entry.external_reference || "-"}
                      </p>
                    </div>

                    <div className="rounded-2xl border bg-background p-4 md:col-span-2 xl:col-span-3">
                      <p className="text-xs text-muted-foreground">
                        {t.description}
                      </p>
                      <p className="mt-2 text-sm leading-6">
                        {entry.description || "-"}
                      </p>
                    </div>

                    <div className="rounded-2xl border bg-background p-4 md:col-span-2 xl:col-span-3">
                      <p className="text-xs text-muted-foreground">
                        {t.notes}
                      </p>
                      <p className="mt-2 text-sm leading-6">
                        {entry.notes || "-"}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <aside className="space-y-4">
                  <Card className="rounded-2xl border bg-card shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base font-bold">
                        <Calculator className="h-4 w-4" />
                        {t.financialSummary}
                      </CardTitle>
                      <CardDescription>{t.financialSummaryDesc}</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="rounded-2xl border bg-background p-4">
                        <p className="text-xs text-muted-foreground">
                          {t.totalDebit}
                        </p>
                        <div className="mt-2 text-xl font-bold">
                          <MoneyText value={entry.total_debit} />
                        </div>
                      </div>

                      <div className="rounded-2xl border bg-background p-4">
                        <p className="text-xs text-muted-foreground">
                          {t.totalCredit}
                        </p>
                        <div className="mt-2 text-xl font-bold">
                          <MoneyText value={entry.total_credit} />
                        </div>
                      </div>

                      <div className="rounded-2xl border bg-background p-4">
                        <p className="text-xs text-muted-foreground">
                          {t.difference}
                        </p>
                        <div className="mt-2 text-xl font-bold">
                          <MoneyText value={difference} />
                        </div>
                      </div>

                      <div className="rounded-2xl border bg-background p-4">
                        <p className="text-xs text-muted-foreground">
                          {t.linesCount}
                        </p>
                        <div className="mt-2 text-2xl font-bold">
                          {formatNumber(entry.lines.length)}
                        </div>
                      </div>

                      {balanceBadge(entry.is_balanced, locale)}
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl border bg-card shadow-sm">
                    <CardContent className="space-y-3 p-5">
                      <div className="grid gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t.postedAt}
                          </p>
                          <p className="mt-1">
                            {formatDateTime(entry.posted_at, locale)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t.createdAt}
                          </p>
                          <p className="mt-1">
                            {formatDateTime(entry.created_at, locale)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t.updatedAt}
                          </p>
                          <p className="mt-1">
                            {formatDateTime(entry.updated_at, locale)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </aside>
              </div>

              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <Layers3 className="h-4 w-4" />
                    {t.linesTitle}
                  </CardTitle>
                  <CardDescription>{t.linesDesc}</CardDescription>
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
                    {query.trim() ? (
                      <Button
                        variant="outline"
                        className="h-10 rounded-xl"
                        onClick={() => setQuery("")}
                      >
                        {t.clearSearch}
                      </Button>
                    ) : (
                      <div />
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-10 rounded-xl">
                          <ColumnsIcon className="h-4 w-4" />
                          {t.columns}
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align={isArabic ? "start" : "end"}>
                        <DropdownMenuLabel>{t.columns}</DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        {Object.entries(visibleColumns).map(([key, value]) => (
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
                            {key === "sortOrder"
                              ? t.table.sortOrder
                              : key === "accountCode"
                                ? t.table.accountCode
                                : key === "accountName"
                                  ? t.table.accountName
                                  : key === "accountType"
                                    ? t.table.accountType
                                    : key === "normalBalance"
                                      ? t.table.normalBalance
                                      : key === "costCenter"
                                        ? t.table.costCenter
                                        : key === "description"
                                          ? t.table.description
                                          : key === "debitAmount"
                                            ? t.table.debit
                                            : t.table.credit}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="overflow-hidden rounded-xl border">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {visibleColumns.sortOrder ? (
                              <TableHead>
                                <button
                                  type="button"
                                  onClick={() => toggleSort("sort_order")}
                                  className="inline-flex items-center gap-1 font-medium"
                                >
                                  {t.table.sortOrder}
                                  <ArrowDownUp className="h-3.5 w-3.5" />
                                </button>
                              </TableHead>
                            ) : null}

                            {visibleColumns.accountCode ? (
                              <TableHead>
                                <button
                                  type="button"
                                  onClick={() => toggleSort("account_code")}
                                  className="inline-flex items-center gap-1 font-medium"
                                >
                                  {t.table.accountCode}
                                  <ArrowDownUp className="h-3.5 w-3.5" />
                                </button>
                              </TableHead>
                            ) : null}

                            {visibleColumns.accountName ? (
                              <TableHead>
                                <button
                                  type="button"
                                  onClick={() => toggleSort("account_name")}
                                  className="inline-flex items-center gap-1 font-medium"
                                >
                                  {t.table.accountName}
                                  <ArrowDownUp className="h-3.5 w-3.5" />
                                </button>
                              </TableHead>
                            ) : null}

                            {visibleColumns.accountType ? (
                              <TableHead>{t.table.accountType}</TableHead>
                            ) : null}

                            {visibleColumns.normalBalance ? (
                              <TableHead>{t.table.normalBalance}</TableHead>
                            ) : null}

                            {visibleColumns.costCenter ? (
                              <TableHead>{t.table.costCenter}</TableHead>
                            ) : null}

                            {visibleColumns.description ? (
                              <TableHead>{t.table.description}</TableHead>
                            ) : null}

                            {visibleColumns.debitAmount ? (
                              <TableHead>
                                <button
                                  type="button"
                                  onClick={() => toggleSort("debit_amount")}
                                  className="inline-flex items-center gap-1 font-medium"
                                >
                                  {t.table.debit}
                                  <ArrowDownUp className="h-3.5 w-3.5" />
                                </button>
                              </TableHead>
                            ) : null}

                            {visibleColumns.creditAmount ? (
                              <TableHead>
                                <button
                                  type="button"
                                  onClick={() => toggleSort("credit_amount")}
                                  className="inline-flex items-center gap-1 font-medium"
                                >
                                  {t.table.credit}
                                  <ArrowDownUp className="h-3.5 w-3.5" />
                                </button>
                              </TableHead>
                            ) : null}
                          </TableRow>
                        </TableHeader>

                        <TableBody>
                          {isLoading ? (
                            <TableRowsSkeleton columnsCount={visibleColumnCount} />
                          ) : filteredLines.length > 0 ? (
                            filteredLines.map((line) => (
                              <TableRow key={`${line.id}-${line.sort_order}`}>
                                {visibleColumns.sortOrder ? (
                                  <TableCell>
                                    {formatNumber(line.sort_order)}
                                  </TableCell>
                                ) : null}

                                {visibleColumns.accountCode ? (
                                  <TableCell>{line.account_code || "-"}</TableCell>
                                ) : null}

                                {visibleColumns.accountName ? (
                                  <TableCell>
                                    <div className="min-w-[180px]">
                                      <p className="font-medium">
                                        {line.account_name || "-"}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {line.account_id || "-"}
                                      </p>
                                    </div>
                                  </TableCell>
                                ) : null}

                                {visibleColumns.accountType ? (
                                  <TableCell>{line.account_type || "-"}</TableCell>
                                ) : null}

                                {visibleColumns.normalBalance ? (
                                  <TableCell>
                                    {line.normal_balance || "-"}
                                  </TableCell>
                                ) : null}

                                {visibleColumns.costCenter ? (
                                  <TableCell>
                                    <div className="min-w-[160px]">
                                      <p>{line.cost_center_name || "-"}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {line.cost_center_code || "-"}
                                      </p>
                                    </div>
                                  </TableCell>
                                ) : null}

                                {visibleColumns.description ? (
                                  <TableCell>
                                    <span className="line-clamp-2 min-w-[180px] text-sm">
                                      {line.description || "-"}
                                    </span>
                                  </TableCell>
                                ) : null}

                                {visibleColumns.debitAmount ? (
                                  <TableCell>
                                    <MoneyText value={line.debit_amount} />
                                  </TableCell>
                                ) : null}

                                {visibleColumns.creditAmount ? (
                                  <TableCell>
                                    <MoneyText value={line.credit_amount} />
                                  </TableCell>
                                ) : null}
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell
                                colSpan={visibleColumnCount || 1}
                                className="h-36 text-center"
                              >
                                <div className="mx-auto max-w-md space-y-2">
                                  <p className="font-semibold">
                                    {query.trim()
                                      ? t.noResultsTitle
                                      : t.emptyTitle}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {query.trim()
                                      ? t.noResultsText
                                      : t.emptyText}
                                  </p>

                                  {query.trim() ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="mt-2 rounded-xl"
                                      onClick={() => setQuery("")}
                                    >
                                      {t.clearSearch}
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
                    {t.showing} {formatNumber(filteredLines.length)} {t.from}{" "}
                    {formatNumber(entry.lines.length)}
                  </p>
                </CardContent>
              </Card>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}