"use client";

/* ============================================================
   📂 app/system/centers/reports/page.tsx
   🧠 Primey Care | Centers Reports
   ------------------------------------------------------------
   ✅ المسار: /system/centers/reports
   ✅ الإصدار: v1.0.0
   ✅ العمل: تقارير المراكز / مقدمي الخدمة
   ✅ API: GET /api/providers/?page_size=100
   ✅ متوافق مع:
      - /system/centers
      - /system/centers/list
      - /system/centers/[id]
   ------------------------------------------------------------
   تحسينات هذا الإصدار:
   - توثيق مختصر أعلى الملف
   - دعم Excel للتقرير الحالي فقط
   - دعم الطباعة Web PDF للتقرير الحالي
   - دعم عربي / إنجليزي عبر primey-locale
   - الأرقام دائمًا بالإنجليزي
   - استخدام رمز العملة /currency/sar.svg
   - استخدام sonner للتنبيهات
   - بدون localhost hardcoded
   - الحفاظ على التصميم السابق بدون كسر الواجهة
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Activity,
  ArrowDownUp,
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  Building2,
  ColumnsIcon,
  Download,
  FileText,
  FilterIcon,
  Loader2,
  MapPin,
  Phone,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  Star,
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
   Types
============================================================ */

type AppLocale = "ar" | "en";

type ProviderStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "DRAFT"
  | "UNKNOWN";

type ProviderType =
  | "HOSPITAL"
  | "MEDICAL_CENTER"
  | "PHARMACY"
  | "PARTNER"
  | "LAB"
  | "CLINIC"
  | "OTHER"
  | "UNKNOWN";

type StatusFilter = "ALL" | ProviderStatus;
type TypeFilter = "ALL" | ProviderType;
type FeaturedFilter = "ALL" | "FEATURED" | "NORMAL";

type SortKey = "name" | "code" | "providerType" | "city" | "status";
type SortDirection = "asc" | "desc";

type Center = {
  id: number | string;
  name: string;
  code: string;
  providerType: ProviderType;
  status: ProviderStatus;
  contactPerson: string;
  phone: string;
  mobile: string;
  email: string;
  website: string;
  city: string;
  area: string;
  address: string;
  googleMapsLink: string;
  notes: string;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
  raw: Record<string, unknown>;
};

type ProvidersApiResponse = {
  ok?: boolean;
  message?: string;
  results?: unknown[];
  data?: unknown[] | { results?: unknown[]; items?: unknown[] };
  items?: unknown[];
  providers?: unknown[];
  centers?: unknown[];
};

type VisibleColumns = {
  code: boolean;
  name: boolean;
  providerType: boolean;
  city: boolean;
  contact: boolean;
  status: boolean;
  featured: boolean;
};

const SAR_ICON = "/currency/sar.svg";

/* ============================================================
   Locale Helpers
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

function formatNumber(value: number | string): string {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return "0";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(numericValue);
}

function formatMoney(value: number | string): string {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return "0.00";

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
}

/* ============================================================
   API Normalizers
============================================================ */

function normalizeApiList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === "object") {
    const data = payload as ProvidersApiResponse;

    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.providers)) return data.providers;
    if (Array.isArray(data.centers)) return data.centers;
    if (Array.isArray(data.data)) return data.data;

    if (
      data.data &&
      typeof data.data === "object" &&
      Array.isArray(data.data.results)
    ) {
      return data.data.results;
    }

    if (
      data.data &&
      typeof data.data === "object" &&
      Array.isArray(data.data.items)
    ) {
      return data.data.items;
    }
  }

  return [];
}

function normalizeStatus(value: unknown): ProviderStatus {
  const status = String(value || "").toUpperCase();

  if (status === "ACTIVE") return "ACTIVE";
  if (status === "INACTIVE") return "INACTIVE";
  if (status === "SUSPENDED") return "SUSPENDED";
  if (status === "DRAFT") return "DRAFT";

  if (value === true) return "ACTIVE";
  if (value === false) return "INACTIVE";

  return "UNKNOWN";
}

function normalizeProviderType(value: unknown): ProviderType {
  const providerType = String(value || "").toUpperCase();

  if (providerType === "HOSPITAL") return "HOSPITAL";
  if (providerType === "MEDICAL_CENTER") return "MEDICAL_CENTER";
  if (providerType === "PHARMACY") return "PHARMACY";
  if (providerType === "PARTNER") return "PARTNER";
  if (providerType === "LAB") return "LAB";
  if (providerType === "CLINIC") return "CLINIC";
  if (providerType === "OTHER") return "OTHER";

  return "UNKNOWN";
}

function normalizeCenter(item: unknown): Center {
  const obj = (item || {}) as Record<string, unknown>;

  return {
    id: (obj.id ?? "-") as number | string,
    name: String(obj.name ?? obj.title ?? "-"),
    code: String(obj.code ?? obj.provider_code ?? "-"),
    providerType: normalizeProviderType(
      obj.provider_type ?? obj.type ?? obj.category,
    ),
    status: normalizeStatus(obj.status ?? obj.is_active),
    contactPerson: String(obj.contact_person ?? obj.contact_name ?? ""),
    phone: String(obj.phone ?? ""),
    mobile: String(obj.mobile ?? obj.phone_number ?? ""),
    email: String(obj.email ?? ""),
    website: String(obj.website ?? ""),
    city: String(obj.city ?? ""),
    area: String(obj.area ?? obj.region ?? ""),
    address: String(obj.address ?? ""),
    googleMapsLink: String(obj.google_maps_link ?? obj.map_url ?? ""),
    notes: String(obj.notes ?? ""),
    isFeatured: Boolean(obj.is_featured ?? obj.featured),
    createdAt: String(obj.created_at ?? ""),
    updatedAt: String(obj.updated_at ?? ""),
    raw: obj,
  };
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "تقارير المراكز" : "Centers Reports",
    subtitle: isArabic
      ? "تقارير تشغيلية للمراكز ومقدمي الخدمة مع فلاتر، جداول، تصدير وطباعة."
      : "Operational reports for centers/providers with filters, tables, export, and print.",

    back: isArabic ? "لوحة المراكز" : "Centers Overview",
    list: isArabic ? "قائمة المراكز" : "Centers List",
    refresh: isArabic ? "تحديث" : "Refresh",
    export: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    columns: isArabic ? "الأعمدة" : "Columns",
    reset: isArabic ? "إعادة ضبط" : "Reset",

    searchPlaceholder: isArabic
      ? "ابحث باسم المركز أو الكود أو المدينة..."
      : "Search by center name, code, or city...",

    all: isArabic ? "الكل" : "All",
    featuredOnly: isArabic ? "المميزة فقط" : "Featured Only",
    normalOnly: isArabic ? "غير المميزة" : "Normal Only",

    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
    suspended: isArabic ? "موقوف" : "Suspended",
    draft: isArabic ? "مسودة" : "Draft",
    unknown: isArabic ? "غير محدد" : "Unknown",

    totalCenters: isArabic ? "إجمالي المراكز" : "Total Centers",
    activeCenters: isArabic ? "المراكز النشطة" : "Active Centers",
    stoppedCenters: isArabic ? "المراكز الموقوفة" : "Stopped Centers",
    featuredCenters: isArabic ? "المراكز المميزة" : "Featured Centers",

    statusReport: isArabic ? "تقرير الحالات" : "Status Report",
    cityReport: isArabic ? "تقرير المدن" : "Cities Report",
    typeReport: isArabic ? "تقرير الأنواع" : "Types Report",
    detailedReport: isArabic ? "التقرير التفصيلي" : "Detailed Report",

    financialTitle: isArabic ? "المؤشرات المالية" : "Financial Indicators",
    financialDesc: isArabic
      ? "مؤشرات مبدئية سيتم ربطها لاحقًا بالفواتير والمدفوعات والعقود."
      : "Initial indicators that will later connect to invoices, payments, and contracts.",
    revenue: isArabic ? "إيرادات المراكز" : "Centers Revenue",
    linkedInvoices: isArabic ? "فواتير مرتبطة" : "Linked Invoices",
    operationalActivity: isArabic ? "عمليات تشغيلية" : "Operational Activity",

    loading: isArabic
      ? "جاري تحميل تقارير المراكز..."
      : "Loading centers reports...",
    noResults: isArabic ? "لا توجد نتائج." : "No results.",
    selectedRows: isArabic ? "صفوف محددة" : "row(s) selected",
    showing: isArabic ? "المعروض" : "Showing",
    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",

    excelSummary: isArabic ? "ملخص التقرير" : "Report Summary",
    excelFilters: isArabic ? "الفلاتر المستخدمة" : "Applied Filters",
    excelTable: isArabic ? "البيانات التفصيلية" : "Detailed Data",
    generatedAt: isArabic ? "تاريخ التصدير" : "Generated At",
    reportScope: isArabic ? "نطاق التقرير" : "Report Scope",
    currentFilteredData: isArabic
      ? "حسب الفلاتر الحالية"
      : "Current filtered data",
    filterSearch: isArabic ? "البحث" : "Search",
    filterStatus: isArabic ? "فلتر الحالة" : "Status Filter",
    filterType: isArabic ? "فلتر النوع" : "Type Filter",
    filterFeatured: isArabic ? "فلتر التمييز" : "Featured Filter",

    apiError: isArabic
      ? "تعذر تحميل بيانات تقارير المراكز."
      : "Unable to load centers reports data.",
    refreshSuccess: isArabic
      ? "تم تحديث تقارير المراكز بنجاح"
      : "Centers reports refreshed successfully",
    exportSuccess: isArabic
      ? "تم تجهيز ملف Excel بنجاح"
      : "Excel file prepared successfully",

    table: {
      id: isArabic ? "المعرف" : "ID",
      code: isArabic ? "الكود" : "Code",
      name: isArabic ? "اسم المركز" : "Center Name",
      providerType: isArabic ? "النوع" : "Type",
      city: isArabic ? "المدينة" : "City",
      area: isArabic ? "المنطقة" : "Area",
      contact: isArabic ? "التواصل" : "Contact",
      contactPerson: isArabic ? "الشخص المسؤول" : "Contact Person",
      status: isArabic ? "الحالة" : "Status",
      featured: isArabic ? "مميز" : "Featured",
      phone: isArabic ? "الهاتف" : "Phone",
      mobile: isArabic ? "الجوال" : "Mobile",
      email: isArabic ? "البريد الإلكتروني" : "Email",
      website: isArabic ? "الموقع الإلكتروني" : "Website",
      address: isArabic ? "العنوان" : "Address",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      updatedAt: isArabic ? "آخر تحديث" : "Updated At",
    },

    typeLabels: {
      HOSPITAL: isArabic ? "مستشفى" : "Hospital",
      MEDICAL_CENTER: isArabic ? "مركز طبي" : "Medical Center",
      PHARMACY: isArabic ? "صيدلية" : "Pharmacy",
      PARTNER: isArabic ? "شريك" : "Partner",
      LAB: isArabic ? "مختبر" : "Lab",
      CLINIC: isArabic ? "عيادة" : "Clinic",
      OTHER: isArabic ? "أخرى" : "Other",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<ProviderType, string>,
  };
}

/* ============================================================
   UI Helpers
============================================================ */

function getStatusLabel(status: ProviderStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<ProviderStatus, string> = {
    ACTIVE: t.active,
    INACTIVE: t.inactive,
    SUSPENDED: t.suspended,
    DRAFT: t.draft,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function statusBadge(status: ProviderStatus, locale: AppLocale) {
  const label = getStatusLabel(status, locale);

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

function calculatePercent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function formatDateForExcel(value: string) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function safeSheetName(name: string) {
  return name.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Report";
}

/* ============================================================
   Page
============================================================ */

export default function SystemCentersReportsPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [centers, setCenters] = useState<Center[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [featuredFilter, setFeaturedFilter] =
    useState<FeaturedFilter>("ALL");

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 8;

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    code: true,
    name: true,
    providerType: true,
    city: true,
    contact: true,
    status: true,
    featured: true,
  });

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const statusOptions = useMemo(
    () => [
      { value: "ALL" as StatusFilter, label: t.all },
      { value: "ACTIVE" as StatusFilter, label: t.active },
      { value: "DRAFT" as StatusFilter, label: t.draft },
      { value: "SUSPENDED" as StatusFilter, label: t.suspended },
      { value: "INACTIVE" as StatusFilter, label: t.inactive },
    ],
    [t],
  );

  const typeOptions = useMemo(
    () => [
      { value: "ALL" as TypeFilter, label: t.all },
      { value: "HOSPITAL" as TypeFilter, label: t.typeLabels.HOSPITAL },
      {
        value: "MEDICAL_CENTER" as TypeFilter,
        label: t.typeLabels.MEDICAL_CENTER,
      },
      { value: "CLINIC" as TypeFilter, label: t.typeLabels.CLINIC },
      { value: "PHARMACY" as TypeFilter, label: t.typeLabels.PHARMACY },
      { value: "LAB" as TypeFilter, label: t.typeLabels.LAB },
      { value: "PARTNER" as TypeFilter, label: t.typeLabels.PARTNER },
      { value: "OTHER" as TypeFilter, label: t.typeLabels.OTHER },
    ],
    [t],
  );

  const filteredCenters = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    const filtered = centers.filter((center) => {
      const matchesStatus =
        statusFilter === "ALL" || center.status === statusFilter;

      const matchesType =
        typeFilter === "ALL" || center.providerType === typeFilter;

      const matchesFeatured =
        featuredFilter === "ALL" ||
        (featuredFilter === "FEATURED" && center.isFeatured) ||
        (featuredFilter === "NORMAL" && !center.isFeatured);

      const matchesQuery =
        !cleanQuery ||
        center.name.toLowerCase().includes(cleanQuery) ||
        center.code.toLowerCase().includes(cleanQuery) ||
        center.city.toLowerCase().includes(cleanQuery) ||
        center.area.toLowerCase().includes(cleanQuery) ||
        center.mobile.toLowerCase().includes(cleanQuery) ||
        center.phone.toLowerCase().includes(cleanQuery) ||
        center.email.toLowerCase().includes(cleanQuery) ||
        center.contactPerson.toLowerCase().includes(cleanQuery) ||
        center.providerType.toLowerCase().includes(cleanQuery) ||
        center.status.toLowerCase().includes(cleanQuery);

      return matchesStatus && matchesType && matchesFeatured && matchesQuery;
    });

    return filtered.sort((a, b) => {
      const first = String(a[sortKey] ?? "").toLowerCase();
      const second = String(b[sortKey] ?? "").toLowerCase();

      if (first < second) return sortDirection === "asc" ? -1 : 1;
      if (first > second) return sortDirection === "asc" ? 1 : -1;

      return 0;
    });
  }, [
    centers,
    query,
    statusFilter,
    typeFilter,
    featuredFilter,
    sortKey,
    sortDirection,
  ]);

  const report = useMemo(() => {
    const total = filteredCenters.length;

    const active = filteredCenters.filter(
      (item) => item.status === "ACTIVE",
    ).length;
    const draft = filteredCenters.filter(
      (item) => item.status === "DRAFT",
    ).length;
    const inactive = filteredCenters.filter(
      (item) => item.status === "INACTIVE",
    ).length;
    const suspended = filteredCenters.filter(
      (item) => item.status === "SUSPENDED",
    ).length;
    const featured = filteredCenters.filter((item) => item.isFeatured).length;

    const cityMap = new Map<string, number>();
    const typeMap = new Map<ProviderType, number>();

    filteredCenters.forEach((center) => {
      const cityKey = center.city || center.area || "-";
      cityMap.set(cityKey, (cityMap.get(cityKey) || 0) + 1);

      typeMap.set(
        center.providerType,
        (typeMap.get(center.providerType) || 0) + 1,
      );
    });

    return {
      total,
      active,
      draft,
      inactive,
      suspended,
      stopped: inactive + suspended,
      featured,
      cities: Array.from(cityMap.entries())
        .map(([city, count]) => ({
          city,
          count,
          percent: calculatePercent(count, total),
        }))
        .sort((a, b) => b.count - a.count),
      types: Array.from(typeMap.entries())
        .map(([type, count]) => ({
          type,
          count,
          percent: calculatePercent(count, total),
        }))
        .sort((a, b) => b.count - a.count),
    };
  }, [filteredCenters]);

  const pageCount = Math.max(Math.ceil(filteredCenters.length / pageSize), 1);

  const pageRows = useMemo(() => {
    const start = pageIndex * pageSize;
    return filteredCenters.slice(start, start + pageSize);
  }, [filteredCenters, pageIndex]);

  const selectedOnPage = pageRows.filter((row) =>
    selectedIds.includes(row.id),
  ).length;

  const allPageSelected =
    pageRows.length > 0 && selectedOnPage === pageRows.length;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  function toggleRow(id: string | number) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function toggleAllPageRows() {
    const pageIds = pageRows.map((row) => row.id);

    if (allPageSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !pageIds.includes(id)),
      );
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...pageIds])));
  }

  function resetFilters() {
    setQuery("");
    setStatusFilter("ALL");
    setTypeFilter("ALL");
    setFeaturedFilter("ALL");
    setPageIndex(0);
    setSelectedIds([]);
  }

  async function loadReports(showToast = false) {
    try {
      setIsLoading(true);

      const response = await fetch("/api/providers/?page_size=100", {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as ProvidersApiResponse;
      setCenters(normalizeApiList(payload).map(normalizeCenter));

      if (showToast) {
        toast.success(t.refreshSuccess);
      }
    } catch (error) {
      console.error("Failed to load centers reports:", error);
      setCenters([]);
      toast.error(t.apiError);
    } finally {
      setIsLoading(false);
    }
  }

  function exportExcel() {
    const generatedAt = new Date();

    const statusLabel =
      statusOptions.find((item) => item.value === statusFilter)?.label || t.all;

    const typeLabel =
      typeOptions.find((item) => item.value === typeFilter)?.label || t.all;

    const featuredLabel =
      featuredFilter === "ALL"
        ? t.all
        : featuredFilter === "FEATURED"
          ? t.featuredOnly
          : t.normalOnly;

    const worksheetData: Array<Array<string | number>> = [
      [t.title],
      [],
      [t.excelSummary, ""],
      [t.generatedAt, generatedAt.toLocaleString("en-US")],
      [t.reportScope, t.currentFilteredData],
      [
        t.showing,
        `${formatNumber(filteredCenters.length)} / ${formatNumber(centers.length)}`,
      ],
      [t.totalCenters, report.total],
      [t.activeCenters, report.active],
      [t.stoppedCenters, report.stopped],
      [t.featuredCenters, report.featured],
      [],
      [t.excelFilters, ""],
      [t.filterSearch, query || t.all],
      [t.filterStatus, statusLabel],
      [t.filterType, typeLabel],
      [t.filterFeatured, featuredLabel],
      [],
      [t.excelTable],
      [
        t.table.id,
        t.table.code,
        t.table.name,
        t.table.providerType,
        t.table.city,
        t.table.area,
        t.table.contactPerson,
        t.table.phone,
        t.table.mobile,
        t.table.email,
        t.table.website,
        t.table.status,
        t.table.featured,
        t.table.address,
        t.table.createdAt,
        t.table.updatedAt,
      ],
      ...filteredCenters.map((center) => [
        String(center.id),
        center.code || "-",
        center.name || "-",
        t.typeLabels[center.providerType],
        center.city || "-",
        center.area || "-",
        center.contactPerson || "-",
        center.phone || "-",
        center.mobile || "-",
        center.email || "-",
        center.website || "-",
        getStatusLabel(center.status, locale),
        center.isFeatured ? (isArabic ? "نعم" : "Yes") : isArabic ? "لا" : "No",
        center.address || "-",
        formatDateForExcel(center.createdAt),
        formatDateForExcel(center.updatedAt),
      ]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 15 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 15 } },
      { s: { r: 11, c: 0 }, e: { r: 11, c: 15 } },
      { s: { r: 17, c: 0 }, e: { r: 17, c: 15 } },
    ];

    worksheet["!cols"] = [
      { wch: 12 },
      { wch: 20 },
      { wch: 34 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 22 },
      { wch: 16 },
      { wch: 16 },
      { wch: 28 },
      { wch: 28 },
      { wch: 14 },
      { wch: 12 },
      { wch: 36 },
      { wch: 22 },
      { wch: 22 },
    ];

    worksheet["!autofilter"] = {
      ref: `A19:P${Math.max(19 + filteredCenters.length, 19)}`,
    };

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      safeSheetName(isArabic ? "تقارير المراكز" : "Centers Report"),
    );

    XLSX.writeFile(
      workbook,
      `primey-care-centers-report-${generatedAt.toISOString().slice(0, 10)}.xlsx`,
      {
        bookType: "xlsx",
        compression: true,
      },
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
    loadReports(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useEffect(() => {
    setPageIndex(0);
    setSelectedIds([]);
  }, [query, statusFilter, typeFilter, featuredFilter]);

  return (
    <div className="space-y-4 print:space-y-3">
      <div className="flex flex-col gap-3 print:hidden lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              /system/centers/reports
            </Badge>
            <Badge className="rounded-full">
              {isArabic ? "تقارير حقيقية" : "Live Reports"}
            </Badge>
          </div>

          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t.title}
          </h1>

          <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
            {t.subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link href="/system/centers">
            <Button variant="outline" className="h-10 w-full rounded-xl sm:w-auto">
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>

          <Link href="/system/centers/list">
            <Button variant="outline" className="h-10 w-full rounded-xl sm:w-auto">
              <Building2 className="h-4 w-4" />
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
            disabled={isLoading || filteredCenters.length === 0}
          >
            <Download className="h-4 w-4" />
            <span>{t.export}</span>
          </Button>

          <Button
            className="h-10 rounded-xl"
            onClick={printReport}
            disabled={isLoading}
          >
            <Printer className="h-4 w-4" />
            <span>{t.print}</span>
          </Button>
        </div>
      </div>

      <div className="hidden print:block">
        <h1 className="text-xl font-bold">{t.title}</h1>
        <p className="mt-1 text-sm">{new Date().toLocaleString("en-US")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: t.totalCenters,
            value: report.total,
            percent: 100,
            icon: Building2,
          },
          {
            label: t.activeCenters,
            value: report.active,
            percent: calculatePercent(report.active, report.total),
            icon: BadgeCheck,
          },
          {
            label: t.stoppedCenters,
            value: report.stopped,
            percent: calculatePercent(report.stopped, report.total),
            icon: ShieldCheck,
          },
          {
            label: t.featuredCenters,
            value: report.featured,
            percent: calculatePercent(report.featured, report.total),
            icon: Star,
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <Card
              key={item.label}
              className="rounded-2xl border bg-card shadow-sm print:shadow-none"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-2xl font-bold">
                      {isLoading ? "..." : formatNumber(item.value)}
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {item.label}
                    </p>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {formatNumber(item.percent)}%
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ReportMiniTable
          title={t.statusReport}
          icon={BarChart3}
          rows={[
            {
              label: t.active,
              value: report.active,
              percent: calculatePercent(report.active, report.total),
            },
            {
              label: t.draft,
              value: report.draft,
              percent: calculatePercent(report.draft, report.total),
            },
            {
              label: t.suspended,
              value: report.suspended,
              percent: calculatePercent(report.suspended, report.total),
            },
            {
              label: t.inactive,
              value: report.inactive,
              percent: calculatePercent(report.inactive, report.total),
            },
          ]}
          loading={isLoading}
          loadingText={t.loading}
          noResults={t.noResults}
          recordLabel={isArabic ? "سجل" : "record"}
        />

        <ReportMiniTable
          title={t.cityReport}
          icon={MapPin}
          rows={report.cities.slice(0, 5).map((item) => ({
            label: item.city,
            value: item.count,
            percent: item.percent,
          }))}
          loading={isLoading}
          loadingText={t.loading}
          noResults={t.noResults}
          recordLabel={isArabic ? "سجل" : "record"}
        />

        <ReportMiniTable
          title={t.typeReport}
          icon={Activity}
          rows={report.types.slice(0, 5).map((item) => ({
            label: t.typeLabels[item.type],
            value: item.count,
            percent: item.percent,
          }))}
          loading={isLoading}
          loadingText={t.loading}
          noResults={t.noResults}
          recordLabel={isArabic ? "سجل" : "record"}
        />
      </div>

      <Card className="rounded-2xl border bg-card shadow-sm print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold">{t.financialTitle}</CardTitle>
          <CardDescription>{t.financialDesc}</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                label: t.revenue,
                value: formatMoney(0),
                icon: Wallet,
                isMoney: true,
              },
              {
                label: t.linkedInvoices,
                value: formatNumber(0),
                icon: FileText,
                isMoney: false,
              },
              {
                label: t.operationalActivity,
                value: formatNumber(report.total),
                icon: Activity,
                isMoney: false,
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.label} className="rounded-xl border bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-muted-foreground text-sm">{item.label}</p>
                      <div className="mt-2 flex items-center gap-2">
                        {item.isMoney ? (
                          <Image
                            src={SAR_ICON}
                            alt="SAR"
                            width={18}
                            height={18}
                            className="shrink-0"
                          />
                        ) : null}
                        <p className="text-2xl font-bold">{item.value}</p>
                      </div>
                    </div>

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border bg-card shadow-sm print:shadow-none">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-base font-bold">
                {t.detailedReport}
              </CardTitle>
              <CardDescription>
                {t.showing}: {formatNumber(filteredCenters.length)} /{" "}
                {formatNumber(centers.length)}
              </CardDescription>
            </div>

            <Button
              variant="outline"
              className="hidden h-10 rounded-xl print:hidden lg:inline-flex"
              onClick={resetFilters}
            >
              {t.reset}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="w-full space-y-4">
            <div className="flex flex-col gap-3 print:hidden xl:flex-row xl:items-center">
              <div className="relative w-full md:max-w-sm">
                <Search
                  className={`text-muted-foreground absolute top-1/2 h-4 w-4 -translate-y-1/2 ${
                    isArabic ? "right-3" : "left-3"
                  }`}
                />
                <Input
                  placeholder={t.searchPlaceholder}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className={`h-10 rounded-xl ${
                    isArabic ? "pr-10" : "pl-10"
                  }`}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {statusOptions.map((item) => (
                  <Button
                    key={item.value}
                    variant={statusFilter === item.value ? "default" : "outline"}
                    className="h-10 rounded-xl"
                    onClick={() => setStatusFilter(item.value)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {typeOptions.slice(0, 5).map((item) => (
                  <Button
                    key={item.value}
                    variant={typeFilter === item.value ? "default" : "outline"}
                    className="h-10 rounded-xl"
                    onClick={() => setTypeFilter(item.value)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { label: t.all, value: "ALL" as FeaturedFilter },
                  { label: t.featuredOnly, value: "FEATURED" as FeaturedFilter },
                  { label: t.normalOnly, value: "NORMAL" as FeaturedFilter },
                ].map((item) => (
                  <Button
                    key={item.value}
                    variant={featuredFilter === item.value ? "default" : "outline"}
                    className="h-10 rounded-xl"
                    onClick={() => setFeaturedFilter(item.value)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>

              <div className="ms-auto flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-10 rounded-xl">
                      <span className="hidden lg:inline">{t.columns}</span>
                      <ColumnsIcon className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align={isArabic ? "start" : "end"}>
                    {Object.entries(visibleColumns).map(([key, value]) => (
                      <DropdownMenuCheckboxItem
                        key={key}
                        checked={value}
                        onCheckedChange={(checked) =>
                          setVisibleColumns((current) => ({
                            ...current,
                            [key]: Boolean(checked),
                          }))
                        }
                      >
                        {key}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="outline"
                  className="h-10 rounded-xl"
                  onClick={resetFilters}
                >
                  <FilterIcon className="h-4 w-4" />
                  {t.reset}
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 print:hidden">
                      <Checkbox
                        checked={allPageSelected}
                        onCheckedChange={toggleAllPageRows}
                        aria-label="Select all"
                      />
                    </TableHead>

                    {visibleColumns.name ? (
                      <TableHead>
                        <Button
                          className="-ms-3 print:hidden"
                          variant="ghost"
                          onClick={() => toggleSort("name")}
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
                          onClick={() => toggleSort("code")}
                        >
                          {t.table.code}
                          <ArrowDownUp className="h-3 w-3" />
                        </Button>
                        <span className="hidden print:inline">{t.table.code}</span>
                      </TableHead>
                    ) : null}

                    {visibleColumns.providerType ? (
                      <TableHead>
                        <Button
                          className="-ms-3 print:hidden"
                          variant="ghost"
                          onClick={() => toggleSort("providerType")}
                        >
                          {t.table.providerType}
                          <ArrowDownUp className="h-3 w-3" />
                        </Button>
                        <span className="hidden print:inline">
                          {t.table.providerType}
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
                      <TableCell colSpan={8} className="h-28">
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t.loading}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : pageRows.length ? (
                    pageRows.map((center) => (
                      <TableRow
                        key={center.id}
                        data-state={
                          selectedIds.includes(center.id) ? "selected" : undefined
                        }
                      >
                        <TableCell className="print:hidden">
                          <Checkbox
                            checked={selectedIds.includes(center.id)}
                            onCheckedChange={() => toggleRow(center.id)}
                            aria-label="Select row"
                          />
                        </TableCell>

                        {visibleColumns.name ? (
                          <TableCell>
                            <div className="flex min-w-[220px] items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted print:hidden">
                                <Building2 className="h-5 w-5" />
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="truncate font-medium">
                                    {center.name}
                                  </span>

                                  {center.isFeatured ? (
                                    <Star className="size-4 fill-orange-400 text-orange-400 print:hidden" />
                                  ) : null}
                                </div>

                                <div className="text-muted-foreground mt-1 truncate text-xs">
                                  {center.contactPerson || center.email || center.code}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        ) : null}

                        {visibleColumns.code ? (
                          <TableCell className="font-medium">
                            {center.code || `#${center.id}`}
                          </TableCell>
                        ) : null}

                        {visibleColumns.providerType ? (
                          <TableCell>
                            <Badge variant="secondary" className="rounded-full">
                              {t.typeLabels[center.providerType]}
                            </Badge>
                          </TableCell>
                        ) : null}

                        {visibleColumns.city ? (
                          <TableCell>
                            <div className="flex min-w-[120px] items-center gap-2">
                              <MapPin className="text-muted-foreground h-3.5 w-3.5 print:hidden" />
                              <span>{center.city || center.area || "-"}</span>
                            </div>
                          </TableCell>
                        ) : null}

                        {visibleColumns.contact ? (
                          <TableCell>
                            <div className="flex min-w-[130px] items-center gap-2">
                              <Phone className="text-muted-foreground h-3.5 w-3.5 print:hidden" />
                              <span>{center.mobile || center.phone || "-"}</span>
                            </div>
                          </TableCell>
                        ) : null}

                        {visibleColumns.status ? (
                          <TableCell>{statusBadge(center.status, locale)}</TableCell>
                        ) : null}

                        {visibleColumns.featured ? (
                          <TableCell>
                            {center.isFeatured ? (
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
                      <TableCell colSpan={8} className="h-28 text-center">
                        {t.noResults}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-end">
              <div className="text-muted-foreground flex-1 text-sm">
                {formatNumber(selectedIds.length)} /{" "}
                {formatNumber(filteredCenters.length)} {t.selectedRows}
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
    </div>
  );
}

/* ============================================================
   Small Components
============================================================ */

function ReportMiniTable({
  title,
  icon: Icon,
  rows,
  loading,
  loadingText,
  noResults,
  recordLabel,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  rows: Array<{ label: string; value: number; percent: number }>;
  loading: boolean;
  loadingText: string;
  noResults: string;
  recordLabel: string;
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
                    {formatNumber(row.value)} {recordLabel}
                  </p>
                </div>

                <Badge variant="secondary" className="rounded-full">
                  {formatNumber(row.percent)}%
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