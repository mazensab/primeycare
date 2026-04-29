"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  Copy,
  CreditCard,
  Eye,
  FileText,
  Loader2,
  Mail,
  Phone,
  Printer,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  ShoppingCart,
  User,
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

type ApiInvoiceItem = {
  id: number;
  order_item_id?: number | null;
  title?: string | null;
  quantity?: number | null;
  unit_price?: string | number | null;
  discount_amount?: string | number | null;
  line_total?: string | number | null;
  sort_order?: number | null;
};

type ApiInvoicePayment = {
  id: number;
  payment_id?: number | null;
  payment_number?: string | null;
  amount_applied?: string | number | null;
  applied_at?: string | null;
  notes?: string | null;
};

type ApiInvoice = {
  id: number;
  invoice_number?: string | null;
  number?: string | null;
  invoice_type?: string | null;
  status?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  customer_id?: number | null;
  order_id?: number | null;
  customer?: ApiCustomer | null;
  order?: ApiOrder | null;
  items?: ApiInvoiceItem[];
  payments?: ApiInvoicePayment[];
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

type DetailApiResponse = {
  ok?: boolean;
  message?: string;
  invoice?: ApiInvoice;
};

type ActionApiResponse = {
  ok?: boolean;
  message?: string;
  invoice?: ApiInvoice;
  transition?: {
    status_before?: string | null;
    status_after?: string | null;
  };
  accounting?: {
    requested?: boolean;
    dispatched?: boolean;
    message?: string;
  };
};

type StatusMeta = {
  labelAr: string;
  labelEn: string;
  className: string;
};

type InvoiceTypeMeta = {
  labelAr: string;
  labelEn: string;
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

const INVOICE_TYPE_META: Record<string, InvoiceTypeMeta> = {
  SALES: {
    labelAr: "فاتورة مبيعات",
    labelEn: "Sales Invoice",
  },
  TAX: {
    labelAr: "فاتورة ضريبية",
    labelEn: "Tax Invoice",
  },
  SIMPLIFIED: {
    labelAr: "فاتورة مبسطة",
    labelEn: "Simplified Invoice",
  },
  CREDIT_NOTE: {
    labelAr: "إشعار دائن",
    labelEn: "Credit Note",
  },
  DEBIT_NOTE: {
    labelAr: "إشعار مدين",
    labelEn: "Debit Note",
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

function formatDateTime(value: string | null | undefined, locale: AppLocale): string {
  if (!value) return locale === "ar" ? "غير محدد" : "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return locale === "ar" ? "غير محدد" : "Not set";

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length !== 2) return "";

  return parts.pop()?.split(";").shift() || "";
}

function getInvoiceNumber(invoice: ApiInvoice): string {
  return invoice.invoice_number || invoice.number || `INV-${invoice.id}`;
}

function getOrderNumber(invoice: ApiInvoice, fallback: string): string {
  return invoice.order?.order_number || (invoice.order_id ? `#${invoice.order_id}` : fallback);
}

function getCustomerName(invoice: ApiInvoice, fallback: string): string {
  return invoice.customer?.name || (invoice.customer_id ? `#${invoice.customer_id}` : fallback);
}

function getStatusKey(status: string | null | undefined): string {
  return String(status || "DRAFT").toUpperCase();
}

function getStatusLabel(status: string | null | undefined, locale: AppLocale): string {
  const key = getStatusKey(status);
  const meta = STATUS_META[key];

  if (!meta) return status || (locale === "ar" ? "غير محدد" : "Unknown");

  return locale === "ar" ? meta.labelAr : meta.labelEn;
}

function getStatusClassName(status: string | null | undefined): string {
  const key = getStatusKey(status);
  return STATUS_META[key]?.className || STATUS_META.DRAFT.className;
}

function getInvoiceTypeLabel(type: string | null | undefined, locale: AppLocale): string {
  const key = String(type || "SALES").toUpperCase();
  const meta = INVOICE_TYPE_META[key];

  if (!meta) return type || (locale === "ar" ? "غير محدد" : "Unknown");

  return locale === "ar" ? meta.labelAr : meta.labelEn;
}

function canIssueInvoice(invoice: ApiInvoice): boolean {
  return getStatusKey(invoice.status) === "DRAFT";
}

function canCancelInvoice(invoice: ApiInvoice): boolean {
  const status = getStatusKey(invoice.status);
  const paidAmount = toNumber(invoice.paid_amount);

  return paidAmount <= 0 && !["PAID", "CANCELLED", "REFUNDED"].includes(status);
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
   API HELPERS
===================================================== */

async function fetchInvoiceDetail(invoiceId: string): Promise<ApiInvoice> {
  const response = await fetch(`/api/invoices/${invoiceId}/`, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as DetailApiResponse | null;

  if (!response.ok || !data?.ok || !data.invoice) {
    throw new Error(data?.message || "Failed to load invoice.");
  }

  return data.invoice;
}

async function issueInvoice(invoiceId: number): Promise<ActionApiResponse> {
  const csrfToken = getCookie("csrftoken");

  const response = await fetch(`/api/invoices/${invoiceId}/issue/`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
    },
    body: JSON.stringify({
      auto_post_accounting: true,
    }),
  });

  const data = (await response.json().catch(() => null)) as ActionApiResponse | null;

  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || "Failed to issue invoice.");
  }

  return data;
}

async function cancelInvoice(invoiceId: number, reason: string): Promise<ActionApiResponse> {
  const csrfToken = getCookie("csrftoken");

  const response = await fetch(`/api/invoices/${invoiceId}/cancel/`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
    },
    body: JSON.stringify({
      reason,
    }),
  });

  const data = (await response.json().catch(() => null)) as ActionApiResponse | null;

  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || "Failed to cancel invoice.");
  }

  return data;
}

/* =====================================================
   PAGE
===================================================== */

export default function InvoiceDetailsPage() {
  const params = useParams<{ id: string }>();
  const invoiceId = String(params?.id || "");

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [invoice, setInvoice] = useState<ApiInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const isAr = locale === "ar";

  const t = useMemo(
    () => ({
      badge: isAr ? "تفاصيل الفاتورة" : "Invoice Details",
      title: isAr ? "تفاصيل الفاتورة" : "Invoice Details",
      subtitle: isAr
        ? "عرض كامل للفاتورة، البنود، العميل، الطلب، المدفوعات، والملخص المالي."
        : "Full invoice view including items, customer, order, payments, and financial summary.",
      back: isAr ? "قائمة الفواتير" : "Invoices List",
      dashboard: isAr ? "لوحة الفواتير" : "Invoices Dashboard",
      reports: isAr ? "التقارير" : "Reports",
      refresh: isAr ? "تحديث" : "Refresh",
      print: isAr ? "طباعة Web PDF" : "Print Web PDF",
      issue: isAr ? "إصدار الفاتورة" : "Issue Invoice",
      issuing: isAr ? "جاري الإصدار..." : "Issuing...",
      cancel: isAr ? "إلغاء آمن" : "Safe Cancel",
      cancelling: isAr ? "جاري الإلغاء..." : "Cancelling...",
      registerPayment: isAr ? "تسجيل دفعة" : "Register Payment",
      loading: isAr ? "جاري تحميل تفاصيل الفاتورة..." : "Loading invoice details...",
      notFound: isAr ? "لم يتم العثور على الفاتورة." : "Invoice was not found.",
      loadError: isAr ? "تعذر تحميل تفاصيل الفاتورة" : "Failed to load invoice details",
      refreshSuccess: isAr ? "تم تحديث بيانات الفاتورة بنجاح" : "Invoice refreshed successfully",
      issueSuccess: isAr ? "تم إصدار الفاتورة بنجاح" : "Invoice issued successfully",
      issueError: isAr ? "تعذر إصدار الفاتورة" : "Failed to issue invoice",
      cancelSuccess: isAr ? "تم إلغاء الفاتورة بنجاح" : "Invoice cancelled successfully",
      cancelError: isAr ? "تعذر إلغاء الفاتورة" : "Failed to cancel invoice",
      copySuccess: isAr ? "تم النسخ بنجاح" : "Copied successfully",
      copyError: isAr ? "تعذر النسخ" : "Failed to copy",
      invoiceNumber: isAr ? "رقم الفاتورة" : "Invoice Number",
      invoiceType: isAr ? "نوع الفاتورة" : "Invoice Type",
      status: isAr ? "الحالة" : "Status",
      issueDate: isAr ? "تاريخ الإصدار" : "Issue Date",
      dueDate: isAr ? "تاريخ الاستحقاق" : "Due Date",
      createdAt: isAr ? "تاريخ الإنشاء" : "Created At",
      updatedAt: isAr ? "آخر تحديث" : "Updated At",
      customer: isAr ? "العميل" : "Customer",
      customerData: isAr ? "بيانات العميل" : "Customer Data",
      orderData: isAr ? "بيانات الطلب" : "Order Data",
      order: isAr ? "الطلب" : "Order",
      phone: isAr ? "الجوال" : "Phone",
      email: isAr ? "البريد" : "Email",
      orderStatus: isAr ? "حالة الطلب" : "Order Status",
      paymentStatus: isAr ? "حالة الدفع" : "Payment Status",
      fulfillmentStatus: isAr ? "حالة التنفيذ" : "Fulfillment Status",
      items: isAr ? "بنود الفاتورة" : "Invoice Items",
      item: isAr ? "البند" : "Item",
      quantity: isAr ? "الكمية" : "Quantity",
      unitPrice: isAr ? "سعر الوحدة" : "Unit Price",
      discount: isAr ? "الخصم" : "Discount",
      lineTotal: isAr ? "الإجمالي" : "Line Total",
      payments: isAr ? "المدفوعات المرتبطة" : "Linked Payments",
      paymentNumber: isAr ? "رقم الدفعة" : "Payment Number",
      amountApplied: isAr ? "المبلغ المربوط" : "Amount Applied",
      appliedAt: isAr ? "تاريخ الربط" : "Applied At",
      summary: isAr ? "ملخص مالي" : "Financial Summary",
      subtotal: isAr ? "الإجمالي قبل الخصم والضريبة" : "Subtotal",
      taxableAmount: isAr ? "الخاضع للضريبة" : "Taxable Amount",
      taxRate: isAr ? "نسبة الضريبة" : "Tax Rate",
      taxAmount: isAr ? "قيمة الضريبة" : "Tax Amount",
      totalAmount: isAr ? "الإجمالي النهائي" : "Total Amount",
      paidAmount: isAr ? "المبلغ المدفوع" : "Paid Amount",
      dueAmount: isAr ? "المبلغ المتبقي" : "Due Amount",
      notes: isAr ? "ملاحظات" : "Notes",
      internalNotes: isAr ? "ملاحظات داخلية" : "Internal Notes",
      noNotes: isAr ? "لا توجد ملاحظات." : "No notes.",
      noItems: isAr ? "لا توجد بنود مرتبطة بالفاتورة." : "No invoice items found.",
      noPayments: isAr ? "لا توجد مدفوعات مرتبطة بهذه الفاتورة." : "No linked payments found.",
      notAvailable: isAr ? "غير متاح" : "N/A",
      sar: isAr ? "ريال" : "SAR",
      cancelConfirm: isAr
        ? "هل تريد إلغاء هذه الفاتورة؟ لا يمكن إلغاء فاتورة عليها مبلغ مدفوع."
        : "Cancel this invoice? Paid invoices cannot be cancelled.",
    }),
    [isAr]
  );

  const loadInvoice = async (mode: "initial" | "refresh" = "initial") => {
    if (!invoiceId) return;

    try {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);

      const data = await fetchInvoiceDetail(invoiceId);
      setInvoice(data);

      if (mode === "refresh") toast.success(t.refreshSuccess);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : t.loadError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCopy = async (value: string | number | null | undefined) => {
    const resolvedValue = String(value || "");
    if (!resolvedValue) return;

    try {
      await navigator.clipboard.writeText(resolvedValue);
      toast.success(t.copySuccess);
    } catch {
      toast.error(t.copyError);
    }
  };

  const handleIssue = async () => {
    if (!invoice) return;

    try {
      setIssuing(true);
      const result = await issueInvoice(invoice.id);
      toast.success(result.message || t.issueSuccess);
      await loadInvoice("refresh");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : t.issueError);
    } finally {
      setIssuing(false);
    }
  };

  const handleCancel = async () => {
    if (!invoice) return;

    const confirmed = window.confirm(t.cancelConfirm);
    if (!confirmed) return;

    try {
      setCancelling(true);
      const result = await cancelInvoice(invoice.id, "Cancelled from invoice detail page.");
      toast.success(result.message || t.cancelSuccess);
      await loadInvoice("refresh");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : t.cancelError);
    } finally {
      setCancelling(false);
    }
  };

  const handlePrint = () => {
    window.print();
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
    loadInvoice("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-6">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">{t.loading}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!invoice) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-6">
          <Card className="w-full max-w-lg rounded-[1.5rem]">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <AlertTriangle className="h-12 w-12 text-amber-500" />
              <div>
                <h1 className="text-xl font-bold">{t.notFound}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{t.loadError}</p>
              </div>
              <Button asChild className="rounded-2xl">
                <Link href="/system/invoices/list">{t.back}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const invoiceNumber = getInvoiceNumber(invoice);
  const status = getStatusKey(invoice.status);
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const payments = Array.isArray(invoice.payments) ? invoice.payments : [];

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* =====================================================
            HERO
        ===================================================== */}
        <section className="relative overflow-hidden rounded-[2rem] border bg-gradient-to-br from-background via-background to-muted/40 p-6 shadow-sm print:border-0 print:shadow-none">
          <div className="pointer-events-none absolute -top-24 end-12 h-56 w-56 rounded-full bg-primary/10 blur-3xl print:hidden" />
          <div className="pointer-events-none absolute -bottom-28 start-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl print:hidden" />

          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <Badge
                variant="outline"
                className="w-fit rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-primary"
              >
                <ReceiptText className="me-2 h-3.5 w-3.5" />
                {t.badge}
              </Badge>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                    {invoiceNumber}
                  </h1>

                  <Badge
                    variant="outline"
                    className={`rounded-full ${getStatusClassName(status)}`}
                  >
                    {getStatusLabel(status, locale)}
                  </Badge>
                </div>

                <p className="max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
                  {t.subtitle}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {getCustomerName(invoice, t.notAvailable)}
                </span>

                <span className="inline-flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  {getOrderNumber(invoice, t.notAvailable)}
                </span>

                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  {formatDate(invoice.issue_date, locale)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <Button asChild variant="outline" className="rounded-2xl">
                <Link href="/system/invoices/list">
                  {isAr ? (
                    <ArrowLeft className="me-2 h-4 w-4" />
                  ) : (
                    <ArrowLeft className="me-2 h-4 w-4 rotate-180" />
                  )}
                  {t.back}
                </Link>
              </Button>

              <Button asChild variant="secondary" className="rounded-2xl">
                <Link href="/system/invoices">
                  <ReceiptText className="me-2 h-4 w-4" />
                  {t.dashboard}
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
                variant="outline"
                className="rounded-2xl"
                onClick={() => loadInvoice("refresh")}
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
                onClick={handlePrint}
              >
                <Printer className="me-2 h-4 w-4" />
                {t.print}
              </Button>
            </div>
          </div>
        </section>

        {/* =====================================================
            ACTIONS
        ===================================================== */}
        <section className="grid gap-3 md:grid-cols-3 print:hidden">
          {canIssueInvoice(invoice) ? (
            <Button
              type="button"
              className="h-12 rounded-2xl"
              onClick={handleIssue}
              disabled={issuing}
            >
              {issuing ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <BadgeCheck className="me-2 h-4 w-4" />
              )}
              {issuing ? t.issuing : t.issue}
            </Button>
          ) : (
            <Button type="button" className="h-12 rounded-2xl" disabled>
              <CheckCircle2 className="me-2 h-4 w-4" />
              {getStatusLabel(status, locale)}
            </Button>
          )}

          {canCancelInvoice(invoice) ? (
            <Button
              type="button"
              variant="destructive"
              className="h-12 rounded-2xl"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="me-2 h-4 w-4" />
              )}
              {cancelling ? t.cancelling : t.cancel}
            </Button>
          ) : (
            <Button type="button" variant="outline" className="h-12 rounded-2xl" disabled>
              <ShieldCheck className="me-2 h-4 w-4" />
              {t.cancel}
            </Button>
          )}

          <Button asChild variant="secondary" className="h-12 rounded-2xl">
            <Link
              href={`/system/payments/create?invoice_id=${invoice.id}&order_id=${invoice.order_id || ""}`}
            >
              <CreditCard className="me-2 h-4 w-4" />
              {t.registerPayment}
            </Link>
          </Button>
        </section>

        {/* =====================================================
            STATS
        ===================================================== */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title={t.totalAmount}
            value={<MoneyValue value={toNumber(invoice.total_amount)} />}
            description={t.sar}
            icon={ReceiptText}
          />

          <StatCard
            title={t.paidAmount}
            value={<MoneyValue value={toNumber(invoice.paid_amount)} />}
            description={isAr ? "إجمالي المدفوعات المرتبطة" : "Total linked payments"}
            icon={CheckCircle2}
          />

          <StatCard
            title={t.dueAmount}
            value={<MoneyValue value={toNumber(invoice.due_amount)} />}
            description={isAr ? "المبلغ المطلوب سداده" : "Amount still due"}
            icon={Wallet}
          />

          <StatCard
            title={t.taxAmount}
            value={<MoneyValue value={toNumber(invoice.tax_amount)} />}
            description={`${formatMoney(toNumber(invoice.tax_rate))}%`}
            icon={ShieldCheck}
          />
        </section>

        {/* =====================================================
            MAIN GRID
        ===================================================== */}
        <section className="grid gap-6 lg:grid-cols-[1.45fr_0.9fr]">
          <div className="space-y-6">
            <Card className="rounded-[1.5rem]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {t.items}
                </CardTitle>
                <CardDescription>
                  {formatNumber(items.length)} {t.items}
                </CardDescription>
              </CardHeader>

              <CardContent>
                {items.length === 0 ? (
                  <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed bg-muted/20 text-center">
                    <FileText className="h-10 w-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{t.noItems}</p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-3xl border">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] text-sm">
                        <thead className="bg-muted/50 text-xs text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 text-start font-medium">{t.item}</th>
                            <th className="px-4 py-3 text-start font-medium">{t.quantity}</th>
                            <th className="px-4 py-3 text-start font-medium">{t.unitPrice}</th>
                            <th className="px-4 py-3 text-start font-medium">{t.discount}</th>
                            <th className="px-4 py-3 text-start font-medium">{t.lineTotal}</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y">
                          {items.map((item) => (
                            <tr key={item.id} className="bg-card">
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-semibold">
                                    {item.title || `${t.item} #${item.id}`}
                                  </p>
                                  {item.order_item_id ? (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      Order item: {item.order_item_id}
                                    </p>
                                  ) : null}
                                </div>
                              </td>

                              <td className="px-4 py-3">
                                {formatNumber(Number(item.quantity || 1))}
                              </td>

                              <td className="px-4 py-3">
                                <MoneyValue value={toNumber(item.unit_price)} />
                              </td>

                              <td className="px-4 py-3">
                                <MoneyValue value={toNumber(item.discount_amount)} />
                              </td>

                              <td className="px-4 py-3">
                                <MoneyValue value={toNumber(item.line_total)} strong />
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

            <Card className="rounded-[1.5rem]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BadgeCheck className="h-5 w-5 text-primary" />
                  {t.invoiceNumber}
                </CardTitle>
              </CardHeader>

              <CardContent className="grid gap-4 md:grid-cols-2">
                <InfoRow
                  label={t.invoiceNumber}
                  value={
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 hover:text-primary"
                      onClick={() => handleCopy(invoiceNumber)}
                    >
                      {invoiceNumber}
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  }
                  icon={ReceiptText}
                />

                <InfoRow
                  label={t.invoiceType}
                  value={getInvoiceTypeLabel(invoice.invoice_type, locale)}
                  icon={FileText}
                />

                <InfoRow
                  label={t.status}
                  value={
                    <Badge
                      variant="outline"
                      className={`rounded-full ${getStatusClassName(status)}`}
                    >
                      {getStatusLabel(status, locale)}
                    </Badge>
                  }
                  icon={ShieldCheck}
                />

                <InfoRow
                  label={t.issueDate}
                  value={formatDate(invoice.issue_date, locale)}
                  icon={CalendarDays}
                />

                <InfoRow
                  label={t.dueDate}
                  value={formatDate(invoice.due_date, locale)}
                  icon={CalendarDays}
                />

                <InfoRow
                  label={t.createdAt}
                  value={formatDateTime(invoice.created_at, locale)}
                  icon={CalendarDays}
                />

                <InfoRow
                  label={t.updatedAt}
                  value={formatDateTime(invoice.updated_at, locale)}
                  icon={RefreshCcw}
                />

                <InfoRow
                  label={t.order}
                  value={
                    invoice.order_id ? (
                      <Link
                        href={`/system/orders/${invoice.order_id}`}
                        className="inline-flex items-center gap-2 hover:text-primary"
                      >
                        {getOrderNumber(invoice, t.notAvailable)}
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      t.notAvailable
                    )
                  }
                  icon={ShoppingCart}
                />
              </CardContent>
            </Card>

            <Card className="rounded-[1.5rem]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  {t.payments}
                </CardTitle>
                <CardDescription>
                  {formatNumber(payments.length)} {t.payments}
                </CardDescription>
              </CardHeader>

              <CardContent>
                {payments.length === 0 ? (
                  <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed bg-muted/20 text-center">
                    <CreditCard className="h-10 w-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{t.noPayments}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex flex-col gap-3 rounded-3xl border bg-card p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <p className="font-semibold">
                            {payment.payment_number || `PAY-${payment.payment_id || payment.id}`}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t.appliedAt}: {formatDateTime(payment.applied_at, locale)}
                          </p>
                          {payment.notes ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {payment.notes}
                            </p>
                          ) : null}
                        </div>

                        <MoneyValue value={toNumber(payment.amount_applied)} strong />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-6">
            <Card className="rounded-[1.5rem]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  {t.summary}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                <SummaryLine label={t.subtotal} value={toNumber(invoice.subtotal)} />
                <SummaryLine label={t.discount} value={toNumber(invoice.discount_amount)} />
                <SummaryLine label={t.taxableAmount} value={toNumber(invoice.taxable_amount)} />
                <SummaryLine label={t.taxAmount} value={toNumber(invoice.tax_amount)} />
                <SummaryLine label={t.paidAmount} value={toNumber(invoice.paid_amount)} />
                <SummaryLine label={t.dueAmount} value={toNumber(invoice.due_amount)} strong />

                <div className="rounded-3xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{t.totalAmount}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{t.sar}</p>
                    </div>
                    <MoneyValue value={toNumber(invoice.total_amount)} strong size="lg" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[1.5rem]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  {t.customerData}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                <InfoRow
                  label={t.customer}
                  value={getCustomerName(invoice, t.notAvailable)}
                  icon={User}
                />

                <InfoRow
                  label={t.phone}
                  value={
                    invoice.customer?.phone ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 hover:text-primary"
                        onClick={() => handleCopy(invoice.customer?.phone)}
                      >
                        {invoice.customer.phone}
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      t.notAvailable
                    )
                  }
                  icon={Phone}
                />

                <InfoRow
                  label={t.email}
                  value={
                    invoice.customer?.email ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 hover:text-primary"
                        onClick={() => handleCopy(invoice.customer?.email)}
                      >
                        {invoice.customer.email}
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      t.notAvailable
                    )
                  }
                  icon={Mail}
                />
              </CardContent>
            </Card>

            <Card className="rounded-[1.5rem]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  {t.orderData}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                <InfoRow
                  label={t.order}
                  value={getOrderNumber(invoice, t.notAvailable)}
                  icon={ShoppingCart}
                />

                <InfoRow
                  label={t.orderStatus}
                  value={invoice.order?.status || t.notAvailable}
                  icon={BadgeCheck}
                />

                <InfoRow
                  label={t.paymentStatus}
                  value={invoice.order?.payment_status || t.notAvailable}
                  icon={CreditCard}
                />

                <InfoRow
                  label={t.fulfillmentStatus}
                  value={invoice.order?.fulfillment_status || t.notAvailable}
                  icon={Building2}
                />
              </CardContent>
            </Card>

            <Card className="rounded-[1.5rem]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {t.notes}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="rounded-3xl border bg-muted/20 p-4 text-sm leading-7 text-muted-foreground">
                  {invoice.notes || t.noNotes}
                </div>

                {invoice.internal_notes ? (
                  <div className="rounded-3xl border bg-amber-50/60 p-4 text-sm leading-7 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                    <p className="mb-1 font-semibold">{t.internalNotes}</p>
                    {invoice.internal_notes}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </aside>
        </section>
      </div>
    </main>
  );
}

/* =====================================================
   SMALL COMPONENTS
===================================================== */

function MoneyValue({
  value,
  strong = false,
  size = "sm",
}: {
  value: number;
  strong?: boolean;
  size?: "sm" | "lg";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${
        strong ? "font-bold" : "font-semibold"
      } ${size === "lg" ? "text-2xl" : ""}`}
    >
      <Image src={SAR_ICON_PATH} alt="SAR" width={size === "lg" ? 20 : 15} height={size === "lg" ? 20 : 15} />
      {formatMoney(value)}
    </span>
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: ReactNode;
  description: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="rounded-[1.5rem]">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{title}</p>
          <div className="text-2xl font-bold tracking-tight">{value}</div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>

      <div className="min-w-0 max-w-[55%] truncate text-end text-sm font-semibold">
        {value}
      </div>
    </div>
  );
}

function SummaryLine({
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
      className={`flex items-center justify-between gap-3 rounded-2xl border p-3 ${
        strong ? "bg-muted/40" : "bg-card"
      }`}
    >
      <p className={`text-sm ${strong ? "font-semibold" : "text-muted-foreground"}`}>
        {label}
      </p>
      <MoneyValue value={value} strong={strong} />
    </div>
  );
}