"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarRange,
  Download,
  FileSignature,
  FileText,
  FilterIcon,
  Loader2,
  Percent,
  PieChart,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
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
   📂 app/system/contracts/reports/page.tsx
   🧾 Primey Care | Contracts Reports
   ------------------------------------------------------------
   ✅ تقارير العقود
   ✅ ربط حقيقي مع /api/contracts/reports/
   ✅ فلاتر + ملخصات + توزيع الحالات + توزيع التسعير + توزيع المراكز
   ✅ تصدير Excel منظم .xlsx فقط
   ✅ طباعة Web PDF للتقرير فقط
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ الأرقام دائمًا إنجليزية
   ✅ استخدام UI الداخلي فقط
   ✅ استخدام رمز SAR الرسمي
   ✅ بدون hardcoded localhost
============================================================ */

type AppLocale = "ar" | "en";

type ContractStatus =
  | "DRAFT"
  | "ACTIVE"
  | "EXPIRED"
  | "TERMINATED"
  | "SUSPENDED"
  | "UNKNOWN";

type PricingModel = "FIXED" | "PERCENTAGE" | "CUSTOM" | "FREE" | "UNKNOWN";

type StatusFilter = "ALL" | ContractStatus;
type PricingFilter = "ALL" | PricingModel;

type Contract = {
  id: number | string;
  contractNumber: string;
  title: string;
  providerName: string;
  providerId: number | string | null;
  pricingModel: PricingModel;
  status: ContractStatus;
  startDate: string;
  endDate: string;
  signedAt: string;
  discountPercentage: number;
  systemCommissionPercentage: number;
  productsCount: number;
  notes: string;
  termsAndConditions: string;
  createdAt: string;
  updatedAt: string;
  raw: Record<string, unknown>;
};

type ContractsReportSummary = {
  total_contracts?: number;
  active_contracts?: number;
  draft_contracts?: number;
  suspended_contracts?: number;
  expired_contracts?: number;
  terminated_contracts?: number;
  active_contract_products?: number;
};

type DistributionRow = {
  key: string;
  label: string;
  total: number;
};

type ProviderDistributionRow = {
  provider_id: number | string | null;
  provider_name: string;
  total: number;
};

type ContractsReportsApiResponse = {
  ok?: boolean;
  message?: string;
  summary?: ContractsReportSummary;
  status_distribution?: Array<{
    status?: string;
    label?: string;
    total?: number;
  }>;
  pricing_distribution?: Array<{
    pricing_model?: string;
    label?: string;
    total?: number;
  }>;
  provider_distribution?: Array<{
    provider_id?: number | string | null;
    provider_name?: string;
    total?: number;
  }>;
  latest_contracts?: unknown[];
};

type ContractsListApiResponse = {
  ok?: boolean;
  message?: string;
  results?: unknown[];
  data?: unknown[] | { results?: unknown[] };
  items?: unknown[];
  contracts?: unknown[];
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
   🔢 Formatters
============================================================ */

function formatEnglishNumber(value: number | string | null | undefined) {
  const numericValue = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
}

function formatPercent(value: number | string | null | undefined) {
  const numericValue = Number(value || 0);

  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numericValue) ? numericValue : 0)}%`;
}

function formatDate(value: string, locale: AppLocale) {
  if (!value) return locale === "ar" ? "غير محدد" : "Not set";

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsedDate);
}

function toComparableDate(value: string) {
  if (!value) return 0;

  const parsedDate = new Date(value).getTime();
  return Number.isNaN(parsedDate) ? 0 : parsedDate;
}

function daysUntil(value: string) {
  if (!value) return null;

  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/* ============================================================
   🔁 API Normalizers
============================================================ */

function normalizeApiList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === "object") {
    const data = payload as ContractsListApiResponse;

    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.contracts)) return data.contracts;
    if (Array.isArray(data.data)) return data.data;

    if (
      data.data &&
      typeof data.data === "object" &&
      Array.isArray((data.data as { results?: unknown[] }).results)
    ) {
      return (data.data as { results: unknown[] }).results;
    }
  }

  return [];
}

function normalizeStatus(value: unknown): ContractStatus {
  const status = String(value || "").toUpperCase();

  if (status === "DRAFT") return "DRAFT";
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "EXPIRED") return "EXPIRED";
  if (status === "TERMINATED") return "TERMINATED";
  if (status === "SUSPENDED") return "SUSPENDED";

  return "UNKNOWN";
}

function normalizePricingModel(value: unknown): PricingModel {
  const pricingModel = String(value || "").toUpperCase();

  if (pricingModel === "FIXED") return "FIXED";
  if (pricingModel === "PERCENTAGE") return "PERCENTAGE";
  if (pricingModel === "CUSTOM") return "CUSTOM";
  if (pricingModel === "FREE") return "FREE";

  return "UNKNOWN";
}

function readNestedName(value: unknown): string {
  if (!value || typeof value !== "object") return "";

  const obj = value as Record<string, unknown>;

  return String(
    obj.name ??
      obj.display_name ??
      obj.provider_name ??
      obj.center_name ??
      obj.company_name ??
      obj.title ??
      ""
  );
}

function normalizeContract(item: unknown): Contract {
  const obj = (item || {}) as Record<string, unknown>;
  const providerObj = obj.provider as Record<string, unknown> | undefined;

  const contractProducts = Array.isArray(obj.contract_products)
    ? obj.contract_products
    : Array.isArray(obj.products)
      ? obj.products
      : Array.isArray(obj.items)
        ? obj.items
        : [];

  return {
    id: (obj.id ?? "-") as number | string,
    contractNumber: String(
      obj.contract_number ??
        obj.contractNumber ??
        obj.number ??
        obj.code ??
        `CONT-${obj.id ?? "-"}`
    ),
    title: String(
      obj.title ??
        obj.name ??
        obj.contract_title ??
        obj.contract_name ??
        obj.contractTitle ??
        "-"
    ),
    providerName: String(
      obj.provider_name ??
        obj.center_name ??
        obj.providerName ??
        readNestedName(obj.provider) ??
        "-"
    ),
    providerId:
      (obj.provider_id as number | string | undefined) ??
      (providerObj?.id as number | string | undefined) ??
      null,
    pricingModel: normalizePricingModel(obj.pricing_model ?? obj.pricingModel),
    status: normalizeStatus(obj.status),
    startDate: String(obj.start_date ?? obj.startDate ?? ""),
    endDate: String(obj.end_date ?? obj.endDate ?? ""),
    signedAt: String(obj.signed_at ?? obj.signedAt ?? ""),
    discountPercentage: Number(
      obj.discount_percentage ?? obj.discountPercentage ?? 0
    ),
    systemCommissionPercentage: Number(
      obj.system_commission_percentage ??
        obj.systemCommissionPercentage ??
        obj.commission_rate ??
        obj.commissionRate ??
        0
    ),
    productsCount: Number(
      obj.products_count ??
        obj.contract_products_count ??
        obj.items_count ??
        contractProducts.length ??
        0
    ),
    notes: String(obj.notes ?? obj.description ?? ""),
    termsAndConditions: String(obj.terms_and_conditions ?? ""),
    createdAt: String(obj.created_at ?? obj.createdAt ?? ""),
    updatedAt: String(obj.updated_at ?? obj.updatedAt ?? ""),
    raw: obj,
  };
}

/* ============================================================
   📚 Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    pageTitle: isArabic ? "تقارير العقود" : "Contracts Reports",
    pageSubtitle: isArabic
      ? "تحليل شامل للعقود حسب الحالة، آلية التسعير، مقدمي الخدمة، نسب الخصم، ونسبة النظام."
      : "Full contracts analysis by status, pricing model, providers, discounts, and system commission.",

    back: isArabic ? "رجوع" : "Back",
    list: isArabic ? "قائمة العقود" : "Contracts List",
    createContract: isArabic ? "إنشاء عقد" : "Create Contract",
    refresh: isArabic ? "تحديث" : "Refresh",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة Web PDF" : "Print Web PDF",

    filters: isArabic ? "الفلاتر" : "Filters",
    searchPlaceholder: isArabic
      ? "ابحث برقم العقد أو الاسم أو مقدم الخدمة..."
      : "Search by contract number, title, or provider...",
    allStatuses: isArabic ? "كل الحالات" : "All Statuses",
    allPricingModels: isArabic ? "كل آليات التسعير" : "All Pricing Models",
    fromDate: isArabic ? "من تاريخ" : "From Date",
    toDate: isArabic ? "إلى تاريخ" : "To Date",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",

    totalContracts: isArabic ? "إجمالي العقود" : "Total Contracts",
    activeContracts: isArabic ? "العقود النشطة" : "Active Contracts",
    draftContracts: isArabic ? "العقود المسودة" : "Draft Contracts",
    suspendedContracts: isArabic ? "العقود الموقوفة" : "Suspended Contracts",
    expiredContracts: isArabic ? "العقود المنتهية" : "Expired Contracts",
    terminatedContracts: isArabic ? "العقود المنهاة" : "Terminated Contracts",
    expiringSoon: isArabic ? "قريبة الانتهاء" : "Expiring Soon",
    activeProducts: isArabic ? "منتجات نشطة بالعقود" : "Active Contract Products",

    avgDiscount: isArabic ? "متوسط الخصم" : "Average Discount",
    avgSystemCommission: isArabic
      ? "متوسط نسبة النظام"
      : "Average System Commission",

    statusDistribution: isArabic ? "توزيع الحالات" : "Status Distribution",
    pricingDistribution: isArabic ? "توزيع التسعير" : "Pricing Distribution",
    providerDistribution: isArabic ? "توزيع مقدمي الخدمة" : "Provider Distribution",
    latestContracts: isArabic ? "آخر العقود" : "Latest Contracts",

    contractNumber: isArabic ? "رقم العقد" : "Contract No.",
    title: isArabic ? "العقد" : "Contract",
    providerName: isArabic ? "مقدم الخدمة" : "Provider",
    pricingModel: isArabic ? "آلية التسعير" : "Pricing Model",
    status: isArabic ? "الحالة" : "Status",
    startDate: isArabic ? "تاريخ البداية" : "Start Date",
    endDate: isArabic ? "تاريخ النهاية" : "End Date",
    discountPercentage: isArabic ? "خصم العقد" : "Discount",
    systemCommissionPercentage: isArabic ? "نسبة النظام" : "System Commission",
    productsCount: isArabic ? "المنتجات" : "Products",
    total: isArabic ? "الإجمالي" : "Total",
    percentage: isArabic ? "النسبة" : "Percentage",

    active: isArabic ? "نشط" : "Active",
    draft: isArabic ? "مسودة" : "Draft",
    expired: isArabic ? "منتهي" : "Expired",
    terminated: isArabic ? "منهى" : "Terminated",
    suspended: isArabic ? "موقوف" : "Suspended",
    unknown: isArabic ? "غير معروف" : "Unknown",

    fixed: isArabic ? "سعر ثابت" : "Fixed",
    pricingPercentage: isArabic ? "نسبة" : "Percentage",
    custom: isArabic ? "مخصص" : "Custom",
    free: isArabic ? "مجاني" : "Free",

    results: isArabic ? "نتيجة" : "Results",
    noContracts: isArabic
      ? "لا توجد عقود مطابقة للفلاتر الحالية."
      : "No contracts match the current filters.",
    noData: isArabic ? "لا توجد بيانات متاحة" : "No data available",

    loading: isArabic ? "جاري تحميل تقارير العقود..." : "Loading contracts reports...",
    loadError: isArabic
      ? "تعذر تحميل تقارير العقود."
      : "Failed to load contracts reports.",
    updatedNow: isArabic ? "تم تحديث تقارير العقود" : "Contracts reports refreshed",
    excelDone: isArabic
      ? "تم تصدير تقرير العقود بنجاح"
      : "Contracts report exported successfully",
    excelError: isArabic
      ? "تعذر تصدير تقرير العقود"
      : "Failed to export contracts report",
    printError: isArabic
      ? "تعذر تجهيز الطباعة"
      : "Failed to prepare print view",
  };
}

function statusLabel(status: ContractStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<ContractStatus, string> = {
    DRAFT: t.draft,
    ACTIVE: t.active,
    EXPIRED: t.expired,
    TERMINATED: t.terminated,
    SUSPENDED: t.suspended,
    UNKNOWN: t.unknown,
  };

  return labels[status] || t.unknown;
}

function pricingModelLabel(pricingModel: PricingModel, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<PricingModel, string> = {
    FIXED: t.fixed,
    PERCENTAGE: t.pricingPercentage,
    CUSTOM: t.custom,
    FREE: t.free,
    UNKNOWN: t.unknown,
  };

  return labels[pricingModel] || t.unknown;
}

function statusBadgeClass(status: ContractStatus) {
  if (status === "ACTIVE") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "DRAFT") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }

  if (status === "EXPIRED" || status === "TERMINATED") {
    return "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }

  if (status === "SUSPENDED") {
    return "border-slate-500/25 bg-slate-500/10 text-slate-700 dark:text-slate-300";
  }

  return "border-muted bg-muted/40 text-muted-foreground";
}

/* ============================================================
   🧾 Small Components
============================================================ */

function SarIcon() {
  return (
    <Image
      src={SAR_ICON}
      alt="SAR"
      width={14}
      height={14}
      className="opacity-80"
    />
  );
}

function PercentValue({ value }: { value: number | string | null | undefined }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
      <Percent className="h-3.5 w-3.5 text-muted-foreground" />
      {formatPercent(value)}
    </span>
  );
}

/* ============================================================
   🧾 Page
============================================================ */

export default function SystemContractsReportsPage() {
  const printAreaRef = useRef<HTMLDivElement | null>(null);

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [summary, setSummary] = useState<ContractsReportSummary | null>(null);
  const [statusDistribution, setStatusDistribution] = useState<DistributionRow[]>([]);
  const [pricingDistribution, setPricingDistribution] = useState<DistributionRow[]>([]);
  const [providerDistribution, setProviderDistribution] = useState<ProviderDistributionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [pricingFilter, setPricingFilter] = useState<PricingFilter>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const isArabic = locale === "ar";
  const t = dictionary(locale);

  useEffect(() => {
    const currentLocale = readLocale();
    setLocale(currentLocale);
    applyDocumentLocale(currentLocale);

    const syncLocale = () => {
      const nextLocale = readLocale();
      setLocale(nextLocale);
      applyDocumentLocale(nextLocale);
    };

    window.addEventListener("primey-locale-changed", syncLocale);
    window.addEventListener("storage", syncLocale);

    return () => {
      window.removeEventListener("primey-locale-changed", syncLocale);
      window.removeEventListener("storage", syncLocale);
    };
  }, []);

  function buildReportQuery() {
    const params = new URLSearchParams();

    params.set("latest_limit", "50");

    if (searchTerm.trim()) params.set("q", searchTerm.trim());
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (pricingFilter !== "ALL") params.set("pricing_model", pricingFilter);

    return params.toString();
  }

  async function loadReports(options?: { silent?: boolean }) {
    try {
      if (options?.silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const query = buildReportQuery();
      const response = await fetch(`/api/contracts/reports/?${query}`, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const payload = (await response.json().catch(() => null)) as
        | ContractsReportsApiResponse
        | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message || "Failed to load contracts reports.");
      }

      const latestContracts = (payload?.latest_contracts || []).map(normalizeContract);

      setSummary(payload?.summary || null);
      setContracts(latestContracts);

      setStatusDistribution(
        (payload?.status_distribution || []).map((item) => ({
          key: String(item.status || "UNKNOWN"),
          label: String(item.label || item.status || "UNKNOWN"),
          total: Number(item.total || 0),
        }))
      );

      setPricingDistribution(
        (payload?.pricing_distribution || []).map((item) => ({
          key: String(item.pricing_model || "UNKNOWN"),
          label: String(item.label || item.pricing_model || "UNKNOWN"),
          total: Number(item.total || 0),
        }))
      );

      setProviderDistribution(
        (payload?.provider_distribution || []).map((item) => ({
          provider_id: item.provider_id ?? null,
          provider_name: String(item.provider_name || "-"),
          total: Number(item.total || 0),
        }))
      );

      if (options?.silent) {
        toast.success(t.updatedNow);
      }
    } catch (error) {
      console.error("Load contracts reports error:", error);
      toast.error(t.loadError);
      setContracts([]);
      setSummary(null);
      setStatusDistribution([]);
      setPricingDistribution([]);
      setProviderDistribution([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredContracts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return contracts.filter((contract) => {
      const matchesSearch =
        !query ||
        contract.contractNumber.toLowerCase().includes(query) ||
        contract.title.toLowerCase().includes(query) ||
        contract.providerName.toLowerCase().includes(query) ||
        contract.notes.toLowerCase().includes(query) ||
        contract.termsAndConditions.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "ALL" || contract.status === statusFilter;

      const matchesPricing =
        pricingFilter === "ALL" || contract.pricingModel === pricingFilter;

      const start = toComparableDate(contract.startDate);
      const end = toComparableDate(contract.endDate);
      const from = dateFrom ? toComparableDate(dateFrom) : 0;
      const to = dateTo ? toComparableDate(dateTo) : 0;

      const matchesDateFrom = !dateFrom || start >= from || end >= from;
      const matchesDateTo = !dateTo || start <= to || end <= to;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPricing &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [contracts, searchTerm, statusFilter, pricingFilter, dateFrom, dateTo]);

  const computedStats = useMemo(() => {
    const total = filteredContracts.length;
    const active = filteredContracts.filter((item) => item.status === "ACTIVE").length;

    const expiringSoon = filteredContracts.filter((item) => {
      const days = daysUntil(item.endDate);
      return days !== null && days >= 0 && days <= 30;
    }).length;

    const totalDiscount = filteredContracts.reduce(
      (sum, item) => sum + Number(item.discountPercentage || 0),
      0
    );

    const totalCommission = filteredContracts.reduce(
      (sum, item) => sum + Number(item.systemCommissionPercentage || 0),
      0
    );

    return {
      total,
      active,
      expiringSoon,
      avgDiscount: total > 0 ? totalDiscount / total : 0,
      avgSystemCommission: total > 0 ? totalCommission / total : 0,
    };
  }, [filteredContracts]);

  const reportSummary = {
    totalContracts: summary?.total_contracts ?? computedStats.total,
    activeContracts: summary?.active_contracts ?? computedStats.active,
    draftContracts: summary?.draft_contracts ?? 0,
    suspendedContracts: summary?.suspended_contracts ?? 0,
    expiredContracts: summary?.expired_contracts ?? 0,
    terminatedContracts: summary?.terminated_contracts ?? 0,
    activeProducts: summary?.active_contract_products ?? 0,
    expiringSoon: computedStats.expiringSoon,
    avgDiscount: computedStats.avgDiscount,
    avgSystemCommission: computedStats.avgSystemCommission,
  };

  const localStatusDistribution = useMemo(() => {
    if (statusDistribution.length > 0) return statusDistribution;

    const statuses: ContractStatus[] = [
      "ACTIVE",
      "DRAFT",
      "SUSPENDED",
      "EXPIRED",
      "TERMINATED",
    ];

    return statuses
      .map((status) => ({
        key: status,
        label: statusLabel(status, locale),
        total: filteredContracts.filter((item) => item.status === status).length,
      }))
      .filter((item) => item.total > 0);
  }, [filteredContracts, locale, statusDistribution]);

  const localPricingDistribution = useMemo(() => {
    if (pricingDistribution.length > 0) return pricingDistribution;

    const pricingModels: PricingModel[] = ["CUSTOM", "PERCENTAGE", "FIXED", "FREE"];

    return pricingModels
      .map((pricingModel) => ({
        key: pricingModel,
        label: pricingModelLabel(pricingModel, locale),
        total: filteredContracts.filter((item) => item.pricingModel === pricingModel).length,
      }))
      .filter((item) => item.total > 0);
  }, [filteredContracts, locale, pricingDistribution]);

  const localProviderDistribution = useMemo(() => {
    if (providerDistribution.length > 0) return providerDistribution;

    const map = new Map<string, ProviderDistributionRow>();

    filteredContracts.forEach((contract) => {
      const key = String(contract.providerId || contract.providerName || "-");
      const current = map.get(key);

      if (current) {
        current.total += 1;
      } else {
        map.set(key, {
          provider_id: contract.providerId,
          provider_name: contract.providerName,
          total: 1,
        });
      }
    });

    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filteredContracts, providerDistribution]);

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("ALL");
    setPricingFilter("ALL");
    setDateFrom("");
    setDateTo("");
  }

  function buildExcelRows() {
    return filteredContracts.map((contract) => ({
      [t.contractNumber]: contract.contractNumber,
      [t.title]: contract.title,
      [t.providerName]: contract.providerName,
      [t.pricingModel]: pricingModelLabel(contract.pricingModel, locale),
      [t.status]: statusLabel(contract.status, locale),
      [t.startDate]: formatDate(contract.startDate, locale),
      [t.endDate]: formatDate(contract.endDate, locale),
      [t.discountPercentage]: formatPercent(contract.discountPercentage),
      [t.systemCommissionPercentage]: formatPercent(
        contract.systemCommissionPercentage
      ),
      [t.productsCount]: formatEnglishNumber(contract.productsCount),
    }));
  }

  function handleExportExcel() {
    try {
      const summaryRows = [
        [t.pageTitle],
        [t.totalContracts, formatEnglishNumber(reportSummary.totalContracts)],
        [t.activeContracts, formatEnglishNumber(reportSummary.activeContracts)],
        [t.draftContracts, formatEnglishNumber(reportSummary.draftContracts)],
        [t.suspendedContracts, formatEnglishNumber(reportSummary.suspendedContracts)],
        [t.expiredContracts, formatEnglishNumber(reportSummary.expiredContracts)],
        [t.terminatedContracts, formatEnglishNumber(reportSummary.terminatedContracts)],
        [t.activeProducts, formatEnglishNumber(reportSummary.activeProducts)],
        [t.expiringSoon, formatEnglishNumber(reportSummary.expiringSoon)],
        [t.avgDiscount, formatPercent(reportSummary.avgDiscount)],
        [t.avgSystemCommission, formatPercent(reportSummary.avgSystemCommission)],
        [],
        [t.latestContracts],
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.sheet_add_json(worksheet, buildExcelRows(), {
        origin: "A14",
        skipHeader: false,
      });

      worksheet["!cols"] = [
        { wch: 18 },
        { wch: 28 },
        { wch: 26 },
        { wch: 18 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 20 },
        { wch: 18 },
      ];

      worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        isArabic ? "تقارير العقود" : "Contracts Reports"
      );

      XLSX.writeFile(workbook, "primey-care-contracts-reports.xlsx");
      toast.success(t.excelDone);
    } catch (error) {
      console.error("Export contracts report error:", error);
      toast.error(t.excelError);
    }
  }

  function handlePrint() {
    try {
      const printContent = printAreaRef.current?.innerHTML;

      if (!printContent) {
        toast.error(t.printError);
        return;
      }

      const printWindow = window.open("", "_blank", "width=1200,height=800");

      if (!printWindow) {
        toast.error(t.printError);
        return;
      }

      printWindow.document.write(`
        <!doctype html>
        <html lang="${locale}" dir="${isArabic ? "rtl" : "ltr"}">
          <head>
            <meta charset="utf-8" />
            <title>${t.pageTitle}</title>
            <style>
              * { box-sizing: border-box; }

              body {
                font-family: Arial, sans-serif;
                padding: 24px;
                color: #111827;
                background: #ffffff;
              }

              .print-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                margin-bottom: 24px;
                padding-bottom: 16px;
                border-bottom: 1px solid #e5e7eb;
              }

              .print-title {
                margin: 0;
                font-size: 22px;
                font-weight: 800;
              }

              .print-subtitle {
                margin: 6px 0 0;
                color: #6b7280;
                font-size: 13px;
              }

              .print-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 12px;
                margin-bottom: 20px;
              }

              .print-card {
                border: 1px solid #e5e7eb;
                border-radius: 14px;
                padding: 12px;
              }

              .print-card-label {
                color: #6b7280;
                font-size: 12px;
                margin-bottom: 6px;
              }

              .print-card-value {
                font-size: 18px;
                font-weight: 800;
              }

              table {
                width: 100%;
                border-collapse: collapse;
                font-size: 12px;
              }

              th, td {
                border: 1px solid #e5e7eb;
                padding: 10px;
                text-align: ${isArabic ? "right" : "left"};
                vertical-align: top;
              }

              th {
                background: #f9fafb;
                font-weight: 800;
              }

              button, input, select, svg {
                display: none !important;
              }

              .rounded-full {
                border: 1px solid #e5e7eb;
                border-radius: 999px;
                padding: 3px 8px;
                font-size: 11px;
                font-weight: 700;
              }

              @media print {
                body { padding: 0; }
              }
            </style>
          </head>
          <body>
            <div class="print-header">
              <div>
                <h1 class="print-title">${t.pageTitle}</h1>
                <p class="print-subtitle">${t.pageSubtitle}</p>
              </div>
              <div>${new Date().toLocaleDateString("en-GB")}</div>
            </div>

            ${printContent}
          </body>
        </html>
      `);

      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } catch (error) {
      console.error("Print contracts report error:", error);
      toast.error(t.printError);
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/80 p-6 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-sky-500/10" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link href="/system/contracts">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full bg-white/70 dark:bg-white/5"
                  >
                    <ArrowLeft className="me-2 h-4 w-4" />
                    {t.back}
                  </Button>
                </Link>

                <Badge className="rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                  <BarChart3 className="me-1 h-3.5 w-3.5" />
                  {isArabic ? "تقرير العقود" : "Contracts Report"}
                </Badge>

                <Badge
                  variant="outline"
                  className="rounded-full bg-white/60 dark:bg-white/5"
                >
                  <ShieldCheck className="me-1 h-3.5 w-3.5" />
                  {isArabic ? "API رسمي" : "Official API"}
                </Badge>
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {t.pageTitle}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
                  {t.pageSubtitle}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="rounded-2xl bg-white/70 dark:bg-white/5"
                onClick={() => loadReports({ silent: true })}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="me-2 h-4 w-4" />
                )}
                {t.refresh}
              </Button>

              <Button
                variant="outline"
                className="rounded-2xl bg-white/70 dark:bg-white/5"
                onClick={handleExportExcel}
              >
                <Download className="me-2 h-4 w-4" />
                {t.exportExcel}
              </Button>

              <Button
                variant="outline"
                className="rounded-2xl bg-white/70 dark:bg-white/5"
                onClick={handlePrint}
              >
                <Printer className="me-2 h-4 w-4" />
                {t.print}
              </Button>

              <Link href="/system/contracts/list">
                <Button className="rounded-2xl shadow-lg">
                  <FileSignature className="me-2 h-4 w-4" />
                  {t.list}
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FilterIcon className="h-5 w-5 text-primary" />
                  {t.filters}
                </CardTitle>
                <CardDescription>
                  {formatEnglishNumber(filteredContracts.length)} {t.results}
                </CardDescription>
              </div>

              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={clearFilters}
              >
                {t.clearFilters}
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.8fr]">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="rounded-2xl bg-white/80 ps-9 dark:bg-white/5"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                className="h-10 rounded-2xl border border-input bg-white/80 px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring dark:bg-white/5"
              >
                <option value="ALL">{t.allStatuses}</option>
                <option value="ACTIVE">{t.active}</option>
                <option value="DRAFT">{t.draft}</option>
                <option value="SUSPENDED">{t.suspended}</option>
                <option value="EXPIRED">{t.expired}</option>
                <option value="TERMINATED">{t.terminated}</option>
              </select>

              <select
                value={pricingFilter}
                onChange={(event) =>
                  setPricingFilter(event.target.value as PricingFilter)
                }
                className="h-10 rounded-2xl border border-input bg-white/80 px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring dark:bg-white/5"
              >
                <option value="ALL">{t.allPricingModels}</option>
                <option value="CUSTOM">{t.custom}</option>
                <option value="PERCENTAGE">{t.pricingPercentage}</option>
                <option value="FIXED">{t.fixed}</option>
                <option value="FREE">{t.free}</option>
              </select>

              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="rounded-2xl bg-white/80 dark:bg-white/5"
                aria-label={t.fromDate}
              />

              <Input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="rounded-2xl bg-white/80 dark:bg-white/5"
                aria-label={t.toDate}
              />
            </div>
          </CardContent>
        </Card>

        <div ref={printAreaRef} className="space-y-6">
          {/* Print Summary */}
          <div className="print-grid hidden">
            <div className="print-card">
              <div className="print-card-label">{t.totalContracts}</div>
              <div className="print-card-value">
                {formatEnglishNumber(reportSummary.totalContracts)}
              </div>
            </div>
            <div className="print-card">
              <div className="print-card-label">{t.activeContracts}</div>
              <div className="print-card-value">
                {formatEnglishNumber(reportSummary.activeContracts)}
              </div>
            </div>
            <div className="print-card">
              <div className="print-card-label">{t.expiringSoon}</div>
              <div className="print-card-value">
                {formatEnglishNumber(reportSummary.expiringSoon)}
              </div>
            </div>
            <div className="print-card">
              <div className="print-card-label">{t.avgSystemCommission}</div>
              <div className="print-card-value">
                {formatPercent(reportSummary.avgSystemCommission)}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t.totalContracts}
                    </p>
                    <p className="mt-2 text-3xl font-bold tabular-nums">
                      {formatEnglishNumber(reportSummary.totalContracts)}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t.activeContracts}
                    </p>
                    <p className="mt-2 text-3xl font-bold tabular-nums">
                      {formatEnglishNumber(reportSummary.activeContracts)}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                    <BadgeCheck className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t.activeProducts}
                    </p>
                    <p className="mt-2 text-3xl font-bold tabular-nums">
                      {formatEnglishNumber(reportSummary.activeProducts)}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-300">
                    <Sparkles className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t.avgSystemCommission}
                    </p>
                    <p className="mt-2 text-3xl font-bold tabular-nums">
                      {formatPercent(reportSummary.avgSystemCommission)}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-300">
                    <Wallet className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Distributions */}
          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-primary" />
                  {t.statusDistribution}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                {isLoading ? (
                  <div className="flex min-h-32 items-center justify-center text-muted-foreground">
                    <Loader2 className="me-2 h-5 w-5 animate-spin" />
                    {t.loading}
                  </div>
                ) : localStatusDistribution.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    {t.noData}
                  </div>
                ) : (
                  localStatusDistribution.map((item) => {
                    const percentage =
                      reportSummary.totalContracts > 0
                        ? (item.total / reportSummary.totalContracts) * 100
                        : 0;

                    return (
                      <div key={item.key} className="space-y-2">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <Badge
                            variant="outline"
                            className={`rounded-full ${statusBadgeClass(
                              normalizeStatus(item.key)
                            )}`}
                          >
                            {statusLabel(normalizeStatus(item.key), locale)}
                          </Badge>

                          <span className="font-semibold tabular-nums">
                            {formatEnglishNumber(item.total)}
                          </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  {t.pricingDistribution}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                {localPricingDistribution.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    {t.noData}
                  </div>
                ) : (
                  localPricingDistribution.map((item) => {
                    const percentage =
                      reportSummary.totalContracts > 0
                        ? (item.total / reportSummary.totalContracts) * 100
                        : 0;

                    return (
                      <div key={item.key} className="space-y-2">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium">
                            {pricingModelLabel(
                              normalizePricingModel(item.key),
                              locale
                            )}
                          </span>

                          <span className="font-semibold tabular-nums">
                            {formatEnglishNumber(item.total)}
                          </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  {t.providerDistribution}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {localProviderDistribution.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    {t.noData}
                  </div>
                ) : (
                  localProviderDistribution.slice(0, 8).map((item) => (
                    <div
                      key={`${item.provider_id}-${item.provider_name}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/20 bg-white/70 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/5"
                    >
                      <span className="truncate font-medium">
                        {item.provider_name || "-"}
                      </span>
                      <span className="font-bold tabular-nums">
                        {formatEnglishNumber(item.total)}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Latest Contracts */}
          <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileSignature className="h-5 w-5 text-primary" />
                    {t.latestContracts}
                  </CardTitle>
                  <CardDescription>
                    {formatEnglishNumber(filteredContracts.length)} {t.results}
                  </CardDescription>
                </div>

                <Link href="/system/contracts/create">
                  <Button className="rounded-2xl">
                    {t.createContract}
                  </Button>
                </Link>
              </div>
            </CardHeader>

            <CardContent>
              <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/70 dark:border-white/10 dark:bg-white/5">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.contractNumber}</TableHead>
                      <TableHead>{t.title}</TableHead>
                      <TableHead>{t.providerName}</TableHead>
                      <TableHead>{t.pricingModel}</TableHead>
                      <TableHead>{t.status}</TableHead>
                      <TableHead>{t.endDate}</TableHead>
                      <TableHead>{t.discountPercentage}</TableHead>
                      <TableHead>{t.systemCommissionPercentage}</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={8}>
                          <div className="flex min-h-40 items-center justify-center text-muted-foreground">
                            <Loader2 className="me-2 h-5 w-5 animate-spin" />
                            {t.loading}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredContracts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8}>
                          <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                            <FileSignature className="h-10 w-10 opacity-60" />
                            <p>{t.noContracts}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredContracts.slice(0, 20).map((contract) => (
                        <TableRow key={contract.id}>
                          <TableCell className="font-semibold tabular-nums">
                            <Link
                              href={`/system/contracts/${contract.id}`}
                              className="hover:text-primary"
                            >
                              {contract.contractNumber}
                            </Link>
                          </TableCell>

                          <TableCell>
                            <div className="max-w-64 truncate font-medium">
                              {contract.title}
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex max-w-52 items-center gap-2 truncate">
                              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="truncate">
                                {contract.providerName}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge
                              variant="outline"
                              className="rounded-full bg-white/70 dark:bg-white/5"
                            >
                              {pricingModelLabel(contract.pricingModel, locale)}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`rounded-full ${statusBadgeClass(
                                contract.status
                              )}`}
                            >
                              {statusLabel(contract.status, locale)}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2 text-sm">
                              <CalendarRange className="h-4 w-4 text-muted-foreground" />
                              {formatDate(contract.endDate, locale)}
                            </div>
                          </TableCell>

                          <TableCell>
                            <PercentValue value={contract.discountPercentage} />
                          </TableCell>

                          <TableCell>
                            <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
                              <SarIcon />
                              {formatPercent(contract.systemCommissionPercentage)}
                            </span>
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
      </div>
    </div>
  );
}