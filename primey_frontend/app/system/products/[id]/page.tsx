"use client";

/* ============================================================
   📂 app/system/products/[id]/page.tsx
   🧠 Primey Care | Product Details / Edit
   ------------------------------------------------------------
   ✅ تفاصيل المنتج / البرنامج / العرض الطبي
   ✅ عرض وتعديل بيانات مقدم الخدمة
   ✅ عرض وتغيير الصورة الرمزية والصورة التسويقية
   ✅ دعم الهبوط والموبايل والعروض
   ✅ Centers/Customers Pattern + Phase 2 Permissions
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Boxes,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Copy,
  CreditCard,
  Eye,
  FileImage,
  FileText,
  Globe2,
  ImagePlus,
  Layers3,
  Loader2,
  Package,
  Percent,
  Pencil,
  Printer,
  RefreshCcw,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Tag,
  UploadCloud,
  WalletCards,
  X,
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
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

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

type ProductCategory = {
  id?: number | string | null;
  code?: string | null;
  name?: string | null;
  name_ar?: string | null;
  name_en?: string | null;
  category_type?: string | null;
  status?: string | null;
};

type ProviderSummary = {
  id?: number | string | null;
  code?: string | null;
  name?: string | null;
  name_ar?: string | null;
  name_en?: string | null;
  provider_type?: string | null;
  status?: string | null;
  city?: string | null;
  region?: string | null;
  logo_url?: string | null;
  image_url?: string | null;
};

type ProductDetail = {
  id: number | string;
  code: string;
  name: string;
  slug: string;
  productType: ProductType;
  categoryId: string;
  categoryName: string;
  providerId: string;
  provider: ProviderSummary | null;
  status: ProductStatus;
  billingType: BillingType;
  fulfillmentType: FulfillmentType;

  shortDescription: string;
  description: string;
  termsAndConditions: string;
  features: string;
  tags: string;

  thumbnailImageUrl: string;
  thumbnailImageDriveViewUrl: string;
  thumbnailImageAltText: string;
  marketingImageUrl: string;
  marketingImageDriveViewUrl: string;
  marketingImageAltText: string;

  price: number;
  salePrice: number;
  costPrice: number;
  effectivePrice: number;
  taxAmount: number;
  totalPriceWithTax: number;
  hasDiscount: boolean;
  isTaxable: boolean;
  taxRate: number;

  durationValue: number;
  durationUnit: string;

  isOffer: boolean;
  offerTitle: string;
  offerSubtitle: string;
  offerBadge: string;
  offerTerms: string;
  offerStartDate: string;
  offerEndDate: string;
  showOnLanding: boolean;
  showOnMobile: boolean;
  showOnOffers: boolean;
  isCurrentOffer: boolean;

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

  pricingTiers: unknown[];
  serviceItems: unknown[];

  createdAt: string;
  updatedAt: string;
  raw: Record<string, unknown>;
};

type ProductDetailResponse = {
  ok?: boolean;
  message?: string;
  data?: unknown;
  product?: unknown;
  item?: unknown;
  errors?: Record<string, string[] | string>;
};

type SelectOption = {
  id: number | string;
  name?: string;
  name_ar?: string;
  name_en?: string;
  code?: string;
  title?: string;
};

type ListApiResponse<T> = {
  ok?: boolean;
  results?: T[];
  data?: T[] | { results?: T[]; items?: T[] };
  items?: T[];
};

type EditFormData = {
  name: string;
  code: string;
  slug: string;
  product_type: ProductType;
  status: ProductStatus;
  category_id: string;
  provider_id: string;

  short_description: string;
  description: string;
  terms_and_conditions: string;
  features: string;
  tags: string;

  price: string;
  sale_price: string;
  cost_price: string;
  billing_type: BillingType;
  fulfillment_type: FulfillmentType;
  duration_value: string;
  duration_unit: string;

  is_taxable: boolean;
  tax_rate: string;

  is_offer: boolean;
  offer_title: string;
  offer_subtitle: string;
  offer_badge: string;
  offer_terms: string;
  offer_start_date: string;
  offer_end_date: string;
  show_on_landing: boolean;
  show_on_mobile: boolean;
  show_on_offers: boolean;

  is_public: boolean;
  is_featured: boolean;
  requires_approval: boolean;
  allow_online_purchase: boolean;
  allow_agent_sale: boolean;
  allow_provider_sale: boolean;
  can_be_ordered: boolean;
  can_be_used_in_contracts: boolean;
  requires_provider: boolean;

  max_discount_rate: string;
  default_agent_commission_rate: string;
};

const SAR_ICON_PATH = "/currency/sar.svg";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

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

function readCookie(name: string) {
  if (typeof document === "undefined") return "";

  const match = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.split("=")[1] || "") : "";
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

function unwrapProduct(payload: unknown): unknown {
  const wrapper = (payload || {}) as ProductDetailResponse;

  return wrapper.data || wrapper.product || wrapper.item || payload || {};
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
    image_url: String(obj.image_url || ""),
  };
}

function normalizeProductDetail(payload: unknown): ProductDetail {
  const obj = unwrapProduct(payload) as Record<string, unknown>;
  const category = obj.category as ProductCategory | null | undefined;
  const provider = normalizeProvider(obj.provider);

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

  const pricingTiersRaw = obj.pricing_tiers;
  const serviceItemsRaw = obj.service_items;

  return {
    id: id as number | string,
    code: String(code || "-"),
    name: String(name || "-"),
    slug: String(getObjectValue(obj, "slug") ?? ""),
    productType: normalizeType(
      getObjectValue(obj, "product_type") ?? getObjectValue(obj, "type"),
    ),
    categoryId: String(getObjectValue(obj, "category_id") || category?.id || ""),
    categoryName: String(
      category?.name ||
        getObjectValue(obj, "category_name") ||
        "",
    ),
    providerId: String(getObjectValue(obj, "provider_id") || provider?.id || ""),
    provider,
    status: normalizeStatus(getObjectValue(obj, "status")),
    billingType: normalizeBillingType(getObjectValue(obj, "billing_type")),
    fulfillmentType: normalizeFulfillmentType(
      getObjectValue(obj, "fulfillment_type"),
    ),

    shortDescription: String(getObjectValue(obj, "short_description") ?? ""),
    description: String(getObjectValue(obj, "description") ?? ""),
    termsAndConditions: String(getObjectValue(obj, "terms_and_conditions") ?? ""),
    features: String(getObjectValue(obj, "features") ?? ""),
    tags: String(getObjectValue(obj, "tags") ?? ""),

    thumbnailImageUrl: String(getObjectValue(obj, "thumbnail_image_url") ?? ""),
    thumbnailImageDriveViewUrl: String(
      getObjectValue(obj, "thumbnail_image_drive_view_url") ?? "",
    ),
    thumbnailImageAltText: String(
      getObjectValue(obj, "thumbnail_image_alt_text") ?? "",
    ),
    marketingImageUrl: String(getObjectValue(obj, "marketing_image_url") ?? ""),
    marketingImageDriveViewUrl: String(
      getObjectValue(obj, "marketing_image_drive_view_url") ?? "",
    ),
    marketingImageAltText: String(
      getObjectValue(obj, "marketing_image_alt_text") ?? "",
    ),

    price,
    salePrice,
    costPrice: toNumber(getObjectValue(obj, "cost_price")),
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

    isOffer: Boolean(getObjectValue(obj, "is_offer")),
    offerTitle: String(getObjectValue(obj, "offer_title") ?? ""),
    offerSubtitle: String(getObjectValue(obj, "offer_subtitle") ?? ""),
    offerBadge: String(getObjectValue(obj, "offer_badge") ?? ""),
    offerTerms: String(getObjectValue(obj, "offer_terms") ?? ""),
    offerStartDate: String(getObjectValue(obj, "offer_start_date") ?? ""),
    offerEndDate: String(getObjectValue(obj, "offer_end_date") ?? ""),
    showOnLanding: Boolean(getObjectValue(obj, "show_on_landing")),
    showOnMobile: Boolean(getObjectValue(obj, "show_on_mobile")),
    showOnOffers: Boolean(getObjectValue(obj, "show_on_offers")),
    isCurrentOffer: Boolean(getObjectValue(obj, "is_current_offer")),

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

    pricingTiers: Array.isArray(pricingTiersRaw) ? pricingTiersRaw : [],
    serviceItems: Array.isArray(serviceItemsRaw) ? serviceItemsRaw : [],

    createdAt: String(getObjectValue(obj, "created_at") ?? ""),
    updatedAt: String(getObjectValue(obj, "updated_at") ?? ""),
    raw: obj,
  };
}

function productToForm(product: ProductDetail): EditFormData {
  return {
    name: product.name === "-" ? "" : product.name,
    code: product.code === "-" ? "" : product.code,
    slug: product.slug,
    product_type: product.productType,
    status: product.status,
    category_id: product.categoryId,
    provider_id: product.providerId,

    short_description: product.shortDescription,
    description: product.description,
    terms_and_conditions: product.termsAndConditions,
    features: product.features,
    tags: product.tags,

    price: String(product.price || ""),
    sale_price: product.salePrice ? String(product.salePrice) : "",
    cost_price: product.costPrice ? String(product.costPrice) : "",
    billing_type: product.billingType,
    fulfillment_type: product.fulfillmentType,
    duration_value: String(product.durationValue || "0"),
    duration_unit: product.durationUnit || "none",

    is_taxable: product.isTaxable,
    tax_rate: String(product.taxRate || "0"),

    is_offer: product.isOffer,
    offer_title: product.offerTitle,
    offer_subtitle: product.offerSubtitle,
    offer_badge: product.offerBadge,
    offer_terms: product.offerTerms,
    offer_start_date: product.offerStartDate,
    offer_end_date: product.offerEndDate,
    show_on_landing: product.showOnLanding,
    show_on_mobile: product.showOnMobile,
    show_on_offers: product.showOnOffers,

    is_public: product.isPublic,
    is_featured: product.isFeatured,
    requires_approval: product.requiresApproval,
    allow_online_purchase: product.allowOnlinePurchase,
    allow_agent_sale: product.allowAgentSale,
    allow_provider_sale: product.allowProviderSale,
    can_be_ordered: product.canBeOrdered,
    can_be_used_in_contracts: product.canBeUsedInContracts,
    requires_provider: product.requiresProvider,

    max_discount_rate: String(product.maxDiscountRate || "0"),
    default_agent_commission_rate: String(product.defaultAgentCommissionRate || "0"),
  };
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "تفاصيل المنتج" : "Product Details",
    subtitle: isArabic
      ? "عرض وتحديث بيانات المنتج والصور والظهور التسويقي."
      : "View and update product data, images, and marketing visibility.",

    back: isArabic ? "العودة للمنتجات" : "Back to Products",
    productsList: isArabic ? "قائمة المنتجات" : "Products List",
    refresh: isArabic ? "تحديث" : "Refresh",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    edit: isArabic ? "تعديل البيانات" : "Edit Data",
    save: isArabic ? "حفظ التعديلات" : "Save Changes",
    cancel: isArabic ? "إلغاء" : "Cancel",
    saving: isArabic ? "جاري الحفظ..." : "Saving...",
    uploading: isArabic ? "جاري رفع الصورة..." : "Uploading image...",

    overview: isArabic ? "نظرة عامة" : "Overview",
    overviewDesc: isArabic
      ? "ملخص المنتج وحالته ونوعه وقيمته."
      : "Product summary, status, type, and value.",

    marketing: isArabic ? "الظهور التسويقي والعرض" : "Marketing & Offer",
    marketingDesc: isArabic
      ? "الصورة التسويقية، حالة العرض، والظهور في الهبوط والتطبيق والعروض."
      : "Marketing image, offer status, and landing/mobile/offers visibility.",

    images: isArabic ? "صور المنتج" : "Product Images",
    imagesDesc: isArabic
      ? "الصورة الرمزية للنظام والصورة التسويقية للعرض."
      : "System thumbnail and marketing image.",

    pricing: isArabic ? "التسعير والفوترة" : "Pricing & Billing",
    pricingDesc: isArabic
      ? "السعر الأساسي والخصم والضريبة والفوترة."
      : "Base price, discount, tax, and billing.",

    readiness: isArabic ? "الجاهزية وقنوات البيع" : "Readiness & Sales Channels",
    readinessDesc: isArabic
      ? "حالة توفر المنتج للطلبات والعقود وقنوات البيع."
      : "Product availability for orders, contracts, and sales channels.",

    description: isArabic ? "الوصف والمحتوى" : "Description & Content",
    descriptionDesc: isArabic
      ? "الوصف التفصيلي والمزايا والشروط والوسوم."
      : "Full description, features, terms, and tags.",

    advanced: isArabic ? "بيانات متقدمة" : "Advanced Data",
    advancedDesc: isArabic
      ? "شرائح التسعير وعناصر الخدمات إن وجدت."
      : "Pricing tiers and service items if available.",

    quickInfo: isArabic ? "معلومات سريعة" : "Quick Info",
    copy: isArabic ? "نسخ" : "Copy",
    copied: isArabic ? "تم النسخ بنجاح" : "Copied successfully",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الصفحة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض تفاصيل المنتجات."
      : "You do not have permission to view product details.",

    notFoundTitle: isArabic ? "المنتج غير موجود" : "Product not found",
    notFoundText: isArabic
      ? "لم يتم العثور على المنتج المطلوب أو قد يكون غير متاح."
      : "The requested product could not be found or may not be available.",

    loadError: isArabic
      ? "تعذر تحميل تفاصيل المنتج."
      : "Unable to load product details.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    refreshSuccess: isArabic
      ? "تم تحديث تفاصيل المنتج بنجاح."
      : "Product details refreshed successfully.",
    saveSuccess: isArabic
      ? "تم حفظ التعديلات بنجاح."
      : "Changes saved successfully.",
    uploadSuccess: isArabic
      ? "تم رفع الصورة بنجاح."
      : "Image uploaded successfully.",
    saveError: isArabic
      ? "تعذر حفظ التعديلات."
      : "Unable to save changes.",
    uploadError: isArabic
      ? "تعذر رفع الصورة."
      : "Unable to upload image.",
    imageSize: isArabic
      ? "حجم الصورة يجب ألا يتجاوز 10MB."
      : "Image size must not exceed 10MB.",
    imageType: isArabic
      ? "يرجى اختيار ملف صورة صالح."
      : "Please choose a valid image file.",
    printReady: isArabic
      ? "تم تجهيز نافذة الطباعة."
      : "Print window prepared.",
    printError: isArabic
      ? "تعذر فتح نافذة الطباعة."
      : "Unable to open print window.",

    fields: {
      id: isArabic ? "المعرف" : "ID",
      name: isArabic ? "اسم المنتج" : "Product Name",
      code: isArabic ? "الكود" : "Code",
      slug: isArabic ? "الرابط المختصر" : "Slug",
      type: isArabic ? "نوع المنتج" : "Product Type",
      category: isArabic ? "التصنيف" : "Category",
      provider: isArabic ? "مقدم الخدمة" : "Provider",
      status: isArabic ? "الحالة" : "Status",
      price: isArabic ? "السعر الأساسي" : "Base Price",
      salePrice: isArabic ? "سعر الخصم" : "Sale Price",
      costPrice: isArabic ? "التكلفة" : "Cost Price",
      effectivePrice: isArabic ? "السعر الفعلي" : "Effective Price",
      taxAmount: isArabic ? "قيمة الضريبة" : "Tax Amount",
      totalWithTax: isArabic ? "الإجمالي مع الضريبة" : "Total With Tax",
      taxRate: isArabic ? "نسبة الضريبة" : "Tax Rate",
      billing: isArabic ? "الفوترة" : "Billing",
      fulfillment: isArabic ? "التسليم" : "Fulfillment",
      duration: isArabic ? "المدة" : "Duration",
      discount: isArabic ? "الحد الأعلى للخصم" : "Max Discount",
      agentCommission: isArabic ? "عمولة المندوب" : "Agent Commission",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      updatedAt: isArabic ? "آخر تحديث" : "Updated At",
      shortDescription: isArabic ? "الوصف المختصر" : "Short Description",
      fullDescription: isArabic ? "الوصف التفصيلي" : "Full Description",
      features: isArabic ? "المزايا" : "Features",
      terms: isArabic ? "الشروط والأحكام" : "Terms & Conditions",
      tags: isArabic ? "الوسوم" : "Tags",
      thumbnail: isArabic ? "الصورة الرمزية" : "Thumbnail Image",
      marketingImage: isArabic ? "الصورة التسويقية" : "Marketing Image",
      isOffer: isArabic ? "منتج يظهر كعرض" : "Marked as Offer",
      offerTitle: isArabic ? "عنوان العرض" : "Offer Title",
      offerSubtitle: isArabic ? "وصف العرض المختصر" : "Offer Subtitle",
      offerBadge: isArabic ? "شارة العرض" : "Offer Badge",
      offerTerms: isArabic ? "شروط العرض" : "Offer Terms",
      offerStart: isArabic ? "بداية العرض" : "Offer Start",
      offerEnd: isArabic ? "نهاية العرض" : "Offer End",
      landing: isArabic ? "يظهر في الهبوط" : "Landing",
      mobile: isArabic ? "يظهر في التطبيق" : "Mobile",
      offers: isArabic ? "يظهر في العروض" : "Offers",
      public: isArabic ? "عام" : "Public",
      featured: isArabic ? "مميز" : "Featured",
      approval: isArabic ? "يتطلب موافقة" : "Requires Approval",
      online: isArabic ? "شراء إلكتروني" : "Online Purchase",
      agentSale: isArabic ? "بيع مندوب" : "Agent Sale",
      providerSale: isArabic ? "بيع مقدم خدمة" : "Provider Sale",
      orderReady: isArabic ? "جاهز للطلبات" : "Order Ready",
      contractsReady: isArabic ? "جاهز للعقود" : "Contracts Ready",
      requiresProvider: isArabic ? "يتطلب مقدم خدمة" : "Requires Provider",
    },

    statuses: {
      active: isArabic ? "نشط" : "Active",
      draft: isArabic ? "مسودة" : "Draft",
      inactive: isArabic ? "غير نشط" : "Inactive",
      archived: isArabic ? "مؤرشف" : "Archived",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<ProductStatus, string>,

    productTypes: {
      membership: isArabic ? "عضوية" : "Membership",
      card: isArabic ? "بطاقة" : "Card",
      program: isArabic ? "برنامج" : "Program",
      service: isArabic ? "خدمة" : "Service",
      other: isArabic ? "أخرى" : "Other",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<ProductType, string>,

    billingTypes: {
      one_time: isArabic ? "مرة واحدة" : "One Time",
      recurring: isArabic ? "متكرر" : "Recurring",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<BillingType, string>,

    fulfillmentTypes: {
      digital: isArabic ? "رقمي" : "Digital",
      physical: isArabic ? "فعلي" : "Physical",
      both: isArabic ? "رقمي وفعلي" : "Digital & Physical",
      service_based: isArabic ? "مرتبط بخدمة" : "Service Based",
      none: isArabic ? "بدون" : "None",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<FulfillmentType, string>,

    durationUnits: {
      day: isArabic ? "يوم" : "Day",
      month: isArabic ? "شهر" : "Month",
      year: isArabic ? "سنة" : "Year",
      none: isArabic ? "بدون" : "None",
    },

    empty: isArabic ? "لا توجد بيانات" : "No data",
    noCategory: isArabic ? "بدون تصنيف" : "No Category",
    noProvider: isArabic ? "بدون مقدم خدمة" : "No Provider",
    noImage: isArabic ? "لا توجد صورة" : "No image",
    chooseFile: isArabic ? "اختيار صورة" : "Choose image",
    uploadThumbnail: isArabic ? "رفع الصورة الرمزية" : "Upload thumbnail",
    uploadMarketing: isArabic ? "رفع الصورة التسويقية" : "Upload marketing image",
    yes: isArabic ? "نعم" : "Yes",
    no: isArabic ? "لا" : "No",
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

function isValidId(id: unknown) {
  const value = String(id || "").trim();

  return value.length > 0 && value !== "-" && value !== "undefined";
}

function statusLabel(status: ProductStatus, locale: AppLocale) {
  return dictionary(locale).statuses[status];
}

function typeLabel(type: ProductType, locale: AppLocale) {
  return dictionary(locale).productTypes[type];
}

function billingLabel(type: BillingType, locale: AppLocale) {
  return dictionary(locale).billingTypes[type];
}

function fulfillmentLabel(type: FulfillmentType, locale: AppLocale) {
  return dictionary(locale).fulfillmentTypes[type];
}

function productIcon(type: ProductType): ComponentType<{ className?: string }> {
  if (type === "card") return CreditCard;
  if (type === "membership") return BadgeCheck;
  if (type === "program") return Boxes;
  if (type === "service") return Stethoscope;

  return Package;
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

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function DetailSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
      <Card>
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
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
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

function FlagBadge({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  return (
    <Badge
      variant={active ? "secondary" : "outline"}
      className="rounded-full px-3 py-1"
    >
      {active ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <XCircle className="h-3.5 w-3.5" />
      )}
      {label}
    </Badge>
  );
}

function ToggleBox({
  checked,
  disabled,
  title,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  title: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border bg-background p-3">
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(Boolean(value))}
      />
      <span className="text-sm font-semibold">{title}</span>
    </label>
  );
}

function FieldBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}

function productImageUrl(product: ProductDetail, type: "thumbnail" | "marketing") {
  if (type === "thumbnail") {
    return product.thumbnailImageUrl || product.thumbnailImageDriveViewUrl;
  }

  return product.marketingImageUrl || product.marketingImageDriveViewUrl;
}

function RemoteImagePreview({
  src,
  alt,
  emptyText,
}: {
  src: string;
  alt: string;
  emptyText: string;
}) {
  if (!src) {
    return (
      <div className="flex min-h-[180px] items-center justify-center rounded-2xl border bg-muted/40 p-6 text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-background">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="h-auto max-h-[360px] w-full object-contain"
      />
    </div>
  );
}

function optionLabel(option: SelectOption, locale: AppLocale) {
  const primary =
    locale === "ar"
      ? option.name_ar || option.name || option.title || option.name_en
      : option.name_en || option.name || option.title || option.name_ar;

  const code = option.code ? ` - ${option.code}` : "";

  return `${primary || option.id}${code}`;
}

function toReadableUnknownRow(item: unknown, index: number) {
  if (!item || typeof item !== "object") {
    return {
      title: `#${index + 1}`,
      subtitle: String(item ?? "-"),
      value: "-",
    };
  }

  const obj = item as Record<string, unknown>;

  return {
    title: String(obj.name ?? obj.title ?? obj.service_name ?? `#${index + 1}`),
    subtitle: String(obj.notes ?? obj.description ?? obj.code ?? "-"),
    value: String(obj.price ?? obj.value ?? obj.quantity ?? "-"),
  };
}

function normalizeCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9-_]/g, "");
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function normalizeNumberString(value: string, fallback = "0.00") {
  const clean = value.replace(/,/g, "").replace(/[^\d.]/g, "");
  const parsed = Number(clean);

  if (!Number.isFinite(parsed)) return fallback;

  return parsed.toFixed(2);
}

function editPayload(form: EditFormData) {
  return {
    name: form.name.trim(),
    code: form.code.trim() ? normalizeCode(form.code) : "",
    slug: form.slug.trim() ? normalizeSlug(form.slug) : normalizeSlug(form.name),
    product_type: form.product_type,
    status: form.status,
    category_id: form.category_id || null,
    provider_id: form.provider_id || null,

    short_description: form.short_description.trim(),
    description: form.description.trim(),
    terms_and_conditions: form.terms_and_conditions.trim(),
    features: form.features.trim(),
    tags: form.tags.trim(),

    price: normalizeNumberString(form.price),
    sale_price: form.sale_price.trim()
      ? normalizeNumberString(form.sale_price)
      : null,
    cost_price: form.cost_price.trim()
      ? normalizeNumberString(form.cost_price)
      : null,
    billing_type: form.billing_type,
    fulfillment_type: form.fulfillment_type,
    duration_value: String(Math.max(0, Math.round(toNumber(form.duration_value)))),
    duration_unit: form.duration_unit,

    is_taxable: form.is_taxable,
    tax_rate: String(toNumber(form.tax_rate)),

    is_offer: form.is_offer,
    offer_title: form.offer_title.trim(),
    offer_subtitle: form.offer_subtitle.trim(),
    offer_badge: form.offer_badge.trim(),
    offer_terms: form.offer_terms.trim(),
    offer_start_date: form.offer_start_date || null,
    offer_end_date: form.offer_end_date || null,
    show_on_landing: form.show_on_landing,
    show_on_mobile: form.show_on_mobile,
    show_on_offers: form.show_on_offers,

    is_public: form.is_public,
    is_featured: form.is_featured,
    requires_approval: form.requires_approval,
    allow_online_purchase: form.allow_online_purchase,
    allow_agent_sale: form.allow_agent_sale,
    allow_provider_sale: form.allow_provider_sale,
    can_be_ordered: form.can_be_ordered,
    can_be_used_in_contracts: form.can_be_used_in_contracts,
    requires_provider: Boolean(form.provider_id) || form.requires_provider,

    max_discount_rate: String(toNumber(form.max_discount_rate)),
    default_agent_commission_rate: String(toNumber(form.default_agent_commission_rate)),
  };
}

/* ============================================================
   Print
============================================================ */

function buildPrintHtml({
  locale,
  product,
  t,
}: {
  locale: AppLocale;
  product: ProductDetail;
  t: ReturnType<typeof dictionary>;
}) {
  const isArabic = locale === "ar";
  const now = new Date().toLocaleString("en-US");

  const providerName =
    product.provider?.name_ar ||
    product.provider?.name ||
    product.provider?.name_en ||
    "-";

  const rows: Array<[string, string]> = [
    [t.fields.name, product.name],
    [t.fields.code, product.code],
    [t.fields.type, typeLabel(product.productType, locale)],
    [t.fields.category, product.categoryName || t.noCategory],
    [t.fields.provider, providerName],
    [t.fields.status, statusLabel(product.status, locale)],
    [t.fields.effectivePrice, formatMoney(product.effectivePrice)],
    [t.fields.price, formatMoney(product.price)],
    [t.fields.salePrice, formatMoney(product.salePrice)],
    [t.fields.totalWithTax, formatMoney(product.totalPriceWithTax)],
    [t.fields.billing, billingLabel(product.billingType, locale)],
    [t.fields.fulfillment, fulfillmentLabel(product.fulfillmentType, locale)],
    [
      t.fields.duration,
      product.durationValue
        ? `${formatNumber(product.durationValue)} ${product.durationUnit}`
        : "-",
    ],
    [t.fields.isOffer, product.isOffer ? t.yes : t.no],
    [t.fields.offerTitle, product.offerTitle || "-"],
    [t.fields.offerStart, product.offerStartDate || "-"],
    [t.fields.offerEnd, product.offerEndDate || "-"],
    [t.fields.createdAt, formatDate(product.createdAt)],
    [t.fields.updatedAt, formatDate(product.updatedAt || product.createdAt)],
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
            color: #6b7280;
          }
          .badge {
            border: 1px solid #e5e7eb;
            padding: 8px 12px;
            border-radius: 999px;
            font-size: 12px;
            color: #374151;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 16px;
          }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 10px 12px;
            font-size: 13px;
            vertical-align: top;
          }
          th {
            width: 32%;
            background: #f9fafb;
            color: #374151;
          }
          .section-title {
            margin-top: 22px;
            margin-bottom: 8px;
            font-weight: 800;
            font-size: 15px;
          }
          .text-block {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 12px;
            min-height: 70px;
            white-space: pre-wrap;
            font-size: 13px;
            line-height: 1.7;
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <div>
            <h1>${escapeHtml(product.name)}</h1>
            <div class="meta">${escapeHtml(t.fields.code)}: ${escapeHtml(product.code)}</div>
            <div class="meta">${escapeHtml(t.printedAt)}: ${escapeHtml(now)}</div>
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

        <div class="section-title">${escapeHtml(t.fields.fullDescription)}</div>
        <div class="text-block">${escapeHtml(product.description || product.shortDescription || "-")}</div>

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

export default function SystemProductDetailsPage() {
  const params = useParams();
  const auth = useAuth() as unknown;

  const productId = String(params?.id || "");

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [editForm, setEditForm] = useState<EditFormData | null>(null);
  const [categories, setCategories] = useState<SelectOption[]>([]);
  const [providers, setProviders] = useState<SelectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLookups, setIsLoadingLookups] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImageType, setUploadingImageType] = useState<"thumbnail" | "marketing" | "">("");
  const [errorMessage, setErrorMessage] = useState("");
  const [notFound, setNotFound] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const authResolving = isAuthResolving(auth);

  const canViewProducts = hasSafePermission(
    auth,
    ["products.view", "products.detail", "products.list"],
    "view",
  );

  const canEditProducts = hasSafePermission(
    auth,
    ["products.edit", "products.update", "products.change_product"],
    "action",
  );

  const canUploadProductImages = hasSafePermission(
    auth,
    ["products.edit", "products.update", "products.upload"],
    "action",
  );

  const canPrintProducts = hasSafePermission(
    auth,
    ["products.print", "reports.print"],
    "action",
  );

  const canViewProductsList = hasSafePermission(
    auth,
    ["products.view", "products.list"],
    "view",
  );

  const productTypeIcon = product ? productIcon(product.productType) : Package;
  const ProductIcon = productTypeIcon;

  const selectedProviderName =
    product?.provider?.name_ar ||
    product?.provider?.name ||
    product?.provider?.name_en ||
    "";

  const loadProduct = useCallback(
    async (showToast = false) => {
      if (!canViewProducts) {
        setIsLoading(false);
        setProduct(null);
        return;
      }

      if (!isValidId(productId)) {
        setIsLoading(false);
        setProduct(null);
        setNotFound(true);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");
        setNotFound(false);

        const response = await fetch(
          apiUrl(`/api/products/${encodeURIComponent(productId)}/`),
          {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          },
        );

        const payload = (await response.json().catch(() => null)) as
          | ProductDetailResponse
          | null;

        if (response.status === 404) {
          setProduct(null);
          setNotFound(true);
          return;
        }

        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.message || `HTTP ${response.status}`);
        }

        const normalized = normalizeProductDetail(payload);

        if (!isValidId(normalized.id)) {
          setProduct(null);
          setNotFound(true);
          return;
        }

        setProduct(normalized);
        setEditForm(productToForm(normalized));

        if (showToast) {
          toast.success(t.refreshSuccess);
        }
      } catch (error) {
        console.error("Load product details error:", error);
        setProduct(null);
        setErrorMessage(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [canViewProducts, productId, t.loadError, t.refreshSuccess],
  );

  const loadLookups = useCallback(async () => {
    try {
      setIsLoadingLookups(true);

      const [categoriesResponse, providersResponse] = await Promise.all([
        fetch(apiUrl("/api/products/categories/?page=1&page_size=100"), {
          credentials: "include",
          headers: { Accept: "application/json" },
        }),
        fetch(apiUrl("/api/providers/?page=1&page_size=100&ordering=name"), {
          credentials: "include",
          headers: { Accept: "application/json" },
        }),
      ]);

      if (categoriesResponse.ok) {
        const payload = (await categoriesResponse.json().catch(() => ({}))) as ListApiResponse<SelectOption>;
        setCategories(extractList(payload));
      }

      if (providersResponse.ok) {
        const payload = (await providersResponse.json().catch(() => ({}))) as ListApiResponse<SelectOption>;
        setProviders(extractList(payload));
      }
    } catch (error) {
      console.error("Load product detail lookups error:", error);
    } finally {
      setIsLoadingLookups(false);
    }
  }, []);

  function updateEditField<K extends keyof EditFormData>(
    key: K,
    value: EditFormData[K],
  ) {
    setEditForm((current) => {
      if (!current) return current;

      const next = {
        ...current,
        [key]: value,
      };

      if (key === "provider_id") {
        next.requires_provider = Boolean(value) || next.requires_provider;
      }

      if (key === "is_offer" && value === true) {
        next.show_on_offers = true;
      }

      return next;
    });
  }

  async function saveChanges() {
    if (!editForm || !product) return;

    if (!editForm.name.trim()) {
      toast.error(t.fields.name);
      return;
    }

    try {
      setIsSaving(true);

      const csrfToken = readCookie("csrftoken");

      const response = await fetch(
        apiUrl(`/api/products/${encodeURIComponent(String(product.id))}/`),
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
          },
          body: JSON.stringify(editPayload(editForm)),
        },
      );

      const payload = (await response.json().catch(() => null)) as ProductDetailResponse | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message || `HTTP ${response.status}`);
      }

      const normalized = normalizeProductDetail(payload);
      setProduct(normalized);
      setEditForm(productToForm(normalized));
      setIsEditing(false);
      toast.success(t.saveSuccess);
    } catch (error) {
      console.error("Save product details error:", error);
      toast.error(t.saveError);
    } finally {
      setIsSaving(false);
    }
  }

  async function uploadImage(imageType: "thumbnail" | "marketing", file: File | null) {
    if (!product || !file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(t.imageType);
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      toast.error(t.imageSize);
      return;
    }

    try {
      setUploadingImageType(imageType);

      const form = new FormData();
      form.append("file", file);
      form.append("image_type", imageType);
      form.append("alt_text", product.name);

      const csrfToken = readCookie("csrftoken");

      const response = await fetch(
        apiUrl(`/api/products/${encodeURIComponent(String(product.id))}/upload-image/`),
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
          },
          body: form,
        },
      );

      const payload = (await response.json().catch(() => null)) as ProductDetailResponse | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message || `HTTP ${response.status}`);
      }

      const normalized = normalizeProductDetail(payload);
      setProduct(normalized);
      setEditForm(productToForm(normalized));
      toast.success(t.uploadSuccess);
    } catch (error) {
      console.error("Upload product image error:", error);
      toast.error(t.uploadError);
    } finally {
      setUploadingImageType("");
    }
  }

  function startEditing() {
    if (!product) return;

    setEditForm(productToForm(product));
    setIsEditing(true);
    loadLookups();
  }

  function cancelEditing() {
    if (product) {
      setEditForm(productToForm(product));
    }

    setIsEditing(false);
  }

  function handlePrint() {
    if (!product) return;

    const printWindow = window.open("", "_blank", "width=980,height=720");

    if (!printWindow) {
      toast.error(t.printError);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      buildPrintHtml({
        locale,
        product,
        t,
      }),
    );
    printWindow.document.close();

    toast.success(t.printReady);
  }

  useEffect(() => {
    const nextLocale = readLocale();

    setLocale(nextLocale);
    applyDocumentLocale(nextLocale);
  }, []);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  if (authResolving || isLoading) {
    return (
      <div className="w-full space-y-4">
        <DetailSkeleton />
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

            {canViewProductsList ? (
              <Button asChild variant="outline">
                <Link href="/system/products">
                  <ArrowLeft className="me-2 h-4 w-4" />
                  {t.back}
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="w-full space-y-4">
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

            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={() => loadProduct(true)}>
                <RefreshCcw className="me-2 h-4 w-4" />
                {t.retry}
              </Button>

              {canViewProductsList ? (
                <Button asChild variant="outline">
                  <Link href="/system/products">
                    <ArrowLeft className="me-2 h-4 w-4" />
                    {t.back}
                  </Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="w-full space-y-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 p-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Package className="h-7 w-7 text-muted-foreground" />
            </div>

            <div>
              <h2 className="text-lg font-semibold">{t.notFoundTitle}</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                {t.notFoundText}
              </p>
            </div>

            {canViewProductsList ? (
              <Button asChild variant="outline">
                <Link href="/system/products">
                  <ArrowLeft className="me-2 h-4 w-4" />
                  {t.back}
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  const thumbnailSrc = productImageUrl(product, "thumbnail");
  const marketingSrc = productImageUrl(product, "marketing");

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {statusBadge(product.status, locale)}

            <Badge variant="secondary" className="rounded-full px-3 py-1">
              <ProductIcon className="h-3.5 w-3.5" />
              {typeLabel(product.productType, locale)}
            </Badge>

            {product.isOffer ? (
              <Badge variant="outline" className="rounded-full px-3 py-1">
                <Sparkles className="h-3.5 w-3.5" />
                {t.fields.isOffer}
              </Badge>
            ) : null}

            {product.isCurrentOffer ? (
              <Badge className="rounded-full px-3 py-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t.marketing}
              </Badge>
            ) : null}
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {product.shortDescription || t.subtitle}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canViewProductsList ? (
            <Button asChild variant="outline">
              <Link href="/system/products">
                <ArrowLeft className="me-2 h-4 w-4" />
                {t.back}
              </Link>
            </Button>
          ) : null}

          <Button type="button" variant="outline" onClick={() => loadProduct(true)}>
            <RefreshCcw className="me-2 h-4 w-4" />
            {t.refresh}
          </Button>

          {canPrintProducts ? (
            <Button type="button" variant="outline" onClick={handlePrint}>
              <Printer className="me-2 h-4 w-4" />
              {t.print}
            </Button>
          ) : null}

          {canEditProducts && !isEditing ? (
            <Button type="button" onClick={startEditing}>
              <Pencil className="me-2 h-4 w-4" />
              {t.edit}
            </Button>
          ) : null}

          {canEditProducts && isEditing ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={cancelEditing}
              >
                <X className="me-2 h-4 w-4" />
                {t.cancel}
              </Button>

              <Button type="button" disabled={isSaving} onClick={saveChanges}>
                {isSaving ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="me-2 h-4 w-4" />
                )}
                {isSaving ? t.saving : t.save}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-muted">
                  {thumbnailSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnailSrc}
                      alt={product.thumbnailImageAltText || product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ProductIcon className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold">{product.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {product.code}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {product.isFeatured ? (
                      <Badge variant="secondary">{t.fields.featured}</Badge>
                    ) : null}
                    {product.isPublic ? (
                      <Badge variant="outline">{t.fields.public}</Badge>
                    ) : null}
                  </div>
                </div>
              </div>

              <Table>
                <TableBody>
                  <InfoRow
                    label={t.fields.id}
                    value={String(product.id)}
                    copyable
                    copiedMessage={t.copied}
                  />
                  <InfoRow
                    label={t.fields.code}
                    value={product.code}
                    copyable
                    copiedMessage={t.copied}
                  />
                  <InfoRow
                    label={t.fields.slug}
                    value={product.slug || "-"}
                    copyable
                    copiedMessage={t.copied}
                  />
                  <InfoRow
                    label={t.fields.provider}
                    value={selectedProviderName || t.noProvider}
                    copiedMessage={t.copied}
                  />
                  <InfoRow
                    label={t.fields.category}
                    value={product.categoryName || t.noCategory}
                    copiedMessage={t.copied}
                  />
                  <InfoRow
                    label={t.fields.createdAt}
                    value={formatDate(product.createdAt)}
                    copiedMessage={t.copied}
                  />
                  <InfoRow
                    label={t.fields.updatedAt}
                    value={formatDate(product.updatedAt || product.createdAt)}
                    copiedMessage={t.copied}
                  />
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CircleDollarSign className="h-5 w-5" />
                {t.fields.effectivePrice}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="rounded-2xl border bg-background p-4">
                <p className="text-sm text-muted-foreground">{t.fields.effectivePrice}</p>
                <p className="mt-2 text-2xl font-bold">
                  <SarAmount value={product.effectivePrice} />
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border bg-background p-3">
                  <p className="text-xs text-muted-foreground">{t.fields.price}</p>
                  <p className="mt-1 font-semibold">
                    <SarAmount value={product.price} />
                  </p>
                </div>

                <div className="rounded-xl border bg-background p-3">
                  <p className="text-xs text-muted-foreground">{t.fields.salePrice}</p>
                  <p className="mt-1 font-semibold">
                    <SarAmount value={product.salePrice} />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {isEditing && editForm ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Pencil className="h-5 w-5" />
                  {t.edit}
                </CardTitle>
                <CardDescription>{t.subtitle}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4">
                <div className="grid gap-4 lg:grid-cols-3">
                  <FieldBlock label={t.fields.name}>
                    <Input
                      value={editForm.name}
                      disabled={isSaving}
                      onChange={(event) => updateEditField("name", event.target.value)}
                    />
                  </FieldBlock>

                  <FieldBlock label={t.fields.code}>
                    <Input
                      value={editForm.code}
                      disabled={isSaving}
                      onChange={(event) =>
                        updateEditField("code", normalizeCode(event.target.value))
                      }
                    />
                  </FieldBlock>

                  <FieldBlock label={t.fields.slug}>
                    <Input
                      value={editForm.slug}
                      disabled={isSaving}
                      onChange={(event) =>
                        updateEditField("slug", normalizeSlug(event.target.value))
                      }
                    />
                  </FieldBlock>

                  <FieldBlock label={t.fields.type}>
                    <select
                      value={editForm.product_type}
                      disabled={isSaving}
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      onChange={(event) =>
                        updateEditField("product_type", event.target.value as ProductType)
                      }
                    >
                      {Object.entries(t.productTypes).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </FieldBlock>

                  <FieldBlock label={t.fields.status}>
                    <select
                      value={editForm.status}
                      disabled={isSaving}
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      onChange={(event) =>
                        updateEditField("status", event.target.value as ProductStatus)
                      }
                    >
                      {Object.entries(t.statuses).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </FieldBlock>

                  <FieldBlock label={t.fields.category}>
                    <select
                      value={editForm.category_id}
                      disabled={isSaving || isLoadingLookups}
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      onChange={(event) =>
                        updateEditField("category_id", event.target.value)
                      }
                    >
                      <option value="">{t.noCategory}</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {optionLabel(category, locale)}
                        </option>
                      ))}
                    </select>
                  </FieldBlock>

                  <FieldBlock label={t.fields.provider}>
                    <select
                      value={editForm.provider_id}
                      disabled={isSaving || isLoadingLookups}
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      onChange={(event) =>
                        updateEditField("provider_id", event.target.value)
                      }
                    >
                      <option value="">{t.noProvider}</option>
                      {providers.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {optionLabel(provider, locale)}
                        </option>
                      ))}
                    </select>
                  </FieldBlock>

                  <FieldBlock label={t.fields.price}>
                    <Input
                      inputMode="decimal"
                      value={editForm.price}
                      disabled={isSaving}
                      onChange={(event) => updateEditField("price", event.target.value)}
                    />
                  </FieldBlock>

                  <FieldBlock label={t.fields.salePrice}>
                    <Input
                      inputMode="decimal"
                      value={editForm.sale_price}
                      disabled={isSaving}
                      onChange={(event) =>
                        updateEditField("sale_price", event.target.value)
                      }
                    />
                  </FieldBlock>

                  <FieldBlock label={t.fields.costPrice}>
                    <Input
                      inputMode="decimal"
                      value={editForm.cost_price}
                      disabled={isSaving}
                      onChange={(event) =>
                        updateEditField("cost_price", event.target.value)
                      }
                    />
                  </FieldBlock>
                </div>

                <FieldBlock label={t.fields.shortDescription}>
                  <Input
                    value={editForm.short_description}
                    disabled={isSaving}
                    onChange={(event) =>
                      updateEditField("short_description", event.target.value)
                    }
                  />
                </FieldBlock>

                <div className="grid gap-4 lg:grid-cols-2">
                  <FieldBlock label={t.fields.fullDescription}>
                    <Textarea
                      value={editForm.description}
                      disabled={isSaving}
                      className="min-h-28"
                      onChange={(event) =>
                        updateEditField("description", event.target.value)
                      }
                    />
                  </FieldBlock>

                  <FieldBlock label={t.fields.terms}>
                    <Textarea
                      value={editForm.terms_and_conditions}
                      disabled={isSaving}
                      className="min-h-28"
                      onChange={(event) =>
                        updateEditField("terms_and_conditions", event.target.value)
                      }
                    />
                  </FieldBlock>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <FieldBlock label={t.fields.features}>
                    <Textarea
                      value={editForm.features}
                      disabled={isSaving}
                      className="min-h-24"
                      onChange={(event) =>
                        updateEditField("features", event.target.value)
                      }
                    />
                  </FieldBlock>

                  <FieldBlock label={t.fields.tags}>
                    <Textarea
                      value={editForm.tags}
                      disabled={isSaving}
                      className="min-h-24"
                      onChange={(event) =>
                        updateEditField("tags", event.target.value)
                      }
                    />
                  </FieldBlock>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <ToggleBox
                    checked={editForm.is_offer}
                    disabled={isSaving}
                    title={t.fields.isOffer}
                    onChange={(value) => updateEditField("is_offer", value)}
                  />

                  <ToggleBox
                    checked={editForm.show_on_landing}
                    disabled={isSaving}
                    title={t.fields.landing}
                    onChange={(value) => updateEditField("show_on_landing", value)}
                  />

                  <ToggleBox
                    checked={editForm.show_on_mobile}
                    disabled={isSaving}
                    title={t.fields.mobile}
                    onChange={(value) => updateEditField("show_on_mobile", value)}
                  />

                  <ToggleBox
                    checked={editForm.show_on_offers}
                    disabled={isSaving}
                    title={t.fields.offers}
                    onChange={(value) => updateEditField("show_on_offers", value)}
                  />

                  <ToggleBox
                    checked={editForm.is_public}
                    disabled={isSaving}
                    title={t.fields.public}
                    onChange={(value) => updateEditField("is_public", value)}
                  />

                  <ToggleBox
                    checked={editForm.is_featured}
                    disabled={isSaving}
                    title={t.fields.featured}
                    onChange={(value) => updateEditField("is_featured", value)}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <FieldBlock label={t.fields.offerTitle}>
                    <Input
                      value={editForm.offer_title}
                      disabled={isSaving}
                      onChange={(event) =>
                        updateEditField("offer_title", event.target.value)
                      }
                    />
                  </FieldBlock>

                  <FieldBlock label={t.fields.offerSubtitle}>
                    <Input
                      value={editForm.offer_subtitle}
                      disabled={isSaving}
                      onChange={(event) =>
                        updateEditField("offer_subtitle", event.target.value)
                      }
                    />
                  </FieldBlock>

                  <FieldBlock label={t.fields.offerBadge}>
                    <Input
                      value={editForm.offer_badge}
                      disabled={isSaving}
                      onChange={(event) =>
                        updateEditField("offer_badge", event.target.value)
                      }
                    />
                  </FieldBlock>

                  <FieldBlock label={t.fields.offerStart}>
                    <Input
                      type="date"
                      value={editForm.offer_start_date}
                      disabled={isSaving}
                      onChange={(event) =>
                        updateEditField("offer_start_date", event.target.value)
                      }
                    />
                  </FieldBlock>

                  <FieldBlock label={t.fields.offerEnd}>
                    <Input
                      type="date"
                      value={editForm.offer_end_date}
                      disabled={isSaving}
                      onChange={(event) =>
                        updateEditField("offer_end_date", event.target.value)
                      }
                    />
                  </FieldBlock>
                </div>

                <FieldBlock label={t.fields.offerTerms}>
                  <Textarea
                    value={editForm.offer_terms}
                    disabled={isSaving}
                    className="min-h-24"
                    onChange={(event) =>
                      updateEditField("offer_terms", event.target.value)
                    }
                  />
                </FieldBlock>

                <div className="grid gap-4 lg:grid-cols-4">
                  <ToggleBox
                    checked={editForm.is_taxable}
                    disabled={isSaving}
                    title={t.fields.taxRate}
                    onChange={(value) => updateEditField("is_taxable", value)}
                  />

                  <ToggleBox
                    checked={editForm.allow_online_purchase}
                    disabled={isSaving}
                    title={t.fields.online}
                    onChange={(value) =>
                      updateEditField("allow_online_purchase", value)
                    }
                  />

                  <ToggleBox
                    checked={editForm.can_be_ordered}
                    disabled={isSaving}
                    title={t.fields.orderReady}
                    onChange={(value) => updateEditField("can_be_ordered", value)}
                  />

                  <ToggleBox
                    checked={editForm.can_be_used_in_contracts}
                    disabled={isSaving}
                    title={t.fields.contractsReady}
                    onChange={(value) =>
                      updateEditField("can_be_used_in_contracts", value)
                    }
                  />
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers3 className="h-5 w-5" />
                {t.overview}
              </CardTitle>
              <CardDescription>{t.overviewDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border bg-background p-4">
                <p className="text-sm text-muted-foreground">{t.fields.type}</p>
                <p className="mt-2 font-semibold">
                  {typeLabel(product.productType, locale)}
                </p>
              </div>

              <div className="rounded-2xl border bg-background p-4">
                <p className="text-sm text-muted-foreground">{t.fields.status}</p>
                <div className="mt-2">{statusBadge(product.status, locale)}</div>
              </div>

              <div className="rounded-2xl border bg-background p-4">
                <p className="text-sm text-muted-foreground">{t.fields.effectivePrice}</p>
                <p className="mt-2 font-semibold">
                  <SarAmount value={product.effectivePrice} />
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImagePlus className="h-5 w-5" />
                {t.images}
              </CardTitle>
              <CardDescription>{t.imagesDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">{t.fields.thumbnail}</h3>
                  {canUploadProductImages ? (
                    <label className="inline-flex">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={Boolean(uploadingImageType)}
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null;
                          event.target.value = "";
                          uploadImage("thumbnail", file);
                        }}
                      />
                      <span className="inline-flex h-9 cursor-pointer items-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent">
                        {uploadingImageType === "thumbnail" ? (
                          <Loader2 className="me-2 h-4 w-4 animate-spin" />
                        ) : (
                          <UploadCloud className="me-2 h-4 w-4" />
                        )}
                        {t.uploadThumbnail}
                      </span>
                    </label>
                  ) : null}
                </div>

                <RemoteImagePreview
                  src={thumbnailSrc}
                  alt={product.thumbnailImageAltText || product.name}
                  emptyText={t.noImage}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">{t.fields.marketingImage}</h3>
                  {canUploadProductImages ? (
                    <label className="inline-flex">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={Boolean(uploadingImageType)}
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null;
                          event.target.value = "";
                          uploadImage("marketing", file);
                        }}
                      />
                      <span className="inline-flex h-9 cursor-pointer items-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent">
                        {uploadingImageType === "marketing" ? (
                          <Loader2 className="me-2 h-4 w-4 animate-spin" />
                        ) : (
                          <UploadCloud className="me-2 h-4 w-4" />
                        )}
                        {t.uploadMarketing}
                      </span>
                    </label>
                  ) : null}
                </div>

                <RemoteImagePreview
                  src={marketingSrc}
                  alt={product.marketingImageAltText || product.name}
                  emptyText={t.noImage}
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CircleDollarSign className="h-5 w-5" />
                  {t.pricing}
                </CardTitle>
                <CardDescription>{t.pricingDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <Table>
                  <TableBody>
                    <InfoRow
                      label={t.fields.price}
                      value={formatMoney(product.price)}
                      copiedMessage={t.copied}
                    />
                    <InfoRow
                      label={t.fields.salePrice}
                      value={formatMoney(product.salePrice)}
                      copiedMessage={t.copied}
                    />
                    <InfoRow
                      label={t.fields.effectivePrice}
                      value={formatMoney(product.effectivePrice)}
                      copiedMessage={t.copied}
                    />
                    <InfoRow
                      label={t.fields.taxRate}
                      value={`${formatNumber(product.taxRate)}%`}
                      copiedMessage={t.copied}
                    />
                    <InfoRow
                      label={t.fields.taxAmount}
                      value={formatMoney(product.taxAmount)}
                      copiedMessage={t.copied}
                    />
                    <InfoRow
                      label={t.fields.totalWithTax}
                      value={formatMoney(product.totalPriceWithTax)}
                      copiedMessage={t.copied}
                    />
                    <InfoRow
                      label={t.fields.billing}
                      value={billingLabel(product.billingType, locale)}
                      copiedMessage={t.copied}
                    />
                    <InfoRow
                      label={t.fields.fulfillment}
                      value={fulfillmentLabel(product.fulfillmentType, locale)}
                      copiedMessage={t.copied}
                    />
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  {t.marketing}
                </CardTitle>
                <CardDescription>{t.marketingDesc}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <FlagBadge active={product.isOffer} label={t.fields.isOffer} />
                  <FlagBadge active={product.showOnLanding} label={t.fields.landing} />
                  <FlagBadge active={product.showOnMobile} label={t.fields.mobile} />
                  <FlagBadge active={product.showOnOffers} label={t.fields.offers} />
                  <FlagBadge active={product.isCurrentOffer} label={t.marketing} />
                </div>

                <Table>
                  <TableBody>
                    <InfoRow
                      label={t.fields.offerTitle}
                      value={product.offerTitle || "-"}
                      copiedMessage={t.copied}
                    />
                    <InfoRow
                      label={t.fields.offerSubtitle}
                      value={product.offerSubtitle || "-"}
                      copiedMessage={t.copied}
                    />
                    <InfoRow
                      label={t.fields.offerBadge}
                      value={product.offerBadge || "-"}
                      copiedMessage={t.copied}
                    />
                    <InfoRow
                      label={t.fields.offerStart}
                      value={product.offerStartDate || "-"}
                      copiedMessage={t.copied}
                    />
                    <InfoRow
                      label={t.fields.offerEnd}
                      value={product.offerEndDate || "-"}
                      copiedMessage={t.copied}
                    />
                  </TableBody>
                </Table>

                {product.offerTerms ? (
                  <div className="rounded-2xl border bg-background p-4">
                    <p className="mb-2 text-sm font-semibold">{t.fields.offerTerms}</p>
                    <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                      {product.offerTerms}
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                {t.readiness}
              </CardTitle>
              <CardDescription>{t.readinessDesc}</CardDescription>
            </CardHeader>

            <CardContent className="flex flex-wrap gap-2">
              <FlagBadge active={product.isPublic} label={t.fields.public} />
              <FlagBadge active={product.isFeatured} label={t.fields.featured} />
              <FlagBadge active={product.requiresApproval} label={t.fields.approval} />
              <FlagBadge active={product.allowOnlinePurchase} label={t.fields.online} />
              <FlagBadge active={product.allowAgentSale} label={t.fields.agentSale} />
              <FlagBadge active={product.allowProviderSale} label={t.fields.providerSale} />
              <FlagBadge active={product.canBeOrdered} label={t.fields.orderReady} />
              <FlagBadge active={product.canBeUsedInContracts} label={t.fields.contractsReady} />
              <FlagBadge active={product.requiresProvider} label={t.fields.requiresProvider} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {t.description}
              </CardTitle>
              <CardDescription>{t.descriptionDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4">
              <div className="rounded-2xl border bg-background p-4">
                <p className="mb-2 text-sm font-semibold">{t.fields.shortDescription}</p>
                <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                  {product.shortDescription || t.empty}
                </p>
              </div>

              <div className="rounded-2xl border bg-background p-4">
                <p className="mb-2 text-sm font-semibold">{t.fields.fullDescription}</p>
                <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                  {product.description || t.empty}
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border bg-background p-4">
                  <p className="mb-2 text-sm font-semibold">{t.fields.features}</p>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                    {product.features || t.empty}
                  </p>
                </div>

                <div className="rounded-2xl border bg-background p-4">
                  <p className="mb-2 text-sm font-semibold">{t.fields.terms}</p>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                    {product.termsAndConditions || t.empty}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border bg-background p-4">
                <p className="mb-2 text-sm font-semibold">{t.fields.tags}</p>
                <p className="text-sm text-muted-foreground">
                  {product.tags || t.empty}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                {t.advanced}
              </CardTitle>
              <CardDescription>{t.advancedDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border bg-background p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="font-semibold">{t.pricing}</p>
                  <Badge variant="outline">
                    {formatNumber(product.pricingTiers.length)} {t.item}
                  </Badge>
                </div>

                <div className="space-y-2">
                  {product.pricingTiers.length > 0 ? (
                    product.pricingTiers.map((item, index) => {
                      const row = toReadableUnknownRow(item, index);

                      return (
                        <div key={index} className="rounded-xl border bg-muted/30 p-3">
                          <p className="text-sm font-semibold">{row.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{row.subtitle}</p>
                          <p className="mt-1 text-xs font-medium">{row.value}</p>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">{t.empty}</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border bg-background p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="font-semibold">{t.advanced}</p>
                  <Badge variant="outline">
                    {formatNumber(product.serviceItems.length)} {t.item}
                  </Badge>
                </div>

                <div className="space-y-2">
                  {product.serviceItems.length > 0 ? (
                    product.serviceItems.map((item, index) => {
                      const row = toReadableUnknownRow(item, index);

                      return (
                        <div key={index} className="rounded-xl border bg-muted/30 p-3">
                          <p className="text-sm font-semibold">{row.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{row.subtitle}</p>
                          <p className="mt-1 text-xs font-medium">{row.value}</p>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">{t.empty}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}