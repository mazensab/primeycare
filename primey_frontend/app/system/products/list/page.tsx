"use client";

/* ============================================================
   📂 app/system/products/list/page.tsx
   🧠 Primey Care | Products List
   ------------------------------------------------------------
   ✅ قائمة المنتجات والبرامج والعروض الطبية
   ✅ Server Pagination
   ✅ دعم مقدم الخدمة + صور المنتج + الظهور التسويقي
   ✅ Excel .xls HTML Workbook
   ✅ Web PDF Print
   ✅ Centers/Customers Pattern + Phase 2 Permissions
============================================================ */

import Image from "next/image";
import Link from "next/link";
import type { ComponentType } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Columns3,
  Download,
  Eye,
  FileImage,
  FileSpreadsheet,
  Globe2,
  ImageIcon,
  Layers3,
  Loader2,
  Package,
  Plus,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stethoscope,
  Tag,
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

type ProductStatus = "draft" | "active" | "inactive" | "archived" | "UNKNOWN";
type ProductType = "membership" | "card" | "program" | "service" | "other" | "UNKNOWN";
type BillingType = "one_time" | "recurring" | "UNKNOWN";
type FulfillmentType = "digital" | "physical" | "both" | "service_based" | "none" | "UNKNOWN";

type StatusFilter = "all" | "draft" | "active" | "inactive" | "archived";
type TypeFilter = "all" | "membership" | "card" | "program" | "service" | "other";
type OfferFilter = "all" | "offer" | "not_offer";
type VisibilityFilter = "all" | "yes" | "no";
type SortKey =
  | "-created_at"
  | "created_at"
  | "name"
  | "-name"
  | "price"
  | "-price"
  | "offer_start_date"
  | "-offer_start_date"
  | "offer_end_date"
  | "-offer_end_date";

type ProviderSummary = {
  id?: string | number | null;
  code?: string | null;
  name?: string | null;
  name_ar?: string | null;
  name_en?: string | null;
  provider_type?: string | null;
  status?: string | null;
  city?: string | null;
  region?: string | null;
  logo_url?: string | null;
};

type Product = {
  id: string | number;
  code: string;
  name: string;
  slug: string;
  productType: ProductType;
  categoryName: string;
  providerId: string;
  provider: ProviderSummary | null;
  status: ProductStatus;
  billingType: BillingType;
  fulfillmentType: FulfillmentType;
  shortDescription: string;
  price: number;
  salePrice: number;
  effectivePrice: number;
  totalPriceWithTax: number;
  isOffer: boolean;
  offerTitle: string;
  offerStartDate: string;
  offerEndDate: string;
  showOnLanding: boolean;
  showOnMobile: boolean;
  showOnOffers: boolean;
  isPublic: boolean;
  isFeatured: boolean;
  allowOnlinePurchase: boolean;
  canBeOrdered: boolean;
  canBeUsedInContracts: boolean;
  requiresProvider: boolean;
  thumbnailImageUrl: string;
  marketingImageUrl: string;
  hasThumbnailImage: boolean;
  hasMarketingImage: boolean;
  createdAt: string;
  updatedAt: string;
};

type Pagination = {
  page: number;
  page_size: number;
  total_pages: number;
  total_items: number;
  has_next: boolean;
  has_previous: boolean;
};

type ProductsApiResponse = {
  ok?: boolean;
  message?: string;
  results?: unknown[];
  data?: unknown[] | { results?: unknown[]; items?: unknown[] };
  items?: unknown[];
  pagination?: Partial<Pagination>;
};

type ListApiResponse<T> = {
  ok?: boolean;
  results?: T[];
  data?: T[] | { results?: T[]; items?: T[] };
  items?: T[];
};

type SelectOption = {
  id: string | number;
  name?: string;
  name_ar?: string;
  name_en?: string;
  code?: string;
  title?: string;
};

type VisibleColumns = {
  image: boolean;
  product: boolean;
  provider: boolean;
  type: boolean;
  category: boolean;
  price: boolean;
  offer: boolean;
  visibility: boolean;
  readiness: boolean;
  status: boolean;
  updated: boolean;
  actions: boolean;
};

const SAR_ICON_PATH = "/currency/sar.svg";
const PAGE_SIZE = 20;

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
   API Helpers
============================================================ */

function apiUrl(path: string) {
  const base =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "";

  if (!base) return path;

  return `${base.replace(/\/$/, "")}${path}`;
}

function extractList<T>(payload: ListApiResponse<T>): T[] {
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;

  if (payload.data && typeof payload.data === "object") {
    if (Array.isArray(payload.data.results)) return payload.data.results;
    if (Array.isArray(payload.data.items)) return payload.data.items;
  }

  return [];
}

function extractProducts(payload: ProductsApiResponse | null): unknown[] {
  if (!payload) return [];

  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;

  if (payload.data && typeof payload.data === "object") {
    if (Array.isArray(payload.data.results)) return payload.data.results;
    if (Array.isArray(payload.data.items)) return payload.data.items;
  }

  return [];
}

/* ============================================================
   Permissions
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

function getValue(obj: Record<string, unknown>, key: string): unknown {
  const direct = obj[key];

  if (direct !== undefined && direct !== null && direct !== "") {
    return direct;
  }

  const containers = ["product", "pricing", "summary", "stats"];

  for (const container of containers) {
    const nested = obj[container];

    if (nested && typeof nested === "object") {
      const value = (nested as Record<string, unknown>)[key];

      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }
  }

  return undefined;
}

function normalizeStatus(value: unknown): ProductStatus {
  const status = String(value || "").toLowerCase();

  if (status === "draft") return "draft";
  if (status === "active") return "active";
  if (status === "inactive") return "inactive";
  if (status === "archived") return "archived";

  if (value === true) return "active";
  if (value === false) return "inactive";

  return "UNKNOWN";
}

function normalizeType(value: unknown): ProductType {
  const type = String(value || "").toLowerCase();

  if (type === "membership") return "membership";
  if (type === "card") return "card";
  if (type === "program") return "program";
  if (type === "service") return "service";
  if (type === "other") return "other";

  return "UNKNOWN";
}

function normalizeBilling(value: unknown): BillingType {
  const billing = String(value || "").toLowerCase();

  if (billing === "one_time") return "one_time";
  if (billing === "recurring") return "recurring";

  return "UNKNOWN";
}

function normalizeFulfillment(value: unknown): FulfillmentType {
  const fulfillment = String(value || "").toLowerCase();

  if (fulfillment === "digital") return "digital";
  if (fulfillment === "physical") return "physical";
  if (fulfillment === "both") return "both";
  if (fulfillment === "service_based") return "service_based";
  if (fulfillment === "none") return "none";

  return "UNKNOWN";
}

function normalizeProvider(value: unknown): ProviderSummary | null {
  if (!value || typeof value !== "object") return null;

  const obj = value as Record<string, unknown>;

  return {
    id: (obj.id as string | number | null) || null,
    code: String(obj.code || ""),
    name: String(obj.name || ""),
    name_ar: String(obj.name_ar || ""),
    name_en: String(obj.name_en || ""),
    provider_type: String(obj.provider_type || ""),
    status: String(obj.status || ""),
    city: String(obj.city || ""),
    region: String(obj.region || ""),
    logo_url: String(obj.logo_url || ""),
  };
}

function normalizeProduct(item: unknown): Product {
  const obj = (item || {}) as Record<string, unknown>;
  const category = obj.category as Record<string, unknown> | null | undefined;
  const provider = normalizeProvider(obj.provider);

  const id = getValue(obj, "id") ?? "";
  const price = toNumber(getValue(obj, "price"));
  const salePrice = toNumber(getValue(obj, "sale_price"));
  const effectivePrice = toNumber(getValue(obj, "effective_price") || salePrice || price);

  const thumbnailImageUrl = String(
    getValue(obj, "thumbnail_image_url") ||
      getValue(obj, "thumbnail_image_drive_view_url") ||
      "",
  );

  const marketingImageUrl = String(
    getValue(obj, "marketing_image_url") ||
      getValue(obj, "marketing_image_drive_view_url") ||
      "",
  );

  return {
    id: id as string | number,
    code: String(getValue(obj, "code") || "-"),
    name: String(getValue(obj, "name") || getValue(obj, "title") || "-"),
    slug: String(getValue(obj, "slug") || ""),
    productType: normalizeType(getValue(obj, "product_type")),
    categoryName: String(category?.name || getValue(obj, "category_name") || ""),
    providerId: String(getValue(obj, "provider_id") || provider?.id || ""),
    provider,
    status: normalizeStatus(getValue(obj, "status")),
    billingType: normalizeBilling(getValue(obj, "billing_type")),
    fulfillmentType: normalizeFulfillment(getValue(obj, "fulfillment_type")),
    shortDescription: String(getValue(obj, "short_description") || ""),
    price,
    salePrice,
    effectivePrice,
    totalPriceWithTax: toNumber(getValue(obj, "total_price_with_tax") || effectivePrice),
    isOffer: Boolean(getValue(obj, "is_offer")),
    offerTitle: String(getValue(obj, "offer_title") || ""),
    offerStartDate: String(getValue(obj, "offer_start_date") || ""),
    offerEndDate: String(getValue(obj, "offer_end_date") || ""),
    showOnLanding: Boolean(getValue(obj, "show_on_landing")),
    showOnMobile: Boolean(getValue(obj, "show_on_mobile")),
    showOnOffers: Boolean(getValue(obj, "show_on_offers")),
    isPublic: Boolean(getValue(obj, "is_public")),
    isFeatured: Boolean(getValue(obj, "is_featured")),
    allowOnlinePurchase: Boolean(getValue(obj, "allow_online_purchase")),
    canBeOrdered: Boolean(getValue(obj, "can_be_ordered")),
    canBeUsedInContracts: Boolean(getValue(obj, "can_be_used_in_contracts")),
    requiresProvider: Boolean(getValue(obj, "requires_provider")),
    thumbnailImageUrl,
    marketingImageUrl,
    hasThumbnailImage: Boolean(getValue(obj, "has_thumbnail_image") || thumbnailImageUrl),
    hasMarketingImage: Boolean(getValue(obj, "has_marketing_image") || marketingImageUrl),
    createdAt: String(getValue(obj, "created_at") || ""),
    updatedAt: String(getValue(obj, "updated_at") || getValue(obj, "created_at") || ""),
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
      ? "إدارة المنتجات والبرامج والعروض الطبية وربطها بمقدمي الخدمة."
      : "Manage products, programs, medical offers, and provider-linked products.",

    back: isArabic ? "العودة للمنتجات" : "Back to Products",
    refresh: isArabic ? "تحديث" : "Refresh",
    create: isArabic ? "إنشاء منتج" : "Create Product",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    retry: isArabic ? "إعادة المحاولة" : "Retry",

    searchPlaceholder: isArabic
      ? "ابحث باسم المنتج أو الكود أو مقدم الخدمة أو العرض..."
      : "Search by product, code, provider, or offer...",
    filters: isArabic ? "الفلاتر" : "Filters",
    columns: isArabic ? "الأعمدة" : "Columns",
    all: isArabic ? "الكل" : "All",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",

    totalProducts: isArabic ? "إجمالي المنتجات" : "Total Products",
    activeProducts: isArabic ? "المنتجات النشطة" : "Active Products",
    offersProducts: isArabic ? "العروض" : "Offers",
    landingProducts: isArabic ? "تظهر في الهبوط" : "Landing Visible",
    mobileProducts: isArabic ? "تظهر في التطبيق" : "Mobile Visible",
    marketingImages: isArabic ? "لديها صورة تسويقية" : "Marketing Images",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض المنتجات" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض قائمة المنتجات."
      : "You do not have permission to view products.",

    loadError: isArabic ? "تعذر تحميل قائمة المنتجات." : "Unable to load products.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    refreshSuccess: isArabic ? "تم تحديث قائمة المنتجات." : "Products refreshed.",
    exportEmpty: isArabic ? "لا توجد بيانات للتصدير." : "No data to export.",
    printEmpty: isArabic ? "لا توجد بيانات للطباعة." : "No data to print.",
    printReady: isArabic ? "تم تجهيز نافذة الطباعة." : "Print window prepared.",
    printError: isArabic ? "تعذر فتح نافذة الطباعة." : "Unable to open print window.",

    emptyTitle: isArabic ? "لا توجد منتجات مطابقة" : "No matching products",
    emptyText: isArabic
      ? "غيّر البحث أو الفلاتر لعرض نتائج أخرى."
      : "Change search or filters to see other results.",
    emptyDefaultTitle: isArabic ? "لا توجد منتجات بعد" : "No products yet",
    emptyDefaultText: isArabic
      ? "ابدأ بإنشاء منتج أو برنامج أو عرض طبي جديد."
      : "Start by creating a product, program, or medical offer.",

    generatedAt: isArabic ? "تاريخ التصدير" : "Generated At",
    reportScope: isArabic ? "نطاق التقرير" : "Report Scope",
    currentPage: isArabic ? "الصفحة الحالية" : "Current Page",
    filterSearch: isArabic ? "البحث" : "Search",
    filterStatus: isArabic ? "الحالة" : "Status",
    filterType: isArabic ? "النوع" : "Type",
    filterProvider: isArabic ? "مقدم الخدمة" : "Provider",
    filterOffer: isArabic ? "العرض" : "Offer",
    filterLanding: isArabic ? "الهبوط" : "Landing",
    filterMobile: isArabic ? "التطبيق" : "Mobile",
    filterOffers: isArabic ? "العروض" : "Offers",
    filterSort: isArabic ? "الترتيب" : "Sort",

    noProvider: isArabic ? "بدون مقدم خدمة" : "No Provider",
    yes: isArabic ? "نعم" : "Yes",
    no: isArabic ? "لا" : "No",
    page: isArabic ? "صفحة" : "Page",
    of: isArabic ? "من" : "of",
    rows: isArabic ? "صفوف" : "Rows",
    details: isArabic ? "التفاصيل" : "Details",
    currentFilteredData: isArabic ? "بيانات الصفحة الحالية" : "Current page data",

    status: {
      all: isArabic ? "كل الحالات" : "All Statuses",
      draft: isArabic ? "مسودة" : "Draft",
      active: isArabic ? "نشط" : "Active",
      inactive: isArabic ? "غير نشط" : "Inactive",
      archived: isArabic ? "مؤرشف" : "Archived",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    },

    type: {
      all: isArabic ? "كل الأنواع" : "All Types",
      membership: isArabic ? "عضوية" : "Membership",
      card: isArabic ? "بطاقة" : "Card",
      program: isArabic ? "برنامج" : "Program",
      service: isArabic ? "خدمة" : "Service",
      other: isArabic ? "أخرى" : "Other",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    },

    billing: {
      one_time: isArabic ? "مرة واحدة" : "One Time",
      recurring: isArabic ? "متكرر" : "Recurring",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    },

    offerFilter: {
      all: isArabic ? "كل المنتجات" : "All Products",
      offer: isArabic ? "العروض فقط" : "Offers Only",
      not_offer: isArabic ? "ليست عروض" : "Not Offers",
    },

    visibilityFilter: {
      all: isArabic ? "الكل" : "All",
      yes: isArabic ? "يظهر" : "Visible",
      no: isArabic ? "لا يظهر" : "Hidden",
    },

    sortOptions: {
      "-created_at": isArabic ? "الأحدث أولًا" : "Newest First",
      created_at: isArabic ? "الأقدم أولًا" : "Oldest First",
      name: isArabic ? "الاسم تصاعديًا" : "Name A-Z",
      "-name": isArabic ? "الاسم تنازليًا" : "Name Z-A",
      price: isArabic ? "السعر الأقل" : "Lowest Price",
      "-price": isArabic ? "السعر الأعلى" : "Highest Price",
      offer_start_date: isArabic ? "بداية العرض الأقدم" : "Oldest Offer Start",
      "-offer_start_date": isArabic ? "بداية العرض الأحدث" : "Newest Offer Start",
      offer_end_date: isArabic ? "نهاية العرض الأقرب" : "Nearest Offer End",
      "-offer_end_date": isArabic ? "نهاية العرض الأبعد" : "Latest Offer End",
    } satisfies Record<SortKey, string>,

    table: {
      image: isArabic ? "الصورة" : "Image",
      product: isArabic ? "المنتج" : "Product",
      provider: isArabic ? "مقدم الخدمة" : "Provider",
      type: isArabic ? "النوع" : "Type",
      category: isArabic ? "التصنيف" : "Category",
      price: isArabic ? "السعر" : "Price",
      offer: isArabic ? "العرض" : "Offer",
      visibility: isArabic ? "الظهور" : "Visibility",
      readiness: isArabic ? "الجاهزية" : "Readiness",
      status: isArabic ? "الحالة" : "Status",
      updated: isArabic ? "آخر تحديث" : "Updated",
      actions: isArabic ? "الإجراءات" : "Actions",
      code: isArabic ? "الكود" : "Code",
    },

    columnLabels: {
      image: isArabic ? "الصورة" : "Image",
      product: isArabic ? "المنتج" : "Product",
      provider: isArabic ? "مقدم الخدمة" : "Provider",
      type: isArabic ? "النوع" : "Type",
      category: isArabic ? "التصنيف" : "Category",
      price: isArabic ? "السعر" : "Price",
      offer: isArabic ? "العرض" : "Offer",
      visibility: isArabic ? "الظهور" : "Visibility",
      readiness: isArabic ? "الجاهزية" : "Readiness",
      status: isArabic ? "الحالة" : "Status",
      updated: isArabic ? "آخر تحديث" : "Updated",
      actions: isArabic ? "الإجراءات" : "Actions",
    } satisfies Record<keyof VisibleColumns, string>,

    printedAt: isArabic ? "تاريخ الطباعة" : "Printed At",
  };
}

/* ============================================================
   UI Helpers
============================================================ */

function formatNumber(value: number | string): string {
  const number = Number(value);

  if (!Number.isFinite(number)) return "0";

  return number.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

function formatMoney(value: number | string): string {
  const number = Number(value);

  if (!Number.isFinite(number)) return "0.00";

  return number.toLocaleString("en-US", {
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

function productTypeIcon(type: ProductType): ComponentType<{ className?: string }> {
  if (type === "card") return BadgeCheck;
  if (type === "membership") return Tag;
  if (type === "program") return Boxes;
  if (type === "service") return Stethoscope;

  return Package;
}

function statusBadge(status: ProductStatus, t: ReturnType<typeof dictionary>) {
  if (status === "active") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
        {t.status.active}
      </Badge>
    );
  }

  if (status === "draft") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">
        {t.status.draft}
      </Badge>
    );
  }

  if (status === "archived") {
    return (
      <Badge className="rounded-full border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-50">
        {t.status.archived}
      </Badge>
    );
  }

  if (status === "inactive") {
    return <Badge variant="outline" className="rounded-full">{t.status.inactive}</Badge>;
  }

  return <Badge variant="secondary" className="rounded-full">{t.status.UNKNOWN}</Badge>;
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

function providerLabel(provider: ProviderSummary | null, locale: AppLocale) {
  if (!provider) return "";

  const primary =
    locale === "ar"
      ? provider.name_ar || provider.name || provider.name_en
      : provider.name_en || provider.name || provider.name_ar;

  const code = provider.code ? ` - ${provider.code}` : "";

  return `${primary || provider.id || ""}${code}`;
}

function optionLabel(option: SelectOption, locale: AppLocale) {
  const primary =
    locale === "ar"
      ? option.name_ar || option.name || option.title || option.name_en
      : option.name_en || option.name || option.title || option.name_ar;

  const code = option.code ? ` - ${option.code}` : "";

  return `${primary || option.id}${code}`;
}

function visibilityBadge(active: boolean, label: string) {
  return (
    <Badge variant={active ? "secondary" : "outline"} className="rounded-full">
      {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {label}
    </Badge>
  );
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <SkeletonLine className="h-7 w-16" />
            <SkeletonLine className="h-4 w-28" />
          </div>
          <SkeletonLine className="h-10 w-10 rounded-xl" />
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

function downloadExcel({
  filename,
  worksheetName,
  title,
  locale,
  summaryRows,
  filterRows,
  headers,
  rows,
}: {
  filename: string;
  worksheetName: string;
  title: string;
  locale: AppLocale;
  summaryRows: Array<[string, string | number]>;
  filterRows: Array<[string, string | number]>;
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  const dir = locale === "ar" ? "rtl" : "ltr";

  const html = `
    <html dir="${dir}">
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; width: 100%; font-family: Arial, Tahoma, sans-serif; }
          th, td { border: 1px solid #d1d5db; padding: 8px; text-align: ${locale === "ar" ? "right" : "left"}; }
          th { background: #f3f4f6; font-weight: 700; }
          .title { font-size: 18px; font-weight: 800; background: #ede9fe; }
          .section { background: #f9fafb; font-weight: 700; }
        </style>
      </head>
      <body>
        <table>
          <tr><th class="title" colspan="${headers.length}">${escapeHtml(title)}</th></tr>
          <tr><th class="section" colspan="${headers.length}">${escapeHtml(worksheetName)}</th></tr>
          ${summaryRows
            .map(
              ([key, value]) =>
                `<tr><td>${escapeHtml(key)}</td><td colspan="${headers.length - 1}">${escapeHtml(value)}</td></tr>`,
            )
            .join("")}
          <tr><th class="section" colspan="${headers.length}">Filters</th></tr>
          ${filterRows
            .map(
              ([key, value]) =>
                `<tr><td>${escapeHtml(key)}</td><td colspan="${headers.length - 1}">${escapeHtml(value)}</td></tr>`,
            )
            .join("")}
          <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
          ${rows
            .map(
              (row) =>
                `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`,
            )
            .join("")}
        </table>
      </body>
    </html>
  `;

  const blob = new Blob(["\ufeff", html], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

function buildPrintHtml({
  locale,
  title,
  printedAt,
  headers,
  rows,
  emptyTitle,
}: {
  locale: AppLocale;
  title: string;
  printedAt: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  emptyTitle: string;
}) {
  const isArabic = locale === "ar";

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
            background: #fff;
            direction: ${isArabic ? "rtl" : "ltr"};
            text-align: ${isArabic ? "right" : "left"};
          }
          .header {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            align-items: flex-start;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 14px;
            margin-bottom: 18px;
          }
          h1 { margin: 0; font-size: 22px; }
          .meta { font-size: 12px; color: #6b7280; margin-top: 6px; }
          table { width: 100%; border-collapse: collapse; }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 9px 10px;
            font-size: 12px;
            vertical-align: top;
          }
          th { background: #f9fafb; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>${escapeHtml(title)}</h1>
            <div class="meta">${escapeHtml(printedAt)}</div>
          </div>
          <div class="meta">Primey Care</div>
        </div>

        <table>
          <thead>
            <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${
              rows.length > 0
                ? rows
                    .map(
                      (row) =>
                        `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`,
                    )
                    .join("")
                : `<tr><td colspan="${headers.length}">${escapeHtml(emptyTitle)}</td></tr>`
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

export default function SystemProductsListPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    page_size: PAGE_SIZE,
    total_pages: 1,
    total_items: 0,
    has_next: false,
    has_previous: false,
  });

  const [providers, setProviders] = useState<SelectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLookups, setIsLoadingLookups] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [offerFilter, setOfferFilter] = useState<OfferFilter>("all");
  const [landingFilter, setLandingFilter] = useState<VisibilityFilter>("all");
  const [mobileFilter, setMobileFilter] = useState<VisibilityFilter>("all");
  const [offersFilter, setOffersFilter] = useState<VisibilityFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("-created_at");
  const [pageIndex, setPageIndex] = useState(1);

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    image: true,
    product: true,
    provider: true,
    type: true,
    category: true,
    price: true,
    offer: true,
    visibility: true,
    readiness: true,
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

  const visibleTableColumnsCount =
    Object.values(safeVisibleColumns).filter(Boolean).length || 1;

  const stats = useMemo(() => {
    return {
      total: pagination.total_items,
      active: products.filter((item) => item.status === "active").length,
      offers: products.filter((item) => item.isOffer).length,
      landing: products.filter((item) => item.showOnLanding).length,
      mobile: products.filter((item) => item.showOnMobile).length,
      marketingImages: products.filter((item) => item.hasMarketingImage).length,
    };
  }, [pagination.total_items, products]);

  const hasSearchOrFilter =
    debouncedQuery.trim().length > 0 ||
    statusFilter !== "all" ||
    typeFilter !== "all" ||
    providerFilter !== "all" ||
    offerFilter !== "all" ||
    landingFilter !== "all" ||
    mobileFilter !== "all" ||
    offersFilter !== "all";

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    params.set("page", String(pageIndex));
    params.set("page_size", String(PAGE_SIZE));
    params.set("include_children", "false");
    params.set("ordering", sortKey);

    if (debouncedQuery.trim()) {
      params.set("q", debouncedQuery.trim());
    }

    if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }

    if (typeFilter !== "all") {
      params.set("product_type", typeFilter);
    }

    if (providerFilter !== "all") {
      params.set("provider_id", providerFilter);
    }

    if (offerFilter === "offer") {
      params.set("is_offer", "true");
    }

    if (offerFilter === "not_offer") {
      params.set("is_offer", "false");
    }

    if (landingFilter !== "all") {
      params.set("show_on_landing", landingFilter === "yes" ? "true" : "false");
    }

    if (mobileFilter !== "all") {
      params.set("show_on_mobile", mobileFilter === "yes" ? "true" : "false");
    }

    if (offersFilter !== "all") {
      params.set("show_on_offers", offersFilter === "yes" ? "true" : "false");
    }

    return params.toString();
  }, [
    debouncedQuery,
    landingFilter,
    mobileFilter,
    offerFilter,
    offersFilter,
    pageIndex,
    providerFilter,
    sortKey,
    statusFilter,
    typeFilter,
  ]);

  const exportRows = products;

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

        const response = await fetch(apiUrl(`/api/products/?${queryString}`), {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        const payload = (await response.json().catch(() => null)) as ProductsApiResponse | null;

        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.message || `HTTP ${response.status}`);
        }

        const nextProducts = extractProducts(payload).map(normalizeProduct);
        const nextPagination = payload?.pagination || {};

        setProducts(nextProducts);
        setPagination({
          page: Number(nextPagination.page || pageIndex),
          page_size: Number(nextPagination.page_size || PAGE_SIZE),
          total_pages: Math.max(1, Number(nextPagination.total_pages || 1)),
          total_items: Number(nextPagination.total_items || nextProducts.length),
          has_next: Boolean(nextPagination.has_next),
          has_previous: Boolean(nextPagination.has_previous),
        });

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
    [canViewProducts, pageIndex, queryString, t.loadError, t.refreshSuccess],
  );

  const loadLookups = useCallback(async () => {
    try {
      setIsLoadingLookups(true);

      const response = await fetch(apiUrl("/api/providers/?page=1&page_size=100&ordering=name"), {
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      if (response.ok) {
        const payload = (await response.json().catch(() => ({}))) as ListApiResponse<SelectOption>;
        setProviders(extractList(payload));
      }
    } catch (error) {
      console.error("Load product list lookups error:", error);
    } finally {
      setIsLoadingLookups(false);
    }
  }, []);

  function clearFilters() {
    setQuery("");
    setDebouncedQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
    setProviderFilter("all");
    setOfferFilter("all");
    setLandingFilter("all");
    setMobileFilter("all");
    setOffersFilter("all");
    setSortKey("-created_at");
    setPageIndex(1);
  }

  function exportExcel() {
    if (!canExportProducts) return;

    if (exportRows.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const generatedAt = new Date();

    downloadExcel({
      filename: `primey-care-products-list-${generatedAt.toISOString().slice(0, 10)}.xls`,
      worksheetName: isArabic ? "قائمة المنتجات" : "Products List",
      title: t.title,
      locale,
      summaryRows: [
        [t.generatedAt, generatedAt.toLocaleString("en-US")],
        [t.reportScope, t.currentPage],
        [t.totalProducts, pagination.total_items],
        [t.rows, products.length],
        [t.activeProducts, stats.active],
        [t.offersProducts, stats.offers],
        [t.landingProducts, stats.landing],
        [t.mobileProducts, stats.mobile],
      ],
      filterRows: [
        [t.filterSearch, debouncedQuery || t.all],
        [t.filterStatus, statusFilter === "all" ? t.status.all : t.status[statusFilter]],
        [t.filterType, typeFilter === "all" ? t.type.all : t.type[typeFilter]],
        [
          t.filterProvider,
          providerFilter === "all"
            ? t.all
            : optionLabel(
                providers.find((item) => String(item.id) === providerFilter) || {
                  id: providerFilter,
                },
                locale,
              ),
        ],
        [t.filterOffer, t.offerFilter[offerFilter]],
        [t.filterLanding, t.visibilityFilter[landingFilter]],
        [t.filterMobile, t.visibilityFilter[mobileFilter]],
        [t.filterOffers, t.visibilityFilter[offersFilter]],
        [t.filterSort, t.sortOptions[sortKey]],
      ],
      headers: [
        t.table.code,
        t.table.product,
        t.table.provider,
        t.table.type,
        t.table.category,
        t.table.price,
        t.table.offer,
        t.table.visibility,
        t.table.status,
        t.table.updated,
      ],
      rows: exportRows.map((product) => [
        product.code,
        product.name,
        providerLabel(product.provider, locale) || t.noProvider,
        t.type[product.productType],
        product.categoryName || "-",
        formatMoney(product.effectivePrice),
        product.isOffer ? t.yes : t.no,
        [
          product.showOnLanding ? t.filterLanding : "",
          product.showOnMobile ? t.filterMobile : "",
          product.showOnOffers ? t.filterOffers : "",
        ].filter(Boolean).join(" / ") || "-",
        t.status[product.status],
        formatDate(product.updatedAt),
      ]),
    });
  }

  function printList() {
    if (!canPrintProducts) return;

    if (products.length === 0) {
      toast.error(t.printEmpty);
      return;
    }

    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) {
      toast.error(t.printError);
      return;
    }

    const html = buildPrintHtml({
      locale,
      title: t.title,
      printedAt: `${t.printedAt}: ${new Date().toLocaleString("en-US")}`,
      emptyTitle: t.emptyTitle,
      headers: [
        t.table.code,
        t.table.product,
        t.table.provider,
        t.table.type,
        t.table.price,
        t.table.offer,
        t.table.status,
      ],
      rows: products.map((product) => [
        product.code,
        product.name,
        providerLabel(product.provider, locale) || t.noProvider,
        t.type[product.productType],
        formatMoney(product.effectivePrice),
        product.isOffer ? t.yes : t.no,
        t.status[product.status],
      ]),
    });

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    toast.success(t.printReady);
  }

  useEffect(() => {
    const nextLocale = readLocale();

    setLocale(nextLocale);
    applyDocumentLocale(nextLocale);
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query);
      setPageIndex(1);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  if (authResolving) {
    return (
      <div className="w-full space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <StatCardSkeleton key={index} />
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <SkeletonLine className="h-10 w-full rounded-xl" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canViewProducts) {
    return (
      <div className="w-full space-y-4">
        <Card className="border-destructive/20">
          <CardContent className="flex flex-col items-center justify-center gap-4 p-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <ShieldCheck className="h-7 w-7 text-destructive" />
            </div>

            <div>
              <h2 className="text-lg font-semibold">{t.accessDeniedTitle}</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                {t.accessDeniedText}
              </p>
            </div>

            <Button asChild variant="outline">
              <Link href="/system/products">
                <ArrowLeft className="me-2 h-4 w-4" />
                {t.back}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statCards = [
    {
      label: t.totalProducts,
      value: pagination.total_items,
      icon: Package,
    },
    {
      label: t.activeProducts,
      value: stats.active,
      icon: CheckCircle2,
    },
    {
      label: t.offersProducts,
      value: stats.offers,
      icon: Sparkles,
    },
    {
      label: t.landingProducts,
      value: stats.landing,
      icon: Globe2,
    },
    {
      label: t.mobileProducts,
      value: stats.mobile,
      icon: Smartphone,
    },
    {
      label: t.marketingImages,
      value: stats.marketingImages,
      icon: FileImage,
    },
  ];

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/system/products">
              <ArrowLeft className="me-2 h-4 w-4" />
              {t.back}
            </Link>
          </Button>

          <Button type="button" variant="outline" onClick={() => loadProducts(true)}>
            <RefreshCcw className="me-2 h-4 w-4" />
            {t.refresh}
          </Button>

          {canExportProducts ? (
            <Button type="button" variant="outline" onClick={exportExcel}>
              <FileSpreadsheet className="me-2 h-4 w-4" />
              {t.exportExcel}
            </Button>
          ) : null}

          {canPrintProducts ? (
            <Button type="button" variant="outline" onClick={printList}>
              <Printer className="me-2 h-4 w-4" />
              {t.print}
            </Button>
          ) : null}

          {canCreateProducts ? (
            <Button asChild>
              <Link href="/system/products/create">
                <Plus className="me-2 h-4 w-4" />
                {t.create}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {statCards.map((card) => {
          const Icon = card.icon;

          return (
            <Card key={card.label}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-2xl font-bold">{formatNumber(card.value)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{card.label}</p>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              placeholder={t.searchPlaceholder}
              className="ps-10"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="grid flex-1 gap-2 md:grid-cols-2 xl:grid-cols-8">
              <select
                value={statusFilter}
                className="h-10 rounded-md border bg-background px-3 text-sm"
                onChange={(event) => {
                  setStatusFilter(event.target.value as StatusFilter);
                  setPageIndex(1);
                }}
              >
                <option value="all">{t.status.all}</option>
                <option value="active">{t.status.active}</option>
                <option value="draft">{t.status.draft}</option>
                <option value="inactive">{t.status.inactive}</option>
                <option value="archived">{t.status.archived}</option>
              </select>

              <select
                value={typeFilter}
                className="h-10 rounded-md border bg-background px-3 text-sm"
                onChange={(event) => {
                  setTypeFilter(event.target.value as TypeFilter);
                  setPageIndex(1);
                }}
              >
                <option value="all">{t.type.all}</option>
                <option value="membership">{t.type.membership}</option>
                <option value="card">{t.type.card}</option>
                <option value="program">{t.type.program}</option>
                <option value="service">{t.type.service}</option>
                <option value="other">{t.type.other}</option>
              </select>

              <select
                value={providerFilter}
                disabled={isLoadingLookups}
                className="h-10 rounded-md border bg-background px-3 text-sm"
                onChange={(event) => {
                  setProviderFilter(event.target.value);
                  setPageIndex(1);
                }}
              >
                <option value="all">{t.filterProvider}</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {optionLabel(provider, locale)}
                  </option>
                ))}
              </select>

              <select
                value={offerFilter}
                className="h-10 rounded-md border bg-background px-3 text-sm"
                onChange={(event) => {
                  setOfferFilter(event.target.value as OfferFilter);
                  setPageIndex(1);
                }}
              >
                <option value="all">{t.offerFilter.all}</option>
                <option value="offer">{t.offerFilter.offer}</option>
                <option value="not_offer">{t.offerFilter.not_offer}</option>
              </select>

              <select
                value={landingFilter}
                className="h-10 rounded-md border bg-background px-3 text-sm"
                onChange={(event) => {
                  setLandingFilter(event.target.value as VisibilityFilter);
                  setPageIndex(1);
                }}
              >
                <option value="all">{t.filterLanding}</option>
                <option value="yes">{t.visibilityFilter.yes}</option>
                <option value="no">{t.visibilityFilter.no}</option>
              </select>

              <select
                value={mobileFilter}
                className="h-10 rounded-md border bg-background px-3 text-sm"
                onChange={(event) => {
                  setMobileFilter(event.target.value as VisibilityFilter);
                  setPageIndex(1);
                }}
              >
                <option value="all">{t.filterMobile}</option>
                <option value="yes">{t.visibilityFilter.yes}</option>
                <option value="no">{t.visibilityFilter.no}</option>
              </select>

              <select
                value={offersFilter}
                className="h-10 rounded-md border bg-background px-3 text-sm"
                onChange={(event) => {
                  setOffersFilter(event.target.value as VisibilityFilter);
                  setPageIndex(1);
                }}
              >
                <option value="all">{t.filterOffers}</option>
                <option value="yes">{t.visibilityFilter.yes}</option>
                <option value="no">{t.visibilityFilter.no}</option>
              </select>

              <select
                value={sortKey}
                className="h-10 rounded-md border bg-background px-3 text-sm"
                onChange={(event) => {
                  setSortKey(event.target.value as SortKey);
                  setPageIndex(1);
                }}
              >
                {Object.entries(t.sortOptions).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={clearFilters}>
                <XCircle className="me-2 h-4 w-4" />
                {t.clearFilters}
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border bg-background p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Columns3 className="h-4 w-4" />
              {t.columns}
            </div>

            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
              {Object.entries(t.columnLabels).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 rounded-xl border p-2 text-sm">
                  <Checkbox
                    checked={visibleColumns[key as keyof VisibleColumns]}
                    onCheckedChange={(value) =>
                      setVisibleColumns((current) => ({
                        ...current,
                        [key]: Boolean(value),
                      }))
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {errorMessage ? (
        <Card className="border-destructive/20">
          <CardContent className="flex flex-col items-center justify-center gap-4 p-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>

            <div>
              <h2 className="text-lg font-semibold">{errorMessage}</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                {t.loadErrorHint}
              </p>
            </div>

            <Button type="button" onClick={() => loadProducts(true)}>
              <RefreshCcw className="me-2 h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t.title}</CardTitle>
            <CardDescription>
              {t.page} {formatNumber(pagination.page)} {t.of}{" "}
              {formatNumber(pagination.total_pages)} — {formatNumber(pagination.total_items)}{" "}
              {t.rows}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {safeVisibleColumns.image ? <TableHead>{t.table.image}</TableHead> : null}
                    {safeVisibleColumns.product ? <TableHead>{t.table.product}</TableHead> : null}
                    {safeVisibleColumns.provider ? <TableHead>{t.table.provider}</TableHead> : null}
                    {safeVisibleColumns.type ? <TableHead>{t.table.type}</TableHead> : null}
                    {safeVisibleColumns.category ? <TableHead>{t.table.category}</TableHead> : null}
                    {safeVisibleColumns.price ? <TableHead>{t.table.price}</TableHead> : null}
                    {safeVisibleColumns.offer ? <TableHead>{t.table.offer}</TableHead> : null}
                    {safeVisibleColumns.visibility ? <TableHead>{t.table.visibility}</TableHead> : null}
                    {safeVisibleColumns.readiness ? <TableHead>{t.table.readiness}</TableHead> : null}
                    {safeVisibleColumns.status ? <TableHead>{t.table.status}</TableHead> : null}
                    {safeVisibleColumns.updated ? <TableHead>{t.table.updated}</TableHead> : null}
                    {safeVisibleColumns.actions ? <TableHead>{t.table.actions}</TableHead> : null}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading ? (
                    <TableRowsSkeleton columnsCount={visibleTableColumnsCount} />
                  ) : products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={visibleTableColumnsCount} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                            <Package className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-semibold">
                              {hasSearchOrFilter ? t.emptyTitle : t.emptyDefaultTitle}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {hasSearchOrFilter ? t.emptyText : t.emptyDefaultText}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    products.map((product) => {
                      const Icon = productTypeIcon(product.productType);
                      const imageSrc = product.thumbnailImageUrl || product.marketingImageUrl;

                      return (
                        <TableRow key={product.id}>
                          {safeVisibleColumns.image ? (
                            <TableCell>
                              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border bg-muted">
                                {imageSrc ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={imageSrc}
                                    alt={product.name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                                )}
                              </div>
                            </TableCell>
                          ) : null}

                          {safeVisibleColumns.product ? (
                            <TableCell>
                              <div className="min-w-[220px]">
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-semibold">{product.name}</span>
                                </div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  <Badge variant="outline" className="rounded-full">
                                    {product.code}
                                  </Badge>
                                  {product.isFeatured ? (
                                    <Badge variant="secondary" className="rounded-full">
                                      {t.table.offer}
                                    </Badge>
                                  ) : null}
                                </div>
                                {product.shortDescription ? (
                                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                                    {product.shortDescription}
                                  </p>
                                ) : null}
                              </div>
                            </TableCell>
                          ) : null}

                          {safeVisibleColumns.provider ? (
                            <TableCell>
                              <span className="text-sm">
                                {providerLabel(product.provider, locale) || t.noProvider}
                              </span>
                            </TableCell>
                          ) : null}

                          {safeVisibleColumns.type ? (
                            <TableCell>
                              <Badge variant="secondary" className="rounded-full">
                                {t.type[product.productType]}
                              </Badge>
                            </TableCell>
                          ) : null}

                          {safeVisibleColumns.category ? (
                            <TableCell>{product.categoryName || "-"}</TableCell>
                          ) : null}

                          {safeVisibleColumns.price ? (
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-semibold">
                                  <SarAmount value={product.effectivePrice} />
                                </p>
                                {product.salePrice > 0 ? (
                                  <p className="text-xs text-muted-foreground">
                                    <SarAmount value={product.price} />
                                  </p>
                                ) : null}
                              </div>
                            </TableCell>
                          ) : null}

                          {safeVisibleColumns.offer ? (
                            <TableCell>
                              <div className="space-y-1">
                                {visibilityBadge(product.isOffer, t.table.offer)}
                                {product.offerTitle ? (
                                  <p className="line-clamp-1 text-xs text-muted-foreground">
                                    {product.offerTitle}
                                  </p>
                                ) : null}
                                {(product.offerStartDate || product.offerEndDate) ? (
                                  <p className="text-xs text-muted-foreground">
                                    {product.offerStartDate || "-"} / {product.offerEndDate || "-"}
                                  </p>
                                ) : null}
                              </div>
                            </TableCell>
                          ) : null}

                          {safeVisibleColumns.visibility ? (
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {visibilityBadge(product.showOnLanding, t.filterLanding)}
                                {visibilityBadge(product.showOnMobile, t.filterMobile)}
                                {visibilityBadge(product.showOnOffers, t.filterOffers)}
                              </div>
                            </TableCell>
                          ) : null}

                          {safeVisibleColumns.readiness ? (
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {visibilityBadge(product.canBeOrdered, t.table.readiness)}
                                {visibilityBadge(product.canBeUsedInContracts, t.filterOffer)}
                              </div>
                            </TableCell>
                          ) : null}

                          {safeVisibleColumns.status ? (
                            <TableCell>{statusBadge(product.status, t)}</TableCell>
                          ) : null}

                          {safeVisibleColumns.updated ? (
                            <TableCell>{formatDate(product.updatedAt)}</TableCell>
                          ) : null}

                          {safeVisibleColumns.actions ? (
                            <TableCell>
                              <Button asChild variant="outline" size="sm">
                                <Link href={`/system/products/${product.id}`}>
                                  <Eye className="me-2 h-4 w-4" />
                                  {t.details}
                                </Link>
                              </Button>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 border-t p-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted-foreground">
                {t.page} {formatNumber(pagination.page)} {t.of}{" "}
                {formatNumber(pagination.total_pages)}
              </p>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!pagination.has_previous || isLoading}
                  onClick={() => setPageIndex((current) => Math.max(1, current - 1))}
                >
                  <ChevronRight className="me-2 h-4 w-4" />
                  {isArabic ? "السابق" : "Previous"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  disabled={!pagination.has_next || isLoading}
                  onClick={() => setPageIndex((current) => current + 1)}
                >
                  {isArabic ? "التالي" : "Next"}
                  <ChevronLeft className="ms-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}