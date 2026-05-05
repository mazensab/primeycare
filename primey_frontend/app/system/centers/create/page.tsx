"use client";

/* ============================================================
   📂 app/system/centers/create/page.tsx
   🧠 Primey Care | Create Center
   ------------------------------------------------------------
   ✅ المسار: /system/centers/create
   ✅ الإصدار: v1.1.0 - UX Refinement

   ✅ العمل:
      إنشاء مركز / مقدم خدمة جديد.

   ✅ API:
      POST /api/providers/

   ✅ متوافق مع:
      - /system/centers
      - /system/centers/list
      - /system/centers/[id]

   ✅ ملاحظات UX:
      - لا يتم إظهار المسارات التقنية أو أسماء API داخل الواجهة.
      - الصفحة تستخدم عرض المساحة بالكامل بدل التمركز الضيق.
      - النموذج قابل للاستخدام كقالب لباقي صفحات الإنشاء.
      - يتم تحذير المستخدم عند وجود بيانات غير محفوظة.
      - يتم تعطيل الحقول أثناء الحفظ.
      - يتم عرض خطأ الحفظ داخل الصفحة بجانب toast.

   ✅ الوظائف:
      - استخدام lib/api.ts مع CSRF
      - دعم عربي / إنجليزي عبر primey-locale
      - استخدام sonner للتنبيهات
      - تحقق آمن من الحقول والرابط والبريد
      - تنظيف الكود وأرقام التواصل
      - بدون localhost hardcoded
      - الحفاظ على تصميم Primey Care الرسمي
============================================================ */

import type { ComponentType, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CheckCircle2,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  Sparkles,
  Star,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { apiPost, API_PATHS } from "@/lib/api";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/* ============================================================
   Types
============================================================ */

type AppLocale = "ar" | "en";

type ProviderStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DRAFT";

type ProviderType =
  | "HOSPITAL"
  | "MEDICAL_CENTER"
  | "PHARMACY"
  | "PARTNER"
  | "LAB"
  | "CLINIC"
  | "OTHER";

type CenterFormData = {
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
  notes: string;
  is_featured: boolean;
};

type CenterFormErrors = Partial<Record<keyof CenterFormData, string>>;

type ProviderCreateData = {
  id?: number | string;
  name?: string;
  code?: string;
};

type ProviderCreateResponse = {
  ok?: boolean;
  message?: string;
  data?: ProviderCreateData;
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
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "إنشاء مركز جديد" : "Create New Center",
    subtitle: isArabic
      ? "إضافة مركز أو مقدم خدمة جديد وربطه لاحقًا بالعقود والخدمات والطلبات."
      : "Create a new center/provider and later connect it with contracts, services, and orders.",

    back: isArabic ? "العودة للمراكز" : "Back to Centers",
    saveDraft: isArabic ? "حفظ كمسودة" : "Save Draft",
    create: isArabic ? "إنشاء المركز" : "Create Center",
    saving: isArabic ? "جاري الحفظ..." : "Saving...",

    stepsTitle: isArabic ? "إرشادات قبل الحفظ" : "Before Saving",
    summaryTitle: isArabic ? "ملخص المركز" : "Center Summary",
    summaryDesc: isArabic
      ? "مراجعة سريعة للبيانات قبل الحفظ."
      : "Quick review before saving.",

    basicInfo: isArabic ? "البيانات الأساسية" : "Basic Information",
    basicDesc: isArabic
      ? "اسم المركز، الكود، النوع، وحالة التشغيل."
      : "Center name, code, type, and operational status.",

    contactInfo: isArabic ? "بيانات التواصل" : "Contact Information",
    contactDesc: isArabic
      ? "المسؤول، الهاتف، الجوال، البريد، والموقع الإلكتروني."
      : "Contact person, phone, mobile, email, and website.",

    locationInfo: isArabic ? "بيانات الموقع" : "Location Information",
    locationDesc: isArabic
      ? "المدينة، المنطقة، العنوان، ورابط خرائط جوجل."
      : "City, area, address, and Google Maps link.",

    operationalInfo: isArabic ? "بيانات تشغيلية" : "Operational Information",
    operationalDesc: isArabic
      ? "تمييز المركز والملاحظات التشغيلية."
      : "Featured status and operational notes.",

    labels: {
      name: isArabic ? "اسم المركز" : "Center Name",
      code: isArabic ? "كود المركز" : "Center Code",
      providerType: isArabic ? "نوع الجهة" : "Provider Type",
      status: isArabic ? "الحالة" : "Status",
      contactPerson: isArabic ? "الشخص المسؤول" : "Contact Person",
      phone: isArabic ? "رقم الهاتف" : "Phone",
      mobile: isArabic ? "رقم الجوال" : "Mobile",
      email: isArabic ? "البريد الإلكتروني" : "Email",
      website: isArabic ? "الموقع الإلكتروني" : "Website",
      city: isArabic ? "المدينة" : "City",
      area: isArabic ? "الحي / المنطقة" : "Area",
      address: isArabic ? "العنوان" : "Address",
      googleMaps: isArabic ? "رابط خرائط جوجل" : "Google Maps Link",
      notes: isArabic ? "ملاحظات" : "Notes",
      featured: isArabic ? "مركز مميز" : "Featured Center",
    },

    placeholders: {
      name: isArabic
        ? "مثال: مركز برايمي كير جدة"
        : "Example: Primey Care Jeddah",
      code: isArabic ? "مثال: CTR-001" : "Example: CTR-001",
      contactPerson: isArabic ? "مثال: محمد أحمد" : "Example: Mohammed Ahmed",
      phone: isArabic ? "011xxxxxxx" : "011xxxxxxx",
      mobile: isArabic ? "05xxxxxxxx" : "05xxxxxxxx",
      email: isArabic ? "center@example.com" : "center@example.com",
      website: isArabic ? "https://example.com" : "https://example.com",
      city: isArabic ? "مثال: جدة" : "Example: Jeddah",
      area: isArabic ? "مثال: الروضة" : "Example: Al Rawdah",
      address: isArabic ? "اكتب العنوان التفصيلي" : "Enter full address",
      googleMaps: isArabic
        ? "https://maps.google.com/..."
        : "https://maps.google.com/...",
      notes: isArabic
        ? "أي ملاحظات تشغيلية عن المركز..."
        : "Any operational notes about the center...",
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
      name: isArabic ? "اسم المركز مطلوب." : "Center name is required.",
      code: isArabic ? "كود المركز مطلوب." : "Center code is required.",
      email: isArabic ? "صيغة البريد غير صحيحة." : "Invalid email format.",
      website: isArabic
        ? "رابط الموقع يجب أن يبدأ بـ https:// أو http://"
        : "Website URL must start with https:// or http://",
      maps: isArabic
        ? "رابط الخرائط يجب أن يبدأ بـ https:// أو http://"
        : "Google Maps URL must start with https:// or http://",
    },

    success: isArabic
      ? "تم إنشاء المركز بنجاح."
      : "Center created successfully.",
    draftSuccess: isArabic
      ? "تم حفظ المركز كمسودة بنجاح."
      : "Center saved as draft successfully.",
    apiError: isArabic
      ? "تعذر إنشاء المركز. تحقق من البيانات وحاول مرة أخرى."
      : "Unable to create center. Please check the data and try again.",
    apiErrorTitle: isArabic ? "تعذر حفظ البيانات" : "Unable to save data",

    validationToast: isArabic
      ? "يرجى تصحيح الحقول المطلوبة قبل المتابعة."
      : "Please fix the required fields before continuing.",

    confirmLeave: isArabic
      ? "لديك بيانات غير محفوظة. هل تريد المغادرة؟"
      : "You have unsaved changes. Do you want to leave?",

    completion: isArabic ? "نسبة الاكتمال" : "Completion",
    ready: isArabic ? "جاهز للحفظ" : "Ready to save",
    missingData: isArabic ? "ينقصه بيانات أساسية" : "Missing required data",

    featuredHelp: isArabic
      ? "يستخدم لإبراز المركز في القوائم والصفحات التشغيلية."
      : "Used to highlight this center in operational lists and pages.",
    featuredSummary: isArabic ? "سيظهر كمركز مميز." : "Will appear as featured.",

    quickNotes: [
      isArabic
        ? "تأكد أن كود المركز واضح وفريد لتسهيل البحث والربط."
        : "Make sure the center code is clear and unique for easier search and linking.",
      isArabic
        ? "يمكن حفظ المركز كمسودة ثم استكمال بياناته لاحقًا."
        : "You can save the center as a draft and complete it later.",
      isArabic
        ? "أضف وسيلة تواصل صحيحة لتسهيل المتابعة التشغيلية."
        : "Add accurate contact details for smoother operational follow-up.",
      isArabic
        ? "سيتم استخدام بيانات المدينة والعنوان لاحقًا في التقارير والفرز."
        : "City and address details will be useful later for reports and filtering.",
    ],
  };
}

/* ============================================================
   Defaults / Validation
============================================================ */

const initialFormData: CenterFormData = {
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
  notes: "",
  is_featured: false,
};

function isValidEmail(value: string) {
  if (!value.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidOptionalUrl(value: string) {
  if (!value.trim()) return true;
  return value.startsWith("https://") || value.startsWith("http://");
}

function normalizeCenterCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9-_]/g, "");
}

function normalizePhoneValue(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function normalizePayload(formData: CenterFormData, status?: ProviderStatus) {
  return {
    name: formData.name.trim(),
    code: normalizeCenterCode(formData.code),
    provider_type: formData.provider_type,
    status: status || formData.status,
    contact_person: formData.contact_person.trim(),
    phone: normalizePhoneValue(formData.phone),
    mobile: normalizePhoneValue(formData.mobile),
    email: formData.email.trim().toLowerCase(),
    website: formData.website.trim(),
    city: formData.city.trim(),
    area: formData.area.trim(),
    address: formData.address.trim(),
    google_maps_link: formData.google_maps_link.trim(),
    notes: formData.notes.trim(),
    is_featured: formData.is_featured,
  };
}

function hasFormChanges(formData: CenterFormData) {
  return JSON.stringify(formData) !== JSON.stringify(initialFormData);
}

function resolveCreatedId(result: unknown) {
  const response = result as {
    data?: {
      id?: number | string;
      data?: {
        id?: number | string;
      };
    };
  };

  return response.data?.id ?? response.data?.data?.id;
}

/* ============================================================
   Page
============================================================ */

export default function SystemCreateCenterPage() {
  const router = useRouter();

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [formData, setFormData] = useState<CenterFormData>(initialFormData);
  const [errors, setErrors] = useState<CenterFormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMode, setSubmitMode] = useState<"CREATE" | "DRAFT" | null>(null);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const isDirty = useMemo(() => hasFormChanges(formData), [formData]);

  const completedFields = useMemo(() => {
    const keys: Array<keyof CenterFormData> = [
      "name",
      "code",
      "provider_type",
      "status",
      "contact_person",
      "phone",
      "mobile",
      "email",
      "city",
      "area",
      "address",
    ];

    return keys.filter((key) => {
      const value = formData[key];

      if (typeof value === "boolean") return value;
      return String(value || "").trim().length > 0;
    }).length;
  }, [formData]);

  const progressPercent = Math.round((completedFields / 11) * 100);
  const isReadyToSave = formData.name.trim().length > 0 && formData.code.trim().length > 0;

  function updateField<K extends keyof CenterFormData>(
    key: K,
    value: CenterFormData[K],
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

  function validateForm(nextStatus?: ProviderStatus) {
    const nextErrors: CenterFormErrors = {};
    const isDraft = nextStatus === "DRAFT";

    if (!formData.name.trim()) {
      nextErrors.name = t.validation.name;
    }

    if (!formData.code.trim()) {
      nextErrors.code = t.validation.code;
    }

    if (!isDraft && !isValidEmail(formData.email)) {
      nextErrors.email = t.validation.email;
    }

    if (!isValidOptionalUrl(formData.website)) {
      nextErrors.website = t.validation.website;
    }

    if (!isValidOptionalUrl(formData.google_maps_link)) {
      nextErrors.google_maps_link = t.validation.maps;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submitForm(mode: "CREATE" | "DRAFT") {
    const nextStatus: ProviderStatus = mode === "DRAFT" ? "DRAFT" : formData.status;

    setSubmitError("");

    if (!validateForm(nextStatus)) {
      toast.error(t.validationToast);
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitMode(mode);

      const result = await apiPost<ProviderCreateResponse>(
        API_PATHS.providers.list,
        normalizePayload(formData, nextStatus),
      );

      if (!result.ok) {
        const message = result.message || t.apiError;
        setSubmitError(message);
        toast.error(message);
        return;
      }

      const createdId = resolveCreatedId(result);

      toast.success(mode === "DRAFT" ? t.draftSuccess : t.success);

      if (createdId) {
        router.push(`/system/centers/${createdId}`);
        return;
      }

      router.push("/system/centers/list");
    } catch (error) {
      console.error("Create center error:", error);
      setSubmitError(t.apiError);
      toast.error(t.apiError);
    } finally {
      setIsSubmitting(false);
      setSubmitMode(null);
    }
  }

  function handleBack() {
    if (isDirty && !window.confirm(t.confirmLeave)) {
      return;
    }

    router.push("/system/centers");
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
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty, isSubmitting]);

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t.title}
          </h1>

          <p className="text-muted-foreground mt-1 max-w-4xl text-sm">
            {t.subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            variant="outline"
            className="h-10 w-full rounded-xl sm:w-auto"
            onClick={handleBack}
            disabled={isSubmitting}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t.back}</span>
          </Button>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => submitForm("DRAFT")}
            disabled={isSubmitting}
          >
            {isSubmitting && submitMode === "DRAFT" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>
              {isSubmitting && submitMode === "DRAFT" ? t.saving : t.saveDraft}
            </span>
          </Button>

          <Button
            className="h-10 rounded-xl"
            onClick={() => submitForm("CREATE")}
            disabled={isSubmitting}
          >
            {isSubmitting && submitMode === "CREATE" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <span>
              {isSubmitting && submitMode === "CREATE" ? t.saving : t.create}
            </span>
          </Button>
        </div>
      </div>

      {submitError ? (
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 shadow-sm">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <XCircle className="h-5 w-5" />
            </div>

            <div>
              <p className="font-semibold text-destructive">
                {t.apiErrorTitle}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {submitError}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid w-full gap-4 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* Form */}
        <div className="min-w-0 space-y-4">
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
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder={t.placeholders.name}
                  className="h-10 rounded-xl"
                  disabled={isSubmitting}
                />
              </FieldBlock>

              <FieldBlock label={t.labels.code} error={errors.code} required>
                <Input
                  value={formData.code}
                  onChange={(event) =>
                    updateField("code", normalizeCenterCode(event.target.value))
                  }
                  placeholder={t.placeholders.code}
                  className="h-10 rounded-xl"
                  dir="ltr"
                  disabled={isSubmitting}
                />
              </FieldBlock>

              <FieldBlock label={t.labels.providerType}>
                <select
                  value={formData.provider_type}
                  onChange={(event) =>
                    updateField(
                      "provider_type",
                      event.target.value as ProviderType,
                    )
                  }
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {Object.entries(t.providerTypes).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FieldBlock>

              <FieldBlock label={t.labels.status}>
                <select
                  value={formData.status}
                  onChange={(event) =>
                    updateField("status", event.target.value as ProviderStatus)
                  }
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSubmitting}
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
              <FieldBlock label={t.labels.contactPerson}>
                <Input
                  value={formData.contact_person}
                  onChange={(event) =>
                    updateField("contact_person", event.target.value)
                  }
                  placeholder={t.placeholders.contactPerson}
                  className="h-10 rounded-xl"
                  disabled={isSubmitting}
                />
              </FieldBlock>

              <FieldBlock label={t.labels.mobile}>
                <Input
                  value={formData.mobile}
                  onChange={(event) =>
                    updateField("mobile", normalizePhoneValue(event.target.value))
                  }
                  placeholder={t.placeholders.mobile}
                  className="h-10 rounded-xl"
                  dir="ltr"
                  disabled={isSubmitting}
                />
              </FieldBlock>

              <FieldBlock label={t.labels.phone}>
                <Input
                  value={formData.phone}
                  onChange={(event) =>
                    updateField("phone", normalizePhoneValue(event.target.value))
                  }
                  placeholder={t.placeholders.phone}
                  className="h-10 rounded-xl"
                  dir="ltr"
                  disabled={isSubmitting}
                />
              </FieldBlock>

              <FieldBlock label={t.labels.email} error={errors.email}>
                <Input
                  value={formData.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  onBlur={() =>
                    updateField("email", formData.email.trim().toLowerCase())
                  }
                  placeholder={t.placeholders.email}
                  className="h-10 rounded-xl"
                  dir="ltr"
                  disabled={isSubmitting}
                />
              </FieldBlock>

              <div className="md:col-span-2">
                <FieldBlock label={t.labels.website} error={errors.website}>
                  <Input
                    value={formData.website}
                    onChange={(event) =>
                      updateField("website", event.target.value.trim())
                    }
                    placeholder={t.placeholders.website}
                    className="h-10 rounded-xl"
                    dir="ltr"
                    disabled={isSubmitting}
                  />
                </FieldBlock>
              </div>
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
              <FieldBlock label={t.labels.city}>
                <Input
                  value={formData.city}
                  onChange={(event) => updateField("city", event.target.value)}
                  placeholder={t.placeholders.city}
                  className="h-10 rounded-xl"
                  disabled={isSubmitting}
                />
              </FieldBlock>

              <FieldBlock label={t.labels.area}>
                <Input
                  value={formData.area}
                  onChange={(event) => updateField("area", event.target.value)}
                  placeholder={t.placeholders.area}
                  className="h-10 rounded-xl"
                  disabled={isSubmitting}
                />
              </FieldBlock>

              <div className="md:col-span-2">
                <FieldBlock label={t.labels.address}>
                  <Textarea
                    value={formData.address}
                    onChange={(event) =>
                      updateField("address", event.target.value)
                    }
                    placeholder={t.placeholders.address}
                    className="min-h-24 rounded-xl"
                    disabled={isSubmitting}
                  />
                </FieldBlock>
              </div>

              <div className="md:col-span-2">
                <FieldBlock
                  label={t.labels.googleMaps}
                  error={errors.google_maps_link}
                >
                  <Input
                    value={formData.google_maps_link}
                    onChange={(event) =>
                      updateField("google_maps_link", event.target.value.trim())
                    }
                    placeholder={t.placeholders.googleMaps}
                    className="h-10 rounded-xl"
                    dir="ltr"
                    disabled={isSubmitting}
                  />
                </FieldBlock>
              </div>
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
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border bg-background p-4">
                <Checkbox
                  checked={formData.is_featured}
                  onCheckedChange={(checked) =>
                    updateField("is_featured", Boolean(checked))
                  }
                  disabled={isSubmitting}
                />

                <div>
                  <p className="text-sm font-semibold">{t.labels.featured}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t.featuredHelp}
                  </p>
                </div>
              </label>

              <FieldBlock label={t.labels.notes}>
                <Textarea
                  value={formData.notes}
                  onChange={(event) => updateField("notes", event.target.value)}
                  placeholder={t.placeholders.notes}
                  className="min-h-28 rounded-xl"
                  disabled={isSubmitting}
                />
              </FieldBlock>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Summary */}
        <aside className="min-w-0 space-y-4">
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
                    <p className="text-muted-foreground text-xs">
                      {t.completion}
                    </p>
                    <p className="mt-1 text-2xl font-bold">{progressPercent}%</p>
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

                <div className="mt-3 flex items-center gap-2">
                  <CheckCircle2
                    className={`h-4 w-4 ${
                      isReadyToSave
                        ? "text-emerald-600"
                        : "text-muted-foreground"
                    }`}
                  />
                  <p className="text-muted-foreground text-xs">
                    {isReadyToSave ? t.ready : t.missingData}
                  </p>
                </div>
              </div>

              <SummaryItem
                icon={Building2}
                label={t.labels.name}
                value={formData.name || "-"}
              />

              <SummaryItem
                icon={ShieldCheck}
                label={t.labels.code}
                value={formData.code || "-"}
              />

              <SummaryItem
                icon={FileText}
                label={t.labels.providerType}
                value={t.providerTypes[formData.provider_type]}
              />

              <SummaryItem
                icon={CheckCircle2}
                label={t.labels.status}
                value={t.statuses[formData.status]}
              />

              <SummaryItem
                icon={MapPin}
                label={t.labels.city}
                value={formData.city || "-"}
              />

              <SummaryItem
                icon={Phone}
                label={t.labels.mobile}
                value={formData.mobile || formData.phone || "-"}
              />

              <SummaryItem
                icon={Mail}
                label={t.labels.email}
                value={formData.email || "-"}
              />

              {formData.is_featured ? (
                <div className="flex items-start gap-3 rounded-xl border bg-background p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Star className="h-4 w-4 fill-orange-400 text-orange-400" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold">{t.labels.featured}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {t.featuredSummary}
                    </p>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                {t.stepsTitle}
              </CardTitle>
              <CardDescription>
                {isArabic
                  ? "نقاط تساعدك على إدخال بيانات دقيقة."
                  : "Helpful points for entering accurate data."}
              </CardDescription>
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

                  <p className="text-muted-foreground text-sm leading-6">
                    {item}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="grid gap-2 p-4">
              <Button
                className="h-10 rounded-xl"
                onClick={() => submitForm("CREATE")}
                disabled={isSubmitting}
              >
                {isSubmitting && submitMode === "CREATE" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {isSubmitting && submitMode === "CREATE" ? t.saving : t.create}
              </Button>

              <Button
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => submitForm("DRAFT")}
                disabled={isSubmitting}
              >
                {isSubmitting && submitMode === "DRAFT" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isSubmitting && submitMode === "DRAFT"
                  ? t.saving
                  : t.saveDraft}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

/* ============================================================
   Small Components
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
        {required ? <span className="text-destructive ms-1">*</span> : null}
      </Label>

      {children}

      {error ? <p className="text-destructive text-xs">{error}</p> : null}
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
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-background p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}