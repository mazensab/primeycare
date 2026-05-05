"use client";

/* ============================================================
   📂 app/system/contracts/create/page.tsx
   🧠 Primey Care | Create Contract
   ------------------------------------------------------------
   ✅ المرحلة 17 + المرحلة 2
   ✅ مبني بنفس نمط إنشاء المراكز/العملاء المعتمد
   ✅ Full Width Layout
   ✅ Main Form + Sidebar Summary
   ✅ حماية زر الإنشاء وطلبات البيانات حسب الصلاحيات
   ✅ fallback آمن لـ system_admin / superadmin
   ✅ Error Alert داخلي
   ✅ Field-level validation
   ✅ beforeunload protection
   ✅ حفظ واستعادة مسودة محلية
   ✅ تعطيل الحقول أثناء الحفظ
   ✅ تنظيف البيانات قبل الإرسال
   ✅ دعم contract_products
   ✅ استخدام /currency/sar.svg
   ✅ استخدام toast من sonner
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ بدون localhost hardcoded
   ✅ لا توجد روابط تقارير داخل الوحدة
   ✅ لا توجد نصوص تقنية ظاهرة في الواجهة
   ✅ الأرقام بالإنجليزية
============================================================ */

import Image from "next/image";
import { useRouter } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Handshake,
  Layers3,
  Loader2,
  Package,
  Percent,
  Plus,
  RefreshCcw,
  Save,
  ShieldCheck,
  Trash2,
  Wallet,
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
import { Textarea } from "@/components/ui/textarea";

/* ============================================================
   Types
============================================================ */

type AppLocale = "ar" | "en";
type AuthRecord = Record<string, unknown>;

type ContractStatus = "DRAFT" | "ACTIVE" | "SUSPENDED";
type PricingModel = "DISCOUNT" | "FIXED_PRICE" | "COMMISSION" | "MIXED";

type OptionItem = {
  id: string;
  label: string;
  subtitle?: string;
  raw?: Record<string, unknown>;
};

type ContractProductRow = {
  rowId: string;
  product_id: string;
  special_price: string;
  discount_percentage: string;
  is_active: boolean;
};

type ContractFormData = {
  contract_number: string;
  title: string;
  provider_id: string;
  status: ContractStatus;
  pricing_model: PricingModel;

  start_date: string;
  end_date: string;

  discount_percentage: string;
  system_commission_percentage: string;
  contract_value: string;

  terms_and_conditions: string;
  coverage_notes: string;
  notes: string;

  auto_activate: boolean;
  notify_provider: boolean;

  contract_products: ContractProductRow[];
};

type ContractFormErrors = Partial<
  Record<keyof ContractFormData | `product_${string}`, string>
>;

type ApiListResponse = {
  ok?: boolean;
  message?: string;
  results?: unknown[];
  items?: unknown[];
  providers?: unknown[];
  centers?: unknown[];
  products?: unknown[];
  data?:
    | unknown[]
    | {
        results?: unknown[];
        items?: unknown[];
        providers?: unknown[];
        centers?: unknown[];
        products?: unknown[];
      };
};

type CreateContractApiResponse = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[] | string>;
  id?: number | string;
  contract?: {
    id?: number | string;
  };
  data?: {
    id?: number | string;
    contract?: {
      id?: number | string;
    };
  };
};

const SAR_ICON_PATH = "/currency/sar.svg";
const DRAFT_STORAGE_KEY = "primey-care-contract-create-draft";

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
    title: isArabic ? "إنشاء عقد جديد" : "Create New Contract",
    subtitle: isArabic
      ? "إنشاء عقد وربطه بمقدم الخدمة والمنتجات ونسب الخصم ونسبة النظام والشروط التشغيلية."
      : "Create a contract and link it with provider, products, discounts, system commission, and operational terms.",

    back: isArabic ? "العودة للعقود" : "Back to Contracts",
    contractsList: isArabic ? "قائمة العقود" : "Contracts List",
    create: isArabic ? "إنشاء العقد" : "Create Contract",
    saving: isArabic ? "جاري الحفظ..." : "Saving...",
    saveDraft: isArabic ? "حفظ كمسودة محلية" : "Save Local Draft",
    restoreDraft: isArabic ? "استعادة المسودة" : "Restore Draft",
    clearForm: isArabic ? "تفريغ النموذج" : "Clear Form",
    refreshOptions: isArabic ? "تحديث الخيارات" : "Refresh Options",

    basicInfo: isArabic ? "بيانات العقد" : "Contract Information",
    basicDesc: isArabic
      ? "رقم العقد والعنوان والحالة ونموذج التسعير."
      : "Contract number, title, status, and pricing model.",

    partyInfo: isArabic ? "مقدم الخدمة" : "Provider",
    partyDesc: isArabic
      ? "اختيار مقدم الخدمة أو المركز المرتبط بالعقد."
      : "Select the provider or center linked to this contract.",

    financialInfo: isArabic ? "النسب والقيمة" : "Rates & Value",
    financialDesc: isArabic
      ? "نسبة الخصم ونسبة النظام وقيمة العقد إن وجدت."
      : "Discount percentage, system commission, and contract value when available.",

    datesInfo: isArabic ? "مدة العقد" : "Contract Period",
    datesDesc: isArabic
      ? "تاريخ بداية العقد وتاريخ نهايته."
      : "Contract start and end dates.",

    productsInfo: isArabic ? "منتجات العقد" : "Contract Products",
    productsDesc: isArabic
      ? "ربط المنتجات أو البرامج المشمولة بالعقد مع سعر أو خصم خاص عند الحاجة."
      : "Link products or programs covered by the contract with special price or discount when needed.",

    termsInfo: isArabic ? "الشروط والتغطية" : "Terms & Coverage",
    termsDesc: isArabic
      ? "الشروط والأحكام وملاحظات التغطية والملاحظات الداخلية."
      : "Terms, coverage notes, and internal notes.",

    postOptionsInfo: isArabic ? "إعدادات بعد الإنشاء" : "Post-create Options",
    postOptionsDesc: isArabic
      ? "خيارات تشغيلية تطبق بعد حفظ العقد حسب دعم الباك إند."
      : "Operational options applied after saving depending on backend support.",

    summaryTitle: isArabic ? "ملخص العقد" : "Contract Summary",
    summaryDesc: isArabic
      ? "مراجعة سريعة للعقد قبل الحفظ."
      : "Quick review before saving.",

    stepsTitle: isArabic ? "إرشادات قبل الحفظ" : "Before Saving",
    stepsDesc: isArabic
      ? "نقاط مهمة تساعدك على إنشاء عقد صحيح."
      : "Important points to help you create a correct contract.",

    formErrorTitle: isArabic ? "تعذر حفظ البيانات" : "Unable to save data",

    accessDeniedTitle: isArabic ? "غير مصرح بإنشاء عقد" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية إنشاء العقود. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to create contracts. Contact your system administrator if you need access.",

    labels: {
      contractNumber: isArabic ? "رقم العقد" : "Contract Number",
      title: isArabic ? "عنوان العقد" : "Contract Title",
      provider: isArabic ? "مقدم الخدمة / المركز" : "Provider / Center",
      status: isArabic ? "الحالة" : "Status",
      pricingModel: isArabic ? "نموذج التسعير" : "Pricing Model",
      startDate: isArabic ? "تاريخ البداية" : "Start Date",
      endDate: isArabic ? "تاريخ النهاية" : "End Date",
      discountPercentage: isArabic ? "نسبة الخصم" : "Discount Percentage",
      systemCommissionPercentage: isArabic
        ? "نسبة النظام"
        : "System Commission",
      contractValue: isArabic ? "قيمة العقد" : "Contract Value",
      product: isArabic ? "المنتج / البرنامج" : "Product / Program",
      specialPrice: isArabic ? "سعر خاص" : "Special Price",
      productDiscount: isArabic ? "خصم خاص" : "Special Discount",
      activeProduct: isArabic ? "منتج نشط داخل العقد" : "Active in Contract",
      terms: isArabic ? "الشروط والأحكام" : "Terms & Conditions",
      coverageNotes: isArabic ? "ملاحظات التغطية" : "Coverage Notes",
      notes: isArabic ? "ملاحظات داخلية" : "Internal Notes",
      autoActivate: isArabic ? "تفعيل العقد بعد الإنشاء" : "Activate contract after creation",
      notifyProvider: isArabic ? "إشعار مقدم الخدمة" : "Notify provider",
    },

    placeholders: {
      contractNumber: isArabic
        ? "يتم توليده تلقائيًا عند تركه فارغًا"
        : "Auto-generated if left empty",
      title: isArabic
        ? "مثال: عقد مركز برايمي كير 2026"
        : "Example: Primey Care Center Contract 2026",
      discountPercentage: isArabic ? "مثال: 20" : "Example: 20",
      systemCommissionPercentage: isArabic ? "مثال: 10" : "Example: 10",
      contractValue: isArabic ? "مثال: 50000" : "Example: 50000",
      specialPrice: isArabic ? "مثال: 199" : "Example: 199",
      productDiscount: isArabic ? "مثال: 15" : "Example: 15",
      terms: isArabic
        ? "اكتب الشروط والأحكام الخاصة بالعقد..."
        : "Write contract terms and conditions...",
      coverageNotes: isArabic
        ? "اكتب ملاحظات التغطية والخدمات المشمولة..."
        : "Write coverage notes and included services...",
      notes: isArabic
        ? "ملاحظات داخلية لفريق التشغيل..."
        : "Internal notes for operations team...",
    },

    statuses: {
      DRAFT: isArabic ? "مسودة" : "Draft",
      ACTIVE: isArabic ? "نشط" : "Active",
      SUSPENDED: isArabic ? "موقوف" : "Suspended",
    } satisfies Record<ContractStatus, string>,

    pricingModels: {
      DISCOUNT: isArabic ? "خصم" : "Discount",
      FIXED_PRICE: isArabic ? "سعر ثابت" : "Fixed Price",
      COMMISSION: isArabic ? "عمولة" : "Commission",
      MIXED: isArabic ? "مختلط" : "Mixed",
    } satisfies Record<PricingModel, string>,

    validation: {
      title: isArabic ? "عنوان العقد مطلوب." : "Contract title is required.",
      provider: isArabic ? "اختيار مقدم الخدمة مطلوب." : "Provider is required.",
      dates: isArabic
        ? "تاريخ النهاية يجب أن يكون بعد تاريخ البداية."
        : "End date must be after start date.",
      number: isArabic ? "القيمة يجب أن تكون رقمًا صحيحًا." : "Value must be a valid number.",
      percentage: isArabic
        ? "النسبة يجب أن تكون بين 0 و 100."
        : "Percentage must be between 0 and 100.",
      product: isArabic
        ? "اختر منتجًا أو احذف الصف الفارغ."
        : "Select a product or remove the empty row.",
    },

    success: isArabic ? "تم إنشاء العقد بنجاح." : "Contract created successfully.",
    draftSaved: isArabic ? "تم حفظ المسودة محليًا." : "Draft saved locally.",
    draftRestored: isArabic ? "تمت استعادة المسودة." : "Draft restored.",
    noDraft: isArabic ? "لا توجد مسودة محفوظة." : "No saved draft found.",
    formCleared: isArabic ? "تم تفريغ النموذج." : "Form cleared.",
    apiError: isArabic
      ? "تعذر إنشاء العقد. تحقق من البيانات وحاول مرة أخرى."
      : "Unable to create contract. Please check the data and try again.",
    optionLoadError: isArabic
      ? "تعذر تحميل بعض خيارات النموذج."
      : "Unable to load some form options.",
    validationToast: isArabic
      ? "يرجى تصحيح الحقول المطلوبة قبل المتابعة."
      : "Please fix the required fields before continuing.",
    confirmLeave: isArabic
      ? "لديك بيانات غير محفوظة. هل تريد المغادرة؟"
      : "You have unsaved changes. Do you want to leave?",
    confirmClear: isArabic
      ? "سيتم تفريغ النموذج الحالي. هل تريد المتابعة؟"
      : "The current form will be cleared. Do you want to continue?",

    addProduct: isArabic ? "إضافة منتج" : "Add Product",
    removeProduct: isArabic ? "حذف المنتج" : "Remove Product",
    selectPlaceholder: isArabic ? "اختر..." : "Select...",
    noOptions: isArabic ? "لا توجد خيارات متاحة" : "No options available",

    completion: isArabic ? "نسبة الاكتمال" : "Completion",
    ready: isArabic ? "جاهز للحفظ" : "Ready to save",
    missingData: isArabic ? "ينقصه بيانات أساسية" : "Missing required data",
    productsCount: isArabic ? "عدد المنتجات" : "Products Count",

    quickNotes: [
      isArabic
        ? "اختر مقدم الخدمة قبل حفظ العقد."
        : "Select the provider before saving the contract.",
      isArabic
        ? "يمكن ترك رقم العقد فارغًا إذا كان الباك إند يولده تلقائيًا."
        : "You can leave contract number empty if the backend generates it automatically.",
      isArabic
        ? "نسبة الخصم ونسبة النظام يجب أن تكون بين 0 و 100."
        : "Discount and system commission percentages must be between 0 and 100.",
      isArabic
        ? "منتجات العقد اختيارية، ويمكن ربطها لاحقًا عند الحاجة."
        : "Contract products are optional and can be linked later when needed.",
    ],
  };
}

/* ============================================================
   Defaults
============================================================ */

function createProductRow(): ContractProductRow {
  return {
    rowId: crypto.randomUUID(),
    product_id: "",
    special_price: "",
    discount_percentage: "0.00",
    is_active: true,
  };
}

const initialFormData: ContractFormData = {
  contract_number: "",
  title: "",
  provider_id: "",
  status: "ACTIVE",
  pricing_model: "DISCOUNT",

  start_date: "",
  end_date: "",

  discount_percentage: "0.00",
  system_commission_percentage: "0.00",
  contract_value: "",

  terms_and_conditions: "",
  coverage_notes: "",
  notes: "",

  auto_activate: false,
  notify_provider: false,

  contract_products: [],
};

/* ============================================================
   Data Helpers
============================================================ */

function getValue(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = obj[key];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return "";
}

function extractList(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== "object") return [];

  const response = payload as ApiListResponse;

  if (Array.isArray(response.results)) return response.results;
  if (Array.isArray(response.items)) return response.items;

  for (const key of keys) {
    const value = (response as Record<string, unknown>)[key];

    if (Array.isArray(value)) return value;
  }

  if (Array.isArray(response.data)) return response.data;

  if (response.data && typeof response.data === "object") {
    const dataObj = response.data as Record<string, unknown>;

    if (Array.isArray(dataObj.results)) return dataObj.results;
    if (Array.isArray(dataObj.items)) return dataObj.items;

    for (const key of keys) {
      const value = dataObj[key];

      if (Array.isArray(value)) return value;
    }
  }

  return [];
}

function normalizeOption(item: unknown, fallbackPrefix: string): OptionItem {
  const obj = (item || {}) as Record<string, unknown>;
  const id = String(getValue(obj, ["id", "uuid", "pk"]));

  const label = String(
    getValue(obj, [
      "name",
      "title",
      "full_name",
      "label",
      "code",
      "provider_name",
      "center_name",
      "product_name",
    ]) || (id ? `${fallbackPrefix}-${id}` : "-"),
  );

  const subtitle = String(
    getValue(obj, [
      "code",
      "city",
      "category_name",
      "product_type",
      "provider_type",
      "status",
      "price",
      "base_price",
    ]) || "",
  );

  return {
    id,
    label,
    subtitle,
    raw: obj,
  };
}

function toNumber(value: string | number) {
  const parsed = Number(String(value || "").replace(/,/g, ""));

  return Number.isFinite(parsed) ? parsed : 0;
}

function isValidNumber(value: string) {
  if (!value.trim()) return true;

  const parsed = Number(value.replace(/,/g, ""));

  return Number.isFinite(parsed);
}

function isValidPercentage(value: string) {
  if (!isValidNumber(value)) return false;

  const parsed = toNumber(value);

  return parsed >= 0 && parsed <= 100;
}

function normalizeNumberString(value: string, fallback = "0.00") {
  const clean = value.replace(/,/g, "").replace(/[^\d.]/g, "");
  const parsed = Number(clean);

  if (!Number.isFinite(parsed)) return fallback;

  return parsed.toFixed(2);
}

function normalizeContractNumber(value: string) {
  return value.trim().replace(/\s+/g, "-").toUpperCase();
}

function hasFormChanges(formData: ContractFormData) {
  return JSON.stringify(formData) !== JSON.stringify(initialFormData);
}

function normalizePayload(formData: ContractFormData) {
  const contractProducts = formData.contract_products
    .filter((row) => row.product_id.trim().length > 0)
    .map((row) => ({
      product_id: row.product_id,
      special_price: row.special_price
        ? toNumber(row.special_price).toFixed(2)
        : null,
      discount_percentage: toNumber(row.discount_percentage).toFixed(2),
      is_active: row.is_active,
    }));

  return {
    contract_number:
      normalizeContractNumber(formData.contract_number) || undefined,
    title: formData.title.trim(),
    name: formData.title.trim(),

    provider_id: formData.provider_id || null,
    center_id: formData.provider_id || null,

    status: formData.status,
    pricing_model: formData.pricing_model,

    start_date: formData.start_date || null,
    end_date: formData.end_date || null,

    discount_percentage: toNumber(formData.discount_percentage).toFixed(2),
    system_commission_percentage: toNumber(
      formData.system_commission_percentage,
    ).toFixed(2),
    contract_value: formData.contract_value
      ? toNumber(formData.contract_value).toFixed(2)
      : "0.00",

    terms_and_conditions: formData.terms_and_conditions.trim(),
    coverage_notes: formData.coverage_notes.trim(),
    notes: formData.notes.trim(),

    auto_activate: formData.auto_activate,
    notify_provider: formData.notify_provider,

    contract_products: contractProducts,
    products: contractProducts,
  };
}

function resolveCreatedId(result: CreateContractApiResponse) {
  return (
    result.contract?.id ||
    result.data?.contract?.id ||
    result.data?.id ||
    result.id ||
    null
  );
}

function mapApiFieldErrors(
  errors: CreateContractApiResponse["errors"],
): ContractFormErrors {
  const nextErrors: ContractFormErrors = {};

  if (!errors) return nextErrors;

  Object.entries(errors).forEach(([key, value]) => {
    const message = Array.isArray(value) ? value[0] : value;

    if (!message) return;

    if (key in initialFormData) {
      nextErrors[key as keyof ContractFormData] = String(message);
    }
  });

  return nextErrors;
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

function formatPercent(value: string | number) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return "0%";

  return `${numericValue.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}%`;
}

function SarIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <Image
      src={SAR_ICON_PATH}
      alt=""
      width={16}
      height={16}
      className={className}
    />
  );
}

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

      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

function SummaryItem({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-background p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="mt-1 truncate text-sm font-semibold">{value || "-"}</div>
      </div>
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

function SelectField({
  value,
  disabled,
  options,
  placeholder,
  noOptions,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  options: OptionItem[];
  placeholder: string;
  noOptions: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{options.length ? placeholder : noOptions}</option>

      {options.map((item) => (
        <option key={item.id} value={item.id}>
          {item.subtitle ? `${item.label} - ${item.subtitle}` : item.label}
        </option>
      ))}
    </select>
  );
}

function MoneyInput({
  value,
  disabled,
  placeholder,
  isArabic,
  onChange,
  onBlur,
}: {
  value: string;
  disabled?: boolean;
  placeholder: string;
  isArabic: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
}) {
  return (
    <div className="relative">
      <Input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        className={`h-10 rounded-xl ${isArabic ? "pl-10" : "pr-10"}`}
        dir="ltr"
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />

      <SarIcon
        className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 ${
          isArabic ? "left-3" : "right-3"
        }`}
      />
    </div>
  );
}

/* ============================================================
   Page
============================================================ */

export default function SystemCreateContractPage() {
  const router = useRouter();
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [formData, setFormData] = useState<ContractFormData>(initialFormData);
  const [errors, setErrors] = useState<ContractFormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [optionsError, setOptionsError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);

  const [providers, setProviders] = useState<OptionItem[]>([]);
  const [products, setProducts] = useState<OptionItem[]>([]);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canCreateContracts = hasSafePermission(
    auth,
    ["contracts.create"],
    "action",
  );

  const canViewContracts = hasSafePermission(
    auth,
    ["contracts.view", "contracts.list"],
    "view",
  );

  const canViewProviders = hasSafePermission(
    auth,
    ["providers.view", "providers.list", "centers.view", "centers.list"],
    "view",
  );

  const canViewProducts = hasSafePermission(
    auth,
    ["products.view", "products.list"],
    "view",
  );

  const isDirty = useMemo(() => hasFormChanges(formData), [formData]);

  const selectedProvider = useMemo(
    () => providers.find((item) => item.id === formData.provider_id),
    [formData.provider_id, providers],
  );

  const selectedProductsCount = useMemo(
    () =>
      formData.contract_products.filter((row) => row.product_id.trim().length > 0)
        .length,
    [formData.contract_products],
  );

  const completedFields = useMemo(() => {
    const keys: Array<keyof ContractFormData> = [
      "title",
      "provider_id",
      "status",
      "pricing_model",
      "discount_percentage",
      "system_commission_percentage",
      "start_date",
      "end_date",
    ];

    return keys.filter((key) => String(formData[key] || "").trim().length > 0)
      .length;
  }, [formData]);

  const progressPercent = Math.round((completedFields / 8) * 100);

  const isReadyToSave =
    formData.title.trim().length > 0 &&
    formData.provider_id.trim().length > 0 &&
    isValidPercentage(formData.discount_percentage) &&
    isValidPercentage(formData.system_commission_percentage);

  function updateField<K extends keyof ContractFormData>(
    key: K,
    value: ContractFormData[K],
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

  function updateProductRow(
    rowId: string,
    patch: Partial<ContractProductRow>,
  ) {
    setFormData((current) => ({
      ...current,
      contract_products: current.contract_products.map((row) =>
        row.rowId === rowId ? { ...row, ...patch } : row,
      ),
    }));

    setErrors((current) => ({
      ...current,
      [`product_${rowId}`]: undefined,
    }));
  }

  function addProductRow() {
    setFormData((current) => ({
      ...current,
      contract_products: [...current.contract_products, createProductRow()],
    }));
  }

  function removeProductRow(rowId: string) {
    setFormData((current) => ({
      ...current,
      contract_products: current.contract_products.filter(
        (row) => row.rowId !== rowId,
      ),
    }));
  }

  function validateForm() {
    const nextErrors: ContractFormErrors = {};

    if (!formData.title.trim()) {
      nextErrors.title = t.validation.title;
    }

    if (!formData.provider_id) {
      nextErrors.provider_id = t.validation.provider;
    }

    const numericFields: Array<keyof ContractFormData> = [
      "discount_percentage",
      "system_commission_percentage",
      "contract_value",
    ];

    numericFields.forEach((key) => {
      if (!isValidNumber(String(formData[key] || ""))) {
        nextErrors[key] = t.validation.number;
      }
    });

    if (!isValidPercentage(formData.discount_percentage)) {
      nextErrors.discount_percentage = t.validation.percentage;
    }

    if (!isValidPercentage(formData.system_commission_percentage)) {
      nextErrors.system_commission_percentage = t.validation.percentage;
    }

    if (formData.start_date && formData.end_date) {
      const startDate = new Date(formData.start_date).getTime();
      const endDate = new Date(formData.end_date).getTime();

      if (Number.isFinite(startDate) && Number.isFinite(endDate)) {
        if (endDate < startDate) {
          nextErrors.end_date = t.validation.dates;
        }
      }
    }

    formData.contract_products.forEach((row) => {
      const hasAnyValue =
        row.product_id ||
        row.special_price ||
        row.discount_percentage !== "0.00" ||
        !row.is_active;

      if (hasAnyValue && !row.product_id) {
        nextErrors[`product_${row.rowId}`] = t.validation.product;
      }

      if (!isValidNumber(row.special_price)) {
        nextErrors[`product_${row.rowId}`] = t.validation.number;
      }

      if (!isValidPercentage(row.discount_percentage)) {
        nextErrors[`product_${row.rowId}`] = t.validation.percentage;
      }
    });

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  const loadOptions = useCallback(
    async (showToast = false) => {
      if (!canCreateContracts) return;

      try {
        setIsLoadingOptions(true);
        setOptionsError("");

        const requests: Array<Promise<void>> = [];

        if (canViewProviders) {
          requests.push(
            fetch(apiUrl("/api/providers/?page_size=200"), {
              credentials: "include",
              headers: { Accept: "application/json" },
            })
              .then((response) => response.json())
              .then((payload) => {
                setProviders(
                  extractList(payload, ["providers", "centers"]).map((item) =>
                    normalizeOption(item, "PRV"),
                  ),
                );
              }),
          );
        }

        if (canViewProducts) {
          requests.push(
            fetch(apiUrl("/api/products/?page_size=200"), {
              credentials: "include",
              headers: { Accept: "application/json" },
            })
              .then((response) => response.json())
              .then((payload) => {
                setProducts(
                  extractList(payload, ["products"]).map((item) =>
                    normalizeOption(item, "PRD"),
                  ),
                );
              }),
          );
        }

        await Promise.all(requests);

        if (showToast) {
          toast.success(t.refreshOptions);
        }
      } catch (error) {
        console.error("Load contract form options error:", error);
        setOptionsError(t.optionLoadError);
        toast.error(t.optionLoadError);
      } finally {
        setIsLoadingOptions(false);
      }
    },
    [
      canCreateContracts,
      canViewProducts,
      canViewProviders,
      t.optionLoadError,
      t.refreshOptions,
    ],
  );

  async function postContract(payload: Record<string, unknown>) {
    const csrfToken = readCookie("csrftoken");

    const endpoints = ["/api/contracts/create/", "/api/contracts/"];

    let lastResult: CreateContractApiResponse | null = null;

    for (const endpoint of endpoints) {
      const response = await fetch(apiUrl(endpoint), {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => null)) as
        | CreateContractApiResponse
        | null;

      lastResult = result;

      if (response.status === 404 || response.status === 405) {
        continue;
      }

      if (!response.ok || result?.ok === false) {
        throw result || { message: `HTTP ${response.status}` };
      }

      return result || {};
    }

    throw lastResult || { message: t.apiError };
  }

  async function submitForm() {
    setSubmitError("");

    if (!validateForm()) {
      toast.error(t.validationToast);
      return;
    }

    try {
      setIsSubmitting(true);

      const result = await postContract(normalizePayload(formData));

      const createdId = resolveCreatedId(result);

      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      toast.success(t.success);

      if (createdId) {
        router.push(`/system/contracts/${createdId}`);
        return;
      }

      router.push("/system/contracts/list");
    } catch (error) {
      const result = error as CreateContractApiResponse;
      const apiErrors = mapApiFieldErrors(result?.errors);
      const message = result?.message || t.apiError;

      console.error("Create contract error:", error);

      setErrors((current) => ({
        ...current,
        ...apiErrors,
      }));

      setSubmitError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function saveDraft() {
    try {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formData));
      toast.success(t.draftSaved);
    } catch (error) {
      console.error("Save contract draft error:", error);
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

      const parsed = JSON.parse(rawDraft) as ContractFormData;

      setFormData({
        ...initialFormData,
        ...parsed,
        contract_products: Array.isArray(parsed.contract_products)
          ? parsed.contract_products.map((row) => ({
              ...createProductRow(),
              ...row,
              rowId: row.rowId || crypto.randomUUID(),
            }))
          : [],
      });

      setErrors({});
      setSubmitError("");
      toast.success(t.draftRestored);
    } catch (error) {
      console.error("Restore contract draft error:", error);
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
    if (authResolving) return;
    loadOptions(false);
  }, [authResolving, loadOptions]);

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

  if (!authResolving && !canCreateContracts) {
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
            onClick={() => confirmNavigate("/system/contracts")}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t.back}</span>
          </Button>

          {canViewContracts ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
              disabled={isSubmitting}
              onClick={() => confirmNavigate("/system/contracts/list")}
            >
              <ClipboardList className="h-4 w-4" />
              <span>{t.contractsList}</span>
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="h-10 w-full rounded-xl sm:w-auto"
            disabled={isSubmitting || isLoadingOptions}
            onClick={() => loadOptions(true)}
          >
            {isLoadingOptions ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refreshOptions}</span>
          </Button>

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

      {/* Errors */}
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

      {optionsError ? (
        <Card className="rounded-2xl border border-orange-200 bg-orange-50 shadow-sm dark:border-orange-900/40 dark:bg-orange-950/20">
          <CardContent className="flex items-start gap-3 p-5 text-orange-700 dark:text-orange-300">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">{optionsError}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Main Form */}
        <div className="space-y-4">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <FileText className="h-4 w-4" />
                {t.basicInfo}
              </CardTitle>
              <CardDescription>{t.basicDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <FieldBlock label={t.labels.contractNumber}>
                <Input
                  value={formData.contract_number}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.contractNumber}
                  className="h-10 rounded-xl"
                  dir="ltr"
                  onChange={(event) =>
                    updateField("contract_number", event.target.value)
                  }
                  onBlur={() =>
                    updateField(
                      "contract_number",
                      normalizeContractNumber(formData.contract_number),
                    )
                  }
                />
              </FieldBlock>

              <FieldBlock label={t.labels.title} error={errors.title} required>
                <Input
                  value={formData.title}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.title}
                  className="h-10 rounded-xl"
                  onChange={(event) => updateField("title", event.target.value)}
                />
              </FieldBlock>

              <FieldBlock label={t.labels.status}>
                <select
                  value={formData.status}
                  disabled={isSubmitting}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  onChange={(event) =>
                    updateField("status", event.target.value as ContractStatus)
                  }
                >
                  {Object.entries(t.statuses).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FieldBlock>

              <FieldBlock label={t.labels.pricingModel}>
                <select
                  value={formData.pricing_model}
                  disabled={isSubmitting}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  onChange={(event) =>
                    updateField(
                      "pricing_model",
                      event.target.value as PricingModel,
                    )
                  }
                >
                  {Object.entries(t.pricingModels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FieldBlock>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Building2 className="h-4 w-4" />
                {t.partyInfo}
              </CardTitle>
              <CardDescription>{t.partyDesc}</CardDescription>
            </CardHeader>

            <CardContent>
              <FieldBlock
                label={t.labels.provider}
                error={errors.provider_id}
                required
              >
                <SelectField
                  value={formData.provider_id}
                  disabled={isSubmitting || isLoadingOptions}
                  options={providers}
                  placeholder={t.selectPlaceholder}
                  noOptions={t.noOptions}
                  onChange={(value) => updateField("provider_id", value)}
                />
              </FieldBlock>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Wallet className="h-4 w-4" />
                {t.financialInfo}
              </CardTitle>
              <CardDescription>{t.financialDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-3">
              <FieldBlock
                label={t.labels.discountPercentage}
                error={errors.discount_percentage}
              >
                <Input
                  value={formData.discount_percentage}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.discountPercentage}
                  className="h-10 rounded-xl"
                  dir="ltr"
                  onChange={(event) =>
                    updateField("discount_percentage", event.target.value)
                  }
                  onBlur={() =>
                    updateField(
                      "discount_percentage",
                      normalizeNumberString(formData.discount_percentage),
                    )
                  }
                />
              </FieldBlock>

              <FieldBlock
                label={t.labels.systemCommissionPercentage}
                error={errors.system_commission_percentage}
              >
                <Input
                  value={formData.system_commission_percentage}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.systemCommissionPercentage}
                  className="h-10 rounded-xl"
                  dir="ltr"
                  onChange={(event) =>
                    updateField(
                      "system_commission_percentage",
                      event.target.value,
                    )
                  }
                  onBlur={() =>
                    updateField(
                      "system_commission_percentage",
                      normalizeNumberString(
                        formData.system_commission_percentage,
                      ),
                    )
                  }
                />
              </FieldBlock>

              <FieldBlock
                label={t.labels.contractValue}
                error={errors.contract_value}
              >
                <MoneyInput
                  value={formData.contract_value}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.contractValue}
                  isArabic={isArabic}
                  onChange={(value) => updateField("contract_value", value)}
                  onBlur={() => {
                    if (formData.contract_value.trim()) {
                      updateField(
                        "contract_value",
                        normalizeNumberString(formData.contract_value),
                      );
                    }
                  }}
                />
              </FieldBlock>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <CalendarDays className="h-4 w-4" />
                {t.datesInfo}
              </CardTitle>
              <CardDescription>{t.datesDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <FieldBlock label={t.labels.startDate} error={errors.start_date}>
                <Input
                  type="date"
                  value={formData.start_date}
                  disabled={isSubmitting}
                  className="h-10 rounded-xl"
                  onChange={(event) =>
                    updateField("start_date", event.target.value)
                  }
                />
              </FieldBlock>

              <FieldBlock label={t.labels.endDate} error={errors.end_date}>
                <Input
                  type="date"
                  value={formData.end_date}
                  disabled={isSubmitting}
                  className="h-10 rounded-xl"
                  onChange={(event) =>
                    updateField("end_date", event.target.value)
                  }
                />
              </FieldBlock>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="flex flex-col gap-3 pb-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Package className="h-4 w-4" />
                  {t.productsInfo}
                </CardTitle>
                <CardDescription>{t.productsDesc}</CardDescription>
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl"
                disabled={isSubmitting}
                onClick={addProductRow}
              >
                <Plus className="h-4 w-4" />
                {t.addProduct}
              </Button>
            </CardHeader>

            <CardContent className="space-y-3">
              {formData.contract_products.length === 0 ? (
                <div className="rounded-2xl border bg-background p-6 text-center">
                  <Package className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t.productsDesc}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4 rounded-xl"
                    disabled={isSubmitting}
                    onClick={addProductRow}
                  >
                    <Plus className="h-4 w-4" />
                    {t.addProduct}
                  </Button>
                </div>
              ) : (
                formData.contract_products.map((row, index) => (
                  <div
                    key={row.rowId}
                    className="rounded-2xl border bg-background p-4"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">
                          {t.labels.product} #{index + 1}
                        </p>
                        {errors[`product_${row.rowId}`] ? (
                          <p className="mt-1 text-xs font-medium text-destructive">
                            {errors[`product_${row.rowId}`]}
                          </p>
                        ) : null}
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-xl"
                        disabled={isSubmitting}
                        onClick={() => removeProductRow(row.rowId)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <FieldBlock label={t.labels.product}>
                        <SelectField
                          value={row.product_id}
                          disabled={isSubmitting || isLoadingOptions}
                          options={products}
                          placeholder={t.selectPlaceholder}
                          noOptions={t.noOptions}
                          onChange={(value) => {
                            const selected = products.find(
                              (item) => item.id === value,
                            );

                            const price = selected?.raw
                              ? getValue(selected.raw, [
                                  "effective_price",
                                  "sale_price",
                                  "price",
                                  "base_price",
                                ])
                              : "";

                            updateProductRow(row.rowId, {
                              product_id: value,
                              special_price:
                                price && !row.special_price
                                  ? normalizeNumberString(String(price))
                                  : row.special_price,
                            });
                          }}
                        />
                      </FieldBlock>

                      <FieldBlock label={t.labels.specialPrice}>
                        <MoneyInput
                          value={row.special_price}
                          disabled={isSubmitting}
                          placeholder={t.placeholders.specialPrice}
                          isArabic={isArabic}
                          onChange={(value) =>
                            updateProductRow(row.rowId, {
                              special_price: value,
                            })
                          }
                          onBlur={() => {
                            if (row.special_price.trim()) {
                              updateProductRow(row.rowId, {
                                special_price: normalizeNumberString(
                                  row.special_price,
                                ),
                              });
                            }
                          }}
                        />
                      </FieldBlock>

                      <FieldBlock label={t.labels.productDiscount}>
                        <Input
                          value={row.discount_percentage}
                          disabled={isSubmitting}
                          placeholder={t.placeholders.productDiscount}
                          className="h-10 rounded-xl"
                          dir="ltr"
                          onChange={(event) =>
                            updateProductRow(row.rowId, {
                              discount_percentage: event.target.value,
                            })
                          }
                          onBlur={() =>
                            updateProductRow(row.rowId, {
                              discount_percentage: normalizeNumberString(
                                row.discount_percentage,
                              ),
                            })
                          }
                        />
                      </FieldBlock>

                      <div className="flex items-end">
                        <label className="flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-xl border bg-card px-3 py-2">
                          <Checkbox
                            checked={row.is_active}
                            disabled={isSubmitting}
                            onCheckedChange={(value) =>
                              updateProductRow(row.rowId, {
                                is_active: Boolean(value),
                              })
                            }
                          />
                          <span className="text-sm font-medium">
                            {t.labels.activeProduct}
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <ShieldCheck className="h-4 w-4" />
                {t.termsInfo}
              </CardTitle>
              <CardDescription>{t.termsDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4">
              <FieldBlock label={t.labels.terms}>
                <Textarea
                  value={formData.terms_and_conditions}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.terms}
                  className="min-h-28 rounded-xl"
                  onChange={(event) =>
                    updateField("terms_and_conditions", event.target.value)
                  }
                />
              </FieldBlock>

              <FieldBlock label={t.labels.coverageNotes}>
                <Textarea
                  value={formData.coverage_notes}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.coverageNotes}
                  className="min-h-28 rounded-xl"
                  onChange={(event) =>
                    updateField("coverage_notes", event.target.value)
                  }
                />
              </FieldBlock>

              <FieldBlock label={t.labels.notes}>
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

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <BadgeCheck className="h-4 w-4" />
                {t.postOptionsInfo}
              </CardTitle>
              <CardDescription>{t.postOptionsDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <ToggleBox
                checked={formData.auto_activate}
                disabled={isSubmitting}
                title={t.labels.autoActivate}
                description={t.labels.autoActivate}
                onChange={(value) => updateField("auto_activate", value)}
              />

              <ToggleBox
                checked={formData.notify_provider}
                disabled={isSubmitting}
                title={t.labels.notifyProvider}
                description={t.labels.notifyProvider}
                onChange={(value) => updateField("notify_provider", value)}
              />
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
                icon={FileText}
                label={t.labels.contractNumber}
                value={formData.contract_number || "-"}
              />

              <SummaryItem
                icon={Handshake}
                label={t.labels.title}
                value={formData.title || "-"}
              />

              <SummaryItem
                icon={Building2}
                label={t.labels.provider}
                value={selectedProvider?.label || "-"}
              />

              <SummaryItem
                icon={Layers3}
                label={t.labels.pricingModel}
                value={t.pricingModels[formData.pricing_model]}
              />

              <SummaryItem
                icon={Percent}
                label={t.labels.discountPercentage}
                value={formatPercent(formData.discount_percentage)}
              />

              <SummaryItem
                icon={Percent}
                label={t.labels.systemCommissionPercentage}
                value={formatPercent(formData.system_commission_percentage)}
              />

              <SummaryItem
                icon={Wallet}
                label={t.labels.contractValue}
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <span>{formatMoney(formData.contract_value || 0)}</span>
                    <SarIcon className="h-3.5 w-3.5" />
                  </span>
                }
              />

              <SummaryItem
                icon={Package}
                label={t.productsCount}
                value={formatNumber(selectedProductsCount)}
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
                    <RefreshCcw className="h-4 w-4" />
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