"use client";

/* ============================================================
   📂 app/system/products/[id]/page.tsx
   🧠 Primey Care | Product Details
   ------------------------------------------------------------
   ✅ المسار: /system/products/[id]
   ✅ الإصدار: v2.0.0 - Centers Pattern + Safe Permissions

   ✅ العمل:
      عرض تفاصيل منتج / بطاقة / عضوية / برنامج / خدمة.

   ✅ Backend:
      GET /api/products/{id}/

   ✅ المعيار:
      - مبني بصريًا على نمط تفاصيل المراكز والعملاء المعتمد.
      - دمج UX Refinement مع حماية المرحلة 2.
      - لا يتم إظهار مسارات تقنية أو API داخل الواجهة.
      - الصفحة ممتدة على عرض المساحة وليست متمركزة.
      - Side Profile Card + Main Content.
      - لا يتم عرض زر حذف نهائي.
      - لا يتم عرض أزرار وهمية أو معطلة.
      - إخفاء الأزرار غير المصرح بها بدل تعطيلها.
      - عدم كسر system_admin / superadmin.
      - Error State مستقل عن Not Found.
      - Skeleton Loading.
      - Empty/Not Found State واضح.
      - نسخ سريع للكود / الاسم / المعرف.
      - Web PDF Print.
      - استخدام /currency/sar.svg.
      - الأرقام بالإنجليزية.
      - دعم عربي / إنجليزي عبر primey-locale.
      - استخدام sonner للتنبيهات.
      - بدون localhost hardcoded.
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ComponentType } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Copy,
  CreditCard,
  Eye,
  FileText,
  Globe2,
  Layers3,
  Loader2,
  Package,
  Percent,
  Printer,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Tag,
  WalletCards,
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
  category_type?: string | null;
  status?: string | null;
};

type ProductDetail = {
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
  pricingTiers: unknown[];
  serviceItems: unknown[];
  notes: string;
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

function normalizeProductDetail(payload: unknown): ProductDetail {
  const obj = unwrapProduct(payload) as Record<string, unknown>;
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
    serviceItemsCount: Array.isArray(serviceItemsRaw)
      ? serviceItemsRaw.length
      : toNumber(getObjectValue(obj, "service_items_count")),
    pricingTiers: Array.isArray(pricingTiersRaw) ? pricingTiersRaw : [],
    serviceItems: Array.isArray(serviceItemsRaw) ? serviceItemsRaw : [],
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
    title: isArabic ? "تفاصيل المنتج" : "Product Details",
    subtitle: isArabic
      ? "عرض بيانات المنتج، التسعير، الجاهزية، قنوات البيع، والربط التشغيلي."
      : "View product data, pricing, readiness, sales channels, and operational linkage.",

    back: isArabic ? "العودة للمنتجات" : "Back to Products",
    productsList: isArabic ? "قائمة المنتجات" : "Products List",
    refresh: isArabic ? "تحديث" : "Refresh",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    retry: isArabic ? "إعادة المحاولة" : "Retry",

    overview: isArabic ? "نظرة عامة" : "Overview",
    overviewDesc: isArabic
      ? "ملخص المنتج وحالته ونوعه وقيمته."
      : "Product summary, status, type, and value.",

    pricing: isArabic ? "التسعير والفوترة" : "Pricing & Billing",
    pricingDesc: isArabic
      ? "السعر الأساسي والخصم والضريبة والفوترة."
      : "Base price, discount, tax, and billing.",

    readiness: isArabic ? "الجاهزية وقنوات البيع" : "Readiness & Sales Channels",
    readinessDesc: isArabic
      ? "حالة توفر المنتج للطلبات والعقود وقنوات البيع."
      : "Product availability for orders, contracts, and sales channels.",

    description: isArabic ? "الوصف والملاحظات" : "Description & Notes",
    descriptionDesc: isArabic
      ? "الوصف التفصيلي والوسوم والملاحظات التشغيلية."
      : "Full description, tags, and operational notes.",

    advanced: isArabic ? "بيانات متقدمة" : "Advanced Data",
    advancedDesc: isArabic
      ? "شرائح التسعير وعناصر الخدمات إن وجدت."
      : "Pricing tiers and service items if available.",

    quickInfo: isArabic ? "معلومات سريعة" : "Quick Info",
    copy: isArabic ? "نسخ" : "Copy",
    copied: isArabic ? "تم النسخ بنجاح" : "Copied successfully",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الصفحة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض تفاصيل المنتجات. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view product details. Contact your system administrator if you need access.",

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
      status: isArabic ? "الحالة" : "Status",
      price: isArabic ? "السعر الأساسي" : "Base Price",
      salePrice: isArabic ? "سعر الخصم" : "Sale Price",
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
      tags: isArabic ? "الوسوم" : "Tags",
      notes: isArabic ? "الملاحظات" : "Notes",
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

    badges: {
      public: isArabic ? "عام" : "Public",
      private: isArabic ? "خاص" : "Private",
      featured: isArabic ? "مميز" : "Featured",
      approval: isArabic ? "يتطلب موافقة" : "Requires Approval",
      orderReady: isArabic ? "جاهز للطلبات" : "Order Ready",
      contractsReady: isArabic ? "جاهز للعقود" : "Contracts Ready",
      requiresProvider: isArabic ? "يتطلب مقدم خدمة" : "Requires Provider",
      online: isArabic ? "شراء إلكتروني" : "Online Purchase",
      agentSale: isArabic ? "بيع مندوب" : "Agent Sale",
      providerSale: isArabic ? "بيع مقدم خدمة" : "Provider Sale",
      taxable: isArabic ? "خاضع للضريبة" : "Taxable",
      notTaxable: isArabic ? "غير خاضع للضريبة" : "Not Taxable",
      discount: isArabic ? "يوجد خصم" : "Has Discount",
    },

    empty: isArabic ? "لا توجد بيانات" : "No data",
    noCategory: isArabic ? "بدون تصنيف" : "No Category",
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
        {Array.from({ length: 4 }).map((_, index) => (
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

  const rows: Array<[string, string]> = [
    [t.fields.name, product.name],
    [t.fields.code, product.code],
    [t.fields.type, typeLabel(product.productType, locale)],
    [t.fields.category, product.categoryName || t.noCategory],
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
    [t.fields.discount, `${formatNumber(product.maxDiscountRate)}%`],
    [
      t.fields.agentCommission,
      `${formatNumber(product.defaultAgentCommissionRate)}%`,
    ],
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
            <h1>${escapeHtml(product.name)}</h1>
            <div class="meta">
              <div>${escapeHtml(t.fields.code)}: ${escapeHtml(product.code)}</div>
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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [notFound, setNotFound] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const authResolving = isAuthResolving(auth);

  const canViewProducts = hasSafePermission(
    auth,
    ["products.view", "products.detail", "products.list"],
    "view",
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

        if (showToast) {
          toast.success(t.refreshSuccess);
        }
      } catch (error) {
        console.error("Failed to load product details:", error);
        setProduct(null);
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [canViewProducts, productId, t.loadError, t.refreshSuccess],
  );

  function printProduct() {
    if (!canPrintProducts || !product) return;

    const printWindow = window.open("", "_blank", "width=1000,height=800");

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
    loadProduct(false);
  }, [authResolving, loadProduct]);

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
            {product?.name || t.title}
          </h1>

          <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
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

          {canViewProductsList ? (
            <Link href="/system/products/list">
              <Button
                variant="outline"
                className="h-10 w-full rounded-xl sm:w-auto"
              >
                <ClipboardList className="h-4 w-4" />
                <span>{t.productsList}</span>
              </Button>
            </Link>
          ) : null}

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadProduct(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refresh}</span>
          </Button>

          {canPrintProducts && product ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={printProduct}
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
              onClick={() => loadProduct(true)}
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
              <Package className="h-7 w-7 text-muted-foreground" />
            </div>

            <div>
              <p className="text-lg font-semibold">{t.notFoundTitle}</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                {t.notFoundText}
              </p>
            </div>

            {canViewProductsList ? (
              <Link href="/system/products/list">
                <Button className="mt-2 rounded-xl">
                  <ClipboardList className="h-4 w-4" />
                  {t.productsList}
                </Button>
              </Link>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Loading */}
      {isLoading ? <DetailSkeleton /> : null}

      {/* Details */}
      {!isLoading && !errorMessage && product && !notFound ? (
        <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          {/* Profile Card */}
          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardContent className="space-y-5 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border bg-muted">
                    <ProductIcon className="h-8 w-8" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-lg font-bold">
                        {product.name}
                      </p>

                      {product.isFeatured ? (
                        <Sparkles className="h-4 w-4 shrink-0 fill-orange-400 text-orange-400" />
                      ) : null}
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {product.code}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {statusBadge(product.status, locale)}
                      <Badge variant="secondary" className="rounded-full">
                        {typeLabel(product.productType, locale)}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">
                    {t.fields.effectivePrice}
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    <SarAmount value={product.effectivePrice} />
                  </p>

                  {product.hasDiscount ? (
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="outline" className="rounded-full">
                        {t.badges.discount}
                      </Badge>
                      <span className="text-sm text-muted-foreground line-through">
                        <SarAmount value={product.price} />
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <Button
                    variant="outline"
                    className="justify-start rounded-xl"
                    onClick={() => copyToClipboard(product.code, t.copied)}
                  >
                    <Copy className="h-4 w-4" />
                    {t.copy} {t.fields.code}
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start rounded-xl"
                    onClick={() => copyToClipboard(product.name, t.copied)}
                  >
                    <Copy className="h-4 w-4" />
                    {t.copy} {t.fields.name}
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start rounded-xl"
                    onClick={() => copyToClipboard(String(product.id), t.copied)}
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
                  icon={Tag}
                  label={t.fields.category}
                  value={product.categoryName || t.noCategory}
                />

                <QuickInfoItem
                  icon={WalletCards}
                  label={t.fields.billing}
                  value={billingLabel(product.billingType, locale)}
                />

                <QuickInfoItem
                  icon={Globe2}
                  label={t.fields.fulfillment}
                  value={fulfillmentLabel(product.fulfillmentType, locale)}
                />

                <QuickInfoItem
                  icon={CalendarDays}
                  label={t.fields.updatedAt}
                  value={formatDate(product.updatedAt || product.createdAt)}
                />
              </CardContent>
            </Card>
          </aside>

          {/* Main Content */}
          <main className="space-y-4">
            {/* Overview */}
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
                        value={String(product.id || "-")}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.name}
                        value={product.name}
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
                        copyable={Boolean(product.slug)}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.type}
                        value={typeLabel(product.productType, locale)}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.category}
                        value={product.categoryName || t.noCategory}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.status}
                        value={statusLabel(product.status, locale)}
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
                </div>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <WalletCards className="h-4 w-4" />
                  {t.pricing}
                </CardTitle>
                <CardDescription>{t.pricingDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    icon={WalletCards}
                    label={t.fields.price}
                    value={<SarAmount value={product.price} />}
                  />
                  <MetricCard
                    icon={Sparkles}
                    label={t.fields.salePrice}
                    value={<SarAmount value={product.salePrice} />}
                  />
                  <MetricCard
                    icon={BadgeCheck}
                    label={t.fields.effectivePrice}
                    value={<SarAmount value={product.effectivePrice} />}
                  />
                  <MetricCard
                    icon={Percent}
                    label={t.fields.taxRate}
                    value={`${formatNumber(product.taxRate)}%`}
                  />
                </div>

                <div className="mt-4 overflow-hidden rounded-xl border">
                  <Table>
                    <TableBody>
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
                      <InfoRow
                        label={t.fields.duration}
                        value={
                          product.durationValue
                            ? `${formatNumber(product.durationValue)} ${
                                product.durationUnit || ""
                              }`
                            : "-"
                        }
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.discount}
                        value={`${formatNumber(product.maxDiscountRate)}%`}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.agentCommission}
                        value={`${formatNumber(
                          product.defaultAgentCommissionRate,
                        )}%`}
                        copiedMessage={t.copied}
                      />
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Readiness */}
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <ShieldCheck className="h-4 w-4" />
                  {t.readiness}
                </CardTitle>
                <CardDescription>{t.readinessDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <FlagBadge active={product.isPublic} label={product.isPublic ? t.badges.public : t.badges.private} />
                  <FlagBadge active={product.isFeatured} label={t.badges.featured} />
                  <FlagBadge active={product.requiresApproval} label={t.badges.approval} />
                  <FlagBadge active={product.canBeOrdered} label={t.badges.orderReady} />
                  <FlagBadge active={product.canBeUsedInContracts} label={t.badges.contractsReady} />
                  <FlagBadge active={product.requiresProvider} label={t.badges.requiresProvider} />
                  <FlagBadge active={product.allowOnlinePurchase} label={t.badges.online} />
                  <FlagBadge active={product.allowAgentSale} label={t.badges.agentSale} />
                  <FlagBadge active={product.allowProviderSale} label={t.badges.providerSale} />
                  <FlagBadge active={product.isTaxable} label={product.isTaxable ? t.badges.taxable : t.badges.notTaxable} />
                </div>
              </CardContent>
            </Card>

            {/* Description */}
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <FileText className="h-4 w-4" />
                  {t.description}
                </CardTitle>
                <CardDescription>{t.descriptionDesc}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <TextSection
                  label={t.fields.shortDescription}
                  value={product.shortDescription}
                  empty={t.empty}
                />
                <TextSection
                  label={t.fields.fullDescription}
                  value={product.description}
                  empty={t.empty}
                />
                <TextSection
                  label={t.fields.tags}
                  value={product.tags}
                  empty={t.empty}
                />
                <TextSection
                  label={t.fields.notes}
                  value={product.notes}
                  empty={t.empty}
                />
              </CardContent>
            </Card>

            {/* Advanced */}
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Layers3 className="h-4 w-4" />
                  {t.advanced}
                </CardTitle>
                <CardDescription>{t.advancedDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4 lg:grid-cols-2">
                <AdvancedList
                  title={t.fields.price}
                  items={product.pricingTiers}
                  empty={t.empty}
                  itemLabel={t.item}
                />

                <AdvancedList
                  title={`${t.badges.requiresProvider} / ${t.productTypes.service}`}
                  items={product.serviceItems}
                  empty={t.empty}
                  itemLabel={t.item}
                />
              </CardContent>
            </Card>
          </main>
        </div>
      ) : null}
    </div>
  );
}

/* ============================================================
   Small Components
============================================================ */

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
  value: React.ReactNode;
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

function AdvancedList({
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
            const row = toReadableUnknownRow(item, index);

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
                    {row.value || "-"}
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