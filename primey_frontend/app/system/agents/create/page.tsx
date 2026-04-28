"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CheckCircle2,
  HandCoins,
  Landmark,
  Loader2,
  Mail,
  Phone,
  PlusCircle,
  RefreshCcw,
  Save,
  ShieldCheck,
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
import { Textarea } from "@/components/ui/textarea";

/* ============================================================
   📂 app/system/agents/create/page.tsx
   🧠 Primey Care | Create Agent
   ------------------------------------------------------------
   ✅ Phase 6: Agents + Commissions
   ✅ ربط حقيقي مع POST /api/agents/create/
   ✅ نفس هوية Primey Care الرسمية
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ استخدام sonner
   ✅ استخدام رمز SAR الرسمي
   ✅ حفظ مسودة محليًا بدون إرسال
   ✅ معالجة أخطاء API وإظهارها على الحقول
   ✅ بدون localhost
============================================================ */

type AppLocale = "ar" | "en";

type AgentStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DRAFT";
type CommissionType = "PERCENTAGE" | "FIXED";

type AgentFormData = {
  fullName: string;
  agentCode: string;
  referralCode: string;
  status: AgentStatus;
  phone: string;
  email: string;
  city: string;
  address: string;
  defaultCommissionType: CommissionType;
  defaultCommissionValue: string;
  bankName: string;
  bankAccountName: string;
  iban: string;
  notes: string;
};

type AgentFormErrors = Partial<Record<keyof AgentFormData, string>>;

type CreateAgentApiResponse = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[] | string>;
  agent?: {
    id?: number | string;
    full_name?: string;
    agent_code?: string;
    referral_code?: string;
  };
};

const SAR_ICON = "/currency/sar.svg";
const DRAFT_STORAGE_KEY = "primey-agent-create-draft";

const initialFormData: AgentFormData = {
  fullName: "",
  agentCode: "",
  referralCode: "",
  status: "ACTIVE",
  phone: "",
  email: "",
  city: "",
  address: "",
  defaultCommissionType: "PERCENTAGE",
  defaultCommissionValue: "",
  bankName: "",
  bankAccountName: "",
  iban: "",
  notes: "",
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
    title: isArabic ? "إنشاء مندوب" : "Create Agent",
    subtitle: isArabic
      ? "إضافة مندوب جديد مع بيانات التواصل، كود الإحالة، إعدادات العمولة، والبيانات البنكية."
      : "Create a new agent with contact details, referral code, commission settings, and bank information.",

    back: isArabic ? "لوحة المندوبين" : "Agents Overview",
    list: isArabic ? "قائمة المندوبين" : "Agents List",
    saveDraft: isArabic ? "حفظ مسودة" : "Save Draft",
    clearDraft: isArabic ? "تفريغ النموذج" : "Clear Form",
    create: isArabic ? "إنشاء المندوب" : "Create Agent",

    basicInfo: isArabic ? "البيانات الأساسية" : "Basic Information",
    basicInfoDesc: isArabic
      ? "البيانات الرئيسية التي تميز المندوب داخل النظام."
      : "Main data that identifies the agent inside the system.",

    contactInfo: isArabic ? "بيانات التواصل" : "Contact Information",
    contactInfoDesc: isArabic
      ? "بيانات الاتصال والمدينة والعنوان."
      : "Contact details, city, and address.",

    commissionInfo: isArabic ? "إعدادات العمولة" : "Commission Settings",
    commissionInfoDesc: isArabic
      ? "نوع العمولة وقيمتها الافتراضية للمندوب."
      : "Default commission type and value for the agent.",

    bankInfo: isArabic ? "البيانات البنكية" : "Bank Information",
    bankInfoDesc: isArabic
      ? "بيانات اختيارية لاستخدامها لاحقًا عند صرف العمولات."
      : "Optional data used later for commission payouts.",

    notesInfo: isArabic ? "الملاحظات" : "Notes",
    notesInfoDesc: isArabic
      ? "ملاحظات داخلية حول المندوب."
      : "Internal notes about the agent.",

    readiness: isArabic ? "جاهزية الملف" : "Profile Readiness",
    readinessDesc: isArabic
      ? "تأكد من اكتمال البيانات الأساسية قبل الحفظ."
      : "Make sure required fields are completed before saving.",

    fullName: isArabic ? "اسم المندوب" : "Agent Name",
    agentCode: isArabic ? "كود المندوب" : "Agent Code",
    referralCode: isArabic ? "كود الإحالة" : "Referral Code",
    status: isArabic ? "الحالة" : "Status",
    phone: isArabic ? "رقم الجوال" : "Phone",
    email: isArabic ? "البريد الإلكتروني" : "Email",
    city: isArabic ? "المدينة" : "City",
    address: isArabic ? "العنوان" : "Address",
    commissionType: isArabic ? "نوع العمولة" : "Commission Type",
    commissionValue: isArabic ? "قيمة العمولة" : "Commission Value",
    bankName: isArabic ? "اسم البنك" : "Bank Name",
    bankAccountName: isArabic ? "اسم صاحب الحساب" : "Account Holder",
    iban: isArabic ? "الآيبان" : "IBAN",
    notes: isArabic ? "ملاحظات" : "Notes",

    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
    suspended: isArabic ? "موقوف" : "Suspended",
    draft: isArabic ? "مسودة" : "Draft",
    percentage: isArabic ? "نسبة" : "Percentage",
    fixed: isArabic ? "مبلغ ثابت" : "Fixed Amount",

    placeholders: {
      fullName: isArabic ? "مثال: عبدالله صالح" : "Example: Abdullah Saleh",
      agentCode: isArabic ? "مثال: AGT-001" : "Example: AGT-001",
      referralCode: isArabic ? "مثال: REF-001" : "Example: REF-001",
      phone: isArabic ? "05xxxxxxxx" : "05xxxxxxxx",
      email: isArabic ? "agent@example.com" : "agent@example.com",
      city: isArabic ? "مثال: جدة" : "Example: Jeddah",
      address: isArabic ? "العنوان التفصيلي" : "Full address",
      commissionValue: isArabic ? "مثال: 10" : "Example: 10",
      bankName: isArabic ? "مثال: الراجحي" : "Example: Al Rajhi Bank",
      bankAccountName: isArabic ? "اسم صاحب الحساب" : "Account holder name",
      iban: isArabic ? "SAxxxxxxxxxxxxxxxxxxxxxx" : "SAxxxxxxxxxxxxxxxxxxxxxx",
      notes: isArabic ? "أي ملاحظات إضافية" : "Any additional notes",
    },

    validation: {
      required: isArabic ? "هذا الحقل مطلوب" : "This field is required",
      invalidEmail: isArabic
        ? "صيغة البريد الإلكتروني غير صحيحة"
        : "Invalid email format",
      invalidPhone: isArabic
        ? "رقم الجوال غير صحيح"
        : "Invalid phone number",
      invalidCommission: isArabic
        ? "قيمة العمولة غير صحيحة"
        : "Invalid commission value",
      invalidPercentage: isArabic
        ? "النسبة يجب أن تكون بين 0 و 100"
        : "Percentage must be between 0 and 100",
      invalidIban: isArabic ? "رقم الآيبان غير صحيح" : "Invalid IBAN",
    },

    requiredFields: isArabic ? "الحقول المطلوبة" : "Required Fields",
    completion: isArabic ? "نسبة الاكتمال" : "Completion",

    successTitle: isArabic ? "تم إنشاء المندوب" : "Agent Created",
    successText: isArabic
      ? "تم إنشاء المندوب بنجاح وربطه بوحدة المندوبين."
      : "The agent has been created and linked to the agents module.",
    draftTitle: isArabic ? "تم حفظ المسودة" : "Draft Saved",
    draftText: isArabic
      ? "تم حفظ بيانات النموذج مؤقتًا في المتصفح."
      : "Form data has been saved temporarily in the browser.",
    draftRestored: isArabic ? "تم استرجاع المسودة" : "Draft Restored",
    clearTitle: isArabic ? "تم تفريغ النموذج" : "Form Cleared",
    apiError: isArabic
      ? "تعذر إنشاء المندوب. راجع البيانات وحاول مرة أخرى."
      : "Unable to create the agent. Review the data and try again.",
    unexpectedError: isArabic ? "حدث خطأ غير متوقع" : "Unexpected error",

    checklist: [
      {
        title: isArabic ? "بيانات المندوب" : "Agent Profile",
        text: isArabic
          ? "الاسم، الكود، وكود الإحالة."
          : "Name, code, and referral code.",
        icon: UserRound,
      },
      {
        title: isArabic ? "بيانات التواصل" : "Contact Details",
        text: isArabic ? "الجوال، البريد، والمدينة." : "Phone, email, and city.",
        icon: Phone,
      },
      {
        title: isArabic ? "إعداد العمولة" : "Commission Setup",
        text: isArabic
          ? "نوع وقيمة العمولة الافتراضية."
          : "Default commission type and value.",
        icon: HandCoins,
      },
      {
        title: isArabic ? "البيانات المالية" : "Financial Data",
        text: isArabic
          ? "البنك والآيبان عند الحاجة."
          : "Bank and IBAN when needed.",
        icon: Wallet,
      },
    ],
  };
}

/* ============================================================
   ✅ Validation / Payload
============================================================ */

function isValidEmail(value: string) {
  if (!value.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  if (!value.trim()) return true;

  const cleaned = value.replace(/[^\d+]/g, "");
  return cleaned.length >= 9;
}

function isValidIban(value: string) {
  if (!value.trim()) return true;

  const cleaned = value.replace(/\s+/g, "").toUpperCase();
  return cleaned.startsWith("SA") && cleaned.length >= 15 && cleaned.length <= 34;
}

function normalizeDecimal(value: string) {
  const numberValue = Number(value.trim().replace(",", "."));

  if (!Number.isFinite(numberValue)) return "0.00";

  return numberValue.toFixed(2);
}

function buildPayload(formData: AgentFormData) {
  return {
    full_name: formData.fullName.trim(),
    agent_code: formData.agentCode.trim().toUpperCase(),
    referral_code: formData.referralCode.trim().toUpperCase(),
    status: formData.status,
    phone: formData.phone.trim(),
    email: formData.email.trim().toLowerCase(),
    city: formData.city.trim(),
    address: formData.address.trim(),
    default_commission_type: formData.defaultCommissionType,
    default_commission_value: normalizeDecimal(formData.defaultCommissionValue),
    bank_name: formData.bankName.trim(),
    bank_account_name: formData.bankAccountName.trim(),
    iban: formData.iban.trim().replace(/\s+/g, "").toUpperCase(),
    notes: formData.notes.trim(),
  };
}

function mapApiErrors(errors?: Record<string, string[] | string>): AgentFormErrors {
  if (!errors) return {};

  const fieldMap: Record<string, keyof AgentFormData> = {
    full_name: "fullName",
    name: "fullName",
    agent_name: "fullName",
    agent_code: "agentCode",
    code: "agentCode",
    referral_code: "referralCode",
    ref_code: "referralCode",
    status: "status",
    phone: "phone",
    email: "email",
    city: "city",
    address: "address",
    default_commission_type: "defaultCommissionType",
    commission_type: "defaultCommissionType",
    default_commission_value: "defaultCommissionValue",
    commission_value: "defaultCommissionValue",
    bank_name: "bankName",
    bank_account_name: "bankAccountName",
    iban: "iban",
    notes: "notes",
  };

  const mappedErrors: AgentFormErrors = {};

  Object.entries(errors).forEach(([key, value]) => {
    const formKey = fieldMap[key];
    if (!formKey) return;

    mappedErrors[formKey] = Array.isArray(value)
      ? value.join(" ")
      : String(value);
  });

  return mappedErrors;
}

/* ============================================================
   🔹 Small Components
============================================================ */

function SelectBox({
  id,
  value,
  onChange,
  children,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="border-input bg-background h-10 w-full rounded-xl border px-3 text-sm"
    >
      {children}
    </select>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <p className="text-sm text-red-500">{message}</p>;
}

/* ============================================================
   ✅ Page
============================================================ */

export default function SystemCreateAgentPage() {
  const router = useRouter();

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);

  const [formData, setFormData] = useState<AgentFormData>(initialFormData);
  const [errors, setErrors] = useState<AgentFormErrors>({});

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const completionStats = useMemo(() => {
    const requiredValues = [
      formData.fullName,
      formData.agentCode,
      formData.referralCode,
      formData.phone,
      formData.city,
      formData.defaultCommissionValue,
    ];

    const filled = requiredValues.filter((value) => value.trim().length > 0).length;
    const total = requiredValues.length;
    const percent = total ? Math.round((filled / total) * 100) : 0;

    return { filled, total, percent };
  }, [formData]);

  function setField<K extends keyof AgentFormData>(
    key: K,
    value: AgentFormData[K],
  ) {
    setFormData((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validateForm() {
    const nextErrors: AgentFormErrors = {};

    if (!formData.fullName.trim()) nextErrors.fullName = t.validation.required;
    if (!formData.agentCode.trim()) nextErrors.agentCode = t.validation.required;
    if (!formData.referralCode.trim()) nextErrors.referralCode = t.validation.required;

    if (!formData.phone.trim()) {
      nextErrors.phone = t.validation.required;
    } else if (!isValidPhone(formData.phone)) {
      nextErrors.phone = t.validation.invalidPhone;
    }

    if (formData.email.trim() && !isValidEmail(formData.email)) {
      nextErrors.email = t.validation.invalidEmail;
    }

    if (!formData.city.trim()) nextErrors.city = t.validation.required;

    if (!formData.defaultCommissionValue.trim()) {
      nextErrors.defaultCommissionValue = t.validation.required;
    } else {
      const commissionValue = Number(formData.defaultCommissionValue.replace(",", "."));

      if (!Number.isFinite(commissionValue) || commissionValue < 0) {
        nextErrors.defaultCommissionValue = t.validation.invalidCommission;
      }

      if (
        formData.defaultCommissionType === "PERCENTAGE" &&
        commissionValue > 100
      ) {
        nextErrors.defaultCommissionValue = t.validation.invalidPercentage;
      }
    }

    if (formData.iban.trim() && !isValidIban(formData.iban)) {
      nextErrors.iban = t.validation.invalidIban;
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  async function handleSaveDraft() {
    try {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formData));

      toast.success(t.draftTitle, {
        description: t.draftText,
      });
    } catch (error) {
      console.error("Save draft error:", error);
      toast.error(t.unexpectedError);
    }
  }

  function handleClearForm() {
    setFormData(initialFormData);
    setErrors({});
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    toast.success(t.clearTitle);
  }

  async function handleSubmit() {
    if (!validateForm()) {
      toast.error(t.validation.required);
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch("/api/agents/create/", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
        body: JSON.stringify(buildPayload(formData)),
      });

      const payload = (await response.json().catch(() => null)) as
        | CreateAgentApiResponse
        | null;

      if (!response.ok || !payload?.ok) {
        const apiFieldErrors = mapApiErrors(payload?.errors);
        if (Object.keys(apiFieldErrors).length > 0) {
          setErrors(apiFieldErrors);
        }

        toast.error(payload?.message || t.apiError);
        return;
      }

      toast.success(t.successTitle, {
        description: t.successText,
      });

      window.localStorage.removeItem(DRAFT_STORAGE_KEY);

      const createdId = payload.agent?.id;
      if (createdId) {
        router.push(`/system/agents/${createdId}`);
        return;
      }

      router.push("/system/agents/list");
    } catch (error) {
      console.error("Create agent error:", error);
      toast.error(t.apiError);
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    const syncLocale = () => {
      const nextLocale = readLocale();

      applyDocumentLocale(nextLocale);
      setLocale(nextLocale);
    };

    const syncAfterPaint = () => {
      syncLocale();
      window.setTimeout(syncLocale, 0);
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
    if (isDraftLoaded) return;

    try {
      const savedDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!savedDraft) {
        setIsDraftLoaded(true);
        return;
      }

      const parsed = JSON.parse(savedDraft) as Partial<AgentFormData>;

      setFormData({
        ...initialFormData,
        ...parsed,
        status:
          parsed.status === "ACTIVE" ||
          parsed.status === "INACTIVE" ||
          parsed.status === "SUSPENDED" ||
          parsed.status === "DRAFT"
            ? parsed.status
            : "ACTIVE",
        defaultCommissionType:
          parsed.defaultCommissionType === "FIXED" ||
          parsed.defaultCommissionType === "PERCENTAGE"
            ? parsed.defaultCommissionType
            : "PERCENTAGE",
      });

      toast.success(t.draftRestored);
    } catch (error) {
      console.error("Restore draft error:", error);
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    } finally {
      setIsDraftLoaded(true);
    }
  }, [isDraftLoaded, t.draftRestored]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t.title}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{t.subtitle}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link href="/system/agents">
            <Button variant="outline" className="h-10 w-full rounded-xl sm:w-auto">
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>

          <Link href="/system/agents/list">
            <Button variant="outline" className="h-10 w-full rounded-xl sm:w-auto">
              <BadgeCheck className="h-4 w-4" />
              <span>{t.list}</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={handleClearForm}
            disabled={isSubmitting}
          >
            <RefreshCcw className="h-4 w-4" />
            <span>{t.clearDraft}</span>
          </Button>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={handleSaveDraft}
            disabled={isSubmitting}
          >
            <Save className="h-4 w-4" />
            <span>{t.saveDraft}</span>
          </Button>

          <Button
            className="h-10 rounded-xl"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="h-4 w-4" />
            )}
            <span>{t.create}</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* Basic Info */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <UserRound className="h-4 w-4" />
                {t.basicInfo}
              </CardTitle>
              <CardDescription>{t.basicInfoDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">{t.fullName}</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(event) => setField("fullName", event.target.value)}
                  placeholder={t.placeholders.fullName}
                  className="h-10 rounded-xl"
                />
                <FieldError message={errors.fullName} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="agentCode">{t.agentCode}</Label>
                <Input
                  id="agentCode"
                  value={formData.agentCode}
                  onChange={(event) =>
                    setField("agentCode", event.target.value.toUpperCase())
                  }
                  placeholder={t.placeholders.agentCode}
                  className="h-10 rounded-xl"
                />
                <FieldError message={errors.agentCode} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="referralCode">{t.referralCode}</Label>
                <Input
                  id="referralCode"
                  value={formData.referralCode}
                  onChange={(event) =>
                    setField("referralCode", event.target.value.toUpperCase())
                  }
                  placeholder={t.placeholders.referralCode}
                  className="h-10 rounded-xl"
                />
                <FieldError message={errors.referralCode} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">{t.status}</Label>
                <SelectBox
                  id="status"
                  value={formData.status}
                  onChange={(value) => setField("status", value as AgentStatus)}
                >
                  <option value="ACTIVE">{t.active}</option>
                  <option value="DRAFT">{t.draft}</option>
                  <option value="INACTIVE">{t.inactive}</option>
                  <option value="SUSPENDED">{t.suspended}</option>
                </SelectBox>
                <FieldError message={errors.status} />
              </div>
            </CardContent>
          </Card>

          {/* Contact Info */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Phone className="h-4 w-4" />
                {t.contactInfo}
              </CardTitle>
              <CardDescription>{t.contactInfoDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">{t.phone}</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(event) => setField("phone", event.target.value)}
                  placeholder={t.placeholders.phone}
                  className="h-10 rounded-xl"
                />
                <FieldError message={errors.phone} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t.email}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(event) => setField("email", event.target.value)}
                  placeholder={t.placeholders.email}
                  className="h-10 rounded-xl"
                />
                <FieldError message={errors.email} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">{t.city}</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(event) => setField("city", event.target.value)}
                  placeholder={t.placeholders.city}
                  className="h-10 rounded-xl"
                />
                <FieldError message={errors.city} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">{t.address}</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(event) => setField("address", event.target.value)}
                  placeholder={t.placeholders.address}
                  className="min-h-[96px] rounded-xl"
                />
                <FieldError message={errors.address} />
              </div>
            </CardContent>
          </Card>

          {/* Commission Info */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <HandCoins className="h-4 w-4" />
                {t.commissionInfo}
              </CardTitle>
              <CardDescription>{t.commissionInfoDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="commissionType">{t.commissionType}</Label>
                <SelectBox
                  id="commissionType"
                  value={formData.defaultCommissionType}
                  onChange={(value) =>
                    setField("defaultCommissionType", value as CommissionType)
                  }
                >
                  <option value="PERCENTAGE">{t.percentage}</option>
                  <option value="FIXED">{t.fixed}</option>
                </SelectBox>
                <FieldError message={errors.defaultCommissionType} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="commissionValue">{t.commissionValue}</Label>
                <div className="relative">
                  <Input
                    id="commissionValue"
                    inputMode="decimal"
                    value={formData.defaultCommissionValue}
                    onChange={(event) =>
                      setField("defaultCommissionValue", event.target.value)
                    }
                    placeholder={t.placeholders.commissionValue}
                    className="h-10 rounded-xl pe-12"
                  />

                  <div className="pointer-events-none absolute inset-y-0 end-3 flex items-center">
                    {formData.defaultCommissionType === "FIXED" ? (
                      <Image
                        src={SAR_ICON}
                        alt="SAR"
                        width={18}
                        height={18}
                        className="opacity-90"
                      />
                    ) : (
                      <span className="text-muted-foreground text-sm">%</span>
                    )}
                  </div>
                </div>
                <FieldError message={errors.defaultCommissionValue} />
              </div>
            </CardContent>
          </Card>

          {/* Bank Info */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Landmark className="h-4 w-4" />
                {t.bankInfo}
              </CardTitle>
              <CardDescription>{t.bankInfoDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bankName">{t.bankName}</Label>
                <Input
                  id="bankName"
                  value={formData.bankName}
                  onChange={(event) => setField("bankName", event.target.value)}
                  placeholder={t.placeholders.bankName}
                  className="h-10 rounded-xl"
                />
                <FieldError message={errors.bankName} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bankAccountName">{t.bankAccountName}</Label>
                <Input
                  id="bankAccountName"
                  value={formData.bankAccountName}
                  onChange={(event) =>
                    setField("bankAccountName", event.target.value)
                  }
                  placeholder={t.placeholders.bankAccountName}
                  className="h-10 rounded-xl"
                />
                <FieldError message={errors.bankAccountName} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="iban">{t.iban}</Label>
                <Input
                  id="iban"
                  value={formData.iban}
                  onChange={(event) =>
                    setField("iban", event.target.value.toUpperCase())
                  }
                  placeholder={t.placeholders.iban}
                  className="h-10 rounded-xl"
                />
                <FieldError message={errors.iban} />
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Mail className="h-4 w-4" />
                {t.notesInfo}
              </CardTitle>
              <CardDescription>{t.notesInfoDesc}</CardDescription>
            </CardHeader>

            <CardContent>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(event) => setField("notes", event.target.value)}
                placeholder={t.placeholders.notes}
                className="min-h-[110px] rounded-xl"
              />
              <FieldError message={errors.notes} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <ShieldCheck className="h-4 w-4" />
                {t.readiness}
              </CardTitle>
              <CardDescription>{t.readinessDesc}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-background p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold">{t.requiredFields}</p>
                  <Badge variant="secondary" className="rounded-full">
                    {completionStats.filled}/{completionStats.total}
                  </Badge>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${completionStats.percent}%` }}
                  />
                </div>

                <p className="text-muted-foreground mt-3 text-xs">
                  {completionStats.percent}% {t.completion}
                </p>
              </div>

              {t.checklist.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="flex items-start gap-3 rounded-xl border bg-background p-3"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="text-muted-foreground mt-1 text-xs leading-6">
                        {item.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="space-y-3 p-4">
              <Button
                className="h-10 w-full rounded-xl"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlusCircle className="h-4 w-4" />
                )}
                <span>{t.create}</span>
              </Button>

              <Button
                variant="outline"
                className="h-10 w-full rounded-xl"
                onClick={handleSaveDraft}
                disabled={isSubmitting}
              >
                <Save className="h-4 w-4" />
                <span>{t.saveDraft}</span>
              </Button>

              <Button
                variant="outline"
                className="h-10 w-full rounded-xl"
                onClick={handleClearForm}
                disabled={isSubmitting}
              >
                <RefreshCcw className="h-4 w-4" />
                <span>{t.clearDraft}</span>
              </Button>

              <Link href="/system/agents/list">
                <Button variant="outline" className="h-10 w-full rounded-xl">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{t.list}</span>
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="flex items-start gap-3 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Building2 className="h-5 w-5" />
              </div>

              <div>
                <p className="font-semibold">
                  {isArabic ? "وحدة المندوبين" : "Agents Module"}
                </p>
                <p className="text-muted-foreground mt-1 text-sm leading-6">
                  {isArabic
                    ? "سيظهر المندوب بعد الإنشاء في القائمة والتقارير، ويمكن ربطه لاحقًا بالطلبات والعمولات."
                    : "The agent will appear in the list and reports after creation, and can later be linked with orders and commissions."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}