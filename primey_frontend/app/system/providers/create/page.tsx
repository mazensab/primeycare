"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ElementType, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CheckCircle2,
  FileText,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
   📂 app/system/providers/create/page.tsx
   🧠 Primey Care | Create Provider
   ------------------------------------------------------------
   ✅ نفس نمط صفحة إنشاء المراكز المرفقة
   ✅ استخدام UI الداخلي فقط
   ✅ ربط حقيقي مع POST /api/providers/
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ استخدام sonner
   ✅ بدون hardcoded localhost
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
  notes: string;
  is_featured: boolean;
};

type ProviderFormErrors = Partial<Record<keyof ProviderFormData, string>>;

type ProviderCreateResponse = {
  ok?: boolean;
  message?: string;
  data?: {
    id?: number | string;
    name?: string;
    code?: string;
  };
  errors?: unknown;
};

/* ============================================================
   🌐 Locale Helpers
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

function getCookie(name: string) {
  if (typeof document === "undefined") return "";

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);

  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() || "";
  }

  return "";
}

/* ============================================================
   📚 Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "إنشاء مقدم خدمة جديد" : "Create New Provider",
    subtitle: isArabic
      ? "إضافة مقدم خدمة جديد داخل Primey Care وربطه لاحقًا بالعقود والخدمات والطلبات."
      : "Create a new provider in Primey Care and connect it later with contracts, services, and orders.",

    back: isArabic ? "العودة لمقدمي الخدمة" : "Back to Providers",
    saveDraft: isArabic ? "حفظ كمسودة" : "Save Draft",
    create: isArabic ? "إنشاء مقدم الخدمة" : "Create Provider",

    liveApi: isArabic ? "ربط حقيقي" : "Live API",
    route: "/api/providers/",

    stepsTitle: isArabic ? "خطوات الإنشاء" : "Creation Steps",
    summaryTitle: isArabic ? "ملخص مقدم الخدمة" : "Provider Summary",
    summaryDesc: isArabic
      ? "مراجعة سريعة للبيانات قبل الحفظ."
      : "Quick review before saving.",

    basicInfo: isArabic ? "البيانات الأساسية" : "Basic Information",
    basicDesc: isArabic
      ? "اسم مقدم الخدمة، الكود، النوع، وحالة التشغيل."
      : "Provider name, code, type, and operational status.",

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
      ? "تمييز مقدم الخدمة والملاحظات التشغيلية."
      : "Featured status and operational notes.",

    labels: {
      name: isArabic ? "اسم مقدم الخدمة" : "Provider Name",
      code: isArabic ? "كود مقدم الخدمة" : "Provider Code",
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
      featured: isArabic ? "مقدم خدمة مميز" : "Featured Provider",
    },

    placeholders: {
      name: isArabic
        ? "مثال: مستشفى برايمي كير جدة"
        : "Example: Primey Care Hospital Jeddah",
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
      required: isArabic ? "هذا الحقل مطلوب" : "This field is required",
      invalidEmail: isArabic ? "صيغة البريد غير صحيحة" : "Invalid email format",
      invalidUrl: isArabic ? "الرابط غير صحيح" : "Invalid URL",
      invalidPhone: isArabic ? "رقم الهاتف غير صحيح" : "Invalid phone number",
    },

    successTitle: isArabic
      ? "تم إنشاء مقدم الخدمة بنجاح"
      : "Provider created successfully",
    successDesc: isArabic
      ? "تم حفظ مقدم الخدمة داخل النظام ويمكنك الآن ربطه بالعقود والخدمات."
      : "Provider has been saved and can now be linked with contracts and services.",
    draftTitle: isArabic ? "تم حفظ المسودة" : "Draft saved",
    draftDesc: isArabic
      ? "تم إنشاء مقدم الخدمة كمسودة داخل النظام."
      : "Provider has been created as a draft.",
    errorTitle: isArabic
      ? "تعذر إنشاء مقدم الخدمة"
      : "Unable to create provider",

    requiredFields: isArabic ? "الحقول المطلوبة" : "Required Fields",
    optionalFields: isArabic ? "حقول اختيارية" : "Optional Fields",

    quickGuideTitle: isArabic ? "إرشادات سريعة" : "Quick Guide",
    quickGuideDesc: isArabic
      ? "تأكد من إدخال بيانات مقدم الخدمة الأساسية بشكل صحيح قبل الحفظ."
      : "Make sure the provider core data is correct before saving.",

    guide: [
      isArabic
        ? "كود مقدم الخدمة يساعد في ربط العقود والخدمات لاحقًا."
        : "Provider code helps later when linking contracts and services.",
      isArabic
        ? "يفضل إدخال الجوال والبريد لتسهيل إرسال التنبيهات."
        : "Mobile and email are recommended for future notifications.",
      isArabic
        ? "يمكن إنشاء مقدم الخدمة كمسودة ثم تفعيله لاحقًا."
        : "You can create the provider as draft and activate it later.",
    ],

    completion: isArabic ? "اكتمال البيانات" : "Completion",
    completedFields: isArabic ? "حقول مكتملة" : "completed fields",
    backendRoute: isArabic ? "المسار الخلفي" : "Backend Route",
    workspace: isArabic ? "مساحة العمل" : "Workspace",
    statusReady: isArabic ? "جاهز للحفظ" : "Ready to Save",
  };
}

/* ============================================================
   ✅ Validators
============================================================ */

function isValidEmail(value: string) {
  if (!value.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidUrl(value: string) {
  if (!value.trim()) return true;

  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isValidPhone(value: string) {
  if (!value.trim()) return true;
  const cleaned = value.replace(/[^\d+]/g, "");
  return cleaned.length >= 7;
}

/* ============================================================
   🧩 Page
============================================================ */

export default function SystemProvidersCreatePage() {
  const router = useRouter();

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ProviderFormData>({
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
  });

  const [errors, setErrors] = useState<ProviderFormErrors>({});

  const isArabic = locale === "ar";
  const t = useMemo(() => dictionary(locale), [locale]);

  useEffect(() => {
    const syncLocale = () => {
      const nextLocale = readLocale();
      setLocale(nextLocale);
      applyDocumentLocale(nextLocale);
    };

    syncLocale();

    const handleLocaleChange = () => syncLocale();
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "primey-locale") syncLocale();
    };

    window.addEventListener("primey-locale-changed", handleLocaleChange);
    window.addEventListener("storage", handleStorageChange);

    const timer = window.setTimeout(syncLocale, 50);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("primey-locale-changed", handleLocaleChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const completion = useMemo(() => {
    const keys: Array<keyof ProviderFormData> = [
      "name",
      "code",
      "contact_person",
      "phone",
      "mobile",
      "email",
      "city",
      "area",
      "address",
      "website",
      "google_maps_link",
      "notes",
    ];

    const filled = keys.filter((key) => {
      const value = formData[key];
      return typeof value === "string" && value.trim().length > 0;
    }).length;

    const total = keys.length;
    const percent = Math.round((filled / total) * 100);

    return { filled, total, percent };
  }, [formData]);

  function setField<K extends keyof ProviderFormData>(
    key: K,
    value: ProviderFormData[K]
  ) {
    setFormData((prev) => ({ ...prev, [key]: value }));

    setErrors((prev) => {
      if (!prev[key]) return prev;

      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validate(statusOverride?: ProviderStatus) {
    const nextErrors: ProviderFormErrors = {};

    if (!formData.name.trim()) {
      nextErrors.name = t.validation.required;
    }

    if (!formData.code.trim()) {
      nextErrors.code = t.validation.required;
    }

    if (!formData.contact_person.trim()) {
      nextErrors.contact_person = t.validation.required;
    }

    if (!formData.city.trim()) {
      nextErrors.city = t.validation.required;
    }

    if (!formData.address.trim()) {
      nextErrors.address = t.validation.required;
    }

    if (!formData.phone.trim() && !formData.mobile.trim()) {
      nextErrors.phone = t.validation.required;
      nextErrors.mobile = t.validation.required;
    }

    if (formData.phone.trim() && !isValidPhone(formData.phone)) {
      nextErrors.phone = t.validation.invalidPhone;
    }

    if (formData.mobile.trim() && !isValidPhone(formData.mobile)) {
      nextErrors.mobile = t.validation.invalidPhone;
    }

    if (formData.email.trim() && !isValidEmail(formData.email)) {
      nextErrors.email = t.validation.invalidEmail;
    }

    if (formData.website.trim() && !isValidUrl(formData.website)) {
      nextErrors.website = t.validation.invalidUrl;
    }

    if (
      formData.google_maps_link.trim() &&
      !isValidUrl(formData.google_maps_link)
    ) {
      nextErrors.google_maps_link = t.validation.invalidUrl;
    }

    if (statusOverride !== "DRAFT") {
      if (!formData.provider_type) {
        nextErrors.provider_type = t.validation.required;
      }

      if (!formData.status) {
        nextErrors.status = t.validation.required;
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function buildPayload(statusOverride?: ProviderStatus) {
    return {
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      provider_type: formData.provider_type,
      status: statusOverride || formData.status,
      contact_person: formData.contact_person.trim(),
      phone: formData.phone.trim(),
      mobile: formData.mobile.trim() || formData.phone.trim(),
      email: formData.email.trim(),
      website: formData.website.trim(),
      city: formData.city.trim(),
      area: formData.area.trim(),
      address: formData.address.trim(),
      google_maps_link: formData.google_maps_link.trim(),
      notes: formData.notes.trim(),
      is_featured: formData.is_featured,
    };
  }

  async function submitProvider(statusOverride?: ProviderStatus) {
    if (!validate(statusOverride)) {
      toast.error(
        isArabic
          ? "يرجى تصحيح الحقول المطلوبة أولًا."
          : "Please fix the required fields first."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/providers/", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
        body: JSON.stringify(buildPayload(statusOverride)),
      });

      const payload = (await response.json().catch(() => null)) as
        | ProviderCreateResponse
        | null;

      if (!response.ok || payload?.ok === false) {
        console.error("Create provider API error:", payload);
        throw new Error(
          payload?.message ||
            (isArabic
              ? "حدث خطأ أثناء حفظ مقدم الخدمة."
              : "An error occurred while saving provider.")
        );
      }

      toast.success(statusOverride === "DRAFT" ? t.draftTitle : t.successTitle, {
        description: statusOverride === "DRAFT" ? t.draftDesc : t.successDesc,
      });

      router.push("/system/providers/list");
      router.refresh();
    } catch (error) {
      console.error("Create provider error:", error);
      toast.error(t.errorTitle, {
        description:
          error instanceof Error
            ? error.message
            : isArabic
              ? "حدث خطأ غير متوقع."
              : "Unexpected error occurred.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const summaryItems = [
    {
      label: t.backendRoute,
      value: t.route,
      icon: ShieldCheck,
    },
    {
      label: t.workspace,
      value: "System",
      icon: Sparkles,
    },
    {
      label: t.statusReady,
      value: t.statuses[formData.status],
      icon: BadgeCheck,
    },
  ];

  return (
    <div className="space-y-6">
      {/* =====================================================
          Header
      ====================================================== */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="order-2 flex flex-wrap items-center gap-2 lg:order-1">
          <Link href="/system/providers">
            <Button variant="outline" className="rounded-xl">
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            className="rounded-xl"
            disabled={isSubmitting}
            onClick={() => submitProvider("DRAFT")}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>{t.saveDraft}</span>
          </Button>

          <Button
            className="rounded-xl"
            disabled={isSubmitting}
            onClick={() => submitProvider()}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <span>{t.create}</span>
          </Button>
        </div>

        <div className="order-1 max-w-3xl space-y-2 text-right lg:order-2">
          <div className="flex justify-end gap-2">
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {t.liveApi}
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              {t.route}
            </Badge>
          </div>

          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {t.title}
          </h1>
          <p className="text-sm leading-7 text-muted-foreground md:text-base">
            {t.subtitle}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.42fr]">
        {/* =====================================================
            Form
        ====================================================== */}
        <div className="space-y-6">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="text-right">
              <CardTitle className="flex items-center justify-end gap-2">
                {t.basicInfo}
                <Building2 className="h-5 w-5 text-primary" />
              </CardTitle>
              <CardDescription>{t.basicDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field
                id="name"
                label={t.labels.name}
                value={formData.name}
                error={errors.name}
                placeholder={t.placeholders.name}
                icon={Building2}
                isArabic={isArabic}
                onChange={(value) => setField("name", value)}
              />

              <Field
                id="code"
                label={t.labels.code}
                value={formData.code}
                error={errors.code}
                placeholder={t.placeholders.code}
                icon={FileText}
                isArabic={isArabic}
                onChange={(value) => setField("code", value.toUpperCase())}
              />

              <OptionGroup
                label={t.labels.providerType}
                options={[
                  "HOSPITAL",
                  "MEDICAL_CENTER",
                  "CLINIC",
                  "PHARMACY",
                  "LAB",
                  "PARTNER",
                  "OTHER",
                ]}
                value={formData.provider_type}
                labels={t.providerTypes}
                onChange={(value) => setField("provider_type", value)}
              />

              <OptionGroup
                label={t.labels.status}
                options={["ACTIVE", "DRAFT", "INACTIVE", "SUSPENDED"]}
                value={formData.status}
                labels={t.statuses}
                onChange={(value) => setField("status", value)}
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="text-right">
              <CardTitle className="flex items-center justify-end gap-2">
                {t.contactInfo}
                <Phone className="h-5 w-5 text-primary" />
              </CardTitle>
              <CardDescription>{t.contactDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field
                id="contact_person"
                label={t.labels.contactPerson}
                value={formData.contact_person}
                error={errors.contact_person}
                placeholder={t.placeholders.contactPerson}
                icon={UserRound}
                isArabic={isArabic}
                onChange={(value) => setField("contact_person", value)}
              />

              <Field
                id="phone"
                label={t.labels.phone}
                value={formData.phone}
                error={errors.phone}
                placeholder={t.placeholders.phone}
                icon={Phone}
                isArabic={isArabic}
                onChange={(value) => setField("phone", value)}
              />

              <Field
                id="mobile"
                label={t.labels.mobile}
                value={formData.mobile}
                error={errors.mobile}
                placeholder={t.placeholders.mobile}
                icon={Phone}
                isArabic={isArabic}
                onChange={(value) => setField("mobile", value)}
              />

              <Field
                id="email"
                type="email"
                label={t.labels.email}
                value={formData.email}
                error={errors.email}
                placeholder={t.placeholders.email}
                icon={Mail}
                isArabic={isArabic}
                onChange={(value) => setField("email", value)}
              />

              <div className="md:col-span-2">
                <Field
                  id="website"
                  label={t.labels.website}
                  value={formData.website}
                  error={errors.website}
                  placeholder={t.placeholders.website}
                  icon={Globe}
                  isArabic={isArabic}
                  onChange={(value) => setField("website", value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="text-right">
              <CardTitle className="flex items-center justify-end gap-2">
                {t.locationInfo}
                <MapPin className="h-5 w-5 text-primary" />
              </CardTitle>
              <CardDescription>{t.locationDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field
                id="city"
                label={t.labels.city}
                value={formData.city}
                error={errors.city}
                placeholder={t.placeholders.city}
                icon={MapPin}
                isArabic={isArabic}
                onChange={(value) => setField("city", value)}
              />

              <Field
                id="area"
                label={t.labels.area}
                value={formData.area}
                error={errors.area}
                placeholder={t.placeholders.area}
                icon={MapPin}
                isArabic={isArabic}
                onChange={(value) => setField("area", value)}
              />

              <div className="md:col-span-2">
                <TextAreaField
                  id="address"
                  label={t.labels.address}
                  value={formData.address}
                  error={errors.address}
                  placeholder={t.placeholders.address}
                  onChange={(value) => setField("address", value)}
                />
              </div>

              <div className="md:col-span-2">
                <Field
                  id="google_maps_link"
                  label={t.labels.googleMaps}
                  value={formData.google_maps_link}
                  error={errors.google_maps_link}
                  placeholder={t.placeholders.googleMaps}
                  icon={Globe}
                  isArabic={isArabic}
                  onChange={(value) => setField("google_maps_link", value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="text-right">
              <CardTitle className="flex items-center justify-end gap-2">
                {t.operationalInfo}
                <Stethoscope className="h-5 w-5 text-primary" />
              </CardTitle>
              <CardDescription>{t.operationalDesc}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-2xl border bg-muted/30 p-4">
                <Checkbox
                  id="is_featured"
                  checked={formData.is_featured}
                  onCheckedChange={(checked) =>
                    setField("is_featured", Boolean(checked))
                  }
                />

                <Label
                  htmlFor="is_featured"
                  className="flex cursor-pointer items-center gap-2 text-right"
                >
                  <span>{t.labels.featured}</span>
                  <Star className="h-4 w-4 text-primary" />
                </Label>
              </div>

              <TextAreaField
                id="notes"
                label={t.labels.notes}
                value={formData.notes}
                error={errors.notes}
                placeholder={t.placeholders.notes}
                onChange={(value) => setField("notes", value)}
              />
            </CardContent>
          </Card>
        </div>

        {/* =====================================================
            Side Panel
        ====================================================== */}
        <div className="space-y-6">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="text-right">
              <CardTitle>{t.summaryTitle}</CardTitle>
              <CardDescription>{t.summaryDesc}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {summaryItems.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-3 rounded-2xl border bg-background p-4"
                  >
                    <div className="min-w-0 text-right">
                      <p className="text-xs text-muted-foreground">
                        {item.label}
                      </p>
                      <p className="truncate text-sm font-semibold">
                        {item.value}
                      </p>
                    </div>

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                );
              })}

              <div className="rounded-2xl border border-dashed bg-muted/30 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <Badge className="rounded-full px-3 py-1">
                    {completion.percent}%
                  </Badge>
                  <p className="text-sm font-semibold">{t.completion}</p>
                </div>

                <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${completion.percent}%` }}
                  />
                </div>

                <p className="text-right text-sm text-muted-foreground">
                  {completion.filled} / {completion.total} {t.completedFields}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="text-right">
              <CardTitle>{t.quickGuideTitle}</CardTitle>
              <CardDescription>{t.quickGuideDesc}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {t.guide.map((item, index) => (
                <div
                  key={`${item}-${index}`}
                  className="flex items-start gap-3 rounded-2xl border bg-background p-4"
                >
                  <p className="flex-1 text-right text-sm leading-7">{item}</p>

                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="text-right">
              <CardTitle>{t.requiredFields}</CardTitle>
              <CardDescription>
                {isArabic
                  ? "هذه الحقول مطلوبة للحفظ."
                  : "These fields are required to save."}
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-wrap justify-end gap-2">
              {[
                t.labels.name,
                t.labels.code,
                t.labels.contactPerson,
                t.labels.phone,
                t.labels.city,
                t.labels.address,
              ].map((item) => (
                <Badge
                  key={item}
                  variant="secondary"
                  className="rounded-full px-3 py-1"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {item}
                </Badge>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="text-right">
              <CardTitle>{t.optionalFields}</CardTitle>
              <CardDescription>
                {isArabic
                  ? "يمكن إكمالها لاحقًا حسب الحاجة."
                  : "Can be completed later when needed."}
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-wrap justify-end gap-2">
              {[
                t.labels.email,
                t.labels.website,
                t.labels.googleMaps,
                t.labels.notes,
                t.labels.featured,
              ].map((item) => (
                <Badge
                  key={item}
                  variant="outline"
                  className="rounded-full px-3 py-1"
                >
                  {item}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   🧱 Components
============================================================ */

type FieldProps = {
  id: string;
  label: string;
  value: string;
  error?: string;
  placeholder: string;
  type?: string;
  icon: ElementType;
  isArabic: boolean;
  onChange: (value: string) => void;
};

function Field({
  id,
  label,
  value,
  error,
  placeholder,
  type = "text",
  icon: Icon,
  isArabic,
  onChange,
}: FieldProps) {
  return (
    <div className="space-y-2 text-right">
      <Label htmlFor={id}>{label}</Label>

      <div className="relative">
        <Icon
          className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${
            isArabic ? "right-3" : "left-3"
          }`}
        />
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`h-11 rounded-xl ${isArabic ? "pr-10" : "pl-10"}`}
        />
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

type TextAreaFieldProps = {
  id: string;
  label: string;
  value: string;
  error?: string;
  placeholder: string;
  onChange: (value: string) => void;
};

function TextAreaField({
  id,
  label,
  value,
  error,
  placeholder,
  onChange,
}: TextAreaFieldProps) {
  return (
    <div className="space-y-2 text-right">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-28 rounded-xl"
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

type OptionGroupProps<T extends string> = {
  label: string;
  options: T[];
  value: T;
  labels: Record<T, string>;
  onChange: (value: T) => void;
};

function OptionGroup<T extends string>({
  label,
  options,
  value,
  labels,
  onChange,
}: OptionGroupProps<T>) {
  return (
    <div className="space-y-2 text-right">
      <Label>{label}</Label>

      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const isActive = value === option;

          return (
            <Button
              key={option}
              type="button"
              variant={isActive ? "default" : "outline"}
              className="h-10 rounded-xl"
              onClick={() => onChange(option)}
            >
              {labels[option]}
            </Button>
          );
        })}
      </div>
    </div>
  );
}