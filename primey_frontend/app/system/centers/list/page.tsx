"use client";

/* ============================================================
   📂 app/system/centers/list/page.tsx
   🧠 Primey Care | Centers List
   ------------------------------------------------------------
   ✅ المسار: /system/centers/list
   ✅ الإصدار: v1.1.1 - UX Refinement

   ✅ العمل:
      قائمة كاملة للمراكز / مقدمي الخدمة مع البحث والفلاتر والفرز
      وإدارة الأعمدة والتصدير والطباعة.

   ✅ API:
      GET /api/providers/?page_size=100

   ✅ متوافق مع:
      - /system/centers
      - /system/centers/list
      - /system/centers/create
      - /system/centers/[id]

   ✅ ملاحظات UX:
      - لا يتم إظهار المسارات التقنية أو أسماء API في واجهة المستخدم.
      - البحث في صف مستقل.
      - الفلاتر وإدارة الأعمدة في صف مستقل تحت البحث.

   ✅ الوظائف:
      - بحث سريع
      - فلترة حسب الحالة
      - فلترة حسب النوع
      - فرز الأعمدة
      - إظهار / إخفاء الأعمدة
      - تحديد الصفوف
      - Pagination محلي
      - تصدير Excel بصيغة .xls متوافقة مع Microsoft Excel
      - Web PDF Print
      - Error State حقيقي
      - Empty State ذكي
      - Loading Skeleton
      - حماية روابط التفاصيل عند غياب id صالح
      - دعم عربي / إنجليزي عبر primey-locale
      - استخدام toast من sonner
      - بدون localhost hardcoded
      - استخدام UI الداخلي فقط
      - الأرقام تبقى بالإنجليزية
============================================================ */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  Star,
  Stethoscope,
  XCircle,
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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
  actions: boolean;
};

type ExcelSheetOptions = {
  filename: string;
  worksheetName: string;
  title: string;
  locale: AppLocale;
  summaryRows: Array<[string, string | number]>;
  filterRows: Array<[string, string | number]>;
  headers: string[];
  rows: Array<Array<string | number>>;
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
    id: (obj.id ?? "") as number | string,
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
    title: isArabic ? "قائمة المراكز" : "Centers List",
    subtitle: isArabic
      ? "إدارة المراكز ومقدمي الخدمة مع البحث والفلاتر والأعمدة والفرز."
      : "Manage centers and providers with search, filters, columns, and sorting.",

    back: isArabic ? "لوحة المراكز" : "Centers Overview",
    createCenter: isArabic ? "إنشاء مركز" : "Create Center",
    refresh: isArabic ? "تحديث" : "Refresh",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",

    tableTitle: isArabic ? "بيانات المراكز" : "Centers Data",
    tableSubtitle: isArabic
      ? "استعرض المراكز، رتّب البيانات، وخصص الأعمدة حسب احتياجك."
      : "Browse centers, sort data, and customize columns as needed.",

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

    emptyTitle: isArabic ? "لا توجد مراكز بعد" : "No centers yet",
    emptyText: isArabic
      ? "عند إضافة مراكز جديدة ستظهر هنا مباشرة."
      : "New centers will appear here once they are added.",
    noResultsTitle: isArabic
      ? "لا توجد نتائج مطابقة"
      : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير كلمات البحث أو فلتر الحالة أو فلتر النوع."
      : "Try changing the search keywords, status filter, or type filter.",

    loading: isArabic ? "جاري تحميل بيانات المراكز..." : "Loading centers data...",
    selectedRows: isArabic ? "صفوف محددة" : "row(s) selected",
    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",
    page: isArabic ? "صفحة" : "Page",
    from: isArabic ? "من" : "of",
    showing: isArabic ? "المعروض" : "Showing",

    actions: isArabic ? "الإجراءات" : "Actions",
    viewDetails: isArabic ? "عرض التفاصيل" : "View details",
    copyCode: isArabic ? "نسخ الكود" : "Copy code",
    copyId: isArabic ? "نسخ الرقم" : "Copy ID",

    apiError: isArabic
      ? "تعذر تحميل قائمة المراكز."
      : "Unable to load centers list.",
    apiErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    refreshSuccess: isArabic
      ? "تم تحديث قائمة المراكز بنجاح"
      : "Centers list refreshed successfully",
    exportSuccess: isArabic
      ? "تم تجهيز ملف Excel بنجاح"
      : "Excel file prepared successfully",
    exportEmpty: isArabic
      ? "لا توجد بيانات قابلة للتصدير"
      : "No data available to export",
    printSuccess: isArabic
      ? "تم تجهيز نافذة الطباعة"
      : "Print window prepared",
    printError: isArabic
      ? "تعذر فتح نافذة الطباعة"
      : "Unable to open print window",
    copied: isArabic ? "تم النسخ بنجاح" : "Copied successfully",

    excelSummary: isArabic ? "ملخص القائمة" : "List Summary",
    excelFilters: isArabic ? "الفلاتر المستخدمة" : "Applied Filters",
    excelTable: isArabic ? "بيانات المراكز" : "Centers Data",
    generatedAt: isArabic ? "تاريخ التصدير" : "Generated At",
    reportScope: isArabic ? "نطاق التقرير" : "Report Scope",
    currentFilteredData: isArabic
      ? "حسب الفلاتر الحالية"
      : "Current filtered data",
    filterSearch: isArabic ? "البحث" : "Search",
    filterStatus: isArabic ? "فلتر الحالة" : "Status Filter",
    filterType: isArabic ? "فلتر النوع" : "Type Filter",

    yes: isArabic ? "نعم" : "Yes",
    no: isArabic ? "لا" : "No",
    featuredLabel: isArabic ? "مميز" : "Featured",
    normalLabel: isArabic ? "عادي" : "Normal",

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

function isValidCenterId(id: Center["id"]) {
  const value = String(id || "").trim();

  return value.length > 0 && value !== "-" && value !== "undefined";
}

function escapeHtml(value: string | number) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function downloadExcel(options: ExcelSheetOptions) {
  const dir = options.locale === "ar" ? "rtl" : "ltr";
  const align = options.locale === "ar" ? "right" : "left";
  const colspan = Math.max(options.headers.length, 2);

  const summaryHtml = options.summaryRows
    .map(
      ([label, value]) => `
        <tr>
          <td class="summary-label">${escapeHtml(label)}</td>
          <td class="summary-value">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  const filterHtml = options.filterRows
    .map(
      ([label, value]) => `
        <tr>
          <td class="summary-label">${escapeHtml(label)}</td>
          <td class="summary-value">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  const headerHtml = options.headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join("");

  const rowsHtml = options.rows
    .map(
      (row) => `
        <tr>
          ${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}
        </tr>`,
    )
    .join("");

  const workbook = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>${escapeHtml(options.worksheetName)}</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayRightToLeft>${options.locale === "ar" ? "True" : "False"}</x:DisplayRightToLeft>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body {
            direction: ${dir};
            font-family: Arial, sans-serif;
          }
          table {
            border-collapse: collapse;
            width: 100%;
          }
          th,
          td {
            border: 1px solid #d9e2ef;
            padding: 8px;
            text-align: ${align};
            vertical-align: top;
            mso-number-format: "\\@";
          }
          th {
            background: #d8ecfb;
            color: #000000;
            font-weight: 700;
          }
          .title {
            font-size: 20px;
            font-weight: 700;
            text-align: center;
            background: #ffffff;
          }
          .section {
            font-weight: 700;
            background: #eef6ff;
          }
          .summary-label {
            font-weight: 700;
            background: #f8fafc;
            width: 240px;
          }
          .summary-value {
            font-weight: 700;
          }
        </style>
      </head>
      <body dir="${dir}">
        <table>
          <tr>
            <td class="title" colspan="${colspan}">
              ${escapeHtml(options.title)}
            </td>
          </tr>
          <tr><td colspan="${colspan}"></td></tr>
          <tr><td class="section" colspan="${colspan}">${options.locale === "ar" ? "ملخص القائمة" : "List Summary"}</td></tr>
          ${summaryHtml}
          <tr><td colspan="${colspan}"></td></tr>
          <tr><td class="section" colspan="${colspan}">${options.locale === "ar" ? "الفلاتر المستخدمة" : "Applied Filters"}</td></tr>
          ${filterHtml}
          <tr><td colspan="${colspan}"></td></tr>
          <tr>${headerHtml}</tr>
          ${rowsHtml}
        </table>
      </body>
    </html>`;

  const blob = new Blob([workbook], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = options.filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function StatCardSkeleton() {
  return (
    <Card className="rounded-2xl border bg-card shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <SkeletonLine className="h-7 w-16" />
            <SkeletonLine className="h-4 w-28" />
          </div>
          <SkeletonLine className="h-10 w-10 rounded-xl" />
        </div>
        <div className="mt-4 flex items-center gap-2">
          <SkeletonLine className="h-3 w-8" />
          <SkeletonLine className="h-2 flex-1" />
        </div>
      </CardContent>
    </Card>
  );
}

function TableRowsSkeleton({ columnsCount }: { columnsCount: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columnsCount }).map((__, columnIndex) => (
            <TableCell key={columnIndex}>
              <SkeletonLine
                className={
                  columnIndex === 1
                    ? "h-9 w-52 rounded-lg"
                    : "h-4 w-24 rounded-lg"
                }
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/* ============================================================
   Page
============================================================ */

export default function SystemCentersListPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [centers, setCenters] = useState<Center[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

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

  const columnLabels = useMemo(
    () =>
      ({
        code: t.table.code,
        name: t.table.name,
        providerType: t.table.providerType,
        city: t.table.city,
        contact: t.table.contact,
        status: t.table.status,
        featured: t.table.featured,
        actions: t.actions,
      }) satisfies Record<keyof VisibleColumns, string>,
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

  const allPageSelected =
    pageRows.length > 0 && selectedOnPage === pageRows.length;

  const hasSearchOrFilter =
    query.trim().length > 0 || statusFilter !== "ALL" || typeFilter !== "ALL";

  const visibleTableColumnsCount =
    1 + Object.values(visibleColumns).filter(Boolean).length;

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

  function clearFilters() {
    setQuery("");
    setStatusFilter("ALL");
    setTypeFilter("ALL");
  }

  async function loadCenters(showToast = false) {
    try {
      setIsLoading(true);
      setErrorMessage("");

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
      setErrorMessage(t.apiError);
      toast.error(t.apiError);
    } finally {
      setIsLoading(false);
    }
  }

  function exportExcel() {
    if (filteredCenters.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const generatedAt = new Date();

    const statusLabel =
      statusOptions.find((item) => item.value === statusFilter)?.label || t.all;

    const typeLabel =
      typeOptions.find((item) => item.value === typeFilter)?.label || t.all;

    downloadExcel({
      filename: `primey-care-centers-list-${generatedAt
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "قائمة المراكز" : "Centers List",
      title: t.title,
      locale,
      summaryRows: [
        [t.generatedAt, generatedAt.toLocaleString("en-US")],
        [t.reportScope, t.currentFilteredData],
        [
          t.showing,
          `${formatNumber(filteredCenters.length)} / ${formatNumber(
            centers.length,
          )}`,
        ],
        [t.stats.total, stats.total],
        [t.stats.active, stats.active],
        [t.stats.draft, stats.draft],
        [t.stats.stopped, stats.stopped],
      ],
      filterRows: [
        [t.filterSearch, query || t.all],
        [t.filterStatus, statusLabel],
        [t.filterType, typeLabel],
      ],
      headers: [
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
      rows: filteredCenters.map((center) => [
        String(center.id || "-"),
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
        center.isFeatured ? t.yes : t.no,
        center.address || "-",
        formatDateForExport(center.createdAt),
        formatDateForExport(center.updatedAt),
      ]),
    });

    toast.success(t.exportSuccess);
  }

  function printCurrentList() {
    const generatedAt = new Date().toLocaleString("en-US");
    const direction = isArabic ? "rtl" : "ltr";
    const align = isArabic ? "right" : "left";

    const rows = filteredCenters
      .map((center) => {
        return `
          <tr>
            <td>${escapeHtml(String(center.id || "-"))}</td>
            <td>${escapeHtml(center.code || "-")}</td>
            <td>${escapeHtml(center.name || "-")}</td>
            <td>${escapeHtml(t.typeLabels[center.providerType])}</td>
            <td>${escapeHtml(center.city || center.area || "-")}</td>
            <td>${escapeHtml(center.mobile || center.phone || "-")}</td>
            <td>${escapeHtml(getStatusLabel(center.status, locale))}</td>
            <td>${escapeHtml(center.isFeatured ? t.yes : t.no)}</td>
          </tr>
        `;
      })
      .join("");

    const html = `
      <!doctype html>
      <html lang="${locale}" dir="${direction}">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(t.title)}</title>
          <style>
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 24px;
              font-family: Arial, Tahoma, sans-serif;
              color: #111827;
              background: #ffffff;
              direction: ${direction};
              text-align: ${align};
            }

            .header {
              display: flex;
              justify-content: space-between;
              gap: 16px;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 16px;
              margin-bottom: 20px;
            }

            .title {
              font-size: 22px;
              font-weight: 700;
              margin: 0 0 8px;
            }

            .meta {
              color: #6b7280;
              font-size: 12px;
              line-height: 1.8;
            }

            .summary {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 12px;
              margin-bottom: 18px;
            }

            .box {
              border: 1px solid #e5e7eb;
              border-radius: 12px;
              padding: 12px;
            }

            .box strong {
              display: block;
              font-size: 18px;
              margin-bottom: 4px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }

            th,
            td {
              border: 1px solid #e5e7eb;
              padding: 9px;
              vertical-align: top;
            }

            th {
              background: #f9fafb;
              font-weight: 700;
            }

            @media print {
              body {
                padding: 12px;
              }

              .summary {
                grid-template-columns: repeat(4, 1fr);
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">${escapeHtml(t.title)}</h1>
              <div class="meta">${escapeHtml(t.subtitle)}</div>
            </div>
            <div class="meta">
              <div>${escapeHtml(t.generatedAt)}: ${escapeHtml(generatedAt)}</div>
              <div>${escapeHtml(t.showing)}: ${formatNumber(
                filteredCenters.length,
              )} / ${formatNumber(centers.length)}</div>
            </div>
          </div>

          <div class="summary">
            <div class="box">
              <strong>${formatNumber(stats.total)}</strong>
              <span>${escapeHtml(t.stats.total)}</span>
            </div>
            <div class="box">
              <strong>${formatNumber(stats.active)}</strong>
              <span>${escapeHtml(t.stats.active)}</span>
            </div>
            <div class="box">
              <strong>${formatNumber(stats.draft)}</strong>
              <span>${escapeHtml(t.stats.draft)}</span>
            </div>
            <div class="box">
              <strong>${formatNumber(stats.stopped)}</strong>
              <span>${escapeHtml(t.stats.stopped)}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t.table.id)}</th>
                <th>${escapeHtml(t.table.code)}</th>
                <th>${escapeHtml(t.table.name)}</th>
                <th>${escapeHtml(t.table.providerType)}</th>
                <th>${escapeHtml(t.table.city)}</th>
                <th>${escapeHtml(t.table.contact)}</th>
                <th>${escapeHtml(t.table.status)}</th>
                <th>${escapeHtml(t.table.featured)}</th>
              </tr>
            </thead>
            <tbody>
              ${
                rows ||
                `<tr><td colspan="8" style="text-align:center">${escapeHtml(
                  hasSearchOrFilter ? t.noResultsTitle : t.emptyTitle,
                )}</td></tr>`
              }
            </tbody>
          </table>

          <script>
            window.addEventListener("load", () => {
              window.print();
            });
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) {
      toast.error(t.printError);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    toast.success(t.printSuccess);
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
            <span>{t.exportExcel}</span>
          </Button>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={printCurrentList}
            disabled={isLoading || filteredCenters.length === 0}
          >
            <Printer className="h-4 w-4" />
            <span>{t.print}</span>
          </Button>

          <Link href="/system/centers/create">
            <Button className="h-10 w-full rounded-xl sm:w-auto">
              <PlusCircle className="h-4 w-4" />
              <span>{t.createCenter}</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Error State */}
      {!isLoading && errorMessage ? (
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <XCircle className="h-5 w-5" />
              </div>

              <div>
                <p className="font-semibold text-destructive">{errorMessage}</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {t.apiErrorHint}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => loadCenters(true)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <StatCardSkeleton key={index} />
            ))
          : [
              {
                label: t.stats.total,
                value: stats.total,
                percent: stats.total > 0 ? 100 : 0,
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
                <Card
                  key={item.label}
                  className="rounded-2xl border bg-card shadow-sm"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-2xl font-bold">
                          {formatNumber(item.value)}
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
                          className="h-full rounded-full bg-primary transition-all"
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
            {/* Search Row */}
            <div className="relative w-full">
              <Search
                className={`text-muted-foreground absolute top-1/2 h-4 w-4 -translate-y-1/2 ${
                  isArabic ? "right-3" : "left-3"
                }`}
              />
              <Input
                placeholder={t.searchPlaceholder}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className={`h-11 rounded-xl ${
                  isArabic ? "pr-10" : "pl-10"
                }`}
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {statusOptions.map((item) => (
                    <Button
                      key={item.value}
                      variant={
                        statusFilter === item.value ? "default" : "outline"
                      }
                      className="h-10 shrink-0 rounded-xl"
                      onClick={() => setStatusFilter(item.value)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {typeOptions.map((item) => (
                    <Button
                      key={item.value}
                      variant={typeFilter === item.value ? "default" : "outline"}
                      className="h-10 shrink-0 rounded-xl"
                      onClick={() => setTypeFilter(item.value)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {hasSearchOrFilter ? (
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl"
                    onClick={clearFilters}
                  >
                    {t.clearFilters}
                  </Button>
                ) : null}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-10 rounded-xl">
                      <ColumnsIcon className="h-4 w-4" />
                      <span>{t.columns}</span>
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
                        {columnLabels[key as keyof VisibleColumns]}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <div className="overflow-x-auto">
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
                      <TableRowsSkeleton columnsCount={visibleTableColumnsCount} />
                    ) : pageRows.length ? (
                      pageRows.map((center) => (
                        <TableRow
                          key={`${center.id}-${center.code}-${center.name}`}
                          data-state={
                            selectedIds.includes(center.id)
                              ? "selected"
                              : undefined
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
                                    {center.contactPerson ||
                                      center.email ||
                                      center.code}
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
                            <TableCell>
                              {statusBadge(center.status, locale)}
                            </TableCell>
                          ) : null}

                          {visibleColumns.featured ? (
                            <TableCell>
                              {center.isFeatured ? (
                                <Badge className="rounded-full">
                                  {t.featuredLabel}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="rounded-full">
                                  {t.normalLabel}
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

                                <DropdownMenuContent
                                  align={isArabic ? "start" : "end"}
                                >
                                  <DropdownMenuLabel>{t.actions}</DropdownMenuLabel>
                                  <DropdownMenuSeparator />

                                  {isValidCenterId(center.id) ? (
                                    <DropdownMenuItem asChild>
                                      <Link href={`/system/centers/${center.id}`}>
                                        <Eye className="h-4 w-4" />
                                        {t.viewDetails}
                                      </Link>
                                    </DropdownMenuItem>
                                  ) : null}

                                  <DropdownMenuItem
                                    onClick={() => {
                                      navigator.clipboard.writeText(
                                        String(center.code || "-"),
                                      );
                                      toast.success(t.copied);
                                    }}
                                  >
                                    {t.copyCode}
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    onClick={() => {
                                      navigator.clipboard.writeText(
                                        String(center.id || "-"),
                                      );
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
                        <TableCell
                          colSpan={visibleTableColumnsCount}
                          className="h-36 text-center"
                        >
                          <div className="mx-auto max-w-md space-y-2">
                            <p className="font-semibold">
                              {hasSearchOrFilter
                                ? t.noResultsTitle
                                : t.emptyTitle}
                            </p>
                            <p className="text-muted-foreground text-sm">
                              {hasSearchOrFilter ? t.noResultsText : t.emptyText}
                            </p>

                            {hasSearchOrFilter ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 rounded-xl"
                                onClick={clearFilters}
                              >
                                {t.clearFilters}
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <div className="text-muted-foreground flex-1 text-sm">
                {formatNumber(selectedIds.length)} /{" "}
                {formatNumber(filteredCenters.length)} {t.selectedRows}
              </div>

              <div className="text-muted-foreground text-sm">
                {t.page} {formatNumber(pageIndex + 1)} {t.from}{" "}
                {formatNumber(pageCount)}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() =>
                    setPageIndex((current) => Math.max(current - 1, 0))
                  }
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