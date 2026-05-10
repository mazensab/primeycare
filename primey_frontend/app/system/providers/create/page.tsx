"use client";

/* ============================================================
   📂 app/system/providers/create/page.tsx
   🧠 Primey Care | Create Provider
   ------------------------------------------------------------
   ✅ المرحلة 17 + المرحلة 2
   ✅ Providers هو الموديول الرسمي
   ✅ Full Width Layout
   ✅ Main Form + Sidebar Summary
   ✅ دعم الاسم العربي والإنجليزي بشكل مستقل
   ✅ دعم السجل التجاري والرقم الضريبي
   ✅ دعم حقول الشبكة الطبية والاستيراد
   ✅ حماية زر الإنشاء وطلبات الحفظ حسب الصلاحيات
   ✅ fallback آمن لـ system_admin / superuser
   ✅ Error Alert داخلي
   ✅ Field-level validation
   ✅ beforeunload protection
   ✅ حفظ واستعادة مسودة محلية
   ✅ تعطيل الحقول أثناء الحفظ
   ✅ تنظيف البيانات قبل الإرسال
   ✅ استخدام toast من sonner
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ استخدام رمز العملة /currency/sar.svg في أي قيمة مالية مستقبلية
   ✅ بدون localhost hardcoded
   ✅ لا توجد روابط تقارير داخل الوحدة
   ✅ لا توجد نصوص تقنية ظاهرة في الواجهة
   ✅ الأرقام تبقى بالإنجليزية
============================================================ */

import { useRouter } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileText,
  Globe2,
  Hospital,
  Layers3,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  Sparkles,
  Stethoscope,
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

type ProviderStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DRAFT";

type ProviderType =
  | "HOSPITAL"
  | "MEDICAL_CENTER"
  | "PHARMACY"
  | "PARTNER"
  | "LAB"
  | "CLINIC"
  | "OTHER";

type ProviderFormData = {
  name: string;
  name_ar: string;
  name_en: string;
  code: string;
  provider_type: ProviderType;
  status: ProviderStatus;

  commercial_registration: string;
  tax_number: string;

  contact_person: string;
  phone: string;
  mobile: string;
  email: string;
  website: string;

  region: string;
  city: string;
  area: string;
  street: string;
  address: string;
  google_maps_link: string;

  source_category: string;
  import_source: string;
  external_reference: string;

  notes: string;
  is_featured: boolean;
};

type ProviderFormErrors = Partial<Record<keyof ProviderFormData, string>>;

type CreateProviderApiResponse = {
  ok?: boolean;
  message?: string;
  detail?: string;
  error?: string;
  errors?: Record<string, string[] | string> | string[] | string;
  id?: number | string;
  provider?: {
    id?: number | string;
  };
  data?: {
    id?: number | string;
    provider?: {
      id?: number | string;
    };
  };
};

const DRAFT_STORAGE_KEY = "primey-care-provider-create-draft-v2";

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
   Defaults
============================================================ */

const initialFormData: ProviderFormData = {
  name: "",
  name_ar: "",
  name_en: "",
  code: "",
  provider_type: "MEDICAL_CENTER",
  status: "ACTIVE",

  commercial_registration: "",
  tax_number: "",

  contact_person: "",
  phone: "",
  mobile: "",
  email: "",
  website: "",

  region: "",
  city: "",
  area: "",
  street: "",
  address: "",
  google_maps_link: "",

  source_category: "",
  import_source: "",
  external_reference: "",

  notes: "",
  is_featured: false,
};

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "إنشاء مقدم خدمة جديد" : "Create New Provider",
    subtitle: isArabic
      ? "إضافة جهة مقدمة للخدمة مع الاسم العربي والإنجليزي والبيانات النظامية قبل ربطها بالعقود والخدمات والطلبات."
      : "Create a provider with Arabic/English names and legal data before linking contracts, services, and orders.",

    back: isArabic ? "العودة لمقدمي الخدمة" : "Back to Providers",
    providersList: isArabic ? "قائمة مقدمي الخدمة" : "Providers List",
    importProviders: isArabic ? "استيراد الشبكة الطبية" : "Import Medical Network",
    create: isArabic ? "إنشاء مقدم الخدمة" : "Create Provider",
    saving: isArabic ? "جاري الحفظ..." : "Saving...",
    saveDraft: isArabic ? "حفظ كمسودة محلية" : "Save Local Draft",
    restoreDraft: isArabic ? "استعادة المسودة" : "Restore Draft",
    clearForm: isArabic ? "تفريغ النموذج" : "Clear Form",

    basicInfo: isArabic ? "البيانات الأساسية" : "Basic Information",
    basicDesc: isArabic
      ? "الاسم العربي والإنجليزي، الكود، التصنيف، وحالة التشغيل."
      : "Arabic and English names, code, type, and operational status.",

    legalInfo: isArabic ? "البيانات النظامية والضريبية" : "Legal & Tax Data",
    legalDesc: isArabic
      ? "السجل التجاري والرقم الضريبي لمقدم الخدمة."
      : "Commercial registration and tax number for the provider.",

    contactInfo: isArabic ? "بيانات التواصل" : "Contact Information",
    contactDesc: isArabic
      ? "مسؤول التواصل، الهاتف، الجوال، البريد، والموقع الإلكتروني."
      : "Contact person, phone, mobile, email, and website.",

    locationInfo: isArabic ? "بيانات الموقع" : "Location Information",
    locationDesc: isArabic
      ? "المنطقة، المدينة، الحي، الشارع، العنوان، ورابط الخريطة."
      : "Region, city, area, street, address, and map link.",

    networkInfo: isArabic ? "بيانات الشبكة الطبية" : "Medical Network Data",
    networkDesc: isArabic
      ? "حقول اختيارية تساعد في تتبع المصدر أو المرجع الخارجي."
      : "Optional fields used for source tracking or external references.",

    operationalInfo: isArabic ? "بيانات تشغيلية" : "Operational Information",
    operationalDesc: isArabic
      ? "تمييز مقدم الخدمة والملاحظات التشغيلية."
      : "Featured status and operational notes.",

    summaryTitle: isArabic ? "ملخص مقدم الخدمة" : "Provider Summary",
    summaryDesc: isArabic
      ? "مراجعة سريعة للبيانات قبل الحفظ."
      : "Quick review before saving.",

    stepsTitle: isArabic ? "إرشادات قبل الحفظ" : "Before Saving",
    stepsDesc: isArabic
      ? "نقاط مهمة تساعدك على إنشاء مقدم خدمة صحيح."
      : "Important points to help you create a correct provider.",

    formErrorTitle: isArabic ? "تعذر حفظ البيانات" : "Unable to save data",

    accessDeniedTitle: isArabic
      ? "غير مصرح بإنشاء مقدم خدمة"
      : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية إنشاء مقدمي الخدمة. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to create providers. Contact your system administrator if you need access.",

    labels: {
      name: isArabic ? "الاسم العام / التوافقي" : "General / Legacy Name",
      nameAr: isArabic ? "اسم مقدم الخدمة بالعربي" : "Arabic Provider Name",
      nameEn: isArabic ? "اسم مقدم الخدمة بالإنجليزي" : "English Provider Name",
      code: isArabic ? "كود مقدم الخدمة" : "Provider Code",
      providerType: isArabic ? "التصنيف" : "Provider Type",
      status: isArabic ? "الحالة" : "Status",
      commercialRegistration: isArabic ? "السجل التجاري" : "Commercial Registration",
      taxNumber: isArabic ? "الرقم الضريبي" : "Tax Number",
      contactPerson: isArabic ? "مسؤول التواصل" : "Contact Person",
      phone: isArabic ? "رقم الهاتف" : "Phone",
      mobile: isArabic ? "رقم الجوال" : "Mobile",
      email: isArabic ? "البريد الإلكتروني" : "Email",
      website: isArabic ? "الموقع الإلكتروني" : "Website",
      region: isArabic ? "المنطقة" : "Region",
      city: isArabic ? "المدينة" : "City",
      area: isArabic ? "الحي / المنطقة" : "Area",
      street: isArabic ? "الشارع" : "Street",
      address: isArabic ? "العنوان" : "Address",
      googleMaps: isArabic ? "رابط الخريطة" : "Map Link",
      sourceCategory: isArabic ? "تصنيف المصدر" : "Source Category",
      importSource: isArabic ? "مصدر الاستيراد" : "Import Source",
      externalReference: isArabic ? "المرجع الخارجي" : "External Reference",
      notes: isArabic ? "ملاحظات" : "Notes",
      featured: isArabic ? "مقدم خدمة مميز" : "Featured Provider",
    },

    placeholders: {
      name: isArabic
        ? "يُملأ تلقائيًا من الاسم العربي أو الإنجليزي عند الحفظ"
        : "Auto-filled from Arabic or English name on save",
      nameAr: isArabic
        ? "مثال: مستشفى برايمي الطبي"
        : "Example: مستشفى برايمي الطبي",
      nameEn: isArabic
        ? "مثال: Primey Medical Hospital"
        : "Example: Primey Medical Hospital",
      code: isArabic
        ? "اتركه فارغًا للتوليد التلقائي"
        : "Leave blank for auto generation",
      commercialRegistration: isArabic ? "مثال: 1010123456" : "Example: 1010123456",
      taxNumber: isArabic ? "مثال: 300123456700003" : "Example: 300123456700003",
      contactPerson: isArabic ? "مثال: محمد أحمد" : "Example: Mohammed Ahmed",
      phone: isArabic ? "011xxxxxxx" : "011xxxxxxx",
      mobile: isArabic ? "05xxxxxxxx" : "05xxxxxxxx",
      email: isArabic ? "provider@example.com" : "provider@example.com",
      website: isArabic ? "https://example.com" : "https://example.com",
      region: isArabic ? "مثال: منطقة مكة المكرمة" : "Example: Makkah Region",
      city: isArabic ? "مثال: جدة" : "Example: Jeddah",
      area: isArabic ? "مثال: الروضة" : "Example: Al Rawdah",
      street: isArabic ? "مثال: شارع التحلية" : "Example: Tahlia Street",
      address: isArabic ? "اكتب العنوان التفصيلي" : "Enter full address",
      googleMaps: isArabic
        ? "https://maps.google.com/..."
        : "https://maps.google.com/...",
      sourceCategory: isArabic ? "مثال: مجمع طبي" : "Example: Medical Complex",
      importSource: isArabic ? "مثال: medical_network_excel" : "Example: medical_network_excel",
      externalReference: isArabic ? "مثال: 125" : "Example: 125",
      notes: isArabic
        ? "أي ملاحظات تشغيلية عن مقدم الخدمة..."
        : "Any operational notes about the provider...",
    },

    providerTypes: {
      HOSPITAL: isArabic ? "مستشفى" : "Hospital",
      MEDICAL_CENTER: isArabic ? "مركز طبي" : "Medical Center",
      PHARMACY: isArabic ? "صيدلية" : "Pharmacy",
      PARTNER: isArabic ? "شريك" : "Partner",
      LAB: isArabic ? "مختبر" : "Lab",
      CLINIC: isArabic ? "عيادة" : "Clinic",
      OTHER: isArabic ? "أخرى" : "Other",
    } satisfies Record<ProviderType, string>,

    statuses: {
      ACTIVE: isArabic ? "نشط" : "Active",
      INACTIVE: isArabic ? "غير نشط" : "Inactive",
      SUSPENDED: isArabic ? "موقوف" : "Suspended",
      DRAFT: isArabic ? "مسودة" : "Draft",
    } satisfies Record<ProviderStatus, string>,

    validation: {
      name: isArabic
        ? "يجب إدخال الاسم العربي أو الإنجليزي لمقدم الخدمة."
        : "Arabic or English provider name is required.",
      codeLength: isArabic
        ? "الكود يجب ألا يتجاوز 50 حرفًا."
        : "Code must not exceed 50 characters.",
      commercialRegistrationLength: isArabic
        ? "السجل التجاري يجب ألا يتجاوز 100 حرف."
        : "Commercial registration must not exceed 100 characters.",
      taxNumberLength: isArabic
        ? "الرقم الضريبي يجب ألا يتجاوز 100 حرف."
        : "Tax number must not exceed 100 characters.",
      email: isArabic
        ? "صيغة البريد الإلكتروني غير صحيحة."
        : "Email format is invalid.",
      website: isArabic
        ? "رابط الموقع يجب أن يبدأ بـ http:// أو https://."
        : "Website URL must start with http:// or https://.",
      maps: isArabic
        ? "رابط الخريطة يجب أن يبدأ بـ http:// أو https://."
        : "Map link must start with http:// or https://.",
      phone: isArabic
        ? "رقم التواصل يجب أن يحتوي أرقامًا فقط مع السماح بعلامة +."
        : "Contact number must contain digits only, with optional +.",
    },

    success: isArabic
      ? "تم إنشاء مقدم الخدمة بنجاح."
      : "Provider created successfully.",
    draftSaved: isArabic ? "تم حفظ المسودة محليًا." : "Draft saved locally.",
    draftRestored: isArabic ? "تمت استعادة المسودة." : "Draft restored.",
    noDraft: isArabic ? "لا توجد مسودة محفوظة." : "No saved draft found.",
    formCleared: isArabic ? "تم تفريغ النموذج." : "Form cleared.",
    apiError: isArabic
      ? "تعذر إنشاء مقدم الخدمة. تحقق من البيانات وحاول مرة أخرى."
      : "Unable to create provider. Please check the data and try again.",
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

    yes: isArabic ? "نعم" : "Yes",
    no: isArabic ? "لا" : "No",

    featuredDescription: isArabic
      ? "استخدم هذا الخيار لإبراز مقدم الخدمة في الواجهات والعروض."
      : "Use this option to highlight the provider in pages and offers.",

    afterCreateHint: isArabic
      ? "بعد إنشاء مقدم الخدمة سيتم فتح صفحة التفاصيل، ومنها يمكنك رفع الشعار والصورة ومرفقات Google Drive."
      : "After creation, the detail page opens so you can upload the logo, image, and Google Drive files.",

    quickNotes: [
      isArabic
        ? "الاسم العربي أو الإنجليزي مطلوب، وسيتم حفظ الاسم العام تلقائيًا للتوافق مع الصفحات القديمة."
        : "Arabic or English name is required. The general name is saved automatically for backward compatibility.",
      isArabic
        ? "يمكن ترك الكود فارغًا ليتم توليده من الباكند تلقائيًا."
        : "Code can be left blank and generated automatically by the backend.",
      isArabic
        ? "السجل التجاري والرقم الضريبي مهمان لتقرير مقدم الخدمة والطباعة."
        : "Commercial registration and tax number are important for provider reports and printing.",
      isArabic
        ? "الشعار والصورة والمرفقات يتم رفعها بعد الإنشاء من صفحة تفاصيل مقدم الخدمة."
        : "Logo, image, and documents are uploaded after creation from the provider detail page.",
    ],
  };
}

/* ============================================================
   Data Helpers
============================================================ */

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "").trim();
}

function normalizeCode(value: string) {
  return value.trim().replace(/\s+/g, "-").toUpperCase();
}

function normalizeIdentifier(value: string) {
  return value.trim().replace(/\s+/g, "");
}

function normalizeUrl(value: string) {
  return value.trim();
}

function isValidUrl(value: string) {
  if (!value.trim()) return true;

  return /^https?:\/\/.+/i.test(value.trim());
}

function isValidEmail(value: string) {
  if (!value.trim()) return true;

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidPhone(value: string) {
  if (!value.trim()) return true;

  return /^\+?\d{6,18}$/.test(normalizePhone(value));
}

function hasFormChanges(formData: ProviderFormData) {
  return JSON.stringify(formData) !== JSON.stringify(initialFormData);
}

function resolveGeneralName(formData: ProviderFormData) {
  return formData.name.trim() || formData.name_ar.trim() || formData.name_en.trim();
}

function normalizePayload(formData: ProviderFormData) {
  const generalName = resolveGeneralName(formData);
  const nameAr = formData.name_ar.trim();
  const nameEn = formData.name_en.trim();

  return {
    name: generalName,
    name_ar: nameAr || generalName,
    name_en: nameEn,
    code: normalizeCode(formData.code),
    provider_type: formData.provider_type,
    status: formData.status,

    commercial_registration: normalizeIdentifier(formData.commercial_registration),
    tax_number: normalizeIdentifier(formData.tax_number),

    contact_person: formData.contact_person.trim(),
    phone: normalizePhone(formData.phone),
    mobile: normalizePhone(formData.mobile),
    email: formData.email.trim().toLowerCase(),
    website: normalizeUrl(formData.website),

    region: formData.region.trim(),
    city: formData.city.trim(),
    area: formData.area.trim(),
    street: formData.street.trim(),
    address: formData.address.trim(),
    google_maps_link: normalizeUrl(formData.google_maps_link),

    source_category: formData.source_category.trim(),
    import_source: formData.import_source.trim(),
    external_reference: formData.external_reference.trim(),

    notes: formData.notes.trim(),
    is_featured: formData.is_featured,
  };
}

function resolveCreatedId(result: CreateProviderApiResponse) {
  return (
    result.provider?.id ||
    result.data?.provider?.id ||
    result.data?.id ||
    result.id ||
    null
  );
}

function normalizeApiErrors(errors: CreateProviderApiResponse["errors"]) {
  if (!errors) return "";

  if (typeof errors === "string") return errors;

  if (Array.isArray(errors)) {
    return errors.filter(Boolean).join("، ");
  }

  return Object.entries(errors)
    .map(([key, value]) => {
      const message = Array.isArray(value) ? value.join("، ") : value;
      return `${key}: ${message}`;
    })
    .join("، ");
}

function mapApiFieldErrors(
  errors: CreateProviderApiResponse["errors"],
): ProviderFormErrors {
  const nextErrors: ProviderFormErrors = {};

  if (!errors || typeof errors === "string" || Array.isArray(errors)) {
    return nextErrors;
  }

  Object.entries(errors).forEach(([key, value]) => {
    const message = Array.isArray(value) ? value[0] : value;

    if (!message) return;

    if (key in initialFormData) {
      nextErrors[key as keyof ProviderFormData] = String(message);
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

function providerTypeIcon(
  type: ProviderType,
): ComponentType<{ className?: string }> {
  if (type === "HOSPITAL") return Hospital;
  if (type === "MEDICAL_CENTER") return Stethoscope;
  if (type === "PHARMACY") return ShieldCheck;
  if (type === "LAB") return Layers3;
  if (type === "CLINIC") return Stethoscope;

  return Building2;
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
        <div className="mt-1 truncate text-sm font-semibold">
          {value || "-"}
        </div>
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

/* ============================================================
   Page
============================================================ */

export default function SystemCreateProviderPage() {
  const router = useRouter();
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [formData, setFormData] = useState<ProviderFormData>(initialFormData);
  const [errors, setErrors] = useState<ProviderFormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canCreateProviders = hasSafePermission(
    auth,
    ["providers.create"],
    "action",
  );

  const canImportProviders = hasSafePermission(
    auth,
    ["providers.import", "providers.create"],
    "action",
  );

  const canViewProviders = hasSafePermission(
    auth,
    ["providers.view", "providers.list"],
    "view",
  );

  const isDirty = useMemo(() => hasFormChanges(formData), [formData]);

  const ProviderIcon = providerTypeIcon(formData.provider_type);

  const completedFields = useMemo(() => {
    const keys: Array<keyof ProviderFormData> = [
      "name_ar",
      "name_en",
      "code",
      "provider_type",
      "status",
      "commercial_registration",
      "tax_number",
      "phone",
      "mobile",
      "email",
      "region",
      "city",
      "area",
      "street",
      "address",
      "contact_person",
      "source_category",
      "external_reference",
    ];

    return keys.filter((key) => String(formData[key] || "").trim().length > 0)
      .length;
  }, [formData]);

  const progressPercent = Math.min(
    100,
    Math.round((completedFields / 18) * 100),
  );

  const isReadyToSave =
    formData.name_ar.trim().length > 0 ||
    formData.name_en.trim().length > 0 ||
    formData.name.trim().length > 0;

  function updateField<K extends keyof ProviderFormData>(
    key: K,
    value: ProviderFormData[K],
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
    const nextErrors: ProviderFormErrors = {};

    if (!isReadyToSave) {
      nextErrors.name_ar = t.validation.name;
    }

    if (formData.code.trim().length > 50) {
      nextErrors.code = t.validation.codeLength;
    }

    if (formData.commercial_registration.trim().length > 100) {
      nextErrors.commercial_registration =
        t.validation.commercialRegistrationLength;
    }

    if (formData.tax_number.trim().length > 100) {
      nextErrors.tax_number = t.validation.taxNumberLength;
    }

    if (!isValidEmail(formData.email)) {
      nextErrors.email = t.validation.email;
    }

    if (!isValidUrl(formData.website)) {
      nextErrors.website = t.validation.website;
    }

    if (!isValidUrl(formData.google_maps_link)) {
      nextErrors.google_maps_link = t.validation.maps;
    }

    if (!isValidPhone(formData.phone)) {
      nextErrors.phone = t.validation.phone;
    }

    if (!isValidPhone(formData.mobile)) {
      nextErrors.mobile = t.validation.phone;
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

      const response = await fetch(apiUrl("/api/providers/"), {
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
        | CreateProviderApiResponse
        | null;

      if (!response.ok || result?.ok === false) {
        const apiErrors = mapApiFieldErrors(result?.errors);
        const message =
          normalizeApiErrors(result?.errors) ||
          result?.message ||
          result?.detail ||
          result?.error ||
          t.apiError;

        setErrors((current) => ({
          ...current,
          ...apiErrors,
        }));

        setSubmitError(message);
        toast.error(t.apiError, {
          description: message,
        });
        return;
      }

      const createdId = result ? resolveCreatedId(result) : null;

      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      toast.success(t.success);

      if (createdId) {
        router.push(`/system/providers/${createdId}`);
        return;
      }

      router.push("/system/providers/list");
    } catch (error) {
      console.error("Create provider error:", error);
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
      console.error("Save provider draft error:", error);
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

      const parsed = JSON.parse(rawDraft) as Partial<ProviderFormData>;

      setFormData({
        ...initialFormData,
        ...parsed,
      });

      setErrors({});
      setSubmitError("");
      toast.success(t.draftRestored);
    } catch (error) {
      console.error("Restore provider draft error:", error);
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

  if (!authResolving && !canCreateProviders) {
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
            onClick={() => confirmNavigate("/system/providers")}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t.back}</span>
          </Button>

          {canViewProviders ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
              disabled={isSubmitting}
              onClick={() => confirmNavigate("/system/providers/list")}
            >
              <ClipboardList className="h-4 w-4" />
              <span>{t.providersList}</span>
            </Button>
          ) : null}

          {canImportProviders ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
              disabled={isSubmitting}
              onClick={() => confirmNavigate("/system/providers/import")}
            >
              <FileText className="h-4 w-4" />
              <span>{t.importProviders}</span>
            </Button>
          ) : null}
        </div>
      </div>

      {submitError ? (
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 shadow-sm">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-semibold text-destructive">
                {t.formErrorTitle}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {submitError}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {t.basicInfo}
              </CardTitle>
              <CardDescription>{t.basicDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <FieldBlock label={t.labels.nameAr} error={errors.name_ar} required>
                <Input
                  value={formData.name_ar}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.nameAr}
                  className="rounded-xl"
                  onChange={(event) => updateField("name_ar", event.target.value)}
                />
              </FieldBlock>

              <FieldBlock label={t.labels.nameEn} error={errors.name_en}>
                <Input
                  value={formData.name_en}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.nameEn}
                  className="rounded-xl"
                  onChange={(event) => updateField("name_en", event.target.value)}
                />
              </FieldBlock>

              <FieldBlock label={t.labels.name} error={errors.name}>
                <Input
                  value={formData.name}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.name}
                  className="rounded-xl"
                  onChange={(event) => updateField("name", event.target.value)}
                />
              </FieldBlock>

              <FieldBlock label={t.labels.code} error={errors.code}>
                <Input
                  value={formData.code}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.code}
                  className="rounded-xl"
                  onChange={(event) => updateField("code", event.target.value)}
                />
              </FieldBlock>

              <FieldBlock label={t.labels.providerType} error={errors.provider_type}>
                <select
                  value={formData.provider_type}
                  disabled={isSubmitting}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  onChange={(event) =>
                    updateField("provider_type", event.target.value as ProviderType)
                  }
                >
                  {Object.entries(t.providerTypes).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FieldBlock>

              <FieldBlock label={t.labels.status} error={errors.status}>
                <select
                  value={formData.status}
                  disabled={isSubmitting}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  onChange={(event) =>
                    updateField("status", event.target.value as ProviderStatus)
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

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                {t.legalInfo}
              </CardTitle>
              <CardDescription>{t.legalDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <FieldBlock
                label={t.labels.commercialRegistration}
                error={errors.commercial_registration}
              >
                <Input
                  value={formData.commercial_registration}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.commercialRegistration}
                  className="rounded-xl"
                  onChange={(event) =>
                    updateField("commercial_registration", event.target.value)
                  }
                />
              </FieldBlock>

              <FieldBlock label={t.labels.taxNumber} error={errors.tax_number}>
                <Input
                  value={formData.tax_number}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.taxNumber}
                  className="rounded-xl"
                  onChange={(event) => updateField("tax_number", event.target.value)}
                />
              </FieldBlock>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                {t.contactInfo}
              </CardTitle>
              <CardDescription>{t.contactDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <FieldBlock
                label={t.labels.contactPerson}
                error={errors.contact_person}
              >
                <Input
                  value={formData.contact_person}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.contactPerson}
                  className="rounded-xl"
                  onChange={(event) =>
                    updateField("contact_person", event.target.value)
                  }
                />
              </FieldBlock>

              <FieldBlock label={t.labels.phone} error={errors.phone}>
                <Input
                  value={formData.phone}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.phone}
                  className="rounded-xl"
                  onChange={(event) => updateField("phone", event.target.value)}
                />
              </FieldBlock>

              <FieldBlock label={t.labels.mobile} error={errors.mobile}>
                <Input
                  value={formData.mobile}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.mobile}
                  className="rounded-xl"
                  onChange={(event) => updateField("mobile", event.target.value)}
                />
              </FieldBlock>

              <FieldBlock label={t.labels.email} error={errors.email}>
                <Input
                  value={formData.email}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.email}
                  className="rounded-xl"
                  onChange={(event) => updateField("email", event.target.value)}
                />
              </FieldBlock>

              <FieldBlock label={t.labels.website} error={errors.website}>
                <Input
                  value={formData.website}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.website}
                  className="rounded-xl"
                  onChange={(event) => updateField("website", event.target.value)}
                />
              </FieldBlock>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {t.locationInfo}
              </CardTitle>
              <CardDescription>{t.locationDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <FieldBlock label={t.labels.region} error={errors.region}>
                <Input
                  value={formData.region}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.region}
                  className="rounded-xl"
                  onChange={(event) => updateField("region", event.target.value)}
                />
              </FieldBlock>

              <FieldBlock label={t.labels.city} error={errors.city}>
                <Input
                  value={formData.city}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.city}
                  className="rounded-xl"
                  onChange={(event) => updateField("city", event.target.value)}
                />
              </FieldBlock>

              <FieldBlock label={t.labels.area} error={errors.area}>
                <Input
                  value={formData.area}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.area}
                  className="rounded-xl"
                  onChange={(event) => updateField("area", event.target.value)}
                />
              </FieldBlock>

              <FieldBlock label={t.labels.street} error={errors.street}>
                <Input
                  value={formData.street}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.street}
                  className="rounded-xl"
                  onChange={(event) => updateField("street", event.target.value)}
                />
              </FieldBlock>

              <FieldBlock label={t.labels.address} error={errors.address}>
                <Input
                  value={formData.address}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.address}
                  className="rounded-xl"
                  onChange={(event) => updateField("address", event.target.value)}
                />
              </FieldBlock>

              <FieldBlock label={t.labels.googleMaps} error={errors.google_maps_link}>
                <Input
                  value={formData.google_maps_link}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.googleMaps}
                  className="rounded-xl"
                  onChange={(event) =>
                    updateField("google_maps_link", event.target.value)
                  }
                />
              </FieldBlock>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe2 className="h-5 w-5" />
                {t.networkInfo}
              </CardTitle>
              <CardDescription>{t.networkDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <FieldBlock
                label={t.labels.sourceCategory}
                error={errors.source_category}
              >
                <Input
                  value={formData.source_category}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.sourceCategory}
                  className="rounded-xl"
                  onChange={(event) =>
                    updateField("source_category", event.target.value)
                  }
                />
              </FieldBlock>

              <FieldBlock label={t.labels.importSource} error={errors.import_source}>
                <Input
                  value={formData.import_source}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.importSource}
                  className="rounded-xl"
                  onChange={(event) =>
                    updateField("import_source", event.target.value)
                  }
                />
              </FieldBlock>

              <FieldBlock
                label={t.labels.externalReference}
                error={errors.external_reference}
              >
                <Input
                  value={formData.external_reference}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.externalReference}
                  className="rounded-xl"
                  onChange={(event) =>
                    updateField("external_reference", event.target.value)
                  }
                />
              </FieldBlock>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                {t.operationalInfo}
              </CardTitle>
              <CardDescription>{t.operationalDesc}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <ToggleBox
                checked={formData.is_featured}
                disabled={isSubmitting}
                title={t.labels.featured}
                description={t.featuredDescription}
                onChange={(value) => updateField("is_featured", value)}
              />

              <FieldBlock label={t.labels.notes} error={errors.notes}>
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

        <div className="space-y-4">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ProviderIcon className="h-5 w-5" />
                {t.summaryTitle}
              </CardTitle>
              <CardDescription>{t.summaryDesc}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              <SummaryItem
                icon={Building2}
                label={t.labels.nameAr}
                value={formData.name_ar || "-"}
              />

              <SummaryItem
                icon={Globe2}
                label={t.labels.nameEn}
                value={formData.name_en || "-"}
              />

              <SummaryItem
                icon={ClipboardList}
                label={t.labels.code}
                value={formData.code || t.placeholders.code}
              />

              <SummaryItem
                icon={ProviderIcon}
                label={t.labels.providerType}
                value={t.providerTypes[formData.provider_type]}
              />

              <SummaryItem
                icon={ShieldCheck}
                label={t.labels.commercialRegistration}
                value={formData.commercial_registration || "-"}
              />

              <SummaryItem
                icon={FileText}
                label={t.labels.taxNumber}
                value={formData.tax_number || "-"}
              />

              <SummaryItem
                icon={MapPin}
                label={t.labels.city}
                value={
                  [formData.region, formData.city, formData.area]
                    .filter(Boolean)
                    .join(" / ") || "-"
                }
              />

              <SummaryItem
                icon={Mail}
                label={t.labels.email}
                value={formData.email || "-"}
              />

              <div className="rounded-xl border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{t.completion}</p>
                  <Badge variant={isReadyToSave ? "secondary" : "outline"}>
                    {isReadyToSave ? t.ready : t.missingData}
                  </Badge>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  {formatNumber(progressPercent)}%
                </p>
              </div>

              <p className="rounded-xl border bg-muted/40 p-3 text-xs leading-6 text-muted-foreground">
                {t.afterCreateHint}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle>{t.stepsTitle}</CardTitle>
              <CardDescription>{t.stepsDesc}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {t.quickNotes.map((note) => (
                <div key={note} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {note}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="space-y-2 p-4">
              <Button
                type="button"
                className="h-11 w-full rounded-xl"
                disabled={isSubmitting}
                onClick={submitForm}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>{isSubmitting ? t.saving : t.create}</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-10 w-full rounded-xl"
                disabled={isSubmitting}
                onClick={saveDraft}
              >
                <FileText className="h-4 w-4" />
                <span>{t.saveDraft}</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-10 w-full rounded-xl"
                disabled={isSubmitting}
                onClick={restoreDraft}
              >
                <ClipboardList className="h-4 w-4" />
                <span>{t.restoreDraft}</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-10 w-full rounded-xl text-destructive hover:text-destructive"
                disabled={isSubmitting}
                onClick={clearForm}
              >
                <Trash2 className="h-4 w-4" />
                <span>{t.clearForm}</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}