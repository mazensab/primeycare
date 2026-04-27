"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  ArrowDownUp,
  ArrowLeft,
  BadgeCheck,
  Building2,
  ColumnsIcon,
  Download,
  Eye,
  FileText,
  Loader2,
  MapPin,
  MoreHorizontal,
  Phone,
  PlusCircle,
  RefreshCcw,
  Search,
  ShieldCheck,
  Star,
  Stethoscope,
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
   📂 app/system/centers/list/page.tsx
   🧠 Primey Care | Centers List
   ------------------------------------------------------------
   ✅ نفس اتجاه الصفحة المدفوعة
   ✅ بدون @tanstack/react-table
   ✅ استخدام UI الداخلي فقط
   ✅ بحث + فلاتر + أعمدة + تحديد + فرز + صفحات
   ✅ تصدير Excel منظم .xlsx بدل CSV
   ✅ ربط حقيقي مع /api/providers/
   ✅ بدون localhost hardcoded
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
  data?: unknown[];
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
    const data = payload as ProvidersApiResponse;

    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.providers)) return data.providers;
    if (Array.isArray(data.centers)) return data.centers;
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
    name: String(obj.name ?? "-"),
    code: String(obj.code ?? "-"),
    providerType: normalizeProviderType(obj.provider_type),
    status: normalizeStatus(obj.status),
    contactPerson: String(obj.contact_person ?? ""),
    phone: String(obj.phone ?? ""),
    mobile: String(obj.mobile ?? ""),
    email: String(obj.email ?? ""),
    website: String(obj.website ?? ""),
    city: String(obj.city ?? ""),
    area: String(obj.area ?? ""),
    address: String(obj.address ?? ""),
    googleMapsLink: String(obj.google_maps_link ?? ""),
    notes: String(obj.notes ?? ""),
    isFeatured: Boolean(obj.is_featured),
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
    title: isArabic ? "قائمة المراكز" : "Centers List",
    subtitle: isArabic
      ? "إدارة المراكز ومقدمي الخدمة من بيانات حقيقية مع جدول احترافي، فلاتر، أعمدة، وفرز."
      : "Manage centers and providers from live data with a professional table, filters, columns, and sorting.",

    back: isArabic ? "لوحة المراكز" : "Centers Overview",
    createCenter: isArabic ? "إنشاء مركز" : "Create Center",
    refresh: isArabic ? "تحديث" : "Refresh",
    export: isArabic ? "تصدير Excel" : "Export Excel",

    tableTitle: isArabic ? "بيانات المراكز" : "Centers Data",
    tableSubtitle: isArabic
      ? "جدول تشغيلي مرتبط مباشرة بواجهة providers API."
      : "Operational table connected directly to providers API.",

    searchPlaceholder: isArabic
      ? "ابحث باسم المركز أو الكود أو المدينة..."
      : "Search by center name, code, or city...",
    status: isArabic ? "الحالة" : "Status",
    type: isArabic ? "النوع" : "Type",
    columns: isArabic ? "الأعمدة" : "Columns",

    all: isArabic ? "الكل" : "All",
    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
    suspended: isArabic ? "موقوف" : "Suspended",
    draft: isArabic ? "مسودة" : "Draft",
    unknown: isArabic ? "غير محدد" : "Unknown",

    noResults: isArabic ? "لا توجد نتائج." : "No results.",
    loading: isArabic ? "جاري تحميل بيانات المراكز..." : "Loading centers data...",
    selectedRows: isArabic ? "صفوف محددة" : "row(s) selected",
    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",

    actions: isArabic ? "الإجراءات" : "Actions",
    viewDetails: isArabic ? "عرض التفاصيل" : "View details",
    copyCode: isArabic ? "نسخ الكود" : "Copy code",
    copyId: isArabic ? "نسخ الرقم" : "Copy ID",

    apiError: isArabic
      ? "تعذر تحميل قائمة المراكز."
      : "Unable to load centers list.",
    refreshSuccess: isArabic
      ? "تم تحديث قائمة المراكز بنجاح"
      : "Centers list refreshed successfully",
    exportSuccess: isArabic
      ? "تم تجهيز ملف Excel بنجاح"
      : "Excel file prepared successfully",
    copied: isArabic ? "تم النسخ بنجاح" : "Copied successfully",

    excelSummary: isArabic ? "ملخص القائمة" : "List Summary",
    excelFilters: isArabic ? "الفلاتر المستخدمة" : "Applied Filters",
    excelTable: isArabic ? "بيانات المراكز" : "Centers Data",
    generatedAt: isArabic ? "تاريخ التصدير" : "Generated At",
    reportScope: isArabic ? "نطاق التقرير" : "Report Scope",
    currentFilteredData: isArabic
      ? "حسب الفلاتر الحالية"
      : "Current filtered data",
    showing: isArabic ? "المعروض" : "Showing",
    filterSearch: isArabic ? "البحث" : "Search",
    filterStatus: isArabic ? "فلتر الحالة" : "Status Filter",
    filterType: isArabic ? "فلتر النوع" : "Type Filter",

    stats: {
      total: isArabic ? "إجمالي المراكز" : "Total Centers",
      active: isArabic ? "النشطة" : "Active",
      draft: isArabic ? "المسودات" : "Draft",
      stopped: isArabic ? "الموقوفة" : "Stopped",
    },

    table: {
      id: isArabic ? "المعرف" : "ID",
      name: isArabic ? "اسم المركز" : "Center Name",
      code: isArabic ? "الكود" : "Code",
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
   🎨 UI Helpers
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

function formatDateForExcel(value: string, locale: AppLocale) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
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
   ✅ Page
============================================================ */

export default function SystemCentersListPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [centers, setCenters] = useState<Center[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");

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
    actions: true,
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

      const matchesQuery =
        !cleanQuery ||
        center.name.toLowerCase().includes(cleanQuery) ||
        center.code.toLowerCase().includes(cleanQuery) ||
        center.city.toLowerCase().includes(cleanQuery) ||
        center.area.toLowerCase().includes(cleanQuery) ||
        center.phone.toLowerCase().includes(cleanQuery) ||
        center.mobile.toLowerCase().includes(cleanQuery) ||
        center.email.toLowerCase().includes(cleanQuery) ||
        center.contactPerson.toLowerCase().includes(cleanQuery) ||
        center.providerType.toLowerCase().includes(cleanQuery) ||
        center.status.toLowerCase().includes(cleanQuery);

      return matchesStatus && matchesType && matchesQuery;
    });

    return filtered.sort((a, b) => {
      const first = String(a[sortKey] ?? "").toLowerCase();
      const second = String(b[sortKey] ?? "").toLowerCase();

      if (first < second) return sortDirection === "asc" ? -1 : 1;
      if (first > second) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [centers, query, statusFilter, typeFilter, sortKey, sortDirection]);

  const stats = useMemo(() => {
    const total = centers.length;
    const active = centers.filter((item) => item.status === "ACTIVE").length;
    const draft = centers.filter((item) => item.status === "DRAFT").length;
    const inactive = centers.filter((item) => item.status === "INACTIVE").length;
    const suspended = centers.filter(
      (item) => item.status === "SUSPENDED",
    ).length;

    return {
      total,
      active,
      draft,
      inactive,
      suspended,
      stopped: inactive + suspended,
    };
  }, [centers]);

  const pageCount = Math.max(Math.ceil(filteredCenters.length / pageSize), 1);

  const pageRows = useMemo(() => {
    const start = pageIndex * pageSize;
    return filteredCenters.slice(start, start + pageSize);
  }, [filteredCenters, pageIndex]);

  const selectedOnPage = pageRows.filter((row) =>
    selectedIds.includes(row.id),
  ).length;

  const allPageSelected = pageRows.length > 0 && selectedOnPage === pageRows.length;

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

  async function loadCenters(showToast = false) {
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
      const normalized = normalizeApiList(payload).map(normalizeCenter);

      setCenters(normalized);

      if (showToast) {
        toast.success(t.refreshSuccess);
      }
    } catch (error) {
      console.error("Failed to load centers list:", error);
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

    const worksheetData: Array<Array<string | number>> = [
      [t.title],
      [],
      [t.excelSummary, ""],
      [t.generatedAt, generatedAt.toLocaleString(locale === "ar" ? "ar-SA" : "en-US")],
      [t.reportScope, t.currentFilteredData],
      [t.showing, `${filteredCenters.length} / ${centers.length}`],
      [t.stats.total, stats.total],
      [t.stats.active, stats.active],
      [t.stats.draft, stats.draft],
      [t.stats.stopped, stats.stopped],
      [],
      [t.excelFilters, ""],
      [t.filterSearch, query || t.all],
      [t.filterStatus, statusLabel],
      [t.filterType, typeLabel],
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
        center.isFeatured ? (isArabic ? "نعم" : "Yes") : (isArabic ? "لا" : "No"),
        center.address || "-",
        formatDateForExcel(center.createdAt, locale),
        formatDateForExcel(center.updatedAt, locale),
      ]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 15 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 15 } },
      { s: { r: 11, c: 0 }, e: { r: 11, c: 15 } },
      { s: { r: 16, c: 0 }, e: { r: 16, c: 15 } },
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
      ref: `A18:P${Math.max(18 + filteredCenters.length, 18)}`,
    };

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      safeSheetName(isArabic ? "قائمة المراكز" : "Centers List"),
    );

    XLSX.writeFile(
      workbook,
      `primey-care-centers-list-${generatedAt.toISOString().slice(0, 10)}.xlsx`,
      {
        bookType: "xlsx",
        compression: true,
      },
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
    loadCenters(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useEffect(() => {
    setPageIndex(0);
    setSelectedIds([]);
  }, [query, statusFilter, typeFilter]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              /system/centers/list
            </Badge>
            <Badge className="rounded-full">
              {isArabic ? "بيانات حقيقية" : "Live Data"}
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

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadCenters(true)}
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

          <Link href="/system/centers/create">
            <Button className="h-10 w-full rounded-xl sm:w-auto">
              <PlusCircle className="h-4 w-4" />
              <span>{t.createCenter}</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: t.stats.total,
            value: stats.total,
            percent: 100,
            icon: Building2,
          },
          {
            label: t.stats.active,
            value: stats.active,
            percent: calculatePercent(stats.active, stats.total),
            icon: BadgeCheck,
          },
          {
            label: t.stats.draft,
            value: stats.draft,
            percent: calculatePercent(stats.draft, stats.total),
            icon: FileText,
          },
          {
            label: t.stats.stopped,
            value: stats.stopped,
            percent: calculatePercent(stats.stopped, stats.total),
            icon: ShieldCheck,
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.label} className="rounded-2xl border bg-card shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-2xl font-bold">
                      {isLoading ? "..." : item.value}
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
                    {item.percent}%
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

      {/* Table */}
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold">{t.tableTitle}</CardTitle>
          <CardDescription>{t.tableSubtitle}</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="w-full space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
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
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allPageSelected}
                        onCheckedChange={toggleAllPageRows}
                        aria-label="Select all"
                      />
                    </TableHead>

                    {visibleColumns.name ? (
                      <TableHead>
                        <Button
                          className="-ms-3"
                          variant="ghost"
                          onClick={() => toggleSort("name")}
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
                          onClick={() => toggleSort("code")}
                        >
                          {t.table.code}
                          <ArrowDownUp className="h-3 w-3" />
                        </Button>
                      </TableHead>
                    ) : null}

                    {visibleColumns.providerType ? (
                      <TableHead>
                        <Button
                          className="-ms-3"
                          variant="ghost"
                          onClick={() => toggleSort("providerType")}
                        >
                          {t.table.providerType}
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
                      <TableCell colSpan={9} className="h-28">
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
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(center.id)}
                            onCheckedChange={() => toggleRow(center.id)}
                            aria-label="Select row"
                          />
                        </TableCell>

                        {visibleColumns.name ? (
                          <TableCell>
                            <div className="flex min-w-[240px] items-center gap-4">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-muted">
                                {center.providerType === "HOSPITAL" ? (
                                  <Stethoscope className="h-5 w-5" />
                                ) : (
                                  <Building2 className="h-5 w-5" />
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="truncate font-medium">
                                    {center.name}
                                  </span>

                                  {center.isFeatured ? (
                                    <Star className="size-4 fill-orange-400 text-orange-400" />
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
                              <MapPin className="text-muted-foreground h-3.5 w-3.5" />
                              <span>{center.city || center.area || "-"}</span>
                            </div>
                          </TableCell>
                        ) : null}

                        {visibleColumns.contact ? (
                          <TableCell>
                            <div className="flex min-w-[130px] items-center gap-2">
                              <Phone className="text-muted-foreground h-3.5 w-3.5" />
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
                                  <Link href={`/system/centers/${center.id}`}>
                                    <Eye className="h-4 w-4" />
                                    {t.viewDetails}
                                  </Link>
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => {
                                    navigator.clipboard.writeText(String(center.code));
                                    toast.success(t.copied);
                                  }}
                                >
                                  {t.copyCode}
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => {
                                    navigator.clipboard.writeText(String(center.id));
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
                      <TableCell colSpan={9} className="h-28 text-center">
                        {t.noResults}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <div className="text-muted-foreground flex-1 text-sm">
                {selectedIds.length} / {filteredCenters.length} {t.selectedRows}
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