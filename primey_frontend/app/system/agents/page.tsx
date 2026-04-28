"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Calculator,
  Download,
  Eye,
  Filter,
  HandCoins,
  Landmark,
  ListChecks,
  Loader2,
  MapPin,
  Plus,
  RefreshCcw,
  Search,
  Star,
  TrendingUp,
  UserRound,
  Users,
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

/* ============================================================
   📂 app/system/agents/page.tsx
   🧠 Primey Care | System Agents Dashboard
   ------------------------------------------------------------
   ✅ Phase 6: Agents + Customers + Orders + Commissions
   ✅ متوافق مع /api/agents/
   ✅ متوافق مع /api/agents/commissions/
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ أرقام إنجليزية دائمًا
   ✅ استخدام sonner
   ✅ استخدام رمز SAR الرسمي
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

  const commissions = obj.commissions;
  if (commissions && typeof commissions === "object") {
    const commissionObj = commissions as Record<string, unknown>;
    const nested = commissionObj[key];

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

  const totalCustomers =
    extractNestedValue(obj, "total_customers") ??
    extractNestedValue(obj, "customers_count") ??
    extractNestedValue(obj, "customer_count") ??
    extractNestedValue(obj, "linked_customers") ??
    0;

  const totalOrders =
    extractNestedValue(obj, "total_orders") ??
    extractNestedValue(obj, "orders_count") ??
    extractNestedValue(obj, "order_count") ??
    extractNestedValue(obj, "linked_orders") ??
    0;

  const totalSales =
    extractNestedValue(obj, "total_sales") ??
    extractNestedValue(obj, "sales_total") ??
    extractNestedValue(obj, "orders_total") ??
    extractNestedValue(obj, "revenue") ??
    0;

  const pendingCommission =
    extractNestedValue(obj, "pending_commission") ??
    extractNestedValue(obj, "pending_commissions") ??
    extractNestedValue(obj, "commission_pending") ??
    0;

  const approvedCommission =
    extractNestedValue(obj, "approved_commission") ??
    extractNestedValue(obj, "approved_commissions") ??
    extractNestedValue(obj, "commission_approved") ??
    0;

  const paidCommission =
    extractNestedValue(obj, "paid_commission") ??
    extractNestedValue(obj, "paid_commissions") ??
    extractNestedValue(obj, "commission_paid") ??
    0;

  const accountingPostedCommission =
    extractNestedValue(obj, "accounting_posted_commission") ??
    extractNestedValue(obj, "posted_commission") ??
    extractNestedValue(obj, "posted_commissions") ??
    extractNestedValue(obj, "commission_posted") ??
    0;

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
        extractNestedValue(obj, "amount") ??
        0,
    ),
    totalCustomers: toNumber(totalCustomers),
    totalOrders: toNumber(totalOrders),
    totalSales: toNumber(totalSales),
    pendingCommission: toNumber(pendingCommission),
    approvedCommission: toNumber(approvedCommission),
    paidCommission: toNumber(paidCommission),
    accountingPostedCommission: toNumber(accountingPostedCommission),
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
    pageTitle: isArabic ? "إدارة المندوبين" : "Agents Management",
    pageSubtitle: isArabic
      ? "لوحة تشغيلية لمتابعة المندوبين، العملاء المرتبطين، الطلبات، العمولات، وحالة الترحيل المحاسبي."
      : "Operational dashboard for agents, linked customers, orders, commissions, and accounting posting status.",

    addAgent: isArabic ? "إنشاء مندوب" : "Create Agent",
    reports: isArabic ? "التقارير" : "Reports",
    export: isArabic ? "تصدير" : "Export",
    refresh: isArabic ? "تحديث" : "Refresh",

    featuredAgents: isArabic ? "أفضل المندوبين" : "Top Agents",
    featuredSubtitle: isArabic
      ? "عرض مختصر لأعلى المندوبين حسب المبيعات أو السجلات التشغيلية."
      : "Compact view of top agents based on sales or operational records.",

    trackStatus: isArabic
      ? "تشغيل المندوبين والعمولات"
      : "Agents Operations & Commissions",
    trackSubtitle: isArabic
      ? "تحليل سريع لحالة المندوبين، العملاء، الطلبات، والعمولات."
      : "Quick analysis of agents, customers, orders, and commissions.",

    filterPlaceholder: isArabic
      ? "ابحث باسم المندوب، الكود، المدينة، الجوال، الحالة..."
      : "Search by agent name, code, city, phone, status...",
    filter: isArabic ? "تصفية" : "Filter",
    previous: isArabic ? "السابق" : "Previous",
    viewList: isArabic ? "عرض القائمة" : "View List",

    total: isArabic ? "إجمالي المندوبين" : "Total Agents",
    active: isArabic ? "نشط" : "Active",
    draft: isArabic ? "مسودة" : "Draft",
    suspended: isArabic ? "موقوف" : "Suspended",
    inactive: isArabic ? "غير نشط" : "Inactive",
    unknown: isArabic ? "غير محدد" : "Unknown",

    linkedCustomers: isArabic ? "العملاء المرتبطون" : "Linked Customers",
    linkedOrders: isArabic ? "الطلبات المرتبطة" : "Linked Orders",
    totalSales: isArabic ? "مبيعات المندوبين" : "Agents Sales",
    pendingCommissions: isArabic ? "عمولات معلقة" : "Pending Commissions",
    approvedCommissions: isArabic ? "عمولات معتمدة" : "Approved Commissions",
    paidCommissions: isArabic ? "عمولات مدفوعة" : "Paid Commissions",
    accountingPosted: isArabic ? "مرحل محاسبيًا" : "Accounting Posted",

    newAgents: isArabic ? "سجلات تشغيلية" : "Operational Records",
    operational: isArabic ? "جاهز للتشغيل" : "Ready",

    table: {
      id: isArabic ? "الكود" : "Code",
      name: isArabic ? "اسم المندوب" : "Agent Name",
      code: isArabic ? "كود الإحالة" : "Referral Code",
      city: isArabic ? "المدينة" : "City",
      customers: isArabic ? "العملاء" : "Customers",
      orders: isArabic ? "الطلبات" : "Orders",
      commission: isArabic ? "العمولة" : "Commission",
      status: isArabic ? "الحالة" : "Status",
      action: isArabic ? "الإجراء" : "Action",
    },

    emptyTitle: isArabic ? "لا يوجد مندوبون بعد" : "No agents yet",
    emptyText: isArabic
      ? "عند إضافة مندوبين من صفحة الإنشاء أو من لوحة Django ستظهر البيانات هنا مباشرة."
      : "Agents created from the create page or Django admin will appear here.",
    loading: isArabic
      ? "جاري تحميل بيانات المندوبين..."
      : "Loading agents data...",
    apiError: isArabic
      ? "تعذر تحميل بيانات المندوبين."
      : "Unable to load agents data.",
    refreshSuccess: isArabic
      ? "تم تحديث بيانات المندوبين بنجاح"
      : "Agents data refreshed successfully",
    exportSuccess: isArabic
      ? "تم تصدير ملخص المندوبين بنجاح"
      : "Agents summary exported successfully",
    exportEmpty: isArabic
      ? "لا توجد بيانات لتصديرها"
      : "No data available to export",

    quickAccessTitle: isArabic
      ? "إجراءات وحدة المندوبين"
      : "Agents Module Actions",
    quickAccessSubtitle: isArabic
      ? "اختصارات منظمة للوصول إلى صفحات المندوبين والعمولات والتقارير."
      : "Organized shortcuts for agents, commissions, and reports pages.",

    open: isArabic ? "فتح" : "Open",
    manage: isArabic ? "إدارة" : "Manage",
    view: isArabic ? "عرض" : "View",

    actionListTitle: isArabic ? "قائمة المندوبين" : "Agents List",
    actionListDesc: isArabic
      ? "استعراض جميع المندوبين، البحث، التصفية، وإدارة السجلات."
      : "Browse all agents, search, filter, and manage records.",

    actionCreateTitle: isArabic ? "إنشاء مندوب" : "Create Agent",
    actionCreateDesc: isArabic
      ? "إضافة مندوب جديد وربطه لاحقًا بالعملاء والطلبات والعمولات."
      : "Add a new agent and later connect it with customers, orders, and commissions.",

    actionReportsTitle: isArabic ? "تقارير المندوبين" : "Agents Reports",
    actionReportsDesc: isArabic
      ? "عرض تقارير تشغيلية، أداء المندوبين، العمولات، والتصدير."
      : "View operational reports, agent performance, commissions, and export.",

    actionCommissionTitle: isArabic ? "العمولات والترحيل" : "Commissions & Posting",
    actionCommissionDesc: isArabic
      ? "متابعة العمولات المعلقة والمعتمدة والمدفوعة والمرحلة محاسبيًا."
      : "Track pending, approved, paid, and accounting-posted commissions.",

    commissionTypeLabels: {
      PERCENTAGE: isArabic ? "نسبة" : "Percentage",
      FIXED: isArabic ? "مبلغ ثابت" : "Fixed",
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

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

function statusLabel(status: AgentStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<AgentStatus, string> = {
    ACTIVE: t.active,
    INACTIVE: t.inactive,
    SUSPENDED: t.suspended,
    DRAFT: t.draft,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function statusBadge(status: AgentStatus, locale: AppLocale) {
  const label = statusLabel(status, locale);

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

/* ============================================================
   ✅ Page
============================================================ */

export default function SystemAgentsPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [apiStats, setApiStats] = useState<AgentsApiStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const filteredAgents = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    if (!cleanQuery) return agents;

    return agents.filter((agent) => {
      return (
        agent.fullName.toLowerCase().includes(cleanQuery) ||
        agent.agentCode.toLowerCase().includes(cleanQuery) ||
        agent.referralCode.toLowerCase().includes(cleanQuery) ||
        agent.city.toLowerCase().includes(cleanQuery) ||
        agent.phone.toLowerCase().includes(cleanQuery) ||
        agent.email.toLowerCase().includes(cleanQuery) ||
        agent.defaultCommissionType.toLowerCase().includes(cleanQuery) ||
        agent.status.toLowerCase().includes(cleanQuery)
      );
    });
  }, [agents, query]);

  const stats = useMemo(() => {
    const total = toNumber(apiStats?.total_agents) || agents.length;
    const active =
      toNumber(apiStats?.active_agents) ||
      agents.filter((item) => item.status === "ACTIVE").length;
    const draft =
      toNumber(apiStats?.draft_agents) ||
      agents.filter((item) => item.status === "DRAFT").length;
    const suspended =
      toNumber(apiStats?.suspended_agents) ||
      agents.filter((item) => item.status === "SUSPENDED").length;
    const inactive =
      toNumber(apiStats?.inactive_agents) ||
      agents.filter((item) => item.status === "INACTIVE").length;

    const totalCustomers = agents.reduce(
      (sum, item) => sum + item.totalCustomers,
      0,
    );
    const totalOrders = agents.reduce((sum, item) => sum + item.totalOrders, 0);
    const totalSales =
      toNumber(apiStats?.total_sales) ||
      agents.reduce((sum, item) => sum + item.totalSales, 0);
    const pendingCommission = agents.reduce(
      (sum, item) => sum + item.pendingCommission,
      0,
    );
    const approvedCommission =
      toNumber(apiStats?.total_commission) ||
      agents.reduce((sum, item) => sum + item.approvedCommission, 0);
    const paidCommission =
      toNumber(apiStats?.total_paid) ||
      agents.reduce((sum, item) => sum + item.paidCommission, 0);
    const accountingPostedCommission = agents.reduce(
      (sum, item) => sum + item.accountingPostedCommission,
      0,
    );

    return {
      total,
      active,
      draft,
      suspended,
      inactive,
      stopped: suspended + inactive,
      totalCustomers,
      totalOrders,
      totalSales,
      pendingCommission,
      approvedCommission,
      paidCommission,
      accountingPostedCommission,
    };
  }, [agents, apiStats]);

  const featuredAgents = useMemo(() => {
    const featured = agents.filter((item) => item.isFeatured);

    if (featured.length > 0) {
      return featured.slice(0, 6);
    }

    return [...agents]
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 6);
  }, [agents]);

  const tableRows = useMemo(() => filteredAgents.slice(0, 8), [filteredAgents]);

  const statusCards = useMemo(
    () => [
      {
        title: t.total,
        value: formatNumber(stats.total),
        helper: t.newAgents,
        helperValue: "100%",
        icon: Users,
        percent: 100,
      },
      {
        title: t.active,
        value: formatNumber(stats.active),
        helper: t.operational,
        helperValue: `${percent(stats.active, stats.total)}%`,
        icon: BadgeCheck,
        percent: percent(stats.active, stats.total),
      },
      {
        title: t.linkedCustomers,
        value: formatNumber(stats.totalCustomers),
        helper: t.linkedOrders,
        helperValue: formatNumber(stats.totalOrders),
        icon: UserRound,
        percent: percent(stats.totalCustomers, Math.max(stats.totalCustomers, 1)),
      },
      {
        title: t.pendingCommissions,
        value: formatMoney(stats.pendingCommission),
        helper: t.approvedCommissions,
        helperValue: formatMoney(stats.approvedCommission),
        icon: HandCoins,
        percent: percent(
          stats.approvedCommission,
          stats.approvedCommission + stats.pendingCommission,
        ),
      },
    ],
    [stats, t],
  );

  const financialCards = useMemo(
    () => [
      {
        title: t.totalSales,
        value: stats.totalSales,
        icon: TrendingUp,
        helper: t.linkedOrders,
        helperValue: formatNumber(stats.totalOrders),
      },
      {
        title: t.approvedCommissions,
        value: stats.approvedCommission,
        icon: Calculator,
        helper: t.pendingCommissions,
        helperValue: formatMoney(stats.pendingCommission),
      },
      {
        title: t.paidCommissions,
        value: stats.paidCommission,
        icon: Wallet,
        helper: t.accountingPosted,
        helperValue: formatMoney(stats.accountingPostedCommission),
      },
    ],
    [stats, t],
  );

  const moduleActions = useMemo(
    () => [
      {
        title: t.actionListTitle,
        description: t.actionListDesc,
        href: "/system/agents/list",
        icon: Users,
        badge: `${formatNumber(stats.total)}`,
        cta: t.manage,
      },
      {
        title: t.actionCreateTitle,
        description: t.actionCreateDesc,
        href: "/system/agents/create",
        icon: Plus,
        badge: isArabic ? "جديد" : "New",
        cta: t.open,
      },
      {
        title: t.actionReportsTitle,
        description: t.actionReportsDesc,
        href: "/system/agents/reports",
        icon: Activity,
        badge: isArabic ? "تحليل" : "Reports",
        cta: t.view,
      },
      {
        title: t.actionCommissionTitle,
        description: t.actionCommissionDesc,
        href: "/system/agents/reports?section=commissions",
        icon: Landmark,
        badge: formatMoney(stats.accountingPostedCommission),
        cta: t.view,
      },
    ],
    [isArabic, stats.accountingPostedCommission, stats.total, t],
  );

  const loadAgents = useCallback(
    async (showToast = false) => {
      try {
        setIsLoading(true);

        const response = await fetch("/api/agents/?page_size=100", {
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
    },
    [t.apiError, t.refreshSuccess],
  );

  function exportAgentsSummary() {
    if (filteredAgents.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const headers = [
      "agent_code",
      "full_name",
      "referral_code",
      "status",
      "city",
      "phone",
      "email",
      "customers",
      "orders",
      "total_sales",
      "pending_commission",
      "approved_commission",
      "paid_commission",
      "accounting_posted_commission",
    ];

    const rows = filteredAgents.map((agent) => [
      agent.agentCode,
      agent.fullName,
      agent.referralCode,
      agent.status,
      agent.city,
      agent.phone,
      agent.email,
      String(agent.totalCustomers),
      String(agent.totalOrders),
      formatMoney(agent.totalSales),
      formatMoney(agent.pendingCommission),
      formatMoney(agent.approvedCommission),
      formatMoney(agent.paidCommission),
      formatMoney(agent.accountingPostedCommission),
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "primey-care-agents-summary.csv";
    link.click();

    URL.revokeObjectURL(url);
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
  }, [loadAgents]);

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
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-6">
            {t.pageSubtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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

          <Link href="/system/agents/reports">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <BarChart3 className="h-4 w-4" />
              <span>{t.reports}</span>
            </Button>
          </Link>

          <Link href="/system/agents/create">
            <Button className="h-10 w-full rounded-xl sm:w-auto">
              <Plus className="h-4 w-4" />
              <span>{t.addAgent}</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* =====================================================
          Financial Summary
      ====================================================== */}
      <div className="grid gap-4 md:grid-cols-3">
        {financialCards.map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.title} className="rounded-2xl border shadow-sm">
              <CardContent className="flex items-start justify-between gap-4 p-5">
                <div className="space-y-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted">
                    <Icon className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-muted-foreground text-sm">
                      {item.title}
                    </p>
                    <p className="mt-1 text-2xl font-bold">
                      {isLoading ? "..." : <SarAmount value={item.value} />}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border bg-background px-3 py-2 text-end">
                  <p className="text-muted-foreground text-xs">{item.helper}</p>
                  <p className="mt-1 text-sm font-semibold">
                    {item.helperValue}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* =====================================================
          Main Layout
      ====================================================== */}
      <div className="grid gap-4 xl:grid-cols-3">
        {/* Top Agents */}
        <Card className="rounded-2xl border bg-card shadow-sm xl:col-span-1">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-bold">
                {t.featuredAgents}
              </CardTitle>
              <CardDescription className="mt-1 text-sm leading-6">
                {t.featuredSubtitle}
              </CardDescription>
            </div>

            <Link href="/system/agents/list">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl"
              >
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
            ) : featuredAgents.length === 0 ? (
              <div className="rounded-xl border border-dashed p-5 text-center">
                <p className="font-semibold">{t.emptyTitle}</p>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  {t.emptyText}
                </p>
              </div>
            ) : (
              featuredAgents.map((agent) => (
                <Link
                  key={agent.id}
                  href={`/system/agents/${agent.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3 transition hover:bg-muted/50">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <UserRound className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">
                            {agent.fullName}
                          </p>

                          {agent.isFeatured ? (
                            <Star className="h-3.5 w-3.5 shrink-0 fill-yellow-400 text-yellow-500" />
                          ) : null}
                        </div>

                        <p className="text-muted-foreground mt-1 truncate text-xs">
                          {agent.agentCode}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-end">
                      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {agent.referralCode || "-"}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {formatNumber(agent.totalOrders)} /{" "}
                        {formatNumber(agent.totalCustomers)}
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
              <CardDescription className="mt-1 text-sm leading-6">
                {t.trackSubtitle}
              </CardDescription>
            </div>

            <Button
              variant="outline"
              className="h-9 rounded-xl"
              onClick={exportAgentsSummary}
              disabled={isLoading}
            >
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
                  <div
                    key={card.title}
                    className="rounded-2xl border bg-background p-4"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="text-muted-foreground h-4 w-4" />
                      <p className="text-xl font-bold">
                        {isLoading ? "..." : card.value}
                      </p>
                    </div>

                    <div className="mt-3 space-y-1">
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

                      <p className="text-muted-foreground pt-1 text-xs">
                        {card.helper}
                      </p>
                    </div>
                  </div>
                );
              })}
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
                <span>{t.filter}</span>
              </Button>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.table.id}</TableHead>
                    <TableHead>{t.table.name}</TableHead>
                    <TableHead>{t.table.code}</TableHead>
                    <TableHead>{t.table.city}</TableHead>
                    <TableHead>{t.table.customers}</TableHead>
                    <TableHead>{t.table.orders}</TableHead>
                    <TableHead>{t.table.commission}</TableHead>
                    <TableHead>{t.table.status}</TableHead>
                    <TableHead>{t.table.action}</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>{t.loading}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : tableRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <div className="py-12 text-center">
                          <p className="font-semibold">{t.emptyTitle}</p>
                          <p className="text-muted-foreground mt-2 text-sm">
                            {t.emptyText}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    tableRows.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell className="font-medium">
                          {agent.agentCode || `#${agent.id}`}
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                              <UserRound className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {agent.fullName}
                              </p>
                              <p className="text-muted-foreground truncate text-xs">
                                {agent.email || agent.phone || "-"}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant="secondary" className="rounded-full">
                            {agent.referralCode || "-"}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="text-muted-foreground h-3.5 w-3.5" />
                            <span>{agent.city || "-"}</span>
                          </div>
                        </TableCell>

                        <TableCell>
                          {formatNumber(agent.totalCustomers)}
                        </TableCell>

                        <TableCell>{formatNumber(agent.totalOrders)}</TableCell>

                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm font-semibold">
                              <SarAmount
                                value={
                                  agent.approvedCommission ||
                                  agent.pendingCommission ||
                                  agent.paidCommission
                                }
                              />
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {
                                t.commissionTypeLabels[
                                  agent.defaultCommissionType
                                ]
                              }{" "}
                              {agent.defaultCommissionValue
                                ? formatNumber(agent.defaultCommissionValue)
                                : "-"}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell>{statusBadge(agent.status, locale)}</TableCell>

                        <TableCell>
                          <Link href={`/system/agents/${agent.id}`}>
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
                {formatNumber(filteredAgents.length)} /{" "}
                {formatNumber(agents.length)}
              </p>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled
                >
                  {t.previous}
                </Button>

                <Link href="/system/agents/list">
                  <Button variant="outline" size="sm" className="rounded-xl">
                    <ListChecks className="h-4 w-4" />
                    {t.viewList}
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
          <CardDescription className="leading-6">
            {t.quickAccessSubtitle}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {moduleActions.map((item) => {
              const Icon = item.icon;

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