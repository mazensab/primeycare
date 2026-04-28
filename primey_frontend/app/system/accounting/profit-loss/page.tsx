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
  Loader2,
  PieChart,
  RefreshCcw,
  Search,
  TrendingDown,
  TrendingUp,
  WalletCards,
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
   📂 app/system/accounting/profit-loss/page.tsx
   🧠 Primey Care | Profit & Loss Report
   ------------------------------------------------------------
   ✅ المسار الرسمي للأرباح والخسائر
   ✅ نفس تنسيق صفحات المحاسبة
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

type SectionFilter = "ALL" | "REVENUE" | "EXPENSE";

type SortKey =
  | "section"
  | "account_code"
  | "account_name"
  | "account_type"
  | "amount";

type SortDirection = "asc" | "desc";

type ProfitLossApiRow = {
  account_id: number;
  account_code: string;
  account_name: string;
  account_type: string;
  amount: string;
};

type ProfitLossPayload = {
  currency: string;
  date_from: string | null;
  date_to: string | null;
  revenue: {
    title: string;
    total_amount: string;
    rows: ProfitLossApiRow[];
  };
  expenses: {
    title: string;
    total_amount: string;
    rows: ProfitLossApiRow[];
  };
  net_profit: string;
};

type ProfitLossRow = {
  id: string;
  section: "REVENUE" | "EXPENSE";
  account_id: number;
  account_code: string;
  account_name: string;
  account_type: string;
  amount: string;
};

type ApiEnvelope<T> = {
  ok?: boolean;
  report_code?: string;
  data?: T;
  message?: string;
};

type VisibleColumns = {
  section: boolean;
  account_code: boolean;
  account_name: boolean;
  account_type: boolean;
  amount: boolean;
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

function formatPercent(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
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

function buildProfitLossPath({
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
    ? "/api/accounting/reports/profit-loss/excel/"
    : "/api/accounting/reports/profit-loss/";

  return `${basePath}${buildQuery({
    date_from: dateFrom || null,
    date_to: dateTo || null,
    include_zero_accounts: includeZeroAccounts,
    posted_only: postedOnly,
  })}`;
}

async function fetchProfitLoss(path: string): Promise<ProfitLossPayload> {
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

  const payload = (await response.json()) as ApiEnvelope<ProfitLossPayload>;

  if (payload.ok === false) {
    throw new Error(payload.message || "Profit and loss request failed");
  }

  if (!payload.data) {
    throw new Error("Profit and loss response does not contain data");
  }

  return payload.data;
}

function openExport(path: string) {
  if (typeof window === "undefined") return;
  window.open(getApiUrl(path), "_blank", "noopener,noreferrer");
}

function compareValues(
  a: ProfitLossRow,
  b: ProfitLossRow,
  key: SortKey,
  direction: SortDirection,
) {
  const multiplier = direction === "asc" ? 1 : -1;

  if (key === "amount") {
    return (toNumber(a.amount) - toNumber(b.amount)) * multiplier;
  }

  return String(a[key] || "").localeCompare(String(b[key] || "")) * multiplier;
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "الأرباح والخسائر" : "Profit & Loss",
    subtitle: isArabic
      ? "عرض الإيرادات والمصاريف وصافي الربح من القيود المرحلة مع بحث وفلاتر وتصدير."
      : "View revenue, expenses, and net profit from posted journals with search, filters, and export.",

    back: isArabic ? "لوحة المحاسبة" : "Accounting Overview",
    reports: isArabic ? "تقارير المحاسبة" : "Accounting Reports",
    refresh: isArabic ? "تحديث" : "Refresh",
    export: isArabic ? "تصدير Excel" : "Export Excel",

    statusTitle: isArabic ? "حالة الأرباح والخسائر" : "Profit & Loss Status",
    statusDesc: isArabic
      ? "تحليل سريع للإيرادات والمصاريف وصافي الربح للفترة المحددة."
      : "Quick analysis of revenue, expenses, and net profit for the selected period.",

    summaryTitle: isArabic ? "ملخص التقرير" : "Report Summary",
    summaryDesc: isArabic
      ? "أهم المؤشرات المالية الحالية لتقرير الأرباح والخسائر."
      : "Key financial indicators for the current profit and loss report.",

    revenue: isArabic ? "الإيرادات" : "Revenue",
    expenses: isArabic ? "المصاريف" : "Expenses",
    netProfit: isArabic ? "صافي الربح" : "Net Profit",
    netLoss: isArabic ? "صافي الخسارة" : "Net Loss",
    accounts: isArabic ? "الحسابات" : "Accounts",

    expenseRatio: isArabic ? "نسبة المصاريف" : "Expense Ratio",
    profitMargin: isArabic ? "هامش الربح" : "Profit Margin",

    searchPlaceholder: isArabic
      ? "ابحث في حسابات الإيرادات والمصاريف..."
      : "Search revenue and expense accounts...",

    columns: isArabic ? "الأعمدة" : "Columns",
    filters: isArabic ? "الفلاتر" : "Filters",
    all: isArabic ? "الكل" : "All",
    revenueOnly: isArabic ? "الإيرادات" : "Revenue",
    expenseOnly: isArabic ? "المصاريف" : "Expenses",
    includeZero: isArabic ? "إظهار الحسابات الصفرية" : "Include zero accounts",
    postedOnly: isArabic ? "القيود المرحلة فقط" : "Posted only",

    dateFrom: isArabic ? "من تاريخ" : "Date From",
    dateTo: isArabic ? "إلى تاريخ" : "Date To",

    section: isArabic ? "القسم" : "Section",
    accountCode: isArabic ? "الكود" : "Code",
    accountName: isArabic ? "اسم الحساب" : "Account Name",
    accountType: isArabic ? "النوع" : "Type",
    amount: isArabic ? "المبلغ" : "Amount",
    action: isArabic ? "الإجراء" : "Action",

    noRows: isArabic ? "لا توجد بيانات" : "No data found",
    noRowsDesc: isArabic
      ? "غيّر الفلاتر أو تأكد من وجود قيود مرحلة على حسابات الإيرادات والمصاريف."
      : "Change filters or make sure posted journals exist for revenue and expense accounts.",

    view: isArabic ? "عرض" : "View",
    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",

    profit: isArabic ? "ربح" : "Profit",
    loss: isArabic ? "خسارة" : "Loss",
    positive: isArabic ? "موجب" : "Positive",
    negative: isArabic ? "سالب" : "Negative",

    loadSuccess: isArabic
      ? "تم تحديث تقرير الأرباح والخسائر"
      : "Profit and loss refreshed",
    loadError: isArabic
      ? "تعذر تحميل تقرير الأرباح والخسائر"
      : "Unable to load profit and loss",
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

function sectionBadgeClass(section: "REVENUE" | "EXPENSE") {
  if (section === "REVENUE") {
    return "rounded-full border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "rounded-full border-amber-200 bg-amber-50 text-amber-700";
}

/* ============================================================
   Page
============================================================ */

export default function ProfitLossPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [loading, setLoading] = useState(true);

  const [payload, setPayload] = useState<ProfitLossPayload | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>("ALL");
  const [includeZeroAccounts, setIncludeZeroAccounts] = useState(false);
  const [postedOnly, setPostedOnly] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("account_code");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [page, setPage] = useState(1);
  const pageSize = 12;

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    section: true,
    account_code: true,
    account_name: true,
    account_type: true,
    amount: true,
    actions: true,
  });

  const t = dictionary(locale);
  const isArabic = locale === "ar";

  async function loadProfitLoss(showToast = false) {
    try {
      if (dateFrom && dateTo && dateFrom > dateTo) {
        toast.error(t.invalidDate);
        return;
      }

      setLoading(true);

      const path = buildProfitLossPath({
        dateFrom,
        dateTo,
        includeZeroAccounts,
        postedOnly,
      });

      const data = await fetchProfitLoss(path);
      setPayload(data);

      if (showToast) {
        toast.success(t.loadSuccess);
      }
    } catch (error) {
      console.error("Profit and loss load error:", error);
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

    const path = buildProfitLossPath({
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
    loadProfitLoss(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, sectionFilter, includeZeroAccounts, postedOnly]);

  const rows = useMemo<ProfitLossRow[]>(() => {
    const revenueRows =
      payload?.revenue?.rows?.map((row) => ({
        id: `revenue-${row.account_id}-${row.account_code}`,
        section: "REVENUE" as const,
        account_id: row.account_id,
        account_code: row.account_code,
        account_name: row.account_name,
        account_type: row.account_type,
        amount: row.amount,
      })) || [];

    const expenseRows =
      payload?.expenses?.rows?.map((row) => ({
        id: `expense-${row.account_id}-${row.account_code}`,
        section: "EXPENSE" as const,
        account_id: row.account_id,
        account_code: row.account_code,
        account_name: row.account_name,
        account_type: row.account_type,
        amount: row.amount,
      })) || [];

    return [...revenueRows, ...expenseRows];
  }, [payload]);

  const summary = useMemo(() => {
    const revenue = payload?.revenue?.total_amount || "0.00";
    const expenses = payload?.expenses?.total_amount || "0.00";
    const netProfit = payload?.net_profit || "0.00";

    const revenueValue = toNumber(revenue);
    const expensesValue = toNumber(expenses);
    const netProfitValue = toNumber(netProfit);

    const profitMargin =
      revenueValue > 0 ? (netProfitValue / revenueValue) * 100 : 0;

    const expenseRatio =
      revenueValue > 0 ? (expensesValue / revenueValue) * 100 : 0;

    return {
      revenue,
      expenses,
      netProfit,
      revenueValue,
      expensesValue,
      netProfitValue,
      profitMargin,
      expenseRatio,
      totalAccounts: rows.length,
      revenueAccounts: rows.filter((row) => row.section === "REVENUE").length,
      expenseAccounts: rows.filter((row) => row.section === "EXPENSE").length,
      isProfit: netProfitValue >= 0,
    };
  }, [payload, rows]);

  const filteredRows = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return rows
      .filter((row) => {
        const matchesSearch = keyword
          ? [
              row.section,
              row.account_code,
              row.account_name,
              row.account_type,
              row.amount,
            ]
              .join(" ")
              .toLowerCase()
              .includes(keyword)
          : true;

        const matchesSection =
          sectionFilter === "ALL" || row.section === sectionFilter;

        return matchesSearch && matchesSection;
      })
      .sort((a, b) => compareValues(a, b, sortKey, sortDirection));
  }, [rows, searchTerm, sectionFilter, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  const paginatedRows = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * pageSize;

    return filteredRows.slice(startIndex, startIndex + pageSize);
  }, [filteredRows, page, totalPages]);

  const statusCards = [
    {
      label: t.revenue,
      value: summary.revenue,
      icon: TrendingUp,
      percent: summary.revenueValue > 0 ? 100 : 0,
      money: true,
    },
    {
      label: t.expenses,
      value: summary.expenses,
      icon: TrendingDown,
      percent: Math.min(summary.expenseRatio, 100),
      money: true,
    },
    {
      label: summary.isProfit ? t.netProfit : t.netLoss,
      value: summary.netProfit,
      icon: PieChart,
      percent: Math.min(Math.abs(summary.profitMargin), 100),
      money: true,
    },
    {
      label: t.accounts,
      value: formatNumber(summary.totalAccounts),
      icon: WalletCards,
      percent: 100,
      money: false,
    },
  ];

  const summaryCards = [
    {
      title: t.revenue,
      value: summary.revenue,
      icon: TrendingUp,
      bg: "bg-emerald-50",
      money: true,
    },
    {
      title: t.expenses,
      value: summary.expenses,
      icon: TrendingDown,
      bg: "bg-sky-50",
      money: true,
    },
    {
      title: summary.isProfit ? t.profit : t.loss,
      value: summary.netProfit,
      icon: PieChart,
      bg: "bg-violet-50",
      money: true,
    },
    {
      title: t.profitMargin,
      value: `${formatPercent(summary.profitMargin)}%`,
      icon: Calculator,
      bg: "bg-teal-50",
      money: false,
    },
  ];

  const columnOptions: Array<{
    key: keyof VisibleColumns;
    label: string;
  }> = [
    { key: "section", label: t.section },
    { key: "account_code", label: t.accountCode },
    { key: "account_name", label: t.accountName },
    { key: "account_type", label: t.accountType },
    { key: "amount", label: t.amount },
    { key: "actions", label: t.action },
  ];

  return (
    <PermissionGuard
      permission={PERMISSIONS.ACCOUNTING_VIEW}
      workspace="system"
      mode="fallback"
    >
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
              onClick={() => loadProfitLoss(true)}
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
                            card.label === t.expenses
                              ? "bg-sky-500"
                              : card.label === t.netLoss || card.label === t.loss
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

                        <div className="grid grid-cols-3 gap-2">
                          {(["ALL", "REVENUE", "EXPENSE"] as SectionFilter[]).map(
                            (filter) => (
                              <Button
                                key={filter}
                                type="button"
                                variant={
                                  sectionFilter === filter ? "default" : "outline"
                                }
                                size="sm"
                                className="rounded-xl"
                                onClick={() => setSectionFilter(filter)}
                              >
                                {filter === "ALL"
                                  ? t.all
                                  : filter === "REVENUE"
                                    ? t.revenueOnly
                                    : t.expenseOnly}
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
                          onClick={() => loadProfitLoss(true)}
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
                      {visibleColumns.section ? (
                        <TableHead>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1"
                            onClick={() => toggleSort("section")}
                          >
                            {t.section}
                            <ArrowDownUp className="h-3.5 w-3.5" />
                          </button>
                        </TableHead>
                      ) : null}

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

                      {visibleColumns.amount ? (
                        <TableHead>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1"
                            onClick={() => toggleSort("amount")}
                          >
                            {t.amount}
                            <ArrowDownUp className="h-3.5 w-3.5" />
                          </button>
                        </TableHead>
                      ) : null}

                      {visibleColumns.actions ? (
                        <TableHead>{t.action}</TableHead>
                      ) : null}
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-40 text-center">
                          <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t.refresh}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : paginatedRows.length > 0 ? (
                      paginatedRows.map((row) => (
                        <TableRow key={row.id}>
                          {visibleColumns.section ? (
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={sectionBadgeClass(row.section)}
                              >
                                {row.section === "REVENUE"
                                  ? t.revenue
                                  : t.expenses}
                              </Badge>
                            </TableCell>
                          ) : null}

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
                            <TableCell className="text-slate-600">
                              {row.account_type}
                            </TableCell>
                          ) : null}

                          {visibleColumns.amount ? (
                            <TableCell className="font-semibold text-slate-950">
                              <MoneyValue value={row.amount} />
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
                        <TableCell colSpan={6} className="h-48 text-center">
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
                <PieChart className="h-5 w-5 text-slate-700" />
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-950">
                      {summary.isProfit ? t.profit : t.loss}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {summary.isProfit ? t.positive : t.negative}
                    </p>
                  </div>

                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl text-white ${
                      summary.isProfit ? "bg-slate-950" : "bg-amber-500"
                    }`}
                  >
                    <PieChart className="h-5 w-5" />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-slate-200 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{t.revenue}</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">
                      <MoneyValue value={summary.revenue} />
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{t.expenses}</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">
                      <MoneyValue value={summary.expenses} />
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{t.revenueOnly}</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">
                      {formatNumber(summary.revenueAccounts)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{t.expenseOnly}</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">
                      {formatNumber(summary.expenseAccounts)}
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
                    setSectionFilter("ALL");
                    setSearchTerm("");
                  }}
                >
                  <span>{t.all}</span>
                  <WalletCards className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-10 justify-between rounded-xl bg-white"
                  onClick={() => setSectionFilter("REVENUE")}
                >
                  <span>{t.revenue}</span>
                  <TrendingUp className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-10 justify-between rounded-xl bg-white"
                  onClick={() => setSectionFilter("EXPENSE")}
                >
                  <span>{t.expenses}</span>
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
    </PermissionGuard>
  );
}