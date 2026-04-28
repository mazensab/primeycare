"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  ArrowDownUp,
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  ColumnsIcon,
  Download,
  FileText,
  HandCoins,
  Loader2,
  MapPin,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
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

/* ============================================================
   📂 app/system/agents/reports/page.tsx
   🧠 Primey Care | Agents Reports
   ------------------------------------------------------------
   ✅ Phase 6: Agents + Orders + Commissions + Accounting
   ✅ GET /api/agents/
   ✅ GET /api/agents/commissions/
   ✅ Excel export .xlsx
   ✅ Web PDF print للتقرير فقط
   ✅ عربي / إنجليزي عبر primey-locale
   ✅ أرقام إنجليزية دائمًا
   ✅ رمز SAR الرسمي
   ✅ sonner
   ✅ بدون localhost
============================================================ */

type AppLocale = "ar" | "en";

type AgentStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "DRAFT"
  | "UNKNOWN";

type CommissionType = "PERCENTAGE" | "FIXED" | "UNKNOWN";

type CommissionStatus =
  | "PENDING"
  | "EARNED"
  | "APPROVED"
  | "PAID"
  | "CANCELLED"
  | "REVERSED"
  | "UNKNOWN";

type StatusFilter = "ALL" | AgentStatus;
type CommissionStatusFilter = "ALL" | CommissionStatus;
type CommissionTypeFilter = "ALL" | CommissionType;

type SortKey =
  | "fullName"
  | "agentCode"
  | "referralCode"
  | "city"
  | "status"
  | "totalCustomers"
  | "totalOrders"
  | "totalSales"
  | "approvedCommission"
  | "paidCommission";

type SortDirection = "asc" | "desc";

type VisibleColumns = {
  name: boolean;
  code: boolean;
  referralCode: boolean;
  city: boolean;
  customers: boolean;
  orders: boolean;
  sales: boolean;
  commissions: boolean;
  paid: boolean;
  status: boolean;
};

type Agent = {
  id: number | string;
  fullName: string;
  agentCode: string;
  referralCode: string;
  status: AgentStatus;
  phone: string;
  email: string;
  city: string;
  defaultCommissionType: CommissionType;
  defaultCommissionValue: number;
  totalCustomers: number;
  totalOrders: number;
  totalSales: number;
  pendingCommission: number;
  approvedCommission: number;
  paidCommission: number;
  accountingPostedCommission: number;
  createdAt: string;
};

type AgentCommission = {
  id: number | string;
  reference: string;
  status: CommissionStatus;
  agentId: number | string | null;
  agentName: string;
  agentCode: string;
  referralCode: string;
  orderId: number | string | null;
  orderNumber: string;
  customerName: string;
  baseAmount: number;
  commissionAmount: number;
  paidAmount: number;
  remainingAmount: number;
  earnedAt: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  createdAt: string;
};

type AgentsApiStats = {
  total_agents?: number | string;
  active_agents?: number | string;
  inactive_agents?: number | string;
  suspended_agents?: number | string;
  draft_agents?: number | string;
  total_sales?: number | string;
  total_commission?: number | string;
  total_paid?: number | string;
};

type ApiResponse = {
  ok?: boolean;
  message?: string;
  count?: number;
  results?: unknown[];
  data?: unknown[];
  items?: unknown[];
  agents?: unknown[];
  commissions?: unknown[];
  stats?: AgentsApiStats | Record<string, unknown>;
};

const SAR_ICON = "/currency/sar.svg";

/* ============================================================
   Locale
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
   Helpers
============================================================ */

function normalizeApiList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === "object") {
    const data = payload as ApiResponse;

    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.agents)) return data.agents;
    if (Array.isArray(data.commissions)) return data.commissions;
  }

  return [];
}

function valueOf(obj: Record<string, unknown>, key: string): unknown {
  const direct = obj[key];

  if (direct !== undefined && direct !== null && direct !== "") return direct;

  const stats = obj.stats;
  if (stats && typeof stats === "object") {
    const nested = (stats as Record<string, unknown>)[key];
    if (nested !== undefined && nested !== null && nested !== "") return nested;
  }

  const agent = obj.agent;
  if (agent && typeof agent === "object") {
    const nested = (agent as Record<string, unknown>)[key];
    if (nested !== undefined && nested !== null && nested !== "") return nested;
  }

  return undefined;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const parsed = Number(
    String(value ?? "")
      .replace(/,/g, "")
      .replace(/[^\d.-]/g, ""),
  );

  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStatus(value: unknown): AgentStatus {
  const status = String(value || "").toUpperCase();

  if (status === "ACTIVE") return "ACTIVE";
  if (status === "INACTIVE") return "INACTIVE";
  if (status === "SUSPENDED") return "SUSPENDED";
  if (status === "DRAFT") return "DRAFT";

  if (value === true) return "ACTIVE";
  if (value === false) return "INACTIVE";

  return "UNKNOWN";
}

function normalizeCommissionType(value: unknown): CommissionType {
  const type = String(value || "").toUpperCase();

  if (type === "PERCENTAGE") return "PERCENTAGE";
  if (type === "FIXED") return "FIXED";

  return "UNKNOWN";
}

function normalizeCommissionStatus(value: unknown): CommissionStatus {
  const status = String(value || "").toUpperCase();

  if (status === "PENDING") return "PENDING";
  if (status === "EARNED") return "EARNED";
  if (status === "APPROVED") return "APPROVED";
  if (status === "PAID") return "PAID";
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "REVERSED") return "REVERSED";

  return "UNKNOWN";
}

function normalizeAgent(item: unknown): Agent {
  const obj = (item || {}) as Record<string, unknown>;
  const id = valueOf(obj, "id") ?? valueOf(obj, "agent_id") ?? "-";

  return {
    id: id as number | string,
    fullName: String(
      valueOf(obj, "full_name") ??
        valueOf(obj, "name") ??
        valueOf(obj, "agent_name") ??
        "-",
    ),
    agentCode: String(
      valueOf(obj, "agent_code") ?? valueOf(obj, "code") ?? `AGT-${id}`,
    ),
    referralCode: String(valueOf(obj, "referral_code") ?? "-"),
    status: normalizeStatus(valueOf(obj, "status")),
    phone: String(valueOf(obj, "phone") ?? ""),
    email: String(valueOf(obj, "email") ?? ""),
    city: String(valueOf(obj, "city") ?? ""),
    defaultCommissionType: normalizeCommissionType(
      valueOf(obj, "default_commission_type") ?? valueOf(obj, "commission_type"),
    ),
    defaultCommissionValue: toNumber(
      valueOf(obj, "default_commission_value") ??
        valueOf(obj, "commission_value"),
    ),
    totalCustomers: toNumber(
      valueOf(obj, "total_customers") ?? valueOf(obj, "customers_count"),
    ),
    totalOrders: toNumber(
      valueOf(obj, "total_orders") ?? valueOf(obj, "orders_count"),
    ),
    totalSales: toNumber(
      valueOf(obj, "total_sales") ?? valueOf(obj, "sales_total"),
    ),
    pendingCommission: toNumber(valueOf(obj, "pending_commission")),
    approvedCommission: toNumber(
      valueOf(obj, "approved_commission") ?? valueOf(obj, "total_commission"),
    ),
    paidCommission: toNumber(valueOf(obj, "paid_commission")),
    accountingPostedCommission: toNumber(
      valueOf(obj, "accounting_posted_commission"),
    ),
    createdAt: String(valueOf(obj, "created_at") ?? ""),
  };
}

function normalizeCommission(item: unknown): AgentCommission {
  const obj = (item || {}) as Record<string, unknown>;

  return {
    id: (obj.id ?? "-") as number | string,
    reference: String(obj.reference ?? `COM-${obj.id ?? "-"}`),
    status: normalizeCommissionStatus(obj.commission_status ?? obj.status),
    agentId: (obj.agent_id ?? null) as number | string | null,
    agentName: String(obj.agent_name ?? "-"),
    agentCode: String(obj.agent_code ?? "-"),
    referralCode: String(obj.referral_code ?? "-"),
    orderId: (obj.order_id ?? null) as number | string | null,
    orderNumber: String(obj.order_number ?? `ORD-${obj.order_id ?? "-"}`),
    customerName: String(obj.customer_name ?? "-"),
    baseAmount: toNumber(obj.base_amount),
    commissionAmount: toNumber(obj.commission_amount ?? obj.amount),
    paidAmount: toNumber(obj.paid_amount),
    remainingAmount: toNumber(obj.remaining_amount),
    earnedAt: obj.earned_at ? String(obj.earned_at) : null,
    approvedAt: obj.approved_at ? String(obj.approved_at) : null,
    paidAt: obj.paid_at ? String(obj.paid_at) : null,
    createdAt: String(obj.created_at ?? ""),
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function SarAmount({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap font-semibold">
      <Image
        src={SAR_ICON}
        alt="SAR"
        width={14}
        height={14}
        className="h-3.5 w-3.5"
      />
      <span>{formatMoney(value)}</span>
    </span>
  );
}

function compareValues(a: string | number, b: string | number) {
  return String(a || "").localeCompare(String(b || ""), "en", {
    numeric: true,
    sensitivity: "base",
  });
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "تقارير المندوبين" : "Agents Reports",
    subtitle: isArabic
      ? "تحليل أداء المندوبين والعمولات والمبيعات والرصيد المستحق."
      : "Analyze agents performance, commissions, sales, and due balances.",

    back: isArabic ? "لوحة المندوبين" : "Agents Overview",
    list: isArabic ? "قائمة المندوبين" : "Agents List",
    refresh: isArabic ? "تحديث" : "Refresh",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    printPdf: isArabic ? "طباعة Web PDF" : "Print Web PDF",

    filters: isArabic ? "الفلاتر" : "Filters",
    search: isArabic ? "بحث" : "Search",
    searchPlaceholder: isArabic
      ? "ابحث باسم المندوب، الكود، كود الإحالة، المدينة..."
      : "Search by agent name, code, referral code, city...",
    status: isArabic ? "الحالة" : "Status",
    commissionStatus: isArabic ? "حالة العمولة" : "Commission Status",
    commissionType: isArabic ? "نوع العمولة" : "Commission Type",
    columns: isArabic ? "الأعمدة" : "Columns",
    all: isArabic ? "الكل" : "All",

    reportSummary: isArabic ? "ملخص التقرير" : "Report Summary",
    performanceTable: isArabic ? "جدول أداء المندوبين" : "Agents Performance Table",
    performanceDesc: isArabic
      ? "يعرض المندوبين حسب الفلاتر الحالية مع المبيعات والعمولات."
      : "Shows agents based on current filters with sales and commissions.",
    commissionsTable: isArabic ? "جدول العمولات" : "Commissions Table",
    commissionsDesc: isArabic
      ? "يعرض العمولات المعلقة والمعتمدة والمدفوعة."
      : "Shows pending, approved, and paid commissions.",

    totalAgents: isArabic ? "إجمالي المندوبين" : "Total Agents",
    activeAgents: isArabic ? "النشطون" : "Active Agents",
    totalCustomers: isArabic ? "العملاء المرتبطون" : "Linked Customers",
    totalOrders: isArabic ? "الطلبات المرتبطة" : "Linked Orders",
    totalSales: isArabic ? "إجمالي المبيعات" : "Total Sales",
    totalCommission: isArabic ? "إجمالي العمولات" : "Total Commissions",
    totalPaid: isArabic ? "المدفوع" : "Paid",
    totalDue: isArabic ? "المستحق" : "Due",

    agent: isArabic ? "المندوب" : "Agent",
    code: isArabic ? "الكود" : "Code",
    referral: isArabic ? "كود الإحالة" : "Referral",
    city: isArabic ? "المدينة" : "City",
    customers: isArabic ? "العملاء" : "Customers",
    orders: isArabic ? "الطلبات" : "Orders",
    sales: isArabic ? "المبيعات" : "Sales",
    commissions: isArabic ? "العمولات" : "Commissions",
    paid: isArabic ? "مدفوع" : "Paid",
    due: isArabic ? "مستحق" : "Due",

    reference: isArabic ? "المرجع" : "Reference",
    order: isArabic ? "الطلب" : "Order",
    customer: isArabic ? "العميل" : "Customer",
    amount: isArabic ? "المبلغ" : "Amount",
    remaining: isArabic ? "المتبقي" : "Remaining",
    date: isArabic ? "التاريخ" : "Date",

    loading: isArabic ? "جاري تحميل تقارير المندوبين..." : "Loading agents reports...",
    noAgents: isArabic ? "لا توجد بيانات مندوبين." : "No agents data.",
    noCommissions: isArabic ? "لا توجد بيانات عمولات." : "No commissions data.",
    apiError: isArabic
      ? "تعذر تحميل تقارير المندوبين."
      : "Unable to load agents reports.",
    refreshSuccess: isArabic
      ? "تم تحديث تقارير المندوبين"
      : "Agents reports refreshed",
    exportSuccess: isArabic
      ? "تم تجهيز ملف Excel بنجاح"
      : "Excel file prepared successfully",
    exportEmpty: isArabic
      ? "لا توجد بيانات لتصديرها"
      : "No data available to export",

    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",
    selected: isArabic ? "صفوف محددة" : "selected rows",
    generatedAt: isArabic ? "تاريخ التقرير" : "Generated At",
    reportScope: isArabic ? "نطاق التقرير" : "Report Scope",
    currentFilters: isArabic ? "حسب الفلاتر الحالية" : "Current filters",

    statusLabels: {
      ACTIVE: isArabic ? "نشط" : "Active",
      INACTIVE: isArabic ? "غير نشط" : "Inactive",
      SUSPENDED: isArabic ? "موقوف" : "Suspended",
      DRAFT: isArabic ? "مسودة" : "Draft",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<AgentStatus, string>,

    commissionStatusLabels: {
      PENDING: isArabic ? "معلقة" : "Pending",
      EARNED: isArabic ? "مستحقة" : "Earned",
      APPROVED: isArabic ? "معتمدة" : "Approved",
      PAID: isArabic ? "مدفوعة" : "Paid",
      CANCELLED: isArabic ? "ملغاة" : "Cancelled",
      REVERSED: isArabic ? "معكوسة" : "Reversed",
      UNKNOWN: isArabic ? "غير محددة" : "Unknown",
    } satisfies Record<CommissionStatus, string>,

    commissionTypeLabels: {
      PERCENTAGE: isArabic ? "نسبة" : "Percentage",
      FIXED: isArabic ? "مبلغ ثابت" : "Fixed",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<CommissionType, string>,

    columnLabels: {
      name: isArabic ? "المندوب" : "Agent",
      code: isArabic ? "الكود" : "Code",
      referralCode: isArabic ? "كود الإحالة" : "Referral",
      city: isArabic ? "المدينة" : "City",
      customers: isArabic ? "العملاء" : "Customers",
      orders: isArabic ? "الطلبات" : "Orders",
      sales: isArabic ? "المبيعات" : "Sales",
      commissions: isArabic ? "العمولات" : "Commissions",
      paid: isArabic ? "المدفوع" : "Paid",
      status: isArabic ? "الحالة" : "Status",
    } satisfies Record<keyof VisibleColumns, string>,
  };
}

function statusBadge(status: AgentStatus, locale: AppLocale) {
  const t = dictionary(locale);
  const label = t.statusLabels[status];

  if (status === "ACTIVE") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50">
        {label}
      </Badge>
    );
  }

  if (status === "SUSPENDED") {
    return (
      <Badge className="rounded-full border-orange-200 bg-orange-50 px-3 py-1 text-orange-700 hover:bg-orange-50">
        {label}
      </Badge>
    );
  }

  if (status === "DRAFT") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50">
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

function commissionStatusBadge(status: CommissionStatus, locale: AppLocale) {
  const t = dictionary(locale);
  const label = t.commissionStatusLabels[status];

  if (status === "APPROVED" || status === "PAID") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50">
        {label}
      </Badge>
    );
  }

  if (status === "PENDING" || status === "EARNED") {
    return (
      <Badge className="rounded-full border-amber-200 bg-amber-50 px-3 py-1 text-amber-700 hover:bg-amber-50">
        {label}
      </Badge>
    );
  }

  if (status === "CANCELLED" || status === "REVERSED") {
    return (
      <Badge className="rounded-full border-rose-200 bg-rose-50 px-3 py-1 text-rose-700 hover:bg-rose-50">
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
   Page
============================================================ */

export default function SystemAgentsReportsPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [commissions, setCommissions] = useState<AgentCommission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [commissionTypeFilter, setCommissionTypeFilter] =
    useState<CommissionTypeFilter>("ALL");
  const [commissionStatusFilter, setCommissionStatusFilter] =
    useState<CommissionStatusFilter>("ALL");

  const [sortKey, setSortKey] = useState<SortKey>("totalSales");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Array<number | string>>([]);

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    name: true,
    code: true,
    referralCode: true,
    city: true,
    customers: true,
    orders: true,
    sales: true,
    commissions: true,
    paid: true,
    status: true,
  });

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const filteredAgents = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    const rows = agents.filter((agent) => {
      const matchesSearch =
        !cleanQuery ||
        agent.fullName.toLowerCase().includes(cleanQuery) ||
        agent.agentCode.toLowerCase().includes(cleanQuery) ||
        agent.referralCode.toLowerCase().includes(cleanQuery) ||
        agent.city.toLowerCase().includes(cleanQuery) ||
        agent.phone.toLowerCase().includes(cleanQuery) ||
        agent.email.toLowerCase().includes(cleanQuery);

      const matchesStatus =
        statusFilter === "ALL" || agent.status === statusFilter;

      const matchesCommissionType =
        commissionTypeFilter === "ALL" ||
        agent.defaultCommissionType === commissionTypeFilter;

      return matchesSearch && matchesStatus && matchesCommissionType;
    });

    rows.sort((a, b) => {
      let result = 0;

      if (
        sortKey === "totalCustomers" ||
        sortKey === "totalOrders" ||
        sortKey === "totalSales" ||
        sortKey === "approvedCommission" ||
        sortKey === "paidCommission"
      ) {
        result = Number(a[sortKey] || 0) - Number(b[sortKey] || 0);
      } else {
        result = compareValues(a[sortKey], b[sortKey]);
      }

      return sortDirection === "asc" ? result : result * -1;
    });

    return rows;
  }, [agents, query, statusFilter, commissionTypeFilter, sortKey, sortDirection]);

  const filteredCommissions = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return commissions.filter((commission) => {
      const matchesSearch =
        !cleanQuery ||
        commission.agentName.toLowerCase().includes(cleanQuery) ||
        commission.agentCode.toLowerCase().includes(cleanQuery) ||
        commission.referralCode.toLowerCase().includes(cleanQuery) ||
        commission.reference.toLowerCase().includes(cleanQuery) ||
        commission.orderNumber.toLowerCase().includes(cleanQuery) ||
        commission.customerName.toLowerCase().includes(cleanQuery);

      const matchesCommissionStatus =
        commissionStatusFilter === "ALL" ||
        commission.status === commissionStatusFilter;

      return matchesSearch && matchesCommissionStatus;
    });
  }, [commissions, query, commissionStatusFilter]);

  const stats = useMemo(() => {
    const totalAgents = filteredAgents.length;
    const activeAgents = filteredAgents.filter(
      (agent) => agent.status === "ACTIVE",
    ).length;

    const totalCustomers = filteredAgents.reduce(
      (sum, item) => sum + item.totalCustomers,
      0,
    );
    const totalOrders = filteredAgents.reduce(
      (sum, item) => sum + item.totalOrders,
      0,
    );
    const totalSales = filteredAgents.reduce(
      (sum, item) => sum + item.totalSales,
      0,
    );
    const totalCommission = filteredCommissions.reduce(
      (sum, item) => sum + item.commissionAmount,
      0,
    );
    const totalPaid = filteredCommissions.reduce(
      (sum, item) => sum + item.paidAmount,
      0,
    );
    const totalDue = filteredCommissions.reduce(
      (sum, item) => sum + item.remainingAmount,
      0,
    );

    return {
      totalAgents,
      activeAgents,
      totalCustomers,
      totalOrders,
      totalSales,
      totalCommission,
      totalPaid,
      totalDue,
    };
  }, [filteredAgents, filteredCommissions]);

  const pageCount = Math.max(1, Math.ceil(filteredAgents.length / pageSize));
  const pageRows = useMemo(() => {
    const start = pageIndex * pageSize;
    return filteredAgents.slice(start, start + pageSize);
  }, [filteredAgents, pageIndex, pageSize]);

  const allPageRowsSelected =
    pageRows.length > 0 && pageRows.every((row) => selectedIds.includes(row.id));

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("desc");
  }

  function toggleRow(id: number | string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function toggleAllPageRows() {
    setSelectedIds((current) => {
      if (allPageRowsSelected) {
        return current.filter((id) => !pageRows.some((row) => row.id === id));
      }

      const next = [...current];
      pageRows.forEach((row) => {
        if (!next.includes(row.id)) next.push(row.id);
      });

      return next;
    });
  }

  async function loadReports(showToast = false) {
    try {
      setIsLoading(true);

      const [agentsResponse, commissionsResponse] = await Promise.all([
        fetch("/api/agents/?page_size=500", {
          method: "GET",
          credentials: "include",
          headers: { Accept: "application/json" },
        }),
        fetch("/api/agents/commissions/?page_size=500", {
          method: "GET",
          credentials: "include",
          headers: { Accept: "application/json" },
        }),
      ]);

      const agentsPayload = (await agentsResponse.json().catch(() => null)) as
        | ApiResponse
        | null;

      const commissionsPayload = (await commissionsResponse
        .json()
        .catch(() => null)) as ApiResponse | null;

      if (!agentsResponse.ok || !agentsPayload?.ok) {
        throw new Error(agentsPayload?.message || `HTTP ${agentsResponse.status}`);
      }

      if (!commissionsResponse.ok || !commissionsPayload?.ok) {
        throw new Error(
          commissionsPayload?.message || `HTTP ${commissionsResponse.status}`,
        );
      }

      setAgents(normalizeApiList(agentsPayload).map(normalizeAgent));
      setCommissions(
        normalizeApiList(commissionsPayload).map(normalizeCommission),
      );
      setPageIndex(0);
      setSelectedIds([]);

      if (showToast) {
        toast.success(t.refreshSuccess);
      }
    } catch (error) {
      console.error("Load agents reports error:", error);
      setAgents([]);
      setCommissions([]);
      toast.error(t.apiError);
    } finally {
      setIsLoading(false);
    }
  }

  function exportExcel() {
    if (filteredAgents.length === 0 && filteredCommissions.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const now = new Date();
    const generatedAt = formatDateTime(now.toISOString());

    const summaryRows = [
      [t.reportSummary, ""],
      [t.generatedAt, generatedAt],
      [t.reportScope, t.currentFilters],
      ["", ""],
      [t.totalAgents, stats.totalAgents],
      [t.activeAgents, stats.activeAgents],
      [t.totalCustomers, stats.totalCustomers],
      [t.totalOrders, stats.totalOrders],
      [t.totalSales, formatMoney(stats.totalSales)],
      [t.totalCommission, formatMoney(stats.totalCommission)],
      [t.totalPaid, formatMoney(stats.totalPaid)],
      [t.totalDue, formatMoney(stats.totalDue)],
    ];

    const agentsRows = filteredAgents.map((agent) => ({
      [t.agent]: agent.fullName,
      [t.code]: agent.agentCode,
      [t.referral]: agent.referralCode,
      [t.city]: agent.city || "-",
      [t.customers]: agent.totalCustomers,
      [t.orders]: agent.totalOrders,
      [t.sales]: formatMoney(agent.totalSales),
      [t.commissions]: formatMoney(agent.approvedCommission),
      [t.paid]: formatMoney(agent.paidCommission),
      [t.status]: t.statusLabels[agent.status],
    }));

    const commissionsRows = filteredCommissions.map((commission) => ({
      [t.reference]: commission.reference,
      [t.agent]: commission.agentName,
      [t.code]: commission.agentCode,
      [t.order]: commission.orderNumber,
      [t.customer]: commission.customerName,
      [t.amount]: formatMoney(commission.commissionAmount),
      [t.paid]: formatMoney(commission.paidAmount),
      [t.remaining]: formatMoney(commission.remainingAmount),
      [t.status]: t.commissionStatusLabels[commission.status],
      [t.date]: formatDateTime(commission.createdAt),
    }));

    const workbook = XLSX.utils.book_new();

    workbook.Workbook = {
      Views: [{ RTL: isArabic }],
    };

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    summarySheet["!cols"] = [{ wch: 28 }, { wch: 28 }];

    const agentsSheet = XLSX.utils.json_to_sheet(agentsRows);
    agentsSheet["!cols"] = [
      { wch: 28 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 12 },
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
    ];

    const commissionsSheet = XLSX.utils.json_to_sheet(commissionsRows);
    commissionsSheet["!cols"] = [
      { wch: 16 },
      { wch: 28 },
      { wch: 18 },
      { wch: 18 },
      { wch: 28 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 24 },
    ];

    XLSX.utils.book_append_sheet(
      workbook,
      summarySheet,
      isArabic ? "الملخص" : "Summary",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      agentsSheet,
      isArabic ? "المندوبون" : "Agents",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      commissionsSheet,
      isArabic ? "العمولات" : "Commissions",
    );

    XLSX.writeFile(
      workbook,
      `primey-care-agents-report-${now.toISOString().slice(0, 10)}.xlsx`,
    );

    toast.success(t.exportSuccess);
  }

  function printReport() {
    const now = new Date();
    const direction = isArabic ? "rtl" : "ltr";
    const title = t.title;

    const html = `
      <!doctype html>
      <html lang="${locale}" dir="${direction}">
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: Arial, sans-serif;
              margin: 24px;
              color: #111827;
              direction: ${direction};
            }
            .header {
              display: flex;
              justify-content: space-between;
              gap: 16px;
              border-bottom: 2px solid #111827;
              padding-bottom: 16px;
              margin-bottom: 20px;
            }
            h1 { margin: 0; font-size: 24px; }
            p { margin: 4px 0; color: #4b5563; }
            .summary {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin-bottom: 20px;
            }
            .card {
              border: 1px solid #d1d5db;
              border-radius: 12px;
              padding: 12px;
            }
            .card .label { color: #6b7280; font-size: 12px; }
            .card .value { font-size: 18px; font-weight: 700; margin-top: 6px; }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 12px;
              font-size: 12px;
            }
            th, td {
              border: 1px solid #d1d5db;
              padding: 8px;
              text-align: ${isArabic ? "right" : "left"};
              vertical-align: top;
            }
            th { background: #f3f4f6; font-weight: 700; }
            .section-title {
              margin-top: 22px;
              font-size: 17px;
              font-weight: 700;
            }
            @media print {
              body { margin: 12mm; }
              .summary { grid-template-columns: repeat(4, 1fr); }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>${title}</h1>
              <p>${t.subtitle}</p>
            </div>
            <div>
              <p>${t.generatedAt}: ${formatDateTime(now.toISOString())}</p>
              <p>${t.reportScope}: ${t.currentFilters}</p>
            </div>
          </div>

          <div class="summary">
            <div class="card"><div class="label">${t.totalAgents}</div><div class="value">${formatNumber(stats.totalAgents)}</div></div>
            <div class="card"><div class="label">${t.totalOrders}</div><div class="value">${formatNumber(stats.totalOrders)}</div></div>
            <div class="card"><div class="label">${t.totalSales}</div><div class="value">${formatMoney(stats.totalSales)} SAR</div></div>
            <div class="card"><div class="label">${t.totalDue}</div><div class="value">${formatMoney(stats.totalDue)} SAR</div></div>
          </div>

          <div class="section-title">${t.performanceTable}</div>
          <table>
            <thead>
              <tr>
                <th>${t.agent}</th>
                <th>${t.code}</th>
                <th>${t.referral}</th>
                <th>${t.city}</th>
                <th>${t.customers}</th>
                <th>${t.orders}</th>
                <th>${t.sales}</th>
                <th>${t.commissions}</th>
                <th>${t.status}</th>
              </tr>
            </thead>
            <tbody>
              ${filteredAgents
                .map(
                  (agent) => `
                    <tr>
                      <td>${agent.fullName}</td>
                      <td>${agent.agentCode}</td>
                      <td>${agent.referralCode}</td>
                      <td>${agent.city || "-"}</td>
                      <td>${formatNumber(agent.totalCustomers)}</td>
                      <td>${formatNumber(agent.totalOrders)}</td>
                      <td>${formatMoney(agent.totalSales)} SAR</td>
                      <td>${formatMoney(agent.approvedCommission)} SAR</td>
                      <td>${t.statusLabels[agent.status]}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>

          <div class="section-title">${t.commissionsTable}</div>
          <table>
            <thead>
              <tr>
                <th>${t.reference}</th>
                <th>${t.agent}</th>
                <th>${t.order}</th>
                <th>${t.customer}</th>
                <th>${t.amount}</th>
                <th>${t.paid}</th>
                <th>${t.remaining}</th>
                <th>${t.status}</th>
              </tr>
            </thead>
            <tbody>
              ${filteredCommissions
                .slice(0, 100)
                .map(
                  (commission) => `
                    <tr>
                      <td>${commission.reference}</td>
                      <td>${commission.agentName}</td>
                      <td>${commission.orderNumber}</td>
                      <td>${commission.customerName}</td>
                      <td>${formatMoney(commission.commissionAmount)} SAR</td>
                      <td>${formatMoney(commission.paidAmount)} SAR</td>
                      <td>${formatMoney(commission.remainingAmount)} SAR</td>
                      <td>${t.commissionStatusLabels[commission.status]}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=1200,height=900");

    if (!printWindow) {
      toast.error(t.apiError);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    window.setTimeout(() => {
      printWindow.print();
    }, 400);
  }

  useEffect(() => {
    const syncLocale = () => {
      const nextLocale = readLocale();

      applyDocumentLocale(nextLocale);
      setLocale(nextLocale);
    };

    const syncAfterPaint = () => {
      syncLocale();
      window.setTimeout(syncLocale, 0);
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
    loadReports(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useEffect(() => {
    setPageIndex(0);
  }, [query, statusFilter, commissionTypeFilter, commissionStatusFilter]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t.title}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{t.subtitle}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link href="/system/agents">
            <Button variant="outline" className="h-10 w-full rounded-xl sm:w-auto">
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>

          <Link href="/system/agents/list">
            <Button variant="outline" className="h-10 w-full rounded-xl sm:w-auto">
              <Users className="h-4 w-4" />
              <span>{t.list}</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadReports(true)}
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
            disabled={isLoading}
          >
            <Download className="h-4 w-4" />
            <span>{t.exportExcel}</span>
          </Button>

          <Button
            className="h-10 rounded-xl"
            onClick={printReport}
            disabled={isLoading}
          >
            <Printer className="h-4 w-4" />
            <span>{t.printPdf}</span>
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-8">
        <SummaryCard
          title={t.totalAgents}
          value={isLoading ? "..." : formatNumber(stats.totalAgents)}
          icon={Users}
        />
        <SummaryCard
          title={t.activeAgents}
          value={isLoading ? "..." : formatNumber(stats.activeAgents)}
          icon={BadgeCheck}
        />
        <SummaryCard
          title={t.totalCustomers}
          value={isLoading ? "..." : formatNumber(stats.totalCustomers)}
          icon={UserRound}
        />
        <SummaryCard
          title={t.totalOrders}
          value={isLoading ? "..." : formatNumber(stats.totalOrders)}
          icon={FileText}
        />
        <SummaryCard
          title={t.totalSales}
          value={isLoading ? "..." : <SarAmount value={stats.totalSales} />}
          icon={TrendingUp}
        />
        <SummaryCard
          title={t.totalCommission}
          value={isLoading ? "..." : <SarAmount value={stats.totalCommission} />}
          icon={HandCoins}
        />
        <SummaryCard
          title={t.totalPaid}
          value={isLoading ? "..." : <SarAmount value={stats.totalPaid} />}
          icon={Wallet}
        />
        <SummaryCard
          title={t.totalDue}
          value={isLoading ? "..." : <SarAmount value={stats.totalDue} />}
          icon={ShieldCheck}
        />
      </div>

      {/* Filters */}
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold">{t.filters}</CardTitle>
          <CardDescription>{t.subtitle}</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto_auto]">
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

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
              className="border-input bg-background h-10 rounded-xl border px-3 text-sm"
            >
              <option value="ALL">
                {t.status}: {t.all}
              </option>
              <option value="ACTIVE">{t.statusLabels.ACTIVE}</option>
              <option value="DRAFT">{t.statusLabels.DRAFT}</option>
              <option value="SUSPENDED">{t.statusLabels.SUSPENDED}</option>
              <option value="INACTIVE">{t.statusLabels.INACTIVE}</option>
            </select>

            <select
              value={commissionTypeFilter}
              onChange={(event) =>
                setCommissionTypeFilter(
                  event.target.value as CommissionTypeFilter,
                )
              }
              className="border-input bg-background h-10 rounded-xl border px-3 text-sm"
            >
              <option value="ALL">
                {t.commissionType}: {t.all}
              </option>
              <option value="PERCENTAGE">{t.commissionTypeLabels.PERCENTAGE}</option>
              <option value="FIXED">{t.commissionTypeLabels.FIXED}</option>
            </select>

            <select
              value={commissionStatusFilter}
              onChange={(event) =>
                setCommissionStatusFilter(
                  event.target.value as CommissionStatusFilter,
                )
              }
              className="border-input bg-background h-10 rounded-xl border px-3 text-sm"
            >
              <option value="ALL">
                {t.commissionStatus}: {t.all}
              </option>
              <option value="PENDING">{t.commissionStatusLabels.PENDING}</option>
              <option value="EARNED">{t.commissionStatusLabels.EARNED}</option>
              <option value="APPROVED">{t.commissionStatusLabels.APPROVED}</option>
              <option value="PAID">{t.commissionStatusLabels.PAID}</option>
              <option value="CANCELLED">{t.commissionStatusLabels.CANCELLED}</option>
              <option value="REVERSED">{t.commissionStatusLabels.REVERSED}</option>
            </select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 rounded-xl">
                  <ColumnsIcon className="h-4 w-4" />
                  <span>{t.columns}</span>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align={isArabic ? "start" : "end"}>
                <DropdownMenuLabel>{t.columns}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {Object.entries(t.columnLabels).map(([key, label]) => (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={visibleColumns[key as keyof VisibleColumns]}
                    onCheckedChange={(checked) =>
                      setVisibleColumns((current) => ({
                        ...current,
                        [key]: Boolean(checked),
                      }))
                    }
                  >
                    {label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Agents Performance */}
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <BarChart3 className="h-5 w-5" />
            {t.performanceTable}
          </CardTitle>
          <CardDescription>{t.performanceDesc}</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allPageRowsSelected}
                      onCheckedChange={toggleAllPageRows}
                      aria-label="Select all"
                    />
                  </TableHead>

                  {visibleColumns.name ? (
                    <TableHead>
                      <SortButton label={t.agent} onClick={() => toggleSort("fullName")} />
                    </TableHead>
                  ) : null}

                  {visibleColumns.code ? (
                    <TableHead>
                      <SortButton label={t.code} onClick={() => toggleSort("agentCode")} />
                    </TableHead>
                  ) : null}

                  {visibleColumns.referralCode ? (
                    <TableHead>{t.referral}</TableHead>
                  ) : null}

                  {visibleColumns.city ? <TableHead>{t.city}</TableHead> : null}

                  {visibleColumns.customers ? (
                    <TableHead>
                      <SortButton
                        label={t.customers}
                        onClick={() => toggleSort("totalCustomers")}
                      />
                    </TableHead>
                  ) : null}

                  {visibleColumns.orders ? (
                    <TableHead>
                      <SortButton
                        label={t.orders}
                        onClick={() => toggleSort("totalOrders")}
                      />
                    </TableHead>
                  ) : null}

                  {visibleColumns.sales ? (
                    <TableHead>
                      <SortButton
                        label={t.sales}
                        onClick={() => toggleSort("totalSales")}
                      />
                    </TableHead>
                  ) : null}

                  {visibleColumns.commissions ? (
                    <TableHead>
                      <SortButton
                        label={t.commissions}
                        onClick={() => toggleSort("approvedCommission")}
                      />
                    </TableHead>
                  ) : null}

                  {visibleColumns.paid ? <TableHead>{t.paid}</TableHead> : null}

                  {visibleColumns.status ? <TableHead>{t.status}</TableHead> : null}
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-28">
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t.loading}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-28 text-center">
                      {t.noAgents}
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(agent.id)}
                          onCheckedChange={() => toggleRow(agent.id)}
                          aria-label="Select row"
                        />
                      </TableCell>

                      {visibleColumns.name ? (
                        <TableCell>
                          <Link
                            href={`/system/agents/${agent.id}`}
                            className="flex min-w-[220px] items-center gap-3"
                          >
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                              <UserRound className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-semibold hover:text-primary">
                                {agent.fullName}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {agent.email || agent.phone || "-"}
                              </p>
                            </div>
                          </Link>
                        </TableCell>
                      ) : null}

                      {visibleColumns.code ? (
                        <TableCell className="font-medium">
                          {agent.agentCode}
                        </TableCell>
                      ) : null}

                      {visibleColumns.referralCode ? (
                        <TableCell>
                          <Badge variant="secondary" className="rounded-full">
                            {agent.referralCode}
                          </Badge>
                        </TableCell>
                      ) : null}

                      {visibleColumns.city ? (
                        <TableCell>
                          <span className="inline-flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            {agent.city || "-"}
                          </span>
                        </TableCell>
                      ) : null}

                      {visibleColumns.customers ? (
                        <TableCell>{formatNumber(agent.totalCustomers)}</TableCell>
                      ) : null}

                      {visibleColumns.orders ? (
                        <TableCell>{formatNumber(agent.totalOrders)}</TableCell>
                      ) : null}

                      {visibleColumns.sales ? (
                        <TableCell>
                          <SarAmount value={agent.totalSales} />
                        </TableCell>
                      ) : null}

                      {visibleColumns.commissions ? (
                        <TableCell>
                          <SarAmount value={agent.approvedCommission} />
                        </TableCell>
                      ) : null}

                      {visibleColumns.paid ? (
                        <TableCell>
                          <SarAmount value={agent.paidCommission} />
                        </TableCell>
                      ) : null}

                      {visibleColumns.status ? (
                        <TableCell>{statusBadge(agent.status, locale)}</TableCell>
                      ) : null}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="text-muted-foreground flex-1 text-sm">
              {formatNumber(selectedIds.length)} /{" "}
              {formatNumber(filteredAgents.length)} {t.selected}
            </div>

            <div className="text-muted-foreground text-sm">
              {formatNumber(pageIndex + 1)} / {formatNumber(pageCount)}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => setPageIndex((current) => Math.max(current - 1, 0))}
                disabled={pageIndex === 0}
              >
                {t.previous}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() =>
                  setPageIndex((current) => Math.min(current + 1, pageCount - 1))
                }
                disabled={pageIndex >= pageCount - 1}
              >
                {t.next}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Commissions */}
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <HandCoins className="h-5 w-5" />
            {t.commissionsTable}
          </CardTitle>
          <CardDescription>{t.commissionsDesc}</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.reference}</TableHead>
                  <TableHead>{t.agent}</TableHead>
                  <TableHead>{t.order}</TableHead>
                  <TableHead>{t.customer}</TableHead>
                  <TableHead>{t.amount}</TableHead>
                  <TableHead>{t.paid}</TableHead>
                  <TableHead>{t.remaining}</TableHead>
                  <TableHead>{t.status}</TableHead>
                  <TableHead>{t.date}</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24">
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t.loading}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredCommissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                      {t.noCommissions}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCommissions.slice(0, 20).map((commission) => (
                    <TableRow key={commission.id}>
                      <TableCell className="font-medium">
                        {commission.reference}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-semibold">{commission.agentName}</p>
                          <p className="text-muted-foreground text-xs">
                            {commission.agentCode}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{commission.orderNumber}</TableCell>
                      <TableCell>{commission.customerName}</TableCell>
                      <TableCell>
                        <SarAmount value={commission.commissionAmount} />
                      </TableCell>
                      <TableCell>
                        <SarAmount value={commission.paidAmount} />
                      </TableCell>
                      <TableCell>
                        <SarAmount value={commission.remainingAmount} />
                      </TableCell>
                      <TableCell>
                        {commissionStatusBadge(commission.status, locale)}
                      </TableCell>
                      <TableCell>{formatDateTime(commission.createdAt)}</TableCell>
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

/* ============================================================
   Small Components
============================================================ */

function SummaryCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: React.ReactNode;
  icon: React.ElementType;
}) {
  return (
    <Card className="rounded-2xl border bg-card shadow-sm">
      <CardContent className="flex items-center justify-between gap-3 p-5">
        <div>
          <p className="text-muted-foreground text-sm">{title}</p>
          <div className="mt-2 text-lg font-bold">{value}</div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function SortButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <Button className="-ms-3" variant="ghost" onClick={onClick}>
      {label}
      <ArrowDownUp className="h-3 w-3" />
    </Button>
  );
}