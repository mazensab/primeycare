"use client";

/* ============================================================
   📂 app/system/providers/create/page.tsx
   🧠 Primey Care | Create Provider
   ------------------------------------------------------------
   ✅ المرحلة 17 + المرحلة 2
   ✅ مبني بنفس نمط إنشاء المراكز/العملاء المعتمد
   ✅ Full Width Layout
   ✅ Main Form + Sidebar Summary
   ✅ حماية زر الإنشاء وطلبات الحفظ حسب الصلاحيات
   ✅ fallback آمن لـ system_admin / superadmin
   ✅ Error Alert داخلي
   ✅ Field-level validation
   ✅ beforeunload protection
   ✅ حفظ واستعادة مسودة محلية
   ✅ تعطيل الحقول أثناء الحفظ
   ✅ تنظيف البيانات قبل الإرسال
   ✅ استخدام toast من sonner
   ✅ دعم عربي / إنجليزي عبر primey-locale
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
  BadgeCheck,
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
  RefreshCcw,
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
  code: string;
  provider_type: ProviderType;
  status: ProviderStatus;

  contact_person: string;
  phone: string;
  mobile: string;
  email: string;
  website: string;

  city: string;
  area: string;
  address: string;
  google_maps_link: string;

  license_number: string;
  tax_number: string;
  commercial_registration: string;

  notes: string;
  is_featured: boolean;
};

type ProviderFormErrors = Partial<Record<keyof ProviderFormData, string>>;

type CreateProviderApiResponse = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[] | string>;
  id?: number | string;
  provider?: {
    id?: number | string;
  };
  center?: {
    id?: number | string;
  };
  data?: {
    id?: number | string;
    provider?: {
      id?: number | string;
    };
    center?: {
      id?: number | string;
    };
  };
};

const DRAFT_STORAGE_KEY = "primey-care-provider-create-draft";

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
  code: "",
  provider_type: "MEDICAL_CENTER",
  status: "ACTIVE",

  contact_person: "",
  phone: "",
  mobile: "",
  email: "",
  website: "",

  city: "",
  area: "",
  address: "",
  google_maps_link: "",

  license_number: "",
  tax_number: "",
  commercial_registration: "",

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
      ? "إضافة مقدم خدمة أو مركز جديد وربطه لاحقًا بالعقود والخدمات والطلبات."
      : "Create a new provider or center and later connect it with contracts, services, and orders.",

    back: isArabic ? "العودة لمقدمي الخدمة" : "Back to Providers",
    providersList: isArabic ? "قائمة مقدمي الخدمة" : "Providers List",
    create: isArabic ? "إنشاء مقدم الخدمة" : "Create Provider",
    saving: isArabic ? "جاري الحفظ..." : "Saving...",
    saveDraft: isArabic ? "حفظ كمسودة محلية" : "Save Local Draft",
    restoreDraft: isArabic ? "استعادة المسودة" : "Restore Draft",
    clearForm: isArabic ? "تفريغ النموذج" : "Clear Form",

    basicInfo: isArabic ? "البيانات الأساسية" : "Basic Information",
    basicDesc: isArabic
      ? "اسم مقدم الخدمة، الكود، التصنيف، وحالة التشغيل."
      : "Provider name, code, type, and operational status.",

    contactInfo: isArabic ? "بيانات التواصل" : "Contact Information",
    contactDesc: isArabic
      ? "مسؤول التواصل، الهاتف، الجوال، البريد، والموقع الإلكتروني."
      : "Contact person, phone, mobile, email, and website.",

    locationInfo: isArabic ? "بيانات الموقع" : "Location Information",
    locationDesc: isArabic
      ? "المدينة، الحي أو المنطقة، العنوان، ورابط الخريطة."
      : "City, area, address, and map link.",

    legalInfo: isArabic ? "البيانات النظامية" : "Legal Information",
    legalDesc: isArabic
      ? "رقم الترخيص، الرقم الضريبي، والسجل التجاري إن وجدت."
      : "License number, tax number, and commercial registration when available.",

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
      name: isArabic ? "اسم مقدم الخدمة" : "Provider Name",
      code: isArabic ? "كود مقدم الخدمة" : "Provider Code",
      providerType: isArabic ? "التصنيف" : "Provider Type",
      status: isArabic ? "الحالة" : "Status",
      contactPerson: isArabic ? "مسؤول التواصل" : "Contact Person",
      phone: isArabic ? "رقم الهاتف" : "Phone",
      mobile: isArabic ? "رقم الجوال" : "Mobile",
      email: isArabic ? "البريد الإلكتروني" : "Email",
      website: isArabic ? "الموقع الإلكتروني" : "Website",
      city: isArabic ? "المدينة" : "City",
      area: isArabic ? "الحي / المنطقة" : "Area",
      address: isArabic ? "العنوان" : "Address",
      googleMaps: isArabic ? "رابط الخريطة" : "Map Link",
      licenseNumber: isArabic ? "رقم الترخيص" : "License Number",
      taxNumber: isArabic ? "الرقم الضريبي" : "Tax Number",
      commercialRegistration: isArabic
        ? "السجل التجاري"
        : "Commercial Registration",
      notes: isArabic ? "ملاحظات" : "Notes",
      featured: isArabic ? "مقدم خدمة مميز" : "Featured Provider",
    },

    placeholders: {
      name: isArabic
        ? "مثال: مركز برايمي كير جدة"
        : "Example: Primey Care Jeddah Center",
      code: isArabic ? "مثال: PRV-001" : "Example: PRV-001",
      contactPerson: isArabic ? "مثال: محمد أحمد" : "Example: Mohammed Ahmed",
      phone: isArabic ? "011xxxxxxx" : "011xxxxxxx",
      mobile: isArabic ? "05xxxxxxxx" : "05xxxxxxxx",
      email: isArabic ? "provider@example.com" : "provider@example.com",
      website: isArabic ? "https://example.com" : "https://example.com",
      city: isArabic ? "مثال: جدة" : "Example: Jeddah",
      area: isArabic ? "مثال: الروضة" : "Example: Al Rawdah",
      address: isArabic ? "اكتب العنوان التفصيلي" : "Enter full address",
      googleMaps: isArabic
        ? "https://maps.google.com/..."
        : "https://maps.google.com/...",
      licenseNumber: isArabic ? "رقم الترخيص" : "License number",
      taxNumber: isArabic ? "الرقم الضريبي" : "Tax number",
      commercialRegistration: isArabic ? "رقم السجل التجاري" : "CR number",
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
      name: isArabic ? "اسم مقدم الخدمة مطلوب." : "Provider name is required.",
      codeLength: isArabic
        ? "الكود يجب ألا يتجاوز 50 حرفًا."
        : "Code must not exceed 50 characters.",
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

    quickNotes: [
      isArabic
        ? "اسم مقدم الخدمة هو الحقل الأساسي المطلوب للحفظ."
        : "Provider name is the main required field for saving.",
      isArabic
        ? "يمكن ترك الكود فارغًا إذا كان الباك إند يولده تلقائيًا."
        : "You can leave the code empty if the backend generates it automatically.",
      isArabic
        ? "أضف بيانات التواصل والموقع لتسهيل العمليات والربط لاحقًا."
        : "Add contact and location data to simplify operations and future linking.",
      isArabic
        ? "لا يتم إنشاء عقود أو خدمات من هذه الصفحة؛ الربط يتم لاحقًا من الوحدات المختصة."
        : "Contracts and services are not created here; they are linked later from their modules.",
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

function normalizeUrl(value: string) {
  const clean = value.trim();

  if (!clean) return "";

  return clean;
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

function normalizePayload(formData: ProviderFormData) {
  const code = normalizeCode(formData.code);

  return {
    name: formData.name.trim(),
    code: code || undefined,
    provider_type: formData.provider_type,
    type: formData.provider_type,
    status: formData.status,

    contact_person: formData.contact_person.trim(),
    phone: normalizePhone(formData.phone),
    mobile: normalizePhone(formData.mobile),
    email: formData.email.trim().toLowerCase(),
    website: normalizeUrl(formData.website),

    city: formData.city.trim(),
    area: formData.area.trim(),
    address: formData.address.trim(),
    google_maps_link: normalizeUrl(formData.google_maps_link),

    license_number: formData.license_number.trim(),
    tax_number: formData.tax_number.trim(),
    commercial_registration: formData.commercial_registration.trim(),

    notes: formData.notes.trim(),
    is_featured: formData.is_featured,
  };
}

function resolveCreatedId(result: CreateProviderApiResponse) {
  return (
    result.provider?.id ||
    result.center?.id ||
    result.data?.provider?.id ||
    result.data?.center?.id ||
    result.data?.id ||
    result.id ||
    null
  );
}

function mapApiFieldErrors(
  errors: CreateProviderApiResponse["errors"],
): ProviderFormErrors {
  const nextErrors: ProviderFormErrors = {};

  if (!errors) return nextErrors;

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

function providerTypeIcon(type: ProviderType): ComponentType<{ className?: string }> {
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
    ["providers.create", "centers.create"],
    "action",
  );

  const canViewProviders = hasSafePermission(
    auth,
    ["providers.view", "providers.list", "centers.view", "centers.list"],
    "view",
  );

  const isDirty = useMemo(() => hasFormChanges(formData), [formData]);

  const ProviderIcon = providerTypeIcon(formData.provider_type);

  const completedFields = useMemo(() => {
    const keys: Array<keyof ProviderFormData> = [
      "name",
      "provider_type",
      "status",
      "phone",
      "mobile",
      "email",
      "city",
      "area",
      "address",
      "contact_person",
    ];

    return keys.filter((key) => String(formData[key] || "").trim().length > 0)
      .length;
  }, [formData]);

  const progressPercent = Math.round((completedFields / 10) * 100);
  const isReadyToSave = formData.name.trim().length > 0;

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

    if (!formData.name.trim()) {
      nextErrors.name = t.validation.name;
    }

    if (formData.code.trim().length > 50) {
      nextErrors.code = t.validation.codeLength;
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

      const parsed = JSON.parse(rawDraft) as ProviderFormData;

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

      {/* Error */}
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
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Building2 className="h-4 w-4" />
                {t.basicInfo}
              </CardTitle>
              <CardDescription>{t.basicDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <FieldBlock label={t.labels.name} error={errors.name} required>
                <Input
                  value={formData.name}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.name}
                  className="h-10 rounded-xl"
                  onChange={(event) => updateField("name", event.target.value)}
                />
              </FieldBlock>

              <FieldBlock label={t.labels.code} error={errors.code}>
                <Input
                  value={formData.code}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.code}
                  className="h-10 rounded-xl"
                  dir="ltr"
                  onChange={(event) => updateField("code", event.target.value)}
                  onBlur={() => updateField("code", normalizeCode(formData.code))}
                />
              </FieldBlock>

              <FieldBlock
                label={t.labels.providerType}
                error={errors.provider_type}
              >
                <select
                  value={formData.provider_type}
                  disabled={isSubmitting}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  onChange={(event) =>
                    updateField(
                      "provider_type",
                      event.target.value as ProviderType,
                    )
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
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Phone className="h-4 w-4" />
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
                  className="h-10 rounded-xl"
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
                  className="h-10 rounded-xl"
                  dir="ltr"
                  onChange={(event) => updateField("phone", event.target.value)}
                  onBlur={() => updateField("phone", normalizePhone(formData.phone))}
                />
              </FieldBlock>

              <FieldBlock label={t.labels.mobile} error={errors.mobile}>
                <Input
                  value={formData.mobile}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.mobile}
                  className="h-10 rounded-xl"
                  dir="ltr"
                  onChange={(event) => updateField("mobile", event.target.value)}
                  onBlur={() =>
                    updateField("mobile", normalizePhone(formData.mobile))
                  }
                />
              </FieldBlock>

              <FieldBlock label={t.labels.email} error={errors.email}>
                <Input
                  value={formData.email}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.email}
                  className="h-10 rounded-xl"
                  dir="ltr"
                  onChange={(event) => updateField("email", event.target.value)}
                  onBlur={() =>
                    updateField("email", formData.email.trim().toLowerCase())
                  }
                />
              </FieldBlock>

              <FieldBlock label={t.labels.website} error={errors.website}>
                <Input
                  value={formData.website}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.website}
                  className="h-10 rounded-xl"
                  dir="ltr"
                  onChange={(event) => updateField("website", event.target.value)}
                />
              </FieldBlock>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <MapPin className="h-4 w-4" />
                {t.locationInfo}
              </CardTitle>
              <CardDescription>{t.locationDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <FieldBlock label={t.labels.city} error={errors.city}>
                <Input
                  value={formData.city}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.city}
                  className="h-10 rounded-xl"
                  onChange={(event) => updateField("city", event.target.value)}
                />
              </FieldBlock>

              <FieldBlock label={t.labels.area} error={errors.area}>
                <Input
                  value={formData.area}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.area}
                  className="h-10 rounded-xl"
                  onChange={(event) => updateField("area", event.target.value)}
                />
              </FieldBlock>

              <FieldBlock label={t.labels.address} error={errors.address}>
                <Textarea
                  value={formData.address}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.address}
                  className="min-h-24 rounded-xl"
                  onChange={(event) => updateField("address", event.target.value)}
                />
              </FieldBlock>

              <FieldBlock
                label={t.labels.googleMaps}
                error={errors.google_maps_link}
              >
                <Textarea
                  value={formData.google_maps_link}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.googleMaps}
                  className="min-h-24 rounded-xl"
                  dir="ltr"
                  onChange={(event) =>
                    updateField("google_maps_link", event.target.value)
                  }
                />
              </FieldBlock>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <ShieldCheck className="h-4 w-4" />
                {t.legalInfo}
              </CardTitle>
              <CardDescription>{t.legalDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-3">
              <FieldBlock
                label={t.labels.licenseNumber}
                error={errors.license_number}
              >
                <Input
                  value={formData.license_number}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.licenseNumber}
                  className="h-10 rounded-xl"
                  onChange={(event) =>
                    updateField("license_number", event.target.value)
                  }
                />
              </FieldBlock>

              <FieldBlock label={t.labels.taxNumber} error={errors.tax_number}>
                <Input
                  value={formData.tax_number}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.taxNumber}
                  className="h-10 rounded-xl"
                  onChange={(event) =>
                    updateField("tax_number", event.target.value)
                  }
                />
              </FieldBlock>

              <FieldBlock
                label={t.labels.commercialRegistration}
                error={errors.commercial_registration}
              >
                <Input
                  value={formData.commercial_registration}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.commercialRegistration}
                  className="h-10 rounded-xl"
                  onChange={(event) =>
                    updateField("commercial_registration", event.target.value)
                  }
                />
              </FieldBlock>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Sparkles className="h-4 w-4" />
                {t.operationalInfo}
              </CardTitle>
              <CardDescription>{t.operationalDesc}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <ToggleBox
                checked={formData.is_featured}
                disabled={isSubmitting}
                title={t.labels.featured}
                description={t.labels.featured}
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
                icon={ProviderIcon}
                label={t.labels.name}
                value={formData.name || "-"}
              />

              <SummaryItem
                icon={FileText}
                label={t.labels.code}
                value={formData.code || "-"}
              />

              <SummaryItem
                icon={Layers3}
                label={t.labels.providerType}
                value={t.providerTypes[formData.provider_type]}
              />

              <SummaryItem
                icon={ShieldCheck}
                label={t.labels.status}
                value={t.statuses[formData.status]}
              />

              <SummaryItem
                icon={Phone}
                label={t.labels.phone}
                value={formData.phone || formData.mobile || "-"}
              />

              <SummaryItem
                icon={Mail}
                label={t.labels.email}
                value={formData.email || "-"}
              />

              <SummaryItem
                icon={MapPin}
                label={t.labels.city}
                value={formData.city || "-"}
              />

              <SummaryItem
                icon={Globe2}
                label={t.labels.website}
                value={formData.website || "-"}
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