"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  ArrowLeft,
  BookOpenCheck,
  ColumnsIcon,
  Download,
  Eye,
  FileText,
  Filter,
  Loader2,
  MoreHorizontal,
  PlusCircle,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
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
   📂 app/system/accounting/journals/page.tsx
   🧠 Primey Care | Journal Entries List
   ------------------------------------------------------------
   ✅ نفس تنسيق ملف قائمة المراكز المرفق
   ✅ بيانات حقيقية من Accounting Journals API
   ✅ بحث + فلاتر + أعمدة + تحديد + فرز + صفحات
   ✅ تصدير Excel من API
   ✅ دعم عربي / إنجليزي
   ✅ أرقام إنجليزية دائمًا
   ✅ رمز العملة الرسمي
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

type StatusFilter = "ALL" | JournalStatus;
type SourceFilter = "ALL" | PostingSource;

type SortKey =
  | "entry_number"
  | "entry_date"
  | "status"
  | "posting_source"
  | "reference"
  | "total_debit"
  | "total_credit"
  | "created_at";

type SortDirection = "asc" | "desc";

type JournalEntry = {
  id: number;
  entry_number: string;
  entry_date: string | null;
  status: JournalStatus;
  posting_source: PostingSource;
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

type ApiEnvelope<T> = {
  ok?: boolean;
  data?: T;
  message?: string;
};

type VisibleColumns = {
  select: boolean;
  entry_number: boolean;
  entry_date: boolean;
  posting_source: boolean;
  reference: boolean;
  description: boolean;
  total_debit: boolean;
  total_credit: boolean;
  status: boolean;
  balanced: boolean;
  actions: boolean;
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
   🔁 Normalizers
============================================================ */

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

function normalizeJournalEntry(item: unknown): JournalEntry {
  const obj = (item || {}) as Record<string, unknown>;

  return {
    id: Number(obj.id || 0),
    entry_number: String(obj.entry_number || "-"),
    entry_date: obj.entry_date ? String(obj.entry_date) : null,
    status: normalizeStatus(obj.status),
    posting_source: normalizePostingSource(obj.posting_source),
    reference: String(obj.reference || ""),
    external_reference: String(obj.external_reference || ""),
    description: String(obj.description || ""),
    notes: String(obj.notes || ""),
    currency: String(obj.currency || "SAR"),
    total_debit: String(obj.total_debit || "0.00"),
    total_credit: String(obj.total_credit || "0.00"),
    is_balanced: Boolean(obj.is_balanced),
    posted_at: obj.posted_at ? String(obj.posted_at) : null,
    created_at: obj.created_at ? String(obj.created_at) : null,
    updated_at: obj.updated_at ? String(obj.updated_at) : null,
  };
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

function buildJournalsPath({
  dateFrom,
  dateTo,
  status,
  postingSource,
  reference,
  externalReference,
  page,
  pageSize,
  ordering,
  excel = false,
}: {
  dateFrom: string;
  dateTo: string;
  status: StatusFilter;
  postingSource: SourceFilter;
  reference: string;
  externalReference: string;
  page: number;
  pageSize: number;
  ordering: string;
  excel?: boolean;
}) {
  const basePath = excel
    ? "/api/accounting/journals/excel/"
    : "/api/accounting/journals/";

  return `${basePath}${buildQuery({
    date_from: dateFrom || null,
    date_to: dateTo || null,
    status: status === "ALL" ? null : status,
    posting_source: postingSource === "ALL" ? null : postingSource,
    reference: reference || null,
    external_reference: externalReference || null,
    page,
    page_size: pageSize,
    ordering,
  })}`;
}

async function fetchJournals(path: string): Promise<JournalsPayload> {
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

  const payload = (await response.json()) as ApiEnvelope<JournalsPayload>;

  if (payload.ok === false) {
    throw new Error(payload.message || "Journals request failed");
  }

  if (!payload.data) {
    throw new Error("Journals response does not contain data");
  }

  return {
    ...payload.data,
    results: Array.isArray(payload.data.results)
      ? payload.data.results.map(normalizeJournalEntry)
      : [],
  };
}

function openExport(path: string) {
  if (typeof window === "undefined") return;
  window.open(getApiUrl(path), "_blank", "noopener,noreferrer");
}

function compareValues(
  a: JournalEntry,
  b: JournalEntry,
  key: SortKey,
  direction: SortDirection,
) {
  const multiplier = direction === "asc" ? 1 : -1;

  if (key === "total_debit" || key === "total_credit") {
    return (toNumber(a[key]) - toNumber(b[key])) * multiplier;
  }

  return String(a[key] || "").localeCompare(String(b[key] || "")) * multiplier;
}

/* ============================================================
   📚 Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "القيود اليومية" : "Journal Entries",
    subtitle: isArabic
      ? "إدارة ومراجعة القيود اليومية المرحلة والمسودات مع البحث، الفلاتر، الأعمدة، والتصدير."
      : "Manage and review posted and draft journal entries with search, filters, columns, and export.",

    back: isArabic ? "لوحة المحاسبة" : "Accounting Overview",
    ledger: isArabic ? "دفتر الأستاذ" : "General Ledger",
    createEntry: isArabic ? "إنشاء قيد" : "Create Entry",
    refresh: isArabic ? "تحديث" : "Refresh",
    export: isArabic ? "تصدير Excel" : "Export Excel",

    statusTitle: isArabic ? "حالة القيود اليومية" : "Journal Entries Status",
    statusDesc: isArabic
      ? "تحليل سريع للقيود، إجمالي المدين والدائن، وحالة التوازن."
      : "Quick analysis of entries, debit, credit, and balance status.",

    summaryTitle: isArabic ? "ملخص القيود" : "Journals Summary",
    summaryDesc: isArabic
      ? "أهم المؤشرات الحالية من القيود اليومية."
      : "Key current indicators from journal entries.",

    totalEntries: isArabic ? "إجمالي القيود" : "Total Entries",
    balancedEntries: isArabic ? "قيود متوازنة" : "Balanced Entries",
    unbalancedEntries: isArabic ? "غير متوازنة" : "Unbalanced",
    totalDebit: isArabic ? "إجمالي المدين" : "Total Debit",
    totalCredit: isArabic ? "إجمالي الدائن" : "Total Credit",
    balanceStatus: isArabic ? "حالة التوازن" : "Balance Status",
    balanced: isArabic ? "متوازن" : "Balanced",
    unbalanced: isArabic ? "غير متوازن" : "Unbalanced",

    searchPlaceholder: isArabic
      ? "ابحث في رقم القيد أو المرجع أو الوصف..."
      : "Search entry number, reference, or description...",

    columns: isArabic ? "الأعمدة" : "Columns",
    filters: isArabic ? "الفلاتر" : "Filters",
    all: isArabic ? "الكل" : "All",

    dateFrom: isArabic ? "من تاريخ" : "Date From",
    dateTo: isArabic ? "إلى تاريخ" : "Date To",
    referenceFilter: isArabic ? "المرجع" : "Reference",
    externalReferenceFilter: isArabic ? "المرجع الخارجي" : "External Reference",

    entryNumber: isArabic ? "رقم القيد" : "Entry No.",
    entryDate: isArabic ? "التاريخ" : "Date",
    source: isArabic ? "المصدر" : "Source",
    reference: isArabic ? "المرجع" : "Reference",
    description: isArabic ? "الوصف" : "Description",
    debit: isArabic ? "مدين" : "Debit",
    credit: isArabic ? "دائن" : "Credit",
    status: isArabic ? "الحالة" : "Status",
    balancedColumn: isArabic ? "التوازن" : "Balance",
    action: isArabic ? "الإجراء" : "Action",

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

    noRows: isArabic ? "لا توجد قيود" : "No journal entries found",
    noRowsDesc: isArabic
      ? "غيّر الفلاتر أو تأكد من وجود قيود محاسبية في النظام."
      : "Change filters or make sure accounting entries exist in the system.",

    view: isArabic ? "عرض" : "View",
    details: isArabic ? "التفاصيل" : "Details",
    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",
    selected: isArabic ? "محدد" : "selected",

    loadSuccess: isArabic ? "تم تحديث القيود اليومية" : "Journal entries refreshed",
    loadError: isArabic
      ? "تعذر تحميل القيود اليومية"
      : "Unable to load journal entries",
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

export default function JournalEntriesPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [loading, setLoading] = useState(true);

  const [payload, setPayload] = useState<JournalsPayload | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [referenceFilter, setReferenceFilter] = useState("");
  const [externalReferenceFilter, setExternalReferenceFilter] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("entry_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const [page, setPage] = useState(1);
  const pageSize = 12;

  const [selectedRows, setSelectedRows] = useState<Record<number, boolean>>({});

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    select: true,
    entry_number: true,
    entry_date: true,
    posting_source: true,
    reference: true,
    description: true,
    total_debit: true,
    total_credit: true,
    status: true,
    balanced: true,
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

  async function loadJournals(showToast = false) {
    try {
      if (!validateInputs()) return;

      setLoading(true);

      const path = buildJournalsPath({
        dateFrom,
        dateTo,
        status: statusFilter,
        postingSource: sourceFilter,
        reference: referenceFilter.trim(),
        externalReference: externalReferenceFilter.trim(),
        page,
        pageSize: 200,
        ordering: sortDirection === "desc" ? `-${sortKey}` : sortKey,
      });

      const data = await fetchJournals(path);
      setPayload(data);

      if (showToast) {
        toast.success(t.loadSuccess);
      }
    } catch (error) {
      console.error("Journals load error:", error);
      toast.error(t.loadError);
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }

  function handleExport() {
    if (!validateInputs()) return;

    const path = buildJournalsPath({
      dateFrom,
      dateTo,
      status: statusFilter,
      postingSource: sourceFilter,
      reference: referenceFilter.trim(),
      externalReference: externalReferenceFilter.trim(),
      page: 1,
      pageSize: 200,
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

  function toggleAllRows(checked: boolean) {
    const nextSelected: Record<number, boolean> = {};

    if (checked) {
      filteredRows.forEach((row) => {
        nextSelected[row.id] = true;
      });
    }

    setSelectedRows(nextSelected);
  }

  useEffect(() => {
    const currentLocale = readLocale();
    setLocale(currentLocale);
    applyDocumentLocale(currentLocale);
  }, []);

  useEffect(() => {
    loadJournals(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    searchTerm,
    statusFilter,
    sourceFilter,
    dateFrom,
    dateTo,
    referenceFilter,
    externalReferenceFilter,
  ]);

  useEffect(() => {
    loadJournals(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey, sortDirection]);

  const rows = payload?.results || [];

  const summary = useMemo(() => {
    const totalEntries =
      payload?.summary.total_entries ||
      payload?.pagination.total_items ||
      rows.length;

    const totalDebit = payload?.summary.total_debit || "0.00";
    const totalCredit = payload?.summary.total_credit || "0.00";
    const balancedEntries = payload?.summary.balanced_entries_count || 0;
    const unbalancedEntries = payload?.summary.unbalanced_entries_count || 0;

    const balancedPercent =
      totalEntries > 0 ? (balancedEntries / totalEntries) * 100 : 0;

    const isBalanced =
      payload?.summary.is_balanced_total ??
      toNumber(totalDebit) === toNumber(totalCredit);

    return {
      totalEntries,
      totalDebit,
      totalCredit,
      balancedEntries,
      unbalancedEntries,
      balancedPercent,
      isBalanced,
    };
  }, [payload, rows.length]);

  const filteredRows = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return rows
      .filter((row) => {
        const matchesSearch = keyword
          ? [
              row.entry_number,
              row.entry_date,
              row.status,
              row.posting_source,
              row.reference,
              row.external_reference,
              row.description,
              row.notes,
              row.total_debit,
              row.total_credit,
            ]
              .join(" ")
              .toLowerCase()
              .includes(keyword)
          : true;

        return matchesSearch;
      })
      .sort((a, b) => compareValues(a, b, sortKey, sortDirection));
  }, [rows, searchTerm, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  const paginatedRows = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * pageSize;

    return filteredRows.slice(startIndex, startIndex + pageSize);
  }, [filteredRows, page, totalPages]);

  const selectedCount = Object.values(selectedRows).filter(Boolean).length;

  const allCurrentRowsSelected =
    filteredRows.length > 0 && filteredRows.every((row) => selectedRows[row.id]);

  const statusCards = [
    {
      label: t.totalEntries,
      value: formatNumber(summary.totalEntries),
      icon: ReceiptText,
      percent: 100,
      money: false,
    },
    {
      label: t.balancedEntries,
      value: formatNumber(summary.balancedEntries),
      icon: ShieldCheck,
      percent: summary.balancedPercent,
      money: false,
    },
    {
      label: t.totalDebit,
      value: summary.totalDebit,
      icon: TrendingUp,
      percent: summary.totalEntries > 0 ? 100 : 0,
      money: true,
    },
    {
      label: t.totalCredit,
      value: summary.totalCredit,
      icon: TrendingDown,
      percent: summary.totalEntries > 0 ? 100 : 0,
      money: true,
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
      title: t.balancedEntries,
      value: formatNumber(summary.balancedEntries),
      icon: ShieldCheck,
      bg: "bg-violet-50",
      money: false,
    },
    {
      title: t.unbalancedEntries,
      value: formatNumber(summary.unbalancedEntries),
      icon: WalletCards,
      bg: "bg-teal-50",
      money: false,
    },
  ];

  const columnOptions: Array<{
    key: keyof VisibleColumns;
    label: string;
  }> = [
    { key: "select", label: t.selected },
    { key: "entry_number", label: t.entryNumber },
    { key: "entry_date", label: t.entryDate },
    { key: "posting_source", label: t.source },
    { key: "reference", label: t.reference },
    { key: "description", label: t.description },
    { key: "total_debit", label: t.debit },
    { key: "total_credit", label: t.credit },
    { key: "status", label: t.status },
    { key: "balanced", label: t.balancedColumn },
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
            <Link href="/system/accounting/ledger">
              <BookOpenCheck className="h-4 w-4" />
              {t.ledger}
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-10 gap-2 rounded-xl bg-white px-4"
            onClick={() => loadJournals(true)}
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

          <Button
            asChild
            variant="outline"
            className="h-10 gap-2 rounded-xl bg-white px-4"
          >
            <Link href="/system/accounting">
              <PlusCircle className="h-4 w-4" />
              {t.createEntry}
            </Link>
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
                            : card.label === t.balancedEntries
                              ? "bg-emerald-500"
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

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-500">
                          {t.referenceFilter}
                        </label>
                        <Input
                          value={referenceFilter}
                          onChange={(event) =>
                            setReferenceFilter(event.target.value)
                          }
                          className="h-9 rounded-xl"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-500">
                          {t.externalReferenceFilter}
                        </label>
                        <Input
                          value={externalReferenceFilter}
                          onChange={(event) =>
                            setExternalReferenceFilter(event.target.value)
                          }
                          className="h-9 rounded-xl"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {(
                          ["ALL", "POSTED", "DRAFT", "CANCELLED"] as StatusFilter[]
                        ).map((status) => (
                          <Button
                            key={status}
                            type="button"
                            variant={
                              statusFilter === status ? "default" : "outline"
                            }
                            size="sm"
                            className="rounded-xl"
                            onClick={() => setStatusFilter(status)}
                          >
                            {status === "ALL"
                              ? t.all
                              : statusLabel(status, locale)}
                          </Button>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            "ALL",
                            "MANUAL",
                            "INVOICE",
                            "PAYMENT",
                            "ORDER",
                            "ADJUSTMENT",
                            "REFUND",
                            "OTHER",
                          ] as SourceFilter[]
                        ).map((source) => (
                          <Button
                            key={source}
                            type="button"
                            variant={
                              sourceFilter === source ? "default" : "outline"
                            }
                            size="sm"
                            className="rounded-xl"
                            onClick={() => setSourceFilter(source)}
                          >
                            {source === "ALL"
                              ? t.all
                              : sourceLabel(source, locale)}
                          </Button>
                        ))}
                      </div>

                      <Button
                        type="button"
                        className="h-10 w-full rounded-xl"
                        onClick={() => {
                          setPage(1);
                          loadJournals(true);
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

            {selectedCount > 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {formatNumber(selectedCount)} {t.selected}
              </div>
            ) : null}

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    {visibleColumns.select ? (
                      <TableHead className="w-12">
                        <Checkbox
                          checked={allCurrentRowsSelected}
                          onCheckedChange={(value) =>
                            toggleAllRows(Boolean(value))
                          }
                        />
                      </TableHead>
                    ) : null}

                    {visibleColumns.entry_number ? (
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={() => toggleSort("entry_number")}
                        >
                          {t.entryNumber}
                          <ArrowDownUp className="h-3.5 w-3.5" />
                        </button>
                      </TableHead>
                    ) : null}

                    {visibleColumns.entry_date ? (
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={() => toggleSort("entry_date")}
                        >
                          {t.entryDate}
                          <ArrowDownUp className="h-3.5 w-3.5" />
                        </button>
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

                    {visibleColumns.total_debit ? (
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={() => toggleSort("total_debit")}
                        >
                          {t.debit}
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
                          {t.credit}
                          <ArrowDownUp className="h-3.5 w-3.5" />
                        </button>
                      </TableHead>
                    ) : null}

                    {visibleColumns.status ? (
                      <TableHead>{t.status}</TableHead>
                    ) : null}

                    {visibleColumns.balanced ? (
                      <TableHead>{t.balancedColumn}</TableHead>
                    ) : null}

                    {visibleColumns.actions ? (
                      <TableHead>{t.action}</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={11} className="h-40 text-center">
                        <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t.refresh}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedRows.length > 0 ? (
                    paginatedRows.map((entry) => (
                      <TableRow key={entry.id}>
                        {visibleColumns.select ? (
                          <TableCell>
                            <Checkbox
                              checked={Boolean(selectedRows[entry.id])}
                              onCheckedChange={(value) =>
                                setSelectedRows((current) => ({
                                  ...current,
                                  [entry.id]: Boolean(value),
                                }))
                              }
                            />
                          </TableCell>
                        ) : null}

                        {visibleColumns.entry_number ? (
                          <TableCell className="font-semibold text-slate-950">
                            {entry.entry_number}
                          </TableCell>
                        ) : null}

                        {visibleColumns.entry_date ? (
                          <TableCell className="text-slate-600">
                            {formatDate(entry.entry_date, locale)}
                          </TableCell>
                        ) : null}

                        {visibleColumns.posting_source ? (
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="rounded-full border-slate-200 bg-slate-50 text-slate-700"
                            >
                              {sourceLabel(entry.posting_source, locale)}
                            </Badge>
                          </TableCell>
                        ) : null}

                        {visibleColumns.reference ? (
                          <TableCell className="max-w-[180px] truncate text-slate-600">
                            {entry.reference || entry.external_reference || "-"}
                          </TableCell>
                        ) : null}

                        {visibleColumns.description ? (
                          <TableCell className="max-w-[260px] truncate text-slate-600">
                            {entry.description || entry.notes || "-"}
                          </TableCell>
                        ) : null}

                        {visibleColumns.total_debit ? (
                          <TableCell className="font-semibold text-slate-950">
                            <MoneyValue value={entry.total_debit} />
                          </TableCell>
                        ) : null}

                        {visibleColumns.total_credit ? (
                          <TableCell className="font-semibold text-slate-950">
                            <MoneyValue value={entry.total_credit} />
                          </TableCell>
                        ) : null}

                        {visibleColumns.status ? (
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={statusBadgeClass(entry.status)}
                            >
                              {statusLabel(entry.status, locale)}
                            </Badge>
                          </TableCell>
                        ) : null}

                        {visibleColumns.balanced ? (
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                entry.is_balanced
                                  ? "rounded-full border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "rounded-full border-amber-200 bg-amber-50 text-amber-700"
                              }
                            >
                              {entry.is_balanced ? t.balanced : t.unbalanced}
                            </Badge>
                          </TableCell>
                        ) : null}

                        {visibleColumns.actions ? (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-lg"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>

                              <DropdownMenuContent
                                align={isArabic ? "start" : "end"}
                                className="rounded-2xl"
                              >
                                <div dir={isArabic ? "rtl" : "ltr"}>
                                  <DropdownMenuItem asChild>
                                    <Link
                                      href={`/system/accounting/journals/${entry.id}`}
                                      className="flex items-center gap-2"
                                    >
                                      <Eye className="h-4 w-4" />
                                      {t.details}
                                    </Link>
                                  </DropdownMenuItem>
                                </div>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={11} className="h-48 text-center">
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
                {formatNumber(filteredRows.length)} / {formatNumber(rows.length)}
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
                  <p className="mt-1 text-sm text-slate-500">
                    {t.balanceStatus}
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
                  <p className="text-xs text-slate-500">{t.balancedEntries}</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">
                    {formatNumber(summary.balancedEntries)}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">
                    {t.unbalancedEntries}
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-950">
                    {formatNumber(summary.unbalancedEntries)}
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
                  setStatusFilter("ALL");
                  setSourceFilter("ALL");
                  setSearchTerm("");
                  setReferenceFilter("");
                  setExternalReferenceFilter("");
                }}
              >
                <span>{t.all}</span>
                <ReceiptText className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-10 justify-between rounded-xl bg-white"
                onClick={() => setStatusFilter("POSTED")}
              >
                <span>{t.posted}</span>
                <ShieldCheck className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-10 justify-between rounded-xl bg-white"
                onClick={() => setSourceFilter("INVOICE")}
              >
                <span>{t.invoice}</span>
                <FileText className="h-4 w-4" />
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