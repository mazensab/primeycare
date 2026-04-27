"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Tag,
  UserRound,
  Wallet,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AppLocale = "ar" | "en";

type ProviderFormData = {
  providerNameAr: string;
  providerNameEn: string;
  providerCode: string;
  providerType: string;
  specialty: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  website: string;
  taxNumber: string;
  iban: string;
  contractStatus: string;
  notes: string;
};

type ProviderFormErrors = Partial<Record<keyof ProviderFormData, string>>;

function detectLocale(): AppLocale {
  if (typeof document !== "undefined") {
    const htmlLang = document.documentElement.lang?.toLowerCase();
    if (htmlLang.startsWith("en")) return "en";
  }

  return "ar";
}

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    pageTitle: isArabic ? "إضافة مقدم خدمة جديد" : "Create New Provider",
    pageSubtitle: isArabic
      ? "واجهة إنشاء احترافية داخل مساحة system لإضافة مقدم خدمة جديد بنفس الهوية الرسمية المعتمدة في Primey Care، ومهيأة للربط اللاحق مع الـ API والعقود والخدمات."
      : "A professional create interface inside the system workspace for adding a new provider using the official Primey Care identity, prepared for later API, contract, and service integration.",

    heroBadge1: isArabic ? "System Workspace" : "System Workspace",
    heroBadge2: isArabic ? "Create Provider" : "Create Provider",

    backToProviders: isArabic ? "العودة إلى مقدمي الخدمة" : "Back to Providers",
    saveDraft: isArabic ? "حفظ مبدئي" : "Save Draft",
    createProvider: isArabic ? "إنشاء مقدم الخدمة" : "Create Provider",

    basicInfo: isArabic ? "البيانات الأساسية" : "Basic Information",
    contactInfo: isArabic ? "بيانات التواصل" : "Contact Information",
    operationalInfo: isArabic
      ? "البيانات التشغيلية والمالية"
      : "Operational & Financial Information",
    quickGuide: isArabic ? "إرشادات سريعة" : "Quick Guide",
    createSummary: isArabic ? "ملخص الإنشاء" : "Creation Summary",

    providerNameAr: isArabic
      ? "اسم مقدم الخدمة بالعربية"
      : "Provider Name (Arabic)",
    providerNameEn: isArabic
      ? "اسم مقدم الخدمة بالإنجليزية"
      : "Provider Name (English)",
    providerCode: isArabic ? "كود المزود" : "Provider Code",
    providerType: isArabic ? "نوع المزود" : "Provider Type",
    specialty: isArabic ? "التخصص" : "Specialty",
    contactPerson: isArabic ? "الشخص المسؤول" : "Contact Person",
    phone: isArabic ? "رقم الجوال" : "Phone Number",
    email: isArabic ? "البريد الإلكتروني" : "Email Address",
    city: isArabic ? "المدينة" : "City",
    address: isArabic ? "العنوان" : "Address",
    website: isArabic ? "الموقع الإلكتروني" : "Website",
    taxNumber: isArabic ? "الرقم الضريبي" : "Tax Number",
    iban: isArabic ? "رقم الآيبان" : "IBAN",
    contractStatus: isArabic ? "حالة التعاقد" : "Contract Status",
    notes: isArabic ? "ملاحظات" : "Notes",

    placeholders: {
      providerNameAr: isArabic
        ? "مثال: مركز الرعاية الطبية"
        : "Example: Medical Care Center",
      providerNameEn: isArabic
        ? "Example: Medical Care Center"
        : "Example: Medical Care Center",
      providerCode: isArabic ? "مثال: PRV-001" : "Example: PRV-001",
      providerType: isArabic
        ? "مثال: مركز / مستشفى / عيادة"
        : "Example: Center / Hospital / Clinic",
      specialty: isArabic
        ? "مثال: أسنان / جلدية / عام"
        : "Example: Dental / Dermatology / General",
      contactPerson: isArabic
        ? "اسم الشخص المسؤول"
        : "Responsible person name",
      phone: isArabic ? "05xxxxxxxx" : "05xxxxxxxx",
      email: isArabic ? "provider@example.com" : "provider@example.com",
      city: isArabic ? "مثال: جدة" : "Example: Jeddah",
      address: isArabic ? "اكتب العنوان التفصيلي" : "Enter full address",
      website: isArabic ? "https://example.com" : "https://example.com",
      taxNumber: isArabic ? "أدخل الرقم الضريبي" : "Enter tax number",
      iban: isArabic ? "SAxxxxxxxxxxxxxxxxxxxxxx" : "SAxxxxxxxxxxxxxxxxxxxxxx",
      contractStatus: isArabic
        ? "مثال: نشط / بانتظار"
        : "Example: Active / Pending",
      notes: isArabic
        ? "أي ملاحظات إضافية عن المزود"
        : "Any additional notes about the provider",
    },

    tips: [
      isArabic
        ? "الصفحة الآن مهيأة بصريًا داخل shell النظام الرسمي، ويمكن ربط الحفظ الفعلي بالـ API لاحقًا دون كسر التصميم."
        : "The page is visually aligned with the official system shell, and real save integration can be added later without breaking the design.",
      isArabic
        ? "يفضل توحيد كود المزود ونوعه وتخصصه من البداية لضمان اتساق التشغيل داخل النظام."
        : "It is best to standardize provider code, type, and specialty from the start for operational consistency.",
      isArabic
        ? "سيتم لاحقًا ربط مقدم الخدمة بالعقود والخدمات والطلبات والفواتير والتقارير."
        : "Later, the provider will be linked with contracts, services, orders, invoices, and reporting.",
    ],

    summaryItems: [
      {
        label: isArabic ? "حالة الصفحة" : "Page Status",
        value: isArabic ? "جاهزة كبداية UI" : "Ready as UI base",
        icon: BadgeCheck,
      },
      {
        label: isArabic ? "الربط الخلفي" : "Backend Integration",
        value: isArabic ? "غير مربوط بعد" : "Not connected yet",
        icon: ShieldCheck,
      },
      {
        label: isArabic ? "المرحلة الحالية" : "Current Stage",
        value: isArabic ? "بناء واجهات النظام" : "System frontend build",
        icon: Sparkles,
      },
      {
        label: isArabic ? "الارتباط المستقبلي" : "Future Mapping",
        value: isArabic ? "عقود / خدمات / طلبات" : "Contracts / Services / Orders",
        icon: FileText,
      },
    ],

    sectionDescriptions: {
      basicInfo: isArabic
        ? "أدخل البيانات الأساسية المعتمدة لمقدم الخدمة داخل النظام."
        : "Enter the provider’s essential information used across the system.",
      contactInfo: isArabic
        ? "حدد بيانات التواصل الأساسية والمدينة والعنوان."
        : "Define the provider’s contact details, city, and address.",
      operationalInfo: isArabic
        ? "تهيئة البيانات التشغيلية والمالية وحالة التعاقد."
        : "Prepare operational, financial, and contract-related data.",
    },

    validation: {
      required: isArabic ? "هذا الحقل مطلوب" : "This field is required",
      invalidEmail: isArabic ? "صيغة البريد غير صحيحة" : "Invalid email format",
      invalidWebsite: isArabic ? "رابط الموقع غير صالح" : "Invalid website URL",
      invalidPhone: isArabic ? "رقم الجوال غير صالح" : "Invalid phone number",
      invalidIban: isArabic ? "رقم الآيبان غير صالح" : "Invalid IBAN",
    },

    successTitle: isArabic ? "تم تجهيز النموذج" : "Form prepared",
    successText: isArabic
      ? "واجهة إنشاء مقدم الخدمة جاهزة، وسيتم لاحقًا ربط زر الحفظ مع الـ API."
      : "The create provider UI is ready. The save action will be connected to the API later.",

    draftTitle: isArabic ? "تم حفظ القيم محليًا" : "Values prepared locally",
    draftText: isArabic
      ? "تم التحقق من الحقول الأساسية محليًا كنموذج أولي."
      : "Basic fields have been validated locally as a first draft.",

    requiredFields: isArabic ? "الحقول الأساسية" : "Required Fields",
    optionalFields: isArabic ? "حقول اختيارية" : "Optional Fields",
    completionLabel: isArabic ? "نسبة اكتمال النموذج" : "Form Completion",
    completionDesc: isArabic
      ? "ملخص سريع لحالة تعبئة النموذج."
      : "Quick summary for the form completion state.",
  };
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function isValidPhone(value: string) {
  const cleaned = value.replace(/[^\d+]/g, "");
  return cleaned.length >= 9;
}

function isValidIban(value: string) {
  if (!value.trim()) return true;
  const cleaned = value.replace(/\s+/g, "").toUpperCase();
  return cleaned.startsWith("SA") && cleaned.length >= 15;
}

export default function SystemCreateProviderPage() {
  const locale = detectLocale();
  const isArabic = locale === "ar";
  const t = dictionary(locale);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ProviderFormData>({
    providerNameAr: "",
    providerNameEn: "",
    providerCode: "",
    providerType: "",
    specialty: "",
    contactPerson: "",
    phone: "",
    email: "",
    city: "",
    address: "",
    website: "",
    taxNumber: "",
    iban: "",
    contractStatus: "",
    notes: "",
  });
  const [errors, setErrors] = useState<ProviderFormErrors>({});

  const completionStats = useMemo(() => {
    const values = Object.values(formData);
    const filled = values.filter((value) => value.trim().length > 0).length;
    const total = values.length;
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

  function validateForm() {
    const nextErrors: ProviderFormErrors = {};

    if (!formData.providerNameAr.trim()) {
      nextErrors.providerNameAr = t.validation.required;
    }
    if (!formData.providerNameEn.trim()) {
      nextErrors.providerNameEn = t.validation.required;
    }
    if (!formData.providerCode.trim()) {
      nextErrors.providerCode = t.validation.required;
    }
    if (!formData.providerType.trim()) {
      nextErrors.providerType = t.validation.required;
    }
    if (!formData.specialty.trim()) {
      nextErrors.specialty = t.validation.required;
    }
    if (!formData.contactPerson.trim()) {
      nextErrors.contactPerson = t.validation.required;
    }

    if (!formData.phone.trim()) {
      nextErrors.phone = t.validation.required;
    } else if (!isValidPhone(formData.phone.trim())) {
      nextErrors.phone = t.validation.invalidPhone;
    }

    if (!formData.email.trim()) {
      nextErrors.email = t.validation.required;
    } else if (!isValidEmail(formData.email.trim())) {
      nextErrors.email = t.validation.invalidEmail;
    }

    if (!formData.city.trim()) {
      nextErrors.city = t.validation.required;
    }
    if (!formData.address.trim()) {
      nextErrors.address = t.validation.required;
    }
    if (!formData.contractStatus.trim()) {
      nextErrors.contractStatus = t.validation.required;
    }

    if (formData.website.trim() && !isValidUrl(formData.website.trim())) {
      nextErrors.website = t.validation.invalidWebsite;
    }

    if (formData.iban.trim() && !isValidIban(formData.iban.trim())) {
      nextErrors.iban = t.validation.invalidIban;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(mode: "draft" | "create") {
    if (!validateForm()) {
      toast.error(
        isArabic
          ? "يرجى تصحيح الحقول المطلوبة أولًا"
          : "Please fix the required fields first"
      );
      return;
    }

    setIsSubmitting(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 700));

      if (mode === "draft") {
        toast.success(t.draftTitle, {
          description: t.draftText,
        });
      } else {
        toast.success(t.successTitle, {
          description: t.successText,
        });
      }
    } catch (error) {
      console.error("Create provider form error:", error);
      toast.error(
        isArabic ? "حدث خطأ غير متوقع" : "Unexpected error occurred"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-3xl border-white/20 bg-white/70 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <CardContent className="p-6 md:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr] lg:items-center">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full px-3 py-1">
                  {t.heroBadge1}
                </Badge>
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {t.heroBadge2}
                </Badge>
              </div>

              <div className="space-y-3">
                <h1 className="text-2xl font-bold tracking-tight md:text-4xl">
                  {t.pageTitle}
                </h1>
                <p className="text-muted-foreground max-w-3xl text-sm leading-7 md:text-base">
                  {t.pageSubtitle}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/system/providers"
                  className="w-full sm:w-auto"
                >
                  <Button
                    variant="outline"
                    className="w-full rounded-2xl sm:w-auto"
                  >
                    <ArrowLeft
                      className={`h-4 w-4 ${
                        isArabic ? "ms-2" : "me-2 rotate-180"
                      }`}
                    />
                    {t.backToProviders}
                  </Button>
                </Link>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-2xl sm:w-auto"
                  onClick={() => handleSubmit("draft")}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="ms-2 h-4 w-4" />
                  )}
                  {t.saveDraft}
                </Button>

                <Button
                  type="button"
                  className="w-full rounded-2xl sm:w-auto"
                  onClick={() => handleSubmit("create")}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="ms-2 h-4 w-4" />
                  )}
                  {t.createProvider}
                </Button>
              </div>
            </div>

            <Card className="rounded-3xl border-white/20 bg-white/75 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t.createSummary}</CardTitle>
                <CardDescription>{t.completionDesc}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                {t.summaryItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.label}
                      className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-2xl">
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0">
                        <p className="text-muted-foreground text-xs">
                          {item.label}
                        </p>
                        <p className="truncate text-sm font-semibold">
                          {item.value}
                        </p>
                      </div>
                    </div>
                  );
                })}

                <div className="rounded-2xl border border-dashed border-white/30 bg-black/5 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{t.completionLabel}</p>
                    <Badge className="rounded-full px-3 py-1">
                      {completionStats.percent}%
                    </Badge>
                  </div>

                  <div className="mb-3 h-2.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-300"
                      style={{ width: `${completionStats.percent}%` }}
                    />
                  </div>

                  <p className="text-muted-foreground text-sm leading-7">
                    {isArabic
                      ? `تمت تعبئة ${completionStats.filled} من أصل ${completionStats.total} حقول.`
                      : `${completionStats.filled} out of ${completionStats.total} fields are completed.`}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{t.basicInfo}</CardTitle>
              <CardDescription>
                {t.sectionDescriptions.basicInfo}
              </CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="providerNameAr">{t.providerNameAr}</Label>
                <div className="relative">
                  <Building2
                    className={`text-muted-foreground absolute top-1/2 h-4 w-4 -translate-y-1/2 ${
                      isArabic ? "right-3" : "left-3"
                    }`}
                  />
                  <Input
                    id="providerNameAr"
                    value={formData.providerNameAr}
                    onChange={(e) =>
                      setField("providerNameAr", e.target.value)
                    }
                    placeholder={t.placeholders.providerNameAr}
                    className={`rounded-2xl ${isArabic ? "pr-10" : "pl-10"}`}
                  />
                </div>
                {errors.providerNameAr ? (
                  <p className="text-sm text-red-500">
                    {errors.providerNameAr}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="providerNameEn">{t.providerNameEn}</Label>
                <div className="relative">
                  <Building2
                    className={`text-muted-foreground absolute top-1/2 h-4 w-4 -translate-y-1/2 ${
                      isArabic ? "right-3" : "left-3"
                    }`}
                  />
                  <Input
                    id="providerNameEn"
                    value={formData.providerNameEn}
                    onChange={(e) =>
                      setField("providerNameEn", e.target.value)
                    }
                    placeholder={t.placeholders.providerNameEn}
                    className={`rounded-2xl ${isArabic ? "pr-10" : "pl-10"}`}
                  />
                </div>
                {errors.providerNameEn ? (
                  <p className="text-sm text-red-500">
                    {errors.providerNameEn}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="providerCode">{t.providerCode}</Label>
                <div className="relative">
                  <Tag
                    className={`text-muted-foreground absolute top-1/2 h-4 w-4 -translate-y-1/2 ${
                      isArabic ? "right-3" : "left-3"
                    }`}
                  />
                  <Input
                    id="providerCode"
                    value={formData.providerCode}
                    onChange={(e) =>
                      setField("providerCode", e.target.value.toUpperCase())
                    }
                    placeholder={t.placeholders.providerCode}
                    className={`rounded-2xl ${isArabic ? "pr-10" : "pl-10"}`}
                  />
                </div>
                {errors.providerCode ? (
                  <p className="text-sm text-red-500">
                    {errors.providerCode}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="providerType">{t.providerType}</Label>
                <Input
                  id="providerType"
                  value={formData.providerType}
                  onChange={(e) => setField("providerType", e.target.value)}
                  placeholder={t.placeholders.providerType}
                  className="rounded-2xl"
                />
                {errors.providerType ? (
                  <p className="text-sm text-red-500">
                    {errors.providerType}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="specialty">{t.specialty}</Label>
                <div className="relative">
                  <Stethoscope
                    className={`text-muted-foreground absolute top-1/2 h-4 w-4 -translate-y-1/2 ${
                      isArabic ? "right-3" : "left-3"
                    }`}
                  />
                  <Input
                    id="specialty"
                    value={formData.specialty}
                    onChange={(e) => setField("specialty", e.target.value)}
                    placeholder={t.placeholders.specialty}
                    className={`rounded-2xl ${isArabic ? "pr-10" : "pl-10"}`}
                  />
                </div>
                {errors.specialty ? (
                  <p className="text-sm text-red-500">{errors.specialty}</p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{t.contactInfo}</CardTitle>
              <CardDescription>
                {t.sectionDescriptions.contactInfo}
              </CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contactPerson">{t.contactPerson}</Label>
                <div className="relative">
                  <UserRound
                    className={`text-muted-foreground absolute top-1/2 h-4 w-4 -translate-y-1/2 ${
                      isArabic ? "right-3" : "left-3"
                    }`}
                  />
                  <Input
                    id="contactPerson"
                    value={formData.contactPerson}
                    onChange={(e) =>
                      setField("contactPerson", e.target.value)
                    }
                    placeholder={t.placeholders.contactPerson}
                    className={`rounded-2xl ${isArabic ? "pr-10" : "pl-10"}`}
                  />
                </div>
                {errors.contactPerson ? (
                  <p className="text-sm text-red-500">
                    {errors.contactPerson}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{t.phone}</Label>
                <div className="relative">
                  <Phone
                    className={`text-muted-foreground absolute top-1/2 h-4 w-4 -translate-y-1/2 ${
                      isArabic ? "right-3" : "left-3"
                    }`}
                  />
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    placeholder={t.placeholders.phone}
                    className={`rounded-2xl ${isArabic ? "pr-10" : "pl-10"}`}
                  />
                </div>
                {errors.phone ? (
                  <p className="text-sm text-red-500">{errors.phone}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t.email}</Label>
                <div className="relative">
                  <Mail
                    className={`text-muted-foreground absolute top-1/2 h-4 w-4 -translate-y-1/2 ${
                      isArabic ? "right-3" : "left-3"
                    }`}
                  />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setField("email", e.target.value)}
                    placeholder={t.placeholders.email}
                    className={`rounded-2xl ${isArabic ? "pr-10" : "pl-10"}`}
                  />
                </div>
                {errors.email ? (
                  <p className="text-sm text-red-500">{errors.email}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">{t.city}</Label>
                <div className="relative">
                  <MapPin
                    className={`text-muted-foreground absolute top-1/2 h-4 w-4 -translate-y-1/2 ${
                      isArabic ? "right-3" : "left-3"
                    }`}
                  />
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setField("city", e.target.value)}
                    placeholder={t.placeholders.city}
                    className={`rounded-2xl ${isArabic ? "pr-10" : "pl-10"}`}
                  />
                </div>
                {errors.city ? (
                  <p className="text-sm text-red-500">{errors.city}</p>
                ) : null}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">{t.address}</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setField("address", e.target.value)}
                  placeholder={t.placeholders.address}
                  className="rounded-2xl"
                />
                {errors.address ? (
                  <p className="text-sm text-red-500">{errors.address}</p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{t.operationalInfo}</CardTitle>
              <CardDescription>
                {t.sectionDescriptions.operationalInfo}
              </CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="website">{t.website}</Label>
                <div className="relative">
                  <Globe
                    className={`text-muted-foreground absolute top-1/2 h-4 w-4 -translate-y-1/2 ${
                      isArabic ? "right-3" : "left-3"
                    }`}
                  />
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => setField("website", e.target.value)}
                    placeholder={t.placeholders.website}
                    className={`rounded-2xl ${isArabic ? "pr-10" : "pl-10"}`}
                  />
                </div>
                {errors.website ? (
                  <p className="text-sm text-red-500">{errors.website}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxNumber">{t.taxNumber}</Label>
                <Input
                  id="taxNumber"
                  value={formData.taxNumber}
                  onChange={(e) => setField("taxNumber", e.target.value)}
                  placeholder={t.placeholders.taxNumber}
                  className="rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="iban">{t.iban}</Label>
                <div className="relative">
                  <Wallet
                    className={`text-muted-foreground absolute top-1/2 h-4 w-4 -translate-y-1/2 ${
                      isArabic ? "right-3" : "left-3"
                    }`}
                  />
                  <Input
                    id="iban"
                    value={formData.iban}
                    onChange={(e) =>
                      setField("iban", e.target.value.toUpperCase())
                    }
                    placeholder={t.placeholders.iban}
                    className={`rounded-2xl ${isArabic ? "pr-10" : "pl-10"}`}
                  />
                </div>
                {errors.iban ? (
                  <p className="text-sm text-red-500">{errors.iban}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contractStatus">{t.contractStatus}</Label>
                <Input
                  id="contractStatus"
                  value={formData.contractStatus}
                  onChange={(e) =>
                    setField("contractStatus", e.target.value)
                  }
                  placeholder={t.placeholders.contractStatus}
                  className="rounded-2xl"
                />
                {errors.contractStatus ? (
                  <p className="text-sm text-red-500">
                    {errors.contractStatus}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">{t.notes}</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  placeholder={t.placeholders.notes}
                  className="rounded-2xl"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                className="w-full rounded-2xl sm:w-auto"
                onClick={() => handleSubmit("create")}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="ms-2 h-4 w-4" />
                )}
                {t.createProvider}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full rounded-2xl sm:w-auto"
                onClick={() => handleSubmit("draft")}
                disabled={isSubmitting}
              >
                <Save className="ms-2 h-4 w-4" />
                {t.saveDraft}
              </Button>

              <Link
                href="/system/providers"
                className="w-full sm:w-auto"
              >
                <Button
                  variant="outline"
                  className="w-full rounded-2xl sm:w-auto"
                >
                  <ArrowLeft
                    className={`h-4 w-4 ${
                      isArabic ? "ms-2" : "me-2 rotate-180"
                    }`}
                  />
                  {t.backToProviders}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{t.quickGuide}</CardTitle>
              <CardDescription>
                {isArabic
                  ? "دليل سريع قبل ربط النموذج مع واجهة الـ API."
                  : "A quick guide before connecting this form to the API."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {t.tips.map((tip, index) => (
                <div
                  key={`${tip}-${index}`}
                  className="flex items-start gap-3 rounded-2xl border border-white/20 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5"
                >
                  <div className="bg-primary/10 text-primary mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <p className="text-sm leading-7">{tip}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{t.requiredFields}</CardTitle>
              <CardDescription>
                {isArabic
                  ? "هذه الحقول مطلوبة في النسخة الحالية."
                  : "These fields are required in the current version."}
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-wrap gap-2">
              {[
                t.providerNameAr,
                t.providerNameEn,
                t.providerCode,
                t.providerType,
                t.specialty,
                t.contactPerson,
                t.phone,
                t.email,
                t.city,
                t.address,
                t.contractStatus,
              ].map((item) => (
                <Badge
                  key={item}
                  variant="secondary"
                  className="rounded-full px-3 py-1"
                >
                  {item}
                </Badge>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{t.optionalFields}</CardTitle>
              <CardDescription>
                {isArabic
                  ? "يمكن ربط هذه الحقول لاحقًا أو تركها فارغة."
                  : "These fields can stay optional for now."}
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-wrap gap-2">
              {[t.website, t.taxNumber, t.iban, t.notes].map((item) => (
                <Badge key={item} className="rounded-full px-3 py-1">
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