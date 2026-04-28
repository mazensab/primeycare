"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  ColumnsIcon,
  Download,
  FileText,
  Filter,
  Layers3,
  Loader2,
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
   📂 app/system/accounting/journals/[id]/page.tsx
   🧠 Primey Care | Journal Entry Detail
============================================================ */

type AppLocale = "ar" | "en";

type JournalStatus = "DRAFT" | "POSTED" | "CANCELLED" | "UNKNOWN";

type PostingSource =
  | "MANUAL"
  | "ORDER"
  | "PAYMENT"
  | "INVOICE"
  | "REFUND"
  | "ADJUSTMENT"
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
  id: number;
  account_id: number | null;
  account_code: string | null;
  account_name: string | null;
  account_type: string | null;
  normal_balance: string | null;
  description: string | null;
  debit_amount: string;
  credit_amount: string;
  sort_order: number;
};

type JournalDetailPayload = {
  id: number;
  entry_number: string;
  entry_date: string | null;
  status: JournalStatus;
  posting_source: PostingSource;
  reference: string | null;
  external_reference: string | null;
  description: string | null;
  notes: string | null;
  currency: string;
  total_debit: string;
  total_credit: string;
  is_balanced: boolean;
  posted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  lines: JournalLine[];
};

type ApiEnvelope<T> = {
  ok?: boolean;
  data?: T;
  message?: string;
};

type VisibleColumns = {
  sort_order: boolean;
  account_code: boolean;
  account_name: boolean;
  account_type: boolean;
  normal_balance: boolean;
  description: boolean;
  debit_amount: boolean;
  credit_amount: boolean;
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

function formatDateTime(
  value: string | null | undefined,
  locale: AppLocale,
): string {
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

function getApiUrl(path: string): string {
  const cleanBase = API_BASE_URL.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

function normalizeStatus(value: unknown): JournalStatus {
  const status = String(value || "").toUpperCase();

  if (status === "DRAFT") return "DRAFT";
  if (status === "POSTED") return "POSTED";
  if (status === "CANCELLED") return "CANCELLED";

  return "UNKNOWN";
}

function normalizePostingSource(value: unknown): PostingSource {
  const source = String(value || "").toUpperCase();

  if (source === "MANUAL") return "MANUAL";
  if (source === "ORDER") return "ORDER";
  if (source === "PAYMENT") return "PAYMENT";
  if (source === "INVOICE") return "INVOICE";
  if (source === "REFUND") return "REFUND";
  if (source === "ADJUSTMENT") return "ADJUSTMENT";
  if (source === "OTHER") return "OTHER";

  return "UNKNOWN";
}

function normalizeLine(item: unknown): JournalLine {
  const row = (item || {}) as Record<string, unknown>;

  return {
    id: Number(row.id || 0),
    account_id: row.account_id ? Number(row.account_id) : null,
    account_code: row.account_code ? String(row.account_code) : null,
    account_name: row.account_name ? String(row.account_name) : null,
    account_type: row.account_type ? String(row.account_type) : null,
    normal_balance: row.normal_balance ? String(row.normal_balance) : null,
    description: row.description ? String(row.description) : null,
    debit_amount: String(row.debit_amount || "0.00"),
    credit_amount: String(row.credit_amount || "0.00"),
    sort_order: Number(row.sort_order || 0),
  };
}

function normalizeJournal(payload: unknown): JournalDetailPayload {
  const item = (payload || {}) as Record<string, unknown>;

  return {
    id: Number(item.id || 0),
    entry_number: String(item.entry_number || "-"),
    entry_date: item.entry_date ? String(item.entry_date) : null,
    status: normalizeStatus(item.status),
    posting_source: normalizePostingSource(item.posting_source),
    reference: item.reference ? String(item.reference) : null,
    external_reference: item.external_reference
      ? String(item.external_reference)
      : null,
    description: item.description ? String(item.description) : null,
    notes: item.notes ? String(item.notes) : null,
    currency: String(item.currency || "SAR"),
    total_debit: String(item.total_debit || "0.00"),
    total_credit: String(item.total_credit || "0.00"),
    is_balanced: Boolean(item.is_balanced),
    posted_at: item.posted_at ? String(item.posted_at) : null,
    created_at: item.created_at ? String(item.created_at) : null,
    updated_at: item.updated_at ? String(item.updated_at) : null,
    lines: Array.isArray(item.lines) ? item.lines.map(normalizeLine) : [],
  };
}

async function fetchJournalDetail(
  journalId: string,
): Promise<JournalDetailPayload> {
  const response = await fetch(
    getApiUrl(`/api/accounting/journals/${journalId}/`),
    {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = (await response.json()) as ApiEnvelope<unknown>;

  if (payload.ok === false) {
    throw new Error(payload.message || "Journal detail request failed");
  }

  if (!payload.data) {
    throw new Error("Journal detail response does not contain data");
  }

  return normalizeJournal(payload.data);
}

function compareValues(
  a: JournalLine,
  b: JournalLine,
  key: SortKey,
  direction: SortDirection,
) {
  const multiplier = direction === "asc" ? 1 : -1;

  if (
    key === "debit_amount" ||
    key === "credit_amount" ||
    key === "sort_order"
  ) {
    return (toNumber(a[key]) - toNumber(b[key])) * multiplier;
  }

  return String(a[key] || "").localeCompare(String(b[key] || "")) * multiplier;
}

function printPage() {
  if (typeof window === "undefined") return;
  window.print();
}

function exportCsv(payload: JournalDetailPayload | null) {
  if (typeof window === "undefined" || !payload) return;

  const rows = [
    [
      "Journal No.",
      "Date",
      "Status",
      "Source",
      "Reference",
      "Account Code",
      "Account Name",
      "Account Type",
      "Description",
      "Debit",
      "Credit",
    ],
    ...payload.lines.map((line) => [
      payload.entry_number,
      payload.entry_date || "",
      payload.status,
      payload.posting_source,
      payload.reference || payload.external_reference || "",
      line.account_code || "",
      line.account_name || "",
      line.account_type || "",
      line.description || "",
      line.debit_amount,
      line.credit_amount,
    ]),
  ];

  const csvContent = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n");

  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `journal_${payload.entry_number || payload.id}.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "تفاصيل القيد اليومي" : "Journal Entry Detail",
    subtitle: isArabic
      ? "عرض بيانات القيد، حالة التوازن، وسطور الحسابات المدينة والدائنة."
      : "View journal information, balance status, and debit/credit account lines.",

    back: isArabic ? "القيود اليومية" : "Journal Entries",
    accounting: isArabic ? "لوحة المحاسبة" : "Accounting Overview",
    ledger: isArabic ? "دفتر الأستاذ" : "General Ledger",
    refresh: isArabic ? "تحديث" : "Refresh",
    export: isArabic ? "تصدير CSV" : "Export CSV",
    print: isArabic ? "طباعة" : "Print",

    statusTitle: isArabic ? "حالة القيد" : "Journal Status",
    statusDesc: isArabic
      ? "تحليل سريع لإجمالي المدين والدائن وعدد السطور وحالة التوازن."
      : "Quick analysis of total debit, total credit, line count, and balance status.",

    summaryTitle: isArabic ? "ملخص القيد" : "Journal Summary",
    summaryDesc: isArabic
      ? "بيانات القيد الأساسية ومصدر الترحيل والحالة الحالية."
      : "Basic journal information, posting source, and current status.",

    entryNumber: isArabic ? "رقم القيد" : "Entry No.",
    entryDate: isArabic ? "تاريخ القيد" : "Entry Date",
    status: isArabic ? "الحالة" : "Status",
    source: isArabic ? "المصدر" : "Source",
    reference: isArabic ? "المرجع" : "Reference",
    externalReference: isArabic ? "المرجع الخارجي" : "External Reference",
    description: isArabic ? "الوصف" : "Description",
    notes: isArabic ? "ملاحظات" : "Notes",
    postedAt: isArabic ? "تاريخ الترحيل" : "Posted At",
    createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
    updatedAt: isArabic ? "آخر تحديث" : "Updated At",

    totalDebit: isArabic ? "إجمالي المدين" : "Total Debit",
    totalCredit: isArabic ? "إجمالي الدائن" : "Total Credit",
    difference: isArabic ? "الفرق" : "Difference",
    linesCount: isArabic ? "عدد السطور" : "Lines",
    balanceStatus: isArabic ? "حالة التوازن" : "Balance Status",
    balanced: isArabic ? "متوازن" : "Balanced",
    unbalanced: isArabic ? "غير متوازن" : "Unbalanced",

    posted: isArabic ? "مرحل" : "Posted",
    draft: isArabic ? "مسودة" : "Draft",
    cancelled: isArabic ? "ملغي" : "Cancelled",
    unknown: isArabic ? "غير محدد" : "Unknown",

    manual: isArabic ? "يدوي" : "Manual",
    order: isArabic ? "طلب" : "Order",
    payment: isArabic ? "دفعة" : "Payment",
    invoice: isArabic ? "فاتورة" : "Invoice",
    refund: isArabic ? "استرداد" : "Refund",
    adjustment: isArabic ? "تسوية" : "Adjustment",
    other: isArabic ? "أخرى" : "Other",

    searchPlaceholder: isArabic
      ? "ابحث في سطور القيد..."
      : "Search journal lines...",

    columns: isArabic ? "الأعمدة" : "Columns",
    filters: isArabic ? "الفلاتر" : "Filters",

    sortOrder: isArabic ? "الترتيب" : "Sort",
    accountCode: isArabic ? "كود الحساب" : "Account Code",
    accountName: isArabic ? "اسم الحساب" : "Account Name",
    accountType: isArabic ? "نوع الحساب" : "Account Type",
    normalBalance: isArabic ? "طبيعة الحساب" : "Normal Balance",
    debit: isArabic ? "مدين" : "Debit",
    credit: isArabic ? "دائن" : "Credit",
    action: isArabic ? "الإجراء" : "Action",

    noRows: isArabic ? "لا توجد سطور" : "No lines found",
    noRowsDesc: isArabic
      ? "لا توجد سطور مرتبطة بهذا القيد أو أن البحث الحالي لا يعرض نتائج."
      : "No lines are linked to this journal or the current search returned no results.",

    viewAccount: isArabic ? "عرض الحساب" : "View Account",
    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",
    all: isArabic ? "الكل" : "All",

    loadSuccess: isArabic ? "تم تحديث تفاصيل القيد" : "Journal detail refreshed",
    loadError: isArabic
      ? "تعذر تحميل تفاصيل القيد"
      : "Unable to load journal detail",
    invalidJournal: isArabic ? "معرّف القيد غير صحيح" : "Invalid journal ID",
    exportSuccess: isArabic ? "تم تجهيز ملف التصدير" : "Export file prepared",
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

function statusLabel(status: JournalStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<JournalStatus, string> = {
    POSTED: t.posted,
    DRAFT: t.draft,
    CANCELLED: t.cancelled,
    UNKNOWN: t.unknown,
  };

  return labels[status] || labels.UNKNOWN;
}

function statusBadgeClass(status: JournalStatus) {
  if (status === "POSTED") {
    return "rounded-full border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "DRAFT") {
    return "rounded-full border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "CANCELLED") {
    return "rounded-full border-red-200 bg-red-50 text-red-700";
  }

  return "rounded-full border-slate-200 bg-slate-50 text-slate-700";
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
    OTHER: t.other,
    UNKNOWN: t.unknown,
  };

  return labels[source] || labels.UNKNOWN;
}

/* ============================================================
   Page
============================================================ */

export default function JournalDetailPage() {
  const params = useParams<{ id: string }>();
  const journalId = String(params?.id || "");

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [loading, setLoading] = useState(true);

  const [payload, setPayload] = useState<JournalDetailPayload | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sort_order");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [page, setPage] = useState(1);
  const pageSize = 12;

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    sort_order: true,
    account_code: true,
    account_name: true,
    account_type: true,
    normal_balance: true,
    description: true,
    debit_amount: true,
    credit_amount: true,
    actions: true,
  });

  const t = dictionary(locale);
  const isArabic = locale === "ar";

  function validateInputs() {
    if (!journalId || !Number.isInteger(Number(journalId))) {
      toast.error(t.invalidJournal);
      return false;
    }

    return true;
  }

  async function loadJournal(showToast = false) {
    try {
      if (!validateInputs()) return;

      setLoading(true);

      const data = await fetchJournalDetail(journalId);
      setPayload(data);

      if (showToast) {
        toast.success(t.loadSuccess);
      }
    } catch (error) {
      console.error("Journal detail load error:", error);
      toast.error(t.loadError);
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }

  function handleExport() {
    exportCsv(payload);
    toast.success(t.exportSuccess);
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
    loadJournal(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journalId]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  const lines = payload?.lines || [];

  const summary = useMemo(() => {
    const totalDebit = payload?.total_debit || "0.00";
    const totalCredit = payload?.total_credit || "0.00";
    const difference = Math.abs(toNumber(totalDebit) - toNumber(totalCredit));
    const isBalanced = Boolean(payload?.is_balanced) || difference === 0;

    return {
      totalDebit,
      totalCredit,
      difference,
      isBalanced,
      linesCount: lines.length,
      debitLines: lines.filter((line) => toNumber(line.debit_amount) > 0)
        .length,
      creditLines: lines.filter((line) => toNumber(line.credit_amount) > 0)
        .length,
    };
  }, [payload, lines]);

  const filteredRows = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return lines
      .filter((line) => {
        if (!keyword) return true;

        return [
          line.account_code,
          line.account_name,
          line.account_type,
          line.normal_balance,
          line.description,
          line.debit_amount,
          line.credit_amount,
          line.sort_order,
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      })
      .sort((a, b) => compareValues(a, b, sortKey, sortDirection));
  }, [lines, searchTerm, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  const paginatedRows = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * pageSize;

    return filteredRows.slice(startIndex, startIndex + pageSize);
  }, [filteredRows, page, totalPages]);

  const statusCards = [
    {
      label: t.totalDebit,
      value: summary.totalDebit,
      icon: TrendingUp,
      percent: summary.linesCount > 0 ? 100 : 0,
      money: true,
    },
    {
      label: t.totalCredit,
      value: summary.totalCredit,
      icon: TrendingDown,
      percent: summary.linesCount > 0 ? 100 : 0,
      money: true,
    },
    {
      label: t.difference,
      value: summary.difference,
      icon: ShieldCheck,
      percent: summary.isBalanced ? 100 : 50,
      money: true,
    },
    {
      label: t.linesCount,
      value: formatNumber(summary.linesCount),
      icon: Layers3,
      percent: 100,
      money: false,
    },
  ];

  const summaryCards = [
    {
      title: t.totalDebit,
      value: summary.totalDebit,
      icon: TrendingUp,
      bg: "bg-emerald-50",
      money: true,
    },
    {
      title: t.totalCredit,
      value: summary.totalCredit,
      icon: TrendingDown,
      bg: "bg-sky-50",
      money: true,
    },
    {
      title: t.balanceStatus,
      value: summary.isBalanced ? t.balanced : t.unbalanced,
      icon: ShieldCheck,
      bg: "bg-violet-50",
      money: false,
    },
    {
      title: t.linesCount,
      value: formatNumber(summary.linesCount),
      icon: WalletCards,
      bg: "bg-teal-50",
      money: false,
    },
  ];

  const columnOptions: Array<{
    key: keyof VisibleColumns;
    label: string;
  }> = [
    { key: "sort_order", label: t.sortOrder },
    { key: "account_code", label: t.accountCode },
    { key: "account_name", label: t.accountName },
    { key: "account_type", label: t.accountType },
    { key: "normal_balance", label: t.normalBalance },
    { key: "description", label: t.description },
    { key: "debit_amount", label: t.debit },
    { key: "credit_amount", label: t.credit },
    { key: "actions", label: t.action },
  ];

  return (
    <div className="space-y-4 p-4 md:p-6 print:p-0" dir="ltr">
      <div className="flex flex-col gap-4 print:hidden lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" className="h-10 gap-2 rounded-xl bg-white px-4">
            <Link href="/system/accounting/journals">
              <ArrowLeft className="h-4 w-4" />
              {t.back}
            </Link>
          </Button>

          <Button asChild variant="outline" className="h-10 gap-2 rounded-xl bg-white px-4">
            <Link href="/system/accounting">
              <BarChart3 className="h-4 w-4" />
              {t.accounting}
            </Link>
          </Button>

          <Button asChild variant="outline" className="h-10 gap-2 rounded-xl bg-white px-4">
            <Link href="/system/accounting/ledger">
              <BookOpenCheck className="h-4 w-4" />
              {t.ledger}
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-10 gap-2 rounded-xl bg-white px-4"
            onClick={() => loadJournal(true)}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            {t.refresh}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-10 gap-2 rounded-xl bg-white px-4"
            onClick={printPage}
          >
            <FileText className="h-4 w-4" />
            {t.print}
          </Button>

          <Button
            type="button"
            className="h-10 gap-2 rounded-xl bg-slate-950 px-4 text-white hover:bg-slate-800"
            onClick={handleExport}
            disabled={!payload}
          >
            <Download className="h-4 w-4" />
            {t.export}
          </Button>
        </div>

        <div className={`space-y-1 ${isArabic ? "text-right" : "text-left"}`} dir={isArabic ? "rtl" : "ltr"}>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">{t.title}</h1>
          <p className="text-sm leading-6 text-slate-500">
            {payload?.entry_number
              ? `${payload.entry_number} - ${formatDate(payload.entry_date, locale)}`
              : t.subtitle}
          </p>
        </div>
      </div>

      <div className="hidden border-b pb-4 print:block" dir={isArabic ? "rtl" : "ltr"}>
        <h1 className="text-xl font-bold">{t.title}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {payload?.entry_number || "-"} / {formatDate(payload?.entry_date, locale)}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm print:shadow-none" dir={isArabic ? "rtl" : "ltr"}>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg font-bold text-slate-950">{t.statusTitle}</CardTitle>
              <CardDescription className="mt-1">{t.statusDesc}</CardDescription>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-2 rounded-xl bg-white print:hidden"
              onClick={handleExport}
              disabled={!payload}
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

                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className={`h-2 rounded-full ${
                          card.label === t.totalCredit
                            ? "bg-sky-500"
                            : card.label === t.difference && !summary.isBalanced
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

            <div className="grid gap-3 print:hidden md:grid-cols-[1fr_auto_auto]">
              <div className="relative">
                <Search className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 ${isArabic ? "right-3" : "left-3"}`} />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={t.searchPlaceholder}
                  className={`h-11 rounded-xl border-slate-200 bg-white ${isArabic ? "pr-10" : "pl-10"}`}
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" className="h-11 gap-2 rounded-xl bg-white">
                    <Filter className="h-4 w-4" />
                    {t.filters}
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align={isArabic ? "start" : "end"} className="w-64 rounded-2xl">
                  <div dir={isArabic ? "rtl" : "ltr"}>
                    <DropdownMenuLabel>{t.filters}</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    <div className="space-y-2 p-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 w-full justify-between rounded-xl bg-white"
                        onClick={() => {
                          setSearchTerm("");
                          setPage(1);
                        }}
                      >
                        <span>{t.all}</span>
                        <Layers3 className="h-4 w-4" />
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 w-full justify-between rounded-xl bg-white"
                        onClick={() => setSearchTerm("debit")}
                      >
                        <span>{t.debit}</span>
                        <TrendingUp className="h-4 w-4" />
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 w-full justify-between rounded-xl bg-white"
                        onClick={() => setSearchTerm("credit")}
                      >
                        <span>{t.credit}</span>
                        <TrendingDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" className="h-11 gap-2 rounded-xl bg-white">
                    <ColumnsIcon className="h-4 w-4" />
                    {t.columns}
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align={isArabic ? "start" : "end"} className="w-56 rounded-2xl">
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
                    {visibleColumns.sort_order ? (
                      <TableHead>
                        <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("sort_order")}>
                          {t.sortOrder}
                          <ArrowDownUp className="h-3.5 w-3.5 print:hidden" />
                        </button>
                      </TableHead>
                    ) : null}

                    {visibleColumns.account_code ? (
                      <TableHead>
                        <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("account_code")}>
                          {t.accountCode}
                          <ArrowDownUp className="h-3.5 w-3.5 print:hidden" />
                        </button>
                      </TableHead>
                    ) : null}

                    {visibleColumns.account_name ? (
                      <TableHead>
                        <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("account_name")}>
                          {t.accountName}
                          <ArrowDownUp className="h-3.5 w-3.5 print:hidden" />
                        </button>
                      </TableHead>
                    ) : null}

                    {visibleColumns.account_type ? <TableHead>{t.accountType}</TableHead> : null}
                    {visibleColumns.normal_balance ? <TableHead>{t.normalBalance}</TableHead> : null}
                    {visibleColumns.description ? <TableHead>{t.description}</TableHead> : null}

                    {visibleColumns.debit_amount ? (
                      <TableHead>
                        <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("debit_amount")}>
                          {t.debit}
                          <ArrowDownUp className="h-3.5 w-3.5 print:hidden" />
                        </button>
                      </TableHead>
                    ) : null}

                    {visibleColumns.credit_amount ? (
                      <TableHead>
                        <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("credit_amount")}>
                          {t.credit}
                          <ArrowDownUp className="h-3.5 w-3.5 print:hidden" />
                        </button>
                      </TableHead>
                    ) : null}

                    {visibleColumns.actions ? <TableHead className="print:hidden">{t.action}</TableHead> : null}
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
                    paginatedRows.map((line) => (
                      <TableRow key={line.id}>
                        {visibleColumns.sort_order ? (
                          <TableCell className="font-semibold text-slate-950">
                            {formatNumber(line.sort_order)}
                          </TableCell>
                        ) : null}

                        {visibleColumns.account_code ? (
                          <TableCell className="font-semibold text-slate-950">
                            {line.account_code || "-"}
                          </TableCell>
                        ) : null}

                        {visibleColumns.account_name ? (
                          <TableCell className="min-w-[220px] text-slate-700">
                            {line.account_name || "-"}
                          </TableCell>
                        ) : null}

                        {visibleColumns.account_type ? (
                          <TableCell>
                            <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 text-slate-700">
                              {line.account_type || "-"}
                            </Badge>
                          </TableCell>
                        ) : null}

                        {visibleColumns.normal_balance ? (
                          <TableCell className="text-slate-600">
                            {line.normal_balance || "-"}
                          </TableCell>
                        ) : null}

                        {visibleColumns.description ? (
                          <TableCell className="max-w-[260px] truncate text-slate-600">
                            {line.description || "-"}
                          </TableCell>
                        ) : null}

                        {visibleColumns.debit_amount ? (
                          <TableCell className="font-semibold text-slate-950">
                            <MoneyValue value={line.debit_amount} />
                          </TableCell>
                        ) : null}

                        {visibleColumns.credit_amount ? (
                          <TableCell className="font-semibold text-slate-950">
                            <MoneyValue value={line.credit_amount} />
                          </TableCell>
                        ) : null}

                        {visibleColumns.actions ? (
                          <TableCell className="print:hidden">
                            {line.account_id ? (
                              <Button asChild variant="ghost" size="sm" className="h-8 rounded-lg px-2">
                                <Link href={`/system/accounting/accounts/${line.account_id}`}>
                                  {t.viewAccount}
                                </Link>
                              </Button>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="h-48 text-center">
                        <div className="space-y-2">
                          <p className="font-semibold text-slate-950">{t.noRows}</p>
                          <p className="text-sm text-slate-500">{t.noRowsDesc}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 print:hidden md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-500">
                {formatNumber(filteredRows.length)} / {formatNumber(lines.length)}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl bg-white"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
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
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                >
                  {t.next}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm print:shadow-none" dir={isArabic ? "rtl" : "ltr"}>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg font-bold text-slate-950">{t.summaryTitle}</CardTitle>
              <CardDescription className="mt-1">{t.summaryDesc}</CardDescription>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white">
              <ReceiptText className="h-5 w-5 text-slate-700" />
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-950">
                    {summary.isBalanced ? t.balanced : t.unbalanced}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{t.balanceStatus}</p>
                </div>

                <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-white ${summary.isBalanced ? "bg-slate-950" : "bg-amber-500"}`}>
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-slate-500">{t.entryNumber}</p>
                  <p className="mt-1 font-bold text-slate-950">
                    {payload?.entry_number || journalId}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">{t.entryDate}</p>
                  <p className="mt-1 font-bold text-slate-950">
                    {formatDate(payload?.entry_date, locale)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Badge variant="outline" className={statusBadgeClass(payload?.status || "UNKNOWN")}>
                    {statusLabel(payload?.status || "UNKNOWN", locale)}
                  </Badge>

                  <Badge variant="outline" className="rounded-full border-slate-200 bg-white text-slate-700">
                    {sourceLabel(payload?.posting_source || "UNKNOWN", locale)}
                  </Badge>
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
                  <p className="text-xs text-slate-500">{t.linesCount}</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">
                    {formatNumber(summary.linesCount)}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{t.difference}</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">
                    <MoneyValue value={summary.difference} />
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
              <div>
                <p className="text-xs text-slate-500">{t.reference}</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">
                  {payload?.reference || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">{t.externalReference}</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">
                  {payload?.external_reference || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">{t.description}</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">
                  {payload?.description || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">{t.postedAt}</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">
                  {formatDateTime(payload?.posted_at, locale)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 print:hidden md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;

          return (
            <Card key={card.title} className="rounded-2xl border-slate-200 bg-white shadow-sm" dir={isArabic ? "rtl" : "ltr"}>
              <CardContent className="p-5">
                <div className={`rounded-2xl ${card.bg} p-4`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-500">{card.title}</p>
                      <p className="mt-2 text-2xl font-bold text-slate-950">
                        {card.money ? <MoneyValue value={card.value} /> : card.value}
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