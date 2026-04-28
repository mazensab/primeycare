"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  RefreshCcw,
  Save,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";

import { Can } from "@/components/guards/Can";
import { PermissionGuard } from "@/components/guards/PermissionGuard";
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
import { PERMISSIONS } from "@/lib/permissions";

type AppLocale = "ar" | "en";

type UserDetail = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  last_login: string | null;
  date_joined: string | null;
  groups: string[];
  profile: {
    display_name: string;
    avatar_url: string | null;
    bio: string;
    user_type: string;
    role?: string | null;
    phone_number: string | null;
    whatsapp_number: string | null;
    alternate_email: string | null;
    preferred_language: string;
    timezone: string;
    is_profile_completed: boolean;
    extra_data: Record<string, unknown>;
    tags: string[];
  };
};

type UserDetailResponse = {
  success: boolean;
  message: string;
  user: UserDetail;
};

type PasswordLinkResponse = {
  success: boolean;
  message: string;
  reset?: {
    uid: string;
    token: string;
    reset_path: string;
    reset_url: string;
  };
};

type FormState = {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  user_type: string;
  phone_number: string;
  whatsapp_number: string;
  alternate_email: string;
  preferred_language: "ar" | "en";
  timezone: string;
  bio: string;
  avatar_url: string;
  password: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
};

const USER_TYPE_OPTIONS = [
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

function formatDate(value: string | null, locale: AppLocale) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      numberingSystem: "latn",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function userTypeLabel(value: string, locale: AppLocale) {
  const option = USER_TYPE_OPTIONS.find((item) => item.value === value);
  if (!option) return value || "—";
  return locale === "ar" ? option.ar : option.en;
}

function roleLabel(value: string | null | undefined, locale: AppLocale) {
  const role = String(value || "").trim().toLowerCase();

  const map: Record<string, { ar: string; en: string }> = {
    system_admin: { ar: "مدير النظام", en: "System Admin" },
    provider_admin: { ar: "مدير مقدم خدمة", en: "Provider Admin" },
    customer_user: { ar: "مستخدم عميل", en: "Customer User" },
    agent_user: { ar: "مستخدم مندوب", en: "Agent User" },
    accountant: { ar: "محاسب", en: "Accountant" },
    support: { ar: "دعم", en: "Support" },
    viewer: { ar: "مشاهد", en: "Viewer" },
  };

  if (!role) return "—";
  return locale === "ar" ? map[role]?.ar || role : map[role]?.en || role;
}

function formFromUser(user: UserDetail): FormState {
  return {
    username: user.username || "",
    email: user.email || "",
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    display_name: user.profile.display_name || "",
    user_type: user.profile.user_type || "OTHER",
    phone_number: user.profile.phone_number || "",
    whatsapp_number: user.profile.whatsapp_number || "",
    alternate_email: user.profile.alternate_email || "",
    preferred_language: user.profile.preferred_language === "en" ? "en" : "ar",
    timezone: user.profile.timezone || "Asia/Riyadh",
    bio: user.profile.bio || "",
    avatar_url: user.profile.avatar_url || "",
    password: "",
    is_active: user.is_active,
    is_staff: user.is_staff,
    is_superuser: user.is_superuser,
  };
}

export default function SystemUserDetailPage() {
  const params = useParams<{ id: string }>();
  const userId = params?.id;

  const [locale] = useState<AppLocale>(getLocale());
  const [user, setUser] = useState<UserDetail | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState("");

  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const BackIcon = isArabic ? ArrowRight : ArrowLeft;

  const labels = useMemo(
    () => ({
      title: isArabic ? "تفاصيل المستخدم" : "User Details",
      subtitle: isArabic
        ? "إدارة بيانات حساب الدخول والصلاحية والربط التشغيلي."
        : "Manage login account details, status, and actor context.",
      back: isArabic ? "رجوع للمستخدمين" : "Back to users",
      refresh: isArabic ? "تحديث" : "Refresh",
      save: isArabic ? "حفظ التعديلات" : "Save Changes",
      saving: isArabic ? "جاري الحفظ..." : "Saving...",
      activate: isArabic ? "تفعيل" : "Activate",
      deactivate: isArabic ? "تعطيل" : "Deactivate",
      passwordLink: isArabic ? "توليد رابط كلمة مرور" : "Generate Password Link",
      account: isArabic ? "بيانات الحساب" : "Account",
      profile: isArabic ? "الملف والتواصل" : "Profile & Contact",
      permissions: isArabic ? "الحالة والصلاحيات" : "Status & Permissions",
      context: isArabic ? "الربط التشغيلي" : "Operational Context",
      username: isArabic ? "اسم المستخدم" : "Username",
      email: isArabic ? "البريد الإلكتروني" : "Email",
      firstName: isArabic ? "الاسم الأول" : "First Name",
      lastName: isArabic ? "اسم العائلة" : "Last Name",
      displayName: isArabic ? "الاسم المعروض" : "Display Name",
      userType: isArabic ? "نوع المستخدم" : "User Type",
      role: isArabic ? "الدور" : "Role",
      phone: isArabic ? "رقم الجوال" : "Phone",
      whatsapp: isArabic ? "واتساب" : "WhatsApp",
      alternateEmail: isArabic ? "بريد بديل" : "Alternate Email",
      language: isArabic ? "اللغة" : "Language",
      timezone: isArabic ? "المنطقة الزمنية" : "Timezone",
      bio: isArabic ? "نبذة" : "Bio",
      avatar: isArabic ? "رابط الصورة" : "Avatar URL",
      password: isArabic ? "كلمة مرور جديدة" : "New Password",
      isActive: isArabic ? "الحساب نشط" : "Account Active",
      isStaff: isArabic ? "موظف نظام" : "Staff",
      isSuperuser: isArabic ? "سوبر أدمن" : "Superuser",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      lastLogin: isArabic ? "آخر دخول" : "Last Login",
      groups: isArabic ? "المجموعات" : "Groups",
      extraData: isArabic ? "بيانات الربط" : "Extra Data",
      resetUrl: isArabic ? "رابط تعيين كلمة المرور" : "Password Reset URL",
      copy: isArabic ? "نسخ" : "Copy",
      loading: isArabic ? "جاري تحميل بيانات المستخدم..." : "Loading user details...",
      notFound: isArabic ? "لم يتم العثور على المستخدم." : "User not found.",
      active: isArabic ? "نشط" : "Active",
      inactive: isArabic ? "معطل" : "Inactive",
    }),
    [isArabic],
  );

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function loadUser() {
    if (!userId) return;

    setLoading(true);

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/users/${userId}/`, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const data = (await response.json()) as UserDetailResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load user.");
      }

      setUser(data.user);
      setForm(formFromUser(data.user));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : isArabic
            ? "تعذر تحميل المستخدم."
            : "Unable to load user.";

      toast.error(message);
      setUser(null);
      setForm(null);
    } finally {
      setLoading(false);
    }
  }

  async function saveUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId || !form) return;

    setSaving(true);

    try {
      const payload = {
        username: form.username.trim(),
        email: form.email.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        display_name: form.display_name.trim(),
        user_type: form.user_type,
        phone_number: form.phone_number.trim(),
        whatsapp_number: form.whatsapp_number.trim(),
        alternate_email: form.alternate_email.trim(),
        preferred_language: form.preferred_language,
        timezone: form.timezone.trim() || "Asia/Riyadh",
        bio: form.bio.trim(),
        avatar_url: form.avatar_url.trim(),
        password: form.password.trim() || undefined,
        is_active: form.is_active,
        is_staff: form.is_staff,
        is_superuser: form.is_superuser,
      };

      const response = await fetch(`${getApiBaseUrl()}/api/users/${userId}/`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as UserDetailResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to update user.");
      }

      toast.success(
        data.message || (isArabic ? "تم حفظ التعديلات." : "Changes saved."),
      );
      setUser(data.user);
      setForm({ ...formFromUser(data.user), password: "" });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : isArabic
            ? "تعذر حفظ التعديلات."
            : "Unable to save changes.";

      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action: "activate" | "deactivate" | "send-password-link") {
    if (!userId) return;

    setActionLoading(action);

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/users/${userId}/${action}/`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
        body:
          action === "send-password-link"
            ? JSON.stringify({
                frontend_base_url:
                  typeof window !== "undefined" ? window.location.origin : undefined,
              })
            : JSON.stringify({}),
      });

      const data = (await response.json()) as PasswordLinkResponse & {
        message: string;
        user?: { is_active: boolean };
      };

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Action failed.");
      }

      toast.success(data.message);

      if (action === "send-password-link" && data.reset?.reset_url) {
        setResetUrl(data.reset.reset_url);
      } else {
        await loadUser();
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : isArabic
            ? "تعذر تنفيذ العملية."
            : "Unable to complete action.";

      toast.error(message);
    } finally {
      setActionLoading(null);
    }
  }

  async function copyResetUrl() {
    if (!resetUrl) return;

    try {
      await navigator.clipboard.writeText(resetUrl);
      toast.success(isArabic ? "تم نسخ الرابط." : "Link copied.");
    } catch {
      toast.error(isArabic ? "تعذر نسخ الرابط." : "Unable to copy link.");
    }
  }

  useEffect(() => {
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <PermissionGuard
      permission={PERMISSIONS.USERS_VIEW}
      workspace="system"
      mode="fallback"
    >
      {loading ? (
        <main
          dir={dir}
          className="flex min-h-screen items-center justify-center bg-slate-50/60"
        >
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm">{labels.loading}</span>
          </div>
        </main>
      ) : !user || !form ? (
        <main
          dir={dir}
          className="flex min-h-screen items-center justify-center bg-slate-50/60 p-6"
        >
          <Card className="w-full max-w-md rounded-3xl border-0 shadow-sm">
            <CardHeader className="text-center">
              <CardTitle>{labels.notFound}</CardTitle>
            </CardHeader>
            <CardContent>
              <Can permission={PERMISSIONS.USERS_VIEW}>
                <Button asChild className="w-full rounded-2xl">
                  <Link href="/system/users">{labels.back}</Link>
                </Button>
              </Can>
            </CardContent>
          </Card>
        </main>
      ) : (
        <main dir={dir} className="min-h-screen bg-slate-50/60 p-4 sm:p-6 lg:p-8">
          <form onSubmit={saveUser} className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <section className="flex flex-col gap-4 rounded-3xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                  <UserCog className="h-6 w-6" />
                </div>

                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {user.is_active ? (
                      <Badge className="rounded-full bg-emerald-600">
                        {labels.active}
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="rounded-full">
                        {labels.inactive}
                      </Badge>
                    )}

                    <Badge variant="secondary" className="rounded-full">
                      {userTypeLabel(user.profile.user_type, locale)}
                    </Badge>

                    {user.profile.role ? (
                      <Badge variant="outline" className="rounded-full">
                        {roleLabel(user.profile.role, locale)}
                      </Badge>
                    ) : null}
                  </div>

                  <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                    {user.profile.display_name || user.full_name || user.username}
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                    {labels.subtitle}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Can permission={PERMISSIONS.USERS_VIEW}>
                  <Button asChild type="button" variant="outline" className="rounded-2xl">
                    <Link href="/system/users">
                      <BackIcon className="h-4 w-4" />
                      <span>{labels.back}</span>
                    </Link>
                  </Button>
                </Can>

                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  onClick={loadUser}
                  className="rounded-2xl"
                >
                  <RefreshCcw className="h-4 w-4" />
                  <span>{labels.refresh}</span>
                </Button>

                {user.is_active ? (
                  <Can permission={PERMISSIONS.USERS_DISABLE}>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={!!actionLoading}
                      onClick={() => runAction("deactivate")}
                      className="rounded-2xl"
                    >
                      {actionLoading === "deactivate" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Ban className="h-4 w-4" />
                      )}
                      <span>{labels.deactivate}</span>
                    </Button>
                  </Can>
                ) : (
                  <Can permission={PERMISSIONS.USERS_DISABLE}>
                    <Button
                      type="button"
                      disabled={!!actionLoading}
                      onClick={() => runAction("activate")}
                      className="rounded-2xl bg-emerald-600 hover:bg-emerald-700"
                    >
                      {actionLoading === "activate" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      <span>{labels.activate}</span>
                    </Button>
                  </Can>
                )}

                <Can permission={PERMISSIONS.USERS_EDIT}>
                  <Button
                    type="submit"
                    disabled={saving}
                    className="rounded-2xl bg-slate-900 hover:bg-slate-800"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    <span>{saving ? labels.saving : labels.save}</span>
                  </Button>
                </Can>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <InfoCard label={labels.createdAt} value={formatDate(user.date_joined, locale)} />
              <InfoCard label={labels.lastLogin} value={formatDate(user.last_login, locale)} />
              <InfoCard label={labels.groups} value={user.groups.length ? user.groups.join(", ") : "—"} />
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="rounded-3xl border-0 shadow-sm">
                <CardHeader>
                  <CardTitle>{labels.account}</CardTitle>
                </CardHeader>

                <CardContent className="grid gap-4">
                  <Field label={labels.username}>
                    <Input
                      value={form.username}
                      onChange={(event) => updateField("username", event.target.value)}
                      className="h-11 rounded-2xl"
                    />
                  </Field>

                  <Field label={labels.email}>
                    <Input
                      value={form.email}
                      onChange={(event) => updateField("email", event.target.value)}
                      type="email"
                      className="h-11 rounded-2xl"
                    />
                  </Field>

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

                  <Can permission={PERMISSIONS.USERS_EDIT}>
                    <Field label={labels.password}>
                      <Input
                        value={form.password}
                        onChange={(event) => updateField("password", event.target.value)}
                        type="password"
                        className="h-11 rounded-2xl"
                        placeholder={
                          isArabic ? "اتركها فارغة بدون تغيير" : "Leave empty to keep current"
                        }
                      />
                    </Field>
                  </Can>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-0 shadow-sm">
                <CardHeader>
                  <CardTitle>{labels.profile}</CardTitle>
                </CardHeader>

                <CardContent className="grid gap-4">
                  <Field label={labels.displayName}>
                    <Input
                      value={form.display_name}
                      onChange={(event) => updateField("display_name", event.target.value)}
                      className="h-11 rounded-2xl"
                    />
                  </Field>

                  <Field label={labels.userType}>
                    <select
                      value={form.user_type}
                      onChange={(event) => updateField("user_type", event.target.value)}
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
                    >
                      {USER_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {isArabic ? option.ar : option.en}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {user.profile.role ? (
                    <Field label={labels.role}>
                      <Input
                        value={roleLabel(user.profile.role, locale)}
                        readOnly
                        className="h-11 rounded-2xl bg-slate-50"
                      />
                    </Field>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label={labels.phone}>
                      <Input
                        value={form.phone_number}
                        onChange={(event) => updateField("phone_number", event.target.value)}
                        className="h-11 rounded-2xl"
                      />
                    </Field>

                    <Field label={labels.whatsapp}>
                      <Input
                        value={form.whatsapp_number}
                        onChange={(event) => updateField("whatsapp_number", event.target.value)}
                        className="h-11 rounded-2xl"
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
                  <CardTitle>{labels.permissions}</CardTitle>
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

                  <Field label={labels.bio}>
                    <textarea
                      value={form.bio}
                      onChange={(event) => updateField("bio", event.target.value)}
                      rows={4}
                      className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-slate-400"
                    />
                  </Field>

                  <Field label={labels.avatar}>
                    <Input
                      value={form.avatar_url}
                      onChange={(event) => updateField("avatar_url", event.target.value)}
                      className="h-11 rounded-2xl"
                    />
                  </Field>

                  <Can permission={PERMISSIONS.USERS_EDIT}>
                    <div className="grid gap-3">
                      <CheckField
                        label={labels.isActive}
                        checked={form.is_active}
                        onChange={(checked) => updateField("is_active", checked)}
                      />
                      <CheckField
                        label={labels.isStaff}
                        checked={form.is_staff}
                        onChange={(checked) => updateField("is_staff", checked)}
                      />
                      <CheckField
                        label={labels.isSuperuser}
                        checked={form.is_superuser}
                        onChange={(checked) => updateField("is_superuser", checked)}
                      />
                    </div>
                  </Can>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-0 shadow-sm">
                <CardHeader>
                  <CardTitle>{labels.context}</CardTitle>
                  <CardDescription>{labels.extraData}</CardDescription>
                </CardHeader>

                <CardContent className="grid gap-4">
                  <pre className="max-h-80 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                    {JSON.stringify(user.profile.extra_data || {}, null, 2)}
                  </pre>

                  <Can permission={PERMISSIONS.USERS_EDIT}>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!!actionLoading}
                      onClick={() => runAction("send-password-link")}
                      className="rounded-2xl"
                    >
                      {actionLoading === "send-password-link" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <KeyRound className="h-4 w-4" />
                      )}
                      <span>{labels.passwordLink}</span>
                    </Button>
                  </Can>

                  {resetUrl ? (
                    <div className="rounded-2xl border bg-slate-50 p-4">
                      <div className="mb-2 text-sm font-medium text-slate-700">
                        {labels.resetUrl}
                      </div>

                      <div className="break-all rounded-xl bg-white p-3 text-xs text-slate-700">
                        {resetUrl}
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={copyResetUrl}
                        className="mt-3 rounded-2xl"
                      >
                        <Copy className="h-4 w-4" />
                        <span>{labels.copy}</span>
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </form>
        </main>
      )}
    </PermissionGuard>
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

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-2xl border bg-white p-4 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4"
      />
      <span>{label}</span>
    </label>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-3xl border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="break-words text-base">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}