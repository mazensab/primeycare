"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  BarChart3,
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  ReceiptText,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
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
import { Label } from "@/components/ui/label";

/* =====================================================
   TYPES
===================================================== */

type AppLocale = "ar" | "en";

type SourceType = "invoice" | "order";

type PaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "WALLET"
  | "APPLE_PAY"
  | "STC_PAY"
  | "TAMARA"
  | "TABBY"
  | "GATEWAY"
  | "OTHER";

type PaymentProvider =
  | "INTERNAL"
  | "TAP"
  | "TAMARA"
  | "TABBY"
  | "MANUAL"
  | "BANK"
  | "OTHER";

type ApiOrder = {
  id: number;
  number?: string | null;
  order_number?: string | null;
  reference?: string | null;
  status?: string | null;
  customer_id?: number | null;
  customer_name?: string | null;
  customer?: {
    id?: number;
    name?: string | null;
    full_name?: string | null;
  } | null;
  total_amount?: string | number | null;
  paid_amount?: string | number | null;
  due_amount?: string | number | null;
  remaining_amount?: string | number | null;
  subtotal?: string | number | null;
  tax_amount?: string | number | null;
  created_at?: string | null;
  order_date?: string | null;
};

type ApiInvoice = {
  id: number;
  invoice_number?: string | null;
  number?: string | null;
  reference?: string | null;
  status?: string | null;
  order_id?: number | null;
  customer_id?: number | null;
  customer_name?: string | null;
  customer?: {
    id?: number;
    name?: string | null;
    full_name?: string | null;
  } | null;
  total_amount?: string | number | null;
  grand_total?: string | number | null;
  amount?: string | number | null;
  paid_amount?: string | number | null;
  amount_paid?: string | number | null;
  remaining_amount?: string | number | null;
  due_amount?: string | number | null;
  created_at?: string | null;
  issued_at?: string | null;
  invoice_date?: string | null;
};

type OrdersApiResponse = {
  ok?: boolean;
  count?: number;
  results?: ApiOrder[];
  orders?: ApiOrder[];
  message?: string;
};

type InvoicesApiResponse = {
  ok?: boolean;
  count?: number;
  results?: ApiInvoice[];
  invoices?: ApiInvoice[];
  message?: string;
};

type CreatePaymentPayload = {
  invoice_id?: number;
  order_id?: number;
  customer_id: number | null;
  payment_method: PaymentMethod;
  provider: PaymentProvider;
  amount: string;
  paid_amount: string;
  currency: "SAR";
  external_reference: string;
  transaction_id: string;
  gateway_response_code: string;
  gateway_message: string;
  notes: string;
  confirm: boolean;
  auto_create_treasury_movement: boolean;
  auto_post_accounting: boolean;
};

type CreatePaymentResponse = {
  ok?: boolean;
  message?: string;
  payment?: {
    id?: number;
    reference?: string;
    payment_number?: string;
    status?: string;
  };
};

/* =====================================================
   CONSTANTS
===================================================== */

const SAR_ICON_PATH = "/currency/sar.svg";

const PAYMENT_METHODS: Array<{
  value: PaymentMethod;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
}> = [
  {
    value: "CASH",
    labelAr: "نقدي",
    labelEn: "Cash",
    descriptionAr: "تحصيل نقدي مباشر من العميل أو المندوب.",
    descriptionEn: "Direct cash collection from customer or agent.",
  },
  {
    value: "BANK_TRANSFER",
    labelAr: "تحويل بنكي",
    labelEn: "Bank Transfer",
    descriptionAr: "تحويل بنكي يحتاج مرجع عملية أو إيصال.",
    descriptionEn: "Bank transfer requiring a transaction reference or receipt.",
  },
  {
    value: "GATEWAY",
    labelAr: "بوابة دفع",
    labelEn: "Gateway",
    descriptionAr: "دفع عبر بوابة دفع إلكترونية.",
    descriptionEn: "Payment through an online gateway.",
  },
  {
    value: "CREDIT_CARD",
    labelAr: "بطاقة ائتمانية",
    labelEn: "Credit Card",
    descriptionAr: "دفع بالبطاقة الائتمانية.",
    descriptionEn: "Payment by credit card.",
  },
  {
    value: "DEBIT_CARD",
    labelAr: "بطاقة مدى / خصم",
    labelEn: "Debit Card",
    descriptionAr: "دفع ببطاقة الخصم أو مدى.",
    descriptionEn: "Payment by debit card or Mada.",
  },
  {
    value: "WALLET",
    labelAr: "محفظة",
    labelEn: "Wallet",
    descriptionAr: "دفع من محفظة رقمية.",
    descriptionEn: "Payment from a digital wallet.",
  },
  {
    value: "APPLE_PAY",
    labelAr: "Apple Pay",
    labelEn: "Apple Pay",
    descriptionAr: "دفع عبر Apple Pay.",
    descriptionEn: "Payment through Apple Pay.",
  },
  {
    value: "STC_PAY",
    labelAr: "STC Pay",
    labelEn: "STC Pay",
    descriptionAr: "دفع عبر STC Pay.",
    descriptionEn: "Payment through STC Pay.",
  },
  {
    value: "TAMARA",
    labelAr: "تمارا",
    labelEn: "Tamara",
    descriptionAr: "دفع عبر تمارا.",
    descriptionEn: "Payment through Tamara.",
  },
  {
    value: "TABBY",
    labelAr: "تابي",
    labelEn: "Tabby",
    descriptionAr: "دفع عبر تابي.",
    descriptionEn: "Payment through Tabby.",
  },
  {
    value: "OTHER",
    labelAr: "أخرى",
    labelEn: "Other",
    descriptionAr: "طريقة دفع أخرى.",
    descriptionEn: "Other payment method.",
  },
];

const PAYMENT_PROVIDERS: Array<{
  value: PaymentProvider;
  labelAr: string;
  labelEn: string;
}> = [
  { value: "INTERNAL", labelAr: "داخلي", labelEn: "Internal" },
  { value: "MANUAL", labelAr: "يدوي", labelEn: "Manual" },
  { value: "BANK", labelAr: "بنك", labelEn: "Bank" },
  { value: "TAP", labelAr: "Tap", labelEn: "Tap" },
  { value: "TAMARA", labelAr: "Tamara", labelEn: "Tamara" },
  { value: "TABBY", labelAr: "Tabby", labelEn: "Tabby" },
  { value: "OTHER", labelAr: "أخرى", labelEn: "Other" },
];

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

function normalizeDecimalInput(value: string): string {
  const normalized = value.replace(/[^\d.]/g, "");
  const parts = normalized.split(".");

  if (parts.length <= 2) return normalized;

  return `${parts[0]}.${parts.slice(1).join("")}`;
}

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || "";

  return "";
}

function resolveOrderNumber(order: ApiOrder): string {
  return order.number || order.order_number || order.reference || `ORD-${order.id}`;
}

function resolveInvoiceNumber(invoice: ApiInvoice): string {
  return (
    invoice.invoice_number ||
    invoice.number ||
    invoice.reference ||
    `INV-${invoice.id}`
  );
}

function resolveOrderCustomerName(order: ApiOrder, fallback: string): string {
  return (
    order.customer_name ||
    order.customer?.name ||
    order.customer?.full_name ||
    (order.customer_id ? `#${order.customer_id}` : fallback)
  );
}

function resolveInvoiceCustomerName(invoice: ApiInvoice, fallback: string): string {
  return (
    invoice.customer_name ||
    invoice.customer?.name ||
    invoice.customer?.full_name ||
    (invoice.customer_id ? `#${invoice.customer_id}` : fallback)
  );
}

function resolveOrderTotal(order: ApiOrder): number {
  return toNumber(order.total_amount);
}

function resolveOrderPaid(order: ApiOrder): number {
  return toNumber(order.paid_amount);
}

function resolveOrderDue(order: ApiOrder): number {
  const explicitDue = toNumber(order.due_amount ?? order.remaining_amount);

  if (explicitDue > 0) return explicitDue;

  const total = resolveOrderTotal(order);
  const paid = resolveOrderPaid(order);

  return Math.max(total - paid, 0);
}

function resolveInvoiceTotal(invoice: ApiInvoice): number {
  return toNumber(
    invoice.total_amount ||
      invoice.grand_total ||
      invoice.amount
  );
}

function resolveInvoicePaid(invoice: ApiInvoice): number {
  return toNumber(invoice.paid_amount || invoice.amount_paid);
}

function resolveInvoiceDue(invoice: ApiInvoice): number {
  const explicitDue = toNumber(invoice.remaining_amount || invoice.due_amount);

  if (explicitDue > 0) return explicitDue;

  const total = resolveInvoiceTotal(invoice);
  const paid = resolveInvoicePaid(invoice);

  return Math.max(total - paid, 0);
}

function getMethodLabel(method: PaymentMethod, locale: AppLocale): string {
  const item = PAYMENT_METHODS.find((option) => option.value === method);
  if (!item) return method;

  return locale === "ar" ? item.labelAr : item.labelEn;
}

function getProviderLabel(provider: PaymentProvider, locale: AppLocale): string {
  const item = PAYMENT_PROVIDERS.find((option) => option.value === provider);
  if (!item) return provider;

  return locale === "ar" ? item.labelAr : item.labelEn;
}

/* =====================================================
   API HELPERS
===================================================== */

async function fetchOrders(): Promise<ApiOrder[]> {
  const response = await fetch("/api/orders/?limit=200", {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as OrdersApiResponse | null;

  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || "Failed to load orders.");
  }

  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.orders)) return data.orders;

  return [];
}

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
    return [];
  }

  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.invoices)) return data.invoices;

  return [];
}

async function createPayment(
  payload: CreatePaymentPayload
): Promise<CreatePaymentResponse> {
  const csrfToken = getCookie("csrftoken");

  const response = await fetch("/api/payments/create/", {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as CreatePaymentResponse | null;

  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || "Payment create API failed.");
  }

  return data;
}

/* =====================================================
   PAGE
===================================================== */

export default function SystemPaymentCreatePage() {
  const [locale, setLocale] = useState<AppLocale>("ar");

  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [invoices, setInvoices] = useState<ApiInvoice[]>([]);

  const [loadingSources, setLoadingSources] = useState(true);
  const [refreshingSources, setRefreshingSources] = useState(false);
  const [saving, setSaving] = useState(false);

  const [sourceType, setSourceType] = useState<SourceType>("invoice");
  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [provider, setProvider] = useState<PaymentProvider>("MANUAL");
  const [amount, setAmount] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [gatewayResponseCode, setGatewayResponseCode] = useState("");
  const [gatewayMessage, setGatewayMessage] = useState("");
  const [notes, setNotes] = useState("");

  const [autoConfirm, setAutoConfirm] = useState(true);
  const [autoCreateTreasuryMovement, setAutoCreateTreasuryMovement] = useState(true);
  const [autoPostAccounting, setAutoPostAccounting] = useState(true);

  const isAr = locale === "ar";

  const t = useMemo(
    () => ({
      badge: isAr ? "تسجيل دفعة" : "Create Payment",
      title: isAr ? "تسجيل دفعة جديدة" : "Create New Payment",
      subtitle: isAr
        ? "اختر الفاتورة أو الطلب، حدد طريقة الدفع والمبلغ، ثم سجل الدفعة مع خيارات التأكيد والخزينة والمحاسبة."
        : "Select an invoice or order, set payment method and amount, then register the payment with confirmation, treasury, and accounting options.",
      back: isAr ? "قائمة المدفوعات" : "Payments List",
      dashboard: isAr ? "لوحة المدفوعات" : "Payments Dashboard",
      reports: isAr ? "التقارير" : "Reports",
      save: isAr ? "حفظ الدفعة" : "Save Payment",
      saving: isAr ? "جاري الحفظ..." : "Saving...",
      refresh: isAr ? "تحديث البيانات" : "Refresh Data",
      selectSource: isAr ? "اختيار مصدر الدفع" : "Select Payment Source",
      selectSourceDesc: isAr
        ? "الأفضل اختيار فاتورة حتى يتم الربط المباشر مع الفواتير والخزينة والمحاسبة."
        : "Selecting an invoice is preferred for direct invoice, treasury, and accounting linkage.",
      sourceInvoice: isAr ? "من فاتورة" : "From Invoice",
      sourceOrder: isAr ? "من طلب" : "From Order",
      searchSource: isAr
        ? "ابحث برقم الفاتورة أو الطلب أو العميل أو الحالة..."
        : "Search by invoice, order, customer, or status...",
      paymentData: isAr ? "بيانات الدفعة" : "Payment Data",
      paymentDataDesc: isAr
        ? "حدد طريقة الدفع والمبلغ والمراجع التشغيلية."
        : "Set payment method, amount, and operational references.",
      paymentMethod: isAr ? "طريقة الدفع" : "Payment Method",
      provider: isAr ? "مزود الدفع" : "Payment Provider",
      amount: isAr ? "المبلغ" : "Amount",
      externalReference: isAr ? "المرجع الخارجي" : "External Reference",
      transactionId: isAr ? "رقم العملية" : "Transaction ID",
      gatewayResponseCode: isAr ? "كود البوابة" : "Gateway Code",
      gatewayMessage: isAr ? "رسالة البوابة" : "Gateway Message",
      notes: isAr ? "ملاحظات" : "Notes",
      externalReferencePlaceholder: isAr
        ? "رقم التحويل أو مرجع مزود الدفع..."
        : "Transfer number or payment provider reference...",
      transactionIdPlaceholder: isAr
        ? "Transaction ID إن وجد..."
        : "Transaction ID if available...",
      gatewayCodePlaceholder: isAr
        ? "كود استجابة البوابة إن وجد..."
        : "Gateway response code if available...",
      gatewayMessagePlaceholder: isAr
        ? "رسالة البوابة أو البنك..."
        : "Gateway or bank message...",
      notesPlaceholder: isAr
        ? "ملاحظات داخلية عن عملية الدفع..."
        : "Internal notes about this payment...",
      autoConfirm: isAr ? "تأكيد الدفعة مباشرة" : "Confirm payment immediately",
      autoTreasury: isAr ? "إنشاء حركة خزينة تلقائيًا" : "Create treasury movement automatically",
      autoAccounting: isAr ? "ترحيل محاسبي تلقائي" : "Automatic accounting posting",
      sourceSummary: isAr ? "ملخص الدفع" : "Payment Summary",
      customer: isAr ? "العميل" : "Customer",
      order: isAr ? "الطلب" : "Order",
      invoice: isAr ? "الفاتورة" : "Invoice",
      status: isAr ? "الحالة" : "Status",
      date: isAr ? "التاريخ" : "Date",
      total: isAr ? "الإجمالي" : "Total",
      paid: isAr ? "مدفوع سابقًا" : "Already Paid",
      due: isAr ? "المتبقي" : "Due Amount",
      newDue: isAr ? "المتبقي بعد الدفعة" : "Due After Payment",
      notAvailable: isAr ? "غير متاح" : "N/A",
      noSources: isAr ? "لا توجد بيانات مطابقة حاليًا." : "No matching records found.",
      loadingSources: isAr ? "جاري تحميل الفواتير والطلبات..." : "Loading invoices and orders...",
      loadError: isAr ? "تعذر تحميل البيانات" : "Failed to load data",
      refreshSuccess: isAr ? "تم تحديث البيانات بنجاح" : "Data refreshed successfully",
      selectSourceError: isAr ? "اختر فاتورة أو طلبًا أولًا قبل تسجيل الدفعة" : "Select an invoice or order first",
      missingOrderError: isAr
        ? "الفاتورة المحددة لا تحتوي على طلب مرتبط. اختر طلبًا أو فاتورة مرتبطة بطلب."
        : "Selected invoice has no linked order. Select an order or an invoice linked to an order.",
      missingCustomerError: isAr
        ? "لا يوجد عميل مرتبط بهذا السجل"
        : "No customer is linked to this record",
      amountError: isAr ? "أدخل مبلغًا صحيحًا أكبر من صفر" : "Enter a valid amount greater than zero",
      amountMoreThanDueWarning: isAr
        ? "المبلغ أكبر من المتبقي"
        : "Amount is greater than due amount",
      createSuccess: isAr ? "تم تسجيل الدفعة بنجاح" : "Payment created successfully",
      createError: isAr ? "تعذر تسجيل الدفعة" : "Failed to create payment",
      sar: isAr ? "ريال" : "SAR",
    }),
    [isAr]
  );

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) || null,
    [orders, selectedOrderId]
  );

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === selectedInvoiceId) || null,
    [invoices, selectedInvoiceId]
  );

  const selectedMethod = useMemo(
    () =>
      PAYMENT_METHODS.find((item) => item.value === paymentMethod) ||
      PAYMENT_METHODS[0],
    [paymentMethod]
  );

  const filteredOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (sourceType !== "order") return [];
    if (!keyword) return orders;

    return orders.filter((order) => {
      const haystack = [
        order.id,
        resolveOrderNumber(order),
        order.status,
        order.customer_id,
        order.customer_name,
        order.customer?.name,
        order.customer?.full_name,
        order.total_amount,
        order.due_amount,
        order.remaining_amount,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [orders, search, sourceType]);

  const filteredInvoices = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (sourceType !== "invoice") return [];
    if (!keyword) return invoices;

    return invoices.filter((invoice) => {
      const haystack = [
        invoice.id,
        resolveInvoiceNumber(invoice),
        invoice.status,
        invoice.order_id,
        invoice.customer_id,
        invoice.customer_name,
        invoice.customer?.name,
        invoice.customer?.full_name,
        invoice.total_amount,
        invoice.grand_total,
        invoice.amount,
        invoice.remaining_amount,
        invoice.due_amount,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [invoices, search, sourceType]);

  const summary = useMemo(() => {
    if (sourceType === "invoice" && selectedInvoice) {
      const total = resolveInvoiceTotal(selectedInvoice);
      const paid = resolveInvoicePaid(selectedInvoice);
      const due = resolveInvoiceDue(selectedInvoice);
      const paymentAmount = toNumber(amount);
      const newDue = Math.max(due - paymentAmount, 0);

      return {
        total,
        paid,
        due,
        paymentAmount,
        newDue,
      };
    }

    if (sourceType === "order" && selectedOrder) {
      const total = resolveOrderTotal(selectedOrder);
      const paid = resolveOrderPaid(selectedOrder);
      const due = resolveOrderDue(selectedOrder);
      const paymentAmount = toNumber(amount);
      const newDue = Math.max(due - paymentAmount, 0);

      return {
        total,
        paid,
        due,
        paymentAmount,
        newDue,
      };
    }

    return {
      total: 0,
      paid: 0,
      due: 0,
      paymentAmount: toNumber(amount),
      newDue: 0,
    };
  }, [amount, selectedInvoice, selectedOrder, sourceType]);

  const activeRecordSelected =
    (sourceType === "invoice" && selectedInvoice) ||
    (sourceType === "order" && selectedOrder);

  const loadSources = async (mode: "initial" | "refresh" = "initial") => {
    try {
      if (mode === "initial") setLoadingSources(true);
      if (mode === "refresh") setRefreshingSources(true);

      const [ordersData, invoicesData] = await Promise.all([
        fetchOrders(),
        fetchInvoices(),
      ]);

      setOrders(ordersData);
      setInvoices(invoicesData);

      if (mode === "refresh") {
        toast.success(t.refreshSuccess);
      }
    } catch (error) {
      console.error(error);
      toast.error(t.loadError);
    } finally {
      setLoadingSources(false);
      setRefreshingSources(false);
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
    loadSources("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeRecordSelected) return;

    if (amount) return;

    if (summary.due > 0) {
      setAmount(summary.due.toFixed(2));
    }
  }, [activeRecordSelected, amount, summary.due]);

  useEffect(() => {
    if (paymentMethod === "CASH" || paymentMethod === "OTHER") {
      setProvider("MANUAL");
      return;
    }

    if (paymentMethod === "BANK_TRANSFER") {
      setProvider("BANK");
      return;
    }

    if (paymentMethod === "TAMARA") {
      setProvider("TAMARA");
      return;
    }

    if (paymentMethod === "TABBY") {
      setProvider("TABBY");
      return;
    }

    if (
      paymentMethod === "GATEWAY" ||
      paymentMethod === "CREDIT_CARD" ||
      paymentMethod === "DEBIT_CARD" ||
      paymentMethod === "APPLE_PAY" ||
      paymentMethod === "STC_PAY"
    ) {
      setProvider("TAP");
    }
  }, [paymentMethod]);

  const handleSourceTypeChange = (nextType: SourceType) => {
    setSourceType(nextType);
    setSelectedOrderId(null);
    setSelectedInvoiceId(null);
    setAmount("");
    setSearch("");
  };

  const validateForm = () => {
    if (!activeRecordSelected) {
      toast.error(t.selectSourceError);
      return false;
    }

    if (sourceType === "invoice" && selectedInvoice && !selectedInvoice.order_id) {
      toast.error(t.missingOrderError);
      return false;
    }

    const customerId =
      sourceType === "invoice"
        ? selectedInvoice?.customer_id || selectedInvoice?.customer?.id
        : selectedOrder?.customer_id || selectedOrder?.customer?.id;

    if (!customerId) {
      toast.error(t.missingCustomerError);
      return false;
    }

    const paymentAmount = toNumber(amount);
    if (paymentAmount <= 0) {
      toast.error(t.amountError);
      return false;
    }

    if (summary.due > 0 && paymentAmount > summary.due) {
      toast.warning(t.amountMoreThanDueWarning);
    }

    return true;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateForm()) return;

    try {
      setSaving(true);

      const paymentAmount = toNumber(amount).toFixed(2);

      const invoiceId =
        sourceType === "invoice" && selectedInvoice ? selectedInvoice.id : undefined;

      const orderId =
        sourceType === "invoice" && selectedInvoice
          ? selectedInvoice.order_id || undefined
          : selectedOrder?.id || undefined;

      const customerId =
        sourceType === "invoice"
          ? selectedInvoice?.customer_id || selectedInvoice?.customer?.id || null
          : selectedOrder?.customer_id || selectedOrder?.customer?.id || null;

      const payload: CreatePaymentPayload = {
        ...(invoiceId ? { invoice_id: invoiceId } : {}),
        ...(orderId ? { order_id: orderId } : {}),
        customer_id: customerId,
        payment_method: paymentMethod,
        provider,
        amount: paymentAmount,
        paid_amount: autoConfirm ? paymentAmount : "0.00",
        currency: "SAR",
        external_reference: externalReference.trim(),
        transaction_id: transactionId.trim(),
        gateway_response_code: gatewayResponseCode.trim(),
        gateway_message: gatewayMessage.trim(),
        notes: notes.trim(),
        confirm: autoConfirm,
        auto_create_treasury_movement: autoCreateTreasuryMovement,
        auto_post_accounting: autoPostAccounting,
      };

      const result = await createPayment(payload);

      toast.success(result.message || t.createSuccess);

      const paymentId = result.payment?.id;
      if (paymentId) {
        window.location.href = `/system/payments/${paymentId}`;
      } else {
        window.location.href = "/system/payments/list";
      }
    } catch (error) {
      console.error(error);
      toast.error(t.createError);
    } finally {
      setSaving(false);
    }
  };

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
                <Link href="/system/payments/list">
                  {isAr ? (
                    <ArrowLeft className="me-2 h-4 w-4" />
                  ) : (
                    <ArrowLeft className="me-2 h-4 w-4 rotate-180" />
                  )}
                  {t.back}
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

        <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
          <div className="space-y-6">
            <Card className="rounded-[1.5rem]">
              <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ReceiptText className="h-5 w-5 text-primary" />
                    {t.selectSource}
                  </CardTitle>
                  <CardDescription>{t.selectSourceDesc}</CardDescription>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => loadSources("refresh")}
                  disabled={refreshingSources}
                >
                  {refreshingSources ? (
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="me-2 h-4 w-4" />
                  )}
                  {t.refresh}
                </Button>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleSourceTypeChange("invoice")}
                    className={`rounded-3xl border p-4 text-start transition hover:-translate-y-0.5 hover:shadow-sm ${
                      sourceType === "invoice"
                        ? "border-primary bg-primary/5"
                        : "bg-card hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                          sourceType === "invoice"
                            ? "bg-primary text-primary-foreground"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold">{t.sourceInvoice}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {isAr
                            ? "ربط مباشر بالفاتورة"
                            : "Direct invoice linkage"}
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSourceTypeChange("order")}
                    className={`rounded-3xl border p-4 text-start transition hover:-translate-y-0.5 hover:shadow-sm ${
                      sourceType === "order"
                        ? "border-primary bg-primary/5"
                        : "bg-card hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                          sourceType === "order"
                            ? "bg-primary text-primary-foreground"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        <ShoppingCart className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold">{t.sourceOrder}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {isAr ? "ربط بالطلب فقط" : "Order-only linkage"}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t.searchSource}
                    className="rounded-2xl ps-9"
                  />
                </div>

                {loadingSources ? (
                  <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm">{t.loadingSources}</p>
                  </div>
                ) : sourceType === "invoice" ? (
                  filteredInvoices.length === 0 ? (
                    <EmptyState message={t.noSources} />
                  ) : (
                    <div className="grid max-h-[520px] gap-3 overflow-y-auto pe-1">
                      {filteredInvoices.map((invoice) => {
                        const isSelected = selectedInvoiceId === invoice.id;
                        const due = resolveInvoiceDue(invoice);

                        return (
                          <button
                            key={invoice.id}
                            type="button"
                            onClick={() => {
                              setSelectedInvoiceId(invoice.id);
                              setSelectedOrderId(null);
                              setAmount(due > 0 ? due.toFixed(2) : "");
                            }}
                            className={`w-full rounded-3xl border p-4 text-start transition hover:-translate-y-0.5 hover:shadow-sm ${
                              isSelected
                                ? "border-primary bg-primary/5 shadow-sm"
                                : "bg-card hover:bg-muted/30"
                            }`}
                          >
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                              <div className="flex items-start gap-3">
                                <div
                                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-primary/10 text-primary"
                                  }`}
                                >
                                  {isSelected ? (
                                    <CheckCircle2 className="h-5 w-5" />
                                  ) : (
                                    <ReceiptText className="h-5 w-5" />
                                  )}
                                </div>

                                <div className="space-y-1">
                                  <p className="font-semibold">
                                    {resolveInvoiceNumber(invoice)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {t.customer}:{" "}
                                    {resolveInvoiceCustomerName(invoice, t.notAvailable)}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2 pt-1">
                                    <Badge variant="secondary" className="rounded-full">
                                      ID: {invoice.id}
                                    </Badge>

                                    {invoice.order_id ? (
                                      <Badge variant="outline" className="rounded-full">
                                        {t.order}: #{invoice.order_id}
                                      </Badge>
                                    ) : null}

                                    {invoice.status ? (
                                      <Badge variant="outline" className="rounded-full">
                                        {invoice.status}
                                      </Badge>
                                    ) : null}
                                  </div>
                                </div>
                              </div>

                              <div className="grid gap-1 text-end">
                                <div className="flex items-center justify-end gap-2 font-bold">
                                  <Image src={SAR_ICON_PATH} alt="SAR" width={16} height={16} />
                                  {formatMoney(resolveInvoiceTotal(invoice))}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {t.due}: {formatMoney(due)}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )
                ) : filteredOrders.length === 0 ? (
                  <EmptyState message={t.noSources} />
                ) : (
                  <div className="grid max-h-[520px] gap-3 overflow-y-auto pe-1">
                    {filteredOrders.map((order) => {
                      const isSelected = selectedOrderId === order.id;
                      const due = resolveOrderDue(order);

                      return (
                        <button
                          key={order.id}
                          type="button"
                          onClick={() => {
                            setSelectedOrderId(order.id);
                            setSelectedInvoiceId(null);
                            setAmount(due > 0 ? due.toFixed(2) : "");
                          }}
                          className={`w-full rounded-3xl border p-4 text-start transition hover:-translate-y-0.5 hover:shadow-sm ${
                            isSelected
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "bg-card hover:bg-muted/30"
                          }`}
                        >
                          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-start gap-3">
                              <div
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-primary/10 text-primary"
                                }`}
                              >
                                {isSelected ? (
                                  <CheckCircle2 className="h-5 w-5" />
                                ) : (
                                  <ShoppingCart className="h-5 w-5" />
                                )}
                              </div>

                              <div className="space-y-1">
                                <p className="font-semibold">{resolveOrderNumber(order)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {t.customer}: {resolveOrderCustomerName(order, t.notAvailable)}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                  <Badge variant="secondary" className="rounded-full">
                                    ID: {order.id}
                                  </Badge>

                                  {order.status ? (
                                    <Badge variant="outline" className="rounded-full">
                                      {order.status}
                                    </Badge>
                                  ) : null}
                                </div>
                              </div>
                            </div>

                            <div className="grid gap-1 text-end">
                              <div className="flex items-center justify-end gap-2 font-bold">
                                <Image src={SAR_ICON_PATH} alt="SAR" width={16} height={16} />
                                {formatMoney(resolveOrderTotal(order))}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {t.due}: {formatMoney(due)}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[1.5rem]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  {t.paymentData}
                </CardTitle>
                <CardDescription>{t.paymentDataDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor="payment_method">{t.paymentMethod}</Label>
                    <select
                      id="payment_method"
                      value={paymentMethod}
                      onChange={(event) =>
                        setPaymentMethod(event.target.value as PaymentMethod)
                      }
                      className="h-11 rounded-2xl border border-input bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      {PAYMENT_METHODS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {isAr ? item.labelAr : item.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="provider">{t.provider}</Label>
                    <select
                      id="provider"
                      value={provider}
                      onChange={(event) =>
                        setProvider(event.target.value as PaymentProvider)
                      }
                      className="h-11 rounded-2xl border border-input bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      {PAYMENT_PROVIDERS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {isAr ? item.labelAr : item.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="amount">{t.amount}</Label>
                    <Input
                      id="amount"
                      value={amount}
                      onChange={(event) =>
                        setAmount(normalizeDecimalInput(event.target.value))
                      }
                      inputMode="decimal"
                      className="rounded-2xl"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="rounded-3xl border bg-muted/20 p-4">
                  <div className="flex items-start gap-3">
                    <BadgeCheck className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-semibold">
                        {isAr ? selectedMethod.labelAr : selectedMethod.labelEn}
                      </p>
                      <p className="mt-1 text-xs leading-6 text-muted-foreground">
                        {isAr
                          ? selectedMethod.descriptionAr
                          : selectedMethod.descriptionEn}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.provider}: {getProviderLabel(provider, locale)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="external_reference">{t.externalReference}</Label>
                    <Input
                      id="external_reference"
                      value={externalReference}
                      onChange={(event) => setExternalReference(event.target.value)}
                      placeholder={t.externalReferencePlaceholder}
                      className="rounded-2xl"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="transaction_id">{t.transactionId}</Label>
                    <Input
                      id="transaction_id"
                      value={transactionId}
                      onChange={(event) => setTransactionId(event.target.value)}
                      placeholder={t.transactionIdPlaceholder}
                      className="rounded-2xl"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="gateway_response_code">
                      {t.gatewayResponseCode}
                    </Label>
                    <Input
                      id="gateway_response_code"
                      value={gatewayResponseCode}
                      onChange={(event) =>
                        setGatewayResponseCode(event.target.value)
                      }
                      placeholder={t.gatewayCodePlaceholder}
                      className="rounded-2xl"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="gateway_message">{t.gatewayMessage}</Label>
                    <Input
                      id="gateway_message"
                      value={gatewayMessage}
                      onChange={(event) => setGatewayMessage(event.target.value)}
                      placeholder={t.gatewayMessagePlaceholder}
                      className="rounded-2xl"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="notes">{t.notes}</Label>
                  <textarea
                    id="notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder={t.notesPlaceholder}
                    className="min-h-32 rounded-2xl border border-input bg-background px-3 py-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <ToggleCard
                    checked={autoConfirm}
                    onChange={setAutoConfirm}
                    title={t.autoConfirm}
                    description={
                      isAr
                        ? "يتم اعتماد الدفعة كمدفوعة مباشرة عند الحفظ."
                        : "Marks the payment as paid immediately on save."
                    }
                    icon={CheckCircle2}
                  />

                  <ToggleCard
                    checked={autoCreateTreasuryMovement}
                    onChange={setAutoCreateTreasuryMovement}
                    title={t.autoTreasury}
                    description={
                      isAr
                        ? "يتم إنشاء حركة خزينة بعد نجاح الحفظ."
                        : "Creates treasury movement after successful save."
                    }
                    icon={Wallet}
                  />

                  <ToggleCard
                    checked={autoPostAccounting}
                    onChange={setAutoPostAccounting}
                    title={t.autoAccounting}
                    description={
                      isAr
                        ? "يتم جدولة الترحيل المحاسبي بعد نجاح الحفظ."
                        : "Schedules accounting posting after successful save."
                    }
                    icon={ShieldCheck}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-6">
            <Card className="sticky top-6 rounded-[1.5rem]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-primary" />
                  {t.sourceSummary}
                </CardTitle>
                <CardDescription>
                  {sourceType === "invoice" && selectedInvoice
                    ? resolveInvoiceNumber(selectedInvoice)
                    : sourceType === "order" && selectedOrder
                      ? resolveOrderNumber(selectedOrder)
                      : isAr
                        ? "اختر سجلًا لعرض ملخص الدفع"
                        : "Select a record to view payment summary"}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {activeRecordSelected ? (
                  <>
                    <div className="rounded-3xl border bg-muted/20 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          {sourceType === "invoice" ? (
                            <ReceiptText className="h-5 w-5" />
                          ) : (
                            <ShoppingCart className="h-5 w-5" />
                          )}
                        </div>

                        <div className="min-w-0 space-y-1">
                          <p className="truncate font-semibold">
                            {sourceType === "invoice" && selectedInvoice
                              ? resolveInvoiceNumber(selectedInvoice)
                              : selectedOrder
                                ? resolveOrderNumber(selectedOrder)
                                : t.notAvailable}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t.customer}:{" "}
                            {sourceType === "invoice" && selectedInvoice
                              ? resolveInvoiceCustomerName(selectedInvoice, t.notAvailable)
                              : selectedOrder
                                ? resolveOrderCustomerName(selectedOrder, t.notAvailable)
                                : t.notAvailable}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t.date}:{" "}
                            {sourceType === "invoice" && selectedInvoice
                              ? formatDate(
                                  selectedInvoice.invoice_date ||
                                    selectedInvoice.issued_at ||
                                    selectedInvoice.created_at,
                                  locale
                                )
                              : selectedOrder
                                ? formatDate(
                                    selectedOrder.order_date || selectedOrder.created_at,
                                    locale
                                  )
                                : t.notAvailable}
                          </p>
                        </div>
                      </div>
                    </div>

                    <SummaryLine label={t.total} value={summary.total} />
                    <SummaryLine label={t.paid} value={summary.paid} />
                    <SummaryLine label={t.due} value={summary.due} />

                    <div className="rounded-3xl border border-primary/20 bg-primary/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{t.amount}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {getMethodLabel(paymentMethod, locale)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 text-2xl font-bold">
                          <Image src={SAR_ICON_PATH} alt="SAR" width={20} height={20} />
                          {formatMoney(summary.paymentAmount)}
                        </div>
                      </div>
                    </div>

                    <SummaryLine label={t.newDue} value={summary.newDue} strong />

                    <Button
                      type="submit"
                      className="h-11 w-full rounded-2xl"
                      disabled={saving}
                    >
                      {saving ? (
                        <Loader2 className="me-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="me-2 h-4 w-4" />
                      )}
                      {saving ? t.saving : t.save}
                    </Button>
                  </>
                ) : (
                  <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed bg-muted/20 text-center">
                    <ReceiptText className="h-12 w-12 text-muted-foreground" />
                    <p className="max-w-xs text-sm leading-7 text-muted-foreground">
                      {isAr
                        ? "اختر فاتورة أو طلبًا من القائمة حتى يتم تجهيز ملخص الدفع قبل الحفظ."
                        : "Select an invoice or order from the list to prepare the payment summary before saving."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>
        </form>
      </div>
    </main>
  );
}

/* =====================================================
   SMALL COMPONENTS
===================================================== */

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed bg-muted/20 text-center">
      <CreditCard className="h-10 w-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
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
        strong ? "border-primary/20 bg-primary/5" : "bg-card"
      }`}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className={`flex items-center gap-1.5 ${strong ? "font-bold" : "font-semibold"}`}>
        <Image src={SAR_ICON_PATH} alt="SAR" width={14} height={14} />
        {formatMoney(value)}
      </div>
    </div>
  );
}

function ToggleCard({
  checked,
  onChange,
  title,
  description,
  icon: Icon,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`rounded-3xl border p-4 text-start transition hover:-translate-y-0.5 hover:shadow-sm ${
        checked ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
            checked ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
          }`}
        >
          {checked ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
        </div>

        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
    </button>
  );
}