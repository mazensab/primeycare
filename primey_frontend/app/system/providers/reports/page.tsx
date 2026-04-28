"use client";

/* ============================================================
   📂 app/system/providers/reports/page.tsx
   🧠 Primey Care | Providers Reports
   ------------------------------------------------------------
   ✅ المسار: /system/providers/reports
   ✅ الإصدار: v1.0.0
   ✅ العمل: تقارير مقدمي الخدمة
   ✅ API: GET /api/providers/?page_size=500
   ✅ متوافق مع:
      - /system/providers
      - /system/providers/list
      - /system/providers/create
      - /system/providers/[id]
   ------------------------------------------------------------
   تحسينات هذا الإصدار:
   - توثيق مختصر أعلى الملف
   - دعم Excel منظم .xlsx للتقرير الحالي أو الصفوف المحددة
   - دعم طباعة Web PDF للقسم المطلوب فقط
   - دعم عربي / إنجليزي عبر primey-locale
   - الأرقام دائمًا بالإنجليزي
   - استخدام sonner للتنبيهات
   - استخدام UI الداخلي فقط
   - بدون localhost hardcoded
   - الحفاظ على التصميم السابق بدون كسر الواجهة
============================================================ */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  FilterIcon,
  Loader2,
  MapPin,
  Phone,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  Star,
  Stethoscope,
  Users,
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

type Provider = {
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
  email: boolean;
  status: boolean;
  featured: boolean;
};

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

function normalizeProvider(item: unknown): Provider {
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
    pageTitle: isArabic ? "تقارير مقدمي الخدمة" : "Providers Reports",
    pageSubtitle: isArabic
      ? "تحليل مقدمي الخدمة حسب الحالة، النوع، المدينة، التمييز، والجاهزية التشغيلية."
      : "Analyze providers by status, type, city, featured state, and operational readiness.",

    back: isArabic ? "رجوع" : "Back",
    dashboard: isArabic ? "لوحة مقدمي الخدمة" : "Providers Dashboard",
    list: isArabic ? "قائمة مقدمي الخدمة" : "Providers List",
    refresh: isArabic ? "تحديث" : "Refresh",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",

    overviewTitle: isArabic ? "ملخص مقدمي الخدمة" : "Providers Overview",
    overviewDesc: isArabic
      ? "مؤشرات سريعة مستخرجة من بيانات مقدمي الخدمة الحالية."
      : "Quick indicators extracted from the current providers data.",

    filtersTitle: isArabic ? "الفلاتر والتحكم" : "Filters & Controls",
    filtersDesc: isArabic
      ? "يمكنك تصفية التقرير ثم تصدير أو طباعة النتائج الحالية فقط."
      : "Filter the report, then export or print the current results only.",

    reportTableTitle: isArabic
      ? "جدول تقرير مقدمي الخدمة"
      : "Providers Report Table",
    reportTableDesc: isArabic
      ? "هذا الجدول هو الجزء الذي يتم تصديره وطباعته فقط."
      : "Only this table section is exported and printed.",

    search: isArabic ? "بحث" : "Search",
    searchPlaceholder: isArabic
      ? "ابحث بالاسم، الكود، المدينة، الجوال..."
      : "Search by name, code, city, phone...",

    statusFilter: isArabic ? "الحالة" : "Status",
    typeFilter: isArabic ? "النوع" : "Type",
    featuredFilter: isArabic ? "التمييز" : "Featured",
    sort: isArabic ? "فرز" : "Sort",
    columns: isArabic ? "الأعمدة" : "Columns",

    all: isArabic ? "الكل" : "All",
    featuredOnly: isArabic ? "المميزون فقط" : "Featured Only",
    normalOnly: isArabic ? "غير المميزين" : "Normal Only",

    total: isArabic ? "الإجمالي" : "Total",
    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
    suspended: isArabic ? "موقوف" : "Suspended",
    draft: isArabic ? "مسودة" : "Draft",
    unknown: isArabic ? "غير محدد" : "Unknown",
    featured: isArabic ? "مميز" : "Featured",
    cities: isArabic ? "المدن" : "Cities",

    sortByName: isArabic ? "الاسم" : "Name",
    sortByCode: isArabic ? "الكود" : "Code",
    sortByCity: isArabic ? "المدينة" : "City",
    sortByStatus: isArabic ? "الحالة" : "Status",
    sortByType: isArabic ? "النوع" : "Type",
    asc: isArabic ? "تصاعدي" : "Ascending",
    desc: isArabic ? "تنازلي" : "Descending",

    loading: isArabic
      ? "جاري تحميل تقرير مقدمي الخدمة..."
      : "Loading providers report...",
    emptyTitle: isArabic
      ? "لا توجد بيانات مطابقة"
      : "No matching data",
    emptyText: isArabic
      ? "غيّر الفلاتر أو البحث لعرض نتائج أخرى."
      : "Change filters or search to view other results.",
    apiError: isArabic
      ? "تعذر تحميل تقرير مقدمي الخدمة."
      : "Unable to load providers report.",
    refreshSuccess: isArabic
      ? "تم تحديث تقرير مقدمي الخدمة بنجاح"
      : "Providers report refreshed successfully",
    exportSuccess: isArabic
      ? "تم تصدير تقرير مقدمي الخدمة بنجاح"
      : "Providers report exported successfully",
    printError: isArabic
      ? "تعذر فتح نافذة الطباعة."
      : "Unable to open print window.",

    selected: isArabic ? "المحدد" : "Selected",
    showing: isArabic ? "المعروض" : "Showing",

    table: {
      select: isArabic ? "تحديد" : "Select",
      code: isArabic ? "الكود" : "Code",
      name: isArabic ? "اسم مقدم الخدمة" : "Provider Name",
      providerType: isArabic ? "النوع" : "Type",
      city: isArabic ? "المدينة" : "City",
      contact: isArabic ? "التواصل" : "Contact",
      email: isArabic ? "البريد" : "Email",
      status: isArabic ? "الحالة" : "Status",
      featured: isArabic ? "مميز" : "Featured",
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

    statusLabels: {
      ACTIVE: isArabic ? "نشط" : "Active",
      INACTIVE: isArabic ? "غير نشط" : "Inactive",
      SUSPENDED: isArabic ? "موقوف" : "Suspended",
      DRAFT: isArabic ? "مسودة" : "Draft",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<ProviderStatus, string>,
  };
}

/* ============================================================
   UI Helpers
============================================================ */

function statusBadge(status: ProviderStatus, locale: AppLocale) {
  const isArabic = locale === "ar";

  if (status === "ACTIVE") {
    return (
      <Badge className="rounded-full px-3 py-1">
        {isArabic ? "نشط" : "Active"}
      </Badge>
    );
  }

  if (status === "DRAFT") {
    return (
      <Badge variant="secondary" className="rounded-full px-3 py-1">
        {isArabic ? "مسودة" : "Draft"}
      </Badge>
    );
  }

  if (status === "SUSPENDED") {
    return (
      <Badge variant="destructive" className="rounded-full px-3 py-1">
        {isArabic ? "موقوف" : "Suspended"}
      </Badge>
    );
  }

  if (status === "INACTIVE") {
    return (
      <Badge variant="outline" className="rounded-full px-3 py-1">
        {isArabic ? "غير نشط" : "Inactive"}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="rounded-full px-3 py-1">
      {isArabic ? "غير محدد" : "Unknown"}
    </Badge>
  );
}

function getSortValue(provider: Provider, key: SortKey): string {
  if (key === "name") return provider.name;
  if (key === "code") return provider.code;
  if (key === "providerType") return provider.providerType;
  if (key === "city") return provider.city || provider.area;
  if (key === "status") return provider.status;

  return provider.name;
}

function formatDateForExport(value: string) {
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ============================================================
   Page
============================================================ */

export default function SystemProvidersReportsPage() {
  const printRef = useRef<HTMLDivElement | null>(null);

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [featuredFilter, setFeaturedFilter] =
    useState<FeaturedFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    code: true,
    name: true,
    providerType: true,
    city: true,
    contact: true,
    email: true,
    status: true,
    featured: true,
  });

  const isArabic = locale === "ar";
  const t = useMemo(() => dictionary(locale), [locale]);

  const syncLocale = useCallback(() => {
    const nextLocale = readLocale();

    setLocale(nextLocale);
    applyDocumentLocale(nextLocale);
  }, []);

  const loadProviders = useCallback(
    async (options?: { silent?: boolean }) => {
      try {
        if (options?.silent) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        const response = await fetch("/api/providers/?page_size=500", {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Providers API failed with status ${response.status}`);
        }

        const payload = (await response.json()) as ProvidersApiResponse;
        const list = normalizeApiList(payload).map(normalizeProvider);

        setProviders(list);
        setSelectedIds(new Set());

        if (options?.silent) {
          toast.success(t.refreshSuccess);
        }
      } catch (error) {
        console.error("Load providers report error:", error);
        toast.error(t.apiError);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [t.apiError, t.refreshSuccess],
  );

  useEffect(() => {
    syncLocale();

    const handleLocaleChange = () => syncLocale();

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "primey-locale") syncLocale();
    };

    window.addEventListener("primey-locale-changed", handleLocaleChange);
    window.addEventListener("storage", handleStorageChange);

    const timer = window.setTimeout(syncLocale, 50);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("primey-locale-changed", handleLocaleChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [syncLocale]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const typeOptions = useMemo(() => {
    const set = new Set<ProviderType>();

    providers.forEach((provider) => {
      if (provider.providerType !== "UNKNOWN") {
        set.add(provider.providerType);
      }
    });

    return Array.from(set);
  }, [providers]);

  const filteredProviders = useMemo(() => {
    const searchValue = query.trim().toLowerCase();

    return providers
      .filter((provider) => {
        if (statusFilter !== "ALL" && provider.status !== statusFilter) {
          return false;
        }

        if (typeFilter !== "ALL" && provider.providerType !== typeFilter) {
          return false;
        }

        if (featuredFilter === "FEATURED" && !provider.isFeatured) {
          return false;
        }

        if (featuredFilter === "NORMAL" && provider.isFeatured) {
          return false;
        }

        if (!searchValue) return true;

        const haystack = [
          provider.name,
          provider.code,
          provider.providerType,
          provider.status,
          provider.city,
          provider.area,
          provider.phone,
          provider.mobile,
          provider.email,
          provider.contactPerson,
          provider.address,
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(searchValue);
      })
      .sort((a, b) => {
        const first = getSortValue(a, sortKey).toLowerCase();
        const second = getSortValue(b, sortKey).toLowerCase();
        const result = first.localeCompare(second);

        return sortDirection === "asc" ? result : result * -1;
      });
  }, [
    providers,
    query,
    statusFilter,
    typeFilter,
    featuredFilter,
    sortKey,
    sortDirection,
  ]);

  const selectedRows = useMemo(() => {
    if (selectedIds.size === 0) return filteredProviders;

    return filteredProviders.filter((provider) =>
      selectedIds.has(String(provider.id)),
    );
  }, [filteredProviders, selectedIds]);

  const stats = useMemo(() => {
    const total = providers.length;
    const filtered = filteredProviders.length;
    const active = filteredProviders.filter(
      (provider) => provider.status === "ACTIVE",
    ).length;
    const suspended = filteredProviders.filter(
      (provider) => provider.status === "SUSPENDED",
    ).length;
    const featured = filteredProviders.filter(
      (provider) => provider.isFeatured,
    ).length;
    const cities = new Set(
      filteredProviders
        .map((provider) => provider.city || provider.area)
        .filter(Boolean),
    ).size;

    return {
      total,
      filtered,
      active,
      suspended,
      featured,
      cities,
      selected: selectedIds.size,
    };
  }, [providers, filteredProviders, selectedIds]);

  const visibleIds = useMemo(
    () => filteredProviders.map((provider) => String(provider.id)),
    [filteredProviders],
  );

  const isAllSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  function toggleAllRows() {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (isAllSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }

      return next;
    });
  }

  function toggleRow(id: number | string) {
    const key = String(id);

    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }

  function exportExcel() {
    if (selectedRows.length === 0) {
      toast.error(t.emptyTitle);
      return;
    }

    const generatedAt = new Date();

    const summaryRows: Array<Array<string | number>> = [
      [t.pageTitle],
      [],
      [t.overviewTitle, ""],
      [t.showing, stats.filtered],
      [t.total, stats.total],
      [t.active, stats.active],
      [t.suspended, stats.suspended],
      [t.featured, stats.featured],
      [t.cities, stats.cities],
      [t.selected, stats.selected],
      [],
      [t.reportTableTitle],
      [
        "#",
        t.table.code,
        t.table.name,
        t.table.providerType,
        t.table.city,
        t.table.contact,
        t.table.email,
        t.table.status,
        t.table.featured,
        "Created At",
        "Updated At",
      ],
      ...selectedRows.map((provider, index) => [
        index + 1,
        provider.code && provider.code !== "-" ? provider.code : `#${provider.id}`,
        provider.name,
        t.typeLabels[provider.providerType],
        provider.city || provider.area || "-",
        provider.mobile || provider.phone || "-",
        provider.email || "-",
        t.statusLabels[provider.status],
        provider.isFeatured ? t.featured : "-",
        formatDateForExport(provider.createdAt),
        formatDateForExport(provider.updatedAt),
      ]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(summaryRows);

    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } },
      { s: { r: 11, c: 0 }, e: { r: 11, c: 10 } },
    ];

    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 18 },
      { wch: 30 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 28 },
      { wch: 16 },
      { wch: 14 },
      { wch: 22 },
      { wch: 22 },
    ];

    worksheet["!autofilter"] = {
      ref: `A13:K${Math.max(13 + selectedRows.length, 13)}`,
    };

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      safeSheetName(locale === "ar" ? "تقرير مقدمي الخدمة" : "Providers Report"),
    );

    XLSX.writeFile(
      workbook,
      `primey-care-providers-report-${generatedAt
        .toISOString()
        .slice(0, 10)}.xlsx`,
      {
        bookType: "xlsx",
        compression: true,
      },
    );

    toast.success(t.exportSuccess);
  }

  function printReport() {
    if (!printRef.current) return;

    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) {
      toast.error(t.printError);
      return;
    }

    const direction = isArabic ? "rtl" : "ltr";
    const content = printRef.current.innerHTML;

    printWindow.document.open();
    printWindow.document.write(`
      <html lang="${locale}" dir="${direction}">
        <head>
          <title>${escapeHtml(t.pageTitle)}</title>
          <meta charset="UTF-8" />
          <style>
            body {
              font-family: Arial, Tahoma, sans-serif;
              padding: 24px;
              direction: ${direction};
              color: #111827;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 16px;
            }

            th,
            td {
              border: 1px solid #d1d5db;
              padding: 10px;
              font-size: 12px;
              text-align: ${isArabic ? "right" : "left"};
            }

            th {
              background: #f3f4f6;
              font-weight: 700;
            }

            .print-title {
              font-size: 22px;
              font-weight: 700;
              margin-bottom: 4px;
            }

            .print-subtitle {
              color: #6b7280;
              margin-bottom: 16px;
            }

            .print-summary {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              margin-bottom: 16px;
            }

            .print-card {
              border: 1px solid #d1d5db;
              border-radius: 12px;
              padding: 12px;
            }

            button,
            svg,
            input[type="checkbox"] {
              display: none !important;
            }

            @media print {
              body {
                padding: 12px;
              }
            }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  const summaryCards = [
    {
      title: t.showing,
      value: formatNumber(stats.filtered),
      icon: Building2,
      helper: `${formatNumber(stats.total)} ${t.total}`,
    },
    {
      title: t.active,
      value: formatNumber(stats.active),
      icon: BadgeCheck,
      helper: stats.filtered
        ? `${formatNumber(Math.round((stats.active / stats.filtered) * 100))}%`
        : "0%",
    },
    {
      title: t.featured,
      value: formatNumber(stats.featured),
      icon: Star,
      helper: stats.filtered
        ? `${formatNumber(Math.round((stats.featured / stats.filtered) * 100))}%`
        : "0%",
    },
    {
      title: t.cities,
      value: formatNumber(stats.cities),
      icon: MapPin,
      helper: isArabic ? "نطاق التغطية" : "Coverage",
    },
  ];

  const miniReports = [
    {
      title: isArabic ? "الجاهزية التشغيلية" : "Operational Readiness",
      value: formatNumber(stats.active),
      description: isArabic
        ? "مقدمو الخدمة النشطون ضمن التقرير الحالي."
        : "Active providers in the current report.",
      icon: Activity,
    },
    {
      title: isArabic ? "المميزون" : "Featured Providers",
      value: formatNumber(stats.featured),
      description: isArabic
        ? "مقدمو الخدمة الذين لديهم أولوية عرض."
        : "Providers marked with display priority.",
      icon: Star,
    },
    {
      title: isArabic ? "تحتاج مراجعة" : "Needs Review",
      value: formatNumber(stats.suspended),
      description: isArabic
        ? "مقدمو الخدمة الموقوفون ضمن نتائج التقرير."
        : "Suspended providers inside report results.",
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="order-2 flex flex-wrap items-center gap-2 lg:order-1">
          <Link href="/system/providers">
            <Button variant="outline" className="rounded-xl">
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => loadProviders({ silent: true })}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refresh}</span>
          </Button>

          <Button
            variant="outline"
            className="rounded-xl"
            onClick={exportExcel}
            disabled={isLoading || selectedRows.length === 0}
          >
            <Download className="h-4 w-4" />
            <span>{t.exportExcel}</span>
          </Button>

          <Button
            variant="outline"
            className="rounded-xl"
            onClick={printReport}
            disabled={isLoading}
          >
            <Printer className="h-4 w-4" />
            <span>{t.print}</span>
          </Button>
        </div>

        <div className="order-1 max-w-3xl space-y-2 text-right lg:order-2">
          <div className="flex justify-end gap-2">
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {t.dashboard}
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              {t.list}
            </Badge>
          </div>

          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {t.pageTitle}
          </h1>

          <p className="text-sm leading-7 text-muted-foreground md:text-base">
            {t.pageSubtitle}
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;

          return (
            <Card key={card.title} className="rounded-2xl border bg-card shadow-sm">
              <CardContent className="flex items-center justify-between p-5">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <p className="mt-1 text-2xl font-bold">
                    {isLoading ? "..." : card.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {card.helper}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters + Mini Reports */}
      <div className="grid gap-6 xl:grid-cols-[0.72fr_1fr]">
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader className="text-right">
            <CardTitle className="flex items-center justify-end gap-2 text-base">
              {t.filtersTitle}
              <FilterIcon className="h-5 w-5 text-primary" />
            </CardTitle>
            <CardDescription>{t.filtersDesc}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="relative">
              <Search
                className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${
                  isArabic ? "right-3" : "left-3"
                }`}
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.searchPlaceholder}
                className={`h-11 rounded-xl ${isArabic ? "pr-10" : "pl-10"}`}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="justify-between rounded-xl">
                    <FilterIcon className="h-4 w-4" />
                    <span>{t.statusFilter}</span>
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="start" className="w-52">
                  {(
                    [
                      "ALL",
                      "ACTIVE",
                      "INACTIVE",
                      "SUSPENDED",
                      "DRAFT",
                      "UNKNOWN",
                    ] as StatusFilter[]
                  ).map((status) => (
                    <DropdownMenuCheckboxItem
                      key={status}
                      checked={statusFilter === status}
                      onCheckedChange={() => setStatusFilter(status)}
                    >
                      {status === "ALL" ? t.all : t.statusLabels[status]}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="justify-between rounded-xl">
                    <Building2 className="h-4 w-4" />
                    <span>{t.typeFilter}</span>
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuCheckboxItem
                    checked={typeFilter === "ALL"}
                    onCheckedChange={() => setTypeFilter("ALL")}
                  >
                    {t.all}
                  </DropdownMenuCheckboxItem>

                  {typeOptions.map((type) => (
                    <DropdownMenuCheckboxItem
                      key={type}
                      checked={typeFilter === type}
                      onCheckedChange={() => setTypeFilter(type)}
                    >
                      {t.typeLabels[type]}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="justify-between rounded-xl">
                    <Star className="h-4 w-4" />
                    <span>{t.featuredFilter}</span>
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="start" className="w-52">
                  {(
                    [
                      ["ALL", t.all],
                      ["FEATURED", t.featuredOnly],
                      ["NORMAL", t.normalOnly],
                    ] as Array<[FeaturedFilter, string]>
                  ).map(([value, label]) => (
                    <DropdownMenuCheckboxItem
                      key={value}
                      checked={featuredFilter === value}
                      onCheckedChange={() => setFeaturedFilter(value)}
                    >
                      {label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="justify-between rounded-xl">
                    <ArrowDownUp className="h-4 w-4" />
                    <span>{t.sort}</span>
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="start" className="w-56">
                  {(
                    [
                      ["name", t.sortByName],
                      ["code", t.sortByCode],
                      ["city", t.sortByCity],
                      ["status", t.sortByStatus],
                      ["providerType", t.sortByType],
                    ] as Array<[SortKey, string]>
                  ).map(([key, label]) => (
                    <DropdownMenuCheckboxItem
                      key={key}
                      checked={sortKey === key}
                      onCheckedChange={() => setSortKey(key)}
                    >
                      {label}
                    </DropdownMenuCheckboxItem>
                  ))}

                  <DropdownMenuCheckboxItem
                    checked={sortDirection === "asc"}
                    onCheckedChange={() => setSortDirection("asc")}
                  >
                    {t.asc}
                  </DropdownMenuCheckboxItem>

                  <DropdownMenuCheckboxItem
                    checked={sortDirection === "desc"}
                    onCheckedChange={() => setSortDirection("desc")}
                  >
                    {t.desc}
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          {miniReports.map((item) => {
            const Icon = item.icon;

            return (
              <Card key={item.title} className="rounded-2xl border bg-card shadow-sm">
                <CardHeader className="space-y-3 text-right">
                  <div className="ms-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{item.title}</CardTitle>
                    <CardDescription className="mt-2 leading-6">
                      {item.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="text-right">
                  <p className="text-3xl font-bold">
                    {isLoading ? "..." : item.value}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Report Table */}
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="order-2 flex flex-wrap items-center gap-2 lg:order-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="rounded-xl">
                    <ColumnsIcon className="h-4 w-4" />
                    <span>{t.columns}</span>
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="start" className="w-56">
                  {(
                    [
                      ["code", t.table.code],
                      ["name", t.table.name],
                      ["providerType", t.table.providerType],
                      ["city", t.table.city],
                      ["contact", t.table.contact],
                      ["email", t.table.email],
                      ["status", t.table.status],
                      ["featured", t.table.featured],
                    ] as Array<[keyof VisibleColumns, string]>
                  ).map(([key, label]) => (
                    <DropdownMenuCheckboxItem
                      key={key}
                      checked={visibleColumns[key]}
                      onCheckedChange={(checked) =>
                        setVisibleColumns((prev) => ({
                          ...prev,
                          [key]: Boolean(checked),
                        }))
                      }
                    >
                      {label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Badge variant="secondary" className="rounded-full px-3 py-2">
                {t.showing}: {formatNumber(stats.filtered)}
              </Badge>

              <Badge variant="outline" className="rounded-full px-3 py-2">
                {t.selected}: {formatNumber(stats.selected)}
              </Badge>
            </div>

            <div className="order-1 space-y-1 text-right lg:order-2">
              <CardTitle>{t.reportTableTitle}</CardTitle>
              <CardDescription>{t.reportTableDesc}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div ref={printRef}>
            <div className="hidden print:block">
              <div className="print-title">{t.pageTitle}</div>
              <div className="print-subtitle">{t.pageSubtitle}</div>

              <div className="print-summary">
                <div className="print-card">
                  {t.showing}: {formatNumber(stats.filtered)}
                </div>
                <div className="print-card">
                  {t.active}: {formatNumber(stats.active)}
                </div>
                <div className="print-card">
                  {t.featured}: {formatNumber(stats.featured)}
                </div>
                <div className="print-card">
                  {t.cities}: {formatNumber(stats.cities)}
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={toggleAllRows}
                        aria-label={t.table.select}
                      />
                    </TableHead>

                    {visibleColumns.code ? (
                      <TableHead>{t.table.code}</TableHead>
                    ) : null}

                    {visibleColumns.name ? (
                      <TableHead>{t.table.name}</TableHead>
                    ) : null}

                    {visibleColumns.providerType ? (
                      <TableHead>{t.table.providerType}</TableHead>
                    ) : null}

                    {visibleColumns.city ? (
                      <TableHead>{t.table.city}</TableHead>
                    ) : null}

                    {visibleColumns.contact ? (
                      <TableHead>{t.table.contact}</TableHead>
                    ) : null}

                    {visibleColumns.email ? (
                      <TableHead>{t.table.email}</TableHead>
                    ) : null}

                    {visibleColumns.status ? (
                      <TableHead>{t.table.status}</TableHead>
                    ) : null}

                    {visibleColumns.featured ? (
                      <TableHead>{t.table.featured}</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>{t.loading}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredProviders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <div className="py-14 text-center">
                          <p className="font-semibold">{t.emptyTitle}</p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {t.emptyText}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProviders.map((provider) => (
                      <TableRow key={provider.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(String(provider.id))}
                            onCheckedChange={() => toggleRow(provider.id)}
                            aria-label={t.table.select}
                          />
                        </TableCell>

                        {visibleColumns.code ? (
                          <TableCell className="font-medium">
                            {provider.code && provider.code !== "-"
                              ? provider.code
                              : `#${provider.id}`}
                          </TableCell>
                        ) : null}

                        {visibleColumns.name ? (
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <div className="min-w-0 text-right">
                                <p className="truncate font-medium">
                                  {provider.name}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {provider.contactPerson ||
                                    provider.address ||
                                    "-"}
                                </p>
                              </div>

                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                                <Building2 className="h-4 w-4" />
                              </div>
                            </div>
                          </TableCell>
                        ) : null}

                        {visibleColumns.providerType ? (
                          <TableCell>
                            <Badge variant="secondary" className="rounded-full">
                              {t.typeLabels[provider.providerType]}
                            </Badge>
                          </TableCell>
                        ) : null}

                        {visibleColumns.city ? (
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{provider.city || provider.area || "-"}</span>
                            </div>
                          </TableCell>
                        ) : null}

                        {visibleColumns.contact ? (
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>
                                {provider.mobile || provider.phone || "-"}
                              </span>
                            </div>
                          </TableCell>
                        ) : null}

                        {visibleColumns.email ? (
                          <TableCell>{provider.email || "-"}</TableCell>
                        ) : null}

                        {visibleColumns.status ? (
                          <TableCell>{statusBadge(provider.status, locale)}</TableCell>
                        ) : null}

                        {visibleColumns.featured ? (
                          <TableCell>
                            {provider.isFeatured ? (
                              <Badge className="rounded-full">
                                <Star className="h-3.5 w-3.5" />
                                {t.featured}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="rounded-full">
                                -
                              </Badge>
                            )}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Insights */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader className="space-y-3 text-right">
            <div className="ms-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">
                {isArabic ? "تحليل الأنواع" : "Type Analysis"}
              </CardTitle>
              <CardDescription className="mt-2 leading-6">
                {isArabic
                  ? "يساعدك التقرير على معرفة توزيع المستشفيات والمراكز والعيادات والصيدليات."
                  : "The report helps identify distribution across hospitals, centers, clinics, and pharmacies."}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader className="space-y-3 text-right">
            <div className="ms-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">
                {isArabic ? "التغطية الجغرافية" : "Geographic Coverage"}
              </CardTitle>
              <CardDescription className="mt-2 leading-6">
                {isArabic
                  ? "قياس عدد المدن والمناطق التي يغطيها مقدمو الخدمة داخل النظام."
                  : "Measure how many cities and areas are covered by providers inside the system."}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader className="space-y-3 text-right">
            <div className="ms-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">
                {isArabic ? "جاهزية التشغيل" : "Operational Readiness"}
              </CardTitle>
              <CardDescription className="mt-2 leading-6">
                {isArabic
                  ? "متابعة الحالات النشطة والموقوفة لتحديد جاهزية شبكة مقدمي الخدمة."
                  : "Track active and suspended statuses to evaluate provider network readiness."}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}