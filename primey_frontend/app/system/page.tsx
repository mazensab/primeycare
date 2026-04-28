"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  Bell,
  BookOpenCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Download,
  Gauge,
  HandCoins,
  HeartPulse,
  Landmark,
  LayoutDashboard,
  Loader2,
  MessageCircle,
  Package,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Truck,
  UserRound,
  Users,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import { API_PATHS, apiGet, getDataObject, getResults } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

/* ============================================================
   📂 app/system/page.tsx
   Primey Care - System Dashboard
   ------------------------------------------------------------
   ✅ مربوط من ملفات API الأصلية فقط
   ✅ بدون إنشاء API جديد للداشبورد
   ✅ بدون hardcoded localhost
   ✅ يعتمد على lib/api.ts
   ✅ يدعم اللوكل والإنتاج عبر /api + next.config rewrite
   ✅ يدعم تبديل اللغة من الهيدر عبر primey-locale
   ✅ يدعم RTL / LTR
   ✅ إصلاح LatestOperation status type
   ✅ إصلاح getDataObject generic constraint
============================================================ */

type AppLocale = "ar" | "en";
type MetricTone = "success" | "warning" | "info" | "danger" | "neutral";
type LoadState = "idle" | "loading" | "ready" | "error";

type ApiPagination = {
  page?: number;
  page_size?: number;
  total_pages?: number;
  total_items?: number;
  has_next?: boolean;
  has_previous?: boolean;
};

type ListPayload<T> = {
  ok?: boolean;
  message?: string;
  count?: number;
  results?: T[];
  pagination?: ApiPagination;
  meta?: ApiPagination & Record<string, unknown>;
  data?: unknown;
};

type CustomerMini = {
  id?: number;
  full_name?: string;
  phone?: string;
  email?: string;
  status?: string;
};

type ProductMini = {
  id?: number;
  name?: string;
  code?: string;
  product_type?: string;
  status?: string;
  billing_type?: string;
  effective_price?: string;
  price?: string;
};

type OrderItem = {
  id: number;
  order_number?: string;
  customer_id?: number;
  customer?: CustomerMini | null;
  product_id?: number;
  product?: ProductMini | null;
  status?: string;
  payment_status?: string;
  fulfillment_status?: string;
  source?: string;
  product_name?: string;
  product_type?: string;
  currency_code?: string;
  total_amount?: string;
  amount_paid?: string;
  remaining_amount?: string;
  is_paid?: boolean;
  issue_reference?: string;
  issued_at?: string | null;
  created_at?: string | null;
};

type OrderLineItem = {
  id: number;
  order_id?: number;
  order?: {
    id?: number;
    order_number?: string;
    status?: string;
    payment_status?: string;
    customer_id?: number;
    customer_name?: string;
  } | null;
  product?: ProductMini | null;
  provider?: {
    id?: number;
    name?: string;
    status?: string;
    provider_type?: string;
  } | null;
  service_item?: {
    id?: number;
    name?: string;
    status?: string;
    coverage_type?: string;
    requires_approval?: boolean;
  } | null;
  title?: string;
  status?: string;
  fulfillment_status?: string;
  total_amount?: string;
  requires_approval?: boolean;
  scheduled_at?: string | null;
  fulfilled_at?: string | null;
  created_at?: string | null;
};

type ProductItem = {
  id: number;
  code?: string;
  name?: string;
  product_type?: string;
  status?: string;
  billing_type?: string;
  currency_code?: string;
  price?: string;
  sale_price?: string | null;
  effective_price?: string;
  is_public?: boolean;
  is_featured?: boolean;
  allow_online_purchase?: boolean;
  created_at?: string | null;
};

type InvoiceItem = {
  id: number;
  number?: string;
  status?: string;
  customer_id?: number;
  order_id?: number;
  subtotal?: string;
  tax_amount?: string;
  total_amount?: string;
  invoice_date?: string | null;
};

type PaymentItem = {
  id: number;
  reference?: string;
  status?: string;
  payment_method?: string;
  invoice_id?: number;
  customer_id?: number;
  amount?: string;
  payment_date?: string | null;
};

type AgentCommissionItem = {
  id: number;
  reference?: string;
  status?: string;
  agent_id?: number;
  invoice_id?: number;
  order_id?: number;
  amount?: string;
  approval_date?: string | null;
};

type ProviderItem = {
  id: number;
  name?: string;
  code?: string;
  provider_type?: string;
  status?: string;
  city?: string;
  area?: string;
  mobile?: string;
  email?: string;
  is_featured?: boolean;
};

type ContractItem = {
  id: number;
  provider_id?: number;
  provider?: {
    id?: number;
    name?: string;
    status?: string;
    provider_type?: string;
  } | null;
  title?: string;
  contract_number?: string;
  status?: string;
  start_date?: string | null;
  end_date?: string | null;
  pricing_model?: string;
  discount_percentage?: string;
};

type ServiceItem = {
  id: number;
  contract_id?: number;
  name?: string;
  code?: string;
  status?: string;
  coverage_type?: string;
  base_price?: string | null;
  special_price?: string | null;
  discount_percentage?: string;
  requires_approval?: boolean;
  is_featured?: boolean;
};

type NotificationOverview = Record<string, unknown> & {
  counts?: {
    notifications?: number;
    events?: number;
    deliveries?: number;
    unread_notifications?: number;
    failed_deliveries?: number;
    pending_events?: number;
  };
};

type SystemLogSummary = Record<string, unknown> & {
  counts?: {
    total_logs?: number;
    system_scope_logs?: number;
    company_scope_logs?: number;
    critical_logs?: number;
    error_logs?: number;
    warning_logs?: number;
    info_logs?: number;
  };
  recent_logs?: Array<{
    id?: number;
    module?: string;
    action?: string;
    event_code?: string;
    severity?: string;
    message?: string;
    created_at?: string;
  }>;
};

type DashboardData = {
  orders: OrderItem[];
  openOrders: OrderItem[];
  orderItems: OrderLineItem[];
  pendingOrderItems: OrderLineItem[];
  products: ProductItem[];
  invoices: InvoiceItem[];
  payments: PaymentItem[];
  agents: AgentCommissionItem[];
  providers: ProviderItem[];
  contracts: ContractItem[];
  serviceItems: ServiceItem[];
  activeServiceItems: ServiceItem[];
  notificationOverview: NotificationOverview | null;
  systemLogSummary: SystemLogSummary | null;
  totals: {
    orders: number;
    openOrders: number;
    orderItems: number;
    pendingOrderItems: number;
    products: number;
    invoices: number;
    payments: number;
    agents: number;
    providers: number;
    contracts: number;
    serviceItems: number;
    activeServiceItems: number;
  };
};

type MetricCard = {
  title: string;
  value: string;
  note: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  isMoney?: boolean;
  tone: MetricTone;
};

type OperationStatus = {
  title: string;
  value: string;
  note: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  tone: MetricTone;
};

type LatestCustomer = {
  name: string;
  phone: string;
  product: string;
  status: string;
  amount: string;
  href: string;
};

type LatestOperationStatus = "success" | "warning" | "info";

type LatestOperation = {
  title: string;
  module: string;
  time: string;
  href: string;
  status: LatestOperationStatus;
};

type ServiceHealth = {
  title: string;
  description: string;
  href: string;
  status: "ready" | "monitor" | "partial";
  value: string;
  icon: ComponentType<{ className?: string }>;
};

type QuickLink = {
  title: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

const PRIMEY_LOCALE_STORAGE_KEY = "primey-locale";

function getStoredLocale(): AppLocale {
  try {
    if (typeof window === "undefined") return "ar";

    const savedLocale = window.localStorage.getItem(PRIMEY_LOCALE_STORAGE_KEY);
    return savedLocale === "en" ? "en" : "ar";
  } catch (error) {
    console.error("Read locale error:", error);
    return "ar";
  }
}

function applyLocaleToDocument(nextLocale: AppLocale) {
  if (typeof document === "undefined") return;

  document.documentElement.lang = nextLocale;
  document.documentElement.dir = nextLocale === "ar" ? "rtl" : "ltr";
  document.body.setAttribute("dir", nextLocale === "ar" ? "rtl" : "ltr");
}

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    pageTitle: isArabic ? "لوحة تحكم النظام" : "System Dashboard",
    pageSubtitle: isArabic
      ? "ملخص تشغيلي مباشر من APIs الأصلية لإدارة الطلبات، البطاقات المصدرة، التوصيل، البرامج، العملاء، المراكز، المندوبين، الفواتير، المدفوعات، المحاسبة، والتنبيهات."
      : "A live operational summary from the original APIs for orders, issued cards, delivery, programs, customers, centers, agents, invoices, payments, accounting, and notifications.",
    dateRange: isArabic ? "آخر البيانات المتاحة" : "Latest available data",
    refresh: isArabic ? "تحديث" : "Refresh",
    export: isArabic ? "تصدير" : "Export",
    livePreview: isArabic
      ? "تم ربط الصفحة من المسارات الأصلية الحالية بدون إنشاء API جديد للداشبورد."
      : "This page is connected to the current original API routes without creating a new dashboard API.",
    mainIndicators: isArabic ? "المؤشرات الرئيسية" : "Main Indicators",
    operationsSummary: isArabic ? "ملخص التشغيل" : "Operations Summary",
    operationsSummaryDesc: isArabic
      ? "حالة الطلبات والبطاقات والتوصيل والبرامج من البيانات الحقيقية المتاحة."
      : "Orders, cards, delivery, and programs from the available live data.",
    latestCustomers: isArabic ? "آخر العملاء من الطلبات" : "Latest Customers From Orders",
    latestCustomersDesc: isArabic
      ? "آخر العملاء المرتبطين بالطلبات حسب البيانات الراجعة من API."
      : "Latest customers linked to orders based on API data.",
    latestOperations: isArabic ? "آخر العمليات" : "Latest Operations",
    latestOperationsDesc: isArabic
      ? "آخر حركة تشغيلية من سجل النظام والطلبات والمدفوعات."
      : "Latest operational activity from system logs, orders, and payments.",
    serviceHealth: isArabic ? "حالة خدمات النظام" : "System Services Health",
    serviceHealthDesc: isArabic
      ? "جاهزية الموديولات الأساسية حسب البيانات الراجعة من APIs."
      : "Core module readiness based on API responses.",
    financialShortcuts: isArabic ? "المحاسبة والتقارير" : "Accounting & Reports",
    financialShortcutsDesc: isArabic
      ? "اختصارات مباشرة للتقارير المالية والقيود."
      : "Direct shortcuts to financial reports and journals.",
    quickActions: isArabic ? "إجراءات سريعة" : "Quick Actions",
    customer: isArabic ? "العميل" : "Customer",
    product: isArabic ? "المنتج / البرنامج" : "Product / Program",
    status: isArabic ? "الحالة" : "Status",
    amount: isArabic ? "المبلغ" : "Amount",
    viewAll: isArabic ? "عرض الكل" : "View All",
    ready: isArabic ? "جاهز" : "Ready",
    monitor: isArabic ? "متابعة" : "Monitor",
    partial: isArabic ? "جزئي" : "Partial",
    success: isArabic ? "مكتمل" : "Success",
    warning: isArabic ? "تنبيه" : "Warning",
    info: isArabic ? "معلومة" : "Info",
    loading: isArabic ? "جاري تحميل بيانات النظام..." : "Loading system data...",
    loadError: isArabic
      ? "تعذر تحميل بعض بيانات الداشبورد. تأكد من تشغيل Django وتسجيل الدخول."
      : "Unable to load some dashboard data. Make sure Django is running and you are logged in.",
    empty: isArabic ? "لا توجد بيانات كافية بعد." : "No enough data yet.",
    currencyAlt: isArabic ? "ريال سعودي" : "Saudi Riyal",
    systemWorkspace: isArabic ? "مساحة النظام" : "System Workspace",
    primeyCare: "Primey Care",
    openSystemLog: isArabic ? "متابعة سجل النظام" : "Open System Log",
    loadDescription: isArabic
      ? "يتم تحميل البيانات من مسارات الطلبات، المنتجات، المدفوعات، الفواتير، المراكز، العقود، التنبيهات، وسجل النظام."
      : "Loading data from orders, products, payments, invoices, providers, contracts, notifications, and system log routes.",
    apiOrders: isArabic ? "من API الطلبات" : "From orders API",
    issuedNote: isArabic ? "حسب issued_at أو مرجع الإصدار" : "Based on issued_at or issue reference",
    deliveryNote: isArabic ? "طلبات تحتاج متابعة تنفيذ" : "Orders need fulfillment follow-up",
    programsNote: isArabic ? "منتجات برامج أو عضويات" : "Program or membership products",
    confirmedPaymentsNote: isArabic ? "دفعة مؤكدة" : "confirmed payments",
    openInvoicesNote: isArabic ? "تحتاج متابعة مالية" : "Need finance follow-up",
  };
}

function toNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toMoney(value: unknown) {
  return toNumber(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function moneyValue(value: string, alt: string) {
  return (
    <span className="inline-flex items-center gap-1.5" dir="ltr">
      <span>{value}</span>
      <Image
        src="/currency/sar.svg"
        alt={alt}
        width={17}
        height={17}
        className="inline-block"
      />
    </span>
  );
}

function toneClass(tone: MetricTone) {
  if (tone === "success") return "bg-emerald-500/10 text-emerald-700";
  if (tone === "warning") return "bg-amber-500/10 text-amber-700";
  if (tone === "danger") return "bg-red-500/10 text-red-700";
  if (tone === "info") return "bg-blue-500/10 text-blue-700";
  return "bg-muted text-foreground";
}

function isPaidStatus(status?: string) {
  const normalized = String(status || "").toUpperCase();
  return ["PAID", "COMPLETED", "CONFIRMED", "PARTIALLY_PAID"].includes(
    normalized,
  );
}

function isSuccessOperationStatus(status?: string) {
  const normalized = String(status || "").toUpperCase();
  return ["PAID", "COMPLETED", "CONFIRMED", "APPROVED", "ISSUED"].includes(
    normalized,
  );
}

function isOpenInvoice(status?: string) {
  const normalized = String(status || "").toUpperCase();
  return !["PAID", "CANCELLED", "VOID", "REFUNDED"].includes(normalized);
}

function isIssuedOrder(order: OrderItem) {
  return Boolean(order.issued_at || order.issue_reference);
}

function isWaitingDelivery(order: OrderItem) {
  const fulfillment = String(order.fulfillment_status || "").toUpperCase();
  const status = String(order.status || "").toUpperCase();

  return (
    fulfillment.includes("DELIVERY") ||
    fulfillment.includes("PENDING") ||
    fulfillment.includes("NOT_STARTED") ||
    status.includes("ISSUED")
  );
}

function isSubscriptionProduct(product: ProductItem) {
  const billing = String(product.billing_type || "").toUpperCase();
  const type = String(product.product_type || "").toUpperCase();

  return (
    billing.includes("MONTH") ||
    billing.includes("YEAR") ||
    billing.includes("SUBSCRIPTION") ||
    type.includes("MEMBERSHIP") ||
    type.includes("PROGRAM")
  );
}

function formatRelativeTime(value?: string | null, locale: AppLocale = "ar") {
  const isArabic = locale === "ar";

  if (!value) return isArabic ? "اليوم" : "Today";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return isArabic ? "اليوم" : "Today";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return isArabic ? "الآن" : "Now";

  if (diffMinutes < 60) {
    return isArabic ? `قبل ${diffMinutes} دقيقة` : `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return isArabic
      ? `قبل ${diffHours} ساعة`
      : `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays < 7) {
    return isArabic
      ? `قبل ${diffDays} يوم`
      : `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  }

  return date.toLocaleDateString(isArabic ? "ar-SA" : "en-US");
}

function statusLabel(value?: string, locale: AppLocale = "ar") {
  const isArabic = locale === "ar";

  if (!value) return isArabic ? "غير محدد" : "Undefined";

  const arMap: Record<string, string> = {
    DRAFT: "مسودة",
    PENDING: "معلق",
    ACTIVE: "نشط",
    PAID: "مدفوع",
    COMPLETED: "مكتمل",
    ISSUED: "مصدرة",
    PARTIALLY_PAID: "مدفوع جزئيًا",
    CANCELLED: "ملغي",
    FAILED: "فاشل",
    REFUNDED: "مسترجع",
    UNPAID: "غير مدفوع",
    NOT_STARTED: "لم يبدأ",
    IN_PROGRESS: "قيد التنفيذ",
    FULFILLED: "منفذ",
    APPROVED: "معتمد",
  };

  const enMap: Record<string, string> = {
    DRAFT: "Draft",
    PENDING: "Pending",
    ACTIVE: "Active",
    PAID: "Paid",
    COMPLETED: "Completed",
    ISSUED: "Issued",
    PARTIALLY_PAID: "Partially Paid",
    CANCELLED: "Cancelled",
    FAILED: "Failed",
    REFUNDED: "Refunded",
    UNPAID: "Unpaid",
    NOT_STARTED: "Not Started",
    IN_PROGRESS: "In Progress",
    FULFILLED: "Fulfilled",
    APPROVED: "Approved",
  };

  const normalized = String(value).toUpperCase();
  return (isArabic ? arMap : enMap)[normalized] || value;
}

function serviceStatusBadge(
  status: ServiceHealth["status"],
  labels: ReturnType<typeof dictionary>,
) {
  if (status === "ready") {
    return (
      <Badge className="rounded-full px-3 py-1">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {labels.ready}
      </Badge>
    );
  }

  if (status === "monitor") {
    return (
      <Badge variant="secondary" className="rounded-full px-3 py-1">
        <Activity className="h-3.5 w-3.5" />
        {labels.monitor}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="rounded-full px-3 py-1">
      <RefreshCcw className="h-3.5 w-3.5" />
      {labels.partial}
    </Badge>
  );
}

function activityBadge(
  status: LatestOperation["status"],
  labels: ReturnType<typeof dictionary>,
) {
  if (status === "success") {
    return <Badge className="rounded-full px-3 py-1">{labels.success}</Badge>;
  }

  if (status === "warning") {
    return (
      <Badge variant="secondary" className="rounded-full px-3 py-1">
        {labels.warning}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="rounded-full px-3 py-1">
      {labels.info}
    </Badge>
  );
}

function MetricCardItem({
  item,
  labels,
  isArabic,
}: {
  item: MetricCard;
  labels: ReturnType<typeof dictionary>;
  isArabic: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link href={item.href}>
      <Card className="h-full rounded-2xl border-border/60 bg-background shadow-sm transition hover:bg-muted/20">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className={isArabic ? "text-right" : "text-left"}>
              <p className="text-xs font-medium text-muted-foreground">
                {item.title}
              </p>

              <div className="mt-2 text-2xl font-bold tracking-tight">
                {item.isMoney
                  ? moneyValue(item.value, labels.currencyAlt)
                  : item.value}
              </div>

              <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
                {item.note}
              </p>
            </div>

            <div className={`rounded-2xl p-2.5 ${toneClass(item.tone)}`}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function OperationStatusCard({
  item,
  isArabic,
}: {
  item: OperationStatus;
  isArabic: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link href={item.href}>
      <div className="rounded-2xl border border-border/60 bg-muted/10 p-4 transition hover:bg-muted/30">
        <div className="flex items-start justify-between gap-3">
          <div className={isArabic ? "text-right" : "text-left"}>
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="mt-2 text-3xl font-bold">{item.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
          </div>

          <div className={`rounded-xl p-2.5 ${toneClass(item.tone)}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function OperationsSummary({
  labels,
  items,
  isArabic,
}: {
  labels: ReturnType<typeof dictionary>;
  items: OperationStatus[];
  isArabic: boolean;
}) {
  return (
    <Card className="rounded-2xl border-border/60 bg-background shadow-sm">
      <CardHeader className="pb-3">
        <div className={isArabic ? "text-right" : "text-left"}>
          <CardTitle className="text-base">{labels.operationsSummary}</CardTitle>
          <CardDescription>{labels.operationsSummaryDesc}</CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => (
            <OperationStatusCard
              key={item.title}
              item={item}
              isArabic={isArabic}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LatestCustomersTable({
  labels,
  rows,
  isArabic,
}: {
  labels: ReturnType<typeof dictionary>;
  rows: LatestCustomer[];
  isArabic: boolean;
}) {
  return (
    <Card className="h-full rounded-2xl border-border/60 bg-background shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className={isArabic ? "text-right" : "text-left"}>
            <CardTitle className="text-base">{labels.latestCustomers}</CardTitle>
            <CardDescription>{labels.latestCustomersDesc}</CardDescription>
          </div>

          <Link href="/system/customers">
            <Button variant="outline" size="sm" className="rounded-xl">
              {labels.viewAll}
            </Button>
          </Link>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-hidden rounded-2xl border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={isArabic ? "text-right" : "text-left"}>
                  {labels.customer}
                </TableHead>
                <TableHead className={isArabic ? "text-right" : "text-left"}>
                  {labels.product}
                </TableHead>
                <TableHead className={isArabic ? "text-right" : "text-left"}>
                  {labels.status}
                </TableHead>
                <TableHead className={isArabic ? "text-right" : "text-left"}>
                  {labels.amount}
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.length ? (
                rows.map((row) => (
                  <TableRow key={`${row.name}-${row.href}`}>
                    <TableCell>
                      <Link href={row.href} className="block">
                        <div className={isArabic ? "text-right" : "text-left"}>
                          <p className="font-medium">{row.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.phone || "—"}
                          </p>
                        </div>
                      </Link>
                    </TableCell>

                    <TableCell>{row.product || "—"}</TableCell>

                    <TableCell>
                      <Badge variant="outline" className="rounded-full px-3 py-1">
                        {row.status}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      {moneyValue(row.amount, labels.currencyAlt)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {labels.empty}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function LatestOperationsCard({
  labels,
  rows,
  isArabic,
}: {
  labels: ReturnType<typeof dictionary>;
  rows: LatestOperation[];
  isArabic: boolean;
}) {
  return (
    <Card className="h-full rounded-2xl border-border/60 bg-background shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className={isArabic ? "text-right" : "text-left"}>
            <CardTitle className="text-base">{labels.latestOperations}</CardTitle>
            <CardDescription>{labels.latestOperationsDesc}</CardDescription>
          </div>

          <Link href="/system/system-log">
            <Button variant="outline" size="sm" className="rounded-xl">
              {labels.viewAll}
            </Button>
          </Link>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {rows.length ? (
          rows.map((row) => (
            <Link
              key={`${row.title}-${row.time}-${row.href}`}
              href={row.href}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/10 p-3 transition hover:bg-muted/30"
            >
              <div className={isArabic ? "text-right" : "text-left"}>
                <p className="font-medium">{row.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.module} • {row.time}
                </p>
              </div>

              {activityBadge(row.status, labels)}
            </Link>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            {labels.empty}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ServiceHealthGrid({
  labels,
  services,
  isArabic,
}: {
  labels: ReturnType<typeof dictionary>;
  services: ServiceHealth[];
  isArabic: boolean;
}) {
  return (
    <Card className="rounded-2xl border-border/60 bg-background shadow-sm">
      <CardHeader className="pb-3">
        <div className={isArabic ? "text-right" : "text-left"}>
          <CardTitle className="text-base">{labels.serviceHealth}</CardTitle>
          <CardDescription>{labels.serviceHealthDesc}</CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {services.map((service) => {
            const Icon = service.icon;

            return (
              <Link
                key={service.href}
                href={service.href}
                className="rounded-2xl border border-border/60 bg-muted/10 p-4 transition hover:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={isArabic ? "text-right" : "text-left"}>
                    <div className="flex items-center gap-2">
                      <div className="rounded-xl bg-background p-2 shadow-sm">
                        <Icon className="h-4 w-4" />
                      </div>
                      <p className="font-semibold">{service.title}</p>
                    </div>

                    <p className="mt-2 text-2xl font-bold">{service.value}</p>

                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {service.description}
                    </p>

                    <div className="mt-4">
                      {serviceStatusBadge(service.status, labels)}
                    </div>
                  </div>

                  <ArrowLeft
                    className={`mt-2 h-4 w-4 text-muted-foreground ${
                      isArabic ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickLinksCard({
  labels,
  links,
  isArabic,
}: {
  labels: ReturnType<typeof dictionary>;
  links: QuickLink[];
  isArabic: boolean;
}) {
  return (
    <Card className="h-full rounded-2xl border-border/60 bg-background shadow-sm">
      <CardHeader className="pb-3">
        <div className={isArabic ? "text-right" : "text-left"}>
          <CardTitle className="text-base">{labels.quickActions}</CardTitle>
          <CardDescription>
            {isArabic
              ? "اختصارات تشغيلية لإدارة النظام بسرعة."
              : "Operational shortcuts for faster system management."}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {links.map((link) => {
          const Icon = link.icon;

          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/10 p-3 transition hover:bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-background p-2 shadow-sm">
                  <Icon className="h-4 w-4" />
                </div>

                <div className={isArabic ? "text-right" : "text-left"}>
                  <p className="font-medium">{link.title}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {link.description}
                  </p>
                </div>
              </div>

              <ArrowLeft
                className={`h-4 w-4 text-muted-foreground ${
                  isArabic ? "rotate-180" : ""
                }`}
              />
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}

function FinancialReportsCard({
  labels,
  links,
  isArabic,
}: {
  labels: ReturnType<typeof dictionary>;
  links: QuickLink[];
  isArabic: boolean;
}) {
  return (
    <Card className="rounded-2xl border-border/60 bg-background shadow-sm">
      <CardHeader className="pb-3">
        <div className={isArabic ? "text-right" : "text-left"}>
          <CardTitle className="text-base">
            {labels.financialShortcuts}
          </CardTitle>
          <CardDescription>{labels.financialShortcutsDesc}</CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {links.map((link) => {
            const Icon = link.icon;

            return (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-2xl border border-border/60 bg-muted/10 p-4 transition hover:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={isArabic ? "text-right" : "text-left"}>
                    <p className="font-semibold">{link.title}</p>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {link.description}
                    </p>
                  </div>

                  <div className="rounded-xl bg-background p-2 shadow-sm">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

async function loadSystemDashboardData(): Promise<DashboardData> {
  const [
    ordersResponse,
    openOrdersResponse,
    orderItemsResponse,
    pendingOrderItemsResponse,
    productsResponse,
    invoicesResponse,
    paymentsResponse,
    agentsResponse,
    providersResponse,
    contractsResponse,
    serviceItemsResponse,
    activeServiceItemsResponse,
    notificationResponse,
    systemLogResponse,
  ] = await Promise.allSettled([
    apiGet<ListPayload<OrderItem>>(API_PATHS.orders.list, {
      page_size: 100,
    }),
    apiGet<ListPayload<OrderItem>>(API_PATHS.orders.open, {
      page_size: 100,
    }),
    apiGet<ListPayload<OrderLineItem>>(API_PATHS.orderItems.list, {
      page_size: 100,
    }),
    apiGet<ListPayload<OrderLineItem>>(API_PATHS.orderItems.pending, {
      page_size: 100,
    }),
    apiGet<ListPayload<ProductItem>>(API_PATHS.products.list, {
      page_size: 100,
    }),
    apiGet<ListPayload<InvoiceItem>>(API_PATHS.invoices.list, {
      limit: 100,
    }),
    apiGet<ListPayload<PaymentItem>>(API_PATHS.payments.list, {
      limit: 100,
    }),
    apiGet<ListPayload<AgentCommissionItem>>(API_PATHS.agents.list, {
      limit: 100,
    }),
    apiGet<ListPayload<ProviderItem>>(API_PATHS.providers.list, {
      page_size: 100,
    }),
    apiGet<ListPayload<ContractItem>>(API_PATHS.contracts.list, {
      page_size: 100,
    }),
    apiGet<ListPayload<ServiceItem>>(API_PATHS.serviceItems.list, {
      page_size: 100,
    }),
    apiGet<ListPayload<ServiceItem>>(API_PATHS.serviceItems.active, {
      page_size: 100,
    }),
    apiGet<unknown>(API_PATHS.notificationCenter.overview, {
      resource: "overview",
    }),
    apiGet<unknown>(API_PATHS.systemLog.summary),
  ]);

  function unwrapList<T>(result: PromiseSettledResult<unknown>): T[] {
    if (result.status !== "fulfilled") return [];

    const apiResult = result.value as {
      ok?: boolean;
      data?: unknown;
    };

    if (!apiResult.ok) return [];
    return getResults<T>(apiResult.data);
  }

  function unwrapPaginationTotal(result: PromiseSettledResult<unknown>) {
    if (result.status !== "fulfilled") return 0;

    const apiResult = result.value as {
      ok?: boolean;
      data?: unknown;
    };

    if (!apiResult.ok || !apiResult.data || typeof apiResult.data !== "object") {
      return 0;
    }

    const payload = apiResult.data as ListPayload<unknown>;
    return (
      payload.pagination?.total_items ||
      payload.meta?.total_items ||
      payload.count ||
      payload.results?.length ||
      0
    );
  }

  function unwrapDataObject<T extends Record<string, unknown>>(
    result: PromiseSettledResult<unknown>,
  ): T | null {
    if (result.status !== "fulfilled") return null;

    const apiResult = result.value as {
      ok?: boolean;
      data?: unknown;
    };

    if (!apiResult.ok) return null;
    return getDataObject<T>(apiResult.data);
  }

  return {
    orders: unwrapList<OrderItem>(ordersResponse),
    openOrders: unwrapList<OrderItem>(openOrdersResponse),
    orderItems: unwrapList<OrderLineItem>(orderItemsResponse),
    pendingOrderItems: unwrapList<OrderLineItem>(pendingOrderItemsResponse),
    products: unwrapList<ProductItem>(productsResponse),
    invoices: unwrapList<InvoiceItem>(invoicesResponse),
    payments: unwrapList<PaymentItem>(paymentsResponse),
    agents: unwrapList<AgentCommissionItem>(agentsResponse),
    providers: unwrapList<ProviderItem>(providersResponse),
    contracts: unwrapList<ContractItem>(contractsResponse),
    serviceItems: unwrapList<ServiceItem>(serviceItemsResponse),
    activeServiceItems: unwrapList<ServiceItem>(activeServiceItemsResponse),
    notificationOverview:
      unwrapDataObject<NotificationOverview>(notificationResponse),
    systemLogSummary: unwrapDataObject<SystemLogSummary>(systemLogResponse),
    totals: {
      orders: unwrapPaginationTotal(ordersResponse),
      openOrders: unwrapPaginationTotal(openOrdersResponse),
      orderItems: unwrapPaginationTotal(orderItemsResponse),
      pendingOrderItems: unwrapPaginationTotal(pendingOrderItemsResponse),
      products: unwrapPaginationTotal(productsResponse),
      invoices: unwrapPaginationTotal(invoicesResponse),
      payments: unwrapPaginationTotal(paymentsResponse),
      agents: unwrapPaginationTotal(agentsResponse),
      providers: unwrapPaginationTotal(providersResponse),
      contracts: unwrapPaginationTotal(contractsResponse),
      serviceItems: unwrapPaginationTotal(serviceItemsResponse),
      activeServiceItems: unwrapPaginationTotal(activeServiceItemsResponse),
    },
  };
}

export default function SystemDashboardPage() {
  const [locale, setLocale] = useState<AppLocale>(() => getStoredLocale());
  const isArabic = locale === "ar";
  const labels = dictionary(locale);

  const [state, setState] = useState<LoadState>("idle");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  const fetchDashboard = async ({ silent = false }: { silent?: boolean } = {}) => {
    try {
      setState((current) => (current === "ready" && silent ? current : "loading"));

      const data = await loadSystemDashboardData();
      setDashboard(data);
      setState("ready");

      if (silent) {
        toast.success(
          locale === "ar"
            ? "تم تحديث لوحة النظام بنجاح"
            : "System dashboard updated successfully",
        );
      }
    } catch (error) {
      console.error("[System Dashboard Error]", error);
      setState("error");
      toast.error(labels.loadError);
    }
  };

  useEffect(() => {
    const syncLocale = () => {
      const nextLocale = getStoredLocale();
      setLocale(nextLocale);
      applyLocaleToDocument(nextLocale);
    };

    syncLocale();

    window.addEventListener("primey-locale-changed", syncLocale);
    window.addEventListener("storage", syncLocale);

    return () => {
      window.removeEventListener("primey-locale-changed", syncLocale);
      window.removeEventListener("storage", syncLocale);
    };
  }, []);

  useEffect(() => {
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const computed = useMemo(() => {
    const data = dashboard;

    const orders = data?.orders || [];
    const openOrders = data?.openOrders || [];
    const orderItems = data?.orderItems || [];
    const pendingOrderItems = data?.pendingOrderItems || [];
    const products = data?.products || [];
    const invoices = data?.invoices || [];
    const payments = data?.payments || [];
    const agents = data?.agents || [];
    const providers = data?.providers || [];
    const contracts = data?.contracts || [];
    const serviceItems = data?.serviceItems || [];
    const activeServiceItems = data?.activeServiceItems || [];

    const issuedCards = orders.filter(isIssuedOrder).length;
    const waitingDelivery = orders.filter(isWaitingDelivery).length;
    const activeSubscriptions = products.filter(isSubscriptionProduct).length;
    const openInvoices = invoices.filter((item) => isOpenInvoice(item.status)).length;
    const confirmedPayments = payments.filter((item) =>
      isPaidStatus(item.status),
    );
    const confirmedPaymentsTotal = confirmedPayments.reduce(
      (total, item) => total + toNumber(item.amount),
      0,
    );

    const failedDeliveries =
      data?.notificationOverview?.counts?.failed_deliveries || 0;
    const unreadNotifications =
      data?.notificationOverview?.counts?.unread_notifications || 0;
    const warningLogs = data?.systemLogSummary?.counts?.warning_logs || 0;
    const errorLogs = data?.systemLogSummary?.counts?.error_logs || 0;
    const criticalLogs = data?.systemLogSummary?.counts?.critical_logs || 0;

    const latestCustomers: LatestCustomer[] = orders.slice(0, 5).map((order) => ({
      name:
        order.customer?.full_name ||
        order.customer?.email ||
        (isArabic
          ? `عميل #${order.customer_id || order.id}`
          : `Customer #${order.customer_id || order.id}`),
      phone: order.customer?.phone || order.customer?.email || "—",
      product:
        order.product?.name ||
        order.product_name ||
        order.product?.code ||
        (isArabic ? "منتج غير محدد" : "Undefined product"),
      status: statusLabel(order.status, locale),
      amount: toMoney(order.total_amount),
      href: `/system/orders/${order.id}`,
    }));

    const latestSystemLogs: LatestOperation[] =
      data?.systemLogSummary?.recent_logs?.slice(0, 3).map(
        (log): LatestOperation => {
          const severity = String(log.severity || "").toUpperCase();
          const operationStatus: LatestOperationStatus =
            severity === "ERROR" || severity === "CRITICAL"
              ? "warning"
              : "info";

          return {
            title:
              log.message ||
              log.event_code ||
              log.action ||
              (isArabic ? "عملية نظام" : "System operation"),
            module: log.module || "System Log",
            time: formatRelativeTime(log.created_at, locale),
            href: "/system/system-log",
            status: operationStatus,
          };
        },
      ) || [];

    const latestOperations: LatestOperation[] = [
      ...latestSystemLogs,
      ...orders.slice(0, 2).map(
        (order): LatestOperation => ({
          title: isArabic
            ? `طلب ${order.order_number || `#${order.id}`}`
            : `Order ${order.order_number || `#${order.id}`}`,
          module: isArabic ? "الطلبات" : "Orders",
          time: formatRelativeTime(order.created_at, locale),
          href: `/system/orders/${order.id}`,
          status: isSuccessOperationStatus(order.status) ? "success" : "info",
        }),
      ),
      ...payments.slice(0, 2).map(
        (payment): LatestOperation => ({
          title: isArabic
            ? `دفعة ${payment.reference || `#${payment.id}`}`
            : `Payment ${payment.reference || `#${payment.id}`}`,
          module: isArabic ? "المدفوعات" : "Payments",
          time: formatRelativeTime(payment.payment_date, locale),
          href: `/system/payments/${payment.id}`,
          status: isPaidStatus(payment.status) ? "success" : "warning",
        }),
      ),
    ].slice(0, 6);

    const metrics: MetricCard[] = [
      {
        title: isArabic ? "إجمالي الطلبات" : "Total Orders",
        value: String(data?.totals.orders || orders.length),
        note: labels.apiOrders,
        href: "/system/orders",
        icon: Package,
        tone: "info",
      },
      {
        title: isArabic ? "البطاقات المصدرة" : "Issued Cards",
        value: String(issuedCards),
        note: labels.issuedNote,
        href: "/system/orders",
        icon: BadgeCheck,
        tone: "success",
      },
      {
        title: isArabic ? "بانتظار التوصيل" : "Waiting Delivery",
        value: String(waitingDelivery),
        note: labels.deliveryNote,
        href: "/system/orders",
        icon: Truck,
        tone: waitingDelivery > 0 ? "warning" : "success",
      },
      {
        title: isArabic ? "برامج واشتراكات" : "Programs & Subscriptions",
        value: String(activeSubscriptions),
        note: labels.programsNote,
        href: "/system/products",
        icon: Sparkles,
        tone: "success",
      },
      {
        title: isArabic ? "مدفوعات مؤكدة" : "Confirmed Payments",
        value: toMoney(confirmedPaymentsTotal),
        note: `${confirmedPayments.length} ${labels.confirmedPaymentsNote}`,
        href: "/system/payments",
        icon: WalletCards,
        isMoney: true,
        tone: "success",
      },
      {
        title: isArabic ? "فواتير مفتوحة" : "Open Invoices",
        value: String(openInvoices),
        note: labels.openInvoicesNote,
        href: "/system/invoices",
        icon: ReceiptText,
        tone: openInvoices > 0 ? "danger" : "success",
      },
    ];

    const operationStatuses: OperationStatus[] = [
      {
        title: isArabic ? "طلبات مفتوحة" : "Open Orders",
        value: String(data?.totals.openOrders || openOrders.length),
        note: isArabic ? "غير مكتملة أو غير مغلقة" : "Not completed or closed",
        href: "/system/orders",
        icon: ClipboardList,
        tone: "info",
      },
      {
        title: isArabic ? "عناصر قيد التنفيذ" : "Pending Items",
        value: String(data?.totals.pendingOrderItems || pendingOrderItems.length),
        note: isArabic ? "خدمات/بنود تحتاج تنفيذ" : "Service items need action",
        href: "/system/order-items",
        icon: HeartPulse,
        tone: pendingOrderItems.length > 0 ? "warning" : "success",
      },
      {
        title: isArabic ? "مراكز نشطة/مسجلة" : "Providers",
        value: String(data?.totals.providers || providers.length),
        note: isArabic ? "مراكز ومقدمي خدمة" : "Centers and providers",
        href: "/system/providers",
        icon: Building2,
        tone: "info",
      },
      {
        title: isArabic ? "عقود المراكز" : "Contracts",
        value: String(data?.totals.contracts || contracts.length),
        note: isArabic ? "عقود وخدمات مرتبطة" : "Provider contracts",
        href: "/system/contracts",
        icon: ShieldCheck,
        tone: "success",
      },
      {
        title: isArabic ? "الخدمات المتاحة" : "Active Services",
        value: String(data?.totals.activeServiceItems || activeServiceItems.length),
        note: isArabic ? "خدمات عقود نشطة" : "Active contract services",
        href: "/system/service-items",
        icon: HeartPulse,
        tone: "success",
      },
      {
        title: isArabic ? "عمولات المندوبين" : "Agent Commissions",
        value: String(data?.totals.agents || agents.length),
        note: isArabic ? "عمولات مسجلة بالنظام" : "Registered commissions",
        href: "/system/agents",
        icon: UserRound,
        tone: "info",
      },
      {
        title: isArabic ? "تنبيهات غير مقروءة" : "Unread Notifications",
        value: String(unreadNotifications),
        note: isArabic ? "من Notification Center" : "From Notification Center",
        href: "/system/notification-center",
        icon: Bell,
        tone: unreadNotifications > 0 ? "warning" : "success",
      },
      {
        title: isArabic ? "أخطاء وسجلات حرجة" : "Errors & Critical Logs",
        value: String(errorLogs + criticalLogs),
        note: isArabic ? `${warningLogs} تحذير` : `${warningLogs} warnings`,
        href: "/system/system-log",
        icon: AlertTriangle,
        tone: errorLogs + criticalLogs > 0 ? "danger" : "success",
      },
    ];

    const serviceHealth: ServiceHealth[] = [
      {
        title: isArabic ? "الطلبات" : "Orders",
        description: isArabic
          ? "إدارة الطلبات وحالات الدفع والتنفيذ."
          : "Orders, payment, and fulfillment statuses.",
        href: "/system/orders",
        status: orders.length || openOrders.length ? "ready" : "partial",
        value: String(data?.totals.orders || orders.length),
        icon: Package,
      },
      {
        title: isArabic ? "المنتجات والبرامج" : "Products & Programs",
        description: isArabic
          ? "البطاقات والبرامج والاشتراكات."
          : "Cards, programs, and subscriptions.",
        href: "/system/products",
        status: products.length ? "ready" : "partial",
        value: String(data?.totals.products || products.length),
        icon: Sparkles,
      },
      {
        title: isArabic ? "المراكز والعقود" : "Centers & Contracts",
        description: isArabic
          ? "المراكز، العقود، والخدمات."
          : "Centers, contracts, and services.",
        href: "/system/providers",
        status: providers.length || contracts.length ? "ready" : "partial",
        value: String(
          (data?.totals.providers || 0) + (data?.totals.contracts || 0),
        ),
        icon: Building2,
      },
      {
        title: isArabic ? "الفواتير والمدفوعات" : "Invoices & Payments",
        description: isArabic
          ? "إصدار الفواتير وتحصيل المدفوعات."
          : "Invoice issuing and payment collection.",
        href: "/system/invoices",
        status: invoices.length || payments.length ? "ready" : "partial",
        value: String(
          (data?.totals.invoices || 0) + (data?.totals.payments || 0),
        ),
        icon: CreditCard,
      },
      {
        title: isArabic ? "الخدمات التنفيذية" : "Service Items",
        description: isArabic
          ? "خدمات العقود وبنود الطلبات."
          : "Contract services and order items.",
        href: "/system/service-items",
        status: serviceItems.length || orderItems.length ? "ready" : "partial",
        value: String(
          (data?.totals.serviceItems || 0) + (data?.totals.orderItems || 0),
        ),
        icon: ClipboardList,
      },
      {
        title: isArabic ? "المندوبون والعمولات" : "Agents & Commissions",
        description: isArabic
          ? "عمولات المندوبين واعتماد المستحقات."
          : "Agent commissions and approvals.",
        href: "/system/agents",
        status: agents.length ? "ready" : "partial",
        value: String(data?.totals.agents || agents.length),
        icon: UserRound,
      },
      {
        title: isArabic ? "التنبيهات" : "Notifications",
        description: isArabic
          ? "الإشعارات والتسليمات والتنبيهات."
          : "Notifications, deliveries, and alerts.",
        href: "/system/notification-center",
        status: failedDeliveries > 0 ? "monitor" : "ready",
        value: String(
          data?.notificationOverview?.counts?.notifications ||
            data?.notificationOverview?.counts?.events ||
            0,
        ),
        icon: Bell,
      },
      {
        title: isArabic ? "سجل النظام" : "System Log",
        description: isArabic
          ? "تتبع العمليات والأخطاء والحركات."
          : "Operations, errors, and audit logs.",
        href: "/system/system-log",
        status: errorLogs + criticalLogs > 0 ? "monitor" : "ready",
        value: String(data?.systemLogSummary?.counts?.total_logs || 0),
        icon: Activity,
      },
    ];

    return {
      metrics,
      operationStatuses,
      latestCustomers,
      latestOperations,
      serviceHealth,
    };
  }, [dashboard, isArabic, labels, locale]);

  const financialLinks: QuickLink[] = [
    {
      title: isArabic ? "ميزان المراجعة" : "Trial Balance",
      description: isArabic
        ? "أرصدة الحسابات المدينة والدائنة."
        : "Debit and credit account balances.",
      href: "/system/accounting/trial-balance",
      icon: Gauge,
    },
    {
      title: isArabic ? "الأرباح والخسائر" : "Profit & Loss",
      description: isArabic
        ? "الإيرادات والمصروفات وصافي الربح."
        : "Revenue, expenses, and net profit.",
      href: "/system/accounting/profit-loss",
      icon: HandCoins,
    },
    {
      title: isArabic ? "المركز المالي" : "Balance Sheet",
      description: isArabic
        ? "الأصول والالتزامات وحقوق الملكية."
        : "Assets, liabilities, and equity.",
      href: "/system/accounting/balance-sheet",
      icon: Landmark,
    },
    {
      title: isArabic ? "دفتر الأستاذ" : "General Ledger",
      description: isArabic
        ? "تفاصيل القيود والحركات المحاسبية."
        : "Journal and ledger movements.",
      href: "/system/accounting/ledger",
      icon: BookOpenCheck,
    },
  ];

  const quickLinks: QuickLink[] = [
    {
      title: isArabic ? "إنشاء طلب" : "Create Order",
      description: isArabic
        ? "تسجيل طلب عميل جديد."
        : "Register a new customer order.",
      href: "/system/orders/create",
      icon: Package,
    },
    {
      title: isArabic ? "إضافة عميل" : "Create Customer",
      description: isArabic
        ? "إضافة ملف عميل جديد."
        : "Create a new customer profile.",
      href: "/system/customers/create",
      icon: Users,
    },
    {
      title: isArabic ? "تأكيد دفعة" : "Confirm Payment",
      description: isArabic
        ? "متابعة المدفوعات المعلقة."
        : "Review pending payments.",
      href: "/system/payments",
      icon: Banknote,
    },
    {
      title: isArabic ? "مراجعة التنبيهات" : "Review Alerts",
      description: isArabic
        ? "فحص التنبيهات وسجل النظام."
        : "Check notifications and system logs.",
      href: "/system/notification-center",
      icon: MessageCircle,
    },
  ];

  const isLoading = state === "loading" || state === "idle";
  const hasError = state === "error";

  return (
    <div className="space-y-4" dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className={isArabic ? "text-right" : "text-left"}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full px-3 py-1">
              <LayoutDashboard className="h-3.5 w-3.5" />
              {labels.systemWorkspace}
            </Badge>

            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {labels.primeyCare}
            </Badge>
          </div>

          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
            {labels.pageTitle}
          </h1>

          <p className="mt-2 max-w-5xl text-sm leading-7 text-muted-foreground">
            {labels.pageSubtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="rounded-xl">
            <CalendarDays className="h-4 w-4" />
            <span>{labels.dateRange}</span>
          </Button>

          <Button
            variant="outline"
            className="rounded-xl"
            disabled={isLoading}
            onClick={() => fetchDashboard({ silent: true })}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{labels.refresh}</span>
          </Button>

          <Button className="rounded-xl">
            <Download className="h-4 w-4" />
            <span>{labels.export}</span>
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl border-border/60 bg-muted/10 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div className={isArabic ? "text-right" : "text-left"}>
            <p className="font-semibold">{labels.mainIndicators}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {hasError ? labels.loadError : labels.livePreview}
            </p>
          </div>

          <Link href="/system/system-log">
            <Button variant="outline" className="w-fit rounded-xl">
              <Activity className="h-4 w-4" />
              <span>{labels.openSystemLog}</span>
            </Button>
          </Link>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card className="rounded-2xl border-border/60 bg-background shadow-sm">
          <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="font-medium">{labels.loading}</p>
            <p className="max-w-xl text-sm text-muted-foreground">
              {labels.loadDescription}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {computed.metrics.map((metric) => (
              <MetricCardItem
                key={metric.title}
                item={metric}
                labels={labels}
                isArabic={isArabic}
              />
            ))}
          </div>

          <OperationsSummary
            labels={labels}
            items={computed.operationStatuses}
            isArabic={isArabic}
          />

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <LatestCustomersTable
                labels={labels}
                rows={computed.latestCustomers}
                isArabic={isArabic}
              />
            </div>

            <div className="xl:col-span-1">
              <LatestOperationsCard
                labels={labels}
                rows={computed.latestOperations}
                isArabic={isArabic}
              />
            </div>
          </div>

          <ServiceHealthGrid
            labels={labels}
            services={computed.serviceHealth}
            isArabic={isArabic}
          />

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <FinancialReportsCard
                labels={labels}
                links={financialLinks}
                isArabic={isArabic}
              />
            </div>

            <div className="xl:col-span-1">
              <QuickLinksCard
                labels={labels}
                links={quickLinks}
                isArabic={isArabic}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}