"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarRange,
  FileSignature,
  HandCoins,
  Landmark,
  Loader2,
  PlusCircle,
  Save,
  ShieldCheck,
  Sparkles,
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
import { Textarea } from "@/components/ui/textarea";

/* ============================================================
   📂 app/system/contracts/create/page.tsx
   🧾 Primey Care | Create Contract
   ------------------------------------------------------------
   ✅ صفحة إنشاء عقد بنفس نمط إنشاء المراكز / العملاء / المندوبين
   ✅ استخدام UI الداخلي فقط
   ✅ نموذج منظم على بطاقات
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ الأرقام دائمًا إنجليزية
   ✅ استخدام sonner
   ✅ استخدام رمز SAR الرسمي
   ✅ ربط مع POST /api/contracts/
   ✅ ربط مقدمي الخدمة من /api/providers/
   ✅ بدون hardcoded localhost
============================================================ */

type AppLocale = "ar" | "en";

type ContractStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "DRAFT"
  | "PENDING"
  | "EXPIRED"
  | "TERMINATED"
  | "CANCELLED"
  | "SUSPENDED";

type ContractType =
  | "GENERAL"
  | "MEDICAL"
  | "SERVICE"
  | "PARTNERSHIP"
  | "DISCOUNT"
  | "SUPPLY"
  | "OTHER";

type ProviderOption = {
  id: number | string;
  name: string;
  code: string;
  city: string;
  status: string;
};

type ContractFormData = {
  contractNumber: string;
  title: string;
  providerId: string;
  contractType: ContractType;
  status: ContractStatus;
  startDate: string;
  endDate: string;
  contractValue: string;
  commissionRate: string;
  currency: string;
  paymentTerms: string;
  renewalTerms: string;
  terminationTerms: string;
  notes: string;
};

type ContractFormErrors = Partial<Record<keyof ContractFormData, string>>;

type ApiListResponse = {
  ok?: boolean;
  message?: string;
  results?: unknown[];
  data?: unknown[] | { results?: unknown[] };
  items?: unknown[];
  providers?: unknown[];
};

const SAR_ICON = "/currency/sar.svg";

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
   🔢 Helpers
============================================================ */

function formatEnglishMoney(value: number | string | null | undefined) {
  const numericValue = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
}

function normalizeNumberInput(value: string) {
  return value.replace(/[^\d.]/g, "");
}

function normalizePercentInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const numeric = Number(cleaned || 0);

  if (!Number.isFinite(numeric)) return "";
  if (numeric > 100) return "100";

  return cleaned;
}

function normalizeApiList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === "object") {
    const data = payload as ApiListResponse;

    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.providers)) return data.providers;
    if (Array.isArray(data.data)) return data.data;

    if (
      data.data &&
      typeof data.data === "object" &&
      Array.isArray((data.data as { results?: unknown[] }).results)
    ) {
      return (data.data as { results: unknown[] }).results;
    }
  }

  return [];
}

function readProviderName(value: Record<string, unknown>) {
  return String(
    value.name ??
      value.display_name ??
      value.provider_name ??
      value.center_name ??
      value.company_name ??
      value.title ??
      `Provider #${value.id ?? ""}`
  );
}

function normalizeProvider(item: unknown): ProviderOption {
  const obj = (item || {}) as Record<string, unknown>;

  return {
    id: (obj.id ?? "") as number | string,
    name: readProviderName(obj),
    code: String(obj.provider_code ?? obj.code ?? obj.center_code ?? ""),
    city: String(obj.city ?? ""),
    status: String(obj.status ?? ""),
  };
}

function buildContractNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const suffix = String(now.getTime()).slice(-5);

  return `CONT-${year}${month}${day}-${suffix}`;
}

/* ============================================================
   📚 Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "إنشاء عقد" : "Create Contract",
    subtitle: isArabic
      ? "إضافة عقد جديد وربطه بمقدم الخدمة مع بيانات الحالة، المدة، القيمة، وشروط العقد."
      : "Create a new contract and link it to a provider with status, duration, value, and terms.",

    back: isArabic ? "لوحة العقود" : "Contracts Overview",
    list: isArabic ? "قائمة العقود" : "Contracts List",
    saveDraft: isArabic ? "حفظ مسودة" : "Save Draft",
    create: isArabic ? "إنشاء العقد" : "Create Contract",

    basicInfo: isArabic ? "البيانات الأساسية" : "Basic Information",
    basicInfoDesc: isArabic
      ? "البيانات الرئيسية التي تميز العقد داخل النظام."
      : "Main data that identifies the contract inside the system.",

    providerInfo: isArabic ? "مقدم الخدمة" : "Provider",
    providerInfoDesc: isArabic
      ? "اختيار مقدم الخدمة المرتبط بهذا العقد."
      : "Choose the provider linked to this contract.",

    durationInfo: isArabic ? "مدة العقد" : "Contract Duration",
    durationInfoDesc: isArabic
      ? "تاريخ بداية ونهاية العقد."
      : "Contract start and end dates.",

    financialInfo: isArabic ? "البيانات المالية" : "Financial Information",
    financialInfoDesc: isArabic
      ? "قيمة العقد ونسبة العمولة والعملة."
      : "Contract value, commission rate, and currency.",

    termsInfo: isArabic ? "الشروط والملاحظات" : "Terms & Notes",
    termsInfoDesc: isArabic
      ? "شروط الدفع والتجديد والإنهاء والملاحظات الداخلية."
      : "Payment, renewal, termination terms, and internal notes.",

    contractNumber: isArabic ? "رقم العقد" : "Contract Number",
    contractNumberPlaceholder: isArabic
      ? "مثال: CONT-20260427-00001"
      : "Example: CONT-20260427-00001",

    contractTitle: isArabic ? "اسم العقد" : "Contract Title",
    contractTitlePlaceholder: isArabic
      ? "مثال: عقد خصومات مركز طبي"
      : "Example: Medical Center Discount Contract",

    contractType: isArabic ? "نوع العقد" : "Contract Type",
    status: isArabic ? "الحالة" : "Status",

    provider: isArabic ? "مقدم الخدمة" : "Provider",
    selectProvider: isArabic ? "اختر مقدم الخدمة" : "Select Provider",
    loadingProviders: isArabic
      ? "جاري تحميل مقدمي الخدمة..."
      : "Loading providers...",
    noProviders: isArabic
      ? "لا توجد مراكز/مقدمو خدمة متاحون"
      : "No providers available",

    startDate: isArabic ? "تاريخ البداية" : "Start Date",
    endDate: isArabic ? "تاريخ النهاية" : "End Date",

    contractValue: isArabic ? "قيمة العقد" : "Contract Value",
    commissionRate: isArabic ? "نسبة العمولة" : "Commission Rate",
    currency: isArabic ? "العملة" : "Currency",

    paymentTerms: isArabic ? "شروط الدفع" : "Payment Terms",
    paymentTermsPlaceholder: isArabic
      ? "اكتب شروط الدفع المتفق عليها..."
      : "Write agreed payment terms...",

    renewalTerms: isArabic ? "شروط التجديد" : "Renewal Terms",
    renewalTermsPlaceholder: isArabic
      ? "اكتب شروط التجديد إن وجدت..."
      : "Write renewal terms if available...",

    terminationTerms: isArabic ? "شروط الإنهاء" : "Termination Terms",
    terminationTermsPlaceholder: isArabic
      ? "اكتب شروط إنهاء العقد..."
      : "Write contract termination terms...",

    notes: isArabic ? "ملاحظات داخلية" : "Internal Notes",
    notesPlaceholder: isArabic
      ? "أي ملاحظات داخلية حول العقد..."
      : "Any internal notes about the contract...",

    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
    draft: isArabic ? "مسودة" : "Draft",
    pending: isArabic ? "معلق" : "Pending",
    suspended: isArabic ? "موقوف" : "Suspended",
    expired: isArabic ? "منتهي" : "Expired",
    terminated: isArabic ? "منهى" : "Terminated",
    cancelled: isArabic ? "ملغي" : "Cancelled",

    general: isArabic ? "عام" : "General",
    medical: isArabic ? "طبي" : "Medical",
    service: isArabic ? "خدمة" : "Service",
    partnership: isArabic ? "شراكة" : "Partnership",
    discount: isArabic ? "خصومات" : "Discount",
    supply: isArabic ? "توريد" : "Supply",
    other: isArabic ? "أخرى" : "Other",

    sar: isArabic ? "ريال سعودي" : "Saudi Riyal",

    required: isArabic ? "هذا الحقل مطلوب" : "This field is required",
    invalidNumber: isArabic ? "القيمة الرقمية غير صحيحة" : "Invalid numeric value",
    invalidDateRange: isArabic
      ? "تاريخ النهاية يجب أن يكون بعد تاريخ البداية"
      : "End date must be after start date",
    selectProviderError: isArabic
      ? "يجب اختيار مقدم الخدمة"
      : "Provider is required",

    createdSuccess: isArabic
      ? "تم إنشاء العقد بنجاح"
      : "Contract created successfully",
    draftSuccess: isArabic
      ? "تم حفظ العقد كمسودة"
      : "Contract saved as draft",
    createError: isArabic
      ? "تعذر إنشاء العقد"
      : "Failed to create contract",
    providersError: isArabic
      ? "تعذر تحميل مقدمي الخدمة"
      : "Failed to load providers",

    summaryTitle: isArabic ? "ملخص العقد" : "Contract Summary",
    summaryDesc: isArabic
      ? "مراجعة سريعة قبل حفظ العقد."
      : "Quick review before saving the contract.",
    selectedProvider: isArabic ? "مقدم الخدمة المحدد" : "Selected Provider",
    contractAmount: isArabic ? "قيمة العقد" : "Contract Amount",
    commissionPreview: isArabic ? "العمولة التقديرية" : "Estimated Commission",
    contractStatus: isArabic ? "حالة العقد" : "Contract Status",
  };
}

/* ============================================================
   🧾 Small Components
============================================================ */

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <p className="mt-1 text-xs font-medium text-destructive">{message}</p>;
}

function SarAmount({ amount }: { amount: number | string }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
      <Image
        src={SAR_ICON}
        alt="SAR"
        width={14}
        height={14}
        className="opacity-80"
      />
      {formatEnglishMoney(amount)}
    </span>
  );
}

/* ============================================================
   🧾 Page
============================================================ */

export default function SystemContractsCreatePage() {
  const router = useRouter();

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [errors, setErrors] = useState<ContractFormErrors>({});

  const [formData, setFormData] = useState<ContractFormData>({
    contractNumber: buildContractNumber(),
    title: "",
    providerId: "",
    contractType: "MEDICAL",
    status: "ACTIVE",
    startDate: "",
    endDate: "",
    contractValue: "",
    commissionRate: "",
    currency: "SAR",
    paymentTerms: "",
    renewalTerms: "",
    terminationTerms: "",
    notes: "",
  });

  const isArabic = locale === "ar";
  const t = dictionary(locale);

  useEffect(() => {
    const currentLocale = readLocale();
    setLocale(currentLocale);
    applyDocumentLocale(currentLocale);

    const syncLocale = () => {
      const nextLocale = readLocale();
      setLocale(nextLocale);
      applyDocumentLocale(nextLocale);
    };

    window.addEventListener("primey-locale-changed", syncLocale);
    window.addEventListener("storage", syncLocale);

    return () => {
      window.removeEventListener("primey-locale-changed", syncLocale);
      window.removeEventListener("storage", syncLocale);
    };
  }, []);

  async function loadProviders() {
    try {
      setIsLoadingProviders(true);

      const response = await fetch("/api/providers/?page_size=500", {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load providers.");
      }

      const items = normalizeApiList(payload)
        .map(normalizeProvider)
        .filter((provider) => provider.id);

      setProviders(items);
    } catch (error) {
      console.error("Load providers error:", error);
      toast.error(t.providersError);
      setProviders([]);
    } finally {
      setIsLoadingProviders(false);
    }
  }

  useEffect(() => {
    loadProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedProvider = useMemo(() => {
    return providers.find((provider) => String(provider.id) === formData.providerId);
  }, [providers, formData.providerId]);

  const commissionPreview = useMemo(() => {
    const amount = Number(formData.contractValue || 0);
    const rate = Number(formData.commissionRate || 0);

    if (!Number.isFinite(amount) || !Number.isFinite(rate)) return 0;

    return (amount * rate) / 100;
  }, [formData.contractValue, formData.commissionRate]);

  function updateField<K extends keyof ContractFormData>(
    key: K,
    value: ContractFormData[K]
  ) {
    setFormData((current) => ({
      ...current,
      [key]: value,
    }));

    setErrors((current) => ({
      ...current,
      [key]: undefined,
    }));
  }

  function validate(nextStatus?: ContractStatus) {
    const nextErrors: ContractFormErrors = {};
    const statusToValidate = nextStatus || formData.status;

    if (!formData.title.trim()) {
      nextErrors.title = t.required;
    }

    if (!formData.providerId) {
      nextErrors.providerId = t.selectProviderError;
    }

    if (statusToValidate !== "DRAFT") {
      if (!formData.startDate) {
        nextErrors.startDate = t.required;
      }

      if (!formData.endDate) {
        nextErrors.endDate = t.required;
      }
    }

    if (formData.startDate && formData.endDate) {
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);

      if (
        !Number.isNaN(startDate.getTime()) &&
        !Number.isNaN(endDate.getTime()) &&
        endDate < startDate
      ) {
        nextErrors.endDate = t.invalidDateRange;
      }
    }

    if (formData.contractValue && !Number.isFinite(Number(formData.contractValue))) {
      nextErrors.contractValue = t.invalidNumber;
    }

    if (
      formData.commissionRate &&
      !Number.isFinite(Number(formData.commissionRate))
    ) {
      nextErrors.commissionRate = t.invalidNumber;
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  function buildPayload(statusOverride?: ContractStatus) {
    const status = statusOverride || formData.status;

    return {
      contract_number: formData.contractNumber.trim(),
      title: formData.title.trim(),
      name: formData.title.trim(),
      provider_id: formData.providerId ? Number(formData.providerId) : null,
      contract_type: formData.contractType,
      type: formData.contractType,
      status,
      start_date: formData.startDate || null,
      end_date: formData.endDate || null,
      contract_value: formData.contractValue
        ? Number(formData.contractValue)
        : 0,
      value: formData.contractValue ? Number(formData.contractValue) : 0,
      commission_rate: formData.commissionRate
        ? Number(formData.commissionRate)
        : 0,
      currency: formData.currency || "SAR",
      payment_terms: formData.paymentTerms.trim(),
      renewal_terms: formData.renewalTerms.trim(),
      termination_terms: formData.terminationTerms.trim(),
      notes: formData.notes.trim(),
      description: formData.notes.trim(),
    };
  }

  async function submitContract(statusOverride?: ContractStatus) {
    const nextStatus = statusOverride || formData.status;

    if (!validate(nextStatus)) return;

    try {
      setIsSubmitting(true);

      const response = await fetch("/api/contracts/", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
        body: JSON.stringify(buildPayload(nextStatus)),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        const serverMessage =
          payload?.message ||
          payload?.errors?.join?.(", ") ||
          payload?.errors ||
          t.createError;

        throw new Error(String(serverMessage));
      }

      toast.success(nextStatus === "DRAFT" ? t.draftSuccess : t.createdSuccess);

      const createdId = payload?.data?.id || payload?.id;

      if (createdId) {
        router.push(`/system/contracts/${createdId}`);
      } else {
        router.push("/system/contracts/list");
      }

      router.refresh();
    } catch (error) {
      console.error("Create contract error:", error);
      toast.error(error instanceof Error ? error.message : t.createError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/80 p-6 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-sky-500/10" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link href="/system/contracts">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full bg-white/70 dark:bg-white/5"
                  >
                    <ArrowLeft className="me-2 h-4 w-4" />
                    {t.back}
                  </Button>
                </Link>

                <Badge className="rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                  <FileSignature className="me-1 h-3.5 w-3.5" />
                  {isArabic ? "وحدة العقود" : "Contracts Module"}
                </Badge>

                <Badge
                  variant="outline"
                  className="rounded-full bg-white/60 dark:bg-white/5"
                >
                  <ShieldCheck className="me-1 h-3.5 w-3.5" />
                  {isArabic ? "بيانات حقيقية" : "Live Data"}
                </Badge>
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {t.title}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
                  {t.subtitle}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link href="/system/contracts/list">
                <Button variant="outline" className="rounded-2xl bg-white/70 dark:bg-white/5">
                  <BadgeCheck className="me-2 h-4 w-4" />
                  {t.list}
                </Button>
              </Link>

              <Button
                variant="outline"
                className="rounded-2xl bg-white/70 dark:bg-white/5"
                disabled={isSubmitting}
                onClick={() => submitContract("DRAFT")}
              >
                {isSubmitting ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="me-2 h-4 w-4" />
                )}
                {t.saveDraft}
              </Button>

              <Button
                className="rounded-2xl shadow-lg"
                disabled={isSubmitting}
                onClick={() => submitContract()}
              >
                {isSubmitting ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlusCircle className="me-2 h-4 w-4" />
                )}
                {t.create}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-6">
            {/* Basic Info */}
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSignature className="h-5 w-5 text-primary" />
                  {t.basicInfo}
                </CardTitle>
                <CardDescription>{t.basicInfoDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contractNumber">{t.contractNumber}</Label>
                  <Input
                    id="contractNumber"
                    value={formData.contractNumber}
                    onChange={(event) =>
                      updateField("contractNumber", event.target.value)
                    }
                    placeholder={t.contractNumberPlaceholder}
                    className="rounded-2xl bg-white/80 dark:bg-white/5"
                  />
                  <FieldError message={errors.contractNumber} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">{t.contractTitle}</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(event) => updateField("title", event.target.value)}
                    placeholder={t.contractTitlePlaceholder}
                    className="rounded-2xl bg-white/80 dark:bg-white/5"
                  />
                  <FieldError message={errors.title} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contractType">{t.contractType}</Label>
                  <select
                    id="contractType"
                    value={formData.contractType}
                    onChange={(event) =>
                      updateField("contractType", event.target.value as ContractType)
                    }
                    className="h-10 w-full rounded-2xl border border-input bg-white/80 px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring dark:bg-white/5"
                  >
                    <option value="GENERAL">{t.general}</option>
                    <option value="MEDICAL">{t.medical}</option>
                    <option value="SERVICE">{t.service}</option>
                    <option value="PARTNERSHIP">{t.partnership}</option>
                    <option value="DISCOUNT">{t.discount}</option>
                    <option value="SUPPLY">{t.supply}</option>
                    <option value="OTHER">{t.other}</option>
                  </select>
                  <FieldError message={errors.contractType} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">{t.status}</Label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(event) =>
                      updateField("status", event.target.value as ContractStatus)
                    }
                    className="h-10 w-full rounded-2xl border border-input bg-white/80 px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring dark:bg-white/5"
                  >
                    <option value="ACTIVE">{t.active}</option>
                    <option value="DRAFT">{t.draft}</option>
                    <option value="PENDING">{t.pending}</option>
                    <option value="INACTIVE">{t.inactive}</option>
                    <option value="SUSPENDED">{t.suspended}</option>
                    <option value="EXPIRED">{t.expired}</option>
                    <option value="TERMINATED">{t.terminated}</option>
                    <option value="CANCELLED">{t.cancelled}</option>
                  </select>
                  <FieldError message={errors.status} />
                </div>
              </CardContent>
            </Card>

            {/* Provider */}
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  {t.providerInfo}
                </CardTitle>
                <CardDescription>{t.providerInfoDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="provider">{t.provider}</Label>
                  <select
                    id="provider"
                    value={formData.providerId}
                    onChange={(event) =>
                      updateField("providerId", event.target.value)
                    }
                    disabled={isLoadingProviders}
                    className="h-10 w-full rounded-2xl border border-input bg-white/80 px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white/5"
                  >
                    <option value="">
                      {isLoadingProviders ? t.loadingProviders : t.selectProvider}
                    </option>

                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                        {provider.code ? ` - ${provider.code}` : ""}
                        {provider.city ? ` - ${provider.city}` : ""}
                      </option>
                    ))}
                  </select>
                  <FieldError message={errors.providerId} />

                  {!isLoadingProviders && providers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t.noProviders}</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {/* Duration */}
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarRange className="h-5 w-5 text-primary" />
                  {t.durationInfo}
                </CardTitle>
                <CardDescription>{t.durationInfoDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="startDate">{t.startDate}</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(event) =>
                      updateField("startDate", event.target.value)
                    }
                    className="rounded-2xl bg-white/80 dark:bg-white/5"
                  />
                  <FieldError message={errors.startDate} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">{t.endDate}</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(event) => updateField("endDate", event.target.value)}
                    className="rounded-2xl bg-white/80 dark:bg-white/5"
                  />
                  <FieldError message={errors.endDate} />
                </div>
              </CardContent>
            </Card>

            {/* Financial */}
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  {t.financialInfo}
                </CardTitle>
                <CardDescription>{t.financialInfoDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-5 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="contractValue">{t.contractValue}</Label>
                  <div className="relative">
                    <Image
                      src={SAR_ICON}
                      alt="SAR"
                      width={16}
                      height={16}
                      className="absolute start-3 top-1/2 -translate-y-1/2 opacity-70"
                    />
                    <Input
                      id="contractValue"
                      inputMode="decimal"
                      value={formData.contractValue}
                      onChange={(event) =>
                        updateField(
                          "contractValue",
                          normalizeNumberInput(event.target.value)
                        )
                      }
                      placeholder="0.00"
                      className="rounded-2xl bg-white/80 ps-9 dark:bg-white/5"
                    />
                  </div>
                  <FieldError message={errors.contractValue} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="commissionRate">{t.commissionRate}</Label>
                  <div className="relative">
                    <HandCoins className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="commissionRate"
                      inputMode="decimal"
                      value={formData.commissionRate}
                      onChange={(event) =>
                        updateField(
                          "commissionRate",
                          normalizePercentInput(event.target.value)
                        )
                      }
                      placeholder="0"
                      className="rounded-2xl bg-white/80 ps-9 dark:bg-white/5"
                    />
                    <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      %
                    </span>
                  </div>
                  <FieldError message={errors.commissionRate} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">{t.currency}</Label>
                  <select
                    id="currency"
                    value={formData.currency}
                    onChange={(event) => updateField("currency", event.target.value)}
                    className="h-10 w-full rounded-2xl border border-input bg-white/80 px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring dark:bg-white/5"
                  >
                    <option value="SAR">{t.sar}</option>
                  </select>
                  <FieldError message={errors.currency} />
                </div>
              </CardContent>
            </Card>

            {/* Terms */}
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-primary" />
                  {t.termsInfo}
                </CardTitle>
                <CardDescription>{t.termsInfoDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-5">
                <div className="grid gap-5 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="paymentTerms">{t.paymentTerms}</Label>
                    <Textarea
                      id="paymentTerms"
                      value={formData.paymentTerms}
                      onChange={(event) =>
                        updateField("paymentTerms", event.target.value)
                      }
                      placeholder={t.paymentTermsPlaceholder}
                      className="min-h-28 rounded-2xl bg-white/80 dark:bg-white/5"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="renewalTerms">{t.renewalTerms}</Label>
                    <Textarea
                      id="renewalTerms"
                      value={formData.renewalTerms}
                      onChange={(event) =>
                        updateField("renewalTerms", event.target.value)
                      }
                      placeholder={t.renewalTermsPlaceholder}
                      className="min-h-28 rounded-2xl bg-white/80 dark:bg-white/5"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="terminationTerms">{t.terminationTerms}</Label>
                    <Textarea
                      id="terminationTerms"
                      value={formData.terminationTerms}
                      onChange={(event) =>
                        updateField("terminationTerms", event.target.value)
                      }
                      placeholder={t.terminationTermsPlaceholder}
                      className="min-h-28 rounded-2xl bg-white/80 dark:bg-white/5"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">{t.notes}</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(event) => updateField("notes", event.target.value)}
                    placeholder={t.notesPlaceholder}
                    className="min-h-28 rounded-2xl bg-white/80 dark:bg-white/5"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary */}
          <div className="space-y-6">
            <Card className="sticky top-6 rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  {t.summaryTitle}
                </CardTitle>
                <CardDescription>{t.summaryDesc}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-white/20 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs text-muted-foreground">{t.contractTitle}</p>
                  <p className="mt-1 font-semibold">
                    {formData.title || (isArabic ? "غير محدد" : "Not set")}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/20 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs text-muted-foreground">{t.selectedProvider}</p>
                  <p className="mt-1 font-semibold">
                    {selectedProvider?.name || (isArabic ? "غير محدد" : "Not set")}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/20 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="text-xs text-muted-foreground">{t.contractAmount}</p>
                    <p className="mt-1 text-sm">
                      <SarAmount amount={formData.contractValue || 0} />
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/20 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="text-xs text-muted-foreground">
                      {t.commissionPreview}
                    </p>
                    <p className="mt-1 text-sm">
                      <SarAmount amount={commissionPreview} />
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/20 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs text-muted-foreground">{t.contractStatus}</p>
                  <div className="mt-2">
                    <Badge className="rounded-full border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">
                      {formData.status}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    className="rounded-2xl"
                    disabled={isSubmitting}
                    onClick={() => submitContract()}
                  >
                    {isSubmitting ? (
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    ) : (
                      <PlusCircle className="me-2 h-4 w-4" />
                    )}
                    {t.create}
                  </Button>

                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    disabled={isSubmitting}
                    onClick={() => submitContract("DRAFT")}
                  >
                    {isSubmitting ? (
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="me-2 h-4 w-4" />
                    )}
                    {t.saveDraft}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}