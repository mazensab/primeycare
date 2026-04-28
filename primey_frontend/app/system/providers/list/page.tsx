"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  ArrowLeft,
  BadgeCheck,
  Building2,
  Columns3,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  Star,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
   📂 app/system/providers/list/page.tsx
   🧠 Primey Care | System Providers List
   ------------------------------------------------------------
   ✅ نفس نمط قائمة المراكز
   ✅ بحث + فلاتر + فرز + أعمدة + تحديد + صفحات
   ✅ تصدير Excel منظم للقائمة فقط
   ✅ طباعة Web PDF للقائمة فقط
   ✅ ربط حقيقي مع /api/providers/
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ الأرقام دائمًا بالإنجليزي
   ✅ بدون hardcoded localhost
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

type SortKey = "name" | "code" | "city" | "status" | "type";
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

type ColumnKey =
  | "select"
  | "code"
  | "name"
  | "type"
  | "city"
  | "contact"
  | "email"
  | "status"
  | "featured"
  | "action";

type ColumnState = Record<ColumnKey, boolean>;

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

function formatNumber(value: number | string): string {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return "0";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(numericValue);
}

/* ============================================================
   🔁 API Normalizers
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
      obj.provider_type ?? obj.type ?? obj.category
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
   📚 Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    pageTitle: isArabic ? "قائمة مقدمي الخدمة" : "Providers List",
    pageSubtitle: isArabic
      ? "استعراض وإدارة مقدمي الخدمة مع البحث والتصفية والفرز والتصدير والطباعة."
      : "Browse and manage providers with search, filters, sorting, export, and print.",

    back: isArabic ? "رجوع" : "Back",
    dashboard: isArabic ? "لوحة مقدمي الخدمة" : "Providers Dashboard",
    create: isArabic ? "إنشاء مقدم خدمة" : "Create Provider",
    reports: isArabic ? "التقارير" : "Reports",
    refresh: isArabic ? "تحديث" : "Refresh",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة" : "Print",

    searchPlaceholder: isArabic
      ? "ابحث بالاسم، الكود، المدينة، الجوال..."
      : "Search by name, code, city, phone...",
    statusFilter: isArabic ? "فلتر الحالة" : "Status Filter",
    typeFilter: isArabic ? "فلتر النوع" : "Type Filter",
    sort: isArabic ? "فرز" : "Sort",
    columns: isArabic ? "الأعمدة" : "Columns",

    all: isArabic ? "الكل" : "All",
    total: isArabic ? "الإجمالي" : "Total",
    selected: isArabic ? "المحدد" : "Selected",
    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
    suspended: isArabic ? "موقوف" : "Suspended",
    draft: isArabic ? "مسودة" : "Draft",
    unknown: isArabic ? "غير محدد" : "Unknown",

    newest: isArabic ? "الأحدث" : "Newest",
    sortByName: isArabic ? "الاسم" : "Name",
    sortByCode: isArabic ? "الكود" : "Code",
    sortByCity: isArabic ? "المدينة" : "City",
    sortByStatus: isArabic ? "الحالة" : "Status",
    sortByType: isArabic ? "النوع" : "Type",

    asc: isArabic ? "تصاعدي" : "Ascending",
    desc: isArabic ? "تنازلي" : "Descending",

    tableTitle: isArabic ? "جدول مقدمي الخدمة" : "Providers Table",
    tableDescription: isArabic
      ? "القائمة الحالية بعد تطبيق البحث والفلاتر."
      : "Current list after applying search and filters.",

    emptyTitle: isArabic
      ? "لا يوجد مقدمو خدمة مطابقون"
      : "No matching providers",
    emptyText: isArabic
      ? "جرّب تغيير البحث أو الفلاتر، أو أضف مقدم خدمة جديد."
      : "Try changing search or filters, or create a new provider.",
    loading: isArabic
      ? "جاري تحميل مقدمي الخدمة..."
      : "Loading providers...",
    apiError: isArabic
      ? "تعذر تحميل بيانات مقدمي الخدمة."
      : "Unable to load providers data.",
    refreshSuccess: isArabic
      ? "تم تحديث قائمة مقدمي الخدمة بنجاح"
      : "Providers list refreshed successfully",
    exportSuccess: isArabic
      ? "تم تجهيز ملف Excel بنجاح"
      : "Excel file has been generated successfully",

    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",
    page: isArabic ? "صفحة" : "Page",
    of: isArabic ? "من" : "of",

    table: {
      select: isArabic ? "تحديد" : "Select",
      code: isArabic ? "الرقم" : "Code",
      name: isArabic ? "اسم مقدم الخدمة" : "Provider Name",
      type: isArabic ? "النوع" : "Type",
      city: isArabic ? "المدينة" : "City",
      contact: isArabic ? "التواصل" : "Contact",
      email: isArabic ? "البريد" : "Email",
      status: isArabic ? "الحالة" : "Status",
      featured: isArabic ? "مميز" : "Featured",
      action: isArabic ? "الإجراء" : "Action",
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
  if (key === "city") return provider.city || provider.area;
  if (key === "status") return provider.status;
  if (key === "type") return provider.providerType;

  return provider.name;
}

function buildExcelHtml({
  title,
  locale,
  rows,
  t,
}: {
  title: string;
  locale: AppLocale;
  rows: Provider[];
  t: ReturnType<typeof dictionary>;
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";

  const escapeCell = (value: string | number | boolean) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const tableRows = rows
    .map((provider, index) => {
      return `
        <tr>
          <td>${escapeCell(index + 1)}</td>
          <td>${escapeCell(provider.code && provider.code !== "-" ? provider.code : `#${provider.id}`)}</td>
          <td>${escapeCell(provider.name)}</td>
          <td>${escapeCell(t.typeLabels[provider.providerType])}</td>
          <td>${escapeCell(provider.city || provider.area || "-")}</td>
          <td>${escapeCell(provider.mobile || provider.phone || "-")}</td>
          <td>${escapeCell(provider.email || "-")}</td>
          <td>${escapeCell(provider.status)}</td>
          <td>${escapeCell(provider.isFeatured ? "YES" : "NO")}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <html dir="${direction}">
      <head>
        <meta charset="UTF-8" />
        <style>
          body {
            font-family: Arial, sans-serif;
            direction: ${direction};
          }
          table {
            border-collapse: collapse;
            width: 100%;
          }
          th {
            background: #f3f4f6;
            font-weight: 700;
          }
          th, td {
            border: 1px solid #d1d5db;
            padding: 10px;
            text-align: ${locale === "ar" ? "right" : "left"};
          }
          .title {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 12px;
          }
        </style>
      </head>
      <body>
        <div class="title">${escapeCell(title)}</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${escapeCell(t.table.code)}</th>
              <th>${escapeCell(t.table.name)}</th>
              <th>${escapeCell(t.table.type)}</th>
              <th>${escapeCell(t.table.city)}</th>
              <th>${escapeCell(t.table.contact)}</th>
              <th>${escapeCell(t.table.email)}</th>
              <th>${escapeCell(t.table.status)}</th>
              <th>${escapeCell(t.table.featured)}</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

/* ============================================================
   🧩 Page
============================================================ */

export default function SystemProvidersListPage() {
  const printRef = useRef<HTMLDivElement | null>(null);

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProviderStatus | "ALL">(
    "ALL"
  );
  const [typeFilter, setTypeFilter] = useState<ProviderType | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [columns, setColumns] = useState<ColumnState>({
    select: true,
    code: true,
    name: true,
    type: true,
    city: true,
    contact: true,
    email: true,
    status: true,
    featured: true,
    action: true,
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
        console.error("Load providers list error:", error);
        toast.error(t.apiError);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [t.apiError, t.refreshSuccess]
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

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, typeFilter, sortKey, sortDirection]);

  const stats = useMemo(() => {
    return {
      total: providers.length,
      active: providers.filter((item) => item.status === "ACTIVE").length,
      suspended: providers.filter((item) => item.status === "SUSPENDED").length,
      selected: selectedIds.size,
    };
  }, [providers, selectedIds]);

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
  }, [providers, query, statusFilter, typeFilter, sortKey, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(filteredProviders.length / pageSize));

  const currentPageRows = useMemo(() => {
    const safePage = Math.min(page, pageCount);
    const start = (safePage - 1) * pageSize;

    return filteredProviders.slice(start, start + pageSize);
  }, [filteredProviders, page, pageCount, pageSize]);

  const visibleCurrentPageIds = useMemo(
    () => currentPageRows.map((provider) => String(provider.id)),
    [currentPageRows]
  );

  const isAllCurrentPageSelected =
    visibleCurrentPageIds.length > 0 &&
    visibleCurrentPageIds.every((id) => selectedIds.has(id));

  const typeOptions = useMemo(() => {
    const values = new Set<ProviderType>();

    providers.forEach((provider) => {
      if (provider.providerType !== "UNKNOWN") {
        values.add(provider.providerType);
      }
    });

    return Array.from(values);
  }, [providers]);

  function toggleCurrentPageSelection() {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (isAllCurrentPageSelected) {
        visibleCurrentPageIds.forEach((id) => next.delete(id));
      } else {
        visibleCurrentPageIds.forEach((id) => next.add(id));
      }

      return next;
    });
  }

  function toggleRowSelection(id: number | string) {
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

  function handleExportExcel() {
    const rows =
      selectedIds.size > 0
        ? filteredProviders.filter((provider) =>
            selectedIds.has(String(provider.id))
          )
        : filteredProviders;

    if (rows.length === 0) {
      toast.error(t.emptyTitle);
      return;
    }

    const html = buildExcelHtml({
      title: t.pageTitle,
      locale,
      rows,
      t,
    });

    const blob = new Blob(["\ufeff", html], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `primey-care-providers-${new Date()
      .toISOString()
      .slice(0, 10)}.xls`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(t.exportSuccess);
  }

  function handlePrint() {
    if (!printRef.current) return;

    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) {
      toast.error(
        isArabic
          ? "تعذر فتح نافذة الطباعة من المتصفح."
          : "Unable to open print window."
      );
      return;
    }

    const direction = isArabic ? "rtl" : "ltr";
    const content = printRef.current.innerHTML;

    printWindow.document.write(`
      <html lang="${locale}" dir="${direction}">
        <head>
          <title>${t.pageTitle}</title>
          <meta charset="UTF-8" />
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 24px;
              direction: ${direction};
              color: #111827;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 16px;
            }
            th, td {
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

  const columnLabels: Record<ColumnKey, string> = {
    select: t.table.select,
    code: t.table.code,
    name: t.table.name,
    type: t.table.type,
    city: t.table.city,
    contact: t.table.contact,
    email: t.table.email,
    status: t.table.status,
    featured: t.table.featured,
    action: t.table.action,
  };

  return (
    <div className="space-y-6">
      {/* =====================================================
          Page Header
      ====================================================== */}
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
            onClick={handleExportExcel}
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>{t.exportExcel}</span>
          </Button>

          <Button variant="outline" className="rounded-xl" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            <span>{t.print}</span>
          </Button>

          <Link href="/system/providers/create">
            <Button className="rounded-xl">
              <Plus className="h-4 w-4" />
              <span>{t.create}</span>
            </Button>
          </Link>
        </div>

        <div className="order-1 max-w-3xl space-y-2 text-right lg:order-2">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {t.pageTitle}
          </h1>
          <p className="text-sm leading-7 text-muted-foreground md:text-base">
            {t.pageSubtitle}
          </p>
        </div>
      </div>

      {/* =====================================================
          Stats
      ====================================================== */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">{t.total}</p>
              <p className="mt-1 text-2xl font-bold">
                {isLoading ? "..." : formatNumber(stats.total)}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">{t.active}</p>
              <p className="mt-1 text-2xl font-bold">
                {isLoading ? "..." : formatNumber(stats.active)}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BadgeCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">{t.suspended}</p>
              <p className="mt-1 text-2xl font-bold">
                {isLoading ? "..." : formatNumber(stats.suspended)}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">{t.selected}</p>
              <p className="mt-1 text-2xl font-bold">
                {formatNumber(stats.selected)}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Star className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* =====================================================
          List Table
      ====================================================== */}
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="order-2 flex flex-wrap items-center gap-2 lg:order-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="rounded-xl">
                    <Columns3 className="h-4 w-4" />
                    <span>{t.columns}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {(Object.keys(columnLabels) as ColumnKey[]).map((key) => (
                    <DropdownMenuCheckboxItem
                      key={key}
                      checked={columns[key]}
                      onCheckedChange={(checked) =>
                        setColumns((prev) => ({
                          ...prev,
                          [key]: Boolean(checked),
                        }))
                      }
                    >
                      {columnLabels[key]}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="rounded-xl">
                    <Filter className="h-4 w-4" />
                    <span>{t.statusFilter}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  {(
                    [
                      "ALL",
                      "ACTIVE",
                      "INACTIVE",
                      "SUSPENDED",
                      "DRAFT",
                      "UNKNOWN",
                    ] as Array<ProviderStatus | "ALL">
                  ).map((status) => (
                    <DropdownMenuCheckboxItem
                      key={status}
                      checked={statusFilter === status}
                      onCheckedChange={() => setStatusFilter(status)}
                    >
                      {status === "ALL"
                        ? t.all
                        : status === "ACTIVE"
                          ? t.active
                          : status === "INACTIVE"
                            ? t.inactive
                            : status === "SUSPENDED"
                              ? t.suspended
                              : status === "DRAFT"
                                ? t.draft
                                : t.unknown}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="rounded-xl">
                    <Building2 className="h-4 w-4" />
                    <span>{t.typeFilter}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
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
                  <Button variant="outline" className="rounded-xl">
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
                      ["type", t.sortByType],
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

            <div className="order-1 space-y-1 text-right lg:order-2">
              <CardTitle>{t.tableTitle}</CardTitle>
              <CardDescription>{t.tableDescription}</CardDescription>
            </div>
          </div>

          <div className="relative mt-5">
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
        </CardHeader>

        <CardContent>
          <div ref={printRef}>
            <div className="hidden print:block">
              <div className="print-title">{t.pageTitle}</div>
              <div className="print-subtitle">{t.pageSubtitle}</div>
            </div>

            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.action ? <TableHead>{t.table.action}</TableHead> : null}
                    {columns.featured ? (
                      <TableHead>{t.table.featured}</TableHead>
                    ) : null}
                    {columns.status ? <TableHead>{t.table.status}</TableHead> : null}
                    {columns.email ? <TableHead>{t.table.email}</TableHead> : null}
                    {columns.contact ? (
                      <TableHead>{t.table.contact}</TableHead>
                    ) : null}
                    {columns.city ? <TableHead>{t.table.city}</TableHead> : null}
                    {columns.type ? <TableHead>{t.table.type}</TableHead> : null}
                    {columns.name ? <TableHead>{t.table.name}</TableHead> : null}
                    {columns.code ? <TableHead>{t.table.code}</TableHead> : null}
                    {columns.select ? (
                      <TableHead className="w-12">
                        <Checkbox
                          checked={isAllCurrentPageSelected}
                          onCheckedChange={toggleCurrentPageSelection}
                          aria-label={t.table.select}
                        />
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={10}>
                        <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>{t.loading}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : currentPageRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10}>
                        <div className="py-14 text-center">
                          <p className="font-semibold">{t.emptyTitle}</p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {t.emptyText}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentPageRows.map((provider) => (
                      <TableRow key={provider.id}>
                        {columns.action ? (
                          <TableCell>
                            <Link href={`/system/providers/${provider.id}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-lg"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                          </TableCell>
                        ) : null}

                        {columns.featured ? (
                          <TableCell>
                            {provider.isFeatured ? (
                              <Badge className="rounded-full">
                                <Star className="h-3.5 w-3.5" />
                                {isArabic ? "مميز" : "Featured"}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="rounded-full">
                                -
                              </Badge>
                            )}
                          </TableCell>
                        ) : null}

                        {columns.status ? (
                          <TableCell>{statusBadge(provider.status, locale)}</TableCell>
                        ) : null}

                        {columns.email ? (
                          <TableCell>
                            <span className="text-sm">
                              {provider.email || "-"}
                            </span>
                          </TableCell>
                        ) : null}

                        {columns.contact ? (
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{provider.mobile || provider.phone || "-"}</span>
                            </div>
                          </TableCell>
                        ) : null}

                        {columns.city ? (
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{provider.city || provider.area || "-"}</span>
                            </div>
                          </TableCell>
                        ) : null}

                        {columns.type ? (
                          <TableCell>
                            <Badge variant="secondary" className="rounded-full">
                              {t.typeLabels[provider.providerType]}
                            </Badge>
                          </TableCell>
                        ) : null}

                        {columns.name ? (
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <div className="min-w-0 text-right">
                                <p className="truncate font-medium">
                                  {provider.name}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {provider.contactPerson || provider.address || "-"}
                                </p>
                              </div>

                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                                <Building2 className="h-4 w-4" />
                              </div>
                            </div>
                          </TableCell>
                        ) : null}

                        {columns.code ? (
                          <TableCell className="font-medium">
                            {provider.code && provider.code !== "-"
                              ? provider.code
                              : `#${provider.id}`}
                          </TableCell>
                        ) : null}

                        {columns.select ? (
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(String(provider.id))}
                              onCheckedChange={() =>
                                toggleRowSelection(provider.id)
                              }
                              aria-label={t.table.select}
                            />
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                {t.previous}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={page >= pageCount}
                onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
              >
                {t.next}
              </Button>
            </div>

            <p>
              {t.page} {formatNumber(Math.min(page, pageCount))} {t.of}{" "}
              {formatNumber(pageCount)} — {formatNumber(filteredProviders.length)}{" "}
              / {formatNumber(providers.length)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}