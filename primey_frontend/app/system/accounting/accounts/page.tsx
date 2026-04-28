"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  RefreshCcw,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

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
   📂 app/system/accounting/accounts/page.tsx
   🧠 Primey Care | Chart of Accounts Tree
   ------------------------------------------------------------
   ✅ صفحة دليل الحسابات كشجرة محاسبية
   ✅ نفس هوية صفحات المراكز / المحاسبة
   ✅ يدعم API دليل الحسابات إذا وجد
   ✅ fallback من ميزان المراجعة إذا API الشجرة غير جاهز
   ✅ بحث + فلاتر + أعمدة + فتح/طي الشجرة
   ✅ تصدير Excel
   ✅ دعم عربي / إنجليزي
   ✅ أرقام إنجليزية دائمًا
   ✅ رمز العملة الرسمي
============================================================ */

type AppLocale = "ar" | "en";

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
  normal_balance: string | null;
  parent_id: number | null;
  is_group: boolean;
  is_active: boolean;
  level: number;
  total_debit: string;
  total_credit: string;
  net_debit: string;
  net_credit: string;
  children: AccountNode[];
};

type FlatAccountRow = AccountNode & {
  path: string;
  has_children: boolean;
};

type TrialBalanceRow = {
  account_id: number;
  account_code: string;
  account_name: string;
  account_type: string;
  is_group?: boolean;
  total_debit: string;
  total_credit: string;
  net_debit: string;
  net_credit: string;
};

type TrialBalancePayload = {
  currency: string;
  date_from: string | null;
  date_to: string | null;
  total_accounts: number;
  total_debit: string;
  total_credit: string;
  rows: TrialBalanceRow[];
};

type AccountsTreePayload = {
  currency?: string;
  total_accounts?: number;
  total_debit?: string;
  total_credit?: string;
  rows?: unknown[];
  results?: unknown[];
  accounts?: unknown[];
  tree?: unknown[];
};

type ApiEnvelope<T> = {
  ok?: boolean;
  report_code?: string;
  data?: T;
  results?: unknown[];
  message?: string;
};

type VisibleColumns = {
  account_code: boolean;
  account_name: boolean;
  account_type: boolean;
  normal_balance: boolean;
  account_class: boolean;
  total_debit: boolean;
  total_credit: boolean;
  net_debit: boolean;
  net_credit: boolean;
  actions: boolean;
};

const CURRENCY_ICON_PATH = "/currency/sar.svg";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

/* ============================================================
   Locale
============================================================ */

function readLocale(): AppLocale {
  try {
    if (typeof window === "undefined") return "ar";

    const savedLocale = window.localStorage.getItem("primey-locale");
    if (savedLocale === "en") return "en";
    if (savedLocale === "ar") return "ar";

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
  } catch {
    // ignore
  }
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

function getApiUrl(path: string): string {
  const cleanBase = API_BASE_URL.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

function buildQuery(
  params: Record<string, string | boolean | null | undefined>,
) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function normalizeAccountType(value: unknown): AccountType {
  const accountType = String(value || "").toUpperCase();

  if (accountType === "ASSET") return "ASSET";
  if (accountType === "LIABILITY") return "LIABILITY";
  if (accountType === "EQUITY") return "EQUITY";
  if (accountType === "REVENUE") return "REVENUE";
  if (accountType === "EXPENSE") return "EXPENSE";

  return "UNKNOWN";
}

function normalizeAccountNode(item: unknown): AccountNode {
  const row = (item || {}) as Record<string, unknown>;

  const id = Number(row.account_id ?? row.id ?? 0);

  const childrenSource =
    row.children && Array.isArray(row.children)
      ? row.children
      : row.items && Array.isArray(row.items)
        ? row.items
        : [];

  return {
    account_id: id,
    account_code: String(row.account_code ?? row.code ?? "-"),
    account_name: String(row.account_name ?? row.name ?? row.name_ar ?? "-"),
    account_type: normalizeAccountType(row.account_type ?? row.type),
    normal_balance: row.normal_balance ? String(row.normal_balance) : null,
    parent_id:
      row.parent_id === null || row.parent_id === undefined
        ? null
        : Number(row.parent_id),
    is_group: Boolean(row.is_group ?? childrenSource.length > 0),
    is_active: row.is_active === undefined ? true : Boolean(row.is_active),
    level: Number(row.level ?? 0),
    total_debit: String(row.total_debit ?? row.debit ?? "0.00"),
    total_credit: String(row.total_credit ?? row.credit ?? "0.00"),
    net_debit: String(row.net_debit ?? "0.00"),
    net_credit: String(row.net_credit ?? "0.00"),
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

  return roots.sort((a, b) => a.account_code.localeCompare(b.account_code));
}

function flattenTree(
  nodes: AccountNode[],
  expanded: Record<number, boolean>,
  keyword: string,
  accountTypeFilter: AccountTypeFilter,
  classFilter: ClassFilter,
  parentPath = "",
  forcedVisible = false,
): FlatAccountRow[] {
  const result: FlatAccountRow[] = [];

  nodes.forEach((node) => {
    const path = parentPath
      ? `${parentPath} / ${node.account_code}`
      : node.account_code;

    const nodeText = [
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

    const matchesSearch = keyword ? nodeText.includes(keyword) : true;
    const matchesType =
      accountTypeFilter === "ALL" || node.account_type === accountTypeFilter;

    const matchesClass =
      classFilter === "ALL" ||
      (classFilter === "GROUP" && node.is_group) ||
      (classFilter === "POSTABLE" && !node.is_group);

    const childRows = flattenTree(
      node.children,
      expanded,
      keyword,
      accountTypeFilter,
      classFilter,
      path,
      forcedVisible || matchesSearch,
    );

    const childMatched = childRows.length > 0;
    const shouldShow =
      (matchesSearch || childMatched || forcedVisible) &&
      matchesType &&
      matchesClass;

    if (shouldShow) {
      result.push({
        ...node,
        path,
        has_children: node.children.length > 0,
      });
    }

    const shouldExpand =
      keyword.length > 0 || expanded[node.account_id] || forcedVisible;

    if (shouldExpand) {
      result.push(...childRows);
    }
  });

  return result;
}

function collectIds(nodes: AccountNode[]): number[] {
  return nodes.flatMap((node) => [node.account_id, ...collectIds(node.children)]);
}

function buildTrialBalancePath({
  dateFrom,
  dateTo,
  includeZeroAccounts,
  postedOnly,
  excel = false,
}: {
  dateFrom: string;
  dateTo: string;
  includeZeroAccounts: boolean;
  postedOnly: boolean;
  excel?: boolean;
}) {
  const basePath = excel
    ? "/api/accounting/reports/trial-balance/excel/"
    : "/api/accounting/reports/trial-balance/";

  return `${basePath}${buildQuery({
    date_from: dateFrom || null,
    date_to: dateTo || null,
    include_zero_accounts: includeZeroAccounts,
    posted_only: postedOnly,
  })}`;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(getApiUrl(path), {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchAccountsTree({
  dateFrom,
  dateTo,
  includeZeroAccounts,
  postedOnly,
}: {
  dateFrom: string;
  dateTo: string;
  includeZeroAccounts: boolean;
  postedOnly: boolean;
}) {
  const treePath = `/api/accounting/accounts/${buildQuery({
    date_from: dateFrom || null,
    date_to: dateTo || null,
    include_zero_accounts: includeZeroAccounts,
    posted_only: postedOnly,
  })}`;

  try {
    const payload = await fetchJson<ApiEnvelope<AccountsTreePayload>>(treePath);

    const data = payload.data || (payload as unknown as AccountsTreePayload);

    const sourceRows =
      (Array.isArray(data.tree) && data.tree) ||
      (Array.isArray(data.accounts) && data.accounts) ||
      (Array.isArray(data.rows) && data.rows) ||
      (Array.isArray(data.results) && data.results) ||
      (Array.isArray(payload.results) && payload.results) ||
      [];

    if (sourceRows.length > 0) {
      const normalizedRows = sourceRows.map(normalizeAccountNode);
      const hasNested = normalizedRows.some((row) => row.children.length > 0);
      const tree = hasNested
        ? normalizedRows
        : buildTreeFromFlatRows(normalizedRows);

      return {
        currency: data.currency || "SAR",
        total_accounts: Number(data.total_accounts || normalizedRows.length),
        total_debit: String(data.total_debit || "0.00"),
        total_credit: String(data.total_credit || "0.00"),
        tree,
      };
    }
  } catch (error) {
    console.warn("Accounts tree API unavailable, fallback to trial balance:", error);
  }

  const trialPayload = await fetchJson<ApiEnvelope<TrialBalancePayload>>(
    buildTrialBalancePath({
      dateFrom,
      dateTo,
      includeZeroAccounts,
      postedOnly,
    }),
  );

  if (!trialPayload.data) {
    throw new Error("Trial balance response does not contain data");
  }

  const rows = Array.isArray(trialPayload.data.rows)
    ? trialPayload.data.rows.map((row) =>
        normalizeAccountNode({
          account_id: row.account_id,
          account_code: row.account_code,
          account_name: row.account_name,
          account_type: row.account_type,
          parent_id: null,
          is_group: Boolean(row.is_group),
          is_active: true,
          total_debit: row.total_debit,
          total_credit: row.total_credit,
          net_debit: row.net_debit,
          net_credit: row.net_credit,
        }),
      )
    : [];

  return {
    currency: trialPayload.data.currency || "SAR",
    total_accounts: trialPayload.data.total_accounts || rows.length,
    total_debit: trialPayload.data.total_debit || "0.00",
    total_credit: trialPayload.data.total_credit || "0.00",
    tree: buildTreeFromFlatRows(rows),
  };
}

function openExport(path: string) {
  if (typeof window === "undefined") return;
  window.open(getApiUrl(path), "_blank", "noopener,noreferrer");
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
    export: isArabic ? "تصدير Excel" : "Export Excel",

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

    view: isArabic ? "عرض" : "View",
    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",

    loadSuccess: isArabic ? "تم تحديث دليل الحسابات" : "Accounts refreshed",
    loadError: isArabic ? "تعذر تحميل دليل الحسابات" : "Unable to load accounts",
    invalidDate: isArabic
      ? "لا يمكن أن يكون تاريخ البداية أكبر من تاريخ النهاية"
      : "Date from cannot be greater than date to",
  };
}

/* ============================================================
   UI Helpers
============================================================ */

function MoneyValue({
  value,
  className = "",
}: {
  value: string | number | null | undefined;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} dir="ltr">
      <span>{formatMoney(value)}</span>
      <Image
        src={CURRENCY_ICON_PATH}
        alt="SAR"
        width={15}
        height={15}
        className="shrink-0"
      />
    </span>
  );
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
    return "rounded-full border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (type === "LIABILITY") {
    return "rounded-full border-sky-200 bg-sky-50 text-sky-700";
  }

  if (type === "EQUITY") {
    return "rounded-full border-violet-200 bg-violet-50 text-violet-700";
  }

  if (type === "REVENUE") {
    return "rounded-full border-teal-200 bg-teal-50 text-teal-700";
  }

  if (type === "EXPENSE") {
    return "rounded-full border-amber-200 bg-amber-50 text-amber-700";
  }

  return "rounded-full border-slate-200 bg-slate-50 text-slate-600";
}

/* ============================================================
   Page
============================================================ */

export default function ChartOfAccountsTreePage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [loading, setLoading] = useState(true);

  const [tree, setTree] = useState<AccountNode[]>([]);
  const [totalDebit, setTotalDebit] = useState("0.00");
  const [totalCredit, setTotalCredit] = useState("0.00");

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
  const pageSize = 16;

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    account_code: true,
    account_name: true,
    account_type: true,
    normal_balance: true,
    account_class: true,
    total_debit: true,
    total_credit: true,
    net_debit: true,
    net_credit: true,
    actions: true,
  });

  const t = dictionary(locale);
  const isArabic = locale === "ar";
  const ChevronIcon = isArabic ? ChevronLeft : ChevronRight;

  async function loadAccounts(showToast = false) {
    try {
      if (dateFrom && dateTo && dateFrom > dateTo) {
        toast.error(t.invalidDate);
        return;
      }

      setLoading(true);

      const data = await fetchAccountsTree({
        dateFrom,
        dateTo,
        includeZeroAccounts,
        postedOnly,
      });

      setTree(data.tree);
      setTotalDebit(data.total_debit);
      setTotalCredit(data.total_credit);

      if (Object.keys(expanded).length === 0) {
        const rootExpanded: Record<number, boolean> = {};
        data.tree.forEach((node) => {
          rootExpanded[node.account_id] = true;
        });
        setExpanded(rootExpanded);
      }

      if (showToast) {
        toast.success(t.loadSuccess);
      }
    } catch (error) {
      console.error("Accounts load error:", error);
      toast.error(t.loadError);
      setTree([]);
      setTotalDebit("0.00");
      setTotalCredit("0.00");
    } finally {
      setLoading(false);
    }
  }

  function handleExport() {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      toast.error(t.invalidDate);
      return;
    }

    const path = buildTrialBalancePath({
      dateFrom,
      dateTo,
      includeZeroAccounts,
      postedOnly,
      excel: true,
    });

    openExport(path);
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

  useEffect(() => {
    const currentLocale = readLocale();
    setLocale(currentLocale);
    applyDocumentLocale(currentLocale);
  }, []);

  useEffect(() => {
    loadAccounts(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    searchTerm,
    accountTypeFilter,
    classFilter,
    includeZeroAccounts,
    postedOnly,
  ]);

  const allRows = useMemo(() => {
    return flattenTree(tree, expanded, "", "ALL", "ALL");
  }, [tree, expanded]);

  const filteredRows = useMemo(() => {
    return flattenTree(
      tree,
      expanded,
      searchTerm.trim().toLowerCase(),
      accountTypeFilter,
      classFilter,
    );
  }, [tree, expanded, searchTerm, accountTypeFilter, classFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  const paginatedRows = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * pageSize;

    return filteredRows.slice(startIndex, startIndex + pageSize);
  }, [filteredRows, page, totalPages]);

  const summary = useMemo(() => {
    const difference = Math.abs(toNumber(totalDebit) - toNumber(totalCredit));

    return {
      totalAccounts: allRows.length,
      totalDebit,
      totalCredit,
      difference,
      groupAccounts: allRows.filter((row) => row.is_group).length,
      postableAccounts: allRows.filter((row) => !row.is_group).length,
      assetAccounts: allRows.filter((row) => row.account_type === "ASSET")
        .length,
      liabilityAccounts: allRows.filter(
        (row) => row.account_type === "LIABILITY",
      ).length,
    };
  }, [allRows, totalDebit, totalCredit]);

  const statusCards = [
    {
      label: t.totalAccounts,
      value: formatNumber(summary.totalAccounts),
      icon: FolderTree,
      percent: 100,
      money: false,
    },
    {
      label: t.totalDebit,
      value: summary.totalDebit,
      icon: TrendingUp,
      percent: summary.totalAccounts > 0 ? 100 : 0,
      money: true,
    },
    {
      label: t.totalCredit,
      value: summary.totalCredit,
      icon: TrendingDown,
      percent: summary.totalAccounts > 0 ? 100 : 0,
      money: true,
    },
    {
      label: t.difference,
      value: summary.difference,
      icon: ShieldCheck,
      percent: summary.difference === 0 ? 100 : 50,
      money: true,
    },
  ];

  const summaryCards = [
    {
      title: t.groupAccounts,
      value: formatNumber(summary.groupAccounts),
      icon: Layers3,
      bg: "bg-emerald-50",
      money: false,
    },
    {
      title: t.postableAccounts,
      value: formatNumber(summary.postableAccounts),
      icon: ShieldCheck,
      bg: "bg-sky-50",
      money: false,
    },
    {
      title: t.asset,
      value: formatNumber(summary.assetAccounts),
      icon: TrendingUp,
      bg: "bg-violet-50",
      money: false,
    },
    {
      title: t.liability,
      value: formatNumber(summary.liabilityAccounts),
      icon: WalletCards,
      bg: "bg-teal-50",
      money: false,
    },
  ];

  const columnOptions: Array<{
    key: keyof VisibleColumns;
    label: string;
  }> = [
    { key: "account_code", label: t.accountCode },
    { key: "account_name", label: t.accountName },
    { key: "account_type", label: t.accountType },
    { key: "normal_balance", label: t.normalBalance },
    { key: "account_class", label: t.accountClass },
    { key: "total_debit", label: t.totalDebit },
    { key: "total_credit", label: t.totalCredit },
    { key: "net_debit", label: t.netDebit },
    { key: "net_credit", label: t.netCredit },
    { key: "actions", label: t.action },
  ];

  return (
    <div className="space-y-4 p-4 md:p-6" dir="ltr">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            variant="outline"
            className="h-10 gap-2 rounded-xl bg-white px-4"
          >
            <Link href="/system/accounting">
              <ArrowLeft className="h-4 w-4" />
              {t.back}
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="h-10 gap-2 rounded-xl bg-white px-4"
          >
            <Link href="/system/accounting/reports">
              <BarChart3 className="h-4 w-4" />
              {t.reports}
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-10 gap-2 rounded-xl bg-white px-4"
            onClick={() => loadAccounts(true)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            {t.refresh}
          </Button>

          <Button
            type="button"
            className="h-10 gap-2 rounded-xl bg-slate-950 px-4 text-white hover:bg-slate-800"
            onClick={handleExport}
          >
            <Download className="h-4 w-4" />
            {t.export}
          </Button>
        </div>

        <div
          className={`space-y-1 ${isArabic ? "text-right" : "text-left"}`}
          dir={isArabic ? "rtl" : "ltr"}
        >
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            {t.title}
          </h1>
          <p className="text-sm leading-6 text-slate-500">{t.subtitle}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card
          className="rounded-2xl border-slate-200 bg-white shadow-sm"
          dir={isArabic ? "rtl" : "ltr"}
        >
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg font-bold text-slate-950">
                {t.statusTitle}
              </CardTitle>
              <CardDescription className="mt-1">{t.statusDesc}</CardDescription>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-2 rounded-xl bg-white"
              onClick={handleExport}
            >
              <Download className="h-4 w-4" />
              {t.export}
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              {statusCards.map((card) => {
                const Icon = card.icon;

                return (
                  <div key={card.label} className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-slate-500">
                      <span>{card.label}</span>
                      <Icon className="h-4 w-4 text-slate-400" />
                    </div>

                    <p className="text-2xl font-bold text-slate-950">
                      {card.money ? (
                        <MoneyValue value={card.value} />
                      ) : (
                        card.value
                      )}
                    </p>

                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className={`h-2 rounded-full ${
                          card.label === t.totalCredit
                            ? "bg-sky-500"
                            : card.label === t.difference &&
                                summary.difference !== 0
                              ? "bg-amber-500"
                              : "bg-slate-950"
                        }`}
                        style={{ width: `${Math.min(card.percent, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <div className="relative">
                <Search
                  className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 ${
                    isArabic ? "right-3" : "left-3"
                  }`}
                />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={t.searchPlaceholder}
                  className={`h-11 rounded-xl border-slate-200 bg-white ${
                    isArabic ? "pr-10" : "pl-10"
                  }`}
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 gap-2 rounded-xl bg-white"
                  >
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
                        <label className="text-xs font-medium text-slate-500">
                          {t.dateFrom}
                        </label>
                        <Input
                          type="date"
                          value={dateFrom}
                          onChange={(event) => setDateFrom(event.target.value)}
                          className="h-9 rounded-xl"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-500">
                          {t.dateTo}
                        </label>
                        <Input
                          type="date"
                          value={dateTo}
                          onChange={(event) => setDateTo(event.target.value)}
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
                              accountTypeFilter === type ? "default" : "outline"
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
                                classFilter === filter ? "default" : "outline"
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

                      <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-2 text-sm">
                        <Checkbox
                          checked={includeZeroAccounts}
                          onCheckedChange={(value) =>
                            setIncludeZeroAccounts(Boolean(value))
                          }
                        />
                        <span>{t.includeZero}</span>
                      </label>

                      <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-2 text-sm">
                        <Checkbox
                          checked={postedOnly}
                          onCheckedChange={(value) =>
                            setPostedOnly(Boolean(value))
                          }
                        />
                        <span>{t.postedOnly}</span>
                      </label>

                      <Button
                        type="button"
                        className="h-10 w-full rounded-xl"
                        onClick={() => loadAccounts(true)}
                      >
                        {t.refresh}
                      </Button>
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 gap-2 rounded-xl bg-white"
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

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl bg-white"
                onClick={expandAll}
              >
                <ChevronDown className="h-4 w-4" />
                {t.expandAll}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl bg-white"
                onClick={collapseAll}
              >
                <ChevronRight className="h-4 w-4" />
                {t.collapseAll}
              </Button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    {visibleColumns.account_code ? (
                      <TableHead>{t.accountCode}</TableHead>
                    ) : null}

                    {visibleColumns.account_name ? (
                      <TableHead>{t.accountName}</TableHead>
                    ) : null}

                    {visibleColumns.account_type ? (
                      <TableHead>{t.accountType}</TableHead>
                    ) : null}

                    {visibleColumns.normal_balance ? (
                      <TableHead>{t.normalBalance}</TableHead>
                    ) : null}

                    {visibleColumns.account_class ? (
                      <TableHead>{t.accountClass}</TableHead>
                    ) : null}

                    {visibleColumns.total_debit ? (
                      <TableHead>{t.totalDebit}</TableHead>
                    ) : null}

                    {visibleColumns.total_credit ? (
                      <TableHead>{t.totalCredit}</TableHead>
                    ) : null}

                    {visibleColumns.net_debit ? (
                      <TableHead>{t.netDebit}</TableHead>
                    ) : null}

                    {visibleColumns.net_credit ? (
                      <TableHead>{t.netCredit}</TableHead>
                    ) : null}

                    {visibleColumns.actions ? (
                      <TableHead>{t.action}</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="h-40 text-center">
                        <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t.refresh}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedRows.length > 0 ? (
                    paginatedRows.map((row) => {
                      const isExpanded = Boolean(expanded[row.account_id]);

                      return (
                        <TableRow key={`${row.account_id}-${row.path}`}>
                          {visibleColumns.account_code ? (
                            <TableCell className="font-semibold text-slate-950">
                              <div
                                className="flex items-center gap-2"
                                style={{
                                  paddingInlineStart: `${Math.max(row.level, 0) * 16}px`,
                                }}
                              >
                                {row.has_children ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleNode(row.account_id)}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronIcon className="h-4 w-4" />
                                    )}
                                  </button>
                                ) : (
                                  <span className="h-7 w-7" />
                                )}

                                <span dir="ltr">{row.account_code}</span>
                              </div>
                            </TableCell>
                          ) : null}

                          {visibleColumns.account_name ? (
                            <TableCell className="min-w-[240px] text-slate-700">
                              <div className="flex items-center gap-2">
                                {row.has_children ? (
                                  <FolderTree className="h-4 w-4 text-slate-400" />
                                ) : (
                                  <WalletCards className="h-4 w-4 text-slate-400" />
                                )}

                                <span>{row.account_name}</span>
                              </div>
                            </TableCell>
                          ) : null}

                          {visibleColumns.account_type ? (
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

                          {visibleColumns.normal_balance ? (
                            <TableCell className="text-slate-600">
                              {row.normal_balance || "-"}
                            </TableCell>
                          ) : null}

                          {visibleColumns.account_class ? (
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  row.is_group
                                    ? "rounded-full border-slate-200 bg-slate-50 text-slate-700"
                                    : "rounded-full border-emerald-200 bg-emerald-50 text-emerald-700"
                                }
                              >
                                {row.is_group ? t.group : t.postable}
                              </Badge>
                            </TableCell>
                          ) : null}

                          {visibleColumns.total_debit ? (
                            <TableCell className="font-semibold text-slate-950">
                              <MoneyValue value={row.total_debit} />
                            </TableCell>
                          ) : null}

                          {visibleColumns.total_credit ? (
                            <TableCell className="font-semibold text-slate-950">
                              <MoneyValue value={row.total_credit} />
                            </TableCell>
                          ) : null}

                          {visibleColumns.net_debit ? (
                            <TableCell>
                              <MoneyValue value={row.net_debit} />
                            </TableCell>
                          ) : null}

                          {visibleColumns.net_credit ? (
                            <TableCell>
                              <MoneyValue value={row.net_credit} />
                            </TableCell>
                          ) : null}

                          {visibleColumns.actions ? (
                            <TableCell>
                              <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                className="h-8 rounded-lg px-2"
                              >
                                <Link
                                  href={`/system/accounting/accounts/${row.account_id}`}
                                >
                                  {t.view}
                                </Link>
                              </Button>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={10} className="h-48 text-center">
                        <div className="space-y-2">
                          <p className="font-semibold text-slate-950">
                            {t.noRows}
                          </p>
                          <p className="text-sm text-slate-500">
                            {t.noRowsDesc}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-500">
                {formatNumber(filteredRows.length)} /{" "}
                {formatNumber(allRows.length)}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl bg-white"
                  disabled={page <= 1}
                  onClick={() =>
                    setPage((current) => Math.max(1, current - 1))
                  }
                >
                  {t.previous}
                </Button>

                <Badge variant="outline" className="rounded-xl bg-white px-3">
                  {formatNumber(page)} / {formatNumber(totalPages)}
                </Badge>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl bg-white"
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

        <Card
          className="rounded-2xl border-slate-200 bg-white shadow-sm"
          dir={isArabic ? "rtl" : "ltr"}
        >
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg font-bold text-slate-950">
                {t.summaryTitle}
              </CardTitle>
              <CardDescription className="mt-1">{t.summaryDesc}</CardDescription>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white">
              <FolderTree className="h-5 w-5 text-slate-700" />
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-950">
                    {formatNumber(summary.totalAccounts)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {t.totalAccounts}
                  </p>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-950 text-white">
                  <FolderTree className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-slate-200 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{t.groupAccounts}</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">
                    {formatNumber(summary.groupAccounts)}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{t.postableAccounts}</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">
                    {formatNumber(summary.postableAccounts)}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{t.totalDebit}</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">
                    <MoneyValue value={summary.totalDebit} />
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{t.totalCredit}</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">
                    <MoneyValue value={summary.totalCredit} />
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10 justify-between rounded-xl bg-white"
                onClick={() => {
                  setAccountTypeFilter("ALL");
                  setClassFilter("ALL");
                  setSearchTerm("");
                }}
              >
                <span>{t.all}</span>
                <Layers3 className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-10 justify-between rounded-xl bg-white"
                onClick={() => setAccountTypeFilter("ASSET")}
              >
                <span>{t.asset}</span>
                <TrendingUp className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-10 justify-between rounded-xl bg-white"
                onClick={() => setClassFilter("POSTABLE")}
              >
                <span>{t.postable}</span>
                <ShieldCheck className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;

          return (
            <Card
              key={card.title}
              className="rounded-2xl border-slate-200 bg-white shadow-sm"
              dir={isArabic ? "rtl" : "ltr"}
            >
              <CardContent className="p-5">
                <div className={`rounded-2xl ${card.bg} p-4`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-500">{card.title}</p>
                      <p className="mt-2 text-2xl font-bold text-slate-950">
                        {card.money ? (
                          <MoneyValue value={card.value} />
                        ) : (
                          card.value
                        )}
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-950 shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}