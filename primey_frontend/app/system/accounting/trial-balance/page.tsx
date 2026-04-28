"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  ArrowLeft,
  BarChart3,
  Calculator,
  ColumnsIcon,
  Download,
  Filter,
  Layers3,
  Loader2,
  RefreshCcw,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { Can } from "@/components/guards/Can";
import { PermissionGuard } from "@/components/guards/PermissionGuard";
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
import { PERMISSIONS } from "@/lib/permissions";

/* ============================================================
   📂 app/system/accounting/trial-balance/page.tsx
   🧠 Primey Care | Trial Balance
   ------------------------------------------------------------
   ✅ نفس تنسيق صفحة قائمة المراكز
   ✅ بيانات حقيقية من Accounting API
   ✅ بحث + فلاتر + أعمدة + فرز + صفحات
   ✅ تصدير Excel من API
   ✅ حماية الصفحة accounting.view
   ✅ حماية التصدير accounting.export / reports.export
   ✅ دعم عربي / إنجليزي
   ✅ أرقام إنجليزية دائمًا
   ✅ رمز العملة الرسمي
   ✅ إصلاح DropdownMenuContent بدون dir مباشر
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
type GroupFilter = "ALL" | "GROUP" | "POSTABLE";

type SortKey =
  | "account_code"
  | "account_name"
  | "account_type"
  | "total_debit"
  | "total_credit"
  | "net_debit"
  | "net_credit";

type SortDirection = "asc" | "desc";

type TrialBalanceRow = {
  account_id: number;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  is_group: boolean;
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

type ApiEnvelope<T> = {
  ok?: boolean;
  report_code?: string;
  data?: T;
  message?: string;
};

type VisibleColumns = {
  account_code: boolean;
  account_name: boolean;
  account_type: boolean;
  is_group: boolean;
  total_debit: boolean;
  total_credit: boolean;
  net_debit: boolean;
  net_credit: boolean;
  actions: boolean;
};

type StatusCard = {
  label: string;
  value: string | number;
  icon: typeof Layers3;
  percent: number;
  money?: boolean;
};

const CURRENCY_ICON_PATH = "/currency/sar.svg";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

/* ============================================================
   🌐 Locale Helpers
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
   🔧 Helpers
============================================================ */

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "");
    const parsed = Number(normalized || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

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

function normalizeAccountType(value: unknown): AccountType {
  const accountType = String(value || "").toUpperCase();

  if (accountType === "ASSET") return "ASSET";
  if (accountType === "LIABILITY") return "LIABILITY";
  if (accountType === "EQUITY") return "EQUITY";
  if (accountType === "REVENUE") return "REVENUE";
  if (accountType === "EXPENSE") return "EXPENSE";

  return "UNKNOWN";
}

function normalizeRow(row: unknown): TrialBalanceRow {
  const item = (row || {}) as Record<string, unknown>;

  return {
    account_id: Number(item.account_id || 0),
    account_code: String(item.account_code || "-"),
    account_name: String(item.account_name || "-"),
    account_type: normalizeAccountType(item.account_type),
    is_group: Boolean(item.is_group),
    total_debit: String(item.total_debit || "0.00"),
    total_credit: String(item.total_credit || "0.00"),
    net_debit: String(item.net_debit || "0.00"),
    net_credit: String(item.net_credit || "0.00"),
  };
}

function getApiUrl(path: string): string {
  const cleanBase = API_BASE_URL.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

function buildQuery(params: Record<string, string | boolean | null | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
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

async function fetchTrialBalance(path: string): Promise<TrialBalancePayload> {
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

  const payload = (await response.json()) as ApiEnvelope<TrialBalancePayload>;

  if (payload.ok === false) {
    throw new Error(payload.message || "Trial balance request failed");
  }

  if (!payload.data) {
    throw new Error("Trial balance response does not contain data");
  }

  return {
    ...payload.data,
    rows: Array.isArray(payload.data.rows)
      ? payload.data.rows.map(normalizeRow)
      : [],
  };
}

function openExport(path: string) {
  if (typeof window === "undefined") return;
  window.open(getApiUrl(path), "_blank", "noopener,noreferrer");
}

/* ============================================================
   📚 Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "ميزان المراجعة" : "Trial Balance",
    subtitle: isArabic
      ? "عرض أرصدة الحسابات المدينة والدائنة من القيود المرحلة مع فلاتر وبحث وفرز."
      : "View debit and credit balances from posted journals with filters, search, and sorting.",

    back: isArabic ? "لوحة المحاسبة" : "Accounting Overview",
    reports: isArabic ? "تقارير المحاسبة" : "Accounting Reports",
    refresh: isArabic ? "تحديث" : "Refresh",
    export: isArabic ? "تصدير Excel" : "Export Excel",

    statusTitle: isArabic ? "حالة ميزان المراجعة" : "Trial Balance Status",
    statusDesc: isArabic
      ? "تحليل سريع لإجماليات الحسابات، المدين، الدائن، وحالة التوازن."
      : "Quick analysis of accounts, debit, credit, and balance status.",

    totalAccounts: isArabic ? "الحسابات" : "Accounts",
    totalDebit: isArabic ? "إجمالي المدين" : "Total Debit",
    totalCredit: isArabic ? "إجمالي الدائن" : "Total Credit",
    difference: isArabic ? "الفرق" : "Difference",
    balanced: isArabic ? "متوازن" : "Balanced",
    unbalanced: isArabic ? "غير متوازن" : "Unbalanced",
    activeRows: isArabic ? "حسابات ظاهرة" : "Visible Accounts",

    searchPlaceholder: isArabic ? "ابحث في الحسابات..." : "Search accounts...",
    columns: isArabic ? "الأعمدة" : "Columns",
    filters: isArabic ? "الفلاتر" : "Filters",
    all: isArabic ? "الكل" : "All",
    groupAccounts: isArabic ? "تجميعية" : "Groups",
    postableAccounts: isArabic ? "ترحيل" : "Postable",
    includeZero: isArabic ? "إظهار الحسابات الصفرية" : "Include zero accounts",
    postedOnly: isArabic ? "القيود المرحلة فقط" : "Posted only",

    dateFrom: isArabic ? "من تاريخ" : "Date From",
    dateTo: isArabic ? "إلى تاريخ" : "Date To",

    accountCode: isArabic ? "الكود" : "Code",
    accountName: isArabic ? "اسم الحساب" : "Account Name",
    accountType: isArabic ? "النوع" : "Type",
    isGroup: isArabic ? "التصنيف" : "Class",
    netDebit: isArabic ? "صافي مدين" : "Net Debit",
    netCredit: isArabic ? "صافي دائن" : "Net Credit",
    action: isArabic ? "الإجراء" : "Action",

    asset: isArabic ? "أصول" : "Assets",
    liability: isArabic ? "التزامات" : "Liabilities",
    equity: isArabic ? "حقوق ملكية" : "Equity",
    revenue: isArabic ? "إيرادات" : "Revenue",
    expense: isArabic ? "مصروفات" : "Expenses",
    unknown: isArabic ? "غير محدد" : "Unknown",

    group: isArabic ? "تجميعي" : "Group",
    postable: isArabic ? "قابل للترحيل" : "Postable",

    noRows: isArabic ? "لا توجد حسابات" : "No accounts found",
    noRowsDesc: isArabic
      ? "غيّر الفلاتر أو نفّذ زرع شجرة الحسابات ثم أعد التحديث."
      : "Change filters or seed the chart of accounts then refresh.",

    view: isArabic ? "عرض" : "View",
    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",

    summaryTitle: isArabic ? "ملخص الميزان" : "Balance Summary",
    summaryDesc: isArabic
      ? "أهم المؤشرات المحاسبية الحالية لميزان المراجعة."
      : "Key accounting indicators for the current trial balance.",

    loadSuccess: isArabic ? "تم تحديث ميزان المراجعة" : "Trial balance refreshed",
    loadError: isArabic
      ? "تعذر تحميل ميزان المراجعة"
      : "Unable to load trial balance",
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
  if (type === "ASSET") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (type === "LIABILITY") return "border-sky-200 bg-sky-50 text-sky-700";
  if (type === "EQUITY") return "border-violet-200 bg-violet-50 text-violet-700";
  if (type === "REVENUE") return "border-teal-200 bg-teal-50 text-teal-700";
  if (type === "EXPENSE") return "border-amber-200 bg-amber-50 text-amber-700";

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function compareValues(
  a: TrialBalanceRow,
  b: TrialBalanceRow,
  key: SortKey,
  direction: SortDirection,
) {
  const multiplier = direction === "asc" ? 1 : -1;

  const numericKeys: SortKey[] = [
    "total_debit",
    "total_credit",
    "net_debit",
    "net_credit",
  ];

  if (numericKeys.includes(key)) {
    return (toNumber(a[key]) - toNumber(b[key])) * multiplier;
  }

  return String(a[key] || "").localeCompare(String(b[key] || "")) * multiplier;
}

/* ============================================================
   Page
============================================================ */

export default function TrialBalancePage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [loading, setLoading] = useState(true);

  const [payload, setPayload] = useState<TrialBalancePayload | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] =
    useState<AccountTypeFilter>("ALL");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("ALL");
  const [includeZeroAccounts, setIncludeZeroAccounts] = useState(false);
  const [postedOnly, setPostedOnly] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("account_code");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [page, setPage] = useState(1);
  const pageSize = 12;

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    account_code: true,
    account_name: true,
    account_type: true,
    is_group: true,
    total_debit: true,
    total_credit: true,
    net_debit: true,
    net_credit: true,
    actions: true,
  });

  const t = dictionary(locale);
  const isArabic = locale === "ar";

  async function loadTrialBalance(showToast = false) {
    try {
      if (dateFrom && dateTo && dateFrom > dateTo) {
        toast.error(t.invalidDate);
        return;
      }

      setLoading(true);

      const path = buildTrialBalancePath({
        dateFrom,
        dateTo,
        includeZeroAccounts,
        postedOnly,
      });

      const data = await fetchTrialBalance(path);
      setPayload(data);

      if (showToast) {
        toast.success(t.loadSuccess);
      }
    } catch (error) {
      console.error("Trial balance load error:", error);
      toast.error(t.loadError);
      setPayload(null);
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

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  useEffect(() => {
    const currentLocale = readLocale();
    setLocale(currentLocale);
    applyDocumentLocale(currentLocale);
  }, []);

  useEffect(() => {
    loadTrialBalance(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    searchTerm,
    accountTypeFilter,
    groupFilter,
    includeZeroAccounts,
    postedOnly,
  ]);

  const rows = payload?.rows || [];

  const summary = useMemo(() => {
    const totalDebit = payload?.total_debit || "0.00";
    const totalCredit = payload?.total_credit || "0.00";
    const difference = Math.abs(toNumber(totalDebit) - toNumber(totalCredit));
    const isBalanced = difference === 0;

    const groupAccounts = rows.filter((row) => row.is_group).length;
    const postableAccounts = rows.filter((row) => !row.is_group).length;

    return {
      totalAccounts: payload?.total_accounts || rows.length,
      totalDebit,
      totalCredit,
      difference,
      isBalanced,
      groupAccounts,
      postableAccounts,
    };
  }, [payload, rows]);

  const filteredRows = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return rows
      .filter((row) => {
        const matchesSearch = keyword
          ? [
              row.account_code,
              row.account_name,
              row.account_type,
              row.total_debit,
              row.total_credit,
              row.net_debit,
              row.net_credit,
            ]
              .join(" ")
              .toLowerCase()
              .includes(keyword)
          : true;

        const matchesType =
          accountTypeFilter === "ALL" || row.account_type === accountTypeFilter;

        const matchesGroup =
          groupFilter === "ALL" ||
          (groupFilter === "GROUP" && row.is_group) ||
          (groupFilter === "POSTABLE" && !row.is_group);

        return matchesSearch && matchesType && matchesGroup;
      })
      .sort((a, b) => compareValues(a, b, sortKey, sortDirection));
  }, [rows, searchTerm, accountTypeFilter, groupFilter, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  const paginatedRows = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * pageSize;

    return filteredRows.slice(startIndex, startIndex + pageSize);
  }, [filteredRows, page, totalPages]);

  const statusCards: StatusCard[] = [
    {
      label: t.totalAccounts,
      value: formatNumber(summary.totalAccounts),
      icon: Layers3,
      percent: 100,
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
      percent: summary.isBalanced ? 100 : 0,
      money: true,
    },
  ];

  const columnOptions: Array<{
    key: keyof VisibleColumns;
    label: string;
  }> = [
    { key: "account_code", label: t.accountCode },
    { key: "account_name", label: t.accountName },
    { key: "account_type", label: t.accountType },
    { key: "is_group", label: t.isGroup },
    { key: "total_debit", label: t.totalDebit },
    { key: "total_credit", label: t.totalCredit },
    { key: "net_debit", label: t.netDebit },
    { key: "net_credit", label: t.netCredit },
    { key: "actions", label: t.action },
  ];

  return (
    <PermissionGuard
      permission={PERMISSIONS.ACCOUNTING_VIEW}
      workspace="system"
      mode="fallback"
    >
      <div className="space-y-4 p-4 md:p-6" dir="ltr">
        {/* Header */}
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
              onClick={() => loadTrialBalance(true)}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              {t.refresh}
            </Button>

            <Can
              anyPermissions={[
                PERMISSIONS.ACCOUNTING_EXPORT,
                PERMISSIONS.REPORTS_EXPORT,
              ]}
            >
              <Button
                type="button"
                className="h-10 gap-2 rounded-xl bg-slate-950 px-4 text-white hover:bg-slate-800"
                onClick={handleExport}
              >
                <Download className="h-4 w-4" />
                {t.export}
              </Button>
            </Can>
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

        {/* Main Grid */}
        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          {/* Table Card */}
          <Card
            className="rounded-2xl border-slate-200 bg-white shadow-sm"
            dir={isArabic ? "rtl" : "ltr"}
          >
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-4">
              <div>
                <CardTitle className="text-lg font-bold text-slate-950">
                  {t.statusTitle}
                </CardTitle>
                <CardDescription className="mt-1">
                  {t.statusDesc}
                </CardDescription>
              </div>

              <Can
                anyPermissions={[
                  PERMISSIONS.ACCOUNTING_EXPORT,
                  PERMISSIONS.REPORTS_EXPORT,
                ]}
              >
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
              </Can>
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
                            card.label === t.difference && !summary.isBalanced
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
                          {(["ALL", "GROUP", "POSTABLE"] as GroupFilter[]).map(
                            (filter) => (
                              <Button
                                key={filter}
                                type="button"
                                variant={
                                  groupFilter === filter ? "default" : "outline"
                                }
                                size="sm"
                                className="rounded-xl"
                                onClick={() => setGroupFilter(filter)}
                              >
                                {filter === "ALL"
                                  ? t.all
                                  : filter === "GROUP"
                                    ? t.groupAccounts
                                    : t.postableAccounts}
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
                          onClick={() => loadTrialBalance(true)}
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

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      {visibleColumns.account_code ? (
                        <TableHead>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1"
                            onClick={() => toggleSort("account_code")}
                          >
                            {t.accountCode}
                            <ArrowDownUp className="h-3.5 w-3.5" />
                          </button>
                        </TableHead>
                      ) : null}

                      {visibleColumns.account_name ? (
                        <TableHead>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1"
                            onClick={() => toggleSort("account_name")}
                          >
                            {t.accountName}
                            <ArrowDownUp className="h-3.5 w-3.5" />
                          </button>
                        </TableHead>
                      ) : null}

                      {visibleColumns.account_type ? (
                        <TableHead>{t.accountType}</TableHead>
                      ) : null}

                      {visibleColumns.is_group ? (
                        <TableHead>{t.isGroup}</TableHead>
                      ) : null}

                      {visibleColumns.total_debit ? (
                        <TableHead>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1"
                            onClick={() => toggleSort("total_debit")}
                          >
                            {t.totalDebit}
                            <ArrowDownUp className="h-3.5 w-3.5" />
                          </button>
                        </TableHead>
                      ) : null}

                      {visibleColumns.total_credit ? (
                        <TableHead>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1"
                            onClick={() => toggleSort("total_credit")}
                          >
                            {t.totalCredit}
                            <ArrowDownUp className="h-3.5 w-3.5" />
                          </button>
                        </TableHead>
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
                        <TableCell colSpan={9} className="h-40 text-center">
                          <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t.refresh}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : paginatedRows.length > 0 ? (
                      paginatedRows.map((row) => (
                        <TableRow key={`${row.account_id}-${row.account_code}`}>
                          {visibleColumns.account_code ? (
                            <TableCell className="font-semibold text-slate-950">
                              {row.account_code}
                            </TableCell>
                          ) : null}

                          {visibleColumns.account_name ? (
                            <TableCell className="min-w-[220px] text-slate-700">
                              {row.account_name}
                            </TableCell>
                          ) : null}

                          {visibleColumns.account_type ? (
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`rounded-full ${accountTypeBadgeClass(
                                  row.account_type,
                                )}`}
                              >
                                {accountTypeLabel(row.account_type, locale)}
                              </Badge>
                            </TableCell>
                          ) : null}

                          {visibleColumns.is_group ? (
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
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="h-48 text-center">
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
                  {formatNumber(rows.length)}
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

          {/* Summary Card */}
          <Card
            className="rounded-2xl border-slate-200 bg-white shadow-sm"
            dir={isArabic ? "rtl" : "ltr"}
          >
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-4">
              <div>
                <CardTitle className="text-lg font-bold text-slate-950">
                  {t.summaryTitle}
                </CardTitle>
                <CardDescription className="mt-1">
                  {t.summaryDesc}
                </CardDescription>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white">
                <Calculator className="h-5 w-5 text-slate-700" />
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-950">
                      {summary.isBalanced ? t.balanced : t.unbalanced}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {t.statusTitle}
                    </p>
                  </div>

                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl text-white ${
                      summary.isBalanced ? "bg-slate-950" : "bg-amber-500"
                    }`}
                  >
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-slate-200 p-4">
                <div className="grid grid-cols-2 gap-3">
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

                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{t.groupAccounts}</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">
                      {formatNumber(summary.groupAccounts)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">
                      {t.postableAccounts}
                    </p>
                    <p className="mt-1 text-lg font-bold text-slate-950">
                      {formatNumber(summary.postableAccounts)}
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
                    setGroupFilter("ALL");
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
                  onClick={() => setAccountTypeFilter("EXPENSE")}
                >
                  <span>{t.expense}</span>
                  <TrendingDown className="h-4 w-4" />
                </Button>

                <Can
                  anyPermissions={[
                    PERMISSIONS.ACCOUNTING_EXPORT,
                    PERMISSIONS.REPORTS_EXPORT,
                  ]}
                >
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 justify-between rounded-xl bg-white"
                    onClick={handleExport}
                  >
                    <span>{t.export}</span>
                    <Download className="h-4 w-4" />
                  </Button>
                </Can>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PermissionGuard>
  );
}