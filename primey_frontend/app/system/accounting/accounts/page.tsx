"use client";

/* ============================================================
   📂 app/system/accounting/accounts/page.tsx
   🧠 Primey Care | Chart of Accounts

   ✅ المسار:
      app/system/accounting/accounts/page.tsx

   ✅ العمل:
      صفحة دليل الحسابات داخل مديول المحاسبة.
      تعرض شجرة الحسابات، الحسابات التجميعية، حسابات الترحيل، الحركات، والأرصدة.

   ✅ الإصدار:
      Phase 17 UX Refinement + Accounting Accounts Review

   ✅ يعتمد على:
      - /api/accounting/accounts/
      - /api/accounting/reports/trial-balance/ كـ fallback آمن
      - primey-locale
      - AuthProvider
      - sonner
      - /currency/sar.svg

   ✅ متوافق مع:
      - Accounting module approved pattern
      - Journals approved restored UI
      - Centers / Customers approved UX standard

   ✅ الوظائف:
      - عرض دليل الحسابات كشجرة.
      - فتح وطي الشجرة.
      - البحث في صف مستقل.
      - الفلاتر والأعمدة في صف منفصل.
      - فلترة حسب نوع الحساب وتصنيفه.
      - دعم الحسابات الصفرية والقيود المرحلة فقط.
      - عرض إجمالي المدين والدائن وصافي المدين والدائن.
      - Excel export بصيغة .xls HTML Workbook.
      - Web PDF Print.
      - Skeleton Loading.
      - Error State مستقل.
      - Empty State ذكي.
      - صلاحيات آمنة بدون كسر system_admin/superuser.
      - أرقام إنجليزية دائمًا.
      - رمز SAR من /currency/sar.svg بعد الرقم.

   ------------------------------------------------------------
   تحسينات هذا الإصدار:
      - الالتزام بالقاعدة: w-full space-y-4 بدون main/min-h-screen/max-w.
      - إزالة localhost و API_BASE_URL الثابت.
      - عدم فتح backend excel مباشرة، واستبداله بتصدير Excel HTML Workbook.
      - إضافة Error State داخل الصفحة بدل الاكتفاء بالتوست.
      - إضافة Print Web PDF.
      - الحفاظ على نفس روح التصميم السابق لدليل الحسابات.
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ColumnsIcon,
  Download,
  Filter,
  FolderTree,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

type AccountType =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "REVENUE"
  | "EXPENSE"
  | "UNKNOWN";

type AccountTypeFilter = "ALL" | AccountType;
type ClassFilter = "ALL" | "GROUP" | "POSTABLE";

type AccountNode = {
  account_id: number;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  normal_balance: string;
  parent_id: number | null;
  is_group: boolean;
  is_active: boolean;
  level: number;
  total_debit: number;
  total_credit: number;
  net_debit: number;
  net_credit: number;
  children: AccountNode[];
};

type FlatAccountRow = AccountNode & {
  path: string;
  has_children: boolean;
};

type TrialBalanceRow = {
  account_id?: number | string;
  id?: number | string;
  account_code?: string;
  code?: string;
  account_name?: string;
  name?: string;
  account_type?: string;
  type?: string;
  is_group?: boolean;
  total_debit?: string | number;
  total_credit?: string | number;
  net_debit?: string | number;
  net_credit?: string | number;
};

type AccountsPayload = {
  ok?: boolean;
  success?: boolean;
  message?: string;
  detail?: string;
  error?: string;
  data?: {
    currency?: string;
    total_accounts?: number;
    total_debit?: string | number;
    total_credit?: string | number;
    rows?: unknown[];
    results?: unknown[];
    accounts?: unknown[];
    tree?: unknown[];
  };
  currency?: string;
  total_accounts?: number;
  total_debit?: string | number;
  total_credit?: string | number;
  rows?: unknown[];
  results?: unknown[];
  accounts?: unknown[];
  tree?: unknown[];
};

type VisibleColumns = {
  accountCode: boolean;
  accountName: boolean;
  accountType: boolean;
  normalBalance: boolean;
  accountClass: boolean;
  totalDebit: boolean;
  totalCredit: boolean;
  netDebit: boolean;
  netCredit: boolean;
  actions: boolean;
};

type Summary = {
  totalAccounts: number;
  groupAccounts: number;
  postableAccounts: number;
  assetAccounts: number;
  liabilityAccounts: number;
  revenueAccounts: number;
  expenseAccounts: number;
  totalDebit: number;
  totalCredit: number;
  difference: number;
};

const CURRENCY_ICON_PATH = "/currency/sar.svg";
const PAGE_SIZE = 16;

const DEFAULT_COLUMNS: VisibleColumns = {
  accountCode: true,
  accountName: true,
  accountType: true,
  normalBalance: true,
  accountClass: true,
  totalDebit: true,
  totalCredit: true,
  netDebit: true,
  netCredit: true,
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

function apiUrl(path: string) {
  const base =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "";

  if (!base) return path;

  return `${base.replace(/\/$/, "")}${path}`;
}

function buildQuery(params: Record<string, string | boolean | number | null>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === "") return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();

  return query ? `?${query}` : "";
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
    title: isArabic ? "دليل الحسابات" : "Chart of Accounts",
    subtitle: isArabic
      ? "استعراض شجرة الحسابات المحاسبية حسب التصنيف والمستوى مع الأرصدة والحركات."
      : "Browse the accounting tree by class and level with balances and movements.",

    back: isArabic ? "لوحة المحاسبة" : "Accounting Overview",
    reports: isArabic ? "تقارير المحاسبة" : "Accounting Reports",
    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",

    statusTitle: isArabic ? "شجرة دليل الحسابات" : "Chart Tree Status",
    statusDesc: isArabic
      ? "عرض هرمي للحسابات التجميعية وحسابات الترحيل مع إجمالي المدين والدائن."
      : "Hierarchical view of group and postable accounts with debit and credit totals.",
    summaryTitle: isArabic ? "ملخص دليل الحسابات" : "Accounts Summary",
    summaryDesc: isArabic
      ? "أهم مؤشرات دليل الحسابات حسب البيانات المحاسبية الحالية."
      : "Key indicators for the current chart of accounts.",

    totalAccounts: isArabic ? "الحسابات" : "Accounts",
    groupAccounts: isArabic ? "حسابات تجميعية" : "Group Accounts",
    postableAccounts: isArabic ? "حسابات ترحيل" : "Postable Accounts",
    totalDebit: isArabic ? "إجمالي المدين" : "Total Debit",
    totalCredit: isArabic ? "إجمالي الدائن" : "Total Credit",
    netDebit: isArabic ? "صافي مدين" : "Net Debit",
    netCredit: isArabic ? "صافي دائن" : "Net Credit",
    difference: isArabic ? "الفرق" : "Difference",

    searchPlaceholder: isArabic
      ? "ابحث في شجرة الحسابات..."
      : "Search chart tree...",

    columns: isArabic ? "الأعمدة" : "Columns",
    filters: isArabic ? "الفلاتر" : "Filters",
    all: isArabic ? "الكل" : "All",
    includeZero: isArabic ? "إظهار الحسابات الصفرية" : "Include zero accounts",
    postedOnly: isArabic ? "القيود المرحلة فقط" : "Posted only",
    expandAll: isArabic ? "فتح الشجرة" : "Expand Tree",
    collapseAll: isArabic ? "طي الشجرة" : "Collapse Tree",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",

    dateFrom: isArabic ? "من تاريخ" : "Date From",
    dateTo: isArabic ? "إلى تاريخ" : "Date To",

    accountCode: isArabic ? "الكود" : "Code",
    accountName: isArabic ? "اسم الحساب" : "Account Name",
    accountType: isArabic ? "النوع" : "Type",
    normalBalance: isArabic ? "طبيعة الحساب" : "Normal Balance",
    accountClass: isArabic ? "التصنيف" : "Class",
    action: isArabic ? "الإجراء" : "Action",

    asset: isArabic ? "أصول" : "Assets",
    liability: isArabic ? "التزامات" : "Liabilities",
    equity: isArabic ? "حقوق ملكية" : "Equity",
    revenue: isArabic ? "إيرادات" : "Revenue",
    expense: isArabic ? "مصروفات" : "Expenses",
    unknown: isArabic ? "غير محدد" : "Unknown",

    group: isArabic ? "تجميعي" : "Group",
    postable: isArabic ? "قابل للترحيل" : "Postable",
    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",

    noRows: isArabic ? "لا توجد حسابات" : "No accounts found",
    noRowsDesc: isArabic
      ? "غيّر الفلاتر أو تأكد من زرع دليل الحسابات في النظام."
      : "Change filters or make sure the chart of accounts is seeded.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير البحث أو الفلاتر."
      : "Try changing the search or filters.",

    view: isArabic ? "عرض" : "View",
    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",
    showing: isArabic ? "عرض" : "Showing",
    from: isArabic ? "من" : "of",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض دليل الحسابات" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض دليل الحسابات. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view chart of accounts. Contact your system administrator if you need access.",

    loadSuccess: isArabic ? "تم تحديث دليل الحسابات" : "Accounts refreshed",
    loadError: isArabic ? "تعذر تحميل دليل الحسابات" : "Unable to load accounts",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    invalidDate: isArabic
      ? "لا يمكن أن يكون تاريخ البداية أكبر من تاريخ النهاية"
      : "Date from cannot be greater than date to",
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

function escapeHtml(value: string | number) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeAccountType(value: unknown): AccountType {
  const accountType = String(value || "").toUpperCase();

  if (accountType === "ASSET" || accountType === "ASSETS") return "ASSET";
  if (accountType === "LIABILITY" || accountType === "LIABILITIES") {
    return "LIABILITY";
  }
  if (accountType === "EQUITY") return "EQUITY";
  if (accountType === "REVENUE" || accountType === "INCOME") return "REVENUE";
  if (accountType === "EXPENSE" || accountType === "EXPENSES") {
    return "EXPENSE";
  }

  return "UNKNOWN";
}

function normalizeAccountNode(item: unknown): AccountNode {
  const row = asDict(item);
  const account = asDict(row.account || row.chart_account);

  const childrenSource =
    row.children && Array.isArray(row.children)
      ? row.children
      : row.items && Array.isArray(row.items)
        ? row.items
        : row.accounts && Array.isArray(row.accounts)
          ? row.accounts
          : [];

  const id = toNumber(
    row.account_id ||
      row.id ||
      row.pk ||
      account.id ||
      account.account_id ||
      Math.random(),
  );

  const totalDebit = toNumber(
    row.total_debit || row.debit || row.debit_amount || 0,
  );
  const totalCredit = toNumber(
    row.total_credit || row.credit || row.credit_amount || 0,
  );

  return {
    account_id: id,
    account_code: String(
      row.account_code || row.code || account.code || account.account_code || "-",
    ),
    account_name: String(
      row.account_name ||
        row.name ||
        row.name_ar ||
        account.name ||
        account.account_name ||
        "-",
    ),
    account_type: normalizeAccountType(
      row.account_type || row.type || account.account_type || account.type,
    ),
    normal_balance: String(
      row.normal_balance || account.normal_balance || "",
    ),
    parent_id:
      row.parent_id === null || row.parent_id === undefined
        ? null
        : toNumber(row.parent_id),
    is_group: Boolean(row.is_group ?? row.group ?? childrenSource.length > 0),
    is_active:
      row.is_active === undefined && row.active === undefined
        ? true
        : Boolean(row.is_active ?? row.active),
    level: toNumber(row.level || 0),
    total_debit: totalDebit,
    total_credit: totalCredit,
    net_debit: toNumber(row.net_debit || 0),
    net_credit: toNumber(row.net_credit || 0),
    children: childrenSource.map(normalizeAccountNode),
  };
}

function buildTreeFromFlatRows(rows: AccountNode[]): AccountNode[] {
  const byId = new Map<number, AccountNode>();
  const roots: AccountNode[] = [];

  rows.forEach((row) => {
    byId.set(row.account_id, { ...row, children: [] });
  });

  byId.forEach((row) => {
    if (row.parent_id && byId.has(row.parent_id)) {
      byId.get(row.parent_id)?.children.push(row);
    } else {
      roots.push(row);
    }
  });

  byId.forEach((row) => {
    row.children.sort((a, b) => a.account_code.localeCompare(b.account_code));
  });

  return roots.sort((a, b) => a.account_code.localeCompare(b.account_code));
}

function collectIds(nodes: AccountNode[]): number[] {
  return nodes.flatMap((node) => [node.account_id, ...collectIds(node.children)]);
}

function flattenAll(nodes: AccountNode[], parentPath = ""): FlatAccountRow[] {
  return nodes.flatMap((node) => {
    const path = parentPath
      ? `${parentPath} / ${node.account_code}`
      : node.account_code;

    return [
      {
        ...node,
        path,
        has_children: node.children.length > 0,
      },
      ...flattenAll(node.children, path),
    ];
  });
}

function matchesNode(
  node: AccountNode,
  keyword: string,
  accountTypeFilter: AccountTypeFilter,
  classFilter: ClassFilter,
) {
  const text = [
    node.account_code,
    node.account_name,
    node.account_type,
    node.normal_balance,
    node.total_debit,
    node.total_credit,
    node.net_debit,
    node.net_credit,
  ]
    .join(" ")
    .toLowerCase();

  const matchesSearch = keyword ? text.includes(keyword) : true;
  const matchesType =
    accountTypeFilter === "ALL" || node.account_type === accountTypeFilter;
  const matchesClass =
    classFilter === "ALL" ||
    (classFilter === "GROUP" && node.is_group) ||
    (classFilter === "POSTABLE" && !node.is_group);

  return matchesSearch && matchesType && matchesClass;
}

function flattenVisibleTree(
  nodes: AccountNode[],
  expanded: Record<number, boolean>,
  keyword: string,
  accountTypeFilter: AccountTypeFilter,
  classFilter: ClassFilter,
  parentPath = "",
): FlatAccountRow[] {
  const result: FlatAccountRow[] = [];

  nodes.forEach((node) => {
    const path = parentPath
      ? `${parentPath} / ${node.account_code}`
      : node.account_code;

    const childRows = flattenVisibleTree(
      node.children,
      expanded,
      keyword,
      accountTypeFilter,
      classFilter,
      path,
    );

    const nodeMatches = matchesNode(
      node,
      keyword,
      accountTypeFilter,
      classFilter,
    );
    const childMatches = childRows.length > 0;
    const forceExpandForSearch = keyword.length > 0;

    if (nodeMatches || childMatches) {
      result.push({
        ...node,
        path,
        has_children: node.children.length > 0,
      });
    }

    if ((expanded[node.account_id] || forceExpandForSearch || childMatches) && childRows.length > 0) {
      result.push(...childRows);
    }
  });

  return result;
}

function accountTypeLabel(type: AccountType, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<AccountType, string> = {
    ASSET: t.asset,
    LIABILITY: t.liability,
    EQUITY: t.equity,
    REVENUE: t.revenue,
    EXPENSE: t.expense,
    UNKNOWN: t.unknown,
  };

  return labels[type] || labels.UNKNOWN;
}

function accountTypeBadgeClass(type: AccountType) {
  if (type === "ASSET") {
    return "rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300";
  }

  if (type === "LIABILITY") {
    return "rounded-full border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-300";
  }

  if (type === "EQUITY") {
    return "rounded-full border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300";
  }

  if (type === "REVENUE") {
    return "rounded-full border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-50 dark:border-teal-900/40 dark:bg-teal-950/30 dark:text-teal-300";
  }

  if (type === "EXPENSE") {
    return "rounded-full border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300";
  }

  return "rounded-full border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300";
}

function extractRowsFromPayload(payload: AccountsPayload | null): unknown[] {
  if (!payload) return [];

  const data = payload.data || {};

  if (Array.isArray(data.tree)) return data.tree;
  if (Array.isArray(data.accounts)) return data.accounts;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.results)) return data.results;

  if (Array.isArray(payload.tree)) return payload.tree;
  if (Array.isArray(payload.accounts)) return payload.accounts;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.results)) return payload.results;

  return [];
}

function normalizeFromTrialBalance(payload: AccountsPayload | null) {
  const data = payload?.data || payload || {};
  const rows = extractRowsFromPayload(payload) as TrialBalanceRow[];

  const normalizedRows = rows.map((row) =>
    normalizeAccountNode({
      account_id: row.account_id || row.id,
      account_code: row.account_code || row.code,
      account_name: row.account_name || row.name,
      account_type: row.account_type || row.type,
      parent_id: null,
      is_group: Boolean(row.is_group),
      is_active: true,
      total_debit: row.total_debit,
      total_credit: row.total_credit,
      net_debit: row.net_debit,
      net_credit: row.net_credit,
    }),
  );

  return {
    currency: String(data.currency || "SAR"),
    totalAccounts: toNumber(data.total_accounts) || normalizedRows.length,
    totalDebit: toNumber(data.total_debit),
    totalCredit: toNumber(data.total_credit),
    tree: buildTreeFromFlatRows(normalizedRows),
  };
}

function normalizeAccountsPayload(payload: AccountsPayload | null) {
  const data = payload?.data || payload || {};
  const sourceRows = extractRowsFromPayload(payload);
  const normalizedRows = sourceRows.map(normalizeAccountNode);
  const hasNested = normalizedRows.some((row) => row.children.length > 0);

  return {
    currency: String(data.currency || "SAR"),
    totalAccounts: toNumber(data.total_accounts) || normalizedRows.length,
    totalDebit: toNumber(data.total_debit),
    totalCredit: toNumber(data.total_credit),
    tree: hasNested ? normalizedRows : buildTreeFromFlatRows(normalizedRows),
  };
}

function SarIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <Image
      src={CURRENCY_ICON_PATH}
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

function TableSkeleton({ columnsCount }: { columnsCount: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columnsCount }).map((__, columnIndex) => (
            <TableCell key={columnIndex}>
              <SkeletonLine
                className={
                  columnIndex === 1
                    ? "h-8 w-56 rounded-lg"
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

function KpiCardSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <SkeletonLine className="h-8 w-28" />
                <SkeletonLine className="h-4 w-24" />
              </div>
              <SkeletonLine className="h-11 w-11 rounded-2xl" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
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
            ${locale === "ar" ? "ملخص دليل الحسابات" : "Chart Summary"}
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
  rows,
  summary,
  t,
}: {
  locale: AppLocale;
  title: string;
  rows: FlatAccountRow[];
  summary: Summary;
  t: ReturnType<typeof dictionary>;
}) {
  const isArabic = locale === "ar";
  const now = new Date().toLocaleString("en-US");

  const tableRows = rows
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.account_code)}</td>
          <td>${escapeHtml(item.account_name)}</td>
          <td>${escapeHtml(accountTypeLabel(item.account_type, locale))}</td>
          <td>${escapeHtml(item.is_group ? t.group : t.postable)}</td>
          <td>${escapeHtml(formatMoney(item.total_debit))}</td>
          <td>${escapeHtml(formatMoney(item.total_credit))}</td>
          <td>${escapeHtml(formatMoney(item.net_debit))}</td>
          <td>${escapeHtml(formatMoney(item.net_credit))}</td>
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
              <div>${escapeHtml(t.printedAt)}: ${escapeHtml(now)}</div>
              <div>${escapeHtml(t.rowsCount)}: ${formatNumber(rows.length)}</div>
            </div>
          </div>
          <div class="badge">Primey Care</div>
        </div>

        <div class="summary-grid">
          <div class="summary-card"><span>${escapeHtml(t.totalAccounts)}</span><strong>${formatNumber(summary.totalAccounts)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.totalDebit)}</span><strong>${formatMoney(summary.totalDebit)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.totalCredit)}</span><strong>${formatMoney(summary.totalCredit)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.difference)}</span><strong>${formatMoney(summary.difference)}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${escapeHtml(t.accountCode)}</th>
              <th>${escapeHtml(t.accountName)}</th>
              <th>${escapeHtml(t.accountType)}</th>
              <th>${escapeHtml(t.accountClass)}</th>
              <th>${escapeHtml(t.totalDebit)}</th>
              <th>${escapeHtml(t.totalCredit)}</th>
              <th>${escapeHtml(t.netDebit)}</th>
              <th>${escapeHtml(t.netCredit)}</th>
            </tr>
          </thead>
          <tbody>
            ${
              tableRows ||
              `<tr><td colspan="9" style="text-align:center">${escapeHtml(t.noRows)}</td></tr>`
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

export default function ChartOfAccountsTreePage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [tree, setTree] = useState<AccountNode[]>([]);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] =
    useState<AccountTypeFilter>("ALL");
  const [classFilter, setClassFilter] = useState<ClassFilter>("ALL");
  const [includeZeroAccounts, setIncludeZeroAccounts] = useState(true);
  const [postedOnly, setPostedOnly] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [page, setPage] = useState(1);
  const [visibleColumns, setVisibleColumns] =
    useState<VisibleColumns>(DEFAULT_COLUMNS);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const ChevronIcon = isArabic ? ChevronLeft : ChevronRight;
  const authResolving = isAuthResolving(auth);

  const canView = hasSafePermission(
    auth,
    ["accounting.view", "accounting.accounts.view"],
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

  const allRows = useMemo(() => flattenAll(tree), [tree]);

  const filteredRows = useMemo(() => {
    return flattenVisibleTree(
      tree,
      expanded,
      searchTerm.trim().toLowerCase(),
      accountTypeFilter,
      classFilter,
    );
  }, [accountTypeFilter, classFilter, expanded, searchTerm, tree]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  const paginatedRows = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * PAGE_SIZE;

    return filteredRows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredRows, page, totalPages]);

  const visibleColumnCount = Object.values(visibleColumns).filter(Boolean).length;

  const summary = useMemo<Summary>(() => {
    const debit =
      totalDebit || allRows.reduce((sum, item) => sum + item.total_debit, 0);
    const credit =
      totalCredit || allRows.reduce((sum, item) => sum + item.total_credit, 0);

    return {
      totalAccounts: allRows.length,
      totalDebit: debit,
      totalCredit: credit,
      difference: Math.abs(debit - credit),
      groupAccounts: allRows.filter((row) => row.is_group).length,
      postableAccounts: allRows.filter((row) => !row.is_group).length,
      assetAccounts: allRows.filter((row) => row.account_type === "ASSET")
        .length,
      liabilityAccounts: allRows.filter(
        (row) => row.account_type === "LIABILITY",
      ).length,
      revenueAccounts: allRows.filter((row) => row.account_type === "REVENUE")
        .length,
      expenseAccounts: allRows.filter((row) => row.account_type === "EXPENSE")
        .length,
    };
  }, [allRows, totalCredit, totalDebit]);

  const hasSearchOrFilter =
    searchTerm.trim().length > 0 ||
    accountTypeFilter !== "ALL" ||
    classFilter !== "ALL" ||
    !includeZeroAccounts ||
    !postedOnly ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const columnOptions: Array<{
    key: keyof VisibleColumns;
    label: string;
  }> = [
    { key: "accountCode", label: t.accountCode },
    { key: "accountName", label: t.accountName },
    { key: "accountType", label: t.accountType },
    { key: "normalBalance", label: t.normalBalance },
    { key: "accountClass", label: t.accountClass },
    { key: "totalDebit", label: t.totalDebit },
    { key: "totalCredit", label: t.totalCredit },
    { key: "netDebit", label: t.netDebit },
    { key: "netCredit", label: t.netCredit },
    { key: "actions", label: t.action },
  ];

  const loadAccounts = useCallback(
    async (showToast = false) => {
      if (!canView) {
        setTree([]);
        setTotalDebit(0);
        setTotalCredit(0);
        setIsLoading(false);
        return;
      }

      if (dateFrom && dateTo && dateFrom > dateTo) {
        toast.error(t.invalidDate);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");

        const query = buildQuery({
          date_from: dateFrom || null,
          date_to: dateTo || null,
          include_zero_accounts: includeZeroAccounts,
          posted_only: postedOnly,
          page_size: 500,
        });

        const endpoints = [
          `/api/accounting/accounts/${query}`,
          `/api/accounting/accounts/tree/${query}`,
          `/api/accounting/reports/trial-balance/${buildQuery({
            date_from: dateFrom || null,
            date_to: dateTo || null,
            include_zero_accounts: includeZeroAccounts,
            posted_only: postedOnly,
          })}`,
        ];

        let loadedPayload: AccountsPayload | null = null;
        let loadedFromTrialBalance = false;
        let loaded = false;
        let lastError = "";

        for (const endpoint of endpoints) {
          const response = await fetch(apiUrl(endpoint), {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: { Accept: "application/json" },
          });

          const payload = (await response.json().catch(() => null)) as
            | AccountsPayload
            | null;

          if ([400, 404, 405].includes(response.status)) {
            lastError =
              payload?.message ||
              payload?.detail ||
              payload?.error ||
              `HTTP ${response.status}`;
            continue;
          }

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

          loadedPayload = payload;
          loadedFromTrialBalance = endpoint.includes("trial-balance");
          loaded = true;
          break;
        }

        if (!loaded || !loadedPayload) {
          throw new Error(lastError || t.loadError);
        }

        const normalized = loadedFromTrialBalance
          ? normalizeFromTrialBalance(loadedPayload)
          : normalizeAccountsPayload(loadedPayload);

        setTree(normalized.tree);
        setTotalDebit(normalized.totalDebit);
        setTotalCredit(normalized.totalCredit);

        const rootExpanded: Record<number, boolean> = {};
        normalized.tree.forEach((node) => {
          rootExpanded[node.account_id] = true;
        });
        setExpanded((current) =>
          Object.keys(current).length > 0 ? current : rootExpanded,
        );

        if (showToast) {
          toast.success(t.loadSuccess);
        }
      } catch (error) {
        console.error("Accounts load error:", error);
        setTree([]);
        setTotalDebit(0);
        setTotalCredit(0);
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [
      canView,
      dateFrom,
      dateTo,
      includeZeroAccounts,
      postedOnly,
      t.invalidDate,
      t.loadError,
      t.loadSuccess,
    ],
  );

  function clearFilters() {
    setSearchTerm("");
    setAccountTypeFilter("ALL");
    setClassFilter("ALL");
    setIncludeZeroAccounts(true);
    setPostedOnly(true);
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  function toggleNode(id: number) {
    setExpanded((current) => ({
      ...current,
      [id]: !current[id],
    }));
  }

  function expandAll() {
    const allIds = collectIds(tree);
    const nextExpanded: Record<number, boolean> = {};

    allIds.forEach((id) => {
      nextExpanded[id] = true;
    });

    setExpanded(nextExpanded);
  }

  function collapseAll() {
    setExpanded({});
  }

  function exportExcel() {
    if (!canExport) return;

    if (filteredRows.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const generatedAt = new Date();

    downloadExcel({
      filename: `primey-care-chart-of-accounts-${generatedAt
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "دليل الحسابات" : "Chart of Accounts",
      title: t.title,
      locale,
      summaryRows: [
        [t.generatedAt, generatedAt.toLocaleString("en-US")],
        [t.totalAccounts, summary.totalAccounts],
        [t.groupAccounts, summary.groupAccounts],
        [t.postableAccounts, summary.postableAccounts],
        [t.totalDebit, formatMoney(summary.totalDebit)],
        [t.totalCredit, formatMoney(summary.totalCredit)],
        [t.difference, formatMoney(summary.difference)],
      ],
      headers: [
        "ID",
        t.accountCode,
        t.accountName,
        t.accountType,
        t.normalBalance,
        t.accountClass,
        t.totalDebit,
        t.totalCredit,
        t.netDebit,
        t.netCredit,
        "Path",
      ],
      rows: filteredRows.map((row) => [
        row.account_id,
        row.account_code,
        row.account_name,
        accountTypeLabel(row.account_type, locale),
        row.normal_balance || "-",
        row.is_group ? t.group : t.postable,
        formatMoney(row.total_debit),
        formatMoney(row.total_credit),
        formatMoney(row.net_debit),
        formatMoney(row.net_credit),
        row.path,
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
        rows: filteredRows,
        summary,
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
    loadAccounts(false);
  }, [authResolving, loadAccounts]);

  useEffect(() => {
    setPage(1);
  }, [
    searchTerm,
    accountTypeFilter,
    classFilter,
    includeZeroAccounts,
    postedOnly,
    dateFrom,
    dateTo,
  ]);

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
          <Link href="/system/accounting">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>

          <Link href="/system/reports/accounting">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <BarChart3 className="h-4 w-4" />
              <span>{t.reports}</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadAccounts(true)}
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
              disabled={isLoading || filteredRows.length === 0 || Boolean(errorMessage)}
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
              disabled={isLoading || filteredRows.length === 0 || Boolean(errorMessage)}
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
                  {t.loadErrorHint}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => loadAccounts(true)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!errorMessage ? (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
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
                    variant="outline"
                    className="h-10 rounded-xl"
                    onClick={exportExcel}
                    disabled={isLoading || filteredRows.length === 0}
                  >
                    <Download className="h-4 w-4" />
                    {t.exportExcel}
                  </Button>
                ) : null}
              </CardHeader>

              <CardContent className="space-y-4">
                {isLoading ? (
                  <KpiCardSkeleton />
                ) : (
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border bg-background p-4">
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FolderTree className="h-3.5 w-3.5" />
                        {t.totalAccounts}
                      </p>
                      <div className="mt-3 text-2xl font-bold">
                        {formatNumber(summary.totalAccounts)}
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-slate-950 dark:bg-slate-200" />
                    </div>

                    <div className="rounded-2xl border bg-background p-4">
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <TrendingUp className="h-3.5 w-3.5" />
                        {t.totalDebit}
                      </p>
                      <div className="mt-3 text-2xl font-bold">
                        <MoneyText value={summary.totalDebit} />
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-emerald-500" />
                    </div>

                    <div className="rounded-2xl border bg-background p-4">
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <TrendingDown className="h-3.5 w-3.5" />
                        {t.totalCredit}
                      </p>
                      <div className="mt-3 text-2xl font-bold">
                        <MoneyText value={summary.totalCredit} />
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-sky-500" />
                    </div>

                    <div className="rounded-2xl border bg-background p-4">
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {t.difference}
                      </p>
                      <div className="mt-3 text-2xl font-bold">
                        <MoneyText value={summary.difference} />
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-violet-500" />
                    </div>
                  </div>
                )}

                <div className="relative w-full">
                  <Search
                    className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${
                      isArabic ? "right-3" : "left-3"
                    }`}
                  />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
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
                        className="w-72 rounded-2xl"
                      >
                        <div dir={isArabic ? "rtl" : "ltr"}>
                          <DropdownMenuLabel>{t.filters}</DropdownMenuLabel>
                          <DropdownMenuSeparator />

                          <div className="space-y-3 p-2">
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">
                                {t.dateFrom}
                              </label>
                              <Input
                                type="date"
                                value={dateFrom}
                                onChange={(event) =>
                                  setDateFrom(event.target.value)
                                }
                                className="h-9 rounded-xl"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">
                                {t.dateTo}
                              </label>
                              <Input
                                type="date"
                                value={dateTo}
                                onChange={(event) =>
                                  setDateTo(event.target.value)
                                }
                                className="h-9 rounded-xl"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              {(
                                [
                                  "ALL",
                                  "ASSET",
                                  "LIABILITY",
                                  "EQUITY",
                                  "REVENUE",
                                  "EXPENSE",
                                ] as AccountTypeFilter[]
                              ).map((type) => (
                                <Button
                                  key={type}
                                  type="button"
                                  variant={
                                    accountTypeFilter === type
                                      ? "default"
                                      : "outline"
                                  }
                                  size="sm"
                                  className="rounded-xl"
                                  onClick={() => setAccountTypeFilter(type)}
                                >
                                  {type === "ALL"
                                    ? t.all
                                    : accountTypeLabel(type, locale)}
                                </Button>
                              ))}
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              {(["ALL", "GROUP", "POSTABLE"] as ClassFilter[]).map(
                                (filter) => (
                                  <Button
                                    key={filter}
                                    type="button"
                                    variant={
                                      classFilter === filter
                                        ? "default"
                                        : "outline"
                                    }
                                    size="sm"
                                    className="rounded-xl"
                                    onClick={() => setClassFilter(filter)}
                                  >
                                    {filter === "ALL"
                                      ? t.all
                                      : filter === "GROUP"
                                        ? t.group
                                        : t.postable}
                                  </Button>
                                ),
                              )}
                            </div>

                            <label className="flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm">
                              <Checkbox
                                checked={includeZeroAccounts}
                                onCheckedChange={(checked) =>
                                  setIncludeZeroAccounts(Boolean(checked))
                                }
                              />
                              <span>{t.includeZero}</span>
                            </label>

                            <label className="flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm">
                              <Checkbox
                                checked={postedOnly}
                                onCheckedChange={(checked) =>
                                  setPostedOnly(Boolean(checked))
                                }
                              />
                              <span>{t.postedOnly}</span>
                            </label>

                            <Button
                              type="button"
                              className="w-full rounded-xl"
                              onClick={() => loadAccounts(true)}
                              disabled={isLoading}
                            >
                              {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCcw className="h-4 w-4" />
                              )}
                              {t.refresh}
                            </Button>
                          </div>
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-10 rounded-xl">
                          <ColumnsIcon className="h-4 w-4" />
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

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="h-10 rounded-xl"
                      onClick={expandAll}
                    >
                      {t.expandAll}
                    </Button>

                    <Button
                      variant="outline"
                      className="h-10 rounded-xl"
                      onClick={collapseAll}
                    >
                      {t.collapseAll}
                    </Button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {visibleColumns.accountCode ? (
                            <TableHead className="min-w-[110px]">
                              {t.accountCode}
                            </TableHead>
                          ) : null}

                          {visibleColumns.accountName ? (
                            <TableHead className="min-w-[260px]">
                              {t.accountName}
                            </TableHead>
                          ) : null}

                          {visibleColumns.accountType ? (
                            <TableHead className="min-w-[120px]">
                              {t.accountType}
                            </TableHead>
                          ) : null}

                          {visibleColumns.normalBalance ? (
                            <TableHead className="min-w-[130px]">
                              {t.normalBalance}
                            </TableHead>
                          ) : null}

                          {visibleColumns.accountClass ? (
                            <TableHead className="min-w-[120px]">
                              {t.accountClass}
                            </TableHead>
                          ) : null}

                          {visibleColumns.totalDebit ? (
                            <TableHead className="min-w-[140px]">
                              {t.totalDebit}
                            </TableHead>
                          ) : null}

                          {visibleColumns.totalCredit ? (
                            <TableHead className="min-w-[140px]">
                              {t.totalCredit}
                            </TableHead>
                          ) : null}

                          {visibleColumns.netDebit ? (
                            <TableHead className="min-w-[130px]">
                              {t.netDebit}
                            </TableHead>
                          ) : null}

                          {visibleColumns.netCredit ? (
                            <TableHead className="min-w-[130px]">
                              {t.netCredit}
                            </TableHead>
                          ) : null}

                          {visibleColumns.actions ? (
                            <TableHead className="min-w-[100px]">
                              {t.action}
                            </TableHead>
                          ) : null}
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {isLoading ? (
                          <TableSkeleton columnsCount={visibleColumnCount || 1} />
                        ) : paginatedRows.length > 0 ? (
                          paginatedRows.map((row) => {
                            const isExpanded = expanded[row.account_id];
                            const padding = Math.min(
                              row.path.split("/").length,
                              6,
                            );

                            return (
                              <TableRow key={`${row.account_id}-${row.path}`}>
                                {visibleColumns.accountCode ? (
                                  <TableCell className="font-semibold">
                                    <span dir="ltr">{row.account_code}</span>
                                  </TableCell>
                                ) : null}

                                {visibleColumns.accountName ? (
                                  <TableCell>
                                    <div
                                      className="flex items-center gap-2"
                                      style={{
                                        paddingInlineStart: `${(padding - 1) * 16}px`,
                                      }}
                                    >
                                      {row.has_children ? (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 rounded-lg"
                                          onClick={() => toggleNode(row.account_id)}
                                        >
                                          {isExpanded ? (
                                            <ChevronDown className="h-4 w-4" />
                                          ) : (
                                            <ChevronIcon className="h-4 w-4" />
                                          )}
                                        </Button>
                                      ) : (
                                        <span className="h-7 w-7" />
                                      )}

                                      <div className="min-w-0">
                                        <div className="truncate font-medium">
                                          {row.account_name}
                                        </div>
                                        <div className="mt-1 truncate text-xs text-muted-foreground">
                                          {row.path}
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>
                                ) : null}

                                {visibleColumns.accountType ? (
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={accountTypeBadgeClass(
                                        row.account_type,
                                      )}
                                    >
                                      {accountTypeLabel(row.account_type, locale)}
                                    </Badge>
                                  </TableCell>
                                ) : null}

                                {visibleColumns.normalBalance ? (
                                  <TableCell>{row.normal_balance || "-"}</TableCell>
                                ) : null}

                                {visibleColumns.accountClass ? (
                                  <TableCell>
                                    <Badge
                                      variant={row.is_group ? "secondary" : "outline"}
                                      className="rounded-full"
                                    >
                                      {row.is_group ? t.group : t.postable}
                                    </Badge>
                                  </TableCell>
                                ) : null}

                                {visibleColumns.totalDebit ? (
                                  <TableCell>
                                    <MoneyText value={row.total_debit} />
                                  </TableCell>
                                ) : null}

                                {visibleColumns.totalCredit ? (
                                  <TableCell>
                                    <MoneyText value={row.total_credit} />
                                  </TableCell>
                                ) : null}

                                {visibleColumns.netDebit ? (
                                  <TableCell>
                                    <MoneyText value={row.net_debit} />
                                  </TableCell>
                                ) : null}

                                {visibleColumns.netCredit ? (
                                  <TableCell>
                                    <MoneyText value={row.net_credit} />
                                  </TableCell>
                                ) : null}

                                {visibleColumns.actions ? (
                                  <TableCell>
                                    <Link
                                      href={`/system/accounting/accounts/${row.account_id}`}
                                    >
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 rounded-lg px-3"
                                      >
                                        {t.view}
                                      </Button>
                                    </Link>
                                  </TableCell>
                                ) : null}
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={visibleColumnCount || 1}
                              className="h-44 text-center"
                            >
                              <div className="flex flex-col items-center justify-center gap-2">
                                <FolderTree className="h-10 w-10 text-muted-foreground/40" />
                                <p className="font-semibold">
                                  {hasSearchOrFilter ? t.noResultsTitle : t.noRows}
                                </p>
                                <p className="max-w-md text-sm text-muted-foreground">
                                  {hasSearchOrFilter ? t.noResultsText : t.noRowsDesc}
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
                      {formatNumber(page)} / {formatNumber(totalPages)}
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

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <FileSummaryIcon />
                  {t.summaryTitle}
                </CardTitle>
                <CardDescription>{t.summaryDesc}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="rounded-2xl border bg-background p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950">
                      <FolderTree className="h-5 w-5" />
                    </div>

                    <div>
                      <p className="text-sm font-semibold">{t.totalAccounts}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(summary.totalAccounts)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">
                      {t.groupAccounts}
                    </p>
                    <div className="mt-2 text-lg font-bold">
                      {formatNumber(summary.groupAccounts)}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">
                      {t.postableAccounts}
                    </p>
                    <div className="mt-2 text-lg font-bold">
                      {formatNumber(summary.postableAccounts)}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">{t.asset}</p>
                    <div className="mt-2 text-lg font-bold">
                      {formatNumber(summary.assetAccounts)}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">
                      {t.liability}
                    </p>
                    <div className="mt-2 text-lg font-bold">
                      {formatNumber(summary.liabilityAccounts)}
                    </div>
                  </div>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-3 py-2 text-sm">
                    <span>{t.revenue}</span>
                    <span>{formatNumber(summary.revenueAccounts)}</span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
                    <span>{t.expense}</span>
                    <span>{formatNumber(summary.expenseAccounts)}</span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
                    <span>{t.difference}</span>
                    <span className="inline-flex items-center gap-1">
                      {formatMoney(summary.difference)}
                      <SarIcon className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {isLoading ? (
            <KpiCardSkeleton />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-2xl font-bold">
                        {formatNumber(summary.groupAccounts)}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t.groupAccounts}
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                      <Layers3 className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-2xl font-bold">
                        {formatNumber(summary.postableAccounts)}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t.postableAccounts}
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
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
                        {formatNumber(summary.assetAccounts)}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t.asset}
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-2xl font-bold">
                        {formatNumber(summary.liabilityAccounts)}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t.liability}
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300">
                      <WalletCards className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function FileSummaryIcon() {
  return <BarChart3 className="h-4 w-4" />;
}