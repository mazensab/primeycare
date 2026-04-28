"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookOpenCheck,
  Building2,
  Calculator,
  CheckCircle2,
  Download,
  FileText,
  Filter,
  Landmark,
  Layers3,
  ListChecks,
  Loader2,
  PieChart,
  Plus,
  ReceiptText,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/* ============================================================
   📂 app/system/accounting/page.tsx
   🧠 Primey Care | Accounting Module Home
   ------------------------------------------------------------
   ✅ نفس تنسيق صفحة المراكز
   ✅ نفس توزيع المساحات والكروت
   ✅ بيانات المحاسبة من API الحقيقي
   ✅ دعم عربي / إنجليزي
   ✅ أرقام إنجليزية دائمًا
   ✅ رمز العملة الرسمي
============================================================ */

type AppLocale = "ar" | "en";

type ApiEnvelope<T> = {
  ok?: boolean;
  report_code?: string;
  data?: T;
  message?: string;
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
    rows: unknown[];
  };
  expenses: {
    title: string;
    total_amount: string;
    rows: unknown[];
  };
  net_profit: string;
};

type BalanceSheetPayload = {
  currency: string;
  as_of_date: string | null;
  assets: {
    title: string;
    total_amount: string;
    rows: unknown[];
  };
  liabilities: {
    title: string;
    total_amount: string;
    rows: unknown[];
  };
  equity: {
    title: string;
    total_amount: string;
    rows: unknown[];
  };
  total_liabilities_and_equity: string;
  is_balanced: boolean;
};

type JournalEntry = {
  id: number;
  entry_number: string;
  entry_date: string | null;
  status: string;
  posting_source: string;
  reference: string;
  external_reference: string;
  description: string;
  notes: string;
  currency: string;
  total_debit: string;
  total_credit: string;
  is_balanced: boolean;
  posted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type JournalsPayload = {
  filters: Record<string, unknown>;
  summary: {
    total_entries: number;
    total_debit: string;
    total_credit: string;
    balanced_entries_count: number;
    unbalanced_entries_count: number;
    is_balanced_total: boolean;
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
  results: JournalEntry[];
};

type AccountingState = {
  trialBalance: TrialBalancePayload | null;
  profitLoss: ProfitLossPayload | null;
  balanceSheet: BalanceSheetPayload | null;
  journals: JournalsPayload | null;
};

const CURRENCY_ICON_PATH = "/currency/sar.svg";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

/* ============================================================
   Locale
============================================================ */

function readStoredLocale(): AppLocale {
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

function applyLocale(locale: AppLocale) {
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

function getApiUrl(path: string): string {
  const cleanBase = API_BASE_URL.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

async function fetchAccountingData<T>(path: string): Promise<T> {
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
    throw new Error(payload.message || "Accounting request failed");
  }

  if (!payload.data) {
    throw new Error("Accounting response does not contain data");
  }

  return payload.data;
}

function openExport(path: string) {
  if (typeof window === "undefined") return;
  window.open(getApiUrl(path), "_blank", "noopener,noreferrer");
}

/* ============================================================
   Dictionary
============================================================ */

function getText(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    pageTitle: ar ? "المحاسبة" : "Accounting",
    pageSubtitle: ar
      ? "متابعة القيود اليومية، دليل الحسابات، دفتر الأستاذ، والتقارير المالية من بيانات حقيقية."
      : "Monitor journals, chart of accounts, ledger, and financial reports from live data.",

    refresh: ar ? "تحديث" : "Refresh",
    reports: ar ? "التقارير" : "Reports",
    export: ar ? "تصدير" : "Export",
    createEntry: ar ? "إنشاء قيد" : "Create Entry",

    accountingStatus: ar ? "حالة المحاسبة" : "Accounting Status",
    accountingStatusDesc: ar
      ? "تحليل سريع لحالة القيود والتوازن المحاسبي."
      : "Quick analysis of journals and accounting balance.",

    featuredReports: ar ? "التقارير المهمة" : "Featured Reports",
    featuredReportsDesc: ar
      ? "عرض مختصر لأهم التقارير المالية الحالية."
      : "A compact view of key financial reports.",

    total: ar ? "الإجمالي" : "Total",
    posted: ar ? "مرحل" : "Posted",
    unbalanced: ar ? "غير متوازن" : "Unbalanced",
    accounts: ar ? "الحسابات" : "Accounts",

    searchPlaceholder: ar ? "ابحث في القيود..." : "Search in journals...",
    settings: ar ? "الأعمدة" : "Columns",

    entryNumber: ar ? "رقم القيد" : "Entry No.",
    description: ar ? "الوصف" : "Description",
    source: ar ? "المصدر" : "Source",
    date: ar ? "التاريخ" : "Date",
    amount: ar ? "المبلغ" : "Amount",
    status: ar ? "الحالة" : "Status",
    action: ar ? "الإجراء" : "Action",

    noJournals: ar ? "لا توجد قيود بعد" : "No journals yet",
    noJournalsDesc: ar
      ? "عند ترحيل الفواتير أو المدفوعات ستظهر القيود هنا مباشرة."
      : "When invoices or payments are posted, journals will appear here.",

    trialBalance: ar ? "ميزان المراجعة" : "Trial Balance",
    profitLoss: ar ? "الأرباح والخسائر" : "Profit & Loss",
    balanceSheet: ar ? "المركز المالي" : "Balance Sheet",

    revenue: ar ? "الإيرادات" : "Revenue",
    expenses: ar ? "المصاريف" : "Expenses",
    netProfit: ar ? "صافي الربح" : "Net Profit",
    balancedStatus: ar ? "متوازن" : "Balanced",

    debit: ar ? "مدين" : "Debit",
    credit: ar ? "دائن" : "Credit",

    actionsTitle: ar ? "إجراءات وحدة المحاسبة" : "Accounting Module Actions",
    actionsDesc: ar
      ? "اختصارات منظمة للوصول إلى أهم صفحات وحدة المحاسبة بدون عرض روابط خام."
      : "Organized shortcuts to key accounting pages.",

    journalsList: ar ? "قائمة القيود" : "Journal List",
    journalsListDesc: ar
      ? "استعراض القيود اليومية، البحث، التصفية، ومراجعة التوازن."
      : "Browse journals, search, filter, and review balance.",

    chartOfAccounts: ar ? "دليل الحسابات" : "Chart of Accounts",
    chartOfAccountsDesc: ar
      ? "استعراض شجرة الحسابات السعودية المعتمدة."
      : "Browse the approved chart of accounts.",

    ledger: ar ? "دفتر الأستاذ" : "General Ledger",
    ledgerDesc: ar
      ? "عرض حركة الحسابات مع الرصيد الجاري."
      : "View account movements with running balance.",

    financialReports: ar ? "تقارير المحاسبة" : "Accounting Reports",
    financialReportsDesc: ar
      ? "ميزان المراجعة، الأرباح والخسائر، والمركز المالي."
      : "Trial balance, profit and loss, and balance sheet.",

    new: ar ? "جديد" : "New",
    analysis: ar ? "تحليل" : "Analysis",
    manage: ar ? "إدارة" : "Manage",
    view: ar ? "عرض" : "View",

    loading: ar ? "جاري تحميل البيانات..." : "Loading data...",
    loadSuccess: ar ? "تم تحديث بيانات المحاسبة" : "Accounting data refreshed",
    loadError: ar ? "تعذر تحميل بيانات المحاسبة" : "Unable to load accounting data",

    previous: ar ? "السابق" : "Previous",
    next: ar ? "التالي" : "Next",
  };
}

/* ============================================================
   Components
============================================================ */

function MoneyValue({
  value,
  strong = false,
}: {
  value: string | number | null | undefined;
  strong?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 ${
        strong ? "font-bold text-slate-950" : ""
      }`}
      dir="ltr"
    >
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

function JournalStatusBadge({
  status,
  locale,
}: {
  status: string;
  locale: AppLocale;
}) {
  const ar = locale === "ar";
  const normalized = String(status || "").toUpperCase();

  const labels: Record<string, string> = {
    POSTED: ar ? "مرحل" : "Posted",
    DRAFT: ar ? "مسودة" : "Draft",
    CANCELLED: ar ? "ملغي" : "Cancelled",
  };

  const className =
    normalized === "POSTED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : normalized === "DRAFT"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : normalized === "CANCELLED"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <Badge variant="outline" className={`rounded-full ${className}`}>
      {labels[normalized] || status || "-"}
    </Badge>
  );
}

/* ============================================================
   Page
============================================================ */

export default function SystemAccountingPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [state, setState] = useState<AccountingState>({
    trialBalance: null,
    profitLoss: null,
    balanceSheet: null,
    journals: null,
  });

  const t = getText(locale);
  const isArabic = locale === "ar";

  async function loadData(showToast = false) {
    try {
      setLoading(true);

      const [trialBalance, profitLoss, balanceSheet, journals] =
        await Promise.all([
          fetchAccountingData<TrialBalancePayload>(
            "/api/accounting/reports/trial-balance/?posted_only=true"
          ),
          fetchAccountingData<ProfitLossPayload>(
            "/api/accounting/reports/profit-loss/?posted_only=true"
          ),
          fetchAccountingData<BalanceSheetPayload>(
            "/api/accounting/reports/balance-sheet/?posted_only=true"
          ),
          fetchAccountingData<JournalsPayload>(
            "/api/accounting/journals/?page=1&page_size=10&ordering=-entry_date"
          ),
        ]);

      setState({
        trialBalance,
        profitLoss,
        balanceSheet,
        journals,
      });

      if (showToast) {
        toast.success(t.loadSuccess);
      }
    } catch (error) {
      console.error("Accounting dashboard load error:", error);
      toast.error(t.loadError);

      setState({
        trialBalance: null,
        profitLoss: null,
        balanceSheet: null,
        journals: null,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const currentLocale = readStoredLocale();
    setLocale(currentLocale);
    applyLocale(currentLocale);
  }, []);

  useEffect(() => {
    loadData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => {
    const totalDebit =
      state.trialBalance?.total_debit ||
      state.journals?.summary.total_debit ||
      "0.00";

    const totalCredit =
      state.trialBalance?.total_credit ||
      state.journals?.summary.total_credit ||
      "0.00";

    const totalEntries = state.journals?.summary.total_entries || 0;
    const postedEntries = state.journals?.summary.balanced_entries_count || 0;
    const unbalancedEntries =
      state.journals?.summary.unbalanced_entries_count || 0;

    const postedPercent =
      totalEntries > 0 ? (postedEntries / totalEntries) * 100 : 0;

    const unbalancedPercent =
      totalEntries > 0 ? (unbalancedEntries / totalEntries) * 100 : 0;

    const isBalanced =
      state.journals?.summary.is_balanced_total ??
      state.balanceSheet?.is_balanced ??
      toNumber(totalDebit) === toNumber(totalCredit);

    return {
      totalDebit,
      totalCredit,
      totalEntries,
      totalAccounts: state.trialBalance?.total_accounts || 0,
      postedEntries,
      unbalancedEntries,
      postedPercent,
      unbalancedPercent,
      isBalanced,
      revenue: state.profitLoss?.revenue.total_amount || "0.00",
      expenses: state.profitLoss?.expenses.total_amount || "0.00",
      netProfit: state.profitLoss?.net_profit || "0.00",
    };
  }, [state]);

  const filteredJournals = useMemo(() => {
    const journals = state.journals?.results || [];
    const keyword = searchTerm.trim().toLowerCase();

    if (!keyword) return journals;

    return journals.filter((entry) =>
      [
        entry.entry_number,
        entry.description,
        entry.reference,
        entry.external_reference,
        entry.posting_source,
        entry.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [state.journals?.results, searchTerm]);

  const featuredReports = [
    {
      title: t.trialBalance,
      subtitle: t.accounts,
      value: formatNumber(summary.totalAccounts),
      href: "/system/accounting/reports",
      icon: ListChecks,
    },
    {
      title: t.profitLoss,
      subtitle: t.netProfit,
      value: formatMoney(summary.netProfit),
      href: "/system/accounting/reports",
      icon: PieChart,
    },
    {
      title: t.balanceSheet,
      subtitle: t.status,
      value: summary.isBalanced ? t.balancedStatus : t.unbalanced,
      href: "/system/accounting/reports",
      icon: Landmark,
    },
  ];

  const summaryCards = [
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
      title: t.status,
      value: summary.isBalanced ? t.balancedStatus : t.unbalanced,
      icon: ShieldCheck,
      bg: "bg-teal-50",
      isText: true,
    },
  ];

  const actionCards = [
    {
      title: t.journalsList,
      description: t.journalsListDesc,
      href: "/system/accounting/journals",
      icon: ReceiptText,
      badge: formatNumber(summary.totalEntries),
      action: t.manage,
    },
    {
      title: t.chartOfAccounts,
      description: t.chartOfAccountsDesc,
      href: "/system/accounting/accounts",
      icon: Layers3,
      badge: t.new,
      action: t.view,
    },
    {
      title: t.ledger,
      description: t.ledgerDesc,
      href: "/system/accounting/ledger",
      icon: BookOpenCheck,
      badge: t.analysis,
      action: t.view,
    },
    {
      title: t.financialReports,
      description: t.financialReportsDesc,
      href: "/system/accounting/reports",
      icon: BarChart3,
      badge: t.reports,
      action: t.view,
    },
  ];

  return (
    <div className="space-y-4 p-4 md:p-6" dir="ltr">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            className="h-10 gap-2 rounded-xl bg-slate-950 px-4 text-white hover:bg-slate-800"
          >
            <Link href="/system/accounting/journals">
              <Plus className="h-4 w-4" />
              {t.createEntry}
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-10 gap-2 rounded-xl bg-white px-4"
            onClick={() => openExport("/api/accounting/journals/excel/")}
          >
            <BarChart3 className="h-4 w-4" />
            {t.reports}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-10 gap-2 rounded-xl bg-white px-4"
            onClick={() => loadData(true)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            {t.refresh}
          </Button>
        </div>

        <div
          className={`space-y-1 ${isArabic ? "text-right" : "text-left"}`}
          dir={isArabic ? "rtl" : "ltr"}
        >
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            {t.pageTitle}
          </h1>
          <p className="text-sm leading-6 text-slate-500">{t.pageSubtitle}</p>
        </div>
      </div>

      {/* Main Row */}
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        {/* Status Card */}
        <Card
          className="rounded-2xl border-slate-200 bg-white shadow-sm"
          dir={isArabic ? "rtl" : "ltr"}
        >
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg font-bold text-slate-950">
                {t.accountingStatus}
              </CardTitle>
              <CardDescription className="mt-1">
                {t.accountingStatusDesc}
              </CardDescription>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-2 rounded-xl bg-white"
              onClick={() =>
                openExport("/api/accounting/reports/trial-balance/excel/")
              }
            >
              <Download className="h-4 w-4" />
              {t.export}
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>{t.total}</span>
                  <Building2 className="h-4 w-4 text-slate-400" />
                </div>
                <p className="text-2xl font-bold text-slate-950">
                  {formatNumber(summary.totalEntries)}
                </p>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 w-full rounded-full bg-slate-950" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>{t.posted}</span>
                  <FileText className="h-4 w-4 text-slate-400" />
                </div>
                <p className="text-2xl font-bold text-slate-950">
                  {formatNumber(summary.postedEntries)}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-emerald-600">
                    {formatPercent(summary.postedPercent)}%
                  </span>
                  <div className="h-2 flex-1 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{
                        width: `${Math.min(summary.postedPercent, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>{t.unbalanced}</span>
                  <ShieldCheck className="h-4 w-4 text-slate-400" />
                </div>
                <p className="text-2xl font-bold text-slate-950">
                  {formatNumber(summary.unbalancedEntries)}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-emerald-600">
                    {formatPercent(summary.unbalancedPercent)}%
                  </span>
                  <div className="h-2 flex-1 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-amber-500"
                      style={{
                        width: `${Math.min(summary.unbalancedPercent, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>{t.accounts}</span>
                  <Layers3 className="h-4 w-4 text-slate-400" />
                </div>
                <p className="text-2xl font-bold text-slate-950">
                  {formatNumber(summary.totalAccounts)}
                </p>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 w-full rounded-full bg-slate-950" />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
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

              <Button
                type="button"
                variant="outline"
                className="h-11 gap-2 rounded-xl bg-white"
              >
                <Filter className="h-4 w-4" />
                {t.settings}
              </Button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[1.1fr_1.4fr_1fr_1fr_1fr_1fr_0.8fr] border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                <div>{t.entryNumber}</div>
                <div>{t.description}</div>
                <div>{t.source}</div>
                <div>{t.date}</div>
                <div>{t.amount}</div>
                <div>{t.status}</div>
                <div>{t.action}</div>
              </div>

              {loading ? (
                <div className="flex h-40 items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.loading}
                </div>
              ) : filteredJournals.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {filteredJournals.map((entry) => (
                    <div
                      key={entry.id}
                      className="grid grid-cols-[1.1fr_1.4fr_1fr_1fr_1fr_1fr_0.8fr] items-center px-4 py-3 text-sm"
                    >
                      <div className="font-medium text-slate-950">
                        {entry.entry_number}
                      </div>
                      <div className="truncate text-slate-600">
                        {entry.description || entry.reference || "-"}
                      </div>
                      <div className="text-slate-600">
                        {entry.posting_source || "-"}
                      </div>
                      <div className="text-slate-600">
                        {formatDate(entry.entry_date, locale)}
                      </div>
                      <div className="font-semibold text-slate-950">
                        <MoneyValue value={entry.total_debit} />
                      </div>
                      <div>
                        <JournalStatusBadge
                          status={entry.status}
                          locale={locale}
                        />
                      </div>
                      <div>
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="h-8 rounded-lg px-2"
                        >
                          <Link href={`/system/accounting/journals/${entry.id}`}>
                            {t.view}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-40 flex-col items-center justify-center text-center">
                  <p className="font-semibold text-slate-950">{t.noJournals}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    {t.noJournalsDesc}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end text-sm text-slate-500">
              <span>
                {formatNumber(filteredJournals.length)} /{" "}
                {formatNumber(state.journals?.pagination.total_items || 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Featured Reports Card */}
        <Card
          className="rounded-2xl border-slate-200 bg-white shadow-sm"
          dir={isArabic ? "rtl" : "ltr"}
        >
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg font-bold text-slate-950">
                {t.featuredReports}
              </CardTitle>
              <CardDescription className="mt-1">
                {t.featuredReportsDesc}
              </CardDescription>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white">
              <ListChecks className="h-5 w-5 text-slate-700" />
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {featuredReports.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-950 text-white">
                          <Icon className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                          <p className="font-bold text-slate-950">
                            {item.title}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="text-left">
                        <p className="text-lg font-bold text-slate-950">
                          {item.value}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}

              <div className="rounded-2xl border border-dashed border-slate-200 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{t.debit}</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">
                      <MoneyValue value={summary.totalDebit} />
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{t.credit}</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">
                      <MoneyValue value={summary.totalCredit} />
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
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
                        {card.isText ? (
                          card.value
                        ) : (
                          <MoneyValue value={card.value} />
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

      {/* Actions */}
      <Card
        className="rounded-2xl border-slate-200 bg-white shadow-sm"
        dir={isArabic ? "rtl" : "ltr"}
      >
        <CardHeader>
          <CardTitle className="text-lg font-bold text-slate-950">
            {t.actionsTitle}
          </CardTitle>
          <CardDescription>{t.actionsDesc}</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {actionCards.map((card) => {
              const Icon = card.icon;

              return (
                <Link
                  key={card.href}
                  href={card.href}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:bg-slate-50 hover:shadow-sm"
                >
                  <div className="mb-8 flex items-center justify-between">
                    <Badge
                      variant="secondary"
                      className="rounded-full bg-slate-100 text-slate-700"
                    >
                      {card.badge}
                    </Badge>

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white transition group-hover:scale-105">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-950">{card.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {card.description}
                    </p>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-5 h-9 rounded-xl bg-white"
                    >
                      {card.action}
                    </Button>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}