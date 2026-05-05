"use client";

/* ============================================================
   📂 app/system/providers/list/page.tsx
   🧠 Primey Care | Providers List
   ------------------------------------------------------------
   ✅ المرحلة 17 + المرحلة 2
   ✅ مبني بنفس نمط قائمة المراكز/العملاء المعتمد
   ✅ البحث في صف مستقل
   ✅ الفلاتر والأعمدة في صف مستقل تحت البحث
   ✅ Excel export بصيغة .xls HTML Workbook
   ✅ Web PDF Print
   ✅ Error State مستقل
   ✅ Empty State ذكي
   ✅ Loading Skeleton
   ✅ حماية روابط التفاصيل والأزرار والطلبات
   ✅ fallback آمن لـ system_admin / superadmin
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ استخدام toast من sonner
   ✅ بدون localhost hardcoded
   ✅ الأرقام تبقى بالإنجليزية
============================================================ */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  ArrowLeft,
  BadgeCheck,
  Building2,
  ColumnsIcon,
  Copy,
  Download,
  Eye,
  Hospital,
  Layers3,
  Loader2,
  MapPin,
  MoreHorizontal,
  Phone,
  PlusCircle,
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

type SortKey =
  | "name"
  | "code"
  | "providerType"
  | "city"
  | "status"
  | "createdAt";

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

type VisibleColumns = {
  code: boolean;
  name: boolean;
  providerType: boolean;
  city: boolean;
  contact: boolean;
  status: boolean;
  featured: boolean;
  createdAt: boolean;
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

const PAGE_SIZE = 10;

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
    title: isArabic ? "قائمة مقدمي الخدمة" : "Providers List",
    subtitle: isArabic
      ? "استعراض مقدمي الخدمة والمراكز مع البحث، الفلاتر، الأعمدة، الفرز، التصدير والطباعة."
      : "Browse providers and centers with search, filters, columns, sorting, export, and print.",

    back: isArabic ? "لوحة مقدمي الخدمة" : "Providers Overview",
    addProvider: isArabic ? "إنشاء مقدم خدمة" : "Create Provider",
    refresh: isArabic ? "تحديث" : "Refresh",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",
    columns: isArabic ? "الأعمدة" : "Columns",

    tableTitle: isArabic ? "بيانات مقدمي الخدمة" : "Providers Data",
    tableSubtitle: isArabic
      ? "استعرض السجلات، رتّب البيانات، وخصص الأعمدة حسب احتياجك."
      : "Browse records, sort data, and customize columns as needed.",

    searchPlaceholder: isArabic
      ? "ابحث باسم مقدم الخدمة أو الكود أو المدينة أو التصنيف أو بيانات التواصل..."
      : "Search by provider name, code, city, type, or contact details...",

    all: isArabic ? "الكل" : "All",
    allStatuses: isArabic ? "كل الحالات" : "All Statuses",
    allTypes: isArabic ? "كل التصنيفات" : "All Types",

    active: isArabic ? "نشط" : "Active",
    draft: isArabic ? "مسودة" : "Draft",
    suspended: isArabic ? "موقوف" : "Suspended",
    inactive: isArabic ? "غير نشط" : "Inactive",
    unknown: isArabic ? "غير محدد" : "Unknown",

    totalProviders: isArabic ? "إجمالي مقدمي الخدمة" : "Total Providers",
    activeProviders: isArabic ? "النشطون" : "Active Providers",
    featuredProviders: isArabic ? "المميزون" : "Featured Providers",
    citiesCount: isArabic ? "المدن" : "Cities",

    selectedRows: isArabic ? "صفوف محددة" : "row(s) selected",
    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",
    page: isArabic ? "صفحة" : "Page",
    from: isArabic ? "من" : "of",

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

    actions: isArabic ? "الإجراءات" : "Actions",
    viewDetails: isArabic ? "عرض التفاصيل" : "View Details",
    copyCode: isArabic ? "نسخ الكود" : "Copy Code",
    copyId: isArabic ? "نسخ المعرف" : "Copy ID",
    copyPhone: isArabic ? "نسخ رقم التواصل" : "Copy Contact Number",
    copied: isArabic ? "تم النسخ بنجاح" : "Copied successfully",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الصفحة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض بيانات مقدمي الخدمة. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view providers data. Contact your system administrator if you need access.",

    loadError: isArabic
      ? "تعذر تحميل قائمة مقدمي الخدمة."
      : "Unable to load providers list.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    refreshSuccess: isArabic
      ? "تم تحديث قائمة مقدمي الخدمة بنجاح."
      : "Providers list refreshed successfully.",
    exportSuccess: isArabic
      ? "تم تجهيز ملف Excel بنجاح."
      : "Excel file prepared successfully.",
    exportEmpty: isArabic
      ? "لا توجد بيانات قابلة للتصدير."
      : "No data available to export.",
    printReady: isArabic
      ? "تم تجهيز نافذة الطباعة."
      : "Print window prepared.",
    printError: isArabic
      ? "تعذر فتح نافذة الطباعة."
      : "Unable to open print window.",

    generatedAt: isArabic ? "تاريخ التصدير" : "Generated At",
    reportScope: isArabic ? "نطاق التقرير" : "Report Scope",
    currentFilteredData: isArabic
      ? "حسب الفلاتر الحالية"
      : "Current filtered data",
    selectedScope: isArabic ? "الصفوف المحددة" : "Selected rows",
    filterSearch: isArabic ? "البحث" : "Search",
    filterStatus: isArabic ? "فلتر الحالة" : "Status Filter",
    filterType: isArabic ? "فلتر التصنيف" : "Type Filter",

    table: {
      id: isArabic ? "المعرف" : "ID",
      code: isArabic ? "الكود" : "Code",
      provider: isArabic ? "مقدم الخدمة" : "Provider",
      type: isArabic ? "التصنيف" : "Type",
      city: isArabic ? "المدينة" : "City",
      area: isArabic ? "الحي / المنطقة" : "Area",
      address: isArabic ? "العنوان" : "Address",
      contact: isArabic ? "التواصل" : "Contact",
      phone: isArabic ? "الهاتف" : "Phone",
      mobile: isArabic ? "الجوال" : "Mobile",
      email: isArabic ? "البريد الإلكتروني" : "Email",
      contactPerson: isArabic ? "مسؤول التواصل" : "Contact Person",
      status: isArabic ? "الحالة" : "Status",
      featured: isArabic ? "مميز" : "Featured",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      updatedAt: isArabic ? "آخر تحديث" : "Updated At",
      actions: isArabic ? "الإجراء" : "Action",
    },

    yes: isArabic ? "نعم" : "Yes",
    no: isArabic ? "لا" : "No",
    printTitle: isArabic ? "قائمة مقدمي الخدمة" : "Providers List",
    printedAt: isArabic ? "تاريخ الطباعة" : "Printed At",
    rowsCount: isArabic ? "عدد السجلات" : "Rows Count",

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

function getColumnLabels(locale: AppLocale) {
  const t = dictionary(locale);

  return {
    code: t.table.code,
    name: t.table.provider,
    providerType: t.table.type,
    city: t.table.city,
    contact: t.table.contact,
    status: t.table.status,
    featured: t.table.featured,
    createdAt: t.table.createdAt,
    actions: t.actions,
  } satisfies Record<keyof VisibleColumns, string>;
}

function copyToClipboard(value: string, successMessage: string) {
  if (!value || value === "-") return;

  navigator.clipboard.writeText(value);
  toast.success(successMessage);
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
          <td>${escapeHtml(provider.area || "-")}</td>
          <td>${escapeHtml(provider.phone || provider.mobile || "-")}</td>
          <td>${escapeHtml(provider.email || "-")}</td>
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
              <th>${escapeHtml(t.table.code)}</th>
              <th>${escapeHtml(t.table.type)}</th>
              <th>${escapeHtml(t.table.city)}</th>
              <th>${escapeHtml(t.table.area)}</th>
              <th>${escapeHtml(t.table.phone)}</th>
              <th>${escapeHtml(t.table.email)}</th>
              <th>${escapeHtml(t.table.status)}</th>
              <th>${escapeHtml(t.table.createdAt)}</th>
            </tr>
          </thead>
          <tbody>
            ${
              tableRows ||
              `<tr><td colspan="10" style="text-align:center">${escapeHtml(t.emptyTitle)}</td></tr>`
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
   Skeleton
============================================================ */

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
                  columnIndex === 2
                    ? "h-10 w-56 rounded-lg"
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

export default function SystemProvidersListPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [pageIndex, setPageIndex] = useState(0);

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    code: true,
    name: true,
    providerType: true,
    city: true,
    contact: true,
    status: true,
    featured: true,
    createdAt: true,
    actions: true,
  });

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

  const safeVisibleColumns = useMemo<VisibleColumns>(
    () => ({
      ...visibleColumns,
      actions: visibleColumns.actions && canViewProviderDetails,
    }),
    [canViewProviderDetails, visibleColumns],
  );

  const columnLabels = useMemo(() => getColumnLabels(locale), [locale]);

  const stats = useMemo(() => {
    const total = providers.length;
    const active = providers.filter((item) => item.status === "ACTIVE").length;
    const featured = providers.filter((item) => item.isFeatured).length;
    const cities = new Set(
      providers.map((item) => item.city.trim()).filter(Boolean),
    ).size;

    return {
      total,
      active,
      featured,
      cities,
    };
  }, [providers]);

  const statusOptions = useMemo(
    () => [
      {
        value: "all" as StatusFilter,
        label: t.allStatuses,
        count: providers.length,
      },
      {
        value: "ACTIVE" as StatusFilter,
        label: t.active,
        count: providers.filter((item) => item.status === "ACTIVE").length,
      },
      {
        value: "DRAFT" as StatusFilter,
        label: t.draft,
        count: providers.filter((item) => item.status === "DRAFT").length,
      },
      {
        value: "SUSPENDED" as StatusFilter,
        label: t.suspended,
        count: providers.filter((item) => item.status === "SUSPENDED").length,
      },
      {
        value: "INACTIVE" as StatusFilter,
        label: t.inactive,
        count: providers.filter((item) => item.status === "INACTIVE").length,
      },
    ],
    [providers, t],
  );

  const typeOptions = useMemo(
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

  const sortedProviders = useMemo(() => {
    const rows = [...filteredProviders];

    rows.sort((firstProvider, secondProvider) => {
      let first: string | number = "";
      let second: string | number = "";

      if (sortKey === "name") {
        first = firstProvider.name.toLowerCase();
        second = secondProvider.name.toLowerCase();
      }

      if (sortKey === "code") {
        first = firstProvider.code.toLowerCase();
        second = secondProvider.code.toLowerCase();
      }

      if (sortKey === "providerType") {
        first = firstProvider.providerType.toLowerCase();
        second = secondProvider.providerType.toLowerCase();
      }

      if (sortKey === "city") {
        first = firstProvider.city.toLowerCase();
        second = secondProvider.city.toLowerCase();
      }

      if (sortKey === "status") {
        first = firstProvider.status.toLowerCase();
        second = secondProvider.status.toLowerCase();
      }

      if (sortKey === "createdAt") {
        first = new Date(
          firstProvider.createdAt || firstProvider.updatedAt || 0,
        ).getTime();
        second = new Date(
          secondProvider.createdAt || secondProvider.updatedAt || 0,
        ).getTime();
      }

      if (first < second) return sortDirection === "asc" ? -1 : 1;
      if (first > second) return sortDirection === "asc" ? 1 : -1;

      return 0;
    });

    return rows;
  }, [filteredProviders, sortDirection, sortKey]);

  const exportRows = useMemo(() => {
    if (selectedIds.length > 0) {
      return sortedProviders.filter((provider) =>
        selectedIds.includes(provider.id),
      );
    }

    return sortedProviders;
  }, [selectedIds, sortedProviders]);

  const pageCount = Math.max(1, Math.ceil(sortedProviders.length / PAGE_SIZE));

  const pageRows = useMemo(() => {
    const start = pageIndex * PAGE_SIZE;
    return sortedProviders.slice(start, start + PAGE_SIZE);
  }, [pageIndex, sortedProviders]);

  const selectedOnPage = pageRows.filter((row) =>
    selectedIds.includes(row.id),
  ).length;

  const allPageSelected =
    pageRows.length > 0 && selectedOnPage === pageRows.length;

  const hasSearchOrFilter =
    query.trim().length > 0 || statusFilter !== "all" || typeFilter !== "all";

  const visibleTableColumnsCount =
    1 + Object.values(safeVisibleColumns).filter(Boolean).length;

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
    setStatusFilter("all");
    setTypeFilter("all");
  }

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

        const response = await fetch(apiUrl("/api/providers/?page_size=200"), {
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
        console.error("Failed to load providers list:", error);
        setProviders([]);
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [canViewProviders, t.loadError, t.refreshSuccess],
  );

  function exportExcel() {
    if (!canExportProviders) return;

    if (exportRows.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const generatedAt = new Date();

    const statusLabelText =
      statusOptions.find((item) => item.value === statusFilter)?.label || t.all;

    const typeLabelText =
      typeOptions.find((item) => item.value === typeFilter)?.label || t.all;

    downloadExcel({
      filename: `primey-care-providers-list-${generatedAt
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "قائمة مقدمي الخدمة" : "Providers List",
      title: t.title,
      locale,
      summaryRows: [
        [t.generatedAt, generatedAt.toLocaleString("en-US")],
        [
          t.reportScope,
          selectedIds.length > 0 ? t.selectedScope : t.currentFilteredData,
        ],
        [
          t.table.provider,
          `${formatNumber(exportRows.length)} / ${formatNumber(
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
        [t.filterStatus, statusLabelText],
        [t.filterType, typeLabelText],
      ],
      headers: [
        t.table.id,
        t.table.code,
        t.table.provider,
        t.table.type,
        t.table.status,
        t.table.city,
        t.table.area,
        t.table.address,
        t.table.phone,
        t.table.mobile,
        t.table.email,
        t.table.contactPerson,
        t.table.featured,
        t.table.createdAt,
        t.table.updatedAt,
      ],
      rows: exportRows.map((provider) => [
        String(provider.id || "-"),
        provider.code || "-",
        provider.name || "-",
        typeLabel(provider.providerType, locale),
        statusLabel(provider.status, locale),
        provider.city || "-",
        provider.area || "-",
        provider.address || "-",
        provider.phone || "-",
        provider.mobile || "-",
        provider.email || "-",
        provider.contactPerson || "-",
        provider.isFeatured ? t.yes : t.no,
        formatDate(provider.createdAt),
        formatDate(provider.updatedAt || provider.createdAt),
      ]),
    });

    toast.success(t.exportSuccess);
  }

  function printList() {
    if (!canPrintProviders) return;

    if (exportRows.length === 0) {
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
        rows: exportRows,
        t,
      }),
    );
    printWindow.document.close();

    toast.success(t.printReady);
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

  useEffect(() => {
    setPageIndex(0);
    setSelectedIds([]);
  }, [query, statusFilter, typeFilter]);

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
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t.title}
          </h1>

          <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
            {t.subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link href="/system/providers">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>

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
              onClick={exportExcel}
              disabled={
                isLoading || exportRows.length === 0 || Boolean(errorMessage)
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
              onClick={printList}
              disabled={
                isLoading || exportRows.length === 0 || Boolean(errorMessage)
              }
            >
              <Printer className="h-4 w-4" />
              <span>{t.print}</span>
            </Button>
          ) : null}

          {canCreateProviders ? (
            <Link href="/system/providers/create">
              <Button className="h-10 w-full rounded-xl sm:w-auto">
                <PlusCircle className="h-4 w-4" />
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
                  {t.loadErrorHint}
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
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {isLoading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <StatCardSkeleton key={index} />
                ))
              : [
                  {
                    title: t.totalProviders,
                    value: stats.total,
                    percent: stats.total > 0 ? 100 : 0,
                    icon: Building2,
                  },
                  {
                    title: t.activeProviders,
                    value: stats.active,
                    percent: percent(stats.active, stats.total),
                    icon: BadgeCheck,
                  },
                  {
                    title: t.featuredProviders,
                    value: stats.featured,
                    percent: percent(stats.featured, stats.total),
                    icon: Sparkles,
                  },
                  {
                    title: t.citiesCount,
                    value: stats.cities,
                    percent: stats.total > 0 ? 100 : 0,
                    icon: MapPin,
                  },
                ].map((item) => {
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
                      </CardContent>
                    </Card>
                  );
                })}
          </div>

          {/* Table */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                {t.tableTitle}
              </CardTitle>
              <CardDescription>{t.tableSubtitle}</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="w-full space-y-4">
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
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="grid flex-1 gap-3">
                    <div className="flex flex-wrap gap-2">
                      {statusOptions.map((item) => (
                        <Button
                          key={item.value}
                          variant={
                            statusFilter === item.value ? "default" : "outline"
                          }
                          className="h-10 rounded-xl"
                          onClick={() => setStatusFilter(item.value)}
                        >
                          <span>{item.label}</span>
                          <Badge
                            variant={
                              statusFilter === item.value
                                ? "secondary"
                                : "outline"
                            }
                            className="ms-1 rounded-full"
                          >
                            {formatNumber(item.count)}
                          </Badge>
                        </Button>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {typeOptions.map((item) => (
                        <Button
                          key={item.value}
                          variant={
                            typeFilter === item.value ? "default" : "outline"
                          }
                          className="h-10 rounded-xl"
                          onClick={() => setTypeFilter(item.value)}
                        >
                          <span>{item.label}</span>
                          <Badge
                            variant={
                              typeFilter === item.value
                                ? "secondary"
                                : "outline"
                            }
                            className="ms-1 rounded-full"
                          >
                            {formatNumber(item.count)}
                          </Badge>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
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
                        {Object.entries(visibleColumns).map(([key, value]) => {
                          if (key === "actions" && !canViewProviderDetails) {
                            return null;
                          }

                          return (
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
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border">
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

                          {safeVisibleColumns.code ? (
                            <SortableHead
                              label={t.table.code}
                              onClick={() => toggleSort("code")}
                            />
                          ) : null}

                          {safeVisibleColumns.name ? (
                            <SortableHead
                              label={t.table.provider}
                              onClick={() => toggleSort("name")}
                            />
                          ) : null}

                          {safeVisibleColumns.providerType ? (
                            <SortableHead
                              label={t.table.type}
                              onClick={() => toggleSort("providerType")}
                            />
                          ) : null}

                          {safeVisibleColumns.city ? (
                            <SortableHead
                              label={t.table.city}
                              onClick={() => toggleSort("city")}
                            />
                          ) : null}

                          {safeVisibleColumns.contact ? (
                            <TableHead>{t.table.contact}</TableHead>
                          ) : null}

                          {safeVisibleColumns.status ? (
                            <SortableHead
                              label={t.table.status}
                              onClick={() => toggleSort("status")}
                            />
                          ) : null}

                          {safeVisibleColumns.featured ? (
                            <TableHead>{t.table.featured}</TableHead>
                          ) : null}

                          {safeVisibleColumns.createdAt ? (
                            <SortableHead
                              label={t.table.createdAt}
                              onClick={() => toggleSort("createdAt")}
                            />
                          ) : null}

                          {safeVisibleColumns.actions ? (
                            <TableHead>{t.table.actions}</TableHead>
                          ) : null}
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {isLoading ? (
                          <TableRowsSkeleton
                            columnsCount={visibleTableColumnsCount}
                          />
                        ) : pageRows.length > 0 ? (
                          pageRows.map((provider) => {
                            const Icon = providerIcon(provider.providerType);

                            return (
                              <TableRow
                                key={`${provider.id}-${provider.code}`}
                                data-state={
                                  selectedIds.includes(provider.id)
                                    ? "selected"
                                    : undefined
                                }
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={selectedIds.includes(provider.id)}
                                    onCheckedChange={() =>
                                      toggleRow(provider.id)
                                    }
                                    aria-label="Select row"
                                  />
                                </TableCell>

                                {safeVisibleColumns.code ? (
                                  <TableCell className="font-medium">
                                    <div className="min-w-[120px]">
                                      <p>{provider.code || "-"}</p>
                                    </div>
                                  </TableCell>
                                ) : null}

                                {safeVisibleColumns.name ? (
                                  <TableCell>
                                    <div className="flex min-w-[240px] items-center gap-3">
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
                                          {provider.email || provider.website || "-"}
                                        </p>
                                      </div>
                                    </div>
                                  </TableCell>
                                ) : null}

                                {safeVisibleColumns.providerType ? (
                                  <TableCell>
                                    <Badge
                                      variant="secondary"
                                      className="rounded-full"
                                    >
                                      {typeLabel(provider.providerType, locale)}
                                    </Badge>
                                  </TableCell>
                                ) : null}

                                {safeVisibleColumns.city ? (
                                  <TableCell>
                                    <div className="min-w-[160px]">
                                      <p className="truncate">
                                        {provider.city || "-"}
                                      </p>
                                      <p className="truncate text-xs text-muted-foreground">
                                        {provider.area ||
                                          provider.address ||
                                          "-"}
                                      </p>
                                    </div>
                                  </TableCell>
                                ) : null}

                                {safeVisibleColumns.contact ? (
                                  <TableCell>
                                    <div className="min-w-[170px]">
                                      <div className="flex items-center gap-2">
                                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                        <p className="truncate">
                                          {provider.phone ||
                                            provider.mobile ||
                                            "-"}
                                        </p>
                                      </div>
                                      <p className="mt-1 truncate text-xs text-muted-foreground">
                                        {provider.contactPerson ||
                                          provider.email ||
                                          "-"}
                                      </p>
                                    </div>
                                  </TableCell>
                                ) : null}

                                {safeVisibleColumns.status ? (
                                  <TableCell>
                                    {statusBadge(provider.status, locale)}
                                  </TableCell>
                                ) : null}

                                {safeVisibleColumns.featured ? (
                                  <TableCell>
                                    {provider.isFeatured ? (
                                      <Badge className="rounded-full border-orange-200 bg-orange-50 px-3 py-1 text-orange-700 hover:bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300">
                                        <Sparkles className="h-3.5 w-3.5" />
                                        {t.yes}
                                      </Badge>
                                    ) : (
                                      <Badge
                                        variant="outline"
                                        className="rounded-full px-3 py-1"
                                      >
                                        {t.no}
                                      </Badge>
                                    )}
                                  </TableCell>
                                ) : null}

                                {safeVisibleColumns.createdAt ? (
                                  <TableCell>
                                    {formatDate(provider.createdAt)}
                                  </TableCell>
                                ) : null}

                                {safeVisibleColumns.actions ? (
                                  <TableCell>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          className="h-8 w-8 p-0"
                                        >
                                          <span className="sr-only">
                                            {t.actions}
                                          </span>
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>

                                      <DropdownMenuContent
                                        align={isArabic ? "start" : "end"}
                                      >
                                        <DropdownMenuLabel>
                                          {t.actions}
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator />

                                        {isValidProviderId(provider.id) ? (
                                          <DropdownMenuItem asChild>
                                            <Link
                                              href={`/system/providers/${provider.id}`}
                                            >
                                              <Eye className="h-4 w-4" />
                                              {t.viewDetails}
                                            </Link>
                                          </DropdownMenuItem>
                                        ) : null}

                                        <DropdownMenuItem
                                          onClick={() =>
                                            copyToClipboard(
                                              String(provider.code || "-"),
                                              t.copied,
                                            )
                                          }
                                        >
                                          <Copy className="h-4 w-4" />
                                          {t.copyCode}
                                        </DropdownMenuItem>

                                        <DropdownMenuItem
                                          onClick={() =>
                                            copyToClipboard(
                                              String(provider.id || "-"),
                                              t.copied,
                                            )
                                          }
                                        >
                                          <Copy className="h-4 w-4" />
                                          {t.copyId}
                                        </DropdownMenuItem>

                                        {(provider.phone || provider.mobile) ? (
                                          <DropdownMenuItem
                                            onClick={() =>
                                              copyToClipboard(
                                                provider.phone ||
                                                  provider.mobile ||
                                                  "-",
                                                t.copied,
                                              )
                                            }
                                          >
                                            <Phone className="h-4 w-4" />
                                            {t.copyPhone}
                                          </DropdownMenuItem>
                                        ) : null}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </TableCell>
                                ) : null}
                              </TableRow>
                            );
                          })
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
                                <p className="text-sm text-muted-foreground">
                                  {hasSearchOrFilter
                                    ? t.noResultsText
                                    : t.emptyText}
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
                  <div className="flex-1 text-sm text-muted-foreground">
                    {formatNumber(selectedIds.length)} /{" "}
                    {formatNumber(sortedProviders.length)} {t.selectedRows}
                  </div>

                  <div className="text-sm text-muted-foreground">
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
        </>
      ) : null}
    </div>
  );
}

/* ============================================================
   Small Components
============================================================ */

function SortableHead({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <TableHead>
      <Button className="-ms-3" variant="ghost" onClick={onClick}>
        {label}
        <ArrowDownUp className="h-3 w-3" />
      </Button>
    </TableHead>
  );
}