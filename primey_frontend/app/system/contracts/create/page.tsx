"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarRange,
  CheckCircle2,
  CreditCard,
  FileSignature,
  FileText,
  HandCoins,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Users,
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
import { Textarea } from "@/components/ui/textarea";

type AppLocale = "ar" | "en";

type ContractFormData = {
  contractNumber: string;
  contractTitle: string;
  centerName: string;
  providerName: string;
  contractType: string;
  startDate: string;
  endDate: string;
  renewalType: string;
  paymentTerms: string;
  commissionRate: string;
  contractValue: string;
  currency: string;
  serviceScope: string;
  includedServices: string;
  exclusions: string;
  notes: string;
};

type ContractFormErrors = Partial<Record<keyof ContractFormData, string>>;

function detectLocale(): AppLocale {
  return "ar";
}

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    pageTitle: isArabic ? "إضافة عقد جديد" : "Create New Contract",
    pageSubtitle: isArabic
      ? "هذه الصفحة مخصصة لإنشاء عقد جديد داخل النظام بنفس هوية Primey Care المعتمدة، مع تجهيز احترافي لمرحلة الربط اللاحقة مع الـ APIs والمراكز ومقدمي الخدمة وعناصر الخدمة."
      : "This page is designed to create a new contract inside the system using the approved Primey Care UI, with a professional foundation for later API, centers, providers, and service items integration.",

    heroBadge1: isArabic ? "System Module" : "System Module",
    heroBadge2: isArabic ? "Create Contract" : "Create Contract",

    backToContracts: isArabic ? "العودة إلى العقود" : "Back to Contracts",
    saveDraft: isArabic ? "حفظ مبدئي" : "Save Draft",
    createContract: isArabic ? "إنشاء العقد" : "Create Contract",

    basicInfo: isArabic ? "البيانات الأساسية" : "Basic Information",
    partiesInfo: isArabic ? "الأطراف والارتباطات" : "Parties & Relations",
    timelineInfo: isArabic ? "المدة والتجديد" : "Timeline & Renewal",
    financialInfo: isArabic ? "البيانات المالية" : "Financial Information",
    scopeInfo: isArabic ? "نطاق العقد والخدمات" : "Contract Scope & Services",
    quickGuide: isArabic ? "إرشادات سريعة" : "Quick Guide",
    createSummary: isArabic ? "ملخص الإنشاء" : "Creation Summary",

    contractNumber: isArabic ? "رقم العقد" : "Contract Number",
    contractTitle: isArabic ? "عنوان العقد" : "Contract Title",
    centerName: isArabic ? "المركز" : "Center",
    providerName: isArabic ? "مقدم الخدمة" : "Provider",
    contractType: isArabic ? "نوع العقد" : "Contract Type",
    startDate: isArabic ? "تاريخ البداية" : "Start Date",
    endDate: isArabic ? "تاريخ النهاية" : "End Date",
    renewalType: isArabic ? "نوع التجديد" : "Renewal Type",
    paymentTerms: isArabic ? "شروط الدفع" : "Payment Terms",
    commissionRate: isArabic ? "نسبة العمولة" : "Commission Rate",
    contractValue: isArabic ? "قيمة العقد" : "Contract Value",
    currency: isArabic ? "العملة" : "Currency",
    serviceScope: isArabic ? "نطاق الخدمة" : "Service Scope",
    includedServices: isArabic ? "الخدمات المشمولة" : "Included Services",
    exclusions: isArabic ? "الاستثناءات" : "Exclusions",
    notes: isArabic ? "ملاحظات" : "Notes",

    placeholders: {
      contractNumber: isArabic ? "مثال: CTR-2026-001" : "Example: CTR-2026-001",
      contractTitle: isArabic
        ? "مثال: عقد خدمات طبية سنوي"
        : "Example: Annual medical services contract",
      centerName: isArabic
        ? "مثال: Prime Care Jeddah"
        : "Example: Prime Care Jeddah",
      providerName: isArabic
        ? "مثال: Al Noor Medical"
        : "Example: Al Noor Medical",
      contractType: isArabic
        ? "مثال: سنوي / شهري / شراكة"
        : "Example: Annual / Monthly / Partnership",
      renewalType: isArabic
        ? "مثال: تلقائي / يدوي / بدون تجديد"
        : "Example: Auto / Manual / No renewal",
      paymentTerms: isArabic
        ? "مثال: شهري / ربع سنوي / عند الفاتورة"
        : "Example: Monthly / Quarterly / Per invoice",
      commissionRate: isArabic ? "مثال: 10" : "Example: 10",
      contractValue: isArabic ? "مثال: 50000" : "Example: 50000",
      currency: isArabic ? "SAR" : "SAR",
      serviceScope: isArabic
        ? "اكتب وصفًا مختصرًا لنطاق العقد"
        : "Write a short description for the contract scope",
      includedServices: isArabic
        ? "اكتب الخدمات المشمولة داخل العقد"
        : "Write the services included in the contract",
      exclusions: isArabic
        ? "اكتب الاستثناءات أو القيود"
        : "Write exclusions or limitations",
      notes: isArabic
        ? "أي ملاحظات إضافية عن العقد"
        : "Any additional notes about the contract",
    },

    tips: [
      isArabic
        ? "ابدأ الآن ببناء واجهة الإنشاء، والربط مع API سيتم لاحقًا بدون تغيير الهوية."
        : "Start with the create UI now; API integration can be added later without changing the visual identity.",
      isArabic
        ? "يفضل توحيد رقم العقد ونمط التواريخ والعملة من البداية لضمان اتساق التشغيل."
        : "Keep the contract number, date format, and currency standardized from the beginning.",
      isArabic
        ? "يمكن لاحقًا ربط العقد بالمركز، مقدم الخدمة، عناصر الخدمة، الفواتير، والمدفوعات بشكل كامل."
        : "Later you can fully connect the contract with the center, provider, service items, invoices, and payments.",
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
        value: isArabic
          ? "مراكز / مزودون / خدمات"
          : "Centers / Providers / Services",
        icon: Users,
      },
    ],

    sectionDescriptions: {
      basicInfo: isArabic
        ? "أدخل البيانات الأساسية للعقد التي سيتم اعتمادها داخل النظام."
        : "Enter the contract's essential information to be used across the system.",
      partiesInfo: isArabic
        ? "حدد الأطراف الرئيسية والارتباطات التشغيلية الخاصة بالعقد."
        : "Define the main parties and operational relations for the contract.",
      timelineInfo: isArabic
        ? "أدخل تواريخ العقد وآلية التجديد."
        : "Enter contract dates and renewal policy.",
      financialInfo: isArabic
        ? "أضف البيانات المالية الأساسية الخاصة بالعقد."
        : "Add the main financial information for the contract.",
      scopeInfo: isArabic
        ? "وضح نطاق العقد والخدمات والاستثناءات."
        : "Clarify contract scope, services, and exclusions.",
    },

    validation: {
      required: isArabic ? "هذا الحقل مطلوب" : "This field is required",
      invalidDate: isArabic ? "التاريخ غير صالح" : "Invalid date",
      invalidDateRange: isArabic
        ? "تاريخ النهاية يجب أن يكون بعد تاريخ البداية"
        : "End date must be after start date",
      invalidRate: isArabic ? "نسبة العمولة غير صحيحة" : "Invalid commission rate",
      invalidAmount: isArabic ? "قيمة العقد غير صحيحة" : "Invalid contract value",
    },

    successTitle: isArabic ? "تم تجهيز النموذج" : "Form prepared",
    successText: isArabic
      ? "واجهة إنشاء العقد جاهزة، وسيتم لاحقًا ربط زر الحفظ مع الـ API."
      : "The create contract UI is ready. The save action will be connected to the API later.",

    draftTitle: isArabic ? "تم حفظ القيم محليًا" : "Values prepared locally",
    draftText: isArabic
      ? "تم التحقق من الحقول الأساسية محليًا كنموذج أولي."
      : "Basic fields have been validated locally as a first draft.",

    requiredFields: isArabic ? "الحقول الأساسية" : "Required Fields",
  };
}

function isValidDate(value: string) {
  if (!value.trim()) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function isValidCommissionRate(value: string) {
  if (!value.trim()) return true;
  const numeric = Number(value);
  return !Number.isNaN(numeric) && numeric >= 0 && numeric <= 100;
}

function isValidAmount(value: string) {
  if (!value.trim()) return true;
  const numeric = Number(value);
  return !Number.isNaN(numeric) && numeric >= 0;
}

export default function SystemCreateContractPage() {
  const locale = detectLocale();
  const isArabic = locale === "ar";
  const t = dictionary(locale);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ContractFormData>({
    contractNumber: "",
    contractTitle: "",
    centerName: "",
    providerName: "",
    contractType: "",
    startDate: "",
    endDate: "",
    renewalType: "",
    paymentTerms: "",
    commissionRate: "",
    contractValue: "",
    currency: "SAR",
    serviceScope: "",
    includedServices: "",
    exclusions: "",
    notes: "",
  });
  const [errors, setErrors] = useState<ContractFormErrors>({});

  const completionStats = useMemo(() => {
    const values = Object.values(formData);
    const filled = values.filter((value) => value.trim().length > 0).length;
    const total = values.length;
    const percent = Math.round((filled / total) * 100);
    return { filled, total, percent };
  }, [formData]);

  function setField<K extends keyof ContractFormData>(
    key: K,
    value: ContractFormData[K]
  ) {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validateForm() {
    const nextErrors: ContractFormErrors = {};

    if (!formData.contractNumber.trim()) {
      nextErrors.contractNumber = t.validation.required;
    }

    if (!formData.contractTitle.trim()) {
      nextErrors.contractTitle = t.validation.required;
    }

    if (!formData.centerName.trim()) {
      nextErrors.centerName = t.validation.required;
    }

    if (!formData.providerName.trim()) {
      nextErrors.providerName = t.validation.required;
    }

    if (!formData.startDate.trim()) {
      nextErrors.startDate = t.validation.required;
    } else if (!isValidDate(formData.startDate)) {
      nextErrors.startDate = t.validation.invalidDate;
    }

    if (!formData.endDate.trim()) {
      nextErrors.endDate = t.validation.required;
    } else if (!isValidDate(formData.endDate)) {
      nextErrors.endDate = t.validation.invalidDate;
    }

    if (
      formData.startDate.trim() &&
      formData.endDate.trim() &&
      isValidDate(formData.startDate) &&
      isValidDate(formData.endDate)
    ) {
      const start = new Date(formData.startDate).getTime();
      const end = new Date(formData.endDate).getTime();
      if (end < start) {
        nextErrors.endDate = t.validation.invalidDateRange;
      }
    }

    if (
      formData.commissionRate.trim() &&
      !isValidCommissionRate(formData.commissionRate)
    ) {
      nextErrors.commissionRate = t.validation.invalidRate;
    }

    if (formData.contractValue.trim() && !isValidAmount(formData.contractValue)) {
      nextErrors.contractValue = t.validation.invalidAmount;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSaveDraft() {
    const valid = validateForm();

    if (!valid) {
      toast.error(t.validation.required);
      return;
    }

    toast.success(t.draftTitle, {
      description: t.draftText,
    });
  }

  async function handleSubmit() {
    const valid = validateForm();

    if (!valid) {
      toast.error(t.validation.required);
      return;
    }

    try {
      setIsSubmitting(true);

      await new Promise((resolve) => setTimeout(resolve, 700));

      toast.success(t.successTitle, {
        description: t.successText,
      });
    } catch {
      toast.error(isArabic ? "حدث خطأ غير متوقع" : "Unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
        <CardContent className="p-0">
          <div className="grid gap-0 xl:grid-cols-[1.3fr_0.7fr]">
            <div className="space-y-6 p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {t.heroBadge1}
                </Badge>
                <Badge className="rounded-full px-3 py-1">{t.heroBadge2}</Badge>
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                  {t.pageTitle}
                </h1>
                <p className="text-muted-foreground max-w-3xl leading-8">
                  {t.pageSubtitle}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/system/contracts" className="w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-2xl sm:w-auto"
                  >
                    <ArrowLeft className="ms-2 h-4 w-4" />
                    {t.backToContracts}
                  </Button>
                </Link>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-2xl sm:w-auto"
                  onClick={handleSaveDraft}
                >
                  <Save className="ms-2 h-4 w-4" />
                  {t.saveDraft}
                </Button>

                <Button
                  type="button"
                  className="w-full rounded-2xl sm:w-auto"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="ms-2 h-4 w-4" />
                  )}
                  {t.createContract}
                </Button>
              </div>
            </div>

            <Card className="rounded-none border-0 bg-transparent shadow-none">
              <CardHeader className="pb-3 pt-6 md:pt-8">
                <CardTitle className="text-base">{t.createSummary}</CardTitle>
                <CardDescription>
                  {isArabic
                    ? "ملخص سريع عن جاهزية النموذج الحالي."
                    : "Quick summary about the current form readiness."}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 px-6 pb-6 md:px-8 md:pb-8">
                <div className="rounded-2xl border border-white/20 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold">{t.requiredFields}</p>
                    <Badge variant="secondary" className="rounded-full">
                      {completionStats.filled}/{completionStats.total}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs leading-6">
                    {isArabic
                      ? "يشمل ذلك رقم العقد، الأطراف الأساسية، التواريخ، والبيانات القابلة للربط لاحقًا."
                      : "This includes the contract number, core parties, dates, and fields that will later be connected."}
                  </p>
                </div>

                {t.summaryItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.label}
                      className="flex items-start gap-3 rounded-2xl border border-white/20 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-xs">
                          {item.label}
                        </p>
                        <p className="mt-1 text-sm font-semibold">{item.value}</p>
                      </div>
                    </div>
                  );
                })}
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
              <CardDescription>{t.sectionDescriptions.basicInfo}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contractNumber">{t.contractNumber}</Label>
                <Input
                  id="contractNumber"
                  value={formData.contractNumber}
                  onChange={(e) => setField("contractNumber", e.target.value)}
                  placeholder={t.placeholders.contractNumber}
                  className="rounded-2xl"
                />
                {errors.contractNumber ? (
                  <p className="text-sm text-red-500">{errors.contractNumber}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contractTitle">{t.contractTitle}</Label>
                <Input
                  id="contractTitle"
                  value={formData.contractTitle}
                  onChange={(e) => setField("contractTitle", e.target.value)}
                  placeholder={t.placeholders.contractTitle}
                  className="rounded-2xl"
                />
                {errors.contractTitle ? (
                  <p className="text-sm text-red-500">{errors.contractTitle}</p>
                ) : null}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="contractType">{t.contractType}</Label>
                <Input
                  id="contractType"
                  value={formData.contractType}
                  onChange={(e) => setField("contractType", e.target.value)}
                  placeholder={t.placeholders.contractType}
                  className="rounded-2xl"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{t.partiesInfo}</CardTitle>
              <CardDescription>{t.sectionDescriptions.partiesInfo}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="centerName">{t.centerName}</Label>
                <Input
                  id="centerName"
                  value={formData.centerName}
                  onChange={(e) => setField("centerName", e.target.value)}
                  placeholder={t.placeholders.centerName}
                  className="rounded-2xl"
                />
                {errors.centerName ? (
                  <p className="text-sm text-red-500">{errors.centerName}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="providerName">{t.providerName}</Label>
                <Input
                  id="providerName"
                  value={formData.providerName}
                  onChange={(e) => setField("providerName", e.target.value)}
                  placeholder={t.placeholders.providerName}
                  className="rounded-2xl"
                />
                {errors.providerName ? (
                  <p className="text-sm text-red-500">{errors.providerName}</p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{t.timelineInfo}</CardTitle>
              <CardDescription>{t.sectionDescriptions.timelineInfo}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">{t.startDate}</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setField("startDate", e.target.value)}
                  className="rounded-2xl"
                />
                {errors.startDate ? (
                  <p className="text-sm text-red-500">{errors.startDate}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">{t.endDate}</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setField("endDate", e.target.value)}
                  className="rounded-2xl"
                />
                {errors.endDate ? (
                  <p className="text-sm text-red-500">{errors.endDate}</p>
                ) : null}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="renewalType">{t.renewalType}</Label>
                <Input
                  id="renewalType"
                  value={formData.renewalType}
                  onChange={(e) => setField("renewalType", e.target.value)}
                  placeholder={t.placeholders.renewalType}
                  className="rounded-2xl"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{t.financialInfo}</CardTitle>
              <CardDescription>{t.sectionDescriptions.financialInfo}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="paymentTerms">{t.paymentTerms}</Label>
                <Input
                  id="paymentTerms"
                  value={formData.paymentTerms}
                  onChange={(e) => setField("paymentTerms", e.target.value)}
                  placeholder={t.placeholders.paymentTerms}
                  className="rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="commissionRate">{t.commissionRate}</Label>
                <Input
                  id="commissionRate"
                  value={formData.commissionRate}
                  onChange={(e) => setField("commissionRate", e.target.value)}
                  placeholder={t.placeholders.commissionRate}
                  className="rounded-2xl"
                />
                {errors.commissionRate ? (
                  <p className="text-sm text-red-500">{errors.commissionRate}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contractValue">{t.contractValue}</Label>
                <Input
                  id="contractValue"
                  value={formData.contractValue}
                  onChange={(e) => setField("contractValue", e.target.value)}
                  placeholder={t.placeholders.contractValue}
                  className="rounded-2xl"
                />
                {errors.contractValue ? (
                  <p className="text-sm text-red-500">{errors.contractValue}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">{t.currency}</Label>
                <Input
                  id="currency"
                  value={formData.currency}
                  onChange={(e) => setField("currency", e.target.value)}
                  placeholder={t.placeholders.currency}
                  className="rounded-2xl"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{t.scopeInfo}</CardTitle>
              <CardDescription>{t.sectionDescriptions.scopeInfo}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-5">
              <div className="space-y-2">
                <Label htmlFor="serviceScope">{t.serviceScope}</Label>
                <Textarea
                  id="serviceScope"
                  value={formData.serviceScope}
                  onChange={(e) => setField("serviceScope", e.target.value)}
                  placeholder={t.placeholders.serviceScope}
                  className="min-h-[110px] rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="includedServices">{t.includedServices}</Label>
                <Textarea
                  id="includedServices"
                  value={formData.includedServices}
                  onChange={(e) => setField("includedServices", e.target.value)}
                  placeholder={t.placeholders.includedServices}
                  className="min-h-[120px] rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="exclusions">{t.exclusions}</Label>
                <Textarea
                  id="exclusions"
                  value={formData.exclusions}
                  onChange={(e) => setField("exclusions", e.target.value)}
                  placeholder={t.placeholders.exclusions}
                  className="min-h-[110px] rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">{t.notes}</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  placeholder={t.placeholders.notes}
                  className="min-h-[120px] rounded-2xl"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{t.quickGuide}</CardTitle>
              <CardDescription>
                {isArabic
                  ? "ملاحظات تشغيلية سريعة قبل ربط الصفحة فعليًا."
                  : "Quick operational notes before connecting the page for real."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {t.tips.map((tip, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 rounded-2xl border border-white/20 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5"
                >
                  <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
                    {index === 0 ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : index === 1 ? (
                      <CalendarRange className="h-4 w-4" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </div>
                  <p className="text-sm leading-7">{tip}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle>
                {isArabic ? "مؤشرات النموذج" : "Form Indicators"}
              </CardTitle>
              <CardDescription>
                {isArabic
                  ? "متابعة سريعة للحقول الرئيسية داخل الصفحة."
                  : "Quick tracking for the main fields in this page."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-white/20 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-2xl">
                    <FileSignature className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">
                      {isArabic ? "اكتمال النموذج" : "Form completion"}
                    </p>
                    <p className="text-sm font-semibold">
                      {completionStats.percent}%
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="rounded-full">
                  {completionStats.filled}/{completionStats.total}
                </Badge>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-white/20 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-2xl">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t.centerName}</p>
                    <p className="text-sm font-semibold">
                      {formData.centerName || (isArabic ? "غير مدخل" : "Not entered")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-white/20 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-2xl">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t.providerName}</p>
                    <p className="text-sm font-semibold">
                      {formData.providerName || (isArabic ? "غير مدخل" : "Not entered")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-white/20 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-2xl">
                    <CalendarRange className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t.startDate}</p>
                    <p className="text-sm font-semibold">
                      {formData.startDate || (isArabic ? "غير مدخل" : "Not entered")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-white/20 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-2xl">
                    <HandCoins className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t.contractValue}</p>
                    <p className="text-sm font-semibold">
                      {formData.contractValue || (isArabic ? "غير مدخل" : "Not entered")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-white/30 bg-black/5 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-sm leading-7">
                  {isArabic
                    ? "تم اعتماد الصفحة لتعمل ضمن shell النظام الرسمي وباستخدام UI الداخلي فقط. عند ربط الـ API لاحقًا سيتم فقط توصيل الحفظ الفعلي دون تغيير التصميم."
                    : "This page is aligned with the official system shell and uses only the internal UI. When the API is connected later, only the save action will be wired without changing the design."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{isArabic ? "روابط سريعة" : "Quick Links"}</CardTitle>
              <CardDescription>
                {isArabic
                  ? "تنقل سريع داخل نفس موديول العقود."
                  : "Quick navigation within the contracts module."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              <Link href="/system/contracts" className="block">
                <Button variant="outline" className="w-full rounded-2xl">
                  <ArrowLeft className="ms-2 h-4 w-4" />
                  {t.backToContracts}
                </Button>
              </Link>

              <Link href="/system/contracts" className="block">
                <Button variant="outline" className="w-full rounded-2xl">
                  <FileText className="ms-2 h-4 w-4" />
                  {isArabic ? "قائمة العقود" : "Contracts List"}
                </Button>
              </Link>

              <Link href="/system" className="block">
                <Button variant="outline" className="w-full rounded-2xl">
                  <CreditCard className="ms-2 h-4 w-4" />
                  {isArabic
                    ? "العودة إلى لوحة النظام"
                    : "Back to System Dashboard"}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}