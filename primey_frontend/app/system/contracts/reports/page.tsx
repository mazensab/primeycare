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
   ✅ تقارير العقود بنفس نمط المراكز / العملاء / المندوبين / المنتجات
   ✅ ربط حقيقي مع /api/contracts/
   ✅ فلاتر + ملخصات + توزيع الحالات + توزيع مقدمي الخدمة
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
  | "ACTIVE"
  | "INACTIVE"
  | "DRAFT"
  | "PENDING"
  | "EXPIRED"
  | "TERMINATED"
  | "CANCELLED"
  | "SUSPENDED"
  | "UNKNOWN";

type ContractType =
  | "GENERAL"
  | "MEDICAL"
  | "SERVICE"
  | "PARTNERSHIP"
  | "DISCOUNT"
  | "SUPPLY"
  | "OTHER"
  | "UNKNOWN";

type StatusFilter = "ALL" | ContractStatus;
type TypeFilter = "ALL" | ContractType;

type Contract = {
  id: number | string;
  contractNumber: string;
  title: string;
  providerName: string;
  providerId: number | string | null;
  contractType: ContractType;
  status: ContractStatus;
  startDate: string;
  endDate: string;
  contractValue: number;
  commissionRate: number;
  currency: string;
  productsCount: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
  raw: Record<string, unknown>;
};

type ContractsApiResponse = {
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

function formatEnglishMoney(value: number | string | null | undefined) {
  const numericValue = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
    const data = payload as ContractsApiResponse;

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

  if (status === "ACTIVE") return "ACTIVE";
  if (status === "INACTIVE") return "INACTIVE";
  if (status === "DRAFT") return "DRAFT";
  if (status === "PENDING") return "PENDING";
  if (status === "EXPIRED") return "EXPIRED";
  if (status === "TERMINATED") return "TERMINATED";
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "SUSPENDED") return "SUSPENDED";

  if (value === true) return "ACTIVE";
  if (value === false) return "INACTIVE";

  return "UNKNOWN";
}

function normalizeContractType(value: unknown): ContractType {
  const contractType = String(value || "").toUpperCase();

  if (contractType === "GENERAL") return "GENERAL";
  if (contractType === "MEDICAL") return "MEDICAL";
  if (contractType === "SERVICE") return "SERVICE";
  if (contractType === "PARTNERSHIP") return "PARTNERSHIP";
  if (contractType === "DISCOUNT") return "DISCOUNT";
  if (contractType === "SUPPLY") return "SUPPLY";
  if (contractType === "OTHER") return "OTHER";

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
    contractType: normalizeContractType(
      obj.contract_type ?? obj.contractType ?? obj.type
    ),
    status: normalizeStatus(obj.status ?? obj.is_active),
    startDate: String(obj.start_date ?? obj.startDate ?? ""),
    endDate: String(obj.end_date ?? obj.endDate ?? ""),
    contractValue: Number(
      obj.contract_value ??
        obj.contractValue ??
        obj.total_value ??
        obj.value ??
        obj.amount ??
        0
    ),
    commissionRate: Number(
      obj.commission_rate ?? obj.commissionRate ?? obj.rate ?? 0
    ),
    currency: String(obj.currency ?? "SAR"),
    productsCount: Number(
      obj.products_count ??
        obj.contract_products_count ??
        obj.items_count ??
        contractProducts.length ??
        0
    ),
    notes: String(obj.notes ?? obj.description ?? ""),
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
      ? "تحليل شامل للعقود حسب الحالة، النوع، مقدم الخدمة، القيمة، وتواريخ الانتهاء."
      : "Comprehensive analysis of contracts by status, type, provider, value, and expiry dates.",

    back: isArabic ? "رجوع" : "Back",
    list: isArabic ? "قائمة العقود" : "Contracts List",
    create: isArabic ? "إنشاء عقد" : "Create Contract",
    refresh: isArabic ? "تحديث" : "Refresh",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة Web PDF" : "Print Web PDF",

    filters: isArabic ? "الفلاتر" : "Filters",
    searchPlaceholder: isArabic
      ? "ابحث برقم العقد أو اسم العقد أو مقدم الخدمة..."
      : "Search by contract number, title, or provider...",
    allStatuses: isArabic ? "كل الحالات" : "All Statuses",
    allTypes: isArabic ? "كل الأنواع" : "All Types",
    fromDate: isArabic ? "من تاريخ" : "From Date",
    toDate: isArabic ? "إلى تاريخ" : "To Date",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",

    totalContracts: isArabic ? "إجمالي العقود" : "Total Contracts",
    activeContracts: isArabic ? "العقود النشطة" : "Active Contracts",
    expiringSoon: isArabic ? "قريبة الانتهاء" : "Expiring Soon",
    expiredContracts: isArabic ? "العقود المنتهية" : "Expired Contracts",
    totalValue: isArabic ? "إجمالي القيمة" : "Total Value",
    avgValue: isArabic ? "متوسط قيمة العقد" : "Average Contract Value",
    estimatedCommission: isArabic ? "العمولة التقديرية" : "Estimated Commission",

    statusDistribution: isArabic ? "توزيع الحالات" : "Status Distribution",
    statusDistributionDesc: isArabic
      ? "تحليل العقود حسب الحالة التشغيلية."
      : "Contracts analysis by operational status.",

    typeDistribution: isArabic ? "توزيع الأنواع" : "Type Distribution",
    typeDistributionDesc: isArabic
      ? "تحليل العقود حسب نوع العقد."
      : "Contracts analysis by contract type.",

    providerDistribution: isArabic ? "أعلى مقدمي الخدمة" : "Top Providers",
    providerDistributionDesc: isArabic
      ? "مقدمو الخدمة الأكثر ارتباطًا بالعقود."
      : "Providers with the highest number of contracts.",

    expiringReport: isArabic ? "العقود القريبة من الانتهاء" : "Expiring Contracts",
    expiringReportDesc: isArabic
      ? "العقود التي تنتهي خلال 30 يوم."
      : "Contracts ending within 30 days.",

    detailedReport: isArabic ? "التقرير التفصيلي" : "Detailed Report",
    detailedReportDesc: isArabic
      ? "جدول تفصيلي للعقود حسب الفلاتر الحالية."
      : "Detailed contracts table based on current filters.",

    contractNumber: isArabic ? "رقم العقد" : "Contract No.",
    title: isArabic ? "العقد" : "Contract",
    providerName: isArabic ? "مقدم الخدمة" : "Provider",
    contractType: isArabic ? "النوع" : "Type",
    status: isArabic ? "الحالة" : "Status",
    startDate: isArabic ? "تاريخ البداية" : "Start Date",
    endDate: isArabic ? "تاريخ النهاية" : "End Date",
    daysLeft: isArabic ? "الأيام المتبقية" : "Days Left",
    contractValue: isArabic ? "القيمة" : "Value",
    commissionRate: isArabic ? "العمولة" : "Commission",
    productsCount: isArabic ? "الخدمات/المنتجات" : "Products/Services",
    results: isArabic ? "نتيجة" : "Results",

    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
    draft: isArabic ? "مسودة" : "Draft",
    pending: isArabic ? "معلق" : "Pending",
    expired: isArabic ? "منتهي" : "Expired",
    terminated: isArabic ? "منهى" : "Terminated",
    cancelled: isArabic ? "ملغي" : "Cancelled",
    suspended: isArabic ? "موقوف" : "Suspended",
    unknown: isArabic ? "غير معروف" : "Unknown",

    general: isArabic ? "عام" : "General",
    medical: isArabic ? "طبي" : "Medical",
    service: isArabic ? "خدمة" : "Service",
    partnership: isArabic ? "شراكة" : "Partnership",
    discount: isArabic ? "خصومات" : "Discount",
    supply: isArabic ? "توريد" : "Supply",
    other: isArabic ? "أخرى" : "Other",

    loading: isArabic ? "جاري تحميل تقارير العقود..." : "Loading contracts reports...",
    noData: isArabic ? "لا توجد بيانات مطابقة." : "No matching data found.",
    loadError: isArabic
      ? "تعذر تحميل بيانات العقود."
      : "Failed to load contracts data.",
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

    days: isArabic ? "يوم" : "days",
    expiredSince: isArabic ? "منتهي منذ" : "Expired since",
    notSet: isArabic ? "غير محدد" : "Not set",
  };
}

function statusLabel(status: ContractStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<ContractStatus, string> = {
    ACTIVE: t.active,
    INACTIVE: t.inactive,
    DRAFT: t.draft,
    PENDING: t.pending,
    EXPIRED: t.expired,
    TERMINATED: t.terminated,
    CANCELLED: t.cancelled,
    SUSPENDED: t.suspended,
    UNKNOWN: t.unknown,
  };

  return labels[status] || t.unknown;
}

function typeLabel(type: ContractType, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<ContractType, string> = {
    GENERAL: t.general,
    MEDICAL: t.medical,
    SERVICE: t.service,
    PARTNERSHIP: t.partnership,
    DISCOUNT: t.discount,
    SUPPLY: t.supply,
    OTHER: t.other,
    UNKNOWN: t.unknown,
  };

  return labels[type] || t.unknown;
}

function statusBadgeClass(status: ContractStatus) {
  if (status === "ACTIVE") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "DRAFT" || status === "PENDING") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }

  if (status === "EXPIRED" || status === "TERMINATED" || status === "CANCELLED") {
    return "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }

  if (status === "SUSPENDED" || status === "INACTIVE") {
    return "border-slate-500/25 bg-slate-500/10 text-slate-700 dark:text-slate-300";
  }

  return "border-muted bg-muted/40 text-muted-foreground";
}

/* ============================================================
   🧾 Small Components
============================================================ */

function SarAmount({ amount }: { amount: number | string }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
      <Image
        src={SAR_ICON}
        alt="SAR"
        width={14}
        height={14}
        className="opacity-80"
      />
      {formatEnglishMoney(amount)}
    </span>
  );
}

function metricProgress(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (value / total) * 100));
}

function remainingLabel(value: string, locale: AppLocale) {
  const t = dictionary(locale);
  const days = daysUntil(value);

  if (days === null) return t.notSet;

  if (days >= 0) {
    return `${formatEnglishNumber(days)} ${t.days}`;
  }

  return `${t.expiredSince} ${formatEnglishNumber(Math.abs(days))} ${t.days}`;
}

/* ============================================================
   🧾 Page
============================================================ */

export default function SystemContractsReportsPage() {
  const printAreaRef = useRef<HTMLDivElement | null>(null);

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
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

  async function loadContracts(options?: { silent?: boolean }) {
    try {
      if (options?.silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const response = await fetch("/api/contracts/?page_size=500", {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load contracts.");
      }

      const items = normalizeApiList(payload).map(normalizeContract);
      setContracts(items);

      if (options?.silent) {
        toast.success(t.updatedNow);
      }
    } catch (error) {
      console.error("Load contracts reports error:", error);
      toast.error(t.loadError);
      setContracts([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadContracts();
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
        contract.notes.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "ALL" || contract.status === statusFilter;

      const matchesType =
        typeFilter === "ALL" || contract.contractType === typeFilter;

      const start = toComparableDate(contract.startDate);
      const end = toComparableDate(contract.endDate);
      const from = dateFrom ? toComparableDate(dateFrom) : 0;
      const to = dateTo ? toComparableDate(dateTo) : 0;

      const matchesDateFrom = !dateFrom || start >= from || end >= from;
      const matchesDateTo = !dateTo || start <= to || end <= to;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [contracts, searchTerm, statusFilter, typeFilter, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const total = filteredContracts.length;
    const active = filteredContracts.filter((item) => item.status === "ACTIVE").length;

    const expiringSoon = filteredContracts.filter((item) => {
      const days = daysUntil(item.endDate);
      return days !== null && days >= 0 && days <= 30;
    }).length;

    const expired = filteredContracts.filter((item) => {
      const days = daysUntil(item.endDate);
      return item.status === "EXPIRED" || (days !== null && days < 0);
    }).length;

    const totalValue = filteredContracts.reduce(
      (sum, item) => sum + Number(item.contractValue || 0),
      0
    );

    const estimatedCommission = filteredContracts.reduce((sum, item) => {
      const amount = Number(item.contractValue || 0);
      const rate = Number(item.commissionRate || 0);
      return sum + (amount * rate) / 100;
    }, 0);

    const avgValue = total > 0 ? totalValue / total : 0;

    return {
      total,
      active,
      expiringSoon,
      expired,
      totalValue,
      avgValue,
      estimatedCommission,
    };
  }, [filteredContracts]);

  const statusRows = useMemo(() => {
    const statuses: ContractStatus[] = [
      "ACTIVE",
      "DRAFT",
      "PENDING",
      "EXPIRED",
      "INACTIVE",
      "SUSPENDED",
      "TERMINATED",
      "CANCELLED",
      "UNKNOWN",
    ];

    return statuses
      .map((status) => {
        const rows = filteredContracts.filter((item) => item.status === status);
        const value = rows.reduce((sum, item) => sum + item.contractValue, 0);

        return {
          status,
          count: rows.length,
          value,
          percentage: metricProgress(rows.length, stats.total),
        };
      })
      .filter((item) => item.count > 0);
  }, [filteredContracts, stats.total]);

  const typeRows = useMemo(() => {
    const types: ContractType[] = [
      "GENERAL",
      "MEDICAL",
      "SERVICE",
      "PARTNERSHIP",
      "DISCOUNT",
      "SUPPLY",
      "OTHER",
      "UNKNOWN",
    ];

    return types
      .map((type) => {
        const rows = filteredContracts.filter((item) => item.contractType === type);
        const value = rows.reduce((sum, item) => sum + item.contractValue, 0);

        return {
          type,
          count: rows.length,
          value,
          percentage: metricProgress(rows.length, stats.total),
        };
      })
      .filter((item) => item.count > 0);
  }, [filteredContracts, stats.total]);

  const providerRows = useMemo(() => {
    const providersMap = new Map<
      string,
      {
        providerName: string;
        count: number;
        value: number;
        activeCount: number;
      }
    >();

    filteredContracts.forEach((contract) => {
      const key = contract.providerName || "-";

      const current =
        providersMap.get(key) ||
        {
          providerName: key,
          count: 0,
          value: 0,
          activeCount: 0,
        };

      current.count += 1;
      current.value += Number(contract.contractValue || 0);

      if (contract.status === "ACTIVE") {
        current.activeCount += 1;
      }

      providersMap.set(key, current);
    });

    return Array.from(providersMap.values())
      .sort((a, b) => b.count - a.count || b.value - a.value)
      .slice(0, 8);
  }, [filteredContracts]);

  const expiringContracts = useMemo(() => {
    return filteredContracts
      .filter((item) => {
        const days = daysUntil(item.endDate);
        return days !== null && days >= 0 && days <= 30;
      })
      .sort((a, b) => toComparableDate(a.endDate) - toComparableDate(b.endDate))
      .slice(0, 8);
  }, [filteredContracts]);

  const reportRows = useMemo(() => {
    return [...filteredContracts].sort((a, b) => {
      const first = toComparableDate(a.endDate);
      const second = toComparableDate(b.endDate);

      return first - second;
    });
  }, [filteredContracts]);

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("ALL");
    setTypeFilter("ALL");
    setDateFrom("");
    setDateTo("");
  }

  function buildExcelRows(source: Contract[]) {
    return source.map((contract) => ({
      [t.contractNumber]: contract.contractNumber,
      [t.title]: contract.title,
      [t.providerName]: contract.providerName,
      [t.contractType]: typeLabel(contract.contractType, locale),
      [t.status]: statusLabel(contract.status, locale),
      [t.startDate]: formatDate(contract.startDate, locale),
      [t.endDate]: formatDate(contract.endDate, locale),
      [t.daysLeft]: remainingLabel(contract.endDate, locale),
      [t.contractValue]: formatEnglishMoney(contract.contractValue),
      [t.commissionRate]: formatPercent(contract.commissionRate),
      [t.productsCount]: formatEnglishNumber(contract.productsCount),
    }));
  }

  function handleExportExcel() {
    try {
      const summaryRows = [
        [t.pageTitle],
        [t.totalContracts, formatEnglishNumber(stats.total)],
        [t.activeContracts, formatEnglishNumber(stats.active)],
        [t.expiringSoon, formatEnglishNumber(stats.expiringSoon)],
        [t.expiredContracts, formatEnglishNumber(stats.expired)],
        [t.totalValue, formatEnglishMoney(stats.totalValue), "SAR"],
        [t.avgValue, formatEnglishMoney(stats.avgValue), "SAR"],
        [t.estimatedCommission, formatEnglishMoney(stats.estimatedCommission), "SAR"],
        [],
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(summaryRows);

      XLSX.utils.sheet_add_json(worksheet, buildExcelRows(reportRows), {
        origin: "A10",
        skipHeader: false,
      });

      worksheet["!cols"] = [
        { wch: 18 },
        { wch: 30 },
        { wch: 28 },
        { wch: 18 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 18 },
        { wch: 18 },
        { wch: 14 },
        { wch: 18 },
      ];

      worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        isArabic ? "تقارير العقود" : "Contracts Reports"
      );

      XLSX.writeFile(workbook, "primey-care-contracts-reports.xlsx");
      toast.success(t.excelDone);
    } catch (error) {
      console.error("Export contracts reports error:", error);
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
              * {
                box-sizing: border-box;
              }

              body {
                font-family: Arial, sans-serif;
                padding: 24px;
                color: #111827;
                background: #ffffff;
              }

              .print-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 16px;
                padding-bottom: 16px;
                margin-bottom: 20px;
                border-bottom: 1px solid #e5e7eb;
              }

              .print-title {
                margin: 0;
                font-size: 24px;
                font-weight: 800;
              }

              .print-subtitle {
                margin: 6px 0 0;
                color: #6b7280;
                font-size: 13px;
                line-height: 1.8;
              }

              .print-summary {
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

              .section-title {
                margin: 24px 0 12px;
                font-size: 16px;
                font-weight: 800;
              }

              @media print {
                body {
                  padding: 0;
                }
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

            <div class="print-summary">
              <div class="print-card">
                <div class="print-card-label">${t.totalContracts}</div>
                <div class="print-card-value">${formatEnglishNumber(stats.total)}</div>
              </div>
              <div class="print-card">
                <div class="print-card-label">${t.activeContracts}</div>
                <div class="print-card-value">${formatEnglishNumber(stats.active)}</div>
              </div>
              <div class="print-card">
                <div class="print-card-label">${t.expiringSoon}</div>
                <div class="print-card-value">${formatEnglishNumber(stats.expiringSoon)}</div>
              </div>
              <div class="print-card">
                <div class="print-card-label">${t.totalValue}</div>
                <div class="print-card-value">${formatEnglishMoney(stats.totalValue)} SAR</div>
              </div>
            </div>

            ${printContent}
          </body>
        </html>
      `);

      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } catch (error) {
      console.error("Print contracts reports error:", error);
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
                  {isArabic ? "تقارير العقود" : "Contracts Reports"}
                </Badge>

                <Badge
                  variant="outline"
                  className="rounded-full bg-white/60 dark:bg-white/5"
                >
                  <ShieldCheck className="me-1 h-3.5 w-3.5" />
                  {isArabic ? "بيانات حقيقية" : "Live Data"}
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
                onClick={() => loadContracts({ silent: true })}
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

              <Button variant="outline" className="rounded-2xl" onClick={clearFilters}>
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
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="h-10 rounded-2xl border border-input bg-white/80 px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring dark:bg-white/5"
              >
                <option value="ALL">{t.allStatuses}</option>
                <option value="ACTIVE">{t.active}</option>
                <option value="DRAFT">{t.draft}</option>
                <option value="PENDING">{t.pending}</option>
                <option value="EXPIRED">{t.expired}</option>
                <option value="INACTIVE">{t.inactive}</option>
                <option value="TERMINATED">{t.terminated}</option>
                <option value="CANCELLED">{t.cancelled}</option>
                <option value="SUSPENDED">{t.suspended}</option>
              </select>

              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
                className="h-10 rounded-2xl border border-input bg-white/80 px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring dark:bg-white/5"
              >
                <option value="ALL">{t.allTypes}</option>
                <option value="GENERAL">{t.general}</option>
                <option value="MEDICAL">{t.medical}</option>
                <option value="SERVICE">{t.service}</option>
                <option value="PARTNERSHIP">{t.partnership}</option>
                <option value="DISCOUNT">{t.discount}</option>
                <option value="SUPPLY">{t.supply}</option>
                <option value="OTHER">{t.other}</option>
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

        {/* Printable Area */}
        <div ref={printAreaRef} className="space-y-6">
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t.totalContracts}</p>
                    <p className="mt-2 text-3xl font-bold tabular-nums">
                      {formatEnglishNumber(stats.total)}
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
                    <p className="text-sm text-muted-foreground">{t.activeContracts}</p>
                    <p className="mt-2 text-3xl font-bold tabular-nums">
                      {formatEnglishNumber(stats.active)}
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
                    <p className="text-sm text-muted-foreground">{t.expiringSoon}</p>
                    <p className="mt-2 text-3xl font-bold tabular-nums">
                      {formatEnglishNumber(stats.expiringSoon)}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-300">
                    <CalendarRange className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t.totalValue}</p>
                    <p className="mt-2 text-2xl font-bold tabular-nums">
                      <SarAmount amount={stats.totalValue} />
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-300">
                    <Wallet className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">{t.expiredContracts}</p>
                <p className="mt-2 text-3xl font-bold tabular-nums">
                  {formatEnglishNumber(stats.expired)}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">{t.avgValue}</p>
                <p className="mt-2 text-2xl font-bold tabular-nums">
                  <SarAmount amount={stats.avgValue} />
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">{t.estimatedCommission}</p>
                <p className="mt-2 text-2xl font-bold tabular-nums">
                  <SarAmount amount={stats.estimatedCommission} />
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Analysis Cards */}
          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-primary" />
                  {t.statusDistribution}
                </CardTitle>
                <CardDescription>{t.statusDistributionDesc}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {isLoading ? (
                  <div className="flex min-h-40 items-center justify-center text-muted-foreground">
                    <Loader2 className="me-2 h-5 w-5 animate-spin" />
                    {t.loading}
                  </div>
                ) : statusRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    {t.noData}
                  </div>
                ) : (
                  statusRows.map((row) => (
                    <div key={row.status} className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <Badge
                          variant="outline"
                          className={`rounded-full ${statusBadgeClass(row.status)}`}
                        >
                          {statusLabel(row.status, locale)}
                        </Badge>

                        <div className="flex items-center gap-3">
                          <span className="font-semibold tabular-nums">
                            {formatEnglishNumber(row.count)}
                          </span>
                          <span className="text-muted-foreground">
                            {formatEnglishMoney(row.value)} SAR
                          </span>
                        </div>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${row.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  {t.typeDistribution}
                </CardTitle>
                <CardDescription>{t.typeDistributionDesc}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {isLoading ? (
                  <div className="flex min-h-40 items-center justify-center text-muted-foreground">
                    <Loader2 className="me-2 h-5 w-5 animate-spin" />
                    {t.loading}
                  </div>
                ) : typeRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    {t.noData}
                  </div>
                ) : (
                  typeRows.map((row) => (
                    <div key={row.type} className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <Badge
                          variant="outline"
                          className="rounded-full bg-white/70 dark:bg-white/5"
                        >
                          {typeLabel(row.type, locale)}
                        </Badge>

                        <div className="flex items-center gap-3">
                          <span className="font-semibold tabular-nums">
                            {formatEnglishNumber(row.count)}
                          </span>
                          <span className="text-muted-foreground">
                            {formatEnglishMoney(row.value)} SAR
                          </span>
                        </div>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${row.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  {t.providerDistribution}
                </CardTitle>
                <CardDescription>{t.providerDistributionDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                {providerRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    {t.noData}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {providerRows.map((provider) => (
                      <div
                        key={provider.providerName}
                        className="rounded-2xl border border-white/20 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{provider.providerName}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatEnglishNumber(provider.activeCount)} {t.activeContracts}
                            </p>
                          </div>

                          <div className="text-end">
                            <p className="font-bold tabular-nums">
                              {formatEnglishNumber(provider.count)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatEnglishMoney(provider.value)} SAR
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarRange className="h-5 w-5 text-primary" />
                  {t.expiringReport}
                </CardTitle>
                <CardDescription>{t.expiringReportDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                {expiringContracts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    {t.noData}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {expiringContracts.map((contract) => (
                      <Link
                        href={`/system/contracts/${contract.id}`}
                        key={contract.id}
                        className="block rounded-2xl border border-white/20 bg-white/70 p-4 transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{contract.title}</p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {contract.providerName} · {contract.contractNumber}
                            </p>
                          </div>

                          <Badge
                            variant="outline"
                            className="shrink-0 rounded-full border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          >
                            {remainingLabel(contract.endDate, locale)}
                          </Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detailed Report */}
          <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSignature className="h-5 w-5 text-primary" />
                {t.detailedReport}
              </CardTitle>
              <CardDescription>{t.detailedReportDesc}</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/70 dark:border-white/10 dark:bg-white/5">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.contractNumber}</TableHead>
                      <TableHead>{t.title}</TableHead>
                      <TableHead>{t.providerName}</TableHead>
                      <TableHead>{t.contractType}</TableHead>
                      <TableHead>{t.status}</TableHead>
                      <TableHead>{t.endDate}</TableHead>
                      <TableHead>{t.daysLeft}</TableHead>
                      <TableHead>{t.contractValue}</TableHead>
                      <TableHead>{t.commissionRate}</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={9}>
                          <div className="flex min-h-52 items-center justify-center text-muted-foreground">
                            <Loader2 className="me-2 h-5 w-5 animate-spin" />
                            {t.loading}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : reportRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9}>
                          <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                            <FileSignature className="h-10 w-10 opacity-60" />
                            <p>{t.noData}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      reportRows.slice(0, 100).map((contract) => (
                        <TableRow key={contract.id}>
                          <TableCell>
                            <span className="font-semibold tabular-nums">
                              {contract.contractNumber}
                            </span>
                          </TableCell>

                          <TableCell>
                            <Link
                              href={`/system/contracts/${contract.id}`}
                              className="font-semibold hover:text-primary"
                            >
                              {contract.title}
                            </Link>
                          </TableCell>

                          <TableCell>{contract.providerName}</TableCell>

                          <TableCell>
                            <Badge
                              variant="outline"
                              className="rounded-full bg-white/70 dark:bg-white/5"
                            >
                              {typeLabel(contract.contractType, locale)}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`rounded-full ${statusBadgeClass(contract.status)}`}
                            >
                              {statusLabel(contract.status, locale)}
                            </Badge>
                          </TableCell>

                          <TableCell>{formatDate(contract.endDate, locale)}</TableCell>

                          <TableCell>{remainingLabel(contract.endDate, locale)}</TableCell>

                          <TableCell>
                            <SarAmount amount={contract.contractValue} />
                          </TableCell>

                          <TableCell>{formatPercent(contract.commissionRate)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {reportRows.length > 100 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  {isArabic
                    ? `تم عرض أول ${formatEnglishNumber(100)} سجل فقط داخل الجدول. ملف Excel يحتوي على جميع النتائج.`
                    : `Only the first ${formatEnglishNumber(100)} records are shown in the table. Excel contains all results.`}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden rounded-3xl border-white/20 bg-primary text-primary-foreground shadow-lg dark:border-white/10">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                <Sparkles className="h-6 w-6" />
              </div>

              <div>
                <h3 className="font-bold">
                  {isArabic ? "تقرير عقود موحد" : "Unified Contracts Report"}
                </h3>
                <p className="mt-2 text-sm leading-7 text-primary-foreground/80">
                  {isArabic
                    ? "تم بناء التقرير ليقرأ من واجهة العقود الرسمية، مع تصدير Excel منظم وطباعة للقسم المطلوب فقط."
                    : "This report reads from the official contracts API, with organized Excel export and print for the report section only."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}