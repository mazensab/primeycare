"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  CalendarClock,
  CreditCard,
  Download,
  FileText,
  Filter,
  Loader2,
  PackageCheck,
  PieChart,
  Printer,
  RefreshCcw,
  Search,
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
   📂 app/system/orders/reports/page.tsx
   🧠 Primey Care | Orders Reports
   ------------------------------------------------------------
   ✅ نفس نمط تقارير المراكز
   ✅ ربط حقيقي مع /api/orders/
   ✅ بحث + فلاتر
   ✅ ملخصات مالية وتشغيلية
   ✅ تقارير حسب الحالة والدفع والتنفيذ والمصدر
   ✅ جدول تفصيلي
   ✅ تصدير Excel منظم .xlsx للقسم فقط
   ✅ طباعة Web PDF للقسم فقط
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ الأرقام دائمًا بالإنجليزية
   ✅ استخدام /currency/sar.svg
   ✅ بدون hardcoded localhost
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

type Order = {
  id: number | string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  productName: string;
  productCode: string;
  productType: string;
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
};

type ReportItem = {
  key: string;
  label: string;
  count: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
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
   🔁 API Normalizers
============================================================ */

function normalizeApiList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== "object") return [];

  const record = payload as OrdersApiResponse;

  if (Array.isArray(record.results)) return record.results;
  if (Array.isArray(record.data)) return record.data;
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.orders)) return record.orders;

  if (record.data && typeof record.data === "object") {
    const nested = record.data as OrdersApiResponse;

    if (Array.isArray(nested.results)) return nested.results;
    if (Array.isArray(nested.items)) return nested.items;
    if (Array.isArray(nested.orders)) return nested.orders;
  }

  return [];
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
  const obj = (item || {}) as Record<string, unknown>;

  const customer = (obj.customer || {}) as Record<string, unknown>;
  const product = (obj.product || {}) as Record<string, unknown>;

  return {
    id: (obj.id ?? "-") as number | string,
    orderNumber: String(obj.order_number ?? ""),
    customerName: String(customer.full_name ?? obj.customer_name ?? "-"),
    customerPhone: String(customer.phone ?? obj.customer_phone ?? ""),
    customerEmail: String(customer.email ?? obj.customer_email ?? ""),
    productName: String(obj.product_name ?? product.name ?? "-"),
    productCode: String(product.code ?? obj.product_code ?? ""),
    productType: String(obj.product_type ?? product.product_type ?? ""),
    status: normalizeOrderStatus(obj.status),
    paymentStatus: normalizePaymentStatus(obj.payment_status),
    fulfillmentStatus: normalizeFulfillmentStatus(obj.fulfillment_status),
    source: normalizeSource(obj.source),
    currencyCode: String(obj.currency_code ?? product.currency_code ?? "SAR"),
    unitPrice: toNumber(obj.unit_price),
    quantity: toNumber(obj.quantity || 1),
    subtotalAmount: toNumber(obj.subtotal_amount),
    discountAmount: toNumber(obj.discount_amount),
    taxAmount: toNumber(obj.tax_amount),
    totalAmount: toNumber(obj.total_amount),
    amountPaid: toNumber(obj.amount_paid),
    remainingAmount: toNumber(obj.remaining_amount),
    issueReference: String(obj.issue_reference ?? ""),
    createdAt: String(obj.created_at ?? ""),
    updatedAt: String(obj.updated_at ?? ""),
    raw: obj,
  };
}

/* ============================================================
   📚 Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    pageTitle: isArabic ? "تقارير الطلبات" : "Orders Reports",
    pageSubtitle: isArabic
      ? "تحليل شامل للطلبات حسب الحالة، الدفع، التنفيذ، المصدر، والقيم المالية."
      : "Comprehensive analysis of orders by status, payment, fulfillment, source and financial values.",

    back: isArabic ? "رجوع" : "Back",
    dashboard: isArabic ? "لوحة الطلبات" : "Orders Dashboard",
    list: isArabic ? "قائمة الطلبات" : "Orders List",
    create: isArabic ? "إنشاء طلب" : "Create Order",
    refresh: isArabic ? "تحديث" : "Refresh",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    printPdf: isArabic ? "طباعة PDF" : "Print PDF",

    searchPlaceholder: isArabic
      ? "ابحث برقم الطلب، العميل، المنتج، الجوال..."
      : "Search by order number, customer, product, phone...",

    filters: isArabic ? "الفلاتر" : "Filters",
    all: isArabic ? "الكل" : "All",
    selectedFilters: isArabic ? "الفلاتر الحالية" : "Current Filters",

    totalOrders: isArabic ? "إجمالي الطلبات" : "Total Orders",
    openOrders: isArabic ? "طلبات مفتوحة" : "Open Orders",
    completedOrders: isArabic ? "طلبات مكتملة" : "Completed Orders",
    cancelledOrders: isArabic ? "طلبات ملغاة/مستردة" : "Cancelled/Refunded",
    totalValue: isArabic ? "إجمالي قيمة الطلبات" : "Total Order Value",
    paidValue: isArabic ? "إجمالي المدفوع" : "Total Paid",
    remainingValue: isArabic ? "إجمالي المتبقي" : "Total Remaining",
    averageOrder: isArabic ? "متوسط الطلب" : "Average Order",

    statusReport: isArabic ? "تقرير حالات الطلب" : "Order Status Report",
    statusReportDesc: isArabic
      ? "توزيع الطلبات حسب حالة الطلب الحالية."
      : "Distribution of orders by current order status.",

    paymentReport: isArabic ? "تقرير الدفع" : "Payment Report",
    paymentReportDesc: isArabic
      ? "تحليل الطلبات حسب حالة الدفع والمبالغ المحصلة."
      : "Analysis of orders by payment status and collected amounts.",

    fulfillmentReport: isArabic ? "تقرير التنفيذ" : "Fulfillment Report",
    fulfillmentReportDesc: isArabic
      ? "متابعة حالة إصدار وتسليم الطلبات."
      : "Track order issuance and delivery status.",

    sourceReport: isArabic ? "تقرير مصادر الطلبات" : "Order Sources Report",
    sourceReportDesc: isArabic
      ? "تحليل الطلبات حسب مصدرها."
      : "Analyze orders by source.",

    detailedReport: isArabic ? "الجدول التفصيلي" : "Detailed Report",
    detailedReportDesc: isArabic
      ? "قائمة تفصيلية للطلبات المطابقة للفلاتر الحالية."
      : "Detailed list of orders matching the current filters.",

    emptyTitle: isArabic ? "لا توجد بيانات" : "No data",
    emptyText: isArabic
      ? "لا توجد طلبات مطابقة للفلاتر الحالية."
      : "No orders match the current filters.",

    loading: isArabic ? "جاري تحميل تقارير الطلبات..." : "Loading orders reports...",
    apiError: isArabic ? "تعذر تحميل تقارير الطلبات." : "Unable to load orders reports.",
    refreshSuccess: isArabic ? "تم تحديث تقارير الطلبات بنجاح" : "Orders reports refreshed successfully",
    exportSuccess: isArabic ? "تم تصدير تقرير الطلبات بنجاح" : "Orders report exported successfully",

    reportTitle: isArabic ? "تقرير الطلبات" : "Orders Report",

    orderNumber: isArabic ? "رقم الطلب" : "Order No.",
    customer: isArabic ? "العميل" : "Customer",
    product: isArabic ? "المنتج" : "Product",
    amount: isArabic ? "المبلغ" : "Amount",
    paid: isArabic ? "المدفوع" : "Paid",
    remaining: isArabic ? "المتبقي" : "Remaining",
    status: isArabic ? "الحالة" : "Status",
    payment: isArabic ? "الدفع" : "Payment",
    fulfillment: isArabic ? "التنفيذ" : "Fulfillment",
    source: isArabic ? "المصدر" : "Source",
    count: isArabic ? "العدد" : "Count",
    percentage: isArabic ? "النسبة" : "Percentage",

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

function formatPercent(value: number) {
  return `${formatNumber(value)}%`;
}

function CurrencyAmount({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold">
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

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
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
  icon: React.ElementType;
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

function ReportMiniTable({
  title,
  description,
  icon: Icon,
  items,
  totalCount,
  emptyText,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  items: ReportItem[];
  totalCount: number;
  emptyText: string;
}) {
  return (
    <Card className="rounded-2xl border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Icon className="h-5 w-5" />
          </div>

          <div>
            <CardTitle className="text-base font-bold">{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const itemPercent = percent(item.count, totalCount);

              return (
                <div key={item.key} className="rounded-xl border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.label}</p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {formatNumber(item.count)} • {formatPercent(itemPercent)}
                      </p>
                    </div>

                    <CurrencyAmount value={item.totalAmount} />
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${itemPercent}%` }}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <span>{formatMoney(item.paidAmount)}</span>
                    </div>
                    <div className="text-end">
                      <span>{formatMoney(item.remainingAmount)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BadgeValue({ label }: { label: string }) {
  return (
    <Badge variant="secondary" className="rounded-full">
      {label}
    </Badge>
  );
}

/* ============================================================
   ✅ Page
============================================================ */

export default function SystemOrdersReportsPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("ALL");
  const [fulfillmentFilter, setFulfillmentFilter] =
    useState<FulfillmentFilter>("ALL");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("ALL");

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

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
        order.productType.toLowerCase().includes(cleanQuery);

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

  const stats = useMemo(() => {
    const total = filteredOrders.length;

    const open = filteredOrders.filter(
      (order) =>
        !["completed", "cancelled", "refunded"].includes(order.status),
    ).length;

    const completed = filteredOrders.filter(
      (order) => order.status === "completed",
    ).length;

    const cancelled = filteredOrders.filter((order) =>
      ["cancelled", "refunded"].includes(order.status),
    ).length;

    const totalValue = filteredOrders.reduce(
      (sum, order) => sum + order.totalAmount,
      0,
    );

    const paidValue = filteredOrders.reduce(
      (sum, order) => sum + order.amountPaid,
      0,
    );

    const remainingValue = filteredOrders.reduce(
      (sum, order) => sum + order.remainingAmount,
      0,
    );

    const averageOrder = total > 0 ? totalValue / total : 0;

    return {
      total,
      open,
      completed,
      cancelled,
      totalValue,
      paidValue,
      remainingValue,
      averageOrder,
    };
  }, [filteredOrders]);

  function buildReport<T extends string>(
    items: Order[],
    keyGetter: (order: Order) => T,
    labelGetter: (key: T) => string,
  ): ReportItem[] {
    const map = new Map<string, ReportItem>();

    items.forEach((order) => {
      const key = keyGetter(order);

      if (!map.has(key)) {
        map.set(key, {
          key,
          label: labelGetter(key),
          count: 0,
          totalAmount: 0,
          paidAmount: 0,
          remainingAmount: 0,
        });
      }

      const current = map.get(key);
      if (!current) return;

      current.count += 1;
      current.totalAmount += order.totalAmount;
      current.paidAmount += order.amountPaid;
      current.remainingAmount += order.remainingAmount;
    });

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }

  const statusReport = useMemo(
    () =>
      buildReport(
        filteredOrders,
        (order) => order.status,
        (key) => t.statusLabels[key as OrderStatus],
      ),
    [filteredOrders, t.statusLabels],
  );

  const paymentReport = useMemo(
    () =>
      buildReport(
        filteredOrders,
        (order) => order.paymentStatus,
        (key) => t.paymentLabels[key as PaymentStatus],
      ),
    [filteredOrders, t.paymentLabels],
  );

  const fulfillmentReport = useMemo(
    () =>
      buildReport(
        filteredOrders,
        (order) => order.fulfillmentStatus,
        (key) => t.fulfillmentLabels[key as FulfillmentStatus],
      ),
    [filteredOrders, t.fulfillmentLabels],
  );

  const sourceReport = useMemo(
    () =>
      buildReport(
        filteredOrders,
        (order) => order.source,
        (key) => t.sourceLabels[key as OrderSource],
      ),
    [filteredOrders, t.sourceLabels],
  );

  async function loadOrders(showToast = false) {
    try {
      setIsLoading(true);

      const result = await apiGet<OrdersApiResponse>(API_PATHS.orders.list, {
        page_size: 100,
      });

      if (!result.ok) {
        throw new Error(result.message);
      }

      const normalized = normalizeApiList(result.data).map(normalizeOrder);
      setOrders(normalized);

      if (showToast) {
        toast.success(t.refreshSuccess);
      }
    } catch (error) {
      console.error("Failed to load orders reports:", error);
      setOrders([]);
      toast.error(t.apiError);
    } finally {
      setIsLoading(false);
    }
  }

  function exportExcel() {
    const overviewRows = [
      { metric: t.totalOrders, value: stats.total },
      { metric: t.openOrders, value: stats.open },
      { metric: t.completedOrders, value: stats.completed },
      { metric: t.cancelledOrders, value: stats.cancelled },
      { metric: t.totalValue, value: stats.totalValue },
      { metric: t.paidValue, value: stats.paidValue },
      { metric: t.remainingValue, value: stats.remainingValue },
      { metric: t.averageOrder, value: stats.averageOrder },
    ];

    const detailRows = filteredOrders.map((order) => ({
      [t.orderNumber]: order.orderNumber || `#${order.id}`,
      [t.customer]: order.customerName,
      [t.product]: order.productName,
      [t.amount]: order.totalAmount,
      [t.paid]: order.amountPaid,
      [t.remaining]: order.remainingAmount,
      [t.status]: t.statusLabels[order.status],
      [t.payment]: t.paymentLabels[order.paymentStatus],
      [t.fulfillment]: t.fulfillmentLabels[order.fulfillmentStatus],
      [t.source]: t.sourceLabels[order.source],
    }));

    const workbook = XLSX.utils.book_new();

    const overviewSheet = XLSX.utils.json_to_sheet(overviewRows);
    overviewSheet["!cols"] = [{ wch: 32 }, { wch: 18 }];

    const detailSheet = XLSX.utils.json_to_sheet(detailRows);
    detailSheet["!cols"] = [
      { wch: 18 },
      { wch: 28 },
      { wch: 28 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
    ];

    XLSX.utils.book_append_sheet(
      workbook,
      overviewSheet,
      locale === "ar" ? "الملخص" : "Overview",
    );

    XLSX.utils.book_append_sheet(
      workbook,
      detailSheet,
      locale === "ar" ? "الطلبات" : "Orders",
    );

    XLSX.writeFile(workbook, "primey-care-orders-report.xlsx");
    toast.success(t.exportSuccess);
  }

  function printReport() {
    const rows = filteredOrders
      .map(
        (order) => `
          <tr>
            <td>${order.orderNumber || `#${order.id}`}</td>
            <td>${order.customerName}</td>
            <td>${order.productName}</td>
            <td>${formatMoney(order.totalAmount)}</td>
            <td>${formatMoney(order.amountPaid)}</td>
            <td>${formatMoney(order.remainingAmount)}</td>
            <td>${t.statusLabels[order.status]}</td>
            <td>${t.paymentLabels[order.paymentStatus]}</td>
            <td>${t.fulfillmentLabels[order.fulfillmentStatus]}</td>
            <td>${t.sourceLabels[order.source]}</td>
          </tr>
        `,
      )
      .join("");

    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) return;

    printWindow.document.write(`
      <!doctype html>
      <html lang="${locale}" dir="${isArabic ? "rtl" : "ltr"}">
        <head>
          <meta charset="utf-8" />
          <title>${t.reportTitle}</title>
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

            .summary {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 12px;
              margin-bottom: 20px;
            }

            .box {
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 12px;
              background: #f8fafc;
            }

            .box span {
              display: block;
              color: #64748b;
              font-size: 11px;
              margin-bottom: 6px;
            }

            .box strong {
              font-size: 16px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }

            th, td {
              border: 1px solid #e2e8f0;
              padding: 8px;
              text-align: ${isArabic ? "right" : "left"};
            }

            th {
              background: #f8fafc;
              font-weight: 700;
            }

            @media print {
              body {
                padding: 12px;
              }
            }
          </style>
        </head>
        <body>
          <h1>${t.reportTitle}</h1>
          <p>${t.pageSubtitle}</p>

          <div class="summary">
            <div class="box"><span>${t.totalOrders}</span><strong>${formatNumber(stats.total)}</strong></div>
            <div class="box"><span>${t.totalValue}</span><strong>${formatMoney(stats.totalValue)}</strong></div>
            <div class="box"><span>${t.paidValue}</span><strong>${formatMoney(stats.paidValue)}</strong></div>
            <div class="box"><span>${t.remainingValue}</span><strong>${formatMoney(stats.remainingValue)}</strong></div>
          </div>

          <table>
            <thead>
              <tr>
                <th>${t.orderNumber}</th>
                <th>${t.customer}</th>
                <th>${t.product}</th>
                <th>${t.amount}</th>
                <th>${t.paid}</th>
                <th>${t.remaining}</th>
                <th>${t.status}</th>
                <th>${t.payment}</th>
                <th>${t.fulfillment}</th>
                <th>${t.source}</th>
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Link href="/system/orders">
              <Button variant="ghost" size="sm" className="h-8 rounded-xl">
                <ArrowLeft className="h-4 w-4" />
                {t.back}
              </Button>
            </Link>

            <Badge variant="secondary" className="rounded-full">
              <FileText className="h-3.5 w-3.5" />
              {t.reportTitle}
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

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={exportExcel}
            disabled={filteredOrders.length === 0}
          >
            <Download className="h-4 w-4" />
            {t.exportExcel}
          </Button>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={printReport}
            disabled={filteredOrders.length === 0}
          >
            <Printer className="h-4 w-4" />
            {t.printPdf}
          </Button>

          <Link href="/system/orders/create">
            <Button className="h-10 w-full rounded-xl sm:w-auto">
              <ShoppingBag className="h-4 w-4" />
              {t.create}
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardContent className="p-4">
          <div className="grid gap-3 xl:grid-cols-[1fr_auto_auto_auto_auto]">
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 rounded-xl">
                  <Filter className="h-4 w-4" />
                  {t.statusFilter}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t.statusFilter}</DropdownMenuLabel>
                <DropdownMenuSeparator />
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
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 rounded-xl">
                  <CreditCard className="h-4 w-4" />
                  {t.paymentFilter}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t.paymentFilter}</DropdownMenuLabel>
                <DropdownMenuSeparator />
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
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 rounded-xl">
                  <Truck className="h-4 w-4" />
                  {t.fulfillmentFilter}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t.fulfillmentFilter}</DropdownMenuLabel>
                <DropdownMenuSeparator />
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
                    {status === "ALL" ? t.all : t.fulfillmentLabels[status]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 rounded-xl">
                  <PieChart className="h-4 w-4" />
                  {t.sourceFilter}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t.sourceFilter}</DropdownMenuLabel>
                <DropdownMenuSeparator />
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
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t.totalOrders}
          value={stats.total}
          subtitle={t.reportTitle}
          icon={ShoppingBag}
        />
        <StatCard
          title={t.openOrders}
          value={stats.open}
          subtitle={t.statusReport}
          icon={Activity}
        />
        <StatCard
          title={t.completedOrders}
          value={stats.completed}
          subtitle={t.fulfillmentReport}
          icon={BadgeCheck}
        />
        <StatCard
          title={t.cancelledOrders}
          value={stats.cancelled}
          subtitle={t.statusReport}
          icon={PackageCheck}
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
          subtitle={t.paymentReport}
          icon={CreditCard}
          money
        />
        <StatCard
          title={t.remainingValue}
          value={stats.remainingValue}
          subtitle={t.remaining}
          icon={TrendingUp}
          money
        />
        <StatCard
          title={t.averageOrder}
          value={stats.averageOrder}
          subtitle={t.totalOrders}
          icon={BarChart3}
          money
        />
      </div>

      {/* Report Grids */}
      <div className="grid gap-4 xl:grid-cols-2">
        <ReportMiniTable
          title={t.statusReport}
          description={t.statusReportDesc}
          icon={BarChart3}
          items={statusReport}
          totalCount={stats.total}
          emptyText={t.emptyText}
        />

        <ReportMiniTable
          title={t.paymentReport}
          description={t.paymentReportDesc}
          icon={CreditCard}
          items={paymentReport}
          totalCount={stats.total}
          emptyText={t.emptyText}
        />

        <ReportMiniTable
          title={t.fulfillmentReport}
          description={t.fulfillmentReportDesc}
          icon={Truck}
          items={fulfillmentReport}
          totalCount={stats.total}
          emptyText={t.emptyText}
        />

        <ReportMiniTable
          title={t.sourceReport}
          description={t.sourceReportDesc}
          icon={PieChart}
          items={sourceReport}
          totalCount={stats.total}
          emptyText={t.emptyText}
        />
      </div>

      {/* Detail Table */}
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base font-bold">
                {t.detailedReport}
              </CardTitle>
              <CardDescription className="mt-1">
                {t.detailedReportDesc}
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
                  <TableHead>{t.amount}</TableHead>
                  <TableHead>{t.paid}</TableHead>
                  <TableHead>{t.remaining}</TableHead>
                  <TableHead>{t.status}</TableHead>
                  <TableHead>{t.payment}</TableHead>
                  <TableHead>{t.fulfillment}</TableHead>
                  <TableHead>{t.source}</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-44 text-center">
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t.loading}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-44 text-center">
                      <div className="mx-auto max-w-md space-y-2">
                        <XCircle className="mx-auto h-8 w-8 text-muted-foreground" />
                        <p className="font-semibold">{t.emptyTitle}</p>
                        <p className="text-sm text-muted-foreground">
                          {t.emptyText}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.slice(0, 30).map((order) => (
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
                        <CurrencyAmount value={order.totalAmount} />
                      </TableCell>
                      <TableCell>
                        <CurrencyAmount value={order.amountPaid} />
                      </TableCell>
                      <TableCell>
                        <CurrencyAmount value={order.remainingAmount} />
                      </TableCell>
                      <TableCell>
                        <BadgeValue label={t.statusLabels[order.status]} />
                      </TableCell>
                      <TableCell>
                        <BadgeValue label={t.paymentLabels[order.paymentStatus]} />
                      </TableCell>
                      <TableCell>
                        <BadgeValue
                          label={t.fulfillmentLabels[order.fulfillmentStatus]}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full">
                          {t.sourceLabels[order.source]}
                        </Badge>
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
  );
}