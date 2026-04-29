"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  Download,
  FileText,
  Hash,
  Loader2,
  Printer,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  User,
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

/* =====================================================
   TYPES
===================================================== */

type AppLocale = "ar" | "en";

type RelatedCustomer = {
  id?: number | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
};

type RelatedInvoice = {
  id?: number | null;
  label?: string | null;
  status?: string | null;
  total_amount?: string | number | null;
};

type RelatedOrder = {
  id?: number | null;
  label?: string | null;
  status?: string | null;
};

type ApiPayment = {
  id: number;
  reference?: string | null;
  payment_number?: string | null;
  status?: string | null;
  payment_method?: string | null;
  method?: string | null;
  provider?: string | null;
  invoice_id?: number | null;
  order_id?: number | null;
  customer_id?: number | null;
  company_id?: number | null;
  amount?: string | number | null;
  paid_amount?: string | number | null;
  refunded_amount?: string | number | null;
  remaining_amount?: string | number | null;
  net_collected_amount?: string | number | null;
  currency?: string | null;
  external_reference?: string | null;
  transaction_id?: string | null;
  gateway_response_code?: string | null;
  gateway_message?: string | null;
  failure_reason?: string | null;
  treasury_movement_reference?: string | null;
  accounting_entry_reference?: string | null;
  is_treasury_posted?: boolean | null;
  is_accounting_posted?: boolean | null;
  payment_date?: string | null;
  paid_date?: string | null;
  date?: string | null;
  initiated_at?: string | null;
  paid_at?: string | null;
  confirmed_at?: string | null;
  refunded_at?: string | null;
  cancelled_at?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  invoice?: RelatedInvoice | null;
  order?: RelatedOrder | null;
  customer?: RelatedCustomer | null;
};

type PaymentDetailResponse = {
  ok?: boolean;
  payment?: ApiPayment;
  message?: string;
};

type ConfirmPaymentResponse = {
  ok?: boolean;
  message?: string;
  payment?: {
    id?: number;
    status?: string;
    status_before?: string;
    status_after?: string;
  };
  status_before?: string;
  status_after?: string;
  treasury?: {
    requested?: boolean;
    dispatched?: boolean;
    message?: string;
  };
  accounting?: {
    requested?: boolean;
    dispatched?: boolean;
    message?: string;
  };
};

type CancelPaymentResponse = {
  ok?: boolean;
  message?: string;
  payment?: {
    id?: number;
    payment_number?: string;
    status_before?: string;
    status_after?: string;
    cancelled_at?: string | null;
  };
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

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
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

function getPaymentReference(payment: ApiPayment | null): string {
  if (!payment) return "PAY";
  return payment.payment_number || payment.reference || `PAY-${payment.id}`;
}

function getPaymentMethod(payment: ApiPayment | null): string {
  if (!payment) return "OTHER";
  return String(payment.payment_method || payment.method || "OTHER").toUpperCase();
}

function getPaymentStatus(payment: ApiPayment | null): string {
  if (!payment) return "PENDING";
  return String(payment.status || "PENDING").toUpperCase();
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

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || "";

  return "";
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resolveCustomerName(payment: ApiPayment | null, fallback: string): string {
  if (!payment) return fallback;

  return (
    payment.customer?.name ||
    (payment.customer_id ? `#${payment.customer_id}` : fallback)
  );
}

function resolveInvoiceLabel(payment: ApiPayment | null, fallback: string): string {
  if (!payment) return fallback;

  return (
    payment.invoice?.label ||
    (payment.invoice_id ? `#${payment.invoice_id}` : fallback)
  );
}

function resolveOrderLabel(payment: ApiPayment | null, fallback: string): string {
  if (!payment) return fallback;

  return (
    payment.order?.label ||
    (payment.order_id ? `#${payment.order_id}` : fallback)
  );
}

function isConfirmableStatus(status: string): boolean {
  return status === "PENDING" || status === "PROCESSING";
}

function isCancelableStatus(status: string): boolean {
  return status === "PENDING" || status === "PROCESSING" || status === "FAILED";
}

/* =====================================================
   API HELPERS
===================================================== */

async function fetchPaymentDetail(paymentId: string): Promise<ApiPayment> {
  const response = await fetch(`/api/payments/${paymentId}/`, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as PaymentDetailResponse | null;

  if (!response.ok || !data?.ok || !data.payment) {
    throw new Error(data?.message || "Failed to load payment detail.");
  }

  return data.payment;
}

async function confirmPayment(paymentId: number): Promise<ConfirmPaymentResponse> {
  const csrfToken = getCookie("csrftoken");

  const response = await fetch(`/api/payments/${paymentId}/confirm/`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
    },
    body: JSON.stringify({
      auto_create_treasury_movement: true,
      auto_post_accounting: true,
    }),
  });

  const data = (await response.json().catch(() => null)) as ConfirmPaymentResponse | null;

  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || "Failed to confirm payment.");
  }

  return data;
}

async function cancelPayment(paymentId: number, reason: string): Promise<CancelPaymentResponse> {
  const csrfToken = getCookie("csrftoken");

  const response = await fetch(`/api/payments/${paymentId}/cancel/`, {
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

  const data = (await response.json().catch(() => null)) as CancelPaymentResponse | null;

  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || "Failed to cancel payment.");
  }

  return data;
}

/* =====================================================
   PAGE
===================================================== */

export default function SystemPaymentDetailPage() {
  const params = useParams<{ id: string }>();
  const paymentId = useMemo(() => String(params?.id || ""), [params?.id]);

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [payment, setPayment] = useState<ApiPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const isAr = locale === "ar";

  const t = useMemo(
    () => ({
      badge: isAr ? "تفاصيل الدفعة" : "Payment Detail",
      title: isAr ? "تفاصيل الدفعة" : "Payment Detail",
      subtitle: isAr
        ? "عرض كامل لبيانات الدفعة، الحالة، طريقة الدفع، الربط بالفاتورة والعميل، ومراجع الخزينة والمحاسبة."
        : "Full view of payment data, status, method, invoice/customer links, treasury and accounting references.",
      list: isAr ? "قائمة المدفوعات" : "Payments List",
      dashboard: isAr ? "لوحة المدفوعات" : "Payments Dashboard",
      reports: isAr ? "التقارير" : "Reports",
      refresh: isAr ? "تحديث" : "Refresh",
      confirm: isAr ? "تأكيد الدفعة" : "Confirm Payment",
      confirming: isAr ? "جاري التأكيد..." : "Confirming...",
      cancel: isAr ? "إلغاء الدفعة" : "Cancel Payment",
      cancelling: isAr ? "جاري الإلغاء..." : "Cancelling...",
      print: isAr ? "طباعة الإيصال" : "Print Receipt",
      exportExcel: isAr ? "تصدير Excel" : "Export Excel",
      copy: isAr ? "نسخ" : "Copy",
      copied: isAr ? "تم النسخ" : "Copied",
      paymentInfo: isAr ? "بيانات الدفعة" : "Payment Information",
      paymentInfoDesc: isAr
        ? "البيانات الأساسية والتشغيلية للدفعة."
        : "Core and operational data for this payment.",
      financialSummary: isAr ? "الملخص المالي" : "Financial Summary",
      financialSummaryDesc: isAr
        ? "المبلغ، المدفوع، المسترد، المتبقي، وصافي التحصيل."
        : "Amount, paid, refunded, remaining, and net collection.",
      linkedRecords: isAr ? "الارتباطات" : "Linked Records",
      linkedRecordsDesc: isAr
        ? "الطلب والفاتورة والعميل المرتبطين بالدفعة."
        : "Order, invoice, and customer linked to this payment.",
      postingInfo: isAr ? "الخزينة والمحاسبة" : "Treasury & Accounting",
      postingInfoDesc: isAr
        ? "حالة ترحيل الدفعة إلى الخزينة والمحاسبة."
        : "Payment posting status to treasury and accounting.",
      gatewayInfo: isAr ? "مراجع البنك / البوابة" : "Bank / Gateway References",
      gatewayInfoDesc: isAr
        ? "مراجع البنك أو بوابة الدفع والرسائل التشغيلية."
        : "Bank or payment gateway references and operational messages.",
      timeline: isAr ? "التتبع الزمني" : "Timeline",
      timelineDesc: isAr
        ? "تواريخ إنشاء وتحديث وتأكيد وإلغاء واسترداد الدفعة."
        : "Creation, update, confirmation, cancellation, and refund timestamps.",
      notes: isAr ? "الملاحظات" : "Notes",
      notesDesc: isAr ? "ملاحظات داخلية مرتبطة بالدفعة." : "Internal notes linked to this payment.",
      paymentReference: isAr ? "رقم الدفعة" : "Payment Reference",
      status: isAr ? "الحالة" : "Status",
      method: isAr ? "طريقة الدفع" : "Payment Method",
      provider: isAr ? "مزود الدفع" : "Provider",
      amount: isAr ? "المبلغ" : "Amount",
      paidAmount: isAr ? "المبلغ المدفوع" : "Paid Amount",
      refundedAmount: isAr ? "المبلغ المسترد" : "Refunded Amount",
      remainingAmount: isAr ? "المتبقي" : "Remaining",
      netAmount: isAr ? "الصافي" : "Net Amount",
      customer: isAr ? "العميل" : "Customer",
      invoice: isAr ? "الفاتورة" : "Invoice",
      order: isAr ? "الطلب" : "Order",
      company: isAr ? "الشركة" : "Company",
      externalReference: isAr ? "المرجع الخارجي" : "External Reference",
      transactionId: isAr ? "رقم العملية" : "Transaction ID",
      gatewayCode: isAr ? "كود البوابة" : "Gateway Code",
      gatewayMessage: isAr ? "رسالة البوابة" : "Gateway Message",
      failureReason: isAr ? "سبب الفشل" : "Failure Reason",
      treasuryPosted: isAr ? "تم ترحيل الخزينة" : "Treasury Posted",
      accountingPosted: isAr ? "تم الترحيل المحاسبي" : "Accounting Posted",
      treasuryReference: isAr ? "مرجع حركة الخزينة" : "Treasury Movement Reference",
      accountingReference: isAr ? "مرجع القيد المحاسبي" : "Accounting Entry Reference",
      posted: isAr ? "مرحل" : "Posted",
      notPosted: isAr ? "غير مرحل" : "Not Posted",
      initiatedAt: isAr ? "وقت البدء" : "Initiated At",
      paidAt: isAr ? "وقت السداد" : "Paid At",
      confirmedAt: isAr ? "وقت التأكيد" : "Confirmed At",
      refundedAt: isAr ? "وقت الاسترداد" : "Refunded At",
      cancelledAt: isAr ? "وقت الإلغاء" : "Cancelled At",
      createdAt: isAr ? "تاريخ الإنشاء" : "Created At",
      updatedAt: isAr ? "آخر تحديث" : "Updated At",
      notAvailable: isAr ? "غير متاح" : "N/A",
      loading: isAr ? "جاري تحميل تفاصيل الدفعة..." : "Loading payment detail...",
      loadError: isAr ? "تعذر تحميل تفاصيل الدفعة" : "Failed to load payment detail",
      refreshSuccess: isAr ? "تم تحديث تفاصيل الدفعة بنجاح" : "Payment detail refreshed successfully",
      confirmSuccess: isAr ? "تم تأكيد الدفعة بنجاح" : "Payment confirmed successfully",
      confirmError: isAr ? "تعذر تأكيد الدفعة" : "Failed to confirm payment",
      cancelSuccess: isAr ? "تم إلغاء الدفعة بنجاح" : "Payment cancelled successfully",
      cancelError: isAr ? "تعذر إلغاء الدفعة" : "Failed to cancel payment",
      cancelConfirm: isAr
        ? "هل تريد إلغاء هذه الدفعة؟ لا يتم حذف السجل، فقط تغيير الحالة إلى ملغي."
        : "Cancel this payment? The record will not be deleted, only marked as cancelled.",
      exportSuccess: isAr ? "تم تصدير بيانات الدفعة بنجاح" : "Payment data exported successfully",
      printTitle: isAr ? "إيصال دفعة" : "Payment Receipt",
      noNotes: isAr ? "لا توجد ملاحظات مسجلة." : "No notes recorded.",
      sar: isAr ? "ريال" : "SAR",
    }),
    [isAr]
  );

  const status = useMemo(() => getPaymentStatus(payment), [payment]);
  const method = useMemo(() => getPaymentMethod(payment), [payment]);
  const reference = useMemo(() => getPaymentReference(payment), [payment]);

  const canConfirm = useMemo(() => isConfirmableStatus(status), [status]);
  const canCancel = useMemo(() => isCancelableStatus(status), [status]);

  const money = useMemo(() => {
    const amount = toNumber(payment?.amount);
    const paidAmount = toNumber(payment?.paid_amount);
    const refundedAmount = toNumber(payment?.refunded_amount);
    const remainingAmount = payment?.remaining_amount
      ? toNumber(payment.remaining_amount)
      : Math.max(amount - paidAmount, 0);
    const netAmount = payment?.net_collected_amount
      ? toNumber(payment.net_collected_amount)
      : Math.max(paidAmount - refundedAmount, 0);

    return {
      amount,
      paidAmount,
      refundedAmount,
      remainingAmount,
      netAmount,
    };
  }, [payment]);

  const loadPayment = async (mode: "initial" | "refresh" = "initial") => {
    if (!paymentId) return;

    try {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);

      const data = await fetchPaymentDetail(paymentId);
      setPayment(data);

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
    loadPayment("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId]);

  const handleConfirm = async () => {
    if (!payment?.id) return;

    try {
      setConfirming(true);

      const result = await confirmPayment(payment.id);

      toast.success(result.message || t.confirmSuccess);

      await loadPayment("refresh");
    } catch (error) {
      console.error(error);
      toast.error(t.confirmError);
    } finally {
      setConfirming(false);
    }
  };

  const handleCancel = async () => {
    if (!payment?.id) return;

    const confirmed = window.confirm(t.cancelConfirm);
    if (!confirmed) return;

    try {
      setCancelling(true);

      const result = await cancelPayment(
        payment.id,
        isAr ? "تم الإلغاء من صفحة تفاصيل الدفعة." : "Cancelled from payment detail page."
      );

      toast.success(result.message || t.cancelSuccess);

      await loadPayment("refresh");
    } catch (error) {
      console.error(error);
      toast.error(t.cancelError);
    } finally {
      setCancelling(false);
    }
  };

  const copyValue = async (value: string | number | null | undefined) => {
    const text = String(value || "");
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      toast.success(t.copied);
    } catch {
      toast.error(isAr ? "تعذر النسخ" : "Failed to copy");
    }
  };

  const buildExportHtmlRows = () => {
    if (!payment) return "";

    const rows = [
      [t.paymentReference, reference],
      [t.status, getStatusLabel(status, locale)],
      [t.method, getMethodLabel(method, locale)],
      [t.provider, getProviderLabel(payment.provider, locale)],
      [t.amount, formatMoney(money.amount)],
      [t.paidAmount, formatMoney(money.paidAmount)],
      [t.refundedAmount, formatMoney(money.refundedAmount)],
      [t.remainingAmount, formatMoney(money.remainingAmount)],
      [t.netAmount, formatMoney(money.netAmount)],
      [t.customer, resolveCustomerName(payment, t.notAvailable)],
      [t.invoice, resolveInvoiceLabel(payment, t.notAvailable)],
      [t.order, resolveOrderLabel(payment, t.notAvailable)],
      [t.treasuryPosted, payment.is_treasury_posted ? t.posted : t.notPosted],
      [t.accountingPosted, payment.is_accounting_posted ? t.posted : t.notPosted],
      [t.treasuryReference, payment.treasury_movement_reference || t.notAvailable],
      [t.accountingReference, payment.accounting_entry_reference || t.notAvailable],
      [t.externalReference, payment.external_reference || t.notAvailable],
      [t.transactionId, payment.transaction_id || t.notAvailable],
      [t.gatewayCode, payment.gateway_response_code || t.notAvailable],
      [t.gatewayMessage, payment.gateway_message || t.notAvailable],
      [t.failureReason, payment.failure_reason || t.notAvailable],
      [t.initiatedAt, formatDateTime(payment.initiated_at, locale)],
      [t.paidAt, formatDateTime(payment.paid_at || payment.payment_date || payment.paid_date || payment.date, locale)],
      [t.confirmedAt, formatDateTime(payment.confirmed_at, locale)],
      [t.refundedAt, formatDateTime(payment.refunded_at, locale)],
      [t.cancelledAt, formatDateTime(payment.cancelled_at, locale)],
      [t.createdAt, formatDateTime(payment.created_at, locale)],
      [t.updatedAt, formatDateTime(payment.updated_at, locale)],
      [t.notes, payment.notes || t.noNotes],
    ];

    return rows
      .map(
        ([label, value]) =>
          `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
      )
      .join("");
  };

  const exportExcel = () => {
    if (!payment) return;

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
            table {
              border-collapse: collapse;
              width: 100%;
              margin-bottom: 24px;
            }
            th {
              background: #f1f5f9;
              color: #0f172a;
              font-weight: 700;
              border: 1px solid #cbd5e1;
              padding: 10px;
              text-align: ${isAr ? "right" : "left"};
              width: 35%;
            }
            td {
              border: 1px solid #cbd5e1;
              padding: 10px;
              text-align: ${isAr ? "right" : "left"};
            }
            .title {
              font-size: 20px;
              font-weight: 700;
              margin-bottom: 6px;
            }
            .meta {
              color: #475569;
              margin-bottom: 18px;
            }
          </style>
        </head>
        <body>
          <div class="title">${escapeHtml(t.printTitle)} - ${escapeHtml(reference)}</div>
          <div class="meta">${escapeHtml(generatedAt)}</div>

          <table>
            <tbody>
              ${buildExportHtmlRows()}
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
    link.download = `primey-care-payment-${payment.id}-${dateStamp}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(t.exportSuccess);
  };

  const printReceipt = () => {
    if (!payment) return;

    const printWindow = window.open("", "_blank", "width=1000,height=800");

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
          <title>${escapeHtml(t.printTitle)} - ${escapeHtml(reference)}</title>
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
            .receipt {
              max-width: 900px;
              margin: 0 auto;
              border: 1px solid #e2e8f0;
              border-radius: 24px;
              overflow: hidden;
            }
            .header {
              padding: 28px;
              background: #f8fafc;
              border-bottom: 1px solid #e2e8f0;
              display: flex;
              justify-content: space-between;
              gap: 20px;
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
            .status {
              display: inline-block;
              padding: 8px 14px;
              border-radius: 999px;
              background: #ecfdf5;
              color: #047857;
              font-weight: 700;
              font-size: 13px;
            }
            .content {
              padding: 28px;
            }
            .amount {
              padding: 20px;
              border-radius: 18px;
              background: #f1f5f9;
              margin-bottom: 22px;
            }
            .amount-label {
              color: #64748b;
              font-size: 13px;
              margin-bottom: 6px;
            }
            .amount-value {
              font-size: 34px;
              font-weight: 900;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 12px;
              margin-bottom: 22px;
            }
            .item {
              border: 1px solid #e2e8f0;
              border-radius: 14px;
              padding: 12px;
            }
            .label {
              color: #64748b;
              font-size: 12px;
              margin-bottom: 6px;
            }
            .value {
              font-weight: 700;
              word-break: break-word;
            }
            .notes {
              border: 1px solid #e2e8f0;
              border-radius: 14px;
              padding: 14px;
              background: #ffffff;
            }
            .footer {
              padding: 18px 28px;
              border-top: 1px solid #e2e8f0;
              color: #64748b;
              font-size: 12px;
              display: flex;
              justify-content: space-between;
              gap: 16px;
            }
            .no-print {
              margin-bottom: 20px;
            }
            @media print {
              body {
                padding: 16px;
              }
              .no-print {
                display: none;
              }
              .receipt {
                border-radius: 0;
              }
            }
          </style>
        </head>
        <body>
          <button class="no-print" onclick="window.print()">${escapeHtml(t.print)}</button>

          <div class="receipt">
            <div class="header">
              <div>
                <h1 class="title">${escapeHtml(t.printTitle)}</h1>
                <p class="subtitle">${escapeHtml(reference)}</p>
              </div>
              <div class="status">${escapeHtml(getStatusLabel(status, locale))}</div>
            </div>

            <div class="content">
              <div class="amount">
                <div class="amount-label">${escapeHtml(t.netAmount)}</div>
                <div class="amount-value">${escapeHtml(formatMoney(money.netAmount))} ${escapeHtml(t.sar)}</div>
              </div>

              <div class="grid">
                <div class="item">
                  <div class="label">${escapeHtml(t.paymentReference)}</div>
                  <div class="value">${escapeHtml(reference)}</div>
                </div>
                <div class="item">
                  <div class="label">${escapeHtml(t.method)}</div>
                  <div class="value">${escapeHtml(getMethodLabel(method, locale))}</div>
                </div>
                <div class="item">
                  <div class="label">${escapeHtml(t.provider)}</div>
                  <div class="value">${escapeHtml(getProviderLabel(payment.provider, locale))}</div>
                </div>
                <div class="item">
                  <div class="label">${escapeHtml(t.customer)}</div>
                  <div class="value">${escapeHtml(resolveCustomerName(payment, t.notAvailable))}</div>
                </div>
                <div class="item">
                  <div class="label">${escapeHtml(t.invoice)}</div>
                  <div class="value">${escapeHtml(resolveInvoiceLabel(payment, t.notAvailable))}</div>
                </div>
                <div class="item">
                  <div class="label">${escapeHtml(t.order)}</div>
                  <div class="value">${escapeHtml(resolveOrderLabel(payment, t.notAvailable))}</div>
                </div>
                <div class="item">
                  <div class="label">${escapeHtml(t.treasuryPosted)}</div>
                  <div class="value">${escapeHtml(payment.is_treasury_posted ? t.posted : t.notPosted)}</div>
                </div>
                <div class="item">
                  <div class="label">${escapeHtml(t.accountingPosted)}</div>
                  <div class="value">${escapeHtml(payment.is_accounting_posted ? t.posted : t.notPosted)}</div>
                </div>
                <div class="item">
                  <div class="label">${escapeHtml(t.transactionId)}</div>
                  <div class="value">${escapeHtml(payment.transaction_id || t.notAvailable)}</div>
                </div>
                <div class="item">
                  <div class="label">${escapeHtml(t.paidAt)}</div>
                  <div class="value">${escapeHtml(formatDateTime(payment.paid_at || payment.confirmed_at || payment.payment_date, locale))}</div>
                </div>
              </div>

              <div class="notes">
                <div class="label">${escapeHtml(t.notes)}</div>
                <div class="value">${escapeHtml(payment.notes || t.noNotes)}</div>
              </div>
            </div>

            <div class="footer">
              <span>Primey Care</span>
              <span>${escapeHtml(generatedAt)}</span>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
          <Card className="rounded-[1.5rem]">
            <CardContent className="flex min-h-96 flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">{t.loading}</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!payment) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
          <Card className="rounded-[1.5rem]">
            <CardContent className="flex min-h-96 flex-col items-center justify-center gap-3 text-center">
              <XCircle className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t.loadError}</p>
              <Button asChild variant="outline" className="rounded-2xl">
                <Link href="/system/payments/list">{t.list}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const statCards = [
    {
      title: t.amount,
      value: formatMoney(money.amount),
      icon: Wallet,
      money: true,
      description: t.sar,
    },
    {
      title: t.paidAmount,
      value: formatMoney(money.paidAmount),
      icon: CheckCircle2,
      money: true,
      description: t.sar,
    },
    {
      title: t.remainingAmount,
      value: formatMoney(money.remainingAmount),
      icon: Clock3,
      money: true,
      description: t.sar,
    },
    {
      title: t.netAmount,
      value: formatMoney(money.netAmount),
      icon: Banknote,
      money: true,
      description: t.sar,
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
                <CreditCard className="me-2 h-3.5 w-3.5" />
                {t.badge}
              </Badge>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                    {reference}
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
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild variant="outline" className="rounded-2xl">
                <Link href="/system/payments/list">
                  {isAr ? (
                    <ArrowLeft className="me-2 h-4 w-4" />
                  ) : (
                    <ArrowLeft className="me-2 h-4 w-4 rotate-180" />
                  )}
                  {t.list}
                </Link>
              </Button>

              <Button asChild variant="secondary" className="rounded-2xl">
                <Link href="/system/payments">
                  <CreditCard className="me-2 h-4 w-4" />
                  {t.dashboard}
                </Link>
              </Button>

              <Button asChild variant="ghost" className="rounded-2xl">
                <Link href="/system/payments/reports">
                  <BarChart3 className="me-2 h-4 w-4" />
                  {t.reports}
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <Card className="rounded-[1.5rem]">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full">
                ID: {payment.id}
              </Badge>

              <Badge variant="outline" className="rounded-full">
                {getMethodLabel(method, locale)}
              </Badge>

              <Badge variant="outline" className="rounded-full">
                {getProviderLabel(payment.provider, locale)}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canConfirm ? (
                <Button
                  type="button"
                  className="rounded-2xl"
                  onClick={handleConfirm}
                  disabled={confirming || cancelling}
                >
                  {confirming ? (
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  ) : (
                    <BadgeCheck className="me-2 h-4 w-4" />
                  )}
                  {confirming ? t.confirming : t.confirm}
                </Button>
              ) : null}

              {canCancel ? (
                <Button
                  type="button"
                  variant="destructive"
                  className="rounded-2xl"
                  onClick={handleCancel}
                  disabled={confirming || cancelling}
                >
                  {cancelling ? (
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="me-2 h-4 w-4" />
                  )}
                  {cancelling ? t.cancelling : t.cancel}
                </Button>
              ) : null}

              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={() => loadPayment("refresh")}
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
                onClick={printReceipt}
              >
                <Printer className="me-2 h-4 w-4" />
                {t.print}
              </Button>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => (
            <StatCard key={card.title} {...card} />
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <Card className="rounded-[1.5rem]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ReceiptText className="h-5 w-5 text-primary" />
                  {t.paymentInfo}
                </CardTitle>
                <CardDescription>{t.paymentInfoDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-3 md:grid-cols-2">
                <InfoItem
                  label={t.paymentReference}
                  value={reference}
                  icon={Hash}
                  onCopy={() => copyValue(reference)}
                  copyLabel={t.copy}
                />
                <InfoItem
                  label={t.status}
                  value={getStatusLabel(status, locale)}
                  icon={ShieldCheck}
                />
                <InfoItem
                  label={t.method}
                  value={getMethodLabel(method, locale)}
                  icon={CreditCard}
                />
                <InfoItem
                  label={t.provider}
                  value={getProviderLabel(payment.provider, locale)}
                  icon={Banknote}
                />
              </CardContent>
            </Card>

            <Card className="rounded-[1.5rem]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  {t.financialSummary}
                </CardTitle>
                <CardDescription>{t.financialSummaryDesc}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                <MoneyLine label={t.amount} value={money.amount} />
                <MoneyLine label={t.paidAmount} value={money.paidAmount} />
                <MoneyLine label={t.refundedAmount} value={money.refundedAmount} />
                <MoneyLine label={t.remainingAmount} value={money.remainingAmount} />
                <MoneyLine label={t.netAmount} value={money.netAmount} strong />
              </CardContent>
            </Card>

            <Card className="rounded-[1.5rem]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  {t.postingInfo}
                </CardTitle>
                <CardDescription>{t.postingInfoDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-3 md:grid-cols-2">
                <PostingItem
                  label={t.treasuryPosted}
                  value={payment.is_treasury_posted ? t.posted : t.notPosted}
                  isPosted={Boolean(payment.is_treasury_posted)}
                  icon={Wallet}
                />
                <PostingItem
                  label={t.accountingPosted}
                  value={payment.is_accounting_posted ? t.posted : t.notPosted}
                  isPosted={Boolean(payment.is_accounting_posted)}
                  icon={Banknote}
                />
                <InfoItem
                  label={t.treasuryReference}
                  value={payment.treasury_movement_reference || t.notAvailable}
                  icon={Hash}
                  onCopy={
                    payment.treasury_movement_reference
                      ? () => copyValue(payment.treasury_movement_reference)
                      : undefined
                  }
                  copyLabel={t.copy}
                />
                <InfoItem
                  label={t.accountingReference}
                  value={payment.accounting_entry_reference || t.notAvailable}
                  icon={Hash}
                  onCopy={
                    payment.accounting_entry_reference
                      ? () => copyValue(payment.accounting_entry_reference)
                      : undefined
                  }
                  copyLabel={t.copy}
                />
              </CardContent>
            </Card>

            <Card className="rounded-[1.5rem]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  {t.gatewayInfo}
                </CardTitle>
                <CardDescription>{t.gatewayInfoDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-3 md:grid-cols-2">
                <InfoItem
                  label={t.externalReference}
                  value={payment.external_reference || t.notAvailable}
                  icon={Hash}
                  onCopy={
                    payment.external_reference
                      ? () => copyValue(payment.external_reference)
                      : undefined
                  }
                  copyLabel={t.copy}
                />
                <InfoItem
                  label={t.transactionId}
                  value={payment.transaction_id || t.notAvailable}
                  icon={Hash}
                  onCopy={
                    payment.transaction_id
                      ? () => copyValue(payment.transaction_id)
                      : undefined
                  }
                  copyLabel={t.copy}
                />
                <InfoItem
                  label={t.gatewayCode}
                  value={payment.gateway_response_code || t.notAvailable}
                  icon={FileText}
                />
                <InfoItem
                  label={t.failureReason}
                  value={payment.failure_reason || t.notAvailable}
                  icon={XCircle}
                />

                <div className="md:col-span-2">
                  <InfoItem
                    label={t.gatewayMessage}
                    value={payment.gateway_message || t.notAvailable}
                    icon={ReceiptText}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[1.5rem]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {t.notes}
                </CardTitle>
                <CardDescription>{t.notesDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="rounded-3xl border bg-muted/20 p-4 text-sm leading-7 text-muted-foreground">
                  {payment.notes || t.noNotes}
                </div>
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-6">
            <Card className="rounded-[1.5rem]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  {t.linkedRecords}
                </CardTitle>
                <CardDescription>{t.linkedRecordsDesc}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                <LinkedRecord
                  label={t.customer}
                  value={resolveCustomerName(payment, t.notAvailable)}
                  href={
                    payment.customer_id
                      ? `/system/customers/${payment.customer_id}`
                      : undefined
                  }
                  icon={User}
                />
                <LinkedRecord
                  label={t.invoice}
                  value={resolveInvoiceLabel(payment, t.notAvailable)}
                  href={
                    payment.invoice_id
                      ? `/system/invoices/${payment.invoice_id}`
                      : undefined
                  }
                  icon={ReceiptText}
                />
                <LinkedRecord
                  label={t.order}
                  value={resolveOrderLabel(payment, t.notAvailable)}
                  href={
                    payment.order_id
                      ? `/system/orders/${payment.order_id}`
                      : undefined
                  }
                  icon={FileText}
                />
                <LinkedRecord
                  label={t.company}
                  value={payment.company_id ? `#${payment.company_id}` : t.notAvailable}
                  icon={ShieldCheck}
                />
              </CardContent>
            </Card>

            <Card className="rounded-[1.5rem]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock3 className="h-5 w-5 text-primary" />
                  {t.timeline}
                </CardTitle>
                <CardDescription>{t.timelineDesc}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                <TimelineItem
                  label={t.initiatedAt}
                  value={formatDateTime(payment.initiated_at, locale)}
                  icon={Clock3}
                />
                <TimelineItem
                  label={t.paidAt}
                  value={formatDateTime(
                    payment.paid_at || payment.payment_date || payment.paid_date || payment.date,
                    locale
                  )}
                  icon={CheckCircle2}
                />
                <TimelineItem
                  label={t.confirmedAt}
                  value={formatDateTime(payment.confirmed_at, locale)}
                  icon={BadgeCheck}
                />
                <TimelineItem
                  label={t.refundedAt}
                  value={formatDateTime(payment.refunded_at, locale)}
                  icon={RefreshCcw}
                />
                <TimelineItem
                  label={t.cancelledAt}
                  value={formatDateTime(payment.cancelled_at, locale)}
                  icon={XCircle}
                />
                <TimelineItem
                  label={t.createdAt}
                  value={formatDateTime(payment.created_at, locale)}
                  icon={CalendarDays}
                />
                <TimelineItem
                  label={t.updatedAt}
                  value={formatDateTime(payment.updated_at, locale)}
                  icon={CalendarDays}
                />
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

function MoneyLine({
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
        <Image
          src={SAR_ICON_PATH}
          alt="SAR"
          width={strong ? 17 : 14}
          height={strong ? 17 : 14}
        />
        {formatMoney(value)}
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
  icon: Icon,
  onCopy,
  copyLabel,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  onCopy?: () => void;
  copyLabel?: string;
}) {
  return (
    <div className="rounded-3xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 break-words text-sm font-semibold">{value}</p>
          </div>
        </div>

        {onCopy ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-xl px-2"
            onClick={onCopy}
          >
            <Copy className="me-1 h-3.5 w-3.5" />
            {copyLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function PostingItem({
  label,
  value,
  isPosted,
  icon: Icon,
}: {
  label: string;
  value: string;
  isPosted: boolean;
  icon: LucideIcon;
}) {
  return (
    <div
      className={`rounded-3xl border p-4 ${
        isPosted
          ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20"
          : "border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
            isPosted
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-sm font-semibold">{value}</p>
        </div>
      </div>
    </div>
  );
}

function LinkedRecord({
  label,
  value,
  href,
  icon: Icon,
}: {
  label: string;
  value: string;
  href?: string;
  icon: LucideIcon;
}) {
  const content = (
    <div className="group flex items-center justify-between gap-3 rounded-3xl border bg-card p-4 transition hover:bg-muted/30">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>

        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-sm font-semibold">{value}</p>
        </div>
      </div>

      {href ? <ArrowLeft className="h-4 w-4 text-muted-foreground group-hover:text-primary" /> : null}
    </div>
  );

  if (!href) return content;

  return <Link href={href}>{content}</Link>;
}

function TimelineItem({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-start gap-3 rounded-3xl border bg-card p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>

      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}