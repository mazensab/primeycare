"use client";

/* ============================================================
   📂 app/system/customers/create/page.tsx
   🧠 Primey Care | Create Customer Page
   ------------------------------------------------------------
   ✅ المسار: /system/customers/create
   ✅ الإصدار: v1.1.0 - UX Refinement

   ✅ العمل:
      إنشاء عميل جديد داخل مساحة النظام.

   ✅ API:
      POST /api/customers/ عبر lib/api.ts

   ✅ ملاحظات UX المعتمدة:
      - لا يتم إظهار المسارات التقنية أو أسماء API داخل الواجهة.
      - الصفحة ممتدة على عرض المساحة وليست متمركزة.
      - يوجد ملخص جانبي احترافي.
      - يوجد Error Alert داخل الصفحة عند فشل الحفظ.
      - يوجد تحذير عند مغادرة الصفحة وفيها بيانات غير محفوظة.
      - يتم تعطيل الحقول أثناء الحفظ.
      - تظهر أخطاء الحقول أسفل المدخلات.
      - يتم تنظيف أرقام التواصل والبريد قبل الحفظ.
      - يتم تأكيد تفريغ النموذج عند وجود بيانات.
      - دعم عربي / إنجليزي عبر primey-locale.
      - استخدام sonner للتنبيهات.
      - الأرقام تبقى بالإنجليزية.
      - الحفاظ على تصميم Primey Care الرسمي.
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
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  UserRound,
  UsersRound,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/* ============================================================
   Types
============================================================ */

type AppLocale = "ar" | "en";

type CustomerType = "individual" | "corporate";
type CustomerStatus = "active" | "inactive" | "blocked" | "lead";
type CustomerSource =
  | "website"
  | "whatsapp"
  | "agent"
  | "admin"
  | "import"
  | "other";
type Gender = "male" | "female" | "not_specified";

type CustomerForm = {
  customer_type: CustomerType;
  status: CustomerStatus;
  source: CustomerSource;

  first_name: string;
  last_name: string;
  company_name: string;

  gender: Gender;
  date_of_birth: string;
  national_id: string;
  passport_number: string;
  nationality: string;

  email: string;
  phone_number: string;
  whatsapp_number: string;
  alternative_phone_number: string;

  country: string;
  city: string;
  district: string;
  street_address: string;
  postal_code: string;
  national_address_text: string;

  notes: string;
  tags: string;
};

type CustomerFormErrors = Partial<Record<keyof CustomerForm, string>>;

type CreateCustomerResponse = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, unknown>;
  data?: {
    id?: number | string;
    customer_code?: string;
    display_name?: string;
    message?: string;
    ok?: boolean;
    errors?: Record<string, unknown>;
  };
  customer?: {
    id?: number | string;
    customer_code?: string;
    display_name?: string;
  };
  id?: number | string;
  customer_code?: string;
  display_name?: string;
};

/* ============================================================
   Defaults
============================================================ */

const INITIAL_FORM: CustomerForm = {
  customer_type: "individual",
  status: "active",
  source: "admin",

  first_name: "",
  last_name: "",
  company_name: "",

  gender: "not_specified",
  date_of_birth: "",
  national_id: "",
  passport_number: "",
  nationality: "Saudi Arabia",

  email: "",
  phone_number: "",
  whatsapp_number: "",
  alternative_phone_number: "",

  country: "Saudi Arabia",
  city: "",
  district: "",
  street_address: "",
  postal_code: "",
  national_address_text: "",

  notes: "",
  tags: "",
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
    pageTitle: isArabic ? "إضافة عميل" : "Add Customer",
    pageDescription: isArabic
      ? "إنشاء ملف عميل جديد وربطه لاحقًا بالطلبات والفواتير والمدفوعات."
      : "Create a new customer profile and connect it later with orders, invoices, and payments.",

    back: isArabic ? "العودة للعملاء" : "Back to Customers",
    save: isArabic ? "حفظ العميل" : "Save Customer",
    saving: isArabic ? "جاري الحفظ..." : "Saving...",
    reset: isArabic ? "تفريغ النموذج" : "Reset Form",

    customerSummary: isArabic ? "ملخص العميل" : "Customer Summary",
    customerSummaryDesc: isArabic
      ? "مراجعة سريعة للبيانات قبل الحفظ."
      : "Quick review before saving.",
    progress: isArabic ? "اكتمال البيانات" : "Completion",
    ready: isArabic ? "جاهز للحفظ" : "Ready to save",
    missing: isArabic ? "بيانات أساسية ناقصة" : "Missing required data",

    basicInfo: isArabic ? "البيانات الأساسية" : "Basic Information",
    basicInfoDesc: isArabic
      ? "نوع العميل، الحالة، ومصدر التسجيل."
      : "Customer type, status, and registration source.",

    identityInfo: isArabic ? "بيانات الهوية" : "Identity Information",
    identityInfoDesc: isArabic
      ? "بيانات العميل الفرد أو الشركة والبيانات النظامية."
      : "Individual/corporate name and legal information.",

    contactInfo: isArabic ? "بيانات التواصل" : "Contact Information",
    contactInfoDesc: isArabic
      ? "يجب إدخال وسيلة تواصل واحدة على الأقل."
      : "At least one contact method is required.",

    addressInfo: isArabic ? "العنوان" : "Address",
    addressInfoDesc: isArabic
      ? "بيانات الدولة، المدينة، الحي، والعنوان."
      : "Country, city, district, and address details.",

    notesInfo: isArabic ? "ملاحظات وتصنيفات" : "Notes & Tags",
    notesInfoDesc: isArabic
      ? "ملاحظات داخلية ووسوم للبحث والتصنيف."
      : "Internal notes and searchable tags.",

    customerType: isArabic ? "نوع العميل" : "Customer Type",
    individual: isArabic ? "فرد" : "Individual",
    corporate: isArabic ? "شركة" : "Corporate",
    status: isArabic ? "الحالة" : "Status",
    source: isArabic ? "المصدر" : "Source",

    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
    blocked: isArabic ? "محظور" : "Blocked",
    lead: isArabic ? "عميل محتمل" : "Lead",

    website: isArabic ? "الموقع" : "Website",
    whatsappSource: isArabic ? "واتساب" : "WhatsApp",
    agent: isArabic ? "مندوب" : "Agent",
    admin: isArabic ? "النظام" : "Admin",
    import: isArabic ? "استيراد" : "Import",
    other: isArabic ? "أخرى" : "Other",

    firstName: isArabic ? "الاسم الأول" : "First Name",
    lastName: isArabic ? "اسم العائلة" : "Last Name",
    companyName: isArabic ? "اسم الشركة" : "Company Name",
    gender: isArabic ? "الجنس" : "Gender",
    male: isArabic ? "ذكر" : "Male",
    female: isArabic ? "أنثى" : "Female",
    notSpecified: isArabic ? "غير محدد" : "Not Specified",
    dateOfBirth: isArabic ? "تاريخ الميلاد" : "Date of Birth",
    nationalId: isArabic ? "رقم الهوية / الإقامة" : "National ID / Iqama",
    passportNumber: isArabic ? "رقم الجواز" : "Passport Number",
    nationality: isArabic ? "الجنسية" : "Nationality",

    email: isArabic ? "البريد الإلكتروني" : "Email",
    phone: isArabic ? "رقم الجوال" : "Phone Number",
    whatsapp: isArabic ? "رقم الواتساب" : "WhatsApp Number",
    alternativePhone: isArabic ? "رقم بديل" : "Alternative Phone",

    country: isArabic ? "الدولة" : "Country",
    city: isArabic ? "المدينة" : "City",
    district: isArabic ? "الحي" : "District",
    street: isArabic ? "العنوان" : "Street Address",
    postalCode: isArabic ? "الرمز البريدي" : "Postal Code",
    nationalAddress: isArabic ? "العنوان الوطني" : "National Address",

    notes: isArabic ? "ملاحظات داخلية" : "Internal Notes",
    tags: isArabic ? "وسوم" : "Tags",

    placeholders: {
      firstName: isArabic ? "مثال: مازن" : "Example: Mazen",
      lastName: isArabic ? "مثال: الأحمدي" : "Example: Alahmadi",
      companyName: isArabic ? "مثال: شركة برايمي" : "Example: Primey Company",
      email: isArabic ? "customer@example.com" : "customer@example.com",
      phone: isArabic ? "05xxxxxxxx" : "05xxxxxxxx",
      whatsapp: isArabic ? "05xxxxxxxx" : "05xxxxxxxx",
      city: isArabic ? "مثال: جدة" : "Example: Jeddah",
      district: isArabic ? "مثال: الروضة" : "Example: Al Rawdah",
      street: isArabic ? "اكتب العنوان التفصيلي" : "Enter full address",
      nationalAddress: isArabic
        ? "العنوان الوطني أو أي تفاصيل إضافية..."
        : "National address or extra address details...",
      tags: isArabic ? "مثال: VIP, ولاء" : "Example: VIP, loyalty",
      notes: isArabic
        ? "ملاحظات داخلية عن العميل..."
        : "Internal notes about the customer...",
    },

    validation: {
      requiredName: isArabic
        ? "يرجى إدخال الاسم الأول واسم العائلة."
        : "Please enter first name and last name.",
      requiredCompany: isArabic
        ? "يرجى إدخال اسم الشركة."
        : "Please enter company name.",
      requiredContact: isArabic
        ? "يرجى إدخال وسيلة تواصل واحدة على الأقل."
        : "Please enter at least one contact method.",
      invalidEmail: isArabic
        ? "صيغة البريد الإلكتروني غير صحيحة."
        : "Invalid email format.",
    },

    success: isArabic
      ? "تم إنشاء العميل بنجاح."
      : "Customer created successfully.",
    error: isArabic
      ? "تعذر إنشاء العميل. تحقق من البيانات وحاول مرة أخرى."
      : "Failed to create customer. Please check the data and try again.",
    errorTitle: isArabic ? "تعذر حفظ البيانات" : "Unable to save data",
    validationToast: isArabic
      ? "يرجى تصحيح الحقول المطلوبة قبل المتابعة."
      : "Please fix the required fields before continuing.",
    copied: isArabic ? "تم النسخ بنجاح" : "Copied successfully",

    confirmLeave: isArabic
      ? "لديك بيانات غير محفوظة. هل تريد المغادرة؟"
      : "You have unsaved changes. Do you want to leave?",
    confirmReset: isArabic
      ? "هل تريد تفريغ النموذج؟ سيتم حذف البيانات المدخلة."
      : "Reset the form? Entered data will be cleared.",

    quickNotesTitle: isArabic ? "إرشادات قبل الحفظ" : "Before Saving",
    quickNotesDesc: isArabic
      ? "نقاط تساعدك على إدخال بيانات دقيقة."
      : "Helpful points for entering accurate data.",
    quickNotes: [
      isArabic
        ? "اختر نوع العميل بشكل صحيح لأن البيانات المطلوبة تختلف بين الفرد والشركة."
        : "Choose the customer type correctly because required data differs for individuals and companies.",
      isArabic
        ? "أدخل وسيلة تواصل صحيحة واحدة على الأقل لتسهيل المتابعة."
        : "Add at least one accurate contact method for smoother follow-up.",
      isArabic
        ? "المدينة والحي تساعد لاحقًا في البحث والتقارير التشغيلية."
        : "City and district help later with search and operational reports.",
    ],
  };
}

/* ============================================================
   Helpers
============================================================ */

function isValidEmail(email: string) {
  if (!email.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function normalizePhoneValue(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function hasFormChanges(form: CustomerForm) {
  return JSON.stringify(form) !== JSON.stringify(INITIAL_FORM);
}

function normalizePayload(form: CustomerForm) {
  return {
    customer_type: form.customer_type,
    status: form.status,
    source: form.source,

    first_name: form.customer_type === "individual" ? form.first_name.trim() : "",
    last_name: form.customer_type === "individual" ? form.last_name.trim() : "",
    company_name:
      form.customer_type === "corporate" ? form.company_name.trim() : "",

    gender: form.gender,
    date_of_birth: form.date_of_birth || null,
    national_id: form.national_id.trim(),
    passport_number: form.passport_number.trim(),
    nationality: form.nationality.trim(),

    email: form.email.trim().toLowerCase(),
    phone_number: normalizePhoneValue(form.phone_number),
    whatsapp_number: normalizePhoneValue(form.whatsapp_number),
    alternative_phone_number: normalizePhoneValue(form.alternative_phone_number),

    country: form.country.trim(),
    city: form.city.trim(),
    district: form.district.trim(),
    street_address: form.street_address.trim(),
    postal_code: form.postal_code.trim(),
    national_address_text: form.national_address_text.trim(),

    notes: form.notes.trim(),
    tags: form.tags.trim(),
  };
}

function normalizeServerMessage(
  payload: CreateCustomerResponse | unknown,
  fallback: string,
) {
  if (!payload || typeof payload !== "object") return fallback;

  const data = payload as CreateCustomerResponse;

  if (data.message) return data.message;

  if (data.errors) {
    const firstKey = Object.keys(data.errors)[0];
    const firstValue = data.errors[firstKey];

    if (Array.isArray(firstValue)) return String(firstValue[0]);
    if (firstValue) return String(firstValue);
  }

  return fallback;
}

function getCreatedCustomerId(payload: CreateCustomerResponse | undefined) {
  if (!payload) return null;

  return payload.customer?.id || payload.data?.id || payload.id || null;
}

/* ============================================================
   Page
============================================================ */

export default function CreateCustomerPage() {
  const router = useRouter();

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [form, setForm] = useState<CustomerForm>(INITIAL_FORM);
  const [errors, setErrors] = useState<CustomerFormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const isCorporate = form.customer_type === "corporate";
  const isDirty = useMemo(() => hasFormChanges(form), [form]);

  const completion = useMemo(() => {
    const requiredValues = [
      form.customer_type,
      form.status,
      form.source,
      isCorporate ? form.company_name : form.first_name,
      isCorporate ? form.company_name : form.last_name,
      form.email || form.phone_number || form.whatsapp_number,
      form.city,
    ];

    const done = requiredValues.filter((value) =>
      String(value || "").trim(),
    ).length;

    return Math.round((done / requiredValues.length) * 100);
  }, [form, isCorporate]);

  const isReady = useMemo(() => {
    const hasName = isCorporate
      ? Boolean(form.company_name.trim())
      : Boolean(form.first_name.trim() && form.last_name.trim());

    const hasContact = Boolean(
      form.email.trim() ||
        form.phone_number.trim() ||
        form.whatsapp_number.trim(),
    );

    return hasName && hasContact && isValidEmail(form.email);
  }, [form, isCorporate]);

  function update<K extends keyof CustomerForm>(
    key: K,
    value: CustomerForm[K],
  ) {
    setForm((current) => ({
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

  function validate() {
    const nextErrors: CustomerFormErrors = {};

    if (form.customer_type === "individual") {
      if (!form.first_name.trim()) {
        nextErrors.first_name = t.validation.requiredName;
      }

      if (!form.last_name.trim()) {
        nextErrors.last_name = t.validation.requiredName;
      }
    }

    if (form.customer_type === "corporate" && !form.company_name.trim()) {
      nextErrors.company_name = t.validation.requiredCompany;
    }

    if (
      !form.email.trim() &&
      !form.phone_number.trim() &&
      !form.whatsapp_number.trim()
    ) {
      nextErrors.email = t.validation.requiredContact;
      nextErrors.phone_number = t.validation.requiredContact;
      nextErrors.whatsapp_number = t.validation.requiredContact;
    }

    if (!isValidEmail(form.email)) {
      nextErrors.email = t.validation.invalidEmail;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submitForm() {
    setSubmitError("");

    if (!validate()) {
      toast.error(t.validationToast);
      return;
    }

    try {
      setIsSaving(true);

      const response = await apiPost<CreateCustomerResponse>(
        API_PATHS.customers.list,
        normalizePayload(form),
      );

      if (!response.ok) {
        const message = response.message || t.error;
        setSubmitError(message);
        toast.error(message);
        return;
      }

      if (response.data?.ok === false) {
        const message = normalizeServerMessage(response.data, t.error);
        setSubmitError(message);
        toast.error(message);
        return;
      }

      toast.success(response.data?.message || t.success);

      const customerId = getCreatedCustomerId(response.data);

      if (customerId) {
        router.push(`/system/customers/${customerId}`);
        return;
      }

      router.push("/system/customers/list");
    } catch (error) {
      console.error("Create customer error:", error);
      const message = error instanceof Error ? error.message : t.error;
      setSubmitError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  function handleBack() {
    if (isDirty && !window.confirm(t.confirmLeave)) {
      return;
    }

    router.push("/system/customers");
  }

  function resetForm() {
    if (isDirty && !window.confirm(t.confirmReset)) {
      return;
    }

    setForm(INITIAL_FORM);
    setErrors({});
    setSubmitError("");
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
      if (!isDirty || isSaving) return;

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty, isSaving]);

  return (
    <div className="w-full space-y-4" dir={isArabic ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t.pageTitle}
          </h1>

          <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
            {t.pageDescription}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full rounded-xl sm:w-auto"
            onClick={handleBack}
            disabled={isSaving}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t.back}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl"
            onClick={resetForm}
            disabled={isSaving}
          >
            <RotateCcw className="h-4 w-4" />
            <span>{t.reset}</span>
          </Button>

          <Button
            type="button"
            className="h-10 rounded-xl"
            onClick={submitForm}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>{isSaving ? t.saving : t.save}</span>
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {submitError ? (
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 shadow-sm">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <XCircle className="h-5 w-5" />
            </div>

            <div>
              <p className="font-semibold text-destructive">{t.errorTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">
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
                <ShieldCheck className="h-5 w-5" />
                {t.basicInfo}
              </CardTitle>
              <CardDescription>{t.basicInfoDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-3">
              <FieldBlock label={t.customerType}>
                <select
                  value={form.customer_type}
                  onChange={(event) =>
                    update("customer_type", event.target.value as CustomerType)
                  }
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSaving}
                >
                  <option value="individual">{t.individual}</option>
                  <option value="corporate">{t.corporate}</option>
                </select>
              </FieldBlock>

              <FieldBlock label={t.status}>
                <select
                  value={form.status}
                  onChange={(event) =>
                    update("status", event.target.value as CustomerStatus)
                  }
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSaving}
                >
                  <option value="active">{t.active}</option>
                  <option value="inactive">{t.inactive}</option>
                  <option value="blocked">{t.blocked}</option>
                  <option value="lead">{t.lead}</option>
                </select>
              </FieldBlock>

              <FieldBlock label={t.source}>
                <select
                  value={form.source}
                  onChange={(event) =>
                    update("source", event.target.value as CustomerSource)
                  }
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSaving}
                >
                  <option value="admin">{t.admin}</option>
                  <option value="website">{t.website}</option>
                  <option value="whatsapp">{t.whatsappSource}</option>
                  <option value="agent">{t.agent}</option>
                  <option value="import">{t.import}</option>
                  <option value="other">{t.other}</option>
                </select>
              </FieldBlock>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                {isCorporate ? (
                  <Building2 className="h-5 w-5" />
                ) : (
                  <UserRound className="h-5 w-5" />
                )}
                {t.identityInfo}
              </CardTitle>
              <CardDescription>{t.identityInfoDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              {isCorporate ? (
                <div className="md:col-span-2">
                  <FieldBlock
                    label={t.companyName}
                    error={errors.company_name}
                    required
                  >
                    <Input
                      value={form.company_name}
                      onChange={(event) =>
                        update("company_name", event.target.value)
                      }
                      placeholder={t.placeholders.companyName}
                      className="h-10 rounded-xl"
                      autoComplete="organization"
                      disabled={isSaving}
                    />
                  </FieldBlock>
                </div>
              ) : (
                <>
                  <FieldBlock
                    label={t.firstName}
                    error={errors.first_name}
                    required
                  >
                    <Input
                      value={form.first_name}
                      onChange={(event) =>
                        update("first_name", event.target.value)
                      }
                      placeholder={t.placeholders.firstName}
                      className="h-10 rounded-xl"
                      autoComplete="given-name"
                      disabled={isSaving}
                    />
                  </FieldBlock>

                  <FieldBlock
                    label={t.lastName}
                    error={errors.last_name}
                    required
                  >
                    <Input
                      value={form.last_name}
                      onChange={(event) =>
                        update("last_name", event.target.value)
                      }
                      placeholder={t.placeholders.lastName}
                      className="h-10 rounded-xl"
                      autoComplete="family-name"
                      disabled={isSaving}
                    />
                  </FieldBlock>
                </>
              )}

              <FieldBlock label={t.gender}>
                <select
                  value={form.gender}
                  onChange={(event) =>
                    update("gender", event.target.value as Gender)
                  }
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSaving}
                >
                  <option value="not_specified">{t.notSpecified}</option>
                  <option value="male">{t.male}</option>
                  <option value="female">{t.female}</option>
                </select>
              </FieldBlock>

              <FieldBlock label={t.dateOfBirth}>
                <Input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(event) =>
                    update("date_of_birth", event.target.value)
                  }
                  className="h-10 rounded-xl"
                  disabled={isSaving}
                />
              </FieldBlock>

              <FieldBlock label={t.nationalId}>
                <Input
                  value={form.national_id}
                  onChange={(event) => update("national_id", event.target.value)}
                  className="h-10 rounded-xl"
                  dir="ltr"
                  disabled={isSaving}
                />
              </FieldBlock>

              <FieldBlock label={t.passportNumber}>
                <Input
                  value={form.passport_number}
                  onChange={(event) =>
                    update("passport_number", event.target.value)
                  }
                  className="h-10 rounded-xl"
                  dir="ltr"
                  disabled={isSaving}
                />
              </FieldBlock>

              <div className="md:col-span-2">
                <FieldBlock label={t.nationality}>
                  <Input
                    value={form.nationality}
                    onChange={(event) =>
                      update("nationality", event.target.value)
                    }
                    className="h-10 rounded-xl"
                    disabled={isSaving}
                  />
                </FieldBlock>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Phone className="h-5 w-5" />
                {t.contactInfo}
              </CardTitle>
              <CardDescription>{t.contactInfoDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <FieldBlock label={t.email} error={errors.email}>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                  onBlur={() =>
                    update("email", form.email.trim().toLowerCase())
                  }
                  placeholder={t.placeholders.email}
                  className="h-10 rounded-xl"
                  autoComplete="email"
                  dir="ltr"
                  disabled={isSaving}
                />
              </FieldBlock>

              <FieldBlock label={t.phone} error={errors.phone_number}>
                <Input
                  value={form.phone_number}
                  onChange={(event) =>
                    update(
                      "phone_number",
                      normalizePhoneValue(event.target.value),
                    )
                  }
                  placeholder={t.placeholders.phone}
                  className="h-10 rounded-xl"
                  autoComplete="tel"
                  dir="ltr"
                  disabled={isSaving}
                />
              </FieldBlock>

              <FieldBlock label={t.whatsapp} error={errors.whatsapp_number}>
                <Input
                  value={form.whatsapp_number}
                  onChange={(event) =>
                    update(
                      "whatsapp_number",
                      normalizePhoneValue(event.target.value),
                    )
                  }
                  placeholder={t.placeholders.whatsapp}
                  className="h-10 rounded-xl"
                  autoComplete="tel"
                  dir="ltr"
                  disabled={isSaving}
                />
              </FieldBlock>

              <FieldBlock label={t.alternativePhone}>
                <Input
                  value={form.alternative_phone_number}
                  onChange={(event) =>
                    update(
                      "alternative_phone_number",
                      normalizePhoneValue(event.target.value),
                    )
                  }
                  className="h-10 rounded-xl"
                  autoComplete="tel"
                  dir="ltr"
                  disabled={isSaving}
                />
              </FieldBlock>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <MapPin className="h-5 w-5" />
                {t.addressInfo}
              </CardTitle>
              <CardDescription>{t.addressInfoDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <FieldBlock label={t.country}>
                <Input
                  value={form.country}
                  onChange={(event) => update("country", event.target.value)}
                  className="h-10 rounded-xl"
                  autoComplete="country-name"
                  disabled={isSaving}
                />
              </FieldBlock>

              <FieldBlock label={t.city}>
                <Input
                  value={form.city}
                  onChange={(event) => update("city", event.target.value)}
                  placeholder={t.placeholders.city}
                  className="h-10 rounded-xl"
                  autoComplete="address-level2"
                  disabled={isSaving}
                />
              </FieldBlock>

              <FieldBlock label={t.district}>
                <Input
                  value={form.district}
                  onChange={(event) => update("district", event.target.value)}
                  placeholder={t.placeholders.district}
                  className="h-10 rounded-xl"
                  autoComplete="address-level3"
                  disabled={isSaving}
                />
              </FieldBlock>

              <FieldBlock label={t.postalCode}>
                <Input
                  value={form.postal_code}
                  onChange={(event) =>
                    update("postal_code", normalizePhoneValue(event.target.value))
                  }
                  className="h-10 rounded-xl"
                  autoComplete="postal-code"
                  dir="ltr"
                  disabled={isSaving}
                />
              </FieldBlock>

              <div className="md:col-span-2">
                <FieldBlock label={t.street}>
                  <Input
                    value={form.street_address}
                    onChange={(event) =>
                      update("street_address", event.target.value)
                    }
                    placeholder={t.placeholders.street}
                    className="h-10 rounded-xl"
                    autoComplete="street-address"
                    disabled={isSaving}
                  />
                </FieldBlock>
              </div>

              <div className="md:col-span-2">
                <FieldBlock label={t.nationalAddress}>
                  <Textarea
                    value={form.national_address_text}
                    onChange={(event) =>
                      update("national_address_text", event.target.value)
                    }
                    placeholder={t.placeholders.nationalAddress}
                    className="min-h-24 rounded-xl"
                    disabled={isSaving}
                  />
                </FieldBlock>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <UsersRound className="h-5 w-5" />
                {t.notesInfo}
              </CardTitle>
              <CardDescription>{t.notesInfoDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4">
              <FieldBlock label={t.tags}>
                <Input
                  value={form.tags}
                  onChange={(event) => update("tags", event.target.value)}
                  placeholder={t.placeholders.tags}
                  className="h-10 rounded-xl"
                  disabled={isSaving}
                />
              </FieldBlock>

              <FieldBlock label={t.notes}>
                <Textarea
                  value={form.notes}
                  onChange={(event) => update("notes", event.target.value)}
                  placeholder={t.placeholders.notes}
                  className="min-h-32 rounded-xl"
                  disabled={isSaving}
                />
              </FieldBlock>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <aside className="min-w-0 space-y-4">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <BadgeCheck className="h-5 w-5" />
                {t.customerSummary}
              </CardTitle>
              <CardDescription>{t.customerSummaryDesc}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{t.progress}</p>
                    <p className="mt-1 text-2xl font-bold">{completion}%</p>
                  </div>

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${completion}%` }}
                  />
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <CheckCircle2
                    className={`h-4 w-4 ${
                      isReady ? "text-emerald-600" : "text-muted-foreground"
                    }`}
                  />
                  <p className="text-xs text-muted-foreground">
                    {isReady ? t.ready : t.missing}
                  </p>
                </div>
              </div>

              <SummaryItem
                icon={isCorporate ? Building2 : UserRound}
                label={t.customerType}
                value={isCorporate ? t.corporate : t.individual}
              />

              <SummaryItem
                icon={FileText}
                label={isCorporate ? t.companyName : t.firstName}
                value={
                  isCorporate
                    ? form.company_name || "-"
                    : `${form.first_name} ${form.last_name}`.trim() || "-"
                }
              />

              <SummaryItem
                icon={Phone}
                label={t.contactInfo}
                value={
                  form.whatsapp_number || form.phone_number || form.email || "-"
                }
              />

              <SummaryItem icon={MapPin} label={t.city} value={form.city || "-"} />

              <SummaryItem
                icon={ShieldCheck}
                label={t.status}
                value={
                  form.status === "active"
                    ? t.active
                    : form.status === "inactive"
                      ? t.inactive
                      : form.status === "blocked"
                        ? t.blocked
                        : t.lead
                }
              />

              <div className="grid gap-2 pt-2">
                <Button
                  type="button"
                  className="h-10 rounded-xl"
                  onClick={submitForm}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {isSaving ? t.saving : t.save}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  disabled={isSaving}
                  className="h-10 rounded-xl"
                >
                  <RotateCcw className="h-4 w-4" />
                  {t.reset}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                {t.quickNotesTitle}
              </CardTitle>
              <CardDescription>{t.quickNotesDesc}</CardDescription>
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
        {required ? <span className="ms-1 text-destructive">*</span> : null}
      </Label>

      {children}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
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
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}