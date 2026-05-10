"use client";

/* ============================================================
   📂 app/system/accounting/accounts/[id]/page.tsx
   🧠 Primey Care | Account Detail Page

   ✅ المسار:
      app/system/accounting/accounts/[id]/page.tsx

   ✅ العمل:
      صفحة تفاصيل الحساب المحاسبي داخل مديول المحاسبة.
      تعرض بيانات الحساب، ملخص الحركة، الرصيد الافتتاحي، الرصيد الختامي، وحركة الحساب.

   ✅ الإصدار:
      Phase 17 UX Refinement + Accounting Account Detail Review

   ✅ يعتمد على:
      - /api/accounting/ledger/
      - primey-locale
      - AuthProvider
      - sonner
      - /currency/sar.svg

   ✅ متوافق مع:
      - Accounting accounts page
      - Accounting journals approved pattern
      - Centers / Customers approved UX standard

   ✅ الوظائف:
      - عرض تفاصيل الحساب المحاسبي.
      - عرض حركة الحساب من دفتر الأستاذ حسب account_id.
      - فلاتر الفترة والترحيل والرصيد الافتتاحي.
      - بحث داخل الحركات.
      - التحكم بالأعمدة.
      - فرز الحركات.
      - Excel export بصيغة .xls HTML Workbook.
      - Web PDF Print.
      - Error State مستقل.
      - Empty State ذكي.
      - Skeleton Loading.
      - صلاحيات آمنة بدون كسر system_admin/superuser.
      - أرقام إنجليزية دائمًا.
      - رمز SAR من /currency/sar.svg بعد الرقم.

   ------------------------------------------------------------
   تحسينات هذا الإصدار:
      - الالتزام بالقاعدة: w-full space-y-4 بدون main/min-h-screen/max-w.
      - إزالة p-4/md:p-6 من جذر الصفحة حتى لا تكسر Layout النظام.
      - عدم فتح Excel من الباكند، واستبداله بتصدير HTML Workbook.
      - إضافة Web PDF Print.
      - إضافة Error State مستقل داخل الصفحة.
      - ضبط اتجاه الصفحة حسب primey-locale.
      - جعل رمز SAR بعد الرقم وليس قبله.
      - عدم عرض أي مسارات أو عبارات تقنية في واجهة المستخدم.
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ElementType, ReactNode } from "react";
import {
  ArrowDownUp,
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  ColumnsIcon,
  Download,
  Filter,
  Layers3,
  Loader2,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  WalletCards,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/AuthProvider";
import { apiGet } from "@/lib/api";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

type SortKey =
  | "entry_date"
  | "journal_entry_number"
  | "posting_source"
  | "reference"
  | "description"
  | "debit_amount"
  | "credit_amount"
  | "movement_amount"
  | "running_balance";

type SortDirection = "asc" | "desc";

type LedgerTransaction = {
  id: number;
  journal_entry_id: number | null;
  journal_entry_number: string | null;
  entry_date: string | null;
  posting_source: string | null;
  reference: string | null;
  external_reference: string | null;
  entry_description: string | null;
  account_id: number | null;
  account_code: string | null;
  account_name: string | null;
  account_type: string | null;
  normal_balance: string | null;
  line_description: string | null;
  debit_amount: string;
  credit_amount: string;
  movement_amount: string;
  running_balance: string;
  sort_order: number;
  created_at: string | null;
};

type LedgerAccount = {
  id: number;
  code: string | null;
  name: string | null;
  name_ar: string | null;
  name_en: string | null;
  account_type: string | null;
  normal_balance: string | null;
  is_group: boolean;
  is_active: boolean;
  parent_id: number | null;
};

type LedgerPayload = {
  filters: {
    account_id: number | null;
    date_from: string | null;
    date_to: string | null;
    posted_only: boolean;
    include_opening: boolean;
    ordering: string;
  };
  account: LedgerAccount | null;
  summary: {
    transaction_count: number;
    opening_debit: string;
    opening_credit: string;
    opening_balance: string;
    total_debit: string;
    total_credit: string;
    closing_balance: string;
  };
  pagination: {
    page: number;
    page_size: number;
    total_pages: number;
    total_items: number;
    has_next: boolean;
    has_previous: boolean;
    next_page: number | null;
    previous_page: number | null;
  };
  transactions: LedgerTransaction[];
};

type ApiEnvelope<T> = {
  ok?: boolean;
  success?: boolean;
  data?: T;
  message?: string;
  detail?: string;
  error?: string;
};

type VisibleColumns = {
  entry_date: boolean;
  journal_entry_number: boolean;
  posting_source: boolean;
  reference: boolean;
  description: boolean;
  debit_amount: boolean;
  credit_amount: boolean;
  movement_amount: boolean;
  running_balance: boolean;
  actions: boolean;
};

const CURRENCY_ICON_PATH = "/currency/sar.svg";

const DEFAULT_PAYLOAD: LedgerPayload = {
  filters: {
    account_id: null,
    date_from: null,
    date_to: null,
    posted_only: true,
    include_opening: true,
    ordering: "entry_date",
  },
  account: null,
  summary: {
    transaction_count: 0,
    opening_debit: "0.00",
    opening_credit: "0.00",
    opening_balance: "0.00",
    total_debit: "0.00",
    total_credit: "0.00",
    closing_balance: "0.00",
  },
  pagination: {
    page: 1,
    page_size: 20,
    total_pages: 1,
    total_items: 0,
    has_next: false,
    has_previous: false,
    next_page: null,
    previous_page: null,
  },
  transactions: [],
};

const DEFAULT_COLUMNS: VisibleColumns = {
  entry_date: true,
  journal_entry_number: true,
  posting_source: true,
  reference: true,
  description: true,
  debit_amount: true,
  credit_amount: true,
  movement_amount: true,
  running_balance: true,
  actions: true,
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

function buildQuery(
  params: Record<string, string | number | boolean | null | undefined>,
) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();

  return query ? `?${query}` : "";
}

function buildLedgerPath({
  accountId,
  dateFrom,
  dateTo,
  postedOnly,
  includeOpening,
  page,
  pageSize,
  ordering,
}: {
  accountId: string;
  dateFrom: string;
  dateTo: string;
  postedOnly: boolean;
  includeOpening: boolean;
  page: number;
  pageSize: number;
  ordering: string;
}) {
  return `/api/accounting/ledger/${buildQuery({
    account_id: accountId || null,
    date_from: dateFrom || null,
    date_to: dateTo || null,
    posted_only: postedOnly,
    include_opening: includeOpening,
    page,
    page_size: pageSize,
    ordering,
  })}`;
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
    title: isArabic ? "تفاصيل الحساب" : "Account Detail",
    subtitle: isArabic
      ? "عرض بيانات الحساب، الرصيد الافتتاحي، الرصيد الختامي، وجميع الحركات المرتبطة."
      : "View account information, opening balance, closing balance, and related movements.",

    back: isArabic ? "دليل الحسابات" : "Chart of Accounts",
    accounting: isArabic ? "لوحة المحاسبة" : "Accounting Overview",
    ledger: isArabic ? "دفتر الأستاذ" : "Ledger",
    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",

    statusTitle: isArabic ? "ملخص الحساب" : "Account Summary",
    statusDesc: isArabic
      ? "مؤشرات الحساب حسب الفترة والفلاتر المحددة."
      : "Account indicators based on the selected filters.",

    openingBalance: isArabic ? "الرصيد الافتتاحي" : "Opening Balance",
    totalDebit: isArabic ? "إجمالي المدين" : "Total Debit",
    totalCredit: isArabic ? "إجمالي الدائن" : "Total Credit",
    closingBalance: isArabic ? "الرصيد الختامي" : "Closing Balance",
    transactions: isArabic ? "عدد الحركات" : "Transactions",

    accountInfo: isArabic ? "بيانات الحساب" : "Account Information",
    accountInfoDesc: isArabic
      ? "معلومات الحساب الأساسية من دليل الحسابات."
      : "Basic account information from the chart of accounts.",
    accountCode: isArabic ? "رمز الحساب" : "Account Code",
    accountName: isArabic ? "اسم الحساب" : "Account Name",
    accountType: isArabic ? "نوع الحساب" : "Account Type",
    normalBalance: isArabic ? "طبيعة الحساب" : "Normal Balance",
    groupAccount: isArabic ? "حساب تجميعي" : "Group Account",
    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
    yes: isArabic ? "نعم" : "Yes",
    no: isArabic ? "لا" : "No",
    status: isArabic ? "الحالة" : "Status",

    filters: isArabic ? "الفلاتر" : "Filters",
    filtersDesc: isArabic
      ? "تحكم في الفترة، حالة الترحيل، والرصيد الافتتاحي."
      : "Control period, posting status, and opening balance.",
    dateFrom: isArabic ? "من تاريخ" : "Date From",
    dateTo: isArabic ? "إلى تاريخ" : "Date To",
    postedOnly: isArabic ? "قيود مرحلة فقط" : "Posted only",
    includeOpening: isArabic ? "إظهار الرصيد الافتتاحي" : "Include opening",
    pageSize: isArabic ? "عدد الصفوف" : "Page size",
    applyFilters: isArabic ? "تطبيق الفلاتر" : "Apply filters",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",

    searchPlaceholder: isArabic
      ? "بحث في رقم القيد، المرجع، الوصف..."
      : "Search journal number, reference, description...",
    columns: isArabic ? "الأعمدة" : "Columns",
    tableTitle: isArabic ? "حركة الحساب" : "Account Transactions",
    tableDesc: isArabic
      ? "قائمة القيود والحركات المرتبطة بالحساب."
      : "List of journal lines and account movements.",
    entryDate: isArabic ? "التاريخ" : "Date",
    journalNumber: isArabic ? "رقم القيد" : "Journal No.",
    source: isArabic ? "المصدر" : "Source",
    reference: isArabic ? "المرجع" : "Reference",
    description: isArabic ? "الوصف" : "Description",
    debit: isArabic ? "مدين" : "Debit",
    credit: isArabic ? "دائن" : "Credit",
    movement: isArabic ? "الحركة" : "Movement",
    runningBalance: isArabic ? "الرصيد" : "Balance",
    action: isArabic ? "الإجراء" : "Action",
    view: isArabic ? "عرض" : "View",

    emptyTitle: isArabic ? "لا توجد حركات" : "No transactions",
    emptyDesc: isArabic
      ? "لم يتم العثور على حركات مرتبطة بهذا الحساب حسب الفلاتر الحالية."
      : "No transactions were found for this account with the current filters.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير البحث أو الفلاتر."
      : "Try changing the search or filters.",
    loading: isArabic ? "جاري تحميل تفاصيل الحساب..." : "Loading account detail...",

    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",
    page: isArabic ? "صفحة" : "Page",
    of: isArabic ? "من" : "of",
    showing: isArabic ? "عرض" : "Showing",

    invalidAccount: isArabic ? "رقم الحساب غير صحيح" : "Invalid account ID",
    loadSuccess: isArabic ? "تم تحديث تفاصيل الحساب" : "Account detail refreshed",
    loadError: isArabic
      ? "تعذر تحميل تفاصيل الحساب"
      : "Failed to load account detail",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الحساب" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض تفاصيل الحسابات المحاسبية. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view accounting account details. Contact your system administrator if you need access.",

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

    generatedAt: isArabic ? "تاريخ التصدير" : "Generated At",
    printedAt: isArabic ? "تاريخ الطباعة" : "Printed At",
    rowsCount: isArabic ? "عدد السجلات" : "Rows Count",
  };
}

/* ============================================================
   Helpers
============================================================ */

function toNumber(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: string | number | null | undefined): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatMoney(value: string | number | null | undefined): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(value: string | null | undefined, locale: AppLocale): string {
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

function normalizeLedgerPayload(raw: ApiEnvelope<LedgerPayload> | LedgerPayload) {
  const envelope = raw as ApiEnvelope<LedgerPayload>;

  if (envelope?.ok === false || envelope?.success === false) {
    throw new Error(
      envelope.message ||
        envelope.detail ||
        envelope.error ||
        "Account detail request failed",
    );
  }

  const data = envelope?.data || (raw as LedgerPayload);

  return {
    ...DEFAULT_PAYLOAD,
    ...data,
    filters: {
      ...DEFAULT_PAYLOAD.filters,
      ...(data?.filters || {}),
    },
    summary: {
      ...DEFAULT_PAYLOAD.summary,
      ...(data?.summary || {}),
    },
    pagination: {
      ...DEFAULT_PAYLOAD.pagination,
      ...(data?.pagination || {}),
    },
    transactions: Array.isArray(data?.transactions) ? data.transactions : [],
  };
}

async function fetchLedger(path: string): Promise<LedgerPayload> {
  const result = await apiGet<ApiEnvelope<LedgerPayload> | LedgerPayload>(path);

  if (!result.ok) {
    throw new Error(result.message || "Account detail request failed");
  }

  return normalizeLedgerPayload(result.data);
}

function getDescription(row: LedgerTransaction) {
  return row.line_description || row.entry_description || "";
}

function getSortText(row: LedgerTransaction, key: SortKey) {
  if (key === "description") return getDescription(row);

  if (key === "entry_date") return row.entry_date || "";
  if (key === "journal_entry_number") return row.journal_entry_number || "";
  if (key === "posting_source") return row.posting_source || "";
  if (key === "reference") return row.reference || "";

  return "";
}

function getSortNumber(row: LedgerTransaction, key: SortKey) {
  if (key === "debit_amount") return toNumber(row.debit_amount);
  if (key === "credit_amount") return toNumber(row.credit_amount);
  if (key === "movement_amount") return toNumber(row.movement_amount);
  if (key === "running_balance") return toNumber(row.running_balance);

  return 0;
}

function compareValues(
  a: LedgerTransaction,
  b: LedgerTransaction,
  key: SortKey,
  direction: SortDirection,
) {
  const multiplier = direction === "asc" ? 1 : -1;

  if (
    key === "debit_amount" ||
    key === "credit_amount" ||
    key === "movement_amount" ||
    key === "running_balance"
  ) {
    return (getSortNumber(a, key) - getSortNumber(b, key)) * multiplier;
  }

  return getSortText(a, key).localeCompare(getSortText(b, key)) * multiplier;
}

function getAccountName(account: LedgerAccount | null, locale: AppLocale) {
  if (!account) return locale === "ar" ? "حساب غير محدد" : "Unknown Account";

  if (locale === "ar") {
    return account.name_ar || account.name || account.name_en || "-";
  }

  return account.name_en || account.name || account.name_ar || "-";
}

function getAccountTypeLabel(value: string | null | undefined, locale: AppLocale) {
  const key = String(value || "UNKNOWN").toUpperCase();

  const ar: Record<string, string> = {
    ASSET: "أصل",
    LIABILITY: "التزام",
    EQUITY: "حقوق ملكية",
    REVENUE: "إيراد",
    EXPENSE: "مصروف",
    UNKNOWN: "غير محدد",
  };

  const en: Record<string, string> = {
    ASSET: "Asset",
    LIABILITY: "Liability",
    EQUITY: "Equity",
    REVENUE: "Revenue",
    EXPENSE: "Expense",
    UNKNOWN: "Unknown",
  };

  return locale === "ar" ? ar[key] || ar.UNKNOWN : en[key] || en.UNKNOWN;
}

function getNormalBalanceLabel(
  value: string | null | undefined,
  locale: AppLocale,
) {
  const key = String(value || "UNKNOWN").toUpperCase();

  const ar: Record<string, string> = {
    DEBIT: "مدين",
    CREDIT: "دائن",
    UNKNOWN: "غير محدد",
  };

  const en: Record<string, string> = {
    DEBIT: "Debit",
    CREDIT: "Credit",
    UNKNOWN: "Unknown",
  };

  return locale === "ar" ? ar[key] || ar.UNKNOWN : en[key] || en.UNKNOWN;
}

/* ============================================================
   UI Helpers
============================================================ */

function MoneyValue({ value }: { value: string | number | null | undefined }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold">
      <span>{formatMoney(value)}</span>
      <Image
        src={CURRENCY_ICON_PATH}
        alt=""
        width={15}
        height={15}
        className="inline-block"
      />
    </span>
  );
}

function SortButton({
  label,
  sortKey,
  activeKey,
  direction,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onClick: () => void;
}) {
  const isActive = sortKey === activeKey;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 font-semibold hover:text-foreground"
    >
      {label}
      <ArrowDownUp
        className={`h-3.5 w-3.5 ${
          isActive ? "text-foreground" : "text-muted-foreground"
        } ${isActive && direction === "desc" ? "rotate-180" : ""}`}
      />
    </button>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  money,
}: {
  title: string;
  value: string | number;
  icon: ElementType;
  money?: boolean;
}) {
  return (
    <Card className="rounded-2xl border bg-card shadow-sm">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{title}</p>
          <div className="text-2xl font-bold tracking-tight">
            {money ? <MoneyValue value={value} /> : value}
          </div>
        </div>

        <div className="rounded-2xl bg-muted p-3">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border bg-background p-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
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
                  columnIndex === 1
                    ? "h-8 w-36 rounded-lg"
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
            ${locale === "ar" ? "ملخص الحساب" : "Account Summary"}
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
  accountName,
  rows,
  summary,
  t,
}: {
  locale: AppLocale;
  title: string;
  accountName: string;
  rows: LedgerTransaction[];
  summary: {
    openingBalance: string;
    totalDebit: string;
    totalCredit: string;
    closingBalance: string;
    transactionCount: number;
  };
  t: ReturnType<typeof dictionary>;
}) {
  const isArabic = locale === "ar";
  const now = new Date().toLocaleString("en-US");

  const tableRows = rows
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(formatDate(item.entry_date, locale))}</td>
          <td>${escapeHtml(item.journal_entry_number || "-")}</td>
          <td>${escapeHtml(item.posting_source || "-")}</td>
          <td>${escapeHtml(item.reference || "-")}</td>
          <td>${escapeHtml(getDescription(item) || "-")}</td>
          <td>${escapeHtml(formatMoney(item.debit_amount))}</td>
          <td>${escapeHtml(formatMoney(item.credit_amount))}</td>
          <td>${escapeHtml(formatMoney(item.running_balance))}</td>
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
              <div>${escapeHtml(accountName)}</div>
              <div>${escapeHtml(t.printedAt)}: ${escapeHtml(now)}</div>
              <div>${escapeHtml(t.rowsCount)}: ${formatNumber(rows.length)}</div>
            </div>
          </div>
          <div class="badge">Primey Care</div>
        </div>

        <div class="summary-grid">
          <div class="summary-card"><span>${escapeHtml(t.openingBalance)}</span><strong>${formatMoney(summary.openingBalance)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.totalDebit)}</span><strong>${formatMoney(summary.totalDebit)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.totalCredit)}</span><strong>${formatMoney(summary.totalCredit)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.closingBalance)}</span><strong>${formatMoney(summary.closingBalance)}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${escapeHtml(t.entryDate)}</th>
              <th>${escapeHtml(t.journalNumber)}</th>
              <th>${escapeHtml(t.source)}</th>
              <th>${escapeHtml(t.reference)}</th>
              <th>${escapeHtml(t.description)}</th>
              <th>${escapeHtml(t.debit)}</th>
              <th>${escapeHtml(t.credit)}</th>
              <th>${escapeHtml(t.runningBalance)}</th>
            </tr>
          </thead>
          <tbody>
            ${
              tableRows ||
              `<tr><td colspan="9" style="text-align:center">${escapeHtml(t.emptyTitle)}</td></tr>`
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

export default function AccountDetailPage() {
  const params = useParams<{ id: string }>();
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [payload, setPayload] = useState<LedgerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [postedOnly, setPostedOnly] = useState(true);
  const [includeOpening, setIncludeOpening] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("entry_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [visibleColumns, setVisibleColumns] =
    useState<VisibleColumns>(DEFAULT_COLUMNS);

  const accountId = String(params?.id || "");
  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canView = hasSafePermission(
    auth,
    ["accounting.view", "accounting.accounts.view", "accounting.ledger.view"],
    "view",
  );

  const canExport = hasSafePermission(
    auth,
    ["accounting.export", "reports.accounting.export", "reports.export"],
    "action",
  );

  const canPrint = hasSafePermission(
    auth,
    ["accounting.print", "reports.accounting.print", "reports.print"],
    "action",
  );

  const account = payload?.account || null;
  const transactions = payload?.transactions || [];

  const summary = useMemo(() => {
    const totalDebit = payload?.summary.total_debit || "0.00";
    const totalCredit = payload?.summary.total_credit || "0.00";
    const openingBalance = payload?.summary.opening_balance || "0.00";
    const closingBalance = payload?.summary.closing_balance || "0.00";
    const transactionCount =
      payload?.summary.transaction_count || transactions.length;

    const debitValue = toNumber(totalDebit);
    const creditValue = toNumber(totalCredit);
    const totalMovement = debitValue + creditValue;

    const debitPercent =
      totalMovement > 0 ? Math.min((debitValue / totalMovement) * 100, 100) : 0;

    const creditPercent =
      totalMovement > 0
        ? Math.min((creditValue / totalMovement) * 100, 100)
        : 0;

    return {
      totalDebit,
      totalCredit,
      openingBalance,
      closingBalance,
      transactionCount,
      debitPercent,
      creditPercent,
    };
  }, [payload, transactions.length]);

  const filteredRows = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return transactions
      .filter((row) => {
        if (!keyword) return true;

        return [
          row.entry_date,
          row.journal_entry_number,
          row.posting_source,
          row.reference,
          row.external_reference,
          row.entry_description,
          row.line_description,
          row.debit_amount,
          row.credit_amount,
          row.movement_amount,
          row.running_balance,
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      })
      .sort((a, b) => compareValues(a, b, sortKey, sortDirection));
  }, [transactions, searchTerm, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  const paginatedRows = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * pageSize;

    return filteredRows.slice(startIndex, startIndex + pageSize);
  }, [filteredRows, page, pageSize, totalPages]);

  const visibleColumnCount = Object.values(visibleColumns).filter(Boolean).length;

  const accountTitle = account?.code
    ? `${account.code} - ${getAccountName(account, locale)}`
    : t.subtitle;

  const hasSearchOrFilter =
    searchTerm.trim().length > 0 ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    !postedOnly ||
    !includeOpening;

  const statusCards = [
    {
      label: t.openingBalance,
      value: summary.openingBalance,
      icon: Layers3,
      percent: summary.transactionCount > 0 ? 100 : 0,
      money: true,
    },
    {
      label: t.totalDebit,
      value: summary.totalDebit,
      icon: TrendingUp,
      percent: summary.debitPercent,
      money: true,
    },
    {
      label: t.totalCredit,
      value: summary.totalCredit,
      icon: TrendingDown,
      percent: summary.creditPercent,
      money: true,
    },
    {
      label: t.closingBalance,
      value: summary.closingBalance,
      icon: ShieldCheck,
      percent: summary.transactionCount > 0 ? 100 : 0,
      money: true,
    },
  ];

  const summaryCards = [
    {
      title: t.openingBalance,
      value: summary.openingBalance,
      icon: Layers3,
      money: true,
    },
    {
      title: t.totalDebit,
      value: summary.totalDebit,
      icon: TrendingUp,
      money: true,
    },
    {
      title: t.totalCredit,
      value: summary.totalCredit,
      icon: TrendingDown,
      money: true,
    },
    {
      title: t.transactions,
      value: formatNumber(summary.transactionCount),
      icon: WalletCards,
      money: false,
    },
  ];

  const columnOptions: Array<{ key: keyof VisibleColumns; label: string }> = [
    { key: "entry_date", label: t.entryDate },
    { key: "journal_entry_number", label: t.journalNumber },
    { key: "posting_source", label: t.source },
    { key: "reference", label: t.reference },
    { key: "description", label: t.description },
    { key: "debit_amount", label: t.debit },
    { key: "credit_amount", label: t.credit },
    { key: "movement_amount", label: t.movement },
    { key: "running_balance", label: t.runningBalance },
    { key: "actions", label: t.action },
  ];

  function validateInputs() {
    if (!accountId || Number.isNaN(Number(accountId))) {
      toast.error(t.invalidAccount);
      return false;
    }

    if (dateFrom && dateTo && dateFrom > dateTo) {
      toast.error(
        locale === "ar"
          ? "لا يمكن أن يكون تاريخ البداية أكبر من تاريخ النهاية"
          : "Date from cannot be greater than date to",
      );
      return false;
    }

    return true;
  }

  const loadAccountDetail = useCallback(
    async (showToast = false) => {
      try {
        if (!canView || authResolving) {
          setLoading(false);
          return;
        }

        if (!validateInputs()) {
          setLoading(false);
          return;
        }

        setLoading(true);
        setErrorMessage("");

        const path = buildLedgerPath({
          accountId,
          dateFrom,
          dateTo,
          postedOnly,
          includeOpening,
          page: 1,
          pageSize: 500,
          ordering: sortDirection === "desc" ? `-${sortKey}` : sortKey,
        });

        const data = await fetchLedger(path);

        setPayload(data);

        if (showToast) {
          toast.success(t.loadSuccess);
        }
      } catch (error) {
        console.error("Account detail load error:", error);
        setPayload(null);
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setLoading(false);
      }
    },
    [
      accountId,
      authResolving,
      canView,
      dateFrom,
      dateTo,
      includeOpening,
      postedOnly,
      sortDirection,
      sortKey,
      t.loadError,
      t.loadSuccess,
    ],
  );

  function clearFilters() {
    setSearchTerm("");
    setDateFrom("");
    setDateTo("");
    setPostedOnly(true);
    setIncludeOpening(true);
    setPageSize(20);
    setPage(1);
  }

  function exportExcel() {
    if (!canExport) return;

    if (filteredRows.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const generatedAt = new Date();

    downloadExcel({
      filename: `primey-care-account-ledger-${account?.code || accountId}-${generatedAt
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "حركة الحساب" : "Account Ledger",
      title: t.title,
      locale,
      summaryRows: [
        [t.generatedAt, generatedAt.toLocaleString("en-US")],
        [t.accountCode, account?.code || "-"],
        [t.accountName, getAccountName(account, locale)],
        [t.accountType, getAccountTypeLabel(account?.account_type, locale)],
        [t.normalBalance, getNormalBalanceLabel(account?.normal_balance, locale)],
        [t.openingBalance, formatMoney(summary.openingBalance)],
        [t.totalDebit, formatMoney(summary.totalDebit)],
        [t.totalCredit, formatMoney(summary.totalCredit)],
        [t.closingBalance, formatMoney(summary.closingBalance)],
        [t.transactions, summary.transactionCount],
      ],
      headers: [
        t.entryDate,
        t.journalNumber,
        t.source,
        t.reference,
        t.description,
        t.debit,
        t.credit,
        t.movement,
        t.runningBalance,
      ],
      rows: filteredRows.map((row) => [
        formatDate(row.entry_date, locale),
        row.journal_entry_number || "-",
        row.posting_source || "-",
        row.reference || "-",
        getDescription(row) || "-",
        formatMoney(row.debit_amount),
        formatMoney(row.credit_amount),
        formatMoney(row.movement_amount),
        formatMoney(row.running_balance),
      ]),
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
        accountName: accountTitle,
        rows: filteredRows,
        summary,
        t,
      }),
    );
    printWindow.document.close();

    toast.success(t.printSuccess);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  useEffect(() => {
    const syncLocale = () => {
      const currentLocale = readLocale();

      setLocale(currentLocale);
      applyDocumentLocale(currentLocale);
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
    loadAccountDetail(false);
  }, [authResolving, loadAccountDetail]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, dateFrom, dateTo, postedOnly, includeOpening, pageSize]);

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
            {accountTitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link href="/system/accounting/accounts">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>

          <Link href="/system/accounting">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <BarChart3 className="h-4 w-4" />
              <span>{t.accounting}</span>
            </Button>
          </Link>

          <Link href="/system/accounting/ledger">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <BookOpenCheck className="h-4 w-4" />
              <span>{t.ledger}</span>
            </Button>
          </Link>

          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadAccountDetail(true)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refresh}</span>
          </Button>

          {canExport ? (
            <Button
              type="button"
              className="h-10 rounded-xl"
              onClick={exportExcel}
              disabled={loading || filteredRows.length === 0 || Boolean(errorMessage)}
            >
              <Download className="h-4 w-4" />
              <span>{t.exportExcel}</span>
            </Button>
          ) : null}

          {canPrint ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              onClick={printPage}
              disabled={loading || filteredRows.length === 0 || Boolean(errorMessage)}
            >
              <Printer className="h-4 w-4" />
              <span>{t.print}</span>
            </Button>
          ) : null}
        </div>
      </div>

      {!loading && errorMessage ? (
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
              onClick={() => loadAccountDetail(true)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!errorMessage ? (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_360px]">
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="flex flex-col gap-3 pb-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="text-base font-bold">
                    {t.statusTitle}
                  </CardTitle>
                  <CardDescription>{t.statusDesc}</CardDescription>
                </div>

                {canExport ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-xl"
                    onClick={exportExcel}
                    disabled={loading || filteredRows.length === 0}
                  >
                    <Download className="h-4 w-4" />
                    {t.exportExcel}
                  </Button>
                ) : null}
              </CardHeader>

              <CardContent className="space-y-4">
                {loading ? (
                  <div className="grid gap-4 md:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="space-y-3 rounded-2xl border bg-background p-4">
                        <SkeletonLine className="h-4 w-24" />
                        <SkeletonLine className="h-7 w-28" />
                        <SkeletonLine className="h-2 w-full" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-4">
                    {statusCards.map((card) => {
                      const Icon = card.icon;

                      return (
                        <div key={card.label} className="space-y-2 rounded-2xl border bg-background p-4">
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>{card.label}</span>
                            <Icon className="h-4 w-4" />
                          </div>

                          <p className="text-2xl font-bold">
                            {card.money ? (
                              <MoneyValue value={card.value} />
                            ) : (
                              card.value
                            )}
                          </p>

                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${formatPercent(card.percent)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">
                  {t.accountInfo}
                </CardTitle>
                <CardDescription>{t.accountInfoDesc}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                {loading ? (
                  <>
                    {Array.from({ length: 6 }).map((_, index) => (
                      <SkeletonLine key={index} className="h-12 w-full rounded-2xl" />
                    ))}
                  </>
                ) : (
                  <>
                    <InfoRow label={t.accountCode} value={account?.code || "-"} />
                    <InfoRow
                      label={t.accountName}
                      value={getAccountName(account, locale)}
                    />
                    <InfoRow
                      label={t.accountType}
                      value={getAccountTypeLabel(account?.account_type, locale)}
                    />
                    <InfoRow
                      label={t.normalBalance}
                      value={getNormalBalanceLabel(account?.normal_balance, locale)}
                    />
                    <InfoRow
                      label={t.groupAccount}
                      value={account?.is_group ? t.yes : t.no}
                    />
                    <InfoRow
                      label={t.status}
                      value={
                        <Badge
                          variant={account?.is_active ? "default" : "secondary"}
                          className="rounded-full"
                        >
                          {account?.is_active ? t.active : t.inactive}
                        </Badge>
                      }
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {loading ? (
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
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => (
                <MetricCard
                  key={card.title}
                  title={card.title}
                  value={card.value}
                  icon={card.icon}
                  money={card.money}
                />
              ))}
            </div>
          )}

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Filter className="h-4 w-4" />
                {t.filters}
              </CardTitle>
              <CardDescription>{t.filtersDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 lg:grid-cols-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.dateFrom}</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t.dateTo}</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t.pageSize}</label>
                <Input
                  type="number"
                  min={5}
                  max={100}
                  value={pageSize}
                  onChange={(event) =>
                    setPageSize(Math.max(5, Number(event.target.value) || 20))
                  }
                  className="h-10 rounded-xl"
                />
              </div>

              <label className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2">
                <Checkbox
                  checked={postedOnly}
                  onCheckedChange={(checked) => setPostedOnly(checked === true)}
                />
                <span className="text-sm">{t.postedOnly}</span>
              </label>

              <label className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2">
                <Checkbox
                  checked={includeOpening}
                  onCheckedChange={(checked) =>
                    setIncludeOpening(checked === true)
                  }
                />
                <span className="text-sm">{t.includeOpening}</span>
              </label>

              <div className="flex flex-wrap gap-2 lg:col-span-5">
                <Button
                  type="button"
                  className="h-10 rounded-xl"
                  onClick={() => loadAccountDetail(true)}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-4 w-4" />
                  )}
                  {t.applyFilters}
                </Button>

                {hasSearchOrFilter ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-xl"
                    onClick={clearFilters}
                  >
                    {t.clearFilters}
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

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
                  <div className="relative w-full sm:w-80">
                    <Search
                      className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${
                        isArabic ? "right-3" : "left-3"
                      }`}
                    />
                    <Input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder={t.searchPlaceholder}
                      className={`h-10 rounded-xl bg-background ${
                        isArabic ? "pr-9" : "pl-9"
                      }`}
                    />
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 rounded-xl"
                      >
                        <ColumnsIcon className="h-4 w-4" />
                        {t.columns}
                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                      align={isArabic ? "start" : "end"}
                      className="w-56 rounded-2xl"
                    >
                      <div dir={isArabic ? "rtl" : "ltr"}>
                        <DropdownMenuLabel>{t.columns}</DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        {columnOptions.map((column) => (
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
                        ))}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="overflow-hidden rounded-2xl border">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {visibleColumns.entry_date ? (
                          <TableHead>
                            <SortButton
                              label={t.entryDate}
                              sortKey="entry_date"
                              activeKey={sortKey}
                              direction={sortDirection}
                              onClick={() => toggleSort("entry_date")}
                            />
                          </TableHead>
                        ) : null}

                        {visibleColumns.journal_entry_number ? (
                          <TableHead>
                            <SortButton
                              label={t.journalNumber}
                              sortKey="journal_entry_number"
                              activeKey={sortKey}
                              direction={sortDirection}
                              onClick={() => toggleSort("journal_entry_number")}
                            />
                          </TableHead>
                        ) : null}

                        {visibleColumns.posting_source ? (
                          <TableHead>
                            <SortButton
                              label={t.source}
                              sortKey="posting_source"
                              activeKey={sortKey}
                              direction={sortDirection}
                              onClick={() => toggleSort("posting_source")}
                            />
                          </TableHead>
                        ) : null}

                        {visibleColumns.reference ? (
                          <TableHead>
                            <SortButton
                              label={t.reference}
                              sortKey="reference"
                              activeKey={sortKey}
                              direction={sortDirection}
                              onClick={() => toggleSort("reference")}
                            />
                          </TableHead>
                        ) : null}

                        {visibleColumns.description ? (
                          <TableHead>
                            <SortButton
                              label={t.description}
                              sortKey="description"
                              activeKey={sortKey}
                              direction={sortDirection}
                              onClick={() => toggleSort("description")}
                            />
                          </TableHead>
                        ) : null}

                        {visibleColumns.debit_amount ? (
                          <TableHead>
                            <SortButton
                              label={t.debit}
                              sortKey="debit_amount"
                              activeKey={sortKey}
                              direction={sortDirection}
                              onClick={() => toggleSort("debit_amount")}
                            />
                          </TableHead>
                        ) : null}

                        {visibleColumns.credit_amount ? (
                          <TableHead>
                            <SortButton
                              label={t.credit}
                              sortKey="credit_amount"
                              activeKey={sortKey}
                              direction={sortDirection}
                              onClick={() => toggleSort("credit_amount")}
                            />
                          </TableHead>
                        ) : null}

                        {visibleColumns.movement_amount ? (
                          <TableHead>
                            <SortButton
                              label={t.movement}
                              sortKey="movement_amount"
                              activeKey={sortKey}
                              direction={sortDirection}
                              onClick={() => toggleSort("movement_amount")}
                            />
                          </TableHead>
                        ) : null}

                        {visibleColumns.running_balance ? (
                          <TableHead>
                            <SortButton
                              label={t.runningBalance}
                              sortKey="running_balance"
                              activeKey={sortKey}
                              direction={sortDirection}
                              onClick={() => toggleSort("running_balance")}
                            />
                          </TableHead>
                        ) : null}

                        {visibleColumns.actions ? (
                          <TableHead>{t.action}</TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {loading ? (
                        <TableRowsSkeleton columnsCount={visibleColumnCount || 1} />
                      ) : paginatedRows.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={visibleColumnCount || 1}
                            className="h-40 text-center"
                          >
                            <div className="space-y-2">
                              <p className="font-semibold">
                                {hasSearchOrFilter
                                  ? t.noResultsTitle
                                  : t.emptyTitle}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {hasSearchOrFilter ? t.noResultsText : t.emptyDesc}
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
                      ) : (
                        paginatedRows.map((row) => (
                          <TableRow key={`${row.id}-${row.sort_order}`}>
                            {visibleColumns.entry_date ? (
                              <TableCell className="whitespace-nowrap">
                                {formatDate(row.entry_date, locale)}
                              </TableCell>
                            ) : null}

                            {visibleColumns.journal_entry_number ? (
                              <TableCell className="font-semibold">
                                {row.journal_entry_number || "-"}
                              </TableCell>
                            ) : null}

                            {visibleColumns.posting_source ? (
                              <TableCell>{row.posting_source || "-"}</TableCell>
                            ) : null}

                            {visibleColumns.reference ? (
                              <TableCell>{row.reference || "-"}</TableCell>
                            ) : null}

                            {visibleColumns.description ? (
                              <TableCell className="max-w-[280px]">
                                <span className="line-clamp-2 text-sm text-muted-foreground">
                                  {getDescription(row) || "-"}
                                </span>
                              </TableCell>
                            ) : null}

                            {visibleColumns.debit_amount ? (
                              <TableCell>
                                <MoneyValue value={row.debit_amount} />
                              </TableCell>
                            ) : null}

                            {visibleColumns.credit_amount ? (
                              <TableCell>
                                <MoneyValue value={row.credit_amount} />
                              </TableCell>
                            ) : null}

                            {visibleColumns.movement_amount ? (
                              <TableCell>
                                <MoneyValue value={row.movement_amount} />
                              </TableCell>
                            ) : null}

                            {visibleColumns.running_balance ? (
                              <TableCell>
                                <MoneyValue value={row.running_balance} />
                              </TableCell>
                            ) : null}

                            {visibleColumns.actions ? (
                              <TableCell>
                                {row.journal_entry_id ? (
                                  <Link
                                    href={`/system/accounting/journals/${row.journal_entry_id}`}
                                  >
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 rounded-xl"
                                    >
                                      {t.view}
                                    </Button>
                                  </Link>
                                ) : (
                                  <span className="text-sm text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            ) : null}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {t.showing} {formatNumber(paginatedRows.length)} {t.of}{" "}
                  {formatNumber(filteredRows.length)}
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-xl"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    {t.previous}
                  </Button>

                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    {formatNumber(Math.min(page, totalPages))} /{" "}
                    {formatNumber(totalPages)}
                  </Badge>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-xl"
                    disabled={page >= totalPages}
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
        </>
      ) : null}
    </div>
  );
}