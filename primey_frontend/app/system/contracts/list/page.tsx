"use client";

/* ============================================================
   📂 app/system/contracts/list/page.tsx
   🧠 Primey Care | Contracts List
   ------------------------------------------------------------
   ✅ المرحلة 17 + المرحلة 2
   ✅ مبني بنفس النمط المعتمد لقوائم النظام
   ✅ البحث في صف مستقل
   ✅ الفلاتر والأعمدة في صف مستقل تحت البحث
   ✅ فلتر التاريخ من / إلى على createdAt
   ✅ Excel export بصيغة .xls HTML Workbook
   ✅ Web PDF Print
   ✅ Error State مستقل
   ✅ Empty State ذكي
   ✅ Loading Skeleton
   ✅ حماية روابط التفاصيل والأزرار والطلبات
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
  ArrowDownUp,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarDays,
  ColumnsIcon,
  Copy,
  Download,
  Eye,
  FileText,
  Loader2,
  MoreHorizontal,
  Percent,
  PlusCircle,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  Wallet,
  XCircle,
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

type SortKey =
  | "contractNumber"
  | "title"
  | "providerName"
  | "pricingModel"
  | "discountPercentage"
  | "systemCommissionPercentage"
  | "contractValue"
  | "status"
  | "startDate"
  | "endDate"
  | "createdAt";

type SortDirection = "asc" | "desc";

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

type VisibleColumns = {
  contract: boolean;
  provider: boolean;
  pricing: boolean;
  discount: boolean;
  commission: boolean;
  value: boolean;
  period: boolean;
  status: boolean;
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

const SAR_ICON_PATH = "/currency/sar.svg";
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

  const containers = ["contract", "provider", "item", "data", "summary", "totals"];

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
  const provider = obj.provider as Record<string, unknown> | undefined;
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
    providerId: String(getObjectValue(obj, "provider_id") ?? provider?.id ?? ""),
    providerName: String(
      getObjectValue(obj, "provider_name") ?? provider?.name ?? "-",
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
      getObjectValue(obj, "end_date") ?? getObjectValue(obj, "valid_to") ?? "",
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
    title: isArabic ? "قائمة العقود" : "Contracts List",
    subtitle: isArabic
      ? "استعراض العقود مع البحث والفلاتر والأعمدة والفرز والتصدير والطباعة."
      : "Browse contracts with search, filters, columns, sorting, export, and print.",

    back: isArabic ? "لوحة العقود" : "Contracts Overview",
    createContract: isArabic ? "إنشاء عقد" : "Create Contract",
    refresh: isArabic ? "تحديث" : "Refresh",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",
    columns: isArabic ? "الأعمدة" : "Columns",

    tableTitle: isArabic ? "بيانات العقود" : "Contracts Data",
    tableSubtitle: isArabic
      ? "استعرض العقود، رتّب البيانات، وخصص الأعمدة حسب احتياجك."
      : "Browse contracts, sort data, and customize columns as needed.",

    searchPlaceholder: isArabic
      ? "ابحث برقم العقد أو العنوان أو مقدم الخدمة أو نموذج التسعير أو الحالة..."
      : "Search by contract number, title, provider, pricing model, or status...",

    all: isArabic ? "الكل" : "All",
    allStatuses: isArabic ? "كل الحالات" : "All Statuses",
    allPricing: isArabic ? "كل نماذج التسعير" : "All Pricing Models",
    fromDate: isArabic ? "من تاريخ" : "From Date",
    toDate: isArabic ? "إلى تاريخ" : "To Date",
    notSelected: isArabic ? "غير محدد" : "Not selected",

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

    totalContracts: isArabic ? "إجمالي العقود" : "Total Contracts",
    activeContracts: isArabic ? "العقود النشطة" : "Active Contracts",
    totalValue: isArabic ? "قيمة العقود" : "Contracts Value",
    avgCommission: isArabic ? "متوسط نسبة النظام" : "Avg. System Commission",

    selectedRows: isArabic ? "صفوف محددة" : "row(s) selected",
    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",
    page: isArabic ? "صفحة" : "Page",
    from: isArabic ? "من" : "of",

    emptyTitle: isArabic ? "لا توجد عقود بعد" : "No contracts yet",
    emptyText: isArabic
      ? "عند إنشاء عقود جديدة ستظهر بياناتها هنا مباشرة."
      : "New contracts will appear here once they are created.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير كلمات البحث أو فلاتر الحالة أو التسعير أو التاريخ."
      : "Try changing search keywords, status, pricing, or date filters.",

    actions: isArabic ? "الإجراءات" : "Actions",
    viewDetails: isArabic ? "عرض التفاصيل" : "View Details",
    copyContract: isArabic ? "نسخ رقم العقد" : "Copy Contract Number",
    copyId: isArabic ? "نسخ المعرف" : "Copy ID",
    copyProvider: isArabic ? "نسخ مقدم الخدمة" : "Copy Provider",
    copied: isArabic ? "تم النسخ بنجاح" : "Copied successfully",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الصفحة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض بيانات العقود. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view contracts data. Contact your system administrator if you need access.",

    loadError: isArabic
      ? "تعذر تحميل قائمة العقود."
      : "Unable to load contracts list.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    refreshSuccess: isArabic
      ? "تم تحديث قائمة العقود بنجاح."
      : "Contracts list refreshed successfully.",
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
    filterPricing: isArabic ? "فلتر التسعير" : "Pricing Filter",
    filterDateFrom: isArabic ? "تاريخ الإنشاء من" : "Created From",
    filterDateTo: isArabic ? "تاريخ الإنشاء إلى" : "Created To",

    table: {
      id: isArabic ? "المعرف" : "ID",
      contract: isArabic ? "العقد" : "Contract",
      title: isArabic ? "العنوان" : "Title",
      provider: isArabic ? "مقدم الخدمة" : "Provider",
      pricing: isArabic ? "التسعير" : "Pricing",
      discount: isArabic ? "الخصم" : "Discount",
      commission: isArabic ? "نسبة النظام" : "System Commission",
      value: isArabic ? "القيمة" : "Value",
      period: isArabic ? "المدة" : "Period",
      startDate: isArabic ? "تاريخ البداية" : "Start Date",
      endDate: isArabic ? "تاريخ النهاية" : "End Date",
      status: isArabic ? "الحالة" : "Status",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      updatedAt: isArabic ? "آخر تحديث" : "Updated At",
      actions: isArabic ? "الإجراء" : "Action",
    },

    printTitle: isArabic ? "قائمة العقود" : "Contracts List",
    printedAt: isArabic ? "تاريخ الطباعة" : "Printed At",
    rowsCount: isArabic ? "عدد السجلات" : "Rows Count",
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

function toDateOnly(value: string): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

function isDateInsideRange(value: string, dateFrom: string, dateTo: string) {
  if (!dateFrom && !dateTo) return true;

  const dateOnly = toDateOnly(value);

  if (!dateOnly) return false;

  if (dateFrom && dateOnly < dateFrom) return false;
  if (dateTo && dateOnly > dateTo) return false;

  return true;
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

function getColumnLabels(locale: AppLocale) {
  const t = dictionary(locale);

  return {
    contract: t.table.contract,
    provider: t.table.provider,
    pricing: t.table.pricing,
    discount: t.table.discount,
    commission: t.table.commission,
    value: t.table.value,
    period: t.table.period,
    status: t.table.status,
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
          <td>${escapeHtml(formatDate(contract.createdAt))}</td>
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
              <th>${escapeHtml(t.table.title)}</th>
              <th>${escapeHtml(t.table.provider)}</th>
              <th>${escapeHtml(t.table.pricing)}</th>
              <th>${escapeHtml(t.table.discount)}</th>
              <th>${escapeHtml(t.table.commission)}</th>
              <th>${escapeHtml(t.table.value)}</th>
              <th>${escapeHtml(t.table.status)}</th>
              <th>${escapeHtml(t.table.startDate)}</th>
              <th>${escapeHtml(t.table.endDate)}</th>
              <th>${escapeHtml(t.table.createdAt)}</th>
            </tr>
          </thead>
          <tbody>
            ${
              tableRows ||
              `<tr><td colspan="12" style="text-align:center">${escapeHtml(t.emptyTitle)}</td></tr>`
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
                  columnIndex === 1
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

export default function SystemContractsListPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pricingFilter, setPricingFilter] = useState<PricingFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [pageIndex, setPageIndex] = useState(0);

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    contract: true,
    provider: true,
    pricing: true,
    discount: true,
    commission: true,
    value: true,
    period: true,
    status: true,
    createdAt: true,
    actions: true,
  });

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

  const safeVisibleColumns = useMemo<VisibleColumns>(
    () => ({
      ...visibleColumns,
      actions: visibleColumns.actions && canViewContractDetails,
    }),
    [canViewContractDetails, visibleColumns],
  );

  const columnLabels = useMemo(() => getColumnLabels(locale), [locale]);

  const stats = useMemo(() => {
    const total = contracts.length;
    const active = contracts.filter((item) => item.status === "ACTIVE").length;
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
      totalValue,
      avgCommission,
    };
  }, [contracts]);

  const statusOptions = useMemo(
    () => [
      {
        value: "all" as StatusFilter,
        label: t.allStatuses,
        count: contracts.length,
      },
      {
        value: "ACTIVE" as StatusFilter,
        label: t.active,
        count: contracts.filter((item) => item.status === "ACTIVE").length,
      },
      {
        value: "DRAFT" as StatusFilter,
        label: t.draft,
        count: contracts.filter((item) => item.status === "DRAFT").length,
      },
      {
        value: "SUSPENDED" as StatusFilter,
        label: t.suspended,
        count: contracts.filter((item) => item.status === "SUSPENDED").length,
      },
      {
        value: "EXPIRED" as StatusFilter,
        label: t.expired,
        count: contracts.filter((item) => item.status === "EXPIRED").length,
      },
      {
        value: "TERMINATED" as StatusFilter,
        label: t.terminated,
        count: contracts.filter((item) => item.status === "TERMINATED").length,
      },
    ],
    [contracts, t],
  );

  const pricingOptions = useMemo(
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

  const filteredContracts = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return contracts.filter((contract) => {
      const matchesStatus =
        statusFilter === "all" ? true : contract.status === statusFilter;

      const matchesPricing =
        pricingFilter === "all"
          ? true
          : contract.pricingModel === pricingFilter;

      const matchesDate = isDateInsideRange(
        contract.createdAt,
        dateFrom,
        dateTo,
      );

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
            formatDate(contract.createdAt),
            toDateOnly(contract.createdAt),
          ]
            .join(" ")
            .toLowerCase()
            .includes(cleanQuery);

      return matchesStatus && matchesPricing && matchesDate && matchesQuery;
    });
  }, [contracts, dateFrom, dateTo, locale, pricingFilter, query, statusFilter]);

  const sortedContracts = useMemo(() => {
    const rows = [...filteredContracts];

    rows.sort((firstContract, secondContract) => {
      let first: string | number = "";
      let second: string | number = "";

      if (sortKey === "contractNumber") {
        first = firstContract.contractNumber.toLowerCase();
        second = secondContract.contractNumber.toLowerCase();
      }

      if (sortKey === "title") {
        first = firstContract.title.toLowerCase();
        second = secondContract.title.toLowerCase();
      }

      if (sortKey === "providerName") {
        first = firstContract.providerName.toLowerCase();
        second = secondContract.providerName.toLowerCase();
      }

      if (sortKey === "pricingModel") {
        first = firstContract.pricingModel.toLowerCase();
        second = secondContract.pricingModel.toLowerCase();
      }

      if (sortKey === "discountPercentage") {
        first = firstContract.discountPercentage;
        second = secondContract.discountPercentage;
      }

      if (sortKey === "systemCommissionPercentage") {
        first = firstContract.systemCommissionPercentage;
        second = secondContract.systemCommissionPercentage;
      }

      if (sortKey === "contractValue") {
        first = firstContract.contractValue;
        second = secondContract.contractValue;
      }

      if (sortKey === "status") {
        first = firstContract.status.toLowerCase();
        second = secondContract.status.toLowerCase();
      }

      if (sortKey === "startDate") {
        first = new Date(firstContract.startDate || 0).getTime();
        second = new Date(secondContract.startDate || 0).getTime();
      }

      if (sortKey === "endDate") {
        first = new Date(firstContract.endDate || 0).getTime();
        second = new Date(secondContract.endDate || 0).getTime();
      }

      if (sortKey === "createdAt") {
        first = new Date(
          firstContract.createdAt || firstContract.updatedAt || 0,
        ).getTime();
        second = new Date(
          secondContract.createdAt || secondContract.updatedAt || 0,
        ).getTime();
      }

      if (first < second) return sortDirection === "asc" ? -1 : 1;
      if (first > second) return sortDirection === "asc" ? 1 : -1;

      return 0;
    });

    return rows;
  }, [filteredContracts, sortDirection, sortKey]);

  const exportRows = useMemo(() => {
    if (selectedIds.length > 0) {
      return sortedContracts.filter((contract) =>
        selectedIds.includes(contract.id),
      );
    }

    return sortedContracts;
  }, [selectedIds, sortedContracts]);

  const pageCount = Math.max(1, Math.ceil(sortedContracts.length / PAGE_SIZE));

  const pageRows = useMemo(() => {
    const start = pageIndex * PAGE_SIZE;
    return sortedContracts.slice(start, start + PAGE_SIZE);
  }, [pageIndex, sortedContracts]);

  const selectedOnPage = pageRows.filter((row) =>
    selectedIds.includes(row.id),
  ).length;

  const allPageSelected =
    pageRows.length > 0 && selectedOnPage === pageRows.length;

  const hasSearchOrFilter =
    query.trim().length > 0 ||
    statusFilter !== "all" ||
    pricingFilter !== "all" ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

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
    setPricingFilter("all");
    setDateFrom("");
    setDateTo("");
  }

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

        const response = await fetch(apiUrl("/api/contracts/?page_size=200"), {
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
        console.error("Failed to load contracts list:", error);
        setContracts([]);
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [canViewContracts, t.loadError, t.refreshSuccess],
  );

  function exportExcel() {
    if (!canExportContracts) return;

    if (exportRows.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const generatedAt = new Date();

    const statusLabelText =
      statusOptions.find((item) => item.value === statusFilter)?.label || t.all;

    const pricingLabelText =
      pricingOptions.find((item) => item.value === pricingFilter)?.label ||
      t.all;

    downloadExcel({
      filename: `primey-care-contracts-list-${generatedAt
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "قائمة العقود" : "Contracts List",
      title: t.title,
      locale,
      summaryRows: [
        [t.generatedAt, generatedAt.toLocaleString("en-US")],
        [
          t.reportScope,
          selectedIds.length > 0 ? t.selectedScope : t.currentFilteredData,
        ],
        [
          t.table.contract,
          `${formatNumber(exportRows.length)} / ${formatNumber(
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
        [t.filterStatus, statusLabelText],
        [t.filterPricing, pricingLabelText],
        [t.filterDateFrom, dateFrom || t.notSelected],
        [t.filterDateTo, dateTo || t.notSelected],
      ],
      headers: [
        t.table.id,
        t.table.contract,
        t.table.title,
        t.table.provider,
        t.table.pricing,
        t.table.discount,
        t.table.commission,
        t.table.value,
        t.table.status,
        t.table.startDate,
        t.table.endDate,
        t.table.createdAt,
        t.table.updatedAt,
      ],
      rows: exportRows.map((contract) => [
        String(contract.id || "-"),
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
        formatDate(contract.updatedAt || contract.createdAt),
      ]),
    });

    toast.success(t.exportSuccess);
  }

  function printList() {
    if (!canPrintContracts) return;

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
    loadContracts(false);
  }, [authResolving, loadContracts]);

  useEffect(() => {
    setPageIndex(0);
    setSelectedIds([]);
  }, [query, statusFilter, pricingFilter, dateFrom, dateTo]);

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
          <Link href="/system/contracts">
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
              onClick={exportExcel}
              disabled={
                isLoading || exportRows.length === 0 || Boolean(errorMessage)
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
              onClick={printList}
              disabled={
                isLoading || exportRows.length === 0 || Boolean(errorMessage)
              }
            >
              <Printer className="h-4 w-4" />
              <span>{t.print}</span>
            </Button>
          ) : null}

          {canCreateContracts ? (
            <Link href="/system/contracts/create">
              <Button className="h-10 w-full rounded-xl sm:w-auto">
                <PlusCircle className="h-4 w-4" />
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
                  {t.loadErrorHint}
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
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {isLoading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <StatCardSkeleton key={index} />
                ))
              : [
                  {
                    title: t.totalContracts,
                    value: stats.total,
                    percent: stats.total > 0 ? 100 : 0,
                    icon: FileText,
                    isMoney: false,
                    isPercent: false,
                  },
                  {
                    title: t.activeContracts,
                    value: stats.active,
                    percent: percent(stats.active, stats.total),
                    icon: BadgeCheck,
                    isMoney: false,
                    isPercent: false,
                  },
                  {
                    title: t.totalValue,
                    value: stats.totalValue,
                    percent: stats.totalValue > 0 ? 100 : 0,
                    icon: Wallet,
                    isMoney: true,
                    isPercent: false,
                  },
                  {
                    title: t.avgCommission,
                    value: stats.avgCommission,
                    percent: Math.min(Math.round(stats.avgCommission), 100),
                    icon: Percent,
                    isMoney: false,
                    isPercent: true,
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
                      {pricingOptions.map((item) => (
                        <Button
                          key={item.value}
                          variant={
                            pricingFilter === item.value ? "default" : "outline"
                          }
                          className="h-10 rounded-xl"
                          onClick={() => setPricingFilter(item.value)}
                        >
                          <span>{item.label}</span>
                          <Badge
                            variant={
                              pricingFilter === item.value
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

                    <div className="grid max-w-xl gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <CalendarDays className="h-4 w-4 text-muted-foreground" />
                          <span>{t.fromDate}</span>
                        </label>
                        <Input
                          type="date"
                          value={dateFrom}
                          onChange={(event) => setDateFrom(event.target.value)}
                          className="h-10 rounded-xl"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <CalendarDays className="h-4 w-4 text-muted-foreground" />
                          <span>{t.toDate}</span>
                        </label>
                        <Input
                          type="date"
                          value={dateTo}
                          onChange={(event) => setDateTo(event.target.value)}
                          className="h-10 rounded-xl"
                        />
                      </div>
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
                          if (key === "actions" && !canViewContractDetails) {
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

                          {safeVisibleColumns.contract ? (
                            <SortableHead
                              label={t.table.contract}
                              onClick={() => toggleSort("contractNumber")}
                            />
                          ) : null}

                          {safeVisibleColumns.provider ? (
                            <SortableHead
                              label={t.table.provider}
                              onClick={() => toggleSort("providerName")}
                            />
                          ) : null}

                          {safeVisibleColumns.pricing ? (
                            <SortableHead
                              label={t.table.pricing}
                              onClick={() => toggleSort("pricingModel")}
                            />
                          ) : null}

                          {safeVisibleColumns.discount ? (
                            <SortableHead
                              label={t.table.discount}
                              onClick={() => toggleSort("discountPercentage")}
                            />
                          ) : null}

                          {safeVisibleColumns.commission ? (
                            <SortableHead
                              label={t.table.commission}
                              onClick={() =>
                                toggleSort("systemCommissionPercentage")
                              }
                            />
                          ) : null}

                          {safeVisibleColumns.value ? (
                            <SortableHead
                              label={t.table.value}
                              onClick={() => toggleSort("contractValue")}
                            />
                          ) : null}

                          {safeVisibleColumns.period ? (
                            <SortableHead
                              label={t.table.period}
                              onClick={() => toggleSort("startDate")}
                            />
                          ) : null}

                          {safeVisibleColumns.status ? (
                            <SortableHead
                              label={t.table.status}
                              onClick={() => toggleSort("status")}
                            />
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
                          pageRows.map((contract) => (
                            <TableRow
                              key={`${contract.id}-${contract.contractNumber}`}
                              data-state={
                                selectedIds.includes(contract.id)
                                  ? "selected"
                                  : undefined
                              }
                            >
                              <TableCell>
                                <Checkbox
                                  checked={selectedIds.includes(contract.id)}
                                  onCheckedChange={() => toggleRow(contract.id)}
                                  aria-label="Select row"
                                />
                              </TableCell>

                              {safeVisibleColumns.contract ? (
                                <TableCell>
                                  <div className="flex min-w-[240px] items-center gap-3">
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
                              ) : null}

                              {safeVisibleColumns.provider ? (
                                <TableCell>
                                  <div className="flex min-w-[190px] items-center gap-3">
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
                              ) : null}

                              {safeVisibleColumns.pricing ? (
                                <TableCell>
                                  <Badge
                                    variant="secondary"
                                    className="rounded-full"
                                  >
                                    {pricingLabel(contract.pricingModel, locale)}
                                  </Badge>
                                </TableCell>
                              ) : null}

                              {safeVisibleColumns.discount ? (
                                <TableCell>
                                  {formatPercent(contract.discountPercentage)}
                                </TableCell>
                              ) : null}

                              {safeVisibleColumns.commission ? (
                                <TableCell>
                                  {formatPercent(
                                    contract.systemCommissionPercentage,
                                  )}
                                </TableCell>
                              ) : null}

                              {safeVisibleColumns.value ? (
                                <TableCell>
                                  <SarAmount value={contract.contractValue} />
                                </TableCell>
                              ) : null}

                              {safeVisibleColumns.period ? (
                                <TableCell>
                                  <div className="min-w-[150px] text-sm">
                                    <p>{formatDate(contract.startDate)}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatDate(contract.endDate)}
                                    </p>
                                  </div>
                                </TableCell>
                              ) : null}

                              {safeVisibleColumns.status ? (
                                <TableCell>
                                  {statusBadge(contract.status, locale)}
                                </TableCell>
                              ) : null}

                              {safeVisibleColumns.createdAt ? (
                                <TableCell>
                                  {formatDate(contract.createdAt)}
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

                                      {isValidContractId(contract.id) ? (
                                        <DropdownMenuItem asChild>
                                          <Link
                                            href={`/system/contracts/${contract.id}`}
                                          >
                                            <Eye className="h-4 w-4" />
                                            {t.viewDetails}
                                          </Link>
                                        </DropdownMenuItem>
                                      ) : null}

                                      <DropdownMenuItem
                                        onClick={() =>
                                          copyToClipboard(
                                            String(
                                              contract.contractNumber || "-",
                                            ),
                                            t.copied,
                                          )
                                        }
                                      >
                                        <Copy className="h-4 w-4" />
                                        {t.copyContract}
                                      </DropdownMenuItem>

                                      <DropdownMenuItem
                                        onClick={() =>
                                          copyToClipboard(
                                            String(contract.id || "-"),
                                            t.copied,
                                          )
                                        }
                                      >
                                        <Copy className="h-4 w-4" />
                                        {t.copyId}
                                      </DropdownMenuItem>

                                      {contract.providerName ? (
                                        <DropdownMenuItem
                                          onClick={() =>
                                            copyToClipboard(
                                              contract.providerName,
                                              t.copied,
                                            )
                                          }
                                        >
                                          <Building2 className="h-4 w-4" />
                                          {t.copyProvider}
                                        </DropdownMenuItem>
                                      ) : null}
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
                    {formatNumber(sortedContracts.length)} {t.selectedRows}
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