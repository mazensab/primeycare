"use client";

/* ============================================================
   📂 app/system/products/create/page.tsx
   🧠 Primey Care | Create Product
   ------------------------------------------------------------
   ✅ المسار: /system/products/create
   ✅ الإصدار: v2.0.0 - Centers Pattern + Safe Permissions

   ✅ العمل:
      إنشاء منتج / بطاقة / برنامج / خدمة جديدة.

   ✅ Backend:
      POST /api/products/create/

   ✅ المعيار:
      - مبني بصريًا على نمط المراكز والعملاء المعتمد.
      - دمج UX Refinement مع حماية المرحلة 2.
      - لا يتم إظهار مسارات تقنية أو API داخل الواجهة.
      - الصفحة ممتدة على عرض المساحة وليست متمركزة.
      - Main Form + Sidebar Summary.
      - حماية زر الإنشاء حسب صلاحية products.create.
      - إخفاء روابط غير مصرح بها بدل تعطيلها.
      - عدم كسر system_admin / superadmin.
      - تحذير عند مغادرة الصفحة وفيها بيانات غير محفوظة.
      - beforeunload protection.
      - Error Alert داخلي عند فشل الحفظ.
      - Field-level validation.
      - تعطيل الحقول أثناء الحفظ.
      - تنظيف البيانات قبل الإرسال.
      - حفظ واستعادة مسودة محلية.
      - تأكيد تفريغ النموذج.
      - دعم عربي / إنجليزي عبر primey-locale.
      - استخدام sonner للتنبيهات.
      - استخدام /currency/sar.svg.
      - الأرقام بالإنجليزية.
      - بدون localhost hardcoded.
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
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  FileText,
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
type DurationUnit = "day" | "month" | "year" | "visit" | "none";

type ProductFormData = {
  name: string;
  code: string;
  slug: string;
  product_type: ProductType;
  status: ProductStatus;
  category_name: string;
  short_description: string;
  description: string;
  tags: string;

  price: string;
  sale_price: string;
  billing_type: BillingType;
  fulfillment_type: FulfillmentType;
  duration_value: string;
  duration_unit: DurationUnit;

  is_taxable: boolean;
  tax_rate: string;

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
  notes: string;
};

type ProductFormErrors = Partial<Record<keyof ProductFormData, string>>;

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
const DRAFT_STORAGE_KEY = "primey-care-product-create-draft";

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
    title: isArabic ? "إنشاء منتج جديد" : "Create New Product",
    subtitle: isArabic
      ? "إضافة بطاقة أو عضوية أو برنامج أو خدمة وربطها لاحقًا بالطلبات والعقود."
      : "Add a card, membership, program, or service and later connect it with orders and contracts.",

    back: isArabic ? "العودة للمنتجات" : "Back to Products",
    productsList: isArabic ? "قائمة المنتجات" : "Products List",
    create: isArabic ? "إنشاء المنتج" : "Create Product",
    saving: isArabic ? "جاري الحفظ..." : "Saving...",
    saveDraft: isArabic ? "حفظ كمسودة محلية" : "Save Local Draft",
    restoreDraft: isArabic ? "استعادة المسودة" : "Restore Draft",
    clearForm: isArabic ? "تفريغ النموذج" : "Clear Form",

    basicInfo: isArabic ? "البيانات الأساسية" : "Basic Information",
    basicDesc: isArabic
      ? "اسم المنتج، الكود، النوع، التصنيف، وحالة التشغيل."
      : "Product name, code, type, category, and operational status.",

    descriptionInfo: isArabic ? "الوصف والوسوم" : "Description & Tags",
    descriptionDesc: isArabic
      ? "وصف مختصر، وصف تفصيلي، ووسوم تساعد في البحث."
      : "Short description, full description, and tags for search.",

    pricingInfo: isArabic ? "التسعير والفوترة" : "Pricing & Billing",
    pricingDesc: isArabic
      ? "السعر الأساسي، الخصم، الفوترة، الضريبة، والمدة."
      : "Base price, sale price, billing, tax, and duration.",

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

    notesInfo: isArabic ? "ملاحظات تشغيلية" : "Operational Notes",
    notesDesc: isArabic
      ? "أي ملاحظات داخلية مرتبطة بالمنتج."
      : "Any internal notes related to this product.",

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
      shortDescription: isArabic ? "الوصف المختصر" : "Short Description",
      description: isArabic ? "الوصف التفصيلي" : "Full Description",
      tags: isArabic ? "الوسوم" : "Tags",
      price: isArabic ? "السعر الأساسي" : "Base Price",
      salePrice: isArabic ? "سعر الخصم" : "Sale Price",
      billingType: isArabic ? "نوع الفوترة" : "Billing Type",
      fulfillmentType: isArabic ? "نوع التسليم" : "Fulfillment Type",
      durationValue: isArabic ? "مدة المنتج" : "Duration",
      durationUnit: isArabic ? "وحدة المدة" : "Duration Unit",
      taxable: isArabic ? "خاضع للضريبة" : "Taxable",
      taxRate: isArabic ? "نسبة الضريبة" : "Tax Rate",
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
      notes: isArabic ? "الملاحظات" : "Notes",
    },

    placeholders: {
      name: isArabic ? "مثال: بطاقة Primey Care الذهبية" : "Example: Primey Care Gold Card",
      code: isArabic ? "مثال: PRD-001" : "Example: PRD-001",
      slug: isArabic ? "primey-care-gold-card" : "primey-care-gold-card",
      category: isArabic ? "مثال: بطاقات الرعاية" : "Example: Care Cards",
      shortDescription: isArabic
        ? "وصف مختصر يظهر في القوائم..."
        : "Short description shown in lists...",
      description: isArabic
        ? "اكتب وصفًا تفصيليًا للمنتج..."
        : "Write a detailed product description...",
      tags: isArabic ? "بطاقة، رعاية، خصومات" : "card, care, discounts",
      price: isArabic ? "مثال: 199" : "Example: 199",
      salePrice: isArabic ? "مثال: 149" : "Example: 149",
      durationValue: isArabic ? "مثال: 12" : "Example: 12",
      taxRate: isArabic ? "مثال: 15" : "Example: 15",
      maxDiscount: isArabic ? "مثال: 20" : "Example: 20",
      agentCommission: isArabic ? "مثال: 10" : "Example: 10",
      pricingTiers: isArabic
        ? "اكتب كل شريحة في سطر: الاسم | السعر | المدة"
        : "One tier per line: name | price | duration",
      serviceItems: isArabic
        ? "اكتب كل خدمة في سطر: اسم الخدمة | الكمية | الملاحظات"
        : "One service per line: service name | quantity | notes",
      notes: isArabic
        ? "أي ملاحظات تشغيلية عن المنتج..."
        : "Any operational notes about this product...",
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
      visit: isArabic ? "زيارة" : "Visit",
      none: isArabic ? "بدون" : "None",
    } satisfies Record<DurationUnit, string>,

    validation: {
      name: isArabic ? "اسم المنتج مطلوب." : "Product name is required.",
      code: isArabic ? "كود المنتج مطلوب." : "Product code is required.",
      price: isArabic ? "السعر يجب أن يكون رقمًا صحيحًا." : "Price must be a valid number.",
      salePrice: isArabic ? "سعر الخصم يجب أن يكون رقمًا صحيحًا." : "Sale price must be a valid number.",
      saleGreater: isArabic
        ? "سعر الخصم لا يجب أن يكون أكبر من السعر الأساسي."
        : "Sale price must not be greater than base price.",
      percent: isArabic
        ? "النسبة يجب أن تكون بين 0 و 100."
        : "Percentage must be between 0 and 100.",
      duration: isArabic ? "المدة يجب أن تكون رقمًا صحيحًا." : "Duration must be a valid number.",
    },

    success: isArabic ? "تم إنشاء المنتج بنجاح." : "Product created successfully.",
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

    yes: isArabic ? "نعم" : "Yes",
    no: isArabic ? "لا" : "No",

    quickNotes: [
      isArabic
        ? "كود المنتج يجب أن يكون فريدًا وواضحًا."
        : "Product code must be unique and clear.",
      isArabic
        ? "فعّل جاهزية الطلبات فقط عندما يكون المنتج قابلًا للبيع."
        : "Enable order readiness only when the product is sellable.",
      isArabic
        ? "استخدم جاهزية العقود للمنتجات التي تدخل في عقود المراكز."
        : "Use contracts readiness for products that can be used in provider contracts.",
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
  product_type: "card",
  status: "active",
  category_name: "",
  short_description: "",
  description: "",
  tags: "",

  price: "",
  sale_price: "",
  billing_type: "one_time",
  fulfillment_type: "digital",
  duration_value: "",
  duration_unit: "month",

  is_taxable: true,
  tax_rate: "15",

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
  notes: "",
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
  const parsed = Number(value.replace(/,/g, ""));

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

function parseLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", valueA = "", valueB = ""] = line
        .split("|")
        .map((part) => part.trim());

      return {
        name,
        value: valueA,
        notes: valueB,
      };
    })
    .filter((item) => item.name);
}

function normalizePayload(formData: ProductFormData) {
  const price = normalizeNumberString(formData.price);
  const salePrice = formData.sale_price.trim()
    ? normalizeNumberString(formData.sale_price)
    : "";

  return {
    name: formData.name.trim(),
    code: normalizeCode(formData.code),
    slug: normalizeSlug(formData.slug || formData.name),
    product_type: formData.product_type,
    type: formData.product_type,
    status: formData.status,
    category_name: formData.category_name.trim(),
    short_description: formData.short_description.trim(),
    description: formData.description.trim(),
    tags: formData.tags.trim(),

    price,
    base_price: price,
    sale_price: salePrice,
    billing_type: formData.billing_type,
    fulfillment_type: formData.fulfillment_type,
    duration_value: formData.duration_value.trim()
      ? String(toNumber(formData.duration_value))
      : "",
    duration_unit: formData.duration_unit,

    is_taxable: formData.is_taxable,
    tax_rate: formData.tax_rate.trim()
      ? String(toNumber(formData.tax_rate))
      : "0",

    is_public: formData.is_public,
    is_featured: formData.is_featured,
    requires_approval: formData.requires_approval,

    allow_online_purchase: formData.allow_online_purchase,
    allow_agent_sale: formData.allow_agent_sale,
    allow_provider_sale: formData.allow_provider_sale,

    can_be_ordered: formData.can_be_ordered,
    can_be_used_in_contracts: formData.can_be_used_in_contracts,
    requires_provider: formData.requires_provider,

    max_discount_rate: formData.max_discount_rate.trim()
      ? String(toNumber(formData.max_discount_rate))
      : "0",
    default_agent_commission_rate: formData.default_agent_commission_rate.trim()
      ? String(toNumber(formData.default_agent_commission_rate))
      : "0",

    pricing_tiers: parseLines(formData.pricing_tiers_text),
    service_items: parseLines(formData.service_items_text),
    notes: formData.notes.trim(),
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
    if (key === "price" || key === "base_price") nextErrors.price = String(message);
    if (key === "sale_price") nextErrors.sale_price = String(message);
    if (key === "tax_rate") nextErrors.tax_rate = String(message);
    if (key === "duration_value") nextErrors.duration_value = String(message);
    if (key === "max_discount_rate") nextErrors.max_discount_rate = String(message);
    if (key === "default_agent_commission_rate") {
      nextErrors.default_agent_commission_rate = String(message);
    }
  });

  return nextErrors;
}

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

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const isDirty = useMemo(() => hasFormChanges(formData), [formData]);

  const authResolving = isAuthResolving(auth);

  const canCreateProducts = hasSafePermission(
    auth,
    ["products.create"],
    "action",
  );

  const canViewProducts = hasSafePermission(
    auth,
    ["products.view", "products.list"],
    "view",
  );

  const completedFields = useMemo(() => {
    const keys: Array<keyof ProductFormData> = [
      "name",
      "code",
      "slug",
      "product_type",
      "status",
      "category_name",
      "price",
      "billing_type",
      "fulfillment_type",
      "duration_value",
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

  const progressPercent = Math.round((completedFields / 13) * 100);

  const effectivePrice = useMemo(() => {
    const salePrice = toNumber(formData.sale_price);
    const basePrice = toNumber(formData.price);

    return salePrice > 0 ? salePrice : basePrice;
  }, [formData.price, formData.sale_price]);

  const isReadyToSave =
    formData.name.trim().length > 0 &&
    formData.code.trim().length > 0 &&
    isValidNumber(formData.price);

  function updateField<K extends keyof ProductFormData>(
    key: K,
    value: ProductFormData[K],
  ) {
    setFormData((current) => ({
      ...current,
      [key]: value,
    }));

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

    if (!formData.code.trim()) {
      nextErrors.code = t.validation.code;
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

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
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

      const response = await fetch(apiUrl("/api/products/create/"), {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
        },
        body: JSON.stringify(normalizePayload(formData)),
      });

      const result = (await response.json().catch(() => null)) as
        | CreateProductApiResponse
        | null;

      if (!response.ok || result?.ok === false) {
        const apiErrors = mapApiFieldErrors(result?.errors);
        const message = result?.message || t.apiError;

        setErrors((current) => ({
          ...current,
          ...apiErrors,
        }));

        setSubmitError(message);
        toast.error(message);
        return;
      }

      const createdId = result ? resolveCreatedId(result) : null;

      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      toast.success(t.success);

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
      console.error("Save product draft error:", error);
      toast.error(t.apiError);
    }
  }

  function restoreDraft() {
    try {
      const rawDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY);

      if (!rawDraft) {
        toast.error(t.noDraft);
        return;
      }

      const parsed = JSON.parse(rawDraft) as ProductFormData;

      setFormData({
        ...initialFormData,
        ...parsed,
      });

      setErrors({});
      setSubmitError("");
      toast.success(t.draftRestored);
    } catch (error) {
      console.error("Restore product draft error:", error);
      toast.error(t.apiError);
    }
  }

  function clearForm() {
    if (isDirty && !window.confirm(t.confirmClear)) return;

    setFormData(initialFormData);
    setErrors({});
    setSubmitError("");
    toast.success(t.formCleared);
  }

  function confirmNavigate(path: string) {
    if (isSubmitting) return;

    if (isDirty && !window.confirm(t.confirmLeave)) {
      return;
    }

    router.push(path);
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
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty || isSubmitting) return;

      event.preventDefault();
      event.returnValue = t.confirmLeave;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty, isSubmitting, t.confirmLeave]);

  if (!authResolving && !canCreateProducts) {
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

          <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
            {t.subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full rounded-xl sm:w-auto"
            disabled={isSubmitting}
            onClick={() => confirmNavigate("/system/products")}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t.back}</span>
          </Button>

          {canViewProducts ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
              disabled={isSubmitting}
              onClick={() => confirmNavigate("/system/products/list")}
            >
              <ClipboardList className="h-4 w-4" />
              <span>{t.productsList}</span>
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="h-10 w-full rounded-xl sm:w-auto"
            disabled={isSubmitting}
            onClick={saveDraft}
          >
            <Save className="h-4 w-4" />
            <span>{t.saveDraft}</span>
          </Button>

          <Button
            type="button"
            className="h-10 w-full rounded-xl sm:w-auto"
            disabled={isSubmitting}
            onClick={submitForm}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <span>{isSubmitting ? t.saving : t.create}</span>
          </Button>
        </div>
      </div>

      {/* Submit Error */}
      {submitError ? (
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 shadow-sm">
          <CardContent className="flex items-start gap-3 p-5 text-destructive">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">{t.formErrorTitle}</p>
              <p className="mt-1 text-sm">{submitError}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Main Form */}
        <div className="space-y-4">
          {/* Basic Info */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Package className="h-4 w-4" />
                {t.basicInfo}
              </CardTitle>
              <CardDescription>{t.basicDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <FieldBlock label={t.fields.name} error={errors.name} required>
                <Input
                  value={formData.name}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.name}
                  className="h-10 rounded-xl"
                  onChange={(event) => updateField("name", event.target.value)}
                />
              </FieldBlock>

              <FieldBlock label={t.fields.code} error={errors.code} required>
                <Input
                  value={formData.code}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.code}
                  className="h-10 rounded-xl"
                  onChange={(event) => updateField("code", event.target.value)}
                  onBlur={() => updateField("code", normalizeCode(formData.code))}
                />
              </FieldBlock>

              <FieldBlock label={t.fields.slug} error={errors.slug}>
                <Input
                  value={formData.slug}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.slug}
                  className="h-10 rounded-xl"
                  dir="ltr"
                  onChange={(event) => updateField("slug", event.target.value)}
                  onBlur={() =>
                    updateField("slug", normalizeSlug(formData.slug || formData.name))
                  }
                />
              </FieldBlock>

              <FieldBlock label={t.fields.category} error={errors.category_name}>
                <Input
                  value={formData.category_name}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.category}
                  className="h-10 rounded-xl"
                  onChange={(event) =>
                    updateField("category_name", event.target.value)
                  }
                />
              </FieldBlock>

              <FieldBlock label={t.fields.type} error={errors.product_type}>
                <select
                  value={formData.product_type}
                  disabled={isSubmitting}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  onChange={(event) =>
                    updateField("product_type", event.target.value as ProductType)
                  }
                >
                  {Object.entries(t.productTypes).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FieldBlock>

              <FieldBlock label={t.fields.status} error={errors.status}>
                <select
                  value={formData.status}
                  disabled={isSubmitting}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  onChange={(event) =>
                    updateField("status", event.target.value as ProductStatus)
                  }
                >
                  {Object.entries(t.statuses).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FieldBlock>
            </CardContent>
          </Card>

          {/* Description */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <FileText className="h-4 w-4" />
                {t.descriptionInfo}
              </CardTitle>
              <CardDescription>{t.descriptionDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4">
              <FieldBlock
                label={t.fields.shortDescription}
                error={errors.short_description}
              >
                <Input
                  value={formData.short_description}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.shortDescription}
                  className="h-10 rounded-xl"
                  onChange={(event) =>
                    updateField("short_description", event.target.value)
                  }
                />
              </FieldBlock>

              <FieldBlock label={t.fields.description} error={errors.description}>
                <Textarea
                  value={formData.description}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.description}
                  className="min-h-28 rounded-xl"
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                />
              </FieldBlock>

              <FieldBlock label={t.fields.tags} error={errors.tags}>
                <Input
                  value={formData.tags}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.tags}
                  className="h-10 rounded-xl"
                  onChange={(event) => updateField("tags", event.target.value)}
                />
              </FieldBlock>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <CircleDollarSign className="h-4 w-4" />
                {t.pricingInfo}
              </CardTitle>
              <CardDescription>{t.pricingDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <FieldBlock label={t.fields.price} error={errors.price} required>
                <div className="relative">
                  <Input
                    value={formData.price}
                    disabled={isSubmitting}
                    placeholder={t.placeholders.price}
                    className={`h-10 rounded-xl ${isArabic ? "pl-10" : "pr-10"}`}
                    onChange={(event) => updateField("price", event.target.value)}
                    onBlur={() =>
                      updateField("price", normalizeNumberString(formData.price))
                    }
                  />
                  <Image
                    src={SAR_ICON_PATH}
                    alt=""
                    width={16}
                    height={16}
                    className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 ${
                      isArabic ? "left-3" : "right-3"
                    }`}
                  />
                </div>
              </FieldBlock>

              <FieldBlock label={t.fields.salePrice} error={errors.sale_price}>
                <div className="relative">
                  <Input
                    value={formData.sale_price}
                    disabled={isSubmitting}
                    placeholder={t.placeholders.salePrice}
                    className={`h-10 rounded-xl ${isArabic ? "pl-10" : "pr-10"}`}
                    onChange={(event) =>
                      updateField("sale_price", event.target.value)
                    }
                    onBlur={() =>
                      updateField(
                        "sale_price",
                        formData.sale_price.trim()
                          ? normalizeNumberString(formData.sale_price)
                          : "",
                      )
                    }
                  />
                  <Image
                    src={SAR_ICON_PATH}
                    alt=""
                    width={16}
                    height={16}
                    className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 ${
                      isArabic ? "left-3" : "right-3"
                    }`}
                  />
                </div>
              </FieldBlock>

              <FieldBlock label={t.fields.billingType} error={errors.billing_type}>
                <select
                  value={formData.billing_type}
                  disabled={isSubmitting}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  onChange={(event) =>
                    updateField("billing_type", event.target.value as BillingType)
                  }
                >
                  {Object.entries(t.billingTypes).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FieldBlock>

              <FieldBlock
                label={t.fields.fulfillmentType}
                error={errors.fulfillment_type}
              >
                <select
                  value={formData.fulfillment_type}
                  disabled={isSubmitting}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  onChange={(event) =>
                    updateField(
                      "fulfillment_type",
                      event.target.value as FulfillmentType,
                    )
                  }
                >
                  {Object.entries(t.fulfillmentTypes).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FieldBlock>

              <FieldBlock
                label={t.fields.durationValue}
                error={errors.duration_value}
              >
                <Input
                  value={formData.duration_value}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.durationValue}
                  className="h-10 rounded-xl"
                  onChange={(event) =>
                    updateField("duration_value", event.target.value)
                  }
                />
              </FieldBlock>

              <FieldBlock label={t.fields.durationUnit} error={errors.duration_unit}>
                <select
                  value={formData.duration_unit}
                  disabled={isSubmitting}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  onChange={(event) =>
                    updateField("duration_unit", event.target.value as DurationUnit)
                  }
                >
                  {Object.entries(t.durationUnits).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FieldBlock>

              <FieldBlock label={t.fields.taxRate} error={errors.tax_rate}>
                <Input
                  value={formData.tax_rate}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.taxRate}
                  className="h-10 rounded-xl"
                  onChange={(event) => updateField("tax_rate", event.target.value)}
                />
              </FieldBlock>

              <div className="flex items-end">
                <ToggleBox
                  checked={formData.is_taxable}
                  disabled={isSubmitting}
                  title={t.fields.taxable}
                  description={`${t.fields.taxRate}: ${formData.tax_rate || "0"}%`}
                  onChange={(value) => updateField("is_taxable", value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Readiness */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <ShieldCheck className="h-4 w-4" />
                {t.availabilityInfo}
              </CardTitle>
              <CardDescription>{t.availabilityDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
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
                onChange={(value) =>
                  updateField("can_be_used_in_contracts", value)
                }
              />

              <ToggleBox
                checked={formData.requires_provider}
                disabled={isSubmitting}
                title={t.fields.requiresProvider}
                description={t.fields.requiresProvider}
                onChange={(value) => updateField("requires_provider", value)}
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
            </CardContent>
          </Card>

          {/* Limits */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Percent className="h-4 w-4" />
                {t.limitsInfo}
              </CardTitle>
              <CardDescription>{t.limitsDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <FieldBlock
                label={t.fields.maxDiscount}
                error={errors.max_discount_rate}
              >
                <Input
                  value={formData.max_discount_rate}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.maxDiscount}
                  className="h-10 rounded-xl"
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
                  value={formData.default_agent_commission_rate}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.agentCommission}
                  className="h-10 rounded-xl"
                  onChange={(event) =>
                    updateField(
                      "default_agent_commission_rate",
                      event.target.value,
                    )
                  }
                />
              </FieldBlock>
            </CardContent>
          </Card>

          {/* Advanced */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Layers3 className="h-4 w-4" />
                {t.advancedInfo}
              </CardTitle>
              <CardDescription>{t.advancedDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4">
              <FieldBlock
                label={t.fields.pricingTiers}
                error={errors.pricing_tiers_text}
              >
                <Textarea
                  value={formData.pricing_tiers_text}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.pricingTiers}
                  className="min-h-24 rounded-xl"
                  onChange={(event) =>
                    updateField("pricing_tiers_text", event.target.value)
                  }
                />
              </FieldBlock>

              <FieldBlock
                label={t.fields.serviceItems}
                error={errors.service_items_text}
              >
                <Textarea
                  value={formData.service_items_text}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.serviceItems}
                  className="min-h-24 rounded-xl"
                  onChange={(event) =>
                    updateField("service_items_text", event.target.value)
                  }
                />
              </FieldBlock>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <FileText className="h-4 w-4" />
                {t.notesInfo}
              </CardTitle>
              <CardDescription>{t.notesDesc}</CardDescription>
            </CardHeader>

            <CardContent>
              <FieldBlock label={t.fields.notes} error={errors.notes}>
                <Textarea
                  value={formData.notes}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.notes}
                  className="min-h-28 rounded-xl"
                  onChange={(event) => updateField("notes", event.target.value)}
                />
              </FieldBlock>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Summary */}
        <aside className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                {t.summaryTitle}
              </CardTitle>
              <CardDescription>{t.summaryDesc}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t.completion}
                    </p>
                    <p className="mt-1 text-2xl font-bold">
                      {formatNumber(progressPercent)}%
                    </p>
                  </div>

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
                    <BadgeCheck className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="mt-3">
                  {isReadyToSave ? (
                    <Badge className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t.ready}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="rounded-full">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {t.missingData}
                    </Badge>
                  )}
                </div>
              </div>

              <SummaryItem
                icon={Package}
                label={t.fields.name}
                value={formData.name || "-"}
              />

              <SummaryItem
                icon={ShieldCheck}
                label={t.fields.code}
                value={normalizeCode(formData.code) || "-"}
              />

              <SummaryItem
                icon={Tag}
                label={t.fields.type}
                value={t.productTypes[formData.product_type]}
              />

              <SummaryItem
                icon={CheckCircle2}
                label={t.fields.status}
                value={t.statuses[formData.status]}
              />

              <div className="rounded-xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">
                  {t.priceSummary}
                </p>
                <p className="mt-1 text-lg font-bold">
                  <SarAmount value={effectivePrice} />
                </p>
              </div>

              <SummaryItem
                icon={CreditCard}
                label={t.fields.billingType}
                value={t.billingTypes[formData.billing_type]}
              />

              <SummaryItem
                icon={Boxes}
                label={t.readinessSummary}
                value={[
                  formData.can_be_ordered ? t.fields.canBeOrdered : "",
                  formData.can_be_used_in_contracts ? t.fields.contractsReady : "",
                ]
                  .filter(Boolean)
                  .join(" / ")}
              />

              <SummaryItem
                icon={Stethoscope}
                label={t.saleChannelsSummary}
                value={[
                  formData.allow_online_purchase ? t.fields.onlinePurchase : "",
                  formData.allow_agent_sale ? t.fields.agentSale : "",
                  formData.allow_provider_sale ? t.fields.providerSale : "",
                ]
                  .filter(Boolean)
                  .join(" / ")}
              />

              <div className="grid gap-2">
                <Button
                  type="button"
                  className="h-10 rounded-xl"
                  disabled={isSubmitting}
                  onClick={submitForm}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {isSubmitting ? t.saving : t.create}
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-xl"
                    disabled={isSubmitting}
                    onClick={restoreDraft}
                  >
                    <RotateCcw className="h-4 w-4" />
                    {t.restoreDraft}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-xl"
                    disabled={isSubmitting}
                    onClick={clearForm}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t.clearForm}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                {t.stepsTitle}
              </CardTitle>
              <CardDescription>{t.stepsDesc}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {t.quickNotes.map((item, index) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-xl border bg-background p-3"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    {index + 1}
                  </div>

                  <p className="text-sm leading-6 text-muted-foreground">
                    {item}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}