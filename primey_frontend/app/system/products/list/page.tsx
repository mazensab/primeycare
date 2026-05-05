"use client";

/* ============================================================
   📂 app/system/products/list/page.tsx
   🧠 Primey Care | Products List
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
  Boxes,
  ColumnsIcon,
  CreditCard,
  Download,
  Eye,
  Layers3,
  Loader2,
  MoreHorizontal,
  Package,
  PlusCircle,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Tag,
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

type ProductStatus =
  | "draft"
  | "active"
  | "inactive"
  | "archived"
  | "UNKNOWN";

type ProductType =
  | "membership"
  | "card"
  | "program"
  | "service"
  | "other"
  | "UNKNOWN";

type BillingType = "one_time" | "recurring" | "UNKNOWN";

type FulfillmentType =
  | "digital"
  | "physical"
  | "both"
  | "service_based"
  | "none"
  | "UNKNOWN";

type StatusFilter = "all" | ProductStatus;
type TypeFilter = "all" | ProductType;
type BillingFilter = "all" | BillingType;

type SortKey =
  | "name"
  | "code"
  | "productType"
  | "categoryName"
  | "status"
  | "price"
  | "updatedAt";

type SortDirection = "asc" | "desc";

type ProductCategory = {
  id?: number | string | null;
  code?: string | null;
  name?: string | null;
  category_type?: string | null;
  status?: string | null;
};

type Product = {
  id: number | string;
  code: string;
  name: string;
  slug: string;
  productType: ProductType;
  categoryName: string;
  status: ProductStatus;
  billingType: BillingType;
  fulfillmentType: FulfillmentType;
  shortDescription: string;
  description: string;
  tags: string;
  price: number;
  salePrice: number;
  effectivePrice: number;
  taxAmount: number;
  totalPriceWithTax: number;
  hasDiscount: boolean;
  isTaxable: boolean;
  taxRate: number;
  durationValue: number;
  durationUnit: string;
  isPublic: boolean;
  isFeatured: boolean;
  requiresApproval: boolean;
  allowOnlinePurchase: boolean;
  allowAgentSale: boolean;
  allowProviderSale: boolean;
  canBeOrdered: boolean;
  canBeUsedInContracts: boolean;
  requiresProvider: boolean;
  maxDiscountRate: number;
  defaultAgentCommissionRate: number;
  serviceItemsCount: number;
  createdAt: string;
  updatedAt: string;
  raw: Record<string, unknown>;
};

type ProductsApiResponse = {
  ok?: boolean;
  message?: string;
  count?: number;
  results?: unknown[];
  products?: unknown[];
  items?: unknown[];
  data?:
    | unknown[]
    | {
        results?: unknown[];
        products?: unknown[];
        items?: unknown[];
      };
};

type VisibleColumns = {
  product: boolean;
  code: boolean;
  type: boolean;
  category: boolean;
  price: boolean;
  billing: boolean;
  readiness: boolean;
  channels: boolean;
  status: boolean;
  updated: boolean;
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

  const clean = String(value ?? "")
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(clean);

  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStatus(status: unknown): ProductStatus {
  const value = String(status || "").toLowerCase();

  if (value === "draft") return "draft";
  if (value === "active") return "active";
  if (value === "inactive") return "inactive";
  if (value === "archived") return "archived";

  if (status === true) return "active";
  if (status === false) return "inactive";

  return "UNKNOWN";
}

function normalizeType(type: unknown): ProductType {
  const value = String(type || "").toLowerCase();

  if (value === "membership") return "membership";
  if (value === "card") return "card";
  if (value === "program") return "program";
  if (value === "service") return "service";
  if (value === "other") return "other";

  return "UNKNOWN";
}

function normalizeBillingType(type: unknown): BillingType {
  const value = String(type || "").toLowerCase();

  if (value === "one_time") return "one_time";
  if (value === "recurring") return "recurring";

  return "UNKNOWN";
}

function normalizeFulfillmentType(type: unknown): FulfillmentType {
  const value = String(type || "").toLowerCase();

  if (value === "digital") return "digital";
  if (value === "physical") return "physical";
  if (value === "both") return "both";
  if (value === "service_based") return "service_based";
  if (value === "none") return "none";

  return "UNKNOWN";
}

function extractProducts(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== "object") return [];

  const response = payload as ProductsApiResponse;

  if (Array.isArray(response.results)) return response.results;
  if (Array.isArray(response.products)) return response.products;
  if (Array.isArray(response.items)) return response.items;
  if (Array.isArray(response.data)) return response.data;

  if (response.data && typeof response.data === "object") {
    if (Array.isArray(response.data.results)) return response.data.results;
    if (Array.isArray(response.data.products)) return response.data.products;
    if (Array.isArray(response.data.items)) return response.data.items;
  }

  return [];
}

function getObjectValue(obj: Record<string, unknown>, key: string): unknown {
  const direct = obj[key];

  if (direct !== undefined && direct !== null && direct !== "") {
    return direct;
  }

  const containers = ["product", "pricing", "stats", "summary"];

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

function normalizeProduct(item: unknown): Product {
  const obj = (item || {}) as Record<string, unknown>;
  const category = obj.category as ProductCategory | null | undefined;

  const id = getObjectValue(obj, "id") ?? "";

  const name =
    getObjectValue(obj, "name") ??
    getObjectValue(obj, "title") ??
    getObjectValue(obj, "product_name") ??
    "-";

  const code =
    getObjectValue(obj, "code") ??
    getObjectValue(obj, "product_code") ??
    (id ? `PRD-${id}` : "-");

  const price = toNumber(
    getObjectValue(obj, "price") ??
      getObjectValue(obj, "base_price") ??
      getObjectValue(obj, "amount") ??
      0,
  );

  const salePrice = toNumber(getObjectValue(obj, "sale_price"));

  const effectivePrice = toNumber(
    getObjectValue(obj, "effective_price") || salePrice || price,
  );

  return {
    id: id as number | string,
    code: String(code || "-"),
    name: String(name || "-"),
    slug: String(getObjectValue(obj, "slug") ?? ""),
    productType: normalizeType(
      getObjectValue(obj, "product_type") ?? getObjectValue(obj, "type"),
    ),
    categoryName: String(
      category?.name ||
        getObjectValue(obj, "category_name") ||
        getObjectValue(obj, "category") ||
        "",
    ),
    status: normalizeStatus(getObjectValue(obj, "status")),
    billingType: normalizeBillingType(getObjectValue(obj, "billing_type")),
    fulfillmentType: normalizeFulfillmentType(
      getObjectValue(obj, "fulfillment_type"),
    ),
    shortDescription: String(getObjectValue(obj, "short_description") ?? ""),
    description: String(getObjectValue(obj, "description") ?? ""),
    tags: String(getObjectValue(obj, "tags") ?? ""),
    price,
    salePrice,
    effectivePrice,
    taxAmount: toNumber(getObjectValue(obj, "tax_amount")),
    totalPriceWithTax: toNumber(
      getObjectValue(obj, "total_price_with_tax") || effectivePrice,
    ),
    hasDiscount: Boolean(getObjectValue(obj, "has_discount") ?? salePrice > 0),
    isTaxable: Boolean(getObjectValue(obj, "is_taxable")),
    taxRate: toNumber(getObjectValue(obj, "tax_rate")),
    durationValue: toNumber(getObjectValue(obj, "duration_value")),
    durationUnit: String(getObjectValue(obj, "duration_unit") ?? ""),
    isPublic: Boolean(getObjectValue(obj, "is_public")),
    isFeatured: Boolean(getObjectValue(obj, "is_featured")),
    requiresApproval: Boolean(getObjectValue(obj, "requires_approval")),
    allowOnlinePurchase: Boolean(getObjectValue(obj, "allow_online_purchase")),
    allowAgentSale: Boolean(getObjectValue(obj, "allow_agent_sale")),
    allowProviderSale: Boolean(getObjectValue(obj, "allow_provider_sale")),
    canBeOrdered: Boolean(getObjectValue(obj, "can_be_ordered")),
    canBeUsedInContracts: Boolean(
      getObjectValue(obj, "can_be_used_in_contracts"),
    ),
    requiresProvider: Boolean(getObjectValue(obj, "requires_provider")),
    maxDiscountRate: toNumber(getObjectValue(obj, "max_discount_rate")),
    defaultAgentCommissionRate: toNumber(
      getObjectValue(obj, "default_agent_commission_rate"),
    ),
    serviceItemsCount: Array.isArray(obj.service_items)
      ? obj.service_items.length
      : toNumber(getObjectValue(obj, "service_items_count")),
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
    title: isArabic ? "قائمة المنتجات" : "Products List",
    subtitle: isArabic
      ? "إدارة المنتجات والبطاقات والبرامج والخدمات مع البحث والفلاتر والأعمدة والفرز والتصدير."
      : "Manage products, cards, programs, and services with search, filters, columns, sorting, and export.",

    back: isArabic ? "لوحة المنتجات" : "Products Overview",
    createProduct: isArabic ? "إنشاء منتج" : "Create Product",
    refresh: isArabic ? "تحديث" : "Refresh",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",
    columns: isArabic ? "الأعمدة" : "Columns",

    tableTitle: isArabic ? "بيانات المنتجات" : "Products Data",
    tableSubtitle: isArabic
      ? "استعرض المنتجات، رتّب البيانات، وخصص الأعمدة حسب احتياجك."
      : "Browse products, sort data, and customize columns as needed.",

    searchPlaceholder: isArabic
      ? "ابحث باسم المنتج أو الكود أو التصنيف أو الوسوم..."
      : "Search by product name, code, category, or tags...",

    all: isArabic ? "الكل" : "All",
    allStatuses: isArabic ? "كل الحالات" : "All Statuses",
    allTypes: isArabic ? "كل الأنواع" : "All Types",
    allBilling: isArabic ? "كل طرق الفوترة" : "All Billing",

    totalProducts: isArabic ? "إجمالي المنتجات" : "Total Products",
    activeProducts: isArabic ? "المنتجات النشطة" : "Active Products",
    orderReadyProducts: isArabic ? "جاهزة للطلبات" : "Order Ready",
    contractReadyProducts: isArabic ? "جاهزة للعقود" : "Contract Ready",

    active: isArabic ? "نشط" : "Active",
    draft: isArabic ? "مسودة" : "Draft",
    inactive: isArabic ? "غير نشط" : "Inactive",
    archived: isArabic ? "مؤرشف" : "Archived",
    unknown: isArabic ? "غير محدد" : "Unknown",

    membership: isArabic ? "عضوية" : "Membership",
    card: isArabic ? "بطاقة" : "Card",
    program: isArabic ? "برنامج" : "Program",
    service: isArabic ? "خدمة" : "Service",
    other: isArabic ? "أخرى" : "Other",

    oneTime: isArabic ? "مرة واحدة" : "One Time",
    recurring: isArabic ? "متكرر" : "Recurring",

    digital: isArabic ? "رقمي" : "Digital",
    physical: isArabic ? "فعلي" : "Physical",
    both: isArabic ? "رقمي وفعلي" : "Digital & Physical",
    serviceBased: isArabic ? "خدمة" : "Service Based",
    none: isArabic ? "بدون" : "None",

    public: isArabic ? "عام" : "Public",
    private: isArabic ? "خاص" : "Private",
    featured: isArabic ? "مميز" : "Featured",
    online: isArabic ? "شراء إلكتروني" : "Online",
    agentSale: isArabic ? "بيع مندوب" : "Agent Sale",
    providerSale: isArabic ? "بيع مقدم" : "Provider Sale",
    orderReady: isArabic ? "جاهز للطلبات" : "Order Ready",
    contractReady: isArabic ? "جاهز للعقود" : "Contract Ready",
    requiresProvider: isArabic ? "يتطلب مقدم" : "Requires Provider",
    noCategory: isArabic ? "بدون تصنيف" : "No Category",

    selectedRows: isArabic ? "صفوف محددة" : "row(s) selected",
    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",
    page: isArabic ? "صفحة" : "Page",
    from: isArabic ? "من" : "of",

    emptyTitle: isArabic ? "لا توجد منتجات بعد" : "No products yet",
    emptyText: isArabic
      ? "عند إضافة منتجات أو برامج جديدة ستظهر بياناتها هنا مباشرة."
      : "New products or programs will appear here once they are added.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير كلمات البحث أو فلاتر الحالة والنوع والفوترة."
      : "Try changing search keywords, status filters, type filters, or billing filters.",

    actions: isArabic ? "الإجراءات" : "Actions",
    viewDetails: isArabic ? "عرض التفاصيل" : "View Details",
    copyCode: isArabic ? "نسخ كود المنتج" : "Copy Product Code",
    copyId: isArabic ? "نسخ المعرف" : "Copy ID",
    copied: isArabic ? "تم النسخ بنجاح" : "Copied successfully",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الصفحة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض بيانات المنتجات. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view products data. Contact your system administrator if you need access.",

    loadError: isArabic
      ? "تعذر تحميل قائمة المنتجات."
      : "Unable to load products list.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    refreshSuccess: isArabic
      ? "تم تحديث قائمة المنتجات بنجاح."
      : "Products list refreshed successfully.",
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
    filterType: isArabic ? "فلتر النوع" : "Type Filter",
    filterBilling: isArabic ? "فلتر الفوترة" : "Billing Filter",

    table: {
      id: isArabic ? "المعرف" : "ID",
      product: isArabic ? "المنتج" : "Product",
      code: isArabic ? "الكود" : "Code",
      type: isArabic ? "النوع" : "Type",
      category: isArabic ? "التصنيف" : "Category",
      price: isArabic ? "السعر" : "Price",
      salePrice: isArabic ? "سعر الخصم" : "Sale Price",
      totalWithTax: isArabic ? "الإجمالي مع الضريبة" : "Total With Tax",
      billing: isArabic ? "الفوترة" : "Billing",
      fulfillment: isArabic ? "التسليم" : "Fulfillment",
      readiness: isArabic ? "الجاهزية" : "Readiness",
      channels: isArabic ? "قنوات البيع" : "Channels",
      status: isArabic ? "الحالة" : "Status",
      updated: isArabic ? "آخر تحديث" : "Updated",
      actions: isArabic ? "الإجراء" : "Action",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
    },

    printTitle: isArabic ? "قائمة المنتجات" : "Products List",
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

function statusLabel(status: ProductStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<ProductStatus, string> = {
    active: t.active,
    draft: t.draft,
    inactive: t.inactive,
    archived: t.archived,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function typeLabel(type: ProductType, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<ProductType, string> = {
    membership: t.membership,
    card: t.card,
    program: t.program,
    service: t.service,
    other: t.other,
    UNKNOWN: t.unknown,
  };

  return labels[type];
}

function billingLabel(type: BillingType, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<BillingType, string> = {
    one_time: t.oneTime,
    recurring: t.recurring,
    UNKNOWN: t.unknown,
  };

  return labels[type];
}

function fulfillmentLabel(type: FulfillmentType, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<FulfillmentType, string> = {
    digital: t.digital,
    physical: t.physical,
    both: t.both,
    service_based: t.serviceBased,
    none: t.none,
    UNKNOWN: t.unknown,
  };

  return labels[type];
}

function statusBadge(status: ProductStatus, locale: AppLocale) {
  const label = statusLabel(status, locale);

  if (status === "active") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (status === "draft") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
        {label}
      </Badge>
    );
  }

  if (status === "archived") {
    return (
      <Badge className="rounded-full border-orange-200 bg-orange-50 px-3 py-1 text-orange-700 hover:bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300">
        {label}
      </Badge>
    );
  }

  if (status === "inactive") {
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

function productIcon(type: ProductType): LucideIcon {
  if (type === "card") return CreditCard;
  if (type === "membership") return BadgeCheck;
  if (type === "program") return Boxes;
  if (type === "service") return Stethoscope;

  return Package;
}

function isValidProductId(id: Product["id"]) {
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

function getColumnLabels(locale: AppLocale) {
  const t = dictionary(locale);

  return {
    product: t.table.product,
    code: t.table.code,
    type: t.table.type,
    category: t.table.category,
    price: t.table.price,
    billing: t.table.billing,
    readiness: t.table.readiness,
    channels: t.table.channels,
    status: t.table.status,
    updated: t.table.updated,
    actions: t.actions,
  } satisfies Record<keyof VisibleColumns, string>;
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
  rows: Product[];
  t: ReturnType<typeof dictionary>;
}) {
  const isArabic = locale === "ar";
  const now = new Date().toLocaleString("en-US");

  const tableRows = rows
    .map(
      (product, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(product.code || "-")}</td>
          <td>${escapeHtml(product.name || "-")}</td>
          <td>${escapeHtml(typeLabel(product.productType, locale))}</td>
          <td>${escapeHtml(product.categoryName || t.noCategory)}</td>
          <td>${escapeHtml(formatMoney(product.effectivePrice))}</td>
          <td>${escapeHtml(billingLabel(product.billingType, locale))}</td>
          <td>${escapeHtml(product.canBeOrdered ? t.orderReady : "-")}</td>
          <td>${escapeHtml(product.canBeUsedInContracts ? t.contractReady : "-")}</td>
          <td>${escapeHtml(statusLabel(product.status, locale))}</td>
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
              <th>${escapeHtml(t.table.code)}</th>
              <th>${escapeHtml(t.table.product)}</th>
              <th>${escapeHtml(t.table.type)}</th>
              <th>${escapeHtml(t.table.category)}</th>
              <th>${escapeHtml(t.table.price)}</th>
              <th>${escapeHtml(t.table.billing)}</th>
              <th>${escapeHtml(t.orderReady)}</th>
              <th>${escapeHtml(t.contractReady)}</th>
              <th>${escapeHtml(t.table.status)}</th>
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
                  columnIndex === 1
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
   Page
============================================================ */

export default function SystemProductsListPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [billingFilter, setBillingFilter] = useState<BillingFilter>("all");

  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [pageIndex, setPageIndex] = useState(0);

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    product: true,
    code: true,
    type: true,
    category: true,
    price: true,
    billing: true,
    readiness: true,
    channels: true,
    status: true,
    updated: true,
    actions: true,
  });

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const authResolving = isAuthResolving(auth);

  const canViewProducts = hasSafePermission(
    auth,
    ["products.view", "products.list"],
    "view",
  );

  const canCreateProducts = hasSafePermission(
    auth,
    ["products.create"],
    "action",
  );

  const canExportProducts = hasSafePermission(
    auth,
    ["products.export", "reports.export"],
    "action",
  );

  const canPrintProducts = hasSafePermission(
    auth,
    ["products.print", "reports.print"],
    "action",
  );

  const canViewProductDetails = hasSafePermission(
    auth,
    ["products.view", "products.detail"],
    "view",
  );

  const safeVisibleColumns = useMemo<VisibleColumns>(
    () => ({
      ...visibleColumns,
      actions: visibleColumns.actions && canViewProductDetails,
    }),
    [canViewProductDetails, visibleColumns],
  );

  const columnLabels = useMemo(() => getColumnLabels(locale), [locale]);

  const stats = useMemo(() => {
    const total = products.length;
    const active = products.filter((item) => item.status === "active").length;
    const orderReady = products.filter((item) => item.canBeOrdered).length;
    const contractReady = products.filter(
      (item) => item.canBeUsedInContracts,
    ).length;

    return {
      total,
      active,
      orderReady,
      contractReady,
    };
  }, [products]);

  const statusOptions = useMemo(
    () => [
      { value: "all" as StatusFilter, label: t.allStatuses, count: products.length },
      {
        value: "active" as StatusFilter,
        label: t.active,
        count: products.filter((item) => item.status === "active").length,
      },
      {
        value: "draft" as StatusFilter,
        label: t.draft,
        count: products.filter((item) => item.status === "draft").length,
      },
      {
        value: "inactive" as StatusFilter,
        label: t.inactive,
        count: products.filter((item) => item.status === "inactive").length,
      },
      {
        value: "archived" as StatusFilter,
        label: t.archived,
        count: products.filter((item) => item.status === "archived").length,
      },
    ],
    [products, t],
  );

  const typeOptions = useMemo(
    () => [
      { value: "all" as TypeFilter, label: t.allTypes, count: products.length },
      {
        value: "membership" as TypeFilter,
        label: t.membership,
        count: products.filter((item) => item.productType === "membership").length,
      },
      {
        value: "card" as TypeFilter,
        label: t.card,
        count: products.filter((item) => item.productType === "card").length,
      },
      {
        value: "program" as TypeFilter,
        label: t.program,
        count: products.filter((item) => item.productType === "program").length,
      },
      {
        value: "service" as TypeFilter,
        label: t.service,
        count: products.filter((item) => item.productType === "service").length,
      },
    ],
    [products, t],
  );

  const billingOptions = useMemo(
    () => [
      { value: "all" as BillingFilter, label: t.allBilling },
      { value: "one_time" as BillingFilter, label: t.oneTime },
      { value: "recurring" as BillingFilter, label: t.recurring },
    ],
    [t],
  );

  const filteredProducts = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return products.filter((product) => {
      const matchesStatus =
        statusFilter === "all" ? true : product.status === statusFilter;

      const matchesType =
        typeFilter === "all" ? true : product.productType === typeFilter;

      const matchesBilling =
        billingFilter === "all" ? true : product.billingType === billingFilter;

      const matchesQuery = !cleanQuery
        ? true
        : [
            product.name,
            product.code,
            product.slug,
            product.categoryName,
            product.shortDescription,
            product.description,
            product.tags,
            product.status,
            product.productType,
            product.billingType,
            product.fulfillmentType,
            typeLabel(product.productType, locale),
            statusLabel(product.status, locale),
            billingLabel(product.billingType, locale),
            fulfillmentLabel(product.fulfillmentType, locale),
          ]
            .join(" ")
            .toLowerCase()
            .includes(cleanQuery);

      return matchesStatus && matchesType && matchesBilling && matchesQuery;
    });
  }, [billingFilter, locale, products, query, statusFilter, typeFilter]);

  const sortedProducts = useMemo(() => {
    const rows = [...filteredProducts];

    rows.sort((firstProduct, secondProduct) => {
      let first: string | number = "";
      let second: string | number = "";

      if (sortKey === "name") {
        first = firstProduct.name.toLowerCase();
        second = secondProduct.name.toLowerCase();
      }

      if (sortKey === "code") {
        first = firstProduct.code.toLowerCase();
        second = secondProduct.code.toLowerCase();
      }

      if (sortKey === "productType") {
        first = firstProduct.productType.toLowerCase();
        second = secondProduct.productType.toLowerCase();
      }

      if (sortKey === "categoryName") {
        first = firstProduct.categoryName.toLowerCase();
        second = secondProduct.categoryName.toLowerCase();
      }

      if (sortKey === "status") {
        first = firstProduct.status.toLowerCase();
        second = secondProduct.status.toLowerCase();
      }

      if (sortKey === "price") {
        first = firstProduct.effectivePrice;
        second = secondProduct.effectivePrice;
      }

      if (sortKey === "updatedAt") {
        first = new Date(
          firstProduct.updatedAt || firstProduct.createdAt || 0,
        ).getTime();
        second = new Date(
          secondProduct.updatedAt || secondProduct.createdAt || 0,
        ).getTime();
      }

      if (first < second) return sortDirection === "asc" ? -1 : 1;
      if (first > second) return sortDirection === "asc" ? 1 : -1;

      return 0;
    });

    return rows;
  }, [filteredProducts, sortDirection, sortKey]);

  const exportRows = useMemo(() => {
    if (selectedIds.length > 0) {
      return sortedProducts.filter((product) => selectedIds.includes(product.id));
    }

    return sortedProducts;
  }, [selectedIds, sortedProducts]);

  const pageCount = Math.max(1, Math.ceil(sortedProducts.length / PAGE_SIZE));

  const pageRows = useMemo(() => {
    const start = pageIndex * PAGE_SIZE;
    return sortedProducts.slice(start, start + PAGE_SIZE);
  }, [pageIndex, sortedProducts]);

  const selectedOnPage = pageRows.filter((row) =>
    selectedIds.includes(row.id),
  ).length;

  const allPageSelected =
    pageRows.length > 0 && selectedOnPage === pageRows.length;

  const hasSearchOrFilter =
    query.trim().length > 0 ||
    statusFilter !== "all" ||
    typeFilter !== "all" ||
    billingFilter !== "all";

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
    setBillingFilter("all");
  }

  const loadProducts = useCallback(
    async (showToast = false) => {
      if (!canViewProducts) {
        setIsLoading(false);
        setProducts([]);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");

        const response = await fetch(
          apiUrl("/api/products/?page_size=200&include_children=true"),
          {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          },
        );

        const payload = (await response.json().catch(() => null)) as
          | ProductsApiResponse
          | null;

        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.message || `HTTP ${response.status}`);
        }

        setProducts(extractProducts(payload).map(normalizeProduct));

        if (showToast) {
          toast.success(t.refreshSuccess);
        }
      } catch (error) {
        console.error("Failed to load products list:", error);
        setProducts([]);
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [canViewProducts, t.loadError, t.refreshSuccess],
  );

  function exportExcel() {
    if (!canExportProducts) return;

    if (exportRows.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const generatedAt = new Date();

    const statusLabelText =
      statusOptions.find((item) => item.value === statusFilter)?.label || t.all;

    const typeLabelText =
      typeOptions.find((item) => item.value === typeFilter)?.label || t.all;

    const billingLabelText =
      billingOptions.find((item) => item.value === billingFilter)?.label ||
      t.all;

    downloadExcel({
      filename: `primey-care-products-list-${generatedAt
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "قائمة المنتجات" : "Products List",
      title: t.title,
      locale,
      summaryRows: [
        [t.generatedAt, generatedAt.toLocaleString("en-US")],
        [
          t.reportScope,
          selectedIds.length > 0 ? t.selectedScope : t.currentFilteredData,
        ],
        [
          t.table.product,
          `${formatNumber(exportRows.length)} / ${formatNumber(products.length)}`,
        ],
        [t.totalProducts, stats.total],
        [t.activeProducts, stats.active],
        [t.orderReadyProducts, stats.orderReady],
        [t.contractReadyProducts, stats.contractReady],
      ],
      filterRows: [
        [t.filterSearch, query || t.all],
        [t.filterStatus, statusLabelText],
        [t.filterType, typeLabelText],
        [t.filterBilling, billingLabelText],
      ],
      headers: [
        t.table.id,
        t.table.code,
        t.table.product,
        t.table.type,
        t.table.category,
        t.table.price,
        t.table.salePrice,
        t.table.totalWithTax,
        t.table.billing,
        t.table.fulfillment,
        t.table.readiness,
        t.table.channels,
        t.table.status,
        t.table.createdAt,
        t.table.updated,
      ],
      rows: exportRows.map((product) => [
        String(product.id || "-"),
        product.code || "-",
        product.name || "-",
        typeLabel(product.productType, locale),
        product.categoryName || t.noCategory,
        formatMoney(product.effectivePrice),
        formatMoney(product.salePrice),
        formatMoney(product.totalPriceWithTax),
        billingLabel(product.billingType, locale),
        fulfillmentLabel(product.fulfillmentType, locale),
        [
          product.canBeOrdered ? t.orderReady : "",
          product.canBeUsedInContracts ? t.contractReady : "",
          product.requiresProvider ? t.requiresProvider : "",
        ]
          .filter(Boolean)
          .join(" / ") || "-",
        [
          product.isPublic ? t.public : t.private,
          product.isFeatured ? t.featured : "",
          product.allowOnlinePurchase ? t.online : "",
          product.allowAgentSale ? t.agentSale : "",
          product.allowProviderSale ? t.providerSale : "",
        ]
          .filter(Boolean)
          .join(" / ") || "-",
        statusLabel(product.status, locale),
        formatDate(product.createdAt),
        formatDate(product.updatedAt || product.createdAt),
      ]),
    });

    toast.success(t.exportSuccess);
  }

  function printList() {
    if (!canPrintProducts) return;

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
    loadProducts(false);
  }, [authResolving, loadProducts]);

  useEffect(() => {
    setPageIndex(0);
    setSelectedIds([]);
  }, [query, statusFilter, typeFilter, billingFilter]);

  if (!authResolving && !canViewProducts) {
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
          <Link href="/system/products">
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
            onClick={() => loadProducts(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refresh}</span>
          </Button>

          {canExportProducts ? (
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

          {canPrintProducts ? (
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

          {canCreateProducts ? (
            <Link href="/system/products/create">
              <Button className="h-10 w-full rounded-xl sm:w-auto">
                <PlusCircle className="h-4 w-4" />
                <span>{t.createProduct}</span>
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
                <p className="font-semibold text-destructive">{errorMessage}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.loadErrorHint}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => loadProducts(true)}
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
                    title: t.totalProducts,
                    value: stats.total,
                    percent: stats.total > 0 ? 100 : 0,
                    icon: Package,
                  },
                  {
                    title: t.activeProducts,
                    value: stats.active,
                    percent: stats.total
                      ? Math.round((stats.active / stats.total) * 100)
                      : 0,
                    icon: BadgeCheck,
                  },
                  {
                    title: t.orderReadyProducts,
                    value: stats.orderReady,
                    percent: stats.total
                      ? Math.round((stats.orderReady / stats.total) * 100)
                      : 0,
                    icon: ShieldCheck,
                  },
                  {
                    title: t.contractReadyProducts,
                    value: stats.contractReady,
                    percent: stats.total
                      ? Math.round((stats.contractReady / stats.total) * 100)
                      : 0,
                    icon: Layers3,
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
                              statusFilter === item.value ? "secondary" : "outline"
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
                          variant={typeFilter === item.value ? "default" : "outline"}
                          className="h-10 rounded-xl"
                          onClick={() => setTypeFilter(item.value)}
                        >
                          <span>{item.label}</span>
                          <Badge
                            variant={
                              typeFilter === item.value ? "secondary" : "outline"
                            }
                            className="ms-1 rounded-full"
                          >
                            {formatNumber(item.count)}
                          </Badge>
                        </Button>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {billingOptions.map((item) => (
                        <Button
                          key={item.value}
                          variant={
                            billingFilter === item.value ? "default" : "outline"
                          }
                          className="h-10 rounded-xl"
                          onClick={() => setBillingFilter(item.value)}
                        >
                          {item.label}
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
                          if (key === "actions" && !canViewProductDetails) {
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

                          {safeVisibleColumns.product ? (
                            <SortableHead
                              label={t.table.product}
                              onClick={() => toggleSort("name")}
                            />
                          ) : null}

                          {safeVisibleColumns.code ? (
                            <SortableHead
                              label={t.table.code}
                              onClick={() => toggleSort("code")}
                            />
                          ) : null}

                          {safeVisibleColumns.type ? (
                            <SortableHead
                              label={t.table.type}
                              onClick={() => toggleSort("productType")}
                            />
                          ) : null}

                          {safeVisibleColumns.category ? (
                            <SortableHead
                              label={t.table.category}
                              onClick={() => toggleSort("categoryName")}
                            />
                          ) : null}

                          {safeVisibleColumns.price ? (
                            <SortableHead
                              label={t.table.price}
                              onClick={() => toggleSort("price")}
                            />
                          ) : null}

                          {safeVisibleColumns.billing ? (
                            <TableHead>{t.table.billing}</TableHead>
                          ) : null}

                          {safeVisibleColumns.readiness ? (
                            <TableHead>{t.table.readiness}</TableHead>
                          ) : null}

                          {safeVisibleColumns.channels ? (
                            <TableHead>{t.table.channels}</TableHead>
                          ) : null}

                          {safeVisibleColumns.status ? (
                            <SortableHead
                              label={t.table.status}
                              onClick={() => toggleSort("status")}
                            />
                          ) : null}

                          {safeVisibleColumns.updated ? (
                            <SortableHead
                              label={t.table.updated}
                              onClick={() => toggleSort("updatedAt")}
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
                          pageRows.map((product) => {
                            const Icon = productIcon(product.productType);

                            return (
                              <TableRow
                                key={`${product.id}-${product.code}`}
                                data-state={
                                  selectedIds.includes(product.id)
                                    ? "selected"
                                    : undefined
                                }
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={selectedIds.includes(product.id)}
                                    onCheckedChange={() => toggleRow(product.id)}
                                    aria-label="Select row"
                                  />
                                </TableCell>

                                {safeVisibleColumns.product ? (
                                  <TableCell>
                                    <div className="flex min-w-[260px] items-center gap-4">
                                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-muted">
                                        <Icon className="h-5 w-5" />
                                      </div>

                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="truncate font-medium">
                                            {product.name}
                                          </span>

                                          {product.isFeatured ? (
                                            <Sparkles className="size-4 fill-orange-400 text-orange-400" />
                                          ) : null}
                                        </div>

                                        <div className="mt-1 truncate text-xs text-muted-foreground">
                                          {product.shortDescription ||
                                            product.slug ||
                                            product.code}
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>
                                ) : null}

                                {safeVisibleColumns.code ? (
                                  <TableCell className="font-medium">
                                    {product.code || `#${product.id}`}
                                  </TableCell>
                                ) : null}

                                {safeVisibleColumns.type ? (
                                  <TableCell>
                                    <div className="space-y-1">
                                      <Badge
                                        variant="secondary"
                                        className="rounded-full"
                                      >
                                        {typeLabel(product.productType, locale)}
                                      </Badge>
                                      <p className="text-xs text-muted-foreground">
                                        {fulfillmentLabel(
                                          product.fulfillmentType,
                                          locale,
                                        )}
                                      </p>
                                    </div>
                                  </TableCell>
                                ) : null}

                                {safeVisibleColumns.category ? (
                                  <TableCell>
                                    <div className="flex min-w-[120px] items-center gap-2">
                                      <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                                      <span>
                                        {product.categoryName || t.noCategory}
                                      </span>
                                    </div>
                                  </TableCell>
                                ) : null}

                                {safeVisibleColumns.price ? (
                                  <TableCell>
                                    <div className="space-y-1">
                                      <p className="font-semibold">
                                        <SarAmount value={product.effectivePrice} />
                                      </p>

                                      {product.hasDiscount ? (
                                        <p className="text-xs text-muted-foreground line-through">
                                          <SarAmount value={product.price} />
                                        </p>
                                      ) : null}
                                    </div>
                                  </TableCell>
                                ) : null}

                                {safeVisibleColumns.billing ? (
                                  <TableCell>
                                    <Badge variant="outline" className="rounded-full">
                                      {billingLabel(product.billingType, locale)}
                                    </Badge>
                                  </TableCell>
                                ) : null}

                                {safeVisibleColumns.readiness ? (
                                  <TableCell>
                                    <div className="flex min-w-[170px] flex-wrap gap-1">
                                      {product.canBeOrdered ? (
                                        <Badge
                                          variant="outline"
                                          className="rounded-full"
                                        >
                                          {t.orderReady}
                                        </Badge>
                                      ) : null}

                                      {product.canBeUsedInContracts ? (
                                        <Badge
                                          variant="outline"
                                          className="rounded-full"
                                        >
                                          {t.contractReady}
                                        </Badge>
                                      ) : null}

                                      {product.requiresProvider ? (
                                        <Badge
                                          variant="outline"
                                          className="rounded-full"
                                        >
                                          {t.requiresProvider}
                                        </Badge>
                                      ) : null}

                                      {!product.canBeOrdered &&
                                      !product.canBeUsedInContracts &&
                                      !product.requiresProvider ? (
                                        <span className="text-sm text-muted-foreground">
                                          -
                                        </span>
                                      ) : null}
                                    </div>
                                  </TableCell>
                                ) : null}

                                {safeVisibleColumns.channels ? (
                                  <TableCell>
                                    <div className="flex min-w-[170px] flex-wrap gap-1">
                                      <Badge variant="outline" className="rounded-full">
                                        {product.isPublic ? t.public : t.private}
                                      </Badge>

                                      {product.allowOnlinePurchase ? (
                                        <Badge
                                          variant="outline"
                                          className="rounded-full"
                                        >
                                          {t.online}
                                        </Badge>
                                      ) : null}

                                      {product.allowAgentSale ? (
                                        <Badge
                                          variant="outline"
                                          className="rounded-full"
                                        >
                                          {t.agentSale}
                                        </Badge>
                                      ) : null}

                                      {product.allowProviderSale ? (
                                        <Badge
                                          variant="outline"
                                          className="rounded-full"
                                        >
                                          {t.providerSale}
                                        </Badge>
                                      ) : null}
                                    </div>
                                  </TableCell>
                                ) : null}

                                {safeVisibleColumns.status ? (
                                  <TableCell>
                                    {statusBadge(product.status, locale)}
                                  </TableCell>
                                ) : null}

                                {safeVisibleColumns.updated ? (
                                  <TableCell>
                                    {formatDate(
                                      product.updatedAt || product.createdAt,
                                    )}
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

                                        {isValidProductId(product.id) ? (
                                          <DropdownMenuItem asChild>
                                            <Link
                                              href={`/system/products/${product.id}`}
                                            >
                                              <Eye className="h-4 w-4" />
                                              {t.viewDetails}
                                            </Link>
                                          </DropdownMenuItem>
                                        ) : null}

                                        <DropdownMenuItem
                                          onClick={() => {
                                            navigator.clipboard.writeText(
                                              String(product.code || "-"),
                                            );
                                            toast.success(t.copied);
                                          }}
                                        >
                                          {t.copyCode}
                                        </DropdownMenuItem>

                                        <DropdownMenuItem
                                          onClick={() => {
                                            navigator.clipboard.writeText(
                                              String(product.id || "-"),
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
                  <div className="flex-1 text-sm text-muted-foreground">
                    {formatNumber(selectedIds.length)} /{" "}
                    {formatNumber(sortedProducts.length)} {t.selectedRows}
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