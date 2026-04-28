"use client";

import Image from "next/image";
import Link from "next/link";
import type { ElementType, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Building2,
  CreditCard,
  Eye,
  FileText,
  Loader2,
  Package,
  PackageCheck,
  Plus,
  ReceiptText,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  Truck,
  UserRound,
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
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { API_PATHS, apiGet } from "@/lib/api";

/* ============================================================
   📂 app/system/orders/page.tsx
   🧠 Primey Care | System Orders Dashboard
   ------------------------------------------------------------
   ✅ لوحة الطلبات الرئيسية
   ✅ ربط حقيقي مع /api/orders/
   ✅ يدعم المرحلة 8:
      - Customer
      - Product
      - Provider / Center
      - Contract
      - Agent
      - Invoice
   ✅ روابط: القائمة / الإنشاء / التقارير / التفاصيل
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

type FulfillmentStatus =
  | "not_started"
  | "in_progress"
  | "issued"
  | "delivered"
  | "failed"
  | "UNKNOWN";

type OrderSource =
  | "website"
  | "whatsapp"
  | "agent"
  | "admin"
  | "mobile_app"
  | "other"
  | "UNKNOWN";

type Order = {
  id: number | string;
  orderNumber: string;

  customerName: string;
  customerPhone: string;
  customerEmail: string;

  productName: string;
  productCode: string;
  productType: string;

  providerName: string;
  providerCode: string;

  contractTitle: string;
  contractNumber: string;

  agentName: string;
  agentCode: string;

  invoiceId: number | string | null;
  invoiceNumber: string;
  hasInvoice: boolean;

  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  source: OrderSource;

  totalAmount: number;
  amountPaid: number;
  remainingAmount: number;
  createdAt: string;
};

type OrdersApiResponse = {
  ok?: boolean;
  message?: string;
  results?: unknown[];
  data?: unknown[] | Record<string, unknown>;
  items?: unknown[];
  orders?: unknown[];
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

function normalizeApiList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== "object") return [];

  const data = payload as OrdersApiResponse;

  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.orders)) return data.orders;

  if (data.data && typeof data.data === "object") {
    const nested = data.data as OrdersApiResponse;

    if (Array.isArray(nested.results)) return nested.results;
    if (Array.isArray(nested.items)) return nested.items;
    if (Array.isArray(nested.orders)) return nested.orders;
  }

  return [];
}

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

function normalizeFulfillmentStatus(value: unknown): FulfillmentStatus {
  const status = String(value || "").toLowerCase();

  if (status === "not_started") return "not_started";
  if (status === "in_progress") return "in_progress";
  if (status === "issued") return "issued";
  if (status === "delivered") return "delivered";
  if (status === "failed") return "failed";

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

function normalizeOrder(item: unknown): Order {
  const obj = safeRecord(item);

  const customer = safeRecord(obj.customer);
  const product = safeRecord(obj.product);
  const provider = safeRecord(obj.provider);
  const contract = safeRecord(obj.contract);
  const agent = safeRecord(obj.agent);
  const invoice = safeRecord(obj.invoice);

  const invoiceId = obj.invoice_id ?? invoice.id ?? null;

  return {
    id: (obj.id ?? "-") as number | string,
    orderNumber: safeText(obj.order_number),

    customerName: safeText(
      customer.display_name ??
        customer.full_name ??
        customer.name ??
        obj.customer_name,
      "-",
    ),
    customerPhone: safeText(
      customer.phone_number ??
        customer.whatsapp_number ??
        customer.phone ??
        obj.customer_phone,
    ),
    customerEmail: safeText(customer.email ?? obj.customer_email),

    productName: safeText(obj.product_name ?? product.name, "-"),
    productCode: safeText(product.code ?? obj.product_code),
    productType: safeText(obj.product_type ?? product.product_type),

    providerName: safeText(
      provider.name ??
        provider.display_name ??
        provider.provider_name ??
        provider.center_name,
      "-",
    ),
    providerCode: safeText(provider.code ?? provider.provider_code),

    contractTitle: safeText(contract.title ?? contract.name, "-"),
    contractNumber: safeText(contract.contract_number ?? contract.number),

    agentName: safeText(
      agent.name ??
        agent.display_name ??
        agent.full_name ??
        agent.agent_name,
      "-",
    ),
    agentCode: safeText(agent.agent_code ?? agent.code),

    invoiceId: invoiceId as number | string | null,
    invoiceNumber: safeText(invoice.invoice_number ?? invoice.number),
    hasInvoice: Boolean(obj.has_invoice || invoiceId),

    status: normalizeOrderStatus(obj.status),
    paymentStatus: normalizePaymentStatus(obj.payment_status),
    fulfillmentStatus: normalizeFulfillmentStatus(obj.fulfillment_status),
    source: normalizeSource(obj.source),

    totalAmount: toNumber(obj.total_amount),
    amountPaid: toNumber(obj.amount_paid),
    remainingAmount: toNumber(obj.remaining_amount),
    createdAt: safeText(obj.created_at),
  };
}

/* ============================================================
   📚 Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    pageTitle: isArabic ? "إدارة الطلبات" : "Orders Management",
    pageSubtitle: isArabic
      ? "لوحة تشغيلية لمتابعة دورة الطلبات وربط العملاء والمنتجات والمراكز والعقود والمندوبين والفواتير."
      : "Operational dashboard to track the order lifecycle across customers, products, providers, contracts, agents and invoices.",

    refresh: isArabic ? "تحديث" : "Refresh",
    list: isArabic ? "قائمة الطلبات" : "Orders List",
    create: isArabic ? "إنشاء طلب" : "Create Order",
    reports: isArabic ? "التقارير" : "Reports",
    details: isArabic ? "التفاصيل" : "Details",

    searchPlaceholder: isArabic
      ? "ابحث برقم الطلب، العميل، المنتج، المركز، العقد، المندوب، الفاتورة..."
      : "Search by order, customer, product, provider, contract, agent or invoice...",

    totalOrders: isArabic ? "إجمالي الطلبات" : "Total Orders",
    openOrders: isArabic ? "طلبات مفتوحة" : "Open Orders",
    completedOrders: isArabic ? "طلبات مكتملة" : "Completed Orders",
    cancelledOrders: isArabic ? "ملغاة / مستردة" : "Cancelled / Refunded",
    totalValue: isArabic ? "إجمالي القيمة" : "Total Value",
    paidValue: isArabic ? "إجمالي المدفوع" : "Total Paid",
    remainingValue: isArabic ? "إجمالي المتبقي" : "Total Remaining",
    invoicedOrders: isArabic ? "طلبات مفوترة" : "Invoiced Orders",

    quickActions: isArabic ? "إجراءات سريعة" : "Quick Actions",
    quickActionsDesc: isArabic
      ? "اختصارات تشغيلية لإدارة دورة الطلب."
      : "Operational shortcuts to manage the order lifecycle.",

    latestOrders: isArabic ? "آخر الطلبات" : "Latest Orders",
    latestOrdersDesc: isArabic
      ? "آخر الطلبات المسجلة في النظام مع روابط دورة الطلب."
      : "Latest orders recorded in the system with lifecycle links.",

    lifecycleOverview: isArabic ? "ملخص دورة الطلب" : "Lifecycle Overview",
    lifecycleOverviewDesc: isArabic
      ? "توزيع الطلبات حسب الحالة والدفع والتنفيذ."
      : "Orders distribution by status, payment and fulfillment.",

    orderNumber: isArabic ? "رقم الطلب" : "Order No.",
    customer: isArabic ? "العميل" : "Customer",
    product: isArabic ? "المنتج" : "Product",
    provider: isArabic ? "المركز" : "Provider",
    contract: isArabic ? "العقد" : "Contract",
    agent: isArabic ? "المندوب" : "Agent",
    invoice: isArabic ? "الفاتورة" : "Invoice",
    amount: isArabic ? "المبلغ" : "Amount",
    payment: isArabic ? "الدفع" : "Payment",
    fulfillment: isArabic ? "التنفيذ" : "Fulfillment",
    status: isArabic ? "الحالة" : "Status",
    source: isArabic ? "المصدر" : "Source",
    actions: isArabic ? "الإجراءات" : "Actions",

    notLinked: isArabic ? "غير مرتبط" : "Not linked",
    noOrdersTitle: isArabic ? "لا توجد طلبات" : "No orders found",
    noOrdersText: isArabic
      ? "لم يتم العثور على طلبات مطابقة للبحث الحالي."
      : "No orders match the current search.",
    loading: isArabic ? "جاري تحميل الطلبات..." : "Loading orders...",
    apiError: isArabic ? "تعذر تحميل بيانات الطلبات." : "Unable to load orders data.",
    refreshSuccess: isArabic ? "تم تحديث الطلبات بنجاح." : "Orders refreshed successfully.",

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

    fulfillmentLabels: {
      not_started: isArabic ? "لم يبدأ" : "Not Started",
      in_progress: isArabic ? "قيد التنفيذ" : "In Progress",
      issued: isArabic ? "مصدر" : "Issued",
      delivered: isArabic ? "تم التسليم" : "Delivered",
      failed: isArabic ? "فشل التنفيذ" : "Failed",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<FulfillmentStatus, string>,

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

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({
  children,
  variant = "secondary",
}: {
  children: ReactNode;
  variant?: "secondary" | "outline";
}) {
  return (
    <Badge variant={variant} className="rounded-full">
      {children}
    </Badge>
  );
}

/* ============================================================
   ✅ Page
============================================================ */

export default function SystemOrdersPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [orders, setOrders] = useState<Order[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const filteredOrders = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    if (!cleanQuery) return orders;

    return orders.filter((order) => {
      return (
        order.orderNumber.toLowerCase().includes(cleanQuery) ||
        order.customerName.toLowerCase().includes(cleanQuery) ||
        order.customerPhone.toLowerCase().includes(cleanQuery) ||
        order.customerEmail.toLowerCase().includes(cleanQuery) ||
        order.productName.toLowerCase().includes(cleanQuery) ||
        order.productCode.toLowerCase().includes(cleanQuery) ||
        order.productType.toLowerCase().includes(cleanQuery) ||
        order.providerName.toLowerCase().includes(cleanQuery) ||
        order.providerCode.toLowerCase().includes(cleanQuery) ||
        order.contractTitle.toLowerCase().includes(cleanQuery) ||
        order.contractNumber.toLowerCase().includes(cleanQuery) ||
        order.agentName.toLowerCase().includes(cleanQuery) ||
        order.agentCode.toLowerCase().includes(cleanQuery) ||
        order.invoiceNumber.toLowerCase().includes(cleanQuery)
      );
    });
  }, [orders, query]);

  const latestOrders = useMemo(() => {
    return [...filteredOrders].slice(0, 8);
  }, [filteredOrders]);

  const stats = useMemo(() => {
    const total = orders.length;

    const open = orders.filter(
      (order) =>
        !["completed", "cancelled", "refunded"].includes(order.status),
    ).length;

    const completed = orders.filter(
      (order) => order.status === "completed",
    ).length;

    const cancelled = orders.filter((order) =>
      ["cancelled", "refunded"].includes(order.status),
    ).length;

    const invoiced = orders.filter((order) => order.hasInvoice).length;

    const totalValue = orders.reduce(
      (sum, order) => sum + order.totalAmount,
      0,
    );

    const paidValue = orders.reduce((sum, order) => sum + order.amountPaid, 0);

    const remainingValue = orders.reduce(
      (sum, order) => sum + order.remainingAmount,
      0,
    );

    return {
      total,
      open,
      completed,
      cancelled,
      invoiced,
      totalValue,
      paidValue,
      remainingValue,
    };
  }, [orders]);

  const lifecycleCounts = useMemo(() => {
    return {
      pending: orders.filter((order) => order.status === "pending").length,
      confirmed: orders.filter((order) => order.status === "confirmed").length,
      processing: orders.filter((order) => order.status === "processing").length,
      completed: orders.filter((order) => order.status === "completed").length,
      unpaid: orders.filter((order) => order.paymentStatus === "unpaid").length,
      paid: orders.filter((order) => order.paymentStatus === "paid").length,
      inProgress: orders.filter(
        (order) => order.fulfillmentStatus === "in_progress",
      ).length,
      delivered: orders.filter(
        (order) => order.fulfillmentStatus === "delivered",
      ).length,
    };
  }, [orders]);

  async function loadOrders(showToast = false) {
    try {
      setIsLoading(true);

      const result = await apiGet<OrdersApiResponse>(API_PATHS.orders.list, {
        page_size: 100,
      });

      if (!result.ok) {
        throw new Error(result.message || t.apiError);
      }

      const normalized = normalizeApiList(result.data ?? result).map(
        normalizeOrder,
      );

      setOrders(normalized);

      if (showToast) {
        toast.success(t.refreshSuccess);
      }
    } catch (error) {
      console.error("Failed to load orders dashboard:", error);
      setOrders([]);
      toast.error(t.apiError);
    } finally {
      setIsLoading(false);
    }
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
    loadOrders(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  return (
    <div className="space-y-4" dir={isArabic ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              <ShoppingBag className="h-3.5 w-3.5" />
              {t.pageTitle}
            </Badge>

            <Badge variant="outline" className="rounded-full">
              <BadgeCheck className="h-3.5 w-3.5" />
              Order Lifecycle
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
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadOrders(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            {t.refresh}
          </Button>

          <Button asChild variant="outline" className="h-10 rounded-xl">
            <Link href="/system/orders/list">
              <FileText className="h-4 w-4" />
              {t.list}
            </Link>
          </Button>

          <Button asChild variant="outline" className="h-10 rounded-xl">
            <Link href="/system/orders/reports">
              <BarChart3 className="h-4 w-4" />
              {t.reports}
            </Link>
          </Button>

          <Button asChild className="h-10 w-full rounded-xl sm:w-auto">
            <Link href="/system/orders/create">
              <Plus className="h-4 w-4" />
              {t.create}
            </Link>
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search
              className={`text-muted-foreground absolute top-1/2 h-4 w-4 -translate-y-1/2 ${
                isArabic ? "right-3" : "left-3"
              }`}
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.searchPlaceholder}
              className={`h-10 rounded-xl ${isArabic ? "pr-10" : "pl-10"}`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t.totalOrders}
          value={stats.total}
          subtitle={t.latestOrders}
          icon={ShoppingBag}
        />
        <StatCard
          title={t.openOrders}
          value={stats.open}
          subtitle={t.lifecycleOverview}
          icon={Activity}
        />
        <StatCard
          title={t.completedOrders}
          value={stats.completed}
          subtitle={t.fulfillment}
          icon={PackageCheck}
        />
        <StatCard
          title={t.cancelledOrders}
          value={stats.cancelled}
          subtitle={t.status}
          icon={XCircle}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t.totalValue}
          value={stats.totalValue}
          subtitle={t.amount}
          icon={Wallet}
          money
        />
        <StatCard
          title={t.paidValue}
          value={stats.paidValue}
          subtitle={t.payment}
          icon={CreditCard}
          money
        />
        <StatCard
          title={t.remainingValue}
          value={stats.remainingValue}
          subtitle={t.payment}
          icon={TrendingUp}
          money
        />
        <StatCard
          title={t.invoicedOrders}
          value={stats.invoiced}
          subtitle={t.invoice}
          icon={ReceiptText}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
        {/* Lifecycle Overview */}
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">
                  {t.lifecycleOverview}
                </CardTitle>
                <CardDescription>{t.lifecycleOverviewDesc}</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="rounded-xl border bg-background p-4">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <p className="font-semibold">{t.status}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <StatusBadge>
                  {t.statusLabels.pending}: {formatNumber(lifecycleCounts.pending)}
                </StatusBadge>
                <StatusBadge>
                  {t.statusLabels.confirmed}: {formatNumber(lifecycleCounts.confirmed)}
                </StatusBadge>
                <StatusBadge>
                  {t.statusLabels.processing}: {formatNumber(lifecycleCounts.processing)}
                </StatusBadge>
                <StatusBadge>
                  {t.statusLabels.completed}: {formatNumber(lifecycleCounts.completed)}
                </StatusBadge>
              </div>
            </div>

            <div className="rounded-xl border bg-background p-4">
              <div className="mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <p className="font-semibold">{t.payment}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <StatusBadge variant="outline">
                  {t.paymentLabels.unpaid}: {formatNumber(lifecycleCounts.unpaid)}
                </StatusBadge>
                <StatusBadge variant="outline">
                  {t.paymentLabels.paid}: {formatNumber(lifecycleCounts.paid)}
                </StatusBadge>
              </div>
            </div>

            <div className="rounded-xl border bg-background p-4">
              <div className="mb-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <p className="font-semibold">{t.fulfillment}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <StatusBadge variant="outline">
                  {t.fulfillmentLabels.in_progress}: {formatNumber(lifecycleCounts.inProgress)}
                </StatusBadge>
                <StatusBadge variant="outline">
                  {t.fulfillmentLabels.delivered}: {formatNumber(lifecycleCounts.delivered)}
                </StatusBadge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Latest Orders */}
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-base font-bold">
                  {t.latestOrders}
                </CardTitle>
                <CardDescription className="mt-1">
                  {t.latestOrdersDesc}
                </CardDescription>
              </div>

              <Badge variant="secondary" className="w-fit rounded-full">
                {formatNumber(filteredOrders.length)} / {formatNumber(orders.length)}
              </Badge>
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.orderNumber}</TableHead>
                    <TableHead>{t.customer}</TableHead>
                    <TableHead>{t.product}</TableHead>
                    <TableHead>{t.provider}</TableHead>
                    <TableHead>{t.invoice}</TableHead>
                    <TableHead>{t.amount}</TableHead>
                    <TableHead>{t.status}</TableHead>
                    <TableHead className="text-end">{t.actions}</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-44 text-center">
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t.loading}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : latestOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-44 text-center">
                        <div className="mx-auto max-w-md space-y-2">
                          <XCircle className="mx-auto h-8 w-8 text-muted-foreground" />
                          <p className="font-semibold">{t.noOrdersTitle}</p>
                          <p className="text-sm text-muted-foreground">
                            {t.noOrdersText}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    latestOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-semibold">
                          {order.orderNumber || `#${order.id}`}
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                              <UserRound className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {order.customerName}
                              </p>
                              <p className="text-muted-foreground truncate text-xs">
                                {order.customerPhone || order.customerEmail || "-"}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {order.productName}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {order.productCode || order.productType || "-"}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {order.providerName === "-"
                                  ? t.notLinked
                                  : order.providerName}
                              </p>
                              <p className="text-muted-foreground truncate text-xs">
                                {order.contractTitle === "-"
                                  ? order.providerCode || "-"
                                  : `${order.contractTitle} ${
                                      order.agentName !== "-"
                                        ? `• ${order.agentName}`
                                        : ""
                                    }`}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          {order.hasInvoice ? (
                            <Badge variant="secondary" className="rounded-full">
                              <ReceiptText className="h-3.5 w-3.5" />
                              {order.invoiceNumber || `#${order.invoiceId}`}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="rounded-full">
                              {t.notLinked}
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell>
                          <CurrencyAmount value={order.totalAmount} />
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="secondary" className="w-fit rounded-full">
                              {t.statusLabels[order.status]}
                            </Badge>
                            <Badge variant="outline" className="w-fit rounded-full">
                              {t.paymentLabels[order.paymentStatus]}
                            </Badge>
                          </div>
                        </TableCell>

                        <TableCell className="text-end">
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="rounded-xl"
                          >
                            <Link href={`/system/orders/${order.id}`}>
                              <Eye className="h-4 w-4" />
                              {t.details}
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold">
            {t.quickActions}
          </CardTitle>
          <CardDescription>{t.quickActionsDesc}</CardDescription>
        </CardHeader>

        <CardContent className="grid gap-3 md:grid-cols-3">
          <Button
            asChild
            variant="outline"
            className="h-20 justify-start rounded-2xl"
          >
            <Link href="/system/orders/list">
              <FileText className="h-5 w-5" />
              <div className="text-start">
                <p className="font-semibold">{t.list}</p>
                <p className="text-muted-foreground text-xs">
                  {t.latestOrders}
                </p>
              </div>
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="h-20 justify-start rounded-2xl"
          >
            <Link href="/system/orders/create">
              <Plus className="h-5 w-5" />
              <div className="text-start">
                <p className="font-semibold">{t.create}</p>
                <p className="text-muted-foreground text-xs">
                  Customer / Product / Provider
                </p>
              </div>
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="h-20 justify-start rounded-2xl"
          >
            <Link href="/system/orders/reports">
              <BarChart3 className="h-5 w-5" />
              <div className="text-start">
                <p className="font-semibold">{t.reports}</p>
                <p className="text-muted-foreground text-xs">
                  {t.lifecycleOverview}
                </p>
              </div>
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}