"use client";

import Image from "next/image";
import Link from "next/link";
import type { ElementType } from "react";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  ArrowDownUp,
  ArrowLeft,
  BadgeCheck,
  Building2,
  ColumnsIcon,
  CreditCard,
  Download,
  Eye,
  FileSignature,
  FileText,
  FilterIcon,
  Loader2,
  MoreHorizontal,
  PackageCheck,
  Phone,
  PlusCircle,
  Printer,
  RefreshCcw,
  Search,
  ShoppingBag,
  Truck,
  UserRound,
  UsersRound,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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

import { API_PATHS, apiGet } from "@/lib/api";

/* ============================================================
   📂 app/system/orders/list/page.tsx
   🧠 Primey Care | Orders List
   ------------------------------------------------------------
   ✅ نفس نمط قائمة المراكز
   ✅ بدون @tanstack/react-table
   ✅ استخدام UI الداخلي فقط
   ✅ بحث + فلاتر + أعمدة + تحديد + فرز + صفحات
   ✅ تصدير Excel منظم .xlsx بدل CSV
   ✅ طباعة Web PDF للقائمة فقط
   ✅ ربط حقيقي مع /api/orders/
   ✅ يدعم المرحلة 8:
      - Customer
      - Product
      - Provider / Center
      - Contract
      - Agent
      - Invoice
   ✅ استخدام /currency/sar.svg
   ✅ بدون localhost hardcoded
   ✅ استخدام sonner
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

type StatusFilter = "ALL" | OrderStatus;
type PaymentFilter = "ALL" | PaymentStatus;
type FulfillmentFilter = "ALL" | FulfillmentStatus;
type SourceFilter = "ALL" | OrderSource;

type SortKey =
  | "orderNumber"
  | "customerName"
  | "productName"
  | "providerName"
  | "contractTitle"
  | "agentName"
  | "invoiceNumber"
  | "totalAmount"
  | "paymentStatus"
  | "fulfillmentStatus"
  | "status"
  | "source";

type SortDirection = "asc" | "desc";

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
  providerStatus: string;

  contractTitle: string;
  contractNumber: string;
  contractStatus: string;

  agentName: string;
  agentCode: string;
  agentPhone: string;

  invoiceId: number | string | null;
  invoiceNumber: string;
  invoiceStatus: string;
  hasInvoice: boolean;

  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  source: OrderSource;

  currencyCode: string;
  unitPrice: number;
  quantity: number;
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  remainingAmount: number;

  issueReference: string;
  createdAt: string;
  updatedAt: string;
  raw: Record<string, unknown>;
};

type OrdersApiResponse = {
  ok?: boolean;
  message?: string;
  results?: unknown[];
  data?: unknown[] | Record<string, unknown>;
  items?: unknown[];
  orders?: unknown[];
  pagination?: {
    page?: number;
    page_size?: number;
    total_pages?: number;
    total_items?: number;
    has_next?: boolean;
    has_previous?: boolean;
  };
};

type VisibleColumns = {
  orderNumber: boolean;
  customer: boolean;
  product: boolean;
  provider: boolean;
  contract: boolean;
  agent: boolean;
  invoice: boolean;
  amount: boolean;
  paymentStatus: boolean;
  fulfillmentStatus: boolean;
  status: boolean;
  source: boolean;
  actions: boolean;
};

/* ============================================================
   🌐 Locale Helpers
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

/* ============================================================
   🔁 API Normalizers
============================================================ */

function normalizeApiList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === "object") {
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
  }

  return [];
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;

  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function safeText(value: unknown, fallback = ""): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
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
    providerStatus: safeText(provider.status),

    contractTitle: safeText(contract.title ?? contract.name, "-"),
    contractNumber: safeText(contract.contract_number ?? contract.number),
    contractStatus: safeText(contract.status),

    agentName: safeText(
      agent.name ??
        agent.display_name ??
        agent.full_name ??
        agent.agent_name,
      "-",
    ),
    agentCode: safeText(agent.agent_code ?? agent.code),
    agentPhone: safeText(agent.phone_number ?? agent.phone),

    invoiceId: invoiceId as number | string | null,
    invoiceNumber: safeText(invoice.invoice_number ?? invoice.number),
    invoiceStatus: safeText(invoice.status),
    hasInvoice: Boolean(obj.has_invoice || invoiceId),

    status: normalizeOrderStatus(obj.status),
    paymentStatus: normalizePaymentStatus(obj.payment_status),
    fulfillmentStatus: normalizeFulfillmentStatus(obj.fulfillment_status),
    source: normalizeSource(obj.source),

    currencyCode: safeText(obj.currency_code ?? product.currency_code, "SAR"),
    unitPrice: toNumber(obj.unit_price),
    quantity: toNumber(obj.quantity || 1),
    subtotalAmount: toNumber(obj.subtotal_amount),
    discountAmount: toNumber(obj.discount_amount),
    taxAmount: toNumber(obj.tax_amount),
    totalAmount: toNumber(obj.total_amount),
    amountPaid: toNumber(obj.amount_paid),
    remainingAmount: toNumber(obj.remaining_amount),

    issueReference: safeText(obj.issue_reference),
    createdAt: safeText(obj.created_at),
    updatedAt: safeText(obj.updated_at),
    raw: obj,
  };
}

/* ============================================================
   📚 Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    pageTitle: isArabic ? "قائمة الطلبات" : "Orders List",
    pageSubtitle: isArabic
      ? "إدارة جميع طلبات العملاء مع الربط بالمراكز والعقود والمندوبين والفواتير."
      : "Manage all customer orders with providers, contracts, agents and invoices.",

    back: isArabic ? "رجوع" : "Back",
    refresh: isArabic ? "تحديث" : "Refresh",
    addOrder: isArabic ? "إنشاء طلب" : "Create Order",
    reports: isArabic ? "التقارير" : "Reports",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    details: isArabic ? "عرض التفاصيل" : "View Details",

    searchPlaceholder: isArabic
      ? "ابحث برقم الطلب، العميل، المنتج، المركز، العقد، المندوب، الفاتورة..."
      : "Search by order, customer, product, provider, contract, agent, invoice...",

    filters: isArabic ? "الفلاتر" : "Filters",
    columns: isArabic ? "الأعمدة" : "Columns",
    sort: isArabic ? "الفرز" : "Sort",
    selected: isArabic ? "محدد" : "Selected",

    totalOrders: isArabic ? "إجمالي الطلبات" : "Total Orders",
    openOrders: isArabic ? "طلبات مفتوحة" : "Open Orders",
    completedOrders: isArabic ? "طلبات مكتملة" : "Completed Orders",
    totalValue: isArabic ? "إجمالي القيمة" : "Total Value",

    all: isArabic ? "الكل" : "All",
    page: isArabic ? "صفحة" : "Page",
    of: isArabic ? "من" : "of",
    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",

    noOrdersTitle: isArabic ? "لا توجد طلبات" : "No orders found",
    noOrdersText: isArabic
      ? "لا توجد طلبات مطابقة للفلاتر الحالية."
      : "There are no orders matching the current filters.",

    loading: isArabic ? "جاري تحميل الطلبات..." : "Loading orders...",
    apiError: isArabic ? "تعذر تحميل بيانات الطلبات." : "Unable to load orders data.",
    refreshSuccess: isArabic ? "تم تحديث الطلبات بنجاح" : "Orders refreshed successfully",
    exportSuccess: isArabic ? "تم تصدير ملف Excel بنجاح" : "Excel file exported successfully",
    printTitle: isArabic ? "تقرير قائمة الطلبات" : "Orders List Report",

    notLinked: isArabic ? "غير مرتبط" : "Not linked",

    table: {
      orderNumber: isArabic ? "رقم الطلب" : "Order No.",
      customer: isArabic ? "العميل" : "Customer",
      product: isArabic ? "المنتج" : "Product",
      provider: isArabic ? "المركز" : "Provider",
      contract: isArabic ? "العقد" : "Contract",
      agent: isArabic ? "المندوب" : "Agent",
      invoice: isArabic ? "الفاتورة" : "Invoice",
      amount: isArabic ? "المبلغ" : "Amount",
      paymentStatus: isArabic ? "الدفع" : "Payment",
      fulfillmentStatus: isArabic ? "التنفيذ" : "Fulfillment",
      status: isArabic ? "الحالة" : "Status",
      source: isArabic ? "المصدر" : "Source",
      actions: isArabic ? "الإجراءات" : "Actions",
    },

    statusFilter: isArabic ? "حالة الطلب" : "Order Status",
    paymentFilter: isArabic ? "حالة الدفع" : "Payment Status",
    fulfillmentFilter: isArabic ? "حالة التنفيذ" : "Fulfillment Status",
    sourceFilter: isArabic ? "مصدر الطلب" : "Order Source",

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

    sortLabels: {
      orderNumber: isArabic ? "رقم الطلب" : "Order Number",
      customerName: isArabic ? "العميل" : "Customer",
      productName: isArabic ? "المنتج" : "Product",
      providerName: isArabic ? "المركز" : "Provider",
      contractTitle: isArabic ? "العقد" : "Contract",
      agentName: isArabic ? "المندوب" : "Agent",
      invoiceNumber: isArabic ? "الفاتورة" : "Invoice",
      totalAmount: isArabic ? "المبلغ" : "Amount",
      paymentStatus: isArabic ? "الدفع" : "Payment",
      fulfillmentStatus: isArabic ? "التنفيذ" : "Fulfillment",
      status: isArabic ? "الحالة" : "Status",
      source: isArabic ? "المصدر" : "Source",
    } satisfies Record<SortKey, string>,

    columnLabels: {
      orderNumber: isArabic ? "رقم الطلب" : "Order No.",
      customer: isArabic ? "العميل" : "Customer",
      product: isArabic ? "المنتج" : "Product",
      provider: isArabic ? "المركز" : "Provider",
      contract: isArabic ? "العقد" : "Contract",
      agent: isArabic ? "المندوب" : "Agent",
      invoice: isArabic ? "الفاتورة" : "Invoice",
      amount: isArabic ? "المبلغ" : "Amount",
      paymentStatus: isArabic ? "الدفع" : "Payment",
      fulfillmentStatus: isArabic ? "التنفيذ" : "Fulfillment",
      status: isArabic ? "الحالة" : "Status",
      source: isArabic ? "المصدر" : "Source",
      actions: isArabic ? "الإجراءات" : "Actions",
    } satisfies Record<keyof VisibleColumns, string>,
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

function getStatusClass(status: OrderStatus) {
  if (status === "completed" || status === "confirmed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300";
  }

  if (status === "pending" || status === "processing") {
    return "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300";
  }

  if (status === "cancelled" || status === "refunded") {
    return "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300";
  }

  return "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300";
}

function getPaymentClass(status: PaymentStatus) {
  if (status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300";
  }

  if (status === "partially_paid") {
    return "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300";
  }

  if (status === "failed" || status === "refunded") {
    return "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300";
  }

  return "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300";
}

function getFulfillmentClass(status: FulfillmentStatus) {
  if (status === "issued" || status === "delivered") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300";
  }

  if (status === "in_progress") {
    return "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300";
  }

  if (status === "failed") {
    return "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300";
  }

  return "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300";
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

/* ============================================================
   ✅ Page
============================================================ */

export default function SystemOrdersListPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("ALL");
  const [fulfillmentFilter, setFulfillmentFilter] =
    useState<FulfillmentFilter>("ALL");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("ALL");

  const [sortKey, setSortKey] = useState<SortKey>("orderNumber");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Array<number | string>>([]);

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    orderNumber: true,
    customer: true,
    product: true,
    provider: true,
    contract: true,
    agent: true,
    invoice: true,
    amount: true,
    paymentStatus: true,
    fulfillmentStatus: true,
    status: true,
    source: false,
    actions: true,
  });

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const pageSize = 10;

  const filteredOrders = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesQuery =
        !cleanQuery ||
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
        order.invoiceNumber.toLowerCase().includes(cleanQuery) ||
        order.issueReference.toLowerCase().includes(cleanQuery);

      const matchesStatus =
        statusFilter === "ALL" || order.status === statusFilter;

      const matchesPayment =
        paymentFilter === "ALL" || order.paymentStatus === paymentFilter;

      const matchesFulfillment =
        fulfillmentFilter === "ALL" ||
        order.fulfillmentStatus === fulfillmentFilter;

      const matchesSource =
        sourceFilter === "ALL" || order.source === sourceFilter;

      return (
        matchesQuery &&
        matchesStatus &&
        matchesPayment &&
        matchesFulfillment &&
        matchesSource
      );
    });
  }, [
    orders,
    query,
    statusFilter,
    paymentFilter,
    fulfillmentFilter,
    sourceFilter,
  ]);

  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      const aText = String(aValue || "").toLowerCase();
      const bText = String(bValue || "").toLowerCase();

      return sortDirection === "asc"
        ? aText.localeCompare(bText)
        : bText.localeCompare(aText);
    });
  }, [filteredOrders, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / pageSize));

  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedOrders.slice(start, start + pageSize);
  }, [sortedOrders, page]);

  const stats = useMemo(() => {
    const total = orders.length;

    const open = orders.filter(
      (order) =>
        !["completed", "cancelled", "refunded"].includes(order.status),
    ).length;

    const completed = orders.filter(
      (order) => order.status === "completed",
    ).length;

    const totalValue = orders.reduce(
      (sum, order) => sum + order.totalAmount,
      0,
    );

    return {
      total,
      open,
      completed,
      totalValue,
    };
  }, [orders]);

  const allPageSelected =
    paginatedOrders.length > 0 &&
    paginatedOrders.every((order) => selectedIds.includes(order.id));

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
      console.error("Failed to load orders:", error);
      setOrders([]);
      toast.error(t.apiError);
    } finally {
      setIsLoading(false);
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  function toggleSelectAllPage() {
    if (allPageSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !paginatedOrders.some((order) => order.id === id)),
      );
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      paginatedOrders.forEach((order) => next.add(order.id));
      return Array.from(next);
    });
  }

  function toggleSelected(id: number | string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function exportExcel() {
    const exportRows = sortedOrders.map((order) => ({
      [t.table.orderNumber]: order.orderNumber || `#${order.id}`,
      [t.table.customer]: order.customerName,
      [t.table.product]: order.productName,
      [t.table.provider]: order.providerName === "-" ? "" : order.providerName,
      [t.table.contract]: order.contractTitle === "-" ? "" : order.contractTitle,
      [t.table.agent]: order.agentName === "-" ? "" : order.agentName,
      [t.table.invoice]: order.invoiceNumber,
      [t.table.amount]: order.totalAmount,
      [t.table.paymentStatus]: t.paymentLabels[order.paymentStatus],
      [t.table.fulfillmentStatus]: t.fulfillmentLabels[order.fulfillmentStatus],
      [t.table.status]: t.statusLabels[order.status],
      [t.table.source]: t.sourceLabels[order.source],
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows, {
      skipHeader: false,
    });

    worksheet["!cols"] = [
      { wch: 18 },
      { wch: 28 },
      { wch: 28 },
      { wch: 28 },
      { wch: 24 },
      { wch: 22 },
      { wch: 18 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      locale === "ar" ? "قائمة الطلبات" : "Orders List",
    );

    XLSX.writeFile(workbook, "primey-care-orders-list.xlsx");
    toast.success(t.exportSuccess);
  }

  function printList() {
    const rows = sortedOrders
      .map(
        (order) => `
          <tr>
            <td>${order.orderNumber || `#${order.id}`}</td>
            <td>${order.customerName}</td>
            <td>${order.productName}</td>
            <td>${order.providerName === "-" ? "" : order.providerName}</td>
            <td>${order.contractTitle === "-" ? "" : order.contractTitle}</td>
            <td>${order.agentName === "-" ? "" : order.agentName}</td>
            <td>${order.invoiceNumber || ""}</td>
            <td>${formatMoney(order.totalAmount)}</td>
            <td>${t.paymentLabels[order.paymentStatus]}</td>
            <td>${t.fulfillmentLabels[order.fulfillmentStatus]}</td>
            <td>${t.statusLabels[order.status]}</td>
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

            h1 {
              margin: 0 0 8px;
              font-size: 22px;
            }

            p {
              margin: 0 0 20px;
              color: #64748b;
              font-size: 13px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
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
          <table>
            <thead>
              <tr>
                <th>${t.table.orderNumber}</th>
                <th>${t.table.customer}</th>
                <th>${t.table.product}</th>
                <th>${t.table.provider}</th>
                <th>${t.table.contract}</th>
                <th>${t.table.agent}</th>
                <th>${t.table.invoice}</th>
                <th>${t.table.amount}</th>
                <th>${t.table.paymentStatus}</th>
                <th>${t.table.fulfillmentStatus}</th>
                <th>${t.table.status}</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
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
    loadOrders(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, paymentFilter, fulfillmentFilter, sourceFilter]);

  return (
    <div className="space-y-4" dir={isArabic ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
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
          </div>

          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t.pageTitle}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
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
            <span>{t.refresh}</span>
          </Button>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={exportExcel}
            disabled={sortedOrders.length === 0}
          >
            <Download className="h-4 w-4" />
            <span>{t.exportExcel}</span>
          </Button>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={printList}
            disabled={sortedOrders.length === 0}
          >
            <Printer className="h-4 w-4" />
            <span>{t.print}</span>
          </Button>

          <Button asChild className="h-10 w-full rounded-xl sm:w-auto">
            <Link href="/system/orders/create">
              <PlusCircle className="h-4 w-4" />
              <span>{t.addOrder}</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t.totalOrders}
          value={stats.total}
          subtitle={t.pageTitle}
          icon={ShoppingBag}
        />
        <StatCard
          title={t.openOrders}
          value={stats.open}
          subtitle={t.statusFilter}
          icon={PackageCheck}
        />
        <StatCard
          title={t.completedOrders}
          value={stats.completed}
          subtitle={t.fulfillmentFilter}
          icon={BadgeCheck}
        />
        <StatCard
          title={t.totalValue}
          value={stats.totalValue}
          subtitle={t.table.amount}
          icon={Wallet}
          money
        />
      </div>

      {/* Main Card */}
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base font-bold">
                {t.pageTitle}
              </CardTitle>
              <CardDescription className="mt-1">
                {formatNumber(sortedOrders.length)} {t.of}{" "}
                {formatNumber(orders.length)}
              </CardDescription>
            </div>

            <Badge variant="secondary" className="w-fit rounded-full">
              {formatNumber(selectedIds.length)} {t.selected}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Search + Actions */}
          <div className="grid gap-3 xl:grid-cols-[1fr_auto_auto_auto]">
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
                className={`h-10 rounded-xl ${
                  isArabic ? "pr-10" : "pl-10"
                }`}
              />
            </div>

            {/* Filters */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 rounded-xl">
                  <FilterIcon className="h-4 w-4" />
                  <span>{t.filters}</span>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>{t.statusFilter}</DropdownMenuLabel>
                {(
                  [
                    "ALL",
                    "draft",
                    "pending",
                    "confirmed",
                    "processing",
                    "completed",
                    "cancelled",
                    "refunded",
                  ] as StatusFilter[]
                ).map((status) => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={statusFilter === status}
                    onCheckedChange={() => setStatusFilter(status)}
                  >
                    {status === "ALL" ? t.all : t.statusLabels[status]}
                  </DropdownMenuCheckboxItem>
                ))}

                <DropdownMenuSeparator />

                <DropdownMenuLabel>{t.paymentFilter}</DropdownMenuLabel>
                {(
                  [
                    "ALL",
                    "unpaid",
                    "partially_paid",
                    "paid",
                    "failed",
                    "refunded",
                  ] as PaymentFilter[]
                ).map((status) => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={paymentFilter === status}
                    onCheckedChange={() => setPaymentFilter(status)}
                  >
                    {status === "ALL" ? t.all : t.paymentLabels[status]}
                  </DropdownMenuCheckboxItem>
                ))}

                <DropdownMenuSeparator />

                <DropdownMenuLabel>{t.fulfillmentFilter}</DropdownMenuLabel>
                {(
                  [
                    "ALL",
                    "not_started",
                    "in_progress",
                    "issued",
                    "delivered",
                    "failed",
                  ] as FulfillmentFilter[]
                ).map((status) => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={fulfillmentFilter === status}
                    onCheckedChange={() => setFulfillmentFilter(status)}
                  >
                    {status === "ALL"
                      ? t.all
                      : t.fulfillmentLabels[status]}
                  </DropdownMenuCheckboxItem>
                ))}

                <DropdownMenuSeparator />

                <DropdownMenuLabel>{t.sourceFilter}</DropdownMenuLabel>
                {(
                  [
                    "ALL",
                    "website",
                    "whatsapp",
                    "agent",
                    "admin",
                    "mobile_app",
                    "other",
                  ] as SourceFilter[]
                ).map((source) => (
                  <DropdownMenuCheckboxItem
                    key={source}
                    checked={sourceFilter === source}
                    onCheckedChange={() => setSourceFilter(source)}
                  >
                    {source === "ALL" ? t.all : t.sourceLabels[source]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Columns */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 rounded-xl">
                  <ColumnsIcon className="h-4 w-4" />
                  <span>{t.columns}</span>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t.columns}</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {(Object.keys(visibleColumns) as Array<keyof VisibleColumns>).map(
                  (key) => (
                    <DropdownMenuCheckboxItem
                      key={key}
                      checked={visibleColumns[key]}
                      onCheckedChange={(checked) =>
                        setVisibleColumns((current) => ({
                          ...current,
                          [key]: Boolean(checked),
                        }))
                      }
                    >
                      {t.columnLabels[key]}
                    </DropdownMenuCheckboxItem>
                  ),
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 rounded-xl">
                  <ArrowDownUp className="h-4 w-4" />
                  <span>{t.sort}</span>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t.sort}</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {(
                  [
                    "orderNumber",
                    "customerName",
                    "productName",
                    "providerName",
                    "contractTitle",
                    "agentName",
                    "invoiceNumber",
                    "totalAmount",
                    "paymentStatus",
                    "fulfillmentStatus",
                    "status",
                    "source",
                  ] as SortKey[]
                ).map((key) => (
                  <DropdownMenuItem key={key} onClick={() => toggleSort(key)}>
                    {t.sortLabels[key]}
                    {sortKey === key ? ` (${sortDirection})` : ""}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allPageSelected}
                      onCheckedChange={toggleSelectAllPage}
                      aria-label="Select all"
                    />
                  </TableHead>

                  {visibleColumns.orderNumber && (
                    <TableHead>{t.table.orderNumber}</TableHead>
                  )}

                  {visibleColumns.customer && (
                    <TableHead>{t.table.customer}</TableHead>
                  )}

                  {visibleColumns.product && (
                    <TableHead>{t.table.product}</TableHead>
                  )}

                  {visibleColumns.provider && (
                    <TableHead>{t.table.provider}</TableHead>
                  )}

                  {visibleColumns.contract && (
                    <TableHead>{t.table.contract}</TableHead>
                  )}

                  {visibleColumns.agent && (
                    <TableHead>{t.table.agent}</TableHead>
                  )}

                  {visibleColumns.invoice && (
                    <TableHead>{t.table.invoice}</TableHead>
                  )}

                  {visibleColumns.amount && (
                    <TableHead>{t.table.amount}</TableHead>
                  )}

                  {visibleColumns.paymentStatus && (
                    <TableHead>{t.table.paymentStatus}</TableHead>
                  )}

                  {visibleColumns.fulfillmentStatus && (
                    <TableHead>{t.table.fulfillmentStatus}</TableHead>
                  )}

                  {visibleColumns.status && (
                    <TableHead>{t.table.status}</TableHead>
                  )}

                  {visibleColumns.source && (
                    <TableHead>{t.table.source}</TableHead>
                  )}

                  {visibleColumns.actions && (
                    <TableHead className="text-end">{t.table.actions}</TableHead>
                  )}
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={14}
                      className="h-44 text-center text-muted-foreground"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{t.loading}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="h-44 text-center">
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
                  paginatedOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(order.id)}
                          onCheckedChange={() => toggleSelected(order.id)}
                          aria-label="Select row"
                        />
                      </TableCell>

                      {visibleColumns.orderNumber && (
                        <TableCell className="font-semibold">
                          {order.orderNumber || `#${order.id}`}
                        </TableCell>
                      )}

                      {visibleColumns.customer && (
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                              <UserRound className="h-4 w-4" />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {order.customerName}
                              </p>

                              <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                                <Phone className="h-3 w-3" />
                                <span className="truncate">
                                  {order.customerPhone ||
                                    order.customerEmail ||
                                    "-"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      )}

                      {visibleColumns.product && (
                        <TableCell>
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {order.productName}
                            </p>
                            <p className="text-muted-foreground mt-1 truncate text-xs">
                              {order.productCode || order.productType || "-"}
                            </p>
                          </div>
                        </TableCell>
                      )}

                      {visibleColumns.provider && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {order.providerName === "-"
                                  ? t.notLinked
                                  : order.providerName}
                              </p>
                              <p className="text-muted-foreground mt-1 truncate text-xs">
                                {order.providerCode || order.providerStatus || "-"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                      )}

                      {visibleColumns.contract && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileSignature className="h-4 w-4 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {order.contractTitle === "-"
                                  ? t.notLinked
                                  : order.contractTitle}
                              </p>
                              <p className="text-muted-foreground mt-1 truncate text-xs">
                                {order.contractNumber ||
                                  order.contractStatus ||
                                  "-"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                      )}

                      {visibleColumns.agent && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <UsersRound className="h-4 w-4 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {order.agentName === "-"
                                  ? t.notLinked
                                  : order.agentName}
                              </p>
                              <p className="text-muted-foreground mt-1 truncate text-xs">
                                {order.agentCode || order.agentPhone || "-"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                      )}

                      {visibleColumns.invoice && (
                        <TableCell>
                          {order.hasInvoice ? (
                            <Badge variant="secondary" className="rounded-full">
                              <FileText className="h-3.5 w-3.5" />
                              {order.invoiceNumber || `#${order.invoiceId}`}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="rounded-full">
                              {t.notLinked}
                            </Badge>
                          )}
                        </TableCell>
                      )}

                      {visibleColumns.amount && (
                        <TableCell>
                          <CurrencyAmount value={order.totalAmount} />
                          <p className="text-muted-foreground mt-1 text-xs">
                            {formatNumber(order.quantity)} ×{" "}
                            {formatMoney(order.unitPrice)}
                          </p>
                        </TableCell>
                      )}

                      {visibleColumns.paymentStatus && (
                        <TableCell>
                          <Badge
                            className={`rounded-full border px-3 py-1 ${getPaymentClass(
                              order.paymentStatus,
                            )}`}
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            {t.paymentLabels[order.paymentStatus]}
                          </Badge>
                        </TableCell>
                      )}

                      {visibleColumns.fulfillmentStatus && (
                        <TableCell>
                          <Badge
                            className={`rounded-full border px-3 py-1 ${getFulfillmentClass(
                              order.fulfillmentStatus,
                            )}`}
                          >
                            <Truck className="h-3.5 w-3.5" />
                            {t.fulfillmentLabels[order.fulfillmentStatus]}
                          </Badge>
                        </TableCell>
                      )}

                      {visibleColumns.status && (
                        <TableCell>
                          <Badge
                            className={`rounded-full border px-3 py-1 ${getStatusClass(
                              order.status,
                            )}`}
                          >
                            {t.statusLabels[order.status]}
                          </Badge>
                        </TableCell>
                      )}

                      {visibleColumns.source && (
                        <TableCell>
                          <Badge variant="outline" className="rounded-full">
                            {t.sourceLabels[order.source]}
                          </Badge>
                        </TableCell>
                      )}

                      {visibleColumns.actions && (
                        <TableCell className="text-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-xl"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem asChild>
                                <Link href={`/system/orders/${order.id}`}>
                                  <Eye className="h-4 w-4" />
                                  {t.details}
                                </Link>
                              </DropdownMenuItem>

                              <DropdownMenuItem asChild>
                                <Link href="/system/orders/reports">
                                  <FileText className="h-4 w-4" />
                                  {t.reports}
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {formatNumber(sortedOrders.length)} {t.of}{" "}
              {formatNumber(orders.length)}
            </p>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                {t.previous}
              </Button>

              <Badge variant="secondary" className="rounded-full px-3 py-1">
                {t.page} {formatNumber(page)} {t.of} {formatNumber(totalPages)}
              </Badge>

              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
              >
                {t.next}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}