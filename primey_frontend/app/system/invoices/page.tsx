"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownUp,
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  Plus,
  ReceiptText,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
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
  notes?: string | null;
  internal_notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ApiSummary = {
  subtotal?: string | number | null;
  discount_amount?: string | number | null;
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
  page?: number;
  page_size?: number;
  has_next?: boolean;
  has_previous?: boolean;
  summary?: ApiSummary;
  results?: ApiInvoice[];
  message?: string;
};

type InvoiceStatusMeta = {
  labelAr: string;
  labelEn: string;
  className: string;
};

/* =====================================================
   CONSTANTS
===================================================== */

const SAR_ICON_PATH = "/currency/sar.svg";

const STATUS_META: Record<string, InvoiceStatusMeta> = {
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
  if (stored === "en" || stored === "ar") return stored;

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

function getInvoiceNumber(invoice: ApiInvoice): string {
  return invoice.invoice_number || invoice.number || `INV-${invoice.id}`;
}

function getInvoiceDate(invoice: ApiInvoice): string | null | undefined {
  return invoice.issue_date || invoice.invoice_date || invoice.created_at;
}

function getCustomerName(invoice: ApiInvoice, fallback: string): string {
  return invoice.customer?.name || (invoice.customer_id ? `#${invoice.customer_id}` : fallback);
}

function getOrderNumber(invoice: ApiInvoice, fallback: string): string {
  return invoice.order?.order_number || (invoice.order_id ? `#${invoice.order_id}` : fallback);
}

function getStatusLabel(status: string | null | undefined, locale: AppLocale) {
  const key = String(status || "DRAFT").toUpperCase();
  const meta = STATUS_META[key];

  if (!meta) return status || (locale === "ar" ? "غير محدد" : "Unknown");

  return locale === "ar" ? meta.labelAr : meta.labelEn;
}

function getStatusClassName(status: string | null | undefined) {
  const key = String(status || "DRAFT").toUpperCase();
  return STATUS_META[key]?.className || STATUS_META.DRAFT.className;
}

/* =====================================================
   API HELPER
===================================================== */

async function fetchInvoices(): Promise<{
  invoices: ApiInvoice[];
  summary: ApiSummary | null;
  totalCount: number;
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
    throw new Error(data?.message || "Failed to load invoices.");
  }

  return {
    invoices: Array.isArray(data.results) ? data.results : [],
    summary: data.summary || null,
    totalCount: Number(data.total_count || data.count || 0),
  };
}

/* =====================================================
   PAGE
===================================================== */

export default function SystemInvoicesPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [invoices, setInvoices] = useState<ApiInvoice[]>([]);
  const [apiSummary, setApiSummary] = useState<ApiSummary | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const isAr = locale === "ar";

  const t = useMemo(
    () => ({
      badge: isAr ? "وحدة الفواتير" : "Invoices Module",
      title: isAr ? "إدارة الفواتير" : "Invoices Management",
      subtitle: isAr
        ? "لوحة تشغيلية لمتابعة الفواتير، الحالات المالية، الضريبة، والتحصيل المرتبط بالطلبات."
        : "Operational dashboard for invoices, financial statuses, tax totals, and order-linked billing.",
      refresh: isAr ? "تحديث" : "Refresh",
      create: isAr ? "إنشاء فاتورة" : "Create Invoice",
      list: isAr ? "قائمة الفواتير" : "Invoices List",
      reports: isAr ? "تقارير الفواتير" : "Invoices Reports",
      details: isAr ? "التفاصيل" : "Details",
      issue: isAr ? "إصدار" : "Issue",
      search: isAr ? "ابحث برقم الفاتورة أو العميل أو الطلب..." : "Search by invoice, customer, or order...",
      latest: isAr ? "آخر الفواتير" : "Latest Invoices",
      latestDesc: isAr
        ? "آخر العمليات المسجلة من واجهة الفواتير."
        : "Latest records from the invoices API.",
      overview: isAr ? "ملخص الفواتير" : "Invoices Overview",
      overviewDesc: isAr
        ? "مؤشرات مباشرة مبنية على الفواتير الحالية."
        : "Live indicators based on current invoices.",
      empty: isAr ? "لا توجد فواتير مطابقة حاليًا." : "No matching invoices found.",
      loading: isAr ? "جاري تحميل بيانات الفواتير..." : "Loading invoices data...",
      totalInvoices: isAr ? "إجمالي الفواتير" : "Total Invoices",
      issuedInvoices: isAr ? "الفواتير المصدرة" : "Issued Invoices",
      paidInvoices: isAr ? "الفواتير المدفوعة" : "Paid Invoices",
      openInvoices: isAr ? "غير المسددة" : "Open Invoices",
      totalAmount: isAr ? "إجمالي الفواتير" : "Invoices Total",
      taxAmount: isAr ? "إجمالي الضريبة" : "Tax Total",
      draftInvoices: isAr ? "المسودات" : "Drafts",
      dueAmount: isAr ? "المتبقي" : "Due Amount",
      paidAmount: isAr ? "المدفوع" : "Paid Amount",
      activity: isAr ? "الحركة المالية" : "Financial Activity",
      activityDesc: isAr
        ? "قراءة سريعة لحالة الفواتير حسب المرحلة."
        : "Quick reading of invoice status distribution.",
      quickLinks: isAr ? "اختصارات الوحدة" : "Module Shortcuts",
      quickLinksDesc: isAr
        ? "تنقل سريع بين صفحات وحدة الفواتير."
        : "Fast navigation between invoice module pages.",
      invoice: isAr ? "الفاتورة" : "Invoice",
      customer: isAr ? "العميل" : "Customer",
      order: isAr ? "الطلب" : "Order",
      status: isAr ? "الحالة" : "Status",
      date: isAr ? "التاريخ" : "Date",
      amount: isAr ? "المبلغ" : "Amount",
      notAvailable: isAr ? "غير متاح" : "N/A",
      sar: isAr ? "ريال" : "SAR",
    }),
    [isAr]
  );

  const loadInvoices = async (mode: "initial" | "refresh" = "initial") => {
    try {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);

      const data = await fetchInvoices();

      setInvoices(data.invoices);
      setApiSummary(data.summary);
      setTotalCount(data.totalCount);

      if (mode === "refresh") {
        toast.success(isAr ? "تم تحديث بيانات الفواتير بنجاح" : "Invoices refreshed successfully");
      }
    } catch (error) {
      console.error(error);
      toast.error(isAr ? "تعذر تحميل بيانات الفواتير" : "Failed to load invoices");
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
    const keyword = search.trim().toLowerCase();

    if (!keyword) return invoices;

    return invoices.filter((invoice) => {
      const haystack = [
        getInvoiceNumber(invoice),
        invoice.status,
        invoice.invoice_type,
        invoice.customer?.name,
        invoice.customer?.phone,
        invoice.customer?.email,
        invoice.customer_id,
        invoice.order?.order_number,
        invoice.order?.status,
        invoice.order_id,
        invoice.total_amount,
        invoice.paid_amount,
        invoice.due_amount,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [invoices, search]);

  const stats = useMemo(() => {
    const totalInvoices = totalCount || invoices.length;

    const issuedInvoices = invoices.filter(
      (invoice) => String(invoice.status || "").toUpperCase() === "ISSUED"
    ).length;

    const paidInvoices = invoices.filter(
      (invoice) => String(invoice.status || "").toUpperCase() === "PAID"
    ).length;

    const draftInvoices = invoices.filter(
      (invoice) => String(invoice.status || "").toUpperCase() === "DRAFT"
    ).length;

    const openInvoices = invoices.filter((invoice) => {
      const status = String(invoice.status || "").toUpperCase();
      return ["DRAFT", "ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(status);
    }).length;

    const totalAmount =
      apiSummary?.total_amount !== undefined && apiSummary?.total_amount !== null
        ? toNumber(apiSummary.total_amount)
        : invoices.reduce((sum, invoice) => sum + toNumber(invoice.total_amount), 0);

    const taxAmount =
      apiSummary?.tax_amount !== undefined && apiSummary?.tax_amount !== null
        ? toNumber(apiSummary.tax_amount)
        : invoices.reduce((sum, invoice) => sum + toNumber(invoice.tax_amount), 0);

    const paidAmount =
      apiSummary?.paid_amount !== undefined && apiSummary?.paid_amount !== null
        ? toNumber(apiSummary.paid_amount)
        : invoices.reduce((sum, invoice) => sum + toNumber(invoice.paid_amount), 0);

    const dueAmount =
      apiSummary?.due_amount !== undefined && apiSummary?.due_amount !== null
        ? toNumber(apiSummary.due_amount)
        : invoices.reduce((sum, invoice) => sum + toNumber(invoice.due_amount), 0);

    return {
      totalInvoices,
      issuedInvoices,
      paidInvoices,
      draftInvoices,
      openInvoices,
      totalAmount,
      taxAmount,
      paidAmount,
      dueAmount,
    };
  }, [apiSummary, invoices, totalCount]);

  const latestInvoices = useMemo(() => filteredInvoices.slice(0, 8), [filteredInvoices]);

  const paidRate = useMemo(() => {
    if (!stats.totalInvoices) return 0;
    return Math.round((stats.paidInvoices / stats.totalInvoices) * 100);
  }, [stats.paidInvoices, stats.totalInvoices]);

  const issuedRate = useMemo(() => {
    if (!stats.totalInvoices) return 0;
    return Math.round((stats.issuedInvoices / stats.totalInvoices) * 100);
  }, [stats.issuedInvoices, stats.totalInvoices]);

  const openRate = useMemo(() => {
    if (!stats.totalInvoices) return 0;
    return Math.round((stats.openInvoices / stats.totalInvoices) * 100);
  }, [stats.openInvoices, stats.totalInvoices]);

  const statCards = [
    {
      title: t.totalInvoices,
      value: formatNumber(stats.totalInvoices),
      icon: ReceiptText,
      href: "/system/invoices/list",
      description: isAr ? "كل الفواتير المسجلة" : "All registered invoices",
    },
    {
      title: t.issuedInvoices,
      value: formatNumber(stats.issuedInvoices),
      icon: FileText,
      href: "/system/invoices/list?status=ISSUED",
      description: isAr ? "فواتير تم إصدارها" : "Invoices already issued",
    },
    {
      title: t.paidInvoices,
      value: formatNumber(stats.paidInvoices),
      icon: CheckCircle2,
      href: "/system/invoices/list?status=PAID",
      description: isAr ? "فواتير مسددة بالكامل" : "Fully paid invoices",
    },
    {
      title: t.openInvoices,
      value: formatNumber(stats.openInvoices),
      icon: Clock3,
      href: "/system/invoices/list",
      description: isAr ? "فواتير تحتاج متابعة" : "Invoices requiring follow-up",
    },
  ];

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* =====================================================
            HERO
        ===================================================== */}
        <section className="relative overflow-hidden rounded-[2rem] border bg-gradient-to-br from-background via-background to-muted/40 p-6 shadow-sm">
          <div className="pointer-events-none absolute -top-24 end-10 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 start-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <Badge
                variant="outline"
                className="w-fit rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-primary"
              >
                <Sparkles className="me-2 h-3.5 w-3.5" />
                {t.badge}
              </Badge>

              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                  {t.title}
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
                  {t.subtitle}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button asChild className="rounded-2xl">
                  <Link href="/system/invoices/create">
                    <Plus className="me-2 h-4 w-4" />
                    {t.create}
                  </Link>
                </Button>

                <Button asChild variant="outline" className="rounded-2xl">
                  <Link href="/system/invoices/list">
                    <FileText className="me-2 h-4 w-4" />
                    {t.list}
                  </Link>
                </Button>

                <Button asChild variant="ghost" className="rounded-2xl">
                  <Link href="/system/invoices/reports">
                    <BarChart3 className="me-2 h-4 w-4" />
                    {t.reports}
                  </Link>
                </Button>

                <Button
                  type="button"
                  variant="secondary"
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
              </div>
            </div>

            <Card className="w-full rounded-[1.5rem] border-primary/10 bg-card/80 shadow-sm backdrop-blur lg:max-w-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="h-5 w-5 text-primary" />
                  {t.totalAmount}
                </CardTitle>
                <CardDescription>{t.overviewDesc}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Image
                        src={SAR_ICON_PATH}
                        alt="SAR"
                        width={18}
                        height={18}
                        className="shrink-0"
                      />
                      <p className="text-3xl font-bold">
                        {formatMoney(stats.totalAmount)}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{t.sar}</p>
                  </div>

                  <Badge
                    variant="outline"
                    className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    {formatNumber(paidRate)}%
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">{t.taxAmount}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Image src={SAR_ICON_PATH} alt="SAR" width={14} height={14} />
                      <p className="font-semibold">{formatMoney(stats.taxAmount)}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">{t.dueAmount}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Image src={SAR_ICON_PATH} alt="SAR" width={14} height={14} />
                      <p className="font-semibold">{formatMoney(stats.dueAmount)}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">{t.paidAmount}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Image src={SAR_ICON_PATH} alt="SAR" width={14} height={14} />
                      <p className="font-semibold">{formatMoney(stats.paidAmount)}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">{t.draftInvoices}</p>
                    <p className="mt-1 font-semibold">{formatNumber(stats.draftInvoices)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* =====================================================
            STATS
        ===================================================== */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((item) => {
            const Icon = item.icon;

            return (
              <Link key={item.title} href={item.href} className="group">
                <Card className="h-full rounded-[1.5rem] transition hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="flex h-full items-center justify-between gap-4 p-5">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">{item.title}</p>
                      <p className="text-3xl font-bold tracking-tight">{item.value}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>

                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition group-hover:scale-105">
                      <Icon className="h-5 w-5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </section>

        {/* =====================================================
            CONTENT GRID
        ===================================================== */}
        <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
          <Card className="rounded-[1.5rem]">
            <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ReceiptText className="h-5 w-5 text-primary" />
                  {t.latest}
                </CardTitle>
                <CardDescription>{t.latestDesc}</CardDescription>
              </div>

              <div className="relative w-full md:max-w-xs">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t.search}
                  className="rounded-2xl ps-9"
                />
              </div>
            </CardHeader>

            <CardContent>
              {loading ? (
                <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                  <p className="text-sm">{t.loading}</p>
                </div>
              ) : latestInvoices.length === 0 ? (
                <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed bg-muted/20 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t.empty}</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-3xl border">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead className="bg-muted/50 text-xs text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-start font-medium">{t.invoice}</th>
                          <th className="px-4 py-3 text-start font-medium">{t.customer}</th>
                          <th className="px-4 py-3 text-start font-medium">{t.order}</th>
                          <th className="px-4 py-3 text-start font-medium">{t.status}</th>
                          <th className="px-4 py-3 text-start font-medium">{t.date}</th>
                          <th className="px-4 py-3 text-start font-medium">{t.amount}</th>
                          <th className="px-4 py-3 text-end font-medium">{t.details}</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y">
                        {latestInvoices.map((invoice) => (
                          <tr key={invoice.id} className="bg-card transition hover:bg-muted/30">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                  <ReceiptText className="h-4 w-4" />
                                </div>
                                <div>
                                  <p className="font-medium">{getInvoiceNumber(invoice)}</p>
                                  <p className="text-xs text-muted-foreground">
                                    ID: {invoice.id}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              {getCustomerName(invoice, t.notAvailable)}
                            </td>

                            <td className="px-4 py-3">
                              {getOrderNumber(invoice, t.notAvailable)}
                            </td>

                            <td className="px-4 py-3">
                              <Badge
                                variant="outline"
                                className={`rounded-full ${getStatusClassName(invoice.status)}`}
                              >
                                {getStatusLabel(invoice.status, locale)}
                              </Badge>
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <CalendarDays className="h-4 w-4" />
                                {formatDate(getInvoiceDate(invoice), locale)}
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 font-medium">
                                <Image
                                  src={SAR_ICON_PATH}
                                  alt="SAR"
                                  width={14}
                                  height={14}
                                />
                                {formatMoney(toNumber(invoice.total_amount))}
                              </div>
                            </td>

                            <td className="px-4 py-3 text-end">
                              <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                className="rounded-xl"
                              >
                                <Link href={`/system/invoices/${invoice.id}`}>
                                  {t.details}
                                  {isAr ? (
                                    <ArrowLeft className="ms-2 h-4 w-4" />
                                  ) : (
                                    <ArrowLeft className="ms-2 h-4 w-4 rotate-180" />
                                  )}
                                </Link>
                              </Button>
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

          <div className="space-y-6">
            <Card className="rounded-[1.5rem]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  {t.activity}
                </CardTitle>
                <CardDescription>{t.activityDesc}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <StatusProgress
                  label={t.paidInvoices}
                  value={paidRate}
                  count={stats.paidInvoices}
                />
                <StatusProgress
                  label={t.issuedInvoices}
                  value={issuedRate}
                  count={stats.issuedInvoices}
                />
                <StatusProgress
                  label={t.openInvoices}
                  value={openRate}
                  count={stats.openInvoices}
                />

                <div className="rounded-3xl border bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{t.taxAmount}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {isAr ? "إجمالي الضريبة المسجلة" : "Recorded tax total"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 font-bold">
                      <Image src={SAR_ICON_PATH} alt="SAR" width={15} height={15} />
                      {formatMoney(stats.taxAmount)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[1.5rem]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  {t.quickLinks}
                </CardTitle>
                <CardDescription>{t.quickLinksDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-3">
                <QuickLink
                  href="/system/invoices/list"
                  icon={FileText}
                  title={t.list}
                  description={isAr ? "استعراض الفواتير والفلترة" : "Browse and filter invoices"}
                />
                <QuickLink
                  href="/system/invoices/create"
                  icon={Plus}
                  title={t.create}
                  description={isAr ? "إنشاء فاتورة جديدة من طلب" : "Create a new invoice from an order"}
                />
                <QuickLink
                  href="/system/invoices/reports"
                  icon={BarChart3}
                  title={t.reports}
                  description={isAr ? "تحليلات وتصدير Excel" : "Analytics and Excel export"}
                />
                <QuickLink
                  href="/system/payments"
                  icon={Wallet}
                  title={isAr ? "المدفوعات" : "Payments"}
                  description={isAr ? "متابعة التحصيل والسداد" : "Track collections and payments"}
                />
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}

/* =====================================================
   SMALL COMPONENTS
===================================================== */

function StatusProgress({
  label,
  value,
  count,
}: {
  label: string;
  value: number;
  count: number;
}) {
  return (
    <div className="space-y-2 rounded-3xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BadgeCheck className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">{label}</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span>{formatNumber(count)}</span>
          <span className="text-muted-foreground">/</span>
          <span>{formatNumber(value)}%</span>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
        />
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof FileText;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 rounded-3xl border bg-card p-4 transition hover:-translate-y-0.5 hover:bg-muted/30 hover:shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary transition group-hover:scale-105">
          <Icon className="h-5 w-5" />
        </div>

        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      <ArrowDownUp className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
    </Link>
  );
}