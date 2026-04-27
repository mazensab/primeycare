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
  ColumnsIcon,
  Download,
  FileText,
  FilterIcon,
  HandCoins,
  Loader2,
  MapPin,
  Phone,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  Star,
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
   ✅ نفس تصميم صفحة تقارير المراكز
   ✅ استخدام UI الداخلي فقط
   ✅ بطاقات + جداول + فلاتر
   ✅ تصدير Excel منظم .xlsx بدل CSV
   ✅ طباعة / Web PDF للتقرير فقط وليس كامل الصفحة
   ✅ ربط حقيقي مع /api/agents/
   ✅ بدون localhost hardcoded
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
type FeaturedFilter = "ALL" | "FEATURED" | "NORMAL";

type SortKey =
  | "fullName"
  | "agentCode"
  | "referralCode"
  | "defaultCommissionType"
  | "defaultCommissionValue"
  | "city"
  | "status";

type SortDirection = "asc" | "desc";

type VisibleColumns = {
  name: boolean;
  code: boolean;
  referralCode: boolean;
  commission: boolean;
  city: boolean;
  contact: boolean;
  status: boolean;
  featured: boolean;
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
  address: string;
  defaultCommissionType: CommissionType;
  defaultCommissionValue: string;
  bankName: string;
  bankAccountName: string;
  iban: string;
  notes: string;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
  raw: Record<string, unknown>;
};

type AgentsApiResponse = {
  ok?: boolean;
  message?: string;
  results?: unknown[];
  data?: unknown[];
  items?: unknown[];
  agents?: unknown[];
};

const SAR_ICON = "/currency/sar.svg";

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
    return agentObj[key];
  }

  return undefined;
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
      extractNestedValue(obj, "default_commission_type"),
    ),
    defaultCommissionValue: String(
      extractNestedValue(obj, "default_commission_value") ??
        extractNestedValue(obj, "commission_value") ??
        extractNestedValue(obj, "amount") ??
        "0.00",
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
    title: isArabic ? "تقارير المندوبين" : "Agents Reports",
    subtitle: isArabic
      ? "تحليل تشغيلي للمندوبين حسب الحالة، نوع العمولة، المدينة، التمييز، وكود الإحالة من بيانات حقيقية."
      : "Operational analysis for agents by status, commission type, city, featured flag, and referral code from live data.",

    back: isArabic ? "لوحة المندوبين" : "Agents Overview",
    list: isArabic ? "قائمة المندوبين" : "Agents List",
    refresh: isArabic ? "تحديث" : "Refresh",
    export: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة / PDF" : "Print / PDF",

    summaryTitle: isArabic ? "ملخص المندوبين" : "Agents Summary",
    summarySubtitle: isArabic
      ? "مؤشرات سريعة حسب بيانات المندوبين الحالية."
      : "Quick indicators based on current agents data.",

    tableTitle: isArabic ? "جدول تقرير المندوبين" : "Agents Report Table",
    tableSubtitle: isArabic
      ? "هذا هو الجزء الذي يتم تصديره وطباعته فقط."
      : "This is the section exported and printed only.",

    byStatus: isArabic ? "التوزيع حسب الحالة" : "Distribution by Status",
    byCity: isArabic ? "التوزيع حسب المدينة" : "Distribution by City",
    byCommissionType: isArabic
      ? "التوزيع حسب نوع العمولة"
      : "Distribution by Commission Type",

    searchPlaceholder: isArabic
      ? "ابحث باسم المندوب أو كود الإحالة أو المدينة..."
      : "Search by agent name, referral code, or city...",
    status: isArabic ? "الحالة" : "Status",
    commissionType: isArabic ? "نوع العمولة" : "Commission Type",
    featured: isArabic ? "التمييز" : "Featured",
    columns: isArabic ? "الأعمدة" : "Columns",

    all: isArabic ? "الكل" : "All",
    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
    suspended: isArabic ? "موقوف" : "Suspended",
    draft: isArabic ? "مسودة" : "Draft",
    unknown: isArabic ? "غير محدد" : "Unknown",
    percentage: isArabic ? "نسبة" : "Percentage",
    fixed: isArabic ? "مبلغ ثابت" : "Fixed Amount",
    featuredOnly: isArabic ? "المميزون فقط" : "Featured Only",
    normalOnly: isArabic ? "العاديون فقط" : "Normal Only",

    noResults: isArabic ? "لا توجد نتائج." : "No results.",
    loading: isArabic
      ? "جاري تحميل بيانات المندوبين..."
      : "Loading agents data...",
    selectedRows: isArabic ? "صفوف محددة" : "row(s) selected",
    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",

    apiError: isArabic
      ? "تعذر تحميل تقرير المندوبين."
      : "Unable to load agents report.",
    refreshSuccess: isArabic
      ? "تم تحديث تقرير المندوبين بنجاح"
      : "Agents report refreshed successfully",
    exportSuccess: isArabic
      ? "تم تجهيز ملف Excel بنجاح"
      : "Excel file prepared successfully",

    excelSummary: isArabic ? "ملخص التقرير" : "Report Summary",
    excelFilters: isArabic ? "الفلاتر المستخدمة" : "Applied Filters",
    excelTable: isArabic ? "بيانات التقرير" : "Report Data",
    generatedAt: isArabic ? "تاريخ التصدير" : "Generated At",
    reportScope: isArabic ? "نطاق التقرير" : "Report Scope",
    currentFilteredData: isArabic
      ? "حسب الفلاتر الحالية"
      : "Current filtered data",
    showing: isArabic ? "المعروض" : "Showing",
    filterSearch: isArabic ? "البحث" : "Search",
    filterStatus: isArabic ? "فلتر الحالة" : "Status Filter",
    filterCommissionType: isArabic ? "فلتر نوع العمولة" : "Commission Type Filter",
    filterFeatured: isArabic ? "فلتر التمييز" : "Featured Filter",

    stats: {
      total: isArabic ? "إجمالي المندوبين" : "Total Agents",
      active: isArabic ? "النشطون" : "Active",
      draft: isArabic ? "المسودات" : "Draft",
      stopped: isArabic ? "الموقوفون/غير النشطين" : "Stopped/Inactive",
      featured: isArabic ? "المميزون" : "Featured",
      percentage: isArabic ? "عمولة نسبة" : "Percentage Commission",
      fixed: isArabic ? "عمولة ثابتة" : "Fixed Commission",
      avgCommission: isArabic ? "متوسط العمولة" : "Avg. Commission",
    },

    table: {
      id: isArabic ? "المعرف" : "ID",
      name: isArabic ? "اسم المندوب" : "Agent Name",
      code: isArabic ? "كود المندوب" : "Agent Code",
      referralCode: isArabic ? "كود الإحالة" : "Referral Code",
      commission: isArabic ? "العمولة" : "Commission",
      commissionType: isArabic ? "نوع العمولة" : "Commission Type",
      commissionValue: isArabic ? "قيمة العمولة" : "Commission Value",
      city: isArabic ? "المدينة" : "City",
      contact: isArabic ? "التواصل" : "Contact",
      status: isArabic ? "الحالة" : "Status",
      featured: isArabic ? "التمييز" : "Featured",
      email: isArabic ? "البريد" : "Email",
      phone: isArabic ? "الجوال" : "Phone",
      bankName: isArabic ? "البنك" : "Bank",
      iban: isArabic ? "الآيبان" : "IBAN",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      updatedAt: isArabic ? "آخر تحديث" : "Updated At",
    },

    columnLabels: {
      name: isArabic ? "اسم المندوب" : "Agent Name",
      code: isArabic ? "كود المندوب" : "Agent Code",
      referralCode: isArabic ? "كود الإحالة" : "Referral Code",
      commission: isArabic ? "العمولة" : "Commission",
      city: isArabic ? "المدينة" : "City",
      contact: isArabic ? "التواصل" : "Contact",
      status: isArabic ? "الحالة" : "Status",
      featured: isArabic ? "التمييز" : "Featured",
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

function safeNumber(value: string) {
  const numberValue = Number(String(value || "0").replace(",", "."));
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatCommission(agent: Agent, locale: AppLocale) {
  const value = safeNumber(agent.defaultCommissionValue).toLocaleString(
    locale === "ar" ? "ar-SA" : "en-US",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
  );

  if (agent.defaultCommissionType === "PERCENTAGE") {
    return `${value}%`;
  }

  if (agent.defaultCommissionType === "FIXED") {
    return `${value} SAR`;
  }

  return "-";
}

function compareValues(a: string | number, b: string | number) {
  const valueA = String(a || "").toLowerCase();
  const valueB = String(b || "").toLowerCase();

  return valueA.localeCompare(valueB, "ar", {
    numeric: true,
    sensitivity: "base",
  });
}

function formatDateTime(value: string, locale: AppLocale) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function groupByCount<T extends string>(
  items: Agent[],
  resolver: (agent: Agent) => T,
) {
  const map = new Map<T, number>();

  items.forEach((item) => {
    const key = resolver(item);
    map.set(key, (map.get(key) || 0) + 1);
  });

  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

/* ============================================================
   ✅ Page
============================================================ */

export default function SystemAgentsReportsPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [commissionTypeFilter, setCommissionTypeFilter] =
    useState<CommissionTypeFilter>("ALL");
  const [featuredFilter, setFeaturedFilter] = useState<FeaturedFilter>("ALL");

  const [sortKey, setSortKey] = useState<SortKey>("fullName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Array<number | string>>([]);

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    name: true,
    code: true,
    referralCode: true,
    commission: true,
    city: true,
    contact: true,
    status: true,
    featured: true,
  });

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

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

      const matchesFeatured =
        featuredFilter === "ALL" ||
        (featuredFilter === "FEATURED" && agent.isFeatured) ||
        (featuredFilter === "NORMAL" && !agent.isFeatured);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCommissionType &&
        matchesFeatured
      );
    });

    filtered.sort((a, b) => {
      let result = 0;

      if (sortKey === "defaultCommissionValue") {
        result =
          safeNumber(a.defaultCommissionValue) -
          safeNumber(b.defaultCommissionValue);
      } else {
        result = compareValues(a[sortKey], b[sortKey]);
      }

      return sortDirection === "asc" ? result : result * -1;
    });

    return filtered;
  }, [agents, query, statusFilter, commissionTypeFilter, featuredFilter, sortKey, sortDirection]);

  const stats = useMemo(() => {
    const total = filteredAgents.length;
    const active = filteredAgents.filter((item) => item.status === "ACTIVE").length;
    const draft = filteredAgents.filter((item) => item.status === "DRAFT").length;
    const stopped = filteredAgents.filter(
      (item) => item.status === "SUSPENDED" || item.status === "INACTIVE",
    ).length;
    const featured = filteredAgents.filter((item) => item.isFeatured).length;
    const percentage = filteredAgents.filter(
      (item) => item.defaultCommissionType === "PERCENTAGE",
    ).length;
    const fixed = filteredAgents.filter(
      (item) => item.defaultCommissionType === "FIXED",
    ).length;

    const values = filteredAgents
      .map((item) => safeNumber(item.defaultCommissionValue))
      .filter((value) => value > 0);

    const avgCommission =
      values.length > 0
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : 0;

    return {
      total,
      active,
      draft,
      stopped,
      featured,
      percentage,
      fixed,
      avgCommission,
    };
  }, [filteredAgents]);

  const statusRows = useMemo(() => {
    const rows = groupByCount(filteredAgents, (agent) => t.statusLabels[agent.status]);
    return rows.map((row) => ({
      ...row,
      percent: percent(row.value, filteredAgents.length),
    }));
  }, [filteredAgents, t.statusLabels]);

  const cityRows = useMemo(() => {
    const rows = groupByCount(filteredAgents, (agent) => agent.city || "-");
    return rows.slice(0, 8).map((row) => ({
      ...row,
      percent: percent(row.value, filteredAgents.length),
    }));
  }, [filteredAgents]);

  const commissionTypeRows = useMemo(() => {
    const rows = groupByCount(
      filteredAgents,
      (agent) => t.commissionTypeLabels[agent.defaultCommissionType],
    );

    return rows.map((row) => ({
      ...row,
      percent: percent(row.value, filteredAgents.length),
    }));
  }, [filteredAgents, t.commissionTypeLabels]);

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

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as AgentsApiResponse;
      const normalized = normalizeApiList(payload).map(normalizeAgent);

      setAgents(normalized);
      setSelectedIds([]);
      setPageIndex(0);

      if (showToast) {
        toast.success(t.refreshSuccess);
      }
    } catch (error) {
      console.error("Failed to load agents report:", error);
      setAgents([]);
      toast.error(t.apiError);
    } finally {
      setIsLoading(false);
    }
  }

  function exportExcel() {
    const now = new Date();
    const generatedAt = formatDateTime(now.toISOString(), locale);

    const rows = filteredAgents.map((agent, index) => ({
      [t.table.id]: index + 1,
      [t.table.code]: agent.agentCode,
      [t.table.name]: agent.fullName,
      [t.table.referralCode]: agent.referralCode,
      [t.table.commissionType]: t.commissionTypeLabels[agent.defaultCommissionType],
      [t.table.commissionValue]: formatCommission(agent, locale),
      [t.table.city]: agent.city || "-",
      [t.table.phone]: agent.phone || "-",
      [t.table.email]: agent.email || "-",
      [t.table.status]: t.statusLabels[agent.status],
      [t.table.featured]: agent.isFeatured
        ? isArabic
          ? "مميز"
          : "Featured"
        : isArabic
          ? "عادي"
          : "Normal",
      [t.table.bankName]: agent.bankName || "-",
      [t.table.iban]: agent.iban || "-",
      [t.table.createdAt]: formatDateTime(agent.createdAt, locale),
      [t.table.updatedAt]: formatDateTime(agent.updatedAt, locale),
    }));

    const summaryRows = [
      [t.excelSummary, ""],
      [t.generatedAt, generatedAt],
      [t.reportScope, t.currentFilteredData],
      [t.showing, `${filteredAgents.length} / ${agents.length}`],
      ["", ""],
      [t.stats.total, stats.total],
      [t.stats.active, stats.active],
      [t.stats.draft, stats.draft],
      [t.stats.stopped, stats.stopped],
      [t.stats.featured, stats.featured],
      [t.stats.percentage, stats.percentage],
      [t.stats.fixed, stats.fixed],
      [t.stats.avgCommission, stats.avgCommission.toFixed(2)],
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
      [
        t.filterFeatured,
        featuredFilter === "ALL"
          ? t.all
          : featuredFilter === "FEATURED"
            ? t.featuredOnly
            : t.normalOnly,
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
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 30 },
      { wch: 16 },
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
      isArabic ? "تقرير المندوبين" : "Agents Report",
    );

    XLSX.writeFile(
      workbook,
      `primey-care-agents-report-${now.toISOString().slice(0, 10)}.xlsx`,
    );

    toast.success(t.exportSuccess);
  }

  function printReport() {
    window.print();
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
  }, [query, statusFilter, commissionTypeFilter, featuredFilter]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 print:hidden lg:flex-row lg:items-center lg:justify-between">
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

          <Button variant="outline" className="h-10 rounded-xl" onClick={exportExcel}>
            <Download className="h-4 w-4" />
            <span>{t.export}</span>
          </Button>

          <Button className="h-10 rounded-xl" onClick={printReport}>
            <Printer className="h-4 w-4" />
            <span>{t.print}</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 print:hidden md:grid-cols-4">
        <SummaryCard
          title={t.stats.total}
          value={isLoading ? "..." : String(stats.total)}
          icon={Users}
        />
        <SummaryCard
          title={t.stats.active}
          value={isLoading ? "..." : String(stats.active)}
          icon={BadgeCheck}
        />
        <SummaryCard
          title={t.stats.featured}
          value={isLoading ? "..." : String(stats.featured)}
          icon={Star}
        />
        <SummaryCard
          title={t.stats.avgCommission}
          value={isLoading ? "..." : stats.avgCommission.toFixed(2)}
          icon={Wallet}
          sar
        />
      </div>

      {/* Report Insights */}
      <div className="grid gap-4 print:hidden lg:grid-cols-3">
        <ReportMiniTable
          title={t.byStatus}
          icon={ShieldCheck}
          rows={statusRows}
          loading={isLoading}
          loadingText={t.loading}
          noResults={t.noResults}
        />

        <ReportMiniTable
          title={t.byCommissionType}
          icon={HandCoins}
          rows={commissionTypeRows}
          loading={isLoading}
          loadingText={t.loading}
          noResults={t.noResults}
        />

        <ReportMiniTable
          title={t.byCity}
          icon={MapPin}
          rows={cityRows}
          loading={isLoading}
          loadingText={t.loading}
          noResults={t.noResults}
        />
      </div>

      {/* Printable Report Section */}
      <Card className="rounded-2xl border bg-card shadow-sm print:border-0 print:shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold">{t.tableTitle}</CardTitle>
          <CardDescription>{t.tableSubtitle}</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            {/* Filters */}
            <div className="grid gap-3 print:hidden lg:grid-cols-[1fr_auto_auto_auto_auto]">
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

              <select
                value={featuredFilter}
                onChange={(event) =>
                  setFeaturedFilter(event.target.value as FeaturedFilter)
                }
                className="border-input bg-background h-10 rounded-xl border px-3 text-sm"
              >
                <option value="ALL">
                  {t.featured}: {t.all}
                </option>
                <option value="FEATURED">{t.featuredOnly}</option>
                <option value="NORMAL">{t.normalOnly}</option>
              </select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 rounded-xl">
                    <ColumnsIcon className="h-4 w-4" />
                    <span>{t.columns}</span>
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align={isArabic ? "start" : "end"}>
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

            {/* Print Header */}
            <div className="hidden print:block">
              <h2 className="text-xl font-bold">{t.title}</h2>
              <p className="mt-2 text-sm">{t.subtitle}</p>
              <p className="mt-2 text-sm">
                {t.showing}: {filteredAgents.length} / {agents.length}
              </p>
            </div>

            {/* Data Table */}
            <div className="overflow-hidden rounded-xl border print:rounded-none">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 print:hidden">
                      <Checkbox
                        checked={allPageRowsSelected}
                        onCheckedChange={toggleAllPageRows}
                        aria-label="Select all"
                      />
                    </TableHead>

                    {visibleColumns.name ? (
                      <TableHead>
                        <Button
                          className="-ms-3 print:hidden"
                          variant="ghost"
                          onClick={() => toggleSort("fullName")}
                        >
                          {t.table.name}
                          <ArrowDownUp className="h-3 w-3" />
                        </Button>
                        <span className="hidden print:inline">{t.table.name}</span>
                      </TableHead>
                    ) : null}

                    {visibleColumns.code ? (
                      <TableHead>
                        <Button
                          className="-ms-3 print:hidden"
                          variant="ghost"
                          onClick={() => toggleSort("agentCode")}
                        >
                          {t.table.code}
                          <ArrowDownUp className="h-3 w-3" />
                        </Button>
                        <span className="hidden print:inline">{t.table.code}</span>
                      </TableHead>
                    ) : null}

                    {visibleColumns.referralCode ? (
                      <TableHead>
                        <Button
                          className="-ms-3 print:hidden"
                          variant="ghost"
                          onClick={() => toggleSort("referralCode")}
                        >
                          {t.table.referralCode}
                          <ArrowDownUp className="h-3 w-3" />
                        </Button>
                        <span className="hidden print:inline">
                          {t.table.referralCode}
                        </span>
                      </TableHead>
                    ) : null}

                    {visibleColumns.commission ? (
                      <TableHead>
                        <Button
                          className="-ms-3 print:hidden"
                          variant="ghost"
                          onClick={() => toggleSort("defaultCommissionValue")}
                        >
                          {t.table.commission}
                          <ArrowDownUp className="h-3 w-3" />
                        </Button>
                        <span className="hidden print:inline">
                          {t.table.commission}
                        </span>
                      </TableHead>
                    ) : null}

                    {visibleColumns.city ? (
                      <TableHead>
                        <Button
                          className="-ms-3 print:hidden"
                          variant="ghost"
                          onClick={() => toggleSort("city")}
                        >
                          {t.table.city}
                          <ArrowDownUp className="h-3 w-3" />
                        </Button>
                        <span className="hidden print:inline">{t.table.city}</span>
                      </TableHead>
                    ) : null}

                    {visibleColumns.contact ? (
                      <TableHead>{t.table.contact}</TableHead>
                    ) : null}

                    {visibleColumns.status ? (
                      <TableHead>
                        <Button
                          className="-ms-3 print:hidden"
                          variant="ghost"
                          onClick={() => toggleSort("status")}
                        >
                          {t.table.status}
                          <ArrowDownUp className="h-3 w-3" />
                        </Button>
                        <span className="hidden print:inline">{t.table.status}</span>
                      </TableHead>
                    ) : null}

                    {visibleColumns.featured ? (
                      <TableHead>{t.table.featured}</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-28">
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
                        <TableCell className="print:hidden">
                          <Checkbox
                            checked={selectedIds.includes(agent.id)}
                            onCheckedChange={() => toggleRow(agent.id)}
                            aria-label="Select row"
                          />
                        </TableCell>

                        {visibleColumns.name ? (
                          <TableCell>
                            <div className="flex min-w-[220px] items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted print:hidden">
                                <UserRound className="h-5 w-5" />
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="truncate font-medium">
                                    {agent.fullName}
                                  </span>

                                  {agent.isFeatured ? (
                                    <Star className="size-4 fill-orange-400 text-orange-400 print:hidden" />
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
                            <div className="flex min-w-[140px] items-center gap-2">
                              <HandCoins className="text-muted-foreground h-3.5 w-3.5 print:hidden" />
                              <span className="font-medium">
                                {formatCommission(agent, locale)}
                              </span>
                            </div>
                            <div className="mt-1 print:hidden">
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
                              <MapPin className="text-muted-foreground h-3.5 w-3.5 print:hidden" />
                              <span>{agent.city || "-"}</span>
                            </div>
                          </TableCell>
                        ) : null}

                        {visibleColumns.contact ? (
                          <TableCell>
                            <div className="flex min-w-[130px] items-center gap-2">
                              <Phone className="text-muted-foreground h-3.5 w-3.5 print:hidden" />
                              <span>{agent.phone || "-"}</span>
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
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="h-28 text-center">
                        {t.noResults}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-end">
              <div className="text-muted-foreground flex-1 text-sm">
                {selectedIds.length} / {filteredAgents.length} {t.selectedRows}
              </div>

              <div className="text-muted-foreground text-sm">
                {pageIndex + 1} / {pageCount}
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
    </div>
  );
}

/* ============================================================
   🔹 Small Components
============================================================ */

function SummaryCard({
  title,
  value,
  icon: Icon,
  sar = false,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  sar?: boolean;
}) {
  return (
    <Card className="rounded-2xl border bg-card shadow-sm">
      <CardContent className="flex items-center justify-between gap-3 p-5">
        <div>
          <p className="text-muted-foreground text-sm">{title}</p>
          <div className="mt-2 flex items-center gap-2">
            {sar ? (
              <Image
                src={SAR_ICON}
                alt="SAR"
                width={20}
                height={20}
                className="opacity-90"
              />
            ) : null}
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function ReportMiniTable({
  title,
  icon: Icon,
  rows,
  loading,
  loadingText,
  noResults,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  rows: Array<{ label: string; value: number; percent: number }>;
  loading: boolean;
  loadingText: string;
  noResults: string;
}) {
  return (
    <Card className="rounded-2xl border bg-card shadow-sm print:shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {loadingText}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {noResults}
          </div>
        ) : (
          rows.map((row) => (
            <div key={row.label} className="rounded-xl border bg-background p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{row.label}</p>
                  <p className="text-muted-foreground text-xs">
                    {row.value} سجل
                  </p>
                </div>

                <Badge variant="secondary" className="rounded-full">
                  {row.percent}%
                </Badge>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${row.percent}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}