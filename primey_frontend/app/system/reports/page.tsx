"use client";

/* ============================================================
   📂 app/system/reports/page.tsx
   🧠 Primey Care | Reports Dashboard Page
   ------------------------------------------------------------
   ✅ المسار:
      /system/reports

   ✅ العمل:
      صفحة لوحة التقارير الشاملة داخل مساحة النظام.

   ✅ الإصدار:
      v1.0.0 - Reports Module Dashboard Integration

   ✅ يعتمد على:
      GET /api/reports/overview/

   ✅ متوافق مع صفحات:
      - /system/reports
      - /system/reports/customers
      - /system/reports/providers
      - /system/reports/orders
      - /system/reports/invoices
      - /system/reports/payments
      - /system/reports/accounting

   ✅ الوظائف:
      - عرض إحصائيات التقارير من API فعلي
      - عرض وحدات التقارير المركزية
      - روابط مباشرة للتقارير التفصيلية
      - تصدير Excel لملخص التقارير
      - طباعة Web PDF
      - دعم عربي / إنجليزي عبر primey-locale
      - استخدام toast من sonner للتنبيهات
      - عدم استخدام localhost hardcoded
      - استخدام UI الداخلي فقط
      - استخدام رمز العملة /currency/sar.svg
      - الأرقام تبقى بالإنجليزية
      - روابط داخلية آمنة بدون Dynamic href غير مدعوم
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  Building2,
  Calculator,
  CreditCard,
  Download,
  FileText,
  Loader2,
  Printer,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  ShoppingCart,
  Users,
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

/* ============================================================
   Types
============================================================ */

type AppLocale = "ar" | "en";

type ReportsSummary = {
  customers_count?: number;
  providers_count?: number;
  orders_count?: number;
  invoices_count?: number;
  payments_count?: number;
  orders_total?: number;
  invoices_total?: number;
  payments_total?: number;
  [key: string]: unknown;
};

type ReportsModule = {
  key: string;
  title_ar: string;
  title_en: string;
  href: string;
  api: string;
};

type ReportsOverviewData = {
  meta?: {
    key?: string;
    title_ar?: string;
    title_en?: string;
    generated_at?: string;
    currency?: string;
  };
  summary?: ReportsSummary;
  modules?: ReportsModule[];
};

type ReportsOverviewResponse = {
  success?: boolean;
  message?: string;
  data?: ReportsOverviewData;
};

type SummaryCard = {
  key: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  value: number | string;
  icon: LucideIcon;
  isMoney?: boolean;
};

type ReportModuleCard = {
  key: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  href: string;
  icon: LucideIcon;
  metricKey: keyof ReportsSummary;
  amountKey?: keyof ReportsSummary;
};

/* ============================================================
   Constants
============================================================ */

const REPORT_MODULES: ReportModuleCard[] = [
  {
    key: "customers",
    titleAr: "تقارير العملاء",
    titleEn: "Customers Reports",
    descriptionAr:
      "تحليل العملاء، الحالات، مصادر التسجيل، وحركة النشاط المرتبطة بهم.",
    descriptionEn:
      "Analyze customers, statuses, acquisition sources, and related activity.",
    href: "/system/reports/customers",
    icon: Users,
    metricKey: "customers_count",
  },
  {
    key: "providers",
    titleAr: "تقارير المراكز",
    titleEn: "Providers Reports",
    descriptionAr:
      "تحليل المراكز ومقدمي الخدمة حسب الحالة والنوع والمدينة والأداء.",
    descriptionEn:
      "Analyze providers by status, type, city, and operational performance.",
    href: "/system/reports/providers",
    icon: Building2,
    metricKey: "providers_count",
  },
  {
    key: "orders",
    titleAr: "تقارير الطلبات",
    titleEn: "Orders Reports",
    descriptionAr:
      "متابعة الطلبات حسب الحالة والفترة والقيمة التشغيلية والربط بالفواتير.",
    descriptionEn:
      "Track orders by status, period, operational value, and invoice linkage.",
    href: "/system/reports/orders",
    icon: ShoppingCart,
    metricKey: "orders_count",
    amountKey: "orders_total",
  },
  {
    key: "invoices",
    titleAr: "تقارير الفواتير",
    titleEn: "Invoices Reports",
    descriptionAr:
      "قراءة الفواتير الصادرة والمدفوعة والملغاة والضريبة والمتبقي للتحصيل.",
    descriptionEn:
      "Review issued, paid, canceled invoices, tax, and remaining collections.",
    href: "/system/reports/invoices",
    icon: ReceiptText,
    metricKey: "invoices_count",
    amountKey: "invoices_total",
  },
  {
    key: "payments",
    titleAr: "تقارير المدفوعات",
    titleEn: "Payments Reports",
    descriptionAr:
      "تحليل المدفوعات حسب الطريقة والحالة والربط مع الفواتير والخزينة.",
    descriptionEn:
      "Analyze payments by method, status, invoice linkage, and treasury impact.",
    href: "/system/reports/payments",
    icon: CreditCard,
    metricKey: "payments_count",
    amountKey: "payments_total",
  },
  {
    key: "accounting",
    titleAr: "تقارير المحاسبة",
    titleEn: "Accounting Reports",
    descriptionAr:
      "ملخص القيود والأرصدة المحاسبية والتقارير المالية المرتبطة بالنظام.",
    descriptionEn:
      "Accounting entries, balances, and financial reporting insights.",
    href: "/system/reports/accounting",
    icon: Calculator,
    metricKey: "invoices_count",
  },
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

function getDictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    pageTitle: isArabic ? "نظام التقارير الشامل" : "Comprehensive Reports",
    pageSubtitle: isArabic
      ? "مركز موحد لتقارير العملاء، المراكز، الطلبات، الفواتير، المدفوعات، والمحاسبة."
      : "A unified hub for customer, provider, order, invoice, payment, and accounting reports.",

    refresh: isArabic ? "تحديث" : "Refresh",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    printPdf: isArabic ? "طباعة PDF" : "Print PDF",

    overviewTitle: isArabic ? "ملخص التقارير" : "Reports Summary",
    overviewDescription: isArabic
      ? "قراءة مختصرة لأهم مؤشرات النظام من API التقارير المركزي."
      : "A quick reading of the main system indicators from the central reports API.",

    modulesTitle: isArabic ? "التقارير المتاحة" : "Available Reports",
    modulesDescription: isArabic
      ? "كل تقرير مستقل يعتمد على مصدر مركزي وفلاتر قابلة للتوسع."
      : "Each report uses a central source and expandable filters.",

    quickLinksTitle: isArabic ? "روابط مالية مختصرة" : "Financial Quick Links",
    quickLinksDescription: isArabic
      ? "وصول سريع للتقارير المالية الأساسية داخل المحاسبة."
      : "Quick access to core financial reports inside accounting.",

    openReport: isArabic ? "فتح التقرير" : "Open Report",
    generatedAt: isArabic ? "تاريخ التوليد" : "Generated At",
    currency: isArabic ? "العملة" : "Currency",

    totalCustomers: isArabic ? "إجمالي العملاء" : "Total Customers",
    totalProviders: isArabic ? "إجمالي المراكز" : "Total Providers",
    totalOrders: isArabic ? "إجمالي الطلبات" : "Total Orders",
    totalInvoices: isArabic ? "إجمالي الفواتير" : "Total Invoices",
    totalPayments: isArabic ? "إجمالي المدفوعات" : "Total Payments",
    ordersValue: isArabic ? "قيمة الطلبات" : "Orders Value",
    invoicesValue: isArabic ? "قيمة الفواتير" : "Invoices Value",
    paymentsValue: isArabic ? "قيمة المدفوعات" : "Payments Value",

    totalCustomersDesc: isArabic
      ? "عدد العملاء المسجلين في النظام."
      : "Registered customers in the system.",
    totalProvidersDesc: isArabic
      ? "عدد المراكز ومقدمي الخدمة."
      : "Centers and providers in the system.",
    totalOrdersDesc: isArabic
      ? "إجمالي الطلبات التشغيلية."
      : "Total operational orders.",
    totalInvoicesDesc: isArabic
      ? "عدد الفواتير المسجلة."
      : "Total registered invoices.",
    totalPaymentsDesc: isArabic
      ? "عدد عمليات الدفع المسجلة."
      : "Total registered payments.",
    ordersValueDesc: isArabic
      ? "إجمالي قيمة الطلبات."
      : "Total value of orders.",
    invoicesValueDesc: isArabic
      ? "إجمالي قيمة الفواتير."
      : "Total value of invoices.",
    paymentsValueDesc: isArabic
      ? "إجمالي قيمة المدفوعات."
      : "Total value of payments.",

    trialBalance: isArabic ? "ميزان المراجعة" : "Trial Balance",
    profitLoss: isArabic ? "الأرباح والخسائر" : "Profit & Loss",
    balanceSheet: isArabic ? "المركز المالي" : "Balance Sheet",
    ledger: isArabic ? "دفتر الأستاذ" : "General Ledger",

    loading: isArabic ? "جاري تحميل التقارير..." : "Loading reports...",
    emptyTitle: isArabic ? "لا توجد بيانات بعد" : "No data yet",
    emptyText: isArabic
      ? "تأكد من تشغيل API التقارير أو وجود بيانات في الوحدات المرتبطة."
      : "Make sure the reports API is running and related modules contain data.",

    loadError: isArabic
      ? "تعذر تحميل لوحة التقارير"
      : "Unable to load reports dashboard",
    refreshSuccess: isArabic
      ? "تم تحديث لوحة التقارير بنجاح"
      : "Reports dashboard refreshed successfully",
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

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getSummaryValue(summary: ReportsSummary, key: keyof ReportsSummary) {
  return summary[key] ?? 0;
}

function getAmountValue(summary: ReportsSummary, key?: keyof ReportsSummary) {
  if (!key) return 0;

  return summary[key] ?? 0;
}

function normalizeOverviewPayload(payload: unknown): ReportsOverviewData | null {
  if (!payload || typeof payload !== "object") return null;

  const response = payload as ReportsOverviewResponse;

  if (response.data && typeof response.data === "object") {
    return response.data;
  }

  return payload as ReportsOverviewData;
}

function buildSummaryCards(
  summary: ReportsSummary,
  locale: AppLocale,
): SummaryCard[] {
  const t = getDictionary(locale);

  return [
    {
      key: "customers_count",
      titleAr: "إجمالي العملاء",
      titleEn: "Total Customers",
      descriptionAr: t.totalCustomersDesc,
      descriptionEn: t.totalCustomersDesc,
      value: summary.customers_count || 0,
      icon: Users,
    },
    {
      key: "providers_count",
      titleAr: "إجمالي المراكز",
      titleEn: "Total Providers",
      descriptionAr: t.totalProvidersDesc,
      descriptionEn: t.totalProvidersDesc,
      value: summary.providers_count || 0,
      icon: Building2,
    },
    {
      key: "orders_count",
      titleAr: "إجمالي الطلبات",
      titleEn: "Total Orders",
      descriptionAr: t.totalOrdersDesc,
      descriptionEn: t.totalOrdersDesc,
      value: summary.orders_count || 0,
      icon: ShoppingCart,
    },
    {
      key: "invoices_count",
      titleAr: "إجمالي الفواتير",
      titleEn: "Total Invoices",
      descriptionAr: t.totalInvoicesDesc,
      descriptionEn: t.totalInvoicesDesc,
      value: summary.invoices_count || 0,
      icon: ReceiptText,
    },
    {
      key: "payments_count",
      titleAr: "إجمالي المدفوعات",
      titleEn: "Total Payments",
      descriptionAr: t.totalPaymentsDesc,
      descriptionEn: t.totalPaymentsDesc,
      value: summary.payments_count || 0,
      icon: CreditCard,
    },
    {
      key: "orders_total",
      titleAr: "قيمة الطلبات",
      titleEn: "Orders Value",
      descriptionAr: t.ordersValueDesc,
      descriptionEn: t.ordersValueDesc,
      value: summary.orders_total || 0,
      icon: BarChart3,
      isMoney: true,
    },
    {
      key: "invoices_total",
      titleAr: "قيمة الفواتير",
      titleEn: "Invoices Value",
      descriptionAr: t.invoicesValueDesc,
      descriptionEn: t.invoicesValueDesc,
      value: summary.invoices_total || 0,
      icon: FileText,
      isMoney: true,
    },
    {
      key: "payments_total",
      titleAr: "قيمة المدفوعات",
      titleEn: "Payments Value",
      descriptionAr: t.paymentsValueDesc,
      descriptionEn: t.paymentsValueDesc,
      value: summary.payments_total || 0,
      icon: CreditCard,
      isMoney: true,
    },
  ];
}

function downloadExcel(
  filename: string,
  rows: {
    label: string;
    value: string;
  }[],
  locale: AppLocale,
) {
  const title = locale === "ar" ? "ملخص التقارير" : "Reports Summary";

  const body = rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.label)}</td>
          <td>${escapeHtml(row.value)}</td>
        </tr>
      `,
    )
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
              <th colspan="2">${escapeHtml(title)}</th>
            </tr>
            <tr>
              <th>${locale === "ar" ? "المؤشر" : "Metric"}</th>
              <th>${locale === "ar" ? "القيمة" : "Value"}</th>
            </tr>
          </thead>
          <tbody>
            ${body}
          </tbody>
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

/* ============================================================
   Component
============================================================ */

export default function SystemReportsPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [data, setData] = useState<ReportsOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isArabic = locale === "ar";
  const t = useMemo(() => getDictionary(locale), [locale]);

  const summary = useMemo<ReportsSummary>(() => {
    return data?.summary || {};
  }, [data]);

  const summaryCards = useMemo(() => {
    return buildSummaryCards(summary, locale);
  }, [summary, locale]);

  const financialLinks = useMemo(
    () => [
      {
        title: t.trialBalance,
        href: "/system/accounting/trial-balance",
        icon: BarChart3,
      },
      {
        title: t.profitLoss,
        href: "/system/accounting/profit-loss",
        icon: FileText,
      },
      {
        title: t.balanceSheet,
        href: "/system/accounting/balance-sheet",
        icon: Building2,
      },
      {
        title: t.ledger,
        href: "/system/accounting/ledger",
        icon: Calculator,
      },
    ],
    [t],
  );

  async function loadReportsOverview(showToast = false) {
    try {
      setIsLoading(true);

      const result = await apiGet<ReportsOverviewResponse>(
        API_PATHS.reports.overview,
      );

      if (!result.ok) {
        throw new Error(result.message);
      }

      const normalizedData = normalizeOverviewPayload(result.data);

      setData(normalizedData);

      if (showToast) {
        toast.success(t.refreshSuccess);
      }
    } catch (error) {
      console.error("Load reports overview error:", error);
      setData(null);
      toast.error(t.loadError);
    } finally {
      setIsLoading(false);
    }
  }

  function handleExport() {
    const rows = summaryCards.map((card) => ({
      label: isArabic ? card.titleAr : card.titleEn,
      value: formatNumber(card.value),
    }));

    downloadExcel("primey-care-reports-overview", rows, locale);
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
    loadReportsOverview(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
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
            onClick={() => loadReportsOverview(true)}
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
            disabled={summaryCards.length === 0}
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

      {/* Summary */}
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {t.overviewTitle}
            </CardTitle>
            <CardDescription className="mt-1">
              {data?.meta?.generated_at
                ? `${t.generatedAt}: ${formatDate(data.meta.generated_at)}`
                : t.overviewDescription}
            </CardDescription>
          </div>

          <Badge variant="secondary" className="w-fit rounded-full">
            {t.currency}: SAR
          </Badge>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t.loading}</span>
            </div>
          ) : summaryCards.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center">
              <p className="font-semibold">{t.emptyTitle}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t.emptyText}
              </p>
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

      {/* Reports Modules */}
      <Card>
        <CardHeader>
          <CardTitle>{t.modulesTitle}</CardTitle>
          <CardDescription>{t.modulesDescription}</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {REPORT_MODULES.map((module) => {
              const Icon = module.icon;
              const title = isArabic ? module.titleAr : module.titleEn;
              const description = isArabic
                ? module.descriptionAr
                : module.descriptionEn;
              const metricValue = getSummaryValue(summary, module.metricKey);
              const amountValue = getAmountValue(summary, module.amountKey);

              return (
                <Link key={module.key} href={module.href} className="block">
                  <Card className="h-full shadow-none transition hover:-translate-y-0.5 hover:shadow-md">
                    <CardContent className="flex h-full flex-col justify-between gap-5 p-5">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted">
                            <Icon className="h-5 w-5" />
                          </div>

                          <Badge variant="secondary" className="rounded-full">
                            {formatNumber(metricValue)}
                          </Badge>
                        </div>

                        <div>
                          <h2 className="font-semibold">{title}</h2>
                          <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                            {description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        {module.amountKey ? (
                          <div className="inline-flex items-center gap-1 text-sm font-semibold">
                            <Image
                              src="/currency/sar.svg"
                              alt="SAR"
                              width={16}
                              height={16}
                            />
                            <span>{formatNumber(amountValue)}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {t.openReport}
                          </span>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          asChild
                        >
                          <span>
                            {t.openReport}
                            <ArrowUpRight className="h-4 w-4" />
                          </span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Financial Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>{t.quickLinksTitle}</CardTitle>
          <CardDescription>{t.quickLinksDescription}</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {financialLinks.map((link) => {
              const Icon = link.icon;

              return (
                <Button
                  key={link.href}
                  variant="outline"
                  className="h-auto justify-between rounded-2xl p-4"
                  asChild
                >
                  <Link href={link.href}>
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span>{link.title}</span>
                    </span>
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}