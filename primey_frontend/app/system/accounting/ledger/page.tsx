"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
   📂 app/system/accounting/ledger/page.tsx
   🧠 Primey Care | General Ledger
   ------------------------------------------------------------
   ✅ بيانات حقيقية من Accounting Ledger API
   ✅ بحث + فلاتر + أعمدة + فرز + صفحات
   ✅ تصدير Excel من API
   ✅ دعم عربي / إنجليزي
   ✅ أرقام إنجليزية دائمًا
   ✅ رمز العملة الرسمي
   ✅ بدون dir داخل DropdownMenuContent
============================================================ */

type AppLocale = "ar" | "en";

type SortKey =
  | "entry_date"
  | "journal_entry_number"
  | "account_code"
  | "account_name"
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

type LedgerPayload = {
  filters?: {
    account_id?: number | null;
    date_from?: string | null;
    date_to?: string | null;
    posted_only?: boolean;
    include_opening?: boolean;
    ordering?: string;
  };
  account?: {
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
  } | null;
  summary?: {
    transaction_count?: number;
    opening_debit?: string;
    opening_credit?: string;
    opening_balance?: string;
    total_debit?: string;
    total_credit?: string;
    closing_balance?: string;
  };
  pagination?: {
    page?: number;
    page_size?: number;
    total_pages?: number;
    total_items?: number;
    has_next?: boolean;
    has_previous?: boolean;
    next_page?: number | null;
    previous_page?: number | null;
  };
  transactions?: LedgerTransaction[];
};

type ApiEnvelope<T> = {
  ok?: boolean;
  data?: T;
  message?: string;
};

type VisibleColumns = {
  entry_date: boolean;
  journal_entry_number: boolean;
  account_code: boolean;
  account_name: boolean;
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

function normalizeTransaction(item: unknown): LedgerTransaction {
  const row = (item || {}) as Record<string, unknown>;

  return {
    id: Number(row.id || 0),
    journal_entry_id:
      row.journal_entry_id === null || row.journal_entry_id === undefined
        ? null
        : Number(row.journal_entry_id),
    journal_entry_number: row.journal_entry_number
      ? String(row.journal_entry_number)
      : null,
    entry_date: row.entry_date ? String(row.entry_date) : null,
    posting_source: row.posting_source ? String(row.posting_source) : null,
    reference: row.reference ? String(row.reference) : null,
    external_reference: row.external_reference
      ? String(row.external_reference)
      : null,
    entry_description: row.entry_description
      ? String(row.entry_description)
      : null,
    account_id:
      row.account_id === null || row.account_id === undefined
        ? null
        : Number(row.account_id),
    account_code: row.account_code ? String(row.account_code) : null,
    account_name: row.account_name ? String(row.account_name) : null,
    account_type: row.account_type ? String(row.account_type) : null,
    normal_balance: row.normal_balance ? String(row.normal_balance) : null,
    line_description: row.line_description ? String(row.line_description) : null,
    debit_amount: String(row.debit_amount || "0.00"),
    credit_amount: String(row.credit_amount || "0.00"),
    movement_amount: String(row.movement_amount || "0.00"),
    running_balance: String(row.running_balance || "0.00"),
    sort_order: Number(row.sort_order || 0),
    created_at: row.created_at ? String(row.created_at) : null,
  };
}

function normalizeLedgerPayload(payload: LedgerPayload): LedgerPayload {
  return {
    filters: {
      account_id: payload.filters?.account_id ?? null,
      date_from: payload.filters?.date_from ?? null,
      date_to: payload.filters?.date_to ?? null,
      posted_only: payload.filters?.posted_only ?? true,
      include_opening: payload.filters?.include_opening ?? true,
      ordering: payload.filters?.ordering ?? "entry_date",
    },
    account: payload.account ?? null,
    summary: {
      transaction_count: payload.summary?.transaction_count ?? 0,
      opening_debit: payload.summary?.opening_debit ?? "0.00",
      opening_credit: payload.summary?.opening_credit ?? "0.00",
      opening_balance: payload.summary?.opening_balance ?? "0.00",
      total_debit: payload.summary?.total_debit ?? "0.00",
      total_credit: payload.summary?.total_credit ?? "0.00",
      closing_balance: payload.summary?.closing_balance ?? "0.00",
    },
    pagination: {
      page: payload.pagination?.page ?? 1,
      page_size: payload.pagination?.page_size ?? 20,
      total_pages: payload.pagination?.total_pages ?? 1,
      total_items: payload.pagination?.total_items ?? 0,
      has_next: payload.pagination?.has_next ?? false,
      has_previous: payload.pagination?.has_previous ?? false,
      next_page: payload.pagination?.next_page ?? null,
      previous_page: payload.pagination?.previous_page ?? null,
    },
    transactions: Array.isArray(payload.transactions)
      ? payload.transactions.map(normalizeTransaction)
      : [],
  };
}

async function fetchLedger(path: string): Promise<LedgerPayload> {
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

  const payload = (await response.json()) as ApiEnvelope<LedgerPayload> | LedgerPayload;

  const envelope = payload as ApiEnvelope<LedgerPayload>;

  if (envelope.ok === false) {
    throw new Error(envelope.message || "Ledger request failed");
  }

  const data = envelope.data || (payload as LedgerPayload);

  return normalizeLedgerPayload(data);
}

function openExport(path: string) {
  if (typeof window === "undefined") return;
  window.open(getApiUrl(path), "_blank", "noopener,noreferrer");
}

function getDescription(row: LedgerTransaction) {
  return row.line_description || row.entry_description || "";
}

function getSortText(row: LedgerTransaction, key: SortKey) {
  if (key === "description") return getDescription(row);
  if (key === "entry_date") return row.entry_date || "";
  if (key === "journal_entry_number") return row.journal_entry_number || "";
  if (key === "account_code") return row.account_code || "";
  if (key === "account_name") return row.account_name || "";
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

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "دفتر الأستاذ" : "General Ledger",
    subtitle: isArabic
      ? "عرض جميع الحركات المحاسبية حسب الحساب والفترة مع الرصيد الجاري."
      : "View all accounting movements by account and period with running balance.",

    back: isArabic ? "لوحة المحاسبة" : "Accounting Overview",
    reports: isArabic ? "تقارير المحاسبة" : "Accounting Reports",
    accounts: isArabic ? "دليل الحسابات" : "Chart of Accounts",
    refresh: isArabic ? "تحديث" : "Refresh",
    export: isArabic ? "تصدير Excel" : "Export Excel",

    statusTitle: isArabic ? "حالة دفتر الأستاذ" : "Ledger Status",
    statusDesc: isArabic
      ? "مؤشرات دفتر الأستاذ حسب الفترة والفلاتر المحددة."
      : "Ledger indicators based on the selected filters.",

    summaryTitle: isArabic ? "ملخص دفتر الأستاذ" : "Ledger Summary",
    summaryDesc: isArabic
      ? "أهم الأرصدة والحركات المحاسبية الحالية."
      : "Key current accounting balances and movements.",

    openingBalance: isArabic ? "الرصيد الافتتاحي" : "Opening Balance",
    totalDebit: isArabic ? "إجمالي المدين" : "Total Debit",
    totalCredit: isArabic ? "إجمالي الدائن" : "Total Credit",
    closingBalance: isArabic ? "الرصيد الختامي" : "Closing Balance",
    transactionCount: isArabic ? "عدد الحركات" : "Transactions",

    searchPlaceholder: isArabic
      ? "ابحث في رقم القيد، الحساب، المرجع، الوصف..."
      : "Search journal number, account, reference, description...",

    columns: isArabic ? "الأعمدة" : "Columns",
    filters: isArabic ? "الفلاتر" : "Filters",
    accountId: isArabic ? "رقم الحساب" : "Account ID",
    dateFrom: isArabic ? "من تاريخ" : "Date From",
    dateTo: isArabic ? "إلى تاريخ" : "Date To",
    postedOnly: isArabic ? "قيود مرحلة فقط" : "Posted only",
    includeOpening: isArabic ? "إظهار الرصيد الافتتاحي" : "Include opening",

    entryDate: isArabic ? "التاريخ" : "Date",
    journalNumber: isArabic ? "رقم القيد" : "Journal No.",
    accountCode: isArabic ? "كود الحساب" : "Account Code",
    accountName: isArabic ? "اسم الحساب" : "Account Name",
    source: isArabic ? "المصدر" : "Source",
    reference: isArabic ? "المرجع" : "Reference",
    description: isArabic ? "الوصف" : "Description",
    debit: isArabic ? "مدين" : "Debit",
    credit: isArabic ? "دائن" : "Credit",
    movement: isArabic ? "الحركة" : "Movement",
    runningBalance: isArabic ? "الرصيد الجاري" : "Running Balance",
    action: isArabic ? "الإجراء" : "Action",

    viewJournal: isArabic ? "عرض القيد" : "View Journal",
    viewAccount: isArabic ? "عرض الحساب" : "View Account",
    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",

    noRows: isArabic ? "لا توجد حركات" : "No transactions found",
    noRowsDesc: isArabic
      ? "غيّر الفلاتر أو تأكد من وجود قيود محاسبية مرحلة."
      : "Change filters or make sure posted accounting entries exist.",

    loadSuccess: isArabic ? "تم تحديث دفتر الأستاذ" : "Ledger refreshed",
    loadError: isArabic ? "تعذر تحميل دفتر الأستاذ" : "Unable to load ledger",
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
  const active = sortKey === activeKey;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 font-semibold hover:text-slate-950"
    >
      {label}
      <ArrowDownUp
        className={`h-3.5 w-3.5 ${
          active ? "text-slate-950" : "text-slate-400"
        } ${active && direction === "desc" ? "rotate-180" : ""}`}
      />
    </button>
  );
}

/* ============================================================
   Page
============================================================ */

export default function GeneralLedgerPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [loading, setLoading] = useState(true);

  const [payload, setPayload] = useState<LedgerPayload | null>(null);

  const [accountId, setAccountId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [postedOnly, setPostedOnly] = useState(true);
  const [includeOpening, setIncludeOpening] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("entry_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const [page, setPage] = useState(1);
  const pageSize = 12;

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    entry_date: true,
    journal_entry_number: true,
    account_code: true,
    account_name: true,
    posting_source: true,
    reference: true,
    description: true,
    debit_amount: true,
    credit_amount: true,
    movement_amount: true,
    running_balance: true,
    actions: true,
  });

  const t = dictionary(locale);
  const isArabic = locale === "ar";

  function validateInputs() {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      toast.error(t.invalidDate);
      return false;
    }

    return true;
  }

  async function loadLedger(showToast = false) {
    try {
      if (!validateInputs()) return;

      setLoading(true);

      const path = buildLedgerPath({
        accountId: accountId.trim(),
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
      console.error("Ledger load error:", error);
      toast.error(t.loadError);
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }

  function handleExport() {
    if (!validateInputs()) return;

    const path = buildLedgerPath({
      accountId: accountId.trim(),
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
    loadLedger(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, accountId, dateFrom, dateTo, postedOnly, includeOpening]);

  const transactions = payload?.transactions || [];

  const summary = useMemo(() => {
    const totalDebit = payload?.summary?.total_debit || "0.00";
    const totalCredit = payload?.summary?.total_credit || "0.00";
    const openingBalance = payload?.summary?.opening_balance || "0.00";
    const closingBalance = payload?.summary?.closing_balance || "0.00";
    const transactionCount =
      payload?.summary?.transaction_count || transactions.length;

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
          row.account_code,
          row.account_name,
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
  }, [filteredRows, page, totalPages]);

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
      bg: "bg-emerald-50",
      money: true,
    },
    {
      title: t.totalDebit,
      value: summary.totalDebit,
      icon: TrendingUp,
      bg: "bg-sky-50",
      money: true,
    },
    {
      title: t.totalCredit,
      value: summary.totalCredit,
      icon: TrendingDown,
      bg: "bg-violet-50",
      money: true,
    },
    {
      title: t.transactionCount,
      value: formatNumber(summary.transactionCount),
      icon: WalletCards,
      bg: "bg-teal-50",
      money: false,
    },
  ];

  const columnOptions: Array<{
    key: keyof VisibleColumns;
    label: string;
  }> = [
    { key: "entry_date", label: t.entryDate },
    { key: "journal_entry_number", label: t.journalNumber },
    { key: "account_code", label: t.accountCode },
    { key: "account_name", label: t.accountName },
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
            asChild
            variant="outline"
            className="h-10 gap-2 rounded-xl bg-white px-4"
          >
            <Link href="/system/accounting/accounts">
              <BookOpenCheck className="h-4 w-4" />
              {t.accounts}
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-10 gap-2 rounded-xl bg-white px-4"
            onClick={() => loadLedger(true)}
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
                            : "bg-slate-950"
                        }`}
                        style={{ width: `${formatPercent(card.percent)}%` }}
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
                          {t.accountId}
                        </label>
                        <Input
                          value={accountId}
                          onChange={(event) => setAccountId(event.target.value)}
                          placeholder="1"
                          inputMode="numeric"
                          className="h-9 rounded-xl"
                        />
                      </div>

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

                      <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-2 text-sm">
                        <Checkbox
                          checked={postedOnly}
                          onCheckedChange={(value) =>
                            setPostedOnly(Boolean(value))
                          }
                        />
                        <span>{t.postedOnly}</span>
                      </label>

                      <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-2 text-sm">
                        <Checkbox
                          checked={includeOpening}
                          onCheckedChange={(value) =>
                            setIncludeOpening(Boolean(value))
                          }
                        />
                        <span>{t.includeOpening}</span>
                      </label>

                      <Button
                        type="button"
                        className="h-10 w-full rounded-xl"
                        onClick={() => {
                          setPage(1);
                          loadLedger(true);
                        }}
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

                    {visibleColumns.account_code ? (
                      <TableHead>
                        <SortButton
                          label={t.accountCode}
                          sortKey="account_code"
                          activeKey={sortKey}
                          direction={sortDirection}
                          onClick={() => toggleSort("account_code")}
                        />
                      </TableHead>
                    ) : null}

                    {visibleColumns.account_name ? (
                      <TableHead>
                        <SortButton
                          label={t.accountName}
                          sortKey="account_name"
                          activeKey={sortKey}
                          direction={sortDirection}
                          onClick={() => toggleSort("account_name")}
                        />
                      </TableHead>
                    ) : null}

                    {visibleColumns.posting_source ? (
                      <TableHead>{t.source}</TableHead>
                    ) : null}

                    {visibleColumns.reference ? (
                      <TableHead>{t.reference}</TableHead>
                    ) : null}

                    {visibleColumns.description ? (
                      <TableHead>{t.description}</TableHead>
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
                      <TableHead>{t.movement}</TableHead>
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
                    <TableRow>
                      <TableCell colSpan={12} className="h-40 text-center">
                        <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t.refresh}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedRows.length > 0 ? (
                    paginatedRows.map((row) => (
                      <TableRow key={`${row.id}-${row.sort_order}`}>
                        {visibleColumns.entry_date ? (
                          <TableCell className="whitespace-nowrap text-slate-600">
                            {formatDate(row.entry_date, locale)}
                          </TableCell>
                        ) : null}

                        {visibleColumns.journal_entry_number ? (
                          <TableCell className="font-semibold text-slate-950">
                            {row.journal_entry_number || "-"}
                          </TableCell>
                        ) : null}

                        {visibleColumns.account_code ? (
                          <TableCell className="font-semibold text-slate-950">
                            {row.account_code || "-"}
                          </TableCell>
                        ) : null}

                        {visibleColumns.account_name ? (
                          <TableCell className="min-w-[220px] text-slate-700">
                            {row.account_name || "-"}
                          </TableCell>
                        ) : null}

                        {visibleColumns.posting_source ? (
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="rounded-full border-slate-200 bg-slate-50 text-slate-700"
                            >
                              {row.posting_source || "-"}
                            </Badge>
                          </TableCell>
                        ) : null}

                        {visibleColumns.reference ? (
                          <TableCell className="max-w-[160px] truncate text-slate-600">
                            {row.reference || row.external_reference || "-"}
                          </TableCell>
                        ) : null}

                        {visibleColumns.description ? (
                          <TableCell className="max-w-[260px] truncate text-slate-600">
                            {getDescription(row) || "-"}
                          </TableCell>
                        ) : null}

                        {visibleColumns.debit_amount ? (
                          <TableCell className="font-semibold text-slate-950">
                            <MoneyValue value={row.debit_amount} />
                          </TableCell>
                        ) : null}

                        {visibleColumns.credit_amount ? (
                          <TableCell className="font-semibold text-slate-950">
                            <MoneyValue value={row.credit_amount} />
                          </TableCell>
                        ) : null}

                        {visibleColumns.movement_amount ? (
                          <TableCell className="font-semibold text-slate-950">
                            <MoneyValue value={row.movement_amount} />
                          </TableCell>
                        ) : null}

                        {visibleColumns.running_balance ? (
                          <TableCell className="font-semibold text-slate-950">
                            <MoneyValue value={row.running_balance} />
                          </TableCell>
                        ) : null}

                        {visibleColumns.actions ? (
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              {row.journal_entry_id ? (
                                <Button
                                  asChild
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 rounded-lg px-2"
                                >
                                  <Link
                                    href={`/system/accounting/journals/${row.journal_entry_id}`}
                                  >
                                    {t.viewJournal}
                                  </Link>
                                </Button>
                              ) : null}

                              {row.account_id ? (
                                <Button
                                  asChild
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 rounded-lg px-2"
                                >
                                  <Link
                                    href={`/system/accounting/accounts/${row.account_id}`}
                                  >
                                    {t.viewAccount}
                                  </Link>
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={12} className="h-48 text-center">
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
                {formatNumber(transactions.length)}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl bg-white"
                  disabled={page <= 1 || loading}
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
                  disabled={page >= totalPages || loading}
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
              <BookOpenCheck className="h-5 w-5 text-slate-700" />
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-950">
                    {formatNumber(summary.transactionCount)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {t.transactionCount}
                  </p>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-950 text-white">
                  <Layers3 className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-slate-200 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{t.openingBalance}</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">
                    <MoneyValue value={summary.openingBalance} />
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{t.closingBalance}</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">
                    <MoneyValue value={summary.closingBalance} />
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
                  setAccountId("");
                  setSearchTerm("");
                }}
              >
                <span>{isArabic ? "كل الحسابات" : "All Accounts"}</span>
                <Layers3 className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-10 justify-between rounded-xl bg-white"
                onClick={() => {
                  setPostedOnly(true);
                  setIncludeOpening(true);
                  loadLedger(true);
                }}
              >
                <span>{t.postedOnly}</span>
                <ShieldCheck className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-10 justify-between rounded-xl bg-white"
                onClick={handleExport}
              >
                <span>{t.export}</span>
                <Download className="h-4 w-4" />
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