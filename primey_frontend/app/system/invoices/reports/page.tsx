"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  FilterIcon,
  Loader2,
  PieChart,
  Printer,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  TrendingUp,
  Wallet,
  XCircle,
  type LucideIcon,
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

/* =====================================================
   TYPES
===================================================== */

type AppLocale = "ar" | "en";

type InvoiceStatus =
  | "ALL"
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED"
  | "REFUNDED";

type ApiCustomer = {
  id?: number | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
};

type ApiOrder = {
  id?: number | null;
  order_number?: string | null;
  status?: string | null;
  payment_status?: string | null;
  fulfillment_status?: string | null;
  total_amount?: string | number | null;
};

type ApiInvoice = {
  id: number;
  invoice_number?: string | null;
  number?: string | null;
  invoice_type?: string | null;
  status?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  invoice_date?: string | null;
  customer_id?: number | null;
  order_id?: number | null;
  customer?: ApiCustomer | null;
  order?: ApiOrder | null;
  subtotal?: string | number | null;
  discount_amount?: string | number | null;
  taxable_amount?: string | number | null;
  tax_rate?: string | number | null;
  tax_amount?: string | number | null;
  total_amount?: string | number | null;
  paid_amount?: string | number | null;
  due_amount?: string | number | null;
  currency?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ApiSummary = {
  count?: number | null;
  subtotal?: string | number | null;
  discount_amount?: string | number | null;
  taxable_amount?: string | number | null;
  tax_amount?: string | number | null;
  total_amount?: string | number | null;
  paid_amount?: string | number | null;
  due_amount?: string | number | null;
  currency?: string | null;
};

type InvoicesApiResponse = {
  ok?: boolean;
  count?: number;
  total_count?: number;
  summary?: ApiSummary;
  results?: ApiInvoice[];
  message?: string;
};

type ReportGroupRow = {
  status?: string;
  invoice_type?: string;
  count?: number;
  subtotal?: string | number | null;
  tax_amount?: string | number | null;
  total_amount?: string | number | null;
  paid_amount?: string | number | null;
  due_amount?: string | number | null;
};

type ReportsApiResponse = {
  ok?: boolean;
  message?: string;
  summary?: ApiSummary;
  by_status?: ReportGroupRow[];
  by_type?: ReportGroupRow[];
  recent?: ApiInvoice[];
};

type StatusMeta = {
  labelAr: string;
  labelEn: string;
  className: string;
};

type StatusReportRow = {
  status: string;
  label: string;
  count: number;
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  due: number;
  percentage: number;
};

type TypeReportRow = {
  invoiceType: string;
  label: string;
  count: number;
  total: number;
  tax: number;
  due: number;
};

type CustomerReportRow = {
  customerKey: string;
  count: number;
  tax: number;
  total: number;
  paid: number;
  due: number;
};

type MonthlyReportRow = {
  monthKey: string;
  count: number;
  tax: number;
  total: number;
  paid: number;
  due: number;
};

/* =====================================================
   CONSTANTS
===================================================== */

const SAR_ICON_PATH = "/currency/sar.svg";

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

const INVOICE_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  SALES: { ar: "فاتورة مبيعات", en: "Sales Invoice" },
  TAX: { ar: "فاتورة ضريبية", en: "Tax Invoice" },
  SIMPLIFIED: { ar: "فاتورة مبسطة", en: "Simplified Invoice" },
  CREDIT_NOTE: { ar: "إشعار دائن", en: "Credit Note" },
  DEBIT_NOTE: { ar: "إشعار مدين", en: "Debit Note" },
};

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

function getInvoiceDate(invoice: ApiInvoice): string | null | undefined {
  return invoice.issue_date || invoice.invoice_date || invoice.created_at;
}

function getInvoiceNumber(invoice: ApiInvoice): string {
  return invoice.invoice_number || invoice.number || `INV-${invoice.id}`;
}

function getCustomerLabel(invoice: ApiInvoice, fallback: string): string {
  return invoice.customer?.name || (invoice.customer_id ? `#${invoice.customer_id}` : fallback);
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

function getInvoiceTypeLabel(type: string | null | undefined, locale: AppLocale): string {
  const key = String(type || "SALES").toUpperCase();
  const meta = INVOICE_TYPE_LABELS[key];

  if (!meta) return type || (locale === "ar" ? "غير محدد" : "Unknown");

  return locale === "ar" ? meta.ar : meta.en;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getMonthKey(value: string | null | undefined, locale: AppLocale): string {
  if (!value) return locale === "ar" ? "بدون تاريخ" : "No date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return locale === "ar" ? "بدون تاريخ" : "No date";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildQueryString({
  statusFilter,
  dateFrom,
  dateTo,
}: {
  statusFilter: InvoiceStatus;
  dateFrom: string;
  dateTo: string;
}) {
  const params = new URLSearchParams();

  if (statusFilter !== "ALL") params.set("status", statusFilter);
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);

  return params.toString();
}

/* =====================================================
   API HELPERS
===================================================== */

async function fetchInvoices(): Promise<{
  invoices: ApiInvoice[];
  summary: ApiSummary | null;
}> {
  const response = await fetch("/api/invoices/?page_size=200", {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as InvoicesApiResponse | null;

  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || "Failed to load invoices reports.");
  }

  return {
    invoices: Array.isArray(data.results) ? data.results : [],
    summary: data.summary || null,
  };
}

async function fetchInvoiceReports(queryString: string): Promise<ReportsApiResponse | null> {
  const url = queryString ? `/api/invoices/reports/?${queryString}` : "/api/invoices/reports/";

  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as ReportsApiResponse | null;

  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || "Failed to load invoice reports.");
  }

  return data;
}

/* =====================================================
   PAGE
===================================================== */

export default function SystemInvoicesReportsPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [invoices, setInvoices] = useState<ApiInvoice[]>([]);
  const [apiSummary, setApiSummary] = useState<ApiSummary | null>(null);
  const [reportsData, setReportsData] = useState<ReportsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [statusFilter, setStatusFilter] = useState<InvoiceStatus>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const isAr = locale === "ar";

  const t = useMemo(
    () => ({
      badge: isAr ? "تقارير الفواتير" : "Invoices Reports",
      title: isAr ? "تقارير الفواتير" : "Invoices Reports",
      subtitle: isAr
        ? "تحليل الفواتير حسب الحالة، الفترة، الضريبة، العملاء، والتحصيل والمتبقي."
        : "Analyze invoices by status, period, tax, customers, paid amounts, and dues.",
      dashboard: isAr ? "لوحة الفواتير" : "Invoices Dashboard",
      list: isAr ? "قائمة الفواتير" : "Invoices List",
      create: isAr ? "إنشاء فاتورة" : "Create Invoice",
      refresh: isAr ? "تحديث" : "Refresh",
      filters: isAr ? "فلاتر التقرير" : "Report Filters",
      filtersDesc: isAr
        ? "اختر الحالة والفترة لتحديث مؤشرات التقرير."
        : "Choose status and date range to update report indicators.",
      status: isAr ? "الحالة" : "Status",
      allStatuses: isAr ? "كل الحالات" : "All Statuses",
      from: isAr ? "من تاريخ" : "From",
      to: isAr ? "إلى تاريخ" : "To",
      clear: isAr ? "مسح الفلاتر" : "Clear Filters",
      exportExcel: isAr ? "تصدير Excel" : "Export Excel",
      print: isAr ? "طباعة Web PDF" : "Print Web PDF",
      totalInvoices: isAr ? "إجمالي الفواتير" : "Total Invoices",
      totalAmount: isAr ? "إجمالي الفواتير" : "Invoices Total",
      paidAmount: isAr ? "إجمالي المدفوع" : "Paid Total",
      dueAmount: isAr ? "إجمالي المتبقي" : "Due Total",
      taxAmount: isAr ? "إجمالي الضريبة" : "Tax Total",
      averageInvoice: isAr ? "متوسط الفاتورة" : "Average Invoice",
      paidInvoices: isAr ? "فواتير مدفوعة" : "Paid Invoices",
      issuedInvoices: isAr ? "فواتير مصدرة" : "Issued Invoices",
      openInvoices: isAr ? "فواتير تحتاج متابعة" : "Need Follow-up",
      cancelledInvoices: isAr ? "فواتير ملغاة" : "Cancelled Invoices",
      statusReport: isAr ? "تقرير الحالات" : "Status Report",
      statusReportDesc: isAr
        ? "توزيع الفواتير حسب الحالة مع الإجماليات والمدفوع والمتبقي."
        : "Invoice distribution by status with totals, paid, and due amounts.",
      taxReport: isAr ? "تقرير الضريبة والتحصيل" : "Tax & Collection Report",
      taxReportDesc: isAr
        ? "ملخص ضريبة القيمة المضافة والتحصيل بناءً على الفواتير الحالية."
        : "VAT and collection summary based on current invoices.",
      customerReport: isAr ? "ملخص حسب العميل" : "Customer Summary",
      customerReportDesc: isAr
        ? "أعلى العملاء حسب قيمة الفواتير."
        : "Top customers by invoice value.",
      monthlyReport: isAr ? "ملخص شهري" : "Monthly Summary",
      monthlyReportDesc: isAr
        ? "تجميع الفواتير حسب الشهر."
        : "Invoices grouped by month.",
      typeReport: isAr ? "ملخص حسب نوع الفاتورة" : "Invoice Type Summary",
      typeReportDesc: isAr
        ? "توزيع الفواتير حسب نوعها."
        : "Invoice distribution by invoice type.",
      recentInvoices: isAr ? "آخر الفواتير" : "Recent Invoices",
      recentInvoicesDesc: isAr
        ? "آخر الفواتير المسجلة ضمن النظام."
        : "Latest invoices registered in the system.",
      invoice: isAr ? "الفاتورة" : "Invoice",
      invoiceType: isAr ? "نوع الفاتورة" : "Invoice Type",
      count: isAr ? "العدد" : "Count",
      subtotal: isAr ? "قبل الضريبة" : "Subtotal",
      tax: isAr ? "الضريبة" : "Tax",
      total: isAr ? "الإجمالي" : "Total",
      paid: isAr ? "المدفوع" : "Paid",
      due: isAr ? "المتبقي" : "Due",
      percentage: isAr ? "النسبة" : "Percentage",
      customer: isAr ? "العميل" : "Customer",
      month: isAr ? "الشهر" : "Month",
      issueDate: isAr ? "تاريخ الإصدار" : "Issue Date",
      loading: isAr ? "جاري تحميل تقارير الفواتير..." : "Loading invoice reports...",
      empty: isAr ? "لا توجد بيانات مطابقة للتقرير الحالي." : "No data matches current report.",
      loadError: isAr ? "تعذر تحميل تقارير الفواتير" : "Failed to load invoice reports",
      refreshSuccess: isAr ? "تم تحديث تقارير الفواتير بنجاح" : "Invoice reports refreshed successfully",
      exportSuccess: isAr ? "تم تصدير تقرير الفواتير بنجاح" : "Invoice report exported successfully",
      noDataExport: isAr ? "لا توجد بيانات للتصدير" : "No data to export",
      noDataPrint: isAr ? "لا توجد بيانات للطباعة" : "No data to print",
      printTitle: isAr ? "تقرير الفواتير" : "Invoices Report",
      noRows: isAr ? "لا توجد بيانات" : "No data",
      notAvailable: isAr ? "غير متاح" : "N/A",
      sar: isAr ? "ريال" : "SAR",
    }),
    [isAr]
  );

  const reportQueryString = useMemo(
    () => buildQueryString({ statusFilter, dateFrom, dateTo }),
    [dateFrom, dateTo, statusFilter]
  );

  const loadReports = async (mode: "initial" | "refresh" = "initial") => {
    try {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);

      const [listData, reportData] = await Promise.all([
        fetchInvoices(),
        fetchInvoiceReports(reportQueryString),
      ]);

      setInvoices(listData.invoices);
      setApiSummary(listData.summary);
      setReportsData(reportData);

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
    loadReports("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadReports("refresh");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportQueryString]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const status = String(invoice.status || "DRAFT").toUpperCase();

      if (statusFilter !== "ALL" && status !== statusFilter) return false;

      if (dateFrom || dateTo) {
        const invoiceDate = getInvoiceDate(invoice) ? new Date(getInvoiceDate(invoice) as string) : null;

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

      return true;
    });
  }, [dateFrom, dateTo, invoices, statusFilter]);

  const stats = useMemo(() => {
    const summary = reportsData?.summary || null;

    const totalInvoices =
      typeof summary?.count === "number" ? summary.count : filteredInvoices.length;

    const subtotal =
      summary?.subtotal !== undefined && summary?.subtotal !== null
        ? toNumber(summary.subtotal)
        : filteredInvoices.reduce((sum, invoice) => sum + toNumber(invoice.subtotal), 0);

    const taxAmount =
      summary?.tax_amount !== undefined && summary?.tax_amount !== null
        ? toNumber(summary.tax_amount)
        : filteredInvoices.reduce((sum, invoice) => sum + toNumber(invoice.tax_amount), 0);

    const totalAmount =
      summary?.total_amount !== undefined && summary?.total_amount !== null
        ? toNumber(summary.total_amount)
        : filteredInvoices.reduce((sum, invoice) => sum + toNumber(invoice.total_amount), 0);

    const paidAmount =
      summary?.paid_amount !== undefined && summary?.paid_amount !== null
        ? toNumber(summary.paid_amount)
        : filteredInvoices.reduce((sum, invoice) => sum + toNumber(invoice.paid_amount), 0);

    const dueAmount =
      summary?.due_amount !== undefined && summary?.due_amount !== null
        ? toNumber(summary.due_amount)
        : filteredInvoices.reduce((sum, invoice) => sum + toNumber(invoice.due_amount), 0);

    const paidInvoices = filteredInvoices.filter(
      (invoice) => String(invoice.status || "").toUpperCase() === "PAID"
    ).length;

    const issuedInvoices = filteredInvoices.filter(
      (invoice) => String(invoice.status || "").toUpperCase() === "ISSUED"
    ).length;

    const cancelledInvoices = filteredInvoices.filter(
      (invoice) => String(invoice.status || "").toUpperCase() === "CANCELLED"
    ).length;

    const openInvoices = filteredInvoices.filter((invoice) => {
      const status = String(invoice.status || "").toUpperCase();
      return ["DRAFT", "ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(status);
    }).length;

    return {
      totalInvoices,
      subtotal,
      taxAmount,
      totalAmount,
      paidAmount,
      dueAmount,
      paidInvoices,
      issuedInvoices,
      cancelledInvoices,
      openInvoices,
      averageInvoice: totalInvoices > 0 ? totalAmount / totalInvoices : 0,
    };
  }, [filteredInvoices, reportsData]);

  const statusRows = useMemo<StatusReportRow[]>(() => {
    const apiRows = Array.isArray(reportsData?.by_status) ? reportsData.by_status : [];

    if (apiRows.length > 0) {
      const totalCount = Math.max(
        apiRows.reduce((sum, row) => sum + Number(row.count || 0), 0),
        1
      );

      return apiRows
        .map((row) => {
          const status = String(row.status || "DRAFT").toUpperCase();

          return {
            status,
            label: getStatusLabel(status, locale),
            count: Number(row.count || 0),
            subtotal: toNumber(row.subtotal),
            tax: toNumber(row.tax_amount),
            total: toNumber(row.total_amount),
            paid: toNumber(row.paid_amount),
            due: toNumber(row.due_amount),
            percentage: Math.round((Number(row.count || 0) / totalCount) * 100),
          };
        })
        .filter((row) => row.count > 0);
    }

    const totalCount = Math.max(filteredInvoices.length, 1);

    return Object.keys(STATUS_META)
      .map((status) => {
        const rows = filteredInvoices.filter(
          (invoice) => String(invoice.status || "DRAFT").toUpperCase() === status
        );

        return {
          status,
          label: getStatusLabel(status, locale),
          count: rows.length,
          subtotal: rows.reduce((sum, item) => sum + toNumber(item.subtotal), 0),
          tax: rows.reduce((sum, item) => sum + toNumber(item.tax_amount), 0),
          total: rows.reduce((sum, item) => sum + toNumber(item.total_amount), 0),
          paid: rows.reduce((sum, item) => sum + toNumber(item.paid_amount), 0),
          due: rows.reduce((sum, item) => sum + toNumber(item.due_amount), 0),
          percentage: Math.round((rows.length / totalCount) * 100),
        };
      })
      .filter((row) => row.count > 0);
  }, [filteredInvoices, locale, reportsData]);

  const typeRows = useMemo<TypeReportRow[]>(() => {
    const apiRows = Array.isArray(reportsData?.by_type) ? reportsData.by_type : [];

    if (apiRows.length > 0) {
      return apiRows
        .map((row) => {
          const invoiceType = String(row.invoice_type || "SALES").toUpperCase();

          return {
            invoiceType,
            label: getInvoiceTypeLabel(invoiceType, locale),
            count: Number(row.count || 0),
            total: toNumber(row.total_amount),
            tax: toNumber(row.tax_amount),
            due: toNumber(row.due_amount),
          };
        })
        .filter((row) => row.count > 0);
    }

    const map = new Map<string, TypeReportRow>();

    filteredInvoices.forEach((invoice) => {
      const invoiceType = String(invoice.invoice_type || "SALES").toUpperCase();
      const existing =
        map.get(invoiceType) ||
        ({
          invoiceType,
          label: getInvoiceTypeLabel(invoiceType, locale),
          count: 0,
          total: 0,
          tax: 0,
          due: 0,
        } satisfies TypeReportRow);

      existing.count += 1;
      existing.total += toNumber(invoice.total_amount);
      existing.tax += toNumber(invoice.tax_amount);
      existing.due += toNumber(invoice.due_amount);

      map.set(invoiceType, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredInvoices, locale, reportsData]);

  const customerRows = useMemo<CustomerReportRow[]>(() => {
    const map = new Map<string, CustomerReportRow>();

    filteredInvoices.forEach((invoice) => {
      const customerKey = getCustomerLabel(invoice, isAr ? "غير محدد" : "N/A");

      const existing =
        map.get(customerKey) ||
        ({
          customerKey,
          count: 0,
          tax: 0,
          total: 0,
          paid: 0,
          due: 0,
        } satisfies CustomerReportRow);

      existing.count += 1;
      existing.tax += toNumber(invoice.tax_amount);
      existing.total += toNumber(invoice.total_amount);
      existing.paid += toNumber(invoice.paid_amount);
      existing.due += toNumber(invoice.due_amount);

      map.set(customerKey, existing);
    });

    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [filteredInvoices, isAr]);

  const monthlyRows = useMemo<MonthlyReportRow[]>(() => {
    const map = new Map<string, MonthlyReportRow>();

    filteredInvoices.forEach((invoice) => {
      const monthKey = getMonthKey(getInvoiceDate(invoice), locale);
      const existing =
        map.get(monthKey) ||
        ({
          monthKey,
          count: 0,
          tax: 0,
          total: 0,
          paid: 0,
          due: 0,
        } satisfies MonthlyReportRow);

      existing.count += 1;
      existing.tax += toNumber(invoice.tax_amount);
      existing.total += toNumber(invoice.total_amount);
      existing.paid += toNumber(invoice.paid_amount);
      existing.due += toNumber(invoice.due_amount);

      map.set(monthKey, existing);
    });

    return Array.from(map.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [filteredInvoices, locale]);

  const recentInvoices = useMemo(() => {
    const source = Array.isArray(reportsData?.recent) && reportsData.recent.length > 0
      ? reportsData.recent
      : filteredInvoices;

    return source.slice(0, 8);
  }, [filteredInvoices, reportsData]);

  const clearFilters = () => {
    setStatusFilter("ALL");
    setDateFrom("");
    setDateTo("");
  };

  const buildStatusRowsHtml = () =>
    statusRows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.label)}</td>
            <td>${escapeHtml(formatNumber(row.count))}</td>
            <td>${escapeHtml(formatMoney(row.subtotal))}</td>
            <td>${escapeHtml(formatMoney(row.tax))}</td>
            <td>${escapeHtml(formatMoney(row.total))}</td>
            <td>${escapeHtml(formatMoney(row.paid))}</td>
            <td>${escapeHtml(formatMoney(row.due))}</td>
            <td>${escapeHtml(formatNumber(row.percentage))}%</td>
          </tr>
        `
      )
      .join("");

  const buildCustomerRowsHtml = () =>
    customerRows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.customerKey)}</td>
            <td>${escapeHtml(formatNumber(row.count))}</td>
            <td>${escapeHtml(formatMoney(row.tax))}</td>
            <td>${escapeHtml(formatMoney(row.total))}</td>
            <td>${escapeHtml(formatMoney(row.paid))}</td>
            <td>${escapeHtml(formatMoney(row.due))}</td>
          </tr>
        `
      )
      .join("");

  const buildMonthlyRowsHtml = () =>
    monthlyRows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.monthKey)}</td>
            <td>${escapeHtml(formatNumber(row.count))}</td>
            <td>${escapeHtml(formatMoney(row.tax))}</td>
            <td>${escapeHtml(formatMoney(row.total))}</td>
            <td>${escapeHtml(formatMoney(row.paid))}</td>
            <td>${escapeHtml(formatMoney(row.due))}</td>
          </tr>
        `
      )
      .join("");

  const buildTypeRowsHtml = () =>
    typeRows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.label)}</td>
            <td>${escapeHtml(formatNumber(row.count))}</td>
            <td>${escapeHtml(formatMoney(row.tax))}</td>
            <td>${escapeHtml(formatMoney(row.total))}</td>
            <td>${escapeHtml(formatMoney(row.due))}</td>
          </tr>
        `
      )
      .join("");

  const exportExcel = () => {
    if (filteredInvoices.length === 0) {
      toast.error(t.noDataExport);
      return;
    }

    const generatedAt = new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());

    const html = `
      <html dir="${isAr ? "rtl" : "ltr"}" lang="${locale}">
        <head>
          <meta charset="UTF-8" />
          <style>
            body { font-family: Arial, sans-serif; direction: ${isAr ? "rtl" : "ltr"}; }
            h1, h2 { margin: 0 0 10px; }
            .meta { color: #475569; margin-bottom: 20px; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 28px; }
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
          </style>
        </head>
        <body>
          <h1>${escapeHtml(t.printTitle)}</h1>
          <div class="meta">${escapeHtml(generatedAt)}</div>

          <h2>${escapeHtml(isAr ? "الملخص المالي" : "Financial Summary")}</h2>
          <table>
            <tbody>
              <tr><th>${escapeHtml(t.totalInvoices)}</th><td>${escapeHtml(formatNumber(stats.totalInvoices))}</td></tr>
              <tr><th>${escapeHtml(t.subtotal)}</th><td>${escapeHtml(formatMoney(stats.subtotal))}</td></tr>
              <tr><th>${escapeHtml(t.taxAmount)}</th><td>${escapeHtml(formatMoney(stats.taxAmount))}</td></tr>
              <tr><th>${escapeHtml(t.totalAmount)}</th><td>${escapeHtml(formatMoney(stats.totalAmount))}</td></tr>
              <tr><th>${escapeHtml(t.paidAmount)}</th><td>${escapeHtml(formatMoney(stats.paidAmount))}</td></tr>
              <tr><th>${escapeHtml(t.dueAmount)}</th><td>${escapeHtml(formatMoney(stats.dueAmount))}</td></tr>
              <tr><th>${escapeHtml(t.averageInvoice)}</th><td>${escapeHtml(formatMoney(stats.averageInvoice))}</td></tr>
            </tbody>
          </table>

          <h2>${escapeHtml(t.statusReport)}</h2>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t.status)}</th>
                <th>${escapeHtml(t.count)}</th>
                <th>${escapeHtml(t.subtotal)}</th>
                <th>${escapeHtml(t.tax)}</th>
                <th>${escapeHtml(t.total)}</th>
                <th>${escapeHtml(t.paid)}</th>
                <th>${escapeHtml(t.due)}</th>
                <th>${escapeHtml(t.percentage)}</th>
              </tr>
            </thead>
            <tbody>${buildStatusRowsHtml()}</tbody>
          </table>

          <h2>${escapeHtml(t.customerReport)}</h2>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t.customer)}</th>
                <th>${escapeHtml(t.count)}</th>
                <th>${escapeHtml(t.tax)}</th>
                <th>${escapeHtml(t.total)}</th>
                <th>${escapeHtml(t.paid)}</th>
                <th>${escapeHtml(t.due)}</th>
              </tr>
            </thead>
            <tbody>${buildCustomerRowsHtml()}</tbody>
          </table>

          <h2>${escapeHtml(t.monthlyReport)}</h2>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t.month)}</th>
                <th>${escapeHtml(t.count)}</th>
                <th>${escapeHtml(t.tax)}</th>
                <th>${escapeHtml(t.total)}</th>
                <th>${escapeHtml(t.paid)}</th>
                <th>${escapeHtml(t.due)}</th>
              </tr>
            </thead>
            <tbody>${buildMonthlyRowsHtml()}</tbody>
          </table>

          <h2>${escapeHtml(t.typeReport)}</h2>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t.invoiceType)}</th>
                <th>${escapeHtml(t.count)}</th>
                <th>${escapeHtml(t.tax)}</th>
                <th>${escapeHtml(t.total)}</th>
                <th>${escapeHtml(t.due)}</th>
              </tr>
            </thead>
            <tbody>${buildTypeRowsHtml()}</tbody>
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
    link.download = `primey-care-invoices-report-${dateStamp}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(t.exportSuccess);
  };

  const printReport = () => {
    if (filteredInvoices.length === 0) {
      toast.error(t.noDataPrint);
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
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 32px;
              font-family: Arial, sans-serif;
              color: #0f172a;
              direction: ${isAr ? "rtl" : "ltr"};
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
            .title { font-size: 26px; font-weight: 800; margin: 0 0 8px; }
            .subtitle { margin: 0; color: #475569; font-size: 13px; }
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
            .card-label { color: #64748b; font-size: 12px; margin-bottom: 6px; }
            .card-value { font-size: 18px; font-weight: 800; }
            h2 { font-size: 18px; margin: 28px 0 12px; }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
              margin-bottom: 22px;
            }
            th {
              background: #f1f5f9;
              border: 1px solid #cbd5e1;
              padding: 10px;
              text-align: ${isAr ? "right" : "left"};
            }
            td {
              border: 1px solid #cbd5e1;
              padding: 10px;
              text-align: ${isAr ? "right" : "left"};
            }
            tr:nth-child(even) td { background: #f8fafc; }
            @media print {
              body { padding: 18px; }
              .no-print { display: none; }
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
              <div class="card-value">${escapeHtml(formatNumber(stats.totalInvoices))}</div>
            </div>
            <div class="card">
              <div class="card-label">${escapeHtml(t.totalAmount)}</div>
              <div class="card-value">${escapeHtml(formatMoney(stats.totalAmount))}</div>
            </div>
            <div class="card">
              <div class="card-label">${escapeHtml(t.paidAmount)}</div>
              <div class="card-value">${escapeHtml(formatMoney(stats.paidAmount))}</div>
            </div>
            <div class="card">
              <div class="card-label">${escapeHtml(t.dueAmount)}</div>
              <div class="card-value">${escapeHtml(formatMoney(stats.dueAmount))}</div>
            </div>
          </div>

          <h2>${escapeHtml(t.statusReport)}</h2>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t.status)}</th>
                <th>${escapeHtml(t.count)}</th>
                <th>${escapeHtml(t.subtotal)}</th>
                <th>${escapeHtml(t.tax)}</th>
                <th>${escapeHtml(t.total)}</th>
                <th>${escapeHtml(t.paid)}</th>
                <th>${escapeHtml(t.due)}</th>
                <th>${escapeHtml(t.percentage)}</th>
              </tr>
            </thead>
            <tbody>${buildStatusRowsHtml()}</tbody>
          </table>

          <h2>${escapeHtml(t.customerReport)}</h2>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t.customer)}</th>
                <th>${escapeHtml(t.count)}</th>
                <th>${escapeHtml(t.tax)}</th>
                <th>${escapeHtml(t.total)}</th>
                <th>${escapeHtml(t.paid)}</th>
                <th>${escapeHtml(t.due)}</th>
              </tr>
            </thead>
            <tbody>${buildCustomerRowsHtml()}</tbody>
          </table>

          <h2>${escapeHtml(t.monthlyReport)}</h2>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t.month)}</th>
                <th>${escapeHtml(t.count)}</th>
                <th>${escapeHtml(t.tax)}</th>
                <th>${escapeHtml(t.total)}</th>
                <th>${escapeHtml(t.paid)}</th>
                <th>${escapeHtml(t.due)}</th>
              </tr>
            </thead>
            <tbody>${buildMonthlyRowsHtml()}</tbody>
          </table>

          <h2>${escapeHtml(t.typeReport)}</h2>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t.invoiceType)}</th>
                <th>${escapeHtml(t.count)}</th>
                <th>${escapeHtml(t.tax)}</th>
                <th>${escapeHtml(t.total)}</th>
                <th>${escapeHtml(t.due)}</th>
              </tr>
            </thead>
            <tbody>${buildTypeRowsHtml()}</tbody>
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
      description: isAr ? "عدد الفواتير ضمن الفلتر" : "Invoices within current filter",
      icon: ReceiptText,
    },
    {
      title: t.totalAmount,
      value: formatMoney(stats.totalAmount),
      description: t.sar,
      icon: Wallet,
      money: true,
    },
    {
      title: t.paidAmount,
      value: formatMoney(stats.paidAmount),
      description: isAr ? "إجمالي ما تم تحصيله" : "Total collected amount",
      icon: CheckCircle2,
      money: true,
    },
    {
      title: t.dueAmount,
      value: formatMoney(stats.dueAmount),
      description: isAr ? "إجمالي المبالغ المتبقية" : "Total outstanding due",
      icon: Clock3,
      money: true,
    },
  ];

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border bg-gradient-to-br from-background via-background to-muted/40 p-6 shadow-sm">
          <div className="pointer-events-none absolute -top-24 end-12 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 start-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4">
              <Badge
                variant="outline"
                className="w-fit rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-primary"
              >
                <BarChart3 className="me-2 h-3.5 w-3.5" />
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
                  {t.dashboard}
                </Link>
              </Button>

              <Button asChild variant="secondary" className="rounded-2xl">
                <Link href="/system/invoices/list">
                  <FileText className="me-2 h-4 w-4" />
                  {t.list}
                </Link>
              </Button>

              <Button asChild className="rounded-2xl">
                <Link href="/system/invoices/create">
                  <ReceiptText className="me-2 h-4 w-4" />
                  {t.create}
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <Card className="rounded-[1.5rem]">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FilterIcon className="h-5 w-5 text-primary" />
                  {t.filters}
                </CardTitle>
                <CardDescription>{t.filtersDesc}</CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => loadReports("refresh")}
                  disabled={refreshing}
                >
                  {refreshing ? (
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="me-2 h-4 w-4" />
                  )}
                  {t.refresh}
                </Button>

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
                  onClick={printReport}
                >
                  <Printer className="me-2 h-4 w-4" />
                  {t.print}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
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

        {loading ? (
          <Card className="rounded-[1.5rem]">
            <CardContent className="flex min-h-96 flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">{t.loading}</p>
            </CardContent>
          </Card>
        ) : filteredInvoices.length === 0 ? (
          <Card className="rounded-[1.5rem]">
            <CardContent className="flex min-h-96 flex-col items-center justify-center gap-3 text-center">
              <ReceiptText className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t.empty}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {statCards.map((card) => (
                <ReportStatCard key={card.title} {...card} />
              ))}
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
              <Card className="rounded-[1.5rem]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-primary" />
                    {t.statusReport}
                  </CardTitle>
                  <CardDescription>{t.statusReportDesc}</CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="overflow-hidden rounded-3xl border">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] text-sm">
                        <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 text-start font-medium">{t.status}</th>
                            <th className="px-4 py-3 text-start font-medium">{t.count}</th>
                            <th className="px-4 py-3 text-start font-medium">{t.subtotal}</th>
                            <th className="px-4 py-3 text-start font-medium">{t.tax}</th>
                            <th className="px-4 py-3 text-start font-medium">{t.total}</th>
                            <th className="px-4 py-3 text-start font-medium">{t.paid}</th>
                            <th className="px-4 py-3 text-start font-medium">{t.due}</th>
                            <th className="px-4 py-3 text-start font-medium">{t.percentage}</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y">
                          {statusRows.map((row) => (
                            <tr key={row.status} className="bg-card hover:bg-muted/30">
                              <td className="px-4 py-3">
                                <Badge
                                  variant="outline"
                                  className={`rounded-full ${getStatusClassName(row.status)}`}
                                >
                                  {row.label}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 font-semibold">
                                {formatNumber(row.count)}
                              </td>
                              <td className="px-4 py-3">
                                <MoneyValue value={row.subtotal} />
                              </td>
                              <td className="px-4 py-3">
                                <MoneyValue value={row.tax} />
                              </td>
                              <td className="px-4 py-3">
                                <MoneyValue value={row.total} strong />
                              </td>
                              <td className="px-4 py-3">
                                <MoneyValue value={row.paid} />
                              </td>
                              <td className="px-4 py-3">
                                <MoneyValue value={row.due} strong />
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex min-w-36 items-center gap-3">
                                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className="h-full rounded-full bg-primary"
                                      style={{ width: `${Math.min(row.percentage, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-semibold">
                                    {formatNumber(row.percentage)}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[1.5rem]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    {t.taxReport}
                  </CardTitle>
                  <CardDescription>{t.taxReportDesc}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <TaxLine label={t.subtotal} value={stats.subtotal} />
                  <TaxLine label={t.taxAmount} value={stats.taxAmount} />
                  <TaxLine label={t.totalAmount} value={stats.totalAmount} strong />
                  <TaxLine label={t.paidAmount} value={stats.paidAmount} />
                  <TaxLine label={t.dueAmount} value={stats.dueAmount} strong />

                  <div className="rounded-3xl border bg-muted/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{t.openInvoices}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {isAr ? "تحتاج متابعة تحصيل" : "Need collection follow-up"}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="rounded-full border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                      >
                        {formatNumber(stats.openInvoices)}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <Card className="rounded-[1.5rem]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-primary" />
                    {t.customerReport}
                  </CardTitle>
                  <CardDescription>{t.customerReportDesc}</CardDescription>
                </CardHeader>

                <CardContent>
                  <SimpleReportTable
                    emptyText={t.noRows}
                    headers={[t.customer, t.count, t.tax, t.total, t.paid, t.due]}
                    moneyColumns={[2, 3, 4, 5]}
                    rows={customerRows.map((row) => [
                      row.customerKey,
                      formatNumber(row.count),
                      formatMoney(row.tax),
                      formatMoney(row.total),
                      formatMoney(row.paid),
                      formatMoney(row.due),
                    ])}
                  />
                </CardContent>
              </Card>

              <Card className="rounded-[1.5rem]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-primary" />
                    {t.monthlyReport}
                  </CardTitle>
                  <CardDescription>{t.monthlyReportDesc}</CardDescription>
                </CardHeader>

                <CardContent>
                  <SimpleReportTable
                    emptyText={t.noRows}
                    headers={[t.month, t.count, t.tax, t.total, t.paid, t.due]}
                    moneyColumns={[2, 3, 4, 5]}
                    rows={monthlyRows.map((row) => [
                      row.monthKey,
                      formatNumber(row.count),
                      formatMoney(row.tax),
                      formatMoney(row.total),
                      formatMoney(row.paid),
                      formatMoney(row.due),
                    ])}
                  />
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <Card className="rounded-[1.5rem]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ReceiptText className="h-5 w-5 text-primary" />
                    {t.typeReport}
                  </CardTitle>
                  <CardDescription>{t.typeReportDesc}</CardDescription>
                </CardHeader>

                <CardContent>
                  <SimpleReportTable
                    emptyText={t.noRows}
                    headers={[t.invoiceType, t.count, t.tax, t.total, t.due]}
                    moneyColumns={[2, 3, 4]}
                    rows={typeRows.map((row) => [
                      row.label,
                      formatNumber(row.count),
                      formatMoney(row.tax),
                      formatMoney(row.total),
                      formatMoney(row.due),
                    ])}
                  />
                </CardContent>
              </Card>

              <Card className="rounded-[1.5rem]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    {t.recentInvoices}
                  </CardTitle>
                  <CardDescription>{t.recentInvoicesDesc}</CardDescription>
                </CardHeader>

                <CardContent>
                  <SimpleReportTable
                    emptyText={t.noRows}
                    headers={[t.invoice, t.customer, t.status, t.issueDate, t.total, t.due]}
                    moneyColumns={[4, 5]}
                    rows={recentInvoices.map((invoice) => [
                      getInvoiceNumber(invoice),
                      getCustomerLabel(invoice, t.notAvailable),
                      getStatusLabel(invoice.status, locale),
                      formatDate(getInvoiceDate(invoice), locale),
                      formatMoney(toNumber(invoice.total_amount)),
                      formatMoney(toNumber(invoice.due_amount)),
                    ])}
                  />
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

/* =====================================================
   SMALL COMPONENTS
===================================================== */

function ReportStatCard({
  title,
  value,
  description,
  icon: Icon,
  money = false,
}: {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  money?: boolean;
}) {
  return (
    <Card className="rounded-[1.5rem]">
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{title}</p>
          <div className="flex items-center gap-2">
            {money ? (
              <Image src={SAR_ICON_PATH} alt="SAR" width={18} height={18} />
            ) : null}
            <p className="text-2xl font-bold tracking-tight">{value}</p>
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
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

function TaxLine({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-3xl border p-4 ${
        strong ? "border-primary/20 bg-primary/5" : "bg-card"
      }`}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className={`flex items-center gap-1.5 ${strong ? "text-lg font-bold" : "font-semibold"}`}>
        <Image src={SAR_ICON_PATH} alt="SAR" width={strong ? 17 : 14} height={strong ? 17 : 14} />
        {formatMoney(value)}
      </div>
    </div>
  );
}

function SimpleReportTable({
  headers,
  rows,
  emptyText,
  moneyColumns = [],
}: {
  headers: string[];
  rows: string[][];
  emptyText: string;
  moneyColumns?: number[];
}) {
  return (
    <div className="overflow-hidden rounded-3xl border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3 text-start font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr key={`${row.join("-")}-${rowIndex}`} className="bg-card hover:bg-muted/30">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${cell}-${cellIndex}`}
                      className={`px-4 py-3 ${cellIndex === row.length - 1 ? "font-bold" : ""}`}
                    >
                      {moneyColumns.includes(cellIndex) ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Image src={SAR_ICON_PATH} alt="SAR" width={14} height={14} />
                          {cell}
                        </span>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}