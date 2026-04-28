"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileSignature,
  FileText,
  Filter,
  ListChecks,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
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
   📂 app/system/contracts/page.tsx
   🧾 Primey Care | System Contracts Dashboard
   ------------------------------------------------------------
   ✅ صفحة لوحة العقود الرئيسية
   ✅ بنفس نمط المراكز / العملاء / المندوبين / المنتجات / الطلبات / مقدمي الخدمة
   ✅ ربط حقيقي مع /api/contracts/
   ✅ دعم عربي / إنجليزي من primey-locale
   ✅ الأرقام دائمًا إنجليزية
   ✅ استخدام UI الداخلي فقط
   ✅ استخدام رمز SAR الرسمي
   ✅ لا يوجد hardcoded localhost
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
  pagination?: {
    count?: number;
    total?: number;
    page?: number;
    page_size?: number;
    total_pages?: number;
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

function daysUntil(dateValue: string) {
  if (!dateValue) return null;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/* ============================================================
   🧩 API Normalizers
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
      obj.title ??
      ""
  );
}

function normalizeContract(item: unknown): Contract {
  const obj = (item || {}) as Record<string, unknown>;
  const providerObj = obj.provider as Record<string, unknown> | undefined;

  const title = String(
    obj.title ??
      obj.name ??
      obj.contract_title ??
      obj.contract_name ??
      obj.contractTitle ??
      "-"
  );

  const providerName = String(
    obj.provider_name ??
      obj.center_name ??
      obj.providerName ??
      readNestedName(obj.provider) ??
      "-"
  );

  const providerId =
    (obj.provider_id as number | string | undefined) ??
    (providerObj?.id as number | string | undefined) ??
    null;

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
    title,
    providerName: providerName || "-",
    providerId,
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
    pageTitle: isArabic ? "إدارة العقود" : "Contracts Management",
    pageSubtitle: isArabic
      ? "متابعة عقود مقدمي الخدمة، حالات التفعيل، تواريخ الانتهاء، والقيم المالية من البيانات الحقيقية."
      : "Monitor provider contracts, activation status, expiry dates, and financial values from live data.",

    createContract: isArabic ? "إنشاء عقد" : "Create Contract",
    contractsList: isArabic ? "قائمة العقود" : "Contracts List",
    reports: isArabic ? "التقارير" : "Reports",
    export: isArabic ? "تصدير" : "Export",
    refresh: isArabic ? "تحديث" : "Refresh",

    totalContracts: isArabic ? "إجمالي العقود" : "Total Contracts",
    activeContracts: isArabic ? "العقود النشطة" : "Active Contracts",
    expiringSoon: isArabic ? "قريبة الانتهاء" : "Expiring Soon",
    totalValue: isArabic ? "إجمالي القيمة" : "Total Value",

    featuredContracts: isArabic ? "العقود المهمة" : "Featured Contracts",
    featuredSubtitle: isArabic
      ? "عرض مختصر لأهم العقود بناءً على الحالة والقيمة وأحدث السجلات."
      : "A compact view of important contracts based on status, value, and latest records.",

    statusOverview: isArabic ? "حالة العقود" : "Contracts Status",
    statusSubtitle: isArabic
      ? "تحليل سريع لتوزيع العقود حسب الحالة التشغيلية."
      : "Quick analysis of contracts by operational status.",

    quickActions: isArabic ? "إجراءات الوحدة" : "Module Actions",
    quickActionsSubtitle: isArabic
      ? "تنقل سريع داخل وحدة العقود."
      : "Quick navigation inside contracts module.",

    recentContracts: isArabic ? "آخر العقود" : "Recent Contracts",
    recentSubtitle: isArabic
      ? "آخر العقود المسجلة داخل النظام."
      : "Latest contracts registered in the system.",

    searchPlaceholder: isArabic
      ? "ابحث في العقود..."
      : "Search contracts...",

    contract: isArabic ? "العقد" : "Contract",
    contractNumber: isArabic ? "رقم العقد" : "Contract No.",
    provider: isArabic ? "مقدم الخدمة" : "Provider",
    type: isArabic ? "النوع" : "Type",
    status: isArabic ? "الحالة" : "Status",
    startDate: isArabic ? "تاريخ البداية" : "Start Date",
    endDate: isArabic ? "تاريخ النهاية" : "End Date",
    value: isArabic ? "القيمة" : "Value",
    commission: isArabic ? "العمولة" : "Commission",
    actions: isArabic ? "الإجراءات" : "Actions",
    view: isArabic ? "عرض" : "View",

    noContracts: isArabic
      ? "لا توجد عقود مطابقة حاليًا."
      : "No matching contracts found.",

    loading: isArabic ? "جاري تحميل العقود..." : "Loading contracts...",
    loadError: isArabic
      ? "تعذر تحميل بيانات العقود."
      : "Failed to load contracts data.",

    updatedNow: isArabic ? "تم تحديث بيانات العقود" : "Contracts data refreshed",
    exported: isArabic
      ? "تم تجهيز تصدير العقود"
      : "Contracts export prepared",

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

    allStatuses: isArabic ? "كل الحالات" : "All Statuses",
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

function SarAmount({ amount }: { amount: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
      <Image
        src="/currency/sar.svg"
        alt="SAR"
        width={14}
        height={14}
        className="opacity-80"
      />
      {formatEnglishMoney(amount)}
    </span>
  );
}

/* ============================================================
   🧾 Page
============================================================ */

export default function SystemContractsPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "ALL">("ALL");

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

      const response = await fetch("/api/contracts/?page_size=100", {
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
      console.error("Load contracts error:", error);
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
        contract.title.toLowerCase().includes(query) ||
        contract.contractNumber.toLowerCase().includes(query) ||
        contract.providerName.toLowerCase().includes(query) ||
        contract.notes.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "ALL" || contract.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [contracts, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const total = contracts.length;
    const active = contracts.filter((item) => item.status === "ACTIVE").length;

    const expiringSoon = contracts.filter((item) => {
      const days = daysUntil(item.endDate);
      return days !== null && days >= 0 && days <= 30;
    }).length;

    const totalValue = contracts.reduce(
      (sum, item) => sum + Number(item.contractValue || 0),
      0
    );

    const expired = contracts.filter((item) => {
      if (item.status === "EXPIRED" || item.status === "TERMINATED") return true;

      const days = daysUntil(item.endDate);
      return days !== null && days < 0;
    }).length;

    const draft = contracts.filter(
      (item) => item.status === "DRAFT" || item.status === "PENDING"
    ).length;

    return {
      total,
      active,
      expiringSoon,
      totalValue,
      expired,
      draft,
    };
  }, [contracts]);

  const featuredContracts = useMemo(() => {
    return [...contracts]
      .sort((a, b) => {
        const activeScoreA = a.status === "ACTIVE" ? 1 : 0;
        const activeScoreB = b.status === "ACTIVE" ? 1 : 0;

        if (activeScoreA !== activeScoreB) return activeScoreB - activeScoreA;

        return Number(b.contractValue || 0) - Number(a.contractValue || 0);
      })
      .slice(0, 4);
  }, [contracts]);

  const recentContracts = useMemo(() => {
    return [...filteredContracts]
      .sort((a, b) => {
        const dateA = new Date(a.createdAt || a.updatedAt || 0).getTime();
        const dateB = new Date(b.createdAt || b.updatedAt || 0).getTime();

        return dateB - dateA;
      })
      .slice(0, 6);
  }, [filteredContracts]);

  const statusRows = useMemo(() => {
    const statuses: ContractStatus[] = [
      "ACTIVE",
      "DRAFT",
      "PENDING",
      "EXPIRED",
      "INACTIVE",
      "TERMINATED",
    ];

    return statuses
      .map((status) => {
        const count = contracts.filter((item) => item.status === status).length;
        const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;

        return {
          status,
          count,
          percentage,
        };
      })
      .filter((item) => item.count > 0);
  }, [contracts, stats.total]);

  function handleExport() {
    try {
      const rows = filteredContracts.map((contract) => ({
        contract_number: contract.contractNumber,
        title: contract.title,
        provider: contract.providerName,
        type: typeLabel(contract.contractType, locale),
        status: statusLabel(contract.status, locale),
        start_date: contract.startDate,
        end_date: contract.endDate,
        contract_value: contract.contractValue,
        commission_rate: contract.commissionRate,
        products_count: contract.productsCount,
      }));

      const csvContent = [
        Object.keys(rows[0] || {}).join(","),
        ...rows.map((row) =>
          Object.values(row)
            .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
            .join(",")
        ),
      ].join("\n");

      const blob = new Blob(["\ufeff" + csvContent], {
        type: "text/csv;charset=utf-8;",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "contracts-dashboard.csv";
      link.click();

      URL.revokeObjectURL(url);
      toast.success(t.exported);
    } catch (error) {
      console.error("Export contracts error:", error);
      toast.error(isArabic ? "تعذر تصدير العقود" : "Failed to export contracts");
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/80 p-6 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-sky-500/10" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                  <FileSignature className="me-1 h-3.5 w-3.5" />
                  {isArabic ? "وحدة العقود" : "Contracts Module"}
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
                onClick={handleExport}
              >
                <Download className="me-2 h-4 w-4" />
                {t.export}
              </Button>

              <Link href="/system/contracts/reports">
                <Button variant="outline" className="rounded-2xl bg-white/70 dark:bg-white/5">
                  <BarChart3 className="me-2 h-4 w-4" />
                  {t.reports}
                </Button>
              </Link>

              <Link href="/system/contracts/create">
                <Button className="rounded-2xl shadow-lg">
                  <Plus className="me-2 h-4 w-4" />
                  {t.createContract}
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
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
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t.activeContracts}</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums">
                    {formatEnglishNumber(stats.active)}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t.expiringSoon}</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums">
                    {formatEnglishNumber(stats.expiringSoon)}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-300">
                  <Clock3 className="h-5 w-5" />
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
                  <Activity className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Grid */}
        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
          <div className="space-y-6">
            {/* Featured */}
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    {t.featuredContracts}
                  </CardTitle>
                  <CardDescription>{t.featuredSubtitle}</CardDescription>
                </div>

                <Link href="/system/contracts/list">
                  <Button variant="outline" className="rounded-2xl">
                    <ListChecks className="me-2 h-4 w-4" />
                    {t.contractsList}
                  </Button>
                </Link>
              </CardHeader>

              <CardContent>
                {isLoading ? (
                  <div className="flex min-h-40 items-center justify-center text-muted-foreground">
                    <Loader2 className="me-2 h-5 w-5 animate-spin" />
                    {t.loading}
                  </div>
                ) : featuredContracts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    {t.noContracts}
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {featuredContracts.map((contract) => (
                      <Link
                        href={`/system/contracts/${contract.id}`}
                        key={contract.id}
                        className="group rounded-3xl border border-white/20 bg-white/70 p-4 transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-white/5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                              <FileSignature className="h-5 w-5" />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold">
                                {contract.title}
                              </p>
                              <p className="mt-1 truncate text-xs text-muted-foreground">
                                {contract.contractNumber}
                              </p>
                            </div>
                          </div>

                          <Badge
                            variant="outline"
                            className={`shrink-0 rounded-full ${statusBadgeClass(
                              contract.status
                            )}`}
                          >
                            {statusLabel(contract.status, locale)}
                          </Badge>
                        </div>

                        <div className="mt-4 grid gap-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">{t.provider}</span>
                            <span className="truncate font-medium">
                              {contract.providerName}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">{t.value}</span>
                            <SarAmount amount={contract.contractValue} />
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">{t.endDate}</span>
                            <span className="font-medium">
                              {formatDate(contract.endDate, locale)}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Table */}
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle>{t.recentContracts}</CardTitle>
                    <CardDescription>{t.recentSubtitle}</CardDescription>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative">
                      <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder={t.searchPlaceholder}
                        className="w-full rounded-2xl bg-white/80 ps-9 dark:bg-white/5 sm:w-64"
                      />
                    </div>

                    <div className="relative">
                      <Filter className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <select
                        value={statusFilter}
                        onChange={(event) =>
                          setStatusFilter(event.target.value as ContractStatus | "ALL")
                        }
                        className="h-10 rounded-2xl border border-input bg-white/80 px-9 text-sm outline-none transition focus:ring-2 focus:ring-ring dark:bg-white/5"
                      >
                        <option value="ALL">{t.allStatuses}</option>
                        <option value="ACTIVE">{t.active}</option>
                        <option value="DRAFT">{t.draft}</option>
                        <option value="PENDING">{t.pending}</option>
                        <option value="EXPIRED">{t.expired}</option>
                        <option value="INACTIVE">{t.inactive}</option>
                        <option value="TERMINATED">{t.terminated}</option>
                      </select>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/70 dark:border-white/10 dark:bg-white/5">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.contract}</TableHead>
                        <TableHead>{t.provider}</TableHead>
                        <TableHead>{t.status}</TableHead>
                        <TableHead>{t.endDate}</TableHead>
                        <TableHead>{t.value}</TableHead>
                        <TableHead className="text-center">{t.actions}</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={6}>
                            <div className="flex min-h-32 items-center justify-center text-muted-foreground">
                              <Loader2 className="me-2 h-5 w-5 animate-spin" />
                              {t.loading}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : recentContracts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6}>
                            <div className="flex min-h-32 items-center justify-center text-muted-foreground">
                              {t.noContracts}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        recentContracts.map((contract) => (
                          <TableRow key={contract.id}>
                            <TableCell>
                              <div className="min-w-0">
                                <p className="truncate font-semibold">
                                  {contract.title}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {contract.contractNumber}
                                </p>
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span className="max-w-44 truncate">
                                  {contract.providerName}
                                </span>
                              </div>
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
                              <SarAmount amount={contract.contractValue} />
                            </TableCell>

                            <TableCell>
                              <div className="flex items-center justify-center">
                                <Link href={`/system/contracts/${contract.id}`}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="rounded-xl"
                                  >
                                    <Eye className="me-2 h-4 w-4" />
                                    {t.view}
                                  </Button>
                                </Link>
                              </div>
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

          {/* Sidebar Cards */}
          <div className="space-y-6">
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  {t.statusOverview}
                </CardTitle>
                <CardDescription>{t.statusSubtitle}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {statusRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    {t.noContracts}
                  </div>
                ) : (
                  statusRows.map((row) => (
                    <div key={row.status} className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`rounded-full ${statusBadgeClass(row.status)}`}
                          >
                            {statusLabel(row.status, locale)}
                          </Badge>
                        </div>

                        <div className="font-semibold tabular-nums">
                          {formatEnglishNumber(row.count)}
                        </div>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(row.percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="rounded-2xl border border-white/20 bg-white/70 p-4 text-center dark:border-white/10 dark:bg-white/5">
                    <p className="text-2xl font-bold tabular-nums">
                      {formatEnglishNumber(stats.draft)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isArabic ? "مسودة / معلقة" : "Draft / Pending"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/20 bg-white/70 p-4 text-center dark:border-white/10 dark:bg-white/5">
                    <p className="text-2xl font-bold tabular-nums">
                      {formatEnglishNumber(stats.expired)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isArabic ? "منتهية" : "Expired"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BadgeCheck className="h-5 w-5 text-primary" />
                  {t.quickActions}
                </CardTitle>
                <CardDescription>{t.quickActionsSubtitle}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                <Link href="/system/contracts/list" className="block">
                  <Button variant="outline" className="w-full justify-start rounded-2xl">
                    <ListChecks className="me-2 h-4 w-4" />
                    {t.contractsList}
                  </Button>
                </Link>

                <Link href="/system/contracts/create" className="block">
                  <Button variant="outline" className="w-full justify-start rounded-2xl">
                    <Plus className="me-2 h-4 w-4" />
                    {t.createContract}
                  </Button>
                </Link>

                <Link href="/system/contracts/reports" className="block">
                  <Button variant="outline" className="w-full justify-start rounded-2xl">
                    <BarChart3 className="me-2 h-4 w-4" />
                    {t.reports}
                  </Button>
                </Link>

                <Link href="/system/providers/list" className="block">
                  <Button variant="outline" className="w-full justify-start rounded-2xl">
                    <Users className="me-2 h-4 w-4" />
                    {isArabic ? "مقدمو الخدمة" : "Providers"}
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-3xl border-white/20 bg-primary text-primary-foreground shadow-lg dark:border-white/10">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                    <ShieldCheck className="h-6 w-6" />
                  </div>

                  <div>
                    <h3 className="font-bold">
                      {isArabic ? "وحدة عقود موحدة" : "Unified Contracts Module"}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-primary-foreground/80">
                      {isArabic
                        ? "تم تجهيز لوحة العقود لتعمل بنفس هوية وحدات النظام وبالاعتماد على API العقود الرسمي."
                        : "The contracts dashboard is prepared with the same system identity and connected to the official contracts API."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}