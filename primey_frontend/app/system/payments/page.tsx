"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownUp,
  ArrowLeft,
  Banknote,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  Loader2,
  Plus,
  ReceiptText,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
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

type ApiPayment = {
  id: number;
  payment_number?: string | null;
  reference?: string | null;
  status?: string | null;
  payment_method?: string | null;
  provider?: string | null;
  currency?: string | null;
  invoice_id?: number | null;
  order_id?: number | null;
  customer_id?: number | null;
  customer_name?: string | null;
  amount?: string | number | null;
  paid_amount?: string | number | null;
  refunded_amount?: string | number | null;
  remaining_amount?: string | number | null;
  net_collected_amount?: string | number | null;
  payment_date?: string | null;
  initiated_at?: string | null;
  paid_at?: string | null;
  refunded_at?: string | null;
  cancelled_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  external_reference?: string | null;
  transaction_id?: string | null;
  treasury_movement_reference?: string | null;
  accounting_entry_reference?: string | null;
  is_treasury_posted?: boolean | null;
  is_accounting_posted?: boolean | null;
  notes?: string | null;
  failure_reason?: string | null;
};

type PaymentsApiResponse = {
  ok?: boolean;
  count?: number;
  total_count?: number;
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

function getPaymentDate(payment: ApiPayment): string | null {
  return (
    payment.paid_at ||
    payment.payment_date ||
    payment.created_at ||
    payment.initiated_at ||
    null
  );
}

function getPaymentReference(payment: ApiPayment): string {
  return payment.payment_number || payment.reference || `PAY-${payment.id}`;
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

function isPaidStatus(status: string | null | undefined): boolean {
  const current = String(status || "").toUpperCase();
  return current === "PAID" || current === "PARTIALLY_PAID";
}

function isPendingStatus(status: string | null | undefined): boolean {
  const current = String(status || "").toUpperCase();
  return current === "PENDING" || current === "PROCESSING";
}

function isRefundedStatus(status: string | null | undefined): boolean {
  const current = String(status || "").toUpperCase();
  return current === "REFUNDED" || current === "PARTIALLY_REFUNDED";
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
    throw new Error(data?.message || "Failed to load payments.");
  }

  return Array.isArray(data.results) ? data.results : [];
}

/* =====================================================
   PAGE
===================================================== */

export default function SystemPaymentsPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [payments, setPayments] = useState<ApiPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const isAr = locale === "ar";

  const t = useMemo(
    () => ({
      badge: isAr ? "وحدة المدفوعات" : "Payments Module",
      title: isAr ? "إدارة المدفوعات" : "Payments Management",
      subtitle: isAr
        ? "لوحة تشغيلية لمتابعة التحصيل، طرق الدفع، حالات العمليات، وربط المدفوعات بالفواتير والخزينة والمحاسبة."
        : "Operational dashboard for collections, payment methods, transaction statuses, and payment links to invoices, treasury, and accounting.",
      refresh: isAr ? "تحديث" : "Refresh",
      create: isAr ? "تسجيل دفعة" : "Create Payment",
      list: isAr ? "قائمة المدفوعات" : "Payments List",
      reports: isAr ? "تقارير المدفوعات" : "Payments Reports",
      invoices: isAr ? "الفواتير" : "Invoices",
      details: isAr ? "التفاصيل" : "Details",
      search: isAr
        ? "ابحث برقم الدفعة أو العميل أو الفاتورة أو طريقة الدفع..."
        : "Search by payment, customer, invoice, or method...",
      latest: isAr ? "آخر المدفوعات" : "Latest Payments",
      latestDesc: isAr
        ? "آخر العمليات المسجلة من واجهة المدفوعات."
        : "Latest records from the payments API.",
      overviewDesc: isAr
        ? "مؤشرات مباشرة مبنية على المدفوعات الحالية."
        : "Live indicators based on current payments.",
      empty: isAr ? "لا توجد مدفوعات مطابقة حاليًا." : "No matching payments found.",
      loading: isAr ? "جاري تحميل بيانات المدفوعات..." : "Loading payments data...",
      totalPayments: isAr ? "إجمالي المدفوعات" : "Total Payments",
      paidPayments: isAr ? "مدفوعات مؤكدة" : "Confirmed Payments",
      pendingPayments: isAr ? "قيد الانتظار" : "Pending Payments",
      failedPayments: isAr ? "عمليات فاشلة" : "Failed Payments",
      refundedPayments: isAr ? "عمليات مستردة" : "Refunded Payments",
      totalAmount: isAr ? "إجمالي التحصيل" : "Collected Total",
      pendingAmount: isAr ? "مبالغ معلقة" : "Pending Amount",
      failedAmount: isAr ? "مبالغ فاشلة" : "Failed Amount",
      treasuryPosted: isAr ? "مرحلة للخزينة" : "Treasury Posted",
      accountingPosted: isAr ? "مرحلة محاسبيًا" : "Accounting Posted",
      activity: isAr ? "الحركة المالية" : "Financial Activity",
      activityDesc: isAr
        ? "قراءة سريعة لحالة المدفوعات حسب المرحلة."
        : "Quick reading of payment status distribution.",
      methodReport: isAr ? "طرق الدفع" : "Payment Methods",
      methodReportDesc: isAr
        ? "توزيع المدفوعات حسب طريقة التحصيل."
        : "Payments distribution by collection method.",
      quickLinks: isAr ? "اختصارات الوحدة" : "Module Shortcuts",
      quickLinksDesc: isAr
        ? "تنقل سريع بين صفحات وحدة المدفوعات."
        : "Fast navigation between payment module pages.",
      payment: isAr ? "الدفعة" : "Payment",
      customer: isAr ? "العميل" : "Customer",
      invoice: isAr ? "الفاتورة" : "Invoice",
      method: isAr ? "الطريقة" : "Method",
      status: isAr ? "الحالة" : "Status",
      date: isAr ? "التاريخ" : "Date",
      amount: isAr ? "المبلغ" : "Amount",
      posted: isAr ? "مرحل" : "Posted",
      notAvailable: isAr ? "غير متاح" : "N/A",
      sar: isAr ? "ريال" : "SAR",
      refreshSuccess: isAr ? "تم تحديث بيانات المدفوعات بنجاح" : "Payments refreshed successfully",
      loadError: isAr ? "تعذر تحميل بيانات المدفوعات" : "Failed to load payments",
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
    const keyword = search.trim().toLowerCase();

    if (!keyword) return payments;

    return payments.filter((payment) => {
      const haystack = [
        payment.id,
        getPaymentReference(payment),
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
        payment.external_reference,
        payment.transaction_id,
        payment.treasury_movement_reference,
        payment.accounting_entry_reference,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [payments, search]);

  const stats = useMemo(() => {
    const totalPayments = payments.length;

    const paidPayments = payments.filter((payment) => isPaidStatus(payment.status)).length;

    const pendingPayments = payments.filter((payment) => isPendingStatus(payment.status)).length;

    const failedPayments = payments.filter(
      (payment) => String(payment.status || "").toUpperCase() === "FAILED"
    ).length;

    const refundedPayments = payments.filter((payment) =>
      isRefundedStatus(payment.status)
    ).length;

    const treasuryPosted = payments.filter((payment) => payment.is_treasury_posted).length;

    const accountingPosted = payments.filter((payment) => payment.is_accounting_posted).length;

    const totalAmount = payments.reduce((sum, payment) => {
      if (isPaidStatus(payment.status) || isRefundedStatus(payment.status)) {
        return sum + toNumber(payment.net_collected_amount ?? payment.paid_amount ?? payment.amount);
      }

      return sum;
    }, 0);

    const pendingAmount = payments.reduce((sum, payment) => {
      if (isPendingStatus(payment.status)) {
        return sum + toNumber(payment.remaining_amount ?? payment.amount);
      }

      return sum;
    }, 0);

    const failedAmount = payments.reduce((sum, payment) => {
      const status = String(payment.status || "").toUpperCase();
      if (status === "FAILED") return sum + toNumber(payment.amount);
      return sum;
    }, 0);

    return {
      totalPayments,
      paidPayments,
      pendingPayments,
      failedPayments,
      refundedPayments,
      treasuryPosted,
      accountingPosted,
      totalAmount,
      pendingAmount,
      failedAmount,
    };
  }, [payments]);

  const latestPayments = useMemo(() => filteredPayments.slice(0, 8), [filteredPayments]);

  const paidRate = useMemo(() => {
    if (!stats.totalPayments) return 0;
    return Math.round((stats.paidPayments / stats.totalPayments) * 100);
  }, [stats.paidPayments, stats.totalPayments]);

  const pendingRate = useMemo(() => {
    if (!stats.totalPayments) return 0;
    return Math.round((stats.pendingPayments / stats.totalPayments) * 100);
  }, [stats.pendingPayments, stats.totalPayments]);

  const failedRate = useMemo(() => {
    if (!stats.totalPayments) return 0;
    return Math.round((stats.failedPayments / stats.totalPayments) * 100);
  }, [stats.failedPayments, stats.totalPayments]);

  const methodRows = useMemo(() => {
    const map = new Map<string, { method: string; count: number; total: number }>();

    payments.forEach((payment) => {
      const method = String(payment.payment_method || "OTHER").toUpperCase();
      const existing = map.get(method) || { method, count: 0, total: 0 };

      existing.count += 1;
      existing.total += toNumber(payment.net_collected_amount ?? payment.paid_amount ?? payment.amount);

      map.set(method, existing);
    });

    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [payments]);

  const statCards = [
    {
      title: t.totalPayments,
      value: formatNumber(stats.totalPayments),
      icon: ReceiptText,
      href: "/system/payments/list",
      description: isAr ? "كل المدفوعات المسجلة" : "All registered payments",
    },
    {
      title: t.paidPayments,
      value: formatNumber(stats.paidPayments),
      icon: CheckCircle2,
      href: "/system/payments/list?status=PAID",
      description: isAr ? "مدفوعات مكتملة أو مؤكدة" : "Completed or confirmed payments",
    },
    {
      title: t.pendingPayments,
      value: formatNumber(stats.pendingPayments),
      icon: Clock3,
      href: "/system/payments/list?status=PENDING",
      description: isAr ? "مدفوعات تحتاج متابعة" : "Payments requiring follow-up",
    },
    {
      title: t.failedPayments,
      value: formatNumber(stats.failedPayments),
      icon: XCircle,
      href: "/system/payments/list?status=FAILED",
      description: isAr ? "عمليات لم تكتمل" : "Transactions not completed",
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
                  <Link href="/system/payments/create">
                    <Plus className="me-2 h-4 w-4" />
                    {t.create}
                  </Link>
                </Button>

                <Button asChild variant="outline" className="rounded-2xl">
                  <Link href="/system/payments/list">
                    <FileText className="me-2 h-4 w-4" />
                    {t.list}
                  </Link>
                </Button>

                <Button asChild variant="ghost" className="rounded-2xl">
                  <Link href="/system/payments/reports">
                    <BarChart3 className="me-2 h-4 w-4" />
                    {t.reports}
                  </Link>
                </Button>

                <Button
                  type="button"
                  variant="secondary"
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
                    <p className="text-xs text-muted-foreground">{t.pendingAmount}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Image src={SAR_ICON_PATH} alt="SAR" width={14} height={14} />
                      <p className="font-semibold">{formatMoney(stats.pendingAmount)}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">{t.refundedPayments}</p>
                    <p className="mt-1 font-semibold">
                      {formatNumber(stats.refundedPayments)}
                    </p>
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
                  <CreditCard className="h-5 w-5 text-primary" />
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
              ) : latestPayments.length === 0 ? (
                <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed bg-muted/20 text-center">
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
                          <th className="px-4 py-3 text-start font-medium">{t.method}</th>
                          <th className="px-4 py-3 text-start font-medium">{t.status}</th>
                          <th className="px-4 py-3 text-start font-medium">{t.posted}</th>
                          <th className="px-4 py-3 text-start font-medium">{t.date}</th>
                          <th className="px-4 py-3 text-start font-medium">{t.amount}</th>
                          <th className="px-4 py-3 text-end font-medium">{t.details}</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y">
                        {latestPayments.map((payment) => {
                          const status = String(payment.status || "PENDING").toUpperCase();

                          return (
                            <tr key={payment.id} className="bg-card transition hover:bg-muted/30">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                    <CreditCard className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <p className="font-medium">
                                      {getPaymentReference(payment)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      ID: {payment.id}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className="px-4 py-3">
                                {payment.customer_name ||
                                  (payment.customer_id ? `#${payment.customer_id}` : t.notAvailable)}
                              </td>

                              <td className="px-4 py-3">
                                {payment.invoice_id ? `#${payment.invoice_id}` : t.notAvailable}
                              </td>

                              <td className="px-4 py-3">
                                <Badge variant="secondary" className="rounded-full">
                                  {getMethodLabel(payment.payment_method, locale)}
                                </Badge>
                              </td>

                              <td className="px-4 py-3">
                                <Badge
                                  variant="outline"
                                  className={`rounded-full ${getStatusClassName(status)}`}
                                >
                                  {getStatusLabel(status, locale)}
                                </Badge>
                              </td>

                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1.5">
                                  <Badge
                                    variant="outline"
                                    className={
                                      payment.is_treasury_posted
                                        ? "rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                                        : "rounded-full border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                                    }
                                  >
                                    {isAr ? "خزينة" : "Treasury"}
                                  </Badge>

                                  <Badge
                                    variant="outline"
                                    className={
                                      payment.is_accounting_posted
                                        ? "rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                                        : "rounded-full border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                                    }
                                  >
                                    {isAr ? "محاسبة" : "Accounting"}
                                  </Badge>
                                </div>
                              </td>

                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <CalendarDays className="h-4 w-4" />
                                  {formatDate(getPaymentDate(payment), locale)}
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
                                  {formatMoney(
                                    toNumber(
                                      payment.net_collected_amount ??
                                        payment.paid_amount ??
                                        payment.amount
                                    )
                                  )}
                                </div>
                              </td>

                              <td className="px-4 py-3 text-end">
                                <Button
                                  asChild
                                  variant="ghost"
                                  size="sm"
                                  className="rounded-xl"
                                >
                                  <Link href={`/system/payments/${payment.id}`}>
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
                          );
                        })}
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
                  label={t.paidPayments}
                  value={paidRate}
                  count={stats.paidPayments}
                  icon={CheckCircle2}
                />
                <StatusProgress
                  label={t.pendingPayments}
                  value={pendingRate}
                  count={stats.pendingPayments}
                  icon={Clock3}
                />
                <StatusProgress
                  label={t.failedPayments}
                  value={failedRate}
                  count={stats.failedPayments}
                  icon={XCircle}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border bg-muted/20 p-4">
                    <p className="text-sm font-medium">{t.treasuryPosted}</p>
                    <p className="mt-2 text-2xl font-bold">{formatNumber(stats.treasuryPosted)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isAr ? "دفعات تم ربطها بالخزينة" : "Payments linked to treasury"}
                    </p>
                  </div>

                  <div className="rounded-3xl border bg-muted/20 p-4">
                    <p className="text-sm font-medium">{t.accountingPosted}</p>
                    <p className="mt-2 text-2xl font-bold">
                      {formatNumber(stats.accountingPosted)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isAr ? "دفعات تم ترحيلها محاسبيًا" : "Payments posted to accounting"}
                    </p>
                  </div>
                </div>

                <div className="rounded-3xl border bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{t.failedAmount}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {isAr ? "إجمالي عمليات لم تكتمل" : "Total incomplete transactions"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 font-bold">
                      <Image src={SAR_ICON_PATH} alt="SAR" width={15} height={15} />
                      {formatMoney(stats.failedAmount)}
                    </div>
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
                {methodRows.length === 0 ? (
                  <div className="rounded-3xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                    {t.empty}
                  </div>
                ) : (
                  methodRows.map((row) => (
                    <div key={row.method} className="rounded-3xl border bg-card p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <CreditCard className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">
                              {getMethodLabel(row.method, locale)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatNumber(row.count)} {t.totalPayments}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 font-bold">
                          <Image src={SAR_ICON_PATH} alt="SAR" width={14} height={14} />
                          {formatMoney(row.total)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
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
                  href="/system/payments/list"
                  icon={FileText}
                  title={t.list}
                  description={isAr ? "استعراض المدفوعات والفلترة" : "Browse and filter payments"}
                />
                <QuickLink
                  href="/system/payments/create"
                  icon={Plus}
                  title={t.create}
                  description={isAr ? "تسجيل عملية دفع جديدة" : "Register a new payment"}
                />
                <QuickLink
                  href="/system/payments/reports"
                  icon={BarChart3}
                  title={t.reports}
                  description={isAr ? "تحليلات وتصدير Excel" : "Analytics and Excel export"}
                />
                <QuickLink
                  href="/system/invoices"
                  icon={ReceiptText}
                  title={t.invoices}
                  description={isAr ? "متابعة الفواتير المرتبطة" : "Track linked invoices"}
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
  icon: Icon,
}: {
  label: string;
  value: number;
  count: number;
  icon: LucideIcon;
}) {
  return (
    <div className="space-y-2 rounded-3xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
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
  icon: LucideIcon;
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