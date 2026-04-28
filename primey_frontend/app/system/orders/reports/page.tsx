"use client";

import Image from "next/image";
import Link from "next/link";
import type { ElementType } from "react";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  CreditCard,
  Download,
  FileText,
  Loader2,
  PackageCheck,
  PieChart,
  Printer,
  RefreshCcw,
  ShoppingBag,
  TrendingUp,
  Wallet,
  XCircle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { apiGet } from "@/lib/api";

/* ============================================================
   📂 app/system/orders/reports/page.tsx
   🧠 Primey Care | Orders Reports
   ------------------------------------------------------------
   ✅ ربط حقيقي مع /api/orders/reports/
   ✅ تقرير دورة الطلب الكاملة
   ✅ ملخص مالي وتشغيلي
   ✅ breakdown حسب الحالة والدفع والمصدر
   ✅ آخر الطلبات
   ✅ Excel export
   ✅ Web PDF print
   ✅ عربي / إنجليزي عبر primey-locale
   ✅ الأرقام دائمًا بالإنجليزية
   ✅ رمز SAR من /currency/sar.svg
   ✅ بدون localhost
   ✅ sonner
============================================================ */

type AppLocale = "ar" | "en";

type OrderStatus =
  | "draft"
  | "pending"
  | "confirmed"
  | "processing"
  | "completed"
  | "cancelled"
  | "refunded"
  | "UNKNOWN";

type PaymentStatus =
  | "unpaid"
  | "partially_paid"
  | "paid"
  | "failed"
  | "refunded"
  | "UNKNOWN";

type OrderSource =
  | "website"
  | "whatsapp"
  | "agent"
  | "admin"
  | "mobile_app"
  | "other"
  | "UNKNOWN";

type OrdersSummary = {
  totalOrders: number;
  pendingOrders: number;
  confirmedOrders: number;
  processingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  refundedOrders: number;
  unpaidOrders: number;
  partiallyPaidOrders: number;
  paidOrders: number;
  grossAmount: number;
  paidAmount: number;
  discountAmount: number;
  taxAmount: number;
};

type StatusBreakdown = {
  status: OrderStatus;
  count: number;
  totalAmount: number;
  paidAmount: number;
};

type PaymentBreakdown = {
  paymentStatus: PaymentStatus;
  count: number;
  totalAmount: number;
  paidAmount: number;
};

type SourceBreakdown = {
  source: OrderSource;
  count: number;
  totalAmount: number;
  paidAmount: number;
};

type LatestOrder = {
  id: number | string;
  orderNumber: string;
  customerName: string;
  productName: string;
  providerName: string;
  agentName: string;
  invoiceNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  amountPaid: number;
  createdAt: string;
};

type OrdersReport = {
  summary: OrdersSummary;
  statusBreakdown: StatusBreakdown[];
  paymentBreakdown: PaymentBreakdown[];
  sourceBreakdown: SourceBreakdown[];
  latestOrders: LatestOrder[];
};

type ApiReportResponse = {
  ok?: boolean;
  message?: string;
  data?: {
    summary?: Record<string, unknown>;
    status_breakdown?: unknown[];
    payment_breakdown?: unknown[];
    source_breakdown?: unknown[];
    latest_orders?: unknown[];
  };
};

/* ============================================================
   🌐 Locale
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
  if (typeof document === "undefined") return;

  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  document.body.dir = locale === "ar" ? "rtl" : "ltr";
}

/* ============================================================
   🔁 Normalizers
============================================================ */

function safeRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function safeText(value: unknown, fallback = ""): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeOrderStatus(value: unknown): OrderStatus {
  const status = String(value || "").toLowerCase();

  if (status === "draft") return "draft";
  if (status === "pending") return "pending";
  if (status === "confirmed") return "confirmed";
  if (status === "processing") return "processing";
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  if (status === "refunded") return "refunded";

  return "UNKNOWN";
}

function normalizePaymentStatus(value: unknown): PaymentStatus {
  const status = String(value || "").toLowerCase();

  if (status === "unpaid") return "unpaid";
  if (status === "partially_paid") return "partially_paid";
  if (status === "paid") return "paid";
  if (status === "failed") return "failed";
  if (status === "refunded") return "refunded";

  return "UNKNOWN";
}

function normalizeSource(value: unknown): OrderSource {
  const source = String(value || "").toLowerCase();

  if (source === "website") return "website";
  if (source === "whatsapp") return "whatsapp";
  if (source === "agent") return "agent";
  if (source === "admin") return "admin";
  if (source === "mobile_app") return "mobile_app";
  if (source === "other") return "other";

  return "UNKNOWN";
}

function normalizeSummary(value: unknown): OrdersSummary {
  const obj = safeRecord(value);

  return {
    totalOrders: toNumber(obj.total_orders),
    pendingOrders: toNumber(obj.pending_orders),
    confirmedOrders: toNumber(obj.confirmed_orders),
    processingOrders: toNumber(obj.processing_orders),
    completedOrders: toNumber(obj.completed_orders),
    cancelledOrders: toNumber(obj.cancelled_orders),
    refundedOrders: toNumber(obj.refunded_orders),
    unpaidOrders: toNumber(obj.unpaid_orders),
    partiallyPaidOrders: toNumber(obj.partially_paid_orders),
    paidOrders: toNumber(obj.paid_orders),
    grossAmount: toNumber(obj.gross_amount),
    paidAmount: toNumber(obj.paid_amount),
    discountAmount: toNumber(obj.discount_amount),
    taxAmount: toNumber(obj.tax_amount),
  };
}

function normalizeStatusBreakdown(item: unknown): StatusBreakdown {
  const obj = safeRecord(item);

  return {
    status: normalizeOrderStatus(obj.status),
    count: toNumber(obj.count),
    totalAmount: toNumber(obj.total_amount),
    paidAmount: toNumber(obj.paid_amount),
  };
}

function normalizePaymentBreakdown(item: unknown): PaymentBreakdown {
  const obj = safeRecord(item);

  return {
    paymentStatus: normalizePaymentStatus(obj.payment_status),
    count: toNumber(obj.count),
    totalAmount: toNumber(obj.total_amount),
    paidAmount: toNumber(obj.paid_amount),
  };
}

function normalizeSourceBreakdown(item: unknown): SourceBreakdown {
  const obj = safeRecord(item);

  return {
    source: normalizeSource(obj.source),
    count: toNumber(obj.count),
    totalAmount: toNumber(obj.total_amount),
    paidAmount: toNumber(obj.paid_amount),
  };
}

function normalizeLatestOrder(item: unknown): LatestOrder {
  const obj = safeRecord(item);
  const customer = safeRecord(obj.customer);
  const provider = safeRecord(obj.provider);
  const agent = safeRecord(obj.agent);
  const invoice = safeRecord(obj.invoice);

  return {
    id: (obj.id ?? "-") as number | string,
    orderNumber: safeText(obj.order_number),
    customerName: safeText(
      customer.display_name ?? customer.full_name ?? customer.name,
      "-",
    ),
    productName: safeText(obj.product_name, "-"),
    providerName: safeText(
      provider.name ?? provider.display_name ?? provider.provider_name,
      "-",
    ),
    agentName: safeText(agent.name ?? agent.display_name ?? agent.full_name, "-"),
    invoiceNumber: safeText(invoice.invoice_number ?? invoice.number),
    status: normalizeOrderStatus(obj.status),
    paymentStatus: normalizePaymentStatus(obj.payment_status),
    totalAmount: toNumber(obj.total_amount),
    amountPaid: toNumber(obj.amount_paid),
    createdAt: safeText(obj.created_at),
  };
}

function normalizeReport(payload: ApiReportResponse): OrdersReport {
  const data = payload.data || {};

  return {
    summary: normalizeSummary(data.summary),
    statusBreakdown: Array.isArray(data.status_breakdown)
      ? data.status_breakdown.map(normalizeStatusBreakdown)
      : [],
    paymentBreakdown: Array.isArray(data.payment_breakdown)
      ? data.payment_breakdown.map(normalizePaymentBreakdown)
      : [],
    sourceBreakdown: Array.isArray(data.source_breakdown)
      ? data.source_breakdown.map(normalizeSourceBreakdown)
      : [],
    latestOrders: Array.isArray(data.latest_orders)
      ? data.latest_orders.map(normalizeLatestOrder)
      : [],
  };
}

/* ============================================================
   📚 Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    pageTitle: isArabic ? "تقارير الطلبات" : "Orders Reports",
    pageSubtitle: isArabic
      ? "تحليل دورة الطلبات حسب الحالة والدفع والمصدر مع ملخص مالي وتشغيلي."
      : "Analyze order lifecycle by status, payment and source with financial and operational summaries.",

    back: isArabic ? "رجوع" : "Back",
    list: isArabic ? "قائمة الطلبات" : "Orders List",
    create: isArabic ? "إنشاء طلب" : "Create Order",
    refresh: isArabic ? "تحديث" : "Refresh",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",

    loading: isArabic ? "جاري تحميل تقارير الطلبات..." : "Loading orders report...",
    loadError: isArabic ? "تعذر تحميل تقرير الطلبات." : "Unable to load orders report.",
    refreshSuccess: isArabic ? "تم تحديث التقرير بنجاح." : "Report refreshed successfully.",
    exportSuccess: isArabic ? "تم تصدير تقرير الطلبات بنجاح." : "Orders report exported successfully.",
    printTitle: isArabic ? "تقرير الطلبات" : "Orders Report",

    summary: isArabic ? "الملخص العام" : "Summary",
    statusBreakdown: isArabic ? "تحليل حالات الطلب" : "Status Breakdown",
    paymentBreakdown: isArabic ? "تحليل الدفع" : "Payment Breakdown",
    sourceBreakdown: isArabic ? "تحليل مصادر الطلبات" : "Source Breakdown",
    latestOrders: isArabic ? "آخر الطلبات" : "Latest Orders",

    totalOrders: isArabic ? "إجمالي الطلبات" : "Total Orders",
    pendingOrders: isArabic ? "قيد الانتظار" : "Pending Orders",
    confirmedOrders: isArabic ? "طلبات مؤكدة" : "Confirmed Orders",
    processingOrders: isArabic ? "قيد المعالجة" : "Processing Orders",
    completedOrders: isArabic ? "طلبات مكتملة" : "Completed Orders",
    cancelledOrders: isArabic ? "طلبات ملغية" : "Cancelled Orders",
    refundedOrders: isArabic ? "طلبات مستردة" : "Refunded Orders",
    unpaidOrders: isArabic ? "غير مدفوعة" : "Unpaid Orders",
    partiallyPaidOrders: isArabic ? "مدفوعة جزئيًا" : "Partially Paid",
    paidOrders: isArabic ? "مدفوعة" : "Paid Orders",

    grossAmount: isArabic ? "إجمالي قيمة الطلبات" : "Gross Amount",
    paidAmount: isArabic ? "إجمالي المدفوع" : "Paid Amount",
    discountAmount: isArabic ? "إجمالي الخصومات" : "Discount Amount",
    taxAmount: isArabic ? "إجمالي الضريبة" : "Tax Amount",
    remainingAmount: isArabic ? "المتبقي" : "Remaining Amount",

    status: isArabic ? "الحالة" : "Status",
    paymentStatus: isArabic ? "حالة الدفع" : "Payment Status",
    source: isArabic ? "المصدر" : "Source",
    count: isArabic ? "العدد" : "Count",
    totalAmount: isArabic ? "الإجمالي" : "Total",
    amountPaid: isArabic ? "المدفوع" : "Paid",

    orderNumber: isArabic ? "رقم الطلب" : "Order No.",
    customer: isArabic ? "العميل" : "Customer",
    product: isArabic ? "المنتج" : "Product",
    provider: isArabic ? "المركز" : "Provider",
    agent: isArabic ? "المندوب" : "Agent",
    invoice: isArabic ? "الفاتورة" : "Invoice",
    createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",

    empty: isArabic ? "لا توجد بيانات" : "No data",
    notLinked: isArabic ? "غير مرتبط" : "Not linked",

    statusLabels: {
      draft: isArabic ? "مسودة" : "Draft",
      pending: isArabic ? "قيد الانتظار" : "Pending",
      confirmed: isArabic ? "مؤكد" : "Confirmed",
      processing: isArabic ? "قيد المعالجة" : "Processing",
      completed: isArabic ? "مكتمل" : "Completed",
      cancelled: isArabic ? "ملغي" : "Cancelled",
      refunded: isArabic ? "مسترد" : "Refunded",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<OrderStatus, string>,

    paymentLabels: {
      unpaid: isArabic ? "غير مدفوع" : "Unpaid",
      partially_paid: isArabic ? "مدفوع جزئيًا" : "Partially Paid",
      paid: isArabic ? "مدفوع" : "Paid",
      failed: isArabic ? "فشل الدفع" : "Failed",
      refunded: isArabic ? "مسترد" : "Refunded",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<PaymentStatus, string>,

    sourceLabels: {
      website: isArabic ? "الموقع" : "Website",
      whatsapp: isArabic ? "واتساب" : "WhatsApp",
      agent: isArabic ? "مندوب" : "Agent",
      admin: isArabic ? "النظام" : "Admin",
      mobile_app: isArabic ? "تطبيق الجوال" : "Mobile App",
      other: isArabic ? "أخرى" : "Other",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<OrderSource, string>,
  };
}

/* ============================================================
   🎨 UI Helpers
============================================================ */

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string, locale: AppLocale) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function CurrencyAmount({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold" dir="ltr">
      <span>{formatMoney(value)}</span>
      <Image
        src="/currency/sar.svg"
        alt="SAR"
        width={14}
        height={14}
        className="opacity-80"
      />
    </span>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  money = false,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: ElementType;
  money?: boolean;
}) {
  return (
    <Card className="rounded-2xl border bg-card shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">{title}</p>
            <div className="text-2xl font-bold">
              {money ? <CurrencyAmount value={value} /> : formatNumber(value)}
            </div>
            <p className="text-muted-foreground text-xs">{subtitle}</p>
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      <XCircle className="mx-auto mb-3 h-8 w-8" />
      {text}
    </div>
  );
}

/* ============================================================
   ✅ Page
============================================================ */

export default function SystemOrdersReportsPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [report, setReport] = useState<OrdersReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const remainingAmount = useMemo(() => {
    if (!report) return 0;
    return Math.max(report.summary.grossAmount - report.summary.paidAmount, 0);
  }, [report]);

  async function loadReport(showToast = false) {
    try {
      setIsLoading(true);

      const result = await apiGet<ApiReportResponse>("/api/orders/reports/");

      if (!result.ok) {
        throw new Error(result.message || t.loadError);
      }

      const normalized = normalizeReport(result.data || result);
      setReport(normalized);

      if (showToast) {
        toast.success(t.refreshSuccess);
      }
    } catch (error) {
      console.error("Failed to load orders report:", error);
      setReport(null);
      toast.error(t.loadError);
    } finally {
      setIsLoading(false);
    }
  }

  function exportExcel() {
    if (!report) return;

    const summaryRows = [
      { Metric: t.totalOrders, Value: report.summary.totalOrders },
      { Metric: t.pendingOrders, Value: report.summary.pendingOrders },
      { Metric: t.confirmedOrders, Value: report.summary.confirmedOrders },
      { Metric: t.processingOrders, Value: report.summary.processingOrders },
      { Metric: t.completedOrders, Value: report.summary.completedOrders },
      { Metric: t.cancelledOrders, Value: report.summary.cancelledOrders },
      { Metric: t.refundedOrders, Value: report.summary.refundedOrders },
      { Metric: t.unpaidOrders, Value: report.summary.unpaidOrders },
      { Metric: t.partiallyPaidOrders, Value: report.summary.partiallyPaidOrders },
      { Metric: t.paidOrders, Value: report.summary.paidOrders },
      { Metric: t.grossAmount, Value: report.summary.grossAmount },
      { Metric: t.paidAmount, Value: report.summary.paidAmount },
      { Metric: t.discountAmount, Value: report.summary.discountAmount },
      { Metric: t.taxAmount, Value: report.summary.taxAmount },
      { Metric: t.remainingAmount, Value: remainingAmount },
    ];

    const statusRows = report.statusBreakdown.map((item) => ({
      [t.status]: t.statusLabels[item.status],
      [t.count]: item.count,
      [t.totalAmount]: item.totalAmount,
      [t.amountPaid]: item.paidAmount,
    }));

    const paymentRows = report.paymentBreakdown.map((item) => ({
      [t.paymentStatus]: t.paymentLabels[item.paymentStatus],
      [t.count]: item.count,
      [t.totalAmount]: item.totalAmount,
      [t.amountPaid]: item.paidAmount,
    }));

    const sourceRows = report.sourceBreakdown.map((item) => ({
      [t.source]: t.sourceLabels[item.source],
      [t.count]: item.count,
      [t.totalAmount]: item.totalAmount,
      [t.amountPaid]: item.paidAmount,
    }));

    const latestRows = report.latestOrders.map((order) => ({
      [t.orderNumber]: order.orderNumber || `#${order.id}`,
      [t.customer]: order.customerName,
      [t.product]: order.productName,
      [t.provider]: order.providerName === "-" ? "" : order.providerName,
      [t.agent]: order.agentName === "-" ? "" : order.agentName,
      [t.invoice]: order.invoiceNumber,
      [t.status]: t.statusLabels[order.status],
      [t.paymentStatus]: t.paymentLabels[order.paymentStatus],
      [t.totalAmount]: order.totalAmount,
      [t.amountPaid]: order.amountPaid,
      [t.createdAt]: order.createdAt,
    }));

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(summaryRows),
      "Summary",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(statusRows),
      "Status",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(paymentRows),
      "Payment",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(sourceRows),
      "Source",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(latestRows),
      "Latest Orders",
    );

    XLSX.writeFile(workbook, "primey-care-orders-report.xlsx");
    toast.success(t.exportSuccess);
  }

  function printReport() {
    if (!report) return;

    const statusRows = report.statusBreakdown
      .map(
        (item) => `
          <tr>
            <td>${t.statusLabels[item.status]}</td>
            <td>${formatNumber(item.count)}</td>
            <td>${formatMoney(item.totalAmount)}</td>
            <td>${formatMoney(item.paidAmount)}</td>
          </tr>
        `,
      )
      .join("");

    const paymentRows = report.paymentBreakdown
      .map(
        (item) => `
          <tr>
            <td>${t.paymentLabels[item.paymentStatus]}</td>
            <td>${formatNumber(item.count)}</td>
            <td>${formatMoney(item.totalAmount)}</td>
            <td>${formatMoney(item.paidAmount)}</td>
          </tr>
        `,
      )
      .join("");

    const latestRows = report.latestOrders
      .map(
        (order) => `
          <tr>
            <td>${order.orderNumber || `#${order.id}`}</td>
            <td>${order.customerName}</td>
            <td>${order.productName}</td>
            <td>${order.providerName === "-" ? "" : order.providerName}</td>
            <td>${t.statusLabels[order.status]}</td>
            <td>${t.paymentLabels[order.paymentStatus]}</td>
            <td>${formatMoney(order.totalAmount)}</td>
            <td>${formatMoney(order.amountPaid)}</td>
          </tr>
        `,
      )
      .join("");

    const printWindow = window.open("", "_blank", "width=1400,height=900");
    if (!printWindow) return;

    printWindow.document.write(`
      <!doctype html>
      <html lang="${locale}" dir="${isArabic ? "rtl" : "ltr"}">
        <head>
          <meta charset="utf-8" />
          <title>${t.printTitle}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 24px;
              color: #0f172a;
            }
            h1 { margin: 0 0 8px; font-size: 22px; }
            h2 { margin: 28px 0 12px; font-size: 16px; }
            p { margin: 0 0 20px; color: #64748b; font-size: 13px; }
            .summary {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 12px;
              margin: 20px 0;
            }
            .box {
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 14px;
              background: #f8fafc;
            }
            .box span {
              display: block;
              color: #64748b;
              font-size: 12px;
              margin-bottom: 8px;
            }
            .box strong {
              font-size: 18px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
              margin-bottom: 20px;
            }
            th, td {
              border: 1px solid #e2e8f0;
              padding: 9px;
              text-align: ${isArabic ? "right" : "left"};
            }
            th {
              background: #f8fafc;
              font-weight: 700;
            }
          </style>
        </head>
        <body>
          <h1>${t.printTitle}</h1>
          <p>${t.pageSubtitle}</p>

          <div class="summary">
            <div class="box"><span>${t.totalOrders}</span><strong>${formatNumber(report.summary.totalOrders)}</strong></div>
            <div class="box"><span>${t.completedOrders}</span><strong>${formatNumber(report.summary.completedOrders)}</strong></div>
            <div class="box"><span>${t.grossAmount}</span><strong>${formatMoney(report.summary.grossAmount)}</strong></div>
            <div class="box"><span>${t.paidAmount}</span><strong>${formatMoney(report.summary.paidAmount)}</strong></div>
          </div>

          <h2>${t.statusBreakdown}</h2>
          <table>
            <thead>
              <tr>
                <th>${t.status}</th>
                <th>${t.count}</th>
                <th>${t.totalAmount}</th>
                <th>${t.amountPaid}</th>
              </tr>
            </thead>
            <tbody>${statusRows}</tbody>
          </table>

          <h2>${t.paymentBreakdown}</h2>
          <table>
            <thead>
              <tr>
                <th>${t.paymentStatus}</th>
                <th>${t.count}</th>
                <th>${t.totalAmount}</th>
                <th>${t.amountPaid}</th>
              </tr>
            </thead>
            <tbody>${paymentRows}</tbody>
          </table>

          <h2>${t.latestOrders}</h2>
          <table>
            <thead>
              <tr>
                <th>${t.orderNumber}</th>
                <th>${t.customer}</th>
                <th>${t.product}</th>
                <th>${t.provider}</th>
                <th>${t.status}</th>
                <th>${t.paymentStatus}</th>
                <th>${t.totalAmount}</th>
                <th>${t.amountPaid}</th>
              </tr>
            </thead>
            <tbody>${latestRows}</tbody>
          </table>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  useEffect(() => {
    const syncLocale = () => {
      const nextLocale = readLocale();

      applyDocumentLocale(nextLocale);
      setLocale(nextLocale);
    };

    const syncAfterPaint = () => {
      syncLocale();

      window.setTimeout(() => {
        syncLocale();
      }, 0);
    };

    syncAfterPaint();

    window.addEventListener("primey-locale-changed", syncAfterPaint);
    window.addEventListener("storage", syncAfterPaint);

    return () => {
      window.removeEventListener("primey-locale-changed", syncAfterPaint);
      window.removeEventListener("storage", syncAfterPaint);
    };
  }, []);

  useEffect(() => {
    loadReport(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  return (
    <div className="space-y-4" dir={isArabic ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-8 rounded-xl"
            >
              <Link href="/system/orders">
                <ArrowLeft className="h-4 w-4" />
                {t.back}
              </Link>
            </Button>

            <Badge variant="secondary" className="rounded-full">
              <BarChart3 className="h-3.5 w-3.5" />
              {t.pageTitle}
            </Badge>
          </div>

          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t.pageTitle}
          </h1>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-6">
            {t.pageSubtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            asChild
            variant="outline"
            className="h-10 rounded-xl"
          >
            <Link href="/system/orders/list">
              <ShoppingBag className="h-4 w-4" />
              {t.list}
            </Link>
          </Button>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadReport(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            {t.refresh}
          </Button>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={exportExcel}
            disabled={!report || isLoading}
          >
            <Download className="h-4 w-4" />
            {t.exportExcel}
          </Button>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={printReport}
            disabled={!report || isLoading}
          >
            <Printer className="h-4 w-4" />
            {t.print}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-4 p-10 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="font-semibold">{t.loading}</p>
          </CardContent>
        </Card>
      ) : !report ? (
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-4 p-10 text-center">
            <XCircle className="h-8 w-8 text-destructive" />
            <p className="font-semibold">{t.loadError}</p>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => loadReport(false)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.refresh}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title={t.totalOrders}
              value={report.summary.totalOrders}
              subtitle={t.summary}
              icon={ShoppingBag}
            />
            <StatCard
              title={t.completedOrders}
              value={report.summary.completedOrders}
              subtitle={t.statusBreakdown}
              icon={PackageCheck}
            />
            <StatCard
              title={t.grossAmount}
              value={report.summary.grossAmount}
              subtitle={t.totalAmount}
              icon={Wallet}
              money
            />
            <StatCard
              title={t.paidAmount}
              value={report.summary.paidAmount}
              subtitle={t.paymentBreakdown}
              icon={CreditCard}
              money
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title={t.pendingOrders}
              value={report.summary.pendingOrders}
              subtitle={t.statusLabels.pending}
              icon={BadgeCheck}
            />
            <StatCard
              title={t.processingOrders}
              value={report.summary.processingOrders}
              subtitle={t.statusLabels.processing}
              icon={TrendingUp}
            />
            <StatCard
              title={t.discountAmount}
              value={report.summary.discountAmount}
              subtitle={t.summary}
              icon={PieChart}
              money
            />
            <StatCard
              title={t.remainingAmount}
              value={remainingAmount}
              subtitle={t.paymentBreakdown}
              icon={Wallet}
              money
            />
          </div>

          {/* Breakdowns */}
          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">{t.statusBreakdown}</CardTitle>
                <CardDescription>{t.status}</CardDescription>
              </CardHeader>
              <CardContent>
                {report.statusBreakdown.length === 0 ? (
                  <EmptyState text={t.empty} />
                ) : (
                  <div className="overflow-hidden rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.status}</TableHead>
                          <TableHead>{t.count}</TableHead>
                          <TableHead>{t.totalAmount}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.statusBreakdown.map((item) => (
                          <TableRow key={item.status}>
                            <TableCell>
                              <Badge variant="secondary" className="rounded-full">
                                {t.statusLabels[item.status]}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatNumber(item.count)}</TableCell>
                            <TableCell>
                              <CurrencyAmount value={item.totalAmount} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">{t.paymentBreakdown}</CardTitle>
                <CardDescription>{t.paymentStatus}</CardDescription>
              </CardHeader>
              <CardContent>
                {report.paymentBreakdown.length === 0 ? (
                  <EmptyState text={t.empty} />
                ) : (
                  <div className="overflow-hidden rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.paymentStatus}</TableHead>
                          <TableHead>{t.count}</TableHead>
                          <TableHead>{t.amountPaid}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.paymentBreakdown.map((item) => (
                          <TableRow key={item.paymentStatus}>
                            <TableCell>
                              <Badge variant="secondary" className="rounded-full">
                                {t.paymentLabels[item.paymentStatus]}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatNumber(item.count)}</TableCell>
                            <TableCell>
                              <CurrencyAmount value={item.paidAmount} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">{t.sourceBreakdown}</CardTitle>
                <CardDescription>{t.source}</CardDescription>
              </CardHeader>
              <CardContent>
                {report.sourceBreakdown.length === 0 ? (
                  <EmptyState text={t.empty} />
                ) : (
                  <div className="overflow-hidden rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.source}</TableHead>
                          <TableHead>{t.count}</TableHead>
                          <TableHead>{t.totalAmount}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.sourceBreakdown.map((item) => (
                          <TableRow key={item.source}>
                            <TableCell>
                              <Badge variant="secondary" className="rounded-full">
                                {t.sourceLabels[item.source]}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatNumber(item.count)}</TableCell>
                            <TableCell>
                              <CurrencyAmount value={item.totalAmount} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Latest Orders */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{t.latestOrders}</CardTitle>
              <CardDescription>{t.pageSubtitle}</CardDescription>
            </CardHeader>
            <CardContent>
              {report.latestOrders.length === 0 ? (
                <EmptyState text={t.empty} />
              ) : (
                <div className="overflow-hidden rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.orderNumber}</TableHead>
                        <TableHead>{t.customer}</TableHead>
                        <TableHead>{t.product}</TableHead>
                        <TableHead>{t.provider}</TableHead>
                        <TableHead>{t.agent}</TableHead>
                        <TableHead>{t.invoice}</TableHead>
                        <TableHead>{t.status}</TableHead>
                        <TableHead>{t.paymentStatus}</TableHead>
                        <TableHead>{t.totalAmount}</TableHead>
                        <TableHead>{t.createdAt}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.latestOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-semibold">
                            <Link
                              href={`/system/orders/${order.id}`}
                              className="hover:underline"
                            >
                              {order.orderNumber || `#${order.id}`}
                            </Link>
                          </TableCell>
                          <TableCell>{order.customerName}</TableCell>
                          <TableCell>{order.productName}</TableCell>
                          <TableCell>
                            {order.providerName === "-"
                              ? t.notLinked
                              : order.providerName}
                          </TableCell>
                          <TableCell>
                            {order.agentName === "-"
                              ? t.notLinked
                              : order.agentName}
                          </TableCell>
                          <TableCell>{order.invoiceNumber || t.notLinked}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="rounded-full">
                              {t.statusLabels[order.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="rounded-full">
                              {t.paymentLabels[order.paymentStatus]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <CurrencyAmount value={order.totalAmount} />
                          </TableCell>
                          <TableCell>{formatDate(order.createdAt, locale)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}