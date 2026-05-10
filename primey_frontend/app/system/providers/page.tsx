"use client";

/* ============================================================
   📂 primey_frontend/app/system/providers/page.tsx
   🧠 Primey Care | Providers Dashboard
   ------------------------------------------------------------
   ✅ المرحلة 17 + المرحلة 2
   ✅ لوحة مقدمي الخدمة الرئيسية
   ✅ تحميل سريع عبر Request واحد فقط
   ✅ الاعتماد على summary من الباكند بدل تحميل كل الصفحات
   ✅ إزالة بطاقات البيانات النظامية / الشعار / Drive
   ✅ إزالة أعمدة الشعار / السجل التجاري / الرقم الضريبي / Drive
   ✅ Excel export بصيغة .xls HTML Workbook للبيانات المعروضة
   ✅ Web PDF Print للبيانات المعروضة
   ✅ Error State مستقل
   ✅ Empty State ذكي
   ✅ Skeleton Loading
   ✅ حماية الأزرار والطلبات حسب الصلاحيات
   ✅ fallback آمن لـ system_admin / superuser
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ استخدام toast من sonner
   ✅ بدون localhost hardcoded
   ✅ بدون main / min-h-screen / max-w
   ✅ بدون نصوص تقنية ظاهرة
   ✅ الأرقام تبقى بالإنجليزية
============================================================ */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  Eye,
  FileText,
  Hospital,
  Loader2,
  MapPin,
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
  UsersRound,
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

type ProviderRow = {
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
  hospitals_count: number;
  medical_centers_count: number;
  pharmacies_count: number;
  labs_count: number;
  clinics_count: number;
  partners_count: number;
  others_count: number;
  featured_providers: number;
  imported_providers: number;
  manual_providers: number;
  total_orders: number;
};

type ProvidersApiEnvelope = {
  ok?: boolean;
  message?: string;
  detail?: string;
  error?: string;
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
  summary?: Partial<ProvidersSummary>;
  stats?: Partial<ProvidersSummary>;
};

const DEFAULT_SUMMARY: ProvidersSummary = {
  total_providers: 0,
  active_providers: 0,
  inactive_providers: 0,
  suspended_providers: 0,
  draft_providers: 0,
  hospitals_count: 0,
  medical_centers_count: 0,
  pharmacies_count: 0,
  labs_count: 0,
  clinics_count: 0,
  partners_count: 0,
  others_count: 0,
  featured_providers: 0,
  imported_providers: 0,
  manual_providers: 0,
  total_orders: 0,
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
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "مقدمو الخدمة" : "Providers",
    subtitle: isArabic
      ? "لوحة تشغيلية لإدارة مقدمي الخدمة والمراكز الطبية والعقود المرتبطة بهم."
      : "Operational dashboard for providers, medical centers, and linked contracts.",

    refresh: isArabic ? "تحديث" : "Refresh",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة" : "Print",
    createProvider: isArabic ? "إضافة مقدم خدمة" : "Create Provider",
    providersList: isArabic ? "قائمة مقدمي الخدمة" : "Providers List",
    importProviders: isArabic ? "استيراد الشبكة الطبية" : "Import Medical Network",
    contracts: isArabic ? "العقود" : "Contracts",
    centers: isArabic ? "المراكز" : "Centers",

    search: isArabic ? "بحث سريع" : "Quick Search",
    searchPlaceholder: isArabic
      ? "ابحث بالاسم العربي أو الإنجليزي، الكود، المدينة، الجوال..."
      : "Search by Arabic/English name, code, city, phone...",
    viewAll: isArabic ? "عرض الكل" : "View All",
    details: isArabic ? "التفاصيل" : "Details",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الصفحة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض لوحة مقدمي الخدمة."
      : "You do not have permission to view the providers dashboard.",

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
      ? "جرّب تعديل كلمات البحث لعرض نتائج أكثر."
      : "Try changing the search terms to show more results.",

    overview: isArabic ? "ملخص مقدمي الخدمة" : "Providers Overview",
    overviewDesc: isArabic
      ? "نظرة تشغيلية على مقدمي الخدمة حسب الحالة والتصنيف والطلبات."
      : "Operational overview by status, type, and orders.",
    recentProviders: isArabic ? "أحدث مقدمي الخدمة" : "Recent Providers",
    recentProvidersDesc: isArabic
      ? "آخر الجهات المسجلة أو المحدثة في النظام."
      : "Latest providers registered or updated in the system.",
    typeDistribution: isArabic ? "توزيع التصنيفات" : "Type Distribution",
    typeDistributionDesc: isArabic
      ? "تصنيف مقدمي الخدمة المسجلين."
      : "Classification of registered providers.",
    quickActions: isArabic ? "إجراءات سريعة" : "Quick Actions",
    quickActionsDesc: isArabic
      ? "انتقل إلى صفحات إدارة مقدمي الخدمة."
      : "Navigate to provider management pages.",

    totalProviders: isArabic ? "إجمالي مقدمي الخدمة" : "Total Providers",
    activeProviders: isArabic ? "النشطون" : "Active",
    inactiveProviders: isArabic ? "غير النشطين" : "Inactive",
    suspendedProviders: isArabic ? "الموقوفون" : "Suspended",
    draftProviders: isArabic ? "المسودات" : "Drafts",
    featuredProviders: isArabic ? "المميزون" : "Featured",
    importedProviders: isArabic ? "مستوردة من الشبكة" : "Imported",
    manualProviders: isArabic ? "إدخال يدوي" : "Manual",
    ordersCount: isArabic ? "عدد الطلبات" : "Orders Count",

    hospitals: isArabic ? "المستشفيات" : "Hospitals",
    medicalCenters: isArabic ? "المراكز الطبية" : "Medical Centers",
    clinics: isArabic ? "العيادات" : "Clinics",
    labs: isArabic ? "المختبرات" : "Labs",
    pharmacies: isArabic ? "الصيدليات" : "Pharmacies",
    partners: isArabic ? "الشركاء" : "Partners",
    others: isArabic ? "أخرى" : "Others",

    table: {
      code: isArabic ? "الكود" : "Code",
      provider: isArabic ? "مقدم الخدمة" : "Provider",
      nameAr: isArabic ? "الاسم العربي" : "Arabic Name",
      nameEn: isArabic ? "الاسم الإنجليزي" : "English Name",
      type: isArabic ? "التصنيف" : "Type",
      status: isArabic ? "الحالة" : "Status",
      location: isArabic ? "الموقع" : "Location",
      contact: isArabic ? "التواصل" : "Contact",
      orders: isArabic ? "الطلبات" : "Orders",
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
    notAvailable: isArabic ? "غير متوفر" : "Not available",
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

function normalizeProvider(item: unknown): ProviderRow {
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

function extractProviders(payload: ProvidersApiEnvelope | null): ProviderRow[] {
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

function buildSummary(
  providers: ProviderRow[],
  remoteSummary?: Partial<ProvidersSummary>,
): ProvidersSummary {
  return {
    total_providers: Number(remoteSummary?.total_providers) || providers.length,
    active_providers:
      Number(remoteSummary?.active_providers) ||
      providers.filter((provider) => provider.status === "ACTIVE").length,
    inactive_providers:
      Number(remoteSummary?.inactive_providers) ||
      providers.filter((provider) => provider.status === "INACTIVE").length,
    suspended_providers:
      Number(remoteSummary?.suspended_providers) ||
      providers.filter((provider) => provider.status === "SUSPENDED").length,
    draft_providers:
      Number(remoteSummary?.draft_providers) ||
      providers.filter((provider) => provider.status === "DRAFT").length,
    hospitals_count:
      Number(remoteSummary?.hospitals_count) ||
      providers.filter((provider) => provider.providerType === "HOSPITAL")
        .length,
    medical_centers_count:
      Number(remoteSummary?.medical_centers_count) ||
      providers.filter(
        (provider) => provider.providerType === "MEDICAL_CENTER",
      ).length,
    pharmacies_count:
      Number(remoteSummary?.pharmacies_count) ||
      providers.filter((provider) => provider.providerType === "PHARMACY")
        .length,
    labs_count:
      Number(remoteSummary?.labs_count) ||
      providers.filter((provider) => provider.providerType === "LAB").length,
    clinics_count:
      Number(remoteSummary?.clinics_count) ||
      providers.filter((provider) => provider.providerType === "CLINIC").length,
    partners_count:
      Number(remoteSummary?.partners_count) ||
      providers.filter((provider) => provider.providerType === "PARTNER")
        .length,
    others_count:
      Number(remoteSummary?.others_count) ||
      providers.filter((provider) => provider.providerType === "OTHER").length,
    featured_providers:
      Number(remoteSummary?.featured_providers) ||
      providers.filter((provider) => provider.isFeatured).length,
    imported_providers:
      Number(remoteSummary?.imported_providers) ||
      providers.filter((provider) => provider.importSource).length,
    manual_providers:
      Number(remoteSummary?.manual_providers) ||
      providers.filter((provider) => !provider.importSource).length,
    total_orders:
      Number(remoteSummary?.total_orders) ||
      providers.reduce((total, provider) => total + provider.ordersCount, 0),
  };
}

function formatNumber(value: number | string): string {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return "0";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(numericValue);
}

function escapeHtml(value: string | number) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function providerTypeLabel(type: ProviderType, locale: AppLocale) {
  return dictionary(locale).types[type] || dictionary(locale).types.UNKNOWN;
}

function providerStatusLabel(status: ProviderStatus, locale: AppLocale) {
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

function copyText(value: string, successMessage: string) {
  if (!value) return;

  navigator.clipboard
    ?.writeText(value)
    .then(() => toast.success(successMessage))
    .catch(() => toast.success(successMessage));
}

/* ============================================================
   Export / Print
============================================================ */

function buildExcelWorkbook({
  locale,
  providers,
  summary,
}: {
  locale: AppLocale;
  providers: ProviderRow[];
  summary: ProvidersSummary;
}) {
  const t = dictionary(locale);
  const isArabic = locale === "ar";

  const summaryRows: Array<[string, string | number]> = [
    [t.totalProviders, summary.total_providers],
    [t.activeProviders, summary.active_providers],
    [t.featuredProviders, summary.featured_providers],
    [t.importedProviders, summary.imported_providers],
    [t.ordersCount, summary.total_orders],
  ];

  const summaryHtml = summaryRows
    .map(
      ([label, value]) => `
        <tr>
          <td style="font-weight:700;background:#f3f4f6;">${escapeHtml(label)}</td>
          <td>${escapeHtml(value)}</td>
        </tr>
      `,
    )
    .join("");

  const rows = providers
    .map(
      (provider) => `
        <tr>
          <td>${escapeHtml(provider.code || "-")}</td>
          <td>${escapeHtml(provider.nameAr || provider.displayNameAr || "-")}</td>
          <td>${escapeHtml(provider.nameEn || provider.displayNameEn || "-")}</td>
          <td>${escapeHtml(providerTypeLabel(provider.providerType, locale))}</td>
          <td>${escapeHtml([provider.region, provider.city, provider.area].filter(Boolean).join(" - ") || "-")}</td>
          <td>${escapeHtml(provider.mobile || provider.phone || provider.email || "-")}</td>
          <td>${escapeHtml(provider.ordersCount)}</td>
          <td>${escapeHtml(providerStatusLabel(provider.status, locale))}</td>
          <td>${escapeHtml(provider.isFeatured ? t.yes : t.no)}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <html lang="${locale}" dir="${isArabic ? "rtl" : "ltr"}">
      <head>
        <meta charset="utf-8" />
      </head>
      <body>
        <h2>${escapeHtml(t.title)}</h2>
        <table border="1">
          <tbody>${summaryHtml}</tbody>
        </table>
        <br />
        <table border="1">
          <thead>
            <tr>
              <th style="background:#432a58;color:#ffffff;">${escapeHtml(t.table.code)}</th>
              <th style="background:#432a58;color:#ffffff;">${escapeHtml(t.table.nameAr)}</th>
              <th style="background:#432a58;color:#ffffff;">${escapeHtml(t.table.nameEn)}</th>
              <th style="background:#432a58;color:#ffffff;">${escapeHtml(t.table.type)}</th>
              <th style="background:#432a58;color:#ffffff;">${escapeHtml(t.table.location)}</th>
              <th style="background:#432a58;color:#ffffff;">${escapeHtml(t.table.contact)}</th>
              <th style="background:#432a58;color:#ffffff;">${escapeHtml(t.table.orders)}</th>
              <th style="background:#432a58;color:#ffffff;">${escapeHtml(t.table.status)}</th>
              <th style="background:#432a58;color:#ffffff;">${escapeHtml(t.featuredProviders)}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `;
}

function downloadExcelFile(options: {
  locale: AppLocale;
  providers: ProviderRow[];
  summary: ProvidersSummary;
}) {
  const html = buildExcelWorkbook(options);
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
}

function buildPrintHtml({
  locale,
  providers,
  summary,
}: {
  locale: AppLocale;
  providers: ProviderRow[];
  summary: ProvidersSummary;
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
          <td>${escapeHtml(providerTypeLabel(provider.providerType, locale))}</td>
          <td>${escapeHtml([provider.region, provider.city, provider.area].filter(Boolean).join(" - ") || "-")}</td>
          <td>${escapeHtml(provider.mobile || provider.phone || provider.email || "-")}</td>
          <td>${escapeHtml(provider.ordersCount)}</td>
          <td>${escapeHtml(providerStatusLabel(provider.status, locale))}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <!doctype html>
    <html lang="${locale}" dir="${isArabic ? "rtl" : "ltr"}">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(t.title)}</title>
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
          .cards {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 18px;
          }
          .card {
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 12px;
          }
          .card span {
            display: block;
            color: #6b7280;
            font-size: 11px;
          }
          .card strong {
            display: block;
            margin-top: 6px;
            font-size: 18px;
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
            <h1>${escapeHtml(t.title)}</h1>
            <div class="meta">${escapeHtml(t.printedAt)}: ${escapeHtml(now)}</div>
          </div>
          <strong>Primey Care</strong>
        </div>

        <div class="cards">
          <div class="card">
            <span>${escapeHtml(t.totalProviders)}</span>
            <strong>${escapeHtml(formatNumber(summary.total_providers))}</strong>
          </div>
          <div class="card">
            <span>${escapeHtml(t.activeProviders)}</span>
            <strong>${escapeHtml(formatNumber(summary.active_providers))}</strong>
          </div>
          <div class="card">
            <span>${escapeHtml(t.importedProviders)}</span>
            <strong>${escapeHtml(formatNumber(summary.imported_providers))}</strong>
          </div>
          <div class="card">
            <span>${escapeHtml(t.ordersCount)}</span>
            <strong>${escapeHtml(formatNumber(summary.total_orders))}</strong>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>${escapeHtml(t.table.code)}</th>
              <th>${escapeHtml(t.table.nameAr)}</th>
              <th>${escapeHtml(t.table.nameEn)}</th>
              <th>${escapeHtml(t.table.type)}</th>
              <th>${escapeHtml(t.table.location)}</th>
              <th>${escapeHtml(t.table.contact)}</th>
              <th>${escapeHtml(t.table.orders)}</th>
              <th>${escapeHtml(t.table.status)}</th>
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

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index} className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="space-y-3 p-5">
              <SkeletonLine className="h-4 w-28" />
              <SkeletonLine className="h-8 w-20" />
              <SkeletonLine className="h-3 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="space-y-3 p-5">
            {Array.from({ length: 8 }).map((_, index) => (
              <SkeletonLine key={index} className="h-12 w-full rounded-xl" />
            ))}
          </CardContent>
        </Card>
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonLine key={index} className="h-10 w-full rounded-xl" />
            ))}
          </CardContent>
        </Card>
      </div>
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

function ActionCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl border bg-background p-4 transition hover:border-primary/40 hover:bg-muted/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Icon className="h-5 w-5" />
          </div>

          <div>
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {description}
            </p>
          </div>
        </div>

        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
      </div>
    </Link>
  );
}

function TypeDistributionRow({
  icon: Icon,
  label,
  value,
  total,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  total: number;
}) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="space-y-2 rounded-xl border bg-background p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-sm font-medium">{label}</span>
        </div>

        <span className="text-sm font-bold">{formatNumber(value)}</span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/* ============================================================
   Page
============================================================ */

export default function SystemProvidersPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [summary, setSummary] = useState<ProvidersSummary>(DEFAULT_SUMMARY);
  const [search, setSearch] = useState("");
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

  const canViewContracts = hasSafePermission(
    auth,
    ["contracts.view", "contracts.list"],
    "view",
  );

  const loadProviders = useCallback(
    async (showToast = false) => {
      if (!canViewProviders) {
        setIsLoading(false);
        setProviders([]);
        setSummary(DEFAULT_SUMMARY);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");

        const response = await fetch(
          apiUrl("/api/providers/?page=1&page_size=8&ordering=-created_at"),
          {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          },
        );

        const payload = (await response.json().catch(() => null)) as
          | ProvidersApiEnvelope
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
        const remoteSummary = payload?.summary || payload?.stats;

        setProviders(rows);
        setSummary(buildSummary(rows, remoteSummary));

        if (showToast) {
          toast.success(t.refreshSuccess);
        }
      } catch (error) {
        console.error("Failed to load providers:", error);
        setProviders([]);
        setSummary(DEFAULT_SUMMARY);
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [canViewProviders, t.loadError, t.refreshSuccess],
  );

  const filteredProviders = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return providers;

    return providers.filter((provider) => {
      const haystack = [
        provider.name,
        provider.nameAr,
        provider.nameEn,
        provider.displayNameAr,
        provider.displayNameEn,
        provider.code,
        provider.region,
        provider.city,
        provider.area,
        provider.street,
        provider.address,
        provider.phone,
        provider.mobile,
        provider.email,
        provider.contactPerson,
        provider.sourceCategory,
        provider.externalReference,
        providerTypeLabel(provider.providerType, locale),
        providerStatusLabel(provider.status, locale),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [locale, providers, search]);

  const recentProviders = useMemo(() => {
    return [...filteredProviders]
      .sort((a, b) => {
        const left = new Date(a.createdAt || a.updatedAt).getTime() || 0;
        const right = new Date(b.createdAt || b.updatedAt).getTime() || 0;
        return right - left;
      })
      .slice(0, 8);
  }, [filteredProviders]);

  const topProvidersByOrders = useMemo(() => {
    return [...providers]
      .sort((a, b) => b.ordersCount - a.ordersCount)
      .slice(0, 5);
  }, [providers]);

  const typeRows = useMemo(
    () => [
      {
        label: t.hospitals,
        value: summary.hospitals_count,
        icon: Hospital,
      },
      {
        label: t.medicalCenters,
        value: summary.medical_centers_count,
        icon: Stethoscope,
      },
      {
        label: t.clinics,
        value: summary.clinics_count,
        icon: Stethoscope,
      },
      {
        label: t.labs,
        value: summary.labs_count,
        icon: TestTube2,
      },
      {
        label: t.pharmacies,
        value: summary.pharmacies_count,
        icon: ShieldCheck,
      },
      {
        label: t.partners,
        value: summary.partners_count,
        icon: UsersRound,
      },
      {
        label: t.others,
        value: summary.others_count,
        icon: Building2,
      },
    ],
    [summary, t],
  );

  function handleExportExcel() {
    if (!canExportProviders) return;

    downloadExcelFile({
      locale,
      providers: filteredProviders,
      summary,
    });

    toast.success(t.exportSuccess);
  }

  function handlePrint() {
    if (!canPrintProviders) return;

    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) {
      toast.error(t.printError);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      buildPrintHtml({
        locale,
        providers: filteredProviders,
        summary,
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
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              disabled={isLoading || filteredProviders.length === 0}
              onClick={handleExportExcel}
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
              disabled={isLoading || filteredProviders.length === 0}
              onClick={handlePrint}
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

      {isLoading || authResolving ? (
        <DashboardSkeleton />
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
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <KpiCard
              icon={Building2}
              title={t.totalProviders}
              value={summary.total_providers}
              description={t.overview}
            />
            <KpiCard
              icon={CheckCircle2}
              title={t.activeProviders}
              value={summary.active_providers}
              description={t.statuses.ACTIVE}
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
              description={t.importProviders}
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
              <CardDescription>{t.overviewDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  placeholder={t.searchPlaceholder}
                  className="h-11 rounded-xl ps-10"
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-4">
              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5" />
                      {t.recentProviders}
                    </CardTitle>
                    <CardDescription>{t.recentProvidersDesc}</CardDescription>
                  </div>

                  <Button asChild variant="outline" className="rounded-xl">
                    <Link href="/system/providers/list">
                      <Eye className="h-4 w-4" />
                      <span>{t.viewAll}</span>
                    </Link>
                  </Button>
                </CardHeader>

                <CardContent>
                  {filteredProviders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-10 text-center">
                      <Building2 className="h-10 w-10 text-muted-foreground" />
                      <div>
                        <p className="font-semibold">
                          {search.trim() ? t.noSearchTitle : t.emptyTitle}
                        </p>
                        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                          {search.trim() ? t.noSearchText : t.emptyText}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t.table.provider}</TableHead>
                            <TableHead>{t.table.type}</TableHead>
                            <TableHead>{t.table.location}</TableHead>
                            <TableHead>{t.table.contact}</TableHead>
                            <TableHead>{t.table.orders}</TableHead>
                            <TableHead>{t.table.status}</TableHead>
                            <TableHead className="text-end">
                              {t.table.actions}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recentProviders.map((provider) => {
                            const Icon = getProviderIcon(provider.providerType);

                            return (
                              <TableRow key={`${provider.id}-${provider.code}`}>
                                <TableCell>
                                  <div className="min-w-[230px]">
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-2 font-mono text-xs font-semibold text-muted-foreground hover:text-primary"
                                      onClick={() =>
                                        copyText(provider.code, t.copied)
                                      }
                                    >
                                      <span>{provider.code || "-"}</span>
                                      {provider.code ? (
                                        <Copy className="h-3.5 w-3.5" />
                                      ) : null}
                                    </button>

                                    <p className="mt-1 font-semibold">
                                      {provider.nameAr ||
                                        provider.displayNameAr ||
                                        provider.name ||
                                        "-"}
                                    </p>

                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {provider.nameEn ||
                                        provider.displayNameEn ||
                                        provider.sourceCategory ||
                                        "-"}
                                    </p>
                                  </div>
                                </TableCell>

                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className="rounded-full"
                                  >
                                    <Icon className="me-1 h-3.5 w-3.5" />
                                    {providerTypeLabel(
                                      provider.providerType,
                                      locale,
                                    )}
                                  </Badge>
                                </TableCell>

                                <TableCell>
                                  <div className="min-w-[160px]">
                                    <p className="font-medium">
                                      {[provider.region, provider.city]
                                        .filter(Boolean)
                                        .join(" / ") || "-"}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {provider.area || provider.street || "-"}
                                    </p>
                                  </div>
                                </TableCell>

                                <TableCell>
                                  <div className="min-w-[160px] text-xs">
                                    <p className="font-medium">
                                      {provider.mobile ||
                                        provider.phone ||
                                        provider.email ||
                                        "-"}
                                    </p>
                                    <p className="mt-1 text-muted-foreground">
                                      {provider.contactPerson || "-"}
                                    </p>
                                  </div>
                                </TableCell>

                                <TableCell>
                                  <Badge
                                    variant="secondary"
                                    className="rounded-full"
                                  >
                                    {formatNumber(provider.ordersCount)}
                                  </Badge>
                                </TableCell>

                                <TableCell>
                                  <Badge
                                    className={`rounded-full border px-3 py-1 ${getStatusBadgeClass(
                                      provider.status,
                                    )}`}
                                  >
                                    {providerStatusLabel(
                                      provider.status,
                                      locale,
                                    )}
                                  </Badge>
                                </TableCell>

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

                                    <Button
                                      asChild
                                      size="sm"
                                      variant="outline"
                                      className="rounded-xl"
                                    >
                                      <Link
                                        href={`/system/providers/${provider.id}`}
                                      >
                                        <Eye className="me-2 h-4 w-4" />
                                        {t.details}
                                      </Link>
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    {t.ordersCount}
                  </CardTitle>
                  <CardDescription>{t.ordersCount}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  {topProvidersByOrders.length > 0 ? (
                    topProvidersByOrders.map((provider, index) => (
                      <div
                        key={`${provider.id}-orders-${index}`}
                        className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {provider.nameAr ||
                              provider.displayNameAr ||
                              provider.name ||
                              "-"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {provider.city ||
                              provider.region ||
                              provider.code ||
                              "-"}
                          </p>
                        </div>

                        <Badge variant="secondary" className="rounded-full">
                          {formatNumber(provider.ordersCount)}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                      {t.notAvailable}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardHeader>
                  <CardTitle>{t.quickActions}</CardTitle>
                  <CardDescription>{t.quickActionsDesc}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  <ActionCard
                    href="/system/providers/list"
                    icon={ClipboardList}
                    title={t.providersList}
                    description={t.recentProvidersDesc}
                  />

                  {canCreateProviders ? (
                    <ActionCard
                      href="/system/providers/create"
                      icon={PlusCircle}
                      title={t.createProvider}
                      description={t.emptyText}
                    />
                  ) : null}

                  {canImportProviders ? (
                    <ActionCard
                      href="/system/providers/import"
                      icon={UploadCloud}
                      title={t.importProviders}
                      description={t.importedProviders}
                    />
                  ) : null}

                  {canViewContracts ? (
                    <ActionCard
                      href="/system/contracts"
                      icon={FileText}
                      title={t.contracts}
                      description={t.contracts}
                    />
                  ) : null}

                  <ActionCard
                    href="/system/centers"
                    icon={Building2}
                    title={t.centers}
                    description={t.centers}
                  />
                </CardContent>
              </Card>

              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardHeader>
                  <CardTitle>{t.typeDistribution}</CardTitle>
                  <CardDescription>{t.typeDistributionDesc}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  {typeRows.map((row) => (
                    <TypeDistributionRow
                      key={row.label}
                      icon={row.icon}
                      label={row.label}
                      value={row.value}
                      total={summary.total_providers}
                    />
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}