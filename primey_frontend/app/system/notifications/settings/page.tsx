"use client";

/* ============================================================
   📂 app/system/notifications/settings/page.tsx
   🧠 Primey Care | Notification Settings Page
============================================================ */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CheckCircle2,
  Loader2,
  Mail,
  MessageCircle,
  RefreshCcw,
  Save,
  Settings,
  ShieldCheck,
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

/* ============================================================
   Types
============================================================ */

type AppLocale = "ar" | "en";

type SettingsPayload = {
  ok?: boolean;
  data?: {
    app_name?: string;
    project_brand_name?: string;
    frontend_base_url?: string;
    support_email?: string;
    email_notifications_enabled?: boolean;
    whatsapp_notifications_enabled?: boolean;
    email_logo_url?: string;
    primey_email_logo_url?: string;
    email_audit_bcc?: string[] | string;
    available_channels?: string[];
    readonly?: boolean;
    persisted?: boolean;
    note?: string;
  };
};

/* ============================================================
   Constants
============================================================ */

const API_SETTINGS = "/api/notification-center/settings/";

/* ============================================================
   Helpers
============================================================ */

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

  return parts.length === 2 ? parts.pop()?.split(";").shift() || "" : "";
}

function getCSRFToken() {
  return getCookie("csrftoken") || getCookie("csrf_token") || "";
}

function normalizeBcc(value: unknown) {
  if (!value) return "";

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return String(value);
}

/* ============================================================
   Page
============================================================ */

export default function NotificationSettingsPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [appName, setAppName] = useState("Primey Care");
  const [brandName, setBrandName] = useState("Primey Care");
  const [frontendBaseUrl, setFrontendBaseUrl] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [emailLogoUrl, setEmailLogoUrl] = useState("");
  const [primeyEmailLogoUrl, setPrimeyEmailLogoUrl] = useState("");
  const [auditBcc, setAuditBcc] = useState("");
  const [note, setNote] = useState("");
  const [readonly, setReadonly] = useState(true);

  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";

  const labels = useMemo(
    () => ({
      title: isArabic ? "إعدادات الإشعارات" : "Notification Settings",
      subtitle: isArabic
        ? "عرض إعدادات مركز الإشعارات وقنوات الإرسال الفعالة من إعدادات النظام."
        : "View notification center configuration and enabled channels from system settings.",
      dashboard: isArabic ? "لوحة الإشعارات" : "Dashboard",
      list: isArabic ? "قائمة الإشعارات" : "Notifications List",
      refresh: isArabic ? "تحديث" : "Refresh",
      save: isArabic ? "اعتماد الإعدادات" : "Acknowledge Settings",
      appName: isArabic ? "اسم التطبيق" : "App Name",
      brandName: isArabic ? "اسم العلامة" : "Brand Name",
      frontendUrl: isArabic ? "رابط الواجهة" : "Frontend URL",
      supportEmail: isArabic ? "بريد الدعم" : "Support Email",
      emailEnabled: isArabic ? "تفعيل البريد" : "Email Enabled",
      whatsappEnabled: isArabic ? "تفعيل واتساب" : "WhatsApp Enabled",
      emailLogo: isArabic ? "رابط شعار البريد" : "Email Logo URL",
      primeyEmailLogo: isArabic ? "رابط شعار Primey" : "Primey Email Logo URL",
      auditBcc: isArabic ? "نسخة تدقيق البريد" : "Email Audit BCC",
      readonly: isArabic ? "قراءة فقط" : "Read Only",
      active: isArabic ? "فعال" : "Active",
      inactive: isArabic ? "غير فعال" : "Inactive",
      note: isArabic ? "ملاحظة" : "Note",
      channels: isArabic ? "القنوات" : "Channels",
      inApp: isArabic ? "داخل النظام" : "In-App",
      email: isArabic ? "البريد الإلكتروني" : "Email",
      whatsapp: isArabic ? "واتساب" : "WhatsApp",
      loading: isArabic ? "جاري تحميل الإعدادات..." : "Loading settings...",
    }),
    [isArabic],
  );

  useEffect(() => {
    const syncLocale = () => {
      const nextLocale = readLocale();
      setLocale(nextLocale);
      applyDocumentLocale(nextLocale);
    };

    syncLocale();

    window.addEventListener("primey-locale-changed", syncLocale);
    window.addEventListener("storage", syncLocale);

    return () => {
      window.removeEventListener("primey-locale-changed", syncLocale);
      window.removeEventListener("storage", syncLocale);
    };
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);

      const res = await fetch(API_SETTINGS, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        throw new Error(`Settings request failed: ${res.status}`);
      }

      const payload = (await res.json()) as SettingsPayload;
      const data = payload.data || {};

      setAppName(data.app_name || "Primey Care");
      setBrandName(data.project_brand_name || "Primey Care");
      setFrontendBaseUrl(data.frontend_base_url || "");
      setSupportEmail(data.support_email || "");
      setEmailEnabled(Boolean(data.email_notifications_enabled));
      setWhatsappEnabled(Boolean(data.whatsapp_notifications_enabled));
      setEmailLogoUrl(data.email_logo_url || "");
      setPrimeyEmailLogoUrl(data.primey_email_logo_url || "");
      setAuditBcc(normalizeBcc(data.email_audit_bcc));
      setNote(data.note || "");
      setReadonly(data.readonly !== false);
    } catch (error) {
      console.error("Notification settings load error:", error);
      toast.error(
        isArabic
          ? "تعذر تحميل إعدادات الإشعارات"
          : "Could not load notification settings",
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    try {
      setSaving(true);

      const csrfToken = getCSRFToken();

      const res = await fetch(API_SETTINGS, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
        },
        body: JSON.stringify({
          app_name: appName,
          project_brand_name: brandName,
          frontend_base_url: frontendBaseUrl,
          support_email: supportEmail,
          email_notifications_enabled: emailEnabled,
          whatsapp_notifications_enabled: whatsappEnabled,
          email_logo_url: emailLogoUrl,
          primey_email_logo_url: primeyEmailLogoUrl,
          email_audit_bcc: auditBcc,
        }),
      });

      if (!res.ok) {
        throw new Error(`Settings save failed: ${res.status}`);
      }

      const payload = (await res.json()) as SettingsPayload;
      const data = payload.data || {};

      setNote(data.note || note);
      setReadonly(data.readonly !== false);

      toast.success(
        isArabic
          ? "تم اعتماد إعدادات الإشعارات"
          : "Notification settings acknowledged",
      );
    } catch (error) {
      console.error("Notification settings save error:", error);
      toast.error(
        isArabic
          ? "تعذر اعتماد إعدادات الإشعارات"
          : "Could not acknowledge notification settings",
      );
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  return (
    <main dir={dir} className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {labels.title}
          </h1>
          <p className="text-muted-foreground max-w-3xl text-sm leading-7">
            {labels.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/system/notifications">
              <Bell className="size-4" />
              {labels.dashboard}
            </Link>
          </Button>

          <Button asChild variant="outline">
            <Link href="/system/notifications/list">
              <Settings className="size-4" />
              {labels.list}
            </Link>
          </Button>

          <Button variant="outline" onClick={loadSettings} disabled={loading}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCcw className="size-4" />
            )}
            {labels.refresh}
          </Button>

          <Button onClick={saveSettings} disabled={saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {labels.save}
          </Button>
        </div>
      </section>

      {loading ? (
        <Card>
          <CardContent className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
            <Loader2 className="size-4 animate-spin" />
            {labels.loading}
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="size-5" />
                  {labels.readonly}
                </CardTitle>
                <CardDescription>
                  {isArabic
                    ? "الإعدادات الحالية مشتقة من Django settings/env."
                    : "Current settings are derived from Django settings/env."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant={readonly ? "secondary" : "default"}>
                  {readonly ? labels.readonly : labels.active}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="size-5" />
                  {labels.email}
                </CardTitle>
                <CardDescription>{labels.emailEnabled}</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant={emailEnabled ? "default" : "outline"}>
                  {emailEnabled ? labels.active : labels.inactive}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="size-5" />
                  {labels.whatsapp}
                </CardTitle>
                <CardDescription>{labels.whatsappEnabled}</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant={whatsappEnabled ? "default" : "outline"}>
                  {whatsappEnabled ? labels.active : labels.inactive}
                </Badge>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle>{labels.title}</CardTitle>
                <CardDescription>
                  {isArabic
                    ? "يمكن اعتماد القيم من الواجهة، لكن التخزين الدائم يتم من إعدادات البيئة حاليًا."
                    : "Values can be acknowledged from the UI, but persistence currently comes from environment settings."}
                </CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {labels.appName}
                    </label>
                    <Input
                      value={appName}
                      onChange={(event) => setAppName(event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {labels.brandName}
                    </label>
                    <Input
                      value={brandName}
                      onChange={(event) => setBrandName(event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {labels.frontendUrl}
                    </label>
                    <Input
                      value={frontendBaseUrl}
                      onChange={(event) =>
                        setFrontendBaseUrl(event.target.value)
                      }
                      placeholder="https://app.primeycare.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {labels.supportEmail}
                    </label>
                    <Input
                      value={supportEmail}
                      onChange={(event) => setSupportEmail(event.target.value)}
                      placeholder="support@example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {labels.emailLogo}
                    </label>
                    <Input
                      value={emailLogoUrl}
                      onChange={(event) => setEmailLogoUrl(event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {labels.primeyEmailLogo}
                    </label>
                    <Input
                      value={primeyEmailLogoUrl}
                      onChange={(event) =>
                        setPrimeyEmailLogoUrl(event.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {labels.auditBcc}
                  </label>
                  <Input
                    value={auditBcc}
                    onChange={(event) => setAuditBcc(event.target.value)}
                    placeholder="audit@example.com, admin@example.com"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex items-center justify-between rounded-2xl border p-4">
                    <span className="text-sm font-medium">
                      {labels.emailEnabled}
                    </span>
                    <input
                      type="checkbox"
                      checked={emailEnabled}
                      onChange={(event) =>
                        setEmailEnabled(event.target.checked)
                      }
                      className="size-4"
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-2xl border p-4">
                    <span className="text-sm font-medium">
                      {labels.whatsappEnabled}
                    </span>
                    <input
                      type="checkbox"
                      checked={whatsappEnabled}
                      onChange={(event) =>
                        setWhatsappEnabled(event.target.checked)
                      }
                      className="size-4"
                    />
                  </label>
                </div>

                {note ? (
                  <div className="text-muted-foreground rounded-2xl border bg-muted/30 p-4 text-sm leading-7">
                    <strong className="text-foreground">{labels.note}: </strong>
                    {note}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{labels.channels}</CardTitle>
                <CardDescription>
                  {isArabic
                    ? "حالة القنوات المتاحة في مركز الإشعارات."
                    : "Current status of available notification channels."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl border p-4">
                  <div className="flex items-center gap-2">
                    <Bell className="size-4" />
                    <span className="text-sm">{labels.inApp}</span>
                  </div>
                  <Badge>
                    <CheckCircle2 className="me-1 size-3" />
                    {labels.active}
                  </Badge>
                </div>

                <div className="flex items-center justify-between rounded-2xl border p-4">
                  <div className="flex items-center gap-2">
                    <Mail className="size-4" />
                    <span className="text-sm">{labels.email}</span>
                  </div>
                  <Badge variant={emailEnabled ? "default" : "outline"}>
                    {emailEnabled ? labels.active : labels.inactive}
                  </Badge>
                </div>

                <div className="flex items-center justify-between rounded-2xl border p-4">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="size-4" />
                    <span className="text-sm">{labels.whatsapp}</span>
                  </div>
                  <Badge variant={whatsappEnabled ? "default" : "outline"}>
                    {whatsappEnabled ? labels.active : labels.inactive}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </main>
  );
}