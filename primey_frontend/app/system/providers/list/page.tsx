"use client";

/* ============================================================
   📂 primey_frontend/app/system/providers/list/page.tsx
   🧠 Primey Care | Providers List
   ------------------------------------------------------------
   ✅ المرحلة 17 + المرحلة 2
   ✅ قائمة مقدمي الخدمة / المراكز
   ✅ تحميل سريع عبر Server Pagination
   ✅ Request واحد فقط لكل صفحة أو فلتر
   ✅ إيقاف تحميل كل صفحات مقدمي الخدمة
   ✅ إزالة بطاقات: بيانات نظامية مكتملة / لديهم شعار / مجلدات Drive
   ✅ إزالة أعمدة: الشعار / السجل والضريبة / Drive
   ✅ البحث في صف مستقل
   ✅ الفلاتر والأعمدة في صف مستقل
   ✅ الحفاظ على الفلاتر الأساسية بدون حذف
   ✅ مصدر البيانات: الكل / مستوردة / إدخال يدوي
   ✅ ترتيب الأكثر عدد طلبات
   ✅ عمود الطلبات
   ✅ Excel export بصيغة .xls HTML Workbook للصفحة الحالية
   ✅ Web PDF Print للصفحة الحالية
   ✅ Error State مستقل
   ✅ Empty State ذكي
   ✅ Loading Skeleton
   ✅ حماية روابط التفاصيل والأزرار والطلبات
   ✅ fallback آمن لـ system_admin / superuser
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ استخدام toast من sonner
   ✅ بدون localhost hardcoded
   ✅ الأرقام تبقى بالإنجليزية
============================================================ */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ColumnsIcon,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  Hospital,
  Loader2,
  MapPin,
  Phone,
  PlusCircle,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TestTube2,
  TrendingUp,
  UploadCloud,
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
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
type FeaturedFilter = "all" | "featured" | "not_featured";
type SourceFilter = "all" | "imported" | "manual";

type SortKey =
  | "nameAr"
  | "nameEn"
  | "name"
  | "code"
  | "providerType"
  | "region"
  | "city"
  | "status"
  | "ordersCount"
  | "createdAt";

type SortDirection = "asc" | "desc";

type Provider = {
  id: number | string;
  name: string;
  nameAr: string;
  nameEn: string;
  displayNameAr: string;
  displayNameEn: string;
  code: string;
  providerType: ProviderType;
  status: ProviderStatus;
  contactPerson: string;
  phone: string;
  mobile: string;
  email: string;
  website: string;
  region: string;
  city: string;
  area: string;
  street: string;
  address: string;
  googleMapsLink: string;
  sourceCategory: string;
  importSource: string;
  externalReference: string;
  ordersCount: number;
  notes: string;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
};

type ProvidersSummary = {
  total_providers: number;
  active_providers: number;
  inactive_providers: number;
  suspended_providers: number;
  draft_providers: number;
  featured_providers: number;
  imported_providers: number;
  manual_providers: number;
  total_orders: number;
};

type ProvidersPagination = {
  page: number;
  page_size: number;
  total_pages: number;
  total_items: number;
  has_next: boolean;
  has_previous: boolean;
};

type ProvidersApiResponse = {
  ok?: boolean;
  message?: string;
  detail?: string;
  error?: string;
  count?: number;
  next?: string | null;
  previous?: string | null;
  pagination?: Partial<ProvidersPagination>;
  summary?: Partial<ProvidersSummary>;
  results?: unknown[];
  providers?: unknown[];
  items?: unknown[];
  data?:
    | unknown[]
    | {
        results?: unknown[];
        providers?: unknown[];
        items?: unknown[];
      };
};

type VisibleColumns = {
  code: boolean;
  nameAr: boolean;
  nameEn: boolean;
  providerType: boolean;
  region: boolean;
  city: boolean;
  contact: boolean;
  orders: boolean;
  status: boolean;
  featured: boolean;
  sourceCategory: boolean;
  createdAt: boolean;
  actions: boolean;
};

type ExcelSheetOptions = {
  filename: string;
  title: string;
  locale: AppLocale;
  summaryRows: Array<[string, string | number]>;
  filterRows: Array<[string, string | number]>;
  headers: string[];
  rows: Array<Array<string | number>>;
};

const PAGE_SIZE = 12;

const DEFAULT_PAGINATION: ProvidersPagination = {
  page: 1,
  page_size: PAGE_SIZE,
  total_pages: 1,
  total_items: 0,
  has_next: false,
  has_previous: false,
};

const DEFAULT_SUMMARY: ProvidersSummary = {
  total_providers: 0,
  active_providers: 0,
  inactive_providers: 0,
  suspended_providers: 0,
  draft_providers: 0,
  featured_providers: 0,
  imported_providers: 0,
  manual_providers: 0,
  total_orders: 0,
};

const DEFAULT_VISIBLE_COLUMNS: VisibleColumns = {
  code: true,
  nameAr: true,
  nameEn: true,
  providerType: true,
  region: true,
  city: true,
  contact: true,
  orders: true,
  status: true,
  featured: true,
  sourceCategory: false,
  createdAt: false,
  actions: true,
};

/* ============================================================
   Locale / API Helpers
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
  } catch {
    // ignore
  }
}

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

function getNestedRecord(source: AuthRecord, keys: string[]): AuthRecord {
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

  if (typeof explicitPermission === "boolean") return explicitPermission;

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

  if (!hasKnownPermissionSignal(authValue)) return true;

  return mode === "view";
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "قائمة مقدمي الخدمة" : "Providers List",
    subtitle: isArabic
      ? "إدارة وعرض مقدمي الخدمة والمراكز الطبية مع البحث والتصفية والتصدير."
      : "Manage and browse providers and medical centers with search, filters, and export.",

    back: isArabic ? "رجوع" : "Back",
    overview: isArabic ? "لوحة مقدمي الخدمة" : "Providers Overview",
    refresh: isArabic ? "تحديث" : "Refresh",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة" : "Print",
    createProvider: isArabic ? "إضافة مقدم خدمة" : "Create Provider",
    importProviders: isArabic ? "استيراد الشبكة الطبية" : "Import Medical Network",

    search: isArabic ? "بحث سريع" : "Quick Search",
    searchPlaceholder: isArabic
      ? "ابحث بالاسم العربي أو الإنجليزي، الكود، المنطقة، المدينة، الجوال..."
      : "Search by Arabic/English name, code, region, city, phone...",
    filters: isArabic ? "الفلاتر" : "Filters",
    columns: isArabic ? "الأعمدة" : "Columns",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",

    allStatuses: isArabic ? "كل الحالات" : "All Statuses",
    allTypes: isArabic ? "كل التصنيفات" : "All Types",
    allRegions: isArabic ? "كل المناطق" : "All Regions",
    allCities: isArabic ? "كل المدن" : "All Cities",
    allFeatured: isArabic ? "الكل" : "All",
    featuredOnly: isArabic ? "المميزون فقط" : "Featured only",
    notFeaturedOnly: isArabic ? "غير المميزين" : "Not featured",
    allSources: isArabic ? "كل المصادر" : "All Sources",
    importedOnly: isArabic ? "مستوردة من الشبكة" : "Imported Network",
    manualOnly: isArabic ? "إدخال يدوي" : "Manual Entry",
    sortBy: isArabic ? "الترتيب" : "Sort",
    sortAsc: isArabic ? "تصاعدي" : "Ascending",
    sortDesc: isArabic ? "تنازلي" : "Descending",
    sortName: isArabic ? "ترتيب بالاسم العام" : "Sort by General Name",
    sortNameAr: isArabic ? "ترتيب بالاسم العربي" : "Sort by Arabic Name",
    sortNameEn: isArabic ? "ترتيب بالاسم الإنجليزي" : "Sort by English Name",
    sortMostOrders: isArabic ? "الأكثر عدد طلبات" : "Most Orders",
    sortNewest: isArabic ? "الأحدث" : "Newest",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الصفحة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض قائمة مقدمي الخدمة."
      : "You do not have permission to view providers.",

    loadError: isArabic
      ? "تعذر تحميل بيانات مقدمي الخدمة."
      : "Unable to load providers.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    refreshSuccess: isArabic
      ? "تم تحديث بيانات مقدمي الخدمة."
      : "Providers refreshed successfully.",
    exportSuccess: isArabic ? "تم تجهيز ملف Excel." : "Excel file prepared.",
    printReady: isArabic ? "تم تجهيز نافذة الطباعة." : "Print window prepared.",
    printError: isArabic ? "تعذر فتح نافذة الطباعة." : "Unable to open print window.",
    copied: isArabic ? "تم النسخ." : "Copied.",

    emptyTitle: isArabic ? "لا يوجد مقدمو خدمة" : "No providers found",
    emptyText: isArabic
      ? "ابدأ بإضافة مقدم خدمة جديد أو استيراد الشبكة الطبية من ملف Excel."
      : "Start by creating a provider or importing the medical network from Excel.",
    noSearchTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noSearchText: isArabic
      ? "جرّب تعديل البحث أو الفلاتر لعرض نتائج أكثر."
      : "Try changing search or filters to show more results.",

    totalResults: isArabic ? "إجمالي النتائج" : "Total Results",
    activeProviders: isArabic ? "النشطون" : "Active",
    featuredProviders: isArabic ? "المميزون" : "Featured",
    importedProviders: isArabic ? "مستوردة من الشبكة" : "Imported Network",
    ordersCount: isArabic ? "عدد الطلبات" : "Orders Count",

    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",
    page: isArabic ? "صفحة" : "Page",
    from: isArabic ? "من" : "of",

    table: {
      code: isArabic ? "الكود" : "Code",
      nameAr: isArabic ? "الاسم العربي" : "Arabic Name",
      nameEn: isArabic ? "الاسم الإنجليزي" : "English Name",
      type: isArabic ? "التصنيف" : "Type",
      region: isArabic ? "المنطقة" : "Region",
      city: isArabic ? "المدينة" : "City",
      contact: isArabic ? "التواصل" : "Contact",
      orders: isArabic ? "الطلبات" : "Orders",
      status: isArabic ? "الحالة" : "Status",
      featured: isArabic ? "مميز" : "Featured",
      sourceCategory: isArabic ? "تصنيف المصدر" : "Source Category",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      actions: isArabic ? "الإجراءات" : "Actions",
    },

    statuses: {
      ACTIVE: isArabic ? "نشط" : "Active",
      INACTIVE: isArabic ? "غير نشط" : "Inactive",
      SUSPENDED: isArabic ? "موقوف" : "Suspended",
      DRAFT: isArabic ? "مسودة" : "Draft",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<ProviderStatus, string>,

    types: {
      HOSPITAL: isArabic ? "مستشفى" : "Hospital",
      MEDICAL_CENTER: isArabic ? "مركز طبي" : "Medical Center",
      PHARMACY: isArabic ? "صيدلية" : "Pharmacy",
      PARTNER: isArabic ? "شريك" : "Partner",
      LAB: isArabic ? "مختبر" : "Lab",
      CLINIC: isArabic ? "عيادة" : "Clinic",
      OTHER: isArabic ? "أخرى" : "Other",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<ProviderType, string>,

    yes: isArabic ? "نعم" : "Yes",
    no: isArabic ? "لا" : "No",
    details: isArabic ? "التفاصيل" : "Details",
    printedAt: isArabic ? "تاريخ الطباعة" : "Printed At",
  };
}

/* ============================================================
   Data Helpers
============================================================ */

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (value === null || value === undefined) continue;

    const text = String(value).trim();
    if (text) return text;
  }

  return "";
}

function pickNumber(...values: unknown[]): number {
  for (const value of values) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) return numericValue;
  }

  return 0;
}

function pickBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;

  const text = String(value || "").trim().toLowerCase();

  return ["1", "true", "yes", "on", "نعم"].includes(text);
}

function normalizeStatus(value: unknown): ProviderStatus {
  const status = String(value || "").trim().toUpperCase();

  if (["ACTIVE", "INACTIVE", "SUSPENDED", "DRAFT"].includes(status)) {
    return status as ProviderStatus;
  }

  return "UNKNOWN";
}

function normalizeProviderType(value: unknown): ProviderType {
  const type = String(value || "").trim().toUpperCase();

  if (
    [
      "HOSPITAL",
      "MEDICAL_CENTER",
      "PHARMACY",
      "PARTNER",
      "LAB",
      "CLINIC",
      "OTHER",
    ].includes(type)
  ) {
    return type as ProviderType;
  }

  return "UNKNOWN";
}

function normalizeProvider(item: unknown): Provider {
  const obj = asRecord(item);

  const name = pickString(obj.name, obj.provider_name, obj.title);
  const nameAr = pickString(obj.name_ar, obj.arabic_name, obj.nameAr);
  const nameEn = pickString(obj.name_en, obj.english_name, obj.nameEn);

  return {
    id: pickString(obj.id, obj.pk, obj.provider_id),
    name,
    nameAr,
    nameEn,
    displayNameAr: pickString(obj.display_name_ar, nameAr, name),
    displayNameEn: pickString(obj.display_name_en, nameEn, name),
    code: pickString(obj.code, obj.provider_code),
    providerType: normalizeProviderType(obj.provider_type ?? obj.type),
    status: normalizeStatus(obj.status),
    contactPerson: pickString(obj.contact_person, obj.contactPerson),
    phone: pickString(obj.phone),
    mobile: pickString(obj.mobile),
    email: pickString(obj.email),
    website: pickString(obj.website),
    region: pickString(obj.region),
    city: pickString(obj.city),
    area: pickString(obj.area),
    street: pickString(obj.street),
    address: pickString(obj.address),
    googleMapsLink: pickString(obj.google_maps_link, obj.googleMapsLink),
    sourceCategory: pickString(obj.source_category, obj.sourceCategory),
    importSource: pickString(obj.import_source, obj.importSource),
    externalReference: pickString(obj.external_reference, obj.externalReference),
    ordersCount: pickNumber(
      obj.orders_count,
      obj.order_count,
      obj.total_orders,
      obj.requests_count,
      obj.completed_orders_count,
    ),
    notes: pickString(obj.notes),
    isFeatured: pickBoolean(obj.is_featured ?? obj.isFeatured),
    createdAt: pickString(obj.created_at, obj.createdAt),
    updatedAt: pickString(obj.updated_at, obj.updatedAt),
  };
}

function extractProviders(payload: ProvidersApiResponse | null): Provider[] {
  if (!payload) return [];

  const data = asRecord(payload.data);

  const source =
    payload.results ||
    payload.items ||
    payload.providers ||
    (Array.isArray(payload.data) ? payload.data : undefined) ||
    (Array.isArray(data.results) ? data.results : undefined) ||
    (Array.isArray(data.items) ? data.items : undefined) ||
    (Array.isArray(data.providers) ? data.providers : undefined) ||
    [];

  return source
    .map(normalizeProvider)
    .filter(
      (provider) =>
        provider.id || provider.name || provider.nameAr || provider.nameEn,
    );
}

function normalizePagination(
  payload: ProvidersApiResponse | null,
): ProvidersPagination {
  const pagination = payload?.pagination || {};
  const totalItems =
    Number(pagination.total_items || payload?.count || 0) || 0;
  const pageSize = Number(pagination.page_size || PAGE_SIZE) || PAGE_SIZE;
  const totalPages =
    Number(pagination.total_pages) ||
    Math.max(1, Math.ceil(totalItems / pageSize));

  return {
    page: Number(pagination.page || 1) || 1,
    page_size: pageSize,
    total_pages: Math.max(1, totalPages),
    total_items: totalItems,
    has_next: Boolean(pagination.has_next || payload?.next),
    has_previous: Boolean(pagination.has_previous || payload?.previous),
  };
}

function normalizeSummary(
  payload: ProvidersApiResponse | null,
  rows: Provider[],
): ProvidersSummary {
  const summary = payload?.summary || {};

  return {
    total_providers:
      Number(summary.total_providers) ||
      Number(payload?.count) ||
      rows.length,
    active_providers:
      Number(summary.active_providers) ||
      rows.filter((provider) => provider.status === "ACTIVE").length,
    inactive_providers:
      Number(summary.inactive_providers) ||
      rows.filter((provider) => provider.status === "INACTIVE").length,
    suspended_providers:
      Number(summary.suspended_providers) ||
      rows.filter((provider) => provider.status === "SUSPENDED").length,
    draft_providers:
      Number(summary.draft_providers) ||
      rows.filter((provider) => provider.status === "DRAFT").length,
    featured_providers:
      Number(summary.featured_providers) ||
      rows.filter((provider) => provider.isFeatured).length,
    imported_providers:
      Number(summary.imported_providers) ||
      rows.filter((provider) => provider.importSource).length,
    manual_providers:
      Number(summary.manual_providers) ||
      rows.filter((provider) => !provider.importSource).length,
    total_orders:
      Number(summary.total_orders) ||
      rows.reduce((total, provider) => total + provider.ordersCount, 0),
  };
}

function formatNumber(value: number | string): string {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return "0";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(numericValue);
}

function formatDate(value: string) {
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

function getProviderTypeLabel(type: ProviderType, locale: AppLocale) {
  return dictionary(locale).types[type] || dictionary(locale).types.UNKNOWN;
}

function getProviderStatusLabel(status: ProviderStatus, locale: AppLocale) {
  return (
    dictionary(locale).statuses[status] || dictionary(locale).statuses.UNKNOWN
  );
}

function getProviderIcon(type: ProviderType): LucideIcon {
  if (type === "HOSPITAL") return Hospital;
  if (type === "MEDICAL_CENTER") return Stethoscope;
  if (type === "LAB") return TestTube2;
  if (type === "CLINIC") return Stethoscope;
  if (type === "PHARMACY") return ShieldCheck;

  return Building2;
}

function getStatusBadgeClass(status: ProviderStatus) {
  if (status === "ACTIVE") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50";
  }

  if (status === "SUSPENDED") {
    return "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-50";
  }

  if (status === "DRAFT") {
    return "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50";
  }

  if (status === "INACTIVE") {
    return "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-50";
  }

  return "border-slate-200 bg-white text-slate-700";
}

function visibleColumnCount(columns: VisibleColumns) {
  return Object.values(columns).filter(Boolean).length;
}

function copyText(value: string, successMessage: string) {
  if (!value) return;

  navigator.clipboard
    ?.writeText(value)
    .then(() => toast.success(successMessage))
    .catch(() => toast.success(successMessage));
}

/* ============================================================
   Excel / Print
============================================================ */

function buildExcelWorkbook(options: ExcelSheetOptions) {
  const isArabic = options.locale === "ar";

  const summary = options.summaryRows
    .map(
      ([label, value]) => `
        <tr>
          <td style="font-weight:700;background:#f3f4f6;">${escapeHtml(label)}</td>
          <td>${escapeHtml(value)}</td>
        </tr>
      `,
    )
    .join("");

  const filters = options.filterRows
    .map(
      ([label, value]) => `
        <tr>
          <td style="font-weight:700;background:#f3f4f6;">${escapeHtml(label)}</td>
          <td>${escapeHtml(value)}</td>
        </tr>
      `,
    )
    .join("");

  const headers = options.headers
    .map(
      (header) =>
        `<th style="background:#432a58;color:#ffffff;">${escapeHtml(header)}</th>`,
    )
    .join("");

  const rows = options.rows
    .map(
      (row) => `
        <tr>
          ${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}
        </tr>
      `,
    )
    .join("");

  return `
    <html lang="${options.locale}" dir="${isArabic ? "rtl" : "ltr"}">
      <head>
        <meta charset="utf-8" />
      </head>
      <body>
        <h2>${escapeHtml(options.title)}</h2>
        <table border="1"><tbody>${summary}</tbody></table>
        <br />
        <table border="1"><tbody>${filters}</tbody></table>
        <br />
        <table border="1">
          <thead><tr>${headers}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `;
}

function downloadExcelFile(options: ExcelSheetOptions) {
  const html = buildExcelWorkbook(options);
  const blob = new Blob(["\ufeff", html], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = options.filename.endsWith(".xls")
    ? options.filename
    : `${options.filename}.xls`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildPrintHtml({
  locale,
  providers,
  title,
  printedAtLabel,
}: {
  locale: AppLocale;
  providers: Provider[];
  title: string;
  printedAtLabel: string;
}) {
  const t = dictionary(locale);
  const isArabic = locale === "ar";
  const now = new Date().toLocaleString("en-US");

  const rows = providers
    .map(
      (provider) => `
        <tr>
          <td>${escapeHtml(provider.code || "-")}</td>
          <td>${escapeHtml(provider.nameAr || provider.displayNameAr || "-")}</td>
          <td>${escapeHtml(provider.nameEn || provider.displayNameEn || "-")}</td>
          <td>${escapeHtml(getProviderTypeLabel(provider.providerType, locale))}</td>
          <td>${escapeHtml(provider.region || "-")}</td>
          <td>${escapeHtml([provider.city, provider.area].filter(Boolean).join(" - ") || "-")}</td>
          <td>${escapeHtml(provider.phone || provider.mobile || provider.email || "-")}</td>
          <td>${escapeHtml(provider.ordersCount)}</td>
          <td>${escapeHtml(getProviderStatusLabel(provider.status, locale))}</td>
          <td>${escapeHtml(provider.isFeatured ? t.yes : t.no)}</td>
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
          .header {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 14px;
            margin-bottom: 18px;
          }
          h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 800;
          }
          .meta {
            margin-top: 8px;
            color: #6b7280;
            font-size: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }
          th,
          td {
            border: 1px solid #e5e7eb;
            padding: 8px;
            text-align: ${isArabic ? "right" : "left"};
            vertical-align: top;
          }
          th { background: #f3f4f6; }
          @page { size: A4 landscape; margin: 10mm; }
          @media print { body { padding: 0; } }
        </style>
      </head>

      <body>
        <div class="header">
          <div>
            <h1>${escapeHtml(title)}</h1>
            <div class="meta">${escapeHtml(printedAtLabel)}: ${escapeHtml(now)}</div>
          </div>
          <strong>Primey Care</strong>
        </div>

        <table>
          <thead>
            <tr>
              <th>${escapeHtml(t.table.code)}</th>
              <th>${escapeHtml(t.table.nameAr)}</th>
              <th>${escapeHtml(t.table.nameEn)}</th>
              <th>${escapeHtml(t.table.type)}</th>
              <th>${escapeHtml(t.table.region)}</th>
              <th>${escapeHtml(t.table.city)}</th>
              <th>${escapeHtml(t.table.contact)}</th>
              <th>${escapeHtml(t.table.orders)}</th>
              <th>${escapeHtml(t.table.status)}</th>
              <th>${escapeHtml(t.table.featured)}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
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
   UI Helpers
============================================================ */

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function ListSkeleton() {
  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardContent className="space-y-3 p-5">
          <SkeletonLine className="h-11 w-full rounded-xl" />
          <SkeletonLine className="h-11 w-full rounded-xl" />
        </CardContent>
      </Card>

      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardContent className="space-y-3 p-5">
          {Array.from({ length: 8 }).map((_, index) => (
            <SkeletonLine key={index} className="h-12 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  title,
  value,
  description,
}: {
  icon: LucideIcon;
  title: string;
  value: number;
  description: string;
}) {
  return (
    <Card className="rounded-2xl border bg-card shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight">
              {formatNumber(value)}
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {description}
            </p>
          </div>

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SelectButton({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  const activeLabel =
    options.find((item) => item.value === value)?.label || label;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-10 rounded-xl">
          <Filter className="h-4 w-4" />
          <span>{activeLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={option.value === value}
            onCheckedChange={() => onChange(option.value)}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ============================================================
   Page
============================================================ */

export default function SystemProvidersListPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [summary, setSummary] = useState<ProvidersSummary>(DEFAULT_SUMMARY);
  const [pagination, setPagination] =
    useState<ProvidersPagination>(DEFAULT_PAGINATION);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [featuredFilter, setFeaturedFilter] = useState<FeaturedFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("nameAr");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [visibleColumns, setVisibleColumns] =
    useState<VisibleColumns>(DEFAULT_VISIBLE_COLUMNS);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canViewProviders = hasSafePermission(
    auth,
    ["providers.view", "providers.list"],
    "view",
  );

  const canCreateProviders = hasSafePermission(
    auth,
    ["providers.create"],
    "action",
  );

  const canImportProviders = hasSafePermission(
    auth,
    ["providers.import", "providers.create"],
    "action",
  );

  const canExportProviders = hasSafePermission(
    auth,
    ["providers.export", "reports.export"],
    "action",
  );

  const canPrintProviders = hasSafePermission(
    auth,
    ["providers.print", "reports.print"],
    "action",
  );

  const canViewDetails = hasSafePermission(
    auth,
    ["providers.view", "providers.detail"],
    "view",
  );

  const regions = useMemo(() => {
    return Array.from(
      new Set(providers.map((provider) => provider.region).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, "ar"));
  }, [providers]);

  const cities = useMemo(() => {
    const source =
      regionFilter === "all"
        ? providers
        : providers.filter((provider) => provider.region === regionFilter);

    return Array.from(
      new Set(source.map((provider) => provider.city).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, "ar"));
  }, [providers, regionFilter]);

  const loadProviders = useCallback(
    async (showToast = false) => {
      if (!canViewProviders) {
        setIsLoading(false);
        setProviders([]);
        setSummary(DEFAULT_SUMMARY);
        setPagination(DEFAULT_PAGINATION);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");

        const params = new URLSearchParams();

        params.set("page", String(page));
        params.set("page_size", String(PAGE_SIZE));

        if (debouncedSearch.trim()) {
          params.set("q", debouncedSearch.trim());
          params.set("search", debouncedSearch.trim());
        }

        if (statusFilter !== "all") {
          params.set("status", statusFilter);
        }

        if (typeFilter !== "all") {
          params.set("provider_type", typeFilter);
          params.set("type", typeFilter);
        }

        if (regionFilter !== "all") {
          params.set("region", regionFilter);
        }

        if (cityFilter !== "all") {
          params.set("city", cityFilter);
        }

        if (featuredFilter === "featured") {
          params.set("is_featured", "true");
        }

        if (featuredFilter === "not_featured") {
          params.set("is_featured", "false");
        }

        if (sourceFilter === "imported") {
          params.set("source", "imported");
        }

        if (sourceFilter === "manual") {
          params.set("source", "manual");
        }

        if (sortKey === "ordersCount") {
          params.set("sort", "most_orders");
          params.set("ordering", sortDirection === "asc" ? "orders_count" : "-orders_count");
        } else if (sortKey === "createdAt") {
          params.set("ordering", sortDirection === "asc" ? "created_at" : "-created_at");
        } else if (sortKey === "nameAr") {
          params.set("ordering", sortDirection === "asc" ? "name_ar" : "-name_ar");
        } else if (sortKey === "nameEn") {
          params.set("ordering", sortDirection === "asc" ? "name_en" : "-name_en");
        } else if (sortKey === "providerType") {
          params.set("ordering", sortDirection === "asc" ? "provider_type" : "-provider_type");
        } else {
          const orderingMap: Record<string, string> = {
            name: "name",
            code: "code",
            region: "region",
            city: "city",
            status: "status",
          };

          const field = orderingMap[sortKey] || "name_ar";
          params.set("ordering", sortDirection === "asc" ? field : `-${field}`);
        }

        const response = await fetch(apiUrl(`/api/providers/?${params.toString()}`), {
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
          throw new Error(
            payload?.message ||
              payload?.detail ||
              payload?.error ||
              `HTTP ${response.status}`,
          );
        }

        const rows = extractProviders(payload);

        setProviders(rows);
        setSummary(normalizeSummary(payload, rows));
        setPagination(normalizePagination(payload));

        if (showToast) {
          toast.success(t.refreshSuccess);
        }
      } catch (error) {
        console.error("Failed to load providers:", error);
        setProviders([]);
        setSummary(DEFAULT_SUMMARY);
        setPagination(DEFAULT_PAGINATION);
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [
      canViewProviders,
      cityFilter,
      debouncedSearch,
      featuredFilter,
      page,
      regionFilter,
      sortDirection,
      sortKey,
      sourceFilter,
      statusFilter,
      t.loadError,
      t.refreshSuccess,
      typeFilter,
    ],
  );

  const hasActiveFilters = Boolean(
    debouncedSearch.trim() ||
      statusFilter !== "all" ||
      typeFilter !== "all" ||
      regionFilter !== "all" ||
      cityFilter !== "all" ||
      featuredFilter !== "all" ||
      sourceFilter !== "all",
  );

  const columnCount = visibleColumnCount(visibleColumns);

  function resetFilters() {
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setRegionFilter("all");
    setCityFilter("all");
    setFeaturedFilter("all");
    setSourceFilter("all");
    setSortKey("nameAr");
    setSortDirection("asc");
    setPage(1);
  }

  function exportExcel() {
    if (!canExportProviders) return;

    downloadExcelFile({
      filename: "primey-care-providers-current-page.xls",
      title: t.title,
      locale,
      summaryRows: [
        [t.totalResults, summary.total_providers],
        [t.activeProviders, summary.active_providers],
        [t.featuredProviders, summary.featured_providers],
        [t.importedProviders, summary.imported_providers],
        [t.ordersCount, summary.total_orders],
      ],
      filterRows: [
        [t.search, debouncedSearch || "-"],
        [t.allStatuses, statusFilter],
        [t.allTypes, typeFilter],
        [t.allRegions, regionFilter],
        [t.allCities, cityFilter],
        [t.allFeatured, featuredFilter],
        [t.allSources, sourceFilter],
      ],
      headers: [
        t.table.code,
        t.table.nameAr,
        t.table.nameEn,
        t.table.type,
        t.table.region,
        t.table.city,
        t.table.contact,
        t.table.orders,
        t.table.status,
        t.table.featured,
        t.table.sourceCategory,
        t.table.createdAt,
      ],
      rows: providers.map((provider) => [
        provider.code || "-",
        provider.nameAr || provider.displayNameAr || "-",
        provider.nameEn || provider.displayNameEn || "-",
        getProviderTypeLabel(provider.providerType, locale),
        provider.region || "-",
        [provider.city, provider.area].filter(Boolean).join(" - ") || "-",
        provider.phone || provider.mobile || provider.email || "-",
        provider.ordersCount,
        getProviderStatusLabel(provider.status, locale),
        provider.isFeatured ? t.yes : t.no,
        provider.sourceCategory || "-",
        formatDate(provider.createdAt),
      ]),
    });

    toast.success(t.exportSuccess);
  }

  function printList() {
    if (!canPrintProviders) return;

    try {
      const printWindow = window.open("", "_blank", "width=1100,height=760");

      if (!printWindow) {
        toast.error(t.printError);
        return;
      }

      printWindow.document.open();
      printWindow.document.write(
        buildPrintHtml({
          locale,
          providers,
          title: t.title,
          printedAtLabel: t.printedAt,
        }),
      );
      printWindow.document.close();

      toast.success(t.printReady);
    } catch (error) {
      console.error("Print providers error:", error);
      toast.error(t.printError);
    }
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
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 450);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (authResolving) return;
    loadProviders(false);
  }, [authResolving, loadProviders]);

  useEffect(() => {
    setPage(1);
  }, [
    statusFilter,
    typeFilter,
    regionFilter,
    cityFilter,
    featuredFilter,
    sourceFilter,
    sortKey,
    sortDirection,
  ]);

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
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t.title}
          </h1>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
            {t.subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button asChild variant="outline" className="h-10 rounded-xl">
            <Link href="/system/providers">
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl"
            disabled={isLoading}
            onClick={() => loadProviders(true)}
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
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              disabled={isLoading || providers.length === 0}
              onClick={exportExcel}
            >
              <Download className="h-4 w-4" />
              <span>{t.exportExcel}</span>
            </Button>
          ) : null}

          {canPrintProviders ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              disabled={isLoading || providers.length === 0}
              onClick={printList}
            >
              <Printer className="h-4 w-4" />
              <span>{t.print}</span>
            </Button>
          ) : null}

          {canImportProviders ? (
            <Button asChild variant="outline" className="h-10 rounded-xl">
              <Link href="/system/providers/import">
                <UploadCloud className="h-4 w-4" />
                <span>{t.importProviders}</span>
              </Link>
            </Button>
          ) : null}

          {canCreateProviders ? (
            <Button asChild className="h-10 rounded-xl">
              <Link href="/system/providers/create">
                <PlusCircle className="h-4 w-4" />
                <span>{t.createProvider}</span>
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          icon={Building2}
          title={t.totalResults}
          value={summary.total_providers}
          description={t.title}
        />
        <KpiCard
          icon={CheckCircle2}
          title={t.activeProviders}
          value={summary.active_providers}
          description={t.activeProviders}
        />
        <KpiCard
          icon={Sparkles}
          title={t.featuredProviders}
          value={summary.featured_providers}
          description={t.featuredProviders}
        />
        <KpiCard
          icon={UploadCloud}
          title={t.importedProviders}
          value={summary.imported_providers}
          description={t.importedProviders}
        />
        <KpiCard
          icon={TrendingUp}
          title={t.ordersCount}
          value={summary.total_orders}
          description={t.ordersCount}
        />
      </div>

      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            {t.search}
          </CardTitle>
          <CardDescription>{t.subtitle}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              placeholder={t.searchPlaceholder}
              className="h-11 rounded-xl ps-10"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SelectButton
              label={t.allStatuses}
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as StatusFilter)}
              options={[
                { label: t.allStatuses, value: "all" },
                { label: t.statuses.ACTIVE, value: "ACTIVE" },
                { label: t.statuses.INACTIVE, value: "INACTIVE" },
                { label: t.statuses.SUSPENDED, value: "SUSPENDED" },
                { label: t.statuses.DRAFT, value: "DRAFT" },
              ]}
            />

            <SelectButton
              label={t.allTypes}
              value={typeFilter}
              onChange={(value) => setTypeFilter(value as TypeFilter)}
              options={[
                { label: t.allTypes, value: "all" },
                { label: t.types.HOSPITAL, value: "HOSPITAL" },
                { label: t.types.MEDICAL_CENTER, value: "MEDICAL_CENTER" },
                { label: t.types.PHARMACY, value: "PHARMACY" },
                { label: t.types.LAB, value: "LAB" },
                { label: t.types.CLINIC, value: "CLINIC" },
                { label: t.types.PARTNER, value: "PARTNER" },
                { label: t.types.OTHER, value: "OTHER" },
              ]}
            />

            <SelectButton
              label={t.allRegions}
              value={regionFilter}
              onChange={(value) => {
                setRegionFilter(value);
                setCityFilter("all");
              }}
              options={[
                { label: t.allRegions, value: "all" },
                ...regions.map((region) => ({ label: region, value: region })),
              ]}
            />

            <SelectButton
              label={t.allCities}
              value={cityFilter}
              onChange={setCityFilter}
              options={[
                { label: t.allCities, value: "all" },
                ...cities.map((city) => ({ label: city, value: city })),
              ]}
            />

            <SelectButton
              label={t.allFeatured}
              value={featuredFilter}
              onChange={(value) => setFeaturedFilter(value as FeaturedFilter)}
              options={[
                { label: t.allFeatured, value: "all" },
                { label: t.featuredOnly, value: "featured" },
                { label: t.notFeaturedOnly, value: "not_featured" },
              ]}
            />

            <SelectButton
              label={t.allSources}
              value={sourceFilter}
              onChange={(value) => setSourceFilter(value as SourceFilter)}
              options={[
                { label: t.allSources, value: "all" },
                { label: t.importedOnly, value: "imported" },
                { label: t.manualOnly, value: "manual" },
              ]}
            />

            <SelectButton
              label={t.sortBy}
              value={sortKey}
              onChange={(value) => setSortKey(value as SortKey)}
              options={[
                { label: t.sortNameAr, value: "nameAr" },
                { label: t.sortNameEn, value: "nameEn" },
                { label: t.sortName, value: "name" },
                { label: t.table.code, value: "code" },
                { label: t.table.type, value: "providerType" },
                { label: t.table.region, value: "region" },
                { label: t.table.city, value: "city" },
                { label: t.table.status, value: "status" },
                { label: t.sortMostOrders, value: "ordersCount" },
                { label: t.sortNewest, value: "createdAt" },
              ]}
            />

            <SelectButton
              label={sortDirection === "asc" ? t.sortAsc : t.sortDesc}
              value={sortDirection}
              onChange={(value) => setSortDirection(value as SortDirection)}
              options={[
                { label: t.sortAsc, value: "asc" },
                { label: t.sortDesc, value: "desc" },
              ]}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 rounded-xl">
                  <ColumnsIcon className="h-4 w-4" />
                  <span>{t.columns}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>{t.columns}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {Object.entries(t.table).map(([key, label]) => {
                  if (!(key in visibleColumns)) return null;

                  const columnKey = key as keyof VisibleColumns;

                  return (
                    <DropdownMenuCheckboxItem
                      key={key}
                      checked={visibleColumns[columnKey]}
                      onCheckedChange={(checked) =>
                        setVisibleColumns((current) => ({
                          ...current,
                          [columnKey]: Boolean(checked),
                        }))
                      }
                    >
                      {label}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {hasActiveFilters ? (
              <Button
                type="button"
                variant="ghost"
                className="h-10 rounded-xl"
                onClick={resetFilters}
              >
                {t.clearFilters}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {isLoading || authResolving ? (
        <ListSkeleton />
      ) : errorMessage ? (
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 shadow-sm">
          <CardContent className="flex items-start gap-3 p-5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-semibold text-destructive">{errorMessage}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.loadErrorHint}
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4 rounded-xl"
                onClick={() => loadProviders(true)}
              >
                <RefreshCcw className="h-4 w-4" />
                <span>{t.retry}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              {t.totalResults}: {formatNumber(pagination.total_items)}
            </CardTitle>
            <CardDescription>
              {hasActiveFilters ? t.noSearchText : t.subtitle}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {providers.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-10 text-center">
                <Building2 className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="font-semibold">
                    {hasActiveFilters ? t.noSearchTitle : t.emptyTitle}
                  </p>
                  <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                    {hasActiveFilters ? t.noSearchText : t.emptyText}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {visibleColumns.code ? (
                          <TableHead>{t.table.code}</TableHead>
                        ) : null}
                        {visibleColumns.nameAr ? (
                          <TableHead>{t.table.nameAr}</TableHead>
                        ) : null}
                        {visibleColumns.nameEn ? (
                          <TableHead>{t.table.nameEn}</TableHead>
                        ) : null}
                        {visibleColumns.providerType ? (
                          <TableHead>{t.table.type}</TableHead>
                        ) : null}
                        {visibleColumns.region ? (
                          <TableHead>{t.table.region}</TableHead>
                        ) : null}
                        {visibleColumns.city ? (
                          <TableHead>{t.table.city}</TableHead>
                        ) : null}
                        {visibleColumns.contact ? (
                          <TableHead>{t.table.contact}</TableHead>
                        ) : null}
                        {visibleColumns.orders ? (
                          <TableHead>{t.table.orders}</TableHead>
                        ) : null}
                        {visibleColumns.status ? (
                          <TableHead>{t.table.status}</TableHead>
                        ) : null}
                        {visibleColumns.featured ? (
                          <TableHead>{t.table.featured}</TableHead>
                        ) : null}
                        {visibleColumns.sourceCategory ? (
                          <TableHead>{t.table.sourceCategory}</TableHead>
                        ) : null}
                        {visibleColumns.createdAt ? (
                          <TableHead>{t.table.createdAt}</TableHead>
                        ) : null}
                        {visibleColumns.actions ? (
                          <TableHead className="text-end">
                            {t.table.actions}
                          </TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {providers.map((provider) => {
                        const Icon = getProviderIcon(provider.providerType);
                        const detailHref = `/system/providers/${provider.id}`;

                        return (
                          <TableRow key={`${provider.id}-${provider.code}`}>
                            {visibleColumns.code ? (
                              <TableCell>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-2 font-mono text-xs font-semibold hover:text-primary"
                                  onClick={() => copyText(provider.code, t.copied)}
                                >
                                  <span>{provider.code || "-"}</span>
                                  {provider.code ? (
                                    <Copy className="h-3.5 w-3.5" />
                                  ) : null}
                                </button>
                              </TableCell>
                            ) : null}

                            {visibleColumns.nameAr ? (
                              <TableCell>
                                <div className="min-w-[190px]">
                                  <p className="font-semibold">
                                    {provider.nameAr ||
                                      provider.displayNameAr ||
                                      provider.name ||
                                      "-"}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {provider.sourceCategory ||
                                      getProviderTypeLabel(
                                        provider.providerType,
                                        locale,
                                      )}
                                  </p>
                                </div>
                              </TableCell>
                            ) : null}

                            {visibleColumns.nameEn ? (
                              <TableCell>
                                <div className="min-w-[180px]">
                                  <p className="font-medium">
                                    {provider.nameEn ||
                                      provider.displayNameEn ||
                                      "-"}
                                  </p>
                                </div>
                              </TableCell>
                            ) : null}

                            {visibleColumns.providerType ? (
                              <TableCell>
                                <Badge variant="outline" className="rounded-full">
                                  <Icon className="me-1 h-3.5 w-3.5" />
                                  {getProviderTypeLabel(
                                    provider.providerType,
                                    locale,
                                  )}
                                </Badge>
                              </TableCell>
                            ) : null}

                            {visibleColumns.region ? (
                              <TableCell>{provider.region || "-"}</TableCell>
                            ) : null}

                            {visibleColumns.city ? (
                              <TableCell>
                                <div className="min-w-[150px]">
                                  <p className="font-medium">
                                    {provider.city || "-"}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {provider.area || provider.street || "-"}
                                  </p>
                                </div>
                              </TableCell>
                            ) : null}

                            {visibleColumns.contact ? (
                              <TableCell>
                                <div className="min-w-[160px] space-y-1 text-xs">
                                  <p className="flex items-center gap-1">
                                    <Phone className="h-3.5 w-3.5" />
                                    {provider.mobile || provider.phone || "-"}
                                  </p>
                                  <p className="truncate text-muted-foreground">
                                    {provider.email ||
                                      provider.contactPerson ||
                                      "-"}
                                  </p>
                                </div>
                              </TableCell>
                            ) : null}

                            {visibleColumns.orders ? (
                              <TableCell>
                                <Badge variant="secondary" className="rounded-full">
                                  {formatNumber(provider.ordersCount)}
                                </Badge>
                              </TableCell>
                            ) : null}

                            {visibleColumns.status ? (
                              <TableCell>
                                <Badge
                                  className={`rounded-full border px-3 py-1 ${getStatusBadgeClass(
                                    provider.status,
                                  )}`}
                                >
                                  {getProviderStatusLabel(provider.status, locale)}
                                </Badge>
                              </TableCell>
                            ) : null}

                            {visibleColumns.featured ? (
                              <TableCell>
                                {provider.isFeatured ? (
                                  <Badge className="rounded-full border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50">
                                    <Sparkles className="me-1 h-3.5 w-3.5" />
                                    {t.yes}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="rounded-full">
                                    {t.no}
                                  </Badge>
                                )}
                              </TableCell>
                            ) : null}

                            {visibleColumns.sourceCategory ? (
                              <TableCell>
                                {provider.sourceCategory || "-"}
                              </TableCell>
                            ) : null}

                            {visibleColumns.createdAt ? (
                              <TableCell>{formatDate(provider.createdAt)}</TableCell>
                            ) : null}

                            {visibleColumns.actions ? (
                              <TableCell className="text-end">
                                <div className="flex justify-end gap-2">
                                  {provider.googleMapsLink ? (
                                    <Button
                                      asChild
                                      size="icon"
                                      variant="outline"
                                      className="h-9 w-9 rounded-xl"
                                    >
                                      <a
                                        href={provider.googleMapsLink}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        <MapPin className="h-4 w-4" />
                                      </a>
                                    </Button>
                                  ) : null}

                                  {provider.website ? (
                                    <Button
                                      asChild
                                      size="icon"
                                      variant="outline"
                                      className="h-9 w-9 rounded-xl"
                                    >
                                      <a
                                        href={provider.website}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        <ArrowUpRight className="h-4 w-4" />
                                      </a>
                                    </Button>
                                  ) : null}

                                  {canViewDetails && provider.id ? (
                                    <Button
                                      asChild
                                      size="sm"
                                      variant="outline"
                                      className="rounded-xl"
                                    >
                                      <Link href={detailHref}>
                                        <Eye className="me-2 h-4 w-4" />
                                        {t.details}
                                      </Link>
                                    </Button>
                                  ) : null}
                                </div>
                              </TableCell>
                            ) : null}
                          </TableRow>
                        );
                      })}

                      {providers.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={columnCount}
                            className="h-24 text-center"
                          >
                            {t.noSearchText}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    {t.page} {formatNumber(pagination.page)} {t.from}{" "}
                    {formatNumber(pagination.total_pages)}
                  </p>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      disabled={!pagination.has_previous || page <= 1}
                      onClick={() =>
                        setPage((current) => Math.max(1, current - 1))
                      }
                    >
                      <ChevronRight className="h-4 w-4" />
                      {t.previous}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      disabled={
                        !pagination.has_next || page >= pagination.total_pages
                      }
                      onClick={() =>
                        setPage((current) =>
                          Math.min(pagination.total_pages, current + 1),
                        )
                      }
                    >
                      {t.next}
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}