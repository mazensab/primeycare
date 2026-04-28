"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CreditCard,
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

type PaymentStatus =
  | "ALL"
  | "PENDING"
  | "PROCESSING"
  | "PAID"
  | "PARTIALLY_PAID"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";

type PaymentMethod =
  | "ALL"
  | "CASH"
  | "BANK_TRANSFER"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "WALLET"
  | "APPLE_PAY"
  | "STC_PAY"
  | "TAMARA"
  | "TABBY"
  | "OTHER";

type ApiPayment = {
  id: number;
  reference?: string | null;
  status?: string | null;
  payment_method?: string | null;
  invoice_id?: number | null;
  customer_id?: number | null;
  amount?: string | number | null;
  payment_date?: string | null;
};

type PaymentsApiResponse = {
  ok?: boolean;
  count?: number;
  results?: ApiPayment[];
  message?: string;
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

type StatusReportRow = {
  status: string;
  label: string;
  count: number;
  total: number;
  percentage: number;
};

type MethodReportRow = {
  method: string;
  label: string;
  count: number;
  total: number;
  percentage: number;
};

type CustomerReportRow = {
  customerKey: string;
  count: number;
  total: number;
};

type MonthlyReportRow = {
  monthKey: string;
  count: number;
  total: number;
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

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
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

function getMonthKey(value: string | null | undefined): string {
  if (!value) return "No Date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No Date";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isPaidStatus(status: string | null | undefined): boolean {
  const key = String(status || "").toUpperCase();
  return key === "PAID" || key === "PARTIALLY_PAID";
}

function isPendingStatus(status: string | null | undefined): boolean {
  const key = String(status || "").toUpperCase();
  return key === "PENDING" || key === "PROCESSING";
}

function isRefundedStatus(status: string | null | undefined): boolean {
  const key = String(status || "").toUpperCase();
  return key === "REFUNDED" || key === "PARTIALLY_REFUNDED";
}

/* =====================================================
   API HELPER
===================================================== */

async function fetchPayments(): Promise<ApiPayment[]> {
  const response = await fetch("/api/payments/?limit=200", {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as PaymentsApiResponse | null;

  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || "Failed to load payment reports.");
  }

  return Array.isArray(data.results) ? data.results : [];
}

/* =====================================================
   PAGE
===================================================== */

export default function SystemPaymentsReportsPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [payments, setPayments] = useState<ApiPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [statusFilter, setStatusFilter] = useState<PaymentStatus>("ALL");
  const [methodFilter, setMethodFilter] = useState<PaymentMethod>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const isAr = locale === "ar";

  const t = useMemo(
    () => ({
      badge: isAr ? "تقارير المدفوعات" : "Payments Reports",
      title: isAr ? "تقارير المدفوعات" : "Payments Reports",
      subtitle: isAr
        ? "تحليل المدفوعات حسب الحالة، طريقة الدفع، الفترة، العملاء، وإجماليات التحصيل."
        : "Analyze payments by status, method, period, customers, and collection totals.",
      dashboard: isAr ? "لوحة المدفوعات" : "Payments Dashboard",
      list: isAr ? "قائمة المدفوعات" : "Payments List",
      create: isAr ? "تسجيل دفعة" : "Create Payment",
      refresh: isAr ? "تحديث" : "Refresh",
      filters: isAr ? "فلاتر التقرير" : "Report Filters",
      filtersDesc: isAr
        ? "اختر الحالة والطريقة والفترة لتحديث مؤشرات التقرير."
        : "Choose status, method, and date range to update report indicators.",
      status: isAr ? "الحالة" : "Status",
      method: isAr ? "طريقة الدفع" : "Method",
      allStatuses: isAr ? "كل الحالات" : "All Statuses",
      allMethods: isAr ? "كل الطرق" : "All Methods",
      from: isAr ? "من تاريخ" : "From",
      to: isAr ? "إلى تاريخ" : "To",
      clear: isAr ? "مسح الفلاتر" : "Clear Filters",
      exportExcel: isAr ? "تصدير Excel" : "Export Excel",
      print: isAr ? "طباعة Web PDF" : "Print Web PDF",
      totalPayments: isAr ? "إجمالي المدفوعات" : "Total Payments",
      collectedAmount: isAr ? "إجمالي التحصيل" : "Collected Total",
      pendingAmount: isAr ? "المبالغ المعلقة" : "Pending Amount",
      failedAmount: isAr ? "المبالغ الفاشلة" : "Failed Amount",
      refundedAmount: isAr ? "المبالغ المستردة" : "Refunded Amount",
      averagePayment: isAr ? "متوسط الدفعة" : "Average Payment",
      paidPayments: isAr ? "مدفوعات مؤكدة" : "Confirmed Payments",
      pendingPayments: isAr ? "مدفوعات معلقة" : "Pending Payments",
      failedPayments: isAr ? "مدفوعات فاشلة" : "Failed Payments",
      refundedPayments: isAr ? "مدفوعات مستردة" : "Refunded Payments",
      statusReport: isAr ? "تقرير الحالات" : "Status Report",
      statusReportDesc: isAr
        ? "توزيع المدفوعات حسب الحالة مع الإجماليات."
        : "Payment distribution by status with totals.",
      methodReport: isAr ? "تقرير طرق الدفع" : "Payment Methods Report",
      methodReportDesc: isAr
        ? "توزيع التحصيل حسب طريقة الدفع."
        : "Collection distribution by payment method.",
      customerReport: isAr ? "ملخص حسب العميل" : "Customer Summary",
      customerReportDesc: isAr
        ? "أعلى العملاء حسب قيمة المدفوعات."
        : "Top customers by payment value.",
      monthlyReport: isAr ? "ملخص شهري" : "Monthly Summary",
      monthlyReportDesc: isAr
        ? "تجميع المدفوعات حسب الشهر."
        : "Payments grouped by month.",
      count: isAr ? "العدد" : "Count",
      total: isAr ? "الإجمالي" : "Total",
      percentage: isAr ? "النسبة" : "Percentage",
      customer: isAr ? "العميل" : "Customer",
      month: isAr ? "الشهر" : "Month",
      loading: isAr ? "جاري تحميل تقارير المدفوعات..." : "Loading payment reports...",
      empty: isAr ? "لا توجد بيانات مطابقة للتقرير الحالي." : "No data matches current report.",
      loadError: isAr ? "تعذر تحميل تقارير المدفوعات" : "Failed to load payment reports",
      refreshSuccess: isAr ? "تم تحديث تقارير المدفوعات بنجاح" : "Payment reports refreshed successfully",
      exportSuccess: isAr ? "تم تصدير تقرير المدفوعات بنجاح" : "Payment report exported successfully",
      noDataExport: isAr ? "لا توجد بيانات للتصدير" : "No data to export",
      noDataPrint: isAr ? "لا توجد بيانات للطباعة" : "No data to print",
      printTitle: isAr ? "تقرير المدفوعات" : "Payments Report",
      noData: isAr ? "لا توجد بيانات" : "No data",
      sar: isAr ? "ريال" : "SAR",
    }),
    [isAr]
  );

  const loadPayments = async (mode: "initial" | "refresh" = "initial") => {
    try {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);

      const data = await fetchPayments();
      setPayments(data);

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
    loadPayments("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const status = String(payment.status || "PENDING").toUpperCase();
      const method = String(payment.payment_method || "OTHER").toUpperCase();

      if (statusFilter !== "ALL" && status !== statusFilter) return false;
      if (methodFilter !== "ALL" && method !== methodFilter) return false;

      if (dateFrom || dateTo) {
        const paymentDate = payment.payment_date ? new Date(payment.payment_date) : null;

        if (!paymentDate || Number.isNaN(paymentDate.getTime())) return false;

        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          if (paymentDate < fromDate) return false;
        }

        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (paymentDate > toDate) return false;
        }
      }

      return true;
    });
  }, [dateFrom, dateTo, methodFilter, payments, statusFilter]);

  const stats = useMemo(() => {
    const totalPayments = filteredPayments.length;

    const collectedAmount = filteredPayments.reduce((sum, payment) => {
      if (isPaidStatus(payment.status)) return sum + toNumber(payment.amount);
      return sum;
    }, 0);

    const pendingAmount = filteredPayments.reduce((sum, payment) => {
      if (isPendingStatus(payment.status)) return sum + toNumber(payment.amount);
      return sum;
    }, 0);

    const failedAmount = filteredPayments.reduce((sum, payment) => {
      if (String(payment.status || "").toUpperCase() === "FAILED") {
        return sum + toNumber(payment.amount);
      }

      return sum;
    }, 0);

    const refundedAmount = filteredPayments.reduce((sum, payment) => {
      if (isRefundedStatus(payment.status)) return sum + toNumber(payment.amount);
      return sum;
    }, 0);

    const paidPayments = filteredPayments.filter((payment) =>
      isPaidStatus(payment.status)
    ).length;

    const pendingPayments = filteredPayments.filter((payment) =>
      isPendingStatus(payment.status)
    ).length;

    const failedPayments = filteredPayments.filter(
      (payment) => String(payment.status || "").toUpperCase() === "FAILED"
    ).length;

    const refundedPayments = filteredPayments.filter((payment) =>
      isRefundedStatus(payment.status)
    ).length;

    return {
      totalPayments,
      collectedAmount,
      pendingAmount,
      failedAmount,
      refundedAmount,
      paidPayments,
      pendingPayments,
      failedPayments,
      refundedPayments,
      averagePayment: paidPayments > 0 ? collectedAmount / paidPayments : 0,
    };
  }, [filteredPayments]);

  const statusRows = useMemo<StatusReportRow[]>(() => {
    const totalCount = Math.max(filteredPayments.length, 1);

    return Object.keys(STATUS_META)
      .map((status) => {
        const rows = filteredPayments.filter(
          (payment) => String(payment.status || "PENDING").toUpperCase() === status
        );

        const total = rows.reduce((sum, payment) => sum + toNumber(payment.amount), 0);

        return {
          status,
          label: getStatusLabel(status, locale),
          count: rows.length,
          total,
          percentage: Math.round((rows.length / totalCount) * 100),
        };
      })
      .filter((row) => row.count > 0);
  }, [filteredPayments, locale]);

  const methodRows = useMemo<MethodReportRow[]>(() => {
    const totalAmount = Math.max(
      filteredPayments.reduce((sum, payment) => sum + toNumber(payment.amount), 0),
      1
    );

    return Object.keys(METHOD_META)
      .map((method) => {
        const rows = filteredPayments.filter(
          (payment) => String(payment.payment_method || "OTHER").toUpperCase() === method
        );

        const total = rows.reduce((sum, payment) => sum + toNumber(payment.amount), 0);

        return {
          method,
          label: getMethodLabel(method, locale),
          count: rows.length,
          total,
          percentage: Math.round((total / totalAmount) * 100),
        };
      })
      .filter((row) => row.count > 0)
      .sort((a, b) => b.total - a.total);
  }, [filteredPayments, locale]);

  const customerRows = useMemo<CustomerReportRow[]>(() => {
    const map = new Map<string, CustomerReportRow>();

    filteredPayments.forEach((payment) => {
      const customerKey = payment.customer_id ? `#${payment.customer_id}` : isAr ? "غير محدد" : "N/A";
      const existing =
        map.get(customerKey) ||
        ({
          customerKey,
          count: 0,
          total: 0,
        } satisfies CustomerReportRow);

      existing.count += 1;
      existing.total += toNumber(payment.amount);

      map.set(customerKey, existing);
    });

    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [filteredPayments, isAr]);

  const monthlyRows = useMemo<MonthlyReportRow[]>(() => {
    const map = new Map<string, MonthlyReportRow>();

    filteredPayments.forEach((payment) => {
      const monthKey = getMonthKey(payment.payment_date);
      const existing =
        map.get(monthKey) ||
        ({
          monthKey,
          count: 0,
          total: 0,
        } satisfies MonthlyReportRow);

      existing.count += 1;
      existing.total += toNumber(payment.amount);

      map.set(monthKey, existing);
    });

    return Array.from(map.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [filteredPayments]);

  const clearFilters = () => {
    setStatusFilter("ALL");
    setMethodFilter("ALL");
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
            <td>${escapeHtml(formatMoney(row.total))}</td>
            <td>${escapeHtml(formatNumber(row.percentage))}%</td>
          </tr>
        `
      )
      .join("");
  };

  const buildMethodRowsHtml = () => {
    return methodRows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.label)}</td>
            <td>${escapeHtml(formatNumber(row.count))}</td>
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
            <td>${escapeHtml(formatMoney(row.total))}</td>
          </tr>
        `
      )
      .join("");
  };

  const exportExcel = () => {
    if (filteredPayments.length === 0) {
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
              <tr><th>${escapeHtml(t.totalPayments)}</th><td>${escapeHtml(formatNumber(stats.totalPayments))}</td></tr>
              <tr><th>${escapeHtml(t.collectedAmount)}</th><td>${escapeHtml(formatMoney(stats.collectedAmount))}</td></tr>
              <tr><th>${escapeHtml(t.pendingAmount)}</th><td>${escapeHtml(formatMoney(stats.pendingAmount))}</td></tr>
              <tr><th>${escapeHtml(t.failedAmount)}</th><td>${escapeHtml(formatMoney(stats.failedAmount))}</td></tr>
              <tr><th>${escapeHtml(t.refundedAmount)}</th><td>${escapeHtml(formatMoney(stats.refundedAmount))}</td></tr>
              <tr><th>${escapeHtml(t.averagePayment)}</th><td>${escapeHtml(formatMoney(stats.averagePayment))}</td></tr>
            </tbody>
          </table>

          <h2>${escapeHtml(t.statusReport)}</h2>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t.status)}</th>
                <th>${escapeHtml(t.count)}</th>
                <th>${escapeHtml(t.total)}</th>
                <th>${escapeHtml(t.percentage)}</th>
              </tr>
            </thead>
            <tbody>
              ${buildStatusRowsHtml()}
            </tbody>
          </table>

          <h2>${escapeHtml(t.methodReport)}</h2>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t.method)}</th>
                <th>${escapeHtml(t.count)}</th>
                <th>${escapeHtml(t.total)}</th>
                <th>${escapeHtml(t.percentage)}</th>
              </tr>
            </thead>
            <tbody>
              ${buildMethodRowsHtml()}
            </tbody>
          </table>

          <h2>${escapeHtml(t.customerReport)}</h2>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t.customer)}</th>
                <th>${escapeHtml(t.count)}</th>
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
    link.download = `primey-care-payments-report-${dateStamp}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(t.exportSuccess);
  };

  const printReport = () => {
    if (filteredPayments.length === 0) {
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
              <div class="card-label">${escapeHtml(t.totalPayments)}</div>
              <div class="card-value">${escapeHtml(formatNumber(stats.totalPayments))}</div>
            </div>
            <div class="card">
              <div class="card-label">${escapeHtml(t.collectedAmount)}</div>
              <div class="card-value">${escapeHtml(formatMoney(stats.collectedAmount))}</div>
            </div>
            <div class="card">
              <div class="card-label">${escapeHtml(t.pendingAmount)}</div>
              <div class="card-value">${escapeHtml(formatMoney(stats.pendingAmount))}</div>
            </div>
            <div class="card">
              <div class="card-label">${escapeHtml(t.averagePayment)}</div>
              <div class="card-value">${escapeHtml(formatMoney(stats.averagePayment))}</div>
            </div>
          </div>

          <h2>${escapeHtml(t.statusReport)}</h2>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t.status)}</th>
                <th>${escapeHtml(t.count)}</th>
                <th>${escapeHtml(t.total)}</th>
                <th>${escapeHtml(t.percentage)}</th>
              </tr>
            </thead>
            <tbody>
              ${buildStatusRowsHtml()}
            </tbody>
          </table>

          <h2>${escapeHtml(t.methodReport)}</h2>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t.method)}</th>
                <th>${escapeHtml(t.count)}</th>
                <th>${escapeHtml(t.total)}</th>
                <th>${escapeHtml(t.percentage)}</th>
              </tr>
            </thead>
            <tbody>
              ${buildMethodRowsHtml()}
            </tbody>
          </table>

          <h2>${escapeHtml(t.customerReport)}</h2>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t.customer)}</th>
                <th>${escapeHtml(t.count)}</th>
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
      title: t.totalPayments,
      value: formatNumber(stats.totalPayments),
      description: isAr ? "عدد المدفوعات ضمن الفلتر" : "Payments within current filter",
      icon: ReceiptText,
    },
    {
      title: t.collectedAmount,
      value: formatMoney(stats.collectedAmount),
      description: t.sar,
      icon: Wallet,
      money: true,
    },
    {
      title: t.pendingAmount,
      value: formatMoney(stats.pendingAmount),
      description: isAr ? "مبالغ تحتاج تأكيد" : "Amounts requiring confirmation",
      icon: ShieldCheck,
      money: true,
    },
    {
      title: t.averagePayment,
      value: formatMoney(stats.averagePayment),
      description: isAr ? "متوسط الدفعات المؤكدة" : "Average confirmed payment",
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
                  onClick={() => loadPayments("refresh")}
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

            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as PaymentStatus)}
                className="h-10 rounded-2xl border border-input bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="ALL">{t.allStatuses}</option>
                {Object.keys(STATUS_META).map((status) => (
                  <option key={status} value={status}>
                    {getStatusLabel(status, locale)}
                  </option>
                ))}
              </select>

              <select
                value={methodFilter}
                onChange={(event) => setMethodFilter(event.target.value as PaymentMethod)}
                className="h-10 rounded-2xl border border-input bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="ALL">{t.allMethods}</option>
                {Object.keys(METHOD_META).map((method) => (
                  <option key={method} value={method}>
                    {getMethodLabel(method, locale)}
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
        ) : filteredPayments.length === 0 ? (
          <Card className="rounded-[1.5rem]">
            <CardContent className="flex min-h-96 flex-col items-center justify-center gap-3 text-center">
              <CreditCard className="h-12 w-12 text-muted-foreground" />
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
                STATUS + METHOD
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
                      <table className="w-full min-w-[680px] text-sm">
                        <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 text-start font-medium">{t.status}</th>
                            <th className="px-4 py-3 text-start font-medium">{t.count}</th>
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
                    <Banknote className="h-5 w-5 text-primary" />
                    {t.methodReport}
                  </CardTitle>
                  <CardDescription>{t.methodReportDesc}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  {methodRows.map((row) => (
                    <div key={row.method} className="rounded-3xl border bg-card p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <CreditCard className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{row.label}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatNumber(row.count)} {t.totalPayments}
                            </p>
                          </div>
                        </div>

                        <div className="text-end">
                          <MoneyValue value={row.total} strong />
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatNumber(row.percentage)}%
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.min(row.percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>

            {/* =====================================================
                FINANCIAL + CUSTOMER + MONTHLY
            ===================================================== */}
            <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
              <Card className="rounded-[1.5rem]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    {isAr ? "ملخص التحصيل" : "Collection Summary"}
                  </CardTitle>
                  <CardDescription>
                    {isAr
                      ? "تفصيل سريع لحالات التحصيل الرئيسية."
                      : "Quick breakdown of core collection statuses."}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <TaxLine label={t.collectedAmount} value={stats.collectedAmount} strong />
                  <TaxLine label={t.pendingAmount} value={stats.pendingAmount} />
                  <TaxLine label={t.failedAmount} value={stats.failedAmount} />
                  <TaxLine label={t.refundedAmount} value={stats.refundedAmount} />

                  <div className="grid grid-cols-2 gap-3">
                    <SmallCountCard
                      title={t.paidPayments}
                      value={stats.paidPayments}
                      icon={CheckCircle2}
                    />
                    <SmallCountCard
                      title={t.pendingPayments}
                      value={stats.pendingPayments}
                      icon={ShieldCheck}
                    />
                    <SmallCountCard
                      title={t.failedPayments}
                      value={stats.failedPayments}
                      icon={XCircle}
                    />
                    <SmallCountCard
                      title={t.refundedPayments}
                      value={stats.refundedPayments}
                      icon={ReceiptText}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6">
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
                      emptyLabel={t.noData}
                      headers={[t.customer, t.count, t.total]}
                      rows={customerRows.map((row) => [
                        row.customerKey,
                        formatNumber(row.count),
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
                      emptyLabel={t.noData}
                      headers={[t.month, t.count, t.total]}
                      rows={monthlyRows.map((row) => [
                        row.monthKey,
                        formatNumber(row.count),
                        formatMoney(row.total),
                      ])}
                    />
                  </CardContent>
                </Card>
              </div>
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

function SmallCountCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-3xl border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="mt-1 text-lg font-bold">{formatNumber(value)}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function SimpleReportTable({
  headers,
  rows,
  emptyLabel,
}: {
  headers: string[];
  rows: string[][];
  emptyLabel: string;
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
                  {emptyLabel}
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
                      {cellIndex === row.length - 1 ? (
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