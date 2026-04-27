"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Eye,
  EyeOff,
  Languages,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  User2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/* =========================================================
   📌 Primey Care - Login Page
   ✅ متوافق مع Primey Care
   ✅ يدعم العربية والإنجليزية
   ✅ يدعم RTL / LTR
   ✅ CSRF + Login + whoami
   ✅ Redirect ذكي حسب نوع المستخدم
   ✅ يعتمد dashboard_path من whoami
========================================================= */

type AppLocale = "ar" | "en";

type WhoAmIResponse = {
  authenticated?: boolean;
  workspace?: string | null;
  dashboard_path?: string | null;
  is_system_user?: boolean;
  is_superuser?: boolean;
  is_staff?: boolean;
  role?: string | null;
  user_type?: string | null;
  scope_type?: string | null;
  company_id?: number | null;
  center_id?: number | null;
  customer_id?: number | null;
  agent_id?: number | null;
  permissions?: {
    is_superuser?: boolean;
    is_staff?: boolean;
    groups?: string[];
  } | null;
  profile?: {
    user_type?: string | null;
    extra_data?: Record<string, unknown> | null;
  } | null;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);

  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() ?? null;
  }

  return null;
}

function resolveApiUrl(path: string): string {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${safePath}` : safePath;
}

function normalizeUpper(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

function extractBoolean(value: unknown): boolean {
  return value === true;
}

function extractIds(user: WhoAmIResponse | null) {
  const profileExtra = user?.profile?.extra_data ?? {};

  const toId = (value: unknown): number | null => {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : null;
  };

  return {
    companyId: toId(user?.company_id ?? profileExtra?.["company_id"]),
    centerId: toId(user?.center_id ?? profileExtra?.["center_id"]),
    customerId: toId(user?.customer_id ?? profileExtra?.["customer_id"]),
    agentId: toId(user?.agent_id ?? profileExtra?.["agent_id"]),
  };
}

function isSystemUser(user: WhoAmIResponse | null): boolean {
  if (!user) return false;

  const normalizedRole = normalizeUpper(user.role);
  const normalizedUserType = normalizeUpper(
    user.user_type || user.profile?.user_type
  );
  const normalizedScope = normalizeUpper(user.scope_type);
  const permissions = user.permissions || {};
  const groups = Array.isArray(permissions.groups)
    ? permissions.groups.map((item) => normalizeUpper(item))
    : [];

  return (
    extractBoolean(user.is_system_user) ||
    extractBoolean(user.is_superuser) ||
    extractBoolean(user.is_staff) ||
    extractBoolean(permissions.is_superuser) ||
    extractBoolean(permissions.is_staff) ||
    [
      "SYSTEM",
      "SUPER_ADMIN",
      "SYSTEM_ADMIN",
      "SUPPORT",
      "INTERNAL",
      "ADMIN",
    ].includes(normalizedRole) ||
    ["SYSTEM", "SUPER_ADMIN", "SYSTEM_ADMIN", "SUPPORT"].includes(
      normalizedUserType
    ) ||
    normalizedScope === "SYSTEM" ||
    groups.some((group) =>
      ["SYSTEM", "SUPER_ADMIN", "SYSTEM_ADMIN", "SUPPORT", "ADMIN"].includes(
        group
      )
    )
  );
}

function resolveRedirectPath(user: WhoAmIResponse | null): string {
  if (!user) return "/system";

  const dashboardPath = String(user.dashboard_path || "").trim();
  if (dashboardPath.startsWith("/")) {
    return dashboardPath;
  }

  if (isSystemUser(user)) {
    return "/system";
  }

  const { companyId, centerId, customerId, agentId } = extractIds(user);

  if (companyId) {
    return "/company";
  }

  if (centerId) {
    return "/center";
  }

  if (customerId) {
    return "/customer";
  }

  if (agentId) {
    return "/agent";
  }

  return "/system";
}

export default function Page() {
  const router = useRouter();

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isArabic = locale === "ar";

  const content = useMemo(
    () => ({
      title: isArabic ? "مرحبًا بعودتك" : "Welcome back",
      subtitle: isArabic
        ? "سجّل الدخول للوصول إلى منصة Primey Care وإدارة عملياتك بسهولة وأمان"
        : "Sign in to access Primey Care and manage your operations securely",
      usernameLabel: isArabic ? "اسم المستخدم" : "Username",
      passwordLabel: isArabic ? "كلمة المرور" : "Password",
      remember: isArabic ? "تذكرني" : "Remember me",
      resetPassword: isArabic ? "إعادة تعيين كلمة المرور؟" : "Reset password?",
      login: isArabic ? "تسجيل الدخول" : "Sign in",
      loading: isArabic ? "جارٍ تسجيل الدخول..." : "Signing in...",
      passwordShow: isArabic ? "إظهار كلمة المرور" : "Show password",
      passwordHide: isArabic ? "إخفاء كلمة المرور" : "Hide password",
      securityNote: isArabic
        ? "جلسة دخول آمنة ومحمية"
        : "Secure protected session",
      welcomeBadge: isArabic ? "بوابة الدخول" : "Access portal",
      invalidCredentials: isArabic
        ? "اسم المستخدم أو كلمة المرور غير صحيحة"
        : "Invalid username or password",
      csrfMissing: isArabic
        ? "تعذر تجهيز جلسة الأمان، حاول مرة أخرى"
        : "Unable to initialize secure session, please try again",
      sessionFailed: isArabic
        ? "تم تسجيل الدخول لكن تعذر التحقق من الجلسة"
        : "Signed in, but session validation failed",
      loginFailed: isArabic ? "فشل تسجيل الدخول" : "Login failed",
      requiredFields: isArabic
        ? "يرجى تعبئة اسم المستخدم وكلمة المرور"
        : "Please enter username and password",
      loginSuccess: isArabic
        ? "تم تسجيل الدخول بنجاح"
        : "Signed in successfully",
      usernamePlaceholder: isArabic ? "أدخل اسم المستخدم" : "Enter your username",
      passwordPlaceholder: isArabic ? "أدخل كلمة المرور" : "Enter your password",
    }),
    [isArabic]
  );

  useEffect(() => {
    try {
      const savedLocale =
        typeof window !== "undefined"
          ? (window.localStorage.getItem("primey-locale") as AppLocale | null)
          : null;

      const nextLocale: AppLocale = savedLocale === "en" ? "en" : "ar";
      setLocale(nextLocale);

      if (typeof document !== "undefined") {
        document.documentElement.lang = nextLocale;
        document.documentElement.dir = nextLocale === "ar" ? "rtl" : "ltr";
        document.body.setAttribute("dir", nextLocale === "ar" ? "rtl" : "ltr");
      }
    } catch (err) {
      console.error("Login locale initialization error:", err);
    }
  }, []);

  const toggleLanguage = () => {
    try {
      const nextLocale: AppLocale = locale === "ar" ? "en" : "ar";
      setLocale(nextLocale);

      if (typeof window !== "undefined") {
        window.localStorage.setItem("primey-locale", nextLocale);
      }

      if (typeof document !== "undefined") {
        document.documentElement.lang = nextLocale;
        document.documentElement.dir = nextLocale === "ar" ? "rtl" : "ltr";
        document.body.setAttribute("dir", nextLocale === "ar" ? "rtl" : "ltr");
      }
    } catch (err) {
      console.error("Login language toggle error:", err);
    }
  };

  /* =========================================================
     🚀 Login Handler
  ========================================================= */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (loading) return;

    if (!username.trim() || !password.trim()) {
      setError(content.requiredFields);
      toast.error(content.requiredFields);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const csrfResponse = await fetch(resolveApiUrl("/api/auth/csrf/"), {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (!csrfResponse.ok) {
        throw new Error(content.csrfMissing);
      }

      const csrfToken = getCookie("csrftoken");

      if (!csrfToken) {
        throw new Error(content.csrfMissing);
      }

      const loginResponse = await fetch(resolveApiUrl("/api/auth/login/"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
          remember,
        }),
      });

      if (!loginResponse.ok) {
        throw new Error(content.invalidCredentials);
      }

      const whoamiResponse = await fetch(resolveApiUrl("/api/auth/whoami/"), {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (!whoamiResponse.ok) {
        throw new Error(content.sessionFailed);
      }

      const user = (await whoamiResponse.json()) as WhoAmIResponse;
      const redirectPath = resolveRedirectPath(user);

      toast.success(content.loginSuccess);
      router.replace(redirectPath);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : content.loginFailed;

      setError(message);
      toast.error(message);
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.10),_transparent_30%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.10),_transparent_35%),linear-gradient(to_bottom_right,_hsl(var(--background)),_hsl(var(--muted)/0.55))]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/10 to-transparent" />
        <div className="absolute -left-16 top-24 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-16 bottom-16 h-60 w-60 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/20 bg-background/80 shadow-2xl backdrop-blur-xl lg:grid-cols-2">
          <section className="relative hidden min-h-[720px] overflow-hidden bg-gradient-to-br from-primary/95 via-primary to-emerald-600 text-white lg:flex">
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
            <div className="absolute right-[-80px] top-[-80px] h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-[-90px] left-[-90px] h-80 w-80 rounded-full bg-black/10 blur-3xl" />

            <div className="relative z-10 flex h-full w-full flex-col justify-between p-10 xl:p-14">
              <div
                className={`flex items-center gap-3 ${
                  isArabic ? "flex-row-reverse" : ""
                }`}
              >
                <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div className={isArabic ? "text-right" : "text-left"}>
                  <p className="text-sm font-medium text-white/80">
                    {content.welcomeBadge}
                  </p>
                  <h1 className="text-2xl font-bold tracking-tight">
                    Primey Care
                  </h1>
                </div>
              </div>

              <div className={isArabic ? "text-right" : "text-left"}>
                <div
                  className={`mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm backdrop-blur ${
                    isArabic ? "flex-row-reverse" : ""
                  }`}
                >
                  <LockKeyhole className="h-4 w-4" />
                  <span>{content.securityNote}</span>
                </div>

                <h2 className="max-w-xl text-4xl font-extrabold leading-tight xl:text-5xl">
                  {isArabic
                    ? "إدارة متقدمة لخدمات Primey Care من لوحة دخول موحدة"
                    : "Advanced Primey Care operations through one unified access portal"}
                </h2>

                <p className="mt-6 max-w-xl text-base leading-8 text-white/85 xl:text-lg">
                  {isArabic
                    ? "سجّل الدخول للوصول إلى النظام حسب صلاحيتك، سواء كنت مستخدم نظام، شركة، مركز، عميل أو مندوب، مع تجربة حديثة وآمنة ومتوافقة مع بنية Primey Care."
                    : "Sign in and access the platform according to your permissions, whether you are a system user, company, center, customer, or agent, with a modern and secure experience tailored for Primey Care."}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-md">
                  <div
                    className={`mb-3 flex items-center gap-3 ${
                      isArabic ? "flex-row-reverse" : ""
                    }`}
                  >
                    <div className="rounded-2xl bg-white/10 p-2">
                      <User2 className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold">
                      {isArabic ? "دخول حسب الدور" : "Role-based access"}
                    </h3>
                  </div>
                  <p className="text-sm leading-7 text-white/80">
                    {isArabic
                      ? "يتم توجيه المستخدم تلقائيًا إلى المسار المناسب بعد تسجيل الدخول."
                      : "Users are redirected automatically to the correct workspace after login."}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-md">
                  <div
                    className={`mb-3 flex items-center gap-3 ${
                      isArabic ? "flex-row-reverse" : ""
                    }`}
                  >
                    <div className="rounded-2xl bg-white/10 p-2">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold">
                      {isArabic ? "حماية الجلسة" : "Session protection"}
                    </h3>
                  </div>
                  <p className="text-sm leading-7 text-white/80">
                    {isArabic
                      ? "المصادقة تتم عبر CSRF + Cookies بشكل آمن ومتوافق مع الباكند."
                      : "Authentication uses secure CSRF + cookie-based session flow compatible with the backend."}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="flex min-h-[720px] items-center justify-center p-5 sm:p-8 lg:p-10">
            <div className="w-full max-w-md">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Image
                    src="/logo/primey.svg"
                    alt="Primey Care"
                    width={132}
                    height={44}
                    priority
                    className="h-auto w-[132px]"
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleLanguage}
                  className="h-10 rounded-2xl border-border/70 bg-background/70 px-3 shadow-sm backdrop-blur"
                >
                  <Languages className="me-1 h-4 w-4" />
                  <span>{isArabic ? "EN" : "عربي"}</span>
                </Button>
              </div>

              <div
                className={`rounded-[28px] border border-border/60 bg-background/90 p-6 shadow-xl backdrop-blur sm:p-8 ${
                  isArabic ? "text-right" : "text-left"
                }`}
              >
                <div className="mb-8">
                  <div
                    className={`mb-4 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary ${
                      isArabic ? "flex-row-reverse" : ""
                    }`}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>{content.welcomeBadge}</span>
                  </div>

                  <h2 className="text-3xl font-bold tracking-tight">
                    {content.title}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    {content.subtitle}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {content.usernameLabel}
                    </label>
                    <div className="relative">
                      <User2
                        className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${
                          isArabic ? "right-4" : "left-4"
                        }`}
                      />
                      <Input
                        required
                        autoComplete="username"
                        dir={isArabic ? "rtl" : "ltr"}
                        placeholder={content.usernamePlaceholder}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={`h-12 rounded-2xl border-border/70 bg-muted/30 shadow-sm ${
                          isArabic
                            ? "pr-11 text-right"
                            : "pl-11 text-left"
                        }`}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {content.passwordLabel}
                    </label>
                    <div className="relative">
                      <LockKeyhole
                        className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${
                          isArabic ? "right-4" : "left-4"
                        }`}
                      />

                      <Input
                        required
                        autoComplete="current-password"
                        type={showPassword ? "text" : "password"}
                        dir={isArabic ? "rtl" : "ltr"}
                        placeholder={content.passwordPlaceholder}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`h-12 rounded-2xl border-border/70 bg-muted/30 shadow-sm ${
                          isArabic
                            ? "pr-11 pl-12 text-right"
                            : "pl-11 pr-12 text-left"
                        }`}
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className={`absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground ${
                          isArabic ? "left-2" : "right-2"
                        }`}
                        aria-label={
                          showPassword
                            ? content.passwordHide
                            : content.passwordShow
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div
                    className={`flex items-center justify-between gap-3 text-sm ${
                      isArabic ? "flex-row-reverse" : ""
                    }`}
                  >
                    <label
                      className={`flex cursor-pointer items-center gap-2 text-muted-foreground ${
                        isArabic ? "flex-row-reverse" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={() => setRemember((prev) => !prev)}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <span>{content.remember}</span>
                    </label>

                    <Link
                      href="/reset-password"
                      className="font-medium text-primary transition hover:underline"
                    >
                      {content.resetPassword}
                    </Link>
                  </div>

                  {error ? (
                    <div
                      className={`rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400 ${
                        isArabic ? "text-right" : "text-left"
                      }`}
                    >
                      {error}
                    </div>
                  ) : null}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-12 w-full rounded-2xl text-base font-semibold shadow-lg"
                  >
                    {loading ? (
                      <span
                        className={`flex items-center justify-center gap-2 ${
                          isArabic ? "flex-row-reverse" : ""
                        }`}
                      >
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{content.loading}</span>
                      </span>
                    ) : (
                      content.login
                    )}
                  </Button>
                </form>

                <div className="mt-6 border-t border-border/60 pt-5">
                  <p
                    className={`text-xs leading-6 text-muted-foreground ${
                      isArabic ? "text-right" : "text-left"
                    }`}
                  >
                    {isArabic
                      ? "بتسجيل الدخول، سيتم توجيهك تلقائيًا إلى الواجهة المناسبة حسب صلاحياتك داخل Primey Care."
                      : "After signing in, you will be redirected automatically to the correct Primey Care workspace based on your permissions."}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}