"use client";

/* ============================================================
   📂 app/system/products/create/page.tsx
   🧠 Primey Care | Create Product / Medical Offer
   ------------------------------------------------------------
   ✅ إنشاء منتج / برنامج / خدمة / عرض طبي
   ✅ دعم مقدم خدمة اختياري
   ✅ دعم صورة رمزية وصورة تسويقية
   ✅ دعم الظهور في الهبوط والموبايل والعروض
   ✅ UX Pattern المعتمد + صلاحيات المرحلة 2
============================================================ */

import Image from "next/image";
import { useRouter } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Boxes,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  FileImage,
  FileText,
  ImagePlus,
  Layers3,
  Loader2,
  Package,
  Percent,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Tag,
  Trash2,
  UploadCloud,
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
import { Textarea } from "@/components/ui/textarea";

/* ============================================================
   Types
============================================================ */

type AppLocale = "ar" | "en";
type AuthRecord = Record<string, unknown>;

type ProductType = "membership" | "card" | "program" | "service" | "other";
type ProductStatus = "draft" | "active" | "inactive" | "archived";
type BillingType = "one_time" | "recurring";
type FulfillmentType = "digital" | "physical" | "both" | "service_based" | "none";
type DurationUnit = "day" | "month" | "year" | "none";

type ProductFormData = {
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
  duration_unit: DurationUnit;

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

  pricing_tiers_text: string;
  service_items_text: string;
};

type ProductFormErrors = Partial<Record<keyof ProductFormData, string>>;

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

type CreateProductApiResponse = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[] | string>;
  id?: number | string;
  product?: {
    id?: number | string;
  };
  data?: {
    id?: number | string;
    product?: {
      id?: number | string;
    };
  };
};

const SAR_ICON_PATH = "/currency/sar.svg";
const DRAFT_STORAGE_KEY = "primey-care-product-create-draft-v3";
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
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "إنشاء منتج أو عرض طبي" : "Create Product or Medical Offer",
    subtitle: isArabic
      ? "إضافة بطاقة أو برنامج أو خدمة، مع إمكانية ربطها بمقدم خدمة وعرضها في الهبوط والتطبيق."
      : "Add a card, program, or service, with optional provider linking and landing/mobile visibility.",

    back: isArabic ? "العودة للمنتجات" : "Back to Products",
    productsList: isArabic ? "قائمة المنتجات" : "Products List",
    create: isArabic ? "إنشاء المنتج" : "Create Product",
    saving: isArabic ? "جاري الحفظ..." : "Saving...",
    saveDraft: isArabic ? "حفظ كمسودة محلية" : "Save Local Draft",
    restoreDraft: isArabic ? "استعادة المسودة" : "Restore Draft",
    clearForm: isArabic ? "تفريغ النموذج" : "Clear Form",

    basicInfo: isArabic ? "البيانات الأساسية" : "Basic Information",
    basicDesc: isArabic
      ? "اسم المنتج، الكود، النوع، التصنيف، ومقدم الخدمة عند الحاجة."
      : "Product name, code, type, category, and provider when needed.",

    descriptionInfo: isArabic ? "الوصف والمحتوى" : "Description & Content",
    descriptionDesc: isArabic
      ? "وصف مختصر، وصف تفصيلي، مزايا، شروط، ووسوم."
      : "Short description, full description, features, terms, and tags.",

    marketingInfo: isArabic ? "العرض والظهور التسويقي" : "Offer & Marketing Visibility",
    marketingDesc: isArabic
      ? "تحديد ظهور المنتج في صفحة الهبوط والتطبيق والعروض."
      : "Control product visibility on landing, mobile, and offers.",

    imagesInfo: isArabic ? "صور المنتج" : "Product Images",
    imagesDesc: isArabic
      ? "صورة رمزية للنظام وصورة تسويقية للهبوط والتطبيق."
      : "Thumbnail for the system and marketing image for landing/mobile.",

    pricingInfo: isArabic ? "التسعير والفوترة" : "Pricing & Billing",
    pricingDesc: isArabic
      ? "السعر الأساسي، سعر الخصم، الضريبة، الفوترة، والمدة."
      : "Base price, sale price, tax, billing, and duration.",

    availabilityInfo: isArabic ? "الجاهزية وقنوات البيع" : "Readiness & Sales Channels",
    availabilityDesc: isArabic
      ? "تحديد جاهزية المنتج للطلبات والعقود وقنوات البيع."
      : "Define product readiness for orders, contracts, and sales channels.",

    limitsInfo: isArabic ? "الخصومات والعمولات" : "Discounts & Commissions",
    limitsDesc: isArabic
      ? "الحد الأعلى للخصم وعمولة المندوب الافتراضية."
      : "Maximum discount and default agent commission.",

    advancedInfo: isArabic ? "بيانات متقدمة" : "Advanced Data",
    advancedDesc: isArabic
      ? "شرائح التسعير وعناصر الخدمات للبرامج والخدمات المركبة."
      : "Pricing tiers and service items for programs and bundled services.",

    summaryTitle: isArabic ? "ملخص المنتج" : "Product Summary",
    summaryDesc: isArabic
      ? "مراجعة سريعة للبيانات قبل الحفظ."
      : "Quick review before saving.",

    stepsTitle: isArabic ? "إرشادات قبل الحفظ" : "Before Saving",
    stepsDesc: isArabic
      ? "نقاط تساعدك على إدخال بيانات دقيقة."
      : "Helpful points for entering accurate data.",

    formErrorTitle: isArabic ? "تعذر حفظ البيانات" : "Unable to save data",

    accessDeniedTitle: isArabic ? "غير مصرح بإنشاء منتج" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية إنشاء المنتجات. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to create products. Contact your system administrator if you need access.",

    fields: {
      name: isArabic ? "اسم المنتج" : "Product Name",
      code: isArabic ? "كود المنتج" : "Product Code",
      slug: isArabic ? "الرابط المختصر" : "Slug",
      type: isArabic ? "نوع المنتج" : "Product Type",
      status: isArabic ? "الحالة" : "Status",
      category: isArabic ? "التصنيف" : "Category",
      provider: isArabic ? "مقدم الخدمة" : "Provider",
      shortDescription: isArabic ? "الوصف المختصر" : "Short Description",
      description: isArabic ? "الوصف التفصيلي" : "Full Description",
      features: isArabic ? "المزايا" : "Features",
      terms: isArabic ? "الشروط والأحكام" : "Terms & Conditions",
      tags: isArabic ? "الوسوم" : "Tags",
      price: isArabic ? "السعر الأساسي" : "Base Price",
      salePrice: isArabic ? "سعر الخصم" : "Sale Price",
      costPrice: isArabic ? "التكلفة" : "Cost Price",
      billingType: isArabic ? "نوع الفوترة" : "Billing Type",
      fulfillmentType: isArabic ? "نوع التسليم" : "Fulfillment Type",
      durationValue: isArabic ? "مدة المنتج" : "Duration",
      durationUnit: isArabic ? "وحدة المدة" : "Duration Unit",
      taxable: isArabic ? "خاضع للضريبة" : "Taxable",
      taxRate: isArabic ? "نسبة الضريبة" : "Tax Rate",
      isOffer: isArabic ? "منتج يظهر كعرض" : "Mark as Offer",
      offerTitle: isArabic ? "عنوان العرض" : "Offer Title",
      offerSubtitle: isArabic ? "وصف العرض المختصر" : "Offer Subtitle",
      offerBadge: isArabic ? "شارة العرض" : "Offer Badge",
      offerTerms: isArabic ? "شروط العرض" : "Offer Terms",
      offerStart: isArabic ? "بداية العرض" : "Offer Start",
      offerEnd: isArabic ? "نهاية العرض" : "Offer End",
      landing: isArabic ? "يظهر في صفحة الهبوط" : "Show on Landing",
      mobile: isArabic ? "يظهر في التطبيق" : "Show on Mobile",
      offers: isArabic ? "يظهر في صفحة العروض" : "Show on Offers",
      thumbnail: isArabic ? "الصورة الرمزية" : "Thumbnail Image",
      marketingImage: isArabic ? "الصورة التسويقية" : "Marketing Image",
      public: isArabic ? "منتج عام" : "Public Product",
      featured: isArabic ? "منتج مميز" : "Featured Product",
      requiresApproval: isArabic ? "يتطلب موافقة" : "Requires Approval",
      onlinePurchase: isArabic ? "الشراء الإلكتروني" : "Online Purchase",
      agentSale: isArabic ? "بيع المندوب" : "Agent Sale",
      providerSale: isArabic ? "بيع مقدم الخدمة" : "Provider Sale",
      canBeOrdered: isArabic ? "جاهز للطلبات" : "Order Ready",
      contractsReady: isArabic ? "جاهز للعقود" : "Contracts Ready",
      requiresProvider: isArabic ? "يتطلب مقدم خدمة" : "Requires Provider",
      maxDiscount: isArabic ? "الحد الأعلى للخصم" : "Max Discount",
      agentCommission: isArabic ? "عمولة المندوب الافتراضية" : "Default Agent Commission",
      pricingTiers: isArabic ? "شرائح التسعير" : "Pricing Tiers",
      serviceItems: isArabic ? "عناصر الخدمات" : "Service Items",
    },

    placeholders: {
      name: isArabic ? "مثال: برنامج الولادة الطبيعية" : "Example: Natural Delivery Program",
      code: isArabic ? "اتركه فارغًا للتوليد التلقائي" : "Leave blank for auto generation",
      slug: isArabic ? "natural-delivery-program" : "natural-delivery-program",
      shortDescription: isArabic
        ? "وصف مختصر يظهر في القوائم..."
        : "Short description shown in lists...",
      description: isArabic
        ? "اكتب وصفًا تفصيليًا للمنتج أو العرض..."
        : "Write a detailed product or offer description...",
      features: isArabic
        ? "ميزة في كل سطر..."
        : "One feature per line...",
      terms: isArabic
        ? "شروط وأحكام المنتج أو العرض..."
        : "Product or offer terms...",
      tags: isArabic ? "ولادة، عروض، مستشفى" : "delivery, offers, hospital",
      price: isArabic ? "مثال: 2300" : "Example: 2300",
      salePrice: isArabic ? "مثال: 1999" : "Example: 1999",
      costPrice: isArabic ? "اختياري" : "Optional",
      durationValue: isArabic ? "مثال: 12" : "Example: 12",
      taxRate: isArabic ? "مثال: 15" : "Example: 15",
      offerTitle: isArabic ? "مثال: عرض الولادة الطبيعية" : "Example: Natural Delivery Offer",
      offerSubtitle: isArabic
        ? "مثال: بطاقة خصومات مجانية لمدة عام"
        : "Example: Free discount card for one year",
      offerBadge: isArabic ? "مثال: عرض محدود" : "Example: Limited Offer",
      maxDiscount: isArabic ? "مثال: 20" : "Example: 20",
      agentCommission: isArabic ? "مثال: 10" : "Example: 10",
      pricingTiers: isArabic
        ? "اكتب كل شريحة في سطر: الاسم | السعر | سعر الخصم"
        : "One tier per line: name | price | sale price",
      serviceItems: isArabic
        ? "اكتب كل خدمة في سطر: اسم الخدمة | الكمية | السعر"
        : "One service per line: service name | quantity | price",
    },

    productTypes: {
      membership: isArabic ? "عضوية" : "Membership",
      card: isArabic ? "بطاقة" : "Card",
      program: isArabic ? "برنامج" : "Program",
      service: isArabic ? "خدمة" : "Service",
      other: isArabic ? "أخرى" : "Other",
    } satisfies Record<ProductType, string>,

    statuses: {
      draft: isArabic ? "مسودة" : "Draft",
      active: isArabic ? "نشط" : "Active",
      inactive: isArabic ? "غير نشط" : "Inactive",
      archived: isArabic ? "مؤرشف" : "Archived",
    } satisfies Record<ProductStatus, string>,

    billingTypes: {
      one_time: isArabic ? "مرة واحدة" : "One Time",
      recurring: isArabic ? "متكرر" : "Recurring",
    } satisfies Record<BillingType, string>,

    fulfillmentTypes: {
      digital: isArabic ? "رقمي" : "Digital",
      physical: isArabic ? "فعلي" : "Physical",
      both: isArabic ? "رقمي وفعلي" : "Digital & Physical",
      service_based: isArabic ? "مرتبط بخدمة" : "Service Based",
      none: isArabic ? "بدون" : "None",
    } satisfies Record<FulfillmentType, string>,

    durationUnits: {
      day: isArabic ? "يوم" : "Day",
      month: isArabic ? "شهر" : "Month",
      year: isArabic ? "سنة" : "Year",
      none: isArabic ? "بدون" : "None",
    } satisfies Record<DurationUnit, string>,

    validation: {
      name: isArabic ? "اسم المنتج مطلوب." : "Product name is required.",
      price: isArabic ? "السعر يجب أن يكون رقمًا صحيحًا." : "Price must be a valid number.",
      salePrice: isArabic ? "سعر الخصم يجب أن يكون رقمًا صحيحًا." : "Sale price must be a valid number.",
      saleGreater: isArabic
        ? "سعر الخصم لا يجب أن يكون أكبر من السعر الأساسي."
        : "Sale price must not be greater than base price.",
      percent: isArabic
        ? "النسبة يجب أن تكون بين 0 و 100."
        : "Percentage must be between 0 and 100.",
      duration: isArabic ? "المدة يجب أن تكون رقمًا صحيحًا." : "Duration must be a valid number.",
      offerDates: isArabic
        ? "تاريخ نهاية العرض يجب أن يكون بعد تاريخ البداية."
        : "Offer end date must be after start date.",
      imageSize: isArabic
        ? "حجم الصورة يجب ألا يتجاوز 10MB."
        : "Image size must not exceed 10MB.",
      imageType: isArabic
        ? "يرجى اختيار ملف صورة صالح."
        : "Please select a valid image file.",
    },

    loadingLookups: isArabic ? "جاري تحميل الخيارات..." : "Loading options...",
    noCategory: isArabic ? "بدون تصنيف" : "No Category",
    noProvider: isArabic ? "بدون مقدم خدمة" : "No Provider",
    chooseFile: isArabic ? "اختيار صورة" : "Choose Image",
    fileSelected: isArabic ? "تم اختيار الصورة" : "Image selected",

    success: isArabic ? "تم إنشاء المنتج بنجاح." : "Product created successfully.",
    imageUploadPartial: isArabic
      ? "تم إنشاء المنتج، لكن تعذر رفع إحدى الصور."
      : "Product created, but one image could not be uploaded.",
    draftSaved: isArabic ? "تم حفظ المسودة محليًا." : "Draft saved locally.",
    draftRestored: isArabic ? "تمت استعادة المسودة." : "Draft restored.",
    noDraft: isArabic ? "لا توجد مسودة محفوظة." : "No saved draft found.",
    formCleared: isArabic ? "تم تفريغ النموذج." : "Form cleared.",
    apiError: isArabic
      ? "تعذر إنشاء المنتج. تحقق من البيانات وحاول مرة أخرى."
      : "Unable to create product. Please check the data and try again.",
    validationToast: isArabic
      ? "يرجى تصحيح الحقول المطلوبة قبل المتابعة."
      : "Please fix the required fields before continuing.",
    confirmLeave: isArabic
      ? "لديك بيانات غير محفوظة. هل تريد المغادرة؟"
      : "You have unsaved changes. Do you want to leave?",
    confirmClear: isArabic
      ? "سيتم تفريغ النموذج الحالي. هل تريد المتابعة؟"
      : "The current form will be cleared. Do you want to continue?",

    completion: isArabic ? "نسبة الاكتمال" : "Completion",
    ready: isArabic ? "جاهز للحفظ" : "Ready to save",
    missingData: isArabic ? "ينقصه بيانات أساسية" : "Missing required data",
    priceSummary: isArabic ? "التسعير" : "Pricing",
    saleChannelsSummary: isArabic ? "قنوات البيع" : "Sales Channels",
    readinessSummary: isArabic ? "الجاهزية" : "Readiness",
    offerSummary: isArabic ? "العرض" : "Offer",

    yes: isArabic ? "نعم" : "Yes",
    no: isArabic ? "لا" : "No",

    quickNotes: [
      isArabic
        ? "صورة المنتج الرمزية مخصصة للنظام الداخلي."
        : "The thumbnail image is for the internal system.",
      isArabic
        ? "الصورة التسويقية مخصصة للهبوط والتطبيق والعروض."
        : "The marketing image is for landing, mobile, and offers.",
      isArabic
        ? "اربط المنتج بمقدم خدمة عندما يكون العرض خاصًا بمستشفى أو مركز."
        : "Link a provider when the offer belongs to a hospital or center.",
      isArabic
        ? "يمكن حفظ البيانات كمسودة محلية قبل الإرسال."
        : "You can save the form as a local draft before submitting.",
    ],
  };
}

/* ============================================================
   Defaults / Validation
============================================================ */

const initialFormData: ProductFormData = {
  name: "",
  code: "",
  slug: "",
  product_type: "program",
  status: "active",
  category_id: "",
  provider_id: "",

  short_description: "",
  description: "",
  terms_and_conditions: "",
  features: "",
  tags: "",

  price: "",
  sale_price: "",
  cost_price: "",
  billing_type: "one_time",
  fulfillment_type: "service_based",
  duration_value: "0",
  duration_unit: "none",

  is_taxable: true,
  tax_rate: "15",

  is_offer: false,
  offer_title: "",
  offer_subtitle: "",
  offer_badge: "",
  offer_terms: "",
  offer_start_date: "",
  offer_end_date: "",
  show_on_landing: false,
  show_on_mobile: false,
  show_on_offers: false,

  is_public: true,
  is_featured: false,
  requires_approval: false,

  allow_online_purchase: true,
  allow_agent_sale: true,
  allow_provider_sale: false,

  can_be_ordered: true,
  can_be_used_in_contracts: true,
  requires_provider: false,

  max_discount_rate: "0",
  default_agent_commission_rate: "0",

  pricing_tiers_text: "",
  service_items_text: "",
};

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

function toNumber(value: string) {
  const parsed = Number(String(value || "").replace(/,/g, ""));

  return Number.isFinite(parsed) ? parsed : 0;
}

function isValidNumber(value: string) {
  if (!value.trim()) return true;

  const parsed = Number(value.replace(/,/g, ""));

  return Number.isFinite(parsed);
}

function isPercent(value: string) {
  if (!value.trim()) return true;

  const parsed = Number(value.replace(/,/g, ""));

  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
}

function isValidImage(file: File | null) {
  if (!file) return true;

  return file.type.startsWith("image/");
}

function isValidImageSize(file: File | null) {
  if (!file) return true;

  return file.size <= MAX_IMAGE_SIZE;
}

function parsePricingTiers(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [name = "", price = "0", salePrice = ""] = line
        .split("|")
        .map((part) => part.trim());

      return {
        name,
        pricing_type: "standard",
        currency_code: "SAR",
        price: normalizeNumberString(price || "0"),
        sale_price: salePrice ? normalizeNumberString(salePrice) : null,
        min_quantity: 1,
        discount_rate: "0",
        agent_commission_rate: "0",
        provider_share_rate: "0",
        system_share_rate: "0",
        sort_order: index,
        is_active: true,
      };
    })
    .filter((item) => item.name);
}

function parseServiceItems(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [name = "", quantity = "1", unitPrice = "0"] = line
        .split("|")
        .map((part) => part.trim());

      return {
        name,
        description: "",
        included_quantity: Math.max(1, Math.round(toNumber(quantity || "1"))),
        unit_price: normalizeNumberString(unitPrice || "0"),
        discount_rate: "0",
        requires_provider: true,
        is_optional: false,
        sort_order: index,
        is_active: true,
      };
    })
    .filter((item) => item.name);
}

function normalizePayload(formData: ProductFormData) {
  const price = normalizeNumberString(formData.price);
  const salePrice = formData.sale_price.trim()
    ? normalizeNumberString(formData.sale_price)
    : null;
  const costPrice = formData.cost_price.trim()
    ? normalizeNumberString(formData.cost_price)
    : null;

  const providerId = formData.provider_id.trim();
  const categoryId = formData.category_id.trim();

  return {
    name: formData.name.trim(),
    ...(formData.code.trim() ? { code: normalizeCode(formData.code) } : {}),
    ...(formData.slug.trim()
      ? { slug: normalizeSlug(formData.slug) }
      : { slug: normalizeSlug(formData.name) }),
    product_type: formData.product_type,
    status: formData.status,
    category_id: categoryId || null,
    provider_id: providerId || null,

    short_description: formData.short_description.trim(),
    description: formData.description.trim(),
    terms_and_conditions: formData.terms_and_conditions.trim(),
    features: formData.features.trim(),
    tags: formData.tags.trim(),

    price,
    sale_price: salePrice,
    cost_price: costPrice,
    billing_type: formData.billing_type,
    fulfillment_type: formData.fulfillment_type,
    duration_value: formData.duration_value.trim()
      ? String(Math.max(0, Math.round(toNumber(formData.duration_value))))
      : "0",
    duration_unit: formData.duration_unit,

    is_taxable: formData.is_taxable,
    tax_rate: formData.tax_rate.trim()
      ? String(toNumber(formData.tax_rate))
      : "0",

    is_offer: formData.is_offer,
    offer_title: formData.offer_title.trim(),
    offer_subtitle: formData.offer_subtitle.trim(),
    offer_badge: formData.offer_badge.trim(),
    offer_terms: formData.offer_terms.trim(),
    offer_start_date: formData.offer_start_date || null,
    offer_end_date: formData.offer_end_date || null,
    show_on_landing: formData.show_on_landing,
    show_on_mobile: formData.show_on_mobile,
    show_on_offers: formData.show_on_offers,

    is_public: formData.is_public,
    is_featured: formData.is_featured,
    requires_approval: formData.requires_approval,

    allow_online_purchase: formData.allow_online_purchase,
    allow_agent_sale: formData.allow_agent_sale,
    allow_provider_sale: formData.allow_provider_sale,

    can_be_ordered: formData.can_be_ordered,
    can_be_used_in_contracts: formData.can_be_used_in_contracts,
    requires_provider: Boolean(providerId) || formData.requires_provider,

    max_discount_rate: formData.max_discount_rate.trim()
      ? String(toNumber(formData.max_discount_rate))
      : "0",
    default_agent_commission_rate: formData.default_agent_commission_rate.trim()
      ? String(toNumber(formData.default_agent_commission_rate))
      : "0",

    pricing_tiers: parsePricingTiers(formData.pricing_tiers_text),
    service_items: parseServiceItems(formData.service_items_text),
  };
}

function hasFormChanges(formData: ProductFormData) {
  return JSON.stringify(formData) !== JSON.stringify(initialFormData);
}

function resolveCreatedId(result: CreateProductApiResponse) {
  return (
    result.product?.id ||
    result.data?.product?.id ||
    result.data?.id ||
    result.id ||
    null
  );
}

function mapApiFieldErrors(
  errors: CreateProductApiResponse["errors"],
): ProductFormErrors {
  const nextErrors: ProductFormErrors = {};

  if (!errors) return nextErrors;

  Object.entries(errors).forEach(([key, value]) => {
    const message = Array.isArray(value) ? value[0] : value;

    if (!message) return;

    if (key === "name") nextErrors.name = String(message);
    if (key === "code") nextErrors.code = String(message);
    if (key === "slug") nextErrors.slug = String(message);
    if (key === "product_type" || key === "type") {
      nextErrors.product_type = String(message);
    }
    if (key === "status") nextErrors.status = String(message);
    if (key === "category_id") nextErrors.category_id = String(message);
    if (key === "provider_id") nextErrors.provider_id = String(message);
    if (key === "price" || key === "base_price") nextErrors.price = String(message);
    if (key === "sale_price") nextErrors.sale_price = String(message);
    if (key === "cost_price") nextErrors.cost_price = String(message);
    if (key === "tax_rate") nextErrors.tax_rate = String(message);
    if (key === "duration_value") nextErrors.duration_value = String(message);
    if (key === "offer_start_date") nextErrors.offer_start_date = String(message);
    if (key === "offer_end_date") nextErrors.offer_end_date = String(message);
    if (key === "max_discount_rate") nextErrors.max_discount_rate = String(message);
    if (key === "default_agent_commission_rate") {
      nextErrors.default_agent_commission_rate = String(message);
    }
  });

  return nextErrors;
}

function formatMoney(value: number | string): string {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return "0.00";

  return numericValue.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function optionLabel(option: SelectOption, locale: AppLocale) {
  const primary =
    locale === "ar"
      ? option.name_ar || option.name || option.title || option.name_en
      : option.name_en || option.name || option.title || option.name_ar;

  const code = option.code ? ` - ${option.code}` : "";

  return `${primary || option.id}${code}`;
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
   Small UI
============================================================ */

function FieldBlock({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {label}
        {required ? <span className="ms-1 text-destructive">*</span> : null}
      </Label>

      {children}

      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

function ToggleBox({
  checked,
  disabled,
  title,
  description,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  title: string;
  description: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border bg-background p-4">
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(Boolean(value))}
      />

      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
    </label>
  );
}

function SummaryItem({
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

function FilePicker({
  label,
  file,
  disabled,
  onChange,
}: {
  label: string;
  file: File | null;
  disabled?: boolean;
  onChange: (file: File | null) => void;
}) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-muted-foreground">
            {file ? file.name : "PNG / JPG / WEBP"}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
          <FileImage className="h-5 w-5" />
        </div>
      </div>

      <Input
        type="file"
        accept="image/*"
        disabled={disabled}
        className="mt-4"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />

      {file ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="mt-2"
          onClick={() => onChange(null)}
        >
          <Trash2 className="me-2 h-4 w-4" />
          إزالة
        </Button>
      ) : null}
    </div>
  );
}

/* ============================================================
   Page
============================================================ */

export default function SystemCreateProductPage() {
  const router = useRouter();
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [formData, setFormData] = useState<ProductFormData>(initialFormData);
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<SelectOption[]>([]);
  const [providers, setProviders] = useState<SelectOption[]>([]);
  const [isLoadingLookups, setIsLoadingLookups] = useState(true);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [marketingFile, setMarketingFile] = useState<File | null>(null);

  const t = useMemo(() => dictionary(locale), [locale]);
  const authResolving = isAuthResolving(auth);
  const isDirty = useMemo(() => hasFormChanges(formData), [formData]);

  const canCreateProducts = hasSafePermission(
    auth,
    ["products.create", "products.add", "products.add_product"],
    "action",
  );

  const canViewProducts = hasSafePermission(
    auth,
    ["products.view", "products.list", "products.view_product"],
    "view",
  );

  const completedFields = useMemo(() => {
    const keys: Array<keyof ProductFormData> = [
      "name",
      "product_type",
      "status",
      "price",
      "billing_type",
      "fulfillment_type",
      "tax_rate",
      "max_discount_rate",
      "default_agent_commission_rate",
    ];

    return keys.filter((key) => {
      const value = formData[key];

      if (typeof value === "boolean") return value;
      return String(value || "").trim().length > 0;
    }).length;
  }, [formData]);

  const progressPercent = Math.round((completedFields / 9) * 100);

  const effectivePrice = useMemo(() => {
    const salePrice = toNumber(formData.sale_price);
    const basePrice = toNumber(formData.price);

    return salePrice > 0 ? salePrice : basePrice;
  }, [formData.price, formData.sale_price]);

  const selectedProductTypeLabel = t.productTypes[formData.product_type];
  const selectedStatusLabel = t.statuses[formData.status];

  const isReadyToSave =
    formData.name.trim().length > 0 && isValidNumber(formData.price);

  function updateField<K extends keyof ProductFormData>(
    key: K,
    value: ProductFormData[K],
  ) {
    setFormData((current) => {
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

    setErrors((current) => ({
      ...current,
      [key]: undefined,
    }));

    if (submitError) {
      setSubmitError("");
    }
  }

  function validateForm() {
    const nextErrors: ProductFormErrors = {};

    const basePrice = toNumber(formData.price);
    const salePrice = toNumber(formData.sale_price);

    if (!formData.name.trim()) {
      nextErrors.name = t.validation.name;
    }

    if (!isValidNumber(formData.price)) {
      nextErrors.price = t.validation.price;
    }

    if (!isValidNumber(formData.sale_price)) {
      nextErrors.sale_price = t.validation.salePrice;
    }

    if (
      formData.sale_price.trim() &&
      salePrice > 0 &&
      basePrice > 0 &&
      salePrice > basePrice
    ) {
      nextErrors.sale_price = t.validation.saleGreater;
    }

    if (!isValidNumber(formData.cost_price)) {
      nextErrors.cost_price = t.validation.price;
    }

    if (!isValidNumber(formData.duration_value)) {
      nextErrors.duration_value = t.validation.duration;
    }

    if (!isPercent(formData.tax_rate)) {
      nextErrors.tax_rate = t.validation.percent;
    }

    if (!isPercent(formData.max_discount_rate)) {
      nextErrors.max_discount_rate = t.validation.percent;
    }

    if (!isPercent(formData.default_agent_commission_rate)) {
      nextErrors.default_agent_commission_rate = t.validation.percent;
    }

    if (
      formData.offer_start_date &&
      formData.offer_end_date &&
      formData.offer_end_date < formData.offer_start_date
    ) {
      nextErrors.offer_end_date = t.validation.offerDates;
    }

    if (!isValidImage(thumbnailFile) || !isValidImage(marketingFile)) {
      toast.error(t.validation.imageType);
      return false;
    }

    if (!isValidImageSize(thumbnailFile) || !isValidImageSize(marketingFile)) {
      toast.error(t.validation.imageSize);
      return false;
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  async function uploadProductImage(
    productId: string | number,
    imageType: "thumbnail" | "marketing",
    file: File,
  ) {
    const form = new FormData();
    form.append("file", file);
    form.append("image_type", imageType);
    form.append("alt_text", formData.name.trim());

    const csrfToken = readCookie("csrftoken");

    const response = await fetch(apiUrl(`/api/products/${productId}/upload-image/`), {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
      },
      body: form,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${imageType}`);
    }
  }

  async function submitForm() {
    setSubmitError("");

    if (!validateForm()) {
      toast.error(t.validationToast);
      return;
    }

    try {
      setIsSubmitting(true);

      const csrfToken = readCookie("csrftoken");

      const response = await fetch(apiUrl("/api/products/"), {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
        },
        body: JSON.stringify(normalizePayload(formData)),
      });

      const result = (await response.json().catch(() => ({}))) as CreateProductApiResponse;

      if (!response.ok || result.ok === false) {
        const apiErrors = mapApiFieldErrors(result.errors);

        setErrors(apiErrors);
        setSubmitError(result.message || t.apiError);
        toast.error(result.message || t.apiError);
        return;
      }

      const createdId = resolveCreatedId(result);
      let imageUploadFailed = false;

      if (createdId) {
        try {
          if (thumbnailFile) {
            await uploadProductImage(createdId, "thumbnail", thumbnailFile);
          }

          if (marketingFile) {
            await uploadProductImage(createdId, "marketing", marketingFile);
          }
        } catch (error) {
          console.error("Product image upload error:", error);
          imageUploadFailed = true;
        }
      }

      try {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch (error) {
        console.error("Remove draft error:", error);
      }

      toast.success(imageUploadFailed ? t.imageUploadPartial : t.success);

      if (createdId) {
        router.push(`/system/products/${createdId}`);
        return;
      }

      router.push("/system/products/list");
    } catch (error) {
      console.error("Create product error:", error);
      setSubmitError(t.apiError);
      toast.error(t.apiError);
    } finally {
      setIsSubmitting(false);
    }
  }

  function saveDraft() {
    try {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formData));
      toast.success(t.draftSaved);
    } catch (error) {
      console.error("Save draft error:", error);
    }
  }

  function restoreDraft() {
    try {
      const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY);

      if (!saved) {
        toast.message(t.noDraft);
        return;
      }

      const parsed = JSON.parse(saved) as ProductFormData;
      setFormData({ ...initialFormData, ...parsed });
      toast.success(t.draftRestored);
    } catch (error) {
      console.error("Restore draft error:", error);
    }
  }

  function clearForm() {
    if (!window.confirm(t.confirmClear)) return;

    setFormData(initialFormData);
    setErrors({});
    setSubmitError("");
    setThumbnailFile(null);
    setMarketingFile(null);
    toast.success(t.formCleared);
  }

  function safeBack() {
    if (isDirty && !window.confirm(t.confirmLeave)) return;

    router.push("/system/products");
  }

  async function loadLookups() {
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
        const categoriesPayload =
          (await categoriesResponse.json().catch(() => ({}))) as ListApiResponse<SelectOption>;
        setCategories(extractList(categoriesPayload));
      }

      if (providersResponse.ok) {
        const providersPayload =
          (await providersResponse.json().catch(() => ({}))) as ListApiResponse<SelectOption>;
        setProviders(extractList(providersPayload));
      }
    } catch (error) {
      console.error("Load product create lookups error:", error);
    } finally {
      setIsLoadingLookups(false);
    }
  }

  useEffect(() => {
    const nextLocale = readLocale();

    setLocale(nextLocale);
    applyDocumentLocale(nextLocale);
    loadLookups();
  }, []);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!hasFormChanges(formData)) return;

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);

    return () => window.removeEventListener("beforeunload", handler);
  }, [formData]);

  if (authResolving) {
    return (
      <div className="w-full space-y-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-6">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm text-muted-foreground">{t.loadingLookups}</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canCreateProducts) {
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

            {canViewProducts ? (
              <Button type="button" variant="outline" onClick={() => router.push("/system/products")}>
                <ArrowLeft className="me-2 h-4 w-4" />
                {t.back}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              <Package className="me-1 h-3.5 w-3.5" />
              {selectedProductTypeLabel}
            </Badge>

            <Badge variant={formData.status === "active" ? "default" : "outline"} className="rounded-full">
              {selectedStatusLabel}
            </Badge>

            {formData.is_offer ? (
              <Badge variant="outline" className="rounded-full">
                <Sparkles className="me-1 h-3.5 w-3.5" />
                {t.fields.isOffer}
              </Badge>
            ) : null}
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canViewProducts ? (
            <Button type="button" variant="outline" onClick={safeBack}>
              <ArrowLeft className="me-2 h-4 w-4" />
              {t.back}
            </Button>
          ) : null}

          <Button type="button" variant="outline" onClick={restoreDraft} disabled={isSubmitting}>
            <RotateCcw className="me-2 h-4 w-4" />
            {t.restoreDraft}
          </Button>

          <Button type="button" variant="outline" onClick={saveDraft} disabled={isSubmitting}>
            <ClipboardList className="me-2 h-4 w-4" />
            {t.saveDraft}
          </Button>

          <Button type="button" variant="destructive" onClick={clearForm} disabled={isSubmitting}>
            <Trash2 className="me-2 h-4 w-4" />
            {t.clearForm}
          </Button>

          <Button type="button" onClick={submitForm} disabled={isSubmitting || !isReadyToSave}>
            {isSubmitting ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="me-2 h-4 w-4" />
            )}
            {isSubmitting ? t.saving : t.create}
          </Button>
        </div>
      </div>

      {submitError ? (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
            <div>
              <p className="font-semibold text-destructive">{t.formErrorTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">{submitError}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers3 className="h-5 w-5" />
                {t.basicInfo}
              </CardTitle>
              <CardDescription>{t.basicDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 lg:grid-cols-2">
              <FieldBlock label={t.fields.name} error={errors.name} required>
                <Input
                  value={formData.name}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.name}
                  onChange={(event) => updateField("name", event.target.value)}
                />
              </FieldBlock>

              <FieldBlock label={t.fields.code} error={errors.code}>
                <Input
                  value={formData.code}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.code}
                  onChange={(event) => updateField("code", normalizeCode(event.target.value))}
                />
              </FieldBlock>

              <FieldBlock label={t.fields.slug} error={errors.slug}>
                <Input
                  value={formData.slug}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.slug}
                  onChange={(event) => updateField("slug", normalizeSlug(event.target.value))}
                />
              </FieldBlock>

              <FieldBlock label={t.fields.type} error={errors.product_type}>
                <select
                  value={formData.product_type}
                  disabled={isSubmitting}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  onChange={(event) =>
                    updateField("product_type", event.target.value as ProductType)
                  }
                >
                  {Object.entries(t.productTypes).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </FieldBlock>

              <FieldBlock label={t.fields.status} error={errors.status}>
                <select
                  value={formData.status}
                  disabled={isSubmitting}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  onChange={(event) =>
                    updateField("status", event.target.value as ProductStatus)
                  }
                >
                  {Object.entries(t.statuses).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </FieldBlock>

              <FieldBlock label={t.fields.category} error={errors.category_id}>
                <select
                  value={formData.category_id}
                  disabled={isSubmitting || isLoadingLookups}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  onChange={(event) => updateField("category_id", event.target.value)}
                >
                  <option value="">{t.noCategory}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {optionLabel(category, locale)}
                    </option>
                  ))}
                </select>
              </FieldBlock>

              <FieldBlock label={t.fields.provider} error={errors.provider_id}>
                <select
                  value={formData.provider_id}
                  disabled={isSubmitting || isLoadingLookups}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  onChange={(event) => updateField("provider_id", event.target.value)}
                >
                  <option value="">{t.noProvider}</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {optionLabel(provider, locale)}
                    </option>
                  ))}
                </select>
              </FieldBlock>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {t.descriptionInfo}
              </CardTitle>
              <CardDescription>{t.descriptionDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4">
              <FieldBlock label={t.fields.shortDescription} error={errors.short_description}>
                <Input
                  value={formData.short_description}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.shortDescription}
                  onChange={(event) => updateField("short_description", event.target.value)}
                />
              </FieldBlock>

              <FieldBlock label={t.fields.description} error={errors.description}>
                <Textarea
                  value={formData.description}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.description}
                  className="min-h-28"
                  onChange={(event) => updateField("description", event.target.value)}
                />
              </FieldBlock>

              <div className="grid gap-4 lg:grid-cols-2">
                <FieldBlock label={t.fields.features} error={errors.features}>
                  <Textarea
                    value={formData.features}
                    disabled={isSubmitting}
                    placeholder={t.placeholders.features}
                    className="min-h-24"
                    onChange={(event) => updateField("features", event.target.value)}
                  />
                </FieldBlock>

                <FieldBlock label={t.fields.terms} error={errors.terms_and_conditions}>
                  <Textarea
                    value={formData.terms_and_conditions}
                    disabled={isSubmitting}
                    placeholder={t.placeholders.terms}
                    className="min-h-24"
                    onChange={(event) =>
                      updateField("terms_and_conditions", event.target.value)
                    }
                  />
                </FieldBlock>
              </div>

              <FieldBlock label={t.fields.tags} error={errors.tags}>
                <Input
                  value={formData.tags}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.tags}
                  onChange={(event) => updateField("tags", event.target.value)}
                />
              </FieldBlock>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                {t.marketingInfo}
              </CardTitle>
              <CardDescription>{t.marketingDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <ToggleBox
                  checked={formData.is_offer}
                  disabled={isSubmitting}
                  title={t.fields.isOffer}
                  description={t.fields.isOffer}
                  onChange={(value) => updateField("is_offer", value)}
                />

                <ToggleBox
                  checked={formData.show_on_landing}
                  disabled={isSubmitting}
                  title={t.fields.landing}
                  description={t.fields.landing}
                  onChange={(value) => updateField("show_on_landing", value)}
                />

                <ToggleBox
                  checked={formData.show_on_mobile}
                  disabled={isSubmitting}
                  title={t.fields.mobile}
                  description={t.fields.mobile}
                  onChange={(value) => updateField("show_on_mobile", value)}
                />

                <ToggleBox
                  checked={formData.show_on_offers}
                  disabled={isSubmitting}
                  title={t.fields.offers}
                  description={t.fields.offers}
                  onChange={(value) => updateField("show_on_offers", value)}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <FieldBlock label={t.fields.offerTitle} error={errors.offer_title}>
                  <Input
                    value={formData.offer_title}
                    disabled={isSubmitting}
                    placeholder={t.placeholders.offerTitle}
                    onChange={(event) => updateField("offer_title", event.target.value)}
                  />
                </FieldBlock>

                <FieldBlock label={t.fields.offerSubtitle} error={errors.offer_subtitle}>
                  <Input
                    value={formData.offer_subtitle}
                    disabled={isSubmitting}
                    placeholder={t.placeholders.offerSubtitle}
                    onChange={(event) => updateField("offer_subtitle", event.target.value)}
                  />
                </FieldBlock>

                <FieldBlock label={t.fields.offerBadge} error={errors.offer_badge}>
                  <Input
                    value={formData.offer_badge}
                    disabled={isSubmitting}
                    placeholder={t.placeholders.offerBadge}
                    onChange={(event) => updateField("offer_badge", event.target.value)}
                  />
                </FieldBlock>

                <FieldBlock label={t.fields.offerStart} error={errors.offer_start_date}>
                  <Input
                    type="date"
                    value={formData.offer_start_date}
                    disabled={isSubmitting}
                    onChange={(event) => updateField("offer_start_date", event.target.value)}
                  />
                </FieldBlock>

                <FieldBlock label={t.fields.offerEnd} error={errors.offer_end_date}>
                  <Input
                    type="date"
                    value={formData.offer_end_date}
                    disabled={isSubmitting}
                    onChange={(event) => updateField("offer_end_date", event.target.value)}
                  />
                </FieldBlock>
              </div>

              <FieldBlock label={t.fields.offerTerms} error={errors.offer_terms}>
                <Textarea
                  value={formData.offer_terms}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.terms}
                  className="min-h-24"
                  onChange={(event) => updateField("offer_terms", event.target.value)}
                />
              </FieldBlock>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImagePlus className="h-5 w-5" />
                {t.imagesInfo}
              </CardTitle>
              <CardDescription>{t.imagesDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 lg:grid-cols-2">
              <FilePicker
                label={t.fields.thumbnail}
                file={thumbnailFile}
                disabled={isSubmitting}
                onChange={setThumbnailFile}
              />

              <FilePicker
                label={t.fields.marketingImage}
                file={marketingFile}
                disabled={isSubmitting}
                onChange={setMarketingFile}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CircleDollarSign className="h-5 w-5" />
                {t.pricingInfo}
              </CardTitle>
              <CardDescription>{t.pricingDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 lg:grid-cols-3">
              <FieldBlock label={t.fields.price} error={errors.price} required>
                <Input
                  inputMode="decimal"
                  value={formData.price}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.price}
                  onChange={(event) => updateField("price", event.target.value)}
                />
              </FieldBlock>

              <FieldBlock label={t.fields.salePrice} error={errors.sale_price}>
                <Input
                  inputMode="decimal"
                  value={formData.sale_price}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.salePrice}
                  onChange={(event) => updateField("sale_price", event.target.value)}
                />
              </FieldBlock>

              <FieldBlock label={t.fields.costPrice} error={errors.cost_price}>
                <Input
                  inputMode="decimal"
                  value={formData.cost_price}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.costPrice}
                  onChange={(event) => updateField("cost_price", event.target.value)}
                />
              </FieldBlock>

              <FieldBlock label={t.fields.billingType} error={errors.billing_type}>
                <select
                  value={formData.billing_type}
                  disabled={isSubmitting}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  onChange={(event) =>
                    updateField("billing_type", event.target.value as BillingType)
                  }
                >
                  {Object.entries(t.billingTypes).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </FieldBlock>

              <FieldBlock label={t.fields.fulfillmentType} error={errors.fulfillment_type}>
                <select
                  value={formData.fulfillment_type}
                  disabled={isSubmitting}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  onChange={(event) =>
                    updateField("fulfillment_type", event.target.value as FulfillmentType)
                  }
                >
                  {Object.entries(t.fulfillmentTypes).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </FieldBlock>

              <FieldBlock label={t.fields.durationUnit} error={errors.duration_unit}>
                <select
                  value={formData.duration_unit}
                  disabled={isSubmitting}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  onChange={(event) =>
                    updateField("duration_unit", event.target.value as DurationUnit)
                  }
                >
                  {Object.entries(t.durationUnits).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </FieldBlock>

              <FieldBlock label={t.fields.durationValue} error={errors.duration_value}>
                <Input
                  inputMode="numeric"
                  value={formData.duration_value}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.durationValue}
                  onChange={(event) => updateField("duration_value", event.target.value)}
                />
              </FieldBlock>

              <FieldBlock label={t.fields.taxRate} error={errors.tax_rate}>
                <Input
                  inputMode="decimal"
                  value={formData.tax_rate}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.taxRate}
                  onChange={(event) => updateField("tax_rate", event.target.value)}
                />
              </FieldBlock>

              <ToggleBox
                checked={formData.is_taxable}
                disabled={isSubmitting}
                title={t.fields.taxable}
                description={t.fields.taxable}
                onChange={(value) => updateField("is_taxable", value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                {t.availabilityInfo}
              </CardTitle>
              <CardDescription>{t.availabilityDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 lg:grid-cols-3">
              <ToggleBox
                checked={formData.is_public}
                disabled={isSubmitting}
                title={t.fields.public}
                description={t.fields.public}
                onChange={(value) => updateField("is_public", value)}
              />

              <ToggleBox
                checked={formData.is_featured}
                disabled={isSubmitting}
                title={t.fields.featured}
                description={t.fields.featured}
                onChange={(value) => updateField("is_featured", value)}
              />

              <ToggleBox
                checked={formData.requires_approval}
                disabled={isSubmitting}
                title={t.fields.requiresApproval}
                description={t.fields.requiresApproval}
                onChange={(value) => updateField("requires_approval", value)}
              />

              <ToggleBox
                checked={formData.allow_online_purchase}
                disabled={isSubmitting}
                title={t.fields.onlinePurchase}
                description={t.fields.onlinePurchase}
                onChange={(value) => updateField("allow_online_purchase", value)}
              />

              <ToggleBox
                checked={formData.allow_agent_sale}
                disabled={isSubmitting}
                title={t.fields.agentSale}
                description={t.fields.agentSale}
                onChange={(value) => updateField("allow_agent_sale", value)}
              />

              <ToggleBox
                checked={formData.allow_provider_sale}
                disabled={isSubmitting}
                title={t.fields.providerSale}
                description={t.fields.providerSale}
                onChange={(value) => updateField("allow_provider_sale", value)}
              />

              <ToggleBox
                checked={formData.can_be_ordered}
                disabled={isSubmitting}
                title={t.fields.canBeOrdered}
                description={t.fields.canBeOrdered}
                onChange={(value) => updateField("can_be_ordered", value)}
              />

              <ToggleBox
                checked={formData.can_be_used_in_contracts}
                disabled={isSubmitting}
                title={t.fields.contractsReady}
                description={t.fields.contractsReady}
                onChange={(value) => updateField("can_be_used_in_contracts", value)}
              />

              <ToggleBox
                checked={formData.requires_provider}
                disabled={isSubmitting}
                title={t.fields.requiresProvider}
                description={t.fields.requiresProvider}
                onChange={(value) => updateField("requires_provider", value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5" />
                {t.limitsInfo}
              </CardTitle>
              <CardDescription>{t.limitsDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 lg:grid-cols-2">
              <FieldBlock label={t.fields.maxDiscount} error={errors.max_discount_rate}>
                <Input
                  inputMode="decimal"
                  value={formData.max_discount_rate}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.maxDiscount}
                  onChange={(event) =>
                    updateField("max_discount_rate", event.target.value)
                  }
                />
              </FieldBlock>

              <FieldBlock
                label={t.fields.agentCommission}
                error={errors.default_agent_commission_rate}
              >
                <Input
                  inputMode="decimal"
                  value={formData.default_agent_commission_rate}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.agentCommission}
                  onChange={(event) =>
                    updateField("default_agent_commission_rate", event.target.value)
                  }
                />
              </FieldBlock>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Boxes className="h-5 w-5" />
                {t.advancedInfo}
              </CardTitle>
              <CardDescription>{t.advancedDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 lg:grid-cols-2">
              <FieldBlock label={t.fields.pricingTiers} error={errors.pricing_tiers_text}>
                <Textarea
                  value={formData.pricing_tiers_text}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.pricingTiers}
                  className="min-h-32"
                  onChange={(event) => updateField("pricing_tiers_text", event.target.value)}
                />
              </FieldBlock>

              <FieldBlock label={t.fields.serviceItems} error={errors.service_items_text}>
                <Textarea
                  value={formData.service_items_text}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.serviceItems}
                  className="min-h-32"
                  onChange={(event) => updateField("service_items_text", event.target.value)}
                />
              </FieldBlock>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgeCheck className="h-5 w-5" />
                {t.summaryTitle}
              </CardTitle>
              <CardDescription>{t.summaryDesc}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-2xl border bg-background p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium">{t.completion}</span>
                  <span className="font-semibold">{progressPercent}%</span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, progressPercent)}%` }}
                  />
                </div>

                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  {isReadyToSave ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span>{isReadyToSave ? t.ready : t.missingData}</span>
                </div>
              </div>

              <SummaryItem
                icon={Package}
                label={t.fields.name}
                value={formData.name}
              />

              <SummaryItem
                icon={Tag}
                label={t.fields.type}
                value={selectedProductTypeLabel}
              />

              <SummaryItem
                icon={Stethoscope}
                label={t.fields.provider}
                value={
                  providers.find((item) => String(item.id) === formData.provider_id)
                    ? optionLabel(
                        providers.find((item) => String(item.id) === formData.provider_id)!,
                        locale,
                      )
                    : t.noProvider
                }
              />

              <SummaryItem
                icon={CircleDollarSign}
                label={t.priceSummary}
                value={formatMoney(effectivePrice)}
              />

              <div className="rounded-2xl border bg-background p-4">
                <p className="mb-3 text-sm font-semibold">{t.priceSummary}</p>
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{t.fields.price}</span>
                    <SarAmount value={toNumber(formData.price)} />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{t.fields.salePrice}</span>
                    <SarAmount value={toNumber(formData.sale_price)} />
                  </div>

                  <div className="flex items-center justify-between gap-3 font-semibold">
                    <span>{t.ready}</span>
                    <SarAmount value={effectivePrice} />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border bg-background p-4">
                <p className="mb-3 text-sm font-semibold">{t.offerSummary}</p>
                <div className="flex flex-wrap gap-2">
                  {formData.is_offer ? <Badge>{t.fields.isOffer}</Badge> : null}
                  {formData.show_on_landing ? <Badge variant="outline">{t.fields.landing}</Badge> : null}
                  {formData.show_on_mobile ? <Badge variant="outline">{t.fields.mobile}</Badge> : null}
                  {formData.show_on_offers ? <Badge variant="outline">{t.fields.offers}</Badge> : null}
                  {thumbnailFile ? <Badge variant="secondary">{t.fields.thumbnail}</Badge> : null}
                  {marketingFile ? <Badge variant="secondary">{t.fields.marketingImage}</Badge> : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UploadCloud className="h-5 w-5" />
                {t.imagesInfo}
              </CardTitle>
              <CardDescription>{t.imagesDesc}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              <SummaryItem
                icon={FileImage}
                label={t.fields.thumbnail}
                value={thumbnailFile ? t.fileSelected : t.no}
              />

              <SummaryItem
                icon={CalendarDays}
                label={t.fields.marketingImage}
                value={marketingFile ? t.fileSelected : t.no}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                {t.stepsTitle}
              </CardTitle>
              <CardDescription>{t.stepsDesc}</CardDescription>
            </CardHeader>

            <CardContent>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {t.quickNotes.map((note) => (
                  <li key={note} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}