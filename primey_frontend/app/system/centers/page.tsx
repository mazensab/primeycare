"use client";

/* ============================================================
   📂 app/system/centers/page.tsx
   🧠 Primey Care | Centers Dashboard Page
   ------------------------------------------------------------
   ✅ المسار:
      /system/centers

   ✅ العمل:
      صفحة لوحة إدارة المراكز / مقدمي الخدمة داخل مساحة النظام.

   ✅ الإصدار:
      v1.1.1 - UX Refinement + Excel Export

   ✅ يعتمد على:
      GET /api/providers/?page_size=100

   ✅ متوافق مع صفحات:
      - /system/centers
      - /system/centers/list
      - /system/centers/create
      - /system/centers/reports
      - /system/centers/[id]

   ✅ الوظائف:
      - عرض إحصائيات المراكز من API فعلي
      - عرض المراكز المميزة
      - عرض آخر المراكز في جدول مختصر
      - البحث السريع داخل بيانات المراكز المحملة
      - فلترة حسب حالة المركز
      - تصدير Excel للبيانات الظاهرة بصيغة .xls متوافقة مع Microsoft Excel
      - Error State حقيقي عند فشل API
      - Empty State ذكي حسب البحث أو عدم وجود بيانات
      - Loading Skeleton احترافي بدل نص تحميل فقط
      - دعم عربي / إنجليزي عبر primey-locale
      - استخدام toast من sonner للتنبيهات
      - عدم استخدام localhost hardcoded
      - استخدام UI الداخلي فقط
      - الأرقام تبقى بالإنجليزية
      - روابط داخلية آمنة بدون Dynamic href غير مدعوم

   ------------------------------------------------------------
   تحسينات هذا الإصدار:
      - فصل حالة الخطأ عن الحالة الفارغة
      - إضافة زر إعادة المحاولة عند فشل التحميل
      - إضافة Skeleton للبطاقات والجدول والمراكز المميزة
      - تفعيل زر تصدير Excel بدل تركه وهميًا
      - استبدال زر الأعمدة الوهمي بفلتر حالة فعلي
      - تحسين Empty State عند البحث وعدم وجود نتائج
      - حماية روابط التفاصيل عند غياب id صالح
      - تحسين Footer بدل Pagination غير حقيقي
      - تحسين مؤشرات الإحصائيات بدل قيم ثابتة غير دقيقة
============================================================ */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Building2,
  Download,
  Eye,
  FileText,
  ListChecks,
  Loader2,
  MapPin,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Star,
  Users,
  XCircle,
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

type ExcelSheetOptions = {
  filename: string;
  worksheetName: string;
  title: string;
  locale: AppLocale;
  summaryRows: Array<[string, string | number]>;
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

/* ============================================================
   API Normalizers
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
    id: (obj.id ?? "") as number | string,
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
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    pageTitle: isArabic ? "إدارة المراكز" : "Centers Management",
    pageSubtitle: isArabic
      ? "متابعة المراكز ومقدمي الخدمة، حالة التفعيل، المدن، والروابط التشغيلية من بيانات حقيقية."
      : "Monitor centers and providers, activation status, cities, and operational links from live data.",

    addCenter: isArabic ? "إنشاء مركز" : "Create Center",
    centersList: isArabic ? "قائمة المراكز" : "Centers List",
    reports: isArabic ? "التقارير" : "Reports",
    export: isArabic ? "تصدير" : "Export",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",

    featuredCenters: isArabic ? "المراكز المميزة" : "Featured Centers",
    featuredSubtitle: isArabic
      ? "عرض مختصر لأهم المراكز حسب حالة التمييز أو أحدث السجلات."
      : "A compact view of important centers based on featured status or latest records.",

    trackStatus: isArabic ? "حالة المراكز" : "Track Center Status",
    trackSubtitle: isArabic
      ? "تحليل سريع لحالة المراكز ومقدمي الخدمة."
      : "Quick analysis of center and provider status.",

    filterPlaceholder: isArabic
      ? "ابحث في المراكز..."
      : "Filter centers...",

    all: isArabic ? "الكل" : "All",
    total: isArabic ? "الإجمالي" : "Total",
    active: isArabic ? "نشط" : "Active",
    draft: isArabic ? "مسودة" : "Draft",
    suspended: isArabic ? "موقوف" : "Suspended",
    inactive: isArabic ? "غير نشط" : "Inactive",
    unknown: isArabic ? "غير محدد" : "Unknown",

    loaded: isArabic ? "محمّلة" : "Loaded",
    operational: isArabic ? "تشغيلي" : "Operational",
    needsReview: isArabic ? "يحتاج مراجعة" : "Needs Review",
    stopped: isArabic ? "متوقف" : "Stopped",

    showing: isArabic ? "عرض" : "Showing",
    from: isArabic ? "من" : "of",
    latestRecords: isArabic ? "آخر السجلات" : "Latest records",
    viewFullList: isArabic ? "عرض القائمة الكاملة" : "View Full List",

    table: {
      id: isArabic ? "الرقم" : "ID",
      name: isArabic ? "اسم المركز" : "Center Name",
      type: isArabic ? "النوع" : "Type",
      city: isArabic ? "المدينة" : "City",
      contact: isArabic ? "التواصل" : "Contact",
      status: isArabic ? "الحالة" : "Status",
      action: isArabic ? "الإجراء" : "Action",
    },

    emptyTitle: isArabic ? "لا توجد مراكز بعد" : "No centers yet",
    emptyText: isArabic
      ? "عند إضافة مراكز من صفحة الإنشاء أو من لوحة Django ستظهر هنا مباشرة."
      : "Centers created from the create page or Django admin will appear here.",

    noResultsTitle: isArabic
      ? "لا توجد نتائج مطابقة"
      : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير كلمات البحث أو فلتر الحالة لعرض نتائج أكثر."
      : "Try changing the search keywords or status filter to show more results.",

    loading: isArabic ? "جاري تحميل بيانات المراكز..." : "Loading centers data...",
    apiError: isArabic
      ? "تعذر تحميل بيانات المراكز."
      : "Unable to load centers data.",
    apiErrorHint: isArabic
      ? "تحقق من اتصال API أو الصلاحيات ثم أعد المحاولة."
      : "Check the API connection or permissions, then try again.",
    refreshSuccess: isArabic
      ? "تم تحديث بيانات المراكز بنجاح"
      : "Centers data refreshed successfully",
    exportSuccess: isArabic
      ? "تم تجهيز ملف Excel بنجاح"
      : "Excel file prepared successfully",
    exportEmpty: isArabic
      ? "لا توجد بيانات قابلة للتصدير"
      : "No data available to export",

    quickAccessTitle: isArabic ? "إجراءات وحدة المراكز" : "Centers Module Actions",
    quickAccessSubtitle: isArabic
      ? "اختصارات منظمة للوصول إلى أهم صفحات وحدة المراكز بدون عرض روابط خام."
      : "Organized shortcuts to the key center module pages without raw route text.",

    open: isArabic ? "فتح" : "Open",
    manage: isArabic ? "إدارة" : "Manage",
    view: isArabic ? "عرض" : "View",

    actionListTitle: isArabic ? "قائمة المراكز" : "Centers List",
    actionListDesc: isArabic
      ? "استعراض جميع المراكز، البحث، التصفية، وإدارة السجلات."
      : "Browse all centers, search, filter, and manage records.",

    actionCreateTitle: isArabic ? "إنشاء مركز" : "Create Center",
    actionCreateDesc: isArabic
      ? "إضافة مركز أو مقدم خدمة جديد وربطه لاحقًا بالعقود والخدمات."
      : "Add a new center/provider and later connect it with contracts and services.",

    actionReportsTitle: isArabic ? "تقارير المراكز" : "Centers Reports",
    actionReportsDesc: isArabic
      ? "عرض تقارير تشغيلية، فلاتر، جداول، تصدير وطباعة."
      : "View operational reports, filters, tables, export and print.",

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

function statusLabel(status: ProviderStatus, locale: AppLocale) {
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

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function isValidCenterId(id: Center["id"]) {
  const value = String(id || "").trim();

  return value.length > 0 && value !== "-" && value !== "undefined";
}

function excelEscape(value: string | number) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function downloadExcel(options: ExcelSheetOptions) {
  const dir = options.locale === "ar" ? "rtl" : "ltr";
  const align = options.locale === "ar" ? "right" : "left";
  const colspan = Math.max(options.headers.length, 2);

  const summaryHtml = options.summaryRows
    .map(
      ([label, value]) => `
        <tr>
          <td class="summary-label">${excelEscape(label)}</td>
          <td class="summary-value">${excelEscape(value)}</td>
        </tr>`,
    )
    .join("");

  const headerHtml = options.headers
    .map((header) => `<th>${excelEscape(header)}</th>`)
    .join("");

  const rowsHtml = options.rows
    .map(
      (row) => `
        <tr>
          ${row.map((cell) => `<td>${excelEscape(cell)}</td>`).join("")}
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
                <x:Name>${excelEscape(options.worksheetName)}</x:Name>
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
          .summary-label {
            font-weight: 700;
            background: #f8fafc;
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
              ${excelEscape(options.title)}
            </td>
          </tr>
          <tr>
            <td colspan="${colspan}"></td>
          </tr>
          ${summaryHtml}
          <tr>
            <td colspan="${colspan}"></td>
          </tr>
          <tr>
            ${headerHtml}
          </tr>
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

function FeaturedCentersSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <SkeletonLine className="h-11 w-11 shrink-0 rounded-xl" />
            <div className="space-y-2">
              <SkeletonLine className="h-3 w-28" />
              <SkeletonLine className="h-3 w-20" />
            </div>
          </div>

          <div className="space-y-2">
            <SkeletonLine className="h-3 w-16" />
            <SkeletonLine className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusCardsSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="space-y-3">
          <div className="flex items-center gap-2">
            <SkeletonLine className="h-4 w-4" />
            <SkeletonLine className="h-7 w-14" />
          </div>
          <div className="space-y-2">
            <SkeletonLine className="h-3 w-20" />
            <SkeletonLine className="h-2 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TableRowsSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell>
            <SkeletonLine className="h-4 w-16" />
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <SkeletonLine className="h-8 w-8 rounded-lg" />
              <div className="space-y-2">
                <SkeletonLine className="h-3 w-32" />
                <SkeletonLine className="h-3 w-24" />
              </div>
            </div>
          </TableCell>
          <TableCell>
            <SkeletonLine className="h-6 w-20" />
          </TableCell>
          <TableCell>
            <SkeletonLine className="h-4 w-20" />
          </TableCell>
          <TableCell>
            <SkeletonLine className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <SkeletonLine className="h-6 w-16" />
          </TableCell>
          <TableCell>
            <SkeletonLine className="h-8 w-10 rounded-lg" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

/* ============================================================
   Page
============================================================ */

export default function SystemCentersPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [centers, setCenters] = useState<Center[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [errorMessage, setErrorMessage] = useState("");

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const filteredCenters = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return centers.filter((center) => {
      const matchesStatus =
        statusFilter === "ALL" ? true : center.status === statusFilter;

      const matchesQuery = !cleanQuery
        ? true
        : center.name.toLowerCase().includes(cleanQuery) ||
          center.code.toLowerCase().includes(cleanQuery) ||
          center.city.toLowerCase().includes(cleanQuery) ||
          center.area.toLowerCase().includes(cleanQuery) ||
          center.phone.toLowerCase().includes(cleanQuery) ||
          center.mobile.toLowerCase().includes(cleanQuery) ||
          center.email.toLowerCase().includes(cleanQuery) ||
          center.providerType.toLowerCase().includes(cleanQuery) ||
          center.status.toLowerCase().includes(cleanQuery);

      return matchesStatus && matchesQuery;
    });
  }, [centers, query, statusFilter]);

  const stats = useMemo(() => {
    const total = centers.length;
    const active = centers.filter((item) => item.status === "ACTIVE").length;
    const draft = centers.filter((item) => item.status === "DRAFT").length;
    const suspended = centers.filter(
      (item) => item.status === "SUSPENDED",
    ).length;
    const inactive = centers.filter((item) => item.status === "INACTIVE").length;

    return {
      total,
      active,
      draft,
      suspended,
      inactive,
      stopped: suspended + inactive,
    };
  }, [centers]);

  const featuredCenters = useMemo(() => {
    const featured = centers.filter((item) => item.isFeatured);

    if (featured.length > 0) {
      return featured.slice(0, 6);
    }

    return centers.slice(0, 6);
  }, [centers]);

  const tableRows = useMemo(() => filteredCenters.slice(0, 8), [filteredCenters]);

  const statusCards = useMemo(
    () => [
      {
        title: t.total,
        value: stats.total,
        helper: t.loaded,
        helperValue: stats.total > 0 ? "100%" : "0%",
        icon: Building2,
        percent: stats.total > 0 ? 100 : 0,
      },
      {
        title: t.active,
        value: stats.active,
        helper: t.operational,
        helperValue: `${percent(stats.active, stats.total)}%`,
        icon: BadgeCheck,
        percent: percent(stats.active, stats.total),
      },
      {
        title: t.draft,
        value: stats.draft,
        helper: t.needsReview,
        helperValue: `${percent(stats.draft, stats.total)}%`,
        icon: FileText,
        percent: percent(stats.draft, stats.total),
      },
      {
        title: t.suspended,
        value: stats.stopped,
        helper: t.stopped,
        helperValue: `${percent(stats.stopped, stats.total)}%`,
        icon: ShieldCheck,
        percent: percent(stats.stopped, stats.total),
      },
    ],
    [stats, t],
  );

  const statusFilters = useMemo(
    () =>
      [
        {
          value: "ALL" as const,
          label: t.all,
          count: centers.length,
        },
        {
          value: "ACTIVE" as const,
          label: t.active,
          count: stats.active,
        },
        {
          value: "DRAFT" as const,
          label: t.draft,
          count: stats.draft,
        },
        {
          value: "SUSPENDED" as const,
          label: t.suspended,
          count: stats.suspended,
        },
        {
          value: "INACTIVE" as const,
          label: t.inactive,
          count: stats.inactive,
        },
      ] satisfies Array<{
        value: StatusFilter;
        label: string;
        count: number;
      }>,
    [centers.length, stats, t],
  );

  const moduleActions = useMemo(
    () => [
      {
        title: t.actionListTitle,
        description: t.actionListDesc,
        href: "/system/centers/list",
        icon: Users,
        badge: `${centers.length}`,
        cta: t.manage,
      },
      {
        title: t.actionCreateTitle,
        description: t.actionCreateDesc,
        href: "/system/centers/create",
        icon: Plus,
        badge: isArabic ? "جديد" : "New",
        cta: t.open,
      },
      {
        title: t.actionReportsTitle,
        description: t.actionReportsDesc,
        href: "/system/centers/reports",
        icon: Activity,
        badge: isArabic ? "تحليل" : "Reports",
        cta: t.view,
      },
    ],
    [centers.length, isArabic, t],
  );

  const hasSearchOrFilter =
    query.trim().length > 0 || statusFilter !== "ALL";

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
      console.error("Failed to load centers:", error);
      setCenters([]);
      setErrorMessage(t.apiError);
      toast.error(t.apiError);
    } finally {
      setIsLoading(false);
    }
  }

  function handleExport() {
    if (filteredCenters.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const date = new Date().toISOString().slice(0, 10);

    downloadExcel({
      filename: `primey-centers-${date}.xls`,
      worksheetName: locale === "ar" ? "المراكز" : "Centers",
      title: t.pageTitle,
      locale,
      summaryRows: [
        [t.total, stats.total],
        [t.active, stats.active],
        [t.draft, stats.draft],
        [t.suspended, stats.suspended],
        [t.inactive, stats.inactive],
        [t.showing, filteredCenters.length],
      ],
      headers: [
        t.table.id,
        t.table.name,
        t.table.type,
        t.table.city,
        t.table.contact,
        t.table.status,
      ],
      rows: filteredCenters.map((center) => [
        center.code || String(center.id || "-"),
        center.name,
        t.typeLabels[center.providerType],
        center.city || center.area || "-",
        center.mobile || center.phone || center.email || "-",
        statusLabel(center.status, locale),
      ]),
    });

    toast.success(t.exportSuccess);
  }

  function renderFeaturedCenter(center: Center) {
    const content = (
      <div className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3 transition hover:bg-muted/50">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Building2 className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold">{center.name}</p>

              {center.isFeatured ? (
                <Star className="h-3.5 w-3.5 shrink-0 fill-yellow-400 text-yellow-500" />
              ) : null}
            </div>

            <p className="text-muted-foreground mt-1 truncate text-xs">
              {center.code}
            </p>
          </div>
        </div>

        <div className="shrink-0 text-end">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {t.typeLabels[center.providerType]}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {center.city || center.area || "-"}
          </p>
        </div>
      </div>
    );

    if (!isValidCenterId(center.id)) {
      return (
        <div key={`${center.code}-${center.name}`} className="block">
          {content}
        </div>
      );
    }

    return (
      <Link key={center.id} href={`/system/centers/${center.id}`} className="block">
        {content}
      </Link>
    );
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
          <p className="text-muted-foreground mt-1 text-sm">
            {t.pageSubtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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

          <Link href="/system/centers/reports">
            <Button variant="outline" className="h-10 w-full rounded-xl sm:w-auto">
              <BarChart3 className="h-4 w-4" />
              <span>{t.reports}</span>
            </Button>
          </Link>

          <Link href="/system/centers/create">
            <Button className="h-10 w-full rounded-xl sm:w-auto">
              <Plus className="h-4 w-4" />
              <span>{t.addCenter}</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* =====================================================
          Error State
      ====================================================== */}
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

      {/* =====================================================
          Main Layout
      ====================================================== */}
      <div className="grid gap-4 xl:grid-cols-3">
        {/* Featured Centers */}
        <Card className="rounded-2xl border bg-card shadow-sm xl:col-span-1">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-bold">
                {t.featuredCenters}
              </CardTitle>
              <CardDescription className="mt-1 text-sm">
                {t.featuredSubtitle}
              </CardDescription>
            </div>

            <Link href="/system/centers/list">
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl">
                <ListChecks className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>

          <CardContent className="space-y-3">
            {isLoading ? (
              <FeaturedCentersSkeleton />
            ) : featuredCenters.length === 0 ? (
              <div className="rounded-xl border border-dashed p-5 text-center">
                <p className="font-semibold">{t.emptyTitle}</p>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  {t.emptyText}
                </p>
              </div>
            ) : (
              featuredCenters.map((center) => renderFeaturedCenter(center))
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
              <CardDescription className="mt-1 text-sm">
                {t.trackSubtitle}
              </CardDescription>
            </div>

            <Button
              variant="outline"
              className="h-9 rounded-xl"
              onClick={handleExport}
              disabled={isLoading || filteredCenters.length === 0}
            >
              <Download className="h-4 w-4" />
              <span>{t.exportExcel}</span>
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Status Cards */}
            {isLoading ? (
              <StatusCardsSkeleton />
            ) : (
              <div className="grid gap-3 md:grid-cols-4">
                {statusCards.map((card) => {
                  const Icon = card.icon;

                  return (
                    <button
                      key={card.title}
                      type="button"
                      className="space-y-2 rounded-xl border bg-background/70 p-3 text-start transition hover:bg-muted/40"
                      onClick={() => {
                        if (card.title === t.active) setStatusFilter("ACTIVE");
                        if (card.title === t.draft) setStatusFilter("DRAFT");
                        if (card.title === t.suspended) {
                          setStatusFilter("SUSPENDED");
                        }
                        if (card.title === t.total) setStatusFilter("ALL");
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="text-muted-foreground h-4 w-4" />
                        <p className="text-2xl font-bold">{card.value}</p>
                      </div>

                      <div className="space-y-1">
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
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Filter */}
            <div className="grid gap-3">
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

              <div className="flex gap-2 overflow-x-auto pb-1">
                {statusFilters.map((item) => {
                  const isSelected = statusFilter === item.value;

                  return (
                    <Button
                      key={item.value}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className="shrink-0 rounded-xl"
                      onClick={() => setStatusFilter(item.value)}
                    >
                      <span>{item.label}</span>
                      <Badge
                        variant={isSelected ? "secondary" : "outline"}
                        className="ms-1 rounded-full"
                      >
                        {item.count}
                      </Badge>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.table.id}</TableHead>
                      <TableHead>{t.table.name}</TableHead>
                      <TableHead>{t.table.type}</TableHead>
                      <TableHead>{t.table.city}</TableHead>
                      <TableHead>{t.table.contact}</TableHead>
                      <TableHead>{t.table.status}</TableHead>
                      <TableHead>{t.table.action}</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {isLoading ? (
                      <TableRowsSkeleton />
                    ) : tableRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <div className="py-12 text-center">
                            <p className="font-semibold">
                              {hasSearchOrFilter
                                ? t.noResultsTitle
                                : t.emptyTitle}
                            </p>
                            <p className="text-muted-foreground mt-2 text-sm">
                              {hasSearchOrFilter ? t.noResultsText : t.emptyText}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      tableRows.map((center) => (
                        <TableRow key={`${center.id}-${center.code}`}>
                          <TableCell className="font-medium">
                            {center.code || `#${center.id}`}
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                                <Building2 className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-medium">
                                  {center.name}
                                </p>
                                <p className="text-muted-foreground truncate text-xs">
                                  {center.contactPerson || center.email || "-"}
                                </p>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge variant="secondary" className="rounded-full">
                              {t.typeLabels[center.providerType]}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              <MapPin className="text-muted-foreground h-3.5 w-3.5" />
                              <span>{center.city || center.area || "-"}</span>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Phone className="text-muted-foreground h-3.5 w-3.5" />
                              <span>{center.mobile || center.phone || "-"}</span>
                            </div>
                          </TableCell>

                          <TableCell>{statusBadge(center.status, locale)}</TableCell>

                          <TableCell>
                            {isValidCenterId(center.id) ? (
                              <Link href={`/system/centers/${center.id}`}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 rounded-lg"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-lg"
                                disabled
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>
                {t.showing} {tableRows.length} {t.from} {filteredCenters.length} ·{" "}
                {t.latestRecords}
              </p>

              <Link href="/system/centers/list">
                <Button variant="outline" size="sm" className="rounded-xl">
                  <ListChecks className="h-4 w-4" />
                  {t.viewFullList}
                </Button>
              </Link>
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
          <CardDescription>{t.quickAccessSubtitle}</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
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