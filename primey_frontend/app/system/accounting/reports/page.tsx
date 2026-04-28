"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpenCheck,
  Calculator,
  ColumnsIcon,
  Download,
  FileText,
  FilterIcon,
  Landmark,
  Layers3,
  Loader2,
  PieChart,
  Printer,
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
   📂 app/system/accounting/reports/page.tsx
   🧠 Primey Care | Accounting Reports
   ------------------------------------------------------------
   ✅ نفس تنسيق ملف تقارير المراكز المرفق
   ✅ بطاقات + جداول + فلاتر + أعمدة
   ✅ تصدير Excel منظم
   ✅ طباعة Web PDF
   ✅ ربط حقيقي مع Accounting API
   ✅ دعم عربي / إنجليزي
   ✅ أرقام إنجليزية دائمًا
   ✅ رمز العملة الرسمي
   ✅ إصلاح difference
   ✅ إصلاح DropdownMenuContent بدون dir مباشر
============================================================ */

type AppLocale = "ar" | "en";

type ReportScope = "ALL" | "TRIAL_BALANCE" | "PROFIT_LOSS" | "BALANCE_SHEET";

type FinancialReportRow = {
  id: string;
  report: ReportScope;
  section: string;
  accountId: number | string;
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: string;
  credit: string;
  amount: string;
  side: string;
};

type TrialBalancePayload = {
  currency: string;
  date_from: string | null;
  date_to: string | null;
  total_accounts: number;
  total_debit: string;
  total_credit: string;
  rows: Array<{
    account_id: number;
    account_code: string;
    account_name: string;
    account_type: string;
    is_group: boolean;
    total_debit: string;
    total_credit: string;
    net_debit: string;
    net_credit: string;
  }>;
};

type ProfitLossPayload = {
  currency: string;
  date_from: string | null;
  date_to: string | null;
  revenue: {
    title: string;
    total_amount: string;
    rows: Array<{
      account_id: number;
      account_code: string;
      account_name: string;
      account_type: string;
      amount: string;
    }>;
  };
  expenses: {
    title: string;
    total_amount: string;
    rows: Array<{
      account_id: number;
      account_code: string;
      account_name: string;
      account_type: string;
      amount: string;
    }>;
  };
  net_profit: string;
};

type BalanceSheetPayload = {
  currency: string;
  as_of_date: string | null;
  assets: {
    title: string;
    total_amount: string;
    rows: Array<{
      account_id: number;
      account_code: string;
      account_name: string;
      account_type: string;
      amount: string;
    }>;
  };
  liabilities: {
    title: string;
    total_amount: string;
    rows: Array<{
      account_id: number;
      account_code: string;
      account_name: string;
      account_type: string;
      amount: string;
    }>;
  };
  equity: {
    title: string;
    total_amount: string;
    rows: Array<{
      account_id: number | string;
      account_code: string;
      account_name: string;
      account_type: string;
      amount: string;
    }>;
  };
  total_liabilities_and_equity: string;
  is_balanced: boolean;
};

type AccountingReportsState = {
  trialBalance: TrialBalancePayload | null;
  profitLoss: ProfitLossPayload | null;
  balanceSheet: BalanceSheetPayload | null;
};

type ApiEnvelope<T> = {
  ok?: boolean;
  report_code?: string;
  data?: T;
  message?: string;
};

type VisibleColumns = {
  report: boolean;
  section: boolean;
  accountCode: boolean;
  accountName: boolean;
  accountType: boolean;
  debit: boolean;
  credit: boolean;
  amount: boolean;
  side: boolean;
};

const SAR_ICON = "/currency/sar.svg";

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

async function fetchAccountingReport<T>(path: string): Promise<T> {
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

  const payload = (await response.json()) as ApiEnvelope<T>;

  if (payload.ok === false) {
    throw new Error(payload.message || "Accounting report request failed");
  }

  if (!payload.data) {
    throw new Error("Accounting report response does not contain data");
  }

  return payload.data;
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
    title: isArabic ? "تقارير المحاسبة" : "Accounting Reports",
    subtitle: isArabic
      ? "تقارير مالية موحدة تشمل ميزان المراجعة، الأرباح والخسائر، والمركز المالي مع فلاتر، تصدير وطباعة."
      : "Unified financial reports including trial balance, profit and loss, and balance sheet with filters, export, and print.",

    back: isArabic ? "لوحة المحاسبة" : "Accounting Overview",
    trialBalance: isArabic ? "ميزان المراجعة" : "Trial Balance",
    profitLoss: isArabic ? "الأرباح والخسائر" : "Profit & Loss",
    balanceSheet: isArabic ? "المركز المالي" : "Balance Sheet",
    ledger: isArabic ? "دفتر الأستاذ" : "General Ledger",

    refresh: isArabic ? "تحديث" : "Refresh",
    export: isArabic ? "تصدير Excel" : "Export Excel",
    exportApi: isArabic ? "تصدير من API" : "API Export",
    print: isArabic ? "طباعة" : "Print",
    columns: isArabic ? "الأعمدة" : "Columns",
    filters: isArabic ? "الفلاتر" : "Filters",
    reset: isArabic ? "إعادة ضبط" : "Reset",

    searchPlaceholder: isArabic
      ? "ابحث باسم الحساب أو الكود أو القسم..."
      : "Search by account name, code, or section...",

    all: isArabic ? "الكل" : "All",
    reportScope: isArabic ? "نطاق التقرير" : "Report Scope",
    dateFrom: isArabic ? "من تاريخ" : "Date From",
    dateTo: isArabic ? "إلى تاريخ" : "Date To",
    asOfDate: isArabic ? "حتى تاريخ" : "As Of Date",
    postedOnly: isArabic ? "القيود المرحلة فقط" : "Posted Only",
    includeZeroAccounts: isArabic
      ? "إظهار الحسابات الصفرية"
      : "Include Zero Accounts",
    includeCurrentEarnings: isArabic
      ? "إظهار صافي الربح الحالي"
      : "Include Current Earnings",

    totalDebit: isArabic ? "إجمالي المدين" : "Total Debit",
    totalCredit: isArabic ? "إجمالي الدائن" : "Total Credit",
    totalAccounts: isArabic ? "الحسابات" : "Accounts",
    netProfit: isArabic ? "صافي الربح" : "Net Profit",
    revenue: isArabic ? "الإيرادات" : "Revenue",
    expenses: isArabic ? "المصاريف" : "Expenses",
    assets: isArabic ? "الأصول" : "Assets",
    liabilities: isArabic ? "الالتزامات" : "Liabilities",
    equity: isArabic ? "حقوق الملكية" : "Equity",
    totalLiabilitiesAndEquity: isArabic
      ? "الالتزامات وحقوق الملكية"
      : "Liabilities & Equity",
    difference: isArabic ? "الفرق" : "Difference",

    report: isArabic ? "التقرير" : "Report",
    section: isArabic ? "القسم" : "Section",
    accountCode: isArabic ? "الكود" : "Code",
    accountName: isArabic ? "اسم الحساب" : "Account Name",
    accountType: isArabic ? "نوع الحساب" : "Account Type",
    debit: isArabic ? "مدين" : "Debit",
    credit: isArabic ? "دائن" : "Credit",
    amount: isArabic ? "المبلغ" : "Amount",
    side: isArabic ? "الجانب" : "Side",

    balanceStatus: isArabic ? "حالة التوازن" : "Balance Status",
    balanced: isArabic ? "متوازن" : "Balanced",
    unbalanced: isArabic ? "غير متوازن" : "Unbalanced",
    currentStatus: isArabic ? "الحالة الحالية" : "Current Status",

    summaryTitle: isArabic ? "ملخص التقارير" : "Reports Summary",
    summaryDesc: isArabic
      ? "أهم المؤشرات المالية الحالية من التقارير المحاسبية."
      : "Key current financial indicators from accounting reports.",

    miniTrialTitle: isArabic ? "ملخص ميزان المراجعة" : "Trial Balance Summary",
    miniProfitTitle: isArabic ? "ملخص الأرباح والخسائر" : "Profit & Loss Summary",
    miniBalanceTitle: isArabic ? "ملخص المركز المالي" : "Balance Sheet Summary",

    detailedReport: isArabic ? "التقرير التفصيلي" : "Detailed Report",
    detailedDesc: isArabic
      ? "عرض موحد لبيانات التقارير المالية حسب الفلاتر الحالية."
      : "Unified view of financial report data based on current filters.",

    noResults: isArabic ? "لا توجد نتائج." : "No results.",
    noResultsDesc: isArabic
      ? "غيّر الفلاتر أو حدّث البيانات ثم حاول مرة أخرى."
      : "Change filters or refresh data and try again.",

    loading: isArabic
      ? "جاري تحميل تقارير المحاسبة..."
      : "Loading accounting reports...",
    loadSuccess: isArabic
      ? "تم تحديث تقارير المحاسبة"
      : "Accounting reports refreshed",
    loadError: isArabic
      ? "تعذر تحميل تقارير المحاسبة"
      : "Unable to load accounting reports",
    invalidDate: isArabic
      ? "لا يمكن أن يكون تاريخ البداية أكبر من تاريخ النهاية"
      : "Date from cannot be greater than date to",

    selectedRows: isArabic ? "صفوف معروضة" : "visible row(s)",
    showing: isArabic ? "المعروض" : "Showing",
    generatedAt: isArabic ? "تاريخ التصدير" : "Generated At",
    reportFilters: isArabic ? "الفلاتر المستخدمة" : "Applied Filters",
    reportSummary: isArabic ? "ملخص التقرير" : "Report Summary",
    reportData: isArabic ? "البيانات التفصيلية" : "Detailed Data",

    columnLabels: {
      report: isArabic ? "التقرير" : "Report",
      section: isArabic ? "القسم" : "Section",
      accountCode: isArabic ? "الكود" : "Code",
      accountName: isArabic ? "اسم الحساب" : "Account Name",
      accountType: isArabic ? "نوع الحساب" : "Account Type",
      debit: isArabic ? "مدين" : "Debit",
      credit: isArabic ? "دائن" : "Credit",
      amount: isArabic ? "المبلغ" : "Amount",
      side: isArabic ? "الجانب" : "Side",
    },
  };
}

/* ============================================================
   🧾 Money Component
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
        src={SAR_ICON}
        alt="SAR"
        width={15}
        height={15}
        className="shrink-0"
      />
    </span>
  );
}

/* ============================================================
   Page
============================================================ */

export default function AccountingReportsPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [isLoading, setIsLoading] = useState(true);

  const [state, setState] = useState<AccountingReportsState>({
    trialBalance: null,
    profitLoss: null,
    balanceSheet: null,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [reportScope, setReportScope] = useState<ReportScope>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [asOfDate, setAsOfDate] = useState("");
  const [postedOnly, setPostedOnly] = useState(true);
  const [includeZeroAccounts, setIncludeZeroAccounts] = useState(false);
  const [includeCurrentEarnings, setIncludeCurrentEarnings] = useState(true);

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    report: true,
    section: true,
    accountCode: true,
    accountName: true,
    accountType: true,
    debit: true,
    credit: true,
    amount: true,
    side: true,
  });

  const t = dictionary(locale);
  const isArabic = locale === "ar";

  async function loadReports(showToast = false) {
    try {
      if (dateFrom && dateTo && dateFrom > dateTo) {
        toast.error(t.invalidDate);
        return;
      }

      setIsLoading(true);

      const trialBalancePath = `/api/accounting/reports/trial-balance/${buildQuery({
        date_from: dateFrom || null,
        date_to: dateTo || null,
        include_zero_accounts: includeZeroAccounts,
        posted_only: postedOnly,
      })}`;

      const profitLossPath = `/api/accounting/reports/profit-loss/${buildQuery({
        date_from: dateFrom || null,
        date_to: dateTo || null,
        include_zero_accounts: includeZeroAccounts,
        posted_only: postedOnly,
      })}`;

      const balanceSheetPath = `/api/accounting/reports/balance-sheet/${buildQuery({
        as_of_date: asOfDate || dateTo || null,
        include_zero_accounts: includeZeroAccounts,
        posted_only: postedOnly,
        include_current_year_earnings: includeCurrentEarnings,
      })}`;

      const [trialBalance, profitLoss, balanceSheet] = await Promise.all([
        fetchAccountingReport<TrialBalancePayload>(trialBalancePath),
        fetchAccountingReport<ProfitLossPayload>(profitLossPath),
        fetchAccountingReport<BalanceSheetPayload>(balanceSheetPath),
      ]);

      setState({
        trialBalance,
        profitLoss,
        balanceSheet,
      });

      if (showToast) {
        toast.success(t.loadSuccess);
      }
    } catch (error) {
      console.error("Accounting reports load error:", error);
      toast.error(t.loadError);

      setState({
        trialBalance: null,
        profitLoss: null,
        balanceSheet: null,
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const currentLocale = readLocale();
    setLocale(currentLocale);
    applyDocumentLocale(currentLocale);
  }, []);

  useEffect(() => {
    loadReports(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => {
    const trial = state.trialBalance;
    const profit = state.profitLoss;
    const balance = state.balanceSheet;

    const totalDebit = trial?.total_debit || "0.00";
    const totalCredit = trial?.total_credit || "0.00";
    const trialDifference = Math.abs(toNumber(totalDebit) - toNumber(totalCredit));
    const trialBalanced = trialDifference === 0;

    return {
      totalAccounts: trial?.total_accounts || 0,
      totalDebit,
      totalCredit,
      trialDifference,
      trialBalanced,

      revenue: profit?.revenue.total_amount || "0.00",
      expenses: profit?.expenses.total_amount || "0.00",
      netProfit: profit?.net_profit || "0.00",

      assets: balance?.assets.total_amount || "0.00",
      liabilities: balance?.liabilities.total_amount || "0.00",
      equity: balance?.equity.total_amount || "0.00",
      totalLiabilitiesAndEquity:
        balance?.total_liabilities_and_equity || "0.00",
      balanceSheetBalanced: Boolean(balance?.is_balanced),
    };
  }, [state]);

  const allRows = useMemo<FinancialReportRow[]>(() => {
    const rows: FinancialReportRow[] = [];

    state.trialBalance?.rows?.forEach((row) => {
      rows.push({
        id: `trial-${row.account_id}-${row.account_code}`,
        report: "TRIAL_BALANCE",
        section: t.trialBalance,
        accountId: row.account_id,
        accountCode: row.account_code,
        accountName: row.account_name,
        accountType: row.account_type,
        debit: row.total_debit,
        credit: row.total_credit,
        amount: String(toNumber(row.net_debit) || toNumber(row.net_credit)),
        side:
          toNumber(row.net_debit) > 0
            ? t.debit
            : toNumber(row.net_credit) > 0
              ? t.credit
              : "-",
      });
    });

    state.profitLoss?.revenue?.rows?.forEach((row) => {
      rows.push({
        id: `pnl-revenue-${row.account_id}-${row.account_code}`,
        report: "PROFIT_LOSS",
        section: t.revenue,
        accountId: row.account_id,
        accountCode: row.account_code,
        accountName: row.account_name,
        accountType: row.account_type,
        debit: "0.00",
        credit: row.amount,
        amount: row.amount,
        side: t.credit,
      });
    });

    state.profitLoss?.expenses?.rows?.forEach((row) => {
      rows.push({
        id: `pnl-expense-${row.account_id}-${row.account_code}`,
        report: "PROFIT_LOSS",
        section: t.expenses,
        accountId: row.account_id,
        accountCode: row.account_code,
        accountName: row.account_name,
        accountType: row.account_type,
        debit: row.amount,
        credit: "0.00",
        amount: row.amount,
        side: t.debit,
      });
    });

    state.balanceSheet?.assets?.rows?.forEach((row) => {
      rows.push({
        id: `bs-assets-${row.account_id}-${row.account_code}`,
        report: "BALANCE_SHEET",
        section: t.assets,
        accountId: row.account_id,
        accountCode: row.account_code,
        accountName: row.account_name,
        accountType: row.account_type,
        debit: row.amount,
        credit: "0.00",
        amount: row.amount,
        side: t.debit,
      });
    });

    state.balanceSheet?.liabilities?.rows?.forEach((row) => {
      rows.push({
        id: `bs-liabilities-${row.account_id}-${row.account_code}`,
        report: "BALANCE_SHEET",
        section: t.liabilities,
        accountId: row.account_id,
        accountCode: row.account_code,
        accountName: row.account_name,
        accountType: row.account_type,
        debit: "0.00",
        credit: row.amount,
        amount: row.amount,
        side: t.credit,
      });
    });

    state.balanceSheet?.equity?.rows?.forEach((row) => {
      rows.push({
        id: `bs-equity-${row.account_id}-${row.account_code}`,
        report: "BALANCE_SHEET",
        section: t.equity,
        accountId: row.account_id,
        accountCode: row.account_code,
        accountName: row.account_name,
        accountType: row.account_type,
        debit: "0.00",
        credit: row.amount,
        amount: row.amount,
        side: t.credit,
      });
    });

    return rows;
  }, [state, t]);

  const filteredRows = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return allRows.filter((row) => {
      const matchesReport = reportScope === "ALL" || row.report === reportScope;

      const matchesSearch = keyword
        ? [
            row.report,
            row.section,
            row.accountCode,
            row.accountName,
            row.accountType,
            row.amount,
            row.side,
          ]
            .join(" ")
            .toLowerCase()
            .includes(keyword)
        : true;

      return matchesReport && matchesSearch;
    });
  }, [allRows, reportScope, searchTerm]);

  const reportCards = [
    {
      title: t.totalDebit,
      value: summary.totalDebit,
      icon: TrendingUp,
      money: true,
      percent: summary.totalAccounts > 0 ? 100 : 0,
    },
    {
      title: t.totalCredit,
      value: summary.totalCredit,
      icon: TrendingDown,
      money: true,
      percent: summary.totalAccounts > 0 ? 100 : 0,
    },
    {
      title: t.totalAccounts,
      value: formatNumber(summary.totalAccounts),
      icon: Layers3,
      money: false,
      percent: 100,
    },
    {
      title: t.balanceStatus,
      value: summary.trialBalanced ? t.balanced : t.unbalanced,
      icon: ShieldCheck,
      money: false,
      percent: summary.trialBalanced ? 100 : 0,
    },
  ];

  const financialCards = [
    {
      title: t.revenue,
      value: summary.revenue,
      icon: TrendingUp,
      bg: "bg-emerald-50",
    },
    {
      title: t.expenses,
      value: summary.expenses,
      icon: WalletCards,
      bg: "bg-sky-50",
    },
    {
      title: t.netProfit,
      value: summary.netProfit,
      icon: PieChart,
      bg: "bg-violet-50",
    },
    {
      title: t.assets,
      value: summary.assets,
      icon: Landmark,
      bg: "bg-teal-50",
    },
  ];

  const reportMiniTables = [
    {
      title: t.miniTrialTitle,
      icon: Calculator,
      rows: [
        {
          label: t.totalDebit,
          value: toNumber(summary.totalDebit),
          percent: summary.totalAccounts > 0 ? 100 : 0,
        },
        {
          label: t.totalCredit,
          value: toNumber(summary.totalCredit),
          percent: summary.totalAccounts > 0 ? 100 : 0,
        },
        {
          label: t.difference,
          value: summary.trialDifference,
          percent: summary.trialBalanced ? 0 : 100,
        },
      ],
    },
    {
      title: t.miniProfitTitle,
      icon: PieChart,
      rows: [
        {
          label: t.revenue,
          value: toNumber(summary.revenue),
          percent: toNumber(summary.revenue) > 0 ? 100 : 0,
        },
        {
          label: t.expenses,
          value: toNumber(summary.expenses),
          percent:
            toNumber(summary.revenue) > 0
              ? Math.min(
                  (toNumber(summary.expenses) / toNumber(summary.revenue)) *
                    100,
                  100,
                )
              : 0,
        },
        {
          label: t.netProfit,
          value: toNumber(summary.netProfit),
          percent:
            toNumber(summary.revenue) > 0
              ? Math.min(
                  Math.abs(
                    toNumber(summary.netProfit) / toNumber(summary.revenue),
                  ) * 100,
                  100,
                )
              : 0,
        },
      ],
    },
    {
      title: t.miniBalanceTitle,
      icon: Landmark,
      rows: [
        {
          label: t.assets,
          value: toNumber(summary.assets),
          percent: toNumber(summary.assets) > 0 ? 100 : 0,
        },
        {
          label: t.liabilities,
          value: toNumber(summary.liabilities),
          percent:
            toNumber(summary.assets) > 0
              ? Math.min(
                  (toNumber(summary.liabilities) / toNumber(summary.assets)) *
                    100,
                  100,
                )
              : 0,
        },
        {
          label: t.equity,
          value: toNumber(summary.equity),
          percent:
            toNumber(summary.assets) > 0
              ? Math.min(
                  (toNumber(summary.equity) / toNumber(summary.assets)) * 100,
                  100,
                )
              : 0,
        },
      ],
    },
  ];

  function handleResetFilters() {
    setSearchTerm("");
    setReportScope("ALL");
    setDateFrom("");
    setDateTo("");
    setAsOfDate("");
    setPostedOnly(true);
    setIncludeZeroAccounts(false);
    setIncludeCurrentEarnings(true);
  }

  function handlePrint() {
    if (typeof window === "undefined") return;
    window.print();
  }

  function handleApiExport(scope: ReportScope) {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      toast.error(t.invalidDate);
      return;
    }

    if (scope === "TRIAL_BALANCE") {
      openExport(
        `/api/accounting/reports/trial-balance/excel/${buildQuery({
          date_from: dateFrom || null,
          date_to: dateTo || null,
          include_zero_accounts: includeZeroAccounts,
          posted_only: postedOnly,
        })}`,
      );
      return;
    }

    if (scope === "PROFIT_LOSS") {
      openExport(
        `/api/accounting/reports/profit-loss/excel/${buildQuery({
          date_from: dateFrom || null,
          date_to: dateTo || null,
          include_zero_accounts: includeZeroAccounts,
          posted_only: postedOnly,
        })}`,
      );
      return;
    }

    if (scope === "BALANCE_SHEET") {
      openExport(
        `/api/accounting/reports/balance-sheet/excel/${buildQuery({
          as_of_date: asOfDate || dateTo || null,
          include_zero_accounts: includeZeroAccounts,
          posted_only: postedOnly,
          include_current_year_earnings: includeCurrentEarnings,
        })}`,
      );
    }
  }

  function handleLocalExcelExport() {
    const workbook = XLSX.utils.book_new();
    const generatedAt = new Date().toISOString();

    const summaryRows = [
      [t.generatedAt, generatedAt],
      [t.reportScope, reportScope],
      [t.dateFrom, dateFrom || "-"],
      [t.dateTo, dateTo || "-"],
      [t.asOfDate, asOfDate || dateTo || "-"],
      [t.postedOnly, postedOnly ? "TRUE" : "FALSE"],
      [t.includeZeroAccounts, includeZeroAccounts ? "TRUE" : "FALSE"],
      [t.includeCurrentEarnings, includeCurrentEarnings ? "TRUE" : "FALSE"],
      [],
      [t.totalAccounts, summary.totalAccounts],
      [t.totalDebit, toNumber(summary.totalDebit)],
      [t.totalCredit, toNumber(summary.totalCredit)],
      [t.difference, summary.trialDifference],
      [t.netProfit, toNumber(summary.netProfit)],
      [t.assets, toNumber(summary.assets)],
      [t.liabilities, toNumber(summary.liabilities)],
      [t.equity, toNumber(summary.equity)],
      [t.balanceStatus, summary.balanceSheetBalanced ? t.balanced : t.unbalanced],
    ];

    const dataRows = filteredRows.map((row) => ({
      [t.report]: reportLabel(row.report, locale),
      [t.section]: row.section,
      [t.accountCode]: row.accountCode,
      [t.accountName]: row.accountName,
      [t.accountType]: row.accountType,
      [t.debit]: toNumber(row.debit),
      [t.credit]: toNumber(row.credit),
      [t.amount]: toNumber(row.amount),
      [t.side]: row.side,
    }));

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    const dataSheet = XLSX.utils.json_to_sheet(dataRows);

    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
    XLSX.utils.book_append_sheet(workbook, dataSheet, "Report Data");

    XLSX.writeFile(workbook, "accounting_reports.xlsx");
  }

  const columnOptions: Array<{
    key: keyof VisibleColumns;
    label: string;
  }> = [
    { key: "report", label: t.columnLabels.report },
    { key: "section", label: t.columnLabels.section },
    { key: "accountCode", label: t.columnLabels.accountCode },
    { key: "accountName", label: t.columnLabels.accountName },
    { key: "accountType", label: t.columnLabels.accountType },
    { key: "debit", label: t.columnLabels.debit },
    { key: "credit", label: t.columnLabels.credit },
    { key: "amount", label: t.columnLabels.amount },
    { key: "side", label: t.columnLabels.side },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6 print:p-0" dir="ltr">
      <div className="flex flex-col gap-4 print:hidden lg:flex-row lg:items-start lg:justify-between">
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
            <Link href="/system/accounting/ledger">
              <BookOpenCheck className="h-4 w-4" />
              {t.ledger}
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-10 gap-2 rounded-xl bg-white px-4"
            onClick={() => loadReports(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            {t.refresh}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-10 gap-2 rounded-xl bg-white px-4"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4" />
            {t.print}
          </Button>

          <Button
            type="button"
            className="h-10 gap-2 rounded-xl bg-slate-950 px-4 text-white hover:bg-slate-800"
            onClick={handleLocalExcelExport}
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

      <div className="hidden print:block print:space-y-2 print:border-b print:pb-4">
        <h1 className="text-xl font-bold">{t.title}</h1>
        <p className="text-sm text-slate-600">{t.subtitle}</p>
      </div>

      <Card
        className="rounded-2xl border bg-card shadow-sm print:shadow-none"
        dir={isArabic ? "rtl" : "ltr"}
      >
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-lg font-bold">{t.summaryTitle}</CardTitle>
            <CardDescription>{t.summaryDesc}</CardDescription>
          </div>

          <div className="print:hidden">
            <Badge
              variant="outline"
              className={
                summary.trialBalanced && summary.balanceSheetBalanced
                  ? "rounded-full border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "rounded-full border-amber-200 bg-amber-50 text-amber-700"
              }
            >
              <BadgeCheck className="me-1 h-3.5 w-3.5" />
              {summary.trialBalanced && summary.balanceSheetBalanced
                ? t.balanced
                : t.unbalanced}
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {reportCards.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="rounded-2xl border bg-background p-4"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        {item.title}
                      </p>

                      <p className="text-2xl font-bold text-slate-950">
                        {item.money ? (
                          <MoneyValue value={item.value} />
                        ) : (
                          item.value
                        )}
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border bg-muted">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(item.percent, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {financialCards.map((item) => {
          const Icon = item.icon;

          return (
            <Card
              key={item.title}
              className="rounded-2xl border bg-card shadow-sm print:shadow-none"
              dir={isArabic ? "rtl" : "ltr"}
            >
              <CardContent className="p-5">
                <div className={`rounded-2xl ${item.bg} p-4`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-500">{item.title}</p>
                      <p className="mt-2 text-2xl font-bold text-slate-950">
                        <MoneyValue value={item.value} />
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm">
                      <Icon className="h-5 w-5 text-slate-900" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card
        className="rounded-2xl border bg-card shadow-sm print:hidden"
        dir={isArabic ? "rtl" : "ltr"}
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <FilterIcon className="h-4 w-4" />
            {t.filters}
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_auto]">
            <div className="relative">
              <Search
                className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${
                  isArabic ? "right-3" : "left-3"
                }`}
              />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t.searchPlaceholder}
                className={`h-11 rounded-xl ${
                  isArabic ? "pr-10" : "pl-10"
                }`}
              />
            </div>

            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="h-11 rounded-xl"
              aria-label={t.dateFrom}
            />

            <Input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="h-11 rounded-xl"
              aria-label={t.dateTo}
            />

            <Input
              type="date"
              value={asOfDate}
              onChange={(event) => setAsOfDate(event.target.value)}
              className="h-11 rounded-xl"
              aria-label={t.asOfDate}
            />

            <Button
              type="button"
              className="h-11 rounded-xl"
              onClick={() => loadReports(true)}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="me-2 h-4 w-4" />
              )}
              {t.refresh}
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {(
              [
                "ALL",
                "TRIAL_BALANCE",
                "PROFIT_LOSS",
                "BALANCE_SHEET",
              ] as ReportScope[]
            ).map((scope) => (
              <Button
                key={scope}
                type="button"
                size="sm"
                variant={reportScope === scope ? "default" : "outline"}
                className="rounded-xl"
                onClick={() => setReportScope(scope)}
              >
                {scope === "ALL" ? t.all : reportLabel(scope, locale)}
              </Button>
            ))}

            <div className="mx-1 h-6 w-px bg-border" />

            <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
              <Checkbox
                checked={postedOnly}
                onCheckedChange={(value) => setPostedOnly(Boolean(value))}
              />
              {t.postedOnly}
            </label>

            <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
              <Checkbox
                checked={includeZeroAccounts}
                onCheckedChange={(value) =>
                  setIncludeZeroAccounts(Boolean(value))
                }
              />
              {t.includeZeroAccounts}
            </label>

            <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
              <Checkbox
                checked={includeCurrentEarnings}
                onCheckedChange={(value) =>
                  setIncludeCurrentEarnings(Boolean(value))
                }
              />
              {t.includeCurrentEarnings}
            </label>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-xl"
              onClick={handleResetFilters}
            >
              {t.reset}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                >
                  <ColumnsIcon className="me-2 h-4 w-4" />
                  {t.columns}
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align={isArabic ? "start" : "end"}
                className="w-56 rounded-2xl"
              >
                <div dir={isArabic ? "rtl" : "ltr"}>
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
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {reportMiniTables.map((report) => (
          <ReportMiniTable
            key={report.title}
            title={report.title}
            icon={report.icon}
            rows={report.rows}
            loading={isLoading}
            loadingText={t.loading}
            noResults={t.noResults}
          />
        ))}
      </div>

      <Card className="rounded-2xl border bg-card shadow-sm print:hidden">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Download className="h-4 w-4" />
            {t.exportApi}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => handleApiExport("TRIAL_BALANCE")}
            >
              <Calculator className="me-2 h-4 w-4" />
              {t.trialBalance}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => handleApiExport("PROFIT_LOSS")}
            >
              <PieChart className="me-2 h-4 w-4" />
              {t.profitLoss}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => handleApiExport("BALANCE_SHEET")}
            >
              <Landmark className="me-2 h-4 w-4" />
              {t.balanceSheet}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card
        className="rounded-2xl border bg-card shadow-sm print:shadow-none"
        dir={isArabic ? "rtl" : "ltr"}
      >
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg font-bold">
                <FileText className="h-5 w-5" />
                {t.detailedReport}
              </CardTitle>
              <CardDescription>{t.detailedDesc}</CardDescription>
            </div>

            <Badge variant="secondary" className="w-fit rounded-full">
              {t.showing}: {formatNumber(filteredRows.length)}
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-hidden rounded-2xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  {visibleColumns.report ? <TableHead>{t.report}</TableHead> : null}
                  {visibleColumns.section ? <TableHead>{t.section}</TableHead> : null}
                  {visibleColumns.accountCode ? (
                    <TableHead>{t.accountCode}</TableHead>
                  ) : null}
                  {visibleColumns.accountName ? (
                    <TableHead>{t.accountName}</TableHead>
                  ) : null}
                  {visibleColumns.accountType ? (
                    <TableHead>{t.accountType}</TableHead>
                  ) : null}
                  {visibleColumns.debit ? <TableHead>{t.debit}</TableHead> : null}
                  {visibleColumns.credit ? <TableHead>{t.credit}</TableHead> : null}
                  {visibleColumns.amount ? <TableHead>{t.amount}</TableHead> : null}
                  {visibleColumns.side ? <TableHead>{t.side}</TableHead> : null}
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-28">
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t.loading}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredRows.length ? (
                  filteredRows.map((row) => (
                    <TableRow key={row.id}>
                      {visibleColumns.report ? (
                        <TableCell>
                          <Badge variant="outline" className="rounded-full">
                            {reportLabel(row.report, locale)}
                          </Badge>
                        </TableCell>
                      ) : null}

                      {visibleColumns.section ? (
                        <TableCell className="font-medium">
                          {row.section}
                        </TableCell>
                      ) : null}

                      {visibleColumns.accountCode ? (
                        <TableCell className="font-medium">
                          {row.accountCode || "-"}
                        </TableCell>
                      ) : null}

                      {visibleColumns.accountName ? (
                        <TableCell>
                          <div className="min-w-[220px]">
                            {row.accountName || "-"}
                          </div>
                        </TableCell>
                      ) : null}

                      {visibleColumns.accountType ? (
                        <TableCell>{row.accountType || "-"}</TableCell>
                      ) : null}

                      {visibleColumns.debit ? (
                        <TableCell>
                          <MoneyValue value={row.debit} />
                        </TableCell>
                      ) : null}

                      {visibleColumns.credit ? (
                        <TableCell>
                          <MoneyValue value={row.credit} />
                        </TableCell>
                      ) : null}

                      {visibleColumns.amount ? (
                        <TableCell className="font-semibold">
                          <MoneyValue value={row.amount} />
                        </TableCell>
                      ) : null}

                      {visibleColumns.side ? (
                        <TableCell>{row.side || "-"}</TableCell>
                      ) : null}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center">
                      <div className="space-y-2">
                        <p className="font-semibold">{t.noResults}</p>
                        <p className="text-sm text-muted-foreground">
                          {t.noResultsDesc}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-end">
            <div className="text-muted-foreground flex-1 text-sm">
              {formatNumber(filteredRows.length)} {t.selectedRows}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============================================================
   🔹 Small Helpers & Components
============================================================ */

function reportLabel(scope: ReportScope, locale: AppLocale) {
  const isArabic = locale === "ar";

  if (scope === "TRIAL_BALANCE") {
    return isArabic ? "ميزان المراجعة" : "Trial Balance";
  }

  if (scope === "PROFIT_LOSS") {
    return isArabic ? "الأرباح والخسائر" : "Profit & Loss";
  }

  if (scope === "BALANCE_SHEET") {
    return isArabic ? "المركز المالي" : "Balance Sheet";
  }

  return isArabic ? "الكل" : "All";
}

function ReportMiniTable({
  title,
  icon: Icon,
  rows,
  loading,
  loadingText,
  noResults,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  rows: Array<{ label: string; value: number; percent: number }>;
  loading: boolean;
  loadingText: string;
  noResults: string;
}) {
  return (
    <Card className="rounded-2xl border bg-card shadow-sm print:shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {loadingText}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {noResults}
          </div>
        ) : (
          rows.map((row) => (
            <div key={row.label} className="rounded-xl border bg-background p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{row.label}</p>
                  <p className="text-muted-foreground text-xs">
                    <span dir="ltr">{formatMoney(row.value)}</span>
                  </p>
                </div>

                <Badge variant="secondary" className="rounded-full">
                  {formatPercent(row.percent)}%
                </Badge>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(row.percent, 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}