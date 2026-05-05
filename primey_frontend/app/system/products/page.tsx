"use client";

/* ============================================================
   📂 app/system/products/page.tsx
   🧠 Primey Care | Products Dashboard Page
   ------------------------------------------------------------
   ✅ المسار: /system/products
   ✅ الإصدار: v2.0.0 - Centers Pattern + Safe Permissions

   ✅ العمل:
      لوحة مختصرة لإدارة المنتجات والبطاقات والبرامج والخدمات.

   ✅ المعيار:
      - مبني بصريًا على نمط المراكز والعملاء المعتمد.
      - دمج UX Refinement مع حماية المرحلة 2.
      - لا يتم إظهار مسارات تقنية أو API داخل الواجهة.
      - لا توجد روابط تقارير داخل الوحدة.
      - لا توجد أزرار وهمية.
      - إخفاء الأزرار غير المصرح بها بدل تعطيلها.
      - عدم كسر تحميل البيانات للمستخدم system_admin / superadmin.
      - منع طلب البيانات فقط عند وجود منع صريح لصلاحية العرض.
      - Error State مستقل عن Empty State.
      - Skeleton Loading.
      - Empty State ذكي.
      - Excel بصيغة .xls HTML Workbook.
      - Web PDF Print.
      - استخدام /currency/sar.svg.
      - الأرقام بالإنجليزية.
      - بدون localhost hardcoded.
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Boxes,
  CreditCard,
  Download,
  Eye,
  Layers3,
  ListChecks,
  Loader2,
  Package,
  Plus,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Tag,
  type LucideIcon,
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
type ProductTypeFilter = "all" | ProductType;

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
  stats?: Record<string, unknown>;
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
    pageTitle: isArabic ? "إدارة المنتجات" : "Products Management",
    pageSubtitle: isArabic
      ? "متابعة المنتجات والبطاقات والبرامج والخدمات، الأسعار، جاهزية الطلبات، وربط العقود."
      : "Monitor products, cards, programs, services, pricing, order readiness, and contracts linkage.",

    createProduct: isArabic ? "إنشاء منتج" : "Create Product",
    productsList: isArabic ? "قائمة المنتجات" : "Products List",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",

    featuredProducts: isArabic ? "المنتجات المميزة" : "Featured Products",
    featuredSubtitle: isArabic
      ? "عرض مختصر لأهم المنتجات حسب التمييز أو السعر أو الجاهزية."
      : "A compact view of key products based on featured status, price, or readiness.",

    trackStatus: isArabic
      ? "حالة المنتجات والجاهزية"
      : "Products & Readiness Status",
    trackSubtitle: isArabic
      ? "تحليل سريع لحالة المنتجات والبيع والربط مع العقود."
      : "Quick analysis of products status, sales channels, and contracts readiness.",

    filterPlaceholder: isArabic
      ? "ابحث في المنتجات..."
      : "Filter products...",

    all: isArabic ? "الكل" : "All",
    total: isArabic ? "الإجمالي" : "Total",
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

    loaded: isArabic ? "محمّلة" : "Loaded",
    operational: isArabic ? "تشغيلي" : "Operational",
    orderReady: isArabic ? "جاهز للطلبات" : "Order Ready",
    contractReady: isArabic ? "جاهز للعقود" : "Contract Ready",

    productsValue: isArabic ? "قيمة المنتجات" : "Products Value",
    activeProducts: isArabic ? "المنتجات النشطة" : "Active Products",
    orderReadyProducts: isArabic ? "جاهزة للطلبات" : "Order Ready",
    contractReadyProducts: isArabic ? "جاهزة للعقود" : "Contract Ready",
    onlineProducts: isArabic ? "شراء إلكتروني" : "Online Purchase",
    agentSaleProducts: isArabic ? "بيع المندوب" : "Agent Sale",
    providerSaleProducts: isArabic ? "بيع مقدم الخدمة" : "Provider Sale",

    showing: isArabic ? "عرض" : "Showing",
    from: isArabic ? "من" : "of",
    latestRecords: isArabic ? "آخر السجلات" : "Latest records",
    viewFullList: isArabic ? "عرض القائمة الكاملة" : "View Full List",

    table: {
      code: isArabic ? "الكود" : "Code",
      product: isArabic ? "المنتج" : "Product",
      type: isArabic ? "النوع" : "Type",
      category: isArabic ? "التصنيف" : "Category",
      price: isArabic ? "السعر" : "Price",
      readiness: isArabic ? "الجاهزية" : "Readiness",
      status: isArabic ? "الحالة" : "Status",
      action: isArabic ? "الإجراء" : "Action",
    },

    emptyTitle: isArabic ? "لا توجد منتجات بعد" : "No products yet",
    emptyText: isArabic
      ? "عند إضافة منتجات أو برامج جديدة ستظهر بياناتها هنا مباشرة."
      : "New products or programs will appear here once they are added.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير كلمات البحث أو فلتر الحالة أو النوع لعرض نتائج أكثر."
      : "Try changing search keywords, status filter, or type filter to show more results.",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الصفحة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض بيانات المنتجات. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view products data. Contact your system administrator if you need access.",

    apiError: isArabic
      ? "تعذر تحميل بيانات المنتجات."
      : "Unable to load products data.",
    apiErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    refreshSuccess: isArabic
      ? "تم تحديث بيانات المنتجات بنجاح"
      : "Products data refreshed successfully",
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

    quickAccessTitle: isArabic
      ? "إجراءات وحدة المنتجات"
      : "Products Module Actions",
    quickAccessSubtitle: isArabic
      ? "اختصارات منظمة للوصول إلى أهم صفحات وحدة المنتجات."
      : "Organized shortcuts to the key products module pages.",

    open: isArabic ? "فتح" : "Open",
    manage: isArabic ? "إدارة" : "Manage",

    actionListTitle: isArabic ? "قائمة المنتجات" : "Products List",
    actionListDesc: isArabic
      ? "استعراض جميع المنتجات، البحث، التصفية، وإدارة السجلات."
      : "Browse all products, search, filter, and manage records.",

    actionCreateTitle: isArabic ? "إنشاء منتج" : "Create Product",
    actionCreateDesc: isArabic
      ? "إضافة منتج أو بطاقة أو برنامج أو خدمة جديدة."
      : "Add a new product, card, program, or service.",

    export: {
      generatedAt: isArabic ? "تاريخ التصدير" : "Generated At",
      scope: isArabic ? "نطاق التقرير" : "Report Scope",
      currentData: isArabic ? "البيانات الظاهرة" : "Visible Data",
      search: isArabic ? "البحث" : "Search",
      status: isArabic ? "فلتر الحالة" : "Status Filter",
      type: isArabic ? "فلتر النوع" : "Type Filter",
    },

    printTitle: isArabic ? "لوحة المنتجات" : "Products Dashboard",
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

function isValidProductId(id: Product["id"]) {
  const value = String(id || "").trim();

  return value.length > 0 && value !== "-" && value !== "undefined";
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

/* ============================================================
   Skeleton
============================================================ */

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function SummaryCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index} className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div className="space-y-3">
              <SkeletonLine className="h-11 w-11 rounded-2xl" />
              <div className="space-y-2">
                <SkeletonLine className="h-4 w-28" />
                <SkeletonLine className="h-7 w-32" />
              </div>
            </div>

            <div className="space-y-2 rounded-2xl border bg-background px-3 py-2">
              <SkeletonLine className="h-3 w-20" />
              <SkeletonLine className="h-4 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FeaturedProductsSkeleton() {
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
        <div
          key={index}
          className="space-y-3 rounded-xl border bg-background/70 p-3"
        >
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

function TableRowsSkeleton({ columnsCount }: { columnsCount: number }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, rowIndex) => (
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
          <td>${escapeHtml(product.categoryName || "-")}</td>
          <td>${escapeHtml(formatMoney(product.effectivePrice))}</td>
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
              <th>${escapeHtml(t.orderReady)}</th>
              <th>${escapeHtml(t.contractReady)}</th>
              <th>${escapeHtml(t.table.status)}</th>
            </tr>
          </thead>
          <tbody>
            ${
              tableRows ||
              `<tr><td colspan="9" style="text-align:center">${escapeHtml(t.emptyTitle)}</td></tr>`
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

export default function SystemProductsPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<ProductTypeFilter>("all");
  const [errorMessage, setErrorMessage] = useState("");

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

  const filteredProducts = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return products.filter((product) => {
      const matchesStatus =
        statusFilter === "all" ? true : product.status === statusFilter;

      const matchesType =
        typeFilter === "all" ? true : product.productType === typeFilter;

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
            typeLabel(product.productType, locale),
            statusLabel(product.status, locale),
          ]
            .join(" ")
            .toLowerCase()
            .includes(cleanQuery);

      return matchesStatus && matchesType && matchesQuery;
    });
  }, [locale, products, query, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const total = products.length;
    const active = products.filter((item) => item.status === "active").length;
    const draft = products.filter((item) => item.status === "draft").length;
    const inactive = products.filter((item) => item.status === "inactive").length;
    const archived = products.filter((item) => item.status === "archived").length;

    const totalValue = products.reduce(
      (sum, item) => sum + item.effectivePrice,
      0,
    );

    const orderReady = products.filter((item) => item.canBeOrdered).length;
    const contractReady = products.filter(
      (item) => item.canBeUsedInContracts,
    ).length;
    const online = products.filter((item) => item.allowOnlinePurchase).length;
    const agentSale = products.filter((item) => item.allowAgentSale).length;
    const providerSale = products.filter((item) => item.allowProviderSale).length;

    const byType = {
      membership: products.filter((item) => item.productType === "membership")
        .length,
      card: products.filter((item) => item.productType === "card").length,
      program: products.filter((item) => item.productType === "program").length,
      service: products.filter((item) => item.productType === "service").length,
      other: products.filter((item) => item.productType === "other").length,
    };

    return {
      total,
      active,
      draft,
      inactive,
      archived,
      totalValue,
      orderReady,
      contractReady,
      online,
      agentSale,
      providerSale,
      byType,
    };
  }, [products]);

  const featuredProducts = useMemo(() => {
    const featured = products.filter((item) => item.isFeatured);

    if (featured.length > 0) {
      return featured.slice(0, 6);
    }

    return [...products]
      .sort((a, b) => b.effectivePrice - a.effectivePrice)
      .slice(0, 6);
  }, [products]);

  const tableRows = useMemo(
    () => filteredProducts.slice(0, 8),
    [filteredProducts],
  );

  const statusCards = useMemo(
    () => [
      {
        title: t.total,
        value: stats.total,
        helper: t.loaded,
        helperValue: stats.total > 0 ? "100%" : "0%",
        icon: Package,
        percent: stats.total > 0 ? 100 : 0,
        filter: "all" as StatusFilter,
      },
      {
        title: t.active,
        value: stats.active,
        helper: t.operational,
        helperValue: `${percent(stats.active, stats.total)}%`,
        icon: BadgeCheck,
        percent: percent(stats.active, stats.total),
        filter: "active" as StatusFilter,
      },
      {
        title: t.draft,
        value: stats.draft,
        helper: t.orderReady,
        helperValue: `${percent(stats.orderReady, stats.total)}%`,
        icon: ShieldCheck,
        percent: percent(stats.orderReady, stats.total),
        filter: "draft" as StatusFilter,
      },
      {
        title: t.archived,
        value: stats.archived + stats.inactive,
        helper: t.contractReady,
        helperValue: `${percent(stats.contractReady, stats.total)}%`,
        icon: Layers3,
        percent: percent(stats.contractReady, stats.total),
        filter: "archived" as StatusFilter,
      },
    ],
    [stats, t],
  );

  const statusFilters = useMemo(
    () =>
      [
        {
          value: "all" as StatusFilter,
          label: t.all,
          count: products.length,
        },
        {
          value: "active" as StatusFilter,
          label: t.active,
          count: stats.active,
        },
        {
          value: "draft" as StatusFilter,
          label: t.draft,
          count: stats.draft,
        },
        {
          value: "inactive" as StatusFilter,
          label: t.inactive,
          count: stats.inactive,
        },
        {
          value: "archived" as StatusFilter,
          label: t.archived,
          count: stats.archived,
        },
      ],
    [products.length, stats, t],
  );

  const typeFilters = useMemo(
    () =>
      [
        {
          value: "all" as ProductTypeFilter,
          label: t.all,
          count: products.length,
        },
        {
          value: "membership" as ProductTypeFilter,
          label: t.membership,
          count: stats.byType.membership,
        },
        {
          value: "card" as ProductTypeFilter,
          label: t.card,
          count: stats.byType.card,
        },
        {
          value: "program" as ProductTypeFilter,
          label: t.program,
          count: stats.byType.program,
        },
        {
          value: "service" as ProductTypeFilter,
          label: t.service,
          count: stats.byType.service,
        },
      ],
    [products.length, stats.byType, t],
  );

  const summaryCards = useMemo(
    () => [
      {
        title: t.productsValue,
        value: stats.totalValue,
        icon: Sparkles,
        helper: t.activeProducts,
        helperValue: formatNumber(stats.active),
        isMoney: true,
      },
      {
        title: t.orderReadyProducts,
        value: stats.orderReady,
        icon: ShieldCheck,
        helper: t.onlineProducts,
        helperValue: formatNumber(stats.online),
        isMoney: false,
      },
      {
        title: t.contractReadyProducts,
        value: stats.contractReady,
        icon: Layers3,
        helper: t.agentSaleProducts,
        helperValue: formatNumber(stats.agentSale),
        isMoney: false,
      },
    ],
    [stats, t],
  );

  const moduleActions = useMemo(
    () =>
      [
        canViewProducts
          ? {
              title: t.actionListTitle,
              description: t.actionListDesc,
              href: "/system/products/list",
              icon: ListChecks,
              badge: `${formatNumber(stats.total)}`,
              cta: t.manage,
            }
          : null,
        canCreateProducts
          ? {
              title: t.actionCreateTitle,
              description: t.actionCreateDesc,
              href: "/system/products/create",
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
    [canCreateProducts, canViewProducts, isArabic, stats.total, t],
  );

  const hasSearchOrFilter =
    query.trim().length > 0 || statusFilter !== "all" || typeFilter !== "all";

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
          apiUrl("/api/products/?page_size=100&include_children=true"),
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
        console.error("Failed to load products:", error);
        setProducts([]);
        setErrorMessage(t.apiError);
        toast.error(t.apiError);
      } finally {
        setIsLoading(false);
      }
    },
    [canViewProducts, t.apiError, t.refreshSuccess],
  );

  function exportProducts() {
    if (!canExportProducts) return;

    if (filteredProducts.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const generatedAt = new Date();

    const statusFilterLabel =
      statusFilters.find((item) => item.value === statusFilter)?.label || t.all;

    const typeFilterLabel =
      typeFilters.find((item) => item.value === typeFilter)?.label || t.all;

    downloadExcel({
      filename: `primey-care-products-dashboard-${generatedAt
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "لوحة المنتجات" : "Products Dashboard",
      title: t.pageTitle,
      locale,
      summaryRows: [
        [t.export.generatedAt, generatedAt.toLocaleString("en-US")],
        [t.export.scope, t.export.currentData],
        [
          t.showing,
          `${formatNumber(filteredProducts.length)} / ${formatNumber(
            products.length,
          )}`,
        ],
        [t.total, stats.total],
        [t.active, stats.active],
        [t.orderReadyProducts, stats.orderReady],
        [t.contractReadyProducts, stats.contractReady],
        [t.productsValue, formatMoney(stats.totalValue)],
      ],
      filterRows: [
        [t.export.search, query || t.all],
        [t.export.status, statusFilterLabel],
        [t.export.type, typeFilterLabel],
      ],
      headers: [
        t.table.code,
        t.table.product,
        t.table.type,
        t.table.category,
        t.table.price,
        t.orderReadyProducts,
        t.contractReadyProducts,
        t.onlineProducts,
        t.agentSaleProducts,
        t.providerSaleProducts,
        t.table.status,
      ],
      rows: filteredProducts.map((product) => [
        product.code || "-",
        product.name || "-",
        typeLabel(product.productType, locale),
        product.categoryName || "-",
        formatMoney(product.effectivePrice),
        product.canBeOrdered ? t.orderReady : "-",
        product.canBeUsedInContracts ? t.contractReady : "-",
        product.allowOnlinePurchase ? t.onlineProducts : "-",
        product.allowAgentSale ? t.agentSaleProducts : "-",
        product.allowProviderSale ? t.providerSaleProducts : "-",
        statusLabel(product.status, locale),
      ]),
    });

    toast.success(t.exportSuccess);
  }

  function printProducts() {
    if (!canPrintProducts) return;

    if (filteredProducts.length === 0) {
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
        rows: filteredProducts,
        t,
      }),
    );
    printWindow.document.close();

    toast.success(t.printSuccess);
  }

  function renderFeaturedProduct(product: Product) {
    const Icon = productIcon(product.productType);

    const content = (
      <div className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3 transition hover:bg-muted/50">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Icon className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold">{product.name}</p>

              {product.isFeatured ? (
                <Sparkles className="h-3.5 w-3.5 shrink-0 fill-yellow-400 text-yellow-500" />
              ) : null}
            </div>

            <p className="mt-1 truncate text-xs text-muted-foreground">
              {product.code}
            </p>
          </div>
        </div>

        <div className="shrink-0 text-end">
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {typeLabel(product.productType, locale)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatMoney(product.effectivePrice)}
          </p>
        </div>
      </div>
    );

    if (!canViewProductDetails || !isValidProductId(product.id)) {
      return (
        <div key={`${product.code}-${product.name}`} className="block">
          {content}
        </div>
      );
    }

    return (
      <Link
        key={product.id}
        href={`/system/products/${product.id}`}
        className="block"
      >
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
    if (authResolving) return;
    loadProducts(false);
  }, [authResolving, loadProducts]);

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
              onClick={exportProducts}
              disabled={
                isLoading ||
                filteredProducts.length === 0 ||
                Boolean(errorMessage)
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
              onClick={printProducts}
              disabled={
                isLoading ||
                filteredProducts.length === 0 ||
                Boolean(errorMessage)
              }
            >
              <Printer className="h-4 w-4" />
              <span>{t.print}</span>
            </Button>
          ) : null}

          {canCreateProducts ? (
            <Link href="/system/products/create">
              <Button className="h-10 w-full rounded-xl sm:w-auto">
                <Plus className="h-4 w-4" />
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
          {/* Summary */}
          {isLoading ? (
            <SummaryCardsSkeleton />
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {summaryCards.map((item) => {
                const Icon = item.icon;

                return (
                  <Card
                    key={item.title}
                    className="rounded-2xl border bg-card shadow-sm"
                  >
                    <CardContent className="flex items-start justify-between gap-4 p-5">
                      <div className="space-y-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted">
                          <Icon className="h-5 w-5" />
                        </div>

                        <div>
                          <p className="text-sm text-muted-foreground">
                            {item.title}
                          </p>
                          <p className="mt-1 text-2xl font-bold">
                            {item.isMoney ? (
                              <SarAmount value={item.value} />
                            ) : (
                              formatNumber(item.value)
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl border bg-background px-3 py-2 text-end">
                        <p className="text-xs text-muted-foreground">
                          {item.helper}
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {item.helperValue}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Main Layout */}
          <div className="grid gap-4 xl:grid-cols-3">
            {/* Featured Products */}
            <Card className="rounded-2xl border bg-card shadow-sm xl:col-span-1">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div>
                  <CardTitle className="text-base font-bold">
                    {t.featuredProducts}
                  </CardTitle>
                  <CardDescription className="mt-1 text-sm leading-6">
                    {t.featuredSubtitle}
                  </CardDescription>
                </div>

                {canViewProducts ? (
                  <Link href="/system/products/list">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-xl"
                    >
                      <ListChecks className="h-4 w-4" />
                    </Button>
                  </Link>
                ) : null}
              </CardHeader>

              <CardContent className="space-y-3">
                {isLoading ? (
                  <FeaturedProductsSkeleton />
                ) : featuredProducts.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-5 text-center">
                    <p className="font-semibold">{t.emptyTitle}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {t.emptyText}
                    </p>
                  </div>
                ) : (
                  featuredProducts.map((product) =>
                    renderFeaturedProduct(product),
                  )
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
                  <CardDescription className="mt-1 text-sm leading-6">
                    {t.trackSubtitle}
                  </CardDescription>
                </div>

                {canViewProducts ? (
                  <Link href="/system/products/list">
                    <Button variant="outline" className="h-9 rounded-xl">
                      <ListChecks className="h-4 w-4" />
                      <span>{t.viewFullList}</span>
                    </Button>
                  </Link>
                ) : null}
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
                          onClick={() => setStatusFilter(card.filter)}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <p className="text-2xl font-bold">
                              {formatNumber(card.value)}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm text-muted-foreground">
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

                            <p className="pt-1 text-xs text-muted-foreground">
                              {card.helper}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Search + Filters */}
                <div className="grid gap-3">
                  <div className="relative">
                    <Search
                      className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${
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

                  <div className="flex flex-wrap gap-2">
                    {statusFilters.map((item) => {
                      const isSelected = statusFilter === item.value;

                      return (
                        <Button
                          key={item.value}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          className="rounded-xl"
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

                  <div className="flex flex-wrap gap-2">
                    {typeFilters.map((item) => {
                      const isSelected = typeFilter === item.value;

                      return (
                        <Button
                          key={item.value}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          className="rounded-xl"
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
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-xl border">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.table.code}</TableHead>
                          <TableHead>{t.table.product}</TableHead>
                          <TableHead>{t.table.type}</TableHead>
                          <TableHead>{t.table.category}</TableHead>
                          <TableHead>{t.table.price}</TableHead>
                          <TableHead>{t.table.readiness}</TableHead>
                          <TableHead>{t.table.status}</TableHead>
                          {canViewProductDetails ? (
                            <TableHead>{t.table.action}</TableHead>
                          ) : null}
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {isLoading ? (
                          <TableRowsSkeleton
                            columnsCount={canViewProductDetails ? 8 : 7}
                          />
                        ) : tableRows.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={canViewProductDetails ? 8 : 7}
                            >
                              <div className="py-12 text-center">
                                <p className="font-semibold">
                                  {hasSearchOrFilter
                                    ? t.noResultsTitle
                                    : t.emptyTitle}
                                </p>
                                <p className="mt-2 text-sm text-muted-foreground">
                                  {hasSearchOrFilter
                                    ? t.noResultsText
                                    : t.emptyText}
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          tableRows.map((product) => {
                            const Icon = productIcon(product.productType);

                            return (
                              <TableRow key={`${product.id}-${product.code}`}>
                                <TableCell className="font-medium">
                                  {product.code || `#${product.id}`}
                                </TableCell>

                                <TableCell>
                                  <div className="flex min-w-[220px] items-center gap-2">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                                      <Icon className="h-4 w-4" />
                                    </div>

                                    <div className="min-w-0">
                                      <p className="truncate font-medium">
                                        {product.name}
                                      </p>
                                      <p className="truncate text-xs text-muted-foreground">
                                        {product.shortDescription ||
                                          product.slug ||
                                          "-"}
                                      </p>
                                    </div>
                                  </div>
                                </TableCell>

                                <TableCell>
                                  <Badge
                                    variant="secondary"
                                    className="rounded-full"
                                  >
                                    {typeLabel(product.productType, locale)}
                                  </Badge>
                                </TableCell>

                                <TableCell>
                                  <div className="flex min-w-[120px] items-center gap-2">
                                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span>{product.categoryName || "-"}</span>
                                  </div>
                                </TableCell>

                                <TableCell>
                                  <SarAmount value={product.effectivePrice} />
                                </TableCell>

                                <TableCell>
                                  <div className="flex min-w-[160px] flex-wrap gap-1">
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

                                    {!product.canBeOrdered &&
                                    !product.canBeUsedInContracts ? (
                                      <span className="text-sm text-muted-foreground">
                                        -
                                      </span>
                                    ) : null}
                                  </div>
                                </TableCell>

                                <TableCell>
                                  {statusBadge(product.status, locale)}
                                </TableCell>

                                {canViewProductDetails ? (
                                  <TableCell>
                                    {isValidProductId(product.id) ? (
                                      <Link
                                        href={`/system/products/${product.id}`}
                                      >
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

                {/* Footer */}
                <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    {t.showing} {formatNumber(tableRows.length)} {t.from}{" "}
                    {formatNumber(filteredProducts.length)} · {t.latestRecords}
                  </p>

                  {canViewProducts ? (
                    <Link href="/system/products/list">
                      <Button variant="outline" size="sm" className="rounded-xl">
                        <ListChecks className="h-4 w-4" />
                        {t.viewFullList}
                      </Button>
                    </Link>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>

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