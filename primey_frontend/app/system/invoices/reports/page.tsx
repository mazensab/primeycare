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
  percentage: number;
};

type CustomerReportRow = {
  customerKey: string;
  count: number;
  tax: number;
  total: number;
};

type MonthlyReportRow = {
  monthKey: string;
  count: number;
  tax: number;
  total: number;
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

function getMonthKey(value: string | null | undefined): string {
  if (!value) return "بدون تاريخ";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "بدون تاريخ";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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
    throw new Error(data?.message || "Failed to load invoices reports.");
  }

  return Array.isArray(data.results) ? data.results : [];
}

/* =====================================================
   PAGE
===================================================== */

export default function SystemInvoicesReportsPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [invoices, setInvoices] = useState<ApiInvoice[]>([]);
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
        ? "تحليل الفواتير حسب الحالة، الفترة، الضريبة، العملاء، والإجماليات المالية."
        : "Analyze invoices by status, period, tax, customers, and financial totals.",
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
      taxAmount: isAr ? "إجمالي الضريبة" : "Tax Total",
      averageInvoice: isAr ? "متوسط الفاتورة" : "Average Invoice",
      paidInvoices: isAr ? "فواتير مدفوعة" : "Paid Invoices",
      issuedInvoices: isAr ? "فواتير مصدرة" : "Issued Invoices",
      openInvoices: isAr ? "فواتير تحتاج متابعة" : "Need Follow-up",
      cancelledInvoices: isAr ? "فواتير ملغاة" : "Cancelled Invoices",
      statusReport: isAr ? "تقرير الحالات" : "Status Report",
      statusReportDesc: isAr
        ? "توزيع الفواتير حسب الحالة مع الإجماليات."
        : "Invoice distribution by status with totals.",
      taxReport: isAr ? "تقرير الضريبة" : "Tax Report",
      taxReportDesc: isAr
        ? "ملخص ضريبة القيمة المضافة بناءً على الفواتير الحالية."
        : "VAT summary based on current invoices.",
      customerReport: isAr ? "ملخص حسب العميل" : "Customer Summary",
      customerReportDesc: isAr
        ? "أعلى العملاء حسب قيمة الفواتير."
        : "Top customers by invoice value.",
      monthlyReport: isAr ? "ملخص شهري" : "Monthly Summary",
      monthlyReportDesc: isAr
        ? "تجميع الفواتير حسب الشهر."
        : "Invoices grouped by month.",
      count: isAr ? "العدد" : "Count",
      subtotal: isAr ? "قبل الضريبة" : "Subtotal",
      tax: isAr ? "الضريبة" : "Tax",
      total: isAr ? "الإجمالي" : "Total",
      percentage: isAr ? "النسبة" : "Percentage",
      customer: isAr ? "العميل" : "Customer",
      month: isAr ? "الشهر" : "Month",
      loading: isAr ? "جاري تحميل تقارير الفواتير..." : "Loading invoice reports...",
      empty: isAr ? "لا توجد بيانات مطابقة للتقرير الحالي." : "No data matches current report.",
      loadError: isAr ? "تعذر تحميل تقارير الفواتير" : "Failed to load invoice reports",
      refreshSuccess: isAr ? "تم تحديث تقارير الفواتير بنجاح" : "Invoice reports refreshed successfully",
      exportSuccess: isAr ? "تم تصدير تقرير الفواتير بنجاح" : "Invoice report exported successfully",
      noDataExport: isAr ? "لا توجد بيانات للتصدير" : "No data to export",
      noDataPrint: isAr ? "لا توجد بيانات للطباعة" : "No data to print",
      printTitle: isAr ? "تقرير الفواتير" : "Invoices Report",
      sar: isAr ? "ريال" : "SAR",
    }),
    [isAr]
  );

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

  const filteredInvoices = useMemo(() => {
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

      return true;
    });
  }, [dateFrom, dateTo, invoices, statusFilter]);

  const stats = useMemo(() => {
    const totalInvoices = filteredInvoices.length;

    const totalAmount = filteredInvoices.reduce(
      (sum, invoice) => sum + toNumber(invoice.total_amount),
      0
    );

    const subtotal = filteredInvoices.reduce(
      (sum, invoice) => sum + toNumber(invoice.subtotal),
      0
    );

    const taxAmount = filteredInvoices.reduce(
      (sum, invoice) => sum + toNumber(invoice.tax_amount),
      0
    );

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
      paidInvoices,
      issuedInvoices,
      cancelledInvoices,
      openInvoices,
      averageInvoice: totalInvoices > 0 ? totalAmount / totalInvoices : 0,
    };
  }, [filteredInvoices]);

  const statusRows = useMemo<StatusReportRow[]>(() => {
    const totalCount = Math.max(filteredInvoices.length, 1);

    return Object.keys(STATUS_META)
      .map((status) => {
        const rows = filteredInvoices.filter(
          (invoice) => String(invoice.status || "DRAFT").toUpperCase() === status
        );

        const subtotal = rows.reduce((sum, item) => sum + toNumber(item.subtotal), 0);
        const tax = rows.reduce((sum, item) => sum + toNumber(item.tax_amount), 0);
        const total = rows.reduce((sum, item) => sum + toNumber(item.total_amount), 0);

        return {
          status,
          label: getStatusLabel(status, locale),
          count: rows.length,
          subtotal,
          tax,
          total,
          percentage: Math.round((rows.length / totalCount) * 100),
        };
      })
      .filter((row) => row.count > 0);
  }, [filteredInvoices, locale]);

  const customerRows = useMemo<CustomerReportRow[]>(() => {
    const map = new Map<string, CustomerReportRow>();

    filteredInvoices.forEach((invoice) => {
      const customerKey = invoice.customer_id ? `#${invoice.customer_id}` : isAr ? "غير محدد" : "N/A";
      const existing =
        map.get(customerKey) ||
        ({
          customerKey,
          count: 0,
          tax: 0,
          total: 0,
        } satisfies CustomerReportRow);

      existing.count += 1;
      existing.tax += toNumber(invoice.tax_amount);
      existing.total += toNumber(invoice.total_amount);

      map.set(customerKey, existing);
    });

    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [filteredInvoices, isAr]);

  const monthlyRows = useMemo<MonthlyReportRow[]>(() => {
    const map = new Map<string, MonthlyReportRow>();

    filteredInvoices.forEach((invoice) => {
      const monthKey = getMonthKey(invoice.invoice_date);
      const existing =
        map.get(monthKey) ||
        ({
          monthKey,
          count: 0,
          tax: 0,
          total: 0,
        } satisfies MonthlyReportRow);

      existing.count += 1;
      existing.tax += toNumber(invoice.tax_amount);
      existing.total += toNumber(invoice.total_amount);

      map.set(monthKey, existing);
    });

    return Array.from(map.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [filteredInvoices]);

  const clearFilters = () => {
    setStatusFilter("ALL");
    setDateFrom("");
    setDateTo("");
  };

  const buildStatusRowsHtml = () => {
    return statusRows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.label)}</td>
            <td>${escapeHtml(formatNumber(row.count))}</td>
            <td>${escapeHtml(formatMoney(row.subtotal))}</td>
            <td>${escapeHtml(formatMoney(row.tax))}</td>
            <td>${escapeHtml(formatMoney(row.total))}</td>
            <td>${escapeHtml(formatNumber(row.percentage))}%</td>
          </tr>
        `
      )
      .join("");
  };

  const buildCustomerRowsHtml = () => {
    return customerRows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.customerKey)}</td>
            <td>${escapeHtml(formatNumber(row.count))}</td>
            <td>${escapeHtml(formatMoney(row.tax))}</td>
            <td>${escapeHtml(formatMoney(row.total))}</td>
          </tr>
        `
      )
      .join("");
  };

  const buildMonthlyRowsHtml = () => {
    return monthlyRows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.monthKey)}</td>
            <td>${escapeHtml(formatNumber(row.count))}</td>
            <td>${escapeHtml(formatMoney(row.tax))}</td>
            <td>${escapeHtml(formatMoney(row.total))}</td>
          </tr>
        `
      )
      .join("");
  };

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
            body {
              font-family: Arial, sans-serif;
              direction: ${isAr ? "rtl" : "ltr"};
            }
            h1, h2 {
              margin: 0 0 10px;
            }
            .meta {
              color: #475569;
              margin-bottom: 20px;
            }
            .summary {
              margin-bottom: 24px;
            }
            table {
              border-collapse: collapse;
              width: 100%;
              margin-bottom: 28px;
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
          </style>
        </head>
        <body>
          <h1>${escapeHtml(t.printTitle)}</h1>
          <div class="meta">${escapeHtml(generatedAt)}</div>

          <h2>${escapeHtml(isAr ? "الملخص المالي" : "Financial Summary")}</h2>
          <table class="summary">
            <tbody>
              <tr><th>${escapeHtml(t.totalInvoices)}</th><td>${escapeHtml(formatNumber(stats.totalInvoices))}</td></tr>
              <tr><th>${escapeHtml(t.subtotal)}</th><td>${escapeHtml(formatMoney(stats.subtotal))}</td></tr>
              <tr><th>${escapeHtml(t.taxAmount)}</th><td>${escapeHtml(formatMoney(stats.taxAmount))}</td></tr>
              <tr><th>${escapeHtml(t.totalAmount)}</th><td>${escapeHtml(formatMoney(stats.totalAmount))}</td></tr>
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
                <th>${escapeHtml(t.percentage)}</th>
              </tr>
            </thead>
            <tbody>
              ${buildStatusRowsHtml()}
            </tbody>
          </table>

          <h2>${escapeHtml(t.customerReport)}</h2>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t.customer)}</th>
                <th>${escapeHtml(t.count)}</th>
                <th>${escapeHtml(t.tax)}</th>
                <th>${escapeHtml(t.total)}</th>
              </tr>
            </thead>
            <tbody>
              ${buildCustomerRowsHtml()}
            </tbody>
          </table>

          <h2>${escapeHtml(t.monthlyReport)}</h2>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t.month)}</th>
                <th>${escapeHtml(t.count)}</th>
                <th>${escapeHtml(t.tax)}</th>
                <th>${escapeHtml(t.total)}</th>
              </tr>
            </thead>
            <tbody>
              ${buildMonthlyRowsHtml()}
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
            * {
              box-sizing: border-box;
            }
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
            .title {
              font-size: 26px;
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
            h2 {
              font-size: 18px;
              margin: 28px 0 12px;
            }
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
              <div class="card-value">${escapeHtml(formatNumber(stats.totalInvoices))}</div>
            </div>
            <div class="card">
              <div class="card-label">${escapeHtml(t.totalAmount)}</div>
              <div class="card-value">${escapeHtml(formatMoney(stats.totalAmount))}</div>
            </div>
            <div class="card">
              <div class="card-label">${escapeHtml(t.taxAmount)}</div>
              <div class="card-value">${escapeHtml(formatMoney(stats.taxAmount))}</div>
            </div>
            <div class="card">
              <div class="card-label">${escapeHtml(t.averageInvoice)}</div>
              <div class="card-value">${escapeHtml(formatMoney(stats.averageInvoice))}</div>
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
                <th>${escapeHtml(t.percentage)}</th>
              </tr>
            </thead>
            <tbody>
              ${buildStatusRowsHtml()}
            </tbody>
          </table>

          <h2>${escapeHtml(t.customerReport)}</h2>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t.customer)}</th>
                <th>${escapeHtml(t.count)}</th>
                <th>${escapeHtml(t.tax)}</th>
                <th>${escapeHtml(t.total)}</th>
              </tr>
            </thead>
            <tbody>
              ${buildCustomerRowsHtml()}
            </tbody>
          </table>

          <h2>${escapeHtml(t.monthlyReport)}</h2>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t.month)}</th>
                <th>${escapeHtml(t.count)}</th>
                <th>${escapeHtml(t.tax)}</th>
                <th>${escapeHtml(t.total)}</th>
              </tr>
            </thead>
            <tbody>
              ${buildMonthlyRowsHtml()}
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
      title: t.taxAmount,
      value: formatMoney(stats.taxAmount),
      description: isAr ? "إجمالي ضريبة القيمة المضافة" : "Total VAT amount",
      icon: ShieldCheck,
      money: true,
    },
    {
      title: t.averageInvoice,
      value: formatMoney(stats.averageInvoice),
      description: isAr ? "متوسط قيمة الفاتورة" : "Average invoice value",
      icon: TrendingUp,
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
                <CardDescription>{t.filtersDesc}</CardDescription>
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
            {/* =====================================================
                STATS
            ===================================================== */}
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {statCards.map((card) => (
                <ReportStatCard key={card.title} {...card} />
              ))}
            </section>

            {/* =====================================================
                STATUS SUMMARY
            ===================================================== */}
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
                      <table className="w-full min-w-[760px] text-sm">
                        <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 text-start font-medium">{t.status}</th>
                            <th className="px-4 py-3 text-start font-medium">{t.count}</th>
                            <th className="px-4 py-3 text-start font-medium">{t.subtotal}</th>
                            <th className="px-4 py-3 text-start font-medium">{t.tax}</th>
                            <th className="px-4 py-3 text-start font-medium">{t.total}</th>
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

                  <div className="rounded-3xl border bg-muted/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{t.paidInvoices}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {isAr ? "فواتير مكتملة السداد" : "Fully paid invoices"}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                      >
                        {formatNumber(stats.paidInvoices)}
                      </Badge>
                    </div>
                  </div>

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

            {/* =====================================================
                CUSTOMER + MONTHLY
            ===================================================== */}
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
                    headers={[t.customer, t.count, t.tax, t.total]}
                    rows={customerRows.map((row) => [
                      row.customerKey,
                      formatNumber(row.count),
                      formatMoney(row.tax),
                      formatMoney(row.total),
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
                    headers={[t.month, t.count, t.tax, t.total]}
                    rows={monthlyRows.map((row) => [
                      row.monthKey,
                      formatNumber(row.count),
                      formatMoney(row.tax),
                      formatMoney(row.total),
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
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-hidden rounded-3xl border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
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
                  لا توجد بيانات
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
                      {cellIndex >= 2 ? (
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