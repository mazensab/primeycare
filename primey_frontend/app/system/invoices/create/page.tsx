"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  ReceiptText,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  ShoppingCart,
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
import { Label } from "@/components/ui/label";

/* =====================================================
   TYPES
===================================================== */

type AppLocale = "ar" | "en";

type InvoiceType =
  | "SALES"
  | "TAX"
  | "SIMPLIFIED"
  | "CREDIT_NOTE"
  | "DEBIT_NOTE";

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
  subtotal?: string | number | null;
  tax_amount?: string | number | null;
  discount_amount?: string | number | null;
  created_at?: string | null;
  order_date?: string | null;
};

type OrdersApiResponse = {
  ok?: boolean;
  count?: number;
  results?: ApiOrder[];
  orders?: ApiOrder[];
  message?: string;
};

type CreateInvoicePayload = {
  order_id: number;
  invoice_type: InvoiceType;
  issue_date: string;
  due_date: string;
  tax_rate: string;
  notes: string;
  internal_notes: string;
  auto_issue: boolean;
  auto_post_accounting: boolean;
};

type CreateInvoiceResponse = {
  ok?: boolean;
  message?: string;
  invoice?: {
    id?: number;
    number?: string;
    invoice_number?: string;
    status?: string;
  };
};

/* =====================================================
   CONSTANTS
===================================================== */

const SAR_ICON_PATH = "/currency/sar.svg";

const INVOICE_TYPES: Array<{
  value: InvoiceType;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
}> = [
  {
    value: "SALES",
    labelAr: "فاتورة مبيعات",
    labelEn: "Sales Invoice",
    descriptionAr: "فاتورة مبيعات عادية مرتبطة بطلب.",
    descriptionEn: "Standard sales invoice linked to an order.",
  },
  {
    value: "TAX",
    labelAr: "فاتورة ضريبية",
    labelEn: "Tax Invoice",
    descriptionAr: "فاتورة ضريبية كاملة مع ضريبة القيمة المضافة.",
    descriptionEn: "Full tax invoice with VAT.",
  },
  {
    value: "SIMPLIFIED",
    labelAr: "فاتورة مبسطة",
    labelEn: "Simplified Invoice",
    descriptionAr: "فاتورة مبسطة للعمليات السريعة.",
    descriptionEn: "Simplified invoice for quick transactions.",
  },
  {
    value: "CREDIT_NOTE",
    labelAr: "إشعار دائن",
    labelEn: "Credit Note",
    descriptionAr: "إشعار لتخفيض أو عكس قيمة مستحقة.",
    descriptionEn: "Note used to reduce or reverse an amount.",
  },
  {
    value: "DEBIT_NOTE",
    labelAr: "إشعار مدين",
    labelEn: "Debit Note",
    descriptionAr: "إشعار لإضافة مبلغ مستحق.",
    descriptionEn: "Note used to add a payable amount.",
  },
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

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIsoDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || "";

  return "";
}

function resolveOrderNumber(order: ApiOrder): string {
  return (
    order.number ||
    order.order_number ||
    order.reference ||
    `ORD-${order.id}`
  );
}

function resolveCustomerName(order: ApiOrder, fallback: string): string {
  return (
    order.customer_name ||
    order.customer?.name ||
    order.customer?.full_name ||
    (order.customer_id ? `#${order.customer_id}` : fallback)
  );
}

function resolveOrderTotal(order: ApiOrder): number {
  return toNumber(order.total_amount);
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

async function createInvoice(payload: CreateInvoicePayload): Promise<CreateInvoiceResponse> {
  const csrfToken = getCookie("csrftoken");

  const response = await fetch("/api/invoices/create/", {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as CreateInvoiceResponse | null;

  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || "Invoice create API is not available.");
  }

  return data;
}

/* =====================================================
   PAGE
===================================================== */

export default function SystemInvoiceCreatePage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [refreshingOrders, setRefreshingOrders] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const [invoiceType, setInvoiceType] = useState<InvoiceType>("SALES");
  const [issueDate, setIssueDate] = useState(todayIsoDate());
  const [dueDate, setDueDate] = useState(addDaysIsoDate(7));
  const [taxRate, setTaxRate] = useState("15.00");
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [autoIssue, setAutoIssue] = useState(true);
  const [autoPostAccounting, setAutoPostAccounting] = useState(true);

  const isAr = locale === "ar";

  const t = useMemo(
    () => ({
      badge: isAr ? "إنشاء فاتورة" : "Create Invoice",
      title: isAr ? "إنشاء فاتورة جديدة" : "Create New Invoice",
      subtitle: isAr
        ? "اختر الطلب، راجع بيانات العميل والمبالغ، ثم أنشئ الفاتورة بنفس دورة الفوترة الرسمية."
        : "Select an order, review customer and amounts, then create the invoice using the official billing flow.",
      back: isAr ? "قائمة الفواتير" : "Invoices List",
      dashboard: isAr ? "لوحة الفواتير" : "Invoices Dashboard",
      reports: isAr ? "التقارير" : "Reports",
      save: isAr ? "حفظ الفاتورة" : "Save Invoice",
      saving: isAr ? "جاري الحفظ..." : "Saving...",
      refresh: isAr ? "تحديث الطلبات" : "Refresh Orders",
      selectOrder: isAr ? "اختيار الطلب" : "Select Order",
      selectOrderDesc: isAr
        ? "ابحث واختر الطلب الذي سيتم إنشاء الفاتورة له."
        : "Search and select the order to create an invoice for.",
      searchOrder: isAr
        ? "ابحث برقم الطلب أو العميل أو الحالة..."
        : "Search by order number, customer, or status...",
      invoiceData: isAr ? "بيانات الفاتورة" : "Invoice Data",
      invoiceDataDesc: isAr
        ? "حدد نوع الفاتورة والتواريخ وخيارات الإصدار."
        : "Set invoice type, dates, and issue options.",
      invoiceType: isAr ? "نوع الفاتورة" : "Invoice Type",
      issueDate: isAr ? "تاريخ الإصدار" : "Issue Date",
      dueDate: isAr ? "تاريخ الاستحقاق" : "Due Date",
      taxRate: isAr ? "نسبة الضريبة" : "Tax Rate",
      notes: isAr ? "ملاحظات" : "Notes",
      internalNotes: isAr ? "ملاحظات داخلية" : "Internal Notes",
      notesPlaceholder: isAr
        ? "ملاحظات تظهر على الفاتورة..."
        : "Notes shown on the invoice...",
      internalNotesPlaceholder: isAr
        ? "ملاحظات داخلية لا تظهر للعميل..."
        : "Internal notes not shown to the customer...",
      autoIssue: isAr ? "إصدار الفاتورة مباشرة" : "Issue invoice immediately",
      autoPostAccounting: isAr
        ? "ترحيل محاسبي تلقائي"
        : "Automatic accounting posting",
      orderSummary: isAr ? "ملخص الطلب" : "Order Summary",
      customer: isAr ? "العميل" : "Customer",
      order: isAr ? "الطلب" : "Order",
      status: isAr ? "الحالة" : "Status",
      date: isAr ? "التاريخ" : "Date",
      subtotal: isAr ? "قبل الضريبة" : "Subtotal",
      tax: isAr ? "الضريبة" : "Tax",
      discount: isAr ? "الخصم" : "Discount",
      total: isAr ? "الإجمالي" : "Total",
      notAvailable: isAr ? "غير متاح" : "N/A",
      noOrders: isAr ? "لا توجد طلبات مطابقة حاليًا." : "No matching orders found.",
      loadingOrders: isAr ? "جاري تحميل الطلبات..." : "Loading orders...",
      loadError: isAr ? "تعذر تحميل الطلبات" : "Failed to load orders",
      refreshSuccess: isAr ? "تم تحديث الطلبات بنجاح" : "Orders refreshed successfully",
      selectOrderError: isAr ? "اختر طلبًا أولًا قبل إنشاء الفاتورة" : "Select an order first",
      issueDateError: isAr ? "تاريخ الإصدار مطلوب" : "Issue date is required",
      dueDateError: isAr
        ? "تاريخ الاستحقاق يجب أن يكون بعد أو مساويًا لتاريخ الإصدار"
        : "Due date must be after or equal to issue date",
      taxRateError: isAr ? "نسبة الضريبة غير صحيحة" : "Invalid tax rate",
      createSuccess: isAr ? "تم إنشاء الفاتورة بنجاح" : "Invoice created successfully",
      createApiMissing: isAr
        ? "واجهة إنشاء الفاتورة غير مفعّلة في الباكند حاليًا. الصفحة جاهزة وتحتاج إضافة API الإنشاء."
        : "Invoice create API is not active in backend yet. The page is ready and needs the create API.",
      sar: isAr ? "ريال" : "SAR",
    }),
    [isAr]
  );

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) || null,
    [orders, selectedOrderId]
  );

  const filteredOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase();

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
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [orders, search]);

  const selectedInvoiceType = useMemo(
    () => INVOICE_TYPES.find((item) => item.value === invoiceType) || INVOICE_TYPES[0],
    [invoiceType]
  );

  const summary = useMemo(() => {
    const subtotal = selectedOrder ? toNumber(selectedOrder.subtotal) : 0;
    const discount = selectedOrder ? toNumber(selectedOrder.discount_amount) : 0;
    const existingTax = selectedOrder ? toNumber(selectedOrder.tax_amount) : 0;
    const total = selectedOrder ? resolveOrderTotal(selectedOrder) : 0;

    const normalizedSubtotal = subtotal || Math.max(total - existingTax, 0);
    const tax =
      existingTax ||
      (normalizedSubtotal > 0
        ? (normalizedSubtotal * Math.max(0, toNumber(taxRate))) / 100
        : 0);

    const normalizedTotal = total || Math.max(normalizedSubtotal - discount + tax, 0);

    return {
      subtotal: normalizedSubtotal,
      discount,
      tax,
      total: normalizedTotal,
    };
  }, [selectedOrder, taxRate]);

  const loadOrders = async (mode: "initial" | "refresh" = "initial") => {
    try {
      if (mode === "initial") setLoadingOrders(true);
      if (mode === "refresh") setRefreshingOrders(true);

      const data = await fetchOrders();
      setOrders(data);

      if (mode === "refresh") {
        toast.success(t.refreshSuccess);
      }
    } catch (error) {
      console.error(error);
      toast.error(t.loadError);
    } finally {
      setLoadingOrders(false);
      setRefreshingOrders(false);
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
    loadOrders("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateForm = () => {
    if (!selectedOrderId) {
      toast.error(t.selectOrderError);
      return false;
    }

    if (!issueDate) {
      toast.error(t.issueDateError);
      return false;
    }

    if (dueDate && issueDate && new Date(dueDate) < new Date(issueDate)) {
      toast.error(t.dueDateError);
      return false;
    }

    const parsedTaxRate = toNumber(taxRate);
    if (parsedTaxRate < 0 || parsedTaxRate > 100) {
      toast.error(t.taxRateError);
      return false;
    }

    return true;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateForm() || !selectedOrderId) return;

    try {
      setSaving(true);

      const payload: CreateInvoicePayload = {
        order_id: selectedOrderId,
        invoice_type: invoiceType,
        issue_date: issueDate,
        due_date: dueDate,
        tax_rate: taxRate || "15.00",
        notes,
        internal_notes: internalNotes,
        auto_issue: autoIssue,
        auto_post_accounting: autoPostAccounting,
      };

      const result = await createInvoice(payload);

      toast.success(result.message || t.createSuccess);

      const invoiceId = result.invoice?.id;
      if (invoiceId) {
        window.location.href = `/system/invoices/${invoiceId}`;
      } else {
        window.location.href = "/system/invoices/list";
      }
    } catch (error) {
      console.error(error);
      toast.error(t.createApiMissing);
    } finally {
      setSaving(false);
    }
  };

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
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
          {/* =====================================================
              LEFT SIDE
          ===================================================== */}
          <div className="space-y-6">
            <Card className="rounded-[1.5rem]">
              <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                    {t.selectOrder}
                  </CardTitle>
                  <CardDescription>{t.selectOrderDesc}</CardDescription>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => loadOrders("refresh")}
                  disabled={refreshingOrders}
                >
                  {refreshingOrders ? (
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="me-2 h-4 w-4" />
                  )}
                  {t.refresh}
                </Button>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t.searchOrder}
                    className="rounded-2xl ps-9"
                  />
                </div>

                {loadingOrders ? (
                  <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm">{t.loadingOrders}</p>
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed bg-muted/20 text-center">
                    <FileText className="h-10 w-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{t.noOrders}</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {filteredOrders.slice(0, 12).map((order) => {
                      const isSelected = selectedOrderId === order.id;

                      return (
                        <button
                          key={order.id}
                          type="button"
                          onClick={() => setSelectedOrderId(order.id)}
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
                                  {t.customer}: {resolveCustomerName(order, t.notAvailable)}
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

                            <div className="flex items-center gap-2 font-bold">
                              <Image src={SAR_ICON_PATH} alt="SAR" width={16} height={16} />
                              {formatMoney(resolveOrderTotal(order))}
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
                  <ReceiptText className="h-5 w-5 text-primary" />
                  {t.invoiceData}
                </CardTitle>
                <CardDescription>{t.invoiceDataDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-5">
                <div className="grid gap-3">
                  <Label htmlFor="invoice_type">{t.invoiceType}</Label>
                  <select
                    id="invoice_type"
                    value={invoiceType}
                    onChange={(event) => setInvoiceType(event.target.value as InvoiceType)}
                    className="h-11 rounded-2xl border border-input bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    {INVOICE_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {isAr ? item.labelAr : item.labelEn}
                      </option>
                    ))}
                  </select>

                  <div className="rounded-3xl border bg-muted/20 p-4">
                    <div className="flex items-start gap-3">
                      <BadgeCheck className="mt-0.5 h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-semibold">
                          {isAr ? selectedInvoiceType.labelAr : selectedInvoiceType.labelEn}
                        </p>
                        <p className="mt-1 text-xs leading-6 text-muted-foreground">
                          {isAr
                            ? selectedInvoiceType.descriptionAr
                            : selectedInvoiceType.descriptionEn}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor="issue_date">{t.issueDate}</Label>
                    <Input
                      id="issue_date"
                      type="date"
                      value={issueDate}
                      onChange={(event) => setIssueDate(event.target.value)}
                      className="rounded-2xl"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="due_date">{t.dueDate}</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={dueDate}
                      onChange={(event) => setDueDate(event.target.value)}
                      className="rounded-2xl"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="tax_rate">{t.taxRate}</Label>
                    <Input
                      id="tax_rate"
                      value={taxRate}
                      onChange={(event) => setTaxRate(event.target.value)}
                      inputMode="decimal"
                      className="rounded-2xl"
                      placeholder="15.00"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
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

                  <div className="grid gap-2">
                    <Label htmlFor="internal_notes">{t.internalNotes}</Label>
                    <textarea
                      id="internal_notes"
                      value={internalNotes}
                      onChange={(event) => setInternalNotes(event.target.value)}
                      placeholder={t.internalNotesPlaceholder}
                      className="min-h-32 rounded-2xl border border-input bg-background px-3 py-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <ToggleCard
                    checked={autoIssue}
                    onChange={setAutoIssue}
                    title={t.autoIssue}
                    description={
                      isAr
                        ? "يتم تحويل الفاتورة من مسودة إلى مصدرة مباشرة."
                        : "Moves the invoice from draft to issued immediately."
                    }
                    icon={FileText}
                  />

                  <ToggleCard
                    checked={autoPostAccounting}
                    onChange={setAutoPostAccounting}
                    title={t.autoPostAccounting}
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

          {/* =====================================================
              RIGHT SIDE
          ===================================================== */}
          <aside className="space-y-6">
            <Card className="sticky top-6 rounded-[1.5rem]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  {t.orderSummary}
                </CardTitle>
                <CardDescription>
                  {selectedOrder
                    ? resolveOrderNumber(selectedOrder)
                    : isAr
                      ? "اختر طلبًا لعرض الملخص"
                      : "Select an order to view summary"}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {selectedOrder ? (
                  <>
                    <div className="rounded-3xl border bg-muted/20 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <ShoppingCart className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 space-y-1">
                          <p className="truncate font-semibold">
                            {resolveOrderNumber(selectedOrder)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t.customer}: {resolveCustomerName(selectedOrder, t.notAvailable)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t.date}:{" "}
                            {formatDate(
                              selectedOrder.order_date || selectedOrder.created_at,
                              locale
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    <SummaryLine label={t.subtotal} value={summary.subtotal} />
                    <SummaryLine label={t.discount} value={summary.discount} />
                    <SummaryLine label={t.tax} value={summary.tax} />

                    <div className="rounded-3xl border border-primary/20 bg-primary/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{t.total}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{t.sar}</p>
                        </div>

                        <div className="flex items-center gap-2 text-2xl font-bold">
                          <Image src={SAR_ICON_PATH} alt="SAR" width={20} height={20} />
                          {formatMoney(summary.total)}
                        </div>
                      </div>
                    </div>

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
                        ? "اختر طلبًا من القائمة حتى يتم تجهيز ملخص الفاتورة قبل الحفظ."
                        : "Select an order from the list to prepare the invoice summary before saving."}
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

function SummaryLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1.5 font-semibold">
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
  icon: typeof FileText;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`rounded-3xl border p-4 text-start transition hover:-translate-y-0.5 hover:shadow-sm ${
        checked
          ? "border-primary bg-primary/5"
          : "bg-card hover:bg-muted/30"
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