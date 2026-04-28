"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Save,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import { apiPost, API_PATHS } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
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

/* ============================================================
   📂 app/system/customers/create/page.tsx
   🧠 Primey Care | Create Customer Page
   ------------------------------------------------------------
   ✅ مرتبط مع lib/api.ts
   ✅ POST /api/customers/
   ✅ sonner toast
   ✅ Validation قبل الإرسال
   ✅ دعم عربي / إنجليزي
   ✅ نفس تصميم Primey Care الرسمي
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

type CreateCustomerResponse = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, unknown>;
  data?: {
    id?: number | string;
    customer_code?: string;
    display_name?: string;
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

const TEXT = {
  ar: {
    pageTitle: "إضافة عميل",
    pageDescription:
      "إنشاء ملف عميل جديد وربطه لاحقًا بالطلبات والفواتير والمدفوعات وكشف الحساب.",
    back: "العودة للقائمة",
    save: "حفظ العميل",
    saving: "جاري الحفظ...",
    reset: "تفريغ النموذج",

    stepProfile: "ملف العميل",
    stepContact: "التواصل",
    stepAddress: "العنوان",
    stepReview: "المراجعة",

    customerSummary: "ملخص العميل",
    customerSummaryDesc: "مراجعة سريعة قبل الحفظ.",
    progress: "اكتمال البيانات",
    ready: "جاهز للحفظ",
    missing: "بيانات ناقصة",

    basicInfo: "البيانات الأساسية",
    basicInfoDesc: "نوع العميل، الحالة، ومصدر التسجيل.",
    identityInfo: "بيانات الهوية",
    identityInfoDesc: "بيانات الاسم أو الشركة والبيانات النظامية.",
    contactInfo: "بيانات التواصل",
    contactInfoDesc: "يجب إدخال وسيلة تواصل واحدة على الأقل.",
    addressInfo: "العنوان الوطني",
    addressInfoDesc: "بيانات المدينة والحي والعنوان.",
    notesInfo: "ملاحظات وتصنيفات",
    notesInfoDesc: "ملاحظات داخلية ووسوم للبحث والتصنيف.",

    customerType: "نوع العميل",
    individual: "فرد",
    corporate: "شركة",
    status: "الحالة",
    source: "المصدر",

    active: "نشط",
    inactive: "غير نشط",
    blocked: "محظور",
    lead: "عميل محتمل",

    website: "الموقع",
    whatsappSource: "واتساب",
    agent: "مندوب",
    admin: "النظام",
    import: "استيراد",
    other: "أخرى",

    firstName: "الاسم الأول",
    lastName: "اسم العائلة",
    companyName: "اسم الشركة",
    gender: "الجنس",
    male: "ذكر",
    female: "أنثى",
    notSpecified: "غير محدد",
    dateOfBirth: "تاريخ الميلاد",
    nationalId: "رقم الهوية / الإقامة",
    passportNumber: "رقم الجواز",
    nationality: "الجنسية",

    email: "البريد الإلكتروني",
    phone: "رقم الجوال",
    whatsapp: "رقم الواتساب",
    alternativePhone: "رقم بديل",

    country: "الدولة",
    city: "المدينة",
    district: "الحي",
    street: "العنوان",
    postalCode: "الرمز البريدي",
    nationalAddress: "العنوان الوطني",

    notes: "ملاحظات داخلية",
    tags: "وسوم",

    requiredName: "يرجى إدخال الاسم الأول واسم العائلة.",
    requiredCompany: "يرجى إدخال اسم الشركة.",
    requiredContact: "يرجى إدخال وسيلة تواصل واحدة على الأقل.",
    invalidEmail: "صيغة البريد الإلكتروني غير صحيحة.",
    success: "تم إنشاء العميل بنجاح.",
    error: "تعذر إنشاء العميل.",
    openList: "فتح قائمة العملاء",
  },
  en: {
    pageTitle: "Add Customer",
    pageDescription:
      "Create a new customer profile and connect it later with orders, invoices, payments, and statements.",
    back: "Back to list",
    save: "Save Customer",
    saving: "Saving...",
    reset: "Reset Form",

    stepProfile: "Profile",
    stepContact: "Contact",
    stepAddress: "Address",
    stepReview: "Review",

    customerSummary: "Customer Summary",
    customerSummaryDesc: "Quick review before saving.",
    progress: "Completion",
    ready: "Ready to save",
    missing: "Missing data",

    basicInfo: "Basic Information",
    basicInfoDesc: "Customer type, status, and registration source.",
    identityInfo: "Identity Information",
    identityInfoDesc: "Individual/corporate name and legal information.",
    contactInfo: "Contact Information",
    contactInfoDesc: "At least one contact method is required.",
    addressInfo: "National Address",
    addressInfoDesc: "City, district, and address details.",
    notesInfo: "Notes & Tags",
    notesInfoDesc: "Internal notes and searchable tags.",

    customerType: "Customer Type",
    individual: "Individual",
    corporate: "Corporate",
    status: "Status",
    source: "Source",

    active: "Active",
    inactive: "Inactive",
    blocked: "Blocked",
    lead: "Lead",

    website: "Website",
    whatsappSource: "WhatsApp",
    agent: "Agent",
    admin: "Admin",
    import: "Import",
    other: "Other",

    firstName: "First Name",
    lastName: "Last Name",
    companyName: "Company Name",
    gender: "Gender",
    male: "Male",
    female: "Female",
    notSpecified: "Not Specified",
    dateOfBirth: "Date of Birth",
    nationalId: "National ID / Iqama",
    passportNumber: "Passport Number",
    nationality: "Nationality",

    email: "Email",
    phone: "Phone Number",
    whatsapp: "WhatsApp Number",
    alternativePhone: "Alternative Phone",

    country: "Country",
    city: "City",
    district: "District",
    street: "Street Address",
    postalCode: "Postal Code",
    nationalAddress: "National Address",

    notes: "Internal Notes",
    tags: "Tags",

    requiredName: "Please enter first name and last name.",
    requiredCompany: "Please enter company name.",
    requiredContact: "Please enter at least one contact method.",
    invalidEmail: "Invalid email format.",
    success: "Customer created successfully.",
    error: "Failed to create customer.",
    openList: "Open customers list",
  },
} as const;

function readLocale(): AppLocale {
  try {
    if (typeof window === "undefined") return "ar";

    const savedLocale = window.localStorage.getItem("primey-locale");
    if (savedLocale === "en") return "en";
    if (savedLocale === "ar") return "ar";

    return document.documentElement.lang === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

function applyDocumentLocale(locale: AppLocale) {
  if (typeof document === "undefined") return;

  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  document.body.dir = locale === "ar" ? "rtl" : "ltr";
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

    email: form.email.trim(),
    phone_number: form.phone_number.trim(),
    whatsapp_number: form.whatsapp_number.trim(),
    alternative_phone_number: form.alternative_phone_number.trim(),

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

function getCreatedCustomerId(payload: CreateCustomerResponse) {
  return payload.customer?.id || payload.data?.id || payload.id || null;
}

function isValidEmail(email: string) {
  if (!email.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function CreateCustomerPage() {
  const router = useRouter();

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [form, setForm] = useState<CustomerForm>(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const t = TEXT[locale];
  const isArabic = locale === "ar";
  const isCorporate = form.customer_type === "corporate";

  useEffect(() => {
    const syncLocale = () => {
      const nextLocale = readLocale();
      applyDocumentLocale(nextLocale);
      setLocale(nextLocale);
    };

    syncLocale();

    window.addEventListener("primey-locale-changed", syncLocale);
    window.addEventListener("storage", syncLocale);

    return () => {
      window.removeEventListener("primey-locale-changed", syncLocale);
      window.removeEventListener("storage", syncLocale);
    };
  }, []);

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

  function update<K extends keyof CustomerForm>(key: K, value: CustomerForm[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function validate() {
    if (form.customer_type === "individual") {
      if (!form.first_name.trim() || !form.last_name.trim()) {
        toast.error(t.requiredName);
        return false;
      }
    }

    if (form.customer_type === "corporate") {
      if (!form.company_name.trim()) {
        toast.error(t.requiredCompany);
        return false;
      }
    }

    if (
      !form.email.trim() &&
      !form.phone_number.trim() &&
      !form.whatsapp_number.trim()
    ) {
      toast.error(t.requiredContact);
      return false;
    }

    if (!isValidEmail(form.email)) {
      toast.error(t.invalidEmail);
      return false;
    }

    return true;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validate()) return;

    setIsSaving(true);

    try {
      const response = await apiPost<CreateCustomerResponse>(
        API_PATHS.customers.list,
        normalizePayload(form),
      );

      if (!response.ok) {
        toast.error(response.message || t.error);
        return;
      }

      if (response.data?.ok === false) {
        toast.error(normalizeServerMessage(response.data, t.error));
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
      toast.error(error instanceof Error ? error.message : t.error);
    } finally {
      setIsSaving(false);
    }
  }

  function resetForm() {
    setForm(INITIAL_FORM);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-5xl space-y-4"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              /system/customers/create
            </Badge>

            <Badge className="rounded-full">
              {isReady ? t.ready : t.missing}
            </Badge>
          </div>

          <h1 className="text-2xl font-bold tracking-tight">{t.pageTitle}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t.pageDescription}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/system/customers/list">
              {isArabic ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
              {t.back}
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={resetForm}
            disabled={isSaving}
          >
            {t.reset}
          </Button>

          <Button type="submit" className="rounded-xl" disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving ? t.saving : t.save}
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <StepCard
              active
              icon={UserRound}
              title={t.stepProfile}
              value={`${completion}%`}
            />

            <StepCard
              active={Boolean(
                form.email || form.phone_number || form.whatsapp_number,
              )}
              icon={Phone}
              title={t.stepContact}
              value={
                form.whatsapp_number || form.phone_number || form.email || "-"
              }
            />

            <StepCard
              active={Boolean(form.city)}
              icon={MapPin}
              title={t.stepAddress}
              value={form.city || "-"}
            />

            <StepCard
              active={isReady}
              icon={CheckCircle2}
              title={t.stepReview}
              value={isReady ? t.ready : t.missing}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-5 w-5" />
                {t.basicInfo}
              </CardTitle>
              <CardDescription>{t.basicInfoDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-3">
              <Field label={t.customerType}>
                <select
                  value={form.customer_type}
                  onChange={(event) =>
                    update("customer_type", event.target.value as CustomerType)
                  }
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="individual">{t.individual}</option>
                  <option value="corporate">{t.corporate}</option>
                </select>
              </Field>

              <Field label={t.status}>
                <select
                  value={form.status}
                  onChange={(event) =>
                    update("status", event.target.value as CustomerStatus)
                  }
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="active">{t.active}</option>
                  <option value="inactive">{t.inactive}</option>
                  <option value="blocked">{t.blocked}</option>
                  <option value="lead">{t.lead}</option>
                </select>
              </Field>

              <Field label={t.source}>
                <select
                  value={form.source}
                  onChange={(event) =>
                    update("source", event.target.value as CustomerSource)
                  }
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="admin">{t.admin}</option>
                  <option value="website">{t.website}</option>
                  <option value="whatsapp">{t.whatsappSource}</option>
                  <option value="agent">{t.agent}</option>
                  <option value="import">{t.import}</option>
                  <option value="other">{t.other}</option>
                </select>
              </Field>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
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
                <Field label={t.companyName} className="md:col-span-2">
                  <Input
                    value={form.company_name}
                    onChange={(event) =>
                      update("company_name", event.target.value)
                    }
                    className="rounded-xl"
                    autoComplete="organization"
                  />
                </Field>
              ) : (
                <>
                  <Field label={t.firstName}>
                    <Input
                      value={form.first_name}
                      onChange={(event) =>
                        update("first_name", event.target.value)
                      }
                      className="rounded-xl"
                      autoComplete="given-name"
                    />
                  </Field>

                  <Field label={t.lastName}>
                    <Input
                      value={form.last_name}
                      onChange={(event) =>
                        update("last_name", event.target.value)
                      }
                      className="rounded-xl"
                      autoComplete="family-name"
                    />
                  </Field>
                </>
              )}

              <Field label={t.gender}>
                <select
                  value={form.gender}
                  onChange={(event) =>
                    update("gender", event.target.value as Gender)
                  }
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="not_specified">{t.notSpecified}</option>
                  <option value="male">{t.male}</option>
                  <option value="female">{t.female}</option>
                </select>
              </Field>

              <Field label={t.dateOfBirth}>
                <Input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(event) =>
                    update("date_of_birth", event.target.value)
                  }
                  className="rounded-xl"
                />
              </Field>

              <Field label={t.nationalId}>
                <Input
                  value={form.national_id}
                  onChange={(event) =>
                    update("national_id", event.target.value)
                  }
                  className="rounded-xl"
                />
              </Field>

              <Field label={t.passportNumber}>
                <Input
                  value={form.passport_number}
                  onChange={(event) =>
                    update("passport_number", event.target.value)
                  }
                  className="rounded-xl"
                />
              </Field>

              <Field label={t.nationality} className="md:col-span-2">
                <Input
                  value={form.nationality}
                  onChange={(event) =>
                    update("nationality", event.target.value)
                  }
                  className="rounded-xl"
                />
              </Field>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Phone className="h-5 w-5" />
                {t.contactInfo}
              </CardTitle>
              <CardDescription>{t.contactInfoDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label={t.email}>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                  className="rounded-xl"
                  autoComplete="email"
                />
              </Field>

              <Field label={t.phone}>
                <Input
                  value={form.phone_number}
                  onChange={(event) =>
                    update("phone_number", event.target.value)
                  }
                  className="rounded-xl"
                  autoComplete="tel"
                />
              </Field>

              <Field label={t.whatsapp}>
                <Input
                  value={form.whatsapp_number}
                  onChange={(event) =>
                    update("whatsapp_number", event.target.value)
                  }
                  className="rounded-xl"
                  autoComplete="tel"
                />
              </Field>

              <Field label={t.alternativePhone}>
                <Input
                  value={form.alternative_phone_number}
                  onChange={(event) =>
                    update("alternative_phone_number", event.target.value)
                  }
                  className="rounded-xl"
                  autoComplete="tel"
                />
              </Field>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-5 w-5" />
                {t.addressInfo}
              </CardTitle>
              <CardDescription>{t.addressInfoDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label={t.country}>
                <Input
                  value={form.country}
                  onChange={(event) => update("country", event.target.value)}
                  className="rounded-xl"
                  autoComplete="country-name"
                />
              </Field>

              <Field label={t.city}>
                <Input
                  value={form.city}
                  onChange={(event) => update("city", event.target.value)}
                  className="rounded-xl"
                  autoComplete="address-level2"
                />
              </Field>

              <Field label={t.district}>
                <Input
                  value={form.district}
                  onChange={(event) => update("district", event.target.value)}
                  className="rounded-xl"
                  autoComplete="address-level3"
                />
              </Field>

              <Field label={t.postalCode}>
                <Input
                  value={form.postal_code}
                  onChange={(event) =>
                    update("postal_code", event.target.value)
                  }
                  className="rounded-xl"
                  autoComplete="postal-code"
                />
              </Field>

              <Field label={t.street} className="md:col-span-2">
                <Input
                  value={form.street_address}
                  onChange={(event) =>
                    update("street_address", event.target.value)
                  }
                  className="rounded-xl"
                  autoComplete="street-address"
                />
              </Field>

              <Field label={t.nationalAddress} className="md:col-span-2">
                <textarea
                  value={form.national_address_text}
                  onChange={(event) =>
                    update("national_address_text", event.target.value)
                  }
                  className="min-h-24 w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </Field>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UsersRound className="h-5 w-5" />
                {t.notesInfo}
              </CardTitle>
              <CardDescription>{t.notesInfoDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4">
              <Field label={t.tags}>
                <Input
                  value={form.tags}
                  onChange={(event) => update("tags", event.target.value)}
                  className="rounded-xl"
                />
              </Field>

              <Field label={t.notes}>
                <textarea
                  value={form.notes}
                  onChange={(event) => update("notes", event.target.value)}
                  className="min-h-32 w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </Field>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="rounded-2xl lg:sticky lg:top-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BadgeCheck className="h-5 w-5" />
                {t.customerSummary}
              </CardTitle>
              <CardDescription>{t.customerSummaryDesc}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">
                    {t.progress}
                  </span>
                  <span className="text-sm font-semibold">{completion}%</span>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${completion}%` }}
                  />
                </div>
              </div>

              <SummaryRow
                label={t.customerType}
                value={isCorporate ? t.corporate : t.individual}
              />

              <SummaryRow
                label={isCorporate ? t.companyName : t.firstName}
                value={
                  isCorporate
                    ? form.company_name || "-"
                    : `${form.first_name} ${form.last_name}`.trim() || "-"
                }
              />

              <SummaryRow
                label={t.contactInfo}
                value={
                  form.whatsapp_number || form.phone_number || form.email || "-"
                }
              />

              <SummaryRow label={t.city} value={form.city || "-"} />

              <SummaryRow
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
                <Button type="submit" disabled={isSaving} className="rounded-xl">
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
                  className="rounded-xl"
                >
                  {t.reset}
                </Button>

                <Button asChild variant="ghost" className="rounded-xl">
                  <Link href="/system/customers/list">{t.openList}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid gap-2 ${className}`}>
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}

function StepCard({
  active,
  icon: Icon,
  title,
  value,
}: {
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        active ? "bg-primary/5" : "bg-background"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            active ? "bg-primary text-primary-foreground" : "bg-muted"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border bg-background p-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[170px] truncate text-sm font-medium">{value}</span>
    </div>
  );
}