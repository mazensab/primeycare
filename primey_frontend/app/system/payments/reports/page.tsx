"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CreditCard,
  Download,
  FileText,
  Loader2,
  PieChart,
  Printer,
  ReceiptText,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
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

type ReportGroupRow = {
  status?: string | null;
  payment_method?: string | null;
  provider?: string | null;
  count?: number | null;
  amount?: string | number | null;
  paid_amount?: string | number | null;
  refunded_amount?: string | number | null;
};

type LatestPayment = {
  id: number;
  payment_number?: string | null;
  status?: string | null;
  payment_method?: string | null;
  provider?: string | null;
  amount?: string | number | null;
  paid_amount?: string | number | null;
  refunded_amount?: string | number | null;
  currency?: string | null;
  invoice_id?: number | null;
  order_id?: number | null;
  customer_id?: number | null;
  customer_name?: string | null;
  created_at?: string | null;
  paid_at?: string | null;
};

type PaymentsReportSummary = {
  total_count?: number | null;
  total_amount?: string | number | null;
  total_paid_amount?: string | number | null;
  total_refunded_amount?: string | number | null;
  posted_treasury_count?: number | null;
  posted_accounting_count?: number | null;
  pending_treasury_count?: number | null;
  pending_accounting_count?: number | null;
};

type PaymentsReportsResponse = {
  ok?: boolean;
  message?: string;
  summary?: PaymentsReportSummary;
  by_status?: ReportGroupRow[];
  by_method?: ReportGroupRow[];
  by_provider?: ReportGroupRow[];
  latest?: LatestPayment[];
};

type StatusMeta = {
  labelAr: string;
  labelEn: string;
  className: string;
};

type MethodMeta = {
  labelAr: string;
  labelEn: string;
};

type ProviderMeta = {
  labelAr: string;
  labelEn: string;
};

/* =====================================================
   CONSTANTS
===================================================== */

const SAR_ICON_PATH = "/currency/sar.svg";

const STATUS_META: Record<string, StatusMeta> = {
  PENDING: {
    labelAr: "قيد الانتظار",
    labelEn: "Pending",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
  },
  PROCESSING: {
    labelAr: "قيد المعالجة",
    labelEn: "Processing",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
  },
  PAID: {
    labelAr: "مدفوع",
    labelEn: "Paid",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  PARTIALLY_PAID: {
    labelAr: "مدفوع جزئيًا",
    labelEn: "Partially Paid",
    className:
      "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/40 dark:text-cyan-300",
  },
  FAILED: {
    labelAr: "فشل",
    labelEn: "Failed",
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
  },
  CANCELLED: {
    labelAr: "ملغي",
    labelEn: "Cancelled",
    className:
      "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300",
  },
  REFUNDED: {
    labelAr: "مسترد",
    labelEn: "Refunded",
    className:
      "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-300",
  },
  PARTIALLY_REFUNDED: {
    labelAr: "مسترد جزئيًا",
    labelEn: "Partially Refunded",
    className:
      "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-900/60 dark:bg-fuchsia-950/40 dark:text-fuchsia-300",
  },
};

const METHOD_META: Record<string, MethodMeta> = {
  CASH: { labelAr: "نقدي", labelEn: "Cash" },
  BANK_TRANSFER: { labelAr: "تحويل بنكي", labelEn: "Bank Transfer" },
  CREDIT_CARD: { labelAr: "بطاقة ائتمانية", labelEn: "Credit Card" },
  DEBIT_CARD: { labelAr: "مدى / خصم", labelEn: "Debit Card" },
  WALLET: { labelAr: "محفظة", labelEn: "Wallet" },
  APPLE_PAY: { labelAr: "Apple Pay", labelEn: "Apple Pay" },
  STC_PAY: { labelAr: "STC Pay", labelEn: "STC Pay" },
  TAMARA: { labelAr: "تمارا", labelEn: "Tamara" },
  TABBY: { labelAr: "تابي", labelEn: "Tabby" },
  GATEWAY: { labelAr: "بوابة دفع", labelEn: "Gateway" },
  OTHER: { labelAr: "أخرى", labelEn: "Other" },
};

const PROVIDER_META: Record<string, ProviderMeta> = {
  INTERNAL: { labelAr: "داخلي", labelEn: "Internal" },
  TAP: { labelAr: "Tap", labelEn: "Tap" },
  TAMARA: { labelAr: "Tamara", labelEn: "Tamara" },
  TABBY: { labelAr: "Tabby", labelEn: "Tabby" },
  MANUAL: { labelAr: "يدوي", labelEn: "Manual" },
  BANK: { labelAr: "بنك", labelEn: "Bank" },
  OTHER: { labelAr: "أخرى", labelEn: "Other" },
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

function formatMoney(value: string | number | null | undefined): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
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
  const key = String(status || "PENDING").toUpperCase();
  const meta = STATUS_META[key];

  if (!meta) return status || (locale === "ar" ? "غير محدد" : "Unknown");

  return locale === "ar" ? meta.labelAr : meta.labelEn;
}

function getStatusClassName(status: string | null | undefined): string {
  const key = String(status || "PENDING").toUpperCase();
  return STATUS_META[key]?.className || STATUS_META.PENDING.className;
}

function getMethodLabel(method: string | null | undefined, locale: AppLocale): string {
  const key = String(method || "OTHER").toUpperCase();
  const meta = METHOD_META[key];

  if (!meta) return method || (locale === "ar" ? "غير محدد" : "Unknown");

  return locale === "ar" ? meta.labelAr : meta.labelEn;
}

function getProviderLabel(provider: string | null | undefined, locale: AppLocale): string {
  const key = String(provider || "INTERNAL").toUpperCase();
  const meta = PROVIDER_META[key];

  if (!meta) return provider || (locale === "ar" ? "غير محدد" : "Unknown");

  return locale === "ar" ? meta.labelAr : meta.labelEn;
}

function getLatestPaymentReference(payment: LatestPayment): string {
  return payment.payment_number || `PAY-${payment.id}`;
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
   API
===================================================== */

async function fetchPaymentReports(params: {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  search?: string;
}): Promise<PaymentsReportsResponse> {
  const searchParams = new URLSearchParams();

  if (params.dateFrom) searchParams.set("date_from", params.dateFrom);
  if (params.dateTo) searchParams.set("date_to", params.dateTo);
  if (params.status && params.status !== "ALL") searchParams.set("status", params.status);

  const url = `/api/payments/reports/${
    searchParams.toString() ? `?${searchParams.toString()}` : ""
  }`;

  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as PaymentsReportsResponse | null;

  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || "Failed to load payment reports.");
  }

  return data;
}

/* =====================================================
   PAGE
===================================================== */

export default function SystemPaymentsReportsPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [data, setData] = useState<PaymentsReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const isAr = locale === "ar";

  const t = useMemo(
    () => ({
      badge: isAr ? "تقارير المدفوعات" : "Payments Reports",
      title: isAr ? "تقارير المدفوعات" : "Payments Reports",
      subtitle: isAr
        ? "تحليل المدفوعات حسب الحالة، طريقة الدفع، المزود، وحالة الربط مع الخزينة والمحاسبة."
        : "Analyze payments by status, method, provider, and posting status to treasury and accounting.",
      dashboard: isAr ? "لوحة المدفوعات" : "Payments Dashboard",
      list: isAr ? "قائمة المدفوعات" : "Payments List",
      create: isAr ? "تسجيل دفعة" : "Create Payment",
      refresh: isAr ? "تحديث" : "Refresh",
      exportExcel: isAr ? "تصدير Excel" : "Export Excel",
      print: isAr ? "طباعة Web PDF" : "Print Web PDF",
      filters: isAr ? "فلاتر التقرير" : "Report Filters",
      searchPlaceholder: isAr
        ? "ابحث في آخر المدفوعات برقم الدفعة أو العميل أو الفاتورة..."
        : "Search latest payments by reference, customer, or invoice...",
      status: isAr ? "الحالة" : "Status",
      allStatuses: isAr ? "كل الحالات" : "All Statuses",
      from: isAr ? "من تاريخ" : "From",
      to: isAr ? "إلى تاريخ" : "To",
      clear: isAr ? "مسح الفلاتر" : "Clear Filters",
      totalPayments: isAr ? "إجمالي المدفوعات" : "Total Payments",
      totalAmount: isAr ? "إجمالي العمليات" : "Total Amount",
      paidAmount: isAr ? "إجمالي المدفوع" : "Paid Amount",
      refundedAmount: isAr ? "إجمالي المسترد" : "Refunded Amount",
      treasuryPosted: isAr ? "مرحلة للخزينة" : "Treasury Posted",
      accountingPosted: isAr ? "مرحلة محاسبيًا" : "Accounting Posted",
      treasuryPending: isAr ? "غير مرحلة للخزينة" : "Treasury Pending",
      accountingPending: isAr ? "غير مرحلة محاسبيًا" : "Accounting Pending",
      byStatus: isAr ? "حسب الحالة" : "By Status",
      byStatusDesc: isAr
        ? "توزيع المدفوعات حسب الحالة التشغيلية."
        : "Payments distribution by operational status.",
      byMethod: isAr ? "حسب طريقة الدفع" : "By Payment Method",
      byMethodDesc: isAr
        ? "تحليل المدفوعات حسب طريقة التحصيل."
        : "Payments analysis by collection method.",
      byProvider: isAr ? "حسب مزود الدفع" : "By Provider",
      byProviderDesc: isAr
        ? "تحليل المدفوعات حسب مزود الدفع."
        : "Payments analysis by payment provider.",
      latest: isAr ? "آخر المدفوعات" : "Latest Payments",
      latestDesc: isAr
        ? "آخر العمليات الظاهرة في التقرير."
        : "Latest transactions included in this report.",
      payment: isAr ? "الدفعة" : "Payment",
      customer: isAr ? "العميل" : "Customer",
      invoice: isAr ? "الفاتورة" : "Invoice",
      method: isAr ? "الطريقة" : "Method",
      provider: isAr ? "المزود" : "Provider",
      amount: isAr ? "المبلغ" : "Amount",
      date: isAr ? "التاريخ" : "Date",
      count: isAr ? "العدد" : "Count",
      paid: isAr ? "مدفوع" : "Paid",
      refunded: isAr ? "مسترد" : "Refunded",
      empty: isAr ? "لا توجد بيانات مطابقة حاليًا." : "No matching data found.",
      loading: isAr ? "جاري تحميل تقرير المدفوعات..." : "Loading payments report...",
      loadError: isAr ? "تعذر تحميل تقرير المدفوعات" : "Failed to load payments report",
      refreshSuccess: isAr ? "تم تحديث التقرير بنجاح" : "Report refreshed successfully",
      exportSuccess: isAr ? "تم تصدير التقرير بنجاح" : "Report exported successfully",
      printTitle: isAr ? "تقرير المدفوعات" : "Payments Report",
      generatedAt: isAr ? "تاريخ الإنشاء" : "Generated At",
      notAvailable: isAr ? "غير متاح" : "N/A",
      sar: isAr ? "ريال" : "SAR",
    }),
    [isAr]
  );

  const summary = data?.summary || {};

  const latestPayments = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const rows = data?.latest || [];

    if (!keyword) return rows;

    return rows.filter((payment) => {
      const haystack = [
        payment.id,
        payment.payment_number,
        payment.status,
        getStatusLabel(payment.status, "ar"),
        getStatusLabel(payment.status, "en"),
        payment.payment_method,
        getMethodLabel(payment.payment_method, "ar"),
        getMethodLabel(payment.payment_method, "en"),
        payment.provider,
        payment.customer_id,
        payment.customer_name,
        payment.invoice_id,
        payment.order_id,
        payment.amount,
        payment.paid_amount,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [data?.latest, search]);

  const paidRate = useMemo(() => {
    const total = Number(summary.total_count || 0);
    const statusRows = data?.by_status || [];
    const paidRow = statusRows.find((row) => String(row.status || "").toUpperCase() === "PAID");
    const paidCount = Number(paidRow?.count || 0);

    if (!total) return 0;
    return Math.round((paidCount / total) * 100);
  }, [data?.by_status, summary.total_count]);

  const treasuryRate = useMemo(() => {
    const total = Number(summary.total_count || 0);
    const posted = Number(summary.posted_treasury_count || 0);

    if (!total) return 0;
    return Math.round((posted / total) * 100);
  }, [summary.posted_treasury_count, summary.total_count]);

  const accountingRate = useMemo(() => {
    const total = Number(summary.total_count || 0);
    const posted = Number(summary.posted_accounting_count || 0);

    if (!total) return 0;
    return Math.round((posted / total) * 100);
  }, [summary.posted_accounting_count, summary.total_count]);

  const loadReports = async (mode: "initial" | "refresh" = "initial") => {
    try {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);

      const report = await fetchPaymentReports({
        dateFrom,
        dateTo,
        status: statusFilter,
      });

      setData(report);

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
    const timeout = window.setTimeout(() => {
      loadReports("refresh");
    }, 350);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, statusFilter]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setDateFrom("");
    setDateTo("");
  };

  const buildExportRows = () => {
    const statusRows = data?.by_status || [];
    const methodRows = data?.by_method || [];
    const providerRows = data?.by_provider || [];
    const latestRows = latestPayments || [];

    const statusHtml = statusRows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(getStatusLabel(row.status, locale))}</td>
            <td>${escapeHtml(formatNumber(Number(row.count || 0)))}</td>
            <td>${escapeHtml(formatMoney(row.amount))}</td>
            <td>${escapeHtml(formatMoney(row.paid_amount))}</td>
            <td>${escapeHtml(formatMoney(row.refunded_amount))}</td>
          </tr>
        `
      )
      .join("");

    const methodHtml = methodRows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(getMethodLabel(row.payment_method, locale))}</td>
            <td>${escapeHtml(formatNumber(Number(row.count || 0)))}</td>
            <td>${escapeHtml(formatMoney(row.amount))}</td>
            <td>${escapeHtml(formatMoney(row.paid_amount))}</td>
            <td>${escapeHtml(formatMoney(row.refunded_amount))}</td>
          </tr>
        `
      )
      .join("");

    const providerHtml = providerRows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(getProviderLabel(row.provider, locale))}</td>
            <td>${escapeHtml(formatNumber(Number(row.count || 0)))}</td>
            <td>${escapeHtml(formatMoney(row.amount))}</td>
            <td>${escapeHtml(formatMoney(row.paid_amount))}</td>
            <td>${escapeHtml(formatMoney(row.refunded_amount))}</td>
          </tr>
        `
      )
      .join("");

    const latestHtml = latestRows
      .map(
        (payment) => `
          <tr>
            <td>${escapeHtml(getLatestPaymentReference(payment))}</td>
            <td>${escapeHtml(payment.customer_name || (payment.customer_id ? `#${payment.customer_id}` : t.notAvailable))}</td>
            <td>${escapeHtml(payment.invoice_id ? `#${payment.invoice_id}` : t.notAvailable)}</td>
            <td>${escapeHtml(getStatusLabel(payment.status, locale))}</td>
            <td>${escapeHtml(getMethodLabel(payment.payment_method, locale))}</td>
            <td>${escapeHtml(getProviderLabel(payment.provider, locale))}</td>
            <td>${escapeHtml(formatMoney(payment.paid_amount || payment.amount))}</td>
            <td>${escapeHtml(formatDate(payment.paid_at || payment.created_at, locale))}</td>
          </tr>
        `
      )
      .join("");

    return {
      statusHtml,
      methodHtml,
      providerHtml,
      latestHtml,
    };
  };

  const createReportHtml = (forPrint = false) => {
    const generatedAt = new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());

    const rows = buildExportRows();

    return `
      <!doctype html>
      <html lang="${locale}" dir="${isAr ? "rtl" : "ltr"}">
        <head>
          <meta charset="utf-8" />
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
            h2 {
              font-size: 18px;
              margin: 28px 0 12px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
              margin-bottom: 20px;
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
            .no-print {
              margin-bottom: 20px;
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
          ${
            forPrint
              ? `<button class="no-print" onclick="window.print()">${escapeHtml(t.print)}</button>`
              : ""
          }

          <div class="header">
            <div>
              <h1 class="title">${escapeHtml(t.printTitle)}</h1>
              <p class="subtitle">${escapeHtml(t.generatedAt)}: ${escapeHtml(generatedAt)}</p>
            </div>
            <div>
              <p class="subtitle">${escapeHtml(t.status)}: ${
                statusFilter === "ALL"
                  ? escapeHtml(t.allStatuses)
                  : escapeHtml(getStatusLabel(statusFilter, locale))
              }</p>
            </div>
          </div>

          <div class="summary">
            <div class="card">
              <div class="card-label">${escapeHtml(t.totalPayments)}</div>
              <div class="card-value">${escapeHtml(formatNumber(Number(summary.total_count || 0)))}</div>
            </div>
            <div class="card">
              <div class="card-label">${escapeHtml(t.totalAmount)}</div>
              <div class="card-value">${escapeHtml(formatMoney(summary.total_amount))}</div>
            </div>
            <div class="card">
              <div class="card-label">${escapeHtml(t.paidAmount)}</div>
              <div class="card-value">${escapeHtml(formatMoney(summary.total_paid_amount))}</div>
            </div>
            <div class="card">
              <div class="card-label">${escapeHtml(t.refundedAmount)}</div>
              <div class="card-value">${escapeHtml(formatMoney(summary.total_refunded_amount))}</div>
            </div>
          </div>

          <h2>${escapeHtml(t.byStatus)}</h2>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t.status)}</th>
                <th>${escapeHtml(t.count)}</th>
                <th>${escapeHtml(t.amount)}</th>
                <th>${escapeHtml(t.paid)}</th>
                <th>${escapeHtml(t.refunded)}</th>
              </tr>
            </thead>
            <tbody>${rows.statusHtml}</tbody>
          </table>

          <h2>${escapeHtml(t.byMethod)}</h2>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t.method)}</th>
                <th>${escapeHtml(t.count)}</th>
                <th>${escapeHtml(t.amount)}</th>
                <th>${escapeHtml(t.paid)}</th>
                <th>${escapeHtml(t.refunded)}</th>
              </tr>
            </thead>
            <tbody>${rows.methodHtml}</tbody>
          </table>

          <h2>${escapeHtml(t.byProvider)}</h2>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t.provider)}</th>
                <th>${escapeHtml(t.count)}</th>
                <th>${escapeHtml(t.amount)}</th>
                <th>${escapeHtml(t.paid)}</th>
                <th>${escapeHtml(t.refunded)}</th>
              </tr>
            </thead>
            <tbody>${rows.providerHtml}</tbody>
          </table>

          <h2>${escapeHtml(t.latest)}</h2>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t.payment)}</th>
                <th>${escapeHtml(t.customer)}</th>
                <th>${escapeHtml(t.invoice)}</th>
                <th>${escapeHtml(t.status)}</th>
                <th>${escapeHtml(t.method)}</th>
                <th>${escapeHtml(t.provider)}</th>
                <th>${escapeHtml(t.amount)}</th>
                <th>${escapeHtml(t.date)}</th>
              </tr>
            </thead>
            <tbody>${rows.latestHtml}</tbody>
          </table>
        </body>
      </html>
    `;
  };

  const exportExcel = () => {
    if (!data) {
      toast.error(isAr ? "لا توجد بيانات للتصدير" : "No data to export");
      return;
    }

    const html = createReportHtml(false);

    const blob = new Blob(["\ufeff", html], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStamp = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `primey-care-payments-report-${dateStamp}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(t.exportSuccess);
  };

  const printReport = () => {
    if (!data) {
      toast.error(isAr ? "لا توجد بيانات للطباعة" : "No data to print");
      return;
    }

    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) {
      toast.error(isAr ? "تعذر فتح نافذة الطباعة" : "Unable to open print window");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(createReportHtml(true));
    printWindow.document.close();
    printWindow.focus();
  };

  const statCards = [
    {
      title: t.totalPayments,
      value: formatNumber(Number(summary.total_count || 0)),
      icon: ReceiptText,
      description: isAr ? "عدد عمليات الدفع" : "Payment transactions count",
    },
    {
      title: t.paidAmount,
      value: formatMoney(summary.total_paid_amount),
      icon: Wallet,
      description: t.sar,
      money: true,
    },
    {
      title: t.treasuryPosted,
      value: formatNumber(Number(summary.posted_treasury_count || 0)),
      icon: ShieldCheck,
      description: `${formatNumber(treasuryRate)}%`,
    },
    {
      title: t.accountingPosted,
      value: formatNumber(Number(summary.posted_accounting_count || 0)),
      icon: BarChart3,
      description: `${formatNumber(accountingRate)}%`,
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
                <Sparkles className="me-2 h-3.5 w-3.5" />
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
                <Link href="/system/payments">
                  {isAr ? (
                    <ArrowLeft className="me-2 h-4 w-4" />
                  ) : (
                    <ArrowLeft className="me-2 h-4 w-4 rotate-180" />
                  )}
                  {t.dashboard}
                </Link>
              </Button>

              <Button asChild variant="secondary" className="rounded-2xl">
                <Link href="/system/payments/list">
                  <FileText className="me-2 h-4 w-4" />
                  {t.list}
                </Link>
              </Button>

              <Button asChild className="rounded-2xl">
                <Link href="/system/payments/create">
                  <CreditCard className="me-2 h-4 w-4" />
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
                  <Search className="h-5 w-5 text-primary" />
                  {t.filters}
                </CardTitle>
                <CardDescription>
                  {isAr
                    ? "غيّر الفلاتر وسيتم تحديث التقرير تلقائيًا."
                    : "Change filters and the report updates automatically."}
                </CardDescription>
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
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 rounded-2xl border border-input bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                aria-label={t.status}
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

              <Button type="button" variant="ghost" className="rounded-2xl" onClick={clearFilters}>
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
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {statCards.map((card) => (
                <StatCard key={card.title} {...card} />
              ))}
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="rounded-[1.5rem]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-primary" />
                    {t.byStatus}
                  </CardTitle>
                  <CardDescription>{t.byStatusDesc}</CardDescription>
                </CardHeader>

                <CardContent>
                  <ReportGroup
                    rows={data?.by_status || []}
                    type="status"
                    locale={locale}
                    empty={t.empty}
                    totalCount={Number(summary.total_count || 0)}
                  />
                </CardContent>
              </Card>

              <Card className="rounded-[1.5rem]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    {isAr ? "مؤشرات الترحيل" : "Posting Indicators"}
                  </CardTitle>
                  <CardDescription>
                    {isAr
                      ? "نسبة ربط المدفوعات مع الخزينة والمحاسبة."
                      : "Payment linkage ratio with treasury and accounting."}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <ProgressCard
                    title={t.paidAmount}
                    value={paidRate}
                    description={isAr ? "نسبة المدفوعات المؤكدة" : "Confirmed payments ratio"}
                  />
                  <ProgressCard
                    title={t.treasuryPosted}
                    value={treasuryRate}
                    description={isAr ? "مرحل إلى الخزينة" : "Posted to treasury"}
                  />
                  <ProgressCard
                    title={t.accountingPosted}
                    value={accountingRate}
                    description={isAr ? "مرحل محاسبيًا" : "Posted to accounting"}
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <MiniMetric
                      title={t.treasuryPending}
                      value={formatNumber(Number(summary.pending_treasury_count || 0))}
                      icon={Wallet}
                    />
                    <MiniMetric
                      title={t.accountingPending}
                      value={formatNumber(Number(summary.pending_accounting_count || 0))}
                      icon={BarChart3}
                    />
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <Card className="rounded-[1.5rem]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    {t.byMethod}
                  </CardTitle>
                  <CardDescription>{t.byMethodDesc}</CardDescription>
                </CardHeader>

                <CardContent>
                  <ReportGroup
                    rows={data?.by_method || []}
                    type="method"
                    locale={locale}
                    empty={t.empty}
                    totalCount={Number(summary.total_count || 0)}
                  />
                </CardContent>
              </Card>

              <Card className="rounded-[1.5rem]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    {t.byProvider}
                  </CardTitle>
                  <CardDescription>{t.byProviderDesc}</CardDescription>
                </CardHeader>

                <CardContent>
                  <ReportGroup
                    rows={data?.by_provider || []}
                    type="provider"
                    locale={locale}
                    empty={t.empty}
                    totalCount={Number(summary.total_count || 0)}
                  />
                </CardContent>
              </Card>
            </section>

            <Card className="rounded-[1.5rem]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ReceiptText className="h-5 w-5 text-primary" />
                  {t.latest}
                </CardTitle>
                <CardDescription>{t.latestDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                {latestPayments.length === 0 ? (
                  <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed bg-muted/20 text-center">
                    <CreditCard className="h-10 w-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{t.empty}</p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-3xl border">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] text-sm">
                        <thead className="bg-muted/50 text-xs text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 text-start font-medium">{t.payment}</th>
                            <th className="px-4 py-3 text-start font-medium">{t.customer}</th>
                            <th className="px-4 py-3 text-start font-medium">{t.invoice}</th>
                            <th className="px-4 py-3 text-start font-medium">{t.status}</th>
                            <th className="px-4 py-3 text-start font-medium">{t.method}</th>
                            <th className="px-4 py-3 text-start font-medium">{t.provider}</th>
                            <th className="px-4 py-3 text-start font-medium">{t.date}</th>
                            <th className="px-4 py-3 text-start font-medium">{t.amount}</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y">
                          {latestPayments.map((payment) => (
                            <tr key={payment.id} className="bg-card transition hover:bg-muted/30">
                              <td className="px-4 py-3">
                                <Link
                                  href={`/system/payments/${payment.id}`}
                                  className="font-semibold text-primary hover:underline"
                                >
                                  {getLatestPaymentReference(payment)}
                                </Link>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  ID: {payment.id}
                                </p>
                              </td>

                              <td className="px-4 py-3">
                                {payment.customer_name ||
                                  (payment.customer_id ? `#${payment.customer_id}` : t.notAvailable)}
                              </td>

                              <td className="px-4 py-3">
                                {payment.invoice_id ? `#${payment.invoice_id}` : t.notAvailable}
                              </td>

                              <td className="px-4 py-3">
                                <Badge
                                  variant="outline"
                                  className={`rounded-full ${getStatusClassName(payment.status)}`}
                                >
                                  {getStatusLabel(payment.status, locale)}
                                </Badge>
                              </td>

                              <td className="px-4 py-3">
                                <Badge variant="secondary" className="rounded-full">
                                  {getMethodLabel(payment.payment_method, locale)}
                                </Badge>
                              </td>

                              <td className="px-4 py-3">
                                {getProviderLabel(payment.provider, locale)}
                              </td>

                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <CalendarDays className="h-4 w-4" />
                                  {formatDate(payment.paid_at || payment.created_at, locale)}
                                </div>
                              </td>

                              <td className="px-4 py-3">
                                <MoneyValue value={payment.paid_amount || payment.amount} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}

/* =====================================================
   SMALL COMPONENTS
===================================================== */

function StatCard({
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

function MoneyValue({ value }: { value: string | number | null | undefined }) {
  return (
    <div className="flex items-center gap-1.5 font-semibold">
      <Image src={SAR_ICON_PATH} alt="SAR" width={14} height={14} />
      {formatMoney(value)}
    </div>
  );
}

function ReportGroup({
  rows,
  type,
  locale,
  empty,
  totalCount,
}: {
  rows: ReportGroupRow[];
  type: "status" | "method" | "provider";
  locale: AppLocale;
  empty: string;
  totalCount: number;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed bg-muted/20 text-center">
        <BarChart3 className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{empty}</p>
      </div>
    );
  }

  const getLabel = (row: ReportGroupRow) => {
    if (type === "status") return getStatusLabel(row.status, locale);
    if (type === "method") return getMethodLabel(row.payment_method, locale);
    return getProviderLabel(row.provider, locale);
  };

  const getBadgeClassName = (row: ReportGroupRow) => {
    if (type === "status") return getStatusClassName(row.status);
    return "border-primary/20 bg-primary/5 text-primary";
  };

  return (
    <div className="space-y-3">
      {rows.map((row, index) => {
        const count = Number(row.count || 0);
        const percentage = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;

        return (
          <div key={`${type}-${index}`} className="rounded-3xl border bg-card p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <Badge variant="outline" className={`rounded-full ${getBadgeClassName(row)}`}>
                  {getLabel(row)}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(count)} {locale === "ar" ? "عملية" : "transactions"} •{" "}
                  {formatNumber(percentage)}%
                </p>
              </div>

              <div className="grid gap-1 text-sm sm:text-end">
                <MoneyValue value={row.paid_amount || row.amount} />
                <p className="text-xs text-muted-foreground">
                  {locale === "ar" ? "مسترد" : "Refunded"}: {formatMoney(row.refunded_amount)}
                </p>
              </div>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.max(0, Math.min(percentage, 100))}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProgressCard({
  title,
  value,
  description,
}: {
  title: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-3xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <p className="text-2xl font-bold">{formatNumber(value)}%</p>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
        />
      </div>
    </div>
  );
}

function MiniMetric({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-3xl border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}