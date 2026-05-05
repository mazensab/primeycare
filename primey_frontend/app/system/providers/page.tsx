"use client";

/* ============================================================
   📂 app/system/providers/page.tsx
   🧠 Primey Care | Providers Dashboard
   ------------------------------------------------------------
   ✅ المرحلة 17 + المرحلة 2
   ✅ مبني بنفس نمط المراكز/العملاء المعتمد
   ✅ لا تظهر مسارات تقنية أو أسماء API داخل الواجهة
   ✅ لا توجد روابط تقارير داخل الوحدة
   ✅ Error State مستقل
   ✅ Empty State ذكي
   ✅ Skeleton Loading
   ✅ البحث في صف مستقل
   ✅ الفلاتر في صف مستقل تحت البحث
   ✅ Excel export بصيغة .xls HTML Workbook
   ✅ Web PDF Print
   ✅ حماية الأزرار والطلبات حسب الصلاحيات
   ✅ fallback آمن لـ system_admin / superadmin
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ استخدام toast من sonner
   ✅ بدون localhost hardcoded
   ✅ الأرقام تبقى بالإنجليزية
============================================================ */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Building2,
  ClipboardList,
  Columns3,
  Download,
  Eye,
  Hospital,
  Layers3,
  ListChecks,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/AuthProvider";
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
type AuthRecord = Record<string, unknown>;

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

type StatusFilter = "all" | ProviderStatus;
type TypeFilter = "all" | ProviderType;

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
  count?: number;
  results?: unknown[];
  providers?: unknown[];
  centers?: unknown[];
  items?: unknown[];
  data?:
    | unknown[]
    | {
        results?: unknown[];
        providers?: unknown[];
        centers?: unknown[];
        items?: unknown[];
      };
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

/* ============================================================
   API Helper
============================================================ */

function apiUrl(path: string) {
  const base =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "";

  if (!base) return path;

  return `${base.replace(/\/$/, "")}${path}`;
}

/* ============================================================
   Permission Helpers
============================================================ */

function asRecord(value: unknown): AuthRecord {
  return value && typeof value === "object" ? (value as AuthRecord) : {};
}

function getNestedRecord(source: AuthRecord, keys: string[]) {
  for (const key of keys) {
    const value = source[key];

    if (value && typeof value === "object") {
      return value as AuthRecord;
    }
  }

  return {};
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .flatMap((value) => {
          if (!value) return [];

          if (typeof value === "string") return [value];

          if (Array.isArray(value)) {
            return value.flatMap((item) => {
              if (typeof item === "string") return [item];

              if (item && typeof item === "object") {
                const obj = item as AuthRecord;

                return [
                  obj.code,
                  obj.codename,
                  obj.permission,
                  obj.name,
                  obj.role,
                ].filter(Boolean) as string[];
              }

              return [];
            });
          }

          if (value && typeof value === "object") {
            const obj = value as AuthRecord;

            return [
              obj.code,
              obj.codename,
              obj.permission,
              obj.name,
              obj.role,
            ].filter(Boolean) as string[];
          }

          return [];
        })
        .map((item) => String(item).trim())
        .filter(Boolean),
    ),
  );
}

function getAuthUser(authValue: unknown): AuthRecord {
  const auth = asRecord(authValue);

  return getNestedRecord(auth, [
    "user",
    "currentUser",
    "profile",
    "account",
    "session",
    "data",
  ]);
}

function getAuthRoles(authValue: unknown): string[] {
  const auth = asRecord(authValue);
  const user = getAuthUser(authValue);

  return uniqueStrings([
    auth.role,
    auth.roles,
    auth.user_role,
    auth.userType,
    auth.user_type,
    auth.workspace,
    auth.workspaces,
    auth.type,
    user.role,
    user.roles,
    user.user_role,
    user.userType,
    user.user_type,
    user.workspace,
    user.workspaces,
    user.type,
  ]).map((item) => item.toLowerCase());
}

function getAuthPermissionCodes(authValue: unknown): string[] {
  const auth = asRecord(authValue);
  const user = getAuthUser(authValue);

  const authPermissions = asRecord(auth.permissions);
  const userPermissions = asRecord(user.permissions);
  const authProfilePermissions = asRecord(auth.profile_permissions);
  const userProfilePermissions = asRecord(user.profile_permissions);

  return uniqueStrings([
    auth.permission_codes,
    auth.permissions,
    auth.codes,
    auth.profile_permissions,
    authPermissions.codes,
    authProfilePermissions.codes,
    user.permission_codes,
    user.permissions,
    user.codes,
    user.profile_permissions,
    userPermissions.codes,
    userProfilePermissions.codes,
  ]);
}

function isAuthResolving(authValue: unknown) {
  const auth = asRecord(authValue);

  return Boolean(
    auth.isLoading ||
      auth.loading ||
      auth.isInitializing ||
      auth.initializing ||
      auth.pending,
  );
}

function isSystemAdmin(authValue: unknown) {
  const auth = asRecord(authValue);
  const user = getAuthUser(authValue);
  const roles = getAuthRoles(authValue);

  return (
    Boolean(auth.is_superuser) ||
    Boolean(auth.isSuperuser) ||
    Boolean(auth.is_system_admin) ||
    Boolean(auth.isSystemAdmin) ||
    Boolean(user.is_superuser) ||
    Boolean(user.isSuperuser) ||
    Boolean(user.is_system_admin) ||
    Boolean(user.isSystemAdmin) ||
    roles.some((role) =>
      [
        "system_admin",
        "superuser",
        "super_admin",
        "superadmin",
        "admin",
        "administrator",
      ].includes(role),
    )
  );
}

function hasKnownPermissionSignal(authValue: unknown) {
  return (
    getAuthRoles(authValue).length > 0 ||
    getAuthPermissionCodes(authValue).length > 0
  );
}

function hasPermissionCode(authValue: unknown, codes: string[]) {
  const permissions = getAuthPermissionCodes(authValue);

  if (permissions.length === 0) return undefined;

  return codes.some((code) => permissions.includes(code));
}

function hasSafePermission(
  authValue: unknown,
  codes: string[],
  mode: "view" | "action",
) {
  if (isSystemAdmin(authValue)) return true;

  const explicitPermission = hasPermissionCode(authValue, codes);

  if (typeof explicitPermission === "boolean") {
    return explicitPermission;
  }

  const roles = getAuthRoles(authValue);

  if (roles.length > 0) {
    if (mode === "view") {
      return roles.some((role) =>
        [
          "system_admin",
          "superuser",
          "super_admin",
          "support",
          "accountant",
          "viewer",
        ].includes(role),
      );
    }

    return roles.some((role) =>
      ["system_admin", "superuser", "super_admin"].includes(role),
    );
  }

  if (!hasKnownPermissionSignal(authValue)) {
    return true;
  }

  return mode === "view";
}

/* ============================================================
   Normalizers
============================================================ */

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

function getObjectValue(obj: Record<string, unknown>, key: string): unknown {
  const direct = obj[key];

  if (direct !== undefined && direct !== null && direct !== "") {
    return direct;
  }

  const containers = ["provider", "center", "item", "data", "profile"];

  for (const container of containers) {
    const nested = obj[container];

    if (nested && typeof nested === "object") {
      const nestedObj = nested as Record<string, unknown>;
      const value = nestedObj[key];

      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }
  }

  return undefined;
}

function extractProviders(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== "object") return [];

  const response = payload as ProvidersApiResponse;

  if (Array.isArray(response.results)) return response.results;
  if (Array.isArray(response.providers)) return response.providers;
  if (Array.isArray(response.centers)) return response.centers;
  if (Array.isArray(response.items)) return response.items;
  if (Array.isArray(response.data)) return response.data;

  if (response.data && typeof response.data === "object") {
    if (Array.isArray(response.data.results)) return response.data.results;
    if (Array.isArray(response.data.providers)) return response.data.providers;
    if (Array.isArray(response.data.centers)) return response.data.centers;
    if (Array.isArray(response.data.items)) return response.data.items;
  }

  return [];
}

function normalizeProvider(item: unknown): Provider {
  const obj = (item || {}) as Record<string, unknown>;
  const id = getObjectValue(obj, "id") ?? "";
  const name =
    getObjectValue(obj, "name") ??
    getObjectValue(obj, "provider_name") ??
    getObjectValue(obj, "center_name") ??
    "-";

  return {
    id: id as number | string,
    name: String(name || "-"),
    code: String(
      getObjectValue(obj, "code") ??
        getObjectValue(obj, "provider_code") ??
        (id ? `PRV-${id}` : "-"),
    ),
    providerType: normalizeProviderType(
      getObjectValue(obj, "provider_type") ?? getObjectValue(obj, "type"),
    ),
    status: normalizeStatus(getObjectValue(obj, "status")),
    contactPerson: String(getObjectValue(obj, "contact_person") ?? ""),
    phone: String(getObjectValue(obj, "phone") ?? ""),
    mobile: String(getObjectValue(obj, "mobile") ?? ""),
    email: String(getObjectValue(obj, "email") ?? ""),
    website: String(getObjectValue(obj, "website") ?? ""),
    city: String(getObjectValue(obj, "city") ?? ""),
    area: String(getObjectValue(obj, "area") ?? ""),
    address: String(getObjectValue(obj, "address") ?? ""),
    googleMapsLink: String(getObjectValue(obj, "google_maps_link") ?? ""),
    notes: String(getObjectValue(obj, "notes") ?? ""),
    isFeatured: Boolean(
      getObjectValue(obj, "is_featured") ?? getObjectValue(obj, "featured"),
    ),
    createdAt: String(getObjectValue(obj, "created_at") ?? ""),
    updatedAt: String(getObjectValue(obj, "updated_at") ?? ""),
    raw: obj,
  };
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    pageTitle: isArabic ? "إدارة مقدمي الخدمة" : "Providers Management",
    pageSubtitle: isArabic
      ? "متابعة مقدمي الخدمة والمراكز، حالة التفعيل، المدن، والتصنيفات التشغيلية."
      : "Monitor providers and centers, activation status, cities, and operational categories.",

    addProvider: isArabic ? "إنشاء مقدم خدمة" : "Create Provider",
    providersList: isArabic ? "قائمة مقدمي الخدمة" : "Providers List",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",

    searchPlaceholder: isArabic
      ? "ابحث باسم مقدم الخدمة أو الكود أو المدينة أو التصنيف أو بيانات التواصل..."
      : "Search by provider name, code, city, type, or contact details...",

    all: isArabic ? "الكل" : "All",
    allStatuses: isArabic ? "كل الحالات" : "All Statuses",
    allTypes: isArabic ? "كل التصنيفات" : "All Types",

    totalProviders: isArabic ? "إجمالي مقدمي الخدمة" : "Total Providers",
    activeProviders: isArabic ? "النشطون" : "Active Providers",
    featuredProviders: isArabic ? "المميزون" : "Featured Providers",
    citiesCount: isArabic ? "المدن" : "Cities",

    latestProviders: isArabic ? "أحدث مقدمي الخدمة" : "Latest Providers",
    latestProvidersDesc: isArabic
      ? "عرض مختصر لأحدث مقدمي الخدمة حسب الفلاتر الحالية."
      : "A compact view of latest providers based on current filters.",

    statusTitle: isArabic ? "حالة مقدمي الخدمة" : "Providers Status",
    statusDesc: isArabic
      ? "تحليل سريع لحالة مقدمي الخدمة والمراكز."
      : "Quick analysis of provider and center statuses.",

    quickAccessTitle: isArabic
      ? "إجراءات وحدة مقدمي الخدمة"
      : "Providers Module Actions",
    quickAccessSubtitle: isArabic
      ? "اختصارات منظمة للوصول إلى أهم صفحات وحدة مقدمي الخدمة."
      : "Organized shortcuts to the key providers module pages.",
    actionListTitle: isArabic ? "قائمة مقدمي الخدمة" : "Providers List",
    actionListDesc: isArabic
      ? "استعراض جميع مقدمي الخدمة، البحث، الفلترة، وإدارة السجلات."
      : "Browse all providers, search, filter, and manage records.",
    actionCreateTitle: isArabic ? "إنشاء مقدم خدمة" : "Create Provider",
    actionCreateDesc: isArabic
      ? "إضافة مقدم خدمة أو مركز جديد وربطه لاحقًا بالعقود والخدمات."
      : "Add a new provider or center and later connect it with contracts and services.",
    open: isArabic ? "فتح" : "Open",
    manage: isArabic ? "إدارة" : "Manage",
    viewFullList: isArabic ? "عرض القائمة الكاملة" : "View Full List",

    active: isArabic ? "نشط" : "Active",
    draft: isArabic ? "مسودة" : "Draft",
    suspended: isArabic ? "موقوف" : "Suspended",
    inactive: isArabic ? "غير نشط" : "Inactive",
    unknown: isArabic ? "غير محدد" : "Unknown",

    table: {
      provider: isArabic ? "مقدم الخدمة" : "Provider",
      type: isArabic ? "التصنيف" : "Type",
      city: isArabic ? "المدينة" : "City",
      contact: isArabic ? "التواصل" : "Contact",
      status: isArabic ? "الحالة" : "Status",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      action: isArabic ? "الإجراء" : "Action",
    },

    emptyTitle: isArabic
      ? "لا يوجد مقدمو خدمة بعد"
      : "No providers yet",
    emptyText: isArabic
      ? "عند إضافة مقدمي خدمة جدد ستظهر بياناتهم هنا مباشرة."
      : "New providers will appear here once they are created.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير كلمات البحث أو فلاتر الحالة والتصنيف."
      : "Try changing search keywords, status filters, or type filters.",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الصفحة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض بيانات مقدمي الخدمة. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view providers data. Contact your system administrator if you need access.",

    apiError: isArabic
      ? "تعذر تحميل بيانات مقدمي الخدمة."
      : "Unable to load providers data.",
    apiErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    refreshSuccess: isArabic
      ? "تم تحديث بيانات مقدمي الخدمة بنجاح."
      : "Providers data refreshed successfully.",
    exportSuccess: isArabic
      ? "تم تجهيز ملف Excel بنجاح."
      : "Excel file prepared successfully.",
    exportEmpty: isArabic
      ? "لا توجد بيانات قابلة للتصدير."
      : "No data available to export.",
    printSuccess: isArabic
      ? "تم تجهيز نافذة الطباعة."
      : "Print window prepared.",
    printError: isArabic
      ? "تعذر فتح نافذة الطباعة."
      : "Unable to open print window.",

    showing: isArabic ? "عرض" : "Showing",
    from: isArabic ? "من" : "of",
    latestRecords: isArabic ? "آخر السجلات" : "Latest records",
    generatedAt: isArabic ? "تاريخ التصدير" : "Generated At",
    reportScope: isArabic ? "نطاق التقرير" : "Report Scope",
    currentFilteredData: isArabic
      ? "حسب الفلاتر الحالية"
      : "Current filtered data",
    filterSearch: isArabic ? "البحث" : "Search",
    filterStatus: isArabic ? "فلتر الحالة" : "Status Filter",
    filterType: isArabic ? "فلتر التصنيف" : "Type Filter",
    printedAt: isArabic ? "تاريخ الطباعة" : "Printed At",
    rowsCount: isArabic ? "عدد السجلات" : "Rows Count",
    printTitle: isArabic ? "قائمة مقدمي الخدمة" : "Providers List",

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

function formatNumber(value: number | string): string {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return "0";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(numericValue);
}

function formatDate(value: string): string {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function escapeHtml(value: string | number) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

function isValidProviderId(id: Provider["id"]) {
  const value = String(id || "").trim();

  return value.length > 0 && value !== "-" && value !== "undefined";
}

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

function typeLabel(type: ProviderType, locale: AppLocale) {
  return dictionary(locale).typeLabels[type];
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

function providerIcon(type: ProviderType): LucideIcon {
  if (type === "HOSPITAL") return Hospital;
  if (type === "MEDICAL_CENTER") return Stethoscope;
  if (type === "PHARMACY") return ShieldCheck;
  if (type === "LAB") return Layers3;
  if (type === "CLINIC") return Stethoscope;

  return Building2;
}

/* ============================================================
   Skeleton
============================================================ */

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function SummaryCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <SkeletonLine className="h-7 w-20" />
                <SkeletonLine className="h-4 w-32" />
              </div>
              <SkeletonLine className="h-10 w-10 rounded-xl" />
            </div>
            <div className="mt-4 flex items-center gap-2">
              <SkeletonLine className="h-3 w-8" />
              <SkeletonLine className="h-2 flex-1" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StatusCardsSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="space-y-3 rounded-xl border bg-background/70 p-3"
        >
          <SkeletonLine className="h-7 w-14" />
          <SkeletonLine className="h-4 w-20" />
          <SkeletonLine className="h-2 w-full" />
        </div>
      ))}
    </div>
  );
}

function TableRowsSkeleton({ columnsCount }: { columnsCount: number }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columnsCount }).map((__, columnIndex) => (
            <TableCell key={columnIndex}>
              <SkeletonLine
                className={
                  columnIndex === 0
                    ? "h-9 w-56 rounded-lg"
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
   Export / Print
============================================================ */

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
          <tr><td class="section" colspan="${colspan}">
            ${options.locale === "ar" ? "ملخص القائمة" : "List Summary"}
          </td></tr>
          ${summaryHtml}
          <tr><td colspan="${colspan}"></td></tr>
          <tr><td class="section" colspan="${colspan}">
            ${options.locale === "ar" ? "الفلاتر المستخدمة" : "Applied Filters"}
          </td></tr>
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

function buildPrintHtml({
  locale,
  title,
  rows,
  t,
}: {
  locale: AppLocale;
  title: string;
  rows: Provider[];
  t: ReturnType<typeof dictionary>;
}) {
  const isArabic = locale === "ar";
  const now = new Date().toLocaleString("en-US");

  const tableRows = rows
    .map(
      (provider, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(provider.name || "-")}</td>
          <td>${escapeHtml(provider.code || "-")}</td>
          <td>${escapeHtml(typeLabel(provider.providerType, locale))}</td>
          <td>${escapeHtml(provider.city || "-")}</td>
          <td>${escapeHtml(provider.phone || provider.mobile || "-")}</td>
          <td>${escapeHtml(statusLabel(provider.status, locale))}</td>
          <td>${escapeHtml(formatDate(provider.createdAt))}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <!doctype html>
    <html lang="${locale}" dir="${isArabic ? "rtl" : "ltr"}">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 24px;
            font-family: Arial, Tahoma, sans-serif;
            color: #111827;
            background: #ffffff;
            direction: ${isArabic ? "rtl" : "ltr"};
            text-align: ${isArabic ? "right" : "left"};
          }
          .print-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 16px;
            margin-bottom: 18px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 14px;
          }
          h1 {
            margin: 0;
            font-size: 22px;
            font-weight: 800;
          }
          .meta {
            margin-top: 8px;
            color: #6b7280;
            font-size: 12px;
            line-height: 1.8;
          }
          .badge {
            display: inline-block;
            border: 1px solid #d1d5db;
            border-radius: 999px;
            padding: 4px 10px;
            font-size: 12px;
            color: #374151;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          th {
            background: #f3f4f6;
            color: #111827;
            font-weight: 700;
          }
          th,
          td {
            border: 1px solid #e5e7eb;
            padding: 9px 8px;
            text-align: ${isArabic ? "right" : "left"};
            vertical-align: top;
          }
          tr:nth-child(even) td {
            background: #fafafa;
          }
          @page {
            size: A4 landscape;
            margin: 12mm;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>

      <body>
        <div class="print-header">
          <div>
            <h1>${escapeHtml(title)}</h1>
            <div class="meta">
              <div>${escapeHtml(t.printedAt)}: ${escapeHtml(now)}</div>
              <div>${escapeHtml(t.rowsCount)}: ${formatNumber(rows.length)}</div>
            </div>
          </div>
          <div class="badge">Primey Care</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${escapeHtml(t.table.provider)}</th>
              <th>Code</th>
              <th>${escapeHtml(t.table.type)}</th>
              <th>${escapeHtml(t.table.city)}</th>
              <th>${escapeHtml(t.table.contact)}</th>
              <th>${escapeHtml(t.table.status)}</th>
              <th>${escapeHtml(t.table.createdAt)}</th>
            </tr>
          </thead>
          <tbody>
            ${
              tableRows ||
              `<tr><td colspan="8" style="text-align:center">${escapeHtml(t.emptyTitle)}</td></tr>`
            }
          </tbody>
        </table>

        <script>
          window.addEventListener("load", () => {
            window.focus();
            window.print();
          });
        </script>
      </body>
    </html>
  `;
}

/* ============================================================
   Page
============================================================ */

export default function SystemProvidersPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [errorMessage, setErrorMessage] = useState("");

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canViewProviders = hasSafePermission(
    auth,
    ["providers.view", "providers.list", "centers.view", "centers.list"],
    "view",
  );

  const canCreateProviders = hasSafePermission(
    auth,
    ["providers.create", "centers.create"],
    "action",
  );

  const canExportProviders = hasSafePermission(
    auth,
    ["providers.export", "centers.export", "reports.export"],
    "action",
  );

  const canPrintProviders = hasSafePermission(
    auth,
    ["providers.print", "centers.print", "reports.print"],
    "action",
  );

  const canViewProviderDetails = hasSafePermission(
    auth,
    ["providers.view", "providers.detail", "centers.view", "centers.detail"],
    "view",
  );

  const stats = useMemo(() => {
    const total = providers.length;
    const active = providers.filter((item) => item.status === "ACTIVE").length;
    const inactive = providers.filter((item) => item.status === "INACTIVE").length;
    const suspended = providers.filter(
      (item) => item.status === "SUSPENDED",
    ).length;
    const draft = providers.filter((item) => item.status === "DRAFT").length;
    const featured = providers.filter((item) => item.isFeatured).length;
    const cities = new Set(
      providers.map((item) => item.city.trim()).filter(Boolean),
    ).size;

    return {
      total,
      active,
      inactive,
      suspended,
      draft,
      featured,
      cities,
    };
  }, [providers]);

  const filteredProviders = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return providers.filter((provider) => {
      const matchesStatus =
        statusFilter === "all" ? true : provider.status === statusFilter;

      const matchesType =
        typeFilter === "all" ? true : provider.providerType === typeFilter;

      const matchesQuery = !cleanQuery
        ? true
        : [
            provider.name,
            provider.code,
            provider.city,
            provider.area,
            provider.address,
            provider.contactPerson,
            provider.phone,
            provider.mobile,
            provider.email,
            provider.status,
            provider.providerType,
            statusLabel(provider.status, locale),
            typeLabel(provider.providerType, locale),
          ]
            .join(" ")
            .toLowerCase()
            .includes(cleanQuery);

      return matchesStatus && matchesType && matchesQuery;
    });
  }, [locale, providers, query, statusFilter, typeFilter]);

  const latestProviders = useMemo(
    () =>
      [...filteredProviders]
        .sort((a, b) => {
          const first = new Date(a.createdAt || a.updatedAt || 0).getTime();
          const second = new Date(b.createdAt || b.updatedAt || 0).getTime();

          return second - first;
        })
        .slice(0, 8),
    [filteredProviders],
  );

  const hasSearchOrFilter =
    query.trim().length > 0 || statusFilter !== "all" || typeFilter !== "all";

  const statusFilters = useMemo(
    () => [
      {
        value: "all" as StatusFilter,
        label: t.allStatuses,
        count: providers.length,
      },
      {
        value: "ACTIVE" as StatusFilter,
        label: t.active,
        count: stats.active,
      },
      {
        value: "DRAFT" as StatusFilter,
        label: t.draft,
        count: stats.draft,
      },
      {
        value: "SUSPENDED" as StatusFilter,
        label: t.suspended,
        count: stats.suspended,
      },
      {
        value: "INACTIVE" as StatusFilter,
        label: t.inactive,
        count: stats.inactive,
      },
    ],
    [providers.length, stats, t],
  );

  const typeFilters = useMemo(
    () => [
      {
        value: "all" as TypeFilter,
        label: t.allTypes,
        count: providers.length,
      },
      ...(
        [
          "HOSPITAL",
          "MEDICAL_CENTER",
          "PHARMACY",
          "LAB",
          "CLINIC",
          "PARTNER",
          "OTHER",
        ] as ProviderType[]
      ).map((type) => ({
        value: type as TypeFilter,
        label: typeLabel(type, locale),
        count: providers.filter((item) => item.providerType === type).length,
      })),
    ],
    [locale, providers, t.allTypes],
  );

  const summaryCards = useMemo(
    () => [
      {
        title: t.totalProviders,
        value: stats.total,
        icon: Building2,
        helper: t.activeProviders,
        helperValue: formatNumber(stats.active),
        percent: stats.total > 0 ? 100 : 0,
      },
      {
        title: t.activeProviders,
        value: stats.active,
        icon: BadgeCheck,
        helper: t.totalProviders,
        helperValue: `${percent(stats.active, stats.total)}%`,
        percent: percent(stats.active, stats.total),
      },
      {
        title: t.featuredProviders,
        value: stats.featured,
        icon: Sparkles,
        helper: t.totalProviders,
        helperValue: `${percent(stats.featured, stats.total)}%`,
        percent: percent(stats.featured, stats.total),
      },
      {
        title: t.citiesCount,
        value: stats.cities,
        icon: MapPin,
        helper: t.totalProviders,
        helperValue: formatNumber(stats.total),
        percent: stats.total > 0 ? 100 : 0,
      },
    ],
    [stats, t],
  );

  const statusCards = useMemo(
    () => [
      {
        title: t.active,
        value: stats.active,
        icon: BadgeCheck,
        percent: percent(stats.active, stats.total),
        filter: "ACTIVE" as StatusFilter,
      },
      {
        title: t.draft,
        value: stats.draft,
        icon: Layers3,
        percent: percent(stats.draft, stats.total),
        filter: "DRAFT" as StatusFilter,
      },
      {
        title: t.suspended,
        value: stats.suspended,
        icon: XCircle,
        percent: percent(stats.suspended, stats.total),
        filter: "SUSPENDED" as StatusFilter,
      },
      {
        title: t.inactive,
        value: stats.inactive,
        icon: ShieldCheck,
        percent: percent(stats.inactive, stats.total),
        filter: "INACTIVE" as StatusFilter,
      },
      {
        title: t.featuredProviders,
        value: stats.featured,
        icon: Sparkles,
        percent: percent(stats.featured, stats.total),
        filter: "all" as StatusFilter,
      },
    ],
    [stats, t],
  );

  const moduleActions = useMemo(
    () =>
      [
        canViewProviders
          ? {
              title: t.actionListTitle,
              description: t.actionListDesc,
              href: "/system/providers/list",
              icon: ListChecks,
              badge: `${formatNumber(stats.total)}`,
              cta: t.manage,
            }
          : null,
        canCreateProviders
          ? {
              title: t.actionCreateTitle,
              description: t.actionCreateDesc,
              href: "/system/providers/create",
              icon: Plus,
              badge: isArabic ? "جديد" : "New",
              cta: t.open,
            }
          : null,
      ].filter(Boolean) as Array<{
        title: string;
        description: string;
        href: string;
        icon: LucideIcon;
        badge: string;
        cta: string;
      }>,
    [canCreateProviders, canViewProviders, isArabic, stats.total, t],
  );

  const loadProviders = useCallback(
    async (showToast = false) => {
      if (!canViewProviders) {
        setIsLoading(false);
        setProviders([]);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");

        const response = await fetch(apiUrl("/api/providers/?page_size=100"), {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        const payload = (await response.json().catch(() => null)) as
          | ProvidersApiResponse
          | null;

        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.message || `HTTP ${response.status}`);
        }

        setProviders(extractProviders(payload).map(normalizeProvider));

        if (showToast) {
          toast.success(t.refreshSuccess);
        }
      } catch (error) {
        console.error("Failed to load providers:", error);
        setProviders([]);
        setErrorMessage(t.apiError);
        toast.error(t.apiError);
      } finally {
        setIsLoading(false);
      }
    },
    [canViewProviders, t.apiError, t.refreshSuccess],
  );

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
  }

  function exportProviders() {
    if (!canExportProviders) return;

    if (filteredProviders.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const generatedAt = new Date();

    const statusFilterLabel =
      statusFilters.find((item) => item.value === statusFilter)?.label || t.all;

    const typeFilterLabel =
      typeFilters.find((item) => item.value === typeFilter)?.label || t.all;

    downloadExcel({
      filename: `primey-care-providers-dashboard-${generatedAt
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "مقدمو الخدمة" : "Providers",
      title: t.pageTitle,
      locale,
      summaryRows: [
        [t.generatedAt, generatedAt.toLocaleString("en-US")],
        [t.reportScope, t.currentFilteredData],
        [
          t.table.provider,
          `${formatNumber(filteredProviders.length)} / ${formatNumber(
            providers.length,
          )}`,
        ],
        [t.totalProviders, stats.total],
        [t.activeProviders, stats.active],
        [t.featuredProviders, stats.featured],
        [t.citiesCount, stats.cities],
      ],
      filterRows: [
        [t.filterSearch, query || t.all],
        [t.filterStatus, statusFilterLabel],
        [t.filterType, typeFilterLabel],
      ],
      headers: [
        t.table.provider,
        "Code",
        t.table.type,
        t.table.city,
        t.table.contact,
        "Email",
        t.table.status,
        t.table.createdAt,
      ],
      rows: filteredProviders.map((provider) => [
        provider.name || "-",
        provider.code || "-",
        typeLabel(provider.providerType, locale),
        provider.city || "-",
        provider.phone || provider.mobile || "-",
        provider.email || "-",
        statusLabel(provider.status, locale),
        formatDate(provider.createdAt),
      ]),
    });

    toast.success(t.exportSuccess);
  }

  function printProviders() {
    if (!canPrintProviders) return;

    if (filteredProviders.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) {
      toast.error(t.printError);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      buildPrintHtml({
        locale,
        title: t.printTitle,
        rows: filteredProviders,
        t,
      }),
    );
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
    if (authResolving) return;
    loadProviders(false);
  }, [authResolving, loadProviders]);

  if (!authResolving && !canViewProviders) {
    return (
      <div className="w-full space-y-4" dir={isArabic ? "rtl" : "ltr"}>
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 shadow-sm">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <XCircle className="h-5 w-5" />
            </div>

            <div>
              <p className="font-semibold text-destructive">
                {t.accessDeniedTitle}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.accessDeniedText}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4" dir={isArabic ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t.pageTitle}
          </h1>

          <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
            {t.pageSubtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadProviders(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refresh}</span>
          </Button>

          {canExportProviders ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={exportProviders}
              disabled={
                isLoading ||
                filteredProviders.length === 0 ||
                Boolean(errorMessage)
              }
            >
              <Download className="h-4 w-4" />
              <span>{t.exportExcel}</span>
            </Button>
          ) : null}

          {canPrintProviders ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={printProviders}
              disabled={
                isLoading ||
                filteredProviders.length === 0 ||
                Boolean(errorMessage)
              }
            >
              <Printer className="h-4 w-4" />
              <span>{t.print}</span>
            </Button>
          ) : null}

          {canViewProviders ? (
            <Link href="/system/providers/list">
              <Button
                variant="outline"
                className="h-10 w-full rounded-xl sm:w-auto"
              >
                <ListChecks className="h-4 w-4" />
                <span>{t.providersList}</span>
              </Button>
            </Link>
          ) : null}

          {canCreateProviders ? (
            <Link href="/system/providers/create">
              <Button className="h-10 w-full rounded-xl sm:w-auto">
                <Plus className="h-4 w-4" />
                <span>{t.addProvider}</span>
              </Button>
            </Link>
          ) : null}
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
                <p className="font-semibold text-destructive">
                  {errorMessage}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.apiErrorHint}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => loadProviders(true)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!errorMessage ? (
        <>
          {/* Summary */}
          {isLoading ? (
            <SummaryCardsSkeleton />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((item) => {
                const Icon = item.icon;

                return (
                  <Card
                    key={item.title}
                    className="rounded-2xl border bg-card shadow-sm"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-2xl font-bold">
                            {formatNumber(item.value)}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {item.title}
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

                      <div className="mt-2 text-xs text-muted-foreground">
                        {item.helper}: {item.helperValue}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Status */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                {t.statusTitle}
              </CardTitle>
              <CardDescription>{t.statusDesc}</CardDescription>
            </CardHeader>

            <CardContent>
              {isLoading ? (
                <StatusCardsSkeleton />
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {statusCards.map((card) => {
                    const Icon = card.icon;

                    return (
                      <button
                        key={card.title}
                        type="button"
                        className="space-y-2 rounded-xl border bg-background/70 p-3 text-start transition hover:bg-muted/40"
                        onClick={() => setStatusFilter(card.filter)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-2xl font-bold">
                            {formatNumber(card.value)}
                          </p>
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm text-muted-foreground">
                              {card.title}
                            </p>
                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              {formatNumber(card.percent)}%
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
            </CardContent>
          </Card>

          {/* Providers Table */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="flex flex-col gap-3 pb-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-base font-bold">
                  {t.latestProviders}
                </CardTitle>
                <CardDescription className="mt-1 text-sm leading-6">
                  {t.latestProvidersDesc}
                </CardDescription>
              </div>

              {canViewProviders ? (
                <Link href="/system/providers/list">
                  <Button variant="outline" className="h-9 rounded-xl">
                    <ListChecks className="h-4 w-4" />
                    <span>{t.viewFullList}</span>
                  </Button>
                </Link>
              ) : null}
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Search Row */}
              <div className="relative w-full">
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

              {/* Filters Row */}
              <div className="grid gap-3">
                <div className="flex flex-wrap gap-2">
                  {statusFilters.map((item) => {
                    const isSelected = statusFilter === item.value;

                    return (
                      <Button
                        key={item.value}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        className="h-10 rounded-xl"
                        onClick={() => setStatusFilter(item.value)}
                      >
                        <span>{item.label}</span>
                        <Badge
                          variant={isSelected ? "secondary" : "outline"}
                          className="ms-1 rounded-full"
                        >
                          {formatNumber(item.count)}
                        </Badge>
                      </Button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    {typeFilters.map((item) => {
                      const isSelected = typeFilter === item.value;

                      return (
                        <Button
                          key={item.value}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          className="h-10 rounded-xl"
                          onClick={() => setTypeFilter(item.value)}
                        >
                          <span>{item.label}</span>
                          <Badge
                            variant={isSelected ? "secondary" : "outline"}
                            className="ms-1 rounded-full"
                          >
                            {formatNumber(item.count)}
                          </Badge>
                        </Button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" className="h-10 rounded-xl">
                      <Columns3 className="h-4 w-4" />
                      {isArabic ? "الأعمدة" : "Columns"}
                    </Button>

                    {hasSearchOrFilter ? (
                      <Button
                        variant="outline"
                        className="h-10 rounded-xl"
                        onClick={clearFilters}
                      >
                        {t.clearFilters}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.table.provider}</TableHead>
                        <TableHead>{t.table.type}</TableHead>
                        <TableHead>{t.table.city}</TableHead>
                        <TableHead>{t.table.contact}</TableHead>
                        <TableHead>{t.table.status}</TableHead>
                        <TableHead>{t.table.createdAt}</TableHead>
                        {canViewProviderDetails ? (
                          <TableHead>{t.table.action}</TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {isLoading ? (
                        <TableRowsSkeleton
                          columnsCount={canViewProviderDetails ? 7 : 6}
                        />
                      ) : latestProviders.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={canViewProviderDetails ? 7 : 6}
                            className="h-36 text-center"
                          >
                            <div className="mx-auto max-w-md space-y-2">
                              <p className="font-semibold">
                                {hasSearchOrFilter
                                  ? t.noResultsTitle
                                  : t.emptyTitle}
                              </p>
                              <p className="text-sm text-muted-foreground">
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
                      ) : (
                        latestProviders.map((provider) => {
                          const Icon = providerIcon(provider.providerType);

                          return (
                            <TableRow key={`${provider.id}-${provider.code}`}>
                              <TableCell>
                                <div className="flex min-w-[220px] items-center gap-3">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted">
                                    <Icon className="h-4 w-4" />
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="truncate font-medium">
                                        {provider.name || "-"}
                                      </p>

                                      {provider.isFeatured ? (
                                        <Sparkles className="h-3.5 w-3.5 shrink-0 fill-orange-400 text-orange-400" />
                                      ) : null}
                                    </div>

                                    <p className="truncate text-xs text-muted-foreground">
                                      {provider.code || "-"}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>

                              <TableCell>
                                <Badge variant="secondary" className="rounded-full">
                                  {typeLabel(provider.providerType, locale)}
                                </Badge>
                              </TableCell>

                              <TableCell>
                                <div className="min-w-[140px]">
                                  <p className="truncate">
                                    {provider.city || "-"}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {provider.area || provider.address || "-"}
                                  </p>
                                </div>
                              </TableCell>

                              <TableCell>
                                <div className="min-w-[150px]">
                                  <p className="truncate">
                                    {provider.phone ||
                                      provider.mobile ||
                                      provider.email ||
                                      "-"}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {provider.contactPerson || "-"}
                                  </p>
                                </div>
                              </TableCell>

                              <TableCell>
                                {statusBadge(provider.status, locale)}
                              </TableCell>

                              <TableCell>
                                {formatDate(provider.createdAt)}
                              </TableCell>

                              {canViewProviderDetails ? (
                                <TableCell>
                                  {isValidProviderId(provider.id) ? (
                                    <Link href={`/system/providers/${provider.id}`}>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 rounded-lg"
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    </Link>
                                  ) : null}
                                </TableCell>
                              ) : null}
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <p>
                  {t.showing} {formatNumber(latestProviders.length)} {t.from}{" "}
                  {formatNumber(filteredProviders.length)} · {t.latestRecords}
                </p>

                {canViewProviders ? (
                  <Link href="/system/providers/list">
                    <Button variant="outline" size="sm" className="rounded-xl">
                      <ListChecks className="h-4 w-4" />
                      {t.viewFullList}
                    </Button>
                  </Link>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* Action Cards */}
          {moduleActions.length > 0 ? (
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">
                  {t.quickAccessTitle}
                </CardTitle>
                <CardDescription className="leading-6">
                  {t.quickAccessSubtitle}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
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

                                <Badge
                                  variant="secondary"
                                  className="rounded-full"
                                >
                                  {item.badge}
                                </Badge>
                              </div>

                              <div>
                                <p className="font-semibold">{item.title}</p>
                                <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                                  {item.description}
                                </p>
                              </div>

                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-xl"
                              >
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
          ) : null}
        </>
      ) : null}
    </div>
  );
}