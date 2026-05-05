"use client";

/* ============================================================
   📂 app/system/providers/[id]/page.tsx
   🧠 Primey Care | Provider Details
   ------------------------------------------------------------
   ✅ المرحلة 17 + المرحلة 2
   ✅ مبني بنفس نمط تفاصيل المراكز/العملاء المعتمد
   ✅ Side Profile Card + Main Content
   ✅ لا يوجد حذف نهائي
   ✅ لا توجد أزرار وهمية أو معطلة
   ✅ Error State مستقل عن Not Found
   ✅ Skeleton Loading
   ✅ Web PDF Print
   ✅ حماية روابط التفاصيل والأزرار والطلبات
   ✅ fallback آمن لـ system_admin / superadmin
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ استخدام toast من sonner
   ✅ بدون localhost hardcoded
   ✅ الأرقام تبقى بالإنجليزية
============================================================ */

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarDays,
  ClipboardList,
  Copy,
  Eye,
  FileText,
  Globe2,
  Hospital,
  Layers3,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Printer,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  XCircle,
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
  Table,
  TableBody,
  TableCell,
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

type ProviderDetail = {
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
  licenseNumber: string;
  taxNumber: string;
  commercialRegistration: string;
  notes: string;
  isFeatured: boolean;
  servicesCount: number;
  contractsCount: number;
  ordersCount: number;
  invoicesCount: number;
  createdAt: string;
  updatedAt: string;
  services: unknown[];
  contracts: unknown[];
  raw: Record<string, unknown>;
};

type ProviderDetailResponse = {
  ok?: boolean;
  message?: string;
  data?: unknown;
  provider?: unknown;
  center?: unknown;
  item?: unknown;
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

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const parsed = Number(
    String(value ?? "")
      .replace(/,/g, "")
      .replace(/[^\d.-]/g, ""),
  );

  return Number.isFinite(parsed) ? parsed : 0;
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

function getObjectValue(obj: Record<string, unknown>, key: string): unknown {
  const direct = obj[key];

  if (direct !== undefined && direct !== null && direct !== "") {
    return direct;
  }

  const containers = [
    "provider",
    "center",
    "item",
    "data",
    "profile",
    "stats",
    "summary",
  ];

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

function unwrapProvider(payload: unknown): unknown {
  const wrapper = (payload || {}) as ProviderDetailResponse;

  return wrapper.data || wrapper.provider || wrapper.center || wrapper.item || payload || {};
}

function normalizeProviderDetail(payload: unknown): ProviderDetail {
  const obj = unwrapProvider(payload) as Record<string, unknown>;

  const id = getObjectValue(obj, "id") ?? "";
  const name =
    getObjectValue(obj, "name") ??
    getObjectValue(obj, "provider_name") ??
    getObjectValue(obj, "center_name") ??
    "-";

  const servicesRaw = obj.services || obj.service_items;
  const contractsRaw = obj.contracts;

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
    licenseNumber: String(
      getObjectValue(obj, "license_number") ??
        getObjectValue(obj, "medical_license_number") ??
        "",
    ),
    taxNumber: String(
      getObjectValue(obj, "tax_number") ??
        getObjectValue(obj, "vat_number") ??
        "",
    ),
    commercialRegistration: String(
      getObjectValue(obj, "commercial_registration") ??
        getObjectValue(obj, "cr_number") ??
        "",
    ),
    notes: String(getObjectValue(obj, "notes") ?? ""),
    isFeatured: Boolean(
      getObjectValue(obj, "is_featured") ?? getObjectValue(obj, "featured"),
    ),
    servicesCount: Array.isArray(servicesRaw)
      ? servicesRaw.length
      : toNumber(
          getObjectValue(obj, "services_count") ??
            getObjectValue(obj, "service_items_count"),
        ),
    contractsCount: Array.isArray(contractsRaw)
      ? contractsRaw.length
      : toNumber(getObjectValue(obj, "contracts_count")),
    ordersCount: toNumber(
      getObjectValue(obj, "orders_count") ?? getObjectValue(obj, "total_orders"),
    ),
    invoicesCount: toNumber(
      getObjectValue(obj, "invoices_count") ??
        getObjectValue(obj, "total_invoices"),
    ),
    createdAt: String(getObjectValue(obj, "created_at") ?? ""),
    updatedAt: String(getObjectValue(obj, "updated_at") ?? ""),
    services: Array.isArray(servicesRaw) ? servicesRaw : [],
    contracts: Array.isArray(contractsRaw) ? contractsRaw : [],
    raw: obj,
  };
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "تفاصيل مقدم الخدمة" : "Provider Details",
    subtitle: isArabic
      ? "عرض بيانات مقدم الخدمة، التواصل، الموقع، الترخيص، والخدمات والعقود المرتبطة."
      : "View provider profile, contact, location, licensing, linked services, and contracts.",

    back: isArabic ? "العودة لمقدمي الخدمة" : "Back to Providers",
    providersList: isArabic ? "قائمة مقدمي الخدمة" : "Providers List",
    refresh: isArabic ? "تحديث" : "Refresh",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    retry: isArabic ? "إعادة المحاولة" : "Retry",

    overview: isArabic ? "نظرة عامة" : "Overview",
    overviewDesc: isArabic
      ? "بيانات مقدم الخدمة الأساسية والحالة التشغيلية."
      : "Basic provider data and operational status.",

    contact: isArabic ? "بيانات التواصل" : "Contact Information",
    contactDesc: isArabic
      ? "الهاتف والجوال والبريد ومسؤول التواصل."
      : "Phone, mobile, email, and contact person.",

    location: isArabic ? "الموقع والعنوان" : "Location & Address",
    locationDesc: isArabic
      ? "المدينة والحي والعنوان ورابط الخريطة."
      : "City, area, address, and map link.",

    legal: isArabic ? "البيانات النظامية" : "Legal Information",
    legalDesc: isArabic
      ? "بيانات الترخيص والسجل والرقم الضريبي إن وجدت."
      : "License, registration, and tax information when available.",

    operations: isArabic ? "المؤشرات التشغيلية" : "Operational Indicators",
    operationsDesc: isArabic
      ? "ملخص الخدمات والعقود والطلبات المرتبطة."
      : "Summary of linked services, contracts, and orders.",

    linkedData: isArabic ? "البيانات المرتبطة" : "Linked Data",
    linkedDataDesc: isArabic
      ? "عرض مختصر للخدمات والعقود المتوفرة في بيانات مقدم الخدمة."
      : "Compact view of available services and contracts in provider data.",

    notes: isArabic ? "الملاحظات" : "Notes",
    notesDesc: isArabic
      ? "ملاحظات تشغيلية مرتبطة بمقدم الخدمة."
      : "Operational notes related to this provider.",

    quickInfo: isArabic ? "معلومات سريعة" : "Quick Info",
    copy: isArabic ? "نسخ" : "Copy",
    copied: isArabic ? "تم النسخ بنجاح" : "Copied successfully",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الصفحة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض تفاصيل مقدمي الخدمة. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view provider details. Contact your system administrator if you need access.",

    notFoundTitle: isArabic ? "مقدم الخدمة غير موجود" : "Provider not found",
    notFoundText: isArabic
      ? "لم يتم العثور على مقدم الخدمة المطلوب أو قد يكون غير متاح."
      : "The requested provider could not be found or may not be available.",

    loadError: isArabic
      ? "تعذر تحميل تفاصيل مقدم الخدمة."
      : "Unable to load provider details.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    refreshSuccess: isArabic
      ? "تم تحديث تفاصيل مقدم الخدمة بنجاح."
      : "Provider details refreshed successfully.",
    printReady: isArabic
      ? "تم تجهيز نافذة الطباعة."
      : "Print window prepared.",
    printError: isArabic
      ? "تعذر فتح نافذة الطباعة."
      : "Unable to open print window.",

    fields: {
      id: isArabic ? "المعرف" : "ID",
      code: isArabic ? "الكود" : "Code",
      name: isArabic ? "اسم مقدم الخدمة" : "Provider Name",
      type: isArabic ? "التصنيف" : "Type",
      status: isArabic ? "الحالة" : "Status",
      contactPerson: isArabic ? "مسؤول التواصل" : "Contact Person",
      phone: isArabic ? "الهاتف" : "Phone",
      mobile: isArabic ? "الجوال" : "Mobile",
      email: isArabic ? "البريد الإلكتروني" : "Email",
      website: isArabic ? "الموقع الإلكتروني" : "Website",
      city: isArabic ? "المدينة" : "City",
      area: isArabic ? "الحي / المنطقة" : "Area",
      address: isArabic ? "العنوان" : "Address",
      googleMapsLink: isArabic ? "رابط الخريطة" : "Map Link",
      licenseNumber: isArabic ? "رقم الترخيص" : "License Number",
      taxNumber: isArabic ? "الرقم الضريبي" : "Tax Number",
      commercialRegistration: isArabic
        ? "السجل التجاري"
        : "Commercial Registration",
      servicesCount: isArabic ? "الخدمات" : "Services",
      contractsCount: isArabic ? "العقود" : "Contracts",
      ordersCount: isArabic ? "الطلبات" : "Orders",
      invoicesCount: isArabic ? "الفواتير" : "Invoices",
      notes: isArabic ? "الملاحظات" : "Notes",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      updatedAt: isArabic ? "آخر تحديث" : "Updated At",
    },

    statuses: {
      ACTIVE: isArabic ? "نشط" : "Active",
      INACTIVE: isArabic ? "غير نشط" : "Inactive",
      SUSPENDED: isArabic ? "موقوف" : "Suspended",
      DRAFT: isArabic ? "مسودة" : "Draft",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<ProviderStatus, string>,

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

    badges: {
      featured: isArabic ? "مميز" : "Featured",
      hasContact: isArabic ? "بيانات تواصل متوفرة" : "Contact Available",
      noContact: isArabic ? "لا توجد بيانات تواصل" : "No Contact",
      hasLocation: isArabic ? "بيانات موقع متوفرة" : "Location Available",
      noLocation: isArabic ? "لا توجد بيانات موقع" : "No Location",
    },

    empty: isArabic ? "لا توجد بيانات" : "No data",
    item: isArabic ? "عنصر" : "Item",
    printedAt: isArabic ? "تاريخ الطباعة" : "Printed At",
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

function isValidId(id: unknown) {
  const value = String(id || "").trim();

  return value.length > 0 && value !== "-" && value !== "undefined";
}

function statusLabel(status: ProviderStatus, locale: AppLocale) {
  return dictionary(locale).statuses[status];
}

function typeLabel(type: ProviderType, locale: AppLocale) {
  return dictionary(locale).typeLabels[type];
}

function providerIcon(type: ProviderType): ComponentType<{ className?: string }> {
  if (type === "HOSPITAL") return Hospital;
  if (type === "MEDICAL_CENTER") return Stethoscope;
  if (type === "PHARMACY") return ShieldCheck;
  if (type === "LAB") return Layers3;
  if (type === "CLINIC") return Stethoscope;

  return Building2;
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

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function DetailSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardContent className="space-y-4 p-5">
          <SkeletonLine className="h-16 w-16 rounded-2xl" />
          <SkeletonLine className="h-6 w-48" />
          <SkeletonLine className="h-4 w-32" />
          <div className="grid gap-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonLine key={index} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index} className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="space-y-3 p-5">
              <SkeletonLine className="h-5 w-40" />
              <SkeletonLine className="h-4 w-full" />
              <SkeletonLine className="h-4 w-3/4" />
              <SkeletonLine className="h-4 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function copyToClipboard(value: string, successMessage: string) {
  if (!value || value === "-") return;

  navigator.clipboard.writeText(value);
  toast.success(successMessage);
}

function InfoRow({
  label,
  value,
  copyable,
  copiedMessage,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  copiedMessage: string;
}) {
  return (
    <TableRow>
      <TableCell className="w-[220px] text-muted-foreground">{label}</TableCell>
      <TableCell>
        <div className="flex items-center justify-between gap-3">
          <span className="break-words font-medium">{value || "-"}</span>

          {copyable && value && value !== "-" ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg"
              onClick={() => copyToClipboard(value, copiedMessage)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

function QuickInfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-background p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold">{value || "-"}</p>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <div className="mt-2 text-lg font-bold">{value}</div>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function TextSection({
  label,
  value,
  empty,
}: {
  label: string;
  value: string;
  empty: string;
}) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
        {value || empty}
      </p>
    </div>
  );
}

function toReadableLinkedItem(item: unknown, index: number) {
  if (!item || typeof item !== "object") {
    return {
      title: `#${index + 1}`,
      subtitle: String(item ?? "-"),
      badge: "-",
    };
  }

  const obj = item as Record<string, unknown>;

  return {
    title: String(
      obj.name ??
        obj.title ??
        obj.code ??
        obj.contract_number ??
        obj.service_name ??
        `#${index + 1}`,
    ),
    subtitle: String(obj.description ?? obj.notes ?? obj.status ?? "-"),
    badge: String(obj.type ?? obj.category ?? obj.status ?? "-"),
  };
}

function LinkedList({
  title,
  items,
  empty,
  itemLabel,
}: {
  title: string;
  items: unknown[];
  empty: string;
  itemLabel: string;
}) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <p className="text-sm font-semibold">{title}</p>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((item, index) => {
            const row = toReadableLinkedItem(item, index);

            return (
              <div
                key={`${row.title}-${index}`}
                className="rounded-xl border bg-card p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {row.title || `${itemLabel} ${index + 1}`}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {row.subtitle || "-"}
                    </p>
                  </div>

                  <Badge variant="outline" className="shrink-0 rounded-full">
                    {row.badge || "-"}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Print
============================================================ */

function buildPrintHtml({
  locale,
  provider,
  t,
}: {
  locale: AppLocale;
  provider: ProviderDetail;
  t: ReturnType<typeof dictionary>;
}) {
  const isArabic = locale === "ar";
  const now = new Date().toLocaleString("en-US");

  const rows: Array<[string, string]> = [
    [t.fields.name, provider.name],
    [t.fields.code, provider.code],
    [t.fields.type, typeLabel(provider.providerType, locale)],
    [t.fields.status, statusLabel(provider.status, locale)],
    [t.fields.contactPerson, provider.contactPerson || "-"],
    [t.fields.phone, provider.phone || "-"],
    [t.fields.mobile, provider.mobile || "-"],
    [t.fields.email, provider.email || "-"],
    [t.fields.website, provider.website || "-"],
    [t.fields.city, provider.city || "-"],
    [t.fields.area, provider.area || "-"],
    [t.fields.address, provider.address || "-"],
    [t.fields.licenseNumber, provider.licenseNumber || "-"],
    [t.fields.taxNumber, provider.taxNumber || "-"],
    [t.fields.commercialRegistration, provider.commercialRegistration || "-"],
    [t.fields.servicesCount, formatNumber(provider.servicesCount)],
    [t.fields.contractsCount, formatNumber(provider.contractsCount)],
    [t.fields.ordersCount, formatNumber(provider.ordersCount)],
    [t.fields.invoicesCount, formatNumber(provider.invoicesCount)],
    [t.fields.createdAt, formatDate(provider.createdAt)],
    [t.fields.updatedAt, formatDate(provider.updatedAt || provider.createdAt)],
  ];

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
          .print-header {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            align-items: flex-start;
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
            font-size: 12px;
            line-height: 1.8;
            color: #6b7280;
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
            font-size: 13px;
            margin-bottom: 18px;
          }
          th,
          td {
            border: 1px solid #e5e7eb;
            padding: 10px 9px;
            text-align: ${isArabic ? "right" : "left"};
            vertical-align: top;
          }
          th {
            width: 240px;
            background: #f3f4f6;
            color: #111827;
          }
          .section-title {
            margin: 18px 0 8px;
            font-size: 16px;
            font-weight: 800;
          }
          .text-block {
            border: 1px solid #e5e7eb;
            padding: 12px;
            border-radius: 12px;
            line-height: 1.8;
            white-space: pre-wrap;
          }
          @page {
            size: A4;
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
            <h1>${escapeHtml(provider.name)}</h1>
            <div class="meta">
              <div>${escapeHtml(t.fields.code)}: ${escapeHtml(provider.code)}</div>
              <div>${escapeHtml(t.printedAt)}: ${escapeHtml(now)}</div>
            </div>
          </div>
          <div class="badge">Primey Care</div>
        </div>

        <table>
          <tbody>
            ${rows
              .map(
                ([label, value]) => `
                  <tr>
                    <th>${escapeHtml(label)}</th>
                    <td>${escapeHtml(value || "-")}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>

        <div class="section-title">${escapeHtml(t.fields.notes)}</div>
        <div class="text-block">${escapeHtml(provider.notes || "-")}</div>

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

export default function SystemProviderDetailsPage() {
  const params = useParams();
  const auth = useAuth() as unknown;

  const providerId = String(params?.id || "");

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [provider, setProvider] = useState<ProviderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [notFound, setNotFound] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const authResolving = isAuthResolving(auth);

  const canViewProviders = hasSafePermission(
    auth,
    ["providers.view", "providers.detail", "providers.list", "centers.view", "centers.detail", "centers.list"],
    "view",
  );

  const canViewProvidersList = hasSafePermission(
    auth,
    ["providers.view", "providers.list", "centers.view", "centers.list"],
    "view",
  );

  const canPrintProviders = hasSafePermission(
    auth,
    ["providers.print", "centers.print", "reports.print"],
    "action",
  );

  const ProviderIcon = provider ? providerIcon(provider.providerType) : Building2;

  const loadProvider = useCallback(
    async (showToast = false) => {
      if (!canViewProviders) {
        setIsLoading(false);
        setProvider(null);
        return;
      }

      if (!isValidId(providerId)) {
        setIsLoading(false);
        setProvider(null);
        setNotFound(true);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");
        setNotFound(false);

        const response = await fetch(
          apiUrl(`/api/providers/${encodeURIComponent(providerId)}/`),
          {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          },
        );

        const payload = (await response.json().catch(() => null)) as
          | ProviderDetailResponse
          | null;

        if (response.status === 404) {
          setProvider(null);
          setNotFound(true);
          return;
        }

        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.message || `HTTP ${response.status}`);
        }

        const normalized = normalizeProviderDetail(payload);

        if (!isValidId(normalized.id)) {
          setProvider(null);
          setNotFound(true);
          return;
        }

        setProvider(normalized);

        if (showToast) {
          toast.success(t.refreshSuccess);
        }
      } catch (error) {
        console.error("Failed to load provider details:", error);
        setProvider(null);
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [canViewProviders, providerId, t.loadError, t.refreshSuccess],
  );

  function printProvider() {
    if (!canPrintProviders || !provider) return;

    const printWindow = window.open("", "_blank", "width=1000,height=800");

    if (!printWindow) {
      toast.error(t.printError);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      buildPrintHtml({
        locale,
        provider,
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
    loadProvider(false);
  }, [authResolving, loadProvider]);

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
            {provider?.name || t.title}
          </h1>

          <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
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

          {canViewProvidersList ? (
            <Link href="/system/providers/list">
              <Button
                variant="outline"
                className="h-10 w-full rounded-xl sm:w-auto"
              >
                <ClipboardList className="h-4 w-4" />
                <span>{t.providersList}</span>
              </Button>
            </Link>
          ) : null}

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadProvider(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refresh}</span>
          </Button>

          {canPrintProviders && provider ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={printProvider}
              disabled={isLoading || Boolean(errorMessage) || notFound}
            >
              <Printer className="h-4 w-4" />
              <span>{t.print}</span>
            </Button>
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
                <p className="font-semibold text-destructive">{errorMessage}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.loadErrorHint}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => loadProvider(true)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Not Found */}
      {!isLoading && !errorMessage && notFound ? (
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Building2 className="h-7 w-7 text-muted-foreground" />
            </div>

            <div>
              <p className="text-lg font-semibold">{t.notFoundTitle}</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                {t.notFoundText}
              </p>
            </div>

            {canViewProvidersList ? (
              <Link href="/system/providers/list">
                <Button className="mt-2 rounded-xl">
                  <ClipboardList className="h-4 w-4" />
                  {t.providersList}
                </Button>
              </Link>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? <DetailSkeleton /> : null}

      {!isLoading && !errorMessage && provider && !notFound ? (
        <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          {/* Side Profile */}
          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardContent className="space-y-5 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border bg-muted">
                    <ProviderIcon className="h-8 w-8" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-lg font-bold">
                        {provider.name}
                      </p>

                      {provider.isFeatured ? (
                        <Sparkles className="h-4 w-4 shrink-0 fill-orange-400 text-orange-400" />
                      ) : null}
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {provider.code}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {statusBadge(provider.status, locale)}
                      <Badge variant="secondary" className="rounded-full">
                        {typeLabel(provider.providerType, locale)}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">
                    {t.fields.servicesCount}
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    {formatNumber(provider.servicesCount)}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-full">
                      {t.fields.contractsCount}:{" "}
                      {formatNumber(provider.contractsCount)}
                    </Badge>
                    <Badge variant="outline" className="rounded-full">
                      {t.fields.ordersCount}:{" "}
                      {formatNumber(provider.ordersCount)}
                    </Badge>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Button
                    variant="outline"
                    className="justify-start rounded-xl"
                    onClick={() => copyToClipboard(provider.code, t.copied)}
                  >
                    <Copy className="h-4 w-4" />
                    {t.copy} {t.fields.code}
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start rounded-xl"
                    onClick={() => copyToClipboard(provider.name, t.copied)}
                  >
                    <Copy className="h-4 w-4" />
                    {t.copy} {t.fields.name}
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start rounded-xl"
                    onClick={() => copyToClipboard(String(provider.id), t.copied)}
                  >
                    <Copy className="h-4 w-4" />
                    {t.copy} {t.fields.id}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">
                  {t.quickInfo}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                <QuickInfoItem
                  icon={Phone}
                  label={t.fields.phone}
                  value={provider.phone || provider.mobile || "-"}
                />

                <QuickInfoItem
                  icon={Mail}
                  label={t.fields.email}
                  value={provider.email || "-"}
                />

                <QuickInfoItem
                  icon={MapPin}
                  label={t.fields.city}
                  value={provider.city || "-"}
                />

                <QuickInfoItem
                  icon={CalendarDays}
                  label={t.fields.updatedAt}
                  value={formatDate(provider.updatedAt || provider.createdAt)}
                />
              </CardContent>
            </Card>
          </aside>

          {/* Main Content */}
          <main className="space-y-4">
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Eye className="h-4 w-4" />
                  {t.overview}
                </CardTitle>
                <CardDescription>{t.overviewDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="overflow-hidden rounded-xl border">
                  <Table>
                    <TableBody>
                      <InfoRow
                        label={t.fields.id}
                        value={String(provider.id)}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.code}
                        value={provider.code}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.name}
                        value={provider.name}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.type}
                        value={typeLabel(provider.providerType, locale)}
                        copiedMessage={t.copied}
                      />
                      <TableRow>
                        <TableCell className="w-[220px] text-muted-foreground">
                          {t.fields.status}
                        </TableCell>
                        <TableCell>{statusBadge(provider.status, locale)}</TableCell>
                      </TableRow>
                      <InfoRow
                        label={t.fields.createdAt}
                        value={formatDate(provider.createdAt)}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.updatedAt}
                        value={formatDate(provider.updatedAt || provider.createdAt)}
                        copiedMessage={t.copied}
                      />
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Phone className="h-4 w-4" />
                  {t.contact}
                </CardTitle>
                <CardDescription>{t.contactDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="overflow-hidden rounded-xl border">
                  <Table>
                    <TableBody>
                      <InfoRow
                        label={t.fields.contactPerson}
                        value={provider.contactPerson || "-"}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.phone}
                        value={provider.phone || "-"}
                        copyable={Boolean(provider.phone)}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.mobile}
                        value={provider.mobile || "-"}
                        copyable={Boolean(provider.mobile)}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.email}
                        value={provider.email || "-"}
                        copyable={Boolean(provider.email)}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.website}
                        value={provider.website || "-"}
                        copyable={Boolean(provider.website)}
                        copiedMessage={t.copied}
                      />
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-full">
                    <Phone className="h-3.5 w-3.5" />
                    {provider.phone || provider.mobile || provider.email
                      ? t.badges.hasContact
                      : t.badges.noContact}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <MapPin className="h-4 w-4" />
                  {t.location}
                </CardTitle>
                <CardDescription>{t.locationDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="overflow-hidden rounded-xl border">
                  <Table>
                    <TableBody>
                      <InfoRow
                        label={t.fields.city}
                        value={provider.city || "-"}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.area}
                        value={provider.area || "-"}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.address}
                        value={provider.address || "-"}
                        copyable={Boolean(provider.address)}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.googleMapsLink}
                        value={provider.googleMapsLink || "-"}
                        copyable={Boolean(provider.googleMapsLink)}
                        copiedMessage={t.copied}
                      />
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-full">
                    <MapPin className="h-3.5 w-3.5" />
                    {provider.city || provider.area || provider.address
                      ? t.badges.hasLocation
                      : t.badges.noLocation}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <ShieldCheck className="h-4 w-4" />
                  {t.legal}
                </CardTitle>
                <CardDescription>{t.legalDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <MetricCard
                    icon={BadgeCheck}
                    label={t.fields.licenseNumber}
                    value={provider.licenseNumber || "-"}
                  />
                  <MetricCard
                    icon={FileText}
                    label={t.fields.taxNumber}
                    value={provider.taxNumber || "-"}
                  />
                  <MetricCard
                    icon={Globe2}
                    label={t.fields.commercialRegistration}
                    value={provider.commercialRegistration || "-"}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Layers3 className="h-4 w-4" />
                  {t.operations}
                </CardTitle>
                <CardDescription>{t.operationsDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    icon={Stethoscope}
                    label={t.fields.servicesCount}
                    value={formatNumber(provider.servicesCount)}
                  />
                  <MetricCard
                    icon={FileText}
                    label={t.fields.contractsCount}
                    value={formatNumber(provider.contractsCount)}
                  />
                  <MetricCard
                    icon={ClipboardList}
                    label={t.fields.ordersCount}
                    value={formatNumber(provider.ordersCount)}
                  />
                  <MetricCard
                    icon={FileText}
                    label={t.fields.invoicesCount}
                    value={formatNumber(provider.invoicesCount)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Building2 className="h-4 w-4" />
                  {t.linkedData}
                </CardTitle>
                <CardDescription>{t.linkedDataDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4 lg:grid-cols-2">
                <LinkedList
                  title={t.fields.servicesCount}
                  items={provider.services}
                  empty={t.empty}
                  itemLabel={t.item}
                />

                <LinkedList
                  title={t.fields.contractsCount}
                  items={provider.contracts}
                  empty={t.empty}
                  itemLabel={t.item}
                />
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <FileText className="h-4 w-4" />
                  {t.notes}
                </CardTitle>
                <CardDescription>{t.notesDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <TextSection
                  label={t.fields.notes}
                  value={provider.notes}
                  empty={t.empty}
                />
              </CardContent>
            </Card>
          </main>
        </div>
      ) : null}
    </div>
  );
}