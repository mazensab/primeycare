"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, Save, ShieldCheck, UserPlus } from "lucide-react";
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

type AppLocale = "ar" | "en";

type UserType =
  | "SUPER_ADMIN"
  | "SYSTEM"
  | "STAFF"
  | "ACCOUNTANT"
  | "CUSTOMER"
  | "CENTER"
  | "PROVIDER"
  | "AGENT"
  | "BROKER"
  | "PARTNER"
  | "OTHER";

type CreatedUserResponse = {
  success: boolean;
  message: string;
  errors?: Record<string, unknown>;
  user?: {
    id: number;
    username: string;
    email: string;
    created: boolean;
    temporary_password: string | null;
    group_name: string | null;
    entity_type: string | null;
    entity_id: number | null;
    profile: {
      display_name: string;
      user_type: string;
      phone_number: string | null;
      whatsapp_number: string | null;
      extra_data: Record<string, unknown>;
    };
  };
};

type FormState = {
  user_type: UserType;
  email: string;
  username: string;
  password: string;
  first_name: string;
  last_name: string;
  display_name: string;
  phone_number: string;
  whatsapp_number: string;
  alternate_email: string;
  preferred_language: "ar" | "en";
  timezone: string;
  entity_type: string;
  entity_id: string;
  customer_id: string;
  center_id: string;
  provider_id: string;
  agent_id: string;
  broker_id: string;
  is_active: boolean;
  create_group: boolean;
};

const USER_TYPE_OPTIONS: { value: UserType; ar: string; en: string }[] = [
  { value: "SUPER_ADMIN", ar: "سوبر أدمن", en: "Super Admin" },
  { value: "SYSTEM", ar: "مستخدم نظام", en: "System User" },
  { value: "STAFF", ar: "موظف", en: "Staff" },
  { value: "ACCOUNTANT", ar: "محاسب", en: "Accountant" },
  { value: "CUSTOMER", ar: "عميل", en: "Customer" },
  { value: "CENTER", ar: "مركز", en: "Center" },
  { value: "PROVIDER", ar: "مقدم خدمة", en: "Provider" },
  { value: "AGENT", ar: "مندوب", en: "Agent" },
  { value: "BROKER", ar: "وكيل", en: "Broker" },
  { value: "PARTNER", ar: "شريك", en: "Partner" },
  { value: "OTHER", ar: "أخرى", en: "Other" },
];

const INITIAL_FORM: FormState = {
  user_type: "STAFF",
  email: "",
  username: "",
  password: "",
  first_name: "",
  last_name: "",
  display_name: "",
  phone_number: "",
  whatsapp_number: "",
  alternate_email: "",
  preferred_language: "ar",
  timezone: "Asia/Riyadh",
  entity_type: "",
  entity_id: "",
  customer_id: "",
  center_id: "",
  provider_id: "",
  agent_id: "",
  broker_id: "",
  is_active: true,
  create_group: true,
};

function getLocale(): AppLocale {
  if (typeof window === "undefined") return "ar";

  const htmlLang = document.documentElement.lang;
  if (htmlLang === "en") return "en";

  const stored = localStorage.getItem("primey-locale");
  if (stored === "en" || stored === "ar") return stored;

  return "ar";
}

function getApiBaseUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  return fromEnv || "http://127.0.0.1:8000";
}

function getCookie(name: string) {
  if (typeof document === "undefined") return "";

  const cookies = document.cookie.split(";").map((cookie) => cookie.trim());
  const found = cookies.find((cookie) => cookie.startsWith(`${name}=`));

  return found ? decodeURIComponent(found.split("=").slice(1).join("=")) : "";
}

function cleanPayload(form: FormState) {
  return {
    user_type: form.user_type,
    email: form.email.trim() || undefined,
    username: form.username.trim() || undefined,
    password: form.password.trim() || undefined,
    first_name: form.first_name.trim() || undefined,
    last_name: form.last_name.trim() || undefined,
    display_name: form.display_name.trim() || undefined,
    phone_number: form.phone_number.trim() || undefined,
    whatsapp_number: form.whatsapp_number.trim() || undefined,
    alternate_email: form.alternate_email.trim() || undefined,
    preferred_language: form.preferred_language,
    timezone: form.timezone.trim() || "Asia/Riyadh",
    entity_type: form.entity_type.trim() || undefined,
    entity_id: form.entity_id.trim() ? Number(form.entity_id) : undefined,
    customer_id: form.customer_id.trim() ? Number(form.customer_id) : undefined,
    center_id: form.center_id.trim() ? Number(form.center_id) : undefined,
    provider_id: form.provider_id.trim() ? Number(form.provider_id) : undefined,
    agent_id: form.agent_id.trim() ? Number(form.agent_id) : undefined,
    broker_id: form.broker_id.trim() ? Number(form.broker_id) : undefined,
    is_active: form.is_active,
    create_group: form.create_group,
  };
}

function userTypeLabel(value: string, locale: AppLocale) {
  const option = USER_TYPE_OPTIONS.find((item) => item.value === value);
  if (!option) return value;
  return locale === "ar" ? option.ar : option.en;
}

export default function SystemUsersCreatePage() {
  const [locale] = useState<AppLocale>(getLocale());
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [createdUser, setCreatedUser] = useState<CreatedUserResponse["user"] | null>(null);

  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const BackIcon = isArabic ? ArrowRight : ArrowLeft;

  const labels = useMemo(
    () => ({
      title: isArabic ? "إضافة مستخدم جديد" : "Create New User",
      subtitle: isArabic
        ? "إنشاء حساب دخول وربطه بنوع المستخدم والكيان المناسب داخل Primey Care."
        : "Create a login account and link it to the proper Primey Care actor.",
      back: isArabic ? "رجوع للمستخدمين" : "Back to users",
      save: isArabic ? "حفظ المستخدم" : "Save User",
      saving: isArabic ? "جاري الحفظ..." : "Saving...",
      basic: isArabic ? "بيانات الحساب" : "Account Details",
      profile: isArabic ? "الملف والتواصل" : "Profile & Contact",
      link: isArabic ? "ربط الكيان" : "Entity Link",
      flags: isArabic ? "الحالة والصلاحية" : "Status & Access",
      userType: isArabic ? "نوع المستخدم" : "User Type",
      email: isArabic ? "البريد الإلكتروني" : "Email",
      username: isArabic ? "اسم المستخدم" : "Username",
      password: isArabic ? "كلمة مرور اختيارية" : "Optional password",
      firstName: isArabic ? "الاسم الأول" : "First name",
      lastName: isArabic ? "اسم العائلة" : "Last name",
      displayName: isArabic ? "الاسم المعروض" : "Display name",
      phone: isArabic ? "رقم الجوال" : "Phone",
      whatsapp: isArabic ? "رقم واتساب" : "WhatsApp",
      alternateEmail: isArabic ? "بريد بديل" : "Alternate email",
      language: isArabic ? "اللغة" : "Language",
      timezone: isArabic ? "المنطقة الزمنية" : "Timezone",
      entityType: isArabic ? "نوع الكيان" : "Entity type",
      entityId: isArabic ? "معرف الكيان" : "Entity ID",
      customerId: isArabic ? "معرف العميل" : "Customer ID",
      centerId: isArabic ? "معرف المركز" : "Center ID",
      providerId: isArabic ? "معرف مقدم الخدمة" : "Provider ID",
      agentId: isArabic ? "معرف المندوب" : "Agent ID",
      brokerId: isArabic ? "معرف الوكيل" : "Broker ID",
      isActive: isArabic ? "الحساب نشط" : "Account active",
      createGroup: isArabic ? "إنشاء/ربط المجموعة تلقائيًا" : "Create/assign group automatically",
      created: isArabic ? "تم إنشاء المستخدم" : "User created",
      temporaryPassword: isArabic ? "كلمة المرور المؤقتة" : "Temporary password",
      openDetails: isArabic ? "فتح التفاصيل" : "Open details",
    }),
    [isArabic]
  );

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.email.trim() && !form.username.trim() && !form.phone_number.trim()) {
      toast.error(
        isArabic
          ? "يجب إدخال البريد أو اسم المستخدم أو رقم الجوال."
          : "Email, username, or phone is required."
      );
      return;
    }

    setSubmitting(true);
    setCreatedUser(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/users/create/`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
        body: JSON.stringify(cleanPayload(form)),
      });

      const data = (await response.json()) as CreatedUserResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to create user.");
      }

      toast.success(data.message || (isArabic ? "تم حفظ المستخدم." : "User saved."));
      setCreatedUser(data.user || null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : isArabic
            ? "تعذر حفظ المستخدم."
            : "Unable to save user.";

      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main dir={dir} className="min-h-screen bg-slate-50/60 p-4 sm:p-6 lg:p-8">
      <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-3xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
              <UserPlus className="h-6 w-6" />
            </div>

            <div>
              <div className="mb-2">
                <Badge variant="secondary" className="rounded-full">
                  {userTypeLabel(form.user_type, locale)}
                </Badge>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                {labels.title}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                {labels.subtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild type="button" variant="outline" className="rounded-2xl">
              <Link href="/system/users">
                <BackIcon className="h-4 w-4" />
                <span>{labels.back}</span>
              </Link>
            </Button>

            <Button
              type="submit"
              disabled={submitting}
              className="rounded-2xl bg-slate-900 hover:bg-slate-800"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>{submitting ? labels.saving : labels.save}</span>
            </Button>
          </div>
        </section>

        {createdUser ? (
          <Card className="rounded-3xl border-emerald-100 bg-emerald-50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-800">
                <ShieldCheck className="h-5 w-5" />
                {labels.created}
              </CardTitle>
              <CardDescription className="text-emerald-700">
                {createdUser.profile.display_name || createdUser.email || createdUser.username}
              </CardDescription>
            </CardHeader>

            <CardContent className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-white p-4">
                <div className="text-xs text-slate-500">Username</div>
                <div className="mt-1 font-semibold text-slate-950">{createdUser.username}</div>
              </div>

              <div className="rounded-2xl bg-white p-4">
                <div className="text-xs text-slate-500">{labels.temporaryPassword}</div>
                <div className="mt-1 break-all font-semibold text-slate-950">
                  {createdUser.temporary_password || "—"}
                </div>
              </div>

              <div className="flex items-center rounded-2xl bg-white p-4">
                <Button asChild className="w-full rounded-2xl">
                  <Link href={`/system/users/${createdUser.id}`}>{labels.openDetails}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-3xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle>{labels.basic}</CardTitle>
            </CardHeader>

            <CardContent className="grid gap-4">
              <Field label={labels.userType}>
                <select
                  value={form.user_type}
                  onChange={(event) => updateField("user_type", event.target.value as UserType)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
                >
                  {USER_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {isArabic ? option.ar : option.en}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={labels.email}>
                <Input
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  type="email"
                  className="h-11 rounded-2xl"
                  placeholder="user@example.com"
                />
              </Field>

              <Field label={labels.username}>
                <Input
                  value={form.username}
                  onChange={(event) => updateField("username", event.target.value)}
                  className="h-11 rounded-2xl"
                  placeholder="optional_username"
                />
              </Field>

              <Field label={labels.password}>
                <Input
                  value={form.password}
                  onChange={(event) => updateField("password", event.target.value)}
                  type="password"
                  className="h-11 rounded-2xl"
                  placeholder={isArabic ? "اتركها فارغة لتوليد كلمة مؤقتة" : "Leave empty to generate temporary password"}
                />
              </Field>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle>{labels.profile}</CardTitle>
            </CardHeader>

            <CardContent className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={labels.firstName}>
                  <Input
                    value={form.first_name}
                    onChange={(event) => updateField("first_name", event.target.value)}
                    className="h-11 rounded-2xl"
                  />
                </Field>

                <Field label={labels.lastName}>
                  <Input
                    value={form.last_name}
                    onChange={(event) => updateField("last_name", event.target.value)}
                    className="h-11 rounded-2xl"
                  />
                </Field>
              </div>

              <Field label={labels.displayName}>
                <Input
                  value={form.display_name}
                  onChange={(event) => updateField("display_name", event.target.value)}
                  className="h-11 rounded-2xl"
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label={labels.phone}>
                  <Input
                    value={form.phone_number}
                    onChange={(event) => updateField("phone_number", event.target.value)}
                    className="h-11 rounded-2xl"
                    placeholder="+9665xxxxxxxx"
                  />
                </Field>

                <Field label={labels.whatsapp}>
                  <Input
                    value={form.whatsapp_number}
                    onChange={(event) => updateField("whatsapp_number", event.target.value)}
                    className="h-11 rounded-2xl"
                    placeholder="+9665xxxxxxxx"
                  />
                </Field>
              </div>

              <Field label={labels.alternateEmail}>
                <Input
                  value={form.alternate_email}
                  onChange={(event) => updateField("alternate_email", event.target.value)}
                  type="email"
                  className="h-11 rounded-2xl"
                />
              </Field>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle>{labels.link}</CardTitle>
              <CardDescription>
                {isArabic
                  ? "املأ المعرف المناسب حسب نوع المستخدم. مثال: عميل = customer_id، مركز = center_id."
                  : "Fill the relevant entity ID based on user type."}
              </CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={labels.entityType}>
                  <Input
                    value={form.entity_type}
                    onChange={(event) => updateField("entity_type", event.target.value)}
                    className="h-11 rounded-2xl"
                    placeholder="customer / center / provider / agent"
                  />
                </Field>

                <Field label={labels.entityId}>
                  <Input
                    value={form.entity_id}
                    onChange={(event) => updateField("entity_id", event.target.value)}
                    type="number"
                    className="h-11 rounded-2xl"
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label={labels.customerId}>
                  <Input
                    value={form.customer_id}
                    onChange={(event) => updateField("customer_id", event.target.value)}
                    type="number"
                    className="h-11 rounded-2xl"
                  />
                </Field>

                <Field label={labels.centerId}>
                  <Input
                    value={form.center_id}
                    onChange={(event) => updateField("center_id", event.target.value)}
                    type="number"
                    className="h-11 rounded-2xl"
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label={labels.providerId}>
                  <Input
                    value={form.provider_id}
                    onChange={(event) => updateField("provider_id", event.target.value)}
                    type="number"
                    className="h-11 rounded-2xl"
                  />
                </Field>

                <Field label={labels.agentId}>
                  <Input
                    value={form.agent_id}
                    onChange={(event) => updateField("agent_id", event.target.value)}
                    type="number"
                    className="h-11 rounded-2xl"
                  />
                </Field>
              </div>

              <Field label={labels.brokerId}>
                <Input
                  value={form.broker_id}
                  onChange={(event) => updateField("broker_id", event.target.value)}
                  type="number"
                  className="h-11 rounded-2xl"
                />
              </Field>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle>{labels.flags}</CardTitle>
            </CardHeader>

            <CardContent className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={labels.language}>
                  <select
                    value={form.preferred_language}
                    onChange={(event) =>
                      updateField("preferred_language", event.target.value as "ar" | "en")
                    }
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
                  >
                    <option value="ar">العربية</option>
                    <option value="en">English</option>
                  </select>
                </Field>

                <Field label={labels.timezone}>
                  <Input
                    value={form.timezone}
                    onChange={(event) => updateField("timezone", event.target.value)}
                    className="h-11 rounded-2xl"
                  />
                </Field>
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border bg-white p-4 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => updateField("is_active", event.target.checked)}
                  className="h-4 w-4"
                />
                <span>{labels.isActive}</span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border bg-white p-4 text-sm">
                <input
                  type="checkbox"
                  checked={form.create_group}
                  onChange={(event) => updateField("create_group", event.target.checked)}
                  className="h-4 w-4"
                />
                <span>{labels.createGroup}</span>
              </label>
            </CardContent>
          </Card>
        </div>
      </form>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}