"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpDown,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ColumnsIcon,
  Download,
  Eye,
  FileText,
  FilterIcon,
  Loader2,
  Plus,
  Printer,
  ReceiptText,
  RefreshCcw,
  Search,
  ShieldCheck,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

/* =====================================================
   TYPES
===================================================== */

type AppLocale = "ar" | "en";

type SortDirection = "asc" | "desc";

type SortKey =
  | "number"
  | "status"
  | "invoice_date"
  | "customer_id"
  | "order_id"
  | "subtotal"
  | "tax_amount"
  | "total_amount";

type InvoiceStatus =
  | "ALL"
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED"
  | "REFUNDED";

type ApiInvoice = {
  id: number;
  number?: string | null;
  status?: string | null;
  invoice_date?: string | null;
  customer_id?: number | null;
  order_id?: number | null;
  subtotal?: string | number | null;
  tax_amount?: string | number | null;
  total_amount?: string | number | null;
};

type InvoicesApiResponse = {
  ok?: boolean;
  count?: number;
  results?: ApiInvoice[];
  message?: string;
};

type ColumnKey =
  | "select"
  | "number"
  | "customer"
  | "order"
  | "status"
  | "invoiceDate"
  | "subtotal"
  | "tax"
  | "total"
  | "actions";

type ColumnConfig = {
  key: ColumnKey;
  labelAr: string;
  labelEn: string;
  visible: boolean;
};

type StatusMeta = {
  labelAr: string;
  labelEn: string;
  className: string;
};

/* =====================================================
   CONSTANTS
===================================================== */

const SAR_ICON_PATH = "/currency/sar.svg";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const STATUS_META: Record<string, StatusMeta> = {
  DRAFT: {
    labelAr: "مسودة",
    labelEn: "Draft",
    className:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300",
  },
  ISSUED: {
    labelAr: "مصدرة",
    labelEn: "Issued",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
  },
  PARTIALLY_PAID: {
    labelAr: "مدفوعة جزئيًا",
    labelEn: "Partially Paid",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
  },
  PAID: {
    labelAr: "مدفوعة",
    labelEn: "Paid",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  OVERDUE: {
    labelAr: "متأخرة",
    labelEn: "Overdue",
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
  },
  CANCELLED: {
    labelAr: "ملغاة",
    labelEn: "Cancelled",
    className:
      "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300",
  },
  REFUNDED: {
    labelAr: "مستردة",
    labelEn: "Refunded",
    className:
      "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-300",
  },
};

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: "select", labelAr: "تحديد", labelEn: "Select", visible: true },
  { key: "number", labelAr: "الفاتورة", labelEn: "Invoice", visible: true },
  { key: "customer", labelAr: "العميل", labelEn: "Customer", visible: true },
  { key: "order", labelAr: "الطلب", labelEn: "Order", visible: true },
  { key: "status", labelAr: "الحالة", labelEn: "Status", visible: true },
  { key: "invoiceDate", labelAr: "التاريخ", labelEn: "Date", visible: true },
  { key: "subtotal", labelAr: "قبل الضريبة", labelEn: "Subtotal", visible: true },
  { key: "tax", labelAr: "الضريبة", labelEn: "Tax", visible: true },
  { key: "total", labelAr: "الإجمالي", labelEn: "Total", visible: true },
  { key: "actions", labelAr: "الإجراءات", labelEn: "Actions", visible: true },
];

/* =====================================================
   LOCALE HELPERS
===================================================== */

function getInitialLocale(): AppLocale {
  if (typeof window === "undefined") return "ar";

  const stored = window.localStorage.getItem("primey-locale");
  if (stored === "ar" || stored === "en") return stored;

  const htmlLang = document.documentElement.lang;
  if (htmlLang === "en") return "en";

  return "ar";
}

function applyLocaleToDocument(locale: AppLocale) {
  if (typeof document === "undefined") return;

  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  document.body.dir = locale === "ar" ? "rtl" : "ltr";
}

/* =====================================================
   FORMAT HELPERS
===================================================== */

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;

  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value: string | null | undefined, locale: AppLocale): string {
  if (!value) return locale === "ar" ? "غير محدد" : "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return locale === "ar" ? "غير محدد" : "Not set";

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getStatusLabel(status: string | null | undefined, locale: AppLocale): string {
  const key = String(status || "DRAFT").toUpperCase();
  const meta = STATUS_META[key];

  if (!meta) return status || (locale === "ar" ? "غير محدد" : "Unknown");

  return locale === "ar" ? meta.labelAr : meta.labelEn;
}

function getStatusClassName(status: string | null | undefined): string {
  const key = String(status || "DRAFT").toUpperCase();
  return STATUS_META[key]?.className || STATUS_META.DRAFT.className;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =====================================================
   API HELPER
===================================================== */

async function fetchInvoices(): Promise<ApiInvoice[]> {
  const response = await fetch("/api/invoices/?limit=200", {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as InvoicesApiResponse | null;

  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || "Failed to load invoices.");
  }

  return Array.isArray(data.results) ? data.results : [];
}

/* =====================================================
   PAGE
===================================================== */

export default function SystemInvoicesListPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [invoices, setInvoices] = useState<ApiInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);

  const [sortKey, setSortKey] = useState<SortKey>("invoice_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const isAr = locale === "ar";

  const t = useMemo(
    () => ({
      badge: isAr ? "قائمة الفواتير" : "Invoices List",
      title: isAr ? "قائمة الفواتير" : "Invoices List",
      subtitle: isAr
        ? "استعراض الفواتير، البحث، الفلترة، الفرز، التصدير والطباعة بنفس الهوية الرسمية للنظام."
        : "Browse invoices with search, filters, sorting, export, and print using the official system identity.",
      back: isAr ? "لوحة الفواتير" : "Invoices Dashboard",
      create: isAr ? "إنشاء فاتورة" : "Create Invoice",
      reports: isAr ? "التقارير" : "Reports",
      refresh: isAr ? "تحديث" : "Refresh",
      searchPlaceholder: isAr
        ? "ابحث برقم الفاتورة أو العميل أو الطلب أو الحالة..."
        : "Search by invoice number, customer, order, or status...",
      filters: isAr ? "الفلاتر" : "Filters",
      status: isAr ? "الحالة" : "Status",
      allStatuses: isAr ? "كل الحالات" : "All Statuses",
      from: isAr ? "من تاريخ" : "From",
      to: isAr ? "إلى تاريخ" : "To",
      clear: isAr ? "مسح الفلاتر" : "Clear Filters",
      columns: isAr ? "الأعمدة" : "Columns",
      exportExcel: isAr ? "تصدير Excel" : "Export Excel",
      print: isAr ? "طباعة Web PDF" : "Print Web PDF",
      selected: isAr ? "محدد" : "Selected",
      invoices: isAr ? "فاتورة" : "Invoices",
      invoice: isAr ? "الفاتورة" : "Invoice",
      customer: isAr ? "العميل" : "Customer",
      order: isAr ? "الطلب" : "Order",
      invoiceDate: isAr ? "تاريخ الفاتورة" : "Invoice Date",
      subtotal: isAr ? "قبل الضريبة" : "Subtotal",
      tax: isAr ? "الضريبة" : "Tax",
      total: isAr ? "الإجمالي" : "Total",
      actions: isAr ? "الإجراءات" : "Actions",
      details: isAr ? "عرض" : "View",
      issue: isAr ? "إصدار" : "Issue",
      empty: isAr ? "لا توجد فواتير مطابقة للفلاتر الحالية." : "No invoices match current filters.",
      loading: isAr ? "جاري تحميل الفواتير..." : "Loading invoices...",
      totalInvoices: isAr ? "إجمالي الفواتير" : "Total Invoices",
      paidInvoices: isAr ? "مدفوعة" : "Paid",
      issuedInvoices: isAr ? "مصدرة" : "Issued",
      openInvoices: isAr ? "تحتاج متابعة" : "Need Follow-up",
      totalAmount: isAr ? "إجمالي المبالغ" : "Total Amount",
      taxAmount: isAr ? "إجمالي الضريبة" : "Tax Total",
      page: isAr ? "صفحة" : "Page",
      of: isAr ? "من" : "of",
      rowsPerPage: isAr ? "عدد الصفوف" : "Rows",
      notAvailable: isAr ? "غير متاح" : "N/A",
      sar: isAr ? "ريال" : "SAR",
      exportSuccess: isAr ? "تم تصدير ملف Excel بنجاح" : "Excel file exported successfully",
      printTitle: isAr ? "قائمة الفواتير" : "Invoices List",
      refreshSuccess: isAr ? "تم تحديث قائمة الفواتير بنجاح" : "Invoices list refreshed successfully",
      loadError: isAr ? "تعذر تحميل قائمة الفواتير" : "Failed to load invoices list",
      all: isAr ? "الكل" : "All",
    }),
    [isAr]
  );

  const visibleColumns = useMemo(
    () => columns.filter((column) => column.visible),
    [columns]
  );

  const hasColumn = (key: ColumnKey) =>
    visibleColumns.some((column) => column.key === key);

  const loadInvoices = async (mode: "initial" | "refresh" = "initial") => {
    try {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);

      const data = await fetchInvoices();
      setInvoices(data);

      if (mode === "refresh") {
        toast.success(t.refreshSuccess);
      }
    } catch (error) {
      console.error(error);
      toast.error(t.loadError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const currentLocale = getInitialLocale();
    setLocale(currentLocale);
    applyLocaleToDocument(currentLocale);

    const syncLocale = () => {
      const nextLocale = getInitialLocale();
      setLocale(nextLocale);
      applyLocaleToDocument(nextLocale);
    };

    window.addEventListener("primey-locale-changed", syncLocale);
    window.addEventListener("storage", syncLocale);

    const timeout = window.setTimeout(syncLocale, 50);

    return () => {
      window.removeEventListener("primey-locale-changed", syncLocale);
      window.removeEventListener("storage", syncLocale);
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    loadInvoices("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const totalInvoices = invoices.length;

    const paidInvoices = invoices.filter(
      (invoice) => String(invoice.status || "").toUpperCase() === "PAID"
    ).length;

    const issuedInvoices = invoices.filter(
      (invoice) => String(invoice.status || "").toUpperCase() === "ISSUED"
    ).length;

    const openInvoices = invoices.filter((invoice) => {
      const status = String(invoice.status || "").toUpperCase();
      return ["DRAFT", "ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(status);
    }).length;

    const totalAmount = invoices.reduce(
      (sum, invoice) => sum + toNumber(invoice.total_amount),
      0
    );

    const taxAmount = invoices.reduce(
      (sum, invoice) => sum + toNumber(invoice.tax_amount),
      0
    );

    return {
      totalInvoices,
      paidInvoices,
      issuedInvoices,
      openInvoices,
      totalAmount,
      taxAmount,
    };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const status = String(invoice.status || "DRAFT").toUpperCase();

      if (statusFilter !== "ALL" && status !== statusFilter) return false;

      if (dateFrom || dateTo) {
        const invoiceDate = invoice.invoice_date ? new Date(invoice.invoice_date) : null;

        if (!invoiceDate || Number.isNaN(invoiceDate.getTime())) return false;

        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          if (invoiceDate < fromDate) return false;
        }

        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (invoiceDate > toDate) return false;
        }
      }

      if (!keyword) return true;

      const haystack = [
        invoice.id,
        invoice.number,
        invoice.status,
        getStatusLabel(invoice.status, "ar"),
        getStatusLabel(invoice.status, "en"),
        invoice.customer_id,
        invoice.order_id,
        invoice.subtotal,
        invoice.tax_amount,
        invoice.total_amount,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [dateFrom, dateTo, invoices, search, statusFilter]);

  const sortedInvoices = useMemo(() => {
    const data = [...filteredInvoices];

    data.sort((a, b) => {
      let left: string | number = "";
      let right: string | number = "";

      if (sortKey === "number") {
        left = a.number || `INV-${a.id}`;
        right = b.number || `INV-${b.id}`;
      }

      if (sortKey === "status") {
        left = a.status || "";
        right = b.status || "";
      }

      if (sortKey === "invoice_date") {
        left = a.invoice_date ? new Date(a.invoice_date).getTime() : 0;
        right = b.invoice_date ? new Date(b.invoice_date).getTime() : 0;
      }

      if (sortKey === "customer_id") {
        left = a.customer_id || 0;
        right = b.customer_id || 0;
      }

      if (sortKey === "order_id") {
        left = a.order_id || 0;
        right = b.order_id || 0;
      }

      if (sortKey === "subtotal") {
        left = toNumber(a.subtotal);
        right = toNumber(b.subtotal);
      }

      if (sortKey === "tax_amount") {
        left = toNumber(a.tax_amount);
        right = toNumber(b.tax_amount);
      }

      if (sortKey === "total_amount") {
        left = toNumber(a.total_amount);
        right = toNumber(b.total_amount);
      }

      if (typeof left === "number" && typeof right === "number") {
        return sortDirection === "asc" ? left - right : right - left;
      }

      return sortDirection === "asc"
        ? String(left).localeCompare(String(right))
        : String(right).localeCompare(String(left));
    });

    return data;
  }, [filteredInvoices, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedInvoices.length / pageSize));

  const paginatedInvoices = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * pageSize;
    return sortedInvoices.slice(start, start + pageSize);
  }, [currentPage, pageSize, sortedInvoices, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, dateFrom, dateTo, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const pageSelected = useMemo(() => {
    if (paginatedInvoices.length === 0) return false;
    return paginatedInvoices.every((invoice) => selectedIds.includes(invoice.id));
  }, [paginatedInvoices, selectedIds]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  };

  const toggleColumn = (key: ColumnKey) => {
    if (key === "actions") return;

    setColumns((current) =>
      current.map((column) =>
        column.key === key ? { ...column, visible: !column.visible } : column
      )
    );
  };

  const toggleInvoiceSelection = (invoiceId: number) => {
    setSelectedIds((current) =>
      current.includes(invoiceId)
        ? current.filter((id) => id !== invoiceId)
        : [...current, invoiceId]
    );
  };

  const togglePageSelection = () => {
    const pageIds = paginatedInvoices.map((invoice) => invoice.id);

    if (pageSelected) {
      setSelectedIds((current) => current.filter((id) => !pageIds.includes(id)));
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...pageIds])));
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setDateFrom("");
    setDateTo("");
    setSelectedIds([]);
  };

  const exportRows = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    const source =
      selectedIds.length > 0
        ? sortedInvoices.filter((invoice) => selectedSet.has(invoice.id))
        : sortedInvoices;

    return source;
  }, [selectedIds, sortedInvoices]);

  const buildExportTableRows = (rows: ApiInvoice[]) => {
    return rows
      .map((invoice) => {
        const number = invoice.number || `INV-${invoice.id}`;
        const customer = invoice.customer_id ? `#${invoice.customer_id}` : t.notAvailable;
        const order = invoice.order_id ? `#${invoice.order_id}` : t.notAvailable;
        const status = getStatusLabel(invoice.status, locale);
        const date = formatDate(invoice.invoice_date, locale);
        const subtotal = formatMoney(toNumber(invoice.subtotal));
        const tax = formatMoney(toNumber(invoice.tax_amount));
        const total = formatMoney(toNumber(invoice.total_amount));

        return `
          <tr>
            <td>${escapeHtml(number)}</td>
            <td>${escapeHtml(customer)}</td>
            <td>${escapeHtml(order)}</td>
            <td>${escapeHtml(status)}</td>
            <td>${escapeHtml(date)}</td>
            <td>${escapeHtml(subtotal)}</td>
            <td>${escapeHtml(tax)}</td>
            <td>${escapeHtml(total)}</td>
          </tr>
        `;
      })
      .join("");
  };

  const exportExcel = () => {
    if (exportRows.length === 0) {
      toast.error(isAr ? "لا توجد بيانات للتصدير" : "No data to export");
      return;
    }

    const title = t.printTitle;
    const generatedAt = new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());

    const html = `
      <html dir="${isAr ? "rtl" : "ltr"}" lang="${locale}">
        <head>
          <meta charset="UTF-8" />
          <style>
            body {
              font-family: Arial, sans-serif;
              direction: ${isAr ? "rtl" : "ltr"};
            }
            table {
              border-collapse: collapse;
              width: 100%;
            }
            th {
              background: #f1f5f9;
              color: #0f172a;
              font-weight: 700;
              border: 1px solid #cbd5e1;
              padding: 10px;
              text-align: ${isAr ? "right" : "left"};
            }
            td {
              border: 1px solid #cbd5e1;
              padding: 10px;
              text-align: ${isAr ? "right" : "left"};
            }
            .title {
              font-size: 20px;
              font-weight: 700;
              margin-bottom: 6px;
            }
            .meta {
              color: #475569;
              margin-bottom: 18px;
            }
          </style>
        </head>
        <body>
          <div class="title">${escapeHtml(title)}</div>
          <div class="meta">${escapeHtml(generatedAt)}</div>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t.invoice)}</th>
                <th>${escapeHtml(t.customer)}</th>
                <th>${escapeHtml(t.order)}</th>
                <th>${escapeHtml(t.status)}</th>
                <th>${escapeHtml(t.invoiceDate)}</th>
                <th>${escapeHtml(t.subtotal)}</th>
                <th>${escapeHtml(t.tax)}</th>
                <th>${escapeHtml(t.total)}</th>
              </tr>
            </thead>
            <tbody>
              ${buildExportTableRows(exportRows)}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob(["\ufeff", html], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStamp = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `primey-care-invoices-${dateStamp}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(t.exportSuccess);
  };

  const printTable = () => {
    if (exportRows.length === 0) {
      toast.error(isAr ? "لا توجد بيانات للطباعة" : "No data to print");
      return;
    }

    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) {
      toast.error(isAr ? "تعذر فتح نافذة الطباعة" : "Unable to open print window");
      return;
    }

    const generatedAt = new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());

    const html = `
      <!doctype html>
      <html lang="${locale}" dir="${isAr ? "rtl" : "ltr"}">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(t.printTitle)}</title>
          <style>
            * {
              box-sizing: border-box;
            }
            body {
              margin: 0;
              padding: 32px;
              font-family: Arial, sans-serif;
              direction: ${isAr ? "rtl" : "ltr"};
              color: #0f172a;
              background: #ffffff;
            }
            .header {
              display: flex;
              justify-content: space-between;
              gap: 24px;
              align-items: flex-start;
              margin-bottom: 24px;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 16px;
            }
            .title {
              font-size: 24px;
              font-weight: 800;
              margin: 0 0 8px;
            }
            .subtitle {
              margin: 0;
              color: #475569;
              font-size: 13px;
            }
            .summary {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 12px;
              margin-bottom: 24px;
            }
            .card {
              border: 1px solid #e2e8f0;
              border-radius: 14px;
              padding: 12px;
              background: #f8fafc;
            }
            .card-label {
              color: #64748b;
              font-size: 12px;
              margin-bottom: 6px;
            }
            .card-value {
              font-size: 18px;
              font-weight: 800;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }
            th {
              background: #f1f5f9;
              border: 1px solid #cbd5e1;
              padding: 10px;
              text-align: ${isAr ? "right" : "left"};
              white-space: nowrap;
            }
            td {
              border: 1px solid #cbd5e1;
              padding: 10px;
              text-align: ${isAr ? "right" : "left"};
              vertical-align: top;
            }
            tr:nth-child(even) td {
              background: #f8fafc;
            }
            @media print {
              body {
                padding: 18px;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">${escapeHtml(t.printTitle)}</h1>
              <p class="subtitle">${escapeHtml(generatedAt)}</p>
            </div>
            <button class="no-print" onclick="window.print()">${escapeHtml(t.print)}</button>
          </div>

          <div class="summary">
            <div class="card">
              <div class="card-label">${escapeHtml(t.totalInvoices)}</div>
              <div class="card-value">${escapeHtml(formatNumber(exportRows.length))}</div>
            </div>
            <div class="card">
              <div class="card-label">${escapeHtml(t.totalAmount)}</div>
              <div class="card-value">${escapeHtml(
                formatMoney(exportRows.reduce((sum, invoice) => sum + toNumber(invoice.total_amount), 0))
              )}</div>
            </div>
            <div class="card">
              <div class="card-label">${escapeHtml(t.taxAmount)}</div>
              <div class="card-value">${escapeHtml(
                formatMoney(exportRows.reduce((sum, invoice) => sum + toNumber(invoice.tax_amount), 0))
              )}</div>
            </div>
            <div class="card">
              <div class="card-label">${escapeHtml(t.selected)}</div>
              <div class="card-value">${escapeHtml(formatNumber(selectedIds.length))}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t.invoice)}</th>
                <th>${escapeHtml(t.customer)}</th>
                <th>${escapeHtml(t.order)}</th>
                <th>${escapeHtml(t.status)}</th>
                <th>${escapeHtml(t.invoiceDate)}</th>
                <th>${escapeHtml(t.subtotal)}</th>
                <th>${escapeHtml(t.tax)}</th>
                <th>${escapeHtml(t.total)}</th>
              </tr>
            </thead>
            <tbody>
              ${buildExportTableRows(exportRows)}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  };

  const statCards = [
    {
      title: t.totalInvoices,
      value: formatNumber(stats.totalInvoices),
      icon: ReceiptText,
      description: isAr ? "كل الفواتير المسجلة" : "All registered invoices",
    },
    {
      title: t.paidInvoices,
      value: formatNumber(stats.paidInvoices),
      icon: CheckCircle2,
      description: isAr ? "فواتير مكتملة السداد" : "Fully paid invoices",
    },
    {
      title: t.openInvoices,
      value: formatNumber(stats.openInvoices),
      icon: ShieldCheck,
      description: isAr ? "فواتير تحتاج متابعة" : "Invoices needing follow-up",
    },
    {
      title: t.totalAmount,
      value: formatMoney(stats.totalAmount),
      icon: Wallet,
      description: t.sar,
      money: true,
    },
  ];

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* =====================================================
            HERO
        ===================================================== */}
        <section className="relative overflow-hidden rounded-[2rem] border bg-gradient-to-br from-background via-background to-muted/40 p-6 shadow-sm">
          <div className="pointer-events-none absolute -top-24 end-12 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 start-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4">
              <Badge
                variant="outline"
                className="w-fit rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-primary"
              >
                <ReceiptText className="me-2 h-3.5 w-3.5" />
                {t.badge}
              </Badge>

              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                  {t.title}
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
                  {t.subtitle}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild variant="outline" className="rounded-2xl">
                <Link href="/system/invoices">
                  {isAr ? (
                    <ArrowLeft className="me-2 h-4 w-4" />
                  ) : (
                    <ArrowLeft className="me-2 h-4 w-4 rotate-180" />
                  )}
                  {t.back}
                </Link>
              </Button>

              <Button asChild className="rounded-2xl">
                <Link href="/system/invoices/create">
                  <Plus className="me-2 h-4 w-4" />
                  {t.create}
                </Link>
              </Button>

              <Button asChild variant="secondary" className="rounded-2xl">
                <Link href="/system/invoices/reports">
                  <BarChart3 className="me-2 h-4 w-4" />
                  {t.reports}
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* =====================================================
            STATS
        ===================================================== */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon;

            return (
              <Card key={card.title} className="rounded-[1.5rem]">
                <CardContent className="flex items-center justify-between gap-4 p-5">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">{card.title}</p>
                    <div className="flex items-center gap-2">
                      {card.money ? (
                        <Image src={SAR_ICON_PATH} alt="SAR" width={18} height={18} />
                      ) : null}
                      <p className="text-2xl font-bold tracking-tight">{card.value}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{card.description}</p>
                  </div>

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        {/* =====================================================
            FILTERS
        ===================================================== */}
        <Card className="rounded-[1.5rem]">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FilterIcon className="h-5 w-5 text-primary" />
                  {t.filters}
                </CardTitle>
                <CardDescription>
                  {formatNumber(filteredInvoices.length)} {t.invoices}
                  {selectedIds.length > 0
                    ? ` • ${formatNumber(selectedIds.length)} ${t.selected}`
                    : ""}
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => loadInvoices("refresh")}
                  disabled={refreshing}
                >
                  {refreshing ? (
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="me-2 h-4 w-4" />
                  )}
                  {t.refresh}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" className="rounded-2xl">
                      <ColumnsIcon className="me-2 h-4 w-4" />
                      {t.columns}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={isAr ? "start" : "end"} className="w-56">
                    {columns.map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.key}
                        checked={column.visible}
                        disabled={column.key === "actions"}
                        onCheckedChange={() => toggleColumn(column.key)}
                      >
                        {isAr ? column.labelAr : column.labelEn}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={exportExcel}
                >
                  <Download className="me-2 h-4 w-4" />
                  {t.exportExcel}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={printTable}
                >
                  <Printer className="me-2 h-4 w-4" />
                  {t.print}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="rounded-2xl ps-9"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as InvoiceStatus)}
                className="h-10 rounded-2xl border border-input bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="ALL">{t.allStatuses}</option>
                {Object.keys(STATUS_META).map((status) => (
                  <option key={status} value={status}>
                    {getStatusLabel(status, locale)}
                  </option>
                ))}
              </select>

              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="rounded-2xl"
                aria-label={t.from}
              />

              <Input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="rounded-2xl"
                aria-label={t.to}
              />

              <Button
                type="button"
                variant="ghost"
                className="rounded-2xl"
                onClick={clearFilters}
              >
                <XCircle className="me-2 h-4 w-4" />
                {t.clear}
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* =====================================================
            TABLE
        ===================================================== */}
        <Card className="rounded-[1.5rem]">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex min-h-96 flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">{t.loading}</p>
              </div>
            ) : sortedInvoices.length === 0 ? (
              <div className="flex min-h-96 flex-col items-center justify-center gap-3 p-8 text-center">
                <FileText className="h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t.empty}</p>
              </div>
            ) : (
              <>
                <div id="invoices-table-section" className="overflow-hidden rounded-[1.5rem]">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-sm">
                      <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                        <tr>
                          {hasColumn("select") ? (
                            <th className="w-12 px-4 py-3 text-start font-medium">
                              <Checkbox
                                checked={pageSelected}
                                onCheckedChange={togglePageSelection}
                                aria-label="Select page"
                              />
                            </th>
                          ) : null}

                          {hasColumn("number") ? (
                            <SortableTh
                              label={t.invoice}
                              sortKey="number"
                              activeKey={sortKey}
                              direction={sortDirection}
                              onSort={toggleSort}
                            />
                          ) : null}

                          {hasColumn("customer") ? (
                            <SortableTh
                              label={t.customer}
                              sortKey="customer_id"
                              activeKey={sortKey}
                              direction={sortDirection}
                              onSort={toggleSort}
                            />
                          ) : null}

                          {hasColumn("order") ? (
                            <SortableTh
                              label={t.order}
                              sortKey="order_id"
                              activeKey={sortKey}
                              direction={sortDirection}
                              onSort={toggleSort}
                            />
                          ) : null}

                          {hasColumn("status") ? (
                            <SortableTh
                              label={t.status}
                              sortKey="status"
                              activeKey={sortKey}
                              direction={sortDirection}
                              onSort={toggleSort}
                            />
                          ) : null}

                          {hasColumn("invoiceDate") ? (
                            <SortableTh
                              label={t.invoiceDate}
                              sortKey="invoice_date"
                              activeKey={sortKey}
                              direction={sortDirection}
                              onSort={toggleSort}
                            />
                          ) : null}

                          {hasColumn("subtotal") ? (
                            <SortableTh
                              label={t.subtotal}
                              sortKey="subtotal"
                              activeKey={sortKey}
                              direction={sortDirection}
                              onSort={toggleSort}
                            />
                          ) : null}

                          {hasColumn("tax") ? (
                            <SortableTh
                              label={t.tax}
                              sortKey="tax_amount"
                              activeKey={sortKey}
                              direction={sortDirection}
                              onSort={toggleSort}
                            />
                          ) : null}

                          {hasColumn("total") ? (
                            <SortableTh
                              label={t.total}
                              sortKey="total_amount"
                              activeKey={sortKey}
                              direction={sortDirection}
                              onSort={toggleSort}
                            />
                          ) : null}

                          {hasColumn("actions") ? (
                            <th className="px-4 py-3 text-end font-medium">{t.actions}</th>
                          ) : null}
                        </tr>
                      </thead>

                      <tbody className="divide-y">
                        {paginatedInvoices.map((invoice) => {
                          const isSelected = selectedIds.includes(invoice.id);
                          const status = String(invoice.status || "DRAFT").toUpperCase();

                          return (
                            <tr
                              key={invoice.id}
                              className={`transition hover:bg-muted/30 ${
                                isSelected ? "bg-primary/5" : "bg-card"
                              }`}
                            >
                              {hasColumn("select") ? (
                                <td className="px-4 py-3">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleInvoiceSelection(invoice.id)}
                                    aria-label={`Select invoice ${invoice.id}`}
                                  />
                                </td>
                              ) : null}

                              {hasColumn("number") ? (
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                      <ReceiptText className="h-4 w-4" />
                                    </div>
                                    <div>
                                      <p className="font-semibold">
                                        {invoice.number || `INV-${invoice.id}`}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        ID: {invoice.id}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                              ) : null}

                              {hasColumn("customer") ? (
                                <td className="px-4 py-3">
                                  {invoice.customer_id ? (
                                    <Badge variant="secondary" className="rounded-full">
                                      #{invoice.customer_id}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">{t.notAvailable}</span>
                                  )}
                                </td>
                              ) : null}

                              {hasColumn("order") ? (
                                <td className="px-4 py-3">
                                  {invoice.order_id ? (
                                    <Badge variant="outline" className="rounded-full">
                                      #{invoice.order_id}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">{t.notAvailable}</span>
                                  )}
                                </td>
                              ) : null}

                              {hasColumn("status") ? (
                                <td className="px-4 py-3">
                                  <Badge
                                    variant="outline"
                                    className={`rounded-full ${getStatusClassName(status)}`}
                                  >
                                    {getStatusLabel(status, locale)}
                                  </Badge>
                                </td>
                              ) : null}

                              {hasColumn("invoiceDate") ? (
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <CalendarDays className="h-4 w-4" />
                                    {formatDate(invoice.invoice_date, locale)}
                                  </div>
                                </td>
                              ) : null}

                              {hasColumn("subtotal") ? (
                                <td className="px-4 py-3">
                                  <MoneyValue value={toNumber(invoice.subtotal)} />
                                </td>
                              ) : null}

                              {hasColumn("tax") ? (
                                <td className="px-4 py-3">
                                  <MoneyValue value={toNumber(invoice.tax_amount)} />
                                </td>
                              ) : null}

                              {hasColumn("total") ? (
                                <td className="px-4 py-3">
                                  <MoneyValue value={toNumber(invoice.total_amount)} strong />
                                </td>
                              ) : null}

                              {hasColumn("actions") ? (
                                <td className="px-4 py-3">
                                  <div className="flex justify-end gap-2">
                                    {status === "DRAFT" ? (
                                      <Button
                                        asChild
                                        variant="secondary"
                                        size="sm"
                                        className="rounded-xl"
                                      >
                                        <Link href={`/system/invoices/${invoice.id}`}>
                                          <BadgeCheck className="me-2 h-4 w-4" />
                                          {t.issue}
                                        </Link>
                                      </Button>
                                    ) : null}

                                    <Button
                                      asChild
                                      variant="ghost"
                                      size="sm"
                                      className="rounded-xl"
                                    >
                                      <Link href={`/system/invoices/${invoice.id}`}>
                                        <Eye className="me-2 h-4 w-4" />
                                        {t.details}
                                      </Link>
                                    </Button>
                                  </div>
                                </td>
                              ) : null}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* =====================================================
                    PAGINATION
                ===================================================== */}
                <div className="flex flex-col gap-3 border-t p-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span>
                      {t.page} {formatNumber(currentPage)} {t.of}{" "}
                      {formatNumber(totalPages)}
                    </span>
                    <span>•</span>
                    <span>
                      {formatNumber(sortedInvoices.length)} {t.invoices}
                    </span>
                    {selectedIds.length > 0 ? (
                      <>
                        <span>•</span>
                        <span>
                          {formatNumber(selectedIds.length)} {t.selected}
                        </span>
                      </>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={pageSize}
                      onChange={(event) => setPageSize(Number(event.target.value))}
                      className="h-9 rounded-xl border border-input bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>
                          {t.rowsPerPage}: {size}
                        </option>
                      ))}
                    </select>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={currentPage <= 1}
                    >
                      {isAr ? (
                        <ChevronRight className="h-4 w-4" />
                      ) : (
                        <ChevronLeft className="h-4 w-4" />
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() =>
                        setCurrentPage((page) => Math.min(totalPages, page + 1))
                      }
                      disabled={currentPage >= totalPages}
                    >
                      {isAr ? (
                        <ChevronLeft className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

/* =====================================================
   SMALL COMPONENTS
===================================================== */

function SortableTh({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const active = activeKey === sortKey;

  return (
    <th className="px-4 py-3 text-start font-medium">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-2 rounded-lg text-start transition hover:text-foreground"
      >
        <span>{label}</span>
        <ArrowUpDown
          className={`h-3.5 w-3.5 ${
            active ? "text-primary" : "text-muted-foreground"
          } ${active && direction === "desc" ? "rotate-180" : ""}`}
        />
      </button>
    </th>
  );
}

function MoneyValue({
  value,
  strong = false,
}: {
  value: number;
  strong?: boolean;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${strong ? "font-bold" : "font-medium"}`}>
      <Image src={SAR_ICON_PATH} alt="SAR" width={14} height={14} />
      <span>{formatMoney(value)}</span>
    </div>
  );
}