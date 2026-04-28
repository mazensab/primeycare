"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
  RefreshCcw,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import { apiGet, buildApiUrl } from "@/lib/api";

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
   📂 app/system/accounting/accounts/[id]/page.tsx
   🧠 Primey Care | Account Detail
   ------------------------------------------------------------
   ✅ تفاصيل الحساب + حركة الحساب
   ✅ يعتمد على API دفتر الأستاذ مع account_id
   ✅ بحث + فلاتر + أعمدة + فرز + صفحات
   ✅ تصدير Excel من API
   ✅ دعم عربي / إنجليزي
   ✅ أرقام إنجليزية دائمًا
   ✅ رمز العملة الرسمي
   ✅ بدون localhost hardcoded
============================================================ */

type AppLocale = "ar" | "en";

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
  data?: T;
  message?: string;
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

function buildQuery(
  params: Record<string, string | number | boolean | null | undefined>
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
  excel = false,
}: {
  accountId: string;
  dateFrom: string;
  dateTo: string;
  postedOnly: boolean;
  includeOpening: boolean;
  page: number;
  pageSize: number;
  ordering: string;
  excel?: boolean;
}) {
  const basePath = excel
    ? "/api/accounting/ledger/excel/"
    : "/api/accounting/ledger/";

  return `${basePath}${buildQuery({
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

function normalizeLedgerPayload(raw: ApiEnvelope<LedgerPayload> | LedgerPayload) {
  const envelope = raw as ApiEnvelope<LedgerPayload>;

  if (envelope?.ok === false) {
    throw new Error(envelope.message || "Account detail request failed");
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

function openExport(path: string) {
  if (typeof window === "undefined") return;
  window.open(buildApiUrl(path), "_blank", "noopener,noreferrer");
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
  direction: SortDirection
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
  locale: AppLocale
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
    export: isArabic ? "تصدير Excel" : "Export Excel",

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
    loading: isArabic ? "جاري تحميل تفاصيل الحساب..." : "Loading account detail...",

    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",
    page: isArabic ? "صفحة" : "Page",
    of: isArabic ? "من" : "of",

    invalidAccount: isArabic ? "رقم الحساب غير صحيح" : "Invalid account ID",
    loadSuccess: isArabic ? "تم تحديث تفاصيل الحساب" : "Account detail refreshed",
    loadError: isArabic
      ? "تعذر تحميل تفاصيل الحساب"
      : "Failed to load account detail",
  };
}

/* ============================================================
   UI Helpers
============================================================ */

function MoneyValue({ value }: { value: string | number | null | undefined }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap font-semibold">
      <Image
        src={CURRENCY_ICON_PATH}
        alt="SAR"
        width={15}
        height={15}
        className="inline-block"
      />
      {formatMoney(value)}
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
      className="inline-flex items-center gap-1 font-semibold hover:text-slate-950"
    >
      {label}
      <ArrowDownUp
        className={`h-3.5 w-3.5 ${
          isActive ? "text-slate-950" : "text-slate-400"
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
    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-2">
          <p className="text-sm text-slate-500">{title}</p>
          <div className="text-2xl font-bold tracking-tight text-slate-950">
            {money ? <MoneyValue value={value} /> : value}
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 p-3">
          <Icon className="h-5 w-5 text-slate-500" />
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-950">{value}</span>
    </div>
  );
}

/* ============================================================
   Page
============================================================ */

export default function AccountDetailPage() {
  const params = useParams<{ id: string }>();

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [payload, setPayload] = useState<LedgerPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [postedOnly, setPostedOnly] = useState(true);
  const [includeOpening, setIncludeOpening] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("entry_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
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
  });

  const accountId = String(params?.id || "");
  const t = dictionary(locale);
  const isArabic = locale === "ar";

  function validateInputs() {
    if (!accountId || Number.isNaN(Number(accountId))) {
      toast.error(t.invalidAccount);
      return false;
    }

    return true;
  }

  async function loadAccountDetail(showToast = false) {
    try {
      if (!validateInputs()) return;

      setLoading(true);

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
      toast.error(t.loadError);
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }

  function handleExport() {
    if (!validateInputs()) return;

    const path = buildLedgerPath({
      accountId,
      dateFrom,
      dateTo,
      postedOnly,
      includeOpening,
      page: 1,
      pageSize: 500,
      ordering: sortDirection === "desc" ? `-${sortKey}` : sortKey,
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
    loadAccountDetail(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, dateFrom, dateTo, postedOnly, includeOpening, pageSize]);

  const transactions = payload?.transactions || [];
  const account = payload?.account || null;

  const summary = useMemo(() => {
    const totalDebit = payload?.summary.total_debit || "0.00";
    const totalCredit = payload?.summary.total_credit || "0.00";
    const openingBalance = payload?.summary.opening_balance || "0.00";
    const closingBalance = payload?.summary.closing_balance || "0.00";
    const transactionCount =
      payload?.summary.transaction_count || transactions.length;

    const debitValue = toNumber(totalDebit);
    const creditValue = toNumber(totalCredit);
    const closingValue = toNumber(closingBalance);
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
      closingValue,
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

  const columnOptions: Array<{
    key: keyof VisibleColumns;
    label: string;
  }> = [
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

  return (
    <div className="space-y-4 p-4 md:p-6" dir="ltr">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            variant="outline"
            className="h-10 gap-2 rounded-xl bg-white px-4"
          >
            <Link href="/system/accounting/accounts">
              <ArrowLeft className="h-4 w-4" />
              {t.back}
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="h-10 gap-2 rounded-xl bg-white px-4"
          >
            <Link href="/system/accounting">
              <BarChart3 className="h-4 w-4" />
              {t.accounting}
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
            onClick={() => loadAccountDetail(true)}
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
          <p className="text-sm leading-6 text-slate-500">
            {account?.code
              ? `${account.code} - ${getAccountName(account, locale)}`
              : t.subtitle}
          </p>
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
                      {card.money ? <MoneyValue value={card.value} /> : card.value}
                    </p>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-950 transition-all"
                        style={{ width: `${formatPercent(card.percent)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card
          className="rounded-2xl border-slate-200 bg-white shadow-sm"
          dir={isArabic ? "rtl" : "ltr"}
        >
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-950">
              {t.accountInfo}
            </CardTitle>
            <CardDescription>{t.accountInfoDesc}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
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
              label={isArabic ? "الحالة" : "Status"}
              value={
                <Badge
                  variant={account?.is_active ? "default" : "secondary"}
                  className="rounded-full"
                >
                  {account?.is_active ? t.active : t.inactive}
                </Badge>
              }
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
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

      <Card
        className="rounded-2xl border-slate-200 bg-white shadow-sm"
        dir={isArabic ? "rtl" : "ltr"}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-950">
            <Filter className="h-5 w-5" />
            {t.filters}
          </CardTitle>
          <CardDescription>{t.filtersDesc}</CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4 lg:grid-cols-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              {t.dateFrom}
            </label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="h-10 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              {t.dateTo}
            </label>
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="h-10 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              {t.pageSize}
            </label>
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

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <Checkbox
              checked={postedOnly}
              onCheckedChange={(checked) => setPostedOnly(checked === true)}
            />
            <span className="text-sm text-slate-700">{t.postedOnly}</span>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <Checkbox
              checked={includeOpening}
              onCheckedChange={(checked) =>
                setIncludeOpening(checked === true)
              }
            />
            <span className="text-sm text-slate-700">{t.includeOpening}</span>
          </div>

          <div className="lg:col-span-5">
            <Button
              type="button"
              className="h-10 gap-2 rounded-xl bg-slate-950 px-4 text-white hover:bg-slate-800"
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
          </div>
        </CardContent>
      </Card>

      <Card
        className="rounded-2xl border-slate-200 bg-white shadow-sm"
        dir={isArabic ? "rtl" : "ltr"}
      >
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-slate-950">
                {t.tableTitle}
              </CardTitle>
              <CardDescription className="mt-1">{t.tableDesc}</CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400 rtl:left-auto rtl:right-3" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="h-10 w-full rounded-xl bg-white ps-9 lg:w-80"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 gap-2 rounded-xl bg-white"
                  >
                    <ColumnsIcon className="h-4 w-4" />
                    {t.columns}
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{t.columns}</DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {columnOptions.map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.key}
                      checked={visibleColumns[column.key]}
                      onCheckedChange={(checked) =>
                        setVisibleColumns((current) => ({
                          ...current,
                          [column.key]: checked,
                        }))
                      }
                    >
                      {column.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  {visibleColumns.entry_date && (
                    <TableHead>
                      <SortButton
                        label={t.entryDate}
                        sortKey="entry_date"
                        activeKey={sortKey}
                        direction={sortDirection}
                        onClick={() => toggleSort("entry_date")}
                      />
                    </TableHead>
                  )}

                  {visibleColumns.journal_entry_number && (
                    <TableHead>
                      <SortButton
                        label={t.journalNumber}
                        sortKey="journal_entry_number"
                        activeKey={sortKey}
                        direction={sortDirection}
                        onClick={() => toggleSort("journal_entry_number")}
                      />
                    </TableHead>
                  )}

                  {visibleColumns.posting_source && (
                    <TableHead>
                      <SortButton
                        label={t.source}
                        sortKey="posting_source"
                        activeKey={sortKey}
                        direction={sortDirection}
                        onClick={() => toggleSort("posting_source")}
                      />
                    </TableHead>
                  )}

                  {visibleColumns.reference && (
                    <TableHead>
                      <SortButton
                        label={t.reference}
                        sortKey="reference"
                        activeKey={sortKey}
                        direction={sortDirection}
                        onClick={() => toggleSort("reference")}
                      />
                    </TableHead>
                  )}

                  {visibleColumns.description && (
                    <TableHead>
                      <SortButton
                        label={t.description}
                        sortKey="description"
                        activeKey={sortKey}
                        direction={sortDirection}
                        onClick={() => toggleSort("description")}
                      />
                    </TableHead>
                  )}

                  {visibleColumns.debit_amount && (
                    <TableHead>
                      <SortButton
                        label={t.debit}
                        sortKey="debit_amount"
                        activeKey={sortKey}
                        direction={sortDirection}
                        onClick={() => toggleSort("debit_amount")}
                      />
                    </TableHead>
                  )}

                  {visibleColumns.credit_amount && (
                    <TableHead>
                      <SortButton
                        label={t.credit}
                        sortKey="credit_amount"
                        activeKey={sortKey}
                        direction={sortDirection}
                        onClick={() => toggleSort("credit_amount")}
                      />
                    </TableHead>
                  )}

                  {visibleColumns.movement_amount && (
                    <TableHead>
                      <SortButton
                        label={t.movement}
                        sortKey="movement_amount"
                        activeKey={sortKey}
                        direction={sortDirection}
                        onClick={() => toggleSort("movement_amount")}
                      />
                    </TableHead>
                  )}

                  {visibleColumns.running_balance && (
                    <TableHead>
                      <SortButton
                        label={t.runningBalance}
                        sortKey="running_balance"
                        activeKey={sortKey}
                        direction={sortDirection}
                        onClick={() => toggleSort("running_balance")}
                      />
                    </TableHead>
                  )}

                  {visibleColumns.actions && <TableHead>{t.action}</TableHead>}
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center">
                      <div className="flex items-center justify-center gap-2 text-slate-500">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        {t.loading}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-40 text-center">
                      <div className="space-y-2">
                        <p className="font-semibold text-slate-950">
                          {t.emptyTitle}
                        </p>
                        <p className="text-sm text-slate-500">{t.emptyDesc}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRows.map((row) => (
                    <TableRow key={`${row.id}-${row.sort_order}`}>
                      {visibleColumns.entry_date && (
                        <TableCell className="whitespace-nowrap">
                          {formatDate(row.entry_date, locale)}
                        </TableCell>
                      )}

                      {visibleColumns.journal_entry_number && (
                        <TableCell className="font-semibold text-slate-950">
                          {row.journal_entry_number || "-"}
                        </TableCell>
                      )}

                      {visibleColumns.posting_source && (
                        <TableCell>{row.posting_source || "-"}</TableCell>
                      )}

                      {visibleColumns.reference && (
                        <TableCell>{row.reference || "-"}</TableCell>
                      )}

                      {visibleColumns.description && (
                        <TableCell className="max-w-[280px] text-slate-600">
                          <span className="line-clamp-2">
                            {getDescription(row) || "-"}
                          </span>
                        </TableCell>
                      )}

                      {visibleColumns.debit_amount && (
                        <TableCell>
                          <MoneyValue value={row.debit_amount} />
                        </TableCell>
                      )}

                      {visibleColumns.credit_amount && (
                        <TableCell>
                          <MoneyValue value={row.credit_amount} />
                        </TableCell>
                      )}

                      {visibleColumns.movement_amount && (
                        <TableCell>
                          <MoneyValue value={row.movement_amount} />
                        </TableCell>
                      )}

                      {visibleColumns.running_balance && (
                        <TableCell>
                          <MoneyValue value={row.running_balance} />
                        </TableCell>
                      )}

                      {visibleColumns.actions && (
                        <TableCell>
                          {row.journal_entry_id ? (
                            <Button
                              asChild
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-xl bg-white"
                            >
                              <Link
                                href={`/system/accounting/journals/${row.journal_entry_id}`}
                              >
                                {t.view}
                              </Link>
                            </Button>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              {t.page} {formatNumber(Math.min(page, totalPages))} {t.of}{" "}
              {formatNumber(totalPages)}
            </p>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-xl bg-white"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                {t.previous}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-xl bg-white"
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
    </div>
  );
}