"use client";

import Image from "next/image";
import Link from "next/link";
import type { ElementType } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  CreditCard,
  Download,
  Eye,
  FileText,
  Filter,
  ListChecks,
  Loader2,
  PackageCheck,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Truck,
  UserRound,
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
   ✅ صفحة الطلبات الرئيسية بنفس نمط صفحة المراكز
   ✅ استخدام UI الداخلي فقط
   ✅ ربط حقيقي مع /api/orders/
   ✅ دعم عربي / إنجليزي من primey-locale
   ✅ الأرقام دائمًا بالإنجليزية
   ✅ استخدام رمز SAR من /currency/sar.svg
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
  pagination?: {
    page?: number;
    page_size?: number;
    total_pages?: number;
    total_items?: number;
    has_next?: boolean;
    has_previous?: boolean;
  };
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
    pageTitle: isArabic ? "إدارة الطلبات" : "Orders Management",
    pageSubtitle: isArabic
      ? "متابعة طلبات العملاء، حالات الدفع، التنفيذ، والقيم المالية من بيانات حقيقية."
      : "Monitor customer orders, payment statuses, fulfillment, and financial values from live data.",

    addOrder: isArabic ? "إنشاء طلب" : "Create Order",
    ordersList: isArabic ? "قائمة الطلبات" : "Orders List",
    reports: isArabic ? "التقارير" : "Reports",
    export: isArabic ? "تصدير" : "Export",
    refresh: isArabic ? "تحديث" : "Refresh",

    featuredOrders: isArabic ? "أحدث الطلبات" : "Latest Orders",
    featuredSubtitle: isArabic
      ? "عرض مختصر لأحدث الطلبات حسب تاريخ الإنشاء."
      : "A compact view of the most recent orders by creation date.",

    trackStatus: isArabic ? "حالة الطلبات" : "Track Order Status",
    trackSubtitle: isArabic
      ? "تحليل سريع لحالة الطلبات والدفع والتنفيذ."
      : "Quick analysis of order, payment, and fulfillment statuses.",

    filterPlaceholder: isArabic ? "ابحث في الطلبات..." : "Filter orders...",
    columns: isArabic ? "الأعمدة" : "Columns",
    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",

    total: isArabic ? "الإجمالي" : "Total",
    open: isArabic ? "مفتوحة" : "Open",
    completed: isArabic ? "مكتملة" : "Completed",
    cancelled: isArabic ? "ملغاة" : "Cancelled",
    paid: isArabic ? "مدفوعة" : "Paid",
    unpaid: isArabic ? "غير مدفوعة" : "Unpaid",
    partiallyPaid: isArabic ? "مدفوعة جزئيًا" : "Partially Paid",
    failed: isArabic ? "فاشلة" : "Failed",
    unknown: isArabic ? "غير محدد" : "Unknown",

    newOrders: isArabic ? "طلبات جديدة" : "New Orders",
    operational: isArabic ? "تشغيلي" : "Operational",
    needsReview: isArabic ? "يحتاج متابعة" : "Needs Review",
    stopped: isArabic ? "متوقف" : "Stopped",

    totalValue: isArabic ? "إجمالي قيمة الطلبات" : "Total Order Value",
    paidValue: isArabic ? "إجمالي المدفوع" : "Total Paid",
    remainingValue: isArabic ? "إجمالي المتبقي" : "Total Remaining",

    table: {
      id: isArabic ? "رقم الطلب" : "Order No.",
      customer: isArabic ? "العميل" : "Customer",
      product: isArabic ? "المنتج" : "Product",
      amount: isArabic ? "المبلغ" : "Amount",
      payment: isArabic ? "الدفع" : "Payment",
      fulfillment: isArabic ? "التنفيذ" : "Fulfillment",
      status: isArabic ? "الحالة" : "Status",
      action: isArabic ? "الإجراء" : "Action",
    },

    emptyTitle: isArabic ? "لا توجد طلبات بعد" : "No orders yet",
    emptyText: isArabic
      ? "عند إنشاء طلب جديد من صفحة الإنشاء أو عبر النظام سيظهر هنا مباشرة."
      : "Orders created from the create page or system will appear here.",
    loading: isArabic ? "جاري تحميل بيانات الطلبات..." : "Loading orders data...",
    apiError: isArabic ? "تعذر تحميل بيانات الطلبات." : "Unable to load orders data.",
    refreshSuccess: isArabic
      ? "تم تحديث بيانات الطلبات بنجاح"
      : "Orders data refreshed successfully",

    quickAccessTitle: isArabic ? "إجراءات وحدة الطلبات" : "Orders Module Actions",
    quickAccessSubtitle: isArabic
      ? "اختصارات منظمة للوصول إلى أهم صفحات وحدة الطلبات بدون عرض روابط خام."
      : "Organized shortcuts to the key orders module pages without raw route text.",

    openAction: isArabic ? "فتح" : "Open",
    manage: isArabic ? "إدارة" : "Manage",
    view: isArabic ? "عرض" : "View",

    actionListTitle: isArabic ? "قائمة الطلبات" : "Orders List",
    actionListDesc: isArabic
      ? "استعراض جميع الطلبات، البحث، التصفية، وإدارة السجلات."
      : "Browse all orders, search, filter, and manage records.",

    actionCreateTitle: isArabic ? "إنشاء طلب" : "Create Order",
    actionCreateDesc: isArabic
      ? "إضافة طلب جديد وربط العميل بالمنتج مع السعر والحالة."
      : "Add a new order and link the customer with product, price, and status.",

    actionReportsTitle: isArabic ? "تقارير الطلبات" : "Orders Reports",
    actionReportsDesc: isArabic
      ? "عرض تقارير تشغيلية، فلاتر، جداول، تصدير وطباعة."
      : "View operational reports, filters, tables, export and print.",

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

function statusBadge(status: OrderStatus, locale: AppLocale) {
  const t = dictionary(locale);
  const label = t.statusLabels[status];

  if (status === "completed" || status === "confirmed") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (status === "pending" || status === "processing") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
        {label}
      </Badge>
    );
  }

  if (status === "cancelled" || status === "refunded") {
    return (
      <Badge className="rounded-full border-orange-200 bg-orange-50 px-3 py-1 text-orange-700 hover:bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300">
        {label}
      </Badge>
    );
  }

  if (status === "draft") {
    return (
      <Badge variant="outline" className="rounded-full px-3 py-1">
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="rounded-full px-3 py-1">
      {label}
    </Badge>
  );
}

function paymentBadge(status: PaymentStatus, locale: AppLocale) {
  const t = dictionary(locale);
  const label = t.paymentLabels[status];

  if (status === "paid") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (status === "partially_paid") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
        {label}
      </Badge>
    );
  }

  if (status === "failed" || status === "refunded") {
    return (
      <Badge className="rounded-full border-orange-200 bg-orange-50 px-3 py-1 text-orange-700 hover:bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300">
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="rounded-full px-3 py-1">
      {label}
    </Badge>
  );
}

function fulfillmentBadge(status: FulfillmentStatus, locale: AppLocale) {
  const t = dictionary(locale);
  const label = t.fulfillmentLabels[status];

  if (status === "issued" || status === "delivered") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (status === "in_progress") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
        {label}
      </Badge>
    );
  }

  if (status === "failed") {
    return (
      <Badge className="rounded-full border-orange-200 bg-orange-50 px-3 py-1 text-orange-700 hover:bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300">
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="rounded-full px-3 py-1">
      {label}
    </Badge>
  );
}

/* ============================================================
   ✅ Page
============================================================ */

export default function SystemOrdersPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");

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
        order.status.toLowerCase().includes(cleanQuery) ||
        order.paymentStatus.toLowerCase().includes(cleanQuery) ||
        order.fulfillmentStatus.toLowerCase().includes(cleanQuery) ||
        order.source.toLowerCase().includes(cleanQuery)
      );
    });
  }, [orders, query]);

  const stats = useMemo(() => {
    const total = orders.length;

    const completed = orders.filter((item) => item.status === "completed").length;

    const cancelled = orders.filter((item) =>
      ["cancelled", "refunded"].includes(item.status),
    ).length;

    const open = orders.filter(
      (item) => !["completed", "cancelled", "refunded"].includes(item.status),
    ).length;

    const paid = orders.filter((item) => item.paymentStatus === "paid").length;

    const unpaid = orders.filter((item) => item.paymentStatus === "unpaid").length;

    const partiallyPaid = orders.filter(
      (item) => item.paymentStatus === "partially_paid",
    ).length;

    const failedPayments = orders.filter(
      (item) => item.paymentStatus === "failed",
    ).length;

    const totalValue = orders.reduce((sum, item) => sum + item.totalAmount, 0);
    const paidValue = orders.reduce((sum, item) => sum + item.amountPaid, 0);
    const remainingValue = orders.reduce(
      (sum, item) => sum + item.remainingAmount,
      0,
    );

    return {
      total,
      open,
      completed,
      cancelled,
      paid,
      unpaid,
      partiallyPaid,
      failedPayments,
      totalValue,
      paidValue,
      remainingValue,
    };
  }, [orders]);

  const latestOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      })
      .slice(0, 6);
  }, [orders]);

  const tableRows = useMemo(() => filteredOrders.slice(0, 8), [filteredOrders]);

  const statusCards = useMemo(
    () => [
      {
        title: t.total,
        value: stats.total,
        helper: t.newOrders,
        helperValue: "+0.0%",
        icon: ShoppingBag,
        percent: 100,
      },
      {
        title: t.open,
        value: stats.open,
        helper: t.needsReview,
        helperValue: `${percent(stats.open, stats.total)}%`,
        icon: Activity,
        percent: percent(stats.open, stats.total),
      },
      {
        title: t.completed,
        value: stats.completed,
        helper: t.operational,
        helperValue: `${percent(stats.completed, stats.total)}%`,
        icon: BadgeCheck,
        percent: percent(stats.completed, stats.total),
      },
      {
        title: t.cancelled,
        value: stats.cancelled,
        helper: t.stopped,
        helperValue: `${percent(stats.cancelled, stats.total)}%`,
        icon: ShieldCheck,
        percent: percent(stats.cancelled, stats.total),
      },
    ],
    [stats, t],
  );

  const moduleActions = useMemo(
    () => [
      {
        title: t.actionListTitle,
        description: t.actionListDesc,
        href: "/system/orders/list",
        icon: ListChecks,
        badge: `${orders.length}`,
        cta: t.manage,
      },
      {
        title: t.actionCreateTitle,
        description: t.actionCreateDesc,
        href: "/system/orders/create",
        icon: Plus,
        badge: isArabic ? "جديد" : "New",
        cta: t.openAction,
      },
      {
        title: t.actionReportsTitle,
        description: t.actionReportsDesc,
        href: "/system/orders/reports",
        icon: BarChart3,
        badge: isArabic ? "تحليل" : "Reports",
        cta: t.view,
      },
    ],
    [orders.length, isArabic, t],
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
      console.error("Failed to load orders:", error);
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
    <div className="space-y-4">
      {/* =====================================================
          Header
      ====================================================== */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
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

          <Link href="/system/orders/reports">
            <Button variant="outline" className="h-10 w-full rounded-xl sm:w-auto">
              <BarChart3 className="h-4 w-4" />
              <span>{t.reports}</span>
            </Button>
          </Link>

          <Link href="/system/orders/create">
            <Button className="h-10 w-full rounded-xl sm:w-auto">
              <Plus className="h-4 w-4" />
              <span>{t.addOrder}</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* =====================================================
          Main Layout
      ====================================================== */}
      <div className="grid gap-4 xl:grid-cols-3">
        {/* Latest Orders */}
        <Card className="rounded-2xl border bg-card shadow-sm xl:col-span-1">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-bold">
                {t.featuredOrders}
              </CardTitle>
              <CardDescription className="mt-1 text-sm">
                {t.featuredSubtitle}
              </CardDescription>
            </div>

            <Link href="/system/orders/list">
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl">
                <ListChecks className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>

          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t.loading}</span>
              </div>
            ) : latestOrders.length === 0 ? (
              <div className="rounded-xl border border-dashed p-5 text-center">
                <p className="font-semibold">{t.emptyTitle}</p>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  {t.emptyText}
                </p>
              </div>
            ) : (
              latestOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/system/orders/${order.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3 transition hover:bg-muted/50">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <ShoppingBag className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">
                            {order.orderNumber || `#${order.id}`}
                          </p>
                        </div>

                        <p className="text-muted-foreground mt-1 truncate text-xs">
                          {order.customerName}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-end">
                      <CurrencyAmount value={order.totalAmount} />
                      <p className="text-muted-foreground mt-1 text-xs">
                        {t.sourceLabels[order.source]}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Status + Table */}
        <Card className="rounded-2xl border bg-card shadow-sm xl:col-span-2">
          <CardHeader className="flex flex-col gap-3 pb-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base font-bold">
                {t.trackStatus}
              </CardTitle>
              <CardDescription className="mt-1 text-sm">
                {t.trackSubtitle}
              </CardDescription>
            </div>

            <Button variant="outline" className="h-9 rounded-xl">
              <Download className="h-4 w-4" />
              <span>{t.export}</span>
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Status Cards */}
            <div className="grid gap-3 md:grid-cols-4">
              {statusCards.map((card) => {
                const Icon = card.icon;

                return (
                  <div key={card.title} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Icon className="text-muted-foreground h-4 w-4" />
                      <p className="text-2xl font-bold">
                        {isLoading ? "..." : formatNumber(card.value)}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-muted-foreground text-sm">
                          {card.title}
                        </p>
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          {card.helperValue}
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${card.percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Finance Summary */}
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {t.totalValue}
                    </p>
                    <div className="mt-2 text-xl font-bold">
                      <CurrencyAmount value={stats.totalValue} />
                    </div>
                  </div>
                  <Wallet className="text-muted-foreground h-5 w-5" />
                </div>
              </div>

              <div className="rounded-xl border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {t.paidValue}
                    </p>
                    <div className="mt-2 text-xl font-bold">
                      <CurrencyAmount value={stats.paidValue} />
                    </div>
                  </div>
                  <CreditCard className="text-muted-foreground h-5 w-5" />
                </div>
              </div>

              <div className="rounded-xl border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {t.remainingValue}
                    </p>
                    <div className="mt-2 text-xl font-bold">
                      <CurrencyAmount value={stats.remainingValue} />
                    </div>
                  </div>
                  <Activity className="text-muted-foreground h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Filter */}
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="relative">
                <Search
                  className={`text-muted-foreground absolute top-1/2 h-4 w-4 -translate-y-1/2 ${
                    isArabic ? "right-3" : "left-3"
                  }`}
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t.filterPlaceholder}
                  className={`h-10 rounded-xl ${
                    isArabic ? "pr-10" : "pl-10"
                  }`}
                />
              </div>

              <Button variant="outline" className="h-10 rounded-xl">
                <Filter className="h-4 w-4" />
                <span>{t.columns}</span>
              </Button>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.table.id}</TableHead>
                    <TableHead>{t.table.customer}</TableHead>
                    <TableHead>{t.table.product}</TableHead>
                    <TableHead>{t.table.amount}</TableHead>
                    <TableHead>{t.table.payment}</TableHead>
                    <TableHead>{t.table.fulfillment}</TableHead>
                    <TableHead>{t.table.status}</TableHead>
                    <TableHead>{t.table.action}</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>{t.loading}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : tableRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <div className="py-12 text-center">
                          <p className="font-semibold">{t.emptyTitle}</p>
                          <p className="text-muted-foreground mt-2 text-sm">
                            {t.emptyText}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    tableRows.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
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

                        <TableCell>{paymentBadge(order.paymentStatus, locale)}</TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Truck className="text-muted-foreground h-3.5 w-3.5" />
                            {fulfillmentBadge(order.fulfillmentStatus, locale)}
                          </div>
                        </TableCell>

                        <TableCell>{statusBadge(order.status, locale)}</TableCell>

                        <TableCell>
                          <Link href={`/system/orders/${order.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Footer */}
            <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>
                {formatNumber(filteredOrders.length)} / {formatNumber(orders.length)}
              </p>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="rounded-xl" disabled>
                  {t.previous}
                </Button>

                <Link href="/system/orders/list">
                  <Button variant="outline" size="sm" className="rounded-xl">
                    <ListChecks className="h-4 w-4" />
                    {t.next}
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* =====================================================
          Professional Action Cards
      ====================================================== */}
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold">
            {t.quickAccessTitle}
          </CardTitle>
          <CardDescription>{t.quickAccessSubtitle}</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {moduleActions.map((item) => {
              const Icon = item.icon as ElementType;

              return (
                <Link key={item.href} href={item.href} className="block">
                  <Card className="h-full rounded-2xl border bg-background shadow-none transition hover:bg-muted/40 hover:shadow-sm">
                    <CardContent className="flex h-full items-start justify-between gap-4 p-4">
                      <div className="min-w-0 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                            <Icon className="h-5 w-5" />
                          </div>

                          <Badge variant="secondary" className="rounded-full">
                            {item.badge}
                          </Badge>
                        </div>

                        <div>
                          <p className="font-semibold">{item.title}</p>
                          <p className="text-muted-foreground mt-1 line-clamp-2 text-sm leading-6">
                            {item.description}
                          </p>
                        </div>

                        <Button variant="outline" size="sm" className="rounded-xl">
                          {item.cta}
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
    </div>
  );
}