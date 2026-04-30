"use client";

/* ============================================================
   📂 app/system/reports/invoices/page.tsx
   🧠 Primey Care | Invoices Reports Page
   ------------------------------------------------------------
   ✅ المسار:
      /system/reports/invoices

   ✅ العمل:
      تقرير الفواتير المركزي ضمن وحدة التقارير الشاملة.

   ✅ يعتمد على:
      GET /api/reports/invoices/

   ✅ الوظائف:
      - عرض ملخص الفواتير من API التقارير
      - فلاتر متقدمة: من تاريخ / إلى تاريخ / الحالة
      - بحث داخل النتائج
      - جدول بيانات الفواتير
      - تحليل حسب حالة الفاتورة
      - تصدير Excel
      - طباعة Web PDF
      - دعم تبديل عربي / إنجليزي عبر primey-locale
      - استخدام toast من sonner
      - استخدام UI الداخلي فقط
      - استخدام رمز العملة /currency/sar.svg
      - الأرقام إنجليزية دائمًا
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Download,
  Eye,
  FileText,
  Filter,
  Languages,
  Loader2,
  Printer,
  ReceiptText,
  RefreshCcw,
  Search,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { API_PATHS, apiGet } from "@/lib/api";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ============================================================
   Types
============================================================ */

type AppLocale = "ar" | "en";

type ReportMeta = {
  key?: string;
  title_ar?: string;
  title_en?: string;
  generated_at?: string;
  currency?: string;
};

type ReportChartItem = {
  key?: string | number | null;
  count?: number | null;
  total?: number | string | null;
};

type InvoiceReportRow = Record<string, unknown>;

type InvoicesReportData = {
  meta?: ReportMeta;
  filters?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  charts?: {
    by_status?: ReportChartItem[];
    [key: string]: ReportChartItem[] | undefined;
  };
  rows?: InvoiceReportRow[];
};

type InvoicesReportResponse = {
  success?: boolean;
  message?: string;
  data?: InvoicesReportData;
};

type FilterState = {
  date_from: string;
  date_to: string;
  status: string;
  search: string;
};

type SummaryCard = {
  key: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  value: unknown;
  icon: LucideIcon;
  isMoney?: boolean;
};

/* ============================================================
   Constants
============================================================ */

const INVOICE_COLUMNS = [
  "id",
  "invoice_number",
  "code",
  "customer_name",
  "customer",
  "order_number",
  "order",
  "status",
  "total_amount",
  "paid_amount",
  "remaining_amount",
  "tax_amount",
  "created_at",
  "issued_at",
];

const MONEY_KEYS = [
  "amount",
  "total",
  "total_amount",
  "grand_total",
  "net_amount",
  "subtotal",
  "paid_amount",
  "remaining_amount",
  "tax_amount",
  "vat_amount",
];

/* ============================================================
   Locale Helpers
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

function setStoredLocale(locale: AppLocale) {
  try {
    if (typeof window === "undefined") return;

    window.localStorage.setItem("primey-locale", locale);
    applyDocumentLocale(locale);
    window.dispatchEvent(new Event("primey-locale-changed"));
  } catch (error) {
    console.error("Set locale error:", error);
  }
}

function getDictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    pageTitle: isArabic ? "تقارير الفواتير" : "Invoices Reports",
    pageSubtitle: isArabic
      ? "متابعة الفواتير الصادرة والمدفوعة والملغاة والمبالغ المتبقية والضريبة من مصدر التقارير المركزي."
      : "Track issued, paid, canceled invoices, remaining amounts, and tax from the central reports source.",

    language: isArabic ? "English" : "العربية",
    languageChanged: isArabic
      ? "تم تحويل اللغة إلى الإنجليزية"
      : "Language switched to Arabic",

    backToReports: isArabic ? "لوحة التقارير" : "Reports Dashboard",
    refresh: isArabic ? "تحديث" : "Refresh",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    printPdf: isArabic ? "طباعة PDF" : "Print PDF",

    summaryTitle: isArabic ? "ملخص الفواتير" : "Invoices Summary",
    summaryDescription: isArabic
      ? "قراءة سريعة لأهم مؤشرات الفواتير حسب البيانات الحالية."
      : "A quick reading of invoice indicators based on current data.",

    filtersTitle: isArabic ? "الفلاتر المتقدمة" : "Advanced Filters",
    filtersDescription: isArabic
      ? "استخدم الفترة والحالة لتحديث التقرير من API التقارير."
      : "Use date range and status to refresh the report from the reports API.",

    dateFrom: isArabic ? "من تاريخ" : "Date From",
    dateTo: isArabic ? "إلى تاريخ" : "Date To",
    status: isArabic ? "الحالة" : "Status",
    searchPlaceholder: isArabic
      ? "بحث داخل نتائج الفواتير..."
      : "Search inside invoice rows...",

    tableTitle: isArabic ? "نتائج الفواتير" : "Invoice Rows",
    tableDescription: isArabic
      ? "يعرض الجدول آخر نتائج الفواتير القادمة من API التقارير المركزي."
      : "The table shows the latest invoice rows returned from the central reports API.",

    analysisTitle: isArabic ? "تحليل سريع" : "Quick Analysis",
    byStatus: isArabic ? "حسب حالة الفاتورة" : "By Invoice Status",

    totalInvoices: isArabic ? "إجمالي الفواتير" : "Total Invoices",
    totalAmount: isArabic ? "إجمالي الفواتير" : "Invoices Value",
    paidAmount: isArabic ? "المبلغ المدفوع" : "Paid Amount",
    remainingAmount: isArabic ? "المبلغ المتبقي" : "Remaining Amount",
    taxAmount: isArabic ? "ضريبة القيمة المضافة" : "VAT / Tax",
    returnedRows: isArabic ? "النتائج المعروضة" : "Returned Rows",
    filteredRows: isArabic ? "بعد البحث" : "Filtered Rows",

    totalInvoicesDesc: isArabic
      ? "عدد الفواتير ضمن التقرير الحالي."
      : "Invoices included in the current report.",
    totalAmountDesc: isArabic
      ? "إجمالي قيمة الفواتير الحالية."
      : "Total value of current invoices.",
    paidAmountDesc: isArabic
      ? "إجمالي المبالغ المدفوعة على الفواتير."
      : "Total paid amounts against invoices.",
    remainingAmountDesc: isArabic
      ? "إجمالي المبالغ المتبقية للتحصيل."
      : "Total remaining amounts to collect.",
    taxAmountDesc: isArabic
      ? "إجمالي الضريبة المسجلة على الفواتير."
      : "Total tax recorded on invoices.",
    returnedRowsDesc: isArabic
      ? "عدد الصفوف القادمة من API."
      : "Rows returned from the API.",
    filteredRowsDesc: isArabic
      ? "عدد الصفوف بعد البحث الداخلي."
      : "Rows after local search.",

    generatedAt: isArabic ? "تاريخ التوليد" : "Generated At",
    action: isArabic ? "الإجراء" : "Action",
    open: isArabic ? "فتح" : "Open",
    invoiceBadge: isArabic ? "الفواتير" : "Invoices",

    loading: isArabic
      ? "جاري تحميل تقرير الفواتير..."
      : "Loading invoices report...",
    emptyTitle: isArabic ? "لا توجد بيانات فواتير" : "No invoice data",
    emptyText: isArabic
      ? "غيّر الفلاتر أو تأكد من وجود بيانات الفواتير في النظام."
      : "Change filters or make sure invoice data exists in the system.",

    loadError: isArabic
      ? "تعذر تحميل تقرير الفواتير"
      : "Unable to load invoices report",
    refreshSuccess: isArabic
      ? "تم تحديث تقرير الفواتير بنجاح"
      : "Invoices report refreshed successfully",
    exportSuccess: isArabic
      ? "تم تجهيز ملف Excel"
      : "Excel file has been prepared",
    printReady: isArabic ? "تم تجهيز الطباعة" : "Print is ready",
  };
}

/* ============================================================
   Format Helpers
============================================================ */

function formatNumber(value: unknown) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) return "0";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(number);
}

function formatDate(value: unknown) {
  if (!value) return "-";

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-GB");
}

function isMoneyKey(key: string) {
  const cleanKey = key.toLowerCase();

  return MONEY_KEYS.some((item) => cleanKey.includes(item));
}

function formatCellValue(key: string, value: unknown, locale: AppLocale) {
  if (value === null || value === undefined || value === "") return "-";

  if (
    key.includes("date") ||
    key.includes("created") ||
    key.includes("updated") ||
    key.endsWith("_at")
  ) {
    return formatDate(value);
  }

  if (typeof value === "number") return formatNumber(value);

  if (typeof value === "boolean") {
    return locale === "ar" ? (value ? "نعم" : "لا") : value ? "Yes" : "No";
  }

  if (typeof value === "object") return JSON.stringify(value);

  return String(value);
}

function labelizeKey(key: string, locale: AppLocale) {
  const labels: Record<string, { ar: string; en: string }> = {
    id: { ar: "الرقم", en: "ID" },
    invoice_number: { ar: "رقم الفاتورة", en: "Invoice No." },
    code: { ar: "الكود", en: "Code" },
    customer_name: { ar: "اسم العميل", en: "Customer Name" },
    customer: { ar: "العميل", en: "Customer" },
    order_number: { ar: "رقم الطلب", en: "Order No." },
    order: { ar: "الطلب", en: "Order" },
    status: { ar: "الحالة", en: "Status" },
    total_amount: { ar: "الإجمالي", en: "Total Amount" },
    paid_amount: { ar: "المدفوع", en: "Paid Amount" },
    remaining_amount: { ar: "المتبقي", en: "Remaining Amount" },
    tax_amount: { ar: "الضريبة", en: "Tax Amount" },
    vat_amount: { ar: "ضريبة القيمة المضافة", en: "VAT Amount" },
    created_at: { ar: "تاريخ الإنشاء", en: "Created At" },
    issued_at: { ar: "تاريخ الإصدار", en: "Issued At" },
    updated_at: { ar: "آخر تحديث", en: "Updated At" },
  };

  const label = labels[key];

  if (label) return locale === "ar" ? label.ar : label.en;

  return key.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeReportPayload(payload: unknown): InvoicesReportData | null {
  if (!payload || typeof payload !== "object") return null;

  const response = payload as InvoicesReportResponse;

  if (response.data && typeof response.data === "object") {
    return response.data;
  }

  return payload as InvoicesReportData;
}

function getRows(data: InvoicesReportData | null): InvoiceReportRow[] {
  return Array.isArray(data?.rows) ? data.rows : [];
}

function getColumns(rows: InvoiceReportRow[]) {
  const firstRow = rows[0] || {};
  const availableColumns = Object.keys(firstRow);

  const preferredColumns = INVOICE_COLUMNS.filter((column) =>
    availableColumns.includes(column),
  );

  const fallbackColumns = availableColumns.filter(
    (column) => !preferredColumns.includes(column),
  );

  return [...preferredColumns, ...fallbackColumns].slice(0, 8);
}

function buildQuery(filters: FilterState) {
  return {
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
    status: filters.status || undefined,
  };
}

function downloadExcel(
  filename: string,
  rows: InvoiceReportRow[],
  columns: string[],
  locale: AppLocale,
) {
  const title = locale === "ar" ? "تقرير الفواتير" : "Invoices Report";

  const header = columns
    .map((column) => `<th>${escapeHtml(labelizeKey(column, locale))}</th>`)
    .join("");

  const body = rows
    .map((row) => {
      const cells = columns
        .map(
          (column) =>
            `<td>${escapeHtml(
              formatCellValue(column, row[column], locale),
            )}</td>`,
        )
        .join("");

      return `<tr>${cells}</tr>`;
    })
    .join("");

  const html = `
    <html dir="${locale === "ar" ? "rtl" : "ltr"}">
      <head>
        <meta charset="utf-8" />
      </head>
      <body>
        <table border="1">
          <thead>
            <tr>
              <th colspan="${columns.length}">${escapeHtml(title)}</th>
            </tr>
            <tr>${header}</tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </body>
    </html>
  `;

  const blob = new Blob([html], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `${filename}.xls`;
  anchor.click();

  URL.revokeObjectURL(url);
}

function buildSummaryCards(
  data: InvoicesReportData | null,
  filteredRowsCount: number,
  locale: AppLocale,
): SummaryCard[] {
  const t = getDictionary(locale);
  const summary = data?.summary || {};
  const rows = getRows(data);

  return [
    {
      key: "total_invoices",
      titleAr: "إجمالي الفواتير",
      titleEn: "Total Invoices",
      descriptionAr: t.totalInvoicesDesc,
      descriptionEn: t.totalInvoicesDesc,
      value: summary.total_invoices ?? rows.length,
      icon: ReceiptText,
    },
    {
      key: "total_amount",
      titleAr: "إجمالي الفواتير",
      titleEn: "Invoices Value",
      descriptionAr: t.totalAmountDesc,
      descriptionEn: t.totalAmountDesc,
      value: summary.total_amount ?? 0,
      icon: FileText,
      isMoney: true,
    },
    {
      key: "paid_amount",
      titleAr: "المبلغ المدفوع",
      titleEn: "Paid Amount",
      descriptionAr: t.paidAmountDesc,
      descriptionEn: t.paidAmountDesc,
      value: summary.paid_amount ?? 0,
      icon: Wallet,
      isMoney: true,
    },
    {
      key: "remaining_amount",
      titleAr: "المبلغ المتبقي",
      titleEn: "Remaining Amount",
      descriptionAr: t.remainingAmountDesc,
      descriptionEn: t.remainingAmountDesc,
      value: summary.remaining_amount ?? 0,
      icon: ShieldCheck,
      isMoney: true,
    },
    {
      key: "tax_amount",
      titleAr: "ضريبة القيمة المضافة",
      titleEn: "VAT / Tax",
      descriptionAr: t.taxAmountDesc,
      descriptionEn: t.taxAmountDesc,
      value: summary.tax_amount ?? 0,
      icon: BarChart3,
      isMoney: true,
    },
    {
      key: "returned_rows",
      titleAr: "النتائج المعروضة",
      titleEn: "Returned Rows",
      descriptionAr: t.returnedRowsDesc,
      descriptionEn: t.returnedRowsDesc,
      value: rows.length,
      icon: ReceiptText,
    },
    {
      key: "filtered_rows",
      titleAr: "بعد البحث",
      titleEn: "Filtered Rows",
      descriptionAr: t.filteredRowsDesc,
      descriptionEn: t.filteredRowsDesc,
      value: filteredRowsCount,
      icon: Search,
    },
  ];
}

/* ============================================================
   Component
============================================================ */

export default function SystemInvoicesReportsPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [data, setData] = useState<InvoicesReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    date_from: "",
    date_to: "",
    status: "",
    search: "",
  });

  const isArabic = locale === "ar";
  const t = useMemo(() => getDictionary(locale), [locale]);

  const rows = useMemo(() => getRows(data), [data]);

  const filteredRows = useMemo(() => {
    const query = filters.search.trim().toLowerCase();

    if (!query) return rows;

    return rows.filter((row) =>
      Object.values(row).some((value) =>
        String(value ?? "").toLowerCase().includes(query),
      ),
    );
  }, [filters.search, rows]);

  const columns = useMemo(() => getColumns(rows), [rows]);

  const summaryCards = useMemo(() => {
    return buildSummaryCards(data, filteredRows.length, locale);
  }, [data, filteredRows.length, locale]);

  const chartGroups = useMemo(() => {
    return [
      {
        key: "by_status",
        title: t.byStatus,
        items: data?.charts?.by_status || [],
        icon: ShieldCheck,
      },
    ];
  }, [data, t]);

  async function loadInvoicesReport(showToast = false) {
    try {
      setIsLoading(true);

      const result = await apiGet<InvoicesReportResponse>(
        API_PATHS.reports.invoices,
        buildQuery(filters),
      );

      if (!result.ok) {
        throw new Error(result.message);
      }

      const normalizedData = normalizeReportPayload(result.data);

      setData(normalizedData);

      if (showToast) {
        toast.success(t.refreshSuccess);
      }
    } catch (error) {
      console.error("Load invoices report error:", error);
      setData(null);
      toast.error(t.loadError);
    } finally {
      setIsLoading(false);
    }
  }

  function handleLocaleToggle() {
    const nextLocale: AppLocale = locale === "ar" ? "en" : "ar";

    setStoredLocale(nextLocale);
    setLocale(nextLocale);
    toast.success(t.languageChanged);
  }

  function handleExport() {
    downloadExcel("primey-care-invoices-report", filteredRows, columns, locale);
    toast.success(t.exportSuccess);
  }

  function handlePrint() {
    toast.success(t.printReady);

    window.setTimeout(() => {
      window.print();
    }, 100);
  }

  useEffect(() => {
    const syncLocale = () => {
      const nextLocale = readLocale();

      applyDocumentLocale(nextLocale);
      setLocale(nextLocale);
    };

    const syncLocaleAfterPaint = () => {
      syncLocale();

      window.setTimeout(() => {
        syncLocale();
      }, 0);
    };

    syncLocaleAfterPaint();

    window.addEventListener("primey-locale-changed", syncLocaleAfterPaint);
    window.addEventListener("storage", syncLocaleAfterPaint);

    return () => {
      window.removeEventListener("primey-locale-changed", syncLocaleAfterPaint);
      window.removeEventListener("storage", syncLocaleAfterPaint);
    };
  }, []);

  useEffect(() => {
    loadInvoicesReport(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  return (
    <div className="space-y-6" dir={isArabic ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
            <ReceiptText className="h-3.5 w-3.5" />
            <span>Primey Care Reports</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t.pageTitle}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {t.pageSubtitle}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row print:hidden">
          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={handleLocaleToggle}
          >
            <Languages className="h-4 w-4" />
            <span>{t.language}</span>
          </Button>

          <Button variant="outline" className="h-10 rounded-xl" asChild>
            <Link href="/system/reports">
              <BarChart3 className="h-4 w-4" />
              <span>{t.backToReports}</span>
            </Link>
          </Button>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadInvoicesReport(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refresh}</span>
          </Button>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={handleExport}
            disabled={filteredRows.length === 0 || columns.length === 0}
          >
            <Download className="h-4 w-4" />
            <span>{t.exportExcel}</span>
          </Button>

          <Button className="h-10 rounded-xl" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            <span>{t.printPdf}</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t.filtersTitle}
          </CardTitle>
          <CardDescription>{t.filtersDescription}</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                {t.dateFrom}
              </label>
              <Input
                type="date"
                value={filters.date_from}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    date_from: event.target.value,
                  }))
                }
                className="h-10 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                {t.dateTo}
              </label>
              <Input
                type="date"
                value={filters.date_to}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    date_to: event.target.value,
                  }))
                }
                className="h-10 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                {t.status}
              </label>
              <Input
                value={filters.status}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    status: event.target.value,
                  }))
                }
                placeholder={t.status}
                className="h-10 rounded-xl"
              />
            </div>

            <div className="flex items-end">
              <Button
                className="h-10 w-full rounded-xl"
                onClick={() => loadInvoicesReport(true)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                <span>{t.refresh}</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5" />
              {t.summaryTitle}
            </CardTitle>
            <CardDescription className="mt-1">
              {data?.meta?.generated_at
                ? `${t.generatedAt}: ${formatDate(data.meta.generated_at)}`
                : t.summaryDescription}
            </CardDescription>
          </div>

          <Badge variant="secondary" className="w-fit rounded-full">
            {t.invoiceBadge}
          </Badge>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t.loading}</span>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => {
                const Icon = card.icon;
                const title = isArabic ? card.titleAr : card.titleEn;
                const description = isArabic
                  ? card.descriptionAr
                  : card.descriptionEn;

                return (
                  <Card key={card.key} className="shadow-none">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">
                            {title}
                          </p>

                          <p className="text-2xl font-bold">
                            {formatNumber(card.value)}
                          </p>
                        </div>

                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted">
                          {card.isMoney ? (
                            <Image
                              src="/currency/sar.svg"
                              alt="SAR"
                              width={20}
                              height={20}
                            />
                          ) : (
                            <Icon className="h-5 w-5" />
                          )}
                        </div>
                      </div>

                      <p className="mt-4 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {t.analysisTitle}
          </CardTitle>
          <CardDescription>{t.summaryDescription}</CardDescription>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t.loading}</span>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-1">
              {chartGroups.map((group) => {
                const GroupIcon = group.icon;

                return (
                  <Card key={group.key} className="shadow-none">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <GroupIcon className="h-4 w-4" />
                        {group.title}
                      </CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      {group.items.length === 0 ? (
                        <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                          {t.emptyText}
                        </div>
                      ) : (
                        group.items.slice(0, 8).map((item, index) => {
                          const count = Number(item.count || item.total || 0);
                          const width = Math.min(count * 10, 100);

                          return (
                            <div
                              key={`${group.key}-${String(item.key)}-${index}`}
                              className="space-y-2"
                            >
                              <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="truncate">
                                  {String(item.key || "-")}
                                </span>
                                <span className="font-semibold">
                                  {formatNumber(count)}
                                </span>
                              </div>

                              <div className="h-2 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${width}%` }}
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>{t.tableTitle}</CardTitle>
            <CardDescription>{t.tableDescription}</CardDescription>
          </div>

          <div className="relative w-full lg:w-80 print:hidden">
            <Search
              className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${
                isArabic ? "right-3" : "left-3"
              }`}
            />
            <Input
              value={filters.search}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  search: event.target.value,
                }))
              }
              placeholder={t.searchPlaceholder}
              className={`h-10 rounded-xl ${isArabic ? "pr-10" : "pl-10"}`}
            />
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-hidden rounded-2xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column) => (
                    <TableHead key={column}>
                      {labelizeKey(column, locale)}
                    </TableHead>
                  ))}
                  <TableHead className="print:hidden">{t.action}</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={Math.max(columns.length + 1, 2)}>
                      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{t.loading}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredRows.length === 0 || columns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={Math.max(columns.length + 1, 2)}>
                      <div className="py-12 text-center">
                        <p className="font-semibold">{t.emptyTitle}</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {t.emptyText}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.slice(0, 80).map((row, index) => (
                    <TableRow key={String(row.id || index)}>
                      {columns.map((column) => (
                        <TableCell
                          key={column}
                          className={
                            column === "invoice_number" || column === "code"
                              ? "font-medium"
                              : undefined
                          }
                        >
                          {column === "status" ? (
                            <Badge variant="secondary" className="rounded-full">
                              {formatCellValue(column, row[column], locale)}
                            </Badge>
                          ) : isMoneyKey(column) ? (
                            <span className="inline-flex items-center gap-1">
                              <Image
                                src="/currency/sar.svg"
                                alt="SAR"
                                width={14}
                                height={14}
                              />
                              <span>
                                {formatCellValue(column, row[column], locale)}
                              </span>
                            </span>
                          ) : (
                            formatCellValue(column, row[column], locale)
                          )}
                        </TableCell>
                      ))}

                      <TableCell className="print:hidden">
                        {row.id ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-xl"
                            asChild
                          >
                            <Link href={`/system/invoices/${String(row.id)}`}>
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">{t.open}</span>
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-xl"
                            disabled
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              <span>
                {formatNumber(filteredRows.length)} / {formatNumber(rows.length)}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="rounded-xl print:hidden"
              asChild
            >
              <Link href="/system/reports">
                <span>{t.backToReports}</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}