"use client";

/* ============================================================
   📂 app/system/contracts/page.tsx
   🧠 Primey Care | Contracts Dashboard
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
   ✅ استخدام رمز SAR الرسمي /currency/sar.svg
   ✅ بدون localhost hardcoded
   ✅ الأرقام تبقى بالإنجليزية
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Building2,
  CalendarClock,
  ClipboardList,
  Columns3,
  Download,
  Eye,
  FileText,
  Handshake,
  Layers3,
  ListChecks,
  Loader2,
  Percent,
  Plus,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  Wallet,
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

type ContractStatus =
  | "DRAFT"
  | "ACTIVE"
  | "SUSPENDED"
  | "EXPIRED"
  | "TERMINATED"
  | "UNKNOWN";

type PricingModel =
  | "DISCOUNT"
  | "FIXED_PRICE"
  | "COMMISSION"
  | "MIXED"
  | "UNKNOWN";

type StatusFilter = "all" | ContractStatus;
type PricingFilter = "all" | PricingModel;

type Contract = {
  id: number | string;
  contractNumber: string;
  title: string;
  providerId: string;
  providerName: string;
  status: ContractStatus;
  pricingModel: PricingModel;
  discountPercentage: number;
  systemCommissionPercentage: number;
  contractValue: number;
  startDate: string;
  endDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  raw: Record<string, unknown>;
};

type ContractsApiResponse = {
  ok?: boolean;
  message?: string;
  count?: number;
  results?: unknown[];
  contracts?: unknown[];
  items?: unknown[];
  data?:
    | unknown[]
    | {
        results?: unknown[];
        contracts?: unknown[];
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

const SAR_ICON_PATH = "/currency/sar.svg";

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

function normalizeStatus(value: unknown): ContractStatus {
  const status = String(value || "").toUpperCase();

  if (status === "DRAFT") return "DRAFT";
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "SUSPENDED") return "SUSPENDED";
  if (status === "EXPIRED") return "EXPIRED";
  if (status === "TERMINATED") return "TERMINATED";

  return "UNKNOWN";
}

function normalizePricingModel(value: unknown): PricingModel {
  const model = String(value || "").toUpperCase();

  if (model === "DISCOUNT") return "DISCOUNT";
  if (model === "FIXED_PRICE") return "FIXED_PRICE";
  if (model === "COMMISSION") return "COMMISSION";
  if (model === "MIXED") return "MIXED";

  return "UNKNOWN";
}

function getObjectValue(obj: Record<string, unknown>, key: string): unknown {
  const direct = obj[key];

  if (direct !== undefined && direct !== null && direct !== "") {
    return direct;
  }

  const containers = [
    "contract",
    "provider",
    "center",
    "item",
    "data",
    "summary",
    "totals",
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

function extractContracts(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== "object") return [];

  const response = payload as ContractsApiResponse;

  if (Array.isArray(response.results)) return response.results;
  if (Array.isArray(response.contracts)) return response.contracts;
  if (Array.isArray(response.items)) return response.items;
  if (Array.isArray(response.data)) return response.data;

  if (response.data && typeof response.data === "object") {
    if (Array.isArray(response.data.results)) return response.data.results;
    if (Array.isArray(response.data.contracts)) return response.data.contracts;
    if (Array.isArray(response.data.items)) return response.data.items;
  }

  return [];
}

function normalizeContract(item: unknown): Contract {
  const obj = (item || {}) as Record<string, unknown>;

  const provider = (obj.provider || obj.center) as
    | Record<string, unknown>
    | undefined;

  const id = getObjectValue(obj, "id") ?? "";

  const contractNumber =
    getObjectValue(obj, "contract_number") ??
    getObjectValue(obj, "number") ??
    getObjectValue(obj, "code") ??
    (id ? `CTR-${id}` : "-");

  const title =
    getObjectValue(obj, "title") ??
    getObjectValue(obj, "name") ??
    getObjectValue(obj, "contract_title") ??
    contractNumber;

  return {
    id: id as number | string,
    contractNumber: String(contractNumber || "-"),
    title: String(title || "-"),
    providerId: String(
      getObjectValue(obj, "provider_id") ??
        getObjectValue(obj, "center_id") ??
        provider?.id ??
        "",
    ),
    providerName: String(
      getObjectValue(obj, "provider_name") ??
        getObjectValue(obj, "center_name") ??
        provider?.name ??
        "-",
    ),
    status: normalizeStatus(getObjectValue(obj, "status")),
    pricingModel: normalizePricingModel(
      getObjectValue(obj, "pricing_model") ?? getObjectValue(obj, "model"),
    ),
    discountPercentage: toNumber(
      getObjectValue(obj, "discount_percentage") ??
        getObjectValue(obj, "discount_percent"),
    ),
    systemCommissionPercentage: toNumber(
      getObjectValue(obj, "system_commission_percentage") ??
        getObjectValue(obj, "commission_percentage") ??
        getObjectValue(obj, "commission_percent"),
    ),
    contractValue: toNumber(
      getObjectValue(obj, "contract_value") ??
        getObjectValue(obj, "total_value") ??
        getObjectValue(obj, "amount") ??
        0,
    ),
    startDate: String(
      getObjectValue(obj, "start_date") ??
        getObjectValue(obj, "valid_from") ??
        "",
    ),
    endDate: String(
      getObjectValue(obj, "end_date") ??
        getObjectValue(obj, "valid_to") ??
        "",
    ),
    notes: String(getObjectValue(obj, "notes") ?? ""),
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
    pageTitle: isArabic ? "إدارة العقود" : "Contracts Management",
    pageSubtitle: isArabic
      ? "متابعة عقود مقدمي الخدمة، حالات التفعيل، نسب الخصم، ونسب النظام."
      : "Monitor provider contracts, activation status, discount rates, and system commission rates.",

    createContract: isArabic ? "إنشاء عقد" : "Create Contract",
    contractsList: isArabic ? "قائمة العقود" : "Contracts List",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",

    searchPlaceholder: isArabic
      ? "ابحث برقم العقد أو العنوان أو مقدم الخدمة أو الحالة..."
      : "Search by contract number, title, provider, or status...",

    all: isArabic ? "الكل" : "All",
    allStatuses: isArabic ? "كل الحالات" : "All Statuses",
    allPricing: isArabic ? "كل نماذج التسعير" : "All Pricing Models",

    totalContracts: isArabic ? "إجمالي العقود" : "Total Contracts",
    activeContracts: isArabic ? "العقود النشطة" : "Active Contracts",
    totalValue: isArabic ? "قيمة العقود" : "Contracts Value",
    avgCommission: isArabic ? "متوسط نسبة النظام" : "Avg. System Commission",

    latestContracts: isArabic ? "أحدث العقود" : "Latest Contracts",
    latestContractsDesc: isArabic
      ? "عرض مختصر لأحدث العقود حسب الفلاتر الحالية."
      : "A compact view of the latest contracts based on current filters.",

    statusTitle: isArabic ? "حالة العقود" : "Contracts Status",
    statusDesc: isArabic
      ? "تحليل سريع لحالات العقود التشغيلية."
      : "Quick analysis of operational contract statuses.",

    quickAccessTitle: isArabic ? "إجراءات وحدة العقود" : "Contracts Module Actions",
    quickAccessSubtitle: isArabic
      ? "اختصارات منظمة للوصول إلى أهم صفحات وحدة العقود."
      : "Organized shortcuts to the key contracts module pages.",
    actionListTitle: isArabic ? "قائمة العقود" : "Contracts List",
    actionListDesc: isArabic
      ? "استعراض جميع العقود، البحث، الفلترة، وإدارة السجلات."
      : "Browse all contracts, search, filter, and manage records.",
    actionCreateTitle: isArabic ? "إنشاء عقد" : "Create Contract",
    actionCreateDesc: isArabic
      ? "إضافة عقد جديد وربطه بمقدم الخدمة والمنتجات والشروط."
      : "Add a new contract and link it with provider, products, and terms.",
    open: isArabic ? "فتح" : "Open",
    manage: isArabic ? "إدارة" : "Manage",
    viewFullList: isArabic ? "عرض القائمة الكاملة" : "View Full List",

    draft: isArabic ? "مسودة" : "Draft",
    active: isArabic ? "نشط" : "Active",
    suspended: isArabic ? "موقوف" : "Suspended",
    expired: isArabic ? "منتهي" : "Expired",
    terminated: isArabic ? "منهى" : "Terminated",
    unknown: isArabic ? "غير محدد" : "Unknown",

    discount: isArabic ? "خصم" : "Discount",
    fixedPrice: isArabic ? "سعر ثابت" : "Fixed Price",
    commission: isArabic ? "عمولة" : "Commission",
    mixed: isArabic ? "مختلط" : "Mixed",

    table: {
      contract: isArabic ? "العقد" : "Contract",
      provider: isArabic ? "مقدم الخدمة" : "Provider",
      pricing: isArabic ? "التسعير" : "Pricing",
      discount: isArabic ? "الخصم" : "Discount",
      commission: isArabic ? "نسبة النظام" : "System Commission",
      value: isArabic ? "القيمة" : "Value",
      period: isArabic ? "المدة" : "Period",
      status: isArabic ? "الحالة" : "Status",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      action: isArabic ? "الإجراء" : "Action",
    },

    emptyTitle: isArabic ? "لا توجد عقود بعد" : "No contracts yet",
    emptyText: isArabic
      ? "عند إنشاء عقود جديدة ستظهر بياناتها هنا مباشرة."
      : "New contracts will appear here once they are created.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير كلمات البحث أو فلاتر الحالة والتسعير."
      : "Try changing search keywords, status filters, or pricing filters.",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الصفحة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض بيانات العقود. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view contracts data. Contact your system administrator if you need access.",

    apiError: isArabic
      ? "تعذر تحميل بيانات العقود."
      : "Unable to load contracts data.",
    apiErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    refreshSuccess: isArabic
      ? "تم تحديث بيانات العقود بنجاح."
      : "Contracts data refreshed successfully.",
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
    filterPricing: isArabic ? "فلتر التسعير" : "Pricing Filter",
    printedAt: isArabic ? "تاريخ الطباعة" : "Printed At",
    rowsCount: isArabic ? "عدد السجلات" : "Rows Count",
    printTitle: isArabic ? "قائمة العقود" : "Contracts List",
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

function formatMoney(value: number | string): string {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return "0.00";

  return numericValue.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number | string): string {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return "0%";

  return `${numericValue.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}%`;
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

function isValidContractId(id: Contract["id"]) {
  const value = String(id || "").trim();

  return value.length > 0 && value !== "-" && value !== "undefined";
}

function SarAmount({ value }: { value: number | string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span>{formatMoney(value)}</span>
      <Image
        src={SAR_ICON_PATH}
        alt=""
        width={14}
        height={14}
        className="h-3.5 w-3.5"
      />
    </span>
  );
}

function statusLabel(status: ContractStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<ContractStatus, string> = {
    DRAFT: t.draft,
    ACTIVE: t.active,
    SUSPENDED: t.suspended,
    EXPIRED: t.expired,
    TERMINATED: t.terminated,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function pricingLabel(model: PricingModel, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<PricingModel, string> = {
    DISCOUNT: t.discount,
    FIXED_PRICE: t.fixedPrice,
    COMMISSION: t.commission,
    MIXED: t.mixed,
    UNKNOWN: t.unknown,
  };

  return labels[model];
}

function statusBadge(status: ContractStatus, locale: AppLocale) {
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

  if (status === "EXPIRED" || status === "TERMINATED") {
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
  rows: Contract[];
  t: ReturnType<typeof dictionary>;
}) {
  const isArabic = locale === "ar";
  const now = new Date().toLocaleString("en-US");

  const tableRows = rows
    .map(
      (contract, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(contract.contractNumber || "-")}</td>
          <td>${escapeHtml(contract.title || "-")}</td>
          <td>${escapeHtml(contract.providerName || "-")}</td>
          <td>${escapeHtml(pricingLabel(contract.pricingModel, locale))}</td>
          <td>${escapeHtml(formatPercent(contract.discountPercentage))}</td>
          <td>${escapeHtml(formatPercent(contract.systemCommissionPercentage))}</td>
          <td>${escapeHtml(formatMoney(contract.contractValue))}</td>
          <td>${escapeHtml(statusLabel(contract.status, locale))}</td>
          <td>${escapeHtml(formatDate(contract.startDate))}</td>
          <td>${escapeHtml(formatDate(contract.endDate))}</td>
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
              <th>${escapeHtml(t.table.contract)}</th>
              <th>${escapeHtml(isArabic ? "العنوان" : "Title")}</th>
              <th>${escapeHtml(t.table.provider)}</th>
              <th>${escapeHtml(t.table.pricing)}</th>
              <th>${escapeHtml(t.table.discount)}</th>
              <th>${escapeHtml(t.table.commission)}</th>
              <th>${escapeHtml(t.table.value)}</th>
              <th>${escapeHtml(t.table.status)}</th>
              <th>${escapeHtml(isArabic ? "البداية" : "Start")}</th>
              <th>${escapeHtml(isArabic ? "النهاية" : "End")}</th>
            </tr>
          </thead>
          <tbody>
            ${
              tableRows ||
              `<tr><td colspan="11" style="text-align:center">${escapeHtml(t.emptyTitle)}</td></tr>`
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

export default function SystemContractsPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pricingFilter, setPricingFilter] = useState<PricingFilter>("all");
  const [errorMessage, setErrorMessage] = useState("");

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canViewContracts = hasSafePermission(
    auth,
    ["contracts.view", "contracts.list"],
    "view",
  );

  const canCreateContracts = hasSafePermission(
    auth,
    ["contracts.create"],
    "action",
  );

  const canExportContracts = hasSafePermission(
    auth,
    ["contracts.export", "reports.export"],
    "action",
  );

  const canPrintContracts = hasSafePermission(
    auth,
    ["contracts.print", "reports.print"],
    "action",
  );

  const canViewContractDetails = hasSafePermission(
    auth,
    ["contracts.view", "contracts.detail"],
    "view",
  );

  const stats = useMemo(() => {
    const total = contracts.length;
    const active = contracts.filter((item) => item.status === "ACTIVE").length;
    const draft = contracts.filter((item) => item.status === "DRAFT").length;
    const suspended = contracts.filter(
      (item) => item.status === "SUSPENDED",
    ).length;
    const expired = contracts.filter((item) => item.status === "EXPIRED").length;
    const terminated = contracts.filter(
      (item) => item.status === "TERMINATED",
    ).length;

    const totalValue = contracts.reduce(
      (sum, item) => sum + item.contractValue,
      0,
    );

    const avgCommission =
      total > 0
        ? contracts.reduce(
            (sum, item) => sum + item.systemCommissionPercentage,
            0,
          ) / total
        : 0;

    return {
      total,
      active,
      draft,
      suspended,
      expired,
      terminated,
      totalValue,
      avgCommission,
    };
  }, [contracts]);

  const filteredContracts = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return contracts.filter((contract) => {
      const matchesStatus =
        statusFilter === "all" ? true : contract.status === statusFilter;

      const matchesPricing =
        pricingFilter === "all"
          ? true
          : contract.pricingModel === pricingFilter;

      const matchesQuery = !cleanQuery
        ? true
        : [
            contract.contractNumber,
            contract.title,
            contract.providerName,
            contract.status,
            contract.pricingModel,
            statusLabel(contract.status, locale),
            pricingLabel(contract.pricingModel, locale),
          ]
            .join(" ")
            .toLowerCase()
            .includes(cleanQuery);

      return matchesStatus && matchesPricing && matchesQuery;
    });
  }, [contracts, locale, pricingFilter, query, statusFilter]);

  const latestContracts = useMemo(
    () =>
      [...filteredContracts]
        .sort((a, b) => {
          const first = new Date(a.createdAt || a.updatedAt || 0).getTime();
          const second = new Date(b.createdAt || b.updatedAt || 0).getTime();

          return second - first;
        })
        .slice(0, 8),
    [filteredContracts],
  );

  const hasSearchOrFilter =
    query.trim().length > 0 ||
    statusFilter !== "all" ||
    pricingFilter !== "all";

  const statusFilters = useMemo(
    () => [
      {
        value: "all" as StatusFilter,
        label: t.allStatuses,
        count: contracts.length,
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
        value: "EXPIRED" as StatusFilter,
        label: t.expired,
        count: stats.expired,
      },
      {
        value: "TERMINATED" as StatusFilter,
        label: t.terminated,
        count: stats.terminated,
      },
    ],
    [contracts.length, stats, t],
  );

  const pricingFilters = useMemo(
    () => [
      {
        value: "all" as PricingFilter,
        label: t.allPricing,
        count: contracts.length,
      },
      ...(["DISCOUNT", "FIXED_PRICE", "COMMISSION", "MIXED"] as PricingModel[]).map(
        (model) => ({
          value: model as PricingFilter,
          label: pricingLabel(model, locale),
          count: contracts.filter((item) => item.pricingModel === model).length,
        }),
      ),
    ],
    [contracts, locale, t.allPricing],
  );

  const summaryCards = useMemo(
    () => [
      {
        title: t.totalContracts,
        value: stats.total,
        icon: FileText,
        helper: t.activeContracts,
        helperValue: formatNumber(stats.active),
        percent: stats.total > 0 ? 100 : 0,
        isMoney: false,
        isPercent: false,
      },
      {
        title: t.activeContracts,
        value: stats.active,
        icon: BadgeCheck,
        helper: t.totalContracts,
        helperValue: `${percent(stats.active, stats.total)}%`,
        percent: percent(stats.active, stats.total),
        isMoney: false,
        isPercent: false,
      },
      {
        title: t.totalValue,
        value: stats.totalValue,
        icon: Wallet,
        helper: t.totalContracts,
        helperValue: formatNumber(stats.total),
        percent: stats.totalValue > 0 ? 100 : 0,
        isMoney: true,
        isPercent: false,
      },
      {
        title: t.avgCommission,
        value: stats.avgCommission,
        icon: Percent,
        helper: t.activeContracts,
        helperValue: formatNumber(stats.active),
        percent: Math.min(Math.round(stats.avgCommission), 100),
        isMoney: false,
        isPercent: true,
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
        icon: ShieldCheck,
        percent: percent(stats.suspended, stats.total),
        filter: "SUSPENDED" as StatusFilter,
      },
      {
        title: t.expired,
        value: stats.expired,
        icon: CalendarClock,
        percent: percent(stats.expired, stats.total),
        filter: "EXPIRED" as StatusFilter,
      },
      {
        title: t.terminated,
        value: stats.terminated,
        icon: XCircle,
        percent: percent(stats.terminated, stats.total),
        filter: "TERMINATED" as StatusFilter,
      },
    ],
    [stats, t],
  );

  const moduleActions = useMemo(
    () =>
      [
        canViewContracts
          ? {
              title: t.actionListTitle,
              description: t.actionListDesc,
              href: "/system/contracts/list",
              icon: ListChecks,
              badge: `${formatNumber(stats.total)}`,
              cta: t.manage,
            }
          : null,
        canCreateContracts
          ? {
              title: t.actionCreateTitle,
              description: t.actionCreateDesc,
              href: "/system/contracts/create",
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
    [canCreateContracts, canViewContracts, isArabic, stats.total, t],
  );

  const loadContracts = useCallback(
    async (showToast = false) => {
      if (!canViewContracts) {
        setIsLoading(false);
        setContracts([]);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");

        const response = await fetch(apiUrl("/api/contracts/?page_size=100"), {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        const payload = (await response.json().catch(() => null)) as
          | ContractsApiResponse
          | null;

        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.message || `HTTP ${response.status}`);
        }

        setContracts(extractContracts(payload).map(normalizeContract));

        if (showToast) {
          toast.success(t.refreshSuccess);
        }
      } catch (error) {
        console.error("Failed to load contracts:", error);
        setContracts([]);
        setErrorMessage(t.apiError);
        toast.error(t.apiError);
      } finally {
        setIsLoading(false);
      }
    },
    [canViewContracts, t.apiError, t.refreshSuccess],
  );

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
    setPricingFilter("all");
  }

  function exportContracts() {
    if (!canExportContracts) return;

    if (filteredContracts.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const generatedAt = new Date();

    const statusFilterLabel =
      statusFilters.find((item) => item.value === statusFilter)?.label || t.all;

    const pricingFilterLabel =
      pricingFilters.find((item) => item.value === pricingFilter)?.label ||
      t.all;

    downloadExcel({
      filename: `primey-care-contracts-dashboard-${generatedAt
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "العقود" : "Contracts",
      title: t.pageTitle,
      locale,
      summaryRows: [
        [t.generatedAt, generatedAt.toLocaleString("en-US")],
        [t.reportScope, t.currentFilteredData],
        [
          t.table.contract,
          `${formatNumber(filteredContracts.length)} / ${formatNumber(
            contracts.length,
          )}`,
        ],
        [t.totalContracts, stats.total],
        [t.activeContracts, stats.active],
        [t.totalValue, formatMoney(stats.totalValue)],
        [t.avgCommission, formatPercent(stats.avgCommission)],
      ],
      filterRows: [
        [t.filterSearch, query || t.all],
        [t.filterStatus, statusFilterLabel],
        [t.filterPricing, pricingFilterLabel],
      ],
      headers: [
        t.table.contract,
        isArabic ? "العنوان" : "Title",
        t.table.provider,
        t.table.pricing,
        t.table.discount,
        t.table.commission,
        t.table.value,
        t.table.status,
        isArabic ? "البداية" : "Start Date",
        isArabic ? "النهاية" : "End Date",
        t.table.createdAt,
      ],
      rows: filteredContracts.map((contract) => [
        contract.contractNumber || "-",
        contract.title || "-",
        contract.providerName || "-",
        pricingLabel(contract.pricingModel, locale),
        formatPercent(contract.discountPercentage),
        formatPercent(contract.systemCommissionPercentage),
        formatMoney(contract.contractValue),
        statusLabel(contract.status, locale),
        formatDate(contract.startDate),
        formatDate(contract.endDate),
        formatDate(contract.createdAt),
      ]),
    });

    toast.success(t.exportSuccess);
  }

  function printContracts() {
    if (!canPrintContracts) return;

    if (filteredContracts.length === 0) {
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
        rows: filteredContracts,
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
    loadContracts(false);
  }, [authResolving, loadContracts]);

  if (!authResolving && !canViewContracts) {
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
            onClick={() => loadContracts(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refresh}</span>
          </Button>

          {canExportContracts ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={exportContracts}
              disabled={
                isLoading ||
                filteredContracts.length === 0 ||
                Boolean(errorMessage)
              }
            >
              <Download className="h-4 w-4" />
              <span>{t.exportExcel}</span>
            </Button>
          ) : null}

          {canPrintContracts ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={printContracts}
              disabled={
                isLoading ||
                filteredContracts.length === 0 ||
                Boolean(errorMessage)
              }
            >
              <Printer className="h-4 w-4" />
              <span>{t.print}</span>
            </Button>
          ) : null}

          {canViewContracts ? (
            <Link href="/system/contracts/list">
              <Button
                variant="outline"
                className="h-10 w-full rounded-xl sm:w-auto"
              >
                <ListChecks className="h-4 w-4" />
                <span>{t.contractsList}</span>
              </Button>
            </Link>
          ) : null}

          {canCreateContracts ? (
            <Link href="/system/contracts/create">
              <Button className="h-10 w-full rounded-xl sm:w-auto">
                <Plus className="h-4 w-4" />
                <span>{t.createContract}</span>
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
              onClick={() => loadContracts(true)}
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
                            {item.isMoney ? (
                              <SarAmount value={item.value} />
                            ) : item.isPercent ? (
                              formatPercent(item.value)
                            ) : (
                              formatNumber(item.value)
                            )}
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

          {/* Contracts Table */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="flex flex-col gap-3 pb-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-base font-bold">
                  {t.latestContracts}
                </CardTitle>
                <CardDescription className="mt-1 text-sm leading-6">
                  {t.latestContractsDesc}
                </CardDescription>
              </div>

              {canViewContracts ? (
                <Link href="/system/contracts/list">
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
                    {pricingFilters.map((item) => {
                      const isSelected = pricingFilter === item.value;

                      return (
                        <Button
                          key={item.value}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          className="h-10 rounded-xl"
                          onClick={() => setPricingFilter(item.value)}
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
                        <TableHead>{t.table.contract}</TableHead>
                        <TableHead>{t.table.provider}</TableHead>
                        <TableHead>{t.table.pricing}</TableHead>
                        <TableHead>{t.table.discount}</TableHead>
                        <TableHead>{t.table.commission}</TableHead>
                        <TableHead>{t.table.value}</TableHead>
                        <TableHead>{t.table.period}</TableHead>
                        <TableHead>{t.table.status}</TableHead>
                        {canViewContractDetails ? (
                          <TableHead>{t.table.action}</TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {isLoading ? (
                        <TableRowsSkeleton
                          columnsCount={canViewContractDetails ? 9 : 8}
                        />
                      ) : latestContracts.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={canViewContractDetails ? 9 : 8}
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
                        latestContracts.map((contract) => (
                          <TableRow
                            key={`${contract.id}-${contract.contractNumber}`}
                          >
                            <TableCell>
                              <div className="flex min-w-[220px] items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted">
                                  <FileText className="h-4 w-4" />
                                </div>

                                <div className="min-w-0">
                                  <p className="truncate font-medium">
                                    {contract.contractNumber || "-"}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {contract.title || "-"}
                                  </p>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="flex min-w-[180px] items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted">
                                  <Building2 className="h-4 w-4" />
                                </div>

                                <div className="min-w-0">
                                  <p className="truncate font-medium">
                                    {contract.providerName || "-"}
                                  </p>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              <Badge variant="secondary" className="rounded-full">
                                {pricingLabel(contract.pricingModel, locale)}
                              </Badge>
                            </TableCell>

                            <TableCell>
                              {formatPercent(contract.discountPercentage)}
                            </TableCell>

                            <TableCell>
                              {formatPercent(contract.systemCommissionPercentage)}
                            </TableCell>

                            <TableCell>
                              <SarAmount value={contract.contractValue} />
                            </TableCell>

                            <TableCell>
                              <div className="min-w-[150px] text-sm">
                                <p>{formatDate(contract.startDate)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(contract.endDate)}
                                </p>
                              </div>
                            </TableCell>

                            <TableCell>
                              {statusBadge(contract.status, locale)}
                            </TableCell>

                            {canViewContractDetails ? (
                              <TableCell>
                                {isValidContractId(contract.id) ? (
                                  <Link href={`/system/contracts/${contract.id}`}>
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
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <p>
                  {t.showing} {formatNumber(latestContracts.length)} {t.from}{" "}
                  {formatNumber(filteredContracts.length)} · {t.latestRecords}
                </p>

                {canViewContracts ? (
                  <Link href="/system/contracts/list">
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