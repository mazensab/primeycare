"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  ArrowDownUp,
  ArrowLeft,
  BadgeCheck,
  ColumnsIcon,
  Download,
  Eye,
  FileText,
  HandCoins,
  Loader2,
  MapPin,
  MoreHorizontal,
  Phone,
  PlusCircle,
  RefreshCcw,
  Search,
  ShieldCheck,
  Star,
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

/* ============================================================
   📂 app/system/agents/list/page.tsx
   🧠 Primey Care | Agents List
   ------------------------------------------------------------
   ✅ Phase 6: Agents + Commissions
   ✅ ربط حقيقي مع /api/agents/
   ✅ نفس هوية Primey Care
   ✅ بحث + فلاتر + أعمدة + تحديد + فرز + صفحات
   ✅ تصدير Excel منظم .xlsx
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ الأرقام بالإنجليزية دائمًا
   ✅ استخدام رمز SAR الرسمي
   ✅ استخدام sonner
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

type StatusFilter = "ALL" | AgentStatus;
type CommissionTypeFilter = "ALL" | CommissionType;

type SortKey =
  | "fullName"
  | "agentCode"
  | "referralCode"
  | "city"
  | "status"
  | "defaultCommissionValue"
  | "totalCustomers"
  | "totalOrders"
  | "totalSales"
  | "approvedCommission"
  | "paidCommission";

type SortDirection = "asc" | "desc";

type Agent = {
  id: number | string;
  fullName: string;
  agentCode: string;
  referralCode: string;
  status: AgentStatus;
  phone: string;
  email: string;
  city: string;
  address: string;
  defaultCommissionType: CommissionType;
  defaultCommissionValue: number;
  totalCustomers: number;
  totalOrders: number;
  totalSales: number;
  pendingCommission: number;
  approvedCommission: number;
  paidCommission: number;
  accountingPostedCommission: number;
  bankName: string;
  bankAccountName: string;
  iban: string;
  notes: string;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
  raw: Record<string, unknown>;
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

type AgentsApiResponse = {
  ok?: boolean;
  message?: string;
  count?: number;
  page?: number;
  page_size?: number;
  num_pages?: number;
  has_next?: boolean;
  has_previous?: boolean;
  results?: unknown[];
  data?: unknown[];
  items?: unknown[];
  agents?: unknown[];
  stats?: AgentsApiStats;
};

type VisibleColumns = {
  code: boolean;
  name: boolean;
  referralCode: boolean;
  commission: boolean;
  city: boolean;
  contact: boolean;
  customers: boolean;
  orders: boolean;
  sales: boolean;
  commissions: boolean;
  status: boolean;
  featured: boolean;
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
    const data = payload as AgentsApiResponse;

    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.agents)) return data.agents;
  }

  return [];
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
  const commissionType = String(value || "").toUpperCase();

  if (commissionType === "PERCENTAGE") return "PERCENTAGE";
  if (commissionType === "FIXED") return "FIXED";

  return "UNKNOWN";
}

function extractNestedValue(
  obj: Record<string, unknown>,
  key: string,
): unknown {
  const direct = obj[key];

  if (direct !== undefined && direct !== null && direct !== "") {
    return direct;
  }

  const agent = obj.agent;
  if (agent && typeof agent === "object") {
    const agentObj = agent as Record<string, unknown>;
    const nested = agentObj[key];

    if (nested !== undefined && nested !== null && nested !== "") {
      return nested;
    }
  }

  const stats = obj.stats;
  if (stats && typeof stats === "object") {
    const statsObj = stats as Record<string, unknown>;
    const nested = statsObj[key];

    if (nested !== undefined && nested !== null && nested !== "") {
      return nested;
    }
  }

  const summary = obj.summary;
  if (summary && typeof summary === "object") {
    const summaryObj = summary as Record<string, unknown>;
    const nested = summaryObj[key];

    if (nested !== undefined && nested !== null && nested !== "") {
      return nested;
    }
  }

  return undefined;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const clean = String(value ?? "")
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(clean);

  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeAgent(item: unknown): Agent {
  const obj = (item || {}) as Record<string, unknown>;

  const id =
    extractNestedValue(obj, "id") ??
    extractNestedValue(obj, "agent_id") ??
    "-";

  const fullName =
    extractNestedValue(obj, "full_name") ??
    extractNestedValue(obj, "name") ??
    extractNestedValue(obj, "agent_name") ??
    "-";

  const agentCode =
    extractNestedValue(obj, "agent_code") ??
    extractNestedValue(obj, "code") ??
    (id !== "-" ? `AGT-${id}` : "-");

  const referralCode =
    extractNestedValue(obj, "referral_code") ??
    extractNestedValue(obj, "reference") ??
    extractNestedValue(obj, "ref_code") ??
    "-";

  return {
    id: id as number | string,
    fullName: String(fullName || "-"),
    agentCode: String(agentCode || "-"),
    referralCode: String(referralCode || "-"),
    status: normalizeStatus(extractNestedValue(obj, "status")),
    phone: String(extractNestedValue(obj, "phone") ?? ""),
    email: String(extractNestedValue(obj, "email") ?? ""),
    city: String(extractNestedValue(obj, "city") ?? ""),
    address: String(extractNestedValue(obj, "address") ?? ""),
    defaultCommissionType: normalizeCommissionType(
      extractNestedValue(obj, "default_commission_type") ??
        extractNestedValue(obj, "commission_type"),
    ),
    defaultCommissionValue: toNumber(
      extractNestedValue(obj, "default_commission_value") ??
        extractNestedValue(obj, "commission_value") ??
        0,
    ),
    totalCustomers: toNumber(
      extractNestedValue(obj, "total_customers") ??
        extractNestedValue(obj, "customers_count") ??
        0,
    ),
    totalOrders: toNumber(
      extractNestedValue(obj, "total_orders") ??
        extractNestedValue(obj, "orders_count") ??
        0,
    ),
    totalSales: toNumber(
      extractNestedValue(obj, "total_sales") ??
        extractNestedValue(obj, "sales_total") ??
        0,
    ),
    pendingCommission: toNumber(
      extractNestedValue(obj, "pending_commission") ?? 0,
    ),
    approvedCommission: toNumber(
      extractNestedValue(obj, "approved_commission") ??
        extractNestedValue(obj, "total_commission") ??
        0,
    ),
    paidCommission: toNumber(extractNestedValue(obj, "paid_commission") ?? 0),
    accountingPostedCommission: toNumber(
      extractNestedValue(obj, "accounting_posted_commission") ??
        extractNestedValue(obj, "posted_commission") ??
        0,
    ),
    bankName: String(extractNestedValue(obj, "bank_name") ?? ""),
    bankAccountName: String(extractNestedValue(obj, "bank_account_name") ?? ""),
    iban: String(extractNestedValue(obj, "iban") ?? ""),
    notes: String(extractNestedValue(obj, "notes") ?? ""),
    isFeatured: Boolean(
      extractNestedValue(obj, "is_featured") ??
        extractNestedValue(obj, "featured") ??
        false,
    ),
    createdAt: String(extractNestedValue(obj, "created_at") ?? ""),
    updatedAt: String(extractNestedValue(obj, "updated_at") ?? ""),
    raw: obj,
  };
}

/* ============================================================
   📚 Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "قائمة المندوبين" : "Agents List",
    subtitle: isArabic
      ? "إدارة المندوبين بجدول تشغيلي مرتبط ببيانات العملاء والطلبات والعمولات."
      : "Manage agents in an operational table connected with customers, orders, and commissions.",

    back: isArabic ? "لوحة المندوبين" : "Agents Overview",
    createAgent: isArabic ? "إنشاء مندوب" : "Create Agent",
    refresh: isArabic ? "تحديث" : "Refresh",
    export: isArabic ? "تصدير Excel" : "Export Excel",

    tableTitle: isArabic ? "بيانات المندوبين" : "Agents Data",
    tableSubtitle: isArabic
      ? "جدول متصل مباشرة مع /api/agents/ ويعرض بيانات المندوبين ومؤشرات الأداء."
      : "Table connected directly with /api/agents/ showing agents and performance metrics.",

    searchPlaceholder: isArabic
      ? "ابحث باسم المندوب أو الكود أو كود الإحالة أو المدينة أو الجوال..."
      : "Search by agent name, code, referral code, city, or phone...",
    status: isArabic ? "الحالة" : "Status",
    commissionType: isArabic ? "نوع العمولة" : "Commission Type",
    columns: isArabic ? "الأعمدة" : "Columns",

    all: isArabic ? "الكل" : "All",
    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
    suspended: isArabic ? "موقوف" : "Suspended",
    draft: isArabic ? "مسودة" : "Draft",
    unknown: isArabic ? "غير محدد" : "Unknown",

    percentage: isArabic ? "نسبة" : "Percentage",
    fixed: isArabic ? "مبلغ ثابت" : "Fixed Amount",

    noResults: isArabic ? "لا توجد نتائج." : "No results.",
    loading: isArabic
      ? "جاري تحميل بيانات المندوبين..."
      : "Loading agents data...",
    selectedRows: isArabic ? "صفوف محددة" : "row(s) selected",
    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",

    actions: isArabic ? "الإجراءات" : "Actions",
    viewDetails: isArabic ? "عرض التفاصيل" : "View details",
    copyCode: isArabic ? "نسخ كود المندوب" : "Copy agent code",
    copyReferral: isArabic ? "نسخ كود الإحالة" : "Copy referral code",
    copyId: isArabic ? "نسخ الرقم" : "Copy ID",

    apiError: isArabic
      ? "تعذر تحميل قائمة المندوبين."
      : "Unable to load agents list.",
    refreshSuccess: isArabic
      ? "تم تحديث قائمة المندوبين بنجاح"
      : "Agents list refreshed successfully",
    exportSuccess: isArabic
      ? "تم تجهيز ملف Excel بنجاح"
      : "Excel file prepared successfully",
    exportEmpty: isArabic
      ? "لا توجد بيانات لتصديرها"
      : "No data available to export",
    copied: isArabic ? "تم النسخ بنجاح" : "Copied successfully",

    excelSummary: isArabic ? "ملخص القائمة" : "List Summary",
    excelFilters: isArabic ? "الفلاتر المستخدمة" : "Applied Filters",
    excelTable: isArabic ? "بيانات المندوبين" : "Agents Data",
    generatedAt: isArabic ? "تاريخ التصدير" : "Generated At",
    reportScope: isArabic ? "نطاق التقرير" : "Report Scope",
    currentFilteredData: isArabic
      ? "حسب الفلاتر الحالية"
      : "Current filtered data",
    showing: isArabic ? "المعروض" : "Showing",
    filterSearch: isArabic ? "البحث" : "Search",
    filterStatus: isArabic ? "فلتر الحالة" : "Status Filter",
    filterCommissionType: isArabic
      ? "فلتر نوع العمولة"
      : "Commission Type Filter",

    stats: {
      total: isArabic ? "إجمالي المندوبين" : "Total Agents",
      active: isArabic ? "النشطون" : "Active",
      customers: isArabic ? "العملاء" : "Customers",
      orders: isArabic ? "الطلبات" : "Orders",
      sales: isArabic ? "مبيعات المندوبين" : "Agents Sales",
      commissions: isArabic ? "العمولات" : "Commissions",
      paid: isArabic ? "المدفوع" : "Paid",
      stopped: isArabic ? "الموقوفون" : "Stopped",
    },

    table: {
      id: isArabic ? "المعرف" : "ID",
      name: isArabic ? "اسم المندوب" : "Agent Name",
      code: isArabic ? "كود المندوب" : "Agent Code",
      referralCode: isArabic ? "كود الإحالة" : "Referral Code",
      commission: isArabic ? "إعداد العمولة" : "Commission Setup",
      city: isArabic ? "المدينة" : "City",
      contact: isArabic ? "التواصل" : "Contact",
      customers: isArabic ? "العملاء" : "Customers",
      orders: isArabic ? "الطلبات" : "Orders",
      sales: isArabic ? "المبيعات" : "Sales",
      commissions: isArabic ? "العمولات" : "Commissions",
      status: isArabic ? "الحالة" : "Status",
      featured: isArabic ? "التمييز" : "Featured",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      updatedAt: isArabic ? "آخر تحديث" : "Updated At",
      email: isArabic ? "البريد" : "Email",
      phone: isArabic ? "الجوال" : "Phone",
      bankName: isArabic ? "البنك" : "Bank",
      iban: isArabic ? "الآيبان" : "IBAN",
    },

    columnLabels: {
      code: isArabic ? "الكود" : "Code",
      name: isArabic ? "اسم المندوب" : "Agent Name",
      referralCode: isArabic ? "كود الإحالة" : "Referral Code",
      commission: isArabic ? "إعداد العمولة" : "Commission Setup",
      city: isArabic ? "المدينة" : "City",
      contact: isArabic ? "التواصل" : "Contact",
      customers: isArabic ? "العملاء" : "Customers",
      orders: isArabic ? "الطلبات" : "Orders",
      sales: isArabic ? "المبيعات" : "Sales",
      commissions: isArabic ? "العمولات" : "Commissions",
      status: isArabic ? "الحالة" : "Status",
      featured: isArabic ? "التمييز" : "Featured",
      actions: isArabic ? "الإجراءات" : "Actions",
    } satisfies Record<keyof VisibleColumns, string>,

    statusLabels: {
      ACTIVE: isArabic ? "نشط" : "Active",
      INACTIVE: isArabic ? "غير نشط" : "Inactive",
      SUSPENDED: isArabic ? "موقوف" : "Suspended",
      DRAFT: isArabic ? "مسودة" : "Draft",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<AgentStatus, string>,

    commissionTypeLabels: {
      PERCENTAGE: isArabic ? "نسبة" : "Percentage",
      FIXED: isArabic ? "مبلغ ثابت" : "Fixed Amount",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<CommissionType, string>,
  };
}

/* ============================================================
   🎨 UI Helpers
============================================================ */

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

function SarAmount({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <Image
        src="/currency/sar.svg"
        alt="SAR"
        width={14}
        height={14}
        className="h-3.5 w-3.5"
      />
      <span>{formatMoney(value)}</span>
    </span>
  );
}

function statusBadge(status: AgentStatus, locale: AppLocale) {
  const t = dictionary(locale);
  const label = t.statusLabels[status];

  if (status === "ACTIVE") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (status === "DRAFT") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
        {label}
      </Badge>
    );
  }

  if (status === "SUSPENDED") {
    return (
      <Badge className="rounded-full border-orange-200 bg-orange-50 px-3 py-1 text-orange-700 hover:bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300">
        {label}
      </Badge>
    );
  }

  if (status === "INACTIVE") {
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

function commissionTypeBadge(type: CommissionType, locale: AppLocale) {
  const t = dictionary(locale);

  if (type === "PERCENTAGE") {
    return (
      <Badge variant="secondary" className="rounded-full">
        {t.commissionTypeLabels[type]}
      </Badge>
    );
  }

  if (type === "FIXED") {
    return <Badge className="rounded-full">{t.commissionTypeLabels[type]}</Badge>;
  }

  return (
    <Badge variant="outline" className="rounded-full">
      {t.commissionTypeLabels[type]}
    </Badge>
  );
}

function formatCommission(agent: Agent): string {
  if (agent.defaultCommissionType === "PERCENTAGE") {
    return `${formatNumber(agent.defaultCommissionValue)}%`;
  }

  if (agent.defaultCommissionType === "FIXED") {
    return formatMoney(agent.defaultCommissionValue);
  }

  return "-";
}

function compareValues(a: string | number, b: string | number) {
  const valueA = String(a || "").toLowerCase();
  const valueB = String(b || "").toLowerCase();

  return valueA.localeCompare(valueB, "en", {
    numeric: true,
    sensitivity: "base",
  });
}

function formatDateTime(value: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/* ============================================================
   ✅ Page
============================================================ */

export default function SystemAgentsListPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [apiStats, setApiStats] = useState<AgentsApiStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [commissionTypeFilter, setCommissionTypeFilter] =
    useState<CommissionTypeFilter>("ALL");

  const [sortKey, setSortKey] = useState<SortKey>("fullName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Array<number | string>>([]);

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    code: true,
    name: true,
    referralCode: true,
    commission: true,
    city: true,
    contact: true,
    customers: true,
    orders: true,
    sales: true,
    commissions: true,
    status: true,
    featured: false,
    actions: true,
  });

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const stats = useMemo(() => {
    const total = toNumber(apiStats?.total_agents) || agents.length;
    const active =
      toNumber(apiStats?.active_agents) ||
      agents.filter((item) => item.status === "ACTIVE").length;
    const stopped =
      toNumber(apiStats?.suspended_agents) +
        toNumber(apiStats?.inactive_agents) ||
      agents.filter(
        (item) => item.status === "SUSPENDED" || item.status === "INACTIVE",
      ).length;

    const totalCustomers = agents.reduce(
      (sum, item) => sum + item.totalCustomers,
      0,
    );
    const totalOrders = agents.reduce((sum, item) => sum + item.totalOrders, 0);
    const totalSales =
      toNumber(apiStats?.total_sales) ||
      agents.reduce((sum, item) => sum + item.totalSales, 0);
    const totalCommission =
      toNumber(apiStats?.total_commission) ||
      agents.reduce((sum, item) => sum + item.approvedCommission, 0);
    const totalPaid =
      toNumber(apiStats?.total_paid) ||
      agents.reduce((sum, item) => sum + item.paidCommission, 0);

    return {
      total,
      active,
      stopped,
      totalCustomers,
      totalOrders,
      totalSales,
      totalCommission,
      totalPaid,
    };
  }, [agents, apiStats]);

  const filteredAgents = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    const filtered = agents.filter((agent) => {
      const matchesSearch =
        !cleanQuery ||
        agent.fullName.toLowerCase().includes(cleanQuery) ||
        agent.agentCode.toLowerCase().includes(cleanQuery) ||
        agent.referralCode.toLowerCase().includes(cleanQuery) ||
        agent.city.toLowerCase().includes(cleanQuery) ||
        agent.phone.toLowerCase().includes(cleanQuery) ||
        agent.email.toLowerCase().includes(cleanQuery) ||
        agent.bankName.toLowerCase().includes(cleanQuery) ||
        agent.iban.toLowerCase().includes(cleanQuery);

      const matchesStatus =
        statusFilter === "ALL" || agent.status === statusFilter;

      const matchesCommissionType =
        commissionTypeFilter === "ALL" ||
        agent.defaultCommissionType === commissionTypeFilter;

      return matchesSearch && matchesStatus && matchesCommissionType;
    });

    filtered.sort((a, b) => {
      let result = 0;

      if (
        sortKey === "defaultCommissionValue" ||
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

    return filtered;
  }, [agents, query, statusFilter, commissionTypeFilter, sortKey, sortDirection]);

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
    setSortDirection("asc");
  }

  function toggleRow(id: number | string) {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }

      return [...current, id];
    });
  }

  function toggleAllPageRows() {
    setSelectedIds((current) => {
      if (allPageRowsSelected) {
        return current.filter((id) => !pageRows.some((row) => row.id === id));
      }

      const next = [...current];

      pageRows.forEach((row) => {
        if (!next.includes(row.id)) {
          next.push(row.id);
        }
      });

      return next;
    });
  }

  async function loadAgents(showToast = false) {
    try {
      setIsLoading(true);

      const response = await fetch("/api/agents/?page_size=500", {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const payload = (await response.json().catch(() => null)) as
        | AgentsApiResponse
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || `HTTP ${response.status}`);
      }

      const normalized = normalizeApiList(payload).map(normalizeAgent);

      setAgents(normalized);
      setApiStats(payload.stats || null);
      setSelectedIds([]);
      setPageIndex(0);

      if (showToast) {
        toast.success(t.refreshSuccess);
      }
    } catch (error) {
      console.error("Failed to load agents:", error);
      setAgents([]);
      setApiStats(null);
      toast.error(t.apiError);
    } finally {
      setIsLoading(false);
    }
  }

  function exportExcel() {
    if (filteredAgents.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const now = new Date();
    const generatedAt = formatDateTime(now.toISOString());

    const rows = filteredAgents.map((agent, index) => ({
      [t.table.id]: index + 1,
      [t.table.code]: agent.agentCode,
      [t.table.name]: agent.fullName,
      [t.table.referralCode]: agent.referralCode,
      [t.commissionType]: t.commissionTypeLabels[agent.defaultCommissionType],
      [t.table.commission]: formatCommission(agent),
      [t.table.city]: agent.city || "-",
      [t.table.phone]: agent.phone || "-",
      [t.table.email]: agent.email || "-",
      [t.table.customers]: agent.totalCustomers,
      [t.table.orders]: agent.totalOrders,
      [t.table.sales]: formatMoney(agent.totalSales),
      [t.table.commissions]: formatMoney(agent.approvedCommission),
      [t.stats.paid]: formatMoney(agent.paidCommission),
      [t.table.status]: t.statusLabels[agent.status],
      [t.table.bankName]: agent.bankName || "-",
      [t.table.iban]: agent.iban || "-",
      [t.table.createdAt]: formatDateTime(agent.createdAt),
      [t.table.updatedAt]: formatDateTime(agent.updatedAt),
    }));

    const summaryRows = [
      [t.excelSummary, ""],
      [t.generatedAt, generatedAt],
      [t.reportScope, t.currentFilteredData],
      [t.showing, `${filteredAgents.length} / ${agents.length}`],
      ["", ""],
      [t.stats.total, stats.total],
      [t.stats.active, stats.active],
      [t.stats.customers, stats.totalCustomers],
      [t.stats.orders, stats.totalOrders],
      [t.stats.sales, formatMoney(stats.totalSales)],
      [t.stats.commissions, formatMoney(stats.totalCommission)],
      [t.stats.paid, formatMoney(stats.totalPaid)],
      ["", ""],
      [t.excelFilters, ""],
      [t.filterSearch, query || t.all],
      [t.filterStatus, statusFilter === "ALL" ? t.all : t.statusLabels[statusFilter]],
      [
        t.filterCommissionType,
        commissionTypeFilter === "ALL"
          ? t.all
          : t.commissionTypeLabels[commissionTypeFilter],
      ],
      ["", ""],
      [t.excelTable, ""],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(summaryRows);

    XLSX.utils.sheet_add_json(worksheet, rows, {
      origin: summaryRows.length,
      skipHeader: false,
    });

    worksheet["!cols"] = [
      { wch: 10 },
      { wch: 18 },
      { wch: 28 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 30 },
      { wch: 12 },
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 22 },
      { wch: 28 },
      { wch: 24 },
      { wch: 24 },
    ];

    const workbook = XLSX.utils.book_new();
    workbook.Workbook = {
      Views: [{ RTL: isArabic }],
    };

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      isArabic ? "المندوبون" : "Agents",
    );

    XLSX.writeFile(
      workbook,
      `primey-care-agents-${now.toISOString().slice(0, 10)}.xlsx`,
    );

    toast.success(t.exportSuccess);
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
    loadAgents(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useEffect(() => {
    setPageIndex(0);
  }, [query, statusFilter, commissionTypeFilter]);

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

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadAgents(true)}
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
            <span>{t.export}</span>
          </Button>

          <Link href="/system/agents/create">
            <Button className="h-10 w-full rounded-xl sm:w-auto">
              <PlusCircle className="h-4 w-4" />
              <span>{t.createAgent}</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-6">
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex items-center justify-between gap-3 p-5">
            <div>
              <p className="text-muted-foreground text-sm">{t.stats.total}</p>
              <p className="mt-2 text-2xl font-bold">
                {isLoading ? "..." : formatNumber(stats.total)}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex items-center justify-between gap-3 p-5">
            <div>
              <p className="text-muted-foreground text-sm">{t.stats.active}</p>
              <p className="mt-2 text-2xl font-bold">
                {isLoading ? "..." : formatNumber(stats.active)}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
              <BadgeCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex items-center justify-between gap-3 p-5">
            <div>
              <p className="text-muted-foreground text-sm">{t.stats.customers}</p>
              <p className="mt-2 text-2xl font-bold">
                {isLoading ? "..." : formatNumber(stats.totalCustomers)}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
              <UserRound className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex items-center justify-between gap-3 p-5">
            <div>
              <p className="text-muted-foreground text-sm">{t.stats.orders}</p>
              <p className="mt-2 text-2xl font-bold">
                {isLoading ? "..." : formatNumber(stats.totalOrders)}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
              <FileText className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex items-center justify-between gap-3 p-5">
            <div>
              <p className="text-muted-foreground text-sm">{t.stats.sales}</p>
              <p className="mt-2 text-lg font-bold">
                {isLoading ? "..." : <SarAmount value={stats.totalSales} />}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex items-center justify-between gap-3 p-5">
            <div>
              <p className="text-muted-foreground text-sm">{t.stats.commissions}</p>
              <p className="mt-2 text-lg font-bold">
                {isLoading ? "..." : <SarAmount value={stats.totalCommission} />}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
              <HandCoins className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold">{t.tableTitle}</CardTitle>
          <CardDescription>{t.tableSubtitle}</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            {/* Filters */}
            <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
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
                <option value="ACTIVE">{t.active}</option>
                <option value="DRAFT">{t.draft}</option>
                <option value="SUSPENDED">{t.suspended}</option>
                <option value="INACTIVE">{t.inactive}</option>
                <option value="UNKNOWN">{t.unknown}</option>
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
                <option value="PERCENTAGE">{t.percentage}</option>
                <option value="FIXED">{t.fixed}</option>
                <option value="UNKNOWN">{t.unknown}</option>
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

            {/* Data Table */}
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
                        <Button
                          className="-ms-3"
                          variant="ghost"
                          onClick={() => toggleSort("fullName")}
                        >
                          {t.table.name}
                          <ArrowDownUp className="h-3 w-3" />
                        </Button>
                      </TableHead>
                    ) : null}

                    {visibleColumns.code ? (
                      <TableHead>
                        <Button
                          className="-ms-3"
                          variant="ghost"
                          onClick={() => toggleSort("agentCode")}
                        >
                          {t.table.code}
                          <ArrowDownUp className="h-3 w-3" />
                        </Button>
                      </TableHead>
                    ) : null}

                    {visibleColumns.referralCode ? (
                      <TableHead>
                        <Button
                          className="-ms-3"
                          variant="ghost"
                          onClick={() => toggleSort("referralCode")}
                        >
                          {t.table.referralCode}
                          <ArrowDownUp className="h-3 w-3" />
                        </Button>
                      </TableHead>
                    ) : null}

                    {visibleColumns.commission ? (
                      <TableHead>
                        <Button
                          className="-ms-3"
                          variant="ghost"
                          onClick={() => toggleSort("defaultCommissionValue")}
                        >
                          {t.table.commission}
                          <ArrowDownUp className="h-3 w-3" />
                        </Button>
                      </TableHead>
                    ) : null}

                    {visibleColumns.city ? (
                      <TableHead>
                        <Button
                          className="-ms-3"
                          variant="ghost"
                          onClick={() => toggleSort("city")}
                        >
                          {t.table.city}
                          <ArrowDownUp className="h-3 w-3" />
                        </Button>
                      </TableHead>
                    ) : null}

                    {visibleColumns.contact ? (
                      <TableHead>{t.table.contact}</TableHead>
                    ) : null}

                    {visibleColumns.customers ? (
                      <TableHead>
                        <Button
                          className="-ms-3"
                          variant="ghost"
                          onClick={() => toggleSort("totalCustomers")}
                        >
                          {t.table.customers}
                          <ArrowDownUp className="h-3 w-3" />
                        </Button>
                      </TableHead>
                    ) : null}

                    {visibleColumns.orders ? (
                      <TableHead>
                        <Button
                          className="-ms-3"
                          variant="ghost"
                          onClick={() => toggleSort("totalOrders")}
                        >
                          {t.table.orders}
                          <ArrowDownUp className="h-3 w-3" />
                        </Button>
                      </TableHead>
                    ) : null}

                    {visibleColumns.sales ? (
                      <TableHead>
                        <Button
                          className="-ms-3"
                          variant="ghost"
                          onClick={() => toggleSort("totalSales")}
                        >
                          {t.table.sales}
                          <ArrowDownUp className="h-3 w-3" />
                        </Button>
                      </TableHead>
                    ) : null}

                    {visibleColumns.commissions ? (
                      <TableHead>
                        <Button
                          className="-ms-3"
                          variant="ghost"
                          onClick={() => toggleSort("approvedCommission")}
                        >
                          {t.table.commissions}
                          <ArrowDownUp className="h-3 w-3" />
                        </Button>
                      </TableHead>
                    ) : null}

                    {visibleColumns.status ? (
                      <TableHead>
                        <Button
                          className="-ms-3"
                          variant="ghost"
                          onClick={() => toggleSort("status")}
                        >
                          {t.table.status}
                          <ArrowDownUp className="h-3 w-3" />
                        </Button>
                      </TableHead>
                    ) : null}

                    {visibleColumns.featured ? (
                      <TableHead>{t.table.featured}</TableHead>
                    ) : null}

                    {visibleColumns.actions ? (
                      <TableHead>{t.actions}</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={14} className="h-28">
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t.loading}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : pageRows.length ? (
                    pageRows.map((agent) => (
                      <TableRow
                        key={agent.id}
                        data-state={
                          selectedIds.includes(agent.id) ? "selected" : undefined
                        }
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(agent.id)}
                            onCheckedChange={() => toggleRow(agent.id)}
                            aria-label="Select row"
                          />
                        </TableCell>

                        {visibleColumns.name ? (
                          <TableCell>
                            <div className="flex min-w-[240px] items-center gap-4">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-muted">
                                <UserRound className="h-5 w-5" />
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="truncate font-medium">
                                    {agent.fullName}
                                  </span>

                                  {agent.isFeatured ? (
                                    <Star className="size-4 fill-orange-400 text-orange-400" />
                                  ) : null}
                                </div>

                                <div className="text-muted-foreground mt-1 truncate text-xs">
                                  {agent.email || agent.phone || agent.agentCode}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        ) : null}

                        {visibleColumns.code ? (
                          <TableCell className="font-medium">
                            {agent.agentCode || `#${agent.id}`}
                          </TableCell>
                        ) : null}

                        {visibleColumns.referralCode ? (
                          <TableCell>
                            <Badge variant="secondary" className="rounded-full">
                              {agent.referralCode || "-"}
                            </Badge>
                          </TableCell>
                        ) : null}

                        {visibleColumns.commission ? (
                          <TableCell>
                            <div className="flex min-w-[150px] items-center gap-2">
                              <HandCoins className="text-muted-foreground h-3.5 w-3.5" />
                              {agent.defaultCommissionType === "FIXED" ? (
                                <SarAmount value={agent.defaultCommissionValue} />
                              ) : (
                                <span className="font-medium">
                                  {formatCommission(agent)}
                                </span>
                              )}
                            </div>
                            <div className="mt-1">
                              {commissionTypeBadge(
                                agent.defaultCommissionType,
                                locale,
                              )}
                            </div>
                          </TableCell>
                        ) : null}

                        {visibleColumns.city ? (
                          <TableCell>
                            <div className="flex min-w-[120px] items-center gap-2">
                              <MapPin className="text-muted-foreground h-3.5 w-3.5" />
                              <span>{agent.city || "-"}</span>
                            </div>
                          </TableCell>
                        ) : null}

                        {visibleColumns.contact ? (
                          <TableCell>
                            <div className="flex min-w-[130px] items-center gap-2">
                              <Phone className="text-muted-foreground h-3.5 w-3.5" />
                              <span>{agent.phone || "-"}</span>
                            </div>
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
                            <div className="space-y-1">
                              <div className="font-medium">
                                <SarAmount value={agent.approvedCommission} />
                              </div>
                              <div className="text-muted-foreground text-xs">
                                {t.stats.paid}: {formatMoney(agent.paidCommission)}
                              </div>
                            </div>
                          </TableCell>
                        ) : null}

                        {visibleColumns.status ? (
                          <TableCell>{statusBadge(agent.status, locale)}</TableCell>
                        ) : null}

                        {visibleColumns.featured ? (
                          <TableCell>
                            {agent.isFeatured ? (
                              <Badge className="rounded-full">
                                {isArabic ? "مميز" : "Featured"}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="rounded-full">
                                {isArabic ? "عادي" : "Normal"}
                              </Badge>
                            )}
                          </TableCell>
                        ) : null}

                        {visibleColumns.actions ? (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">{t.actions}</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>

                              <DropdownMenuContent align={isArabic ? "start" : "end"}>
                                <DropdownMenuLabel>{t.actions}</DropdownMenuLabel>
                                <DropdownMenuSeparator />

                                <DropdownMenuItem asChild>
                                  <Link href={`/system/agents/${agent.id}`}>
                                    <Eye className="h-4 w-4" />
                                    {t.viewDetails}
                                  </Link>
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      String(agent.agentCode),
                                    );
                                    toast.success(t.copied);
                                  }}
                                >
                                  {t.copyCode}
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      String(agent.referralCode),
                                    );
                                    toast.success(t.copied);
                                  }}
                                >
                                  {t.copyReferral}
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => {
                                    navigator.clipboard.writeText(String(agent.id));
                                    toast.success(t.copied);
                                  }}
                                >
                                  {t.copyId}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={14} className="h-28 text-center">
                        {t.noResults}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <div className="text-muted-foreground flex-1 text-sm">
                {formatNumber(selectedIds.length)} /{" "}
                {formatNumber(filteredAgents.length)} {t.selectedRows}
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
                    setPageIndex((current) =>
                      Math.min(current + 1, pageCount - 1),
                    )
                  }
                  disabled={pageIndex >= pageCount - 1}
                >
                  {t.next}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Readiness Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">
                {isArabic ? "ملفات المندوبين" : "Agent Profiles"}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {isArabic ? "بيانات أساسية وتشغيلية" : "Core and operational data"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">
                {isArabic ? "العمولات" : "Commissions"}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {isArabic ? "نسبة أو مبلغ ثابت" : "Percentage or fixed amount"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">
                {isArabic ? "جاهزية كشف الحساب" : "Statement Ready"}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {isArabic
                  ? "مرتبط لاحقًا بصفحة التفاصيل"
                  : "Connected later with detail page"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}