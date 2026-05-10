"use client";

/* ============================================================
   📂 app/system/products/page.tsx
   🧠 Primey Care | Products Overview
   ------------------------------------------------------------
   ✅ لوحة المنتجات والبرامج والعروض الطبية
   ✅ KPIs خفيفة من Server Pagination
   ✅ دعم مقدم الخدمة + الصور + الهبوط + التطبيق + العروض
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
  ArrowUpRight,
  BadgeCheck,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
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

type ProviderSummary = {
  id?: string | number | null;
  code?: string | null;
  name?: string | null;
  name_ar?: string | null;
  name_en?: string | null;
  city?: string | null;
  region?: string | null;
  logo_url?: string | null;
};

type ProductRow = {
  id: string | number;
  code: string;
  name: string;
  productType: ProductType;
  categoryName: string;
  provider: ProviderSummary | null;
  status: ProductStatus;
  shortDescription: string;
  price: number;
  salePrice: number;
  effectivePrice: number;
  isOffer: boolean;
  offerTitle: string;
  offerStartDate: string;
  offerEndDate: string;
  showOnLanding: boolean;
  showOnMobile: boolean;
  showOnOffers: boolean;
  isPublic: boolean;
  isFeatured: boolean;
  canBeOrdered: boolean;
  canBeUsedInContracts: boolean;
  thumbnailImageUrl: string;
  marketingImageUrl: string;
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

type SummaryState = {
  total: number;
  active: number;
  offers: number;
  landing: number;
  mobile: number;
  marketingImages: number;
};

const SAR_ICON_PATH = "/currency/sar.svg";
const PAGE_SIZE = 12;

const DEFAULT_SUMMARY: SummaryState = {
  total: 0,
  active: 0,
  offers: 0,
  landing: 0,
  mobile: 0,
  marketingImages: 0,
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

function extractRows(payload: ProductsApiResponse | null): unknown[] {
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

function extractTotal(payload: ProductsApiResponse | null) {
  return Number(payload?.pagination?.total_items || extractRows(payload).length || 0);
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

function normalizeProvider(value: unknown): ProviderSummary | null {
  if (!value || typeof value !== "object") return null;

  const obj = value as Record<string, unknown>;

  return {
    id: (obj.id as string | number | null) || null,
    code: String(obj.code || ""),
    name: String(obj.name || ""),
    name_ar: String(obj.name_ar || ""),
    name_en: String(obj.name_en || ""),
    city: String(obj.city || ""),
    region: String(obj.region || ""),
    logo_url: String(obj.logo_url || ""),
  };
}

function normalizeProduct(item: unknown): ProductRow {
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
    productType: normalizeType(getValue(obj, "product_type")),
    categoryName: String(category?.name || getValue(obj, "category_name") || ""),
    provider,
    status: normalizeStatus(getValue(obj, "status")),
    shortDescription: String(getValue(obj, "short_description") || ""),
    price,
    salePrice,
    effectivePrice,
    isOffer: Boolean(getValue(obj, "is_offer")),
    offerTitle: String(getValue(obj, "offer_title") || ""),
    offerStartDate: String(getValue(obj, "offer_start_date") || ""),
    offerEndDate: String(getValue(obj, "offer_end_date") || ""),
    showOnLanding: Boolean(getValue(obj, "show_on_landing")),
    showOnMobile: Boolean(getValue(obj, "show_on_mobile")),
    showOnOffers: Boolean(getValue(obj, "show_on_offers")),
    isPublic: Boolean(getValue(obj, "is_public")),
    isFeatured: Boolean(getValue(obj, "is_featured")),
    canBeOrdered: Boolean(getValue(obj, "can_be_ordered")),
    canBeUsedInContracts: Boolean(getValue(obj, "can_be_used_in_contracts")),
    thumbnailImageUrl,
    marketingImageUrl,
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
    title: isArabic ? "المنتجات والبرامج" : "Products & Programs",
    subtitle: isArabic
      ? "لوحة متابعة المنتجات والبرامج والعروض الطبية والصور التسويقية."
      : "Overview for products, programs, medical offers, and marketing images.",

    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    productsList: isArabic ? "قائمة المنتجات" : "Products List",
    createProduct: isArabic ? "إنشاء منتج" : "Create Product",
    view: isArabic ? "عرض" : "View",

    totalProducts: isArabic ? "إجمالي المنتجات" : "Total Products",
    activeProducts: isArabic ? "المنتجات النشطة" : "Active Products",
    offersProducts: isArabic ? "العروض الطبية" : "Medical Offers",
    landingProducts: isArabic ? "تظهر في الهبوط" : "Landing Visible",
    mobileProducts: isArabic ? "تظهر في التطبيق" : "Mobile Visible",
    marketingImages: isArabic ? "لديها صورة تسويقية" : "Marketing Images",

    shortcutsTitle: isArabic ? "اختصارات المنتجات" : "Product Shortcuts",
    shortcutsDesc: isArabic
      ? "انتقل لقائمة المنتجات أو أضف منتجًا أو عرضًا طبيًا جديدًا."
      : "Open the products list or add a new product or medical offer.",

    latestTitle: isArabic ? "أحدث المنتجات والعروض" : "Latest Products & Offers",
    latestDesc: isArabic
      ? "آخر المنتجات والبرامج والعروض مع مقدم الخدمة والصورة التسويقية."
      : "Latest products, programs, and offers with provider and marketing image.",

    searchPlaceholder: isArabic
      ? "ابحث باسم المنتج أو الكود أو مقدم الخدمة..."
      : "Search by product, code, or provider...",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض المنتجات" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض المنتجات. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view products. Contact your system administrator if you need access.",

    loadError: isArabic ? "تعذر تحميل بيانات المنتجات." : "Unable to load products.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    loadSuccess: isArabic ? "تم تحديث بيانات المنتجات." : "Products refreshed.",

    exportSuccess: isArabic ? "تم تجهيز ملف Excel." : "Excel file prepared.",
    exportEmpty: isArabic ? "لا توجد بيانات قابلة للتصدير." : "No data available to export.",
    printSuccess: isArabic ? "تم تجهيز نافذة الطباعة." : "Print window prepared.",
    printError: isArabic ? "تعذر فتح نافذة الطباعة." : "Unable to open print window.",

    emptyTitle: isArabic ? "لا توجد منتجات بعد" : "No products yet",
    emptyText: isArabic
      ? "ابدأ بإنشاء منتج أو برنامج أو عرض طبي جديد."
      : "Start by creating a product, program, or medical offer.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "غيّر كلمات البحث لعرض نتائج أخرى."
      : "Change your search terms to see other results.",

    noProvider: isArabic ? "بدون مقدم خدمة" : "No Provider",
    yes: isArabic ? "نعم" : "Yes",
    no: isArabic ? "لا" : "No",

    table: {
      image: isArabic ? "الصورة" : "Image",
      product: isArabic ? "المنتج" : "Product",
      code: isArabic ? "الكود" : "Code",
      provider: isArabic ? "مقدم الخدمة" : "Provider",
      type: isArabic ? "النوع" : "Type",
      category: isArabic ? "التصنيف" : "Category",
      price: isArabic ? "السعر" : "Price",
      offer: isArabic ? "العرض" : "Offer",
      visibility: isArabic ? "الظهور" : "Visibility",
      status: isArabic ? "الحالة" : "Status",
      action: isArabic ? "الإجراء" : "Action",
    },

    status: {
      active: isArabic ? "نشط" : "Active",
      draft: isArabic ? "مسودة" : "Draft",
      inactive: isArabic ? "غير نشط" : "Inactive",
      archived: isArabic ? "مؤرشف" : "Archived",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    },

    type: {
      membership: isArabic ? "عضوية" : "Membership",
      card: isArabic ? "بطاقة" : "Card",
      program: isArabic ? "برنامج" : "Program",
      service: isArabic ? "خدمة" : "Service",
      other: isArabic ? "أخرى" : "Other",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    },

    flags: {
      public: isArabic ? "عام" : "Public",
      featured: isArabic ? "مميز" : "Featured",
      order: isArabic ? "طلب" : "Order",
      contract: isArabic ? "عقود" : "Contracts",
      landing: isArabic ? "هبوط" : "Landing",
      mobile: isArabic ? "تطبيق" : "Mobile",
      offers: isArabic ? "عروض" : "Offers",
      image: isArabic ? "صورة" : "Image",
    },

    generatedAt: isArabic ? "تاريخ التصدير" : "Generated At",
    printedAt: isArabic ? "تاريخ الطباعة" : "Printed At",
  };
}

/* ============================================================
   UI Helpers
============================================================ */

function formatNumber(value: unknown): string {
  const number = Number(value);

  if (!Number.isFinite(number)) return "0";

  return number.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

function formatMoney(value: unknown): string {
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
  if (type === "card") return CreditCard;
  if (type === "membership") return BadgeCheck;
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
    return (
      <Badge variant="outline" className="rounded-full">
        {t.status.inactive}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="rounded-full">
      {t.status.UNKNOWN}
    </Badge>
  );
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

function flagBadge(active: boolean, label: string) {
  return (
    <Badge variant={active ? "secondary" : "outline"} className="rounded-full">
      {active ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <XCircle className="h-3.5 w-3.5" />
      )}
      {label}
    </Badge>
  );
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function PageSkeleton() {
  return (
    <div className="w-full space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <SkeletonLine className="h-7 w-16" />
              <SkeletonLine className="mt-3 h-4 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-5">
          <SkeletonLine className="h-10 w-full rounded-xl" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          {Array.from({ length: 8 }).map((_, index) => (
            <SkeletonLine key={index} className="h-12 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ============================================================
   Export / Print
============================================================ */

function downloadExcel({
  filename,
  title,
  locale,
  summary,
  rows,
}: {
  filename: string;
  title: string;
  locale: AppLocale;
  summary: SummaryState;
  rows: ProductRow[];
}) {
  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const align = isArabic ? "right" : "left";
  const t = dictionary(locale);

  const rowsHtml = rows
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.code)}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(providerLabel(item.provider, locale) || t.noProvider)}</td>
          <td>${escapeHtml(t.type[item.productType])}</td>
          <td>${escapeHtml(item.categoryName || "-")}</td>
          <td>${escapeHtml(formatMoney(item.effectivePrice))}</td>
          <td>${escapeHtml(item.isOffer ? t.yes : t.no)}</td>
          <td>${escapeHtml(item.showOnLanding ? t.yes : t.no)}</td>
          <td>${escapeHtml(item.showOnMobile ? t.yes : t.no)}</td>
          <td>${escapeHtml(item.showOnOffers ? t.yes : t.no)}</td>
          <td>${escapeHtml(t.status[item.status])}</td>
        </tr>`,
    )
    .join("");

  const workbook = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8" />
        <style>
          body { direction: ${dir}; font-family: Arial, Tahoma, sans-serif; }
          table { border-collapse: collapse; width: 100%; }
          th, td {
            border: 1px solid #d9e2ef;
            padding: 8px;
            text-align: ${align};
            vertical-align: top;
            mso-number-format: "\\@";
          }
          th { background: #d8ecfb; font-weight: 700; }
          .title { font-size: 20px; font-weight: 700; text-align: center; background: #fff; }
          .section { font-weight: 700; background: #eef6ff; }
          .summary-label { font-weight: 700; background: #f8fafc; width: 240px; }
        </style>
      </head>
      <body dir="${dir}">
        <table>
          <tr><td class="title" colspan="11">${escapeHtml(title)}</td></tr>
          <tr><td colspan="11"></td></tr>
          <tr><td class="section" colspan="11">${escapeHtml(t.generatedAt)}: ${escapeHtml(new Date().toLocaleString("en-US"))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalProducts)}</td><td colspan="10">${escapeHtml(formatNumber(summary.total))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.activeProducts)}</td><td colspan="10">${escapeHtml(formatNumber(summary.active))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.offersProducts)}</td><td colspan="10">${escapeHtml(formatNumber(summary.offers))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.landingProducts)}</td><td colspan="10">${escapeHtml(formatNumber(summary.landing))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.mobileProducts)}</td><td colspan="10">${escapeHtml(formatNumber(summary.mobile))}</td></tr>

          <tr><td colspan="11"></td></tr>
          <tr>
            <th>${escapeHtml(t.table.code)}</th>
            <th>${escapeHtml(t.table.product)}</th>
            <th>${escapeHtml(t.table.provider)}</th>
            <th>${escapeHtml(t.table.type)}</th>
            <th>${escapeHtml(t.table.category)}</th>
            <th>${escapeHtml(t.table.price)}</th>
            <th>${escapeHtml(t.table.offer)}</th>
            <th>${escapeHtml(t.flags.landing)}</th>
            <th>${escapeHtml(t.flags.mobile)}</th>
            <th>${escapeHtml(t.flags.offers)}</th>
            <th>${escapeHtml(t.table.status)}</th>
          </tr>
          ${rowsHtml}
        </table>
      </body>
    </html>`;

  const blob = new Blob(["\ufeff", workbook], {
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
  summary,
  rows,
}: {
  locale: AppLocale;
  title: string;
  summary: SummaryState;
  rows: ProductRow[];
}) {
  const isArabic = locale === "ar";
  const t = dictionary(locale);

  const tableRows = rows
    .slice(0, 40)
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.code)}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(providerLabel(item.provider, locale) || t.noProvider)}</td>
          <td>${escapeHtml(t.type[item.productType])}</td>
          <td>${escapeHtml(formatMoney(item.effectivePrice))}</td>
          <td>${escapeHtml(item.isOffer ? t.yes : t.no)}</td>
          <td>${escapeHtml(t.status[item.status])}</td>
        </tr>`,
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
            background: #fff;
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
          h1 { margin: 0; font-size: 22px; font-weight: 800; }
          .meta { margin-top: 8px; color: #6b7280; font-size: 12px; }
          .badge {
            border: 1px solid #d1d5db;
            border-radius: 999px;
            padding: 5px 12px;
            font-size: 12px;
            height: fit-content;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 18px;
          }
          .box {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 10px;
          }
          .box span { color: #6b7280; display: block; font-size: 11px; }
          .box strong { display: block; margin-top: 6px; font-size: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
          th { background: #f3f4f6; font-weight: 700; }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 8px;
            text-align: ${isArabic ? "right" : "left"};
          }
          @page { size: A4 landscape; margin: 12mm; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>${escapeHtml(title)}</h1>
            <div class="meta">${escapeHtml(t.printedAt)}: ${escapeHtml(new Date().toLocaleString("en-US"))}</div>
          </div>
          <div class="badge">Primey Care</div>
        </div>

        <div class="grid">
          <div class="box"><span>${escapeHtml(t.totalProducts)}</span><strong>${escapeHtml(formatNumber(summary.total))}</strong></div>
          <div class="box"><span>${escapeHtml(t.activeProducts)}</span><strong>${escapeHtml(formatNumber(summary.active))}</strong></div>
          <div class="box"><span>${escapeHtml(t.offersProducts)}</span><strong>${escapeHtml(formatNumber(summary.offers))}</strong></div>
          <div class="box"><span>${escapeHtml(t.marketingImages)}</span><strong>${escapeHtml(formatNumber(summary.marketingImages))}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>${escapeHtml(t.table.code)}</th>
              <th>${escapeHtml(t.table.product)}</th>
              <th>${escapeHtml(t.table.provider)}</th>
              <th>${escapeHtml(t.table.type)}</th>
              <th>${escapeHtml(t.table.price)}</th>
              <th>${escapeHtml(t.table.offer)}</th>
              <th>${escapeHtml(t.table.status)}</th>
            </tr>
          </thead>
          <tbody>${tableRows || `<tr><td colspan="7">${escapeHtml(t.emptyTitle)}</td></tr>`}</tbody>
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
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [summary, setSummary] = useState<SummaryState>(DEFAULT_SUMMARY);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canView = hasSafePermission(
    auth,
    ["products.view", "products.list"],
    "view",
  );

  const canCreate = hasSafePermission(auth, ["products.create"], "action");

  const canExport = hasSafePermission(
    auth,
    ["products.export", "reports.export"],
    "action",
  );

  const canPrint = hasSafePermission(
    auth,
    ["products.print", "reports.print"],
    "action",
  );

  const canViewDetails = hasSafePermission(
    auth,
    ["products.view", "products.detail"],
    "view",
  );

  const filteredRows = useMemo(() => {
    const clean = query.trim().toLowerCase();

    const sorted = [...rows].sort((a, b) =>
      String(b.createdAt || b.updatedAt).localeCompare(String(a.createdAt || a.updatedAt)),
    );

    if (!clean) return sorted;

    return sorted.filter((item) =>
      [
        item.code,
        item.name,
        item.categoryName,
        providerLabel(item.provider, locale),
        item.offerTitle,
        item.shortDescription,
        t.type[item.productType],
        t.status[item.status],
      ]
        .join(" ")
        .toLowerCase()
        .includes(clean),
    );
  }, [locale, query, rows, t]);

  const displayRows = filteredRows.slice(0, PAGE_SIZE);
  const hasData = rows.length > 0;
  const hasSearch = query.trim().length > 0;

  const loadCount = useCallback(async (params: string) => {
    const response = await fetch(
      apiUrl(`/api/products/?page=1&page_size=1&include_children=false${params}`),
      {
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      },
    );

    const payload = (await response.json().catch(() => null)) as ProductsApiResponse | null;

    if (!response.ok || payload?.ok === false) {
      return 0;
    }

    return extractTotal(payload);
  }, []);

  const loadProducts = useCallback(
    async (showToast = false) => {
      if (!canView) {
        setRows([]);
        setSummary(DEFAULT_SUMMARY);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");

        const [
          productsResponse,
          totalCount,
          activeCount,
          offersCount,
          landingCount,
          mobileCount,
          marketingCount,
        ] = await Promise.all([
          fetch(
            apiUrl(
              `/api/products/?page=1&page_size=${PAGE_SIZE}&include_children=false&ordering=-created_at`,
            ),
            {
              credentials: "include",
              headers: {
                Accept: "application/json",
              },
            },
          ),
          loadCount(""),
          loadCount("&status=active"),
          loadCount("&is_offer=true"),
          loadCount("&show_on_landing=true"),
          loadCount("&show_on_mobile=true"),
          loadCount("&has_marketing_image=true"),
        ]);

        const productsPayload =
          (await productsResponse.json().catch(() => null)) as ProductsApiResponse | null;

        if (!productsResponse.ok || productsPayload?.ok === false) {
          throw new Error(productsPayload?.message || `HTTP ${productsResponse.status}`);
        }

        const normalizedRows = extractRows(productsPayload)
          .map(normalizeProduct)
          .filter((item) => item.id || item.name);

        setRows(normalizedRows);
        setSummary({
          total: totalCount,
          active: activeCount,
          offers: offersCount,
          landing: landingCount,
          mobile: mobileCount,
          marketingImages: marketingCount,
        });

        if (showToast) {
          toast.success(t.loadSuccess);
        }
      } catch (error) {
        console.error("Products overview load error:", error);
        setRows([]);
        setSummary(DEFAULT_SUMMARY);
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [canView, loadCount, t.loadError, t.loadSuccess],
  );

  function exportExcel() {
    if (!canExport) return;

    if (!hasData) {
      toast.error(t.exportEmpty);
      return;
    }

    const generatedAt = new Date();

    downloadExcel({
      filename: `primey-care-products-overview-${generatedAt.toISOString().slice(0, 10)}.xls`,
      title: t.title,
      locale,
      summary,
      rows: filteredRows,
    });

    toast.success(t.exportSuccess);
  }

  function printReport() {
    if (!canPrint) return;

    if (!hasData) {
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
        title: t.title,
        summary,
        rows: filteredRows,
      }),
    );
    printWindow.document.close();

    toast.success(t.printSuccess);
  }

  useEffect(() => {
    const nextLocale = readLocale();

    setLocale(nextLocale);
    applyDocumentLocale(nextLocale);
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  if (authResolving || isLoading) {
    return <PageSkeleton />;
  }

  if (!canView) {
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
          </CardContent>
        </Card>
      </div>
    );
  }

  const statCards = [
    {
      label: t.totalProducts,
      value: summary.total,
      icon: Package,
    },
    {
      label: t.activeProducts,
      value: summary.active,
      icon: CheckCircle2,
    },
    {
      label: t.offersProducts,
      value: summary.offers,
      icon: Sparkles,
    },
    {
      label: t.landingProducts,
      value: summary.landing,
      icon: Globe2,
    },
    {
      label: t.mobileProducts,
      value: summary.mobile,
      icon: Smartphone,
    },
    {
      label: t.marketingImages,
      value: summary.marketingImages,
      icon: FileImage,
    },
  ];

  const shortcuts = [
    {
      title: t.productsList,
      description: t.latestDesc,
      href: "/system/products/list",
      icon: Layers3,
      show: canView,
    },
    {
      title: t.createProduct,
      description: t.subtitle,
      href: "/system/products/create",
      icon: Plus,
      show: canCreate,
    },
  ];

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              <Package className="me-1 h-3.5 w-3.5" />
              {t.title}
            </Badge>

            <Badge variant="outline" className="rounded-full">
              <Sparkles className="me-1 h-3.5 w-3.5" />
              {t.offersProducts}
            </Badge>
          </div>

          <h1 className="mt-3 text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => loadProducts(true)}>
            <RefreshCcw className="me-2 h-4 w-4" />
            {t.refresh}
          </Button>

          {canExport ? (
            <Button type="button" variant="outline" onClick={exportExcel}>
              <FileSpreadsheet className="me-2 h-4 w-4" />
              {t.exportExcel}
            </Button>
          ) : null}

          {canPrint ? (
            <Button type="button" variant="outline" onClick={printReport}>
              <Printer className="me-2 h-4 w-4" />
              {t.print}
            </Button>
          ) : null}

          {canCreate ? (
            <Button asChild>
              <Link href="/system/products/create">
                <Plus className="me-2 h-4 w-4" />
                {t.createProduct}
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers3 className="h-5 w-5" />
            {t.shortcutsTitle}
          </CardTitle>
          <CardDescription>{t.shortcutsDesc}</CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4 md:grid-cols-2">
          {shortcuts
            .filter((item) => item.show)
            .map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group rounded-2xl border bg-background p-4 transition hover:bg-muted/50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <Icon className="h-5 w-5" />
                      </div>

                      <div>
                        <p className="font-semibold">{item.title}</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
                  </div>
                </Link>
              );
            })}
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
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  {t.latestTitle}
                </CardTitle>
                <CardDescription>{t.latestDesc}</CardDescription>
              </div>

              <div className="relative w-full lg:w-[360px]">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  placeholder={t.searchPlaceholder}
                  className="ps-10"
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {displayRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <Package className="h-7 w-7 text-muted-foreground" />
                </div>

                <div>
                  <h2 className="text-lg font-semibold">
                    {hasSearch ? t.noResultsTitle : t.emptyTitle}
                  </h2>
                  <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                    {hasSearch ? t.noResultsText : t.emptyText}
                  </p>
                </div>

                {canCreate && !hasSearch ? (
                  <Button asChild>
                    <Link href="/system/products/create">
                      <Plus className="me-2 h-4 w-4" />
                      {t.createProduct}
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.table.image}</TableHead>
                      <TableHead>{t.table.product}</TableHead>
                      <TableHead>{t.table.provider}</TableHead>
                      <TableHead>{t.table.type}</TableHead>
                      <TableHead>{t.table.price}</TableHead>
                      <TableHead>{t.table.offer}</TableHead>
                      <TableHead>{t.table.visibility}</TableHead>
                      <TableHead>{t.table.status}</TableHead>
                      {canViewDetails ? <TableHead>{t.table.action}</TableHead> : null}
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {displayRows.map((product) => {
                      const Icon = productTypeIcon(product.productType);
                      const imageSrc = product.thumbnailImageUrl || product.marketingImageUrl;

                      return (
                        <TableRow key={product.id}>
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
                                    {t.flags.featured}
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

                          <TableCell>
                            <span className="text-sm">
                              {providerLabel(product.provider, locale) || t.noProvider}
                            </span>
                          </TableCell>

                          <TableCell>
                            <Badge variant="secondary" className="rounded-full">
                              {t.type[product.productType]}
                            </Badge>
                          </TableCell>

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

                          <TableCell>
                            <div className="space-y-1">
                              {flagBadge(product.isOffer, t.table.offer)}

                              {product.offerTitle ? (
                                <p className="line-clamp-1 text-xs text-muted-foreground">
                                  {product.offerTitle}
                                </p>
                              ) : null}
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {flagBadge(product.showOnLanding, t.flags.landing)}
                              {flagBadge(product.showOnMobile, t.flags.mobile)}
                              {flagBadge(product.showOnOffers, t.flags.offers)}
                              {flagBadge(product.hasMarketingImage, t.flags.image)}
                            </div>
                          </TableCell>

                          <TableCell>{statusBadge(product.status, t)}</TableCell>

                          {canViewDetails ? (
                            <TableCell>
                              <Button asChild variant="outline" size="sm">
                                <Link href={`/system/products/${product.id}`}>
                                  <Eye className="me-2 h-4 w-4" />
                                  {t.view}
                                </Link>
                              </Button>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}